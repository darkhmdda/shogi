-- =============================================================================
-- Shōgi · Supabase · 1/2: perfiles, progreso y partidas guardadas.
-- Ejecutar en el panel de Supabase: SQL Editor → New query → pegar → Run.
-- Es idempotente: se puede ejecutar más de una vez sin romper nada.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Perfiles: nombre de usuario público de cada cuenta.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique
    check (username ~ '^[a-z0-9_.-]{3,32}$'),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Perfiles visibles para usuarios registrados" on public.profiles;
create policy "Perfiles visibles para usuarios registrados"
  on public.profiles for select to authenticated using (true);

drop policy if exists "Cada usuario edita su perfil" on public.profiles;
create policy "Cada usuario edita su perfil"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ¿Está libre un nombre de usuario? (se puede consultar antes de registrarse)
create or replace function public.username_available(name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from public.profiles where username = lower(name));
$$;

-- Al registrarse, se crea el perfil con el nombre enviado en los metadatos.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, lower(coalesce(new.raw_user_meta_data ->> 'username', 'jugador-' || left(new.id::text, 8))));
  insert into public.progress (user_id) values (new.id);
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Progreso de aprendizaje (mismo formato que la web y la app móvil).
-- ---------------------------------------------------------------------------
create table if not exists public.progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  lessons jsonb not null default '{}'::jsonb,
  puzzles jsonb not null default '{}'::jsonb,
  games_played integer not null default 0 check (games_played >= 0),
  games_won integer not null default 0 check (games_won >= 0),
  games_lost integer not null default 0 check (games_lost >= 0),
  games_drawn integer not null default 0 check (games_drawn >= 0),
  updated_at timestamptz not null default now()
);

alter table public.progress enable row level security;

drop policy if exists "Cada usuario ve su progreso" on public.progress;
create policy "Cada usuario ve su progreso"
  on public.progress for select to authenticated using (user_id = auth.uid());

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Fusiona el progreso del dispositivo con el guardado, sin perder nunca nada:
-- unión de lecciones y problemas (fecha más antigua) y máximo de contadores.
create or replace function public.merge_progress(incoming jsonb)
returns public.progress
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  result public.progress;
begin
  if uid is null then
    raise exception 'Hay que iniciar sesión.' using errcode = '42501';
  end if;

  insert into public.progress (user_id) values (uid) on conflict (user_id) do nothing;

  update public.progress p set
    lessons = (
      select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from (
        select k, min(v) as v from (
          select key as k, value #>> '{}' as v from jsonb_each(p.lessons)
          union all
          select key, value #>> '{}' from jsonb_each(coalesce(incoming -> 'lessons', '{}'::jsonb))
          where key ~ '^[a-z0-9-]{1,64}$'
        ) todas group by k
      ) unidas
    ),
    puzzles = (
      select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from (
        select k, min(v) as v from (
          select key as k, value #>> '{}' as v from jsonb_each(p.puzzles)
          union all
          select key, value #>> '{}' from jsonb_each(coalesce(incoming -> 'puzzles', '{}'::jsonb))
          where key ~ '^[a-z0-9-]{1,64}$'
        ) todas group by k
      ) unidas
    ),
    games_played = greatest(p.games_played, coalesce((incoming #>> '{games,played}')::int, 0)),
    games_won = greatest(p.games_won, coalesce((incoming #>> '{games,won}')::int, 0)),
    games_lost = greatest(p.games_lost, coalesce((incoming #>> '{games,lost}')::int, 0)),
    games_drawn = greatest(p.games_drawn, coalesce((incoming #>> '{games,drawn}')::int, 0)),
    updated_at = now()
  where p.user_id = uid
  returning * into result;

  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Partidas guardadas contra la máquina (posición SFEN + movimientos USI).
-- ---------------------------------------------------------------------------
create table if not exists public.games (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  start_sfen text not null check (length(start_sfen) <= 160),
  moves text[] not null default '{}' check (cardinality(moves) <= 1000),
  winner text check (winner in ('sente', 'gote')),
  reason text check (reason in ('checkmate', 'no-moves', 'repetition', 'perpetual-check', 'resignation', 'impasse')),
  mode text not null default 'ai' check (mode in ('ai', 'local')),
  difficulty text check (difficulty in ('easy', 'normal', 'hard')),
  human_side text check (human_side in ('sente', 'gote')),
  created_at timestamptz not null default now()
);

create index if not exists games_user_created_idx on public.games (user_id, created_at desc);

alter table public.games enable row level security;

drop policy if exists "Cada usuario ve sus partidas" on public.games;
create policy "Cada usuario ve sus partidas"
  on public.games for select to authenticated using (user_id = auth.uid());

drop policy if exists "Cada usuario guarda sus partidas" on public.games;
create policy "Cada usuario guarda sus partidas"
  on public.games for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "Cada usuario borra sus partidas" on public.games;
create policy "Cada usuario borra sus partidas"
  on public.games for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Borrar la propia cuenta (y, en cascada, perfil, progreso y partidas).
-- ---------------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Hay que iniciar sesión.' using errcode = '42501';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

-- ---------------------------------------------------------------------------
-- Permisos de la API (el proyecto no los concede automáticamente).
-- ---------------------------------------------------------------------------
revoke all on public.profiles, public.progress, public.games from anon, authenticated;
grant select, update (username) on public.profiles to authenticated;
grant select on public.progress to authenticated;
grant select, insert, delete on public.games to authenticated;
grant usage on sequence public.games_id_seq to authenticated;

revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;
revoke all on function public.merge_progress(jsonb) from public;
grant execute on function public.merge_progress(jsonb) to authenticated;
revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

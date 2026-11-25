-- =============================================================================
-- Shōgi · Supabase · 2/2: partidas en línea entre usuarios.
-- Ejecutar después de la 1/2, en SQL Editor → New query → pegar → Run.
-- Es idempotente: se puede ejecutar más de una vez sin romper nada.
--
-- Las jugadas NO se escriben desde la app: las valida y guarda la Edge
-- Function "online-move" con el mismo motor de reglas que usa la app.
-- =============================================================================

create table if not exists public.online_games (
  id bigint generated always as identity primary key,
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  sente_id uuid references auth.users (id) on delete set null,
  gote_id uuid references auth.users (id) on delete set null,
  sente_name text,
  gote_name text,
  start_sfen text not null default 'lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1',
  moves text[] not null default '{}' check (cardinality(moves) <= 1000),
  status text not null default 'waiting' check (status in ('waiting', 'active', 'finished')),
  winner text check (winner in ('sente', 'gote')),
  reason text check (reason in ('checkmate', 'no-moves', 'repetition', 'perpetual-check', 'resignation', 'impasse')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists online_games_sente_idx on public.online_games (sente_id, updated_at desc);
create index if not exists online_games_gote_idx on public.online_games (gote_id, updated_at desc);

alter table public.online_games enable row level security;

-- Solo los dos jugadores ven la partida (también en tiempo real).
drop policy if exists "Los jugadores ven su partida" on public.online_games;
create policy "Los jugadores ven su partida"
  on public.online_games for select to authenticated
  using (auth.uid() in (sente_id, gote_id));

-- Nadie escribe directamente: solo a través de las funciones de abajo
-- y de la Edge Function (que usa la clave de servicio).
revoke all on public.online_games from anon, authenticated;
grant select on public.online_games to authenticated;
-- La Edge Function usa la clave de servicio (rol service_role). Si el proyecto
-- no concede permisos automáticamente a las tablas nuevas, hay que dárselos.
grant select, update on public.online_games to service_role;

-- Tiempo real: los cambios de la tabla se envían a los jugadores conectados.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'online_games'
  ) then
    alter publication supabase_realtime add table public.online_games;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Crear partida: devuelve la fila con un código de 6 caracteres para compartir.
-- ---------------------------------------------------------------------------
create or replace function public.create_online_game(side text default 'random')
returns public.online_games
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  name text;
  chosen text := side;
  new_code text;
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result public.online_games;
begin
  if uid is null then
    raise exception 'Hay que iniciar sesión.' using errcode = '42501';
  end if;
  if chosen not in ('sente', 'gote', 'random') then
    raise exception 'Lado no válido.' using errcode = '22023';
  end if;
  if chosen = 'random' then
    chosen := case when random() < 0.5 then 'sente' else 'gote' end;
  end if;
  select username into name from public.profiles where id = uid;

  loop
    new_code := '';
    for i in 1..6 loop
      new_code := new_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.online_games where code = new_code);
  end loop;

  insert into public.online_games (code, sente_id, sente_name, gote_id, gote_name)
  values (
    new_code,
    case when chosen = 'sente' then uid end,
    case when chosen = 'sente' then name end,
    case when chosen = 'gote' then uid end,
    case when chosen = 'gote' then name end
  )
  returning * into result;
  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Unirse con el código.
-- ---------------------------------------------------------------------------
create or replace function public.join_online_game(game_code text)
returns public.online_games
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  name text;
  game public.online_games;
begin
  if uid is null then
    raise exception 'Hay que iniciar sesión.' using errcode = '42501';
  end if;
  select * into game from public.online_games where code = upper(trim(game_code)) for update;
  if not found then
    raise exception 'Partida no encontrada.' using errcode = 'P0002';
  end if;
  if uid in (game.sente_id, game.gote_id) then
    return game;
  end if;
  if game.status <> 'waiting' then
    raise exception 'La partida ya tiene dos jugadores.' using errcode = '23505';
  end if;
  select username into name from public.profiles where id = uid;

  update public.online_games set
    sente_id = coalesce(sente_id, uid),
    sente_name = case when sente_id is null then name else sente_name end,
    gote_id = coalesce(gote_id, case when sente_id is not null then uid end),
    gote_name = case when gote_id is null and sente_id is not null then name else gote_name end,
    status = 'active',
    updated_at = now()
  where id = game.id
  returning * into game;
  return game;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rendirse (o cancelar la partida si el rival aún no ha llegado).
-- ---------------------------------------------------------------------------
create or replace function public.resign_online_game(game_code text)
returns public.online_games
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  game public.online_games;
begin
  select * into game from public.online_games where code = upper(trim(game_code)) for update;
  if not found or uid is null or uid not in (game.sente_id, game.gote_id) then
    raise exception 'Partida no encontrada.' using errcode = 'P0002';
  end if;
  if game.status = 'finished' then
    raise exception 'La partida ya ha terminado.' using errcode = '22023';
  end if;

  update public.online_games set
    status = 'finished',
    reason = 'resignation',
    winner = case
      when game.status = 'waiting' then null
      when uid = game.sente_id then 'gote'
      else 'sente'
    end,
    updated_at = now()
  where id = game.id
  returning * into game;
  return game;
end;
$$;

revoke all on function public.create_online_game(text) from public;
revoke all on function public.join_online_game(text) from public;
revoke all on function public.resign_online_game(text) from public;
grant execute on function public.create_online_game(text) to authenticated;
grant execute on function public.join_online_game(text) to authenticated;
grant execute on function public.resign_online_game(text) to authenticated;

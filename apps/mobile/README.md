# Shōgi — aplicación móvil

App para iOS y Android con **Expo SDK 58** y **React Native 0.88**. Reutiliza el
motor (`@shogi/engine`) y la lógica de entrada de jugadas (`@shogi/react`) de la
web, así que las reglas, la IA, las lecciones y los problemas son idénticos.

## Pantallas

- **Inicio:** progreso y guía de piezas.
- **Aprender:** las 16 lecciones guiadas.
- **Problemas:** los 20 tsume (mate en 1, 3 y 5).
- **Jugar:** partida contra la máquina (3 niveles), deshacer, guardado automático.
- **En línea** (con servidor): crear o unirse a partidas con código; se puede
  jugar contra alguien que use la web.

El progreso se guarda en el dispositivo con AsyncStorage, en el mismo formato
que la web y el backend.

## Cuenta (opcional)

Por defecto la app usa el mismo proyecto de Supabase que la web publicada
(`src/config.ts`), así que la cuenta, el progreso y las partidas en línea son
los mismos en el móvil y en la web: incluso se puede jugar móvil contra web.

- Entrar con correo y contraseña; crear cuenta con nombre de usuario público.
- ¿Olvidaste tu contraseña? / reenviar el correo de confirmación (los enlaces
  se abren en la web).
- Cambiar la contraseña y borrar la cuenta (pestaña Cuenta → Seguridad).

Para usar otro servidor: `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_KEY`,
o la API propia con `EXPO_PUBLIC_API_URL` (dejando `EXPO_PUBLIC_SUPABASE_URL=`).

## Uso

```bash
npm install            # desde la raíz del repositorio
cd apps/mobile
npx expo start         # escanea el QR con Expo Go, o pulsa a / i / w
npm run typecheck
npm run export:web     # comprobación de empaquetado (la usa la CI)
```

Instala dependencias nativas con `npx expo install <paquete>` para obtener
versiones compatibles con el SDK.

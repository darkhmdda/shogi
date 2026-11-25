# Probar la app móvil en tu teléfono (Expo Go)

La app móvil (`apps/mobile`) se prueba con **Expo Go**, una app gratuita que
abre el proyecto en tu teléfono escaneando un código QR. No hace falta
publicar nada en las tiendas.

> Si solo quieres usar la app, no necesitas nada de esto: abre
> <https://darkhmdda.github.io/shogi/> en el móvil y pulsa *Añadir a la
> pantalla de inicio*. Esta guía es para probar la **app nativa**.

## Lo que necesitas (una sola vez)

1. En el **ordenador**:
   - [Node.js](https://nodejs.org/) versión 22 o superior (instalador LTS).
   - [Git](https://git-scm.com/downloads).
2. En el **teléfono**: la app **Expo Go** (Play Store o App Store).
3. El teléfono y el ordenador conectados a **la misma red Wi-Fi**.

## Pasos

Abre una terminal en el ordenador (en Windows: *PowerShell*) y ejecuta:

```bash
git clone https://github.com/darkhmdda/shogi.git
cd shogi
npm install
npm run mobile
```

La primera vez `npm install` tarda unos minutos. Al terminar, `npm run mobile`
muestra un **código QR** en la terminal.

- **Android:** abre Expo Go → *Scan QR code* → apunta al código.
- **iPhone:** abre la app **Cámara**, apunta al código y toca el aviso de Expo Go.

La app se carga en el teléfono. Usa el mismo servidor que la web, así que
puedes entrar con tu cuenta de siempre.

## Para actualizar más adelante

```bash
cd shogi
git pull
npm install
npm run mobile
```

## Si algo falla

| Problema | Solución |
|---|---|
| El teléfono no conecta con el ordenador | Comprueba que están en la misma Wi-Fi. Si sigue sin funcionar, para con Ctrl+C y ejecuta `npx expo start --tunnel` dentro de `apps/mobile`. |
| Expo Go dice que la versión del SDK no es compatible | Actualiza Expo Go desde la tienda. |
| El firewall de Windows pregunta por Node.js | Pulsa *Permitir acceso* (red privada). |
| `npm` no se reconoce como comando | Cierra y vuelve a abrir la terminal tras instalar Node.js. |

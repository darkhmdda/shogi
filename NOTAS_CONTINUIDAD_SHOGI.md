# Proyecto Shogi — Nota de continuidad

## Estado actual
- Proyecto React + TypeScript + Vite.
- Frontend: apps/web
- Componente principal: apps/web/src/components/ShogiBoard.tsx
- Estilos: apps/web/src/components/ShogiBoard.css
- Dependencias actuales: React y React DOM.
- No se ha instalado ningún motor de shogi en el proyecto.
- No se han modificado los archivos originales durante la investigación.

## Objetivo
Conservar la interfaz actual y mejorar la lógica del shogi y el modo educativo.
El modo educativo debe poder explicar movimientos, jaque, jaque mate,
promoción y colocaciones de piezas desde la mano.

## Investigación realizada
Se inspeccionó @huguzturk/shogijs versión 1.0.3.
La revisión se hizo en /tmp/shogijs-review, sin instalar la biblioteca
en el proyecto.

La biblioteca exporta una clase Shogi e incluye:
- Generación de movimientos.
- Capturas y gestión de manos.
- Promoción.
- Restricciones de colocación, incluido nifu.
- Detección de jaque.
- Intentos de validar movimientos legales y detectar uchifuzume.
- Detección de jaque mate.

## Posibles limitaciones detectadas
- hasAnyLegalMove() parece comprobar movimientos de piezas, pero no
  colocaciones desde la mano; hay que verificarlo.
- load() no parece limpiar el tablero antes de cargar otra posición.
- isGameOver() solo comprueba el jaque mate.
- Deben verificarse las reglas y la representación de promoción.
- No se encontró una función de exportación SFEN en el código inspeccionado.
- No se debe adoptar como motor principal sin más pruebas.

## Siguiente paso
1. Guardar una versión recuperable del proyecto con Git.
2. Revisar una alternativa como shogiops y comprobar su licencia GPL-3.0-or-later.
3. Comparar las reglas y la API de los motores.
4. Elegir una solución e integrarla mediante un adaptador, conservando
   la interfaz y los estilos actuales.
5. Ejecutar npm run build y probar los casos de jaque, mate, promoción
   y colocación de piezas.

## Comando de compilación
cd ~/Projects/shogi/apps/web && npm run build

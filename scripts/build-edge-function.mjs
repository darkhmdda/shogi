// Empaqueta la Edge Function "online-move" (con el motor de reglas incluido)
// en un solo archivo, listo para pegar en el panel de Supabase o desplegar con
// la CLI. Uso: npm run build:function
import { readFileSync, writeFileSync } from 'node:fs'
import { rolldown } from 'rolldown'

const dir = 'supabase/functions/online-move'
const bundle = await rolldown({
  input: `${dir}/main.ts`,
  external: [/^npm:/],
  platform: 'neutral',
  logLevel: 'warn',
})
const { output } = await bundle.generate({ format: 'esm' })
await bundle.close()

const header = `// @ts-nocheck
// ARCHIVO GENERADO por scripts/build-edge-function.mjs — no editar a mano.
// Código fuente: supabase/functions/online-move/main.ts y handler.ts
// y el motor de packages/engine. Regenerar con: npm run build:function
`
writeFileSync(`${dir}/index.ts`, header + output[0].code)
const size = readFileSync(`${dir}/index.ts`).length
console.log(`${dir}/index.ts generado (${(size / 1024).toFixed(1)} KB)`)

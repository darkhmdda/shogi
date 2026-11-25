// Pone la versión de la app (app.json) a partir de la etiqueta del release.
// Uso: node scripts/android-version.mjs <versión> <número de compilación>
import { readFileSync, writeFileSync } from 'node:fs'

const [version = '1.0.0', build = '1'] = process.argv.slice(2)
const path = 'apps/mobile/app.json'
const config = JSON.parse(readFileSync(path, 'utf8'))
config.expo.version = version.replace(/^v/, '')
config.expo.android.versionCode = Number(build)
writeFileSync(path, JSON.stringify(config, null, 2) + '\n')
console.log(`Versión ${config.expo.version} (compilación ${config.expo.android.versionCode})`)

// Configura la firma del APK con una clave propia (release.keystore), leyendo
// las contraseñas de variables de entorno. Se ejecuta después de "expo prebuild".
import { readFileSync, writeFileSync } from 'node:fs'

const path = 'apps/mobile/android/app/build.gradle'
let gradle = readFileSync(path, 'utf8')

const release = `
        release {
            storeFile file('release.keystore')
            storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD')
            keyAlias System.getenv('ANDROID_KEY_ALIAS')
            keyPassword System.getenv('ANDROID_KEY_PASSWORD')
        }`

if (!/signingConfigs\s*\{/.test(gradle)) throw new Error('No se encontró signingConfigs en build.gradle')
gradle = gradle.replace(/signingConfigs\s*\{/, (match) => match + release)

// En el bloque buildTypes.release, usar la firma propia en lugar de la de depuración.
const start = gradle.search(/buildTypes\s*\{/)
const releaseBlock = gradle.indexOf('release {', start)
const debugSigning = gradle.indexOf('signingConfig signingConfigs.debug', releaseBlock)
if (start < 0 || releaseBlock < 0 || debugSigning < 0) throw new Error('No se encontró buildTypes.release en build.gradle')
gradle =
  gradle.slice(0, debugSigning) +
  'signingConfig signingConfigs.release' +
  gradle.slice(debugSigning + 'signingConfig signingConfigs.debug'.length)

writeFileSync(path, gradle)
console.log('Firma con clave propia configurada.')

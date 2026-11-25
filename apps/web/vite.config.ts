import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// BASE_PATH permite publicar la web en una subcarpeta,
// por ejemplo /shogi/ en GitHub Pages (https://usuario.github.io/shogi/).
const base = process.env.BASE_PATH ?? '/'

// https://vite.dev/config/
export default defineConfig({
  base: base.endsWith('/') ? base : `${base}/`,
  plugins: [react()],
})

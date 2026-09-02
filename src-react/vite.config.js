import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './', // <--- Fondamentale: usa percorsi relativi
  build: {
    outDir: '../www', // oppure 'www' se la cartella è dentro src-react
    emptyOutDir: true,
  }
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Sostituisci 'nome-repository' con il nome esatto della tua repo su GitHub
  base: process.env.NODE_ENV === 'production' ? '/nome-repository/' : '/',
  build: {
    outDir: '../www', // o 'www' a seconda della tua struttura
    emptyOutDir: true,
  }
})

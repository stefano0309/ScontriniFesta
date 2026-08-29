import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // Diciamo a Vite di mandare il codice compilato nella cartella di Capacitor
    outDir: '../www', 
    emptyOutDir: true
  }
})
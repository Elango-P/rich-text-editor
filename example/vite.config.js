import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const exampleDir = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.resolve(exampleDir, '..')

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      // Use package source in the example to avoid duplicate React from file:.. installs.
      'react-lite-rich-text-editor': path.resolve(packageRoot, 'src/index.js'),
      react: path.resolve(exampleDir, 'node_modules/react'),
      'react-dom': path.resolve(exampleDir, 'node_modules/react-dom'),
    },
  },
  server: {
    fs: {
      allow: [exampleDir, packageRoot],
    },
  },
})

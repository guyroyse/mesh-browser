import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import path from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@main': path.resolve(__dirname, 'src/main'),
        '@rns': path.resolve(__dirname, 'src/reticulum'),
        '@protocol-handlers': path.resolve(__dirname, 'src/protocol-handlers')
      }
    },
    build: {
      rollupOptions: {
        input: path.resolve(__dirname, 'src/main/main.ts')
      }
    }
  },
  preload: {
    build: {
      rollupOptions: {
        input: path.resolve(__dirname, 'src/preload/preload.ts'),
        output: {
          format: 'cjs',
          entryFileNames: '[name].js'
        }
      }
    }
  },
  renderer: {
    root: 'src/renderer',
    build: {
      rollupOptions: {
        input: {
          navigation: path.resolve(__dirname, 'src/renderer/navigation/index.html'),
          status: path.resolve(__dirname, 'src/renderer/status/index.html')
        }
      }
    }
  }
})

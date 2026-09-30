import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    // The .NET project lives under this root, so Vite's watcher picks up its
    // build output too — and a `dotnet run` rebuild locks obj/.../apphost.exe
    // long enough for the watcher to die with EBUSY, taking the dev server
    // with it. Nothing under backend/ is part of the frontend build anyway.
    watch: {
      ignored: ['**/backend/**'],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5109',
        changeOrigin: true,
      },
    },
  },
})

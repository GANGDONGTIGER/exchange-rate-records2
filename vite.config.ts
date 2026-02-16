import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/exchange-rate-records2/' // GitHub Pages에 배포할 때 필요한 설정
})

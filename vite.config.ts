import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Default dev port derived from the project creation date (2026-07-18):
 * 6 + 07 + 18 = 60718, which is over 60000, so subtract 50000.
 */
const PORT = Number(process.env.PORT) || 10718;

/**
 * In production the SPA is served same-origin with the FastAPI backend by Traefik,
 * so the app always calls relative paths. In dev we proxy those same paths to a real
 * deployment, which keeps the client code free of environment branching.
 */
const API_TARGET = process.env.API_TARGET || 'https://elucidation.cheminfo.org';

const API_PATHS = ['/submit', '/jobs', '/queue', '/workers', '/openapi.json'];

export default defineConfig({
  plugins: [react()],
  server: {
    port: PORT,
    proxy: Object.fromEntries(
      API_PATHS.map((path) => [
        path,
        { target: API_TARGET, changeOrigin: true, secure: true },
      ]),
    ),
  },
});

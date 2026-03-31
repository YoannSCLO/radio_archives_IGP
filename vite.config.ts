import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { patientMappingDevProxyPlugin } from './vite-plugins/patientMappingDevProxy';
import { authDevProxyPlugin } from './vite-plugins/authDevProxy';

/** Sous-chemin public (DNS interne), ex. `/radio-archive/` — les appels API utilisent le même préfixe. */
function normalizeViteBase(fromEnv: string | undefined): string {
    if (!fromEnv?.trim()) return '/';
    let s = fromEnv.trim();
    if (!s.startsWith('/')) s = `/${s}`;
    if (!s.endsWith('/')) s = `${s}/`;
    return s;
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const passThrough = ['DATABASE_URL', 'ALLOW_PUBLIC_REGISTRATION', 'AUTH_ADMIN_SECRET'];
    for (const key of Object.keys(env)) {
      if (
        key.startsWith('PATIENT_MAPPING_') ||
        key.startsWith('AUTH_') ||
        passThrough.includes(key)
      ) {
        process.env[key] = env[key];
      }
    }
    return {
      base: normalizeViteBase(env.VITE_BASE_PATH),
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), authDevProxyPlugin(), patientMappingDevProxyPlugin()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});

import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { patientMappingDevProxyPlugin } from './vite-plugins/patientMappingDevProxy';
import { authDevProxyPlugin } from './vite-plugins/authDevProxy';
import { casesDevProxyPlugin } from './vite-plugins/casesDevProxy';

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
    /** Variables copiées vers `process.env` pour les plugins / outils Node (pas injectées dans le bundle client). */
    const passThrough = [
      'DATABASE_URL',
      'ALLOW_PUBLIC_REGISTRATION',
      'AUTH_ADMIN_SECRET',
      'GEMINI_API_KEY',
      'PUBLIC_APP_URL',
      'VERCEL_URL',
    ];
    for (const key of Object.keys(env)) {
      if (
        key.startsWith('PATIENT_MAPPING_') ||
        key.startsWith('AUTH_') ||
        key.startsWith('RESEND_') ||
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
      plugins: [react(), authDevProxyPlugin(), patientMappingDevProxyPlugin(), casesDevProxyPlugin()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});

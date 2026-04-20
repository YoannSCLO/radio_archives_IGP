/**
 * Préfixe les routes `/api/*` avec `import.meta.env.BASE_URL` (option Vite `base`),
 * pour un déploiement derrière un DNS interne avec sous-chemin (ex. `/radio-archive/`).
 */
export function apiUrl(path: string): string {
  const raw = import.meta.env.BASE_URL ?? "/";
  const base = raw.endsWith("/") ? raw : `${raw}/`;
  const p = path.startsWith("/") ? path.slice(1) : path;
  return `${base}${p}`;
}

/**
 * Lecture seule des variables d’environnement — aucune dépendance lourde (ex. `postgres`)
 * pour éviter les échecs de chargement de module sur Vercel (serverless).
 */

/** True si une base PostgreSQL est configurée (comptes persistants, inscription). */
export function hasDatabaseUrl(): boolean {
  return !!process.env.DATABASE_URL?.trim();
}

export function isMultiUserMode(): boolean {
  if (hasDatabaseUrl()) return true;
  const allow = process.env.ALLOW_PUBLIC_REGISTRATION?.trim().toLowerCase();
  return allow === "true" || allow === "1" || allow === "yes";
}

export function isAllowPublicRegistration(): boolean {
  const v = process.env.ALLOW_PUBLIC_REGISTRATION?.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

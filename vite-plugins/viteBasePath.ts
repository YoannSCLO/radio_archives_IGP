/**
 * Retire le préfixe Vite `base` du chemin HTTP (dev / preview), pour que les
 * middlewares continuent à matcher `/api/...` quand l’app est servie sous un sous-chemin.
 */
export function pathWithoutViteBase(urlPath: string, base: string): string {
  const pathname = urlPath.split("?")[0] ?? "";
  if (!base || base === "/") return pathname;
  const prefix = base.endsWith("/") ? base.slice(0, -1) : base;
  if (pathname === prefix) return "/";
  if (pathname.startsWith(`${prefix}/`)) {
    const rest = pathname.slice(prefix.length);
    return rest || "/";
  }
  return pathname;
}

import { getUserFromCookieHeader } from "./authCore.js";
import { getUserAuthFlags } from "./usersRepo.js";

export async function requireAdminSession(
  cookieHeader: string | undefined
): Promise<
  { ok: true; email: string } | { ok: false; status: number; body: Record<string, unknown> }
> {
  const u = getUserFromCookieHeader(cookieHeader);
  if (!u) {
    return { ok: false, status: 401, body: { error: "Unauthorized" } };
  }
  const flags = await getUserAuthFlags(u);
  if (!flags) {
    return { ok: false, status: 401, body: { error: "Unauthorized" } };
  }
  if (!flags.approved) {
    return { ok: false, status: 403, body: { error: "Forbidden" } };
  }
  if (!flags.is_admin) {
    return { ok: false, status: 403, body: { error: "Admin only" } };
  }
  return { ok: true, email: u.trim().toLowerCase() };
}

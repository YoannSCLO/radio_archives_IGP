import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { isMultiUserMode } from "./authEnv";
import { ensureUsersTable } from "./db";
import { findUserByEmail } from "./usersRepo";

export const SESSION_COOKIE_NAME = "ra_session";

function getStoredBcryptHash(): string | undefined {
  const b64 = process.env.AUTH_PASSWORD_BCRYPT_B64?.trim();
  if (b64) {
    try {
      return Buffer.from(b64, "base64").toString("utf8");
    } catch {
      return undefined;
    }
  }
  return normalizeBcryptHash(process.env.AUTH_PASSWORD_BCRYPT);
}

export function isAuthConfigured(): boolean {
  if (!process.env.AUTH_SESSION_SECRET?.trim()) return false;
  if (isMultiUserMode()) return true;
  return !!(process.env.AUTH_USERNAME?.trim() && getStoredBcryptHash());
}

export { isAllowPublicRegistration } from "./authEnv";

function getJwtSecret(): string {
  const s = process.env.AUTH_SESSION_SECRET?.trim();
  if (!s) throw new Error("AUTH_SESSION_SECRET manquant");
  return s;
}

export function signSessionToken(username: string): string {
  return jwt.sign({ sub: username }, getJwtSecret(), { expiresIn: "7d" });
}

export function verifySessionToken(token: string | undefined): string | null {
  if (!token) return null;
  try {
    const p = jwt.verify(token, getJwtSecret()) as { sub?: string };
    return typeof p.sub === "string" ? p.sub : null;
  } catch {
    return null;
  }
}

/** Extrait le nom d'utilisateur depuis l'en-tête Cookie brut. */
export function getUserFromCookieHeader(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  const m = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`)
  );
  if (!m?.[1]) return null;
  let raw = m[1];
  try {
    raw = decodeURIComponent(raw);
  } catch {
    /* ignore */
  }
  return verifySessionToken(raw);
}

/** Évite les échecs si le .env a des guillemets ou si dotenv-expand a modifié la chaîne. */
function normalizeBcryptHash(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let h = raw.trim();
  if ((h.startsWith('"') && h.endsWith('"')) || (h.startsWith("'") && h.endsWith("'"))) {
    h = h.slice(1, -1);
  }
  return h;
}

export async function verifyCredentials(
  username: string,
  password: string
): Promise<boolean> {
  if (isMultiUserMode()) {
    await ensureUsersTable();
    const email = username.trim().toLowerCase();
    const user = await findUserByEmail(email);
    if (!user) return false;
    return bcrypt.compare(password, user.password_hash);
  }
  const u = process.env.AUTH_USERNAME?.trim();
  const hash = getStoredBcryptHash();
  if (!u || !hash || !password) return false;
  if (username.trim() !== u) return false;
  return bcrypt.compare(password, hash);
}

export function buildSessionCookie(token: string, maxAgeSec: number): string {
  const isProd = process.env.NODE_ENV === "production";
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSec}`,
  ];
  if (isProd) parts.push("Secure");
  return parts.join("; ");
}

export function buildClearSessionCookie(): string {
  const isProd = process.env.NODE_ENV === "production";
  const parts = [`${SESSION_COOKIE_NAME}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (isProd) parts.push("Secure");
  return parts.join("; ");
}

/** Pour les handlers API : renvoie false si la réponse 401 a déjà été envoyée. */
export function assertAuthenticated(
  req: { headers: { cookie?: string } },
  res: { status: (n: number) => { json: (b: unknown) => void } }
): boolean {
  if (!isAuthConfigured()) return true;
  if (!getUserFromCookieHeader(req.headers.cookie)) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

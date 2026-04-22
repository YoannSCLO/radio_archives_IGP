import bcrypt from "bcryptjs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getSql, ensureUsersTable } from "./db.js";

type LocalUser = {
  email: string;
  password_hash: string;
  /** Absent dans les anciens fichiers = compte déjà validé. */
  approved?: boolean;
  is_admin?: boolean;
};

export type AppUserRecord = {
  email: string;
  password_hash: string;
  approved: boolean;
  is_admin: boolean;
};

function getLocalUsersPath(): string {
  return path.resolve(process.cwd(), ".local", "users.dev.json");
}

async function readLocalUsers(): Promise<LocalUser[]> {
  const p = getLocalUsersPath();
  try {
    const raw = await fs.readFile(p, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (u): u is LocalUser =>
        !!u &&
        typeof (u as { email?: unknown }).email === "string" &&
        typeof (u as { password_hash?: unknown }).password_hash === "string"
    );
  } catch {
    return [];
  }
}

async function writeLocalUsers(users: LocalUser[]): Promise<void> {
  const p = getLocalUsersPath();
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(users, null, 2), "utf8");
}

function normalizeLocalRecord(u: LocalUser): AppUserRecord {
  return {
    email: u.email,
    password_hash: u.password_hash,
    approved: u.approved !== false,
    is_admin: u.is_admin === true,
  };
}

/** Même logique que Postgres : fichier .local/users.dev.json (dev sans DATABASE_URL). */
async function promoteLocalFileAdminFromEnv(): Promise<void> {
  const em = process.env.AUTH_ADMIN_EMAIL?.trim().toLowerCase();
  if (!em) return;
  const users = await readLocalUsers();
  let changed = false;
  const next = users.map((u) => {
    if (u.email.toLowerCase() !== em) return u;
    if (u.is_admin === true && u.approved !== false) return u;
    changed = true;
    return { ...u, approved: true, is_admin: true };
  });
  if (changed) await writeLocalUsers(next);
}

export async function findUserByEmail(email: string): Promise<AppUserRecord | null> {
  await ensureUsersTable();
  const sql = getSql();
  if (!sql) {
    await promoteLocalFileAdminFromEnv();
    const users = await readLocalUsers();
    const em = email.trim().toLowerCase();
    const u = users.find((x) => x.email.toLowerCase() === em);
    return u ? normalizeLocalRecord(u) : null;
  }
  const rows = await sql`
    SELECT email, password_hash, approved, is_admin FROM app_users WHERE email = ${email}
  `;
  const row = rows[0] as
    | { email: string; password_hash: string; approved: boolean; is_admin: boolean }
    | undefined;
  return row ?? null;
}

export async function getUserAuthFlags(
  email: string
): Promise<{ approved: boolean; is_admin: boolean } | null> {
  const u = await findUserByEmail(email);
  if (!u) return null;
  return { approved: u.approved, is_admin: u.is_admin };
}

export async function createUser(
  email: string,
  passwordPlain: string,
  options?: { approved?: boolean; isAdmin?: boolean }
): Promise<{ ok: true } | { ok: false; reason: "duplicate" | "error" }> {
  await ensureUsersTable();
  const sql = getSql();
  const em = email.trim().toLowerCase();
  const hash = bcrypt.hashSync(passwordPlain, 12);
  const approved = options?.approved ?? true;
  const isAdmin = options?.isAdmin ?? false;
  if (!sql) {
    const users = await readLocalUsers();
    if (users.some((u) => u.email.toLowerCase() === em)) {
      return { ok: false, reason: "duplicate" };
    }
    users.push({
      email: em,
      password_hash: hash,
      approved,
      ...(isAdmin ? { is_admin: true } : {}),
    });
    await writeLocalUsers(users);
    return { ok: true };
  }
  try {
    await sql`
      INSERT INTO app_users (email, password_hash, approved, is_admin)
      VALUES (${em}, ${hash}, ${approved}, ${isAdmin})
    `;
    return { ok: true };
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === "23505") return { ok: false, reason: "duplicate" };
    throw e;
  }
}

export async function listPendingEmails(): Promise<string[]> {
  await ensureUsersTable();
  const sql = getSql();
  if (!sql) {
    const users = await readLocalUsers();
    return users
      .filter((u) => u.approved === false)
      .map((u) => u.email.toLowerCase())
      .sort();
  }
  const rows = await sql`
    SELECT email FROM app_users WHERE approved = false ORDER BY email ASC
  `;
  return (rows as { email: string }[]).map((r) => r.email.toLowerCase());
}

export async function approveUserByEmail(email: string): Promise<boolean> {
  await ensureUsersTable();
  const sql = getSql();
  const em = email.trim().toLowerCase();
  if (!sql) {
    const users = await readLocalUsers();
    let changed = false;
    const next = users.map((u) => {
      if (u.email.toLowerCase() !== em) return u;
      if (u.approved !== false) return u;
      changed = true;
      return { ...u, approved: true };
    });
    if (changed) await writeLocalUsers(next);
    return changed;
  }
  const rows = await sql`
    UPDATE app_users SET approved = true WHERE email = ${em} AND approved = false
    RETURNING email
  `;
  return (rows as { email: string }[]).length > 0;
}

export async function updateUserPassword(
  email: string,
  currentPlain: string,
  newPlain: string
): Promise<"ok" | "weak_password" | "not_found" | "wrong_password"> {
  if (newPlain.length < 8) return "weak_password";
  await ensureUsersTable();
  const sql = getSql();
  const em = email.trim().toLowerCase();
  const user = await findUserByEmail(em);
  if (!user) return "not_found";
  const match = await bcrypt.compare(currentPlain, user.password_hash);
  if (!match) return "wrong_password";
  const hash = bcrypt.hashSync(newPlain, 12);
  if (!sql) {
    const users = await readLocalUsers();
    const next = users.map((u) =>
      u.email.toLowerCase() === em ? { ...u, password_hash: hash } : u
    );
    await writeLocalUsers(next);
    return "ok";
  }
  await sql`UPDATE app_users SET password_hash = ${hash} WHERE email = ${em}`;
  return "ok";
}

/** Réinitialisation (sans connaissance du mot de passe actuel). Le contrôle d'identité est fait par le jeton. */
export async function setUserPassword(
  email: string,
  newPlain: string
): Promise<"ok" | "weak_password" | "not_found"> {
  if (newPlain.length < 8) return "weak_password";
  await ensureUsersTable();
  const sql = getSql();
  const em = email.trim().toLowerCase();
  const user = await findUserByEmail(em);
  if (!user) return "not_found";
  const hash = bcrypt.hashSync(newPlain, 12);
  if (!sql) {
    const users = await readLocalUsers();
    const next = users.map((u) =>
      u.email.toLowerCase() === em ? { ...u, password_hash: hash } : u
    );
    await writeLocalUsers(next);
    return "ok";
  }
  await sql`UPDATE app_users SET password_hash = ${hash} WHERE email = ${em}`;
  return "ok";
}

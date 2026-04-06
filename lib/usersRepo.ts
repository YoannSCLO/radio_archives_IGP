import bcrypt from "bcryptjs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getSql, ensureUsersTable } from "./db.js";

type LocalUser = { email: string; password_hash: string };

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

export async function findUserByEmail(
  email: string
): Promise<{ email: string; password_hash: string } | null> {
  await ensureUsersTable();
  const sql = getSql();
  if (!sql) {
    const users = await readLocalUsers();
    const em = email.trim().toLowerCase();
    const u = users.find((x) => x.email.toLowerCase() === em);
    return u ?? null;
  }
  const rows = await sql`
    SELECT email, password_hash FROM app_users WHERE email = ${email}
  `;
  const row = rows[0] as { email: string; password_hash: string } | undefined;
  return row ?? null;
}

export async function createUser(
  email: string,
  passwordPlain: string
): Promise<{ ok: true } | { ok: false; reason: "duplicate" | "error" }> {
  await ensureUsersTable();
  const sql = getSql();
  const em = email.trim().toLowerCase();
  const hash = bcrypt.hashSync(passwordPlain, 12);
  if (!sql) {
    const users = await readLocalUsers();
    if (users.some((u) => u.email.toLowerCase() === em)) {
      return { ok: false, reason: "duplicate" };
    }
    users.push({ email: em, password_hash: hash });
    await writeLocalUsers(users);
    return { ok: true };
  }
  try {
    await sql`
      INSERT INTO app_users (email, password_hash)
      VALUES (${em}, ${hash})
    `;
    return { ok: true };
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === "23505") return { ok: false, reason: "duplicate" };
    throw e;
  }
}

import postgres from "postgres";

let sql: ReturnType<typeof postgres> | null = null;
let schemaEnsured = false;

export function getSql(): ReturnType<typeof postgres> | null {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;
  if (!sql) {
    const local = url.includes("localhost") || url.includes("127.0.0.1");
    sql = postgres(url, {
      max: 1,
      ssl: local ? false : "require",
    });
  }
  return sql;
}

export function isMultiUserMode(): boolean {
  if (process.env.DATABASE_URL?.trim()) return true;
  const allow = process.env.ALLOW_PUBLIC_REGISTRATION?.trim().toLowerCase();
  return allow === "true" || allow === "1" || allow === "yes";
}

export async function ensureUsersTable(): Promise<void> {
  if (schemaEnsured) return;
  const s = getSql();
  if (!s) return;
  await s`
    CREATE TABLE IF NOT EXISTS app_users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  schemaEnsured = true;
}

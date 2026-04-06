import { createRequire } from "node:module";

export { isMultiUserMode } from "./authEnv.js";

const require = createRequire(import.meta.url);

// Chargement paresseux : évite d’importer `postgres` au chargement de chaque fonction API (crash Vercel).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sql: any = null;
let schemaEnsured = false;

export function getSql(): any {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;
  if (!sql) {
    const postgres = require("postgres");
    const local = url.includes("localhost") || url.includes("127.0.0.1");
    sql = postgres(url, {
      max: 1,
      ssl: local ? false : "require",
    });
  }
  return sql;
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

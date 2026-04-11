import { createRequire } from "node:module";

export { isMultiUserMode } from "./authEnv.js";

const require = createRequire(import.meta.url);

// Chargement paresseux : évite d’importer `postgres` au chargement de chaque fonction API (crash Vercel).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sql: any = null;
let usersTableEnsured = false;
let radioCasesTableEnsured = false;

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
  if (usersTableEnsured) return;
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
  usersTableEnsured = true;
}

/** Cas pédagogiques fictifs partagés (sync multi-appareils). */
export async function ensureRadioCasesTable(): Promise<void> {
  if (radioCasesTableEnsured) return;
  const s = getSql();
  if (!s) return;
  await s`
    CREATE TABLE IF NOT EXISTS radio_cases (
      id TEXT PRIMARY KEY,
      case_code TEXT NOT NULL UNIQUE,
      author_email TEXT,
      specialty TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      modality TEXT NOT NULL,
      clinical_note TEXT NOT NULL,
      diagnosis TEXT NOT NULL,
      series JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_edit_justification TEXT
    );
  `;
  await s`CREATE INDEX IF NOT EXISTS idx_radio_cases_created_at ON radio_cases (created_at DESC);`;
  radioCasesTableEnsured = true;
}

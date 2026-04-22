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

/** À chaque appel (idempotent) : si AUTH_ADMIN_EMAIL est défini, ce compte est admin et validé. */
async function applyAuthAdminEmailPromotion(s: NonNullable<ReturnType<typeof getSql>>): Promise<void> {
  const adminEmail = process.env.AUTH_ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail) return;
  await s`
    UPDATE app_users SET is_admin = true, approved = true
    WHERE lower(trim(email)) = ${adminEmail}
  `;
}

export async function ensureUsersTable(): Promise<void> {
  const s = getSql();
  if (!s) return;
  if (!usersTableEnsured) {
    await s`
      CREATE TABLE IF NOT EXISTS app_users (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;
    await s`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT true`;
    await s`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false`;
    usersTableEnsured = true;
  }
  await applyAuthAdminEmailPromotion(s);
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
  // Soft delete : purge planifiée séparément (corbeille 30 j côté UX).
  await s`ALTER TABLE radio_cases ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`;
  await s`CREATE INDEX IF NOT EXISTS idx_radio_cases_deleted_at ON radio_cases (deleted_at)`;
  radioCasesTableEnsured = true;
}

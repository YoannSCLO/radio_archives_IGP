import { randomUUID } from "node:crypto";
import type { RadioCase } from "../types.js";
import { ensureRadioCasesTable, getSql } from "./db.js";

const CASE_CODE_RE = /^CASE-(\d+)$/;

function rowToCase(r: {
  id: string;
  case_code: string;
  author_email: string | null;
  specialty: string;
  difficulty: string;
  modality: string;
  clinical_note: string;
  diagnosis: string;
  series: unknown;
  created_at: Date;
  updated_at: Date;
  last_edit_justification: string | null;
}): RadioCase {
  return {
    id: r.id,
    caseCode: r.case_code,
    specialty: r.specialty as RadioCase["specialty"],
    difficulty: r.difficulty as RadioCase["difficulty"],
    modality: r.modality as RadioCase["modality"],
    clinicalNote: r.clinical_note,
    diagnosis: r.diagnosis,
    dateAdded: r.created_at.toISOString(),
    series: Array.isArray(r.series) ? (r.series as RadioCase["series"]) : [],
    ...(r.author_email ? { authorEmail: r.author_email } : {}),
    lastModifiedAt: r.updated_at.toISOString(),
    ...(r.last_edit_justification ? { lastEditJustification: r.last_edit_justification } : {}),
  };
}

async function nextCaseCode(): Promise<string> {
  const sql = getSql();
  if (!sql) throw new Error("No database");
  const rows = await sql`SELECT case_code FROM radio_cases`;
  let max = 0;
  for (const row of rows as { case_code: string }[]) {
    const m = CASE_CODE_RE.exec(row.case_code);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `CASE-${String(max + 1).padStart(5, "0")}`;
}

export async function listRadioCases(): Promise<RadioCase[]> {
  await ensureRadioCasesTable();
  const sql = getSql();
  if (!sql) throw new Error("No database");
  const rows = await sql`
    SELECT id, case_code, author_email, specialty, difficulty, modality,
           clinical_note, diagnosis, series, created_at, updated_at, last_edit_justification
    FROM radio_cases
    WHERE deleted_at IS NULL
    ORDER BY created_at DESC
  `;
  return (rows as Parameters<typeof rowToCase>[0][]).map(rowToCase);
}

/** `includeDeleted` : utile pour restore (on doit retrouver la ligne marquée supprimée). */
export async function getRadioCaseById(
  id: string,
  options?: { includeDeleted?: boolean }
): Promise<RadioCase | null> {
  await ensureRadioCasesTable();
  const sql = getSql();
  if (!sql) throw new Error("No database");
  const includeDeleted = options?.includeDeleted === true;
  const rows = includeDeleted
    ? await sql`
        SELECT id, case_code, author_email, specialty, difficulty, modality,
               clinical_note, diagnosis, series, created_at, updated_at, last_edit_justification
        FROM radio_cases WHERE id = ${id}
      `
    : await sql`
        SELECT id, case_code, author_email, specialty, difficulty, modality,
               clinical_note, diagnosis, series, created_at, updated_at, last_edit_justification
        FROM radio_cases WHERE id = ${id} AND deleted_at IS NULL
      `;
  const r = (rows as Parameters<typeof rowToCase>[0][])[0];
  return r ? rowToCase(r) : null;
}

export async function insertRadioCase(
  payload: Omit<RadioCase, "id" | "dateAdded" | "caseCode" | "lastModifiedAt"> & { id?: string },
  authorEmail: string | null
): Promise<RadioCase> {
  await ensureRadioCasesTable();
  const sql = getSql();
  if (!sql) throw new Error("No database");
  const id = payload.id?.trim() || randomUUID();
  const caseCode = await nextCaseCode();
  const seriesJson = sql.json(payload.series as unknown);
  try {
    await sql`
      INSERT INTO radio_cases (
        id, case_code, author_email, specialty, difficulty, modality,
        clinical_note, diagnosis, series, last_edit_justification
      ) VALUES (
        ${id},
        ${caseCode},
        ${authorEmail},
        ${payload.specialty},
        ${payload.difficulty},
        ${payload.modality},
        ${payload.clinicalNote},
        ${payload.diagnosis},
        ${seriesJson},
        ${payload.lastEditJustification ?? null}
      )
    `;
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === "23505") throw Object.assign(new Error("duplicate"), { code: "23505" });
    throw e;
  }
  const created = await getRadioCaseById(id);
  if (!created) throw new Error("Insert failed");
  return created;
}

export async function updateRadioCase(
  id: string,
  updates: Partial<RadioCase>,
  lastEditJustification: string | null
): Promise<RadioCase | null> {
  await ensureRadioCasesTable();
  const sql = getSql();
  if (!sql) throw new Error("No database");
  const existing = await getRadioCaseById(id);
  if (!existing) return null;

  const merged: RadioCase = {
    ...existing,
    ...updates,
    id: existing.id,
    caseCode: existing.caseCode,
    dateAdded: existing.dateAdded,
    authorEmail: existing.authorEmail,
  };

  const seriesJson = sql.json(merged.series as unknown);
  await sql`
    UPDATE radio_cases SET
      specialty = ${merged.specialty},
      difficulty = ${merged.difficulty},
      modality = ${merged.modality},
      clinical_note = ${merged.clinicalNote},
      diagnosis = ${merged.diagnosis},
      series = ${seriesJson},
      updated_at = NOW(),
      last_edit_justification = ${lastEditJustification}
    WHERE id = ${id}
  `;
  return getRadioCaseById(id);
}

/** Suppression logique : marque `deleted_at = NOW()` pour permettre l'annulation. */
export async function deleteRadioCase(id: string): Promise<boolean> {
  await ensureRadioCasesTable();
  const sql = getSql();
  if (!sql) throw new Error("No database");
  const rows = await sql`
    UPDATE radio_cases SET deleted_at = NOW()
    WHERE id = ${id} AND deleted_at IS NULL
    RETURNING id
  `;
  return (rows as { id: string }[]).length > 0;
}

/** Annule une suppression logique récente. */
export async function restoreRadioCase(id: string): Promise<RadioCase | null> {
  await ensureRadioCasesTable();
  const sql = getSql();
  if (!sql) throw new Error("No database");
  const rows = await sql`
    UPDATE radio_cases SET deleted_at = NULL
    WHERE id = ${id} AND deleted_at IS NOT NULL
    RETURNING id
  `;
  if ((rows as { id: string }[]).length === 0) return null;
  return getRadioCaseById(id);
}

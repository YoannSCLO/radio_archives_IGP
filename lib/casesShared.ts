import type { RadioCase } from "../types.js";
import { Difficulty, Modality, Specialty } from "../types.js";
import { isAuthConfigured } from "./authCore.js";

const SPECIALTIES = new Set(Object.values(Specialty));
const DIFFICULTIES = new Set(Object.values(Difficulty));
const MODALITIES = new Set(Object.values(Modality));

export function isAuthRequiredForCases(): boolean {
  return isAuthConfigured();
}

export function canUserModifyCase(
  sessionUser: string | null,
  authRequired: boolean,
  authorEmail: string | undefined | null
): boolean {
  if (!authRequired) return true;
  if (!sessionUser) return false;
  if (!authorEmail?.trim()) return false;
  return authorEmail.trim().toLowerCase() === sessionUser.trim().toLowerCase();
}

function isSeries(v: unknown): v is RadioCase["series"] {
  if (!Array.isArray(v)) return false;
  return v.every(
    (s) =>
      s &&
      typeof s === "object" &&
      typeof (s as { name?: unknown }).name === "string" &&
      Array.isArray((s as { images?: unknown }).images)
  );
}

export function parseCreateBody(
  raw: unknown
): { ok: true; id?: string; case: Omit<RadioCase, "id" | "dateAdded" | "caseCode" | "lastModifiedAt"> } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Invalid JSON" };
  const o = raw as Record<string, unknown>;
  if (typeof o.specialty !== "string" || !SPECIALTIES.has(o.specialty as Specialty)) {
    return { ok: false, error: "Invalid specialty" };
  }
  if (typeof o.difficulty !== "string" || !DIFFICULTIES.has(o.difficulty as Difficulty)) {
    return { ok: false, error: "Invalid difficulty" };
  }
  if (typeof o.modality !== "string" || !MODALITIES.has(o.modality as Modality)) {
    return { ok: false, error: "Invalid modality" };
  }
  if (typeof o.clinicalNote !== "string" || !o.clinicalNote.trim()) return { ok: false, error: "Invalid clinicalNote" };
  if (typeof o.diagnosis !== "string" || !o.diagnosis.trim()) return { ok: false, error: "Invalid diagnosis" };
  const series = o.series;
  if (!isSeries(series)) return { ok: false, error: "Invalid series" };
  const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : undefined;
  return {
    ok: true,
    id,
    case: {
      specialty: o.specialty as RadioCase["specialty"],
      difficulty: o.difficulty as RadioCase["difficulty"],
      modality: o.modality as RadioCase["modality"],
      clinicalNote: o.clinicalNote,
      diagnosis: o.diagnosis,
      series,
      ...(typeof o.authorEmail === "string" ? { authorEmail: o.authorEmail } : {}),
      ...(typeof o.lastEditJustification === "string" ? { lastEditJustification: o.lastEditJustification } : {}),
    },
  };
}

export function parsePatchBody(
  raw: unknown
): { ok: true; id: string; updates: Partial<RadioCase>; justification?: string } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Invalid JSON" };
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || !o.id.trim()) return { ok: false, error: "Missing id" };
  const updates: Partial<RadioCase> = {};
  if (o.specialty !== undefined) {
    if (typeof o.specialty !== "string" || !SPECIALTIES.has(o.specialty as Specialty)) {
      return { ok: false, error: "Invalid specialty" };
    }
    updates.specialty = o.specialty as RadioCase["specialty"];
  }
  if (o.difficulty !== undefined) {
    if (typeof o.difficulty !== "string" || !DIFFICULTIES.has(o.difficulty as Difficulty)) {
      return { ok: false, error: "Invalid difficulty" };
    }
    updates.difficulty = o.difficulty as RadioCase["difficulty"];
  }
  if (o.modality !== undefined) {
    if (typeof o.modality !== "string" || !MODALITIES.has(o.modality as Modality)) {
      return { ok: false, error: "Invalid modality" };
    }
    updates.modality = o.modality as RadioCase["modality"];
  }
  if (o.clinicalNote !== undefined) {
    if (typeof o.clinicalNote !== "string") return { ok: false, error: "Invalid clinicalNote" };
    updates.clinicalNote = o.clinicalNote;
  }
  if (o.diagnosis !== undefined) {
    if (typeof o.diagnosis !== "string") return { ok: false, error: "Invalid diagnosis" };
    updates.diagnosis = o.diagnosis;
  }
  if (o.series !== undefined) {
    if (!isSeries(o.series)) return { ok: false, error: "Invalid series" };
    updates.series = o.series;
  }
  const justification =
    typeof o.lastEditJustification === "string" && o.lastEditJustification.trim()
      ? o.lastEditJustification.trim()
      : undefined;
  if (Object.keys(updates).length === 0) {
    return { ok: false, error: "Aucun champ à modifier" };
  }
  return { ok: true, id: o.id.trim(), updates, justification };
}

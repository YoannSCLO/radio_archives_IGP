/**
 * Normalise et borne les entrées utilisateur avant envoi à Gemini :
 * - strip des caractères de contrôle et zero-width (pollution / injection)
 * - collapse des espaces / sauts de ligne excessifs
 * - clamp dur sur la taille (maîtrise du coût et des fenêtres de contexte)
 *
 * La structure de la réponse est déjà contrainte par `responseSchema`, mais
 * le contenu peut être détourné par un prompt dans la note clinique. On
 * balise donc explicitement les entrées utilisateur via `fencedBlock`.
 */

export const GEMINI_LIMITS = {
  MAX_CLINICAL_NOTE_LENGTH: 4000,
  MAX_QUERY_LENGTH: 300,
  MAX_CASES_SUMMARY: 200,
  MAX_SUMMARY_FIELD_LENGTH: 500,
} as const;

/** Contrôles C0 (hors \t, \n, \r) + DEL. Écrit via RegExp pour éviter des littéraux non imprimables dans la source. */
const CONTROL_CHARS_RE = new RegExp("[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]", "g");
/** Zero-width, directional marks, word-joiner, BOM. */
const INVISIBLE_RE = new RegExp(
  "[\\u200B-\\u200F\\u2028-\\u202F\\u2060-\\u206F\\uFEFF]",
  "gu"
);

function stripControlChars(input: string): string {
  return input.replace(CONTROL_CHARS_RE, " ").replace(INVISIBLE_RE, " ");
}

export function sanitizeText(input: string, maxLen: number): string {
  let s = stripControlChars(input);
  s = s.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

export function sanitizeClinicalNote(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const clean = sanitizeText(raw, GEMINI_LIMITS.MAX_CLINICAL_NOTE_LENGTH);
  return clean.length >= 3 ? clean : null;
}

export function sanitizeSearchQuery(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const clean = sanitizeText(raw, GEMINI_LIMITS.MAX_QUERY_LENGTH);
  return clean.length >= 1 ? clean : null;
}

export interface SafeCaseSummary {
  id: string;
  summary: string;
}

export function sanitizeCasesSummary(raw: unknown): SafeCaseSummary[] | null {
  if (!Array.isArray(raw)) return null;
  const out: SafeCaseSummary[] = [];
  for (const item of raw.slice(0, GEMINI_LIMITS.MAX_CASES_SUMMARY)) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const id = rec.id;
    if (typeof id !== "string" || !id.trim()) continue;
    const parts = (["caseCode", "diagnosis", "note"] as const)
      .map((k) => rec[k])
      .filter((v): v is string => typeof v === "string")
      .map((v) => sanitizeText(v, GEMINI_LIMITS.MAX_SUMMARY_FIELD_LENGTH))
      .filter((v) => v.length > 0);
    out.push({ id: id.trim(), summary: parts.join(" | ") });
  }
  return out;
}

/** Délimiteurs explicites autour des données utilisateur : « data, not instructions ». */
export function fencedBlock(label: string, content: string): string {
  return `<<<${label}_BEGIN>>>\n${content}\n<<<${label}_END>>>`;
}

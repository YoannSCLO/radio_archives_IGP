import type { RadioCase } from "../types";
import { apiUrl } from "./apiBase";

/** null = pas de sync serveur (503 ou erreur) ; sinon liste (éventuellement vide). */
export async function fetchCasesFromServer(): Promise<RadioCase[] | null> {
  try {
    const r = await fetch(apiUrl("api/cases"), { credentials: "include" });
    if (r.status === 503) return null;
    if (r.status === 401) return null;
    if (!r.ok) return null;
    const j = (await r.json()) as { cases?: RadioCase[] };
    return Array.isArray(j.cases) ? j.cases : null;
  } catch {
    return null;
  }
}

export async function createCaseOnServer(
  data: Omit<RadioCase, "id" | "dateAdded" | "caseCode" | "lastModifiedAt" | "authorEmail" | "lastEditJustification">
): Promise<RadioCase | null> {
  const r = await fetch(apiUrl("api/cases"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      specialty: data.specialty,
      difficulty: data.difficulty,
      modality: data.modality,
      clinicalNote: data.clinicalNote,
      diagnosis: data.diagnosis,
      series: data.series,
    }),
  });
  if (!r.ok) return null;
  const j = (await r.json()) as { case?: RadioCase };
  return j.case ?? null;
}

export async function updateCaseOnServer(
  id: string,
  data: Omit<RadioCase, "id" | "dateAdded" | "caseCode" | "lastModifiedAt">,
  lastEditJustification: string
): Promise<RadioCase | null> {
  const r = await fetch(apiUrl("api/cases"), {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id,
      specialty: data.specialty,
      difficulty: data.difficulty,
      modality: data.modality,
      clinicalNote: data.clinicalNote,
      diagnosis: data.diagnosis,
      series: data.series,
      lastEditJustification,
    }),
  });
  if (!r.ok) return null;
  const j = (await r.json()) as { case?: RadioCase };
  return j.case ?? null;
}

export async function deleteCaseOnServer(id: string): Promise<boolean> {
  const r = await fetch(apiUrl(`api/cases?id=${encodeURIComponent(id)}`), {
    method: "DELETE",
    credentials: "include",
  });
  return r.ok;
}

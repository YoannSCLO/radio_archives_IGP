import { apiUrl } from "./apiBase";

/**
 * Correspondance CASE-xxx ↔ IPP : appels same-origin vers le proxy (voir `apiUrl`).
 * Secrets upstream et jeton d’accès au proxy ne sont pas dans le bundle (upstream = serveur ;
 * jeton entrée = sessionStorage, saisi par l’utilisateur dans Réglages).
 */

export interface PatientMappingPayload {
  caseCode: string;
  caseId: string;
  ipp: string;
  lastName?: string;
  firstName?: string;
}

export type PatientMappingResult =
  | { ok: true }
  | { ok: false; reason: "not_configured" | "network" | "http" | "unauthorized" };

export interface PatientMappingProxyStatus {
  configured: boolean;
  inboundAuthRequired: boolean;
  /** true si le relais vers l’HDS utilise un certificat client (mTLS) */
  mtlsUpstream: boolean;
}

function proxyPath(): string {
  return apiUrl("api/patient-mapping");
}

/** Clé sessionStorage pour le jeton d’accès au proxy (identique à PATIENT_MAPPING_INBOUND_SECRET côté serveur). */
export const PATIENT_MAPPING_INBOUND_TOKEN_KEY = "patient_mapping_inbound_token";

export function getStoredInboundToken(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  return sessionStorage.getItem(PATIENT_MAPPING_INBOUND_TOKEN_KEY);
}

export function setStoredInboundToken(token: string | null): void {
  if (typeof sessionStorage === "undefined") return;
  if (token?.trim()) {
    sessionStorage.setItem(PATIENT_MAPPING_INBOUND_TOKEN_KEY, token.trim());
  } else {
    sessionStorage.removeItem(PATIENT_MAPPING_INBOUND_TOKEN_KEY);
  }
}

function inboundHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const t = getStoredInboundToken();
  if (t) {
    headers["Authorization"] = `Bearer ${t}`;
  }
  return headers;
}

export async function fetchPatientMappingProxyStatus(): Promise<PatientMappingProxyStatus> {
  try {
    const res = await fetch(proxyPath(), { method: "GET", credentials: "include" });
    if (!res.ok) {
      return { configured: false, inboundAuthRequired: false, mtlsUpstream: false };
    }
    const j = (await res.json()) as {
      configured?: boolean;
      inboundAuthRequired?: boolean;
      mtlsUpstream?: boolean;
    };
    return {
      configured: j.configured === true,
      inboundAuthRequired: j.inboundAuthRequired === true,
      mtlsUpstream: j.mtlsUpstream === true,
    };
  } catch {
    return { configured: false, inboundAuthRequired: false, mtlsUpstream: false };
  }
}

export async function postPatientMapping(
  payload: PatientMappingPayload
): Promise<PatientMappingResult> {
  try {
    const res = await fetch(proxyPath(), {
      method: "POST",
      credentials: "include",
      headers: inboundHeaders(),
      body: JSON.stringify(payload),
    });
    if (res.status === 401) {
      return { ok: false, reason: "unauthorized" };
    }
    if (res.status === 503) {
      return { ok: false, reason: "not_configured" };
    }
    if (!res.ok) {
      return { ok: false, reason: "http" };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "network" };
  }
}

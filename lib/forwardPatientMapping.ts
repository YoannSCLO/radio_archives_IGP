/**
 * Logique partagée : exécutée uniquement côté serveur (Vercel ou middleware Vite dev).
 * Passe l’upstream vers votre SI santé. Aucune donnée patient dans les logs.
 */

import * as https from "node:https";
import { URL } from "node:url";

export function getPatientMappingProxyConfigured(): boolean {
  return !!process.env.PATIENT_MAPPING_UPSTREAM_URL?.trim();
}

export function validatePatientMappingBody(body: unknown): body is {
  caseCode: string;
  caseId: string;
  ipp: string;
  lastName?: string;
  firstName?: string;
} {
  if (!body || typeof body !== "object") return false;
  const o = body as Record<string, unknown>;
  if (typeof o.caseCode !== "string" || typeof o.caseId !== "string" || typeof o.ipp !== "string") {
    return false;
  }
  if (!o.caseCode.trim() || !o.ipp.trim()) return false;
  if (o.lastName !== undefined && typeof o.lastName !== "string") return false;
  if (o.firstName !== undefined && typeof o.firstName !== "string") return false;
  return true;
}

export type ForwardResult =
  | { ok: true; status: number }
  | { ok: false; status: number; reason: "not_configured" | "upstream" | "network" };

/** PEM ou chaîne base64 d’un PEM */
function decodePem(envVal: string | undefined): string | undefined {
  if (!envVal?.trim()) return undefined;
  const t = envVal.trim();
  if (t.includes("BEGIN")) return t;
  try {
    return Buffer.from(t, "base64").toString("utf8");
  } catch {
    return undefined;
  }
}

export function isMtlsUpstreamConfigured(): boolean {
  const on =
    process.env.PATIENT_MAPPING_UPSTREAM_MTLS === "1" ||
    process.env.PATIENT_MAPPING_UPSTREAM_MTLS === "true";
  if (!on) return false;
  const cert = decodePem(process.env.PATIENT_MAPPING_UPSTREAM_CLIENT_CERT);
  const key = decodePem(process.env.PATIENT_MAPPING_UPSTREAM_CLIENT_KEY);
  return !!cert && !!key;
}

function buildUpstreamHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const key = process.env.PATIENT_MAPPING_UPSTREAM_KEY;
  if (key?.trim()) {
    headers["Authorization"] = `Bearer ${key.trim()}`;
  }
  return headers;
}

function buildPayload(body: {
  caseCode: string;
  caseId: string;
  ipp: string;
  lastName?: string;
  firstName?: string;
}) {
  return {
    caseCode: body.caseCode.trim(),
    caseId: body.caseId,
    ipp: body.ipp.trim(),
    ...(body.lastName?.trim() ? { lastName: body.lastName.trim() } : {}),
    ...(body.firstName?.trim() ? { firstName: body.firstName.trim() } : {}),
  };
}

async function forwardWithMtls(
  targetUrl: string,
  payload: Record<string, string | undefined>,
  upstreamHeaders: Record<string, string>
): Promise<ForwardResult> {
  const cert = decodePem(process.env.PATIENT_MAPPING_UPSTREAM_CLIENT_CERT);
  const key = decodePem(process.env.PATIENT_MAPPING_UPSTREAM_CLIENT_KEY);
  const ca = decodePem(process.env.PATIENT_MAPPING_UPSTREAM_CA);
  if (!cert || !key) {
    return { ok: false, status: 503, reason: "not_configured" };
  }

  const bodyStr = JSON.stringify(payload);
  let u: URL;
  try {
    u = new URL(targetUrl);
  } catch {
    return { ok: false, status: 502, reason: "network" };
  }

  if (u.protocol !== "https:") {
    return { ok: false, status: 502, reason: "network" };
  }

  const requestHeaders: Record<string, string | number | string[]> = {
    ...upstreamHeaders,
    "Content-Length": Buffer.byteLength(bodyStr, "utf8"),
  };

  return new Promise((resolve) => {
    const opts: https.RequestOptions = {
      hostname: u.hostname,
      port: u.port || 443,
      path: `${u.pathname}${u.search}`,
      method: "POST",
      headers: requestHeaders,
      cert,
      key,
      ...(ca ? { ca } : {}),
    };

    const req = https.request(opts, (res) => {
      res.resume();
      const status = res.statusCode ?? 502;
      if (status >= 200 && status < 300) {
        resolve({ ok: true, status });
      } else {
        resolve({ ok: false, status, reason: "upstream" });
      }
    });

    req.on("error", () => {
      resolve({ ok: false, status: 502, reason: "network" });
    });

    req.write(bodyStr, "utf8");
    req.end();
  });
}

export async function forwardPatientMapping(body: {
  caseCode: string;
  caseId: string;
  ipp: string;
  lastName?: string;
  firstName?: string;
}): Promise<ForwardResult> {
  const url = process.env.PATIENT_MAPPING_UPSTREAM_URL;
  if (!url?.trim()) {
    return { ok: false, status: 503, reason: "not_configured" };
  }

  const payload = buildPayload(body);
  const upstreamHeaders = buildUpstreamHeaders();

  if (isMtlsUpstreamConfigured()) {
    return forwardWithMtls(url.trim(), payload, upstreamHeaders);
  }

  try {
    const res = await fetch(url.trim(), {
      method: "POST",
      headers: upstreamHeaders,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      return { ok: false, status: res.status, reason: "upstream" };
    }
    return { ok: true, status: res.status };
  } catch {
    return { ok: false, status: 502, reason: "network" };
  }
}

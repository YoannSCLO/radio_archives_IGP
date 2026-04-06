import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  forwardPatientMapping,
  getPatientMappingProxyConfigured,
  isMtlsUpstreamConfigured,
  validatePatientMappingBody,
} from "../lib/forwardPatientMapping";
import { checkInboundAuth, isInboundAuthConfigured } from "../lib/patientMappingAuth";
import { assertAuthenticated } from "../lib/authCore";

function parseBody(req: VercelRequest): unknown {
  const raw = req.body;
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (typeof raw === "object") return raw;
  return null;
}

function getHeader(req: VercelRequest, name: string): string | undefined {
  const n = name.toLowerCase();
  const h = req.headers[n];
  if (typeof h === "string") return h;
  if (Array.isArray(h)) return h[0];
  return undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!assertAuthenticated(req, res)) {
    return;
  }

  if (req.method === "GET") {
    return res.status(200).json({
      configured: getPatientMappingProxyConfigured(),
      inboundAuthRequired: isInboundAuthConfigured(),
      mtlsUpstream: isMtlsUpstreamConfigured(),
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authz = getHeader(req, "authorization");
  const xToken = getHeader(req, "x-patient-mapping-token");
  if (!checkInboundAuth(authz, xToken)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const body = parseBody(req);
  if (!validatePatientMappingBody(body)) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  if (!getPatientMappingProxyConfigured()) {
    return res.status(503).json({ error: "Patient mapping proxy not configured" });
  }

  const result = await forwardPatientMapping(body);
  if (!result.ok) {
    const status = result.status >= 400 && result.status < 600 ? result.status : 502;
    return res.status(status).json({ error: "Upstream error", reason: result.reason });
  }

  return res.status(200).json({ ok: true });
}

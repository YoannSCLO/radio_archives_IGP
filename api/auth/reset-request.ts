import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requestPasswordReset } from "../../lib/passwordResetActions.js";
import { consumeRate, rateLimitKey } from "../../lib/rateLimit.js";

/** 3 demandes / 10 min par email ou IP : pas d'énumération bruteforce. */
const RESET_RATE_LIMIT = { capacity: 3, refillPerSec: 1 / 200 };

function parseBody(req: VercelRequest): { email?: string } {
  const raw = req.body;
  if (raw == null) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as { email?: string };
    } catch {
      return {};
    }
  }
  if (typeof raw === "object") return raw as { email?: string };
  return {};
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const { email } = parseBody(req);
  const key = typeof email === "string" && email.trim()
    ? `reset:${email.trim().toLowerCase()}`
    : `reset:${rateLimitKey(null, req.headers)}`;
  const rl = consumeRate(key, RESET_RATE_LIMIT);
  if (!rl.ok) {
    res.setHeader("Retry-After", String(rl.retryAfterSec));
    // Toujours 200 pour éviter l'énumération — mais on ne déclenche rien non plus.
    return res.status(200).json({ ok: true });
  }
  const result = await requestPasswordReset(email);
  if (!result.ok) {
    return res.status(result.status).json(result.body);
  }
  return res.status(200).json({ ok: true });
}

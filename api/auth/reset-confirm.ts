import type { VercelRequest, VercelResponse } from "@vercel/node";
import { confirmPasswordReset } from "../../lib/passwordResetActions.js";
import { consumeRate, rateLimitKey } from "../../lib/rateLimit.js";

/** 10 tentatives / 10 min par IP : barrière contre le bruteforce de jeton. */
const CONFIRM_RATE_LIMIT = { capacity: 10, refillPerSec: 1 / 60 };

function parseBody(req: VercelRequest): { token?: string; newPassword?: string } {
  const raw = req.body;
  if (raw == null) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as { token?: string; newPassword?: string };
    } catch {
      return {};
    }
  }
  if (typeof raw === "object") return raw as { token?: string; newPassword?: string };
  return {};
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const rl = consumeRate(
    `reset-confirm:${rateLimitKey(null, req.headers)}`,
    CONFIRM_RATE_LIMIT
  );
  if (!rl.ok) {
    res.setHeader("Retry-After", String(rl.retryAfterSec));
    return res
      .status(429)
      .json({ error: "Trop de tentatives, réessayez plus tard.", retryAfterSec: rl.retryAfterSec });
  }
  const { token, newPassword } = parseBody(req);
  const result = await confirmPasswordReset(token, newPassword);
  if (!result.ok) {
    return res.status(result.status).json(result.body);
  }
  return res.status(200).json({ ok: true });
}

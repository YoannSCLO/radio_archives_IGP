import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  confirmPasswordReset,
  requestPasswordReset,
} from "../../lib/passwordResetActions.js";
import { consumeRate, rateLimitKey } from "../../lib/rateLimit.js";

/** 3 demandes / 10 min par email ou IP : pas d'énumération bruteforce. */
const REQUEST_RATE_LIMIT = { capacity: 3, refillPerSec: 1 / 200 };
/** 10 tentatives / 10 min par IP : barrière contre le bruteforce de jeton. */
const CONFIRM_RATE_LIMIT = { capacity: 10, refillPerSec: 1 / 60 };

interface Body {
  action?: string;
  email?: string;
  token?: string;
  newPassword?: string;
}

function parseBody(req: VercelRequest): Body {
  const raw = req.body;
  if (raw == null) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Body;
    } catch {
      return {};
    }
  }
  if (typeof raw === "object") return raw as Body;
  return {};
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const body = parseBody(req);
  const action = typeof body.action === "string" ? body.action : "";

  if (action === "request") {
    const key =
      typeof body.email === "string" && body.email.trim()
        ? `reset:${body.email.trim().toLowerCase()}`
        : `reset:${rateLimitKey(null, req.headers)}`;
    const rl = consumeRate(key, REQUEST_RATE_LIMIT);
    if (!rl.ok) {
      res.setHeader("Retry-After", String(rl.retryAfterSec));
      // Toujours 200 pour éviter l'énumération — mais on ne déclenche rien non plus.
      return res.status(200).json({ ok: true });
    }
    const result = await requestPasswordReset(body.email);
    if (!result.ok) {
      return res.status(result.status).json(result.body);
    }
    return res.status(200).json({ ok: true });
  }

  if (action === "confirm") {
    const rl = consumeRate(
      `reset-confirm:${rateLimitKey(null, req.headers)}`,
      CONFIRM_RATE_LIMIT
    );
    if (!rl.ok) {
      res.setHeader("Retry-After", String(rl.retryAfterSec));
      return res.status(429).json({
        error: "Trop de tentatives, réessayez plus tard.",
        retryAfterSec: rl.retryAfterSec,
      });
    }
    const result = await confirmPasswordReset(body.token, body.newPassword);
    if (!result.ok) {
      return res.status(result.status).json(result.body);
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: "Action inconnue." });
}

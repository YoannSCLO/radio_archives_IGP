import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authRegisterResult } from "../../lib/authActions.js";

function parseBody(req: VercelRequest): { email?: string; password?: string } {
  const raw = req.body;
  if (raw == null) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as { email?: string; password?: string };
    } catch {
      return {};
    }
  }
  if (typeof raw === "object") return raw as { email?: string; password?: string };
  return {};
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, password } = parseBody(req);
  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Invalid body" });
  }

  const result = await authRegisterResult(email, password);
  if (!result.ok) {
    return res.status(result.status).json(result.body);
  }
  return res.status(201).json({ ok: true, pendingApproval: true });
}

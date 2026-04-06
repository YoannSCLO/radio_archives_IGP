import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authAdminCreateUserResult } from "../../lib/authActions";

function getHeader(req: VercelRequest, name: string): string | undefined {
  const n = name.toLowerCase();
  const h = req.headers[n];
  if (typeof h === "string") return h;
  if (Array.isArray(h)) return h[0];
  return undefined;
}

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

/** Création d’un compte par un admin SI (secret serveur), sans inscription publique. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = getHeader(req, "x-admin-secret");
  const { email, password } = parseBody(req);
  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Invalid body" });
  }

  const result = await authAdminCreateUserResult(email, password, secret);
  if (!result.ok) {
    return res.status(result.status).json(result.body);
  }
  return res.status(201).json({ ok: true });
}

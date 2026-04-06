import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authLoginResult } from "../lib/authActions";

function parseBody(req: VercelRequest): { username?: string; password?: string } {
  const raw = req.body;
  if (raw == null) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as { username?: string; password?: string };
    } catch {
      return {};
    }
  }
  if (typeof raw === "object") return raw as { username?: string; password?: string };
  return {};
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { username, password } = parseBody(req);
  if (typeof username !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Invalid body" });
  }

  const result = await authLoginResult(username, password);
  if (!result.ok) {
    return res.status(result.status).json(result.body);
  }
  res.setHeader("Set-Cookie", result.setCookie);
  return res.status(200).json({ ok: true });
}

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authChangePasswordResult } from "../../lib/authActions.js";

function parseBody(req: VercelRequest): { currentPassword?: string; newPassword?: string } {
  const raw = req.body;
  if (raw == null) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as { currentPassword?: string; newPassword?: string };
    } catch {
      return {};
    }
  }
  if (typeof raw === "object") return raw as { currentPassword?: string; newPassword?: string };
  return {};
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const { currentPassword, newPassword } = parseBody(req);
  if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
    return res.status(400).json({ error: "Invalid body" });
  }
  const result = await authChangePasswordResult(
    req.headers.cookie,
    currentPassword,
    newPassword
  );
  if (!result.ok) {
    return res.status(result.status).json(result.body);
  }
  return res.status(200).json({ ok: true });
}

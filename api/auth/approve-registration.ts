import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAdminSession } from "../../lib/authAdminSession.js";
import { approveUserByEmail } from "../../lib/usersRepo.js";

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
  const gate = await requireAdminSession(req.headers.cookie);
  if (!gate.ok) {
    return res.status(gate.status).json(gate.body);
  }
  const { email } = parseBody(req);
  if (typeof email !== "string" || !email.trim()) {
    return res.status(400).json({ error: "Invalid body" });
  }
  const ok = await approveUserByEmail(email.trim());
  if (!ok) {
    return res.status(404).json({ error: "Aucune demande en attente pour cet e-mail" });
  }
  return res.status(200).json({ ok: true });
}

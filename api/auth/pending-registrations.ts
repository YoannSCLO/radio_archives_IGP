import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAdminSession } from "../../lib/authAdminSession.js";
import { listPendingEmails } from "../../lib/usersRepo.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const gate = await requireAdminSession(req.headers.cookie);
  if (!gate.ok) {
    return res.status(gate.status).json(gate.body);
  }
  const emails = await listPendingEmails();
  return res.status(200).json({ emails });
}

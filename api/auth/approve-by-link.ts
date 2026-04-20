import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleApproveByLinkGet } from "../../lib/approveByLinkHttp.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).send("Method not allowed");
  }
  const url = new URL(req.url || "/", "http://localhost");
  const result = await handleApproveByLinkGet(url.searchParams);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.status(result.status).send(result.html);
}

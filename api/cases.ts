import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleCasesApi } from "../lib/casesHttp.js";

function readBody(req: VercelRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  let body: unknown = null;
  if (req.method === "POST" || req.method === "PATCH") {
    const raw = await readBody(req);
    if (raw) {
      try {
        body = JSON.parse(raw) as unknown;
      } catch {
        return res.status(400).json({ error: "Invalid JSON" });
      }
    }
  }

  const url = new URL(req.url || "/", "http://localhost");
  const result = await handleCasesApi({
    method: req.method || "GET",
    searchParams: url.searchParams,
    body,
    cookieHeader: req.headers.cookie,
  });

  if (result.status === 204) {
    res.status(204).end();
    return;
  }
  return res.status(result.status).json(result.body);
}

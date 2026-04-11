import type { IncomingMessage, ServerResponse } from "node:http";
import type { Connect, Plugin } from "vite";
import { handleCasesApi } from "../lib/casesHttp.js";
import { pathWithoutViteBase } from "./viteBasePath";

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function installCasesMiddleware(middlewares: Connect.Server, viteBase: string) {
  middlewares.use(async (req, res, next) => {
    const path = pathWithoutViteBase(req.url?.split("?")[0] ?? "", viteBase);
    if (path !== "/api/cases") {
      return next();
    }

    const r = res as ServerResponse;
    let body: unknown = null;
    if (req.method === "POST" || req.method === "PATCH") {
      try {
        const raw = await readBody(req as IncomingMessage);
        if (raw) body = JSON.parse(raw) as unknown;
      } catch {
        r.statusCode = 400;
        r.setHeader("Content-Type", "application/json");
        r.end(JSON.stringify({ error: "Invalid JSON" }));
        return;
      }
    }

    const host = req.headers.host ?? "localhost";
    const url = new URL(req.url ?? "/", `http://${host}`);
    const result = await handleCasesApi({
      method: req.method || "GET",
      searchParams: url.searchParams,
      body,
      cookieHeader: req.headers.cookie,
    });

    if (result.status === 204) {
      r.statusCode = 204;
      r.end();
      return;
    }
    r.statusCode = result.status;
    r.setHeader("Content-Type", "application/json");
    r.end(JSON.stringify(result.body));
  });
}

export function casesDevProxyPlugin(): Plugin {
  let viteBase = "/";
  return {
    name: "cases-dev-proxy",
    configResolved(config) {
      viteBase = config.base;
    },
    configureServer(server) {
      installCasesMiddleware(server.middlewares, viteBase);
    },
    configurePreviewServer(server) {
      installCasesMiddleware(server.middlewares, viteBase);
    },
  };
}

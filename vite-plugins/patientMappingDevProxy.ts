import type { IncomingMessage, ServerResponse } from "node:http";
import type { Connect, Plugin } from "vite";
import {
  forwardPatientMapping,
  getPatientMappingProxyConfigured,
  isMtlsUpstreamConfigured,
  validatePatientMappingBody,
} from "../lib/forwardPatientMapping.js";
import { checkInboundAuth, isInboundAuthConfigured } from "../lib/patientMappingAuth.js";
import { getUserFromCookieHeader, isAuthConfigured } from "../lib/authCore.js";
import { pathWithoutViteBase } from "./viteBasePath";

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function installPatientMappingMiddleware(middlewares: Connect.Server, viteBase: string) {
  middlewares.use(async (req, res, next) => {
        const path = pathWithoutViteBase(req.url?.split("?")[0] ?? "", viteBase);
        if (path !== "/api/patient-mapping") {
          return next();
        }

        const r = res as ServerResponse;

        if (isAuthConfigured() && !getUserFromCookieHeader(req.headers.cookie)) {
          r.statusCode = 401;
          r.setHeader("Content-Type", "application/json");
          r.end(JSON.stringify({ error: "Unauthorized" }));
          return;
        }

        if (req.method === "GET") {
          r.setHeader("Content-Type", "application/json");
          r.end(
            JSON.stringify({
              configured: getPatientMappingProxyConfigured(),
              inboundAuthRequired: isInboundAuthConfigured(),
              mtlsUpstream: isMtlsUpstreamConfigured(),
            })
          );
          return;
        }

        if (req.method !== "POST") {
          r.statusCode = 405;
          r.end();
          return;
        }

        const authz = req.headers.authorization;
        const xToken = req.headers["x-patient-mapping-token"];
        if (
          !checkInboundAuth(
            typeof authz === "string" ? authz : undefined,
            xToken
          )
        ) {
          r.statusCode = 401;
          r.setHeader("Content-Type", "application/json");
          r.end(JSON.stringify({ error: "Unauthorized" }));
          return;
        }

        let raw: string;
        try {
          raw = await readBody(req as IncomingMessage);
        } catch {
          r.statusCode = 400;
          r.setHeader("Content-Type", "application/json");
          r.end(JSON.stringify({ error: "Bad request" }));
          return;
        }

        let parsed: unknown;
        try {
          parsed = raw ? JSON.parse(raw) : null;
        } catch {
          r.statusCode = 400;
          r.setHeader("Content-Type", "application/json");
          r.end(JSON.stringify({ error: "Invalid JSON" }));
          return;
        }

        if (!validatePatientMappingBody(parsed)) {
          r.statusCode = 400;
          r.setHeader("Content-Type", "application/json");
          r.end(JSON.stringify({ error: "Invalid payload" }));
          return;
        }

        if (!getPatientMappingProxyConfigured()) {
          r.statusCode = 503;
          r.setHeader("Content-Type", "application/json");
          r.end(
            JSON.stringify({ error: "Patient mapping proxy not configured" })
          );
          return;
        }

        const result = await forwardPatientMapping(parsed);
        if (!result.ok) {
          const status =
            result.status >= 400 && result.status < 600 ? result.status : 502;
          r.statusCode = status;
          r.setHeader("Content-Type", "application/json");
          r.end(JSON.stringify({ error: "Upstream error", reason: result.reason }));
          return;
        }

        r.statusCode = 200;
        r.setHeader("Content-Type", "application/json");
        r.end(JSON.stringify({ ok: true }));
  });
}

export function patientMappingDevProxyPlugin(): Plugin {
  let viteBase = "/";
  return {
    name: "patient-mapping-dev-proxy",
    configResolved(config) {
      viteBase = config.base;
    },
    configureServer(server) {
      installPatientMappingMiddleware(server.middlewares, viteBase);
    },
    configurePreviewServer(server) {
      installPatientMappingMiddleware(server.middlewares, viteBase);
    },
  };
}

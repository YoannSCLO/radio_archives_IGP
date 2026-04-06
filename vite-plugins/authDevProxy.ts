import type { IncomingMessage, ServerResponse } from "node:http";
import type { Connect, Plugin } from "vite";
import {
  authLoginResult,
  authRegisterResult,
  authAdminCreateUserResult,
} from "../server/authActions";
import {
  buildClearSessionCookie,
  getUserFromCookieHeader,
  isAuthConfigured,
} from "../server/authCore";
import { hasDatabaseUrl, isAllowPublicRegistration } from "../server/authEnv";
import { pathWithoutViteBase } from "./viteBasePath";

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function getHeader(req: IncomingMessage, name: string): string | undefined {
  const n = name.toLowerCase();
  const h = req.headers[n];
  if (typeof h === "string") return h;
  if (Array.isArray(h)) return h[0];
  return undefined;
}

function installAuthApiMiddleware(middlewares: Connect.Server, viteBase: string) {
  middlewares.use(async (req, res, next) => {
        const path = pathWithoutViteBase(req.url?.split("?")[0] ?? "", viteBase);
        if (!path.startsWith("/api/auth/")) {
          return next();
        }

        const r = res as ServerResponse;

        if (path === "/api/auth/session" && req.method === "GET") {
          const authRequired = isAuthConfigured();
          if (!authRequired) {
            r.setHeader("Content-Type", "application/json");
            r.end(
              JSON.stringify({
                authenticated: true,
                authRequired: false,
                multiUser: false,
                allowPublicRegistration: false,
              })
            );
            return;
          }
          const user = getUserFromCookieHeader(req.headers.cookie);
          const multiUser = hasDatabaseUrl();
          const allowPublicRegistration = isAllowPublicRegistration();
          const registrationHint =
            allowPublicRegistration && !multiUser
              ? "Pour afficher « Créer un compte », définissez aussi DATABASE_URL (PostgreSQL). Sans base, l’app reste en mode identifiant unique (AUTH_USERNAME)."
              : multiUser && !allowPublicRegistration
                ? "Pour afficher « Créer un compte », définissez ALLOW_PUBLIC_REGISTRATION=true (sinon création des comptes par l’API admin uniquement)."
                : undefined;
          r.setHeader("Content-Type", "application/json");
          r.end(
            JSON.stringify({
              authenticated: !!user,
              authRequired: true,
              username: user ?? undefined,
              multiUser,
              allowPublicRegistration,
              registrationHint,
            })
          );
          return;
        }

        if (path === "/api/auth/login" && req.method === "POST") {
          if (!isAuthConfigured()) {
            r.statusCode = 503;
            r.setHeader("Content-Type", "application/json");
            r.end(JSON.stringify({ error: "Authentication not configured" }));
            return;
          }
          let raw: string;
          try {
            raw = await readBody(req as IncomingMessage);
          } catch {
            r.statusCode = 400;
            r.end();
            return;
          }
          let body: { username?: string; password?: string };
          try {
            body = raw ? JSON.parse(raw) : {};
          } catch {
            r.statusCode = 400;
            r.setHeader("Content-Type", "application/json");
            r.end(JSON.stringify({ error: "Invalid JSON" }));
            return;
          }
          if (typeof body.username !== "string" || typeof body.password !== "string") {
            r.statusCode = 400;
            r.setHeader("Content-Type", "application/json");
            r.end(JSON.stringify({ error: "Invalid body" }));
            return;
          }
          const result = await authLoginResult(body.username, body.password);
          if (!result.ok) {
            r.statusCode = result.status;
            r.setHeader("Content-Type", "application/json");
            r.end(JSON.stringify(result.body));
            return;
          }
          r.setHeader("Set-Cookie", result.setCookie);
          r.setHeader("Content-Type", "application/json");
          r.end(JSON.stringify({ ok: true }));
          return;
        }

        if (path === "/api/auth/register" && req.method === "POST") {
          let raw: string;
          try {
            raw = await readBody(req as IncomingMessage);
          } catch {
            r.statusCode = 400;
            r.end();
            return;
          }
          let body: { email?: string; password?: string };
          try {
            body = raw ? JSON.parse(raw) : {};
          } catch {
            r.statusCode = 400;
            r.setHeader("Content-Type", "application/json");
            r.end(JSON.stringify({ error: "Invalid JSON" }));
            return;
          }
          if (typeof body.email !== "string" || typeof body.password !== "string") {
            r.statusCode = 400;
            r.setHeader("Content-Type", "application/json");
            r.end(JSON.stringify({ error: "Invalid body" }));
            return;
          }
          const result = await authRegisterResult(body.email, body.password);
          if (!result.ok) {
            r.statusCode = result.status;
            r.setHeader("Content-Type", "application/json");
            r.end(JSON.stringify(result.body));
            return;
          }
          r.setHeader("Set-Cookie", result.setCookie);
          r.setHeader("Content-Type", "application/json");
          r.end(JSON.stringify({ ok: true }));
          return;
        }

        if (path === "/api/auth/admin/users" && req.method === "POST") {
          const secret = getHeader(req as IncomingMessage, "x-admin-secret");
          let raw: string;
          try {
            raw = await readBody(req as IncomingMessage);
          } catch {
            r.statusCode = 400;
            r.end();
            return;
          }
          let body: { email?: string; password?: string };
          try {
            body = raw ? JSON.parse(raw) : {};
          } catch {
            r.statusCode = 400;
            r.setHeader("Content-Type", "application/json");
            r.end(JSON.stringify({ error: "Invalid JSON" }));
            return;
          }
          if (typeof body.email !== "string" || typeof body.password !== "string") {
            r.statusCode = 400;
            r.setHeader("Content-Type", "application/json");
            r.end(JSON.stringify({ error: "Invalid body" }));
            return;
          }
          const result = await authAdminCreateUserResult(
            body.email,
            body.password,
            secret
          );
          if (!result.ok) {
            r.statusCode = result.status;
            r.setHeader("Content-Type", "application/json");
            r.end(JSON.stringify(result.body));
            return;
          }
          r.statusCode = 201;
          r.setHeader("Content-Type", "application/json");
          r.end(JSON.stringify({ ok: true }));
          return;
        }

        if (path === "/api/auth/logout" && req.method === "POST") {
          r.setHeader("Set-Cookie", buildClearSessionCookie());
          r.setHeader("Content-Type", "application/json");
          r.end(JSON.stringify({ ok: true }));
          return;
        }

        r.statusCode = 404;
        r.end();
  });
}

export function authDevProxyPlugin(): Plugin {
  let viteBase = "/";
  return {
    name: "auth-dev-proxy",
    configResolved(config) {
      viteBase = config.base;
    },
    configureServer(server) {
      installAuthApiMiddleware(server.middlewares, viteBase);
    },
    configurePreviewServer(server) {
      installAuthApiMiddleware(server.middlewares, viteBase);
    },
  };
}

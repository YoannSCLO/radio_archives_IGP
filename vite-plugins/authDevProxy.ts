import type { IncomingMessage, ServerResponse } from "node:http";
import type { Connect, Plugin } from "vite";
import {
  authLoginResult,
  authRegisterResult,
  authAdminCreateUserResult,
} from "../lib/authActions.js";
import { requireAdminSession } from "../lib/authAdminSession.js";
import {
  approveUserByEmail,
  getUserAuthFlags,
  listPendingEmails,
} from "../lib/usersRepo.js";
import {
  buildClearSessionCookie,
  getUserFromCookieHeader,
  isAuthConfigured,
} from "../lib/authCore.js";
import { hasDatabaseUrl, isAllowPublicRegistration } from "../lib/authEnv.js";
import { handleApproveByLinkGet } from "../lib/approveByLinkHttp.js";
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
          let isAdmin = false;
          if (user && multiUser) {
            const flags = await getUserAuthFlags(user);
            isAdmin = flags?.is_admin === true;
          }
          r.setHeader("Content-Type", "application/json");
          r.end(
            JSON.stringify({
              authenticated: !!user,
              authRequired: true,
              username: user ?? undefined,
              multiUser,
              allowPublicRegistration,
              registrationRequiresAdminApproval: allowPublicRegistration && multiUser,
              registrationHint,
              isAdmin,
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
          r.setHeader("Content-Type", "application/json");
          r.end(JSON.stringify({ ok: true, pendingApproval: true }));
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
          let body: { email?: string; password?: string; isAdmin?: boolean };
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
            secret,
            { isAdmin: body.isAdmin === true }
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

        if (path === "/api/auth/pending-registrations" && req.method === "GET") {
          const gate = await requireAdminSession(req.headers.cookie);
          if (!gate.ok) {
            r.statusCode = gate.status;
            r.setHeader("Content-Type", "application/json");
            r.end(JSON.stringify(gate.body));
            return;
          }
          const emails = await listPendingEmails();
          r.setHeader("Content-Type", "application/json");
          r.end(JSON.stringify({ emails }));
          return;
        }

        if (path === "/api/auth/approve-registration" && req.method === "POST") {
          let raw: string;
          try {
            raw = await readBody(req as IncomingMessage);
          } catch {
            r.statusCode = 400;
            r.end();
            return;
          }
          let body: { email?: string };
          try {
            body = raw ? JSON.parse(raw) : {};
          } catch {
            r.statusCode = 400;
            r.setHeader("Content-Type", "application/json");
            r.end(JSON.stringify({ error: "Invalid JSON" }));
            return;
          }
          const gate = await requireAdminSession(req.headers.cookie);
          if (!gate.ok) {
            r.statusCode = gate.status;
            r.setHeader("Content-Type", "application/json");
            r.end(JSON.stringify(gate.body));
            return;
          }
          if (typeof body.email !== "string" || !body.email.trim()) {
            r.statusCode = 400;
            r.setHeader("Content-Type", "application/json");
            r.end(JSON.stringify({ error: "Invalid body" }));
            return;
          }
          const approved = await approveUserByEmail(body.email.trim());
          if (!approved) {
            r.statusCode = 404;
            r.setHeader("Content-Type", "application/json");
            r.end(
              JSON.stringify({ error: "Aucune demande en attente pour cet e-mail" })
            );
            return;
          }
          r.setHeader("Content-Type", "application/json");
          r.end(JSON.stringify({ ok: true }));
          return;
        }

        if (path === "/api/auth/approve-by-link" && req.method === "GET") {
          const host = req.headers.host ?? "localhost";
          const url = new URL(req.url ?? "/", `http://${host}`);
          const result = await handleApproveByLinkGet(url.searchParams);
          r.statusCode = result.status;
          r.setHeader("Content-Type", "text/html; charset=utf-8");
          r.end(result.html);
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

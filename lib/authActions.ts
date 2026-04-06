import {
  buildSessionCookie,
  isAllowPublicRegistration,
  isAuthConfigured,
  signSessionToken,
  verifyCredentials,
} from "./authCore.js";
import { createUser } from "./usersRepo.js";
import { isMultiUserMode } from "./db.js";

export type LoginResult =
  | { ok: true; setCookie: string }
  | { ok: false; status: number; body: Record<string, unknown> };

export async function authLoginResult(
  username: string,
  password: string
): Promise<LoginResult> {
  if (!isAuthConfigured()) {
    return {
      ok: false,
      status: 503,
      body: { error: "Authentication not configured" },
    };
  }
  const valid = await verifyCredentials(username, password);
  if (!valid) {
    return { ok: false, status: 401, body: { error: "Invalid credentials" } };
  }
  const sub = isMultiUserMode()
    ? username.trim().toLowerCase()
    : username.trim();
  const token = signSessionToken(sub);
  return { ok: true, setCookie: buildSessionCookie(token, 7 * 24 * 3600) };
}

export type RegisterResult = LoginResult;

export async function authRegisterResult(
  email: string,
  password: string
): Promise<RegisterResult> {
  if (!isAuthConfigured()) {
    return {
      ok: false,
      status: 503,
      body: { error: "Authentication not configured" },
    };
  }
  if (!isMultiUserMode()) {
    return {
      ok: false,
      status: 503,
      body: { error: "Registration requires DATABASE_URL" },
    };
  }
  if (!isAllowPublicRegistration()) {
    return {
      ok: false,
      status: 403,
      body: { error: "Public registration is disabled" },
    };
  }
  const em = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
    return { ok: false, status: 400, body: { error: "Invalid email" } };
  }
  if (password.length < 8) {
    return {
      ok: false,
      status: 400,
      body: { error: "Password must be at least 8 characters" },
    };
  }
  const r = await createUser(em, password);
  if (!r.ok) {
    if (r.reason === "duplicate") {
      return {
        ok: false,
        status: 409,
        body: { error: "This email is already registered" },
      };
    }
    return { ok: false, status: 500, body: { error: "Could not create account" } };
  }
  const token = signSessionToken(em);
  return { ok: true, setCookie: buildSessionCookie(token, 7 * 24 * 3600) };
}

export type AdminCreateResult =
  | { ok: true }
  | { ok: false; status: number; body: Record<string, unknown> };

export async function authAdminCreateUserResult(
  email: string,
  password: string,
  adminSecret: string | undefined
): Promise<AdminCreateResult> {
  const expected = process.env.AUTH_ADMIN_SECRET?.trim();
  if (!expected || adminSecret !== expected) {
    return { ok: false, status: 401, body: { error: "Unauthorized" } };
  }
  if (!isMultiUserMode()) {
    return {
      ok: false,
      status: 503,
      body: { error: "Multi-user mode requires DATABASE_URL" },
    };
  }
  const em = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
    return { ok: false, status: 400, body: { error: "Invalid email" } };
  }
  if (password.length < 8) {
    return {
      ok: false,
      status: 400,
      body: { error: "Password must be at least 8 characters" },
    };
  }
  const r = await createUser(em, password);
  if (!r.ok) {
    if (r.reason === "duplicate") {
      return {
        ok: false,
        status: 409,
        body: { error: "This email is already registered" },
      };
    }
    return { ok: false, status: 500, body: { error: "Could not create user" } };
  }
  return { ok: true };
}

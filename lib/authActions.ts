import {
  authenticateUser,
  buildSessionCookie,
  isAllowPublicRegistration,
  isAuthConfigured,
  signSessionToken,
} from "./authCore.js";
import { notifyAdminPendingRegistration } from "./notifyAdminPendingRegistration.js";
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
  const auth = await authenticateUser(username, password);
  if (auth === "invalid") {
    return { ok: false, status: 401, body: { error: "Invalid credentials" } };
  }
  if (auth === "pending") {
    return {
      ok: false,
      status: 403,
      body: {
        error:
          "Compte en attente de validation par un administrateur. Vous recevrez l’accès une fois votre demande acceptée.",
        code: "pending_approval",
      },
    };
  }
  const sub = isMultiUserMode()
    ? username.trim().toLowerCase()
    : username.trim();
  const token = signSessionToken(sub);
  return { ok: true, setCookie: buildSessionCookie(token, 7 * 24 * 3600) };
}

export type RegisterResult =
  | { ok: true; pendingApproval: true }
  | { ok: false; status: number; body: Record<string, unknown> };

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
  const r = await createUser(em, password, { approved: false });
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
  try {
    await notifyAdminPendingRegistration(em);
  } catch (e) {
    console.error("notifyAdminPendingRegistration", e);
  }
  return { ok: true, pendingApproval: true };
}

export type AdminCreateResult =
  | { ok: true }
  | { ok: false; status: number; body: Record<string, unknown> };

export async function authAdminCreateUserResult(
  email: string,
  password: string,
  adminSecret: string | undefined,
  options?: { isAdmin?: boolean }
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
  const r = await createUser(em, password, {
    approved: true,
    isAdmin: options?.isAdmin === true,
  });
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

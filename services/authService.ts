import { apiUrl } from "./apiBase";

export type SessionInfo =
  | {
      authenticated: true;
      authRequired: false;
      multiUser: boolean;
      allowPublicRegistration: boolean;
    }
  | {
      authenticated: boolean;
      authRequired: true;
      username?: string;
      multiUser: boolean;
      allowPublicRegistration: boolean;
      /** Inscription publique + Postgres : la demande doit être validée par un admin. */
      registrationRequiresAdminApproval?: boolean;
      /** Compte connecté avec rôle administrateur (validation des inscriptions). */
      isAdmin?: boolean;
      /** Mot de passe modifiable via l’app (comptes en base / fichier dev), pas le mode compte unique .env seul. */
      canChangePassword?: boolean;
      /** Présent si la config incite à l’inscription mais qu’il manque PostgreSQL. */
      registrationHint?: string;
    };

export async function fetchSession(): Promise<SessionInfo> {
  const res = await fetch(apiUrl("api/auth/session"), { credentials: "include" });
  if (!res.ok) {
    return {
      authenticated: false,
      authRequired: true,
      multiUser: false,
      allowPublicRegistration: false,
      registrationHint: undefined,
    };
  }
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    return {
      authenticated: false,
      authRequired: true,
      multiUser: false,
      allowPublicRegistration: false,
      registrationHint:
        "L’API d’authentification ne répond pas en JSON (souvent: mauvais serveur ou ancien « vite preview »). Utilisez npm run dev (port 3000) ou redémarrez npm run preview après un build.",
    };
  }
  return res.json() as Promise<SessionInfo>;
}

export type LoginOutcome = "ok" | "invalid" | "pending";

export async function login(username: string, password: string): Promise<LoginOutcome> {
  const res = await fetch(apiUrl("api/auth/login"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (res.ok) return "ok";
  let code: string | undefined;
  try {
    const j = (await res.json()) as { code?: string };
    code = j.code;
  } catch {
    /* ignore */
  }
  if (res.status === 403 && code === "pending_approval") return "pending";
  return "invalid";
}

export type RegisterOutcome = "success" | "duplicate" | "error";

export async function register(email: string, password: string): Promise<RegisterOutcome> {
  const res = await fetch(apiUrl("api/auth/register"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (res.status === 201) return "success";
  if (res.status === 409) return "duplicate";
  return "error";
}

export async function logout(): Promise<void> {
  await fetch(apiUrl("api/auth/logout"), { method: "POST", credentials: "include" });
}

export async function fetchPendingRegistrations(): Promise<string[] | null> {
  const res = await fetch(apiUrl("api/auth/pending-registrations"), {
    credentials: "include",
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { emails?: string[] };
  return Array.isArray(j.emails) ? j.emails : null;
}

export async function approveRegistration(email: string): Promise<boolean> {
  const res = await fetch(apiUrl("api/auth/approve-registration"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return res.ok;
}

export type ChangePasswordOutcome = "ok" | "wrong" | "weak" | "error" | "single_user";

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<ChangePasswordOutcome> {
  const res = await fetch(apiUrl("api/auth/change-password"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (res.ok) return "ok";
  let code: string | undefined;
  let err = "";
  try {
    const j = (await res.json()) as { code?: string; error?: string };
    code = j.code;
    err = typeof j.error === "string" ? j.error : "";
  } catch {
    /* ignore */
  }
  if (res.status === 403) return "wrong";
  if (res.status === 400 && code === "single_user_mode") return "single_user";
  if (res.status === 400 && /8 caractères|au moins 8/i.test(err)) return "weak";
  return "error";
}

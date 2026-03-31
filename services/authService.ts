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

export async function login(username: string, password: string): Promise<boolean> {
  const res = await fetch(apiUrl("api/auth/login"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return res.ok;
}

export async function register(email: string, password: string): Promise<boolean> {
  const res = await fetch(apiUrl("api/auth/register"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return res.ok;
}

export async function logout(): Promise<void> {
  await fetch(apiUrl("api/auth/logout"), { method: "POST", credentials: "include" });
}

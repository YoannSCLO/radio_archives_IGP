import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getUserFromCookieHeader,
  isAuthConfigured,
} from "../../lib/authCore.js";
import {
  hasDatabaseUrl,
  isAllowPublicRegistration,
} from "../../lib/authEnv.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authRequired = isAuthConfigured();
  if (!authRequired) {
    return res.status(200).json({
      authenticated: true,
      authRequired: false,
      multiUser: false,
      allowPublicRegistration: false,
    });
  }

  const user = getUserFromCookieHeader(req.headers.cookie);
  /** Pour l’UI : « multi-utilisateurs » = Postgres disponible (sinon pas d’inscription possible). */
  const multiUser = hasDatabaseUrl();
  const allowPublicRegistration = isAllowPublicRegistration();
  const registrationHint =
    allowPublicRegistration && !multiUser
      ? "Pour afficher « Créer un compte », définissez aussi DATABASE_URL (PostgreSQL). Sans base, l’app reste en mode identifiant unique (AUTH_USERNAME)."
      : multiUser && !allowPublicRegistration
        ? "Pour afficher « Créer un compte », définissez ALLOW_PUBLIC_REGISTRATION=true (sinon création des comptes par l’API admin uniquement)."
        : undefined;

  return res.status(200).json({
    authenticated: !!user,
    authRequired: true,
    username: user ?? undefined,
    multiUser,
    allowPublicRegistration,
    registrationHint,
  });
}

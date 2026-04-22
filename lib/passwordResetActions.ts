import { isAuthConfigured } from "./authCore.js";
import { isMultiUserMode } from "./authEnv.js";
import { findUserByEmail, setUserPassword } from "./usersRepo.js";
import {
  passwordFingerprint,
  signPasswordResetToken,
  verifyPasswordResetToken,
} from "./passwordResetToken.js";
import { getPublicAppBaseUrl } from "./notifyAdminPendingRegistration.js";
import { log } from "./logger.js";

export type ResetRequestResult =
  | { ok: true }
  | { ok: false; status: number; body: Record<string, unknown> };

/**
 * Toujours 200 pour ne pas divulguer l'existence d'un compte.
 * L'e-mail n'est envoyé que si le compte existe, est approuvé, et si Resend est configuré.
 */
export async function requestPasswordReset(email: unknown): Promise<ResetRequestResult> {
  if (!isAuthConfigured() || !isMultiUserMode()) {
    return {
      ok: false,
      status: 503,
      body: {
        error: "Réinitialisation indisponible (mode compte unique ou authentification non configurée).",
        code: "unsupported",
      },
    };
  }
  if (typeof email !== "string") {
    return { ok: false, status: 400, body: { error: "Invalid email" } };
  }
  const em = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
    return { ok: false, status: 400, body: { error: "Invalid email" } };
  }

  const user = await findUserByEmail(em);
  if (!user || !user.approved) {
    log.info("password reset requested for unknown/unapproved email", { email: em });
    return { ok: true };
  }

  let token: string;
  try {
    token = signPasswordResetToken(em, passwordFingerprint(user.password_hash));
  } catch (e) {
    log.error("password reset: sign token", e, { email: em });
    return { ok: true };
  }

  const base = getPublicAppBaseUrl();
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim() || "Radio Archive <onboarding@resend.dev>";

  if (!base || !apiKey) {
    log.warn("password reset token generated but email not sent (missing PUBLIC_APP_URL or RESEND_API_KEY)", {
      email: em,
      hasBase: !!base,
      hasKey: !!apiKey,
    });
    return { ok: true };
  }

  const resetUrl = `${base}/?reset=${encodeURIComponent(token)}`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [em],
        subject: "[Radio Archive] Réinitialisation de votre mot de passe",
        html: `<p>Bonjour,</p>
<p>Une réinitialisation de mot de passe a été demandée pour ce compte.</p>
<p><a href="${resetUrl}">Cliquer ici pour définir un nouveau mot de passe</a></p>
<p style="color:#666;font-size:12px">Ce lien expire dans 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>`,
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      log.warn("Resend password reset failed", { status: res.status, body: t.slice(0, 500) });
    }
  } catch (e) {
    log.error("password reset: resend fetch", e, { email: em });
  }

  return { ok: true };
}

export type ResetConfirmResult =
  | { ok: true }
  | { ok: false; status: number; body: Record<string, unknown> };

export async function confirmPasswordReset(
  token: unknown,
  newPassword: unknown
): Promise<ResetConfirmResult> {
  if (!isAuthConfigured() || !isMultiUserMode()) {
    return {
      ok: false,
      status: 503,
      body: { error: "Réinitialisation indisponible." },
    };
  }
  if (typeof token !== "string" || !token.trim()) {
    return { ok: false, status: 400, body: { error: "Jeton manquant." } };
  }
  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return {
      ok: false,
      status: 400,
      body: { error: "Le mot de passe doit contenir au moins 8 caractères." },
    };
  }
  const parsed = verifyPasswordResetToken(token);
  if (!parsed) {
    return { ok: false, status: 400, body: { error: "Lien invalide ou expiré." } };
  }
  const user = await findUserByEmail(parsed.email);
  if (!user || !user.approved) {
    return { ok: false, status: 400, body: { error: "Lien invalide ou expiré." } };
  }
  // Le fingerprint change à chaque update de hash → un jeton déjà utilisé ne sert plus.
  if (passwordFingerprint(user.password_hash) !== parsed.fingerprint) {
    return { ok: false, status: 400, body: { error: "Lien déjà utilisé ou expiré." } };
  }
  const r = await setUserPassword(parsed.email, newPassword);
  if (r === "weak_password") {
    return {
      ok: false,
      status: 400,
      body: { error: "Le mot de passe doit contenir au moins 8 caractères." },
    };
  }
  if (r === "not_found") {
    return { ok: false, status: 400, body: { error: "Lien invalide ou expiré." } };
  }
  log.info("password reset confirmed", { email: parsed.email });
  return { ok: true };
}

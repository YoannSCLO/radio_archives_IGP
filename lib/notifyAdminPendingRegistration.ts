import { signRegistrationApprovalToken } from "./registrationApprovalToken.js";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** URL publique du site (liens dans les e-mails). Ex. https://archive.chu.fr ou https://xxx.vercel.app */
export function getPublicAppBaseUrl(): string {
  const explicit = process.env.PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const v = process.env.VERCEL_URL?.trim();
  if (v) {
    const host = v.replace(/^https?:\/\//, "");
    return `https://${host}`;
  }
  return "";
}

/**
 * Envoie un e-mail à AUTH_ADMIN_EMAIL avec un lien pour valider l’inscription (Resend).
 * Sans RESEND_API_KEY ou sans base URL publique : ne fait rien (validation toujours possible dans l’app).
 */
export async function notifyAdminPendingRegistration(pendingEmail: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const adminTo = process.env.AUTH_ADMIN_EMAIL?.trim();
  const base = getPublicAppBaseUrl();
  if (!apiKey || !adminTo || !base) {
    return;
  }

  let token: string;
  try {
    token = signRegistrationApprovalToken(pendingEmail);
  } catch (e) {
    console.error("notifyAdminPendingRegistration: token", e);
    return;
  }

  const approveUrl = `${base}/api/auth/approve-by-link?token=${encodeURIComponent(token)}`;
  const from =
    process.env.RESEND_FROM?.trim() || "Radio Archive <onboarding@resend.dev>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [adminTo],
      subject: `[Radio Archive] Valider l’inscription : ${pendingEmail}`,
      html: `<p>Bonjour,</p>
<p>Une demande d’inscription a été reçue pour <strong>${escapeHtml(pendingEmail)}</strong>.</p>
<p><a href="${approveUrl}">Cliquer ici pour valider ce compte</a></p>
<p style="color:#666;font-size:12px">Ce lien expire sous 72 h. Si vous n’êtes pas concerné, ignorez ce message.</p>`,
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    console.error("Resend notifyAdminPendingRegistration", res.status, t);
  }
}

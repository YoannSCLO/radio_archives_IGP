import { verifyRegistrationApprovalToken } from "./registrationApprovalToken.js";
import { approveUserByEmail } from "./usersRepo.js";

function htmlPage(title: string, body: string, ok: boolean): string {
  const color = ok ? "#059669" : "#b91c1c";
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${escapeHtml(
    title
  )}</title></head><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:3rem auto;padding:0 1rem;">
<h1 style="color:${color};font-size:1.25rem">${escapeHtml(title)}</h1>
<p style="color:#334155;line-height:1.5">${body}</p>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function handleApproveByLinkGet(
  searchParams: URLSearchParams
): Promise<{ status: number; html: string }> {
  const token = searchParams.get("token")?.trim();
  if (!token) {
    return {
      status: 400,
      html: htmlPage(
        "Lien incomplet",
        "Le lien de validation est incomplet. Utilisez le lien reçu par e-mail ou validez depuis l’application.",
        false
      ),
    };
  }

  const payload = verifyRegistrationApprovalToken(token);
  if (!payload) {
    return {
      status: 400,
      html: htmlPage(
        "Lien invalide ou expiré",
        "Ce lien a expiré (72 h) ou n’est pas valide. Demandez une nouvelle inscription ou validez le compte depuis l’interface d’administration.",
        false
      ),
    };
  }

  const ok = await approveUserByEmail(payload.pendingEmail);
  if (!ok) {
    return {
      status: 404,
      html: htmlPage(
        "Demande introuvable",
        `Aucun compte en attente pour <strong>${escapeHtml(
          payload.pendingEmail
        )}</strong>. Il est peut-être déjà validé.`,
        false
      ),
    };
  }

  return {
    status: 200,
    html: htmlPage(
      "Compte validé",
      `Le compte <strong>${escapeHtml(
        payload.pendingEmail
      )}</strong> est activé. La personne peut se connecter.`,
      true
    ),
  };
}

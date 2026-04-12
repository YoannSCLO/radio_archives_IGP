import jwt from "jsonwebtoken";

const TYP = "registration_approval";

function getSecret(): string {
  const s =
    process.env.AUTH_APPROVAL_TOKEN_SECRET?.trim() ||
    process.env.AUTH_SESSION_SECRET?.trim();
  if (!s) throw new Error("AUTH_SESSION_SECRET (ou AUTH_APPROVAL_TOKEN_SECRET) requis");
  return s;
}

export function signRegistrationApprovalToken(pendingEmail: string): string {
  const em = pendingEmail.trim().toLowerCase();
  return jwt.sign({ typ: TYP, pendingEmail: em }, getSecret(), { expiresIn: "72h" });
}

export function verifyRegistrationApprovalToken(
  token: string
): { pendingEmail: string } | null {
  try {
    const p = jwt.verify(token.trim(), getSecret()) as {
      typ?: string;
      pendingEmail?: string;
    };
    if (p.typ !== TYP || typeof p.pendingEmail !== "string" || !p.pendingEmail.trim()) {
      return null;
    }
    return { pendingEmail: p.pendingEmail.trim().toLowerCase() };
  } catch {
    return null;
  }
}

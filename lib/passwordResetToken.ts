import jwt from "jsonwebtoken";
import { createHash } from "node:crypto";

const TYP = "password_reset";

function getSecret(): string {
  const s =
    process.env.AUTH_RESET_TOKEN_SECRET?.trim() ||
    process.env.AUTH_SESSION_SECRET?.trim();
  if (!s) {
    throw new Error("AUTH_SESSION_SECRET (ou AUTH_RESET_TOKEN_SECRET) requis");
  }
  return s;
}

/**
 * Empreinte stable du hash de mot de passe actuel : lie le jeton au mot de passe
 * au moment de l'émission. Dès que le mot de passe change, les jetons existants
 * deviennent invalides (on ne peut pas réutiliser un lien déjà consommé).
 */
export function passwordFingerprint(passwordHash: string): string {
  return createHash("sha256").update(passwordHash).digest("hex").slice(0, 16);
}

export function signPasswordResetToken(email: string, fingerprint: string): string {
  const em = email.trim().toLowerCase();
  return jwt.sign({ typ: TYP, email: em, fp: fingerprint }, getSecret(), {
    expiresIn: "1h",
  });
}

export function verifyPasswordResetToken(
  token: string
): { email: string; fingerprint: string } | null {
  try {
    const p = jwt.verify(token.trim(), getSecret()) as {
      typ?: string;
      email?: string;
      fp?: string;
    };
    if (p.typ !== TYP) return null;
    if (typeof p.email !== "string" || !p.email.trim()) return null;
    if (typeof p.fp !== "string" || !p.fp) return null;
    return { email: p.email.trim().toLowerCase(), fingerprint: p.fp };
  } catch {
    return null;
  }
}

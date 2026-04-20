/**
 * Génère un hash bcrypt. Préférez AUTH_PASSWORD_BCRYPT_B64 dans .env (sans caractère $).
 * Usage : node scripts/hash-password.mjs "votreMotDePasse"
 */
import bcrypt from "bcryptjs";

const pw = process.argv[2];
if (!pw) {
  console.error('Usage: node scripts/hash-password.mjs "mot de passe"');
  process.exit(1);
}
const hash = bcrypt.hashSync(pw, 12);
console.log("AUTH_PASSWORD_BCRYPT (brut, attention aux $ avec Vite) :");
console.log(hash);
console.log("AUTH_PASSWORD_BCRYPT_B64 (recommandé pour .env) :");
console.log(Buffer.from(hash, "utf8").toString("base64"));

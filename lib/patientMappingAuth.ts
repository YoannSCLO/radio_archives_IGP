/**
 * Authentification des requêtes vers le proxy /api/patient-mapping (navigateur → votre déploiement).
 * Le secret reste côté serveur ; le navigateur envoie un jeton identique stocké en session (sessionStorage), pas dans le build.
 */

export function isInboundAuthConfigured(): boolean {
  return !!process.env.PATIENT_MAPPING_INBOUND_SECRET?.trim();
}

/**
 * @param authorization - header Authorization
 * @param xPatientMappingToken - header optionnel X-Patient-Mapping-Token (même valeur, si un proxy retire Authorization)
 */
export function checkInboundAuth(
  authorization: string | undefined,
  xPatientMappingToken: string | string[] | undefined
): boolean {
  const secret = process.env.PATIENT_MAPPING_INBOUND_SECRET?.trim();
  if (!secret) return true;

  const auth = authorization?.trim();
  if (auth === `Bearer ${secret}`) return true;

  const xt = Array.isArray(xPatientMappingToken)
    ? xPatientMappingToken[0]
    : xPatientMappingToken;
  if (xt === secret) return true;

  return false;
}

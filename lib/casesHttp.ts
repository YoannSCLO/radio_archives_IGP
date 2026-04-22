import { getSql } from "./db.js";
import {
  deleteRadioCase,
  getRadioCaseById,
  insertRadioCase,
  listRadioCases,
  restoreRadioCase,
  updateRadioCase,
} from "./casesRepo.js";
import {
  canUserModifyCase,
  isAuthRequiredForCases,
  parseCreateBody,
  parsePatchBody,
} from "./casesShared.js";
import { getUserFromCookieHeader, isAuthConfigured } from "./authCore.js";

function requireSessionForMutation(cookie: string | undefined): { ok: true; user: string | null } | { ok: false } {
  if (!isAuthConfigured()) {
    return { ok: true, user: getUserFromCookieHeader(cookie) ?? null };
  }
  const u = getUserFromCookieHeader(cookie);
  if (!u) return { ok: false };
  return { ok: true, user: u };
}

function requireSessionForRead(cookie: string | undefined): { ok: true; user: string | null } | { ok: false } {
  if (!isAuthConfigured()) {
    return { ok: true, user: getUserFromCookieHeader(cookie) ?? null };
  }
  const u = getUserFromCookieHeader(cookie);
  if (!u) return { ok: false };
  return { ok: true, user: u };
}

export async function handleCasesApi(input: {
  method: string;
  searchParams: URLSearchParams;
  body: unknown;
  cookieHeader: string | undefined;
}): Promise<{ status: number; body: unknown }> {
  if (!getSql()) {
    return {
      status: 503,
      body: {
        error: "Cases partagés indisponibles",
        reason: "no_database",
        detail: "Définissez DATABASE_URL (PostgreSQL) pour synchroniser les cas entre appareils.",
      },
    };
  }

  const method = input.method.toUpperCase();
  const authReq = isAuthRequiredForCases();

  try {
    if (method === "GET") {
      const session = requireSessionForRead(input.cookieHeader);
      if (!session.ok) {
        return { status: 401, body: { error: "Unauthorized" } };
      }
      const cases = await listRadioCases();
      return { status: 200, body: { cases } };
    }

    if (method === "POST") {
      const session = requireSessionForMutation(input.cookieHeader);
      if (!session.ok) {
        return { status: 401, body: { error: "Unauthorized" } };
      }
      const action = input.searchParams.get("action");
      if (action === "restore") {
        const id = input.searchParams.get("id");
        if (!id?.trim()) {
          return { status: 400, body: { error: "Query id requis" } };
        }
        const existing = await getRadioCaseById(id.trim(), { includeDeleted: true });
        if (!existing) {
          return { status: 404, body: { error: "Cas introuvable" } };
        }
        if (!canUserModifyCase(session.user, authReq, existing.authorEmail)) {
          return { status: 403, body: { error: "Restauration réservée à l’auteur du cas" } };
        }
        const restored = await restoreRadioCase(id.trim());
        if (!restored) {
          return { status: 409, body: { error: "Ce cas n'est pas en corbeille" } };
        }
        return { status: 200, body: { case: restored } };
      }
      const parsed = parseCreateBody(input.body);
      if (!parsed.ok) {
        return { status: 400, body: { error: parsed.error } };
      }
      const authorEmail = session.user?.trim().toLowerCase() ?? null;
      try {
        const created = await insertRadioCase(
          {
            ...parsed.case,
            authorEmail: authorEmail ?? undefined,
          },
          authorEmail
        );
        return { status: 201, body: { case: created } };
      } catch (e: unknown) {
        const err = e as { code?: string };
        if (err.code === "23505") {
          return { status: 409, body: { error: "Un cas avec cet identifiant existe déjà" } };
        }
        throw e;
      }
    }

    if (method === "PATCH") {
      const session = requireSessionForMutation(input.cookieHeader);
      if (!session.ok) {
        return { status: 401, body: { error: "Unauthorized" } };
      }
      const parsed = parsePatchBody(input.body);
      if (!parsed.ok) {
        return { status: 400, body: { error: parsed.error } };
      }
      if (authReq) {
        const j = parsed.justification?.trim() ?? "";
        if (j.length < 10) {
          return {
            status: 400,
            body: { error: "Justification d’au moins 10 caractères requise pour la traçabilité." },
          };
        }
      }
      const existing = await getRadioCaseById(parsed.id);
      if (!existing) {
        return { status: 404, body: { error: "Cas introuvable" } };
      }
      if (!canUserModifyCase(session.user, authReq, existing.authorEmail)) {
        return { status: 403, body: { error: "Modification réservée à l’auteur du cas" } };
      }
      const updated = await updateRadioCase(
        parsed.id,
        parsed.updates,
        parsed.justification ?? null
      );
      if (!updated) {
        return { status: 404, body: { error: "Cas introuvable" } };
      }
      return { status: 200, body: { case: updated } };
    }

    if (method === "DELETE") {
      const session = requireSessionForMutation(input.cookieHeader);
      if (!session.ok) {
        return { status: 401, body: { error: "Unauthorized" } };
      }
      const id = input.searchParams.get("id");
      if (!id?.trim()) {
        return { status: 400, body: { error: "Query id requis" } };
      }
      const existing = await getRadioCaseById(id.trim());
      if (!existing) {
        return { status: 404, body: { error: "Cas introuvable" } };
      }
      if (!canUserModifyCase(session.user, authReq, existing.authorEmail)) {
        return { status: 403, body: { error: "Suppression réservée à l’auteur du cas" } };
      }
      const ok = await deleteRadioCase(id.trim());
      return { status: ok ? 204 : 404, body: ok ? null : { error: "Cas introuvable" } };
    }

    return { status: 405, body: { error: "Method not allowed" } };
  } catch (e) {
    console.error("casesHttp", e);
    return { status: 500, body: { error: "Erreur serveur" } };
  }
}

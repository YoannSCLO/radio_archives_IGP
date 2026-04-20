# Correspondance CASE ↔ IPP (proxy sécurisé)

Ce document décrit les **paramètres à renseigner**, le **flux de données** et le **format JSON** attendu par votre API sur infrastructure **HDS / SI santé**.

- **Comptes utilisateurs** (e-mail / mot de passe, multi-utilisateurs) : voir **`authentification-multi-utilisateurs.md`**.
- **Texte à transmettre au SI pour la table de correspondance uniquement** (sans parler des comptes applicatifs) : voir **`demande-si-correspondance.md`**.

## Mise à jour automatique de la table de correspondance

À **chaque enregistrement d’un nouveau cas**, si l’utilisateur a renseigné un **IPP** dans le formulaire, l’application envoie **un `POST`** vers votre API HDS avec `caseCode`, `ipp`, etc. Le SI peut :

- **Insérer** une nouvelle ligne pour chaque envoi, ou
- Faire un **`UPSERT`** sur `case_code` (recommandé) : si le même `CASE-xxxxx` est renvoyé (ré-import), la ligne est mise à jour plutôt que dupliquée.

Il n’y a pas de synchronisation « temps réel » bidirectionnelle : c’est **à chaque sauvegarde de cas avec IPP** que l’app pousse les données vers le HDS.

## Flux

1. L’utilisateur saisit l’IPP (et optionnellement le nom) dans le formulaire de cas. Ces données **ne sont jamais** stockées dans `localStorage` ni dans l’objet `RadioCase`.
2. Le navigateur envoie un `POST` **vers votre site uniquement** : `/api/patient-mapping` (même origine que l’app).
3. La fonction serveur (Vercel ou middleware Vite en dev) **vérifie** éventuellement un jeton d’entrée, puis **relaye** le JSON vers l’URL **HDS** configurée en variable d’environnement **serveur** (jamais préfixée `VITE_`).
4. Aucune URL HDS ni clé upstream n’apparaît dans le bundle JavaScript chargé par le navigateur.

**Remarque** : les données transitent brièvement par la mémoire du processus serverless (Vercel). Pour un périmètre où même ce transit est interdit, il faudrait un autre modèle (poste sur le réseau santé uniquement, mTLS direct navigateur↔HDS avec CORS, etc.).

## Variables d’environnement (serveur / Vercel / `.env` local)

| Variable | Obligatoire | Rôle |
|----------|-------------|------|
| `PATIENT_MAPPING_UPSTREAM_URL` | Oui pour activer l’envoi | URL HTTPS de **votre** API qui recevra le JSON et écrira la table de correspondance (ex. `https://api-etablissement.fr/radio-archive/mapping`). |
| `PATIENT_MAPPING_UPSTREAM_KEY` | Non | Si votre API HDS exige un `Authorization: Bearer`, mettez le secret **ici** (reste côté serveur uniquement). |
| `PATIENT_MAPPING_INBOUND_SECRET` | Non (recommandé en prod) | Si défini, chaque `POST` sur `/api/patient-mapping` doit présenter `Authorization: Bearer <valeur>` (ou header `X-Patient-Mapping-Token` avec la même valeur). L’utilisateur saisit la **même valeur** dans l’app (Réglages → correspondance patient) : elle est stockée en **sessionStorage**, pas dans le dépôt ni le bundle. |
| `PATIENT_MAPPING_UPSTREAM_MTLS` | Non | Mettre `1` ou `true` pour activer le **mTLS** vers l’HDS (certificat client). |
| `PATIENT_MAPPING_UPSTREAM_CLIENT_CERT` | Si mTLS | PEM du certificat client (ou chaîne **base64** d’un PEM). |
| `PATIENT_MAPPING_UPSTREAM_CLIENT_KEY` | Si mTLS | PEM de la clé privée (ou base64). |
| `PATIENT_MAPPING_UPSTREAM_CA` | Non | CA pour valider le serveur HDS (PEM ou base64), si besoin. |

Configurer ces variables dans **Vercel → Project → Settings → Environment Variables** (Production / Preview), puis redéployer.

## Format JSON : navigateur → proxy (`POST /api/patient-mapping`)

Corps attendu (champs validés côté proxy) :

```json
{
  "caseCode": "CASE-00001",
  "caseId": "abc12xyz9",
  "ipp": "12345678",
  "lastName": "Dupont",
  "firstName": "Jean"
}
```

- `caseCode`, `caseId`, `ipp` : **requis** (chaînes non vides après trim).
- `lastName`, `firstName` : optionnels.

En-têtes côté navigateur (si jeton d’entrée configuré) :

- `Authorization: Bearer <jeton>` (le même que `PATIENT_MAPPING_INBOUND_SECRET` côté serveur, saisi une fois par session dans Réglages).

## Format JSON : proxy → votre API HDS (`POST` sur `PATIENT_MAPPING_UPSTREAM_URL`)

Le proxy renvoie **le même corps** (plus le `Authorization: Bearer` upstream si `PATIENT_MAPPING_UPSTREAM_KEY` est défini). Votre endpoint doit accepter ce JSON et répondre `2xx` en cas de succès.

Exemple minimal **Node / Express** :

```js
app.post('/radio-archive/mapping', express.json(), async (req, res) => {
  const { caseCode, caseId, ipp, lastName, firstName } = req.body;
  // Persistance en base (HDS) — ne pas logger ipp/nom en clair en prod sans cadre
  await db.insertMapping({ caseCode, caseId, ipp, lastName, firstName, createdAt: new Date() });
  res.sendStatus(204);
});
```

## Exemple de table SQL (référence)

```sql
CREATE TABLE patient_case_mapping (
  id            BIGSERIAL PRIMARY KEY,
  case_code     VARCHAR(32) NOT NULL,
  case_id       VARCHAR(64) NOT NULL,
  ipp           VARCHAR(64) NOT NULL,
  last_name     VARCHAR(255),
  first_name    VARCHAR(255),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (case_code)
);
CREATE INDEX idx_mapping_ipp ON patient_case_mapping (ipp);
```

Adapter les types et contraintes selon votre politique de rétention et votre référentiel (RGPD, HDS).

## GET `/api/patient-mapping` (statut)

Réponse JSON :

```json
{
  "configured": true,
  "inboundAuthRequired": true,
  "mtlsUpstream": false
}
```

- `configured` : URL upstream renseignée.
- `inboundAuthRequired` : `PATIENT_MAPPING_INBOUND_SECRET` est défini.
- `mtlsUpstream` : mTLS activé vers l’HDS.

Aucune donnée patient dans cette réponse.

---

## Demande au SI (correspondance uniquement)

Le texte prêt à envoyer à l’ingénieur SI, **sans** aborder les comptes utilisateurs de l’application, est dans **`demande-si-correspondance.md`**.

En interne, vous configurez `PATIENT_MAPPING_UPSTREAM_URL`, `PATIENT_MAPPING_UPSTREAM_KEY` (si Bearer), et éventuellement les variables **mTLS** décrites plus haut.

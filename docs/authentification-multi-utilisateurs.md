# Authentification — un compte par utilisateur

## Mode multi-utilisateurs (recommandé dès que plusieurs personnes utilisent la plateforme)

1. Créez une base **PostgreSQL** (ex. [Neon](https://neon.tech), [Vercel Postgres](https://vercel.com/storage/postgres), ou serveur interne accessible depuis votre hébergement).

2. Dans le `.env` (ou variables Vercel), définissez :
   - **`DATABASE_URL`** : chaîne de connexion PostgreSQL (ex. `postgresql://user:pass@host/db?sslmode=require`).
   - **`AUTH_SESSION_SECRET`** : longue chaîne aléatoire (ex. `openssl rand -hex 32`).
   - **`ALLOW_PUBLIC_REGISTRATION=true`** — mode recommandé : chaque personne s’inscrit depuis l’écran de connexion (« Créer un compte », e-mail + mot de passe, min. 8 caractères). Ainsi chaque utilisateur a son propre identifiant sans intervention manuelle.

3. **Alternative** (si vous ne voulez pas d’inscription ouverte) : mettez `ALLOW_PUBLIC_REGISTRATION=false` ou laissez la variable absente, définissez **`AUTH_ADMIN_SECRET`**, et créez les comptes via l’API (secret connu uniquement du SI) :
   ```http
   POST /api/auth/admin/users
   Content-Type: application/json
   X-Admin-Secret: <AUTH_ADMIN_SECRET>

   { "email": "utilisateur@etablissement.fr", "password": "motDePasseRobuste" }
   ```
   Le mot de passe doit faire **au moins 8 caractères**.

4. Redéployez / redémarrez. La table `app_users` est créée automatiquement au premier usage.

## Mode mono-utilisateur (ancien comportement)

Sans **`DATABASE_URL`**, l’app utilise encore :

- **`AUTH_USERNAME`** (e-mail ou identifiant),
- **`AUTH_PASSWORD_BCRYPT_B64`** (voir `npm run hash-password`),
- **`AUTH_SESSION_SECRET`**.

Un seul couple identifiant / mot de passe pour toute l’instance.

## Générer un hash de mot de passe (mode mono-utilisateur)

```bash
npm run hash-password -- "VotreMotDePasse"
```

Copiez la ligne **`AUTH_PASSWORD_BCRYPT_B64`** dans le `.env`.

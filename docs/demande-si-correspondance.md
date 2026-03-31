# Demande au service SI — Table de correspondance CASE ↔ IPP (HDS)

Document **indépendant** de la connexion utilisateurs à l’application. À transmettre à l’ingénieur SI / responsable infrastructure pour brancher le **stockage** des correspondances sur votre périmètre **HDS**.

---

## Contexte fonctionnel

Une application web envoie, **à chaque création de cas** où un **IPP** (et éventuellement nom / prénom) est renseigné, une requête **`POST` HTTPS** vers une **URL d’API** que vous exposez sur le SI santé. Le corps est un JSON décrivant le lien entre la référence pédagogique (`CASE-xxxxx`) et l’identité patient côté établissement.

Les données sensibles **ne sont pas** stockées dans l’application ; elles transitent par un **proxy serveur** vers votre endpoint.

---

## Ce que nous demandons à l’équipe SI

1. **URL HTTPS** d’un endpoint REST (ex. `https://…/api/radio-archive/mapping`) joignable depuis notre hébergement (ex. sortie Internet contrôlée, liste d’IP autorisées si besoin — nous fournirons les **IP de sortie** de l’hébergeur si vous l’exigez).

2. **Authentification** de notre serveur vers votre API, par exemple :
   - en-tête **`Authorization: Bearer`** suivi d’un secret (configuré uniquement côté serveur de notre app), et/ou  
   - **mTLS** (certificat client émis par votre PKI, procédure à nous communiquer).

3. **Contrat d’interface** : acceptation d’un corps JSON `Content-Type: application/json` avec au minimum :
   - `caseCode` (ex. `CASE-00001`)
   - `caseId` (identifiant technique interne à l’app)
   - `ipp`
   - optionnellement `lastName`, `firstName`  

   Réponse attendue : code **2xx** si enregistrement OK.

4. **Persistance** : enregistrement dans une **table de correspondance** sur base gérée côté HDS. Nous recommandons un **UPSERT** sur `case_code` pour éviter les doublons si un même cas est renvoyé.

5. **Environnements** : si applicable, fournir une URL de **recette** et une URL de **production** avec les paramètres d’accès respectifs.

6. **Journalisation / RGPD** : préciser les règles de **rétention** et d’**accès** aux journaux côté serveur applicatif.

---

## Exemple de charge utile (référence)

```json
{
  "caseCode": "CASE-00001",
  "caseId": "abc12xyz9",
  "ipp": "12345678",
  "lastName": "Dupont",
  "firstName": "Jean"
}
```

---

## Mise à jour automatique

À **chaque enregistrement de cas avec IPP**, notre backend envoie **un POST** vers cette URL. Il n’y a pas de synchronisation temps réel dans l’autre sens : la table côté HDS est alimentée **à chaque envoi** (insert ou mise à jour selon votre modèle).

Pour le détail des variables côté déploiement, voir aussi `correspondance-hds.md` dans ce dépôt.

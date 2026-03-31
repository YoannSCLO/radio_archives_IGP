/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Sous-chemin de déploiement (ex. `/radio-archive/`). Laisser vide pour la racine `/`. */
  readonly VITE_BASE_PATH?: string;
  // Les secrets patient / URL HDS se configurent côté serveur uniquement
  // (PATIENT_MAPPING_UPSTREAM_URL, etc.), jamais en VITE_*.
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

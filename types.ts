
export enum Specialty {
  NEURORADIOLOGY = 'Neuroradiologie',
  OSTEORADIOLOGY = 'Ostéo-articulaire',
  THORACIC = 'Thoracique',
  ABDOMINAL = 'Abdominale',
  PELVIC = 'Pelvienne',
  CARDIOVASCULAR = 'Cardiovasculaire',
  PEDIATRIC = 'Pédiatrique',
  EMERGENCY = 'Urgences',
  ORL = 'ORL',
  OPHTHALMOLOGY = 'Ophtalmologie',
  VASCULAR = 'Vasculaire',
  SENOLOGY = 'Sénologie',
  UROLOGY = 'Urologie',
  OTHER = 'Autre'
}

export enum Difficulty {
  BEGINNER = 'Débutant',
  INTERMEDIATE = 'Intermédiaire',
  ADVANCED = 'Avancé',
  EXPERT = 'Expert'
}

export enum Modality {
  MRI = 'IRM',
  CT = 'Scanner',
  XRAY = 'Radiographie',
  US = 'Échographie',
}

export interface ImageSeries {
  name: string;
  images: string[]; // Base64 or URLs
}

export interface RadioCase {
  id: string;
  /** Identifiant générique affiché, ex. CASE-00001 */
  caseCode: string;
  specialty: Specialty;
  difficulty: Difficulty;
  modality: Modality;
  clinicalNote: string;
  diagnosis: string;
  dateAdded: string;
  series: ImageSeries[];
  /** E-mail / login du créateur (si connexion active à la création). Sert à autoriser la modification par l’auteur uniquement. */
  authorEmail?: string;
  /** Dernière modification (édition par l’auteur). */
  lastModifiedAt?: string;
  /** Justification saisie lors de la dernière modification. */
  lastEditJustification?: string;
}

export interface SpecialtyConfig {
  label: Specialty;
  color: string; 
  bgColor: string; 
}

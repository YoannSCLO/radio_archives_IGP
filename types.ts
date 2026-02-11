
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
  patientId: string;
  lastName: string;
  firstName: string;
  specialty: Specialty;
  difficulty: Difficulty;
  modality: Modality;
  clinicalNote: string;
  diagnosis: string;
  dateAdded: string;
  series: ImageSeries[];
}

export interface SpecialtyConfig {
  label: Specialty;
  color: string; 
  bgColor: string; 
}

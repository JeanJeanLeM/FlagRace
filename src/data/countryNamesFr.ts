import { flagAlpha2ForIso3 } from './flagAlpha2ByIso3.ts';
import { EXTRA_COUNTRY_NAME_FR } from './worldRegions.generated.ts';

/** Noms courts en français pour les pays du puzzle Nord Afrique + leurres du dock + cartes monde. */
const COUNTRY_NAME_FR: Record<string, string> = {
  ...EXTRA_COUNTRY_NAME_FR,
  MAR: 'Maroc',
  ESH: 'Sahara occidental',
  DZA: 'Algérie',
  TUN: 'Tunisie',
  LBY: 'Libye',
  EGY: 'Égypte',
  MRT: 'Mauritanie',
  MLI: 'Mali',
  NER: 'Niger',
  TCD: 'Tchad',
  SDN: 'Soudan',
  CPV: 'Cap-Vert',
  GMB: 'Gambie',
  GNB: 'Guinée-Bissau',
  STP: 'São Tomé-et-Príncipe',
  COM: 'Comores',
  DJI: 'Djibouti',
  MUS: 'Maurice',
  SYC: 'Seychelles',
  SWZ: 'Eswatini',
  LSO: 'Lesotho',
  RWA: 'Rwanda',
  BDI: 'Burundi',
  GNQ: 'Guinée équatoriale',
  MCO: 'Monaco',
  VAT: 'Vatican',
  SMR: 'Saint-Marin',
  LIE: 'Liechtenstein',
  SEN: 'Sénégal',
  BFA: 'Burkina Faso',
  GIN: 'Guinée',
  GHA: 'Ghana',
  CIV: "Côte d'Ivoire",
  NGA: 'Nigeria',
  CMR: 'Cameroun',
  CAF: 'République centrafricaine',
  SSD: 'Soudan du Sud',
  SDS: 'Soudan du Sud',
  ERI: 'Érythrée',
  ETH: 'Éthiopie',
  SOM: 'Somalie',
  SOL: 'Somaliland',
  COG: 'Congo',
  GAB: 'Gabon',
  ESP: 'Espagne',
  ITA: 'Italie',
  FRA: 'France',
  TUR: 'Turquie',
  SYR: 'Syrie',
  IRQ: 'Irak',
  YEM: 'Yémen',
  ARE: 'Émirats arabes unis',
  JOR: 'Jordanie',
  PSE: 'Palestine',
  ROU: 'Roumanie',
  IRL: 'Irlande',
  POL: 'Pologne',
  IDN: 'Indonésie',
};

export function countryNameFr(iso3: string): string {
  return COUNTRY_NAME_FR[iso3] ?? iso3;
}

/** Drapeau en emoji (indicateurs régionaux Unicode) si alpha-2 connu. */
export function flagEmojiFromIso3(iso3: string): string {
  const a2 = flagAlpha2ForIso3(iso3);
  if (!a2 || a2.length !== 2) return '';
  const u = a2.toUpperCase();
  const base = 0x1f1e6;
  return String.fromCodePoint(base + u.charCodeAt(0) - 0x41, base + u.charCodeAt(1) - 0x41);
}

import { EXTRA_FLAG_ALPHA2_BY_ISO3 } from './worldRegions.generated.ts';

/** ISO 3166-1 alpha-2 pour les drapeaux (ex. flagcdn.com). */
export const FLAG_ALPHA2_BY_ISO3: Record<string, string> = {
  MAR: 'ma',
  ESH: 'eh',
  DZA: 'dz',
  TUN: 'tn',
  LBY: 'ly',
  EGY: 'eg',
  MRT: 'mr',
  MLI: 'ml',
  NER: 'ne',
  TCD: 'td',
  SDN: 'sd',
};

/**
 * Drapeaux « leurre » (hors carte Nord Afrique) pour les niveaux 2 et 3.
 * Voir `flagDecoys.ts` pour les listes utilisées.
 */
export const FLAG_DECOY_ALPHA2: Record<string, string> = {
  CPV: 'cv',
  GMB: 'gm',
  GNB: 'gw',
  STP: 'st',
  COM: 'km',
  DJI: 'dj',
  MUS: 'mu',
  SYC: 'sc',
  SWZ: 'sz',
  LSO: 'ls',
  RWA: 'rw',
  BDI: 'bi',
  GNQ: 'gq',
  SEN: 'sn',
  BFA: 'bf',
  GIN: 'gn',
  GHA: 'gh',
  CIV: 'ci',
  NGA: 'ng',
  CMR: 'cm',
  CAF: 'cf',
  SSD: 'ss',
  ERI: 'er',
  ETH: 'et',
  SOM: 'so',
  COG: 'cg',
  GAB: 'ga',
  ESP: 'es',
  ITA: 'it',
  FRA: 'fr',
  TUR: 'tr',
  SYR: 'sy',
  IRQ: 'iq',
  YEM: 'ye',
  ARE: 'ae',
  JOR: 'jo',
  PSE: 'ps',
  ROU: 'ro',
  IRL: 'ie',
  POL: 'pl',
  IDN: 'id',
  MCO: 'mc',
  VAT: 'va',
  SMR: 'sm',
  LIE: 'li',
};

/**
 * Natural Earth / jeux monde : codes ADM0_A3 non ISO ou absents de restcountries.
 * Doit être résolu avant EXTRA (généré) pour afficher un vrai drapeau flagcdn.
 */
const ISO3_FLAG_WORLD_PATCH: Record<string, string> = {
  /** Variante South Sudan utilisée dans certaines exports (SSD = ss). */
  SDS: 'ss',
  /** Somaliland n'a pas d'ISO alpha-2 propre ; repli visuel sur Somalie. */
  SOL: 'so',
  /** Souvent « Chypre Nord » / erreur de code → drapeau Chypre (même emplacement carte). */
  CYN: 'cy',
  /** British Indian Ocean Territory (ISO alpha-2 IO). */
  IOA: 'io',
  /** Cachemire / zone contestée dans les données NE — drapeau ONU comme neutre. */
  KAS: 'un',
  /** Variante Palestine dans certaines bases (PSE = ps). */
  PSX: 'ps',
  PSQ: 'ps',
};

const US_STATE_ISO3166_2 = /^US-([A-Z]{2})$/;

/**
 * Pour flagcdn : subdivisions ISO 3166-2 (ex. US-CA → `us-ca`).
 * Voir https://flagcdn.com — drapeaux des États US.
 */
function flagcdnRegionCodeForIso3(iso3: string): string | null {
  const m = US_STATE_ISO3166_2.exec(iso3);
  if (!m) return null;
  return `us-${m[1]!.toLowerCase()}`;
}

export function flagAlpha2ForIso3(iso3: string): string | null {
  return (
    flagcdnRegionCodeForIso3(iso3) ??
    FLAG_ALPHA2_BY_ISO3[iso3] ??
    FLAG_DECOY_ALPHA2[iso3] ??
    ISO3_FLAG_WORLD_PATCH[iso3] ??
    EXTRA_FLAG_ALPHA2_BY_ISO3[iso3] ??
    null
  );
}

export function flagImageUrl(iso3: string, width = 160): string | null {
  const a2 = flagAlpha2ForIso3(iso3);
  if (!a2) return null;
  return `https://flagcdn.com/w${width}/${a2}.png`;
}

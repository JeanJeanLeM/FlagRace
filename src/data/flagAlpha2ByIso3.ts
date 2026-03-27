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

export function flagAlpha2ForIso3(iso3: string): string | null {
  return (
    FLAG_ALPHA2_BY_ISO3[iso3] ??
    FLAG_DECOY_ALPHA2[iso3] ??
    EXTRA_FLAG_ALPHA2_BY_ISO3[iso3] ??
    null
  );
}

export function flagImageUrl(iso3: string, width = 160): string | null {
  const a2 = flagAlpha2ForIso3(iso3);
  if (!a2) return null;
  return `https://flagcdn.com/w${width}/${a2}.png`;
}

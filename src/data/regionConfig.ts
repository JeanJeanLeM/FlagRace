/**
 * Multi-régions : une seule liste (`REGION_CATALOG`) pour le menu et la config jeu.
 *
 * Cartes continentales : `npm run build:geo:world` régénère GeoJSON + `worldRegions.generated.ts`.
 * Couleurs tuiles : `COUNTRY_COLORS` pour Nord Afrique ; sinon teinte dérivée du code (`geoBuild.tileColorForId`).
 */

import {
  ASIA_COUNTRY_IDS,
  EUROPE_COUNTRY_IDS,
  FR_DEPARTMENT_IDS,
  SOUTH_AMERICA_COUNTRY_IDS,
  USA_STATE_IDS,
} from './worldRegions.generated.ts';

export const COUNTRY_COLORS: Record<string, string> = {
  MAR: '#E8C87A',
  ESH: '#D8B868',
  MRT: '#C8906A',
  DZA: '#7EC890',
  TUN: '#F0D890',
  LBY: '#90C8D0',
  EGY: '#F0A870',
  MLI: '#A8C080',
  NER: '#D8C060',
  TCD: '#B88880',
  SDN: '#98B8A0',
};

export interface RegionConfig {
  id: string;
  label: string;
  geojsonUrl: string;
  countries: string[];
  /** false pour départements / États (pas de drapeau ISO au dock). */
  supportsFlags: boolean;
}

/** Entrée menu + optionnellement données de partie (si `available`). */
export type RegionCatalogEntry =
  | {
      id: string;
      label: string;
      icon: string;
      descriptionLines: string[];
      available: true;
      geojsonUrl: string;
      countries: string[];
      /** défaut : true */
      supportsFlags?: boolean;
    }
  | {
      id: string;
      label: string;
      icon: string;
      descriptionLines: string[];
      available: false;
    };

export const REGION_CATALOG: readonly RegionCatalogEntry[] = [
  {
    id: 'north-africa',
    label: 'Nord Afrique',
    icon: '🌍',
    descriptionLines: ['Sahara · Sahel · Maghreb', '11 pays'],
    available: true,
    geojsonUrl: '/data/north-africa.geojson',
    countries: ['MAR', 'ESH', 'DZA', 'TUN', 'LBY', 'EGY', 'MRT', 'MLI', 'NER', 'TCD', 'SDN'],
  },
  {
    id: 'europe',
    label: 'Europe',
    icon: '🇪🇺',
    descriptionLines: [
      'Sans outre-mer (FR, UK, ES, NL, DK…) · Russie ouest des ~60°E + Kaliningrad',
      `${EUROPE_COUNTRY_IDS.length} pays`,
    ],
    available: true,
    geojsonUrl: '/data/europe.geojson',
    countries: [...EUROPE_COUNTRY_IDS],
  },
  {
    id: 'south-america',
    label: 'Amérique du Sud',
    icon: '🌎',
    descriptionLines: ['Hors Caraïbes et Amérique centrale', `${SOUTH_AMERICA_COUNTRY_IDS.length} pays`],
    available: true,
    geojsonUrl: '/data/south-america.geojson',
    countries: [...SOUTH_AMERICA_COUNTRY_IDS],
  },
  {
    id: 'asia',
    label: 'Asie',
    icon: '🌏',
    descriptionLines: ['Continent asiatique (Natural Earth)', `${ASIA_COUNTRY_IDS.length} pays`],
    available: true,
    geojsonUrl: '/data/asia.geojson',
    countries: [...ASIA_COUNTRY_IDS],
  },
  {
    id: 'fr-departments',
    label: 'France · départements',
    icon: '🇫🇷',
    descriptionLines: ['Métropole uniquement (hors DROM-COM)', `${FR_DEPARTMENT_IDS.length} départements`],
    available: true,
    geojsonUrl: '/data/fr-departments.geojson',
    countries: [...FR_DEPARTMENT_IDS],
    supportsFlags: false,
  },
  {
    id: 'usa-states',
    label: 'États-Unis · États',
    icon: '🇺🇸',
    descriptionLines: ['48 États contigus (hors AK, HI, D.C.)', `${USA_STATE_IDS.length} États`],
    available: true,
    geojsonUrl: '/data/usa-states.geojson',
    countries: [...USA_STATE_IDS],
    supportsFlags: false,
  },
  {
    id: 'africa',
    label: 'Afrique',
    icon: '🌍',
    descriptionLines: ['Bientôt disponible'],
    available: false,
  },
];

/** Régions réellement jouables — chargement GeoJSON au démarrage de partie uniquement. */
export const REGIONS: RegionConfig[] = REGION_CATALOG.filter(
  (e): e is Extract<RegionCatalogEntry, { available: true }> => e.available,
).map((e) => ({
  id: e.id,
  label: e.label,
  geojsonUrl: e.geojsonUrl,
  countries: e.countries,
  supportsFlags: e.supportsFlags !== false,
}));

export function getDefaultRegionId(): string {
  const first = REGION_CATALOG.find((e) => e.available);
  return first?.id ?? 'north-africa';
}

export function regionSupportsFlags(regionId: string): boolean {
  const r = REGIONS.find((x) => x.id === regionId);
  return r?.supportsFlags ?? true;
}

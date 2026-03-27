/**
 * Multi-régions : une seule liste (`REGION_CATALOG`) pour le menu et la config jeu.
 *
 * Cartes continentales : `npm run build:geo:world` régénère GeoJSON + `worldRegions.generated.ts`.
 * Couleurs tuiles : `COUNTRY_COLORS` pour quelques pays (ex. Maghreb) ; sinon `geoBuild.tileColorForId`.
 */

import {
  AFRICA_COUNTRY_IDS,
  ASIA_COUNTRY_IDS,
  EUROPE_COUNTRY_IDS,
  FR_DEPARTMENT_IDS,
  NORTH_CENTRAL_AMERICA_COUNTRY_IDS,
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
      /** false : carte « fine » sous la carte monde (départements, États). */
      showOnWorldMap?: boolean;
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
    id: 'north-central-america',
    label: 'Amérique du N. & centrale',
    icon: '🌎',
    descriptionLines: [
      'USA, Canada, Mexique, isthme, Caraïbes (Natural Earth · hors Groenland)',
      `${NORTH_CENTRAL_AMERICA_COUNTRY_IDS.length} pays`,
    ],
    available: true,
    geojsonUrl: '/data/north-central-america.geojson',
    countries: [...NORTH_CENTRAL_AMERICA_COUNTRY_IDS],
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
    id: 'africa',
    label: 'Afrique',
    icon: '🌍',
    descriptionLines: ['Continent africain (Natural Earth)', `${AFRICA_COUNTRY_IDS.length} pays`],
    available: true,
    geojsonUrl: '/data/africa.geojson',
    countries: [...AFRICA_COUNTRY_IDS],
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
    id: 'france',
    label: 'France',
    icon: '🇫🇷',
    descriptionLines: ['Pays unique · métropole (hors outre-mer)', '1 pays'],
    available: true,
    geojsonUrl: '/data/france-country.geojson',
    countries: ['FRA'],
  },
  {
    id: 'usa',
    label: 'États-Unis',
    icon: '🇺🇸',
    descriptionLines: ['Pays unique · silhouette complète', '1 pays'],
    available: true,
    geojsonUrl: '/data/usa-country.geojson',
    countries: ['USA'],
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
    showOnWorldMap: false,
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
    showOnWorldMap: false,
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
  for (const e of REGION_CATALOG) {
    if (e.available && e.showOnWorldMap !== false) return e.id;
  }
  return 'europe';
}

export function regionSupportsFlags(regionId: string): boolean {
  const r = REGIONS.find((x) => x.id === regionId);
  return r?.supportsFlags ?? true;
}

export function catalogEntryForRegionId(regionId: string): RegionCatalogEntry | undefined {
  return REGION_CATALOG.find((e) => e.id === regionId);
}

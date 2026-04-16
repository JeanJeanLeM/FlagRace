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
  NORTH_CENTRAL_AMERICA_COUNTRY_IDS,
  SOUTH_AMERICA_COUNTRY_IDS,
} from './worldRegions.generated.ts';

const LEGACY_REGION_ID_ALIASES: Record<string, string> = {};

export function resolveRegionId(regionId: string): string {
  return LEGACY_REGION_ID_ALIASES[regionId] ?? regionId;
}

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

/**
 * Limite le cadre lon/lat utilisé pour calculer l’échelle de la carte (tuiles + projection).
 * Les sommets sont clampés avant min/max : ex. `maxLat` ignore le Svalbard pour zoomer sur l’Europe continentale.
 */
export type MapViewBBoxClamp = {
  minLon?: number;
  maxLon?: number;
  minLat?: number;
  maxLat?: number;
};

export interface RegionConfig {
  id: string;
  label: string;
  geojsonUrl: string;
  countries: string[];
  /** Optionnel : cadrage carte (puzzle, drapeaux, capitales, noms). */
  mapViewBBoxClamp?: MapViewBBoxClamp;
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
      showOnWorldMap?: boolean;
      mapViewBBoxClamp?: MapViewBBoxClamp;
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
    /** ~72°N : exclut Svalbard / extrême nord du bbox de vue (carte plus zoomée). */
    mapViewBBoxClamp: { maxLat: 72 },
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
];

/** Régions réellement jouables — chargement GeoJSON au démarrage de partie uniquement. */
export const REGIONS: RegionConfig[] = REGION_CATALOG.filter(
  (e): e is Extract<RegionCatalogEntry, { available: true }> => e.available,
).map((e) => ({
  id: e.id,
  label: e.label,
  geojsonUrl: e.geojsonUrl,
  countries: e.countries,
  mapViewBBoxClamp: e.mapViewBBoxClamp,
}));

export function getDefaultRegionId(): string {
  for (const e of REGION_CATALOG) {
    if (e.available && e.showOnWorldMap !== false) return e.id;
  }
  return 'europe';
}

export function catalogEntryForRegionId(regionId: string): RegionCatalogEntry | undefined {
  const id = resolveRegionId(regionId);
  return REGION_CATALOG.find((e) => e.id === id);
}

/**
 * Multi-régions : une seule liste (`REGION_CATALOG`) pour le menu et la config jeu.
 *
 * Ajouter une carte jouable :
 * 1. Placer le GeoJSON dans `public/data/`.
 * 2. Ajouter une entrée `available: true` avec `countries`, couleurs dans `COUNTRY_COLORS`, données capitales/drapeaux si besoin.
 *
 * Carte « bientôt » : `available: false` (pas de GeoJSON chargé tant que ce n’est pas activé).
 */

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
}

/** Entrée menu + optionnellement données de partie (si `available`). */
export type RegionCatalogEntry =
  | {
      id: string;
      label: string;
      icon: string;
      /** Sous-titres sous le titre (une ligne = un segment, séparés par <br> au rendu). */
      descriptionLines: string[];
      available: true;
      geojsonUrl: string;
      countries: string[];
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
    id: 'africa',
    label: 'Afrique',
    icon: '🌍',
    descriptionLines: ['Bientôt disponible'],
    available: false,
  },
  {
    id: 'europe',
    label: 'Europe',
    icon: '🌍',
    descriptionLines: ['Bientôt disponible'],
    available: false,
  },
  {
    id: 'asia',
    label: 'Asie',
    icon: '🌏',
    descriptionLines: ['Bientôt disponible'],
    available: false,
  },
];

/** Régions réellement jouables — utilisé par les 4 modes (chargement GeoJSON au démarrage de partie uniquement). */
export const REGIONS: RegionConfig[] = REGION_CATALOG.filter(
  (e): e is Extract<RegionCatalogEntry, { available: true }> => e.available,
).map((e) => ({
  id: e.id,
  label: e.label,
  geojsonUrl: e.geojsonUrl,
  countries: e.countries,
}));

export function getDefaultRegionId(): string {
  const first = REGION_CATALOG.find((e) => e.available);
  return first?.id ?? 'north-africa';
}

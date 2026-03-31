import { catalogEntryForRegionId, type RegionCatalogEntry } from '../data/regionConfig.ts';
import type { Locale } from './locale.ts';
import { REGION_CATALOG_EN } from './regionEn.ts';

function countSuffix(entry: RegionCatalogEntry, n: number): string {
  if (entry.id === 'fr-departments') {
    return n === 1 ? '1 department' : `${n} departments`;
  }
  if (entry.id === 'usa-states') {
    return n === 1 ? '1 state' : `${n} states`;
  }
  return n === 1 ? '1 country' : `${n} countries`;
}

/** Libellé menu pour une entrée catalogue (FR source de vérité, EN via `REGION_CATALOG_EN`). */
export function catalogEntryLabel(entry: RegionCatalogEntry, locale: Locale): string {
  if (locale === 'en') {
    const en = REGION_CATALOG_EN[entry.id];
    if (en) return en.label;
  }
  return entry.label;
}

/** Lignes de description (aria, tooltips) avec compte aligné sur `entry.countries` / métadonnées catalogue. */
export function catalogEntryDescriptionLines(entry: RegionCatalogEntry, locale: Locale): string[] {
  if (locale === 'fr') return [...entry.descriptionLines];

  const en = REGION_CATALOG_EN[entry.id];
  if (!en) return [...entry.descriptionLines];

  const countLine =
    'countries' in entry && entry.available ? countSuffix(entry, entry.countries.length) : '';

  if (countLine) {
    return [en.descriptionLines[0] ?? '', countLine].filter(Boolean);
  }
  return [...en.descriptionLines];
}

export function regionLabelForPlay(regionId: string, locale: Locale): string {
  const entry = catalogEntryForRegionId(regionId);
  if (!entry) return regionId;
  return catalogEntryLabel(entry, locale);
}

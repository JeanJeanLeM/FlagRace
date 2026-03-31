import type { Locale } from '../i18n/locale.ts';
import { flagAlpha2ForIso3 } from './flagAlpha2ByIso3.ts';
import { countryNameFr } from './countryNamesFr.ts';

let enRegionNames: Intl.DisplayNames | null = null;

function englishNameFromAlpha2(alpha2: string): string | null {
  try {
    enRegionNames ??= new Intl.DisplayNames('en', { type: 'region' });
    const u = alpha2.toUpperCase();
    const name = enRegionNames.of(u);
    return name && name !== u ? name : null;
  } catch {
    return null;
  }
}

/** Nom affiché pays / territoire selon la langue UI (FR : jeu existant ; EN : `Intl` + repli). */
export function countryDisplayName(iso3: string, locale: Locale): string {
  if (locale === 'fr') return countryNameFr(iso3);
  const a2 = flagAlpha2ForIso3(iso3);
  if (a2) {
    const n = englishNameFromAlpha2(a2);
    if (n) return n;
  }
  return countryNameFr(iso3);
}

export function countryDisplayCollatorLocale(locale: Locale): string {
  return locale === 'en' ? 'en' : 'fr';
}

type FlagDockDifficulty = 1 | 2 | 3;

/** Micro / petits États absents de la carte Nord Afrique (niveau 2). */
export const POCKET_DECOYS_ISO3: readonly string[] = [
  'CPV',
  'GMB',
  'GNB',
  'STP',
  'COM',
  'DJI',
  'MUS',
  'SYC',
  'SWZ',
  'LSO',
  'RWA',
  'BDI',
  'GNQ',
  'MCO',
  'VAT',
  'SMR',
  'LIE',
];

/**
 * Voisins, confusion visuelle classique, « faux » crédibles (niveau 3).
 * Ex. Roumanie vs Tchad, pays méditerranéens, pan-arabes, voisins sahéliens.
 */
export const HARD_DECOYS_ISO3: readonly string[] = [
  'SEN',
  'BFA',
  'GIN',
  'GHA',
  'CIV',
  'NGA',
  'CMR',
  'CAF',
  'SSD',
  'ERI',
  'ETH',
  'SOM',
  'COG',
  'GAB',
  'ESP',
  'ITA',
  'FRA',
  'TUR',
  'SYR',
  'IRQ',
  'YEM',
  'ARE',
  'JOR',
  'PSE',
  'ROU',
  'IRL',
  'POL',
  'IDN',
];

const LEVEL2_EXTRA = 8;
const LEVEL3_POCKET_EXTRA = 5;
const LEVEL3_HARD_EXTRA = 9;

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
}

function takeUniqueRandom(pool: readonly string[], n: number, exclude: Set<string>): string[] {
  const avail = pool.filter((iso) => !exclude.has(iso));
  shuffleInPlace(avail);
  return avail.slice(0, Math.min(n, avail.length));
}

/**
 * Liste complète des drapeaux dans le dock (bons pays + leurres selon le niveau).
 */
export function buildFlagDockIso3List(
  mapCountries: string[],
  difficulty: FlagDockDifficulty,
): string[] {
  const onMap = new Set(mapCountries);
  const base = [...mapCountries];

  if (difficulty === 1) {
    shuffleInPlace(base);
    return base;
  }

  if (difficulty === 2) {
    const decoys = takeUniqueRandom(POCKET_DECOYS_ISO3, LEVEL2_EXTRA, onMap);
    const merged = [...base, ...decoys];
    shuffleInPlace(merged);
    return merged;
  }

  const decoySet = new Set<string>(onMap);
  const pocket = takeUniqueRandom(POCKET_DECOYS_ISO3, LEVEL3_POCKET_EXTRA, decoySet);
  pocket.forEach((d) => decoySet.add(d));
  const hard = takeUniqueRandom(HARD_DECOYS_ISO3, LEVEL3_HARD_EXTRA, decoySet);

  const merged = [...base, ...pocket, ...hard];
  shuffleInPlace(merged);
  return merged;
}

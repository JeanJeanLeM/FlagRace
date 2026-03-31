import type { GameTypeId } from '../gameModes.ts';
import type { Locale } from './locale.ts';
import { pickUiString } from './uiStrings.ts';

const GAME_TYPE_KEY: Record<GameTypeId, string> = {
  'puzzle-country': 'gameType.puzzle.name',
  'capitals-map': 'gameType.capitals.name',
  'flag-match': 'gameType.flags.name',
  'country-labels-map': 'gameType.labels.name',
};

export function gameTypeMenuLabel(id: GameTypeId, locale: Locale): string {
  return pickUiString(GAME_TYPE_KEY[id], locale);
}

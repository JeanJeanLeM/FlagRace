/** Identifiants des modes de jeu (menu principal). */
export type GameTypeId =
  | 'puzzle-country'
  | 'capitals-map'
  | 'flag-match'
  | 'country-labels-map';

export const DEFAULT_GAME_TYPE: GameTypeId = 'puzzle-country';

export const GAME_TYPE_LABELS: Record<GameTypeId, string> = {
  'puzzle-country': 'Puzzle pays',
  'capitals-map': 'Capitales',
  'flag-match': 'Drapeaux',
  'country-labels-map': 'Noms sur la carte',
};

/** Identifiants des modes de jeu (menu principal). */
export type GameTypeId =
  | 'puzzle-country'
  | 'capitals-map'
  | 'flag-match'
  | 'country-labels-map';

export const DEFAULT_GAME_TYPE: GameTypeId = 'puzzle-country';

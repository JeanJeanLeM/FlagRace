/** Options d’affichage et d’interaction, dérivées du mode de jeu (facile / moyen / expert). */
export interface GameDisplayOptions {
  showCountryLabels: boolean;
  /** Si true : une seule teinte pour toutes les tuiles (plus les couleurs par pays). */
  uniformTileColor: boolean;
  showConnectorDots: boolean;
  /** Si true : bordure verte lorsque la tuile est au nord (sinon contour neutre pour toutes). */
  showOrientationBorder: boolean;
  /** Si true : double-clic sur une tuile (ou groupe en drag) remet le nord en haut. */
  doubleClickSnapNorth: boolean;
}

export const DEFAULT_DISPLAY_OPTIONS: GameDisplayOptions = {
  showCountryLabels: true,
  uniformTileColor: false,
  showConnectorDots: true,
  showOrientationBorder: true,
  doubleClickSnapNorth: true,
};

/** Remplissage des tuiles en mode « couleur unique » (contraste avec l’océan). */
export const UNIFORM_TILE_FILL = '#6b7f94';

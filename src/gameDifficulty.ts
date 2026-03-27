import type { GameDisplayOptions } from './displayOptions.ts';
import { DEFAULT_DISPLAY_OPTIONS } from './displayOptions.ts';

export type GameDifficulty = 'easy' | 'medium' | 'expert';

const STORAGE_KEY = 'worldpuzzle-game-difficulty';

/** Facile : toutes les aides. Moyen : noms + double-clic uniquement. Expert : tout désactivé. */
export const GAME_DIFFICULTY_PRESETS: Record<GameDifficulty, GameDisplayOptions> = {
  easy: {
    showCountryLabels: true,
    uniformTileColor: false,
    showConnectorDots: true,
    showOrientationBorder: true,
    doubleClickSnapNorth: true,
  },
  medium: {
    showCountryLabels: true,
    uniformTileColor: false,
    showConnectorDots: false,
    showOrientationBorder: false,
    doubleClickSnapNorth: true,
  },
  expert: {
    showCountryLabels: false,
    uniformTileColor: true,
    showConnectorDots: false,
    showOrientationBorder: false,
    doubleClickSnapNorth: false,
  },
};

export const DEFAULT_GAME_DIFFICULTY: GameDifficulty = 'easy';

export function isGameDifficulty(v: string): v is GameDifficulty {
  return v === 'easy' || v === 'medium' || v === 'expert';
}

export function loadSavedGameDifficulty(): GameDifficulty {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && isGameDifficulty(raw)) return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_GAME_DIFFICULTY;
}

export function saveGameDifficulty(d: GameDifficulty): void {
  try {
    localStorage.setItem(STORAGE_KEY, d);
  } catch {
    /* ignore */
  }
}

export function getDisplayOptionsForDifficulty(d: GameDifficulty): GameDisplayOptions {
  return { ...GAME_DIFFICULTY_PRESETS[d] };
}

const PUZZLE_DIFFICULTY_PANEL = '#puzzle-difficulty-only';

/** Options pour la partie en cours = mode sélectionné sur le menu (puzzle pays uniquement). */
export function getDisplayOptionsFromMenuSelection(): GameDisplayOptions {
  const active = document.querySelector<HTMLElement>(
    `${PUZZLE_DIFFICULTY_PANEL} .difficulty-card.active`,
  );
  const d = active?.dataset['difficulty'];
  if (d && isGameDifficulty(d)) return getDisplayOptionsForDifficulty(d);
  return { ...DEFAULT_DISPLAY_OPTIONS };
}

function setActiveDifficultyCard(d: GameDifficulty): void {
  document.querySelectorAll<HTMLElement>(`${PUZZLE_DIFFICULTY_PANEL} .difficulty-card[data-difficulty]`).forEach((el) => {
    const isSel = el.dataset['difficulty'] === d;
    el.classList.toggle('active', isSel);
    el.setAttribute('aria-checked', isSel ? 'true' : 'false');
  });
}

export function syncDifficultyMenuFromStorage(): void {
  setActiveDifficultyCard(loadSavedGameDifficulty());
}

export function initDifficultyMenu(): void {
  syncDifficultyMenuFromStorage();
  document.querySelectorAll<HTMLButtonElement>(`${PUZZLE_DIFFICULTY_PANEL} .difficulty-card[data-difficulty]`).forEach((btn) => {
    btn.addEventListener('click', () => {
      const d = btn.dataset['difficulty'];
      if (!d || !isGameDifficulty(d)) return;
      saveGameDifficulty(d);
      setActiveDifficultyCard(d);
    });
  });
}

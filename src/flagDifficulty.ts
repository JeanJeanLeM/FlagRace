/** Niveau de difficulté du dock (mode drapeaux). */
export type FlagDockDifficulty = 1 | 2 | 3;

const STORAGE_KEY = 'worldpuzzle-flag-difficulty';

export const DEFAULT_FLAG_DIFFICULTY: FlagDockDifficulty = 1;

export function isFlagDockDifficulty(v: string): v is '1' | '2' | '3' {
  return v === '1' || v === '2' || v === '3';
}

export function loadSavedFlagDifficulty(): FlagDockDifficulty {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && isFlagDockDifficulty(raw)) return Number(raw) as FlagDockDifficulty;
  } catch {
    /* ignore */
  }
  return DEFAULT_FLAG_DIFFICULTY;
}

export function saveFlagDifficulty(d: FlagDockDifficulty): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(d));
  } catch {
    /* ignore */
  }
}

export function getFlagDifficultyFromMenu(): FlagDockDifficulty {
  const active = document.querySelector<HTMLElement>('.flag-difficulty-card.active');
  const raw = active?.dataset['flagDifficulty'];
  if (raw && isFlagDockDifficulty(raw)) return Number(raw) as FlagDockDifficulty;
  return DEFAULT_FLAG_DIFFICULTY;
}

function setActiveFlagDifficultyCard(d: FlagDockDifficulty): void {
  document.querySelectorAll<HTMLElement>('.flag-difficulty-card').forEach((el) => {
    const isSel = el.dataset['flagDifficulty'] === String(d);
    el.classList.toggle('active', isSel);
    el.setAttribute('aria-checked', isSel ? 'true' : 'false');
  });
}

export function syncFlagDifficultyMenuFromStorage(): void {
  setActiveFlagDifficultyCard(loadSavedFlagDifficulty());
}

export function initFlagDifficultyMenu(): void {
  syncFlagDifficultyMenuFromStorage();
  document.querySelectorAll<HTMLButtonElement>('.flag-difficulty-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      const raw = btn.dataset['flagDifficulty'];
      if (!raw || !isFlagDockDifficulty(raw)) return;
      const d = Number(raw) as FlagDockDifficulty;
      saveFlagDifficulty(d);
      setActiveFlagDifficultyCard(d);
    });
  });
}

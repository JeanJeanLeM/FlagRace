/** Niveaux du mode capitales (menu dédié). */
export type CapitalsDifficultyId = 'in-country' | 'near-capital' | 'expert-decoys';

const STORAGE_KEY = 'worldpuzzle-capitals-difficulty';

export const DEFAULT_CAPITALS_DIFFICULTY: CapitalsDifficultyId = 'near-capital';

export function isCapitalsDifficultyId(v: string): v is CapitalsDifficultyId {
  return v === 'in-country' || v === 'near-capital' || v === 'expert-decoys';
}

export function loadSavedCapitalsDifficulty(): CapitalsDifficultyId {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && isCapitalsDifficultyId(raw)) return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_CAPITALS_DIFFICULTY;
}

export function saveCapitalsDifficulty(d: CapitalsDifficultyId): void {
  try {
    localStorage.setItem(STORAGE_KEY, d);
  } catch {
    /* ignore */
  }
}

export function getCapitalsDifficultyFromMenuSelection(): CapitalsDifficultyId {
  const active = document.querySelector<HTMLElement>('.capitals-difficulty-card.active');
  const d = active?.dataset['capitalsDifficulty'];
  if (d && isCapitalsDifficultyId(d)) return d;
  return DEFAULT_CAPITALS_DIFFICULTY;
}

function setActiveCapitalsDifficultyCard(d: CapitalsDifficultyId): void {
  document.querySelectorAll<HTMLElement>('.capitals-difficulty-card').forEach((el) => {
    const isSel = el.dataset['capitalsDifficulty'] === d;
    el.classList.toggle('active', isSel);
    el.setAttribute('aria-checked', isSel ? 'true' : 'false');
  });
}

export function syncCapitalsDifficultyMenuFromStorage(): void {
  setActiveCapitalsDifficultyCard(loadSavedCapitalsDifficulty());
}

export function initCapitalsDifficultyMenu(): void {
  syncCapitalsDifficultyMenuFromStorage();
  document.querySelectorAll<HTMLButtonElement>('.capitals-difficulty-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      const d = btn.dataset['capitalsDifficulty'];
      if (!d || !isCapitalsDifficultyId(d)) return;
      saveCapitalsDifficulty(d);
      setActiveCapitalsDifficultyCard(d);
    });
  });
}

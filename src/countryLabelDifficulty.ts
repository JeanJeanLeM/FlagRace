/** Niveaux du mode « noms de pays sur la carte » (même logique de dock que les drapeaux). */
export type CountryLabelDifficulty = 1 | 2 | 3;

const STORAGE_KEY = 'worldpuzzle-country-label-difficulty';

export const DEFAULT_COUNTRY_LABEL_DIFFICULTY: CountryLabelDifficulty = 1;

export function isCountryLabelDifficulty(v: string): v is '1' | '2' | '3' {
  return v === '1' || v === '2' || v === '3';
}

export function loadSavedCountryLabelDifficulty(): CountryLabelDifficulty {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && isCountryLabelDifficulty(raw)) return Number(raw) as CountryLabelDifficulty;
  } catch {
    /* ignore */
  }
  return DEFAULT_COUNTRY_LABEL_DIFFICULTY;
}

export function saveCountryLabelDifficulty(d: CountryLabelDifficulty): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(d));
  } catch {
    /* ignore */
  }
}

export function getCountryLabelDifficultyFromMenu(): CountryLabelDifficulty {
  const active = document.querySelector<HTMLElement>('.country-label-difficulty-card.active');
  const raw = active?.dataset['countryLabelDifficulty'];
  if (raw && isCountryLabelDifficulty(raw)) return Number(raw) as CountryLabelDifficulty;
  return DEFAULT_COUNTRY_LABEL_DIFFICULTY;
}

function setActiveCountryLabelDifficultyCard(d: CountryLabelDifficulty): void {
  document.querySelectorAll<HTMLElement>('.country-label-difficulty-card').forEach((el) => {
    const isSel = el.dataset['countryLabelDifficulty'] === String(d);
    el.classList.toggle('active', isSel);
    el.setAttribute('aria-checked', isSel ? 'true' : 'false');
  });
}

export function syncCountryLabelDifficultyMenuFromStorage(): void {
  setActiveCountryLabelDifficultyCard(loadSavedCountryLabelDifficulty());
}

export function initCountryLabelDifficultyMenu(): void {
  syncCountryLabelDifficultyMenuFromStorage();
  document.querySelectorAll<HTMLButtonElement>('.country-label-difficulty-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      const raw = btn.dataset['countryLabelDifficulty'];
      if (!raw || !isCountryLabelDifficulty(raw)) return;
      const d = Number(raw) as CountryLabelDifficulty;
      saveCountryLabelDifficulty(d);
      setActiveCountryLabelDifficultyCard(d);
    });
  });
}

export type Locale = 'fr' | 'en';

const STORAGE_KEY = 'worldpuzzle-locale';

const listeners = new Set<() => void>();

function readStoredLocale(): Locale {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'en' || raw === 'fr') return raw;
  } catch {
    /* ignore */
  }
  return 'fr';
}

let current: Locale = readStoredLocale();

export function getLocale(): Locale {
  return current;
}

export function setLocale(next: Locale): void {
  if (next === current) return;
  current = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  document.documentElement.lang = next;
  for (const fn of listeners) fn();
}

export function subscribeLocale(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function initDocumentLang(): void {
  document.documentElement.lang = current;
}

/** Même pas que les jeux (Game, drapeaux, capitales…) pour rester cohérent avec +/- clavier. */
const VIEW_ZOOM_STEP = 1.12;

/** Layout jeu compact (mobile / tablette) — aligné sur les media queries CSS ≤900px. */
export function isCompactGameLayout(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 900px)').matches;
}

/**
 * Échelle caméra « vue d’ensemble » : sur mobile un cran de moins dézoomé que le bureau
 * (carte plus grande, moins de marge vide).
 */
export function defaultViewScale(): number {
  const outSteps = isCompactGameLayout() ? 1 : 2;
  return 1 / VIEW_ZOOM_STEP ** outSteps;
}

export function clampDockIndex(index: number, queueLength: number): number {
  if (queueLength <= 0) return 0;
  return Math.max(0, Math.min(index, queueLength - 1));
}

export function updateDockNavButtons(
  kind: 'flag' | 'capitals',
  compact: boolean,
  queueLength: number,
  activeIndex: number,
): void {
  const prevId = kind === 'flag' ? 'dock-nav-flag-prev' : 'dock-nav-capitals-prev';
  const nextId = kind === 'flag' ? 'dock-nav-flag-next' : 'dock-nav-capitals-next';
  const prev = document.getElementById(prevId);
  const next = document.getElementById(nextId);
  if (!(prev instanceof HTMLButtonElement) || !(next instanceof HTMLButtonElement)) return;
  if (!compact || queueLength <= 1) {
    prev.disabled = true;
    next.disabled = true;
    return;
  }
  prev.disabled = activeIndex <= 0;
  next.disabled = activeIndex >= queueLength - 1;
}

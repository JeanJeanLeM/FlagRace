/** Temps ajouté au chrono affiché (et au calcul du score) lors d’un abandon. */
export const ABANDON_CHRONO_EXTRA_MS = 60_000;

/** Pénalité fixe en points en plus de l’effet du temps supplémentaire. */
export const ABANDON_FLAT_SCORE_PENALTY = 1200;

export function abandonFrozenElapsedMs(gameStartMs: number): number {
  return performance.now() - gameStartMs + ABANDON_CHRONO_EXTRA_MS;
}

export function scoreAfterAbandonFlat(baseScore: number): number {
  return Math.max(0, baseScore - ABANDON_FLAT_SCORE_PENALTY);
}

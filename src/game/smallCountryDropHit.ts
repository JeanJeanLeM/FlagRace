import type { Tile } from './Tile.ts';

/** Micro-États / très petits pays : zone de drop élargie légèrement hors du polygone. */
const SMALL_COUNTRY_ISO3 = new Set<string>([
  'AND',
  'SMR',
  'LUX',
  'MCO',
  'MLT',
  'VAT',
  'LIE',
]);

/** Au-delà de cette taille (en coordonnées carte locales), on n’élargit pas automatiquement. */
const MAX_LOCAL_SPAN_FOR_AUTO_SMALL = 88;

const MIN_EXPAND_PAD = 11;
const MAX_EXPAND_PAD = 38;
const EXPAND_FRACTION = 0.4;

function localPolygonsBbox(polygons: [number, number][][][]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const rings of polygons) {
    for (const ring of rings) {
      for (const p of ring) {
        minX = Math.min(minX, p[0]);
        minY = Math.min(minY, p[1]);
        maxX = Math.max(maxX, p[0]);
        maxY = Math.max(maxY, p[1]);
      }
    }
  }
  if (!Number.isFinite(minX)) {
    return { minX: -1, minY: -1, maxX: 1, maxY: 1 };
  }
  return { minX, minY, maxX, maxY };
}

export function isSmallCountryDropTarget(tile: Tile): boolean {
  if (SMALL_COUNTRY_ISO3.has(tile.id)) return true;
  const b = localPolygonsBbox(tile.polygons);
  const w = b.maxX - b.minX;
  const h = b.maxY - b.minY;
  return Math.max(w, h) < MAX_LOCAL_SPAN_FOR_AUTO_SMALL;
}

/**
 * Comme `Tile.containsPoint`, avec une marge autour du rectangle englobant local
 * pour les très petits pays uniquement (drapeaux, capitales, noms).
 */
export function tileContainsPointWithDropHalo(tile: Tile, wx: number, wy: number): boolean {
  if (tile.containsPoint(wx, wy)) return true;
  if (!isSmallCountryDropTarget(tile)) return false;

  const b = localPolygonsBbox(tile.polygons);
  const bw = b.maxX - b.minX;
  const bh = b.maxY - b.minY;
  const pad = Math.min(
    MAX_EXPAND_PAD,
    Math.max(MIN_EXPAND_PAD, EXPAND_FRACTION * Math.max(bw, bh)),
  );

  const rad = -(tile.angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = wx - tile.x;
  const dy = wy - tile.y;
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;

  return (
    lx >= b.minX - pad &&
    lx <= b.maxX + pad &&
    ly >= b.minY - pad &&
    ly <= b.maxY + pad
  );
}

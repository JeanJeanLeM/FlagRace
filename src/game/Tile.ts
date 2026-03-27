export interface TileInit {
  id: string;
  name: string;
  color: string;
  /**
   * Multi-polygone : chaque élément est un polygone GeoJSON (anneaux),
   * [0] = contour extérieur, suivants = trous. Coordonnées locales au centroïde.
   */
  polygons: [number, number][][][];
  targetX: number;
  targetY: number;
}

export class Tile {
  id: string;
  name: string;
  color: string;
  polygons: [number, number][][][];
  targetX: number;
  targetY: number;
  x: number;
  y: number;
  angle: number;
  zIndex: number;

  constructor(init: TileInit) {
    this.id = init.id;
    this.name = init.name;
    this.color = init.color;
    this.polygons = init.polygons;
    this.targetX = init.targetX;
    this.targetY = init.targetY;
    this.x = init.targetX;
    this.y = init.targetY;
    this.angle = 0;
    this.zIndex = 0;
  }

  get isCorrectAngle(): boolean {
    const a = ((this.angle % 360) + 360) % 360;
    return a < 8 || a > 352;
  }

  isCorrectRelativeTo(other: Tile, threshold: number): boolean {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    const tdx = this.targetX - other.targetX;
    const tdy = this.targetY - other.targetY;
    return Math.hypot(dx - tdx, dy - tdy) < threshold;
  }

  containsPoint(wx: number, wy: number): boolean {
    const rad = -(this.angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = wx - this.x;
    const dy = wy - this.y;
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;
    return this.polygons.some((rings) => pointInPolygonWithHoles(lx, ly, rings));
  }

  rotate(degrees: number): void {
    this.angle = ((this.angle + degrees) % 360 + 360) % 360;
  }

  snapNorth(): void {
    this.angle = 0;
  }
}

/** Coordonnées locales (origine = centroïde cible) → monde, avec la rotation actuelle de la tuile. */
export function worldPointFromLocal(tile: Tile, lx: number, ly: number): [number, number] {
  const rad = (tile.angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [tile.x + lx * cos - ly * sin, tile.y + lx * sin + ly * cos];
}

function pointInRing(x: number, y: number, ring: [number, number][]): boolean {
  let inside = false;
  const n = ring.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInPolygonWithHoles(x: number, y: number, rings: [number, number][][]): boolean {
  const [outer, ...holes] = rings;
  if (!outer || outer.length < 3) return false;
  if (!pointInRing(x, y, outer)) return false;
  for (const h of holes) {
    if (h.length >= 3 && pointInRing(x, y, h)) return false;
  }
  return true;
}

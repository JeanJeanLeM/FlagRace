import type { Tile } from './Tile.ts';
import { worldPointFromLocal } from './Tile.ts';
import {
  DEFAULT_DISPLAY_OPTIONS,
  type GameDisplayOptions,
  UNIFORM_TILE_FILL,
} from '../displayOptions.ts';

/** Centre monde sous le centre du canvas + échelle (1 = défaut). */
export interface ViewCamera {
  cx: number;
  cy: number;
  scale: number;
}

export interface BorderConnectorRel {
  key: string;
  a: string;
  b: string;
  la: [number, number];
  lb: [number, number];
}

export interface CapitalMarkerDraw {
  x: number;
  y: number;
  label: string;
  /** `validated` = bonne position (vert) ; `draft` = mauvaise pose, épingle + nom sans cadre ni contour lourd */
  visual: 'validated' | 'draft';
  dragging: boolean;
  /**
   * Validé : `true` affiche le libellé ; `false` n’affiche que l’épingle (survol géré par le jeu).
   * Brouillon / drag : ignoré, le texte est toujours affiché.
   */
  showLabel?: boolean;
}

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private connectedPairs: Set<string> = new Set();
  private hoveredId: string | null = null;
  private draggedIds: Set<string> = new Set();
  private displayOptions: GameDisplayOptions = { ...DEFAULT_DISPLAY_OPTIONS };
  /** Tuiles avec drapeau collé (mode drapeaux) : remplissage image dans le polygone. */
  private tileFlags = new Map<string, CanvasImageSource>();
  /** Remplissage des pays sans drapeau (mode carte assemblée). */
  private assembledNeutralFill: string | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    this.ctx = ctx;
  }

  setConnectedPairs(pairs: Set<string>): void {
    this.connectedPairs = pairs;
  }

  setHovered(id: string | null): void {
    this.hoveredId = id;
  }

  /** Tuiles en cours de déplacement (groupe connecté). */
  setDraggedGroup(ids: Set<string> | null): void {
    this.draggedIds = ids ? new Set(ids) : new Set();
  }

  setDisplayOptions(opts: GameDisplayOptions): void {
    this.displayOptions = { ...opts };
  }

  clearTileFlags(): void {
    this.tileFlags.clear();
  }

  setTileFlag(tileId: string, image: CanvasImageSource | null): void {
    if (image === null) this.tileFlags.delete(tileId);
    else this.tileFlags.set(tileId, image);
  }

  /** Couleur de fond des pays sans drapeau ; `null` = logique puzzle habituelle. */
  setAssembledNeutralFill(hex: string | null): void {
    this.assembledNeutralFill = hex;
  }

  draw(
    tiles: Tile[],
    borderConnectors: BorderConnectorRel[],
    camera: ViewCamera,
    capitalMarkers?: CapitalMarkerDraw[],
  ): void {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.drawOcean();

    const sorted = [...tiles].sort((a, b) => a.zIndex - b.zIndex);
    const tileMap = new Map(sorted.map((t) => [t.id, t]));

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(camera.scale, camera.scale);
    ctx.translate(-camera.cx, -camera.cy);

    this.drawBorderConnectors(tileMap, borderConnectors, camera.scale);

    for (const tile of sorted) {
      if (!this.draggedIds.has(tile.id)) this.drawTile(tile, camera.scale);
    }

    for (const tile of sorted) {
      if (this.draggedIds.has(tile.id)) this.drawTile(tile, camera.scale);
    }

    if (capitalMarkers?.length) {
      const dragging = capitalMarkers.filter((m) => m.dragging);
      const rest = capitalMarkers.filter((m) => !m.dragging);
      for (const m of rest) this.drawCapitalMarker(m, camera.scale);
      for (const m of dragging) this.drawCapitalMarker(m, camera.scale);
    }

    ctx.restore();
  }

  private drawCapitalMarker(m: CapitalMarkerDraw, worldScale: number): void {
    const { ctx } = this;
    const inv = 1 / worldScale;
    const r = (m.visual === 'validated' ? 6.2 : 5.8) * inv;
    const pinY = m.y;

    const showText =
      m.dragging || m.visual === 'draft' || (m.visual === 'validated' && m.showLabel === true);

    ctx.save();
    ctx.translate(m.x, pinY);

    if (m.dragging) {
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = 10 * inv;
      ctx.shadowOffsetX = 3 * inv;
      ctx.shadowOffsetY = 3 * inv;
    }

    ctx.beginPath();
    ctx.moveTo(0, -r * 1.1);
    ctx.lineTo(r * 0.95, r * 0.35);
    ctx.lineTo(0, r * 1.15);
    ctx.lineTo(-r * 0.95, r * 0.35);
    ctx.closePath();

    if (m.visual === 'draft') {
      ctx.fillStyle = m.dragging ? 'rgba(255, 200, 115, 0.95)' : 'rgba(255, 165, 82, 0.92)';
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(0, 220, 140, 0.92)';
      ctx.strokeStyle = 'rgba(200, 255, 230, 0.95)';
      ctx.lineWidth = 1.35 * inv;
      ctx.fill();
      ctx.stroke();
    }

    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    if (!showText) {
      ctx.restore();
      return;
    }

    const fs = (m.visual === 'draft' ? 11.2 : 10.5) * inv;
    ctx.font = `700 ${fs}px system-ui, "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const labelY = -r * 1.42 - 4 * inv;

    if (m.visual === 'draft') {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
      ctx.shadowBlur = 4 * inv;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 1 * inv;
      ctx.fillStyle = 'rgba(255, 252, 245, 0.98)';
      ctx.fillText(m.label, 0, labelY);
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    } else {
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.lineWidth = 2.6 * inv;
      ctx.strokeStyle = 'rgba(255, 252, 248, 0.94)';
      ctx.strokeText(m.label, 0, labelY);
      ctx.fillStyle = 'rgba(14, 22, 34, 0.96)';
      ctx.fillText(m.label, 0, labelY);
    }

    ctx.restore();
  }

  private drawOcean(): void {
    const { ctx, canvas } = this;
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#0d2b45');
    grad.addColorStop(1, '#1a3a5c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    const step = 60;
    for (let x = 0; x < canvas.width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawTile(tile: Tile, worldScale: number): void {
    const { ctx } = this;
    if (!tile.polygons.length) return;

    const isDragged = this.draggedIds.has(tile.id);
    const isHovered = tile.id === this.hoveredId;
    const inv = 1 / worldScale;

    ctx.save();
    ctx.translate(tile.x, tile.y);
    ctx.rotate((tile.angle * Math.PI) / 180);

    if (isDragged) {
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = 18 * inv;
      ctx.shadowOffsetX = 5 * inv;
      ctx.shadowOffsetY = 5 * inv;
    }

    tracePolygonsPath(ctx, tile.polygons);

    const flagImg = this.tileFlags.get(tile.id);
    if (flagImg) {
      ctx.save();
      ctx.clip('evenodd');
      const b = localPolygonsBbox(tile.polygons);
      drawImageMapStretch(ctx, flagImg, b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY);
      ctx.restore();
    } else {
      const baseFill = this.assembledNeutralFill
        ? this.assembledNeutralFill
        : this.displayOptions.uniformTileColor
          ? UNIFORM_TILE_FILL
          : tile.color;
      let fill = baseFill;
      if (isHovered || isDragged) fill = lightenHex(baseFill, 22);
      ctx.fillStyle = fill;
      ctx.fill('evenodd');
    }

    tracePolygonsPath(ctx, tile.polygons);

    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    const oriented =
      this.displayOptions.showOrientationBorder && tile.isCorrectAngle;
    ctx.strokeStyle = oriented ? '#4acf7a' : 'rgba(255,255,255,0.32)';
    ctx.lineWidth = (isDragged ? 2.2 : 1.2) * inv;
    ctx.stroke();

    if (this.displayOptions.showCountryLabels) {
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      const fs = (isDragged ? 12 : 10) * inv;
      ctx.font = `bold ${fs}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tile.name, 0, 0);
    }

    ctx.restore();
  }

  private drawBorderConnectors(
    tileMap: Map<string, Tile>,
    borderConnectors: BorderConnectorRel[],
    worldScale: number,
  ): void {
    if (!this.displayOptions.showConnectorDots) return;
    const { ctx } = this;
    const inv = 1 / worldScale;
    for (const rel of borderConnectors) {
      if (!this.connectedPairs.has(rel.key)) continue;
      const ta = tileMap.get(rel.a);
      const tb = tileMap.get(rel.b);
      if (!ta || !tb) continue;

      const [ax, ay] = worldPointFromLocal(ta, rel.la[0], rel.la[1]);
      const [bx, by] = worldPointFromLocal(tb, rel.lb[0], rel.lb[1]);
      const mx = (ax + bx) / 2;
      const my = (ay + by) / 2;

      ctx.save();
      ctx.fillStyle = 'rgba(0, 255, 160, 0.95)';
      ctx.strokeStyle = 'rgba(180, 255, 220, 0.9)';
      ctx.lineWidth = 2 * inv;
      ctx.shadowColor = '#00ffaa';
      ctx.shadowBlur = 12 * inv;
      ctx.beginPath();
      ctx.arc(mx, my, 5 * inv, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

}

function tracePolygonsPath(
  ctx: CanvasRenderingContext2D,
  polygons: [number, number][][][],
): void {
  ctx.beginPath();
  for (const rings of polygons) {
    for (const ring of rings) {
      if (ring.length < 2) continue;
      ctx.moveTo(ring[0][0], ring[0][1]);
      for (let i = 1; i < ring.length; i++) {
        ctx.lineTo(ring[i][0], ring[i][1]);
      }
      ctx.closePath();
    }
  }
}

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

function drawImageMapStretch(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): void {
  ctx.drawImage(img, bx, by, bw, bh);
}

function lightenHex(hex: string, amount: number): string {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

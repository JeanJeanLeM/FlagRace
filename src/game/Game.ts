import { Tile, worldPointFromLocal } from './Tile.ts';
import type { BorderConnectorRel, ViewCamera } from './Renderer.ts';
import { Renderer } from './Renderer.ts';
import { DEFAULT_DISPLAY_OPTIONS, type GameDisplayOptions } from '../displayOptions.ts';
import type { MapViewBBoxClamp } from '../data/regionConfig.ts';
import { ADJACENCY as DEFAULT_ADJACENCY } from '../data/adjacency.ts';
import { adjacencyPairKey, buildMapTiles, type GeoFeatureCollection } from './geoBuild.ts';
import { abandonFrozenElapsedMs, scoreAfterAbandonFlat } from './abandon.ts';
import { bindCanvasPinchZoom } from './canvasPinchZoom.ts';
import { defaultViewScale } from './compactDock.ts';

/** Écart max entre points frontière pour compter une connexion (px monde). Plus strict = moins de faux positifs. */
const CONNECT_GAP_PX = 52;
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 3.5;
const ZOOM_STEP = 1.12;
/** Zone magnétique au relâchement : légèrement plus large que CONNECT_GAP pour attirer la tuile. */
const SNAP_RADIUS_PX = CONNECT_GAP_PX + 42;
/** Score : base + points par frontière connectée − pénalité temps (secondes). */
const SCORE_BASE = 2500;
const SCORE_PER_TOTAL_EDGE = 100;
const SCORE_PER_CONNECTED = 80;
const SCORE_TIME_PENALTY_PER_SEC = 12;

export interface GameHudState {
  connected: number;
  total: number;
  elapsedMs: number;
  score: number;
  isComplete: boolean;
  /** Résumé fin de partie (panneau HTML) ; null tant que le puzzle n’est pas résolu. */
  victorySummary: null | { timeLabel: string; score: number; gaveUp?: boolean };
}

export function computeGameScore(connected: number, total: number, elapsedSec: number): number {
  const base = SCORE_BASE + total * SCORE_PER_TOTAL_EDGE;
  const raw = base + connected * SCORE_PER_CONNECTED - elapsedSec * SCORE_TIME_PENALTY_PER_SEC;
  return Math.max(0, Math.floor(raw));
}

interface DragState {
  /** Tuile sous le curseur au clic (référence snap / molette). */
  primaryTile: Tile;
  /** Composante connexe des tuiles reliées (connecteurs verts) au moment du clic. */
  group: Tile[];
  startMouseX: number;
  startMouseY: number;
  origins: Map<string, { x: number; y: number }>;
}

/** Glisser depuis le vide : déplace la caméra (carte sous le curseur). */
interface CameraPanState {
  startSx: number;
  startSy: number;
  startCx: number;
  startCy: number;
  scale: number;
}

export class Game {
  private canvas: HTMLCanvasElement;
  private renderer: Renderer;
  private tiles: Tile[] = [];
  private borderConnectors: BorderConnectorRel[] = [];
  private connectorByKey: Map<string, BorderConnectorRel> = new Map();
  private dragState: DragState | null = null;
  private cameraPan: CameraPanState | null = null;
  private maxZIndex = 0;
  private animFrame: number | null = null;
  /** Puzzle entièrement connecté : affichage du panneau de fin. */
  private winPhase: 'none' | 'victory' = 'none';
  private gaveUp = false;
  /** Facteur pour seuils de collage / connexion après redimensionnement du canvas. */
  private distanceScale = 1;
  private onHudUpdate?: (state: GameHudState) => void;
  private gameStartMs: number | null = null;
  /** Temps figé à la victoire (tant que le puzzle reste résolu). */
  private frozenElapsedMs: number | null = null;
  private fc: GeoFeatureCollection | null = null;
  private countriesList: string[] = [];
  /** Frontières pour score / collage : GeoJSON `wp_adjacency` ou repli Nord Afrique. */
  private borderAdjacency: [string, string][] = DEFAULT_ADJACENCY;
  private mapViewBBoxClamp: MapViewBBoxClamp | undefined;
  private eventsBound = false;
  private unbindPinch: (() => void) | null = null;
  private camera: ViewCamera = { cx: 0, cy: 0, scale: defaultViewScale() };
  private displayOptions: GameDisplayOptions;

  constructor(
    canvas: HTMLCanvasElement,
    onHudUpdate?: (state: GameHudState) => void,
    displayOptions: GameDisplayOptions = { ...DEFAULT_DISPLAY_OPTIONS },
  ) {
    this.displayOptions = { ...displayOptions };
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.renderer.setDisplayOptions(this.displayOptions);
    this.onHudUpdate = onHudUpdate;
  }

  async load(geojsonUrl: string, countries: string[], mapViewBBoxClamp?: MapViewBBoxClamp): Promise<void> {
    const res = await fetch(geojsonUrl);
    const geojson = (await res.json()) as GeoFeatureCollection;
    this.fc = geojson;
    this.countriesList = countries;
    this.mapViewBBoxClamp = mapViewBBoxClamp;
    this.borderAdjacency =
      geojson.wp_adjacency && geojson.wp_adjacency.length > 0
        ? geojson.wp_adjacency
        : DEFAULT_ADJACENCY;
    this.buildTiles(geojson, countries);
    this.gameStartMs = performance.now();
    this.frozenElapsedMs = null;
    if (!this.eventsBound) {
      this.bindEvents();
      this.eventsBound = true;
    }
    this.startLoop();
  }

  /** Recalcul projection / tuiles après redimensionnement du canvas. */
  relayout(): void {
    if (this.fc) this.buildTiles(this.fc, this.countriesList);
  }

  stop(): void {
    if (this.animFrame !== null) cancelAnimationFrame(this.animFrame);
    this.animFrame = null;
    this.winPhase = 'none';
    this.gaveUp = false;
    this.gameStartMs = null;
    this.frozenElapsedMs = null;
    this.unbindEvents();
    this.eventsBound = false;
  }

  /** Place toutes les tuiles au bon endroit, pénalité temps + points, fin de partie. */
  giveUp(): void {
    if (this.winPhase !== 'none' || this.gameStartMs === null || this.tiles.length === 0) return;
    for (const t of this.tiles) {
      t.x = t.targetX;
      t.y = t.targetY;
      t.snapNorth();
    }
    this.gaveUp = true;
    this.frozenElapsedMs = abandonFrozenElapsedMs(this.gameStartMs);
    this.winPhase = 'victory';
    this.dragState = null;
    this.cameraPan = null;
    this.renderer.setDraggedGroup(null);
    this.canvas.style.cursor = 'default';
    const connected = this.computeConnectedPairs().size;
    this.emitHud(connected);
  }

  private buildTiles(geojson: GeoFeatureCollection, countries: string[]): void {
    const { tiles, borderConnectors } = buildMapTiles(
      this.canvas,
      geojson,
      countries,
      'scattered',
      !this.displayOptions.startTilesNorthUp,
      this.mapViewBBoxClamp,
    );
    this.tiles = tiles;
    this.borderConnectors = borderConnectors;
    this.connectorByKey = new Map(this.borderConnectors.map((c) => [c.key, c]));

    if (this.displayOptions.showCountryLabels) {
      for (const t of this.tiles) t.snapNorth();
    }

    this.maxZIndex = this.tiles.length;
    this.distanceScale = 1;
    this.resetCameraToPuzzle();
    this.winPhase = 'none';
    this.gaveUp = false;
    this.updateScore();
  }

  /**
   * Recale positions monde quand le canvas change de taille sans rebuild GeoJSON
   * (ex. ouverture du panneau de victoire).
   */
  rescaleWorldFromCanvasResize(oldWidth: number, oldHeight: number): void {
    if (oldWidth <= 0 || oldHeight <= 0 || this.tiles.length === 0) return;
    const nw = this.canvas.width;
    const nh = this.canvas.height;
    const sx = nw / oldWidth;
    const sy = nh / oldHeight;
    if (Math.abs(sx - 1) < 1e-6 && Math.abs(sy - 1) < 1e-6) return;
    for (const t of this.tiles) {
      t.x *= sx;
      t.y *= sy;
      t.targetX *= sx;
      t.targetY *= sy;
      for (const poly of t.polygons) {
        for (const ring of poly) {
          for (const p of ring) {
            p[0] *= sx;
            p[1] *= sy;
          }
        }
      }
    }
    for (const c of this.borderConnectors) {
      c.la[0] *= sx;
      c.la[1] *= sy;
      c.lb[0] *= sx;
      c.lb[1] *= sy;
    }
    this.camera.cx *= sx;
    this.camera.cy *= sy;
    this.distanceScale *= (sx + sy) / 2;
  }

  /** Recentre la vue sur le puzzle avec le zoom de départ (légèrement dézoomé). */
  resetView(): void {
    this.resetCameraToPuzzle();
  }

  zoomIn(): void {
    this.zoomAtCanvasCenter(ZOOM_STEP);
  }

  zoomOut(): void {
    this.zoomAtCanvasCenter(1 / ZOOM_STEP);
  }

  private resetCameraToPuzzle(): void {
    const tiles = this.tiles;
    if (!tiles.length) {
      this.camera = {
        cx: this.canvas.width / 2,
        cy: this.canvas.height / 2,
        scale: defaultViewScale(),
      };
      return;
    }
    let sx = 0;
    let sy = 0;
    for (const t of tiles) {
      sx += t.targetX;
      sy += t.targetY;
    }
    const n = tiles.length;
    this.camera = { cx: sx / n, cy: sy / n, scale: defaultViewScale() };
  }

  private screenToWorld(sx: number, sy: number): { x: number; y: number } {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const s = this.camera.scale;
    return {
      x: this.camera.cx + (sx - w / 2) / s,
      y: this.camera.cy + (sy - h / 2) / s,
    };
  }

  private zoomAtScreen(mx: number, my: number, factor: number): void {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const wx = this.camera.cx + (mx - w / 2) / this.camera.scale;
    const wy = this.camera.cy + (my - h / 2) / this.camera.scale;
    const s0 = this.camera.scale;
    const s1 = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, s0 * factor));
    if (s1 === s0) return;
    this.camera.scale = s1;
    this.camera.cx = wx - (mx - w / 2) / s1;
    this.camera.cy = wy - (my - h / 2) / s1;
  }

  private zoomAtCanvasCenter(factor: number): void {
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.zoomAtScreen(w / 2, h / 2, factor);
  }

  private startLoop(): void {
    if (this.animFrame !== null) return;
    const loop = (): void => {
      this.render();
      this.animFrame = requestAnimationFrame(loop);
    };
    this.animFrame = requestAnimationFrame(loop);
  }

  private render(): void {
    const connectedSet = this.computeConnectedPairs();
    const connected = connectedSet.size;
    this.emitHud(connected);
    this.renderer.setConnectedPairs(connectedSet);
    this.renderer.draw(this.tiles, this.borderConnectors, this.camera);
  }

  private countAdjacencyTotal(): number {
    const tileIds = new Set(this.tiles.map((t) => t.id));
    return this.borderAdjacency.filter(([a, b]) => tileIds.has(a) && tileIds.has(b)).length;
  }

  private getElapsedMs(): number {
    if (this.gameStartMs === null) return 0;
    if (this.frozenElapsedMs !== null) return this.frozenElapsedMs;
    return performance.now() - this.gameStartMs;
  }

  private emitHud(connected: number): void {
    const total = this.countAdjacencyTotal();
    const elapsedMs = this.getElapsedMs();
    let score = computeGameScore(connected, total, elapsedMs / 1000);
    if (this.gaveUp) score = scoreAfterAbandonFlat(score);
    const rawVictoryScore =
      this.frozenElapsedMs !== null
        ? computeGameScore(connected, total, this.frozenElapsedMs / 1000)
        : 0;
    const victorySummary =
      this.winPhase === 'victory' && this.frozenElapsedMs !== null
        ? {
            timeLabel: formatElapsedLabel(this.frozenElapsedMs),
            score: this.gaveUp ? scoreAfterAbandonFlat(rawVictoryScore) : rawVictoryScore,
            gaveUp: this.gaveUp,
          }
        : null;
    this.onHudUpdate?.({
      connected,
      total,
      elapsedMs,
      score,
      isComplete: this.winPhase !== 'none',
      victorySummary,
    });
  }

  private computeConnectedPairs(): Set<string> {
    const tileMap = new Map(this.tiles.map((t) => [t.id, t]));
    const result = new Set<string>();
    const thr = CONNECT_GAP_PX * this.distanceScale;
    for (const [a, b] of this.borderAdjacency) {
      const ta = tileMap.get(a);
      const tb = tileMap.get(b);
      if (!ta || !tb) continue;
      const key = adjacencyPairKey(a, b);
      const rel = this.connectorByKey.get(key);
      if (!rel) continue;
      const [wax, way] =
        ta.id === rel.a
          ? worldPointFromLocal(ta, rel.la[0], rel.la[1])
          : worldPointFromLocal(ta, rel.lb[0], rel.lb[1]);
      const [wbx, wby] =
        tb.id === rel.a
          ? worldPointFromLocal(tb, rel.la[0], rel.la[1])
          : worldPointFromLocal(tb, rel.lb[0], rel.lb[1]);
      if (Math.hypot(wax - wbx, way - wby) < thr) {
        result.add(key);
      }
    }
    return result;
  }

  /** Graphe d’adjacence à partir des arêtes actuellement « connectées » (vert). */
  private adjacencyFromPairs(pairs: Set<string>): Map<string, Set<string>> {
    const adj = new Map<string, Set<string>>();
    const link = (x: string, y: string): void => {
      if (!adj.has(x)) adj.set(x, new Set());
      if (!adj.has(y)) adj.set(y, new Set());
      adj.get(x)!.add(y);
      adj.get(y)!.add(x);
    };
    const sep = '\x1f';
    for (const key of pairs) {
      const i = key.indexOf(sep);
      if (i <= 0 || i >= key.length - 1) continue;
      link(key.slice(0, i), key.slice(i + 1));
    }
    return adj;
  }

  /** Toutes les tuiles dans la même composante connexe que `tileId` (transitivement). */
  private getConnectedComponent(tileId: string, pairs: Set<string>): Tile[] {
    const adj = this.adjacencyFromPairs(pairs);
    const seen = new Set<string>();
    const stack = [tileId];
    seen.add(tileId);
    while (stack.length > 0) {
      const id = stack.pop()!;
      for (const n of adj.get(id) ?? []) {
        if (!seen.has(n)) {
          seen.add(n);
          stack.push(n);
        }
      }
    }
    return this.tiles.filter((t) => seen.has(t.id));
  }

  /** Carte à une seule tuile sans arête (ex. France ou USA pays) : victoire si bien posée et nord OK. */
  private isSingleTileAssemblyWin(): boolean {
    if (this.tiles.length !== 1) return false;
    const t = this.tiles[0]!;
    const thr = CONNECT_GAP_PX * this.distanceScale;
    const posOk = Math.hypot(t.x - t.targetX, t.y - t.targetY) < thr;
    return posOk && t.isCorrectAngle;
  }

  private updateScore(): void {
    const total = this.countAdjacencyTotal();
    const connected = this.computeConnectedPairs().size;

    if (this.winPhase === 'victory') {
      this.emitHud(connected);
      return;
    }

    const nowWon =
      this.tiles.length === 1 && total === 0
        ? this.isSingleTileAssemblyWin()
        : connected === total && total > 0;

    if (nowWon && this.winPhase === 'none') {
      if (this.gameStartMs !== null) {
        this.frozenElapsedMs = performance.now() - this.gameStartMs;
      }
      this.winPhase = 'victory';
    } else if (!nowWon) {
      this.winPhase = 'none';
      this.frozenElapsedMs = null;
    }

    this.emitHud(connected);
  }

  private canvasPos(e: MouseEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  private topTileAt(screenX: number, screenY: number): Tile | null {
    const { x, y } = this.screenToWorld(screenX, screenY);
    const sorted = [...this.tiles].sort((a, b) => b.zIndex - a.zIndex);
    for (const tile of sorted) {
      if (tile.containsPoint(x, y)) return tile;
    }
    return null;
  }

  private onMouseDown = (e: MouseEvent): void => {
    if (e.button !== 0) return;
    const { x, y } = this.canvasPos(e);
    const tile = this.topTileAt(x, y);
    if (!tile) {
      this.cameraPan = {
        startSx: x,
        startSy: y,
        startCx: this.camera.cx,
        startCy: this.camera.cy,
        scale: this.camera.scale,
      };
      this.canvas.style.cursor = 'grabbing';
      e.preventDefault();
      return;
    }

    const pairs = this.computeConnectedPairs();
    const group = this.getConnectedComponent(tile.id, pairs);
    const origins = new Map(group.map((t) => [t.id, { x: t.x, y: t.y }]));

    let z = this.maxZIndex + 1;
    for (const t of group) {
      t.zIndex = z++;
    }
    this.maxZIndex = z - 1;

    this.dragState = {
      primaryTile: tile,
      group,
      startMouseX: x,
      startMouseY: y,
      origins,
    };
    this.renderer.setDraggedGroup(new Set(group.map((t) => t.id)));
    this.canvas.style.cursor = 'grabbing';
    e.preventDefault();
  };

  private onMouseMove = (e: MouseEvent): void => {
    const { x, y } = this.canvasPos(e);
    if (this.cameraPan) {
      const p = this.cameraPan;
      this.camera.cx = p.startCx + (p.startSx - x) / p.scale;
      this.camera.cy = p.startCy + (p.startSy - y) / p.scale;
      return;
    }
    if (this.dragState) {
      const inv = 1 / this.camera.scale;
      const dx = (x - this.dragState.startMouseX) * inv;
      const dy = (y - this.dragState.startMouseY) * inv;
      for (const t of this.dragState.group) {
        const o = this.dragState.origins.get(t.id);
        if (o) {
          t.x = o.x + dx;
          t.y = o.y + dy;
        }
      }
      this.updateScore();
      return;
    }
    const tile = this.topTileAt(x, y);
    this.renderer.setHovered(tile?.id ?? null);
    this.canvas.style.cursor = tile ? 'grab' : 'default';
  };

  private onMouseUp = (e: MouseEvent): void => {
    if (this.cameraPan) {
      this.cameraPan = null;
      const { x, y } = this.canvasPos(e);
      const tile = this.topTileAt(x, y);
      this.renderer.setHovered(tile?.id ?? null);
      this.canvas.style.cursor = tile ? 'grab' : 'default';
      return;
    }
    if (this.dragState) {
      const { primaryTile, group } = this.dragState;
      this.renderer.setDraggedGroup(null);
      this.dragState = null;
      this.canvas.style.cursor = 'default';
      this.applyMagneticSnapToGroup(primaryTile, group);
      this.updateScore();
    }
  };

  /**
   * Déplacement commun : même translation que pour la tuile principale si elle colle magnétiquement.
   */
  private applyMagneticSnapToGroup(primary: Tile, group: Tile[]): void {
    const groupIds = new Set(group.map((t) => t.id));
    const delta = this.computeSnapDelta(primary, groupIds);
    if (!delta) return;
    for (const t of group) {
      t.x += delta.dx;
      t.y += delta.dy;
    }
  }

  /**
   * Translation pour coller le bloc : priorité aux points frontière GeoJSON (emboîtement exact),
   * puis repli sur les poses cible / voisins par centroïde.
   * Les tuiles du même groupe ne servent pas de repère (elles bougent ensemble).
   */
  private computeSnapDelta(tile: Tile, groupIds: Set<string>): { dx: number; dy: number } | null {
    const snapR = SNAP_RADIUS_PX * this.distanceScale;
    const byId = new Map(this.tiles.map((t) => [t.id, t]));

    type Cand = { dx: number; dy: number; metric: number; kind: 'connector' | 'centroid' };
    const candidates: Cand[] = [];

    const pushCentroid = (px: number, py: number): void => {
      const dist = Math.hypot(tile.x - px, tile.y - py);
      if (dist < snapR) {
        candidates.push({
          dx: px - tile.x,
          dy: py - tile.y,
          metric: dist,
          kind: 'centroid',
        });
      }
    };

    pushCentroid(tile.targetX, tile.targetY);

    for (const [a, b] of this.borderAdjacency) {
      const otherId = tile.id === a ? b : tile.id === b ? a : null;
      if (!otherId) continue;
      if (groupIds.has(otherId)) continue;
      const other = byId.get(otherId);
      if (!other) continue;

      const key = adjacencyPairKey(a, b);
      const rel = this.connectorByKey.get(key);
      if (rel) {
        const [lx, ly] = tile.id === rel.a ? rel.la : rel.lb;
        const [ox, oy] = other.id === rel.a ? rel.la : rel.lb;
        const wp = worldPointFromLocal(tile, lx, ly);
        const wo = worldPointFromLocal(other, ox, oy);
        const gap = Math.hypot(wp[0] - wo[0], wp[1] - wo[1]);
        if (gap < snapR) {
          candidates.push({
            dx: wo[0] - wp[0],
            dy: wo[1] - wp[1],
            metric: gap,
            kind: 'connector',
          });
        }
      }

      const sx = other.x + (tile.targetX - other.targetX);
      const sy = other.y + (tile.targetY - other.targetY);
      pushCentroid(sx, sy);
    }

    if (candidates.length === 0) return null;

    candidates.sort((u, v) => {
      if (u.kind !== v.kind) return u.kind === 'connector' ? -1 : 1;
      return u.metric - v.metric;
    });
    const best = candidates[0]!;
    return { dx: best.dx, dy: best.dy };
  }

  private onWheel = (e: WheelEvent): void => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const { x, y } = this.canvasPos(e);
      const factor = e.deltaY > 0 ? 1 / 1.1 : 1.1;
      this.zoomAtScreen(x, y, factor);
      return;
    }
    e.preventDefault();
    if (this.displayOptions.showCountryLabels) return;
    if (this.dragState) {
      if (this.dragState.group.length > 1) return;
      this.dragState.primaryTile.rotate(e.deltaY > 0 ? 90 : -90);
      this.updateScore();
      return;
    }
    const { x, y } = this.canvasPos(e);
    const tile = this.topTileAt(x, y);
    if (!tile) return;
    tile.rotate(e.deltaY > 0 ? 90 : -90);
    this.updateScore();
  };

  private onDblClick = (e: MouseEvent): void => {
    e.preventDefault();
    if (!this.displayOptions.doubleClickSnapNorth) return;
    if (this.dragState) {
      for (const t of this.dragState.group) {
        t.snapNorth();
      }
      this.updateScore();
      return;
    }
    const { x, y } = this.canvasPos(e);
    const tile = this.topTileAt(x, y);
    if (!tile) return;
    tile.snapNorth();
    this.updateScore();
  };

  private onCanvasKeyDown = (e: KeyboardEvent): void => {
    switch (e.code) {
      case 'Equal':
      case 'NumpadAdd':
        e.preventDefault();
        this.zoomIn();
        break;
      case 'Minus':
      case 'NumpadSubtract':
        e.preventDefault();
        this.zoomOut();
        break;
      case 'Digit0':
        e.preventDefault();
        this.resetView();
        break;
      default:
        break;
    }
  };

  private bindEvents(): void {
    this.canvas.addEventListener('mousedown', this.onMouseDown);
    this.canvas.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    this.canvas.addEventListener('dblclick', this.onDblClick);
    this.canvas.addEventListener('keydown', this.onCanvasKeyDown);
    this.unbindPinch = bindCanvasPinchZoom(this.canvas, (x, y, factor) =>
      this.zoomAtScreen(x, y, factor),
    );
  }

  private unbindEvents(): void {
    this.unbindPinch?.();
    this.unbindPinch = null;
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    this.canvas.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
    this.canvas.removeEventListener('wheel', this.onWheel);
    this.canvas.removeEventListener('dblclick', this.onDblClick);
    this.canvas.removeEventListener('keydown', this.onCanvasKeyDown);
  }
}

function formatElapsedLabel(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

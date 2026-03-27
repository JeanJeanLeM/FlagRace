import type { Tile } from './Tile.ts';
import type { BorderConnectorRel, ViewCamera } from './Renderer.ts';
import { Renderer, type CapitalMarkerDraw } from './Renderer.ts';
import { buildMapTiles, createLonLatProjector, type GeoFeatureCollection } from './geoBuild.ts';
import type { CapitalEntry } from '../data/northAfricaCapitals.ts';
import { NORTH_AFRICA_CAPITALS } from '../data/northAfricaCapitals.ts';
import { NEIGHBOR_LEURE_CITIES, SECOND_CITY_BY_ISO3 } from '../data/capitalsDecoys.ts';
import type { CapitalsDifficultyId } from '../capitalsDifficulty.ts';
import {
  computeGameScore,
  type GameHudState,
} from './Game.ts';

const MIN_ZOOM = 0.35;
const MAX_ZOOM = 3.5;
const ZOOM_STEP = 1.12;
const DEFAULT_VIEW_ZOOM_OUT_STEPS = 2;
const DEFAULT_VIEW_SCALE = 1 / ZOOM_STEP ** DEFAULT_VIEW_ZOOM_OUT_STEPS;

interface MapMarker {
  id: string;
  kind: 'capital' | 'decoy';
  iso3: string;
  label: string;
  targetX: number;
  targetY: number;
  x: number;
  y: number;
  placed: boolean;
  /** Capitale posée sur la carte mais pas encore validée (mauvais endroit) ; réintégrable au dock. */
  onMapDraft: boolean;
  zIndex: number;
}

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
}

function shuffleCopy<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  shuffleInPlace(a);
  return a;
}

function toleranceWorldRadius(canvas: HTMLCanvasElement): number {
  return Math.max(58, Math.min(canvas.width, canvas.height) * 0.048);
}

export class CapitalsGame {
  private canvas: HTMLCanvasElement;
  private renderer: Renderer;
  private tiles: Tile[] = [];
  private borderConnectors: BorderConnectorRel[] = [];
  private markers: MapMarker[] = [];
  private tileById: Map<string, Tile> = new Map();
  private animFrame: number | null = null;
  private winPhase: 'none' | 'victory' = 'none';
  private distanceScale = 1;
  private onHudUpdate?: (state: GameHudState) => void;
  private gameStartMs: number | null = null;
  private frozenElapsedMs: number | null = null;
  private fc: GeoFeatureCollection | null = null;
  private countriesList: string[] = [];
  private capitalEntries: CapitalEntry[] = [];
  private difficulty: CapitalsDifficultyId = 'near-capital';
  private eventsBound = false;
  private camera: ViewCamera = { cx: 0, cy: 0, scale: DEFAULT_VIEW_SCALE };
  private toleranceWorld: number;

  private dockEl: HTMLElement | null = null;
  private ghostEl: HTMLElement | null = null;
  private dragDockMarker: MapMarker | null = null;
  private dragCanvasMarker: MapMarker | null = null;
  private dragCanvasOffsetX = 0;
  private dragCanvasOffsetY = 0;
  private activeCanvasPointerId: number | null = null;

  constructor(canvas: HTMLCanvasElement, onHudUpdate?: (state: GameHudState) => void) {
    this.canvas = canvas;
    this.toleranceWorld = toleranceWorldRadius(canvas);
    this.renderer = new Renderer(canvas);
    this.renderer.setDisplayOptions({
      showCountryLabels: false,
      uniformTileColor: false,
      showConnectorDots: false,
      showOrientationBorder: false,
      doubleClickSnapNorth: false,
    });
    this.renderer.setAssembledNeutralFill(null);
    this.onHudUpdate = onHudUpdate;
  }

  setDockElement(el: HTMLElement | null): void {
    this.dockEl = el;
  }

  async load(
    geojsonUrl: string,
    countries: string[],
    difficulty: CapitalsDifficultyId,
    capitals: CapitalEntry[] = NORTH_AFRICA_CAPITALS,
  ): Promise<void> {
    this.difficulty = difficulty;
    const res = await fetch(geojsonUrl);
    const geojson = (await res.json()) as GeoFeatureCollection;
    this.fc = geojson;
    this.countriesList = countries;
    this.capitalEntries = capitals.filter((c) => countries.includes(c.iso3));
    this.toleranceWorld = toleranceWorldRadius(this.canvas);
    this.buildWorld(geojson, countries, this.capitalEntries);
    this.gameStartMs = performance.now();
    this.frozenElapsedMs = null;
    this.dockEl?.classList.remove('hidden');
    if (!this.eventsBound) {
      this.bindEvents();
      this.eventsBound = true;
    }
    this.startLoop();
  }

  relayout(): void {
    if (this.fc) {
      this.buildWorld(this.fc, this.countriesList, this.capitalEntries);
    }
  }

  stop(): void {
    if (this.animFrame !== null) cancelAnimationFrame(this.animFrame);
    this.animFrame = null;
    this.winPhase = 'none';
    this.gameStartMs = null;
    this.frozenElapsedMs = null;
    this.endDockDrag();
    this.unbindEvents();
    this.eventsBound = false;
    this.dockEl?.replaceChildren();
    this.dockEl?.classList.add('hidden');
  }

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
    for (const m of this.markers) {
      m.targetX *= sx;
      m.targetY *= sy;
      if (m.placed || (m.kind === 'capital' && m.onMapDraft)) {
        m.x *= sx;
        m.y *= sy;
      }
    }
    this.camera.cx *= sx;
    this.camera.cy *= sy;
    this.distanceScale *= (sx + sy) / 2;
    this.toleranceWorld = toleranceWorldRadius(this.canvas);
  }

  resetView(): void {
    this.resetCameraToMap();
  }

  zoomIn(): void {
    this.zoomAtCanvasCenter(ZOOM_STEP);
  }

  zoomOut(): void {
    this.zoomAtCanvasCenter(1 / ZOOM_STEP);
  }

  private capitalMarkersOnly(): MapMarker[] {
    return this.markers.filter((m) => m.kind === 'capital');
  }

  private buildWorld(geojson: GeoFeatureCollection, countries: string[], capitals: CapitalEntry[]): void {
    const { tiles, borderConnectors } = buildMapTiles(this.canvas, geojson, countries, 'assembled');
    this.tiles = tiles;
    this.borderConnectors = borderConnectors;
    this.tileById = new Map(tiles.map((t) => [t.id, t]));

    const project = createLonLatProjector(this.canvas, geojson, countries);
    const list = capitals.filter((c) => countries.includes(c.iso3));

    const capItems: MapMarker[] = list.map((c) => {
      const target = project ? project(c.lon, c.lat) : [0, 0];
      return {
        id: `cap-${c.iso3}`,
        kind: 'capital',
        iso3: c.iso3,
        label: c.label,
        targetX: target[0],
        targetY: target[1],
        x: 0,
        y: 0,
        placed: false,
        onMapDraft: false,
        zIndex: 0,
      };
    });

    const decoys: MapMarker[] = [];
    if (this.difficulty === 'expert-decoys' && project) {
      for (const iso of countries) {
        const sc = SECOND_CITY_BY_ISO3[iso];
        if (!sc) continue;
        const t = project(sc.lon, sc.lat);
        decoys.push({
          id: `2nd-${iso}`,
          kind: 'decoy',
          iso3: iso,
          label: sc.label,
          targetX: t[0],
          targetY: t[1],
          x: 0,
          y: 0,
          placed: false,
          onMapDraft: false,
          zIndex: 0,
        });
      }
      const nNeighbor = countries.length;
      const pool = shuffleCopy(NEIGHBOR_LEURE_CITIES);
      for (let i = 0; i < nNeighbor && i < pool.length; i++) {
        const sc = pool[i]!;
        const t = project(sc.lon, sc.lat);
        decoys.push({
          id: `near-${i}-${sc.label}`,
          kind: 'decoy',
          iso3: '',
          label: sc.label,
          targetX: t[0],
          targetY: t[1],
          x: 0,
          y: 0,
          placed: false,
          onMapDraft: false,
          zIndex: 0,
        });
      }
    }

    const all = [...capItems, ...decoys];
    all.sort((a, b) => a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' }));
    all.forEach((m, i) => {
      m.zIndex = i;
    });

    this.markers = all;
    this.distanceScale = 1;
    this.resetCameraToMap();
    this.winPhase = 'none';
    this.endDockDrag();
    this.updateOutcome();
    this.fillDock();
  }

  private fillDock(): void {
    if (!this.dockEl) return;
    const unplaced = this.markers.filter(
      (m) => !m.placed && !(m.kind === 'capital' && m.onMapDraft),
    );
    this.dockEl.replaceChildren();
    for (const m of unplaced) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'capitals-dock-item';
      btn.dataset['markerId'] = m.id;
      btn.title = 'Glisser sur la carte';
      const pin = document.createElement('span');
      pin.className = 'capitals-dock-item-pin';
      pin.setAttribute('aria-hidden', 'true');
      pin.textContent = '📍';
      const lab = document.createElement('span');
      lab.className = 'capitals-dock-item-label';
      lab.textContent = m.label;
      btn.appendChild(pin);
      btn.appendChild(lab);
      btn.addEventListener('pointerdown', this.onDockPointerDown);
      this.dockEl.appendChild(btn);
    }
  }

  private onDockPointerDown = (e: PointerEvent): void => {
    const t = e.currentTarget as HTMLElement;
    const id = t.dataset['markerId'];
    if (!id || e.button !== 0) return;
    const m = this.markers.find((x) => x.id === id);
    if (!m || m.placed || (m.kind === 'capital' && m.onMapDraft)) return;
    e.preventDefault();
    this.dragDockMarker = m;
    const g = document.createElement('div');
    g.className = 'capitals-drag-ghost';
    const pin = document.createElement('span');
    pin.className = 'capitals-drag-ghost-pin';
    pin.setAttribute('aria-hidden', 'true');
    pin.textContent = '📍';
    const tx = document.createElement('span');
    tx.className = 'capitals-drag-ghost-text';
    tx.textContent = m.label;
    g.appendChild(pin);
    g.appendChild(tx);
    document.body.appendChild(g);
    this.ghostEl = g;
    this.moveCapitalsGhost(e.clientX, e.clientY);
    document.addEventListener('pointermove', this.onGlobalPointerMove);
    document.addEventListener('pointerup', this.onGlobalPointerUp);
    document.addEventListener('pointercancel', this.onGlobalPointerUp);
  };

  private onGlobalPointerMove = (e: PointerEvent): void => {
    if (!this.ghostEl) return;
    this.moveCapitalsGhost(e.clientX, e.clientY);
  };

  private onGlobalPointerUp = (e: PointerEvent): void => {
    document.removeEventListener('pointermove', this.onGlobalPointerMove);
    document.removeEventListener('pointerup', this.onGlobalPointerUp);
    document.removeEventListener('pointercancel', this.onGlobalPointerUp);

    const marker = this.dragDockMarker;
    this.dragDockMarker = null;
    if (this.ghostEl) {
      this.ghostEl.remove();
      this.ghostEl = null;
    }

    if (!marker) return;

    const rect = this.canvas.getBoundingClientRect();
    const inside =
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom;
    if (!inside) {
      this.fillDock();
      return;
    }

    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const sx = (e.clientX - rect.left) * scaleX;
    const sy = (e.clientY - rect.top) * scaleY;
    const w = this.screenToWorld(sx, sy);
    marker.x = w.x;
    marker.y = w.y;
    this.tryPlace(marker);
    this.fillDock();
  };

  private endDockDrag(): void {
    document.removeEventListener('pointermove', this.onGlobalPointerMove);
    document.removeEventListener('pointerup', this.onGlobalPointerUp);
    document.removeEventListener('pointercancel', this.onGlobalPointerUp);
    this.dragDockMarker = null;
    if (this.ghostEl) {
      this.ghostEl.remove();
      this.ghostEl = null;
    }
  }

  private endCanvasDrag(): void {
    if (this.activeCanvasPointerId !== null) {
      try {
        this.canvas.releasePointerCapture(this.activeCanvasPointerId);
      } catch {
        /* ignore */
      }
      this.activeCanvasPointerId = null;
    }
    this.dragCanvasMarker = null;
  }

  private pointerClientInDock(clientX: number, clientY: number): boolean {
    if (!this.dockEl || this.dockEl.classList.contains('hidden')) return false;
    const r = this.dockEl.getBoundingClientRect();
    return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
  }

  private clientToCanvasPixels(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  private pickDraftCapitalAtCanvasPx(sx: number, sy: number): MapMarker | null {
    const w = this.screenToWorld(sx, sy);
    const hitR = (28 / this.camera.scale) * this.distanceScale;
    const candidates = this.markers.filter(
      (m) => m.kind === 'capital' && m.onMapDraft && !m.placed,
    );
    candidates.sort((a, b) => b.zIndex - a.zIndex);
    for (const m of candidates) {
      if (Math.hypot(w.x - m.x, w.y - m.y) <= hitR) return m;
    }
    return null;
  }

  private onCanvasPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0 || this.dragDockMarker || this.ghostEl) return;
    const { x, y } = this.clientToCanvasPixels(e.clientX, e.clientY);
    const m = this.pickDraftCapitalAtCanvasPx(x, y);
    if (!m) return;
    e.preventDefault();
    e.stopPropagation();
    const w = this.screenToWorld(x, y);
    this.dragCanvasOffsetX = w.x - m.x;
    this.dragCanvasOffsetY = w.y - m.y;
    this.dragCanvasMarker = m;
    this.activeCanvasPointerId = e.pointerId;
    this.canvas.setPointerCapture(e.pointerId);
    this.canvas.style.cursor = 'grabbing';
  };

  private onCanvasPointerMove = (e: PointerEvent): void => {
    if (!this.dragCanvasMarker || e.pointerId !== this.activeCanvasPointerId) return;
    const { x, y } = this.clientToCanvasPixels(e.clientX, e.clientY);
    const w = this.screenToWorld(x, y);
    this.dragCanvasMarker.x = w.x - this.dragCanvasOffsetX;
    this.dragCanvasMarker.y = w.y - this.dragCanvasOffsetY;
  };

  private onCanvasPointerUp = (e: PointerEvent): void => {
    if (!this.dragCanvasMarker || e.pointerId !== this.activeCanvasPointerId) return;
    const m = this.dragCanvasMarker;
    this.endCanvasDrag();
    this.canvas.style.cursor = 'default';

    if (this.pointerClientInDock(e.clientX, e.clientY)) {
      m.onMapDraft = false;
      m.x = 0;
      m.y = 0;
      this.fillDock();
      return;
    }

    this.tryPlace(m);
    this.fillDock();
  };

  private moveCapitalsGhost(clientX: number, clientY: number): void {
    if (!this.ghostEl) return;
    const g = this.ghostEl;
    const w = g.offsetWidth || 100;
    g.style.left = `${clientX - w / 2}px`;
    g.style.top = `${clientY - 8}px`;
  }

  private resetCameraToMap(): void {
    const tiles = this.tiles;
    if (!tiles.length) {
      this.camera = {
        cx: this.canvas.width / 2,
        cy: this.canvas.height / 2,
        scale: DEFAULT_VIEW_SCALE,
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
    this.camera = { cx: sx / n, cy: sy / n, scale: DEFAULT_VIEW_SCALE };
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
    const caps = this.capitalMarkersOnly();
    const placed = caps.filter((m) => m.placed).length;
    this.emitHud(placed, caps.length);
    const capDraw = this.capitalDrawList();
    this.renderer.draw(this.tiles, this.borderConnectors, this.camera, capDraw);
  }

  private capitalDrawList(): CapitalMarkerDraw[] {
    const dragging = this.dragCanvasMarker;
    const rest = this.markers
      .filter((m) => m !== dragging && (m.placed || (m.kind === 'capital' && m.onMapDraft)))
      .sort((a, b) => {
        const pa = a.placed ? 1 : 0;
        const pb = b.placed ? 1 : 0;
        if (pa !== pb) return pa - pb;
        return a.zIndex - b.zIndex;
      })
      .map((m) => ({
        x: m.x,
        y: m.y,
        label: m.label,
        visual: (m.placed ? 'validated' : 'draft') as 'validated' | 'draft',
        dragging: false,
      }));
    if (dragging) {
      rest.push({
        x: dragging.x,
        y: dragging.y,
        label: dragging.label,
        visual: 'draft',
        dragging: true,
      });
    }
    return rest;
  }

  private getElapsedMs(): number {
    if (this.gameStartMs === null) return 0;
    if (this.frozenElapsedMs !== null) return this.frozenElapsedMs;
    return performance.now() - this.gameStartMs;
  }

  private emitHud(placed: number, totalCapitals: number): void {
    const elapsedMs = this.getElapsedMs();
    const score = computeGameScore(placed, totalCapitals, elapsedMs / 1000);
    const victorySummary =
      this.winPhase === 'victory' && this.frozenElapsedMs !== null
        ? {
            timeLabel: formatElapsedLabel(this.frozenElapsedMs),
            score: computeGameScore(placed, totalCapitals, this.frozenElapsedMs / 1000),
          }
        : null;
    this.onHudUpdate?.({
      connected: placed,
      total: totalCapitals,
      elapsedMs,
      score,
      isComplete: this.winPhase !== 'none',
      victorySummary,
    });
  }

  private tryPlace(marker: MapMarker): void {
    if (marker.kind === 'decoy') {
      return;
    }

    const tile = this.tileById.get(marker.iso3);
    if (!tile) {
      marker.onMapDraft = true;
      return;
    }
    if (!tile.containsPoint(marker.x, marker.y)) {
      marker.onMapDraft = true;
      return;
    }

    const needNearCapital =
      this.difficulty === 'near-capital' || this.difficulty === 'expert-decoys';
    if (needNearCapital) {
      const tol = this.toleranceWorld * this.distanceScale;
      const d = Math.hypot(marker.x - marker.targetX, marker.y - marker.targetY);
      if (d > tol) {
        marker.onMapDraft = true;
        return;
      }
    }

    if (this.difficulty === 'in-country') {
      marker.x = tile.targetX;
      marker.y = tile.targetY;
    } else {
      marker.x = marker.targetX;
      marker.y = marker.targetY;
    }
    marker.onMapDraft = false;
    marker.placed = true;
    marker.zIndex = -1;
    this.updateOutcome();
  }

  private updateOutcome(): void {
    const caps = this.capitalMarkersOnly();
    const total = caps.length;
    const placed = caps.filter((m) => m.placed).length;
    const won = placed === total && total > 0;

    if (won && this.winPhase === 'none') {
      if (this.gameStartMs !== null) {
        this.frozenElapsedMs = performance.now() - this.gameStartMs;
      }
      this.winPhase = 'victory';
    }
    if (!won) {
      this.winPhase = 'none';
      this.frozenElapsedMs = null;
    }
    this.emitHud(placed, total);
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

  private onWheel = (e: WheelEvent): void => {
    if (!e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    const { x, y } = this.canvasPos(e);
    const factor = e.deltaY > 0 ? 1 / 1.1 : 1.1;
    this.zoomAtScreen(x, y, factor);
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
    this.canvas.addEventListener('pointerdown', this.onCanvasPointerDown);
    this.canvas.addEventListener('pointermove', this.onCanvasPointerMove);
    this.canvas.addEventListener('pointerup', this.onCanvasPointerUp);
    this.canvas.addEventListener('pointercancel', this.onCanvasPointerUp);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    this.canvas.addEventListener('keydown', this.onCanvasKeyDown);
  }

  private unbindEvents(): void {
    this.endCanvasDrag();
    this.canvas.removeEventListener('pointerdown', this.onCanvasPointerDown);
    this.canvas.removeEventListener('pointermove', this.onCanvasPointerMove);
    this.canvas.removeEventListener('pointerup', this.onCanvasPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onCanvasPointerUp);
    this.canvas.removeEventListener('wheel', this.onWheel);
    this.canvas.removeEventListener('keydown', this.onCanvasKeyDown);
  }
}

function formatElapsedLabel(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

import type { Tile } from './Tile.ts';
import type { BorderConnectorRel, ViewCamera } from './Renderer.ts';
import { Renderer, type CapitalMarkerDraw } from './Renderer.ts';
import { buildMapTiles, type GeoFeatureCollection } from './geoBuild.ts';
import { buildFlagDockIso3List } from '../data/flagDecoys.ts';
import type { CountryLabelDifficulty } from '../countryLabelDifficulty.ts';
import { countryNameFr, flagEmojiFromIso3 } from '../data/countryNamesFr.ts';
import type { GameHudState } from './Game.ts';
import { abandonFrozenElapsedMs, scoreAfterAbandonFlat } from './abandon.ts';
import { tileContainsPointWithDropHalo } from './smallCountryDropHit.ts';

const MIN_ZOOM = 0.35;
const MAX_ZOOM = 3.5;
const ZOOM_STEP = 1.12;
const DEFAULT_VIEW_ZOOM_OUT_STEPS = 2;
const DEFAULT_VIEW_SCALE = 1 / ZOOM_STEP ** DEFAULT_VIEW_ZOOM_OUT_STEPS;

function computeLabelHudScore(
  placed: number,
  total: number,
  elapsedSec: number,
  difficulty: CountryLabelDifficulty,
): number {
  const decoyBonus = difficulty === 1 ? 0 : difficulty === 2 ? 280 : 520;
  const base = 600 + total * 100 + decoyBonus;
  const raw = base + placed * 180 - elapsedSec * 10;
  return Math.max(0, Math.floor(raw));
}

interface LabelMarker {
  id: string;
  kind: 'map' | 'decoy';
  iso3: string;
  /** Texte affiché (dock, fantôme, carte une fois posé). */
  displayLabel: string;
  x: number;
  y: number;
  placed: boolean;
  zIndex: number;
}

function formatElapsedLabel(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export class CountryLabelsGame {
  private canvas: HTMLCanvasElement;
  private renderer: Renderer;
  private tiles: Tile[] = [];
  private borderConnectors: BorderConnectorRel[] = [];
  private markers: LabelMarker[] = [];
  private animFrame: number | null = null;
  private winPhase: 'none' | 'victory' = 'none';
  private onHudUpdate?: (state: GameHudState) => void;
  private gameStartMs: number | null = null;
  private frozenElapsedMs: number | null = null;
  private fc: GeoFeatureCollection | null = null;
  private countriesList: string[] = [];
  private difficulty: CountryLabelDifficulty = 1;
  private eventsBound = false;
  private camera: ViewCamera = { cx: 0, cy: 0, scale: DEFAULT_VIEW_SCALE };

  private dockEl: HTMLElement | null = null;
  private ghostEl: HTMLElement | null = null;
  private dragMarker: LabelMarker | null = null;
  private canvasPan: {
    startSx: number;
    startSy: number;
    startCx: number;
    startCy: number;
    scale: number;
  } | null = null;
  private panPointerId: number | null = null;
  private gaveUp = false;

  constructor(canvas: HTMLCanvasElement, onHudUpdate?: (state: GameHudState) => void) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.renderer.setDisplayOptions({
      showCountryLabels: false,
      uniformTileColor: false,
      showConnectorDots: false,
      showOrientationBorder: false,
      doubleClickSnapNorth: false,
      startTilesNorthUp: false,
    });
    this.renderer.setAssembledNeutralFill(null);
    this.onHudUpdate = onHudUpdate;
  }

  setDockElement(el: HTMLElement | null): void {
    this.dockEl = el;
  }

  async load(geojsonUrl: string, countries: string[], difficulty: CountryLabelDifficulty): Promise<void> {
    this.difficulty = difficulty;
    const res = await fetch(geojsonUrl);
    const geojson = (await res.json()) as GeoFeatureCollection;
    this.fc = geojson;
    this.countriesList = countries;
    this.buildWorld(geojson, countries);
    this.gameStartMs = performance.now();
    this.gaveUp = false;
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
      this.buildWorld(this.fc, this.countriesList);
    }
  }

  stop(): void {
    if (this.animFrame !== null) cancelAnimationFrame(this.animFrame);
    this.animFrame = null;
    this.winPhase = 'none';
    this.gaveUp = false;
    this.gameStartMs = null;
    this.frozenElapsedMs = null;
    this.endCanvasPan();
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
      if (m.placed) {
        m.x *= sx;
        m.y *= sy;
      }
    }
    this.camera.cx *= sx;
    this.camera.cy *= sy;
  }

  resetView(): void {
    this.resetCameraToMap();
  }

  giveUp(): void {
    if (this.winPhase !== 'none' || this.gameStartMs === null) return;
    for (const m of this.mapMarkers()) {
      const tile = this.tiles.find((t) => t.id === m.iso3);
      if (!tile) continue;
      m.x = tile.targetX;
      m.y = tile.targetY;
      m.placed = true;
      m.zIndex = -1;
    }
    this.gaveUp = true;
    this.frozenElapsedMs = abandonFrozenElapsedMs(this.gameStartMs);
    this.winPhase = 'victory';
    this.endCanvasPan();
    this.endDockDrag();
    const caps = this.mapMarkers();
    const placed = caps.filter((x) => x.placed).length;
    this.fillDock();
    this.emitHud(placed, caps.length);
  }

  zoomIn(): void {
    this.zoomAtCanvasCenter(ZOOM_STEP);
  }

  zoomOut(): void {
    this.zoomAtCanvasCenter(1 / ZOOM_STEP);
  }

  private mapMarkers(): LabelMarker[] {
    return this.markers.filter((m) => m.kind === 'map');
  }

  private buildWorld(geojson: GeoFeatureCollection, countries: string[]): void {
    const { tiles, borderConnectors } = buildMapTiles(this.canvas, geojson, countries, 'assembled');
    this.tiles = tiles;
    this.borderConnectors = borderConnectors;

    const onMap = new Set(countries);
    const dockIso3 = buildFlagDockIso3List(countries, this.difficulty);

    const items: LabelMarker[] = dockIso3.map((iso3) => {
      const name = countryNameFr(iso3);
      const emoji = this.difficulty === 1 ? flagEmojiFromIso3(iso3) : '';
      const displayLabel =
        this.difficulty === 1 && emoji ? `${emoji}\u00A0${name}` : name;
      return {
        id: `lbl-${iso3}`,
        kind: onMap.has(iso3) ? 'map' : 'decoy',
        iso3,
        displayLabel,
        x: 0,
        y: 0,
        placed: false,
        zIndex: 0,
      };
    });
    items.sort((a, b) =>
      countryNameFr(a.iso3).localeCompare(countryNameFr(b.iso3), 'fr', { sensitivity: 'base', numeric: true }),
    );
    items.forEach((m, i) => {
      m.zIndex = i;
    });

    this.markers = items;
    this.resetCameraToMap();
    this.winPhase = 'none';
    this.gaveUp = false;
    this.endDockDrag();
    this.updateOutcome();
    this.fillDock();
  }

  private fillDock(): void {
    if (!this.dockEl) return;
    const unplaced = this.markers.filter((m) => !m.placed);
    this.dockEl.replaceChildren();
    for (const m of unplaced) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'capitals-dock-item country-label-dock-item';
      btn.dataset['markerId'] = m.id;
      btn.title = 'Glisser sur le pays sur la carte';
      const pin = document.createElement('span');
      pin.className = 'capitals-dock-item-pin';
      pin.setAttribute('aria-hidden', 'true');
      pin.textContent = '🏷️';
      const lab = document.createElement('span');
      lab.className = 'capitals-dock-item-label';
      lab.textContent = m.displayLabel;
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
    if (!m || m.placed) return;
    e.preventDefault();
    this.dragMarker = m;
    const g = document.createElement('div');
    g.className = 'capitals-drag-ghost country-label-drag-ghost';
    const pin = document.createElement('span');
    pin.className = 'capitals-drag-ghost-pin';
    pin.setAttribute('aria-hidden', 'true');
    pin.textContent = '🏷️';
    const tx = document.createElement('span');
    tx.className = 'capitals-drag-ghost-text';
    tx.textContent = m.displayLabel;
    g.appendChild(pin);
    g.appendChild(tx);
    document.body.appendChild(g);
    this.ghostEl = g;
    this.moveGhost(e.clientX, e.clientY);
    document.addEventListener('pointermove', this.onGlobalPointerMove);
    document.addEventListener('pointerup', this.onGlobalPointerUp);
    document.addEventListener('pointercancel', this.onGlobalPointerUp);
  };

  private onGlobalPointerMove = (e: PointerEvent): void => {
    if (!this.ghostEl) return;
    this.moveGhost(e.clientX, e.clientY);
  };

  private onGlobalPointerUp = (e: PointerEvent): void => {
    document.removeEventListener('pointermove', this.onGlobalPointerMove);
    document.removeEventListener('pointerup', this.onGlobalPointerUp);
    document.removeEventListener('pointercancel', this.onGlobalPointerUp);

    const marker = this.dragMarker;
    this.dragMarker = null;
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
    this.dragMarker = null;
    if (this.ghostEl) {
      this.ghostEl.remove();
      this.ghostEl = null;
    }
  }

  private moveGhost(clientX: number, clientY: number): void {
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

  private topTileAtWorld(x: number, y: number): Tile | null {
    const sorted = [...this.tiles].sort((a, b) => b.zIndex - a.zIndex);
    for (const tile of sorted) {
      if (tile.containsPoint(x, y)) return tile;
    }
    return null;
  }

  private topTileAtCanvasPx(sx: number, sy: number): Tile | null {
    const w = this.screenToWorld(sx, sy);
    return this.topTileAtWorld(w.x, w.y);
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

  private endCanvasPan(): void {
    if (this.panPointerId !== null) {
      try {
        this.canvas.releasePointerCapture(this.panPointerId);
      } catch {
        /* ignore */
      }
      this.panPointerId = null;
    }
    this.canvasPan = null;
    this.canvas.style.cursor = 'default';
  }

  private onCanvasPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0 || this.dragMarker || this.ghostEl) return;
    const { x, y } = this.clientToCanvasPixels(e.clientX, e.clientY);
    if (this.topTileAtCanvasPx(x, y)) return;
    this.canvasPan = {
      startSx: x,
      startSy: y,
      startCx: this.camera.cx,
      startCy: this.camera.cy,
      scale: this.camera.scale,
    };
    this.panPointerId = e.pointerId;
    this.canvas.setPointerCapture(e.pointerId);
    this.canvas.style.cursor = 'grabbing';
    e.preventDefault();
  };

  private onCanvasPointerMove = (e: PointerEvent): void => {
    if (this.canvasPan === null || e.pointerId !== this.panPointerId) return;
    const { x, y } = this.clientToCanvasPixels(e.clientX, e.clientY);
    const p = this.canvasPan;
    this.camera.cx = p.startCx + (p.startSx - x) / p.scale;
    this.camera.cy = p.startCy + (p.startSy - y) / p.scale;
  };

  private onCanvasPointerUp = (e: PointerEvent): void => {
    if (this.canvasPan === null || e.pointerId !== this.panPointerId) return;
    this.endCanvasPan();
  };

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
    const caps = this.mapMarkers();
    const placed = caps.filter((m) => m.placed).length;
    this.emitHud(placed, caps.length);
    const capDraw = this.labelDrawList();
    this.renderer.draw(this.tiles, this.borderConnectors, this.camera, capDraw);
  }

  private labelDrawList(): CapitalMarkerDraw[] {
    return this.markers
      .filter((m) => m.placed)
      .sort((a, b) => a.zIndex - b.zIndex)
      .map((m) => ({
        x: m.x,
        y: m.y,
        label: m.displayLabel,
        visual: 'validated' as const,
        dragging: false,
      }));
  }

  private getElapsedMs(): number {
    if (this.gameStartMs === null) return 0;
    if (this.frozenElapsedMs !== null) return this.frozenElapsedMs;
    return performance.now() - this.gameStartMs;
  }

  private emitHud(placed: number, totalMapLabels: number): void {
    const elapsedMs = this.getElapsedMs();
    let score = computeLabelHudScore(placed, totalMapLabels, elapsedMs / 1000, this.difficulty);
    if (this.gaveUp) score = scoreAfterAbandonFlat(score);
    const rawV =
      this.frozenElapsedMs !== null
        ? computeLabelHudScore(placed, totalMapLabels, this.frozenElapsedMs / 1000, this.difficulty)
        : 0;
    const victorySummary =
      this.winPhase === 'victory' && this.frozenElapsedMs !== null
        ? {
            timeLabel: formatElapsedLabel(this.frozenElapsedMs),
            score: this.gaveUp ? scoreAfterAbandonFlat(rawV) : rawV,
            gaveUp: this.gaveUp,
          }
        : null;
    this.onHudUpdate?.({
      connected: placed,
      total: totalMapLabels,
      elapsedMs,
      score,
      isComplete: this.winPhase !== 'none',
      victorySummary,
    });
  }

  /** Mauvais pays ou leurre : l’étiquette revient dans la colonne de gauche. */
  private tryPlace(marker: LabelMarker): void {
    if (marker.kind === 'decoy') {
      marker.x = 0;
      marker.y = 0;
      return;
    }

    const tile = this.tiles.find((t) => t.id === marker.iso3);
    if (!tile || !tileContainsPointWithDropHalo(tile, marker.x, marker.y)) {
      marker.x = 0;
      marker.y = 0;
      return;
    }

    marker.x = tile.targetX;
    marker.y = tile.targetY;
    marker.placed = true;
    marker.zIndex = -1;
    this.updateOutcome();
  }

  private updateOutcome(): void {
    const caps = this.mapMarkers();
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
    this.endCanvasPan();
    this.canvas.removeEventListener('pointerdown', this.onCanvasPointerDown);
    this.canvas.removeEventListener('pointermove', this.onCanvasPointerMove);
    this.canvas.removeEventListener('pointerup', this.onCanvasPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onCanvasPointerUp);
    this.canvas.removeEventListener('wheel', this.onWheel);
    this.canvas.removeEventListener('keydown', this.onCanvasKeyDown);
  }
}

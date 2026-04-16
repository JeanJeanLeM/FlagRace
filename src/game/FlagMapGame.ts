import { Tile } from './Tile.ts';
import type { BorderConnectorRel, ViewCamera } from './Renderer.ts';
import { Renderer } from './Renderer.ts';
import { buildMapTiles, type GeoFeatureCollection } from './geoBuild.ts';
import { flagImageUrl } from '../data/flagAlpha2ByIso3.ts';
import { countryDisplayCollatorLocale, countryDisplayName } from '../data/countryDisplayName.ts';
import { getLocale } from '../i18n/locale.ts';
import { pickUiString } from '../i18n/uiStrings.ts';
import { bindCanvasPinchZoom } from './canvasPinchZoom.ts';
import { clampDockIndex, defaultViewScale, isCompactGameLayout, updateDockNavButtons } from './compactDock.ts';
import { buildFlagDockIso3List } from '../data/flagDecoys.ts';
import { abandonFrozenElapsedMs, scoreAfterAbandonFlat } from './abandon.ts';
import { tileContainsPointWithDropHalo } from './smallCountryDropHit.ts';
import type { MapViewBBoxClamp } from '../data/regionConfig.ts';

const MIN_ZOOM = 0.35;
const MAX_ZOOM = 3.5;
const ZOOM_STEP = 1.12;
const NEUTRAL_TILE = '#455a70';

type GameHudState = {
  connected: number;
  total: number;
  elapsedMs: number;
  score: number;
  isComplete: boolean;
  victorySummary: { timeLabel: string; score: number; gaveUp: boolean } | null;
};
type FlagDockDifficulty = 1 | 2 | 3;

function computeFlagHudScore(
  placed: number,
  total: number,
  elapsedSec: number,
  difficulty: FlagDockDifficulty,
): number {
  const decoyBonus = difficulty === 1 ? 0 : difficulty === 2 ? 280 : 520;
  const base = 600 + total * 100 + decoyBonus;
  const raw = base + placed * 180 - elapsedSec * 10;
  return Math.max(0, Math.floor(raw));
}

function formatElapsedLabel(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function loadFlagImage(iso3: string): Promise<HTMLImageElement | null> {
  const url = flagImageUrl(iso3, 320);
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = (): void => resolve(img);
    img.onerror = (): void => resolve(null);
    img.src = url;
  });
}

export class FlagMapGame {
  private canvas: HTMLCanvasElement;
  private renderer: Renderer;
  private tiles: Tile[] = [];
  private borderConnectors: BorderConnectorRel[] = [];
  private animFrame: number | null = null;
  private onHudUpdate?: (state: GameHudState) => void;
  private gameStartMs: number | null = null;
  private frozenElapsedMs: number | null = null;
  private winPhase: 'none' | 'victory' = 'none';
  private fc: GeoFeatureCollection | null = null;
  private countriesList: string[] = [];
  private mapViewBBoxClamp: MapViewBBoxClamp | undefined;
  /** Tous les ISO3 affichés dans le dock (carte + leurres). */
  private dockIso3List: string[] = [];
  private flagDifficulty: FlagDockDifficulty = 1;
  private eventsBound = false;
  private unbindPinch: (() => void) | null = null;
  private camera: ViewCamera = { cx: 0, cy: 0, scale: defaultViewScale() };
  private placed = new Set<string>();
  private flagImages = new Map<string, HTMLImageElement>();
  private dockEl: HTMLElement | null = null;
  private dragIso3: string | null = null;
  private ghostEl: HTMLElement | null = null;
  private canvasPan: {
    startSx: number;
    startSy: number;
    startCx: number;
    startCy: number;
    scale: number;
  } | null = null;
  private panPointerId: number | null = null;
  private gaveUp = false;
  /** Index dans la file des drapeaux non placés (mode compact uniquement). */
  private dockActiveIndex = 0;
  private dockWheelHandler: ((e: WheelEvent) => void) | null = null;
  /** Bouton dock qui a capturé le pointeur pendant un drag (obligatoire sur tactile). */
  private flagDragSourceEl: HTMLElement | null = null;
  /** Mode compact mobile : drapeau sélectionné pour placement au tap sur la carte. */
  private selectedIso3: string | null = null;

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
    this.renderer.setAssembledNeutralFill(NEUTRAL_TILE);
    this.onHudUpdate = onHudUpdate;
  }

  async load(
    geojsonUrl: string,
    countries: string[],
    difficulty: FlagDockDifficulty = 1,
    mapViewBBoxClamp?: MapViewBBoxClamp,
  ): Promise<void> {
    const res = await fetch(geojsonUrl);
    const geojson = (await res.json()) as GeoFeatureCollection;
    this.fc = geojson;
    this.countriesList = countries;
    this.mapViewBBoxClamp = mapViewBBoxClamp;
    this.flagDifficulty = difficulty;
    this.dockIso3List = buildFlagDockIso3List(countries, difficulty);
    const loc = getLocale();
    const coll = countryDisplayCollatorLocale(loc);
    this.dockIso3List.sort((a, b) =>
      countryDisplayName(a, loc).localeCompare(countryDisplayName(b, loc), coll, {
        sensitivity: 'base',
        numeric: true,
      }),
    );
    this.placed.clear();
    this.renderer.clearTileFlags();
    this.winPhase = 'none';
    this.gaveUp = false;
    this.frozenElapsedMs = null;
    this.gameStartMs = performance.now();

    const toLoad = [...new Set(this.dockIso3List)];
    const loads = await Promise.all(toLoad.map((iso) => loadFlagImage(iso)));
    this.flagImages.clear();
    toLoad.forEach((iso, i) => {
      const im = loads[i];
      if (im) this.flagImages.set(iso, im);
    });

    this.rebuildTiles();
    this.dockActiveIndex = 0;
    this.fillDock();
    this.bindDockWheel();
    this.dockEl?.classList.remove('hidden');

    if (!this.eventsBound) {
      this.bindEvents();
      this.eventsBound = true;
    }
    this.startLoop();
    this.emitHud();
  }

  relayout(): void {
    if (!this.fc) return;
    const { tiles, borderConnectors } = buildMapTiles(
      this.canvas,
      this.fc,
      this.countriesList,
      'assembled',
      true,
      this.mapViewBBoxClamp,
    );
    this.tiles = tiles;
    this.borderConnectors = borderConnectors;
    this.renderer.clearTileFlags();
    for (const id of this.placed) {
      const img = this.flagImages.get(id);
      if (img) this.renderer.setTileFlag(id, img);
    }
    this.resetCameraToMap();
    this.emitHud();
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
    this.endCanvasPan();
    this.endDrag();
    this.unbindDockWheel();
    this.dockActiveIndex = 0;
    this.dockEl?.replaceChildren();
    this.dockEl?.classList.add('hidden');
    this.renderer.clearTileFlags();
    this.renderer.setAssembledNeutralFill(null);
  }

  setDockElement(el: HTMLElement | null): void {
    this.dockEl = el;
  }

  /** Appelé au redimensionnement / changement breakpoint pour rafraîchir le dock. */
  onDockLayoutChange(): void {
    this.clampFlagDockIndex();
    this.fillDock();
  }

  /** Flèches / molette : déplace l’élément actif (mode compact). */
  dockNavigateStep(delta: number): void {
    if (!isCompactGameLayout()) return;
    const q = this.unplacedIsoQueue();
    if (q.length <= 1) return;
    this.dockActiveIndex = clampDockIndex(this.dockActiveIndex + delta, q.length);
    this.fillDock();
  }

  private unplacedIsoQueue(): string[] {
    return this.dockIso3List.filter((iso) => !this.placed.has(iso));
  }

  private clampFlagDockIndex(): void {
    const q = this.unplacedIsoQueue();
    this.dockActiveIndex = clampDockIndex(this.dockActiveIndex, q.length);
  }

  private syncFlagDockNav(): void {
    const q = this.unplacedIsoQueue();
    updateDockNavButtons('flag', isCompactGameLayout(), q.length, this.dockActiveIndex);
  }

  private bindDockWheel(): void {
    this.unbindDockWheel();
    if (!this.dockEl) return;
    this.dockWheelHandler = (e: WheelEvent): void => {
      if (!isCompactGameLayout() || this.dockEl?.classList.contains('hidden')) return;
      const dx = e.deltaX;
      const dy = e.deltaY;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
        e.preventDefault();
        this.dockNavigateStep(dx > 0 ? 1 : -1);
      } else if ((e.shiftKey || e.altKey) && Math.abs(dy) > 8) {
        e.preventDefault();
        this.dockNavigateStep(dy > 0 ? 1 : -1);
      }
    };
    this.dockEl.addEventListener('wheel', this.dockWheelHandler, { passive: false });
  }

  private unbindDockWheel(): void {
    if (this.dockWheelHandler && this.dockEl) {
      this.dockEl.removeEventListener('wheel', this.dockWheelHandler);
    }
    this.dockWheelHandler = null;
  }

  zoomIn(): void {
    this.zoomAtCanvasCenter(ZOOM_STEP);
  }

  zoomOut(): void {
    this.zoomAtCanvasCenter(1 / ZOOM_STEP);
  }

  resetView(): void {
    this.resetCameraToMap();
  }

  giveUp(): void {
    if (this.winPhase !== 'none' || this.gameStartMs === null) return;
    this.gaveUp = true;
    for (const iso3 of this.countriesList) {
      this.placed.add(iso3);
      const img = this.flagImages.get(iso3);
      if (img) this.renderer.setTileFlag(iso3, img);
    }
    this.frozenElapsedMs = abandonFrozenElapsedMs(this.gameStartMs);
    this.winPhase = 'victory';
    this.endCanvasPan();
    this.endDrag();
    this.refreshDock();
    this.emitHud();
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
    this.camera.cx *= sx;
    this.camera.cy *= sy;
  }

  private rebuildTiles(): void {
    if (!this.fc) return;
    const { tiles, borderConnectors } = buildMapTiles(
      this.canvas,
      this.fc,
      this.countriesList,
      'assembled',
      true,
      this.mapViewBBoxClamp,
    );
    this.tiles = tiles;
    this.borderConnectors = borderConnectors;
    this.renderer.clearTileFlags();
    for (const id of this.placed) {
      const img = this.flagImages.get(id);
      if (img) this.renderer.setTileFlag(id, img);
    }
    this.resetCameraToMap();
  }

  private appendFlagDockButton(iso3: string): void {
    if (!this.dockEl) return;
    const img = this.flagImages.get(iso3);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = img ? 'flag-dock-item' : 'flag-dock-item flag-dock-item--text';
    btn.dataset['iso3'] = iso3;
    btn.title = pickUiString('game.dock.dragFlag', getLocale());
    if (img) {
      const thumb = document.createElement('img');
      thumb.src = img.src;
      thumb.alt = '';
      thumb.draggable = false;
      btn.appendChild(thumb);
    } else {
      btn.textContent = iso3;
    }
    if (iso3 === this.selectedIso3) btn.classList.add('flag-dock-item--selected');
    btn.addEventListener('pointerdown', this.onDockPointerDown);
    this.dockEl.appendChild(btn);
  }

  private fillDock(): void {
    if (!this.dockEl) return;
    this.dockEl.replaceChildren();
    const queue = this.unplacedIsoQueue();
    if (this.selectedIso3 && !queue.includes(this.selectedIso3)) this.selectedIso3 = null;
    this.clampFlagDockIndex();
    const compact = isCompactGameLayout();

    if (compact) {
      if (queue.length === 0) {
        this.syncFlagDockNav();
        return;
      }
      this.appendFlagDockButton(queue[this.dockActiveIndex]!);
    } else {
      for (const iso3 of queue) {
        this.appendFlagDockButton(iso3);
      }
    }
    this.syncFlagDockNav();
  }

  private refreshDock(): void {
    this.fillDock();
  }

  private clearFlagDragPointerListeners(): void {
    const el = this.flagDragSourceEl;
    if (!el) return;
    el.removeEventListener('pointermove', this.onFlagDragPointerMove);
    el.removeEventListener('pointerup', this.onFlagDragPointerEnd);
    el.removeEventListener('pointercancel', this.onFlagDragPointerEnd);
    this.flagDragSourceEl = null;
  }

  private onDockPointerDown = (e: PointerEvent): void => {
    const t = e.currentTarget as HTMLElement;
    const iso3 = t.dataset['iso3'];
    if (!iso3 || this.placed.has(iso3) || e.button !== 0) return;
    e.preventDefault();

    if (isCompactGameLayout()) {
      this.selectedIso3 = this.selectedIso3 === iso3 ? null : iso3;
      this.fillDock();
      this.emitHud();
      return;
    }

    this.dragIso3 = iso3;
    const g = document.createElement('div');
    g.className = 'flag-drag-ghost';
    const srcImg = t.querySelector('img');
    if (srcImg) {
      const im = document.createElement('img');
      im.src = srcImg.src;
      g.appendChild(im);
    } else {
      g.textContent = iso3;
    }
    document.body.appendChild(g);
    this.ghostEl = g;
    this.moveGhost(e.clientX, e.clientY);

    this.flagDragSourceEl = t;
    try {
      t.setPointerCapture(e.pointerId);
    } catch {
      /* navigateurs très anciens */
    }
    t.addEventListener('pointermove', this.onFlagDragPointerMove, { passive: false });
    t.addEventListener('pointerup', this.onFlagDragPointerEnd);
    t.addEventListener('pointercancel', this.onFlagDragPointerEnd);
  };

  private onFlagDragPointerMove = (e: PointerEvent): void => {
    if (!this.ghostEl) return;
    e.preventDefault();
    this.moveGhost(e.clientX, e.clientY);
  };

  private onFlagDragPointerEnd = (e: PointerEvent): void => {
    this.clearFlagDragPointerListeners();

    const iso3 = this.dragIso3;
    this.dragIso3 = null;
    if (this.ghostEl) {
      this.ghostEl.remove();
      this.ghostEl = null;
    }

    if (!iso3) return;

    const rect = this.canvas.getBoundingClientRect();
    const inside =
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom;
    if (!inside) return;

    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const sx = (e.clientX - rect.left) * scaleX;
    const sy = (e.clientY - rect.top) * scaleY;
    const w = this.screenToWorld(sx, sy);
    this.placeIsoAtWorldPoint(iso3, w.x, w.y);
  };

  private endDrag(): void {
    this.clearFlagDragPointerListeners();
    this.dragIso3 = null;
    if (this.ghostEl) {
      this.ghostEl.remove();
      this.ghostEl = null;
    }
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

  private clientToCanvasPixels(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  private onCanvasPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0 || this.dragIso3 || this.ghostEl) return;
    const { x, y } = this.clientToCanvasPixels(e.clientX, e.clientY);
    if (this.topTileAt(x, y)) return;
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
    if (this.canvasPan !== null && e.pointerId === this.panPointerId) {
      this.endCanvasPan();
      return;
    }
    if (!isCompactGameLayout() || this.dragIso3 || this.ghostEl) return;
    if (!this.selectedIso3) return;

    const rect = this.canvas.getBoundingClientRect();
    const inside =
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom;
    if (!inside) return;

    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const sx = (e.clientX - rect.left) * scaleX;
    const sy = (e.clientY - rect.top) * scaleY;
    const w = this.screenToWorld(sx, sy);
    this.placeIsoAtWorldPoint(this.selectedIso3, w.x, w.y);
  };

  private moveGhost(clientX: number, clientY: number): void {
    if (!this.ghostEl) return;
    const w = 72;
    this.ghostEl.style.width = `${w}px`;
    this.ghostEl.style.left = `${clientX - w / 2}px`;
    this.ghostEl.style.top = `${clientY - w / 2}px`;
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

  private topTileAt(screenX: number, screenY: number): Tile | null {
    const { x, y } = this.screenToWorld(screenX, screenY);
    const sorted = [...this.tiles].sort((a, b) => b.zIndex - a.zIndex);
    for (const tile of sorted) {
      if (tile.containsPoint(x, y)) return tile;
    }
    return null;
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

  private resetCameraToMap(): void {
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

  private placeIsoAtWorldPoint(iso3: string, worldX: number, worldY: number): void {
    const tile = this.tiles.find((t) => t.id === iso3);
    if (!tile || !tileContainsPointWithDropHalo(tile, worldX, worldY)) return;
    const img = this.flagImages.get(iso3);
    if (!img) return;

    this.placed.add(iso3);
    this.renderer.setTileFlag(iso3, img);
    if (this.selectedIso3 === iso3) this.selectedIso3 = null;
    this.refreshDock();
    this.updateWinState();
    this.emitHud();
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
    this.renderer.setConnectedPairs(new Set());
    this.renderer.draw(this.tiles, this.borderConnectors, this.camera);
    this.emitHud();
  }

  private getElapsedMs(): number {
    if (this.gameStartMs === null) return 0;
    if (this.frozenElapsedMs !== null) return this.frozenElapsedMs;
    return performance.now() - this.gameStartMs;
  }

  private emitHud(): void {
    const total = this.countriesList.length;
    const connected = this.placed.size;
    const elapsedMs = this.getElapsedMs();
    let score = computeFlagHudScore(connected, total, elapsedMs / 1000, this.flagDifficulty);
    if (this.gaveUp) score = scoreAfterAbandonFlat(score);
    const rawV =
      this.frozenElapsedMs !== null
        ? computeFlagHudScore(connected, total, this.frozenElapsedMs / 1000, this.flagDifficulty)
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
      connected,
      total,
      elapsedMs,
      score,
      isComplete: this.winPhase !== 'none',
      victorySummary,
    });
  }

  private updateWinState(): void {
    const total = this.countriesList.length;
    const won = this.placed.size === total && total > 0;
    if (won && this.winPhase === 'none' && this.gameStartMs !== null) {
      this.frozenElapsedMs = performance.now() - this.gameStartMs;
      this.winPhase = 'victory';
    }
    if (!won) {
      this.winPhase = 'none';
      this.frozenElapsedMs = null;
    }
  }

  private onWheel = (e: WheelEvent): void => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const { x, y } = this.canvasPos(e);
      const factor = e.deltaY > 0 ? 1 / 1.1 : 1.1;
      this.zoomAtScreen(x, y, factor);
    }
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
    this.unbindPinch = bindCanvasPinchZoom(this.canvas, (x, y, factor) =>
      this.zoomAtScreen(x, y, factor),
    );
  }

  private unbindEvents(): void {
    this.unbindPinch?.();
    this.unbindPinch = null;
    this.endCanvasPan();
    this.canvas.removeEventListener('pointerdown', this.onCanvasPointerDown);
    this.canvas.removeEventListener('pointermove', this.onCanvasPointerMove);
    this.canvas.removeEventListener('pointerup', this.onCanvasPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onCanvasPointerUp);
    this.canvas.removeEventListener('wheel', this.onWheel);
    this.canvas.removeEventListener('keydown', this.onCanvasKeyDown);
  }
}

import './style.css';
import { initMenu, resetMenuToGamePick } from './menu.ts';
import { Game, type GameHudState } from './game/Game.ts';
import { FlagMapGame } from './game/FlagMapGame.ts';
import { CapitalsGame } from './game/CapitalsGame.ts';
import { CountryLabelsGame } from './game/CountryLabelsGame.ts';
import { REGIONS } from './data/regionConfig.ts';
import {
  FR_DEPARTMENT_CAPITALS,
  US_STATE_CAPITAL_ENTRIES,
  WORLD_CONTINENT_CAPITALS,
} from './data/worldRegions.generated.ts';
import { NORTH_AFRICA_CAPITALS } from './data/northAfricaCapitals.ts';
import { getDisplayOptionsFromMenuSelection, initDifficultyMenu } from './gameDifficulty.ts';
import { getFlagDifficultyFromMenu, initFlagDifficultyMenu } from './flagDifficulty.ts';
import {
  getCapitalsDifficultyFromMenuSelection,
  initCapitalsDifficultyMenu,
  type CapitalsDifficultyId,
} from './capitalsDifficulty.ts';
import {
  getCountryLabelDifficultyFromMenu,
  initCountryLabelDifficultyMenu,
} from './countryLabelDifficulty.ts';
import type { GameTypeId } from './gameModes.ts';

/** Pool capitales pour tous les modes « capitales » (filtré par pays de la carte). */
const ALL_MAP_CAPITALS = [
  ...NORTH_AFRICA_CAPITALS,
  ...WORLD_CONTINENT_CAPITALS,
  ...FR_DEPARTMENT_CAPITALS,
  ...US_STATE_CAPITAL_ENTRIES,
];

type ActiveGame = Game | FlagMapGame | CapitalsGame | CountryLabelsGame;

let currentGame: ActiveGame | null = null;
let currentRegionId: string | null = null;
let currentGameKind: 'puzzle' | 'flag' | 'capitals' | 'country-labels' = 'puzzle';
let victoryPanelOpen = false;

function showScreen(id: string): void {
  document.querySelectorAll<HTMLElement>('.screen').forEach((s) => {
    s.classList.add('hidden');
  });
  document.getElementById(id)?.classList.remove('hidden');
}

function setGameScreenKind(
  kind: 'puzzle' | 'flag' | 'capitals' | 'country-labels',
  capitalsDiff?: CapitalsDifficultyId,
): void {
  const screen = document.getElementById('screen-game');
  if (screen) screen.dataset['gameKind'] = kind;
  const flagDock = document.getElementById('flag-dock');
  const capitalsDock = document.getElementById('capitals-dock');
  if (flagDock) flagDock.classList.toggle('hidden', kind !== 'flag');
  if (capitalsDock) capitalsDock.classList.toggle('hidden', kind !== 'capitals' && kind !== 'country-labels');

  const label = document.getElementById('progress-label');
  const hint = document.getElementById('game-hint');
  const desc = document.getElementById('victory-desc');
  const eyebrow = document.getElementById('victory-eyebrow');
  const title = document.getElementById('victory-title');

  if (label) {
    label.textContent =
      kind === 'flag'
        ? 'Drapeaux'
        : kind === 'capitals'
          ? 'Capitales'
          : kind === 'country-labels'
            ? 'Noms'
            : 'Connexions';
  }
  if (hint) {
    if (kind === 'flag') {
      hint.textContent =
        'Dock gauche → bon pays · Ctrl+molette ou +/−/0 : zoom';
    } else if (kind === 'country-labels') {
      hint.textContent =
        'Nom gauche → bon pays · Sinon retour dock · Ctrl+molette ou +/−/0 : zoom';
    } else if (kind === 'capitals') {
      const d = capitalsDiff ?? 'near-capital';
      if (d === 'in-country') {
        hint.textContent =
          'Gauche → pays cible · Mauvais pays : reprendre le pin · Ctrl+molette ou +/−/0 : zoom';
      } else if (d === 'expert-decoys') {
        hint.textContent =
          'Villes à gauche · Erreur : pin → dock · Leurres : retour auto · Ctrl+molette : zoom';
      } else {
        hint.textContent =
          'Gauche → carte · Mal placé : pin → dock pour réessayer · Ctrl+molette ou +/−/0 : zoom';
      }
    } else {
      hint.textContent =
        'Chrono · score · Molette : rotation · Double-clic : nord (selon diff.) · Ctrl+molette : zoom · Relâcher : aimant';
    }
  }
  if (desc) {
    if (kind === 'flag') {
      desc.textContent = 'Tous les drapeaux au bon pays.';
    } else if (kind === 'country-labels') {
      desc.textContent = 'Tous les noms bien placés.';
    } else if (kind === 'capitals') {
      const d = capitalsDiff ?? 'near-capital';
      if (d === 'in-country') {
        desc.textContent = 'Toutes les capitales dans le bon pays.';
      } else if (d === 'expert-decoys') {
        desc.textContent = 'Capitales OK · leurres ignorés.';
      } else {
        desc.textContent = 'Capitales au bon endroit.';
      }
    } else {
      desc.textContent = 'Toutes les frontières reliées.';
    }
  }
  if (eyebrow) {
    eyebrow.textContent =
      kind === 'flag'
        ? 'Drapeaux posés'
        : kind === 'capitals'
          ? 'Capitales placées'
          : kind === 'country-labels'
            ? 'Noms placés'
            : 'Puzzle résolu';
  }
  if (title) {
    title.textContent = 'Bravo !';
  }
}

function sizeCanvas(canvas: HTMLCanvasElement): void {
  const wrap = document.getElementById('game-canvas-wrap');
  const header = document.getElementById('game-header');
  const hint = document.getElementById('game-hint');
  const headerH = header?.offsetHeight ?? 52;
  const hintH = hint?.offsetHeight ?? 32;
  const fallbackH = Math.max(window.innerHeight - headerH - hintH - 4, 400);
  let w = window.innerWidth;
  let h = fallbackH;
  if (wrap) {
    const r = wrap.getBoundingClientRect();
    if (r.width >= 2) w = Math.floor(r.width);
    if (r.height >= 2) h = Math.floor(r.height);
  }
  canvas.width = w;
  canvas.height = h;
}

function syncVictoryPanelLayout(canvas: HTMLCanvasElement): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const ow = canvas.width;
      const oh = canvas.height;
      sizeCanvas(canvas);
      if (currentGame && (canvas.width !== ow || canvas.height !== oh)) {
        currentGame.rescaleWorldFromCanvasResize(ow, oh);
      }
    });
  });
}

function applyHudToDom(hud: GameHudState, canvas: HTMLCanvasElement): void {
  const timeEl = document.getElementById('game-time');
  const scoreEl = document.getElementById('score-count');
  const maxEl = document.getElementById('score-max');
  const pointsEl = document.getElementById('score-points');
  if (timeEl) {
    const sec = Math.floor(hud.elapsedMs / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    timeEl.textContent = `${m}:${s.toString().padStart(2, '0')}`;
  }
  if (scoreEl) scoreEl.textContent = String(hud.connected);
  if (maxEl) maxEl.textContent = String(hud.total);
  if (pointsEl) pointsEl.textContent = String(hud.score);

  const open = hud.victorySummary !== null;
  if (open !== victoryPanelOpen) {
    victoryPanelOpen = open;
    const panel = document.getElementById('victory-panel');
    if (open && hud.victorySummary) {
      panel?.classList.remove('hidden');
      panel?.setAttribute('aria-hidden', 'false');
      const tEl = document.getElementById('victory-time');
      const sEl = document.getElementById('victory-score');
      if (tEl) tEl.textContent = hud.victorySummary.timeLabel;
      if (sEl) sEl.textContent = String(hud.victorySummary.score);
      document.getElementById('btn-victory-replay')?.focus();
    } else {
      panel?.classList.add('hidden');
      panel?.setAttribute('aria-hidden', 'true');
    }
    syncVictoryPanelLayout(canvas);
  }
}

async function startPuzzleGame(regionId: string): Promise<void> {
  const region = REGIONS.find((r) => r.id === regionId);
  if (!region) return;

  currentRegionId = regionId;
  currentGameKind = 'puzzle';
  victoryPanelOpen = false;
  document.getElementById('victory-panel')?.classList.add('hidden');
  document.getElementById('victory-panel')?.setAttribute('aria-hidden', 'true');

  showScreen('screen-game');
  setGameScreenKind('puzzle');

  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const titleBar = document.getElementById('game-title-bar');
  if (titleBar) titleBar.textContent = `World Puzzle — ${region.label}`;

  sizeCanvas(canvas);

  const displayOpts = getDisplayOptionsFromMenuSelection();

  currentGame?.stop();
  currentGame = new Game(canvas, (hud) => {
    applyHudToDom(hud, canvas);
  }, displayOpts);

  await currentGame.load(region.geojsonUrl, region.countries);
}

async function startFlagGame(regionId: string): Promise<void> {
  const region = REGIONS.find((r) => r.id === regionId);
  if (!region) return;

  currentRegionId = regionId;
  currentGameKind = 'flag';
  victoryPanelOpen = false;
  document.getElementById('victory-panel')?.classList.add('hidden');
  document.getElementById('victory-panel')?.setAttribute('aria-hidden', 'true');

  showScreen('screen-game');
  setGameScreenKind('flag');

  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const titleBar = document.getElementById('game-title-bar');
  const flagDiff = getFlagDifficultyFromMenu();
  if (titleBar) {
    titleBar.textContent = `World Puzzle — Drapeaux · niv. ${flagDiff} · ${region.label}`;
  }

  sizeCanvas(canvas);

  const dock = document.getElementById('flag-dock');

  currentGame?.stop();
  const fg = new FlagMapGame(canvas, (hud) => {
    applyHudToDom(hud, canvas);
  });
  fg.setDockElement(dock);
  currentGame = fg;

  await fg.load(region.geojsonUrl, region.countries, flagDiff);
}

async function startCapitalsGame(regionId: string): Promise<void> {
  const region = REGIONS.find((r) => r.id === regionId);
  if (!region) return;

  currentRegionId = regionId;
  currentGameKind = 'capitals';
  victoryPanelOpen = false;
  document.getElementById('victory-panel')?.classList.add('hidden');
  document.getElementById('victory-panel')?.setAttribute('aria-hidden', 'true');

  const capitalsDiff = getCapitalsDifficultyFromMenuSelection();

  showScreen('screen-game');
  setGameScreenKind('capitals', capitalsDiff);

  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const titleBar = document.getElementById('game-title-bar');
  if (titleBar) {
    const dLabel =
      capitalsDiff === 'in-country' ? 'Pays' : capitalsDiff === 'expert-decoys' ? 'Pièges' : 'Capitale';
    titleBar.textContent = `World Puzzle — Capitales · ${dLabel} · ${region.label}`;
  }

  sizeCanvas(canvas);

  currentGame?.stop();
  const capitalsDock = document.getElementById('capitals-dock');
  capitalsDock?.setAttribute('aria-label', 'Capitales à placer sur la carte');
  const cg = new CapitalsGame(canvas, (hud: GameHudState) => {
    applyHudToDom(hud, canvas);
  });
  cg.setDockElement(capitalsDock);
  currentGame = cg;

  await cg.load(region.geojsonUrl, region.countries, capitalsDiff, ALL_MAP_CAPITALS);
}

async function startCountryLabelsGame(regionId: string): Promise<void> {
  const region = REGIONS.find((r) => r.id === regionId);
  if (!region) return;

  currentRegionId = regionId;
  currentGameKind = 'country-labels';
  victoryPanelOpen = false;
  document.getElementById('victory-panel')?.classList.add('hidden');
  document.getElementById('victory-panel')?.setAttribute('aria-hidden', 'true');

  const labelDiff = getCountryLabelDifficultyFromMenu();

  showScreen('screen-game');
  setGameScreenKind('country-labels');

  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const titleBar = document.getElementById('game-title-bar');
  if (titleBar) {
    titleBar.textContent = `World Puzzle — Noms sur la carte · niv. ${labelDiff} · ${region.label}`;
  }

  sizeCanvas(canvas);

  currentGame?.stop();
  const dock = document.getElementById('capitals-dock');
  dock?.setAttribute('aria-label', 'Noms de pays à placer sur la carte');
  const lg = new CountryLabelsGame(canvas, (hud: GameHudState) => {
    applyHudToDom(hud, canvas);
  });
  lg.setDockElement(dock);
  currentGame = lg;

  await lg.load(region.geojsonUrl, region.countries, labelDiff);
}

async function handleMenuStart(sel: { gameType: GameTypeId; regionId: string }): Promise<void> {
  if (sel.gameType === 'puzzle-country') {
    await startPuzzleGame(sel.regionId);
  } else if (sel.gameType === 'flag-match') {
    await startFlagGame(sel.regionId);
  } else if (sel.gameType === 'capitals-map') {
    await startCapitalsGame(sel.regionId);
  } else if (sel.gameType === 'country-labels-map') {
    await startCountryLabelsGame(sel.regionId);
  }
}

function replayCurrentMode(): void {
  if (!currentRegionId) return;
  if (currentGameKind === 'flag') void startFlagGame(currentRegionId);
  else if (currentGameKind === 'capitals') void startCapitalsGame(currentRegionId);
  else if (currentGameKind === 'country-labels') void startCountryLabelsGame(currentRegionId);
  else void startPuzzleGame(currentRegionId);
}

function backToMenu(): void {
  victoryPanelOpen = false;
  document.getElementById('victory-panel')?.classList.add('hidden');
  document.getElementById('victory-panel')?.setAttribute('aria-hidden', 'true');
  currentGame?.stop();
  currentGame = null;
  currentRegionId = null;
  currentGameKind = 'puzzle';
  showScreen('screen-menu');
  resetMenuToGamePick();
}

function onWindowResize(): void {
  if (!currentGame) return;
  const gameScreen = document.getElementById('screen-game');
  if (gameScreen?.classList.contains('hidden')) return;
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
  if (!canvas) return;
  sizeCanvas(canvas);
  currentGame.relayout();
}

document.addEventListener('DOMContentLoaded', () => {
  initDifficultyMenu();
  initFlagDifficultyMenu();
  initCapitalsDifficultyMenu();
  initCountryLabelDifficultyMenu();
  initMenu((sel) => {
    void handleMenuStart(sel);
  });
  document.getElementById('btn-back')?.addEventListener('click', backToMenu);
  document.getElementById('btn-zoom-in')?.addEventListener('click', () => currentGame?.zoomIn());
  document.getElementById('btn-zoom-out')?.addEventListener('click', () => currentGame?.zoomOut());
  document.getElementById('btn-zoom-reset')?.addEventListener('click', () => currentGame?.resetView());
  document.getElementById('btn-victory-replay')?.addEventListener('click', () => replayCurrentMode());
  document.getElementById('btn-victory-menu')?.addEventListener('click', () => backToMenu());
  window.addEventListener('resize', onWindowResize);
  showScreen('screen-menu');
});

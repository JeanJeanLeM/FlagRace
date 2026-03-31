import './style.css';
import {
  applyDomI18n,
  getLocale,
  initDocumentLang,
  regionLabelForPlay,
  setLocale,
  subscribeLocale,
  t,
} from './i18n/index.ts';
import { initMenu, resetMenuToGamePick } from './menu.ts';
import { Game, type GameHudState } from './game/Game.ts';
import { ABANDON_FLAT_SCORE_PENALTY } from './game/abandon.ts';
import { FlagMapGame } from './game/FlagMapGame.ts';
import { CapitalsGame } from './game/CapitalsGame.ts';
import { CountryLabelsGame } from './game/CountryLabelsGame.ts';
import { REGIONS } from './data/regionConfig.ts';
import {
  FR_DEPARTMENT_CAPITALS,
  US_STATE_CAPITAL_ENTRIES,
  WORLD_CONTINENT_CAPITALS,
} from './data/worldRegions.generated.ts';
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
import { initAdsense } from './adsense.ts';
import { isCompactGameLayout } from './game/compactDock.ts';

/** Pool capitales pour tous les modes « capitales » (filtré par pays de la carte). */
const ALL_MAP_CAPITALS = [
  ...WORLD_CONTINENT_CAPITALS,
  ...FR_DEPARTMENT_CAPITALS,
  ...US_STATE_CAPITAL_ENTRIES,
];

type ActiveGame = Game | FlagMapGame | CapitalsGame | CountryLabelsGame;

let currentGame: ActiveGame | null = null;
let currentRegionId: string | null = null;
let currentGameKind: 'puzzle' | 'flag' | 'capitals' | 'country-labels' = 'puzzle';
let victoryPanelOpen = false;
/** Dernière fin de partie « abandon » pour rafraîchir les textes si la langue change. */
let lastVictoryGaveUp = false;

initDocumentLang();

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
  const flagShell = document.getElementById('flag-dock-shell');
  const capShell = document.getElementById('capitals-dock-shell');
  if (flagShell) flagShell.classList.toggle('hidden', kind !== 'flag');
  if (capShell) capShell.classList.toggle('hidden', kind !== 'capitals' && kind !== 'country-labels');

  const label = document.getElementById('progress-label');
  const hint = document.getElementById('game-hint');
  const desc = document.getElementById('victory-desc');
  const eyebrow = document.getElementById('victory-eyebrow');
  const title = document.getElementById('victory-title');

  if (label) {
    label.textContent =
      kind === 'flag'
        ? t('game.progress.flags')
        : kind === 'capitals'
          ? t('game.progress.capitals')
          : kind === 'country-labels'
            ? t('game.progress.names')
            : t('game.progress.connections');
  }
  if (hint) {
    let hintText = t('game.hint.puzzle');
    if (kind === 'flag') {
      hintText = t('game.hint.flag');
    } else if (kind === 'country-labels') {
      hintText = t('game.hint.labels');
    } else if (kind === 'capitals') {
      const d = capitalsDiff ?? 'near-capital';
      if (d === 'in-country') {
        hintText = t('game.hint.capitals.inCountry');
      } else if (d === 'expert-decoys') {
        hintText = t('game.hint.capitals.decoys');
      } else {
        hintText = t('game.hint.capitals.near');
      }
    }
    if (kind !== 'puzzle' && isCompactGameLayout()) {
      hintText += ' ' + t('game.hint.mobileDockSuffix');
    }
    hint.textContent = hintText;
  }
  if (desc) {
    if (kind === 'flag') {
      desc.textContent = t('victory.desc.flags');
    } else if (kind === 'country-labels') {
      desc.textContent = t('victory.desc.labels');
    } else if (kind === 'capitals') {
      const d = capitalsDiff ?? 'near-capital';
      if (d === 'in-country') {
        desc.textContent = t('victory.desc.capitals.inCountry');
      } else if (d === 'expert-decoys') {
        desc.textContent = t('victory.desc.capitals.decoys');
      } else {
        desc.textContent = t('victory.desc.capitals.near');
      }
    } else {
      desc.textContent = t('victory.desc.puzzle');
    }
  }
  if (eyebrow) {
    eyebrow.textContent =
      kind === 'flag'
        ? t('victory.eyebrow.flagsPlaced')
        : kind === 'capitals'
          ? t('victory.eyebrow.capitalsPlaced')
          : kind === 'country-labels'
            ? t('victory.eyebrow.namesPlaced')
            : t('victory.eyebrow.puzzleSolved');
  }
  if (title) {
    title.textContent = t('victory.title.win');
  }
}

function measuredGameHeaderHeight(): number {
  const desk = document.getElementById('game-header');
  const mob = document.getElementById('game-header-mobile');
  const h = Math.max(desk?.offsetHeight ?? 0, mob?.offsetHeight ?? 0);
  return h > 0 ? h : 52;
}

/** Bottom dock bar height in compact layout (≤900px), for canvas fallback sizing. */
function measuredVisibleDockShellHeight(): number {
  let h = 0;
  const cap = document.getElementById('capitals-dock-shell');
  const fl = document.getElementById('flag-dock-shell');
  if (cap && !cap.classList.contains('hidden')) h += cap.offsetHeight;
  if (fl && !fl.classList.contains('hidden')) h += fl.offsetHeight;
  return h;
}

function sizeCanvas(canvas: HTMLCanvasElement): void {
  const wrap = document.getElementById('game-canvas-wrap');
  const hint = document.getElementById('game-hint');
  const headerH = measuredGameHeaderHeight();
  const hintH = hint?.offsetHeight ?? 32;
  const dockH = isCompactGameLayout() ? measuredVisibleDockShellHeight() : 0;
  const fallbackH = Math.max(window.innerHeight - headerH - hintH - dockH - 4, 400);
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

  const mobileStats = document.getElementById('game-stats-mobile-line');
  if (mobileStats) {
    const sec = Math.floor(hud.elapsedMs / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    const timeStr = `${m}:${s.toString().padStart(2, '0')}`;
    mobileStats.textContent = `${timeStr} · ${hud.connected}/${hud.total} · ${hud.score}`;
  }

  const abandonBtn = document.getElementById('btn-abandon');
  if (abandonBtn instanceof HTMLButtonElement) {
    abandonBtn.disabled = hud.isComplete;
  }
  const abandonMenu = document.querySelector<HTMLButtonElement>('[data-game-action="abandon"]');
  if (abandonMenu) abandonMenu.disabled = hud.isComplete;

  const open = hud.victorySummary !== null;
  if (open !== victoryPanelOpen) {
    victoryPanelOpen = open;
    const panel = document.getElementById('victory-panel');
    if (open && hud.victorySummary) {
      lastVictoryGaveUp = !!hud.victorySummary.gaveUp;
      panel?.classList.remove('hidden');
      panel?.setAttribute('aria-hidden', 'false');
      const tEl = document.getElementById('victory-time');
      const sEl = document.getElementById('victory-score');
      if (tEl) tEl.textContent = hud.victorySummary.timeLabel;
      if (sEl) sEl.textContent = String(hud.victorySummary.score);
      const eyebrow = document.getElementById('victory-eyebrow');
      const vTitle = document.getElementById('victory-title');
      const desc = document.getElementById('victory-desc');
      if (hud.victorySummary.gaveUp) {
        if (eyebrow) eyebrow.textContent = t('victory.eyebrow.gaveUp');
        if (vTitle) vTitle.textContent = t('victory.title.gaveUp');
        if (desc) {
          desc.textContent = t('victory.desc.gaveUp', { penalty: ABANDON_FLAT_SCORE_PENALTY });
        }
      }
      document.getElementById('btn-victory-replay')?.focus();
    } else {
      lastVictoryGaveUp = false;
      panel?.classList.add('hidden');
      panel?.setAttribute('aria-hidden', 'true');
    }
    syncVictoryPanelLayout(canvas);
  }
}

function updateGameTitleBar(): void {
  if (!currentRegionId) return;
  const titleBar = document.getElementById('game-title-bar');
  const menuTitle = document.getElementById('game-action-menu-title');
  const rlab = regionLabelForPlay(currentRegionId, getLocale());
  let full = '';
  if (currentGameKind === 'puzzle') {
    full = t('game.title.puzzle') + rlab;
  } else if (currentGameKind === 'flag') {
    const flagDiff = getFlagDifficultyFromMenu();
    full = `${t('game.title.flags')}${flagDiff} · ${rlab}`;
  } else if (currentGameKind === 'capitals') {
    const capitalsDiff = getCapitalsDifficultyFromMenuSelection();
    const dLabel =
      capitalsDiff === 'in-country'
        ? t('capitalsModeLabel.country')
        : capitalsDiff === 'expert-decoys'
          ? t('capitalsModeLabel.decoys')
          : t('capitalsModeLabel.capital');
    full = `${t('game.title.capitals')}${dLabel} · ${rlab}`;
  } else if (currentGameKind === 'country-labels') {
    const labelDiff = getCountryLabelDifficultyFromMenu();
    full = `${t('game.title.labels')}${labelDiff} · ${rlab}`;
  }
  if (titleBar) titleBar.textContent = full;
  if (menuTitle) menuTitle.textContent = full;
}

function refreshGameChromeI18n(): void {
  const gameScreen = document.getElementById('screen-game');
  if (!gameScreen || gameScreen.classList.contains('hidden')) return;
  const capDiff =
    currentGameKind === 'capitals' ? getCapitalsDifficultyFromMenuSelection() : undefined;
  setGameScreenKind(currentGameKind, capDiff);
  updateGameTitleBar();
  if (victoryPanelOpen && lastVictoryGaveUp) {
    const eyebrow = document.getElementById('victory-eyebrow');
    const vTitle = document.getElementById('victory-title');
    const desc = document.getElementById('victory-desc');
    if (eyebrow) eyebrow.textContent = t('victory.eyebrow.gaveUp');
    if (vTitle) vTitle.textContent = t('victory.title.gaveUp');
    if (desc) desc.textContent = t('victory.desc.gaveUp', { penalty: ABANDON_FLAT_SCORE_PENALTY });
  }
  notifyDockLayoutIfNeeded();
}

function syncLangToggleButtons(): void {
  const l = getLocale();
  const fr = document.getElementById('btn-lang-fr');
  const en = document.getElementById('btn-lang-en');
  if (fr) {
    fr.setAttribute('aria-pressed', l === 'fr' ? 'true' : 'false');
    fr.classList.toggle('lang-switch__btn--active', l === 'fr');
  }
  if (en) {
    en.setAttribute('aria-pressed', l === 'en' ? 'true' : 'false');
    en.classList.toggle('lang-switch__btn--active', l === 'en');
  }
}

async function startPuzzleGame(regionId: string): Promise<void> {
  const region = REGIONS.find((r) => r.id === regionId);
  if (!region) return;

  currentRegionId = regionId;
  currentGameKind = 'puzzle';
  victoryPanelOpen = false;
  lastVictoryGaveUp = false;
  document.getElementById('victory-panel')?.classList.add('hidden');
  document.getElementById('victory-panel')?.setAttribute('aria-hidden', 'true');

  showScreen('screen-game');
  setGameScreenKind('puzzle');

  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  updateGameTitleBar();

  sizeCanvas(canvas);

  const displayOpts = getDisplayOptionsFromMenuSelection();

  currentGame?.stop();
  currentGame = new Game(canvas, (hud) => {
    applyHudToDom(hud, canvas);
  }, displayOpts);

  await currentGame.load(region.geojsonUrl, region.countries, region.mapViewBBoxClamp);
}

async function startFlagGame(regionId: string): Promise<void> {
  const region = REGIONS.find((r) => r.id === regionId);
  if (!region) return;

  currentRegionId = regionId;
  currentGameKind = 'flag';
  victoryPanelOpen = false;
  lastVictoryGaveUp = false;
  document.getElementById('victory-panel')?.classList.add('hidden');
  document.getElementById('victory-panel')?.setAttribute('aria-hidden', 'true');

  showScreen('screen-game');
  setGameScreenKind('flag');

  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  updateGameTitleBar();

  sizeCanvas(canvas);

  const dock = document.getElementById('flag-dock');
  const flagDiff = getFlagDifficultyFromMenu();

  currentGame?.stop();
  const fg = new FlagMapGame(canvas, (hud) => {
    applyHudToDom(hud, canvas);
  });
  fg.setDockElement(dock);
  currentGame = fg;

  await fg.load(region.geojsonUrl, region.countries, flagDiff, region.mapViewBBoxClamp);
}

async function startCapitalsGame(regionId: string): Promise<void> {
  const region = REGIONS.find((r) => r.id === regionId);
  if (!region) return;

  currentRegionId = regionId;
  currentGameKind = 'capitals';
  victoryPanelOpen = false;
  lastVictoryGaveUp = false;
  document.getElementById('victory-panel')?.classList.add('hidden');
  document.getElementById('victory-panel')?.setAttribute('aria-hidden', 'true');

  const capitalsDiff = getCapitalsDifficultyFromMenuSelection();

  showScreen('screen-game');
  setGameScreenKind('capitals', capitalsDiff);

  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  updateGameTitleBar();

  sizeCanvas(canvas);

  currentGame?.stop();
  const capitalsDock = document.getElementById('capitals-dock');
  capitalsDock?.setAttribute('aria-label', t('game.dock.capitalsAria'));
  const cg = new CapitalsGame(canvas, (hud: GameHudState) => {
    applyHudToDom(hud, canvas);
  });
  cg.setDockElement(capitalsDock);
  cg.setDockHitElement(document.getElementById('capitals-dock-shell'));
  currentGame = cg;

  await cg.load(
    region.geojsonUrl,
    region.countries,
    capitalsDiff,
    ALL_MAP_CAPITALS,
    region.mapViewBBoxClamp,
  );
}

async function startCountryLabelsGame(regionId: string): Promise<void> {
  const region = REGIONS.find((r) => r.id === regionId);
  if (!region) return;

  currentRegionId = regionId;
  currentGameKind = 'country-labels';
  victoryPanelOpen = false;
  lastVictoryGaveUp = false;
  document.getElementById('victory-panel')?.classList.add('hidden');
  document.getElementById('victory-panel')?.setAttribute('aria-hidden', 'true');

  const labelDiff = getCountryLabelDifficultyFromMenu();

  showScreen('screen-game');
  setGameScreenKind('country-labels');

  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  updateGameTitleBar();

  sizeCanvas(canvas);

  currentGame?.stop();
  const dock = document.getElementById('capitals-dock');
  dock?.setAttribute('aria-label', t('game.dock.labelsAria'));
  const lg = new CountryLabelsGame(canvas, (hud: GameHudState) => {
    applyHudToDom(hud, canvas);
  });
  lg.setDockElement(dock);
  currentGame = lg;

  await lg.load(region.geojsonUrl, region.countries, labelDiff, region.mapViewBBoxClamp);
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

function closeGameActionMenu(): void {
  const panel = document.getElementById('game-action-menu-panel');
  const btn = document.getElementById('btn-game-menu');
  panel?.classList.add('hidden');
  panel?.setAttribute('aria-hidden', 'true');
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

function openGameActionMenu(): void {
  const panel = document.getElementById('game-action-menu-panel');
  const btn = document.getElementById('btn-game-menu');
  panel?.classList.remove('hidden');
  panel?.setAttribute('aria-hidden', 'false');
  if (btn) btn.setAttribute('aria-expanded', 'true');
}

function toggleGameActionMenu(): void {
  const panel = document.getElementById('game-action-menu-panel');
  if (!panel) return;
  if (panel.classList.contains('hidden')) openGameActionMenu();
  else closeGameActionMenu();
}

function notifyDockLayoutIfNeeded(): void {
  if (
    currentGame instanceof FlagMapGame ||
    currentGame instanceof CapitalsGame ||
    currentGame instanceof CountryLabelsGame
  ) {
    currentGame.onDockLayoutChange();
  }
}

function dockNavigateFromUi(delta: -1 | 1): void {
  if (!currentGame) return;
  if (currentGame instanceof FlagMapGame) currentGame.dockNavigateStep(delta);
  else if (currentGame instanceof CapitalsGame) currentGame.dockNavigateStep(delta);
  else if (currentGame instanceof CountryLabelsGame) currentGame.dockNavigateStep(delta);
}

function showGameHelpFromMenu(): void {
  closeGameActionMenu();
  const hint = document.getElementById('game-hint');
  hint?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  hint?.classList.add('game-hint--highlight');
  window.setTimeout(() => hint?.classList.remove('game-hint--highlight'), 2200);
}

function requestAbandonFromMenu(): void {
  closeGameActionMenu();
  if (!currentGame || victoryPanelOpen) return;
  if (!confirm(t('confirm.abandon'))) return;
  currentGame.giveUp();
}

function backToMenu(): void {
  closeGameActionMenu();
  victoryPanelOpen = false;
  lastVictoryGaveUp = false;
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
  notifyDockLayoutIfNeeded();
}

document.addEventListener('DOMContentLoaded', () => {
  applyDomI18n();
  syncLangToggleButtons();
  document.getElementById('btn-lang-fr')?.addEventListener('click', () => setLocale('fr'));
  document.getElementById('btn-lang-en')?.addEventListener('click', () => setLocale('en'));
  subscribeLocale(() => {
    applyDomI18n(document);
    syncLangToggleButtons();
    window.dispatchEvent(new CustomEvent('worldpuzzle-locale'));
    refreshGameChromeI18n();
  });

  initDifficultyMenu();
  initFlagDifficultyMenu();
  initCapitalsDifficultyMenu();
  initCountryLabelDifficultyMenu();
  initMenu((sel) => {
    void handleMenuStart(sel);
  });
  document.getElementById('btn-back')?.addEventListener('click', backToMenu);
  document.getElementById('btn-game-menu')?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleGameActionMenu();
  });
  document.addEventListener('pointerdown', (e) => {
    const panel = document.getElementById('game-action-menu-panel');
    const btn = document.getElementById('btn-game-menu');
    if (!panel || panel.classList.contains('hidden')) return;
    const n = e.target as Node;
    if (btn?.contains(n) || panel.contains(n)) return;
    closeGameActionMenu();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const panel = document.getElementById('game-action-menu-panel');
    if (!panel || panel.classList.contains('hidden')) return;
    closeGameActionMenu();
    document.getElementById('btn-game-menu')?.focus();
  });
  document.getElementById('game-action-menu-panel')?.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-game-action]');
    if (!el) return;
    const act = el.dataset['gameAction'];
    if (act === 'back') {
      closeGameActionMenu();
      backToMenu();
    } else if (act === 'abandon') {
      requestAbandonFromMenu();
    } else if (act === 'help') {
      showGameHelpFromMenu();
    } else if (act === 'zoom-in') {
      closeGameActionMenu();
      currentGame?.zoomIn();
    } else if (act === 'zoom-out') {
      closeGameActionMenu();
      currentGame?.zoomOut();
    } else if (act === 'zoom-reset') {
      closeGameActionMenu();
      currentGame?.resetView();
    }
  });
  document.getElementById('btn-abandon')?.addEventListener('click', () => {
    if (!currentGame || victoryPanelOpen) return;
    if (!confirm(t('confirm.abandon'))) {
      return;
    }
    currentGame.giveUp();
  });
  document.getElementById('btn-zoom-in')?.addEventListener('click', () => currentGame?.zoomIn());
  document.getElementById('btn-zoom-out')?.addEventListener('click', () => currentGame?.zoomOut());
  document.getElementById('btn-zoom-reset')?.addEventListener('click', () => currentGame?.resetView());
  document.getElementById('dock-nav-flag-prev')?.addEventListener('click', () => dockNavigateFromUi(-1));
  document.getElementById('dock-nav-flag-next')?.addEventListener('click', () => dockNavigateFromUi(1));
  document.getElementById('dock-nav-capitals-prev')?.addEventListener('click', () => dockNavigateFromUi(-1));
  document.getElementById('dock-nav-capitals-next')?.addEventListener('click', () => dockNavigateFromUi(1));
  document.getElementById('btn-victory-replay')?.addEventListener('click', () => replayCurrentMode());
  document.getElementById('btn-victory-menu')?.addEventListener('click', () => backToMenu());
  window.addEventListener('resize', onWindowResize);
  showScreen('screen-menu');
  initAdsense();
});

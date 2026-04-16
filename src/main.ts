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
import { ABANDON_FLAT_SCORE_PENALTY } from './game/abandon.ts';
import { FlagMapGame } from './game/FlagMapGame.ts';
import { REGIONS, resolveRegionId } from './data/regionConfig.ts';
import type { GameTypeId } from './gameModes.ts';
import { initAdsense } from './adsense.ts';
import { isCompactGameLayout } from './game/compactDock.ts';

type GameHudState = {
  connected: number;
  total: number;
  elapsedMs: number;
  score: number;
  isComplete: boolean;
  isAutoSolving: boolean;
  autoSolveCountryName: string | null;
  victorySummary: { timeLabel: string; score: number; gaveUp: boolean } | null;
};

let currentGame: FlagMapGame | null = null;
let currentRegionId: string | null = null;
let victoryPanelOpen = false;
let lastVictoryGaveUp = false;

initDocumentLang();

function gameHelpBodyText(): string {
  let hintText = t('game.hint.flag');
  if (isCompactGameLayout()) hintText += ' ' + t('game.hint.mobileDockSuffix');
  return hintText;
}

function syncGameHelpModalBody(): void {
  const el = document.getElementById('game-help-modal-text');
  if (el) el.textContent = gameHelpBodyText();
}

function showScreen(id: string): void {
  document.querySelectorAll<HTMLElement>('.screen').forEach((s) => s.classList.add('hidden'));
  document.getElementById(id)?.classList.remove('hidden');
}

function setGameScreenKind(): void {
  const screen = document.getElementById('screen-game');
  if (screen) screen.dataset['gameKind'] = 'flag';
  document.getElementById('flag-dock-shell')?.classList.remove('hidden');

  const label = document.getElementById('progress-label');
  const desc = document.getElementById('victory-desc');
  const eyebrow = document.getElementById('victory-eyebrow');
  const title = document.getElementById('victory-title');

  if (label) label.textContent = t('game.progress.flags');
  syncGameHelpModalBody();
  if (desc) desc.textContent = t('victory.desc.flags');
  if (eyebrow) eyebrow.textContent = t('victory.eyebrow.flagsPlaced');
  if (title) title.textContent = t('victory.title.win');
}

function measuredGameHeaderHeight(): number {
  const desk = document.getElementById('game-header');
  const mob = document.getElementById('game-header-mobile');
  const h = Math.max(desk?.offsetHeight ?? 0, mob?.offsetHeight ?? 0);
  return h > 0 ? h : 52;
}

function measuredVisibleDockShellHeight(): number {
  const fl = document.getElementById('flag-dock-shell');
  return fl && !fl.classList.contains('hidden') ? fl.offsetHeight : 0;
}

function sizeCanvas(canvas: HTMLCanvasElement): void {
  const wrap = document.getElementById('game-canvas-wrap');
  const headerH = measuredGameHeaderHeight();
  const dockH = isCompactGameLayout() ? measuredVisibleDockShellHeight() : 0;
  const fallbackH = Math.max(window.innerHeight - headerH - dockH - 4, 400);
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
    const autoPart = hud.autoSolveCountryName ? ` · ${t('game.stat.autoPlacing')}: ${hud.autoSolveCountryName}` : '';
    mobileStats.textContent = `${timeStr} · ${hud.connected}/${hud.total} · ${hud.score}${autoPart}`;
  }
  const autoCountryEl = document.getElementById('game-autosolve-country');
  const autoStatEl = document.getElementById('game-autosolve-stat');
  if (autoCountryEl && autoStatEl) {
    if (hud.autoSolveCountryName) {
      autoCountryEl.textContent = hud.autoSolveCountryName;
      autoStatEl.classList.remove('hidden');
    } else {
      autoCountryEl.textContent = '—';
      autoStatEl.classList.add('hidden');
    }
  }

  const abandonBtn = document.getElementById('btn-abandon');
  if (abandonBtn instanceof HTMLButtonElement) abandonBtn.disabled = hud.isComplete || hud.isAutoSolving;
  const abandonMenu = document.querySelector<HTMLButtonElement>('[data-game-action="abandon"]');
  if (abandonMenu) abandonMenu.disabled = hud.isComplete || hud.isAutoSolving;

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
        if (desc) desc.textContent = t('victory.desc.gaveUp', { penalty: ABANDON_FLAT_SCORE_PENALTY });
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
  const titleMobile = document.getElementById('game-title-mobile');
  const rlab = regionLabelForPlay(currentRegionId, getLocale());
  const full = `${t('game.title.flags')}1 · ${rlab}`;
  if (titleBar) titleBar.textContent = full;
  if (titleMobile) titleMobile.textContent = full;
}

function refreshGameChromeI18n(): void {
  const gameScreen = document.getElementById('screen-game');
  if (!gameScreen || gameScreen.classList.contains('hidden')) return;
  setGameScreenKind();
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

function syncLocaleAwareLinks(root: ParentNode = document): void {
  const locale = getLocale();
  root.querySelectorAll<HTMLAnchorElement>('a[data-link-role]').forEach((link) => {
    const role = link.dataset['linkRole'];
    if (role === 'how-to-play') {
      link.href = locale === 'en' ? '/how-to-play.html' : '/comment-jouer.html';
    } else if (role === 'faq') {
      link.href = locale === 'en' ? '/faq-en.html' : '/faq.html';
    } else if (role === 'about') {
      link.href = locale === 'en' ? '/about.html' : '/a-propos.html';
    }
  });
}

async function startFlagGame(regionId: string): Promise<void> {
  const id = resolveRegionId(regionId);
  const region = REGIONS.find((r) => r.id === id);
  if (!region) return;

  currentRegionId = id;
  victoryPanelOpen = false;
  lastVictoryGaveUp = false;
  document.getElementById('victory-panel')?.classList.add('hidden');
  document.getElementById('victory-panel')?.setAttribute('aria-hidden', 'true');

  showScreen('screen-game');
  setGameScreenKind();

  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  updateGameTitleBar();
  sizeCanvas(canvas);

  const dock = document.getElementById('flag-dock');
  currentGame?.stop();
  const fg = new FlagMapGame(canvas, (hud) => applyHudToDom(hud, canvas));
  fg.setDockElement(dock);
  currentGame = fg;
  await fg.load(region.geojsonUrl, region.countries, 1, region.mapViewBBoxClamp);
}

async function handleMenuStart(sel: { gameType: GameTypeId; regionId: string }): Promise<void> {
  if (sel.gameType === 'flag-match') {
    await startFlagGame(sel.regionId);
  }
}

function replayCurrentMode(): void {
  if (!currentRegionId) return;
  void startFlagGame(currentRegionId);
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
  if (currentGame instanceof FlagMapGame) currentGame.onDockLayoutChange();
}

function dockNavigateFromUi(delta: -1 | 1): void {
  if (currentGame instanceof FlagMapGame) currentGame.dockNavigateStep(delta);
}

function openGameHelpModal(): void {
  syncGameHelpModalBody();
  const modal = document.getElementById('game-help-modal');
  modal?.classList.remove('hidden');
  modal?.setAttribute('aria-hidden', 'false');
}

function closeGameHelpModal(): void {
  const modal = document.getElementById('game-help-modal');
  modal?.classList.add('hidden');
  modal?.setAttribute('aria-hidden', 'true');
}

function showGameHelpFromMenu(): void {
  closeGameActionMenu();
  openGameHelpModal();
}

function requestAbandonFromMenu(): void {
  closeGameActionMenu();
  if (!currentGame || victoryPanelOpen) return;
  if (!confirm(t('confirm.abandon'))) return;
  currentGame.giveUp();
}

function backToMenu(): void {
  closeGameActionMenu();
  closeGameHelpModal();
  victoryPanelOpen = false;
  lastVictoryGaveUp = false;
  document.getElementById('victory-panel')?.classList.add('hidden');
  document.getElementById('victory-panel')?.setAttribute('aria-hidden', 'true');
  currentGame?.stop();
  currentGame = null;
  currentRegionId = null;
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
  syncLocaleAwareLinks();

  document.getElementById('btn-lang-fr')?.addEventListener('click', () => setLocale('fr'));
  document.getElementById('btn-lang-en')?.addEventListener('click', () => setLocale('en'));

  subscribeLocale(() => {
    applyDomI18n(document);
    syncLangToggleButtons();
    syncLocaleAwareLinks();
    window.dispatchEvent(new CustomEvent('worldpuzzle-locale'));
    refreshGameChromeI18n();
  });

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
    const modal = document.getElementById('game-help-modal');
    if (modal && !modal.classList.contains('hidden')) {
      closeGameHelpModal();
      return;
    }
    const panel = document.getElementById('game-action-menu-panel');
    if (!panel || panel.classList.contains('hidden')) return;
    closeGameActionMenu();
    document.getElementById('btn-game-menu')?.focus();
  });

  document.getElementById('game-help-modal')?.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('[data-close-game-help]')) closeGameHelpModal();
  });

  document.getElementById('btn-game-help-desktop')?.addEventListener('click', () => openGameHelpModal());

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
    }
  });

  document.getElementById('btn-abandon')?.addEventListener('click', () => {
    if (!currentGame || victoryPanelOpen) return;
    if (!confirm(t('confirm.abandon'))) return;
    currentGame.giveUp();
  });

  document.getElementById('btn-zoom-in')?.addEventListener('click', () => currentGame?.zoomIn());
  document.getElementById('btn-zoom-out')?.addEventListener('click', () => currentGame?.zoomOut());
  document.getElementById('btn-zoom-reset')?.addEventListener('click', () => currentGame?.resetView());
  document.getElementById('btn-zoom-float-in')?.addEventListener('click', () => currentGame?.zoomIn());
  document.getElementById('btn-zoom-float-out')?.addEventListener('click', () => currentGame?.zoomOut());
  document.getElementById('btn-zoom-float-reset')?.addEventListener('click', () => currentGame?.resetView());
  document.getElementById('btn-mobile-zoom-in')?.addEventListener('click', () => currentGame?.zoomIn());
  document.getElementById('btn-mobile-zoom-out')?.addEventListener('click', () => currentGame?.zoomOut());
  document.getElementById('btn-mobile-zoom-reset')?.addEventListener('click', () => currentGame?.resetView());
  document.getElementById('dock-nav-flag-prev')?.addEventListener('click', () => dockNavigateFromUi(-1));
  document.getElementById('dock-nav-flag-next')?.addEventListener('click', () => dockNavigateFromUi(1));
  document.getElementById('btn-victory-replay')?.addEventListener('click', () => replayCurrentMode());
  document.getElementById('btn-victory-menu')?.addEventListener('click', () => backToMenu());

  window.addEventListener('resize', onWindowResize);
  showScreen('screen-menu');
  initAdsense();
});

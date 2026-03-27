import {
  REGION_CATALOG,
  REGIONS,
  catalogEntryForRegionId,
  getDefaultRegionId,
  regionSupportsFlags,
} from './data/regionConfig.ts';
import { DEFAULT_GAME_TYPE, GAME_TYPE_LABELS, type GameTypeId } from './gameModes.ts';

function renderRegionExtraChips(container: HTMLElement | null): void {
  if (!container) return;
  container.replaceChildren();
  for (const region of REGION_CATALOG) {
    if (!region.available) continue;
    if (region.showOnWorldMap !== false) continue;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'region-extra-chip';
    btn.dataset['region'] = region.id;
    btn.textContent = region.label;
    btn.setAttribute('aria-label', `${region.label}. ${region.descriptionLines.join(', ')}`);
    container.appendChild(btn);
  }
}

function syncPuzzleBlock(
  menuRoot: HTMLElement | null,
  puzzleDifficulty: HTMLElement | null,
  flagDifficulty: HTMLElement | null,
  capitalsDifficulty: HTMLElement | null,
  countryLabelDifficulty: HTMLElement | null,
  selectedGameType: GameTypeId,
): void {
  if (!menuRoot) return;
  const showPuzzleDifficulty = selectedGameType === 'puzzle-country';
  puzzleDifficulty?.classList.toggle('puzzle-only-menu--inactive', !showPuzzleDifficulty);
  puzzleDifficulty?.setAttribute('aria-hidden', showPuzzleDifficulty ? 'false' : 'true');

  const showFlagDifficulty = selectedGameType === 'flag-match';
  flagDifficulty?.classList.toggle('puzzle-only-menu--inactive', !showFlagDifficulty);
  flagDifficulty?.setAttribute('aria-hidden', showFlagDifficulty ? 'false' : 'true');

  const showCapitalsDifficulty = selectedGameType === 'capitals-map';
  capitalsDifficulty?.classList.toggle('puzzle-only-menu--inactive', !showCapitalsDifficulty);
  capitalsDifficulty?.setAttribute('aria-hidden', showCapitalsDifficulty ? 'false' : 'true');

  const showCountryLabelDifficulty = selectedGameType === 'country-labels-map';
  countryLabelDifficulty?.classList.toggle('puzzle-only-menu--inactive', !showCountryLabelDifficulty);
  countryLabelDifficulty?.setAttribute('aria-hidden', showCountryLabelDifficulty ? 'false' : 'true');
}

export type MenuStartSelection = { gameType: GameTypeId; regionId: string };

let menuPanelGame: HTMLElement | null = null;
let menuPanelSetup: HTMLElement | null = null;

export function resetMenuToGamePick(): void {
  if (!menuPanelGame || !menuPanelSetup) return;
  menuPanelSetup.classList.add('menu-panel--hidden');
  menuPanelSetup.setAttribute('aria-hidden', 'true');
  menuPanelGame.classList.remove('menu-panel--hidden');
  menuPanelGame.setAttribute('aria-hidden', 'false');
  document.getElementById('btn-menu-continue')?.focus();
}

export function initMenu(onStart: (sel: MenuStartSelection) => void): void {
  const el = document.getElementById('screen-menu');
  if (!el) return;
  const menuRoot: HTMLElement = el;

  let selectedGameType: GameTypeId = DEFAULT_GAME_TYPE;
  let selectedRegionId = getDefaultRegionId();

  const extraEl = menuRoot.querySelector<HTMLElement>('#region-mode-extra');
  renderRegionExtraChips(extraEl);

  menuPanelGame = menuRoot.querySelector('#menu-panel-game');
  menuPanelSetup = menuRoot.querySelector('#menu-panel-setup');
  const btnContinue = menuRoot.querySelector<HTMLButtonElement>('#btn-menu-continue');
  const btnBackType = menuRoot.querySelector<HTMLButtonElement>('#btn-menu-back-type');
  const btnStart = menuRoot.querySelector<HTMLButtonElement>('#btn-menu-start');
  const setupModeLine = menuRoot.querySelector<HTMLElement>('#menu-setup-mode-line');
  const puzzleControlsHint = menuRoot.querySelector<HTMLElement>('#menu-puzzle-controls-hint');

  const puzzleDifficulty = menuRoot.querySelector<HTMLElement>('#puzzle-difficulty-only');
  const flagDifficulty = menuRoot.querySelector<HTMLElement>('#flag-difficulty-only');
  const capitalsDifficulty = menuRoot.querySelector<HTMLElement>('#capitals-difficulty-only');
  const countryLabelDifficulty = menuRoot.querySelector<HTMLElement>('#country-label-difficulty-only');
  const typeCards = menuRoot.querySelectorAll<HTMLButtonElement>('.game-type-card[data-game-type]');

  /** Modes drapeaux : seules les cartes avec drapeaux ISO (pas départements FR ni États US). */
  const FLAG_BLOCKED_REGION_TITLE =
    'Pas de drapeaux ISO pour cette carte (départements, États US).';

  function ensureRegionCompatibleWithGameType(): void {
    if (selectedGameType !== 'flag-match') return;
    if (regionSupportsFlags(selectedRegionId)) return;
    const fallback = REGIONS.find((r) => r.supportsFlags);
    if (fallback) selectedRegionId = fallback.id;
  }

  function refreshRegionPickersActiveState(): void {
    menuRoot.querySelectorAll<HTMLButtonElement>('#region-mode-map-wrap [data-region]').forEach((btn) => {
      const id = btn.dataset['region'];
      if (!id) return;
      const on = id === selectedRegionId && !btn.disabled;
      btn.classList.toggle('active', on);
    });
  }

  function syncRegionPickersForGameType(): void {
    const canPickRegion =
      selectedGameType === 'puzzle-country' ||
      selectedGameType === 'flag-match' ||
      selectedGameType === 'capitals-map' ||
      selectedGameType === 'country-labels-map';
    menuRoot.querySelectorAll<HTMLButtonElement>('#region-mode-map-wrap [data-region]').forEach((btn) => {
      const id = btn.dataset['region'];
      if (!id) return;
      const blockForFlags = selectedGameType === 'flag-match' && !regionSupportsFlags(id);
      btn.disabled = !canPickRegion || blockForFlags;
      btn.classList.toggle('disabled', !canPickRegion || blockForFlags);
      btn.setAttribute('aria-disabled', blockForFlags ? 'true' : 'false');
      const base = catalogEntryForRegionId(id);
      if (blockForFlags) {
        btn.title = FLAG_BLOCKED_REGION_TITLE;
        if (base && 'descriptionLines' in base) {
          btn.setAttribute(
            'aria-label',
            `${base.label}. ${FLAG_BLOCKED_REGION_TITLE} ${base.descriptionLines.join(', ')}`,
          );
        }
      } else {
        btn.title = '';
        if (base && 'descriptionLines' in base) {
          btn.setAttribute('aria-label', `${base.label}. ${base.descriptionLines.join(', ')}`);
        }
      }
    });
  }

  function syncGameTypeCards(): void {
    typeCards.forEach((btn) => {
      const t = btn.dataset['gameType'] as GameTypeId | undefined;
      if (!t) return;
      const on = t === selectedGameType;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function syncPuzzleHint(): void {
    const show = selectedGameType === 'puzzle-country';
    puzzleControlsHint?.classList.toggle('puzzle-only-menu--inactive', !show);
    puzzleControlsHint?.setAttribute('aria-hidden', show ? 'false' : 'true');
  }

  function updateSetupSummary(): void {
    if (setupModeLine) {
      setupModeLine.textContent = GAME_TYPE_LABELS[selectedGameType];
    }
  }

  function showSetupPanel(): void {
    if (!menuPanelGame || !menuPanelSetup) return;
    menuPanelGame.classList.add('menu-panel--hidden');
    menuPanelGame.setAttribute('aria-hidden', 'true');
    menuPanelSetup.classList.remove('menu-panel--hidden');
    menuPanelSetup.setAttribute('aria-hidden', 'false');
    syncPuzzleBlock(
      menuRoot,
      puzzleDifficulty,
      flagDifficulty,
      capitalsDifficulty,
      countryLabelDifficulty,
      selectedGameType,
    );
    syncPuzzleHint();
    updateSetupSummary();
    ensureRegionCompatibleWithGameType();
    syncRegionPickersForGameType();
    refreshRegionPickersActiveState();
    btnStart?.focus();
  }

  function showGamePickPanel(): void {
    resetMenuToGamePick();
  }

  typeCards.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      const t = btn.dataset['gameType'] as GameTypeId | undefined;
      if (!t || t === selectedGameType) return;
      selectedGameType = t;
      syncGameTypeCards();
    });
  });

  menuRoot.querySelector('#region-mode-map-wrap')?.addEventListener('click', (ev) => {
    const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-region]');
    if (!btn || btn.disabled || btn.classList.contains('disabled')) return;
    const mode = btn.dataset['region'];
    if (!mode) return;
    selectedRegionId = mode;
    refreshRegionPickersActiveState();
  });

  btnContinue?.addEventListener('click', () => {
    showSetupPanel();
  });

  btnBackType?.addEventListener('click', () => {
    showGamePickPanel();
  });

  btnStart?.addEventListener('click', () => {
    onStart({ gameType: selectedGameType, regionId: selectedRegionId });
  });

  syncPuzzleBlock(
    menuRoot,
    puzzleDifficulty,
    flagDifficulty,
    capitalsDifficulty,
    countryLabelDifficulty,
    selectedGameType,
  );
  syncPuzzleHint();
  syncGameTypeCards();
  syncRegionPickersForGameType();
  refreshRegionPickersActiveState();
}

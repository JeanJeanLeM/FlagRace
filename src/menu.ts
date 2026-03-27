import { REGION_CATALOG, getDefaultRegionId } from './data/regionConfig.ts';
import { DEFAULT_GAME_TYPE, GAME_TYPE_LABELS, type GameTypeId } from './gameModes.ts';

function renderRegionModeGrid(container: HTMLElement): void {
  container.replaceChildren();
  let firstPlayable: HTMLButtonElement | null = null;
  for (const region of REGION_CATALOG) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.classList.add('mode-card');
    if (!region.available) {
      btn.classList.add('disabled');
      btn.disabled = true;
      btn.setAttribute('aria-disabled', 'true');
      btn.setAttribute('aria-label', `${region.label}, bientôt disponible`);
    } else {
      btn.dataset['mode'] = region.id;
      if (!firstPlayable) {
        firstPlayable = btn;
        btn.classList.add('active');
      }
      btn.setAttribute('aria-label', `${region.label}. ${region.descriptionLines.join(', ')}`);
    }

    const icon = document.createElement('div');
    icon.className = 'mode-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = region.icon;

    const name = document.createElement('div');
    name.className = 'mode-name';
    name.textContent = region.label;

    const desc = document.createElement('div');
    desc.className = 'mode-desc';
    region.descriptionLines.forEach((line, i) => {
      if (i > 0) desc.appendChild(document.createElement('br'));
      desc.appendChild(document.createTextNode(line));
    });

    btn.append(icon, name, desc);
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

  const canPickRegion =
    selectedGameType === 'puzzle-country' ||
    selectedGameType === 'flag-match' ||
    selectedGameType === 'capitals-map' ||
    selectedGameType === 'country-labels-map';
  menuRoot.querySelectorAll<HTMLButtonElement>('.mode-card[data-mode]').forEach((btn) => {
    btn.disabled = !canPickRegion;
  });
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
  const menuRootEl = document.getElementById('screen-menu');
  if (!menuRootEl) return;

  let selectedGameType: GameTypeId = DEFAULT_GAME_TYPE;
  let selectedRegionId = getDefaultRegionId();

  const regionGrid = menuRootEl.querySelector<HTMLElement>('#region-mode-grid');
  if (regionGrid) renderRegionModeGrid(regionGrid);

  menuPanelGame = menuRootEl.querySelector('#menu-panel-game');
  menuPanelSetup = menuRootEl.querySelector('#menu-panel-setup');
  const btnContinue = menuRootEl.querySelector<HTMLButtonElement>('#btn-menu-continue');
  const btnBackType = menuRootEl.querySelector<HTMLButtonElement>('#btn-menu-back-type');
  const btnStart = menuRootEl.querySelector<HTMLButtonElement>('#btn-menu-start');
  const setupModeLine = menuRootEl.querySelector<HTMLElement>('#menu-setup-mode-line');
  const puzzleControlsHint = menuRootEl.querySelector<HTMLElement>('#menu-puzzle-controls-hint');

  const puzzleDifficulty = menuRootEl.querySelector<HTMLElement>('#puzzle-difficulty-only');
  const flagDifficulty = menuRootEl.querySelector<HTMLElement>('#flag-difficulty-only');
  const capitalsDifficulty = menuRootEl.querySelector<HTMLElement>('#capitals-difficulty-only');
  const countryLabelDifficulty = menuRootEl.querySelector<HTMLElement>('#country-label-difficulty-only');
  const typeCards = menuRootEl.querySelectorAll<HTMLButtonElement>('.game-type-card[data-game-type]');

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
      menuRootEl,
      puzzleDifficulty,
      flagDifficulty,
      capitalsDifficulty,
      countryLabelDifficulty,
      selectedGameType,
    );
    syncPuzzleHint();
    updateSetupSummary();
    btnStart?.focus();
  }

  function showGamePickPanel(): void {
    resetMenuToGamePick();
  }

  typeCards.forEach((btn) => {
    if (btn.disabled) return;
    btn.addEventListener('click', () => {
      const t = btn.dataset['gameType'] as GameTypeId | undefined;
      if (!t || t === selectedGameType) return;
      selectedGameType = t;
      syncGameTypeCards();
    });
  });

  menuRootEl.querySelectorAll<HTMLButtonElement>('.mode-card[data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.disabled || btn.classList.contains('disabled')) return;
      const mode = btn.dataset['mode'];
      if (!mode) return;
      selectedRegionId = mode;
      menuRootEl.querySelectorAll<HTMLButtonElement>('.mode-card[data-mode]').forEach((el) => {
        if (el.disabled || el.classList.contains('disabled')) return;
        el.classList.toggle('active', el === btn);
      });
    });
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
    menuRootEl,
    puzzleDifficulty,
    flagDifficulty,
    capitalsDifficulty,
    countryLabelDifficulty,
    selectedGameType,
  );
  syncPuzzleHint();
  syncGameTypeCards();
}

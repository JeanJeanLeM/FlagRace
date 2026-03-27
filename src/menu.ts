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
  puzzleDifficulty: HTMLElement | null,
  flagDifficulty: HTMLElement | null,
  capitalsDifficulty: HTMLElement | null,
  countryLabelDifficulty: HTMLElement | null,
  selectedGameType: GameTypeId,
): void {
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

function setRegionInteractive(el: Element, disabled: boolean): void {
  if (el instanceof HTMLButtonElement) {
    el.disabled = disabled;
    el.classList.toggle('disabled', disabled);
    el.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    return;
  }
  el.classList.toggle('disabled', disabled);
  (el as HTMLElement).style.pointerEvents = disabled ? 'none' : '';
  el.setAttribute('aria-disabled', disabled ? 'true' : 'false');
  el.setAttribute('tabindex', disabled ? '-1' : '0');
}

export type MenuStartSelection = { gameType: GameTypeId; regionId: string };

export function resetMenuToGamePick(): void {
  const modal = document.getElementById('difficulty-modal');
  modal?.classList.add('hidden');
  modal?.setAttribute('aria-hidden', 'true');
}

async function injectWorldMapSvg(host: HTMLElement | null): Promise<void> {
  if (!host) return;
  try {
    const res = await fetch('/world-menu-map.svg');
    if (!res.ok) throw new Error(String(res.status));
    const text = await res.text();
    host.innerHTML = text;
    const svg = host.querySelector('svg');
    svg?.classList.add('world-menu-svg');
    svg?.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    host.querySelectorAll('.world-menu-region').forEach((path) => {
      path.setAttribute('role', 'button');
      path.setAttribute('tabindex', '0');
      const id = path.getAttribute('data-region');
      const meta = id ? catalogEntryForRegionId(id) : undefined;
      if (meta && 'descriptionLines' in meta) {
        path.setAttribute('aria-label', `${meta.label}. ${meta.descriptionLines.join(', ')}`);
      }
    });
  } catch {
    host.innerHTML =
      '<p class="world-map-fallback">Carte menu indisponible. Lance <code>npm run build:menu-map</code> à la racine du projet.</p>';
  }
}

export function initMenu(onStart: (sel: MenuStartSelection) => void): void {
  const screenMenuEl = document.getElementById('screen-menu');
  if (!screenMenuEl) return;
  const screenMenu: HTMLElement = screenMenuEl;

  let selectedGameType: GameTypeId = DEFAULT_GAME_TYPE;
  let selectedRegionId = getDefaultRegionId();

  const extraEl = screenMenu.querySelector<HTMLElement>('#region-mode-extra');
  renderRegionExtraChips(extraEl);

  const puzzleDifficulty = document.querySelector<HTMLElement>('#puzzle-difficulty-only');
  const flagDifficulty = document.querySelector<HTMLElement>('#flag-difficulty-only');
  const capitalsDifficulty = document.querySelector<HTMLElement>('#capitals-difficulty-only');
  const countryLabelDifficulty = document.querySelector<HTMLElement>('#country-label-difficulty-only');
  const puzzleControlsHint = screenMenu.querySelector<HTMLElement>('#menu-puzzle-controls-hint');
  const typeCards = screenMenu.querySelectorAll<HTMLButtonElement>('.game-type-card[data-game-type]');

  const difficultyModal = document.getElementById('difficulty-modal');
  const difficultyModalSub = document.getElementById('difficulty-modal-sub');
  const btnStart = screenMenu.querySelector<HTMLButtonElement>('#btn-menu-start');
  const btnDifficultyCancel = document.getElementById('btn-difficulty-cancel');
  const btnDifficultyConfirm = document.getElementById('btn-difficulty-confirm');

  const FLAG_BLOCKED_REGION_TITLE =
    'Pas de drapeaux ISO pour cette carte (départements, États US).';

  function ensureRegionCompatibleWithGameType(): void {
    if (selectedGameType !== 'flag-match') return;
    if (regionSupportsFlags(selectedRegionId)) return;
    const fallback = REGIONS.find((r) => r.supportsFlags);
    if (fallback) selectedRegionId = fallback.id;
  }

  function refreshRegionPickersActiveState(): void {
    screenMenu.querySelectorAll('#region-mode-map-wrap [data-region]').forEach((el) => {
      const id = el.getAttribute('data-region');
      if (!id) return;
      const dis =
        el instanceof HTMLButtonElement
          ? el.disabled
          : el.classList.contains('disabled') || el.getAttribute('aria-disabled') === 'true';
      const on = id === selectedRegionId && !dis;
      el.classList.toggle('active', on);
    });
  }

  function syncRegionPickersForGameType(): void {
    const canPickRegion =
      selectedGameType === 'puzzle-country' ||
      selectedGameType === 'flag-match' ||
      selectedGameType === 'capitals-map' ||
      selectedGameType === 'country-labels-map';
    screenMenu.querySelectorAll('#region-mode-map-wrap [data-region]').forEach((el) => {
      const id = el.getAttribute('data-region');
      if (!id) return;
      const blockForFlags = selectedGameType === 'flag-match' && !regionSupportsFlags(id);
      const off = !canPickRegion || blockForFlags;
      setRegionInteractive(el, off);
      const base = catalogEntryForRegionId(id);
      if (blockForFlags) {
        if (el instanceof HTMLElement) el.title = FLAG_BLOCKED_REGION_TITLE;
        if (base && 'descriptionLines' in base) {
          el.setAttribute(
            'aria-label',
            `${base.label}. ${FLAG_BLOCKED_REGION_TITLE} ${base.descriptionLines.join(', ')}`,
          );
        }
      } else {
        if (el instanceof HTMLElement) el.title = '';
        if (base && 'descriptionLines' in base) {
          el.setAttribute('aria-label', `${base.label}. ${base.descriptionLines.join(', ')}`);
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

  function openDifficultyModal(): void {
    ensureRegionCompatibleWithGameType();
    syncRegionPickersForGameType();
    refreshRegionPickersActiveState();
    syncPuzzleBlock(
      puzzleDifficulty,
      flagDifficulty,
      capitalsDifficulty,
      countryLabelDifficulty,
      selectedGameType,
    );
    if (difficultyModalSub) {
      difficultyModalSub.textContent = GAME_TYPE_LABELS[selectedGameType];
    }
    difficultyModal?.classList.remove('hidden');
    difficultyModal?.setAttribute('aria-hidden', 'false');
    btnDifficultyConfirm?.focus();
  }

  function closeDifficultyModal(): void {
    resetMenuToGamePick();
    btnStart?.focus();
  }

  typeCards.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      const t = btn.dataset['gameType'] as GameTypeId | undefined;
      if (!t || t === selectedGameType) return;
      selectedGameType = t;
      syncGameTypeCards();
      ensureRegionCompatibleWithGameType();
      syncRegionPickersForGameType();
      refreshRegionPickersActiveState();
      syncPuzzleHint();
    });
  });

  function onSelectRegion(regionId: string): void {
    selectedRegionId = regionId;
    refreshRegionPickersActiveState();
  }

  screenMenu.querySelector('#region-mode-map-wrap')?.addEventListener('click', (ev) => {
    const el = (ev.target as HTMLElement).closest<SVGElement | HTMLButtonElement>('[data-region]');
    if (!el || el.classList.contains('disabled') || el.getAttribute('aria-disabled') === 'true')
      return;
    if (el instanceof HTMLButtonElement && el.disabled) return;
    const mode = el.getAttribute('data-region');
    if (!mode) return;
    onSelectRegion(mode);
  });

  screenMenu.querySelector('#region-mode-map-wrap')?.addEventListener('keydown', (ev) => {
    const ke = ev as KeyboardEvent;
    if (ke.key !== 'Enter' && ke.key !== ' ') return;
    const el = (ev.target as HTMLElement).closest<SVGElement>('[data-region].world-menu-region');
    if (!el || el.classList.contains('disabled') || el.getAttribute('aria-disabled') === 'true')
      return;
    ke.preventDefault();
    const mode = el.getAttribute('data-region');
    if (mode) onSelectRegion(mode);
  });

  btnStart?.addEventListener('click', () => {
    openDifficultyModal();
  });

  btnDifficultyCancel?.addEventListener('click', () => {
    closeDifficultyModal();
  });

  difficultyModal?.querySelector('[data-difficulty-modal-close]')?.addEventListener('click', () => {
    closeDifficultyModal();
  });

  btnDifficultyConfirm?.addEventListener('click', () => {
    onStart({ gameType: selectedGameType, regionId: selectedRegionId });
    closeDifficultyModal();
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    if (!difficultyModal || difficultyModal.classList.contains('hidden')) return;
    closeDifficultyModal();
  });

  void injectWorldMapSvg(screenMenu.querySelector('#world-menu-svg-host'));

  syncPuzzleBlock(
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

import { catalogEntryForRegionId, getDefaultRegionId } from './data/regionConfig.ts';
import { DEFAULT_GAME_TYPE } from './gameModes.ts';
import {
  catalogEntryDescriptionLines,
  catalogEntryLabel,
  getLocale,
  pickUiString,
} from './i18n/index.ts';

export type MenuStartSelection = { gameType: 'flag-match'; regionId: string };

export function resetMenuToGamePick(): void {
  // No modal state to reset in single-mode setup.
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
        path.setAttribute(
          'aria-label',
          `${catalogEntryLabel(meta, getLocale())}. ${catalogEntryDescriptionLines(meta, getLocale()).join(', ')}`,
        );
      }
    });
  } catch {
    host.innerHTML = `<p class="world-map-fallback">${pickUiString('worldMap.fallback', getLocale())}</p>`;
  }
}

export function initMenu(onStart: (sel: MenuStartSelection) => void): void {
  const screenMenuEl = document.getElementById('screen-menu');
  if (!screenMenuEl) return;
  const screenMenu: HTMLElement = screenMenuEl;

  const selectedGameType = DEFAULT_GAME_TYPE;
  let selectedRegionId = getDefaultRegionId();

  const btnStart = screenMenu.querySelector<HTMLButtonElement>('#btn-menu-start');

  function refreshRegionPickersActiveState(): void {
    screenMenu.querySelectorAll('#region-mode-map-wrap [data-region]').forEach((el) => {
      const id = el.getAttribute('data-region');
      if (!id) return;
      const on = id === selectedRegionId;
      el.classList.toggle('active', on);
    });
  }

  function updateSelectedRegionLabel(): void {
    const nameEl = screenMenu.querySelector('#world-menu-selected-name');
    if (!nameEl) return;
    const entry = catalogEntryForRegionId(selectedRegionId);
    const label =
      entry && 'label' in entry ? catalogEntryLabel(entry, getLocale()) : selectedRegionId;
    nameEl.textContent = label;
  }

  function onSelectRegion(regionId: string): void {
    selectedRegionId = regionId;
    refreshRegionPickersActiveState();
    updateSelectedRegionLabel();
  }

  screenMenu.querySelector('#region-mode-map-wrap')?.addEventListener('click', (ev) => {
    const el = (ev.target as HTMLElement).closest<SVGElement>('[data-region]');
    if (!el) return;
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
    onStart({ gameType: selectedGameType, regionId: selectedRegionId });
  });

  void injectWorldMapSvg(screenMenu.querySelector('#world-menu-svg-host'));

  function onLocaleChange(): void {
    refreshRegionPickersActiveState();
    updateSelectedRegionLabel();
  }
  document.addEventListener('worldpuzzle-locale', onLocaleChange);

  refreshRegionPickersActiveState();
  updateSelectedRegionLabel();
}

/**
 * AdSense : après consentement, charge le même script que la balise officielle
 * (pagead2.googlesyndication.com/.../adsbygoogle.js?client=…).
 * ID éditeur par défaut World Puzzle ; surcharger avec VITE_ADSENSE_CLIENT ou désactiver avec `off`.
 * Menu : VITE_ADSENSE_SLOT_MENU + VITE_ADSENSE_SLOT_MENU_SECOND (ou SLOT_MENU_BOTTOM pour le 2e).
 * Jeu : VITE_ADSENSE_SLOT_GAME_SIDEBAR (colonne droite).
 */

import { getLocale, pickUiString, subscribeLocale, t } from './i18n/index.ts';

const DEFAULT_ADSENSE_CLIENT = 'ca-pub-8944795420097131';
const CONSENT_KEY = 'worldpuzzle-ads-consent';

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[];
  }
}

function publisherId(): string | undefined {
  const raw = import.meta.env.VITE_ADSENSE_CLIENT?.trim();
  if (raw === 'off') return undefined;
  if (raw?.startsWith('ca-pub-')) return raw;
  return DEFAULT_ADSENSE_CLIENT;
}

function slotMenu(): string | undefined {
  const v = import.meta.env.VITE_ADSENSE_SLOT_MENU?.trim();
  return v && /^\d+$/.test(v) ? v : undefined;
}

/** 2e bloc menu : préférer MENU_SECOND ; MENU_BOTTOM reste accepté (rétrocompat). */
function slotMenuSecond(): string | undefined {
  const a = import.meta.env.VITE_ADSENSE_SLOT_MENU_SECOND?.trim();
  const b = import.meta.env.VITE_ADSENSE_SLOT_MENU_BOTTOM?.trim();
  const v = a || b;
  return v && /^\d+$/.test(v) ? v : undefined;
}

function slotGameSidebar(): string | undefined {
  const v = import.meta.env.VITE_ADSENSE_SLOT_GAME_SIDEBAR?.trim();
  return v && /^\d+$/.test(v) ? v : undefined;
}

let scriptPromise: Promise<void> | null = null;

function loadAdsenseScript(client: string): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src^="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]',
    );
    if (existing) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
    s.crossOrigin = 'anonymous';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(pickUiString('ads.loadError', getLocale())));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

function fillSlot(
  container: HTMLElement,
  client: string,
  slot: string,
  opts?: { vertical?: boolean },
): void {
  container.replaceChildren();
  const ins = document.createElement('ins');
  ins.className = 'adsbygoogle';
  ins.style.display = 'block';
  ins.setAttribute('data-ad-client', client);
  ins.setAttribute('data-ad-slot', slot);
  if (opts?.vertical) {
    ins.setAttribute('data-ad-format', 'vertical');
    ins.setAttribute('data-full-width-responsive', 'false');
  } else {
    ins.setAttribute('data-ad-format', 'auto');
    ins.setAttribute('data-full-width-responsive', 'true');
  }
  container.appendChild(ins);
  window.adsbygoogle = window.adsbygoogle || [];
  window.adsbygoogle.push({});
}

async function runAdsense(client: string): Promise<void> {
  await loadAdsenseScript(client);
  const sm = slotMenu();
  const s2 = slotMenuSecond();
  const dual = document.getElementById('menu-ads-dual');
  const colA = document.getElementById('menu-ad-col-a');
  const colB = document.getElementById('menu-ad-col-b');
  const menuHost = document.getElementById('ad-menu');
  const menuHost2 = document.getElementById('ad-menu-secondary');
  if (dual && colA && colB && menuHost && menuHost2) {
    let anyMenu = false;
    if (sm) {
      colA.classList.remove('hidden');
      colA.setAttribute('aria-hidden', 'false');
      fillSlot(menuHost, client, sm);
      anyMenu = true;
    }
    if (s2) {
      colB.classList.remove('hidden');
      colB.setAttribute('aria-hidden', 'false');
      fillSlot(menuHost2, client, s2);
      anyMenu = true;
    }
    if (anyMenu) {
      dual.classList.remove('hidden');
      dual.setAttribute('aria-hidden', 'false');
    }
  }
  const sg = slotGameSidebar();
  const rail = document.getElementById('game-ad-rail');
  const gameHost = document.getElementById('ad-game-sidebar');
  if (sg && rail && gameHost) {
    rail.classList.remove('hidden');
    rail.setAttribute('aria-hidden', 'false');
    fillSlot(gameHost, client, sg, { vertical: true });
  }
}

function removeConsentBanner(): void {
  document.getElementById('ads-consent-banner')?.remove();
}

function showConsentBanner(client: string): void {
  if (document.getElementById('ads-consent-banner')) return;
  const bar = document.createElement('div');
  bar.id = 'ads-consent-banner';
  bar.setAttribute('role', 'dialog');
  bar.setAttribute('aria-label', t('ads.consent.aria'));

  const text = document.createElement('p');
  text.className = 'ads-consent-banner__text';
  text.textContent = t('ads.consent.text');

  const actions = document.createElement('div');
  actions.className = 'ads-consent-banner__actions';

  const link = document.createElement('a');
  link.href = '/confidentialite.html';
  link.className = 'ads-consent-banner__link';
  link.textContent = t('ads.consent.privacy');
  link.rel = 'noopener noreferrer';

  const deny = document.createElement('button');
  deny.type = 'button';
  deny.className = 'ads-consent-banner__btn ads-consent-banner__btn--secondary';
  deny.textContent = t('ads.consent.deny');
  deny.addEventListener('click', () => {
    localStorage.setItem(CONSENT_KEY, 'deny');
    removeConsentBanner();
  });

  const accept = document.createElement('button');
  accept.type = 'button';
  accept.className = 'ads-consent-banner__btn ads-consent-banner__btn--primary';
  accept.textContent = t('ads.consent.allow');
  accept.addEventListener('click', () => {
    localStorage.setItem(CONSENT_KEY, 'allow');
    removeConsentBanner();
    void runAdsense(client).catch(() => {});
  });

  actions.append(link, deny, accept);
  bar.append(text, actions);
  document.body.appendChild(bar);
}

function refreshConsentBannerI18n(): void {
  const bar = document.getElementById('ads-consent-banner');
  if (!bar) return;
  bar.setAttribute('aria-label', t('ads.consent.aria'));
  const bannerText = bar.querySelector('.ads-consent-banner__text');
  if (bannerText) bannerText.textContent = t('ads.consent.text');
  const link = bar.querySelector<HTMLAnchorElement>('.ads-consent-banner__link');
  if (link) link.textContent = t('ads.consent.privacy');
  const buttons = bar.querySelectorAll('button');
  if (buttons[0]) buttons[0].textContent = t('ads.consent.deny');
  if (buttons[1]) buttons[1].textContent = t('ads.consent.allow');
}

export function initAdsense(): void {
  subscribeLocale(refreshConsentBannerI18n);

  const client = publisherId();
  if (!client) return;

  const choice = localStorage.getItem(CONSENT_KEY);
  if (choice === 'deny') return;
  if (choice === 'allow') {
    void runAdsense(client).catch(() => {});
    return;
  }
  showConsentBanner(client);
}

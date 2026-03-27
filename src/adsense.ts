/**
 * AdSense : après consentement, charge le même script que la balise officielle
 * (pagead2.googlesyndication.com/.../adsbygoogle.js?client=…).
 * ID éditeur par défaut World Puzzle ; surcharger avec VITE_ADSENSE_CLIENT ou désactiver avec `off`.
 * Blocs manuels : VITE_ADSENSE_SLOT_MENU / VITE_ADSENSE_SLOT_MENU_BOTTOM.
 */

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

function slotMenuBottom(): string | undefined {
  const v = import.meta.env.VITE_ADSENSE_SLOT_MENU_BOTTOM?.trim();
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
    s.onerror = () => reject(new Error('Échec du chargement AdSense'));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

function fillSlot(container: HTMLElement, client: string, slot: string): void {
  container.replaceChildren();
  const ins = document.createElement('ins');
  ins.className = 'adsbygoogle';
  ins.style.display = 'block';
  ins.setAttribute('data-ad-client', client);
  ins.setAttribute('data-ad-slot', slot);
  ins.setAttribute('data-ad-format', 'auto');
  ins.setAttribute('data-full-width-responsive', 'true');
  container.appendChild(ins);
  window.adsbygoogle = window.adsbygoogle || [];
  window.adsbygoogle.push({});
}

async function runAdsense(client: string): Promise<void> {
  await loadAdsenseScript(client);
  const sm = slotMenu();
  const wrap = document.getElementById('ad-menu-wrap');
  const menuHost = document.getElementById('ad-menu');
  if (sm && wrap && menuHost) {
    wrap.classList.remove('hidden');
    wrap.setAttribute('aria-hidden', 'false');
    fillSlot(menuHost, client, sm);
  }
  const sb = slotMenuBottom();
  const bWrap = document.getElementById('ad-menu-bottom-wrap');
  const bottomHost = document.getElementById('ad-menu-bottom');
  if (sb && bWrap && bottomHost) {
    bWrap.classList.remove('hidden');
    bWrap.setAttribute('aria-hidden', 'false');
    fillSlot(bottomHost, client, sb);
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
  bar.setAttribute('aria-label', 'Cookies et publicité');

  const text = document.createElement('p');
  text.className = 'ads-consent-banner__text';
  text.textContent =
    'Nous pouvons afficher des publicités Google (AdSense). Elles peuvent utiliser des cookies ou données équivalentes. Consultez la page Confidentialité pour plus de détails.';

  const actions = document.createElement('div');
  actions.className = 'ads-consent-banner__actions';

  const link = document.createElement('a');
  link.href = '/confidentialite.html';
  link.className = 'ads-consent-banner__link';
  link.textContent = 'Confidentialité';
  link.rel = 'noopener noreferrer';

  const deny = document.createElement('button');
  deny.type = 'button';
  deny.className = 'ads-consent-banner__btn ads-consent-banner__btn--secondary';
  deny.textContent = 'Refuser';
  deny.addEventListener('click', () => {
    localStorage.setItem(CONSENT_KEY, 'deny');
    removeConsentBanner();
  });

  const accept = document.createElement('button');
  accept.type = 'button';
  accept.className = 'ads-consent-banner__btn ads-consent-banner__btn--primary';
  accept.textContent = 'Accepter';
  accept.addEventListener('click', () => {
    localStorage.setItem(CONSENT_KEY, 'allow');
    removeConsentBanner();
    void runAdsense(client).catch(() => {});
  });

  actions.append(link, deny, accept);
  bar.append(text, actions);
  document.body.appendChild(bar);
}

export function initAdsense(): void {
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

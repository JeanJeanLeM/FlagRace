import { getLocale } from './locale.ts';
import { pickUiString } from './uiStrings.ts';

/** Applique les chaînes aux nœuds `data-i18n`, `data-i18n-title`, `data-i18n-aria`, `data-i18n-html`. */
export function applyDomI18n(root: ParentNode = document): void {
  const locale = getLocale();

  root.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (!key || !(el instanceof HTMLElement)) return;
    el.textContent = pickUiString(key, locale);
  });

  root.querySelectorAll('[data-i18n-html]').forEach((el) => {
    const key = el.getAttribute('data-i18n-html');
    if (!key || !(el instanceof HTMLElement)) return;
    el.innerHTML = pickUiString(key, locale);
  });

  root.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const key = el.getAttribute('data-i18n-title');
    if (!key || !(el instanceof HTMLElement)) return;
    el.title = pickUiString(key, locale);
  });

  root.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    const key = el.getAttribute('data-i18n-aria');
    if (!key || !(el instanceof HTMLElement)) return;
    el.setAttribute('aria-label', pickUiString(key, locale));
  });

  root.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const key = el.getAttribute('data-i18n-title');
    if (!key || !(el instanceof HTMLElement)) return;
    el.title = pickUiString(key, locale);
  });

  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute('content', pickUiString('meta.description', locale));
}

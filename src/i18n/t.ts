import { getLocale } from './locale.ts';
import { formatUiString, pickUiString } from './uiStrings.ts';

export function t(key: string, vars?: Record<string, string | number>): string {
  const raw = pickUiString(key, getLocale());
  return vars ? formatUiString(raw, vars) : raw;
}

export { pickUiString, formatUiString };

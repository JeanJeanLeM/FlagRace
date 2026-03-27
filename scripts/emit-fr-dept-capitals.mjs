/**
 * Met à jour FR_DEPARTMENT_CAPITALS dans worldRegions.generated.ts
 * à partir de fr-department-prefectures.mjs (sans relancer tout le build NE).
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { FR_DEPARTMENT_PREFECTURES } from './fr-department-prefectures.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const genPath = path.join(root, 'src/data/worldRegions.generated.ts');
const t = fs.readFileSync(genPath, 'utf8');
const i = t.indexOf('export const FR_DEPARTMENT_IDS');
const j = t.indexOf('];', i);
const block = t.slice(i, j + 2);
const ids = [...block.matchAll(/"(FR-[^"]+)"/g)].map((m) => m[1]);
const arr = ids.map((iso3) => {
  const pref = FR_DEPARTMENT_PREFECTURES[iso3];
  if (!pref) throw new Error(`missing ${iso3}`);
  return { iso3, label: pref.label, lon: pref.lon, lat: pref.lat };
});
const out = `export const FR_DEPARTMENT_CAPITALS: CapitalEntry[] = ${JSON.stringify(arr, null, 2)};\n`;
const start = t.indexOf('export const FR_DEPARTMENT_CAPITALS');
const end = t.indexOf('export const US_STATE_CAPITAL_ENTRIES', start);
if (start === -1 || end === -1) throw new Error('worldRegions.generated.ts: marqueurs introuvables');
const next = t.slice(0, start) + out + '\n' + t.slice(end);
fs.writeFileSync(genPath, next, 'utf8');
console.log('Mis à jour FR_DEPARTMENT_CAPITALS dans', genPath);

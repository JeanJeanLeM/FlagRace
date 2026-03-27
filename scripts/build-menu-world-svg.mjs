/**
 * Carte menu : fusion des GeoJSON par région → un SVG équirectangulaire (vraies côtes).
 * Dépend des fichiers public/data/*.geojson générés par build-world-regions.mjs.
 */
import * as turf from '@turf/turf';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'public/data');
const OUT = path.join(ROOT, 'public/world-menu-map.svg');

const W = 1000;
const H = 500;
const SIMPLIFY = 0.11;

function readFc(name) {
  const p = path.join(DATA, name);
  if (!fs.existsSync(p)) throw new Error(`Fichier manquant : ${p} (lancer npm run build:geo:world)`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function projectRing(ring) {
  if (!ring?.length) return '';
  const pts = ring.map(([lon, lat]) => {
    const x = ((lon + 180) / 360) * W;
    const y = ((90 - lat) / 180) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `M${pts[0]}L${pts.slice(1).join(' ')}Z`;
}

function geometryToD(geometry) {
  if (!geometry) return '';
  if (geometry.type === 'Polygon') {
    return geometry.coordinates.map((ring) => projectRing(ring)).join('');
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.flatMap((poly) => poly.map((ring) => projectRing(ring))).join('');
  }
  return '';
}

function filterFeatureCollection(fc, { excludeIso3 = [] } = {}) {
  const skip = new Set(excludeIso3);
  return {
    type: 'FeatureCollection',
    features: (fc.features ?? []).filter((f) => !skip.has(f.properties?.iso3)),
  };
}

function combineToPath(fc) {
  const combined = turf.combine(fc);
  const feat = combined.features[0];
  if (!feat?.geometry) return '';
  const simp = turf.simplify(feat, { tolerance: SIMPLIFY, highQuality: false });
  return geometryToD(simp.geometry);
}

function singleFeaturePath(fc) {
  if (!fc.features?.length) return '';
  const simp = turf.simplify(fc.features[0], { tolerance: SIMPLIFY * 0.6, highQuality: false });
  return geometryToD(simp.geometry);
}

const layers = [
  { region: 'africa', file: 'africa.geojson', combine: true },
  { region: 'south-america', file: 'south-america.geojson', combine: true },
  { region: 'asia', file: 'asia.geojson', combine: true },
  { region: 'north-central-america', file: 'north-central-america.geojson', combine: true },
  { region: 'europe', file: 'europe.geojson', combine: true },
  { region: 'usa', file: 'usa-country.geojson', combine: false },
  { region: 'france', file: 'france-country.geojson', combine: false },
];

function pathEl(region, d) {
  return `  <path class="world-menu-region" data-region="${region}" d="${d}"/>\n`;
}

function main() {
  const paths = [];
  const russiaPath = path.join(DATA, 'russia-country.geojson');

  for (const L of layers) {
    let fc = readFc(L.file);
    if (L.region === 'europe') {
      fc = filterFeatureCollection(fc, { excludeIso3: ['RUS'] });
    }
    if (L.region === 'asia' && fs.existsSync(russiaPath)) {
      const rusFc = JSON.parse(fs.readFileSync(russiaPath, 'utf8'));
      fc = {
        type: 'FeatureCollection',
        features: [...(fc.features ?? []), ...(rusFc.features ?? [])],
      };
    }
    const d = L.combine ? combineToPath(fc) : singleFeaturePath(fc);
    if (!d) {
      console.warn('Chemin vide pour', L.region);
      continue;
    }
    paths.push(pathEl(L.region, d));
  }

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Carte du monde — choix de région">
  <rect width="${W}" height="${H}" fill="#0a1a2e"/>
  <g class="world-menu-layer">
${paths.join('')}  </g>
</svg>
`;
  fs.writeFileSync(OUT, svg);
  console.log('Écrit', OUT, `(${paths.length} calques)`);
}

main();

/**
 * Télécharge Natural Earth 50m (frontières réelles, cohérentes entre pays),
 * extrait le Maghreb + Sahara/Sahel, calcule des ancres de connecteurs sur
 * les tronçons de frontière communs (Turf lineOverlap).
 *
 * Usage : node scripts/build-north-africa.mjs
 */
import * as turf from '@turf/turf';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '../public/data/north-africa.geojson');

const NE_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson';

/** ADM0_A3 dans Natural Earth ; SAH = Sahara occidental → jeu ESH */
const WANT_ADM = new Set(['MAR', 'SAH', 'DZA', 'TUN', 'LBY', 'EGY', 'MRT', 'MLI', 'NER', 'TCD', 'SDN']);

const ISO_FROM_ADM = (adm) => (adm === 'SAH' ? 'ESH' : adm);

const FR_NAME = {
  MAR: 'Maroc',
  ESH: 'Sahara occidental',
  DZA: 'Algérie',
  TUN: 'Tunisie',
  LBY: 'Libye',
  EGY: 'Égypte',
  MRT: 'Mauritanie',
  MLI: 'Mali',
  NER: 'Niger',
  TCD: 'Tchad',
  SDN: 'Soudan',
};

const ADJACENCY = [
  ['MAR', 'DZA'],
  ['MAR', 'ESH'],
  ['ESH', 'MRT'],
  ['ESH', 'DZA'],
  ['DZA', 'TUN'],
  ['DZA', 'LBY'],
  ['DZA', 'NER'],
  ['DZA', 'MLI'],
  ['DZA', 'MRT'],
  ['TUN', 'LBY'],
  ['LBY', 'EGY'],
  ['LBY', 'NER'],
  ['LBY', 'TCD'],
  ['EGY', 'SDN'],
  ['MRT', 'MLI'],
  ['MLI', 'NER'],
  ['NER', 'TCD'],
  ['TCD', 'SDN'],
];

function boundaryLines(feature) {
  try {
    return turf.polygonToLine(turf.feature(feature.geometry));
  } catch {
    return null;
  }
}

/** Milieu d'une LineString / premier segment utile d'une MultiLineString */
function midPointOnLine(lineFeature) {
  const g = lineFeature.geometry;
  let coords;
  if (g.type === 'LineString') coords = g.coordinates;
  else if (g.type === 'MultiLineString') {
    const longest = g.coordinates.reduce((a, b) => (b.length > a.length ? b : a), g.coordinates[0]);
    coords = longest;
  } else return null;
  if (!coords || coords.length < 2) return null;
  const i = Math.floor(coords.length / 2);
  const [lon, lat] = coords[i];
  return [lon, lat];
}

function borderAnchor(featA, featB) {
  const l1 = boundaryLines(featA);
  const l2 = boundaryLines(featB);
  if (!l1 || !l2) return null;
  let overlap;
  try {
    overlap = turf.lineOverlap(l1, l2, { tolerance: 0.003 });
  } catch {
    return null;
  }
  if (!overlap.features.length) return null;
  /** Plusieurs chevauchements : souvent un court (vraie frontière) + un très long (artefact côtier). On garde le plus court > 0,5 km. */
  let best = null;
  let shortestLen = Infinity;
  for (const f of overlap.features) {
    const lenKm = turf.length(f, { units: 'kilometers' });
    if (lenKm < 0.5 || lenKm >= shortestLen) continue;
    const mid = midPointOnLine(f);
    if (!mid) continue;
    shortestLen = lenKm;
    best = { lon: mid[0], lat: mid[1] };
  }
  return best;
}

/** Si pas de tronçon commun détecté : milieu entre les deux centroïdes (dernier recours) */
function fallbackAnchor(featA, featB) {
  const c1 = turf.getCoord(turf.centroid(featA));
  const c2 = turf.getCoord(turf.centroid(featB));
  return { lon: (c1[0] + c2[0]) / 2, lat: (c1[1] + c2[1]) / 2 };
}

async function main() {
  console.log('Téléchargement Natural Earth 50m…');
  const res = await fetch(NE_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const world = await res.json();

  const picked = [];
  for (const f of world.features) {
    const adm = f.properties?.ADM0_A3;
    if (!adm || !WANT_ADM.has(adm)) continue;
    const iso3 = ISO_FROM_ADM(adm);
    const fc = turf.feature(f.geometry);
    const c = turf.getCoord(turf.centroid(fc));
    picked.push({
      type: 'Feature',
      properties: {
        iso3,
        name: FR_NAME[iso3] ?? f.properties.NAME ?? iso3,
        centroid: [c[0], c[1]],
      },
      geometry: f.geometry,
    });
  }

  if (picked.length !== WANT_ADM.size) {
    console.warn('Attention : pays trouvés', picked.length, 'attendu', WANT_ADM.size);
  }

  picked.sort((a, b) => a.properties.iso3.localeCompare(b.properties.iso3));

  const byIso = new Map(picked.map((f) => [f.properties.iso3, f]));
  const wp_connectors = [];

  for (const [a, b] of ADJACENCY) {
    const fa = byIso.get(a);
    const fb = byIso.get(b);
    if (!fa || !fb) continue;
    let anchor = borderAnchor(fa, fb);
    if (!anchor) {
      console.warn(`Frontière partagée non détectée ${a}-${b}, repli centroïdes.`);
      anchor = fallbackAnchor(fa, fb);
    }
    wp_connectors.push({ a, b, lon: anchor.lon, lat: anchor.lat });
  }

  const fc = {
    type: 'FeatureCollection',
    features: picked,
    wp_connectors,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(fc));
  console.log('Écrit', OUT, `(${picked.length} pays, ${wp_connectors.length} connecteurs)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Génère les GeoJSON Europe, Amérique du Sud, Asie, départements FR, États US
 * + fichiers TS (capitales, noms FR, alpha-2 drapeaux) pour restcountries.
 *
 * Usage : node scripts/build-world-regions.mjs
 * Réseau requis (Natural Earth, france-geojson, restcountries).
 */
import * as turf from '@turf/turf';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FR_DEPARTMENT_PREFECTURES } from './fr-department-prefectures.mjs';
import { US_STATE_CAPITALS } from './us-state-capitals.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_DATA = path.join(ROOT, 'public/data');
const OUT_SRC = path.join(ROOT, 'src/data');

const NE50 =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson';
const NE10ADM1 =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson';
const FR_DEPT =
  'https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/departements.geojson';

const EXCLUDED_ADM = new Set(['ATA', '-99', 'GRL']); // Antarctique, artefacts ; Groenland hors « Europe » métier carte EU
/** Territoires NE sans entrée restcountries fiable pour capitale / drapeau. */
const EU_EXCLUDE = new Set(['ALD']);

function iso3FromAdm(adm) {
  if (adm === 'SAH') return 'ESH';
  return adm;
}

/** Départements métropolitains uniquement (hors DROM-COM : 971, 972, …). */
function isMetroFranceDepartmentCode(code) {
  const c = String(code).trim().toUpperCase();
  if (c === '2A' || c === '2B') return true;
  if (!/^\d+$/.test(c)) return false;
  const n = parseInt(c, 10);
  return n >= 1 && n <= 95;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function boundaryLines(feature) {
  try {
    return turf.polygonToLine(turf.feature(feature.geometry));
  } catch {
    return null;
  }
}

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
  return coords[i];
}

function borderAnchor(featA, featB) {
  const l1 = boundaryLines(featA);
  const l2 = boundaryLines(featB);
  if (!l1 || !l2) return null;
  let overlap;
  try {
    overlap = turf.lineOverlap(l1, l2, { tolerance: 0.004 });
  } catch {
    return null;
  }
  if (!overlap.features.length) return null;
  let best = null;
  let shortestLen = Infinity;
  for (const f of overlap.features) {
    const lenKm = turf.length(f, { units: 'kilometers' });
    if (lenKm < 0.35 || lenKm >= shortestLen) continue;
    const mid = midPointOnLine(f);
    if (!mid) continue;
    shortestLen = lenKm;
    best = { lon: mid[0], lat: mid[1] };
  }
  return best;
}

function fallbackAnchor(featA, featB) {
  const c1 = turf.getCoord(turf.centroid(featA));
  const c2 = turf.getCoord(turf.centroid(featB));
  return { lon: (c1[0] + c2[0]) / 2, lat: (c1[1] + c2[1]) / 2 };
}

function simplifyGeom(geometry, tol) {
  try {
    const f = turf.feature(geometry);
    return turf.simplify(f, { tolerance: tol, highQuality: false }).geometry;
  } catch {
    return geometry;
  }
}

function findAdjacencyPairs(features) {
  const pairs = [];
  const n = features.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const l1 = boundaryLines(features[i]);
      const l2 = boundaryLines(features[j]);
      if (!l1 || !l2) continue;
      let overlap;
      try {
        overlap = turf.lineOverlap(l1, l2, { tolerance: 0.004 });
      } catch {
        continue;
      }
      if (overlap.features.length) {
        const a = features[i].properties.iso3;
        const b = features[j].properties.iso3;
        pairs.push(a < b ? [a, b] : [b, a]);
      }
    }
  }
  const key = (x) => `${x[0]}-${x[1]}`;
  const seen = new Set();
  return pairs.filter((p) => {
    const k = key(p);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function buildConnectors(features, adjacency) {
  const byIso = new Map(features.map((f) => [f.properties.iso3, f]));
  const wp_connectors = [];
  for (const [a, b] of adjacency) {
    const fa = byIso.get(a);
    const fb = byIso.get(b);
    if (!fa || !fb) continue;
    let anchor = borderAnchor(fa, fb);
    if (!anchor) anchor = fallbackAnchor(fa, fb);
    wp_connectors.push({ a, b, lon: anchor.lon, lat: anchor.lat });
  }
  return wp_connectors;
}

function writeGeojson(relName, features, adjacency) {
  const wp_connectors = buildConnectors(features, adjacency);
  const fc = {
    type: 'FeatureCollection',
    features,
    wp_adjacency: adjacency,
    wp_connectors,
  };
  const p = path.join(OUT_DATA, relName);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(fc));
  console.log(relName, features.length, 'entités,', adjacency.length, 'paires,', wp_connectors.length, 'connecteurs');
}

function pickCountries(world, predicate) {
  const out = [];
  for (const f of world.features) {
    const p = f.properties ?? {};
    const adm = p.ADM0_A3;
    if (!adm || adm === '-99' || EXCLUDED_ADM.has(adm)) continue;
    if (!predicate(p)) continue;
    const iso3 = iso3FromAdm(adm);
    const geom = simplifyGeom(f.geometry, 0.018);
    const fc = turf.feature(geom);
    const c = turf.getCoord(turf.centroid(fc));
    const nameFr = p.NAME_FR || p.NAME || iso3;
    out.push({
      type: 'Feature',
      properties: {
        iso3,
        name: nameFr,
        centroid: [c[0], c[1]],
      },
      geometry: geom,
    });
  }
  out.sort((a, b) => a.properties.iso3.localeCompare(b.properties.iso3));
  return out;
}

/** Limite est de la Russie « européenne » (≈ Oural) ; Kaliningrad reste inclus (ouest du méridien). */
const RUSSIA_EAST_BOUND_LON = 60;

/**
 * Polygones dont le centroïde est en Europe proche : exclut Canaries, Azores, Guyane, DOM, Groenland,
 * Caraïbes néerlandaises, bases UK, etc. (France/UK/ES/PT/NL/DK… en version continentale).
 */
function europeanMainlandCentroidOk(lon, lat) {
  if (lat < 34 || lat > 81) return false;
  if (lon < -24 || lon > 42) return false;
  /* Ceuta, Melilla, rives maghrébines proches */
  if (lat < 36 && lon > -10 && lon < 10) return false;
  return true;
}

/** Découpe la Russie à l’ouest d’un méridien (Sibérie / extrême-est exclus ; Kaliningrad conservé). */
function clipRussiaWestOfMeridian(geometry) {
  const clip = turf.polygon([
    [
      [-180, -90],
      [RUSSIA_EAST_BOUND_LON, -90],
      [RUSSIA_EAST_BOUND_LON, 90],
      [-180, 90],
      [-180, -90],
    ],
  ]);
  try {
    const inter = turf.intersect(turf.featureCollection([turf.feature(geometry), clip]));
    if (!inter?.geometry) return null;
    if (turf.area(inter) < 1) return null;
    return inter.geometry;
  } catch {
    return null;
  }
}

/**
 * Après intersection avec [-180…60°E], des îlots extrême-est (coord. négatives / ligne de date)
 * restent dans l’enveloppe et se dessinent à l’ouest de la carte. On ne garde que les morceaux
 * dont le centroïde est en Europe (Kaliningrad + masse ouest des Oural).
 */
const RUSSIA_FRAG_LON_MIN = 14;
const RUSSIA_FRAG_LON_MAX = RUSSIA_EAST_BOUND_LON + 2;

function russiaFragmentCentroidOk(lon, lat) {
  if (lat < 40 || lat > 83) return false;
  if (lon < RUSSIA_FRAG_LON_MIN || lon > RUSSIA_FRAG_LON_MAX) return false;
  return true;
}

function dropRussiaPacificArtifacts(geometry) {
  const polys =
    geometry.type === 'Polygon'
      ? [geometry.coordinates]
      : geometry.type === 'MultiPolygon'
        ? geometry.coordinates
        : [];
  const kept = [];
  for (const rings of polys) {
    if (!rings?.[0]?.length) continue;
    try {
      const polyF = turf.polygon(rings);
      const [lon, lat] = turf.getCoord(turf.centroid(polyF));
      if (russiaFragmentCentroidOk(lon, lat)) kept.push(rings);
    } catch {
      /* ignore */
    }
  }
  if (!kept.length) return null;
  if (kept.length === 1) return { type: 'Polygon', coordinates: kept[0] };
  return { type: 'MultiPolygon', coordinates: kept };
}

/** Ne garde que les îlots/polygones d’un pays dont le centroïde tombe en Europe proche. */
function filterOutEuropeanOverseasPolygons(geometry) {
  const polys =
    geometry.type === 'Polygon'
      ? [geometry.coordinates]
      : geometry.type === 'MultiPolygon'
        ? geometry.coordinates
        : [];
  const kept = [];
  for (const rings of polys) {
    if (!rings?.[0]?.length) continue;
    try {
      const polyF = turf.polygon(rings);
      const [lon, lat] = turf.getCoord(turf.centroid(polyF));
      if (europeanMainlandCentroidOk(lon, lat)) kept.push(rings);
    } catch {
      /* polygone invalide après simplification NE */
    }
  }
  if (!kept.length) return null;
  if (kept.length === 1) return { type: 'Polygon', coordinates: kept[0] };
  return { type: 'MultiPolygon', coordinates: kept };
}

function buildEuropeFeaturesFromWorld(world) {
  const out = [];
  for (const f of world.features) {
    const p = f.properties ?? {};
    const adm = p.ADM0_A3;
    if (!adm || adm === '-99' || EXCLUDED_ADM.has(adm)) continue;
    if (p.CONTINENT !== 'Europe' || EU_EXCLUDE.has(adm)) continue;
    const iso3 = iso3FromAdm(adm);

    let raw = f.geometry;
    let processed;
    if (iso3 === 'RUS') {
      const clipped = clipRussiaWestOfMeridian(raw);
      processed = clipped ? dropRussiaPacificArtifacts(clipped) : null;
    } else {
      processed = filterOutEuropeanOverseasPolygons(raw);
    }
    if (!processed) continue;

    const geom = simplifyGeom(processed, 0.018);
    let c;
    try {
      c = turf.getCoord(turf.centroid(turf.feature(geom)));
    } catch {
      continue;
    }
    const nameFr = p.NAME_FR || p.NAME || iso3;
    out.push({
      type: 'Feature',
      properties: {
        iso3,
        name: nameFr,
        centroid: [c[0], c[1]],
      },
      geometry: geom,
    });
  }
  out.sort((a, b) => a.properties.iso3.localeCompare(b.properties.iso3));
  return out;
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

async function fetchCapitalsAndNames(iso3List) {
  const unique = [...new Set(iso3List)].filter(Boolean);
  const capitals = [];
  const namesFr = {};
  const iso2 = {};
  const chunkSize = 12;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const url = `https://restcountries.com/v3.1/alpha?codes=${chunk.join(',')}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`restcountries ${res.status} ${url}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('restcountries: réponse inattendue');
    for (const d of data) {
      const cca3 = d.cca3;
      if (!cca3) continue;
      namesFr[cca3] = d.translations?.fra?.common ?? d.name?.common ?? cca3;
      if (d.cca2) iso2[cca3] = String(d.cca2).toLowerCase();
      const cap = d.capital?.[0];
      const latlng = d.capitalInfo?.latlng;
      if (cap && latlng?.length === 2) {
        capitals.push({
          iso3: cca3,
          label: cap,
          lon: latlng[1],
          lat: latlng[0],
        });
      }
    }
    await sleep(200);
  }
  return { capitals, namesFr, iso2 };
}

async function buildFranceDepartments() {
  const gj = await fetchJson(FR_DEPT);
  const features = [];
  const names = {};
  for (const f of gj.features) {
    const code = f.properties?.code;
    const nom = f.properties?.nom ?? code;
    if (!code || !isMetroFranceDepartmentCode(code)) continue;
    const iso3 = `FR-${code}`;
    const geom = simplifyGeom(f.geometry, 0.006);
    const fc = turf.feature(geom);
    const c = turf.getCoord(turf.centroid(fc));
    names[iso3] = nom;
    features.push({
      type: 'Feature',
      properties: {
        iso3,
        name: nom,
        centroid: [c[0], c[1]],
      },
      geometry: geom,
    });
  }
  features.sort((a, b) => a.properties.iso3.localeCompare(b.properties.iso3));
  const adj = findAdjacencyPairs(features);
  writeGeojson('fr-departments.geojson', features, adj);

  const deptCapitals = features.map((f) => {
    const id = f.properties.iso3;
    const pref = FR_DEPARTMENT_PREFECTURES[id];
    if (!pref) throw new Error(`Préfecture manquante pour ${id} — compléter fr-department-prefectures.mjs`);
    return {
      iso3: id,
      label: pref.label,
      lon: pref.lon,
      lat: pref.lat,
    };
  });
  return { names, deptCapitals };
}

async function buildUsaStates(admin1) {
  const skip = new Set([
    'US-DC',
    'US-AK',
    'US-HI',
    'US-PR',
    'US-VI',
    'US-GU',
    'US-AS',
    'US-MP',
    'US-UM',
  ]);
  const features = [];
  const names = {};
  for (const f of admin1.features) {
    const p = f.properties ?? {};
    if ((p.adm0_a3 || p.ADM0_A3) !== 'USA') continue;
    const iso3166 = p.iso_3166_2;
    if (!iso3166 || !iso3166.startsWith('US-')) continue;
    if (skip.has(iso3166)) continue;
    const cap = US_STATE_CAPITALS[iso3166];
    if (!cap) continue;
    const geom = simplifyGeom(f.geometry, 0.012);
    const fc = turf.feature(geom);
    const c = turf.getCoord(turf.centroid(fc));
    const label = p.name || p.name_en || iso3166;
    names[iso3166] = label;
    features.push({
      type: 'Feature',
      properties: {
        iso3: iso3166,
        name: label,
        centroid: [c[0], c[1]],
      },
      geometry: geom,
    });
  }
  features.sort((a, b) => a.properties.iso3.localeCompare(b.properties.iso3));
  const adj = findAdjacencyPairs(features);
  writeGeojson('usa-states.geojson', features, adj);

  const caps = features.map((f) => {
    const id = f.properties.iso3;
    const sc = US_STATE_CAPITALS[id];
    return {
      iso3: id,
      label: sc.label,
      lon: sc.lon,
      lat: sc.lat,
    };
  });
  return { names, caps };
}

function writeGeneratedTs({
  continentCapitals,
  namesFr,
  iso2,
  deptNames,
  usNames,
  deptCapitals,
  usCaps,
  europeIds,
  southAmericaIds,
  asiaIds,
  frDeptIds,
  usaStateIds,
}) {
  const mergeNames = { ...namesFr, ...deptNames, ...usNames };
  const body = `/* eslint-disable */
/** Généré par scripts/build-world-regions.mjs — ne pas éditer à la main. */
import type { CapitalEntry } from './northAfricaCapitals.ts';

export const EUROPE_COUNTRY_IDS: readonly string[] = ${JSON.stringify(europeIds, null, 2)};

export const SOUTH_AMERICA_COUNTRY_IDS: readonly string[] = ${JSON.stringify(southAmericaIds, null, 2)};

export const ASIA_COUNTRY_IDS: readonly string[] = ${JSON.stringify(asiaIds, null, 2)};

export const FR_DEPARTMENT_IDS: readonly string[] = ${JSON.stringify(frDeptIds, null, 2)};

export const USA_STATE_IDS: readonly string[] = ${JSON.stringify(usaStateIds, null, 2)};

export const WORLD_CONTINENT_CAPITALS: CapitalEntry[] = ${JSON.stringify(continentCapitals, null, 2)};

export const FR_DEPARTMENT_CAPITALS: CapitalEntry[] = ${JSON.stringify(deptCapitals, null, 2)};

export const US_STATE_CAPITAL_ENTRIES: CapitalEntry[] = ${JSON.stringify(usCaps, null, 2)};

export const EXTRA_COUNTRY_NAME_FR: Record<string, string> = ${JSON.stringify(mergeNames, null, 2)};

export const EXTRA_FLAG_ALPHA2_BY_ISO3: Record<string, string> = ${JSON.stringify(iso2, null, 2)};
`;
  fs.writeFileSync(path.join(OUT_SRC, 'worldRegions.generated.ts'), body);
  console.log('Écrit src/data/worldRegions.generated.ts');
}

async function main() {
  console.log('Téléchargement Natural Earth 50m…');
  const world = await fetchJson(NE50);

  const europeFeats = buildEuropeFeaturesFromWorld(world);
  const saFeats = pickCountries(world, (p) => p.CONTINENT === 'South America');
  const asiaFeats = pickCountries(world, (p) => p.CONTINENT === 'Asia');

  const euAdj = findAdjacencyPairs(europeFeats);
  const saAdj = findAdjacencyPairs(saFeats);
  const asAdj = findAdjacencyPairs(asiaFeats);

  writeGeojson('europe.geojson', europeFeats, euAdj);
  writeGeojson('south-america.geojson', saFeats, saAdj);
  writeGeojson('asia.geojson', asiaFeats, asAdj);

  console.log('Téléchargement NE 10m admin-1 + départements FR…');
  const admin1 = await fetchJson(NE10ADM1);
  const { names: deptNames, deptCapitals } = await buildFranceDepartments();
  const { names: usNames, caps: usCaps } = await buildUsaStates(admin1);

  const isoUnion = [
    ...europeFeats.map((f) => f.properties.iso3),
    ...saFeats.map((f) => f.properties.iso3),
    ...asiaFeats.map((f) => f.properties.iso3),
  ];

  console.log('restcountries.com (capitales + noms + alpha-2)…', isoUnion.length, 'codes');
  const { capitals: continentCapitals, namesFr, iso2 } = await fetchCapitalsAndNames(isoUnion);

  const europeIds = europeFeats.map((f) => f.properties.iso3);
  const southAmericaIds = saFeats.map((f) => f.properties.iso3);
  const asiaIds = asiaFeats.map((f) => f.properties.iso3);
  const frDeptIds = deptCapitals.map((c) => c.iso3);
  const usaStateIds = usCaps.map((c) => c.iso3);

  writeGeneratedTs({
    continentCapitals,
    namesFr,
    iso2,
    deptNames,
    usNames,
    deptCapitals,
    usCaps,
    europeIds,
    southAmericaIds,
    asiaIds,
    frDeptIds,
    usaStateIds,
  });

  console.log('Nb départements FR:', frDeptIds.length, '— États US:', usaStateIds.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

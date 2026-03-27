import { Tile } from './Tile.ts';
import type { BorderConnectorRel } from './Renderer.ts';

/** Séparateur de paires (IDs peuvent contenir `-`, ex. US-CA, FR-75). */
const ADJ_PAIR_SEP = '\x1f';

export function adjacencyPairKey(a: string, b: string): string {
  return a < b ? `${a}${ADJ_PAIR_SEP}${b}` : `${b}${ADJ_PAIR_SEP}${a}`;
}
import { COUNTRY_COLORS } from '../data/regionConfig.ts';

type LonLatRing = number[][];
type LonLatPolygon = LonLatRing[];

export interface GeoFeatureProperties {
  iso3: string;
  name: string;
  centroid?: [number, number];
}

export interface GeoFeature {
  type: 'Feature';
  properties: GeoFeatureProperties;
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: unknown;
  };
}

export interface GeoFeatureCollection {
  type: 'FeatureCollection';
  features: GeoFeature[];
  /** Paires de tuiles voisines (puzzle : score, collage). Si absent, le jeu utilise l’adjacence globale Nord Afrique. */
  wp_adjacency?: [string, string][];
  wp_connectors?: { a: string; b: string; lon: number; lat: number }[];
}

/** Couleur stable par identifiant (ISO3 ou FR-75, US-CA, …) quand pas dans `COUNTRY_COLORS`. */
export function tileColorForId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)!) >>> 0;
  const hue = h % 360;
  const sat = 42 + (h % 25);
  const light = 52 + (h % 18);
  return `hsl(${hue} ${sat}% ${light}%)`;
}

interface BBox {
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
}

export type LonLatProjector = (lon: number, lat: number) => [number, number];

/**
 * Même projection que `buildMapTiles` (monde canvas, cohérent avec les tuiles).
 */
export function createLonLatProjector(
  canvas: HTMLCanvasElement,
  geojson: GeoFeatureCollection,
  countries: string[],
): LonLatProjector | null {
  const cw = canvas.width;
  const ch = canvas.height;
  const padding = 48;
  const availW = cw - padding * 2;
  const availH = ch - padding * 2;

  const features = geojson.features.filter((f) => countries.includes(f.properties.iso3));
  if (!features.length) return null;

  const bbox: BBox = {
    minLon: Infinity,
    maxLon: -Infinity,
    minLat: Infinity,
    maxLat: -Infinity,
  };
  for (const f of features) expandBboxFromGeometry(f.geometry, bbox);

  const padLon = (bbox.maxLon - bbox.minLon) * 0.02 || 0.5;
  const padLat = (bbox.maxLat - bbox.minLat) * 0.02 || 0.5;
  const lonMin = bbox.minLon - padLon;
  const lonMax = bbox.maxLon + padLon;
  const latMin = bbox.minLat - padLat;
  const latMax = bbox.maxLat + padLat;
  const lonRange = lonMax - lonMin;
  const latRange = latMax - latMin;
  /** Latitude moyenne du cadre : compresse l’axe est–ouest pour respecter le rapport km/km (sinon carte étirée en largeur). */
  const meanLatRad = (((latMin + latMax) / 2) * Math.PI) / 180;
  const cosLat = Math.max(Math.cos(meanLatRad), 0.2);
  const xSpan = lonRange * cosLat;
  const scale = Math.min(availW / xSpan, availH / latRange);

  return (lon: number, lat: number): [number, number] => {
    const x = padding + (lon - lonMin) * scale * cosLat;
    const y = padding + (latMax - lat) * scale;
    return [x, y];
  };
}

function geomToPolygons(geom: GeoFeature['geometry']): LonLatPolygon[] {
  if (geom.type === 'Polygon') {
    return [geom.coordinates as LonLatRing[]];
  }
  if (geom.type === 'MultiPolygon') {
    return geom.coordinates as LonLatPolygon[];
  }
  return [];
}

function expandBboxFromGeometry(geom: GeoFeature['geometry'], bbox: BBox): void {
  const polys = geomToPolygons(geom);
  for (const rings of polys) {
    for (const ring of rings) {
      for (const c of ring) {
        const lon = c[0]!;
        const lat = c[1]!;
        bbox.minLon = Math.min(bbox.minLon, lon);
        bbox.maxLon = Math.max(bbox.maxLon, lon);
        bbox.minLat = Math.min(bbox.minLat, lat);
        bbox.maxLat = Math.max(bbox.maxLat, lat);
      }
    }
  }
}

export type MapTileLayout = 'scattered' | 'assembled';

export interface BuiltMapTiles {
  tiles: Tile[];
  borderConnectors: BorderConnectorRel[];
}

/**
 * Projection écran + tuiles locales (comme l’ancien buildTiles du puzzle).
 * `assembled` : tuiles déjà à la place cible, nord en haut (carte figée).
 * `randomizeRotation` : si false, mode dispersé avec toutes les tuiles à 0° (nord en haut).
 */
export function buildMapTiles(
  canvas: HTMLCanvasElement,
  geojson: GeoFeatureCollection,
  countries: string[],
  layout: MapTileLayout,
  randomizeRotation = true,
): BuiltMapTiles {
  const cw = canvas.width;
  const ch = canvas.height;

  const features = geojson.features.filter((f) => countries.includes(f.properties.iso3));
  const order = new Map(countries.map((iso, i) => [iso, i] as const));
  features.sort((a, b) => (order.get(a.properties.iso3) ?? 99) - (order.get(b.properties.iso3) ?? 99));

  const project = createLonLatProjector(canvas, geojson, countries);
  if (!project) return { tiles: [], borderConnectors: [] };

  const tiles: Tile[] = features.map((feature, idx) => {
    const iso3 = feature.properties.iso3;
    let cx: number;
    let cy: number;
    const cent = feature.properties.centroid;
    if (cent) {
      [cx, cy] = project(cent[0], cent[1]);
    } else {
      const polys = geomToPolygons(feature.geometry);
      const outer0 = polys[0]?.[0];
      if (!outer0?.length) {
        cx = cw / 2;
        cy = ch / 2;
      } else {
        let sx = 0;
        let sy = 0;
        for (const p of outer0) {
          const [px, py] = project(p[0]!, p[1]!);
          sx += px;
          sy += py;
        }
        cx = sx / outer0.length;
        cy = sy / outer0.length;
      }
    }

    const polysLocal: [number, number][][][] = [];
    for (const rings of geomToPolygons(feature.geometry)) {
      const ringsLocal: [number, number][][] = [];
      for (const ring of rings) {
        ringsLocal.push(
          ring.map((c): [number, number] => {
            const [px, py] = project(c[0]!, c[1]!);
            return [px - cx, py - cy];
          }),
        );
      }
      polysLocal.push(ringsLocal);
    }

    const tile = new Tile({
      id: iso3,
      name: feature.properties.name,
      color: COUNTRY_COLORS[iso3] ?? tileColorForId(iso3),
      polygons: polysLocal,
      targetX: cx,
      targetY: cy,
    });

    if (layout === 'assembled') {
      tile.x = cx;
      tile.y = cy;
      tile.angle = 0;
    } else {
      const cols = Math.ceil(Math.sqrt(features.length * 1.5));
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const cellW = cw / cols;
      const cellH = ch / Math.ceil(features.length / cols);
      tile.x = col * cellW + cellW / 2 + (Math.random() - 0.5) * cellW * 0.35;
      tile.y = row * cellH + cellH / 2 + (Math.random() - 0.5) * cellH * 0.35;

      if (randomizeRotation) {
        tile.angle = [0, 90, 180, 270][Math.floor(Math.random() * 4)]!;
      } else {
        tile.angle = 0;
      }
    }
    tile.zIndex = idx;
    return tile;
  });

  if (layout === 'scattered' && randomizeRotation) {
    let zeroes = tiles.filter((t) => t.angle === 0).length;
    const maxZero = Math.max(1, Math.floor(tiles.length / 4));
    const angles: [number, number, number] = [90, 180, 270];
    for (const tile of tiles) {
      if (zeroes <= maxZero) break;
      if (tile.angle === 0) {
        tile.angle = angles[Math.floor(Math.random() * 3)]!;
        zeroes--;
      }
    }
  }

  const tileMap = new Map(tiles.map((t) => [t.id, t]));
  const borderConnectors: BorderConnectorRel[] = [];
  for (const conn of geojson.wp_connectors ?? []) {
    const ta = tileMap.get(conn.a);
    const tb = tileMap.get(conn.b);
    if (!ta || !tb) continue;
    const P = project(conn.lon, conn.lat);
    const key = adjacencyPairKey(conn.a, conn.b);
    borderConnectors.push({
      key,
      a: conn.a,
      b: conn.b,
      la: [P[0] - ta.targetX, P[1] - ta.targetY],
      lb: [P[0] - tb.targetX, P[1] - tb.targetY],
    });
  }

  return { tiles, borderConnectors };
}

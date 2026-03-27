/** Capitales (FR) + coordonnées WGS84 pour le mode « capitales » (Nord Afrique). */
export interface CapitalEntry {
  iso3: string;
  /** Nom affiché sur le marqueur */
  label: string;
  lon: number;
  lat: number;
}

export const NORTH_AFRICA_CAPITALS: CapitalEntry[] = [
  { iso3: 'MAR', label: 'Rabat', lon: -6.8326, lat: 34.0209 },
  { iso3: 'ESH', label: 'Laâyoune', lon: -13.2032, lat: 27.1532 },
  { iso3: 'DZA', label: 'Alger', lon: 3.0588, lat: 36.7539 },
  { iso3: 'TUN', label: 'Tunis', lon: 10.1658, lat: 36.8065 },
  { iso3: 'LBY', label: 'Tripoli', lon: 13.1913, lat: 32.8872 },
  { iso3: 'EGY', label: 'Le Caire', lon: 31.2357, lat: 30.0444 },
  { iso3: 'MRT', label: 'Nouakchott', lon: -15.9784, lat: 18.0735 },
  { iso3: 'MLI', label: 'Bamako', lon: -8.0029, lat: 12.6392 },
  { iso3: 'NER', label: 'Niamey', lon: 2.1098, lat: 13.5137 },
  { iso3: 'TCD', label: 'N’Djaména', lon: 15.0444, lat: 12.1348 },
  { iso3: 'SDN', label: 'Khartoum', lon: 32.5599, lat: 15.5007 },
];

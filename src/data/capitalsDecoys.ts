/** Grande ville hors capitale (2ᵉ ville / pôle régional) par pays ISO3. */
export interface CitySpot {
  label: string;
  lon: number;
  lat: number;
}

export const SECOND_CITY_BY_ISO3: Record<string, CitySpot> = {
  MAR: { label: 'Casablanca', lon: -7.5898, lat: 33.5731 },
  ESH: { label: 'Dakhla', lon: -15.95, lat: 23.6842 },
  DZA: { label: 'Oran', lon: -0.6417, lat: 35.6969 },
  TUN: { label: 'Sfax', lon: 10.76, lat: 34.74 },
  LBY: { label: 'Benghazi', lon: 20.0686, lat: 32.1167 },
  EGY: { label: 'Alexandrie', lon: 29.9187, lat: 31.2001 },
  MRT: { label: 'Nouadhibou', lon: -17.0384, lat: 20.901 },
  MLI: { label: 'Sikasso', lon: -5.6677, lat: 11.3172 },
  NER: { label: 'Zinder', lon: 8.9872, lat: 13.807 },
  TCD: { label: 'Moundou', lon: 16.0834, lat: 8.5667 },
  SDN: { label: 'Port-Soudan', lon: 37.2164, lat: 19.6158 },
};

/**
 * Villes réelles (hors capitales) pour brouiller : proches de frontières ou très connues.
 * Ne doivent pas être « placées » : elles reviennent sur le côté au relâchement.
 */
export const NEIGHBOR_LEURE_CITIES: CitySpot[] = [
  { label: 'Tlemcen', lon: -1.315, lat: 34.878 },
  { label: 'Ghardaïa', lon: 3.086, lat: 32.483 },
  { label: 'Tozeur', lon: 8.1339, lat: 33.9197 },
  { label: 'Gabès', lon: 10.0978, lat: 33.8881 },
  { label: 'Sebha', lon: 14.4348, lat: 27.0377 },
  { label: 'Assouan', lon: 32.8998, lat: 24.0889 },
  { label: 'Louxor', lon: 32.6396, lat: 25.6872 },
  { label: 'Rosso', lon: -16.4214, lat: 16.5138 },
  { label: 'Kayes', lon: -11.4333, lat: 14.4469 },
  { label: 'Mopti', lon: -4.1958, lat: 14.4843 },
  { label: 'Agadez', lon: 6.9369, lat: 16.9733 },
  { label: 'Maradi', lon: 6.0969, lat: 13.5 },
  { label: 'Sarh', lon: 18.1833, lat: 9.15 },
  { label: 'Abéché', lon: 20.8322, lat: 13.8292 },
  { label: 'Nyala', lon: 24.8864, lat: 12.05 },
];

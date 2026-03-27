/** Métadonnées des capitales pour le mode « capitales » (données pays : `worldRegions.generated.ts`). */
export interface CapitalEntry {
  iso3: string;
  /** Nom affiché sur le marqueur */
  label: string;
  lon: number;
  lat: number;
}

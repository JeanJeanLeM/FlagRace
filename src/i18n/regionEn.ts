/** Libellés et descriptions des cartes (menu) en anglais — clés = id dans `regionConfig`. */
export const REGION_CATALOG_EN: Record<
  string,
  { label: string; descriptionLines: readonly string[] }
> = {
  'north-central-america': {
    label: 'North & Central America',
    descriptionLines: [
      'USA, Canada, Mexico, isthmus, Caribbean (Natural Earth · Greenland excluded)',
    ],
  },
  'south-america': {
    label: 'South America',
    descriptionLines: ['Excluding Caribbean and Central America'],
  },
  europe: {
    label: 'Europe',
    descriptionLines: [
      'Without overseas territories (FR, UK, ES, NL, DK…) · Russia west of ~60°E + Kaliningrad',
    ],
  },
  africa: {
    label: 'Africa',
    descriptionLines: ['African continent (Natural Earth)'],
  },
  asia: {
    label: 'Asia',
    descriptionLines: ['Asian continent (Natural Earth)'],
  },
  france: {
    label: 'France',
    descriptionLines: ['Single country · mainland (excluding overseas)'],
  },
  usa: {
    label: 'United States',
    descriptionLines: ['Single country · full outline'],
  },
  'fr-departments': {
    label: 'France · departments',
    descriptionLines: ['Mainland only (excluding DROM-COM)'],
  },
  'usa-states': {
    label: 'United States · states',
    descriptionLines: ['48 contiguous states (excluding AK, HI, D.C.)'],
  },
};

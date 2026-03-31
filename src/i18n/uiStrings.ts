import type { Locale } from './locale.ts';

type Row = { fr: string; en: string };

/** Textes UI statiques FR/EN (clés plates pour `t()` et `data-i18n`). */
export const UI_STRINGS: Record<string, Row> = {
  'meta.description': {
    fr: 'Jeu de cartes : puzzle pays, capitales, drapeaux et noms sur la carte.',
    en: 'Map game: country puzzle, capitals, flags, and labels on the map.',
  },

  'lang.aria': { fr: 'Langue', en: 'Language' },

  'menu.gameMode': { fr: 'Mode de jeu', en: 'Game mode' },

  'gameType.puzzle.name': { fr: 'Puzzle pays', en: 'Country puzzle' },
  'gameType.puzzle.aria': {
    fr: 'Puzzle pays : assembler les tuiles pour reconstituer la carte',
    en: 'Country puzzle: fit tiles together to rebuild the map',
  },
  'gameType.capitals.name': { fr: 'Capitales', en: 'Capitals' },
  'gameType.capitals.aria': {
    fr: 'Capitales : placer chaque étiquette sur le bon pays',
    en: 'Capitals: place each label on the correct country',
  },
  'gameType.flags.name': { fr: 'Drapeaux', en: 'Flags' },
  'gameType.flags.aria': {
    fr: 'Drapeaux : placer chaque drapeau sur le bon pays',
    en: 'Flags: place each flag on the correct country',
  },
  'gameType.labels.name': { fr: 'Noms sur la carte', en: 'Labels on the map' },
  'gameType.labels.aria': {
    fr: 'Noms sur la carte : placer chaque nom sur le bon pays',
    en: 'Labels on the map: place each name on the correct country',
  },

  'ad.label': { fr: 'Publicité', en: 'Advertisement' },

  'worldMap.heading': { fr: 'Carte du monde', en: 'World map' },
  'worldMap.selectedLabel': { fr: 'Carte sélectionnée', en: 'Selected map' },
  'worldMap.svgAria': { fr: 'Carte interactive', en: 'Interactive map' },
  'worldMap.extraHeading': { fr: 'Cartes plus détaillées', en: 'More detailed maps' },
  'worldMap.extraGroupAria': {
    fr: 'France par département ou États-Unis par État',
    en: 'France by department or United States by state',
  },
  'worldMap.fallback': {
    fr: 'Carte menu indisponible. Lance <code>npm run build:menu-map</code> à la racine du projet.',
    en: 'Menu map unavailable. Run <code>npm run build:menu-map</code> from the project root.',
  },

  'menu.hint.drag': { fr: 'Glisser : déplacer', en: 'Drag: move' },
  'menu.hint.wheelRotate': { fr: 'Molette : rotation', en: 'Wheel: rotate' },
  'menu.hint.ctrlWheel': { fr: 'Ctrl + molette : zoom', en: 'Ctrl + wheel: zoom' },
  'menu.hint.dblClick': { fr: 'Double-clic : nord (Facile / Moyen)', en: 'Double-click: north up (Easy / Medium)' },
  'menu.hint.release': { fr: 'Relâcher : aimant', en: 'Release: snap' },

  'menu.start': { fr: 'Lancer la partie', en: 'Start game' },
  'menu.startDockAria': { fr: 'Lancer une partie', en: 'Start a game' },

  'modal.title': { fr: 'Avant de jouer', en: 'Before you play' },
  'modal.cancel': { fr: 'Annuler', en: 'Cancel' },
  'modal.play': { fr: 'Jouer', en: 'Play' },

  'modal.flag.heading': { fr: 'Difficulté · Drapeaux', en: 'Difficulty · Flags' },
  'modal.flag.l1.name': { fr: 'Niveau 1', en: 'Level 1' },
  'modal.flag.l1.p1': { fr: 'Que des pays de la carte', en: 'Only countries on the map' },
  'modal.flag.l1.p2': { fr: 'Zéro leurre', en: 'No decoys' },
  'modal.flag.l2.name': { fr: 'Niveau 2', en: 'Level 2' },
  'modal.flag.l2.p1': { fr: 'Niveau 1 + micro-États hors carte', en: 'Level 1 + micro-states off the map' },
  'modal.flag.l2.p2': { fr: 'Ne placer que ce qui est sur la carte', en: 'Only place what appears on the map' },
  'modal.flag.l3.name': { fr: 'Niveau 3', en: 'Level 3' },
  'modal.flag.l3.p1': { fr: 'Niveau 2 + faux amis', en: 'Level 2 + lookalikes' },
  'modal.flag.l3.p2': { fr: 'Dock chargé en leurres', en: 'Dock packed with decoys' },

  'modal.labels.heading': { fr: 'Difficulté · Noms sur la carte', en: 'Difficulty · Map labels' },
  'modal.labels.l1.name': { fr: 'Niveau 1', en: 'Level 1' },
  'modal.labels.l1.p1': { fr: 'Drapeau emoji + nom', en: 'Flag emoji + name' },
  'modal.labels.l1.p2': { fr: 'Faux pays → retour gauche', en: 'Wrong country → back to dock' },
  'modal.labels.l2.name': { fr: 'Niveau 2', en: 'Level 2' },
  'modal.labels.l2.p1': { fr: 'Nom seul, mêmes pays', en: 'Name only, same countries' },
  'modal.labels.l2.p2': { fr: 'Pas d’emoji drapeau', en: 'No flag emoji' },
  'modal.labels.l3.name': { fr: 'Niveau 3', en: 'Level 3' },
  'modal.labels.l3.p1': { fr: 'Noms hors carte dans le dock', en: 'Off-map names in the dock' },
  'modal.labels.l3.p2': { fr: 'Leurres : retour auto', en: 'Decoys: auto-return' },

  'modal.puzzle.heading': { fr: 'Difficulté · Puzzle pays', en: 'Difficulty · Country puzzle' },
  'modal.puzzle.easy.name': { fr: 'Facile', en: 'Easy' },
  'modal.puzzle.easy.p1': { fr: 'Tuiles déjà orientées nord en haut', en: 'Tiles start north-up' },
  'modal.puzzle.easy.p2': { fr: 'Max d’indices à l’écran', en: 'Maximum on-screen hints' },
  'modal.puzzle.easy.p3': { fr: 'Double-clic = nord en haut', en: 'Double-click = north up' },
  'modal.puzzle.medium.name': { fr: 'Moyen', en: 'Medium' },
  'modal.puzzle.medium.p1': { fr: 'Rotations aléatoires au départ', en: 'Random rotations at start' },
  'modal.puzzle.medium.p2': { fr: 'Noms + couleurs', en: 'Names + colors' },
  'modal.puzzle.medium.p3': { fr: 'Double-clic nord seulement', en: 'North-up double-click only' },
  'modal.puzzle.expert.name': { fr: 'Expert', en: 'Expert' },
  'modal.puzzle.expert.p1': { fr: 'Rotations aléatoires au départ', en: 'Random rotations at start' },
  'modal.puzzle.expert.p2': { fr: 'Monochrome, sans texte', en: 'Monochrome, no text' },
  'modal.puzzle.expert.p3': { fr: 'Pas de raccourci nord', en: 'No north-up shortcut' },

  'modal.capitals.heading': { fr: 'Difficulté · Capitales', en: 'Difficulty · Capitals' },
  'modal.capitals.inCountry.name': { fr: 'Pays', en: 'Country' },
  'modal.capitals.inCountry.p1': { fr: 'N’importe où dans le pays', en: 'Anywhere inside the country' },
  'modal.capitals.inCountry.p2': { fr: 'Capitale exacte non requise', en: 'Exact capital not required' },
  'modal.capitals.capital.name': { fr: 'Capitale', en: 'Capital' },
  'modal.capitals.capital.p1': { fr: 'Bon pays + près du point', en: 'Correct country + near the point' },
  'modal.capitals.capital.p2': { fr: 'Tolérance autour de la capitale', en: 'Tolerance around the capital' },
  'modal.capitals.decoys.name': { fr: 'Pièges', en: 'Traps' },
  'modal.capitals.decoys.p1': { fr: 'Comme Capitale + leurres', en: 'Like Capital + decoys' },
  'modal.capitals.decoys.p2': { fr: 'Fausse ville → retour', en: 'Wrong city → return' },

  'game.back': { fr: '← Menu', en: '← Menu' },
  'game.zoom.aria': { fr: 'Zoom', en: 'Zoom' },
  'game.zoom.outTitle': { fr: 'Dézoomer (−)', en: 'Zoom out (−)' },
  'game.zoom.resetTitle': {
    fr: 'Vue de départ : centrage + zoom large (touche 0)',
    en: 'Default view: center + wide zoom (key 0)',
  },
  'game.zoom.inTitle': { fr: 'Zoomer (+)', en: 'Zoom in (+)' },
  'game.zoom.resetLabel': { fr: 'Défaut', en: 'Reset' },
  'game.abandon.title': {
    fr: 'Placer automatiquement le reste : +1 min au chrono et pénalité de points',
    en: 'Auto-place the rest: +1 min on the clock and score penalty',
  },
  'game.abandon.button': { fr: 'Abandonner', en: 'Give up' },
  'game.stat.time': { fr: 'Temps', en: 'Time' },
  'game.stat.score': { fr: 'Score', en: 'Score' },
  'game.progress.connections': { fr: 'Connexions', en: 'Connections' },
  'game.progress.flags': { fr: 'Drapeaux', en: 'Flags' },
  'game.progress.capitals': { fr: 'Capitales', en: 'Capitals' },
  'game.progress.names': { fr: 'Noms', en: 'Names' },
  'game.dock.capitalsAria': { fr: 'Capitales à placer sur la carte', en: 'Capitals to place on the map' },
  'game.dock.flagAria': { fr: 'Drapeaux à placer, liste défilante', en: 'Flags to place, scrollable list' },
  'game.dock.labelsAria': { fr: 'Noms de pays à placer sur la carte', en: 'Country names to place on the map' },
  'game.dock.genericAria': { fr: 'Étiquettes à placer sur la carte', en: 'Labels to place on the map' },
  'game.ad.railAria': { fr: 'Publicité', en: 'Advertisement' },

  'game.menu.openAria': { fr: 'Menu partie', en: 'Game menu' },
  'game.action.backToMenu': { fr: 'Retour au menu', en: 'Back to menu' },
  'game.action.giveUp': { fr: 'Abandonner…', en: 'Give up…' },
  'game.action.help': { fr: 'Aide', en: 'Help' },
  'game.action.helpFooter': {
    fr: 'Les conseils s’affichent sous la carte.',
    en: 'Tips appear below the map.',
  },
  'game.dock.prevAria': { fr: 'Élément précédent', en: 'Previous item' },
  'game.dock.nextAria': { fr: 'Élément suivant', en: 'Next item' },
  'game.dock.dragFlag': { fr: 'Glisser sur le pays', en: 'Drag onto the country' },
  'game.dock.dragMap': { fr: 'Glisser sur la carte', en: 'Drag onto the map' },
  'game.dock.dragCountry': { fr: 'Glisser sur le pays sur la carte', en: 'Drag onto the country on the map' },
  'game.hint.mobileDockSuffix': {
    fr: 'Bas : un élément à la fois — ‹ › ou défilement horizontal sur la carte.',
    en: 'Bottom: one item at a time — ‹ › or horizontal scroll on the card.',
  },

  'victory.eyebrow.puzzleSolved': { fr: 'Puzzle résolu', en: 'Puzzle solved' },
  'victory.eyebrow.flagsPlaced': { fr: 'Drapeaux posés', en: 'Flags placed' },
  'victory.eyebrow.capitalsPlaced': { fr: 'Capitales placées', en: 'Capitals placed' },
  'victory.eyebrow.namesPlaced': { fr: 'Noms placés', en: 'Names placed' },
  'victory.title.win': { fr: 'Bravo !', en: 'Well done!' },
  'victory.title.gaveUp': { fr: 'Solution affichée', en: 'Solution shown' },
  'victory.eyebrow.gaveUp': { fr: 'Abandon', en: 'Given up' },

  'victory.desc.puzzle': {
    fr: 'Toutes les frontières du mode sont reliées.',
    en: 'All borders in this mode are connected.',
  },
  'victory.desc.flags': { fr: 'Tous les drapeaux au bon pays.', en: 'Every flag on the correct country.' },
  'victory.desc.labels': { fr: 'Tous les noms bien placés.', en: 'Every name placed correctly.' },
  'victory.desc.capitals.inCountry': {
    fr: 'Toutes les capitales dans le bon pays.',
    en: 'Every capital inside the correct country.',
  },
  'victory.desc.capitals.near': {
    fr: 'Capitales au bon endroit.',
    en: 'Capitals in the right place.',
  },
  'victory.desc.capitals.decoys': {
    fr: 'Capitales OK · leurres ignorés.',
    en: 'Capitals OK · decoys ignored.',
  },
  'victory.desc.gaveUp': {
    fr: '+1 minute au chrono, −{{penalty}} points, et placement automatique des éléments restants.',
    en: '+1 minute on the clock, −{{penalty}} points, and automatic placement of remaining items.',
  },

  'victory.stat.time': { fr: 'Temps', en: 'Time' },
  'victory.stat.score': { fr: 'Score', en: 'Score' },
  'victory.replay': { fr: 'Rejouer', en: 'Play again' },
  'victory.menu': { fr: 'Menu principal', en: 'Main menu' },

  'game.hint.puzzle': {
    fr: 'Chrono · score · Molette : rotation · Double-clic : nord (selon diff.) · Ctrl+molette : zoom · Relâcher : aimant',
    en: 'Timer · score · Wheel: rotate · Double-click: north (by difficulty) · Ctrl+wheel: zoom · Release: snap',
  },
  'game.hint.flag': {
    fr: 'Dock gauche → bon pays · Ctrl+molette ou +/−/0 : zoom',
    en: 'Left dock → correct country · Ctrl+wheel or +/−/0: zoom',
  },
  'game.hint.labels': {
    fr: 'Nom gauche → bon pays · Sinon retour dock · Ctrl+molette ou +/−/0 : zoom',
    en: 'Name on the left → correct country · Else back to dock · Ctrl+wheel or +/−/0: zoom',
  },
  'game.hint.capitals.inCountry': {
    fr: 'Gauche → pays cible · Mauvais pays : reprendre le pin · Ctrl+molette ou +/−/0 : zoom',
    en: 'Left → target country · Wrong country: pick up pin again · Ctrl+wheel or +/−/0: zoom',
  },
  'game.hint.capitals.decoys': {
    fr: 'Villes à gauche · Erreur : pin → dock · Leurres : retour auto · Ctrl+molette : zoom',
    en: 'Cities on the left · On error: pin → dock · Decoys: auto-return · Ctrl+wheel: zoom',
  },
  'game.hint.capitals.near': {
    fr: 'Gauche → carte · Mal placé : pin → dock pour réessayer · Ctrl+molette ou +/−/0 : zoom',
    en: 'Left → map · Misplaced: pin → dock to retry · Ctrl+wheel or +/−/0: zoom',
  },

  'footer.privacy': { fr: 'Confidentialité', en: 'Privacy' },
  'footer.credit': {
    fr: 'Données géographiques : Natural Earth (domaine public)',
    en: 'Geographic data: Natural Earth (public domain)',
  },

  'region.flagBlockedTitle': {
    fr: 'Pas de drapeaux ISO pour cette carte (départements, États US).',
    en: 'No ISO flags for this map (departments, US states).',
  },

  'confirm.abandon': {
    fr: 'Abandonner cette partie ? +1 minute au chrono, pénalité de points, et les éléments restants seront placés automatiquement.',
    en: 'Give up this game? +1 minute on the clock, score penalty, and remaining items will be placed automatically.',
  },

  'game.title.puzzle': { fr: 'World Puzzle — ', en: 'World Puzzle — ' },
  'game.title.flags': { fr: 'World Puzzle — Drapeaux · niv. ', en: 'World Puzzle — Flags · lvl ' },
  'game.title.capitals': { fr: 'World Puzzle — Capitales · ', en: 'World Puzzle — Capitals · ' },
  'game.title.labels': { fr: 'World Puzzle — Noms sur la carte · niv. ', en: 'World Puzzle — Map labels · lvl ' },

  'capitalsModeLabel.country': { fr: 'Pays', en: 'Country' },
  'capitalsModeLabel.decoys': { fr: 'Pièges', en: 'Traps' },
  'capitalsModeLabel.capital': { fr: 'Capitale', en: 'Capital' },

  'ads.consent.aria': { fr: 'Cookies et publicité', en: 'Cookies and ads' },
  'ads.consent.text': {
    fr: 'Nous pouvons afficher des publicités Google (AdSense). Elles peuvent utiliser des cookies ou données équivalentes. Consultez la page Confidentialité pour plus de détails.',
    en: 'We may show Google ads (AdSense). They may use cookies or similar data. See the Privacy page for details.',
  },
  'ads.consent.privacy': { fr: 'Confidentialité', en: 'Privacy' },
  'ads.consent.deny': { fr: 'Refuser', en: 'Decline' },
  'ads.consent.allow': { fr: 'Accepter', en: 'Accept' },
  'ads.loadError': { fr: 'Échec du chargement AdSense', en: 'Failed to load AdSense' },
};

export function pickUiString(key: string, locale: Locale): string {
  const row = UI_STRINGS[key];
  if (!row) return key;
  return row[locale];
}

export function formatUiString(template: string, vars: Record<string, string | number>): string {
  let s = template;
  for (const [k, v] of Object.entries(vars)) {
    s = s.replaceAll(`{{${k}}}`, String(v));
  }
  return s;
}

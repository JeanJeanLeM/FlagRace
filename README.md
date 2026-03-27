# World Puzzle

Jeu de géographie dans le navigateur : reconstituer une carte à partir de tuiles, placer capitales, drapeaux ou noms de pays. Interface en français.

## Prérequis

- [Node.js](https://nodejs.org/) (version récente LTS recommandée)

## Installation

```bash
npm install
```

## Commandes

| Commande | Description |
|----------|-------------|
| `npm run dev` | Serveur de développement Vite (rechargement à chaud) |
| `npm run build` | Compilation TypeScript + build de production dans `dist/` |
| `npm run preview` | Prévisualisation du build de production |
| `npm run build:geo` | Régénère les données GeoJSON Nord Afrique (script `scripts/build-north-africa.mjs`, utilise Turf) |

Après `npm run dev`, ouvrir l’URL affichée dans le terminal (souvent `http://localhost:5173`).

## Modes de jeu

- **Puzzle pays** — Tuiles à glisser pour reconstituer les frontières ; difficulté (aides à l’écran, couleurs, double-clic nord).
- **Capitales** — Étiquettes à placer sur la carte ; niveaux : zone pays, précision capitale, villes leurre.
- **Drapeaux** — Drapeaux à associer aux pays ; niveaux avec ou sans leurres dans le dock.
- **Noms sur la carte** — Noms à placer sur les pays ; niveaux avec emoji drapeau, nom seul, ou noms hors carte.

La région **Nord Afrique** (11 pays) est jouable ; d’autres régions peuvent être ajoutées dans la configuration (voir ci-dessous).

## Contrôles (aperçu)

- **Puzzle** : glisser les tuiles, molette pour pivoter, double-clic pour remettre le nord en haut (selon difficulté), Ctrl + molette pour zoomer, relâcher pour l’aimantation.
- **Autres modes** : glisser-déposer depuis la colonne de gauche vers la carte ; zoom souris ou touches `+` / `-` / `0` selon l’écran.

## Données et nouvelles cartes

- Les fonds pays viennent de fichiers GeoJSON servis depuis `public/data/` (ex. `north-africa.geojson`).
- La liste des régions, les pays par mode et les couleurs sont définis dans `src/data/regionConfig.ts` (`REGION_CATALOG`, `COUNTRY_COLORS`, etc.).
- Pour ajouter une carte jouable : placer le GeoJSON dans `public/data/`, puis ajouter une entrée `available: true` avec `geojsonUrl` et la liste `countries` ISO3 cohérente avec tes données.

Les crédits en pied de page rappellent la source des données géographiques : **Natural Earth** (domaine public).

## Technique

- **TypeScript**, **Vite**, rendu **Canvas 2D**.
- Pas de framework UI : HTML/CSS pour le menu, logique dans `src/` (`main.ts`, `game/`, `menu.ts`, difficultés par mode).

## Licence du dépôt

Projet `private` dans `package.json` ; adapte la licence si tu publies le code.

# FlagRace

Jeu de géographie dans le navigateur centré sur un mode unique : associer chaque drapeau au bon pays (desktop + mobile).

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
| `npm run build:geo` | Régénère les données GeoJSON des régions (scripts dans `scripts/`) |

Après `npm run dev`, ouvrir l’URL affichée dans le terminal (souvent `http://localhost:5173`).

## Mode de jeu

- **Drapeaux** — Place les drapeaux sur les pays de la carte sélectionnée.
- **Mobile** — Tap-to-place : toucher un drapeau puis toucher le pays.
- **Desktop** — Drag-and-drop des drapeaux vers la carte.

## Contrôles

- **Desktop** : glisser-déposer les drapeaux vers les pays.
- **Mobile** : toucher un drapeau pour le sélectionner, puis toucher le pays correspondant.
- **Zoom** : souris (`Ctrl + molette`) ou boutons `+` / `-` / `0` selon le contexte.

## Données et nouvelles cartes

- Les fonds pays viennent de fichiers GeoJSON servis depuis `public/data/`.
- La liste des régions jouables est définie dans `src/data/regionConfig.ts` (`REGION_CATALOG`).
- Pour ajouter une carte jouable : placer le GeoJSON dans `public/data/`, puis ajouter une entrée `available: true` avec `geojsonUrl` et la liste `countries` ISO3 cohérente avec tes données.

Les crédits en pied de page rappellent la source des données géographiques : **Natural Earth** (domaine public).

## Technique

- **TypeScript**, **Vite**, rendu **Canvas 2D**.
- Pas de framework UI : HTML/CSS pour le menu, logique dans `src/` (`main.ts`, `game/`, `menu.ts`).

## Licence du dépôt

Projet `private` dans `package.json` ; adapte la licence si tu publies le code.

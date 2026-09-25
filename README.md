# 🐬 Dolphinarium

Site immersif dédié au monde fascinant des dauphins : galerie, wiki vivant,
quiz, mode zen, carte interactive et salle d'arcade — le tout en **HTML / CSS / JS
statique**, sans backend ni clé API.

## Lancer le site

Ouvrir `index.html` dans un navigateur suffit. Pour une expérience sans accroc
(persistance des scores, aucune alerte `file://`), servir le dossier en local :

```bash
python -m http.server 8000
# puis http://localhost:8000
```

Galerie, wiki et tuiles de la carte exigent une connexion internet (APIs distantes).
Jeux, quiz et mode zen sont 100 % hors-ligne.

## Structure

```
index.html            Accueil immersif (hero + previews)
pages/
  galerie.html        Photothèque Wikimedia Commons + lightbox
  wiki.html           Mini-wiki alimenté par Wikipédia FR
  quiz.html           Quiz 6 thématiques + cinématiques de fin
  zen.html            Mode zen plein écran (audio procédural)
  carte.html          Carte Leaflet : aquariums, zones, flux (satellite)
  jeux.html           Salle d'arcade : Flappy, Nage, Concours de sauts
js/                   Un module par page + storage.js (scores) + easter.js (global)
styles/styles.css     Thème glassmorphism + animations
favicon.svg           Emblème du site
```

## Pages

- **Accueil** — hero avec dauphin SVG animé qui se dessine, cartes d'intro et
  previews vers chaque univers.
- **Galerie** — photos Wikimedia Commons en direct (filtres par espèce, bouton
  *Charger plus*, lightbox). Dauphin qui saute pendant le chargement, et un
  dauphin qui nage dans le bouton pendant la récupération.
- **Wiki** — arborescence (Découvrir / Espèces / Biologie), résumés Wikipédia FR
  en direct, recherche libre, navigation Précédent/Suivant.
- **Quiz** — 6 thématiques × 5 questions (QCM + Vrai/Faux mélangés), explications,
  scores et historique sauvegardés dans le navigateur (couche abstraite prête
  pour Supabase).
- **Zen** — scène plein écran : lumières bleues, dauphin flou, bulles, récif
  (rochers, algues, poissons, bancs, crabe), vagues et sifflements **générés en
  Web Audio** (zéro fichier). Sas d'entrée + fondus sonores.
- **Carte** — Leaflet : 12 aquariums aux coordonnées vérifiées, 6 zones de vie
  schématiques, 8 flux saisonniers aller/retour. Zones et flux sont pédagogiques,
  pas des relevés scientifiques.
- **Jeux** — hub + 3 jeux Canvas avec menus (Jouer/Options/Quitter), 3 difficultés,
  records persistés : *Sauts périlleux* (flappy à tonneaux), *Descente abyssale*
  (nage vers les abysses sur 5000 m), *Concours de sauts* (5 manches vs 3 IA).

## 🥚 Easter eggs — comment les déclencher

| Egg | Où | Déclenchement |
|-----|----|---------------|
| Cinématiques de quiz | Quiz | Chaque score a sa scène fullscreen : 5/5 récif en fête, 4/5 île déserte, 3/5 grand bleu + sifflements, 2/5 fond vide, 1/5 coup de blues, 0/5 abysses au halo (cliquer pour passer) |
| Vidéo des 50 m | Concours de sauts | Total ≥ **50 m** sur un match (5 sauts quasi-parfaits) → bannière dorée vers la vidéo surprise |
| Ballet zen | Mode zen | **Rare** : 1ʳᵉ danse possible entre 1,5 et 3 min, puis toutes les 4 à 8 min — trio flou qui ondule |
| Konami marin | Partout | Taper `↑ ↑ ↓ ↓ ← → ← B A` (hors champs de saisie) → pluie de dauphins |
| Logo taquin | Partout (header) | **5 clics** sur le logo en < 2,5 s → tonneau + plouf |
| Mode abysses | Partout | Visiter entre **22h et 6h** → voile sombre + bulle « bonsoir » |
| Photo légendaire | Galerie | **1 chance sur 8** à chaque chargement → photo au cadre or pulsant |
| Atlantide | Wiki | Rechercher **`atlantide`** → la Grande Bibliothèque engloutie |
| Trésor | Carte | **5 clics** dans l'océan en < 12 s → pastille « Ici vivent des dauphins ! » |
| Dauphin du hero | Accueil | Il se dessine tout seul au chargement — ce n'en est presque plus un 🤫 |

## Notes techniques

- Scores : `localStorage` (`dolphinarium_scores_v1`, `dolphinarium_jeux_v1`) avec
  repli mémoire en `file://` (origines opaques). Voir `js/storage.js`.
- Accessibilité : `prefers-reduced-motion` respecté, navigation clavier, ARIA live.
- Dépôt : `https://github.com/Plumatachi/Dolphinarium.git` (branche `main`).

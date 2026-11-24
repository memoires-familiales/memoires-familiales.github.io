# Consignes pour les assistants de code (Codex, Claude…)

Site familial publié par GitHub Pages depuis la branche principale, sans étape de construction.

## À respecter absolument

- **Ne jamais ajouter au dépôt de données de la famille** : photos, noms, dates, lieux, transcriptions, exports d'Apple Photos. Elles vivent dans `prive/` (exclu par `.gitignore`). Le dépôt est public.
- Une seule exception, décidée par Samuel le 24/11/2026 : le **sommaire du livre** est publié (`data/livre.js`, `data/livre.json`, mode `"public"`). Rien d'autre de réel ne va dans `data/` sans son accord explicite.
- Les exemples publiés (`data/demo/`) sont fictifs. Les régénérer avec `python3 outils/creer_demo.py` et `python3 outils/creer_demo_rubriques.py`.
- Ne créer aucun abonnement ni service payant sans accord explicite.

## Conventions

- Français partout : textes, noms de variables, commentaires, messages.
- HTML, CSS et JavaScript sans dépendance ni framework ; le site doit marcher en ouvrant les fichiers directement (`file://`) comme sur GitHub Pages. Liens internes vers `…/index.html`.
- Les données de chaque rubrique sont chargées par des balises `<script>` qui définissent une variable globale (`window.PHOTOTHEQUE`, `window.LIVRE`, `window.ARBRE`, `window.VOIX`, `window.ARCHIVES`, `window.FILMS`) : d'abord `data/demo/<rubrique>.js`, puis `prive/<rubrique>.js` s'il existe. Pas de `fetch`, pour le mode `file://`.
- Le menu est construit par `assets/js/site.js` à partir de la liste `RUBRIQUES` : une nouvelle page s'y ajoute en une ligne. Chaque page déclare `<body data-racine="../" data-page="<id>">` et `<nav data-nav>`.
- Python 3.9+, bibliothèque standard, plus `openpyxl` et `Pillow` seulement.
- L'import doit rester idempotent : deux imports identiques ne changent rien. Le tester après toute modification de `outils/importer_photos.py`.
- Identité visuelle : papier `#f6f0e4`, encre `#45372a`, café au lait `#7a5a3c`, bleu stylo `#34506e` pour ce qui est écrit au dos des photos ; serif de livre pour les textes, police système pour les commandes. Voir `assets/css/site.css`.

## Documentation

- `README.md` : vue d'ensemble et règle de confidentialité.
- `docs/phototheque.md` : import, règles de fusion, modèle de données.
- `docs/rubriques.md` : format des données du livre, de l'arbre, de la voix, des archives et des films.

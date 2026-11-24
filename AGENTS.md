# Consignes pour les assistants de code (Codex, Claude…)

Site familial publié par GitHub Pages depuis la branche principale, sans étape de construction.

## À respecter absolument

- **Ne jamais ajouter au dépôt de données de la famille** : photos, noms, dates, lieux, transcriptions, exports d'Apple Photos. Elles vivent dans `prive/` (exclu par `.gitignore`). Le dépôt est public.
- Les exemples publiés (`data/demo/`) sont fictifs. Les régénérer avec `python3 outils/creer_demo.py`.
- Ne créer aucun abonnement ni service payant sans accord explicite.

## Conventions

- Français partout : textes, noms de variables, commentaires, messages.
- HTML, CSS et JavaScript sans dépendance ni framework ; le site doit marcher en ouvrant les fichiers directement (`file://`) comme sur GitHub Pages. Liens internes vers `…/index.html`.
- Les données de la photothèque sont chargées par des balises `<script>` qui définissent `window.PHOTOTHEQUE` (pas de `fetch`, pour le mode `file://`).
- Python 3.9+, bibliothèque standard, plus `openpyxl` et `Pillow` seulement.
- L'import doit rester idempotent : deux imports identiques ne changent rien. Le tester après toute modification de `outils/importer_photos.py`.
- Identité visuelle : papier `#f6f0e4`, encre `#45372a`, café au lait `#7a5a3c`, bleu stylo `#34506e` pour ce qui est écrit au dos des photos ; serif de livre pour les textes, police système pour les commandes. Voir `assets/css/site.css`.

## Documentation

- `README.md` : vue d'ensemble et règle de confidentialité.
- `docs/phototheque.md` : import, règles de fusion, modèle de données.

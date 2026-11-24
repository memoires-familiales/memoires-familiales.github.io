# Mémoires familiales

L'espace numérique qui prolonge le livre *Mamili*, Rosalie Luque, née Llerena. Le QR code imprimé dans le livre renvoie à ce site : <https://memoires-familiales.github.io/>.

## Ce que contient le site

| Page | Adresse | État |
|---|---|---|
| Accueil : présentation et rubriques à venir | `index.html` | En ligne |
| Photothèque : recherche par personne, lieu, décennie, événement, chapitre du livre ; fiche de chaque photo | `phototheque/` | Premier aperçu, avec des photos d'exemple |
| Le livre, l'arbre généalogique, la voix de Mamili, les archives, les films, participer | — | À venir |

Le site est fait de pages HTML simples, sans outil de construction : ce qui est dans le dépôt est ce qui est publié par GitHub Pages.

## La règle de confidentialité

**Aucune photo, aucun nom, aucune donnée de la famille ne doit entrer dans ce dépôt.** Le dépôt est public et GitHub Pages ne sait pas réserver une page à certaines personnes.

- La photothèque publiée montre un **jeu d'exemple fictif** (`data/demo/`).
- Les vraies données sont fabriquées sur l'ordinateur, dans le dossier **`prive/`**, que `.gitignore` exclut de Git. La page de la photothèque les charge automatiquement quand elles sont présentes : la photothèque complète se consulte donc en local, en ouvrant `phototheque/index.html`.
- L'accès familial en ligne (photos privées, comptes sur invitation) fera l'objet d'une étape à part, avec un stockage privé.

## Organisation du dépôt

```
index.html                  accueil
phototheque/index.html      photothèque
assets/css/                 styles (communs, accueil, photothèque)
assets/js/phototheque.js    recherche, filtres, galerie, fiche
data/demo/                  jeu d'exemple fictif (données + images)
outils/importer_photos.py   import des photos depuis Apple Photos → prive/
outils/creer_demo.py        fabrique le jeu d'exemple
docs/phototheque.md         mode d'emploi de l'import et modèle de données
prive/                      (non suivi par Git) données réelles de la famille
```

## Voir la photothèque complète sur son ordinateur

```bash
pip3 install openpyxl pillow
python3 outils/importer_photos.py \
  --photos "Export_Photos - Album complet.xlsx" \
  --complements "TABLEAU - PHOTOS ANCIENNES 3.xlsx" \
  --referentiel "REFERENTIEL - IDENTITES PERSONNES PHOTOS ANCIENNES.xlsx" \
  --images "dossier des photos exportées en JPEG"
open phototheque/index.html
```

Le détail (export depuis Apple Photos, rapport d'import, retour en arrière) est dans [docs/phototheque.md](docs/phototheque.md).

## Feuille de route

1. **Photothèque** (en cours) : galerie, filtres, import idempotent depuis Apple Photos.
2. **Arbre généalogique** : une fiche par personne, reliée à ses photos.
3. **La voix de Mamili** : extraits audio et transcriptions, rangés par chapitre du livre.
4. **Archives et films de famille.**
5. **Participer** : identifications et corrections proposées par la famille, modérées, conservées à part des imports.

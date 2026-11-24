# Mémoires familiales

L'espace numérique qui prolonge le livre *Mamili*, Rosalie Luque, née Llerena. Le QR code imprimé dans le livre renvoie à ce site : <https://memoires-familiales.github.io/>.

## Ce que contient le site

| Page | Adresse | État |
|---|---|---|
| Accueil : présentation et sommaire des rubriques | `index.html` | En ligne |
| Photothèque : recherche par personne, lieu, décennie, événement, chapitre du livre ; fiche de chaque photo | `phototheque/` | Présentation publique et accès à l’espace famille |
| Le livre : sommaire, avec les photos et les extraits audio de chaque chapitre | `livre/` | Sommaire réel en ligne (14 parties, 108 chapitres), avec les pages du livre imprimé |
| L'arbre : une personne au centre, ses parents, son conjoint, ses enfants | `arbre/` | Présentation publique et accès à l’espace famille |
| La voix de Mamili : extraits audio et transcriptions par chapitre | `voix/` | Présentation publique et extraits dans l’espace famille |
| Les archives : documents par type, avec recherche | `archives/` | Présentation publique et accès à l’espace famille |
| Les films : un écran par film, et ses séquences | `films/` | Présentation publique et accès à l’espace famille |
| Participer : envoie par e-mail à Samuel une identification, une correction, un souvenir, des photos (pièces jointes) | `participer/` | Utilisable, après activation de FormSubmit (voir docs/rubriques.md) |

Le site est fait de pages HTML simples, sans outil de construction : ce qui est dans le dépôt est ce qui est publié par GitHub Pages.

## La règle de confidentialité

**Aucune photo, aucun nom, aucune donnée de la famille ne doit entrer dans ce dépôt.** Le dépôt est public et GitHub Pages ne sait pas réserver une page à certaines personnes.

- Les rubriques publiques présentent leur contenu et renvoient vers l’espace famille. Le sommaire réel du livre (`data/livre.js`) reste public avec l’accord de la famille. Les jeux d’exemple (`data/demo/`) servent à la consultation locale.
- Les vraies données sont fabriquées sur l'ordinateur, dans le dossier **`prive/`**, que `.gitignore` exclut de Git. Chaque page les charge automatiquement quand elles sont présentes : le site complet se consulte donc en local, en ouvrant les pages par double-clic.
- L'**espace famille** en ligne est une copie du site avec ces données, dans un dépôt privé publié par Cloudflare Pages et protégé par Cloudflare Access (accès par adresse e-mail et code). Voir `docs/espace-famille.md`.

## Organisation du dépôt

```
index.html                  accueil
phototheque/ livre/ arbre/ voix/ archives/ films/ participer/   une page par rubrique
assets/css/                 styles (communs, accueil, photothèque, rubriques)
assets/js/site.js           menu commun (liste des rubriques) et outils partagés
assets/js/<rubrique>.js     le fonctionnement de chaque page
data/demo/                  jeu d'exemple fictif (données + images)
outils/importer_photos.py   import des photos depuis Apple Photos → prive/
outils/mettre-a-jour-phototheque.command   lanceur Mac : import + ouverture
outils/creer_demo.py        fabrique les photos d'exemple
outils/creer_demo_rubriques.py   fabrique les exemples des autres rubriques
outils/extraire_sommaire.py      extrait le sommaire du livre (parties, chapitres, photos, pages imprimées)
outils/preparer_espace_famille.py   assemble l'espace famille (site + prive/) pour le dépôt privé
outils/catalogue_voix.py         catalogue des extraits audio (prive/voix/) → prive/voix.js, avec contrôles
data/livre.js               sommaire du livre, publié
docs/phototheque.md         import des photos et modèle de données
docs/rubriques.md           format des données de chaque rubrique
docs/espace-famille.md      l'espace famille protégé : mise en place et mises à jour
prive/                      (non suivi par Git) données réelles de la famille
```

## Voir la photothèque complète sur son ordinateur

Sur le Mac, double-cliquer sur `outils/mettre-a-jour-phototheque.command` (au premier lancement, indiquer l'emplacement des fichiers dans `prive/config-import.json`). Ou, dans le Terminal :

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

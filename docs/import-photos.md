# Import complet de la photothèque : méthode pas à pas

Méthode suivie par Claude le 24/11/2026 sur un essai de 30 photos, à reprendre pour l'import complet. Tout se passe **sur le Mac de Samuel**, dans le clone local de ce dépôt. Les données produites restent dans `prive/`, que Git ignore : rien ne part sur GitHub.

## La voie rapide : une seule commande

Un script fait tout, dans l'ordre, et s'arrête au premier problème en donnant la solution :

```bash
cd ~/Documents/GitHub/memoires-familiales.github.io   # le clone local (adapter le chemin)
git pull                                              # récupérer la dernière version
bash outils/import-complet-mac.command
```

Par double-clic dans le Finder sur `outils/import-complet-mac.command`, c'est la même chose (une fenêtre de Terminal s'ouvre, puis la photothèque et le rapport à la fin).

Si le dépôt n'est pas encore sur le Mac :

```bash
mkdir -p ~/Documents/GitHub && cd ~/Documents/GitHub
git clone https://github.com/memoires-familiales/memoires-familiales.github.io.git
cd memoires-familiales.github.io
```

Options : `SIMULATION=1 bash outils/import-complet-mac.command` s'arrête après la simulation (rien n'est modifié) ; `FORCER=1 …` importe même si l'export depuis Photos semble encore en cours.

## Ce que fait le script, et ce qu'on doit voir

| Étape | Ce qu'il fait | Affichage attendu |
|---|---|---|
| 1. Dépôt | vérifie qu'il tourne dans le clone et que `prive/` est ignoré par Git | `ok : clone …, prive/ ignoré par Git` |
| 2. Python | Python 3.9 ou plus, modules openpyxl et Pillow (installés au besoin avec `pip --user`) | `ok : Python 3.x, openpyxl et Pillow présents` |
| 3. Drive | trouve « Mon Drive » dans `~/Library/CloudStorage/GoogleDrive-…/` et les dossiers du projet | `ok : …/Mon Drive` |
| 4. prive/ | si besoin, décompresse le kit privé du Drive (ou seulement les fichiers qui manquent) ; écrit `prive/config-import.json` avec les chemins de ce Mac ; vérifie les quatre fichiers d'entrée et le sommaire du livre | `ok : sommaire du livre présent` puis `ok : les quatre fichiers d'entrée sont trouvés` |
| 5. Export | compte les images deux fois à 20 s d'intervalle (l'export doit être fini) ; lit trois images pour vérifier l'accès aux fichiers du Drive | `1 xxx images…` puis `lu : P0001 …` |
| 6. Simulation | import à blanc, résumé du rapport | `1494 photos · … conflit(s)` et la ligne `Images : …` |
| 7. Import | fiches, miniatures (480 px) et versions web (1 600 px) dans `prive/images/`, données dans `prive/photos.js` | `durée : … s ; rapport : prive/rapports/import-….md` |
| 8. Contrôles | relance l'import : il ne doit plus rien changer ; compte les photos illustrées et la taille des images | `ok : second passage sans changement` |

Durée : quelques minutes pour environ 1 500 photos, plus le temps de téléchargement des images restées dans le nuage (environ 1,5 Go). L'essai du 24/11 a donné, en simulation et à l'import : 1 494 fiches, 53 conflits, 92 noms sans correspondance ; second passage sans changement.

## Les fichiers d'entrée (tous sur le Google Drive de Samuel)

Chemins à partir de `~/Library/CloudStorage/GoogleDrive-<adresse>/Mon Drive/` :

| Rôle | Emplacement | Clé de `prive/config-import.json` |
|---|---|---|
| Images de l'album, exportées de Photos en JPEG (nom = titre, « P0001 - … .jpeg ») | `03 - MEMOIRES MAMILI/02 - Site internet/04 - Photothèque - espace famille/EXPORT ALBUM ANCIENNES PHOTOS/` | `images` |
| Métadonnées de Photos (UUID, titre, dates, lieux, personnes reconnues, albums…) | `08 - NUMÉRISATION PHOTOS/TABLEAU/Export_Photos_avec_miniatures_2026-09-30_22-11-12 - Album complet.xlsx` | `photos` |
| Tableau de travail (dates estimées, lieux, personnes, versos, chapitres) ; 41 Mo, lecture lente | `08 - NUMÉRISATION PHOTOS/TABLEAU/TABLEAU - PHOTOS ANCIENNES 3.xlsx` | `complements` |
| Référentiel des personnes | `08 - NUMÉRISATION PHOTOS/TABLEAU/REFERENTIEL - IDENTITES PERSONNES PHOTOS ANCIENNES.xlsx` | `referentiel` |

Ce sont les originaux : le script les lit, ne les modifie jamais.

Le kit privé `phototheque-prive-essai-30-photos-2026-11-24.zip` (dossier `04 - Photothèque - espace famille` du Drive) contient un dossier `prive/` : `config-import.json`, `alias-personnes.csv` (correspondances de noms confirmées par Samuel, prioritaires sur le référentiel), `livre.js` et `livre.json` (le sommaire du livre, désormais privé : il donne à chaque photo imprimée son chapitre) et le résultat de l'essai (32 photos illustrées). Le script le décompresse tout seul si `prive/` n'a pas encore ces fichiers. À la main : `unzip -o "<chemin du kit>" -d .` depuis la racine du clone (donne `./prive/…`, pas `./prive/prive/…`).

## En cas de blocage

| Message ou symptôme | Cause | Solution |
|---|---|---|
| `prive/ n'est pas ignoré par Git` | clone ancien ou `.gitignore` modifié | `git pull`, vérifier `git check-ignore prive/photos.js` |
| `openpyxl ou Pillow manquent et l'installation a échoué` | pas de réseau (c'est le cas dans le bac à sable de Codex) | dans le Terminal, soi-même : `python3 -m pip install --user openpyxl pillow` |
| `python3 introuvable` | outils de développement absents | `xcode-select --install` |
| `Google Drive pour ordinateur introuvable` | app Google Drive fermée, ou programme (Codex) qui ne peut pas parcourir `~/Library/CloudStorage` | ouvrir Google Drive ; ou donner le chemin : `DRIVE="$HOME/Library/CloudStorage/GoogleDrive-<adresse>/Mon Drive" bash outils/import-complet-mac.command` (une fois `prive/config-import.json` écrit, le script reprend ce chemin tout seul) |
| `dossier introuvable : …` | dossier renommé ou déplacé sur le Drive | remettre le nom attendu, ou corriger le chemin dans `prive/config-import.json` |
| `l'export depuis Photos est encore en cours` | Photos écrit encore des fichiers | attendre la fin ; sinon `FORCER=1` |
| `les images du Drive ne se lisent pas depuis ce programme`, `Resource deadlock avoided`, `Operation not permitted` | images restées dans le nuage, ou programme (Codex) sans droit sur `~/Library/CloudStorage` | Finder : clic droit sur « EXPORT ALBUM ANCIENNES PHOTOS » → Disponible hors connexion, attendre ; ou lancer le script dans le Terminal plutôt que dans Codex |
| lecture du tableau très longue | 41 Mo d'images incluses dans le classeur | patienter (une à deux minutes) |
| `Premier lancement : indiquez l'emplacement de vos fichiers` | `prive/config-import.json` absent quand on lance `importer_photos.py` directement | lancer `outils/import-complet-mac.command`, qui l'écrit |
| `ATTENTION : le second passage a encore modifié des fiches` | anomalie de l'import | ne rien corriger à la main ; transmettre le rapport à Claude |
| `ATTENTION : prive/livre.json absent` | sommaire du livre absent du poste (il n'est plus publié) | le reprendre du kit, ou de `prive/livre.json` du dépôt privé de l'espace famille |
| photos sans image dans la photothèque | photo absente de l'export (pas encore exportée, ou masquée) | voir la liste « Photos sans image trouvée » du rapport |

Pour Codex : son bac à sable coupe souvent le réseau et limite l'accès aux dossiers hors du projet. S'il bloque à l'étape 2 ou 5, le plus simple est que Samuel lance lui-même la commande dans le Terminal, puis donne le rapport à Codex ou à Claude.

## Ce qu'il ne faut pas faire

- Ne jamais ajouter `prive/` (ou une image, un nom, un export) au dépôt public, ni forcer Git à le suivre (`git add -f`).
- Ne pas lancer `outils/preparer_espace_famille.py` : la publication des photos dans l'espace famille est une décision de Samuel, réalisée ensuite par Claude depuis le poste qui a toute la voix. Le script refuse de toute façon de vider une rubrique déjà en ligne sans `--vider`.
- Ne pas éditer `prive/photos.js` à la main : corriger dans Photos, le tableau, le référentiel ou `prive/alias-personnes.csv`, puis relancer.
- Ne pas inventer de fiche pour une image sans métadonnées.

## Photos ajoutées après l'export des métadonnées

L'export des métadonnées date du 30/09/2026 : 1 494 photos, numérotées de P0001 à P1517. L'album exporté le 24/11 va jusqu'à P1753 : les images plus récentes n'ont pas de fiche. Le rapport les liste sous « Images du dossier sans fiche dans l'export ». Pour les ajouter : refaire l'export des métadonnées depuis Photos (même outil, mêmes colonnes, dont « UUID Photos »), mettre son chemin dans `photos` de `prive/config-import.json`, relancer. Les nouvelles fiches s'ajoutent, les autres ne bougent pas.

## Import complet du 24/11/2026 (référence)

Fait par Codex sur le Mac (clone `~/Documents/ChatGPT/MÉMOIRES MAMILI/phototheque-import`) : 1 494 fiches, toutes illustrées (355 Mo de versions web, 46 Mo de miniatures, plus gros fichier 0,7 Mo), 53 conflits, 92 noms sans correspondance, 168 images sans fiche (P1518 et suivantes, plus une image sans numéro), dont 6 photos imprimées dans le livre (P1518, P1519, P1536, P1546, P1558, P1616) ; second passage sans changement. L'étape 3 a été contournée en donnant le dossier du Drive à la main ; le script le reprend désormais de `prive/config-import.json` ou de `DRIVE=…`.

## À transmettre à la fin

Le dernier rapport (`prive/rapports/import-….md`) et les lignes de l'étape 8. Rien n'est publié tant que Samuel n'a pas décidé de mettre les photos dans l'espace famille.

## Message à donner à Codex

> Dans le clone local de memoires-familiales.github.io, fais `git pull`, puis lance `bash outils/import-complet-mac.command` et suis `docs/import-photos.md`. Si le script s'arrête, applique la solution qu'il affiche ; s'il te faut le réseau (installation de openpyxl et Pillow) ou l'accès à `~/Library/CloudStorage`, dis-moi la commande à lancer moi-même dans le Terminal. Ne modifie pas le code, n'ajoute rien de `prive/` à Git, ne lance pas `preparer_espace_famille.py`. À la fin, donne-moi les lignes de l'étape 8 et le chemin du rapport.

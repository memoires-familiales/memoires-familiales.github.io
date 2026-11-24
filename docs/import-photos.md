# Import complet de la photothèque : méthode

Méthode suivie par Claude le 24/11/2026 sur un essai de 30 photos, à reprendre telle quelle pour l'import complet (par Codex ou Claude). Elle se lance **sur le Mac de Samuel**, dans le clone local de ce dépôt. Les données produites restent dans `prive/`, que Git ignore : rien ne part sur GitHub.

## Les fichiers d'entrée (tous sur le Google Drive de Samuel, visibles sur le Mac)

Sur le Mac, le Drive est dans `~/Library/CloudStorage/GoogleDrive-<adresse>/Mon Drive/`.

| Rôle | Emplacement dans « Mon Drive » | Clé de `prive/config-import.json` |
|---|---|---|
| Images de l'album, exportées de Photos en JPEG (nom = titre, « P0001 - … .jpeg ») | `03 - MEMOIRES MAMILI/02 - Site internet/04 - Photothèque - espace famille/EXPORT ALBUM ANCIENNES PHOTOS/` | `images` |
| Métadonnées de Photos (UUID, titre, dates, lieux, personnes reconnues, albums…) | `08 - NUMÉRISATION PHOTOS/TABLEAU/Export_Photos_avec_miniatures_2026-09-30_22-11-12 - Album complet.xlsx` | `photos` |
| Tableau de travail (dates estimées, lieux, personnes, versos, chapitres) | `08 - NUMÉRISATION PHOTOS/TABLEAU/TABLEAU - PHOTOS ANCIENNES 3.xlsx` | `complements` |
| Référentiel des personnes | `08 - NUMÉRISATION PHOTOS/TABLEAU/REFERENTIEL - IDENTITES PERSONNES PHOTOS ANCIENNES.xlsx` | `referentiel` |

Ne jamais modifier ces fichiers : ce sont les originaux. Le script les lit seulement.

Le kit privé `phototheque-prive-essai-30-photos-2026-11-24.zip`, dans le dossier `04 - Photothèque - espace famille` du Drive, contient un dossier `prive/` prêt à l'emploi :
- `config-import.json`, avec les quatre chemins ci-dessus déjà renseignés pour ce Mac ;
- `alias-personnes.csv` : les correspondances de noms confirmées par Samuel (prioritaires sur le référentiel) ;
- le résultat de l'essai (`photos.js`, `photos.json`, `images/` pour 32 photos, `rapports/`), point de départ de l'import complet.

## Étapes

1. **Préparer le clone.** Dans le clone local du dépôt public, à jour (`git pull`), décompresser le kit pour obtenir `prive/` à la racine. Vérifier que Git l'ignore : `git check-ignore prive/photos.js` doit répondre `prive/photos.js`. Installer les modules si besoin : `python3 -m pip install --user openpyxl pillow`.
2. **Attendre la fin de l'export.** L'export depuis Photos remplit `EXPORT ALBUM ANCIENNES PHOTOS` petit à petit. Attendre que le nombre de fichiers ne bouge plus (`ls "<dossier>" | wc -l`). Les fichiers qui ne sont que dans le nuage sont téléchargés automatiquement à la lecture sur le Mac ; « Disponible hors connexion » sur le dossier accélère le traitement.
3. **Simulation.** `python3 outils/importer_photos.py --simulation`, puis lire le rapport dans `prive/rapports/`. Rien n'est modifié.
4. **Import.** `python3 outils/importer_photos.py` (ou double-clic sur `outils/mettre-a-jour-phototheque.command`, qui ouvre ensuite la photothèque et le rapport). Pour chaque photo, le script retrouve l'image par son UUID, son nom ou son numéro (P0001…), fabrique une miniature et une version web de 1 600 px dans `prive/images/`, et écrit `prive/photos.js`. Compter quelques minutes pour environ 1 500 photos.
5. **Contrôles.**
   - Relancer la même commande : elle doit répondre « Aucun changement depuis le dernier import. » (import idempotent).
   - Dans le rapport, la ligne « Images » donne le nombre de photos sans image et d'images du dossier sans fiche ; les deux listes suivent.
   - Ouvrir `phototheque/index.html` dans le navigateur : vignettes, fiche agrandie (image web), filtres par chapitre, personnes, lieux.
6. **Transmettre** à Samuel (et à Claude pour les finitions) : le dernier rapport et ce qui reste à trancher.

## Ce qu'il ne faut pas faire

- Ne jamais ajouter `prive/` (ou une image, un nom, un export) au dépôt public, ni forcer Git à le suivre.
- Ne pas lancer `outils/preparer_espace_famille.py` : la publication des photos dans l'espace famille est une décision de Samuel, réalisée ensuite depuis le poste qui a toute la voix (le script refuse de toute façon de vider une rubrique déjà en ligne sans `--vider`).
- Ne pas éditer `prive/photos.js` à la main : corriger dans Photos, le tableau, le référentiel ou `prive/alias-personnes.csv`, puis relancer l'import.
- Ne pas inventer de fiche pour une image sans métadonnées (voir ci-dessous).

## Photos ajoutées après l'export des métadonnées

L'export des métadonnées date du 30/09/2026 : 1 494 photos, numérotées de P0001 à P1517. L'album exporté le 24/11 va jusqu'à P1753 : les images plus récentes n'ont pas encore de fiche. Le rapport les liste sous « Images du dossier sans fiche dans l'export ». Pour les ajouter, refaire l'export des métadonnées depuis Photos (même outil, mêmes colonnes, dont « UUID Photos »), mettre son chemin dans `photos` de `config-import.json` et relancer l'import : les nouvelles fiches s'ajoutent, les autres ne bougent pas.

## Résultat de l'essai du 24/11/2026 (référence)

30 photos imprimées dans le livre, plus deux de test : 1 494 fiches, 32 illustrées, 53 conflits entre Photos et le tableau, 92 noms sans correspondance ; second passage : aucun changement. Fiche vérifiée : P0001, chapitre 37, image web de 1 600 px.

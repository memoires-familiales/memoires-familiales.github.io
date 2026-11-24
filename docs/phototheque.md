# Photothèque : import des photos et modèle de données

## Le principe

```
Apple Photos ──export──▶ tableau des photos (XLSX/CSV ou JSON OSXPhotos)
                         + tableau de travail « PHOTOS ANCIENNES »   ──▶ outils/importer_photos.py ──▶ prive/
                         + référentiel des identités                                                   │
                         + photos exportées en JPEG                                                    ▼
                                                                         phototheque/index.html (en local)
```

- **Apple Photos** reste l'endroit où l'on identifie les visages, les dates et les lieux.
- Chaque photo est reconnue par son **identifiant Apple Photos (UUID)**. Le numéro `P0001` sert à la rattacher au tableau de travail.
- Le script n'écrit que dans `prive/`, jamais dans les fichiers sources.

## 1. Installer (une fois)

Sur le Mac, dans le Terminal :

```bash
pip3 install openpyxl pillow
```

## 2. Exporter depuis Apple Photos

**Les métadonnées.** Deux possibilités, le script reconnaît les deux :

- le tableau déjà utilisé (`Export_Photos_avec_miniatures… - Album complet.xlsx`, colonnes « UUID Photos », « Titre Photos », « Personnes reconnues »…) ;
- ou un export OSXPhotos : `osxphotos query --album "ANCIENNES PHOTOS SCANEES" --json > export-photos.json`.

**Les images.** Les scans numérotés sont déjà sur le Drive, dans « 08 - NUMÉRISATION PHOTOS / CHRONO PHOTO » (« P1616 - 1959_01_01 - France - … .jpg ») : avec Google Drive pour ordinateur, il suffit de donner ce dossier dans `images` (`config-import.json`) ; le script retrouve chaque image par son numéro, y compris les fichiers sans extension, et fabrique les miniatures et les versions web (1 600 px). Sinon, exporter depuis Photos : sélectionner l'album, *Fichier → Exporter → Exporter les photos*, format JPEG, nom de fichier « Titre ». Les titres commençant par un numéro (`P0001`…), le script retrouve chaque image. Avec OSXPhotos : `osxphotos export ~/Exports/photos-jpeg --album "ANCIENNES PHOTOS SCANEES" --filename "{uuid}" --convert-to-jpeg` (les options d'OSXPhotos évoluent : vérifier avec `osxphotos help export`).

## 3. Lancer l'import

**Le plus simple : double-cliquer sur `outils/mettre-a-jour-phototheque.command`.** Au premier lancement, il installe les modules nécessaires et crée `prive/config-import.json` : y indiquer l'emplacement des fichiers, puis relancer. Ensuite, chaque double-clic refait l'import, ouvre la photothèque et le rapport. (Si macOS bloque le fichier la première fois : clic droit → Ouvrir.)

```json
{
  "photos": "~/Documents/Mamili/Export_Photos - Album complet.xlsx",
  "complements": "~/Documents/Mamili/TABLEAU - PHOTOS ANCIENNES 3.xlsx",
  "referentiel": ["~/Documents/Mamili/REFERENTIEL - IDENTITES PERSONNES PHOTOS ANCIENNES.xlsx"],
  "images": "~/Documents/Mamili/photos-jpeg"
}
```

**Ou dans le Terminal**, depuis le dossier du site, avec les chemins en arguments (ils priment sur le fichier de réglages) :

```bash
python3 outils/importer_photos.py \
  --photos ~/Exports/"Export_Photos - Album complet.xlsx" \
  --complements ~/Exports/"TABLEAU - PHOTOS ANCIENNES 3.xlsx" \
  --referentiel ~/Exports/"REFERENTIEL - IDENTITES PERSONNES PHOTOS ANCIENNES.xlsx" \
  --images ~/Exports/photos-jpeg
```

Puis ouvrir `phototheque/index.html` (double-clic) : la page affiche la photothèque complète, avec un avis rappelant qu'elle vient du dossier `prive`.

Options utiles :

| Option | Effet |
|---|---|
| `--simulation` | calcule tout et écrit le rapport, sans toucher aux données |
| `--restaurer prive/historique/photos-….json` | revient à une version précédente |
| `--supprimer-absentes` | supprime les photos qui ne sont plus dans l'export (par défaut, elles sont gardées et masquées) |
| `--forcer-images` | refait toutes les miniatures |
| `--seuil-date 2000` | au-delà de cette année, une date de Photos sans autre indice est traitée comme une date de numérisation |
| `--format-date mja` | si les dates du tableau sont écrites en texte au format mois/jour/année |

## 4. Ce que produit l'import

```
prive/photos.json          les fiches (format de référence, lisible)
prive/photos.js            les mêmes fiches, chargées par la page
prive/images/miniatures/   480 px, sans métadonnées EXIF
prive/images/web/          1 600 px, sans métadonnées EXIF
prive/historique/          la version précédente à chaque import qui change quelque chose
prive/rapports/            import-<date>.md, conflits-<date>.csv, noms-sans-correspondance.csv,
                           correspondance-noms.csv
prive/config-import.json   l'emplacement des fichiers sources
prive/alias-personnes.csv  (facultatif) vos propres correspondances de noms
```

**Relancer l'import avec les mêmes fichiers ne change rien** (« Aucun changement depuis le dernier import »). Quand l'export évolue, le rapport liste les photos ajoutées, modifiées (avec les champs touchés) et retirées.

## 5. Lire le rapport

- **Conflits** : Photos et le tableau ne disent pas la même chose (par exemple une photo située à Oran dans Photos et à Mostaganem dans le tableau). Le tableau l'emporte à l'affichage ; il reste à corriger la source fautive.
- **Noms à rapprocher** : noms reconnus par Photos qui ne figurent pas dans le référentiel (un surnom, une orthographe différente…). Pour les rattacher : ouvrir `prive/rapports/noms-sans-correspondance.csv`, remplir la colonne « remplacement » (ex. `Toinette Ferrer` → `Antoinette FERRER (Mamie Toinette)`), enregistrer sous `prive/alias-personnes.csv`, relancer. Les surnoms que le référentiel classe « à vérifier » (Mamie, Maman, Mémé, Pépé…) ne sont jamais remplacés automatiquement ; une ligne écrite dans `prive/alias-personnes.csv` l'emporte toujours.
- **Renommer les personnes dans Photos** : `correspondance-noms.csv` liste chaque nom tel qu'il est écrit dans Photos, le nombre de photos, le nom retenu sur le site et l'origine de la correspondance (référentiel, `alias-personnes.csv` ou aucune). C'est la liste de travail pour donner aux personnes leur nom officiel dans Photos ; une fois renommées, les lignes d'alias correspondantes deviennent inutiles.

## 6. Règles de fusion

| Information | Ordre de priorité |
|---|---|
| Date | tableau (date + date estimée) → date écrite dans le titre (`P0123 - 1941_08_21 - Oran`) → date de Photos si antérieure au seuil → « Date inconnue » |
| Précision de la date | jour, mois, année ou inconnue ; « Pâques 1932 », « Noël 1940 ? » sont gardés tels quels ; « ? », « vers », « années » → date approximative |
| Lieu | tableau → Photos ; les coordonnées GPS ne sont gardées que si les deux sources s'accordent |
| Personnes | visages nommés dans Photos + noms du tableau reconnus par le référentiel, sans doublons ; les autres mentions du tableau (« son mari », « une cousine ? ») restent en texte |
| Visages non identifiés | nombre de visages `_UNKNOWN_` dans Photos |
| Chapitre | le livre (`livre.json` du dossier de sortie, sinon `prive/livre.json` : photos imprimées dans chaque chapitre) → tableau |
| Événement, type, notes du verso, provenance, statut | tableau |
| Photo absente de l'export de Photos | fiche provisoire `sans-export-P…` : tableau de travail (même numéro) et nom de fichier ; remplacée par la vraie fiche dès qu'un export de Photos la contient |
| Légende, mots-clés, albums, favori | Photos (mots-clés complétés par le tableau) |

Les photos masquées dans Photos ne sont jamais importées.

## 7. Modèle de données (`prive/photos.json`)

```json
{
  "modele": 1,
  "mode": "prive",
  "genere_le": "2026-11-24T10:00:00",
  "photos": [
    {
      "id": "1F2E3D4C-0000-4000-8000-000000000001",
      "numero": "P0123",
      "titre": "P0123 - 1932_04 - Mostaganem",
      "fichier": "P0123 - 1932_04 - Mostaganem.jpg",
      "date": { "tri": "1932-04-17", "annee": 1932, "precision": "jour",
                "libelle": "Pâques 1932", "approximative": false, "source": "tableau" },
      "lieu": { "pays": "Algérie", "ville": "Mostaganem", "precis": "La ferme",
                "lat": 35.93, "lon": 0.09, "source": "tableau" },
      "personnes": ["Antoinette FERRER (Mamie Toinette)", "Rose SOLER"],
      "inconnus": 3,
      "autres_mentions": "son mari",
      "legende": "",
      "evenement": "Pâques à la ferme",
      "type": "Photo de famille (groupe)",
      "notes": "Au dos : « Pâques chez l'oncle »",
      "chapitre": "Chapitre 2. L'enfance",
      "mots_cles": ["Repas"], "albums": ["Photos anciennes"],
      "provenance": "Boîte de photos",
      "statut": "À compléter",
      "favori": false,
      "a_identifier": true,
      "images": { "miniature": "prive/images/miniatures/<id>.jpg", "web": "prive/images/web/<id>.jpg" },
      "sources": ["photos", "tableau"],
      "ajoutee_le": "2026-11-24", "modifiee_le": "2026-11-24",
      "retiree": false
    }
  ]
}
```

Les champs vides sont omis dans le fichier. Le jeu d'exemple (`data/demo/photos.json`) suit le même modèle.

## 8. Pour la suite

- **Contributions de la famille** (identifications, corrections) : à stocker dans un fichier ou une base séparés, reliés par `id`, jamais écrits par l'import.
- **Arbre généalogique** : donner à chaque personne un identifiant permanent ; `personnes` contiendra alors des identifiants plutôt que des noms.
- **Accès familial en ligne** : servir `photos.js` et les images depuis un stockage privé avec contrôle d'accès, au lieu de `prive/`. Seules les deux balises `<script>` de `phototheque/index.html` et les chemins `images` sont à changer.

## Proposer une correction depuis une photo

Dans la fiche d'une photo, « Proposer une correction » ouvre une fenêtre par-dessus la fiche (`assets/js/correction-photo.js`) : on ne quitte pas la photo. La personne choisit ce qu'elle corrige ou complète :

- **date** (texte libre : « été 1958 », « vers 1950 ») ;
- **lieu** et **événement**, avec les suggestions déjà présentes dans la photothèque ;
- **personnes** : toucher un nom mal reconnu pour dire qui c'est à la place (ou « je ne sais pas qui c'est » pour le retirer), et « Ajouter une personne » avec sa place sur la photo. Les noms se complètent dès les premières lettres, écrits comme dans la photothèque (chaque mot tapé doit commencer un mot du nom : « jo luq ») ; un nom absent reste possible et est signalé comme tel ;
- une remarque libre, sa certitude et son nom (obligatoire, mémorisé sur l'appareil). Dans l'espace famille, l'adresse de connexion Cloudflare Access est jointe quand elle existe (`/cdn-cgi/access/get-identity`) ; un accès autorisé par adresse IP n'en a pas, d'où le nom demandé à chaque fois.

**Dans l'espace famille, la proposition est enregistrée dans la base des corrections** (voir `docs/espace-famille.md`) : elle apparaît aussitôt sous la photo (« Propositions de la famille », avec « Je confirme » / « Je ne pense pas ») et sur la page `participer/corrections.html` (filtre « à confirmer », statut, export CSV/JSON). Si la base n'est pas reliée ou ne répond pas, l'envoi part par e-mail à Samuel avec le formulaire classique de FormSubmit, soumis dans un cadre caché (pas de nouvel onglet). FormSubmit renvoie vers `participer/merci.html` du site public, qui, chargée dans ce cadre, prévient la page par un message (`postMessage`, type `memoires-envoi-confirme`, origine vérifiée) : la fenêtre affiche alors « Merci ». Sans confirmation au bout de 45 s, elle propose de réessayer, la messagerie de la personne (e-mail prérempli) ou le texte à copier. L'adresse est réglée une seule fois dans `SITE.contributions` de `assets/js/site.js`. Le point d'envoi `ajax/` restait sans réponse depuis le navigateur de Samuel le 24/11, et l'envoi dans un nouvel onglet laissait des onglets vides quand FormSubmit tardait. FormSubmit active chaque site séparément : `espace-famille.pages.dev` a été activé par Samuel le 24/11 au soir. L'e-mail contient un tableau lisible (« Date : avant → proposée », « Personnes mal reconnues : X → Y »…) et la même chose en JSON dans « Données pour la mise à jour » (`version`, `photo` {numero, id}, `actuel`, `propose` {date, lieu, evenement, remplacer [{avant, apres, nouveau}], retirer, ajouter [{nom, position, nouveau}], remarque}, `certitude`, `auteur`). 
Les corrections se reportent ensuite dans Photos, le tableau de travail ou `prive/alias-personnes.csv`, puis on relance l'import.


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

**Les images.** Dans Photos : sélectionner l'album, *Fichier → Exporter → Exporter les photos*, format JPEG, nom de fichier « Titre ». Les titres commençant par un numéro (`P0001`…), le script retrouve chaque image. Avec OSXPhotos : `osxphotos export ~/Exports/photos-jpeg --album "ANCIENNES PHOTOS SCANEES" --filename "{uuid}" --convert-to-jpeg` (les options d'OSXPhotos évoluent : vérifier avec `osxphotos help export`).

## 3. Lancer l'import

Depuis le dossier du site :

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
prive/rapports/            import-<date>.md, conflits-<date>.csv, noms-sans-correspondance.csv
prive/alias-personnes.csv  (facultatif, à créer) vos propres correspondances de noms
```

**Relancer l'import avec les mêmes fichiers ne change rien** (« Aucun changement depuis le dernier import »). Quand l'export évolue, le rapport liste les photos ajoutées, modifiées (avec les champs touchés) et retirées.

## 5. Lire le rapport

- **Conflits** : Photos et le tableau ne disent pas la même chose (par exemple une photo située à Oran dans Photos et à Mostaganem dans le tableau). Le tableau l'emporte à l'affichage ; il reste à corriger la source fautive.
- **Noms à rapprocher** : noms reconnus par Photos qui ne figurent pas dans le référentiel (un surnom, une orthographe différente…). Pour les rattacher : ouvrir `prive/rapports/noms-sans-correspondance.csv`, remplir la colonne « remplacement » (ex. `Toinette Ferrer` → `Antoinette FERRER (Mamie Toinette)`), enregistrer sous `prive/alias-personnes.csv`, relancer. Les surnoms que le référentiel classe « à vérifier » (Mamie, Maman, Mémé, Pépé…) ne sont jamais remplacés automatiquement.

## 6. Règles de fusion

| Information | Ordre de priorité |
|---|---|
| Date | tableau (date + date estimée) → date écrite dans le titre (`P0123 - 1941_08_21 - Oran`) → date de Photos si antérieure au seuil → « Date inconnue » |
| Précision de la date | jour, mois, année ou inconnue ; « Pâques 1932 », « Noël 1940 ? » sont gardés tels quels ; « ? », « vers », « années » → date approximative |
| Lieu | tableau → Photos ; les coordonnées GPS ne sont gardées que si les deux sources s'accordent |
| Personnes | visages nommés dans Photos + noms du tableau reconnus par le référentiel, sans doublons ; les autres mentions du tableau (« son mari », « une cousine ? ») restent en texte |
| Visages non identifiés | nombre de visages `_UNKNOWN_` dans Photos |
| Événement, type, notes du verso, chapitre, provenance, statut | tableau |
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

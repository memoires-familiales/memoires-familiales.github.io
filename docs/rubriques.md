# Rubriques : structure des pages et format des données

Chaque rubrique suit le même principe que la photothèque :

- la page charge d'abord le **jeu d'exemple fictif** (`data/demo/<rubrique>.js`), publié en ligne ;
- puis, s'il existe sur l'ordinateur, le **fichier privé** (`prive/<rubrique>.js`), qui le remplace. Ce dossier n'est jamais publié ;
- un avis en haut de page dit lequel des deux est affiché.

Un fichier de données est un script d'une ligne qui définit une variable globale :

```js
window.ARBRE = { "modele": 1, "mode": "prive", "personnes": [ … ] };
```

`mode` vaut `"demo"` pour les exemples, `"prive"` pour les données de la famille gardées sur l'ordinateur et `"public"` pour les données réelles que la famille a choisi de publier (le sommaire du livre). Les pages ne croisent que des données de même nature : réelles avec réelles (publiques ou privées), exemples avec exemples.

Le jeu d'exemple se régénère avec `python3 outils/creer_demo_rubriques.py`. Le plus simple pour créer un fichier privé est de partir du `.json` d'exemple correspondant, de le remplir, puis de l'envelopper dans `window.<VARIABLE> = …;`.

| Rubrique | Page | Variable | Fichier privé |
|---|---|---|---|
| Le livre | `livre/` | `window.LIVRE` | `data/livre.js` (publié) ou `prive/livre.js` |
| L'arbre | `arbre/` | `window.ARBRE` | `prive/arbre.js` |
| La voix de Mamili | `voix/` | `window.VOIX` | `prive/voix.js`, produit par `outils/catalogue_voix.py` |
| Les archives | `archives/` | `window.ARCHIVES` | `prive/archives.js` |
| Les films | `films/` | `window.FILMS` | `prive/films.js` |
| Participer | `participer/` | — | — (rien n'est enregistré) |

Liens entre rubriques : un chapitre est toujours désigné par son **numéro** (`chapitre-12`), une personne par son **appellation dans la photothèque** (`Antoinette Ferrer (Mamie Toinette)`).

## Le livre — `window.LIVRE`

**Le sommaire réel est publié sur le site**, à la demande de Samuel (24 novembre 2026) : `data/livre.js` et `data/livre.json`, en mode `"public"`. La page charge, dans l'ordre, l'exemple (`data/demo/livre.js`), le sommaire publié (`data/livre.js`), puis une éventuelle version privée (`prive/livre.js`), la dernière présente l'emportant.

Il est produit par `outils/extraire_sommaire.py` à partir du texte du manuscrit (titres `#` pour les parties, `##` pour les chapitres, ligne de dates sous chaque titre, numéros des photos imprimées dans chaque chapitre) :

```bash
python3 outils/extraire_sommaire.py manuscrit.txt --public --sans-annexes \
  --titre "Les Mémoires de Mamili" --sous-titre "Rosalie Luque, 1923 – 2018" \
  --pages-imprimees sommaire-pdf.txt
```

`sommaire-pdf.txt` est le sommaire copié depuis le PDF du livre imprimé, une entrée par ligne (« Titre……… 123 »). Le script reprend les pages dans l'ordre (prologue, puis chaque partie suivie de ses chapitres), recolle les titres coupés sur deux lignes, ignore les folios « — 6 — » et signale tout titre qui diffère de celui du manuscrit.

```json
{
  "mode": "public",
  "titre": "…", "sous_titre": "…",
  "liminaires": [{ "titre": "Prologue" }],
  "parties": [
    { "numero": 1, "titre": "…", "annees": "1895 – 1922",
      "chapitres": [{ "numero": 1, "titre": "…", "annees": "1895 – 1922", "photos": ["P0123"], "page": 13 }] }
  ],
  "annexes": []
}
```

- Les chapitres sont numérotés à la suite d'un bout à l'autre du livre, comme dans l'édition imprimée.
- `photos` liste les photos imprimées dans le chapitre. L'import de la photothèque s'en sert pour donner à chaque photo son chapitre (le livre l'emporte sur la colonne « chapitre » du tableau).
- `page` est la page du livre imprimé, reprise du sommaire du PDF final (option `--pages-imprimees`), pour le prologue, les parties et les chapitres. Sans `page`, la ligne affiche les années à droite.
- Sur le site en ligne, chaque chapitre indique « N photos dans le livre » ; sur l'ordinateur où la photothèque privée est présente, c'est un lien vers ces photos.

## L'arbre — `window.ARBRE`

```json
{
  "racine": "antoinette-ferrer",
  "personnes": [
    {
      "id": "antoinette-ferrer",
      "prenoms": "Antoinette", "nom": "Soler", "nom_usage": "Ferrer", "surnom": "Mamie Toinette", "sexe": "F",
      "naissance": { "date": "12 mars 1923", "lieu": "Oran, Algérie" },
      "deces": { "date": "2015", "lieu": "Perpignan, France" },
      "vivant": false,
      "parents": ["marcel-soler", "rose-soler"],
      "conjoints": ["joseph-ferrer"],
      "photos": ["Antoinette Ferrer (Mamie Toinette)"],
      "bio": "…",
      "sources": ["Livret de famille"],
      "certitude": "confirmé"
    }
  ]
}
```

- `id` est permanent : ne jamais le changer une fois utilisé.
- Les enfants, les frères et sœurs se déduisent des `parents` ; il suffit d'écrire chaque lien une fois.
- `vivant: true` masque les dates de la personne.
- `photos` contient l'appellation utilisée dans la photothèque, pour le lien « Voir ses photos ».
- `certitude` : `confirmé` (un document le prouve) ou `à vérifier`. Le référentiel des identités (`REFERENTIEL - IDENTITES PERSONNES PHOTOS ANCIENNES.xlsx`) et la feuille « Noms arbre généalogique » du tableau des photos sont les points de départ naturels.

## La voix de Mamili — `window.VOIX`

Les vraies données ne s'écrivent pas à la main : elles sont produites par `outils/catalogue_voix.py` à partir du **catalogue privé** (`prive/voix/`, jamais dans ce dépôt) :

```
prive/voix/catalogue.csv        une ligne par extrait (séparateur « ; », s'ouvre dans un tableur)
prive/voix/enregistrements.csv  une ligne par enregistrement original (A01, A02…)
prive/voix/transcriptions/      une transcription par extrait : <id>.txt
prive/audio/                    les MP3, sous le nom exact de la colonne « fichier »
```

```bash
python3 outils/catalogue_voix.py              # contrôle le catalogue et écrit prive/voix.js
python3 outils/catalogue_voix.py --verifier   # contrôle seulement
python3 outils/catalogue_voix.py --index Index_enregistrements_audio.docx              # compare avec l'index Word
python3 outils/catalogue_voix.py --index Index_enregistrements_audio.docx --appliquer  # et reporte les changements
```

- **Le numéro de chapitre est la clé** : `0` pour le prologue, `1` à `108`, vide pour un témoignage hors livre. Le titre du chapitre n'est jamais saisi : il vient de `data/livre.json`, comme les pages du livre imprimé. Les pages de l'index Word ne sont pas reprises (elles suivent une autre pagination).
- `type` : `livre` (la scène est dans le livre), `complément` (détail ou rapprochement oral), `version à vérifier` (divergence à garder), `hors livre`. On ne transforme pas un complément en concordance certaine.
- `statut` : `monté` ou `exclu` (avec `motif_exclusion`). Les extraits exclus restent dans le catalogue pour la traçabilité mais ne s'affichent pas.
- `coupes` : les portions conservées dans l'original, séparées par « + ». `note_montage` signale une retouche (raccourci…) ; ces extraits ne sont jamais modifiés par la reprise de l'index.
- `personnes`, `lieux`, `divergences` : valeurs séparées par « | ».
- Contrôles : identifiants, fichiers et identifiants Drive uniques ; chapitre présent dans le sommaire et cohérent avec le type ; coupes lisibles ; enregistrement connu ; transcription et résumé présents ; MP3 présent, décodable, de durée conforme (± 1,5 s), sans doublon, sous 25 Mio ; MP3 non référencés. Rapport : `prive/voix/rapport-controles.md`. En cas d'erreur, `prive/voix.js` n'est pas modifié. Deux lancements identiques donnent le même fichier.
- La reprise de l'index se fait par l'identifiant Drive du MP3 : nouveaux extraits ajoutés (type, fichier, résumé et transcription à compléter), titres, chapitres et coupes changés listés, extraits disparus signalés sans être supprimés.

Format produit (modèle 2) :

```json
{
  "modele": 2, "mode": "prive",
  "extraits": [
    {
      "id": "audio-006", "titre": "…",
      "chapitre": { "numero": 1, "titre": "titre repris du sommaire" },
      "type": "livre",
      "enregistrement": { "code": "A13", "titre": "…", "fichier": "….m4a", "par": "…", "drive_id": "…", "transcription": "…", "note": "…" },
      "coupes": ["00:29,55–03:28,08"], "debut": "00:29,55", "fin": "03:28,08", "duree": "2:59",
      "fichier": "Chapitre_001_….mp3", "drive_id": "…",
      "resume": "…", "transcription": "Mamili : …\nCathy : …", "note_transcription": "…",
      "personnes": ["…"], "lieux": ["…"], "divergences": ["…"], "notes": "…", "note_montage": "…",
      "statut": "monté",
      "audio": "prive/audio/Chapitre_001_….mp3"
    }
  ],
  "exclusions": [{ "id": "…", "titre": "…", "source": "A21", "motif": "…" }]
}
```

La page range les extraits dans l'ordre du livre (prologue, chapitres, puis « Témoignages hors livre »), affiche la page imprimée de chaque chapitre, un filtre par type et par enregistrement, la recherche dans les titres, résumés, transcriptions et personnes, l'écart avec le livre, et un volet « D'où vient cet extrait » (enregistrement, fichier original, passage retenu, transcription d'origine, liens Drive). Sans `audio`, elle affiche « Fichier audio en cours de transfert ». Le sommaire du livre renvoie vers les extraits de chaque chapitre, du prologue et des témoignages hors livre. L'ancien format (modèle 1, sans `type` ni `coupes`) reste lisible.

On garde toujours trois choses distinctes : l'original intact, le montage de consultation (`audio`) et la transcription.

## Les archives — `window.ARCHIVES`

```json
{
  "types": { "acte": "Actes d'état civil", "lettre": "Lettres", "papier": "Papiers de famille",
             "article": "Articles de presse", "carte": "Cartes et plans" },
  "documents": [
    {
      "id": "…", "type": "acte", "titre": "…",
      "date": { "libelle": "11 mai 1946", "annee": 1946 }, "lieu": "…",
      "personnes": ["…"], "chapitre": { "numero": 5, "titre": "…" },
      "source": "…", "description": "…", "droits": "Usage familial",
      "apercu": "prive/archives/apercus/….jpg", "fichier": "prive/archives/….pdf"
    }
  ]
}
```

`droits` rappelle ce qui peut être montré (un article de presse n'appartient pas à la famille).

## Les films — `window.FILMS`

```json
{
  "films": [
    {
      "id": "…", "titre": "…", "date": { "libelle": "été 1956", "annee": 1956 }, "lieu": "…",
      "support": "Super 8", "duree": "3 min 40", "statut": "à numériser | numérisé",
      "description": "…",
      "sequences": [{ "debut": "0:00", "titre": "…" }],
      "personnes": ["…"], "chapitre": { "numero": 7, "titre": "…" },
      "fichier": "prive/films/….mp4"
    }
  ]
}
```

Format de consultation conseillé : MP4 (H.264/AAC). Quand `fichier` est présent, cliquer sur une séquence place la lecture à son début.

## Participer

Le formulaire envoie la contribution **par e-mail à Samuel**, avec ses pièces jointes, grâce à FormSubmit (service gratuit, sans compte, qui relaie le formulaire vers une adresse e-mail et ne conserve pas les fichiers).

- Types proposés : mettre un nom sur un visage, corriger une date ou un lieu, raconter un souvenir, envoyer des photos, envoyer un document.
- Champs : photo ou document concerné (pré-rempli par le lien « Proposer une correction » de chaque photo : `participer/index.html?photo=P0123`), message, degré de certitude, prénom et nom, **e-mail ou téléphone** (au moins l'un des deux).
- Pièces jointes : jusqu'à 10 fichiers (photos ou PDF), **10 Mo au total** (limite de FormSubmit). Les photos de plus de 2,5 Mo sont réduites à 3 000 pixels de côté (JPEG) dans le navigateur avant l'envoi ; chaque fichier part dans son propre champ.
- Après l'envoi : retour direct sur `participer/merci.html`. La vérification anti-robot de FormSubmit (reCAPTCHA) est **désactivée** (`<input type="hidden" name="_captcha" value="false">` dans `participer/index.html`), à la demande de Samuel, le lien circulant peu. Le champ piège `_honey` reste en place. En cas de messages indésirables ou d'envois perdus, supprimer cette ligne pour réactiver la vérification.
- Repli : « Préférer copier le message » prépare le texte à envoyer soi-même (sans les fichiers).
- Les coordonnées saisies sont gardées sur l'appareil de la personne (stockage local du navigateur) pour la prochaine fois ; rien n'est enregistré sur le site.

**Réglages** (en tête de `assets/js/participer.js`, objet `ENVOI`) : l'adresse de destination, la limite de taille, le seuil de réduction des photos.

**Mise en service (une fois)** : au tout premier envoi, FormSubmit écrit à l'adresse de destination pour demander une confirmation. Il faut cliquer sur le lien d'activation ; les messages arrivent ensuite directement. FormSubmit fournit alors une chaîne aléatoire : la mettre à la place de l'adresse dans `ENVOI.destinataire` masque l'adresse e-mail dans le code du site.

Les contributions en ligne avec comptes et modération viendront plus tard ; elles seront stockées à part des imports.

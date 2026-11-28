# Rubriques : structure des pages et format des données

Sur le site public, chaque rubrique présente son contenu et renvoie vers l’espace famille. En local :

- la page ouverte depuis le disque charge d'abord le **jeu d'exemple fictif** (`data/demo/<rubrique>.js`), généré localement ;
- puis, s'il existe sur l'ordinateur, le **fichier privé** (`prive/<rubrique>.js`), qui le remplace. Ce dossier n’est publié que dans l’espace famille protégé ;
- un avis en haut de page dit lequel des deux est affiché.

Un fichier de données est un script d'une ligne qui définit une variable globale :

```js
window.ARBRE = { "modele": 1, "mode": "prive", "personnes": [ … ] };
```

`mode` vaut `"demo"` pour les exemples, `"prive"` pour les données réelles de la famille, consultables dans l’espace protégé. Le mode historique `"public"` est encore lu comme un jeu réel pour assurer la compatibilité avec l’ancien sommaire dans l’espace famille.

Le jeu d'exemple se régénère avec `python3 outils/creer_demo_rubriques.py`. Le plus simple pour créer un fichier privé est de partir du `.json` d'exemple correspondant, de le remplir, puis de l'envelopper dans `window.<VARIABLE> = …;`.

| Rubrique | Page | Variable | Fichier privé |
|---|---|---|---|
| Le livre | `livre/` | `window.LIVRE` | `prive/livre.js` |
| L'arbre | `arbre/` | `window.ARBRE` | `prive/arbre.js` |
| La voix de Mamili | `voix/` | `window.VOIX` | `prive/voix.js`, produit par `outils/catalogue_voix.py` |
| Les archives | `archives/` | `window.ARCHIVES` | `prive/archives.js` |
| Les films | `films/` | `window.FILMS` | `prive/films.js` |
| Participer | `participer/` | — | — (rien n'est enregistré) |

Liens entre rubriques : un chapitre est toujours désigné par son **numéro** (`chapitre-12`), une personne par son **appellation dans la photothèque** (`Antoinette Ferrer (Mamie Toinette)`).

## Le livre — `window.LIVRE`

Le sommaire est chargé uniquement dans l’espace famille ou en local depuis `prive/livre.js`.

Il est produit par `outils/extraire_sommaire.py` à partir du texte du manuscrit (titres `#` pour les parties, `##` pour les chapitres, ligne de dates sous chaque titre, numéros des photos imprimées dans chaque chapitre) :

```bash
python3 outils/extraire_sommaire.py manuscrit.txt --sans-annexes \
  --titre "Les Mémoires de Mamili" --sous-titre "Rosalie Luque, 1923 – 2018" \
  --pages-imprimees sommaire-pdf.txt
```

`sommaire-pdf.txt` est le sommaire copié depuis le PDF du livre imprimé, une entrée par ligne (« Titre……… 123 »). Le script reprend les pages dans l'ordre (prologue, puis chaque partie suivie de ses chapitres), recolle les titres coupés sur deux lignes et ignore les folios « — 6 — ». Le livre imprimé fait référence : un titre qui diffère de celui du manuscrit est remplacé par le titre imprimé, et le changement est affiché (c'est le cas de la partie 9, « La famille », décision de Samuel du 24/11/2026). Un titre très différent laisse penser à un décalage : il est seulement signalé.

```json
{
  "mode": "prive",
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

- **Le numéro de chapitre est la clé** : `0` pour le prologue, `1` à `108`, vide pour un témoignage hors livre. Le titre du chapitre n'est jamais saisi : il vient de `prive/livre.json`, comme les pages du livre imprimé. Les pages de l'index Word ne sont pas reprises. Version de référence de l'index (décision du 24/11/2026) : celle qui cite les pages du livre imprimé, « Index_enregistrements_audio_Memoires_Mamili - référence (pages du livre imprimé).docx » ; la version d'origine citait les pages du PDF du 22/11 (2 à 12 pages d'écart) et reste sur le Drive sans modification. C'est la version de référence qu'on complète et qu'on passe à `--index`.
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

## Recherche générale

Le bandeau des pages privées ouvre `recherche/index.html`. La page cherche dans les catalogues déjà consultables par toute la famille : sommaire du livre, photos, extraits transcrits, arbre, recettes, archives et films. Elle écarte les photos retirées, les audios exclus et les dates masquées par l’arbre. Les termes sont traités dans le navigateur et conservés dans le fragment de l’adresse, après `#`, pour revenir à la recherche. Les résultats ouvrent la fiche, le chapitre, la transcription ou le film correspondant.

La recherche rapproche les accents, les variantes courantes de pluriels et les noms de l’arbre lorsque le nom de naissance, le nom d’usage ou le surnom identifient une seule fiche. En l’absence de résultat, elle essaie aussi les orthographes proches. Les fiches de l’arbre et leurs appellations photographiques alimentent le référentiel commun. Le fichier privé facultatif `prive/identites.js` définit `window.NOMS_FAMILLE`. Les clés sont les identifiants de l’arbre. Chaque entrée peut définir un `nom` d’affichage et une liste `alias` de variantes confirmées. La recherche générale, la photothèque, l’arbre et les recettes utilisent ce référentiel. Le classeur d’identités et les alias utilisés par l’import restent les sources des données photographiques. Un groupe de synonymes supplémentaire (p. ex. anciennes appellations de lieux) peut être fourni en JSON.

Pour ajouter le texte intégral, partir du PDF définitif approuvé pour l’espace famille. Placer une copie dans `prive/livre.pdf` et extraire son texte en conservant les séparateurs de pages. Le fichier `prive/recherche-complements.js` qui en résulte reste privé :

```bash
pdftotext -enc UTF-8 prive/livre.pdf prive/livre-pages.txt
python3 outils/indexer_livre.py prive/livre-pages.txt
```

Le résultat ouvre la bonne page du PDF. Si les folios imprimés suivent un décalage constant **vérifié**, `--decalage D` indique `folio imprimé − numéro de page PDF`. L’option `--alias prive/alias-recherche.json` ajoute les groupes de synonymes. Elle peut aussi être utilisée seule, sans texte de PDF. Vérifier les limites Cloudflare Pages avant d’ajouter le PDF.

La recherche porte sur les catalogues du tronc commun. Les corrections, enquêtes et futurs contenus réservés à certains groupes nécessiteront un filtrage côté serveur avant de pouvoir être recherchés.

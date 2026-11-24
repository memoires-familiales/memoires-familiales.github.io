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
| La voix de Mamili | `voix/` | `window.VOIX` | `prive/voix.js` |
| Les archives | `archives/` | `window.ARCHIVES` | `prive/archives.js` |
| Les films | `films/` | `window.FILMS` | `prive/films.js` |
| Participer | `participer/` | — | — (rien n'est enregistré) |

Liens entre rubriques : un chapitre est toujours désigné par son **numéro** (`chapitre-12`), une personne par son **appellation dans la photothèque** (`Antoinette Ferrer (Mamie Toinette)`).

## Le livre — `window.LIVRE`

**Le sommaire réel est publié sur le site**, à la demande de Samuel (24 novembre 2026) : `data/livre.js` et `data/livre.json`, en mode `"public"`. La page charge, dans l'ordre, l'exemple (`data/demo/livre.js`), le sommaire publié (`data/livre.js`), puis une éventuelle version privée (`prive/livre.js`), la dernière présente l'emportant.

Il est produit par `outils/extraire_sommaire.py` à partir du texte du manuscrit (titres `#` pour les parties, `##` pour les chapitres, ligne de dates sous chaque titre, numéros des photos imprimées dans chaque chapitre) :

```bash
python3 outils/extraire_sommaire.py manuscrit.txt --public --sans-annexes \
  --titre "Les Mémoires de Mamili" --sous-titre "Rosalie Luque, 1923 – 2018"
```

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
- `page` est facultatif. Le sommaire publié n'a pas encore les numéros de page : le texte utilisé date d'avant les derniers réglages de mise en page. La page affiche alors les années à droite. Les numéros pourront être repris du PDF imprimé (option `--avec-pages` sur le texte de la version finale).
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

```json
{
  "extraits": [
    {
      "id": "a03-12m40",
      "titre": "…",
      "chapitre": { "numero": 2, "titre": "L'enfance à Oran" },
      "enregistrement": { "date": "…", "par": "…", "fichier": "nom du fichier original" },
      "debut": "12:40", "fin": "14:05", "duree": "1 min 25",
      "resume": "…",
      "transcription": "…",
      "personnes": ["…"], "lieux": ["…"],
      "statut": "brut | à monter | monté | validé",
      "audio": "prive/audio/a03-12m40.mp3"
    }
  ]
}
```

C'est l'index prévu par la feuille de route (identifiant, fichier source, début/fin, chapitre, personnes, lieu, résumé, transcription, statut de montage). On garde toujours trois choses distinctes : l'original intact, le montage de consultation (`audio`) et la transcription. Sans `audio`, la page affiche « Extrait audio à venir ».

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

# L'espace famille : le site complet, réservé aux proches

Le site public (<https://memoires-familiales.github.io/>, adresse du QR code du livre) reste la porte d'entrée : accueil, présentation des rubriques et formulaire. Le sommaire du livre, les photos, les enregistrements et les documents de la famille sont dans une **copie du site** publiée par Cloudflare Pages et protégée par **Cloudflare Access** : seules les adresses e-mail inscrites peuvent l'ouvrir, avec un code reçu par e-mail (valable 10 minutes, utilisable une fois).

```
dépôt public  memoires-familiales.github.io  ──►  GitHub Pages      (tout le monde)
                     │
     outils/preparer_espace_famille.py  (+ dossier prive/ de l'ordinateur)
                     ▼
dépôt PRIVÉ   memoires-familiales/espace-famille  ──►  Cloudflare Pages + Access  (famille)
```

Offres gratuites : Cloudflare Access jusqu'à 50 utilisateurs ; Cloudflare Pages jusqu'à 20 000 fichiers par site et 25 Mio par fichier. Cloudflare demande une carte bancaire à l'inscription de Zero Trust, même pour l'offre gratuite, sans la débiter.

## Mise en place (une fois)

**1. GitHub : le dépôt privé**
- Créer le dépôt `espace-famille` dans l'organisation memoires-familiales, en **Private**, sans README.
- Paramètres de l'organisation → GitHub Apps → Claude → Configure → Repository access : ajouter `espace-famille`.

**2. Premier envoi, sans données**
`python3 outils/preparer_espace_famille.py --sortie ../espace-famille --sans-donnees`, puis `git add -A`, `git commit`, `git push` dans `../espace-famille`. Rien de la famille n'est envoyé tant que la protection n'est pas vérifiée.

**3. Cloudflare Pages**
- Créer un compte sur dash.cloudflare.com (activer la double authentification).
- Workers & Pages → Create → Pages → Connect to Git : autoriser Cloudflare sur le seul dépôt `espace-famille`.
- Nom du projet (il donne l'adresse `<nom>.pages.dev`), Framework preset : None, Build command : vide, Build output directory : `/`. Save and Deploy.

**4. Cloudflare Access**
- Zero Trust : choisir un nom d'équipe et l'offre Free.
- Projet Pages → Settings → General → Access policy → Enable (protège les aperçus).
- Zero Trust → Access → Applications → l'application créée : ajouter le domaine de production `<nom>.pages.dev` ; règle « Famille » : Allow, Include → Emails (une adresse par proche) ; méthode de connexion One-time PIN ; durée de session : 1 mois.
- Vérifier en navigation privée : l'adresse doit afficher la page de connexion de Cloudflare.

**5. Données et lien**
- `python3 outils/preparer_espace_famille.py --sortie ../espace-famille`, puis commit et push. `--rubriques voix,photos` choisit les données publiées (par défaut celles de `prive/espace-famille.json`, sinon la voix seule) ; les autres rubriques reçoivent un jeu vide, pour que les exemples fictifs n'apparaissent pas. Garde-fou : si une rubrique déjà en ligne (la voix, par exemple) devait être remplacée par un jeu vide, parce qu'elle n'est pas choisie ou que `prive/` ne l'a pas sur cet ordinateur, le script s'arrête ; `--vider` confirme que c'est voulu.
- Dans `assets/js/site.js`, renseigner `ADRESSE_ESPACE_FAMILLE` : le site public affiche alors « Espace famille » dans le menu.

## Au quotidien

- **Mettre à jour** : refaire l'étape 5 (le script remet la copie à l'image du site et de `prive/`).
- **Ajouter ou retirer un proche** : Zero Trust → Access → Applications → règle « Famille » → Emails.
- Ce que le script copie de `prive/` : le fichier de données de chaque rubrique choisie, `audio/` (voix) et `images/` (photothèque). Le catalogue de la voix (`prive/voix/`), les rapports d'import, l'historique, les tableaux de correspondance et les réglages restent sur l'ordinateur. Les photos d'exemple ne sont pas copiées.
- Le script reprend le sommaire depuis `prive/livre.js` et `prive/livre.json`. Pour retrouver ces fichiers sur un autre poste, les copier dans son dossier local `prive/` depuis le dépôt privé. Si celui-ci contient encore l’ancien sommaire dans `data/`, le script le reprend depuis ce clone de sortie et en fait une copie dans `prive/`.
- Les fichiers propres au dépôt privé sont conservés : `LISEZ-MOI.md`, `404.html`, `test-acces.txt`, `_headers` (avec `Cache-Control: private, no-store`).
- Le script refuse d'écrire dans le dépôt public. Le dépôt `espace-famille` ne doit jamais devenir public.
- Dans la copie, `window.ESPACE_FAMILLE = true` (ajouté en tête de `assets/js/site.js`) remplace l'avis « dossier prive de cet ordinateur » par un avis « réservé aux proches », ajoute « Site public » et « Se déconnecter » au menu, remplace les états de l'accueil par ceux des attributs `data-etat-famille`, et le nom du site porte la mention « Espace famille ».

## État au 24 novembre 2026

- Dépôt privé `memoires-familiales/espace-famille`, projet Cloudflare Pages `espace-famille` (production : `espace-famille.pages.dev`, déploiement automatique à chaque envoi sur `main`).
- Deux applications Access, règle réutilisable « Famille » (Allow, liste d'adresses e-mail, session d'un mois) : `espace-famille.pages.dev` et `*.espace-famille.pages.dev` (les adresses de chaque déploiement). Aucun chemin n'est précisé : tout le site est couvert.
- Contrôle du 24/11 : une requête sans cookie vers la page, `prive/voix.js`, `prive/photos.js`, un MP3, `data/livre.js` ou une page inexistante est redirigée vers la connexion Cloudflare, sur l'adresse de production comme sur une adresse de déploiement. `noindex` n'est qu'un complément.
- Pour refaire ce contrôle : ouvrir l'espace connecté, puis dans la console du navigateur `fetch("/prive/voix.js", {credentials: "omit", redirect: "manual"}).then(r => r.type)` doit répondre `opaqueredirect`.

## La base des corrections (Cloudflare D1)

Les corrections proposées depuis les photos et les fiches de l’arbre sont enregistrées dans l’espace famille via Pages Functions et la base Cloudflare D1. Les proches continuent de proposer des corrections et de donner leur avis. L’adresse de connexion est enregistrée lorsqu’une assertion Access valide l’identifie.

Mise en place (une fois, dans le tableau de bord Cloudflare) :
1. **Storage & Databases → D1 → Create** : nom `corrections-famille` (emplacement : Europe de l'Ouest).
2. **Workers & Pages → espace-famille → Settings → Bindings → Add → D1 database** : nom de la variable `CORRECTIONS`, base `corrections-famille`, pour la production (et l'aperçu si proposé).
3. **Settings → Variables and Secrets** : configurer `ACCESS_TEAM_DOMAIN` (URL HTTPS de l’équipe Access), `ACCESS_AUDIENCE` (AUD de l’application de production) et une adresse unique dans `RESPONSABLES`. `ADMIN_CORRECTIONS_EMAIL` permet de définir explicitement le compte d’administration si nécessaire.
4. Redéployer (le prochain envoi sur le dépôt privé, ou « Retry deployment » sur le dernier déploiement) : les liaisons ne s'appliquent qu'aux nouveaux déploiements.

Les tables se créent au premier appel. Tant que la base n'est pas reliée, la fenêtre de correction envoie par e-mail (FormSubmit) et la page `participer/corrections.html` le dit.

L’[administration des corrections](https://espace-famille.pages.dev/administration/) compare la valeur sur la fiche ou à la date de la proposition avec la correction proposée. Elle permet d’accepter, de modifier puis accepter, de consigner une précision à obtenir ou de refuser. Le lot CSV ou JSON contient les corrections acceptées à reporter dans les sources. Après report et vérification, l’administrateur peut les marquer comme intégrées.

La page, la liste de modération, les exports et les décisions vérifient côté serveur la signature, l’émetteur, l’audience et la validité du jeton Access, ainsi que l’adresse de l’unique administrateur. L’historique D1 conserve les décisions, dates, motifs et versions retenues. La proposition familiale initiale reste consultable et le tableau n’écrit dans aucun fichier source.

Si la fonction n’atteint pas le service de clés Access, `ACCESS_JWKS` peut contenir une copie de secours des clés **publiques** du domaine d’équipe, sous la forme `{"keys":[…],"expire":…}`. `expire` est la date limite en millisecondes Unix. Actualiser cette copie après une rotation des clés si le service reste inaccessible.

Les appels utilisés par les proches sont `GET /api/corrections` (filtrable avec `?photo=…` ou `?personne=…`), `GET /api/corrections/etat`, `POST /api/corrections` et `POST /api/corrections/<id>/avis`. Leur liste exclut les coordonnées, notes et valeurs retenues pour la modération. Les exports réservés au compte d’administration sont disponibles en CSV ou JSON. `lot=1` sélectionne les corrections acceptées restant à intégrer.


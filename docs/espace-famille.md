# L'espace famille : le site complet, réservé aux proches

Le site public (<https://memoires-familiales.github.io/>, adresse du QR code du livre) reste la porte d'entrée : accueil, sommaire du livre, formulaire. Les photos, les enregistrements et les documents de la famille sont dans une **copie du site** publiée par Cloudflare Pages et protégée par **Cloudflare Access** : seules les adresses e-mail inscrites peuvent l'ouvrir, avec un code reçu par e-mail (valable 10 minutes, utilisable une fois).

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
- `python3 outils/preparer_espace_famille.py --sortie ../espace-famille`, puis commit et push.
- Dans `assets/js/site.js`, renseigner `ADRESSE_ESPACE_FAMILLE` : le site public affiche alors « Espace famille » dans le menu.

## Au quotidien

- **Mettre à jour** : refaire l'étape 5 (le script remet la copie à l'image du site et de `prive/`).
- **Ajouter ou retirer un proche** : Zero Trust → Access → Applications → règle « Famille » → Emails.
- Ce que le script copie de `prive/` : les fichiers de données (`*.js`), `images/` et `audio/`. Les rapports d'import, l'historique, les tableaux de correspondance et les réglages restent sur l'ordinateur.
- Le script refuse d'écrire dans le dépôt public. Le dépôt `espace-famille` ne doit jamais devenir public.
- Dans la copie, `window.ESPACE_FAMILLE = true` (ajouté en tête de `assets/js/site.js`) remplace l'avis « dossier prive de cet ordinateur » par un avis « réservé aux proches », et le nom du site porte la mention « Espace famille ».

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Assemble l'espace famille : le site + les données de la famille (dossier prive/),
dans le clone du dépôt PRIVÉ que Cloudflare Pages publie derrière Cloudflare Access.

  python3 outils/preparer_espace_famille.py --sortie ../espace-famille
  python3 outils/preparer_espace_famille.py --sortie ../espace-famille --sans-donnees

--sans-donnees ne copie que le code : c'est le premier envoi, pour vérifier que la
protection Cloudflare Access est bien en place avant d'y mettre quoi que ce soit de la famille.

--rubriques choisit les données privées publiées (par défaut celles de prive/espace-famille.json,
sinon « voix ») : voix, photos, arbre, archives, films. Le livre est inclus dès qu’il est disponible.
Les autres rubriques non choisies reçoivent
un jeu vide, pour que les exemples fictifs n'apparaissent pas dans l'espace famille.

Le dossier de sortie est remis à l'image du site (les fichiers qui n'en font plus partie sont
supprimés, sauf .git). Ensuite, dans ce dossier : git add -A ; git commit ; git push.

Ce que le script copie :
  - les fichiers du site suivis par Git (pages, styles, scripts), sans les outils,
    la documentation ni les jeux d'exemple ;
  - de prive/ : le fichier de données de chaque rubrique choisie, prive/audio/ avec la voix et
    prive/images/ avec la photothèque. Le catalogue de la voix (prive/voix/), les rapports,
    l'historique et les réglages d'import restent sur l'ordinateur.
Les fichiers propres au dépôt privé (LISEZ-MOI.md, 404.html, test-acces.txt, _headers) sont conservés.
Il déclare enfin le mode « espace famille » en tête de assets/js/site.js.
"""
import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
DEPOT_PUBLIC = "memoires-familiales.github.io"
EXCLUS_SITE = ("outils/", "docs/", "README.md", "AGENTS.md", ".gitignore", ".nojekyll", "data/")
CONSERVES = ("_headers", ".gitignore", "LISEZ-MOI.md", "404.html", "test-acces.txt", "_routes.json")
FICHIERS_LIVRE = ("livre.js", "livre.json")
COMPLEMENTS_RECHERCHE = "prive/recherche-complements.js"
PDF_LIVRE = "prive/livre.pdf"
# rubrique : (fichier de prive/, dossier de médias, jeu vide quand la rubrique n'est pas publiée)
RUBRIQUES = {
    "voix": ("voix.js", "audio", 'window.VOIX = {"modele":2,"mode":"prive","extraits":[],"exclusions":[]};'),
    "photos": ("photos.js", "images", 'window.PHOTOTHEQUE = {"modele":1,"mode":"prive","photos":[],"titre":"Photothèque familiale"};'),
    "arbre": ("arbre.js", None, 'window.ARBRE = {"modele":1,"mode":"prive","personnes":[],"racine":null};'),
    "archives": ("archives.js", None, 'window.ARCHIVES = {"modele":1,"mode":"prive","documents":[],"types":{}};'),
    "films": ("films.js", None, 'window.FILMS = {"modele":1,"mode":"prive","films":[]};'),
}
LIMITE_FICHIERS = 20000          # Cloudflare Pages, offre gratuite
LIMITE_TAILLE = 25 * 1024 * 1024  # 25 Mio par fichier

ENTETES = """/*
  X-Robots-Tag: noindex, nofollow
  Referrer-Policy: same-origin
  X-Content-Type-Options: nosniff
  Cache-Control: private, no-store
"""

LISEZ_MOI = """# Espace famille — Mémoires de Mamili

Dépôt PRIVÉ, généré par `outils/preparer_espace_famille.py` depuis le dépôt du site public.
Ne pas modifier à la main : refaire la copie depuis le site, puis `git add -A`, `git commit`, `git push`.

Publié par Cloudflare Pages et protégé par Cloudflare Access : seules les adresses e-mail
inscrites dans la règle d'accès peuvent l'ouvrir, avec un code reçu par e-mail.
Ne jamais rendre ce dépôt public.
"""


def fichiers_du_site():
    try:
        sortie = subprocess.run(["git", "-C", str(RACINE), "ls-files"], capture_output=True, text=True, check=True).stdout
        noms = [n for n in sortie.splitlines() if n]
    except (subprocess.CalledProcessError, FileNotFoundError):
        sys.exit("Impossible de lister les fichiers du site : lancer le script depuis le dépôt Git du site.")
    return [n for n in noms if not n.startswith(EXCLUS_SITE) and not n.startswith("prive/")]


def verifier_sortie(sortie):
    sortie = sortie.resolve()
    if sortie == RACINE or RACINE in sortie.parents:
        sys.exit("Le dossier de sortie ne doit pas être à l'intérieur du site public.")
    if (sortie / ".git").exists():
        r = subprocess.run(["git", "-C", str(sortie), "remote", "-v"], capture_output=True, text=True)
        if DEPOT_PUBLIC in r.stdout:
            sys.exit("Le dossier de sortie pointe vers le dépôt PUBLIC du site : copie refusée.")
    return sortie


def main():
    p = argparse.ArgumentParser(description="Assemble l'espace famille (site + données privées).")
    p.add_argument("--sortie", type=Path, required=True, help="clone du dépôt privé de l'espace famille")
    p.add_argument("--prive", type=Path, default=RACINE / "prive", help="dossier des données de la famille")
    p.add_argument("--sans-donnees", action="store_true", help="ne copier que le code (premier envoi)")
    p.add_argument("--rubriques", help="rubriques privées à publier, séparées par des virgules (voix,photos,arbre…)")
    p.add_argument("--vider", action="store_true",
                   help="autoriser le remplacement de données déjà en ligne par un jeu vide")
    args = p.parse_args()
    reglages = args.prive / "espace-famille.json"
    if args.rubriques:
        choisies = [r.strip() for r in args.rubriques.split(",") if r.strip()]
    elif reglages.exists():
        choisies = json.loads(reglages.read_text(encoding="utf-8")).get("rubriques", ["voix"])
    else:
        choisies = ["voix"]
    inconnues = [r for r in choisies if r not in RUBRIQUES and r != "livre"]
    if inconnues:
        sys.exit("Rubriques inconnues : " + ", ".join(inconnues) + " (possibles : " + ", ".join(RUBRIQUES) + ")")

    sortie = verifier_sortie(args.sortie)
    sortie.mkdir(parents=True, exist_ok=True)

    a_copier = {n: RACINE / n for n in fichiers_du_site()}
    vides = {}
    # L’ancien sommaire du dépôt privé sert de source si le dossier local n’en a pas.
    anciens_livres = {"data/" + fichier for fichier in FICHIERS_LIVRE}
    for fichier in FICHIERS_LIVRE:
        rel = "prive/" + fichier
        deja_en_ligne = (sortie / rel, sortie / "data" / fichier)
        if args.sans_donnees:
            if any(src.is_file() for src in deja_en_ligne):
                sys.exit("Le dossier de sortie contient déjà le sommaire du livre. Utilisez un dossier vide pour --sans-donnees.")
            continue
        for src in (args.prive / fichier, *deja_en_ligne):
            if src.is_file():
                a_copier[rel] = src
                break
    if not args.sans_donnees and "prive/livre.js" not in a_copier:
        vides["prive/livre.js"] = 'window.LIVRE = {"modele":1,"mode":"prive","parties":[]};'
    # Le plein texte est facultatif. On conserve la version publiée si aucun
    # nouveau fichier de compléments n’est présent sur cet ordinateur.
    vides[COMPLEMENTS_RECHERCHE] = 'window.RECHERCHE_COMPLEMENTS = {"mode":"prive"};'
    if not args.sans_donnees:
        for dossier in (args.prive, sortie / "prive"):
            complements = dossier / Path(COMPLEMENTS_RECHERCHE).name
            if complements.is_file():
                contenu = complements.read_text(encoding="utf-8").strip()
                prefixe = "window.RECHERCHE_COMPLEMENTS = "
                if not contenu.startswith(prefixe) or not contenu.endswith(";"):
                    sys.exit(f"Format inattendu : {complements}. Régénérez le fichier avec outils/indexer_livre.py.")
                index = json.loads(contenu[len(prefixe):-1])
                pdf = dossier / Path(PDF_LIVRE).name
                if index.get("pages") and not pdf.is_file():
                    sys.exit(f"Le fichier {complements} indexe un PDF absent : {pdf}.")
                a_copier[COMPLEMENTS_RECHERCHE] = complements
                del vides[COMPLEMENTS_RECHERCHE]
                if index.get("pages"):
                    a_copier[PDF_LIVRE] = pdf
                break
        if (sortie / PDF_LIVRE).is_file() and PDF_LIVRE not in a_copier and not args.vider:
            sys.exit("Le PDF du livre serait retiré de l’espace famille. Vérifiez les fichiers privés de la recherche.")
    elif (sortie / PDF_LIVRE).is_file():
        sys.exit("Le dossier de sortie contient déjà le PDF du livre. Utilisez un dossier vide pour --sans-donnees.")
    if not args.sans_donnees:
        if not args.prive.is_dir():
            sys.exit(f"Dossier des données introuvable : {args.prive}")
        for nom, (fichier, medias, vide) in RUBRIQUES.items():
            src = args.prive / fichier
            if nom in choisies and src.is_file():
                a_copier["prive/" + fichier] = src
                if medias and (args.prive / medias).is_dir():
                    for f in sorted((args.prive / medias).rglob("*")):
                        if f.is_file() and not f.name.startswith("."):
                            a_copier["prive/" + f.relative_to(args.prive).as_posix()] = f
            elif vide:
                vides["prive/" + fichier] = vide
                if nom in choisies:
                    print(f"Rubrique « {nom} » choisie mais {src} est absent : jeu vide publié.")

    # Garde-fou : ne jamais vider en silence une rubrique déjà publiée (par exemple la voix,
    # quand le script est lancé depuis un ordinateur dont le dossier prive/ ne l'a pas).
    menacees = []
    for nom, (fichier, _medias, vide) in RUBRIQUES.items():
        en_ligne = sortie / "prive" / fichier
        if not vide or not en_ligne.is_file() or en_ligne.stat().st_size <= len(vide.encode("utf-8")) + 50:
            continue
        if "prive/" + fichier not in a_copier:
            raison = ("rubrique non choisie" if nom not in choisies
                      else f"{args.prive / fichier} absent" if not args.sans_donnees else "--sans-donnees")
            menacees.append(f"{nom} (prive/{fichier} : {raison})")
    if menacees and not args.vider:
        sys.exit("L'espace famille contient déjà des données qui seraient remplacées par un jeu vide : "
                 + " ; ".join(menacees) + ".\nVérifiez --rubriques et le dossier prive/ (la voix n'existe que "
                 "là où le catalogue a été construit), ou relancez avec --vider pour confirmer.")

    for rel in anciens_livres:
        if (sortie / rel).is_file():
            a_copier[rel] = sortie / rel

    # Remise à l'image : on retire ce qui n'est plus dans le site (sauf .git)
    for f in sorted(sortie.rglob("*"), reverse=True):
        rel = f.relative_to(sortie).as_posix()
        if rel == ".git" or rel.startswith(".git/"):
            continue
        if f.is_file() and rel not in a_copier and rel not in vides and rel not in CONSERVES:
            f.unlink()
        elif f.is_dir() and not any(f.iterdir()):
            f.rmdir()

    trop_gros = []
    for rel, src in a_copier.items():
        dest = sortie / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        if src.resolve() != dest.resolve():
            shutil.copy2(src, dest)
        if src.stat().st_size > LIMITE_TAILLE:
            trop_gros.append(rel)

    for rel, contenu in vides.items():
        (sortie / rel).parent.mkdir(parents=True, exist_ok=True)
        (sortie / rel).write_text(contenu + "\n", encoding="utf-8")
    site_js = sortie / "assets/js/site.js"
    site_js.write_text("window.ESPACE_FAMILLE = true;\n" + site_js.read_text(encoding="utf-8"), encoding="utf-8")
    for nom, contenu in (("_headers", ENTETES), (".gitignore", ".DS_Store\n"), ("LISEZ-MOI.md", LISEZ_MOI)):
        if not (sortie / nom).exists():
            (sortie / nom).write_text(contenu, encoding="utf-8")
    # Cloudflare Pages Functions (base des corrections) : ne les lancer que pour /api/*,
    # les pages et les images restent servies directement (et ne comptent pas dans le quota gratuit).
    if any(r.startswith("functions/") for r in a_copier):
        (sortie / "_routes.json").write_text(json.dumps({"version": 1, "include": ["/api/*"], "exclude": []}) + "\n",
                                             encoding="utf-8")

    nb = len(a_copier) + len(vides)
    taille = sum(f.stat().st_size for f in sortie.rglob("*") if f.is_file() and ".git" not in f.relative_to(sortie).parts)
    nb_prive = sum(1 for r in a_copier if r.startswith("prive/"))
    print(f"Espace famille assemblé dans {sortie} : {nb} fichiers dont {nb_prive} de données, {taille / 1e6:.1f} Mo")
    if not args.sans_donnees:
        publiees = [r for r in choisies if r in RUBRIQUES]
        if "prive/livre.js" in a_copier:
            publiees.append("livre")
        print("Rubriques publiées : " + (", ".join(publiees) or "aucune")
              + (" ; jeux vides : " + ", ".join(v.split("/")[-1] for v in vides) if vides else ""))
    if nb > LIMITE_FICHIERS:
        print(f"ATTENTION : plus de {LIMITE_FICHIERS} fichiers, limite de Cloudflare Pages (offre gratuite).")
    if trop_gros:
        print("ATTENTION : fichiers de plus de 25 Mio, refusés par Cloudflare Pages : " + ", ".join(trop_gros))
    print("Ensuite, dans ce dossier : git add -A && git commit -m \"Mise à jour\" && git push")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Assemble l'espace famille : le site + les données de la famille (dossier prive/),
dans le clone du dépôt PRIVÉ que Cloudflare Pages publie derrière Cloudflare Access.

  python3 outils/preparer_espace_famille.py --sortie ../espace-famille
  python3 outils/preparer_espace_famille.py --sortie ../espace-famille --sans-donnees

--sans-donnees ne copie que le code : c'est le premier envoi, pour vérifier que la
protection Cloudflare Access est bien en place avant d'y mettre quoi que ce soit de la famille.

Le dossier de sortie est remis à l'image du site (les fichiers qui n'en font plus partie sont
supprimés, sauf .git). Ensuite, dans ce dossier : git add -A ; git commit ; git push.

Ce que le script copie :
  - les fichiers du site suivis par Git (pages, styles, scripts, exemples, sommaire publié),
    sans les outils ni la documentation ;
  - de prive/ : les fichiers de données des rubriques (*.js) et les dossiers images/ et audio/.
    Les rapports, l'historique, les tableaux de correspondance et les réglages d'import restent
    sur l'ordinateur.
Il déclare enfin le mode « espace famille » en tête de assets/js/site.js.
"""
import argparse
import shutil
import subprocess
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
DEPOT_PUBLIC = "memoires-familiales.github.io"
EXCLUS_SITE = ("outils/", "docs/", "README.md", "AGENTS.md", ".gitignore", ".nojekyll")
DOSSIERS_PRIVES = ("images", "audio")
LIMITE_FICHIERS = 20000          # Cloudflare Pages, offre gratuite
LIMITE_TAILLE = 25 * 1024 * 1024  # 25 Mio par fichier

ENTETES = """/*
  X-Robots-Tag: noindex, nofollow
  Referrer-Policy: same-origin
  X-Content-Type-Options: nosniff
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
    args = p.parse_args()

    sortie = verifier_sortie(args.sortie)
    sortie.mkdir(parents=True, exist_ok=True)

    a_copier = {n: RACINE / n for n in fichiers_du_site()}
    if not args.sans_donnees:
        if not args.prive.is_dir():
            sys.exit(f"Dossier des données introuvable : {args.prive}")
        for f in sorted(args.prive.glob("*.js")):
            a_copier["prive/" + f.name] = f
        for d in DOSSIERS_PRIVES:
            for f in sorted((args.prive / d).rglob("*")) if (args.prive / d).is_dir() else []:
                if f.is_file() and not f.name.startswith("."):
                    a_copier["prive/" + f.relative_to(args.prive).as_posix()] = f

    # Remise à l'image : on retire ce qui n'est plus dans le site (sauf .git)
    for f in sorted(sortie.rglob("*"), reverse=True):
        rel = f.relative_to(sortie).as_posix()
        if rel == ".git" or rel.startswith(".git/"):
            continue
        if f.is_file() and rel not in a_copier and rel not in ("_headers", ".gitignore", "LISEZ-MOI.md"):
            f.unlink()
        elif f.is_dir() and not any(f.iterdir()):
            f.rmdir()

    trop_gros = []
    for rel, src in a_copier.items():
        dest = sortie / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)
        if src.stat().st_size > LIMITE_TAILLE:
            trop_gros.append(rel)

    site_js = sortie / "assets/js/site.js"
    site_js.write_text("window.ESPACE_FAMILLE = true;\n" + site_js.read_text(encoding="utf-8"), encoding="utf-8")
    (sortie / "_headers").write_text(ENTETES, encoding="utf-8")
    (sortie / ".gitignore").write_text(".DS_Store\n", encoding="utf-8")
    (sortie / "LISEZ-MOI.md").write_text(LISEZ_MOI, encoding="utf-8")

    nb = len(a_copier) + 3
    taille = sum(f.stat().st_size for f in sortie.rglob("*") if f.is_file() and ".git" not in f.relative_to(sortie).parts)
    nb_prive = sum(1 for r in a_copier if r.startswith("prive/"))
    print(f"Espace famille assemblé dans {sortie} : {nb} fichiers dont {nb_prive} de données, {taille / 1e6:.1f} Mo")
    if nb > LIMITE_FICHIERS:
        print(f"ATTENTION : plus de {LIMITE_FICHIERS} fichiers, limite de Cloudflare Pages (offre gratuite).")
    if trop_gros:
        print("ATTENTION : fichiers de plus de 25 Mio, refusés par Cloudflare Pages : " + ", ".join(trop_gros))
    print("Ensuite, dans ce dossier : git add -A && git commit -m \"Mise à jour\" && git push")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Extrait le sommaire du livre (parties, chapitres, années, photos de chaque chapitre)
à partir du texte du manuscrit, et l'écrit dans prive/livre.json et prive/livre.js,
ou, avec --public, dans data/livre.json et data/livre.js (publiés sur le site).

Le texte attendu est celui que donne le connecteur Google Drive pour le manuscrit Word
(ou un export Markdown) :
  - parties en titres de niveau 1 :  « # Titre de la partie », suivis d'une ligne d'années ;
  - chapitres en titres de niveau 2 : « ## Titre du chapitre », suivis d'une ligne d'années ;
  - le sommaire Word sous forme de liens « [Titre](#_Toc…)[page](#_Toc…) » ;
  - les photos du chapitre repérées par leur numéro (P0001…) dans le corps du texte.

Un « chapitre » qui n'est pas suivi d'une ligne de date (« 1858 – 1880 », « 1947 »,
« 27 février 1994 ») est ignoré et signalé : c'est en général une page de notes.

  python3 outils/extraire_sommaire.py manuscrit.txt
  python3 outils/extraire_sommaire.py manuscrit.txt --sans-annexes --exclure "Titre à retirer"

Les numéros de page du sommaire Word ne sont repris qu'avec --avec-pages : ils ne
correspondent au livre imprimé que si le manuscrit est la version mise en page finale.
"""
import argparse
import json
import re
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
# Ligne de date sous un titre : « 1858 – 1880 », « 1947 », « vers 1930 », « 27 février 1994 »
ANNEES = re.compile(r"^\s*(?:vers\s+)?(?:\d{1,2}(?:er)?\s+[a-zéû]+\s+)?\d{4}(?:\s*[–-]\s*(?:\d{1,2}(?:er)?\s+[a-zéû]+\s+)?\d{4})?\s*$", re.I)
NUMERO_PHOTO = re.compile(r"\bP\d{4}\b")
ENTREE_SOMMAIRE = re.compile(r"\[([^\]]+?)\s*\]\(#_Toc\d+\)\[(\d+)\]\(#_Toc\d+\)")


def nettoyer(t):
    return re.sub(r"\s+", " ", re.sub(r"\\([_*\[\]()#.!-])", r"\1", t)).strip()


def cle(t):
    return re.sub(r"[^a-z0-9]+", " ", nettoyer(t).lower()).strip()


def extraire(texte, exclure=(), avec_pages=False, sans_annexes=False):
    if texte.lstrip().startswith("{"):
        try:
            texte = json.loads(texte).get("fileContent", texte)
        except ValueError:
            pass
    sommaire = [(nettoyer(m.group(1)), int(m.group(2))) for m in ENTREE_SOMMAIRE.finditer(texte)]
    pages = {cle(t): p for t, p in sommaire}
    fin_sommaire = max((m.end() for m in ENTREE_SOMMAIRE.finditer(texte)), default=0)
    lignes = texte[fin_sommaire:].split("\n")
    exclus = {cle(t) for t in exclure}

    parties, ignores = [], []
    partie = chapitre = None
    numero_chapitre = 0

    def suivante_non_vide(i):
        for l in lignes[i + 1:i + 8]:
            if l.strip():
                return l.strip()
        return ""

    for i, ligne in enumerate(lignes):
        if ligne.startswith("# "):
            titre = nettoyer(ligne[2:])
            annees = suivante_non_vide(i)
            partie = {"numero": len(parties) + 1, "titre": titre,
                      "annees": annees if ANNEES.match(annees) else "", "chapitres": []}
            if avec_pages and cle(titre) in pages:
                partie["page"] = pages[cle(titre)]
            parties.append(partie)
            chapitre = None
        elif ligne.startswith("## "):
            titre = nettoyer(ligne[3:])
            annees = suivante_non_vide(i)
            if cle(titre) in exclus or not ANNEES.match(annees):
                ignores.append(titre)
                chapitre = None
                continue
            if partie is None:
                partie = {"numero": 1, "titre": "", "annees": "", "chapitres": []}
                parties.append(partie)
            numero_chapitre += 1
            chapitre = {"numero": numero_chapitre, "titre": titre, "annees": annees, "photos": []}
            if avec_pages and cle(titre) in pages:
                chapitre["page"] = pages[cle(titre)]
            partie["chapitres"].append(chapitre)
        elif chapitre is not None:
            for n in NUMERO_PHOTO.findall(ligne):
                if n not in chapitre["photos"]:
                    chapitre["photos"].append(n)

    # Ce qui, dans le sommaire, précède la première partie ou suit le dernier chapitre
    titres_corps = {cle(p["titre"]) for p in parties} | {cle(c["titre"]) for p in parties for c in p["chapitres"]}
    premier = cle(parties[0]["titre"]) if parties else ""
    liminaires, annexes, avant = [], [], True
    for titre, page in sommaire:
        k = cle(titre)
        if k == premier:
            avant = False
            continue
        if k in titres_corps or k in exclus or k in {cle(t) for t in ignores}:
            continue
        entree = {"titre": titre[:1].upper() + titre[1:].lower() if titre.isupper() else titre}
        if avec_pages:
            entree["page"] = page
        (liminaires if avant else annexes).append(entree)
    if sans_annexes:
        annexes = []
    return {"liminaires": liminaires, "parties": parties, "annexes": annexes}, ignores


def main():
    p = argparse.ArgumentParser(description="Extrait le sommaire du livre vers prive/livre.js.")
    p.add_argument("texte", type=Path, help="texte du manuscrit (export du connecteur Drive ou Markdown)")
    p.add_argument("--sortie", type=Path, default=None, help="dossier de sortie (défaut : prive/, ou data/ avec --public)")
    p.add_argument("--public", action="store_true",
                   help="sommaire destiné au site public (data/livre.js), avec l'accord de la famille")
    p.add_argument("--titre", default="")
    p.add_argument("--sous-titre", default="")
    p.add_argument("--source", default="", help="nom du fichier d'origine, noté dans les données")
    p.add_argument("--exclure", action="append", default=[], help="titre de chapitre à ne pas reprendre")
    p.add_argument("--avec-pages", action="store_true", help="reprendre les numéros de page du sommaire Word")
    p.add_argument("--sans-annexes", action="store_true", help="ne pas reprendre ce qui suit le dernier chapitre")
    args = p.parse_args()

    livre, ignores = extraire(args.texte.read_text(encoding="utf-8"), args.exclure, args.avec_pages, args.sans_annexes)
    if not livre["parties"]:
        sys.exit("Aucune partie trouvée : le texte doit contenir des titres « # » et « ## ».")
    if args.sortie is None:
        args.sortie = RACINE / ("data" if args.public else "prive")
    donnees = {"modele": 1, "mode": "public" if args.public else "prive", "titre": args.titre, "sous_titre": args.sous_titre}
    if args.source:
        donnees["source"] = args.source
    donnees.update(livre)

    args.sortie.mkdir(parents=True, exist_ok=True)
    (args.sortie / "livre.json").write_text(json.dumps(donnees, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    (args.sortie / "livre.js").write_text(
        ("/* Sommaire du livre, publié avec l'accord de la famille. " if args.public
         else "/* Sommaire du livre : données privées, ne pas publier. ") +
        "Généré par outils/extraire_sommaire.py */\n"
        "window.LIVRE = " + json.dumps(donnees, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")

    nb_ch = sum(len(p["chapitres"]) for p in livre["parties"])
    nb_ph = len({n for p in livre["parties"] for c in p["chapitres"] for n in c["photos"]})
    print(f"{len(livre['parties'])} parties, {nb_ch} chapitres, {nb_ph} photos citées, "
          f"{len(livre['liminaires'])} liminaire(s), {len(livre['annexes'])} annexe(s)")
    if ignores:
        print("Ignorés (pas de ligne d'années ou exclus) : " + " ; ".join(ignores))
    print(f"Écrit dans {args.sortie / 'livre.js'}")


if __name__ == "__main__":
    main()

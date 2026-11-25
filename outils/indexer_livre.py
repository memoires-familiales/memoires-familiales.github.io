#!/usr/bin/env python3
"""Prépare le texte paginé du livre et les synonymes pour la recherche privée."""
import argparse
import json
import tempfile
from pathlib import Path

PRIVE = Path(__file__).resolve().parent.parent / "prive"
FICHIER = PRIVE / "recherche-complements.js"
PREFIXE = "window.RECHERCHE_COMPLEMENTS = "


def main():
    analyseur = argparse.ArgumentParser(description=__doc__)
    analyseur.add_argument("pages", type=Path, nargs="?", help="texte UTF-8 extrait avec pdftotext, séparateurs de pages conservés")
    analyseur.add_argument("--decalage", type=int, help="folio imprimé moins numéro de page PDF, si vérifié")
    analyseur.add_argument("--alias", type=Path, help="JSON contenant des listes de synonymes ou variantes confirmés")
    args = analyseur.parse_args()
    if not (args.pages or args.alias):
        analyseur.error("Indiquez un texte paginé ou un fichier d’alias.")
    if args.decalage is not None and not args.pages:
        analyseur.error("Le décalage de folio nécessite un texte paginé.")

    index = {"mode": "prive"}
    if FICHIER.is_file():
        contenu = FICHIER.read_text(encoding="utf-8").strip()
        index.update(json.loads(contenu.removeprefix(PREFIXE).removesuffix(";")))
    if args.pages:
        if not (PRIVE / "livre.pdf").is_file():
            analyseur.error("Placez le PDF définitif correspondant au texte dans prive/livre.pdf.")
        parties = args.pages.read_text(encoding="utf-8-sig").split("\f")
        if len(parties) == 1:
            analyseur.error("Séparateurs de pages introuvables. Vérifiez l’extraction avec pdftotext.")
        pages = []
        for numero, texte in enumerate(parties, 1):
            texte = texte.strip()
            if texte:
                page = {"page": numero, "texte": texte}
                if args.decalage is not None and numero + args.decalage > 0:
                    page["page_imprimee"] = numero + args.decalage
                pages.append(page)
        if not pages:
            analyseur.error("Aucun texte trouvé dans le PDF.")
        index["pages"] = pages

    if args.alias:
        alias = json.loads(args.alias.read_text(encoding="utf-8-sig"))
        if not isinstance(alias, list) or any(
            not isinstance(groupe, list) or len(groupe) < 2
            or any(not isinstance(nom, str) or not nom.strip() for nom in groupe)
            for groupe in alias
        ):
            analyseur.error("Les alias doivent être des groupes de deux variantes ou plus, sous forme de texte.")
        index["alias"] = alias

    PRIVE.mkdir(exist_ok=True)
    contenu = PREFIXE + json.dumps(index, ensure_ascii=False) + ";\n"
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=PRIVE, delete=False) as sortie:
        sortie.write(contenu)
    Path(sortie.name).replace(FICHIER)
    print(f"Index privé : {len(index.get('pages', []))} pages, {len(index.get('alias', []))} groupes de variantes.")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Fabrique le jeu de démonstration pour la consultation locale (data/demo/).

Les personnes, les photos et les légendes sont inventées : ce jeu sert à
montrer et tester la photothèque sans publier aucune donnée de la famille.
Les « photos » sont des images dessinées (silhouettes, paysages) aux tons sépia.

  python3 outils/creer_demo.py
"""
import json
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageChops

RACINE = Path(__file__).resolve().parent.parent
SORTIE = RACINE / "data" / "demo"

A = "Antoinette Ferrer (Mamie Toinette)"
J = "Joseph Ferrer"
L = "Lucienne Ferrer"
P = "Paul Ferrer"
R = "Rose Soler"
M = "Marcel Soler"
H = "Hélène Ferrer"
V = "Pierre Vidal"

# numero, date (tri, precision, libellé, approximative), lieu, personnes, inconnus,
# scène, orientation, événement, chapitre, notes, mots-clés
PHOTOS = [
    ("D0001", ("1921-01-01", "annee", "vers 1921", True), ("Algérie", "Oran", ""), [R, M], 0,
     "portrait2", "v", "Portrait de mariage", "Chapitre 1. Les grands-parents", "Au dos : « Studio Lumière, Oran »", []),
    ("D0002", ("1929-06-01", "mois", "juin 1929", False), ("Algérie", "Oran", "Rue de la Mer"), [A, R], 1,
     "groupe3", "h", "", "Chapitre 2. L'enfance à Oran", "", []),
    ("D0003", ("1932-04-17", "jour", "Pâques 1932", False), ("Algérie", "Mostaganem", "La ferme"), [A, R, M], 4,
     "ferme", "h", "Pâques à la ferme", "Chapitre 2. L'enfance à Oran", "Au dos : « Pâques chez l'oncle »",
     ["Repas"]),
    ("D0004", ("1935-01-01", "annee", "1935", False), ("Algérie", "Oran", ""), [A], 0,
     "portrait", "v", "Communion", "Chapitre 3. L'école", "", ["Fête religieuse"]),
    ("D0005", ("1938-08-01", "mois", "août 1938", False), ("Algérie", "Oran", "La plage"), [A, H], 2,
     "mer", "h", "Vacances à la mer", "Chapitre 3. L'école", "", ["Vacances"]),
    ("D0006", ("1942-01-01", "annee", "1942 ?", True), ("Algérie", "Oran", ""), [J], 0,
     "portrait", "v", "Le service militaire", "Chapitre 4. La guerre", "Au dos : « Pour ma Toinette »", []),
    ("D0007", ("1946-05-11", "jour", "11 mai 1946", False), ("Algérie", "Oran", "Église Saint-Louis"), [A, J, R, M], 6,
     "groupe6", "h", "Mariage d'Antoinette et Joseph", "Chapitre 5. Le mariage", "", ["Mariage"]),
    ("D0008", ("1946-05-11", "jour", "11 mai 1946", False), ("Algérie", "Oran", "Église Saint-Louis"), [A, J], 0,
     "portrait2", "v", "Mariage d'Antoinette et Joseph", "Chapitre 5. Le mariage", "", ["Mariage"]),
    ("D0009", ("1949-01-01", "annee", "1949", False), ("Maroc", "Casablanca", ""), [A, L], 0,
     "portrait2", "v", "", "Chapitre 6. Casablanca", "Lucienne a un an", ["Bébé"]),
    ("D0010", ("1951-07-01", "mois", "juillet 1951", False), ("Maroc", "Casablanca", "Boulevard de la Gare"), [J, L, P], 0,
     "ville", "h", "", "Chapitre 6. Casablanca", "", ["Voiture"]),
    ("D0011", ("1953-12-25", "jour", "Noël 1953", False), ("Maroc", "Casablanca", "La maison"), [A, J, L, P, H], 1,
     "groupe5", "h", "Noël en famille", "Chapitre 6. Casablanca", "", []),
    ("D0012", ("1955-01-01", "annee", "1955", False), ("Maroc", "Rabat", ""), [P], 0,
     "portrait", "v", "", "Chapitre 7. Les enfants grandissent", "", []),
    ("D0013", ("1956-08-01", "mois", "été 1956", True), ("Maroc", "Mohammédia", "La plage"), [L, P, H], 3,
     "mer", "h", "Vacances à la mer", "Chapitre 7. Les enfants grandissent", "", ["Vacances"]),
    ("D0014", ("1957-09-01", "mois", "septembre 1957", False), ("France", "Marseille", "Le port"), [A, J, L, P], 0,
     "port", "h", "L'arrivée en France", "Chapitre 8. Le départ pour la France", "Au dos : « Enfin arrivés »", []),
    ("D0015", ("1958-01-01", "annee", "1958", False), ("France", "Perpignan", "Rue du Fort"), [A, J], 0,
     "maison", "h", "La nouvelle maison", "Chapitre 9. Tout recommencer", "", ["Maison"]),
    ("D0016", ("1960-06-12", "jour", "12 juin 1960", False), ("France", "Perpignan", ""), [L], 0,
     "portrait", "v", "Communion de Lucienne", "Chapitre 9. Tout recommencer", "", ["Fête religieuse"]),
    ("D0017", ("1962-07-01", "mois", "juillet 1962", False), ("Espagne", "Valence", ""), [A, J, H], 2,
     "groupe3", "h", "Voyage en Espagne", "Chapitre 10. Le retour au pays des ancêtres", "", ["Vacances"]),
    ("D0018", ("1965-01-01", "annee", "1965", False), ("France", "Montpellier", ""), [P, V], 0,
     "groupe2", "h", "", "", "Pierre, l'ami de Paul", []),
    ("D0019", ("1968-04-20", "jour", "20 avril 1968", False), ("France", "Montpellier", "Mairie"), [L, V, A, J], 8,
     "groupe6", "h", "Mariage de Lucienne et Pierre", "Chapitre 11. Les mariages des enfants", "", ["Mariage"]),
    ("D0020", ("1972-01-01", "annee", "années 1970", True), ("France", "Perpignan", "Le jardin"), [A], 3,
     "jardin", "h", "", "", "", []),
    ("D0021", ("1985-01-01", "annee", "1985", False), ("France", "Perpignan", ""), [A, J, L, P, H, V], 4,
     "groupe6", "h", "Les 40 ans de mariage", "Chapitre 12. Les petits-enfants", "", ["Repas"]),
    ("D0022", None, ("", "", ""), [], 3,
     "groupe3", "h", "", "", "Personnes et lieu inconnus", []),
    ("D0023", None, ("Algérie", "", ""), [R], 1,
     "groupe2", "v", "", "", "Peut-être la sœur de Rose", []),
    ("D0024", None, ("", "", ""), [], 0,
     "paysage", "h", "", "", "", []),
]

SEPIA = [(242, 230, 205), (214, 190, 150), (170, 135, 95), (110, 80, 52), (60, 42, 28)]


def ton(i):
    return SEPIA[max(0, min(len(SEPIA) - 1, i))]


def silhouette(d, x, base, h, couleur):
    tete = h * 0.17
    d.ellipse([x - tete / 2, base - h, x + tete / 2, base - h + tete], fill=couleur)
    d.rounded_rectangle([x - h * 0.17, base - h + tete * 1.05, x + h * 0.17, base], radius=int(h * 0.08), fill=couleur)


def dessiner(scene, w, h, graine):
    rnd = random.Random(graine)
    im = Image.new("RGB", (w, h), ton(1))
    d = ImageDraw.Draw(im)
    horizon = int(h * rnd.uniform(0.55, 0.68))
    for y in range(h):  # ciel et sol en dégradé
        t = y / h
        c = tuple(int(ton(0)[k] * (1 - t) + ton(2)[k] * t) for k in range(3))
        d.line([(0, y), (w, y)], fill=c)
    if scene in ("mer", "port", "paysage"):
        d.rectangle([0, horizon, w, h], fill=ton(2))
        for k in range(14):
            y = horizon + k * (h - horizon) / 14
            d.line([(0, y), (w, y + rnd.uniform(-4, 4))], fill=ton(1), width=2)
        d.ellipse([w * 0.7, h * 0.12, w * 0.7 + w * 0.09, h * 0.12 + w * 0.09], fill=ton(0))
    else:
        d.rectangle([0, horizon, w, h], fill=ton(2))
    if scene in ("maison", "ferme", "ville"):
        for k in range(3 if scene == "ville" else 1):
            bx = w * (0.15 + k * 0.3) if scene == "ville" else w * 0.25
            bw, bh = w * 0.28, h * 0.32
            d.rectangle([bx, horizon - bh, bx + bw, horizon], fill=ton(1))
            d.polygon([(bx - 10, horizon - bh), (bx + bw / 2, horizon - bh - h * 0.12), (bx + bw + 10, horizon - bh)], fill=ton(3))
            d.rectangle([bx + bw * 0.4, horizon - bh * 0.45, bx + bw * 0.6, horizon], fill=ton(3))
    if scene == "jardin":
        for k in range(7):
            x = w * (0.08 + k * 0.14)
            d.ellipse([x - 40, horizon - 120, x + 40, horizon - 20], fill=ton(3))
    if scene == "port":
        d.polygon([(w * 0.15, horizon), (w * 0.55, horizon), (w * 0.5, horizon + 40), (w * 0.2, horizon + 40)], fill=ton(3))
        d.rectangle([w * 0.3, horizon - 90, w * 0.33, horizon], fill=ton(3))
    n = {"portrait": 1, "portrait2": 2, "groupe2": 2, "groupe3": 3, "groupe5": 5, "groupe6": 6, "ferme": 4,
         "mer": 3, "ville": 3, "port": 4, "maison": 2}.get(scene, 0)
    if n:
        taille = h * (0.78 if n == 1 else 0.62 if n == 2 else 0.5 if n <= 4 else 0.42)
        base = h * (0.98 if n <= 2 else 0.92)
        for k in range(n):
            x = w * (k + 1) / (n + 1) + rnd.uniform(-w * 0.02, w * 0.02)
            silhouette(d, x, base, taille * rnd.uniform(0.85, 1.05), ton(3 + (k % 2)))
    im = im.filter(ImageFilter.GaussianBlur(2.2))
    bruit = Image.effect_noise((w, h), 28).convert("RGB")
    im = ImageChops.blend(im, ImageChops.multiply(im, bruit), 0.18)
    # vignettage
    masque = Image.new("L", (w, h), 0)
    md = ImageDraw.Draw(masque)
    for k in range(40):
        a = k / 40
        md.ellipse([w * a * 0.25 - w * 0.1, h * a * 0.25 - h * 0.1, w - w * a * 0.25 + w * 0.1, h - h * a * 0.25 + h * 0.1],
                   fill=int(255 * a))
    sombre = Image.new("RGB", (w, h), ton(4))
    im = Image.composite(im, sombre, masque.filter(ImageFilter.GaussianBlur(60)))
    # bord blanc du tirage
    marge = int(min(w, h) * 0.045)
    cadre = Image.new("RGB", (w + 2 * marge, h + 2 * marge), (246, 240, 226))
    cadre.paste(im, (marge, marge))
    return cadre


def main():
    (SORTIE / "images" / "miniatures").mkdir(parents=True, exist_ok=True)
    (SORTIE / "images" / "web").mkdir(parents=True, exist_ok=True)
    fiches = []
    for i, (num, date, lieu, pers, inconnus, scene, orient, evt, chap, notes, mots) in enumerate(PHOTOS):
        w, h = (1200, 860) if orient == "h" else (860, 1150)
        im = dessiner(scene, w, h, i * 7 + 3)
        web = SORTIE / "images" / "web" / f"{num}.jpg"
        mini = SORTIE / "images" / "miniatures" / f"{num}.jpg"
        im.save(web, "JPEG", quality=80, optimize=True, progressive=True)
        im.thumbnail((480, 480))
        im.save(mini, "JPEG", quality=78, optimize=True, progressive=True)
        if date:
            tri, precision, libelle, approx = date
            d = {"tri": tri, "annee": int(tri[:4]), "precision": precision, "libelle": libelle}
            if approx:
                d["approximative"] = True
        else:
            d = {"precision": "inconnue", "libelle": "Date inconnue"}
        f = {"id": f"demo-{num.lower()}", "numero": num, "titre": f"{num} - photo d'exemple", "date": d}
        lieu_d = {k: v for k, v in zip(("pays", "ville", "precis"), lieu) if v}
        if lieu_d:
            f["lieu"] = lieu_d
        if pers:
            f["personnes"] = pers
        if inconnus:
            f["inconnus"] = inconnus
        for k, v in (("evenement", evt), ("chapitre", chap), ("notes", notes)):
            if v:
                f[k] = v
        if mots:
            f["mots_cles"] = mots
        f["provenance"] = "Exemple"
        if inconnus or not pers:
            f["a_identifier"] = True
        f["images"] = {"miniature": f"data/demo/images/miniatures/{num}.jpg",
                       "web": f"data/demo/images/web/{num}.jpg"}
        fiches.append(f)
    donnees = {"modele": 1, "mode": "demo", "titre": "Photothèque d'exemple", "photos": fiches}
    (SORTIE / "photos.json").write_text(json.dumps(donnees, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    (SORTIE / "photos.js").write_text(
        "/* Jeu de démonstration : personnes et photos fictives. Généré par outils/creer_demo.py */\n"
        "window.PHOTOTHEQUE = " + json.dumps(donnees, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8")
    print(f"{len(fiches)} photos d'exemple écrites dans {SORTIE.relative_to(RACINE)}/")


if __name__ == "__main__":
    main()

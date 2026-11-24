#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Importe les photos d'Apple Photos dans la photothèque du site.

Le script lit :
  1. l'export des photos (obligatoire) : le tableau exporté d'Apple Photos
     (CSV ou XLSX, colonnes « UUID Photos », « Titre Photos »...) ou un export
     OSXPhotos (`osxphotos query --json` ou `--csv`) ;
  2. le tableau de travail des photos anciennes (facultatif) : dates estimées,
     lieux, personnes présentes, événement, chapitre du livre, notes du verso ;
  3. le référentiel des identités (facultatif) : pour écrire chaque personne
     toujours de la même façon ;
  4. le dossier des photos exportées (facultatif) : pour fabriquer les
     miniatures et les versions web.

Il écrit dans le dossier `prive/` (exclu de Git, donc jamais publié) :
  prive/photos.json        les données, une fiche par photo
  prive/photos.js          les mêmes données, lues par la page de la photothèque
  prive/images/...         miniatures et versions web
  prive/historique/...     la version précédente, pour revenir en arrière
  prive/rapports/...       ce qui a changé, les conflits, les noms à rapprocher

L'import est « idempotent » : relancé avec les mêmes fichiers, il ne change
rien. Chaque photo est reconnue par son identifiant Apple Photos (UUID). Une
photo absente du nouvel export n'est pas effacée : elle est marquée comme
retirée (sauf avec --supprimer-absentes).

Exemple :
  python3 outils/importer_photos.py \\
      --photos  "~/Exports/Export_Photos - Album complet.xlsx" \\
      --complements "~/Exports/TABLEAU - PHOTOS ANCIENNES 3.xlsx" \\
      --referentiel "~/Exports/REFERENTIEL - IDENTITES PERSONNES PHOTOS ANCIENNES.xlsx" \\
      --images "~/Exports/photos-jpeg"

Dépendances : Python 3.9+ ; openpyxl pour lire les .xlsx ; Pillow pour les
images (pip3 install openpyxl pillow).
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import io
import json
import os
import re
import shutil
import sys
import unicodedata
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
MODELE = 1

MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet",
        "août", "septembre", "octobre", "novembre", "décembre"]

TAILLE_MINIATURE = 480
TAILLE_WEB = 1600

# Appellations qui veulent dire « personne non identifiée »
NON_IDENTIFIE = {"unknown", "a identifier", "inconnu", "inconnue", "x", "?", ""}

# Colonnes reconnues dans l'export des photos (comparées sans accents ni casse)
COLONNES_PHOTOS = {
    "uuid": ["uuid photos", "uuid", "identifiant", "id"],
    "titre": ["titre photos", "titre", "title", "name"],
    "fichier": ["nom fichier original", "original filename", "nom du fichier", "filename", "fichier"],
    "date": ["date photos", "date", "date prise de vue"],
    "pays": ["pays", "country"],
    "ville": ["ville", "city"],
    "lieu_precis": ["lieu precis", "area of interest"],
    "lieu_affiche": ["lieu affiche dans photos", "lieu affiche", "place"],
    "latitude": ["latitude", "lat"],
    "longitude": ["longitude", "lon", "lng"],
    "personnes": ["personnes reconnues", "persons", "personnes", "people"],
    "legende": ["legende photos", "description", "legende", "caption"],
    "mots_cles": ["mots cles", "keywords", "mots cle"],
    "albums": ["albums", "album"],
    "favori": ["favori", "favorite", "favoris"],
    "masquee": ["hidden", "masquee", "masque"],
}

# Colonnes reconnues dans le tableau de travail
COLONNES_COMPLEMENTS = {
    "numero": ["n chrono", "n chrono2", "numero", "n", "chrono"],
    "date": ["date"],
    "date_estimee": ["date estimee"],
    "pays": ["pays"],
    "ville": ["ville"],
    "lieu": ["lieu dit lieu precis", "lieu dit", "lieu precis", "lieu"],
    "personnes": ["personnes presentes", "personnes"],
    "type": ["type de photo", "type"],
    "evenement": ["evenement contexte", "evenement"],
    "notes": ["commentaires", "commentaire", "notes"],
    "provenance": ["emplacement physique", "emplacement", "provenance"],
    "mots_cles": ["mot cle", "mots cles"],
    "statut": ["statut de traitement", "statut"],
    "chapitre": ["chapitre du livre", "chapitre"],
    "x": ["x"],
}


# ---------------------------------------------------------------- outils

def cle(texte) -> str:
    """Forme de comparaison : minuscules, sans accents ni ponctuation."""
    if texte is None:
        return ""
    t = unicodedata.normalize("NFKD", str(texte))
    t = "".join(c for c in t if not unicodedata.combining(c)).lower()
    t = re.sub(r"[^a-z0-9]+", " ", t)
    return t.strip()


def texte(v) -> str:
    if v is None:
        return ""
    if isinstance(v, bool):
        return "Oui" if v else "Non"
    if isinstance(v, (dt.datetime, dt.date)):
        return v.isoformat()
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    if isinstance(v, (list, tuple)):
        return " ; ".join(texte(x) for x in v if texte(x))
    if isinstance(v, dict):
        return ""
    return re.sub(r"\s+", " ", str(v)).strip()


def liste(v) -> list[str]:
    if v is None:
        return []
    if isinstance(v, (list, tuple)):
        return [texte(x) for x in v if texte(x)]
    s = texte(v)
    if not s:
        return []
    morceaux = s.split(";") if ";" in s else s.split(",")
    return [m.strip() for m in morceaux if m.strip()]


def booleen(v) -> bool:
    if isinstance(v, bool):
        return v
    return cle(v) in {"oui", "yes", "true", "1", "vrai"}


def nombre(v):
    try:
        f = float(str(v).replace(",", "."))
        return round(f, 6)
    except (TypeError, ValueError):
        return None


def sans_doublons(elements, cle_fn=cle):
    vus, sortie = set(), []
    for e in elements:
        k = cle_fn(e)
        if k and k not in vus:
            vus.add(k)
            sortie.append(e)
    return sortie


def majuscule(s: str) -> str:
    return s[:1].upper() + s[1:] if s else s


def chemin_site(p: Path) -> str:
    """Chemin relatif à la racine du site, avec des « / »."""
    return os.path.relpath(p, RACINE).replace(os.sep, "/")


# ---------------------------------------------------------------- lecture

def _en_dicts(lignes, repere=None):
    """Transforme des lignes brutes en dictionnaires {clé de colonne: valeur}."""
    debut = None
    for i, ligne in enumerate(lignes):
        cellules = [cle(c) for c in ligne]
        if repere:
            if any(c == cle(repere) or c.startswith(cle(repere)) for c in cellules):
                debut = i
                break
        elif sum(1 for c in cellules if c) >= 2:
            debut = i
            break
    if debut is None:
        return None
    entetes, deja = [], {}
    for c in lignes[debut]:
        k = cle(c) or "colonne"
        if k in deja:
            deja[k] += 1
            k = f"{k} {deja[k]}"
        else:
            deja[k] = 1
        entetes.append(k)
    resultat = []
    for ligne in lignes[debut + 1:]:
        if not any(texte(c) for c in ligne):
            continue
        resultat.append({entetes[j]: ligne[j] for j in range(min(len(entetes), len(ligne)))})
    return resultat


def lire_tableau(chemin: Path, feuille=None, repere=None) -> list[dict]:
    ext = chemin.suffix.lower()
    if ext == ".json":
        data = json.loads(chemin.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            for k in ("photos", "items", "data"):
                if k in data:
                    data = data[k]
                    break
        return [{cle(k): v for k, v in d.items()} for d in data if isinstance(d, dict)]

    if ext in (".csv", ".tsv", ".txt"):
        brut = chemin.read_bytes()
        for enc in ("utf-8-sig", "cp1252", "mac_roman"):
            try:
                contenu = brut.decode(enc)
                break
            except UnicodeDecodeError:
                continue
        try:
            dialecte = csv.Sniffer().sniff(contenu[:20000], delimiters=",;\t")
        except csv.Error:
            dialecte = csv.excel
        lignes = list(csv.reader(io.StringIO(contenu), dialecte))
        res = _en_dicts(lignes, repere)
        if res is None:
            sys.exit(f"Impossible de trouver la ligne d'en-tête dans {chemin.name}.")
        return res

    if ext in (".xlsx", ".xlsm"):
        try:
            import openpyxl
        except ImportError:
            sys.exit("Pour lire un fichier .xlsx, installez openpyxl : pip3 install openpyxl")
        wb = openpyxl.load_workbook(chemin, read_only=True, data_only=True)
        feuilles = [wb[feuille]] if feuille else wb.worksheets
        for ws in feuilles:
            lignes = [list(r) for r in ws.iter_rows(values_only=True)]
            res = _en_dicts(lignes, repere)
            if res is not None:
                return res
        sys.exit(f"Aucune feuille de {chemin.name} ne contient la colonne « {repere} ».")

    sys.exit(f"Format non reconnu : {chemin.name} (CSV, XLSX ou JSON attendu).")


def lire_feuille(chemin: Path, nom_feuille: str):
    """Lit une feuille précise d'un classeur ; renvoie None si elle n'existe pas."""
    import openpyxl
    wb = openpyxl.load_workbook(chemin, read_only=True, data_only=True)
    for ws in wb.worksheets:
        if cle(ws.title) == cle(nom_feuille):
            return _en_dicts([list(r) for r in ws.iter_rows(values_only=True)])
    return None


def prendre(ligne: dict, noms: list[str]):
    for n in noms:
        k = cle(n)
        if k in ligne and texte(ligne[k]) != "":
            return ligne[k]
    return None


# ---------------------------------------------------------------- dates

def _parse_date(v, format_date="jma"):
    """Renvoie (année, mois, jour) ou None."""
    if v is None or v == "":
        return None
    if isinstance(v, dt.datetime):
        return v.year, v.month, v.day
    if isinstance(v, dt.date):
        return v.year, v.month, v.day
    if isinstance(v, (int, float)) and 1000 < v < 80000:  # numéro de série Excel
        d = dt.date(1899, 12, 30) + dt.timedelta(days=int(v))
        return d.year, d.month, d.day
    s = texte(v)
    m = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})", s)
    if m:
        return int(m[1]), int(m[2]), int(m[3])
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})", s)
    if m:
        a, b, annee = int(m[1]), int(m[2]), int(m[3])
        jour, mois = (b, a) if format_date == "mja" else (a, b)
        if 1 <= mois <= 12 and 1 <= jour <= 31:
            return annee, mois, jour
    m = re.match(r"^(\d{4})$", s)
    if m:
        return int(m[1]), 1, 1
    return None


def libelle_date(annee, mois, jour, precision):
    if precision == "jour":
        return f"{'1er' if jour == 1 else jour} {MOIS[mois - 1]} {annee}"
    if precision == "mois":
        return f"{MOIS[mois - 1]} {annee}"
    if precision == "annee":
        return str(annee)
    return "Date inconnue"


ARTEFACT_MOIS = re.compile(r"^[^\W\d_]{3,5}\.?-\d{2}$")           # « Sep-45 »
ARTEFACT_JOUR = re.compile(r"^\d{1,2}-[^\W\d_]{3,5}\.?-\d{2}$")    # « 21-Aug-41 »
APPROXIMATIF = re.compile(r"\?|\bvers\b|\benviron\b|\bann[ée]es\b|\bdebut\b|\bdébut\b|\bfin\b", re.I)


def date_depuis_titre(titre: str):
    segments = [s.strip() for s in re.split(r"\s+-\s*|\s*-\s+", titre) if s.strip()]
    if len(segments) < 2:
        return None
    m = re.match(r"^(1[89]\d{2}|20\d{2})(?:[_.\-](\d{1,2}))?(?:[_.\-](\d{1,2}))?$", segments[1])
    if not m:
        return None
    annee = int(m[1])
    mois = int(m[2]) if m[2] else None
    jour = int(m[3]) if m[3] else None
    if mois and not 1 <= mois <= 12:
        mois, jour = None, None
    if jour and not 1 <= jour <= 31:
        jour = None
    precision = "jour" if jour else "mois" if mois else "annee"
    return annee, mois or 1, jour or 1, precision


def resoudre_date(titre, apple_date, comp_date, comp_libelle, seuil, format_date):
    """Choisit la meilleure date disponible et dit à quel point elle est sûre."""
    libelle_humain = texte(comp_libelle)
    if cle(libelle_humain) in {"non renseigne", "inconnu", "inconnue", "date inconnue", "sans date"}:
        libelle_humain = ""
        if not texte(comp_date):
            comp_date = None

    # 1. Le tableau de travail, quand il donne une date ou une date estimée
    ymd = _parse_date(comp_date, format_date)
    if ymd or libelle_humain:
        if not ymd:
            m = re.search(r"(1[89]\d{2}|20\d{2})", libelle_humain)
            if m:
                ymd = (int(m[1]), 1, 1)
        if ymd:
            a, mo, j = ymd
            if ARTEFACT_JOUR.match(libelle_humain):
                precision, libelle_humain = "jour", ""
            elif ARTEFACT_MOIS.match(libelle_humain):
                precision, libelle_humain = "mois", ""
            elif re.fullmatch(r"\d{4}", libelle_humain):
                precision, libelle_humain = "annee", ""
            elif mo == 1 and j == 1:
                precision = "annee"
            elif j == 1:
                precision = "mois"
            else:
                precision = "jour"
            return {
                "tri": f"{a:04d}-{mo:02d}-{j:02d}",
                "annee": a,
                "precision": precision,
                "libelle": libelle_humain or libelle_date(a, mo, j, precision),
                "approximative": bool(APPROXIMATIF.search(libelle_humain)),
                "source": "tableau",
            }

    # 2. La date écrite dans le titre (P0009 - 1941_08_21 - Paris)
    d = date_depuis_titre(titre or "")
    if d:
        a, mo, j, precision = d
        return {"tri": f"{a:04d}-{mo:02d}-{j:02d}", "annee": a, "precision": precision,
                "libelle": libelle_date(a, mo, j, precision), "approximative": False,
                "source": "titre"}

    # 3. La date enregistrée dans Photos, si elle est antérieure au seuil
    ymd = _parse_date(apple_date)
    if ymd:
        a, mo, j = ymd
        if a < seuil:
            precision = "annee" if (mo, j) == (1, 1) else "mois" if j == 1 else "jour"
            return {"tri": f"{a:04d}-{mo:02d}-{j:02d}", "annee": a, "precision": precision,
                    "libelle": libelle_date(a, mo, j, precision), "approximative": True,
                    "source": "photos"}
        # Au-delà du seuil, c'est le plus souvent la date de numérisation.
        return {"precision": "inconnue", "libelle": "Date inconnue",
                "enregistree": f"{a:04d}-{mo:02d}-{j:02d}"}

    return {"precision": "inconnue", "libelle": "Date inconnue"}


# ---------------------------------------------------------------- lieux

def lieu_osxphotos(place) -> dict:
    """Extrait pays et ville du champ « place » d'un export OSXPhotos."""
    if not isinstance(place, dict):
        return {}
    adresse = place.get("address") or {}
    noms = place.get("names") or {}

    def premier(x):
        return x[0] if isinstance(x, list) and x else (x if isinstance(x, str) else "")

    return {
        "pays": adresse.get("country") or premier(noms.get("country")),
        "ville": adresse.get("city") or premier(noms.get("city")),
        "lieu_precis": premier(noms.get("area_of_interest")),
        "lieu_affiche": place.get("name") or "",
    }


def resoudre_lieu(apple: dict, comp: dict | None):
    a = {k: texte(apple.get(k)) for k in ("pays", "ville", "lieu_precis")}
    lat, lon = nombre(apple.get("latitude")), nombre(apple.get("longitude"))
    conflit = None
    lieu = {}
    if comp and any(texte(comp.get(k)) for k in ("pays", "ville", "lieu")):
        lieu = {"pays": majuscule(texte(comp.get("pays"))), "ville": majuscule(texte(comp.get("ville"))),
                "precis": texte(comp.get("lieu")), "source": "tableau"}
        if a["ville"] and lieu["ville"] and cle(a["ville"]) != cle(lieu["ville"]):
            conflit = (a["ville"] + (f", {a['pays']}" if a["pays"] else ""),
                       lieu["ville"] + (f", {lieu['pays']}" if lieu["pays"] else ""))
            lat = lon = None  # les coordonnées de Photos désignent l'autre lieu
        elif not lieu["ville"] and a["ville"] and (not lieu["pays"] or cle(lieu["pays"]) == cle(a["pays"])):
            lieu["ville"] = a["ville"]
            lieu["pays"] = lieu["pays"] or a["pays"]
    elif any(a.values()):
        lieu = {"pays": a["pays"], "ville": a["ville"], "precis": a["lieu_precis"], "source": "photos"}
    if lieu and lat is not None and lon is not None and not (lat == 0 and lon == 0):
        lieu["lat"], lieu["lon"] = lat, lon
    lieu = {k: v for k, v in lieu.items() if v not in ("", None)}
    return lieu, conflit


# ---------------------------------------------------------------- personnes

class Referentiel:
    """Correspondances entre les façons d'écrire un nom et l'appellation retenue."""

    def __init__(self):
        self.alias: dict[str, str] = {}
        self.origine: dict[str, str] = {}
        self.ambigus: set[str] = set()
        self.canoniques: dict[str, str] = {}
        self._source = ""

    def ajouter(self, trouve, remplacement, force=False):
        t, r = texte(trouve), texte(remplacement)
        if t and r and (force or cle(t) not in self.ambigus):
            self.alias[cle(t)] = r
            self.origine[cle(t)] = self._source
            self.canoniques[cle(r)] = r

    def charger(self, chemin: Path, prioritaire=False):
        self._source = chemin.name
        ext = chemin.suffix.lower()
        if ext in (".xlsx", ".xlsm"):
            personnes = lire_feuille(chemin, "Personnes") or []
            for p in personnes:
                canon = texte(prendre(p, ["appellation normalisee"]))
                if not canon:
                    continue
                self.canoniques[cle(canon)] = canon
                self.alias[cle(canon)] = canon
                self.origine[cle(canon)] = self._source
                prenoms = texte(prendre(p, ["prenom s", "prenoms", "prenom"]))
                naissance = texte(prendre(p, ["nom de naissance"]))
                marital = texte(prendre(p, ["nom marital"]))
                for variante in (f"{prenoms} {naissance}", f"{prenoms} {naissance} {marital}",
                                 f"{prenoms} {marital}" if marital else ""):
                    if variante.strip() and "/" not in variante and "(" not in variante:
                        if cle(variante) not in self.alias:
                            self.alias[cle(variante)] = canon
                            self.origine[cle(variante)] = self._source
            for a in lire_feuille(chemin, "A verifier") or []:
                for nom in re.split(r"/", texte(prendre(a, ["alias a resoudre"]))):
                    if cle(nom):
                        self.ambigus.add(cle(nom))
            for a in lire_feuille(chemin, "Alias automatiques") or []:
                self.ajouter(prendre(a, ["appellation trouvee"]), prendre(a, ["remplacement propose"]))
        else:
            for ligne in lire_tableau(chemin):
                valeurs = list(ligne.values())
                trouve = prendre(ligne, ["appellation trouvee", "nom trouve"]) or (valeurs[0] if valeurs else "")
                rempl = prendre(ligne, ["remplacement propose", "remplacement", "appellation normalisee"]) or (
                    valeurs[1] if len(valeurs) > 1 else "")
                # une table d'alias écrite à la main l'emporte, même sur un surnom « à vérifier »
                self.ajouter(trouve, rempl, force=prioritaire)
        if not prioritaire:
            for k in self.ambigus:
                self.alias.pop(k, None)

    def source(self, nom: str) -> str:
        return self.origine.get(cle(re.sub(r"\s*\?\s*$", "", texte(nom))), "")

    def normaliser(self, nom: str):
        """Renvoie (nom retenu, reconnu par le référentiel ?)."""
        n = re.sub(r"\s*\?\s*$", "", texte(nom)).strip()
        k = cle(n)
        if k in self.alias:
            return self.alias[k], True
        return n, False


# ---------------------------------------------------------------- images

EXTENSIONS_IMAGES = (".jpg", ".jpeg", ".png", ".tif", ".tiff", ".webp")
SIGNATURES_IMAGES = (b"\xff\xd8\xff", b"\x89PNG", b"II*\x00", b"MM\x00*")


def est_une_image(f: Path) -> bool:
    """Image reconnue à son extension, ou à son contenu quand le nom n'en a pas
    (« P1607 - France - Ruvigny » dans le dossier CHRONO PHOTO du Drive)."""
    if f.suffix.lower() in EXTENSIONS_IMAGES:
        return True
    if f.name.startswith(".") or f.suffix.lower() in (".xlsx", ".csv", ".json", ".txt", ".url", ".heic", ".mov", ".mp4"):
        return False
    try:
        with f.open("rb") as h:
            debut = h.read(12)
    except OSError:
        return False
    return debut.startswith(SIGNATURES_IMAGES) or (debut[:4] == b"RIFF" and debut[8:12] == b"WEBP")


def indexer_images(dossier: Path) -> dict[str, Path]:
    index = {}
    for f in sorted(dossier.rglob("*")):
        if f.is_file() and est_une_image(f):
            nom = f.stem if f.suffix.lower() in EXTENSIONS_IMAGES else f.name
            index.setdefault(cle(nom), f)
            index.setdefault(cle(f.name), f)
    return index


def trouver_image(index, uuid, fichier, numero):
    for k in (cle(uuid), cle(fichier), cle(Path(fichier).stem) if fichier else ""):
        if k and k in index:
            return index[k]
    if uuid:  # nom commençant par l'UUID (ex. « UUID_1.jpg »)
        ku = cle(uuid)
        for k, f in index.items():
            if k.startswith(ku):
                return f
    if numero:
        kn = cle(numero)
        for k, f in index.items():
            if k == kn or k.startswith(kn + " "):
                return f
    return None


def fabriquer_images(source: Path, dossier_images: Path, uuid: str, forcer=False):
    try:
        from PIL import Image, ImageOps
    except ImportError:
        sys.exit("Pour fabriquer les images, installez Pillow : pip3 install pillow")
    sorties = {}
    for nom, taille in (("miniature", TAILLE_MINIATURE), ("web", TAILLE_WEB)):
        cible = dossier_images / ("miniatures" if nom == "miniature" else "web") / f"{uuid}.jpg"
        cible.parent.mkdir(parents=True, exist_ok=True)
        if forcer or not cible.exists() or cible.stat().st_mtime < source.stat().st_mtime:
            with Image.open(source) as im:
                im = ImageOps.exif_transpose(im)
                if im.mode not in ("RGB", "L"):
                    im = im.convert("RGB")
                im.thumbnail((taille, taille), Image.LANCZOS)
                # enregistrée sans métadonnées EXIF (ni GPS, ni appareil)
                im.save(cible, "JPEG", quality=82 if nom == "miniature" else 86,
                        optimize=True, progressive=True)
        sorties[nom] = chemin_site(cible)
    return sorties


# ---------------------------------------------------------------- import

def construire_fiches(args, rapport):
    lignes_photos = lire_tableau(args.photos, repere=None)
    if not lignes_photos:
        sys.exit("L'export des photos est vide.")

    # Tableau de travail (compléments), indexé par numéro P0001...
    complements = {}
    if args.complements:
        for l in lire_tableau(args.complements, feuille=args.feuille_complements, repere="N° chrono"):
            n = texte(prendre(l, COLONNES_COMPLEMENTS["numero"]))
            m = re.search(r"P\d{4}", n)
            if m:
                c = {k: prendre(l, noms) for k, noms in COLONNES_COMPLEMENTS.items()}
                complements[m.group(0)] = c

    ref = Referentiel()
    for chemin in args.referentiel or []:
        ref.charger(chemin)
    alias_local = args.sortie / "alias-personnes.csv"
    if alias_local.exists():
        ref.charger(alias_local, prioritaire=True)

    # Chapitres du livre (prive/livre.json, produit par outils/extraire_sommaire.py) :
    # le livre fait foi pour savoir dans quel chapitre une photo est imprimée.
    chapitres_livre = {}
    chemin_livre = args.livre
    if chemin_livre is None:
        for candidat in (args.sortie / "livre.json", RACINE / "data" / "livre.json"):
            if candidat.exists():
                chemin_livre = candidat
                break
    if chemin_livre and Path(chemin_livre).exists():
        livre = json.loads(Path(chemin_livre).read_text(encoding="utf-8"))
        for partie in livre.get("parties", []):
            for ch in partie.get("chapitres", []):
                for n in ch.get("photos", []):
                    chapitres_livre.setdefault(n, f"Chapitre {ch['numero']}. {ch['titre']}")
        rapport["livre"] = chemin_livre

    index_images = indexer_images(args.images) if args.images else None
    images_utilisees = set()
    dossier_images = args.sortie / "images"

    # Première passe : les noms reconnus par Photos servent aussi de référence
    noms_photos = {}
    for l in lignes_photos:
        for n in liste(prendre(l, COLONNES_PHOTOS["personnes"])):
            nn, _ = ref.normaliser(n)
            if cle(nn) not in NON_IDENTIFIE:
                noms_photos.setdefault(cle(nn), nn)
    connus = dict(noms_photos)
    connus.update(ref.canoniques)

    fiches, numeros_vus = [], set()
    for l in lignes_photos:
        uuid = texte(prendre(l, COLONNES_PHOTOS["uuid"]))
        if not uuid:
            rapport["sans_uuid"] += 1
            continue
        if booleen(prendre(l, COLONNES_PHOTOS["masquee"])):
            rapport["masquees"] += 1
            continue
        titre = texte(prendre(l, COLONNES_PHOTOS["titre"]))
        fichier = texte(prendre(l, COLONNES_PHOTOS["fichier"]))
        m = re.search(r"\bP\d{4}\b", titre) or re.search(r"\bP\d{4}\b", fichier)
        numero = m.group(0) if m else ""
        numeros_vus.add(numero)
        comp = complements.get(numero)

        apple = {k: prendre(l, noms) for k, noms in COLONNES_PHOTOS.items()}
        if "place" in l and isinstance(l["place"], dict):
            for k, v in lieu_osxphotos(l["place"]).items():
                apple[k] = apple.get(k) or v

        date = resoudre_date(titre, apple["date"], comp and comp.get("date"),
                             comp and comp.get("date_estimee"), args.seuil_date, args.format_date)
        if comp and date.get("source") == "tableau":
            dt_titre = date_depuis_titre(titre)
            if dt_titre and dt_titre[0] != date["annee"]:
                rapport["conflits"].append((numero, "date", f"titre : {dt_titre[0]}",
                                            f"tableau : {date['libelle']}"))

        lieu, conflit = resoudre_lieu(apple, comp)
        if conflit:
            rapport["conflits"].append((numero, "lieu", f"Photos : {conflit[0]}", f"tableau : {conflit[1]}"))

        # Personnes
        personnes, inconnus = [], 0
        for n in liste(apple["personnes"]):
            if cle(n) in NON_IDENTIFIE:
                inconnus += 1
                continue
            nn, reconnu = ref.normaliser(n)
            personnes.append(nn)
            corr = rapport["correspondances"].setdefault(n, [nn, ref.source(n), 0])
            corr[2] += 1
            if not reconnu:
                rapport["noms_libres"][nn] = rapport["noms_libres"].get(nn, 0) + 1
        autres = []
        if comp and comp.get("personnes"):
            for n in re.split(r"[;,]", texte(comp["personnes"])):
                n = n.strip()
                if cle(n) in NON_IDENTIFIE:
                    continue
                nn, reconnu = ref.normaliser(n)
                if reconnu or cle(nn) in connus:
                    personnes.append(connus.get(cle(nn), nn))
                else:
                    autres.append(n)
        personnes = sans_doublons(personnes)

        chapitre = texte(comp.get("chapitre")) if comp else ""
        if comp and not chapitre and re.search(r"\b(chapitre|partie)\s+\d", cle(comp.get("x"))):
            chapitre = texte(comp.get("x"))
        chapitre = re.sub(r"^\s*x\s+", "", chapitre, flags=re.I)
        if numero in chapitres_livre:
            chapitre = chapitres_livre[numero]

        mots = liste(apple["mots_cles"]) + (liste(comp.get("mots_cles")) if comp else [])
        mots = sans_doublons([majuscule(m) for m in mots])
        albums = liste(apple["albums"])
        statut = texte(comp.get("statut")) if comp else ""

        fiche = {
            "id": uuid,
            "numero": numero,
            "titre": titre,
            "fichier": fichier,
            "date": date,
            "lieu": lieu,
            "personnes": personnes,
            "inconnus": inconnus,
            "autres_mentions": " ; ".join(autres),
            "legende": texte(apple["legende"]),
            "evenement": texte(comp.get("evenement")) if comp else "",
            "type": texte(comp.get("type")) if comp else "",
            "notes": texte(comp.get("notes")) if comp else "",
            "chapitre": chapitre,
            "mots_cles": mots,
            "albums": albums,
            "provenance": texte(comp.get("provenance")) if comp else "",
            "statut": statut,
            "favori": booleen(apple["favori"]),
            "a_identifier": inconnus > 0 or any("a identifier" in cle(a) for a in albums)
                            or "identifier" in cle(statut),
            "sources": ["photos"] + (["tableau"] if comp else []) + (["livre"] if numero in chapitres_livre else []),
        }

        # Images
        images = None
        if index_images is not None:
            src = trouver_image(index_images, uuid, fichier, numero)
            if src:
                images_utilisees.add(src)
                images = fabriquer_images(src, dossier_images, uuid, args.forcer_images)
            else:
                rapport["sans_image"].append(numero or uuid)
        else:
            mini = dossier_images / "miniatures" / f"{uuid}.jpg"
            web = dossier_images / "web" / f"{uuid}.jpg"
            if mini.exists():
                images = {"miniature": chemin_site(mini), "web": chemin_site(web if web.exists() else mini)}
        if images:
            fiche["images"] = images

        fiches.append(compacter(fiche))

    if index_images is not None:
        # Images du dossier qu'aucune fiche de l'export n'a reprises (photos ajoutées dans
        # Photos après l'export des métadonnées, par exemple) : à signaler, jamais ignorées en silence.
        rapport["images_sans_fiche"] = sorted({f.name for f in index_images.values()}
                                              - {f.name for f in images_utilisees})
    rapport["livre_absentes"] = sorted(n for n in chapitres_livre if n not in numeros_vus)
    rapport["complements_orphelins"] = sorted(n for n in complements if n not in numeros_vus
                                              and any(texte(v) for k, v in complements[n].items() if k != "numero"))
    return fiches


def compacter(d):
    """Retire les champs vides pour alléger le fichier."""
    if isinstance(d, dict):
        return {k: compacter(v) for k, v in d.items()
                if k in ("id", "date") or v not in ("", None, [], {}, False, 0)}
    return d


def comparable(f):
    return {k: v for k, v in f.items() if k not in ("ajoutee_le", "modifiee_le")}


def fusionner(anciennes, nouvelles, aujourd_hui, supprimer_absentes, rapport):
    precedent = {f["id"]: f for f in anciennes}
    resultat = []
    for f in nouvelles:
        old = precedent.pop(f["id"], None)
        if old is None:
            f["ajoutee_le"] = f["modifiee_le"] = aujourd_hui
            rapport["ajoutees"].append(f.get("numero") or f["id"])
        else:
            f["ajoutee_le"] = old.get("ajoutee_le", aujourd_hui)
            ancien = comparable(old)
            if ancien != comparable(f):
                f["modifiee_le"] = aujourd_hui
                champs = sorted(k for k in set(ancien) | set(f)
                                if k not in ("ajoutee_le", "modifiee_le") and ancien.get(k) != f.get(k))
                rapport["modifiees"].append((f.get("numero") or f["id"], champs))
            else:
                f["modifiee_le"] = old.get("modifiee_le", aujourd_hui)
        resultat.append(f)
    for old in precedent.values():
        if supprimer_absentes:
            rapport["supprimees"].append(old.get("numero") or old["id"])
            continue
        if not old.get("retiree"):
            old = dict(old, retiree=True, modifiee_le=aujourd_hui)
            rapport["retirees"].append(old.get("numero") or old["id"])
        resultat.append(old)
    resultat.sort(key=lambda f: (f.get("numero") or "~", f["id"]))
    return resultat


def ecrire_donnees(sortie: Path, fiches, genere_le):
    donnees = {
        "modele": MODELE,
        "mode": "prive",
        "titre": "Photothèque familiale",
        "genere_le": genere_le,
        "photos": fiches,
    }
    (sortie / "photos.json").write_text(json.dumps(donnees, ensure_ascii=False, indent=1) + "\n",
                                        encoding="utf-8")
    compact = json.dumps(donnees, ensure_ascii=False, separators=(",", ":"))
    (sortie / "photos.js").write_text(
        "/* Données privées de la photothèque : ne pas publier. Fichier généré par "
        "outils/importer_photos.py */\nwindow.PHOTOTHEQUE = " + compact + ";\n", encoding="utf-8")


def ecrire_rapport(sortie: Path, horodatage, rapport, total, simulation):
    dossier = sortie / "rapports"
    dossier.mkdir(parents=True, exist_ok=True)
    lignes = [f"# Import de la photothèque — {horodatage.replace('_', ' ')}", ""]
    if simulation:
        lignes += ["*Simulation : aucun fichier de données n'a été modifié.*", ""]
    lignes += [
        f"- Photos dans la photothèque : **{total}**",
        f"- Ajoutées : {len(rapport['ajoutees'])}",
        f"- Modifiées : {len(rapport['modifiees'])}",
        f"- Retirées de l'export (conservées, masquées sur le site) : {len(rapport['retirees'])}",
        f"- Supprimées : {len(rapport['supprimees'])}",
        f"- Ignorées (masquées dans Photos) : {rapport['masquees']} ; sans identifiant : {rapport['sans_uuid']}",
        f"- Conflits entre Photos et le tableau : {len(rapport['conflits'])}",
        f"- Noms de personnes sans correspondance dans le référentiel : {len(rapport['noms_libres'])}",
        (f"- Images : {len(rapport['sans_image'])} photo(s) sans image ; "
         f"{len(rapport['images_sans_fiche'])} image(s) du dossier sans fiche"
         if "images_sans_fiche" in rapport else "- Images : dossier d'images non fourni (images existantes conservées)"),
        f"- Chapitres repris du livre : {'oui (' + chemin_site(Path(str(rapport['livre']))) + ')' if rapport.get('livre') else 'non (pas de livre.json)'}",
        "",
    ]

    def section(titre, elements, limite=200):
        if elements:
            lignes.extend([f"## {titre}", ""])
            for e in elements[:limite]:
                lignes.append(f"- {e}")
            if len(elements) > limite:
                lignes.append(f"- … et {len(elements) - limite} autres")
            lignes.append("")

    section("Ajoutées", rapport["ajoutees"])
    section("Modifiées", [f"{n} : {', '.join(c)}" for n, c in rapport["modifiees"]])
    section("Retirées de l'export", rapport["retirees"])
    section("Supprimées", rapport["supprimees"])
    section("Conflits (le tableau l'emporte ; à trancher dans Photos ou dans le tableau)",
            [f"{n} — {t} : {a} / {b}" for n, t, a, b in rapport["conflits"]])
    section("Numéros décrits dans le tableau mais absents de l'export", rapport["complements_orphelins"])
    section("Photos sans image trouvée", rapport["sans_image"])
    section("Images du dossier sans fiche dans l'export (refaire l'export des métadonnées de Photos pour les ajouter)",
            rapport.get("images_sans_fiche", []))
    section("Photos imprimées dans le livre mais absentes de l'export", rapport.get("livre_absentes", []))
    if rapport["noms_libres"]:
        lignes += ["## Noms à rapprocher", "",
                   "Ces noms viennent de Photos et ne figurent pas dans le référentiel. La liste complète est "
                   "dans `noms-sans-correspondance.csv` : remplissez la colonne « remplacement », puis "
                   "enregistrez le fichier sous `prive/alias-personnes.csv` et relancez l'import.", ""]
        for n, c in sorted(rapport["noms_libres"].items(), key=lambda x: (-x[1], x[0]))[:40]:
            lignes.append(f"- {n} ({c} photo{'s' if c > 1 else ''})")
        lignes.append("")

    chemin = dossier / f"import-{horodatage}.md"
    chemin.write_text("\n".join(lignes), encoding="utf-8")

    with open(dossier / "noms-sans-correspondance.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["appellation trouvée", "nombre de photos", "remplacement"])
        for n, c in sorted(rapport["noms_libres"].items(), key=lambda x: (-x[1], x[0])):
            w.writerow([n, c, ""])
    with open(dossier / "correspondance-noms.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["nom dans Photos", "nombre de photos", "nom retenu sur le site", "correspondance trouvée dans"])
        for n, (retenu, origine, c) in sorted(rapport["correspondances"].items(), key=lambda x: (-x[1][2], x[0])):
            w.writerow([n, c, retenu, origine or "aucune"])
    with open(dossier / f"conflits-{horodatage}.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["numéro", "champ", "valeur 1", "valeur 2"])
        w.writerows(rapport["conflits"])
    return chemin


def verifier_gitignore(sortie: Path):
    try:
        rel = sortie.resolve().relative_to(RACINE)
    except ValueError:
        return  # hors du dépôt : rien à craindre
    gitignore = RACINE / ".gitignore"
    motifs = [l.strip().strip("/") for l in gitignore.read_text().splitlines()] if gitignore.exists() else []
    if rel.parts and rel.parts[0] not in motifs:
        print(f"⚠️  Attention : le dossier « {rel} » n'est pas exclu de Git dans .gitignore. "
              "Les photos et les noms de la famille risqueraient d'être publiés.", file=sys.stderr)


CONFIG_EXEMPLE = {
    "photos": "~/Documents/Mamili/Export_Photos - Album complet.xlsx",
    "complements": "~/Documents/Mamili/TABLEAU - PHOTOS ANCIENNES 3.xlsx",
    "referentiel": ["~/Documents/Mamili/REFERENTIEL - IDENTITES PERSONNES PHOTOS ANCIENNES.xlsx"],
    "images": "~/Documents/Mamili/photos-jpeg",
}


def charger_config(args):
    """Sans --photos, lit les chemins dans prive/config-import.json (créé au premier lancement)."""
    config = args.sortie / "config-import.json"
    if not config.exists():
        config.write_text(json.dumps(CONFIG_EXEMPLE, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        sys.exit(f"Premier lancement : indiquez l'emplacement de vos fichiers dans {config}, puis relancez.\n"
                 "(« images » et « complements » sont facultatifs : mettez \"\" pour les ignorer.)")
    reglages = json.loads(config.read_text(encoding="utf-8"))

    def chemin(v):
        return Path(v).expanduser() if v else None

    args.photos = chemin(reglages.get("photos"))
    args.complements = args.complements or chemin(reglages.get("complements"))
    args.images = args.images or chemin(reglages.get("images"))
    refs = reglages.get("referentiel") or []
    args.referentiel = args.referentiel or [chemin(r) for r in ([refs] if isinstance(refs, str) else refs) if r]
    if not args.photos:
        sys.exit(f"Indiquez l'export des photos (« photos ») dans {config}.")
    print(f"Réglages lus dans {config}")


def main():
    p = argparse.ArgumentParser(description="Importe les photos d'Apple Photos dans la photothèque du site.")
    p.add_argument("--photos", type=Path, help="export des photos (CSV, XLSX ou JSON OSXPhotos)")
    p.add_argument("--complements", type=Path, help="tableau de travail des photos anciennes (XLSX ou CSV)")
    p.add_argument("--feuille-complements", default=None, help="nom de la feuille du tableau de travail")
    p.add_argument("--referentiel", type=Path, action="append",
                   help="référentiel des identités (XLSX) ou table d'alias (CSV) ; peut être répété")
    p.add_argument("--images", type=Path, help="dossier des photos exportées (JPEG), pour les miniatures")
    p.add_argument("--livre", type=Path, help="sommaire du livre (défaut : prive/livre.json, sinon data/livre.json)")
    p.add_argument("--forcer-images", action="store_true", help="refaire toutes les miniatures")
    p.add_argument("--sortie", type=Path, default=RACINE / "prive", help="dossier de sortie (défaut : prive/)")
    p.add_argument("--seuil-date", type=int, default=2000,
                   help="au-delà de cette année, une date de Photos sans autre indice est considérée comme "
                        "une date de numérisation (défaut : 2000)")
    p.add_argument("--format-date", choices=["jma", "mja"], default="jma",
                   help="ordre des dates écrites en texte dans le tableau : jj/mm/aaaa (jma) ou mm/jj/aaaa (mja)")
    p.add_argument("--supprimer-absentes", action="store_true",
                   help="supprimer les photos absentes du nouvel export (sinon : marquées « retirées »)")
    p.add_argument("--simulation", action="store_true", help="tout calculer, écrire le rapport, ne rien modifier")
    p.add_argument("--restaurer", type=Path, help="remettre en place une version de prive/historique/")
    args = p.parse_args()

    for nom in ("photos", "complements", "images", "restaurer", "livre"):
        v = getattr(args, nom)
        if v is not None:
            setattr(args, nom, v.expanduser())
    args.referentiel = [r.expanduser() for r in (args.referentiel or [])]
    args.sortie = args.sortie.expanduser()
    args.sortie.mkdir(parents=True, exist_ok=True)
    verifier_gitignore(args.sortie)

    maintenant = dt.datetime.now().replace(microsecond=0)
    horodatage = maintenant.strftime("%Y-%m-%d_%H%M%S")
    fichier_donnees = args.sortie / "photos.json"
    historique = args.sortie / "historique"

    if args.restaurer:
        donnees = json.loads(args.restaurer.read_text(encoding="utf-8"))
        if fichier_donnees.exists():
            historique.mkdir(parents=True, exist_ok=True)
            shutil.copy2(fichier_donnees, historique / f"photos-{horodatage}-avant-restauration.json")
        ecrire_donnees(args.sortie, donnees["photos"], donnees.get("genere_le", maintenant.isoformat()))
        print(f"Version restaurée : {args.restaurer.name} ({len(donnees['photos'])} photos).")
        return

    if not args.photos:
        charger_config(args)
    for f in [args.photos, args.complements, args.images, *args.referentiel]:
        if f is not None and not f.exists():
            sys.exit(f"Fichier ou dossier introuvable : {f}")

    rapport = {k: [] for k in ("ajoutees", "modifiees", "retirees", "supprimees", "conflits", "sans_image")}
    rapport.update({"noms_libres": {}, "correspondances": {}, "masquees": 0, "sans_uuid": 0,
                    "complements_orphelins": [], "livre_absentes": [], "livre": None})

    nouvelles = construire_fiches(args, rapport)
    anciennes = []
    if fichier_donnees.exists():
        anciennes = json.loads(fichier_donnees.read_text(encoding="utf-8")).get("photos", [])
    fiches = fusionner(anciennes, nouvelles, maintenant.date().isoformat(), args.supprimer_absentes, rapport)
    change = bool(rapport["ajoutees"] or rapport["modifiees"] or rapport["retirees"] or rapport["supprimees"])

    if not args.simulation and change:
        if fichier_donnees.exists():
            historique.mkdir(parents=True, exist_ok=True)
            shutil.copy2(fichier_donnees, historique / f"photos-{horodatage}.json")
        ecrire_donnees(args.sortie, fiches, maintenant.isoformat())
    elif not args.simulation and not (args.sortie / "photos.js").exists():
        ecrire_donnees(args.sortie, fiches, maintenant.isoformat())

    visibles = sum(1 for f in fiches if not f.get("retiree"))
    chemin_rapport = ecrire_rapport(args.sortie, horodatage, rapport, visibles, args.simulation)
    print(f"{visibles} photos · {len(rapport['ajoutees'])} ajoutée(s) · {len(rapport['modifiees'])} modifiée(s) · "
          f"{len(rapport['retirees'])} retirée(s) · {len(rapport['conflits'])} conflit(s)")
    if args.simulation:
        print("Simulation : rien n'a été modifié.")
    elif not change:
        print("Aucun changement depuis le dernier import.")
    print(f"Rapport : {chemin_rapport}")


if __name__ == "__main__":
    main()

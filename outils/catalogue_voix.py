#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
La voix de Mamili : du catalogue des extraits aux données de la page.

Le catalogue vit dans prive/voix/ (jamais dans le dépôt public) :
  catalogue.csv        une ligne par extrait (séparateur « ; », s'ouvre dans un tableur)
  enregistrements.csv  une ligne par enregistrement original (A01, A02…)
  transcriptions/      un fichier texte par extrait : <id>.txt
et les MP3 dans prive/audio/ (nom exact donné par la colonne « fichier »).

Usage :
  python3 outils/catalogue_voix.py                 contrôle le catalogue et écrit prive/voix.js
  python3 outils/catalogue_voix.py --verifier      contrôle seulement, n'écrit rien
  python3 outils/catalogue_voix.py --index Index_enregistrements_audio_Memoires_Mamili.docx
        reprend le répertoire des MP3 de l'index Word : ajoute les nouveaux extraits,
        signale les titres, chapitres ou coupes qui ont changé (clé : identifiant Drive du MP3).
        Avec --appliquer, met le catalogue à jour (sauf les extraits exclus ou retouchés).

Colonnes de catalogue.csv :
  id, statut (monté | exclu), titre, chapitre (0 = Prologue, 1 à 108, vide = hors livre),
  type (livre | complément | version à vérifier | hors livre), source (A01… ; « A01 arch. »),
  coupes (« 15:13,50–16:44,71 + 17:17,45–17:54,78 »), duree, fichier, drive_id, taille,
  resume, personnes, lieux, divergences (valeurs séparées par « | »), notes,
  note_transcription, note_montage, motif_exclusion.
Le titre du chapitre n'est pas saisi : il vient du sommaire (data/livre.json), clé = numéro.

Le résultat ne dépend que du catalogue et des fichiers : deux lancements identiques
produisent le même prive/voix.js. Le rapport est écrit dans prive/voix/rapport-controles.md.
"""
import argparse
import csv
import datetime
import hashlib
import html
import json
import re
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
TYPES = ("livre", "complément", "version à vérifier", "hors livre")
STATUTS = ("monté", "exclu")
CHAMPS = ["id", "statut", "titre", "chapitre", "type", "source", "coupes", "duree", "fichier", "drive_id", "taille",
          "resume", "personnes", "lieux", "divergences", "notes", "note_transcription", "note_montage", "motif_exclusion"]
LIMITE_TAILLE = 25 * 1024 * 1024
TEMPS = r"(?:\d{1,2}:)?\d{1,2}:\d{2}(?:[,.]\d{1,2})?"


def lire_csv(chemin):
    with open(chemin, newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f, delimiter=";"))


def ecrire_csv(chemin, lignes, champs):
    with open(chemin, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, champs, delimiter=";", extrasaction="ignore")
        w.writeheader()
        w.writerows(lignes)


def liste(valeur):
    return [x.strip() for x in (valeur or "").split("|") if x.strip()]


def secondes(t):
    t = t.replace(",", ".")
    return sum(float(x) * 60 ** i for i, x in enumerate(reversed(t.split(":"))))


def duree_lisible(s):
    s = int(round(s))
    return f"{s // 60}:{s % 60:02d}"


def duree_fichier(chemin):
    if not shutil.which("ffprobe"):
        return None
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(chemin)],
                       capture_output=True, text=True)
    try:
        return float(r.stdout.strip())
    except ValueError:
        return -1  # illisible


def chapitres_du_livre(chemin):
    livre = json.loads(Path(chemin).read_text(encoding="utf-8"))
    chap = {0: "Prologue"}
    for p in livre.get("parties", []):
        for c in p.get("chapitres", []):
            chap[int(c["numero"])] = c["titre"]
    return chap


# ---------------------------------------------------------------- construction de prive/voix.js

def construire(prive, livre, verifier_seulement=False):
    dossier = prive / "voix"
    cat = lire_csv(dossier / "catalogue.csv")
    enr = {e["code"]: e for e in lire_csv(dossier / "enregistrements.csv")}
    chap = chapitres_du_livre(livre)
    erreurs, alertes, infos = [], [], []
    vus_id, vus_fichier, vus_drive, empreintes = {}, {}, {}, {}
    extraits, exclusions = [], []
    a_transferer = []

    for n, l in enumerate(cat, 2):
        i = l["id"].strip()
        ou = f"{i or 'ligne ' + str(n)}"
        if not i:
            erreurs.append(f"ligne {n} : identifiant vide"); continue
        for cle, dico in (("id", vus_id), ("fichier", vus_fichier), ("drive_id", vus_drive)):
            v = l.get(cle, "").strip()
            if v and v in dico:
                erreurs.append(f"{ou} : {cle} « {v} » déjà utilisé par {dico[v]}")
            elif v:
                dico[v] = i
        if l["statut"] not in STATUTS:
            erreurs.append(f"{ou} : statut « {l['statut']} » inconnu ({', '.join(STATUTS)})")
        if l["statut"] == "exclu":
            exclusions.append({"id": i, "titre": l["titre"], "source": l["source"], "motif": l["motif_exclusion"]})
            continue

        # Chapitre : le numéro est la clé, le titre vient du sommaire
        c = l["chapitre"].strip()
        if c == "":
            chapitre = None
            if l["type"] != "hors livre":
                erreurs.append(f"{ou} : pas de chapitre, le type doit être « hors livre »")
        else:
            try:
                num = int(c)
            except ValueError:
                erreurs.append(f"{ou} : chapitre « {c} » illisible"); continue
            if num not in chap:
                erreurs.append(f"{ou} : le chapitre {num} n'existe pas dans le sommaire"); continue
            chapitre = {"numero": num, "titre": chap[num]}
            if l["type"] == "hors livre":
                erreurs.append(f"{ou} : rattaché au chapitre {num} mais de type « hors livre »")
        if l["type"] not in TYPES:
            erreurs.append(f"{ou} : type « {l['type']} » inconnu ({', '.join(TYPES)})")

        coupes = [x.strip() for x in l["coupes"].split("+") if x.strip()]
        for x in coupes:
            m = re.fullmatch(f"({TEMPS})\\s*[–-]\\s*({TEMPS})", x)
            if not m or secondes(m.group(2)) <= secondes(m.group(1)):
                erreurs.append(f"{ou} : coupe « {x} » illisible ou à l'envers")
        code = re.match(r"A\d\d", l["source"] or "")
        source = enr.get(code.group(0)) if code else None
        if not source:
            erreurs.append(f"{ou} : enregistrement « {l['source']} » absent de enregistrements.csv")

        tr = dossier / "transcriptions" / f"{i}.txt"
        transcription = tr.read_text(encoding="utf-8").strip() if tr.exists() else ""
        if not transcription:
            alertes.append(f"{ou} : pas de transcription ({tr.relative_to(prive.parent)})")
        if not l["resume"].strip():
            alertes.append(f"{ou} : pas de résumé")

        audio = prive / "audio" / l["fichier"]
        chemin_audio = None
        if l["fichier"] and audio.is_file():
            chemin_audio = f"prive/audio/{l['fichier']}"
            taille = audio.stat().st_size
            if taille > LIMITE_TAILLE:
                erreurs.append(f"{ou} : {l['fichier']} dépasse 25 Mio (limite de Cloudflare Pages)")
            emp = hashlib.md5(audio.read_bytes()).hexdigest()
            if emp in empreintes:
                erreurs.append(f"{ou} : {l['fichier']} est identique à {empreintes[emp]}")
            empreintes[emp] = l["fichier"]
            d = duree_fichier(audio)
            if d == -1:
                erreurs.append(f"{ou} : {l['fichier']} illisible (ffprobe)")
            elif d is not None and l["duree"]:
                ecart = abs(d - secondes(l["duree"]))
                if ecart > 1.5:
                    alertes.append(f"{ou} : durée du fichier {duree_lisible(d)}, catalogue {l['duree']}")
        else:
            a_transferer.append(l["fichier"] or i)

        extrait = {
            "id": i, "titre": l["titre"], "chapitre": chapitre, "type": l["type"],
            "enregistrement": {k: v for k, v in {
                "code": code.group(0) if code else l["source"], "source": l["source"],
                "titre": source and source["titre"], "fichier": source and source["fichier"],
                "par": source and source["par"], "drive_id": source and source["drive_id"],
                "transcription": source and source["transcription"], "note": source and source["notes"]}.items() if v},
            "coupes": coupes,
            "debut": coupes[0].split("–")[0] if coupes else "", "fin": coupes[-1].split("–")[-1] if coupes else "",
            "duree": l["duree"], "fichier": l["fichier"], "drive_id": l["drive_id"],
            "resume": l["resume"], "transcription": transcription, "note_transcription": l["note_transcription"],
            "personnes": liste(l["personnes"]), "lieux": liste(l["lieux"]), "divergences": liste(l["divergences"]),
            "notes": l["notes"], "note_montage": l["note_montage"], "statut": l["statut"],
        }
        if chemin_audio:
            extrait["audio"] = chemin_audio
        extraits.append({k: v for k, v in extrait.items() if v not in ("", [], None)})

    # Fichiers présents mais absents du catalogue
    if (prive / "audio").is_dir():
        connus = {l["fichier"] for l in cat}
        for f in sorted((prive / "audio").glob("*.mp3")):
            if f.name not in connus:
                alertes.append(f"{f.name} : présent dans prive/audio mais absent du catalogue")

    def cle(e):
        c = e.get("chapitre")
        return (1, 0, e["id"]) if c is None else (0, c["numero"], e["id"])
    extraits.sort(key=cle)
    donnees = {"modele": 2, "mode": "prive", "source": "prive/voix/catalogue.csv",
               "extraits": extraits, "exclusions": exclusions}

    par_type = {t: sum(1 for e in extraits if e["type"] == t) for t in TYPES}
    chapitres = sorted({e["chapitre"]["numero"] for e in extraits if e.get("chapitre")})
    infos.append(f"{len(extraits)} extraits retenus, {len(exclusions)} exclus ; "
                 + ", ".join(f"{v} {k}" for k, v in par_type.items() if v))
    infos.append(f"{len(chapitres)} chapitres ont au moins un extrait (prologue compté comme 0)")
    infos.append(f"{len(extraits) - len(a_transferer)} MP3 présents dans prive/audio, {len(a_transferer)} à transférer")

    rapport = ["# Contrôle du catalogue de la voix de Mamili", "",
               f"Fait le {datetime.date.today().strftime('%d/%m/%Y')} par outils/catalogue_voix.py.", ""]
    rapport += ["## Résumé", ""] + [f"- {x}" for x in infos] + [""]
    rapport += ["## Erreurs (bloquantes)", ""] + ([f"- {x}" for x in erreurs] or ["Aucune."]) + [""]
    rapport += ["## Points à vérifier", ""] + ([f"- {x}" for x in alertes] or ["Aucun."]) + [""]
    if a_transferer:
        rapport += ["## MP3 à transférer dans prive/audio", ""] + [f"- {x}" for x in a_transferer] + [""]
    (dossier / "rapport-controles.md").write_text("\n".join(rapport), encoding="utf-8")

    for x in infos:
        print(x)
    for x in erreurs:
        print("ERREUR :", x)
    print(f"{len(alertes)} point(s) à vérifier, détail dans {(dossier / 'rapport-controles.md').relative_to(prive.parent)}")
    if erreurs:
        sys.exit("Erreurs dans le catalogue : prive/voix.js n'a pas été modifié.")
    if not verifier_seulement:
        (prive / "voix.js").write_text(
            "/* La voix de Mamili : données privées, générées par outils/catalogue_voix.py. Ne pas publier. */\n"
            "window.VOIX = " + json.dumps(donnees, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
        print(f"Écrit : {(prive / 'voix.js').relative_to(prive.parent)}")


# ---------------------------------------------------------------- reprise de l'index Word

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def repertoire_index(docx):
    """Lignes du « Répertoire des extraits MP3 » de l'index Word : chapitre, titre, drive_id, source, coupes, durée."""
    z = zipfile.ZipFile(docx)
    x = z.read("word/document.xml").decode("utf-8")
    rels = dict(re.findall(r'Id="([^"]+)"[^>]*Target="([^"]+)"', z.read("word/_rels/document.xml.rels").decode("utf-8")))
    rels.update({a: b for b, a in re.findall(r'Target="([^"]+)"[^>]*Id="([^"]+)"', z.read("word/_rels/document.xml.rels").decode("utf-8"))})

    def texte(fragment):
        return html.unescape("".join(re.findall(r"<w:t(?:\s[^>]*)?>(.*?)</w:t>", fragment, re.S))).strip()

    lignes = []
    for tbl in re.findall(r"<w:tbl>.*?</w:tbl>", x, re.S):
        rangs = re.findall(r"<w:tr[ >].*?</w:tr>", tbl, re.S)
        if not rangs:
            continue
        entete = [texte(c) for c in re.findall(r"<w:tc>.*?</w:tc>", rangs[0], re.S)]
        if entete[:2] != ["Chapitre", "Extrait"]:
            continue
        for r in rangs[1:]:
            cellules = re.findall(r"<w:tc>.*?</w:tc>", r, re.S)
            if len(cellules) < 5:
                continue
            ids = [rels.get(rid, "") for rid in re.findall(r'<w:hyperlink[^>]*r:id="([^"]+)"', cellules[1])]
            drive = next((re.search(r"/d/([^/]+)", u).group(1) for u in ids if "/d/" in u), "")
            paragraphes = [texte(p) for p in re.findall(r"<w:p[ >].*?</w:p>", cellules[3], re.S)]
            coupes = [p for p in paragraphes if p] or [texte(cellules[3])]
            coupes = [c for p in coupes for c in re.findall(f"{TEMPS}\\s*[–-]\\s*{TEMPS}", p)]
            lignes.append({"chapitre": texte(cellules[0]), "titre": texte(cellules[1]), "drive_id": drive,
                           "source": texte(cellules[2]), "coupes": " + ".join(c.replace("-", "–") for c in coupes),
                           "duree": texte(cellules[4])})
    return lignes


def reprendre_index(prive, docx, appliquer):
    chemin = prive / "voix" / "catalogue.csv"
    cat = lire_csv(chemin)
    par_drive = {l["drive_id"]: l for l in cat if l["drive_id"]}
    index = repertoire_index(docx)
    if not index:
        sys.exit("Aucun tableau « Répertoire des extraits MP3 » trouvé dans ce document.")
    print(f"{len(index)} extraits dans le répertoire de l'index")
    changements, nouveaux = [], []
    for r in index:
        chap = {"Prologue": "0", "Hors livre": ""}.get(r["chapitre"], r["chapitre"])
        l = par_drive.get(r["drive_id"])
        if not l:
            nouveaux.append(r); continue
        if l["statut"] == "exclu" or l["note_montage"]:
            continue  # décisions de Samuel : on n'y touche pas
        for cle, val in (("titre", r["titre"]), ("chapitre", chap), ("coupes", r["coupes"]), ("duree", r["duree"]), ("source", r["source"])):
            if val and l[cle] != val:
                changements.append(f"{l['id']} : {cle} « {l[cle]} » → « {val} »")
                if appliquer:
                    l[cle] = val
    absents = [l["id"] for l in cat if l["drive_id"] not in {r["drive_id"] for r in index}]
    numero = max(int(re.sub(r"\D", "", l["id"]) or 0) for l in cat)
    for r in nouveaux:
        numero += 1
        chap = {"Prologue": "0", "Hors livre": ""}.get(r["chapitre"], r["chapitre"])
        print(f"Nouvel extrait : audio-{numero:03d} « {r['titre']} » (chapitre {r['chapitre']}, {r['source']})")
        if appliquer:
            cat.append({"id": f"audio-{numero:03d}", "statut": "monté", "titre": r["titre"], "chapitre": chap,
                        "type": "hors livre" if chap == "" else "livre", "source": r["source"], "coupes": r["coupes"],
                        "duree": r["duree"], "drive_id": r["drive_id"],
                        "notes": "Ajouté depuis l'index : type, fichier, résumé et transcription à compléter."})
    for c in changements:
        print("Changement :", c)
    if absents:
        print("Dans le catalogue mais plus dans l'index (non supprimés) :", ", ".join(absents))
    if appliquer and (changements or nouveaux):
        ecrire_csv(chemin, cat, CHAMPS)
        print(f"Catalogue mis à jour : {chemin.relative_to(prive.parent)}")
    elif changements or nouveaux:
        print("Rien n'a été modifié : relancer avec --appliquer pour reporter ces changements.")
    else:
        print("Le catalogue est à jour avec l'index.")


def main():
    p = argparse.ArgumentParser(description="Catalogue des extraits de la voix de Mamili.")
    p.add_argument("--prive", type=Path, default=RACINE / "prive")
    p.add_argument("--livre", type=Path, default=RACINE / "data" / "livre.json")
    p.add_argument("--verifier", action="store_true", help="contrôler sans écrire prive/voix.js")
    p.add_argument("--index", type=Path, help="index Word (.docx) dont reprendre le répertoire des MP3")
    p.add_argument("--appliquer", action="store_true", help="avec --index : reporter les changements dans le catalogue")
    a = p.parse_args()
    if a.index:
        reprendre_index(a.prive, a.index, a.appliquer)
    else:
        construire(a.prive, a.livre, a.verifier)


if __name__ == "__main__":
    main()

#!/bin/bash
# Import complet de la photothèque, sur le Mac de Samuel. Méthode : docs/import-photos.md.
#
# Se lance depuis le Terminal (bash outils/import-complet-mac.command) ou par double-clic.
# Le script vérifie tout avant d'importer et s'arrête au premier problème avec la solution.
#   FORCER=1      importe même si l'export depuis Photos semble encore en cours
#   SIMULATION=1  s'arrête après la simulation (rien n'est modifié)
#
# Il ne publie rien : prive/ reste sur l'ordinateur (ignoré par Git).

set -u
cd "$(dirname "$0")/.." || exit 1
RACINE="$(pwd)"
INTERACTIF=0; [ -t 0 ] && [ -t 1 ] && INTERACTIF=1

etape() { printf '\n== %s\n' "$1"; }
ok()    { printf '   ok : %s\n' "$1"; }
fin()   { if [ "$INTERACTIF" = 1 ]; then echo; read -n 1 -s -r -p "Appuyez sur une touche pour fermer cette fenêtre."; echo; fi; }
stop()  { printf '\nARRÊT : %s\n' "$1"; [ $# -gt 1 ] && printf 'Solution : %s\n' "$2"; fin; exit 1; }

# ------------------------------------------------------------------ 1. dépôt
etape "1. Dépôt"
[ -f outils/importer_photos.py ] || stop "outils/importer_photos.py introuvable dans $RACINE." \
  "lancer ce script depuis le clone du dépôt memoires-familiales.github.io."
if command -v git >/dev/null && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git check-ignore -q prive/photos.js || stop "prive/ n'est pas ignoré par Git : les données de la famille risqueraient d'être publiées." \
    "récupérer le .gitignore du dépôt (git pull) avant tout import."
  ok "clone $(basename "$RACINE"), prive/ ignoré par Git"
else
  ok "dossier du site (pas un clone Git : rien ne peut partir sur GitHub)"
fi

# ------------------------------------------------------------------ 2. Python
etape "2. Python et modules"
command -v python3 >/dev/null || stop "python3 introuvable." "installer les outils de développement : xcode-select --install"
python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)' || stop "Python 3.9 ou plus récent est nécessaire ($(python3 --version 2>&1))."
if ! python3 -c "import openpyxl, PIL" 2>/dev/null; then
  echo "   installation de openpyxl et Pillow (une seule fois)…"
  python3 -m pip install --user --quiet openpyxl pillow 2>&1 | tail -3
  python3 -c "import openpyxl, PIL" 2>/dev/null || stop "openpyxl ou Pillow manquent et l'installation a échoué." \
    "dans le Terminal (hors Codex, qui n'a pas le réseau dans son bac à sable) : python3 -m pip install --user openpyxl pillow"
fi
ok "$(python3 --version 2>&1), openpyxl et Pillow présents"

# ------------------------------------------------------------------ 3. Drive
etape "3. Google Drive"
DRIVE=""
for d in "$HOME"/Library/CloudStorage/GoogleDrive-*/"Mon Drive" "$HOME"/Library/CloudStorage/GoogleDrive-*/"My Drive"; do
  [ -d "$d" ] && { DRIVE="$d"; break; }
done
[ -n "$DRIVE" ] || stop "Google Drive pour ordinateur introuvable dans ~/Library/CloudStorage." \
  "ouvrir l'app Google Drive et attendre que « Mon Drive » apparaisse dans le Finder."
PHOTOTHEQUE="$DRIVE/03 - MEMOIRES MAMILI/02 - Site internet/04 - Photothèque - espace famille"
EXPORT="$PHOTOTHEQUE/EXPORT ALBUM ANCIENNES PHOTOS"
TABLEAU="$DRIVE/08 - NUMÉRISATION PHOTOS/TABLEAU"
[ -d "$PHOTOTHEQUE" ] || stop "dossier introuvable : $PHOTOTHEQUE"
[ -d "$EXPORT" ] || stop "dossier introuvable : $EXPORT" "exporter l'album depuis Photos dans ce dossier (voir docs/import-photos.md)."
[ -d "$TABLEAU" ] || stop "dossier introuvable : $TABLEAU"
ok "$DRIVE"

# ------------------------------------------------------------------ 4. prive/
etape "4. Dossier prive/ (réglages, correspondances de noms)"
KIT="$(ls -t "$PHOTOTHEQUE"/phototheque-prive-essai-*.zip 2>/dev/null | head -1)"
if [ ! -f prive/config-import.json ]; then
  [ -n "$KIT" ] || stop "prive/config-import.json absent et kit privé introuvable dans $PHOTOTHEQUE."
  unzip -o -q "$KIT" -d "$RACINE" || stop "décompression impossible : $KIT"
  ok "kit décompressé : $(basename "$KIT")"
fi
# Fichiers du kit qui manqueraient encore (correspondances de noms, sommaire du livre pour les chapitres)
for f in alias-personnes.csv livre.json livre.js; do
  if [ ! -f "prive/$f" ] && [ -n "$KIT" ] && unzip -l "$KIT" "prive/$f" >/dev/null 2>&1; then
    unzip -o -q "$KIT" "prive/$f" -d "$RACINE" && ok "prive/$f repris du kit"
  fi
done
[ -f prive/livre.json ] && ok "sommaire du livre présent (chapitres des photos)" \
  || echo "   ATTENTION : prive/livre.json absent, les fiches n'auront pas le chapitre du livre."
# Les chemins des réglages sont refaits à partir du Drive trouvé sur ce Mac, sauf si quelqu'un
# a déjà indiqué d'autres fichiers (un nouvel export des métadonnées, par exemple).
python3 - "$DRIVE" <<'EOF' || stop "réglages invalides dans prive/config-import.json." "corriger les chemins signalés ci-dessus, ou supprimer le fichier pour le recréer."
import json, sys
from pathlib import Path
drive = Path(sys.argv[1])
tab = drive / "08 - NUMÉRISATION PHOTOS" / "TABLEAU"
attendus = {
    "photos": str(tab / "Export_Photos_avec_miniatures_2026-09-30_22-11-12 - Album complet.xlsx"),
    "complements": str(tab / "TABLEAU - PHOTOS ANCIENNES 3.xlsx"),
    "referentiel": [str(tab / "REFERENTIEL - IDENTITES PERSONNES PHOTOS ANCIENNES.xlsx")],
    "images": str(drive / "03 - MEMOIRES MAMILI" / "02 - Site internet" / "04 - Photothèque - espace famille"
                  / "EXPORT ALBUM ANCIENNES PHOTOS"),
}
fichier = Path("prive/config-import.json")
reglages = json.loads(fichier.read_text(encoding="utf-8")) if fichier.exists() else {}
modifie = False
for cle, valeur in attendus.items():
    actuel = reglages.get(cle)
    chemins = actuel if isinstance(actuel, list) else [actuel] if actuel else []
    if not chemins or not all(Path(c).expanduser().exists() for c in chemins):
        reglages[cle] = valeur
        modifie = True
manquants = []
for cle in ("photos", "complements", "referentiel", "images"):
    v = reglages[cle]
    for c in (v if isinstance(v, list) else [v]):
        if not Path(c).expanduser().exists():
            manquants.append(f"{cle} : {c}")
if modifie:
    fichier.parent.mkdir(exist_ok=True)
    fichier.write_text(json.dumps(reglages, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("   réglages écrits dans prive/config-import.json")
if manquants:
    print("   fichiers introuvables :\n     " + "\n     ".join(manquants))
    sys.exit(1)
print("   ok : les quatre fichiers d'entrée sont trouvés")
EOF

# ------------------------------------------------------------------ 5. export
etape "5. Export de l'album"
compter() { find "$EXPORT" -maxdepth 1 -type f ! -name '.*' | wc -l | tr -d ' '; }
N1="$(compter)"; sleep 20; N2="$(compter)"
echo "   $N2 images dans « EXPORT ALBUM ANCIENNES PHOTOS »"
if [ "$N1" != "$N2" ] && [ "${FORCER:-0}" != 1 ]; then
  stop "l'export depuis Photos est encore en cours ($N1 puis $N2 fichiers en 20 s)." \
    "attendre la fin de l'export, puis relancer. Pour importer quand même : FORCER=1 bash outils/import-complet-mac.command"
fi
# Les fichiers restés dans le nuage sont téléchargés à la lecture ; un essai sur trois d'entre eux.
python3 - "$EXPORT" <<'EOF' || stop "les images du Drive ne se lisent pas depuis ce programme." "dans le Finder, clic droit sur « EXPORT ALBUM ANCIENNES PHOTOS » → Disponible hors connexion, attendre la fin du téléchargement, puis relancer (si c'est Codex qui lance le script : l'autoriser à lire ~/Library/CloudStorage)."
import sys, time
from pathlib import Path
fichiers = sorted(f for f in Path(sys.argv[1]).iterdir() if f.is_file() and not f.name.startswith("."))
for f in (fichiers[:1] + fichiers[len(fichiers) // 2:len(fichiers) // 2 + 1] + fichiers[-1:]):
    t = time.time()
    with f.open("rb") as h:
        debut = h.read(3); h.seek(0, 2)
    if debut != b"\xff\xd8\xff":
        print(f"   {f.name} n'est pas un JPEG lisible"); sys.exit(1)
    print(f"   lu : {f.name} ({time.time() - t:.1f} s)")
EOF

# ------------------------------------------------------------------ 6. simulation
etape "6. Simulation (rien n'est modifié)"
python3 outils/importer_photos.py --simulation || stop "la simulation a échoué (message ci-dessus)."
RAPPORT="$(ls -t prive/rapports/import-*.md | head -1)"
sed -n '3,14p' "$RAPPORT"
[ "${SIMULATION:-0}" = 1 ] && { echo; echo "Simulation seule demandée : arrêt ici. Rapport : $RAPPORT"; fin; exit 0; }

# ------------------------------------------------------------------ 7. import
etape "7. Import (miniatures et versions web : quelques minutes)"
debut=$(date +%s)
python3 outils/importer_photos.py || stop "l'import a échoué (message ci-dessus)." "rien n'est perdu : la version précédente est dans prive/historique/."
RAPPORT="$(ls -t prive/rapports/import-*.md | head -1)"
echo "   durée : $(( $(date +%s) - debut )) s ; rapport : $RAPPORT"

# ------------------------------------------------------------------ 8. contrôles
etape "8. Contrôles"
SECOND="$(python3 outils/importer_photos.py 2>&1)"
echo "$SECOND" | tail -2
echo "$SECOND" | grep -q "Aucun changement" && ok "second passage sans changement (import idempotent)" \
  || echo "   ATTENTION : le second passage a encore modifié des fiches ; transmettre le rapport à Claude."
grep -E "^- (Photos dans|Images|Conflits|Noms de personnes)" "$RAPPORT"
python3 - <<'EOF'
import json
d = json.load(open("prive/photos.json", encoding="utf-8"))
photos = [p for p in d["photos"] if not p.get("retiree")]
illustrees = sum(1 for p in photos if p.get("images"))
print(f"   {illustrees} photos illustrées sur {len(photos)} fiches")
EOF
echo "   images fabriquées : $(find prive/images/web -type f | wc -l | tr -d ' ') versions web, $(du -sh prive/images | cut -f1) au total"

etape "Terminé"
echo "Photothèque : $RACINE/phototheque/index.html"
echo "Rapport     : $RACINE/$RAPPORT"
echo "Rien n'a été publié. Transmettre le rapport à Samuel et à Claude pour les finitions."
if [ "$INTERACTIF" = 1 ] && command -v open >/dev/null; then open phototheque/index.html; open "$RAPPORT"; fi
fin

#!/bin/bash
# Double-cliquer sur ce fichier (Mac) pour mettre à jour la photothèque privée
# puis l'ouvrir dans le navigateur. Les chemins des fichiers sont lus dans
# prive/config-import.json (créé au premier lancement).
cd "$(dirname "$0")/.." || exit 1
if ! python3 -c "import openpyxl, PIL" 2>/dev/null; then
  echo "Installation des modules nécessaires (une seule fois)…"
  python3 -m pip install --user openpyxl pillow || exit 1
fi
python3 outils/importer_photos.py "$@"
statut=$?
if [ $statut -eq 0 ]; then
  open phototheque/index.html
  dernier=$(ls -t prive/rapports/import-*.md 2>/dev/null | head -1)
  [ -n "$dernier" ] && open "$dernier"
else
  open prive/config-import.json 2>/dev/null
fi
echo
read -n 1 -s -r -p "Appuyez sur une touche pour fermer cette fenêtre."

/* Les archives : documents classés par type, avec recherche. */
(function () {
  "use strict";
  var S = window.SITE, el = S.el;
  var archives = window.ARCHIVES || { documents: [], types: {} };
  var documents = archives.documents || [];
  var types = archives.types || {};
  var typeChoisi = "";

  S.avis(archives, "Ces documents sont des exemples fictifs : ils montrent comment la page sera organisée. Les archives de la famille seront réservées à la famille.");

  // Pictogrammes dessinés (pas de données dedans)
  var PICTOS = {
    acte: '<rect x="14" y="8" width="36" height="48" rx="2"/><path d="M21 20h22M21 27h22M21 34h22M21 41h14"/><circle cx="41" cy="46" r="4"/>',
    lettre: '<rect x="8" y="16" width="48" height="32" rx="2"/><path d="M8 18l24 18 24-18"/>',
    papier: '<rect x="16" y="8" width="32" height="48" rx="3"/><path d="M16 16h32M24 28h16M24 34h16"/>',
    article: '<rect x="8" y="10" width="48" height="44" rx="2"/><path d="M14 18h36M14 26h16M14 32h16M14 38h16M14 44h16M36 26h14v18H36z"/>',
    carte: '<path d="M8 16l14-6 20 6 14-6v38l-14 6-20-6-14 6z"/><path d="M22 10v38M42 16v38"/>'
  };
  function picto(type) {
    var svg = '<svg viewBox="0 0 64 64" fill="none" stroke="#7a5a3c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (PICTOS[type] || PICTOS.papier) + "</svg>";
    var d = el("div", { classe: "document__visuel" });
    d.innerHTML = svg;
    return d;
  }

  documents.forEach(function (d) {
    d._texte = S.normaliser([d.titre, d.date && d.date.libelle, d.lieu, (d.personnes || []).join(" "), d.source, d.description,
      types[d.type], d.chapitre && d.chapitre.titre].join(" "));
  });

  function carte(d) {
    var visuel = d.apercu ? el("div", { classe: "document__visuel" }, [el("img", { src: S.racine + d.apercu, alt: "", loading: "lazy" })]) : picto(d.type);
    var details = [
      d.description ? el("p", { texte: d.description }) : null,
      (d.personnes || []).length ? el("p", { texte: "Personnes : " + d.personnes.join(", ") }) : null,
      d.source ? el("p", { texte: "Source : " + d.source }) : null,
      d.chapitre ? el("p", null, ["Dans le livre : ", el("a", { href: S.racine + "livre/index.html#chapitre-" + d.chapitre.numero, texte: "Chapitre " + d.chapitre.numero + ". " + d.chapitre.titre })]) : null,
      d.droits ? el("p", { classe: "discret", texte: "Diffusion : " + d.droits }) : null,
      d.fichier ? el("p", null, [el("a", { href: S.racine + d.fichier, texte: "Ouvrir le document" })]) : null
    ];
    return el("li", null, [el("article", { classe: "document", id: d.id }, [
      visuel,
      el("div", { classe: "document__texte" }, [
        el("span", { classe: "etiquette", texte: types[d.type] || "Document" }),
        el("h3", { texte: d.titre }),
        el("p", { classe: "meta", texte: [d.date && d.date.libelle, d.lieu].filter(Boolean).join(", ") }),
        el("details", null, [el("summary", { texte: "Détails" })].concat(details))
      ])
    ])]);
  }

  function rendreTypes(compte) {
    var zone = document.getElementById("choix-type");
    zone.textContent = "";
    [["", "Tous"]].concat(Object.keys(types).map(function (k) { return [k, types[k]]; })).forEach(function (t) {
      var n = t[0] ? (compte[t[0]] || 0) : documents.length;
      if (t[0] && !n) return;
      var b = el("button", { type: "button", "aria-pressed": String(typeChoisi === t[0]), texte: t[1] + " (" + n + ")" });
      b.addEventListener("click", function () { typeChoisi = t[0]; rendre(); });
      zone.appendChild(b);
    });
  }

  function rendre() {
    var mots = S.normaliser(document.getElementById("q-archives").value).split(/\s+/).filter(Boolean);
    var parMots = documents.filter(function (d) { return mots.every(function (m) { return d._texte.indexOf(m) !== -1; }); });
    var compte = {};
    parMots.forEach(function (d) { compte[d.type] = (compte[d.type] || 0) + 1; });
    var choisis = parMots.filter(function (d) { return !typeChoisi || d.type === typeChoisi; })
      .sort(function (a, b) { return ((a.date && a.date.annee) || 9999) - ((b.date && b.date.annee) || 9999); });
    rendreTypes(compte);
    var grille = document.getElementById("documents");
    grille.textContent = "";
    choisis.forEach(function (d) { grille.appendChild(carte(d)); });
    document.getElementById("compte-archives").textContent = choisis.length
      ? S.pluriel(choisis.length, "document", "documents")
      : "Aucun document ne correspond.";
  }

  var minuterie;
  document.getElementById("q-archives").addEventListener("input", function () {
    clearTimeout(minuterie);
    minuterie = setTimeout(rendre, 150);
  });
  rendre();
})();

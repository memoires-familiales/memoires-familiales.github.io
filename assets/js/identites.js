/* Noms d’affichage et variantes des personnes de l’arbre familial. */
(function () {
  "use strict";

  var S = window.SITE;
  var arbre = window.ARBRE || {};
  var choix = arbre.mode === "demo" ? {} : window.NOMS_FAMILLE || {};
  var generiques = new Set(["mamie", "meme", "pepe", "pepere", "papi", "maman", "papa", "tata", "tonton"]);
  var parId = new Map();
  var titulaires = new Map();

  function cle(texte) {
    return S.normaliser(texte).replace(/[’']/g, " ").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  }

  function nomArbre(p) {
    return [p.prenoms, p.nom_usage || p.nom].filter(Boolean).join(" ");
  }

  // Même en l’absence d’arbre, les appellations confirmées restent utilisables.
  var personnes = new Map((arbre.personnes || []).map(function (p) { return [p.id, p]; }));
  Object.keys(choix).forEach(function (id) {
    if (!personnes.has(id)) personnes.set(id, { id: id });
  });
  personnes.forEach(function (p) {
    var confirme = choix[p.id] || {};
    var nom = confirme.nom || nomArbre(p);
    if (!nom) return;
    var variantes = [nom, nomArbre(p), p.nom && [p.prenoms, p.nom].filter(Boolean).join(" "),
      ...(p.surnom || "").split("/"), ...(p.photos || []), ...(confirme.alias || [])];
    var noms = new Map();
    variantes.forEach(function (v) {
      var k = cle(v);
      if (!k || generiques.has(k) || noms.has(k)) return;
      noms.set(k, v.trim());
      if (!titulaires.has(k)) titulaires.set(k, []);
      titulaires.get(k).push(p.id);
    });
    parId.set(p.id, { nom: nom, noms: noms });
  });

  function trouver(nom) {
    var ids = titulaires.get(cle(nom));
    return ids?.length === 1 ? parId.get(ids[0]) : null;
  }

  function variantes(p) {
    return Array.from(p.noms).filter(function ([k]) { return titulaires.get(k).length === 1; })
      .map(function (entrée) { return entrée[1]; });
  }

  function nomRetenu(nom) { return trouver(nom)?.nom || nom; }

  function nomsRetenus(noms) {
    return Array.from(new Set((noms || []).filter(Boolean).map(nomRetenu)));
  }

  function appellations(nom) {
    var p = trouver(nom);
    return p ? variantes(p) : [nom];
  }

  function associerSuggestions(champ, noms) {
    if (!champ) return;
    var catalogue = noms ? nomsRetenus(noms) : Array.from(parId.values()).map(function (p) { return p.nom; });
    var liste = document.createElement("datalist");
    liste.id = champ.id + "-identites";
    champ.setAttribute("list", liste.id);
    champ.after(liste);
    champ.addEventListener("input", function () {
      var question = cle(champ.value);
      liste.replaceChildren();
      if (question.length < 2) return;
      var mots = question.split(" ");
      catalogue.filter(function (nom) {
        return appellations(nom).some(function (v) {
          var fragments = cle(v).split(" ");
          return mots.every(function (m) { return fragments.some(function (f) { return f.startsWith(m); }); });
        });
      }).slice(0, 10).forEach(function (nom) {
        liste.appendChild(S.el("option", { value: nom, label: appellations(nom).slice(1).join(" · ") }));
      });
    });
  }

  window.IDENTITES = {
    nom: nomRetenu,
    noms: nomsRetenus,
    nomDe: function (p) { return parId.get(p.id)?.nom || nomArbre(p); },
    variantes: appellations,
    groupes: Array.from(parId.values()).map(variantes),
    suggestions: associerSuggestions
  };
})();

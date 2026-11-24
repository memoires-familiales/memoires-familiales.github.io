/* L'arbre généalogique : une personne au centre, ses parents, son conjoint, ses enfants. */
(function () {
  "use strict";
  var S = window.SITE, el = S.el;
  var arbre = window.ARBRE || { personnes: [] };
  var personnes = arbre.personnes || [];
  var parId = {};
  personnes.forEach(function (p) { parId[p.id] = p; });

  S.avis(arbre, "Cet arbre est un exemple fictif : il montre comment la page sera organisée. L'arbre de la famille sera réservé à la famille.");
  if (!personnes.length && arbre.mode === "prive") {
    var avisVide = document.getElementById("avis");
    if (avisVide) { avisVide.hidden = false; avisVide.textContent = "L'arbre de la famille est en cours d'intégration."; }
    return;
  }

  // Nombre de photos par personne (seulement si l'arbre et la phototheque sont de même nature)
  var phototheque = window.PHOTOTHEQUE || {};
  var nbPhotos = {};
  if (S.memeNature(phototheque, arbre)) {
    (phototheque.photos || []).forEach(function (ph) {
      if (ph.retiree) return;
      (ph.personnes || []).forEach(function (n) { nbPhotos[n] = (nbPhotos[n] || 0) + 1; });
    });
  }

  function nom(p) { return [p.prenoms, p.nom_usage || p.nom].filter(Boolean).join(" "); }
  function naissanceNom(p) {
    if (!p.nom_usage || p.nom_usage === p.nom) return "";
    return (p.sexe === "M" ? "né " : p.sexe === "F" ? "née " : "né(e) ") + p.nom;
  }
  function annee(evt) {
    if (!evt || !evt.date) return "";
    var m = String(evt.date).match(/(vers\s+)?(\d{4})/i);
    return m ? (m[1] ? "vers " : "") + m[2] : "";
  }
  function dates(p) {
    if (p.vivant) return "";
    var n = annee(p.naissance), d = annee(p.deces);
    if (!n && !d) return "";
    return (n || "?") + (d ? " – " + d : "");
  }
  function enfants(p) {
    return personnes.filter(function (q) { return (q.parents || []).indexOf(p.id) !== -1; });
  }
  function conjoints(p) {
    var ids = (p.conjoints || []).slice();
    personnes.forEach(function (q) { if ((q.conjoints || []).indexOf(p.id) !== -1 && ids.indexOf(q.id) === -1) ids.push(q.id); });
    return ids.map(function (id) { return parId[id]; }).filter(Boolean);
  }
  function fratrie(p) {
    if (!(p.parents || []).length) return [];
    return personnes.filter(function (q) {
      return q.id !== p.id && (q.parents || []).some(function (x) { return p.parents.indexOf(x) !== -1; });
    });
  }

  function carte(p, centre) {
    var contenu = [nom(p), el("small", { texte: [naissanceNom(p), dates(p)].filter(Boolean).join(", ") || " " })];
    if (centre) return el("div", { classe: "carte-personne carte-personne--centre", "aria-current": "true" }, contenu);
    var b = el("button", { type: "button", classe: "carte-personne", "aria-label": "Voir la fiche de " + nom(p) }, contenu);
    b.addEventListener("click", function () { afficher(p.id, true); });
    return b;
  }

  function rang(titre, cartes, vide) {
    var r = el("div", { classe: "rang" }, titre ? [el("span", { classe: "rang__titre", texte: titre })] : []);
    if (!cartes.length && vide) r.appendChild(el("div", { classe: "carte-personne carte-personne--vide", texte: vide }));
    cartes.forEach(function (c) { r.appendChild(c); });
    return r;
  }

  function ligneFiche(dl, titre, contenu) {
    if (contenu == null || contenu === "" || (Array.isArray(contenu) && !contenu.length)) return;
    dl.appendChild(el("dt", { texte: titre }));
    dl.appendChild(typeof contenu === "string" ? el("dd", { texte: contenu }) : el("dd", null, [].concat(contenu)));
  }

  function evenement(e) {
    if (!e) return "";
    return [e.date, e.lieu ? (e.date ? "à " : "") + e.lieu : ""].filter(Boolean).join(" ");
  }

  function afficher(id, deplacer) {
    var p = parId[id] || parId[arbre.racine] || personnes[0];
    if (!p) {
      document.getElementById("famille").appendChild(el("p", { classe: "vide-rubrique", texte: "L'arbre n'est pas encore disponible." }));
      return;
    }

    var famille = document.getElementById("famille");
    famille.textContent = "";
    var parents = (p.parents || []).map(function (x) { return parId[x]; }).filter(Boolean);
    famille.appendChild(rang("Parents", parents.map(function (q) { return carte(q); }), "Parents à compléter"));
    var centre = [carte(p, true)];
    conjoints(p).forEach(function (c) { centre.push(el("span", { classe: "lien-union", texte: "avec" })); centre.push(carte(c)); });
    famille.appendChild(rang("", centre));
    var enf = enfants(p);
    if (enf.length) famille.appendChild(rang("Enfants", enf.map(function (q) { return carte(q); })));

    var fiche = document.getElementById("fiche-personne");
    fiche.textContent = "";
    fiche.appendChild(el("h2", { texte: nom(p) + (p.surnom ? " (" + p.surnom + ")" : "") }));
    var sous = [naissanceNom(p), dates(p)].filter(Boolean).join(", ");
    if (sous) fiche.appendChild(el("p", { classe: "sous-nom", texte: sous }));
    var dl = el("dl");
    if (p.vivant) {
      ligneFiche(dl, "Dates", "Personne vivante : ses dates ne sont pas affichées.");
      if (p.naissance && p.naissance.lieu) ligneFiche(dl, "Naissance", "à " + p.naissance.lieu);
    } else {
      ligneFiche(dl, "Naissance", evenement(p.naissance));
      ligneFiche(dl, "Décès", evenement(p.deces));
    }
    var fr = fratrie(p);
    ligneFiche(dl, fr.length > 1 ? "Frères et sœurs" : "Frère ou sœur", fr.map(function (q, i) {
      var b = el("button", { type: "button", classe: "lien-effacer", texte: nom(q) });
      b.addEventListener("click", function () { afficher(q.id, true); });
      return b;
    }));
    ligneFiche(dl, "Sa vie", p.bio);
    ligneFiche(dl, "Sources", (p.sources || []).join(" ; "));
    if (p.certitude) ligneFiche(dl, "Fiabilité", el("span", { classe: "etiquette" + (p.certitude === "confirmé" ? " etiquette--prete" : ""), texte: p.certitude === "confirmé" ? "Confirmé par des documents" : "À vérifier" }));
    var appellation = (p.photos || [])[0];
    if (appellation) {
      var n = nbPhotos[appellation] || 0;
      ligneFiche(dl, "Photos", el("a", { href: S.lienPhotos({ p: appellation }), texte: n ? "Voir ses " + S.pluriel(n, "photo", "photos") : "Chercher ses photos" }));
    }
    fiche.appendChild(dl);

    document.querySelectorAll("#liste-personnes button").forEach(function (b) {
      if (b.getAttribute("data-id") === p.id) b.setAttribute("aria-current", "true");
      else b.removeAttribute("aria-current");
    });
    try { history.replaceState(null, "", location.pathname + location.search + "#" + p.id); } catch (e) { /* cadre restreint */ }
    if (deplacer) document.getElementById("famille").scrollIntoView({ block: "nearest" });
  }

  // Liste de toutes les personnes
  var liste = document.getElementById("liste-personnes");
  var tri = personnes.slice().sort(function (a, b) {
    return (a.nom_usage || a.nom).localeCompare(b.nom_usage || b.nom, "fr") || a.prenoms.localeCompare(b.prenoms, "fr");
  });
  tri.forEach(function (p) {
    p._texte = S.normaliser([p.prenoms, p.nom, p.nom_usage, p.surnom, (p.photos || []).join(" ")].join(" "));
    var b = el("button", { type: "button", "data-id": p.id }, [nom(p), el("small", { texte: [p.surnom, dates(p)].filter(Boolean).join(", ") || " " })]);
    b.addEventListener("click", function () {
      afficher(p.id, true);
      if (window.matchMedia("(max-width: 52rem)").matches) document.getElementById("index-personnes").open = false;
    });
    liste.appendChild(el("li", { "data-texte": p._texte }, [b]));
  });

  document.getElementById("q-personne").addEventListener("input", function () {
    var mots = S.normaliser(this.value).split(/\s+/).filter(Boolean);
    liste.querySelectorAll("li").forEach(function (li) {
      var t = li.getAttribute("data-texte");
      li.hidden = !mots.every(function (m) { return t.indexOf(m) !== -1; });
    });
  });

  if (window.matchMedia("(max-width: 52rem)").matches) document.getElementById("index-personnes").open = false;
  afficher(location.hash.length > 1 ? decodeURIComponent(location.hash.slice(1)) : arbre.racine, false);
  window.addEventListener("hashchange", function () {
    if (location.hash.length > 1) afficher(decodeURIComponent(location.hash.slice(1)), true);
  });
})();

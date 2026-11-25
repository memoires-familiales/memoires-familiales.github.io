/* Recherche dans les catalogues déjà autorisés pour l’espace famille. */
(function () {
  "use strict";

  var S = window.SITE, el = S.el;
  var champ = document.getElementById("termes");
  var filtre = document.getElementById("type-contenu");
  var etat = document.getElementById("etat-recherche");
  var zone = document.getElementById("resultats-recherche");
  if (!champ || (!S.espaceFamille && location.protocol !== "file:")) return;

  var RUBRIQUES = {
    livre: "Le livre", phototheque: "Photothèque", voix: "La voix de Mamili",
    arbre: "Arbre généalogique", archives: "Archives", films: "Films"
  };
  var catalogues = [window.LIVRE, window.PHOTOTHEQUE, window.VOIX, window.ARBRE,
    window.ARCHIVES, window.FILMS, window.RECHERCHE_COMPLEMENTS];
  var enDemo = !S.espaceFamille && !catalogues.some(function (d) { return d && S.memeNature(d, { mode: "prive" }); });
  var entrées = [];
  var vocabulaire = new Set();

  function catalogue(d) {
    return d && (enDemo ? d.mode === "demo" : S.memeNature(d, { mode: "prive" })) ? d : {};
  }

  function joindre(valeurs, séparateur) {
    return valeurs.flat(Infinity).filter(function (v) { return typeof v === "number" || typeof v === "string" && v.trim(); })
      .join(séparateur).replace(/\s+/g, " ").trim();
  }

  function mots(texte) {
    return Array.from(texte.matchAll(/[\p{L}\p{N}][\p{L}\p{M}\p{N}]*/gu), function (m) {
      return { mot: S.normaliser(m[0]).replace(/œ/g, "oe").replace(/æ/g, "ae"), début: m.index, fin: m.index + m[0].length };
    });
  }

  function termes(texte) {
    return mots(texte).map(function (m) { return m.mot; });
  }

  function ajouter(type, id, titre, métadonnées, texte, lien) {
    if (id == null || id === "" || !titre) return;
    var meta = joindre(métadonnées, " · ");
    var long = joindre([texte], " — ");
    var champs = [titre, meta, long];
    var relevé = new Map();
    var phrases = champs.map(function (texte, i) {
      var liste = termes(texte);
      liste.forEach(function (mot) {
        vocabulaire.add(mot);
        if (!relevé.has(mot)) relevé.set(mot, 3 - i);
      });
      return " " + liste.join(" ") + " ";
    });
    entrées.push({ type: type, titre: titre, meta: meta, texte: long, phrases: phrases, mots: relevé,
      lien: S.racine + (lien || type + "/index.html#" + encodeURIComponent(id)) });
  }

  function date(d) { return d && (d.libelle || d.annee); }
  function chapitre(c) { return c && joindre([c.numero != null && "Chapitre " + c.numero, c.titre], " — "); }
  function pageImprimée(n) { return n ? "Page imprimée " + n : ""; }
  function nom(p) { return joindre([p.prenoms, p.nom_usage || p.nom], " "); }

  var livre = catalogue(window.LIVRE);
  (livre.liminaires || []).forEach(function (l, i) {
    ajouter("livre", S.normaliser(l.titre) === "prologue" ? "chapitre-0" : "liminaire-" + (i + 1),
      l.titre, [pageImprimée(l.page)], l.texte);
  });
  (livre.parties || []).forEach(function (p) {
    ajouter("livre", "partie-" + p.numero, p.titre, ["Partie " + p.numero, p.annees, pageImprimée(p.page)], p.texte);
    (p.chapitres || []).forEach(function (c) {
      ajouter("livre", "chapitre-" + c.numero, c.titre,
        ["Chapitre " + c.numero, p.titre, c.annees, pageImprimée(c.page)], c.texte);
    });
  });
  (livre.annexes || []).forEach(function (a, i) {
    ajouter("livre", "annexe-" + (i + 1), a.titre, [pageImprimée(a.page)], a.texte);
  });

  var compléments = catalogue(window.RECHERCHE_COMPLEMENTS);
  var pages = (compléments.pages || []).filter(function (p) {
    return Number.isInteger(p.page) && p.page > 0 && typeof p.texte === "string" && p.texte.trim();
  });
  pages.forEach(function (p) {
    ajouter("livre", p.page, p.page_imprimee ? "Page " + p.page_imprimee + " du livre" : "Page " + p.page + " du PDF",
      [], p.texte, "prive/livre.pdf#page=" + p.page);
  });

  (catalogue(window.PHOTOTHEQUE).photos || []).forEach(function (p) {
    if (p.retiree) return;
    var lieu = p.lieu || {};
    ajouter("phototheque", p.numero || p.id, p.titre || p.evenement || ("Photo " + (p.numero || "")),
      [p.numero, date(p.date), lieu.precis, lieu.ville, lieu.pays, p.evenement, p.personnes, p.chapitre],
      [p.legende, p.notes !== p.legende && p.notes, p.autres_mentions, p.mots_cles, p.provenance, p.type]);
  });

  (catalogue(window.VOIX).extraits || []).forEach(function (v) {
    if (v.statut === "exclu") return;
    ajouter("voix", v.id, v.titre, [chapitre(v.chapitre), v.personnes, v.lieux, v.type], [v.transcription, v.resume]);
  });

  var personnes = catalogue(window.ARBRE).personnes || [];
  personnes.forEach(function (p) {
    var naissance = p.naissance || {}, décès = p.deces || {};
    var dates = p.vivant === false ? [naissance.date, décès.date, décès.lieu] : [];
    var nomNaissance = p.nom_usage && p.nom_usage !== p.nom ? joindre([p.prenoms, p.nom], " ") : "";
    ajouter("arbre", p.id, nom(p), [nomNaissance, p.surnom, naissance.lieu, dates], [p.bio, p.sources, p.photos]);
  });

  var archives = catalogue(window.ARCHIVES);
  (archives.documents || []).forEach(function (d) {
    ajouter("archives", d.id, d.titre, [(archives.types || {})[d.type], date(d.date), d.lieu, d.personnes, chapitre(d.chapitre)],
      [d.description, d.source, d.transcription]);
  });

  (catalogue(window.FILMS).films || []).forEach(function (f) {
    ajouter("films", f.id, f.titre, [date(f.date), f.lieu, f.personnes, chapitre(f.chapitre), f.support],
      [f.description, (f.sequences || []).map(function (s) { return joindre([s.debut, s.titre], " "); })]);
  });

  // On rapproche seulement les appellations précises et sans homonyme connu.
  var noms = new Map();
  var groupesPersonnes = personnes.map(function (p) {
    var groupe = new Set([
      nom(p), joindre([p.prenoms, p.nom], " "), p.surnom
    ].concat(p.photos || []).filter(Boolean).map(function (n) { return termes(n).join(" "); }));
    groupe.forEach(function (n) { noms.set(n, (noms.get(n) || 0) + 1); });
    return groupe;
  });
  var alias = new Map();
  function ajouterAlias(groupe) {
    if (groupe.length < 2) return;
    groupe.forEach(function (a) { alias.set(a, new Set([...(alias.get(a) || []), ...groupe])); });
  }
  groupesPersonnes.forEach(function (groupe) {
    ajouterAlias(Array.from(groupe).filter(function (n) { return n.includes(" ") && noms.get(n) === 1; }));
  });
  (compléments.alias || []).filter(Array.isArray).forEach(function (g) {
    ajouterAlias(Array.from(new Set(g.filter(function (a) { return typeof a === "string"; })
      .map(function (a) { return termes(a).join(" "); }).filter(Boolean))));
  });

  var MOTS_COURANTS = new Set(["a", "au", "aux", "d", "de", "des", "du", "en", "et", "l", "la", "le", "les", "un", "une"]);

  function critères(requête) {
    var liste = termes(requête);
    var groupes = [];
    for (var i = 0; i < liste.length;) {
      var fin = liste.length;
      while (fin > i && !alias.has(liste.slice(i, fin).join(" "))) fin--;
      if (fin > i) {
        var expression = liste.slice(i, fin).join(" ");
        groupes.push({ mot: expression, alias: Array.from(alias.get(expression)), terme: fin === i + 1 });
        i = fin;
      } else {
        var mot = liste[i++];
        if (!MOTS_COURANTS.has(mot) && mot.length >= 2) groupes.push({ mot: mot, alias: [], terme: true });
      }
    }
    return Array.from(new Map(groupes.map(function (g) { return [g.mot, g]; })).values());
  }

  function radical(mot) { return mot.length > 3 ? mot.replace(/[sx]$/, "") : mot; }

  // Une insertion, une suppression, un remplacement ou deux lettres inversées.
  function fauteSimple(a, b) {
    if (a.length > b.length) return fauteSimple(b, a);
    var écart = b.length - a.length;
    if (écart > 1) return false;
    var i = 0;
    while (i < a.length && a[i] === b[i]) i++;
    if (écart === 1) return a.slice(i) === b.slice(i + 1);
    return a.slice(i + 1) === b.slice(i + 1) ||
      (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2));
  }

  function variantes(groupe, tolérer) {
    var mot = groupe.mot;
    var valeurs = new Map([[mot, 6]]);
    if (!groupe.terme || /[0-9]/.test(mot)) return valeurs;
    vocabulaire.forEach(function (v) {
      if (v === mot) return;
      if (radical(v) === radical(mot)) valeurs.set(v, 5);
      else if (mot.length >= 3 && v.startsWith(mot)) valeurs.set(v, 3);
      else if (tolérer && mot.length >= 5 && /^\p{L}+$/u.test(v) && fauteSimple(mot, v)) valeurs.set(v, 1);
    });
    return valeurs;
  }

  function chercher(groupes, tolérer) {
    var choix = groupes.map(function (g) { return variantes(g, tolérer); });
    var résultats = [];
    entrées.forEach(function (entrée) {
      var note = 0;
      var termesTrouvés = new Map();
      for (var i = 0; i < groupes.length; i++) {
        var groupe = groupes[i];
        var meilleur = 0;
        choix[i].forEach(function (poids, mot) {
          var champ = entrée.mots.get(mot);
          if (champ) {
            meilleur = Math.max(meilleur, champ * poids);
            termesTrouvés.set(mot, poids);
          }
        });
        groupe.alias.forEach(function (a) {
          var champ = entrée.phrases.findIndex(function (p) { return p.includes(" " + a + " "); });
          if (champ < 0) return;
          var poids = a === groupe.mot ? 6 : 4;
          meilleur = Math.max(meilleur, (3 - champ) * poids);
          a.split(" ").forEach(function (m) { termesTrouvés.set(m, poids); });
        });
        if (!meilleur) return;
        note += meilleur;
      }
      résultats.push({ entrée: entrée, note: note, termes: termesTrouvés });
    });
    return résultats.sort(function (a, b) { return b.note - a.note || a.entrée.titre.localeCompare(b.entrée.titre, "fr", { numeric: true }); });
  }

  function texteMarqué(texte, repères, début, fin) {
    var nœuds = [];
    var curseur = début;
    repères.forEach(function (r) {
      if (r.début < début || r.fin > fin) return;
      nœuds.push(texte.slice(curseur, r.début), el("mark", { texte: texte.slice(r.début, r.fin) }));
      curseur = r.fin;
    });
    nœuds.push(texte.slice(curseur, fin));
    return nœuds;
  }

  function aperçu(r) {
    var texte = r.entrée.texte;
    if (!texte) return null;
    var liste = mots(texte);
    var repères = liste.filter(function (m) { return r.termes.has(m.mot); });
    var premier = repères.reduce(function (précédent, courant) {
      return !précédent || r.termes.get(courant.mot) > r.termes.get(précédent.mot) ? courant : précédent;
    }, null);
    var début = premier ? Math.max(0, premier.début - 65) : 0;
    if (début) début = (liste.find(function (m) { return m.début >= début; }) || premier).début;
    var fin = Math.min(début + 180, texte.length);
    if (fin < texte.length) {
      var coupure = texte.lastIndexOf(" ", fin);
      if (coupure > début && (!premier || coupure >= premier.fin)) fin = coupure;
    }
    var contenu = texteMarqué(texte, repères, début, fin);
    if (début) contenu.unshift("… ");
    if (fin < texte.length) contenu.push(" …");
    return el("p", { classe: "resultat-recherche__apercu" }, contenu);
  }

  function carte(r) {
    var entrée = r.entrée;
    var repères = mots(entrée.meta).filter(function (m) { return r.termes.has(m.mot); });
    return el("li", { classe: "resultat-recherche" }, [
      el("h3", null, [el("a", { href: entrée.lien, texte: entrée.titre })]),
      entrée.meta ? el("p", { classe: "resultat-recherche__meta" }, texteMarqué(entrée.meta, repères, 0, entrée.meta.length)) : null,
      aperçu(r)
    ]);
  }

  var PAR_GROUPE = 8;
  var résultats = [], tolérance = false, recherche = "";
  function afficher() {
    zone.textContent = "";
    var visibles = résultats.filter(function (r) { return !filtre.value || r.entrée.type === filtre.value; });
    etat.textContent = visibles.length
      ? S.pluriel(visibles.length, "résultat", "résultats") + (tolérance ? " avec des orthographes proches." : ".")
      : "Aucun résultat. Essayez un autre mot ou changez de rubrique.";
    Object.entries(RUBRIQUES).forEach(function ([type, titre]) {
      var groupe = visibles.filter(function (r) { return r.entrée.type === type; });
      if (!groupe.length) return;
      var liste = el("ul");
      var bouton = el("button", { type: "button", classe: "bouton bouton--discret" });
      function ajouterRésultats() {
        var début = liste.children.length;
        groupe.slice(début, début + PAR_GROUPE).forEach(function (r) { liste.appendChild(carte(r)); });
        var reste = groupe.length - liste.children.length;
        bouton.textContent = "Afficher " + S.pluriel(Math.min(reste, PAR_GROUPE), "autre résultat", "autres résultats");
        bouton.hidden = reste === 0;
        if (début) liste.children[début].querySelector("a").focus();
      }
      bouton.addEventListener("click", ajouterRésultats);
      ajouterRésultats();
      zone.appendChild(el("section", { classe: "groupe-recherche", "aria-labelledby": "groupe-" + type }, [
        el("h2", { id: "groupe-" + type, texte: titre + " (" + groupe.length + ")" }), liste, bouton
      ]));
    });
  }

  function lancer() {
    recherche = champ.value.trim();
    var groupes = critères(recherche);
    zone.textContent = "";
    filtre.parentElement.hidden = true;
    if (!entrées.length || !groupes.length) {
      etat.textContent = !entrées.length ? "Aucun contenu à rechercher pour le moment."
        : (recherche ? "Saisissez un mot d’au moins deux lettres ou une référence." : "Saisissez un terme pour afficher les résultats.");
      return;
    }
    résultats = chercher(groupes, false);
    tolérance = résultats.length === 0;
    if (tolérance) résultats = chercher(groupes, true);
    filtre.textContent = "";
    filtre.appendChild(el("option", { value: "", texte: "Toutes les rubriques" }));
    Object.entries(RUBRIQUES).forEach(function ([type, titre]) {
      var compte = résultats.filter(function (r) { return r.entrée.type === type; }).length;
      if (compte) filtre.appendChild(el("option", { value: type, texte: titre + " (" + compte + ")" }));
    });
    filtre.parentElement.hidden = filtre.options.length <= 2;
    afficher();
  }

  function lireAdresse() {
    champ.value = (new URLSearchParams(location.hash.slice(1)).get("q") || "").slice(0, champ.maxLength);
    lancer();
  }
  document.getElementById("perimetre-recherche").textContent = enDemo && entrées.length
    ? "Vous consultez des exemples fictifs." : (pages.length ? "Le texte du livre est inclus." : "Pour le livre, la recherche porte sur le sommaire.");
  document.getElementById("formulaire-recherche").addEventListener("submit", function (e) {
    e.preventDefault();
    lancer();
    // Le fragment garde la recherche au retour sur la page sans transmettre les termes au serveur.
    var fragment = recherche ? "#" + new URLSearchParams({ q: recherche }) : "";
    history.replaceState(null, "", location.href.split("#")[0] + fragment);
  });
  filtre.addEventListener("change", afficher);
  window.addEventListener("hashchange", lireAdresse);
  lireAdresse();
})();

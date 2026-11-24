/* La voix de Mamili : extraits audio rangés par chapitre du livre, avec leur transcription.
   Données : window.VOIX (exemple fictif, puis prive/voix.js produit par outils/catalogue_voix.py).
   Le numéro de chapitre est la clé (0 = prologue, vide = témoignage hors livre). */
(function () {
  "use strict";
  var S = window.SITE, el = S.el;
  var voix = window.VOIX || { extraits: [] };
  var extraits = voix.extraits || [];
  var livre = window.LIVRE && S.memeNature(window.LIVRE, voix) ? window.LIVRE : null;

  S.avis(voix, "Ces extraits sont des exemples fictifs, sans son : ils montrent comment la page sera organisée. Les enregistrements de Mamili sont réservés à la famille.");

  var TYPES = {
    "livre": { titre: "Scènes du livre", etiquette: null },
    "complément": { titre: "Compléments", etiquette: "Complément au livre" },
    "version à vérifier": { titre: "Versions à vérifier", etiquette: "Version à vérifier" },
    "hors livre": { titre: "Hors livre", etiquette: "Hors livre" }
  };
  var STATUTS = { brut: "Enregistrement brut", "à monter": "Extrait à monter", "monté": "Extrait monté", "validé": "Extrait validé" };

  // Pages du livre imprimé, par numéro de chapitre (0 = prologue)
  var pages = {};
  if (livre) {
    (livre.liminaires || []).forEach(function (l) { if (S.normaliser(l.titre) === "prologue" && l.page) pages[0] = l.page; });
    (livre.parties || []).forEach(function (p) { (p.chapitres || []).forEach(function (c) { if (c.page) pages[c.numero] = c.page; }); });
  }

  function numero(v) {
    var c = v.chapitre;
    return c && c.numero != null && c.numero !== "" ? Number(c.numero) : null;
  }
  function typeDe(v) { return v.type || (numero(v) == null ? "hors livre" : "livre"); }

  extraits.forEach(function (v) {
    var e = v.enregistrement || {};
    v._type = typeDe(v);
    v._texte = S.normaliser([v.titre, v.resume, v.transcription, (v.personnes || []).join(" "), (v.lieux || []).join(" "),
      (v.divergences || []).join(" "), v.chapitre && v.chapitre.titre, e.par, e.titre, e.code].join(" "));
  });

  // Listes de choix construites à partir des données
  var selType = document.getElementById("type-voix");
  var selEnr = document.getElementById("enregistrement-voix");
  Object.keys(TYPES).forEach(function (t) {
    var n = extraits.filter(function (v) { return v._type === t; }).length;
    if (n) selType.appendChild(el("option", { value: t, texte: TYPES[t].titre + " (" + n + ")" }));
  });
  var enregistrements = {};
  extraits.forEach(function (v) {
    var e = v.enregistrement || {}, k = e.code || e.fichier;
    if (k && !enregistrements[k]) enregistrements[k] = { titre: e.titre || e.fichier || k, n: 0 };
    if (k) enregistrements[k].n++;
  });
  Object.keys(enregistrements).sort().forEach(function (k) {
    var e = enregistrements[k];
    selEnr.appendChild(el("option", { value: k, texte: k + (e.titre !== k ? " — " + e.titre : "") + " (" + e.n + ")" }));
  });
  if (Object.keys(enregistrements).length < 2) selEnr.closest(".champ").hidden = true;

  function liste(etiquette, valeurs) {
    return valeurs && valeurs.length ? el("p", { classe: "meta" }, [el("strong", { texte: etiquette }), valeurs.join(", ")]) : null;
  }

  function origine(v) {
    var e = v.enregistrement || {};
    var lignes = [];
    if (e.code || e.titre) lignes.push(["Enregistrement", [e.code, e.titre && e.titre !== e.code ? "« " + e.titre + " »" : ""].filter(Boolean).join(" ") + (e.par ? ", par " + e.par : "") + (e.date ? ", le " + e.date : "")]);
    if (e.fichier) lignes.push(["Fichier original", e.fichier]);
    if (v.coupes && v.coupes.length) lignes.push(["Passage retenu", v.coupes.join(", puis ")]);
    else if (v.debut) lignes.push(["Passage retenu", v.debut + (v.fin ? " – " + v.fin : "")]);
    if (v.fichier) lignes.push(["Extrait", v.fichier]);
    if (e.transcription) lignes.push(["Transcription d'origine", e.transcription]);
    if (v.note_montage) lignes.push(["Montage", v.note_montage]);
    if (e.note) lignes.push(["À savoir", e.note]);
    if (!lignes.length) return null;
    var dl = el("dl", { classe: "origine" });
    lignes.forEach(function (l) { dl.appendChild(el("dt", { texte: l[0] })); dl.appendChild(el("dd", { texte: l[1] })); });
    var liens = [];
    if (e.drive_id) liens.push(el("a", { href: "https://drive.google.com/file/d/" + e.drive_id + "/view", texte: "Original sur le Drive" }));
    if (v.drive_id) liens.push(el("a", { href: "https://drive.google.com/file/d/" + v.drive_id + "/view", texte: "Extrait sur le Drive" }));
    return el("details", { classe: "details-origine" }, [
      el("summary", { texte: "D'où vient cet extrait" }), dl,
      liens.length ? el("p", { classe: "meta" }, liens.reduce(function (a, l, i) { return i ? a.concat([" · ", l]) : [l]; }, [])) : null
    ]);
  }

  function carteExtrait(v) {
    var e = v.enregistrement || {};
    var qui = e.date ? "Enregistré le " + e.date + (e.par ? " par " + e.par : "") : e.par ? "Enregistré par " + e.par : "";
    var meta = [qui, v.duree].filter(Boolean).join(", ");
    var etiquette = TYPES[v._type] && TYPES[v._type].etiquette;
    var lecteur = v.audio
      ? el("audio", { controls: "", preload: "none", src: S.racine + v.audio })
      : el("div", { classe: "audio-absent", texte: voix.mode === "prive" ? "Fichier audio en cours de transfert" : "Extrait audio à venir" });
    return el("article", { classe: "extrait", id: v.id }, [
      el("div", { classe: "extrait__tete" }, [
        el("h3", { texte: v.titre }),
        etiquette ? el("span", { classe: "etiquette etiquette--" + v._type.replace(/\s+/g, "-").replace("à", "a"), texte: etiquette }) : null
      ]),
      meta ? el("p", { classe: "meta", texte: meta }) : null,
      lecteur,
      v.resume ? el("p", { classe: "resume-extrait", texte: v.resume }) : null,
      (v.divergences || []).length ? el("div", { classe: "divergence" }, [el("strong", { texte: "Écart avec le livre" })].concat(
        v.divergences.map(function (d) { return el("p", { texte: d }); }))) : null,
      v.notes ? el("p", { classe: "meta note-extrait", texte: v.notes }) : null,
      v.transcription ? el("details", null, [
        el("summary", { texte: "Lire la transcription" }),
        el("blockquote", { classe: "transcription", texte: v.transcription }),
        v.note_transcription ? el("p", { classe: "meta note-transcription", texte: v.note_transcription }) : null
      ]) : null,
      liste("Personnes évoquées : ", v.personnes),
      liste("Lieux : ", v.lieux),
      origine(v),
      v.statut && voix.mode === "demo" ? el("div", { classe: "liens-croises" }, [el("span", { classe: "etiquette", texte: STATUTS[v.statut] || v.statut })]) : null
    ]);
  }

  function enteteGroupe(n, g) {
    if (n === "hors") return el("h2", null, [el("small", { texte: "Ce que le livre ne raconte pas" }), "Témoignages hors livre"]);
    if (n === 0) return el("h2", null, [el("small", { texte: pages[0] ? "Avant le premier chapitre, p. " + pages[0] : "Avant le premier chapitre" }), "Prologue"]);
    return el("h2", null, [el("small", { texte: "Chapitre " + n + (pages[n] ? ", p. " + pages[n] : "") }), g.chapitre.titre]);
  }

  function rendre() {
    var mots = S.normaliser(document.getElementById("q-voix").value).split(/\s+/).filter(Boolean);
    var t = selType.value, k = selEnr.value;
    var choisis = extraits.filter(function (v) {
      var e = v.enregistrement || {};
      return (!t || v._type === t) && (!k || e.code === k || e.fichier === k) &&
        mots.every(function (m) { return v._texte.indexOf(m) !== -1; });
    });
    var groupes = {}, ordre = [];
    choisis.forEach(function (v) {
      var n = numero(v); if (n == null) n = "hors";
      if (!groupes[n]) { groupes[n] = { chapitre: v.chapitre, extraits: [] }; ordre.push(n); }
      groupes[n].extraits.push(v);
    });
    ordre.sort(function (a, b) { return a === "hors" ? 1 : b === "hors" ? -1 : a - b; });

    var zone = document.getElementById("extraits");
    zone.textContent = "";
    ordre.forEach(function (n) {
      var g = groupes[n];
      var section = el("section", { classe: "groupe-chapitre" + (n === "hors" ? " groupe-hors-livre" : ""), id: n === "hors" ? "hors-livre" : "chapitre-" + n }, [enteteGroupe(n, g)]);
      if (n === "hors") section.appendChild(el("p", { classe: "discret", texte: "Des souvenirs et des conversations qui ne correspondent à aucun chapitre." }));
      else section.appendChild(el("p", { classe: "liens-croises" }, [el("a", { href: S.racine + "livre/index.html#chapitre-" + n, texte: "Voir dans le sommaire du livre" })]));
      g.extraits.forEach(function (v) { section.appendChild(carteExtrait(v)); });
      zone.appendChild(section);
    });
    var audibles = choisis.filter(function (v) { return v.audio; }).length;
    document.getElementById("compte-voix").textContent = choisis.length
      ? S.pluriel(choisis.length, "extrait", "extraits") + (choisis.length < extraits.length ? " sur " + extraits.length : "") +
        (voix.mode === "prive" && audibles < choisis.length ? ", dont " + audibles + " à écouter dès maintenant" : "")
      : "Aucun extrait ne correspond à cette recherche.";
  }

  // Un seul extrait joue à la fois
  document.addEventListener("play", function (e) {
    if (e.target.tagName !== "AUDIO") return;
    Array.prototype.forEach.call(document.querySelectorAll("audio"), function (a) { if (a !== e.target) a.pause(); });
  }, true);

  var minuterie;
  document.getElementById("q-voix").addEventListener("input", function () { clearTimeout(minuterie); minuterie = setTimeout(rendre, 150); });
  selType.addEventListener("change", rendre);
  selEnr.addEventListener("change", rendre);
  rendre();

  if (location.hash.length > 1) {
    var cible = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (cible) cible.scrollIntoView();
  }
})();

/* La voix de Mamili : extraits audio rangés par chapitre, avec leur transcription. */
(function () {
  "use strict";
  var S = window.SITE, el = S.el;
  var voix = window.VOIX || { extraits: [] };
  var extraits = voix.extraits || [];

  S.avis(voix, "Ces extraits sont des exemples fictifs, sans son : ils montrent comment la page sera organisée. Les enregistrements de Mamili seront réservés à la famille.");

  var STATUTS = { brut: "Enregistrement brut", "à monter": "Extrait à monter", "monté": "Extrait monté", "validé": "Extrait validé" };

  extraits.forEach(function (v) {
    v._texte = S.normaliser([v.titre, v.resume, v.transcription, (v.personnes || []).join(" "), (v.lieux || []).join(" "),
      v.chapitre && v.chapitre.titre, v.enregistrement && v.enregistrement.par].join(" "));
  });

  function carteExtrait(v) {
    var e = v.enregistrement || {};
    var meta = [e.date ? "Enregistré le " + e.date : "", e.par ? "par " + e.par : "", v.duree].filter(Boolean).join(", ");
    var lecteur = v.audio
      ? el("audio", { controls: "", preload: "none", src: S.racine + v.audio })
      : el("div", { classe: "audio-absent", texte: "Extrait audio à venir" });
    var personnes = (v.personnes || []).map(function (n, i) {
      return el("a", { href: S.lienPhotos({ p: n }), texte: n });
    });
    var liensPersonnes = [];
    personnes.forEach(function (a, i) { if (i) liensPersonnes.push(", "); liensPersonnes.push(a); });
    return el("article", { classe: "extrait", id: v.id }, [
      el("div", null, [
        el("h3", { texte: v.titre }),
        el("p", { classe: "meta", texte: meta })
      ]),
      lecteur,
      v.resume ? el("p", { texte: v.resume }) : null,
      v.transcription ? el("details", null, [
        el("summary", { texte: "Lire la transcription" }),
        el("blockquote", { classe: "transcription", texte: v.transcription })
      ]) : null,
      el("div", { classe: "liens-croises" }, [
        liensPersonnes.length ? el("span", null, ["Personnes évoquées : "].concat(liensPersonnes)) : null,
        v.statut ? el("span", { classe: "etiquette", texte: STATUTS[v.statut] || v.statut }) : null
      ])
    ]);
  }

  function rendre() {
    var mots = S.normaliser(document.getElementById("q-voix").value).split(/\s+/).filter(Boolean);
    var choisis = extraits.filter(function (v) { return mots.every(function (m) { return v._texte.indexOf(m) !== -1; }); });
    var groupes = {}, ordre = [];
    choisis.forEach(function (v) {
      var n = v.chapitre && v.chapitre.numero != null ? v.chapitre.numero : "hors";
      if (!groupes[n]) { groupes[n] = { chapitre: v.chapitre, extraits: [] }; ordre.push(n); }
      groupes[n].extraits.push(v);
    });
    ordre.sort(function (a, b) { return a === "hors" ? 1 : b === "hors" ? -1 : a - b; });

    var zone = document.getElementById("extraits");
    zone.textContent = "";
    ordre.forEach(function (n) {
      var g = groupes[n];
      var titre = n === "hors"
        ? el("h2", { texte: "Hors chapitre" })
        : el("h2", null, [el("small", { texte: "Chapitre " + n }), g.chapitre.titre]);
      var section = el("section", { classe: "groupe-chapitre", id: n === "hors" ? "hors-chapitre" : "chapitre-" + n }, [titre]);
      if (n !== "hors") section.appendChild(el("p", { classe: "liens-croises" }, [el("a", { href: S.racine + "livre/index.html#chapitre-" + n, texte: "Voir ce chapitre dans le sommaire du livre" })]));
      g.extraits.forEach(function (v) { section.appendChild(carteExtrait(v)); });
      zone.appendChild(section);
    });
    document.getElementById("compte-voix").textContent = choisis.length
      ? S.pluriel(choisis.length, "extrait", "extraits") + (choisis.length < extraits.length ? " sur " + extraits.length : "")
      : "Aucun extrait ne contient ces mots.";
  }

  var minuterie;
  document.getElementById("q-voix").addEventListener("input", function () {
    clearTimeout(minuterie);
    minuterie = setTimeout(rendre, 150);
  });
  rendre();

  if (location.hash.length > 1) {
    var cible = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (cible) cible.scrollIntoView();
  }
})();

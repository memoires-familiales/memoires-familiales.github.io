/* Le livre : sommaire, avec pour chaque chapitre ses photos et ses extraits audio. */
(function () {
  "use strict";
  var S = window.SITE, el = S.el;
  var livre = window.LIVRE || { parties: [] };
  var phototheque = window.PHOTOTHEQUE || {};
  var voix = window.VOIX || {};

  S.avis(livre, "Ce sommaire est un exemple fictif : il montre comment la page sera organisée. Le sommaire du livre de Mamili sera réservé à la famille.");
  document.getElementById("livre-titre").textContent = [livre.titre, livre.sous_titre].filter(Boolean).join(", ");

  function numero(ch) {
    if (!ch) return null;
    if (typeof ch === "object") return ch.numero;
    var m = String(ch).match(/chapitre\s+(\d+)/i);
    return m ? parseInt(m[1], 10) : null;
  }

  // On ne croise que des données de même nature (exemples avec exemples, famille avec famille)
  var photosParChapitre = {};
  if (phototheque.mode === livre.mode) {
    (phototheque.photos || []).forEach(function (p) {
      var n = numero(p.chapitre);
      if (p.retiree || n == null) return;
      photosParChapitre[n] = photosParChapitre[n] || { nb: 0, libelle: p.chapitre };
      photosParChapitre[n].nb++;
    });
  }
  var extraitsParChapitre = {};
  if (voix.mode === livre.mode) {
    (voix.extraits || []).forEach(function (v) {
      var n = numero(v.chapitre);
      if (n != null) extraitsParChapitre[n] = (extraitsParChapitre[n] || 0) + 1;
    });
  }

  function ligne(numeroAffiche, titre, page) {
    return el("div", { classe: "ligne" }, [
      numeroAffiche != null ? el("span", { classe: "numero", texte: String(numeroAffiche) }) : null,
      el("span", { classe: "titre-chapitre", texte: titre }),
      page ? el("span", { classe: "page-livre", texte: "p. " + page }) : null
    ]);
  }

  function chapitre(c) {
    var liens = [];
    var ph = photosParChapitre[c.numero];
    if (ph) liens.push(el("a", { href: S.lienPhotos({ chap: ph.libelle }), texte: S.pluriel(ph.nb, "photo", "photos") }));
    var nv = extraitsParChapitre[c.numero];
    if (nv) liens.push(el("a", { href: S.racine + "voix/index.html#chapitre-" + c.numero, texte: S.pluriel(nv, "extrait de sa voix", "extraits de sa voix") }));
    return el("div", { classe: "chapitre", id: "chapitre-" + c.numero }, [
      ligne(c.numero, c.titre, c.page),
      liens.length ? el("div", { classe: "liens-croises" }, liens) : null
    ]);
  }

  var sommaire = document.getElementById("sommaire");
  (livre.liminaires || []).forEach(function (l) {
    sommaire.appendChild(el("div", { classe: "liminaire" }, [ligne(null, l.titre, l.page)]));
  });
  (livre.parties || []).forEach(function (p) {
    var bloc = el("section", { classe: "partie", "aria-label": "Partie " + p.numero + ", " + p.titre }, [
      el("h2", null, [el("small", { texte: "Partie " + p.numero }), p.titre])
    ]);
    (p.chapitres || []).forEach(function (c) { bloc.appendChild(chapitre(c)); });
    sommaire.appendChild(bloc);
  });
  if ((livre.annexes || []).length) {
    var annexes = el("section", { classe: "partie", "aria-label": "Annexes" }, [el("h2", { texte: "Annexes" })]);
    livre.annexes.forEach(function (a) { annexes.appendChild(el("div", { classe: "liminaire" }, [ligne(null, a.titre, a.page)])); });
    sommaire.appendChild(annexes);
  }
  if (!sommaire.children.length) sommaire.appendChild(el("p", { classe: "vide-rubrique", texte: "Le sommaire n'est pas encore disponible." }));

  if (location.hash.length > 1) {
    var cible = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (cible) cible.scrollIntoView();
  }
})();

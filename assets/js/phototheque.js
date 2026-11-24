/* Photothèque — recherche, filtres, galerie et fiche de chaque photo.
   Les données arrivent dans window.PHOTOTHEQUE (data/demo/photos.js ou prive/photos.js). */
(function () {
  "use strict";

  var PAR_PAGE = 48;
  var racine = document.body.getAttribute("data-racine") || "";
  var donnees = window.PHOTOTHEQUE || { photos: [], mode: "demo" };
  var photos = (donnees.photos || []).filter(function (p) { return !p.retiree; });

  // ---------------------------------------------------------------- outils

  function $(id) { return document.getElementById(id); }

  // L'adresse garde les filtres et la photo ouverte (quand le navigateur le permet).
  function remplacerAdresse(url) {
    try { history.replaceState(null, "", url); } catch (e) { /* cadre restreint : on ignore */ }
  }

  function el(tag, attrs, enfants) {
    var n = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "texte") n.textContent = attrs[k];
        else if (k === "classe") n.className = attrs[k];
        else n.setAttribute(k, attrs[k]);
      });
    }
    (enfants || []).forEach(function (e) {
      if (e == null) return;
      n.appendChild(typeof e === "string" ? document.createTextNode(e) : e);
    });
    return n;
  }

  function normaliser(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }

  var nf = new Intl.NumberFormat("fr-FR");
  function nb(n, sing, plur) { return nf.format(n) + " " + (n > 1 ? plur : sing); }

  function decennie(p) {
    return p.date && p.date.annee ? String(Math.floor(p.date.annee / 10) * 10) : "sans";
  }

  function cleLieuPays(p) { return p.lieu && p.lieu.pays ? "pays:" + p.lieu.pays : null; }
  function cleLieuVille(p) {
    return p.lieu && p.lieu.ville ? "ville:" + (p.lieu.pays || "") + "|" + p.lieu.ville : null;
  }

  function texteLieu(p, court) {
    if (!p.lieu) return "";
    var l = p.lieu, morceaux = [];
    if (l.precis && !court) morceaux.push(l.precis);
    if (l.ville) morceaux.push(l.ville);
    if (l.pays && (!court || !l.ville)) morceaux.push(l.pays);
    return morceaux.join(", ");
  }

  function image(p, taille) {
    return p.images && p.images[taille] ? racine + p.images[taille] : null;
  }

  // Texte de recherche de chaque photo, calculé une seule fois
  photos.forEach(function (p, i) {
    p._ordre = i;
    p._dec = decennie(p);
    p._texte = normaliser([
      p.numero, p.titre, p.date && p.date.libelle, p.date && p.date.annee,
      p.lieu && p.lieu.pays, p.lieu && p.lieu.ville, p.lieu && p.lieu.precis,
      (p.personnes || []).join(" "), p.autres_mentions, p.evenement, p.chapitre,
      p.notes, p.legende, (p.mots_cles || []).join(" "), p.provenance, p.type
    ].join(" "));
  });

  // ---------------------------------------------------------------- état

  var etat = lireEtat();
  var resultats = [];
  var affichees = 0;

  function etatVide() {
    return { q: "", personnes: [], lieu: "", evenement: "", chapitre: "", dec: "", identifier: false, tri: "chrono" };
  }

  function lireEtat() {
    var e = etatVide();
    var u = new URLSearchParams(location.search);
    e.q = u.get("q") || "";
    e.personnes = u.getAll("p");
    e.lieu = u.get("lieu") || "";
    e.evenement = u.get("evt") || "";
    e.chapitre = u.get("chap") || "";
    e.dec = u.get("dec") || "";
    e.identifier = u.get("id") === "1";
    e.tri = u.get("tri") === "numero" ? "numero" : "chrono";
    return e;
  }

  function ecrireEtat() {
    var u = new URLSearchParams();
    if (etat.q) u.set("q", etat.q);
    etat.personnes.forEach(function (p) { u.append("p", p); });
    if (etat.lieu) u.set("lieu", etat.lieu);
    if (etat.evenement) u.set("evt", etat.evenement);
    if (etat.chapitre) u.set("chap", etat.chapitre);
    if (etat.dec) u.set("dec", etat.dec);
    if (etat.identifier) u.set("id", "1");
    if (etat.tri !== "chrono") u.set("tri", etat.tri);
    var s = u.toString();
    remplacerAdresse(location.pathname + (s ? "?" + s : "") + location.hash);
  }

  // ---------------------------------------------------------------- filtrage

  function correspond(p, sauf) {
    if (sauf !== "q" && etat.q) {
      var mots = normaliser(etat.q).split(/\s+/).filter(Boolean);
      for (var i = 0; i < mots.length; i++) if (p._texte.indexOf(mots[i]) === -1) return false;
    }
    if (sauf !== "personne" && etat.personnes.length) {
      var pp = p.personnes || [];
      for (var j = 0; j < etat.personnes.length; j++) if (pp.indexOf(etat.personnes[j]) === -1) return false;
    }
    if (sauf !== "lieu" && etat.lieu) {
      if (etat.lieu !== cleLieuPays(p) && etat.lieu !== cleLieuVille(p)) return false;
    }
    if (sauf !== "evenement" && etat.evenement && p.evenement !== etat.evenement) return false;
    if (sauf !== "chapitre" && etat.chapitre && p.chapitre !== etat.chapitre) return false;
    if (sauf !== "dec" && etat.dec && p._dec !== etat.dec) return false;
    if (sauf !== "identifier" && etat.identifier && !p.a_identifier) return false;
    return true;
  }

  function trier(liste) {
    return liste.sort(function (a, b) {
      if (etat.tri === "chrono") {
        var ta = a.date && a.date.tri, tb = b.date && b.date.tri;
        if (ta && !tb) return -1;
        if (!ta && tb) return 1;
        if (ta && tb && ta !== tb) return ta < tb ? -1 : 1;
      }
      var na = a.numero || "~", nb2 = b.numero || "~";
      return na < nb2 ? -1 : na > nb2 ? 1 : a._ordre - b._ordre;
    });
  }

  function compter(sauf, cleFn) {
    var c = {};
    photos.forEach(function (p) {
      if (!correspond(p, sauf)) return;
      [].concat(cleFn(p)).forEach(function (k) { if (k) c[k] = (c[k] || 0) + 1; });
    });
    return c;
  }

  // ---------------------------------------------------------------- rendu des filtres

  function option(valeur, libelle, choisie) {
    var o = el("option", { value: valeur, texte: libelle });
    if (choisie) o.selected = true;
    return o;
  }

  function remplirSelect(select, titreVide, groupes, valeur) {
    select.textContent = "";
    select.appendChild(option("", titreVide, !valeur));
    groupes.forEach(function (g) {
      var parent = select;
      if (g.titre) { parent = el("optgroup", { label: g.titre }); select.appendChild(parent); }
      g.options.forEach(function (o) { parent.appendChild(option(o.valeur, o.libelle, o.valeur === valeur)); });
    });
  }

  function triAlpha(a, b) { return a.localeCompare(b, "fr", { sensitivity: "base" }); }

  function rendreFiltres() {
    // Personnes : les plus présentes, puis toutes par ordre alphabétique
    var cp = compter("personne", function (p) { return p.personnes || []; });
    etat.personnes.forEach(function (n) { delete cp[n]; });
    var noms = Object.keys(cp);
    var frequents = noms.slice().sort(function (a, b) { return cp[b] - cp[a] || triAlpha(a, b); }).slice(0, 8);
    var groupes = [];
    if (noms.length > 12) {
      groupes.push({ titre: "Les plus présentes", options: frequents.map(function (n) { return { valeur: n, libelle: n + " — " + cp[n] }; }) });
    }
    groupes.push({ titre: noms.length > 12 ? "Toutes, par ordre alphabétique" : "", options: noms.sort(triAlpha).map(function (n) { return { valeur: n, libelle: n + " — " + cp[n] }; }) });
    remplirSelect($("f-personne"), etat.personnes.length ? "Ajouter une personne…" : "Toutes les personnes", groupes, "");

    // Lieux : par pays, puis par ville
    var cl = compter("lieu", function (p) { return [cleLieuPays(p), cleLieuVille(p)]; });
    var pays = Object.keys(cl).filter(function (k) { return k.indexOf("pays:") === 0; }).map(function (k) { return k.slice(5); }).sort(triAlpha);
    remplirSelect($("f-lieu"), "Tous les lieux", pays.map(function (py) {
      var villes = Object.keys(cl).filter(function (k) { return k.indexOf("ville:" + py + "|") === 0; })
        .sort(function (a, b) { return triAlpha(a, b); });
      return {
        titre: py,
        options: [{ valeur: "pays:" + py, libelle: py + " (tout le pays) — " + cl["pays:" + py] }].concat(
          villes.map(function (v) { return { valeur: v, libelle: v.split("|")[1] + " — " + cl[v] }; }))
      };
    }), etat.lieu);

    var ce = compter("evenement", function (p) { return p.evenement; });
    remplirSelect($("f-evenement"), "Tous les événements", [{ options: Object.keys(ce).sort(triAlpha).map(function (k) { return { valeur: k, libelle: k + " — " + ce[k] }; }) }], etat.evenement);

    var cc = compter("chapitre", function (p) { return p.chapitre; });
    var chapitres = Object.keys(cc).sort(function (a, b) {
      var na = parseInt((a.match(/\d+/) || [9999])[0], 10), nb3 = parseInt((b.match(/\d+/) || [9999])[0], 10);
      var pa = /^partie/i.test(a) ? 0 : 1, pb = /^partie/i.test(b) ? 0 : 1;
      return pa - pb || na - nb3 || triAlpha(a, b);
    });
    remplirSelect($("f-chapitre"), "Tous les chapitres", [{ options: chapitres.map(function (k) { return { valeur: k, libelle: k + " — " + cc[k] }; }) }], etat.chapitre);
    $("f-chapitre").closest(".champ").hidden = chapitres.length === 0 && !etat.chapitre;
    $("f-evenement").closest(".champ").hidden = Object.keys(ce).length === 0 && !etat.evenement;

    $("f-identifier").checked = etat.identifier;
    $("tri").value = etat.tri;
    if (document.activeElement !== $("q")) $("q").value = etat.q;

    rendreFrise();
    rendreActifs();
  }

  function rendreFrise() {
    var frise = $("frise");
    var toutes = {};
    photos.forEach(function (p) { toutes[p._dec] = true; });
    var decs = Object.keys(toutes).filter(function (d) { return d !== "sans"; }).sort();
    var c = compter("dec", function (p) { return p._dec; });
    var max = 1;
    decs.concat("sans").forEach(function (d) { if ((c[d] || 0) > max) max = c[d]; });
    frise.textContent = "";
    decs.concat(toutes.sans ? ["sans"] : []).forEach(function (d) {
      var n = c[d] || 0;
      var b = el("button", {
        type: "button",
        "aria-pressed": String(etat.dec === d),
        "aria-label": (d === "sans" ? "Photos sans date" : "Années " + d) + ", " + nb(n, "photo", "photos"),
        title: nb(n, "photo", "photos")
      }, [
        el("span", { classe: "barre", style: "height:" + Math.max(n ? 6 : 2, Math.round(n / max * 100)) + "%" }),
        el("span", { classe: "annee", texte: d === "sans" ? "Sans date" : d })
      ]);
      if (d === "sans") b.className = "sans-date";
      if (!n && etat.dec !== d) b.disabled = true;
      b.addEventListener("click", function () {
        etat.dec = etat.dec === d ? "" : d;
        miseAJour();
      });
      frise.appendChild(b);
    });
  }

  function libelleLieu(v) {
    return v.indexOf("pays:") === 0 ? v.slice(5) : v.split("|")[1];
  }

  function rendreActifs() {
    var zone = $("actifs");
    zone.textContent = "";
    var filtres = [];
    if (etat.q) filtres.push(["« " + etat.q + " »", function () { etat.q = ""; $("q").value = ""; }]);
    etat.personnes.forEach(function (n) {
      filtres.push([n, function () { etat.personnes = etat.personnes.filter(function (x) { return x !== n; }); }]);
    });
    if (etat.lieu) filtres.push([libelleLieu(etat.lieu), function () { etat.lieu = ""; }]);
    if (etat.dec) filtres.push([etat.dec === "sans" ? "Sans date" : "Années " + etat.dec, function () { etat.dec = ""; }]);
    if (etat.evenement) filtres.push([etat.evenement, function () { etat.evenement = ""; }]);
    if (etat.chapitre) filtres.push([etat.chapitre, function () { etat.chapitre = ""; }]);
    if (etat.identifier) filtres.push(["Visages à identifier", function () { etat.identifier = false; }]);

    filtres.forEach(function (f) {
      var b = el("button", { type: "button", classe: "pastille", "aria-label": "Retirer le filtre " + f[0], texte: f[0] });
      b.addEventListener("click", function () { f[1](); miseAJour(); });
      zone.appendChild(b);
    });
    if (filtres.length > 1) {
      var tout = el("button", { type: "button", classe: "lien-effacer", texte: "Tout effacer" });
      tout.addEventListener("click", effacer);
      zone.appendChild(tout);
    }
    var nbAutres = filtres.length - (etat.q ? 1 : 0) - (etat.dec ? 1 : 0);
    $("nb-filtres").textContent = nbAutres > 0 ? "(" + nbAutres + ")" : "";
  }

  // ---------------------------------------------------------------- rendu de la grille

  function vignette(p, index) {
    var lieu = texteLieu(p, true);
    var date = p.date || {};
    var mini = image(p, "miniature");
    var tirage = mini
      ? el("span", { classe: "tirage" }, [el("img", { src: mini, alt: "", loading: "lazy", decoding: "async" })])
      : el("span", { classe: "tirage tirage--absent" }, [el("span", { texte: p.numero || "Photo" })]);
    var noms = (p.personnes || []).slice(0, 4).join(", ");
    var a = el("a", {
      classe: "vignette",
      href: "#" + encodeURIComponent(p.numero || p.id),
      "data-index": String(index),
      "aria-label": [p.numero, date.libelle, lieu, noms ? "avec " + noms : ""].filter(Boolean).join(", ")
    }, [
      tirage,
      el("span", { classe: "legende-v" }, [
        el("span", { classe: date.precision === "inconnue" ? "v-incertaine" : "v-date", texte: date.libelle || "Date inconnue" }),
        lieu ? el("span", { classe: "v-lieu", texte: lieu }) : null
      ])
    ]);
    return el("li", null, [a]);
  }

  function afficherSuite() {
    var grille = $("grille");
    var fin = Math.min(resultats.length, affichees + PAR_PAGE);
    var frag = document.createDocumentFragment();
    for (var i = affichees; i < fin; i++) frag.appendChild(vignette(resultats[i], i));
    grille.appendChild(frag);
    affichees = fin;
    $("suite").hidden = affichees >= resultats.length;
    $("plus").textContent = "Afficher plus de photos (" + nf.format(resultats.length - affichees) + " restantes)";
  }

  function miseAJour() {
    resultats = trier(photos.filter(function (p) { return correspond(p); }));
    affichees = 0;
    $("grille").textContent = "";
    afficherSuite();
    var filtre = resultats.length !== photos.length;
    $("compte").textContent = filtre
      ? nb(resultats.length, "photo", "photos") + " sur " + nf.format(photos.length)
      : nb(photos.length, "photo", "photos");
    $("vide").hidden = resultats.length > 0;
    rendreFiltres();
    ecrireEtat();
  }

  function effacer() {
    var tri = etat.tri;
    etat = etatVide();
    etat.tri = tri;
    $("q").value = "";
    miseAJour();
  }

  // ---------------------------------------------------------------- la fiche

  var fiche = $("fiche");
  var courante = -1;
  var declencheur = null;

  function ligne(dl, titre, contenu) {
    if (contenu == null || contenu === "" || (Array.isArray(contenu) && !contenu.length)) return;
    dl.appendChild(el("dt", { texte: titre }));
    dl.appendChild(typeof contenu === "string" ? el("dd", { texte: contenu }) : el("dd", null, [].concat(contenu)));
  }

  function boutonFiltre(libelle, action) {
    var b = el("button", { type: "button", classe: "lien-filtre", texte: libelle, title: "Voir toutes les photos : " + libelle });
    b.addEventListener("click", function () { action(); fermerFiche(); miseAJour(); $("compte").focus(); });
    return b;
  }

  function remplirFiche() {
    var p = resultats[courante];
    if (!p) return;
    var date = p.date || {};

    var fig = $("fiche-image");
    fig.textContent = "";
    var web = image(p, "web") || image(p, "miniature");
    fig.appendChild(web
      ? el("img", { src: web, alt: "Photo " + (p.numero || "") + (p.personnes && p.personnes.length ? " avec " + p.personnes.join(", ") : "") })
      : el("div", { classe: "tirage tirage--absent" }, [el("span", { texte: "Image non disponible" })]));

    var titre = $("fiche-titre");
    titre.textContent = date.libelle || "Date inconnue";
    if (date.approximative && date.precision !== "inconnue") titre.appendChild(el("span", { classe: "approx", texte: "Date approximative" }));
    $("fiche-lieu").textContent = texteLieu(p, false);

    var dl = $("fiche-details");
    dl.textContent = "";

    var personnes = (p.personnes || []).map(function (n) {
      return boutonFiltre(n, function () { etat = etatVide(); etat.personnes = [n]; });
    });
    var blocPersonnes = [];
    if (personnes.length) blocPersonnes.push(el("div", { classe: "personnes" }, personnes));
    if (p.inconnus) blocPersonnes.push(el("span", { classe: "inconnus", texte: (personnes.length ? "et " : "") + nb(p.inconnus, "personne à identifier", "personnes à identifier") }));
    ligne(dl, "Sur la photo", blocPersonnes);
    ligne(dl, "Autres personnes mentionnées", p.autres_mentions);
    if (p.evenement) ligne(dl, "Événement", boutonFiltre(p.evenement, function () { etat = etatVide(); etat.evenement = p.evenement; }));
    if (p.chapitre) ligne(dl, "Dans le livre", boutonFiltre(p.chapitre, function () { etat = etatVide(); etat.chapitre = p.chapitre; }));
    if (p.notes) ligne(dl, "Notes et mentions au dos", el("span", { classe: "au-dos", texte: p.notes }));
    if (p.legende && p.legende !== p.notes) ligne(dl, "Légende", p.legende);
    ligne(dl, "Mots-clés", (p.mots_cles || []).join(", "));
    ligne(dl, "Provenance", p.provenance);
    if (p.lieu && p.lieu.lat != null && p.lieu.lon != null) {
      ligne(dl, "Carte", el("a", {
        href: "https://www.openstreetmap.org/?mlat=" + p.lieu.lat + "&mlon=" + p.lieu.lon + "#map=13/" + p.lieu.lat + "/" + p.lieu.lon,
        target: "_blank", rel: "noopener", texte: "Voir le lieu sur une carte"
      }));
    }
    var tech = p.titre && p.numero && p.titre.indexOf(p.numero) === 0 ? p.titre
      : [p.numero, p.titre ? "« " + p.titre + " »" : ""].filter(Boolean).join(" ");
    if (date.enregistree) tech += (tech ? ". " : "") + "Date enregistrée dans Photos : " + date.enregistree + ", sans doute celle de la numérisation";
    ligne(dl, "Référence", el("span", { classe: "technique", texte: tech }));
    ligne(dl, "Vous reconnaissez quelqu'un ? Une date est fausse ?", el("a", {
      href: racine + "participer/index.html?photo=" + encodeURIComponent(p.numero || p.id),
      texte: "Proposer une correction"
    }));

    $("fiche-position").textContent = "Photo " + nf.format(courante + 1) + " sur " + nf.format(resultats.length);
    $("precedente").disabled = courante <= 0;
    $("suivante").disabled = courante >= resultats.length - 1;
    remplacerAdresse(location.pathname + location.search + "#" + encodeURIComponent(p.numero || p.id));

    // précharger la suivante
    var s = resultats[courante + 1];
    if (s && image(s, "web")) { var im = new Image(); im.src = image(s, "web"); }
  }

  function ouvrirFiche(index, source) {
    if (index < 0 || index >= resultats.length) return;
    courante = index;
    declencheur = source || null;
    remplirFiche();
    if (!fiche.open) fiche.showModal();
    fiche.querySelector(".fiche__corps").scrollTop = 0;
  }

  function naviguer(pas) {
    var i = courante + pas;
    if (i < 0 || i >= resultats.length) return;
    courante = i;
    remplirFiche();
    fiche.querySelector(".fiche__corps").scrollTop = 0;
  }

  function fermerFiche() { if (fiche.open) fiche.close(); }

  fiche.addEventListener("close", function () {
    remplacerAdresse(location.pathname + location.search);
    if (courante >= affichees) { while (affichees <= courante && affichees < resultats.length) afficherSuite(); }
    var cible = $("grille").querySelector('[data-index="' + courante + '"]') || declencheur;
    if (cible) cible.focus();
  });

  fiche.addEventListener("click", function (e) { if (e.target === fiche) fermerFiche(); });
  fiche.addEventListener("keydown", function (e) {
    if (e.target.tagName === "SELECT" || e.target.tagName === "INPUT") return;
    if (e.key === "ArrowLeft") { e.preventDefault(); naviguer(-1); }
    if (e.key === "ArrowRight") { e.preventDefault(); naviguer(1); }
  });
  $("precedente").addEventListener("click", function () { naviguer(-1); });
  $("suivante").addEventListener("click", function () { naviguer(1); });
  $("fermer").addEventListener("click", fermerFiche);

  // balayage sur téléphone
  var x0 = null, y0 = null;
  $("fiche-image").addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  $("fiche-image").addEventListener("touchend", function (e) {
    if (x0 === null) return;
    var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) naviguer(dx < 0 ? 1 : -1);
    x0 = null;
  });

  // ---------------------------------------------------------------- événements

  $("grille").addEventListener("click", function (e) {
    var a = e.target.closest(".vignette");
    if (!a || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    ouvrirFiche(parseInt(a.getAttribute("data-index"), 10), a);
  });

  var minuterie;
  $("q").addEventListener("input", function () {
    clearTimeout(minuterie);
    minuterie = setTimeout(function () { etat.q = $("q").value.trim(); miseAJour(); }, 180);
  });

  $("f-personne").addEventListener("change", function () {
    var v = this.value;
    if (v && etat.personnes.indexOf(v) === -1) etat.personnes.push(v);
    miseAJour();
  });
  $("f-lieu").addEventListener("change", function () { etat.lieu = this.value; miseAJour(); });
  $("f-evenement").addEventListener("change", function () { etat.evenement = this.value; miseAJour(); });
  $("f-chapitre").addEventListener("change", function () { etat.chapitre = this.value; miseAJour(); });
  $("f-identifier").addEventListener("change", function () { etat.identifier = this.checked; miseAJour(); });
  $("tri").addEventListener("change", function () { etat.tri = this.value; miseAJour(); });
  $("plus").addEventListener("click", afficherSuite);
  document.querySelector('[data-action="effacer"]').addEventListener("click", effacer);

  $("bascule-filtres").addEventListener("click", function () {
    var ouvert = this.getAttribute("aria-expanded") === "true";
    this.setAttribute("aria-expanded", String(!ouvert));
    $("filtres").classList.toggle("ouverts", !ouvert);
  });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entrees) {
      if (entrees[0].isIntersecting && affichees < resultats.length) afficherSuite();
    }, { rootMargin: "600px" }).observe($("suite"));
  }

  // ---------------------------------------------------------------- démarrage

  (function presenter() {
    var total = photos.length;
    var datees = photos.filter(function (p) { return p.date && p.date.annee; }).length;
    var nommees = photos.filter(function (p) { return p.personnes && p.personnes.length; }).length;
    $("resume").textContent = donnees.mode === "demo"
      ? "Un aperçu de la photothèque avec " + nb(total, "photo d'exemple", "photos d'exemple") + ". Cherchez par personne, par lieu, par année ou par chapitre du livre, puis ouvrez une photo pour lire sa fiche."
      : nb(total, "photographie numérisée", "photographies numérisées") + ", dont " + nf.format(datees) + " datées et " + nf.format(nommees) + " où au moins une personne est reconnue.";
    var avis = $("avis");
    if (donnees.mode === "demo") {
      avis.textContent = "Les photos et les personnes de cet aperçu sont fictives. Les photographies de la famille seront réservées à la famille.";
      avis.hidden = false;
    } else {
      avis.textContent = "Vous consultez la photothèque complète, chargée depuis le dossier « prive » de cet ordinateur. Ces données ne sont pas publiées.";
      avis.hidden = false;
    }
    $("compte").setAttribute("tabindex", "-1");
  })();

  miseAJour();

  // Lien direct vers une photo : …/phototheque/#P0001
  if (location.hash.length > 1) {
    var cible = decodeURIComponent(location.hash.slice(1));
    var i = resultats.findIndex(function (p) { return p.numero === cible || p.id === cible; });
    if (i === -1 && etat !== null) {
      etat = etatVide();
      miseAJour();
      i = resultats.findIndex(function (p) { return p.numero === cible || p.id === cible; });
    }
    if (i >= 0) ouvrirFiche(i);
  }
})();

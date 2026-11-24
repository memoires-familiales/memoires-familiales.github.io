/* Proposer une correction sur une photo, sans quitter la photothèque.
   Une fenêtre s'ouvre par-dessus la fiche : date, lieu, événement et personnes (remplacer,
   retirer, ajouter, avec les noms écrits comme dans la photothèque). L'envoi part par e-mail
   à Samuel (FormSubmit), avec un résumé lisible et les mêmes données en JSON pour les reporter.
   Utilisé par assets/js/phototheque.js : window.CorrectionPhoto.ouvrir(photo, toutesLesPhotos). */
(function () {
  "use strict";

  var SITE = window.SITE || {};
  var normaliser = SITE.normaliser || function (s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  };
  var MEMOIRE = "correction-photo-auteur";
  var PAGE_MERCI = "https://memoires-familiales.github.io/participer/merci.html";
  var ORIGINE_MERCI = "https://memoires-familiales.github.io";
  var DELAI_CONFIRMATION = 45000; // FormSubmit répond parfois lentement
  var CERTITUDES = ["J'en suis sûr(e)", "Je crois, à vérifier", "Je ne sais pas trop"];

  function el(tag, attrs, enfants) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "texte") n.textContent = attrs[k];
      else if (k === "classe") n.className = attrs[k];
      else if (k.indexOf("on") === 0) n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    (enfants || []).forEach(function (e) {
      if (e != null) n.appendChild(typeof e === "string" ? document.createTextNode(e) : e);
    });
    return n;
  }

  function texteLieu(p) {
    var l = p.lieu || {};
    return [l.precis, l.ville, l.pays].filter(Boolean).join(", ");
  }

  // ---------------------------------------------------------------- listes de suggestions

  var listes = null;
  function construireListes(photos) {
    var personnes = {}, lieux = {}, evenements = {};
    photos.forEach(function (p) {
      (p.personnes || []).forEach(function (n) { personnes[n] = (personnes[n] || 0) + 1; });
      var l = texteLieu(p);
      if (l) lieux[l] = (lieux[l] || 0) + 1;
      if (p.lieu && p.lieu.ville) {
        var v = [p.lieu.ville, p.lieu.pays].filter(Boolean).join(", ");
        lieux[v] = (lieux[v] || 0) + 1;
      }
      if (p.evenement) evenements[p.evenement] = (evenements[p.evenement] || 0) + 1;
    });
    function enListe(o) {
      return Object.keys(o).map(function (k) { return { texte: k, nb: o[k], cle: normaliser(k) }; });
    }
    listes = { personnes: enListe(personnes), lieux: enListe(lieux), evenements: enListe(evenements) };
  }

  // Chaque mot tapé doit commencer un mot du nom (« jo luq » trouve « Joséphine … LUQUE »).
  function chercher(liste, saisie) {
    var mots = normaliser(saisie).split(/[^a-z0-9]+/).filter(Boolean);
    if (!mots.length) return [];
    return liste.filter(function (e) {
      var morceaux = e.cle.split(/[^a-z0-9]+/).filter(Boolean);
      return mots.every(function (m) { return morceaux.some(function (x) { return x.indexOf(m) === 0; }); });
    }).sort(function (a, b) {
      var pa = a.cle.indexOf(mots[0]) === 0 ? 0 : 1, pb = b.cle.indexOf(mots[0]) === 0 ? 0 : 1;
      return pa - pb || b.nb - a.nb || a.texte.localeCompare(b.texte, "fr");
    }).slice(0, 8);
  }

  // ---------------------------------------------------------------- champ avec suggestions

  var compteur = 0;
  function champSuggestions(options) {
    var id = "corr-" + (++compteur);
    var entree = el("input", {
      type: "text", id: id, autocomplete: "off", spellcheck: "false", role: "combobox",
      "aria-autocomplete": "list", "aria-expanded": "false", "aria-controls": id + "-liste",
      placeholder: options.exemple || ""
    });
    var liste = el("ul", { id: id + "-liste", role: "listbox", classe: "suggestions", hidden: "" });
    var choix = [], actif = -1;
    var bloc = el("div", { classe: "champ-suggestions" }, [entree, liste]);
    bloc.entree = entree;
    bloc.estConnu = function () {
      var v = normaliser(entree.value.trim());
      return options.liste().some(function (e) { return e.cle === v; });
    };

    function fermer() { liste.hidden = true; entree.setAttribute("aria-expanded", "false"); actif = -1; }
    function choisir(texte) { entree.value = texte; fermer(); if (options.auChoix) options.auChoix(texte); }
    function surligner(i) {
      actif = i;
      Array.prototype.forEach.call(liste.children, function (li, j) { li.setAttribute("aria-selected", j === i ? "true" : "false"); });
      if (i >= 0) entree.setAttribute("aria-activedescendant", id + "-o" + i); else entree.removeAttribute("aria-activedescendant");
    }
    function proposer() {
      var saisie = entree.value.trim();
      choix = chercher(options.liste(), saisie);
      liste.textContent = "";
      choix.forEach(function (e, i) {
        liste.appendChild(el("li", { id: id + "-o" + i, role: "option", "aria-selected": "false", onmousedown: function (ev) { ev.preventDefault(); choisir(e.texte); } }, [
          el("span", { texte: e.texte }),
          options.unite ? el("small", { texte: e.nb + " " + (e.nb > 1 ? options.unite[1] : options.unite[0]) }) : null
        ]));
      });
      var exact = choix.some(function (e) { return e.cle === normaliser(saisie); });
      if (saisie && !exact && options.libre) {
        var i = choix.length;
        choix.push({ texte: saisie, nouveau: true });
        liste.appendChild(el("li", { id: id + "-o" + i, role: "option", "aria-selected": "false", classe: "nouveau", onmousedown: function (ev) { ev.preventDefault(); choisir(saisie); } }, [
          el("span", { texte: "« " + saisie + " »" }), el("small", { texte: options.libre })
        ]));
      }
      liste.hidden = !choix.length;
      entree.setAttribute("aria-expanded", choix.length ? "true" : "false");
      surligner(-1);
    }
    entree.addEventListener("input", proposer);
    entree.addEventListener("blur", function () { setTimeout(fermer, 120); });
    entree.addEventListener("keydown", function (e) {
      if (liste.hidden) { if (e.key === "ArrowDown" && entree.value) { proposer(); e.preventDefault(); } return; }
      if (e.key === "ArrowDown") { e.preventDefault(); surligner(Math.min(actif + 1, choix.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); surligner(Math.max(actif - 1, 0)); }
      else if (e.key === "Enter" && actif >= 0) { e.preventDefault(); choisir(choix[actif].texte); }
      else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); fermer(); }
    });
    return bloc;
  }

  // ---------------------------------------------------------------- la fenêtre

  var fenetre = null, photo = null, etat = null, identite = null;

  function chercherIdentite() {
    // Dans l'espace famille, Cloudflare Access connaît l'adresse de la personne connectée
    // (pas pour un accès autorisé par adresse IP : on demande alors seulement le nom).
    if (identite !== null || !SITE.espaceFamille || !window.fetch) return;
    identite = false;
    fetch("/cdn-cgi/access/get-identity", { credentials: "same-origin" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j && j.email) { identite = j.email; afficherIdentite(); } })
      .catch(function () { /* pas d'identité : le nom suffit */ });
  }
  function afficherIdentite() {
    var n = fenetre && fenetre.querySelector(".identite");
    if (n && identite) { n.textContent = "Connecté(e) avec " + identite; n.hidden = false; }
  }

  function ligneCorrection(titre, actuel, champ, cle) {
    var bouton = el("button", { type: "button", classe: "bouton bouton--discret", "aria-expanded": "false", texte: actuel ? "Corriger" : "Ajouter" });
    var zone = el("div", { classe: "correction__saisie", hidden: "" }, [champ]);
    bouton.addEventListener("click", function () {
      var ouvert = zone.hidden;
      zone.hidden = !ouvert;
      bouton.setAttribute("aria-expanded", ouvert ? "true" : "false");
      bouton.textContent = ouvert ? "Annuler" : (actuel ? "Corriger" : "Ajouter");
      etat.actifs[cle] = ouvert;
      if (ouvert) (champ.entree || champ.querySelector("input,textarea")).focus();
      majEnvoi();
    });
    return el("div", { classe: "correction__ligne" }, [
      el("div", { classe: "correction__tete" }, [
        el("div", null, [el("span", { classe: "correction__titre", texte: titre }), el("span", { classe: "correction__actuel", texte: actuel || "non renseigné" })]),
        bouton
      ]),
      zone
    ]);
  }

  function blocPersonnes() {
    var bloc = el("div", { classe: "correction__ligne" });
    bloc.appendChild(el("div", { classe: "correction__tete" }, [
      el("div", null, [el("span", { classe: "correction__titre", texte: "Personnes" }),
        el("span", { classe: "correction__actuel", texte: (photo.personnes || []).length ? "Touchez un nom mal reconnu pour le corriger." : "Personne n'est encore nommé sur cette photo." })])
    ]));

    var puces = el("div", { classe: "correction__personnes" });
    (photo.personnes || []).forEach(function (nom) {
      var saisie = null;
      var puce = el("button", { type: "button", classe: "puce-personne", "aria-pressed": "false", texte: nom });
      var detail = el("div", { classe: "correction__remplacement", hidden: "" });
      puce.addEventListener("click", function () {
        var ouvert = detail.hidden;
        detail.hidden = !ouvert;
        puce.setAttribute("aria-pressed", ouvert ? "true" : "false");
        if (ouvert && !saisie) {
          saisie = champSuggestions({ liste: function () { return listes.personnes; }, exemple: "Tapez le début du nom…", unite: ["photo", "photos"], libre: "nouveau nom", auChoix: majEnvoi });
          var retirer = el("label", { classe: "case" }, [el("input", { type: "checkbox" }), el("span", { texte: "Ce n'est pas " + nom + ", et je ne sais pas qui c'est" })]);
          retirer.querySelector("input").addEventListener("change", function () { saisie.entree.disabled = this.checked; majEnvoi(); });
          saisie.entree.addEventListener("input", majEnvoi);
          detail.appendChild(el("label", { classe: "petit", "for": saisie.entree.id, texte: "Ce n'est pas " + nom + ", c'est :" }));
          detail.appendChild(saisie);
          detail.appendChild(retirer);
          etat.remplacements.push({ nom: nom, saisie: saisie, retirer: retirer.querySelector("input"), detail: detail });
        }
        if (ouvert) saisie.entree.focus();
        majEnvoi();
      });
      puces.appendChild(el("div", { classe: "personne-a-corriger" }, [puce, detail]));
    });
    bloc.appendChild(puces);

    var ajouts = el("div", { classe: "correction__ajouts" });
    var boutonAjout = el("button", { type: "button", classe: "bouton bouton--discret", texte: "+ Ajouter une personne" });
    boutonAjout.addEventListener("click", function () {
      var saisie = champSuggestions({ liste: function () { return listes.personnes; }, exemple: "Tapez le début du nom…", unite: ["photo", "photos"], libre: "nouveau nom", auChoix: majEnvoi });
      var position = el("input", { type: "text", placeholder: "Où sur la photo ? (facultatif) — ex. : 2e rang, à gauche" });
      var retirer = el("button", { type: "button", classe: "lien-retirer", "aria-label": "Retirer cette ligne", texte: "Retirer" });
      var ligne = el("div", { classe: "ajout-personne" }, [saisie, position, retirer]);
      var entree = { saisie: saisie, position: position, ligne: ligne };
      retirer.addEventListener("click", function () { ligne.remove(); etat.ajouts.splice(etat.ajouts.indexOf(entree), 1); majEnvoi(); });
      saisie.entree.addEventListener("input", majEnvoi);
      etat.ajouts.push(entree);
      ajouts.appendChild(ligne);
      saisie.entree.focus();
      majEnvoi();
    });
    bloc.appendChild(ajouts);
    var pied = [boutonAjout];
    if (photo.inconnus) pied.push(el("span", { classe: "petit", texte: photo.inconnus + (photo.inconnus > 1 ? " visages restent à identifier" : " visage reste à identifier") }));
    bloc.appendChild(el("div", { classe: "correction__pied-personnes" }, pied));
    return bloc;
  }

  function construire() {
    etat = { actifs: {}, remplacements: [], ajouts: [] };
    var p = photo, date = p.date || {};
    var vignette = p.images && (p.images.miniature || p.images.web);
    if (vignette && !/^(https?:|\/)/.test(vignette)) vignette = (SITE.racine || document.body.getAttribute("data-racine") || "") + vignette;

    var champDate = el("div", null, [
      el("input", { type: "text", "aria-label": "Date proposée", placeholder: "ex. : été 1958, 12 avril 1947, vers 1950", oninput: majEnvoi })
    ]);
    var champLieu = champSuggestions({ liste: function () { return listes.lieux; }, exemple: "ex. : Casablanca, Maroc", unite: ["photo", "photos"], libre: "nouveau lieu", auChoix: majEnvoi });
    champLieu.entree.setAttribute("aria-label", "Lieu proposé");
    champLieu.entree.addEventListener("input", majEnvoi);
    var champEvenement = champSuggestions({ liste: function () { return listes.evenements; }, exemple: "ex. : Mariage de Colette et Josian", unite: ["photo", "photos"], libre: "nouvel événement", auChoix: majEnvoi });
    champEvenement.entree.setAttribute("aria-label", "Événement proposé");
    champEvenement.entree.addEventListener("input", majEnvoi);
    etat.champs = { date: champDate.querySelector("input"), lieu: champLieu.entree, evenement: champEvenement.entree };

    var memo = {};
    try { memo = JSON.parse(localStorage.getItem(MEMOIRE) || "{}"); } catch (e) { /* pas de mémoire locale */ }

    var certitude = el("select", { id: "corr-certitude" }, CERTITUDES.map(function (c) { return el("option", { texte: c }); }));
    var remarque = el("textarea", { id: "corr-remarque", rows: "2", placeholder: "Un détail, un souvenir, une source… (facultatif)", oninput: majEnvoi });
    var auteur = el("input", { type: "text", id: "corr-auteur", autocomplete: "name", value: memo.nom || "", placeholder: "Votre prénom et votre nom" });
    var pot = el("input", { type: "text", name: "_honey", tabindex: "-1", autocomplete: "off", classe: "pot-de-miel", "aria-hidden": "true" });
    etat.certitude = certitude; etat.remarque = remarque; etat.auteur = auteur; etat.pot = pot;

    var formulaire = el("form", { classe: "correction__formulaire", novalidate: "" }, [
      ligneCorrection("Date", date.precision === "inconnue" ? "" : date.libelle, champDate, "date"),
      ligneCorrection("Lieu", texteLieu(p), champLieu, "lieu"),
      ligneCorrection("Événement", p.evenement || "", champEvenement, "evenement"),
      blocPersonnes(),
      el("div", { classe: "correction__ligne correction__ligne--libre" }, [
        el("label", { "for": "corr-remarque", classe: "correction__titre", texte: "Autre chose à signaler" }), remarque
      ]),
      el("div", { classe: "correction__envoi" }, [
        el("label", { "for": "corr-certitude", classe: "petit", texte: "Votre certitude" }), certitude,
        el("label", { "for": "corr-auteur", classe: "petit", texte: "De la part de" }), auteur,
        el("p", { classe: "identite petit", hidden: "" }),
        pot,
        el("p", { classe: "correction__erreur", role: "alert", hidden: "" }),
        el("div", { classe: "correction__boutons" }, [
          el("button", { type: "submit", classe: "bouton", id: "corr-envoyer", texte: "Envoyer à Samuel" }),
          el("button", { type: "button", classe: "bouton bouton--discret", texte: "Annuler", onclick: fermer })
        ])
      ])
    ]);
    formulaire.addEventListener("submit", envoyer);

    fenetre.textContent = "";
    fenetre.appendChild(el("div", { classe: "correction__barre" }, [
      el("h2", { id: "corr-titre", texte: "Proposer une correction" }),
      el("button", { type: "button", classe: "fiche__fermer", "aria-label": "Fermer sans envoyer", texte: "Fermer", onclick: fermer })
    ]));
    fenetre.appendChild(el("div", { classe: "correction__corps" }, [
      el("div", { classe: "correction__photo" }, [
        vignette ? el("img", { src: vignette, alt: "" }) : null,
        el("p", null, [el("strong", { texte: p.numero || "Photo" }), el("br"), document.createTextNode([date.libelle, texteLieu(p)].filter(Boolean).join(" · "))])
      ]),
      el("p", { classe: "petit", texte: "Choisissez ce qui est à corriger ou à compléter. Samuel reçoit votre proposition par e-mail et met la photothèque à jour." }),
      formulaire
    ]));
    afficherIdentite();
  }

  // ---------------------------------------------------------------- ce qui est proposé

  function propositions() {
    var c = { date: null, lieu: null, evenement: null, remplacer: [], retirer: [], ajouter: [] };
    ["date", "lieu", "evenement"].forEach(function (k) {
      var v = etat.champs[k].value.trim();
      if (etat.actifs[k] && v) c[k] = v;
    });
    etat.remplacements.forEach(function (r) {
      if (r.detail.hidden) return;
      if (r.retirer.checked) c.retirer.push(r.nom);
      else if (r.saisie.entree.value.trim()) c.remplacer.push({ avant: r.nom, apres: r.saisie.entree.value.trim(), nouveau: !r.saisie.estConnu() });
    });
    etat.ajouts.forEach(function (a) {
      var nom = a.saisie.entree.value.trim();
      if (nom) c.ajouter.push({ nom: nom, position: a.position.value.trim(), nouveau: !a.saisie.estConnu() });
    });
    c.remarque = etat.remarque.value.trim();
    c.vide = !(c.date || c.lieu || c.evenement || c.remplacer.length || c.retirer.length || c.ajouter.length || c.remarque);
    return c;
  }

  function majEnvoi() {
    // le bouton reste actif ; on efface seulement l'éventuel message « choisissez quelque chose »
    var n = fenetre && fenetre.querySelector(".correction__erreur");
    if (n && !n.hidden && !propositions().vide && /Choisissez/.test(n.textContent)) { n.hidden = true; n.textContent = ""; }
  }

  function lienPhoto() {
    var base = SITE.espaceFamille ? location.origin + location.pathname : (SITE.adresseEspaceFamille || "") + "phototheque/index.html";
    return base + "#" + encodeURIComponent(photo.numero || photo.id);
  }

  function contenu(c, nom) {
    var p = photo, date = p.date || {};
    var champs = {
      "Photo": (p.numero || p.id) + (p.titre && p.titre !== p.numero ? " — " + p.titre : ""),
      "Lien": lienPhoto()
    };
    if (c.date) champs["Date"] = (date.libelle || "inconnue") + " → " + c.date;
    if (c.lieu) champs["Lieu"] = (texteLieu(p) || "non renseigné") + " → " + c.lieu;
    if (c.evenement) champs["Événement"] = (p.evenement || "non renseigné") + " → " + c.evenement;
    if (c.remplacer.length) champs["Personnes mal reconnues"] = c.remplacer.map(function (r) { return r.avant + " → " + r.apres + (r.nouveau ? " (nom absent de la photothèque)" : ""); }).join(" ; ");
    if (c.retirer.length) champs["Personnes à retirer"] = c.retirer.join(" ; ");
    if (c.ajouter.length) champs["Personnes à ajouter"] = c.ajouter.map(function (a) { return a.nom + (a.position ? " (" + a.position + ")" : "") + (a.nouveau ? " (nom absent de la photothèque)" : ""); }).join(" ; ");
    if (c.remarque) champs["Remarque"] = c.remarque;
    champs["Certitude"] = etat.certitude.value;
    champs["De la part de"] = nom + (identite ? " (connecté(e) avec " + identite + ")" : "");
    champs["Données pour la mise à jour"] = JSON.stringify({
      version: 1, photo: { numero: p.numero || "", id: p.id },
      actuel: { date: date.libelle || "", lieu: texteLieu(p), evenement: p.evenement || "", personnes: p.personnes || [] },
      propose: { date: c.date, lieu: c.lieu, evenement: c.evenement, remplacer: c.remplacer, retirer: c.retirer, ajouter: c.ajouter, remarque: c.remarque },
      certitude: etat.certitude.value, auteur: { nom: nom, email: identite || "" }, envoye_le: new Date().toISOString()
    });
    return champs;
  }

  function texteACopier(champs) {
    return Object.keys(champs).map(function (k) { return k + " : " + champs[k]; }).join("\n");
  }

  function erreur(message, cible) {
    var n = fenetre.querySelector(".correction__erreur");
    n.textContent = message;
    n.hidden = !message;
    if (cible) cible.focus();
  }

  function envoyer(e) {
    e.preventDefault();
    var c = propositions();
    if (c.vide) { erreur("Choisissez au moins une chose à corriger ou à compléter."); return; }
    var nom = etat.auteur.value.trim();
    if (!nom) { erreur("Indiquez votre prénom et votre nom, pour que Samuel sache qui propose la correction.", etat.auteur); return; }
    if (etat.pot.value) return; // robot
    erreur("");
    try { localStorage.setItem(MEMOIRE, JSON.stringify({ nom: nom })); } catch (err) { /* pas de mémoire locale */ }

    var champs = contenu(c, nom);
    var corps = Object.assign({
      _subject: "Correction photo " + (photo.numero || "") + " (" + nom + ")",
      _template: "table",
      _captcha: "false"
    }, champs);
    // Formulaire classique de FormSubmit, envoyé dans un cadre caché : pas de nouvel onglet.
    // FormSubmit renvoie vers la page merci du site public, qui confirme l'envoi par un message ;
    // sans confirmation dans le délai, la fenêtre propose la messagerie ou le texte à copier.
    // (L'envoi ajax restait sans réponse chez Samuel le 24/11 ; le formulaire classique passe.)
    var envoi = SITE.contributions || {};
    var nomCadre = "envoi-correction-" + Date.now();
    var cadre = el("iframe", { name: nomCadre, title: "Envoi de la correction", classe: "cadre-envoi", "aria-hidden": "true", tabindex: "-1" });
    var formulaire = el("form", { method: "POST", action: envoi.service + envoi.destinataire, target: nomCadre, hidden: "" });
    Object.keys(corps).forEach(function (k) { formulaire.appendChild(el("input", { type: "hidden", name: k, value: corps[k] })); });
    formulaire.appendChild(el("input", { type: "hidden", name: "_next", value: PAGE_MERCI }));
    document.body.appendChild(cadre);
    document.body.appendChild(formulaire);

    var bouton = fenetre.querySelector("#corr-envoyer");
    bouton.disabled = true;
    bouton.textContent = "Envoi en cours…";
    erreur("");
    var fini = false;
    function terminer() {
      fini = true;
      window.removeEventListener("message", ecouter);
      clearTimeout(minuterie);
      setTimeout(function () { cadre.remove(); formulaire.remove(); }, 2000);
    }
    function ecouter(ev) {
      if (fini || ev.origin !== ORIGINE_MERCI || !ev.data || ev.data.type !== "memoires-envoi-confirme") return;
      console.info("[correction] envoi confirmé par FormSubmit");
      terminer();
      merci(corps);
    }
    window.addEventListener("message", ecouter);
    var minuterie = setTimeout(function () {
      if (fini) return;
      console.warn("[correction] pas de confirmation de FormSubmit après " + DELAI_CONFIRMATION / 1000 + " s");
      terminer();
      bouton.disabled = false;
      bouton.textContent = "Réessayer";
      erreur("L'envoi n'a pas été confirmé : le service d'envoi ne répond pas pour le moment. Réessayez dans un instant, ou envoyez-la autrement :");
      var ancien = fenetre.querySelector(".correction__envoi .correction__copie");
      if (ancien) ancien.remove();
      var secours = autresMoyens(corps);
      secours.open = true;
      fenetre.querySelector(".correction__envoi").appendChild(secours);
    }, DELAI_CONFIRMATION);
    console.info("[correction] envoi par le formulaire FormSubmit (cadre caché)");
    formulaire.submit();
  }

  // Autres moyens d'envoyer : la messagerie de la personne (e-mail prérempli) ou le texte à copier.
  function autresMoyens(corps) {
    var champs = {};
    Object.keys(corps).forEach(function (k) { if (k.charAt(0) !== "_") champs[k] = corps[k]; });
    var texte = texteACopier(champs);
    var envoi = SITE.contributions || {};
    var courriel = "mailto:" + envoi.destinataire + "?subject=" + encodeURIComponent(corps._subject) + "&body=" + encodeURIComponent(texte);
    var aire = el("textarea", { rows: "6", readonly: "", "aria-label": "Texte de la correction à copier" });
    aire.value = texte;
    return el("details", { classe: "correction__copie" }, [
      el("summary", { classe: "petit", texte: "Envoyer autrement" }),
      el("div", { classe: "correction__boutons" }, [
        el("a", { classe: "bouton bouton--discret", href: courriel, texte: "Envoyer avec ma messagerie" }),
        el("button", { type: "button", classe: "bouton bouton--discret", texte: "Copier le texte", onclick: function () {
          aire.select();
          try { navigator.clipboard.writeText(aire.value); } catch (err) { document.execCommand("copy"); }
          this.textContent = "Copié";
        } })
      ]),
      aire
    ]);
  }

  function merci(envoye) {
    var corps = fenetre.querySelector(".correction__corps");
    corps.textContent = "";
    var retour = el("button", { type: "button", classe: "bouton", texte: "Revenir à la photo", onclick: fermer });
    corps.appendChild(el("div", { classe: "correction__merci", role: "status" }, [
      el("p", { classe: "grand", texte: "Merci !" }),
      el("p", { texte: "Votre proposition pour la photo " + (photo.numero || "") + " est partie : Samuel la reçoit par e-mail et mettra la photothèque à jour." }),
      retour
    ]));
    retour.focus();
  }

  function fermer() { if (fenetre && fenetre.open) fenetre.close(); }

  window.CorrectionPhoto = {
    ouvrir: function (p, photos) {
      photo = p;
      if (!listes) construireListes(photos || []);
      if (!fenetre) {
        fenetre = el("dialog", { classe: "correction", "aria-labelledby": "corr-titre" });
        fenetre.addEventListener("click", function (e) { if (e.target === fenetre) fermer(); });
        document.body.appendChild(fenetre);
      }
      construire();
      chercherIdentite();
      fenetre.showModal();
      var premier = fenetre.querySelector(".correction__formulaire button");
      if (premier) premier.focus();
    }
  };
})();

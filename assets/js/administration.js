/* Tableau de modération. La page et ses appels passent par le contrôle d’accès serveur. */
(function () {
  "use strict";

  var el = window.SITE.el;
  var liste = document.getElementById("liste-admin");
  var message = document.getElementById("message-admin");
  var outils = document.getElementById("outils-admin");
  var filtreEtat = document.getElementById("etat-admin");
  var filtreType = document.getElementById("type-admin");
  var recherche = document.getElementById("q-admin");
  var indicateurs = document.getElementById("indicateurs-admin");
  var infos = {
    "proposée": "En attente", "à vérifier": "À vérifier", "confirmée": "Acceptée",
    "appliquée": "Intégrée", "rejetée": "Refusée"
  };
  var champsPhoto = { date: "Date", lieu: "Lieu", evenement: "Événement" };
  var arbre = new Map(((window.ARBRE || {}).personnes || []).map(function (p) { return [p.id, p]; }));
  var corrections = [];
  var actualisation = 0;

  function date(s) {
    var d = new Date(s);
    return s && !isNaN(d) ? d.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" }) : "";
  }
  function valeurs(v) { return Array.isArray(v) ? v.filter(Boolean) : []; }
  function joindre(v) { return v.filter(Boolean).join(" · "); }
  function nom(p) { return p && [p.prenoms, p.nom_usage || p.nom].filter(Boolean).join(" "); }
  function mention(texte) { return el("p", { classe: "meta-admin", texte: texte }); }

  function api(suite, corps) {
    return fetch("/api/corrections" + suite, {
      method: corps ? "POST" : "GET", credentials: "same-origin", cache: "no-store",
      headers: corps ? { "Content-Type": "application/json" } : {},
      body: corps ? JSON.stringify(corps) : undefined
    }).then(async function (r) {
      if (!(r.headers.get("content-type") || "").includes("application/json")) {
        throw new Error("Session indisponible. Rechargez la page pour vous reconnecter.");
      }
      var donnees = await r.json();
      if (!r.ok) throw new Error(donnees.message || "La demande n’a pas pu être traitée.");
      return donnees;
    });
  }

  function valeursFiche(c) {
    var p = arbre.get(c.personne.id);
    if (!p) return [];
    var liens = valeurs(p.parents).concat(valeurs(p.conjoints), valeurs(p.fratrie_declaree)).map(function (id) { return nom(arbre.get(id)); });
    var enfants = Array.from(arbre.values()).filter(function (x) { return valeurs(x.parents).includes(p.id); }).map(nom);
    var possibles = {
      "Identité": joindre([nom(p), p.nom_usage && p.nom_usage !== p.nom ? "Nom de naissance " + p.nom : "", p.surnom]),
      "Naissance": p.naissance && joindre([p.vivant === false && p.naissance.date, p.naissance.lieu]),
      "Décès": p.vivant === false && p.deces && joindre([p.deces.date, p.deces.lieu]),
      "Lien de parenté": joindre(Array.from(new Set(liens.concat(enfants)))),
      "Biographie": p.bio, "Source": joindre(valeurs(p.sources))
    };
    return [possibles[(c.propose || {}).champ]].filter(Boolean);
  }

  function original(c) {
    if (c.personne) return valeursFiche(c);
    var a = c.actuel || {}, p = c.propose || {};
    var valeursActuelles = Object.keys(champsPhoto).filter(function (cle) { return p[cle] || c.retenue?.[cle]; })
      .map(function (cle) { return champsPhoto[cle] + " — " + (a[cle] || "non renseigné"); });
    if (valeurs(p.remplacer).length || valeurs(p.ajouter).length || valeurs(p.retirer).length ||
        valeurs(c.retenue?.remplacer).length || valeurs(c.retenue?.ajouter).length || valeurs(c.retenue?.retirer).length) {
      valeursActuelles.push("Personnes identifiées — " + (joindre(valeurs(a.personnes)) || "aucun nom enregistré"));
    }
    return valeursActuelles;
  }

  function resume(p) {
    var lignes = Object.keys(champsPhoto).filter(function (cle) { return p[cle]; })
      .map(function (cle) { return champsPhoto[cle] + " — " + p[cle]; });
    valeurs(p.remplacer).forEach(function (r) { lignes.push("Remplacer " + r.avant + " par " + r.apres); });
    valeurs(p.retirer).forEach(function (n) { lignes.push("Retirer " + n); });
    valeurs(p.ajouter).forEach(function (x) { lignes.push("Ajouter " + x.nom + (x.position ? " (" + x.position + ")" : "")); });
    if (p.champ) lignes.push(p.champ);
    if (p.remarque) lignes.push(p.remarque);
    if (p.source) lignes.push("Source — " + p.source);
    return lignes;
  }

  function colonne(titre, lignes, sinon) {
    return el("div", { classe: "comparaison-admin__colonne" }, [
      el("dt", { texte: titre }),
      el("dd", null, lignes.length ? [el("ul", null, lignes.map(function (ligne) { return el("li", { texte: ligne }); }))]
        : [mention(sinon)])
    ]);
  }

  function champTexte(libelle, valeur, max, long) {
    var controle = el(long ? "textarea" : "input", { maxlength: max, rows: long ? 3 : null });
    controle.value = valeur || "";
    return { noeud: el("label", null, [libelle, controle]), lire: function () { return controle.value.trim(); } };
  }

  function listeEditable(titre, elements, colonnes, lectrice) {
    var groupe = el("fieldset", { classe: "personnes-admin" }, [el("legend", { texte: titre })]);
    var lireLignes = [];
    var lignes = el("div");
    function ligne(x) {
      var champs = colonnes.map(function (libelle, i) { return champTexte(libelle, x[i], 300, false); });
      var noeud = el("div", { classe: "personnes-admin__ligne" }, champs.map(function (c) { return c.noeud; }));
      var lire = function () { return lectrice(champs.map(function (c) { return c.lire(); }), x); };
      var retirer = el("button", { type: "button", classe: "lien-effacer", texte: "Enlever cette ligne" });
      retirer.addEventListener("click", function () { lireLignes.splice(lireLignes.indexOf(lire), 1); noeud.remove(); ajouter.focus(); });
      noeud.appendChild(retirer);
      lignes.appendChild(noeud);
      lireLignes.push(lire);
      return noeud;
    }
    var ajouter = el("button", { type: "button", classe: "lien-effacer", texte: "Ajouter une ligne — " + titre.toLowerCase() });
    ajouter.addEventListener("click", function () { ligne([]).querySelector("input").focus(); });
    elements.forEach(ligne);
    groupe.appendChild(lignes);
    groupe.appendChild(ajouter);
    return { noeud: groupe, lire: function () { return lireLignes.map(function (lire) { return lire(); }).filter(Boolean); } };
  }

  function editeur(c) {
    var proposition = c.retenue || c.propose || {};
    var champs;
    if (c.personne) {
      champs = {
        champ: champTexte("Information à corriger", proposition.champ, 120),
        remarque: champTexte("Correction retenue", proposition.remarque, 3000, true),
        source: champTexte("Source ou souvenir", proposition.source, 1500, true)
      };
    } else {
      champs = Object.fromEntries(Object.keys(champsPhoto).map(function (cle) {
        return [cle, champTexte(champsPhoto[cle], proposition[cle], cle === "date" ? 200 : 500)];
      }));
      champs.remplacer = listeEditable("Remplacements", valeurs(proposition.remplacer).map(function (r) { return [r.avant, r.apres, r.nouveau]; }),
        ["Nom actuel", "Nom retenu"], function (v, x) { return v[0] || v[1] ? { avant: v[0], apres: v[1], nouveau: v[1] === x[1] && x[2] === true } : null; });
      champs.retirer = listeEditable("Noms à retirer", valeurs(proposition.retirer).map(function (n) { return [n]; }),
        ["Nom"], function (v) { return v[0]; });
      champs.ajouter = listeEditable("Noms à ajouter", valeurs(proposition.ajouter).map(function (x) { return [x.nom, x.position, x.nouveau]; }),
        ["Nom", "Position"], function (v, x) { return v[0] ? { nom: v[0], position: v[1], nouveau: v[0] === x[0] && x[2] === true } : null; });
      champs.remarque = champTexte("Remarque à reporter", proposition.remarque, 3000, true);
    }
    return {
      noeud: el("div", { classe: "edition-admin", hidden: "" }, Object.values(champs).map(function (c) { return c.noeud; })),
      lire: function () { return Object.fromEntries(Object.entries(champs).map(function ([k, ch]) { return [k, ch.lire()]; })); }
    };
  }

  function formulaire(c) {
    var modif = editeur(c);
    var options = [["", "Choisir une décision"], ["confirmée", "Accepter"], ["modifier", "Modifier et accepter"],
      ["à vérifier", "Demander une précision"], ["rejetée", "Refuser"]];
    if (c.statut === "confirmée") options.push(["appliquée", "Marquer comme intégrée"]);
    var choix = el("select", { required: "" }, options.map(function ([v, t]) { return el("option", { value: v, texte: t }); }));
    var note = champTexte("Motif ou précision à demander", "", 2000, true);
    var info = mention("");
    var retour = el("p", { classe: "meta-admin", role: "status", "aria-atomic": "true" });
    var bouton = el("button", { type: "submit", classe: "bouton", texte: "Enregistrer la décision" });
    var form = el("form", { classe: "decision-admin" }, [
      el("label", null, ["Décision", choix]), modif.noeud, note.noeud, info, bouton, retour
    ]);
    choix.addEventListener("change", function () {
      modif.noeud.hidden = choix.value !== "modifier";
      info.textContent = choix.value === "à vérifier"
        ? "La précision est consignée dans le tableau pour le suivi."
        : (choix.value === "appliquée" ? "À utiliser après report dans le fichier source et vérification de la fiche." : "");
    });
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      if (bouton.disabled || !choix.value) return;
      bouton.disabled = true;
      var corps = { statut: choix.value === "modifier" ? "confirmée" : choix.value, revision: c.revision, note: note.lire() };
      if (choix.value === "modifier") corps.retenue = modif.lire();
      try {
        await api("/" + c.id + "/statut", corps);
        await charger("Décision enregistrée.");
        message.focus();
      } catch (e) {
        retour.textContent = e.message;
      } finally {
        bouton.disabled = false;
      }
    });
    return el("details", { classe: "repli-admin" }, [el("summary", { texte: "Modérer" }), form]);
  }

  function carte(c) {
    var photo = c.photo || {};
    var titre = c.personne ? c.personne.nom : "Photo " + (photo.numero || photo.id || "");
    var lien = c.personne ? "/arbre/index.html#" + encodeURIComponent(c.personne.id)
      : "/phototheque/index.html#" + encodeURIComponent(photo.numero || photo.id || "");
    var avis = c.avis || {};
    var changements = valeurs(c.historique);
    var voix = valeurs(avis.liste);
    var complements = [];
    if (voix.length) complements.push(el("details", { classe: "repli-admin" }, [
      el("summary", { texte: "Avis de la famille" }),
      el("ul", null, voix.map(function (v) {
        return el("li", { texte: joindre([v.nom, v.avis === "confirme" ? "confirme" : "doute", date(v.cree_le)]) });
      }))
    ]));
    if (changements.length) complements.push(el("details", { classe: "repli-admin" }, [
      el("summary", { texte: "Historique des décisions (" + changements.length + ")" }),
      el("ol", null, changements.map(function (d) {
        return el("li", null, [
          el("strong", { texte: infos[d.statut] || d.statut }), mention(joindre([date(d.date), d.note])),
          d.retenue ? el("ul", null, resume(d.retenue).map(function (l) { return el("li", { texte: l }); })) : null
        ]);
      }))
    ]));
    var comparer = [colonne(c.personne ? "Sur la fiche" : "Valeur à la proposition", original(c), "Consulter la fiche liée."),
      colonne("Proposition initiale", resume(c.propose || {}), "Aucun détail renseigné.")];
    if (c.retenue && JSON.stringify(c.propose) !== JSON.stringify(c.retenue)) {
      comparer.push(colonne("Valeur retenue", resume(c.retenue), ""));
    }
    return el("article", { classe: "fiche-admin" }, [
      el("div", { classe: "fiche-admin__tete" }, [
        el("h2", null, [el("a", { href: lien, texte: titre })]),
        el("span", { classe: "statut-admin", "data-statut": c.statut, texte: infos[c.statut] || c.statut })
      ]),
      mention(joindre(["Proposition " + c.id, date(c.cree_le), c.auteur?.nom || c.auteur?.email, c.certitude])),
      el("dl", { classe: "comparaison-admin" }, comparer),
      mention(joindre([(avis.confirme || 0) + " confirmation(s)", (avis.doute || 0) + " doute(s)"])),
      ...complements,
      c.statut !== "appliquée" ? formulaire(c) : null
    ]);
  }

  function rendre(texte) {
    var mots = window.SITE.normaliser(recherche.value).trim().split(/\s+/).filter(Boolean);
    var etat = filtreEtat.value;
    var visibles = corrections.filter(function (c) {
      if (filtreType.value && filtreType.value !== (c.personne ? "personne" : "photo")) return false;
      if (etat === "ouvert" ? !["proposée", "à vérifier"].includes(c.statut) : etat && etat !== c.statut) return false;
      var contenu = window.SITE.normaliser(JSON.stringify([c.id, c.photo, c.personne, c.actuel, c.propose, c.retenue, c.auteur?.nom]));
      return mots.every(function (m) { return contenu.includes(m); });
    });
    liste.replaceChildren(...visibles.map(carte));
    message.textContent = [texte, visibles.length ? window.SITE.pluriel(visibles.length, "proposition", "propositions")
      : (corrections.length ? "Aucune proposition pour ces filtres." : "Aucune proposition reçue pour le moment.")].filter(Boolean).join(" ");
  }

  function rendreIndicateurs() {
    var rubriques = [["ouvert", "À examiner"], ["confirmée", "À intégrer"], ["appliquée", "Intégrées"], ["rejetée", "Refusées"]];
    indicateurs.replaceChildren(...rubriques.map(function ([cle, titre]) {
      var n = corrections.filter(function (c) { return cle === "ouvert" ? ["proposée", "à vérifier"].includes(c.statut) : c.statut === cle; }).length;
      var b = el("button", { type: "button" }, [el("strong", { texte: n }), titre]);
      b.addEventListener("click", function () { filtreEtat.value = cle; rendre(); });
      return b;
    }));
  }

  async function charger(texte) {
    var version = ++actualisation;
    try {
      var donnees = await api("?moderation=1");
      if (version !== actualisation) return;
      corrections = donnees.corrections || [];
      outils.hidden = false;
      rendreIndicateurs();
      rendre(texte);
    } catch (e) {
      if (version !== actualisation) return;
      message.textContent = e.message + " ";
      var recharger = el("button", { type: "button", classe: "lien-effacer", texte: "Réessayer" });
      recharger.addEventListener("click", function () { charger(); });
      message.appendChild(recharger);
    }
  }

  Object.entries(infos).forEach(function ([v, n]) { filtreEtat.appendChild(el("option", { value: v, texte: n })); });
  message.tabIndex = -1;
  recherche.addEventListener("input", function () { rendre(); });
  [filtreEtat, filtreType].forEach(function (f) { f.addEventListener("change", function () { rendre(); }); });
  charger();
})();

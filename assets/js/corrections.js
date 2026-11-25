/* Page « Corrections proposées » : consultation et avis des proches. */
(function () {
  "use strict";
  var C = window.CorrectionPhoto, SITE = window.SITE || {};
  var el = SITE.el;
  var liste = document.getElementById("liste"), avis = document.getElementById("avis-corrections");
  var donnees = [];

  function message(texte) { avis.textContent = texte; avis.hidden = false; }

  function afficher() {
    var f = document.getElementById("filtre").value;
    var choisies = donnees.filter(function (c) {
      if (f === "toutes") return true;
      if (f === "a-valider") return c.certitude && c.certitude.indexOf("sûr(e)") === -1 && !(c.avis && c.avis.confirme) && c.statut === "proposée";
      return c.statut === f;
    });
    liste.textContent = "";
    choisies.forEach(function (c) {
      var carte = C.carteProposition(c, charger);
      var lien = c.personne ? el("a", { href: "../arbre/index.html#" + encodeURIComponent(c.personne.id), texte: "Arbre · " + c.personne.nom }) : el("a", { href: "../phototheque/index.html#" + encodeURIComponent(c.photo.numero || c.photo.id), texte: "Photo " + (c.photo.numero || c.photo.id) });
      carte.insertBefore(el("p", { classe: "proposition__photo" }, [lien]), carte.firstChild);
      liste.appendChild(carte);
    });
    document.getElementById("compte").textContent = choisies.length + " proposition" + (choisies.length > 1 ? "s" : "") +
      (f === "toutes" ? "" : " sur " + donnees.length);
  }

  function charger() {
    C.api("").then(function (j) {
      donnees = j.corrections || [];
      document.getElementById("outils").hidden = false;
      document.getElementById("acces-administration").hidden = !j.responsable;
      if (!donnees.length) message("Aucune correction proposée pour l’instant. Ouvrez une fiche de la photothèque ou de l’arbre pour en proposer une.");
      else avis.hidden = true;
      afficher();
    }).catch(function (e) {
      message(/reliée/.test(e.message || "") ? e.message + " Les corrections arrivent pour l'instant par e-mail."
        : "Cette page fonctionne dans l'espace famille, une fois connecté.");
    });
  }

  document.getElementById("filtre").addEventListener("change", afficher);
  charger();
})();

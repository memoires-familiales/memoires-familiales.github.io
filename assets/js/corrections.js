/* Page « Corrections proposées » : liste de la base des corrections de l'espace famille,
   avis des proches, statut (réservé aux responsables) et export du tableau. */
(function () {
  "use strict";
  var C = window.CorrectionPhoto, SITE = window.SITE || {};
  var el = SITE.el;
  var liste = document.getElementById("liste"), avis = document.getElementById("avis-corrections");
  var STATUTS = ["proposée", "confirmée", "à vérifier", "appliquée", "rejetée"];
  var donnees = [], responsable = false;

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
      var lien = el("a", { href: "../phototheque/index.html#" + encodeURIComponent(c.photo.numero || c.photo.id), texte: "Photo " + (c.photo.numero || c.photo.id) });
      carte.insertBefore(el("p", { classe: "proposition__photo" }, [lien]), carte.firstChild);
      if (responsable) {
        var choix = el("select", { "aria-label": "Statut de la proposition" }, STATUTS.map(function (s) {
          var o = el("option", { texte: s }); if (s === c.statut) o.selected = true; return o;
        }));
        choix.addEventListener("change", function () {
          C.api("/" + c.id + "/statut", { method: "POST", body: { statut: choix.value } }).then(charger)
            .catch(function () { message("Le statut n'a pas pu être changé."); });
        });
        carte.querySelector(".proposition__actions").appendChild(choix);
      }
      liste.appendChild(carte);
    });
    document.getElementById("compte").textContent = choisies.length + " proposition" + (choisies.length > 1 ? "s" : "") +
      (f === "toutes" ? "" : " sur " + donnees.length);
  }

  function charger() {
    C.api("").then(function (j) {
      donnees = j.corrections || [];
      responsable = !!j.responsable;
      document.getElementById("outils").hidden = false;
      var base = (SITE.racine || "") + "api/corrections?format=";
      var exp = document.getElementById("export");
      exp.textContent = "Télécharger le tableau : ";
      exp.appendChild(el("a", { href: base + "csv", texte: "tableur (CSV)" }));
      exp.appendChild(document.createTextNode(" · "));
      exp.appendChild(el("a", { href: base + "json", texte: "données (JSON)" }));
      if (!donnees.length) message("Aucune correction proposée pour l'instant. Elles se font depuis la fiche d'une photo : « Proposer une correction ».");
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

/* Menu commun à toutes les pages. La liste des rubriques est écrite ici une seule fois.
   Chaque page déclare <body data-racine="../" data-page="livre"> et <nav data-nav>. */
(function () {
  "use strict";

  var RUBRIQUES = [
    { id: "accueil", titre: "Accueil", chemin: "index.html" },
    { id: "phototheque", titre: "Photothèque", chemin: "phototheque/index.html" },
    { id: "livre", titre: "Le livre", chemin: "livre/index.html" },
    { id: "arbre", titre: "L'arbre", chemin: "arbre/index.html" },
    { id: "voix", titre: "La voix de Mamili", chemin: "voix/index.html" },
    { id: "archives", titre: "Archives", chemin: "archives/index.html" },
    { id: "films", titre: "Films", chemin: "films/index.html" },
    { id: "participer", titre: "Participer", chemin: "participer/index.html" }
  ];

  var racine = document.body.getAttribute("data-racine") || "";
  var page = document.body.getAttribute("data-page") || "";
  var nav = document.querySelector("[data-nav]");
  if (!nav) return;

  var bouton = document.createElement("button");
  bouton.type = "button";
  bouton.className = "menu-bouton";
  bouton.setAttribute("aria-expanded", "false");
  bouton.setAttribute("aria-controls", "menu-principal");
  bouton.textContent = "Menu";

  var liste = document.createElement("ul");
  liste.id = "menu-principal";
  RUBRIQUES.forEach(function (r) {
    var li = document.createElement("li");
    var a = document.createElement("a");
    a.href = racine + r.chemin;
    a.textContent = r.titre;
    if (r.id === page) a.setAttribute("aria-current", "page");
    li.appendChild(a);
    liste.appendChild(li);
  });

  nav.textContent = "";
  nav.appendChild(bouton);
  nav.appendChild(liste);

  function fermer() {
    bouton.setAttribute("aria-expanded", "false");
    liste.classList.remove("ouvert");
  }

  bouton.addEventListener("click", function () {
    var ouvert = bouton.getAttribute("aria-expanded") === "true";
    bouton.setAttribute("aria-expanded", String(!ouvert));
    liste.classList.toggle("ouvert", !ouvert);
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") fermer(); });
  document.addEventListener("click", function (e) { if (!nav.contains(e.target)) fermer(); });

  // Outils partagés par les pages de rubrique
  window.SITE = {
    racine: racine,
    normaliser: function (s) {
      return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    },
    el: function (tag, attrs, enfants) {
      var n = document.createElement(tag);
      Object.keys(attrs || {}).forEach(function (k) {
        if (attrs[k] == null || attrs[k] === false) return;
        if (k === "texte") n.textContent = attrs[k];
        else if (k === "classe") n.className = attrs[k];
        else n.setAttribute(k, attrs[k]);
      });
      (enfants || []).forEach(function (e) {
        if (e == null || e === "") return;
        n.appendChild(typeof e === "string" ? document.createTextNode(e) : e);
      });
      return n;
    },
    // Avis en tête de page : exemples fictifs en ligne, données privées en local
    avis: function (donnees, texteDemo) {
      var avis = document.getElementById("avis");
      if (!avis) return;
      avis.textContent = donnees && donnees.mode === "prive"
        ? "Vous consultez les données de la famille, chargées depuis le dossier « prive » de cet ordinateur. Elles ne sont pas publiées."
        : texteDemo;
      avis.hidden = false;
    },
    // Lien vers la photothèque filtrée
    lienPhotos: function (params) {
      var u = new URLSearchParams();
      Object.keys(params).forEach(function (k) {
        [].concat(params[k]).forEach(function (v) { if (v) u.append(k, v); });
      });
      return racine + "phototheque/index.html?" + u.toString();
    },
    pluriel: function (n, sing, plur) { return n + " " + (n > 1 ? plur : sing); }
  };
})();

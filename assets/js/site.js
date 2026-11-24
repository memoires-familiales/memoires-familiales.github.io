/* Menu commun à toutes les pages. La liste des rubriques est écrite ici une seule fois.
   Chaque page déclare <body data-racine="../" data-page="livre"> et <nav data-nav>. */
(function () {
  "use strict";

  // Adresse de l'espace famille (copie du site avec les données de la famille, protégée par
  // Cloudflare Access). Tant qu'elle est vide, le site public n'affiche aucun lien vers lui.
  var ADRESSE_ESPACE_FAMILLE = "https://espace-famille.pages.dev/";
  // Vrai dans la copie de l'espace famille : outils/preparer_espace_famille.py l'y déclare.
  var ESPACE_FAMILLE = window.ESPACE_FAMILLE === true;

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

  // Pictogrammes au trait (24 × 24), dessinés pour le site
  var ICONES = {
    accueil: '<path d="M4 11.5 12 5l8 6.5"/><path d="M6.5 10v9.5h11V10"/><path d="M10.5 19.5v-5h3v5"/>',
    phototheque: '<rect x="3.5" y="6.5" width="14" height="11" rx="1"/><path d="M6.5 4h14v11"/><path d="m3.5 15 4-4 3.5 3.5 2-2 4.5 4"/><circle cx="13.2" cy="9.8" r="1.2"/>',
    livre: '<path d="M12 7.2C10 5.7 7.5 5 4 5v13c3.5 0 6 .7 8 2.2 2-1.5 4.5-2.2 8-2.2V5c-3.5 0-6 .7-8 2.2Z"/><path d="M12 7.2v13"/>',
    arbre: '<path d="M12 21v-7.5"/><path d="m12 16-3-2.2M12 15l2.6-2"/><path d="M7.8 13.8a3.6 3.6 0 0 1-.9-6.9 5.2 5.2 0 0 1 10.2 0 3.6 3.6 0 0 1-.9 6.9Z"/>',
    voix: '<rect x="9" y="3.5" width="6" height="10.5" rx="3"/><path d="M5.8 11.2a6.2 6.2 0 0 0 12.4 0"/><path d="M12 17.4V20.5M9.2 20.5h5.6"/>',
    archives: '<rect x="3.5" y="4.5" width="17" height="4.5" rx="1"/><path d="M5 9v10.5h14V9"/><path d="M10 13h4"/>',
    films: '<rect x="4.5" y="3.5" width="15" height="17" rx="1.5"/><path d="M8.5 3.5v17M15.5 3.5v17M4.5 8h4M4.5 12h4M4.5 16h4M15.5 8h4M15.5 12h4M15.5 16h4"/>',
    famille: '<rect x="5" y="10.5" width="14" height="10" rx="1.5"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/><path d="M12 14.5v2.5"/>',
    participer: '<path d="M4.5 19.5 5.6 15 15.8 4.8a2 2 0 0 1 2.9 2.9L8.5 17.9Z"/><path d="m14.2 6.4 2.9 2.9"/><path d="M12 19.5h7.5"/>'
  };

  function icone(id) {
    var span = document.createElement("span");
    span.className = "icone";
    span.setAttribute("aria-hidden", "true");
    span.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + ICONES[id] + "</svg>";
    return span;
  }

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
    a.appendChild(icone(r.id));
    a.appendChild(document.createTextNode(r.titre));
    if (r.id === page) a.setAttribute("aria-current", "page");
    li.appendChild(a);
    liste.appendChild(li);
  });

  if (ADRESSE_ESPACE_FAMILLE && !ESPACE_FAMILLE) {
    var liFamille = document.createElement("li");
    liFamille.className = "lien-espace";
    var aFamille = document.createElement("a");
    aFamille.href = ADRESSE_ESPACE_FAMILLE;
    aFamille.appendChild(icone("famille"));
    aFamille.appendChild(document.createTextNode("Espace famille"));
    liFamille.appendChild(aFamille);
    liste.appendChild(liFamille);
  }

  // Dans l'espace famille : retour au site public et déconnexion de Cloudflare Access
  if (ESPACE_FAMILLE) {
    Array.prototype.forEach.call(document.querySelectorAll("[data-lien-public]"), function (n) { n.remove(); });
    [["https://memoires-familiales.github.io/", "Site public", "accueil"], ["/cdn-cgi/access/logout", "Se déconnecter", "famille"]].forEach(function (l) {
      var li = document.createElement("li");
      li.className = "lien-espace";
      var a = document.createElement("a");
      a.href = l[0];
      a.appendChild(icone(l[2]));
      a.appendChild(document.createTextNode(l[1]));
      li.appendChild(a);
      liste.appendChild(li);
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-etat-famille]"), function (n) { n.textContent = n.getAttribute("data-etat-famille"); });
  }

  nav.textContent = "";
  nav.appendChild(bouton);
  nav.appendChild(liste);

  // Dans l'espace famille, le nom du site porte la mention « Espace famille »
  var nomSite = document.querySelector(".bandeau__nom");
  if (ESPACE_FAMILLE && nomSite && !nomSite.querySelector(".mention-espace")) {
    var mention = document.createElement("span");
    mention.className = "mention-espace";
    mention.textContent = "Espace famille";
    nomSite.appendChild(mention);
  }

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

  // Une ombre légère sous la barre quand la page défile
  var bandeau = nav.closest(".bandeau");
  function ombre() { if (bandeau) bandeau.classList.toggle("defile", window.scrollY > 4); }
  window.addEventListener("scroll", ombre, { passive: true });
  ombre();

  // Outils partagés par les pages de rubrique
  window.SITE = {
    racine: racine,
    espaceFamille: ESPACE_FAMILLE,
    adresseEspaceFamille: ADRESSE_ESPACE_FAMILLE,
    texteDonneesFamille: ESPACE_FAMILLE
      ? "Espace famille : ces photos, enregistrements et documents sont réservés aux proches invités. Merci de ne pas les diffuser en dehors de la famille."
      : "Vous consultez les données de la famille, chargées depuis le dossier « prive » de cet ordinateur. Elles ne sont pas publiées.",
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
      if (donnees && donnees.mode === "public") { avis.hidden = true; return; }
      avis.textContent = donnees && donnees.mode === "prive" ? window.SITE.texteDonneesFamille : texteDemo;
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
    pluriel: function (n, sing, plur) { return n + " " + (n > 1 ? plur : sing); },
    // Deux jeux de données se croisent s'ils sont tous deux réels (publics ou privés) ou tous deux d'exemple
    memeNature: function (a, b) {
      function reel(d) { return !!d && (d.mode === "prive" || d.mode === "public"); }
      return reel(a) === reel(b);
    }
  };
  // Le site public présente la rubrique. La vue complète est utilisée dans
  // la copie protégée et quand les pages sont ouvertes depuis le disque.
  var rubriqueFamille = document.querySelector("template[data-rubrique-famille]");
  if (rubriqueFamille && (ESPACE_FAMILLE || location.protocol === "file:")) {
    var vue = rubriqueFamille.content.cloneNode(true);
    var sources = vue.querySelectorAll("script[data-src]");
    Array.prototype.forEach.call(sources, function (source) { source.remove(); });
    document.querySelector("main").replaceWith(vue);
    Array.prototype.forEach.call(sources, function (source) {
      var chemin = source.getAttribute("data-src");
      if (ESPACE_FAMILLE && chemin.indexOf("../data/demo/") === 0) return;
      var script = document.createElement("script");
      script.async = false;
      script.src = chemin;
      document.body.appendChild(script);
    });
  }
})();

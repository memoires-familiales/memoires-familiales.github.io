/* Carnet de recettes. Les fiches et leurs images sont chargées depuis l’espace famille. */
(function () {
  "use strict";

  var S = window.SITE, el = S.el;
  var carnet = window.RECETTES || { categories: [], recettes: [] };
  var recherche = document.getElementById("q-recettes");
  var categorie = document.getElementById("type-recettes");
  var recueil = document.getElementById("recueil-recettes");
  var etat = document.getElementById("etat-recettes");
  var compteur = document.getElementById("compte-recettes");
  var liste = document.getElementById("liste-recettes");
  var fiches = carnet.recettes.map(function (r) {
    return {
      recette: r,
      complete: !!(r.ingredients?.length && r.preparation?.length),
      index: normaliser([r.titre, r.alias, r.personne, r.recueil, r.origine, r.ingredients].flat().join(" "))
    };
  });

  function normaliser(texte) {
    return S.normaliser(texte).replace(/œ/g, "oe").replace(/æ/g, "ae").replace(/[^a-z0-9]+/g, " ").trim();
  }

  function option(texte) { return el("option", { value: texte, texte: texte }); }
  carnet.categories.forEach(function (c) { categorie.appendChild(option(c)); });
  Array.from(new Set(fiches.map(function (f) { return f.recette.recueil; }).filter(Boolean))).forEach(function (r) {
    recueil.appendChild(option(r));
  });

  function lienMedia(chemin) {
    return typeof chemin === "string" && /^prive\/recettes\/[a-z0-9-]+\.(jpg|webp)$/.test(chemin) ? S.racine + chemin : null;
  }

  function serie(titre, tag, valeurs) {
    if (!valeurs || !valeurs.length) return null;
    return el("section", null, [
      el("h3", { texte: titre }),
      el(tag, null, valeurs.map(function (v) { return el("li", { texte: v }); }))
    ]);
  }

  function carte(fiche) {
    var r = fiche.recette;
    var photo = lienMedia(r.photo);
    var scan = lienMedia(r.scan);
    var sousTitre = [r.personne || r.recueil, r.portions, !fiche.complete ? "Fiche à compléter" : ""].filter(Boolean).join(" · ");
    var provenance = [r.source, r.detailSource].filter(Boolean).join(" · ");
    var image = photo ? el("img", { src: photo, alt: "", loading: "lazy", decoding: "async", classe: "recette__image" }) : null;
    if (image) image.addEventListener("error", function () { image.remove(); }, { once: true });
    return el("details", { id: r.id, classe: "recette" }, [
      el("summary", null, [
        image,
        el("span", null, [
          el("strong", { texte: r.titre, classe: "recette__titre" }),
          sousTitre ? el("span", { texte: sousTitre, classe: "recette__meta" }) : null
        ])
      ]),
      el("div", { classe: "recette__contenu" }, [
        r.infos ? el("p", { texte: r.infos, classe: "recette__origine" }) : null,
        serie("Ingrédients", "ul", r.ingredients),
        serie("Préparation", "ol", r.preparation),
        r.note ? el("p", { texte: r.note }) : null,
        !fiche.complete && !r.note ? el("p", { texte: "Recette repérée dans le répertoire. La fiche détaillée reste à transcrire ou à retrouver." }) : null,
        scan ? el("p", null, [el("a", { href: scan, target: "_blank", rel: "noopener", texte: "Voir la fiche manuscrite" })]) : null,
        photo ? el("p", null, [el("a", { href: photo, target: "_blank", rel: "noopener", texte: "Agrandir la photo du recueil" })]) : null,
        provenance ? el("p", { texte: provenance, classe: "recette__origine" }) : null
      ])
    ]);
  }

  function rendre() {
    var mots = normaliser(recherche.value).split(" ").filter(Boolean);
    var groupes = new Map();
    var n = 0;
    fiches.forEach(function (f) {
      var r = f.recette;
      if (categorie.value && r.categorie !== categorie.value) return;
      if (recueil.value && r.recueil !== recueil.value) return;
      if (etat.value !== "tout" && f.complete !== (etat.value === "cuisiner")) return;
      if (!mots.every(function (mot) { return f.index.includes(mot); })) return;
      if (!groupes.has(r.categorie)) groupes.set(r.categorie, []);
      groupes.get(r.categorie).push(f);
      n++;
    });
    liste.replaceChildren();
    carnet.categories.forEach(function (c) {
      var groupe = groupes.get(c);
      if (!groupe) return;
      var cartes = groupe.sort(function (a, b) {
        return Number(b.complete) - Number(a.complete) || a.recette.titre.localeCompare(b.recette.titre, "fr");
      }).map(carte);
      liste.appendChild(el("section", { classe: "categorie-recettes" }, [
        el("h2", { texte: c }),
        el("div", { classe: "grille-recettes" }, cartes)
      ]));
    });
    compteur.textContent = n ? S.pluriel(n, "recette", "recettes") : "Aucune recette ne correspond aux filtres.";
  }

  if (!fiches.length) {
    document.getElementById("filtres-recettes").hidden = true;
    compteur.textContent = "Le carnet de recettes n’est pas disponible ici.";
    return;
  }

  [categorie, recueil, etat].forEach(function (champ) { champ.addEventListener("change", rendre); });
  recherche.addEventListener("input", rendre);
  if (location.hash) etat.value = "tout";
  rendre();
  var cible = S.ancre();
  if (cible?.classList.contains("recette")) {
    cible.open = true;
    cible.scrollIntoView();
  }
})();

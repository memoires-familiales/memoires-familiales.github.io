/* Les films de famille : un écran par film, et ses séquences. */
(function () {
  "use strict";
  var S = window.SITE, el = S.el;
  var films = window.FILMS || { films: [] };

  S.avis(films, "Ces films sont des exemples fictifs, sans image : ils montrent comment la page sera organisée. Les films de la famille seront réservés à la famille.");

  function secondes(t) {
    return String(t || "0").split(":").reduce(function (acc, x) { return acc * 60 + (parseInt(x, 10) || 0); }, 0);
  }

  var zone = document.getElementById("films");
  (films.films || []).forEach(function (f) {
    var video = f.fichier ? el("video", { controls: "", preload: "metadata", src: S.racine + f.fichier }) : null;
    var ecran = el("div", { classe: "ecran" }, video ? [video] : [
      el("span", { classe: "ecran__lecture", "aria-hidden": "true" }),
      el("span", { classe: "ecran__statut", texte: f.statut === "à numériser" ? "Bobine à numériser" : "Film à venir" })
    ]);

    var sequences = el("ol", { classe: "sequences", "aria-label": "Séquences du film" });
    (f.sequences || []).forEach(function (s) {
      var titre = video ? el("button", { type: "button", classe: "lien-effacer", texte: s.titre }) : el("span", { texte: s.titre });
      if (video) titre.addEventListener("click", function () { video.currentTime = secondes(s.debut); video.play(); });
      sequences.appendChild(el("li", null, [el("time", { texte: s.debut }), titre]));
    });

    var personnes = [];
    (f.personnes || []).forEach(function (n, i) {
      if (i) personnes.push(", ");
      personnes.push(el("a", { href: S.lienPhotos({ p: n }), texte: n }));
    });

    zone.appendChild(el("article", { classe: "film", id: f.id }, [
      ecran,
      el("div", null, [
        el("h2", { texte: f.titre }),
        el("p", { classe: "meta", texte: [f.date && f.date.libelle, f.lieu].filter(Boolean).join(", ") + (f.support || f.duree ? ". " + [f.support, f.duree].filter(Boolean).join(", ") : "") }),
        f.description ? el("p", { texte: f.description }) : null,
        (f.sequences || []).length ? sequences : null,
        el("div", { classe: "liens-croises" }, [
          personnes.length ? el("span", null, ["Avec : "].concat(personnes)) : null,
          f.chapitre ? el("a", { href: S.racine + "livre/index.html#chapitre-" + f.chapitre.numero, texte: "Chapitre " + f.chapitre.numero + ". " + f.chapitre.titre }) : null
        ])
      ])
    ]));
  });
  if (!zone.children.length) zone.appendChild(el("p", { classe: "vide-rubrique", texte: "Aucun film n'est encore numérisé." }));
})();

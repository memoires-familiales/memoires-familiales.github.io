/* Participer : prépare un message à envoyer à Samuel. Rien n'est enregistré ni envoyé par le site. */
(function () {
  "use strict";
  var TYPES = {
    identifier: "Mettre un nom sur un visage",
    corriger: "Corriger une date ou un lieu",
    souvenir: "Raconter un souvenir",
    document: "Signaler un document"
  };

  var form = document.getElementById("formulaire");
  var parametres = new URLSearchParams(location.search);
  if (parametres.get("photo")) document.getElementById("reference").value = parametres.get("photo");
  if (TYPES[parametres.get("type")]) form.querySelector('input[value="' + parametres.get("type") + '"]').checked = true;

  try { document.getElementById("auteur").value = localStorage.getItem("participer-prenom") || ""; } catch (e) { /* sans mémoire locale */ }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var proposition = document.getElementById("proposition").value.trim();
    var erreur = document.getElementById("erreur");
    if (!proposition) {
      erreur.textContent = "Écrivez votre proposition avant de préparer le message.";
      erreur.hidden = false;
      document.getElementById("proposition").focus();
      return;
    }
    erreur.hidden = true;
    var type = form.querySelector('input[name="type"]:checked').value;
    var reference = document.getElementById("reference").value.trim();
    var auteur = document.getElementById("auteur").value.trim();
    try { localStorage.setItem("participer-prenom", auteur); } catch (e2) { /* sans mémoire locale */ }

    var lignes = [
      "Bonjour Samuel,",
      "",
      "Pour les Mémoires de Mamili : " + TYPES[type].toLowerCase() + ".",
      reference ? "Photo ou document : " + reference : "",
      "",
      proposition,
      "",
      "Comment je le sais : " + document.getElementById("certitude").value.toLowerCase() + ".",
      "",
      auteur || ""
    ].filter(function (l, i, t) { return !(l === "" && t[i - 1] === ""); });

    document.getElementById("message").textContent = lignes.join("\n").trim();
    var bloc = document.getElementById("message-pret");
    bloc.hidden = false;
    document.getElementById("copie-ok").textContent = "";
    bloc.scrollIntoView({ block: "start" });
    document.getElementById("copier").focus();
  });

  document.getElementById("copier").addEventListener("click", function () {
    var texte = document.getElementById("message").textContent;
    var ok = document.getElementById("copie-ok");
    function repli() {
      var zone = document.createElement("textarea");
      zone.value = texte;
      zone.setAttribute("readonly", "");
      zone.style.position = "absolute";
      zone.style.left = "-9999px";
      document.body.appendChild(zone);
      zone.select();
      var reussi = false;
      try { reussi = document.execCommand("copy"); } catch (e) { reussi = false; }
      document.body.removeChild(zone);
      ok.textContent = reussi ? "Message copié." : "Sélectionnez le texte du message et copiez-le.";
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texte).then(function () { ok.textContent = "Message copié."; }, repli);
    } else {
      repli();
    }
  });
})();

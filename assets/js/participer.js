/* Participer : envoie la contribution par e-mail à Samuel (service FormSubmit), avec pièces jointes.
   Repli : préparer un message à copier et à envoyer soi-même. */
(function () {
  "use strict";

  // ---------------------------------------------------------------- réglages
  var ENVOI = {
    // Adresse qui reçoit les contributions. Après la première activation, FormSubmit
    // fournit une chaîne aléatoire à mettre ici à la place de l'adresse, pour la masquer.
    destinataire: ["samuel.rodriguez.1295", "gmail.com"].join("@"),
    service: "https://formsubmit.co/",
    merci: "https://memoires-familiales.github.io/participer/merci.html",
    maxFichiers: 10,
    maxOctets: 10 * 1024 * 1024 - 300 * 1024, // 10 Mo au total, avec une marge pour le texte
    reduireAuDela: 2.5 * 1024 * 1024,           // photos plus lourdes réduites…
    coteMax: 3000                                 // …à 3 000 pixels de côté au plus
  };

  var TYPES = {
    identifier: { titre: "Mettre un nom sur un visage", message: "Votre proposition", exemple: "Par exemple : à gauche, au premier rang, c'est tante Marie." },
    corriger: { titre: "Corriger une date ou un lieu", message: "Votre correction", exemple: "Par exemple : cette photo date plutôt de l'été 1958, à Casablanca." },
    souvenir: { titre: "Raconter un souvenir", message: "Votre souvenir", exemple: "Racontez avec vos mots : qui, où, quand, ce qui s'est passé." },
    photos: { titre: "Envoyer des photos", message: "Ce que montrent ces photos (facultatif)", exemple: "Qui est dessus, où et quand elles ont été prises, d'où elles viennent." },
    document: { titre: "Envoyer un document", message: "Le document en quelques mots", exemple: "De quoi s'agit-il, à qui il appartient, ce qu'il raconte." }
  };

  // ---------------------------------------------------------------- éléments
  function $(id) { return document.getElementById(id); }
  var form = $("formulaire");
  var fichiers = [];
  var transfertPossible = (function () { try { return !!new DataTransfer(); } catch (e) { return false; } })();

  function typeChoisi() { return form.querySelector('input[name="choix-type"]:checked').value; }

  function adapterAuType() {
    var t = typeChoisi(), info = TYPES[t];
    $("libelle-message").textContent = info.message;
    $("proposition").placeholder = info.exemple;
    $("bloc-certitude").hidden = t === "photos" || t === "document";
    $("bouton-fichiers").textContent = t === "photos" ? "Choisir les photos" : "Ajouter des photos ou des fichiers";
    $("titre-pieces").textContent = t === "photos" ? "Vos photos" : "Pièces jointes (facultatif)";
  }

  // Pré-remplissage : lien depuis une photo, coordonnées déjà saisies sur cet appareil
  var parametres = new URLSearchParams(location.search);
  if (parametres.get("photo")) $("reference").value = parametres.get("photo");
  if (TYPES[parametres.get("type")]) form.querySelector('input[value="' + parametres.get("type") + '"]').checked = true;
  try {
    var memo = JSON.parse(localStorage.getItem("participer-coordonnees") || "{}");
    $("auteur").value = memo.nom || "";
    $("courriel").value = memo.email || "";
    $("telephone").value = memo.telephone || "";
  } catch (e) { /* pas de mémoire locale */ }
  form.querySelectorAll('input[name="choix-type"]').forEach(function (r) { r.addEventListener("change", adapterAuType); });
  form.addEventListener("input", function (e) { if (e.target.id !== "fichiers") $("erreur").hidden = true; });
  adapterAuType();

  // ---------------------------------------------------------------- pièces jointes
  function taille(o) {
    return o >= 1024 * 1024 ? (o / 1024 / 1024).toFixed(1).replace(".", ",") + " Mo" : Math.max(1, Math.round(o / 1024)) + " Ko";
  }
  function total() { return fichiers.reduce(function (s, f) { return s + f.size; }, 0); }

  function chargerImage(fichier) {
    return new Promise(function (ok, ko) {
      var url = URL.createObjectURL(fichier);
      var img = new Image();
      img.onload = function () { ok({ img: img, url: url }); };
      img.onerror = function () { URL.revokeObjectURL(url); ko(new Error("illisible")); };
      img.src = url;
    });
  }

  // Copie le fichier en mémoire : l'original choisi sur le téléphone n'est pas toujours relisible au moment de l'envoi.
  function enMemoire(fichier) {
    return new Promise(function (ok) {
      var lecteur = new FileReader();
      lecteur.onload = function () {
        ok(new File([lecteur.result], fichier.name, { type: fichier.type || "application/octet-stream", lastModified: fichier.lastModified }));
      };
      lecteur.onerror = function () { ok(fichier); };
      lecteur.readAsArrayBuffer(fichier);
    });
  }

  // Réduit une photo trop lourde (JPEG, 3 000 px au plus). En cas d'échec, garde l'original.
  function preparer(fichier) {
    if (!/^image\//.test(fichier.type) || fichier.size <= ENVOI.reduireAuDela) return enMemoire(fichier);
    return chargerImage(fichier).then(function (r) {
      var l = r.img.naturalWidth, h = r.img.naturalHeight;
      var echelle = Math.min(1, ENVOI.coteMax / Math.max(l, h));
      var canvas = document.createElement("canvas");
      canvas.width = Math.round(l * echelle);
      canvas.height = Math.round(h * echelle);
      canvas.getContext("2d").drawImage(r.img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(r.url);
      return new Promise(function (ok) {
        canvas.toBlob(function (blob) {
          if (!blob || blob.size >= fichier.size) return ok(enMemoire(fichier));
          var nom = fichier.name.replace(/\.[^.]+$/, "") + ".jpg";
          ok(new File([blob], nom, { type: "image/jpeg", lastModified: fichier.lastModified }));
        }, "image/jpeg", 0.88);
      });
    }).catch(function () { return enMemoire(fichier); });
  }

  function afficherFichiers() {
    $("erreur").hidden = true;
    var liste = $("liste-fichiers");
    liste.textContent = "";
    fichiers.forEach(function (f, i) {
      var retirer = document.createElement("button");
      retirer.type = "button";
      retirer.className = "lien-effacer";
      retirer.textContent = "Retirer";
      retirer.setAttribute("aria-label", "Retirer " + f.name);
      retirer.addEventListener("click", function () { fichiers.splice(i, 1); afficherFichiers(); });
      var li = document.createElement("li");
      var nom = document.createElement("span");
      nom.className = "nom-fichier";
      nom.textContent = f.name;
      var poids = document.createElement("span");
      poids.className = "poids-fichier";
      poids.textContent = taille(f.size) + (f._reduite ? ", réduite" : "");
      li.appendChild(nom); li.appendChild(poids); li.appendChild(retirer);
      liste.appendChild(li);
    });
    if (fichiers.length) {
      var t = document.createElement("li");
      t.className = "total-fichiers" + (total() > ENVOI.maxOctets ? " trop" : "");
      t.textContent = fichiers.length + (fichiers.length > 1 ? " fichiers, " : " fichier, ") + taille(total()) + " au total" +
        (total() > ENVOI.maxOctets ? " : c'est trop lourd pour un seul envoi. Retirez des fichiers, ou envoyez-les en plusieurs fois." : "");
      liste.appendChild(t);
    }
  }

  $("fichiers").addEventListener("change", function () {
    var choisis = Array.prototype.slice.call(this.files || []);
    if (!transfertPossible) {
      // Navigateur ancien : on envoie la sélection telle quelle, sans réduction ni cumul
      fichiers = choisis;
      this.name = "Pièces jointes";
      afficherFichiers();
      return;
    }
    var place = ENVOI.maxFichiers - fichiers.length;
    if (choisis.length > place) montrerErreur("Pas plus de " + ENVOI.maxFichiers + " fichiers par envoi : les suivants n'ont pas été ajoutés.");
    choisis = choisis.slice(0, Math.max(0, place));
    var champ = this;
    $("bouton-fichiers").textContent = "Préparation des fichiers…";
    Promise.all(choisis.map(function (f) {
      return preparer(f).then(function (p) { if (p.size < f.size) p._reduite = true; return p; });
    })).then(function (prets) {
      fichiers = fichiers.concat(prets);
      champ.value = "";
      adapterAuType();
      afficherFichiers();
    });
  });

  // ---------------------------------------------------------------- vérification et envoi
  function montrerErreur(texte, champ) {
    var e = $("erreur");
    e.textContent = texte;
    e.hidden = false;
    if (champ) champ.focus();
  }

  function verifier(pourEnvoi) {
    var t = typeChoisi();
    var message = $("proposition").value.trim();
    if (!message && !(pourEnvoi && (t === "photos" || t === "document") && fichiers.length)) {
      montrerErreur(t === "photos" ? "Ajoutez au moins une photo, ou écrivez un message." : "Écrivez votre message avant d'envoyer.", $("proposition"));
      return false;
    }
    if (pourEnvoi && t === "photos" && !fichiers.length && !message) {
      montrerErreur("Ajoutez au moins une photo.", $("fichiers"));
      return false;
    }
    if (pourEnvoi) {
      if (!$("auteur").value.trim()) { montrerErreur("Indiquez votre prénom et votre nom.", $("auteur")); return false; }
      var courriel = $("courriel").value.trim(), tel = $("telephone").value.trim();
      if (!courriel && !tel) { montrerErreur("Indiquez votre e-mail ou votre téléphone, pour que Samuel puisse vous répondre.", $("courriel")); return false; }
      if (courriel && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(courriel)) { montrerErreur("L'adresse e-mail ne semble pas complète.", $("courriel")); return false; }
      if (tel && tel.replace(/\D/g, "").length < 6) { montrerErreur("Le numéro de téléphone ne semble pas complet.", $("telephone")); return false; }
      if (total() > ENVOI.maxOctets) { montrerErreur("Les fichiers dépassent 10 Mo au total : retirez-en, ou envoyez-les en plusieurs fois.", $("fichiers")); return false; }
    }
    $("erreur").hidden = true;
    return true;
  }

  function memoriser() {
    try {
      localStorage.setItem("participer-coordonnees", JSON.stringify({
        nom: $("auteur").value.trim(), email: $("courriel").value.trim(), telephone: $("telephone").value.trim()
      }));
    } catch (e) { /* pas de mémoire locale */ }
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!verifier(true)) return;
    memoriser();
    var t = typeChoisi();
    $("champ-type").value = TYPES[t].titre;
    $("champ-sujet").value = "Mémoires de Mamili : " + TYPES[t].titre.toLowerCase() + " (" + $("auteur").value.trim() + ")";
    $("champ-suite").value = /github\.io$/.test(location.hostname)
      ? location.origin + location.pathname.replace(/[^/]*$/, "") + "merci.html"
      : ENVOI.merci;
    if (t === "photos" || t === "document") $("certitude").disabled = true;
    // Le choix du type est déjà transmis en clair dans « Type de contribution »
    form.querySelectorAll('input[name="choix-type"]').forEach(function (r) { r.disabled = true; });

    // Une pièce jointe par champ, comme le demande FormSubmit
    var zone = $("champs-fichiers");
    zone.textContent = "";
    if (transfertPossible) {
      fichiers.forEach(function (f, i) {
        var champ = document.createElement("input");
        champ.type = "file";
        champ.name = "Pièce jointe " + (i + 1);
        var dt = new DataTransfer();
        dt.items.add(f);
        champ.files = dt.files;
        zone.appendChild(champ);
      });
    }

    form.action = ENVOI.service + ENVOI.destinataire;
    var bouton = $("envoyer");
    bouton.disabled = true;
    bouton.textContent = fichiers.length ? "Envoi des fichiers en cours…" : "Envoi en cours…";
    form.submit();
  });

  // Les retours arrière du navigateur peuvent laisser le bouton désactivé
  window.addEventListener("pageshow", function () {
    $("envoyer").disabled = false;
    $("envoyer").textContent = "Envoyer à Samuel";
    $("certitude").disabled = false;
    form.querySelectorAll('input[name="choix-type"]').forEach(function (r) { r.disabled = false; });
  });

  // ---------------------------------------------------------------- repli : message à copier
  $("preparer").addEventListener("click", function () {
    if (!verifier(false)) return;
    memoriser();
    var t = typeChoisi();
    var reference = $("reference").value.trim();
    var lignes = [
      "Bonjour Samuel,",
      "",
      "Pour les Mémoires de Mamili : " + TYPES[t].titre.toLowerCase() + ".",
      reference ? "Photo ou document : " + reference : "",
      "",
      $("proposition").value.trim(),
      "",
      $("bloc-certitude").hidden ? "" : "Comment je le sais : " + $("certitude").value.toLowerCase() + ".",
      "",
      $("auteur").value.trim()
    ].filter(function (l, i, tab) { return !(l === "" && tab[i - 1] === ""); });
    $("message").textContent = lignes.join("\n").trim();
    var bloc = $("message-pret");
    bloc.hidden = false;
    $("copie-ok").textContent = "";
    bloc.scrollIntoView({ block: "start" });
    $("copier").focus();
  });

  $("copier").addEventListener("click", function () {
    var texte = $("message").textContent;
    var ok = $("copie-ok");
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

import { administrateur } from "../_lib/acces.js";

const ENTETES = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "same-origin",
  "Content-Security-Policy": "default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
};

function page(titre, corps, scripts = "") {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titre} — Mémoires familiales</title>
<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/css/site.css">
<link rel="stylesheet" href="/assets/css/administration.css">
</head>
<body data-racine="/" data-page="administration">
<header class="bandeau">
  <a class="bandeau__nom" href="/">Mémoires familiales</a>
  <nav aria-label="Navigation principale" data-nav><a href="/">Accueil</a></nav>
</header>
<main class="page page-administration">${corps}</main>
${scripts}
</body>
</html>`;
}

export async function onRequest({ request, env }) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(null, { status: 405, headers: { ...ENTETES, Allow: "GET, HEAD" } });
  }
  const autorise = await administrateur(request, env);
  if (!autorise) {
    return new Response(request.method === "HEAD" ? null : page("Accès réservé", `
      <div class="tete"><h1>Accès réservé</h1>
      <p class="resume">Connectez-vous avec le compte administrateur de l’espace famille.</p></div>
      <p><a class="bouton" href="/cdn-cgi/access/logout">Changer de compte</a></p>`),
    { status: 403, headers: ENTETES });
  }
  const contenu = `
  <div class="tete">
    <h1>Administration des corrections</h1>
    <p class="resume">Examinez les propositions relatives aux photos et aux fiches de l’arbre, puis préparez les corrections à reporter dans les sources.</p>
  </div>
  <div class="indicateurs-admin" id="indicateurs-admin" aria-label="État des corrections"></div>
  <section id="outils-admin" class="outils-admin" aria-label="Filtrer et exporter" hidden>
    <div class="filtres-admin">
      <label>Recherche<input id="q-admin" type="search" placeholder="Nom, photo, remarque…" autocomplete="off"></label>
      <label>Rubrique<select id="type-admin"><option value="">Toutes</option><option value="photo">Photothèque</option><option value="personne">Arbre</option></select></label>
      <label>État<select id="etat-admin"><option value="ouvert">À examiner</option><option value="">Tous les états</option></select></label>
    </div>
    <div class="exports-admin">
      <span>Lot à intégrer</span>
      <a class="bouton bouton--discret" href="/api/corrections?format=csv&amp;lot=1">CSV</a>
      <a class="bouton bouton--discret" href="/api/corrections?format=json&amp;lot=1">JSON</a>
      <a href="/api/corrections?format=json">Historique complet (JSON)</a>
    </div>
  </section>
  <p id="message-admin" class="avis" role="status" aria-atomic="true">Chargement des propositions…</p>
  <div id="liste-admin"></div>`;
  const scripts = `
<script src="/assets/js/site.js"></script>
<script src="/prive/arbre.js"></script>
<script src="/prive/photos.js"></script>
<script src="/assets/js/administration.js"></script>`;
  return new Response(request.method === "HEAD" ? null : page("Administration des corrections", contenu, scripts), { headers: ENTETES });
}

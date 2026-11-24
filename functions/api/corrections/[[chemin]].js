// Base des corrections de la photothèque, dans l'espace famille (Cloudflare Pages Functions + D1).
// Derrière Cloudflare Access : seuls les proches autorisés atteignent ces adresses.
//
//   GET  /api/corrections                 liste (avec les avis) ; ?photo=P0001 pour une photo
//   GET  /api/corrections?format=csv|json export complet (tableau pour Samuel et Claude)
//   GET  /api/corrections/etat            la base est-elle reliée ? qui est connecté ?
//   POST /api/corrections                 nouvelle proposition
//   POST /api/corrections/<id>/avis       { avis: "confirme" | "doute", nom }
//   POST /api/corrections/<id>/statut     { statut, note } — réservé aux adresses de RESPONSABLES
//
// Réglages du projet Pages : liaison D1 nommée CORRECTIONS ; variable facultative RESPONSABLES
// (adresses e-mail séparées par des virgules). Les tables se créent seules au premier appel.

const STATUTS = ["proposée", "confirmée", "à vérifier", "appliquée", "rejetée"];
const TAILLE_MAX = 20000;
let tablesPretes = false;

function reponse(donnees, statut = 200, entetes = {}) {
  return new Response(typeof donnees === "string" ? donnees : JSON.stringify(donnees), {
    status: statut,
    headers: Object.assign({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }, entetes)
  });
}
function erreur(statut, code, message) { return reponse({ erreur: code, message }, statut); }

// Adresse de la personne connectée : en-tête posé par Access, sinon jeton Access (déjà vérifié par Access).
function courrielConnecte(requete) {
  const direct = requete.headers.get("cf-access-authenticated-user-email");
  if (direct) return direct.toLowerCase();
  let jeton = requete.headers.get("cf-access-jwt-assertion");
  if (!jeton) {
    const m = /(?:^|;\s*)CF_Authorization=([^;]+)/.exec(requete.headers.get("cookie") || "");
    jeton = m && m[1];
  }
  if (!jeton) return "";
  try {
    const charge = jeton.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const donnees = JSON.parse(atob(charge + "=".repeat((4 - charge.length % 4) % 4)));
    return (donnees.email || "").toLowerCase();
  } catch (e) { return ""; }
}

function responsables(env) {
  return String(env.RESPONSABLES || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
}

async function preparer(db) {
  if (tablesPretes) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS corrections (
      id INTEGER PRIMARY KEY AUTOINCREMENT, cree_le TEXT NOT NULL,
      photo_numero TEXT, photo_id TEXT, actuel TEXT, propose TEXT NOT NULL, certitude TEXT,
      auteur_nom TEXT, auteur_email TEXT, statut TEXT NOT NULL DEFAULT 'proposée',
      statut_par TEXT, statut_le TEXT, note TEXT)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS avis (
      id INTEGER PRIMARY KEY AUTOINCREMENT, correction_id INTEGER NOT NULL, cree_le TEXT NOT NULL,
      avis TEXT NOT NULL, nom TEXT, email TEXT, personne TEXT NOT NULL,
      UNIQUE (correction_id, personne))`),
    db.prepare("CREATE INDEX IF NOT EXISTS corrections_photo ON corrections (photo_numero, photo_id)")
  ]);
  tablesPretes = true;
}

function lireJSON(texte, defaut) { try { return JSON.parse(texte); } catch (e) { return defaut; } }

async function lister(db, photo) {
  const sql = "SELECT * FROM corrections" + (photo ? " WHERE photo_numero = ?1 OR photo_id = ?1" : "") + " ORDER BY id DESC";
  const lignes = (await (photo ? db.prepare(sql).bind(photo) : db.prepare(sql)).all()).results || [];
  const avis = lignes.length
    ? ((await db.prepare("SELECT correction_id, avis, nom, email, cree_le FROM avis ORDER BY id").all()).results || [])
    : [];
  return lignes.map(l => {
    const siens = avis.filter(a => a.correction_id === l.id);
    return {
      id: l.id, cree_le: l.cree_le, photo: { numero: l.photo_numero || "", id: l.photo_id || "" },
      actuel: lireJSON(l.actuel, {}), propose: lireJSON(l.propose, {}), certitude: l.certitude || "",
      auteur: { nom: l.auteur_nom || "", email: l.auteur_email || "" },
      statut: l.statut, statut_par: l.statut_par || "", statut_le: l.statut_le || "", note: l.note || "",
      avis: {
        confirme: siens.filter(a => a.avis === "confirme").length,
        doute: siens.filter(a => a.avis === "doute").length,
        liste: siens.map(a => ({ avis: a.avis, nom: a.nom || a.email || "", cree_le: a.cree_le }))
      }
    };
  });
}

function enCSV(corrections) {
  const champ = v => {
    const s = v == null ? "" : String(v);
    return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const tete = ["id", "cree_le", "photo", "photo_id", "date_actuelle", "date_proposee", "lieu_actuel", "lieu_propose",
    "evenement_actuel", "evenement_propose", "personnes_a_remplacer", "personnes_a_retirer", "personnes_a_ajouter",
    "remarque", "certitude", "auteur", "auteur_email", "statut", "confirmations", "doutes", "propose_json"];
  const lignes = corrections.map(c => {
    const p = c.propose || {}, a = c.actuel || {};
    return [c.id, c.cree_le, c.photo.numero, c.photo.id, a.date, p.date, a.lieu, p.lieu, a.evenement, p.evenement,
      (p.remplacer || []).map(r => r.avant + " → " + r.apres).join(" ; "), (p.retirer || []).join(" ; "),
      (p.ajouter || []).map(x => x.nom + (x.position ? " (" + x.position + ")" : "")).join(" ; "),
      p.remarque, c.certitude, c.auteur.nom, c.auteur.email, c.statut, c.avis.confirme, c.avis.doute, JSON.stringify(p)
    ].map(champ).join(";");
  });
  return "﻿" + tete.join(";") + "\n" + lignes.join("\n") + "\n";
}

export async function onRequest(contexte) {
  const { request: requete, env, params } = contexte;
  const chemin = [].concat(params.chemin || []).filter(Boolean);
  const db = env.CORRECTIONS;
  const email = courrielConnecte(requete);
  const estResponsable = !!email && responsables(env).includes(email);

  if (chemin[0] === "etat" && requete.method === "GET") {
    return reponse({ base: !!db, email, responsable: estResponsable });
  }
  if (!db) return erreur(503, "base-absente", "La base des corrections n'est pas encore reliée à l'espace famille.");
  await preparer(db);
  const url = new URL(requete.url);

  // ---- liste et export
  if (!chemin.length && requete.method === "GET") {
    const corrections = await lister(db, url.searchParams.get("photo") || "");
    const format = url.searchParams.get("format");
    const date = new Date().toISOString().slice(0, 10);
    if (format === "csv") {
      return reponse(enCSV(corrections), 200, { "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="corrections-phototheque-${date}.csv"` });
    }
    if (format === "json") {
      return reponse({ exporte_le: new Date().toISOString(), corrections }, 200,
        { "Content-Disposition": `attachment; filename="corrections-phototheque-${date}.json"` });
    }
    // dans la liste courante, les adresses ne sont montrées qu'aux responsables
    if (!estResponsable) corrections.forEach(c => { c.auteur.email = c.auteur.email ? "connecté(e)" : ""; });
    return reponse({ corrections, email, responsable: estResponsable });
  }

  if (requete.method !== "POST") return erreur(405, "methode", "Méthode non prise en charge.");
  const brut = await requete.text();
  if (brut.length > TAILLE_MAX) return erreur(413, "trop-long", "La proposition est trop longue.");
  const corps = lireJSON(brut, null);
  if (!corps || typeof corps !== "object") return erreur(400, "illisible", "Données illisibles.");
  const maintenant = new Date().toISOString();

  // ---- nouvelle proposition
  if (!chemin.length) {
    const photo = corps.photo || {}, propose = corps.propose || {};
    const nom = String((corps.auteur && corps.auteur.nom) || "").trim().slice(0, 120);
    if (!photo.numero && !photo.id) return erreur(400, "photo", "Photo non précisée.");
    if (!nom && !email) return erreur(400, "nom", "Indiquez votre nom.");
    const vide = !(propose.date || propose.lieu || propose.evenement || (propose.remplacer || []).length ||
      (propose.retirer || []).length || (propose.ajouter || []).length || propose.remarque);
    if (vide) return erreur(400, "vide", "Aucune correction proposée.");
    const r = await db.prepare(`INSERT INTO corrections (cree_le, photo_numero, photo_id, actuel, propose, certitude, auteur_nom, auteur_email)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`).bind(maintenant, String(photo.numero || "").slice(0, 40),
      String(photo.id || "").slice(0, 80), JSON.stringify(corps.actuel || {}), JSON.stringify(propose),
      String(corps.certitude || "").slice(0, 60), nom, email).run();
    return reponse({ ok: true, id: r.meta && r.meta.last_row_id }, 201);
  }

  const id = parseInt(chemin[0], 10);
  if (!id) return erreur(404, "introuvable", "Proposition introuvable.");
  const existe = await db.prepare("SELECT id FROM corrections WHERE id = ?1").bind(id).first();
  if (!existe) return erreur(404, "introuvable", "Proposition introuvable.");

  // ---- avis d'un proche : une voix par personne et par proposition (la dernière compte)
  if (chemin[1] === "avis") {
    const avis = corps.avis === "confirme" ? "confirme" : corps.avis === "doute" ? "doute" : "";
    const nom = String(corps.nom || "").trim().slice(0, 120);
    if (!avis) return erreur(400, "avis", "Avis inconnu.");
    if (!nom && !email) return erreur(400, "nom", "Indiquez votre nom.");
    const personne = email || "nom:" + nom.toLowerCase();
    await db.prepare(`INSERT INTO avis (correction_id, cree_le, avis, nom, email, personne) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
      ON CONFLICT (correction_id, personne) DO UPDATE SET avis = excluded.avis, cree_le = excluded.cree_le, nom = excluded.nom`)
      .bind(id, maintenant, avis, nom, email, personne).run();
    return reponse({ ok: true });
  }

  // ---- statut (Samuel, ou les adresses de RESPONSABLES)
  if (chemin[1] === "statut") {
    if (!estResponsable) return erreur(403, "interdit", "Réservé aux responsables de la photothèque.");
    if (!STATUTS.includes(corps.statut)) return erreur(400, "statut", "Statut inconnu.");
    await db.prepare("UPDATE corrections SET statut = ?1, statut_par = ?2, statut_le = ?3, note = ?4 WHERE id = ?5")
      .bind(corps.statut, email, maintenant, String(corps.note || "").slice(0, 500), id).run();
    return reponse({ ok: true });
  }
  return erreur(404, "introuvable", "Adresse inconnue.");
}

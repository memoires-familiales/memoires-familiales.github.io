// Base D1 commune aux corrections sur les photos et les fiches de l’arbre.
import { courrielAccess, estAdministrateur } from "../../_lib/acces.js";

const STATUTS = ["proposée", "confirmée", "à vérifier", "appliquée", "rejetée"];
const TAILLE_MAX = 20000;
let tablesPretes;

function reponse(donnees, statut = 200, entetes = {}) {
  return new Response(typeof donnees === "string" ? donnees : JSON.stringify(donnees), {
    status: statut,
    headers: Object.assign({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff" }, entetes)
  });
}
function erreur(statut, code, message) { return reponse({ erreur: code, message }, statut); }

async function preparer(db) {
  if (!tablesPretes) tablesPretes = db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS corrections (
      id INTEGER PRIMARY KEY AUTOINCREMENT, cree_le TEXT NOT NULL,
      photo_numero TEXT, photo_id TEXT, actuel TEXT, propose TEXT NOT NULL, certitude TEXT,
      auteur_nom TEXT, auteur_email TEXT, statut TEXT NOT NULL DEFAULT 'proposée',
      statut_par TEXT, statut_le TEXT, note TEXT)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS avis (
      id INTEGER PRIMARY KEY AUTOINCREMENT, correction_id INTEGER NOT NULL, cree_le TEXT NOT NULL,
      avis TEXT NOT NULL, nom TEXT, email TEXT, personne TEXT NOT NULL,
      UNIQUE (correction_id, personne))`),
    db.prepare("CREATE INDEX IF NOT EXISTS corrections_photo ON corrections (photo_numero, photo_id)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS decisions_corrections (
      correction_id INTEGER NOT NULL, revision INTEGER NOT NULL, decide_le TEXT NOT NULL,
      statut TEXT NOT NULL, courriel TEXT NOT NULL, note TEXT NOT NULL, retenue TEXT,
      PRIMARY KEY (correction_id, revision), FOREIGN KEY (correction_id) REFERENCES corrections(id))`),
    db.prepare(`CREATE TRIGGER IF NOT EXISTS decisions_corrections_statut
      AFTER INSERT ON decisions_corrections BEGIN
        UPDATE corrections SET statut = NEW.statut, statut_le = NEW.decide_le WHERE id = NEW.correction_id;
      END`),
    db.prepare(`INSERT OR IGNORE INTO decisions_corrections (correction_id, revision, decide_le, statut, courriel, note)
      SELECT id, 0, statut_le, statut, COALESCE(statut_par, ''), COALESCE(note, '') FROM corrections
      WHERE statut_le IS NOT NULL AND statut_le <> ''
        AND NOT EXISTS (SELECT 1 FROM decisions_corrections WHERE correction_id = corrections.id)`)
  ]).catch(e => { tablesPretes = null; throw e; });
  await tablesPretes;
}

function lireJSON(texte, defaut) { try { return JSON.parse(texte); } catch (e) { return defaut; } }
function listeValeurs(v) { return Array.isArray(v) ? v.filter(Boolean) : []; }
function texte(v, max) { return typeof v === "string" ? v.trim().slice(0, max) : ""; }

function propositionRetenue(p, personne) {
  if (!p || typeof p !== "object" || Array.isArray(p)) return null;
  const remarque = texte(p.remarque, 3000);
  if (personne) {
    const champ = texte(p.champ, 120);
    return champ && remarque ? { champ, remarque, source: texte(p.source, 1500) } : null;
  }
  const retenue = {
    date: texte(p.date, 200), lieu: texte(p.lieu, 500), evenement: texte(p.evenement, 500), remarque,
    remplacer: listeValeurs(p.remplacer).map(r => ({
      avant: texte(r.avant, 300), apres: texte(r.apres, 300), nouveau: r.nouveau === true
    })).filter(r => r.avant && r.apres && r.avant !== r.apres),
    retirer: listeValeurs(p.retirer).map(n => texte(n, 300)).filter(Boolean),
    ajouter: listeValeurs(p.ajouter).map(x => ({
      nom: texte(x.nom, 300), position: texte(x.position, 300), nouveau: x.nouveau === true
    })).filter(x => x.nom)
  };
  return Object.values(retenue).some(v => v.length) ? retenue : null;
}

async function lister(db, photo, personne, admin) {
  const condition = personne ? " WHERE json_extract(actuel, '$.personne.id') = ?1" : photo ? " WHERE photo_numero = ?1 OR photo_id = ?1" : "";
  const sql = "SELECT * FROM corrections" + condition + " ORDER BY id DESC";
  const lignes = (await (condition ? db.prepare(sql).bind(personne || photo) : db.prepare(sql)).all()).results || [];
  if (!lignes.length) return [];
  const ids = new Set(lignes.map(l => l.id));
  const avis = new Map();
  const votes = condition
    ? db.prepare("SELECT correction_id, avis, nom, email, cree_le FROM avis WHERE correction_id IN (SELECT id FROM corrections" + condition + ") ORDER BY id").bind(personne || photo)
    : db.prepare("SELECT correction_id, avis, nom, email, cree_le FROM avis ORDER BY id");
  for (const a of (await votes.all()).results || []) {
    if (!avis.has(a.correction_id)) avis.set(a.correction_id, []);
    avis.get(a.correction_id).push(a);
  }
  const decisions = new Map();
  if (admin) {
    const historique = await db.prepare("SELECT * FROM decisions_corrections ORDER BY correction_id, revision DESC").all();
    for (const d of historique.results || []) {
      if (!ids.has(d.correction_id)) continue;
      if (!decisions.has(d.correction_id)) decisions.set(d.correction_id, []);
      decisions.get(d.correction_id).push({ revision: d.revision, date: d.decide_le,
        statut: d.statut, courriel: d.courriel, note: d.note, retenue: lireJSON(d.retenue, null) });
    }
  }
  return lignes.map(l => {
    const siens = avis.get(l.id) || [];
    const actuel = lireJSON(l.actuel, {}) || {};
    const correction = {
      personne: actuel.personne || null,
      id: l.id, cree_le: l.cree_le, photo: { numero: l.photo_numero || "", id: l.photo_id || "" },
      actuel, propose: lireJSON(l.propose, {}), certitude: l.certitude || "",
      auteur: { nom: l.auteur_nom || "", email: admin ? l.auteur_email || "" : (l.auteur_email ? "connecté(e)" : "") },
      statut: l.statut,
      avis: {
        confirme: siens.filter(a => a.avis === "confirme").length,
        doute: siens.filter(a => a.avis === "doute").length,
        liste: siens.map(a => ({ avis: a.avis, nom: a.nom || (admin ? a.email || "" : ""), cree_le: a.cree_le }))
      }
    };
    if (admin) {
      const historique = decisions.get(l.id) || [];
      correction.revision = historique[0]?.revision || 0;
      correction.retenue = historique.find(d => d.retenue)?.retenue || null;
      correction.historique = historique;
      correction.statut_par = historique[0]?.courriel || l.statut_par || "";
      correction.statut_le = historique[0]?.date || l.statut_le || "";
      correction.note = historique[0]?.note ?? l.note ?? "";
      if (!historique.length && l.statut_le) historique.push({
        revision: 0, date: l.statut_le, statut: l.statut, courriel: l.statut_par || "", note: l.note || ""
      });
    }
    return correction;
  });
}

function enCSV(corrections) {
  const champ = v => {
    let s = v == null ? "" : String(v);
    if (/^\s*[=+@-]|^[\t\r\n]/.test(s)) s = "'" + s;
    return /[";\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const tete = ["id", "cree_le", "photo", "photo_id", "date_actuelle", "date_proposee", "lieu_actuel", "lieu_propose",
    "evenement_actuel", "evenement_propose", "personnes_a_remplacer", "personnes_a_retirer", "personnes_a_ajouter",
    "remarque", "certitude", "auteur", "auteur_email", "statut", "confirmations", "doutes", "propose_json", "personne_id", "personne_nom",
    "note_decision", "date_decision", "proposition_initiale_json", "champ_fiche", "source_fiche"];
  const lignes = corrections.map(c => {
    const p = c.retenue || c.propose || {}, a = c.actuel || {};
    return [c.id, c.cree_le, c.photo.numero, c.photo.id, a.date, p.date, a.lieu, p.lieu, a.evenement, p.evenement,
      listeValeurs(p.remplacer).map(r => r.avant + " → " + r.apres).join(" ; "), listeValeurs(p.retirer).join(" ; "),
      listeValeurs(p.ajouter).map(x => x.nom + (x.position ? " (" + x.position + ")" : "")).join(" ; "),
      p.remarque, c.certitude, c.auteur.nom, c.auteur.email, c.statut, c.avis.confirme, c.avis.doute, JSON.stringify(p), c.personne?.id || "", c.personne?.nom || "",
      c.note, c.statut_le, JSON.stringify(c.propose), p.champ, p.source
    ].map(champ).join(";");
  });
  return "﻿" + tete.join(";") + "\n" + lignes.join("\n") + "\n";
}

export async function onRequest(contexte) {
  const { request: requete, env, params } = contexte;
  const chemin = [].concat(params.chemin || []).filter(Boolean);
  const db = env.CORRECTIONS;
  const email = await courrielAccess(requete, env);
  const estResponsable = estAdministrateur(email, env);
  const url = new URL(requete.url);
  const format = url.searchParams.get("format");
  const listeAdmin = !chemin.length && requete.method === "GET" && (format || url.searchParams.has("moderation"));
  const decisionAdmin = chemin[1] === "statut";
  if ((listeAdmin || decisionAdmin) && !estResponsable) {
    return erreur(403, "interdit", "Cette action est réservée à l’administrateur.");
  }

  if (chemin.length === 1 && chemin[0] === "etat" && requete.method === "GET") {
    return reponse({ base: !!db, email, responsable: estResponsable });
  }
  if (!db) return erreur(503, "base-absente", "La base des corrections n'est pas encore reliée à l'espace famille.");
  await preparer(db);

  // ---- liste et export
  if (!chemin.length && requete.method === "GET") {
    let corrections = await lister(db, url.searchParams.get("photo") || "", url.searchParams.get("personne") || "", !!listeAdmin);
    const lot = !!listeAdmin && url.searchParams.get("lot") === "1";
    if (lot) corrections = corrections.filter(c => c.statut === "confirmée");
    const date = new Date().toISOString().slice(0, 10);
    const nom = (lot ? "corrections-a-integrer-" : "historique-corrections-") + date;
    if (format === "csv") {
      return reponse(enCSV(corrections), 200, { "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${nom}.csv"` });
    }
    if (format === "json") {
      if (lot) corrections = corrections.map(c => ({
        ...c, proposition_initiale: c.propose, propose: c.retenue || c.propose
      }));
      return reponse({ exporte_le: new Date().toISOString(), corrections }, 200,
        { "Content-Disposition": `attachment; filename="${nom}.json"` });
    }
    return reponse({ corrections, email, responsable: estResponsable });
  }

  if (requete.method !== "POST") return erreur(405, "methode", "Méthode non prise en charge.");
  const origine = requete.headers.get("Origin");
  if ((origine && origine !== url.origin) || (decisionAdmin && origine !== url.origin)) {
    return erreur(403, "origine", "Ouvrez le tableau d’administration pour enregistrer cette décision.");
  }
  if (!(requete.headers.get("Content-Type") || "").toLowerCase().startsWith("application/json")) {
    return erreur(415, "format", "Les données doivent être envoyées au format JSON.");
  }
  const brut = await requete.text();
  if (brut.length > TAILLE_MAX) return erreur(413, "trop-long", "La proposition est trop longue.");
  const corps = lireJSON(brut, null);
  if (!corps || typeof corps !== "object") return erreur(400, "illisible", "Données illisibles.");
  const maintenant = new Date().toISOString();

  // ---- nouvelle proposition
  if (!chemin.length) {
    const photo = corps.photo || {};
    const nom = String((corps.auteur && corps.auteur.nom) || "").trim().slice(0, 120);
    const personne = corps.personne;
    const propose = propositionRetenue(corps.propose, personne);
    if (personne && (typeof personne.id !== "string" || !personne.id.trim() || personne.id.length > 200 ||
      typeof personne.nom !== "string" || !personne.nom.trim() || personne.nom.length > 300 ||
      !propose)) {
      return erreur(400, "personne", "La personne et la correction doivent être précisées.");
    }
    if (!personne && !photo.numero && !photo.id) return erreur(400, "photo", "Photo non précisée.");
    if (!nom && !email) return erreur(400, "nom", "Indiquez votre nom.");
    if (!propose) return erreur(400, "vide", "Aucune correction proposée.");
    const r = await db.prepare(`INSERT INTO corrections (cree_le, photo_numero, photo_id, actuel, propose, certitude, auteur_nom, auteur_email)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`).bind(maintenant, String(photo.numero || "").slice(0, 40),
      String(photo.id || "").slice(0, 80), JSON.stringify(personne ? { personne: { id: personne.id, nom: personne.nom } } : corps.actuel || {}), JSON.stringify(propose),
      String(corps.certitude || "").slice(0, 60), nom, email).run();
    return reponse({ ok: true, id: r.meta && r.meta.last_row_id }, 201);
  }

  const id = Number(chemin[0]);
  if (chemin.length !== 2 || !Number.isSafeInteger(id) || id < 1) return erreur(404, "introuvable", "Proposition introuvable.");
  const existe = await db.prepare("SELECT id, actuel, propose FROM corrections WHERE id = ?1").bind(id).first();
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

  if (decisionAdmin) {
    if (!STATUTS.includes(corps.statut)) return erreur(400, "statut", "Statut inconnu.");
    if (!Number.isSafeInteger(corps.revision) || corps.revision < 0) {
      return erreur(409, "version", "Rechargez la proposition depuis le tableau d’administration.");
    }
    const personne = lireJSON(existe.actuel, {})?.personne;
    const modifiee = corps.statut === "confirmée" && corps.retenue != null;
    const retenue = modifiee ? propositionRetenue(corps.retenue, personne) : null;
    if (modifiee && !retenue) return erreur(400, "valeur", "Indiquez au moins une correction à retenir.");
    const r = await db.prepare(`INSERT INTO decisions_corrections (correction_id, revision, decide_le, statut, courriel, note, retenue)
      SELECT id, ?2 + 1, ?3, ?4, ?5, ?6, CASE WHEN ?4 = 'confirmée' THEN COALESCE(?7, (
        SELECT retenue FROM decisions_corrections WHERE correction_id = c.id AND retenue IS NOT NULL ORDER BY revision DESC LIMIT 1
      ), c.propose) END FROM corrections c WHERE id = ?1 AND statut <> 'appliquée'
        AND (?4 <> 'appliquée' OR statut = 'confirmée')
        AND COALESCE((SELECT MAX(revision) FROM decisions_corrections WHERE correction_id = c.id), 0) = ?2`)
      .bind(id, corps.revision, maintenant, corps.statut, email, texte(corps.note, 2000), retenue ? JSON.stringify(retenue) : null).run();
    if (!r.meta?.changes) return erreur(409, "version", "La décision a changé ou la proposition est déjà intégrée. Actualisez la liste.");
    return reponse({ ok: true, revision: corps.revision + 1 });
  }
  return erreur(404, "introuvable", "Adresse inconnue.");
}

// Vérifie les assertions signées par l’application Cloudflare Access du site.
const CLES = new Map();
const DUREE_CACHE = 3600_000;
const DELAI_ROTATION = 60_000;

function decoder(texte) {
  if (!/^[A-Za-z0-9_-]+$/.test(texte)) throw new Error("Assertion illisible");
  const base64 = texte.replace(/-/g, "+").replace(/_/g, "/");
  const remplissage = "=".repeat((4 - base64.length % 4) % 4);
  return Uint8Array.from(atob(base64 + remplissage), c => c.charCodeAt(0));
}

function lireJSON(texte) {
  return JSON.parse(new TextDecoder().decode(decoder(texte)));
}

async function cleSignature(domaine, id) {
  const maintenant = Date.now();
  let entree = CLES.get(domaine);
  if (!entree || maintenant - entree.date >= DUREE_CACHE ||
      (!entree.cles.has(id) && maintenant - entree.date >= DELAI_ROTATION)) {
    const r = await fetch(domaine + "/cdn-cgi/access/certs", { redirect: "error" });
    if (!r.ok) return null;
    const { keys } = await r.json();
    const cles = new Map(keys.filter(k => k.kty === "RSA" && (!k.alg || k.alg === "RS256"))
      .map(k => [k.kid, k]));
    entree = { date: maintenant, cles };
    CLES.set(domaine, entree);
  }
  const jwk = entree.cles.get(id);
  return jwk ? crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]) : null;
}

export async function courrielAccess(requete, env) {
  const domaine = String(env.ACCESS_TEAM_DOMAIN || "").trim().replace(/\/$/, "");
  const audience = String(env.ACCESS_AUDIENCE || "").trim();
  // Certaines requêtes navigateur ne transmettent que le cookie Access.
  // Il passe par les mêmes contrôles cryptographiques que l’en-tête.
  const cookie = /(?:^|;\s*)CF_Authorization=([^;]+)/.exec(requete.headers.get("Cookie") || "");
  const jeton = requete.headers.get("Cf-Access-Jwt-Assertion") || cookie?.[1] || "";
  if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(domaine) || !audience || jeton.length > 16000) return "";
  const morceaux = jeton.split(".");
  if (morceaux.length !== 3) return "";
  try {
    const [entete, charge, signature] = morceaux;
    const { alg, kid } = lireJSON(entete);
    if (alg !== "RS256" || typeof kid !== "string" || !kid) return "";
    const d = lireJSON(charge);
    const maintenant = Date.now() / 1000;
    if (d.iss !== domaine || !Array.isArray(d.aud) || !d.aud.includes(audience) ||
        !Number.isFinite(d.exp) || d.exp <= maintenant ||
        (d.nbf != null && (!Number.isFinite(d.nbf) || d.nbf > maintenant)) ||
        (d.iat != null && (!Number.isFinite(d.iat) || d.iat > maintenant + 30)) ||
        typeof d.sub !== "string" || !d.sub || typeof d.email !== "string") return "";
    const cle = await cleSignature(domaine, kid);
    const message = new TextEncoder().encode(entete + "." + charge);
    const valide = cle && await crypto.subtle.verify("RSASSA-PKCS1-v1_5", cle, decoder(signature), message);
    return valide ? d.email.trim().toLowerCase() : "";
  } catch {
    return "";
  }
}

export function estAdministrateur(email, env) {
  const adresse = String(env.ADMIN_CORRECTIONS_EMAIL || env.RESPONSABLES || "").trim().toLowerCase();
  return /^[^\s,@]+@[^\s,@]+\.[^\s,@]+$/.test(adresse) && email === adresse;
}

export async function administrateur(requete, env) {
  const email = await courrielAccess(requete, env);
  return estAdministrateur(email, env) ? email : "";
}

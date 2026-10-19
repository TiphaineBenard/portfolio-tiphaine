// ============================================================
// SAUVEGARDE AUTOMATIQUE — File System Access API
//
// Principe : l'utilisateur choisit un dossier UNE SEULE FOIS
// (ex : OneDrive, Documents\Sauvegardes Vanba).
// L'app y écrit automatiquement un fichier JSON à chaque
// ouverture et à chaque nouvelle commande.
// Le handle du dossier est stocké en IndexedDB pour être
// retrouvé à la prochaine ouverture sans redemander.
//
// Compatibilité : Edge / Chrome (Chromium).
// Pas compatible Firefox ni Safari — la sauvegarde manuelle
// (Admin > Données) reste disponible en secours.
// ============================================================

const SAUVEGARDE_DB_NAME  = "eventpro_demo_sauvegarde_db";
const SAUVEGARDE_DB_VER   = 1;
const SAUVEGARDE_STORE    = "handles";
const SAUVEGARDE_KEY      = "dossierSauvegarde";
const SAUVEGARDE_LAST_KEY = "eventpro_demo_derniere_sauvegarde_auto";
const SAUVEGARDE_NB_MAX   = 14; // nombre de fichiers à conserver

// ── IndexedDB helpers ──────────────────────────────────────

function ouvrirSauvegardeDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SAUVEGARDE_DB_NAME, SAUVEGARDE_DB_VER);
    req.onupgradeneeded = e => e.target.result.createObjectStore(SAUVEGARDE_STORE);
    req.onsuccess  = e => resolve(e.target.result);
    req.onerror    = e => reject(e.target.error);
  });
}

async function lireHandleDossier() {
  try {
    const db = await ouvrirSauvegardeDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SAUVEGARDE_STORE, "readonly");
      const req = tx.objectStore(SAUVEGARDE_STORE).get(SAUVEGARDE_KEY);
      req.onsuccess = e => resolve(e.target.result || null);
      req.onerror   = e => reject(e.target.error);
    });
  } catch (e) {
    console.warn("IndexedDB lecture handle:", e);
    return null;
  }
}

async function enregistrerHandleDossier(handle) {
  try {
    const db = await ouvrirSauvegardeDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SAUVEGARDE_STORE, "readwrite");
      tx.objectStore(SAUVEGARDE_STORE).put(handle, SAUVEGARDE_KEY);
      tx.oncomplete = resolve;
      tx.onerror    = e => reject(e.target.error);
    });
  } catch (e) {
    console.warn("IndexedDB écriture handle:", e);
  }
}

async function supprimerHandleDossier() {
  try {
    const db = await ouvrirSauvegardeDB();
    return new Promise((resolve) => {
      const tx = db.transaction(SAUVEGARDE_STORE, "readwrite");
      tx.objectStore(SAUVEGARDE_STORE).delete(SAUVEGARDE_KEY);
      tx.oncomplete = resolve;
    });
  } catch (e) { /* silencieux */ }
}

// ── Construction du JSON de sauvegarde ────────────────────

function construireSauvegardeJSON() {
  const cles = ["eventpro_demo_commandes", "eventpro_demo_produits", "eventpro_demo_parametres",
                 "eventpro_demo_utilisateurs", "eventpro_demo_audit", "eventpro_demo_compteur"];
  const data = { _exporteLe: new Date().toISOString(), _version: 1 };
  cles.forEach(c => { const v = localStorage.getItem(c); if (v) data[c] = JSON.parse(v); });
  return JSON.stringify(data, null, 2);
}

// ── Écriture dans le dossier ──────────────────────────────

async function ecrireSauvegardeAutomatique(handle, silencieux = true) {
  if (!handle) return false;

  // Vérifier que la permission est toujours accordée
  let permission;
  try {
    permission = await handle.queryPermission({ mode: "readwrite" });
    if (permission !== "granted") {
      permission = await handle.requestPermission({ mode: "readwrite" });
    }
    if (permission !== "granted") return false;
  } catch (e) {
    return false;
  }

  try {
    const now  = new Date();
    const date = now.toISOString().slice(0, 10);
    const nom  = `vanba-backup-${date}.json`;
    const contenu = construireSauvegardeJSON();

    const fichier = await handle.getFileHandle(nom, { create: true });
    const writable = await fichier.createWritable();
    await writable.write(contenu);
    await writable.close();

    // Mettre à jour la date de dernière sauvegarde
    localStorage.setItem(SAUVEGARDE_LAST_KEY, now.toISOString());

    // Nettoyer les vieux fichiers (garder SAUVEGARDE_NB_MAX jours)
    try {
      const fichiers = [];
      for await (const [nom] of handle.entries()) {
        if (nom.startsWith("vanba-backup-") && nom.endsWith(".json")) fichiers.push(nom);
      }
      fichiers.sort().reverse(); // du plus récent au plus ancien
      for (const vieux of fichiers.slice(SAUVEGARDE_NB_MAX)) {
        await handle.removeEntry(vieux);
      }
    } catch (e) { /* nettoyage optionnel */ }

    if (!silencieux) afficherToast("Sauvegarde automatique effectuée", "succes");
    return true;
  } catch (e) {
    console.warn("Écriture sauvegarde auto:", e);
    if (!silencieux) afficherToast("Erreur lors de la sauvegarde automatique : " + e.message, "erreur");
    return false;
  }
}

// ── API publique ───────────────────────────────────────────

/**
 * Appelée au démarrage de l'app et après chaque création de commande.
 * Essaie d'écrire silencieusement dans le dossier configuré.
 */
async function sauvegarderAutomatiquement() {
  if (!window.showDirectoryPicker) return; // navigateur non compatible
  const handle = await lireHandleDossier();
  if (!handle) return;
  await ecrireSauvegardeAutomatique(handle, true);
}

/**
 * Appelée depuis Admin > Données pour configurer le dossier.
 * Ouvre le sélecteur de dossier, teste l'écriture, puis sauvegarde le handle.
 */
async function configurerDossierSauvegarde() {
  if (!window.showDirectoryPicker) {
    afficherToast("Votre navigateur ne supporte pas la sauvegarde automatique. Utilisez Edge ou Chrome.", "erreur");
    return;
  }
  try {
    const handle = await window.showDirectoryPicker({ mode: "readwrite", startIn: "documents" });
    const ok = await ecrireSauvegardeAutomatique(handle, false);
    if (ok) {
      await enregistrerHandleDossier(handle);
      afficherToast("Dossier configuré ! L'app sauvegardera automatiquement à chaque ouverture.", "succes");
      return handle;
    }
  } catch (e) {
    if (e.name !== "AbortError") {
      afficherToast("Impossible d'accéder à ce dossier : " + e.message, "erreur");
    }
  }
  return null;
}

/**
 * Supprime le dossier configuré (désactive la sauvegarde auto).
 */
async function desactiverSauvegardeAuto() {
  await supprimerHandleDossier();
  localStorage.removeItem(SAUVEGARDE_LAST_KEY);
}

/**
 * Retourne true si un dossier est configuré.
 */
async function sauvegardeAutoConfiguree() {
  const h = await lireHandleDossier();
  return !!h;
}

/**
 * Retourne la date de la dernière sauvegarde auto, ou null.
 */
function dateDerniereSauvegardeAuto() {
  const v = localStorage.getItem(SAUVEGARDE_LAST_KEY);
  return v ? new Date(v) : null;
}

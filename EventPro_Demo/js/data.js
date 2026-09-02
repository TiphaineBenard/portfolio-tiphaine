// ============================================================
// COUCHE D'ACCÈS AUX DONNÉES — MODE LOCAL (DÉMO)
// ============================================================
// Cette version remplace Firebase par le sessionStorage du navigateur,
// pour pouvoir ouvrir l'application directement en double-cliquant sur
// index.html, sans configuration ni serveur.
//
// ⚠️ LIMITES DU MODE LOCAL :
// - Les données restent uniquement sur CET ordinateur, dans CE navigateur.
// - Pas de synchronisation entre magasins / appareils.
// - Vider le cache du navigateur supprime les données.
//
// Quand vous serez prêts pour la vraie synchronisation multi-magasins en
// temps réel, remplacez ce fichier par js/data_firebase.js.bak (renommé
// data.js) après avoir configuré Firebase dans js/config.js.
// ============================================================

let utilisateurCourant = { nom: null, role: ROLES.SALARIE, uid: null };

const CLES_STOCKAGE = {
  commandes: "eventpro_demo_commandes",
  produits: "eventpro_demo_produits",
  parametres: "eventpro_demo_parametres",
  utilisateurs: "eventpro_demo_utilisateurs",
  audit: "eventpro_demo_audit",
  compteur: "eventpro_demo_compteur"
};

function lireStockage(cle, defaut) {
  try {
    const brut = sessionStorage.getItem(cle);
    return brut ? JSON.parse(brut) : defaut;
  } catch (e) {
    console.error("Erreur lecture sessionStorage:", cle, e);
    return defaut;
  }
}

function ecrireStockage(cle, valeur) {
  try {
    sessionStorage.setItem(cle, JSON.stringify(valeur));
  } catch (e) {
    console.error("Erreur écriture sessionStorage:", cle, e);
    afficherToast("Erreur de sauvegarde locale (mémoire pleine ?)", "erreur");
  }
}

function genererIdLocal() {
  return "id_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

// Petits émetteurs d'événements très simples pour simuler le "temps réel"
// Firestore à l'intérieur d'un même onglet (les écrans s'abonnent / se
// rafraîchissent quand les données locales changent).
const ECOUTEURS = { commandes: [], produits: [], parametres: [], audit: [] };

function notifier(type) {
  const data = type === "commandes" ? lireStockage(CLES_STOCKAGE.commandes, [])
    : type === "produits" ? lireStockage(CLES_STOCKAGE.produits, [])
    : type === "parametres" ? lireStockage(CLES_STOCKAGE.parametres, null)
    : lireStockage(CLES_STOCKAGE.audit, []);
  ECOUTEURS[type].forEach(cb => { try { cb(data); } catch (e) { console.error(e); } });
}

// Pas de vraie initialisation réseau nécessaire en mode local.
function initFirebase() {
  return { db: null, auth: null };
}

// ------------------------------------------------------------
// COMPTEUR DE COMMANDE
// ------------------------------------------------------------
async function genererNumeroCommande() {
  const anneeActuelle = new Date().getFullYear();
  const params = lireStockage(CLES_STOCKAGE.parametres, null);
  const prefixe = (params && params.prefixeCommande) ? params.prefixeCommande : "CMD";
  const resetAnnuel = params ? (params.resetAnnuel !== false) : true; // true par défaut
  const digits = (params && params.digitsNumero) ? params.digitsNumero : 5;
  // Compteur stocké sous forme { valeur, annee }
  const stocke = lireStockage(CLES_STOCKAGE.compteur, { valeur: 0, annee: anneeActuelle });
  const ancienFormat = typeof stocke === "number";
  const anneeStockee = ancienFormat ? anneeActuelle : (stocke.annee || anneeActuelle);
  const valeurActuelle = ancienFormat ? stocke : (stocke.valeur || 0);
  // Remise à zéro si on a changé d'année et option activée
  const valeurDepart = (resetAnnuel && anneeStockee < anneeActuelle) ? 0 : valeurActuelle;
  const suivant = valeurDepart + 1;
  ecrireStockage(CLES_STOCKAGE.compteur, { valeur: suivant, annee: anneeActuelle });
  return prefixe + "-" + String(suivant).padStart(digits, "0");
}

// ------------------------------------------------------------
// COMMANDES
// ------------------------------------------------------------
/**
 * Crée une commande. Si `commande.numero` est déjà fourni (réservé au
 * préalable via genererNumeroCommande(), par exemple pour l'afficher au
 * client avant la création réelle en base), il est réutilisé tel quel
 * plutôt que d'en générer un nouveau.
 */
async function creerCommande(commande) {
  const numero = commande.numero || await genererNumeroCommande();
  const commandes = lireStockage(CLES_STOCKAGE.commandes, []);
  const maintenant = new Date().toISOString();
  const doc = {
    id: genererIdLocal(),
    numero,
    client: commande.client,
    magasinId: commande.magasinId,
    dateRetrait: commande.dateRetrait,
    periodeId: commande.periodeId || null,
    vendeur: commande.vendeur,
    emailClient: commande.emailClient || "",
    telephoneClient: commande.telephoneClient || "",
    lignes: commande.lignes,
    instructions: commande.instructions || [],
    remarques: commande.remarques || "",
    statut: "en_attente",
    imprimee: false,
    dateImpression: null,
    imprimePar: null,
    creePar: utilisateurCourant.nom || commande.vendeur,
    creeLe: maintenant,
    modifieLe: maintenant
  };
  commandes.push(doc);
  ecrireStockage(CLES_STOCKAGE.commandes, commandes);
  notifier("commandes");
  await ajouterAuditLog("creation_commande", `Commande ${numero} créée pour ${commande.client} (${commande.magasinId})`);
  return { id: doc.id, numero };
}

async function modifierCommande(id, champs) {
  const commandes = lireStockage(CLES_STOCKAGE.commandes, []);
  const idx = commandes.findIndex(c => c.id === id);
  if (idx === -1) throw new Error("Commande introuvable");
  commandes[idx] = { ...commandes[idx], ...champs, modifieLe: new Date().toISOString() };
  ecrireStockage(CLES_STOCKAGE.commandes, commandes);
  notifier("commandes");
  await ajouterAuditLog("modification_commande", `Commande ${id} modifiée: ${Object.keys(champs).join(", ")}`);
}

async function changerStatutCommande(id, nouveauStatut, numero) {
  const commandes = lireStockage(CLES_STOCKAGE.commandes, []);
  const idx = commandes.findIndex(c => c.id === id);
  if (idx === -1) throw new Error("Commande introuvable");
  commandes[idx].statut = nouveauStatut;
  commandes[idx].modifieLe = new Date().toISOString();
  ecrireStockage(CLES_STOCKAGE.commandes, commandes);
  notifier("commandes");
  await ajouterAuditLog("changement_statut", `Commande ${numero || id} -> statut "${nouveauStatut}"`);
}

async function supprimerCommande(id, numero) {
  let commandes = lireStockage(CLES_STOCKAGE.commandes, []);
  commandes = commandes.filter(c => c.id !== id);
  ecrireStockage(CLES_STOCKAGE.commandes, commandes);
  notifier("commandes");
  await ajouterAuditLog("suppression_commande", `Commande ${numero || id} supprimée`);
}

async function marquerImprimee(ids, numeros) {
  const commandes = lireStockage(CLES_STOCKAGE.commandes, []);
  const maintenant = new Date().toISOString();
  ids.forEach(id => {
    const idx = commandes.findIndex(c => c.id === id);
    if (idx !== -1) {
      commandes[idx].imprimee = true;
      commandes[idx].dateImpression = maintenant;
      commandes[idx].imprimePar = utilisateurCourant.nom || "Inconnu";
    }
  });
  ecrireStockage(CLES_STOCKAGE.commandes, commandes);
  notifier("commandes");
  await ajouterAuditLog("impression", `Impression de ${ids.length} commande(s): ${(numeros || []).join(", ")}`);
}

function ecouterCommandes(callback, filtres = {}) {
  function pousserDonnees(commandes) {
    let liste = [...commandes];
    if (filtres.magasinId) liste = liste.filter(c => c.magasinId === filtres.magasinId);
    if (filtres.dateRetrait) liste = liste.filter(c => c.dateRetrait === filtres.dateRetrait);
    if (filtres.statut) liste = liste.filter(c => c.statut === filtres.statut);
    callback(liste);
  }
  pousserDonnees(lireStockage(CLES_STOCKAGE.commandes, []));
  ECOUTEURS.commandes.push(pousserDonnees);
  return () => {
    const i = ECOUTEURS.commandes.indexOf(pousserDonnees);
    if (i !== -1) ECOUTEURS.commandes.splice(i, 1);
  };
}

async function recupererCommandesUnique(filtres = {}) {
  let liste = lireStockage(CLES_STOCKAGE.commandes, []);
  if (filtres.magasinId) liste = liste.filter(c => c.magasinId === filtres.magasinId);
  if (filtres.dateRetrait) liste = liste.filter(c => c.dateRetrait === filtres.dateRetrait);
  if (filtres.statut) liste = liste.filter(c => c.statut === filtres.statut);
  return liste;
}

// ------------------------------------------------------------
// PRODUITS / CATALOGUE
// ------------------------------------------------------------
async function initialiserCatalogueSiVide() {
  const existant = lireStockage(CLES_STOCKAGE.produits, null);
  if (existant && existant.length > 0) return;
  const catalogue = CATALOGUE_INITIAL.map(p => ({ ...p, actif: true }));
  ecrireStockage(CLES_STOCKAGE.produits, catalogue);
}

async function recupererCatalogue() {
  const catalogue = lireStockage(CLES_STOCKAGE.produits, null);
  if (!catalogue || catalogue.length === 0) return CATALOGUE_INITIAL;

  // Migration : ajouter multiVariante: true sur les produits qui le méritent
  const IDS_MULTI_VARIANTE = new Set([
    "dinde_regionale", "chapon_fermier", "poularde_regionale", "supreme_chapon",
    "supreme_pintade", "pintade", "roti_boeuf", "tournedos_boeuf", "filet_boeuf",
    "roti_veau", "filet_cheval", "aloyau_cheval",
    "pintade_dessossee_farcie", "roti_dinde_farci", "chapon_dessosse_farci",
    "demi_chapon_dessosse_farci"
  ]);
  let migreMultiVariante = false;
  const catalogueMigre = catalogue.map(p => {
    if (IDS_MULTI_VARIANTE.has(p.id) && !p.multiVariante) {
      migreMultiVariante = true;
      return { ...p, multiVariante: true };
    }
    return p;
  });
  if (migreMultiVariante) ecrireStockage(CLES_STOCKAGE.produits, catalogueMigre);

  // Migration : injecter les recettes depuis RECETTES_CATALOGUE si absentes
  const baseApresMultiVariante = migreMultiVariante ? catalogueMigre : catalogue;
  let recetteInjectee = false;
  const catalogueAvecRecettes = baseApresMultiVariante.map(p => {
    if (!p.recette && typeof RECETTES_CATALOGUE !== "undefined" && RECETTES_CATALOGUE[p.id]) {
      recetteInjectee = true;
      return { ...p, recette: RECETTES_CATALOGUE[p.id] };
    }
    return p;
  });
  if (recetteInjectee) ecrireStockage(CLES_STOCKAGE.produits, catalogueAvecRecettes);

  // Migration : supprimer les ingrédients "Farce générique" des recettes
  // (la farce est désormais injectée dynamiquement selon le choix client)
  const baseApresRecettes = recetteInjectee ? catalogueAvecRecettes : baseApresMultiVariante;
  const hasFarceOpts = p => (p.optionsFarce && p.optionsFarce.length > 0) ||
    (p.optionsPersonnalisees && p.optionsPersonnalisees.some(o => o.nom === "Farce"));
  let farceMigree = false;
  const catalogueSansGenericFarce = baseApresRecettes.map(p => {
    if (hasFarceOpts(p) && p.recette && p.recette.some(ing => /^farce/i.test(ing.nom))) {
      farceMigree = true;
      return { ...p, recette: p.recette.filter(ing => !/^farce/i.test(ing.nom)) };
    }
    return p;
  });
  if (farceMigree) ecrireStockage(CLES_STOCKAGE.produits, catalogueSansGenericFarce);
  const baseApresFarce = farceMigree ? catalogueSansGenericFarce : baseApresRecettes;

  // ── Migration fournisseur/prix depuis RECETTES_CATALOGUE ─────────────────
  const ingDataMap = {};
  Object.values(RECETTES_CATALOGUE).forEach(recette => {
    recette.forEach(ing => {
      if (ing.fournisseur || ing.prix) {
        const key = ing.nom.trim().toLowerCase();
        if (!ingDataMap[key]) ingDataMap[key] = { fournisseur: ing.fournisseur || "", prix: ing.prix || 0 };
      }
    });
  });
  let fournisseurMigree = false;
  const avecFournisseurs = baseApresFarce.map(p => {
    if (!p.recette || p.recette.length === 0) return p;
    let modifie = false;
    const recetteMaj = p.recette.map(ing => {
      if (ing.fournisseur || ing.prix) return ing;
      const data = ingDataMap[ing.nom.trim().toLowerCase()];
      if (data) { modifie = true; fournisseurMigree = true; return { ...ing, ...(data.fournisseur ? { fournisseur: data.fournisseur } : {}), ...(data.prix ? { prix: data.prix } : {}) }; }
      return ing;
    });
    return modifie ? { ...p, recette: recetteMaj } : p;
  });
  if (fournisseurMigree) ecrireStockage(CLES_STOCKAGE.produits, avecFournisseurs);

  return fournisseurMigree ? avecFournisseurs : baseApresFarce;
}

function ecouterCatalogue(callback) {
  function pousser(catalogue) { callback(catalogue && catalogue.length ? catalogue : CATALOGUE_INITIAL); }
  pousser(lireStockage(CLES_STOCKAGE.produits, []));
  ECOUTEURS.produits.push(pousser);
  return () => {
    const i = ECOUTEURS.produits.indexOf(pousser);
    if (i !== -1) ECOUTEURS.produits.splice(i, 1);
  };
}

async function enregistrerProduit(produit) {
  const catalogue = lireStockage(CLES_STOCKAGE.produits, CATALOGUE_INITIAL.map(p => ({ ...p, actif: true })));
  const idx = catalogue.findIndex(p => p.id === produit.id);
  if (idx !== -1) catalogue[idx] = { ...catalogue[idx], ...produit };
  else catalogue.push(produit);
  ecrireStockage(CLES_STOCKAGE.produits, catalogue);
  notifier("produits");
  await ajouterAuditLog("modification_produit", `Produit "${produit.nom}" enregistré`);
}

async function supprimerProduit(id, nom) {
  let catalogue = lireStockage(CLES_STOCKAGE.produits, []);
  catalogue = catalogue.filter(p => p.id !== id);
  ecrireStockage(CLES_STOCKAGE.produits, catalogue);
  notifier("produits");
  await ajouterAuditLog("suppression_produit", `Produit "${nom}" supprimé`);
}

/**
 * Remplace le catalogue stocké localement par le catalogue par défaut le
 * plus récent (CATALOGUE_INITIAL, défini dans catalogue.js). Utile quand
 * une mise à jour de l'app change le catalogue mais que le navigateur a
 * encore une ancienne version en mémoire (sessionStorage). N'affecte ni les
 * commandes, ni les comptes utilisateurs, ni les autres paramètres.
 */

// --- Réordonnancement produits (drag-and-drop) ---
async function reordonnerProduit(srcId, targetId) {
  const catalogue = lireStockage(CLES_STOCKAGE.produits, CATALOGUE_INITIAL.map(p => ({ ...p, actif: true })));
  const src = catalogue.find(p => p.id === srcId);
  const tgt = catalogue.find(p => p.id === targetId);
  if (!src || !tgt || src.categorie !== tgt.categorie) return;
  const srcIdx = catalogue.findIndex(p => p.id === srcId);
  catalogue.splice(srcIdx, 1);
  const tgtIdx = catalogue.findIndex(p => p.id === targetId);
  catalogue.splice(tgtIdx, 0, src);
  ecrireStockage(CLES_STOCKAGE.produits, catalogue);
  notifier("produits");
}

// --- Réordonnancement catégories (drag-and-drop) ---
function obtenirOrdreCategories() {
  const sauvegarde = sessionStorage.getItem("eventpro_demo_ordre_categories");
  if (sauvegarde) {
    try {
      const ordre = JSON.parse(sauvegarde);
      ORDRE_CATEGORIES.forEach(c => { if (!ordre.includes(c)) ordre.push(c); });
      return ordre;
    } catch (e) {}
  }
  return [...ORDRE_CATEGORIES];
}

function reordonnerCategorie(srcCat, targetCat) {
  const ordre = obtenirOrdreCategories();
  const srcIdx = ordre.indexOf(srcCat);
  const tgtIdx = ordre.indexOf(targetCat);
  if (srcIdx === -1 || tgtIdx === -1 || srcIdx === tgtIdx) return;
  ordre.splice(srcIdx, 1);
  const newIdx = ordre.indexOf(targetCat);
  ordre.splice(newIdx, 0, srcCat);
  sessionStorage.setItem("eventpro_demo_ordre_categories", JSON.stringify(ordre));
  notifier("produits");
}

async function reinitialiserCatalogue() {
  const nouveauCatalogue = CATALOGUE_INITIAL.map(p => ({ ...p, actif: true }));
  ecrireStockage(CLES_STOCKAGE.produits, nouveauCatalogue);
  notifier("produits");
  await ajouterAuditLog("reinitialisation_catalogue", "Catalogue produits réinitialisé aux valeurs par défaut");
}

// ------------------------------------------------------------
// PARAMÈTRES ENTREPRISE
// ------------------------------------------------------------
async function recupererParametres() {
  const existant = lireStockage(CLES_STOCKAGE.parametres, null);
  if (existant) {
    if (!existant.configEtiquettes) existant.configEtiquettes = CONFIG_ETIQUETTES_DEFAUT;
    // Rétro-compat : nouveaux champs configurables
    if (!existant.nomEntreprise) existant.nomEntreprise = "Vanbaelinghem";
    if (!existant.sousNomEntreprise) existant.sousNomEntreprise = "commandes";
    if (!existant.prefixeCommande) existant.prefixeCommande = "CMD";
    if (!existant.statuts) existant.statuts = STATUTS.map(s => ({ ...s }));
    if (existant.resetAnnuel === undefined) existant.resetAnnuel = true;
    if (!existant.digitsNumero) existant.digitsNumero = 5;
    if (!existant.theme) existant.theme = "bordeaux";
    if (!existant.fichesImpression) existant.fichesImpression = [
      { id: "traiteur", label: "Traiteur" },
      { id: "boucherie", label: "Boucherie" },
      { id: "pierrades", label: "Pierrades" }
    ];
    if (!existant.instructionsCommande) existant.instructionsCommande = INSTRUCTIONS_PREPARATION;
    let codesAjoutes = false;
    if (existant.magasins) {
      existant.magasins = existant.magasins.map(m => {
        if (!m.code) {
          const def = MAGASINS.find(d => d.id === m.id);
          if (def && def.code) { codesAjoutes = true; return { ...m, code: def.code }; }
        }
        return m;
      });
      if (codesAjoutes) ecrireStockage(CLES_STOCKAGE.parametres, existant);
    }
    return existant;
  }
  const defaut = {
    magasins: MAGASINS, periodes: [], configEtiquettes: CONFIG_ETIQUETTES_DEFAUT,
    nomEntreprise: "Vanbaelinghem", sousNomEntreprise: "commandes",
    prefixeCommande: "CMD", resetAnnuel: true, digitsNumero: 5, theme: "bordeaux",
    statuts: STATUTS.map(s => ({ ...s })),
    fichesImpression: [
      { id: "traiteur", label: "Traiteur" },
      { id: "boucherie", label: "Boucherie" },
      { id: "pierrades", label: "Pierrades" }
    ],
    instructionsCommande: INSTRUCTIONS_PREPARATION
  };
  ecrireStockage(CLES_STOCKAGE.parametres, defaut);
  return defaut;
}

async function enregistrerParametres(params) {
  const existant = lireStockage(CLES_STOCKAGE.parametres, { magasins: MAGASINS, periodes: [] });
  const fusion = { ...existant, ...params };
  ecrireStockage(CLES_STOCKAGE.parametres, fusion);
  notifier("parametres");
  await ajouterAuditLog("modification_parametres", "Paramètres entreprise modifiés");
}

function ecouterParametres(callback) {
  function pousser(params) { callback(params || { magasins: MAGASINS, periodes: [] }); }
  pousser(lireStockage(CLES_STOCKAGE.parametres, null));
  ECOUTEURS.parametres.push(pousser);
  return () => {
    const i = ECOUTEURS.parametres.indexOf(pousser);
    if (i !== -1) ECOUTEURS.parametres.splice(i, 1);
  };
}

// ------------------------------------------------------------
// PÉRIODES ÉVÉNEMENTIELLES
// ------------------------------------------------------------
async function ajouterPeriode(periode) {
  const params = await recupererParametres();
  const periodes = params.periodes || [];
  const nouvelleId = "periode_" + Date.now();
  periodes.push({ id: nouvelleId, ...periode });
  await enregistrerParametres({ periodes });
  return nouvelleId;
}

async function supprimerPeriode(periodeId) {
  const params = await recupererParametres();
  const periodes = (params.periodes || []).filter(p => p.id !== periodeId);
  await enregistrerParametres({ periodes });
}

// ------------------------------------------------------------
// UTILISATEURS
// En mode local, on simule des comptes manager/admin avec un mot de passe
// stocké localement (texte simple). Suffisant pour la démo ; en production
// réelle, remettez la version Firebase (authentification sécurisée).
// ------------------------------------------------------------
async function recupererProfilUtilisateur(uid) {
  const utilisateurs = lireStockage(CLES_STOCKAGE.utilisateurs, []);
  return utilisateurs.find(u => u.uid === uid) || null;
}

async function creerProfilUtilisateur(uid, nom, role) {
  const utilisateurs = lireStockage(CLES_STOCKAGE.utilisateurs, []);
  utilisateurs.push({ uid, nom, role, creeLe: new Date().toISOString() });
  ecrireStockage(CLES_STOCKAGE.utilisateurs, utilisateurs);
}

async function listerUtilisateurs() {
  return lireStockage(CLES_STOCKAGE.utilisateurs, []);
}

async function modifierRoleUtilisateur(uid, role) {
  const utilisateurs = lireStockage(CLES_STOCKAGE.utilisateurs, []);
  const idx = utilisateurs.findIndex(u => u.uid === uid);
  if (idx !== -1) utilisateurs[idx].role = role;
  ecrireStockage(CLES_STOCKAGE.utilisateurs, utilisateurs);
  await ajouterAuditLog("modification_utilisateur", `Rôle de l'utilisateur ${uid} -> ${role}`);
}

/**
 * Réinitialise le mot de passe d'un utilisateur (action réservée à l'admin).
 * On ne permet jamais de consulter un mot de passe existant — seulement
 * d'en définir un nouveau.
 */
async function reinitialiserMotDePasse(uid, nouveauMotDePasse) {
  const utilisateurs = lireStockage(CLES_STOCKAGE.utilisateurs, []);
  const idx = utilisateurs.findIndex(u => u.uid === uid);
  if (idx === -1) throw new Error("Utilisateur introuvable.");
  utilisateurs[idx].motDePasse = nouveauMotDePasse;
  ecrireStockage(CLES_STOCKAGE.utilisateurs, utilisateurs);
  await ajouterAuditLog("reinitialisation_mot_de_passe", `Mot de passe réinitialisé pour ${utilisateurs[idx].nom}`);
}

/**
 * Connexion locale manager/admin : vérifie nom d'utilisateur + mot de passe
 * dans la liste des comptes locaux créés via l'écran Admin > Utilisateurs.
 * (Le champ technique s'appelle toujours "email" en interne pour rester
 * compatible avec les comptes créés avant ce changement, mais l'écran
 * affiche désormais "Nom d'utilisateur".)
 */
async function connexionLocale(email, motDePasse) {
  const utilisateurs = lireStockage(CLES_STOCKAGE.utilisateurs, []);
  const compte = utilisateurs.find(u => u.email === email && u.motDePasse === motDePasse);
  if (!compte) throw new Error("Nom d'utilisateur ou mot de passe incorrect.");
  return compte;
}

/**
 * Connexion par identifiant de compte (utilisée avec la liste déroulante des
 * utilisateurs existants) : plus fiable qu'une saisie texte, pas de souci de
 * casse, d'espace ou de faute de frappe sur le nom.
 */
async function connexionParUid(uid, motDePasse) {
  const utilisateurs = lireStockage(CLES_STOCKAGE.utilisateurs, []);
  const compte = utilisateurs.find(u => u.uid === uid);
  if (!compte) throw new Error("Compte introuvable.");
  if (compte.motDePasse !== motDePasse) throw new Error("Mot de passe incorrect.");
  return compte;
}

async function creerCompteLocal(nom, email, motDePasse, role) {
  const utilisateurs = lireStockage(CLES_STOCKAGE.utilisateurs, []);
  if (utilisateurs.some(u => u.email === email)) throw new Error("Ce nom d'utilisateur est déjà pris.");
  const compte = { uid: genererIdLocal(), nom, email, motDePasse, role, creeLe: new Date().toISOString() };
  utilisateurs.push(compte);
  ecrireStockage(CLES_STOCKAGE.utilisateurs, utilisateurs);
  return compte;
}

// ------------------------------------------------------------
// JOURNAL D'AUDIT
// ------------------------------------------------------------
async function ajouterAuditLog(action, description) {
  const logs = lireStockage(CLES_STOCKAGE.audit, []);
  logs.unshift({
    id: genererIdLocal(),
    utilisateur: utilisateurCourant.nom || "Système",
    role: utilisateurCourant.role || "inconnu",
    action,
    description,
    horodatage: new Date().toISOString()
  });
  ecrireStockage(CLES_STOCKAGE.audit, logs.slice(0, 500));
  notifier("audit");
}

function ecouterAuditLog(callback, limite = 200) {
  function pousser(logs) { callback((logs || []).slice(0, limite)); }
  pousser(lireStockage(CLES_STOCKAGE.audit, []));
  ECOUTEURS.audit.push(pousser);
  return () => {
    const i = ECOUTEURS.audit.indexOf(pousser);
    if (i !== -1) ECOUTEURS.audit.splice(i, 1);
  };
}

// ------------------------------------------------------------
// MIGRATION : renuméroter les commandes au nouveau format avec année
// ------------------------------------------------------------
async function migrerNumerosCommandes() {
  // Reformate les anciens numéros (CMD-000042 sur 6 chiffres) vers le nouveau
  // format sur 5 chiffres (CMD-00042), en appliquant aussi le préfixe configuré.
  const commandes = lireStockage(CLES_STOCKAGE.commandes, []);
  const params = lireStockage(CLES_STOCKAGE.parametres, null);
  const prefixe = (params && params.prefixeCommande) ? params.prefixeCommande : "CMD";

  let nbModifiees = 0;
  commandes.forEach(c => {
    if (!c.numero) return;
    // Extraire le dernier segment numérique (le compteur)
    const segments = c.numero.split("-");
    const dernierSegment = segments[segments.length - 1];
    const compteur = parseInt(dernierSegment, 10);
    if (!isNaN(compteur)) {
      const nouveau = prefixe + "-" + String(compteur).padStart(5, "0");
      if (c.numero !== nouveau) { c.numero = nouveau; nbModifiees++; }
    }
  });

  if (nbModifiees > 0) {
    ecrireStockage(CLES_STOCKAGE.commandes, commandes);
    notifier("commandes");
    await ajouterAuditLog("migration_numeros", "Numéros de commandes reformatés au nouveau format");
  }
  return { total: commandes.length, modifiees: nbModifiees };
}

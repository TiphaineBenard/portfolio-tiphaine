/* ============================================================
   BeautyPro — Démo : couche de données partagée
   Chargée par index.html (back-office) ET reservation.html (public)
   afin que les deux pages lisent/écrivent la même source de vérité.

   ⚠️ SIMULATION POUR CETTE DÉMO UNIQUEMENT.
   Le partage se fait via localStorage, ce qui ne fonctionne que
   dans le navigateur de la personne qui fait la démo.

   PRODUCTION — ce que remplacerait cette couche :
   - authentification back-office : Firebase Authentication (ou équivalent)
     + règles de sécurité serveur (personne ne doit pouvoir lire les
     clientes, le CA ou le planning détaillé sans être identifié comme
     membre de CET institut) ;
   - stockage : Firestore ou un backend avec vraie base de données,
     pas le navigateur de l'utilisateur ;
   - réservation publique : une fonction serveur revalide la disponibilité
     réelle et crée le rendez-vous — jamais une écriture libre côté client ;
   - identité d'une cliente reconnue : vérification par SMS/email avant
     d'afficher son dossier, pas juste "elle a tapé le bon numéro" ;
   - acompte : un vrai prestataire de paiement (Stripe ou équivalent).
   ============================================================ */

const BP_VERSION = "1";

const BP_CLES = {
  version:      "beautypro_data_version",
  prestations:  "beautypro_prestations",
  praticiennes: "beautypro_praticiennes",
  rdvs:         "beautypro_rdvs",
  clientes:     "beautypro_clientes"
};

const BP_CABINES = ["Cabine 1 — Visage & corps", "Cabine 2 — Épilation laser", "Cabine 3 — Manucure/Pédicure"];
const BP_OUVERTURE = 9 * 60;   // 09h00 en minutes
const BP_FERMETURE = 19 * 60;  // 19h00 en minutes

// "Aujourd'hui" pour cette démo — sert de référence au Dashboard et aux KPI.
const BP_DATE_REF = "2026-09-15";

const BP_STATUTS = ["À confirmer", "Confirmé", "Arrivée", "Terminé", "Absente", "Annulé"];
const BP_STATUT_COULEUR = {
  "À confirmer": "#C97B63",
  "Confirmé":    "#4C6B49",
  "Arrivée":     "#2E6F8E",
  "Terminé":     "#8A7A72",
  "Absente":     "#C0392B",
  "Annulé":      "#C0392B"
};

// ---------------------------------------------------------------
// Données de départ (utilisées uniquement si rien n'existe encore
// dans le localStorage, ou si la version du schéma a changé)
// ---------------------------------------------------------------

function bpSeedPrestations(){
  return [
    { id:0, categorie:"Soins visage",       nom:"Soin visage éclat",              duree:45, prix:55, cabine:0, reservableEnLigne:true,  acompte:0 },
    { id:1, categorie:"Soins visage",       nom:"Soin visage anti-âge",           duree:75, prix:75, cabine:0, reservableEnLigne:true,  acompte:0 },
    { id:2, categorie:"Massages",           nom:"Massage relaxant",               duree:60, prix:65, cabine:0, reservableEnLigne:true,  acompte:0 },
    { id:3, categorie:"Massages",           nom:"Massage aux pierres chaudes",    duree:90, prix:90, cabine:0, reservableEnLigne:true,  acompte:20 },
    { id:4, categorie:"Épilation & Laser",  nom:"Épilation jambes complètes",     duree:30, prix:40, cabine:1, reservableEnLigne:true,  acompte:0 },
    { id:5, categorie:"Épilation & Laser",  nom:"Épilation laser — séance de forfait", duree:30, prix:0, cabine:1, reservableEnLigne:true,  acompte:0 },
    { id:6, categorie:"Onglerie",           nom:"Manucure + pose vernis",         duree:40, prix:35, cabine:2, reservableEnLigne:true,  acompte:0 },
    { id:7, categorie:"Onglerie",           nom:"Pédicure spa",                   duree:60, prix:50, cabine:2, reservableEnLigne:true,  acompte:0 },
    { id:8, categorie:"Épilation & Laser",  nom:"Épilation dos",                  duree:45, prix:55, cabine:1, reservableEnLigne:false, acompte:0 }
  ];
}

function bpSeedPraticiennes(){
  // Chaque catégorie de soin ne peut être réalisée que par une praticienne compétente,
  // et une même praticienne ne peut pas être sur deux soins en même temps — même dans des cabines différentes.
  return [
    { id:0, nom:"Julie",  competences:["Soins visage","Massages","Épilation & Laser"] },
    { id:1, nom:"Marine", competences:["Soins visage","Épilation & Laser"] },
    { id:2, nom:"Emma",   competences:["Onglerie","Massages"] }
  ];
}

function bpSeedClientes(){
  return [
    { id:0, nom:"Sophie Marchand", depuis:"cliente depuis mars 2025", telephone:"06 12 34 56 78", email:"sophie.marchand@email.fr", caCumule:645,
      forfait:null, zonesTraitees:"Visage (soin éclat régulier)", dernierProduit:"Sérum vitamine C + masque hydratant",
      historique:[ {date:"18 août", soin:"Soin visage éclat"}, {date:"2 juillet", soin:"Épilation jambes complètes"}, {date:"14 mai", soin:"Soin visage éclat"} ],
      alerte:"Allergie connue : huiles essentielles d'agrumes",
      note:"Peau réactive au peeling, bien hydrater avec la crème apaisante après chaque soin. Préfère les créneaux en fin d'après-midi.",
      photos:true, prochainRdv:"15 septembre — 14h00" },
    { id:1, nom:"Camille Roussel", depuis:"cliente depuis janvier 2024", telephone:"06 23 45 67 89", email:"camille.roussel@email.fr", caCumule:1170,
      forfait:null, zonesTraitees:"Dos, épaules", dernierProduit:"Huile de massage relaxante — chaude",
      historique:[ {date:"1 septembre", soin:"Massage relaxant"}, {date:"3 août", soin:"Massage relaxant"}, {date:"6 juillet", soin:"Soin du dos"} ],
      alerte:null, note:"Vient tous les mois pour un massage, très régulière.", photos:false, prochainRdv:"15 septembre — 9h00" },
    { id:2, nom:"Nadia Belkacem", depuis:"cliente depuis juin 2025", telephone:"06 34 56 78 90", email:"nadia.belkacem@email.fr", caCumule:820,
      forfait:{ soin:"Épilation laser — aisselles", prestationId:5, actuel:4, total:10, resteAPayer:0, dateLimite:"20 février 2027", derniereSeance:"12 août", prochaineRecommandee:"23 septembre" },
      zonesTraitees:"Aisselles", dernierProduit:"Laser diode — puissance 18J, gel refroidissant",
      historique:[ {date:"20 août", soin:"Épilation laser — séance 3/10"}, {date:"18 juillet", soin:"Épilation laser — séance 2/10"} ],
      alerte:"Peau sensible, éviter les produits parfumés",
      note:"Réglage laser à garder à 18J, elle a bien toléré la dernière séance.", photos:false, prochainRdv:"15 septembre — 10h00" },
    { id:3, nom:"Léa Fontaine", depuis:"cliente depuis février 2026", telephone:"06 45 67 89 01", email:"lea.fontaine@email.fr", caCumule:35,
      forfait:null, zonesTraitees:"Mains", dernierProduit:"Vernis semi-permanent — teinte nude",
      historique:[ {date:"28 août", soin:"Manucure + pose vernis"} ],
      alerte:null, note:"Nouvelle cliente, venue via une recommandation.", photos:false, prochainRdv:"15 septembre — 15h00" },
    { id:4, nom:"Inès Ouedraogo", depuis:"cliente depuis avril 2026", telephone:"06 56 78 90 12", email:"ines.ouedraogo@email.fr", caCumule:360,
      forfait:{ soin:"Épilation laser — jambes complètes", prestationId:5, actuel:2, total:6, resteAPayer:180, dateLimite:"10 décembre 2026", derniereSeance:"25 août", prochaineRecommandee:"6 octobre" },
      zonesTraitees:"Jambes complètes", dernierProduit:"Laser diode — puissance 22J",
      historique:[ {date:"25 août", soin:"Épilation laser — séance 1/6"} ],
      alerte:null, note:"Forfait payé en 3 fois, prochain prélèvement le 1er octobre.", photos:true, prochainRdv:"15 septembre — 17h00" },
    { id:5, nom:"Emma Petit", depuis:"cliente depuis mai 2026", telephone:"06 67 89 01 23", email:"emma.petit@email.fr", caCumule:110,
      forfait:null, zonesTraitees:"Visage", dernierProduit:"Masque hydratant apaisant",
      historique:[ {date:"28 juillet", soin:"Soin visage éclat"} ],
      alerte:null, note:"", photos:false, prochainRdv:"15 septembre — 11h00" },
    { id:6, nom:"Yasmine Chérif", depuis:"cliente depuis janvier 2026", telephone:"06 78 90 12 34", email:"yasmine.cherif@email.fr", caCumule:220,
      forfait:null, zonesTraitees:"Dos", dernierProduit:"Cire tiède",
      historique:[ {date:"20 juillet", soin:"Épilation dos"} ],
      alerte:null, note:"", photos:false, prochainRdv:"15 septembre — 14h00" },
    { id:7, nom:"Marion Lefèvre", depuis:"cliente depuis mars 2026", telephone:"06 89 01 23 45", email:"marion.lefevre@email.fr", caCumule:150,
      forfait:null, zonesTraitees:"Pieds", dernierProduit:"Ponçage + vernis classique",
      historique:[ {date:"22 juillet", soin:"Pédicure spa"} ],
      alerte:null, note:"", photos:false, prochainRdv:"15 septembre — 16h00" },
    { id:8, nom:"Aïcha Benali", depuis:"cliente depuis novembre 2025", telephone:"06 90 12 34 56", email:"aicha.benali@email.fr", caCumule:0,
      forfait:null, zonesTraitees:"—", dernierProduit:"—",
      historique:[ {date:"14 juillet", soin:"Massage relaxant"} ],
      alerte:null, note:"Aucun RDV repris depuis plus de 8 semaines, à relancer.", photos:false, prochainRdv:null }
  ];
}

function bpSeedRdvs(){
  const D = BP_DATE_REF;
  return [
    { id:1, date:D, prestationId:3, cliente:"Camille Roussel", clienteId:1, debut:540,  duree:90, prix:90, cabine:0, praticienneId:0, statut:"Confirmé",    paye:false, forfait:null },
    { id:2, date:D, prestationId:5, cliente:"Nadia Belkacem",  clienteId:2, debut:600,  duree:30, prix:0,  cabine:1, praticienneId:1, statut:"Confirmé",    paye:true,  forfait:{actuel:4,total:10} },
    { id:6, date:D, prestationId:0, cliente:"Emma Petit",      clienteId:5, debut:660,  duree:45, prix:55, cabine:0, praticienneId:0, statut:"Confirmé",    paye:false, forfait:null },
    { id:3, date:D, prestationId:1, cliente:"Sophie Marchand", clienteId:0, debut:840,  duree:75, prix:75, cabine:0, praticienneId:0, statut:"À confirmer", paye:false, forfait:null },
    { id:7, date:D, prestationId:8, cliente:"Yasmine Chérif",  clienteId:6, debut:840,  duree:45, prix:55, cabine:1, praticienneId:1, statut:"Confirmé",    paye:false, forfait:null },
    { id:4, date:D, prestationId:6, cliente:"Léa Fontaine",    clienteId:3, debut:900,  duree:40, prix:35, cabine:2, praticienneId:2, statut:"Confirmé",    paye:false, forfait:null },
    { id:8, date:D, prestationId:7, cliente:"Marion Lefèvre",  clienteId:7, debut:960,  duree:60, prix:50, cabine:2, praticienneId:2, statut:"Confirmé",    paye:false, forfait:null },
    { id:5, date:D, prestationId:5, cliente:"Inès Ouedraogo",  clienteId:4, debut:1020, duree:30, prix:0,  cabine:1, praticienneId:1, statut:"Confirmé",    paye:true,  forfait:{actuel:2,total:6} }
  ];
}

// ---------------------------------------------------------------
// Chargement / sauvegarde
// ---------------------------------------------------------------

function bpInitDonnees(){
  const versionStockee = localStorage.getItem(BP_CLES.version);
  if(versionStockee !== BP_VERSION){
    // Premier lancement, ou schéma modifié depuis : on réinitialise proprement.
    localStorage.setItem(BP_CLES.prestations, JSON.stringify(bpSeedPrestations()));
    localStorage.setItem(BP_CLES.praticiennes, JSON.stringify(bpSeedPraticiennes()));
    localStorage.setItem(BP_CLES.clientes, JSON.stringify(bpSeedClientes()));
    localStorage.setItem(BP_CLES.rdvs, JSON.stringify(bpSeedRdvs()));
    localStorage.setItem(BP_CLES.version, BP_VERSION);
  }
  return bpLireTout();
}

function bpLireTout(){
  return {
    prestations:  JSON.parse(localStorage.getItem(BP_CLES.prestations)  || "[]"),
    praticiennes: JSON.parse(localStorage.getItem(BP_CLES.praticiennes) || "[]"),
    clientes:     JSON.parse(localStorage.getItem(BP_CLES.clientes)     || "[]"),
    rdvs:         JSON.parse(localStorage.getItem(BP_CLES.rdvs)         || "[]")
  };
}

function bpSauvegarderPrestations(liste){ localStorage.setItem(BP_CLES.prestations, JSON.stringify(liste)); }
function bpSauvegarderPraticiennes(liste){ localStorage.setItem(BP_CLES.praticiennes, JSON.stringify(liste)); }
function bpSauvegarderClientes(liste){ localStorage.setItem(BP_CLES.clientes, JSON.stringify(liste)); }
function bpSauvegarderRdvs(liste){ localStorage.setItem(BP_CLES.rdvs, JSON.stringify(liste)); }

function bpReinitialiserDemo(){
  Object.keys(BP_CLES).forEach(k => localStorage.removeItem(BP_CLES[k]));
  return bpInitDonnees();
}

// Prévient une page quand l'AUTRE onglet (index.html ou reservation.html)
// modifie une des clés BeautyPro. Utilisé pour garder les deux pages synchronisées.
function bpEcouterChangements(callback){
  const clesConnues = Object.values(BP_CLES);
  window.addEventListener('storage', (e) => {
    if(!e.key || clesConnues.includes(e.key)) callback(e);
  });
  // Filet de sécurité : le retour sur l'onglet recharge aussi les données.
  // (l'évènement "storage" est parfois peu fiable entre pages ouvertes en local avec file://)
  window.addEventListener('focus', () => callback(null));
  document.addEventListener('visibilitychange', () => { if(!document.hidden) callback(null); });
}

// ---------------------------------------------------------------
// Dates — un RDV a une vraie date "YYYY-MM-DD", pas juste un décalage.
// ---------------------------------------------------------------

const BP_NOMS_JOURS = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
const BP_NOMS_JOURS_ABREV = ['dim.','lun.','mar.','mer.','jeu.','ven.','sam.'];
const BP_NOMS_MOIS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];

function bpDateObjet(cle){
  const [y,m,d] = cle.split('-').map(Number);
  return new Date(y, m-1, d);
}
function bpDateVersCle(dt){
  return dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0') + '-' + String(dt.getDate()).padStart(2,'0');
}
function bpAjouterJours(cle, n){
  const dt = bpDateObjet(cle);
  dt.setDate(dt.getDate() + n);
  return bpDateVersCle(dt);
}
function bpDateDepuisOffset(offset){ return bpAjouterJours(BP_DATE_REF, offset); }

// "Mercredi 16 septembre 2026" — pour récap, email, confirmation
function bpDateAffichee(cle){
  const dt = bpDateObjet(cle);
  const nom = BP_NOMS_JOURS[dt.getDay()];
  return nom.charAt(0).toUpperCase() + nom.slice(1) + ' ' + dt.getDate() + ' ' + BP_NOMS_MOIS[dt.getMonth()] + ' ' + dt.getFullYear();
}
// "Mercredi 16 septembre" — pour l'entête du planning back-office (sans année)
function bpDateAfficheeCourte(cle){
  const dt = bpDateObjet(cle);
  const nom = BP_NOMS_JOURS[dt.getDay()];
  return nom.charAt(0).toUpperCase() + nom.slice(1) + ' ' + dt.getDate() + ' ' + BP_NOMS_MOIS[dt.getMonth()];
}
// "Aujourd'hui" / "Mer. 16" — pour les puces de sélection de date côté réservation
function bpLabelPuceDate(cle){
  if(cle === BP_DATE_REF) return "Aujourd'hui";
  const dt = bpDateObjet(cle);
  return BP_NOMS_JOURS_ABREV[dt.getDay()] + ' ' + dt.getDate();
}

function bpMinVersHeureStr(min){
  const h = Math.floor(min/60), m = min%60;
  return String(h).padStart(2,'0') + 'h' + String(m).padStart(2,'0');
}
function bpFormatDuree(min){
  if(min < 60) return min + ' min';
  const h = Math.floor(min/60), r = min%60;
  return r===0 ? h+'h' : h+'h'+String(r).padStart(2,'0');
}
function bpNormaliserTel(t){ return (t||'').replace(/[^0-9]/g, ''); }

// Prochain id disponible dans une liste d'objets {id, ...} — utilisé pour les créations
// de prestations, clientes et RDV côté back-office comme côté réservation publique.
function bpProchainId(liste){
  return (liste||[]).reduce((max, item) => Math.max(max, item.id || 0), 0) + 1;
}

// Sépare "Sophie Marchand" en {prenom:"Sophie", nom:"Marchand"} pour les besoins
// du parcours de réservation, sans migrer toute la structure interne des clientes.
function bpPrenomNom(nomComplet){
  const parties = (nomComplet||'').trim().split(' ');
  return { prenom: parties[0] || '', nom: parties.slice(1).join(' ') || '' };
}

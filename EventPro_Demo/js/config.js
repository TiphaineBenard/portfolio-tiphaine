// ============================================================
// CONFIGURATION GLOBALE - EventPro — VERSION DÉMO
// ============================================================

// --- MODE DE FONCTIONNEMENT ACTUEL : LOCAL ---
// Les données sont stockées dans sessionStorage (isolé par onglet, effacé
// à la fermeture) : chaque visiteur de la démo repart de zéro et personne
// ne voit les données d'un autre. Pas de configuration nécessaire. L'app
// s'ouvre directement en double-cliquant sur index.html.
//
// Quand vous serez prêts pour la synchronisation multi-magasins en temps
// réel, voir le README.md ("Passer en mode multi-magasins"). Vous aurez
// alors besoin de créer un projet Firebase et de renseigner sa configuration
// ici, sous la forme :
//
// const FIREBASE_CONFIG = {
//   apiKey: "...",
//   authDomain: "....firebaseapp.com",
//   projectId: "...",
//   storageBucket: "....appspot.com",
//   messagingSenderId: "...",
//   appId: "..."
// };

// --- MAGASINS ---
const MAGASINS = [
  { id: "magasin-a", nom: "Magasin A", code: "MA" },
  { id: "magasin-b", nom: "Magasin B", code: "MB" },
  { id: "magasin-c", nom: "Magasin C", code: "MC" },
  { id: "magasin-d", nom: "Magasin D", code: "MD" },
  { id: "magasin-e", nom: "Magasin E", code: "ME" }
];

// --- STATUTS DE COMMANDE ---
const STATUTS = [
  { id: "en_attente", label: "En attente", couleur: "#94a3b8" },
  { id: "validee", label: "Validée", couleur: "#3b82f6" },
  { id: "en_production", label: "En production", couleur: "#f59e0b" },
  { id: "prete", label: "Prête", couleur: "#10b981" },
  { id: "livree", label: "Livrée", couleur: "#6366f1" },
  { id: "annulee", label: "Annulée", couleur: "#b3261e" }
];

// --- TYPES DE VENTE ---
const TYPES_VENTE = [
  { id: "unite", label: "Produit seul" },
  { id: "menu", label: "Menu" },
  { id: "box", label: "Box / Formule" }
];

// --- INSTRUCTIONS DE PRÉPARATION (métier réel) ---
const INSTRUCTIONS_PREPARATION = [
  { id: "conditionnement_separe", label: "Conditionnement séparé", icone: "📦" },
  { id: "fragile", label: "Fragile", icone: "⚠️" },
  { id: "froid", label: "À conserver au froid", icone: "❄️" },
  { id: "emballage_individuel", label: "Emballage individuel", icone: "🎁" },
  { id: "vip", label: "Client VIP", icone: "⭐" },
  { id: "urgent", label: "Livraison urgente", icone: "🚨" }
];

// --- RÔLES UTILISATEURS ---
const ROLES = {
  SALARIE: "salarie",
  MANAGER: "manager",
  ADMIN: "admin"
};

// Permissions par rôle
const PERMISSIONS = {
  salarie: ["creer_commande", "consulter", "modifier_commande"],
  manager: ["creer_commande", "consulter", "modifier_commande", "valider_commande", "organiser_production", "imprimer"],
  admin: ["creer_commande", "consulter", "modifier_commande", "valider_commande", "organiser_production", "imprimer",
          "gerer_produits", "gerer_utilisateurs", "modifier_globale", "export_complet", "gerer_parametres"]
};

function aPermission(role, permission) {
  return (PERMISSIONS[role] || []).includes(permission);
}

// --- ÉTIQUETTES (configuration par fiche d'impression) ---
// Pour chaque catégorie (traiteur/boucherie/pierrades), indique si le
// numéro de commande et le nom du client doivent apparaître sur les
// étiquettes générées pour les produits de cette catégorie.
const CONFIG_ETIQUETTES_DEFAUT = {
  traiteur: { afficherNumeroCommande: true, afficherNomClient: true },
  boucherie: { afficherNumeroCommande: true, afficherNomClient: true },
  pierrades: { afficherNumeroCommande: true, afficherNomClient: true }
};

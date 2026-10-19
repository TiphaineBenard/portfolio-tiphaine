// ============================================================
// DONNÉES DE DÉMONSTRATION — EventPro
// Injecte des données fictives au premier lancement pour que
// la démo soit vivante dès l'ouverture.
//
// Comptes démo :
//   Admin     → identifiant: admin    / mot de passe: 0000
//   Manager   → identifiant: manager  / mot de passe: 0000
//   Salarié   → entrer n'importe quel prénom (pas de mot de passe)
// ============================================================
(function seedDemo() {
  const FLAG = "eventpro_demo_seeded_v2";
  if (sessionStorage.getItem(FLAG)) return; // déjà initialisé

  const CLES = {
    commandes:    "eventpro_demo_commandes",
    produits:     "eventpro_demo_produits",
    parametres:   "eventpro_demo_parametres",
    utilisateurs: "eventpro_demo_utilisateurs",
    audit:        "eventpro_demo_audit",
    compteur:     "eventpro_demo_compteur"
  };

  function genId() {
    return "id_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  // ── UTILISATEURS ──────────────────────────────────────────
  const utilisateurs = [
    {
      uid: "demo_admin_001", nom: "Admin Démo",
      email: "admin", motDePasse: "0000", role: "admin",
      creeLe: "2026-12-01T08:00:00.000Z"
    },
    {
      uid: "demo_manager_001", nom: "Manager Démo",
      email: "manager", motDePasse: "0000", role: "manager",
      creeLe: "2026-12-01T08:00:00.000Z"
    }
  ];

  // ── PARAMÈTRES ────────────────────────────────────────────
  const parametres = {
    nomEntreprise: "Mon Commerce",
    sousNomEntreprise: "commandes événementielles",
    prefixeCommande: "CMD",
    resetAnnuel: true,
    digitsNumero: 5,
    theme: "bordeaux",
    magasins: [
      { id: "magasin-a", nom: "Magasin A", code: "MA" },
      { id: "magasin-b", nom: "Magasin B", code: "MB" },
      { id: "magasin-c", nom: "Magasin C", code: "MC" },
      { id: "magasin-d", nom: "Magasin D", code: "MD" },
      { id: "magasin-e", nom: "Magasin E", code: "ME" }
    ],
    periodes: [
      {
        id: "noel_2026", nom: "Noël 2026",
        dateDebut: "2026-12-18", dateFin: "2026-12-31",
        jours: ["2026-12-22","2026-12-23","2026-12-24","2026-12-25","2026-12-26","2026-12-27","2026-12-28","2026-12-29","2026-12-30","2026-12-31"]
      },
      {
        id: "reveillon_2027", nom: "Réveillon 2026-2027",
        dateDebut: "2026-12-31", dateFin: "2027-01-01",
        jours: ["2026-12-31","2027-01-01"]
      }
    ],
    statuts: [
      { id: "en_attente",    label: "En attente",     couleur: "#94a3b8" },
      { id: "validee",       label: "Validée",         couleur: "#3b82f6" },
      { id: "en_production", label: "En production",   couleur: "#f59e0b" },
      { id: "prete",         label: "Prête",           couleur: "#10b981" },
      { id: "livree",        label: "Livrée",          couleur: "#6366f1" },
      { id: "annulee",       label: "Annulée",         couleur: "#b3261e" }
    ],
    fichesImpression: [
      { id: "traiteur",   label: "Traiteur" },
      { id: "boucherie",  label: "Boucherie" },
      { id: "pierrades",  label: "Pierrades" }
    ],
    instructionsCommande: [
      { id: "conditionnement_separe", label: "Conditionnement séparé", icone: "📦" },
      { id: "fragile",                label: "Fragile",                 icone: "⚠️" },
      { id: "froid",                  label: "À conserver au froid",    icone: "❄️" },
      { id: "emballage_individuel",   label: "Emballage individuel",    icone: "🎁" },
      { id: "vip",                    label: "Client VIP",              icone: "⭐" },
      { id: "urgent",                 label: "Livraison urgente",       icone: "🚨" }
    ],
    configEtiquettes: {
      traiteur:  { afficherNumeroCommande: true, afficherNomClient: true },
      boucherie: { afficherNumeroCommande: true, afficherNomClient: true },
      pierrades: { afficherNumeroCommande: true, afficherNomClient: true }
    }
  };

  // ── COMMANDES ─────────────────────────────────────────────
  const commandes = [
    {
      id: genId(), numero: "CMD-00001",
      client: "Famille Dupont", telephoneClient: "06 12 34 56 78", emailClient: "dupont@email.fr",
      magasinId: "magasin-a", dateRetrait: "2026-12-24", periodeId: "noel_2026",
      vendeur: "Manager Démo",
      lignes: [
        { produitId: "box_surprise",    nom: "Box Surprise",                  typeVente: "unite", quantite: 2,   prixUnitaire: 40,    specification: "", options: {} },
        { produitId: "foie_gras",       nom: "Assiette de Foie Gras de Canard", typeVente: "unite", quantite: 6, prixUnitaire: 9,     specification: "", options: {} },
        { produitId: "boudin_blanc_nature", nom: "Boudin Blanc Nature (au kg)", typeVente: "poids", quantite: 1, poidsKg: 1.2, prixUnitaire: 23.88, specification: "", options: {} }
      ],
      instructions: ["vip"], remarques: "Livraison avant 18h impérativement",
      statut: "en_production", imprimee: false, dateImpression: null, imprimePar: null,
      creePar: "Manager Démo", creeLe: "2026-12-10T09:30:00.000Z", modifieLe: "2026-12-12T14:20:00.000Z"
    },
    {
      id: genId(), numero: "CMD-00002",
      client: "M. et Mme Bernard", telephoneClient: "07 89 01 23 45", emailClient: "",
      magasinId: "magasin-b", dateRetrait: "2026-12-25", periodeId: "noel_2026",
      vendeur: "Admin Démo",
      lignes: [
        { produitId: "plateau_verrines",  nom: "Plateau de Verrines",         typeVente: "unite", quantite: 1, prixUnitaire: 40,  specification: "", options: {} },
        { produitId: "coquille_st_jacques", nom: "Coquille Saint-Jacques",    typeVente: "unite", quantite: 8, prixUnitaire: 9,   specification: "", options: {} },
        { produitId: "saumon_fume",       nom: "Saumon Fumé (100g)",          typeVente: "unite", quantite: 4, prixUnitaire: 5.1, specification: "", options: {} }
      ],
      instructions: [], remarques: "",
      statut: "validee", imprimee: false, dateImpression: null, imprimePar: null,
      creePar: "Admin Démo", creeLe: "2026-12-08T11:15:00.000Z", modifieLe: "2026-12-09T10:00:00.000Z"
    },
    {
      id: genId(), numero: "CMD-00003",
      client: "Société Leclerc & Fils", telephoneClient: "03 28 45 67 89", emailClient: "contact@leclerc-fils.fr",
      magasinId: "magasin-a", dateRetrait: "2026-12-23", periodeId: "noel_2026",
      vendeur: "Manager Démo",
      lignes: [
        { produitId: "box_navettes_prestige", nom: "Box Navettes Prestiges",  typeVente: "unite", quantite: 5,  prixUnitaire: 40, specification: "5 boîtes séparées", options: {} },
        { produitId: "assiette_festive_chaude", nom: "Assiette Festive Chaude", typeVente: "unite", quantite: 20, prixUnitaire: 15, specification: "", options: {} }
      ],
      instructions: ["conditionnement_separe", "fragile"], remarques: "Commande entreprise — 20 personnes",
      statut: "prete",
      imprimee: true, dateImpression: "2026-12-20T08:30:00.000Z", imprimePar: "Manager Démo",
      creePar: "Manager Démo", creeLe: "2026-11-28T14:00:00.000Z", modifieLe: "2026-12-20T08:30:00.000Z"
    },
    {
      id: genId(), numero: "CMD-00004",
      client: "Marie Rousseau", telephoneClient: "06 55 44 33 22", emailClient: "marie.rousseau@gmail.com",
      magasinId: "magasin-c", dateRetrait: "2026-12-31", periodeId: "reveillon_2027",
      vendeur: "Manager Démo",
      lignes: [
        { produitId: "pierrade_nature",   nom: "Pierrade Festive Nature",      typeVente: "pierrade", quantite: 4, prixUnitaire: 8.9, specification: "", options: {} },
        { produitId: "pierrade_marinee",  nom: "Pierrade Festive Marinée",     typeVente: "pierrade", quantite: 4, prixUnitaire: 8.9, specification: "", options: {} },
        { produitId: "gratin_crabe",      nom: "Gratin de Crabe avec Carapace", typeVente: "unite",   quantite: 8, prixUnitaire: 6,   specification: "", options: {} }
      ],
      instructions: ["froid"], remarques: "8 personnes — réveillon en famille",
      statut: "en_attente", imprimee: false, dateImpression: null, imprimePar: null,
      creePar: "Manager Démo", creeLe: "2026-12-15T16:45:00.000Z", modifieLe: "2026-12-15T16:45:00.000Z"
    },
    {
      id: genId(), numero: "CMD-00005",
      client: "Restaurant Le Provençal", telephoneClient: "04 91 23 45 67", emailClient: "chef@leprovencal.fr",
      magasinId: "magasin-b", dateRetrait: "2026-12-24", periodeId: "noel_2026",
      vendeur: "Admin Démo",
      lignes: [
        { produitId: "foie_gras",          nom: "Assiette de Foie Gras de Canard", typeVente: "unite", quantite: 15, prixUnitaire: 9,     specification: "", options: {} },
        { produitId: "trilogie_mer",        nom: "Trilogie de la Mer",              typeVente: "unite", quantite: 15, prixUnitaire: 8,     specification: "", options: {} },
        { produitId: "boudin_blanc_truffe", nom: "Boudin Blanc Truffé (au kg)",     typeVente: "poids", quantite: 1, poidsKg: 2.5, prixUnitaire: 62.25, specification: "", options: {} }
      ],
      instructions: ["urgent", "vip"], remarques: "Restaurateur — livraison avant 10h",
      statut: "livree",
      imprimee: true, dateImpression: "2026-12-21T07:00:00.000Z", imprimePar: "Admin Démo",
      creePar: "Admin Démo", creeLe: "2026-12-05T10:00:00.000Z", modifieLe: "2026-12-24T09:45:00.000Z"
    },
    {
      id: genId(), numero: "CMD-00006",
      client: "Famille Martin", telephoneClient: "06 98 76 54 32", emailClient: "",
      magasinId: "magasin-d", dateRetrait: "2026-12-25", periodeId: "noel_2026",
      vendeur: "Manager Démo",
      lignes: [
        { produitId: "ananas_iles",       nom: "Ananas des Îles",              typeVente: "unite", quantite: 2, prixUnitaire: 7.5, specification: "", options: {} },
        { produitId: "coquille_st_jacques", nom: "Coquille Saint-Jacques",     typeVente: "unite", quantite: 4, prixUnitaire: 9,   specification: "", options: {} },
        { produitId: "box_wraps",         nom: "Box Wraps",                    typeVente: "unite", quantite: 1, prixUnitaire: 40,  specification: "", options: {} }
      ],
      instructions: [], remarques: "",
      statut: "en_attente", imprimee: false, dateImpression: null, imprimePar: null,
      creePar: "Manager Démo", creeLe: "2026-12-14T15:30:00.000Z", modifieLe: "2026-12-14T15:30:00.000Z"
    },
    {
      id: genId(), numero: "CMD-00007",
      client: "Comité d'entreprise Bouygues", telephoneClient: "01 23 45 67 89", emailClient: "ce@bouygues-local.fr",
      magasinId: "magasin-a", dateRetrait: "2026-12-20", periodeId: "noel_2026",
      vendeur: "Admin Démo",
      lignes: [
        { produitId: "box_surprise",         nom: "Box Surprise",          typeVente: "unite", quantite: 12, prixUnitaire: 40, specification: "", options: {} },
        { produitId: "assiette_festive_chaude", nom: "Assiette Festive Chaude", typeVente: "unite", quantite: 12, prixUnitaire: 15, specification: "", options: {} }
      ],
      instructions: ["emballage_individuel"], remarques: "12 colis individuels — repas de Noël CE",
      statut: "prete",
      imprimee: true, dateImpression: "2026-12-18T08:00:00.000Z", imprimePar: "Admin Démo",
      creePar: "Admin Démo", creeLe: "2026-12-01T09:00:00.000Z", modifieLe: "2026-12-18T08:00:00.000Z"
    },
    {
      id: genId(), numero: "CMD-00008",
      client: "Julien Petit", telephoneClient: "07 11 22 33 44", emailClient: "julien.petit@outlook.fr",
      magasinId: "magasin-e", dateRetrait: "2026-12-24", periodeId: "noel_2026",
      vendeur: "Manager Démo",
      lignes: [
        { produitId: "brioche_volaille",      nom: "Brioche de Volaille Forestière",       typeVente: "unite", quantite: 6, prixUnitaire: 5,   specification: "", options: {} },
        { produitId: "cassolette_st_jacques", nom: "Cassolette St Jacques et Crevettes",   typeVente: "unite", quantite: 6, prixUnitaire: 6.3, specification: "", options: {} },
        { produitId: "saumon_fume",           nom: "Saumon Fumé (100g)",                   typeVente: "unite", quantite: 3, prixUnitaire: 5.1, specification: "", options: {} }
      ],
      instructions: [], remarques: "6 personnes",
      statut: "validee", imprimee: false, dateImpression: null, imprimePar: null,
      creePar: "Manager Démo", creeLe: "2026-12-11T17:20:00.000Z", modifieLe: "2026-12-12T09:00:00.000Z"
    },
    {
      id: genId(), numero: "CMD-00009",
      client: "Nathalie Girard", telephoneClient: "06 33 22 11 00", emailClient: "",
      magasinId: "magasin-c", dateRetrait: "2026-12-25", periodeId: "noel_2026",
      vendeur: "Manager Démo",
      lignes: [
        { produitId: "vol_au_vent_poulet", nom: "Vol au Vent Poulet",              typeVente: "unite", quantite: 8, prixUnitaire: 4.2, specification: "", options: {} },
        { produitId: "foie_gras",          nom: "Assiette de Foie Gras de Canard", typeVente: "unite", quantite: 4, prixUnitaire: 9,   specification: "", options: {} }
      ],
      instructions: ["froid"], remarques: "",
      statut: "en_attente", imprimee: false, dateImpression: null, imprimePar: null,
      creePar: "Manager Démo", creeLe: "2026-12-16T11:00:00.000Z", modifieLe: "2026-12-16T11:00:00.000Z"
    },
    {
      id: genId(), numero: "CMD-00010",
      client: "Club Sportif ASM", telephoneClient: "05 56 78 90 12", emailClient: "secretariat@asm-club.fr",
      magasinId: "magasin-b", dateRetrait: "2026-12-22", periodeId: "noel_2026",
      vendeur: "Admin Démo",
      lignes: [
        { produitId: "plateau_verrines",      nom: "Plateau de Verrines",     typeVente: "unite", quantite: 3,  prixUnitaire: 40, specification: "", options: {} },
        { produitId: "assiette_festive_chaude", nom: "Assiette Festive Chaude", typeVente: "unite", quantite: 30, prixUnitaire: 15, specification: "", options: {} },
        { produitId: "box_navettes_prestige", nom: "Box Navettes Prestiges",  typeVente: "unite", quantite: 3,  prixUnitaire: 40, specification: "", options: {} }
      ],
      instructions: ["emballage_individuel", "urgent"], remarques: "Repas de fin d'année — 30 membres",
      statut: "en_production", imprimee: false, dateImpression: null, imprimePar: null,
      creePar: "Admin Démo", creeLe: "2026-12-07T14:30:00.000Z", modifieLe: "2026-12-13T16:00:00.000Z"
    },

    // ── MENUS ──────────────────────────────────────────────────
    {
      id: genId(), numero: "CMD-00011",
      client: "Famille Moreau", telephoneClient: "06 44 55 66 77", emailClient: "moreau.famille@gmail.com",
      magasinId: "magasin-a", dateRetrait: "2026-12-24", periodeId: "noel_2026",
      vendeur: "Manager Démo",
      lignes: [
        { produitId: "menu_viande_chapon",  nom: "Menu Viande — Ballotin de Chapon",   typeVente: "menu", quantite: 2, prixUnitaire: 23.9, specification: "", options: {} },
        { produitId: "menu_viande_pintade", nom: "Menu Viande — Ballotin de Pintade",  typeVente: "menu", quantite: 2, prixUnitaire: 23.9, specification: "", options: {} },
        { produitId: "menu_enfant",         nom: "Menu Enfant",                         typeVente: "menu", quantite: 2, prixUnitaire: 9,    specification: "", options: {} }
      ],
      instructions: [], remarques: "6 personnes — 2 adultes chapon, 2 adultes pintade, 2 enfants",
      statut: "validee", imprimee: false, dateImpression: null, imprimePar: null,
      creePar: "Manager Démo", creeLe: "2026-12-09T10:30:00.000Z", modifieLe: "2026-12-10T14:00:00.000Z"
    },
    {
      id: genId(), numero: "CMD-00012",
      client: "M. Lecomte", telephoneClient: "07 22 33 44 55", emailClient: "",
      magasinId: "magasin-c", dateRetrait: "2026-12-25", periodeId: "noel_2026",
      vendeur: "Admin Démo",
      lignes: [
        { produitId: "menu_poisson_fg_sj",   nom: "Menu Poisson — Foie Gras + St Jacques", typeVente: "menu", quantite: 4, prixUnitaire: 25.9, specification: "", options: {} },
        { produitId: "menu_enfant",           nom: "Menu Enfant",                            typeVente: "menu", quantite: 1, prixUnitaire: 9,    specification: "", options: {} }
      ],
      instructions: ["froid"], remarques: "5 personnes — repas de Noël",
      statut: "en_production", imprimee: false, dateImpression: null, imprimePar: null,
      creePar: "Admin Démo", creeLe: "2026-12-11T09:00:00.000Z", modifieLe: "2026-12-14T11:30:00.000Z"
    },
    {
      id: genId(), numero: "CMD-00013",
      client: "Famille Chevalier", telephoneClient: "06 10 20 30 40", emailClient: "chevalier@wanadoo.fr",
      magasinId: "magasin-e", dateRetrait: "2026-12-31", periodeId: "reveillon_2027",
      vendeur: "Manager Démo",
      lignes: [
        { produitId: "menu_poisson_trilogie_melimelo", nom: "Menu Poisson — Trilogie + Méli-Mélo", typeVente: "menu", quantite: 3, prixUnitaire: 25.9, specification: "", options: {} },
        { produitId: "menu_viande_chapon",             nom: "Menu Viande — Ballotin de Chapon",    typeVente: "menu", quantite: 3, prixUnitaire: 23.9, specification: "", options: {} }
      ],
      instructions: ["vip"], remarques: "Réveillon 6 personnes — 3 poisson / 3 viande",
      statut: "en_attente", imprimee: false, dateImpression: null, imprimePar: null,
      creePar: "Manager Démo", creeLe: "2026-12-17T16:00:00.000Z", modifieLe: "2026-12-17T16:00:00.000Z"
    },

    // ── PIERRADES ──────────────────────────────────────────────
    {
      id: genId(), numero: "CMD-00014",
      client: "M. et Mme Fontaine", telephoneClient: "06 66 77 88 99", emailClient: "",
      magasinId: "magasin-b", dateRetrait: "2026-12-25", periodeId: "noel_2026",
      vendeur: "Manager Démo",
      lignes: [
        { produitId: "pierrade_nature",  nom: "Pierrade Festive Nature",  typeVente: "pierrade", quantite: 4, prixUnitaire: 8.9, specification: "", plateauNumero: 1, plateauTotal: 2 },
        { produitId: "pierrade_marinee", nom: "Pierrade Festive Marinée", typeVente: "pierrade", quantite: 4, prixUnitaire: 8.9, specification: "", plateauNumero: 2, plateauTotal: 2 }
      ],
      instructions: [], remarques: "8 personnes — 1 plateau nature, 1 plateau mariné",
      statut: "en_attente", imprimee: false, dateImpression: null, imprimePar: null,
      creePar: "Manager Démo", creeLe: "2026-12-15T14:00:00.000Z", modifieLe: "2026-12-15T14:00:00.000Z"
    },
    {
      id: genId(), numero: "CMD-00015",
      client: "Association APEI", telephoneClient: "03 20 11 22 33", emailClient: "contact@apei-nord.fr",
      magasinId: "magasin-d", dateRetrait: "2026-12-22", periodeId: "noel_2026",
      vendeur: "Admin Démo",
      lignes: [
        { produitId: "pierrade_nature",  nom: "Pierrade Festive Nature",  typeVente: "pierrade", quantite: 6, prixUnitaire: 8.9, specification: "", plateauNumero: 1, plateauTotal: 3 },
        { produitId: "pierrade_marinee", nom: "Pierrade Festive Marinée", typeVente: "pierrade", quantite: 6, prixUnitaire: 8.9, specification: "", plateauNumero: 2, plateauTotal: 3 },
        { produitId: "pierrade_nature",  nom: "Pierrade Festive Nature",  typeVente: "pierrade", quantite: 6, prixUnitaire: 8.9, specification: "demi plateau extra", plateauNumero: 3, plateauTotal: 3 }
      ],
      instructions: ["emballage_individuel"], remarques: "Repas de Noël association — 18 personnes, 3 plateaux",
      statut: "prete", imprimee: true, dateImpression: "2026-12-20T07:30:00.000Z", imprimePar: "Admin Démo",
      creePar: "Admin Démo", creeLe: "2026-12-03T11:00:00.000Z", modifieLe: "2026-12-20T07:30:00.000Z"
    },
    {
      id: genId(), numero: "CMD-00016",
      client: "Famille Leroy", telephoneClient: "07 55 44 33 22", emailClient: "",
      magasinId: "magasin-a", dateRetrait: "2026-12-31", periodeId: "reveillon_2027",
      vendeur: "Manager Démo",
      lignes: [
        { produitId: "pierrade_marinee", nom: "Pierrade Festive Marinée", typeVente: "pierrade", quantite: 10, prixUnitaire: 8.9, specification: "", plateauNumero: 1, plateauTotal: 1 },
        { produitId: "foie_gras",        nom: "Assiette de Foie Gras de Canard", typeVente: "unite",   quantite: 10, prixUnitaire: 9,   specification: "", options: {} }
      ],
      instructions: [], remarques: "Réveillon 10 personnes — pierrade marinée + foie gras en entrée",
      statut: "en_attente", imprimee: false, dateImpression: null, imprimePar: null,
      creePar: "Manager Démo", creeLe: "2026-12-18T15:00:00.000Z", modifieLe: "2026-12-18T15:00:00.000Z"
    },

    // ── VIANDE AU KILO ─────────────────────────────────────────
    {
      id: genId(), numero: "CMD-00017",
      client: "M. Vasseur", telephoneClient: "06 01 02 03 04", emailClient: "vasseur.p@sfr.fr",
      magasinId: "magasin-c", dateRetrait: "2026-12-24", periodeId: "noel_2026",
      vendeur: "Admin Démo",
      lignes: [
        { produitId: "chapon_fermier",   nom: "Chapon Fermier Régional (2.8 à 3.8kg)", typeVente: "poids", quantite: 1, poidsKg: 3.2, prixUnitaire: 22.5, specification: "", options: {} },
        { produitId: "boudin_blanc_truffe", nom: "Boudin Blanc Truffé (au kg)",         typeVente: "poids", quantite: 1, poidsKg: 0.8, prixUnitaire: 24.9, specification: "", options: {} }
      ],
      instructions: ["froid"], remarques: "Chapon pour 4/5 personnes",
      statut: "en_attente", imprimee: false, dateImpression: null, imprimePar: null,
      creePar: "Admin Démo", creeLe: "2026-12-13T10:00:00.000Z", modifieLe: "2026-12-13T10:00:00.000Z"
    },
    {
      id: genId(), numero: "CMD-00018",
      client: "Restaurant Chez Léon", telephoneClient: "03 28 88 77 66", emailClient: "leon@chezleon.fr",
      magasinId: "magasin-b", dateRetrait: "2026-12-23", periodeId: "noel_2026",
      vendeur: "Manager Démo",
      lignes: [
        { produitId: "filet_boeuf",   nom: "Filet de Boeuf (au kg)",   typeVente: "poids", quantite: 1, poidsKg: 2.4, prixUnitaire: 48.9, specification: "", options: {} },
        { produitId: "roti_veau",     nom: "Rôti de Veau (au kg)",     typeVente: "poids", quantite: 1, poidsKg: 1.8, prixUnitaire: 30.1, specification: "", options: {} },
        { produitId: "tournedos_boeuf", nom: "Tournedos de Boeuf (au kg)", typeVente: "poids", quantite: 1, poidsKg: 1.2, prixUnitaire: 31.9, specification: "", options: {} }
      ],
      instructions: ["vip", "urgent"], remarques: "Commande restaurant — livraison avant 9h",
      statut: "validee", imprimee: false, dateImpression: null, imprimePar: null,
      creePar: "Manager Démo", creeLe: "2026-12-10T08:30:00.000Z", modifieLe: "2026-12-11T09:00:00.000Z"
    },
    {
      id: genId(), numero: "CMD-00019",
      client: "Famille Durand", telephoneClient: "06 98 87 76 65", emailClient: "",
      magasinId: "magasin-e", dateRetrait: "2026-12-25", periodeId: "noel_2026",
      vendeur: "Admin Démo",
      lignes: [
        { produitId: "chapon_dessosse_farci", nom: "Chapon Désossé Farci (8/10 pers)", typeVente: "poids", quantite: 1, poidsKg: 2.9, prixUnitaire: 37.9, specification: "Farce au Foie Gras", options: { Farce: "Farce au Foie Gras" } },
        { produitId: "gratin_dauphinois",     nom: "Gratin Dauphinois",                typeVente: "unite", quantite: 4, prixUnitaire: 2.8,  specification: "", options: {} },
        { produitId: "risotto_truffes",       nom: "Risotto aux Truffes (2 pers)",     typeVente: "unite", quantite: 2, prixUnitaire: 5.8,  specification: "", options: {} }
      ],
      instructions: ["vip"], remarques: "Chapon désossé farci foie gras + accompagnements",
      statut: "en_production", imprimee: false, dateImpression: null, imprimePar: null,
      creePar: "Admin Démo", creeLe: "2026-12-08T14:00:00.000Z", modifieLe: "2026-12-12T16:00:00.000Z"
    },
    {
      id: genId(), numero: "CMD-00020",
      client: "M. Blanchard", telephoneClient: "07 14 25 36 47", emailClient: "blanchard@hotmail.fr",
      magasinId: "magasin-d", dateRetrait: "2026-12-24", periodeId: "noel_2026",
      vendeur: "Manager Démo",
      lignes: [
        { produitId: "dinde_regionale",      nom: "Dinde Régionale (2.5 à 3.5kg)",     typeVente: "poids", quantite: 1, poidsKg: 3.1,  prixUnitaire: 14.5, specification: "", options: {} },
        { produitId: "roti_dinde_farci",     nom: "Rôti de Dinde Farci (au kg)",       typeVente: "poids", quantite: 1, poidsKg: 1.5,  prixUnitaire: 24.9, specification: "Farce de Noël", options: { Farce: "Farce de Noël" } },
        { produitId: "boudin_blanc_nature",  nom: "Boudin Blanc Nature (au kg)",       typeVente: "poids", quantite: 1, poidsKg: 1.0,  prixUnitaire: 19.9, specification: "", options: {} },
        { produitId: "gratin_duo",           nom: "Gratin DUO Carottes et Brocolis",   typeVente: "unite", quantite: 3, prixUnitaire: 2.8,  specification: "", options: {} }
      ],
      instructions: [], remarques: "Commande de Noël familiale",
      statut: "en_attente", imprimee: false, dateImpression: null, imprimePar: null,
      creePar: "Manager Démo", creeLe: "2026-12-16T17:00:00.000Z", modifieLe: "2026-12-16T17:00:00.000Z"
    }
  ];

  // ── AUDIT ─────────────────────────────────────────────────
  const audit = [
    { id: genId(), utilisateur: "Manager Démo", role: "manager", action: "creation_commande",  description: "Commande CMD-00009 créée pour Nathalie Girard (magasin-c)",          horodatage: "2026-12-16T11:00:00.000Z" },
    { id: genId(), utilisateur: "Manager Démo", role: "manager", action: "creation_commande",  description: "Commande CMD-00008 créée pour Julien Petit (magasin-e)",            horodatage: "2026-12-11T17:20:00.000Z" },
    { id: genId(), utilisateur: "Admin Démo",    role: "admin",   action: "impression",         description: "Impression de 1 commande(s) : CMD-00007",                         horodatage: "2026-12-18T08:00:00.000Z" },
    { id: genId(), utilisateur: "Admin Démo",    role: "admin",   action: "changement_statut",  description: "Commande CMD-00005 → statut \"livree\"",                          horodatage: "2026-12-24T09:45:00.000Z" },
    { id: genId(), utilisateur: "Manager Démo", role: "manager", action: "creation_commande",  description: "Commande CMD-00003 créée pour Société Leclerc & Fils (magasin-a)", horodatage: "2026-11-28T14:00:00.000Z" },
    { id: genId(), utilisateur: "Admin Démo",    role: "admin",   action: "creation_commande",  description: "Commande CMD-00005 créée pour Restaurant Le Provençal (magasin-b)", horodatage: "2026-12-05T10:00:00.000Z" }
  ];

  // ── ÉCRITURE ──────────────────────────────────────────────
  sessionStorage.setItem(CLES.utilisateurs, JSON.stringify(utilisateurs));
  sessionStorage.setItem(CLES.parametres,   JSON.stringify(parametres));
  sessionStorage.setItem(CLES.commandes,    JSON.stringify(commandes));
  sessionStorage.setItem(CLES.audit,        JSON.stringify(audit));
  sessionStorage.setItem(CLES.compteur,     JSON.stringify({ valeur: 20, annee: new Date().getFullYear() }));
  sessionStorage.setItem(FLAG, "1");

  console.log("EventPro DEMO — 20 commandes et 2 comptes (admin/0000 + manager/0000) chargés.");
})();

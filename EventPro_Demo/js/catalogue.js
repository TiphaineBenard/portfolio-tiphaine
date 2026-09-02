// ============================================================
// CATALOGUE PRODUITS INITIAL
// Repris du "MENU 2025 — Fête de Fin d'Année" (document officiel Vanbaelinghem).
// Modifiable ensuite via l'écran Admin > Produits.
// ============================================================

// Chaque produit "simple" est une unité de production réelle.
// type: "simple" = unité de production | "menu" = composé de plusieurs simples
//       | "pierrade" = cas particulier, vendu par nombre de personnes
//       | "poids" = cas particulier, vendu au poids (kg) plutôt qu'à l'unité
//
// imprimerDans: dans quelle fiche de production le produit doit apparaître
//       "traiteur" | "boucherie" | "pierrades"
const CATALOGUE_INITIAL = [
  // --- APÉRITIFS (traiteur) ---
  { id: "box_surprise", nom: "Box Surprise", categorie: "Apéritifs", prix: 40, type: "simple", imprimerDans: "traiteur" },
  { id: "box_wraps", nom: "Box Wraps", categorie: "Apéritifs", prix: 40, type: "simple", imprimerDans: "traiteur" },
  { id: "box_navettes_prestige", nom: "Box Navettes Prestiges", categorie: "Apéritifs", prix: 40, type: "simple", imprimerDans: "traiteur" },
  { id: "plateau_verrines", nom: "Plateau de Verrines", categorie: "Apéritifs", prix: 40, type: "simple", imprimerDans: "traiteur" },
  { id: "assiette_festive_chaude", nom: "Assiette Festive Chaude", categorie: "Apéritifs", prix: 15, type: "simple", imprimerDans: "traiteur" },
  { id: "boudin_blanc_nature", nom: "Boudin Blanc Nature (au kg)", categorie: "Apéritifs", prix: 19.9, type: "poids", imprimerDans: "boucherie" },
  { id: "boudin_blanc_truffe", nom: "Boudin Blanc Truffé (au kg)", categorie: "Apéritifs", prix: 24.9, type: "poids", imprimerDans: "boucherie" },
  { id: "mini_boudin_blanc", nom: "Mini Boudin Blanc (au kg)", categorie: "Apéritifs", prix: 24.9, type: "poids", imprimerDans: "boucherie" },

  // --- PIERRADE (cas particulier : vendu par nombre de personnes, Nature/Marinée) ---
  { id: "pierrade_nature", nom: "Pierrade Festive Nature", categorie: "Pierrade", prix: 8.9, type: "pierrade", imprimerDans: "pierrades" },
  { id: "pierrade_marinee", nom: "Pierrade Festive Marinée", categorie: "Pierrade", prix: 8.9, type: "pierrade", imprimerDans: "pierrades" },

  // --- ENTRÉES FROIDES (traiteur) ---
  { id: "foie_gras", nom: "Assiette de Foie Gras de Canard", categorie: "Entrées froides", prix: 9, type: "simple", imprimerDans: "traiteur" },
  { id: "ananas_iles", nom: "Ananas des Îles", categorie: "Entrées froides", prix: 7.5, type: "simple", imprimerDans: "traiteur" },
  { id: "saumon_fume", nom: "Saumon Fumé (100g)", categorie: "Entrées froides", prix: 5.1, type: "simple", imprimerDans: "traiteur" },
  { id: "trilogie_mer", nom: "Trilogie de la Mer", categorie: "Entrées froides", prix: 8, type: "simple", imprimerDans: "traiteur" },

  // --- ENTRÉES CHAUDES (traiteur) ---
  { id: "coquille_st_jacques", nom: "Coquille Saint-Jacques", categorie: "Entrées chaudes", prix: 9, type: "simple", imprimerDans: "traiteur" },
  { id: "gratin_crabe", nom: "Gratin de Crabe avec Carapace", categorie: "Entrées chaudes", prix: 6, type: "simple", imprimerDans: "traiteur" },
  { id: "brioche_volaille", nom: "Brioche de Volaille Forestière", categorie: "Entrées chaudes", prix: 5, type: "simple", imprimerDans: "traiteur" },
  { id: "cassolette_st_jacques", nom: "Cassolette St Jacques et Crevettes", categorie: "Entrées chaudes", prix: 6.3, type: "simple", imprimerDans: "traiteur" },
  { id: "vol_au_vent_poulet", nom: "Vol au Vent Poulet", categorie: "Entrées chaudes", prix: 4.2, type: "simple", imprimerDans: "traiteur" },
  { id: "vol_au_vent_ris_veau", nom: "Vol au Vent Ris de Veau", categorie: "Entrées chaudes", prix: 5.2, type: "simple", imprimerDans: "traiteur" },
  { id: "vol_au_vent_saumon", nom: "Vol au Vent Saumon, Poireaux et Petits Légumes", categorie: "Entrées chaudes", prix: 5.2, type: "simple", imprimerDans: "traiteur" },
  { id: "potage_asperges", nom: "Potage Crème d'Asperges (50cl)", categorie: "Entrées chaudes", prix: 4.2, type: "simple", imprimerDans: "traiteur" },
  { id: "escargots", nom: "12 Escargots", categorie: "Entrées chaudes", prix: 9, type: "simple", imprimerDans: "traiteur" },
  { id: "crepe_jambon", nom: "Crêpe Jambon", categorie: "Entrées chaudes", prix: 0, type: "simple", imprimerDans: "traiteur" },

  // --- PLATS CHAUDS INDIVIDUELS (traiteur) ---
  { id: "jambon_braise", nom: "Jambon Braisé au Champagne", categorie: "Plats chauds", prix: 11, type: "simple", imprimerDans: "traiteur" },
  { id: "ballotin_pintade", nom: "Ballotin de Pintade Farci Sauce aux Cèpes", categorie: "Plats chauds", prix: 13, type: "simple", imprimerDans: "traiteur" },
  { id: "ballotin_chapon", nom: "Ballotin de Chapon Farce Figue/Foie Gras sauce aux Truffes", categorie: "Plats chauds", prix: 13, type: "simple", imprimerDans: "traiteur" },
  { id: "filet_mignon_porc", nom: "Filet Mignon de Porc Basse Température sauce au Miel", categorie: "Plats chauds", prix: 12, type: "simple", imprimerDans: "traiteur" },
  { id: "noix_st_jacques", nom: "Noix de St Jacques et Crevettes sauce Champagne", categorie: "Plats chauds", prix: 14, type: "simple", imprimerDans: "traiteur" },
  { id: "meli_melo_mer", nom: "Méli-Mélo de la Mer (Saumon, St Jacques, Crevettes)", categorie: "Plats chauds", prix: 15, type: "simple", imprimerDans: "traiteur" },
  { id: "supreme_volaille_creme", nom: "Suprême de Volaille à la Crème et Purée à l'Ancienne", categorie: "Plats chauds", prix: 0, type: "simple", imprimerDans: "traiteur" },

  // --- ACCOMPAGNEMENTS (traiteur) ---
  { id: "pomme_chaumiere", nom: "Pomme Chaumière", categorie: "Accompagnements", prix: 2.8, type: "simple", imprimerDans: "traiteur" },
  { id: "mignons_pdt", nom: "Mignon de Pomme de Terre", categorie: "Accompagnements", prix: 2.4, type: "simple", imprimerDans: "traiteur" },
  { id: "gratin_dauphinois", nom: "Gratin Dauphinois", categorie: "Accompagnements", prix: 2.8, type: "simple", imprimerDans: "traiteur" },
  { id: "gratin_duo", nom: "Gratin DUO Carottes et Brocolis", categorie: "Accompagnements", prix: 2.8, type: "simple", imprimerDans: "traiteur" },
  { id: "risotto_truffes", nom: "Risotto aux Truffes (2 pers)", categorie: "Accompagnements", prix: 5.8, type: "simple", imprimerDans: "traiteur" },
  { id: "julienne_legumes", nom: "Julienne de Légumes (2 pers)", categorie: "Accompagnements", prix: 4.6, type: "simple", imprimerDans: "traiteur" },
  { id: "epinards_creme", nom: "Epinards à la Crème (2 pers)", categorie: "Accompagnements", prix: 4.6, type: "simple", imprimerDans: "traiteur" },
  { id: "puree_patate_douce", nom: "Purée de Patate Douce (2 pers)", categorie: "Accompagnements", prix: 4.6, type: "simple", imprimerDans: "traiteur" },
  { id: "fagots_legumes", nom: "Fagots de Légumes", categorie: "Accompagnements", prix: 2.8, type: "simple", imprimerDans: "traiteur" },

  // --- BOUCHERIE : volailles et viandes crues (vendues au poids) ---
  { id: "dinde_regionale", nom: "Dinde Régionale (2.5 à 3.5kg)", categorie: "Boucherie", prix: 14.5, type: "poids", multiVariante: true, imprimerDans: "boucherie" },
  { id: "chapon_fermier", nom: "Chapon Fermier Régional (2.8 à 3.8kg)", categorie: "Boucherie", prix: 22.5, type: "poids", multiVariante: true, imprimerDans: "boucherie" },
  { id: "poularde_regionale", nom: "Poularde Régionale (2.5 à 3.2kg)", categorie: "Boucherie", prix: 21.9, type: "poids", multiVariante: true, imprimerDans: "boucherie" },
  { id: "supreme_chapon", nom: "Suprême de Chapon (400-600g)", categorie: "Boucherie", prix: 27.5, type: "poids", multiVariante: true, imprimerDans: "boucherie" },
  { id: "supreme_pintade", nom: "Suprême de Pintade (240-260g)", categorie: "Boucherie", prix: 25.5, type: "poids", multiVariante: true, imprimerDans: "boucherie" },
  { id: "caille", nom: "Caille", categorie: "Boucherie", prix: 4.5, type: "simple", imprimerDans: "boucherie" },
  { id: "pintade", nom: "Pintade (1.2 à 1.4kg)", categorie: "Boucherie", prix: 14.8, type: "poids", multiVariante: true, imprimerDans: "boucherie" },
  { id: "roti_boeuf", nom: "Rôti de Boeuf (au kg)", categorie: "Boucherie", prix: 30.9, type: "poids", multiVariante: true, imprimerDans: "boucherie" },
  { id: "tournedos_boeuf", nom: "Tournedos de Boeuf (au kg)", categorie: "Boucherie", prix: 31.9, type: "poids", multiVariante: true, imprimerDans: "boucherie" },
  { id: "filet_boeuf", nom: "Filet de Boeuf (au kg)", categorie: "Boucherie", prix: 48.9, type: "poids", multiVariante: true, imprimerDans: "boucherie" },
  { id: "roti_veau", nom: "Rôti de Veau (au kg)", categorie: "Boucherie", prix: 30.1, type: "poids", multiVariante: true, imprimerDans: "boucherie" },
  { id: "filet_cheval", nom: "Filet de Cheval (au kg)", categorie: "Boucherie", prix: 36.8, type: "poids", multiVariante: true, imprimerDans: "boucherie" },
  { id: "aloyau_cheval", nom: "Aloyau de Cheval (au kg)", categorie: "Boucherie", prix: 24.1, type: "poids", multiVariante: true, imprimerDans: "boucherie" },

  // --- RÔTIS ET VOLAILLES FARCIS (vendus au poids, sauf caille) ---
  { id: "pintade_dessossee_farcie", nom: "Pintade Désossée Farcie (4/5 pers)", categorie: "Rôtis et Volailles Farcis", prix: 28.9, type: "poids", multiVariante: true, imprimerDans: "boucherie",
    optionsPersonnalisees: [{ nom: "Farce", valeurs: ["Sans farce", "Farce de Noël", "Farce au Foie Gras"] }],
    quantiteFarceGParKg: 120,
    instructionsCuisson: "Sortir le Rôti du réfrigérateur 1h avant\nPréchauffer le four à 170°C\nTemps de cuisson : 25-30 mn pour 500g\nArrosez régulièrement" },
  { id: "roti_dinde_farci", nom: "Rôti de Dinde Farci (au kg)", categorie: "Rôtis et Volailles Farcis", prix: 24.9, type: "poids", multiVariante: true, imprimerDans: "boucherie",
    optionsPersonnalisees: [{ nom: "Farce", valeurs: ["Sans farce", "Farce de Noël", "Farce au Foie Gras"] }],
    quantiteFarceGParKg: 120,
    instructionsCuisson: "Sortir le Rôti du réfrigérateur 1h avant\nPréchauffer le four à 170°C\nTemps de cuisson : 25-30 mn pour 500g\nArrosez régulièrement" },
  { id: "chapon_dessosse_farci", nom: "Chapon Désossé Farci (8/10 pers)", categorie: "Rôtis et Volailles Farcis", prix: 37.9, type: "poids", multiVariante: true, imprimerDans: "boucherie",
    optionsPersonnalisees: [{ nom: "Farce", valeurs: ["Sans farce", "Farce de Noël", "Farce au Foie Gras"] }],
    quantiteFarceGParKg: 120,
    instructionsCuisson: "Sortir le chapon du réfrigérateur 1h avant\nPréchauffer le four à 170°C\nTemps de cuisson : 1h15-1h30\nArrosez régulièrement" },
  { id: "demi_chapon_dessosse_farci", nom: "Demi Chapon Désossé Farci (4/5 pers)", categorie: "Rôtis et Volailles Farcis", prix: 39.9, type: "poids", multiVariante: true, imprimerDans: "boucherie",
    optionsPersonnalisees: [{ nom: "Farce", valeurs: ["Sans farce", "Farce de Noël", "Farce au Foie Gras"] }],
    quantiteFarceGParKg: 120,
    instructionsCuisson: "Sortir le chapon du réfrigérateur 1h avant\nPréchauffer le four à 170°C\nTemps de cuisson : 1h15-1h30\nArrosez régulièrement" },
  { id: "caille_dessossee_farcie", nom: "Caille Désossée Farcie", categorie: "Rôtis et Volailles Farcis", prix: 8.9, type: "simple", imprimerDans: "boucherie",
    optionsPersonnalisees: [{ nom: "Farce", valeurs: ["Sans farce", "Farce de Noël", "Farce au Foie Gras"] }],
    quantiteFarceG: 80,
    instructionsCuisson: "" },

  // --- MENUS (composés - décomposés automatiquement en simples pour la production) ---
  {
    id: "menu_viande_chapon", nom: "Menu Viande — Ballotin de Chapon", categorie: "Menus", prix: 23.9, type: "menu",
    composition: [
      { produitId: "foie_gras", quantite: 1 },
      { produitId: "brioche_volaille", quantite: 1 },
      { produitId: "ballotin_chapon", quantite: 1 }
    ]
  },
  {
    id: "menu_viande_pintade", nom: "Menu Viande — Ballotin de Pintade", categorie: "Menus", prix: 23.9, type: "menu",
    composition: [
      { produitId: "foie_gras", quantite: 1 },
      { produitId: "brioche_volaille", quantite: 1 },
      { produitId: "ballotin_pintade", quantite: 1 }
    ]
  },
  {
    id: "menu_poisson_trilogie_sj", nom: "Menu Poisson — Trilogie + St Jacques", categorie: "Menus", prix: 25.9, type: "menu",
    composition: [
      { produitId: "trilogie_mer", quantite: 1 },
      { produitId: "cassolette_st_jacques", quantite: 1 },
      { produitId: "noix_st_jacques", quantite: 1 }
    ]
  },
  {
    id: "menu_poisson_fg_sj", nom: "Menu Poisson — Foie Gras + St Jacques", categorie: "Menus", prix: 25.9, type: "menu",
    composition: [
      { produitId: "foie_gras", quantite: 1 },
      { produitId: "cassolette_st_jacques", quantite: 1 },
      { produitId: "noix_st_jacques", quantite: 1 }
    ]
  },
  {
    id: "menu_poisson_trilogie_melimelo", nom: "Menu Poisson — Trilogie + Méli-Mélo", categorie: "Menus", prix: 25.9, type: "menu",
    composition: [
      { produitId: "trilogie_mer", quantite: 1 },
      { produitId: "cassolette_st_jacques", quantite: 1 },
      { produitId: "meli_melo_mer", quantite: 1 }
    ]
  },
  {
    id: "menu_poisson_fg_melimelo", nom: "Menu Poisson — Foie Gras + Méli-Mélo", categorie: "Menus", prix: 25.9, type: "menu",
    composition: [
      { produitId: "foie_gras", quantite: 1 },
      { produitId: "cassolette_st_jacques", quantite: 1 },
      { produitId: "meli_melo_mer", quantite: 1 }
    ]
  },
  {
    id: "menu_enfant", nom: "Menu Enfant", categorie: "Menus", prix: 9, type: "menu",
    composition: [
      { produitId: "crepe_jambon", quantite: 1 },
      { produitId: "supreme_volaille_creme", quantite: 1 }
    ]
  }
];

// ============================================================
// FICHES TECHNIQUES — quantités par portion / unité commandée
// Séparées du catalogue pour ne pas polluer les définitions.
// Injectées automatiquement au chargement via data.js.
// ============================================================
const RECETTES_CATALOGUE = {
  // ── Accompagnements ──────────────────────────────────────
  pomme_chaumiere: [
    { nom: "Pommes de terre", quantite: 180, unite: "g",      fournisseur: "Rungis Primeurs",   prix: 0.0012 },
    { nom: "Crème fraîche",   quantite: 30,  unite: "ml",     fournisseur: "Laiterie du Nord",  prix: 0.003  },
    { nom: "Beurre",          quantite: 15,  unite: "g",      fournisseur: "Laiterie du Nord",  prix: 0.006  }
  ],
  mignons_pdt: [
    { nom: "Pommes de terre", quantite: 200, unite: "g",      fournisseur: "Rungis Primeurs",   prix: 0.0012 },
    { nom: "Beurre",          quantite: 20,  unite: "g",      fournisseur: "Laiterie du Nord",  prix: 0.006  }
  ],
  gratin_dauphinois: [
    { nom: "Pommes de terre", quantite: 190, unite: "g",      fournisseur: "Rungis Primeurs",   prix: 0.0012 },
    { nom: "Crème liquide",   quantite: 80,  unite: "ml",     fournisseur: "Laiterie du Nord",  prix: 0.0025 },
    { nom: "Ail",             quantite: 2,   unite: "g",      fournisseur: "Rungis Primeurs",   prix: 0.005  }
  ],
  gratin_duo: [
    { nom: "Carottes",        quantite: 90,  unite: "g",      fournisseur: "Rungis Primeurs",   prix: 0.0015 },
    { nom: "Brocolis",        quantite: 90,  unite: "g",      fournisseur: "Rungis Primeurs",   prix: 0.002  },
    { nom: "Crème liquide",   quantite: 50,  unite: "ml",     fournisseur: "Laiterie du Nord",  prix: 0.0025 },
    { nom: "Emmental râpé",   quantite: 25,  unite: "g",      fournisseur: "Laiterie du Nord",  prix: 0.008  }
  ],
  risotto_truffes: [
    { nom: "Riz Arborio",          quantite: 160, unite: "g",  fournisseur: "Épicerie Fine",     prix: 0.004  },
    { nom: "Bouillon de volaille", quantite: 400, unite: "ml", fournisseur: "Maison des Sauces", prix: 0.005  },
    { nom: "Truffe",               quantite: 5,   unite: "g",  fournisseur: "Épicerie Fine",     prix: 0.80   },
    { nom: "Parmesan râpé",        quantite: 30,  unite: "g",  fournisseur: "Laiterie du Nord",  prix: 0.012  },
    { nom: "Beurre",               quantite: 20,  unite: "g",  fournisseur: "Laiterie du Nord",  prix: 0.006  }
  ],
  julienne_legumes: [
    { nom: "Carottes",    quantite: 150, unite: "g",           fournisseur: "Rungis Primeurs",   prix: 0.0015 },
    { nom: "Courgettes",  quantite: 150, unite: "g",           fournisseur: "Rungis Primeurs",   prix: 0.002  },
    { nom: "Poireaux",    quantite: 100, unite: "g",           fournisseur: "Rungis Primeurs",   prix: 0.002  },
    { nom: "Beurre",      quantite: 20,  unite: "g",           fournisseur: "Laiterie du Nord",  prix: 0.006  }
  ],
  epinards_creme: [
    { nom: "Épinards",      quantite: 300, unite: "g",         fournisseur: "Rungis Primeurs",   prix: 0.003  },
    { nom: "Crème fraîche", quantite: 100, unite: "ml",        fournisseur: "Laiterie du Nord",  prix: 0.003  },
    { nom: "Beurre",        quantite: 15,  unite: "g",         fournisseur: "Laiterie du Nord",  prix: 0.006  }
  ],
  puree_patate_douce: [
    { nom: "Patate douce", quantite: 300, unite: "g",          fournisseur: "Rungis Primeurs",   prix: 0.002  },
    { nom: "Lait entier",  quantite: 100, unite: "ml",         fournisseur: "Laiterie du Nord",  prix: 0.001  },
    { nom: "Beurre",       quantite: 20,  unite: "g",          fournisseur: "Laiterie du Nord",  prix: 0.006  }
  ],
  fagots_legumes: [
    { nom: "Carottes",       quantite: 60, unite: "g",         fournisseur: "Rungis Primeurs",   prix: 0.0015 },
    { nom: "Haricots verts", quantite: 60, unite: "g",         fournisseur: "Rungis Primeurs",   prix: 0.003  },
    { nom: "Poireau",        quantite: 30, unite: "g",         fournisseur: "Rungis Primeurs",   prix: 0.002  }
  ],
  // ── Plats chauds ─────────────────────────────────────────
  ballotin_chapon: [
    { nom: "Chapon (farci)",    quantite: 200, unite: "g",     fournisseur: "Volailles de Bresse", prix: 0.022 },
    { nom: "Sauce aux truffes", quantite: 50,  unite: "ml",    fournisseur: "Maison des Sauces",   prix: 0.08  }
  ],
  ballotin_pintade: [
    { nom: "Pintade (farcie)", quantite: 200, unite: "g",      fournisseur: "Volailles de Bresse", prix: 0.018 },
    { nom: "Sauce aux cèpes",  quantite: 50,  unite: "ml",     fournisseur: "Maison des Sauces",   prix: 0.05  }
  ],
  filet_mignon_porc: [
    { nom: "Filet mignon",   quantite: 180, unite: "g",        fournisseur: "Maison Dupont",       prix: 0.025 },
    { nom: "Miel",           quantite: 15,  unite: "g",        fournisseur: "Épicerie Fine",       prix: 0.008 },
    { nom: "Sauce au miel",  quantite: 40,  unite: "ml",       fournisseur: "Maison des Sauces",   prix: 0.04  }
  ],
  noix_st_jacques: [
    { nom: "Saint-Jacques",   quantite: 100, unite: "g",       fournisseur: "Marée Bretagne",      prix: 0.035 },
    { nom: "Crevettes",       quantite: 60,  unite: "g",       fournisseur: "Marée Bretagne",      prix: 0.020 },
    { nom: "Sauce champagne", quantite: 60,  unite: "ml",      fournisseur: "Maison des Sauces",   prix: 0.06  },
    { nom: "Beurre",          quantite: 10,  unite: "g",       fournisseur: "Laiterie du Nord",    prix: 0.006 }
  ],
  meli_melo_mer: [
    { nom: "Saumon",        quantite: 60,  unite: "g",         fournisseur: "Marée Bretagne",      prix: 0.025 },
    { nom: "Saint-Jacques", quantite: 60,  unite: "g",         fournisseur: "Marée Bretagne",      prix: 0.035 },
    { nom: "Crevettes",     quantite: 60,  unite: "g",         fournisseur: "Marée Bretagne",      prix: 0.020 },
    { nom: "Sauce",         quantite: 50,  unite: "ml",        fournisseur: "Maison des Sauces",   prix: 0.04  }
  ],
  jambon_braise: [
    { nom: "Jambon",    quantite: 200, unite: "g",             fournisseur: "Maison Dupont",       prix: 0.018 },
    { nom: "Champagne", quantite: 50,  unite: "ml",            fournisseur: "Cave Lefebvre",       prix: 0.03  },
    { nom: "Sauce",     quantite: 40,  unite: "ml",            fournisseur: "Maison des Sauces",   prix: 0.04  }
  ],
  // ── Entrées ──────────────────────────────────────────────
  foie_gras: [
    { nom: "Foie gras de canard", quantite: 80, unite: "g",    fournisseur: "Épicerie Fine",       prix: 0.09  },
    { nom: "Toast",               quantite: 2,  unite: "pièce(s)", fournisseur: "Boulangerie Martin", prix: 0.10 }
  ],
  coquille_st_jacques: [
    { nom: "Saint-Jacques", quantite: 80, unite: "g",          fournisseur: "Marée Bretagne",      prix: 0.035 },
    { nom: "Beurre",        quantite: 10, unite: "g",          fournisseur: "Laiterie du Nord",    prix: 0.006 },
    { nom: "Échalote",      quantite: 5,  unite: "g",          fournisseur: "Rungis Primeurs",     prix: 0.004 }
  ],
  cassolette_st_jacques: [
    { nom: "Saint-Jacques", quantite: 70,  unite: "g",         fournisseur: "Marée Bretagne",      prix: 0.035 },
    { nom: "Crevettes",     quantite: 50,  unite: "g",         fournisseur: "Marée Bretagne",      prix: 0.020 },
    { nom: "Crème liquide", quantite: 40,  unite: "ml",        fournisseur: "Laiterie du Nord",    prix: 0.0025 }
  ],
  gratin_crabe: [
    { nom: "Crabe (chair)",  quantite: 80, unite: "g",         fournisseur: "Marée Bretagne",      prix: 0.030 },
    { nom: "Beurre",         quantite: 10, unite: "g",         fournisseur: "Laiterie du Nord",    prix: 0.006 },
    { nom: "Sauce béchamel", quantite: 40, unite: "ml",        fournisseur: "Maison des Sauces",   prix: 0.03  },
    { nom: "Emmental râpé",  quantite: 15, unite: "g",         fournisseur: "Laiterie du Nord",    prix: 0.008 }
  ],
  // ── Rôtis et Volailles Farcis ────────────────────────────
  caille_dessossee_farcie: [
    { nom: "Caille",             quantite: 1, unite: "pièce(s)", fournisseur: "Volailles de Bresse", prix: 3.50 },
    { nom: "Herbes aromatiques", quantite: 5, unite: "g",        fournisseur: "Rungis Primeurs",     prix: 0.015 }
  ],
  // ── Apéritifs ────────────────────────────────────────────
  box_wraps: [
    { nom: "Wraps (feuilles)",      quantite: 3,  unite: "pièce(s)", fournisseur: "Beuvain",           prix: 0.30 },
    { nom: "Poulet rôti effiloché", quantite: 60, unite: "g",        fournisseur: "Volailles de Bresse", prix: 0.014 },
    { nom: "Avocat",                quantite: 40, unite: "g",        fournisseur: "Rungis Primeurs",   prix: 0.006 },
    { nom: "Fromage frais",         quantite: 30, unite: "g",        fournisseur: "Laiterie du Nord",  prix: 0.007 },
    { nom: "Salade verte",          quantite: 20, unite: "g",        fournisseur: "Rungis Primeurs",   prix: 0.004 }
  ],
  box_navettes_prestige: [
    { nom: "Pain navette",   quantite: 4,  unite: "pièce(s)", fournisseur: "Boulangerie Martin",  prix: 0.20  },
    { nom: "Foie gras",      quantite: 30, unite: "g",        fournisseur: "Épicerie Fine",       prix: 0.09  },
    { nom: "Saumon fumé",    quantite: 20, unite: "g",        fournisseur: "Marée Bretagne",      prix: 0.045 },
    { nom: "Crème tartinée", quantite: 15, unite: "g",        fournisseur: "Laiterie du Nord",    prix: 0.007 }
  ],
  plateau_verrines: [
    { nom: "Verrine (contenant)", quantite: 6,  unite: "pièce(s)", fournisseur: "Épicerie Fine",     prix: 0.12 },
    { nom: "Mousse de saumon",    quantite: 40, unite: "g",        fournisseur: "Marée Bretagne",    prix: 0.022 },
    { nom: "Guacamole",           quantite: 30, unite: "g",        fournisseur: "Rungis Primeurs",   prix: 0.010 },
    { nom: "Crème de chèvre",     quantite: 30, unite: "g",        fournisseur: "Laiterie du Nord",  prix: 0.009 },
    { nom: "Chips décoration",    quantite: 6,  unite: "pièce(s)", fournisseur: "Épicerie Fine",     prix: 0.05 }
  ],
  assiette_festive_chaude: [
    { nom: "Boudin blanc",       quantite: 80, unite: "g",     fournisseur: "Maison Dupont",       prix: 0.012 },
    { nom: "Saucisse cocktail",  quantite: 50, unite: "g",     fournisseur: "Maison Dupont",       prix: 0.010 },
    { nom: "Feuilleté apéro",    quantite: 40, unite: "g",     fournisseur: "Boulangerie Martin",  prix: 0.018 },
    { nom: "Champignons sautés", quantite: 30, unite: "g",     fournisseur: "Rungis Primeurs",     prix: 0.006 }
  ],
  // ── Entrées froides ──────────────────────────────────────
  ananas_iles: [
    { nom: "Ananas frais",  quantite: 120, unite: "g",         fournisseur: "Rungis Primeurs",     prix: 0.003 },
    { nom: "Crème de coco", quantite: 30,  unite: "ml",        fournisseur: "Épicerie Fine",       prix: 0.006 },
    { nom: "Menthe fraîche",quantite: 2,   unite: "g",         fournisseur: "Rungis Primeurs",     prix: 0.020 }
  ],
  saumon_fume: [
    { nom: "Saumon fumé",   quantite: 100, unite: "g",         fournisseur: "Marée Bretagne",      prix: 0.045 },
    { nom: "Blinis",        quantite: 2,   unite: "pièce(s)",  fournisseur: "Boulangerie Martin",  prix: 0.20  },
    { nom: "Crème fraîche", quantite: 15,  unite: "ml",        fournisseur: "Laiterie du Nord",    prix: 0.003 },
    { nom: "Citron",        quantite: 5,   unite: "g",         fournisseur: "Rungis Primeurs",     prix: 0.010 }
  ],
  trilogie_mer: [
    { nom: "Saumon fumé",      quantite: 40, unite: "g",       fournisseur: "Marée Bretagne",      prix: 0.045 },
    { nom: "Crevettes",        quantite: 40, unite: "g",       fournisseur: "Marée Bretagne",      prix: 0.020 },
    { nom: "Noix de St Jacques", quantite: 40, unite: "g",     fournisseur: "Marée Bretagne",      prix: 0.035 },
    { nom: "Sauce cocktail",   quantite: 20, unite: "ml",      fournisseur: "Maison des Sauces",   prix: 0.025 }
  ],
  // ── Entrées chaudes ──────────────────────────────────────
  brioche_volaille: [
    { nom: "Brioche individuelle", quantite: 1,  unite: "pièce(s)", fournisseur: "Boulangerie Martin",    prix: 0.45 },
    { nom: "Mousse de volaille",   quantite: 60, unite: "g",        fournisseur: "Volailles de Bresse",   prix: 0.012 },
    { nom: "Champignons",          quantite: 30, unite: "g",        fournisseur: "Rungis Primeurs",       prix: 0.006 },
    { nom: "Sauce forestière",     quantite: 30, unite: "ml",       fournisseur: "Maison des Sauces",     prix: 0.04  }
  ],
  vol_au_vent_poulet: [
    { nom: "Croûte feuilletée", quantite: 1,  unite: "pièce(s)", fournisseur: "Boulangerie Martin",  prix: 0.35 },
    { nom: "Blancs de poulet",  quantite: 70, unite: "g",        fournisseur: "Volailles de Bresse", prix: 0.014 },
    { nom: "Champignons",       quantite: 40, unite: "g",        fournisseur: "Rungis Primeurs",     prix: 0.006 },
    { nom: "Sauce béchamel",    quantite: 50, unite: "ml",       fournisseur: "Maison des Sauces",   prix: 0.03  }
  ],
  vol_au_vent_ris_veau: [
    { nom: "Croûte feuilletée", quantite: 1,  unite: "pièce(s)", fournisseur: "Boulangerie Martin",  prix: 0.35 },
    { nom: "Ris de veau",       quantite: 70, unite: "g",        fournisseur: "Maison Dupont",       prix: 0.035 },
    { nom: "Sauce crème",       quantite: 50, unite: "ml",       fournisseur: "Maison des Sauces",   prix: 0.04  },
    { nom: "Échalotes",         quantite: 10, unite: "g",        fournisseur: "Rungis Primeurs",     prix: 0.004 }
  ],
  vol_au_vent_saumon: [
    { nom: "Croûte feuilletée", quantite: 1,  unite: "pièce(s)", fournisseur: "Boulangerie Martin",  prix: 0.35  },
    { nom: "Saumon",            quantite: 60, unite: "g",        fournisseur: "Marée Bretagne",      prix: 0.025 },
    { nom: "Poireaux",          quantite: 30, unite: "g",        fournisseur: "Rungis Primeurs",     prix: 0.002 },
    { nom: "Petits légumes",    quantite: 30, unite: "g",        fournisseur: "Rungis Primeurs",     prix: 0.003 },
    { nom: "Crème",             quantite: 40, unite: "ml",       fournisseur: "Laiterie du Nord",    prix: 0.0025 }
  ],
  potage_asperges: [
    { nom: "Asperges",            quantite: 200, unite: "g",     fournisseur: "Rungis Primeurs",     prix: 0.008 },
    { nom: "Crème liquide",       quantite: 150, unite: "ml",    fournisseur: "Laiterie du Nord",    prix: 0.0025 },
    { nom: "Bouillon de légumes", quantite: 200, unite: "ml",    fournisseur: "Maison des Sauces",   prix: 0.004 },
    { nom: "Beurre",              quantite: 10,  unite: "g",     fournisseur: "Laiterie du Nord",    prix: 0.006 }
  ],
  escargots: [
    { nom: "Escargots (boîte)", quantite: 12, unite: "pièce(s)", fournisseur: "Épicerie Fine",       prix: 0.15 },
    { nom: "Beurre persillé",   quantite: 40, unite: "g",        fournisseur: "Laiterie du Nord",    prix: 0.007 },
    { nom: "Ail",               quantite: 3,  unite: "g",        fournisseur: "Rungis Primeurs",     prix: 0.005 },
    { nom: "Persil",            quantite: 2,  unite: "g",        fournisseur: "Rungis Primeurs",     prix: 0.015 }
  ],
  crepe_jambon: [
    { nom: "Crêpe",         quantite: 1,  unite: "pièce(s)",     fournisseur: "Boulangerie Martin",  prix: 0.25 },
    { nom: "Jambon blanc",  quantite: 60, unite: "g",            fournisseur: "Maison Dupont",       prix: 0.015 },
    { nom: "Emmental",      quantite: 20, unite: "g",            fournisseur: "Laiterie du Nord",    prix: 0.008 },
    { nom: "Crème fraîche", quantite: 20, unite: "ml",           fournisseur: "Laiterie du Nord",    prix: 0.003 }
  ],
  // ── Plats chauds (suite) ─────────────────────────────────
  supreme_volaille_creme: [
    { nom: "Suprême de volaille",      quantite: 180, unite: "g",  fournisseur: "Volailles de Bresse", prix: 0.016 },
    { nom: "Crème liquide",            quantite: 60,  unite: "ml", fournisseur: "Laiterie du Nord",    prix: 0.0025 },
    { nom: "Purée (pommes de terre)",  quantite: 150, unite: "g",  fournisseur: "Rungis Primeurs",     prix: 0.0012 },
    { nom: "Lait entier",              quantite: 50,  unite: "ml", fournisseur: "Laiterie du Nord",    prix: 0.001 },
    { nom: "Beurre",                   quantite: 15,  unite: "g",  fournisseur: "Laiterie du Nord",    prix: 0.006 }
  ],
  // ── Pierrades (par personne) ─────────────────────────────
  pierrade_nature: [
    { nom: "Viande assortie (nature)", quantite: 200, unite: "g",  fournisseur: "Maison Dupont",       prix: 0.022 },
    { nom: "Légumes grillés",          quantite: 80,  unite: "g",  fournisseur: "Rungis Primeurs",     prix: 0.003 },
    { nom: "Sauces",                   quantite: 30,  unite: "ml", fournisseur: "Maison des Sauces",   prix: 0.025 }
  ],
  pierrade_marinee: [
    { nom: "Viande marinée",  quantite: 200, unite: "g",           fournisseur: "Maison Dupont",       prix: 0.024 },
    { nom: "Légumes grillés", quantite: 80,  unite: "g",           fournisseur: "Rungis Primeurs",     prix: 0.003 },
    { nom: "Marinade",        quantite: 20,  unite: "ml",          fournisseur: "Maison des Sauces",   prix: 0.015 },
    { nom: "Sauces",          quantite: 30,  unite: "ml",          fournisseur: "Maison des Sauces",   prix: 0.025 }
  ]
};

// Ordre d'affichage des catégories dans les écrans de saisie
const ORDRE_CATEGORIES = [
  "Menus", "Apéritifs", "Pierrade", "Entrées froides", "Entrées chaudes",
  "Plats chauds", "Accompagnements", "Boucherie", "Rôtis et Volailles Farcis", "Divers", "Autre"
];

// Les 3 fiches de production imprimables séparément
const CATEGORIES_IMPRESSION_PRODUCTION = [
  { id: "traiteur", label: "Traiteur" },
  { id: "boucherie", label: "Boucherie" },
  { id: "pierrades", label: "Pierrades" }
];

/**
 * Retourne les options personnalisées d'un produit (nouveau format) ou
 * convertit l'ancien champ optionsFarce en groupe "Farce" pour rétro-compat.
 * @param {Object} produit
 * @returns {Array<{nom:string, valeurs:string[]}>}
 */
function obtenirOptionsPersonnalisees(produit) {
  if (!produit) return [];
  if (produit.optionsPersonnalisees && produit.optionsPersonnalisees.length > 0) {
    return produit.optionsPersonnalisees;
  }
  if (produit.optionsFarce && produit.optionsFarce.length > 0) {
    return [{ nom: "Farce", valeurs: produit.optionsFarce }];
  }
  return [];
}

/**
 * Décompose une liste de lignes de commande (produits/menus avec quantités)
 * en quantités totales de produits SIMPLES uniquement, avec le détail des sources.
 * Les lignes portant une spécification (ex: "sans porc") restent séparées :
 * elles ne sont jamais fusionnées avec le total générique du même produit.
 * @param {Array<{produitId, quantite, specification}>} lignes
 * @param {Array} catalogue - catalogue complet (avec composition des menus)
 * @returns {Object} map clé -> { produitId, specification, total, sources }
 */
/**
 * Répartit un nombre total de personnes en plateaux équilibrés, jamais
 * plus de `maxParPlateau` chacun. Ex: repartirEnPlateaux(7, 6) -> [4, 3].
 */
function repartirEnPlateaux(total, maxParPlateau) {
  if (total <= 0) return [];
  const nbPlateaux = Math.ceil(total / maxParPlateau);
  const base = Math.floor(total / nbPlateaux);
  let reste = total % nbPlateaux;
  const plateaux = [];
  for (let i = 0; i < nbPlateaux; i++) {
    plateaux.push(base + (reste > 0 ? 1 : 0));
    if (reste > 0) reste--;
  }
  return plateaux;
}

function decomposerProduction(lignes, catalogue) {
  const parId = Object.fromEntries(catalogue.map(p => [p.id, p]));
  const resultat = {};

  function cleProduit(produitId, specification, farce) {
    return [produitId, specification || "", farce || ""].join("::");
  }

  function ajouter(produitId, quantite, poidsKg, sourceLabel, sourceType, specification, farce) {
    const cle = cleProduit(produitId, specification, farce);
    if (!resultat[cle]) {
      resultat[cle] = { produitId, specification: specification || null, farce: farce || null, total: 0, poidsTotal: 0, sources: [] };
    }
    resultat[cle].total += (quantite || 0);
    resultat[cle].poidsTotal += (poidsKg || 0);
    resultat[cle].sources.push({ type: sourceType, label: sourceLabel, quantite: quantite || 0, poidsKg: poidsKg || 0 });
  }

  for (const ligne of lignes) {
    // Ligne libre (catégorie "Autre") : pas de produitId catalogue
    if (!ligne.produitId) {
      const nomLibre = ligne.nom || "Article libre";
      const cle = `libre::${nomLibre}::${ligne.specification || ""}`;
      if (!resultat[cle]) {
        resultat[cle] = {
          produitId: null,
          nomLibre,
          categorie: "Autre",
          specification: ligne.specification || null,
          farce: null,
          total: 0,
          poidsTotal: 0,
          sources: []
        };
      }
      resultat[cle].total += (ligne.quantite || 1);
      resultat[cle].sources.push({ type: "libre", label: nomLibre, quantite: ligne.quantite || 1, poidsKg: 0 });
      continue;
    }

    const produit = parId[ligne.produitId];
    if (!produit) continue;

    if (produit.type === "menu") {
      // Une spécification sur un menu s'applique au menu entier ; on ne la
      // répercute pas automatiquement sur ses composants (trop ambigu).
      for (const composant of (produit.composition || [])) {
        const qte = composant.quantite * (ligne.quantite || 1);
        ajouter(composant.produitId, qte, 0, produit.nom, "menu", null, null);
      }
    } else if (produit.type === "poids") {
      ajouter(produit.id, 0, ligne.poidsKg || 0, produit.nom, "poids", ligne.specification, ligne.farce || null);
    } else {
      ajouter(produit.id, ligne.quantite || 1, 0, produit.nom, "unite", ligne.specification, ligne.farce || null);
    }
  }
  return resultat;
}

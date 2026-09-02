// ============================================================
// ÉCRAN : PRODUCTION CUISINE
// Vue regroupée par produit, décomposition automatique des menus.
// 3 fiches imprimables séparément : Traiteur / Boucherie / Pierrades.
// ============================================================

let filtreProduction = { dateRetrait: new Date().toISOString().slice(0,10), periodeId: "", magasinId: "" };
let onglerProductionActif = "traiteur";
let donneesProductionCache = null;

function rendreProductionCuisine(conteneur) {
  const periodes = ETAT.parametres.periodes || [];

  conteneur.innerHTML = `
    <div class="carte no-print" id="pc-barre-sticky" style="position:sticky; top:0; z-index:50; margin-bottom:18px;">
      <div class="filtre-barre" style="margin-bottom:10px;">
        <div class="champ" style="margin:0; min-width:160px;">
          <label>Date de retrait</label>
          <input type="date" id="pc-date" value="${filtreProduction.dateRetrait}">
        </div>
        <div class="champ" style="margin:0; min-width:200px;">
          <label>Ou période complète</label>
          <select id="pc-periode">
            <option value="">— Utiliser la date —</option>
            ${periodes.map(p => `<option value="${p.id}">${p.nom}</option>`).join("")}
          </select>
        </div>
        <div class="champ" style="margin:0; min-width:180px;">
          <label>Magasin</label>
          <select id="pc-magasin">
            <option value="">Tous les magasins (total cuisine)</option>
            ${ETAT.parametres.magasins.map(m => `<option value="${m.id}">${m.nom}</option>`).join("")}
          </select>
        </div>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <div style="display:flex; flex-direction:column; gap:8px;">
          <!-- Barre principale : 2 modes -->
          <div style="display:flex; gap:2px; background:var(--creme-fonce); border-radius:var(--radius); padding:3px; width:fit-content;">
            <button id="pc-mode-production" style="
              padding:6px 18px; border-radius:calc(var(--radius) - 2px); border:none; cursor:pointer; font-size:0.88rem; font-weight:600;
              background:${onglerProductionActif!=='ingredients'?'var(--bordeaux)':'transparent'};
              color:${onglerProductionActif!=='ingredients'?'var(--creme)':'var(--charbon-clair)'};
              transition:all .15s;">🍳 Production cuisine</button>
            <button id="pc-mode-ingredients" data-onglet-production="ingredients" style="
              padding:6px 18px; border-radius:calc(var(--radius) - 2px); border:none; cursor:pointer; font-size:0.88rem; font-weight:600;
              background:${onglerProductionActif==='ingredients'?'var(--bordeaux)':'transparent'};
              color:${onglerProductionActif==='ingredients'?'var(--creme)':'var(--charbon-clair)'};
              transition:all .15s;">🛒 Commande ingrédients</button>
          </div>
          <!-- Sous-onglets fiches (masqués en mode ingrédients) -->
          ${onglerProductionActif !== 'ingredients' ? `
          <div class="tabs-principal" style="background:var(--creme-fonce); border-radius:var(--radius); padding:4px; margin:0;">
            ${(ETAT.parametres.fichesImpression || CATEGORIES_IMPRESSION_PRODUCTION).map(c => `
              <div class="tab-item" data-onglet-production="${c.id}" style="color:${onglerProductionActif===c.id?'var(--bordeaux)':'var(--charbon-clair)'}; border-bottom-color:${onglerProductionActif===c.id?'var(--cuivre-clair)':'transparent'};">${c.label}</div>
            `).join("")}
          </div>` : ""}
        </div>
        <button class="btn btn-cuivre" id="pc-imprimer">🖨️ Imprimer</button>
      </div>
    </div>
    <div id="pc-resultats"><div class="vide-etat">Chargement...</div></div>
  `;

  document.getElementById("pc-date").addEventListener("change", e => { filtreProduction.dateRetrait = e.target.value; filtreProduction.periodeId = ""; document.getElementById("pc-periode").value=""; rechargerProduction(); });
  document.getElementById("pc-periode").addEventListener("change", e => { filtreProduction.periodeId = e.target.value; rechargerProduction(); });
  document.getElementById("pc-magasin").addEventListener("change", e => { filtreProduction.magasinId = e.target.value; rechargerProduction(); });
  document.getElementById("pc-mode-production").addEventListener("click", () => {
    if (onglerProductionActif === "ingredients") { onglerProductionActif = "traiteur"; rendreProductionCuisine(conteneur); }
  });
  document.querySelectorAll("[data-onglet-production]").forEach(el => {
    el.addEventListener("click", () => { onglerProductionActif = el.dataset.ongletProduction; rendreProductionCuisine(conteneur); });
  });
  document.getElementById("pc-imprimer").addEventListener("click", () => {
    if (onglerProductionActif === "ingredients") {
      // Déléguer au handler stocké par afficherIngredientsProduction (contexte filtré)
      const conteneurIng = document.getElementById("pc-resultats");
      if (conteneurIng?._imprimerBonCommande) conteneurIng._imprimerBonCommande();
      else imprimerProduction();
    } else {
      imprimerProduction();
    }
  });

  rechargerProduction();
}

async function rechargerProduction() {
  const conteneur = document.getElementById("pc-resultats");
  conteneur.innerHTML = `<div class="vide-etat">Chargement...</div>`;

  try {
    let commandes;
    if (filtreProduction.periodeId) {
      const baseParams = filtreProduction.magasinId ? { magasinId: filtreProduction.magasinId } : {};
      const periodeSelectionnee = (ETAT.parametres.periodes || []).find(p => p.id === filtreProduction.periodeId);
      const joursSet = new Set(periodeSelectionnee ? (periodeSelectionnee.jours || []) : []);
      commandes = (await recupererCommandesUnique(baseParams))
        .filter(c => c.periodeId === filtreProduction.periodeId || (joursSet.size > 0 && joursSet.has(c.dateRetrait)));
    } else {
      const params = { dateRetrait: filtreProduction.dateRetrait };
      if (filtreProduction.magasinId) params.magasinId = filtreProduction.magasinId;
      commandes = await recupererCommandesUnique(params);
    }
    commandes = commandes.filter(c => c.statut !== "annulee");
    donneesProductionCache = commandes;
    afficherProduction(commandes, conteneur);
  } catch (e) {
    console.error(e);
    conteneur.innerHTML = `<div class="vide-etat">Erreur de chargement : ${e.message}</div>`;
  }
}

function afficherProduction(commandes, conteneur) {
  if (commandes.length === 0) {
    conteneur.innerHTML = `<div class="vide-etat"><div class="icone-vide">🍳</div>Aucune commande pour cette sélection.</div>`;
    return;
  }

  if (onglerProductionActif === "ingredients") {
    afficherIngredientsProduction(commandes, conteneur);
    return;
  }

  const parId = Object.fromEntries(ETAT.catalogue.map(p => [p.id, p]));

  if (onglerProductionActif === "pierrades") {
    conteneur.innerHTML = `
      <div class="grille-kpi">
        <div class="kpi"><div class="label-kpi">Commandes</div><div class="valeur-kpi">${commandes.length}</div></div>
      </div>
      <div id="pc-contenu-imprimable">${tableauPierradesHTML(commandes)}</div>
    `;
    return;
  }

  // Magasins à afficher : seulement ceux qui ont des commandes dans la sélection
  const tousLesMagasins = ETAT.parametres.magasins || [];
  const magasinsActifs = filtreProduction.magasinId
    ? tousLesMagasins.filter(m => m.id === filtreProduction.magasinId)
    : tousLesMagasins.filter(m => commandes.some(c => c.magasinId === m.id));

  // Agrégation par (produitId + farce) × magasin
  // key → { produit, farce, isPoids, parMagasin: { magasinId: nombre } }
  const agregation = {};

  commandes.forEach(c => {
    const magId = c.magasinId;
    (c.lignes || []).forEach(l => {
      if (l.typeVente === "pierrade") return;
      if (!l.produitId) return;
      const produit = parId[l.produitId];
      if (!produit) return;

      // Menus : décomposer en composants et tracker l'origine "menu"
      if (produit.type === "menu") {
        for (const composant of (produit.composition || [])) {
          const pComp = parId[composant.produitId];
          if (!pComp || pComp.imprimerDans !== onglerProductionActif) continue;
          const qte = composant.quantite * (l.quantite || 1);
          const key = composant.produitId;
          if (!agregation[key]) {
            agregation[key] = { produit: pComp, farce: null, isPoids: false, parMagasin: {}, parMagasinMenu: {} };
          }
          agregation[key].parMagasin[magId] = (agregation[key].parMagasin[magId] || 0) + qte;
          agregation[key].parMagasinMenu[magId] = (agregation[key].parMagasinMenu[magId] || 0) + qte;
        }
        return;
      }

      if (produit.imprimerDans !== onglerProductionActif) return;

      const _optionsKey = l.options ? Object.values(l.options).filter(Boolean).join("::") : (l.farce || "");
      const key = l.produitId + (_optionsKey ? "::" + _optionsKey : "");
      const _optionsLabel = l.options ? Object.values(l.options).filter(Boolean).join(" · ") : (l.farce || "");
      if (!agregation[key]) {
        agregation[key] = { produit, optionsLabel: _optionsLabel || null, farce: l.farce || null, isPoids: produit.type === "poids", parMagasin: {}, parMagasinMenu: {} };
      }
      if (produit.type === "poids") {
        if (!agregation[key].parPieces) agregation[key].parPieces = {};
        agregation[key].parMagasin[magId] = (agregation[key].parMagasin[magId] || 0) + (l.poidsKg || 0);
        agregation[key].parPieces[magId] = (agregation[key].parPieces[magId] || 0) + 1;
      } else {
        agregation[key].parMagasin[magId] = (agregation[key].parMagasin[magId] || 0) + (l.quantite || 1);
      }
    });
  });

  // Grouper par catégorie dans l'ordre défini
  const parCategorie = {};
  Object.values(agregation).forEach(item => {
    const cat = item.produit.categorie || "Autre";
    if (!parCategorie[cat]) parCategorie[cat] = [];
    parCategorie[cat].push(item);
  });
  const categoriesOrdonnees = ORDRE_CATEGORIES.filter(c => parCategorie[c]);

  if (categoriesOrdonnees.length === 0) {
    const labelOnglet = (ETAT.parametres.fichesImpression || CATEGORIES_IMPRESSION_PRODUCTION).find(c => c.id === onglerProductionActif).label;
    conteneur.innerHTML = `<div class="vide-etat"><div class="icone-vide">🍳</div>Aucun produit "${labelOnglet}" pour cette sélection.</div>`;
    return;
  }

  const nbMag = magasinsActifs.length;
  const nbCols = nbMag + 2; // nom + magasins + total

  conteneur.innerHTML = `
    <div class="grille-kpi">
      <div class="kpi"><div class="label-kpi">Commandes</div><div class="valeur-kpi">${commandes.length}</div></div>
    </div>
    <div class="table-wrap" id="pc-contenu-imprimable">
      <table class="table-production-croisee">
        <thead>
          <tr>
            <th style="min-width:200px;">Produit</th>
            ${magasinsActifs.map(m => `<th style="text-align:center; white-space:nowrap; min-width:54px;">${codeMagasin(m.id)}</th>`).join("")}
            <th style="text-align:center; min-width:60px; border-left:2px solid var(--bordeaux-pale,#e8c8cc);">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          ${(() => {
            let rowIdx = 0;
            return categoriesOrdonnees.map(cat => {
              const lignes = parCategorie[cat];
              const lignesHTML = lignes.map(item => {
                const cls = rowIdx++ % 2 === 0 ? "pc-pair" : "pc-impair";
                const total = magasinsActifs.reduce((s, m) => s + (item.parMagasin[m.id] || 0), 0);
                const fmtVal = (v, magId) => {
                  if (!v) return `<span class="pc-vide">—</span>`;
                  if (item.isPoids) {
                    const n = item.parPieces && item.parPieces[magId] ? item.parPieces[magId] : null;
                    return `<strong>${v.toLocaleString("fr-FR", {minimumFractionDigits:1, maximumFractionDigits:2})} kg</strong>${n ? `<br><span class="pc-pieces">${n} pièce${n>1?"s":""}</span>` : ""}`;
                  }
                  const nMenu = item.parMagasinMenu ? (item.parMagasinMenu[magId] || 0) : 0;
                  return `<strong>${v}</strong>${nMenu > 0 ? `<br><span class="pc-menu-info">dont ${nMenu} menu${nMenu > 1 ? "s" : ""}</span>` : ""}`;
                };
                const totalPieces = item.isPoids && item.parPieces ? magasinsActifs.reduce((s, m) => s + (item.parPieces[m.id] || 0), 0) : null;
                const totalMenuGlobal = item.parMagasinMenu
                  ? magasinsActifs.reduce((s, m) => s + (item.parMagasinMenu[m.id] || 0), 0)
                  : 0;
                const fmtTotal = v => {
                  if (item.isPoids) return v.toLocaleString("fr-FR", {minimumFractionDigits:1, maximumFractionDigits:2}) + " kg" + (totalPieces ? `<br><span class="pc-pieces">${totalPieces} pièce${totalPieces>1?"s":""}</span>` : "");
                  return String(v) + (totalMenuGlobal > 0 ? `<br><span class="pc-menu-info">dont ${totalMenuGlobal} menu${totalMenuGlobal > 1 ? "s" : ""}</span>` : "");
                };
                return `
                  <tr class="${cls}">
                    <td class="pc-nom">
                      ${item.produit.nom}
                      ${item.optionsLabel ? `<span class="pc-farce"> — ${item.optionsLabel}</span>` : ""}
                    </td>
                    ${magasinsActifs.map(m => `<td class="pc-cell">${fmtVal(item.parMagasin[m.id] || 0, m.id)}</td>`).join("")}
                    <td class="pc-cell pc-total-cell">${fmtTotal(total)}</td>
                  </tr>
                `;
              }).join("");
              return `
                <tr class="pc-cat-ligne">
                  <td colspan="${nbCols}">${cat}</td>
                </tr>
                ${lignesHTML}
              `;
            }).join("");
          })()}
        </tbody>
        <tfoot>
          <tr class="pc-total-ligne">
            <td><strong>TOTAL COMMANDES</strong></td>
            ${magasinsActifs.map(m => {
              const n = commandes.filter(c => c.magasinId === m.id).length;
              return `<td style="text-align:center;"><strong>${n || "—"}</strong></td>`;
            }).join("")}
            <td style="text-align:center; border-left:2px solid var(--bordeaux-pale,#e8c8cc);"><strong>${commandes.length}</strong></td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;
}

/**
 * Récap pierrades : N° commande / Nature / Marinée / Spécifications, totaux en bas.
 */
function tableauPierradesHTML(commandes) {
  const lignesPierrade = [];
  commandes.forEach(c => {
    (c.lignes || []).forEach(l => {
      if (l.typeVente !== "pierrade") return;
      lignesPierrade.push({ commande: c, ligne: l });
    });
  });

  if (lignesPierrade.length === 0) {
    return `<div class="vide-etat"><div class="icone-vide">🥘</div>Aucune pierrade pour cette sélection.</div>`;
  }

  const parPlateau = {};
  lignesPierrade.forEach(({ commande, ligne }) => {
    const cle = commande.id + "::" + (ligne.plateauNumero || 1);
    if (!parPlateau[cle]) {
      parPlateau[cle] = {
        numero: commande.numero,
        magasinId: commande.magasinId,
        plateauNumero: ligne.plateauNumero,
        plateauTotal: ligne.plateauTotal,
        nature: 0, marinee: 0,
        specification: ligne.specification || ""
      };
    }
    if (ligne.produitId === "pierrade_nature") parPlateau[cle].nature += ligne.quantite;
    if (ligne.produitId === "pierrade_marinee") parPlateau[cle].marinee += ligne.quantite;
    if (ligne.specification) parPlateau[cle].specification = ligne.specification;
  });

  const lignes = Object.values(parPlateau);
  const totalNature = lignes.reduce((s, l) => s + l.nature, 0);
  const totalMarinee = lignes.reduce((s, l) => s + l.marinee, 0);

  return `
    <div class="table-wrap">
      <table class="table-pierrades">
        <thead>
          <tr><th>N° Commande</th><th>Magasin</th><th>Nature</th><th>Marinée</th><th>Spécifications</th></tr>
        </thead>
        <tbody>
          ${lignes.map((l, i) => `
            <tr class="${i % 2 === 0 ? "pc-pair" : "pc-impair"}">
              <td><strong>${l.numero}</strong>${l.plateauNumero ? ` <span style="color:var(--cuivre); font-weight:700;">(${l.plateauNumero}/${l.plateauTotal})</span>` : ""}</td>
              <td>${nomMagasin(l.magasinId)}</td>
              <td style="text-align:center; font-weight:700;">${l.nature || ""}</td>
              <td style="text-align:center; font-weight:700;">${l.marinee || ""}</td>
              <td style="font-size:0.85rem;">${l.specification || ""}</td>
            </tr>
          `).join("")}
        </tbody>
        <tfoot>
          <tr class="pc-total-ligne" style="font-weight:700;">
            <td colspan="2">Total — ${totalNature + totalMarinee} personnes</td>
            <td style="text-align:center;">${totalNature}</td>
            <td style="text-align:center;">${totalMarinee}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
    <p style="font-size:0.82rem; color:var(--charbon-clair); margin-top:10px;">
      1 pierrade = maximum 6 personnes. Au-delà, les plateaux sont numérotés automatiquement (ex: 1/2 et 2/2).
    </p>
  `;
}

// ── ONGLET INGRÉDIENTS ─────────────────────────────────────────────────────

/**
 * Calcule les totaux d'ingrédients nécessaires pour un ensemble de commandes,
 * en s'appuyant sur les recettes (produit.recette) du catalogue.
 */
function calculerIngredientsProduction(commandes) {
  const parId = Object.fromEntries(ETAT.catalogue.map(p => [p.id, p]));
  // key: "nom::unite" → { nom, unite, total, sources: Set<string> }
  const totaux = {};

  function ajouterIngredients(produit, multiplicateur) {
    if (!produit || !produit.recette || multiplicateur <= 0) return;
    produit.recette.forEach(ing => {
      const key = ing.nom + "::" + ing.unite;
      if (!totaux[key]) totaux[key] = { nom: ing.nom, unite: ing.unite, total: 0, sources: new Set(), fournisseur: ing.fournisseur || "", prix: ing.prix || 0 };
      totaux[key].total += ing.quantite * multiplicateur;
      totaux[key].sources.add(produit.nom);
      if (!totaux[key].fournisseur && ing.fournisseur) totaux[key].fournisseur = ing.fournisseur;
      if (!totaux[key].prix && ing.prix) totaux[key].prix = ing.prix;
    });
  }

  commandes.forEach(c => {
    (c.lignes || []).forEach(l => {
      if (!l.produitId) return;
      const produit = parId[l.produitId];
      if (!produit) return;

      if (produit.type === "menu") {
        (produit.composition || []).forEach(comp => {
          const pComp = parId[comp.produitId];
          ajouterIngredients(pComp, comp.quantite * (l.quantite || 1));
        });
      } else if (produit.type === "poids") {
        if (produit.recette && produit.recette.length > 0) {
          // Recette définie : calculer les sous-ingrédients par kg
          ajouterIngredients(produit, l.poidsKg || 0);
        } else {
          // Pas de recette : le produit lui-même est l'ingrédient brut
          const poids = l.poidsKg || 0;
          if (poids > 0) {
            const key = produit.nom + "::kg";
            if (!totaux[key]) totaux[key] = { nom: produit.nom, unite: "kg", total: 0, sources: new Set() };
            totaux[key].total += poids;
            totaux[key].sources.add(produit.categorie || "Boucherie");
          }
        }
        // Farce dynamique pour produits poids (Pintade, Chapon, Dinde…)
        if (l.farce && l.farce !== "Sans farce") {
          const poids = l.poidsKg || 0;
          if (poids > 0) {
            const qteParKg = produit.quantiteFarceGParKg || 120; // g de farce par kg de produit
            const key = l.farce + "::g";
            if (!totaux[key]) totaux[key] = { nom: l.farce, unite: "g", total: 0, sources: new Set() };
            totaux[key].total += qteParKg * poids;
            totaux[key].sources.add(produit.nom);
          }
        }
      } else if (produit.produitBrut === true) {
        // Produit brut simple (ex: caille entière) — apparaît directement en pièce(s)
        const qte = l.quantite || 1;
        const key = produit.nom + "::pièce(s)";
        if (!totaux[key]) totaux[key] = { nom: produit.nom, unite: "pièce(s)", total: 0, sources: new Set() };
        totaux[key].total += qte;
        totaux[key].sources.add(produit.categorie || "");
      } else {
        // simple, pierrade : recette par unité/personne
        ajouterIngredients(produit, l.quantite || 1);
        // Farce dynamique : injectée selon le choix client, indépendamment de la recette de base
        if (l.farce && l.farce !== "Sans farce") {
          const qteParPiece = produit.quantiteFarceG || 80; // grammes de farce par unité
          const key = l.farce + "::g";
          if (!totaux[key]) totaux[key] = { nom: l.farce, unite: "g", total: 0, sources: new Set() };
          totaux[key].total += qteParPiece * (l.quantite || 1);
          totaux[key].sources.add(produit.nom);
        }
      }
    });
  });

  return Object.values(totaux).sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
}

/**
 * Formate une quantité en convertissant g→kg si > 1000, ml→L si > 1000.
 */
function formaterQuantiteIngredient(total, unite) {
  if (unite === "g" && total >= 1000) {
    return { valeur: (total / 1000).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }), unite: "kg" };
  }
  if (unite === "ml" && total >= 1000) {
    return { valeur: (total / 1000).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }), unite: "L" };
  }
  return { valeur: total.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 1 }), unite };
}

function afficherIngredientsProduction(toutesCommandes, conteneur) {
  // ── Filtres ───────────────────────────────────────────────
  const filtreKeyF = "eventpro_demo_ing_filtre_fourn";
  const filtreKeyE = "eventpro_demo_ing_filtre_evt";
  const filtreF = sessionStorage.getItem(filtreKeyF) || "__tous__";
  const filtreE = sessionStorage.getItem(filtreKeyE) || "__tous__";

  // Étape 1 — Filtrer par fournisseur : garder seulement les commandes
  // qui ont au moins un ingrédient du fournisseur sélectionné
  const commandesAvecFourn = filtreF === "__tous__"
    ? toutesCommandes
    : toutesCommandes.filter(c => {
        const ings = calculerIngredientsProduction([c]);
        return ings.some(ing => (ing.fournisseur || "— Sans fournisseur") === filtreF);
      });

  // Étape 2 — Filtrer par événement dans ce sous-ensemble
  const commandesFiltrees = filtreE === "__tous__"
    ? commandesAvecFourn
    : commandesAvecFourn.filter(c => c.id === filtreE);

  // Étape 3 — Calculer les ingrédients sur la sélection finale
  const ingredients = calculerIngredientsProduction(commandesFiltrees);

  // Produits sans fiche
  const parId = Object.fromEntries(ETAT.catalogue.map(p => [p.id, p]));
  const produitsSansRecette = new Set();
  commandesFiltrees.forEach(c => {
    (c.lignes || []).forEach(l => {
      const p = parId[l.produitId];
      if (p && p.type !== "menu" && p.type !== "poids" && p.produitBrut !== true && (!p.recette || p.recette.length === 0))
        produitsSansRecette.add(p.nom);
    });
  });

  // ── Groupement par fournisseur ────────────────────────────
  const groupesActifs = {};
  ingredients.forEach(ing => {
    const fourn = ing.fournisseur || "— Sans fournisseur";
    if (!groupesActifs[fourn]) groupesActifs[fourn] = [];
    groupesActifs[fourn].push(ing);
  });
  const fournisseurs = Object.keys(groupesActifs).sort((a, b) => {
    if (a === "— Sans fournisseur") return 1;
    if (b === "— Sans fournisseur") return -1;
    return a.localeCompare(b, "fr");
  });

  // Tous les fournisseurs possibles (sur toutes les commandes, pour le dropdown)
  const tousIngredients = calculerIngredientsProduction(toutesCommandes);
  const tousFournisseurs = [...new Set(tousIngredients.map(ing => ing.fournisseur || "— Sans fournisseur"))].sort((a, b) => {
    if (a === "— Sans fournisseur") return 1;
    if (b === "— Sans fournisseur") return -1;
    return a.localeCompare(b, "fr");
  });

  const fournisseursFiltres = filtreF === "__tous__" ? fournisseurs : fournisseurs.filter(f => f === filtreF);

  // ── Coût total (sur sélection filtrée) ───────────────────
  const ingredientsFiltres = fournisseursFiltres.flatMap(f => groupesActifs[f] || []);
  let coutTotal = 0;
  let aPrix = false;
  ingredients.forEach(ing => { if (ing.prix > 0) { aPrix = true; } });
  ingredientsFiltres.forEach(ing => {
    if (ing.prix > 0) {
      const fmt = formaterQuantiteIngredient(ing.total, ing.unite);
      coutTotal += ing.prix * (parseFloat(fmt.valeur.replace(",", ".")) || 0);
    }
  });

  function lignesGroupeHTML(liste) {
    return liste.map((ing, i) => {
      const fmt = formaterQuantiteIngredient(ing.total, ing.unite);
      const sources = [...ing.sources].join(", ");
      const bg = i % 2 === 0 ? "background:#fff;" : "background:#faf8f6;";
      const coutIng = ing.prix > 0 ? (ing.prix * parseFloat(fmt.valeur.replace(",", ".")) || 0).toFixed(2) + " €" : "";
      return `
        <tr style="${bg}">
          <td style="padding:3px 10px; font-size:0.86rem; font-weight:600;">${ing.nom}</td>
          <td style="padding:3px 8px; text-align:right; font-size:0.92rem; font-weight:700; font-variant-numeric:tabular-nums; white-space:nowrap;">${fmt.valeur}</td>
          <td style="padding:3px 8px; font-size:0.82rem; font-weight:600; color:var(--cuivre); white-space:nowrap;">${fmt.unite}</td>
          ${aPrix ? `<td style="padding:3px 8px; text-align:right; font-size:0.8rem; color:var(--charbon-clair); white-space:nowrap;">${coutIng}</td>` : ""}
          <td style="padding:3px 10px; font-size:0.76rem; color:var(--charbon-clair);">${sources}</td>
        </tr>`;
    }).join("");
  }

  const tableauHTML = ingredientsFiltres.length === 0 ? `
    <div class="vide-etat">
      <div class="icone-vide">🛒</div>
      Aucun ingrédient calculable pour cette sélection.<br>
      <span style="font-size:0.85rem; color:var(--charbon-clair);">Ajoutez des fiches techniques aux produits via Admin → Recettes.</span>
    </div>` : `
    <table style="width:100%; border-collapse:collapse; font-size:0.88rem;">
      <thead>
        <tr style="border-bottom:2px solid var(--bordeaux-pale,#e8c8cc);">
          <th style="padding:5px 10px; text-align:left; font-size:0.75rem; letter-spacing:.04em; text-transform:uppercase; min-width:160px;">Ingrédient</th>
          <th style="padding:5px 8px; text-align:right; font-size:0.75rem; letter-spacing:.04em; text-transform:uppercase; min-width:80px;">Quantité</th>
          <th style="padding:5px 8px; font-size:0.75rem; letter-spacing:.04em; text-transform:uppercase; min-width:50px;">Unité</th>
          ${aPrix ? `<th style="padding:5px 8px; text-align:right; font-size:0.75rem; letter-spacing:.04em; text-transform:uppercase; min-width:70px;">Coût</th>` : ""}
          <th style="padding:5px 10px; font-size:0.75rem; letter-spacing:.04em; text-transform:uppercase; color:var(--charbon-clair); font-weight:400;">Utilisé dans</th>
        </tr>
      </thead>
      <tbody>
        ${fournisseursFiltres.map(fourn => `
          ${fournisseursFiltres.length > 1 ? `
          <tr>
            <td colspan="${aPrix ? 5 : 4}" style="padding:6px 12px; background:var(--bordeaux,#6b1a1a); border-top:3px solid var(--creme,#fdf8f2);">
              <span style="display:inline-flex; align-items:center; gap:6px; font-size:0.78rem; font-weight:800; text-transform:uppercase; letter-spacing:.1em; color:#fff;">
                🏪 ${fourn}
              </span>
            </td>
          </tr>` : ""}
          ${lignesGroupeHTML(groupesActifs[fourn])}
        `).join("")}
        ${aPrix ? `
        <tr style="border-top:2px solid var(--bordeaux-pale,#e8c8cc);">
          <td colspan="${aPrix ? 3 : 2}" style="padding:6px 10px; font-size:0.85rem; font-weight:700; text-align:right;">Total coût matière estimé</td>
          <td style="padding:6px 8px; text-align:right; font-size:0.95rem; font-weight:700; color:var(--bordeaux); white-space:nowrap;">${coutTotal.toFixed(2)} €</td>
          <td></td>
        </tr>` : ""}
      </tbody>
    </table>`;

  // ── Sélecteurs ────────────────────────────────────────────
  const optionsFourn = tousFournisseurs.map(f =>
    `<option value="${f}" ${f === filtreF ? "selected" : ""}>${f}</option>`
  ).join("");

  const optionsEvt = commandesAvecFourn.map(c => {
    const nom = c.nomEvenement || c.client || c.numero || c.id;
    const date = c.dateEvenement ? new Date(c.dateEvenement).toLocaleDateString("fr-FR") : "";
    return `<option value="${c.id}" ${c.id === filtreE ? "selected" : ""}>${date ? date + " — " : ""}${nom}</option>`;
  }).join("");

  conteneur.innerHTML = `
    <div style="display:flex; gap:8px; align-items:center; margin-bottom:12px; flex-wrap:wrap;">
      <select id="pi-filtre-fourn" style="min-height:32px; font-size:0.85rem; padding:3px 8px; border:1px solid var(--gris-ligne); border-radius:6px; flex:1; min-width:160px; max-width:280px;">
        <option value="__tous__" ${filtreF === "__tous__" ? "selected" : ""}>🏪 Tous fournisseurs (${tousFournisseurs.length})</option>
        ${optionsFourn}
      </select>
      <select id="pi-filtre-evt" style="min-height:32px; font-size:0.85rem; padding:3px 8px; border:1px solid var(--gris-ligne); border-radius:6px; flex:1; min-width:160px; max-width:280px; color:var(--charbon-clair);">
        <option value="__tous__" ${filtreE === "__tous__" ? "selected" : ""}>📅 Tous événements (${commandesAvecFourn.length})</option>
        ${optionsEvt}
      </select>
      <span style="font-size:0.85rem; color:var(--charbon-clair); white-space:nowrap; flex-shrink:0;"><strong>${ingredientsFiltres.length}</strong> ingrédients · <strong>${commandesFiltrees.length}</strong> commandes</span>
      ${produitsSansRecette.size > 0 ? `
        <span style="font-size:0.8rem; background:var(--creme-fonce); border:1px solid var(--gris-ligne); border-radius:20px; padding:3px 10px; color:var(--charbon-clair);">
          ℹ️ ${produitsSansRecette.size} sans fiche : ${[...produitsSansRecette].slice(0, 3).join(", ")}${produitsSansRecette.size > 3 ? "…" : ""}
        </span>` : ""}
    </div>
    <div class="table-wrap" id="pc-contenu-imprimable">${tableauHTML}</div>`;

  conteneur.querySelector("#pi-filtre-fourn").addEventListener("change", e => {
    sessionStorage.setItem(filtreKeyF, e.target.value);
    // Réinitialiser l'événement s'il n'appartient plus au nouveau fournisseur
    const evtActuel = sessionStorage.getItem(filtreKeyE) || "__tous__";
    if (evtActuel !== "__tous__" && e.target.value !== "__tous__") {
      const ingsCmd = calculerIngredientsProduction(toutesCommandes.filter(c => c.id === evtActuel));
      if (!ingsCmd.some(ing => (ing.fournisseur || "— Sans fournisseur") === e.target.value))
        sessionStorage.setItem(filtreKeyE, "__tous__");
    }
    afficherIngredientsProduction(toutesCommandes, conteneur);
  });
  conteneur.querySelector("#pi-filtre-evt").addEventListener("change", e => {
    sessionStorage.setItem(filtreKeyE, e.target.value);
    afficherIngredientsProduction(toutesCommandes, conteneur);
  });

  // Exposer le handler d'impression
  conteneur._imprimerBonCommande = () => imprimerBonCommande(commandesFiltrees, ingredientsFiltres, fournisseursFiltres, groupesActifs, aPrix, coutTotal);
}

/**
 * Ouvre une fenêtre d'impression dédiée au bon de commande ingrédients,
 * groupé par fournisseur, avec coûts si disponibles.
 */
function imprimerBonCommande(commandes, ingredients, fournisseurs, groupes, aPrix, coutTotal) {
  const dateImpression = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  const titreFiltre = commandes.length === 1
    ? (commandes[0].nomEvenement || commandes[0].client || commandes[0].numero || commandes[0].id)
    : `Tous les événements (${commandes.length})`;

  function lignesHTML(liste) {
    return liste.map((ing, i) => {
      const fmt = formaterQuantiteIngredient(ing.total, ing.unite);
      const cout = aPrix && ing.prix > 0
        ? (ing.prix * parseFloat(fmt.valeur.replace(",", ".")) || 0).toFixed(2) + " €"
        : "";
      return `<tr style="background:${i % 2 === 0 ? "#f9f7f5" : "#fff"};">
        <td style="padding:5px 10px;">${ing.nom}</td>
        <td style="padding:5px 8px; text-align:right; font-weight:600;">${fmt.valeur}</td>
        <td style="padding:5px 8px; font-weight:600; color:#8b4513;">${fmt.unite}</td>
        ${aPrix ? `<td style="padding:5px 8px; text-align:right; color:#555;">${cout}</td>` : ""}
      </tr>`;
    }).join("");
  }

  const sections = fournisseurs.map(fourn => `
    ${fournisseurs.length > 1 ? `
    <tr><td colspan="${aPrix ? 4 : 3}" style="padding:6px 12px; background:#6b1a1a; border-top:3px solid #fff;">
      <span style="font-size:0.78em; font-weight:800; text-transform:uppercase; letter-spacing:.1em; color:#fff;">🏪 ${fourn}</span>
    </td></tr>` : ""}
    ${lignesHTML(groupes[fourn])}
  `).join("");

  const coutSection = aPrix ? `
    <tr style="border-top:2px solid #ddd;">
      <td colspan="3" style="padding:8px 10px; font-weight:700; text-align:right;">Total coût matière estimé</td>
      <td style="padding:8px 8px; text-align:right; font-weight:700; color:#8b4513;">${coutTotal.toFixed(2)} €</td>
    </tr>` : "";

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Bon de commande ingrédients</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #222; margin: 0; padding: 20px; }
    h1 { font-size: 1.3em; margin: 0 0 4px; color: #5c1a1a; }
    .meta { font-size: 0.82em; color: #666; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; }
    thead th { padding: 6px 10px; text-align: left; font-size: 0.75em; text-transform: uppercase; letter-spacing: .04em; border-bottom: 2px solid #c8a4a4; background: #fdf5f5; }
    thead th:nth-child(2), thead th:nth-child(3) { text-align: right; }
    .footer { margin-top: 20px; font-size: 0.78em; color: #999; border-top: 1px solid #ddd; padding-top: 8px; }
    @media print {
      body { padding: 10px; }
      button { display: none; }
    }
  </style>
</head>
<body>
  <h1>Bon de commande — Ingrédients</h1>
  <div class="meta">
    Événement : <strong>${titreFiltre}</strong> &nbsp;·&nbsp; Imprimé le ${dateImpression}
    &nbsp;·&nbsp; ${ingredients.length} ingrédient${ingredients.length > 1 ? "s" : ""}
  </div>
  <table>
    <thead>
      <tr>
        <th>Ingrédient</th>
        <th style="text-align:right">Quantité</th>
        <th>Unité</th>
        ${aPrix ? `<th style="text-align:right">Coût</th>` : ""}
      </tr>
    </thead>
    <tbody>
      ${sections}
      ${coutSection}
    </tbody>
  </table>
  <div class="footer">EventPro — Document généré automatiquement</div>
  <script>window.onload = () => window.print();<\/script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=900,height=700");
  if (win) {
    win.document.write(html);
    win.document.close();
  } else {
    alert("La fenêtre pop-up a été bloquée. Autorisez les pop-ups pour ce site.");
  }
}

/**
 * Imprime uniquement le contenu de la fiche de production actuellement
 * affichée (selon l'onglet Traiteur/Boucherie/Pierrades/Ingrédients sélectionné).
 */
function imprimerProduction() {
  const contenu = document.getElementById("pc-contenu-imprimable");
  if (!contenu) { console.warn("imprimerProduction: pc-contenu-imprimable introuvable"); return; }

  let zone = document.getElementById("zone-impression-dediee");
  if (zone) zone.remove();
  zone = document.createElement("div");
  zone.id = "zone-impression-dediee";
  zone.className = "zone-impression-dediee";

  const labelOnglet = onglerProductionActif === "ingredients"
    ? "Bon de commande — Ingrédients"
    : ((ETAT.parametres.fichesImpression || CATEGORIES_IMPRESSION_PRODUCTION).find(c => c.id === onglerProductionActif)?.label || onglerProductionActif);
  const contexte = filtreProduction.periodeId
    ? ((ETAT.parametres.periodes || []).find(p => p.id === filtreProduction.periodeId)?.nom || "")
    : formaterDate(filtreProduction.dateRetrait);

  zone.innerHTML = `
    <h2 style="margin-bottom:8px; color:#5c1a2a; font-size:1rem;">
      Fiche ${labelOnglet} — ${contexte}${filtreProduction.magasinId ? " — " + nomMagasin(filtreProduction.magasinId) : ""}
    </h2>
    ${contenu.outerHTML}
  `;
  document.body.appendChild(zone);
  document.body.classList.add("mode-impression-dediee");

  function nettoyerApresImpression() {
    window.removeEventListener("afterprint", nettoyerApresImpression);
    document.body.classList.remove("mode-impression-dediee");
    zone.remove();
  }
  window.addEventListener("afterprint", nettoyerApresImpression);
  window.print();
}

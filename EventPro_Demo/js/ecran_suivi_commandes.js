// ============================================================
// ÉCRAN : SUIVI CENTRAL DES COMMANDES
// ============================================================

let filtresCommandes = { magasinId: "", periodeId: "", statut: "", impression: "toutes", recherche: "" };
let commandesEnCache = [];
let modeVueSuivi = sessionStorage.getItem("eventpro_demo_vue_suivi") || "cartes";

function rendreSuiviCommandes(conteneur) {
  conteneur.innerHTML = `
    <div class="filtre-barre carte">
      <select id="fc-magasin">
        <option value="">Tous les magasins</option>
        ${ETAT.parametres.magasins.map(m => `<option value="${m.id}">${m.nom}</option>`).join("")}
      </select>
      <select id="fc-periode">
        <option value="">Toutes périodes</option>
        ${(ETAT.parametres.periodes || []).map(p => `<option value="${p.id}">${p.nom}</option>`).join("")}
      </select>
      <select id="fc-statut">
        <option value="">Tous statuts</option>
        ${(ETAT.parametres.statuts || STATUTS).map(s => `<option value="${s.id}">${s.label}</option>`).join("")}
      </select>
      <select id="fc-impression">
        <option value="toutes">Toutes commandes</option>
        <option value="non_imprimees">🟢 Non imprimées</option>
        <option value="imprimees">🔵 Imprimées</option>
      </select>
      <input type="search" id="fc-recherche" placeholder="🔎 Client ou n° commande...">
      <button class="btn btn-secondaire btn-sm" id="fc-reinit">Réinitialiser</button>
      <div style="display:flex; gap:4px; margin-left:auto;">
        <button id="fc-vue-tableau" title="Vue tableau" style="min-height:36px; padding:6px 12px; border-radius:6px 0 0 6px; border:2px solid var(--gris-ligne); background:${modeVueSuivi==='tableau'?'var(--bordeaux)':'var(--blanc)'}; color:${modeVueSuivi==='tableau'?'var(--creme)':'var(--charbon)'}; cursor:pointer; font-size:1rem;">☰</button>
        <button id="fc-vue-cartes" title="Vue cartes" style="min-height:36px; padding:6px 12px; border-radius:0 6px 6px 0; border:2px solid var(--gris-ligne); border-left:none; background:${modeVueSuivi==='cartes'?'var(--bordeaux)':'var(--blanc)'}; color:${modeVueSuivi==='cartes'?'var(--creme)':'var(--charbon)'}; cursor:pointer; font-size:1rem;">⊞</button>
      </div>
    </div>

    <div id="fc-liste-conteneur"><div class="vide-etat">Chargement des commandes...</div></div>
  `;

  document.getElementById("fc-magasin").addEventListener("change", e => { filtresCommandes.magasinId = e.target.value; rafraichirAffichageCommandes(); });
  document.getElementById("fc-periode").addEventListener("change", e => { filtresCommandes.periodeId = e.target.value; rafraichirAffichageCommandes(); });
  document.getElementById("fc-statut").addEventListener("change", e => { filtresCommandes.statut = e.target.value; rafraichirAffichageCommandes(); });
  document.getElementById("fc-impression").addEventListener("change", e => { filtresCommandes.impression = e.target.value; rafraichirAffichageCommandes(); });
  document.getElementById("fc-recherche").addEventListener("input", e => { filtresCommandes.recherche = e.target.value.toLowerCase(); rafraichirAffichageCommandes(); });
  document.getElementById("fc-reinit").addEventListener("click", () => {
    filtresCommandes = { magasinId: "", periodeId: "", statut: "", impression: "toutes", recherche: "" };
    rendreSuiviCommandes(conteneur);
  });

  function basculerVue(mode) {
    modeVueSuivi = mode;
    sessionStorage.setItem("eventpro_demo_vue_suivi", mode);
    const btnTab = document.getElementById("fc-vue-tableau");
    const btnCar = document.getElementById("fc-vue-cartes");
    if (btnTab) { btnTab.style.background = mode === "tableau" ? "var(--bordeaux)" : "var(--blanc)"; btnTab.style.color = mode === "tableau" ? "var(--creme)" : "var(--charbon)"; }
    if (btnCar) { btnCar.style.background = mode === "cartes" ? "var(--bordeaux)" : "var(--blanc)"; btnCar.style.color = mode === "cartes" ? "var(--creme)" : "var(--charbon)"; }
    rafraichirAffichageCommandes();
  }
  document.getElementById("fc-vue-tableau").addEventListener("click", () => basculerVue("tableau"));
  document.getElementById("fc-vue-cartes").addEventListener("click", () => basculerVue("cartes"));

  const desabonner = ecouterCommandes((commandes, err) => {
    if (err) { afficherToast("Erreur de connexion aux commandes", "erreur"); return; }
    commandesEnCache = commandes;
    rafraichirAffichageCommandes();
  });
  ETAT.desabonnements.push(desabonner);
}

function rafraichirAffichageCommandes() {
  const conteneur = document.getElementById("fc-liste-conteneur");
  if (!conteneur) return;

  let liste = [...commandesEnCache];
  if (filtresCommandes.magasinId) liste = liste.filter(c => c.magasinId === filtresCommandes.magasinId);
  if (filtresCommandes.periodeId) {
    const periodeSelectionnee = (ETAT.parametres.periodes || []).find(p => p.id === filtresCommandes.periodeId);
    const joursSet = new Set(periodeSelectionnee ? (periodeSelectionnee.jours || []) : []);
    liste = liste.filter(c => c.periodeId === filtresCommandes.periodeId || (joursSet.size > 0 && joursSet.has(c.dateRetrait)));
  }
  if (filtresCommandes.statut) {
    liste = liste.filter(c => c.statut === filtresCommandes.statut);
  } else {
    // Masquer les annulées par défaut — visibles uniquement si filtre "Annulée" sélectionné
    liste = liste.filter(c => c.statut !== "annulee");
  }
  if (filtresCommandes.impression === "non_imprimees") liste = liste.filter(c => !c.imprimee);
  if (filtresCommandes.impression === "imprimees") liste = liste.filter(c => c.imprimee);
  if (filtresCommandes.recherche) {
    const normaliser = s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const t = normaliser(filtresCommandes.recherche);
    liste = liste.filter(c => normaliser(c.client || "").includes(t) || normaliser(c.numero || "").includes(t));
  }
  liste.sort((a, b) => (a.dateRetrait || "").localeCompare(b.dateRetrait || ""));

  if (liste.length === 0) {
    conteneur.innerHTML = `<div class="vide-etat"><div class="icone-vide">📋</div>Aucune commande ne correspond aux filtres.</div>`;
    return;
  }

  // Compteurs par statut (sur la liste filtrée, hors annulées)
  const listeHorsAnnulees = liste.filter(c => c.statut !== "annulee");
  const compteurs = {};
  listeHorsAnnulees.forEach(c => { compteurs[c.statut] = (compteurs[c.statut] || 0) + 1; });
  const labelStatut = Object.fromEntries((ETAT.parametres.statuts || STATUTS).map(s => [s.id, s.label.toLowerCase()]));
  const resumeStatuts = Object.entries(compteurs).map(([k, v]) => `<span style="font-weight:600">${v}</span> ${labelStatut[k] || k}`).join(" · ");

  const bandeauResume = resumeStatuts
    ? `<div style="margin-bottom:10px; color:#555; font-size:0.93rem; padding:6px 10px; background:#f5f0eb; border-radius:6px;">${resumeStatuts}</div>`
    : "";

  if (modeVueSuivi === "cartes") {
    conteneur.innerHTML = `
      ${bandeauResume}
      <div class="grille-commandes-cartes">
        ${liste.map(c => carteCommandeHTML(c)).join("")}
      </div>
      <div style="margin-top:14px; display:flex; gap:10px; flex-wrap:wrap;" class="no-print">
        <button class="btn btn-secondaire btn-sm" id="fc-imprimer-jour">Imprimer fiches (journée filtrée)</button>
        <button class="btn btn-cuivre btn-sm" id="fc-imprimer-etiquettes">🏷️ Imprimer étiquettes (tout)</button>
      </div>
    `;
  } else {
    conteneur.innerHTML = `
      ${bandeauResume}
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th><input type="checkbox" id="fc-tout-cocher"></th>
              <th>N°</th><th>Client</th><th>Téléphone</th><th>Magasin</th><th>Retrait</th>
              <th>Statut</th><th>Impression</th><th>Total</th><th></th>
            </tr>
          </thead>
          <tbody>
            ${liste.map(c => ligneCommandeHTML(c)).join("")}
          </tbody>
        </table>
      </div>
      <div style="margin-top:14px; display:flex; gap:10px; flex-wrap:wrap; align-items:center;" class="no-print">
        <button class="btn btn-secondaire btn-sm" id="fc-imprimer-selection">Imprimer fiches (sélection)</button>
        <button class="btn btn-secondaire btn-sm" id="fc-imprimer-jour">Imprimer fiches (journée filtrée)</button>
        <button class="btn btn-cuivre btn-sm" id="fc-imprimer-etiquettes">🏷️ Imprimer étiquettes (sélection)</button>
        <div id="fc-bloc-statut-masse" style="display:flex; gap:6px; align-items:center; border-left:2px solid var(--gris-ligne); padding-left:10px; margin-left:4px;">
          <select id="fc-statut-masse" style="min-height:32px; font-size:0.82rem; padding:4px 8px; border:1.5px solid var(--gris-ligne); border-radius:6px; background:var(--blanc);">
            ${(ETAT.parametres.statuts || STATUTS).filter(s => s.id !== "annulee").map(s =>
              `<option value="${s.id}">${s.label}</option>`
            ).join("")}
          </select>
          <button class="btn btn-sm" id="fc-appliquer-statut-masse"
            style="background:var(--bordeaux); color:var(--creme); border:none; padding:6px 12px; border-radius:6px; font-size:0.82rem; font-weight:600; cursor:pointer; white-space:nowrap;">
            ✔ Appliquer (sélection)
          </button>
        </div>
      </div>
    `;
    const chkTout = document.getElementById("fc-tout-cocher");
    if (chkTout) chkTout.addEventListener("change", e => {
      document.querySelectorAll(".case-commande").forEach(cb => cb.checked = e.target.checked);
    });
    const btnImprimerSelection = document.getElementById("fc-imprimer-selection");
    if (btnImprimerSelection) btnImprimerSelection.addEventListener("click", () => {
      const ids = Array.from(document.querySelectorAll(".case-commande:checked")).map(cb => cb.dataset.id);
      if (ids.length === 0) { afficherToast("Sélectionnez au moins une commande", "erreur"); return; }
      imprimerCommandes(liste.filter(c => ids.includes(c.id)));
    });
    const btnAppliquerStatut = document.getElementById("fc-appliquer-statut-masse");
    if (btnAppliquerStatut) btnAppliquerStatut.addEventListener("click", async () => {
      const ids = Array.from(document.querySelectorAll(".case-commande:checked")).map(cb => cb.dataset.id);
      if (ids.length === 0) { afficherToast("Sélectionnez au moins une commande", "erreur"); return; }
      const nouveauStatut = document.getElementById("fc-statut-masse").value;
      const labelStatut = (ETAT.parametres.statuts || STATUTS).find(s => s.id === nouveauStatut)?.label || nouveauStatut;
      if (!confirm(`Passer ${ids.length} commande(s) en "${labelStatut}" ?`)) return;
      let ok = 0, erreurs = 0;
      for (const id of ids) {
        const cmd = liste.find(c => c.id === id);
        try {
          await changerStatutCommande(id, nouveauStatut, cmd?.numero || id);
          ok++;
        } catch { erreurs++; }
      }
      if (erreurs === 0) afficherToast(`${ok} commande(s) passée(s) en "${labelStatut}"`, "succes");
      else afficherToast(`${ok} mise(s) à jour, ${erreurs} erreur(s)`, "erreur");
    });
  }

  // Listeners partagés (statut, voir, supprimer) — fonctionnent en mode tableau et cartes
  liste.forEach(c => {
    const selStatut = document.getElementById(`statut-${c.id}`);
    if (selStatut) selStatut.addEventListener("change", async (e) => {
      try {
        await changerStatutCommande(c.id, e.target.value, c.numero);
        afficherToast(`Statut de ${c.numero} mis à jour`, "succes");
      } catch (err) { afficherToast("Erreur: " + err.message, "erreur"); }
    });
    const btnVoir = document.getElementById(`voir-${c.id}`);
    if (btnVoir) btnVoir.addEventListener("click", () => ouvrirDetailCommande(c));
    const btnSupprimer = document.getElementById(`supprimer-${c.id}`);
    if (btnSupprimer) btnSupprimer.addEventListener("click", async () => {
      if (c.statut === "annulee") { afficherToast("Commande déjà annulée. Suppression définitive dans Admin > Données.", "erreur"); return; }
      if (!confirm(`Annuler la commande ${c.numero} ? Elle restera visible avec le statut "Annulée".`)) return;
      try {
        await changerStatutCommande(c.id, "annulee", c.numero);
        afficherToast(`Commande ${c.numero} annulée`, "succes");
      } catch (err) { afficherToast("Erreur: " + err.message, "erreur"); }
    });
  });

  const btnImprimerJour = document.getElementById("fc-imprimer-jour");
  if (btnImprimerJour) btnImprimerJour.addEventListener("click", () => imprimerCommandes(liste));

  const btnImprimerEtiquettes = document.getElementById("fc-imprimer-etiquettes");
  if (btnImprimerEtiquettes) btnImprimerEtiquettes.addEventListener("click", () => {
    if (modeVueSuivi === "cartes") {
      imprimerEtiquettesCommandes(liste);
    } else {
      const ids = Array.from(document.querySelectorAll(".case-commande:checked")).map(cb => cb.dataset.id);
      if (ids.length === 0) { afficherToast("Sélectionnez au moins une commande", "erreur"); return; }
      imprimerEtiquettesCommandes(liste.filter(c => ids.includes(c.id)));
    }
  });
}

function ligneCommandeHTML(c) {
  const statut = trouverStatut(c.statut);
  const total = (c.lignes || []).reduce((s, l) => s + (l.prixUnitaire || 0) * l.quantite, 0);
  return `
    <tr>
      <td><input type="checkbox" class="case-commande" data-id="${c.id}"></td>
      <td><strong>${c.numero}</strong></td>
      <td>${c.client}</td>
      <td>${c.telephoneClient || "-"}</td>
      <td>${nomMagasin(c.magasinId)}</td>
      <td>${formaterDate(c.dateRetrait)}</td>
      <td>
        <select id="statut-${c.id}" style="min-height:36px; padding:4px 8px; border-radius:6px; border:1px solid var(--gris-ligne);">
          ${(ETAT.parametres.statuts || STATUTS).map(s => `<option value="${s.id}" ${s.id === c.statut ? "selected" : ""}>${s.label}</option>`).join("")}
        </select>
      </td>
      <td>${c.imprimee ? "🔵 Imprimée" : "🟢 Non imprimée"}</td>
      <td>${formaterMontant(total)}</td>
      <td style="display:flex; gap:6px;">
        <button class="btn btn-fantome btn-sm" id="voir-${c.id}">Voir / Modifier</button>
        <button class="btn btn-fantome btn-sm" id="supprimer-${c.id}" style="color:#b3261e;">✕</button>
      </td>
    </tr>
  `;
}

function carteCommandeHTML(c) {
  const statut = trouverStatut(c.statut);
  const couleurStatut = statut ? statut.couleur : "#aaa";
  const total = (c.lignes || []).reduce((s, l) => s + (l.prixUnitaire || 0) * l.quantite, 0);
  const lignes = c.lignes || [];
  const resumeProduits = lignes.length
    ? lignes.slice(0, 3).map(l => l.nom).join(", ") + (lignes.length > 3 ? ` <span style="color:var(--charbon-clair)">+${lignes.length - 3}</span>` : "")
    : "—";
  return `
    <div class="carte-commande-item" style="border-top:4px solid ${couleurStatut};">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:8px;">
        <div style="min-width:0;">
          <div style="font-size:0.75rem; font-weight:700; color:var(--charbon-clair); letter-spacing:0.04em; text-transform:uppercase;">${c.numero}</div>
          <div style="font-family:var(--font-display); font-size:1.05rem; font-weight:700; color:var(--bordeaux-fonce); line-height:1.2; margin-top:2px;">${c.client}</div>
          ${c.telephoneClient ? `<div style="font-size:0.8rem; color:var(--charbon-clair); margin-top:3px;">📞 ${c.telephoneClient}</div>` : ""}
        </div>
        <div style="text-align:right; flex-shrink:0;">
          <div style="font-family:var(--font-display); font-size:1.1rem; font-weight:700; color:var(--bordeaux);">${formaterMontant(total)}</div>
          <div style="font-size:0.78rem; color:var(--charbon-clair); margin-top:2px;">📅 ${formaterDate(c.dateRetrait)}</div>
          <div style="font-size:0.78rem; color:var(--charbon-clair);">🏪 ${nomMagasin(c.magasinId)}</div>
        </div>
      </div>
      <div style="font-size:0.82rem; color:var(--charbon-clair); background:var(--creme); border-radius:var(--radius-sm); padding:5px 8px; margin-bottom:10px; line-height:1.5;">${resumeProduits}</div>
      <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
        <select id="statut-${c.id}" style="min-height:34px; padding:4px 8px; border-radius:6px; border:2px solid ${couleurStatut}; font-size:0.85rem; flex:1; min-width:130px;">
          ${(ETAT.parametres.statuts || STATUTS).map(s => `<option value="${s.id}" ${s.id === c.statut ? "selected" : ""}>${s.label}</option>`).join("")}
        </select>
        <button class="btn btn-fantome btn-sm" id="voir-${c.id}" style="flex-shrink:0;">✏️ Modifier</button>
        <button class="btn btn-fantome btn-sm" id="supprimer-${c.id}" style="color:#b3261e; flex-shrink:0;">✕</button>
      </div>
    </div>
  `;
}

let panierEditionCommande = {};

function ouvrirDetailCommande(c) {
  const peutModifier = aPermission(ETAT.utilisateur.role, "modifier_commande");

  // Initialiser le panier d'édition avec les lignes actuelles de la commande.
  // Pour les pierrades, on regroupe par variante (Nature/Marinée) en sommant
  // les personnes de tous les plateaux existants — l'édition recalculera le
  // découpage en plateaux à l'enregistrement, comme à la création.
  panierEditionCommande = {};
  (c.lignes || []).forEach(l => {
    if (l.typeVente === "pierrade") {
      // Pierrades : regrouper par variante en sommant les personnes (l'édition redécoupera en plateaux)
      if (!panierEditionCommande[l.produitId]) panierEditionCommande[l.produitId] = {};
      panierEditionCommande[l.produitId].quantite = (panierEditionCommande[l.produitId].quantite || 0) + l.quantite;
      if (l.specification) panierEditionCommande[l.produitId].specification = l.specification;
      return;
    }
    if (l.typeVente === "poids") {
      if (!panierEditionCommande[l.produitId]) {
        // Première ligne : entrée principale
        panierEditionCommande[l.produitId] = {
          poidsKg: l.poidsKg || 0,
          options: l.options || (l.farce ? { "Farce": l.farce } : {}),
          farce: l.farce || "",
          specification: l.specification || "",
          lignesSupp: []
        };
      } else {
        // Lignes suivantes : multi-variante → lignesSupp (préserver farce/poids individuels)
        (panierEditionCommande[l.produitId].lignesSupp = panierEditionCommande[l.produitId].lignesSupp || []).push({
          poidsKg: l.poidsKg || 0,
          options: l.options || (l.farce ? { "Farce": l.farce } : {}),
          farce: l.farce || "",
          specification: l.specification || ""
        });
      }
      return;
    }
    // Produits simples / menus
    if (!panierEditionCommande[l.produitId]) panierEditionCommande[l.produitId] = {};
    panierEditionCommande[l.produitId].quantite = (panierEditionCommande[l.produitId].quantite || 0) + l.quantite;
    if (l.specification) panierEditionCommande[l.produitId].specification = l.specification;
  });

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  const statut = trouverStatut(c.statut);
  overlay.innerHTML = `
    <div class="modal" style="max-width:760px;">
      <div class="carte-titre">
        <h2 style="margin:0;">${c.numero}</h2>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-secondaire btn-sm" id="btn-renvoyer-confirmation">📤 Renvoyer confirmation</button>
          <button class="btn btn-fantome btn-sm" id="fermer-modal">Fermer</button>
        </div>
      </div>
      <p><strong>Client :</strong> ${c.client}<br>
      <strong>Magasin :</strong> ${nomMagasin(c.magasinId)}<br>
      <strong>Retrait :</strong> ${formaterDate(c.dateRetrait)}<br>
      <strong>Vendeur :</strong> ${c.vendeur || "—"}<br>
      <strong>Statut :</strong> ${statut.label}</p>
      ${c.instructions && c.instructions.length ? `<p><strong>Instructions :</strong> ${c.instructions.map(i => {
        const ins = (ETAT.parametres.instructionsCommande || INSTRUCTIONS_PREPARATION).find(x => x.id === i);
        return ins ? `${ins.icone} ${ins.label}` : i;
      }).join(", ")}</p>` : ""}
      ${c.remarques ? `<p><strong>Remarques :</strong> ${c.remarques}</p>` : ""}

      ${peutModifier ? `
        <div class="champ" style="margin-top:16px;">
          <input type="search" id="dc-recherche" placeholder="🔎 Ajouter un produit...">
        </div>
        <div id="dc-grille-produits" style="max-height:320px; overflow-y:auto; margin-bottom:14px;"></div>
        <div style="display:flex; justify-content:space-between; align-items:center; border-top:2px solid var(--gris-ligne); padding-top:14px;">
          <strong id="dc-total">Total : ${formaterMontant((c.lignes||[]).reduce((s,l)=>s+(l.prixUnitaire||0)*l.quantite,0))}</strong>
          <button class="btn btn-primaire" id="dc-enregistrer">Enregistrer les modifications</button>
        </div>
      ` : `
        <table style="width:100%; margin-top:14px;">
          <thead><tr><th>Produit</th><th>Qté</th><th>Prix u.</th><th>Total</th></tr></thead>
          <tbody>
            ${(c.lignes || []).map(l => `
              <tr><td>${libelleLigne(l)}</td><td>${quantiteAffichee(l)}</td><td>${formaterMontant(l.prixUnitaire)}</td><td>${formaterMontant(l.prixUnitaire * l.quantite)}</td></tr>
            `).join("")}
          </tbody>
        </table>
      `}
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  document.getElementById("fermer-modal").addEventListener("click", () => overlay.remove());

  document.getElementById("btn-renvoyer-confirmation").addEventListener("click", () => {
    overlay.remove();
    afficherModalEnvoi(c, c.numero, () => {
      afficherToast("Confirmation envoyée", "succes");
    });
  });

  if (!peutModifier) return;

  function afficherGrilleEdition(terme = "") {
    const zone = document.getElementById("dc-grille-produits");
    const produits = ETAT.catalogue.filter(p => p.actif !== false && p.nom.toLowerCase().includes(terme.toLowerCase()));
    const parCategorie = {};
    produits.forEach(p => { (parCategorie[p.categorie] = parCategorie[p.categorie] || []).push(p); });
    const categoriesOrdonnees = ORDRE_CATEGORIES.filter(cat => parCategorie[cat]);

    zone.innerHTML = categoriesOrdonnees.map(cat => {
      if (cat === "Pierrade") {
        const nature = panierEditionCommande["pierrade_nature"] || {};
        const marinee = panierEditionCommande["pierrade_marinee"] || {};
        return `
          <div class="bloc-categorie">
            <h3 style="font-size:0.85rem;">${cat}</h3>
            <div class="carte-produit" style="flex-direction:column; align-items:stretch; gap:10px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div class="nom-produit">Pierrade Nature</div>
                <div class="stepper">
                  <button data-edition-pierrade="pierrade_nature" data-edition-delta="-1">−</button>
                  <span class="valeur" data-edition-valeur-pierrade="pierrade_nature">${nature.quantite || 0}</span>
                  <button data-edition-pierrade="pierrade_nature" data-edition-delta="1">+</button>
                </div>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div class="nom-produit">Pierrade Marinée</div>
                <div class="stepper">
                  <button data-edition-pierrade="pierrade_marinee" data-edition-delta="-1">−</button>
                  <span class="valeur" data-edition-valeur-pierrade="pierrade_marinee">${marinee.quantite || 0}</span>
                  <button data-edition-pierrade="pierrade_marinee" data-edition-delta="1">+</button>
                </div>
              </div>
              ${zoneSpecificationEditionHTML("pierrade_nature")}
            </div>
          </div>
        `;
      }
      return `
        <div class="bloc-categorie">
          <h3 style="font-size:0.85rem;">${cat}</h3>
          <div class="grille-produits">
            ${parCategorie[cat].map(p => carteEditionHTML(p)).join("")}
          </div>
        </div>
      `;
    }).join("");

    zone.querySelectorAll("[data-edition-produit]").forEach(btn => {
      btn.addEventListener("click", () => {
        const produitId = btn.dataset.editionProduit;
        const delta = parseInt(btn.dataset.editionDelta, 10);
        const actuel = (panierEditionCommande[produitId] && panierEditionCommande[produitId].quantite) || 0;
        const nouveau = Math.max(0, actuel + delta);
        if (!panierEditionCommande[produitId]) panierEditionCommande[produitId] = {};
        panierEditionCommande[produitId].quantite = nouveau;
        if (nouveau === 0 && !panierEditionCommande[produitId].specification) delete panierEditionCommande[produitId];

        const valEl = zone.querySelector(`[data-edition-valeur="${produitId}"]`);
        if (valEl) valEl.textContent = nouveau;
        const carteEl = zone.querySelector(`[data-carte-edition="${produitId}"]`);
        if (carteEl) carteEl.classList.toggle("actif", nouveau > 0);

        mettreAJourTotalEdition();
      });
    });

    zone.querySelectorAll("[data-edition-poids]").forEach(input => {
      input.addEventListener("input", (e) => {
        const produitId = input.dataset.editionPoids;
        const poidsKg = parseFloat(e.target.value) || 0;
        if (!panierEditionCommande[produitId]) panierEditionCommande[produitId] = {};
        panierEditionCommande[produitId].poidsKg = poidsKg;
        if (poidsKg <= 0 && !panierEditionCommande[produitId].specification) delete panierEditionCommande[produitId];
        const carteEl = zone.querySelector(`[data-carte-edition="${produitId}"]`);
        if (carteEl) carteEl.classList.toggle("actif", poidsKg > 0);
        mettreAJourTotalEdition();
      });
    });

    zone.querySelectorAll("[data-edition-pierrade]").forEach(btn => {
      btn.addEventListener("click", () => {
        const produitId = btn.dataset.editionPierrade;
        const delta = parseInt(btn.dataset.editionDelta, 10);
        const actuel = (panierEditionCommande[produitId] && panierEditionCommande[produitId].quantite) || 0;
        const nouveau = Math.max(0, actuel + delta);
        if (!panierEditionCommande[produitId]) panierEditionCommande[produitId] = {};
        panierEditionCommande[produitId].quantite = nouveau;
        if (nouveau === 0 && !panierEditionCommande[produitId].specification) delete panierEditionCommande[produitId];

        const valEl = zone.querySelector(`[data-edition-valeur-pierrade="${produitId}"]`);
        if (valEl) valEl.textContent = nouveau;
        mettreAJourTotalEdition();
      });
    });

    zone.querySelectorAll("[data-edition-specification-btn]").forEach(btn => {
      btn.addEventListener("click", () => {
        const z = zone.querySelector(`[data-edition-zone-specification="${btn.dataset.editionSpecificationBtn}"]`);
        if (z) z.style.display = z.style.display === "none" ? "block" : "none";
      });
    });

    zone.querySelectorAll("[data-edition-specification-texte]").forEach(input => {
      input.addEventListener("input", (e) => {
        const produitId = input.dataset.editionSpecificationTexte;
        if (!panierEditionCommande[produitId]) panierEditionCommande[produitId] = {};
        panierEditionCommande[produitId].specification = e.target.value.trim();
        const btn = zone.querySelector(`[data-edition-specification-btn="${produitId}"]`);
        if (btn) btn.textContent = e.target.value.trim() ? "✏️ Spécification : " + e.target.value.trim() : "+ Spécification";
      });
    });
  }

  function zoneSpecificationEditionHTML(produitId) {
    const valeurActuelle = (panierEditionCommande[produitId] && panierEditionCommande[produitId].specification) || "";
    return `
      <button type="button" class="btn btn-fantome btn-sm" data-edition-specification-btn="${produitId}" style="margin-top:4px; font-size:0.78rem; padding:4px 10px; min-height:auto;">
        ${valeurActuelle ? "✏️ Spécification : " + valeurActuelle : "+ Spécification"}
      </button>
      <div data-edition-zone-specification="${produitId}" style="display:none; margin-top:6px;">
        <input type="text" data-edition-specification-texte="${produitId}" value="${valeurActuelle}" placeholder="Ex: sans porc, sans boudin..." style="width:100%; min-height:36px; padding:6px 10px; border:1px solid var(--gris-ligne); border-radius:6px; font-size:0.85rem;">
      </div>
    `;
  }

  function carteEditionHTML(p) {
    const entree = panierEditionCommande[p.id] || {};
    if (p.type === "poids") {
      const poids = entree.poidsKg || 0;
      return `
        <div class="carte-produit ${poids > 0 ? 'actif' : ''}" data-carte-edition="${p.id}" style="flex-direction:column; align-items:stretch; gap:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div class="nom-produit">${p.nom}</div>
              <div class="prix-produit">${p.prix ? formaterMontant(p.prix) + " / kg" : ''}</div>
            </div>
            <div style="display:flex; align-items:center; gap:6px;">
              <input type="number" min="0" step="0.1" data-edition-poids="${p.id}" value="${poids || ''}" placeholder="0.0" style="width:70px; min-height:36px; padding:4px 8px; border:1px solid var(--gris-ligne); border-radius:6px; text-align:right;">
              <span style="font-size:0.85rem; color:var(--charbon-clair);">kg</span>
            </div>
          </div>
          ${zoneSpecificationEditionHTML(p.id)}
        </div>
      `;
    }
    const qte = entree.quantite || 0;
    return `
      <div class="carte-produit ${qte > 0 ? 'actif' : ''}" data-carte-edition="${p.id}" style="flex-direction:column; align-items:stretch; gap:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div class="nom-produit">${p.nom}</div>
            <div class="prix-produit">${p.prix ? formaterMontant(p.prix) : ''}</div>
          </div>
          <div class="stepper">
            <button data-edition-produit="${p.id}" data-edition-delta="-1">−</button>
            <span class="valeur" data-edition-valeur="${p.id}">${qte}</span>
            <button data-edition-produit="${p.id}" data-edition-delta="1">+</button>
          </div>
        </div>
        ${zoneSpecificationEditionHTML(p.id)}
      </div>
    `;
  }

  function mettreAJourTotalEdition() {
    const parId = Object.fromEntries(ETAT.catalogue.map(p => [p.id, p]));
    let total = 0;
    for (const [id, entree] of Object.entries(panierEditionCommande)) {
      const p = parId[id];
      if (!p) continue;
      if (p.type === "poids") total += (p.prix || 0) * (entree.poidsKg || 0);
      else total += (p.prix || 0) * (entree.quantite || 0);
    }
    const elTotal = document.getElementById("dc-total");
    if (elTotal) elTotal.textContent = "Total : " + formaterMontant(total);
  }

  afficherGrilleEdition();
  document.getElementById("dc-recherche").addEventListener("input", (e) => afficherGrilleEdition(e.target.value));

  document.getElementById("dc-enregistrer").addEventListener("click", async () => {
    if (Object.keys(panierEditionCommande).length === 0) {
      afficherToast("Une commande doit contenir au moins un produit", "erreur");
      return;
    }
    const parId = Object.fromEntries(ETAT.catalogue.map(p => [p.id, p]));
    const nouvellesLignes = [];

    // Pierrades : même logique de découpage équilibré qu'à la création.
    const entreeNature = panierEditionCommande["pierrade_nature"] || {};
    const entreeMarinee = panierEditionCommande["pierrade_marinee"] || {};
    const totalPersonnes = (entreeNature.quantite || 0) + (entreeMarinee.quantite || 0);
    if (totalPersonnes > 0) {
      const specificationPierrade = entreeNature.specification || entreeMarinee.specification || "";
      const tailleDesPlateaux = repartirEnPlateaux(totalPersonnes, 6);
      const nbPlateaux = tailleDesPlateaux.length;
      let resteNature = entreeNature.quantite || 0;
      let resteMarinee = entreeMarinee.quantite || 0;
      tailleDesPlateaux.forEach((places, idx) => {
        const i = idx + 1;
        let n = Math.min(resteNature, places);
        let m = Math.min(resteMarinee, places - n);
        resteNature -= n; resteMarinee -= m;
        if (n > 0) nouvellesLignes.push({
          produitId: "pierrade_nature", nom: parId["pierrade_nature"].nom, typeVente: "pierrade",
          quantite: n, prixUnitaire: parId["pierrade_nature"].prix || 0, specification: specificationPierrade,
          plateauNumero: nbPlateaux > 1 ? i : null, plateauTotal: nbPlateaux > 1 ? nbPlateaux : null
        });
        if (m > 0) nouvellesLignes.push({
          produitId: "pierrade_marinee", nom: parId["pierrade_marinee"].nom, typeVente: "pierrade",
          quantite: m, prixUnitaire: parId["pierrade_marinee"].prix || 0, specification: specificationPierrade,
          plateauNumero: nbPlateaux > 1 ? i : null, plateauTotal: nbPlateaux > 1 ? nbPlateaux : null
        });
      });
    }

    for (const [produitId, entree] of Object.entries(panierEditionCommande)) {
      const p = parId[produitId];
      if (!p || p.type === "pierrade") continue;
      if (p.type === "poids") {
        if (!entree.poidsKg || entree.poidsKg <= 0) continue;
        nouvellesLignes.push({
          produitId, nom: p.nom, typeVente: "poids", quantite: 1, poidsKg: entree.poidsKg,
          prixUnitaire: (p.prix || 0) * entree.poidsKg,
          specification: entree.specification || "",
          options: entree.options || {},
          farce: (entree.options && entree.options["Farce"]) || entree.farce || ""
        });
        for (const supp of (entree.lignesSupp || [])) {
          if (!supp.poidsKg || supp.poidsKg <= 0) continue;
          nouvellesLignes.push({
            produitId, nom: p.nom, typeVente: "poids", quantite: 1, poidsKg: supp.poidsKg,
            prixUnitaire: (p.prix || 0) * supp.poidsKg,
            specification: supp.specification || "",
            options: supp.options || {},
            farce: (supp.options && supp.options["Farce"]) || supp.farce || ""
          });
        }
      } else {
        const qte = entree.quantite || 0;
        if (qte <= 0) continue;
        nouvellesLignes.push({
          produitId, nom: p.nom, typeVente: p.type === "menu" ? "menu" : "unite",
          quantite: qte, prixUnitaire: p.prix || 0, specification: entree.specification || ""
        });
      }
    }

    if (nouvellesLignes.length === 0) {
      afficherToast("Une commande doit contenir au moins un produit", "erreur");
      return;
    }

    try {
      await modifierCommande(c.id, { lignes: nouvellesLignes });
      afficherToast(`Commande ${c.numero} mise a jour`, "succes");
      overlay.remove();
    } catch (e) {
      afficherToast("Erreur : " + e.message, "erreur");
    }
  });
}
// ============================================================
// ÉCRAN : CHIFFRE D'AFFAIRES
// ============================================================

let filtreDashboard = { periodeId: "", dateDebut: "", dateFin: "", magasinId: "" };

function rendreDashboard(conteneur) {
  const periodes = ETAT.parametres.periodes || [];
  conteneur.innerHTML = `
    <div id="ecran-dashboard">
    <div class="filtre-barre carte">
      <div class="champ" style="margin:0;">
        <label>Période événementielle</label>
        <select id="db-periode">
          <option value="">— Toutes / plage de dates —</option>
          ${periodes.map(p => `<option value="${p.id}">${p.nom}</option>`).join("")}
        </select>
      </div>
      <div class="champ" style="margin:0;">
        <label>Du</label>
        <input type="date" id="db-debut">
      </div>
      <div class="champ" style="margin:0;">
        <label>Au</label>
        <input type="date" id="db-fin">
      </div>
      <div class="champ" style="margin:0;">
        <label>Magasin</label>
        <select id="db-magasin">
          <option value="">Tous les magasins</option>
          ${ETAT.parametres.magasins.map(m => `<option value="${m.id}">${m.nom}</option>`).join("")}
        </select>
      </div>
      <button class="btn btn-primaire" id="db-appliquer" style="align-self:flex-end;">Appliquer</button>
    </div>
    <div id="db-resultats"><div class="vide-etat">Choisissez une période ou une plage de dates.</div></div>
  `;

  document.getElementById("db-appliquer").addEventListener("click", () => {
    filtreDashboard = {
      periodeId: document.getElementById("db-periode").value,
      dateDebut: document.getElementById("db-debut").value,
      dateFin: document.getElementById("db-fin").value,
      magasinId: document.getElementById("db-magasin").value
    };
    chargerDashboard();
  });

  if (filtreDashboard.periodeId || filtreDashboard.dateDebut) chargerDashboard();
}

async function chargerDashboard() {
  const conteneur = document.getElementById("db-resultats");
  conteneur.innerHTML = `<div class="vide-etat">Calcul en cours...</div>`;

  try {
    let commandes;
    if (filtreDashboard.periodeId) {
      const baseParams = filtreDashboard.magasinId ? { magasinId: filtreDashboard.magasinId } : {};
      const periodeSelectionnee = (ETAT.parametres.periodes || []).find(p => p.id === filtreDashboard.periodeId);
      const joursSet = new Set(periodeSelectionnee ? (periodeSelectionnee.jours || []) : []);
      commandes = (await recupererCommandesUnique(baseParams))
        .filter(c => c.periodeId === filtreDashboard.periodeId || (joursSet.size > 0 && joursSet.has(c.dateRetrait)));
    } else {
      const baseParams = filtreDashboard.magasinId ? { magasinId: filtreDashboard.magasinId } : {};
      commandes = await recupererCommandesUnique(baseParams);
      if (filtreDashboard.dateDebut || filtreDashboard.dateFin) {
        commandes = commandes.filter(c => {
          if (filtreDashboard.dateDebut && c.dateRetrait < filtreDashboard.dateDebut) return false;
          if (filtreDashboard.dateFin && c.dateRetrait > filtreDashboard.dateFin) return false;
          return true;
        });
      }
    }

    commandes = commandes.filter(c => c.statut !== "annulee");
    afficherDashboard(commandes, conteneur);
  } catch (e) {
    console.error(e);
    conteneur.innerHTML = `<div class="vide-etat">Erreur : ${e.message}</div>`;
  }
}

function afficherDashboard(commandes, conteneur) {
  if (commandes.length === 0) {
    conteneur.innerHTML = `<div class="vide-etat"><div class="icone-vide">💶</div>Aucune commande sur cette sélection.</div>`;
    return;
  }

  let caTotal = 0;
  const caParJour = {};
  const caParMagasin = {};
  const caParProduit = {};
  const caParCategorie = {};
  const commandesParStatut = {};
  const commandesParMagasin = {};

  const statutsListe = (ETAT.parametres && ETAT.parametres.statuts) ? ETAT.parametres.statuts : STATUTS;

  commandes.forEach(c => {
    const totalCommande = (c.lignes || []).reduce((s, l) => s + (l.prixUnitaire || 0) * l.quantite, 0);
    caTotal += totalCommande;
    caParJour[c.dateRetrait] = (caParJour[c.dateRetrait] || 0) + totalCommande;
    caParMagasin[c.magasinId] = (caParMagasin[c.magasinId] || 0) + totalCommande;
    commandesParMagasin[c.magasinId] = (commandesParMagasin[c.magasinId] || 0) + 1;
    commandesParStatut[c.statut] = (commandesParStatut[c.statut] || 0) + 1;

    (c.lignes || []).forEach(l => {
      const montant = (l.prixUnitaire || 0) * l.quantite;
      if (!caParProduit[l.nom]) caParProduit[l.nom] = { quantite: 0, montant: 0 };
      caParProduit[l.nom].quantite += l.quantite;
      caParProduit[l.nom].montant += montant;

      // Catégorie via catalogue
      const produit = ETAT.catalogue.find(p => p.id === l.produitId);
      const cat = produit ? (produit.categorie || "Autre") : "Autre";
      if (!caParCategorie[cat]) caParCategorie[cat] = { quantite: 0, montant: 0 };
      caParCategorie[cat].quantite += l.quantite;
      caParCategorie[cat].montant += montant;
    });
  });

  const topProduits = Object.entries(caParProduit)
    .sort((a, b) => b[1].montant - a[1].montant)
    .slice(0, 10);

  const topCategories = Object.entries(caParCategorie)
    .sort((a, b) => b[1].montant - a[1].montant);

  const joursTries = Object.keys(caParJour).sort();
  const panierMoyen = commandes.length ? caTotal / commandes.length : 0;

  // Barres de statuts
  const maxStatut = Math.max(...Object.values(commandesParStatut), 1);
  const statutsBars = statutsListe
    .filter(s => s.id !== "annulee")
    .map(s => {
      const n = commandesParStatut[s.id] || 0;
      const pct = Math.round((n / maxStatut) * 100);
      return `
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
          <div style="width:110px; font-size:0.82rem; color:var(--charbon-clair); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${s.label}</div>
          <div style="flex:1; height:18px; background:var(--creme-fonce); border-radius:9px; overflow:hidden;">
            <div style="height:100%; width:${pct}%; background:${s.couleur}; border-radius:9px; transition:width 0.4s;"></div>
          </div>
          <div style="width:28px; text-align:right; font-size:0.88rem; font-weight:700;">${n}</div>
        </div>`;
    }).join("");

  conteneur.innerHTML = `
    <div class="grille-kpi">
      <div class="kpi" style="border-top:4px solid #7a1f2b;">
        <div class="label-kpi">CA Total</div>
        <div class="valeur-kpi" style="color:#7a1f2b;">${formaterMontant(caTotal)}</div>
        <div class="sous-valeur">chiffre d'affaires</div>
      </div>
      <div class="kpi" style="border-top:4px solid #b87333;">
        <div class="label-kpi">Commandes</div>
        <div class="valeur-kpi" style="color:#b87333;">${commandes.length}</div>
        <div class="sous-valeur">commandes actives</div>
      </div>
      <div class="kpi" style="border-top:4px solid #2f7a4f;">
        <div class="label-kpi">Panier moyen</div>
        <div class="valeur-kpi" style="color:#2f7a4f;">${formaterMontant(panierMoyen)}</div>
        <div class="sous-valeur">par commande</div>
      </div>
      <div class="kpi" style="border-top:4px solid #3b82f6;">
        <div class="label-kpi">Jours actifs</div>
        <div class="valeur-kpi" style="color:#3b82f6;">${joursTries.length}</div>
        <div class="sous-valeur">jours de retrait</div>
      </div>
    </div>

    <div class="grille-2" style="margin-top:18px;">
      <div class="carte">
        <h3 style="margin-bottom:12px;">Statuts des commandes</h3>
        ${statutsBars || '<p style="color:var(--charbon-clair); font-size:0.85rem;">Aucune donnée.</p>'}
      </div>

      <div class="carte">
        <h3>CA par magasin</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Magasin</th><th>Commandes</th><th>CA</th></tr></thead>
            <tbody>
              ${Object.entries(caParMagasin).sort((a,b)=>b[1]-a[1]).map(([id, montant]) =>
                `<tr><td>${nomMagasin(id)}</td><td style="text-align:center;">${commandesParMagasin[id] || 0}</td><td>${formaterMontant(montant)}</td></tr>`
              ).join("")}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="grille-2" style="margin-top:18px;">
      <div class="carte">
        <h3>CA par jour</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>CA</th></tr></thead>
            <tbody>
              ${joursTries.map(j => `<tr><td>${formaterDate(j)}</td><td>${formaterMontant(caParJour[j])}</td></tr>`).join("")}
            </tbody>
          </table>
        </div>
      </div>

      <div class="carte">
        <h3>CA par catégorie</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Catégorie</th><th>Qté</th><th>CA</th></tr></thead>
            <tbody>
              ${topCategories.map(([cat, d]) => `<tr><td>${cat}</td><td style="text-align:center;">${d.quantite}</td><td>${formaterMontant(d.montant)}</td></tr>`).join("")}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="carte" style="margin-top:18px;">
      <h3>Top 10 produits</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Produit</th><th>Qté</th><th>CA</th></tr></thead>
          <tbody>
            ${topProduits.map(([nom, data]) => `<tr><td>${nom}</td><td>${data.quantite}</td><td>${formaterMontant(data.montant)}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  `;
}

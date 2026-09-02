// ============================================================
// ÉCRAN : ÉTIQUETTES (recherche et impression par produit)
// Permet de retrouver toutes les commandes contenant un produit
// donné (ligne directe uniquement, pas les composants de menus)
// et d'imprimer les étiquettes correspondantes.
// ============================================================

let filtreEtiquettes = {
  produitId: "",
  periodeId: "",
  dateRetrait: "",
  magasinId: ""
};

// Lit/écrit les dimensions d'étiquettes dans sessionStorage
function lireFormatEtiquette() {
  return {
    largeur: parseFloat(sessionStorage.getItem("eventpro_demo_etq_largeur") || "60.80"),
    hauteur:  parseFloat(sessionStorage.getItem("eventpro_demo_etq_hauteur")  || "57.15")
  };
}

function rendreEcranEtiquettes(conteneur) {
  const periodes = ETAT.parametres.periodes || [];
  const produitsAvecEtiquette = ETAT.catalogue.filter(p =>
    p.actif !== false && p.genereEtiquette !== false && p.type !== "menu"
  );
  const fmt = lireFormatEtiquette();

  conteneur.innerHTML = `
    <div class="carte" style="margin-bottom:12px;">
      <details id="etq-format-details">
        <summary style="cursor:pointer; font-weight:600; font-size:0.9rem; color:var(--charbon-clair); list-style:none; display:flex; align-items:center; gap:6px; user-select:none;">
          <span>⚙️</span><span>Format d'étiquettes</span>
          <span id="etq-format-resume" style="font-weight:400; margin-left:4px;">(${fmt.largeur} × ${fmt.hauteur} mm)</span>
        </summary>
        <div style="margin-top:12px;">
          <p style="font-size:0.85rem; color:var(--charbon-clair); margin:0 0 12px 0;">
            Renseignez les dimensions de vos rouleaux d'étiquettes. Le réglage est enregistré dans votre navigateur.
            <br>Format par défaut : Zebra 60,80 × 57,15 mm.
          </p>
          <div style="display:flex; gap:12px; align-items:flex-end; flex-wrap:wrap;">
            <div class="champ" style="margin:0; flex:1; min-width:120px;">
              <label>Largeur (mm)</label>
              <input type="number" id="etq-fmt-largeur" value="${fmt.largeur}" min="20" max="200" step="0.01" style="max-width:120px;">
            </div>
            <div class="champ" style="margin:0; flex:1; min-width:120px;">
              <label>Hauteur (mm)</label>
              <input type="number" id="etq-fmt-hauteur" value="${fmt.hauteur}" min="20" max="200" step="0.01" style="max-width:120px;">
            </div>
            <button class="btn btn-secondaire btn-sm" id="etq-fmt-enregistrer" style="margin-bottom:2px;">Enregistrer</button>
            <button class="btn btn-sm" id="etq-fmt-reset" style="margin-bottom:2px; background:transparent; border:1.5px solid var(--gris-ligne); color:var(--charbon-clair);">Réinitialiser</button>
          </div>
          <div id="etq-fmt-confirmation" style="display:none; margin-top:8px; font-size:0.82rem; color:var(--vert-succes, #16a34a); font-weight:600;">✔ Format enregistré</div>
        </div>
      </details>
    </div>
    <div class="carte" style="margin-bottom:18px;">
      <div class="carte-titre"><h2 style="margin:0;">Impression par produit</h2></div>
      <p class="aide-desktop" style="margin:0 0 16px 0; color:var(--charbon-clair); font-size:0.9rem;">
        Retrouvez toutes les commandes contenant un produit et imprimez uniquement les étiquettes de ce produit.
        <br>Remarque : les produits commandés en tant que composant d'un menu n'apparaissent pas ici.
      </p>
      <div class="champ" style="margin-bottom:12px;">
        <label>Produit *</label>
        <input type="text" id="etq-produit-search" placeholder="🔎 Tapez pour filtrer la liste..." autocomplete="off"
          value="${filtreEtiquettes.produitId ? (produitsAvecEtiquette.find(p=>p.id===filtreEtiquettes.produitId)||{nom:''}).nom : ''}"
          style="margin-bottom:4px;">
        <select id="etq-produit" size="5" style="height:auto;">
          ${produitsAvecEtiquette.map(p => `<option value="${p.id}" ${filtreEtiquettes.produitId === p.id ? 'selected' : ''}>${p.nom}</option>`).join("")}
        </select>
      </div>
      <div class="grille-2">
        <div class="champ">
          <label>Période</label>
          <select id="etq-periode">
            <option value="">— Ou choisir une date —</option>
            ${periodes.map(p => `<option value="${p.id}" ${filtreEtiquettes.periodeId === p.id ? 'selected' : ''}>${p.nom}</option>`).join("")}
          </select>
        </div>
        <div class="champ">
          <label>Date de retrait</label>
          <input type="date" id="etq-date" value="${filtreEtiquettes.dateRetrait}" ${filtreEtiquettes.periodeId ? 'disabled style="opacity:0.5;"' : ''}>
        </div>
      </div>
      <div class="grille-2" style="margin-top:4px;">
        <div class="champ">
          <label>Magasin (optionnel)</label>
          <select id="etq-magasin">
            <option value="">Tous les magasins</option>
            ${ETAT.parametres.magasins.map(m => `<option value="${m.id}" ${filtreEtiquettes.magasinId === m.id ? 'selected' : ''}>${m.nom}</option>`).join("")}
          </select>
        </div>
        <div style="display:flex; align-items:flex-end;">
          <button class="btn btn-primaire" id="etq-rechercher" style="width:100%;">🔎 Rechercher</button>
        </div>
      </div>
    </div>
    <div id="etq-resultats"></div>
  `;

  // ── Listeners format d'étiquettes ──
  document.getElementById("etq-fmt-enregistrer").addEventListener("click", () => {
    const l = parseFloat(document.getElementById("etq-fmt-largeur").value);
    const h = parseFloat(document.getElementById("etq-fmt-hauteur").value);
    if (isNaN(l) || isNaN(h) || l < 20 || h < 20) {
      afficherToast("Dimensions invalides (min. 20 mm)", "erreur"); return;
    }
    sessionStorage.setItem("eventpro_demo_etq_largeur", l.toFixed(2));
    sessionStorage.setItem("eventpro_demo_etq_hauteur",  h.toFixed(2));
    const resume = document.getElementById("etq-format-resume");
    if (resume) resume.textContent = `(${l.toFixed(2)} × ${h.toFixed(2)} mm)`;
    const conf = document.getElementById("etq-fmt-confirmation");
    if (conf) { conf.style.display = "block"; setTimeout(() => { conf.style.display = "none"; }, 2500); }
  });
  document.getElementById("etq-fmt-reset").addEventListener("click", () => {
    sessionStorage.removeItem("eventpro_demo_etq_largeur");
    sessionStorage.removeItem("eventpro_demo_etq_hauteur");
    document.getElementById("etq-fmt-largeur").value = "60.80";
    document.getElementById("etq-fmt-hauteur").value  = "57.15";
    const resume = document.getElementById("etq-format-resume");
    if (resume) resume.textContent = "(60.80 × 57.15 mm)";
    afficherToast("Format réinitialisé (Zebra 60.80 × 57.15 mm)", "succes");
  });

  const selectPeriode = document.getElementById("etq-periode");
  const inputDate = document.getElementById("etq-date");

  selectPeriode.addEventListener("change", e => {
    filtreEtiquettes.periodeId = e.target.value;
    if (e.target.value) {
      inputDate.disabled = true;
      inputDate.style.opacity = "0.5";
      filtreEtiquettes.dateRetrait = "";
      inputDate.value = "";
    } else {
      inputDate.disabled = false;
      inputDate.style.opacity = "1";
    }
  });

  inputDate.addEventListener("change", e => {
    filtreEtiquettes.dateRetrait = e.target.value;
    if (e.target.value) {
      selectPeriode.value = "";
      filtreEtiquettes.periodeId = "";
    }
  });

  // Barre de recherche : filtre la liste en temps réel (insensible aux accents)
  const normaliser = s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  document.getElementById("etq-produit-search").addEventListener("input", e => {
    const q = normaliser(e.target.value.trim());
    const sel = document.getElementById("etq-produit");
    Array.from(sel.options).forEach(opt => {
      opt.hidden = !(!q || normaliser(opt.text).includes(q));
    });
    // Si la sélection actuelle est masquée, désélectionner
    if (sel.selectedIndex >= 0 && sel.options[sel.selectedIndex] && sel.options[sel.selectedIndex].hidden) {
      sel.value = "";
      filtreEtiquettes.produitId = "";
    }
  });

  // Sélection dans la liste : mettre à jour le champ de recherche
  document.getElementById("etq-produit").addEventListener("change", e => {
    filtreEtiquettes.produitId = e.target.value;
    const opt = e.target.options[e.target.selectedIndex];
    if (opt) document.getElementById("etq-produit-search").value = opt.text;
  });

  document.getElementById("etq-magasin").addEventListener("change", e => {
    filtreEtiquettes.magasinId = e.target.value;
  });

  document.getElementById("etq-rechercher").addEventListener("click", () => {
    const sel = document.getElementById("etq-produit");
    filtreEtiquettes.produitId = sel.value;
    filtreEtiquettes.periodeId = document.getElementById("etq-periode").value;
    filtreEtiquettes.dateRetrait = document.getElementById("etq-date").value;
    filtreEtiquettes.magasinId = document.getElementById("etq-magasin").value;
    rechercherEtiquettes();
  });

  // Si un filtre était déjà en place (retour sur l'écran), relancer la recherche
  if (filtreEtiquettes.produitId && (filtreEtiquettes.periodeId || filtreEtiquettes.dateRetrait)) {
    rechercherEtiquettes();
  }
}

async function rechercherEtiquettes() {
  const zone = document.getElementById("etq-resultats");
  if (!zone) return;

  const { produitId, periodeId, dateRetrait, magasinId } = filtreEtiquettes;

  if (!produitId) {
    zone.innerHTML = `<div class="vide-etat">Choisissez un produit pour lancer la recherche.</div>`;
    return;
  }
  if (!periodeId && !dateRetrait) {
    zone.innerHTML = `<div class="vide-etat">Choisissez une période ou une date de retrait.</div>`;
    return;
  }

  zone.innerHTML = `<div class="vide-etat">Recherche en cours...</div>`;

  try {
    let commandes;
    if (periodeId) {
      const baseParams = magasinId ? { magasinId } : {};
      commandes = (await recupererCommandesUnique(baseParams))
        .filter(c => c.periodeId === periodeId);
    } else {
      const params = { dateRetrait };
      if (magasinId) params.magasinId = magasinId;
      commandes = await recupererCommandesUnique(params);
    }

    // Ne garder que les commandes qui ont une ligne DIRECTE sur ce produit
    // (pas les composants de menus — genererEtiquettesCommande ne sait pas
    // les imprimer séparément).
    const commandesConcernees = commandes.filter(c =>
      (c.lignes || []).some(l => l.produitId === produitId)
    );

    afficherResultatsEtiquettes(commandesConcernees, produitId);
  } catch (e) {
    console.error(e);
    zone.innerHTML = `<div class="vide-etat">Erreur : ${e.message}</div>`;
  }
}

function afficherResultatsEtiquettes(commandes, produitId) {
  const zone = document.getElementById("etq-resultats");
  if (!zone) return;

  const produit = ETAT.catalogue.find(p => p.id === produitId);
  const nomProduit = produit ? produit.nom : produitId;

  if (commandes.length === 0) {
    zone.innerHTML = `
      <div class="vide-etat">
        <div class="icone-vide">🏷️</div>
        Aucune commande avec « ${nomProduit} » pour cette sélection.
      </div>
    `;
    return;
  }

  // Compter le nombre total d'étiquettes à imprimer pour ce produit
  let totalEtiquettes = 0;
  commandes.forEach(c => {
    (c.lignes || []).forEach(l => {
      if (l.produitId !== produitId) return;
      if (l.typeVente === "poids" || l.typeVente === "pierrade") {
        totalEtiquettes += 1;
      } else {
        totalEtiquettes += (l.quantite || 1);
      }
    });
  });

  zone.innerHTML = `
    <div class="carte">
      <div class="carte-titre">
        <h3 style="margin:0;" id="etq-compteur">
          ${commandes.length} commande${commandes.length > 1 ? "s" : ""} sélectionnées — ${totalEtiquettes} étiquette${totalEtiquettes > 1 ? "s" : ""}
        </h3>
        <button class="btn btn-cuivre" id="etq-imprimer-btn">🏷️ Imprimer la sélection</button>
      </div>
      <div class="table-wrap" style="margin-top:12px;">
        <table>
          <thead>
            <tr>
              <th style="width:36px; text-align:center;">
                <input type="checkbox" id="etq-select-all" checked title="Tout sélectionner / désélectionner"
                  style="width:auto; min-height:auto; cursor:pointer;">
              </th>
              <th>N°</th>
              <th>Client</th>
              <th>Magasin</th>
              <th>Retrait</th>
              <th>Qté ${nomProduit}</th>
              <th>Spécification</th>
            </tr>
          </thead>
          <tbody>
            ${commandes.map(c => lignesEtiquettesCommandeHTML(c, produitId)).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Mettre à jour le compteur selon les cases cochées
  function majCompteurEtq() {
    const total = document.querySelectorAll(".etq-select-row").length;
    const selectionnes = document.querySelectorAll(".etq-select-row:checked").length;
    const compteur = document.getElementById("etq-compteur");
    if (compteur) {
      compteur.textContent = selectionnes + " / " + total + " commande" + (total > 1 ? "s" : "") + " sélectionnée" + (selectionnes > 1 ? "s" : "");
    }
    // Synchroniser la checkbox "Tout"
    const selectAll = document.getElementById("etq-select-all");
    if (selectAll) selectAll.checked = selectionnes === total;
  }

  // Checkbox "Tout sélectionner" dans l'en-tête
  document.getElementById("etq-select-all").addEventListener("change", e => {
    document.querySelectorAll(".etq-select-row").forEach(cb => { cb.checked = e.target.checked; });
    majCompteurEtq();
  });

  // Checkboxes individuelles
  document.querySelectorAll(".etq-select-row").forEach(cb => {
    cb.addEventListener("change", majCompteurEtq);
  });

  // Bouton imprimer : uniquement les lignes sélectionnées
  document.getElementById("etq-imprimer-btn").addEventListener("click", () => {
    const selection = {};
    document.querySelectorAll(".etq-select-row:checked").forEach(cb => {
      const cmdId = cb.dataset.cmdId;
      const idx = parseInt(cb.dataset.ligneIdx);
      if (!selection[cmdId]) selection[cmdId] = new Set();
      selection[cmdId].add(idx);
    });
    const commandesFiltrees = commandes
      .filter(c => selection[c.id])
      .map(c => ({ ...c, lignes: (c.lignes || []).filter((l, i) => selection[c.id].has(i)) }));
    if (commandesFiltrees.length === 0) {
      afficherToast("Aucune commande sélectionnée", "erreur");
      return;
    }
    imprimerEtiquettesProduit(commandesFiltrees, produitId);
  });
}


function lignesEtiquettesCommandeHTML(commande, produitId) {
  // Une ligne par ligne de commande concernant ce produit
  // On conserve l'index réel dans c.lignes pour la sélection à l'impression
  const lignesConcernees = (commande.lignes || [])
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => l.produitId === produitId);
  return lignesConcernees.map(({ l, i }) => {
    const qte = l.typeVente === "poids"
      ? (l.poidsKg || 0).toLocaleString("fr-FR") + " kg"
      : l.typeVente === "pierrade"
        ? l.quantite + " pers."
        : String(l.quantite);
    const spec = l.specification ? `<span style="color:var(--cuivre); font-weight:600;">${l.specification}</span>` : "—";
    return `
      <tr>
        <td style="text-align:center;">
          <input type="checkbox" class="etq-select-row" checked
            data-cmd-id="${commande.id}" data-ligne-idx="${i}"
            style="width:auto; min-height:auto; cursor:pointer;">
        </td>
        <td><strong style="font-family:var(--font-mono);">${commande.numero}</strong></td>
        <td>${commande.client}</td>
        <td>${nomMagasin(commande.magasinId)}</td>
        <td>${formaterDate(commande.dateRetrait)}</td>
        <td><strong>${qte}</strong></td>
        <td>${spec}</td>
      </tr>
    `;
  }).join("");
}

/**
 * Imprime uniquement les étiquettes du produit sélectionné pour un ensemble
 * de commandes.
 */
async function imprimerEtiquettesProduit(commandes, produitId) {
  const parametres = await recupererParametres();
  const configEtiquettes = parametres.configEtiquettes || CONFIG_ETIQUETTES_DEFAUT;

  let toutesEtiquettes = [];

  commandes.forEach(c => {
    const commandeReduite = {
      ...c,
      lignes: (c.lignes || []).filter(l => l.produitId === produitId)
    };
    if (commandeReduite.lignes.length > 0) {
      toutesEtiquettes = toutesEtiquettes.concat(
        genererEtiquettesCommande(commandeReduite, configEtiquettes)
      );
    }
  });

  if (toutesEtiquettes.length === 0) {
    afficherToast("Aucune étiquette à imprimer pour ce produit", "erreur");
    return;
  }

  let zone = document.getElementById("zone-impression-dediee");
  if (zone) zone.remove();
  zone = document.createElement("div");
  zone.id = "zone-impression-dediee";
  zone.className = "zone-impression-dediee zone-etiquettes";
  zone.innerHTML = toutesEtiquettes.join("");
  document.body.appendChild(zone);
  document.body.classList.add("mode-impression-dediee");

  let stylePageEtiquette = document.getElementById("style-page-etiquette");
  if (!stylePageEtiquette) {
    stylePageEtiquette = document.createElement("style");
    stylePageEtiquette.id = "style-page-etiquette";
    document.head.appendChild(stylePageEtiquette);
  }
  const etqL = parseFloat(sessionStorage.getItem("eventpro_demo_etq_largeur") || "60.80").toFixed(2);
  const etqH = parseFloat(sessionStorage.getItem("eventpro_demo_etq_hauteur")  || "57.15").toFixed(2);
  stylePageEtiquette.textContent = `@page { size: ${etqL}mm ${etqH}mm; margin: 0; } .etiquette { width: ${etqL}mm !important; height: ${etqH}mm !important; }`;

  function nettoyer() {
    window.removeEventListener("afterprint", nettoyer);
    document.body.classList.remove("mode-impression-dediee");
    zone.remove();
    stylePageEtiquette.textContent = "";
  }
  window.addEventListener("afterprint", nettoyer);
  setTimeout(() => window.print(), 200);
}

// ============================================================
// ÉCRAN : NOUVELLE COMMANDE
// Objectif : saisie complète en moins de 30 secondes
// ============================================================

// panierCourant: produitId -> { quantite, poidsKg, personnesNature, personnesMarinee, specification }
// (les champs utilisés dépendent du type de produit : simple/menu utilisent
// quantite, "poids" utilise poidsKg, "pierrade" utilise personnesNature/personnesMarinee)
let panierCourant = {};

// lignesLibres: articles "Autre" saisis librement par le salarié
// Chaque entrée : { id (uuid local), nom, prix, quantite, specification }
let lignesLibres = [];

// Catégories repliées dans la grille produits (persistantes pendant la saisie)
let categoriesCollapsees = new Set();

function rendreNouvelleCommande(conteneur) {
  panierCourant = {};
  lignesLibres = [];
  categoriesCollapsees = new Set();
  const periodes = ETAT.parametres.periodes || [];
  const aujourdHui = new Date().toISOString().slice(0, 10);
  const magasinParDefaut = ETAT.utilisateur.magasinId || "";

  conteneur.innerHTML = `
    <div class="carte" style="margin-bottom:18px;">
      <div class="carte-titre aide-desktop"><h2 style="margin:0;">Nouvelle commande</h2></div>
      <div class="grille-3">
        <div class="champ">
          <label>Magasin *</label>
          <select id="nc-magasin">
            <option value="">— Choisir —</option>
            ${ETAT.parametres.magasins.map(m => `<option value="${m.id}" ${m.id === magasinParDefaut ? 'selected' : ''}>${m.nom}</option>`).join("")}
          </select>
        </div>
        <div class="champ">
          <label>Période événementielle</label>
          <select id="nc-periode">
            <option value="">Aucune (vente courante)</option>
            ${periodes.map(p => `<option value="${p.id}">${p.nom}</option>`).join("")}
          </select>
        </div>
        <div class="champ">
          <label>Date de retrait *</label>
          <select id="nc-date-choix" style="display:none;"></select>
          <input type="date" id="nc-date" value="${aujourdHui}">
        </div>
      </div>
      <div class="grille-3">
        <div class="champ">
          <label>Nom du client *</label>
          <input type="text" id="nc-client" placeholder="Nom / Prénom">
        </div>
        <div class="champ">
          <label>Téléphone</label>
          <input type="tel" id="nc-telephone" placeholder="06 12 34 56 78">
        </div>
        <div class="champ">
          <label>Email client</label>
          <input type="email" id="nc-email" placeholder="client@exemple.com">
        </div>
      </div>

      ${(() => {
        const insVisibles = (ETAT.parametres.instructionsCommande || INSTRUCTIONS_PREPARATION).filter(ins => ins.visibleNC !== false);
        if (insVisibles.length === 0) return "";
        return `<div class="champ">
          <label>Instructions de préparation</label>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            ${insVisibles.map(ins => `
              <div class="checkbox-instruction" data-instruction="${ins.id}">
                <span>${ins.icone}</span><span>${ins.label}</span>
              </div>
            `).join("")}
          </div>
        </div>`;
      })()}

      <div class="champ">
        <label>Remarques client</label>
        <textarea id="nc-remarques" placeholder="Allergies, demandes particulières..."></textarea>
      </div>
    </div>

    <div class="carte">
      <div class="carte-titre">
        <h2 style="margin:0;">Produits</h2>
        <input type="search" id="nc-recherche" placeholder="🔎 Rechercher un produit..." style="max-width:260px; min-height:40px; padding:8px 12px; border:2px solid var(--gris-ligne); border-radius:20px;">
      </div>
      <div class="grille-categories" id="nc-grille-categories"></div>
    </div>

    <div class="panier-flottant" id="nc-panier">
      <div class="resume">
        <span id="nc-nb-articles">0 article</span>
        <span class="montant" id="nc-montant-total">0,00 €</span>
      </div>
      <button class="btn btn-cuivre btn-lg" id="nc-valider">Valider la commande</button>
    </div>
  `;

  document.querySelectorAll(".checkbox-instruction").forEach(el => {
    el.addEventListener("click", () => el.classList.toggle("coche"));
  });

  // Période événementielle -> propose les jours disponibles, sinon champ date libre
  document.getElementById("nc-periode").addEventListener("change", (e) => {
    const periode = periodes.find(p => p.id === e.target.value);
    const champDate = document.getElementById("nc-date");
    const champChoixDate = document.getElementById("nc-date-choix");
    if (periode && periode.jours && periode.jours.length > 0) {
      champChoixDate.innerHTML = periode.jours.map(j => `<option value="${j}">${formaterDate(j)}</option>`).join("");
      champChoixDate.style.display = "block";
      champDate.style.display = "none";
    } else {
      champChoixDate.style.display = "none";
      champDate.style.display = "block";
    }
  });

  afficherGrilleProduits(ETAT.catalogue, "");

  document.getElementById("nc-recherche").addEventListener("input", (e) => {
    const terme = e.target.value.toLowerCase();
    const filtres = ETAT.catalogue.filter(p =>
      p.actif !== false && p.nom.toLowerCase().includes(terme)
    );
    afficherGrilleProduits(filtres, terme);
  });

  document.getElementById("nc-valider").addEventListener("click", () => validerNouvelleCommande());
}

function afficherGrilleProduits(produits, terme) {
  const conteneur = document.getElementById("nc-grille-categories");
  const parCategorie = {};
  produits.forEach(p => {
    if (p.actif === false) return;
    if (!parCategorie[p.categorie]) parCategorie[p.categorie] = [];
    parCategorie[p.categorie].push(p);
  });

  const _ordreActuel = obtenirOrdreCategories();
  const categoriesOrdonnees = _ordreActuel.filter(c => parCategorie[c]).concat(
    Object.keys(parCategorie).filter(c => !_ordreActuel.includes(c))
  );

  if (categoriesOrdonnees.length === 0) {
    conteneur.innerHTML = `<div class="vide-etat"><div class="icone-vide">🔍</div>Aucun produit trouvé.</div>`;
    return;
  }

  // Les deux pierrades (Nature/Marinée) sont fusionnées en une seule carte
  // spéciale dans la catégorie "Pierrade", car elles partagent le même
  // plateau et la même limite de 6 personnes.
  // Si une recherche est active, tout déplier pour voir les résultats
  if (terme) categoriesCollapsees.clear();

  conteneur.innerHTML = categoriesOrdonnees.map(cat => {
    const replie = categoriesCollapsees.has(cat);
    const grille = cat === "Pierrade"
      ? `<div class="grille-produits" style="grid-template-columns:1fr;">${carteProduitPierradeHTML()}</div>`
      : `<div class="grille-produits">${parCategorie[cat].map(p => carteProduitHTML(p)).join("")}</div>`;
    return `
      <div class="bloc-categorie">
        <h3 class="cat-toggle" data-cat="${cat}" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center; user-select:none;">
          <span>${cat}</span>
          <span class="cat-fleche" style="font-size:1rem; color:var(--bordeaux); transition:transform 0.2s; transform:${replie ? 'rotate(-90deg)' : 'rotate(0deg)'};">▼</span>
        </h3>
        <div class="cat-contenu" data-cat-contenu="${cat}" style="${replie ? 'display:none;' : ''}">
          ${grille}
        </div>
      </div>
    `;
  }).join("");

  // Accordéon : toggle au clic sur le titre
  conteneur.querySelectorAll(".cat-toggle").forEach(h3 => {
    h3.addEventListener("click", () => {
      const cat = h3.dataset.cat;
      const contenu = conteneur.querySelector(`[data-cat-contenu="${cat}"]`);
      const fleche = h3.querySelector(".cat-fleche");
      const estOuvert = contenu.style.display !== "none";
      contenu.style.display = estOuvert ? "none" : "";
      fleche.style.transform = estOuvert ? "rotate(-90deg)" : "rotate(0deg)";
      if (estOuvert) categoriesCollapsees.add(cat);
      else categoriesCollapsees.delete(cat);
    });
  });

  conteneur.querySelectorAll(".stepper button[data-produit]").forEach(btn => {
    btn.addEventListener("click", () => {
      const produitId = btn.dataset.produit;
      const delta = parseInt(btn.dataset.delta, 10);
      changerQuantitePanier(produitId, delta);
    });
  });

  conteneur.querySelectorAll(".stepper input[data-input-produit]").forEach(input => {
    input.addEventListener("change", () => {
      const produitId = input.dataset.inputProduit;
      const valSaisie = Math.max(0, parseInt(input.value, 10) || 0);
      const actuel = (panierCourant[produitId] && panierCourant[produitId].quantite) || 0;
      changerQuantitePanier(produitId, valSaisie - actuel);
    });
  });

  conteneur.querySelectorAll("[data-poids-produit]").forEach(input => {
    input.addEventListener("input", (e) => {
      changerPoidsPanier(input.dataset.poidsProduit, parseFloat(e.target.value) || 0);
    });
  });

  conteneur.querySelectorAll(".stepper button[data-pierrade-type]").forEach(btn => {
    btn.addEventListener("click", () => {
      changerPersonnesPierrade(btn.dataset.pierradeType, parseInt(btn.dataset.delta, 10));
    });
  });

  conteneur.querySelectorAll(".stepper input[data-input-pierrade]").forEach(input => {
    input.addEventListener("change", () => {
      const produitId = input.dataset.inputPierrade;
      const valSaisie = Math.max(0, parseInt(input.value, 10) || 0);
      const actuel = (panierCourant[produitId] && panierCourant[produitId].quantite) || 0;
      changerPersonnesPierrade(produitId, valSaisie - actuel);
    });
  });

  conteneur.querySelectorAll("[data-specification-btn]").forEach(btn => {
    btn.addEventListener("click", () => basculerZoneSpecification(btn.dataset.specificationBtn));
  });

  conteneur.querySelectorAll("[data-specification-texte]").forEach(input => {
    input.addEventListener("input", (e) => {
      definirSpecification(input.dataset.specificationTexte, e.target.value);
    });
  });

  // Boutons options personnalisées : sélection par produit+groupe
  conteneur.querySelectorAll("[data-option-produit]").forEach(btn => {
    btn.addEventListener("click", () => {
      const produitId = btn.dataset.optionProduit;
      const groupe = btn.dataset.optionGroupe;
      const valeur = btn.dataset.optionValeur;
      if (!panierCourant[produitId]) panierCourant[produitId] = {};
      if (!panierCourant[produitId].options) panierCourant[produitId].options = {};
      panierCourant[produitId].options[groupe] = valeur;
      document.querySelectorAll(`[data-options-zone="${produitId}"][data-options-groupe="${groupe}"] [data-option-produit]`).forEach(b => {
        const actif = b.dataset.optionValeur === valeur;
        b.style.borderColor = actif ? "var(--bordeaux)" : "var(--gris-ligne)";
        b.style.background = actif ? "var(--creme-fonce)" : "white";
        b.style.fontWeight = actif ? "700" : "400";
      });
    });
  });

  // Listeners multi-variante (lignes supplementaires)
  attacherListeneursMultiVarianteSupp(conteneur);

  // Bloc "Autre" : articles libres toujours affichés en bas (pas filtrable par recherche)
  const zoneAutre = document.createElement("div");
  zoneAutre.id = "nc-bloc-autre";
  conteneur.appendChild(zoneAutre);
  rendreZoneAutre();
}

// ------------------------------------------------------------
// CATÉGORIE "AUTRE" — articles libres (nom + prix + qté)
// ------------------------------------------------------------

function rendreZoneAutre() {
  const zone = document.getElementById("nc-bloc-autre");
  if (!zone) return;
  zone.innerHTML = `
    <div class="bloc-categorie">
      <h3>Autre <span style="font-size:0.8rem; font-weight:400; color:var(--charbon-clair);">(article personnalisé)</span></h3>
      <div id="nc-lignes-libres">
        ${lignesLibres.map((l, i) => ligneLibreHTML(l, i)).join("")}
      </div>
      <button type="button" class="btn btn-fantome btn-sm" id="nc-ajouter-libre" style="margin-top:8px;">+ Ajouter un article personnalisé</button>
    </div>
  `;
  document.getElementById("nc-ajouter-libre").addEventListener("click", () => {
    lignesLibres.push({ id: Date.now().toString(36), nom: "", prix: 0, quantite: 1, specification: "" });
    rendreZoneAutre();
    mettreAJourResumePanier();
  });
  zone.querySelectorAll("[data-libre-supprimer]").forEach(btn => {
    btn.addEventListener("click", () => {
      lignesLibres.splice(parseInt(btn.dataset.libreSupprimer), 1);
      rendreZoneAutre();
      mettreAJourResumePanier();
    });
  });
  zone.querySelectorAll("[data-libre-nom]").forEach(input => {
    input.addEventListener("input", e => {
      lignesLibres[parseInt(input.dataset.libreNom)].nom = e.target.value.trim();
    });
  });
  zone.querySelectorAll("[data-libre-prix]").forEach(input => {
    input.addEventListener("input", e => {
      lignesLibres[parseInt(input.dataset.librePrix)].prix = parseFloat(e.target.value) || 0;
      mettreAJourResumePanier();
    });
  });
  zone.querySelectorAll("[data-libre-qte]").forEach(input => {
    input.addEventListener("input", e => {
      lignesLibres[parseInt(input.dataset.libreQte)].quantite = Math.max(1, parseInt(e.target.value) || 1);
      mettreAJourResumePanier();
    });
  });
  zone.querySelectorAll("[data-libre-spec]").forEach(input => {
    input.addEventListener("input", e => {
      lignesLibres[parseInt(input.dataset.libreSpec)].specification = e.target.value.trim();
    });
  });
}

async function sauvegarderArticlesLibresDansCatalogue() {
  if (!lignesLibres.length) return;
  const catalogue = await recupererCatalogue();
  const articlesAutre = catalogue.filter(p => p.categorie === "Autre");
  let modifie = false;
  for (const l of lignesLibres) {
    if (!l.nom) continue;
    const existe = articlesAutre.some(p => p.nom.toLowerCase() === l.nom.toLowerCase());
    if (!existe) {
      const id = "libre_" + l.nom.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").slice(0, 40);
      await enregistrerProduit({
        id, nom: l.nom, categorie: "Autre", prix: l.prix || 0,
        type: "simple", imprimerDans: "traiteur", actif: true, genereEtiquette: false
      });
      await ajouterAuditLog("ajout_article_catalogue", `Article libre "${l.nom}" auto-ajouté au catalogue (catégorie Autre)`);
      modifie = true;
    }
  }
  if (modifie) {
    ETAT.catalogue = await recupererCatalogue();
  }
}

function ligneLibreHTML(l, i) {
  return `
    <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:10px; align-items:flex-start; background:var(--creme-fonce); border-radius:var(--radius-sm); padding:10px;">
      <div style="flex:3; min-width:150px;">
        <label style="font-size:0.78rem; color:var(--charbon-clair);">Désignation *</label>
        <input type="text" data-libre-nom="${i}" value="${l.nom}" placeholder="Ex: Foie gras maison" style="width:100%; min-height:36px; padding:6px 10px; border:1px solid var(--gris-ligne); border-radius:6px; font-size:0.88rem;">
      </div>
      <div style="flex:1; min-width:80px;">
        <label style="font-size:0.78rem; color:var(--charbon-clair);">Prix (€)</label>
        <input type="number" min="0" step="0.01" data-libre-prix="${i}" value="${l.prix || ""}" placeholder="0.00" style="width:100%; min-height:36px; padding:6px 10px; border:1px solid var(--gris-ligne); border-radius:6px; font-size:0.88rem;">
      </div>
      <div style="flex:1; min-width:60px;">
        <label style="font-size:0.78rem; color:var(--charbon-clair);">Qté</label>
        <input type="number" min="1" step="1" data-libre-qte="${i}" value="${l.quantite}" style="width:100%; min-height:36px; padding:6px 10px; border:1px solid var(--gris-ligne); border-radius:6px; font-size:0.88rem;">
      </div>
      <div style="flex:3; min-width:150px;">
        <label style="font-size:0.78rem; color:var(--charbon-clair);">Spécification</label>
        <input type="text" data-libre-spec="${i}" value="${l.specification}" placeholder="Optionnel" style="width:100%; min-height:36px; padding:6px 10px; border:1px solid var(--gris-ligne); border-radius:6px; font-size:0.88rem;">
      </div>
      <button type="button" class="btn btn-fantome btn-sm" data-libre-supprimer="${i}" style="margin-top:20px;">✕</button>
    </div>
  `;
}

function zoneOptionsPersonnaliseesHTML(produit) {
  const opts = obtenirOptionsPersonnalisees(produit);
  if (opts.length === 0) return "";
  const optionsActuelles = (panierCourant[produit.id] && panierCourant[produit.id].options) || {};
  return opts.map(groupe => {
    const actuelle = optionsActuelles[groupe.nom] !== undefined ? optionsActuelles[groupe.nom] : groupe.valeurs[0];
    return `
      <div class="zone-farce" data-options-zone="${produit.id}" data-options-groupe="${groupe.nom}" style="margin-top:6px; display:flex; flex-wrap:wrap; gap:5px; align-items:center;">
        <span style="font-size:0.78rem; color:var(--charbon-clair); font-weight:600; white-space:nowrap;">${groupe.nom} :</span>
        ${groupe.valeurs.map(opt => `
          <button type="button" data-option-produit="${produit.id}" data-option-groupe="${groupe.nom}" data-option-valeur="${opt}"
            style="padding:2px 10px; border-radius:20px; font-size:0.8rem; cursor:pointer; font-family:inherit;
              border:2px solid ${opt === actuelle ? 'var(--bordeaux)' : 'var(--gris-ligne)'};
              background:${opt === actuelle ? 'var(--creme-fonce)' : 'white'};
              font-weight:${opt === actuelle ? '700' : '400'};">
            ${opt}
          </button>
        `).join("")}
      </div>
    `;
  }).join("");
}

function zoneSpecificationHTML(produitId) {
  const valeurActuelle = (panierCourant[produitId] && panierCourant[produitId].specification) || "";
  return `
    <button type="button" class="btn btn-fantome btn-sm" data-specification-btn="${produitId}" style="margin-top:6px; font-size:0.78rem; padding:4px 10px; min-height:auto;">
      ${valeurActuelle ? "✏️ Spécification : " + valeurActuelle : "+ Spécification"}
    </button>
    <div data-zone-specification="${produitId}" style="display:none; margin-top:6px;">
      <input type="text" data-specification-texte="${produitId}" value="${valeurActuelle}" placeholder="Ex: sans porc, sans boudin..." style="width:100%; min-height:36px; padding:6px 10px; border:1px solid var(--gris-ligne); border-radius:6px; font-size:0.85rem;">
    </div>
  `;
}

// ============================================================
// MULTI-VARIANTE : lignes supplementaires pour produits au poids
// (la 1ere ligne garde son affichage normal ; on ajoute des lignes en dessous)
// ============================================================

function suppLigneOrdinal(n) {
  if (n === 2) return "2ème";
  if (n === 3) return "3ème";
  return n + "ème";
}

function suppLigneOptionsHTML(produit, idx) {
  var opts = obtenirOptionsPersonnalisees(produit);
  if (opts.length === 0) return "";
  var lignesSupp = (panierCourant[produit.id] && panierCourant[produit.id].lignesSupp) || [];
  var optionsActuelles = (lignesSupp[idx] && lignesSupp[idx].options) || {};
  return opts.map(function(groupe) {
    var actuelle = optionsActuelles[groupe.nom] !== undefined ? optionsActuelles[groupe.nom] : groupe.valeurs[0];
    var parts = [];
    parts.push('<div style="margin-top:6px; display:flex; flex-wrap:wrap; gap:5px; align-items:center;">');
    parts.push('<span style="font-size:0.78rem; color:var(--charbon-clair); font-weight:600; white-space:nowrap;">' + groupe.nom + ' :</span>');
    groupe.valeurs.forEach(function(opt) {
      var actif = opt === actuelle;
      parts.push('<button type="button" class="supp-option-btn"'
        + ' data-supp-produit="' + produit.id + '"'
        + ' data-supp-idx="' + idx + '"'
        + ' data-supp-groupe="' + groupe.nom + '"'
        + ' data-supp-option="' + opt + '"'
        + ' style="padding:2px 10px; border-radius:20px; font-size:0.8rem; cursor:pointer; font-family:inherit;'
        + ' border:2px solid ' + (actif ? 'var(--bordeaux)' : 'var(--gris-ligne)') + '; background:' + (actif ? 'var(--creme-fonce)' : 'white') + '; font-weight:' + (actif ? '700' : '400') + ';">'
        + opt + '</button>');
    });
    parts.push('</div>');
    return parts.join("");
  }).join("");
}
function suppLigneSpecHTML(produitId, idx, valeur) {
  valeur = valeur || "";
  var label = valeur ? "✏️ Spécification : " + valeur : "+ Spécification";
  var zoneId = produitId + "-" + idx;
  return '<button type="button" class="btn btn-fantome btn-sm supp-spec-btn"'
    + ' data-supp-produit="' + produitId + '" data-supp-idx="' + idx + '"'
    + ' style="margin-top:6px; font-size:0.78rem; padding:4px 10px; min-height:auto;">'
    + label + '</button>'
    + '<div class="supp-spec-zone" data-supp-spec-zone="' + zoneId + '" style="display:none; margin-top:6px;">'
    + '<input type="text" class="supp-spec-input"'
    + ' data-supp-produit="' + produitId + '" data-supp-idx="' + idx + '"'
    + ' value="' + valeur + '" placeholder="Ex : sans porc, sans boudin..."'
    + ' style="width:100%; min-height:36px; padding:6px 10px; border:1px solid var(--gris-ligne); border-radius:6px; font-size:0.85rem;"></div>';
}

function zoneMultiVarianteSuppHTML(produit) {
  var entree = panierCourant[produit.id] || {};
  var lignesSupp = entree.lignesSupp || [];
  var html = '<div data-mv-supp-zone="' + produit.id + '">';
  for (var si = 0; si < lignesSupp.length; si++) {
    var l = lignesSupp[si];
    html += '<div class="mv-supp-ligne" style="border-top:1px dashed var(--gris-ligne); margin-top:10px; padding-top:10px;">';
    html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">';
    html += '<span style="font-size:0.82rem; font-weight:600; color:var(--charbon-clair);">' + suppLigneOrdinal(si + 2) + ' viande</span>';
    html += '<button type="button" class="supp-suppr-btn btn btn-fantome btn-sm"'
      + ' data-supp-produit="' + produit.id + '" data-supp-idx="' + si + '"'
      + ' style="font-size:0.78rem; padding:3px 8px; color:var(--bordeaux);">✕ Retirer</button>';
    html += '</div>';
    html += '<div style="display:flex; align-items:center; gap:6px;">';
    var poidsVal = (l.poidsKg > 0) ? l.poidsKg : "";
    html += '<input type="number" min="0" step="0.1" class="supp-poids-input"'
      + ' data-supp-produit="' + produit.id + '" data-supp-idx="' + si + '"'
      + ' value="' + poidsVal + '" placeholder="0.0"'
      + ' style="width:70px; min-height:36px; padding:4px 8px; border:1px solid var(--gris-ligne); border-radius:6px; text-align:right;">';
    html += '<span style="font-size:0.85rem; color:var(--charbon-clair);">kg</span>';
    html += '</div>';
    html += suppLigneOptionsHTML(produit, si);
    html += suppLigneSpecHTML(produit.id, si, l.specification);
    html += '</div>';
  }
  var nViande = lignesSupp.length + 2;
  html += '<button type="button" class="supp-ajouter-btn btn btn-fantome btn-sm"'
    + ' data-supp-produit="' + produit.id + '"'
    + ' style="margin-top:10px; font-size:0.78rem; padding:4px 12px;">'
    + '+ Ajouter une ' + suppLigneOrdinal(nViande) + ' viande</button>';
  html += '</div>';
  return html;
}

function majZoneMultiVarianteSupp(produitId) {
  var zone = document.querySelector('[data-mv-supp-zone="' + produitId + '"]');
  if (!zone) return;
  var produit = ETAT.catalogue.find(function(p) { return p.id === produitId; });
  if (!produit) return;
  var temp = document.createElement("div");
  temp.innerHTML = zoneMultiVarianteSuppHTML(produit);
  var nouvelleZone = temp.firstElementChild;
  zone.replaceWith(nouvelleZone);
  var carte = document.querySelector('[data-carte-produit="' + produitId + '"]');
  if (carte) attacherListeneursMultiVarianteSupp(carte);
}

function attacherListeneursMultiVarianteSupp(conteneur) {
  conteneur.querySelectorAll(".supp-ajouter-btn").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var produitId = btn.dataset.suppProduit;
      var produit = ETAT.catalogue.find(function(p) { return p.id === produitId; });
      if (!panierCourant[produitId]) panierCourant[produitId] = {};
      if (!panierCourant[produitId].lignesSupp) panierCourant[produitId].lignesSupp = [];
      var optsDefaut = {};
      if (produit) { obtenirOptionsPersonnalisees(produit).forEach(function(g) { optsDefaut[g.nom] = g.valeurs[0]; }); }
      panierCourant[produitId].lignesSupp.push({ poidsKg: 0, options: optsDefaut, specification: "" });
      majZoneMultiVarianteSupp(produitId);
      mettreAJourResumePanier();
    });
  });

  conteneur.querySelectorAll(".supp-suppr-btn").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var produitId = btn.dataset.suppProduit;
      var idx = parseInt(btn.dataset.suppIdx);
      if (!panierCourant[produitId] || !panierCourant[produitId].lignesSupp) return;
      panierCourant[produitId].lignesSupp.splice(idx, 1);
      if (panierCourant[produitId].lignesSupp.length === 0) delete panierCourant[produitId].lignesSupp;
      majZoneMultiVarianteSupp(produitId);
      mettreAJourResumePanier();
    });
  });

  conteneur.querySelectorAll(".supp-poids-input").forEach(function(input) {
    input.addEventListener("input", function() {
      var produitId = input.dataset.suppProduit;
      var idx = parseInt(input.dataset.suppIdx);
      if (!panierCourant[produitId] || !panierCourant[produitId].lignesSupp) return;
      panierCourant[produitId].lignesSupp[idx].poidsKg = parseFloat(input.value) || 0;
      var poidsTotal = (panierCourant[produitId].poidsKg || 0)
        + panierCourant[produitId].lignesSupp.reduce(function(s, l) { return s + (l.poidsKg || 0); }, 0);
      var carte = document.querySelector('[data-carte-produit="' + produitId + '"]');
      if (carte) carte.classList.toggle("actif", poidsTotal > 0);
      mettreAJourResumePanier();
    });
  });

  conteneur.querySelectorAll(".supp-option-btn").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var produitId = btn.dataset.suppProduit;
      var idx = parseInt(btn.dataset.suppIdx);
      var groupe = btn.dataset.suppGroupe;
      var valeur = btn.dataset.suppOption;
      if (!panierCourant[produitId] || !panierCourant[produitId].lignesSupp) return;
      if (!panierCourant[produitId].lignesSupp[idx].options) panierCourant[produitId].lignesSupp[idx].options = {};
      panierCourant[produitId].lignesSupp[idx].options[groupe] = valeur;
      var ligne = btn.closest(".mv-supp-ligne");
      if (ligne) ligne.querySelectorAll('.supp-option-btn[data-supp-groupe="' + groupe + '"]').forEach(function(b) {
        var a = b.dataset.suppOption === valeur;
        b.style.borderColor = a ? "var(--bordeaux)" : "var(--gris-ligne)";
        b.style.background   = a ? "var(--creme-fonce)" : "white";
        b.style.fontWeight   = a ? "700" : "400";
      });
    });
  });

  conteneur.querySelectorAll(".supp-spec-btn").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var zoneId = btn.dataset.suppProduit + "-" + btn.dataset.suppIdx;
      var zone = document.querySelector('[data-supp-spec-zone="' + zoneId + '"]');
      if (zone) zone.style.display = zone.style.display === "none" ? "block" : "none";
    });
  });

  conteneur.querySelectorAll(".supp-spec-input").forEach(function(input) {
    input.addEventListener("input", function() {
      var produitId = input.dataset.suppProduit;
      var idx = parseInt(input.dataset.suppIdx);
      if (!panierCourant[produitId] || !panierCourant[produitId].lignesSupp) return;
      panierCourant[produitId].lignesSupp[idx].specification = input.value.trim();
      var ligne = input.closest(".mv-supp-ligne");
      var specBtn = ligne ? ligne.querySelector(".supp-spec-btn") : null;
      if (specBtn) specBtn.textContent = input.value.trim()
        ? "✏️ Spécification : " + input.value.trim()
        : "+ Spécification";
    });
  });
}

// ============================================================

function carteProduitHTML(produit) {
  const entree = panierCourant[produit.id] || {};

  if (produit.type === "poids") {
    const poids = entree.poidsKg || 0;
    return `
      <div class="carte-produit ${poids > 0 ? 'actif' : ''}" data-carte-produit="${produit.id}" style="flex-direction:column; align-items:stretch; gap:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div class="nom-produit">${produit.nom}</div>
            <div class="prix-produit">${produit.prix ? formaterMontant(produit.prix) + " / kg" : ''}</div>
          </div>
          <div style="display:flex; align-items:center; gap:6px;">
            <input type="number" min="0" step="0.1" data-poids-produit="${produit.id}" value="${poids || ''}" placeholder="0.0" style="width:70px; min-height:36px; padding:4px 8px; border:1px solid var(--gris-ligne); border-radius:6px; text-align:right;">
            <span style="font-size:0.85rem; color:var(--charbon-clair);">kg</span>
          </div>
        </div>
        ${zoneOptionsPersonnaliseesHTML(produit)}
        ${zoneSpecificationHTML(produit.id)}
        ${produit.multiVariante ? zoneMultiVarianteSuppHTML(produit) : ""}
      </div>
    `;
  }

  const qte = entree.quantite || 0;
  return `
    <div class="carte-produit ${qte > 0 ? 'actif' : ''}" data-carte-produit="${produit.id}" style="flex-direction:column; align-items:stretch; gap:8px;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div class="nom-produit">${produit.nom}</div>
          <div class="prix-produit">${produit.prix ? formaterMontant(produit.prix) : ''}</div>
        </div>
        <div class="stepper">
          <button data-produit="${produit.id}" data-delta="-1" aria-label="Retirer un ${produit.nom}">−</button>
          <input type="number" class="valeur" data-valeur-produit="${produit.id}" data-input-produit="${produit.id}" value="${qte}" min="0" step="1" style="width:46px; text-align:center; border:none; background:transparent; font-family:inherit; font-size:1rem; font-weight:700; color:var(--charbon);">
          <button data-produit="${produit.id}" data-delta="1" aria-label="Ajouter un ${produit.nom}">+</button>
        </div>
      </div>
      ${zoneOptionsPersonnaliseesHTML(produit)}
      ${zoneSpecificationHTML(produit.id)}
    </div>
  `;
}

/**
 * Carte spéciale Pierrade : une personne choisit un nombre de convives en
 * Nature et/ou Marinée. Au-delà de 6 personnes par plateau, l'étiquette et
 * la fiche de production afficheront automatiquement "1/2", "2/2" etc.
 */
function carteProduitPierradeHTML() {
  const nature = panierCourant["pierrade_nature"] || {};
  const marinee = panierCourant["pierrade_marinee"] || {};
  return `
    <div class="carte-produit" style="flex-direction:column; align-items:stretch; gap:12px;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div class="nom-produit">Pierrade Nature</div>
        <div class="stepper">
          <button data-pierrade-type="pierrade_nature" data-delta="-1">−</button>
          <input type="number" class="valeur" data-valeur-pierrade="pierrade_nature" data-input-pierrade="pierrade_nature" value="${nature.quantite || 0}" min="0" step="1" style="width:46px; text-align:center; border:none; background:transparent; font-family:inherit; font-size:1rem; font-weight:700; color:var(--charbon);">
          <button data-pierrade-type="pierrade_nature" data-delta="1">+</button>
        </div>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div class="nom-produit">Pierrade Marinée</div>
        <div class="stepper">
          <button data-pierrade-type="pierrade_marinee" data-delta="-1">−</button>
          <input type="number" class="valeur" data-valeur-pierrade="pierrade_marinee" data-input-pierrade="pierrade_marinee" value="${marinee.quantite || 0}" min="0" step="1" style="width:46px; text-align:center; border:none; background:transparent; font-family:inherit; font-size:1rem; font-weight:700; color:var(--charbon);">
          <button data-pierrade-type="pierrade_marinee" data-delta="1">+</button>
        </div>
      </div>
      <div style="font-size:0.78rem; color:var(--charbon-clair);">8,90 € / personne — maximum 6 personnes par plateau (au-delà, plusieurs plateaux numérotés seront générés automatiquement)</div>
      ${zoneSpecificationHTML("pierrade_nature")}
    </div>
  `;
}

function basculerZoneSpecification(produitId) {
  const zone = document.querySelector(`[data-zone-specification="${produitId}"]`);
  if (zone) zone.style.display = zone.style.display === "none" ? "block" : "none";
}

function definirSpecification(produitId, texte) {
  if (!panierCourant[produitId]) panierCourant[produitId] = {};
  panierCourant[produitId].specification = texte.trim();
  // Met à jour le libellé du bouton sans tout réafficher
  const btn = document.querySelector(`[data-specification-btn="${produitId}"]`);
  if (btn) btn.textContent = texte.trim() ? "✏️ Spécification : " + texte.trim() : "+ Spécification";
}

function changerQuantitePanier(produitId, delta) {
  const actuel = (panierCourant[produitId] && panierCourant[produitId].quantite) || 0;
  const nouveau = Math.max(0, actuel + delta);
  if (!panierCourant[produitId]) panierCourant[produitId] = {};
  panierCourant[produitId].quantite = nouveau;
  // Auto-sélectionner la première valeur de chaque groupe d'options si pas encore choisie
  if (nouveau > 0) {
    const produit = ETAT.catalogue.find(p => p.id === produitId);
    const opts = produit ? obtenirOptionsPersonnalisees(produit) : [];
    if (opts.length > 0) {
      if (!panierCourant[produitId].options) panierCourant[produitId].options = {};
      opts.forEach(g => {
        if (panierCourant[produitId].options[g.nom] === undefined) {
          panierCourant[produitId].options[g.nom] = g.valeurs[0];
        }
      });
    }
  }
  if (nouveau === 0 && !panierCourant[produitId].specification) delete panierCourant[produitId];

  const valeurEl = document.querySelector(`[data-valeur-produit="${produitId}"]`);
  if (valeurEl) {
    if (valeurEl.tagName === "INPUT") valeurEl.value = nouveau;
    else valeurEl.textContent = nouveau;
  }
  const carteEl = document.querySelector(`[data-carte-produit="${produitId}"]`);
  if (carteEl) carteEl.classList.toggle("actif", nouveau > 0);

  mettreAJourResumePanier();
}

function changerPoidsPanier(produitId, poidsKg) {
  if (!panierCourant[produitId]) panierCourant[produitId] = {};
  panierCourant[produitId].poidsKg = poidsKg;
  if (poidsKg <= 0 && !panierCourant[produitId].specification) delete panierCourant[produitId];

  const carteEl = document.querySelector(`[data-carte-produit="${produitId}"]`);
  if (carteEl) carteEl.classList.toggle("actif", poidsKg > 0);

  mettreAJourResumePanier();
}

function changerPersonnesPierrade(produitId, delta) {
  const actuel = (panierCourant[produitId] && panierCourant[produitId].quantite) || 0;
  const nouveau = Math.max(0, actuel + delta);
  if (!panierCourant[produitId]) panierCourant[produitId] = {};
  panierCourant[produitId].quantite = nouveau;
  if (nouveau === 0 && !panierCourant[produitId].specification) delete panierCourant[produitId];

  const valeurEl = document.querySelector(`[data-valeur-pierrade="${produitId}"]`);
  if (valeurEl) {
    if (valeurEl.tagName === "INPUT") valeurEl.value = nouveau;
    else valeurEl.textContent = nouveau;
  }

  mettreAJourResumePanier();
}

function mettreAJourResumePanier() {
  const parId = Object.fromEntries(ETAT.catalogue.map(p => [p.id, p]));
  let nbArticles = 0;
  let total = 0;
  for (const [id, entree] of Object.entries(panierCourant)) {
    const p = parId[id];
    if (!p) continue;
    if (p.type === "poids") {
      if (entree.poidsKg > 0) {
        nbArticles += 1;
        total += (p.prix || 0) * entree.poidsKg;
      }
      for (const supp of (entree.lignesSupp || [])) {
        if (supp.poidsKg > 0) { nbArticles += 1; total += (p.prix || 0) * supp.poidsKg; }
      }
    } else {
      const qte = entree.quantite || 0;
      nbArticles += qte;
      total += (p.prix || 0) * qte;
    }
  }
  // Lignes libres ("Autre")
  for (const l of lignesLibres) {
    if (l.nom) {
      nbArticles += l.quantite || 1;
      total += (l.prix || 0) * (l.quantite || 1);
    }
  }
  const elNb = document.getElementById("nc-nb-articles");
  const elTotal = document.getElementById("nc-montant-total");
  if (elNb) elNb.textContent = nbArticles + (nbArticles === 1 ? " article" : " articles");
  if (elTotal) elTotal.textContent = formaterMontant(total);
}

async function validerNouvelleCommande() {
  const magasinId = document.getElementById("nc-magasin").value;
  const periodeId = document.getElementById("nc-periode").value;
  const champChoixDate = document.getElementById("nc-date-choix");
  const dateRetrait = (champChoixDate.style.display !== "none")
    ? champChoixDate.value
    : document.getElementById("nc-date").value;
  const client = document.getElementById("nc-client").value.trim();
  const telephone = document.getElementById("nc-telephone").value.trim();
  const emailClient = document.getElementById("nc-email").value.trim();
  const remarques = document.getElementById("nc-remarques").value.trim();
  const instructions = Array.from(document.querySelectorAll(".checkbox-instruction.coche"))
    .map(el => el.dataset.instruction);
  const vendeur = ETAT.utilisateur.estInvite ? `Salarié — ${nomMagasin(ETAT.utilisateur.magasinId)}` : (ETAT.utilisateur.nom || "Non renseigné");

  if (!magasinId) { afficherToast("Choisissez un magasin", "erreur"); return; }
  if (!dateRetrait) { afficherToast("Choisissez une date de retrait", "erreur"); return; }
  if (!client) { afficherToast("Le nom du client est requis", "erreur"); return; }
  if (Object.keys(panierCourant).length === 0 && lignesLibres.filter(l => l.nom).length === 0) { afficherToast("Ajoutez au moins un produit", "erreur"); return; }

  // Détection doublon : même client + date + magasin
  if (client && dateRetrait && magasinId) {
    const normaliser = s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
    const clientNorm = normaliser(client);
    const doublon = (await recupererCommandesUnique()).find(c =>
      c.statut !== "annulee" &&
      normaliser(c.client || "") === clientNorm &&
      c.dateRetrait === dateRetrait &&
      c.magasinId === magasinId
    );
    if (doublon) {
      const ok = confirm(`⚠️ Attention : une commande existe déjà pour "${client}" le ${formaterDate(dateRetrait)} au magasin ${nomMagasin(magasinId)} (${doublon.numero}).\n\nCréer quand même une nouvelle commande ?`);
      if (!ok) return;
    }
  }

  const parId = Object.fromEntries(ETAT.catalogue.map(p => [p.id, p]));
  const lignes = [];

  // --- Pierrades : Nature + Marinée partagent le même plateau (max 6
  // personnes au total par plateau, répartition équilibrée entre plateaux
  // si plusieurs sont nécessaires : ex. 7 personnes -> 4 + 3, pas 6 + 1) ---
  const entreeNature = panierCourant["pierrade_nature"] || {};
  const entreeMarinee = panierCourant["pierrade_marinee"] || {};
  const totalPersonnesPierrade = (entreeNature.quantite || 0) + (entreeMarinee.quantite || 0);
  if (totalPersonnesPierrade > 0) {
    const specificationPierrade = entreeNature.specification || entreeMarinee.specification || "";
    const tailleDesPlateaux = repartirEnPlateaux(totalPersonnesPierrade, 6);
    const nbPlateaux = tailleDesPlateaux.length;
    let resteNature = entreeNature.quantite || 0;
    let resteMarinee = entreeMarinee.quantite || 0;

    tailleDesPlateaux.forEach((placesSurCePlateau, idx) => {
      const i = idx + 1;
      let surCePlateauNature = Math.min(resteNature, placesSurCePlateau);
      let surCePlateauMarinee = Math.min(resteMarinee, placesSurCePlateau - surCePlateauNature);
      resteNature -= surCePlateauNature;
      resteMarinee -= surCePlateauMarinee;

      if (surCePlateauNature > 0) {
        lignes.push({
          produitId: "pierrade_nature", nom: parId["pierrade_nature"].nom, typeVente: "pierrade",
          quantite: surCePlateauNature, prixUnitaire: parId["pierrade_nature"].prix || 0,
          specification: specificationPierrade,
          plateauNumero: nbPlateaux > 1 ? i : null, plateauTotal: nbPlateaux > 1 ? nbPlateaux : null
        });
      }
      if (surCePlateauMarinee > 0) {
        lignes.push({
          produitId: "pierrade_marinee", nom: parId["pierrade_marinee"].nom, typeVente: "pierrade",
          quantite: surCePlateauMarinee, prixUnitaire: parId["pierrade_marinee"].prix || 0,
          specification: specificationPierrade,
          plateauNumero: nbPlateaux > 1 ? i : null, plateauTotal: nbPlateaux > 1 ? nbPlateaux : null
        });
      }
    });
  }

  for (const [produitId, entree] of Object.entries(panierCourant)) {
    const p = parId[produitId];
    if (!p) continue;
    if (p.type === "pierrade") continue; // déjà traité ci-dessus

    if (p.type === "poids") {
      if (!entree.poidsKg || entree.poidsKg <= 0) continue;
      lignes.push({
        produitId, nom: p.nom, typeVente: "poids",
        quantite: 1, poidsKg: entree.poidsKg,
        prixUnitaire: (p.prix || 0) * entree.poidsKg,
        specification: entree.specification || "",
        options: entree.options || {},
        farce: (entree.options && entree.options["Farce"]) || entree.farce || ""
      });
      for (const supp of (entree.lignesSupp || [])) {
        if (!supp.poidsKg || supp.poidsKg <= 0) continue;
        lignes.push({
          produitId, nom: p.nom, typeVente: "poids",
          quantite: 1, poidsKg: supp.poidsKg,
          prixUnitaire: (p.prix || 0) * supp.poidsKg,
          specification: supp.specification || "",
          options: supp.options || {},
          farce: (supp.options && supp.options["Farce"]) || supp.farce || ""
        });
      }
    } else {
      const qte = entree.quantite || 0;
      if (qte <= 0) continue;
      lignes.push({
        produitId, nom: p.nom, typeVente: p.type === "menu" ? "menu" : "unite",
        quantite: qte, prixUnitaire: p.prix || 0,
        specification: entree.specification || "",
        options: entree.options || {},
        farce: (entree.options && entree.options["Farce"]) || entree.farce || ""
      });
    }
  }

  // Lignes libres ("Autre")
  for (const l of lignesLibres) {
    if (!l.nom) continue;
    lignes.push({
      produitId: null,
      nom: l.nom,
      typeVente: "libre",
      quantite: l.quantite || 1,
      prixUnitaire: l.prix || 0,
      specification: l.specification || ""
    });
  }

  if (lignes.length === 0) { afficherToast("Ajoutez au moins un produit", "erreur"); return; }

  const commandeEnAttente = {
    client: telephone ? `${client} (${telephone})` : client,
    emailClient,
    telephoneClient: telephone,
    magasinId,
    dateRetrait,
    periodeId: periodeId || null,
    vendeur,
    lignes,
    instructions,
    remarques
  };

  // On réserve le numéro de commande tout de suite pour pouvoir le montrer
  // au client sur l'écran de confirmation, AVANT d'écrire quoi que ce soit
  // en base. Si le salarié annule à cette étape, rien n'est enregistré.
  const btnValider = document.getElementById("nc-valider");
  btnValider.disabled = true;
  btnValider.textContent = "Préparation...";
  try {
    const numeroReserve = await genererNumeroCommande();
    ouvrirConfirmationCommande(commandeEnAttente, numeroReserve);
  } catch (e) {
    afficherToast("Erreur : " + e.message, "erreur");
  } finally {
    btnValider.disabled = false;
    btnValider.textContent = "Valider la commande";
  }
}

/**
 * Construit le libellé affichable d'une ligne de commande, en intégrant
 * la spécification éventuelle, le numéro de plateau (pierrades > 6 pers.)
 * et le poids (produits vendus au kg). Utilisée partout où une ligne de
 * commande est affichée ou imprimée pour rester cohérente.
 */
function libelleLigne(l) {
  let libelle = l.nom;
  if (l.plateauNumero) libelle += ` (${l.plateauNumero}/${l.plateauTotal})`;
  const optionsLabel = l.options ? Object.values(l.options).filter(Boolean).join(" · ") : (l.farce || "");
  if (optionsLabel) libelle += ` · ${optionsLabel}`;
  if (l.specification) libelle += ` — ${l.specification}`;
  return libelle;
}

function quantiteAffichee(l) {
  if (l.typeVente === "poids") return (l.poidsKg || 0).toLocaleString("fr-FR") + " kg";
  if (l.typeVente === "pierrade") return l.quantite + " pers.";
  return String(l.quantite);
}

/**
 * Écran de confirmation à montrer au client avant l'enregistrement final :
 * récapitulatif des produits et numéro de commande déjà attribué. Rien
 * n'est encore en base à ce stade. Le client peut aussi obtenir un ticket
 * imprimable. Si on ferme/annule, rien n'est créé (le numéro réservé est
 * simplement "sauté" — sans incidence, c'est juste un identifiant).
 */
function ouvrirConfirmationCommande(commande, numero) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal" style="max-width:480px; text-align:center;">
      <div style="font-size:0.85rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--charbon-clair); margin-bottom:6px;">Confirmation avec le client</div>
      <div style="font-family:var(--font-mono); font-size:2rem; font-weight:700; color:var(--bordeaux); margin-bottom:18px;">${numero}</div>

      <div style="text-align:left; background:var(--creme); border-radius:var(--radius-sm); padding:16px; margin-bottom:18px;">
        <p style="margin:0 0 8px 0;"><strong>${commande.client}</strong></p>
        <p style="margin:0 0 8px 0; font-size:0.9rem; color:var(--charbon-clair);">
          ${nomMagasin(commande.magasinId)} — Retrait le ${formaterDate(commande.dateRetrait)}
        </p>
        <table style="width:100%; margin-top:10px;">
          <tbody>
            ${commande.lignes.map(l => `
              <tr><td style="padding:3px 0;">${libelleLigne(l)}</td><td style="text-align:right; font-weight:700; padding:3px 0;">${quantiteAffichee(l)}</td></tr>
            `).join("")}
          </tbody>
        </table>
        <p style="text-align:right; font-weight:700; margin-top:10px; border-top:2px solid var(--gris-ligne); padding-top:8px;">
          Total : ${formaterMontant(commande.lignes.reduce((s,l) => s + l.prixUnitaire * l.quantite, 0))}
        </p>
      </div>

      <p style="font-size:0.85rem; color:var(--charbon-clair); margin-bottom:18px;">
        Merci de vérifier ce récapitulatif avec le client avant de valider définitivement.
      </p>

      <div style="display:flex; flex-direction:column; gap:10px;">
        <button class="btn btn-cuivre btn-lg" id="cc-valider-final">Confirmer et envoyer la commande</button>
        <button class="btn btn-secondaire" id="cc-imprimer-ticket">🖨️ Imprimer un ticket pour le client</button>
        <button class="btn btn-fantome" id="cc-annuler">Annuler (rien ne sera enregistré)</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById("cc-annuler").addEventListener("click", () => overlay.remove());

  document.getElementById("cc-imprimer-ticket").addEventListener("click", () => {
    imprimerTicketConfirmation(commande, numero);
  });

  document.getElementById("cc-valider-final").addEventListener("click", async () => {
    const btn = document.getElementById("cc-valider-final");
    btn.disabled = true;
    btn.textContent = "Enregistrement...";
    try {
      const resultat = await creerCommande({ ...commande, numero });
      // Sauvegarder les nouveaux articles libres dans le catalogue
      await sauvegarderArticlesLibresDansCatalogue();
      overlay.remove();
      afficherModalEnvoi(commande, resultat.numero);
      // Sauvegarde automatique après chaque nouvelle commande
      sauvegarderAutomatiquement().catch(() => {});
    } catch (e) {
      console.error(e);
      afficherToast("Erreur lors de l'enregistrement : " + e.message, "erreur");
      btn.disabled = false;
      btn.textContent = "Confirmer et envoyer la commande";
    }
  });
}

/**
 * Ticket imprimable à donner au client, avant même que la commande soit
 * enregistrée en base (le numéro est déjà réservé et fiable).
 */
function imprimerTicketConfirmation(commande, numero) {
  let zone = document.getElementById("zone-impression-dediee");
  if (zone) zone.remove();
  zone = document.createElement("div");
  zone.id = "zone-impression-dediee";
  zone.className = "zone-impression-dediee";
  zone.innerHTML = `
    <div class="fiche-commande">
      <div class="fiche-entete">
        <div>
          <div class="fiche-numero">${numero}</div>
          <div style="font-size:1.1rem; font-weight:700; margin-top:4px;">${commande.client}</div>
        </div>
        <div style="text-align:right;">
          <div><strong>Magasin :</strong> ${nomMagasin(commande.magasinId)}</div>
          <div><strong>Retrait :</strong> ${formaterDate(commande.dateRetrait)}</div>
        </div>
      </div>
      <table style="width:100%;">
        <thead><tr><th>Produit</th><th style="text-align:right;">Quantité</th></tr></thead>
        <tbody>
          ${commande.lignes.map(l => `<tr><td>${libelleLigne(l)}</td><td style="text-align:right; font-weight:700;">${quantiteAffichee(l)}</td></tr>`).join("")}
        </tbody>
      </table>
      <p style="text-align:right; font-weight:700; margin-top:14px;">
        Total : ${formaterMontant(commande.lignes.reduce((s,l) => s + l.prixUnitaire * l.quantite, 0))}
      </p>
      <p style="margin-top:18px; font-size:0.85rem; color:var(--charbon-clair);">
        Merci de conserver ce ticket et de le présenter au retrait de votre commande.
      </p>
    </div>
  `;
  document.body.appendChild(zone);
  document.body.classList.add("mode-impression-dediee");

  function nettoyer() {
    window.removeEventListener("afterprint", nettoyer);
    document.body.classList.remove("mode-impression-dediee");
    zone.remove();
  }
  window.addEventListener("afterprint", nettoyer);
  setTimeout(() => window.print(), 200);
}
// ============================================================
// MODALE D'ENVOI DE CONFIRMATION (Gmail / partage natif / impression)
// ============================================================
function afficherModalEnvoi(commande, numero, onFermer) {
  const nomClient = commande.client.replace(/\s*\(.*\)$/, "").trim();
  const lignesTexte = commande.lignes.map(l => "- " + libelleLigne(l) + " : " + quantiteAffichee(l)).join("\n");
  const dateStr = formaterDate(commande.dateRetrait);
  const magasinStr = nomMagasin(commande.magasinId);

  const sujet = "Confirmation commande " + numero + " - Maison Vanbaelinghem";
  const corpsEmail = "Bonjour " + nomClient + ",\n\n"
    + "Votre commande " + numero + " est confirmee :\n\n"
    + lignesTexte + "\n\n"
    + "Date de retrait : " + dateStr + "\nMagasin : " + magasinStr + "\n\n"
    + "Merci de votre confiance,\nMaison Vanbaelinghem";

  const messagePartage = corpsEmail;

  function gmailLink(email) {
    return "https://mail.google.com/mail/?view=cm"
      + "&to=" + encodeURIComponent(email)
      + "&su=" + encodeURIComponent(sujet)
      + "&body=" + encodeURIComponent(corpsEmail);
  }

  const emailInitial = commande.emailClient || "";

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  var html = "";
  html += '<div class="modal" style="max-width:480px;">';

  // En-tête
  html += '<div style="text-align:center; margin-bottom:20px;">';
  html += '<div style="font-size:2.2rem; margin-bottom:6px;">✅</div>';
  html += '<h3 style="margin:0 0 4px 0; color:var(--bordeaux);">Commande ' + numero + ' créée</h3>';
  html += '<p style="color:var(--charbon-clair); font-size:0.9rem; margin:0;">' + nomClient + ' — ' + dateStr + '</p>';
  html += '</div>';

  html += '<div style="display:flex; flex-direction:column; gap:12px; margin-bottom:18px;">';

  // --- GMAIL ---
  html += '<div style="background:var(--creme); border-radius:var(--radius-sm); padding:14px;">';
  html += '<div style="font-weight:700; margin-bottom:10px;">📧 Envoyer par Gmail</div>';
  html += '<div style="font-size:0.82rem; color:var(--charbon-clair); margin-bottom:8px;">Gmail doit etre ouvert avec le compte professionnel dans le navigateur.</div>';
  html += '<div style="display:flex; gap:8px; align-items:center;">';
  html += '<input type="email" id="envoi-email-client" placeholder="Email du client" value="' + emailInitial + '" style="flex:1; font-size:0.85rem; margin:0;">';
  html += '<a id="btn-ouvrir-gmail" href="' + (emailInitial ? gmailLink(emailInitial) : "#") + '" target="_blank" class="btn btn-primaire btn-sm" style="text-decoration:none; white-space:nowrap;"' + (!emailInitial ? ' onclick="return false;" disabled' : '') + '>Ouvrir Gmail</a>';
  html += '</div>';
  html += '</div>';

  html += '<hr style="border:none; border-top:1px solid var(--gris-ligne);">';

  // --- PARTAGE NATIF ---
  html += '<div style="background:var(--creme); border-radius:var(--radius-sm); padding:14px;">';
  html += '<div style="font-weight:700; margin-bottom:6px;">📤 Partager (tablette / téléphone)</div>';
  html += '<div style="font-size:0.82rem; color:var(--charbon-clair); margin-bottom:8px;">Ouvre le menu de partage du système : WhatsApp, SMS, email…</div>';
  html += '<button class="btn btn-secondaire btn-sm" id="btn-partager-natif">Partager</button>';
  html += '</div>';

  html += '<hr style="border:none; border-top:1px solid var(--gris-ligne);">';

  // --- IMPRIMER TICKET ---
  html += '<div style="background:var(--creme); border-radius:var(--radius-sm); padding:14px;">';
  html += '<div style="font-weight:700; margin-bottom:6px;">🖨️ Imprimer le ticket client</div>';
  html += '<div style="font-size:0.82rem; color:var(--charbon-clair); margin-bottom:8px;">Équivalent de la feuille client du carnet papier.</div>';
  html += '<button class="btn btn-secondaire btn-sm" id="btn-imprimer-ticket-envoi">Imprimer</button>';
  html += '</div>';

  html += '</div>';
  html += '<button class="btn btn-fantome" id="btn-fermer-envoi" style="width:100%;">Fermer</button>';
  html += '</div>';

  overlay.innerHTML = html;
  document.body.appendChild(overlay);

  // Mise à jour du lien Gmail en temps réel
  const emailInput = document.getElementById("envoi-email-client");
  const btnGmail = document.getElementById("btn-ouvrir-gmail");
  emailInput.addEventListener("input", () => {
    const val = emailInput.value.trim();
    if (val) {
      btnGmail.href = gmailLink(val);
      btnGmail.removeAttribute("disabled");
      btnGmail.style.opacity = "1";
      btnGmail.onclick = null;
    } else {
      btnGmail.href = "#";
      btnGmail.setAttribute("disabled", "true");
      btnGmail.style.opacity = "0.5";
      btnGmail.onclick = function() { return false; };
    }
  });
  if (!emailInitial) { btnGmail.style.opacity = "0.5"; }

  // Partage natif
  document.getElementById("btn-partager-natif").addEventListener("click", async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Commande " + numero + " - Vanbaelinghem", text: messagePartage });
      } catch (e) {
        if (e.name !== "AbortError") {
          navigator.clipboard.writeText(messagePartage)
            .then(() => afficherToast("Message copié dans le presse-papier", "succes"))
            .catch(() => afficherToast("Partage non disponible", "erreur"));
        }
      }
    } else {
      navigator.clipboard.writeText(messagePartage)
        .then(() => { afficherToast("Message copié — collez-le dans votre messagerie", "succes"); })
        .catch(() => afficherToast("Impossible de copier automatiquement", "erreur"));
    }
  });

  // Imprimer ticket
  document.getElementById("btn-imprimer-ticket-envoi").addEventListener("click", () => {
    imprimerTicketConfirmation(commande, numero);
  });

  // Fermer
  document.getElementById("btn-fermer-envoi").addEventListener("click", () => {
    overlay.remove();
    if (typeof onFermer === "function") {
      onFermer();
    } else {
      afficherToast("Commande " + numero + " créée avec succès", "succes");
      rendreNouvelleCommande(document.getElementById("contenu-principal"));
    }
    });
}

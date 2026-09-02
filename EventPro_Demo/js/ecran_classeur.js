// ============================================================
// ÉCRAN : CLASSEUR DE PRÉPARATION
// Une page = une commande. Tri : magasin > date de retrait.
// ============================================================

let filtreClasseur = { dateRetrait: "", periodeId: "", magasinId: "", impression: "toutes" };
let commandesClasseurCache = [];

function rendreClasseurPreparation(conteneur) {
  conteneur.innerHTML = `
    <div class="carte no-print" id="cl-barre-sticky" style="position:sticky; top:0; z-index:50; margin-bottom:18px;">
      <div class="filtre-barre" style="margin-bottom:0;">
        <div class="champ" style="margin:0;">
          <label>Date de retrait</label>
          <input type="date" id="cl-date" value="${filtreClasseur.dateRetrait}" ${filtreClasseur.periodeId ? 'disabled style="opacity:0.5;"' : ''}>
        </div>
        <div class="champ" style="margin:0;">
          <label>Ou période complète</label>
          <select id="cl-periode">
            <option value="">— Choisir une période —</option>
            ${(ETAT.parametres.periodes || []).map(p => `<option value="${p.id}" ${filtreClasseur.periodeId === p.id ? 'selected' : ''}>${p.nom}</option>`).join("")}
          </select>
        </div>
        <div class="champ" style="margin:0;">
          <label>Magasin</label>
          <select id="cl-magasin">
            <option value="">Tous les magasins</option>
            ${ETAT.parametres.magasins.map(m => `<option value="${m.id}">${m.nom}</option>`).join("")}
          </select>
        </div>
        <div class="champ" style="margin:0;">
          <label>Filtre impression</label>
          <select id="cl-impression">
            <option value="toutes">Toutes les commandes</option>
            <option value="non_imprimees">🟢 Non imprimées uniquement</option>
            <option value="imprimees">🔵 Déjà imprimées</option>
          </select>
        </div>
        <button class="btn btn-secondaire btn-sm" id="cl-effacer-date" style="align-self:flex-end;">Effacer la date</button>
      </div>
      <div id="cl-actions" style="margin-top:10px; display:none; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
        <span id="cl-compteur" style="font-size:0.9rem; color:var(--charbon-clair);"></span>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <button class="btn btn-cuivre" id="cl-imprimer-btn">🖨️ Imprimer le classeur</button>
          <button class="btn btn-cuivre" id="cl-imprimer-etiquettes-btn">🏷️ Imprimer étiquettes</button>
        </div>
      </div>
    </div>
    <div id="cl-resultats"><div class="vide-etat">Choisissez une date ou un magasin pour générer le classeur.</div></div>
  `;

  document.getElementById("cl-date").addEventListener("change", e => {
    filtreClasseur.dateRetrait = e.target.value;
    if (e.target.value) { filtreClasseur.periodeId = ""; document.getElementById("cl-periode").value = ""; }
    rechargerClasseur();
  });
  document.getElementById("cl-periode").addEventListener("change", e => {
    filtreClasseur.periodeId = e.target.value;
    const dateInput = document.getElementById("cl-date");
    if (e.target.value) {
      filtreClasseur.dateRetrait = ""; dateInput.value = "";
      dateInput.disabled = true; dateInput.style.opacity = "0.5";
    } else {
      dateInput.disabled = false; dateInput.style.opacity = "1";
    }
    rechargerClasseur();
  });
  document.getElementById("cl-magasin").addEventListener("change", e => { filtreClasseur.magasinId = e.target.value; rechargerClasseur(); });
  document.getElementById("cl-impression").addEventListener("change", e => { filtreClasseur.impression = e.target.value; afficherClasseur(); });
  document.getElementById("cl-effacer-date").addEventListener("click", () => {
    filtreClasseur.dateRetrait = ""; filtreClasseur.periodeId = "";
    document.getElementById("cl-date").value = "";
    document.getElementById("cl-periode").value = "";
    document.getElementById("cl-date").disabled = false;
    document.getElementById("cl-date").style.opacity = "1";
    rechargerClasseur();
  });

  if (filtreClasseur.dateRetrait || filtreClasseur.periodeId || filtreClasseur.magasinId) rechargerClasseur();
}

async function rechargerClasseur() {
  const conteneur = document.getElementById("cl-resultats");
  if (!filtreClasseur.dateRetrait && !filtreClasseur.periodeId && !filtreClasseur.magasinId) {
    conteneur.innerHTML = `<div class="vide-etat">Choisissez une date ou un magasin pour générer le classeur.</div>`;
    return;
  }
  conteneur.innerHTML = `<div class="vide-etat">Chargement...</div>`;
  try {
    const params = {};
    if (filtreClasseur.magasinId) params.magasinId = filtreClasseur.magasinId;
    let toutes = await recupererCommandesUnique(params);
    if (filtreClasseur.periodeId) {
      const periodeSelectionnee = (ETAT.parametres.periodes || []).find(p => p.id === filtreClasseur.periodeId);
      const joursSet = new Set(periodeSelectionnee ? (periodeSelectionnee.jours || []) : []);
      toutes = toutes.filter(c => c.periodeId === filtreClasseur.periodeId || (joursSet.size > 0 && joursSet.has(c.dateRetrait)));
    } else if (filtreClasseur.dateRetrait) {
      toutes = toutes.filter(c => c.dateRetrait === filtreClasseur.dateRetrait);
    }
    toutes = toutes.filter(c => c.statut !== "annulee");
    commandesClasseurCache = toutes;
    afficherClasseur();
  } catch (e) {
    conteneur.innerHTML = `<div class="vide-etat">Erreur : ${e.message}</div>`;
  }
}

function afficherClasseur() {
  const conteneur = document.getElementById("cl-resultats");
  const zoneActions = document.getElementById("cl-actions");
  let liste = [...commandesClasseurCache];
  if (filtreClasseur.impression === "non_imprimees") liste = liste.filter(c => !c.imprimee);
  if (filtreClasseur.impression === "imprimees") liste = liste.filter(c => c.imprimee);

  // Tri : magasin > date de retrait > nom client
  liste.sort((a, b) => {
    const m = nomMagasin(a.magasinId).localeCompare(nomMagasin(b.magasinId));
    if (m !== 0) return m;
    const d = (a.dateRetrait || "").localeCompare(b.dateRetrait || "");
    if (d !== 0) return d;
    return (a.client || "").localeCompare(b.client || "");
  });

  if (liste.length === 0) {
    conteneur.innerHTML = `<div class="vide-etat"><div class="icone-vide">📄</div>Aucune commande à afficher.</div>`;
    zoneActions.style.display = "none";
    return;
  }

  zoneActions.style.display = "flex";
  document.getElementById("cl-compteur").textContent = `${liste.length} commande(s) dans le classeur`;

  conteneur.innerHTML = `
    <div id="cl-fiches">
      ${liste.map(c => ficheCommandeHTML(c)).join("")}
    </div>
  `;

  document.getElementById("cl-imprimer-btn").onclick = async () => { await imprimerCommandes(liste); };
  document.getElementById("cl-imprimer-etiquettes-btn").onclick = () => { imprimerEtiquettesCommandes(liste); };
}

function ficheCommandeHTML(c) {
  const instructionsActives = (c.instructions || []).map(id => (ETAT.parametres.instructionsCommande || INSTRUCTIONS_PREPARATION).find(i => i.id === id)).filter(Boolean);
  return `
    <div class="fiche-commande">
      <div class="fiche-entete">
        <div>
          <div class="fiche-numero">${c.numero}</div>
          <div style="font-size:1.1rem; font-weight:700; margin-top:4px;">${c.client}</div>
        </div>
        <div style="text-align:right;">
          <div><strong>Magasin :</strong> ${nomMagasin(c.magasinId)}</div>
          <div><strong>Retrait :</strong> ${formaterDate(c.dateRetrait)}</div>
          <div><strong>Vendeur :</strong> ${c.vendeur || "—"}</div>
        </div>
      </div>

      ${instructionsActives.length ? `
        <div class="fiche-instructions">
          ${instructionsActives.map(i => `<span class="checkbox-instruction coche">${i.icone} ${i.label}</span>`).join("")}
        </div>
      ` : ""}

      <table style="width:100%;">
        <thead><tr><th>Produit</th><th style="text-align:right;">Quantité</th></tr></thead>
        <tbody>
          ${(c.lignes || []).map(l => `<tr><td>${libelleLigne(l)}</td><td style="text-align:right; font-weight:700;">${quantiteAffichee(l)}</td></tr>`).join("")}
        </tbody>
      </table>

      ${c.remarques ? `<p style="margin-top:14px;"><strong>Remarques client :</strong> ${c.remarques}</p>` : ""}

      <div class="fiche-cases">
        <div class="fiche-case"><span class="carre"></span> Préparé</div>
        <div class="fiche-case"><span class="carre"></span> Vérifié</div>
        <div class="fiche-case fiche-case-alerte"><span class="carre"></span> <strong>ATTENTION SAC</strong></div>
      </div>
    </div>
  `;
}

/**
 * Imprime une liste de commandes : génère une zone d'impression dédiée
 * (les fiches), masque le reste de la page pendant l'impression, et
 * marque les commandes comme imprimées seulement après la fermeture de
 * la boîte de dialogue d'impression (évènement "afterprint") — donc pas
 * si l'utilisateur annule l'impression sans rien imprimer.
 *
 * Limite connue : les navigateurs ne permettent pas de savoir avec
 * certitude si l'utilisateur a cliqué "Imprimer" ou "Annuler" dans la
 * boîte de dialogue — "afterprint" se déclenche dans les deux cas. C'est
 * néanmoins beaucoup plus fiable que l'ancien comportement qui marquait
 * la commande avant même d'ouvrir l'impression.
 */
function imprimerCommandes(commandes) {
  if (!commandes || commandes.length === 0) return;

  // Zone d'impression dédiée, invisible à l'écran, visible uniquement à l'impression.
  let zone = document.getElementById("zone-impression-dediee");
  if (zone) zone.remove();
  zone = document.createElement("div");
  zone.id = "zone-impression-dediee";
  zone.className = "zone-impression-dediee";
  zone.innerHTML = commandes.map(c => ficheCommandeHTML(c)).join("");
  document.body.appendChild(zone);
  document.body.classList.add("mode-impression-dediee");

  const ids = commandes.map(c => c.id);
  const numeros = commandes.map(c => c.numero);

  function nettoyerApresImpression() {
    window.removeEventListener("afterprint", nettoyerApresImpression);
    document.body.classList.remove("mode-impression-dediee");
    zone.remove();

    marquerImprimee(ids, numeros)
      .then(() => afficherToast(`${commandes.length} commande(s) marquée(s) comme imprimée(s)`, "succes"))
      .catch(e => afficherToast("Erreur lors du marquage d'impression : " + e.message, "erreur"))
      .finally(() => {
        if (ETAT.vueActive === "classeur") rechargerClasseur();
        if (ETAT.vueActive === "commandes") rafraichirAffichageCommandes();
      });
  }

  window.addEventListener("afterprint", nettoyerApresImpression);
  setTimeout(() => window.print(), 200);
}

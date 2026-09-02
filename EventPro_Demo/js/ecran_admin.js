// ============================================================
// ÉCRAN : ADMINISTRATION
// ============================================================

let ongletAdminActif = "produits";

function rendreAdmin(conteneur) {
  conteneur.innerHTML = `
    <div class="tabs-principal" style="background:var(--creme-fonce); border-radius:var(--radius); margin-bottom:18px; padding:6px;">
      ${[
        ["produits", "Produits & menus"],
        ["recettes", "Recettes"],
        ["periodes", "Périodes événementielles"],
        ["magasins", "Magasins"],
        ["utilisateurs", "Utilisateurs"],
        ["etiquettes", "Étiquettes"],
        ["parametres", "⚙️ Paramètres"],
        ["donnees", "Données"]
      ].map(([id, label]) => `<div class="tab-item ${ongletAdminActif===id?'actif':''}" data-onglet="${id}" style="color:${ongletAdminActif===id?'var(--bordeaux)':'var(--charbon-clair)'};">${label}</div>`).join("")}
    </div>
    <div id="admin-contenu"></div>
  `;
  conteneur.querySelectorAll("[data-onglet]").forEach(el => {
    el.addEventListener("click", () => { ongletAdminActif = el.dataset.onglet; rendreAdmin(conteneur); });
  });

  const sousConteneur = document.getElementById("admin-contenu");
  if (ongletAdminActif === "produits") rendreAdminProduits(sousConteneur);
  else if (ongletAdminActif === "recettes") rendreAdminRecettes(sousConteneur);
  else if (ongletAdminActif === "periodes") rendreAdminPeriodes(sousConteneur);
  else if (ongletAdminActif === "magasins") rendreAdminMagasins(sousConteneur);
  else if (ongletAdminActif === "utilisateurs") rendreAdminUtilisateurs(sousConteneur);
  else if (ongletAdminActif === "etiquettes") rendreAdminEtiquettes(sousConteneur);
  else if (ongletAdminActif === "parametres") rendreAdminParametres(sousConteneur);
  else if (ongletAdminActif === "donnees") rendreAdminDonnees(sousConteneur);
}

// ------------------------------------------------------------
// DONNÉES : export/import, maintenance, remise à zéro
// ------------------------------------------------------------

function calculerUsageMemoire() {
  const cles = ["eventpro_demo_commandes", "eventpro_demo_produits", "eventpro_demo_parametres",
                 "eventpro_demo_utilisateurs", "eventpro_demo_audit", "eventpro_demo_compteur"];
  let totalOctets = 0;
  cles.forEach(c => { const v = sessionStorage.getItem(c); if (v) totalOctets += v.length * 2; });
  const limiteMo = 5;
  const utiliseKo = Math.round(totalOctets / 1024);
  const pourcent = Math.min(100, Math.round((totalOctets / (limiteMo * 1024 * 1024)) * 100));
  return { utiliseKo, pourcent, limiteMo };
}

function exporterDonnees() {
  const cles = ["eventpro_demo_commandes", "eventpro_demo_produits", "eventpro_demo_parametres",
                 "eventpro_demo_utilisateurs", "eventpro_demo_audit", "eventpro_demo_compteur"];
  const sauvegarde = { _exporteLe: new Date().toISOString(), _version: 1 };
  cles.forEach(c => { const v = sessionStorage.getItem(c); if (v) sauvegarde[c] = JSON.parse(v); });

  const blob = new Blob([JSON.stringify(sauvegarde, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const date = new Date().toISOString().slice(0, 10);
  const a = document.createElement("a");
  a.href = url;
  a.download = `vanba-sauvegarde-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
  ajouterAuditLog("export_donnees", "Export de sauvegarde JSON téléchargé");
  afficherToast("Sauvegarde téléchargée", "succes");
}

function importerDonnees(fichier, conteneur) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data._version) throw new Error("Format de fichier non reconnu.");
      const cles = ["eventpro_demo_commandes", "eventpro_demo_produits", "eventpro_demo_parametres",
                     "eventpro_demo_utilisateurs", "eventpro_demo_audit", "eventpro_demo_compteur"];
      cles.forEach(c => { if (data[c] !== undefined) sessionStorage.setItem(c, JSON.stringify(data[c])); });
      await ajouterAuditLog("import_donnees", `Restauration depuis sauvegarde du ${data._exporteLe || "?"}`);
      afficherToast("Données restaurées avec succès — rechargement...", "succes");
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      afficherToast("Erreur à l'import : " + err.message, "erreur");
    }
  };
  reader.readAsText(fichier);
}

async function rendreAdminDonnees(conteneur) {
  const compteurActuel = JSON.parse(sessionStorage.getItem("eventpro_demo_compteur") || "0");
  const nbCommandes = (JSON.parse(sessionStorage.getItem("eventpro_demo_commandes") || "[]")).length;
  const { utiliseKo, pourcent, limiteMo } = calculerUsageMemoire();
  const couleurBarre = pourcent >= 80 ? "#b3261e" : pourcent >= 50 ? "#e08c00" : "var(--cuivre)";
  const alerteMem = pourcent >= 80
    ? `<p style="color:#b3261e; font-weight:600; margin-top:8px;">⚠ Mémoire presque pleine — exportez une sauvegarde et supprimez les vieilles commandes.</p>`
    : "";

  // État de la sauvegarde automatique
  const autoConfiguree = await sauvegardeAutoConfiguree();
  const derniereSauvAuto = dateDerniereSauvegardeAuto();
  const infoDerniereSauv = derniereSauvAuto
    ? `Dernière sauvegarde : ${derniereSauvAuto.toLocaleString("fr-FR", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" })}`
    : "Aucune sauvegarde effectuée";
  const supporteAutoSauvegarde = !!window.showDirectoryPicker;

  conteneur.innerHTML = `
    <h2 style="margin:0 0 18px 0;">Gestion des données</h2>

    <!-- Sauvegarde automatique -->
    <div class="carte" style="margin-bottom:18px; border:2px solid ${autoConfiguree ? "var(--vert-pret)" : "#b3261e"};">
      <h3 style="margin-top:0;">🛡 Sauvegarde automatique ${autoConfiguree
        ? '<span style="color:var(--vert-pret);">✓ Active</span>'
        : '<span style="color:#b3261e;">✗ Non configurée</span>'}</h3>
      ${supporteAutoSauvegarde ? `
        <p style="color:var(--charbon-clair); font-size:0.9rem; margin-bottom:6px;">
          ${autoConfiguree
            ? `L'app sauvegarde automatiquement à chaque ouverture et après chaque commande.<br><em>${infoDerniereSauv}</em>`
            : "Choisissez un dossier (OneDrive, Documents...) — l'app y écrira automatiquement un fichier JSON à chaque ouverture et après chaque commande."
          }
        </p>
        <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:12px;">
          <button class="btn btn-primaire" id="dn-configurer-auto">
            ${autoConfiguree ? "📁 Changer le dossier" : "📁 Configurer la sauvegarde automatique"}
          </button>
          ${autoConfiguree ? `
            <button class="btn btn-fantome btn-sm" id="dn-sauvegarder-maintenant">💾 Sauvegarder maintenant</button>
            <button class="btn btn-fantome btn-sm" id="dn-desactiver-auto" style="color:#b3261e;">Désactiver</button>
          ` : ""}
        </div>
      ` : `
        <p style="color:var(--charbon-clair); font-size:0.9rem;">
          Votre navigateur ne supporte pas la sauvegarde automatique. Utilisez Edge ou Chrome, ou exportez manuellement ci-dessous.
        </p>
      `}
    </div>

    <!-- Indicateur mémoire -->
    <div class="carte" style="margin-bottom:18px;">
      <h3 style="margin-top:0;">Espace mémoire utilisé</h3>
      <p style="color:var(--charbon-clair); font-size:0.9rem; margin-bottom:10px;">
        ${utiliseKo} Ko utilisés sur ${limiteMo * 1024} Ko disponibles (${pourcent}%)
      </p>
      <div style="height:10px; background:var(--gris-ligne); border-radius:5px; overflow:hidden;">
        <div style="height:100%; width:${pourcent}%; background:${couleurBarre}; border-radius:5px; transition:width 0.3s;"></div>
      </div>
      ${alerteMem}
    </div>

    <!-- Export / Import manuel -->
    <div class="carte" style="margin-bottom:18px; border:2px solid var(--cuivre);">
      <h3 style="margin-top:0;">Sauvegarde manuelle et restauration</h3>
      <p style="color:var(--charbon-clair); font-size:0.9rem; margin-bottom:16px;">
        Exportez un fichier de sauvegarde complet. Si le navigateur est réinitialisé, vous pourrez tout restaurer depuis ce fichier.
      </p>
      <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
        <button class="btn btn-primaire" id="dn-exporter">⬇ Exporter une sauvegarde (.json)</button>
        <label class="btn btn-secondaire" style="cursor:pointer; margin:0;">
          ⬆ Restaurer depuis une sauvegarde
          <input type="file" id="dn-importer" accept=".json" style="display:none;">
        </label>
      </div>
    </div>

    <!-- Numérotation -->
    <div class="carte" style="margin-bottom:18px;">
      <h3 style="margin-top:0;">Numérotation des commandes</h3>
      <p style="color:var(--charbon-clair); font-size:0.9rem; margin-bottom:12px;">
        Dernier numéro utilisé : <strong>CMD-${String(compteurActuel).padStart(6,"0")}</strong>.
        La prochaine commande sera <strong>CMD-${String(compteurActuel + 1).padStart(6,"0")}</strong>.
      </p>
      <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
        <div class="champ" style="margin:0; min-width:160px;">
          <label>Remettre le compteur à</label>
          <input type="number" id="dn-compteur-valeur" min="0" value="0" style="width:120px;">
        </div>
        <button class="btn btn-fantome" id="dn-reset-compteur" style="margin-top:20px;">Réinitialiser le compteur</button>
      </div>
    </div>

    <div class="carte" style="border:2px solid #f4b8b5;">
      <h3 style="margin-top:0; color:#b3261e;">⚠ Zone dangereuse — Suppression de données</h3>
      <p style="color:var(--charbon-clair); font-size:0.9rem; margin-bottom:16px;">
        Ces actions sont <strong>irréversibles</strong>. Un code de sécurité est requis. Exportez une sauvegarde avant de continuer.
      </p>

      <div style="background:#fff5f5; border:1px solid #f4b8b5; border-radius:8px; padding:14px; margin-bottom:18px; display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
        <label style="font-size:0.9rem; font-weight:600; color:#b3261e; white-space:nowrap;">🔐 Code de sécurité admin :</label>
        <input type="text" id="dn-code-actuel" value="" placeholder="••••••"
          style="width:140px; font-family:var(--font-mono); font-weight:700; letter-spacing:2px; text-transform:uppercase; font-size:1rem; padding:6px 12px; border:1px solid #f4b8b5; border-radius:6px;">
        <button class="btn btn-fantome btn-sm" id="dn-changer-code" style="color:#b3261e; border-color:#b3261e;">Enregistrer le code</button>
        <span style="font-size:0.82rem; color:var(--charbon-clair);">Seul l'admin peut modifier ce code.</span>
      </div>

      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <button class="btn btn-fantome btn-sm" id="dn-suppr-commandes" style="color:#b3261e; border-color:#b3261e;">
          Supprimer les commandes annulées
        </button>
        <button class="btn btn-fantome btn-sm" id="dn-suppr-audit" style="color:#b3261e; border-color:#b3261e;">
          Vider le journal d'audit
        </button>
        <button class="btn btn-fantome btn-sm" id="dn-tout-remettre" style="color:#b3261e; border-color:#b3261e; font-weight:700;">
          🗑 Tout remettre à zéro (commandes + compteur + audit)
        </button>
      </div>
    </div>
  `;

  // Boutons sauvegarde automatique
  const btnConfigurerAuto = document.getElementById("dn-configurer-auto");
  if (btnConfigurerAuto) {
    btnConfigurerAuto.addEventListener("click", async () => {
      await configurerDossierSauvegarde();
      rendreAdminDonnees(conteneur);
    });
  }
  const btnSauvegarderMaintenant = document.getElementById("dn-sauvegarder-maintenant");
  if (btnSauvegarderMaintenant) {
    btnSauvegarderMaintenant.addEventListener("click", async () => {
      const handle = await lireHandleDossier();
      await ecrireSauvegardeAutomatique(handle, false);
      rendreAdminDonnees(conteneur);
    });
  }
  const btnDesactiverAuto = document.getElementById("dn-desactiver-auto");
  if (btnDesactiverAuto) {
    btnDesactiverAuto.addEventListener("click", async () => {
      if (!confirm("Désactiver la sauvegarde automatique ?")) return;
      await desactiverSauvegardeAuto();
      afficherToast("Sauvegarde automatique désactivée", "succes");
      rendreAdminDonnees(conteneur);
    });
  }

  document.getElementById("dn-exporter").addEventListener("click", () => exporterDonnees());

  document.getElementById("dn-importer").addEventListener("change", (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (!confirm("Restaurer les données depuis ce fichier ? Les données actuelles seront écrasées.")) return;
    importerDonnees(f, conteneur);
  });

  document.getElementById("dn-reset-compteur").addEventListener("click", async () => {
    const val = parseInt(document.getElementById("dn-compteur-valeur").value, 10);
    if (isNaN(val) || val < 0) { afficherToast("Valeur invalide", "erreur"); return; }
    if (!confirm(`Remettre le compteur à ${val} ? La prochaine commande sera CMD-${String(val + 1).padStart(6,"0")}.`)) return;
    sessionStorage.setItem("eventpro_demo_compteur", JSON.stringify(val));
    await ajouterAuditLog("maintenance", `Compteur de commandes remis à ${val}`);
    afficherToast(`Compteur remis à ${val} — prochaine commande : CMD-${String(val + 1).padStart(6,"0")}`, "succes");
    rendreAdminDonnees(conteneur);
  });

  // --- Code de sécurité ---
  const CODE_KEY = "eventpro_demo_code_securite";
  const codeInput = document.getElementById("dn-code-actuel");
  if (codeInput) codeInput.value = sessionStorage.getItem(CODE_KEY) || "VANBA";

  document.getElementById("dn-changer-code").addEventListener("click", () => {
    const nouveau = (codeInput.value || "").trim().toUpperCase();
    if (nouveau.length < 3) { afficherToast("Le code doit faire au moins 3 caractères", "erreur"); return; }
    sessionStorage.setItem(CODE_KEY, nouveau);
    afficherToast("Code de sécurité mis à jour", "succes");
  });

  function verifierCodeSecurite(messageAction) {
    const codeAttendu = (sessionStorage.getItem(CODE_KEY) || "VANBA").toUpperCase();
    const saisi = (prompt(`⚠ ACTION IRRÉVERSIBLE

${messageAction}

Saisissez le code de sécurité admin pour confirmer :`) || "").trim().toUpperCase();
    if (saisi !== codeAttendu) {
      afficherToast("Code incorrect — action annulée", "erreur");
      return false;
    }
    return true;
  }

  document.getElementById("dn-suppr-commandes").addEventListener("click", async () => {
    const toutes = JSON.parse(sessionStorage.getItem("eventpro_demo_commandes") || "[]");
    const restantes = toutes.filter(c => c.statut !== "annulee");
    const nbSupprimees = toutes.length - restantes.length;
    if (nbSupprimees === 0) { afficherToast("Aucune commande annulée à supprimer", "erreur"); return; }
    if (!confirm(`Supprimer définitivement ${nbSupprimees} commande(s) annulée(s) ? Cette action est irréversible.`)) return;
    if (!verifierCodeSecurite(`Suppression de ${nbSupprimees} commande(s) annulée(s)`)) return;
    sessionStorage.setItem("eventpro_demo_commandes", JSON.stringify(restantes));
    await ajouterAuditLog("maintenance", `${nbSupprimees} commande(s) annulée(s) supprimées définitivement`);
    afficherToast(`${nbSupprimees} commande(s) supprimées`, "succes");
    rendreAdminDonnees(conteneur);
  });

  document.getElementById("dn-suppr-audit").addEventListener("click", async () => {
    if (!confirm("Vider le journal d'audit ? Cette action est irréversible.")) return;
    if (!verifierCodeSecurite("Suppression du journal d'audit complet")) return;
    sessionStorage.setItem("eventpro_demo_audit", JSON.stringify([]));
    await ajouterAuditLog("maintenance", "Journal d'audit vidé");
    afficherToast("Journal d'audit vidé", "succes");
    rendreAdminDonnees(conteneur);
  });

  document.getElementById("dn-tout-remettre").addEventListener("click", async () => {
    if (!confirm("ATTENTION : remettre à zéro TOUTES les commandes, le compteur et le journal d'audit ?\n\nCette action est TOTALEMENT IRRÉVERSIBLE.")) return;
    if (!confirm("Dernière chance — confirmez-vous vraiment la remise à zéro complète ?")) return;
    if (!verifierCodeSecurite("REMISE À ZÉRO COMPLÈTE de toutes les commandes, le compteur et l'audit")) return;
    sessionStorage.setItem("eventpro_demo_commandes", JSON.stringify([]));
    sessionStorage.setItem("eventpro_demo_compteur", JSON.stringify(0));
    sessionStorage.setItem("eventpro_demo_audit", JSON.stringify([]));
    afficherToast("Données remises à zéro — prochaine commande : CMD-000001", "succes");
    rendreAdminDonnees(conteneur);
  });
}

// ------------------------------------------------------------
// ÉTIQUETTES : configuration d'affichage + sélection des produits
// ------------------------------------------------------------
function rendreAdminEtiquettes(conteneur) {
  const config = ETAT.parametres.configEtiquettes || CONFIG_ETIQUETTES_DEFAUT;

  // Grouper tous les produits actifs par catégorie (ordre ORDRE_CATEGORIES)
  const parCategorie = {};
  ETAT.catalogue.forEach(p => {
    if (p.actif === false) return;
    const cat = p.categorie || "Divers";
    if (!parCategorie[cat]) parCategorie[cat] = [];
    parCategorie[cat].push(p);
  });
  const ordreActuel = obtenirOrdreCategories();
  const categories = [
    ...ordreActuel.filter(c => parCategorie[c]),
    ...Object.keys(parCategorie).filter(c => !ordreActuel.includes(c))
  ];

  conteneur.innerHTML = `
    <h2 style="margin:0 0 18px 0;">Configuration des étiquettes</h2>

    <!-- Bloc 1 : affichage des infos sur les étiquettes -->
    <div class="carte" style="margin-bottom:18px;">
      <h3 style="margin-top:0;">Informations affichées sur les étiquettes</h3>
      <p style="color:var(--charbon-clair); font-size:0.9rem; margin-bottom:16px;">
        Pour chaque fiche de production, choisissez si le numéro de commande et le nom du client doivent apparaître sur les étiquettes imprimées.
      </p>
      <div class="grille-3">
        ${(ETAT.parametres.fichesImpression || CATEGORIES_IMPRESSION_PRODUCTION).map(c => `
          <div class="carte" style="background:var(--creme-fonce);">
            <h4 style="margin-top:0;">${c.label}</h4>
            <label style="display:flex; align-items:center; gap:8px; margin-bottom:10px; font-weight:500;">
              <input type="checkbox" data-config-etq="${c.id}-numero" ${config[c.id] && config[c.id].afficherNumeroCommande ? 'checked' : ''} style="width:auto; min-height:auto;">
              Afficher le n° de commande
            </label>
            <label style="display:flex; align-items:center; gap:8px; font-weight:500;">
              <input type="checkbox" data-config-etq="${c.id}-client" ${config[c.id] && config[c.id].afficherNomClient ? 'checked' : ''} style="width:auto; min-height:auto;">
              Afficher le nom du client
            </label>
          </div>
        `).join("")}
      </div>
      <button class="btn btn-primaire btn-sm" id="etq-enregistrer-config" style="margin-top:14px;">Enregistrer</button>
    </div>

    <!-- Bloc 2 : sélection des produits à étiqueter -->
    <div class="carte">
      <div class="carte-titre" style="margin-bottom:8px;">
        <h3 style="margin:0;">Produits à étiqueter</h3>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-fantome btn-sm" id="etq-tout-cocher">Tout cocher</button>
          <button class="btn btn-fantome btn-sm" id="etq-tout-decocher">Tout décocher</button>
        </div>
      </div>
      <p style="color:var(--charbon-clair); font-size:0.9rem; margin-bottom:16px;">
        Cochez uniquement les produits qui doivent apparaître dans l'onglet <strong>Étiquettes</strong>. Les produits décochés sont ignorés à l'impression et n'apparaissent pas dans la liste de recherche.
      </p>
      ${categories.map(cat => `
        <div style="margin-bottom:16px;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; padding-bottom:4px; border-bottom:1px solid var(--gris-ligne);">
            <div style="font-weight:700; color:var(--bordeaux); font-size:0.85rem; text-transform:uppercase; letter-spacing:0.06em;">${cat}</div>
            <button class="btn btn-fantome btn-sm" data-etq-cat="${cat}" style="font-size:0.78rem; padding:2px 10px; height:auto;">Tout / Aucun</button>
          </div>
          <div data-etq-cat-produits="${cat}" style="display:flex; flex-wrap:wrap; gap:8px;">
            ${parCategorie[cat].map(p => `
              <label style="display:flex; align-items:center; gap:6px; background:var(--creme-fonce); padding:5px 10px; border-radius:6px; cursor:pointer; font-size:0.88rem; user-select:none;">
                <input type="checkbox" data-etq-produit="${p.id}" ${p.genereEtiquette !== false ? 'checked' : ''} style="width:auto; min-height:auto;">
                ${p.nom}
              </label>
            `).join("")}
          </div>
        </div>
      `).join("")}
      <button class="btn btn-primaire" id="etq-enregistrer-produits" style="margin-top:8px;">Enregistrer la sélection</button>
    </div>
  `;

  // Enregistrer config affichage
  document.getElementById("etq-enregistrer-config").addEventListener("click", async () => {
    const nouvelleConfig = {};
    (ETAT.parametres.fichesImpression || CATEGORIES_IMPRESSION_PRODUCTION).forEach(c => {
      nouvelleConfig[c.id] = {
        afficherNumeroCommande: document.querySelector(`[data-config-etq="${c.id}-numero"]`).checked,
        afficherNomClient: document.querySelector(`[data-config-etq="${c.id}-client"]`).checked
      };
    });
    try {
      await enregistrerParametres({ configEtiquettes: nouvelleConfig });
      ETAT.parametres = await recupererParametres();
      afficherToast("Configuration enregistrée", "succes");
    } catch (e) { afficherToast("Erreur : " + e.message, "erreur"); }
  });

  // Tout cocher / décocher
  document.getElementById("etq-tout-cocher").addEventListener("click", () => {
    document.querySelectorAll("[data-etq-produit]").forEach(cb => { cb.checked = true; });
  });
  document.getElementById("etq-tout-decocher").addEventListener("click", () => {
    document.querySelectorAll("[data-etq-produit]").forEach(cb => { cb.checked = false; });
  });

  // Tout / Aucun par catégorie
  conteneur.querySelectorAll("[data-etq-cat]").forEach(btn => {
    btn.addEventListener("click", () => {
      const zone = conteneur.querySelector(`[data-etq-cat-produits="${btn.dataset.etqCat}"]`);
      if (!zone) return;
      const cbs = zone.querySelectorAll("[data-etq-produit]");
      const tousCoches = Array.from(cbs).every(cb => cb.checked);
      cbs.forEach(cb => { cb.checked = !tousCoches; });
    });
  });

  // Enregistrer la sélection des produits
  document.getElementById("etq-enregistrer-produits").addEventListener("click", async () => {
    const btn = document.getElementById("etq-enregistrer-produits");
    btn.disabled = true;
    btn.textContent = "Enregistrement...";
    try {
      const checkboxes = document.querySelectorAll("[data-etq-produit]");
      for (const cb of checkboxes) {
        const produit = ETAT.catalogue.find(p => p.id === cb.dataset.etqProduit);
        if (!produit) continue;
        const voulu = cb.checked;
        const actuel = produit.genereEtiquette !== false; // undefined = true par défaut
        if (voulu !== actuel) {
          await enregistrerProduit({ ...produit, genereEtiquette: voulu });
        }
      }
      ETAT.catalogue = await recupererCatalogue();
      btn.disabled = false;
      btn.textContent = "Enregistrer la sélection";
      afficherToast("Sélection des produits à étiqueter mise à jour", "succes");
    } catch (e) {
      btn.disabled = false;
      btn.textContent = "Enregistrer la sélection";
      afficherToast("Erreur : " + e.message, "erreur");
    }
  });
}

// ------------------------------------------------------------
// PRODUITS & MENUS
// ------------------------------------------------------------
function rendreAdminRecettes(conteneur) {
  const UNITES = ["g", "kg", "ml", "L", "cl", "pièce(s)"];

  // Index ingrédients connus : nom → { fournisseur, prix, unite }
  const ingMap = {};
  ETAT.catalogue.forEach(p => (p.recette || []).forEach(ing => {
    if (!ing.nom) return;
    const key = ing.nom.trim().toLowerCase();
    if (!ingMap[key]) ingMap[key] = { nom: ing.nom, fournisseur: ing.fournisseur || "", prix: ing.prix || 0, unite: ing.unite || "" };
    else {
      // Compléter les champs manquants si on trouve plus d'info ailleurs
      if (!ingMap[key].fournisseur && ing.fournisseur) ingMap[key].fournisseur = ing.fournisseur;
      if (!ingMap[key].prix && ing.prix) ingMap[key].prix = ing.prix;
      if (!ingMap[key].unite && ing.unite) ingMap[key].unite = ing.unite;
    }
  }));

  // Datalist ingrédients
  let datalistIng = document.getElementById("ar-ing-datalist");
  if (!datalistIng) { datalistIng = document.createElement("datalist"); datalistIng.id = "ar-ing-datalist"; document.body.appendChild(datalistIng); }
  datalistIng.innerHTML = Object.values(ingMap).sort((a,b) => a.nom.localeCompare(b.nom, "fr")).map(i => `<option value="${i.nom}">`).join("");

  // Datalist fournisseurs
  const tousLesFournisseurs = [...new Set(
    ETAT.catalogue.flatMap(p => (p.recette || []).map(ing => ing.fournisseur).filter(Boolean))
  )].sort((a, b) => a.localeCompare(b, "fr"));
  let datalistFourn = document.getElementById("ar-fourn-datalist");
  if (!datalistFourn) { datalistFourn = document.createElement("datalist"); datalistFourn.id = "ar-fourn-datalist"; document.body.appendChild(datalistFourn); }
  datalistFourn.innerHTML = tousLesFournisseurs.map(f => `<option value="${f}">`).join("");

  function hasFarceOptions(produit) {
    return (produit.optionsFarce && produit.optionsFarce.length > 0) ||
      (produit.optionsPersonnalisees && produit.optionsPersonnalisees.some(o => o.nom === "Farce"));
  }

  // Tous les produits actifs (menus inclus)
  const produits = ETAT.catalogue.filter(p => p.actif !== false);
  const produitsBruts = produits.filter(p => p.produitBrut === true);
  // Tous les farcis : produits avec options de farce (poids ou simple), non marqués bruts
  const produitsFarcis = produits.filter(p => hasFarceOptions(p) && !p.produitBrut);
  // Recettes : produits avec recette, hors farcis (déjà dans leur section)
  const avecRecette = produits.filter(p => p.recette && p.recette.length > 0 && !hasFarceOptions(p));
  // Poids bruts sans farce (boucherie simple : Boudin, Dinde, Bœuf…)
  const tousPoidsProds = produits.filter(p => p.type === "poids" && !p.produitBrut && !hasFarceOptions(p));
  // Sans fiche : simple/pierrade sans recette, non brut, non farci
  const sansRecette = produits.filter(p =>
    p.type !== "poids" && p.type !== "menu" && p.produitBrut !== true && !hasFarceOptions(p) &&
    (!p.recette || p.recette.length === 0)
  );

  function lignesRecetteHTML(produit) {
    return (produit.recette || []).map((ing, i) => `
      <div class="ar-ingredient" data-pid="${produit.id}" data-idx="${i}" style="display:flex; gap:6px; align-items:center; margin-bottom:5px; flex-wrap:wrap;">
        <input type="text" class="ar-ing-nom" value="${ing.nom}" placeholder="Ingrédient"
          list="ar-ing-datalist"
          style="flex:2; min-width:120px; min-height:32px; font-size:0.85rem; padding:4px 8px;">
        <input type="number" class="ar-ing-qte" value="${ing.quantite}" min="0" step="0.1"
          style="width:65px; min-height:32px; font-size:0.85rem; padding:4px 6px;">
        <select class="ar-ing-unite" style="width:85px; min-height:32px; font-size:0.85rem;">
          ${UNITES.map(u => `<option ${u===ing.unite?'selected':''}>${u}</option>`).join("")}
        </select>
        <span style="display:flex; align-items:center; gap:3px; background:#eef3fb; border:1px solid #c5d5ee; border-radius:6px; padding:2px 6px;">
          <span style="font-size:0.7rem; color:#5577aa; font-weight:600; white-space:nowrap;">🏪</span>
          <input type="text" class="ar-ing-fournisseur" value="${ing.fournisseur || ''}" placeholder="Fournisseur"
            list="ar-fourn-datalist"
            style="width:95px; min-height:26px; font-size:0.8rem; padding:2px 4px; background:transparent; border:none; outline:none; color:#3a5a8a;">
        </span>
        <span style="display:flex; align-items:center; gap:2px; background:#eef3fb; border:1px solid #c5d5ee; border-radius:6px; padding:2px 6px;">
          <input type="number" class="ar-ing-prix" value="${ing.prix || ''}" min="0" step="0.01" placeholder="Prix"
            title="Prix unitaire (optionnel)"
            style="width:52px; min-height:26px; font-size:0.8rem; padding:2px 4px; background:transparent; border:none; outline:none; color:#3a5a8a; text-align:right;">
          <span style="font-size:0.78rem; color:#5577aa; font-weight:600;">€</span>
        </span>
        <button class="ar-suppr-ing btn btn-fantome btn-sm" data-pid="${produit.id}" data-idx="${i}"
          style="min-height:32px; color:#b3261e; padding:0 8px;">✕</button>
      </div>`).join("");
  }

  function cartePoidsHTML(produit) {
    const aFarce = hasFarceOptions(produit);
    return `
      <div class="ar-carte" data-pid="${produit.id}" style="background:var(--blanc); border:1px solid var(--gris-ligne); border-radius:var(--radius-sm); padding:14px 16px; margin-bottom:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center; ${aFarce ? 'margin-bottom:8px;' : ''} gap:10px; flex-wrap:wrap;">
          <div>
            <strong style="font-size:0.95rem;">${produit.nom}</strong>
            <span style="font-size:0.78rem; color:var(--charbon-clair); margin-left:8px;">${produit.categorie}</span>
            <span style="font-size:0.75rem; background:var(--creme-fonce); border-radius:4px; padding:2px 7px; margin-left:6px; color:var(--charbon-clair);">au poids</span>
          </div>
          ${aFarce ? `<button class="ar-sauver btn btn-primaire btn-sm" data-pid="${produit.id}" style="font-size:0.8rem;">Enregistrer</button>` : ""}
        </div>
        ${aFarce ? `
        <div style="display:flex; align-items:center; gap:8px; padding:6px 10px; background:var(--creme-fonce); border-radius:6px;">
          <span style="font-size:0.82rem; color:var(--charbon-clair); white-space:nowrap;">🥄 Farce (selon choix client) :</span>
          <input type="number" class="ar-farce-qte" data-pid="${produit.id}" data-type="poids"
            value="${produit.quantiteFarceGParKg || 120}" min="0" step="5"
            style="width:70px; min-height:30px; font-size:0.85rem; padding:3px 6px; border:1px solid var(--gris-ligne); border-radius:6px; text-align:right;">
          <span style="font-size:0.82rem; color:var(--charbon-clair);">g / kg</span>
          <span style="font-size:0.78rem; color:var(--charbon-clair); font-style:italic; margin-left:4px;">— ajoutée au nom exact (ex : "Farce de Noël")</span>
        </div>` : `<p style="font-size:0.78rem; color:var(--charbon-clair); margin:4px 0 0 0; font-style:italic;">Ingrédient brut — apparaît directement en kg dans la commande ingrédients.</p>`}
      </div>`;
  }

  function carteHTML(produit) {
    const aRecette = produit.recette && produit.recette.length > 0;
    const aFarce = hasFarceOptions(produit);
    return `
      <div class="ar-carte" data-pid="${produit.id}" style="background:var(--blanc); border:1px solid var(--gris-ligne); border-radius:var(--radius-sm); padding:14px 16px; margin-bottom:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; gap:10px; flex-wrap:wrap;">
          <div>
            <strong style="font-size:0.95rem;">${produit.nom}</strong>
            <span style="font-size:0.78rem; color:var(--charbon-clair); margin-left:8px;">${produit.categorie}</span>
          </div>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button class="ar-marquer-brut btn btn-fantome btn-sm" data-pid="${produit.id}"
              title="Ce produit est un ingrédient brut — il apparaîtra directement dans la commande ingrédients"
              style="font-size:0.8rem; color:#2e7d32; border-color:#c8e6c9;">🥩 Produit brut</button>
            <button class="ar-ajouter-ing btn btn-fantome btn-sm" data-pid="${produit.id}" style="font-size:0.8rem;">+ Ingrédient</button>
            <button class="ar-sauver btn btn-primaire btn-sm" data-pid="${produit.id}" style="font-size:0.8rem;">Enregistrer</button>
          </div>
        </div>
        ${aFarce ? `
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px; padding:6px 10px; background:var(--creme-fonce); border-radius:6px;">
          <span style="font-size:0.82rem; color:var(--charbon-clair); white-space:nowrap;">🥄 Farce (selon choix client) :</span>
          <input type="number" class="ar-farce-qte" data-pid="${produit.id}" data-type="${produit.type}"
            value="${produit.type === 'poids' ? (produit.quantiteFarceGParKg || 120) : (produit.quantiteFarceG || 80)}"
            min="0" step="5"
            style="width:70px; min-height:30px; font-size:0.85rem; padding:3px 6px; border:1px solid var(--gris-ligne); border-radius:6px; text-align:right;">
          <span style="font-size:0.82rem; color:var(--charbon-clair);">${produit.type === 'poids' ? 'g / kg' : 'g / pièce'}</span>
          <span style="font-size:0.78rem; color:var(--charbon-clair); font-style:italic; margin-left:4px;">— ajoutée au nom exact (ex : "Farce de Noël")</span>
        </div>` : ""}
        ${!aRecette ? `<p style="font-size:0.82rem; color:var(--charbon-clair); margin:0 0 6px 0; font-style:italic;">Aucun ingrédient — cliquez "+ Ingrédient" pour commencer.</p>` : ""}
        <div class="ar-ingredients-liste" data-pid="${produit.id}">${lignesRecetteHTML(produit)}</div>
      </div>`;
  }

  function carteBrutHTML(produit) {
    return `
      <div class="ar-carte" data-pid="${produit.id}" style="background:var(--blanc); border:1px solid #c8e6c9; border-radius:var(--radius-sm); padding:14px 16px; margin-bottom:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <strong style="font-size:0.95rem;">${produit.nom}</strong>
            <span style="font-size:0.78rem; color:var(--charbon-clair);">${produit.categorie}</span>
            <span style="font-size:0.78rem; background:#e8f5e9; color:#2e7d32; border-radius:4px; padding:2px 8px; font-weight:600;">🥩 Produit brut</span>
          </div>
          <button class="ar-retirer-brut btn btn-fantome btn-sm" data-pid="${produit.id}" style="font-size:0.8rem; color:var(--charbon-clair);">Retirer</button>
        </div>
        <p style="font-size:0.82rem; color:#2e7d32; margin:6px 0 0 0; font-style:italic;">Apparaît directement dans la commande ingrédients (quantité en pièces).</p>
      </div>`;
  }

  conteneur.innerHTML = `
    <div class="carte-titre">
      <h2 style="margin:0;">Fiches techniques — Recettes</h2>
      <span style="font-size:0.85rem; color:var(--charbon-clair);">${avecRecette.length} recettes · ${produitsFarcis.length} farcis · ${tousPoidsProds.length + produitsBruts.length} bruts</span>
    </div>
    <p style="font-size:0.85rem; color:var(--charbon-clair); margin-bottom:16px;">
      Saisissez les quantités <strong>pour 1 portion / 1 unité</strong>. Les totaux sont calculés automatiquement dans Production → Ingrédients.
      Pour un produit vendu tel quel (ex : caille entière), cliquez <strong>🥩 Produit brut</strong>.
    </p>

    ${sansRecette.length > 0 ? `
      <details style="margin-bottom:18px;">
        <summary style="cursor:pointer; font-weight:700; color:var(--bordeaux); padding:8px 0; font-size:0.9rem;">
          ⚠️ ${sansRecette.length} produit(s) sans fiche technique
        </summary>
        <div style="margin-top:8px;">
          ${sansRecette.map(p => carteHTML(p)).join("")}
        </div>
      </details>` : ""}

    ${produitsFarcis.length > 0 ? (() => {
        const nomsOptions = [...new Set(produitsFarcis.flatMap(p =>
          (p.optionsPersonnalisees || []).map(o => o.nom).concat(p.optionsFarce?.length > 0 ? ["Farce"] : [])
        ))].join(", ");
        return `
      <details style="margin-bottom:18px;">
        <summary style="cursor:pointer; font-weight:700; color:var(--bordeaux); padding:8px 0; font-size:0.9rem;">
          ${produitsFarcis.length} produit(s) avec options (${nomsOptions})
        </summary>
        <div style="margin-top:8px;">
          ${produitsFarcis.map(p => carteHTML(p)).join("")}
        </div>
      </details>`;
      })() : ""}

    ${(produitsBruts.length + tousPoidsProds.length) > 0 ? `
      <details style="margin-bottom:18px;">
        <summary style="cursor:pointer; font-weight:700; color:#2e7d32; padding:8px 0; font-size:0.9rem;">
          ${produitsBruts.length + tousPoidsProds.length} produit(s) brut(s) / au poids
        </summary>
        <div style="margin-top:8px;">
          ${produitsBruts.map(p => carteBrutHTML(p)).join("")}
          ${tousPoidsProds.map(p => carteHTML(p)).join("")}
        </div>
      </details>` : ""}

    <div id="ar-liste-recettes">
      ${avecRecette.map(p => carteHTML(p)).join("")}
    </div>
  `;

  // Auto-remplissage fournisseur + prix quand on sélectionne un ingrédient connu
  conteneur.addEventListener("input", e => {
    const nomInput = e.target.closest(".ar-ing-nom");
    if (!nomInput) return;
    const row = nomInput.closest(".ar-ingredient");
    if (!row) return;
    const nomSaisi = nomInput.value.trim().toLowerCase();
    if (!nomSaisi) return;

    // 1. Index sauvegardé (catalogue)
    let data = ingMap[nomSaisi] ? { ...ingMap[nomSaisi] } : null;

    // 2. Compléter depuis le DOM vivant (données saisies mais pas encore enregistrées)
    conteneur.querySelectorAll(".ar-ingredient").forEach(autreRow => {
      if (autreRow === row) return;
      const autreNom = autreRow.querySelector(".ar-ing-nom")?.value.trim().toLowerCase();
      if (autreNom !== nomSaisi) return;
      const autreF = autreRow.querySelector(".ar-ing-fournisseur")?.value.trim();
      const autreP = parseFloat(autreRow.querySelector(".ar-ing-prix")?.value);
      const autreU = autreRow.querySelector(".ar-ing-unite")?.value;
      if (!data) data = {};
      if (!data.fournisseur && autreF) data.fournisseur = autreF;
      if (!data.prix && !isNaN(autreP) && autreP > 0) data.prix = autreP;
      if (!data.unite && autreU) data.unite = autreU;
    });

    if (!data) return;
    const fourn = row.querySelector(".ar-ing-fournisseur");
    const prix = row.querySelector(".ar-ing-prix");
    const unite = row.querySelector(".ar-ing-unite");
    if (fourn && !fourn.value && data.fournisseur) fourn.value = data.fournisseur;
    if (prix && !prix.value && data.prix) prix.value = data.prix;
    if (unite && data.unite) {
      const opt = [...unite.options].find(o => o.value === data.unite);
      if (opt) unite.value = data.unite;
    }
  });

  // Délégation d'événements
  conteneur.addEventListener("click", async e => {
    // Marquer produit brut
    const btnBrut = e.target.closest(".ar-marquer-brut");
    if (btnBrut) {
      const pid = btnBrut.dataset.pid;
      const produit = ETAT.catalogue.find(p => p.id === pid);
      if (!produit) return;
      await enregistrerProduit({ ...produit, produitBrut: true, recette: [] });
      ETAT.catalogue = await recupererCatalogue();
      afficherToast(`"${produit.nom}" marqué comme produit brut`, "succes");
      rendreAdminRecettes(conteneur);
      return;
    }

    // Retirer statut produit brut
    const btnRetirer = e.target.closest(".ar-retirer-brut");
    if (btnRetirer) {
      const pid = btnRetirer.dataset.pid;
      const produit = ETAT.catalogue.find(p => p.id === pid);
      if (!produit) return;
      const { produitBrut, ...produitSansBrut } = produit;
      await enregistrerProduit(produitSansBrut);
      ETAT.catalogue = await recupererCatalogue();
      afficherToast(`Statut produit brut retiré de "${produit.nom}"`, "succes");
      rendreAdminRecettes(conteneur);
      return;
    }

    // + Ingrédient
    const btnAjout = e.target.closest(".ar-ajouter-ing");
    if (btnAjout) {
      const pid = btnAjout.dataset.pid;
      const liste = conteneur.querySelector(`.ar-ingredients-liste[data-pid="${pid}"]`);
      const produit = ETAT.catalogue.find(p => p.id === pid);
      const newIdx = (produit.recette || []).length;
      const div = document.createElement("div");
      div.className = "ar-ingredient";
      div.dataset.pid = pid;
      div.dataset.idx = newIdx;
      div.style.cssText = "display:flex; gap:6px; align-items:center; margin-bottom:5px;";
      div.innerHTML = `
        <input type="text" class="ar-ing-nom" placeholder="Ingrédient" list="ar-ing-datalist"
          style="flex:2; min-width:120px; min-height:32px; font-size:0.85rem; padding:4px 8px;">
        <input type="number" class="ar-ing-qte" value="1" min="0" step="0.1" style="width:65px; min-height:32px; font-size:0.85rem; padding:4px 6px;">
        <select class="ar-ing-unite" style="width:85px; min-height:32px; font-size:0.85rem;">
          ${UNITES.map(u => `<option>${u}</option>`).join("")}
        </select>
        <span style="display:flex; align-items:center; gap:3px; background:#eef3fb; border:1px solid #c5d5ee; border-radius:6px; padding:2px 6px;">
          <span style="font-size:0.7rem; color:#5577aa; font-weight:600; white-space:nowrap;">🏪</span>
          <input type="text" class="ar-ing-fournisseur" placeholder="Fournisseur" list="ar-fourn-datalist"
            style="width:95px; min-height:26px; font-size:0.8rem; padding:2px 4px; background:transparent; border:none; outline:none; color:#3a5a8a;">
        </span>
        <span style="display:flex; align-items:center; gap:2px; background:#eef3fb; border:1px solid #c5d5ee; border-radius:6px; padding:2px 6px;">
          <input type="number" class="ar-ing-prix" min="0" step="0.01" placeholder="Prix"
            title="Prix unitaire (optionnel)"
            style="width:52px; min-height:26px; font-size:0.8rem; padding:2px 4px; background:transparent; border:none; outline:none; color:#3a5a8a; text-align:right;">
          <span style="font-size:0.78rem; color:#5577aa; font-weight:600;">€</span>
        </span>
        <button class="ar-suppr-ing btn btn-fantome btn-sm" style="min-height:32px; color:#b3261e; padding:0 8px;">✕</button>
      `;
      // Remove empty-state message if present
      const emptyMsg = liste.closest(".ar-carte").querySelector("p");
      if (emptyMsg) emptyMsg.remove();
      liste.appendChild(div);
      return;
    }

    // Supprimer ingrédient
    const btnSuppr = e.target.closest(".ar-suppr-ing");
    if (btnSuppr) {
      btnSuppr.closest(".ar-ingredient").remove();
      return;
    }

    // Enregistrer
    const btnSave = e.target.closest(".ar-sauver");
    if (btnSave) {
      const pid = btnSave.dataset.pid;
      const produit = ETAT.catalogue.find(p => p.id === pid);
      if (!produit) return;
      const recette = [];
      conteneur.querySelectorAll(`.ar-ingredient[data-pid="${pid}"], .ar-carte[data-pid="${pid}"] .ar-ingredient`).forEach(ligne => {
        const nom = ligne.querySelector(".ar-ing-nom").value.trim();
        const qte = parseFloat(ligne.querySelector(".ar-ing-qte").value) || 0;
        const unite = ligne.querySelector(".ar-ing-unite").value;
        const fournisseur = ligne.querySelector(".ar-ing-fournisseur")?.value.trim() || "";
        const prixRaw = parseFloat(ligne.querySelector(".ar-ing-prix")?.value);
        const ing = { nom, quantite: qte, unite };
        if (fournisseur) ing.fournisseur = fournisseur;
        if (!isNaN(prixRaw) && prixRaw > 0) ing.prix = prixRaw;
        if (nom && qte > 0) recette.push(ing);
      });
      // Sauvegarder quantiteFarceG / quantiteFarceGParKg si le champ est présent
      const farceInput = conteneur.querySelector(`.ar-farce-qte[data-pid="${pid}"]`);
      const updates = { recette };
      if (farceInput) {
        const qte = parseFloat(farceInput.value) || 0;
        if (farceInput.dataset.type === "poids") updates.quantiteFarceGParKg = qte;
        else updates.quantiteFarceG = qte;
      }
      await enregistrerProduit({ ...produit, ...updates });
      ETAT.catalogue = await recupererCatalogue();
      afficherToast(`Recette "${produit.nom}" enregistrée`, "succes");
    }
  });
}

function rendreAdminProduits(conteneur) {
  const libellesType = { simple: "Unité simple", poids: "Au poids (kg)", pierrade: "Pierrade", menu: "Menu (composé)" };

  // Grouper par catégorie dans l'ordre défini
  const parCategorie = {};
  ETAT.catalogue.forEach(p => {
    const cat = p.categorie || "Divers";
    if (!parCategorie[cat]) parCategorie[cat] = [];
    parCategorie[cat].push(p);
  });
  const ordreActuel = obtenirOrdreCategories();
  const categories = [
    ...ordreActuel.filter(c => parCategorie[c]),
    ...Object.keys(parCategorie).filter(c => !ordreActuel.includes(c))
  ];

  conteneur.innerHTML = `
    <div class="carte-titre">
      <h2 style="margin:0;">Catalogue produits</h2>
      <div style="display:flex; gap:10px;">
        <button class="btn btn-fantome btn-sm" id="ap-reinitialiser">↺ Réinitialiser le catalogue par défaut</button>
        <button class="btn btn-primaire btn-sm" id="ap-nouveau">+ Nouveau produit</button>
      </div>
    </div>
    <p style="color:var(--charbon-clair); font-size:0.85rem; margin-bottom:14px;">
      ${ETAT.catalogue.length} produits chargés. Si le catalogue affiché ne correspond pas à la dernière mise à jour livrée, utilisez "Réinitialiser le catalogue par défaut" (vos commandes et comptes ne sont pas affectés).
    </p>
    <div class="table-wrap table-catalogue">
      <table>
        <thead>
          <tr>
            <th style="width:28px;"></th>
            <th>Nom</th>
            <th>Type</th>
            <th>Prix</th>
            <th>Étiquette</th>
            <th>Farce</th>
            <th>Fiche impression</th>
            <th>Actif</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${categories.map((cat, idx) => {
            const valeursImprimer = parCategorie[cat].map(p => p.imprimerDans || "traiteur");
            const ficheCommune = valeursImprimer.every(v => v === valeursImprimer[0]) ? valeursImprimer[0] : "";
            return `
            <tr class="ap-cat-header" data-cat-idx="${idx}" style="cursor:pointer; background:var(--creme-fonce);">
              <td colspan="6" draggable="true" data-drag-categorie="${cat}"
                style="font-weight:700; color:var(--bordeaux); font-size:0.85rem; text-transform:uppercase; letter-spacing:0.05em; padding:8px 12px; border-bottom:2px solid var(--bordeaux-pale, #e8c8cc); cursor:grab; user-select:none;">
                <span style="display:flex; align-items:center; gap:8px;">
                  <span style="color:var(--gris-ligne); font-size:1rem; cursor:grab;" title="Glisser pour réordonner">⠿</span>
                  ${cat}
                  <span class="ap-cat-fleche" style="margin-left:auto; color:var(--bordeaux); transition:transform 0.2s; display:inline-block;">▼</span>
                </span>
              </td>
              <td colspan="2" style="border-bottom:2px solid var(--bordeaux-pale, #e8c8cc); padding:4px 10px; vertical-align:middle;">
                <select data-fiche-categorie="${idx}" title="Changer la fiche d'impression pour toute cette catégorie"
                  style="font-size:0.82rem; padding:3px 6px; border:1px solid var(--gris-ligne); border-radius:4px; background:white; cursor:pointer; max-width:120px;">
                  <option value="">— mixte —</option>
                  ${(ETAT.parametres.fichesImpression || CATEGORIES_IMPRESSION_PRODUCTION).map(c => `<option value="${c.id}" ${ficheCommune === c.id ? 'selected' : ''}>${c.label}</option>`).join("")}
                </select>
              </td>
              <td style="border-bottom:2px solid var(--bordeaux-pale, #e8c8cc);"></td>
            </tr>
            ${parCategorie[cat].map(p => {
              const ficheLabel = (ETAT.parametres.fichesImpression || CATEGORIES_IMPRESSION_PRODUCTION).find(c => c.id === (p.imprimerDans || "traiteur"))?.label || "Traiteur";
              return `
              <tr data-cat-produit="${idx}" data-drag-produit="${p.id}" draggable="true" style="cursor:grab;">
                <td style="width:28px; padding:8px 4px; text-align:center; color:var(--gris-ligne); cursor:grab; font-size:1rem;" title="Glisser pour réordonner">⠿</td>
                <td>${p.nom}</td>
                <td>${libellesType[p.type] || p.type}</td>
                <td>${p.prix ? formaterMontant(p.prix) : "—"}</td>
                <td style="text-align:center;">${p.genereEtiquette !== false
                  ? '<span style="color:var(--bordeaux); font-weight:700;">✓</span>'
                  : '<span style="color:var(--charbon-clair);">—</span>'}</td>
                <td style="font-size:0.82rem; color:var(--charbon-clair);">${obtenirOptionsPersonnalisees(p).length > 0
                  ? obtenirOptionsPersonnalisees(p).map(g => g.nom).join(', ')
                  : '—'}</td>
                <td style="font-size:0.82rem; color:var(--charbon-clair);">${ficheLabel}</td>
                <td>${p.actif === false
                  ? '<span style="color:var(--charbon-clair);">Non</span>'
                  : 'Oui'}</td>
                <td>
                  <div style="display:flex; gap:6px; flex-wrap:nowrap;">
                    <button class="btn btn-fantome btn-sm" data-editer="${p.id}">Modifier</button>
                    <button class="btn btn-fantome btn-sm" data-supprimer="${p.id}" style="color:#b3261e;">Supprimer</button>
                  </div>
                </td>
              </tr>
            `}).join("")}
          `}).join("")}
        </tbody>
      </table>
    </div>
  `;

  // Accordéon par catégorie
  conteneur.querySelectorAll(".ap-cat-header").forEach(row => {
    row.addEventListener("click", () => {
      const idx = row.dataset.catIdx;
      const lignes = conteneur.querySelectorAll(`[data-cat-produit="${idx}"]`);
      const fleche = row.querySelector(".ap-cat-fleche");
      const estOuvert = lignes.length > 0 && lignes[0].style.display !== "none";
      lignes.forEach(r => { r.style.display = estOuvert ? "none" : ""; });
      fleche.style.transform = estOuvert ? "rotate(-90deg)" : "rotate(0deg)";
    });
  });

  // Dropdown fiche d'impression par catégorie
  conteneur.querySelectorAll("[data-fiche-categorie]").forEach(sel => {
    sel.addEventListener("click", e => e.stopPropagation());
    sel.addEventListener("change", async (e) => {
      const nouvelleValeur = e.target.value;
      if (!nouvelleValeur) return;
      const cat = categories[parseInt(sel.dataset.ficheCategorie)];
      const produitsDeCat = parCategorie[cat];
      try {
        for (const p of produitsDeCat) {
          await enregistrerProduit({ ...p, imprimerDans: nouvelleValeur });
        }
        ETAT.catalogue = await recupererCatalogue();
        rendreAdminProduits(conteneur);
        afficherToast(`Fiche "${e.target.options[e.target.selectedIndex].text}" appliquée à "${cat}"`, "succes");
      } catch (err) {
        afficherToast("Erreur : " + err.message, "erreur");
      }
    });
  });

  document.getElementById("ap-nouveau").addEventListener("click", () => ouvrirFormulaireProduit(null));
  document.getElementById("ap-reinitialiser").addEventListener("click", async () => {
    if (!confirm("Remplacer le catalogue actuel par le catalogue par défaut le plus récent ? Vos commandes et comptes utilisateurs ne sont pas affectés. Les modifications manuelles faites sur les produits (prix, instructions...) seront perdues.")) return;
    try {
      await reinitialiserCatalogue();
      ETAT.catalogue = await recupererCatalogue();
      rendreAdminProduits(conteneur);
      afficherToast("Catalogue réinitialisé avec succès", "succes");
    } catch (e) { afficherToast("Erreur : " + e.message, "erreur"); }
  });
  conteneur.querySelectorAll("[data-editer]").forEach(btn => {
    btn.addEventListener("click", () => ouvrirFormulaireProduit(ETAT.catalogue.find(p => p.id === btn.dataset.editer)));
  });
  conteneur.querySelectorAll("[data-supprimer]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const p = ETAT.catalogue.find(x => x.id === btn.dataset.supprimer);
      if (!confirm(`Supprimer le produit "${p.nom}" ?`)) return;
      try {
        await supprimerProduit(p.id, p.nom);
        ETAT.catalogue = await recupererCatalogue();
        rendreAdminProduits(conteneur);
        afficherToast("Produit supprimé", "succes");
      } catch (e) { afficherToast("Erreur : " + e.message, "erreur"); }
    });
  });

  // ---- DRAG & DROP produits ----
  let dragProduitId = null;
  let dragOverRow = null;

  conteneur.querySelectorAll("[data-drag-produit]").forEach(row => {
    row.addEventListener("dragstart", e => {
      dragProduitId = row.dataset.dragProduit;
      row.style.opacity = "0.4";
      e.dataTransfer.effectAllowed = "move";
      e.stopPropagation();
    });
    row.addEventListener("dragend", () => {
      row.style.opacity = "1";
      if (dragOverRow) { dragOverRow.style.outline = ""; dragOverRow = null; }
    });
    row.addEventListener("dragover", e => {
      e.preventDefault();
      e.stopPropagation();
      if (dragOverRow && dragOverRow !== row) dragOverRow.style.outline = "";
      dragOverRow = row;
      row.style.outline = "2px solid var(--bordeaux)";
      row.style.outlineOffset = "-2px";
    });
    row.addEventListener("dragleave", () => {
      row.style.outline = "";
    });
    row.addEventListener("drop", async e => {
      e.preventDefault();
      e.stopPropagation();
      row.style.outline = "";
      const targetId = row.dataset.dragProduit;
      if (!dragProduitId || dragProduitId === targetId) return;
      const src = ETAT.catalogue.find(p => p.id === dragProduitId);
      const tgt = ETAT.catalogue.find(p => p.id === targetId);
      if (!src || !tgt || src.categorie !== tgt.categorie) {
        afficherToast("Impossible de déplacer entre catégories différentes", "erreur");
        return;
      }
      await reordonnerProduit(dragProduitId, targetId);
      ETAT.catalogue = await recupererCatalogue();
      rendreAdminProduits(conteneur);
    });
  });

  // ---- DRAG & DROP catégories ----
  let dragCat = null;
  let dragOverCat = null;

  conteneur.querySelectorAll("[data-drag-categorie]").forEach(cell => {
    const row = cell.closest("tr");
    cell.addEventListener("dragstart", e => {
      dragCat = cell.dataset.dragCategorie;
      row.style.opacity = "0.4";
      e.dataTransfer.effectAllowed = "move";
      e.stopPropagation();
    });
    cell.addEventListener("dragend", () => {
      row.style.opacity = "1";
      if (dragOverCat) { dragOverCat.closest("tr").style.outline = ""; dragOverCat = null; }
    });
    cell.addEventListener("dragover", e => {
      e.preventDefault();
      e.stopPropagation();
      if (dragOverCat && dragOverCat !== cell) dragOverCat.closest("tr").style.outline = "";
      dragOverCat = cell;
      row.style.outline = "2px solid var(--cuivre)";
      row.style.outlineOffset = "-2px";
    });
    cell.addEventListener("dragleave", () => { row.style.outline = ""; });
    cell.addEventListener("drop", e => {
      e.preventDefault();
      e.stopPropagation();
      row.style.outline = "";
      const targetCat = cell.dataset.dragCategorie;
      if (!dragCat || dragCat === targetCat) return;
      reordonnerCategorie(dragCat, targetCat);
      // Re-render après réordonnancement catégories
      const parCatLocal = {};
      ETAT.catalogue.forEach(p => {
        const c = p.categorie || "Divers";
        if (!parCatLocal[c]) parCatLocal[c] = [];
        parCatLocal[c].push(p);
      });
      rendreAdminProduits(conteneur);
    });
  });
}

function ouvrirFormulaireProduit(produitExistant) {
  const produitsSimples = ETAT.catalogue.filter(p => p.type !== "menu");
  const composition = (produitExistant && produitExistant.composition) || [];

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal">
      <h2>${produitExistant ? "Modifier le produit" : "Nouveau produit"}</h2>
      <div class="champ">
        <label>Nom *</label>
        <input type="text" id="fp-nom" value="${produitExistant ? produitExistant.nom : ''}">
      </div>
      <div class="grille-2">
        <div class="champ">
          <label>Catégorie *</label>
          <input type="text" id="fp-categorie" value="${produitExistant ? produitExistant.categorie : ''}" list="fp-categories-existantes">
          <datalist id="fp-categories-existantes">
            ${ORDRE_CATEGORIES.map(c => `<option value="${c}">`).join("")}
          </datalist>
        </div>
        <div class="champ">
          <label>Prix unitaire (€)</label>
          <input type="number" step="0.01" id="fp-prix" value="${produitExistant ? produitExistant.prix : ''}">
        </div>
      </div>
      <div class="grille-2">
        <div class="champ">
          <label>Type</label>
          <select id="fp-type">
            <option value="simple" ${!produitExistant || produitExistant.type==='simple' ? 'selected' : ''}>Unité simple (production directe)</option>
            <option value="poids" ${produitExistant && produitExistant.type==='poids' ? 'selected' : ''}>Vendu au poids (kg)</option>
            <option value="pierrade" ${produitExistant && produitExistant.type==='pierrade' ? 'selected' : ''}>Pierrade (par nombre de personnes)</option>
            <option value="menu" ${produitExistant && produitExistant.type==='menu' ? 'selected' : ''}>Menu / formule (composé de produits simples)</option>
          </select>
        </div>
        <div class="champ">
          <label>Fiche d'impression</label>
          <select id="fp-imprimer-dans">
            ${(ETAT.parametres.fichesImpression || CATEGORIES_IMPRESSION_PRODUCTION).map(c => `<option value="${c.id}" ${produitExistant && produitExistant.imprimerDans===c.id ? 'selected' : ''}>${c.label}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="champ" id="fp-actif-wrap">
        <label><input type="checkbox" id="fp-actif" ${!produitExistant || produitExistant.actif !== false ? 'checked' : ''} style="width:auto; min-height:auto;"> Produit actif (visible à la vente)</label>
      </div>
      <div class="champ">
        <label><input type="checkbox" id="fp-genere-etiquette" ${!produitExistant || produitExistant.genereEtiquette !== false ? 'checked' : ''} style="width:auto; min-height:auto;"> Imprimer des étiquettes pour ce produit <span style="font-weight:400; color:var(--charbon-clair);">(apparaît dans l'onglet « Étiquettes »)</span></label>
      </div>
      <div class="champ">
        <label style="font-weight:700; display:block; margin-bottom:6px;">Options personnalisées</label>
        <p style="font-size:0.82rem; color:var(--charbon-clair); margin:0 0 10px 0;">Groupes d’options proposés à la commande (ex : Farce, Sauce, Cuisson). La première valeur est sélectionnée par défaut.</p>
        <div id="fp-options-liste">
          ${obtenirOptionsPersonnalisees(produitExistant || {}).map((g, gi) => `
            <div class="fp-option-groupe" data-gi="${gi}" style="border:1px solid var(--gris-ligne); border-radius:var(--radius-sm); padding:10px; margin-bottom:8px; background:var(--creme-fonce);">
              <div style="display:flex; gap:8px; align-items:center; margin-bottom:6px;">
                <input type="text" class="fp-option-nom" value="${g.nom}" placeholder="Nom (ex: Farce)" style="flex:1; min-height:34px; font-size:0.9rem;">
                <button type="button" class="fp-option-supprimer btn btn-fantome btn-sm" style="min-height:34px; color:#b3261e;">✕</button>
              </div>
              <label style="font-size:0.82rem; color:var(--charbon-clair); display:block; margin-bottom:4px;">Valeurs (une par ligne)</label>
              <textarea class="fp-option-valeurs" style="height:70px; font-size:0.85rem;" placeholder="Option 1\nOption 2">${g.valeurs.join("\n")}</textarea>
            </div>
          `).join("")}
        </div>
        <button type="button" id="fp-ajouter-option" class="btn btn-fantome btn-sm" style="margin-top:4px;">+ Ajouter un groupe d’options</button>
      </div>
      <div class="champ">
        <label><input type="checkbox" id="fp-multi-variante" ${produitExistant && produitExistant.multiVariante ? 'checked' : ''} style="width:auto; min-height:auto;"> Permettre plusieurs lignes par commande <span style="font-weight:400; color:var(--charbon-clair);">(ex : 2 rôtis de poids différents, farces différentes)</span></label>
        <p id="fp-multi-variante-info" style="${produitExistant && produitExistant.multiVariante ? '' : 'display:none;'} font-size:0.82rem; color:var(--cuivre); margin:6px 0 0 0;">⚠️ Recommandé pour les produits au poids avec farce (rôtis, volailles farcies). Non compatible avec les produits à l'unité simple.</p>
      </div>
      <div class="champ">
        <label>Instructions de cuisson (affichées sur l'étiquette, une par ligne)</label>
        <textarea id="fp-instructions-cuisson" placeholder="Sortir du réfrigérateur 1h avant&#10;Préchauffer le four à 170°C&#10;Temps de cuisson : ...">${produitExistant ? (produitExistant.instructionsCuisson || "") : ""}</textarea>
      </div>
      <div class="champ">
        <label style="font-weight:700; display:block; margin-bottom:4px;">🧾 Fiche technique (recette)</label>
        <p style="font-size:0.82rem; color:var(--charbon-clair); margin:0 0 10px 0;">Quantités pour <strong>1 unité / 1 personne</strong>. Utilisées dans Production → Ingrédients pour calculer les totaux à commander.</p>
        <div id="fp-recette-liste">
          ${((produitExistant && produitExistant.recette) || []).map((ing, i) => `
            <div class="fp-recette-ligne" data-ri="${i}" style="display:flex; gap:8px; margin-bottom:6px; align-items:center;">
              <input type="text" class="fp-ing-nom" value="${ing.nom}" placeholder="Ingrédient" style="flex:2; min-height:34px; font-size:0.9rem;">
              <input type="number" class="fp-ing-qte" value="${ing.quantite}" min="0" step="0.1" style="width:80px; min-height:34px; font-size:0.9rem;">
              <select class="fp-ing-unite" style="width:100px; min-height:34px; font-size:0.9rem;">
                ${["g","kg","ml","L","cl","pièce(s)"].map(u => `<option ${u===ing.unite?'selected':''}>${u}</option>`).join("")}
              </select>
              <button type="button" class="fp-recette-supprimer btn btn-fantome btn-sm" style="min-height:34px; color:#b3261e;">✕</button>
            </div>
          `).join("")}
        </div>
        <button type="button" id="fp-ajouter-ingredient" class="btn btn-fantome btn-sm" style="margin-top:4px;">+ Ajouter un ingrédient</button>
      </div>
      <div id="fp-composition-zone"></div>
      <div style="display:flex; gap:10px; margin-top:16px;">
        <button class="btn btn-primaire" id="fp-enregistrer">Enregistrer</button>
        <button class="btn btn-fantome" id="fp-annuler">Annuler</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  function rendreZoneComposition() {
    const zone = document.getElementById("fp-composition-zone");
    const typeActuel = document.getElementById("fp-type").value;
    if (typeActuel !== "menu") { zone.innerHTML = ""; return; }
    zone.innerHTML = `
      <div class="champ">
        <label>Composition du menu (produits simples décomposés en production)</label>
        <div id="fp-lignes-composition">
          ${composition.map((c, i) => ligneCompositionHTML(c, i, produitsSimples)).join("")}
        </div>
        <button type="button" class="btn btn-fantome btn-sm" id="fp-ajouter-composant" style="margin-top:8px;">+ Ajouter un composant</button>
      </div>
    `;
    document.getElementById("fp-ajouter-composant").addEventListener("click", () => {
      composition.push({ produitId: produitsSimples[0] ? produitsSimples[0].id : "", quantite: 1 });
      rendreZoneComposition();
    });
    zone.querySelectorAll("[data-supprimer-composant]").forEach(btn => {
      btn.addEventListener("click", () => { composition.splice(parseInt(btn.dataset.supprimerComposant), 1); rendreZoneComposition(); });
    });
  }

  function ligneCompositionHTML(c, i, produitsSimples) {
    return `
      <div style="display:flex; gap:8px; margin-bottom:8px; align-items:center;" data-ligne-composant="${i}">
        <select data-composant-produit="${i}" style="flex:2; min-height:40px;">
          ${produitsSimples.map(p => `<option value="${p.id}" ${p.id === c.produitId ? 'selected' : ''}>${p.nom}</option>`).join("")}
        </select>
        <input type="number" min="1" data-composant-quantite="${i}" value="${c.quantite}" style="width:70px; min-height:40px;">
        <button type="button" class="btn btn-fantome btn-sm" data-supprimer-composant="${i}">✕</button>
      </div>
    `;
  }

  document.getElementById("fp-type").addEventListener("change", rendreZoneComposition);
  rendreZoneComposition();

  // Options personnalisées — ajouter/supprimer groupes
  function _rendreGroupeOption(g) {
    const div = document.createElement("div");
    div.className = "fp-option-groupe";
    div.style.cssText = "border:1px solid var(--gris-ligne); border-radius:var(--radius-sm); padding:10px; margin-bottom:8px; background:var(--creme-fonce);";
    const nom = g ? g.nom : "";
    const valeurs = g ? g.valeurs.join("\n") : "";
    div.innerHTML = `
      <div style="display:flex; gap:8px; align-items:center; margin-bottom:6px;">
        <input type="text" class="fp-option-nom" value="${nom}" placeholder="Nom (ex: Farce)" style="flex:1; min-height:34px; font-size:0.9rem;">
        <button type="button" class="fp-option-supprimer btn btn-fantome btn-sm" style="min-height:34px; color:#b3261e;">✕</button>
      </div>
      <label style="font-size:0.82rem; color:var(--charbon-clair); display:block; margin-bottom:4px;">Valeurs (une par ligne)</label>
      <textarea class="fp-option-valeurs" style="height:70px; font-size:0.85rem;" placeholder="Option 1\nOption 2">${valeurs}</textarea>
    `;
    div.querySelector(".fp-option-supprimer").addEventListener("click", () => div.remove());
    return div;
  }
  document.getElementById("fp-ajouter-option").addEventListener("click", () => {
    document.getElementById("fp-options-liste").appendChild(_rendreGroupeOption(null));
  });
  document.getElementById("fp-options-liste").querySelectorAll(".fp-option-supprimer").forEach(btn => {
    btn.addEventListener("click", () => btn.closest(".fp-option-groupe").remove());
  });
  // Toggle info multi-variante
  document.getElementById("fp-multi-variante").addEventListener("change", e => {
    document.getElementById("fp-multi-variante-info").style.display = e.target.checked ? "" : "none";
  });

  // ── Fiche technique (recette) ──────────────────────────────
  function _nouvelleLigneIngredient() {
    const div = document.createElement("div");
    div.className = "fp-recette-ligne";
    div.style.cssText = "display:flex; gap:8px; margin-bottom:6px; align-items:center;";
    div.innerHTML = `
      <input type="text" class="fp-ing-nom" placeholder="Ingrédient" style="flex:2; min-height:34px; font-size:0.9rem;">
      <input type="number" class="fp-ing-qte" value="1" min="0" step="0.1" style="width:80px; min-height:34px; font-size:0.9rem;">
      <select class="fp-ing-unite" style="width:100px; min-height:34px; font-size:0.9rem;">
        ${["g","kg","ml","L","cl","pièce(s)"].map(u => `<option>${u}</option>`).join("")}
      </select>
      <button type="button" class="fp-recette-supprimer btn btn-fantome btn-sm" style="min-height:34px; color:#b3261e;">✕</button>
    `;
    div.querySelector(".fp-recette-supprimer").addEventListener("click", () => div.remove());
    return div;
  }
  document.getElementById("fp-ajouter-ingredient").addEventListener("click", () => {
    document.getElementById("fp-recette-liste").appendChild(_nouvelleLigneIngredient());
  });
  document.querySelectorAll("#fp-recette-liste .fp-recette-supprimer").forEach(btn => {
    btn.addEventListener("click", () => btn.closest(".fp-recette-ligne").remove());
  });

  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  document.getElementById("fp-annuler").addEventListener("click", () => overlay.remove());

  document.getElementById("fp-enregistrer").addEventListener("click", async () => {
    const nom = document.getElementById("fp-nom").value.trim();
    const categorie = document.getElementById("fp-categorie").value.trim();
    const prix = parseFloat(document.getElementById("fp-prix").value) || 0;
    const type = document.getElementById("fp-type").value;
    const actif = document.getElementById("fp-actif").checked;
    const genereEtiquette = document.getElementById("fp-genere-etiquette").checked;
    const optionsPersonnalisees = [];
    document.querySelectorAll("#fp-options-liste .fp-option-groupe").forEach(groupe => {
      const nom = groupe.querySelector(".fp-option-nom").value.trim();
      const valeurs = groupe.querySelector(".fp-option-valeurs").value.split("\n").map(s => s.trim()).filter(Boolean);
      if (nom && valeurs.length > 0) optionsPersonnalisees.push({ nom, valeurs });
    });
    // Rétro-compat : peupler optionsFarce si un groupe "Farce" existe
    const _gFarce = optionsPersonnalisees.find(g => g.nom.toLowerCase() === "farce");
    const optionsFarce = _gFarce ? _gFarce.valeurs : [];
    const multiVariante = document.getElementById("fp-multi-variante").checked;
    const imprimerDans = document.getElementById("fp-imprimer-dans").value;
    const instructionsCuisson = document.getElementById("fp-instructions-cuisson").value.trim();

    if (!nom || !categorie) { afficherToast("Nom et catégorie requis", "erreur"); return; }

    // Récupérer composition à jour depuis le DOM
    let compositionFinale = [];
    if (type === "menu") {
      const lignes = document.querySelectorAll("[data-ligne-composant]");
      compositionFinale = Array.from(lignes).map(ligne => {
        const idx = ligne.dataset.ligneComposant;
        const produitId = document.querySelector(`[data-composant-produit="${idx}"]`).value;
        const quantite = parseInt(document.querySelector(`[data-composant-quantite="${idx}"]`).value, 10) || 1;
        return { produitId, quantite };
      });
    }

    const id = produitExistant ? produitExistant.id : nom.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") + "_" + Date.now().toString(36);

    // Recette
    const recette = [];
    document.querySelectorAll("#fp-recette-liste .fp-recette-ligne").forEach(ligne => {
      const nomIng = ligne.querySelector(".fp-ing-nom").value.trim();
      const qte = parseFloat(ligne.querySelector(".fp-ing-qte").value) || 0;
      const unite = ligne.querySelector(".fp-ing-unite").value;
      if (nomIng && qte > 0) recette.push({ nom: nomIng, quantite: qte, unite });
    });

    const produit = { id, nom, categorie, prix, type, actif, genereEtiquette, optionsPersonnalisees, optionsFarce, multiVariante, imprimerDans, instructionsCuisson, recette };
    if (type === "menu") produit.composition = compositionFinale;

    try {
      await enregistrerProduit(produit);
      ETAT.catalogue = await recupererCatalogue();
      overlay.remove();
      rendreAdmin(document.getElementById("contenu-principal"));
      afficherToast("Produit enregistré", "succes");
    } catch (e) { afficherToast("Erreur : " + e.message, "erreur"); }
  });
}

// ------------------------------------------------------------
// PÉRIODES ÉVÉNEMENTIELLES
// ------------------------------------------------------------
function rendreAdminPeriodes(conteneur) {
  const periodes = ETAT.parametres.periodes || [];
  conteneur.innerHTML = `
    <div class="carte-titre">
      <h2 style="margin:0;">Périodes événementielles</h2>
    </div>
    <div class="carte" style="margin-bottom:18px;">
      <h3>Créer une période</h3>
      <div class="grille-2">
        <div class="champ"><label>Nom (ex: Noël 2026)</label><input type="text" id="np-nom"></div>
        <div class="champ"><label>Jours inclus (séparés par des virgules, format YYYY-MM-DD)</label><input type="text" id="np-jours" placeholder="2026-12-24, 2026-12-25, 2026-12-31"></div>
      </div>
      <button class="btn btn-primaire" id="np-creer">Créer la période</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Nom</th><th>Jours</th><th></th></tr></thead>
        <tbody>
          ${periodes.map(p => `
            <tr><td>${p.nom}</td><td>${(p.jours||[]).map(formaterDate).join(", ")}</td>
            <td><button class="btn btn-fantome btn-sm" data-supprimer-periode="${p.id}" style="color:#b3261e; font-size:1rem; padding:2px 8px;" title="Supprimer">✕</button></td></tr>
          `).join("") || '<tr><td colspan="3" style="text-align:center; color:var(--charbon-clair);">Aucune période créée</td></tr>'}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById("np-creer").addEventListener("click", async () => {
    const nom = document.getElementById("np-nom").value.trim();
    const joursStr = document.getElementById("np-jours").value.trim();
    if (!nom) { afficherToast("Nom requis", "erreur"); return; }
    const jours = joursStr.split(",").map(j => j.trim()).filter(Boolean);
    try {
      await ajouterPeriode({ nom, jours });
      ETAT.parametres = await recupererParametres();
      rendreAdminPeriodes(conteneur);
      afficherToast("Période créée", "succes");
    } catch (e) { afficherToast("Erreur : " + e.message, "erreur"); }
  });

  conteneur.querySelectorAll("[data-supprimer-periode]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Supprimer cette période ?")) return;
      try {
        await supprimerPeriode(btn.dataset.supprimerPeriode);
        ETAT.parametres = await recupererParametres();
        rendreAdminPeriodes(conteneur);
        afficherToast("Période supprimée", "succes");
      } catch (e) { afficherToast("Erreur : " + e.message, "erreur"); }
    });
  });
}

// ------------------------------------------------------------
// MAGASINS
// ------------------------------------------------------------
function rendreAdminMagasins(conteneur) {
  const magasins = ETAT.parametres.magasins || MAGASINS;
  conteneur.innerHTML = `
    <div class="carte-titre"><h2 style="margin:0;">Magasins</h2></div>
    <div class="carte" style="margin-bottom:18px;">
      <h3>Ajouter un magasin</h3>
      <div class="grille-2">
        <div class="champ"><label>Nom</label><input type="text" id="am-nom"></div>
        <div class="champ">
          <label>Code étiquette <span style="font-weight:400; color:var(--charbon-clair);">(2–4 lettres)</span></label>
          <input type="text" id="am-code" maxlength="4" placeholder="ex: GS" style="text-transform:uppercase; max-width:120px;">
        </div>
      </div>
      <button class="btn btn-primaire" id="am-ajouter">Ajouter</button>
    </div>
    <div class="table-wrap" id="table-wrap-magasins">
      <table>
        <thead>
          <tr>
            <th>Nom</th>
            <th>Identifiant</th>
            <th>Code étiquette</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${magasins.map(m => {
            const codeEffectif = m.code || (MAGASINS.find(d => d.id === m.id) || {}).code || "";
            return `
            <tr>
              <td data-label="nom">${m.nom}</td>
              <td data-label="id"><code>${m.id}</code></td>
              <td data-label="code">
                <div style="display:flex; align-items:center; gap:6px;">
                  <input type="text" data-code-magasin="${m.id}" value="${codeEffectif}"
                    maxlength="4" placeholder="—"
                    style="width:56px; text-transform:uppercase; font-weight:700; font-size:0.95rem;
                      padding:4px 6px; border:1px solid var(--gris-ligne); border-radius:6px; text-align:center;">
                  <button class="btn btn-fantome btn-sm" data-sauver-code="${m.id}" title="Enregistrer">✓</button>
                </div>
              </td>
              <td data-label="suppr">
                <button class="btn btn-fantome btn-sm" data-supprimer-magasin="${m.id}" style="color:#b3261e; font-size:1rem; padding:2px 8px;" title="Supprimer">✕</button>
              </td>
            </tr>
          `}).join("")}
        </tbody>
      </table>
    </div>
    <p style="font-size:0.82rem; color:var(--charbon-clair); margin-top:10px;">
      Le code s'affiche sur les étiquettes. Modifiez-le dans le champ et cliquez ✓ (ou appuyez sur Entrée) pour enregistrer.
    </p>
  `;

  document.getElementById("am-ajouter").addEventListener("click", async () => {
    const nom = document.getElementById("am-nom").value.trim();
    const code = document.getElementById("am-code").value.trim().toUpperCase();
    if (!nom) { afficherToast("Nom requis", "erreur"); return; }
    const id = nom.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-");
    const nouveauxMagasins = [...magasins, { id, nom, ...(code ? { code } : {}) }];
    try {
      await enregistrerParametres({ magasins: nouveauxMagasins });
      ETAT.parametres = await recupererParametres();
      rendreAdminMagasins(conteneur);
      afficherToast("Magasin ajouté", "succes");
    } catch (e) { afficherToast("Erreur : " + e.message, "erreur"); }
  });

  async function sauvegarderCodeMagasin(magasinId) {
    const input = conteneur.querySelector(`[data-code-magasin="${magasinId}"]`);
    const code = input ? input.value.trim().toUpperCase() : "";
    const idx = magasins.findIndex(m => m.id === magasinId);
    if (idx === -1) return;
    const nouveauxMagasins = [...magasins];
    nouveauxMagasins[idx] = { ...nouveauxMagasins[idx], code };
    try {
      enregistrerParametres({ magasins: nouveauxMagasins }).then(async () => {
        ETAT.parametres = await recupererParametres();
        afficherToast("Code mis à jour", "succes");
      });
    } catch (e) { afficherToast("Erreur : " + e.message, "erreur"); }
  }

  conteneur.querySelectorAll("[data-sauver-code]").forEach(btn => {
    btn.addEventListener("click", () => sauvegarderCodeMagasin(btn.dataset.sauverCode));
  });

  conteneur.querySelectorAll("[data-code-magasin]").forEach(input => {
    input.addEventListener("keydown", e => {
      if (e.key === "Enter") sauvegarderCodeMagasin(input.dataset.codeMagasin);
    });
  });

  conteneur.querySelectorAll("[data-supprimer-magasin]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.supprimerMagasin;
      const m = magasins.find(x => x.id === id);
      if (!confirm(`Supprimer le magasin "${m ? m.nom : id}" ?`)) return;
      const nouveauxMagasins = magasins.filter(x => x.id !== id);
      try {
        await enregistrerParametres({ magasins: nouveauxMagasins });
        ETAT.parametres = await recupererParametres();
        rendreAdminMagasins(conteneur);
        afficherToast("Magasin supprimé", "succes");
      } catch (e) { afficherToast("Erreur : " + e.message, "erreur"); }
    });
  });
}

// ------------------------------------------------------------
// UTILISATEURS
// ------------------------------------------------------------
async function rendreAdminUtilisateurs(conteneur) {
  const utilisateurs = await listerUtilisateurs();

  conteneur.innerHTML = `
    <div class="carte-titre"><h2 style="margin:0;">Utilisateurs</h2></div>

    <div class="carte" style="margin-bottom:18px;">
      <h3>Créer un compte</h3>
      <div class="grille-2">
        <div class="champ"><label>Nom</label><input type="text" id="au-nom"></div>
        <div class="champ"><label>Mot de passe</label><input type="password" id="au-mdp"></div>
      </div>
      <div class="champ">
        <label>Rôle</label>
        <select id="au-role">
          <option value="salarie">Salarié</option>
          <option value="manager">Manager</option>
          <option value="admin">Administrateur</option>
        </select>
      </div>
      <button class="btn btn-primaire" id="au-creer">Créer le compte</button>
    </div>

    <div class="table-wrap" id="table-wrap-utilisateurs">
      <table>
        <thead><tr><th>Nom</th><th>Rôle</th><th>Créé le</th><th>Actions</th></tr></thead>
        <tbody>
          ${utilisateurs.map(u => `
            <tr>
              <td data-label="nom">${u.nom}</td>
              <td data-label="date" style="font-size:0.82rem; color:var(--charbon-clair);">${u.creeLe ? new Date(u.creeLe).toLocaleDateString("fr-FR") : "—"}</td>
              <td data-label="role">
                <select data-role-uid="${u.uid}" ${u.uid === ETAT.utilisateur.uid ? "disabled" : ""} style="font-size:0.82rem; padding:4px 6px;">
                  <option value="salarie" ${u.role === "salarie" ? "selected" : ""}>Salarié</option>
                  <option value="manager" ${u.role === "manager" ? "selected" : ""}>Manager</option>
                  <option value="admin" ${u.role === "admin" ? "selected" : ""}>Administrateur</option>
                </select>
              </td>
              <td data-label="actions">
                <button class="btn btn-fantome btn-sm" data-reinit-mdp="${u.uid}" style="font-size:0.78rem;">Réinit. mdp</button>
                ${u.uid !== ETAT.utilisateur.uid ? `<button class="btn btn-fantome btn-sm" data-supprimer-user="${u.uid}" style="color:#b3261e; font-size:1rem; padding:2px 6px;" title="Supprimer">✕</button>` : ""}
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById("au-creer").addEventListener("click", async () => {
    const nom = document.getElementById("au-nom").value.trim();
    const mdp = document.getElementById("au-mdp").value;
    const role = document.getElementById("au-role").value;
    if (!nom || !mdp) { afficherToast("Nom et mot de passe requis", "erreur"); return; }
    try {
      await creerCompteLocal(nom, nom, mdp, role);
      afficherToast("Compte créé", "succes");
      rendreAdminUtilisateurs(conteneur);
    } catch (e) { afficherToast("Erreur : " + e.message, "erreur"); }
  });

  conteneur.querySelectorAll("[data-role-uid]").forEach(sel => {
    sel.addEventListener("change", async () => {
      try {
        await modifierRoleUtilisateur(sel.dataset.roleUid, sel.value);
        afficherToast("Rôle mis à jour", "succes");
      } catch (e) { afficherToast("Erreur : " + e.message, "erreur"); }
    });
  });

  conteneur.querySelectorAll("[data-reinit-mdp]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const nouveauMdp = prompt("Nouveau mot de passe :");
      if (!nouveauMdp) return;
      try {
        await reinitialiserMotDePasse(btn.dataset.reinitMdp, nouveauMdp);
        afficherToast("Mot de passe réinitialisé", "succes");
      } catch (e) { afficherToast("Erreur : " + e.message, "erreur"); }
    });
  });

  conteneur.querySelectorAll("[data-supprimer-user]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Supprimer cet utilisateur ?")) return;
      try {
        const uid = btn.dataset.supprimerUser;
        const tous = await listerUtilisateurs();
        const filtres = tous.filter(u => u.uid !== uid);
        sessionStorage.setItem("eventpro_demo_utilisateurs", JSON.stringify(filtres));
        await ajouterAuditLog("suppression_utilisateur", `Utilisateur ${uid} supprimé`);
        afficherToast("Utilisateur supprimé", "succes");
        rendreAdminUtilisateurs(conteneur);
      } catch (e) { afficherToast("Erreur : " + e.message, "erreur"); }
    });
  });
}

// ============================================================
// ONGLET : PARAMÈTRES GÉNÉRAUX
// ============================================================
async function rendreAdminParametres(conteneur) {
  const params = ETAT.parametres;
  const fiches = params.fichesImpression || [{ id: "traiteur", label: "Traiteur" }, { id: "boucherie", label: "Boucherie" }, { id: "pierrades", label: "Pierrades" }];
  const instructions = params.instructionsCommande || [];
  const themes = [
    { id: "bordeaux", label: "Bordeaux (défaut)", couleur: "#7a1f2b" },
    { id: "bleu",     label: "Bleu marine",       couleur: "#1a4a7a" },
    { id: "vert",     label: "Vert forêt",         couleur: "#1a5c3a" },
    { id: "ardoise",  label: "Ardoise / violet",   couleur: "#374151" },
    { id: "orange",   label: "Ambre / boulangerie",couleur: "#92400e" },
    { id: "noir",     label: "Noir & or",           couleur: "#000000" }
  ];

  conteneur.innerHTML = `
    <div class="carte" style="margin-bottom:20px;">
      <h2 style="margin:0 0 18px;">Identité de l'application</h2>
      <div class="grille-2">
        <div class="champ">
          <label>Nom de l'entreprise</label>
          <input type="text" id="pg-nom" value="${params.nomEntreprise || "Vanbaelinghem"}" placeholder="Ex: Boulangerie Martin">
        </div>
        <div class="champ">
          <label>Sous-titre (après le nom dans le bandeau)</label>
          <input type="text" id="pg-sous-nom" value="${params.sousNomEntreprise || "commandes"}" placeholder="Ex: commandes, livraisons...">
        </div>
        <div class="champ">
          <label>Préfixe des numéros de commande</label>
          <input type="text" id="pg-prefixe" value="${params.prefixeCommande || "CMD"}" placeholder="Ex: CMD, VAN, BOU" maxlength="6" style="text-transform:uppercase;">
          <small style="color:var(--charbon-clair); font-size:0.8rem;">
            Aperçu : <strong>${params.prefixeCommande || "CMD"}-${"0".repeat((params.digitsNumero||5)-2)}42</strong>
          </small>
        </div>
        <div class="champ">
          <label>Nombre de chiffres dans le numéro</label>
          <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:4px;">
            ${[3,4,5,6].map(n => `
              <label style="display:flex; align-items:center; gap:6px; cursor:pointer; padding:8px 14px; border:2px solid ${(params.digitsNumero||5)===n ? "var(--bordeaux)" : "var(--gris-ligne)"}; border-radius:8px; background:${(params.digitsNumero||5)===n ? "var(--bordeaux-clair,#a32d3d)15" : "white"};">
                <input type="radio" name="pg-digits" value="${n}" ${(params.digitsNumero||5)===n ? "checked" : ""} style="width:auto; min-height:auto; accent-color:var(--bordeaux);">
                ${n} chiffres <span style="font-family:monospace; font-size:0.82rem; color:var(--charbon-clair);">(ex: ${"0".repeat(n-2)}42)</span>
              </label>
            `).join("")}
          </div>
        </div>
        <div class="champ" style="margin-top:4px;">
          <label style="display:flex; align-items:center; gap:10px; cursor:pointer; font-weight:400;">
            <input type="checkbox" id="pg-reset-annuel" ${params.resetAnnuel !== false ? "checked" : ""} style="width:auto; min-height:auto; accent-color:var(--bordeaux); width:18px; height:18px;">
            <span>Remettre le compteur à zéro chaque 1er janvier</span>
          </label>
          <small style="color:var(--charbon-clair); font-size:0.8rem; margin-left:28px;">
            ${params.resetAnnuel !== false ? "✅ Actif — la numérotation repartira à 00001 le 1er janvier prochain." : "⏸ Désactivé — le compteur continue indéfiniment."}
          </small>
        </div>
      </div>
      <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-top:4px;">
        <button class="btn btn-primaire btn-sm" id="pg-sauver-identite">Enregistrer l'identité</button>
        <button class="btn btn-secondaire btn-sm" id="pg-migrer-numeros">🔄 Renuméroter les anciennes commandes</button>
        <span id="pg-migrer-status" style="font-size:0.85rem; color:var(--charbon-clair);"></span>
      </div>
    </div>

    <div class="carte" style="margin-bottom:20px;">
      <h2 style="margin:0 0 18px;">Thème couleur</h2>
      <div style="display:flex; flex-wrap:wrap; gap:12px; margin-bottom:16px;" id="pg-themes">
        ${themes.map(t => `
          <label style="display:flex; align-items:center; gap:8px; cursor:pointer; padding:10px 16px; border:2px solid ${(params.theme || "bordeaux") === t.id ? t.couleur : "var(--gris-ligne)"}; border-radius:8px; background:${(params.theme || "bordeaux") === t.id ? t.couleur + "15" : "white"};">
            <input type="radio" name="pg-theme" value="${t.id}" ${(params.theme || "bordeaux") === t.id ? "checked" : ""} style="width:auto; min-height:auto; accent-color:${t.couleur};">
            <span style="width:16px; height:16px; border-radius:50%; background:${t.couleur}; display:inline-block; flex-shrink:0;"></span>
            ${t.label}
          </label>
        `).join("")}
      </div>
      <button class="btn btn-primaire btn-sm" id="pg-sauver-theme">Appliquer le thème</button>
    </div>

    <div class="carte" style="margin-bottom:20px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
        <h2 style="margin:0;">Fiches d'impression</h2>
        <button class="btn btn-primaire btn-sm" id="pg-ajouter-fiche">+ Ajouter une fiche</button>
      </div>
      <p style="color:var(--charbon-clair); font-size:0.85rem; margin-bottom:12px;">Chaque produit est assigné à une fiche. Ces fiches servent à séparer les impressions en production (ex: Traiteur, Boucherie, Boulangerie...).</p>
      <div id="pg-liste-fiches">
        ${fiches.map((f, i) => `
          <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px;" data-fiche-idx="${i}">
            <input type="text" data-fiche-label="${i}" value="${f.label}" style="flex:1; min-height:36px; padding:6px 10px; border:1px solid var(--gris-ligne); border-radius:6px;">
            <button class="btn btn-fantome btn-sm" data-supprimer-fiche="${i}" style="color:#b3261e; flex-shrink:0;">✕</button>
          </div>
        `).join("")}
      </div>
      <button class="btn btn-secondaire btn-sm" id="pg-sauver-fiches" style="margin-top:8px;">Enregistrer les fiches</button>
    </div>

    <div class="carte" style="margin-top:18px;">
      <h3 style="margin-bottom:12px;">Statuts de commande</h3>
      <p style="font-size:0.85rem; color:var(--charbon-clair); margin:0 0 14px 0;">Personnalisez les étapes du cycle de vie d'une commande. Les 5 premiers statuts sont les statuts système (non supprimables).</p>
      <div id="pg-statuts-zone"></div>
    </div>

    <div class="carte">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
        <h2 style="margin:0;">Instructions de commande</h2>
        <button class="btn btn-primaire btn-sm" id="pg-ajouter-instruction">+ Ajouter</button>
      </div>
      <p style="color:var(--charbon-clair); font-size:0.85rem; margin-bottom:12px;">Cases à cocher proposées lors de la saisie d'une nouvelle commande (ex: Fragile, VIP, Allergie...).</p>
      <div id="pg-liste-instructions">
        ${instructions.map((ins, i) => `
          <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap; margin-bottom:8px;">
            <input type="text" data-ins-icone="${i}" value="${ins.icone || ""}" placeholder="🎁" style="width:52px; min-height:34px; padding:5px; border:1px solid var(--gris-ligne); border-radius:6px; text-align:center; font-size:1.1rem; flex-shrink:0;">
            <input type="text" data-ins-label="${i}" value="${ins.label}" placeholder="Label..." style="flex:1; min-width:110px; min-height:34px; padding:5px 10px; border:1px solid var(--gris-ligne); border-radius:6px;">
            <input type="text" data-ins-id="${i}" value="${ins.id}" placeholder="id_unique" style="width:110px; min-height:34px; padding:5px 8px; border:1px solid var(--gris-ligne); border-radius:6px; font-size:0.8rem; color:var(--charbon-clair);">
            <label title="Afficher dans Nouvelle commande" style="display:flex; align-items:center; gap:4px; white-space:nowrap; font-size:0.82rem; cursor:pointer; user-select:none; flex-shrink:0;">
              <input type="checkbox" data-ins-visible="${i}" ${ins.visibleNC !== false ? 'checked' : ''}> <span class="material-symbols-outlined" style="font-size:1rem; vertical-align:middle;" title="Visible dans Nouvelle commande">visibility</span>
            </label>
            <button class="btn btn-fantome btn-sm" data-supprimer-ins="${i}" style="color:#b3261e; flex-shrink:0; padding:4px 8px;">✕</button>
          </div>
        `).join("")}
      </div>
      <button class="btn btn-secondaire btn-sm" id="pg-sauver-instructions" style="margin-top:8px;">Enregistrer les instructions</button>
    </div>
  `;

  // Identité
  document.getElementById("pg-sauver-identite").addEventListener("click", async () => {
    const nom = document.getElementById("pg-nom").value.trim();
    const sousNom = document.getElementById("pg-sous-nom").value.trim();
    const prefixe = document.getElementById("pg-prefixe").value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    const digits = parseInt(document.querySelector('input[name="pg-digits"]:checked')?.value || "5");
    const resetAnnuel = document.getElementById("pg-reset-annuel").checked;
    if (!nom) { afficherToast("Le nom est requis", "erreur"); return; }
    await enregistrerParametres({ nomEntreprise: nom, sousNomEntreprise: sousNom, prefixeCommande: prefixe || "CMD", digitsNumero: digits, resetAnnuel });
    ETAT.parametres = await recupererParametres();
    afficherToast("Paramètres enregistrés — rechargez pour voir le nom mis à jour dans le bandeau", "succes");
  });

  // Migration numéros
  document.getElementById("pg-migrer-numeros").addEventListener("click", async () => {
    const btn = document.getElementById("pg-migrer-numeros");
    const status = document.getElementById("pg-migrer-status");
    if (!confirm("Renuméroter toutes les commandes existantes au format PREFIXE-AAAA-NNNNN ?\n\nCette action est irréversible (sauf restauration depuis une sauvegarde).")) return;
    btn.disabled = true;
    status.textContent = "Migration en cours...";
    try {
      await migrerNumerosCommandes();
      status.textContent = "✅ Renumérotation terminée !";
      afficherToast("Commandes renumérotées avec succès", "succes");
    } catch(e) {
      status.textContent = "❌ Erreur : " + e.message;
      afficherToast("Erreur lors de la migration", "erreur");
    } finally {
      btn.disabled = false;
    }
  });

  // Thème
  document.getElementById("pg-sauver-theme").addEventListener("click", async () => {
    const theme = document.querySelector('input[name="pg-theme"]:checked')?.value || "bordeaux";
    await enregistrerParametres({ theme });
    ETAT.parametres = await recupererParametres();
    appliquerTheme(theme);
    afficherToast("Thème appliqué !", "succes");
  });

  // Fiches d'impression — ajouter
  document.getElementById("pg-ajouter-fiche").addEventListener("click", async () => {
    const current = [...(ETAT.parametres.fichesImpression || [])];
    current.push({ id: "fiche_" + Date.now(), label: "Nouvelle fiche" });
    await enregistrerParametres({ fichesImpression: current });
    ETAT.parametres = await recupererParametres();
    rendreAdminParametres(conteneur);
  });

  // Fiches d'impression — supprimer
  conteneur.querySelectorAll("[data-supprimer-fiche]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const idx = parseInt(btn.dataset.supprimerFiche);
      const current = [...(ETAT.parametres.fichesImpression || [])];
      if (current.length <= 1) { afficherToast("Il faut au moins une fiche", "erreur"); return; }
      current.splice(idx, 1);
      await enregistrerParametres({ fichesImpression: current });
      ETAT.parametres = await recupererParametres();
      rendreAdminParametres(conteneur);
    });
  });

  // Fiches d'impression — sauvegarder labels
  document.getElementById("pg-sauver-fiches").addEventListener("click", async () => {
    const current = [...(ETAT.parametres.fichesImpression || [])];
    conteneur.querySelectorAll("[data-fiche-label]").forEach(inp => {
      const i = parseInt(inp.dataset.ficheLabel);
      if (current[i]) current[i] = { ...current[i], label: inp.value.trim() || current[i].label };
    });
    await enregistrerParametres({ fichesImpression: current });
    ETAT.parametres = await recupererParametres();
    afficherToast("Fiches enregistrées", "succes");
  });

  // Instructions — ajouter
  document.getElementById("pg-ajouter-instruction").addEventListener("click", async () => {
    const current = [...(ETAT.parametres.instructionsCommande || [])];
    current.push({ id: "ins_" + Date.now(), label: "", icone: "📌" });
    await enregistrerParametres({ instructionsCommande: current });
    ETAT.parametres = await recupererParametres();
    rendreAdminParametres(conteneur);
  });

  // Instructions — supprimer
  conteneur.querySelectorAll("[data-supprimer-ins]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const idx = parseInt(btn.dataset.supprimerIns);
      const current = [...(ETAT.parametres.instructionsCommande || [])];
      current.splice(idx, 1);
      await enregistrerParametres({ instructionsCommande: current });
      ETAT.parametres = await recupererParametres();
      rendreAdminParametres(conteneur);
    });
  });

  // Instructions — sauvegarder
  document.getElementById("pg-sauver-instructions").addEventListener("click", async () => {
    const current = [...(ETAT.parametres.instructionsCommande || [])];
    const icones = conteneur.querySelectorAll("[data-ins-icone]");
    const labels = conteneur.querySelectorAll("[data-ins-label]");
    const ids = conteneur.querySelectorAll("[data-ins-id]");
    const visibles = conteneur.querySelectorAll("[data-ins-visible]");
    icones.forEach((el, i) => {
      if (current[i]) current[i] = {
        ...current[i],
        icone: el.value.trim() || "📌",
        label: labels[i] && labels[i].value.trim() ? labels[i].value.trim() : current[i].label,
        id: ids[i] && ids[i].value.trim() ? ids[i].value.trim() : current[i].id,
        visibleNC: visibles[i] ? visibles[i].checked : true
      };
    });
    await enregistrerParametres({ instructionsCommande: current });
    ETAT.parametres = await recupererParametres();
    afficherToast("Instructions enregistrées", "succes");
  });
}

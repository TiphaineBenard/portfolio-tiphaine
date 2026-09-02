// ============================================================
// APPLICATION PRINCIPALE — routage, état, authentification
// ============================================================

const ETAT = {
  vueActive: "connexion",
  catalogue: [],
  parametres: { magasins: MAGASINS, periodes: [] },
  utilisateur: { nom: null, role: null, uid: null, estInvite: false },
  desabonnements: []
};

function nettoyerEcoutes() {
  ETAT.desabonnements.forEach(fn => { try { fn(); } catch(e){} });
  ETAT.desabonnements = [];
}

function afficherToast(message, type = "info") {
  const div = document.createElement("div");
  div.className = "toast" + (type === "erreur" ? " erreur" : type === "succes" ? " succes" : "");
  div.textContent = message;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3500);
}

function formaterDate(dateStr) {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function formaterMontant(n) {
  return (n || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function nomMagasin(id) {
  const m = ETAT.parametres.magasins.find(x => x.id === id);
  return m ? m.nom : id;
}

function codeMagasin(id) {
  // Priorité 1 : code personnalisé enregistré par l'admin dans les paramètres
  const m = ETAT.parametres.magasins.find(x => x.id === id);
  if (m && m.code) return m.code;
  // Priorité 2 : code défini dans config.js (MAGASINS)
  const def = MAGASINS.find(d => d.id === id);
  if (def && def.code) return def.code;
  // Repli : 3 premières lettres du nom
  return m ? m.nom.slice(0, 3).toUpperCase() : id;
}

function trouverStatut(id) {
  const liste = (ETAT.parametres && ETAT.parametres.statuts) ? ETAT.parametres.statuts : STATUTS;
  return liste.find(s => s.id === id) || liste[0];
}

// ------------------------------------------------------------
// INITIALISATION
// ------------------------------------------------------------
async function demarrerApplication() {
  initFirebase();

  // Mode local : si un manager/admin était connecté lors de la session
  // précédente (même onglet), on le restaure.
  const managerSauvegarde = sessionStorage.getItem("eventpro_demo_manager");
  const inviteSauvegarde = sessionStorage.getItem("eventpro_demo_invite");

  if (managerSauvegarde) {
    ETAT.utilisateur = JSON.parse(managerSauvegarde);
    utilisateurCourant = ETAT.utilisateur;
    await chargerDonneesBase();
    naviguerVers("commandes");
  } else if (inviteSauvegarde) {
    ETAT.utilisateur = JSON.parse(inviteSauvegarde);
    utilisateurCourant = ETAT.utilisateur;
    await chargerDonneesBase();
    naviguerVers("nouvelle_commande");
  } else {
    await chargerDonneesBase();
    afficherEcranConnexion();
  }
}

async function chargerDonneesBase() {
  try {
    await initialiserCatalogueSiVide();
  } catch (e) { console.warn("Init catalogue:", e); }

  try {
    ETAT.catalogue = await recupererCatalogue();
  } catch (e) {
    console.warn("Catalogue local indisponible, utilisation du catalogue par défaut:", e);
    ETAT.catalogue = CATALOGUE_INITIAL;
  }

  try {
    ETAT.parametres = await recupererParametres();
  } catch (e) {
    console.warn("Paramètres locaux indisponibles:", e);
  }

  // Appliquer le thème couleur
  appliquerTheme(ETAT.parametres.theme || "bordeaux");

  // Sauvegarde automatique silencieuse à chaque ouverture de l'app
  sauvegarderAutomatiquement().catch(() => {});
}

// ------------------------------------------------------------
// CONNEXION
// ------------------------------------------------------------
async function afficherEcranConnexion() {
  const app = document.getElementById("app");
  const utilisateursExistants = await listerUtilisateurs();
  const aucunCompte = utilisateursExistants.length === 0;

  app.innerHTML = `
    <div class="ecran-centre">
      <div class="carte carte-login">
        <div class="logo-login">${ETAT.parametres && ETAT.parametres.nomEntreprise ? ETAT.parametres.nomEntreprise : "Vanbaelinghem"}</div>
        <div class="tagline">Commandes événementielles</div>

        <div class="champ" style="text-align:left;">
          <label>Je suis un salarié — saisie rapide</label>
          <select id="champ-magasin-vendeur">
            <option value="">— Choisir mon magasin —</option>
            ${ETAT.parametres.magasins.map(m => `<option value="${m.id}">${m.nom}</option>`).join("")}
          </select>
        </div>
        <button class="btn btn-primaire btn-lg" style="width:100%;" id="btn-entree-salarie">
          Commencer une commande
        </button>

        <div style="margin:24px 0; display:flex; align-items:center; gap:10px; color:var(--charbon-clair); font-size:0.85rem;">
          <div style="flex:1; height:1px; background:var(--gris-ligne);"></div>
          OU MANAGER / ADMIN
          <div style="flex:1; height:1px; background:var(--gris-ligne);"></div>
        </div>

        ${aucunCompte ? `
          <p style="font-size:0.85rem; color:var(--charbon-clair); text-align:left; margin-bottom:14px;">
            Aucun compte n'existe encore. Créez votre premier compte administrateur :
          </p>
          <div class="champ" style="text-align:left;">
            <label>Nom d'utilisateur</label>
            <input type="text" id="champ-nouveau-nom">
          </div>
          <div class="champ" style="text-align:left;">
            <label>Mot de passe</label>
            <input type="password" id="champ-nouveau-mdp">
          </div>
          <button class="btn btn-secondaire btn-lg" style="width:100%;" id="btn-creer-admin">
            Créer mon compte administrateur
          </button>
        ` : `
          <div class="champ" style="text-align:left;">
            <label>Utilisateur</label>
            <select id="champ-email">
              <option value="">— Choisir —</option>
              ${utilisateursExistants.map(u => `<option value="${u.uid}">${u.nom}</option>`).join("")}
            </select>
          </div>
          <div class="champ" style="text-align:left;">
            <label>Mot de passe</label>
            <input type="password" id="champ-mdp">
          </div>
          <button class="btn btn-secondaire btn-lg" style="width:100%;" id="btn-connexion-manager">
            Se connecter
          </button>
        `}
        <div id="erreur-connexion" style="color:#b3261e; margin-top:12px; font-size:0.88rem;"></div>
      </div>
    </div>
  `;

  document.getElementById("btn-entree-salarie").addEventListener("click", async () => {
    const magasinId = document.getElementById("champ-magasin-vendeur").value;
    if (!magasinId) { afficherToast("Merci de choisir votre magasin", "erreur"); return; }
    ETAT.utilisateur = { nom: null, role: ROLES.SALARIE, uid: null, estInvite: true, magasinId };
    utilisateurCourant = ETAT.utilisateur;
    sessionStorage.setItem("eventpro_demo_invite", JSON.stringify(ETAT.utilisateur));
    await chargerDonneesBase();
    naviguerVers("nouvelle_commande");
  });

  if (aucunCompte) {
    document.getElementById("btn-creer-admin").addEventListener("click", async () => {
      const nom = document.getElementById("champ-nouveau-nom").value.trim();
      const mdp = document.getElementById("champ-nouveau-mdp").value;
      const erreurDiv = document.getElementById("erreur-connexion");
      erreurDiv.textContent = "";
      if (!nom || !mdp) { erreurDiv.textContent = "Tous les champs sont requis."; return; }
      try {
        const compte = await creerCompteLocal(nom, nom, mdp, ROLES.ADMIN);
        ETAT.utilisateur = { nom: compte.nom, role: compte.role, uid: compte.uid, estInvite: false };
        utilisateurCourant = ETAT.utilisateur;
        sessionStorage.setItem("eventpro_demo_manager", JSON.stringify(ETAT.utilisateur));
        await chargerDonneesBase();
        afficherToast("Compte administrateur créé", "succes");
        naviguerVers("commandes");
      } catch (e) {
        erreurDiv.textContent = e.message;
      }
    });
  } else {
    document.getElementById("btn-connexion-manager").addEventListener("click", async () => {
      const uid = document.getElementById("champ-email").value;
      const mdp = document.getElementById("champ-mdp").value;
      const erreurDiv = document.getElementById("erreur-connexion");
      erreurDiv.textContent = "";
      if (!uid || !mdp) { erreurDiv.textContent = "Choisissez un utilisateur et saisissez le mot de passe."; return; }
      try {
        const compte = await connexionParUid(uid, mdp);
        ETAT.utilisateur = { nom: compte.nom, role: compte.role, uid: compte.uid, estInvite: false };
        utilisateurCourant = ETAT.utilisateur;
        sessionStorage.setItem("eventpro_demo_manager", JSON.stringify(ETAT.utilisateur));
        await chargerDonneesBase();
        naviguerVers("commandes");
      } catch (e) {
        erreurDiv.textContent = e.message;
      }
    });
  }
}

function deconnecter() {
  sessionStorage.removeItem("eventpro_demo_invite");
  sessionStorage.removeItem("eventpro_demo_manager");
  nettoyerEcoutes();
  ETAT.utilisateur = {};
  afficherEcranConnexion();
}

// ------------------------------------------------------------
// ROUTAGE
// ------------------------------------------------------------
const VUES = [
  { id: "nouvelle_commande", label: "Nouvelle commande", icon: "shopping_cart", labelCourt: "Commande", permission: "creer_commande" },
  { id: "commandes", label: "Suivi commandes", icon: "receipt_long", labelCourt: "Suivi", permission: "consulter" },
  { id: "production", label: "Production cuisine", icon: "restaurant", labelCourt: "Cuisine", permission: "consulter" },
  { id: "classeur", label: "Classeur préparation", icon: "menu_book", labelCourt: "Classeur", permission: "consulter" },
  { id: "etiquettes", label: "Étiquettes", icon: "sell", labelCourt: "Étiquettes", permission: "consulter" },
  { id: "dashboard", label: "Chiffre d'affaires", icon: "bar_chart", labelCourt: "CA", permission: "consulter" },
  { id: "admin", label: "Administration", icon: "settings", labelCourt: "Admin", permission: "gerer_parametres" },
  { id: "audit", label: "Journal d'audit", icon: "manage_search", labelCourt: "Audit", permission: "gerer_parametres" }
];

function naviguerVers(vueId) {
  ETAT.vueActive = vueId;
  rendreApplication();
}

function rendreApplication() {
  const app = document.getElementById("app");
  const role = ETAT.utilisateur.role;
  const vuesAutorisees = VUES.filter(v => aPermission(role, v.permission));

  const derniereSauvegarde = dateDerniereSauvegardeAuto();
  const heuresSansSauvegarde = derniereSauvegarde
    ? Math.round((Date.now() - derniereSauvegarde.getTime()) / 3600000)
    : null;
  const alerteSauvegarde = !derniereSauvegarde || heuresSansSauvegarde >= 24;
  const banniereAlerte = "";

  app.innerHTML = `
    <header class="entete">
      <div class="logo">${ETAT.parametres.nomEntreprise || "Vanbaelinghem"} <span class="souligne">${ETAT.parametres.sousNomEntreprise || "commandes"}</span></div>
      <div class="nav-utilisateur">
        <span class="badge-role">${role === "admin" ? "Administrateur" : role === "manager" ? "Manager" : "Salarié"}</span>
        <span>${ETAT.utilisateur.estInvite ? nomMagasin(ETAT.utilisateur.magasinId) : (ETAT.utilisateur.nom || "")}</span>
        <button id="btn-deconnexion" style="min-height:34px; padding:6px 16px; border-radius:6px; border:2px solid rgba(247,243,236,0.6); background:transparent; color:var(--creme); font-size:0.88rem; font-weight:600; cursor:pointer; letter-spacing:0.02em; transition:background 0.15s, border-color 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.15)'; this.style.borderColor='var(--creme)'" onmouseout="this.style.background='transparent'; this.style.borderColor='rgba(247,243,236,0.6)'">🔓 Déconnexion</button>
      </div>
    </header>
    ${banniereAlerte}
    <nav class="tabs-principal" style="display:flex; align-items:center;">
      <div style="display:flex; flex:1; overflow-x:auto;">
        ${vuesAutorisees.map(v => `
          <div class="tab-item ${ETAT.vueActive === v.id ? 'actif' : ''}" data-vue="${v.id}"><span class="tab-icone material-symbols-outlined" aria-hidden="true">${v.icon}</span><span class="tab-label">${v.label}</span><span class="tab-label-court">${v.labelCourt}</span></div>
        `).join("")}
      </div>
      <button id="btn-icone-sauvegarde" title="${alerteSauvegarde ? 'Sauvegarder maintenant' : 'Données sauvegardées'}"
        style="margin-right:12px; background:none; border:none; cursor:pointer; font-size:1.2rem; opacity:${alerteSauvegarde ? '1' : '0.4'}; flex-shrink:0;">
        💾
      </button>
    </nav>
    <main id="contenu-principal"></main>
  `;

  document.getElementById("btn-deconnexion").addEventListener("click", deconnecter);
  document.querySelectorAll(".tab-item").forEach(el => {
    el.addEventListener("click", () => naviguerVers(el.dataset.vue));
  });

  // Icône sauvegarde
  const btnIconeSauvegarde = document.getElementById("btn-icone-sauvegarde");
  if (btnIconeSauvegarde) {
    btnIconeSauvegarde.addEventListener("click", async () => {
      const handle = await lireHandleDossier();
      if (handle) {
        const ok = await ecrireSauvegardeAutomatique(handle, false);
        if (ok) { rendreApplication(); return; }
      }
      exporterDonnees();
    });
  }

  const conteneur = document.getElementById("contenu-principal");
  nettoyerEcoutes();

  try {
    switch (ETAT.vueActive) {
      case "nouvelle_commande": rendreNouvelleCommande(conteneur); break;
      case "commandes": rendreSuiviCommandes(conteneur); break;
      case "production": rendreProductionCuisine(conteneur); break;
      case "classeur": rendreClasseurPreparation(conteneur); break;
      case "etiquettes": rendreEcranEtiquettes(conteneur); break;
      case "dashboard": rendreDashboard(conteneur); break;
      case "admin": rendreAdmin(conteneur); break;
      case "audit": rendreAudit(conteneur); break;
      default: conteneur.innerHTML = "<p>Vue inconnue.</p>";
    }
  } catch(e) {
    conteneur.innerHTML =
      '<div style="padding:24px; font-family:monospace; font-size:12px; color:#b3261e; background:#fff0f0; margin:16px; border-radius:8px; border:2px solid #b3261e;">' +
      "<strong>Erreur ecran [" + ETAT.vueActive + "]</strong><br><br>" +
      (e.stack || e.message || String(e)).replace(/</g,"&lt;") +
      '</div>';
  }
}

document.addEventListener("DOMContentLoaded", async function() {
  function afficherErreurFatale(e) {
    document.getElementById("app").innerHTML =
      '<div style="padding:24px; font-family:monospace; font-size:12px; color:#b3261e; background:#fff0f0; margin:16px; border-radius:8px; border:2px solid #b3261e;">' +
      '<strong>Erreur au démarrage</strong><br><br>' +
      (e && e.stack ? e.stack.replace(/</g,"&lt;") : String(e)) +
      '</div>';
  }
  try {
    await demarrerApplication();
  } catch(e) {
    afficherErreurFatale(e);
  }
  window.addEventListener("unhandledrejection", function(ev) {
    afficherErreurFatale(ev.reason);
  });
});

// ============================================================
// THÈMES COULEUR
// ============================================================
const THEMES = {
  bordeaux: { bordeaux: "#7a1f2b", bordeauxFonce: "#5c1620", bordeauxClair: "#a32d3d", cuivre: "#b87333", cuivreClair: "#d4955f" },
  bleu:     { bordeaux: "#1a4a7a", bordeauxFonce: "#0f2d52", bordeauxClair: "#2563a8", cuivre: "#3b82f6", cuivreClair: "#60a5fa" },
  vert:     { bordeaux: "#1a5c3a", bordeauxFonce: "#0f3d26", bordeauxClair: "#25804f", cuivre: "#2f7a4f", cuivreClair: "#4ead78" },
  ardoise:  { bordeaux: "#374151", bordeauxFonce: "#1f2937", bordeauxClair: "#4b5563", cuivre: "#6366f1", cuivreClair: "#818cf8" },
  orange:   { bordeaux: "#92400e", bordeauxFonce: "#6b2d07", bordeauxClair: "#b45309", cuivre: "#d97706", cuivreClair: "#f59e0b" },
  noir:     { bordeaux: "#000000", bordeauxFonce: "#2e2e2e", bordeauxClair: "#444444", cuivre: "#d4af37", cuivreClair: "#f0cc5a" }
};

function appliquerTheme(themeId) {
  const t = THEMES[themeId] || THEMES.bordeaux;
  const root = document.documentElement;
  root.style.setProperty("--bordeaux", t.bordeaux);
  root.style.setProperty("--bordeaux-fonce", t.bordeauxFonce);
  root.style.setProperty("--bordeaux-clair", t.bordeauxClair);
  root.style.setProperty("--cuivre", t.cuivre);
  root.style.setProperty("--cuivre-clair", t.cuivreClair);
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js")
      .then(reg => console.log("[SW] Enregistré :", reg.scope))
      .catch(err => console.warn("[SW] Échec enregistrement :", err));
  });
}

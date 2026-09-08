/* ═══════════════════════════════════════════════════════════
   APP.JS — routeur (hash-based, comme suggéré dans le cahier
   des charges via l'API History/hash) + gestion de l'auth.
   Tant que Firebase n'est pas configuré (FIREBASE_READY=false),
   l'appli s'ouvre directement en mode démo pour prévisualiser
   le design sans bloquer sur la connexion.
═══════════════════════════════════════════════════════════ */

// Enregistrement du service worker (06/09/2026) — nécessaire pour que
// Chrome/Android propose l'installation en PWA (voir manifest.json,
// sw.js). Ne fait rien de plus qu'un passthrough réseau, aucun risque
// de servir du contenu périmé après un déploiement.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

// Couleur d'accent de l'appli (boutons principaux, gauges, onglets actifs) —
// paramétrable depuis l'onglet Paramétrage (03/09/2026). Fonction exposée
// globalement (appelée ici au chargement ET depuis parametrage.js quand
// Tiphaine change de couleur) pour n'avoir qu'un seul endroit qui calcule
// le texte de contraste (`--accent-text`, bascule noir/blanc selon que la
// couleur choisie est claire ou foncée, pour rester lisible quoi qu'elle
// choisisse).
// État mémorisé pour recalculer `--accent-ui` (voir plus bas) à chaque
// changement d'accent OU de fond, puisque le résultat dépend des deux.
window._bosAccentHex = null;
window._bosFondClair = false;

// Modal de confirmation maison, pour remplacer le confirm() gris du
// navigateur utilisé un peu partout (04/09/2026, retour de Tiphaine sur
// la revue complète de l'app — seule vraie rupture visuelle récurrente
// dans une app par ailleurs cohérente). Asynchrone par nature (une
// vraie modal ne peut pas bloquer le thread comme confirm()), donc
// utilisation par callback plutôt que par valeur de retour :
//   window.confirmerAction('Supprimer ce client ?', () => { ...suppression... });
// `options.titre` (défaut "Confirmer"), `options.texteBouton` (défaut
// "Confirmer"), `options.danger` (défaut true — bouton rouge, la
// plupart des usages sont des suppressions ; passer false pour une
// confirmation neutre non destructive).
window.confirmerAction = function (message, onConfirm, options) {
  options = options || {};
  const titre = options.titre || 'Confirmer';
  const texteBouton = options.texteBouton || 'Confirmer';
  const danger = options.danger !== false;
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="modal-overlay" id="confirm-modal-overlay">
      <div class="modal-box" style="max-width:420px;">
        <div class="modal-title">${titre}</div>
        <div style="font-size:13.5px; color:var(--text-secondary); line-height:1.5; margin:4px 0 18px;">${message}</div>
        <div class="modal-actions">
          <span></span>
          <div class="modal-actions-right">
            <button type="button" class="btn btn-ghost" id="confirm-modal-annuler">Annuler</button>
            <button type="button" class="btn ${danger ? 'btn-danger' : ''}" id="confirm-modal-confirmer">${texteBouton}</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(wrap.firstElementChild);
  const overlay = document.getElementById('confirm-modal-overlay');
  const close = () => overlay.remove();
  let mousedownSurOverlay = false;
  overlay.addEventListener('mousedown', (e) => { mousedownSurOverlay = (e.target === overlay); });
  overlay.addEventListener('click', (e) => { if (e.target === overlay && mousedownSurOverlay) close(); });
  document.getElementById('confirm-modal-annuler').addEventListener('click', close);
  document.getElementById('confirm-modal-confirmer').addEventListener('click', () => { close(); onConfirm(); });
};

window.appliquerAccent = function (hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16), g = parseInt(h.substring(2, 4), 16), b = parseInt(h.substring(4, 6), 16);
  const clair = (0.299 * r + 0.587 * g + 0.114 * b) > 150;
  document.documentElement.style.setProperty('--accent', hex);
  document.documentElement.style.setProperty('--accent-text', clair ? '#0a0a0a' : '#f5f5f5');
  window._bosAccentHex = hex;
  window._recalculerAccentUi();
};

// `--accent` sert à la fois de fond de bouton (toujours OK, `--accent-text`
// est calculé pour contraster dessus) ET, à quelques endroits (ex : onglet
// actif de Temps/Paramétrage), de couleur de TEXTE directement posée sur le
// fond de page. Un accent blanc (le défaut) devient alors invisible sur un
// thème clair. `--accent-ui` est la version "sûre" à utiliser pour ces cas
// texte/bordure : l'accent tel quel s'il contraste assez avec le fond
// actuel, sinon on retombe sur la couleur de texte principale du thème.
window._recalculerAccentUi = function () {
  const hex = window._bosAccentHex || '#f5f5f5';
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16), g = parseInt(h.substring(2, 4), 16), b = parseInt(h.substring(4, 6), 16);
  const luminanceAccent = 0.299 * r + 0.587 * g + 0.114 * b;
  const accentClair = luminanceAccent > 150;
  // Thème clair + accent clair = illisible (blanc sur blanc). Thème sombre
  // + accent très sombre = pareil à l'inverse.
  const conflit = window._bosFondClair ? accentClair : !accentClair && luminanceAccent < 40;
  document.documentElement.style.setProperty('--accent-ui', conflit ? 'var(--text-primary)' : hex);
};
// Fond de l'appli (page/cartes/sidebar) — paramétrable depuis Paramétrage >
// Apparence (03/09/2026), en plus de la couleur d'accent. Palette de
// presets curatés (pas un color-picker libre) définie dans parametrage.js
// (`_PALETTE_FOND`) — chaque preset fournit déjà des teintes cohérentes
// entre elles (fond général/cartes/sidebar/bordures), donc appliquée telle
// quelle ici sans recalcul.
window.appliquerFond = function (preset) {
  document.documentElement.style.setProperty('--bg-page', preset.page);
  document.documentElement.style.setProperty('--bg-panel', preset.panel);
  document.documentElement.style.setProperty('--bg-panel-2', preset.panel2);
  document.documentElement.style.setProperty('--bg-input', preset.input);
  document.documentElement.style.setProperty('--border-subtle', preset.border);
  // Un fond clair a besoin d'un texte sombre — chaque preset fournit ses 3
  // paliers de texte assortis (voir parametrage.js `_PALETTE_FOND`).
  document.documentElement.style.setProperty('--text-primary', preset.textPrimary || '#f5f5f5');
  document.documentElement.style.setProperty('--text-secondary', preset.textSecondary || '#9a9a9a');
  document.documentElement.style.setProperty('--text-muted', preset.textMuted || '#6a6a6a');
  // Le logo "TB" de la sidebar est blanc (pensé pour un fond sombre) —
  // bascule sur la version noire dès qu'un fond clair est choisi, sinon il
  // deviendrait invisible. Fichier à déposer par Tiphaine dans
  // assets/logo-icon-noir.png (voir DEV_NOTES) tant qu'il n'existe pas.
  const logoImg = document.querySelector('.brand-mark img');
  if (logoImg) logoImg.src = preset.clair ? 'assets/logo-icon-noir.png' : 'assets/logo-icon.png';
  // Classe posée sur <html> pour les quelques cas où une variable CSS ne
  // suffit pas (ex : badges de statut pastel, voir style.css `.theme-clair
  // .badge-*`) et qui ont besoin de savoir explicitement si le thème est
  // clair ou sombre plutôt que de juste hériter une couleur.
  document.documentElement.classList.toggle('theme-clair', !!preset.clair);
  window._bosFondClair = !!preset.clair;
  window._recalculerAccentUi();
};

// Raccourcis de la barre mobile (08/09/2026) — Accueil et Plus sont fixes,
// les 3 du milieu sont configurables depuis Paramétrage > Apparence
// (Tiphaine choisit les pages qu'elle ouvre le plus souvent au pouce).
// Liste unique des pages proposées, réutilisée à la fois pour construire
// la barre (ici) et pour remplir les menus déroulants des réglages
// (parametrage.js) — une seule source de vérité pour les deux.
window.TABBAR_ROUTES_DISPONIBLES = [
  { route: 'prospects', label: 'Prospects', icon: 'briefcase' },
  { route: 'devis', label: 'Devis', icon: 'fileText', badge: true },
  { route: 'factures', label: 'Factures', icon: 'receipt', badge: true },
  { route: 'clients', label: 'Clients', icon: 'users' },
  { route: 'tarifs', label: 'Tarifs', icon: 'tag' },
  { route: 'projets', label: 'Projets', icon: 'grid', badge: true },
  { route: 'tickets', label: 'Tickets', icon: 'ticket', badge: true },
  { route: 'temps', label: 'Temps', icon: 'clock' },
  { route: 'abonnements', label: 'Abonnements', icon: 'refresh' },
  { route: 'calendrier', label: 'Calendrier', icon: 'calendar' },
  { route: 'finances', label: 'Finances', icon: 'wallet' },
  { route: 'technique', label: 'Technique', icon: 'wrench', badge: true },
  { route: 'documents', label: 'Documents', icon: 'folder' },
];
window.TABBAR_DEFAUT = ['temps', 'prospects', 'projets'];

// (Re)construit les 3 raccourcis du milieu à partir de la config enregistrée
// (`tos_tabbar_routes`, tableau de 3 routes) ou du défaut. Appelée une fois
// à l'ouverture (`showApp`) et à chaque changement dans les réglages —
// `setActiveNav`/`majBadgesNav` reconnaissent ensuite ces <a> tout seuls
// (mêmes classes `nav-item`/`data-route` que le reste de la nav).
window.appliquerTabbar = function () {
  const middle = document.getElementById('mobile-tabbar-middle');
  if (!middle) return;
  let routes = window.TABBAR_DEFAUT;
  try {
    const enregistre = JSON.parse(localStorage.getItem('tos_tabbar_routes') || 'null');
    if (Array.isArray(enregistre) && enregistre.length === 3) routes = enregistre;
  } catch (e) { /* ignore */ }
  middle.innerHTML = routes.map(route => {
    const meta = window.TABBAR_ROUTES_DISPONIBLES.find(r => r.route === route);
    if (!meta) return '';
    return `
      <a href="#/${meta.route}" class="nav-item mobile-tab" data-route="${meta.route}">
        <span class="nav-icon" data-icon="${meta.icon}"></span><span class="mobile-tab-label">${meta.label}</span>${meta.badge ? '<span class="nav-badge-dot"></span>' : ''}
      </a>`;
  }).join('');
  if (window.hydrateIcons) window.hydrateIcons(middle);

  // Tiroir "Plus" (08/09/2026) — doit rester en phase avec la barre : les
  // pages déjà en raccourci direct ne sont pas dupliquées ici, et surtout,
  // une page qu'on retire des raccourcis (ex : Devis) doit réapparaître ici
  // plutôt que de devenir injoignable sur mobile. Paramétrage toujours en
  // dernier, quel que soit le choix des raccourcis.
  const drawerGrid = document.getElementById('mobile-sheet-grid');
  if (drawerGrid) {
    const autres = window.TABBAR_ROUTES_DISPONIBLES.filter(r => !routes.includes(r.route));
    drawerGrid.innerHTML = autres.map(meta => `
      <a href="#/${meta.route}" class="nav-item mobile-sheet-item" data-route="${meta.route}"><span class="nav-icon" data-icon="${meta.icon}"></span> ${meta.label}${meta.badge ? '<span class="nav-badge-dot"></span>' : ''}</a>
    `).join('') + `<a href="#/parametrage" class="nav-item mobile-sheet-item" data-route="parametrage"><span class="nav-icon" data-icon="settings"></span> Paramétrage</a>`;
    if (window.hydrateIcons) window.hydrateIcons(drawerGrid);
  }
};

(function () {
  const accentEnregistre = localStorage.getItem('tos_theme_accent');
  if (accentEnregistre) window.appliquerAccent(accentEnregistre);
  try {
    const fondEnregistre = JSON.parse(localStorage.getItem('tos_theme_fond') || 'null');
    if (fondEnregistre) window.appliquerFond(fondEnregistre);
  } catch (e) { /* ignore */ }
  // Si ni l'accent ni le fond n'ont été personnalisés, aucune des deux
  // fonctions ci-dessus n'a tourné — `--accent-ui` doit quand même être
  // initialisée une fois avec les valeurs par défaut.
  window._recalculerAccentUi();
})();

// Pastilles rouges dans la sidebar + la cloche topbar (03/09/2026) — signal
// visuel "il y a un truc important à regarder" sur les onglets concernés,
// sans avoir à ouvrir chaque page. Réutilise les mêmes seuils/logiques que
// les alertes déjà branchées sur le Dashboard (`_alertesProjetsPaiement`,
// `_alertesTechnique`) pour ne pas avoir deux définitions différentes
// de "c'est urgent" dans l'appli. Lazy-init des modules pas encore ouverts
// (même pattern que dashboard.js). Point rouge simple, pas de compteur —
// demande de Tiphaine ("juste un point rouge").
window.majBadgesNav = function () {
  const dot = (route, actif) => {
    document.querySelectorAll(`.nav-item[data-route="${route}"] .nav-badge-dot`).forEach(el => {
      el.classList.toggle('show', !!actif);
    });
  };

  // Désactivable depuis Paramétrage > Général (voir parametrage.js
  // `_pastillesActivees`). Éteint tout plutôt que de ne pas exécuter la
  // fonction, pour bien effacer les pastilles déjà allumées.
  if (localStorage.getItem('tos_pastilles_actives') === 'false') {
    document.querySelectorAll('.nav-badge-dot').forEach(el => el.classList.remove('show'));
    const notifDotOff = document.getElementById('notif-dot');
    if (notifDotOff) notifDotOff.classList.remove('show');
    return;
  }

  // Tickets — non traités (statut "Ouvert").
  const tickets = window.Modules && window.Modules.tickets;
  let ticketsActif = false;
  if (tickets) {
    if (!tickets._data) tickets._data = window.FIREBASE_READY ? [] : tickets._mock();
    ticketsActif = tickets._data.some(t => t.statut === 'Ouvert');
  }
  dot('tickets', ticketsActif);

  // Projets — acompte non reçu / solde à réclamer (même logique que
  // modules/dashboard.js `_alertesProjetsPaiement`).
  const projets = window.Modules && window.Modules.projets;
  let projetsActif = false;
  if (projets) {
    if (!projets._data) projets._data = window.FIREBASE_READY ? [] : projets._mock();
    projetsActif = projets._data.some(p => {
      const s = projets._statutPaiement(p);
      return s === 'acompte_attente' || s === 'solde_attente';
    });
  }
  dot('projets', projetsActif);

  // Devis — envoyé sans réponse depuis 5 jours ou plus (à relancer).
  const devis = window.Modules && window.Modules.devis;
  let devisActif = false;
  if (devis) {
    if (!devis._data) devis._data = window.FIREBASE_READY ? [] : devis._mock();
    const pad = (n) => String(n).padStart(2, '0');
    const auj = new Date();
    const aujStr = `${auj.getFullYear()}-${pad(auj.getMonth() + 1)}-${pad(auj.getDate())}`;
    devisActif = devis._data.some(d => {
      if (d.statut !== 'Envoyé') return false;
      const jours = Math.round((new Date(aujStr) - new Date(d.date)) / 86400000);
      return jours >= 5;
    });
  }
  dot('devis', devisActif);

  // Factures — émise (non payée) depuis 15 jours ou plus (à relancer).
  const factures = window.Modules && window.Modules.factures;
  let facturesActif = false;
  if (factures) {
    if (!factures._data) factures._data = window.FIREBASE_READY ? [] : factures._mock();
    const pad2 = (n) => String(n).padStart(2, '0');
    const auj2 = new Date();
    const aujStr2 = `${auj2.getFullYear()}-${pad2(auj2.getMonth() + 1)}-${pad2(auj2.getDate())}`;
    facturesActif = factures._data.some(f => {
      if (f.statut === 'Payée') return false;
      const jours = Math.round((new Date(aujStr2) - new Date(f.date)) / 86400000);
      return jours >= 15;
    });
  }
  dot('factures', facturesActif);

  // Technique — domaine ou hébergement à échéance ≤ 30 jours (ou déjà
  // dépassée). Remplace l'ancienne pastille "Renouvellements" depuis la
  // fusion du 04/09/2026 (voir modules/technique.js).
  const technique = window.Modules && window.Modules.technique;
  let techniqueActif = false;
  if (technique) {
    if (!technique._data) technique._data = window.FIREBASE_READY ? technique._mock() : technique._getData();
    techniqueActif = technique._alertesExpirations().some(a => a.type === 'urgent' || a.type === 'attention');
  }
  dot('technique', techniqueActif);

  // Cloche topbar — s'allume dès qu'au moins une des catégories ci-dessus
  // a quelque chose à signaler.
  const notifDot = document.getElementById('notif-dot');
  if (notifDot) notifDot.classList.toggle('show', ticketsActif || projetsActif || devisActif || facturesActif || techniqueActif);
};

(function () {
  // Hydrate tous les <span data-icon="nom"></span> avec le SVG correspondant.
  // Fonction ré-exposée globalement pour être rappelée après chaque
  // rendu de module (les tables/cards dynamiques peuvent aussi utiliser
  // data-icon dans leur propre HTML).
  window.hydrateIcons = function (root = document) {
    root.querySelectorAll('[data-icon]').forEach(el => {
      const name = el.dataset.icon;
      const size = el.dataset.iconSize ? Number(el.dataset.iconSize) : 16;
      if (window.Icons && window.Icons[name] && !el.dataset.hydrated) {
        el.innerHTML = window.Icons[name](size);
        el.dataset.hydrated = '1';
      }
    });
  };

  const loginScreen = document.getElementById('login-screen');
  const app = document.getElementById('app');
  const content = document.getElementById('content');
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');
  const logoutBtn = document.getElementById('logout-btn');

  const ROUTES = {
    dashboard: window.Modules && window.Modules.dashboard,
    clients: window.Modules && window.Modules.clients,
    prospects: window.Modules && window.Modules.prospects,
    devis: window.Modules && window.Modules.devis,
    factures: window.Modules && window.Modules.factures,
    tarifs: window.Modules && window.Modules.catalogue,
    projets: window.Modules && window.Modules.projets,
    tickets: window.Modules && window.Modules.tickets,
    temps: window.Modules && window.Modules.temps,
    abonnements: window.Modules && window.Modules.abonnements,
    calendrier: window.Modules && window.Modules.calendrier,
    finances: window.Modules && window.Modules.finances,
    technique: window.Modules && window.Modules.technique,
    documents: window.Modules && window.Modules.documents,
    parametrage: window.Modules && window.Modules.parametrage,
  };

  // Texte de la barre de recherche du haut, différent par page (08/09/2026)
  // — chaque écran avait sa propre barre dédiée avec un placeholder
  // précis ("Rechercher un nom ou une entreprise...", etc.) ; maintenant
  // qu'une seule barre (celle du haut) fait le travail partout (voir
  // `SELECTEUR_LIGNES` plus bas), elle reprend le texte précis de la
  // page affichée plutôt qu'un "Rechercher..." générique tout le temps.
  const PLACEHOLDERS_RECHERCHE = {
    prospects: 'Rechercher une entreprise ou un contact...',
    devis: 'Rechercher un client, une entreprise ou une offre...',
    factures: 'Rechercher un client, une entreprise ou un libellé...',
    clients: 'Rechercher un nom ou une entreprise...',
    projets: 'Rechercher un projet, un client ou une entreprise...',
    tickets: 'Rechercher un client, une entreprise ou un sujet...',
    abonnements: 'Rechercher un client, une entreprise ou une formule...',
    technique: 'Rechercher un domaine, un hébergement, un accès...',
    documents: 'Rechercher un client ou un document...',
  };

  function setActiveNav(route) {
    document.querySelectorAll('.nav-item[data-route]').forEach(el => {
      el.classList.toggle('active', el.dataset.route === route);
    });
  }

  // Navigation "ouvrir cette fiche précise, même sur un autre onglet"
  // (05/09/2026, revue de la connexion entre modules) — jusqu'ici, les
  // rares liens inter-modules (`data-aller-vers` sur calendrier.js) ne
  // faisaient que changer d'onglet, jamais rouvrir l'enregistrement
  // exact. `window.ouvrirFiche(route, id)` mémorise la cible, change de
  // hash, et `renderRoute` rouvre le bon formulaire juste après le rendu
  // du module — un seul mécanisme générique, réutilisable partout au lieu
  // de le refaire à la main dans chaque module.
  window.ouvrirFiche = function (route, id) {
    window._ouvertureEnAttente = { route, id };
    if (location.hash === `#/${route}`) { renderRoute(); } else { location.hash = `#/${route}`; }
  };

  async function renderRoute() {
    const route = (location.hash || '#/dashboard').replace('#/', '') || 'dashboard';
    setActiveNav(route);
    // Chaque page démarre sans filtre actif (la recherche s'applique à la
    // page affichée, voir plus bas) — évite de garder une recherche d'une
    // page qui n'a plus aucun rapport avec la nouvelle.
    const globalSearchInput = document.getElementById('global-search');
    if (globalSearchInput) {
      globalSearchInput.value = '';
      globalSearchInput.placeholder = PLACEHOLDERS_RECHERCHE[route] || 'Rechercher...';
    }
    const mod = ROUTES[route];
    if (mod && mod.render) {
      content.innerHTML = '<div style="color:#5a5a5a; font-size:13px;">Chargement…</div>';
      await mod.render(content);
      window.hydrateIcons(content);
      // Ouverture différée d'une fiche précise (voir `window.ouvrirFiche`)
      // — consommée une seule fois, puis effacée.
      if (window._ouvertureEnAttente && window._ouvertureEnAttente.route === route) {
        const { id } = window._ouvertureEnAttente;
        window._ouvertureEnAttente = null;
        const item = mod._data && mod._data.find(x => x.id === id);
        if (item && mod._openForm) mod._openForm(item);
      }
    } else {
      content.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon" data-icon="folder" data-icon-size="32"></div>
          <div>Cette section arrive dans une prochaine version.</div>
        </div>`;
      window.hydrateIcons(content);
    }
    if (window.majBadgesNav) window.majBadgesNav();
  }

  function showApp() {
    loginScreen.classList.add('hidden');
    app.classList.remove('hidden');
    window.hydrateIcons(document); // sidebar + topbar (statiques, hors #content)
    window.appliquerTabbar(); // raccourcis de la barre mobile (voir plus haut)
    renderRoute();
  }

  function showLogin() {
    app.classList.add('hidden');
    loginScreen.classList.remove('hidden');
  }

  window.addEventListener('hashchange', renderRoute);

  // ── Nav mobile : tiroir "Plus" (06/09/2026) ─────────────────
  // Ouvre/ferme le tiroir listant le reste des pages (voir index.html
  // `#mobile-sheet-overlay`). Se ferme aussi automatiquement dès qu'on
  // change de page (hashchange) — évite qu'il reste ouvert par-dessus la
  // nouvelle page après un clic sur un de ses liens.
  const mobilePlusBtn = document.getElementById('mobile-plus-btn');
  const mobileSheetOverlay = document.getElementById('mobile-sheet-overlay');
  const mobileSheetLogout = document.getElementById('mobile-sheet-logout');
  if (mobilePlusBtn && mobileSheetOverlay) {
    mobilePlusBtn.addEventListener('click', () => mobileSheetOverlay.classList.add('open'));
    mobileSheetOverlay.addEventListener('click', () => mobileSheetOverlay.classList.remove('open'));
    window.addEventListener('hashchange', () => mobileSheetOverlay.classList.remove('open'));
    if (mobileSheetLogout) mobileSheetLogout.addEventListener('click', () => logoutBtn.click());
  }

  // ── Recherche globale (barre du haut) ──────────────────────
  // Générique : filtre les "lignes" actuellement affichées dans
  // #content par correspondance texte, quel que soit le module (Clients,
  // Devis, Prospects...).
  //
  // 08/09/2026 : élargie pour couvrir TOUTES les façons dont l'appli
  // affiche une liste, pas seulement `<table>` — jusqu'ici la recherche
  // du haut ne faisait rien sur Prospects (Kanban, pas de table), et ne
  // faisait rien non plus SUR MOBILE pour Devis/Factures/Clients/
  // Tickets/Abonnements/Technique/Documents/Catalogue (le tableau reste
  // dans le DOM mais caché en CSS sur mobile — les vraies cartes
  // visibles n'étaient pas filtrées). Résultat : Prospects a pu perdre
  // sa barre de recherche dédiée (doublon visuel réglé), et la
  // recherche du haut marche enfin aussi sur mobile pour tous les
  // écrans passés en cartes.
  const SELECTEUR_LIGNES = [
    'table tbody tr',
    '.kanban-card',
    '.devis-mcard', '.facture-mcard', '.client-mcard', '.catalogue-mcard',
    '.ticket-mcard', '.abo-mcard', '.technique-mcard', '.documents-mcard',
    // 08/09/2026, suite — cartes qui n'ont ni `<table>` ni suffixe
    // "-mcard" (Projets, la Maintenance de Technique, la grille de
    // dossiers de Documents), ajoutées en supprimant leurs barres de
    // recherche dédiées devenues redondantes avec celle du haut.
    '.projet-carte', '.technique-maintenance-carte', '.documents-dossier-carte',
  ].join(', ');
  const globalSearch = document.getElementById('global-search');
  if (globalSearch) {
    globalSearch.addEventListener('input', () => {
      const q = globalSearch.value.trim().toLowerCase();
      // Une recherche 100% numérique (ex: "1") cible le numéro affiché
      // (data-numero, ex: devis N°1) plutôt qu'une recherche plein-texte —
      // sinon "1" remontait aussi n'importe quelle ligne contenant un "1"
      // ailleurs (montant "1400 €", date "2026-08-1x"...), ce qui n'a pas
      // de sens pour l'utilisateur qui cherche UN numéro précis.
      const estNumerique = /^\d+$/.test(q);
      content.querySelectorAll(SELECTEUR_LIGNES).forEach(ligne => {
        let correspond = true;
        if (q) {
          if (estNumerique && ligne.dataset.numero) {
            correspond = ligne.dataset.numero.startsWith(q);
          } else {
            correspond = ligne.textContent.toLowerCase().includes(q);
          }
        }
        ligne.style.display = correspond ? '' : 'none';
      });
    });
  }

  // ── Cloche de notification (03/09/2026) ─────────────────────
  // Le bouton existait déjà (avec sa pastille `#notif-dot`) mais
  // n'ouvrait rien au clic — Tiphaine l'a remarqué. Réunit dans un
  // popover tout ce qui allume une pastille ailleurs dans l'appli
  // (mêmes sources que `window.majBadgesNav` + les alertes URSSAF/Pôle
  // Emploi) : une seule liste "À traiter", cliquable, qui navigue vers
  // la bonne page. Popover auto-fermant au clic extérieur, même
  // pattern que le filtre Devis / mini-calendrier Vue Semaine.
  window.toutesLesAlertes = function () {
    const dashboard = window.Modules && window.Modules.dashboard;
    if (!dashboard) return [];
    return [
      ...dashboard._alertesDeclarations(),
      ...dashboard._alertesProjetsPaiement(),
      ...dashboard._alertesTickets(),
      ...dashboard._alertesDevisRelance(),
      ...dashboard._alertesTechnique(),
    ];
  };

  const notifBtn = document.getElementById('notif-btn');
  if (notifBtn) {
    notifBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const existant = document.getElementById('notif-popover');
      if (existant) { existant.remove(); return; }

      const alertes = window.toutesLesAlertes();
      // Même mapping couleur que la carte Dashboard (`alertDot` dans
      // dashboard.js `_html`) — pour que la cloche ait vraiment l'air
      // d'un centre de notifications et pas d'une simple liste de
      // liens (retour de Tiphaine, 03/09/2026).
      const alertDot = { urgent:'alert-dot-red', attention:'alert-dot-orange', info:'alert-dot-blue', projet:'alert-dot-green' };
      const pop = document.createElement('div');
      pop.id = 'notif-popover';
      pop.className = 'notif-popover';
      pop.innerHTML = `
        <div class="notif-popover-header">${alertes.length ? `${alertes.length} notification${alertes.length > 1 ? 's' : ''}` : 'Notifications'}</div>
        ${alertes.length ? alertes.map(a => `
          <button class="notif-popover-item" data-lien-hash="${a.lienHash || ''}">
            <div class="alert-dot ${alertDot[a.type] || 'alert-dot-grey'}" style="margin-top:4px;"></div>
            <div>
              <span class="notif-popover-text">${a.text}</span>
              <span class="notif-popover-sub">${a.sub}</span>
            </div>
          </button>
        `).join('') : `<div class="notif-popover-vide">Rien à signaler pour l'instant 🎉</div>`}
        <a href="#/dashboard" class="notif-popover-footer">Voir tout sur le Dashboard</a>
      `;
      notifBtn.appendChild(pop);

      pop.querySelectorAll('[data-lien-hash]').forEach(item => {
        item.addEventListener('click', () => {
          if (item.dataset.lienHash) location.hash = item.dataset.lienHash;
          pop.remove();
        });
      });
      const footer = pop.querySelector('.notif-popover-footer');
      if (footer) footer.addEventListener('click', () => pop.remove());

      setTimeout(() => {
        document.addEventListener('click', function fermer(ev) {
          if (!ev.target.closest('#notif-popover') && !ev.target.closest('#notif-btn')) {
            pop.remove();
            document.removeEventListener('click', fermer);
          }
        });
      }, 0);
    });
  }

  // ── Authentification ────────────────────────────────────
  if (window.FIREBASE_READY) {
    window.auth.onAuthStateChanged(user => {
      if (user) showApp(); else showLogin();
    });

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      loginError.textContent = '';
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      try {
        await window.auth.signInWithEmailAndPassword(email, password);
      } catch (err) {
        loginError.textContent = "Email ou mot de passe incorrect.";
      }
    });

    logoutBtn.addEventListener('click', () => window.auth.signOut());
  } else {
    // Mode démo : pas de vraie auth tant que Firebase n'est pas configuré.
    // 08/09/2026 — copie démo PUBLIQUE uniquement (jamais dans l'app réelle
    // de Tiphaine, où démarrer vide est voulu) : pré-remplit avec le jeu de
    // données fictif existant (Paramétrage > Données > "Charger la démo",
    // déjà utilisé pour les tests) à chaque chargement de page, pour qu'un
    // visiteur voie tout de suite un CRM vivant plutôt qu'un écran vide
    // qu'il faudrait savoir remplir lui-même. Comme les données vivent en
    // mémoire (pas de Firebase), ça se répète sans effet de bord à chaque
    // rechargement — y compris après "Réinitialiser la démo".
    if (window.Modules.parametrage && window.Modules.parametrage._chargerDonneesDemo) {
      window.Modules.parametrage._chargerDonneesDemo();
    }
    // 08/09/2026, "ajoute plus d'éléments... ça parait vide" — Temps et
    // Technique vivent dans localStorage (pas dans `_data` en mémoire
    // comme le reste), donc `_chargerDonneesDemo()` ci-dessus ne les
    // touche pas. Seedés ICI séparément, et seulement si absents
    // (contrairement au reste qui se recharge à chaque page vue) : pour
    // que si un visiteur ajoute son propre créneau et navigue dans
    // l'app sans recharger, il ne le voit pas disparaître. Un vrai
    // rechargement (ou "Réinitialiser la démo") repart sur ce jeu fixe.
    _seedTempsEtTechniqueDemo();
    showApp();
    logoutBtn.addEventListener('click', () => {
      alert("Mode démo — configure Firebase (firebase-config.js) pour activer la vraie connexion/déconnexion.");
    });
  }

  // Jeu de données fictif pour Temps + Technique (copie démo publique
  // uniquement — voir commentaire à l'appel ci-dessus). Dates calculées
  // par rapport à AUJOURD'HUI (jamais de date en dur) pour que la
  // semaine affichée par défaut sur Temps ne soit jamais vide, même
  // consultée des mois après la mise en ligne de la démo.
  function _seedTempsEtTechniqueDemo() {
    const pad = n => String(n).padStart(2, '0');
    const dateLocale = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (localStorage.getItem('tos_creneaux') === null) {
      const aujourdhui = new Date();
      const jourSemaine = (aujourdhui.getDay() + 6) % 7; // 0 = lundi
      const lundiCetteSemaine = new Date(aujourdhui);
      lundiCetteSemaine.setDate(aujourdhui.getDate() - jourSemaine);

      // Semaine-type à 40h (08/09/2026, "que je fasse des semaines de
      // mini 40h") — matin + après-midi = 8h/jour, 5 jours ouvrés,
      // répartis sur les 4 clients fictifs + temps interne/prospection
      // pour que ce soit varié, pas juste 5 blocs identiques.
      const modeleSemaine = [
        [ // Lundi
          { heureDebut: '09:00', heureFin: '13:00', minutes: 240, client: 'Julie Marchand', projet: 'Site vitrine — 3 pages', typeTache: 'Création', description: '' },
          { heureDebut: '14:00', heureFin: '18:00', minutes: 240, client: 'Karim Haddad', projet: 'Refonte identité visuelle', typeTache: 'Création', description: '' },
        ],
        [ // Mardi
          { heureDebut: '09:00', heureFin: '13:00', minutes: 240, client: 'Sophie Lenoir', projet: 'Refonte site', typeTache: 'Maintenance/Abonnement', description: '' },
          { heureDebut: '14:00', heureFin: '15:00', minutes: 60, client: '', projet: '', typeTache: 'Prospection', description: 'Relance devis en attente' },
          { heureDebut: '15:00', heureFin: '18:00', minutes: 180, client: 'Antoine Vasseur', projet: 'Landing page', typeTache: 'Création', description: '' },
        ],
        [ // Mercredi
          { heureDebut: '09:00', heureFin: '11:00', minutes: 120, client: '', projet: '', typeTache: 'Interne', description: 'Admin / compta' },
          { heureDebut: '11:00', heureFin: '13:00', minutes: 120, client: '', projet: '', typeTache: 'Prospection', description: 'Nouveaux prospects' },
          { heureDebut: '14:00', heureFin: '18:00', minutes: 240, client: 'Julie Marchand', projet: 'Site vitrine — 3 pages', typeTache: 'Création', description: '' },
        ],
        [ // Jeudi
          { heureDebut: '09:00', heureFin: '13:00', minutes: 240, client: 'Karim Haddad', projet: 'Refonte identité visuelle', typeTache: 'Création', description: '' },
          { heureDebut: '14:00', heureFin: '18:00', minutes: 240, client: 'Sophie Lenoir', projet: 'Refonte site', typeTache: 'Maintenance/Abonnement', description: '' },
        ],
        [ // Vendredi
          { heureDebut: '09:00', heureFin: '13:00', minutes: 240, client: '', projet: '', typeTache: 'Prospection', description: 'Suivi prospects en cours' },
          { heureDebut: '14:00', heureFin: '18:00', minutes: 240, client: '', projet: '', typeTache: 'Interne', description: 'Facturation / suivi admin' },
        ],
      ];

      let id = Date.now();
      const creneaux = [];
      const ajouterJour = (lundiRef, offsetJour, dateStr) => {
        modeleSemaine[offsetJour].forEach(c => creneaux.push(Object.assign({ id: id++, date: dateStr }, c)));
      };

      // 2 semaines pleines déjà passées (40h chacune) + la semaine en
      // cours remplie jusqu'à aujourd'hui inclus (jamais dans le futur).
      [-2, -1].forEach(semaineOffset => {
        const lundi = new Date(lundiCetteSemaine);
        lundi.setDate(lundiCetteSemaine.getDate() + semaineOffset * 7);
        for (let i = 0; i <= 4; i++) {
          const d = new Date(lundi);
          d.setDate(lundi.getDate() + i);
          ajouterJour(lundi, i, dateLocale(d));
        }
      });
      const dernierJourCetteSemaine = Math.min(jourSemaine, 4);
      for (let i = 0; i <= dernierJourCetteSemaine; i++) {
        const d = new Date(lundiCetteSemaine);
        d.setDate(lundiCetteSemaine.getDate() + i);
        ajouterJour(lundiCetteSemaine, i, dateLocale(d));
      }

      localStorage.setItem('tos_creneaux', JSON.stringify(creneaux));
    }

    // 08/09/2026, "si on laisse la 1ère vue sur la semaine en cours... on
    // ne voit pas une semaine complète" — la semaine en cours n'a de
    // créneaux que jusqu'à AUJOURD'HUI (jamais dans le futur), donc un
    // visiteur qui arrive un lundi ou un mardi tombe sur une semaine à
    // moitié vide en 1ère impression. Vue Semaine s'ouvre par défaut sur
    // la semaine PRÉCÉDENTE (toujours complète, 40h, vu qu'on en génère
    // toujours au moins 2 en entier ci-dessus), quel que soit le jour où
    // la démo est consultée. HORS du bloc "seed une fois" au-dessus :
    // `_semaineOffset` est une propriété en mémoire du module, remise à 0
    // par défaut à CHAQUE chargement de page (nouveau contexte JS), donc
    // ça doit être réappliqué à chaque fois, pas juste au 1er seed. Le
    // bouton "Aujourd'hui" reste là si un visiteur veut voir la semaine réelle.
    if (window.Modules.temps) window.Modules.temps._semaineOffset = -1;

    if (localStorage.getItem('tos_technique') === null) {
      const dansNJours = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return dateLocale(d); };
      const ilYAJours = (n) => dansNJours(-n);
      const technique = {
        domaines: [
          { id: 1, nom: 'boulangerie-marchand.fr', client: 'Julie Marchand', registrar: 'OVH', cout: 12, dateAchat: '2026-06-15', dateExpiration: dansNJours(280), renouvellementAuto: true, identifiantCompte: '', url: '', notes: '' },
          { id: 2, nom: 'haddadconseil.fr', client: 'Karim Haddad', registrar: 'Gandi', cout: 15, dateAchat: '2026-07-01', dateExpiration: dansNJours(25), renouvellementAuto: false, identifiantCompte: '', url: '', notes: 'Renouvellement manuel à ne pas oublier.' },
          { id: 3, nom: 'fontaine-architecture.fr', client: 'Nadia Fontaine', registrar: 'OVH', cout: 12, dateAchat: '2026-08-29', dateExpiration: dansNJours(355), renouvellementAuto: true, identifiantCompte: '', url: '', notes: '' },
        ],
        hebergements: [
          { id: 1, fournisseur: 'Firebase', typeHebergement: 'Hébergement + base de données', cout: 0, serveur: '', projetAssocie: 'Site vitrine — 3 pages', dateRenouvellement: dansNJours(280), url: '', statut: 'Actif', notes: '', alerteStockageConfiguree: true },
          { id: 2, fournisseur: 'Firebase', typeHebergement: 'Hébergement + base de données', cout: 25, serveur: '', projetAssocie: 'Application de suivi de chantiers', dateRenouvellement: dansNJours(355), url: '', statut: 'Actif', notes: '', alerteStockageConfiguree: true },
        ],
        maintenance: [
          { id: 1, date: dateLocale(new Date()), client: 'Karim Haddad', projet: 'Refonte identité visuelle', items: ['Correctif formulaire de contact', 'Mise à jour dépendances'], notes: '' },
          { id: 2, date: ilYAJours(6), client: 'Julie Marchand', projet: 'Site vitrine — 3 pages', items: ['Sauvegarde mensuelle vérifiée', 'Mise à jour du thème'], notes: '' },
          { id: 3, date: ilYAJours(19), client: 'Nadia Fontaine', projet: 'Application de suivi de chantiers', items: ['Ajout du module photos chantier', 'Correctif export PDF'], notes: 'Demande initiale de Nadia, livrée avec 2 jours d\'avance.' },
        ],
        acces: [
          { id: 1, service: 'GitHub', client: 'Julie Marchand', url: 'https://github.com', identifiant: 'contact@boulangerie-marchand.fr', emplacementMotDePasse: 'Bitwarden — dossier Pro', notes: '' },
          { id: 2, service: 'Firebase', client: 'Nadia Fontaine', url: 'https://console.firebase.google.com', identifiant: 'nadia@fontaine-architecture.fr', emplacementMotDePasse: 'Bitwarden — dossier Pro', notes: '' },
        ],
      };
      localStorage.setItem('tos_technique', JSON.stringify(technique));
    }
  }
})();

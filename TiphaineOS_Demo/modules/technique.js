/* ═══════════════════════════════════════════════════════════
   MODULE TECHNIQUE — le volet "infrastructure" du cahier des charges
   d'origine (sections 20 Domaines, 21 Hébergement, 22 Maintenance,
   23 Accès techniques). Créé le 04/09/2026, choisi par Tiphaine comme
   prochain module V2 (plutôt que Calendrier ou Documents).

   Remplace ET absorbe l'ancien module Renouvellements (créé le
   03/09/2026, avant que Technique n'existe) : Domaines et Hébergement
   couvrent maintenant le même besoin (échéances à ne pas louper) avec
   beaucoup plus de détail (registrar, renouvellement auto, serveur,
   projet associé...) — une seule source de vérité plutôt que deux
   listes à tenir à jour en parallèle (choix confirmé par Tiphaine).
   `modules/renouvellements.js` a été supprimé du disque le 04/09/2026
   (il n'était plus chargé depuis la création de ce module, plus aucune
   raison de le garder).

   4 sous-onglets (même pattern que modules/temps.js `_vue`) :
   - Domaines : registre nom de domaine, échéances J-60/J-30/J-7/J-1.
   - Hébergement : registre d'hébergement par projet.
   - Maintenance : journal des interventions (append-only, style log).
   - Accès techniques : quels services, quel client, où trouver le mot
     de passe — SANS jamais stocker le mot de passe lui-même (bouton
     vers le gestionnaire de mots de passe perso, lien configurable
     dans Paramétrage > Général).

   TODO Firebase pour la persistance (localStorage pour l'instant,
   même pattern que tous les autres modules).
═══════════════════════════════════════════════════════════ */

window.Modules = window.Modules || {};

window.Modules.technique = {
  _data: null,
  _vue: 'domaines',
  _recherche: '',

  // Recherche partagée entre les 4 sous-onglets (04/09/2026, retour de
  // la revue complète de l'app — pattern déjà utilisé sur Prospects/
  // Documents/Clients/Tickets/Abonnements, manquait encore ici).
  _filtrer(liste, champs) {
    const q = (this._recherche || '').trim().toLowerCase();
    if (!q) return liste;
    return liste.filter(item => champs.some(c => (item[c] || '').toLowerCase().includes(q)));
  },

  async render(container) {
    if (!this._data) {
      this._data = window.FIREBASE_READY ? await this._fetchReal() : this._getData();
    }
    this._root = container.closest('#content') || container;
    container.innerHTML = this._html(this._data);
    window.hydrateIcons(container);
    this._bindEvents(container);
    if (window.majBadgesNav) window.majBadgesNav();
  },

  // ── Persistance (localStorage tant que Firebase n'est pas branché) ──
  _getData() {
    try {
      const stocke = JSON.parse(localStorage.getItem('tos_technique') || 'null');
      if (stocke && typeof stocke === 'object') {
        return Object.assign({ domaines: [], hebergements: [], maintenance: [], acces: [] }, stocke);
      }
    } catch (e) { /* ignore */ }
    return this._mock();
  },
  _setData(data) {
    localStorage.setItem('tos_technique', JSON.stringify(data));
  },
  _mock() {
    return { domaines: [], hebergements: [], maintenance: [], acces: [] };
  },
  async _fetchReal() {
    // TODO Firebase : collections `domaines`, `hebergements`, `maintenance`, `acces_techniques`.
    return this._getData();
  },

  // ── Échéances (domaines + hébergement) ──────────────────────────
  _joursRestants(dateEcheance) {
    const pad = (n) => String(n).padStart(2, '0');
    const auj = new Date();
    const aujStr = `${auj.getFullYear()}-${pad(auj.getMonth() + 1)}-${pad(auj.getDate())}`;
    return Math.round((new Date(dateEcheance) - new Date(aujStr)) / 86400000);
  },
  // Paliers du cahier des charges : J-60 (léger), J-30, J-7, J-1 —
  // paramétrables depuis Paramétrage > Général (04/09/2026, avant codés
  // en dur), avec repli sur les valeurs d'origine si rien n'est réglé.
  _seuils() {
    const catalogue = window.Modules && window.Modules.catalogue;
    const e = catalogue ? catalogue._getEntreprise() : {};
    return {
      j60: e.technique60Jours || 60,
      j30: e.technique30Jours || 30,
      j7: e.technique7Jours || 7,
    };
  },
  _niveauAlerte(jours) {
    const s = this._seuils();
    if (jours < 0) return 'urgent';
    if (jours <= s.j7) return 'urgent';
    if (jours <= s.j30) return 'attention';
    if (jours <= s.j60) return 'info';
    return 'ok';
  },
  _badgeEcheance(dateEcheance) {
    const j = this._joursRestants(dateEcheance);
    const niveau = this._niveauAlerte(j);
    const classe = { urgent: 'badge-red', attention: 'badge-orange', info: 'badge-blue', ok: 'badge-blue' }[niveau];
    const texte = j < 0 ? `En retard de ${-j}j` : `Dans ${j}j`;
    return `<span class="badge ${classe}" ${niveau === 'ok' ? 'style="opacity:.55;"' : ''}>${texte}</span>`;
  },

  // Un hébergement est "Firebase" si le fournisseur ou le type le
  // mentionne — sert à savoir où proposer le rappel de l'alerte de
  // quota de stockage (voir _alertesExpirations ci-dessous).
  _estFirebase(h) {
    const texte = `${h.fournisseur || ''} ${h.typeHebergement || ''}`.toLowerCase();
    return texte.includes('firebase');
  },

  // Alimente le Dashboard (`_alertesTechnique`) et la cloche de
  // notification (`window.toutesLesAlertes`, app.js) — même format que
  // les autres sources d'alertes de l'appli. Couvre aussi, depuis le
  // 04/09/2026, le rappel "alerte de quota Firebase pas encore
  // configurée" (pas une échéance à proprement parler, mais même
  // logique de rappel proactif — voir _formHebergement pour le détail).
  _alertesExpirations() {
    const alertes = [];
    (this._data.hebergements || []).forEach(h => {
      if (this._estFirebase(h) && !h.alerteStockageConfiguree) {
        alertes.push({
          type: 'attention',
          text: `Firebase — ${h.projetAssocie || h.fournisseur}`,
          sub: 'Alerte de quota de stockage (80 % = 4 Go/5 Go) pas encore configurée — quelques minutes, aucun code, envoyée par email à toi.',
          action: 'Configurer',
          lienHash: '#/technique',
        });
      }
    });
    (this._data.domaines || []).forEach(d => {
      const j = this._joursRestants(d.dateExpiration);
      if (j > this._seuils().j60) return;
      alertes.push({
        type: this._niveauAlerte(j),
        text: `Domaine — ${d.nom}`,
        sub: j < 0 ? `Expiré depuis ${-j} jour${-j > 1 ? 's' : ''}` : `Expire dans ${j} jour${j > 1 ? 's' : ''}${d.renouvellementAuto ? ' (renouvellement auto activé)' : ''}`,
        action: 'Vérifier',
        lienHash: '#/technique',
      });
    });
    (this._data.hebergements || []).forEach(h => {
      const j = this._joursRestants(h.dateRenouvellement);
      if (j > this._seuils().j60) return;
      alertes.push({
        type: this._niveauAlerte(j),
        text: `Hébergement — ${h.fournisseur}${h.projetAssocie ? ` (${h.projetAssocie})` : ''}`,
        sub: j < 0 ? `Échu depuis ${-j} jour${-j > 1 ? 's' : ''}` : `Renouvellement dans ${j} jour${j > 1 ? 's' : ''}`,
        action: 'Vérifier',
        lienHash: '#/technique',
      });
    });
    return alertes.sort((a, b) => (a.type === 'urgent' ? 0 : 1) - (b.type === 'urgent' ? 0 : 1));
  },

  // ── Rendu ─────────────────────────────────────────────────────────
  _html(data) {
    const nbAlertes = this._alertesExpirations().length;
    // Libellé du 4e onglet raccourci sur mobile (08/09/2026, retour "Ac"
    // coupé net) — plus fiable qu'un fondu CSS (mask-image, pas rendu de
    // façon homogène selon l'appareil) : les 4 onglets tiennent tout
    // simplement sans avoir besoin de défiler.
    const esMobile = window.innerWidth <= 880;
    return `
      <div class="page-header-row">
        <div>
          <div class="page-title"><span class="nav-icon" data-icon="wrench"></span>Technique</div>
          <div class="page-sub">Domaines, hébergement, maintenance et accès — tout ce qui fait tourner tes projets.${nbAlertes ? ` ${nbAlertes} échéance${nbAlertes > 1 ? 's' : ''} à surveiller.` : ''}</div>
        </div>
      </div>

      <div class="temps-tabs technique-tabs-grid">
        <button class="temps-tab ${this._vue === 'domaines' ? 'active' : ''}" data-tab="domaines">Domaines</button>
        <button class="temps-tab ${this._vue === 'hebergements' ? 'active' : ''}" data-tab="hebergements">Hébergement</button>
        <button class="temps-tab ${this._vue === 'maintenance' ? 'active' : ''}" data-tab="maintenance">Maintenance</button>
        <button class="temps-tab ${this._vue === 'acces' ? 'active' : ''}" data-tab="acces" title="Accès techniques">${esMobile ? 'Accès' : 'Accès techniques'}</button>
      </div>

      <div id="technique-contenu-zone">${this._htmlContenu(data)}</div>
    `;
  },

  _htmlContenu(data) {
    const catalogue = window.Modules && window.Modules.catalogue;
    const entreprise = catalogue ? catalogue._getEntreprise() : {};
    return this._vue === 'domaines' ? this._htmlDomaines(this._filtrer(data.domaines, ['nom', 'client', 'registrar']))
      : this._vue === 'hebergements' ? this._htmlHebergements(this._filtrer(data.hebergements, ['fournisseur', 'typeHebergement', 'projetAssocie', 'serveur']))
      : this._vue === 'maintenance' ? this._htmlMaintenance(this._filtrer(data.maintenance, ['client', 'projet']))
      : this._htmlAcces(this._filtrer(data.acces, ['service', 'client']), entreprise);
  },

  _htmlDomaines(domaines) {
    const tries = [...domaines].sort((a, b) => (a.dateExpiration || '').localeCompare(b.dateExpiration || ''));
    return `
      <div class="technique-add-row" style="display:flex; justify-content:flex-end; margin-bottom:12px;">
        <button class="btn" id="add-domaine-btn">+ Nouveau domaine</button>
      </div>
      <div class="card technique-table-wrap" style="padding:0; overflow-x:auto;">
        <table>
          <thead><tr>
            <th>Domaine</th><th>Client</th><th>Registrar</th><th>Expiration</th><th></th><th>Renouv. auto</th><th>Coût</th><th></th>
          </tr></thead>
          <tbody>
            ${tries.length ? tries.map(d => `
              <tr data-open-domaine="${d.id}" style="cursor:pointer;">
                <td>${d.nom}</td>
                <td>${d.client || '—'}</td>
                <td>${d.registrar || '—'}</td>
                <td>${d.dateExpiration ? d.dateExpiration.split('-').reverse().join('/') : '—'}</td>
                <td>${d.dateExpiration ? this._badgeEcheance(d.dateExpiration) : ''}</td>
                <td>${d.renouvellementAuto ? '✓' : '—'}</td>
                <td>${d.cout ? d.cout.toLocaleString('fr-FR') + ' €' : '—'}</td>
                <td style="width:36px;"><button class="row-delete-btn" data-delete-domaine="${d.id}" title="Supprimer">✕</button></td>
              </tr>
            `).join('') : `<tr><td colspan="8" style="color:var(--text-muted); text-align:center; padding:24px;">Aucun domaine enregistré.</td></tr>`}
          </tbody>
        </table>
      </div>
      <div class="technique-mobile-list">
        ${tries.length ? tries.map(d => `
          <div class="technique-mcard" data-open-domaine="${d.id}">
            <button class="row-delete-btn technique-mcard-delete" data-delete-domaine="${d.id}" title="Supprimer">✕</button>
            <div class="technique-mcard-titre">${d.nom}</div>
            ${d.client ? `<div class="technique-mcard-sub">${d.client}</div>` : ''}
            <div class="technique-mcard-bottom">
              ${d.dateExpiration ? this._badgeEcheance(d.dateExpiration) : ''}
              ${d.registrar ? `<span>${d.registrar}</span>` : ''}
              ${d.renouvellementAuto ? `<span>✓ Auto</span>` : ''}
              ${d.cout ? `<span class="technique-mcard-cout">${d.cout.toLocaleString('fr-FR')} €</span>` : ''}
            </div>
          </div>
        `).join('') : `<div class="card" style="color:var(--text-muted); text-align:center; padding:24px;">Aucun domaine enregistré.</div>`}
      </div>
    `;
  },

  _htmlHebergements(hebergements) {
    const tries = [...hebergements].sort((a, b) => (a.dateRenouvellement || '').localeCompare(b.dateRenouvellement || ''));
    return `
      <div class="technique-add-row" style="display:flex; justify-content:flex-end; margin-bottom:12px;">
        <button class="btn" id="add-hebergement-btn">+ Nouvel hébergement</button>
      </div>
      <div class="card technique-table-wrap" style="padding:0; overflow-x:auto;">
        <table>
          <thead><tr>
            <th>Fournisseur</th><th>Type</th><th>Projet associé</th><th>Serveur</th><th>Renouvellement</th><th></th><th>Statut</th><th>Coût</th><th>Alerte stockage</th><th></th>
          </tr></thead>
          <tbody>
            ${tries.length ? tries.map(h => `
              <tr data-open-hebergement="${h.id}" style="cursor:pointer;">
                <td>${h.fournisseur}</td>
                <td>${h.typeHebergement || '—'}</td>
                <td>${h.projetAssocie || '—'}</td>
                <td>${h.serveur || '—'}</td>
                <td>${h.dateRenouvellement ? h.dateRenouvellement.split('-').reverse().join('/') : '—'}</td>
                <td>${h.dateRenouvellement ? this._badgeEcheance(h.dateRenouvellement) : ''}</td>
                <td>${h.statut || '—'}</td>
                <td>${h.cout ? h.cout.toLocaleString('fr-FR') + ' €' : '—'}</td>
                <td>${this._estFirebase(h) ? (h.alerteStockageConfiguree ? '<span class="badge badge-blue">✓ Configurée</span>' : '<span class="badge badge-orange">⚠ À faire</span>') : '<span style="color:var(--text-muted);">—</span>'}</td>
                <td style="width:36px;"><button class="row-delete-btn" data-delete-hebergement="${h.id}" title="Supprimer">✕</button></td>
              </tr>
            `).join('') : `<tr><td colspan="10" style="color:var(--text-muted); text-align:center; padding:24px;">Aucun hébergement enregistré.</td></tr>`}
          </tbody>
        </table>
      </div>
      <div class="technique-mobile-list">
        ${tries.length ? tries.map(h => `
          <div class="technique-mcard" data-open-hebergement="${h.id}">
            <button class="row-delete-btn technique-mcard-delete" data-delete-hebergement="${h.id}" title="Supprimer">✕</button>
            <div class="technique-mcard-titre">${h.fournisseur}</div>
            ${(h.typeHebergement || h.projetAssocie) ? `<div class="technique-mcard-sub">${[h.typeHebergement, h.projetAssocie].filter(Boolean).join(' · ')}</div>` : ''}
            <div class="technique-mcard-bottom">
              ${h.dateRenouvellement ? this._badgeEcheance(h.dateRenouvellement) : ''}
              ${h.statut ? `<span>${h.statut}</span>` : ''}
              ${h.cout ? `<span class="technique-mcard-cout">${h.cout.toLocaleString('fr-FR')} €</span>` : ''}
            </div>
            ${this._estFirebase(h) ? `<div style="margin-top:6px;">${h.alerteStockageConfiguree ? '<span class="badge badge-blue">✓ Alerte configurée</span>' : '<span class="badge badge-orange">⚠ Alerte à faire</span>'}</div>` : ''}
          </div>
        `).join('') : `<div class="card" style="color:var(--text-muted); text-align:center; padding:24px;">Aucun hébergement enregistré.</div>`}
      </div>
    `;
  },

  _htmlMaintenance(maintenance) {
    const tries = [...maintenance].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return `
      <div class="technique-add-row" style="display:flex; justify-content:flex-end; margin-bottom:12px;">
        <button class="btn" id="add-maintenance-btn">+ Nouvelle intervention</button>
      </div>
      ${tries.length ? tries.map(m => `
        <div class="card technique-maintenance-carte" style="margin-bottom:12px; cursor:pointer;" data-open-maintenance="${m.id}">
          <div style="display:flex; justify-content:space-between; align-items:baseline; gap:10px;">
            <div style="font-weight:600;">${m.date ? m.date.split('-').reverse().join('/') : ''} — ${m.client || 'Client non précisé'}${m.projet ? ` · ${m.projet}` : ''}</div>
            <button class="row-delete-btn" data-delete-maintenance="${m.id}" title="Supprimer">✕</button>
          </div>
          ${(m.items || []).length ? `<div style="margin-top:8px; font-size:13px; color:var(--text-secondary);">${m.items.map(it => `✔ ${it}`).join('<br>')}</div>` : ''}
          ${m.notes ? `<div style="margin-top:8px; font-size:12.5px; color:var(--text-muted);">${m.notes}</div>` : ''}
        </div>
      `).join('') : `<div class="card" style="color:var(--text-muted); text-align:center; padding:24px;">Aucune intervention enregistrée — ton historique de maintenance apparaîtra ici.</div>`}
    `;
  },

  _htmlAcces(acces, entreprise) {
    return `
      <div class="technique-add-row" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:10px;">
        <button class="btn-ghost" id="ouvrir-gestionnaire-mdp" style="display:flex; align-items:center; gap:6px;">
          <span class="nav-icon" data-icon="lock"></span> Ouvrir mon gestionnaire de mots de passe
        </button>
        <button class="btn" id="add-acces-btn">+ Nouvel accès</button>
      </div>
      ${!entreprise.gestionnaireMdpUrl ? `<div class="stat-sub" style="margin-bottom:12px;">Aucun gestionnaire configuré — ajoute le lien dans Paramétrage &gt; Général.</div>` : ''}
      <div class="card technique-table-wrap" style="padding:0; overflow-x:auto;">
        <table>
          <thead><tr>
            <th>Service</th><th>Client</th><th>Identifiant</th><th>URL</th><th>Où trouver le mot de passe</th><th></th>
          </tr></thead>
          <tbody>
            ${acces.length ? acces.map(a => `
              <tr data-open-acces="${a.id}" style="cursor:pointer;">
                <td>${a.service}</td>
                <td>${a.client || '—'}</td>
                <td>${a.identifiant || '—'}</td>
                <td>${a.url ? `<a href="${a.url}" target="_blank" rel="noopener" onclick="event.stopPropagation();">${a.url.replace(/^https?:\/\//, '').slice(0, 30)}</a>` : '—'}</td>
                <td>${a.emplacementMotDePasse || '—'}</td>
                <td style="width:36px;"><button class="row-delete-btn" data-delete-acces="${a.id}" title="Supprimer">✕</button></td>
              </tr>
            `).join('') : `<tr><td colspan="6" style="color:var(--text-muted); text-align:center; padding:24px;">Aucun accès enregistré. Les mots de passe eux-mêmes ne sont jamais stockés ici — seulement où les retrouver.</td></tr>`}
          </tbody>
        </table>
      </div>
      <div class="technique-mobile-list">
        ${acces.length ? acces.map(a => `
          <div class="technique-mcard" data-open-acces="${a.id}">
            <button class="row-delete-btn technique-mcard-delete" data-delete-acces="${a.id}" title="Supprimer">✕</button>
            <div class="technique-mcard-titre">${a.service}</div>
            ${a.client ? `<div class="technique-mcard-sub">${a.client}</div>` : ''}
            ${a.url ? `<div class="technique-mcard-sub"><a href="${a.url}" target="_blank" rel="noopener" onclick="event.stopPropagation();">${a.url.replace(/^https?:\/\//, '').slice(0, 40)}</a></div>` : ''}
            ${a.emplacementMotDePasse ? `<div class="technique-mcard-bottom"><span>🔑 ${a.emplacementMotDePasse}</span></div>` : ''}
          </div>
        `).join('') : `<div class="card" style="color:var(--text-muted); text-align:center; padding:24px;">Aucun accès enregistré. Les mots de passe eux-mêmes ne sont jamais stockés ici — seulement où les retrouver.</div>`}
      </div>
    `;
  },

  // ── Formulaires (règle non négociable : tout paramétrable, pas de prompt()) ──
  _formDomaine(d) {
    const isEdit = !!d;
    d = d || { nom: '', client: '', registrar: '', cout: 0, dateAchat: '', dateExpiration: '', renouvellementAuto: false, identifiantCompte: '', url: '', notes: '' };
    return `
      <div class="modal-overlay" id="technique-modal-overlay">
        <div class="modal-box">
          <div class="modal-title">${isEdit ? 'Modifier le domaine' : 'Nouveau domaine'}</div>
          <form id="technique-form">
            <div class="modal-field"><label>Domaine</label><input type="text" name="nom" value="${d.nom}" placeholder="ex : dupont.fr" required autofocus></div>
            <div class="modal-field"><label>Client</label><input type="text" name="client" value="${d.client || ''}"></div>
            <div style="display:flex; gap:14px;">
              <div class="modal-field" style="flex:1;"><label>Registrar</label><input type="text" name="registrar" value="${d.registrar || ''}" placeholder="ex : OVH, Gandi..."></div>
              <div class="modal-field" style="flex:1;"><label>Coût annuel (€)</label><input type="number" name="cout" min="0" step="0.01" value="${d.cout || 0}"></div>
            </div>
            <div style="display:flex; gap:14px;">
              <div class="modal-field" style="flex:1;"><label>Date d'achat</label><input type="date" name="dateAchat" value="${d.dateAchat || ''}"></div>
              <div class="modal-field" style="flex:1;"><label>Date d'expiration</label><input type="date" name="dateExpiration" value="${d.dateExpiration || ''}" required></div>
            </div>
            <label class="devis-paye-label"><input type="checkbox" name="renouvellementAuto" ${d.renouvellementAuto ? 'checked' : ''}> Renouvellement automatique activé</label>
            <div class="modal-field"><label>Identifiant de compte (registrar)</label><input type="text" name="identifiantCompte" value="${d.identifiantCompte || ''}"></div>
            <div class="modal-field"><label>URL de gestion</label><input type="url" name="url" value="${d.url || ''}" placeholder="https://..."></div>
            <div class="modal-field"><label>Notes</label><textarea name="notes">${d.notes || ''}</textarea></div>
            <div class="modal-actions">
              ${isEdit ? `<button type="button" class="btn btn-danger" id="technique-delete-btn">Supprimer</button>` : `<span></span>`}
              <div class="modal-actions-right">
                <button type="button" class="btn btn-ghost" id="technique-cancel-btn">Annuler</button>
                <button type="submit" class="btn">${isEdit ? 'Enregistrer' : 'Ajouter'}</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  _formHebergement(h) {
    const isEdit = !!h;
    h = h || { fournisseur: '', typeHebergement: '', cout: 0, serveur: '', projetAssocie: '', dateRenouvellement: '', url: '', statut: 'Actif', notes: '', alerteStockageConfiguree: false };
    const estFirebase = this._estFirebase(h);
    return `
      <div class="modal-overlay" id="technique-modal-overlay">
        <div class="modal-box">
          <div class="modal-title">${isEdit ? "Modifier l'hébergement" : 'Nouvel hébergement'}</div>
          <form id="technique-form">
            <div class="modal-field"><label>Fournisseur</label><input type="text" name="fournisseur" value="${h.fournisseur}" placeholder="ex : OVH, Vercel, Firebase..." required autofocus></div>
            <div style="display:flex; gap:14px;">
              <div class="modal-field" style="flex:1;"><label>Type d'hébergement</label><input type="text" name="typeHebergement" value="${h.typeHebergement || ''}" placeholder="ex : mutualisé, VPS, serverless..."></div>
              <div class="modal-field" style="flex:1;"><label>Coût annuel (€)</label><input type="number" name="cout" min="0" step="0.01" value="${h.cout || 0}"></div>
            </div>
            <div style="display:flex; gap:14px;">
              <div class="modal-field" style="flex:1;"><label>Serveur</label><input type="text" name="serveur" value="${h.serveur || ''}"></div>
              <div class="modal-field" style="flex:1;"><label>Projet associé</label><input type="text" name="projetAssocie" value="${h.projetAssocie || ''}"></div>
            </div>
            <div class="modal-field"><label>Date de renouvellement</label><input type="date" name="dateRenouvellement" value="${h.dateRenouvellement || ''}" required></div>
            <div class="modal-field"><label>URL de gestion</label><input type="url" name="url" value="${h.url || ''}" placeholder="https://..."></div>
            <div class="modal-field"><label>Statut</label>
              <select name="statut">
                ${['Actif', 'À renouveler', 'Résilié'].map(s => `<option value="${s}" ${s === h.statut ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
            </div>
            <div class="modal-field" id="technique-bloc-firebase" style="${estFirebase ? '' : 'display:none;'} background:var(--bg-input); border-radius:9px; padding:12px;">
              <label class="devis-paye-label"><input type="checkbox" name="alerteStockageConfiguree" ${h.alerteStockageConfiguree ? 'checked' : ''}> Alerte de quota de stockage Firebase configurée</label>
              <div style="font-size:12px; color:var(--text-muted); margin-top:6px;">Rappel : configure-la une fois par client (Cloud Monitoring, quelques minutes, aucune ligne de code), seuil à 80 % (4 Go/5 Go) — c'est TOI qui reçois l'email d'alerte quand un client s'en approche, pas lui.</div>
            </div>
            <div class="modal-field"><label>Notes</label><textarea name="notes">${h.notes || ''}</textarea></div>
            <div class="modal-actions">
              ${isEdit ? `<button type="button" class="btn btn-danger" id="technique-delete-btn">Supprimer</button>` : `<span></span>`}
              <div class="modal-actions-right">
                <button type="button" class="btn btn-ghost" id="technique-cancel-btn">Annuler</button>
                <button type="submit" class="btn">${isEdit ? 'Enregistrer' : 'Ajouter'}</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  _CHECKLIST_DEFAUT: ['Mise à jour dépendances', 'Vérification sauvegarde', 'Test connexion', 'Vérification fonctionnement'],

  _formMaintenance(m) {
    const isEdit = !!m;
    const pad = (n) => String(n).padStart(2, '0');
    const auj = new Date();
    const aujStr = `${auj.getFullYear()}-${pad(auj.getMonth() + 1)}-${pad(auj.getDate())}`;
    m = m || { date: aujStr, client: '', projet: '', items: this._CHECKLIST_DEFAUT.slice(), notes: '' };
    return `
      <div class="modal-overlay" id="technique-modal-overlay">
        <div class="modal-box">
          <div class="modal-title">${isEdit ? "Modifier l'intervention" : 'Nouvelle intervention'}</div>
          <form id="technique-form">
            <div style="display:flex; gap:14px;">
              <div class="modal-field" style="flex:1;"><label>Date</label><input type="date" name="date" value="${m.date}" required autofocus></div>
              <div class="modal-field" style="flex:1;"><label>Client</label><input type="text" name="client" value="${m.client || ''}"></div>
            </div>
            <div class="modal-field"><label>Projet</label><input type="text" name="projet" value="${m.projet || ''}"></div>
            <div class="modal-field">
              <label>Ce qui a été fait (une ligne par action)</label>
              <textarea name="items" style="min-height:100px;">${(m.items || []).join('\n')}</textarea>
            </div>
            <div class="modal-field"><label>Notes (optionnel)</label><textarea name="notes">${m.notes || ''}</textarea></div>
            <div class="modal-actions">
              ${isEdit ? `<button type="button" class="btn btn-danger" id="technique-delete-btn">Supprimer</button>` : `<span></span>`}
              <div class="modal-actions-right">
                <button type="button" class="btn btn-ghost" id="technique-cancel-btn">Annuler</button>
                <button type="submit" class="btn">${isEdit ? 'Enregistrer' : 'Ajouter'}</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  _formAcces(a) {
    const isEdit = !!a;
    a = a || { service: '', client: '', url: '', identifiant: '', emplacementMotDePasse: '', notes: '' };
    return `
      <div class="modal-overlay" id="technique-modal-overlay">
        <div class="modal-box">
          <div class="modal-title">${isEdit ? "Modifier l'accès" : 'Nouvel accès'}</div>
          <form id="technique-form">
            <div class="modal-field"><label>Service</label><input type="text" name="service" value="${a.service}" placeholder="ex : GitHub, Firebase, OVH, Hosting, Email, Analytics..." required autofocus></div>
            <div class="modal-field"><label>Client (optionnel, si spécifique à un client)</label><input type="text" name="client" value="${a.client || ''}"></div>
            <div class="modal-field"><label>URL</label><input type="url" name="url" value="${a.url || ''}" placeholder="https://..."></div>
            <div class="modal-field"><label>Identifiant</label><input type="text" name="identifiant" value="${a.identifiant || ''}"></div>
            <div class="modal-field"><label>Où trouver le mot de passe</label><input type="text" name="emplacementMotDePasse" value="${a.emplacementMotDePasse || ''}" placeholder="ex : Bitwarden — dossier Pro"></div>
            <div class="modal-field"><label>Notes</label><textarea name="notes">${a.notes || ''}</textarea></div>
            <div class="modal-actions">
              ${isEdit ? `<button type="button" class="btn btn-danger" id="technique-delete-btn">Supprimer</button>` : `<span></span>`}
              <div class="modal-actions-right">
                <button type="button" class="btn btn-ghost" id="technique-cancel-btn">Annuler</button>
                <button type="submit" class="btn">${isEdit ? 'Enregistrer' : 'Ajouter'}</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  // ── Ouverture générique d'un modal (même squelette pour les 4 types) ──
  _openForm(categorie, item) {
    const html = categorie === 'domaines' ? this._formDomaine(item)
      : categorie === 'hebergements' ? this._formHebergement(item)
      : categorie === 'maintenance' ? this._formMaintenance(item)
      : this._formAcces(item);

    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    document.body.appendChild(wrap.firstElementChild);
    const overlay = document.getElementById('technique-modal-overlay');
    const close = () => overlay.remove();

    let mousedownSurOverlay = false;
    overlay.addEventListener('mousedown', (e) => { mousedownSurOverlay = (e.target === overlay); });
    overlay.addEventListener('click', (e) => { if (e.target === overlay && mousedownSurOverlay) close(); });
    document.getElementById('technique-cancel-btn').addEventListener('click', close);

    // Formulaire Hébergement : le bloc "alerte de quota Firebase" doit
    // apparaître dès que Tiphaine tape "Firebase" (fournisseur ou type),
    // pas seulement en édition d'une entrée déjà enregistrée — sinon le
    // rappel n'apparaît jamais au moment où elle crée le nouveau projet.
    if (categorie === 'hebergements') {
      const blocFirebase = document.getElementById('technique-bloc-firebase');
      const champFournisseur = overlay.querySelector('[name="fournisseur"]');
      const champType = overlay.querySelector('[name="typeHebergement"]');
      const majBlocFirebase = () => {
        const texte = `${champFournisseur.value} ${champType.value}`.toLowerCase();
        blocFirebase.style.display = texte.includes('firebase') ? '' : 'none';
      };
      champFournisseur.addEventListener('input', majBlocFirebase);
      champType.addEventListener('input', majBlocFirebase);
    }

    const deleteBtn = document.getElementById('technique-delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        window.confirmerAction('Supprimer cette entrée ?', () => {
          this._data[categorie] = this._data[categorie].filter(x => x.id !== item.id);
          this._setData(this._data);
          close();
          this.render(this._root);
        });
      });
    }

    document.getElementById('technique-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      let payload;
      if (categorie === 'domaines') {
        payload = {
          nom: fd.get('nom').trim(), client: fd.get('client').trim(), registrar: fd.get('registrar').trim(),
          cout: parseFloat(fd.get('cout') || '0'), dateAchat: fd.get('dateAchat'), dateExpiration: fd.get('dateExpiration'),
          renouvellementAuto: fd.get('renouvellementAuto') === 'on', identifiantCompte: fd.get('identifiantCompte').trim(),
          url: fd.get('url').trim(), notes: fd.get('notes').trim(),
        };
        if (!payload.nom || !payload.dateExpiration) return;
      } else if (categorie === 'hebergements') {
        payload = {
          fournisseur: fd.get('fournisseur').trim(), typeHebergement: fd.get('typeHebergement').trim(),
          cout: parseFloat(fd.get('cout') || '0'), serveur: fd.get('serveur').trim(), projetAssocie: fd.get('projetAssocie').trim(),
          dateRenouvellement: fd.get('dateRenouvellement'), url: fd.get('url').trim(), statut: fd.get('statut'), notes: fd.get('notes').trim(),
          alerteStockageConfiguree: fd.get('alerteStockageConfiguree') === 'on',
        };
        if (!payload.fournisseur || !payload.dateRenouvellement) return;
      } else if (categorie === 'maintenance') {
        payload = {
          date: fd.get('date'), client: fd.get('client').trim(), projet: fd.get('projet').trim(),
          items: fd.get('items').split('\n').map(s => s.trim()).filter(Boolean),
          notes: fd.get('notes').trim(),
        };
        if (!payload.date) return;
      } else {
        payload = {
          service: fd.get('service').trim(), client: fd.get('client').trim(), url: fd.get('url').trim(),
          identifiant: fd.get('identifiant').trim(), emplacementMotDePasse: fd.get('emplacementMotDePasse').trim(), notes: fd.get('notes').trim(),
        };
        if (!payload.service) return;
      }

      if (item) {
        Object.assign(item, payload);
      } else {
        this._data[categorie].push({ id: Date.now(), ...payload });
      }
      this._setData(this._data);
      close();
      this.render(this._root);
    });
  },

  _bindContenu(zone) {
    const addDomaine = zone.querySelector('#add-domaine-btn');
    if (addDomaine) addDomaine.addEventListener('click', () => this._openForm('domaines', null));
    const addHebergement = zone.querySelector('#add-hebergement-btn');
    if (addHebergement) addHebergement.addEventListener('click', () => this._openForm('hebergements', null));
    const addMaintenance = zone.querySelector('#add-maintenance-btn');
    if (addMaintenance) addMaintenance.addEventListener('click', () => this._openForm('maintenance', null));
    const addAcces = zone.querySelector('#add-acces-btn');
    if (addAcces) addAcces.addEventListener('click', () => this._openForm('acces', null));

    const ouvrirMdp = zone.querySelector('#ouvrir-gestionnaire-mdp');
    if (ouvrirMdp) ouvrirMdp.addEventListener('click', () => {
      const catalogue = window.Modules && window.Modules.catalogue;
      const url = catalogue ? catalogue._getEntreprise().gestionnaireMdpUrl : '';
      if (url) window.open(url, '_blank', 'noopener');
      else location.hash = '#/parametrage';
    });

    const ouvrirLigne = (selector, categorie) => {
      zone.querySelectorAll(selector).forEach(row => {
        row.addEventListener('click', (e) => {
          if (e.target.closest('[class*="delete"]') || e.target.closest('a')) return;
          const id = Number(row.dataset[Object.keys(row.dataset).find(k => k.toLowerCase().startsWith('open'))]);
          const item = this._data[categorie].find(x => x.id === id);
          if (item) this._openForm(categorie, item);
        });
      });
    };
    ouvrirLigne('[data-open-domaine]', 'domaines');
    ouvrirLigne('[data-open-hebergement]', 'hebergements');
    ouvrirLigne('[data-open-maintenance]', 'maintenance');
    ouvrirLigne('[data-open-acces]', 'acces');

    const supprimerLigne = (selector, categorie, dataKey) => {
      zone.querySelectorAll(selector).forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = Number(btn.dataset[dataKey]);
          window.confirmerAction('Supprimer cette entrée ?', () => {
            this._data[categorie] = this._data[categorie].filter(x => x.id !== id);
            this._setData(this._data);
            this.render(this._root);
          });
        });
      });
    };
    supprimerLigne('[data-delete-domaine]', 'domaines', 'deleteDomaine');
    supprimerLigne('[data-delete-hebergement]', 'hebergements', 'deleteHebergement');
    supprimerLigne('[data-delete-maintenance]', 'maintenance', 'deleteMaintenance');
    supprimerLigne('[data-delete-acces]', 'acces', 'deleteAcces');
  },

  _bindEvents(container) {
    container.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => { this._vue = btn.dataset.tab; this.render(this._root); });
    });

    this._bindContenu(container);
  },
};

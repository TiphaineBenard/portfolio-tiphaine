/* ═══════════════════════════════════════════════════════════
   MODULE ABONNEMENTS — abonnements mensuels actifs (Site/App ×
   Essentiel/Sérénité/Performance), avec heures incluses pour le
   suivi de consommation (module Temps s'appuie dessus).
   TODO Firebase pour la persistance.
═══════════════════════════════════════════════════════════ */

window.Modules = window.Modules || {};

window.Modules.abonnements = {
  _data: null,
  _recherche: '',

  _abosFiltres(abos) {
    const q = (this._recherche || '').trim().toLowerCase();
    if (!q) return abos;
    return abos.filter(a => (a.client || '').toLowerCase().includes(q) || (a.entreprise || '').toLowerCase().includes(q) || (a.formule || '').toLowerCase().includes(q));
  },

  // Grille des formules — entièrement paramétrable depuis l'onglet
  // Paramétrage (03/09/2026) : avant, objet figé en dur ici. `_getGrille()`
  // renvoie les valeurs personnalisées si elles existent (localStorage
  // `tos_grille_abonnements`), sinon les défauts d'origine (voir
  // Etude_Marche_Tarification_TiphaineBenard.docx). Ne JAMAIS lire
  // `this._grille` directement ailleurs dans le code — toujours passer par
  // `_getGrille()` pour respecter les valeurs modifiées par Tiphaine.
  _grilleParDefaut() {
    return {
      'Site — Essentiel':    { mrr:29,  heuresIncluses:0 },
      'Site — Sérénité':     { mrr:49,  heuresIncluses:0 },
      'Site — Performance':  { mrr:99,  heuresIncluses:1 },
      'App — Essentiel':     { mrr:39,  heuresIncluses:0 },
      'App — Sérénité':      { mrr:69,  heuresIncluses:0 },
      'App — Performance':   { mrr:119, heuresIncluses:1 },
    };
  },
  _getGrille() {
    try {
      const stockee = JSON.parse(localStorage.getItem('tos_grille_abonnements') || 'null');
      if (stockee && Object.keys(stockee).length) return stockee;
    } catch (e) { /* ignore */ }
    return this._grilleParDefaut();
  },
  _setGrille(grille) {
    localStorage.setItem('tos_grille_abonnements', JSON.stringify(grille));
  },
  _ajouterFormule(nom) {
    const grille = this._getGrille();
    if (grille[nom]) return;
    grille[nom] = { mrr: 0, heuresIncluses: 0 };
    this._setGrille(grille);
  },
  _supprimerFormule(nom) {
    if (this._data && this._data.some(a => a.formule === nom)) {
      alert(`Impossible : au moins un abonnement actif utilise encore la formule "${nom}". Change d'abord son abonnement.`);
      return false;
    }
    const grille = this._getGrille();
    delete grille[nom];
    this._setGrille(grille);
    return true;
  },
  _modifierFormule(nom, champ, valeur) {
    const grille = this._getGrille();
    if (!grille[nom]) return;
    grille[nom][champ] = valeur;
    this._setGrille(grille);
  },

  // ── Suivi "mois facturé / pas facturé" (05/09/2026) ──────────────────
  // Pas de case à cocher sur l'abonnement (ça peut se désynchroniser, ex :
  // si la facture est annulée après coup) — calculé à chaque affichage à
  // partir des VRAIES factures (module Factures), en cherchant dans leurs
  // lignes une correspondance `abonnementId` + `periode` ('YYYY-MM'). Une
  // ligne appartenant à une facture Annulée ne compte pas comme facturée.
  _cleMois(date) {
    const d = (date instanceof Date) ? date : new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  },

  // Tous les mois dus entre le début de l'abonnement et aujourd'hui
  // (inclus), un par mois calendaire — pas de dépendance à une date de
  // résiliation ici : les abonnements résiliés ne sont plus dans
  // `this._data` (voir `_ouvrirResiliation`), donc ce calcul ne s'applique
  // qu'aux abonnements actifs.
  //
  // Premier mois partiel (05/09/2026, confirmé avec Tiphaine — ex : site
  // livré le 21/09, abonnement qui démarre ce jour-là) : choix DÉLIBÉRÉ
  // de ne PAS proratiser. Le mois de démarrage compte comme un mois plein,
  // facturé plein tarif via `_facturerMois` (montant = MRR entier de la
  // formule, jamais recalculé au prorata des jours). Le plus simple à
  // suivre, pas de calcul au jour près à refaire à chaque nouvel
  // abonnement.
  _moisAttendus(abo) {
    if (!abo.dateDebut) return [];
    const debut = new Date(abo.dateDebut);
    const aujourdhui = new Date();
    const mois = [];
    let cur = new Date(debut.getFullYear(), debut.getMonth(), 1);
    const fin = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), 1);
    while (cur <= fin) {
      mois.push(this._cleMois(cur));
      cur.setMonth(cur.getMonth() + 1);
    }
    return mois;
  },

  _moisDejaFactures(abo) {
    const factures = window.Modules && window.Modules.factures;
    const set = new Set();
    if (!factures) return set;
    if (!factures._data) factures._data = window.FIREBASE_READY ? [] : (factures._mock ? factures._mock() : []);
    factures._data.forEach(f => {
      if (f.statut === 'Annulée') return;
      (f.lignes || []).forEach(l => { if (l.abonnementId === abo.id && l.periode) set.add(l.periode); });
    });
    return set;
  },

  _moisNonFactures(abo) {
    const factures = this._moisDejaFactures(abo);
    return this._moisAttendus(abo).filter(m => !factures.has(m));
  },

  // Ouvre directement le formulaire Factures pré-rempli pour le mois le
  // plus ancien non facturé — un mois à la fois (plus sûr qu'un rattrapage
  // groupé si plusieurs mois de retard se sont accumulés). Pas de
  // `projetId` ici donc `brouillonParDefaut:false` explicite (voir
  // factures.js) : c'est une action délibérée depuis une liste claire,
  // pas une création à l'aveugle qui devrait rester en brouillon.
  _facturerMois(abo, moisCle) {
    const factures = window.Modules && window.Modules.factures;
    if (!factures) { alert('Module Factures indisponible.'); return; }
    const grille = this._getGrille();
    const mrr = (grille[abo.formule] || {}).mrr || 0;
    const dashboard = window.Modules && window.Modules.dashboard;
    const moisLabel = dashboard ? dashboard._moisLabel(moisCle) : moisCle;
    factures._openForm(null, {
      type: 'Abonnement',
      client: abo.client,
      entreprise: abo.entreprise,
      clientId: abo.clientId || null,
      lignes: [{ description: `Abonnement ${abo.formule} — ${moisLabel}`, montant: mrr, abonnementId: abo.id, periode: moisCle }],
      brouillonParDefaut: false,
    });
  },

  // Nom client cliquable si `clientId` existe (05/09/2026, même logique que
  // devis.js/projets.js/factures.js).
  _nomClientAffiche(a) {
    if (a.clientId) {
      const clientsModule = window.Modules && window.Modules.clients;
      const c = clientsModule && clientsModule._data ? clientsModule._data.find(x => x.id === a.clientId) : null;
      if (c) return `<a href="#" data-voir-client="${c.id}" style="color:var(--text-primary); text-decoration:underline; text-decoration-color:rgba(255,255,255,.25);">${c.nom}</a>${c.entreprise ? ` <span style="color:#6a6a6a;">— ${c.entreprise}</span>` : ''}`;
    }
    return `${a.client}${a.entreprise ? ` <span style="color:#6a6a6a;">— ${a.entreprise}</span>` : ''}`;
  },

  // ── Historique des résiliations (04/09/2026) ─────────────────────
  // Avant, "Résilier" supprimait purement et simplement l'abonnement —
  // aucune trace de quand ni pourquoi un client était parti. Ajouté
  // suite à la revue complète de l'app : utile plus tard pour
  // comprendre le taux de rétention MRR dans Finances, pas juste
  // savoir qu'un client est parti mais pourquoi.
  _getResilies() {
    try {
      const stockes = JSON.parse(localStorage.getItem('tos_abonnements_resilies') || 'null');
      if (Array.isArray(stockes)) return stockes;
    } catch (e) { /* ignore */ }
    return [];
  },
  _setResilies(liste) {
    localStorage.setItem('tos_abonnements_resilies', JSON.stringify(liste));
  },

  async render(container) {
    if (!this._data) {
      this._data = window.FIREBASE_READY ? await this._fetchReal() : this._mock();
    }
    this._root = container.closest('#content') || container;
    container.innerHTML = this._html(this._data);
    window.hydrateIcons(container);
    this._bindEvents(container);
  },

  _mock() {
    // Données de démo vidées le 04/09/2026 (voir clients.js).
    return [];
  },

  async _fetchReal() {
    // TODO Firebase : const snap = await window.db.collection('abonnements').get();
    return this._mock();
  },

  _html(abos) {
    const grille = this._getGrille();
    const mrrTotal = abos.reduce((s, a) => s + (grille[a.formule]?.mrr || 0), 0);
    const resilies = this._getResilies();
    return `
      <div class="page-header-row">
        <div>
          <div class="page-title"><span class="nav-icon" data-icon="refresh"></span>Abonnements</div>
          <div class="page-sub">${abos.length} abonnement${abos.length > 1 ? 's' : ''} actif${abos.length > 1 ? 's' : ''} — ${mrrTotal.toLocaleString('fr-FR')} €/mois de MRR</div>
        </div>
        <div class="page-header-actions">
          <button class="btn-ghost" id="voir-resilies-btn" style="white-space:nowrap;">Résiliés (${resilies.length})</button>
          <button class="btn" id="add-abo-btn" style="white-space:nowrap;">+ Nouvel abonnement</button>
        </div>
      </div>
      <div id="abos-tableau-zone">${this._htmlTableau(this._abosFiltres(abos))}</div>
    `;
  },

  _htmlTableau(abos) {
    const grille = this._getGrille();
    const dashboard = window.Modules && window.Modules.dashboard;
    return `
      <div class="card abos-table-wrap" style="padding:0; overflow-x:auto;">
        <table>
          <thead><tr>
            <th>Client</th><th>Formule</th><th>MRR</th><th>Heures incluses/mois</th><th>Depuis</th><th>Facturation</th><th></th>
          </tr></thead>
          <tbody>
            ${abos.length ? abos.map(a => {
              const g = grille[a.formule] || { mrr:0, heuresIncluses:0 };
              const nonFactures = this._moisNonFactures(a);
              return `
              <tr data-open="${a.id}" style="cursor:pointer;">
                <td>${this._nomClientAffiche(a)}</td>
                <td>${a.formule}</td>
                <td>${g.mrr} €/mois</td>
                <td>${g.heuresIncluses ? g.heuresIncluses.toString().replace('.', ',') + ' h' : '—'}</td>
                <td>${a.dateDebut}</td>
                <td onclick="event.stopPropagation()">
                  ${!nonFactures.length
                    ? '<span style="color:#6ec88c; font-size:12px;">✓ à jour</span>'
                    : `<button class="btn-ghost" style="padding:5px 10px; font-size:11.5px; border-radius:7px;" data-facturer-mois="${a.id}" data-mois="${nonFactures[0]}" title="${nonFactures.length > 1 ? nonFactures.length + ' mois non facturés' : '1 mois non facturé'}">Facturer ${dashboard ? dashboard._moisLabel(nonFactures[0]) : nonFactures[0]}${nonFactures.length > 1 ? ` (+${nonFactures.length - 1})` : ''}</button>`}
                </td>
                <td style="width:36px;"><button class="row-delete-btn" data-delete="${a.id}" title="Supprimer">✕</button></td>
              </tr>
            `;}).join('') : `<tr><td colspan="7" style="color:var(--text-muted); text-align:center; padding:24px;">Aucun abonnement ${this._recherche ? 'ne correspond à cette recherche' : 'pour le moment'}.</td></tr>`}
          </tbody>
        </table>
      </div>

      <!-- Version mobile (07/09/2026, même pattern que Devis/Factures/
           Clients/Tickets) — liste de cartes au lieu du tableau à 7
           colonnes (illisible en scroll horizontal sur mobile). -->
      <div class="abos-mobile-list">
        ${abos.length ? abos.map(a => this._htmlCarteMobile(a)).join('') : `<div class="card" style="color:var(--text-muted); text-align:center; padding:24px;">Aucun abonnement ${this._recherche ? 'ne correspond à cette recherche' : 'pour le moment'}.</div>`}
      </div>
    `;
  },

  // Carte mobile d'un abonnement (07/09/2026). Le bouton "Facturer" (mois
  // le plus ancien non facturé) reprend le même traitement plein-largeur
  // que "Marquer payée"/"✓ Résolu" sur Factures/Tickets — c'est l'action
  // la plus fréquente sur cette page, elle doit être atteignable en un
  // tap sans ouvrir la fiche.
  _htmlCarteMobile(a) {
    const grille = this._getGrille();
    const g = grille[a.formule] || { mrr: 0, heuresIncluses: 0 };
    const nonFactures = this._moisNonFactures(a);
    const dashboard = window.Modules && window.Modules.dashboard;
    return `
      <div class="abo-mcard" data-open="${a.id}">
        <button class="row-delete-btn abo-mcard-delete" data-delete="${a.id}" title="Résilier">✕</button>
        <div class="abo-mcard-client">${this._nomClientAffiche(a)}</div>
        <div class="abo-mcard-formule">${a.formule}</div>
        <div class="abo-mcard-bottom">
          <span class="abo-mcard-mrr">${g.mrr} €/mois</span>
          ${g.heuresIncluses ? `<span class="abo-mcard-heures">${g.heuresIncluses.toString().replace('.', ',')} h incluses</span>` : ''}
          <span class="abo-mcard-depuis">Depuis ${a.dateDebut}</span>
        </div>
        ${!nonFactures.length
          ? `<div class="abo-mcard-a-jour">✓ Facturation à jour</div>`
          : `<button class="abo-mcard-facturer" data-facturer-mois="${a.id}" data-mois="${nonFactures[0]}">Facturer ${dashboard ? dashboard._moisLabel(nonFactures[0]) : nonFactures[0]}${nonFactures.length > 1 ? ` (+${nonFactures.length - 1})` : ''}</button>`}
      </div>
    `;
  },

  _formHtml(a) {
    const isEdit = !!a;
    a = a || { client:'', entreprise:'', clientId:null, formule:'Site — Essentiel', dateDebut:new Date().toISOString().slice(0,10) };
    const clientsModule = window.Modules.clients;
    const clientsExistants = (clientsModule && clientsModule._data) ? clientsModule._data : [];
    return `
      <div class="modal-overlay" id="abo-modal-overlay">
        <div class="modal-box">
          <div class="modal-title">${isEdit ? "Modifier l'abonnement" : 'Nouvel abonnement'}</div>
          <form id="abo-form">
            ${clientsExistants.length ? `
            <div class="modal-field">
              <label>Reprendre un client existant (pré-remplit ses infos, tout reste modifiable)</label>
              <select id="abo-client-existant-select">
                <option value="">— Nouveau client / saisie libre —</option>
                ${clientsExistants.map(c => `<option value="${c.id}" ${a.clientId === c.id ? 'selected' : ''}>${c.nom}${c.entreprise ? ' — ' + c.entreprise : ''}</option>`).join('')}
              </select>
            </div>` : ''}
            <input type="hidden" name="clientId" id="abo-clientid-input" value="${a.clientId || ''}">
            <div class="modal-field">
              <label>Client${a.clientId ? ' — <a href="#" id="abo-voir-client-lien" style="color:var(--text-secondary); font-weight:400;">voir la fiche client →</a>' : ''}</label>
              <input type="text" name="client" id="abo-client-input" value="${a.client}" required autofocus>
            </div>
            <div class="modal-field">
              <label>Entreprise</label>
              <input type="text" name="entreprise" id="abo-entreprise-input" value="${a.entreprise || ''}">
            </div>
            <div class="modal-field">
              <label>Formule</label>
              <select name="formule">
                ${Object.keys(this._getGrille()).map(f => `<option value="${f}" ${f === a.formule ? 'selected' : ''}>${f} — ${this._getGrille()[f].mrr} €/mois</option>`).join('')}
              </select>
            </div>
            <div class="modal-field">
              <label>Actif depuis</label>
              <input type="date" name="dateDebut" value="${a.dateDebut}">
            </div>
            <div class="modal-actions">
              ${isEdit ? `<button type="button" class="btn btn-danger" id="abo-delete-btn">Résilier</button>` : `<span></span>`}
              <div class="modal-actions-right">
                <button type="button" class="btn btn-ghost" id="abo-cancel-btn">Annuler</button>
                <button type="submit" class="btn">${isEdit ? 'Enregistrer' : 'Ajouter'}</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  // Modal dédiée à la résiliation — remplace un simple confirm() : capte
  // la date et la raison plutôt que de juste supprimer l'abonnement.
  _ouvrirResiliation(abo) {
    const aujourdhui = new Date().toISOString().slice(0, 10);
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="modal-overlay" id="resiliation-modal-overlay">
        <div class="modal-box">
          <div class="modal-title">Résilier l'abonnement — ${abo.client}</div>
          <form id="resiliation-form">
            <div class="modal-field"><label>Date de résiliation</label><input type="date" name="dateResiliation" value="${aujourdhui}" required></div>
            <div class="modal-field"><label>Raison (optionnel)</label><textarea name="raison" placeholder="ex : projet arrêté, passé chez un concurrent, budget..."></textarea></div>
            <div class="modal-actions">
              <span></span>
              <div class="modal-actions-right">
                <button type="button" class="btn btn-ghost" id="resiliation-cancel-btn">Annuler</button>
                <button type="submit" class="btn btn-danger">Résilier</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;
    document.body.appendChild(wrap.firstElementChild);
    const overlay = document.getElementById('resiliation-modal-overlay');
    const close = () => overlay.remove();
    let mousedownSurOverlay = false;
    overlay.addEventListener('mousedown', (e) => { mousedownSurOverlay = (e.target === overlay); });
    overlay.addEventListener('click', (e) => { if (e.target === overlay && mousedownSurOverlay) close(); });
    document.getElementById('resiliation-cancel-btn').addEventListener('click', close);

    document.getElementById('resiliation-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const resilies = this._getResilies();
      resilies.push({
        id: abo.id, client: abo.client, entreprise: abo.entreprise, formule: abo.formule,
        dateDebut: abo.dateDebut, dateResiliation: fd.get('dateResiliation'), raison: fd.get('raison').trim(),
      });
      this._setResilies(resilies);
      this._data = this._data.filter(x => x.id !== abo.id);
      // TODO Firebase : window.db.collection('abonnements').doc(abo.id).delete() + ajout dans 'abonnements_resilies'
      close();
      this.render(this._root);
    });
  },

  _ouvrirResilies() {
    const resilies = this._getResilies();
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="modal-overlay" id="resilies-modal-overlay">
        <div class="modal-box" style="max-width:560px;">
          <div class="modal-title">Abonnements résiliés (${resilies.length})</div>
          <div style="max-height:60vh; overflow-y:auto; display:flex; flex-direction:column; gap:8px; margin:14px 0;">
            ${resilies.length ? resilies.slice().sort((a, b) => (b.dateResiliation || '').localeCompare(a.dateResiliation || '')).map(r => `
              <div style="background:var(--bg-input); border:1px solid var(--border-subtle); border-radius:9px; padding:10px 12px;">
                <div style="display:flex; justify-content:space-between; align-items:baseline; gap:10px;">
                  <div style="font-weight:600; font-size:13.5px;">${r.client}${r.entreprise ? ` — ${r.entreprise}` : ''}</div>
                  <button class="row-delete-btn" data-suppr-resilie="${r.id}" title="Supprimer définitivement">✕</button>
                </div>
                <div style="color:var(--text-muted); font-size:12px; margin-top:2px;">${r.formule} · résilié le ${r.dateResiliation ? r.dateResiliation.split('-').reverse().join('/') : '—'}</div>
                ${r.raison ? `<div style="font-size:12.5px; color:var(--text-secondary); margin-top:6px;">${r.raison}</div>` : ''}
              </div>
            `).join('') : '<div style="color:var(--text-muted); font-size:13px; padding:8px 2px;">Aucun abonnement résilié pour l\'instant.</div>'}
          </div>
          <div class="modal-actions">
            <span></span>
            <div class="modal-actions-right">
              <button type="button" class="btn btn-ghost" id="resilies-fermer-btn">Fermer</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(wrap.firstElementChild);
    const overlay = document.getElementById('resilies-modal-overlay');
    const close = () => overlay.remove();
    let mousedownSurOverlay = false;
    overlay.addEventListener('mousedown', (e) => { mousedownSurOverlay = (e.target === overlay); });
    overlay.addEventListener('click', (e) => { if (e.target === overlay && mousedownSurOverlay) close(); });
    document.getElementById('resilies-fermer-btn').addEventListener('click', close);

    overlay.querySelectorAll('[data-suppr-resilie]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.supprResilie);
        window.confirmerAction('Supprimer définitivement cette trace de résiliation ?', () => {
          this._setResilies(this._getResilies().filter(r => r.id !== id));
          close();
          this._ouvrirResilies();
        });
      });
    });
  },

  _openForm(abo) {
    const wrap = document.createElement('div');
    wrap.innerHTML = this._formHtml(abo);
    document.body.appendChild(wrap.firstElementChild);
    const overlay = document.getElementById('abo-modal-overlay');
    const close = () => overlay.remove();

    let mousedownSurOverlay = false;
    overlay.addEventListener('mousedown', (e) => { mousedownSurOverlay = (e.target === overlay); });
    overlay.addEventListener('click', (e) => { if (e.target === overlay && mousedownSurOverlay) close(); });
    document.getElementById('abo-cancel-btn').addEventListener('click', close);

    const clientSelect = document.getElementById('abo-client-existant-select');
    if (clientSelect) {
      clientSelect.addEventListener('change', () => {
        const id = clientSelect.value ? Number(clientSelect.value) : null;
        document.getElementById('abo-clientid-input').value = id || '';
        if (!id) return;
        const clientsModule = window.Modules.clients;
        const c = clientsModule && clientsModule._data ? clientsModule._data.find(x => x.id === id) : null;
        if (!c) return;
        document.getElementById('abo-client-input').value = c.nom;
        document.getElementById('abo-entreprise-input').value = c.entreprise || '';
      });
    }
    const voirClientLien = document.getElementById('abo-voir-client-lien');
    if (voirClientLien) {
      voirClientLien.addEventListener('click', (e) => {
        e.preventDefault();
        const id = Number(document.getElementById('abo-clientid-input').value);
        if (id) { close(); window.ouvrirFiche('clients', id); }
      });
    }

    const deleteBtn = document.getElementById('abo-delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        close();
        this._ouvrirResiliation(abo);
      });
    }

    document.getElementById('abo-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = {
        client: fd.get('client').trim(),
        entreprise: fd.get('entreprise').trim(),
        clientId: fd.get('clientId') ? Number(fd.get('clientId')) : null,
        formule: fd.get('formule'),
        dateDebut: fd.get('dateDebut'),
      };
      if (!payload.client) return;

      if (abo) {
        Object.assign(abo, payload);
        // TODO Firebase : window.db.collection('abonnements').doc(abo.id).update(payload)
      } else {
        this._data.push({ id: Date.now(), ...payload });
        // TODO Firebase : window.db.collection('abonnements').add(payload)
      }
      close();
      this.render(this._root);
    });
  },

  _bindTableau(zone) {
    // Sélecteur générique (07/09/2026) — reconnaît aussi bien la ligne de
    // tableau (desktop) que la carte mobile (.abo-mcard).
    zone.querySelectorAll('[data-open]').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('[data-delete]') || e.target.closest('[data-facturer-mois]') || e.target.closest('[data-voir-client]')) return;
        const id = Number(row.dataset.open);
        const a = this._data.find(x => x.id === id);
        if (a) this._openForm(a);
      });
    });

    zone.querySelectorAll('[data-voir-client]').forEach(lien => {
      lien.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = Number(lien.dataset.voirClient);
        if (id) window.ouvrirFiche('clients', id);
      });
    });

    zone.querySelectorAll('[data-delete]').forEach(delBtn => {
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number(delBtn.dataset.delete);
        const a = this._data.find(x => x.id === id);
        if (a) this._ouvrirResiliation(a);
      });
    });

    zone.querySelectorAll('[data-facturer-mois]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number(btn.dataset.facturerMois);
        const a = this._data.find(x => x.id === id);
        if (a) this._facturerMois(a, btn.dataset.mois);
      });
    });
  },

  _bindEvents(container) {
    const addBtn = container.querySelector('#add-abo-btn');
    if (addBtn) addBtn.addEventListener('click', () => this._openForm(null));

    const resiliesBtn = container.querySelector('#voir-resilies-btn');
    if (resiliesBtn) resiliesBtn.addEventListener('click', () => this._ouvrirResilies());

    this._bindTableau(container);
  },
};

/* ═══════════════════════════════════════════════════════════
   MODULE TICKETS — support/demandes clients, CRUD complet via
   formulaire modal (même pattern que les autres modules).
   TODO Firebase pour la persistance.
═══════════════════════════════════════════════════════════ */

window.Modules = window.Modules || {};

window.Modules.tickets = {
  _data: null,
  _statuts: ['Ouvert', 'En cours', 'Résolu'],
  _priorites: ['Basse', 'Normale', 'Haute'],
  _recherche: '',

  _ticketsFiltres(tickets) {
    const q = (this._recherche || '').trim().toLowerCase();
    if (!q) return tickets;
    return tickets.filter(t => (t.client || '').toLowerCase().includes(q) || (t.entreprise || '').toLowerCase().includes(q) || (t.sujet || '').toLowerCase().includes(q));
  },

  async render(container) {
    if (!this._data) {
      this._data = window.FIREBASE_READY ? await this._fetchReal() : this._mock();
    }
    this._root = container.closest('#content') || container;
    container.innerHTML = this._html(this._data);
    window.hydrateIcons(container);
    this._bindEvents(container);
    if (window.majBadgesNav) window.majBadgesNav();
  },

  _mock() {
    // Données de démo vidées le 04/09/2026 (voir clients.js).
    return [];
  },

  async _fetchReal() {
    // TODO Firebase : const snap = await window.db.collection('tickets').get();
    return this._mock();
  },

  _statutBadge(statut) {
    const map = { 'Ouvert':'badge-blue', 'En cours':'badge-orange', 'Résolu':'badge-green' };
    return `<span class="badge ${map[statut] || 'badge-blue'}">${statut}</span>`;
  },

  _prioriteBadge(p) {
    const map = { 'Basse':'badge-blue', 'Normale':'badge-orange', 'Haute':'badge-red' };
    return `<span class="badge ${map[p] || 'badge-blue'}">${p}</span>`;
  },

  // Nom client cliquable si `clientId` existe (05/09/2026, même logique que
  // les autres modules).
  _nomClientAffiche(t) {
    if (t.clientId) {
      const clientsModule = window.Modules && window.Modules.clients;
      const c = clientsModule && clientsModule._data ? clientsModule._data.find(x => x.id === t.clientId) : null;
      if (c) return `<a href="#" data-voir-client="${c.id}" style="color:var(--text-primary); text-decoration:underline; text-decoration-color:rgba(255,255,255,.25);">${c.nom}</a>${c.entreprise ? ` <span style="color:#6a6a6a;">— ${c.entreprise}</span>` : ''}`;
    }
    return `${t.client}${t.entreprise ? ` <span style="color:#6a6a6a;">— ${t.entreprise}</span>` : ''}`;
  },

  _html(tickets) {
    // Historique (06/09/2026, retour de Tiphaine) — les tickets Résolu
    // ne restent plus mélangés dans le fil principal : ils sortent de
    // la liste (comme "Prospects froids") et sont consultables à part
    // via le bouton "Historique". `actifs` = tout ce qui n'est pas
    // encore résolu, seul ce sous-ensemble alimente le tableau/les
    // cartes ET la recherche.
    const actifs = tickets.filter(t => t.statut !== 'Résolu');
    const resolus = tickets.filter(t => t.statut === 'Résolu');
    return `
      <div class="page-header-row">
        <div>
          <div class="page-title"><span class="nav-icon" data-icon="ticket"></span>Tickets</div>
          <div class="page-sub">${actifs.length} ticket${actifs.length > 1 ? 's' : ''} en cours</div>
        </div>
        <div class="page-header-actions">
          <button class="btn-ghost" id="voir-historique-btn" style="white-space:nowrap;">Historique (${resolus.length})</button>
          <button class="btn" id="add-ticket-btn" style="white-space:nowrap;">+ Nouveau ticket</button>
        </div>
      </div>
      <div id="tickets-tableau-zone">${this._htmlTableau(this._ticketsFiltres(actifs))}</div>
    `;
  },

  _htmlTableau(tickets) {
    return `
      <div class="card tickets-table-wrap" style="padding:0; overflow-x:auto;">
        <table>
          <thead><tr>
            <th>Client</th><th>Sujet</th><th>Priorité</th><th>Statut</th><th>Date</th><th></th><th></th>
          </tr></thead>
          <tbody>
            ${tickets.length ? tickets.map(t => `
              <tr data-open="${t.id}" style="cursor:pointer;">
                <td>${this._nomClientAffiche(t)}</td>
                <td>${t.sujet}</td>
                <td>${this._prioriteBadge(t.priorite)}</td>
                <td>${this._statutBadge(t.statut)}</td>
                <td>${t.date}</td>
                <td><button class="btn-ghost" style="padding:5px 10px; font-size:11.5px; border-radius:7px; color:#6ec88c;" data-resoudre="${t.id}" title="Marquer comme résolu">✓ Résolu</button></td>
                <td style="width:36px;"><button class="row-delete-btn" data-delete="${t.id}" title="Supprimer">✕</button></td>
              </tr>
            `).join('') : `<tr><td colspan="7" style="color:var(--text-muted); text-align:center; padding:24px;">Aucun ticket ${this._recherche ? 'ne correspond à cette recherche' : 'pour le moment'}.</td></tr>`}
          </tbody>
        </table>
      </div>

      <!-- Version mobile (06/09/2026, même pattern que Devis/Factures/
           Clients) — liste de cartes au lieu du tableau à 6 colonnes. -->
      <div class="tickets-mobile-list">
        ${tickets.length ? tickets.map(t => this._htmlCarteMobile(t)).join('') : `<div class="card" style="color:var(--text-muted); text-align:center; padding:24px;">Aucun ticket ${this._recherche ? 'ne correspond à cette recherche' : 'pour le moment'}.</div>`}
      </div>
    `;
  },

  // Carte mobile d'un ticket (06/09/2026). Bouton "✓ Résolu" (même jour,
  // retour de Tiphaine) — un tap direct sur la carte plutôt que d'ouvrir
  // le formulaire complet juste pour changer le statut.
  _htmlCarteMobile(t) {
    return `
      <div class="ticket-mcard" data-open="${t.id}">
        <button class="row-delete-btn ticket-mcard-delete" data-delete="${t.id}" title="Supprimer">✕</button>
        <div class="ticket-mcard-sujet">${t.sujet}</div>
        <div class="ticket-mcard-client">${this._nomClientAffiche(t)}</div>
        <div class="ticket-mcard-bottom">
          ${this._prioriteBadge(t.priorite)}
          ${this._statutBadge(t.statut)}
          <span class="ticket-mcard-date">${t.date}</span>
        </div>
        <button class="btn-ghost ticket-mcard-resoudre" data-resoudre="${t.id}">✓ Marquer résolu</button>
      </div>
    `;
  },

  // Historique (06/09/2026) — tickets Résolu, sortis de la liste
  // principale. Même pattern que prospects.js `_ouvrirFroids()` :
  // modal listant les entrées, "Rouvrir" repasse en Ouvert et remet
  // dans le fil actif, "Supprimer" efface pour de bon.
  _ouvrirHistorique() {
    const resolus = this._data.filter(t => t.statut === 'Résolu');
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="modal-overlay" id="historique-tickets-overlay">
        <div class="modal-box" style="max-width:520px;">
          <div class="modal-title">Historique (${resolus.length})</div>
          <div style="max-height:60vh; overflow-y:auto; display:flex; flex-direction:column; gap:8px; margin:14px 0;">
            ${resolus.length ? resolus.sort((a, b) => b.id - a.id).map(t => `
              <div data-open-resolu="${t.id}" style="display:flex; align-items:center; justify-content:space-between; gap:10px; background:var(--bg-input); border:1px solid var(--border-subtle); border-radius:9px; padding:10px 12px; cursor:pointer;">
                <div>
                  <div style="font-weight:600; font-size:13.5px;">${t.sujet}</div>
                  <div style="color:var(--text-muted); font-size:12px;">${t.client}${t.entreprise ? ` — ${t.entreprise}` : ''} · ${t.date}</div>
                </div>
                <div style="display:flex; gap:6px; flex-shrink:0;">
                  <button class="btn-ghost" style="font-size:11px; padding:5px 9px; border-radius:6px;" data-rouvrir="${t.id}">Rouvrir</button>
                  <button class="btn-ghost" style="font-size:11px; padding:5px 9px; border-radius:6px;" data-supprimer-resolu="${t.id}">Supprimer</button>
                </div>
              </div>
            `).join('') : '<div style="color:var(--text-muted); font-size:13px; padding:8px 2px;">Aucun ticket résolu pour l\'instant.</div>'}
          </div>
          <div class="modal-actions">
            <span></span>
            <div class="modal-actions-right">
              <button type="button" class="btn btn-ghost" id="historique-tickets-fermer-btn">Fermer</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(wrap.firstElementChild);
    const overlay = document.getElementById('historique-tickets-overlay');
    const close = () => overlay.remove();
    let mousedownSurOverlay = false;
    overlay.addEventListener('mousedown', (e) => { mousedownSurOverlay = (e.target === overlay); });
    overlay.addEventListener('click', (e) => { if (e.target === overlay && mousedownSurOverlay) close(); });
    document.getElementById('historique-tickets-fermer-btn').addEventListener('click', close);

    overlay.querySelectorAll('[data-rouvrir]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number(btn.dataset.rouvrir);
        const t = this._data.find(x => x.id === id);
        if (t) t.statut = 'Ouvert';
        // TODO Firebase : window.db.collection('tickets').doc(id).update({ statut:'Ouvert' })
        close();
        this.render(this._root);
      });
    });
    overlay.querySelectorAll('[data-supprimer-resolu]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number(btn.dataset.supprimerResolu);
        window.confirmerAction('Supprimer définitivement ce ticket ?', () => {
          this._data = this._data.filter(x => x.id !== id);
          close();
          this.render(this._root);
        });
      });
    });
    overlay.querySelectorAll('[data-open-resolu]').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('[data-rouvrir]') || e.target.closest('[data-supprimer-resolu]')) return;
        const id = Number(row.dataset.openResolu);
        const t = this._data.find(x => x.id === id);
        if (t) { close(); this._openForm(t); }
      });
    });
  },

  _formHtml(t) {
    const isEdit = !!t;
    t = t || { client:'', entreprise:'', clientId:null, sujet:'', statut:'Ouvert', priorite:'Normale', date:new Date().toISOString().slice(0,10) };
    const clientsModule = window.Modules.clients;
    const clientsExistants = (clientsModule && clientsModule._data) ? clientsModule._data : [];
    return `
      <div class="modal-overlay" id="ticket-modal-overlay">
        <div class="modal-box">
          <div class="modal-title">${isEdit ? 'Modifier le ticket' : 'Nouveau ticket'}</div>
          <form id="ticket-form">
            ${clientsExistants.length ? `
            <div class="modal-field">
              <label>Reprendre un client existant (pré-remplit ses infos, tout reste modifiable)</label>
              <select id="ticket-client-existant-select">
                <option value="">— Nouveau client / saisie libre —</option>
                ${clientsExistants.map(c => `<option value="${c.id}" ${t.clientId === c.id ? 'selected' : ''}>${c.nom}${c.entreprise ? ' — ' + c.entreprise : ''}</option>`).join('')}
              </select>
            </div>` : ''}
            <input type="hidden" name="clientId" id="ticket-clientid-input" value="${t.clientId || ''}">
            <div class="modal-field">
              <label>Client${t.clientId ? ' — <a href="#" id="ticket-voir-client-lien" style="color:var(--text-secondary); font-weight:400;">voir la fiche client →</a>' : ''}</label>
              <input type="text" name="client" id="ticket-client-input" value="${t.client}" required autofocus>
            </div>
            <div class="modal-field">
              <label>Entreprise</label>
              <input type="text" name="entreprise" id="ticket-entreprise-input" value="${t.entreprise || ''}">
            </div>
            <div class="modal-field">
              <label>Sujet</label>
              <input type="text" name="sujet" value="${t.sujet}" required>
            </div>
            <div class="modal-field">
              <label>Priorité</label>
              <select name="priorite">
                ${this._priorites.map(p => `<option value="${p}" ${p === t.priorite ? 'selected' : ''}>${p}</option>`).join('')}
              </select>
            </div>
            <div class="modal-field">
              <label>Statut</label>
              <select name="statut">
                ${this._statuts.map(s => `<option value="${s}" ${s === t.statut ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
            </div>
            <div class="modal-field">
              <label>Date</label>
              <input type="date" name="date" value="${t.date}">
            </div>
            <div class="modal-actions">
              ${isEdit ? `<button type="button" class="btn btn-danger" id="ticket-delete-btn">Supprimer</button>` : `<span></span>`}
              <div class="modal-actions-right">
                <button type="button" class="btn btn-ghost" id="ticket-cancel-btn">Annuler</button>
                <button type="submit" class="btn">${isEdit ? 'Enregistrer' : 'Ajouter'}</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  _openForm(ticket) {
    const wrap = document.createElement('div');
    wrap.innerHTML = this._formHtml(ticket);
    document.body.appendChild(wrap.firstElementChild);
    const overlay = document.getElementById('ticket-modal-overlay');
    const close = () => overlay.remove();

    let mousedownSurOverlay = false;
    overlay.addEventListener('mousedown', (e) => { mousedownSurOverlay = (e.target === overlay); });
    overlay.addEventListener('click', (e) => { if (e.target === overlay && mousedownSurOverlay) close(); });
    document.getElementById('ticket-cancel-btn').addEventListener('click', close);

    const clientSelect = document.getElementById('ticket-client-existant-select');
    if (clientSelect) {
      clientSelect.addEventListener('change', () => {
        const id = clientSelect.value ? Number(clientSelect.value) : null;
        document.getElementById('ticket-clientid-input').value = id || '';
        if (!id) return;
        const clientsModule = window.Modules.clients;
        const c = clientsModule && clientsModule._data ? clientsModule._data.find(x => x.id === id) : null;
        if (!c) return;
        document.getElementById('ticket-client-input').value = c.nom;
        document.getElementById('ticket-entreprise-input').value = c.entreprise || '';
      });
    }
    const voirClientLien = document.getElementById('ticket-voir-client-lien');
    if (voirClientLien) {
      voirClientLien.addEventListener('click', (e) => {
        e.preventDefault();
        const id = Number(document.getElementById('ticket-clientid-input').value);
        if (id) { close(); window.ouvrirFiche('clients', id); }
      });
    }

    const deleteBtn = document.getElementById('ticket-delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        window.confirmerAction('Supprimer ce ticket ?', () => {
          this._data = this._data.filter(x => x.id !== ticket.id);
          // TODO Firebase : window.db.collection('tickets').doc(ticket.id).delete()
          close();
          this.render(this._root);
        });
      });
    }

    document.getElementById('ticket-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = {
        client: fd.get('client').trim(),
        entreprise: fd.get('entreprise').trim(),
        clientId: fd.get('clientId') ? Number(fd.get('clientId')) : null,
        sujet: fd.get('sujet').trim(),
        priorite: fd.get('priorite'),
        statut: fd.get('statut'),
        date: fd.get('date'),
      };
      if (!payload.client || !payload.sujet) return;

      if (ticket) {
        Object.assign(ticket, payload);
        // TODO Firebase : window.db.collection('tickets').doc(ticket.id).update(payload)
      } else {
        this._data.push({ id: Date.now(), ...payload });
        // TODO Firebase : window.db.collection('tickets').add(payload)
      }
      close();
      this.render(this._root);
    });
  },

  _bindTableau(zone) {
    // Sélecteur générique (06/09/2026) — reconnaît aussi bien la ligne
    // de tableau (desktop) que la carte mobile (.ticket-mcard).
    zone.querySelectorAll('[data-open]').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('[data-delete]') || e.target.closest('[data-voir-client]')) return;
        const id = Number(row.dataset.open);
        const t = this._data.find(x => x.id === id);
        if (t) this._openForm(t);
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
        window.confirmerAction('Supprimer ce ticket ?', () => {
          this._data = this._data.filter(x => x.id !== id);
          this.render(this._root);
        });
      });
    });

    // "✓ Résolu" (06/09/2026) — passe le ticket en Résolu sans ouvrir le
    // formulaire complet ; il sort alors du fil actif et rejoint l'Historique.
    zone.querySelectorAll('[data-resoudre]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number(btn.dataset.resoudre);
        const t = this._data.find(x => x.id === id);
        if (t) t.statut = 'Résolu';
        // TODO Firebase : window.db.collection('tickets').doc(id).update({ statut:'Résolu' })
        this.render(this._root);
      });
    });
  },

  _bindEvents(container) {
    const addBtn = container.querySelector('#add-ticket-btn');
    if (addBtn) addBtn.addEventListener('click', () => this._openForm(null));

    const historiqueBtn = container.querySelector('#voir-historique-btn');
    if (historiqueBtn) historiqueBtn.addEventListener('click', () => this._ouvrirHistorique());

    this._bindTableau(container);
  },
};

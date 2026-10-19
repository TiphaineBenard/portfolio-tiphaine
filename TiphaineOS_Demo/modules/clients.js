/* ═══════════════════════════════════════════════════════════
   MODULE CLIENTS — liste + formulaire modal (ajout / édition /
   suppression). Mock tant que Firebase n'est pas branché ; TODO
   Firebase indique où connecter Firestore.
═══════════════════════════════════════════════════════════ */

window.Modules = window.Modules || {};

window.Modules.clients = {
  _data: null,
  _abonnements: ['—', 'Essentiel', 'Sérénité', 'Performance'],
  _recherche: '',

  // 04/09/2026 : recherche ajoutée (retour de la revue complète de
  // l'app — pattern déjà utilisé sur Prospects/Documents, manquait ici)
  // + régénération isolée de la zone tableau pour ne jamais faire
  // perdre le focus du champ de recherche à chaque frappe.
  _clientsFiltres(clients) {
    const q = (this._recherche || '').trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(c => (c.nom || '').toLowerCase().includes(q) || (c.entreprise || '').toLowerCase().includes(q));
  },

  // Statuts entièrement paramétrables depuis l'onglet Paramétrage
  // (03/09/2026) — avant, liste figée en dur ici. `_statutBadge` garde un
  // fallback (badge bleu) pour tout statut custom hors des 4 historiques.
  _getStatuts() {
    try {
      const stockes = JSON.parse(localStorage.getItem('tos_statuts_clients') || 'null');
      if (Array.isArray(stockes) && stockes.length) return stockes;
    } catch (e) { /* ignore */ }
    return ['Prospect', 'Actif', 'Impayé', 'Ancien'];
  },
  _setStatuts(statuts) {
    localStorage.setItem('tos_statuts_clients', JSON.stringify(statuts));
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
    // Données de démo (Bryan Loeuilleux / M. Dupont / M. Martin) vidées le
    // 04/09/2026 à la demande de Tiphaine — elles faussaient tous les
    // chiffres réels affichés ailleurs (Finances, Dashboard...). Module
    // démarre vide, Tiphaine ajoute ses vrais clients au fur et à mesure.
    return [];
  },

  async _fetchReal() {
    // TODO Firebase : const snap = await window.db.collection('clients').get();
    // return snap.docs.map(d => ({ id:d.id, ...d.data() }));
    return this._mock();
  },

  _html(clients) {
    return `
      <div class="page-header-row">
        <div>
          <div class="page-title"><span class="nav-icon" data-icon="users"></span>Clients</div>
          <div class="page-sub">${clients.length} client${clients.length > 1 ? 's' : ''}</div>
        </div>
        <div class="page-header-actions">
          <button class="btn" id="add-client-btn">+ Nouveau client</button>
        </div>
      </div>
      <div id="clients-tableau-zone">${this._htmlTableau(this._clientsFiltres(clients))}</div>
    `;
  },

  _htmlTableau(clients) {
    return `
      <div class="card clients-table-wrap" style="padding:0; overflow-x:auto;">
        <table>
          <thead><tr>
            <th>Nom</th><th>Entreprise</th><th>Statut</th><th>Projet</th><th>Abonnement</th><th>MRR</th><th></th>
          </tr></thead>
          <tbody>
            ${clients.length ? clients.map(c => `
              <tr data-open="${c.id}" style="cursor:pointer;">
                <td>${c.nom}</td>
                <td>${c.entreprise || '—'}</td>
                <td>${this._statutBadge(c.statut)}</td>
                <td>${c.projet || '—'}</td>
                <td>${c.abonnement || '—'}</td>
                <td>${c.mrr ? c.mrr + ' €/mois' : '—'}</td>
                <td style="width:36px;"><button class="row-delete-btn" data-delete="${c.id}" title="Supprimer">✕</button></td>
              </tr>
            `).join('') : `<tr><td colspan="7" style="color:var(--text-muted); text-align:center; padding:24px;">Aucun client ${this._recherche ? 'ne correspond à cette recherche' : 'pour le moment'}.</td></tr>`}
          </tbody>
        </table>
      </div>

      <!-- Version mobile (06/09/2026, même pattern que Devis/Factures) —
           liste de cartes au lieu du tableau à 7 colonnes. Mêmes data-*
           que le tableau : _bindTableau les reconnaît sans rien ajouter
           côté JS (sélecteur data-open déjà élargi). -->
      <div class="clients-mobile-list">
        ${clients.length ? clients.map(c => this._htmlCarteMobile(c)).join('') : `<div class="card" style="color:var(--text-muted); text-align:center; padding:24px;">Aucun client ${this._recherche ? 'ne correspond à cette recherche' : 'pour le moment'}.</div>`}
      </div>
    `;
  },

  // Carte mobile d'un client (06/09/2026) — mêmes infos que la ligne
  // de tableau, réorganisées verticalement.
  _htmlCarteMobile(c) {
    return `
      <div class="client-mcard" data-open="${c.id}">
        <button class="card-delete-btn" data-delete="${c.id}" title="Supprimer">✕</button>
        <div class="client-mcard-top">
          <div class="client-mcard-nom">${c.nom}</div>
          ${this._statutBadge(c.statut)}
        </div>
        ${c.entreprise ? `<div class="client-mcard-entreprise">${c.entreprise}</div>` : ''}
        <div class="devis-mcard-section">
          <span class="devis-mcard-label">Projet</span><span style="font-size:12.5px;">${c.projet || '—'}</span>
        </div>
        <div class="devis-mcard-section">
          <span class="devis-mcard-label">Abonnement</span><span style="font-size:12.5px;">${c.abonnement || '—'}</span>
        </div>
        <div class="devis-mcard-section">
          <span class="devis-mcard-label">MRR</span><span style="font-size:12.5px; font-weight:600;">${c.mrr ? c.mrr + ' €/mois' : '—'}</span>
        </div>
      </div>
    `;
  },

  _statutBadge(statut) {
    const map = { 'Actif':'badge-green', 'Prospect':'badge-blue', 'Impayé':'badge-red', 'Ancien':'badge-orange' };
    return `<span class="badge ${map[statut] || 'badge-blue'}">${statut}</span>`;
  },

  // Historique inter-modules (05/09/2026) — tout ce qui référence ce client
  // via `clientId` (devis, projets, factures, abonnements, tickets) + le
  // prospect d'origine s'il a été converti (voir prospects.js
  // `_convertirEnClient`, qui pose `c.prospectId`). Chaque ligne ouvre
  // directement la fiche correspondante via `window.ouvrirFiche`, pour ne
  // plus jamais avoir à chercher "où est ce client référencé ?" à la main
  // (le symptôme concret remonté par Tiphaine : "je ne retrouve pas les
  // clients dans prospects").
  _historique(c) {
    const sections = [];
    const prospectsModule = window.Modules.prospects;
    if (c.prospectId && prospectsModule && prospectsModule._data) {
      const p = prospectsModule._data.find(x => x.id === c.prospectId);
      if (p) sections.push({ titre: 'Prospect d\'origine', route: 'prospects', items: [{ id: p.id, label: `${p.entreprise || p.contact} — ${p.col}` }] });
    }
    const devisModule = window.Modules.devis;
    if (devisModule && devisModule._data) {
      const items = devisModule._data.filter(d => d.clientId === c.id).map(d => ({ id: d.id, label: `${devisModule._formaterNumero ? devisModule._formaterNumero(d) : d.id} — ${d.offre} — ${(d.montant || 0).toLocaleString('fr-FR')} € (${d.statut})` }));
      if (items.length) sections.push({ titre: 'Devis', route: 'devis', items });
    }
    const projetsModule = window.Modules.projets;
    if (projetsModule && projetsModule._data) {
      const items = projetsModule._data.filter(p => p.clientId === c.id).map(p => ({ id: p.id, label: `${p.nom} — ${(p.montant || 0).toLocaleString('fr-FR')} € (${p.statut})` }));
      if (items.length) sections.push({ titre: 'Projets', route: 'projets', items });
    }
    const facturesModule = window.Modules.factures;
    if (facturesModule && facturesModule._data) {
      const items = facturesModule._data.filter(f => f.clientId === c.id).map(f => ({ id: f.id, label: `${facturesModule._formaterNumero ? facturesModule._formaterNumero(f) : f.id} — ${f.type} — ${(f.montant || 0).toLocaleString('fr-FR')} € (${f.statut})` }));
      if (items.length) sections.push({ titre: 'Factures', route: 'factures', items });
    }
    const abosModule = window.Modules.abonnements;
    if (abosModule && abosModule._data) {
      const grille = abosModule._getGrille ? abosModule._getGrille() : {};
      const items = abosModule._data.filter(a => a.clientId === c.id).map(a => ({ id: a.id, label: `${a.formule} — ${(grille[a.formule] || {}).mrr || 0} €/mois` }));
      if (items.length) sections.push({ titre: 'Abonnements', route: 'abonnements', items });
    }
    const ticketsModule = window.Modules.tickets;
    if (ticketsModule && ticketsModule._data) {
      const items = ticketsModule._data.filter(t => t.clientId === c.id).map(t => ({ id: t.id, label: `${t.sujet} (${t.statut})` }));
      if (items.length) sections.push({ titre: 'Tickets', route: 'tickets', items });
    }
    return sections;
  },

  _historiqueHtml(c) {
    const sections = this._historique(c);
    if (!sections.length) return '';
    return `
      <div class="modal-field">
        <label>Historique</label>
        <div style="display:flex; flex-direction:column; gap:10px;">
          ${sections.map(s => `
            <div>
              <div style="font-size:11.5px; color:var(--text-secondary); font-weight:600; margin-bottom:4px;">${s.titre}</div>
              <div style="display:flex; flex-direction:column; gap:3px;">
                ${s.items.map(it => `<a href="#" data-voir-historique="${s.route}" data-id="${it.id}" style="color:var(--text-primary); text-decoration:underline; font-size:13px;">${it.label}</a>`).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  _formHtml(c) {
    const isEdit = !!c;
    c = c || { nom:'', entreprise:'', siret:'', adresse:'', email:'', telephone:'', statut:'Prospect', projet:'', abonnement:'—', mrr:0 };
    return `
      <div class="modal-overlay" id="client-modal-overlay">
        <div class="modal-box">
          <div class="modal-title">${isEdit ? 'Modifier le client' : 'Nouveau client'}</div>
          <form id="client-form">
            <div class="modal-field">
              <label>Nom</label>
              <input type="text" name="nom" value="${c.nom}" required autofocus>
            </div>
            <div class="modal-field">
              <label>Entreprise</label>
              <input type="text" name="entreprise" value="${c.entreprise || ''}">
            </div>
            <div class="modal-field">
              <label>SIRET (entreprise cliente)</label>
              <input type="text" name="siret" value="${c.siret || ''}" placeholder="ex : 123 456 789 00012">
            </div>
            <div class="modal-field">
              <label>Adresse (entreprise cliente)</label>
              <input type="text" name="adresse" value="${c.adresse || ''}" placeholder="N° et rue, code postal, ville">
            </div>
            <div class="modal-field">
              <label>Email</label>
              <input type="email" name="email" value="${c.email || ''}">
            </div>
            <div class="modal-field">
              <label>Téléphone</label>
              <input type="tel" name="telephone" value="${c.telephone || ''}">
            </div>
            <div class="modal-field">
              <label>Statut</label>
              <select name="statut">
                ${this._getStatuts().map(s => `<option value="${s}" ${s === c.statut ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
            </div>
            <div class="modal-field">
              <label>Projet</label>
              <input type="text" name="projet" value="${c.projet || ''}">
            </div>
            <div class="modal-field">
              <label>Abonnement</label>
              <select name="abonnement">
                ${this._abonnements.map(a => `<option value="${a}" ${a === c.abonnement ? 'selected' : ''}>${a}</option>`).join('')}
              </select>
            </div>
            <div class="modal-field">
              <label>MRR (€/mois)</label>
              <input type="number" name="mrr" value="${c.mrr || 0}" min="0" step="1">
            </div>
            ${isEdit ? this._historiqueHtml(c) : ''}
            <div class="modal-actions">
              ${isEdit ? `<button type="button" class="btn btn-danger" id="client-delete-btn">Supprimer</button>` : `<span></span>`}
              <div class="modal-actions-right">
                <button type="button" class="btn btn-ghost" id="client-cancel-btn">Annuler</button>
                <button type="submit" class="btn">${isEdit ? 'Enregistrer' : 'Ajouter'}</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  // Charge (si besoin) les données des autres modules pour l'Historique —
  // même précaution que factures.js avec le module Clients : un module peut
  // ne jamais avoir été rendu cette session, donc `_data` est encore `null`.
  async _precharger(mod) {
    if (!mod || mod._data) return;
    mod._data = window.FIREBASE_READY && mod._fetchReal ? await mod._fetchReal() : (mod._mock ? mod._mock() : []);
  },

  async _openForm(client) {
    if (client) {
      await Promise.all([
        this._precharger(window.Modules.prospects),
        this._precharger(window.Modules.devis),
        this._precharger(window.Modules.projets),
        this._precharger(window.Modules.factures),
        this._precharger(window.Modules.abonnements),
        this._precharger(window.Modules.tickets),
      ]);
    }
    const wrap = document.createElement('div');
    wrap.innerHTML = this._formHtml(client);
    document.body.appendChild(wrap.firstElementChild);
    const overlay = document.getElementById('client-modal-overlay');
    const close = () => overlay.remove();

    // Ferme seulement si le clic ET le mousedown initial étaient bien sur le
    // fond (overlay) — sinon une sélection de texte qui démarre dans un
    // champ et se termine (drag) hors de la modal-box fermait la modal par
    // erreur (bug remonté le 03/09/2026).
    let mousedownSurOverlay = false;
    overlay.addEventListener('mousedown', (e) => { mousedownSurOverlay = (e.target === overlay); });
    overlay.addEventListener('click', (e) => { if (e.target === overlay && mousedownSurOverlay) close(); });
    document.getElementById('client-cancel-btn').addEventListener('click', close);

    document.querySelectorAll('[data-voir-historique]').forEach(lien => {
      lien.addEventListener('click', (e) => {
        e.preventDefault();
        const route = lien.dataset.voirHistorique;
        const id = Number(lien.dataset.id);
        close();
        window.ouvrirFiche(route, id);
      });
    });

    const deleteBtn = document.getElementById('client-delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        window.confirmerAction('Supprimer ce client ?', () => {
          this._data = this._data.filter(c => c.id !== client.id);
          // TODO Firebase : window.db.collection('clients').doc(client.id).delete()
          close();
          this.render(this._root);
        });
      });
    }

    document.getElementById('client-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = {
        nom: fd.get('nom').trim(),
        entreprise: fd.get('entreprise').trim(),
        siret: fd.get('siret').trim(),
        adresse: fd.get('adresse').trim(),
        email: fd.get('email').trim(),
        telephone: fd.get('telephone').trim(),
        statut: fd.get('statut'),
        projet: fd.get('projet').trim(),
        abonnement: fd.get('abonnement'),
        mrr: parseInt(fd.get('mrr') || '0', 10),
      };
      if (!payload.nom) return;

      if (client) {
        Object.assign(client, payload);
        // TODO Firebase : window.db.collection('clients').doc(client.id).update(payload)
      } else {
        this._data.push({ id: Date.now(), ...payload });
        // TODO Firebase : window.db.collection('clients').add(payload)
      }
      close();
      this.render(this._root);
    });
  },

  _bindTableau(zone) {
    // Sélecteur générique (06/09/2026) — reconnaît aussi bien la ligne
    // de tableau (desktop) que la carte mobile (.client-mcard), même
    // pattern que devis.js/factures.js.
    zone.querySelectorAll('[data-open]').forEach(row => {
      row.addEventListener('click', () => {
        const id = Number(row.dataset.open);
        const client = this._data.find(c => c.id === id);
        if (client) this._openForm(client);
      });
    });

    zone.querySelectorAll('[data-delete]').forEach(delBtn => {
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number(delBtn.dataset.delete);
        window.confirmerAction('Supprimer ce client ?', () => {
          this._data = this._data.filter(c => c.id !== id);
          // TODO Firebase : window.db.collection('clients').doc(id).delete()
          this.render(this._root);
        });
      });
    });
  },

  _bindEvents(container) {
    const btn = container.querySelector('#add-client-btn');
    if (btn) btn.addEventListener('click', () => this._openForm(null));

    this._bindTableau(container);
  },
};

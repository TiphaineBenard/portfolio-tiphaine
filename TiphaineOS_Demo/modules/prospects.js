/* ═══════════════════════════════════════════════════════════
   MODULE PROSPECTS — Kanban simplifié (clic pour avancer une
   carte) + formulaire modal complet (ajout / édition / suppression),
   même pattern que modules/clients.js. TODO Firebase pour la persistance.
═══════════════════════════════════════════════════════════ */

window.Modules = window.Modules || {};

window.Modules.prospects = {
  // "En attente de réponse" ajoutée le 04/09/2026 (retour de Tiphaine) :
  // il manquait une étape entre "je l'ai contacté" et "on a un
  // rendez-vous" pour les prospects relancés qui n'ont pas encore
  // répondu — sans ça ils restaient coincés artificiellement dans
  // "À contacter" (pas encore fait) ou "Rendez-vous" (pas encore vrai).
  // "Nouveau" retirée le 05/09/2026 (retour de Tiphaine) — elle faisait
  // doublon avec "À contacter" : les deux signifient "pas encore
  // contacté", sans différence d'action entre les deux. Un prospect créé
  // démarre directement en "À contacter".
  _cols: ['À contacter', 'En attente de réponse', 'Rendez-vous', 'Devis envoyé', 'Gagné'],
  _data: null,
  _recherche: '',

  // 04/09/2026 : plutôt qu'une colonne "Refusé" qui encombre le board en
  // permanence, un prospect "pas intéressé" est marqué `perdu:true` et
  // sort du Kanban actif — consultable à part via le bouton "Prospects
  // froids" (réactivable ou supprimable définitivement depuis là).

  async render(container) {
    if (!this._data) {
      this._data = window.FIREBASE_READY ? await this._fetchReal() : this._mock();
    }
    // Migration (05/09/2026) : la colonne "Nouveau" a été retirée — tout
    // prospect encore sur cette valeur (créé avant ce changement) est
    // remis sur "À contacter" pour ne pas disparaître silencieusement du
    // Kanban (aucune colonne ne matcherait plus 'Nouveau' sinon).
    this._data.forEach(p => { if (p.col === 'Nouveau') p.col = 'À contacter'; });
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
    // TODO Firebase : const snap = await window.db.collection('prospects').get();
    return this._mock();
  },

  // 04/09/2026 : question de Tiphaine sur la tenue à charge (50-100
  // prospects) — le Kanban n'avait ni recherche dédiée (la recherche
  // globale de la topbar ne filtre que des `<table>`, pas des cartes)
  // ni de limite de hauteur par colonne (une colonne avec 40 cartes
  // aurait fait exploser la hauteur de la page). Ajouté : une barre de
  // recherche (entreprise/contact, filtre en direct) + colonnes à
  // hauteur plafonnée avec leur propre défilement interne
  // (`.kanban-col-cartes`, `style.css`) — le tableau de bord reste
  // lisible même avec beaucoup de cartes dans une même étape.
  _prospectsFiltres(prospects) {
    const q = (this._recherche || '').trim().toLowerCase();
    if (!q) return prospects;
    return prospects.filter(p => (p.entreprise || '').toLowerCase().includes(q) || (p.contact || '').toLowerCase().includes(q));
  },

  _html(prospects) {
    const actifs = prospects.filter(p => !p.perdu);
    const froids = prospects.filter(p => p.perdu);
    const totalValeur = actifs.reduce((s, p) => s + p.valeur, 0);
    const filtres = this._prospectsFiltres(actifs);
    return `
      <div class="page-header-row">
        <div>
          <div class="page-title"><span class="nav-icon" data-icon="briefcase"></span>Prospects</div>
          <div class="page-sub">${actifs.length} prospects actifs — ${totalValeur.toLocaleString('fr-FR')} € de valeur potentielle</div>
        </div>
        <div class="page-header-actions">
          <button class="btn-ghost" id="voir-froids-btn" style="white-space:nowrap;">Prospects froids (${froids.length})</button>
          <button class="btn" id="add-prospect-btn" style="white-space:nowrap;">+ Nouveau prospect</button>
        </div>
      </div>

      <div id="prospects-kanban-zone">${this._htmlKanban(filtres)}</div>
    `;
  },

  // Carte d'un prospect (06/09/2026, extraite pour être partagée entre
  // le Kanban desktop et la liste par sections mobile — mêmes data-*,
  // mêmes actions, un seul endroit à maintenir).
  _htmlCarteProspect(p, col) {
    return `
      <div class="kanban-card" data-open="${p.id}" style="position:relative;">
        <button class="card-delete-btn" data-delete="${p.id}" title="Supprimer">✕</button>
        <div class="kanban-card-title">${p.entreprise}</div>
        <div class="kanban-card-sub">${p.contact} · ${p.valeur.toLocaleString('fr-FR')} €</div>
        ${p.moyenContact ? `<div style="margin-top:3px; font-size:11px; color:var(--text-muted);">${this._iconMoyen(p.moyenContact)} Contacté par ${p.moyenContact.toLowerCase()}</div>` : ''}
        <div style="display:flex; gap:6px; margin-top:8px;">
          ${col !== 'Gagné' ? `<button class="prospect-action-avancer" data-advance="${p.id}">Avancer →</button>` : '<span style="flex:1;"></span>'}
          ${p.convertiEnClient
            ? `<button class="prospect-action-client" data-voir-client="${p.clientIdCree || ''}" title="Voir la fiche client" style="color:#6ec88c;">✓</button>`
            : `<button class="prospect-action-client" data-convertir-client="${p.id}" title="Convertir en client">👤</button>`}
          ${col !== 'Gagné' ? `<button class="prospect-action-froid" data-froid="${p.id}" title="Marquer comme pas intéressé">❄</button>` : ''}
        </div>
      </div>
    `;
  },

  _htmlKanban(prospects) {
    return `
      <div class="kanban kanban-desktop-wrap" style="margin-top:16px;">
        ${this._cols.map(col => `
          <div class="kanban-col">
            <div class="kanban-col-title">${col} (${prospects.filter(p => p.col === col).length})</div>
            <div class="kanban-col-cartes">
              ${prospects.filter(p => p.col === col).sort((a, b) => b.id - a.id).map(p => this._htmlCarteProspect(p, col)).join('') || '<div style="color:#4a4a4a; font-size:12px; padding:6px 2px;">Vide</div>'}
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Version mobile (06/09/2026, à la demande de Tiphaine) —
           3e essai : sections empilées (1er essai) puis onglets (2e
           essai, retour de Tiphaine : pas envie de scroller les onglets
           + le style pilule ne lui plaisait pas). Retour aux sections
           empilées, mais cette fois TOUTES repliées par défaut (le 1er
           essai les avait presque toutes ouvertes, ce qui prenait de la
           hauteur pour rien avec peu de prospects par étape) — on ouvre
           juste l'étape qui nous intéresse. Mêmes cartes/actions que le
           Kanban desktop (voir _htmlCarteProspect). -->
      <div class="prospects-mobile-list">
        ${this._cols.map(col => {
          const cartes = prospects.filter(p => p.col === col).sort((a, b) => b.id - a.id);
          const ouvert = !this._colsRepliees.has(col);
          return `
            <div class="prospects-section">
              <button type="button" class="prospects-section-header" data-toggle-section="${col}">
                <span>${col} (${cartes.length})</span>
                <span class="prospects-section-chevron ${ouvert ? 'ouvert' : ''}">▾</span>
              </button>
              ${ouvert ? `
                <div class="prospects-section-cartes">
                  ${cartes.map(p => this._htmlCarteProspect(p, col)).join('') || '<div style="color:#4a4a4a; font-size:12px; padding:6px 2px;">Vide</div>'}
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  // Sections repliées par défaut (06/09/2026, 3e essai) — TOUTES
  // fermées au chargement, contrairement au 1er essai (seule "Gagné"
  // était fermée) : avec peu de prospects par étape, mieux vaut une
  // page courte par défaut et ouvrir seulement ce qu'on veut voir.
  _colsRepliees: new Set(['À contacter', 'En attente de réponse', 'Rendez-vous', 'Devis envoyé', 'Gagné']),

  _MOYENS_CONTACT: ['Email', 'Téléphone', 'Physique (sur place)'],

  _iconMoyen(m) {
    if (m === 'Email') return '✉';
    if (m === 'Téléphone') return '☎';
    if (m === 'Physique (sur place)') return '📍';
    return '';
  },

  _formHtml(p) {
    const isEdit = !!p;
    p = p || { entreprise:'', contact:'', email:'', telephone:'', moyenContact:'', valeur:0, col:'À contacter' };
    return `
      <div class="modal-overlay" id="prospect-modal-overlay">
        <div class="modal-box">
          <div class="modal-title">${isEdit ? 'Modifier le prospect' : 'Nouveau prospect'}</div>
          <form id="prospect-form">
            <div class="modal-field">
              <label>Entreprise</label>
              <input type="text" name="entreprise" value="${p.entreprise}" required autofocus>
            </div>
            <div class="modal-field">
              <label>Contact</label>
              <input type="text" name="contact" value="${p.contact}">
            </div>
            <div style="display:flex; gap:14px;">
              <div class="modal-field" style="flex:1;">
                <label>Email</label>
                <input type="email" name="email" value="${p.email || ''}">
              </div>
              <div class="modal-field" style="flex:1;">
                <label>Téléphone</label>
                <input type="tel" name="telephone" value="${p.telephone || ''}">
              </div>
            </div>
            <div class="modal-field">
              <label>Contacté par</label>
              <select name="moyenContact">
                <option value="">— Pas encore contacté —</option>
                ${this._MOYENS_CONTACT.map(m => `<option value="${m}" ${m === p.moyenContact ? 'selected' : ''}>${m}</option>`).join('')}
              </select>
            </div>
            <div class="modal-field">
              <label>Valeur potentielle (€)</label>
              <input type="number" name="valeur" value="${p.valeur}" min="0" step="1">
            </div>
            <div class="modal-field">
              <label>Étape</label>
              <select name="col">
                ${this._cols.map(c => `<option value="${c}" ${c === p.col ? 'selected' : ''}>${c}</option>`).join('')}
              </select>
            </div>
            <div class="modal-actions">
              ${isEdit ? `<button type="button" class="btn btn-danger" id="prospect-delete-btn">Supprimer</button>` : `<span></span>`}
              <div class="modal-actions-right">
                <button type="button" class="btn btn-ghost" id="prospect-cancel-btn">Annuler</button>
                <button type="submit" class="btn">${isEdit ? 'Enregistrer' : 'Ajouter'}</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  _openForm(prospect) {
    const wrap = document.createElement('div');
    wrap.innerHTML = this._formHtml(prospect);
    document.body.appendChild(wrap.firstElementChild);
    const overlay = document.getElementById('prospect-modal-overlay');
    const close = () => overlay.remove();

    let mousedownSurOverlay = false;
    overlay.addEventListener('mousedown', (e) => { mousedownSurOverlay = (e.target === overlay); });
    overlay.addEventListener('click', (e) => { if (e.target === overlay && mousedownSurOverlay) close(); });
    document.getElementById('prospect-cancel-btn').addEventListener('click', close);

    const deleteBtn = document.getElementById('prospect-delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        window.confirmerAction('Supprimer ce prospect ?', () => {
          this._data = this._data.filter(p => p.id !== prospect.id);
          // TODO Firebase : window.db.collection('prospects').doc(prospect.id).delete()
          close();
          this.render(this._root);
        });
      });
    }

    document.getElementById('prospect-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = {
        entreprise: fd.get('entreprise').trim(),
        contact: fd.get('contact').trim(),
        email: (fd.get('email') || '').trim(),
        telephone: (fd.get('telephone') || '').trim(),
        moyenContact: fd.get('moyenContact') || '',
        valeur: parseInt(fd.get('valeur') || '0', 10),
        col: fd.get('col'),
      };
      if (!payload.entreprise) return;

      if (prospect) {
        Object.assign(prospect, payload);
        // TODO Firebase : window.db.collection('prospects').doc(prospect.id).update(payload)
      } else {
        this._data.push({ id: Date.now(), ...payload });
        // TODO Firebase : window.db.collection('prospects').add(payload)
      }
      close();
      this.render(this._root);
    });
  },

  // Conversion en client (05/09/2026, demande de Tiphaine) — même principe
  // que devis.js `_convertirEnProjet` : dès qu'un prospect passe "Gagné",
  // un bouton crée directement la fiche Clients avec les infos déjà
  // connues (entreprise/contact/email/téléphone), sans tout ressaisir.
  // `p.convertiEnClient` évite les doublons si on reclique.
  _convertirEnClient(prospectId) {
    const p = this._data.find(x => x.id === prospectId);
    if (!p) return;
    const clients = window.Modules.clients;
    if (!clients) { alert('Module Clients indisponible.'); return; }
    if (!clients._data) clients._data = clients._mock ? clients._mock() : [];

    const nouveauClient = {
      id: Date.now(),
      nom: p.contact || p.entreprise,
      entreprise: p.entreprise,
      siret: '',
      adresse: '',
      email: p.email || '',
      telephone: p.telephone || '',
      statut: 'Actif',
      projet: '',
      abonnement: '—',
      mrr: 0,
      prospectId: p.id,
    };
    clients._data.push(nouveauClient);
    // TODO Firebase : window.db.collection('clients').add({...})

    p.convertiEnClient = true;
    p.clientIdCree = nouveauClient.id; // (05/09/2026) permet un lien direct cliquable vers la fiche créée
    // TODO Firebase : window.db.collection('prospects').doc(p.id).update({ convertiEnClient: true, clientIdCree: nouveauClient.id })
    this.render(this._root);

    window.confirmerAction(
      `Fiche client créée pour "${p.entreprise}" à partir des infos du prospect. Tu peux la compléter (SIRET, adresse...) directement sur Clients.`,
      () => { window.ouvrirFiche('clients', nouveauClient.id); },
      { titre: 'Client créé', texteBouton: 'Voir la fiche client', danger: false }
    );
  },

  _ouvrirFroids() {
    const froids = this._data.filter(p => p.perdu);
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="modal-overlay" id="froids-modal-overlay">
        <div class="modal-box" style="max-width:520px;">
          <div class="modal-title">Prospects froids (${froids.length})</div>
          <div style="max-height:60vh; overflow-y:auto; display:flex; flex-direction:column; gap:8px; margin:14px 0;">
            ${froids.length ? froids.sort((a, b) => b.id - a.id).map(p => `
              <div data-open-froid="${p.id}" style="display:flex; align-items:center; justify-content:space-between; background:var(--bg-input); border:1px solid var(--border-subtle); border-radius:9px; padding:10px 12px; cursor:pointer;">
                <div>
                  <div style="font-weight:600; font-size:13.5px;">${p.entreprise}</div>
                  <div style="color:var(--text-muted); font-size:12px;">${p.contact || ''} · ${p.valeur.toLocaleString('fr-FR')} €</div>
                  ${p.moyenContact ? `<div style="color:var(--text-muted); font-size:11px; margin-top:2px;">${this._iconMoyen(p.moyenContact)} Contacté par ${p.moyenContact.toLowerCase()}</div>` : ''}
                </div>
                <div style="display:flex; gap:6px;">
                  <button class="btn-ghost" style="font-size:11px; padding:5px 9px; border-radius:6px;" data-reactiver="${p.id}">Réactiver</button>
                  <button class="btn-ghost" style="font-size:11px; padding:5px 9px; border-radius:6px;" data-supprimer-froid="${p.id}">Supprimer</button>
                </div>
              </div>
            `).join('') : '<div style="color:var(--text-muted); font-size:13px; padding:8px 2px;">Aucun prospect froid pour l\'instant.</div>'}
          </div>
          <div class="modal-actions">
            <span></span>
            <div class="modal-actions-right">
              <button type="button" class="btn btn-ghost" id="froids-fermer-btn">Fermer</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(wrap.firstElementChild);
    const overlay = document.getElementById('froids-modal-overlay');
    const close = () => overlay.remove();
    let mousedownSurOverlay = false;
    overlay.addEventListener('mousedown', (e) => { mousedownSurOverlay = (e.target === overlay); });
    overlay.addEventListener('click', (e) => { if (e.target === overlay && mousedownSurOverlay) close(); });
    document.getElementById('froids-fermer-btn').addEventListener('click', close);

    overlay.querySelectorAll('[data-reactiver]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number(btn.dataset.reactiver);
        const p = this._data.find(x => x.id === id);
        if (p) { p.perdu = false; p.col = 'À contacter'; }
        // TODO Firebase : window.db.collection('prospects').doc(id).update({ perdu:false, col:'À contacter' })
        close();
        this.render(this._root);
      });
    });
    overlay.querySelectorAll('[data-supprimer-froid]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number(btn.dataset.supprimerFroid);
        window.confirmerAction('Supprimer définitivement ce prospect ?', () => {
          this._data = this._data.filter(p => p.id !== id);
          // TODO Firebase : window.db.collection('prospects').doc(id).delete()
          close();
          this.render(this._root);
        });
      });
    });
    // Clic sur la ligne (hors boutons) = ouvrir la fiche complète, même
    // formulaire que les cartes actives — retour de Tiphaine : elle
    // voulait pouvoir voir les infos d'un prospect froid, pas juste le
    // réactiver ou le supprimer à l'aveugle.
    overlay.querySelectorAll('[data-open-froid]').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('[data-reactiver]') || e.target.closest('[data-supprimer-froid]')) return;
        const id = Number(row.dataset.openFroid);
        const p = this._data.find(x => x.id === id);
        if (p) { close(); this._openForm(p); }
      });
    });
  },

  // Écoute des cartes (ouvrir / supprimer / avancer) — extrait à part
  // pour pouvoir être ré-appelé après une régénération partielle du
  // Kanban (recherche en direct), sans repasser par tout `_bindEvents`.
  _bindKanban(zone) {
    // Sections repliables mobile (06/09/2026) — clic sur l'en-tête d'une
    // étape pour la replier/déplier, re-rend juste la zone (comme la
    // recherche) pour ne perdre ni le scroll ni le focus ailleurs.
    zone.querySelectorAll('[data-toggle-section]').forEach(btn => {
      btn.addEventListener('click', () => {
        const col = btn.dataset.toggleSection;
        if (this._colsRepliees.has(col)) this._colsRepliees.delete(col);
        else this._colsRepliees.add(col);
        zone.innerHTML = this._htmlKanban(this._prospectsFiltres(this._data));
        window.hydrateIcons(zone);
        this._bindKanban(zone);
      });
    });

    zone.querySelectorAll('[data-open]').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-advance]') || e.target.closest('[data-delete]') || e.target.closest('[data-convertir-client]')) return; // gèrent leur propre clic
        const id = Number(card.dataset.open);
        const p = this._data.find(x => x.id === id);
        if (p) this._openForm(p);
      });
    });

    zone.querySelectorAll('[data-convertir-client]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._convertirEnClient(Number(btn.dataset.convertirClient));
      });
    });

    zone.querySelectorAll('[data-voir-client]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        let id = Number(btn.dataset.voirClient);
        if (!id) {
          // Prospects convertis avant l'ajout de `clientIdCree` (05/09/2026)
          // — on retrouve la fiche par `prospectId` côté Clients.
          const prospectId = Number(btn.closest('[data-open]') ? btn.closest('[data-open]').dataset.open : NaN);
          const clientsModule = window.Modules.clients;
          const c = clientsModule && clientsModule._data ? clientsModule._data.find(x => x.prospectId === prospectId) : null;
          if (c) id = c.id;
        }
        if (id) window.ouvrirFiche('clients', id);
        else alert('Fiche client introuvable (a peut-être été supprimée).');
      });
    });

    zone.querySelectorAll('[data-delete]').forEach(delBtn => {
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number(delBtn.dataset.delete);
        window.confirmerAction('Supprimer ce prospect ?', () => {
          this._data = this._data.filter(p => p.id !== id);
          // TODO Firebase : window.db.collection('prospects').doc(id).delete()
          this.render(this._root);
        });
      });
    });

    zone.querySelectorAll('[data-advance]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number(btn.dataset.advance);
        const p = this._data.find(x => x.id === id);
        if (!p) return;
        const idx = this._cols.indexOf(p.col);
        if (idx < this._cols.length - 1) p.col = this._cols[idx + 1];
        // TODO Firebase : window.db.collection('prospects').doc(id).update({ col: p.col })
        this.render(this._root);
      });
    });

    zone.querySelectorAll('[data-froid]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number(btn.dataset.froid);
        const p = this._data.find(x => x.id === id);
        if (p) p.perdu = true;
        // TODO Firebase : window.db.collection('prospects').doc(id).update({ perdu:true })
        this.render(this._root);
      });
    });
  },

  _bindEvents(container) {
    const addBtn = container.querySelector('#add-prospect-btn');
    if (addBtn) addBtn.addEventListener('click', () => this._openForm(null));

    const froidsBtn = container.querySelector('#voir-froids-btn');
    if (froidsBtn) froidsBtn.addEventListener('click', () => this._ouvrirFroids());

    // Bug corrigé le 06/09/2026 (retour de Tiphaine) : passait `container`
    // (toute la page) au lieu de la zone du Kanban — le clic pour
    // replier/déplier une section (voir `_bindKanban`, qui fait
    // `zone.innerHTML = ...`) remplaçait alors TOUTE la page (en-tête,
    // recherche compris) par le seul contenu du Kanban. Doit toujours
    // recevoir la même zone que la recherche juste en dessous.
    this._bindKanban(container.querySelector('#prospects-kanban-zone'));
  },
};

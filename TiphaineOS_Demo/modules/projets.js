/* ═══════════════════════════════════════════════════════════
   MODULE PROJETS — liste + fiche projet (checklist éditable en
   direct : cocher/décocher, ajouter, supprimer une étape). Peut
   être alimenté automatiquement par modules/devis.js (conversion
   devis accepté → projet). TODO Firebase pour la persistance.

   Suivi acompte/solde (03/09/2026) : conforme au cahier des
   charges d'origine de Tiphaine — "Commercial : devis, contrat,
   acompte, solde" sur la fiche projet (pas un onglet Finances à
   part, qui elle est réservée aux graphiques CA agrégés, ni un
   suivi sur le Devis lui-même). Acompte à 50% systématique du
   montant du projet (paramétrable dans Paramétrage > Devis,
   `acomptePct`) — le solde est le reste, exigible à la livraison.
   Remplace le suivi `paye`/`dateEcheancePaiement` ajouté plus tôt
   sur les Devis, qui faisait doublon (voir modules/dashboard.js).
═══════════════════════════════════════════════════════════ */

window.Modules = window.Modules || {};

window.Modules.projets = {
  _data: null,
  _statuts: ['Nouveau', 'En cours', 'Tests', 'Livré', 'Terminé'],
  // Recherche (06/09/2026, retour de Tiphaine : "y'a pas de recherche au
  // cas où" — présente sur Clients/Tickets/Abonnements/Technique mais
  // oubliée ici). Même pattern que ces modules-là : état gardé sur le
  // module (pas juste local au rendu) pour survivre à un re-render
  // complet (ex: après avoir coché une case de paiement).
  _recherche: '',

  // % d'acompte configuré dans Paramétrage > Devis (même source que les
  // devis/PDF — un seul réglage pour toute l'appli).
  _acomptePct() {
    const catalogue = window.Modules.catalogue;
    const e = catalogue ? catalogue._getEntreprise() : null;
    return (e && e.acomptePct) || 50;
  },
  _montantAcompte(p) { return Math.round(p.montant * (this._acomptePct() / 100)); },
  _montantSolde(p) { return p.montant - this._montantAcompte(p); },

  // Facture déjà générée pour ce projet/type ? Calculé EN DIRECT à partir
  // des vraies factures (06/09/2026, même correctif que `devis.js`
  // `_factureExistePour` — bug remonté par Tiphaine : annuler la modal de
  // création de facture laissait le bouton caché pour de bon, parce que le
  // flag `p.factureAcompteGeneree`/`factureSoldeGeneree` était posé AVANT
  // la validation du formulaire, pas après). Ne jamais stocker ce statut
  // dans un flag statique qui peut se désynchroniser de la réalité.
  _factureExistePour(p, type) {
    const factures = window.Modules && window.Modules.factures;
    if (!factures || !factures._data) return false;
    return factures._data.some(f => f.projetId === p.id && f.type === type && f.statut !== 'Annulée');
  },

  // Propose de générer la facture correspondante (05/09/2026, module
  // Factures) juste au moment où l'acompte/le solde est coché — même
  // logique que le rappel d'acompte sur devis.js `_convertirEnProjet` :
  // fermer la boucle "paiement reçu → document émis" tout de suite, sans
  // étape oubliée. Ne repropose pas si déjà généré (vérifié en direct via
  // `_factureExistePour`, voir commentaire ci-dessus), pour ne pas spammer
  // si la case est décochée/recochée par erreur.
  _proposerFacture(p, champ) {
    const factures = window.Modules && window.Modules.factures;
    if (!factures) return;
    const estAcompte = champ === 'acompteRecu';
    const type = estAcompte ? 'Acompte' : 'Solde';
    if (this._factureExistePour(p, type)) return;
    const montant = estAcompte ? this._montantAcompte(p) : this._montantSolde(p);
    const libelle = `${type}${estAcompte ? ` ${this._acomptePct()}%` : ''} — ${p.nom}`;
    window.confirmerAction(
      `${estAcompte ? 'Acompte reçu' : 'Solde payé'} pour "${p.nom}" (${montant.toLocaleString('fr-FR')} €). Générer la facture correspondante maintenant ?`,
      () => {
        // Pas de `statut: 'Payée'` codé en dur (05/09/2026, retour de
        // Tiphaine) — on renseigne le paiement déjà réel (montantPaye =
        // montant, déjà reçu à cet instant précis) et le statut est déduit
        // automatiquement (voir factures._recalculerStatut), comme pour
        // n'importe quelle autre facture. Le jour où ce flux change (ex :
        // facturer avant paiement), rien à modifier dans factures.js.
        factures._openForm(null, {
          type, client: p.client, entreprise: p.entreprise, clientId: p.clientId || null,
          // Lignes multiples (05/09/2026) — une ligne unique ici, mais
          // Tiphaine peut en ajouter une 2e à la main dans le formulaire
          // (ex : le 1er mois d'un abonnement facturé en même temps).
          lignes: [{ description: libelle, montant, abonnementId: null, periode: null }],
          montantPaye: montant,
          datePaiement: new Date().toISOString().slice(0, 10),
          modePaiement: 'Virement',
          projetId: p.id,
        }, () => this.render(this._root)); // rafraîchit SEULEMENT si la facture est vraiment enregistrée (06/09/2026)
      },
      { titre: 'Facture', texteBouton: 'Générer la facture', danger: false }
    );
  },

  // Coche acompte/solde reçu → répercute directement sur la vraie facture
  // (05/09/2026, retour de Tiphaine : cocher "payé" sur le projet ne
  // mettait pas à jour la facture déjà générée). Si une facture Acompte/
  // Solde existe déjà pour ce projet (pas annulée), on la marque payée
  // directement (montantPaye = montant, statut recalculé) au lieu de
  // reproposer d'en créer une nouvelle. Sinon, comportement historique :
  // propose d'en générer une (voir `_proposerFacture`).
  _marquerPaiement(p, champ) {
    const factures = window.Modules && window.Modules.factures;
    const estAcompte = champ === 'acompteRecu';
    const type = estAcompte ? 'Acompte' : 'Solde';
    const existante = (factures && factures._data)
      ? factures._data.find(f => f.projetId === p.id && f.type === type && f.statut !== 'Annulée')
      : null;
    if (existante) {
      existante.montantPaye = existante.montant;
      existante.datePaiement = new Date().toISOString().slice(0, 10);
      if (existante.statut === 'Brouillon') existante.statut = 'Émise';
      factures._recalculerStatut(existante);
      existante.modifieLe = factures._dateHeureLocale ? factures._dateHeureLocale(new Date()) : existante.modifieLe;
      // (plus de flag `factureAcompteGeneree`/`factureSoldeGeneree` ici —
      // le statut "facture existe" est maintenant calculé en direct,
      // voir `_factureExistePour` ; 06/09/2026)
      this.render(this._root);
      return;
    }
    this._proposerFacture(p, champ);
  },

  // Statut de paiement synthétique — pilote le tag sur la carte + les
  // alertes Dashboard (_alertesProjetsPaiement dans dashboard.js).
  _statutPaiement(p) {
    if (!p.acompteRecu) return 'acompte_attente';
    const livre = p.statut === 'Livré' || p.statut === 'Terminé';
    if (livre && !p.soldePaye) return 'solde_attente';
    if (livre && p.soldePaye) return 'solde_ok';
    return 'acompte_ok';
  },
  _tagPaiement(p) {
    const s = this._statutPaiement(p);
    if (s === 'acompte_attente') return `<span class="devis-paiement-tag devis-paiement-retard">Acompte non reçu (${this._montantAcompte(p).toLocaleString('fr-FR')} €)</span>`;
    if (s === 'solde_attente') return `<span class="devis-paiement-tag devis-paiement-retard">Solde à réclamer (${this._montantSolde(p).toLocaleString('fr-FR')} €)</span>`;
    if (s === 'solde_ok') return `<span class="devis-paiement-tag devis-paiement-ok">✓ Soldé</span>`;
    return `<span class="devis-paiement-tag devis-paiement-attente">Acompte reçu — solde à la livraison</span>`;
  },

  // Cases à cocher directement sur la carte (03/09/2026) — Tiphaine ne
  // veut pas avoir à ouvrir la fiche projet juste pour cocher
  // acompte/solde, il y a la place sur la carte. `stopPropagation` pour
  // ne pas déclencher l'ouverture de la fiche (le clic sur la carte
  // ouvre le formulaire, voir _bindEvents `[data-open]`).
  _casesPaiement(p) {
    const s = this._statutPaiement(p);
    return `
      <div class="projet-paiement-cases" onclick="event.stopPropagation()">
        <label class="devis-paye-label" style="font-size:12px; ${s === 'acompte_attente' ? 'color:#e08a8a;' : 'color:var(--text-secondary);'}">
          <input type="checkbox" data-toggle-paiement="acompteRecu" data-id="${p.id}" ${p.acompteRecu ? 'checked' : ''}>
          Acompte reçu (${this._montantAcompte(p).toLocaleString('fr-FR')} €)
        </label>
        <label class="devis-paye-label" style="font-size:12px; ${s === 'solde_attente' ? 'color:#e08a8a;' : 'color:var(--text-secondary);'}">
          <input type="checkbox" data-toggle-paiement="soldePaye" data-id="${p.id}" ${p.soldePaye ? 'checked' : ''}>
          Solde payé (${this._montantSolde(p).toLocaleString('fr-FR')} €)
        </label>
      </div>
    `;
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
    // TODO Firebase : const snap = await window.db.collection('projets').get();
    return this._mock();
  },

  // Nom du client affiché : lien cliquable vers la fiche client si un
  // clientId existe et que le client existe toujours (même logique que
  // devis.js `_nomClientAffiche`, 05/09/2026).
  _nomClientAffiche(p) {
    if (p.clientId) {
      const clientsModule = window.Modules && window.Modules.clients;
      const c = clientsModule && clientsModule._data ? clientsModule._data.find(x => x.id === p.clientId) : null;
      if (c) return `<a href="#" data-voir-client="${c.id}" style="color:var(--text-primary); text-decoration:underline; text-decoration-color:rgba(255,255,255,.25);">${c.nom}</a>`;
    }
    return p.client;
  },

  // Factures déjà émises pour ce projet (05/09/2026) — permet de voir
  // d'un coup d'œil ce qui a été facturé sans changer d'onglet.
  _facturesLiees(p) {
    const factures = window.Modules && window.Modules.factures;
    if (!factures || !factures._data) return [];
    return factures._data.filter(f => f.projetId === p.id);
  },

  _statutBadge(statut) {
    const map = { 'Nouveau':'badge-blue', 'En cours':'badge-orange', 'Tests':'badge-orange', 'Livré':'badge-green', 'Terminé':'badge-green' };
    return `<span class="badge ${map[statut] || 'badge-blue'}">${statut}</span>`;
  },

  // Filtre par nom de projet / client / entreprise (06/09/2026).
  _projetsFiltres(projets) {
    const q = (this._recherche || '').trim().toLowerCase();
    if (!q) return projets;
    return projets.filter(p =>
      (p.nom || '').toLowerCase().includes(q) ||
      (p.client || '').toLowerCase().includes(q) ||
      (p.entreprise || '').toLowerCase().includes(q)
    );
  },

  // Checklist de base proposée à la création — modifiable/supprimable ensuite.
  _checklistParDefaut() {
    return [
      { label:'Kickoff / brief client', done:false },
      { label:'Maquette / structure validée', done:false },
      { label:'Développement', done:false },
      { label:'Tests', done:false },
      { label:'Livraison', done:false },
    ];
  },

  _progression(p) {
    if (!p.checklist || !p.checklist.length) return 0;
    return Math.round((p.checklist.filter(c => c.done).length / p.checklist.length) * 100);
  },

  // Prochaine étape non cochée de la checklist (ou null si tout est fait).
  _prochaineEtape(p) {
    return (p.checklist || []).find(c => !c.done) || null;
  },

  // Boutons d'action rapide sur la carte (03/09/2026) — Tiphaine ne veut
  // pas avoir à ouvrir la fiche juste pour cocher l'étape suivante ou
  // marquer le projet livré. "Étape suivante" coche la 1ère étape non
  // faite de la checklist (fait avancer la barre de progression).
  // "Livré" coche tout le reste + passe le statut sur "Livré" en un
  // clic (raccourci pratique quand on livre directement sans avoir
  // suivi chaque étape une par une).
  _actionsRapides(p) {
    const prochaine = this._prochaineEtape(p);
    const dejaLivre = p.statut === 'Livré' || p.statut === 'Terminé';
    if (!prochaine && dejaLivre) return '';
    return `
      <div class="projet-actions-rapides" onclick="event.stopPropagation()">
        ${prochaine ? `<button type="button" class="projet-action-etape" data-etape-suivante="${p.id}">→ ${prochaine.label}</button>` : ''}
        ${!dejaLivre ? `<button type="button" class="projet-action-livre" data-marquer-livre="${p.id}">✓ Livré</button>` : ''}
      </div>
    `;
  },

  _html(projets) {
    return `
      <div class="page-header-row">
        <div>
          <div class="page-title"><span class="nav-icon" data-icon="grid"></span>Projets</div>
          <div class="page-sub">${projets.length} projet${projets.length > 1 ? 's' : ''}</div>
        </div>
        <div class="page-header-actions">
          <button class="btn" id="add-projet-btn">+ Nouveau projet</button>
        </div>
      </div>
      <div id="projets-cartes-zone">${this._htmlCartes(this._projetsFiltres(projets))}</div>
    `;
  },

  _htmlCartes(projets) {
    if (!projets.length) {
      return `<div class="card" style="color:var(--text-muted); text-align:center; padding:24px;">Aucun projet ${this._recherche ? 'ne correspond à cette recherche' : 'pour le moment'}.</div>`;
    }
    return `
      <div class="grid grid-2">
        ${projets.map(p => `
          <div class="card projet-carte" data-open="${p.id}" style="cursor:pointer; position:relative;">
            <button class="card-delete-btn" data-delete="${p.id}" title="Supprimer">✕</button>
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; padding-right:28px;">
              <div style="font-weight:700; font-size:14.5px; padding-right:10px;">${p.nom}</div>
              ${this._statutBadge(p.statut)}
            </div>
            <div class="stat-sub" style="margin-bottom:10px;">${this._nomClientAffiche(p)}${p.entreprise ? ` — ${p.entreprise}` : ''} · ${p.montant.toLocaleString('fr-FR')} €${p.devisId ? ` · <a href="#" data-voir-devis="${p.devisId}" style="color:var(--text-secondary); text-decoration:underline;">devis d'origine →</a>` : ''}</div>
            <div class="gauge-track"><div class="gauge-fill" style="width:${this._progression(p)}%"></div></div>
            <div class="stat-sub" style="margin-top:6px;">${this._progression(p)}% — ${p.checklist.filter(c => c.done).length}/${p.checklist.length} étapes</div>
            ${this._casesPaiement(p)}
            ${this._actionsRapides(p)}
          </div>
        `).join('')}
      </div>
    `;
  },

  _formHtml(p) {
    const isEdit = !!p;
    p = p || { nom:'', client:'', entreprise:'', clientId:null, montant:0, statut:'Nouveau', dateDebut:new Date().toISOString().slice(0,10), checklist:[], acompteRecu:false, soldePaye:false };
    const acompte = this._montantAcompte(p);
    const solde = this._montantSolde(p);
    const clientsModule = window.Modules.clients;
    const clientsExistants = (clientsModule && clientsModule._data) ? clientsModule._data : [];
    const facturesLiees = isEdit ? this._facturesLiees(p) : [];
    const devisModule = window.Modules.devis;
    const devisOrigine = (isEdit && p.devisId && devisModule && devisModule._data) ? devisModule._data.find(d => d.id === p.devisId) : null;
    return `
      <div class="modal-overlay" id="projet-modal-overlay">
        <div class="modal-box">
          <div class="modal-title">${isEdit ? 'Modifier le projet' : 'Nouveau projet'}</div>
          <form id="projet-form">
            <div class="modal-field">
              <label>Nom du projet</label>
              <input type="text" name="nom" value="${p.nom}" required autofocus>
            </div>
            ${clientsExistants.length ? `
            <div class="modal-field">
              <label>Reprendre un client existant (pré-remplit ses infos, tout reste modifiable)</label>
              <select id="projet-client-existant-select">
                <option value="">— Nouveau client / saisie libre —</option>
                ${clientsExistants.map(c => `<option value="${c.id}" ${p.clientId === c.id ? 'selected' : ''}>${c.nom}${c.entreprise ? ' — ' + c.entreprise : ''}</option>`).join('')}
              </select>
            </div>` : ''}
            <input type="hidden" name="clientId" id="projet-clientid-input" value="${p.clientId || ''}">
            <div class="modal-field">
              <label>Client${p.clientId ? ' — <a href="#" id="projet-voir-client-lien" style="color:var(--text-secondary); font-weight:400;">voir la fiche client →</a>' : ''}</label>
              <input type="text" name="client" id="projet-client-input" value="${p.client}">
            </div>
            <div class="modal-field">
              <label>Entreprise</label>
              <input type="text" name="entreprise" value="${p.entreprise || ''}">
            </div>
            ${devisOrigine ? `
            <div class="modal-field" style="font-size:12.5px; color:var(--text-secondary);">
              Issu du devis <a href="#" id="projet-voir-devis-lien" style="color:var(--text-secondary); text-decoration:underline;">${devisModule._formaterNumero ? devisModule._formaterNumero(devisOrigine) : ('N° ' + (devisOrigine.numero || devisOrigine.id))} →</a>
            </div>` : ''}
            ${isEdit && facturesLiees.length ? `
            <div class="modal-field" style="font-size:12.5px; color:var(--text-secondary);">
              <label>Factures liées</label>
              <div style="display:flex; flex-direction:column; gap:4px;">
                ${facturesLiees.map(f => `<a href="#" data-voir-facture="${f.id}" style="color:var(--text-primary); text-decoration:underline;">${f.numero || f.id} — ${f.type} — ${(f.montant || 0).toLocaleString('fr-FR')} € ${f.statut === 'Annulée' ? '(annulée)' : ''}</a>`).join('')}
              </div>
            </div>` : ''}
            <div class="modal-field">
              <label>Montant (€)</label>
              <input type="number" name="montant" id="projet-montant-input" value="${p.montant}" min="0" step="1">
            </div>

            <!-- Suivi acompte/solde (03/09/2026) — acompte à ${this._acomptePct()}%
                 (réglage global, Paramétrage > Devis), solde = le reste, exigible
                 à la livraison. Montants recalculés en direct si le montant du
                 projet change. -->
            <div class="modal-field">
              <label class="devis-paye-label">
                <input type="checkbox" name="acompteRecu" id="projet-acompte-checkbox" ${p.acompteRecu ? 'checked' : ''}>
                Acompte reçu (<span id="projet-acompte-montant">${acompte.toLocaleString('fr-FR')}</span> € — ${this._acomptePct()}%)
              </label>
            </div>
            <div class="modal-field">
              <label class="devis-paye-label">
                <input type="checkbox" name="soldePaye" id="projet-solde-checkbox" ${p.soldePaye ? 'checked' : ''}>
                Solde payé (<span id="projet-solde-montant">${solde.toLocaleString('fr-FR')}</span> €)
              </label>
            </div>

            <div class="modal-field">
              <label>Statut</label>
              <select name="statut">
                ${this._statuts.map(s => `<option value="${s}" ${s === p.statut ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
            </div>
            <div class="modal-field">
              <label>Date de début</label>
              <input type="date" name="dateDebut" value="${p.dateDebut}">
            </div>

            ${isEdit ? `
              <div class="modal-field">
                <label>Checklist</label>
                <div id="projet-checklist">
                  ${p.checklist.map((c, i) => `
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                      <input type="checkbox" data-check-idx="${i}" ${c.done ? 'checked' : ''}>
                      <span style="flex:1; font-size:13.5px; ${c.done ? 'color:#6a6a6a; text-decoration:line-through;' : ''}">${c.label}</span>
                      <button type="button" class="btn-ghost" data-remove-idx="${i}" style="padding:2px 8px; font-size:11px; border-radius:6px;">✕</button>
                    </div>
                  `).join('')}
                </div>
                <div style="display:flex; gap:8px; margin-top:8px;">
                  <input type="text" id="projet-new-step" placeholder="Nouvelle étape..." style="flex:1;">
                  <button type="button" class="btn-ghost" id="projet-add-step" style="padding:8px 12px; font-size:12px;">Ajouter</button>
                </div>
              </div>
            ` : ''}

            <div class="modal-actions">
              ${isEdit ? `<button type="button" class="btn btn-danger" id="projet-delete-btn">Supprimer</button>` : `<span></span>`}
              <div class="modal-actions-right">
                <button type="button" class="btn btn-ghost" id="projet-cancel-btn">Annuler</button>
                <button type="submit" class="btn">${isEdit ? 'Enregistrer' : 'Ajouter'}</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  _openForm(projet) {
    const wrap = document.createElement('div');
    wrap.innerHTML = this._formHtml(projet);
    document.body.appendChild(wrap.firstElementChild);
    const overlay = document.getElementById('projet-modal-overlay');
    const close = () => overlay.remove();
    const reopen = () => { close(); this._openForm(projet); }; // pour re-render la checklist sans tout re-render l'app

    let mousedownSurOverlay = false;
    overlay.addEventListener('mousedown', (e) => { mousedownSurOverlay = (e.target === overlay); });
    overlay.addEventListener('click', (e) => { if (e.target === overlay && mousedownSurOverlay) close(); });
    document.getElementById('projet-cancel-btn').addEventListener('click', close);

    // Reprendre un client existant (05/09/2026) — pré-remplit les champs
    // texte + mémorise le clientId (même logique que devis.js).
    const clientSelect = document.getElementById('projet-client-existant-select');
    if (clientSelect) {
      clientSelect.addEventListener('change', () => {
        const id = clientSelect.value ? Number(clientSelect.value) : null;
        document.getElementById('projet-clientid-input').value = id || '';
        if (!id) return;
        const clientsModule = window.Modules.clients;
        const c = clientsModule && clientsModule._data ? clientsModule._data.find(x => x.id === id) : null;
        if (!c) return;
        document.getElementById('projet-client-input').value = c.nom;
        const entrepriseInput = document.querySelector('#projet-form input[name="entreprise"]');
        if (entrepriseInput) entrepriseInput.value = c.entreprise || '';
      });
    }
    const voirClientLien = document.getElementById('projet-voir-client-lien');
    if (voirClientLien) {
      voirClientLien.addEventListener('click', (e) => {
        e.preventDefault();
        const id = Number(document.getElementById('projet-clientid-input').value);
        if (id) { close(); window.ouvrirFiche('clients', id); }
      });
    }
    const voirDevisLien = document.getElementById('projet-voir-devis-lien');
    if (voirDevisLien && projet && projet.devisId) {
      voirDevisLien.addEventListener('click', (e) => {
        e.preventDefault();
        close();
        window.ouvrirFiche('devis', projet.devisId);
      });
    }
    document.querySelectorAll('[data-voir-facture]').forEach(lien => {
      lien.addEventListener('click', (e) => {
        e.preventDefault();
        const id = Number(lien.dataset.voirFacture);
        close();
        window.ouvrirFiche('factures', id);
      });
    });

    // Recalcule les montants acompte/solde affichés en direct si le montant
    // du projet est modifié dans le formulaire (avant même d'enregistrer).
    const montantInput = document.getElementById('projet-montant-input');
    if (montantInput) {
      montantInput.addEventListener('input', () => {
        const montant = parseInt(montantInput.value || '0', 10);
        const pct = this._acomptePct();
        const acompte = Math.round(montant * (pct / 100));
        document.getElementById('projet-acompte-montant').textContent = acompte.toLocaleString('fr-FR');
        document.getElementById('projet-solde-montant').textContent = (montant - acompte).toLocaleString('fr-FR');
      });
    }

    // Cases acompte/solde du formulaire (même proposition de facture que
    // les cases rapides sur la carte, voir `_proposerFacture` — cohérence
    // quel que soit le chemin utilisé pour cocher).
    if (projet) {
      const acompteCb = document.getElementById('projet-acompte-checkbox');
      if (acompteCb) acompteCb.addEventListener('change', () => {
        const activation = acompteCb.checked && !projet.acompteRecu;
        projet.acompteRecu = acompteCb.checked;
        if (activation) this._marquerPaiement(projet, 'acompteRecu');
      });
      const soldeCb = document.getElementById('projet-solde-checkbox');
      if (soldeCb) soldeCb.addEventListener('change', () => {
        const activation = soldeCb.checked && !projet.soldePaye;
        projet.soldePaye = soldeCb.checked;
        if (activation) this._marquerPaiement(projet, 'soldePaye');
      });
    }

    if (projet) {
      document.querySelectorAll('[data-check-idx]').forEach(cb => {
        cb.addEventListener('change', () => {
          projet.checklist[Number(cb.dataset.checkIdx)].done = cb.checked;
          // TODO Firebase : window.db.collection('projets').doc(projet.id).update({ checklist: projet.checklist })
          reopen();
        });
      });
      document.querySelectorAll('[data-remove-idx]').forEach(btn => {
        btn.addEventListener('click', () => {
          projet.checklist.splice(Number(btn.dataset.removeIdx), 1);
          reopen();
        });
      });
      const addStepBtn = document.getElementById('projet-add-step');
      if (addStepBtn) addStepBtn.addEventListener('click', () => {
        const input = document.getElementById('projet-new-step');
        const label = input.value.trim();
        if (!label) return;
        projet.checklist.push({ label, done:false });
        reopen();
      });
    }

    const deleteBtn = document.getElementById('projet-delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        window.confirmerAction('Supprimer ce projet ?', () => {
          this._data = this._data.filter(x => x.id !== projet.id);
          // TODO Firebase : window.db.collection('projets').doc(projet.id).delete()
          close();
          this.render(this._root);
        });
      });
    }

    document.getElementById('projet-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = {
        nom: fd.get('nom').trim(),
        client: fd.get('client').trim(),
        entreprise: fd.get('entreprise').trim(),
        clientId: fd.get('clientId') ? Number(fd.get('clientId')) : null,
        montant: parseInt(fd.get('montant') || '0', 10),
        statut: fd.get('statut'),
        dateDebut: fd.get('dateDebut'),
        acompteRecu: fd.get('acompteRecu') === 'on',
        soldePaye: fd.get('soldePaye') === 'on',
      };
      if (!payload.nom) return;

      if (projet) {
        Object.assign(projet, payload);
        // TODO Firebase : window.db.collection('projets').doc(projet.id).update(payload)
        close();
        this.render(this._root);
      } else {
        const nouveauProjet = { id: Date.now(), checklist: this._checklistParDefaut(), ...payload };
        this._data.push(nouveauProjet);
        // TODO Firebase : window.db.collection('projets').add(nouveauProjet)
        close();
        this.render(this._root);
        this._openForm(nouveauProjet); // rouvre directement en édition pour ajuster la checklist
      }
    });
  },

  _bindEvents(container) {
    const addBtn = container.querySelector('#add-projet-btn');
    if (addBtn) addBtn.addEventListener('click', () => this._openForm(null));

    this._bindCartes(container);
  },

  // Écouteurs propres aux cartes projet (06/09/2026, extrait de
  // `_bindEvents` pour pouvoir les rebrancher après un filtrage par
  // recherche sans re-render toute la page).
  _bindCartes(container) {
    container.querySelectorAll('[data-open]').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-delete]') || e.target.closest('[data-voir-client]') || e.target.closest('[data-voir-devis]')) return;
        const id = Number(card.dataset.open);
        const p = this._data.find(x => x.id === id);
        if (p) this._openForm(p);
      });
    });

    container.querySelectorAll('[data-voir-client]').forEach(lien => {
      lien.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = Number(lien.dataset.voirClient);
        if (id) window.ouvrirFiche('clients', id);
      });
    });
    container.querySelectorAll('[data-voir-devis]').forEach(lien => {
      lien.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = Number(lien.dataset.voirDevis);
        if (id) window.ouvrirFiche('devis', id);
      });
    });

    container.querySelectorAll('[data-delete]').forEach(delBtn => {
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number(delBtn.dataset.delete);
        window.confirmerAction('Supprimer ce projet ?', () => {
          this._data = this._data.filter(x => x.id !== id);
          this.render(this._root);
        });
      });
    });

    // Cases acompte/solde directement sur la carte (03/09/2026) — pas
    // besoin d'ouvrir la fiche projet pour cocher.
    container.querySelectorAll('[data-toggle-paiement]').forEach(cb => {
      cb.addEventListener('click', (e) => e.stopPropagation());
      cb.addEventListener('change', () => {
        const id = Number(cb.dataset.id);
        const p = this._data.find(x => x.id === id);
        if (!p) return;
        const champ = cb.dataset.togglePaiement;
        const activation = cb.checked && !p[champ]; // décoché → coché, pas l'inverse
        p[champ] = cb.checked;
        // TODO Firebase : window.db.collection('projets').doc(id).update({ [champ]: cb.checked })
        this.render(this._root);
        if (activation) this._marquerPaiement(p, champ);
      });
    });

    // Actions rapides "Étape suivante" / "Livré" (03/09/2026) — mêmes
    // raisons, éviter le passage par la fiche complète.
    container.querySelectorAll('[data-etape-suivante]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number(btn.dataset.etapeSuivante);
        const p = this._data.find(x => x.id === id);
        const etape = p && this._prochaineEtape(p);
        if (!etape) return;
        etape.done = true;
        // TODO Firebase : window.db.collection('projets').doc(id).update({ checklist: p.checklist })
        this.render(this._root);
      });
    });
    container.querySelectorAll('[data-marquer-livre]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number(btn.dataset.marquerLivre);
        const p = this._data.find(x => x.id === id);
        if (!p) return;
        (p.checklist || []).forEach(c => { c.done = true; });
        p.statut = 'Livré';
        // TODO Firebase : window.db.collection('projets').doc(id).update({ checklist: p.checklist, statut: 'Livré' })
        this.render(this._root);
      });
    });
  },
};

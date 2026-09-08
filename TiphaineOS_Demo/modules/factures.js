/* ═══════════════════════════════════════════════════════════
   MODULE FACTURES — liste + formulaire modal + génération PDF
   (05/09/2026, suite à la revue complète de l'app). Jusqu'ici, le
   suivi acompte/solde sur Projets n'était qu'une case à cocher :
   aucun document n'était jamais émis, alors que la loi impose une
   facture pour chaque paiement encaissé par un professionnel. Ce
   module génère un vrai PDF de facture, sur le même modèle visuel
   que devis.js, avec sa propre numérotation (Paramétrage > Devis,
   section Factures) — distincte de celle des devis.

   ⚠️ Ce PDF est une facture "classique" (document + mentions
   légales), pas une facture électronique au sens de la réforme de
   facturation électronique (transmission structurée via une
   plateforme agréée/PDP). Cette dernière obligation ne s'applique
   aux micro-entreprises qu'à partir du 01/09/2027 — à rebrancher à
   ce moment-là sur une plateforme agréée, sans tout reconstruire
   (voir DEV_NOTES.md).

   Génération automatique proposée depuis Projets quand "Acompte
   reçu" ou "Solde payé" est coché (voir modules/projets.js), plus
   création manuelle ici pour les factures ponctuelles (abonnements,
   prestations hors projet...). TODO Firebase pour la persistance.
═══════════════════════════════════════════════════════════ */

window.Modules = window.Modules || {};

window.Modules.factures = {
  _data: null,
  // 'Abonnement' ajouté le 05/09/2026 (facturation mensuelle récurrente,
  // voir modules/abonnements.js) — reste informatif quand une facture
  // mélange plusieurs lignes de nature différente (ex : solde forfait +
  // 1er mois d'abonnement), pas une contrainte stricte.
  _types: ['Acompte', 'Solde', 'Abonnement', 'Facture unique'],
  // Statuts (05/09/2026, retour ciblé après relecture de Tiphaine + ChatGPT
  // sur la version initiale du module) — 'Brouillon' et 'Annulée' sont des
  // états MANUELS (posés par une action explicite) ; 'Émise'/'Partiellement
  // payée'/'Payée' sont RECALCULÉS automatiquement à partir de montant/
  // montantPaye (voir `_recalculerStatut`), jamais choisis à la main.
  _statuts: ['Brouillon', 'Émise', 'Partiellement payée', 'Payée', 'Annulée'],
  _recherche: '',

  _dateHeureLocale(d) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },

  async render(container) {
    if (!this._data) {
      this._data = window.FIREBASE_READY ? await this._fetchReal() : this._mock();
    }
    this._data.forEach(f => this._migrerLignes(f));
    this._root = container.closest('#content') || container;
    container.innerHTML = this._html(this._data);
    window.hydrateIcons(container);
    this._bindEvents(container);
    if (window.majBadgesNav) window.majBadgesNav();
  },

  _mock() { return []; },

  async _fetchReal() {
    // TODO Firebase : const snap = await window.db.collection('factures').get();
    return this._mock();
  },

  _facturesFiltrees(factures) {
    const q = (this._recherche || '').trim().toLowerCase();
    if (!q) return factures;
    return factures.filter(f => (f.client || '').toLowerCase().includes(q) || (f.entreprise || '').toLowerCase().includes(q) || this._libelleAffiche(f).toLowerCase().includes(q));
  },

  // ── Lignes multiples (05/09/2026, demande de Tiphaine — pouvoir combiner
  // sur une même facture plusieurs éléments, ex : solde d'un forfait +
  // 1er mois d'un abonnement, sans en faire deux documents séparés).
  // Chaque ligne : { description, montant, abonnementId, periode }.
  // `abonnementId`/`periode` (format 'YYYY-MM') sont optionnels — remplis
  // uniquement quand la ligne vient du bouton "Facturer [mois]" sur
  // Abonnements (voir modules/abonnements.js), pour pouvoir détecter plus
  // tard "ce mois a déjà été facturé" sans dépendre d'une case à cocher
  // qui pourrait se désynchroniser (ex : si la facture est annulée après
  // coup — voir `_moisDejaFactures` dans abonnements.js).
  //
  // `montant`/`libelle` restent des champs plats sur la facture pour la
  // compatibilité avec les factures créées avant ce changement — une
  // facture sans `lignes` est migrée en une seule ligne à partir de
  // l'ancien libelle/montant, jamais recréée à vide.
  _migrerLignes(f) {
    if (Array.isArray(f.lignes) && f.lignes.length) return;
    f.lignes = [{ description: f.libelle || f.type || '', montant: f.montant || 0, abonnementId: null, periode: null }];
  },

  _totalLignes(lignes) {
    return (lignes || []).reduce((s, l) => s + (Number(l.montant) || 0), 0);
  },

  // Texte affiché en table/PDF/nom de fichier — jointure des descriptions
  // de chaque ligne (une seule ligne = comportement identique à avant).
  _libelleAffiche(f) {
    const lignes = f.lignes && f.lignes.length ? f.lignes : [{ description: f.libelle || f.type || '' }];
    return lignes.map(l => l.description).filter(Boolean).join(' + ') || f.type || '';
  },

  // Numéro séquentiel + reset annuel — même logique que devis.js
  // `_prochainNumero`/`_formaterNumero`, mais sur ses propres réglages
  // (`factureNumeroPrefixe`/Chiffres/InclureAnnee), pour que la série des
  // factures reste indépendante de celle des devis.
  _prochainNumero() {
    const max = this._data.reduce((m, f) => Math.max(m, f.numero || 0), 0);
    return max + 1;
  },

  _formaterNumero(f) {
    const catalogue = window.Modules && window.Modules.catalogue;
    const e = catalogue ? catalogue._getEntreprise() : {};
    const brut = f.numero || f.id;
    const prefixe = e.factureNumeroPrefixe || '';
    const chiffres = e.factureNumeroChiffres || 0;
    const inclureAnnee = !!e.factureNumeroInclureAnnee;
    if (!prefixe && !chiffres && !inclureAnnee) return `N° ${brut}`;
    const anneeCle = (f.date || '').slice(0, 4) || String(new Date().getFullYear());
    let rang = brut;
    if (inclureAnnee) {
      rang = (this._data || [])
        .filter(x => ((x.date || '').slice(0, 4) || anneeCle) === anneeCle && (x.numero || x.id) <= brut)
        .length || 1;
    }
    const num = chiffres ? String(rang).padStart(chiffres, '0') : String(rang);
    const annee = inclureAnnee ? `${anneeCle}-` : '';
    return `${prefixe}${annee}${num}`;
  },

  // Recalcule le statut à partir de montant/montantPaye — jamais appelé sur
  // une facture 'Brouillon' ou 'Annulée' (états manuels, voir plus haut).
  // Ne modifie jamais `montant`/`montantPaye` eux-mêmes.
  _recalculerStatut(f) {
    if (f.statut === 'Brouillon' || f.statut === 'Annulée') return;
    const paye = f.montantPaye || 0;
    if (paye <= 0) f.statut = 'Émise';
    else if (paye < f.montant) f.statut = 'Partiellement payée';
    else f.statut = 'Payée';
  },

  // Répercute une facture passée "Payée" sur le projet d'origine
  // (05/09/2026) — coche `acompteRecu`/`soldePaye` sur `projets._data` si
  // la facture est de type Acompte/Solde et liée à un projet (`projetId`).
  // Évite qu'une facture marquée payée ici laisse la case décochée côté
  // Projets (désynchronisation constatée par Tiphaine).
  _repercuterSurProjet(f) {
    if (!f.projetId || f.statut !== 'Payée') return;
    const projets = window.Modules && window.Modules.projets;
    if (!projets || !projets._data) return;
    const p = projets._data.find(x => x.id === f.projetId);
    if (!p) return;
    if (f.type === 'Acompte') p.acompteRecu = true;
    else if (f.type === 'Solde') p.soldePaye = true;
  },

  _resteAPayer(f) {
    return Math.max(0, (f.montant || 0) - (f.montantPaye || 0));
  },

  // Nom client + liens croisés (05/09/2026) — lien vers la fiche client
  // si `clientId` existe et que le client existe toujours, et vers le
  // projet d'origine si `projetId` existe (même logique que devis.js/
  // projets.js).
  _nomClientAffiche(f) {
    const entrepriseTxt = f.entreprise ? ` <span style="color:#6a6a6a;">— ${f.entreprise}</span>` : '';
    if (f.clientId) {
      const clientsModule = window.Modules && window.Modules.clients;
      const c = clientsModule && clientsModule._data ? clientsModule._data.find(x => x.id === f.clientId) : null;
      if (c) return `<a href="#" data-voir-client="${c.id}" style="color:var(--text-primary); text-decoration:underline; text-decoration-color:rgba(255,255,255,.25);">${c.nom}</a>${c.entreprise ? ` <span style="color:#6a6a6a;">— ${c.entreprise}</span>` : entrepriseTxt}`;
    }
    return `${f.client}${entrepriseTxt}`;
  },

  _lienProjet(f) {
    if (!f.projetId) return '';
    return ` <a href="#" data-voir-projet="${f.projetId}" style="color:var(--text-secondary); font-size:11.5px; text-decoration:underline;">projet →</a>`;
  },

  // Lien vers le devis d'origine (05/09/2026) — quand la facture est
  // générée directement depuis Devis (acompte/solde/complète), sans passer
  // par un projet (voir modules/devis.js `_genererFacture`).
  _lienDevis(f) {
    if (!f.devisId) return '';
    const devisModule = window.Modules && window.Modules.devis;
    const d = devisModule && devisModule._data ? devisModule._data.find(x => x.id === f.devisId) : null;
    const texte = d && devisModule._formaterNumero ? devisModule._formaterNumero(d) : 'devis';
    return ` <a href="#" data-voir-devis="${f.devisId}" style="color:var(--text-secondary); font-size:11.5px; text-decoration:underline;">${texte} →</a>`;
  },

  _statutBadge(statut) {
    const map = { 'Brouillon': 'badge-blue', 'Émise': 'badge-orange', 'Partiellement payée': 'badge-orange', 'Payée': 'badge-green', 'Annulée': 'badge-red' };
    return `<span class="badge ${map[statut] || 'badge-blue'}">${statut}</span>`;
  },

  _html(facturesOriginal) {
    // Annulée/Brouillon exclues du "en attente" — ni l'une ni l'autre n'est
    // une créance active (05/09/2026, demande explicite de Tiphaine : une
    // facture annulée ne doit plus compter dans les indicateurs).
    const totalDu = facturesOriginal
      .filter(f => f.statut !== 'Payée' && f.statut !== 'Annulée' && f.statut !== 'Brouillon')
      .reduce((s, f) => s + this._resteAPayer(f), 0);
    return `
      <div class="page-header-row">
        <div>
          <div class="page-title"><span class="nav-icon" data-icon="receipt"></span>Factures</div>
          <div class="page-sub">${facturesOriginal.length} facture${facturesOriginal.length > 1 ? 's' : ''} — ${totalDu.toLocaleString('fr-FR')} € en attente de paiement</div>
        </div>
        <div class="page-header-actions">
          <button class="btn" id="add-facture-btn">+ Nouvelle facture</button>
        </div>
      </div>
      <div id="factures-tableau-zone">${this._htmlTableau(this._facturesFiltrees(facturesOriginal))}</div>
    `;
  },

  _htmlTableau(factures) {
    const triees = [...factures].sort((a, b) => (b.numero || 0) - (a.numero || 0));
    return `
      <div class="card factures-table-wrap" style="padding:0; overflow-x:auto;">
        <table>
          <thead><tr>
            <th>N°</th><th>Client</th><th>Type</th><th>Libellé</th><th>Montant</th><th>Payé</th><th>Reste</th><th>Statut</th><th>Date</th><th>PDF</th><th></th><th></th><th></th>
          </tr></thead>
          <tbody>
            ${triees.length ? triees.map(f => {
              const estBrouillon = f.statut === 'Brouillon';
              const estAnnulee = f.statut === 'Annulée';
              return `
              <tr data-open="${f.id}" style="cursor:pointer;">
                <td style="color:#8a8a8a;">${this._formaterNumero(f)}</td>
                <td>${this._nomClientAffiche(f)}${this._lienProjet(f)}${this._lienDevis(f)}</td>
                <td>${f.type}</td>
                <td>${this._libelleAffiche(f)}</td>
                <td>${f.montant.toLocaleString('fr-FR')} €</td>
                <td>${(f.montantPaye || 0).toLocaleString('fr-FR')} €</td>
                <td>${this._resteAPayer(f).toLocaleString('fr-FR')} €</td>
                <td>${this._statutBadge(f.statut)}</td>
                <td>${f.date}</td>
                <td><button class="btn-ghost" style="padding:5px 10px; font-size:11.5px; border-radius:7px;" data-telecharger="${f.id}">👁 Aperçu / PDF</button></td>
                <td>${estBrouillon ? `<button class="btn-ghost" style="padding:5px 10px; font-size:11.5px; border-radius:7px;" data-emettre="${f.id}">Émettre</button>` : ''}</td>
                <td>${(!estAnnulee && f.statut !== 'Payée') ? `<button class="btn-ghost" style="padding:5px 10px; font-size:11.5px; border-radius:7px; color:#6ec88c;" data-marquer-payee="${f.id}" title="Marquer cette facture comme payée">✓ Marquer payée</button>` : ''}</td>
                <td style="width:36px;">
                  ${estBrouillon
                    ? `<button class="row-delete-btn" data-delete="${f.id}" title="Supprimer le brouillon">✕</button>`
                    : (estAnnulee ? '' : `<button class="row-delete-btn" data-annuler="${f.id}" title="Annuler la facture">⊘</button>`)}
                </td>
              </tr>
            `;
            }).join('') : `<tr><td colspan="13" style="color:var(--text-muted); text-align:center; padding:24px;">Aucune facture ${this._recherche ? 'ne correspond à cette recherche' : 'pour le moment'}.</td></tr>`}
          </tbody>
        </table>
      </div>

      <!-- Version mobile (06/09/2026, même pattern que Devis) — liste de
           cartes au lieu du tableau à 13 colonnes. Réutilise les mêmes
           data-* et helpers que le tableau : _bindTableau les reconnaît
           sans rien ajouter côté JS (sélecteur data-open déjà élargi). -->
      <div class="factures-mobile-list">
        ${triees.length ? triees.map(f => this._htmlCarteMobile(f)).join('') : `<div class="card" style="color:var(--text-muted); text-align:center; padding:24px;">Aucune facture ${this._recherche ? 'ne correspond à cette recherche' : 'pour le moment'}.</div>`}
      </div>
    `;
  },

  // Carte mobile d'une facture (06/09/2026) — mêmes infos que la ligne
  // de tableau, réorganisées verticalement.
  _htmlCarteMobile(f) {
    const estBrouillon = f.statut === 'Brouillon';
    const estAnnulee = f.statut === 'Annulée';
    return `
      <div class="facture-mcard" data-open="${f.id}">
        <div class="facture-mcard-top">
          <span style="color:#8a8a8a; font-size:12px;">${this._formaterNumero(f)}</span>
          ${this._statutBadge(f.statut)}
        </div>
        <div class="facture-mcard-client">${this._nomClientAffiche(f)}${this._lienProjet(f)}${this._lienDevis(f)}</div>
        <div class="facture-mcard-libelle">${f.type} — ${this._libelleAffiche(f)}</div>
        <div class="facture-mcard-montants">
          <div><span class="devis-mcard-label">Montant</span><div class="facture-mcard-montant">${f.montant.toLocaleString('fr-FR')} €</div></div>
          <div><span class="devis-mcard-label">Payé</span><div class="facture-mcard-montant">${(f.montantPaye || 0).toLocaleString('fr-FR')} €</div></div>
          <div><span class="devis-mcard-label">Reste</span><div class="facture-mcard-montant">${this._resteAPayer(f).toLocaleString('fr-FR')} €</div></div>
        </div>
        <div class="devis-mcard-footer" onclick="event.stopPropagation()">
          <button class="btn-ghost" data-telecharger="${f.id}">👁 PDF</button>
          ${estBrouillon ? `<button class="btn-ghost" data-emettre="${f.id}">Émettre</button>` : '<span></span>'}
          ${estBrouillon
            ? `<button class="row-delete-btn" data-delete="${f.id}" title="Supprimer le brouillon">✕</button>`
            : (estAnnulee ? '<span></span>' : `<button class="row-delete-btn" data-annuler="${f.id}" title="Annuler la facture">⊘</button>`)}
        </div>
        ${(!estAnnulee && f.statut !== 'Payée') ? `
        <button class="btn-ghost facture-mcard-payee" data-marquer-payee="${f.id}" onclick="event.stopPropagation()">✓ Marquer payée</button>
        ` : ''}
      </div>
    `;
  },

  // Vue en lecture seule pour une facture Annulée (05/09/2026) — une
  // facture émise/annulée est un document comptable figé : pas de
  // formulaire d'édition, juste la consultation + le PDF (voir DEV_NOTES).
  _htmlLectureSeule(f) {
    return `
      <div class="modal-overlay" id="facture-modal-overlay">
        <div class="modal-box">
          <div class="modal-title">Facture ${this._formaterNumero(f)} — annulée</div>
          <div class="modal-field"><label>Client</label><div class="stat-sub">${f.client}${f.entreprise ? ` — ${f.entreprise}` : ''}</div></div>
          <div class="modal-field"><label>Détail</label><div class="stat-sub">${(f.lignes || []).map(l => `${l.description} — ${(l.montant || 0).toLocaleString('fr-FR')} €`).join('<br>')}</div></div>
          <div class="modal-field"><label>Montant</label><div class="stat-sub">${f.montant.toLocaleString('fr-FR')} €</div></div>
          <div class="modal-field"><label>Date</label><div class="stat-sub">${f.date}</div></div>
          <div class="stat-sub" style="margin-top:8px; color:#e08a8a;">Facture annulée — conservée dans l'historique, non modifiable. Son numéro (${this._formaterNumero(f)}) ne sera jamais réutilisé.</div>
          <div class="modal-actions" style="margin-top:16px;">
            <span></span>
            <div class="modal-actions-right">
              <button type="button" class="btn" id="facture-cancel-btn">Fermer</button>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  // `f` peut être une facture existante (édition, a un `id`), un objet de
  // pré-remplissage sans `id` (génération depuis Projets — voir
  // `_openForm`), ou rien (nouvelle facture vierge). Seul le cas "a un id"
  // doit afficher "Modifier"/le bouton Supprimer — un prefill reste une
  // création, pas une édition.
  //
  // Statut (05/09/2026) : plus de <select> Statut à choisir à la main. Une
  // case "Enregistrer comme brouillon" pilote l'état Brouillon ; sinon le
  // statut est recalculé automatiquement à partir de Montant/Montant payé
  // (voir `_recalculerStatut`). Coché par défaut pour une facture créée à
  // la main (sécurité — rien n'est "émis" par erreur), décoché quand la
  // facture vient d'un projet (le paiement est déjà réel à ce stade).
  // Une ligne : { description, montant, abonnementId, periode }. Pas de
  // label par ligne (mini en-tête au-dessus de la liste à la place) —
  // garde chaque ligne compacte sur une seule rangée.
  // Sélecteur produit du catalogue (05/09/2026, demande de Tiphaine —
  // avant, seul un libellé libre était possible, il fallait retaper le
  // prix à chaque fois même pour une offre déjà dans Tarifs). Choisir un
  // produit préremplit description + montant, mais les deux champs
  // restent modifiables ensuite (rien n'empêche d'ajuster après coup, ou
  // de garder "Libellé personnalisé" pour une ligne qui ne correspond à
  // aucune offre du catalogue).
  _htmlLigneFacture(l, i) {
    const catalogue = window.Modules.catalogue;
    const produits = (catalogue && catalogue._data) ? catalogue._data : [];
    return `
      <div class="facture-ligne-row" data-ligne-index="${i}" style="display:flex; flex-direction:column; gap:6px; margin-bottom:10px; padding:8px; background:var(--bg-input); border:1px solid var(--border-subtle); border-radius:9px;">
        ${produits.length ? `
        <select class="ligne-produit-select" style="background:var(--bg-page); border:1px solid var(--border-subtle); border-radius:7px; padding:7px 9px; color:var(--text-primary); font-family:inherit; font-size:12.5px;">
          <option value="">— Libellé personnalisé —</option>
          ${produits.map(p => `<option value="${p.id}">${p.nom} — ${p.prix.toLocaleString('fr-FR')} €${p.type === 'Abonnement' ? '/mois' : ''}</option>`).join('')}
        </select>` : ''}
        <div style="display:flex; gap:8px; align-items:center;">
          <input type="text" class="ligne-description" value="${(l.description || '').replace(/"/g, '&quot;')}" placeholder="Description" style="flex:2; background:var(--bg-page); border:1px solid var(--border-subtle); border-radius:9px; padding:9px 11px; color:var(--text-primary); font-family:inherit; font-size:13px;">
          <input type="number" class="ligne-montant" value="${l.montant || 0}" min="0" step="1" style="width:100px; background:var(--bg-page); border:1px solid var(--border-subtle); border-radius:9px; padding:9px 11px; color:var(--text-primary); font-family:inherit; font-size:13px;">
          <button type="button" class="btn-ghost" data-supprimer-ligne="${i}" style="padding:8px 10px; font-size:12px; border-radius:7px; flex-shrink:0;" title="Retirer cette ligne">✕</button>
        </div>
      </div>
    `;
  },

  _htmlLignesFacture(lignes) {
    return `
      ${lignes.map((l, i) => this._htmlLigneFacture(l, i)).join('')}
      <div style="display:flex; align-items:center; justify-content:space-between; margin-top:6px;">
        <button type="button" class="btn-ghost" id="facture-ajouter-ligne-btn" style="padding:6px 11px; font-size:12px; border-radius:7px;">+ Ajouter une ligne</button>
        <div style="font-weight:700; font-size:14px;">Total : <span id="facture-total-affiche">${this._totalLignes(lignes).toLocaleString('fr-FR')}</span> €</div>
      </div>
    `;
  },

  _formHtml(f) {
    const isEdit = !!(f && f.id);
    const clientsModule = window.Modules.clients;
    const clientsExistants = (clientsModule && clientsModule._data) ? clientsModule._data : [];
    const defauts = { type: 'Facture unique', client: '', entreprise: '', clientId: null, siretClient: '', adresseClient: '', emailClient: '', lignes: [{ description: '', montant: 0, abonnementId: null, periode: null }], montantPaye: 0, datePaiement: '', modePaiement: 'Virement', notePaiement: '', statut: 'Émise', date: new Date().toISOString().slice(0, 10), projetId: null, devisId: null };
    f = Object.assign({}, defauts, f || {});
    if (!f.lignes || !f.lignes.length) f.lignes = defauts.lignes;
    // `brouillonParDefaut` (optionnel, sur le prefill) permet à un appelant
    // (ex : modules/abonnements.js, "Facturer [mois]") de forcer la valeur
    // par défaut de la case — sinon, comportement historique : décochée si
    // la facture vient d'un projet (paiement déjà réel), cochée sinon.
    const brouillonCoche = isEdit
      ? (f.statut === 'Brouillon')
      : (f.brouillonParDefaut !== undefined ? f.brouillonParDefaut : !f.projetId);
    const modesPaiement = ['Virement', 'Carte bancaire', 'Espèces', 'Chèque', 'Autre'];
    return `
      <div class="modal-overlay" id="facture-modal-overlay">
        <div class="modal-box">
          <div class="modal-title">${isEdit ? 'Modifier la facture' : 'Nouvelle facture'}${isEdit ? ` — ${this._statutBadge(f.statut)}` : ''}</div>
          <form id="facture-form">
            ${clientsExistants.length ? `
            <div class="modal-field">
              <label>Reprendre un client existant (pré-remplit ses infos, tout reste modifiable)</label>
              <select id="facture-client-existant-select">
                <option value="">— Nouveau client / saisie libre —</option>
                ${clientsExistants.map(c => `<option value="${c.id}" ${f.clientId === c.id ? 'selected' : ''}>${c.nom}${c.entreprise ? ' — ' + c.entreprise : ''}</option>`).join('')}
              </select>
            </div>` : ''}
            <input type="hidden" name="clientId" id="facture-clientid-input" value="${f.clientId || ''}">
            ${f.projetId ? `<div class="modal-field" style="font-size:12.5px; color:var(--text-secondary);">Générée depuis le projet <a href="#" id="facture-voir-projet-lien" style="color:var(--text-secondary); text-decoration:underline;">→</a></div>` : ''}
            ${f.devisId ? `<div class="modal-field" style="font-size:12.5px; color:var(--text-secondary);">Générée depuis le devis <a href="#" id="facture-voir-devis-lien" style="color:var(--text-secondary); text-decoration:underline;">→</a></div>` : ''}
            <div class="modal-field">
              <label>Client${f.clientId ? ' — <a href="#" id="facture-voir-client-lien" style="color:var(--text-secondary); font-weight:400;">voir la fiche client →</a>' : ''}</label>
              <input type="text" name="client" id="facture-client-input" value="${f.client}" required autofocus>
            </div>
            <div class="modal-field">
              <label>Entreprise cliente</label>
              <input type="text" name="entreprise" id="facture-entreprise-input" value="${f.entreprise || ''}">
            </div>
            <div class="modal-field">
              <label>SIRET (entreprise cliente)</label>
              <input type="text" name="siretClient" id="facture-siret-input" value="${f.siretClient || ''}" placeholder="ex : 123 456 789 00012">
            </div>
            <div class="modal-field">
              <label>Adresse (entreprise cliente)</label>
              <input type="text" name="adresseClient" id="facture-adresse-input" value="${f.adresseClient || ''}" placeholder="N° et rue, code postal, ville">
            </div>
            <div class="modal-field">
              <label>Email client</label>
              <input type="email" name="emailClient" id="facture-email-input" value="${f.emailClient || ''}">
            </div>
            <div class="modal-field">
              <label>Type</label>
              <select name="type">
                ${this._types.map(t => `<option value="${t}" ${t === f.type ? 'selected' : ''}>${t}</option>`).join('')}
              </select>
            </div>
            <div class="modal-field">
              <label>Détail de la facture (une ou plusieurs lignes — ex : solde d'un forfait + 1er mois d'un abonnement)</label>
              <div id="facture-lignes-zone">${this._htmlLignesFacture(f.lignes)}</div>
            </div>
            <div class="modal-field">
              <label>Date</label>
              <input type="date" name="date" value="${f.date}">
            </div>

            ${(!isEdit || f.statut === 'Brouillon') ? `
            <label class="devis-paye-label"><input type="checkbox" name="brouillon" ${brouillonCoche ? 'checked' : ''}> Enregistrer comme brouillon (modifiable et supprimable librement, pas encore émise)</label>
            ` : ''}

            <!-- Suivi de paiement (05/09/2026) — montant payé + reste à payer
                 calculé, plutôt qu'une simple case Émise/Payée. Le statut
                 (Émise/Partiellement payée/Payée) est déduit automatiquement
                 de ces deux champs, jamais choisi à la main. -->
            <div class="modal-field">
              <label>Montant déjà payé (€)</label>
              <input type="number" name="montantPaye" id="facture-montantpaye-input" value="${f.montantPaye || 0}" min="0" step="1">
            </div>
            <div class="modal-field">
              <label>Date du paiement</label>
              <input type="date" name="datePaiement" value="${f.datePaiement || ''}">
            </div>
            <div class="modal-field">
              <label>Moyen de paiement</label>
              <select name="modePaiement">
                ${modesPaiement.map(m => `<option value="${m}" ${m === f.modePaiement ? 'selected' : ''}>${m}</option>`).join('')}
              </select>
            </div>
            <div class="modal-field">
              <label>Note (optionnel)</label>
              <input type="text" name="notePaiement" value="${f.notePaiement || ''}" placeholder="Ex : acompte reçu par virement le 3">
            </div>

            <div class="modal-actions">
              ${isEdit
                ? (f.statut === 'Brouillon'
                    ? `<button type="button" class="btn btn-danger" id="facture-delete-btn">Supprimer le brouillon</button>`
                    : `<button type="button" class="btn btn-danger" id="facture-annuler-btn">Annuler la facture</button>`)
                : `<span></span>`}
              <div class="modal-actions-right">
                <button type="button" class="btn btn-ghost" id="facture-cancel-btn">Fermer</button>
                <button type="submit" class="btn">${isEdit ? 'Enregistrer' : 'Ajouter'}</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  // `prefill` (optionnel) — utilisé par projets.js pour pré-remplir une
  // nouvelle facture (client/montant/libellé/projetId) depuis un projet,
  // sans avoir à tout ressaisir.
  // `onSaved` (optionnel, 05/09/2026) — rappelé après un enregistrement
  // RÉUSSI (création ou édition), jamais si la modal est fermée sans
  // valider. Permet à l'appelant (Devis, Projets) de rafraîchir sa propre
  // page pour refléter l'état réel (ex : faire réapparaître le bouton
  // "Acompte" si la facture n'a finalement pas été créée) — voir le bug
  // corrigé le même jour : avant, Devis/Projets marquaient "facture
  // générée" dès le clic sur "Générer la facture", AVANT même que la
  // modal soit validée ; annuler la modal laissait le bouton caché pour
  // de bon. Le statut "facture déjà générée" est maintenant calculé en
  // direct à partir des vraies factures (voir `devis._factureExistePour`),
  // jamais stocké dans un flag qui peut se désynchroniser.
  async _openForm(facture, prefill, onSaved) {
    // Sécurité (05/09/2026) : `_openForm` peut être appelé par un autre
    // module (Projets, Abonnements) avant que la page Factures n'ait
    // jamais été ouverte cette session — `this._data` serait alors encore
    // `null`, et le submit plus bas planterait sur `this._data.push`.
    if (!this._data) this._data = window.FIREBASE_READY ? [] : this._mock();

    // Facture annulée = document figé, conservé pour l'historique — vue
    // lecture seule uniquement, jamais le formulaire d'édition (05/09/2026).
    if (facture && facture.statut === 'Annulée') {
      const wrapLecture = document.createElement('div');
      wrapLecture.innerHTML = this._htmlLectureSeule(facture);
      document.body.appendChild(wrapLecture.firstElementChild);
      const overlayLecture = document.getElementById('facture-modal-overlay');
      const closeLecture = () => overlayLecture.remove();
      let mdSurOverlay = false;
      overlayLecture.addEventListener('mousedown', (e) => { mdSurOverlay = (e.target === overlayLecture); });
      overlayLecture.addEventListener('click', (e) => { if (e.target === overlayLecture && mdSurOverlay) closeLecture(); });
      document.getElementById('facture-cancel-btn').addEventListener('click', closeLecture);
      return;
    }

    const clientsModule = window.Modules.clients;
    if (clientsModule && !clientsModule._data) {
      clientsModule._data = window.FIREBASE_READY && clientsModule._fetchReal ? await clientsModule._fetchReal() : (clientsModule._mock ? clientsModule._mock() : []);
    }
    // Catalogue (05/09/2026) — pour le sélecteur "produit" par ligne, au
    // cas où Tarifs n'a jamais été ouvert cette session.
    const catalogueModule = window.Modules.catalogue;
    if (catalogueModule && !catalogueModule._data) {
      catalogueModule._data = window.FIREBASE_READY && catalogueModule._fetchReal ? await catalogueModule._fetchReal() : (catalogueModule._mock ? catalogueModule._mock() : []);
    }

    const wrap = document.createElement('div');
    wrap.innerHTML = this._formHtml(facture || prefill);
    document.body.appendChild(wrap.firstElementChild);
    const overlay = document.getElementById('facture-modal-overlay');
    const close = () => overlay.remove();

    let mousedownSurOverlay = false;
    overlay.addEventListener('mousedown', (e) => { mousedownSurOverlay = (e.target === overlay); });
    overlay.addEventListener('click', (e) => { if (e.target === overlay && mousedownSurOverlay) close(); });
    document.getElementById('facture-cancel-btn').addEventListener('click', close);

    const clientExistantSelect = document.getElementById('facture-client-existant-select');
    if (clientExistantSelect) {
      clientExistantSelect.addEventListener('change', (e) => {
        const id = e.target.value ? Number(e.target.value) : null;
        document.getElementById('facture-clientid-input').value = id || '';
        if (!id) return;
        const c = (clientsModule._data || []).find(x => x.id === id);
        if (!c) return;
        document.getElementById('facture-client-input').value = c.nom || '';
        document.getElementById('facture-entreprise-input').value = c.entreprise || '';
        document.getElementById('facture-siret-input').value = c.siret || '';
        document.getElementById('facture-adresse-input').value = c.adresse || '';
        document.getElementById('facture-email-input').value = c.email || '';
      });
    }
    const voirClientLien = document.getElementById('facture-voir-client-lien');
    if (voirClientLien) {
      voirClientLien.addEventListener('click', (e) => {
        e.preventDefault();
        const id = Number(document.getElementById('facture-clientid-input').value);
        if (id) { close(); window.ouvrirFiche('clients', id); }
      });
    }
    const voirProjetLien = document.getElementById('facture-voir-projet-lien');
    if (voirProjetLien && (facture || prefill) && (facture || prefill).projetId) {
      voirProjetLien.addEventListener('click', (e) => {
        e.preventDefault();
        const pid = (facture || prefill).projetId;
        close();
        window.ouvrirFiche('projets', pid);
      });
    }
    const voirDevisLien = document.getElementById('facture-voir-devis-lien');
    if (voirDevisLien && (facture || prefill) && (facture || prefill).devisId) {
      voirDevisLien.addEventListener('click', (e) => {
        e.preventDefault();
        const did = (facture || prefill).devisId;
        close();
        window.ouvrirFiche('devis', did);
      });
    }

    // ── Lignes multiples (05/09/2026) — gérées en mémoire (`lignesEnCours`)
    // et régénérées SEULEMENT dans `#facture-lignes-zone` (jamais tout le
    // formulaire) à chaque ajout/suppression, pour ne jamais perdre les
    // autres champs déjà remplis (client, dates...) — même principe que la
    // recherche isolée déjà utilisée ailleurs dans l'app.
    const source = facture || prefill;
    let lignesEnCours = (source && Array.isArray(source.lignes) && source.lignes.length)
      ? source.lignes.map(l => Object.assign({ description: '', montant: 0, abonnementId: null, periode: null }, l))
      : [{ description: '', montant: 0, abonnementId: null, periode: null }];

    const zoneLignes = document.getElementById('facture-lignes-zone');

    const syncLignesDepuisDOM = () => {
      zoneLignes.querySelectorAll('.facture-ligne-row').forEach((row, i) => {
        if (!lignesEnCours[i]) return;
        lignesEnCours[i].description = row.querySelector('.ligne-description').value;
        lignesEnCours[i].montant = parseInt(row.querySelector('.ligne-montant').value || '0', 10);
      });
    };

    const majTotalAffiche = () => {
      let total = 0;
      zoneLignes.querySelectorAll('.ligne-montant').forEach(input => { total += parseInt(input.value || '0', 10); });
      const el = document.getElementById('facture-total-affiche');
      if (el) el.textContent = total.toLocaleString('fr-FR');
    };

    const bindLignesUI = () => {
      zoneLignes.querySelectorAll('.ligne-montant').forEach(input => {
        input.addEventListener('input', majTotalAffiche);
      });
      // Sélection d'un produit du catalogue (05/09/2026) — préremplit
      // description + montant de LA LIGNE de ce sélecteur uniquement ;
      // "— Libellé personnalisé —" (value vide) ne touche à rien, pour ne
      // pas écraser un libellé déjà tapé à la main.
      zoneLignes.querySelectorAll('.ligne-produit-select').forEach(sel => {
        sel.addEventListener('change', () => {
          const id = sel.value ? Number(sel.value) : null;
          if (!id) return;
          const catalogue = window.Modules.catalogue;
          const p = catalogue && catalogue._data ? catalogue._data.find(x => x.id === id) : null;
          if (!p) return;
          const row = sel.closest('.facture-ligne-row');
          row.querySelector('.ligne-description').value = p.nom;
          row.querySelector('.ligne-montant').value = p.prix;
          majTotalAffiche();
        });
      });
      const ajouterBtn = document.getElementById('facture-ajouter-ligne-btn');
      if (ajouterBtn) ajouterBtn.addEventListener('click', () => {
        syncLignesDepuisDOM();
        lignesEnCours.push({ description: '', montant: 0, abonnementId: null, periode: null });
        rerenderLignes();
      });
      zoneLignes.querySelectorAll('[data-supprimer-ligne]').forEach(btn => {
        btn.addEventListener('click', () => {
          syncLignesDepuisDOM();
          if (lignesEnCours.length <= 1) {
            // Toujours garder au moins une ligne — on la vide plutôt que de
            // la retirer, pour ne jamais se retrouver sans aucune ligne.
            lignesEnCours[0] = { description: '', montant: 0, abonnementId: null, periode: null };
          } else {
            lignesEnCours.splice(Number(btn.dataset.supprimerLigne), 1);
          }
          rerenderLignes();
        });
      });
    };

    const rerenderLignes = () => {
      zoneLignes.innerHTML = this._htmlLignesFacture(lignesEnCours);
      bindLignesUI();
    };

    bindLignesUI();

    // Brouillon : suppression réelle possible (rien n'a encore de valeur
    // légale). Ce bouton n'existe dans le HTML que si `facture.statut ===
    // 'Brouillon'` (voir `_formHtml`).
    const deleteBtn = document.getElementById('facture-delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        window.confirmerAction('Supprimer ce brouillon de facture ?', () => {
          this._data = this._data.filter(x => x.id !== facture.id);
          // TODO Firebase : window.db.collection('factures').doc(facture.id).delete()
          close();
          this.render(this._root);
        });
      });
    }

    // Facture émise/partiellement payée/payée : plus de suppression, on
    // passe par "Annuler" (05/09/2026) — le numéro reste définitivement
    // associé à cette facture (jamais réattribué, puisqu'elle reste dans
    // `this._data`) et la facture reste consultable dans l'historique.
    const annulerBtn = document.getElementById('facture-annuler-btn');
    if (annulerBtn) {
      annulerBtn.addEventListener('click', () => {
        window.confirmerAction(
          `Annuler la facture ${this._formaterNumero(facture)} ? Elle restera visible dans l'historique mais ne comptera plus dans les indicateurs financiers. Cette action ne peut pas être défaite (pas de suppression possible sur une facture émise).`,
          () => {
            facture.statut = 'Annulée';
            facture.modifieLe = this._dateHeureLocale(new Date());
            close();
            this.render(this._root);
          },
          { titre: 'Annuler la facture', texteBouton: 'Annuler la facture' }
        );
      });
    }

    document.getElementById('facture-form').addEventListener('submit', (e) => {
      e.preventDefault();
      syncLignesDepuisDOM();
      // Lignes vides (ni description ni montant) retirées à la validation —
      // évite de garder des lignes fantômes créées puis laissées vides.
      const lignesValides = lignesEnCours.filter(l => (l.description || '').trim() || l.montant);
      if (!lignesValides.length) { alert('Ajoute au moins une ligne avec une description ou un montant.'); return; }

      const fd = new FormData(e.target);
      const payload = {
        client: fd.get('client').trim(),
        entreprise: fd.get('entreprise').trim(),
        clientId: fd.get('clientId') ? Number(fd.get('clientId')) : null,
        siretClient: fd.get('siretClient').trim(),
        adresseClient: fd.get('adresseClient').trim(),
        emailClient: fd.get('emailClient').trim(),
        type: fd.get('type'),
        lignes: lignesValides,
        montant: this._totalLignes(lignesValides),
        libelle: this._libelleAffiche({ lignes: lignesValides }), // conservé pour compat/affichage rapide
        montantPaye: parseInt(fd.get('montantPaye') || '0', 10),
        datePaiement: fd.get('datePaiement'),
        modePaiement: fd.get('modePaiement'),
        notePaiement: fd.get('notePaiement').trim(),
        date: fd.get('date'),
      };
      if (!payload.client) return;
      const brouillonCoche = fd.get('brouillon') === 'on';

      if (facture) {
        Object.assign(facture, payload);
        if (brouillonCoche) {
          facture.statut = 'Brouillon';
        } else {
          if (facture.statut === 'Brouillon') facture.statut = 'Émise'; // sortie de brouillon
          this._recalculerStatut(facture);
          this._repercuterSurProjet(facture);
        }
        facture.modifieLe = this._dateHeureLocale(new Date());
        // TODO Firebase : window.db.collection('factures').doc(facture.id).update(payload)
      } else {
        const nouvelle = { id: Date.now(), numero: this._prochainNumero(), statut: brouillonCoche ? 'Brouillon' : 'Émise', projetId: (prefill && prefill.projetId) || null, devisId: (prefill && prefill.devisId) || null, modifieLe: null, ...payload };
        if (!brouillonCoche) { this._recalculerStatut(nouvelle); this._repercuterSurProjet(nouvelle); }
        this._data.push(nouvelle);
        // TODO Firebase : window.db.collection('factures').add(nouvelle)
      }
      close();
      this.render(this._root);
      if (onSaved) onSaved();
    });
  },

  _formatMontant(n) {
    const espacesSpeciaux = new RegExp('[' + String.fromCharCode(0x00A0) + String.fromCharCode(0x202F) + ']', 'g');
    return n.toLocaleString('fr-FR').replace(espacesSpeciaux, ' ') + ' €';
  },

  async _chargerLogoDataUrl() {
    return window.LOGO_BASE64 || null;
  },

  _dimensionsImage(dataUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  },

  _hauteurBloc(doc, lignes, maxWidth, interligne = 5) {
    return lignes.filter(Boolean).reduce((total, ligne) => {
      const nbLignes = doc.splitTextToSize(String(ligne), maxWidth).length;
      return total + nbLignes * interligne;
    }, 0);
  },

  _ecrireBloc(doc, lignes, x, yDepart, maxWidth, interligne = 5) {
    let y = yDepart;
    lignes.filter(Boolean).forEach((ligne) => {
      const morceaux = doc.splitTextToSize(String(ligne), maxWidth);
      doc.text(morceaux, x, y);
      y += morceaux.length * interligne;
    });
    return y;
  },

  _formatDate(iso) {
    if (!iso) return '';
    const [y, m, day] = iso.split('-');
    return `${day}/${m}/${y}`;
  },

  // ── Génération du PDF (jsPDF, même identité visuelle que devis.js —
  // bande noire, logo, badge numéro — mais sans bloc "Bon pour accord"
  // (pas de signature attendue sur une facture) ni annexe CGV (déjà
  // acceptées au stade du devis). Mentions légales de facturation en pied
  // de page à la place : échéance, pénalités de retard, indemnité de
  // recouvrement (même texte que le devis, article 4 des CGV, pour rester
  // robuste si le taux légal évolue).
  async _construirePdf(factureId) {
    const f = this._data.find(x => x.id === factureId);
    if (!f) return null;
    this._migrerLignes(f);
    if (!window.jspdf) { alert("La librairie PDF n'est pas encore chargée — réessaie dans une seconde."); return null; }

    const catalogue = window.Modules.catalogue;
    const e = catalogue ? catalogue._getEntreprise() : { nom: 'Tiphaine Bénard', siret: '', adresse: '', email: '', mentionTva: 'TVA non applicable, art. 293 B du CGI.' };

    const clientsModule = window.Modules.clients;
    if (clientsModule && !clientsModule._data) {
      clientsModule._data = window.FIREBASE_READY && clientsModule._fetchReal ? await clientsModule._fetchReal() : (clientsModule._mock ? clientsModule._mock() : []);
    }
    const clientCorrespondant = (clientsModule && clientsModule._data)
      ? clientsModule._data.find(c => c.nom === f.client || (f.entreprise && c.entreprise === f.entreprise))
      : null;
    const infosClient = {
      entreprise: f.entreprise || (clientCorrespondant && clientCorrespondant.entreprise) || '',
      siret: f.siretClient || (clientCorrespondant && clientCorrespondant.siret) || '',
      adresse: f.adresseClient || (clientCorrespondant && clientCorrespondant.adresse) || '',
      email: f.emailClient || (clientCorrespondant && clientCorrespondant.email) || '',
    };

    const logoDataUrl = await this._chargerLogoDataUrl();
    const logoDims = logoDataUrl ? await this._dimensionsImage(logoDataUrl) : null;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const noir = [15, 15, 15];
    const gris = [120, 120, 120];
    const grisClair = [242, 242, 242];
    const ML = 20, MR = 190;

    doc.setFillColor(...noir);
    doc.rect(0, 0, 6, 297, 'F');

    let basHeaderGauche = 30;
    if (logoDataUrl && logoDims) {
      const largeurMax = 80, hauteurMax = 42;
      const echelle = Math.min(largeurMax / logoDims.w, hauteurMax / logoDims.h);
      const largeurLogo = logoDims.w * echelle;
      const hauteurLogo = logoDims.h * echelle;
      doc.addImage(logoDataUrl, 'PNG', ML, 12, largeurLogo, hauteurLogo);
      doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(...gris);
      const yTagline = 12 + hauteurLogo + 6;
      doc.text('Développement web & applications sur mesure', ML, yTagline);
      basHeaderGauche = yTagline;
    } else {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(...noir);
      doc.text('TIPHAINE BÉNARD', ML, 26);
      doc.setFont('helvetica', 'italic'); doc.setFontSize(9.5); doc.setTextColor(...gris);
      doc.text('Développement web & applications sur mesure', ML, 32);
      basHeaderGauche = 32;
    }

    doc.setFont('helvetica', 'bold'); doc.setFontSize(28); doc.setTextColor(...noir);
    doc.text('FACTURE', MR, 26, { align: 'right' });

    const numeroTxt = this._formaterNumero(f);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    const largeurBadge = doc.getTextWidth(numeroTxt) + 8;
    doc.setFillColor(...noir);
    doc.roundedRect(MR - largeurBadge, 30, largeurBadge, 7, 1.5, 1.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text(numeroTxt, MR - largeurBadge / 2, 34.7, { align: 'center' });

    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...gris);
    doc.text(`Émise le ${this._formatDate(f.date)}`, MR, 42, { align: 'right' });
    let mentionCoin = 'Paiement à réception';
    if (f.statut === 'Payée') mentionCoin = 'Payée';
    else if (f.statut === 'Partiellement payée') mentionCoin = 'Partiellement payée';
    else if (f.statut === 'Annulée') mentionCoin = 'ANNULÉE';
    doc.text(mentionCoin, MR, 46.5, { align: 'right' });

    const yLigneSeparation = Math.max(54, basHeaderGauche + 4);
    doc.setDrawColor(15, 15, 15);
    doc.setLineWidth(0.8);
    doc.line(ML, yLigneSeparation, MR, yLigneSeparation);
    doc.setLineWidth(0.2);

    const yCartes = yLigneSeparation + 8;
    const largeurCarte = (MR - ML - 6) / 2;
    const padCarte = 6;
    const largeurTexteCarte = largeurCarte - padCarte * 2;
    const xClient = ML + largeurCarte + 6 + padCarte;

    const lignesPrestataire = [e.nom || 'Tiphaine Bénard', e.adresse, e.siret ? `SIRET : ${e.siret}` : null, e.email];
    const lignesClient = [infosClient.entreprise || f.client, infosClient.entreprise ? f.client : null, infosClient.adresse, infosClient.siret ? `SIRET : ${infosClient.siret}` : null, infosClient.email];

    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    const hauteurCarte = 14 + Math.max(
      this._hauteurBloc(doc, lignesPrestataire, largeurTexteCarte),
      this._hauteurBloc(doc, lignesClient, largeurTexteCarte),
      20
    ) + 6;

    doc.setFillColor(...grisClair);
    doc.roundedRect(ML, yCartes, largeurCarte, hauteurCarte, 2, 2, 'F');
    doc.roundedRect(ML + largeurCarte + 6, yCartes, largeurCarte, hauteurCarte, 2, 2, 'F');

    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...gris);
    doc.text('PRESTATAIRE', ML + padCarte, yCartes + 7);
    doc.text('CLIENT', xClient, yCartes + 7);

    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...noir);
    this._ecrireBloc(doc, lignesPrestataire, ML + padCarte, yCartes + 14, largeurTexteCarte);
    this._ecrireBloc(doc, lignesClient, xClient, yCartes + 14, largeurTexteCarte);

    // ── Tableau prestation facturée (05/09/2026 : une ligne par élément de
    // `f.lignes` — hauteur de chaque ligne calculée avant de rien dessiner,
    // avec saut de page si besoin, même logique anti-chevauchement que
    // partout ailleurs dans ce PDF/devis.js). ────────────────────────────
    const largeurTable = MR - ML;
    let y = yCartes + hauteurCarte + 12;
    const largeurDescription = largeurTable * 0.7;
    const lignesAFacturer = (f.lignes && f.lignes.length) ? f.lignes : [{ description: f.libelle || f.type || '', montant: f.montant }];

    y = this._assurerPage(doc, y, 10 + 13, noir);
    doc.setFillColor(...noir);
    doc.rect(ML, y, largeurTable, 10, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
    doc.text('PRESTATION FACTURÉE', ML + 4, y + 6.7);
    doc.text('MONTANT', MR - 2, y + 6.7, { align: 'right' });
    y += 10;

    lignesAFacturer.forEach((ligne) => {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5);
      const lignesTexte = doc.splitTextToSize(String(ligne.description || ''), largeurDescription);
      const hauteurLigne = Math.max(11, 6 + lignesTexte.length * 5);
      y = this._assurerPage(doc, y, hauteurLigne, noir);
      doc.setDrawColor(225, 225, 225);
      doc.rect(ML, y, largeurTable, hauteurLigne);
      doc.setTextColor(...noir); doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5);
      doc.text(lignesTexte, ML + 4, y + 7.5);
      doc.text(this._formatMontant(ligne.montant || 0), MR - 2, y + 7.5, { align: 'right' });
      y += hauteurLigne;
    });

    y = this._assurerPage(doc, y, 12 + 8, noir);
    doc.setFillColor(...noir);
    doc.rect(ML, y, largeurTable, 12, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    doc.text('NET À PAYER', ML + 4, y + 8);
    doc.text(this._formatMontant(f.montant), MR - 2, y + 8, { align: 'right' });
    y += 12;

    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...gris);
    // Paiement partiel (05/09/2026) — affiche déjà réglé/reste à payer plutôt
    // qu'un simple statut binaire Émise/Payée.
    let texteStatutPaiement;
    if (f.statut === 'Payée') texteStatutPaiement = 'Facture réglée — merci.';
    else if (f.statut === 'Partiellement payée') texteStatutPaiement = `Déjà réglé : ${this._formatMontant(f.montantPaye || 0)} — Reste à payer : ${this._formatMontant(this._resteAPayer(f))}.`;
    else if (f.statut === 'Annulée') texteStatutPaiement = 'Facture annulée.';
    else texteStatutPaiement = 'Paiement à réception de facture, par virement bancaire.';
    doc.text(texteStatutPaiement, ML, y + 8);

    // ── Coordonnées bancaires ────────────────────────────────────────
    y += 20;
    const lignesBanque = [e.titulaireCompte, e.banque, e.iban ? `IBAN : ${e.iban}` : null, e.bic ? `BIC : ${e.bic}` : null];
    if (e.iban) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      const hauteurBanque = 13 + this._hauteurBloc(doc, lignesBanque, largeurTable - 10) + 6;
      y = this._assurerPage(doc, y, hauteurBanque + 14, noir);
      doc.setFillColor(...grisClair);
      doc.roundedRect(ML, y, 84, hauteurBanque, 2, 2, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...gris);
      doc.text('COORDONNÉES BANCAIRES', ML + 5, y + 7);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...noir);
      this._ecrireBloc(doc, lignesBanque, ML + 5, y + 13, 84 - 10);
      y += hauteurBanque;
    }

    // ── Mentions légales obligatoires (facturation entre professionnels) ─
    const yLigneFooter = Math.max(255, y + 10);
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.3);
    doc.line(ML, yLigneFooter, MR, yLigneFooter);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...gris);
    let yFooter = yLigneFooter + 5;
    doc.text(e.mentionTva || 'TVA non applicable, art. 293 B du CGI.', ML, yFooter);
    yFooter += 4;
    doc.text('Aucun escompte pour paiement anticipé. Conformément à la loi, tout retard de paiement entraîne de plein droit l\'exigibilité d\'une pénalité de retard (taux : trois fois le taux d\'intérêt légal, sans pouvoir être inférieur au taux minimal légal applicable entre professionnels) ainsi qu\'une indemnité forfaitaire de 40 € pour frais de recouvrement.', ML, yFooter, { maxWidth: MR - ML });

    const nomPourFichier = infosClient.entreprise || f.client || 'client';
    const nomFichier = `Facture_${nomPourFichier.replace(/\s+/g, '_')}_${f.date}.pdf`;
    return { doc, nomFichier };
  },

  _assurerPage(doc, y, hauteurNecessaire, noir) {
    const limiteBas = 280;
    if (y + hauteurNecessaire <= limiteBas) return y;
    doc.addPage();
    doc.setFillColor(...noir);
    doc.rect(0, 0, 6, 297, 'F');
    return 20;
  },

  async _apercuPdf(factureId) {
    const resultat = await this._construirePdf(factureId);
    if (!resultat) return;
    const { doc, nomFichier } = resultat;
    const url = doc.output('bloburl');

    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="modal-overlay" id="apercu-facture-overlay">
        <div class="modal-box" style="max-width:820px; width:92vw; height:88vh; display:flex; flex-direction:column;">
          <div class="modal-title">Aperçu de la facture</div>
          <iframe src="${url}" style="flex:1; width:100%; border:1px solid #262626; border-radius:8px; margin-bottom:10px; background:#fff;"></iframe>
          <div class="modal-actions">
            <span></span>
            <div class="modal-actions-right">
              <button type="button" class="btn btn-ghost" id="apercu-facture-fermer-btn">Fermer</button>
              <button type="button" class="btn" id="apercu-facture-telecharger-btn">↓ Télécharger le PDF</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(wrap.firstElementChild);
    const overlay = document.getElementById('apercu-facture-overlay');
    const close = () => { overlay.remove(); URL.revokeObjectURL(url); };

    let mousedownSurOverlay = false;
    overlay.addEventListener('mousedown', (e) => { mousedownSurOverlay = (e.target === overlay); });
    overlay.addEventListener('click', (e) => { if (e.target === overlay && mousedownSurOverlay) close(); });
    document.getElementById('apercu-facture-fermer-btn').addEventListener('click', close);
    document.getElementById('apercu-facture-telecharger-btn').addEventListener('click', () => {
      doc.save(nomFichier);
    });
  },

  _bindTableau(zone) {
    // Sélecteur générique (06/09/2026) — reconnaît aussi bien la ligne de
    // tableau (desktop) que la carte mobile (.facture-mcard), mêmes
    // attributs data-*, même pattern que devis.js.
    zone.querySelectorAll('[data-open]').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('[data-telecharger]') || e.target.closest('[data-delete]') || e.target.closest('[data-emettre]') || e.target.closest('[data-annuler]') || e.target.closest('[data-marquer-payee]') || e.target.closest('[data-voir-client]') || e.target.closest('[data-voir-projet]') || e.target.closest('[data-voir-devis]')) return;
        const id = Number(row.dataset.open);
        const f = this._data.find(x => x.id === id);
        if (f) this._openForm(f);
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
    zone.querySelectorAll('[data-voir-projet]').forEach(lien => {
      lien.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = Number(lien.dataset.voirProjet);
        if (id) window.ouvrirFiche('projets', id);
      });
    });
    zone.querySelectorAll('[data-voir-devis]').forEach(lien => {
      lien.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = Number(lien.dataset.voirDevis);
        if (id) window.ouvrirFiche('devis', id);
      });
    });

    zone.querySelectorAll('[data-telecharger]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._apercuPdf(Number(btn.dataset.telecharger));
      });
    });

    // Brouillon → suppression réelle possible (05/09/2026).
    zone.querySelectorAll('[data-delete]').forEach(delBtn => {
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number(delBtn.dataset.delete);
        window.confirmerAction('Supprimer ce brouillon de facture ?', () => {
          this._data = this._data.filter(x => x.id !== id);
          this.render(this._root);
        });
      });
    });

    // Brouillon → "Émettre" directement depuis le tableau, sans ouvrir le
    // formulaire (05/09/2026) — sort du brouillon, statut recalculé à partir
    // du montant payé déjà renseigné (souvent 0 → Émise).
    zone.querySelectorAll('[data-emettre]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number(btn.dataset.emettre);
        const f = this._data.find(x => x.id === id);
        if (!f) return;
        window.confirmerAction(`Émettre la facture ${this._formaterNumero(f)} ? Elle ne pourra plus être supprimée (seulement annulée).`, () => {
          f.statut = 'Émise';
          this._recalculerStatut(f);
          this.render(this._root);
        }, { titre: 'Émettre la facture', texteBouton: 'Émettre', danger: false });
      });
    });

    // "Marquer payée" directement depuis le tableau (05/09/2026, retour de
    // Tiphaine) — passe montantPaye au montant total, statut recalculé
    // (→ Payée). Si la facture vient d'un projet (Acompte/Solde), la case
    // correspondante sur ce projet est cochée automatiquement (sens
    // inverse du lien déjà existant Projets → Factures, voir
    // modules/projets.js `_marquerPaiement`) pour ne jamais désynchroniser
    // les deux vues d'un même paiement.
    zone.querySelectorAll('[data-marquer-payee]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number(btn.dataset.marquerPayee);
        const f = this._data.find(x => x.id === id);
        if (!f) return;
        window.confirmerAction(
          `Marquer la facture ${this._formaterNumero(f)} comme payée (${f.montant.toLocaleString('fr-FR')} €) ?`,
          () => {
            f.montantPaye = f.montant;
            if (!f.datePaiement) f.datePaiement = new Date().toISOString().slice(0, 10);
            if (f.statut === 'Brouillon') f.statut = 'Émise';
            this._recalculerStatut(f);
            f.modifieLe = this._dateHeureLocale(new Date());
            this._repercuterSurProjet(f);
            this.render(this._root);
          },
          { titre: 'Marquer payée', texteBouton: 'Marquer payée', danger: false }
        );
      });
    });

    // Émise/partiellement payée/payée → plus de suppression, seulement
    // "Annuler" (voir aussi le même bouton dans le formulaire).
    zone.querySelectorAll('[data-annuler]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number(btn.dataset.annuler);
        const f = this._data.find(x => x.id === id);
        if (!f) return;
        window.confirmerAction(
          `Annuler la facture ${this._formaterNumero(f)} ? Elle restera visible dans l'historique mais ne comptera plus dans les indicateurs financiers. Cette action ne peut pas être défaite.`,
          () => {
            f.statut = 'Annulée';
            f.modifieLe = this._dateHeureLocale(new Date());
            this.render(this._root);
          },
          { titre: 'Annuler la facture', texteBouton: 'Annuler la facture' }
        );
      });
    });
  },

  _bindEvents(container) {
    const addBtn = container.querySelector('#add-facture-btn');
    if (addBtn) addBtn.addEventListener('click', () => this._openForm(null));

    this._bindTableau(container);
  },
};

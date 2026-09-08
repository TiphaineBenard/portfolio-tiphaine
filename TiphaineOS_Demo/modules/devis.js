/* ═══════════════════════════════════════════════════════════
   MODULE DEVIS — liste + formulaire modal (montant pré-rempli
   depuis le catalogue/Tarifs — modules/catalogue.js — toujours
   modifiable). Génère un vrai PDF téléchargeable (noir et blanc,
   mentions légales). "Convertir en projet" quand le devis est
   Accepté (voir modules/projets.js). TODO Firebase pour la
   persistance.
═══════════════════════════════════════════════════════════ */

window.Modules = window.Modules || {};

window.Modules.devis = {
  _data: null,
  _statuts: ['Brouillon', 'Envoyé', 'Accepté', 'Refusé'],
  // Tri courant du tableau (03/09/2026) — colonne + sens, cliquable
  // depuis les en-têtes. `null` = ordre par défaut (plus récent créé
  // en premier, sur `numero`).
  _tri: { colonne: null, sens: 'desc' },
  // Filtre par statut (03/09/2026) — `null` = pas de filtre (tout
  // affiché), sinon un Set des statuts à garder. Popover ouvert via le
  // bouton entonnoir à côté de "+ Nouveau devis".
  _filtreStatuts: null,
  _filtreOuvert: false,

  // Date+heure locale lisible ("2026-09-03 14:32") pour horodater les
  // modifications — jamais `.toISOString()` (décale selon le fuseau,
  // règle du projet, voir modules/temps.js `_dateLocale`).
  _dateHeureLocale(d) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },
  _dateLocaleCourte(d) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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

  // Liste des offres proposées, tirée du catalogue (modules/catalogue.js) —
  // si tu retires une offre là-bas, elle disparaît d'ici automatiquement.
  // Plus de fallback "X sur mesure" codé en dur (05/09/2026) : le champ
  // libellé est maintenant toujours un texte libre juste en dessous du
  // select (voir `_formHtml`/`_openForm`), donc un devis one-off qui ne
  // correspond à aucune offre du catalogue se tape directement là.
  _offresDisponibles() {
    const catalogue = window.Modules.catalogue;
    if (catalogue && !catalogue._data) catalogue._data = catalogue._mock();
    const offres = catalogue ? catalogue._data.map(o => ({ nom: o.nom + (o.type === 'Abonnement' ? ' (abonnement/mois)' : ' (forfait)'), prix: o.prix })) : [];
    return offres;
  },

  _mock() {
    // Données de démo vidées le 04/09/2026 (voir clients.js).
    return [];
  },

  async _fetchReal() {
    // TODO Firebase : const snap = await window.db.collection('devis').get();
    return this._mock();
  },

  // Numéro de devis séquentiel et lisible (N° 1, 2, 3...) — distinct de
  // `id` (qui reste un identifiant technique interne, Date.now(), jamais
  // affiché). Continue toujours après le plus grand numéro déjà utilisé,
  // même si un devis a été supprimé entre-temps.
  _prochainNumero() {
    const max = this._data.reduce((m, d) => Math.max(m, d.numero || 0), 0);
    return max + 1;
  },

  // Format d'affichage du numéro — configurable depuis Paramétrage >
  // Devis (04/09/2026, retour de la revue complète de l'app) : un
  // comptable préfère souvent un format "DEV-2026-001" à un simple
  // entier. `d.numero` (le compteur brut, ci-dessus) ne change jamais —
  // seul l'AFFICHAGE change, donc rien à migrer sur les devis déjà créés.
  //
  // Reset annuel (05/09/2026) : quand "Inclure l'année" est coché, le
  // numéro affiché repart à 001 chaque année — c'est ce qu'attend un
  // comptable pour un format "DEV-2026-001". Sans l'année dans le
  // format, le compteur reste continu (repartir à 1 sans distinction
  // d'année créerait de vrais doublons visuels). Le rang est calculé à
  // l'affichage à partir du compteur brut `numero`, jamais stocké : le
  // compteur brut lui-même ne change jamais.
  // Nom du client affiché dans le tableau : si un clientId existe, on va
  // chercher le nom à jour dans le module Clients (le client a pu être
  // renommé depuis) ; sinon on retombe sur le texte figé du devis.
  // Si la fiche client existe toujours, le nom devient un lien cliquable
  // qui ouvre directement cette fiche (window.ouvrirFiche).
  _nomClientAffiche(d) {
    const entrepriseTxt = d.entreprise ? ` <span style="color:#6a6a6a;">— ${d.entreprise}</span>` : '';
    if (d.clientId) {
      const clientsModule = window.Modules && window.Modules.clients;
      const c = clientsModule && clientsModule._data ? clientsModule._data.find(x => x.id === d.clientId) : null;
      if (c) {
        return `<a href="#" data-voir-client="${c.id}" style="color:var(--text-primary); text-decoration:underline; text-decoration-color:rgba(255,255,255,.25);">${c.nom}</a>${c.entreprise ? ` <span style="color:#6a6a6a;">— ${c.entreprise}</span>` : entrepriseTxt}`;
      }
    }
    return `${d.client}${entrepriseTxt}`;
  },

  _formaterNumero(d) {
    const catalogue = window.Modules && window.Modules.catalogue;
    const e = catalogue ? catalogue._getEntreprise() : {};
    const brut = d.numero || d.id;
    const prefixe = e.numeroPrefixe || '';
    const chiffres = e.numeroChiffres || 0;
    const inclureAnnee = !!e.numeroInclureAnnee;
    if (!prefixe && !chiffres && !inclureAnnee) return `N° ${brut}`;
    const anneeCle = (d.date || '').slice(0, 4) || String(new Date().getFullYear());
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

  _statutBadge(statut) {
    const map = { 'Brouillon':'badge-blue', 'Envoyé':'badge-orange', 'Accepté':'badge-green', 'Refusé':'badge-red' };
    return `<span class="badge ${map[statut] || 'badge-blue'}">${statut}</span>`;
  },

  // Génération de facture directement depuis Devis (05/09/2026, demande de
  // Tiphaine — avant, il fallait obligatoirement passer par "Convertir en
  // projet" pour pouvoir facturer un acompte/solde, même sur un petit devis
  // qui ne mérite pas forcément un projet complet). Même % d'acompte que
  // partout ailleurs (Paramétrage > Devis, `acomptePct`).
  _acomptePctDevis() {
    const catalogue = window.Modules && window.Modules.catalogue;
    const e = catalogue ? catalogue._getEntreprise() : null;
    return (e && e.acomptePct) || 50;
  },
  _montantAcompteDevis(d) { return Math.round(d.montant * (this._acomptePctDevis() / 100)); },
  _montantSoldeDevis(d) { return d.montant - this._montantAcompteDevis(d); },

  // Une facture "déjà générée" pour ce devis+type est calculée EN DIRECT à
  // partir des vraies factures (05/09/2026, correction d'un bug remonté
  // par Tiphaine) — jamais stockée dans un flag statique sur le devis.
  // Avant : `d.factureAcompteGeneree` passait à `true` dès le clic sur
  // "Générer la facture" (avant même que la facture soit créée) ; annuler
  // la modal de facture laissait le bouton "Acompte" caché pour de bon,
  // sans aucun moyen de le faire revenir. Même principe que
  // `abonnements._moisDejaFactures` : une facture Annulée ne compte pas
  // comme "déjà générée" non plus, pour pouvoir refaire une vraie facture
  // si la précédente a été annulée par erreur.
  _factureExistePour(d, type) {
    const factures = window.Modules && window.Modules.factures;
    if (!factures || !factures._data) return false;
    return factures._data.some(f => f.devisId === d.id && f.type === type && f.statut !== 'Annulée');
  },

  // `type` = 'Acompte' | 'Solde' | 'Facture unique'.
  _genererFacture(d, type) {
    const factures = window.Modules && window.Modules.factures;
    if (!factures) { alert('Module Factures indisponible.'); return; }
    let montant, libelle;
    if (type === 'Acompte') {
      montant = this._montantAcompteDevis(d);
      libelle = `Acompte (${this._acomptePctDevis()}%) — ${d.offre}`;
    } else if (type === 'Solde') {
      montant = this._montantSoldeDevis(d);
      libelle = `Solde — ${d.offre}`;
    } else {
      montant = d.montant;
      libelle = d.offre;
    }
    const typeTxte = type === 'Facture unique' ? 'complète' : type.toLowerCase();
    window.confirmerAction(
      `Générer une facture ${typeTxte} de ${montant.toLocaleString('fr-FR')} € pour "${d.client}", à partir de ce devis ?`,
      () => {
        factures._openForm(null, {
          type,
          client: d.client,
          entreprise: d.entreprise,
          clientId: d.clientId || null,
          siretClient: d.siretClient,
          adresseClient: d.adresseClient,
          emailClient: d.emailClient,
          lignes: [{ description: libelle, montant, abonnementId: null, periode: null }],
          devisId: d.id,
          brouillonParDefaut: false,
        }, () => this.render(this._root)); // rafraîchit la ligne SEULEMENT si la facture est vraiment enregistrée
      },
      { titre: 'Facture', texteBouton: 'Générer la facture', danger: false }
    );
  },

  // Colonne "Facturation" (05/09/2026) — un bouton par type de facture pas
  // encore générée (Acompte/Solde/Complète, vérifié en direct via
  // `_factureExistePour`), disparaît une fois qu'une vraie facture existe.
  // "✓ Facturé" une fois les trois faits (rare — en pratique Acompte+Solde
  // OU Complète seule suffit, mais rien n'empêche de tout faire).
  _celluleFacturation(d) {
    const boutons = [];
    if (!this._factureExistePour(d, 'Acompte')) boutons.push(`<button class="btn-ghost" style="padding:4px 8px; font-size:11px; border-radius:6px;" data-generer-facture="${d.id}" data-type-facture="Acompte">Acompte</button>`);
    if (!this._factureExistePour(d, 'Solde')) boutons.push(`<button class="btn-ghost" style="padding:4px 8px; font-size:11px; border-radius:6px;" data-generer-facture="${d.id}" data-type-facture="Solde">Solde</button>`);
    if (!this._factureExistePour(d, 'Facture unique')) boutons.push(`<button class="btn-ghost" style="padding:4px 8px; font-size:11px; border-radius:6px;" data-generer-facture="${d.id}" data-type-facture="Facture unique">Complète</button>`);
    if (!boutons.length) return '<span style="color:#6ec88c; font-size:12px;">✓ Facturé</span>';
    return `<div style="display:flex; gap:4px; flex-wrap:wrap;" onclick="event.stopPropagation();">${boutons.join('')}</div>`;
  },

  // Colonne "Signé" — pertinente surtout une fois le devis Accepté : permet
  // d'attacher directement depuis le tableau le devis signé (photo/scan ou
  // export PDF signé), sans avoir à rouvrir le formulaire d'édition.
  // Stocké en data URL en mémoire pour l'instant (pas encore de vrai
  // stockage fichier tant que Firebase Storage n'est pas branché — TODO).
  // Colonne "Signé" — deux façons d'indiquer que le client a validé, pas
  // besoin d'attendre le statut Accepté ni d'avoir forcément un fichier
  // scanné (05/09/2026, demande de Tiphaine) : joindre un fichier (photo/
  // scan/export PDF signé) OU cocher "Signé" quand elle sait que c'est bon
  // mais n'a pas encore le scan sous la main. Les deux marquent le devis
  // Accepté automatiquement (sauf s'il est déjà Refusé, jamais écrasé).
  _celluleJustificatif(d) {
    if (d.justificatifDataUrl) {
      return `
        <span style="display:flex; align-items:center; gap:6px; white-space:nowrap;">
          <a href="${d.justificatifDataUrl}" download="${d.justificatifNom || 'devis-signe'}" target="_blank" rel="noopener" class="btn-ghost" style="padding:5px 10px; font-size:11.5px; border-radius:7px; text-decoration:none;" onclick="event.stopPropagation();">📎 ${d.justificatifNom ? (d.justificatifNom.length > 14 ? d.justificatifNom.slice(0, 12) + '…' : d.justificatifNom) : 'Voir'}</a>
          <button data-supprimer-justificatif="${d.id}" title="Retirer le justificatif" style="background:none; border:none; color:#6a6a6a; cursor:pointer; font-size:13px; padding:0;">✕</button>
        </span>`;
    }
    if (d.signeSansFichier) {
      return `
        <span style="display:flex; align-items:center; gap:6px; white-space:nowrap;">
          <span style="color:#6ec88c; font-size:12px;">✓ Signé</span>
          <label class="btn-ghost" style="padding:4px 8px; font-size:11px; border-radius:6px; cursor:pointer;" onclick="event.stopPropagation();">
            + Fichier
            <input type="file" data-upload-justificatif="${d.id}" accept="application/pdf,image/*" style="display:none;">
          </label>
          <button data-annuler-signe="${d.id}" title="Annuler" style="background:none; border:none; color:#6a6a6a; cursor:pointer; font-size:13px; padding:0;">✕</button>
        </span>`;
    }
    return `
      <span style="display:flex; align-items:center; gap:8px; white-space:nowrap;">
        <label class="btn-ghost" style="padding:5px 10px; font-size:11.5px; border-radius:7px; cursor:pointer;" onclick="event.stopPropagation();">
          + Ajouter
          <input type="file" data-upload-justificatif="${d.id}" accept="application/pdf,image/*" style="display:none;">
        </label>
        <label style="display:flex; align-items:center; gap:4px; font-size:11px; color:var(--text-secondary); cursor:pointer;" onclick="event.stopPropagation();">
          <input type="checkbox" data-toggle-signe="${d.id}"> Signé
        </label>
      </span>`;
  },

  // Colonnes triables (03/09/2026) — `cle` = champ sur l'objet devis (ou
  // fonction si le tri ne porte pas sur un champ direct), `libelle` =
  // texte affiché dans l'en-tête cliquable.
  _COLONNES_TRI: [
    { cle: 'numero', libelle: 'N°' },
    { cle: 'client', libelle: 'Client' },
    { cle: 'offre', libelle: 'Offre' },
    { cle: 'montant', libelle: 'Montant' },
    { cle: 'statut', libelle: 'Statut' },
    { cle: 'date', libelle: 'Date' },
    { cle: 'modifieLe', libelle: 'Modifié' },
  ],

  // Applique `this._tri` (colonne + sens) sur une COPIE — jamais sur
  // `this._data` lui-même, dont l'ordre réel (par numéro croissant) sert
  // ailleurs à calculer le prochain N°. Par défaut (`colonne:null`), tri
  // sur le numéro décroissant = le plus récemment créé en premier
  // (demande de Tiphaine le 03/09/2026 — un tri sur la date du devis,
  // modifiable, ne reflète pas l'ordre de création réel).
  _devisTries(devisOriginal) {
    const { colonne, sens } = this._tri;
    const cle = colonne || 'numero';
    const mult = sens === 'asc' ? 1 : -1;
    return [...devisOriginal].sort((a, b) => {
      let va = a[cle], vb = b[cle];
      // "Modifié" vide = jamais modifié → toujours en fin, quel que soit le sens.
      if (cle === 'modifieLe') {
        if (!va && !vb) return 0;
        if (!va) return 1;
        if (!vb) return -1;
      }
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va == null) va = '';
      if (vb == null) vb = '';
      if (va < vb) return -1 * mult;
      if (va > vb) return 1 * mult;
      return (b.numero || 0) - (a.numero || 0); // égalité → repli sur le plus récent créé
    });
  },

  // Popover du bouton entonnoir — une case par statut, tout coché par
  // défaut (`_filtreStatuts:null`). Décocher une case NARROWS l'affichage
  // au lieu de tout masquer d'un coup (03/09/2026, demande de Tiphaine).
  _htmlFiltrePopover() {
    const actifs = this._filtreStatuts || new Set(this._statuts);
    return `
      <div class="devis-filtre-popover">
        ${this._statuts.map(s => `
          <label class="devis-filtre-ligne">
            <input type="checkbox" data-filtre-statut="${s}" ${actifs.has(s) ? 'checked' : ''}>
            ${this._statutBadge(s)}
          </label>
        `).join('')}
        <div class="devis-filtre-actions">
          <button type="button" class="btn-lien-discret" id="devis-filtre-reset">Tout afficher</button>
          <button type="button" class="btn-lien-discret" id="devis-filtre-vider">Tout effacer</button>
        </div>
      </div>
    `;
  },

  _html(devisOriginal) {
    // Total "en attente" et compte réel = toujours sur les VRAIS devis,
    // pas la vue filtrée — sinon filtrer masque le vrai total business.
    const totalEnCours = devisOriginal.filter(d => d.statut === 'Envoyé').reduce((s, d) => s + d.montant, 0);
    const devisFiltres = this._filtreStatuts ? devisOriginal.filter(d => this._filtreStatuts.has(d.statut)) : devisOriginal;
    const devis = this._devisTries(devisFiltres);
    const colonneActive = this._tri.colonne || 'numero';
    const flecheTri = (cle) => cle !== colonneActive ? '' : (this._tri.sens === 'asc' ? ' ▲' : ' ▼');
    const filtreActif = !!this._filtreStatuts;
    return `
      <div class="page-header-row">
        <div>
          <div class="page-title"><span class="nav-icon" data-icon="fileText"></span>Devis</div>
          <div class="page-sub">${filtreActif ? `${devis.length} / ${devisOriginal.length} devis (filtré)` : `${devisOriginal.length} devis`} — ${totalEnCours.toLocaleString('fr-FR')} € en attente de réponse</div>
        </div>
        <div class="page-header-actions">
          <div class="devis-filtre-wrap">
            <button type="button" class="devis-filtre-btn ${filtreActif ? 'devis-filtre-btn-actif' : ''}" id="devis-filtre-toggle" title="Filtrer par statut">
              <span class="nav-icon" data-icon="filter" data-icon-size="15"></span>
              ${filtreActif ? `<span class="devis-filtre-badge">${this._filtreStatuts.size}</span>` : ''}
            </button>
            ${this._filtreOuvert ? this._htmlFiltrePopover() : ''}
          </div>
          <button class="btn" id="add-devis-btn">+ Nouveau devis</button>
        </div>
      </div>
      <div class="card devis-table-wrap" style="padding:0; overflow-x:auto;">
        <table>
          <thead><tr>
            ${this._COLONNES_TRI.map(c => `<th class="th-triable ${c.cle === colonneActive ? 'th-triable-active' : ''}" data-tri-colonne="${c.cle}" title="Trier par ${c.libelle.toLowerCase()}">${c.libelle}${flecheTri(c.cle)}</th>`).join('')}
            <th>PDF</th><th>Signé</th><th>Facturation</th><th></th><th></th>
          </tr></thead>
          <tbody>
            ${devis.map(d => `
              <tr data-open="${d.id}" data-numero="${d.numero || d.id}" style="cursor:pointer;">
                <td style="color:#8a8a8a;">${this._formaterNumero(d)}</td>
                <td>${this._nomClientAffiche(d)}</td>
                <td>${d.offre}</td>
                <td>${d.montant.toLocaleString('fr-FR')} €</td>
                <td>
                  ${this._statutBadge(d.statut)}
                </td>
                <td>${d.date}</td>
                <td>${d.modifieLe ? `<span style="color:var(--text-muted); font-size:12px;">${d.modifieLe}</span>` : `<span style="color:var(--text-muted);">—</span>`}</td>
                <td><button class="btn-ghost" style="padding:5px 10px; font-size:11.5px; border-radius:7px;" data-telecharger="${d.id}">👁 Aperçu / PDF</button></td>
                <td>${this._celluleJustificatif(d)}</td>
                <td>${this._celluleFacturation(d)}</td>
                <td>${d.statut === 'Accepté' && !d.convertiEnProjet ? `<button class="btn-ghost" style="padding:5px 10px; font-size:11.5px; border-radius:7px;" data-convertir="${d.id}">Convertir en projet →</button>` : (d.convertiEnProjet ? '<span style="color:#6ec88c; font-size:12px;">✓ Projet créé</span>' : '')}</td>
                <td style="width:36px;"><button class="row-delete-btn" data-delete="${d.id}" title="Supprimer">✕</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Version mobile (06/09/2026) — sous 880px, le tableau (11
           colonnes) disparaît et cette liste de cartes prend le relais
           (voir style.css). Un scroll horizontal sur un tableau aussi
           large faisait perdre le nom du client dès qu'on voulait voir
           le statut ou les boutons de facturation — plus pratique
           d'avoir tout empilé verticalement, rien à faire défiler
           latéralement. Réutilise les mêmes attributs data-* que les
           lignes du tableau (data-open, data-delete,
           data-generer-facture...) : _bindEvents déjà en place les
           reconnaît sans rien ajouter côté JS. -->
      <div class="devis-mobile-list">
        ${devis.map(d => this._htmlCarteMobile(d)).join('')}
      </div>
    `;
  },

  // Carte mobile d'un devis (06/09/2026) — mêmes infos que la ligne de
  // tableau, réorganisées verticalement : identité + statut en haut,
  // détail, puis les 2 actions "en cours" (signature, facturation) qui
  // sont celles que Tiphaine vient réellement cocher/cliquer depuis son
  // téléphone, actions secondaires (PDF/convertir/supprimer) en bas.
  _htmlCarteMobile(d) {
    return `
      <div class="devis-mcard" data-open="${d.id}" data-numero="${d.numero || d.id}">
        <div class="devis-mcard-top">
          <span style="color:#8a8a8a; font-size:12px;">${this._formaterNumero(d)}</span>
          ${this._statutBadge(d.statut)}
        </div>
        <div class="devis-mcard-client">${this._nomClientAffiche(d)}</div>
        <div class="devis-mcard-offre">${d.offre}</div>
        <div class="devis-mcard-montant">${d.montant.toLocaleString('fr-FR')} €</div>
        <div class="devis-mcard-section">
          <span class="devis-mcard-label">Signature</span>
          <div onclick="event.stopPropagation()">${this._celluleJustificatif(d)}</div>
        </div>
        <div class="devis-mcard-section">
          <span class="devis-mcard-label">Facturation</span>
          <div class="devis-mcard-fact-actions" onclick="event.stopPropagation()">${this._celluleFacturation(d)}</div>
        </div>
        <div class="devis-mcard-footer">
          <button class="btn-ghost" data-telecharger="${d.id}">👁 PDF</button>
          ${d.statut === 'Accepté' && !d.convertiEnProjet
            ? `<button class="btn-ghost" data-convertir="${d.id}">Convertir en projet →</button>`
            : (d.convertiEnProjet ? '<span style="color:#6ec88c; font-size:12px;">✓ Projet créé</span>' : '<span></span>')}
          <button class="row-delete-btn" data-delete="${d.id}" title="Supprimer">✕</button>
        </div>
      </div>
    `;
  },

  _formHtml(d) {
    const isEdit = !!d;
    const offres = this._offresDisponibles();
    const clientsModule = window.Modules.clients;
    const clientsExistants = (clientsModule && clientsModule._data) ? clientsModule._data : [];
    d = d || { client:'', entreprise:'', clientId:null, siretClient:'', adresseClient:'', emailClient:'', offre:'', montant:0, description:'', statut:'Brouillon', date: new Date().toISOString().slice(0,10) };
    return `
      <div class="modal-overlay" id="devis-modal-overlay">
        <div class="modal-box">
          <div class="modal-title">${isEdit ? 'Modifier le devis' : 'Nouveau devis'}</div>
          <form id="devis-form">
            ${clientsExistants.length ? `
            <div class="modal-field">
              <label>Reprendre un client existant (pré-remplit ses infos, tout reste modifiable)</label>
              <select id="devis-client-existant-select">
                <option value="">— Nouveau client / saisie libre —</option>
                ${clientsExistants.map(c => `<option value="${c.id}" ${d.clientId === c.id ? 'selected' : ''}>${c.nom}${c.entreprise ? ' — ' + c.entreprise : ''}</option>`).join('')}
              </select>
            </div>` : ''}
            <input type="hidden" name="clientId" id="devis-clientid-input" value="${d.clientId || ''}">
            <div class="modal-field">
              <label>Client${d.clientId ? ' — <a href="#" id="devis-voir-client-lien" style="color:var(--text-secondary); font-weight:400;">voir la fiche client →</a>' : ''}</label>
              <input type="text" name="client" id="devis-client-input" value="${d.client}" required autofocus>
            </div>
            <div class="modal-field">
              <label>Entreprise cliente</label>
              <input type="text" name="entreprise" id="devis-entreprise-input" value="${d.entreprise || ''}">
            </div>
            <div class="modal-field">
              <label>SIRET (entreprise cliente)</label>
              <input type="text" name="siretClient" id="devis-siret-input" value="${d.siretClient || ''}" placeholder="ex : 123 456 789 00012">
            </div>
            <div class="modal-field">
              <label>Adresse (entreprise cliente)</label>
              <input type="text" name="adresseClient" id="devis-adresse-input" value="${d.adresseClient || ''}" placeholder="N° et rue, code postal, ville">
            </div>
            <div class="modal-field">
              <label>Email client</label>
              <input type="email" name="emailClient" id="devis-email-input" value="${d.emailClient || ''}">
            </div>
            <div class="modal-field">
              <label>Reprendre une offre du catalogue (préremplit le libellé + le montant, tout reste modifiable — géré dans l'onglet Tarifs)</label>
              <select id="devis-offre-select">
                <option value="">— Libellé personnalisé —</option>
                ${offres.map(o => `<option value="${o.nom}" ${o.nom === d.offre ? 'selected' : ''}>${o.nom}</option>`).join('')}
              </select>
            </div>
            <div class="modal-field">
              <label>Libellé de l'offre</label>
              <input type="text" name="offre" id="devis-offre-input" value="${d.offre || ''}" placeholder="Ex : Site vitrine 3 pages + formulaire de contact" required>
            </div>
            <div class="modal-field">
              <label>Montant (€)</label>
              <input type="number" name="montant" id="devis-montant-input" value="${d.montant}" min="0" step="1">
            </div>
            <div class="modal-field">
              <label>Description / détails (optionnel — affiché sur le PDF si rempli, utile si le client demande plus de précisions sur ce qui est inclus)</label>
              <textarea name="description" placeholder="Ex : maquette + développement + mise en ligne + 2 allers-retours de retouches...">${d.description || ''}</textarea>
            </div>
            <div class="modal-field">
              <label>Statut</label>
              <select name="statut" id="devis-statut-select">
                ${this._statuts.map(s => `<option value="${s}" ${s === d.statut ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
            </div>
            <div class="modal-field">
              <label>Date</label>
              <input type="date" name="date" value="${d.date}">
            </div>
            <div class="modal-actions">
              ${isEdit ? `<button type="button" class="btn btn-danger" id="devis-delete-btn">Supprimer</button>` : `<span></span>`}
              <div class="modal-actions-right">
                <button type="button" class="btn btn-ghost" id="devis-cancel-btn">Annuler</button>
                <button type="submit" class="btn">${isEdit ? 'Enregistrer' : 'Ajouter'}</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  async _openForm(devis) {
    // Charge les clients existants (si pas déjà en mémoire) pour la liste
    // de reprise rapide dans le formulaire — sans bloquer si indisponible.
    const clientsModule = window.Modules.clients;
    if (clientsModule && !clientsModule._data) {
      clientsModule._data = window.FIREBASE_READY && clientsModule._fetchReal ? await clientsModule._fetchReal() : (clientsModule._mock ? clientsModule._mock() : []);
    }

    const wrap = document.createElement('div');
    wrap.innerHTML = this._formHtml(devis);
    document.body.appendChild(wrap.firstElementChild);
    const overlay = document.getElementById('devis-modal-overlay');
    const close = () => overlay.remove();
    const offres = this._offresDisponibles();

    // Ferme seulement si le clic ET le mousedown initial étaient bien sur le
    // fond (overlay) — sinon une sélection de texte qui démarre dans un
    // champ et se termine (drag) hors de la modal-box fermait la modal par
    // erreur (bug remonté le 03/09/2026).
    let mousedownSurOverlay = false;
    overlay.addEventListener('mousedown', (e) => { mousedownSurOverlay = (e.target === overlay); });
    overlay.addEventListener('click', (e) => { if (e.target === overlay && mousedownSurOverlay) close(); });
    document.getElementById('devis-cancel-btn').addEventListener('click', close);

    // Reprise d'un client existant : pré-remplit ses infos (tout reste
    // modifiable ensuite, y compris pour un nouveau devis one-off).
    const clientExistantSelect = document.getElementById('devis-client-existant-select');
    if (clientExistantSelect) {
      clientExistantSelect.addEventListener('change', (e) => {
        const id = Number(e.target.value);
        document.getElementById('devis-clientid-input').value = id || '';
        if (!id) return;
        const c = (clientsModule._data || []).find(x => x.id === id);
        if (!c) return;
        document.getElementById('devis-client-input').value = c.nom || '';
        document.getElementById('devis-entreprise-input').value = c.entreprise || '';
        document.getElementById('devis-siret-input').value = c.siret || '';
        document.getElementById('devis-adresse-input').value = c.adresse || '';
        document.getElementById('devis-email-input').value = c.email || '';
      });
    }

    // "voir la fiche client →" (05/09/2026, revue de la connexion entre
    // modules) — n'existe que si le devis est lié à un vrai client
    // (clientId), ouvre directement sa fiche via le mécanisme générique
    // `window.ouvrirFiche` (voir app.js).
    const voirClientLien = document.getElementById('devis-voir-client-lien');
    if (voirClientLien) {
      voirClientLien.addEventListener('click', (e) => {
        e.preventDefault();
        const id = Number(document.getElementById('devis-clientid-input').value);
        if (id) { close(); window.ouvrirFiche('clients', id); }
      });
    }

    // Reprendre une offre du catalogue (05/09/2026) — préremplit le libellé
    // ET le montant, mais les deux restent des champs texte/nombre normaux
    // ensuite (le select n'est qu'un raccourci de saisie, sa valeur n'est
    // jamais envoyée directement — voir absence de `name` sur le select).
    // "— Libellé personnalisé —" (valeur vide) ne touche à rien, pour ne
    // pas écraser un libellé déjà tapé à la main.
    document.getElementById('devis-offre-select').addEventListener('change', (e) => {
      if (!e.target.value) return;
      const found = offres.find(o => o.nom === e.target.value);
      if (!found) return;
      document.getElementById('devis-offre-input').value = found.nom;
      document.getElementById('devis-montant-input').value = found.prix;
    });

    const deleteBtn = document.getElementById('devis-delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        window.confirmerAction('Supprimer ce devis ?', () => {
          this._data = this._data.filter(x => x.id !== devis.id);
          // TODO Firebase : window.db.collection('devis').doc(devis.id).delete()
          close();
          this.render(this._root);
        });
      });
    }

    document.getElementById('devis-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = {
        client: fd.get('client').trim(),
        entreprise: fd.get('entreprise').trim(),
        clientId: fd.get('clientId') ? Number(fd.get('clientId')) : null,
        siretClient: fd.get('siretClient').trim(),
        adresseClient: fd.get('adresseClient').trim(),
        emailClient: fd.get('emailClient').trim(),
        offre: fd.get('offre'),
        description: fd.get('description').trim(),
        montant: parseInt(fd.get('montant') || '0', 10),
        statut: fd.get('statut'),
        date: fd.get('date'),
      };
      if (!payload.client) return;

      if (devis) {
        // Horodatage de la modification (03/09/2026, demande de Tiphaine)
        // — seulement si quelque chose a réellement changé, pas à chaque
        // simple ouverture/fermeture du formulaire sans édition.
        const aChange = Object.keys(payload).some(k => String(devis[k] ?? '') !== String(payload[k] ?? ''));
        Object.assign(devis, payload);
        if (aChange) devis.modifieLe = this._dateHeureLocale(new Date());
        // TODO Firebase : window.db.collection('devis').doc(devis.id).update(payload)
      } else {
        this._data.push({ id: Date.now(), numero: this._prochainNumero(), convertiEnProjet:false, modifieLe:null, ...payload });
        // TODO Firebase : window.db.collection('devis').add(payload)
      }
      close();
      this.render(this._root);
    });
  },

  _convertirEnProjet(devisId) {
    const d = this._data.find(x => x.id === devisId);
    if (!d) return;
    const projets = window.Modules.projets;
    if (!projets) { alert('Module Projets indisponible.'); return; }
    if (!projets._data) projets._data = projets._mock ? projets._mock() : [];

    projets._data.push({
      id: Date.now(),
      nom: d.offre,
      client: d.client,
      entreprise: d.entreprise,
      clientId: d.clientId || null, // propage le lien vers Clients (05/09/2026)
      montant: d.montant,
      statut: 'Nouveau',
      dateDebut: new Date().toISOString().slice(0, 10),
      checklist: projets._checklistParDefaut ? projets._checklistParDefaut() : [],
      devisId: d.id,
    });
    // TODO Firebase : window.db.collection('projets').add({...})

    d.convertiEnProjet = true;
    // TODO Firebase : window.db.collection('devis').doc(d.id).update({ convertiEnProjet: true })
    this.render(this._root);

    // Rappel "envoie l'acompte" au moment même de la conversion
    // (04/09/2026, retour de la revue complète de l'app) : rien ne
    // poussait jusqu'ici à réclamer l'acompte juste après l'accord du
    // client — le suivi acompte/solde existait sur Projets, mais
    // seulement une fois qu'on pensait à y aller. Ferme la boucle
    // devis accepté → acompte réclamé → démarrage, sans étape oubliée.
    const catalogue = window.Modules && window.Modules.catalogue;
    const acomptePct = (catalogue ? catalogue._getEntreprise().acomptePct : null) || 50;
    const montantAcompte = Math.round(d.montant * (acomptePct / 100));
    window.confirmerAction(
      `Projet "${d.offre}" créé pour ${d.client}. Pense à envoyer la demande d'acompte maintenant (${montantAcompte.toLocaleString('fr-FR')} €, ${acomptePct}% du montant) — le projet démarre dès sa réception.`,
      () => { location.hash = '#/projets'; },
      { titre: 'Projet créé — prochaine étape', texteBouton: 'Aller sur Projets', danger: false }
    );
  },

  // jsPDF (police standard WinAnsi) n'affiche pas correctement l'espace fine
  // insécable que toLocaleString('fr-FR') utilise comme séparateur de
  // milliers (glyphe cassé à l'affichage, ex: "1/400" au lieu de "1 400").
  // On la remplace par un espace normal avant l'envoi au PDF.
  _formatMontant(n) {
    const espacesSpeciaux = new RegExp('[' + String.fromCharCode(0x00A0) + String.fromCharCode(0x202F) + ']', 'g');
    return n.toLocaleString('fr-FR').replace(espacesSpeciaux, ' ') + ' €';
  },

  // Logo codé en dur en base64 (voir logo-data.js) — évite tout souci de
  // fetch()/CORS en local (file://). Régénérer via
  // outils/image-vers-base64.html si le logo change.
  async _chargerLogoDataUrl() {
    return window.LOGO_BASE64 || null;
  },

  // Récupère la largeur/hauteur réelles (en px) d'une image data URL, pour
  // l'afficher dans le PDF sans la déformer.
  _dimensionsImage(dataUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  },

  // ── Aides anti-chevauchement pour le PDF ────────────────────────────
  // jsPDF ne retourne jamais la hauteur réelle d'un texte : si on lui donne
  // juste `maxWidth`, le texte peut retourner à la ligne SANS que le code
  // appelant le sache, et la ligne suivante vient alors s'écrire par-dessus.
  // Ces deux fonctions calculent le nombre réel de lignes (avec
  // splitTextToSize) avant d'écrire quoi que ce soit, pour que chaque bloc
  // (Prestataire/Client, coordonnées bancaires, etc.) réserve toujours
  // assez de place — quelle que soit la longueur du contenu.
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

  // Gestion multi-pages : si ce qu'on s'apprête à dessiner (hauteur
  // `hauteurNecessaire`) ne tient plus avant le bas de page, on ajoute une
  // nouvelle page et on redessine la bande noire de signature visuelle,
  // puis on renvoie le nouveau `y` de départ. Avant cette fonction, un
  // devis avec beaucoup de contenu (longue description, adresse à
  // rallonge...) aurait simplement été coupé/caché en bas de la page A4 —
  // jsPDF n'ajoute jamais de page toute seule.
  _assurerPage(doc, y, hauteurNecessaire, noir) {
    const limiteBas = 280;
    if (y + hauteurNecessaire <= limiteBas) return y;
    doc.addPage();
    doc.setFillColor(...noir);
    doc.rect(0, 0, 6, 297, 'F');
    return 20;
  },

  // Parse le format simple utilisé pour les CGV (catalogue._getCgv()) :
  // une ligne "## Titre" démarre une section, tout le reste est du texte
  // normal, un saut de ligne = un nouveau paragraphe.
  _parserCgv(texte) {
    const lignes = String(texte || '').split('\n');
    const blocs = [];
    let paragrapheCourant = '';
    const flush = () => {
      if (paragrapheCourant.trim()) blocs.push({ type: 'paragraphe', texte: paragrapheCourant.trim() });
      paragrapheCourant = '';
    };
    lignes.forEach((ligne) => {
      if (ligne.trim().startsWith('## ')) {
        flush();
        blocs.push({ type: 'titre', texte: ligne.trim().slice(3).trim() });
      } else if (ligne.trim() === '') {
        flush();
      } else {
        paragrapheCourant += (paragrapheCourant ? ' ' : '') + ligne.trim();
      }
    });
    flush();
    return blocs;
  },

  // Convertit un entier en chiffres romains (I, II, III, IV...) — utilisé
  // pour numéroter les sections des CGV comme un document juridique
  // classique ("I – CHAMP D'APPLICATION").
  _versRomain(n) {
    const table = [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
    let reste = n, resultat = '';
    table.forEach(([valeur, symbole]) => {
      while (reste >= valeur) { resultat += symbole; reste -= valeur; }
    });
    return resultat;
  },

  // Annexe les CGV (modifiables dans l'onglet Tarifs) en page(s) suivante(s)
  // du devis, en mise en page dense sur 2 colonnes (sur le modèle des CGV
  // "professionnelles" classiques : titre centré, sections numérotées en
  // chiffres romains, texte compact, mentions légales en pied de page) —
  // avec pagination automatique colonne par colonne puis page par page,
  // jamais de contenu coupé/caché même si les CGV s'allongent.
  _rendreCgv(doc, noir, gris, numero) {
    const catalogue = window.Modules.catalogue;
    const texteBrut = catalogue ? catalogue._getCgv() : '';
    const entreprise = catalogue ? catalogue._getEntreprise() : {};
    const blocs = this._parserCgv(texteBrut);
    if (!blocs.length) return;

    const ML = 14, MR = 196;
    const GOUTTIERE = 8;
    const largeurColonne = (MR - ML - GOUTTIERE) / 2;
    const colX = [ML, ML + largeurColonne + GOUTTIERE];
    const HAUT = 30, BAS = 281;

    let colonne = 0;
    let y = HAUT;

    const dessinerEntete = (premierePageCgv) => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...noir);
      doc.text('CONDITIONS GÉNÉRALES DE VENTE', 105, 18, { align: 'center' });
      if (premierePageCgv) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...gris);
        doc.text(`Annexées au devis ${numero}`, 105, 23, { align: 'center' });
      }
      doc.setDrawColor(20, 20, 20); doc.setLineWidth(0.4);
      doc.line(ML, 26, MR, 26);
      doc.setLineWidth(0.2);
    };

    const dessinerPiedDePage = () => {
      const ligne = [
        entreprise.nom,
        entreprise.siret ? `SIRET ${entreprise.siret}` : '',
        entreprise.adresse,
      ].filter(Boolean).join(' — ');
      if (!ligne) return;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(...gris);
      doc.text(ligne, 105, 291, { align: 'center' });
    };

    const nouvellePage = (premierePageCgv) => {
      doc.addPage();
      doc.setFillColor(...noir);
      doc.rect(0, 0, 6, 297, 'F');
      dessinerEntete(premierePageCgv);
      dessinerPiedDePage();
      colonne = 0;
      y = HAUT;
    };

    // Réserve l'espace nécessaire dans la colonne/page courante ; passe à
    // la colonne suivante, ou à une nouvelle page si les deux colonnes sont
    // pleines.
    const assurerEspace = (hauteurNecessaire) => {
      if (y + hauteurNecessaire > BAS) {
        if (colonne === 0) { colonne = 1; y = HAUT; }
        else { nouvellePage(false); }
      }
    };

    nouvellePage(true);

    let compteurSection = 0;
    blocs.forEach((bloc) => {
      if (bloc.type === 'titre') {
        compteurSection += 1;
        const texteTitre = bloc.texte.replace(/^\d+\.\s*/, '');
        const titreAffiche = `${this._versRomain(compteurSection)} – ${texteTitre.toUpperCase()}`;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...noir);
        const lignesTitre = doc.splitTextToSize(titreAffiche, largeurColonne);
        assurerEspace(lignesTitre.length * 3.1 + 3.5);
        doc.text(lignesTitre, colX[colonne], y);
        y += lignesTitre.length * 3.1 + 1.5;
      } else {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8); doc.setTextColor(...gris);
        const lignesParagraphe = doc.splitTextToSize(bloc.texte, largeurColonne);
        const hauteur = lignesParagraphe.length * 2.9;
        assurerEspace(hauteur + 2.5);
        doc.text(lignesParagraphe, colX[colonne], y);
        y += hauteur + 2;
      }
    });
  },

  // ── Génération du PDF (jsPDF, noir et blanc, mentions légales) ──────
  // Construit le document et le renvoie (sans le sauvegarder) — utilisé à
  // la fois par l'aperçu et par le téléchargement, pour ne jamais avoir
  // deux implémentations à maintenir en parallèle.
  async _construirePdf(devisId) {
    const d = this._data.find(x => x.id === devisId);
    if (!d) return null;
    if (!window.jspdf) { alert("La librairie PDF n'est pas encore chargée — réessaie dans une seconde."); return null; }

    const catalogue = window.Modules.catalogue;
    const e = catalogue ? catalogue._getEntreprise() : { nom:'Tiphaine Bénard', siret:'', adresse:'', email:'', mentionTva:'TVA non applicable, art. 293 B du CGI.', acomptePct:50, dureeValiditeJours:30 };

    // Si le devis n'a pas ses propres infos client (SIRET/adresse/email —
    // ex : un ancien devis créé avant que la fiche client soit complétée),
    // on va les chercher en direct dans la fiche Clients correspondante. Ça
    // évite d'avoir à ressaisir le devis à chaque fois qu'on complète une
    // fiche client : les deux restent connectés.
    const clientsModule = window.Modules.clients;
    if (clientsModule && !clientsModule._data) {
      clientsModule._data = window.FIREBASE_READY && clientsModule._fetchReal ? await clientsModule._fetchReal() : (clientsModule._mock ? clientsModule._mock() : []);
    }
    const clientCorrespondant = (clientsModule && clientsModule._data)
      ? clientsModule._data.find(c => c.nom === d.client || (d.entreprise && c.entreprise === d.entreprise))
      : null;
    const infosClient = {
      entreprise: d.entreprise || (clientCorrespondant && clientCorrespondant.entreprise) || '',
      siret: d.siretClient || (clientCorrespondant && clientCorrespondant.siret) || '',
      adresse: d.adresseClient || (clientCorrespondant && clientCorrespondant.adresse) || '',
      email: d.emailClient || (clientCorrespondant && clientCorrespondant.email) || '',
    };

    const logoDataUrl = await this._chargerLogoDataUrl();
    // Le logo (logo-data.js) contient déjà "TIPHAINE BÉNARD" en texte dans
    // l'image — pas besoin de le réécrire par-dessus. On calcule sa hauteur
    // réelle à partir du ratio de l'image pour ne pas la déformer.
    const logoDims = logoDataUrl ? await this._dimensionsImage(logoDataUrl) : null;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit:'mm', format:'a4' });
    const noir = [15, 15, 15];
    const gris = [120, 120, 120];
    const grisClair = [242, 242, 242];
    const ML = 20, MR = 190; // marges gauche/droite (accent noir sur le bord)

    // Signature visuelle : bande noire pleine hauteur sur le bord gauche
    // (même identité que le reste de Tiphaine OS/portfolio).
    doc.setFillColor(...noir);
    doc.rect(0, 0, 6, 297, 'F');

    // ── En-tête — logo plus grand, calé dynamiquement selon son ratio réel
    let basHeaderGauche = 30; // bas du texte si pas de logo
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

    // Bloc "DEVIS" à droite, avec un badge noir pour le numéro (touche design).
    doc.setFont('helvetica', 'bold'); doc.setFontSize(28); doc.setTextColor(...noir);
    doc.text('DEVIS', MR, 26, { align:'right' });

    const numeroTxt = this._formaterNumero(d);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    const largeurBadge = doc.getTextWidth(numeroTxt) + 8;
    doc.setFillColor(...noir);
    doc.roundedRect(MR - largeurBadge, 30, largeurBadge, 7, 1.5, 1.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text(numeroTxt, MR - largeurBadge / 2, 34.7, { align:'center' });

    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...gris);
    doc.text(`Émis le ${this._formatDate(d.date)}`, MR, 42, { align:'right' });
    const validite = new Date(d.date);
    validite.setDate(validite.getDate() + (e.dureeValiditeJours || 30));
    doc.text(`Valable jusqu'au ${this._formatDate(validite.toISOString().slice(0,10))}`, MR, 46.5, { align:'right' });

    // La ligne de séparation (et tout ce qui suit) se cale sur le point le
    // plus bas entre le bloc logo/texte (gauche, hauteur variable selon le
    // logo) et le bloc DEVIS (droite, jusqu'à "Valable jusqu'au" à y=46.5) —
    // jamais de superposition, quelle que soit la taille du logo.
    const yLigneSeparation = Math.max(54, basHeaderGauche + 4);
    doc.setDrawColor(15, 15, 15);
    doc.setLineWidth(0.8);
    doc.line(ML, yLigneSeparation, MR, yLigneSeparation);
    doc.setLineWidth(0.2);

    // ── Cartes PRESTATAIRE / CLIENT (fond gris clair, coins arrondis) ────
    // Hauteur calculée d'après le contenu réel (avec retours à la ligne
    // pris en compte) : jamais de texte qui déborde ou se chevauche, même
    // avec une adresse longue ou plusieurs champs remplis.
    const yCartes = yLigneSeparation + 8;
    const largeurCarte = (MR - ML - 6) / 2;
    const padCarte = 6;
    const largeurTexteCarte = largeurCarte - padCarte * 2;
    const xClient = ML + largeurCarte + 6 + padCarte;

    const lignesPrestataire = [e.nom || 'Tiphaine Bénard', e.adresse, e.siret ? `SIRET : ${e.siret}` : null, e.email];
    const lignesClient = [infosClient.entreprise || d.client, infosClient.entreprise ? d.client : null, infosClient.adresse, infosClient.siret ? `SIRET : ${infosClient.siret}` : null, infosClient.email];

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

    // ── Tableau prestation ────────────────────────────────────────────
    const largeurTable = MR - ML;
    let y = yCartes + hauteurCarte + 12;

    // Tout est calculé (largeurs/hauteurs) AVANT de dessiner quoi que ce
    // soit, pour pouvoir vérifier en un seul coup si le bloc entier (en-tête
    // + ligne prestation + TOTAL) tient sur la page, et sauter de page sinon.
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5);
    const largeurOffre = largeurTable * 0.65;
    const lignesOffre = doc.splitTextToSize(String(d.offre || ''), largeurOffre);
    const hauteurBlocOffre = lignesOffre.length * 5;

    // Description optionnelle (remplie au cas par cas si le client demande
    // le détail de ce qui est inclus) — affichée en plus petit sous le nom
    // de l'offre, dans la même ligne du tableau. Rien n'apparaît si vide.
    doc.setFontSize(8.5);
    const lignesDescription = d.description ? doc.splitTextToSize(String(d.description), largeurOffre) : [];
    const hauteurBlocDescription = lignesDescription.length ? lignesDescription.length * 4 + 4 : 0;
    const hauteurLigneOffre = Math.max(13, 8 + hauteurBlocOffre + hauteurBlocDescription);

    y = this._assurerPage(doc, y, 10 + hauteurLigneOffre + 12, noir);

    doc.setFillColor(...noir);
    doc.rect(ML, y, largeurTable, 10, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
    doc.text('PRESTATION', ML + 4, y + 6.7);
    doc.text('MONTANT', MR - 2, y + 6.7, { align:'right' });
    y += 10;

    doc.setDrawColor(225, 225, 225);
    doc.rect(ML, y, largeurTable, hauteurLigneOffre);
    doc.setTextColor(...noir); doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5);
    doc.text(lignesOffre, ML + 4, y + 8.5);
    doc.text(this._formatMontant(d.montant), MR - 2, y + 8.5, { align:'right' });

    if (lignesDescription.length) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...gris);
      doc.text(lignesDescription, ML + 4, y + 8.5 + hauteurBlocOffre);
    }
    y += hauteurLigneOffre;

    // Bandeau TOTAL en noir, pour un vrai effet "facture premium".
    doc.setFillColor(...noir);
    doc.rect(ML, y, largeurTable, 12, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    doc.text('TOTAL', ML + 4, y + 8);
    doc.text(this._formatMontant(d.montant), MR - 2, y + 8, { align:'right' });
    y += 12;

    // Acompte
    const acompte = Math.round(d.montant * ((e.acomptePct || 50) / 100));
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...gris);
    doc.text(`Acompte à la commande (${e.acomptePct || 50}%) : ${this._formatMontant(acompte)} — solde de ${this._formatMontant(d.montant - acompte)} à la livraison.`, ML, y + 8);

    // ── Coordonnées bancaires (à gauche) + Bon pour accord (à droite) ───
    // Hauteur commune calculée d'après le contenu réel des deux blocs (même
    // logique anti-chevauchement que les cartes Prestataire/Client) — resserrée
    // au minimum nécessaire pour ne pas laisser de grand vide inutile.
    y += 14;
    const xAccord = ML + 94;
    const largeurBanque = 84 - 10;
    const largeurAccord = MR - xAccord;
    const lignesBanque = [e.titulaireCompte, e.banque, e.iban ? `IBAN : ${e.iban}` : null, e.bic ? `BIC : ${e.bic}` : null];
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);

    // Instruction wrappable (police 8) : calculée AVANT de dessiner, pour
    // que Date/Signature se décalent automatiquement si jamais elle prend
    // 2 lignes au lieu d'une — même logique anti-chevauchement que
    // partout ailleurs dans ce PDF.
    doc.setFontSize(8);
    const ligneInstruction = doc.splitTextToSize('Signature précédée de « Bon pour accord »', largeurAccord - 10);
    const decalageInstruction = (ligneInstruction.length - 1) * 4;

    // 42mm minimum : juste assez pour le titre + l'instruction + les deux
    // lignes Date/Signature avec un peu d'air sous la signature.
    const hauteurBoite = Math.max(
      42 + decalageInstruction,
      e.iban ? 13 + this._hauteurBloc(doc, lignesBanque, largeurBanque) + 6 : 0
    );

    y = this._assurerPage(doc, y, hauteurBoite + 14, noir);

    // Coordonnées bancaires — affichées uniquement si renseignées, pour
    // que le client sache où virer l'acompte sans avoir à redemander.
    if (e.iban) {
      doc.setFillColor(...grisClair);
      doc.roundedRect(ML, y, 84, hauteurBoite, 2, 2, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...gris);
      doc.text('COORDONNÉES BANCAIRES', ML + 5, y + 7);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...noir);
      this._ecrireBloc(doc, lignesBanque, ML + 5, y + 13, largeurBanque);
    }

    doc.setDrawColor(180, 180, 180);
    doc.setLineDashPattern([1.5, 1.2], 0);
    doc.roundedRect(xAccord, y, largeurAccord, hauteurBoite, 2, 2);
    doc.setLineDashPattern([], 0);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...noir);
    doc.text('Bon pour accord', xAccord + 5, y + 8);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...gris);
    doc.text(ligneInstruction, xAccord + 5, y + 15);

    // Vraies lignes à remplir (avant, il n'y avait que le texte
    // d'instruction ci-dessus, rien de concret où écrire/signer).
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...gris);
    doc.text('Date :', xAccord + 5, y + 24 + decalageInstruction);
    doc.setDrawColor(190, 190, 190);
    doc.line(xAccord + 18, y + 24 + decalageInstruction, xAccord + largeurAccord - 5, y + 24 + decalageInstruction);
    doc.text('Signature :', xAccord + 5, y + 35 + decalageInstruction);
    doc.line(xAccord + 22, y + 35 + decalageInstruction, xAccord + largeurAccord - 5, y + 35 + decalageInstruction);

    y += hauteurBoite;

    // ── Mentions légales + pied de page ─────────────────────────────────
    const yLigneFooter = Math.max(268, y + 8);
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.3);
    doc.line(ML, yLigneFooter, MR, yLigneFooter);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...gris);
    let yFooter = yLigneFooter + 5;
    doc.text(e.mentionTva || 'TVA non applicable, art. 293 B du CGI.', ML, yFooter);
    yFooter += 4;
    doc.text('Toute modification mineure (texte/image) hors structure ou fonctionnalité est incluse ; toute évolution majeure fait l\'objet d\'un devis complémentaire.', ML, yFooter, { maxWidth: MR - ML });

    // Nom de fichier : l'entreprise cliente si elle est connue (plus utile
    // pour s'y retrouver dans un dossier de devis), sinon le nom du client.
    const nomPourFichier = infosClient.entreprise || d.client || 'client';
    // ── CGV (page(s) suivante(s)) — annexées automatiquement, gérées et
    // modifiables depuis l'onglet Tarifs (catalogue._getCgv()).
    this._rendreCgv(doc, noir, gris, this._formaterNumero(d));

    const nomFichier = `Devis_${nomPourFichier.replace(/\s+/g, '_')}_${d.date}.pdf`;
    return { doc, nomFichier };
  },

  // Télécharge directement (utilisé par un éventuel appel direct — l'UI
  // passe maintenant par l'aperçu, voir _apercuPdf).
  async _telechargerPdf(devisId) {
    const resultat = await this._construirePdf(devisId);
    if (!resultat) return;
    resultat.doc.save(resultat.nomFichier);
  },

  // Aperçu avant téléchargement — ouvre le PDF généré dans une iframe au
  // sein d'un modal, avec un bouton pour le télécharger seulement une fois
  // que le rendu est validé visuellement.
  async _apercuPdf(devisId) {
    const resultat = await this._construirePdf(devisId);
    if (!resultat) return;
    const { doc, nomFichier } = resultat;
    const url = doc.output('bloburl');

    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="modal-overlay" id="apercu-pdf-overlay">
        <div class="modal-box" style="max-width:820px; width:92vw; height:88vh; display:flex; flex-direction:column;">
          <div class="modal-title">Aperçu du devis</div>
          <iframe src="${url}" style="flex:1; width:100%; border:1px solid #262626; border-radius:8px; margin-bottom:10px; background:#fff;"></iframe>
          <div class="modal-actions">
            <span></span>
            <div class="modal-actions-right">
              <button type="button" class="btn btn-ghost" id="apercu-fermer-btn">Fermer</button>
              <button type="button" class="btn" id="apercu-telecharger-btn">↓ Télécharger le PDF</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(wrap.firstElementChild);
    const overlay = document.getElementById('apercu-pdf-overlay');
    const close = () => { overlay.remove(); URL.revokeObjectURL(url); };

    // Ferme seulement si le clic ET le mousedown initial étaient bien sur le
    // fond (overlay) — sinon une sélection de texte qui démarre dans un
    // champ et se termine (drag) hors de la modal-box fermait la modal par
    // erreur (bug remonté le 03/09/2026).
    let mousedownSurOverlay = false;
    overlay.addEventListener('mousedown', (e) => { mousedownSurOverlay = (e.target === overlay); });
    overlay.addEventListener('click', (e) => { if (e.target === overlay && mousedownSurOverlay) close(); });
    document.getElementById('apercu-fermer-btn').addEventListener('click', close);
    document.getElementById('apercu-telecharger-btn').addEventListener('click', () => {
      doc.save(nomFichier);
    });
  },

  _formatDate(iso) {
    if (!iso) return '';
    const [y, m, day] = iso.split('-');
    return `${day}/${m}/${y}`;
  },

  _bindEvents(container) {
    const addBtn = container.querySelector('#add-devis-btn');
    if (addBtn) addBtn.addEventListener('click', () => this._openForm(null));

    // Filtre par statut (03/09/2026) — bouton entonnoir + popover de
    // cases à cocher, même logique d'ouverture/fermeture que le mini-
    // calendrier de la Vue Semaine (module Temps).
    const filtreToggleBtn = container.querySelector('#devis-filtre-toggle');
    if (filtreToggleBtn) {
      filtreToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._filtreOuvert = !this._filtreOuvert;
        this.render(this._root);
      });
    }
    container.querySelectorAll('[data-filtre-statut]').forEach(cb => {
      cb.addEventListener('click', (e) => e.stopPropagation());
      cb.addEventListener('change', () => {
        const actifs = new Set(this._filtreStatuts || this._statuts);
        if (cb.checked) actifs.add(cb.dataset.filtreStatut); else actifs.delete(cb.dataset.filtreStatut);
        // Tout coché = équivalent à "pas de filtre" (évite de garder un
        // Set complet inutilement et de faire clignoter le badge "(4)").
        this._filtreStatuts = actifs.size === this._statuts.length ? null : actifs;
        this.render(this._root);
      });
    });
    const filtreResetBtn = container.querySelector('#devis-filtre-reset');
    if (filtreResetBtn) {
      filtreResetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._filtreStatuts = null;
        this.render(this._root);
      });
    }
    const filtreViderBtn = container.querySelector('#devis-filtre-vider');
    if (filtreViderBtn) {
      filtreViderBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._filtreStatuts = new Set(); // aucun statut coché → tableau vide
        this.render(this._root);
      });
    }
    if (this._filtreOuvert) {
      const fermerFiltreAuClicExterieur = (e) => {
        if (!e.target.closest('.devis-filtre-wrap')) {
          this._filtreOuvert = false;
          this.render(this._root);
        }
        document.removeEventListener('click', fermerFiltreAuClicExterieur);
      };
      setTimeout(() => document.addEventListener('click', fermerFiltreAuClicExterieur), 0);
    }

    // En-têtes de colonnes cliquables pour trier (03/09/2026, demande de
    // Tiphaine) — reclique sur la même colonne → inverse le sens, clique
    // sur une autre colonne → repart en tri décroissant.
    container.querySelectorAll('[data-tri-colonne]').forEach(th => {
      th.addEventListener('click', () => {
        const cle = th.dataset.triColonne;
        if (this._tri.colonne === cle) {
          this._tri.sens = this._tri.sens === 'asc' ? 'desc' : 'asc';
        } else {
          this._tri = { colonne: cle, sens: 'desc' };
        }
        this.render(this._root);
      });
    });

    // Sélecteur générique (06/09/2026, avant : `tr[data-open]` uniquement)
    // — reconnaît aussi bien la ligne de tableau (desktop) que la carte
    // mobile (`.devis-mcard`, voir `_htmlCarteMobile`), mêmes attributs.
    container.querySelectorAll('[data-open]').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('[data-convertir]') || e.target.closest('[data-telecharger]') || e.target.closest('[data-upload-justificatif]') || e.target.closest('[data-supprimer-justificatif]') || e.target.closest('[data-toggle-signe]') || e.target.closest('[data-annuler-signe]') || e.target.closest('[data-generer-facture]') || e.target.closest('[data-delete]') || e.target.closest('label') || e.target.closest('[data-voir-client]')) return;
        const id = Number(row.dataset.open);
        const d = this._data.find(x => x.id === id);
        if (d) this._openForm(d);
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

    container.querySelectorAll('[data-delete]').forEach(delBtn => {
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number(delBtn.dataset.delete);
        window.confirmerAction('Supprimer ce devis ?', () => {
          this._data = this._data.filter(x => x.id !== id);
          // TODO Firebase : window.db.collection('devis').doc(id).delete()
          this.render(this._root);
        });
      });
    });

    container.querySelectorAll('[data-convertir]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._convertirEnProjet(Number(btn.dataset.convertir));
      });
    });

    container.querySelectorAll('[data-telecharger]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._apercuPdf(Number(btn.dataset.telecharger));
      });
    });

    // Justificatif (devis signé) — attaché directement depuis le tableau,
    // sans passer par le formulaire d'édition complet.
    container.querySelectorAll('[data-upload-justificatif]').forEach(input => {
      input.addEventListener('click', (e) => e.stopPropagation());
      input.addEventListener('change', (e) => {
        const fichier = e.target.files[0];
        if (!fichier) return;
        const id = Number(input.dataset.uploadJustificatif);
        const d = this._data.find(x => x.id === id);
        if (!d) return;
        const reader = new FileReader();
        reader.onload = () => {
          d.justificatifDataUrl = reader.result;
          d.justificatifNom = fichier.name;
          // Joindre le devis signé = accepté (05/09/2026) — sauf s'il est
          // déjà Refusé, jamais écrasé par erreur.
          if (d.statut !== 'Accepté' && d.statut !== 'Refusé') d.statut = 'Accepté';
          d.modifieLe = this._dateHeureLocale(new Date());
          // TODO Firebase Storage : uploader le fichier réel au lieu de le
          // garder en data URL en mémoire (perdu au rechargement pour
          // l'instant, comme le reste des données tant que Firebase n'est
          // pas branché).
          this.render(this._root);
        };
        reader.readAsDataURL(fichier);
      });
    });

    container.querySelectorAll('[data-supprimer-justificatif]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number(btn.dataset.supprimerJustificatif);
        const d = this._data.find(x => x.id === id);
        if (!d) return;
        window.confirmerAction('Retirer le justificatif de ce devis ?', () => {
          delete d.justificatifDataUrl;
          delete d.justificatifNom;
          d.modifieLe = this._dateHeureLocale(new Date());
          this.render(this._root);
        });
      });
    });

    // Case "Signé" sans fichier (05/09/2026) — même effet que joindre un
    // fichier côté statut (passe Accepté), juste sans pièce jointe.
    container.querySelectorAll('[data-toggle-signe]').forEach(cb => {
      cb.addEventListener('click', (e) => e.stopPropagation());
      cb.addEventListener('change', () => {
        if (!cb.checked) return; // décocher n'existe pas ici — voir data-annuler-signe
        const id = Number(cb.dataset.toggleSigne);
        const d = this._data.find(x => x.id === id);
        if (!d) return;
        d.signeSansFichier = true;
        if (d.statut !== 'Accepté' && d.statut !== 'Refusé') d.statut = 'Accepté';
        d.modifieLe = this._dateHeureLocale(new Date());
        this.render(this._root);
      });
    });
    container.querySelectorAll('[data-annuler-signe]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number(btn.dataset.annulerSigne);
        const d = this._data.find(x => x.id === id);
        if (!d) return;
        delete d.signeSansFichier;
        d.modifieLe = this._dateHeureLocale(new Date());
        this.render(this._root);
      });
    });

    // Générer une facture (Acompte/Solde/Complète) directement depuis le
    // devis (05/09/2026) — sans passer par "Convertir en projet".
    container.querySelectorAll('[data-generer-facture]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number(btn.dataset.genererFacture);
        const type = btn.dataset.typeFacture;
        const d = this._data.find(x => x.id === id);
        if (d) this._genererFacture(d, type);
      });
    });
  },
};

/* ═══════════════════════════════════════════════════════════
   MODULE DASHBOARD — le cockpit. Données mock tant que Firebase
   n'est pas branché (window.FIREBASE_READY === false) ; une fois
   branché, remplacer les blocs MOCK par de vraies requêtes
   Firestore (voir commentaires "TODO Firebase").
═══════════════════════════════════════════════════════════ */

window.Modules = window.Modules || {};

window.Modules.dashboard = {

  async render(container) {
    // TODO Firebase : remplacer par une vraie requête sur `payments`,
    // `subscriptions`, `settings` (taux URSSAF, seuil TVA) une fois configuré.
    this._root = container.closest('#content') || container;
    const data = window.FIREBASE_READY
      ? await window.Modules.dashboard._fetchReal()
      : window.Modules.dashboard._mock();

    container.innerHTML = window.Modules.dashboard._html(data);
    window.hydrateIcons(container);
    window.Modules.dashboard._bindEvents(container);
  },

  // ── Déclarations récurrentes (URSSAF + Actualisation France Travail)
  // ── (corrigé le 04/09/2026, dates fausses avant) ─────────────────────
  // Erreur trouvée le 04/09/2026 : la version précédente traitait les
  // deux comme dues "le 1er du mois", et affichait "en retard" dès le 2
  // — complètement faux, et ça a fait flipper Tiphaine pour rien. Vraies
  // règles (vérifiées par recherche web, jamais depuis la mémoire) :
  // - URSSAF (déclaration mensuelle, choix de Tiphaine) : le CA encaissé
  //   du mois M se déclare entre le 1er et le DERNIER JOUR du mois M+1.
  //   Donc le CA d'août se déclare avant le 30 septembre — pas "le 1er
  //   septembre".
  // - Actualisation France Travail : fenêtre entre le 28 du mois M et le
  //   15 du mois M+1 à minuit (26 en février). En dehors de cette
  //   fenêtre (du 16 au 27), rien n'est dû, pas d'alerte à afficher.
  // TODO Firebase : remplacer localStorage par une collection `declarations`
  // ({ periode:'2026-08', type:'urssaf'|'pole_emploi', valideLe:timestamp }).
  _declTypes: [
    { kind:'urssaf', label:'Déclaration URSSAF' },
    { kind:'pole_emploi', label:'Actualisation France Travail' },
  ],

  _moisLabel(periodeYYYYMM) {
    const [an, mois] = periodeYYYYMM.split('-').map(Number);
    return new Date(an, mois - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  },
  _dateLabel(date) {
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  },

  _getDeclState() {
    try { return JSON.parse(localStorage.getItem('tos_declarations') || '{}'); }
    catch (e) { return {}; }
  },

  _setDeclValidee(periode, kind, val) {
    const state = this._getDeclState();
    state[periode] = state[periode] || {};
    state[periode][kind] = val;
    localStorage.setItem('tos_declarations', JSON.stringify(state));
    // TODO Firebase : window.db.collection('declarations').doc(`${periode}_${kind}`).set({ periode, kind, validee: val, valideLe: new Date() })
  },

  // URSSAF : rappel calé sur M0 (05/09/2026, choix explicite de Tiphaine
  // après comparaison avec son vrai calendrier URSSAF — voir DEV_NOTES et
  // modules/calendrier.js) — période à déclarer = le mois EN COURS,
  // échéance = dernier jour de ce même mois. Volontairement plus strict
  // que la vraie échéance URSSAF (qui ouvre en général le mois suivant) :
  // le but est de se rappeler de tout boucler avant la fin du mois,
  // jamais en retard, quitte à s'y prendre tôt.
  _infosUrssaf() {
    const auj = new Date();
    const periode = `${auj.getFullYear()}-${String(auj.getMonth() + 1).padStart(2, '0')}`;
    const dateLimite = new Date(auj.getFullYear(), auj.getMonth() + 1, 0); // dernier jour du mois en cours
    const joursRestants = Math.ceil((dateLimite - new Date(auj.getFullYear(), auj.getMonth(), auj.getDate())) / 86400000);
    return { periode, dateLimite, joursRestants };
  },

  // Actualisation France Travail : fenêtre glissante 28→15, cf. commentaire
  // en tête de section.
  _infosActualisation() {
    const auj = new Date();
    const jour = auj.getDate();
    if (jour <= 15) {
      // Fenêtre ouverte pour le mois précédent, ferme le 15 de ce mois-ci.
      const moisPrecedent = new Date(auj.getFullYear(), auj.getMonth() - 1, 1);
      const periode = `${moisPrecedent.getFullYear()}-${String(moisPrecedent.getMonth() + 1).padStart(2, '0')}`;
      const dateLimite = new Date(auj.getFullYear(), auj.getMonth(), 15);
      const joursRestants = Math.ceil((dateLimite - new Date(auj.getFullYear(), auj.getMonth(), auj.getDate())) / 86400000);
      return { ouvert: true, periode, dateLimite, joursRestants };
    }
    if (jour >= 28) {
      // Fenêtre ouverte pour ce mois-ci, ferme le 15 du mois prochain.
      const periode = `${auj.getFullYear()}-${String(auj.getMonth() + 1).padStart(2, '0')}`;
      const dateLimite = new Date(auj.getFullYear(), auj.getMonth() + 1, 15);
      const joursRestants = Math.ceil((dateLimite - new Date(auj.getFullYear(), auj.getMonth(), auj.getDate())) / 86400000);
      return { ouvert: true, periode, dateLimite, joursRestants };
    }
    // Entre le 16 et le 27 : aucune fenêtre active, rien à faire.
    return { ouvert: false, prochaineOuverture: new Date(auj.getFullYear(), auj.getMonth(), 28) };
  },

  _alertesDeclarations() {
    const state = this._getDeclState();
    const alertes = [];

    // URSSAF
    const u = this._infosUrssaf();
    const uValidee = !!(state[u.periode] && state[u.periode].urssaf);
    if (uValidee) {
      alertes.push({ type: 'projet', text: 'Déclaration URSSAF', sub: `CA de ${this._moisLabel(u.periode)} validé — prochaine échéance le ${this._dateLabel(new Date(u.dateLimite.getFullYear(), u.dateLimite.getMonth() + 1, 0))}`, action: 'Voir' });
    } else if (u.joursRestants >= 0) {
      alertes.push({ type: u.joursRestants <= 3 ? 'attention' : 'info', text: 'Déclaration URSSAF', sub: `CA de ${this._moisLabel(u.periode)} à déclarer avant le ${this._dateLabel(u.dateLimite)} (dans ${u.joursRestants} jour${u.joursRestants > 1 ? 's' : ''})`, action: 'Valider', valider: { periode: u.periode, kind: 'urssaf' } });
    } else {
      alertes.push({ type: 'urgent', text: 'Déclaration URSSAF', sub: `En retard de ${-u.joursRestants} jour${-u.joursRestants > 1 ? 's' : ''} — CA de ${this._moisLabel(u.periode)} pas encore déclaré`, action: 'Valider', valider: { periode: u.periode, kind: 'urssaf' } });
    }

    // Actualisation France Travail
    const a = this._infosActualisation();
    if (!a.ouvert) {
      alertes.push({ type: 'projet', text: 'Actualisation France Travail', sub: `Rien à faire pour l'instant — prochaine fenêtre le ${this._dateLabel(a.prochaineOuverture)}`, action: 'Voir' });
    } else {
      const aValidee = !!(state[a.periode] && state[a.periode].pole_emploi);
      if (aValidee) {
        alertes.push({ type: 'projet', text: 'Actualisation France Travail', sub: `Fait pour ${this._moisLabel(a.periode)} — clôture de la fenêtre le ${this._dateLabel(a.dateLimite)}`, action: 'Voir' });
      } else if (a.joursRestants >= 0) {
        alertes.push({ type: a.joursRestants <= 3 ? 'attention' : 'info', text: 'Actualisation France Travail', sub: `À faire avant le ${this._dateLabel(a.dateLimite)} à minuit (dans ${a.joursRestants} jour${a.joursRestants > 1 ? 's' : ''}) — le plus tôt possible plutôt que d'attendre`, action: 'Valider', valider: { periode: a.periode, kind: 'pole_emploi' } });
      } else {
        alertes.push({ type: 'urgent', text: 'Actualisation France Travail', sub: `Fenêtre fermée depuis ${-a.joursRestants} jour${-a.joursRestants > 1 ? 's' : ''} — inscription probablement suspendue, à vérifier`, action: 'Valider', valider: { periode: a.periode, kind: 'pole_emploi' } });
      }
    }

    return alertes;
  },

  // ── Acompte non reçu / solde à réclamer (03/09/2026, revu le même
  // jour) ───────────────────────────────────────────────────────────
  // Remplace l'ancien suivi `paye`/`dateEcheancePaiement` posé sur les
  // Devis (faisait doublon) : conforme au cahier des charges d'origine
  // de Tiphaine, le suivi acompte/solde vit sur la fiche Projet (section
  // "Commercial"), pas sur le devis ni dans un onglet Finances séparé.
  // Un devis Accepté n'est qu'une étape commerciale — c'est le Projet
  // qui porte le paiement réel. Lazy-init du module Projets si sa page
  // n'a jamais été ouverte (même pattern que Devis/Renouvellements).
  _alertesProjetsPaiement() {
    const projets = window.Modules && window.Modules.projets;
    if (!projets) return [];
    if (!projets._data) projets._data = window.FIREBASE_READY ? [] : projets._mock();
    const alertes = [];
    projets._data.forEach(p => {
      const statut = projets._statutPaiement(p);
      if (statut === 'acompte_attente') {
        alertes.push({
          type: 'urgent',
          text: `Acompte non reçu — ${p.client}`,
          sub: `${projets._montantAcompte(p).toLocaleString('fr-FR')} € attendus avant de démarrer "${p.nom}"`,
          action: 'Vérifier',
          lienHash: '#/projets',
        });
      } else if (statut === 'solde_attente') {
        alertes.push({
          type: 'attention',
          text: `Solde à réclamer — ${p.client}`,
          sub: `${projets._montantSolde(p).toLocaleString('fr-FR')} € restants sur "${p.nom}" (livré)`,
          action: 'Relancer',
          lienHash: '#/projets',
        });
      }
    });
    return alertes;
  },

  // ── Tickets ouverts / Devis à relancer (03/09/2026) ─────────────
  // Mêmes sources que les pastilles de sidebar (`window.majBadgesNav`,
  // app.js) — un seul endroit qui définit "c'est urgent", réutilisé
  // aussi bien ici que par la cloche de notification.
  _alertesTickets() {
    const tickets = window.Modules && window.Modules.tickets;
    if (!tickets) return [];
    if (!tickets._data) tickets._data = window.FIREBASE_READY ? [] : tickets._mock();
    return tickets._data.filter(t => t.statut === 'Ouvert').map(t => ({
      type: 'attention',
      text: `Ticket ouvert — ${t.client}`,
      sub: t.sujet,
      action: 'Traiter',
      lienHash: '#/tickets',
    }));
  },
  _alertesDevisRelance() {
    const devis = window.Modules && window.Modules.devis;
    const catalogue = window.Modules && window.Modules.catalogue;
    if (!devis) return [];
    if (!devis._data) devis._data = window.FIREBASE_READY ? [] : devis._mock();
    // Seuil paramétrable depuis Paramétrage > Général (04/09/2026) —
    // avant, 5 jours codé en dur ici.
    const seuil = (catalogue ? catalogue._getEntreprise().relanceDevisJours : null) || 5;
    const pad = (n) => String(n).padStart(2, '0');
    const auj = new Date();
    const aujStr = `${auj.getFullYear()}-${pad(auj.getMonth() + 1)}-${pad(auj.getDate())}`;
    return devis._data.filter(d => {
      if (d.statut !== 'Envoyé') return false;
      return Math.round((new Date(aujStr) - new Date(d.date)) / 86400000) >= seuil;
    }).map(d => {
      const jours = Math.round((new Date(aujStr) - new Date(d.date)) / 86400000);
      return {
        type: 'attention',
        text: `Devis sans réponse — ${d.client}`,
        sub: `Envoyé il y a ${jours} jours, à relancer`,
        action: 'Relancer',
        lienHash: '#/devis',
      };
    });
  },

  // ── Échéances Technique (04/09/2026) ────────────────────────────
  // Domaines/hébergement à échéance ≤ 60 jours (paliers J-60/30/7/1 du
  // cahier des charges). Remplace `_alertesRenouvellements()` — le
  // module Renouvellements a été fusionné dans le nouveau module
  // Technique (Domaines + Hébergement), qui porte maintenant beaucoup
  // plus de détail (registrar, renouvellement auto, serveur, projet
  // associé...). Une seule source de vérité plutôt que deux listes
  // d'échéances à tenir à jour en parallèle (choix de Tiphaine).
  _alertesTechnique() {
    const technique = window.Modules && window.Modules.technique;
    if (!technique) return [];
    if (!technique._data) technique._data = window.FIREBASE_READY ? technique._mock() : technique._getData();
    return technique._alertesExpirations();
  },

  _mock() {
    // Corrigé le 04/09/2026 en même temps que la refonte des échéances
    // (ancienne méthode `_joursAvantProchain1er` supprimée du fichier
    // mais encore appelée ici — plantait tout le rendu du Dashboard,
    // "Chargement..." bloqué indéfiniment. Repris depuis `_infosUrssaf()`.
    const infosUrssaf = this._infosUrssaf();
    const urssafEcheanceJours = infosUrssaf.joursRestants;
    // CA/MRR réels (03/09/2026) — calculés par modules/finances.js à
    // partir de Devis/Projets/Abonnements/Clients, plus de chiffres
    // inventés ici. `tvaCA` reprend `caAnnuel` (même base 12 mois
    // glissants, cohérence voulue). `urssafCA` utilise `caEncaisse`
    // total comme approximation du "CA encaissé ce mois-ci" — limite
    // connue tant qu'aucun paiement n'a de date propre (voir
    // finances.js, en-tête du fichier).
    const finances = window.Modules.finances ? window.Modules.finances._calculs() : {
      caEncaisse:0, caFacture:0, mrr:0, caAnnuel:0, nbClients:0, nbAbonnements:0,
    };
    // Seuils fiscaux (04/09/2026) — plus codés en dur, lus depuis
    // Paramétrage > Général (valeurs 2026 vérifiées par défaut, voir
    // catalogue.js `_entrepriseParDefaut`).
    const catalogue = window.Modules.catalogue;
    const entreprise = catalogue ? catalogue._getEntreprise() : { seuilTvaBase:37500, urssafTaux:25.6 };
    return {
      dateStr: new Date().toLocaleDateString('fr-FR', { weekday:'long', year:'numeric', month:'long', day:'numeric' }),
      caEncaisse: finances.caEncaisse,
      caFacture: finances.caFacture,
      mrr: finances.mrr,
      caAnnuel: finances.caAnnuel, // même base que le seuil TVA (12 mois glissants) — cohérent par construction
      nbClients: finances.nbClients,
      nbAbonnements: finances.nbAbonnements,
      tvaSeuil: entreprise.seuilTvaBase || 37500,
      tvaCA: finances.caAnnuel,
      urssafCA: finances.caEncaisse,
      urssafTaux: entreprise.urssafTaux || 25.6,
      urssafEcheanceJours,
      urssafDateLimite: this._dateLabel(infosUrssaf.dateLimite),
      alertes: [
        ...this._alertesDeclarations(),
        ...this._alertesProjetsPaiement(),
        ...this._alertesTickets(),
        ...this._alertesDevisRelance(),
        ...this._alertesTechnique(),
        // Les deux exemples fictifs (forfait "Club X", projet "CommandesPro")
        // ont été retirés le 04/09/2026 en même temps que le reste des
        // données de démo — ils n'étaient branchés sur rien de réel.
      ],
    };
  },

  async _fetchReal() {
    // TODO Firebase — squelette de requête, à activer une fois les
    // collections `payments`, `subscriptions`, `clients` peuplées.
    // const paymentsSnap = await window.db.collection('payments').get();
    // ...
    return window.Modules.dashboard._mock(); // fallback tant que non implémenté
  },

  _pct(a, b) { return Math.min(100, Math.round((a / b) * 100)); },

  _gaugeClass(pct) { return pct >= 90 ? 'danger' : pct >= 70 ? 'warn' : ''; },

  _html(d) {
    const tvaPct = this._pct(d.tvaCA, d.tvaSeuil);
    const urssafMontant = Math.round(d.urssafCA * (d.urssafTaux / 100));
    const alertDot = { urgent:'alert-dot-red', attention:'alert-dot-orange', info:'alert-dot-blue', projet:'alert-dot-green' };

    return `
      <div class="page-title"><span class="nav-icon" data-icon="handWave"></span>Bonjour Tiphaine</div>
      <div class="page-sub">${d.dateStr} — voici ce qui mérite ton attention aujourd'hui.</div>

      <div class="grid grid-4 dash-kpis" style="margin-bottom:20px;">
        <div class="card">
          <div class="stat-label">CA du mois</div>
          <div class="stat-value">${d.caEncaisse.toLocaleString('fr-FR')} €</div>
          <div class="stat-sub">${d.caFacture.toLocaleString('fr-FR')} € facturés</div>
        </div>
        <div class="card">
          <div class="stat-label">MRR</div>
          <div class="stat-value">${d.mrr.toLocaleString('fr-FR')} €</div>
          <div class="stat-sub">${d.nbAbonnements} abonnements actifs</div>
        </div>
        <div class="card">
          <div class="stat-label">CA annuel (12 mois glissants)</div>
          <div class="stat-value">${d.caAnnuel.toLocaleString('fr-FR')} €</div>
        </div>
        <div class="card">
          <div class="stat-label">Clients actifs</div>
          <div class="stat-value">${d.nbClients}</div>
        </div>
      </div>

      <div class="grid grid-2" style="margin-bottom:20px;">
        <div class="card">
          <div class="stat-label">Seuil TVA (franchise en base)</div>
          <div class="stat-value" style="font-size:16px;">${d.tvaCA.toLocaleString('fr-FR')} € / ${d.tvaSeuil.toLocaleString('fr-FR')} €</div>
          <div class="gauge-track"><div class="gauge-fill ${this._gaugeClass(tvaPct)}" style="width:${tvaPct}%"></div></div>
          <div class="stat-sub">${tvaPct}% du seuil — ${tvaPct >= 90 ? 'proche, vigilance' : tvaPct >= 70 ? 'à surveiller' : 'confortable'}</div>
        </div>
        <div class="card">
          <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:16px; flex-wrap:wrap;">
            <div style="flex:1; min-width:170px;">
              <div class="stat-label">URSSAF à provisionner</div>
              <div class="stat-value" style="font-size:16px;">${urssafMontant.toLocaleString('fr-FR')} €</div>
              <div class="stat-sub">${d.urssafCA.toLocaleString('fr-FR')} € encaissés × ${d.urssafTaux}%</div>
            </div>
            <div style="text-align:right; padding-left:16px; border-left:1px solid var(--border-subtle);">
              <div class="stat-label">CA − URSSAF</div>
              <div class="stat-value" style="font-size:16px; color:#6ec88c;">${(d.urssafCA - urssafMontant).toLocaleString('fr-FR')} €</div>
              <div class="stat-sub">reste net encaissé</div>
            </div>
          </div>
          <div class="stat-sub" style="color:#f0c27f; font-weight:600; margin-top:10px;">À déclarer avant le ${d.urssafDateLimite} (dans ${d.urssafEcheanceJours} jour${d.urssafEcheanceJours > 1 ? 's' : ''})</div>
        </div>
      </div>

      <div class="card">
        <div class="section-title"><span class="nav-icon" data-icon="checklist"></span>À ne pas oublier</div>
        ${d.alertes.map(a => `
          <div class="alert-row">
            <div class="alert-row-main">
              <div class="alert-dot ${alertDot[a.type] || 'alert-dot-grey'}"></div>
              <div>
                <div class="alert-text">${a.text}</div>
                <div class="alert-sub">${a.sub}</div>
              </div>
            </div>
            ${a.valider
              ? `<button class="alert-action" data-valider-periode="${a.valider.periode}" data-valider-kind="${a.valider.kind}">${a.action} →</button>`
              : a.lienHash
              ? `<button class="alert-action" data-lien-hash="${a.lienHash}">${a.action} →</button>`
              : `<button class="alert-action" data-alert="${a.text}">${a.action} →</button>`}
          </div>
        `).join('')}
      </div>

    `;
  },

  _bindEvents(container) {
    container.querySelectorAll('[data-alert]').forEach(btn => {
      btn.addEventListener('click', () => alert('Action à venir : ' + btn.dataset.alert));
    });

    // Alertes branchées sur de vraies données (factures, renouvellements,
    // 03/09/2026) → clic = direct vers la page concernée.
    container.querySelectorAll('[data-lien-hash]').forEach(btn => {
      btn.addEventListener('click', () => { location.hash = btn.dataset.lienHash; });
    });

    container.querySelectorAll('[data-valider-kind]').forEach(btn => {
      btn.addEventListener('click', () => {
        const { validerPeriode, validerKind } = btn.dataset;
        this._setDeclValidee(validerPeriode, validerKind, true);
        this.render(this._root);
      });
    });
  },
};

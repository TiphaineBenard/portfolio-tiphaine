/* ═══════════════════════════════════════════════════════════
   MODULE FINANCES — dashboard financier (V2 du cahier des charges
   d'origine de Tiphaine, section 17). Page 100% lecture seule : calcule
   tout à partir des vraies données déjà saisies ailleurs (Projets,
   Devis, Abonnements, Clients) — aucune nouvelle saisie ici, aucun
   mock séparé. `_calculs()` est LA source de vérité pour tous les
   chiffres financiers de l'appli ; dashboard.js l'appelle aussi pour
   remplacer ses anciens chiffres fictifs (03/09/2026).

   Limite connue (documentée, pas résolue ici) : `acompteRecu`/
   `soldePaye` (projets.js) sont de simples booléens sans date
   d'encaissement — impossible pour l'instant de savoir PENDANT QUEL
   MOIS un paiement est tombé. `urssafCA` (dashboard.js) utilise donc
   `caEncaisse` total (tout confondu) comme approximation plutôt qu'un
   vrai "CA encaissé CE mois-ci". Pour corriger proprement, il
   faudrait ajouter un champ date sur chaque paiement — pas fait ici
   pour rester sur le périmètre "Finances" demandé.
═══════════════════════════════════════════════════════════ */

window.Modules = window.Modules || {};

window.Modules.finances = {
  async render(container) {
    this._root = container.closest('#content') || container;
    container.innerHTML = this._html(this._calculs());
    window.hydrateIcons(container);
    this._bindEvents(container);
  },

  // Lazy-init de tous les modules sources — les chiffres doivent être
  // exacts même si Tiphaine n'a encore jamais ouvert Devis/Projets/
  // Abonnements/Clients (même pattern que dashboard.js).
  _lazyInit() {
    const m = window.Modules;
    if (m.projets && !m.projets._data) m.projets._data = window.FIREBASE_READY ? [] : m.projets._mock();
    if (m.devis && !m.devis._data) m.devis._data = window.FIREBASE_READY ? [] : m.devis._mock();
    if (m.abonnements && !m.abonnements._data) m.abonnements._data = window.FIREBASE_READY ? [] : m.abonnements._mock();
    if (m.clients && !m.clients._data) m.clients._data = window.FIREBASE_READY ? [] : m.clients._mock();
  },

  // Classement grossier "Sites / Applications / Autre" à partir du nom
  // du projet — pas de champ dédié pour l'instant côté Projets.
  _classifierActivite(nom) {
    const n = (nom || '').toLowerCase();
    if (n.includes('site')) return 'Sites';
    if (n.includes('app')) return 'Applications';
    return 'Autre';
  },

  // Objectif de CA mensuel (04/09/2026) — simple valeur éditable
  // directement sur la page Finances, stockée en local. Comparé au CA
  // FACTURÉ du mois en cours (nouveaux projets signés ce mois-ci) —
  // pas au CA encaissé, dont on n'a pas le détail mois par mois (voir
  // limite en tête de fichier).
  _getObjectifMensuel() {
    return parseInt(localStorage.getItem('tos_objectif_ca_mensuel') || '0', 10);
  },
  _setObjectifMensuel(montant) {
    localStorage.setItem('tos_objectif_ca_mensuel', String(montant));
  },

  _calculs() {
    this._lazyInit();
    const projetsM = window.Modules.projets;
    const projets = (projetsM && projetsM._data) || [];
    const devis = (window.Modules.devis && window.Modules.devis._data) || [];
    const abos = (window.Modules.abonnements && window.Modules.abonnements._data) || [];
    const clients = (window.Modules.clients && window.Modules.clients._data) || [];
    const grille = window.Modules.abonnements ? window.Modules.abonnements._getGrille() : {};
    const catalogue = window.Modules.catalogue;
    const entreprise = catalogue ? catalogue._getEntreprise() : {};

    let caEncaisse = 0, caFacture = 0, resteAEncaisserProjets = 0;
    const caParClient = {};
    const caParActivite = { Sites: 0, Applications: 0, Autre: 0 };
    const caParMois = {}; // 'YYYY-MM' -> montant

    const pad = (n) => String(n).padStart(2, '0');
    const auj = new Date();
    const moisCourant = `${auj.getFullYear()}-${pad(auj.getMonth() + 1)}`;
    let caFactureMoisCourant = 0;

    projets.forEach(p => {
      caFacture += p.montant;
      const acompte = projetsM._montantAcompte(p);
      const solde = projetsM._montantSolde(p);
      if (p.acompteRecu) caEncaisse += acompte; else resteAEncaisserProjets += acompte;
      if (p.soldePaye) caEncaisse += solde; else resteAEncaisserProjets += solde;

      caParClient[p.client] = (caParClient[p.client] || 0) + p.montant;
      caParActivite[this._classifierActivite(p.nom)] += p.montant;

      const mois = (p.dateDebut || '').slice(0, 7);
      if (mois) caParMois[mois] = (caParMois[mois] || 0) + p.montant;
      if (mois === moisCourant) caFactureMoisCourant += p.montant;
    });

    // Pipeline commercial (devis envoyés, pas encore acceptés) — vient
    // s'ajouter au reste à encaisser sur les projets déjà engagés pour
    // former le CA prévisionnel.
    const pipeline = devis.filter(d => d.statut === 'Envoyé').reduce((s, d) => s + d.montant, 0);
    const caPrevisionnel = resteAEncaisserProjets + pipeline;

    const mrr = abos.reduce((s, a) => s + ((grille[a.formule] && grille[a.formule].mrr) || 0), 0);
    // Corrigé le 04/09/2026 : "Répartition par activité" doit refléter du
    // CA RÉEL déjà généré (comme Sites/Applications/Autre, qui somment les
    // projets facturés depuis toujours) — pas une projection. L'ancien
    // calcul faisait `mrr * 12` peu importe depuis quand l'abonnement
    // existe (un abonnement démarré le mois dernier comptait déjà pour 12
    // mois de CA, ce qui n'a aucun sens). Nouveau calcul : pour chaque
    // abonnement, MRR × nombre de mois réellement écoulés depuis
    // `dateDebut` (mois en cours inclus, minimum 1 mois).
    caParActivite.Abonnements = abos.reduce((s, a) => {
      const g = grille[a.formule];
      if (!g) return s;
      const [an, m] = (a.dateDebut || '').split('-').map(Number);
      if (!an || !m) return s + g.mrr; // date manquante -> au moins 1 mois
      const debut = new Date(an, m - 1, 1);
      const moisEcoules = Math.max(1, (auj.getFullYear() - debut.getFullYear()) * 12 + (auj.getMonth() - debut.getMonth()) + 1);
      return s + g.mrr * moisEcoules;
    }, 0);

    // Trésorerie à venir (04/09/2026) — deux briques séparées plutôt
    // qu'un seul chiffre flou, parce qu'on n'a pas de date précise sur
    // le "reste à encaisser projets" (voir limite en tête de fichier) :
    // - `resteAEncaisserProjets` : argent dû, sans date fiable (haute
    //   confiance sur le montant, aucune sur le "quand").
    // - MRR récurrent : lui EST calendaire et fiable (abonnement actif
    //   = tombe chaque mois), donc projeté proprement sur 30/60/90j.
    const tresorerie30 = resteAEncaisserProjets + mrr;
    const tresorerie60 = resteAEncaisserProjets + mrr * 2;
    const tresorerie90 = resteAEncaisserProjets + mrr * 3;

    // URSSAF : provision sur ce qui est déjà encaissé (à déclarer), et
    // projection sur ce qui va rentrer (pour anticiper, pas pour
    // déclarer maintenant — seul le réellement encaissé se déclare).
    const urssafTaux = entreprise.urssafTaux || 25.6;
    const urssafDejaAProvisionner = Math.round(caEncaisse * (urssafTaux / 100));
    const urssafPrevisionnel30 = Math.round(tresorerie30 * (urssafTaux / 100));
    const urssafPrevisionnel60 = Math.round(tresorerie60 * (urssafTaux / 100));
    const urssafPrevisionnel90 = Math.round(tresorerie90 * (urssafTaux / 100));

    // CA annuel = 12 mois glissants sur les projets facturés (même base
    // que le seuil TVA — cohérence voulue).
    const ilYA12Mois = new Date(auj.getFullYear(), auj.getMonth() - 11, 1);
    const caAnnuel = projets
      .filter(p => p.dateDebut && new Date(p.dateDebut) >= ilYA12Mois)
      .reduce((s, p) => s + p.montant, 0);

    // 12 derniers mois pour le graphique (mois sans projet = 0, pas
    // juste absent, pour que la barre existe quand même).
    const mois12 = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(auj.getFullYear(), auj.getMonth() - i, 1);
      const cle = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
      mois12.push({ cle, label: d.toLocaleDateString('fr-FR', { month: 'short' }), montant: caParMois[cle] || 0 });
    }

    return {
      caEncaisse, caFacture, caPrevisionnel, mrr, caAnnuel,
      nbClients: clients.length,
      nbAbonnements: abos.length,
      caParClient: Object.entries(caParClient).sort((a, b) => b[1] - a[1]),
      caParActivite,
      mois12,
      resteAEncaisserProjets, pipeline,
      tresorerie30, tresorerie60, tresorerie90,
      urssafTaux, urssafDejaAProvisionner, urssafPrevisionnel30, urssafPrevisionnel60, urssafPrevisionnel90,
      seuilTvaBase: entreprise.seuilTvaBase || 37500,
      seuilTvaMajore: entreprise.seuilTvaMajore || 41250,
      plafondMicro: entreprise.plafondMicro || 83600,
      objectifMensuel: this._getObjectifMensuel(),
      caFactureMoisCourant,
    };
  },

  _htmlBarreListe(entries, formatLabel) {
    if (!entries.length) return `<div class="stat-sub" style="padding:8px 0;">Pas encore de données.</div>`;
    const max = Math.max(...entries.map(e => e[1]), 1);
    return entries.map(([label, montant]) => `
      <div class="finances-barre-ligne">
        <div class="finances-barre-label">${formatLabel ? formatLabel(label) : label}</div>
        <div class="gauge-track" style="flex:1;"><div class="gauge-fill" style="width:${Math.round((montant / max) * 100)}%"></div></div>
        <div class="finances-barre-montant">${montant.toLocaleString('fr-FR')} €</div>
      </div>
    `).join('');
  },

  // Ligne repliable "Ce que ça change" (07/09/2026, "trop de texte") —
  // résumé chiffré toujours visible (puce + montant en gras), phrase
  // d'explication masquée derrière un <details> tant qu'on ne tape pas
  // dessus. Même logique que la note "les deux sont liées" plus haut.
  _htmlAeItem(couleur, titre, detail, nom = '') {
    return `
      <details class="finances-ae-item">
        <summary class="finances-ae-item-summary">
          <span class="finances-ae-puce" style="background:${couleur};"></span>
          <strong>${titre}</strong>${nom ? `<span class="finances-ae-nom">${nom}</span>` : ''}
        </summary>
        <div class="finances-ae-item-detail">${detail}</div>
      </details>
    `;
  },

  // Jauge seuils TVA / plafond micro (04/09/2026) — 3 zones sur une
  // échelle allant jusqu'au plafond micro-entreprise, avec des repères
  // aux deux seuils TVA. Couleur du remplissage selon la zone atteinte.
  _htmlJaugeTva(c) {
    const echelle = c.plafondMicro;
    const pct = (v) => Math.min(100, Math.round((v / echelle) * 100));
    let couleur = '#6ec88c', statut = 'confortable';
    if (c.caAnnuel >= c.seuilTvaMajore) { couleur = '#e05c5c'; statut = 'TVA applicable'; }
    else if (c.caAnnuel >= c.seuilTvaBase) { couleur = '#e0a95c'; statut = 'proche du seuil TVA'; }
    return `
      <div class="finances-tva-track">
        <div class="finances-tva-fill" style="width:${pct(c.caAnnuel)}%; background:${couleur};"></div>
        <div class="finances-tva-marker" style="left:${pct(c.seuilTvaBase)}%;"></div>
        <div class="finances-tva-marker" style="left:${pct(c.seuilTvaMajore)}%;"></div>
      </div>
      <!-- 07/09/2026, retour "on voit pas les chiffres" — les seuils
           TVA de base et majoré (37.5k / 41.25k) sont proches sur
           l'échelle (45%/49%), leurs étiquettes se chevauchaient sur
           mobile (carte étroite). 1er essai en quinconce (2 lignes)
           jugé moche ("écarte les plutôt") — écartées horizontalement
           à la place : chacune décalée par rapport à sa position
           exacte (translateX à -100% pour la 1ère, 0% pour la 2e, au
           lieu de -50% centré sur les deux) dès qu'elles sont trop
           proches (moins de 12 points d'écart). Le repère vertical
           (classe .finances-tva-marker) reste lui à la VRAIE position —
           seul le texte se décale pour rester lisible. -->
      <div style="position:relative; height:16px; margin-bottom:6px;">
        <div class="finances-tva-marker-label" style="left:${pct(c.seuilTvaBase)}%; ${pct(c.seuilTvaMajore) - pct(c.seuilTvaBase) < 12 ? 'transform:translateX(-100%); margin-left:-4px;' : ''}">${(c.seuilTvaBase / 1000)}k</div>
        <div class="finances-tva-marker-label" style="left:${pct(c.seuilTvaMajore)}%; ${pct(c.seuilTvaMajore) - pct(c.seuilTvaBase) < 12 ? 'transform:translateX(0); margin-left:4px;' : ''}">${(c.seuilTvaMajore / 1000)}k</div>
        <div class="finances-tva-marker-label" style="left:100%;">${(c.plafondMicro / 1000)}k</div>
      </div>
      <div class="stat-sub">${c.caAnnuel.toLocaleString('fr-FR')} € sur 12 mois glissants — ${statut}</div>
    `;
  },

  // Échéances URSSAF / Actualisation France Travail (04/09/2026) — lit
  // directement dashboard.js `_infosUrssaf()`/`_infosActualisation()`
  // (corrigées le même jour : l'ancienne version affichait "1er du mois"
  // partout, ce qui était faux et faisait croire à Tiphaine qu'elle était
  // en retard). Dates affichées en gros plutôt que noyées dans une
  // phrase — retour explicite de Tiphaine ("on ne voit pas assez les
  // dates, mets-les en valeur").
  _htmlEcheances() {
    const dashboard = window.Modules.dashboard;
    if (!dashboard) return '';
    const u = dashboard._infosUrssaf();
    const a = dashboard._infosActualisation();
    const ligne = (label, dateLimite, joursRestants, sousTexte) => {
      const urgent = joursRestants !== null && joursRestants <= 3;
      return `
        <div class="finances-echeance-ligne">
          <div>
            <div class="finances-echeance-label">${label}</div>
            <div class="stat-sub">${sousTexte}</div>
          </div>
          <div class="finances-echeance-date ${urgent ? 'finances-echeance-urgent' : ''}">
            ${dateLimite ? this._dateLabelCourt(dateLimite) : '—'}
            ${joursRestants !== null ? `<span class="finances-echeance-jours">${joursRestants >= 0 ? `dans ${joursRestants}j` : `${-joursRestants}j de retard`}</span>` : ''}
          </div>
        </div>
      `;
    };
    return `
      ${ligne('Déclaration URSSAF', u.dateLimite, u.joursRestants, `CA de ${dashboard._moisLabel(u.periode)}`)}
      ${a.ouvert
        ? ligne('Actualisation France Travail', a.dateLimite, a.joursRestants, `Situation de ${dashboard._moisLabel(a.periode)}`)
        : ligne('Actualisation France Travail', a.prochaineOuverture, null, `Prochaine fenêtre — rien à faire d'ici là`)}
      <!-- 07/09/2026, retour "le texte en bas prend trop de place" —
           replié par défaut derrière un <details> natif (repliable sans
           JS, accessible au clavier) : le résumé tient sur 1 ligne,
           l'explication complète ne s'affiche qu'au tap. -->
      <details class="finances-ae-details">
        <summary class="finances-ae-summary"><span class="finances-ae-voir-plus">Voir le détail</span></summary>
        <div class="finances-ae-detail-texte">France Travail demande un <strong>justificatif officiel du CA déclaré à l'URSSAF</strong> (PDF téléchargeable sur autoentrepreneur.urssaf.fr). La fenêtre France Travail se ferme AVANT la date limite URSSAF — pour avoir le justificatif à temps, déclare d'abord ton CA à l'URSSAF (rien n'empêche de le faire en avance), télécharge l'attestation, puis fais ton actualisation.</div>
      </details>
    `;
  },
  _dateLabelCourt(date) {
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  },

  _html(c) {
    const maxMois = Math.max(...c.mois12.map(m => m.montant), 1);
    const objectifPct = c.objectifMensuel ? Math.min(100, Math.round((c.caFactureMoisCourant / c.objectifMensuel) * 100)) : 0;
    return `
      <div class="page-header-row">
        <div>
          <div class="page-title"><span class="nav-icon" data-icon="wallet"></span>Finances</div>
          <div class="page-sub">Calculé en direct depuis Devis, Projets et Abonnements — rien à saisir ici.</div>
        </div>
      </div>

      <div class="grid grid-4 finances-kpis" style="margin-bottom:16px;">
        <div class="card">
          <div class="stat-label">CA encaissé</div>
          <div class="stat-value">${c.caEncaisse.toLocaleString('fr-FR')} €</div>
          <div class="stat-sub">Acomptes + soldes réellement reçus</div>
        </div>
        <div class="card">
          <div class="stat-label">CA facturé</div>
          <div class="stat-value">${c.caFacture.toLocaleString('fr-FR')} €</div>
          <div class="stat-sub">Total engagé sur tous les projets</div>
        </div>
        <div class="card">
          <div class="stat-label">CA prévisionnel</div>
          <div class="stat-value">${c.caPrevisionnel.toLocaleString('fr-FR')} €</div>
          <div class="stat-sub">Reste à encaisser + devis envoyés</div>
        </div>
        <div class="card">
          <div class="stat-label">MRR</div>
          <div class="stat-value">${c.mrr.toLocaleString('fr-FR')} €</div>
          <div class="stat-sub">${c.nbAbonnements} abonnement${c.nbAbonnements > 1 ? 's' : ''} actif${c.nbAbonnements > 1 ? 's' : ''}</div>
        </div>
      </div>

      <div class="grid grid-2" style="margin-bottom:16px;">
        <div class="card">
          <div class="stat-label">CA annuel (12 mois glissants)</div>
          <div class="stat-value">${c.caAnnuel.toLocaleString('fr-FR')} €</div>
          <div class="stat-sub">Même base que le seuil TVA sur le Dashboard</div>
        </div>
        <div class="card">
          <div class="stat-label">Clients actifs</div>
          <div class="stat-value">${c.nbClients}</div>
          <div class="stat-sub">Revenu moyen : ${c.nbClients ? Math.round(c.caFacture / c.nbClients).toLocaleString('fr-FR') : 0} € / client</div>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px;">
        <div class="section-title">Objectif de CA (ce mois)</div>
        <div class="stat-value">${c.caFactureMoisCourant.toLocaleString('fr-FR')} € ${c.objectifMensuel ? `<span style="font-size:13px; font-weight:400; color:var(--text-muted);">/ ${c.objectifMensuel.toLocaleString('fr-FR')} €</span>` : ''}</div>
        ${c.objectifMensuel ? `
          <div class="gauge-track" style="margin:8px 0 4px;"><div class="gauge-fill" style="width:${objectifPct}%"></div></div>
          <div class="stat-sub">${objectifPct}% de l'objectif — nouveaux projets signés ce mois-ci</div>
        ` : `<div class="stat-sub">Pas d'objectif défini — mets-en un ci-dessous.</div>`}
        <div style="display:flex; gap:8px; align-items:center; margin-top:12px;">
          <input type="number" id="finances-objectif-input" class="param-input-inline" style="width:120px;" min="0" placeholder="Objectif (€)" value="${c.objectifMensuel || ''}">
          <button type="button" class="btn-ghost" id="finances-objectif-save" style="padding:7px 13px; font-size:12px; border-radius:8px;">Enregistrer</button>
        </div>
      </div>

      <div class="grid grid-2" style="margin-bottom:16px;">
        <div class="card">
          <div class="section-title">Trésorerie à venir</div>
          <div class="finances-barre-ligne" style="padding:5px 0;"><div class="finances-barre-label" style="width:60px;">30 jours</div><div class="finances-barre-montant" style="width:auto; margin-left:auto;">${c.tresorerie30.toLocaleString('fr-FR')} €</div></div>
          <div class="finances-barre-ligne" style="padding:5px 0;"><div class="finances-barre-label" style="width:60px;">60 jours</div><div class="finances-barre-montant" style="width:auto; margin-left:auto;">${c.tresorerie60.toLocaleString('fr-FR')} €</div></div>
          <div class="finances-barre-ligne" style="padding:5px 0;"><div class="finances-barre-label" style="width:60px;">90 jours</div><div class="finances-barre-montant" style="width:auto; margin-left:auto;">${c.tresorerie90.toLocaleString('fr-FR')} €</div></div>
          <div class="stat-sub" style="margin-top:6px;">${c.resteAEncaisserProjets.toLocaleString('fr-FR')} € déjà dus (projets en cours, sans date précise) + MRR projeté${c.pipeline ? ` — pipeline devis (${c.pipeline.toLocaleString('fr-FR')} €) non inclus, pas encore signé` : ''}</div>
        </div>
        <div class="card">
          <div class="section-title">URSSAF à provisionner</div>
          <div class="stat-value" style="font-size:18px;">${c.urssafDejaAProvisionner.toLocaleString('fr-FR')} €</div>
          <div class="stat-sub" style="margin-bottom:10px;">Sur le CA déjà encaissé (${c.urssafTaux}% — taux BIC prestations de services, vérifiable dans Paramétrage &gt; Général)</div>
          <div class="finances-barre-ligne" style="padding:4px 0;"><div class="finances-barre-label" style="width:60px;">+30j</div><div class="finances-barre-montant" style="width:auto; margin-left:auto;">${c.urssafPrevisionnel30.toLocaleString('fr-FR')} €</div></div>
          <div class="finances-barre-ligne" style="padding:4px 0;"><div class="finances-barre-label" style="width:60px;">+60j</div><div class="finances-barre-montant" style="width:auto; margin-left:auto;">${c.urssafPrevisionnel60.toLocaleString('fr-FR')} €</div></div>
          <div class="finances-barre-ligne" style="padding:4px 0;"><div class="finances-barre-label" style="width:60px;">+90j</div><div class="finances-barre-montant" style="width:auto; margin-left:auto;">${c.urssafPrevisionnel90.toLocaleString('fr-FR')} €</div></div>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px;">
        <div class="section-title">Échéances administratives</div>
        ${this._htmlEcheances()}
      </div>

      <div class="card" style="margin-bottom:16px;">
        <div class="section-title">Seuils TVA / micro-entreprise</div>
        ${this._htmlJaugeTva(c)}
      </div>

      <div class="card" style="margin-bottom:16px;">
        <div class="finances-cta-row">
          <div class="section-title">Ce que ça change (auto-entrepreneur, valeurs 2026)</div>
          <a href="https://www.autoentrepreneur.urssaf.fr/portail/accueil/sinformer-sur-le-statut/lessentiel-du-statut.html" target="_blank" rel="noopener" style="font-size:12px; color:var(--text-muted); white-space:nowrap; text-decoration:underline;">Vérifier sur urssaf.fr ↗</a>
        </div>
        <!-- 07/09/2026, retour "pareil y'a trop de texte ici" (même
             logique que la note "les deux sont liées" plus haut) —
             chaque puce ne montre plus que son résumé chiffré en
             permanence ; l'explication complète se déplie au tap
             (<details> natif, pas de JS). -->
        ${this._htmlAeItem('#6ec88c', `Jusqu'à ${(c.seuilTvaBase).toLocaleString('fr-FR')} €`, `Rien à faire, pas de TVA à facturer ni à déclarer.`, `Franchise en base`)}
        ${this._htmlAeItem('#e0a95c', `Entre ${(c.seuilTvaBase).toLocaleString('fr-FR')} € et ${(c.seuilTvaMajore).toLocaleString('fr-FR')} €`, `Tolérance : la TVA ne devient obligatoire que si tu es encore au-dessus au 31/12, et alors à compter du 1er janvier suivant.`, `Tolérance`)}
        ${this._htmlAeItem('#e05c5c', `Au-delà de ${(c.seuilTvaMajore).toLocaleString('fr-FR')} €`, `TVA obligatoire immédiatement, dès le 1er jour du mois de dépassement : facturer la TVA à tes clients, la déclarer, et changer la mention légale sur tes devis ("TVA non applicable" ne s'applique plus).`, `TVA obligatoire`)}
        ${this._htmlAeItem('var(--text-muted)', `Plafond micro-entreprise : ${(c.plafondMicro).toLocaleString('fr-FR')} €`, `Tu restes en micro-entreprise même au-dessus du seuil TVA. Tu ne sors du régime micro que si tu dépasses ce plafond deux années civiles de suite (bascule au régime réel — comptabilité différente).`)}
        <div class="stat-sub" style="margin-top:10px;">Seuils modifiables dans Paramétrage &gt; Général si les règles changent d'une année sur l'autre.</div>
      </div>

      <div class="card" style="margin-bottom:16px;">
        <div class="section-title">CA mensuel (12 derniers mois)</div>
        <div class="finances-mois-graphe">
          ${c.mois12.map(m => `
            <div class="finances-mois-col">
              <div class="finances-mois-barre" style="height:${Math.round((m.montant / maxMois) * 100)}%" title="${m.montant.toLocaleString('fr-FR')} €"></div>
              <div class="finances-mois-label">${m.label}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="grid grid-2">
        <div class="card">
          <div class="section-title">CA par client</div>
          ${this._htmlBarreListe(c.caParClient)}
        </div>
        <div class="card">
          <div class="section-title">Répartition par activité</div>
          ${this._htmlBarreListe(Object.entries(c.caParActivite).filter(e => e[1] > 0).sort((a, b) => b[1] - a[1]))}
        </div>
      </div>
    `;
  },

  _bindEvents(container) {
    const saveBtn = container.querySelector('#finances-objectif-save');
    const input = container.querySelector('#finances-objectif-input');
    if (saveBtn && input) {
      saveBtn.addEventListener('click', () => {
        this._setObjectifMensuel(parseInt(input.value || '0', 10));
        this.render(this._root);
      });
    }
  },
};

/* ═══════════════════════════════════════════════════════════
   MODULE CATALOGUE (Tarifs) — la liste des offres/prix que tu
   vends, modifiable et supprimable. C'est LA source de vérité
   utilisée par le module Devis pour pré-remplir le montant :
   si tu retires une offre ici (ex: "Site 5 pages"), elle
   disparaît automatiquement du choix dans un nouveau devis.

   Contient aussi tes informations légales (SIRET, adresse...)
   utilisées pour générer le PDF des devis.
   TODO Firebase pour la persistance (catalogue + entreprise).
═══════════════════════════════════════════════════════════ */

window.Modules = window.Modules || {};

window.Modules.catalogue = {
  _data: null,

  async render(container) {
    if (!this._data) {
      this._data = window.FIREBASE_READY ? await this._fetchReal() : this._mock();
    }
    this._root = container.closest('#content') || container;
    container.innerHTML = this._html(this._data);
    window.hydrateIcons(container);
    this._bindEvents(container);
  },

  // Grille finale confirmée (voir Etude_Marche_Tarification_TiphaineBenard.docx).
  // Simple point de départ : entièrement modifiable/supprimable ensuite.
  _mock() {
    return [
      { id:1,  nom:'Site vitrine — 1 page',           categorie:'Site',        type:'Forfait',     prix:900,  description:'Une page unique, présentation simple de l\'activité (idéal pour démarrer).' },
      { id:2,  nom:'Site vitrine — 3 pages',           categorie:'Site',        type:'Forfait',     prix:1400, description:'Jusqu\'à 3 pages (ex : accueil, services, contact).' },
      { id:3,  nom:'Site vitrine — 5 pages',           categorie:'Site',        type:'Forfait',     prix:1900, description:'Jusqu\'à 5 pages, structure plus complète.' },
      { id:4,  nom:'Site vitrine — 6 pages et +',      categorie:'Site',        type:'Forfait',     prix:2200, description:'6 pages ou plus, site vitrine complet.' },
      { id:5,  nom:'Site vitrine — Essentiel',         categorie:'Site',        type:'Abonnement',  prix:29,   description:'Hébergement + mises à jour de base. Stockage de documents inclus jusqu\'à 5 Go, si l\'application en propose.' },
      { id:6,  nom:'Site vitrine — Sérénité',          categorie:'Site',        type:'Abonnement',  prix:49,   description:'Hébergement + maintenance régulière. Stockage de documents inclus jusqu\'à 5 Go, si l\'application en propose.' },
      { id:7,  nom:'Site vitrine — Performance',       categorie:'Site',        type:'Abonnement',  prix:99,   description:'Hébergement + maintenance + jusqu\'à 1h d\'intervention incluse par mois. Stockage de documents inclus jusqu\'à 5 Go, si l\'application en propose.' },
      { id:8,  nom:'Application — Essentiel',          categorie:'Application', type:'Forfait',     prix:900,  description:'Application simple, fonctionnalités de base.' },
      { id:9,  nom:'Application — Sur-mesure',         categorie:'Application', type:'Forfait',     prix:1600, description:'Application développée sur mesure selon les besoins.' },
      { id:10, nom:'Application — Création complète',  categorie:'Application', type:'Forfait',     prix:3000, description:'Application complète, fonctionnalités avancées.' },
      { id:11, nom:'Application — Essentiel',          categorie:'Application', type:'Abonnement',  prix:39,   description:'Hébergement + mises à jour de base. Stockage de documents inclus jusqu\'à 5 Go, si l\'application en propose.' },
      { id:12, nom:'Application — Sérénité',           categorie:'Application', type:'Abonnement',  prix:69,   description:'Hébergement + maintenance régulière. Stockage de documents inclus jusqu\'à 5 Go, si l\'application en propose.' },
      { id:13, nom:'Application — Performance',        categorie:'Application', type:'Abonnement',  prix:119,  description:'Hébergement + maintenance + jusqu\'à 1h d\'intervention incluse par mois. Stockage de documents inclus jusqu\'à 5 Go, si l\'application en propose.' },
    ];
  },

  async _fetchReal() {
    // TODO Firebase : const snap = await window.db.collection('catalogue').get();
    return this._mock();
  },

  // ── Informations légales (pour le PDF des devis) ──────────
  _entrepriseParDefaut() {
    return {
      nom: 'Tiphaine Bénard',
      siret: '123 456 789 00012',
      adresse: '12 rue de la Démo, 30000 Nîmes',
      email: 'contact@exemple.fr',
      // Depuis le 01/09/2026, la référence légale a changé (nouveau Code des
      // impositions sur les biens et services) — tolérance administrative
      // jusqu'au 31/12/2027 pour l'ancienne mention "art. 293 B du CGI".
      mentionTva: 'TVA non applicable, art. L. 223 et suivants du Code des impositions sur les biens et services (CIBS).',
      // Acompte à 50% systématique (choix de Tiphaine, 03/09/2026 — avant
      // c'était 30%). Reste éditable dans Paramétrage > Devis si besoin.
      acomptePct: 50,
      dureeValiditeJours: 30,
      // Format d'affichage du numéro de devis (04/09/2026) — vide par
      // défaut = comportement historique "N° 1, 2, 3...". Voir
      // `devis._formaterNumero()`.
      numeroPrefixe: '',
      numeroInclureAnnee: false,
      numeroChiffres: 0,
      // Numérotation des factures (05/09/2026) — série indépendante de
      // celle des devis (voir modules/factures.js). Défauts pensés pour
      // un format directement utilisable ("FAC-2026-001"), modifiables
      // dans Paramétrage > Devis, section Factures.
      factureNumeroPrefixe: 'FAC-',
      factureNumeroInclureAnnee: true,
      factureNumeroChiffres: 3,
      // Seuils d'alerte (04/09/2026, paramétrables plutôt qu'en dur) —
      // relance devis (dashboard._alertesTexteRelance / _devisARelancer,
      // etc.) et échéances Technique (domaines/hébergements).
      relanceDevisJours: 5,
      technique60Jours: 60,
      technique30Jours: 30,
      technique7Jours: 7,
      // Seuils fiscaux micro-entreprise / prestations de services
      // (04/09/2026) — valeurs 2026 vérifiées (loi de finances 2026 : la
      // réforme envisagée du seuil de franchise TVA n'a finalement pas été
      // retenue, seuils inchangés). Paramétrables ici plutôt que codés en
      // dur ailleurs, car ces règles évoluent d'une année sur l'autre —
      // demande explicite de Tiphaine dans son cahier des charges d'origine.
      // Sources : https://www.legifiscal.fr (seuils 2026), impots.gouv.fr.
      seuilTvaBase: 37500,   // franchise en base — au-delà, TVA au 1er janvier N+1
      seuilTvaMajore: 41250, // au-delà, TVA dès le 1er jour du mois de dépassement
      plafondMicro: 83600,   // sortie du régime micro si dépassé 2 années civiles de suite
      // 21,2% et pas 25,6% (04/09/2026) — Tiphaine est en BIC prestations
      // de services, pas en BNC. Vérifié sur ses documents officiels :
      // immatriculée au RCS Nîmes (le RCS n'accueille que des commerçants,
      // jamais les professions libérales/BNC — c'est la preuve définitive)
      // + code APE 62.01Z "Programmation informatique", une activité
      // commerciale classée BIC. Taux 2026 : 12,3% vente de marchandises,
      // 21,2% BIC prestations de services, 25,6% BNC — voir DEV_NOTES pour
      // les sources.
      urssafTaux: 21.2,
      // CFE (Cotisation Foncière des Entreprises, 04/09/2026) — impôt
      // local annuel, dû au Trésor Public (pas l'URSSAF). Exonérée
      // l'année de création, mais une déclaration initiale doit quand
      // même être déposée avant le 31/12 de cette première année ;
      // ensuite cotisation annuelle chaque année suivante (déclaration
      // 5 mai, solde 15 décembre, + acompte 15 juin si le montant
      // dépasse 3000€). `dateCreationEntreprise` sert de point de départ
      // pour calculer tout ça dans le Calendrier — Tiphaine a démarré le
      // 15/08/2026. `cfeMontantAnnuel` reste à null tant qu'elle ne
      // connaît pas encore le montant réel (premier avis reçu l'année
      // suivant la création) : sans lui, on suppose "pas d'acompte" par
      // prudence plutôt que d'inventer un montant.
      dateCreationEntreprise: '2026-08-15',
      cfeMontantAnnuel: null,
      // Coordonnées bancaires (RIB fourni par Tiphaine — BoursoBank) pour
      // que le client sache où virer l'acompte/le solde, directement sur le devis.
      titulaireCompte: 'EI Bénard Tiphaine',
      banque: 'Banque Démo',
      iban: 'FR76 0000 0000 0000 0000 0000 000',
      bic: 'DEMOFRPPXXX',
      // Lien vers le gestionnaire de mots de passe perso (Bitwarden,
      // 1Password...) — 04/09/2026, pour le bouton dans Technique > Accès
      // techniques. Jamais de mot de passe stocké dans l'app elle-même.
      gestionnaireMdpUrl: '',
    };
  },

  _getEntreprise() {
    const defauts = this._entrepriseParDefaut();
    let stocke = {};
    try { stocke = JSON.parse(localStorage.getItem('tos_entreprise') || '{}'); } catch (e) { stocke = {}; }
    const fusion = Object.assign({}, defauts, stocke);
    // Un champ vide enregistré précédemment ne doit jamais écraser une vraie
    // valeur par défaut connue (ex: SIRET/adresse déjà lus sur le KBIS).
    Object.keys(defauts).forEach((k) => {
      if (fusion[k] === '' || fusion[k] === null || fusion[k] === undefined) fusion[k] = defauts[k];
    });
    return fusion;
  },

  _setEntreprise(data) {
    localStorage.setItem('tos_entreprise', JSON.stringify(data));
    // TODO Firebase : window.db.collection('settings').doc('entreprise').set(data)
  },

  // ── Conditions Générales de Vente (page 2+ du devis PDF) ─────────────
  // Format simple à éditer : une ligne "## Titre" démarre une section, tout
  // le reste est du texte normal (un saut de ligne = un nouveau paragraphe).
  // devis.js (`_rendreCgv`) parse ce format pour la mise en page PDF.
  // Entièrement modifiable via "Modifier les CGV" (onglet Tarifs) — ne
  // jamais coder de texte de CGV en dur ailleurs que dans ce fichier.
  // Rédigé le 03/09/2026, ENTIÈREMENT révisé le 03/09/2026 suite à la
  // relecture juridique détaillée de Tiphaine (23 points), puis à nouveau
  // révisé le 03/09/2026 après une seconde relecture (via ChatGPT) et
  // décision stratégique de Tiphaine : CGV 100% B2B (plus de clientèle
  // particuliers) — décision volontairement simplificatrice pour éviter la
  // charge de conformité consommateurs (médiateur à désigner et payer,
  // sécurisation de la rétractation) alors que son activité réelle est
  // déjà 100% TPE/PME. En conséquence : suppression complète des clauses
  // rétractation et médiation de la consommation (n'ont plus lieu d'être
  // en B2B pur) ; clause de prévalence du devis sur les CGV en cas de
  // contradiction (art. 1 et 3) ; propriété intellectuelle renforcée
  // (art. 10-12) pour protéger explicitement la réutilisation des bases
  // applicatives (EventPro, PointagePro, CommandesPro, PadelPro) sur
  // d'autres clients ; comptes techniques répartis en 3 catégories
  // (comptes du Client / comptes administrés pour son compte /
  // infrastructure fournie par la Prestataire) plutôt que "tout chez
  // Tiphaine" (art. 13) ; nuances sur disponibilité/sauvegardes/RGPD/
  // responsabilité pour éviter des formulations trop absolues (art.
  // 15-16, 19, 22) ; ajout d'un délai d'export des données en fin
  // d'abonnement (art. 20) ; pénalités de retard reformulées pour rester
  // robustes si le taux légal évolue (art. 4) ; validation tacite des
  // livrables assouplie en report de délai plutôt qu'en validation
  // automatique pure (art. 6) ; qualification des modifications mineures
  // par leur nature plutôt que par un seuil mécanique d'1h (art. 7).
  // ⚠️ Rédaction assistée par IA, pas une consultation d'avocat — à faire
  // relire par un professionnel du droit avant toute première utilisation
  // commerciale, et à revoir si l'activité évolue (embauche, gros clients,
  // retour de la clientèle particuliers, litige réel).
  _cgvParDefaut() {
    return `## 1. CGV — Contenu fictif (version démo)
AAAAAAAAAAA AAAAAAAAAAA AAAAAAAAAAA AAAAAAAAAAA AAAAAAAAAAA. AAAAAAAAAAA AAAAAAAAAAA AAAAAAAAAAA AAAAAAAAAAA.

## 2. AAAAAAAAAAA
AAAAAAAAAAA AAAAAAAAAAA AAAAAAAAAAA AAAAAAAAAAA AAAAAAAAAAA AAAAAAAAAAA. AAAAAAAAAAA AAAAAAAAAAA AAAAAAAAAAA.

## 3. AAAAAAAAAAA
AAAAAAAAAAA AAAAAAAAAAA AAAAAAAAAAA AAAAAAAAAAA AAAAAAAAAAA AAAAAAAAAAA AAAAAAAAAAA.

(Ceci est un texte fictif de démonstration — les vraies CGV de Tiphaine ne sont pas publiées ici. Ce bloc est entièrement modifiable dans Tarifs > Modifier les CGV.)`;
  },

  _getCgv() {
    const stocke = localStorage.getItem('tos_cgv');
    return (stocke && stocke.trim()) ? stocke : this._cgvParDefaut();
  },

  _setCgv(texte) {
    localStorage.setItem('tos_cgv', texte);
    // TODO Firebase : window.db.collection('settings').doc('cgv').set({ texte })
  },

  // ── Catégories (entièrement paramétrables — ajout/suppression) ──────
  _getCategories() {
    try {
      const stockees = JSON.parse(localStorage.getItem('tos_categories') || 'null');
      if (Array.isArray(stockees) && stockees.length) return stockees;
    } catch (e) { /* ignore */ }
    return ['Site', 'Application'];
  },

  _setCategories(cats) {
    localStorage.setItem('tos_categories', JSON.stringify(cats));
    // TODO Firebase : window.db.collection('settings').doc('categories').set({ liste: cats })
  },

  _ajouterCategorie(nom) {
    const cats = this._getCategories();
    if (!nom || cats.includes(nom)) return;
    cats.push(nom);
    this._setCategories(cats);
  },

  _supprimerCategorie(nom) {
    if (this._data.some(o => o.categorie === nom)) {
      alert(`Impossible : au moins une offre du catalogue utilise encore la catégorie "${nom}". Change d'abord sa catégorie.`);
      return false;
    }
    this._setCategories(this._getCategories().filter(c => c !== nom));
    return true;
  },

  // 04/09/2026 : retour de Tiphaine — la liste à plat (Offre / Catégorie
  // / Type / Prix en colonnes) ne permettait pas de distinguer d'un coup
  // d'œil Site vs Application, ni Forfait vs Abonnement. Remplacé par un
  // regroupement visuel : une bande de titre colorée par catégorie
  // (couleur stable, cyclée sur une petite palette — tient compte des
  // catégories personnalisées ajoutées par Tiphaine, pas seulement
  // Site/Application), puis un sous-groupe par type avec un intitulé
  // explicite ("Forfaits — paiement unique" / "Abonnements — mensuel")
  // plutôt qu'une simple colonne "Type" qu'il fallait déchiffrer.
  _PALETTE_CATEGORIES: [
    { r:120, g:170, b:235 }, // bleu
    { r:230, g:170, b:90 },  // ambre
    { r:142, g:203, b:142 }, // vert
    { r:201, g:142, b:230 }, // violet
    { r:230, g:142, b:160 }, // rose
    { r:127, g:209, b:201 }, // turquoise
  ],
  _couleurCategorie(cat) {
    const cats = this._getCategories();
    const idx = Math.max(0, cats.indexOf(cat));
    const c = this._PALETTE_CATEGORIES[idx % this._PALETTE_CATEGORIES.length];
    return `${c.r},${c.g},${c.b}`;
  },
  _htmlLignesGroupees(catalogueFiltre, categoriesAffichees) {
    if (!catalogueFiltre.length) return `<tr><td colspan="3" style="color:#6a6a6a; padding:16px 14px;">Aucune offre dans cette catégorie.</td></tr>`;
    let html = '';
    categoriesAffichees.forEach(cat => {
      const rgb = this._couleurCategorie(cat);
      ['Forfait', 'Abonnement'].forEach(type => {
        const offresGroupe = catalogueFiltre.filter(o => o.categorie === cat && o.type === type);
        if (!offresGroupe.length) return;
        html += `
          <tr class="catalogue-groupe-row">
            <td colspan="3" class="catalogue-groupe-titre" style="border-left:3px solid rgb(${rgb});">
              <div class="catalogue-groupe-titre-inner">
                <span class="catalogue-groupe-cat" style="color:rgb(${rgb}); background:rgba(${rgb},.16);">${cat}</span>
                <span class="catalogue-groupe-type">${type === 'Forfait' ? 'Forfaits — paiement unique' : 'Abonnements — mensuel'}</span>
              </div>
            </td>
          </tr>
        `;
        html += offresGroupe.map(o => `
          <tr data-open="${o.id}" style="cursor:pointer;">
            <td style="padding-left:26px;">
              <div>${o.nom}</div>
              ${o.description ? `<div style="font-size:11.5px; color:#7a7a7a; margin-top:2px;">${o.description}</div>` : ''}
            </td>
            <td>${o.prix.toLocaleString('fr-FR')} €${o.type === 'Abonnement' ? '/mois' : ''}</td>
            <td style="width:36px;"><button class="row-delete-btn" data-delete="${o.id}" title="Supprimer">✕</button></td>
          </tr>
        `).join('');
      });
    });
    return html;
  },

  _html(catalogue) {
    const entreprise = this._getEntreprise();
    const infosIncompletes = !entreprise.siret || !entreprise.adresse;
    const categories = this._getCategories();
    const filtre = this._filtreCategorie || 'Toutes';
    const catalogueFiltre = filtre === 'Toutes' ? catalogue : catalogue.filter(o => o.categorie === filtre);
    return `
      <div class="page-header-row">
        <div>
          <div class="page-title"><span class="nav-icon" data-icon="tag"></span>Tarifs</div>
          <div class="page-sub">${catalogue.length} offre${catalogue.length > 1 ? 's' : ''} au catalogue — utilisées pour pré-remplir tes devis</div>
        </div>
        <div class="page-header-actions">
          <button class="btn" id="add-offre-btn">+ Nouvelle offre</button>
        </div>
      </div>

      ${infosIncompletes ? `
        <div class="card" style="margin-bottom:20px; border-color:#332b1a; background:#0e0c08;">
          <div class="alert-sub" style="color:#f0c27f;">
            Tes informations légales (SIRET, adresse) sont incomplètes — à compléter dans
            <a href="#/parametrage" style="color:#f0c27f; text-decoration:underline;">Paramétrage</a>
            avant d'envoyer un vrai devis à un client, elles sont obligatoires légalement.
          </div>
        </div>
      ` : ''}

      <!-- Infos entreprise, CGV et catégories : déplacées dans Paramétrage
           (onglets Général / Devis / CGV / Catalogue) le 03/09/2026, sur
           demande de Tiphaine — une seule source pour tous les réglages,
           Tarifs ne garde que le vrai catalogue d'offres. -->

      <div class="temps-tabs" style="margin-bottom:16px;">
        <button class="temps-tab ${filtre === 'Toutes' ? 'active' : ''}" data-filtre-cat="Toutes">Toutes (${catalogue.length})</button>
        ${categories.map(c => `<button class="temps-tab ${filtre === c ? 'active' : ''}" data-filtre-cat="${c}">${c} (${catalogue.filter(o => o.categorie === c).length})</button>`).join('')}
      </div>

      <div class="card catalogue-table-wrap" style="padding:0; overflow-x:auto;">
        <table>
          <thead><tr>
            <th>Offre</th><th>Prix</th><th></th>
          </tr></thead>
          <tbody>
            ${this._htmlLignesGroupees(catalogueFiltre, filtre === 'Toutes' ? categories.filter(c => catalogueFiltre.some(o => o.categorie === c)) : [filtre])}
          </tbody>
        </table>
      </div>

      <!-- Version mobile (06/09/2026) — remplace le tableau groupé par
           des cartes empilées (retour de Tiphaine : les lignes de prix
           n'étaient pas assez clairement cliquables, et le badge de
           catégorie coloré + bordure n'était pas terrible visuellement
           en pleine largeur mobile). En-tête de groupe simplifié en
           simple texte (sobre, cohérent avec le reste de l'appli),
           cartes avec le prix mis en avant et une vraie zone cliquable
           pleine largeur pour modifier. -->
      <div class="catalogue-mobile-list">
        ${this._htmlGroupesMobile(catalogueFiltre, filtre === 'Toutes' ? categories.filter(c => catalogueFiltre.some(o => o.categorie === c)) : [filtre])}
      </div>
    `;
  },

  _htmlGroupesMobile(catalogueFiltre, categoriesAffichees) {
    if (!catalogueFiltre.length) return `<div class="card" style="color:#6a6a6a; text-align:center; padding:24px;">Aucune offre dans cette catégorie.</div>`;
    let html = '';
    categoriesAffichees.forEach(cat => {
      ['Forfait', 'Abonnement'].forEach(type => {
        const offresGroupe = catalogueFiltre.filter(o => o.categorie === cat && o.type === type);
        if (!offresGroupe.length) return;
        html += `
          <div class="catalogue-groupe-titre-mobile">${cat} — ${type === 'Forfait' ? 'Forfaits (paiement unique)' : 'Abonnements (mensuel)'}</div>
          <div class="catalogue-mobile-cartes">
            ${offresGroupe.map(o => `
              <div class="catalogue-mcard" data-open="${o.id}">
                <div class="catalogue-mcard-info">
                  <div class="catalogue-mcard-nom">${o.nom}</div>
                  ${o.description ? `<div class="catalogue-mcard-desc">${o.description}</div>` : ''}
                </div>
                <div class="catalogue-mcard-prix">${o.prix.toLocaleString('fr-FR')} €${o.type === 'Abonnement' ? '<span style="font-size:10.5px; font-weight:400; color:var(--text-muted);">/mois</span>' : ''}</div>
                <button class="row-delete-btn" data-delete="${o.id}" title="Supprimer">✕</button>
              </div>
            `).join('')}
          </div>
        `;
      });
    });
    return html;
  },

  _formHtml(o) {
    const isEdit = !!o;
    o = o || { nom:'', categorie:'Site', type:'Forfait', prix:0, description:'' };
    return `
      <div class="modal-overlay" id="offre-modal-overlay">
        <div class="modal-box">
          <div class="modal-title">${isEdit ? "Modifier l'offre" : 'Nouvelle offre'}</div>
          <form id="offre-form">
            <div class="modal-field">
              <label>Nom de l'offre</label>
              <input type="text" name="nom" value="${o.nom}" required autofocus>
            </div>
            <div class="modal-field">
              <label>Description (optionnel — affichée sous le nom dans le tableau)</label>
              <input type="text" name="description" value="${o.description || ''}" placeholder="Ex : Hébergement + maintenance régulière">
            </div>
            <div class="modal-field">
              <label>Catégorie (gérées dans Paramétrage &gt; Catalogue)</label>
              <select name="categorie">
                ${this._getCategories().map(c => `<option value="${c}" ${c === o.categorie ? 'selected' : ''}>${c}</option>`).join('')}
              </select>
            </div>
            <div class="modal-field">
              <label>Type</label>
              <select name="type">
                <option value="Forfait" ${o.type === 'Forfait' ? 'selected' : ''}>Forfait (paiement unique)</option>
                <option value="Abonnement" ${o.type === 'Abonnement' ? 'selected' : ''}>Abonnement (mensuel)</option>
              </select>
            </div>
            <div class="modal-field">
              <label>Prix (€)</label>
              <input type="number" name="prix" value="${o.prix}" min="0" step="1" required>
            </div>
            <div class="modal-actions">
              ${isEdit ? `<button type="button" class="btn btn-danger" id="offre-delete-btn">Supprimer</button>` : `<span></span>`}
              <div class="modal-actions-right">
                <button type="button" class="btn btn-ghost" id="offre-cancel-btn">Annuler</button>
                <button type="submit" class="btn">${isEdit ? 'Enregistrer' : 'Ajouter'}</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  _openForm(offre) {
    const wrap = document.createElement('div');
    wrap.innerHTML = this._formHtml(offre);
    document.body.appendChild(wrap.firstElementChild);
    const overlay = document.getElementById('offre-modal-overlay');
    const close = () => overlay.remove();

    // Ferme seulement si le clic ET le mousedown initial étaient bien sur le
    // fond (overlay) — sinon une sélection de texte qui démarre dans un
    // champ/textarea et se termine (drag) hors de la modal-box fermait la
    // modal par erreur (bug remonté le 03/09/2026, surtout gênant sur le
    // grand textarea des CGV).
    let mousedownSurOverlay = false;
    overlay.addEventListener('mousedown', (e) => { mousedownSurOverlay = (e.target === overlay); });
    overlay.addEventListener('click', (e) => { if (e.target === overlay && mousedownSurOverlay) close(); });
    document.getElementById('offre-cancel-btn').addEventListener('click', close);

    const deleteBtn = document.getElementById('offre-delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        window.confirmerAction('Retirer cette offre du catalogue ? Elle ne sera plus proposée dans les nouveaux devis.', () => {
          this._data = this._data.filter(x => x.id !== offre.id);
          // TODO Firebase : window.db.collection('catalogue').doc(offre.id).delete()
          close();
          this.render(this._root);
        });
      });
    }

    document.getElementById('offre-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = {
        nom: fd.get('nom').trim(),
        description: (fd.get('description') || '').trim(),
        categorie: fd.get('categorie'),
        type: fd.get('type'),
        prix: parseInt(fd.get('prix') || '0', 10),
      };
      if (!payload.nom) return;

      if (offre) {
        Object.assign(offre, payload);
        // TODO Firebase : window.db.collection('catalogue').doc(offre.id).update(payload)
      } else {
        this._data.push({ id: Date.now(), ...payload });
        // TODO Firebase : window.db.collection('catalogue').add(payload)
      }
      close();
      this.render(this._root);
    });
  },

  _entrepriseFormHtml() {
    const e = this._getEntreprise();
    return `
      <div class="modal-overlay" id="entreprise-modal-overlay">
        <div class="modal-box">
          <div class="modal-title">Mes informations légales</div>
          <form id="entreprise-form">
            <div class="modal-field">
              <label>Nom / raison sociale</label>
              <input type="text" name="nom" value="${e.nom}" required>
            </div>
            <div class="modal-field">
              <label>SIRET</label>
              <input type="text" name="siret" value="${e.siret}" placeholder="14 chiffres">
            </div>
            <div class="modal-field">
              <label>Adresse</label>
              <input type="text" name="adresse" value="${e.adresse}" placeholder="Numéro, rue, code postal, ville">
            </div>
            <div class="modal-field">
              <label>Email de contact</label>
              <input type="email" name="email" value="${e.email}">
            </div>
            <div class="modal-field">
              <label>Mention TVA (affichée sur chaque devis)</label>
              <input type="text" name="mentionTva" value="${e.mentionTva}">
            </div>
            <div class="modal-field">
              <label>Acompte à la commande (%)</label>
              <input type="number" name="acomptePct" value="${e.acomptePct}" min="0" max="100">
            </div>
            <div class="modal-field">
              <label>Durée de validité d'un devis (jours)</label>
              <input type="number" name="dureeValiditeJours" value="${e.dureeValiditeJours}" min="1">
            </div>
            <div class="modal-field">
              <label>Titulaire du compte</label>
              <input type="text" name="titulaireCompte" value="${e.titulaireCompte || ''}">
            </div>
            <div class="modal-field">
              <label>Banque</label>
              <input type="text" name="banque" value="${e.banque || ''}">
            </div>
            <div class="modal-field">
              <label>IBAN</label>
              <input type="text" name="iban" value="${e.iban || ''}" placeholder="FR76 XXXX XXXX XXXX XXXX XXXX XXX">
            </div>
            <div class="modal-field">
              <label>BIC / SWIFT</label>
              <input type="text" name="bic" value="${e.bic || ''}">
            </div>
            <div class="modal-actions">
              <span></span>
              <div class="modal-actions-right">
                <button type="button" class="btn btn-ghost" id="entreprise-cancel-btn">Annuler</button>
                <button type="submit" class="btn">Enregistrer</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  _openEntrepriseForm() {
    const wrap = document.createElement('div');
    wrap.innerHTML = this._entrepriseFormHtml();
    document.body.appendChild(wrap.firstElementChild);
    const overlay = document.getElementById('entreprise-modal-overlay');
    const close = () => overlay.remove();

    // Ferme seulement si le clic ET le mousedown initial étaient bien sur le
    // fond (overlay) — sinon une sélection de texte qui démarre dans un
    // champ/textarea et se termine (drag) hors de la modal-box fermait la
    // modal par erreur (bug remonté le 03/09/2026, surtout gênant sur le
    // grand textarea des CGV).
    let mousedownSurOverlay = false;
    overlay.addEventListener('mousedown', (e) => { mousedownSurOverlay = (e.target === overlay); });
    overlay.addEventListener('click', (e) => { if (e.target === overlay && mousedownSurOverlay) close(); });
    document.getElementById('entreprise-cancel-btn').addEventListener('click', close);

    document.getElementById('entreprise-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      this._setEntreprise({
        nom: fd.get('nom').trim(),
        siret: fd.get('siret').trim(),
        adresse: fd.get('adresse').trim(),
        email: fd.get('email').trim(),
        mentionTva: fd.get('mentionTva').trim(),
        acomptePct: parseInt(fd.get('acomptePct') || '50', 10),
        dureeValiditeJours: parseInt(fd.get('dureeValiditeJours') || '30', 10),
        titulaireCompte: fd.get('titulaireCompte').trim(),
        banque: fd.get('banque').trim(),
        iban: fd.get('iban').trim(),
        bic: fd.get('bic').trim(),
      });
      close();
      // Re-render seulement si Tarifs a déjà été ouvert cette session (donc
      // `_root` connu) — cette modale peut aussi s'ouvrir depuis l'onglet
      // Paramétrage (03/09/2026) sans jamais être passé par Tarifs, auquel
      // cas il n'y a rien à rafraîchir ici.
      if (this._root) this.render(this._root);
    });
  },

  _cgvFormHtml() {
    return `
      <div class="modal-overlay" id="cgv-modal-overlay">
        <div class="modal-box" style="max-width:760px; width:92vw;">
          <div class="modal-title">Modifier les CGV</div>
          <form id="cgv-form">
            <div class="modal-field">
              <label>Une ligne commençant par "## " démarre une nouvelle section (son titre). Le reste est le texte normal, un saut de ligne = un nouveau paragraphe.</label>
              <textarea name="texte" style="min-height:50vh; font-family:monospace; font-size:12.5px; line-height:1.5;">${this._getCgv()}</textarea>
            </div>
            <div class="modal-actions">
              <button type="button" class="btn btn-ghost" id="cgv-reset-btn">Réinitialiser (version par défaut)</button>
              <div class="modal-actions-right">
                <button type="button" class="btn btn-ghost" id="cgv-cancel-btn">Annuler</button>
                <button type="submit" class="btn">Enregistrer</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  _openCgvForm() {
    const wrap = document.createElement('div');
    wrap.innerHTML = this._cgvFormHtml();
    document.body.appendChild(wrap.firstElementChild);
    const overlay = document.getElementById('cgv-modal-overlay');
    const close = () => overlay.remove();

    // Ferme seulement si le clic ET le mousedown initial étaient bien sur le
    // fond (overlay) — sinon une sélection de texte qui démarre dans un
    // champ/textarea et se termine (drag) hors de la modal-box fermait la
    // modal par erreur (bug remonté le 03/09/2026, surtout gênant sur le
    // grand textarea des CGV).
    let mousedownSurOverlay = false;
    overlay.addEventListener('mousedown', (e) => { mousedownSurOverlay = (e.target === overlay); });
    overlay.addEventListener('click', (e) => { if (e.target === overlay && mousedownSurOverlay) close(); });
    document.getElementById('cgv-cancel-btn').addEventListener('click', close);

    document.getElementById('cgv-reset-btn').addEventListener('click', () => {
      window.confirmerAction('Remplacer le texte actuel par la version par défaut ? Tes modifications seront perdues.', () => {
        document.querySelector('#cgv-form textarea[name="texte"]').value = this._cgvParDefaut();
      });
    });

    document.getElementById('cgv-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      this._setCgv(fd.get('texte'));
      close();
      if (this._root) this.render(this._root); // idem : peut être ouvert depuis Paramétrage sans root connu
    });
  },

  // Génère un fichier .doc (contenu HTML, ouvert nativement par Word grâce
  // au content-sniffing — pas besoin de bibliothèque docx côté client) à
  // partir des CGV actuelles, et déclenche son téléchargement dans le
  // navigateur. Entièrement client-side, aucune dépendance serveur/shell.
  _cgvVersHtmlWord() {
    const entreprise = this._getEntreprise();
    const texte = this._getCgv();
    const blocs = texte.split(/\n(?=## )/).map(b => b.trim()).filter(Boolean);

    const corpsHtml = blocs.map(bloc => {
      const lignes = bloc.split('\n');
      const estTitre = lignes[0].startsWith('## ');
      const titre = estTitre ? lignes[0].replace(/^##\s*/, '') : null;
      const paragraphes = (estTitre ? lignes.slice(1) : lignes).join('\n').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
      return `
        ${titre ? `<h2>${titre}</h2>` : ''}
        ${paragraphes.map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('\n')}
      `;
    }).join('\n');

    return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>Conditions Générales de Vente</title>
<style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color:#1a1a1a; line-height:1.4; }
  h1 { font-size: 18pt; margin-bottom:2px; }
  .sous-titre { font-size: 10pt; color:#555; margin-top:0; margin-bottom:24px; }
  h2 { font-size: 12.5pt; border-bottom: 1px solid #ccc; padding-bottom:3px; margin-top:22px; margin-bottom:8px; }
  p { text-align: justify; margin: 0 0 8px 0; }
  .avertissement { margin-top:32px; padding:12px 16px; border:1px solid #d8b56b; background:#fbf3e2; font-size:9.5pt; color:#6b5326; }
</style>
</head>
<body>
  <h1>Conditions Générales de Vente</h1>
  <p class="sous-titre">${entreprise.nom || 'Prestataire'}${entreprise.siret ? ` — SIRET ${entreprise.siret}` : ''}${entreprise.adresse ? ` — ${entreprise.adresse}` : ''}</p>
  ${corpsHtml}
  <div class="avertissement">
    ⚠️ Rédaction assistée par intelligence artificielle, à partir des informations et préférences transmises par la Prestataire — ceci ne constitue pas une consultation juridique. Il est recommandé de faire valider ce document par un professionnel du droit avant toute diffusion commerciale à grande échelle, en particulier concernant la clause de médiation de la consommation (article Médiation) qui nécessite l'adhésion effective à un dispositif de médiation pour une conformité complète.
  </div>
</body>
</html>`;
  },

  _telechargerCgvWord() {
    const html = this._cgvVersHtmlWord();
    const blob = new Blob(['﻿', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const nomEntreprise = (this._getEntreprise().nom || 'Prestataire').replace(/[^a-z0-9]+/gi, '_');
    a.download = `CGV_${nomEntreprise}.doc`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  _bindEvents(container) {
    const addBtn = container.querySelector('#add-offre-btn');
    if (addBtn) addBtn.addEventListener('click', () => this._openForm(null));

    container.querySelectorAll('[data-filtre-cat]').forEach(btn => {
      btn.addEventListener('click', () => {
        this._filtreCategorie = btn.dataset.filtreCat;
        this.render(this._root);
      });
    });

    // Sélecteur générique (06/09/2026) — reconnaît aussi bien la ligne
    // de tableau (desktop) que la carte mobile (.catalogue-mcard), même
    // pattern que devis.js/factures.js/clients.js.
    container.querySelectorAll('[data-open]').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('[data-delete]')) return;
        const id = Number(row.dataset.open);
        const o = this._data.find(x => x.id === id);
        if (o) this._openForm(o);
      });
    });

    container.querySelectorAll('[data-delete]').forEach(delBtn => {
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number(delBtn.dataset.delete);
        window.confirmerAction('Supprimer cette offre du catalogue ?', () => {
          this._data = this._data.filter(x => x.id !== id);
          this.render(this._root);
        });
      });
    });
  },
};

/* ═══════════════════════════════════════════════════════════
   MODULE PARAMÉTRAGE — panneau de réglages complet, structuré en
   sous-onglets façon vraie appli (un onglet par domaine), plutôt
   qu'une pile de cartes. Version 2 (03/09/2026), suite au retour de
   Tiphaine : "en haut de paramètres il doit y avoir les onglets de
   chaque page... que ça ressemble à un vrai site."

   Principe : chaque donnée qui est un RÉGLAGE (liste, couleur, texte
   légal, coordonnées) vit ICI et nulle part ailleurs — les autres
   onglets (Tarifs, Clients, Temps, Abonnements...) ne gardent que
   leurs vraies DONNÉES (offres, fiches clients, créneaux, abonnements
   actifs) et lisent ces réglages dynamiquement quand ils en ont besoin
   (ex : le select "Formule" du formulaire Abonnements lit
   `abonnements._getGrille()`, qui lit ce que Tiphaine a modifié ici).

   Sous-onglets :
   - Général     → identité entreprise (nom, SIRET, adresse, email, RIB)
   - Devis       → mention TVA, % acompte, durée de validité
   - CGV         → éditeur de texte complet + téléchargement Word
   - Apparence   → couleur d'accent de toute l'appli
   - Catalogue   → catégories d'offres
   - Clients     → statuts
   - Temps       → types de tâche & couleurs
   - Abonnements → formules & tarifs
   - (Bientôt V2+) Finances / Technique / Calendrier / Documents —
     emplacements réservés, vides pour l'instant, pour que la structure
     soit prête le jour où ces modules arrivent.

   Les données réelles (nom d'entreprise, CGV, catégories...) restent
   stockées dans leur module d'origine (`catalogue.js`, `abonnements.js`,
   `clients.js`, `temps.js`) — Paramétrage n'est qu'une façade unifiée
   par-dessus, pas une deuxième source de vérité.
═══════════════════════════════════════════════════════════ */

window.Modules = window.Modules || {};

window.Modules.parametrage = {
  _root: null,
  _souOnglet: 'general',

  _ONGLETS: [
    { id: 'general', label: 'Général' },
    { id: 'devis', label: 'Devis' },
    { id: 'catalogue', label: 'Catalogue' },
    { id: 'clients', label: 'Clients' },
    { id: 'temps', label: 'Temps' },
    { id: 'abonnements', label: 'Abonnements' },
    { id: 'cgv', label: 'CGV' },
    { id: 'apparence', label: 'Apparence' },
    { id: 'donnees', label: 'Données' },
  ],
  // "Finances", "Technique", "Calendrier" et "Documents" retirés au fur
  // et à mesure (03-04/09/2026) — devenus de vrais modules avec leur
  // propre route, rien à paramétrer ici dedans pour l'instant donc plus
  // de sous-onglet "bientôt" pour eux.
  _ONGLETS_V2: [],

  _PALETTE_ACCENT: [
    { nom: 'Blanc (défaut)', hex: '#f5f5f5' }, { nom: 'Bleu', hex: '#78a0e6' },
    { nom: 'Vert', hex: '#6ec88c' }, { nom: 'Orange', hex: '#e0a94b' },
    { nom: 'Violet', hex: '#b48ce6' }, { nom: 'Rose', hex: '#e087b0' },
    { nom: 'Rouge', hex: '#e0705c' }, { nom: 'Cyan', hex: '#5fc9c9' },
    { nom: 'Jaune', hex: '#e0d24b' },
  ],

  // Presets de fond — chaque preset donne déjà des teintes cohérentes
  // entre elles (fond général / cartes / sidebar / bordures / texte), pour
  // éviter qu'un choix libre casse la lisibilité. `apercu` = couleur du
  // rond de sélection dans Paramétrage. `clair:true` bascule le texte en
  // sombre ET le logo de la sidebar en version noire (voir `app.js`
  // `appliquerFond`) — sinon texte clair sur fond clair = illisible.
  _PALETTE_FOND: [
    // ── Sombres (texte clair — défaut historique) ──────────────────
    { nom: 'Noir (défaut)', apercu: '#000000', clair: false, page: '#000000', panel: '#0a0a0a', panel2: '#050505', input: '#141414', border: '#171717', textPrimary: '#f5f5f5', textSecondary: '#9a9a9a', textMuted: '#6a6a6a' },
    { nom: 'Anthracite', apercu: '#0d0d0f', clair: false, page: '#0d0d0f', panel: '#16161a', panel2: '#121215', input: '#1d1d22', border: '#232329', textPrimary: '#f5f5f5', textSecondary: '#9a9a9a', textMuted: '#6a6a6a' },
    { nom: 'Bleu nuit', apercu: '#0a0f1c', clair: false, page: '#05070d', panel: '#0d1220', panel2: '#080b14', input: '#141a2c', border: '#1c2438', textPrimary: '#f5f5f5', textSecondary: '#9a9a9a', textMuted: '#6a6a6a' },
    { nom: 'Vert forêt', apercu: '#0a140e', clair: false, page: '#050a07', panel: '#0c150f', panel2: '#08100b', input: '#12201a', border: '#1a2a20', textPrimary: '#f5f5f5', textSecondary: '#9a9a9a', textMuted: '#6a6a6a' },
    { nom: 'Bordeaux', apercu: '#160c0e', clair: false, page: '#0a0506', panel: '#160c0e', panel2: '#100809', input: '#221215', border: '#2e181c', textPrimary: '#f5f5f5', textSecondary: '#9a9a9a', textMuted: '#6a6a6a' },
    { nom: 'Violet nuit', apercu: '#130f1c', clair: false, page: '#08060d', panel: '#130f1c', panel2: '#0d0a15', input: '#1c1729', border: '#28203a', textPrimary: '#f5f5f5', textSecondary: '#9a9a9a', textMuted: '#6a6a6a' },
    // ── Clairs (texte sombre + logo noir, nouveau 03/09/2026) ──────
    { nom: 'Blanc', apercu: '#ffffff', clair: true, page: '#ffffff', panel: '#f7f7f8', panel2: '#eceef1', input: '#ffffff', border: '#dcdfe3', textPrimary: '#15171b', textSecondary: '#55585f', textMuted: '#83868d' },
    { nom: 'Gris clair', apercu: '#eef0f2', clair: true, page: '#eef0f2', panel: '#f8f9fa', panel2: '#dfe2e6', input: '#ffffff', border: '#d0d4d9', textPrimary: '#15171b', textSecondary: '#585b62', textMuted: '#84878e' },
    { nom: 'Crème', apercu: '#f3ecd9', clair: true, page: '#f7f3ea', panel: '#fffdf8', panel2: '#ebe3d0', input: '#fffdf6', border: '#ddd2b6', textPrimary: '#241f14', textSecondary: '#5c5442', textMuted: '#8a8168' },
    { nom: 'Bleu clair', apercu: '#e3e9f2', clair: true, page: '#eef2f8', panel: '#f9fbfd', panel2: '#dde5f0', input: '#f7faff', border: '#c8d2e3', textPrimary: '#10151f', textSecondary: '#4c5566', textMuted: '#7c8494' },
  ],

  async render(container) {
    // Lazy-init : cette page peut être ouverte sans jamais être passé par
    // Tarifs/Abonnements dans la session — leurs modules doivent quand même
    // avoir des données en mémoire pour que leurs fonctions marchent
    // correctement depuis ici.
    const catalogue = window.Modules && window.Modules.catalogue;
    const abos = window.Modules && window.Modules.abonnements;
    if (catalogue && !catalogue._data) catalogue._data = catalogue._mock();
    if (abos && !abos._data) abos._data = abos._mock();

    this._root = container.closest('#content') || container;
    container.innerHTML = this._html();
    window.hydrateIcons(container);
    this._bindEvents(container);
  },

  _html() {
    return `
      <div class="parametrage-header" style="margin-bottom:18px;">
        <div class="page-title"><span class="nav-icon" data-icon="settings"></span>Paramétrage</div>
      </div>

      <div class="temps-tabs parametrage-tabs-grid" style="flex-wrap:wrap;">
        ${this._ONGLETS.map(o => `<button class="temps-tab ${this._souOnglet === o.id ? 'active' : ''}" data-souonglet="${o.id}">${o.label}</button>`).join('')}
        <span class="param-tabs-separateur"></span>
        ${this._ONGLETS_V2.map(o => `<button class="temps-tab param-tab-v2 ${this._souOnglet === o.id ? 'active' : ''}" data-souonglet="${o.id}">${o.label} <span class="param-badge-bientot">bientôt</span></button>`).join('')}
      </div>

      <div id="param-contenu">${this._htmlOnglet()}</div>
    `;
  },

  _htmlOnglet() {
    switch (this._souOnglet) {
      case 'general': return this._htmlGeneral();
      case 'devis': return this._htmlDevis();
      case 'cgv': return this._htmlCgv();
      case 'apparence': return this._htmlApparence();
      case 'catalogue': return this._htmlCatalogue();
      case 'clients': return this._htmlClients();
      case 'temps': return this._htmlTemps();
      case 'abonnements': return this._htmlAbonnements();
      case 'donnees': return this._htmlDonnees();
      default: return this._htmlV2Placeholder();
    }
  },

  _htmlV2Placeholder() {
    const label = [...this._ONGLETS_V2].find(o => o.id === this._souOnglet);
    return `
      <div class="empty-state">
        <div class="empty-state-icon" data-icon="folder" data-icon-size="32"></div>
        <div>${label ? label.label : 'Cette section'} arrive avec le module correspondant (voir "Bientôt (V2+)" dans le menu).</div>
      </div>
    `;
  },

  // ── Général : identité entreprise ────────────────────────────────
  _htmlGeneral() {
    const catalogue = window.Modules && window.Modules.catalogue;
    const e = catalogue ? catalogue._getEntreprise() : {};
    const infosIncompletes = !e.siret || !e.adresse;
    return `
      <div class="card">
        <div class="section-title">Identité de l'entreprise</div>
        <div class="stat-sub" style="margin-bottom:10px;">Utilisée sur tes devis PDF.</div>
        ${infosIncompletes ? `<div class="alert-sub" style="color:#f0c27f; margin-bottom:10px;">SIRET et/ou adresse manquants — obligatoires avant d'envoyer un vrai devis.</div>` : ''}
        <form id="param-form-general">
          <div class="modal-field"><label>Nom / raison sociale</label><input type="text" name="nom" value="${e.nom || ''}" required></div>
          <div class="modal-field"><label>SIRET</label><input type="text" name="siret" value="${e.siret || ''}" placeholder="ex : 123 456 789 00012"></div>
          <div class="modal-field"><label>Adresse</label><input type="text" name="adresse" value="${e.adresse || ''}" placeholder="N° et rue, code postal, ville"></div>
          <div class="modal-field"><label>Email</label><input type="email" name="email" value="${e.email || ''}"></div>
          <div class="section-title" style="margin-top:10px;">Coordonnées bancaires (RIB, pour le devis PDF)</div>
          <div class="modal-field"><label>Titulaire du compte</label><input type="text" name="titulaireCompte" value="${e.titulaireCompte || ''}"></div>
          <div class="modal-field"><label>Banque</label><input type="text" name="banque" value="${e.banque || ''}"></div>
          <div class="modal-field"><label>IBAN</label><input type="text" name="iban" value="${e.iban || ''}"></div>
          <div class="modal-field"><label>BIC</label><input type="text" name="bic" value="${e.bic || ''}"></div>
          <button type="submit" class="btn">Enregistrer</button>
        </form>
      </div>

      <div class="card" style="margin-top:10px;">
        <div class="section-title">Seuils fiscaux (micro-entreprise)</div>
        <div class="stat-sub" style="margin-bottom:10px;">Valeurs 2026 pré-remplies — modifiables si elles changent.</div>
        <form id="param-form-fiscal">
          <div style="display:flex; gap:14px;">
            <div class="modal-field" style="flex:1;"><label>Seuil TVA de base (€)</label><input type="number" name="seuilTvaBase" min="0" value="${e.seuilTvaBase || 37500}"></div>
            <div class="modal-field" style="flex:1;"><label>Seuil TVA majoré (€)</label><input type="number" name="seuilTvaMajore" min="0" value="${e.seuilTvaMajore || 41250}"></div>
          </div>
          <div style="display:flex; gap:14px;">
            <div class="modal-field" style="flex:1;"><label>Plafond micro-entreprise (€)</label><input type="number" name="plafondMicro" min="0" value="${e.plafondMicro || 83600}"></div>
            <div class="modal-field" style="flex:1;"><label>Taux URSSAF (%)</label><input type="number" name="urssafTaux" min="0" step="0.1" value="${e.urssafTaux || 25.6}"></div>
          </div>
          <button type="submit" class="btn">Enregistrer</button>
        </form>
      </div>

      <div class="card" style="margin-top:10px;">
        <div class="section-title">CFE (Cotisation Foncière des Entreprises)</div>
        <div class="stat-sub" style="margin-bottom:10px;">Impôt local annuel — sert à générer les rappels dans le Calendrier.</div>
        <form id="param-form-cfe">
          <div style="display:flex; gap:14px;">
            <div class="modal-field" style="flex:1;"><label>Date de création de l'entreprise</label><input type="date" name="dateCreationEntreprise" value="${e.dateCreationEntreprise || ''}" required></div>
            <div class="modal-field" style="flex:1;"><label>Montant CFE annuel (€, une fois connu)</label><input type="number" name="cfeMontantAnnuel" min="0" step="1" placeholder="Pas encore reçu" value="${e.cfeMontantAnnuel != null ? e.cfeMontantAnnuel : ''}"></div>
          </div>
          <div class="stat-sub" style="margin-bottom:8px;">Au-delà de 3000€, acompte de 50% dû le 15 juin. Laisse vide si pas encore reçu.</div>
          <button type="submit" class="btn">Enregistrer</button>
        </form>
        <div class="stat-sub" style="margin-top:10px; padding-top:10px; border-top:1px solid var(--border-subtle);">
          <strong style="color:var(--text-secondary);">À vérifier avant de payer :</strong> base réduite de 50% ta 1ère année complète (2027) ; exonérée si CA ≤ 5 000€ (déclaration initiale 2026 obligatoire quand même).
        </div>
      </div>

      <div class="card" style="margin-top:10px;">
        <div class="section-title">Gestionnaire de mots de passe</div>
        <div class="stat-sub" style="margin-bottom:10px;">Utilisé dans Technique &gt; Accès techniques. Aucun mot de passe stocké ici.</div>
        <form id="param-form-mdp">
          <div class="modal-field"><label>Lien vers ton gestionnaire (ex : Bitwarden, 1Password...)</label><input type="url" name="gestionnaireMdpUrl" placeholder="https://..." value="${e.gestionnaireMdpUrl || ''}"></div>
          <button type="submit" class="btn">Enregistrer</button>
        </form>
      </div>

      <div class="card" style="margin-top:10px;">
        <div class="section-title">Notifications</div>
        <div class="stat-sub" style="margin-bottom:10px;">Pastille rouge sur les onglets concernés + la cloche.</div>
        <label class="devis-paye-label">
          <input type="checkbox" id="param-pastilles-toggle" ${this._pastillesActivees() ? 'checked' : ''}>
          Activer les pastilles de notification
        </label>
      </div>

      <div class="card" style="margin-top:10px;">
        <div class="section-title">Seuils d'alerte</div>
        <div class="stat-sub" style="margin-bottom:10px;">Délais avant que l'app te prévienne.</div>
        <form id="param-form-seuils">
          <div class="modal-field"><label>Relancer un devis envoyé sans réponse, après (jours)</label><input type="number" name="relanceDevisJours" min="1" value="${e.relanceDevisJours || 5}"></div>
          <div style="display:flex; gap:14px;">
            <div class="modal-field" style="flex:1;"><label>Technique — alerte "à venir" (jours)</label><input type="number" name="technique60Jours" min="1" value="${e.technique60Jours || 60}"></div>
            <div class="modal-field" style="flex:1;"><label>Technique — alerte "attention" (jours)</label><input type="number" name="technique30Jours" min="1" value="${e.technique30Jours || 30}"></div>
            <div class="modal-field" style="flex:1;"><label>Technique — alerte "urgent" (jours)</label><input type="number" name="technique7Jours" min="1" value="${e.technique7Jours || 7}"></div>
          </div>
          <button type="submit" class="btn">Enregistrer</button>
        </form>
      </div>
    `;
  },

  // Réglage "pastilles" (03/09/2026) — activé par défaut, désactivable
  // depuis Paramétrage > Général (demande de Tiphaine). Lu par
  // `window.majBadgesNav()` dans app.js.
  _pastillesActivees() {
    return localStorage.getItem('tos_pastilles_actives') !== 'false';
  },

  // ── Devis : réglages spécifiques aux devis ───────────────────────
  _htmlDevis() {
    const catalogue = window.Modules && window.Modules.catalogue;
    const e = catalogue ? catalogue._getEntreprise() : {};
    return `
      <div class="card">
        <div class="section-title">Réglages des devis</div>
        <div class="stat-sub" style="margin-bottom:10px;">Appliqués par défaut à chaque nouveau devis PDF.</div>
        <form id="param-form-devis">
          <div class="modal-field"><label>Mention TVA</label><input type="text" name="mentionTva" value="${e.mentionTva || ''}"></div>
          <div style="display:flex; gap:14px;">
            <div class="modal-field" style="flex:1;"><label>Acompte par défaut (%)</label><input type="number" name="acomptePct" min="0" max="100" value="${e.acomptePct || 50}"></div>
            <div class="modal-field" style="flex:1;"><label>Durée de validité (jours)</label><input type="number" name="dureeValiditeJours" min="1" value="${e.dureeValiditeJours || 30}"></div>
          </div>
          <button type="submit" class="btn">Enregistrer</button>
        </form>
      </div>

      <div class="card" style="margin-top:10px;">
        <div class="section-title">Numérotation des devis</div>
        <div class="stat-sub" style="margin-bottom:10px;">Exemple avec les réglages actuels : <strong style="color:var(--text-primary);">${this._exempleNumero(e)}</strong></div>
        <form id="param-form-numerotation">
          <div style="display:flex; gap:14px;">
            <div class="modal-field" style="flex:1;"><label>Préfixe</label><input type="text" name="numeroPrefixe" placeholder="ex : DEV-" value="${e.numeroPrefixe || ''}"></div>
            <div class="modal-field" style="flex:1;"><label>Chiffres (0 = pas de zéros)</label><input type="number" name="numeroChiffres" min="0" max="6" value="${e.numeroChiffres || 0}"></div>
          </div>
          <label class="devis-paye-label"><input type="checkbox" name="numeroInclureAnnee" ${e.numeroInclureAnnee ? 'checked' : ''}> Inclure l'année du devis (ex : 2026-)</label>
          <button type="submit" class="btn" style="margin-top:10px;">Enregistrer</button>
        </form>
      </div>

      <div class="card" style="margin-top:10px;">
        <div class="section-title">Numérotation des factures</div>
        <div class="stat-sub" style="margin-bottom:10px;">Exemple avec les réglages actuels : <strong style="color:var(--text-primary);">${this._exempleNumeroFacture(e)}</strong></div>
        <form id="param-form-numerotation-facture">
          <div style="display:flex; gap:14px;">
            <div class="modal-field" style="flex:1;"><label>Préfixe</label><input type="text" name="factureNumeroPrefixe" placeholder="ex : FAC-" value="${e.factureNumeroPrefixe || ''}"></div>
            <div class="modal-field" style="flex:1;"><label>Chiffres (0 = pas de zéros)</label><input type="number" name="factureNumeroChiffres" min="0" max="6" value="${e.factureNumeroChiffres || 0}"></div>
          </div>
          <label class="devis-paye-label"><input type="checkbox" name="factureNumeroInclureAnnee" ${e.factureNumeroInclureAnnee ? 'checked' : ''}> Inclure l'année de la facture (ex : 2026-)</label>
          <button type="submit" class="btn" style="margin-top:10px;">Enregistrer</button>
        </form>
      </div>
    `;
  },

  _exempleNumero(e) {
    const brut = 7;
    const prefixe = e.numeroPrefixe || '';
    const chiffres = e.numeroChiffres || 0;
    const inclureAnnee = !!e.numeroInclureAnnee;
    if (!prefixe && !chiffres && !inclureAnnee) return `N° ${brut}`;
    const num = chiffres ? String(brut).padStart(chiffres, '0') : String(brut);
    const annee = inclureAnnee ? `${new Date().getFullYear()}-` : '';
    return `${prefixe}${annee}${num}`;
  },

  _exempleNumeroFacture(e) {
    const brut = 3;
    const prefixe = e.factureNumeroPrefixe || '';
    const chiffres = e.factureNumeroChiffres || 0;
    const inclureAnnee = !!e.factureNumeroInclureAnnee;
    if (!prefixe && !chiffres && !inclureAnnee) return `N° ${brut}`;
    const num = chiffres ? String(brut).padStart(chiffres, '0') : String(brut);
    const annee = inclureAnnee ? `${new Date().getFullYear()}-` : '';
    return `${prefixe}${annee}${num}`;
  },

  // ── CGV ───────────────────────────────────────────────────────────
  _htmlCgv() {
    const catalogue = window.Modules && window.Modules.catalogue;
    const texte = catalogue ? catalogue._getCgv() : '';
    return `
      <div class="card">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; margin-bottom:6px;">
          <div class="section-title" style="margin-bottom:0;">Conditions générales de vente</div>
          <div style="display:flex; gap:8px;">
            <button type="button" class="btn-ghost" id="param-cgv-download">Télécharger (Word)</button>
            <button type="button" class="btn-ghost" id="param-cgv-reset">Réinitialiser (version par défaut)</button>
          </div>
        </div>
        <div class="stat-sub" style="margin-bottom:10px;">Ajoutées à chaque devis PDF. Fais-les relire par un professionnel du droit.</div>
        <form id="param-form-cgv">
          <div class="modal-field">
            <textarea name="texte" style="min-height:55vh; font-family:monospace; font-size:12.5px; line-height:1.5;">${texte}</textarea>
          </div>
          <button type="submit" class="btn">Enregistrer</button>
        </form>
      </div>
    `;
  },

  // ── Apparence ─────────────────────────────────────────────────────
  _htmlApparence() {
    const accentActuel = localStorage.getItem('tos_theme_accent') || '#f5f5f5';
    let fondActuel = '#000000';
    try { fondActuel = (JSON.parse(localStorage.getItem('tos_theme_fond') || 'null') || this._PALETTE_FOND[0]).apercu; } catch (e) { /* ignore */ }
    return `
      <div class="card" style="margin-bottom:10px;">
        <div class="section-title">Couleur d'accent</div>
        <div class="stat-sub" style="margin-bottom:10px;">Boutons, jauges et onglets actifs, dans toute l'appli.</div>
        <div class="param-palette-row param-palette-row-flush" style="display:flex;">
          ${this._PALETTE_ACCENT.map(p => `<button type="button" class="param-palette-swatch ${p.hex === accentActuel ? 'param-palette-swatch-actif' : ''}" data-set-accent="${p.hex}" style="background:${p.hex};" title="${p.nom}"></button>`).join('')}
        </div>
      </div>
      <div class="card" style="margin-bottom:10px;">
        <div class="section-title">Fond de l'appli</div>
        <div class="stat-sub" style="margin-bottom:10px;">Fond général, cartes et sidebar, dans toute l'appli.</div>
        <div class="param-palette-row param-palette-row-flush" style="display:flex;">
          ${this._PALETTE_FOND.map((p, i) => `<button type="button" class="param-palette-swatch ${p.apercu === fondActuel ? 'param-palette-swatch-actif' : ''}" data-set-fond="${i}" style="background:${p.apercu}; border-color:#333;" title="${p.nom}"></button>`).join('')}
        </div>
      </div>
      ${this._htmlApparenceTabbar()}
    `;
  },

  // 08/09/2026 — raccourcis de la barre de nav mobile (voir app.js
  // `window.appliquerTabbar` / `TABBAR_ROUTES_DISPONIBLES`). Accueil et Plus
  // sont fixes ; les 3 du milieu se choisissent ici, un menu déroulant par
  // emplacement. Défaut : Temps, Prospects, Projets.
  _htmlApparenceTabbar() {
    const options = (window.TABBAR_ROUTES_DISPONIBLES || []);
    let routes = (window.TABBAR_DEFAUT || []).slice();
    try {
      const enregistre = JSON.parse(localStorage.getItem('tos_tabbar_routes') || 'null');
      if (Array.isArray(enregistre) && enregistre.length === 3) routes = enregistre;
    } catch (e) { /* ignore */ }
    return `
      <div class="card param-card-mobile-only">
        <div class="section-title">Raccourcis de la barre mobile</div>
        <div class="stat-sub" style="margin-bottom:10px;">"Accueil" et "Plus" restent fixes — choisis les 3 pages entre les deux.</div>
        <div class="param-formule-champs" style="flex-wrap:wrap; gap:10px;">
          ${[0, 1, 2].map(i => `
            <select class="param-input-inline" data-tabbar-slot="${i}" style="min-width:140px;">
              ${options.map(o => `<option value="${o.route}" ${routes[i] === o.route ? 'selected' : ''}>${o.label}</option>`).join('')}
            </select>
          `).join('')}
        </div>
      </div>
    `;
  },

  // ── Catalogue : catégories ────────────────────────────────────────
  _htmlCatalogue() {
    const catalogue = window.Modules && window.Modules.catalogue;
    const categories = catalogue ? catalogue._getCategories() : [];
    return `
      <div class="card">
        <div class="section-title">Catégories d'offres</div>
        <div class="stat-sub" style="margin-bottom:10px;">Pour classer les offres dans Tarifs et les devis.</div>
        <div class="param-liste">
          ${categories.map(c => `
            <div class="param-ligne">
              <span class="param-nom">${c}</span>
              <button type="button" class="row-delete-btn" data-suppr-cat="${c}" title="Supprimer cette catégorie">✕</button>
            </div>
          `).join('') || '<div class="stat-sub">Aucune catégorie pour le moment.</div>'}
        </div>
        <form id="param-ajout-cat" class="param-ajout-ligne">
          <input type="text" name="nom" placeholder="Nouvelle catégorie (ex : Maintenance)" required>
          <button type="submit" class="btn-ghost">+ Ajouter</button>
        </form>
      </div>
    `;
  },

  // ── Clients : statuts ─────────────────────────────────────────────
  _htmlClients() {
    const clients = window.Modules && window.Modules.clients;
    const statuts = clients ? clients._getStatuts() : [];
    return `
      <div class="card">
        <div class="section-title">Statuts clients</div>
        <div class="stat-sub" style="margin-bottom:10px;">Utilisés dans le menu "Statut" de la fiche Client.</div>
        <div class="param-liste">
          ${statuts.map(s => `
            <div class="param-ligne">
              <span class="param-nom">${s}</span>
              <button type="button" class="row-delete-btn" data-suppr-statut="${s}" title="Supprimer ce statut">✕</button>
            </div>
          `).join('') || '<div class="stat-sub">Aucun statut pour le moment.</div>'}
        </div>
        <form id="param-ajout-statut" class="param-ajout-ligne">
          <input type="text" name="nom" placeholder="Nouveau statut (ex : VIP, En pause...)" required>
          <button type="submit" class="btn-ghost">+ Ajouter</button>
        </form>
      </div>
    `;
  },

  // ── Temps : types de tâche & couleurs ─────────────────────────────
  _htmlTemps() {
    const temps = window.Modules && window.Modules.temps;
    if (!temps) return '';
    const types = temps._getTypesTache();
    const palette = temps._PALETTE_COULEURS;
    return `
      <div class="card">
        <div class="section-title">Types de tâche &amp; couleurs</div>
        <div class="stat-sub" style="margin-bottom:10px;">Clique un rond pour changer sa couleur.</div>
        <div class="param-liste">
          ${types.map(t => `
            <div class="param-bloc-type">
              <div class="param-ligne">
                <button type="button" class="param-swatch" data-swatch-type="${t}" style="background:${temps._couleurType(t)};" title="Changer la couleur"></button>
                <span class="param-nom">${t}</span>
                <button type="button" class="row-delete-btn" data-suppr-type="${t}" title="Supprimer ce type">✕</button>
              </div>
              <div class="param-palette-row" data-palette-for="${t}" style="display:none;">
                ${palette.map(p => `<button type="button" class="param-palette-swatch" data-set-couleur="${t}" data-couleur="${p.hex}" style="background:${p.hex};" title="${p.nom}"></button>`).join('')}
              </div>
            </div>
          `).join('') || '<div class="stat-sub">Aucun type pour le moment.</div>'}
        </div>
        <form id="param-ajout-type" class="param-ajout-ligne">
          <input type="text" name="nom" placeholder="Nouveau type (ex : Formation, Admin...)" required>
          <button type="submit" class="btn-ghost">+ Ajouter</button>
        </form>
      </div>
    `;
  },

  // ── Abonnements : formules & tarifs ───────────────────────────────
  _htmlAbonnements() {
    const abos = window.Modules && window.Modules.abonnements;
    const grille = abos ? abos._getGrille() : {};
    return `
      <div class="card">
        <div class="section-title">Formules d'abonnement</div>
        <div class="stat-sub" style="margin-bottom:10px;">Tarif mensuel et heures incluses par formule.</div>
        <div class="param-liste">
          ${Object.keys(grille).map(f => `
            <div class="param-ligne param-ligne-formule">
              <div class="param-formule-top">
                <span class="param-nom">${f}</span>
                <button type="button" class="row-delete-btn" data-suppr-formule="${f}" title="Supprimer cette formule">✕</button>
              </div>
              <div class="param-formule-champs">
                <span class="param-formule-champ"><input type="number" min="0" step="1" value="${grille[f].mrr}" data-formule-mrr="${f}" class="param-input-inline" title="Tarif mensuel (€)"><span class="param-unite">€/mois</span></span>
                <span class="param-formule-champ"><input type="number" min="0" step="0.5" value="${grille[f].heuresIncluses}" data-formule-heures="${f}" class="param-input-inline" title="Heures incluses/mois"><span class="param-unite">h incluses</span></span>
              </div>
            </div>
          `).join('') || '<div class="stat-sub">Aucune formule pour le moment.</div>'}
        </div>
        <form id="param-ajout-formule" class="param-ajout-ligne">
          <input type="text" name="nom" placeholder="Nouvelle formule (ex : Site — Sur mesure)" required>
          <button type="submit" class="btn-ghost">+ Ajouter</button>
        </form>
      </div>
    `;
  },

  // ── Données : export/import + zone dangereuse ─────────────────────
  // 04/09/2026, suite à la revue complète de l'app : jusqu'ici, aucun
  // moyen d'exporter quoi que ce soit — tout vit uniquement dans le
  // localStorage de ce navigateur (devis, clients, CA, CGV signées...).
  // Un cache vidé ou un changement d'ordinateur = business entier perdu
  // sans aucun filet. Risque plus urgent que la migration Firebase.
  _toutesLesClesTos() {
    const cles = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('tos_')) cles.push(k);
    }
    return cles;
  },
  _exporterDonnees() {
    const donnees = {};
    this._toutesLesClesTos().forEach(k => { donnees[k] = localStorage.getItem(k); });
    const payload = { export: 'Tiphaine OS', date: new Date().toISOString(), donnees };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const pad = (n) => String(n).padStart(2, '0');
    const d = new Date();
    a.href = url;
    a.download = `tiphaine-os-sauvegarde-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
  _importerDonnees(fichier, callback) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(reader.result);
        const donnees = payload.donnees || payload; // tolère aussi un export brut sans enveloppe
        const cles = Object.keys(donnees).filter(k => k.startsWith('tos_'));
        if (!cles.length) { callback(false); return; }
        cles.forEach(k => localStorage.setItem(k, donnees[k]));
        callback(true);
      } catch (e) { callback(false); }
    };
    reader.readAsText(fichier);
  },
  _reinitialiserDonnees() {
    this._toutesLesClesTos().forEach(k => localStorage.removeItem(k));
  },

  // ── Jeu de données de démo (05/09/2026, demande de Tiphaine : "voir un
  // truc complet" pour tester l'app avec plusieurs clients) ────────────
  // Entièrement EN MÉMOIRE (comme le reste des données tant que Firebase
  // n'est pas branché — voir app.js) : rien n'est écrit dans
  // localStorage, donc un simple rechargement de page (Ctrl+Maj+R) efface
  // tout et revient à l'état réel précédent. Sûr à essayer sans risque de
  // polluer les vraies données de Tiphaine.
  //
  // Scénario couvrant tout le cycle et tous les liens croisés construits
  // le 05/09/2026 : un prospect converti en client (Julie), un devis
  // signé → projet → acompte facturé et payé, solde pas encore réclamé
  // (Julie) ; un 2e projet entièrement soldé (Karim) ; un devis encore en
  // attente (Karim) et un en brouillon (Sophie) ; une facture partielle
  // hors projet (Sophie, impayée) ; une facture générée directement depuis
  // un devis sans passer par un projet (Antoine) ; un abonnement avec un
  // mois non facturé (Julie) ; un ticket (Karim).
  _chargerDonneesDemo() {
    const now = Date.now();
    const id = (n) => now + n;

    const clients = window.Modules.clients;
    const prospects = window.Modules.prospects;
    const devis = window.Modules.devis;
    const projets = window.Modules.projets;
    const factures = window.Modules.factures;
    const abonnements = window.Modules.abonnements;
    const tickets = window.Modules.tickets;
    if (!clients || !prospects || !devis || !projets || !factures || !abonnements || !tickets) return;

    // Repart d'un jeu vide pour ne jamais mélanger avec des données déjà
    // présentes (réelles ou une démo précédente).
    clients._data = [];
    prospects._data = [];
    devis._data = [];
    projets._data = [];
    factures._data = [];
    abonnements._data = [];
    tickets._data = [];

    // ── Clients ──────────────────────────────────────────────────────
    const clientJulie = { id: id(1), nom: 'Julie Marchand', entreprise: 'Boulangerie Marchand', siret: '812 345 678 00019', adresse: '12 rue du Four, 44000 Nantes', email: 'julie@boulangerie-marchand.fr', telephone: '0612345678', statut: 'Actif', projet: 'Site vitrine', abonnement: 'Sérénité', mrr: 49, prospectId: id(100) };
    const clientKarim = { id: id(2), nom: 'Karim Haddad', entreprise: 'Haddad Conseil', siret: '823 456 789 00027', adresse: '5 avenue Foch, 69006 Lyon', email: 'karim@haddadconseil.fr', telephone: '0623456789', statut: 'Actif', projet: 'Refonte identité visuelle', abonnement: '—', mrr: 0 };
    const clientSophie = { id: id(3), nom: 'Sophie Lenoir', entreprise: 'Lenoir Immobilier', siret: '834 567 890 00035', adresse: '8 place Bellecour, 69002 Lyon', email: 'sophie@lenoir-immo.fr', telephone: '0634567890', statut: 'Impayé', projet: 'Refonte site', abonnement: '—', mrr: 0 };
    const clientAntoine = { id: id(4), nom: 'Antoine Vasseur', entreprise: 'Structure Vasseur', siret: '845 678 901 00043', adresse: '3 rue Nationale, 59800 Lille', email: 'antoine@vasseur.fr', telephone: '0645678901', statut: 'Actif', projet: 'Landing page', abonnement: '—', mrr: 0 };
    const clientNadia = { id: id(5), nom: 'Nadia Fontaine', entreprise: 'Fontaine Architecture', siret: '856 789 012 00051', adresse: '21 cours Mirabeau, 13100 Aix-en-Provence', email: 'nadia@fontaine-architecture.fr', telephone: '0667890123', statut: 'Actif', projet: 'Application de suivi de chantiers', abonnement: 'Application — Performance', mrr: 119, prospectId: id(102) };
    clients._data.push(clientJulie, clientKarim, clientSophie, clientAntoine, clientNadia);

    // ── Prospects : toutes les colonnes du pipeline couvertes (08/09/2026,
    // "toujours pas assez de données... fais une démo plus poussée" —
    // avant ça, À contacter/Rendez-vous/Devis envoyé étaient vides). ──
    prospects._data.push(
      { id: id(100), col: 'Gagné', entreprise: 'Boulangerie Marchand', contact: 'Julie Marchand', email: 'julie@boulangerie-marchand.fr', telephone: '0612345678', moyenContact: 'Email', valeur: 1400, convertiEnClient: true, clientIdCree: clientJulie.id },
      { id: id(101), col: 'En attente de réponse', entreprise: 'Dupont Fleurs', contact: 'Marc Dubreuil', email: 'marc@dupont-fleurs.fr', telephone: '0656789012', moyenContact: 'Téléphone', valeur: 900 },
      { id: id(102), col: 'Gagné', entreprise: 'Fontaine Architecture', contact: 'Nadia Fontaine', email: 'nadia@fontaine-architecture.fr', telephone: '0667890123', moyenContact: 'Email', valeur: 3000, convertiEnClient: true, clientIdCree: clientNadia.id },
      { id: id(103), col: 'Perdu', entreprise: 'Café des Halles', contact: 'Thomas Bricout', email: 'thomas@cafedeshalles.fr', telephone: '0678901234', moyenContact: 'Téléphone', valeur: 900, perdu: true },
      { id: id(104), col: 'À contacter', entreprise: 'Rénov Toiture Dupuis', contact: 'Yann Dupuis', email: 'yann@renov-toiture-dupuis.fr', telephone: '0689012345', moyenContact: 'Email', valeur: 1400 },
      { id: id(105), col: 'À contacter', entreprise: 'Cabinet Meyer Avocats', contact: 'Élise Meyer', email: 'elise@meyer-avocats.fr', telephone: '0690123456', moyenContact: 'LinkedIn', valeur: 2500 },
      { id: id(106), col: 'Rendez-vous', entreprise: 'Salon Belle Étoile', contact: 'Camille Roussel', email: 'camille@salon-belle-etoile.fr', telephone: '0601122334', moyenContact: 'Téléphone', valeur: 1900 },
      { id: id(107), col: 'Rendez-vous', entreprise: 'Garage Lefort', contact: 'Bruno Lefort', email: 'bruno@garage-lefort.fr', telephone: '0612233445', moyenContact: 'Email', valeur: 1400 },
      { id: id(108), col: 'Devis envoyé', entreprise: 'Atelier Couture Rive', contact: 'Léa Costa', email: 'lea@atelier-couture-rive.fr', telephone: '0623344556', moyenContact: 'Email', valeur: 900 },
      { id: id(109), col: 'Devis envoyé', entreprise: 'Traiteur Nguyen', contact: 'Minh Nguyen', email: 'minh@traiteur-nguyen.fr', telephone: '0634455667', moyenContact: 'Téléphone', valeur: 1900 }
    );

    // ── Devis ──────────────────────────────────────────────────────
    const devisJulie = { id: id(200), numero: 1, client: clientJulie.nom, entreprise: clientJulie.entreprise, clientId: clientJulie.id, siretClient: clientJulie.siret, adresseClient: clientJulie.adresse, emailClient: clientJulie.email, offre: 'Site vitrine — 3 pages', montant: 1400, description: 'Site vitrine 3 pages + formulaire de contact.', statut: 'Accepté', date: '2026-08-05', signeSansFichier: true, convertiEnProjet: true, modifieLe: null };
    const devisKarim = { id: id(201), numero: 2, client: clientKarim.nom, entreprise: clientKarim.entreprise, clientId: clientKarim.id, siretClient: clientKarim.siret, adresseClient: clientKarim.adresse, emailClient: clientKarim.email, offre: 'Application — Sur-mesure', montant: 3200, description: 'Application de gestion de rendez-vous clients.', statut: 'Envoyé', date: '2026-09-02', convertiEnProjet: false, modifieLe: null };
    const devisSophie = { id: id(202), numero: 3, client: clientSophie.nom, entreprise: clientSophie.entreprise, clientId: clientSophie.id, siretClient: clientSophie.siret, adresseClient: clientSophie.adresse, emailClient: clientSophie.email, offre: 'Site vitrine — 5 pages', montant: 1900, description: '', statut: 'Brouillon', date: '2026-09-06', convertiEnProjet: false, modifieLe: null };
    const devisAntoine = { id: id(203), numero: 4, client: clientAntoine.nom, entreprise: clientAntoine.entreprise, clientId: clientAntoine.id, siretClient: clientAntoine.siret, adresseClient: clientAntoine.adresse, emailClient: clientAntoine.email, offre: 'Site vitrine — 1 page', montant: 900, description: 'Landing page évènementielle.', statut: 'Accepté', date: '2026-08-20', signeSansFichier: true, convertiEnProjet: false, factureCompleteGeneree: true, modifieLe: null };
    const devisNadia = { id: id(204), numero: 5, client: clientNadia.nom, entreprise: clientNadia.entreprise, clientId: clientNadia.id, siretClient: clientNadia.siret, adresseClient: clientNadia.adresse, emailClient: clientNadia.email, offre: 'Application — Création complète', montant: 3000, description: 'Application de suivi de chantiers, plusieurs utilisateurs.', statut: 'Accepté', date: '2026-08-28', signeSansFichier: true, convertiEnProjet: true, modifieLe: null };
    const devisCafe = { id: id(205), numero: 6, client: 'Thomas Bricout', entreprise: 'Café des Halles', clientId: null, siretClient: '', adresseClient: '', emailClient: 'thomas@cafedeshalles.fr', offre: 'Site vitrine — 1 page', montant: 900, description: 'Site vitrine avec carte et horaires.', statut: 'Refusé', date: '2026-08-12', convertiEnProjet: false, modifieLe: null };
    const devisLea = { id: id(206), numero: 7, client: 'Léa Costa', entreprise: 'Atelier Couture Rive', clientId: null, siretClient: '', adresseClient: '', emailClient: 'lea@atelier-couture-rive.fr', offre: 'Site vitrine — 1 page', montant: 900, description: 'Site vitrine avec catalogue de créations.', statut: 'Envoyé', date: '2026-09-04', convertiEnProjet: false, modifieLe: null };
    const devisMinh = { id: id(207), numero: 8, client: 'Minh Nguyen', entreprise: 'Traiteur Nguyen', clientId: null, siretClient: '', adresseClient: '', emailClient: 'minh@traiteur-nguyen.fr', offre: 'Site vitrine — 5 pages', montant: 1900, description: 'Site vitrine avec menus et formulaire de devis événementiel.', statut: 'Envoyé', date: '2026-09-06', convertiEnProjet: false, modifieLe: null };
    devis._data.push(devisJulie, devisKarim, devisSophie, devisAntoine, devisNadia, devisCafe, devisLea, devisMinh);

    // ── Projets ────────────────────────────────────────────────────
    const projetJulie = { id: id(300), nom: devisJulie.offre, client: clientJulie.nom, entreprise: clientJulie.entreprise, clientId: clientJulie.id, montant: devisJulie.montant, statut: 'En cours', dateDebut: '2026-08-06', checklist: projets._checklistParDefaut(), devisId: devisJulie.id, acompteRecu: true, soldePaye: false, factureAcompteGeneree: true, factureSoldeGeneree: false };
    projetJulie.checklist[0].done = true;
    projetJulie.checklist[1].done = true;
    const projetKarim = { id: id(301), nom: 'Refonte identité visuelle', client: clientKarim.nom, entreprise: clientKarim.entreprise, clientId: clientKarim.id, montant: 1200, statut: 'Terminé', dateDebut: '2026-07-01', checklist: projets._checklistParDefaut().map(c => Object.assign({}, c, { done: true })), acompteRecu: true, soldePaye: true, factureAcompteGeneree: true, factureSoldeGeneree: true };
    const projetNadia = { id: id(302), nom: devisNadia.offre, client: clientNadia.nom, entreprise: clientNadia.entreprise, clientId: clientNadia.id, montant: devisNadia.montant, statut: 'En cours', dateDebut: '2026-08-29', checklist: projets._checklistParDefaut(), devisId: devisNadia.id, acompteRecu: true, soldePaye: false, factureAcompteGeneree: true, factureSoldeGeneree: false };
    projetNadia.checklist[0].done = true;
    projets._data.push(projetJulie, projetKarim, projetNadia);

    // ── Factures ───────────────────────────────────────────────────
    const facAcompteJulie = { id: id(400), numero: 1, type: 'Acompte', client: clientJulie.nom, entreprise: clientJulie.entreprise, clientId: clientJulie.id, siretClient: clientJulie.siret, adresseClient: clientJulie.adresse, emailClient: clientJulie.email, lignes: [{ description: 'Acompte (50%) — Site vitrine — 3 pages', montant: 700, abonnementId: null, periode: null }], montant: 700, libelle: 'Acompte (50%) — Site vitrine — 3 pages', montantPaye: 700, datePaiement: '2026-08-07', modePaiement: 'Virement', notePaiement: '', statut: 'Payée', date: '2026-08-06', projetId: projetJulie.id, devisId: null, modifieLe: null };
    const facAcompteKarim = { id: id(401), numero: 2, type: 'Acompte', client: clientKarim.nom, entreprise: clientKarim.entreprise, clientId: clientKarim.id, siretClient: clientKarim.siret, adresseClient: clientKarim.adresse, emailClient: clientKarim.email, lignes: [{ description: 'Acompte (50%) — Refonte identité visuelle', montant: 600, abonnementId: null, periode: null }], montant: 600, libelle: 'Acompte (50%) — Refonte identité visuelle', montantPaye: 600, datePaiement: '2026-07-02', modePaiement: 'Virement', notePaiement: '', statut: 'Payée', date: '2026-07-01', projetId: projetKarim.id, devisId: null, modifieLe: null };
    const facSoldeKarim = { id: id(402), numero: 3, type: 'Solde', client: clientKarim.nom, entreprise: clientKarim.entreprise, clientId: clientKarim.id, siretClient: clientKarim.siret, adresseClient: clientKarim.adresse, emailClient: clientKarim.email, lignes: [{ description: 'Solde — Refonte identité visuelle', montant: 600, abonnementId: null, periode: null }], montant: 600, libelle: 'Solde — Refonte identité visuelle', montantPaye: 600, datePaiement: '2026-07-28', modePaiement: 'Virement', notePaiement: '', statut: 'Payée', date: '2026-07-25', projetId: projetKarim.id, devisId: null, modifieLe: null };
    const facSophie = { id: id(403), numero: 4, type: 'Facture unique', client: clientSophie.nom, entreprise: clientSophie.entreprise, clientId: clientSophie.id, siretClient: clientSophie.siret, adresseClient: clientSophie.adresse, emailClient: clientSophie.email, lignes: [{ description: 'Maintenance ponctuelle — refonte partielle', montant: 450, abonnementId: null, periode: null }], montant: 450, libelle: 'Maintenance ponctuelle — refonte partielle', montantPaye: 150, datePaiement: '2026-08-15', modePaiement: 'Virement', notePaiement: 'Acompte partiel reçu', statut: 'Partiellement payée', date: '2026-08-10', projetId: null, devisId: null, modifieLe: null };
    const facAntoine = { id: id(404), numero: 5, type: 'Facture unique', client: clientAntoine.nom, entreprise: clientAntoine.entreprise, clientId: clientAntoine.id, siretClient: clientAntoine.siret, adresseClient: clientAntoine.adresse, emailClient: clientAntoine.email, lignes: [{ description: devisAntoine.offre, montant: devisAntoine.montant, abonnementId: null, periode: null }], montant: devisAntoine.montant, libelle: devisAntoine.offre, montantPaye: devisAntoine.montant, datePaiement: '2026-08-22', modePaiement: 'Carte bancaire', notePaiement: '', statut: 'Payée', date: '2026-08-21', projetId: null, devisId: devisAntoine.id, modifieLe: null };
    const facAcompteNadia = { id: id(405), numero: 6, type: 'Acompte', client: clientNadia.nom, entreprise: clientNadia.entreprise, clientId: clientNadia.id, siretClient: clientNadia.siret, adresseClient: clientNadia.adresse, emailClient: clientNadia.email, lignes: [{ description: 'Acompte (50%) — Application de suivi de chantiers', montant: 1500, abonnementId: null, periode: null }], montant: 1500, libelle: 'Acompte (50%) — Application de suivi de chantiers', montantPaye: 1500, datePaiement: '2026-08-30', modePaiement: 'Virement', notePaiement: '', statut: 'Payée', date: '2026-08-29', projetId: projetNadia.id, devisId: null, modifieLe: null };
    factures._data.push(facAcompteJulie, facAcompteKarim, facSoldeKarim, facSophie, facAntoine, facAcompteNadia);

    // ── Abonnements — Julie (démarré il y a plusieurs mois, pour avoir
    // au moins un mois non facturé à tester le bouton "Facturer") +
    // Nadia (formule Performance, plus récente). ──────────────────────
    abonnements._data.push(
      { id: id(500), client: clientJulie.nom, entreprise: clientJulie.entreprise, clientId: clientJulie.id, formule: 'Site — Sérénité', dateDebut: '2026-06-15' },
      { id: id(501), client: clientNadia.nom, entreprise: clientNadia.entreprise, clientId: clientNadia.id, formule: 'App — Performance', dateDebut: '2026-08-29' }
    );

    // ── Tickets — un ouvert (Karim), un résolu (Julie) ────────────────
    tickets._data.push(
      { id: id(600), client: clientKarim.nom, entreprise: clientKarim.entreprise, clientId: clientKarim.id, sujet: "Bug formulaire de contact — pas d'email reçu", priorite: 'Haute', statut: 'Ouvert', date: '2026-09-05' },
      { id: id(601), client: clientJulie.nom, entreprise: clientJulie.entreprise, clientId: clientJulie.id, sujet: 'Changer la photo de couverture du site', priorite: 'Basse', statut: 'Résolu', date: '2026-08-18' }
    );

    if (window.majBadgesNav) window.majBadgesNav();
  },

  _htmlDonnees() {
    const cles = this._toutesLesClesTos();
    return `
      <div class="card">
        <div class="section-title">Sauvegarde</div>
        <div class="stat-sub" style="margin-bottom:10px;">Tes données vivent uniquement dans ce navigateur. Télécharge un export régulièrement.</div>
        <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
          <button type="button" class="btn" id="param-export-btn">Télécharger une sauvegarde (.json)</button>
          <label class="btn-ghost" style="cursor:pointer; margin:0;">
            Restaurer une sauvegarde
            <input type="file" accept="application/json" id="param-import-input" style="display:none;">
          </label>
        </div>
        <div class="stat-sub" style="margin-top:8px;">${cles.length} bloc${cles.length > 1 ? 's' : ''} de données enregistrés dans ce navigateur.</div>
      </div>

      <div class="card" style="margin-top:10px;">
        <div class="section-title">Jeu de données de démo</div>
        <div class="stat-sub" style="margin-bottom:10px;">Charge un exemple complet pour tester l'app. Remplace temporairement tes données — Ctrl+Maj+R pour revenir en arrière.</div>
        <button type="button" class="btn btn-ghost" id="param-demo-btn">Charger la démo</button>
      </div>

      <div class="card" style="margin-top:10px; border-color:#3a1f1f; background:#140d0d;">
        <div class="section-title" style="color:#e0a0a0;">Zone dangereuse</div>
        <div class="stat-sub" style="margin-bottom:10px;">Supprime toutes les données de ce navigateur, définitivement. Sauvegarde d'abord si besoin.</div>
        <button type="button" class="btn btn-danger" id="param-reset-btn">Tout réinitialiser</button>
      </div>
    `;
  },

  // ── Événements ────────────────────────────────────────────────────
  _bindEvents(container) {
    const temps = window.Modules && window.Modules.temps;
    const clients = window.Modules && window.Modules.clients;
    const catalogue = window.Modules && window.Modules.catalogue;
    const abos = window.Modules && window.Modules.abonnements;

    // Sous-onglets.
    container.querySelectorAll('[data-souonglet]').forEach(tab => {
      tab.addEventListener('click', () => {
        this._souOnglet = tab.dataset.souonglet;
        this.render(this._root);
      });
    });

    // Général.
    const formGeneral = container.querySelector('#param-form-general');
    if (formGeneral) formGeneral.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      catalogue._setEntreprise({
        ...catalogue._getEntreprise(),
        nom: fd.get('nom').trim(), siret: fd.get('siret').trim(), adresse: fd.get('adresse').trim(),
        email: fd.get('email').trim(), titulaireCompte: fd.get('titulaireCompte').trim(),
        banque: fd.get('banque').trim(), iban: fd.get('iban').trim(), bic: fd.get('bic').trim(),
      });
      this.render(this._root);
    });

    // Seuils fiscaux.
    const formFiscal = container.querySelector('#param-form-fiscal');
    if (formFiscal) formFiscal.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      catalogue._setEntreprise({
        ...catalogue._getEntreprise(),
        seuilTvaBase: parseInt(fd.get('seuilTvaBase') || '37500', 10),
        seuilTvaMajore: parseInt(fd.get('seuilTvaMajore') || '41250', 10),
        plafondMicro: parseInt(fd.get('plafondMicro') || '83600', 10),
        urssafTaux: parseFloat(fd.get('urssafTaux') || '25.6'),
      });
      this.render(this._root);
    });

    // CFE.
    const formCfe = container.querySelector('#param-form-cfe');
    if (formCfe) formCfe.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const montant = fd.get('cfeMontantAnnuel');
      catalogue._setEntreprise({
        ...catalogue._getEntreprise(),
        dateCreationEntreprise: fd.get('dateCreationEntreprise'),
        cfeMontantAnnuel: montant ? parseFloat(montant) : null,
      });
      this.render(this._root);
    });

    // Gestionnaire de mots de passe (lien seulement — jamais de mot de
    // passe stocké ici).
    const formMdp = container.querySelector('#param-form-mdp');
    if (formMdp) formMdp.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      catalogue._setEntreprise({
        ...catalogue._getEntreprise(),
        gestionnaireMdpUrl: fd.get('gestionnaireMdpUrl').trim(),
      });
      this.render(this._root);
    });

    // Notifications (pastilles) — pas de formulaire, juste une case à
    // cocher appliquée immédiatement.
    const pastillesToggle = container.querySelector('#param-pastilles-toggle');
    if (pastillesToggle) pastillesToggle.addEventListener('change', () => {
      localStorage.setItem('tos_pastilles_actives', pastillesToggle.checked ? 'true' : 'false');
      if (window.majBadgesNav) window.majBadgesNav();
    });

    // Seuils d'alerte.
    const formSeuils = container.querySelector('#param-form-seuils');
    if (formSeuils) formSeuils.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      catalogue._setEntreprise({
        ...catalogue._getEntreprise(),
        relanceDevisJours: parseInt(fd.get('relanceDevisJours') || '5', 10),
        technique60Jours: parseInt(fd.get('technique60Jours') || '60', 10),
        technique30Jours: parseInt(fd.get('technique30Jours') || '30', 10),
        technique7Jours: parseInt(fd.get('technique7Jours') || '7', 10),
      });
      if (window.majBadgesNav) window.majBadgesNav();
      this.render(this._root);
    });

    // Numérotation des devis.
    const formNumerotation = container.querySelector('#param-form-numerotation');
    if (formNumerotation) formNumerotation.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      catalogue._setEntreprise({
        ...catalogue._getEntreprise(),
        numeroPrefixe: fd.get('numeroPrefixe').trim(),
        numeroChiffres: parseInt(fd.get('numeroChiffres') || '0', 10),
        numeroInclureAnnee: fd.get('numeroInclureAnnee') === 'on',
      });
      this.render(this._root);
    });

    // Numérotation des factures.
    const formNumerotationFacture = container.querySelector('#param-form-numerotation-facture');
    if (formNumerotationFacture) formNumerotationFacture.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      catalogue._setEntreprise({
        ...catalogue._getEntreprise(),
        factureNumeroPrefixe: fd.get('factureNumeroPrefixe').trim(),
        factureNumeroChiffres: parseInt(fd.get('factureNumeroChiffres') || '0', 10),
        factureNumeroInclureAnnee: fd.get('factureNumeroInclureAnnee') === 'on',
      });
      this.render(this._root);
    });

    // Données : export / import / zone dangereuse.
    const exportBtn = container.querySelector('#param-export-btn');
    if (exportBtn) exportBtn.addEventListener('click', () => this._exporterDonnees());

    const importInput = container.querySelector('#param-import-input');
    if (importInput) importInput.addEventListener('change', () => {
      const fichier = importInput.files[0];
      if (!fichier) return;
      window.confirmerAction(
        'Restaurer cette sauvegarde ? Toutes les données actuelles de ce navigateur seront remplacées par celles du fichier.',
        () => {
          this._importerDonnees(fichier, (ok) => {
            if (ok) {
              window.confirmerAction('Sauvegarde restaurée. La page va se recharger pour appliquer les données.', () => location.reload(), { titre: 'Restauration réussie', texteBouton: 'Recharger', danger: false });
            } else {
              window.confirmerAction("Ce fichier n'est pas une sauvegarde valide — rien n'a été modifié.", () => {}, { titre: 'Fichier invalide', texteBouton: 'OK', danger: false });
            }
          });
        },
        { titre: 'Restaurer une sauvegarde', texteBouton: 'Restaurer' }
      );
      importInput.value = '';
    });

    const demoBtn = container.querySelector('#param-demo-btn');
    if (demoBtn) demoBtn.addEventListener('click', () => {
      window.confirmerAction(
        "Charger un jeu de données de démo (4 clients, devis, projets, factures, abonnement, ticket) ? Ça remplace temporairement ce qui est affiché dans ce navigateur — rien n'est sauvegardé, un rechargement de page (Ctrl+Maj+R) efface la démo.",
        () => {
          this._chargerDonneesDemo();
          location.hash = '#/dashboard';
        },
        { titre: 'Charger la démo', texteBouton: 'Charger la démo', danger: false }
      );
    });

    const resetBtn = container.querySelector('#param-reset-btn');
    if (resetBtn) resetBtn.addEventListener('click', () => {
      window.confirmerAction(
        "Toutes les données de ce navigateur (devis, clients, catalogue, réglages...) seront supprimées définitivement. As-tu téléchargé une sauvegarde ? Cette action est irréversible.",
        () => { this._reinitialiserDonnees(); location.reload(); },
        { titre: 'Tout réinitialiser', texteBouton: 'Oui, tout réinitialiser' }
      );
    });

    // Devis.
    const formDevis = container.querySelector('#param-form-devis');
    if (formDevis) formDevis.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      catalogue._setEntreprise({
        ...catalogue._getEntreprise(),
        mentionTva: fd.get('mentionTva').trim(),
        acomptePct: parseInt(fd.get('acomptePct') || '50', 10),
        dureeValiditeJours: parseInt(fd.get('dureeValiditeJours') || '30', 10),
      });
      this.render(this._root);
    });

    // CGV.
    const formCgv = container.querySelector('#param-form-cgv');
    if (formCgv) formCgv.addEventListener('submit', (e) => {
      e.preventDefault();
      catalogue._setCgv(new FormData(e.target).get('texte'));
      this.render(this._root);
    });
    const cgvReset = container.querySelector('#param-cgv-reset');
    if (cgvReset) cgvReset.addEventListener('click', () => {
      window.confirmerAction('Remplacer le texte actuel par la version par défaut ? Tes modifications seront perdues.', () => {
        container.querySelector('#param-form-cgv textarea[name="texte"]').value = catalogue._cgvParDefaut();
      });
    });
    const cgvDownload = container.querySelector('#param-cgv-download');
    if (cgvDownload) cgvDownload.addEventListener('click', () => catalogue._telechargerCgvWord());

    // Apparence.
    container.querySelectorAll('[data-set-accent]').forEach(btn => {
      btn.addEventListener('click', () => {
        const hex = btn.dataset.setAccent;
        localStorage.setItem('tos_theme_accent', hex);
        window.appliquerAccent(hex);
        this.render(this._root);
      });
    });
    container.querySelectorAll('[data-set-fond]').forEach(btn => {
      btn.addEventListener('click', () => {
        const preset = this._PALETTE_FOND[Number(btn.dataset.setFond)];
        localStorage.setItem('tos_theme_fond', JSON.stringify(preset));
        window.appliquerFond(preset);
        this.render(this._root);
      });
    });
    container.querySelectorAll('[data-tabbar-slot]').forEach(sel => {
      sel.addEventListener('change', () => {
        const slots = container.querySelectorAll('[data-tabbar-slot]');
        const routes = Array.from(slots).map(s => s.value);
        localStorage.setItem('tos_tabbar_routes', JSON.stringify(routes));
        if (window.appliquerTabbar) window.appliquerTabbar();
      });
    });

    // Catalogue (catégories).
    container.querySelectorAll('[data-suppr-cat]').forEach(btn => {
      btn.addEventListener('click', () => { catalogue._supprimerCategorie(btn.dataset.supprCat); this.render(this._root); });
    });
    const formCat = container.querySelector('#param-ajout-cat');
    if (formCat) formCat.addEventListener('submit', (e) => {
      e.preventDefault();
      const nom = new FormData(e.target).get('nom').trim();
      if (nom) catalogue._ajouterCategorie(nom);
      this.render(this._root);
    });

    // Clients (statuts).
    container.querySelectorAll('[data-suppr-statut]').forEach(btn => {
      btn.addEventListener('click', () => {
        window.confirmerAction(`Supprimer le statut "${btn.dataset.supprStatut}" ? Les clients qui l'ont déjà gardent ce texte sur leur fiche.`, () => {
          clients._setStatuts(clients._getStatuts().filter(s => s !== btn.dataset.supprStatut));
          this.render(this._root);
        });
      });
    });
    const formStatut = container.querySelector('#param-ajout-statut');
    if (formStatut) formStatut.addEventListener('submit', (e) => {
      e.preventDefault();
      const nom = new FormData(e.target).get('nom').trim();
      if (!nom) return;
      const existants = clients._getStatuts();
      if (!existants.includes(nom)) clients._setStatuts([...existants, nom]);
      this.render(this._root);
    });

    // Temps (types & couleurs).
    container.querySelectorAll('[data-swatch-type]').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = container.querySelector(`[data-palette-for="${CSS.escape(btn.dataset.swatchType)}"]`);
        const dejaOuverte = row.style.display !== 'none';
        container.querySelectorAll('.param-palette-row[data-palette-for]').forEach(r => { r.style.display = 'none'; });
        row.style.display = dejaOuverte ? 'none' : 'flex';
      });
    });
    container.querySelectorAll('[data-set-couleur]').forEach(btn => {
      btn.addEventListener('click', () => { temps._setCouleurType(btn.dataset.setCouleur, btn.dataset.couleur); this.render(this._root); });
    });
    container.querySelectorAll('[data-suppr-type]').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.supprType;
        window.confirmerAction(`Supprimer le type "${type}" de la liste ? Les créneaux déjà enregistrés avec ce type gardent leur texte, ils passeront juste en gris.`, () => {
          temps._setTypesTache(temps._getTypesTache().filter(t => t !== type));
          temps._supprimerCouleurType(type);
          this.render(this._root);
        });
      });
    });
    const formType = container.querySelector('#param-ajout-type');
    if (formType) formType.addEventListener('submit', (e) => {
      e.preventDefault();
      const nom = new FormData(e.target).get('nom').trim();
      if (nom) temps._ajouterTypeAvecCouleur(nom);
      this.render(this._root);
    });

    // Abonnements (formules).
    container.querySelectorAll('[data-formule-mrr]').forEach(input => {
      input.addEventListener('change', () => abos._modifierFormule(input.dataset.formuleMrr, 'mrr', Number(input.value) || 0));
    });
    container.querySelectorAll('[data-formule-heures]').forEach(input => {
      input.addEventListener('change', () => abos._modifierFormule(input.dataset.formuleHeures, 'heuresIncluses', Number(input.value) || 0));
    });
    container.querySelectorAll('[data-suppr-formule]').forEach(btn => {
      btn.addEventListener('click', () => { if (abos._supprimerFormule(btn.dataset.supprFormule)) this.render(this._root); });
    });
    const formFormule = container.querySelector('#param-ajout-formule');
    if (formFormule) formFormule.addEventListener('submit', (e) => {
      e.preventDefault();
      const nom = new FormData(e.target).get('nom').trim();
      if (nom) abos._ajouterFormule(nom);
      this.render(this._root);
    });
  },
};

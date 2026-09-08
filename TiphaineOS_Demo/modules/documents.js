/* ═══════════════════════════════════════════════════════════
   MODULE DOCUMENTS — "un espace central par client" (cahier des
   charges, section 24) : devis, contrats, cahiers des charges,
   captures, logos, contenus, fichiers client, livrables. Les
   factures restent en lien externe (pas de générateur de facture
   maison, cohérent avec Finances) — mais Tiphaine a choisi (04/09/2026,
   question posée avant de construire) d'avoir un vrai upload pour tout
   le reste plutôt que des liens externes partout, sachant que Firebase
   Storage arrivera plus tard pour lever la limite.

   ⚠️ LIMITE CONNUE, VOLONTAIRE : tant que Firebase Storage n'est pas
   branché, les fichiers uploadés sont stockés en base64 directement
   dans localStorage (clé `tos_documents`) — le quota total d'un
   navigateur pour un site est généralement de ~5-10 Mo, PARTAGÉ avec
   toutes les autres données de l'app (devis, projets, temps...). Donc :
   - Chaque fichier a un garde-fou de taille (~4 Mo brut) au moment de
     l'upload, avec message clair si dépassé.
   - Une jauge d'usage est affichée en haut de la page pour suivre la
     consommation totale et éviter la surprise.
   - Le mode "Lien externe" (Drive/Dropbox/OneDrive...) reste toujours
     disponible pour les gros fichiers (scans, contrats longs) — pas de
     limite de taille dans ce cas.
   TODO Firebase : migrer `fichierData` (base64) vers Firebase Storage
   (upload réel, URL de téléchargement) dès que branché — le mode
   "Lien externe" restera identique.
═══════════════════════════════════════════════════════════ */

window.Modules = window.Modules || {};

window.Modules.documents = {
  _data: null,
  _clientFiltre: 'tous', // 'tous' | 'general' | id client
  // "dossiers" (par défaut, une grille : un dossier par client + un
  // dossier "Général") ou "documents" (contenu d'un dossier ouvert) —
  // 04/09/2026, retour de Tiphaine : le simple filtre sur une liste à
  // plat ne rendait pas "chaque client a son dossier", elle voulait une
  // vraie notion de dossier à ouvrir/télécharger, pas juste une vue
  // générale qu'on filtre.
  _vue: 'dossiers',
  _rechercheDossiers: '',

  _TYPES: ['Devis', 'Contrat', 'Cahier des charges', 'Facture', 'Capture', 'Logo', 'Contenu', 'Fichier client', 'Livrable', 'Autre'],
  _COULEUR_TYPE: {
    'Devis': '#378add', 'Contrat': '#a58fe0', 'Cahier des charges': '#a58fe0',
    'Facture': '#e0a95c', 'Capture': '#6ec88c', 'Logo': '#6ec88c',
    'Contenu': '#6ec88c', 'Fichier client': '#378add', 'Livrable': '#e05c5c', 'Autre': '#8a8a8a',
  },

  // Garde-fou de taille par fichier (brut, avant encodage base64 —
  // l'encodage ajoute ~33%). ~4 Mo bruts ≈ ~5.3 Mo en base64.
  _TAILLE_MAX_OCTETS: 4 * 1024 * 1024,
  // Référence indicative pour la jauge d'usage — le vrai quota varie
  // selon le navigateur, 5 Mo est une hypothèse basse et prudente.
  _QUOTA_INDICATIF_OCTETS: 5 * 1024 * 1024,

  async render(container) {
    if (!this._data) {
      this._data = window.FIREBASE_READY ? await this._fetchReal() : this._getData();
    }
    this._root = container.closest('#content') || container;
    container.innerHTML = this._html();
    window.hydrateIcons(container);
    this._bindEvents(container);
  },

  // ── Persistance ────────────────────────────────────────────────
  _getData() {
    try {
      const stocke = JSON.parse(localStorage.getItem('tos_documents') || 'null');
      if (Array.isArray(stocke)) return stocke;
    } catch (e) { /* ignore */ }
    return [];
  },
  _setData(data) {
    localStorage.setItem('tos_documents', JSON.stringify(data));
  },
  async _fetchReal() {
    // TODO Firebase : collection `documents` + Firebase Storage pour
    // `fichierData`.
    return this._getData();
  },

  // ── Aides ──────────────────────────────────────────────────────
  _clients() {
    const clients = window.Modules.clients;
    if (!clients) return [];
    if (!clients._data) clients._data = window.FIREBASE_READY ? [] : clients._mock();
    return clients._data;
  },
  _nomClient(clientId) {
    if (!clientId) return 'Général';
    const c = this._clients().find(c => c.id === clientId);
    return c ? c.nom : 'Client supprimé';
  },
  _formatTaille(octets) {
    if (!octets) return '—';
    if (octets < 1024) return `${octets} o`;
    if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(0)} Ko`;
    return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
  },
  _tailleTotaleOctets() {
    return this._data.reduce((s, d) => s + (d.fichierTaille || 0), 0);
  },
  // Libellé affiché sur le déclencheur du combobox client.
  _labelClientFiltre() {
    if (this._clientFiltre === 'tous') return 'Tous';
    if (this._clientFiltre === 'general') return 'Général (sans client)';
    const c = this._clients().find(c => String(c.id) === String(this._clientFiltre));
    return c ? c.nom : 'Tous';
  },

  // Combobox générique "recherche + liste déroulante" (04/09/2026,
  // demande de Tiphaine : "une recherche client avec la flèche de
  // défilement", puis redemandé pour le formulaire d'ajout) — un vrai
  // `<select>` HTML natif n'a ni recherche, ni contrôle sur le style de
  // la liste. Ici : un déclencheur (libellé + flèche ▾) qui ouvre un
  // panneau avec un champ de recherche et une liste scrollable filtrée
  // en direct. Réutilisé à la fois pour le filtre client de la page ET
  // le champ client du formulaire d'ajout/édition (même composant, pas
  // deux implémentations à maintenir).
  // `options` = [{valeur, label}], `nomChamp` optionnel = pose un
  // `name=` sur le champ caché, pour qu'un `<form>` englobant le
  // récupère automatiquement via `FormData` sans code JS dédié.
  _htmlCombo(id, options, valeurActuelle, placeholder, nomChamp) {
    const actuelle = options.find(o => String(o.valeur) === String(valeurActuelle));
    return `
      <div class="documents-combo" id="${id}">
        <button type="button" class="documents-combo-trigger" data-combo-trigger>
          <span data-combo-label>${actuelle ? actuelle.label : (options[0] ? options[0].label : '')}</span>
          <span class="documents-combo-fleche">▾</span>
        </button>
        <div class="documents-combo-panel" data-combo-panel hidden>
          <input type="text" class="documents-combo-recherche" data-combo-recherche placeholder="${placeholder || 'Rechercher...'}">
          <div class="documents-combo-liste" data-combo-liste>
            ${options.map(o => `<div class="documents-combo-item" data-valeur="${o.valeur}" data-nom="${o.label.toLowerCase()}">${o.label}</div>`).join('')}
          </div>
        </div>
        <input type="hidden" data-combo-valeur ${nomChamp ? `name="${nomChamp}"` : ''} value="${valeurActuelle == null ? '' : valeurActuelle}">
      </div>
    `;
  },

  _bindCombo(container, id, onSelect) {
    const combo = container.querySelector(`#${id}`);
    if (!combo) return;
    const trigger = combo.querySelector('[data-combo-trigger]');
    const panel = combo.querySelector('[data-combo-panel]');
    const recherche = combo.querySelector('[data-combo-recherche]');
    const items = combo.querySelectorAll('.documents-combo-item');
    const labelEl = combo.querySelector('[data-combo-label]');
    const hidden = combo.querySelector('[data-combo-valeur]');

    const ouvrir = () => { panel.hidden = false; recherche.value = ''; items.forEach(i => i.style.display = ''); recherche.focus(); };
    const fermer = () => { panel.hidden = true; };

    trigger.addEventListener('click', () => { panel.hidden ? ouvrir() : fermer(); });
    recherche.addEventListener('input', () => {
      const q = recherche.value.trim().toLowerCase();
      items.forEach(item => { item.style.display = (item.dataset.nom || item.textContent.toLowerCase()).includes(q) ? '' : 'none'; });
    });
    recherche.addEventListener('blur', () => setTimeout(fermer, 150));
    items.forEach(item => {
      item.addEventListener('mousedown', (e) => e.preventDefault()); // évite que le blur ferme avant le click
      item.addEventListener('click', () => {
        hidden.value = item.dataset.valeur;
        labelEl.textContent = item.textContent;
        fermer();
        if (onSelect) onSelect(item.dataset.valeur);
      });
    });
  },

  _iconPourDoc(d) {
    if (d.mode === 'lien') return 'link';
    if (d.fichierMime && d.fichierMime.startsWith('image/')) return 'image';
    return 'fileText';
  },

  _documentsFiltres() {
    let liste = this._data;
    if (this._clientFiltre === 'general') liste = liste.filter(d => !d.clientId);
    else if (this._clientFiltre !== 'tous') liste = liste.filter(d => d.clientId === Number(this._clientFiltre));
    return liste.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  },

  // Liste des dossiers : un par client (TOUS les clients, même sans
  // document — un client doit pouvoir ouvrir son dossier vide et y
  // ajouter directement) + un dossier "Général" toujours présent.
  _dossiers() {
    const clients = this._clients().slice().sort((a, b) => a.nom.localeCompare(b.nom));
    const docsDe = (valeur) => this._data.filter(d => valeur === 'general' ? !d.clientId : d.clientId === valeur);
    const dossiers = clients.map(c => ({ valeur: c.id, nom: c.nom, docs: docsDe(c.id) }));
    dossiers.push({ valeur: 'general', nom: 'Général (sans client)', docs: docsDe('general') });
    return dossiers;
  },

  // ── Rendu ──────────────────────────────────────────────────────
  _html() {
    const octetsUtilises = this._tailleTotaleOctets();
    const pct = Math.min(100, Math.round((octetsUtilises / this._QUOTA_INDICATIF_OCTETS) * 100));
    const couleurJauge = pct >= 90 ? '#e05c5c' : pct >= 60 ? '#e0a95c' : 'var(--accent-ui, var(--accent))';

    return `
      <div class="page-header-row documents-header-row">
        <div>
          <div class="page-title"><span class="nav-icon" data-icon="folder"></span>Documents</div>
        </div>
      </div>
      <div class="documents-header-sub-row">
        <div class="page-sub">${this._data.length} document${this._data.length > 1 ? 's' : ''}</div>
        <div class="page-header-actions">
          <button class="btn" id="add-document-btn">+ Ajouter</button>
        </div>
      </div>

      <div class="card documents-stockage-card" style="margin-bottom:16px;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
          <span style="font-size:12px; color:var(--text-secondary);">Stockage navigateur utilisé (indicatif)</span>
          <span style="font-size:12px; color:var(--text-muted);">${this._formatTaille(octetsUtilises)} / ~${this._formatTaille(this._QUOTA_INDICATIF_OCTETS)}</span>
        </div>
        <div style="height:6px; border-radius:4px; background:var(--bg-input); overflow:hidden;">
          <div style="height:100%; width:${pct}%; background:${couleurJauge}; transition:width .2s;"></div>
        </div>
        ${pct >= 60 ? `<div class="stat-sub" style="margin-top:8px; color:${pct >= 90 ? '#e0a0a0' : '#e0c27f'};">${pct >= 90 ? "Presque plein — préfère le lien externe pour tes prochains gros fichiers." : "Ça se remplit — pense au lien externe (Drive, Dropbox...) pour les gros fichiers."}</div>` : ''}
      </div>

      ${this._vue === 'documents' ? this._htmlContenuDossier() : this._htmlDossiers()}
    `;
  },

  // 04/09/2026 : la recherche globale de la topbar filtrait les lignes
  // `<table>` de la page — elle a arrêté de fonctionner sur la vue
  // "dossiers" (une grille de cartes, pas un tableau). Remplacée ici
  // par une recherche dédiée qui filtre les dossiers par nom de client
  // ET par contenu (nom/type d'un document à l'intérieur) — chercher
  // "Contrat signé" fait ressortir le dossier qui le contient, même si
  // le nom du dossier ne correspond pas.
  _dossiersFiltres() {
    const q = (this._rechercheDossiers || '').trim().toLowerCase();
    const dossiers = this._dossiers();
    if (!q) return dossiers;
    return dossiers.filter(dos =>
      dos.nom.toLowerCase().includes(q) ||
      dos.docs.some(d => d.nom.toLowerCase().includes(q) || d.type.toLowerCase().includes(q))
    );
  },

  _htmlDossiers() {
    return `
      <div id="documents-dossiers-zone">${this._htmlGrilleDossiers()}</div>
    `;
  },

  // Extrait à part (04/09/2026) pour pouvoir être régénéré seul à
  // chaque frappe dans la recherche, sans recréer le champ de recherche
  // lui-même — sinon un re-render complet lui ferait perdre le focus/
  // curseur à chaque lettre tapée.
  _htmlGrilleDossiers() {
    const dossiers = this._dossiersFiltres();
    return `
      <div class="documents-dossiers-grille">
        ${dossiers.length ? dossiers.map(dos => `
          <div class="documents-dossier-carte" data-ouvrir-dossier="${dos.valeur}">
            <div class="documents-dossier-icone"><span class="nav-icon" data-icon="folder" data-icon-size="22"></span></div>
            <div class="documents-dossier-info">
              <div class="documents-dossier-nom">${dos.nom}</div>
              <div class="documents-dossier-meta">${dos.docs.length} document${dos.docs.length > 1 ? 's' : ''} · ${this._formatTaille(dos.docs.reduce((s, d) => s + (d.fichierTaille || 0), 0))}</div>
            </div>
            <button type="button" class="btn-ghost documents-dossier-telecharger" data-telecharger-dossier="${dos.valeur}" title="Télécharger tout le dossier" ${!dos.docs.length ? 'disabled' : ''}>
              <span class="nav-icon" data-icon="download" data-icon-size="13"></span><span class="documents-dossier-telecharger-texte"> Télécharger</span>
            </button>
          </div>
        `).join('') : `<div class="stat-sub" style="padding:24px 0;">Aucun dossier ne correspond à "${this._rechercheDossiers}".</div>`}
      </div>
    `;
  },

  _htmlContenuDossier() {
    const docs = this._documentsFiltres();
    return `
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; flex-wrap:wrap; gap:10px;">
        <div style="display:flex; align-items:center; gap:10px;">
          <button type="button" class="btn-ghost" id="documents-retour-dossiers">‹ Tous les dossiers</button>
          <span style="font-weight:600; font-size:14.5px;"><span class="nav-icon" data-icon="folder" data-icon-size="15" style="vertical-align:-2px; margin-right:4px; opacity:.8;"></span>${this._labelClientFiltre()}</span>
        </div>
        <button type="button" class="btn-ghost" id="documents-telecharger-dossier" ${!docs.length ? 'disabled' : ''}><span class="nav-icon" data-icon="download" data-icon-size="14"></span> Télécharger le dossier (.zip)</button>
      </div>

      <div class="card documents-table-wrap" style="padding:0; overflow-x:auto;">
        <table>
          <thead><tr>
            <th></th><th>Nom</th><th>Type</th><th>Client</th><th>Date</th><th>Taille / Lien</th><th></th>
          </tr></thead>
          <tbody>
            ${docs.map(d => `
              <tr data-open="${d.id}" style="cursor:pointer;">
                <td style="width:34px;"><span class="nav-icon" data-icon="${this._iconPourDoc(d)}" style="opacity:.7;"></span></td>
                <td>${d.nom}</td>
                <td><span style="display:inline-flex; align-items:center; gap:6px; font-size:12.5px;"><span style="width:8px; height:8px; border-radius:50%; background:${this._COULEUR_TYPE[d.type] || '#8a8a8a'}; display:inline-block;"></span>${d.type}</span></td>
                <td>${this._nomClient(d.clientId)}</td>
                <td>${d.date ? new Date(d.date).toLocaleDateString('fr-FR') : '—'}</td>
                <td>${d.mode === 'lien' ? 'Lien externe' : this._formatTaille(d.fichierTaille)}</td>
                <td style="width:70px; white-space:nowrap;" onclick="event.stopPropagation()">
                  <button type="button" class="row-delete-btn" data-apercu="${d.id}" title="Aperçu / ouvrir"><span class="nav-icon" data-icon="eye" data-icon-size="14"></span></button>
                  <button type="button" class="row-delete-btn" data-supprimer="${d.id}" title="Supprimer">✕</button>
                </td>
              </tr>
            `).join('') || `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:24px;">Aucun document pour le moment.</td></tr>`}
          </tbody>
        </table>
      </div>
      <div class="documents-mobile-list">
        ${docs.length ? docs.map(d => `
          <div class="documents-mcard" data-open="${d.id}">
            <div class="documents-mcard-top">
              <span class="nav-icon" data-icon="${this._iconPourDoc(d)}" style="opacity:.7;"></span>
              <div class="documents-mcard-nom">${d.nom}</div>
            </div>
            <div class="documents-mcard-bottom">
              <span style="display:inline-flex; align-items:center; gap:5px;"><span style="width:7px; height:7px; border-radius:50%; background:${this._COULEUR_TYPE[d.type] || '#8a8a8a'}; display:inline-block;"></span>${d.type}</span>
              ${this._nomClient(d.clientId) !== '—' ? `<span>${this._nomClient(d.clientId)}</span>` : ''}
              <span>${d.date ? new Date(d.date).toLocaleDateString('fr-FR') : '—'}</span>
              <span>${d.mode === 'lien' ? 'Lien externe' : this._formatTaille(d.fichierTaille)}</span>
            </div>
            <div class="documents-mcard-actions" onclick="event.stopPropagation()">
              <button type="button" class="btn-ghost" data-apercu="${d.id}"><span class="nav-icon" data-icon="eye" data-icon-size="13"></span> Aperçu</button>
              <button type="button" class="row-delete-btn" data-supprimer="${d.id}" title="Supprimer">✕</button>
            </div>
          </div>
        `).join('') : `<div class="card" style="text-align:center; color:var(--text-muted); padding:24px;">Aucun document pour le moment.</div>`}
      </div>
    `;
  },

  // ── Formulaire (ajout / édition) ──────────────────────────────
  _formHtml(d, clientPreRempli) {
    const isEdit = !!d;
    d = d || { nom: '', type: this._TYPES[0], clientId: clientPreRempli || null, date: this._dateStr(new Date()), notes: '', mode: 'upload', lien: '' };
    const clients = this._clients();
    return `
      <div class="modal-overlay" id="documents-form-overlay">
        <div class="modal-box">
          <div class="modal-title">${isEdit ? 'Modifier le document' : 'Ajouter un document'}</div>
          <form id="documents-form">
            <div class="modal-field"><label>Nom</label><input type="text" name="nom" value="${d.nom}" placeholder="ex : Contrat signé, Cahier des charges v2..." required autofocus></div>
            <div style="display:flex; gap:14px;">
              <div class="modal-field" style="flex:1;"><label>Type</label>
                <select name="type">${this._TYPES.map(t => `<option value="${t}" ${t === d.type ? 'selected' : ''}>${t}</option>`).join('')}</select>
              </div>
              <div class="modal-field" style="flex:1;"><label>Client</label>
                ${this._htmlCombo(
                  'documents-form-combo-client',
                  [{ valeur: '', label: '— Général (aucun client) —' }, ...clients.slice().sort((a, b) => a.nom.localeCompare(b.nom)).map(c => ({ valeur: c.id, label: c.nom }))],
                  d.clientId || '',
                  'Rechercher un client...',
                  'clientId'
                )}
              </div>
            </div>
            <div class="modal-field"><label>Date</label><input type="date" name="date" value="${d.date}"></div>

            <div class="modal-field">
              <label>Comment le garder ?</label>
              <div style="display:flex; gap:16px; margin-top:2px;">
                <label class="devis-paye-label" style="font-weight:400;"><input type="radio" name="mode" value="upload" ${d.mode !== 'lien' ? 'checked' : ''}> Uploader un fichier</label>
                <label class="devis-paye-label" style="font-weight:400;"><input type="radio" name="mode" value="lien" ${d.mode === 'lien' ? 'checked' : ''}> Lien externe (Drive, Dropbox...)</label>
              </div>
            </div>

            <div class="modal-field" id="documents-champ-upload" style="${d.mode === 'lien' ? 'display:none;' : ''}">
              <label>Fichier ${isEdit && d.fichierNom ? `(actuel : ${d.fichierNom})` : ''}</label>
              <input type="file" name="fichier">
              <div class="stat-sub" id="documents-taille-avertissement"></div>
            </div>
            <div class="modal-field" id="documents-champ-lien" style="${d.mode !== 'lien' ? 'display:none;' : ''}">
              <label>Lien</label>
              <input type="url" name="lien" value="${d.lien || ''}" placeholder="https://...">
            </div>

            <div class="modal-field"><label>Notes (optionnel)</label><textarea name="notes">${d.notes || ''}</textarea></div>

            <div class="modal-actions">
              ${isEdit ? `<button type="button" class="btn btn-danger" id="documents-delete-btn">Supprimer</button>` : `<span></span>`}
              <div class="modal-actions-right">
                <button type="button" class="btn btn-ghost" id="documents-cancel-btn">Annuler</button>
                <button type="submit" class="btn">${isEdit ? 'Enregistrer' : 'Ajouter'}</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  _dateStr(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; },

  _ouvrirFormulaire(item, clientPreRempli) {
    const wrap = document.createElement('div');
    wrap.innerHTML = this._formHtml(item, clientPreRempli);
    document.body.appendChild(wrap.firstElementChild);
    const overlay = document.getElementById('documents-form-overlay');
    const close = () => overlay.remove();

    let mousedownSurOverlay = false;
    overlay.addEventListener('mousedown', (e) => { mousedownSurOverlay = (e.target === overlay); });
    overlay.addEventListener('click', (e) => { if (e.target === overlay && mousedownSurOverlay) close(); });
    document.getElementById('documents-cancel-btn').addEventListener('click', close);
    this._bindCombo(overlay, 'documents-form-combo-client');

    // Bascule upload / lien.
    const champUpload = document.getElementById('documents-champ-upload');
    const champLien = document.getElementById('documents-champ-lien');
    overlay.querySelectorAll('input[name="mode"]').forEach(r => {
      r.addEventListener('change', () => {
        const surLien = overlay.querySelector('input[name="mode"]:checked').value === 'lien';
        champUpload.style.display = surLien ? 'none' : '';
        champLien.style.display = surLien ? '' : 'none';
      });
    });

    // Avertissement de taille au choix du fichier.
    let fichierChoisi = null;
    const inputFichier = overlay.querySelector('input[name="fichier"]');
    const avertissement = document.getElementById('documents-taille-avertissement');
    if (inputFichier) {
      inputFichier.addEventListener('change', () => {
        const f = inputFichier.files[0];
        fichierChoisi = f || null;
        if (f && f.size > this._TAILLE_MAX_OCTETS) {
          avertissement.style.color = '#e0a0a0';
          avertissement.textContent = `Fichier trop volumineux (${this._formatTaille(f.size)}) — max ~${this._formatTaille(this._TAILLE_MAX_OCTETS)}. Utilise plutôt un lien externe.`;
        } else if (f) {
          avertissement.style.color = 'var(--text-muted)';
          avertissement.textContent = `${this._formatTaille(f.size)} — ok.`;
        } else {
          avertissement.textContent = '';
        }
      });
    }

    const deleteBtn = document.getElementById('documents-delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        window.confirmerAction('Supprimer ce document ?', () => {
          this._data = this._data.filter(x => x.id !== item.id);
          this._setData(this._data);
          close();
          this.render(this._root);
        });
      });
    }

    document.getElementById('documents-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const mode = fd.get('mode');
      const clientIdRaw = fd.get('clientId');

      const finaliser = (extra) => {
        const payload = {
          nom: fd.get('nom').trim(),
          type: fd.get('type'),
          clientId: clientIdRaw ? Number(clientIdRaw) : null,
          date: fd.get('date') || this._dateStr(new Date()),
          notes: fd.get('notes').trim(),
          mode,
          ...extra,
        };
        if (!payload.nom) return;
        if (item) {
          Object.assign(item, payload);
        } else {
          this._data.push({ id: Date.now(), ...payload });
        }
        this._setData(this._data);
        close();
        this.render(this._root);
      };

      if (mode === 'lien') {
        const lien = fd.get('lien').trim();
        if (!lien) { alert('Ajoute un lien, ou bascule sur "Uploader un fichier".'); return; }
        finaliser({ lien, fichierNom: null, fichierMime: null, fichierTaille: null, fichierData: null });
        return;
      }

      // Mode upload.
      if (fichierChoisi) {
        if (fichierChoisi.size > this._TAILLE_MAX_OCTETS) {
          alert(`Ce fichier dépasse la taille max (~${this._formatTaille(this._TAILLE_MAX_OCTETS)}). Utilise un lien externe à la place.`);
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          finaliser({
            fichierNom: fichierChoisi.name, fichierMime: fichierChoisi.type || 'application/octet-stream',
            fichierTaille: fichierChoisi.size, fichierData: reader.result, lien: null,
          });
        };
        reader.readAsDataURL(fichierChoisi);
      } else if (item && item.fichierData) {
        // Édition sans changer le fichier — on garde l'existant.
        finaliser({ fichierNom: item.fichierNom, fichierMime: item.fichierMime, fichierTaille: item.fichierTaille, fichierData: item.fichierData, lien: null });
      } else {
        alert('Choisis un fichier à uploader, ou bascule sur "Lien externe".');
      }
    });
  },

  // 04/09/2026 : `window.open(dataURL)` ouvrait un onglet noir/vide —
  // les navigateurs modernes bloquent la navigation directe d'un nouvel
  // onglet vers une URL `data:` (mesure de sécurité). Fix : convertir
  // le data URL en Blob (`fetch(...).then(r=>r.blob())`) puis
  // `URL.createObjectURL()` pour obtenir une URL `blob:` — même
  // technique déjà utilisée pour l'aperçu PDF des devis
  // (`_apercuPdf`/`doc.output('bloburl')`), qui fonctionne de manière
  // fiable dans un nouvel onglet ou une iframe.
  async _apercu(d) {
    if (d.mode === 'lien') {
      if (d.lien) window.open(d.lien, '_blank');
      return;
    }
    if (!d.fichierData) return;

    if (d.fichierMime && (d.fichierMime.startsWith('image/') || d.fichierMime === 'application/pdf')) {
      const blob = await fetch(d.fichierData).then(r => r.blob());
      const blobUrl = URL.createObjectURL(blob);
      this._ouvrirApercuModal(d, blobUrl);
      return;
    }
    // Type non prévisualisable (Word, Excel...) → téléchargement direct.
    const a = document.createElement('a');
    a.href = d.fichierData;
    a.download = d.fichierNom || d.nom;
    a.click();
  },

  _ouvrirApercuModal(d, blobUrl) {
    const estImage = d.fichierMime && d.fichierMime.startsWith('image/');
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="modal-overlay" id="documents-apercu-overlay">
        <div class="modal-box" style="max-width:90vw; width:900px;">
          <div class="modal-title" style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
            <span>${d.nom}</span>
            <div style="display:flex; gap:8px;">
              <button type="button" class="btn-ghost" id="documents-apercu-telecharger">Télécharger</button>
              <button type="button" class="btn-ghost" id="documents-apercu-fermer">Fermer</button>
            </div>
          </div>
          ${estImage
            ? `<img src="${blobUrl}" style="max-width:100%; max-height:75vh; display:block; margin:0 auto; border-radius:8px;">`
            : `<iframe src="${blobUrl}" style="width:100%; height:75vh; border:none; border-radius:8px; background:#fff;"></iframe>`}
        </div>
      </div>
    `;
    document.body.appendChild(wrap.firstElementChild);
    const overlay = document.getElementById('documents-apercu-overlay');
    const close = () => { URL.revokeObjectURL(blobUrl); overlay.remove(); };

    let mousedownSurOverlay = false;
    overlay.addEventListener('mousedown', (e) => { mousedownSurOverlay = (e.target === overlay); });
    overlay.addEventListener('click', (e) => { if (e.target === overlay && mousedownSurOverlay) close(); });
    document.getElementById('documents-apercu-fermer').addEventListener('click', close);
    document.getElementById('documents-apercu-telecharger').addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = d.fichierData;
      a.download = d.fichierNom || d.nom;
      a.click();
    });
  },

  // Télécharge tous les documents du client actuellement filtré en un
  // seul .zip (04/09/2026, demande de Tiphaine : "chaque client doit
  // avoir son dossier téléchargeable"). Les documents en "lien externe"
  // n'ont pas de fichier à zipper (par définition) — listés à la place
  // dans un petit fichier texte `liens-externes.txt` à l'intérieur du
  // zip, pour ne jamais les faire disparaître silencieusement de
  // l'export.
  async _telechargerDossier(dossierValeur) {
    if (typeof JSZip === 'undefined') { alert("La librairie de compression n'a pas pu se charger — vérifie ta connexion et réessaie."); return; }
    const valeur = dossierValeur !== undefined ? dossierValeur : this._clientFiltre;
    const docs = valeur === 'general' ? this._data.filter(d => !d.clientId)
      : valeur === 'tous' ? this._data
      : this._data.filter(d => d.clientId === Number(valeur));
    if (!docs.length) { alert('Aucun document dans ce dossier pour le moment.'); return; }

    const zip = new JSZip();
    const liensExternes = [];
    const nomsUtilises = new Set();
    docs.forEach(d => {
      if (d.mode === 'lien' || !d.fichierData) {
        if (d.lien) liensExternes.push(`${d.nom} (${d.type}) — ${d.lien}`);
        return;
      }
      const base64 = (d.fichierData.split(',')[1] || '');
      let nom = d.fichierNom || d.nom;
      let essai = nom, i = 1;
      while (nomsUtilises.has(essai)) { essai = `${i}-${nom}`; i++; }
      nomsUtilises.add(essai);
      zip.file(essai, base64, { base64: true });
    });
    if (liensExternes.length) zip.file('liens-externes.txt', liensExternes.join('\n'));

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Documents - ${valeur === 'general' ? 'Général' : this._nomClient(Number(valeur))}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  },

  // Écoute des cartes dossier (ouvrir / télécharger) — extrait à part
  // pour pouvoir être ré-appelé après une régénération partielle de la
  // grille (recherche en direct), sans repasser par tout `_bindEvents`.
  _bindGrilleDossiers(zone) {
    zone.querySelectorAll('[data-ouvrir-dossier]').forEach(carte => {
      carte.addEventListener('click', (e) => {
        if (e.target.closest('[data-telecharger-dossier]')) return; // géré séparément
        this._clientFiltre = carte.dataset.ouvrirDossier;
        this._vue = 'documents';
        this.render(this._root);
      });
    });
    zone.querySelectorAll('[data-telecharger-dossier]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._telechargerDossier(btn.dataset.telechargerDossier);
      });
    });
  },

  _bindEvents(container) {
    this._bindGrilleDossiers(container);

    // Vue "documents" — retour à la grille des dossiers.
    const retourBtn = container.querySelector('#documents-retour-dossiers');
    if (retourBtn) retourBtn.addEventListener('click', () => {
      this._vue = 'dossiers';
      this.render(this._root);
    });

    const telechargerDossierBtn = container.querySelector('#documents-telecharger-dossier');
    if (telechargerDossierBtn) telechargerDossierBtn.addEventListener('click', () => this._telechargerDossier());

    const addBtn = container.querySelector('#add-document-btn');
    // Depuis l'intérieur d'un dossier, "+ Ajouter" pré-remplit son
    // client automatiquement plutôt que de repartir de "Général".
    if (addBtn) addBtn.addEventListener('click', () => {
      const clientPreRempli = (this._vue === 'documents' && this._clientFiltre !== 'tous' && this._clientFiltre !== 'general') ? Number(this._clientFiltre) : null;
      this._ouvrirFormulaire(null, clientPreRempli);
    });

    container.querySelectorAll('[data-open]').forEach(row => {
      row.addEventListener('click', () => {
        const item = this._data.find(d => d.id === Number(row.dataset.open));
        if (item) this._ouvrirFormulaire(item);
      });
    });
    container.querySelectorAll('[data-apercu]').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = this._data.find(d => d.id === Number(btn.dataset.apercu));
        if (item) this._apercu(item);
      });
    });
    container.querySelectorAll('[data-supprimer]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.supprimer);
        window.confirmerAction('Supprimer ce document ?', () => {
          this._data = this._data.filter(x => x.id !== id);
          this._setData(this._data);
          this.render(this._root);
        });
      });
    });
  },
};

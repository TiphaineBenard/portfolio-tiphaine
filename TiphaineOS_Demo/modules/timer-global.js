/* ═══════════════════════════════════════════════════════════
   MINUTEUR GLOBAL — widget compact intégré à la topbar (entre la
   recherche et l'avatar), visible dans toute l'appli pendant la
   navigation (rendu dans #global-timer, à l'intérieur de la topbar
   mais en dehors de #content donc jamais écrasé par le routeur qui ne
   touche qu'à #content, voir app.js).

   Logique :
   - Sélection Client / Projet / Type de tâche puis Start.
   - Pause / Reprendre / Stop.
   - État persisté dans localStorage (tos_timer_running) pour survivre
     à un rechargement de page (F5) — le chrono continue de tourner
     comme si de rien n'était.
   - À l'arrêt (Stop), la session est enregistrée via
     window.Modules.temps._ajouterEntree(...).
   - Alerte conditionnelle : uniquement si le type de tâche est
     "Maintenance/Abonnement", le widget passe en orange puis en rouge
     quand le temps cumulé du mois pour ce client (déjà enregistré +
     session en cours) s'approche puis dépasse le forfait d'heures
     incluses de son abonnement (voir modules/abonnements.js).
   - Micro-interaction : petit point lumineux qui pulse doucement
     quand le chrono est actif (voir .timer-widget-dot dans style.css).
   TODO Firebase : les sessions sont sauvegardées via temps.js.
═══════════════════════════════════════════════════════════ */

window.TimerGlobal = {
  _state: null,
  _intervalId: null,
  _root: null,

  init() {
    this._root = document.getElementById('global-timer');
    if (!this._root) return;
    this._state = this._chargerEtat();
    this._render();
    if (this._state && this._state.status === 'running') this._demarrerTick();
  },

  // ── Persistance de l'état en cours (localStorage) ────────────────
  _chargerEtat() {
    try { return JSON.parse(localStorage.getItem('tos_timer_running') || 'null'); }
    catch (e) { return null; }
  },

  _sauvegarderEtat() {
    if (this._state) localStorage.setItem('tos_timer_running', JSON.stringify(this._state));
    else localStorage.removeItem('tos_timer_running');
  },

  // ── Calcul du temps écoulé ────────────────────────────────────────
  _msEcoules() {
    if (!this._state) return 0;
    let total = this._state.accumuleMs || 0;
    if (this._state.status === 'running' && this._state.repriseISO) {
      total += Date.now() - new Date(this._state.repriseISO).getTime();
    }
    return total;
  },

  _formatDuree(ms) {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  },

  // Date/heure en LOCAL — jamais `.toISOString().slice(...)` qui convertit
  // en UTC et décale d'1h/2h en France (bug corrigé le 03/09/2026 : une
  // session arrêtée le soir pouvait s'enregistrer avec la mauvaise heure,
  // voire le mauvais jour, et donc apparaître sur la mauvaise colonne de
  // la Vue Semaine).
  _dateLocale(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },
  _heureLocale(d) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  },

  // Renvoie 'ok' | 'alerte' | 'depasse' — seulement pertinent pour le
  // type "Maintenance/Abonnement", sinon toujours 'ok' (le chrono tourne
  // normalement sans alerte pour "Création").
  _niveauAlerte() {
    if (!this._state || this._state.typeTache !== 'Maintenance/Abonnement') return 'ok';
    const temps = window.Modules && window.Modules.temps;
    if (!temps) return 'ok';
    const inclus = temps._forfaitInclusMinutes(this._state.client);
    if (!inclus) return 'ok';
    const consommeAvant = temps._minutesConsommeesMois(this._state.client, 'Maintenance/Abonnement');
    const enCoursMin = this._msEcoules() / 60000;
    const pct = (consommeAvant + enCoursMin) / inclus;
    if (pct >= 1) return 'depasse';
    if (pct >= 0.833) return 'alerte'; // ex : 50 min sur un forfait de 1h — seuil en %, s'adapte à tout volume d'heures
    return 'ok';
  },

  // ── Actions ───────────────────────────────────────────────────────
  demarrer({ client, projet, typeTache }) {
    this._state = {
      client, projet: projet || '', typeTache: typeTache || 'Création',
      status: 'running', accumuleMs: 0,
      debutISO: new Date().toISOString(), repriseISO: new Date().toISOString(),
    };
    this._sauvegarderEtat();
    this._demarrerTick();
    this._render();
  },

  pause() {
    if (!this._state || this._state.status !== 'running') return;
    this._state.accumuleMs = this._msEcoules();
    this._state.status = 'paused';
    delete this._state.repriseISO;
    this._arreterTick();
    this._sauvegarderEtat();
    this._render();
  },

  reprendre() {
    if (!this._state || this._state.status !== 'paused') return;
    this._state.status = 'running';
    this._state.repriseISO = new Date().toISOString();
    this._sauvegarderEtat();
    this._demarrerTick();
    this._render();
  },

  arreter() {
    if (!this._state) return;
    const ms = this._msEcoules();
    const minutes = Math.max(1, Math.round(ms / 60000));
    const debutDate = new Date(this._state.debutISO);
    const finDate = new Date();
    const temps = window.Modules && window.Modules.temps;

    if (temps) {
      temps._ajouterEntree({
        client: this._state.client,
        projet: this._state.projet,
        typeTache: this._state.typeTache,
        description: `Session chronométrée (${this._state.typeTache})`,
        minutes,
        date: this._dateLocale(debutDate),
        heureDebut: this._heureLocale(debutDate),
        heureFin: this._heureLocale(finDate),
      });
    }

    this._arreterTick();
    this._state = null;
    this._sauvegarderEtat();
    this._render();

    // Si la page Temps est actuellement ouverte, rafraîchir son affichage.
    if (temps && temps._root) temps.render(temps._root);
  },

  _demarrerTick() {
    this._arreterTick();
    this._intervalId = setInterval(() => this._render(), 1000);
  },

  _arreterTick() {
    if (this._intervalId) clearInterval(this._intervalId);
    this._intervalId = null;
  },

  // ── Modal de démarrage (sélection Client / Projet / Type) ───────────
  ouvrirDemarrage() {
    const temps = window.Modules && window.Modules.temps;
    if (temps && !temps._data) temps._data = temps._getEntries();
    // Tous les clients de la fiche Clients (tous statuts confondus —
    // Prospect/Actif/Impayé/Ancien, pas seulement "Actif") + ceux déjà
    // utilisés dans des créneaux passés. Un client tout juste créé, sans
    // encore aucun créneau, doit apparaître ici dès sa création (bug
    // remonté par Tiphaine le 03/09/2026 : son nouveau client n'apparaissait
    // pas tant qu'aucun temps n'avait été enregistré pour lui).
    const clients = temps ? temps._tousLesClients() : [];
    const projetsModule = window.Modules && window.Modules.projets;
    const projetsExistants = temps ? temps._projetsUniques() : [];
    const projetsDuModule = (projetsModule && Array.isArray(projetsModule._data)) ? projetsModule._data.map(p => p.nom).filter(Boolean) : [];
    const projets = [...new Set([...projetsExistants, ...projetsDuModule])];
    const typesTache = temps ? temps._getTypesTache() : ['Création', 'Maintenance/Abonnement'];

    const CLIENT_INTERNE = 'Interne (Mon entreprise)';

    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="modal-overlay" id="timer-start-overlay">
        <div class="modal-box">
          <div class="modal-title">Démarrer un chrono</div>
          <form id="timer-start-form">
            <div class="modal-field" style="margin-bottom:18px;">
              <label class="timer-toggle-interne" for="timer-mode-interne">
                <span>🚀 Mode Interne (Mon entreprise)</span>
                <input type="checkbox" id="timer-mode-interne">
              </label>
            </div>
            <div id="timer-champs-client">
              <div class="modal-field">
                <label>Client</label>
                <input type="text" name="client" id="timer-client-input" autofocus list="timer-clients-list" placeholder="Tape pour rechercher un client">
                <datalist id="timer-clients-list">${clients.map(c => `<option value="${c}">`).join('')}</datalist>
              </div>
              <div class="modal-field">
                <label>Projet (optionnel)</label>
                <input type="text" name="projet" id="timer-projet-input" list="timer-projets-list">
                <datalist id="timer-projets-list">${projets.map(p => `<option value="${p}">`).join('')}</datalist>
              </div>
            </div>
            <div class="modal-field">
              <label>Type de tâche</label>
              <div class="timer-type-pills" id="timer-type-pills">
                ${typesTache.map((t, i) => {
                  const c = temps ? temps._couleurType(t) : '#9a9a9a';
                  return `<button type="button" class="timer-type-pill ${i === 0 ? 'active' : ''}" data-type="${t}" style="background:${temps ? temps._hexVersRgba(c, .16) : 'transparent'}; border:1px solid ${c}; color:${c};">${t}</button>`;
                }).join('')}
                <button type="button" class="timer-type-pill timer-type-pill-autre" data-type="__autre__">+ Autre</button>
              </div>
              <input type="text" id="timer-type-autre-input" placeholder="Précise le type (ex : Formation, Admin...)" style="display:none; margin-top:8px;">
              <input type="hidden" name="typeTache" id="timer-type-hidden" value="${typesTache[0] || 'Création'}">
            </div>
            <div class="modal-actions">
              <span></span>
              <div class="modal-actions-right">
                <button type="button" class="btn btn-ghost" id="timer-start-cancel">Annuler</button>
                <button type="submit" class="btn">▶ Démarrer</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;
    document.body.appendChild(wrap.firstElementChild);
    const overlay = document.getElementById('timer-start-overlay');
    const close = () => overlay.remove();

    let mousedownSurOverlay = false;
    overlay.addEventListener('mousedown', (e) => { mousedownSurOverlay = (e.target === overlay); });
    overlay.addEventListener('click', (e) => { if (e.target === overlay && mousedownSurOverlay) close(); });
    document.getElementById('timer-start-cancel').addEventListener('click', close);

    // Pills colorées "Type de tâche" (même code couleur que la Vue Semaine
    // du module Temps : Création=bleu, Maintenance=orange, Interne=vert,
    // Prospection=violet) + un bouton "+ Autre" dédié, couleur grise
    // distincte, qui révèle un champ texte libre pour taper un type qui
    // n'est pas encore dans la liste (auto-ajouté aux types paramétrables
    // à la validation, même logique que le formulaire de créneau unifié).
    const pillsWrap = document.getElementById('timer-type-pills');
    const inputAutre = document.getElementById('timer-type-autre-input');
    const hiddenType = document.getElementById('timer-type-hidden');
    const selectionnerPill = (pill) => {
      pillsWrap.querySelectorAll('.timer-type-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      if (pill.dataset.type === '__autre__') {
        inputAutre.style.display = '';
        inputAutre.focus();
        hiddenType.value = inputAutre.value.trim();
      } else {
        inputAutre.style.display = 'none';
        hiddenType.value = pill.dataset.type;
      }
    };
    pillsWrap.querySelectorAll('.timer-type-pill').forEach(pill => {
      pill.addEventListener('click', () => selectionnerPill(pill));
    });
    inputAutre.addEventListener('input', () => { hiddenType.value = inputAutre.value.trim(); });

    // Toggle "Mode Interne" — masque Client/Projet et verrouille le type
    // de tâche sur "Interne" tant qu'il est coché ; décocher permet de
    // repasser librement sur un client (et un autre projet) à tout moment,
    // avant de démarrer.
    const checkboxInterne = document.getElementById('timer-mode-interne');
    const champsClient = document.getElementById('timer-champs-client');
    let typeAvantInterne = hiddenType.value;

    checkboxInterne.addEventListener('change', () => {
      const actif = checkboxInterne.checked;
      champsClient.style.display = actif ? 'none' : '';
      const pillInterne = pillsWrap.querySelector('[data-type="Interne"]');
      if (actif) {
        typeAvantInterne = hiddenType.value !== 'Interne' ? hiddenType.value : typeAvantInterne;
        if (pillInterne) selectionnerPill(pillInterne);
        pillsWrap.classList.add('disabled');
      } else {
        pillsWrap.classList.remove('disabled');
        if (hiddenType.value === 'Interne') {
          const autrePill = [...pillsWrap.querySelectorAll('.timer-type-pill')].find(p => p.dataset.type !== 'Interne' && p.dataset.type === typeAvantInterne)
            || [...pillsWrap.querySelectorAll('.timer-type-pill')].find(p => p.dataset.type !== 'Interne' && p.dataset.type !== '__autre__');
          if (autrePill) selectionnerPill(autrePill);
        }
        document.getElementById('timer-client-input').focus();
      }
    });

    document.getElementById('timer-start-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const modeInterne = checkboxInterne.checked;
      const fd = new FormData(e.target);
      const typeTacheSaisi = (fd.get('typeTache') || '').trim();
      if (!modeInterne && !typeTacheSaisi) return; // "+ Autre" sélectionné mais champ resté vide
      if (typeTacheSaisi && temps) temps._ajouterTypeAvecCouleur(typeTacheSaisi);
      const client = modeInterne ? CLIENT_INTERNE : (fd.get('client') || '').trim();
      if (!client) return;
      const projet = modeInterne ? '' : (fd.get('projet') || '').trim();
      const typeTache = modeInterne ? 'Interne' : fd.get('typeTache');
      this.demarrer({ client, projet, typeTache });
      close();
    });
  },

  // ── Rendu du widget ───────────────────────────────────────────────
  _render() {
    if (!this._root) return;

    if (!this._state) {
      this._root.innerHTML = `
        <button id="timer-widget-start" class="topbar-icon-btn timer-widget-idle" title="Démarrer un chrono client">
          <span class="topbar-icon-btn-svg" data-icon="clock" data-icon-size="14"></span>
        </button>
      `;
      window.hydrateIcons(this._root);
      const btn = document.getElementById('timer-widget-start');
      if (btn) btn.addEventListener('click', () => this.ouvrirDemarrage());
      return;
    }

    const niveau = this._niveauAlerte();
    const classeAlerte = niveau === 'depasse' ? 'timer-widget-danger' : niveau === 'alerte' ? 'timer-widget-warn' : 'timer-widget-active';
    const enPause = this._state.status === 'paused';

    this._root.innerHTML = `
      <div class="timer-widget timer-widget-running ${classeAlerte} ${enPause ? 'timer-widget-paused' : ''}">
        <span class="timer-widget-dot"></span>
        <div class="timer-widget-infos">
          <div class="timer-widget-client">${this._state.client}${this._state.projet ? ` · ${this._state.projet}` : ''}</div>
          <div class="timer-widget-chrono">${this._formatDuree(this._msEcoules())}</div>
        </div>
        <div class="timer-widget-actions">
          ${enPause
            ? `<button id="timer-widget-resume" title="Reprendre"><span class="nav-icon" data-icon="play"></span></button>`
            : `<button id="timer-widget-pause" title="Pause"><span class="nav-icon" data-icon="pause"></span></button>`}
          <button id="timer-widget-stop" title="Stop"><span class="nav-icon" data-icon="square"></span></button>
        </div>
      </div>
    `;
    window.hydrateIcons(this._root);
    const pauseBtn = document.getElementById('timer-widget-pause');
    if (pauseBtn) pauseBtn.addEventListener('click', () => this.pause());
    const resumeBtn = document.getElementById('timer-widget-resume');
    if (resumeBtn) resumeBtn.addEventListener('click', () => this.reprendre());
    const stopBtn = document.getElementById('timer-widget-stop');
    if (stopBtn) stopBtn.addEventListener('click', () => this.arreter());
  },
};

document.addEventListener('DOMContentLoaded', () => window.TimerGlobal.init());

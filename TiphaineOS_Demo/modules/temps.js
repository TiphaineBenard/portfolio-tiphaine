/* ═══════════════════════════════════════════════════════════
   MODULE TEMPS — suivi du temps passé (présence + travail), avec
   tableau de bord (jour/semaine/mois), planning hebdomadaire et jauge
   de consommation des heures incluses (abonnements Performance =
   1h/mois par ex., voir modules/abonnements.js).
   Le chrono en lui-même (start/pause/stop, widget flottant global)
   vit dans modules/timer-global.js (window.TimerGlobal) pour
   pouvoir rester visible pendant la navigation dans toute l'appli
   — ce module gère la persistance des créneaux et leur affichage.
   TODO Firebase pour la persistance (actuellement localStorage).

   ⚠️ MODÈLE UNIFIÉ (refonte du 03/09/2026 — lire avant de modifier) :
   avant cette date, il existait DEUX systèmes séparés — les sessions
   client facturables (`tos_temps`) et le pointage de présence
   (`tos_pointages`) — synchronisés à la main. Résultat concret pour
   Tiphaine : impossible de cliquer sur sa présence pour la corriger,
   des blocs qui se chevauchent sans lien, une vraie confusion visuelle
   ("j'aime pas ce que tu as fait"). Diagnostic : il n'existe qu'UNE
   seule réalité dans une journée — chaque créneau de présence EST du
   temps de travail, catégorisé ou non. Donc un seul modèle maintenant :
   `tos_creneaux`, un tableau à plat de créneaux, chacun avec
   date/heureDebut/heureFin/minutes + client/projet/typeTache/
   description (tous optionnels — vides = "présence pas encore
   catégorisée"). Un seul formulaire (`_ouvrirCreneauForm`) pour tout
   créer/éditer/catégoriser/supprimer, utilisé PARTOUT (Vue Semaine,
   Vue Liste, carte Pointage, case vide du planning). Migration
   automatique et silencieuse des anciennes données au premier chargement
   (`_migrerVersUnifie`) — rien à ressaisir.
═══════════════════════════════════════════════════════════ */

window.Modules = window.Modules || {};

window.Modules.temps = {
  _data: null,
  _vue: 'semaine', // 'semaine' | 'liste' | 'details' — bascule via les onglets en tête de tableau
  // Décalage (en semaines) affiché dans la Vue Semaine par rapport à la
  // semaine réelle (03/09/2026, demande de navigation type Google Agenda).
  // Ne touche QUE l'affichage du planning — les cartes "Temps de travail"
  // et tous les calculs restent sur la vraie semaine/mois en cours, voir
  // `_debutSemaine(offset)`.
  _semaineOffset: 0,
  // Mini-calendrier de saut à une semaine (03/09/2026) — remplace le
  // `<input type="date">` invisible superposé au libellé, trop capricieux
  // (le popup natif ne s'ouvrait pas de façon fiable au clic selon les
  // navigateurs). Popover maison, dans l'esprit du sélecteur natif que
  // Tiphaine a montré en exemple (mois/année navigables, grille de
  // jours), mais entièrement sous notre contrôle.
  _miniCalOuvert: false,
  _miniCalMois: null, // Date (1er du mois actuellement affiché dans le popover) — réinitialisée à l'ouverture
  _miniCalVueMoisAnnee: false, // clic sur le titre ("Septembre 2026") → grille des 12 mois pour choisir plus vite
  _derniereAction: null, // { type:'pause'|'journee', creneauId, ts } — permet d'annuler un clic accidentel
  _vueListeInclureInterne: false, // Vue Liste : masque les créneaux sans client réel par défaut (temps client uniquement)
  _CLIENT_INTERNE: 'Interne (Mon entreprise)',
  // 07/09/2026 : retour sur le choix du 06/09 (Vue Liste par défaut sur
  // mobile) — Tiphaine préfère garder Vue Semaine par défaut partout et
  // que la grille elle-même soit retravaillée pour le mobile (voir
  // `_semaineJourMobile` / `_htmlVueSemaine`) plutôt que changer d'onglet.
  _semaineJourMobile: null, // dateStr (YYYY-MM-DD) du jour affiché en Vue Semaine mobile (un seul jour à la fois) ; null = pas encore choisi, se cale sur aujourd'hui au premier rendu

  async render(container) {
    if (!this._data) {
      this._data = window.FIREBASE_READY ? await this._fetchReal() : this._getEntries();
    }
    // Rattrapage ponctuel (03/09/2026) : tout type déjà créé avant
    // l'introduction des couleurs auto-assignées (ex : "Réparation bug"
    // tapé via "+ Autre") reçoit une couleur de la palette dès ce
    // chargement, au lieu de rester grise indéfiniment.
    this._getTypesTache().forEach(t => this._ajouterTypeAvecCouleur(t));
    this._root = container.closest('#content') || container;
    container.innerHTML = this._html(this._data);
    window.hydrateIcons(container);
    this._bindEvents(container);
  },

  // Formatte une date en "YYYY-MM-DD" / "HH:MM" en heure LOCALE — jamais
  // `.toISOString()` pour ça : elle convertit en UTC, ce qui décale la
  // date et l'heure d'1h ou 2h en France et provoquait un vrai bug (une
  // session ou un pointage du jour J apparaissait sur la colonne J-1 de
  // la Vue Semaine, ou à la mauvaise heure). Tout le module doit passer
  // par ces deux helpers pour dater/horodater quoi que ce soit.
  _dateLocale(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },
  _heureLocale(d) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  },
  _heureActuelle() {
    return this._heureLocale(new Date());
  },

  // ── Persistance (localStorage en attendant Firebase) ────────────────
  _mock() {
    // Données de démo vidées le 04/09/2026 (voir clients.js).
    return [];
  },

  // ⚠️ Générateur d'id VRAIMENT unique (bug corrigé le 03/09/2026) —
  // `Date.now()` seul renvoie la même valeur pour deux créations dans la
  // même milliseconde. Deux enregistrements avec le même id = cliquer sur
  // le second ouvre TOUJOURS l'édition du premier. `_idUnique()` garantit
  // un id strictement croissant même appelé plusieurs fois de suite dans
  // le même tick. À utiliser pour TOUT nouvel id dans ce module.
  _idUnique() {
    this._dernierId = Math.max(Date.now(), (this._dernierId || 0) + 1);
    return this._dernierId;
  },

  // Corrige les doublons d'id déjà présents dans des données existantes —
  // réattribue un id unique à toute entrée dont l'id est déjà utilisé par
  // une entrée précédente dans la liste. Auto-guérison silencieuse.
  _corrigerIdsDupliques(liste) {
    const vus = new Set();
    let corrige = false;
    liste.forEach(item => {
      if (vus.has(item.id)) { item.id = this._idUnique(); corrige = true; }
      vus.add(item.id);
    });
    return corrige;
  },

  // Migration unique et silencieuse de l'ancien modèle à deux systèmes
  // (`tos_temps` sessions client + `tos_pointages` présence) vers le
  // modèle unifié `tos_creneaux`. Ne s'exécute qu'une fois : la simple
  // présence de la clé `tos_creneaux` dans localStorage (même vide)
  // signifie "déjà migré, ne plus y toucher".
  _migrerVersUnifie() {
    if (localStorage.getItem('tos_creneaux') !== null) return;
    let anciennesSessions = [];
    let anciensPointages = [];
    try { anciennesSessions = JSON.parse(localStorage.getItem('tos_temps') || '[]') || []; } catch (e) { /* ignore */ }
    try { anciensPointages = JSON.parse(localStorage.getItem('tos_pointages') || '[]') || []; } catch (e) { /* ignore */ }

    const fusion = [];
    anciennesSessions.forEach(t => fusion.push({
      id: this._idUnique(),
      date: t.date, heureDebut: t.heureDebut || '', heureFin: t.heureFin || '',
      minutes: t.minutes != null ? t.minutes : this._calculerMinutes(t.heureDebut, t.heureFin),
      client: t.client || '', projet: t.projet || '', typeTache: t.typeTache || '', description: t.description || '',
    }));
    anciensPointages.forEach(p => fusion.push({
      id: this._idUnique(),
      date: p.date, heureDebut: p.heureDebut || '', heureFin: p.heureFin || '',
      minutes: p.minutes, client: '', projet: '', typeTache: '', description: p.description || '',
    }));
    if (!fusion.length) fusion.push(...this._mock());
    localStorage.setItem('tos_creneaux', JSON.stringify(fusion));
  },

  _getEntries() {
    this._migrerVersUnifie();
    try {
      const stockees = JSON.parse(localStorage.getItem('tos_creneaux') || 'null');
      if (Array.isArray(stockees)) {
        if (this._corrigerIdsDupliques(stockees)) localStorage.setItem('tos_creneaux', JSON.stringify(stockees));
        return stockees;
      }
    } catch (e) { /* ignore */ }
    const defaut = this._mock();
    localStorage.setItem('tos_creneaux', JSON.stringify(defaut));
    return defaut;
  },

  _setEntries(liste) {
    this._data = liste;
    localStorage.setItem('tos_creneaux', JSON.stringify(liste));
    // TODO Firebase : synchroniser la collection "creneaux"
  },

  async _fetchReal() {
    // TODO Firebase : const snap = await window.db.collection('creneaux').get();
    return this._getEntries();
  },

  // Appelée par TimerGlobal quand un chrono client est arrêté — crée un
  // créneau déjà catégorisé (client/type connus).
  _ajouterEntree(entree) {
    if (!this._data) this._data = this._getEntries();
    const nouvelle = { id: this._idUnique(), projet:'', typeTache:'Création', description:'', ...entree };
    this._data.push(nouvelle);
    this._setEntries(this._data);
    return nouvelle;
  },

  _calculerMinutes(heureDebut, heureFin) {
    if (!heureDebut || !heureFin) return null;
    const [h1, m1] = heureDebut.split(':').map(Number);
    const [h2, m2] = heureFin.split(':').map(Number);
    // Toujours au moins 1 min : jamais de créneau affiché "14:00 -> 14:00
    // (0h)" si le clic Stop tombe dans la même minute que le Start.
    return Math.max(1, (h2 * 60 + m2) - (h1 * 60 + m1));
  },

  _versMinutes(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  },
  _versHhmm(totalMinutes) {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  },

  // Quand on catégorise un créneau (client/type renseigné) sur une plage
  // qui chevauche un créneau de présence pure existant ce jour-là, on
  // "découpe" la présence plutôt que de laisser les deux se superposer —
  // sinon le temps de présence total compterait deux fois la même plage
  // (une fois en présence brute, une fois dans le travail catégorisé).
  // C'est ce qui permet le geste "j'étais présente de 8h à midi, j'ai
  // passé 1h avec M. X et 30 min avec Mme Y dans ce créneau" : on ajoute
  // le travail par-dessus, la présence se referme automatiquement autour.
  _reconcilierPresenceChevauchante(date, heureDebut, heureFin, excludeId) {
    if (!heureDebut || !heureFin) return; // créneau encore ouvert : rien à découper pour l'instant
    if (!this._data) this._data = this._getEntries();
    const nDebut = this._versMinutes(heureDebut);
    const nFin = this._versMinutes(heureFin);
    const aTraiter = this._data.filter(t => t.id !== excludeId && t.date === date && !t.client && !t.typeTache && t.heureDebut && t.heureFin);

    aTraiter.forEach(t => {
      const tDebut = this._versMinutes(t.heureDebut);
      const tFin = this._versMinutes(t.heureFin);
      if (nFin <= tDebut || nDebut >= tFin) return; // pas de chevauchement

      if (nDebut <= tDebut && nFin >= tFin) {
        // Le nouveau créneau catégorisé couvre toute la présence : elle disparaît.
        this._data = this._data.filter(x => x.id !== t.id);
      } else if (nDebut <= tDebut) {
        // Chevauchement en début de présence : elle recule son début.
        t.heureDebut = this._versHhmm(nFin);
        t.minutes = this._calculerMinutes(t.heureDebut, t.heureFin);
      } else if (nFin >= tFin) {
        // Chevauchement en fin de présence : elle avance sa fin.
        t.heureFin = this._versHhmm(nDebut);
        t.minutes = this._calculerMinutes(t.heureDebut, t.heureFin);
      } else {
        // Le nouveau créneau est entièrement à l'intérieur : la présence
        // se scinde en deux (avant / après).
        const finOriginale = t.heureFin;
        t.heureFin = this._versHhmm(nDebut);
        t.minutes = this._calculerMinutes(t.heureDebut, t.heureFin);
        this._data.push({
          id: this._idUnique(), date: t.date, heureDebut: this._versHhmm(nFin), heureFin: finOriginale,
          minutes: this._calculerMinutes(this._versHhmm(nFin), finOriginale),
          client: '', projet: '', typeTache: '', description: '',
        });
      }
    });
  },

  // Formatte une durée en minutes de façon lisible même en dessous d'1h.
  _fmtDuree(minutes) {
    if (minutes == null) return '';
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
  },

  // Formatte une durée en minutes en heures DÉCIMALES (ex : 50h49 → "50,8h")
  // — utilisé pour l'historique mensuel (09/09/2026, demande de Tiphaine :
  // le format h/min est illisible pour comparer des mois entre eux, elle
  // veut une valeur décimale unique par mois).
  _fmtDecimal(minutes) {
    if (!minutes) return '0h';
    return `${(minutes / 60).toFixed(1).replace('.', ',')}h`;
  },

  // ── Présence / pointage rapide ("Commencer ma journée" etc.) ────────
  // Ce ne sont plus des enregistrements à part : ce sont des créneaux du
  // modèle unifié, simplement créés SANS client/type (catégorisables
  // plus tard en cliquant dessus). Noms de fonctions conservés tels
  // quels (utilisés par modules/presence-widget.js).

  // Tous les créneaux du jour (terminés ou non, catégorisés ou non),
  // triés par heure de début.
  _pointagesDuJour() {
    const aujourdHui = this._dateLocale(new Date());
    return (this._data || this._getEntries())
      .filter(t => t.date === aujourdHui && t.heureDebut)
      .sort((a, b) => a.heureDebut.localeCompare(b.heureDebut));
  },

  // Le créneau actuellement ouvert aujourd'hui (heureFin encore vide), s'il existe.
  _pointageEnCours() {
    return this._pointagesDuJour().find(p => !p.heureFin) || null;
  },

  // Ouvre un NOUVEAU créneau (non catégorisé) à l'heure actuelle —
  // n'affecte jamais les créneaux déjà enregistrés (matin, veille, etc.).
  _demarrerPointage() {
    if (this._pointageEnCours()) return; // déjà un créneau ouvert, on ne double pas
    this._reouvrirJournee(); // (re)commencer annule un éventuel drapeau "journée terminée"
    if (!this._data) this._data = this._getEntries();
    this._data.push({
      id: this._idUnique(), date: this._dateLocale(new Date()), heureDebut: this._heureActuelle(),
      heureFin: null, minutes: null, client: '', projet: '', typeTache: '', description: '',
    });
    this._setEntries(this._data);
  },

  // Termine le créneau actuellement ouvert (et lui seul, retrouvé par son
  // id) — ne touche à aucun autre créneau du jour ou des jours précédents.
  // Retient l'action dans `_derniereAction` (mémoire, pas persisté) pour
  // permettre d'annuler un clic accidentel.
  _terminerPointage() {
    if (!this._data) this._data = this._getEntries();
    const aujourdHui = this._dateLocale(new Date());
    const enCours = this._data.find(t => !t.heureFin && t.date === aujourdHui && t.heureDebut);
    if (!enCours) return null;
    enCours.heureFin = this._heureActuelle();
    enCours.minutes = this._calculerMinutes(enCours.heureDebut, enCours.heureFin);
    this._setEntries(this._data);
    this._derniereAction = { type: 'pause', creneauId: enCours.id, ts: Date.now() };
    return enCours.id;
  },

  // ── Annulation d'un clic accidentel (Pause / Terminer ma journée) ──
  _UNDO_FENETRE_MS: 90000,

  _peutAnnulerDerniereAction() {
    return !!this._derniereAction && (Date.now() - this._derniereAction.ts) < this._UNDO_FENETRE_MS;
  },

  _annulerDerniereAction() {
    if (!this._peutAnnulerDerniereAction()) return;
    const { type, creneauId } = this._derniereAction;
    if (type === 'journee') this._reouvrirJournee();
    if (creneauId != null) {
      if (!this._data) this._data = this._getEntries();
      const item = this._data.find(t => t.id === creneauId);
      if (item && item.heureFin) {
        item.heureFin = null;
        item.minutes = null;
        this._setEntries(this._data);
      }
    }
    this._derniereAction = null;
  },

  // Ajoute rapidement un créneau non catégorisé sur une date choisie
  // (aujourd'hui ou un jour passé) — utilisé par le "+ Ajouter un
  // créneau" express de la carte Pointage (pas de client/type à choisir,
  // volontairement rapide ; catégorisable après coup en cliquant dessus).
  _ajouterCreneauPointage(date, heureDebut, heureFin, description) {
    if (!date || !heureDebut) return;
    if (!this._data) this._data = this._getEntries();
    this._data.push({
      id: this._idUnique(), date, heureDebut, heureFin: heureFin || null,
      minutes: this._calculerMinutes(heureDebut, heureFin),
      client: '', projet: '', typeTache: '', description: (description || '').trim(),
    });
    this._setEntries(this._data);
  },

  _supprimerCreneauPointage(id) {
    if (!this._data) this._data = this._getEntries();
    this._setEntries(this._data.filter(t => t.id !== id));
  },

  // Chrono live de la carte "Pointage du jour" (créneau en cours). Auto-
  // nettoyant : si l'élément a disparu (page quittée / re-render), on
  // arrête l'intervalle tout seul au tick suivant plutôt que de laisser
  // tourner un timer fantôme.
  // Depuis le 03/09/2026, ce même tick met AUSSI à jour en direct les
  // compteurs "Temps de travail — Aujourd'hui/Cette semaine/Ce mois-ci"
  // et le total de présence sous la barre du jour : avant ça, un
  // créneau en cours n'était compté dans aucun total tant qu'on ne
  // cliquait pas Pause/Terminer (retour de Tiphaine : "4h" figé alors
  // que le chrono tournait encore).
  _demarrerChronoPointageLive(heureDebutStr) {
    if (this._pointageIntervalId) clearInterval(this._pointageIntervalId);
    const [h, m] = heureDebutStr.split(':').map(Number);
    const debut = new Date();
    debut.setHours(h, m, 0, 0);
    const tick = () => {
      const el = document.getElementById('pointage-chrono-live');
      if (!el) { clearInterval(this._pointageIntervalId); this._pointageIntervalId = null; return; }
      const elJour = document.getElementById('stat-temps-jour');
      const elSemaine = document.getElementById('stat-temps-semaine');
      const elMois = document.getElementById('stat-temps-mois');
      const elFooter = document.getElementById('pointage-footer-total');
      const elPageSub = document.getElementById('temps-page-sub');
      if (elJour) elJour.textContent = this._fmtDuree(this._minutesPresenceJour());
      if (elSemaine) elSemaine.textContent = this._fmtDuree(this._minutesPresenceSemaine());
      if (elMois) elMois.textContent = this._fmtDuree(this._minutesPresenceMois());
      if (elFooter) elFooter.textContent = `Présence : ${this._fmtDuree(this._minutesPresenceJour())} aujourd'hui · ${this._fmtDuree(this._minutesPresenceSemaine())} cette semaine`;
      if (elPageSub) elPageSub.textContent = `${this._fmtDuree(this._minutesPresenceMois())} de présence ce mois-ci`;
      const secs = Math.max(0, Math.floor((Date.now() - debut.getTime()) / 1000));
      const h2 = String(Math.floor(secs / 3600)).padStart(2, '0');
      const m2 = String(Math.floor((secs % 3600) / 60)).padStart(2, '0');
      const s2 = String(secs % 60).padStart(2, '0');
      el.textContent = `${h2}:${m2}:${s2}`;
    };
    tick();
    this._pointageIntervalId = setInterval(tick, 1000);
  },

  // ⚠️ "Journée terminée" — simple drapeau du jour (pas un champ sur un
  // créneau) pour distinguer une PAUSE (on va reprendre) d'une vraie FIN
  // de journée.
  _journeeTermineeAujourdHui() {
    return localStorage.getItem('tos_journee_terminee_date') === this._dateLocale(new Date());
  },
  _marquerJourneeTerminee() {
    localStorage.setItem('tos_journee_terminee_date', this._dateLocale(new Date()));
  },
  _reouvrirJournee() {
    localStorage.removeItem('tos_journee_terminee_date');
  },
  _terminerJournee() {
    const creneauId = this._terminerPointage(); // null si aucun créneau n'était ouvert (déjà en pause)
    this._marquerJourneeTerminee();
    this._derniereAction = { type: 'journee', creneauId, ts: Date.now() };
  },

  // Minutes du créneau en cours (heureFin encore vide) depuis son
  // `heureDebut` jusqu'à maintenant — 0 s'il n'y en a pas. Un créneau
  // ouvert a `minutes:null` tant qu'il n'est pas terminé (voir modèle de
  // données), donc les totaux ci-dessous l'ignoraient complètement tant
  // qu'on ne clique pas "Pause"/"Terminer" : le compteur du jour restait
  // figé pendant des heures de chrono actif (retour de Tiphaine le
  // 03/09/2026 : "4h" affiché alors que le chrono tournait encore).
  // Toujours daté d'aujourd'hui par construction (un seul créneau ouvert
  // possible, toujours créé le jour même), donc s'ajoute sans condition
  // aux totaux jour/semaine/mois dès qu'il existe.
  _minutesEnCoursAujourdhui() {
    const t = this._pointageEnCours();
    if (!t || !t.heureDebut) return 0;
    const [h, m] = t.heureDebut.split(':').map(Number);
    const debut = new Date();
    debut.setHours(h, m, 0, 0);
    return Math.max(0, Math.floor((Date.now() - debut.getTime()) / 60000));
  },

  // Minutes de présence = somme de TOUS les créneaux (catégorisés ou
  // non) — chaque créneau enregistré EST du temps de présence, c'est
  // toute la logique du modèle unifié.
  _minutesPresenceSemaine() {
    const debutSemaineStr = this._dateLocale(this._debutSemaine());
    return (this._data || this._getEntries())
      .filter(t => t.minutes != null && t.date >= debutSemaineStr)
      .reduce((s, t) => s + t.minutes, 0) + this._minutesEnCoursAujourdhui();
  },

  _minutesPresenceJour() {
    const aujourdHui = this._dateLocale(new Date());
    return (this._data || this._getEntries())
      .filter(t => t.minutes != null && t.date === aujourdHui)
      .reduce((s, t) => s + t.minutes, 0) + this._minutesEnCoursAujourdhui();
  },

  _minutesPresenceMois() {
    const periode = this._periodeActuelle();
    return (this._data || this._getEntries())
      .filter(t => t.minutes != null && t.date.slice(0, 7) === periode)
      .reduce((s, t) => s + t.minutes, 0) + this._minutesEnCoursAujourdhui();
  },

  // Historique mensuel (09/09/2026) — regroupe TOUTE la présence
  // enregistrée par mois ("YYYY-MM"), triée du plus récent au plus
  // ancien. Sert au popup "Historique" ouvert depuis la carte "Ce
  // mois-ci". Le mois en cours inclut aussi le créneau en cours s'il y
  // en a un (même logique que `_minutesPresenceMois`).
  _minutesParMois() {
    const periodeActuelle = this._periodeActuelle();
    const parMois = {};
    (this._data || this._getEntries()).forEach(t => {
      if (t.minutes == null || !t.date) return;
      const periode = t.date.slice(0, 7);
      parMois[periode] = (parMois[periode] || 0) + t.minutes;
    });
    if (!(periodeActuelle in parMois)) parMois[periodeActuelle] = 0;
    parMois[periodeActuelle] += this._minutesEnCoursAujourdhui();
    return Object.keys(parMois)
      .sort((a, b) => b.localeCompare(a))
      .map(periode => ({ periode, minutes: parMois[periode] }));
  },

  // Total du jour `dateStr` — utilisé par le footer de totaux de la Vue
  // Semaine (03/09/2026). Même logique que `_minutesPresenceJour` mais
  // paramétrée par date, pour pouvoir l'appeler sur chaque colonne.
  _minutesJourDonne(dateStr) {
    const total = (this._data || this._getEntries())
      .filter(t => t.minutes != null && t.date === dateStr)
      .reduce((s, t) => s + t.minutes, 0);
    return dateStr === this._dateLocale(new Date()) ? total + this._minutesEnCoursAujourdhui() : total;
  },

  // ── Types de tâche (entièrement paramétrables — ajout/suppression) ──
  _getTypesTache() {
    try {
      const stockes = JSON.parse(localStorage.getItem('tos_types_tache') || 'null');
      if (Array.isArray(stockes) && stockes.length) return stockes;
    } catch (e) { /* ignore */ }
    return ['Création', 'Maintenance/Abonnement', 'Interne', 'Prospection'];
  },
  _setTypesTache(types) {
    localStorage.setItem('tos_types_tache', JSON.stringify(types));
  },

  // Couleur par type de tâche — entièrement paramétrable par Tiphaine
  // depuis l'onglet Paramétrage (03/09/2026), au lieu d'être figée dans
  // le CSS. Palette volontairement limitée à un jeu curaté de couleurs
  // (pas un color-picker libre) pour rester cohérent visuellement avec le
  // reste de l'appli — voir `_PALETTE_COULEURS`.
  _PALETTE_COULEURS: [
    { nom: 'Bleu', hex: '#78a0e6' }, { nom: 'Orange', hex: '#e0a94b' },
    { nom: 'Vert', hex: '#6ec88c' }, { nom: 'Violet', hex: '#b48ce6' },
    { nom: 'Rose', hex: '#e087b0' }, { nom: 'Jaune', hex: '#e0d24b' },
    { nom: 'Cyan', hex: '#5fc9c9' }, { nom: 'Rouge', hex: '#e0705c' },
    { nom: 'Gris', hex: '#9a9a9a' },
  ],

  _getCouleursTypes() {
    let stockees = {};
    try { stockees = JSON.parse(localStorage.getItem('tos_types_couleurs') || 'null') || {}; } catch (e) { /* ignore */ }
    // Défauts (correspondent aux couleurs historiques, avant que ce soit paramétrable).
    return { 'Création':'#78a0e6', 'Maintenance/Abonnement':'#e0a94b', 'Interne':'#6ec88c', 'Prospection':'#b48ce6', ...stockees };
  },
  _setCouleurType(type, hex) {
    const couleurs = this._getCouleursTypes();
    couleurs[type] = hex;
    localStorage.setItem('tos_types_couleurs', JSON.stringify(couleurs));
  },
  _supprimerCouleurType(type) {
    const couleurs = this._getCouleursTypes();
    delete couleurs[type];
    localStorage.setItem('tos_types_couleurs', JSON.stringify(couleurs));
  },
  // Couleur effective d'un type — gris neutre par défaut si jamais assignée.
  _couleurType(type) {
    return this._getCouleursTypes()[type] || '#9a9a9a';
  },

  // Ajoute un type (s'il n'existe pas déjà) ET lui assigne automatiquement
  // une couleur de la palette pas encore utilisée par un autre type —
  // évite que tout type tapé via "+ Autre" retombe dans le même gris que
  // les autres et se confonde avec eux (retour de Tiphaine le 03/09/2026
  // après une session chronométrée en "Réparation bug", restée grise).
  // Utilisé partout où un nouveau type peut naître : chrono, formulaire de
  // créneau, onglet Paramétrage.
  _ajouterTypeAvecCouleur(nom) {
    if (!nom) return;
    const types = this._getTypesTache();
    if (!types.includes(nom)) this._setTypesTache([...types, nom]);
    const couleurs = this._getCouleursTypes();
    if (!couleurs[nom]) {
      const dejaUtilisees = new Set(Object.values(couleurs));
      const dispo = this._PALETTE_COULEURS.find(p => !dejaUtilisees.has(p.hex));
      this._setCouleurType(nom, dispo ? dispo.hex : '#9a9a9a');
    }
  },
  _hexVersRgba(hex, alpha) {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16), g = parseInt(h.substring(2, 4), 16), b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  },

  // Clé de couleur associée à un créneau pour la Vue Semaine / la légende —
  // renvoie 'presence' pour un créneau ni catégorisé (style dédié
  // pointillé, pas une couleur paramétrable), sinon le nom du type de
  // tâche à utiliser pour chercher sa couleur via `_couleurType()`
  // (entièrement paramétrable depuis l'onglet Paramétrage).
  _classeCreneau(t) {
    if (!t.client && !t.typeTache) return 'presence';
    if (t.typeTache) return t.typeTache;
    return 'Création'; // client renseigné sans type précisé : couleur par défaut du travail client
  },

  // ── Calculs ───────────────────────────────────────────────────────
  _periodeActuelle() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  },

  // `offsetSemaines` : 0 = semaine réelle en cours (défaut, utilisé par
  // tous les calculs de stats). Un nombre non nul décale le lundi de
  // départ de N semaines — utilisé uniquement par la navigation de la
  // Vue Semaine (`this._semaineOffset`), jamais par les stats.
  _debutSemaine(offsetSemaines = 0) {
    const d = new Date();
    const jour = (d.getDay() + 6) % 7; // lundi = 0
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - jour + offsetSemaines * 7);
    return d;
  },

  // Popover mini-calendrier (03/09/2026) — grille de jours du mois
  // affiché dans `this._miniCalMois`, avec toute la semaine actuellement
  // sélectionnée (`debutSemaineActuelle` → +6 jours) surlignée pour
  // rappeler qu'on choisit une SEMAINE, pas juste un jour (cliquer
  // n'importe quel jour de la ligne fait le même saut).
  // `jourSeul` (07/09/2026, retour "faut pas que ça fasse comme sur
  // ordinateur : avec la semaine entière sélectionnée") : sur mobile la
  // Vue Semaine n'affiche qu'UN jour, donc seul CE jour doit ressortir
  // en surbrillance dans le popover — pas toute sa semaine, ce qui
  // laissait croire à tort qu'on allait sélectionner 7 jours.
  _htmlMiniCalendrier(debutSemaineActuelle, jourSeul = null) {
    const moisAffiche = this._miniCalMois || new Date(debutSemaineActuelle.getFullYear(), debutSemaineActuelle.getMonth(), 1);

    // Mode "grille des 12 mois" — ouvert en cliquant sur le titre
    // ("Août 2026"), pour choisir mois + année plus vite qu'en cliquant
    // ‹ › douze fois (demande de Tiphaine le 03/09/2026).
    if (this._miniCalVueMoisAnnee) {
      const moisNoms = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
      const moisActuelIdx = (this._miniCalMois || debutSemaineActuelle).getMonth();
      const anneeActuelle = (this._miniCalMois || debutSemaineActuelle).getFullYear();
      const casesMois = moisNoms.map((nom, i) => {
        const estActuel = i === moisActuelIdx && anneeActuelle === moisAffiche.getFullYear();
        return `<button type="button" class="semaine-mini-cal-mois-case ${estActuel ? 'semaine-active' : ''}" data-minical-choix-mois="${i}">${nom}</button>`;
      }).join('');
      return `
        <div class="semaine-mini-cal">
          <div class="semaine-mini-cal-entete">
            <button type="button" class="semaine-mini-cal-nav-btn" data-minical-annee="-1" title="Année précédente">‹</button>
            <span class="semaine-mini-cal-titre">${moisAffiche.getFullYear()}</span>
            <button type="button" class="semaine-mini-cal-nav-btn" data-minical-annee="1" title="Année suivante">›</button>
          </div>
          <div class="semaine-mini-cal-mois-grille">${casesMois}</div>
        </div>
      `;
    }

    const premierDuMois = new Date(moisAffiche.getFullYear(), moisAffiche.getMonth(), 1);
    const jourSemainePremier = (premierDuMois.getDay() + 6) % 7; // lundi = 0
    const debutGrille = new Date(premierDuMois);
    debutGrille.setDate(debutGrille.getDate() - jourSemainePremier);

    const aujourdHuiStr = this._dateLocale(new Date());
    const finSemaineActuelle = new Date(debutSemaineActuelle);
    finSemaineActuelle.setDate(finSemaineActuelle.getDate() + 6);
    const debutSemaineStr = this._dateLocale(debutSemaineActuelle);
    const finSemaineStr = this._dateLocale(finSemaineActuelle);

    const cases = Array.from({ length: 42 }, (_, i) => {
      const d = new Date(debutGrille);
      d.setDate(d.getDate() + i);
      const dStr = this._dateLocale(d);
      const horsDuMois = d.getMonth() !== moisAffiche.getMonth();
      const estSelectionne = jourSeul ? dStr === jourSeul : (dStr >= debutSemaineStr && dStr <= finSemaineStr);
      const classes = [
        'semaine-mini-cal-jour',
        horsDuMois ? 'hors-mois' : '',
        dStr === aujourdHuiStr ? 'aujourdhui' : '',
        estSelectionne ? 'semaine-active' : '',
      ].filter(Boolean).join(' ');
      return `<button type="button" class="${classes}" data-minical-jour="${dStr}">${d.getDate()}</button>`;
    }).join('');

    const moisLabel = moisAffiche.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

    return `
      <div class="semaine-mini-cal">
        <div class="semaine-mini-cal-entete">
          <button type="button" class="semaine-mini-cal-nav-btn" data-minical-annee="-1" title="Année précédente">«</button>
          <button type="button" class="semaine-mini-cal-nav-btn" data-minical-mois="-1" title="Mois précédent">‹</button>
          <button type="button" class="semaine-mini-cal-titre semaine-mini-cal-titre-clic" data-minical-titre-toggle title="Choisir directement le mois et l'année">${moisLabel}</button>
          <button type="button" class="semaine-mini-cal-nav-btn" data-minical-mois="1" title="Mois suivant">›</button>
          <button type="button" class="semaine-mini-cal-nav-btn" data-minical-annee="1" title="Année suivante">»</button>
        </div>
        <div class="semaine-mini-cal-jours-entete">
          ${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(j => `<span>${j}</span>`).join('')}
        </div>
        <div class="semaine-mini-cal-grille">${cases}</div>
        <button type="button" class="btn-lien-discret semaine-mini-cal-aujourdhui" data-minical-jour="${aujourdHuiStr}">Aujourd'hui</button>
      </div>
    `;
  },

  _minutesConsommees(client) {
    const periode = this._periodeActuelle();
    return (this._data || [])
      .filter(t => t.client === client && t.date.slice(0, 7) === periode)
      .reduce((s, t) => s + (t.minutes || 0), 0);
  },

  // Utilisé par TimerGlobal pour l'alerte conditionnelle : minutes déjà
  // enregistrées ce mois-ci pour ce client, uniquement sur le type
  // "Maintenance/Abonnement" (le chrono en cours n'est pas encore ici).
  _minutesConsommeesMois(client, typeTache) {
    const periode = this._periodeActuelle();
    return (this._data || this._getEntries())
      .filter(t => t.client === client && t.date.slice(0, 7) === periode && (!typeTache || t.typeTache === typeTache))
      .reduce((s, t) => s + (t.minutes || 0), 0);
  },

  // Cherche si ce client a un abonnement Performance (heures incluses/mois).
  _forfaitInclusMinutes(client) {
    const abos = window.Modules.abonnements;
    if (!abos) return null;
    if (!abos._data) abos._data = abos._mock(); // lazy-init si l'onglet Abonnements n'a pas encore été ouvert
    const abo = abos._data.find(a => a.client === client);
    if (!abo) return null;
    const g = abos._getGrille()[abo.formule];
    if (!g || !g.heuresIncluses) return null;
    return Math.round(g.heuresIncluses * 60);
  },

  // N'incluent que les VRAIS clients (jamais l'entrée vide "présence" ni
  // "Interne (Mon entreprise)") — dérivés des créneaux déjà enregistrés.
  // ⚠️ Ne PAS utiliser seul pour peupler un champ de saisie "Client" : un
  // client tout juste créé dans l'onglet Clients, sans encore aucun
  // créneau, n'y apparaîtrait pas (bug remonté par Tiphaine le
  // 03/09/2026). Utiliser `_tousLesClients()` pour ça.
  _clientsUniques() {
    return [...new Set((this._data || []).map(t => t.client).filter(c => c && c !== this._CLIENT_INTERNE))];
  },

  // Liste complète pour tout champ de saisie "Client" (chrono, formulaire
  // de créneau) : la vraie fiche Clients (TOUS les statuts — Prospect/
  // Actif/Impayé/Ancien, pas seulement "Actif", sur demande explicite de
  // Tiphaine) fusionnée avec les noms de clients déjà utilisés dans les
  // créneaux (pour ne pas perdre un ancien nom si sa fiche a été
  // supprimée depuis). Triée alphabétiquement pour rester lisible dans le
  // datalist une fois la liste longue.
  _tousLesClients() {
    const clientsModule = window.Modules && window.Modules.clients;
    if (clientsModule && !clientsModule._data) clientsModule._data = clientsModule._mock();
    const nomsFiches = clientsModule ? clientsModule._data.map(c => c.nom).filter(Boolean) : [];
    return [...new Set([...nomsFiches, ...this._clientsUniques()])].sort((a, b) => a.localeCompare(b, 'fr'));
  },

  _projetsUniques() {
    return [...new Set((this._data || []).map(t => t.projet).filter(Boolean))];
  },

  // Barre de journée visuelle (7h → 20h) de la carte "Pointage du jour" —
  // chaque créneau devient un segment cliquable, un trait orange marque
  // l'heure actuelle.
  _htmlDaybarSegments(creneauxJour) {
    const HEURE_DEBUT = 7, HEURE_FIN = 20;
    const totalMin = (HEURE_FIN - HEURE_DEBUT) * 60;
    const pct = (hhmm) => {
      const [h, m] = hhmm.split(':').map(Number);
      return Math.max(0, Math.min(100, ((h * 60 + m) - HEURE_DEBUT * 60) / totalMin * 100));
    };
    const segments = creneauxJour.map(t => {
      if (!t.heureDebut) return '';
      const finStr = t.heureFin || this._heureActuelle();
      const gauche = pct(t.heureDebut);
      const droite = pct(finStr);
      const largeur = Math.max(0.8, droite - gauche);
      const enCours = !t.heureFin;
      const nonCategorise = !t.client && !t.typeTache;
      const duree = t.heureFin ? this._fmtDuree(t.minutes) : 'en cours';
      const repere = nonCategorise ? 'Présence' : (t.client && t.client !== this._CLIENT_INTERNE ? `${t.client}${t.typeTache ? ` (${t.typeTache})` : ''}` : (t.typeTache || 'Interne'));
      const titre = `${repere} · ${t.heureDebut} → ${t.heureFin || 'en cours'} (${duree})${t.description ? ` — ${t.description}` : ''}`;
      // La barre du jour reste volontairement toute en vert (peu importe la
      // catégorie) — seul le segment "en cours" pulse. Le détail par
      // catégorie/couleur est réservé à la Vue Semaine ; ici on veut juste
      // voir l'amplitude de présence en un coup d'œil, sans que le rouge
      // "à catégoriser" ne rende la barre alarmante (retour de Tiphaine).
      return `<div class="pointage-daybar-segment ${enCours ? 'en-cours' : ''}" style="left:${gauche}%; width:${largeur}%;" data-open="${t.id}" title="${titre}"></div>`;
    }).join('');

    const maintenant = new Date();
    const heureNum = maintenant.getHours() + maintenant.getMinutes() / 60;
    const dansLaPlage = this._dateLocale(maintenant) === (creneauxJour[0] && creneauxJour[0].date) && heureNum >= HEURE_DEBUT && heureNum <= HEURE_FIN;
    const nowMarker = dansLaPlage ? `<div class="pointage-daybar-now" style="left:${(heureNum - HEURE_DEBUT) / (HEURE_FIN - HEURE_DEBUT) * 100}%;"></div>` : '';

    return segments + nowMarker;
  },

  // ── LE formulaire unique — création ET édition, présence pure OU
  // session client OU activité interne, tout au même endroit. Client,
  // Projet et Type de tâche sont TOUS optionnels : les laisser vides
  // enregistre juste de la présence (catégorisable plus tard en
  // recliquant sur le même créneau). Utilisé par : clic sur un bloc de
  // la Vue Semaine, clic sur une ligne de la Vue Liste, clic sur un
  // segment de la barre du jour, clic sur une case vide du planning,
  // bouton "+ Saisie manuelle".
  _ouvrirCreneauForm(entry, prefill) {
    const isEdit = !!entry;
    const t = entry || { client:'', projet:'', typeTache:'', description:'', date:this._dateLocale(new Date()), heureDebut:'', heureFin:'', ...(prefill || {}) };
    const typesTache = this._getTypesTache();

    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="modal-overlay" id="creneau-form-overlay">
        <div class="modal-box">
          <div class="modal-title">${isEdit ? 'Modifier ce créneau' : 'Ajouter un créneau'}</div>
          <p style="font-size:12px; color:#7a7a7a; margin:-8px 0 16px;">Laisse Client et Type vides pour juste enregistrer de la présence — tu pourras préciser plus tard en recliquant dessus.</p>
          <form id="creneau-form">
            <div class="modal-field">
              <label>Client (optionnel)</label>
              <input type="text" name="client" value="${t.client || ''}" list="creneau-clients-list" placeholder="Tape pour rechercher un client, ou laisse vide">
              <datalist id="creneau-clients-list">
                ${this._tousLesClients().map(c => `<option value="${c}">`).join('')}
              </datalist>
            </div>
            <div class="modal-field">
              <label>Projet (optionnel)</label>
              <input type="text" name="projet" value="${t.projet || ''}" list="creneau-projets-list">
              <datalist id="creneau-projets-list">
                ${this._projetsUniques().map(p => `<option value="${p}">`).join('')}
              </datalist>
            </div>
            <div class="modal-field">
              <label>Type de tâche (optionnel)</label>
              <input type="text" name="typeTache" value="${t.typeTache || ''}" list="creneau-types-list" placeholder="Ex : Prospection, Interne, Création...">
              <datalist id="creneau-types-list">
                ${typesTache.map(ty => `<option value="${ty}">`).join('')}
              </datalist>
            </div>
            <div class="modal-field">
              <label>Description (optionnel)</label>
              <input type="text" name="description" value="${t.description || ''}">
            </div>
            <div class="modal-field">
              <label>Date</label>
              <input type="date" name="date" value="${t.date}" required>
            </div>
            <div style="display:flex; gap:10px;">
              <div class="modal-field" style="flex:1;">
                <label>Début</label>
                <input type="time" name="heureDebut" value="${t.heureDebut || ''}" required>
              </div>
              <div class="modal-field" style="flex:1;">
                <label>Fin (optionnel — vide = en cours)</label>
                <input type="time" name="heureFin" value="${t.heureFin || ''}">
              </div>
            </div>
            <div class="modal-actions">
              ${isEdit ? `<button type="button" class="btn btn-danger" id="creneau-delete-btn">Supprimer</button>` : `<span></span>`}
              <div class="modal-actions-right">
                <button type="button" class="btn btn-ghost" id="creneau-cancel-btn">Annuler</button>
                <button type="submit" class="btn">${isEdit ? 'Enregistrer' : 'Ajouter'}</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;
    document.body.appendChild(wrap.firstElementChild);
    const overlay = document.getElementById('creneau-form-overlay');
    const close = () => overlay.remove();

    let mousedownSurOverlay = false;
    overlay.addEventListener('mousedown', (e) => { mousedownSurOverlay = (e.target === overlay); });
    overlay.addEventListener('click', (e) => { if (e.target === overlay && mousedownSurOverlay) close(); });
    document.getElementById('creneau-cancel-btn').addEventListener('click', close);

    const finaliser = () => {
      close();
      this.render(this._root);
      if (window.PresenceWidget) window.PresenceWidget._render();
    };

    const deleteBtn = document.getElementById('creneau-delete-btn');
    if (deleteBtn) deleteBtn.addEventListener('click', () => {
      window.confirmerAction('Supprimer ce créneau ?', () => {
        if (!this._data) this._data = this._getEntries();
        this._setEntries(this._data.filter(x => x.id !== entry.id));
        finaliser();
      });
    });

    document.getElementById('creneau-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const typeTache = (fd.get('typeTache') || '').trim();
      if (typeTache) this._ajouterTypeAvecCouleur(typeTache);
      const heureDebut = fd.get('heureDebut') || '';
      const heureFin = fd.get('heureFin') || '';
      const payload = {
        client: (fd.get('client') || '').trim(),
        projet: (fd.get('projet') || '').trim(),
        typeTache,
        description: (fd.get('description') || '').trim(),
        date: fd.get('date'),
        heureDebut,
        heureFin: heureFin || null,
        minutes: this._calculerMinutes(heureDebut, heureFin),
      };
      if (!payload.date || !payload.heureDebut) return;

      if (!this._data) this._data = this._getEntries();
      let idFinal;
      if (isEdit) {
        Object.assign(entry, payload);
        idFinal = entry.id;
      } else {
        idFinal = this._idUnique();
        this._data.push({ id: idFinal, ...payload });
      }
      // Si ce créneau est catégorisé (client ou type renseigné), on
      // découpe automatiquement toute présence pure qui chevaucherait la
      // même plage horaire ce jour-là — voir _reconcilierPresenceChevauchante.
      if (payload.client || payload.typeTache) {
        this._reconcilierPresenceChevauchante(payload.date, payload.heureDebut, payload.heureFin, idFinal);
      }
      this._setEntries(this._data);
      finaliser();
    });
  },

  // Popup "Historique" (09/09/2026) — ouvert depuis la carte "Ce mois-ci",
  // liste tous les mois où de la présence a été enregistrée, en heures
  // DÉCIMALES (`_fmtDecimal`) pour comparer facilement d'un mois à
  // l'autre — contrairement aux stats du haut de page qui restent en
  // format h/min (plus lisible au jour le jour).
  _ouvrirHistoriqueMois() {
    const MOIS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    const lignes = this._minutesParMois();
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="modal-overlay" id="historique-mois-overlay">
        <div class="modal-box">
          <div class="modal-title">Historique — heures par mois</div>
          <p style="font-size:12px; color:#7a7a7a; margin:-8px 0 16px;">Toute la présence enregistrée, mois par mois (heures décimales).</p>
          <div style="max-height:360px; overflow-y:auto;">
            <table style="width:100%; border-collapse:collapse;">
              <thead><tr>
                <th style="text-align:left; padding:6px 4px; font-size:12px; color:#7a7a7a;">Mois</th>
                <th style="text-align:right; padding:6px 4px; font-size:12px; color:#7a7a7a;">Heures</th>
              </tr></thead>
              <tbody>
                ${lignes.length ? lignes.map(l => {
                  const [annee, mois] = l.periode.split('-').map(Number);
                  const estMoisActuel = l.periode === this._periodeActuelle();
                  return `
                    <tr style="border-top:1px solid var(--border-subtle);">
                      <td style="padding:8px 4px; ${estMoisActuel ? 'font-weight:600;' : ''}">${MOIS_FR[mois - 1]} ${annee}${estMoisActuel ? ' (en cours)' : ''}</td>
                      <td style="padding:8px 4px; text-align:right; ${estMoisActuel ? 'font-weight:600;' : ''}">${this._fmtDecimal(l.minutes)}</td>
                    </tr>
                  `;
                }).join('') : `<tr><td colspan="2" style="padding:12px 4px; color:#7a7a7a;">Aucune présence enregistrée pour l'instant.</td></tr>`}
              </tbody>
            </table>
          </div>
          <div class="modal-actions" style="margin-top:16px;">
            <span></span>
            <div class="modal-actions-right">
              <button type="button" class="btn" id="historique-mois-fermer-btn">Fermer</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(wrap.firstElementChild);
    const overlay = document.getElementById('historique-mois-overlay');
    const close = () => overlay.remove();
    let mousedownSurOverlay = false;
    overlay.addEventListener('mousedown', (e) => { mousedownSurOverlay = (e.target === overlay); });
    overlay.addEventListener('click', (e) => { if (e.target === overlay && mousedownSurOverlay) close(); });
    document.getElementById('historique-mois-fermer-btn').addEventListener('click', close);
  },

  // Détecte les VRAIS doublons : deux créneaux qui se chevauchent sur une
  // même date ET dont AUCUN n'est de la présence pure. Un chevauchement
  // entre présence et travail catégorisé est normal et attendu (c'est le
  // principe même du modèle : elle est présente PENDANT qu'elle travaille
  // pour un client) — seul un chevauchement entre deux créneaux tous les
  // deux catégorisés (ex : deux fois "M. Martin" sur le même moment) est
  // le signe d'un doublon réel issu de l'ancienne fusion.
  _chevauchements() {
    const estCategorise = (t) => !!(t.client || t.typeTache);
    const parJour = {};
    (this._data || this._getEntries()).forEach(t => {
      if (!t.heureDebut || !t.heureFin) return;
      (parJour[t.date] = parJour[t.date] || []).push(t);
    });
    const paires = [];
    Object.values(parJour).forEach(liste => {
      liste.sort((a, b) => a.heureDebut.localeCompare(b.heureDebut));
      for (let i = 0; i < liste.length; i++) {
        for (let j = i + 1; j < liste.length; j++) {
          const a = liste[i], b = liste[j];
          if (!estCategorise(a) || !estCategorise(b)) continue; // présence + travail = normal, pas un doublon
          const aDebut = this._versMinutes(a.heureDebut), aFin = this._versMinutes(a.heureFin);
          const bDebut = this._versMinutes(b.heureDebut), bFin = this._versMinutes(b.heureFin);
          if (bDebut < aFin && aDebut < bFin) paires.push([a, b]);
        }
      }
    });
    return paires;
  },

  _libelleCreneau(t) {
    if (t.client) return `${t.client}${t.typeTache ? ` (${t.typeTache})` : ''}`;
    if (t.typeTache) return t.typeTache;
    return 'Présence';
  },

  // ── Rendu ─────────────────────────────────────────────────────────
  _html(entries) {
    const clients = this._clientsUniques();
    const periode = this._periodeActuelle();
    const debutSemaine = this._debutSemaine();

    const CLIENT_INTERNE = this._CLIENT_INTERNE;
    const parProjet = {};
    entries.filter(t => t.date.slice(0, 7) === periode && t.client && t.client !== CLIENT_INTERNE).forEach(t => {
      const cle = t.projet || 'Sans projet';
      parProjet[cle] = (parProjet[cle] || 0) + (t.minutes || 0);
    });
    const projetsTries = Object.entries(parProjet).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const fmt = (min) => `${Math.round((min || 0) / 6) / 10} h`;

    const pointageEnCours = this._pointageEnCours();
    const pointagesDuJour = this._pointagesDuJour();
    const minutesPresenceSemaine = this._minutesPresenceSemaine();
    const minutesPresenceJour = this._minutesPresenceJour();
    const minutesPresenceMois = this._minutesPresenceMois();

    // 08/09/2026, copie démo publique — "avec les données de cette
    // semaine là... comme si c'était la semaine en cours" : quand on
    // navigue sur une semaine différente d'aujourd'hui (`_semaineOffset
    // !== 0`, par défaut sur la démo, voir _seedTempsEtTechniqueDemo
    // dans app.js), les 3 compteurs "Aujourd'hui / Cette semaine" en
    // haut de page basculent sur les chiffres de la semaine AFFICHÉE
    // plutôt que la vraie date du jour — plus cohérent visuellement
    // avec le planning juste en dessous. "Ce mois-ci" reste réel (déjà
    // cohérent, les semaines d'exemple sont dans le même mois).
    const semaineAffichee = this._semaineOffset !== 0;
    let minutesPresenceJourAffiche = minutesPresenceJour;
    let minutesPresenceSemaineAffiche = minutesPresenceSemaine;
    if (semaineAffichee) {
      const debutSemaineAff = this._debutSemaine(this._semaineOffset);
      const joursAffiches = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(debutSemaineAff);
        d.setDate(debutSemaineAff.getDate() + i);
        return this._dateLocale(d);
      });
      minutesPresenceSemaineAffiche = joursAffiches.reduce((s, d) => s + this._minutesJourDonne(d), 0);
      const joursAvecDonnees = joursAffiches.filter(d => this._minutesJourDonne(d) > 0);
      const dernierJourAffiche = joursAvecDonnees[joursAvecDonnees.length - 1];
      minutesPresenceJourAffiche = dernierJourAffiche ? this._minutesJourDonne(dernierJourAffiche) : 0;
    }

    const aujourdHuiStr = this._dateLocale(new Date());
    const journeeTerminee = this._journeeTermineeAujourdHui();
    const enPause = !pointageEnCours && pointagesDuJour.length > 0 && !journeeTerminee;
    const chevauchements = this._chevauchements();

    return `
      ${chevauchements.length ? `
        <div class="card chevauchements-card" style="margin-bottom:20px;">
          <div class="chevauchements-titre">⚠ ${chevauchements.length} chevauchement${chevauchements.length > 1 ? 's' : ''} détecté${chevauchements.length > 1 ? 's' : ''} — probablement des doublons de l'ancienne fusion présence/sessions, à vérifier</div>
          ${chevauchements.map(([a, b]) => `
            <div class="chevauchement-ligne">
              <span>${a.date} — ${this._libelleCreneau(a)} (${a.heureDebut}-${a.heureFin}) &harr; ${this._libelleCreneau(b)} (${b.heureDebut}-${b.heureFin})</span>
              <span class="chevauchement-actions">
                <button class="btn-ghost" data-voir-chevauchement="${a.id}">Voir 1</button>
                <button class="btn-ghost" data-voir-chevauchement="${b.id}">Voir 2</button>
              </span>
            </div>
          `).join('')}
        </div>
      ` : ''}
      <div class="page-header-row">
        <div>
          <div class="page-title"><span class="nav-icon" data-icon="clock"></span>Temps</div>
          <div class="page-sub" id="temps-page-sub">${this._fmtDuree(minutesPresenceMois)} de présence ce mois-ci</div>
        </div>
        <div class="temps-actions">
          <button class="btn-ghost" id="add-temps-manuel-btn"><span class="nav-icon" data-icon="plus" data-icon-size="14"></span>Ajouter un créneau</button>
          <button class="btn" id="add-temps-chrono-btn"><span class="nav-icon" data-icon="play" data-icon-size="13"></span>Démarrer un chrono</button>
        </div>
      </div>

      <div class="card pointage-card" style="margin-bottom:20px;">
        <div class="pointage-header">
          <div class="pointage-status">
            ${pointageEnCours ? `
              <span class="pointage-status-dot actif"></span>
              <span class="pointage-status-text pointage-status-clic" id="pointage-status-edit" data-open="${pointageEnCours.id}" title="Cliquer pour corriger ou catégoriser ce créneau">En cours depuis <strong>${pointageEnCours.heureDebut}</strong><span class="pointage-chrono-inline" id="pointage-chrono-live">00:00:00</span></span>
            ` : enPause ? `
              <span class="pointage-status-dot pause"></span>
              <span class="pointage-status-text">En pause depuis <strong>${pointagesDuJour[pointagesDuJour.length - 1].heureFin}</strong></span>
            ` : journeeTerminee ? `
              <span class="pointage-status-dot terminee"></span>
              <span class="pointage-status-text">Journée terminée — <strong>${this._fmtDuree(minutesPresenceJour)}</strong> au total</span>
            ` : `
              <span class="pointage-status-dot"></span>
              <span class="pointage-status-text">Pas encore pointée aujourd'hui</span>
            `}
          </div>
          <div class="pointage-actions">
            ${this._peutAnnulerDerniereAction() ? `<button class="btn-pointage-annuler" id="pointage-annuler-btn" title="Annuler le dernier clic Pause / Terminer ma journée">↺ Annuler</button>` : ''}
            ${pointageEnCours ? `
              <button class="btn-pointage-pause" id="pointage-pause-btn">☕ Pause</button>
              <button class="btn-pointage-finish" id="pointage-finish-btn">✓ Terminer ma journée</button>
            ` : enPause ? `
              <button class="btn-pointage-resume" id="pointage-resume-btn">▶ Reprendre</button>
              <button class="btn-pointage-finish" id="pointage-finish-btn">✓ Terminer la journée</button>
            ` : journeeTerminee ? `
              <button class="btn-pointage-reopen" id="pointage-reopen-btn">↺ Réouvrir</button>
            ` : `
              <button class="btn-pointage-start" id="pointage-start-btn">▶ Commencer ma journée</button>
            `}
          </div>
        </div>

        ${pointagesDuJour.length ? `
          <div class="pointage-daybar-wrap">
            <span class="pointage-daybar-label">7h</span>
            <div class="pointage-daybar" id="pointage-daybar">${this._htmlDaybarSegments(pointagesDuJour)}</div>
            <span class="pointage-daybar-label fin">20h</span>
          </div>
          <div class="pointage-footer">
            <span class="pointage-footer-total" id="pointage-footer-total">Présence : ${this._fmtDuree(minutesPresenceJour)} aujourd'hui · ${this._fmtDuree(minutesPresenceSemaine)} cette semaine</span>
            <button type="button" class="btn-lien-discret" id="toggle-pointage-manuel-btn">+ Ajouter un créneau express</button>
          </div>
        ` : `
          <div class="pointage-footer" style="margin-top:14px; justify-content:flex-end;">
            <button type="button" class="btn-lien-discret" id="toggle-pointage-manuel-btn">+ Ajouter un créneau express</button>
          </div>
        `}

        <div class="pointage-manuel-zone">
          <form id="pointage-manuel-form" class="pointage-manuel-row">
            <input type="date" name="date" value="${aujourdHuiStr}">
            <input type="time" name="heureDebut">
            <input type="time" name="heureFin">
            <input type="text" name="description" placeholder="Description (optionnel)" style="flex:1; min-width:140px;">
            <button type="submit" class="btn-ghost">Valider</button>
          </form>
        </div>
      </div>

      <div class="grid grid-3 temps-kpis" style="margin-bottom:20px;">
        <div class="card">
          <div class="stat-label">${semaineAffichee ? 'Dernier jour (semaine affichée)' : "Aujourd'hui"}</div>
          <div class="stat-value" style="font-size:20px;" id="stat-temps-jour">${this._fmtDuree(minutesPresenceJourAffiche)}</div>
          <div class="stat-sub temps-kpi-detail">= ta présence totale — le détail par client est dans l'onglet "Forfaits &amp; projets"</div>
        </div>
        <div class="card">
          <div class="stat-label">${semaineAffichee ? 'Semaine affichée' : 'Cette semaine'}</div>
          <div class="stat-value" style="font-size:20px;" id="stat-temps-semaine">${this._fmtDuree(minutesPresenceSemaineAffiche)}</div>
        </div>
        <div class="card">
          <div class="stat-label" style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
            <span>Ce mois-ci</span>
            <button type="button" class="btn-lien-discret" id="ouvrir-historique-mois-btn" style="font-size:11px;">Historique</button>
          </div>
          <div class="stat-value" style="font-size:20px;" id="stat-temps-mois">${this._fmtDuree(minutesPresenceMois)}</div>
        </div>
      </div>

      <div class="temps-tabs">
        <button class="temps-tab ${this._vue === 'semaine' ? 'active' : ''}" data-tab="semaine">Vue Semaine</button>
        <button class="temps-tab ${this._vue === 'liste' ? 'active' : ''}" data-tab="liste">Vue Liste</button>
        <button class="temps-tab ${this._vue === 'details' ? 'active' : ''}" data-tab="details">Forfaits &amp; projets</button>
      </div>

      ${this._vue === 'semaine' ? this._htmlVueSemaine(entries) : this._vue === 'details' ? this._htmlDetails(clients, fmt, projetsTries) : (() => {
        // Vue Liste = le suivi CLIENT (facturable) uniquement par défaut —
        // les créneaux de présence pure et les activités internes
        // (prospection, admin...) sont masqués derrière un toggle.
        const entreesNonClient = entries.filter(t => !t.client || t.client === CLIENT_INTERNE);
        const entreesAffichees = (this._vueListeInclureInterne ? entries : entries.filter(t => t.client && t.client !== CLIENT_INTERNE))
          .slice().sort((a, b) => b.date.localeCompare(a.date));
        return `
          ${entreesNonClient.length ? `
            <div style="margin-bottom:12px;">
              <label style="display:inline-flex; align-items:center; gap:7px; font-size:12.5px; color:#8a8a8a; cursor:pointer;">
                <input type="checkbox" id="toggle-vue-liste-interne" ${this._vueListeInclureInterne ? 'checked' : ''}>
                Afficher aussi ma présence et mes activités internes (${entreesNonClient.length})
              </label>
            </div>
          ` : ''}
          <div class="card" style="padding:0; overflow-x:auto;">
            <table>
              <thead><tr>
                <th>Client</th><th>Projet</th><th>Type</th><th>Description</th><th>Durée</th><th>Date</th><th></th>
              </tr></thead>
              <tbody>
                ${entreesAffichees.length ? entreesAffichees.map(t => `
                  <tr data-open="${t.id}" style="cursor:pointer;">
                    <td>${t.client || '—'}</td>
                    <td>${t.projet || '—'}</td>
                    <td>${t.typeTache === 'Maintenance/Abonnement' ? '<span class="badge badge-blue">Maintenance</span>' : (t.typeTache || '—')}</td>
                    <td>${t.description || '—'}</td>
                    <td>${t.minutes != null ? `${t.minutes} min` : 'en cours'}</td>
                    <td>${t.date}</td>
                    <td style="width:36px;"><button class="row-delete-btn" data-delete="${t.id}" title="Supprimer">✕</button></td>
                  </tr>
                `).join('') : `<tr><td colspan="7" style="color:#6a6a6a;">Aucune session client pour le moment.</td></tr>`}
              </tbody>
            </table>
          </div>
        `;
      })()}
    `;
  },

  // ── Onglet Forfaits & projets — jauges par client à forfait + temps
  // par projet.
  _htmlDetails(clients, fmt, projetsTries) {
    const cartesForfaits = clients.map(c => {
      const consomme = this._minutesConsommees(c);
      const inclus = this._forfaitInclusMinutes(c);
      if (!inclus) return '';
      const pct = Math.min(100, Math.round((consomme / inclus) * 100));
      const gaugeClass = pct >= 100 ? 'danger' : pct >= 80 ? 'warn' : '';
      const restant = inclus - consomme;
      return `
        <div class="card">
          <div class="stat-label">${c} — forfait Performance</div>
          <div class="stat-value" style="font-size:16px;">${fmt(consomme)} / ${fmt(inclus)}</div>
          <div class="gauge-track"><div class="gauge-fill ${gaugeClass}" style="width:${pct}%"></div></div>
          <div class="stat-sub">${restant >= 0 ? `${restant} min restantes ce mois-ci` : `${Math.abs(restant)} min de dépassement — à facturer en plus`}</div>
        </div>
      `;
    }).join('');

    return `
      <div class="section-title" style="margin-bottom:10px;">Forfaits — consommation ce mois-ci</div>
      ${cartesForfaits ? `<div class="grid grid-2" style="margin-bottom:24px;">${cartesForfaits}</div>` : `<div class="card" style="margin-bottom:24px;"><div class="stat-sub">Aucun client avec un forfait à heures incluses pour le moment.</div></div>`}

      <div class="section-title" style="margin-bottom:10px;">Temps par projet — ce mois-ci</div>
      ${projetsTries.length ? `
        <div class="card">
          ${projetsTries.map(([projet, min]) => `
            <div style="display:flex; align-items:center; justify-content:space-between; padding:6px 0; border-bottom:1px solid #1c1c1c;">
              <span>${projet}</span>
              <span style="color:#a3a3a3;">${fmt(min)}</span>
            </div>
          `).join('')}
        </div>
      ` : `<div class="card"><div class="stat-sub">Aucun projet saisi ce mois-ci.</div></div>`}
    `;
  },

  // ── Vue Semaine (agenda Lundi-Dimanche, créneaux horaires) ──────────
  // Un seul type de bloc désormais (fini la bande de présence séparée en
  // fond) : chaque créneau — catégorisé ou non — est UN bloc, coloré
  // selon `_classeCreneau`. Les créneaux non catégorisés (juste de la
  // présence) ressortent avec un style distinct ("presence") pour inviter
  // à cliquer dessus et préciser ce que c'était.
  _htmlVueSemaine(entries) {
    const HEURE_DEBUT = 7, HEURE_FIN = 20;
    const totalHeures = HEURE_FIN - HEURE_DEBUT;
    const esMobile = window.innerWidth <= 880;
    // Grille légèrement plus compacte sur mobile (07/09/2026, retour de
    // Tiphaine : trop de scroll vertical pour une seule colonne) — moins
    // de hauteur par heure, donc plus d'heures visibles sans défiler.
    const hauteurHeure = esMobile ? 28 : 34;
    const hauteurGrille = totalHeures * hauteurHeure;
    // Bug corrigé (03/09/2026) : les boutons de navigation mettaient bien
    // à jour `this._semaineOffset`, mais cet appel-ci l'ignorait encore
    // et recalculait toujours la VRAIE semaine — la Vue Semaine ne
    // bougeait donc jamais visuellement malgré le re-render.
    const debutSemaine = this._debutSemaine(this._semaineOffset);
    const jours = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
    const maintenant = new Date();
    const dateAujourdHui = this._dateLocale(maintenant);

    const dates = jours.map((_, i) => {
      const d = new Date(debutSemaine);
      d.setDate(d.getDate() + i);
      return d;
    });

    // Vue Semaine mobile — un seul jour à la fois (07/09/2026, retour de
    // Tiphaine : la grille 7 jours est illisible sur petit écran, les
    // colonnes sont coupées et ça oblige à scroller dans tous les sens).
    // Plutôt que de changer d'onglet par défaut, on garde EXACTEMENT la
    // même grille (mêmes blocs, mêmes couleurs, mêmes interactions) mais
    // on ne rend qu'une colonne — celle du jour sélectionné via
    // `_semaineJourMobile` — avec des flèches jour précédent/suivant qui
    // peuvent traverser les limites de semaine (voir `_bindEvents`).
    const datesStr = dates.map(d => this._dateLocale(d));
    if (esMobile && (!this._semaineJourMobile || !datesStr.includes(this._semaineJourMobile))) {
      this._semaineJourMobile = datesStr.includes(dateAujourdHui) ? dateAujourdHui : datesStr[0];
    }
    const indicesAffiches = esMobile ? [datesStr.indexOf(this._semaineJourMobile)] : dates.map((_, i) => i);

    const minutesDepuisDebut = (hhmm) => {
      const [h, m] = hhmm.split(':').map(Number);
      return Math.max(0, Math.min(totalHeures * 60, (h * 60 + m) - HEURE_DEBUT * 60));
    };

    const colonnes = indicesAffiches.map((idx) => {
      const date = dates[idx];
      const dateStr = this._dateLocale(date);
      const estAujourdHui = dateStr === dateAujourdHui;

      const blocs = entries.filter(t => t.date === dateStr && t.heureDebut).map(t => {
        const finStr = t.heureFin || this._heureLocale(maintenant);
        const top = minutesDepuisDebut(t.heureDebut) / 60 * hauteurHeure;
        const bas = minutesDepuisDebut(finStr) / 60 * hauteurHeure;
        const HAUTEUR_MIN = 25; // mini 25px : un créneau court ne doit jamais écraser son propre texte
        // La hauteur minimale s'agrandit autour du CENTRE du créneau (pas
        // seulement vers le bas) : sinon un tout petit créneau (ex : 5 min)
        // peut visuellement "déborder" plus bas qu'un créneau bien plus long
        // qui le chevauche (ex : une présence de plusieurs heures), donnant
        // l'impression trompeuse qu'il finit plus tard — retour concret de
        // Tiphaine le 03/09/2026 sur un cas M. Martin/Présence.
        const hauteurBrute = bas - top;
        const hauteur = Math.max(HAUTEUR_MIN, hauteurBrute);
        const topRendu = hauteurBrute < HAUTEUR_MIN ? Math.max(0, top - (HAUTEUR_MIN - hauteurBrute) / 2) : top;
        const classe = this._classeCreneau(t);
        const nonCategorise = classe === 'presence';
        const titreLigne1 = nonCategorise ? 'Présence' : (t.client && t.client !== this._CLIENT_INTERNE ? t.client : (t.typeTache || 'Interne'));
        const sousTitre = nonCategorise ? 'à catégoriser' : (t.projet || t.typeTache || '');
        const titreSurvol = `${titreLigne1}${t.projet ? ` - ${t.projet}` : ''} - ${t.minutes != null ? `${t.minutes} min` : 'en cours'}`;
        // Couleur paramétrable (onglet Paramétrage) pour tout type
        // catégorisé — la présence garde son style dédié pointillé rouge,
        // fixe, pas une couleur de type comme les autres (voir CSS
        // `.semaine-bloc-presence`).
        const styleCouleur = nonCategorise ? '' : (() => {
          const c = this._couleurType(classe);
          // Fond un peu plus soutenu (.22 → .32) — trop pâle sur un thème
          // clair, le texte (posé dans la couleur pleine du type) se
          // distinguait mal du fond de page environnant (retour de
          // Tiphaine le 03/09/2026 : "on voit pas bien").
          return `background:${this._hexVersRgba(c, .32)}; border-left-color:${c}; color:${c};`;
        })();
        return `
          <div class="semaine-bloc ${nonCategorise ? 'semaine-bloc-presence' : ''}" style="top:${topRendu}px; height:${hauteur}px; ${styleCouleur}" data-open="${t.id}" title="${titreSurvol}">
            <div class="semaine-bloc-titre">${titreLigne1}</div>
            ${hauteur > 30 ? `<div class="semaine-bloc-sub">${sousTitre}</div>` : ''}
          </div>
        `;
      }).join('');

      // Lignes d'heure codées en dur en #141414 avant le 03/09/2026 —
      // quasi invisibles sur fond sombre (se fondaient dans le panneau)
      // mais devenaient des traits noirs épais et durs sur un thème
      // clair (retour de Tiphaine). `var(--border-subtle)` suit le thème
      // comme les autres séparateurs de la grille.
      const fondLignes = `repeating-linear-gradient(to bottom, transparent 0, transparent ${hauteurHeure - 1}px, var(--border-subtle) ${hauteurHeure - 1}px, var(--border-subtle) ${hauteurHeure}px)`;
      // data-day/-heure-debut/-hauteur-heure : permettent au clic sur une
      // case vide (voir _bindEvents) de convertir la position Y cliquée en
      // date + heure de début, pour ouvrir directement le formulaire
      // prérempli au bon endroit.
      return `<div class="semaine-jour ${estAujourdHui ? 'semaine-jour-actif' : ''}" data-day="${dateStr}" data-heure-debut="${HEURE_DEBUT}" data-hauteur-heure="${hauteurHeure}" style="height:${hauteurGrille}px; background-image:${fondLignes};">${blocs}</div>`;
    }).join('');

    const heuresLabels = Array.from({ length: totalHeures + 1 }, (_, i) => {
      const h = HEURE_DEBUT + i;
      // Le label est centré sur sa ligne d'heure (-6px), mais pour la
      // toute première ligne (7h) ça le fait remonter au-dessus du bord
      // du conteneur défilant, qui le coupe (`overflow-y:auto` sur
      // `.semaine-corps-scroll`) — repéré par Tiphaine le 03/09/2026.
      // On empêche juste ce tout premier label de passer en négatif.
      const top = Math.max(0, i * hauteurHeure - 6);
      return `<div class="semaine-heure-label" style="top:${top}px;">${String(h).padStart(2, '0')}:00</div>`;
    }).join('');

    // Navigation semaine par semaine + saut direct à une date (mois/année
    // lointains) — demande de Tiphaine le 03/09/2026 ("comme un vrai
    // calendrier, Google Agenda, FamilyWall..."). `_semaineOffset` ne
    // change QUE cet affichage, jamais les cartes de stats au-dessus
    // (toujours sur la vraie semaine/mois en cours, voir `_debutSemaine`).
    const libelleSemaine = `Semaine du ${dates[0].toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} au ${dates[6].toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;

    // Total de la semaine AFFICHÉE (09/09/2026, demande de Tiphaine :
    // "en haut à droite" le temps de travail de la semaine, pour toutes
    // les semaines, pas juste la semaine réelle en cours). Toujours
    // calculé sur les 7 jours de `datesStr`, même sur mobile où
    // `indicesAffiches` ne montre qu'un seul jour à la fois.
    const totalSemaineAffichee = datesStr.reduce((s, d) => s + this._minutesJourDonne(d), 0);

    // Total travaillé par jour, affiché en pied de planning (03/09/2026) —
    // même logique que les cartes "Temps de travail" (toute présence
    // enregistrée compte), et compte le créneau en cours en direct s'il
    // s'agit d'aujourd'hui (`_minutesJourDonne`).
    const totauxJours = indicesAffiches.map((idx) => {
      const dateStr = datesStr[idx];
      const mins = this._minutesJourDonne(dateStr);
      return `<div class="semaine-total-jour">${mins > 0 ? this._fmtDuree(mins) : '—'}</div>`;
    }).join('');

    // Nav mobile (07/09/2026, retour "recentre et fais un truc plus
    // esthétique") — remplace ENTIÈREMENT la nav semaine sur mobile (plus
    // de deux rangées empilées redondantes) : une seule rangée centrée
    // "‹ Lundi 07/09 ›", le libellé reste cliquable pour ouvrir le même
    // mini-calendrier que sur desktop (saut direct à une date lointaine),
    // et "Aujourd'hui" est positionné en absolu à droite pour ne jamais
    // désaxer le centrage du bloc flèches+libellé.
    const jourAffiche = dates[indicesAffiches[0]];
    const jourAffocheEstAujourdHui = datesStr[indicesAffiches[0]] === dateAujourdHui;
    const navSemaine = `
      <div class="semaine-nav">
        <button type="button" class="semaine-nav-btn" data-semaine-nav="-1" title="Semaine précédente">‹</button>
        <div class="semaine-nav-label-wrap">
          <button type="button" class="semaine-nav-label" id="semaine-nav-toggle-cal">${libelleSemaine}</button>
          ${this._miniCalOuvert ? this._htmlMiniCalendrier(debutSemaine) : ''}
        </div>
        <button type="button" class="semaine-nav-btn" data-semaine-nav="1" title="Semaine suivante">›</button>
        ${this._semaineOffset !== 0 ? `<button type="button" class="btn-lien-discret semaine-nav-today" data-semaine-nav="0">Aujourd'hui</button>` : ''}
        <div class="semaine-nav-total" style="margin-left:auto; font-size:12.5px; color:#8a8a8a; white-space:nowrap;">
          Total : <strong style="color:var(--text-primary);">${totalSemaineAffichee > 0 ? this._fmtDuree(totalSemaineAffichee) : '—'}</strong>
        </div>
      </div>
    `;
    const navJour = `
      <div class="semaine-nav semaine-nav-jour">
        <button type="button" class="semaine-nav-btn" data-jour-mobile-nav="-1" title="Jour précédent">‹</button>
        <div class="semaine-nav-label-wrap">
          <button type="button" class="semaine-nav-label" id="semaine-nav-toggle-cal">${jours[indicesAffiches[0]]} ${jourAffiche.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</button>
          ${this._miniCalOuvert ? this._htmlMiniCalendrier(debutSemaine, datesStr[indicesAffiches[0]]) : ''}
        </div>
        <button type="button" class="semaine-nav-btn" data-jour-mobile-nav="1" title="Jour suivant">›</button>
        ${!jourAffocheEstAujourdHui ? `<button type="button" class="btn-lien-discret semaine-nav-today" data-jour-mobile-nav="0">Aujourd'hui</button>` : ''}
      </div>
    `;

    return `
      <div class="card" style="padding:16px; overflow-x:auto;">
        ${esMobile ? navJour : navSemaine}
        ${esMobile ? `<div style="text-align:center; font-size:12px; color:#8a8a8a; margin:-8px 0 12px;">Total semaine : <strong style="color:var(--text-primary);">${totalSemaineAffichee > 0 ? this._fmtDuree(totalSemaineAffichee) : '—'}</strong></div>` : ''}
        ${this._semaineOffset !== 0 ? `
          <div class="stat-sub" style="margin:-4px 0 12px; padding:8px 10px; background:rgba(245,166,35,.08); border:1px solid rgba(245,166,35,.25); border-radius:8px; color:#e0b06a;">
            📅 Semaine affichée : <b>${this._fmtDuree(totalSemaineAffichee)}</b> — un exemple complet (données fictives), présenté comme si c'était la semaine en cours. Les compteurs en haut de page reflètent cette même semaine. Clique <b>"Aujourd'hui"</b> pour voir la vraie date du jour.
          </div>
        ` : ''}
        <div class="semaine-legende">
          ${this._getTypesTache().map(type => `<span><span class="semaine-dot" style="background:${this._couleurType(type)};"></span>${type}</span>`).join('')}
          <span><span class="semaine-dot semaine-dot-presence"></span>Présence (à catégoriser)</span>
        </div>
        <div style="${esMobile ? '' : 'min-width:760px;'}">
          ${esMobile ? `
            <!-- Sur mobile, jour/date sont déjà dans la nav du dessus — pas
                 besoin de les répéter dans l'en-tête de colonne, qui se
                 réduit à un simple bouton d'ajout aligné à droite. -->
            <div class="semaine-entetes-mobile">
              <button type="button" class="btn-ghost semaine-entete-plus-mobile" data-add-day="${datesStr[indicesAffiches[0]]}"><span class="nav-icon" data-icon="plus" data-icon-size="12"></span>Ajouter un créneau</button>
            </div>
          ` : `
            <div class="semaine-entetes">
              <div class="semaine-gouttiere-entete"></div>
              ${indicesAffiches.map((idx) => `
                <div class="semaine-entete-jour">
                  <div>${jours[idx]}</div>
                  <div class="semaine-entete-date">${dates[idx].toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</div>
                  <button type="button" class="semaine-entete-plus" data-add-day="${datesStr[idx]}" title="Ajouter un créneau précis ce jour-là (même par-dessus de la présence)">+</button>
                </div>
              `).join('')}
            </div>
          `}
          <div class="semaine-corps-scroll">
            <div class="semaine-corps">
              <div class="semaine-gouttiere" style="height:${hauteurGrille}px;">${heuresLabels}</div>
              ${colonnes}
            </div>
          </div>
          <div class="semaine-totaux">
            <div class="semaine-gouttiere-entete semaine-total-label">Total</div>
            ${totauxJours}
          </div>
        </div>
      </div>
    `;
  },

  _bindEvents(container) {
    const addManuelBtn = container.querySelector('#add-temps-manuel-btn');
    if (addManuelBtn) addManuelBtn.addEventListener('click', () => this._ouvrirCreneauForm(null));

    const historiqueMoisBtn = container.querySelector('#ouvrir-historique-mois-btn');
    if (historiqueMoisBtn) historiqueMoisBtn.addEventListener('click', () => this._ouvrirHistoriqueMois());

    const addChronoBtn = container.querySelector('#add-temps-chrono-btn');
    if (addChronoBtn) addChronoBtn.addEventListener('click', () => {
      if (window.TimerGlobal) window.TimerGlobal.ouvrirDemarrage();
    });

    // Rafraîchit aussi le widget de présence de la topbar (window.PresenceWidget)
    // après toute action lancée depuis la page Temps.
    const rafraichirTout = () => {
      this.render(this._root);
      if (window.PresenceWidget) window.PresenceWidget._render();
    };

    const pointageStartBtn = container.querySelector('#pointage-start-btn');
    if (pointageStartBtn) pointageStartBtn.addEventListener('click', () => {
      this._demarrerPointage();
      rafraichirTout();
    });

    const pointageResumeBtn = container.querySelector('#pointage-resume-btn');
    if (pointageResumeBtn) pointageResumeBtn.addEventListener('click', () => {
      this._demarrerPointage();
      rafraichirTout();
    });

    const pointagePauseBtn = container.querySelector('#pointage-pause-btn');
    if (pointagePauseBtn) pointagePauseBtn.addEventListener('click', () => {
      this._terminerPointage();
      rafraichirTout();
    });

    const pointageFinishBtn = container.querySelector('#pointage-finish-btn');
    if (pointageFinishBtn) pointageFinishBtn.addEventListener('click', () => {
      this._terminerJournee();
      rafraichirTout();
    });

    const pointageReopenBtn = container.querySelector('#pointage-reopen-btn');
    if (pointageReopenBtn) pointageReopenBtn.addEventListener('click', () => {
      this._reouvrirJournee();
      rafraichirTout();
    });

    const pointageAnnulerBtn = container.querySelector('#pointage-annuler-btn');
    if (pointageAnnulerBtn) pointageAnnulerBtn.addEventListener('click', () => {
      this._annulerDerniereAction();
      rafraichirTout();
    });

    // Chrono live de la carte "Pointage du jour", uniquement si un
    // créneau est actuellement ouvert.
    const chronoLive = container.querySelector('#pointage-chrono-live');
    if (chronoLive) {
      const enCours = this._pointageEnCours();
      if (enCours) this._demarrerChronoPointageLive(enCours.heureDebut);
    }

    // Le formulaire de saisie express est masqué par défaut.
    const toggleManuelBtn = container.querySelector('#toggle-pointage-manuel-btn');
    const pointageManuelForm = container.querySelector('#pointage-manuel-form');
    if (toggleManuelBtn && pointageManuelForm) {
      toggleManuelBtn.addEventListener('click', () => {
        const visible = pointageManuelForm.classList.toggle('visible');
        toggleManuelBtn.style.display = visible ? 'none' : '';
        if (visible) pointageManuelForm.querySelector('input[type="time"]').focus();
      });
    }
    if (pointageManuelForm) pointageManuelForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const date = fd.get('date') || this._dateLocale(new Date());
      const heureDebut = fd.get('heureDebut') || '';
      const heureFin = fd.get('heureFin') || '';
      const description = fd.get('description') || '';
      if (!heureDebut) return; // au minimum une heure de début pour ajouter un créneau
      this._ajouterCreneauPointage(date, heureDebut, heureFin || null, description);
      rafraichirTout();
    });

    container.querySelectorAll('[data-voir-chevauchement]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.voirChevauchement);
        const t = (this._data || []).find(x => x.id === id);
        if (t) this._ouvrirCreneauForm(t);
      });
    });

    container.querySelectorAll('.temps-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this._vue = tab.dataset.tab;
        this.render(this._root);
      });
    });

    const toggleInterneBtn = container.querySelector('#toggle-vue-liste-interne');
    if (toggleInterneBtn) toggleInterneBtn.addEventListener('change', (e) => {
      this._vueListeInclureInterne = e.target.checked;
      this.render(this._root);
    });

    // Un seul point d'entrée pour éditer N'IMPORTE QUEL créneau — bloc de
    // la Vue Semaine, ligne de la Vue Liste, segment de la barre du jour,
    // texte de statut "En cours depuis...". Tout passe par `data-open`.
    container.querySelectorAll('[data-open]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation(); // sinon le clic remonte à la case vide (.semaine-jour) et ouvre AUSSI le formulaire de création
        const id = Number(el.dataset.open);
        const t = (this._data || []).find(x => x.id === id);
        if (t) this._ouvrirCreneauForm(t);
      });
    });

    // Bouton "+" en tête de colonne (Vue Semaine) : ouvre le formulaire
    // pour CE jour sans heure prédéfinie — utile quand la colonne est déjà
    // couverte par un bloc de présence et qu'on veut préciser "1h avec M.
    // X, 30 min avec Mme Y" à l'intérieur, sans devoir viser un pixel vide.
    container.querySelectorAll('[data-add-day]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._ouvrirCreneauForm(null, { date: btn.dataset.addDay, heureDebut: '' });
      });
    });

    // Navigation de la Vue Semaine (03/09/2026) : précédent/suivant en
    // semaines, "Aujourd'hui" pour revenir d'un coup, et un mini-
    // calendrier maison (popover) pour sauter directement à une semaine
    // lointaine — remplace un `<input type="date">` invisible qui
    // s'ouvrait de façon peu fiable selon les navigateurs (retour de
    // Tiphaine le 03/09/2026 : "je n'ai rien" au clic).
    container.querySelectorAll('[data-semaine-nav]').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.dataset.semaineNav;
        this._semaineOffset = val === '0' ? 0 : this._semaineOffset + Number(val);
        this._miniCalOuvert = false;
        this._semaineJourMobile = null; // repart sur "aujourd'hui si dans la semaine, sinon lundi" (recalculé dans _htmlVueSemaine)
        this.render(this._root);
      });
    });

    // Nav jour-par-jour de la Vue Semaine mobile (07/09/2026) — peut
    // traverser une limite de semaine (ex : Dimanche → Lundi suivant) :
    // on recalcule `_semaineOffset` à partir du nombre de jours entre la
    // vraie semaine actuelle et le jour ciblé, plutôt que de gérer un
    // cas particulier "on sort de la semaine affichée".
    container.querySelectorAll('[data-jour-mobile-nav]').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.dataset.jourMobileNav;
        if (val === '0') {
          this._semaineOffset = 0;
          this._semaineJourMobile = this._dateLocale(new Date());
        } else {
          const cur = new Date(`${this._semaineJourMobile}T00:00:00`);
          cur.setDate(cur.getDate() + Number(val));
          const lundiReel = this._debutSemaine(0);
          const diffJours = Math.round((cur - lundiReel) / 86400000);
          this._semaineOffset = Math.floor(diffJours / 7);
          this._semaineJourMobile = this._dateLocale(cur);
        }
        this.render(this._root);
      });
    });
    const toggleCalBtn = container.querySelector('#semaine-nav-toggle-cal');
    if (toggleCalBtn) {
      toggleCalBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._miniCalOuvert = !this._miniCalOuvert;
        this._miniCalMois = null; // repart sur le mois de la semaine affichée à chaque ouverture
        this._miniCalVueMoisAnnee = false;
        this.render(this._root);
      });
    }
    // Clic sur le titre ("Août 2026") → bascule sur la grille des 12 mois
    // pour choisir mois + année directement (demande de Tiphaine le
    // 03/09/2026), plutôt que de cliquer ‹ › plusieurs fois.
    const titreToggleBtn = container.querySelector('[data-minical-titre-toggle]');
    if (titreToggleBtn) {
      titreToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._miniCalVueMoisAnnee = true;
        this.render(this._root);
      });
    }
    container.querySelectorAll('[data-minical-choix-mois]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const base = this._miniCalMois || this._debutSemaine(this._semaineOffset);
        this._miniCalMois = new Date(base.getFullYear(), Number(btn.dataset.minicalChoixMois), 1);
        this._miniCalVueMoisAnnee = false;
        this.render(this._root);
      });
    });
    // Navigation mois/année DANS le popover (ne ferme pas, ne change pas
    // la semaine sélectionnée — juste la page affichée dans la grille).
    container.querySelectorAll('[data-minical-mois]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const base = this._miniCalMois || this._debutSemaine(this._semaineOffset);
        this._miniCalMois = new Date(base.getFullYear(), base.getMonth() + Number(btn.dataset.minicalMois), 1);
        this.render(this._root);
      });
    });
    container.querySelectorAll('[data-minical-annee]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const base = this._miniCalMois || this._debutSemaine(this._semaineOffset);
        this._miniCalMois = new Date(base.getFullYear() + Number(btn.dataset.minicalAnnee), base.getMonth(), 1);
        this.render(this._root);
      });
    });
    // Clic sur un jour de la grille → saute à LA SEMAINE de ce jour
    // (lundi au dimanche), pas juste ce jour précis.
    container.querySelectorAll('[data-minical-jour]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const cible = new Date(btn.dataset.minicalJour + 'T00:00:00');
        const lundiReel = this._debutSemaine(0);
        const diffJours = Math.round((cible - lundiReel) / 86400000);
        this._semaineOffset = Math.floor(diffJours / 7);
        this._semaineJourMobile = btn.dataset.minicalJour; // précision (07/09/2026) : sur mobile, se cale sur le jour cliqué, pas juste sur le lundi de sa semaine
        this._miniCalOuvert = false;
        this.render(this._root);
      });
    });
    // Clic n'importe où ailleurs sur la page → referme le popover s'il
    // est ouvert (comportement standard d'un date-picker).
    if (this._miniCalOuvert) {
      const fermerAuClicExterieur = (e) => {
        if (!e.target.closest('.semaine-nav-label-wrap')) {
          this._miniCalOuvert = false;
          this.render(this._root);
        }
        document.removeEventListener('click', fermerAuClicExterieur);
      };
      // setTimeout 0 : évite que le clic qui vient d'OUVRIR le popover
      // (déjà en train de se propager) ne le referme instantanément.
      setTimeout(() => document.addEventListener('click', fermerAuClicExterieur), 0);
    }

    // Clic sur une case vide du planning (Vue Semaine) → ouvre directement
    // le formulaire, prérempli avec le jour cliqué ET l'heure de début
    // correspondant à la position Y du clic (arrondie au quart d'heure).
    container.querySelectorAll('.semaine-jour[data-day]').forEach(col => {
      col.addEventListener('click', (e) => {
        const rect = col.getBoundingClientRect();
        const offsetY = e.clientY - rect.top;
        const heureDebutCol = Number(col.dataset.heureDebut);
        const hauteurHeure = Number(col.dataset.hauteurHeure);
        let totalMinutes = heureDebutCol * 60 + (offsetY / hauteurHeure) * 60;
        totalMinutes = Math.max(heureDebutCol * 60, Math.round(totalMinutes / 15) * 15);
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        const heureDebut = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        this._ouvrirCreneauForm(null, { date: col.dataset.day, heureDebut });
      });
    });

    container.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number(btn.dataset.delete);
        window.confirmerAction('Supprimer ce créneau ?', () => {
          if (!this._data) this._data = this._getEntries();
          this._setEntries(this._data.filter(x => x.id !== id));
          this.render(this._root);
          if (window.PresenceWidget) window.PresenceWidget._render();
        });
      });
    });
  },
};

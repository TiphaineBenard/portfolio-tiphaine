/* ═══════════════════════════════════════════════════════════
   WIDGET DE PRÉSENCE GLOBAL — pastille dans la topbar (à côté du
   chrono client), pour lancer/pauser sa journée de travail (pointage
   bureau) depuis n'importe quel écran de l'appli, sans devoir aller
   sur la page Temps. Rendu dans #presence-widget (topbar, hors
   #content donc jamais écrasé par le routeur — même pattern que
   modules/timer-global.js).

   Ne réimplémente RIEN de la logique de pointage : window.Modules.temps
   existe globalement dès que temps.js est chargé (que sa page soit
   affichée ou non), donc ce widget appelle directement ses méthodes
   (_demarrerPointage/_terminerPointage/_pointageEnCours/etc.) — une
   seule source de vérité pour les créneaux, unifiés présence + travail
   depuis le 03/09/2026 (tos_creneaux).

   Décision produit (03/09/2026, choix de Tiphaine) : DEUX boutons
   séparés dans la topbar — celui-ci pour la présence (mise en avant,
   c'est l'action qu'elle veut pouvoir lancer de partout), et le chrono
   client (#global-timer, timer-global.js) à côté pour la facturation.
   Interaction confirmée par Tiphaine : cliquer sur la pastille QUAND
   elle est active = pause (équivalent du bouton ☕ Pause de la carte
   Temps), pas d'action séparée nécessaire pour ça dans la topbar.
   Terminer complètement la journée reste volontairement réservé à la
   page Temps (bouton "✓ Terminer ma journée") — pour éviter qu'un clic
   dans la topbar ne mette fin à la journée par erreur.
═══════════════════════════════════════════════════════════ */

window.PresenceWidget = {
  _root: null,
  _intervalId: null,

  init() {
    this._root = document.getElementById('presence-widget');
    if (!this._root) return;
    this._render();
  },

  _temps() {
    return window.Modules && window.Modules.temps;
  },

  // Si la page Temps est ouverte, rafraîchit son affichage pour rester
  // cohérent avec l'action lancée depuis la topbar (même logique que
  // TimerGlobal.arreter() pour le chrono client).
  _rafraichirPageTemps() {
    const temps = this._temps();
    if (temps && temps._root) temps.render(temps._root);
  },

  demarrer() {
    const temps = this._temps();
    if (!temps) return;
    temps._demarrerPointage();
    this._render();
    this._rafraichirPageTemps();
  },

  // "Pause" = fermer le créneau en cours sans marquer la journée comme
  // terminée (même sémantique que le bouton ☕ Pause de la carte Temps).
  pause() {
    const temps = this._temps();
    if (!temps) return;
    temps._terminerPointage();
    this._render();
    this._rafraichirPageTemps();
  },

  _demarrerTick() {
    this._arreterTick();
    this._intervalId = setInterval(() => this._tick(), 1000);
  },
  _arreterTick() {
    if (this._intervalId) clearInterval(this._intervalId);
    this._intervalId = null;
  },
  _tick() {
    const temps = this._temps();
    const el = document.getElementById('presence-widget-chrono');
    const enCours = temps && temps._pointageEnCours();
    if (!el || !enCours) { this._arreterTick(); return; }
    const [h, m] = enCours.heureDebut.split(':').map(Number);
    const debut = new Date();
    debut.setHours(h, m, 0, 0);
    const secs = Math.max(0, Math.floor((Date.now() - debut.getTime()) / 1000));
    el.textContent = `${String(Math.floor(secs / 3600)).padStart(2, '0')}:${String(Math.floor((secs % 3600) / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  },

  _render() {
    if (!this._root) return;
    const temps = this._temps();
    if (!temps) { this._root.innerHTML = ''; return; }

    const enCours = temps._pointageEnCours();
    const pointagesDuJour = temps._pointagesDuJour();
    const journeeTerminee = temps._journeeTermineeAujourdHui();
    const enPause = !enCours && pointagesDuJour.length > 0 && !journeeTerminee;

    if (enCours) {
      this._root.innerHTML = `
        <button id="presence-widget-btn" class="presence-widget presence-widget-actif" title="En cours depuis ${enCours.heureDebut} — clic = pause">
          <span class="presence-widget-dot"></span>
          <span class="presence-widget-chrono" id="presence-widget-chrono">00:00:00</span>
        </button>
      `;
      document.getElementById('presence-widget-btn').addEventListener('click', () => this.pause());
      this._tick();
      this._demarrerTick();
      return;
    }

    if (enPause) {
      this._root.innerHTML = `
        <button id="presence-widget-btn" class="topbar-icon-btn presence-widget-pause" title="En pause — cliquer pour reprendre">
          <span class="presence-widget-dot"></span>
        </button>
      `;
      document.getElementById('presence-widget-btn').addEventListener('click', () => this.demarrer());
      return;
    }

    if (journeeTerminee) {
      this._root.innerHTML = `
        <button id="presence-widget-btn" class="topbar-icon-btn presence-widget-terminee" title="Journée terminée — voir le détail dans Temps">
          <span class="topbar-icon-btn-svg" data-icon="play" data-icon-size="15"></span>
        </button>
      `;
      window.hydrateIcons(this._root);
      document.getElementById('presence-widget-btn').addEventListener('click', () => { location.hash = '#/temps'; });
      return;
    }

    // Idle — mis en avant (fond clair) car c'est l'action que Tiphaine
    // veut pouvoir lancer de n'importe où dans l'appli.
    this._root.innerHTML = `
      <button id="presence-widget-btn" class="topbar-icon-btn topbar-icon-btn-accent" title="Commencer ma journée">
        <span class="topbar-icon-btn-svg" data-icon="play" data-icon-size="15"></span>
      </button>
    `;
    window.hydrateIcons(this._root);
    document.getElementById('presence-widget-btn').addEventListener('click', () => this.demarrer());
  },
};

document.addEventListener('DOMContentLoaded', () => window.PresenceWidget.init());

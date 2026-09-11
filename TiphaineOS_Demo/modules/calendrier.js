/* ═══════════════════════════════════════════════════════════
   MODULE CALENDRIER — le volet "vue d'ensemble" du cahier des charges
   d'origine (section 25) : "Un calendrier qui regroupe tout" —
   Commercial (RDV, relances), Production (deadlines projets), Clients
   (RDV, maintenances), Finance (échéances abonnements), Administratif
   (URSSAF, CFE, impôts, assurance). Créé le 04/09/2026, choisi par
   Tiphaine comme module V2 suivant (après Technique).

   Deux sources d'événements, combinées dans une seule grille :
   - AUTO : recalculés en direct depuis les autres modules (source de
     vérité = ces modules, jamais dupliqué en dur ici) — devis envoyés,
     projets démarrés, domaines/hébergements à échéance (Technique),
     interventions de maintenance (Technique), déclarations URSSAF /
     actualisation France Travail (Dashboard). Lecture seule, clic →
     navigue vers le module source.
   - MANUEL : RDV, CFE, impôts, assurance, tâches... rien dans l'app ne
     porte encore ces dates (pas de module RDV/fiscalité dédié) — un
     vrai CRUD (règle non négociable : tout paramétrable) permet de les
     ajouter directement sur le calendrier, catégorisés comme le reste.

   TODO Firebase pour la persistance des événements manuels
   (localStorage pour l'instant, même pattern que tous les autres
   modules).
═══════════════════════════════════════════════════════════ */

window.Modules = window.Modules || {};

window.Modules.calendrier = {
  _data: null, // événements manuels : [{id, date, categorie, titre, notes}]
  _moisAffiche: null, // Date, jour=1 — mois actuellement affiché

  _CATEGORIES: ['Commercial', 'Production', 'Clients', 'Finance', 'Administratif'],
  _COULEUR_CATEGORIE: {
    Commercial: '#378add',
    Production: '#e0a95c',
    Clients: '#6ec88c',
    Finance: '#a58fe0',
    Administratif: '#e05c5c',
  },

  async render(container) {
    if (!this._data) {
      this._data = window.FIREBASE_READY ? await this._fetchReal() : this._getData();
    }
    if (!this._moisAffiche) {
      const auj = new Date();
      this._moisAffiche = new Date(auj.getFullYear(), auj.getMonth(), 1);
    }
    this._root = container.closest('#content') || container;
    container.innerHTML = this._html();
    window.hydrateIcons(container);
    this._bindEvents(container);
  },

  // ── Persistance (localStorage tant que Firebase n'est pas branché) ──
  _getData() {
    try {
      const stocke = JSON.parse(localStorage.getItem('tos_calendrier_evenements') || 'null');
      if (Array.isArray(stocke)) return stocke;
    } catch (e) { /* ignore */ }
    return [];
  },
  _setData(data) {
    localStorage.setItem('tos_calendrier_evenements', JSON.stringify(data));
  },
  async _fetchReal() {
    // TODO Firebase : collection `calendrier_evenements`.
    return this._getData();
  },

  _pad(n) { return String(n).padStart(2, '0'); },
  _dateStr(d) { return `${d.getFullYear()}-${this._pad(d.getMonth() + 1)}-${this._pad(d.getDate())}`; },

  // ── Événements automatiques (lecture seule, recalculés à chaque rendu) ──
  _evenementsAuto() {
    const m = window.Modules;
    const evts = [];

    // Commercial — devis envoyés (date d'envoi, suivi du pipeline).
    if (m.devis) {
      if (!m.devis._data) m.devis._data = window.FIREBASE_READY ? [] : m.devis._mock();
      m.devis._data.forEach(d => {
        if (!d.date) return;
        evts.push({ date: d.date, categorie: 'Commercial', titre: `Devis envoyé - ${d.client}`, lienHash: '#/devis', auto: true });
      });
    }

    // Production — démarrage de chaque projet.
    if (m.projets) {
      if (!m.projets._data) m.projets._data = window.FIREBASE_READY ? [] : m.projets._mock();
      m.projets._data.forEach(p => {
        if (!p.dateDebut) return;
        evts.push({ date: p.dateDebut, categorie: 'Production', titre: `Début - ${p.nom}`, lienHash: '#/projets', auto: true });
      });
    }

    // Clients / Production — interventions de maintenance (Technique).
    if (m.technique) {
      if (!m.technique._data) m.technique._data = window.FIREBASE_READY ? m.technique._mock() : m.technique._getData();
      (m.technique._data.maintenance || []).forEach(mt => {
        if (!mt.date) return;
        evts.push({ date: mt.date, categorie: 'Clients', titre: `Maintenance - ${mt.client || 'Client non précisé'}`, lienHash: '#/technique', auto: true });
      });
      // Finance — domaines/hébergements à échéance (Technique).
      (m.technique._data.domaines || []).forEach(dm => {
        if (!dm.dateExpiration) return;
        evts.push({ date: dm.dateExpiration, categorie: 'Finance', titre: `Domaine - ${dm.nom} expire`, lienHash: '#/technique', auto: true });
      });
      (m.technique._data.hebergements || []).forEach(h => {
        if (!h.dateRenouvellement) return;
        evts.push({ date: h.dateRenouvellement, categorie: 'Finance', titre: `Hébergement - ${h.fournisseur} renouvellement`, lienHash: '#/technique', auto: true });
      });
    }

    // Administratif — URSSAF + actualisation France Travail (Dashboard).
    // Recalculé pour LE MOIS AFFICHÉ (`this._moisAffiche`), pas juste le
    // mois en cours — donc ces échéances doivent apparaître sur CHAQUE
    // mois consulté, sans limite (2026, 2027, 2028...), avec le mois
    // concerné explicite dans le texte (ex. "URSSAF — août 2026"). Les
    // règles réelles restent les mêmes que `dashboard._infosUrssaf()`/
    // `_infosActualisation()` (URSSAF : mois M déclarable du 1er au
    // dernier jour de M+1 ; France Travail : fenêtre 28→15) —
    // recalculées ici localement pour pouvoir les appliquer à n'importe
    // quel mois, passé ou futur.
    // 04/09/2026, retour de Tiphaine (deux allers-retours) : (1) rien ne
    // s'affichait en changeant de mois car tout était ancré sur
    // "aujourd'hui" — corrigé une première fois ; (2) masquer entièrement
    // un marqueur déjà validé faisait disparaître aussi l'astérisque —
    // "il faut vraiment rien oublier aucun mois". Les marqueurs ne sont
    // donc plus JAMAIS masqués : un événement déjà validé
    // (`_setDeclValidee`, Dashboard) reste affiché mais passe en état
    // "fait" (✓, couleur atténuée) au lieu de disparaître — toujours la
    // même source d'état que le Dashboard et Finances, une seule vérité,
    // mais l'affichage ne cache plus rien.
    if (m.dashboard) {
      const state = m.dashboard._getDeclState();
      const moisRef = this._moisAffiche || (() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); })();
      const an = moisRef.getFullYear(), moi = moisRef.getMonth();

      // URSSAF — rappel calé sur le mois affiché LUI-MÊME (M0), pas le
      // mois suivant (05/09/2026, choix explicite de Tiphaine après
      // comparaison avec son vrai calendrier URSSAF, capture d'écran de
      // son espace autoentrepreneur — voir DEV_NOTES). Le vrai relevé
      // réel a des échéances plus tardives et irrégulières (mois groupés
      // fin 2026, décalages week-end) ; plutôt que de coller au jour près
      // à ce relevé (qui bouge), la règle retenue est volontairement plus
      // stricte que nécessaire : pour le CA d'août, le rappel de clôture
      // tombe le 31/08 (fin du mois même, pas fin septembre) — jamais en
      // retard par rapport à la vraie échéance, quitte à se rappeler tôt.
      // Période déclarée = mois PRÉCÉDENT le mois affiché, échéance =
      // dernier jour du mois affiché (11/09/2026, correction de Tiphaine —
      // voir TiphaineOS/modules/calendrier.js pour le détail).
      const moisPrecedentUrssaf = new Date(an, moi - 1, 1);
      const periodeUrssaf = `${moisPrecedentUrssaf.getFullYear()}-${this._pad(moisPrecedentUrssaf.getMonth() + 1)}`;
      const ouvertureUrssaf = new Date(an, moi, 1);
      const fermetureUrssaf = new Date(an, moi + 1, 0);
      const uValidee = !!(state[periodeUrssaf] && state[periodeUrssaf].urssaf);
      {
        const labelMois = m.dashboard._moisLabel(periodeUrssaf);
        const labelFermeture = m.dashboard._dateLabel(fermetureUrssaf);
        const validerUrssaf = { periode: periodeUrssaf, kind: 'urssaf' };
        const prefixe = uValidee ? '✓ ' : '';
        evts.push({
          date: this._dateStr(ouvertureUrssaf), categorie: 'Administratif',
          titre: `${prefixe}URSSAF - ${labelMois} (avant le ${labelFermeture})`,
          note: uValidee ? `* Déjà déclaré.` : `* Déclarable du 1er au ${labelFermeture}.`,
          lienHash: '#/dashboard', auto: true, valider: validerUrssaf, validee: uValidee,
        });
        evts.push({ date: this._dateStr(ouvertureUrssaf), categorie: 'Administratif', titre: `${prefixe}Ouverture URSSAF - ${labelMois}`, leger: true, lienHash: '#/dashboard', auto: true, valider: validerUrssaf, validee: uValidee });
        evts.push({ date: this._dateStr(fermetureUrssaf), categorie: 'Administratif', titre: `${prefixe}Fermeture URSSAF - ${labelMois} (dernier délai)`, leger: true, lienHash: '#/dashboard', auto: true, valider: validerUrssaf, validee: uValidee });
      }

      // France Travail — deux fenêtres peuvent toucher le mois affiché :
      // celle qui SE FERME ce mois-ci (ouverte le 28 du mois précédent,
      // affichée en pavé groupé le 1er comme avant) et celle qui S'OUVRE
      // ce mois-ci (fermeture le 15 du mois suivant, repère léger
      // seulement — son pavé groupé apparaîtra le mois suivant).
      const fenetreQuiFerme = { ouverture: new Date(an, moi - 1, 28), fermeture: new Date(an, moi, 15) };
      const fenetreQuiOuvre = { ouverture: new Date(an, moi, 28), fermeture: new Date(an, moi + 1, 15) };

      const periodeFenetre = (f) => `${f.ouverture.getFullYear()}-${this._pad(f.ouverture.getMonth() + 1)}`;
      const pF = periodeFenetre(fenetreQuiFerme);
      const fFValidee = !!(state[pF] && state[pF].pole_emploi);
      {
        const labelMois = m.dashboard._moisLabel(pF);
        const labelOuverture = m.dashboard._dateLabel(fenetreQuiFerme.ouverture);
        const labelFermeture = m.dashboard._dateLabel(fenetreQuiFerme.fermeture);
        const validerFF = { periode: pF, kind: 'pole_emploi' };
        const prefixe = fFValidee ? '✓ ' : '';
        evts.push({
          date: this._dateStr(ouvertureUrssaf), categorie: 'Administratif',
          titre: `${prefixe}Actualisation France Travail - ${labelMois} (avant le ${labelFermeture})`,
          note: fFValidee ? `* Déjà actualisé.` : `* Fenêtre réelle : du ${labelOuverture} au ${labelFermeture} à minuit. Affiché ici le 1er par simplicité.`,
          lienHash: '#/dashboard', auto: true, valider: validerFF, validee: fFValidee,
        });
        evts.push({ date: this._dateStr(fenetreQuiFerme.fermeture), categorie: 'Administratif', titre: `${prefixe}Fermeture France Travail - ${labelMois} (minuit)`, leger: true, lienHash: '#/dashboard', auto: true, valider: validerFF, validee: fFValidee });
      }

      const pO = periodeFenetre(fenetreQuiOuvre);
      const fOValidee = !!(state[pO] && state[pO].pole_emploi);
      {
        const labelMois = m.dashboard._moisLabel(pO);
        const prefixe = fOValidee ? '✓ ' : '';
        evts.push({ date: this._dateStr(fenetreQuiOuvre.ouverture), categorie: 'Administratif', titre: `${prefixe}Ouverture France Travail - ${labelMois}`, leger: true, lienHash: '#/dashboard', auto: true, valider: { periode: pO, kind: 'pole_emploi' }, validee: fOValidee });
      }
    }

    evts.push(...this._evenementsCfe());
    evts.push(...this._evenementsImpotRevenu());

    return evts;
  },

  // Déclaration de revenus annuelle (impôt sur le revenu, 04/09/2026) —
  // le CA d'une AE n'est pas un impôt à part, il s'ajoute chaque
  // printemps à la déclaration de revenus classique (2042-C-PRO,
  // case micro-BIC). Récurrent chaque année à partir de l'année qui
  // suit la création (le tout premier CA de Tiphaine, encaissé entre le
  // 15/08 et le 31/12/2026, se déclare au printemps 2027 — pas avant).
  // Zone/date limite déduites du département dans l'adresse
  // (Paramétrage > Général) — Nîmes (30) = zone 2. Dates 2026
  // (déclaration des revenus 2025) vérifiées par recherche web :
  // zone 1 (dépt 01-19) 23 mai, zone 2 (dépt 20-54) 30 mai, zone 3
  // (dépt 55-976 + non-résidents) 6 juin — réutilisées comme
  // approximation les années suivantes (la date exacte n'est annoncée
  // par la DGFiP que quelques semaines avant chaque printemps, et varie
  // de quelques jours d'une année sur l'autre), toujours signalé comme
  // approximatif dans le texte plutôt que présenté comme certain.
  _evenementsImpotRevenu() {
    const m = window.Modules;
    if (!m.dashboard || !m.catalogue) return [];
    const e = m.catalogue._getEntreprise();
    if (!e.dateCreationEntreprise) return [];
    const creation = new Date(e.dateCreationEntreprise);
    if (isNaN(creation.getTime())) return [];
    const anneeCreation = creation.getFullYear();
    const moisRef = this._moisAffiche || new Date();
    const annee = moisRef.getFullYear(); // année où la déclaration a lieu
    if (annee <= anneeCreation) return []; // rien à déclarer avant l'année suivant la création

    const anneeRevenus = annee - 1;
    const state = m.dashboard._getDeclState();
    const periode = String(anneeRevenus);

    const cp = (e.adresse || '').match(/\b(\d{5})\b/);
    const dept = cp ? parseInt(cp[1].slice(0, 2), 10) : 30;
    let jourLimite = 30, moisLimite = 4, zoneLabel = 'zone 2 (départements 20 à 54)'; // défaut Nîmes/Gard
    if (dept >= 1 && dept <= 19) { jourLimite = 23; moisLimite = 4; zoneLabel = 'zone 1 (départements 01 à 19)'; }
    else if (dept >= 55) { jourLimite = 6; moisLimite = 5; zoneLabel = 'zone 3 (départements 55 à 976, non-résidents)'; }

    const dateLimite = new Date(annee, moisLimite, jourLimite);
    const dateOuverture = new Date(annee, 3, 10); // service en ligne, généralement début avril

    const validee = !!(state[periode] && state[periode].impot_revenu);
    const prefixe = validee ? '✓ ' : '';
    const valider = { periode, kind: 'impot_revenu' };
    const labelLimite = dateLimite.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

    return [
      {
        date: this._dateStr(dateOuverture), categorie: 'Administratif',
        titre: `${prefixe}Déclaration de revenus - CA ${anneeRevenus} (avant le ${labelLimite} approx.)`,
        note: `* Déclare le CA encaissé en ${anneeRevenus} (formulaire 2042-C-PRO, ajouté à ta déclaration de revenus classique). Service en ligne ouvert généralement début avril. Date limite indicative (${zoneLabel}) - à confirmer sur impots.gouv.fr, elle varie de quelques jours chaque année.`,
        lienHash: '#/finances', auto: true, valider, validee,
      },
      { date: this._dateStr(dateOuverture), categorie: 'Administratif', titre: `${prefixe}Ouverture déclaration revenus - CA ${anneeRevenus}`, leger: true, lienHash: '#/finances', auto: true, valider, validee },
      { date: this._dateStr(dateLimite), categorie: 'Administratif', titre: `${prefixe}Date limite déclaration revenus - CA ${anneeRevenus} (approx.)`, leger: true, lienHash: '#/finances', auto: true, valider, validee },
    ];
  },

  // CFE (Cotisation Foncière des Entreprises, 04/09/2026, corrigé le
  // même jour) — impôt local annuel, distinct de l'URSSAF/France
  // Travail (Trésor Public, pas Dashboard). Recherché en détail après
  // une question de Tiphaine ("ça ouvre quand ?") : PAS de vraie
  // "déclaration" à refaire chaque année pour la plupart des micro-
  // entrepreneurs — seulement :
  // 1. L'année de création : déclaration INITIALE obligatoire
  //    (formulaire 1447-C-SD) avant le 31 décembre, même si exonérée.
  // 2. Chaque année suivante, SEULEMENT en cas de changement (nouveau
  //    local, changement de surface, changement d'activité...) :
  //    déclaration MODIFICATIVE (formulaire 1447-M-SD), avant le 2e
  //    jour ouvré suivant le 1er mai — approximé ici au 2 mai (le calcul
  //    exact du jour ouvré nécessiterait un calendrier des jours fériés,
  //    pas fait pour l'instant). Rien à faire si rien n'a changé — pas
  //    possible de le détecter automatiquement, donc affiché en simple
  //    repère léger conditionnel plutôt qu'en pavé "à faire" alarmant.
  // 3. Le paiement lui-même, chaque année, à partir de l'avis reçu
  //    automatiquement (pas une déclaration active) : acompte de 50% le
  //    15 juin SEULEMENT si la CFE de l'année précédente dépassait
  //    3000€ (`cfeMontantAnnuel`), puis solde le 15 décembre — ce sont
  //    les deux vraies échéances récurrentes et certaines.
  // Sources : dougs.fr, keobiz.fr, impots.gouv.fr (déclaration CFE 2026).
  // Même mécanique de validation que URSSAF/France Travail
  // (`dashboard._getDeclState()`/`_setDeclValidee`, périodes = année).
  _evenementsCfe() {
    const m = window.Modules;
    if (!m.dashboard || !m.catalogue) return [];
    const e = m.catalogue._getEntreprise();
    if (!e.dateCreationEntreprise) return [];
    const creation = new Date(e.dateCreationEntreprise);
    if (isNaN(creation.getTime())) return [];

    const state = m.dashboard._getDeclState();
    const anneeCreation = creation.getFullYear();
    const moisRef = this._moisAffiche || new Date();
    const annee = moisRef.getFullYear();
    const evts = [];

    const pousser = (date, periode, kind, label, leger) => {
      const validee = !!(state[periode] && state[periode][kind]);
      const prefixe = validee ? '✓ ' : '';
      evts.push({
        date: this._dateStr(date), categorie: 'Administratif',
        titre: `${prefixe}${label}`, leger: !!leger,
        lienHash: '#/parametrage', auto: true,
        valider: { periode, kind }, validee,
      });
    };

    // Déclaration initiale — uniquement l'année de création elle-même.
    if (annee === anneeCreation) {
      pousser(new Date(anneeCreation, 11, 31), String(anneeCreation), 'cfe_declaration_initiale', `Déclaration initiale CFE - ${anneeCreation} (formulaire 1447-C-SD)`);
    }

    // Chaque année suivant la création, sans fin.
    if (annee > anneeCreation) {
      const periode = String(annee);
      // Repère léger, conditionnel — seulement si changement de local/
      // activité cette année. Pas un vrai "à faire" par défaut.
      pousser(new Date(annee, 4, 2), periode, 'cfe_declaration_modificative', `Déclaration CFE modificative - ${annee} (si changement de local/activité, avant le 2e jour ouvré après le 1er mai)`, true);
      if (e.cfeMontantAnnuel && e.cfeMontantAnnuel > 3000) {
        pousser(new Date(annee, 5, 15), periode, 'cfe_acompte', `Acompte CFE - ${annee} (50%, avant le 15 juin)`);
      }
      pousser(new Date(annee, 11, 15), periode, 'cfe_paiement', `Solde CFE - ${annee} (avant le 15 décembre - vérifier d'abord l'exonération si CA ≤ 5000€)`);
    }

    return evts;
  },

  _tousEvenements() {
    return [...this._evenementsAuto(), ...this._data.map(e => ({ ...e, auto: false }))];
  },

  _evenementsDuJour(dateStr) {
    return this._tousEvenements().filter(e => e.date === dateStr);
  },

  // ── Rendu ─────────────────────────────────────────────────────────
  _html() {
    const mois = this._moisAffiche;
    const nomMois = mois.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return `
      <div class="page-header-row">
        <div>
          <div class="page-title"><span class="nav-icon" data-icon="calendar"></span>Calendrier</div>
          <div class="page-sub">Commercial, production, clients, finance, administratif - tout au même endroit.</div>
        </div>
        <div class="page-header-actions">
          <button class="btn" id="add-evenement-btn">+ Nouvel événement</button>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px;">
        <div style="display:flex; flex-wrap:wrap; gap:12px;">
          ${this._CATEGORIES.map(c => `<span style="display:flex; align-items:center; gap:6px; font-size:12px; color:var(--text-secondary);"><span style="width:9px; height:9px; border-radius:50%; background:${this._COULEUR_CATEGORIE[c]}; display:inline-block;"></span>${c}</span>`).join('')}
        </div>
      </div>

      ${this._htmlEcheancesAdmin(mois)}

      <div class="card">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:14px;">
          <button type="button" class="btn-ghost" data-nav-mois="-1">‹</button>
          <div id="calendrier-mois-label" style="font-weight:600; text-transform:capitalize; font-size:15px; cursor:pointer;" title="Choisir un mois">${nomMois}</div>
          <div style="display:flex; gap:8px;">
            <button type="button" class="btn-ghost" data-nav-mois="0">Aujourd'hui</button>
            <button type="button" class="btn-ghost" data-nav-mois="1">›</button>
          </div>
        </div>
        ${this._htmlGrille(mois)}
      </div>
    `;
  },

  // Carte "état des déclarations" pour le mois affiché — toujours
  // visible même si une déclaration est déjà validée (donc masquée dans
  // la grille), pour que Tiphaine puisse voir/annuler d'un coup d'œil
  // sans deviner pourquoi un marqueur a disparu (04/09/2026, retour :
  // "pourquoi y'a rien pour octobre ?" — une déclaration déjà validée
  // disparaît normalement de la grille, mais rien ne permettait de le
  // vérifier ni de revenir en arrière depuis le Calendrier lui-même).
  _htmlEcheancesAdmin(mois) {
    const dashboard = window.Modules.dashboard;
    if (!dashboard) return '';
    const state = dashboard._getDeclState();
    const an = mois.getFullYear(), moi = mois.getMonth();

    // URSSAF — période = le mois précédent le mois affiché (11/09/2026).
    const moisPrecedentUrssafCard = new Date(an, moi - 1, 1);
    const periodeUrssaf = `${moisPrecedentUrssafCard.getFullYear()}-${this._pad(moisPrecedentUrssafCard.getMonth() + 1)}`;
    const uValidee = !!(state[periodeUrssaf] && state[periodeUrssaf].urssaf);

    // Seule la fenêtre France Travail qui SE FERME ce mois-ci (ouverte le
    // 28 du mois précédent, deadline le 15 de ce mois) est vraiment "à
    // traiter" pendant le mois affiché — la fenêtre qui s'ouvre ce
    // mois-ci (deadline le 15 du mois suivant) n'est pas encore due,
    // elle apparaîtra ici le mois prochain. Retiré de cette carte sur
    // demande de Tiphaine (04/09/2026, "mettre que ceux concernés") —
    // reste visible dans la grille via l'astérisque d'ouverture du 28.
    const pF = `${new Date(an, moi - 1, 28).getFullYear()}-${this._pad(new Date(an, moi - 1, 28).getMonth() + 1)}`;
    const fFValidee = !!(state[pF] && state[pF].pole_emploi);

    // 07/09/2026, retour "y'a un retour à la ligne dégueu" (le bouton
    // "Marquer fait" cassait en 2 lignes à côté d'un libellé long comme
    // "Actualisation France Travail - août 2026") + "réduis le texte" :
    // bouton raccourci à "✓ Fait" (tient toujours sur une ligne, avec
    // `white-space:nowrap` en filet de sécurité) et libellé en police
    // légèrement réduite (13px → 12px).
    const ligne = (label, periode, kind, validee) => `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:7px 0; border-top:1px solid var(--border-subtle);">
        <span style="font-size:12px; color:${validee ? 'var(--text-muted)' : 'var(--text-primary)'};">${validee ? '✓ ' : ''}${label} - ${dashboard._moisLabel(periode)}</span>
        <button type="button" class="btn-ghost" style="white-space:nowrap; flex-shrink:0;" data-toggle-declaration="${periode}|${kind}|${validee ? '0' : '1'}">${validee ? 'Annuler' : '✓ Fait'}</button>
      </div>
    `;

    // CFE — dates fixes (pas "mois précédent" comme URSSAF), donc on ne
    // montre ici que les échéances CFE qui tombent réellement CE mois-ci
    // (mai/juin/décembre selon le cas) plutôt que de refaire le calcul
    // annuel complet — même logique "que ceux concernés" que le reste de
    // la carte.
    const lignesCfe = this._evenementsCfe()
      .filter(ev => ev.date.startsWith(`${an}-${this._pad(moi + 1)}`))
      .map(ev => `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:7px 0; border-top:1px solid var(--border-subtle);">
          <span style="font-size:12px; color:${ev.validee ? 'var(--text-muted)' : 'var(--text-primary)'};">${ev.titre}</span>
          <button type="button" class="btn-ghost" style="white-space:nowrap; flex-shrink:0;" data-toggle-declaration="${ev.valider.periode}|${ev.valider.kind}|${ev.validee ? '0' : '1'}">${ev.validee ? 'Annuler' : '✓ Fait'}</button>
        </div>
      `).join('');

    // Déclaration de revenus — seule la ligne principale (pas les
    // repères légers ouverture/fermeture, qui pointent vers le même
    // jour que le pavé principal en avril et feraient doublon ici).
    const lignesImpot = this._evenementsImpotRevenu()
      .filter(ev => !ev.leger && ev.date.startsWith(`${an}-${this._pad(moi + 1)}`))
      .map(ev => `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:7px 0; border-top:1px solid var(--border-subtle);">
          <span style="font-size:12px; color:${ev.validee ? 'var(--text-muted)' : 'var(--text-primary)'};">${ev.titre}</span>
          <button type="button" class="btn-ghost" style="white-space:nowrap; flex-shrink:0;" data-toggle-declaration="${ev.valider.periode}|${ev.valider.kind}|${ev.validee ? '0' : '1'}">${ev.validee ? 'Annuler' : '✓ Fait'}</button>
        </div>
      `).join('');

    return `
      <div class="card" style="margin-bottom:16px;">
        <div class="section-title" style="margin-bottom:6px; text-align:center;">État des déclarations - ${mois.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</div>
        ${ligne('URSSAF', periodeUrssaf, 'urssaf', uValidee)}
        ${ligne('Actualisation France Travail', pF, 'pole_emploi', fFValidee)}
        ${lignesCfe}
        ${lignesImpot}
      </div>
    `;
  },

  _htmlGrille(mois) {
    // 07/09/2026, retour "réduit un peu pour qu'on voit URSSAF en
    // entier et la deuxième puce" — sur mobile, le pavé affichait la
    // phrase complète ("URSSAF - 2026-09 (avant le 30/09/2026)") tronquée
    // après 2 caractères faute de place. Sur mobile uniquement, seul le
    // premier segment du titre (avant " - ") est affiché dans le pavé —
    // "URSSAF" au lieu de la phrase entière, le texte complet reste dans
    // l'attribut `title` et surtout dans la fiche du jour au clic.
    const esMobile = window.innerWidth <= 880;
    const an = mois.getFullYear(), m = mois.getMonth();
    const premierJourSemaine = (new Date(an, m, 1).getDay() + 6) % 7; // lundi=0
    const nbJoursMois = new Date(an, m + 1, 0).getDate();
    const nbJoursMoisPrecedent = new Date(an, m, 0).getDate();
    const aujStr = this._dateStr(new Date());

    const cases = [];
    for (let i = 0; i < premierJourSemaine; i++) {
      cases.push({ jour: nbJoursMoisPrecedent - premierJourSemaine + i + 1, horsMois: true, dateStr: null });
    }
    for (let j = 1; j <= nbJoursMois; j++) {
      cases.push({ jour: j, horsMois: false, dateStr: `${an}-${this._pad(m + 1)}-${this._pad(j)}` });
    }
    while (cases.length % 7 !== 0) {
      const j = cases.length - (premierJourSemaine + nbJoursMois) + 1;
      cases.push({ jour: j, horsMois: true, dateStr: null });
    }

    const joursLabels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

    return `
      <div class="calendrier-entete-jours">
        ${joursLabels.map(j => `<div class="calendrier-jour-label">${j}</div>`).join('')}
      </div>
      <div class="calendrier-grille">
        ${cases.map(c => {
          if (c.horsMois) return `<div class="calendrier-jour calendrier-jour-hors-mois"><div class="calendrier-jour-numero">${c.jour}</div></div>`;
          const tousEvts = this._evenementsDuJour(c.dateStr);
          // Repères légers (astérisque, 04/09/2026) rendus à part — un
          // petit repère discret plutôt qu'un pavé de couleur, pour ne
          // pas se battre avec les vrais événements pour les 3 places
          // disponibles dans la case.
          const evts = tousEvts.filter(e => !e.leger);
          const evtsLegers = tousEvts.filter(e => e.leger);
          const estAuj = c.dateStr === aujStr;
          // Ordre d'affichage (07/09/2026, retour "mets ursaff avant
          // ouverture pour qu'on voit au premier coup d'œil") : les VRAIS
          // événements (pavés colorés — l'échéance elle-même, ex. "URSSAF
          // - septembre 2026") passent AVANT les repères légers en
          // astérisque (juste un rappel d'ouverture/fermeture de fenêtre,
          // info secondaire) — avant, l'astérisque collé au numéro du
          // jour s'affichait en premier et prenait toute l'attention.
          //
          // 07/09/2026, retour SUIVANT ("on voit rien") : les puces de
          // couleur seules (essai précédent, sans texte) ne disaient pas
          // CE QUI se passait — juste "il se passe un truc administratif",
          // ni plus ni moins lisible qu'avant. Remplacées par le VRAI
          // pavé texte, tronqué en une ligne (ellipse CSS) — un mot comme
          // "URSSAF" ou "Actualisation Fr…" reste lisible même minuscule
          // et coupé, alors qu'un point de couleur ne l'est jamais. Sur
          // mobile, un seul pavé (le plus important) au lieu de 3, et les
          // repères légers passent en italique tout en bas plutôt que
          // d'être masqués — toujours dispo, juste discrets.
          //
          // 07/09/2026, retour SUIVANT (style FamilyWall demandé par
          // Tiphaine) : même tronqué, le texte des repères légers
          // ("* Ouverture URSSAF - ...", en jaune/orange) prenait de la
          // place et faisait doublon avec le vrai pavé juste au-dessus
          // (même échéance, l'ouverture ET l'échéance elle-même). Le
          // texte disparaît complètement de la case — remplacé par un
          // simple astérisque orange à droite du numéro du jour (repère
          // minimal, esprit FamilyWall). Le texte complet apparaît en
          // haut de la fiche du jour au clic, dans la même couleur
          // (voir `_htmlJour`) — rien n'est perdu, juste déplacé.
          const legersNonFaits = evtsLegers.some(e => !e.validee);
          return `
            <div class="calendrier-jour ${estAuj ? 'calendrier-jour-aujourdhui' : ''}" data-jour="${c.dateStr}">
              <div class="calendrier-jour-numero">${c.jour}${evtsLegers.length ? `<span class="calendrier-jour-astx ${legersNonFaits ? '' : 'calendrier-jour-astx-fait'}" title="${evtsLegers.map(e => e.titre.replace(/^\*\s*/, '')).join(' · ')}">*</span>` : ''}</div>
              ${evts.slice(0, 3).map(e => {
                const label = esMobile ? e.titre.split(' - ')[0] : e.titre;
                const couleurs = e.validee ? 'background:var(--bg-input); color:var(--text-muted);' : `background:${this._COULEUR_CATEGORIE[e.categorie]}22; color:${this._COULEUR_CATEGORIE[e.categorie]};`;
                return `<div class="calendrier-evt-pill" style="${couleurs}" title="${e.titre}">${label}</div>`;
              }).join('')}
              ${(() => {
                // "+N" (07/09/2026, "il faudrait un marqueur quand y'a
                // plus de puces") : nombre de pavés VRAIMENT affichés —
                // 2 sur mobile (voir CSS, seuls les 2 premiers restent
                // visibles), 3 sur desktop. Sans ce calcul spécifique,
                // le badge comptait toujours à partir de 3 et se
                // trompait sur mobile (ex. 3 événements → +0, invisible,
                // alors qu'un seul est vraiment caché).
                const affiches = esMobile ? 2 : 3;
                return evts.length > affiches ? `<div class="calendrier-evt-plus">+${evts.length - affiches}</div>` : '';
              })()}
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  // ── Modal "choisir un mois" (clic sur le libellé du mois) ────────
  _MOIS_LABELS: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'],

  _htmlPickerMois(annee) {
    const moisAffiche = this._moisAffiche;
    return `
      <div class="modal-overlay" id="calendrier-picker-overlay">
        <div class="modal-box" style="max-width:340px;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
            <button type="button" class="btn-ghost" data-picker-annee="-1">‹</button>
            <div style="font-weight:600; font-size:16px;">${annee}</div>
            <button type="button" class="btn-ghost" data-picker-annee="1">›</button>
          </div>
          <div class="calendrier-picker-grille">
            ${this._MOIS_LABELS.map((label, i) => {
              const estMoisAffiche = annee === moisAffiche.getFullYear() && i === moisAffiche.getMonth();
              return `<button type="button" class="calendrier-picker-mois ${estMoisAffiche ? 'calendrier-picker-mois-actif' : ''}" data-picker-mois="${i}">${label}</button>`;
            }).join('')}
          </div>
          <div class="modal-actions" style="margin-top:16px;">
            <span></span>
            <div class="modal-actions-right">
              <button type="button" class="btn-ghost" id="calendrier-picker-close">Fermer</button>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  _ouvrirPickerMois() {
    let anneeAffichee = this._moisAffiche.getFullYear();

    const rendre = () => {
      const ancien = document.getElementById('calendrier-picker-overlay');
      if (ancien) ancien.remove();
      const wrap = document.createElement('div');
      wrap.innerHTML = this._htmlPickerMois(anneeAffichee);
      document.body.appendChild(wrap.firstElementChild);
      const overlay = document.getElementById('calendrier-picker-overlay');

      let mousedownSurOverlay = false;
      overlay.addEventListener('mousedown', (e) => { mousedownSurOverlay = (e.target === overlay); });
      overlay.addEventListener('click', (e) => { if (e.target === overlay && mousedownSurOverlay) overlay.remove(); });
      document.getElementById('calendrier-picker-close').addEventListener('click', () => overlay.remove());

      overlay.querySelectorAll('[data-picker-annee]').forEach(btn => {
        btn.addEventListener('click', () => {
          anneeAffichee += Number(btn.dataset.pickerAnnee);
          rendre();
        });
      });
      overlay.querySelectorAll('[data-picker-mois]').forEach(btn => {
        btn.addEventListener('click', () => {
          this._moisAffiche = new Date(anneeAffichee, Number(btn.dataset.pickerMois), 1);
          overlay.remove();
          this.render(this._root);
        });
      });
    };

    rendre();
  },

  // ── Modal "jour" (liste des événements + ajout) ─────────────────
  // Repères légers en tête, en orange (07/09/2026, "style FamilyWall" —
  // demande de Tiphaine) : la grille ne montre plus le texte complet
  // des repères légers ("* Ouverture URSSAF - ...") dans la case, juste
  // un petit astérisque orange à côté du numéro (voir `_htmlGrille`) —
  // le texte complet apparaît ici, en haut de la fiche du jour, dans la
  // même couleur orange que l'astérisque, avant la liste normale des
  // événements.
  _htmlJour(dateStr) {
    const tousEvts = this._evenementsDuJour(dateStr);
    const evtsLegers = tousEvts.filter(e => e.leger);
    const evts = tousEvts.filter(e => !e.leger);
    const dateLabel = new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return `
      <div class="modal-overlay" id="calendrier-jour-overlay">
        <div class="modal-box">
          <div class="modal-title" style="text-transform:capitalize;">${dateLabel}</div>
          ${evtsLegers.length ? `
            <div style="margin-bottom:10px;">
              ${evtsLegers.map(e => `<div style="font-size:12.5px; font-style:italic; color:${e.validee ? 'var(--text-muted)' : '#e0a95c'};">* ${e.titre.replace(/^\*\s*/, '')}</div>`).join('')}
            </div>
          ` : ''}
          ${evts.length ? evts.map(e => `
            <div style="display:flex; align-items:center; gap:10px; padding:8px 0; border-top:1px solid var(--border-subtle);">
              <span style="width:9px; height:9px; border-radius:50%; background:${this._COULEUR_CATEGORIE[e.categorie]}; flex-shrink:0;"></span>
              <div style="flex:1;">
                <div style="font-size:13.5px;">${e.titre}</div>
                ${e.notes ? `<div style="font-size:12px; color:var(--text-muted);">${e.notes}</div>` : ''}
                ${e.note ? `<div style="font-size:11.5px; color:var(--text-muted); font-style:italic; margin-top:2px;">${e.note}</div>` : ''}
              </div>
              ${e.valider ? `<button type="button" class="btn-ghost" data-valider-declaration="${e.valider.periode}|${e.valider.kind}|${e.validee ? '0' : '1'}" title="${e.validee ? 'Annuler la validation' : 'Marquer cette déclaration comme faite'}">${e.validee ? '↺ Annuler' : '✓ Fait'}</button>` : ''}
              ${e.auto
                ? `<button type="button" class="btn-ghost" data-aller-vers="${e.lienHash}">Voir</button>`
                : `<button type="button" class="row-delete-btn" data-supprimer-evenement="${e.id}" title="Supprimer">✕</button>`}
            </div>
          `).join('') : (!evtsLegers.length ? `<div style="color:var(--text-muted); font-size:13px; padding:8px 0;">Rien de prévu ce jour.</div>` : '')}
          <div class="modal-actions" style="margin-top:16px;">
            <span></span>
            <div class="modal-actions-right">
              <button type="button" class="btn-ghost" id="calendrier-jour-close">Fermer</button>
              <button type="button" class="btn" id="calendrier-jour-ajouter">+ Ajouter ici</button>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  _formEvenement(item, dateDefaut) {
    const isEdit = !!item;
    item = item || { date: dateDefaut || this._dateStr(new Date()), categorie: this._CATEGORIES[0], titre: '', notes: '' };
    return `
      <div class="modal-overlay" id="calendrier-form-overlay">
        <div class="modal-box">
          <div class="modal-title">${isEdit ? "Modifier l'événement" : 'Nouvel événement'}</div>
          <form id="calendrier-form">
            <div class="modal-field"><label>Titre</label><input type="text" name="titre" value="${item.titre}" placeholder="ex : RDV client, CFE, impôts, assurance..." required autofocus></div>
            <div style="display:flex; gap:14px;">
              <div class="modal-field" style="flex:1;"><label>Date</label><input type="date" name="date" value="${item.date}" required></div>
              <div class="modal-field" style="flex:1;"><label>Catégorie</label>
                <select name="categorie">
                  ${this._CATEGORIES.map(c => `<option value="${c}" ${c === item.categorie ? 'selected' : ''}>${c}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="modal-field"><label>Notes (optionnel)</label><textarea name="notes">${item.notes || ''}</textarea></div>
            <div class="modal-actions">
              ${isEdit ? `<button type="button" class="btn btn-danger" id="calendrier-delete-btn">Supprimer</button>` : `<span></span>`}
              <div class="modal-actions-right">
                <button type="button" class="btn btn-ghost" id="calendrier-cancel-btn">Annuler</button>
                <button type="submit" class="btn">${isEdit ? 'Enregistrer' : 'Ajouter'}</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  _ouvrirFormulaire(item, dateDefaut) {
    const wrap = document.createElement('div');
    wrap.innerHTML = this._formEvenement(item, dateDefaut);
    document.body.appendChild(wrap.firstElementChild);
    const overlay = document.getElementById('calendrier-form-overlay');
    const close = () => overlay.remove();

    let mousedownSurOverlay = false;
    overlay.addEventListener('mousedown', (e) => { mousedownSurOverlay = (e.target === overlay); });
    overlay.addEventListener('click', (e) => { if (e.target === overlay && mousedownSurOverlay) close(); });
    document.getElementById('calendrier-cancel-btn').addEventListener('click', close);

    const deleteBtn = document.getElementById('calendrier-delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        window.confirmerAction('Supprimer cet événement ?', () => {
          this._data = this._data.filter(x => x.id !== item.id);
          this._setData(this._data);
          close();
          document.getElementById('calendrier-jour-overlay')?.remove();
          this.render(this._root);
        });
      });
    }

    document.getElementById('calendrier-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = {
        titre: fd.get('titre').trim(),
        date: fd.get('date'),
        categorie: fd.get('categorie'),
        notes: fd.get('notes').trim(),
      };
      if (!payload.titre || !payload.date) return;

      if (item) {
        Object.assign(item, payload);
      } else {
        this._data.push({ id: Date.now(), ...payload });
      }
      this._setData(this._data);
      close();
      document.getElementById('calendrier-jour-overlay')?.remove();
      this.render(this._root);
    });
  },

  _ouvrirJour(dateStr) {
    const wrap = document.createElement('div');
    wrap.innerHTML = this._htmlJour(dateStr);
    document.body.appendChild(wrap.firstElementChild);
    const overlay = document.getElementById('calendrier-jour-overlay');
    const close = () => overlay.remove();

    let mousedownSurOverlay = false;
    overlay.addEventListener('mousedown', (e) => { mousedownSurOverlay = (e.target === overlay); });
    overlay.addEventListener('click', (e) => { if (e.target === overlay && mousedownSurOverlay) close(); });
    document.getElementById('calendrier-jour-close').addEventListener('click', close);
    document.getElementById('calendrier-jour-ajouter').addEventListener('click', () => this._ouvrirFormulaire(null, dateStr));

    overlay.querySelectorAll('[data-aller-vers]').forEach(btn => {
      btn.addEventListener('click', () => { close(); location.hash = btn.dataset.allerVers; });
    });
    overlay.querySelectorAll('[data-valider-declaration]').forEach(btn => {
      btn.addEventListener('click', () => {
        const [periode, kind, val] = btn.dataset.validerDeclaration.split('|');
        const dashboard = window.Modules.dashboard;
        if (!dashboard) return;
        dashboard._setDeclValidee(periode, kind, val === '1');
        close();
        this.render(this._root);
      });
    });
    overlay.querySelectorAll('[data-supprimer-evenement]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.supprimerEvenement);
        window.confirmerAction('Supprimer cet événement ?', () => {
          this._data = this._data.filter(x => x.id !== id);
          this._setData(this._data);
          close();
          this.render(this._root);
        });
      });
    });
  },

  _bindEvents(container) {
    container.querySelectorAll('[data-nav-mois]').forEach(btn => {
      btn.addEventListener('click', () => {
        const delta = Number(btn.dataset.navMois);
        if (delta === 0) {
          const auj = new Date();
          this._moisAffiche = new Date(auj.getFullYear(), auj.getMonth(), 1);
        } else {
          this._moisAffiche = new Date(this._moisAffiche.getFullYear(), this._moisAffiche.getMonth() + delta, 1);
        }
        this.render(this._root);
      });
    });

    container.querySelectorAll('[data-toggle-declaration]').forEach(btn => {
      btn.addEventListener('click', () => {
        const [periode, kind, val] = btn.dataset.toggleDeclaration.split('|');
        const dashboard = window.Modules.dashboard;
        if (!dashboard) return;
        dashboard._setDeclValidee(periode, kind, val === '1');
        this.render(this._root);
      });
    });

    const moisLabel = container.querySelector('#calendrier-mois-label');
    if (moisLabel) moisLabel.addEventListener('click', () => this._ouvrirPickerMois());

    const addBtn = container.querySelector('#add-evenement-btn');
    if (addBtn) addBtn.addEventListener('click', () => this._ouvrirFormulaire(null, this._dateStr(new Date())));

    container.querySelectorAll('[data-jour]').forEach(cell => {
      cell.addEventListener('click', () => this._ouvrirJour(cell.dataset.jour));
    });
  },
};

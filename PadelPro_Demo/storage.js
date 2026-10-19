'use strict';

/* ═══════════════════════════════════════════════════════════════
   STORAGE — Couche de persistance 100% locale (localStorage)

   Aucun réseau, aucun Firebase : toutes les données restent dans le
   navigateur, sur cet appareil. Un seul fichier HTML (index.html),
   pas de serveur, pas de configuration — s'ouvre directement en
   double-cliquant dessus, exactement comme les autres appli.

   Au tout premier lancement (aucune donnée en localStorage), un
   tournoi d'exemple est généré automatiquement (voir _seedDemoData) :
   la même simulation "🧪 SIMULATION — 32 équipes" que précédemment.
   ═══════════════════════════════════════════════════════════════ */

console.log('%cPadelPro — storage.js (mode local, sans Firebase)', 'color:#16a34a;font-weight:bold');

const Storage = (() => {

  const DEFAULT_SETTINGS = {
    tournament: {
      name: 'Tournoi de Padel',
      date: new Date().toISOString().split('T')[0],
      venue: '',
      logo: null,
      startTime: '09:00',
      endTime: '19:00',
      breakEnabled: false,
      breakStart: '12:00',
      breakEnd: '13:00'
    },
    courts: [
      { id: 'court-1', name: 'Terrain 1', available: true },
      { id: 'court-2', name: 'Terrain 2', available: true }
    ],
    levels: [
      { id: 'level-1', name: 'Niveau 1', value: 1, color: '#22c55e' },
      { id: 'level-2', name: 'Niveau 2', value: 2, color: '#3b82f6' },
      { id: 'level-3', name: 'Niveau 3', value: 3, color: '#f59e0b' }
    ],
    matchFormats: [
      { id: 'fmt-1', name: '6 Jeux', sets: 1, gamesPerSet: 6, tiebreak: true, goldenPoint: false, estimatedDuration: 45 },
      { id: 'fmt-2', name: '2 Sets de 4 Jeux', sets: 2, gamesPerSet: 4, tiebreak: true, goldenPoint: false, estimatedDuration: 50 },
      { id: 'fmt-3', name: '9 Jeux', sets: 1, gamesPerSet: 9, tiebreak: false, goldenPoint: true, estimatedDuration: 60 }
    ],
    game: {
      playersPerTeam: 2,
      maxTeams: 16,
      activeFormatId: 'fmt-1',
      poolCount: 2,
      qualificationMethod: 'top',
      qualificationCount: 2,
      rankingCriteria: ['wins', 'points', 'setDiff', 'gameDiff', 'headToHead'],
      pointsWin: 3,
      pointsLoss: 0,
      pointsDraw: 1,
      teamCreationMode: 'balanced',
      hasFinalTable: true,
      hasPetiteFinale: true,
      bracketSize: 8
    },
    theme: {
      primaryColor: '#16a34a',
      secondaryColor: '#0ea5e9',
      font: 'Inter'
    }
  };

  // ── Clés localStorage ─────────────────────────────────────────
  const KEYS = {
    tournaments: 'ppdemo_tournaments',
    players: 'ppdemo_global_players',
    activeId: 'ppdemo_active_id',
    audit: 'ppdemo_audit',
    prefs: 'ppdemo_preferences',
    seeded: 'ppdemo_seeded_v2'
  };

  const _readJSON = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  };

  let _writeErrorCallbacks = [];
  const onWriteError = (cb) => { _writeErrorCallbacks.push(cb); };
  let _lastWriteError = null;
  const getLastWriteError = () => _lastWriteError;

  const _writeJSON = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      _lastWriteError = null;
    } catch (err) {
      console.error(`Storage — erreur d'écriture locale (${key}) :`, err);
      _lastWriteError = { context: key, message: err?.message || String(err) };
      _writeErrorCallbacks.forEach(cb => { try { cb(_lastWriteError); } catch (e) { console.error(e); } });
    }
  };

  // Un seul appareil/navigateur : onRemoteChange n'est jamais déclenché,
  // mais on garde la fonction pour que App.init() puisse s'y abonner
  // sans erreur.
  let _remoteChangeCallbacks = [];
  const onRemoteChange = (cb) => { _remoteChangeCallbacks.push(cb); };

  // ── Caches en mémoire (miroir direct du localStorage) ────────────
  let _tournamentsCache = {};
  let _playersCache = {};
  let _auditCache = [];
  let _prefsCache = { sidebarCollapsed: false };
  let _activeId = null;

  const _loadAll = () => {
    _tournamentsCache = _readJSON(KEYS.tournaments, {});
    _playersCache = _readJSON(KEYS.players, {});
    _auditCache = _readJSON(KEYS.audit, []);
    _prefsCache = _readJSON(KEYS.prefs, { sidebarCollapsed: false });
    _activeId = _readJSON(KEYS.activeId, null);
  };

  // ── Génération du tournoi d'exemple au tout premier lancement ────
  // 64 joueurs, 32 équipes, 8 poules de 4, tableau principal de 16, 2
  // tableaux de classement, tout entièrement joué.
  const _seedDemoData = () => {
    const uid = () => (window.Utils && Utils.uuid ? Utils.uuid() : 'id-' + Math.random().toString(36).slice(2) + Date.now());
    const now = () => new Date().toISOString();
    const nextPow2 = n => Math.pow(2, Math.ceil(Math.log2(Math.max(n, 2))));

    const LAST = ['Theard','Pequery','Peyrou','Ritz','Seurin','Garcia','Trancart','Grue','Inzerillo','Peeters',
      'Mitjana','Authier','Vives','Gardier','Cancel','Espinal','Zapata','Blanque','Leygue','Guichard',
      'Boisse','Forcin','Moreau','Auradou','Tison','Geens','Moura','Hanouna','Foure','Durieux',
      'Martin','Bernard','Dubois','Leroy','Simon','Laurent','Petit','Roux','Fournier','Girard',
      'Morel','Bonnet','Dupont','Lambert','Fontaine','Rousseau','Vincent','Muller','Lecomte','Masson',
      'Blanc','Guerin','Perrin','Colin','Roy','Noel','Meyer','Robin','Adam','Denis',
      'Legrand','Faure','Andre','Mercier'];
    const FIRST_M = ['Julien','Thomas','Nicolas','Alexandre','Maxime','Romain','Baptiste','Florian','Kevin','Antoine',
      'Sebastien','Damien','Benjamin','Guillaume','Vincent','Mathieu','Adrien','Cedric','Jerome','Loic',
      'Dorian','Yann','Pierre','Simon','Hugo','Lucas','Theo','Louis','Nathan','Enzo','Paul','Gabriel'];
    const FIRST_F = ['Sophie','Marie','Camille','Laura','Emilie','Clara','Lucie','Manon','Pauline','Elise',
      'Charlotte','Aurelie','Julie','Anais','Melanie','Sarah','Amandine','Ines','Celine','Yasmine',
      'Chloe','Emma','Lea','Alice','Julia','Margaux','Noemie','Justine','Eva','Camille','Louise','Zoe'];
    const CLUBS = ['Padel Club Lyon', 'Tennis Padel Paris', 'Padel Bordeaux', 'AS Padel Marseille',
      'Padel Club Lille', 'Padel Nice', 'Toulouse Padel', 'Padel Nantes'];
    const CLASSEMENTS = ['P25', 'P50', 'P100', 'P250', 'P500'];

    // 64 joueurs
    const players = [];
    for (let i = 0; i < 64; i++) {
      const isM = i % 2 === 0;
      const lastName = LAST[i % LAST.length];
      const firstName = isM ? FIRST_M[Math.floor(i / 2) % FIRST_M.length] : FIRST_F[Math.floor(i / 2) % FIRST_F.length];
      players.push({
        id: uid(), firstName, lastName,
        gender: isM ? 'M' : 'F',
        club: CLUBS[i % CLUBS.length],
        classementFFT: CLASSEMENTS[i % CLASSEMENTS.length]
      });
    }

    // 32 équipes
    const teams = [];
    for (let i = 0; i < 64; i += 2) {
      const p1 = players[i], p2 = players[i + 1];
      teams.push({
        id: uid(),
        name: `${p1.lastName} ${p1.firstName[0]}. / ${p2.lastName} ${p2.firstName[0]}.`,
        playerIds: [p1.id, p2.id],
        locked: false
      });
    }

    // 8 poules de 4
    const pools = [];
    for (let i = 0; i < 8; i++) {
      pools.push({
        id: uid(),
        name: 'Poule ' + String.fromCharCode(65 + i),
        teamIds: teams.slice(i * 4, i * 4 + 4).map(t => t.id)
      });
    }

    // Matchs de poule (round-robin, tous joués)
    const randSet = () => ({ winnerGames: 6, loserGames: Math.floor(Math.random() * 5) });
    const matches = [];
    pools.forEach(pool => {
      const ids = pool.teamIds;
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const { winnerGames, loserGames } = randSet();
          const team1Wins = Math.random() < 0.5;
          matches.push({
            id: uid(), type: 'pool', poolId: pool.id,
            team1Id: ids[i], team2Id: ids[j],
            status: 'finished',
            score: { sets: [{ team1: team1Wins ? winnerGames : loserGames, team2: team1Wins ? loserGames : winnerGames }] },
            winnerId: team1Wins ? ids[i] : ids[j],
            scheduledTime: null, court: null, formatId: 'fmt-1'
          });
        }
      }
    });

    // Classement des poules
    const gameSettings = { pointsWin: 3, pointsLoss: 0, pointsDraw: 1 };
    const criteria = ['wins', 'points', 'setDiff', 'gameDiff', 'headToHead'];
    const teamsByRank = {};
    pools.forEach(pool => {
      const poolTeams = pool.teamIds.map(id => teams.find(t => t.id === id));
      const poolMatches = matches.filter(m => m.poolId === pool.id);
      let ranked;
      if (window.RankingsModule && RankingsModule.rankTeams) {
        ranked = RankingsModule.rankTeams(poolTeams, poolMatches, criteria, gameSettings).map(r => ({ team: r.team }));
      } else {
        ranked = poolTeams
          .map(team => ({ team, wins: poolMatches.filter(m => m.winnerId === team.id).length }))
          .sort((a, b) => b.wins - a.wins);
      }
      ranked.forEach((r, i) => {
        const rank = i + 1;
        if (!teamsByRank[rank]) teamsByRank[rank] = [];
        teamsByRank[rank].push(r.team.id);
      });
    });

    // Tableau principal (16 équipes : 1er + 2ème de chaque poule)
    const qualCount = 2;
    const qualifiedIds = [...(teamsByRank[1] || []), ...(teamsByRank[2] || [])];
    const hasPetiteFinale = true;
    const bracketSize = nextPow2(qualifiedIds.length);
    const bracketSeeds = [...qualifiedIds];
    while (bracketSeeds.length < bracketSize) bracketSeeds.push(null);
    const bracketRoundCount = Math.log2(bracketSize);
    const bracketRounds = [];
    for (let r = 0; r < bracketRoundCount; r++) bracketRounds.push({ matchIds: [] });

    for (let i = 0; i < bracketSize / 2; i++) {
      const m = {
        id: uid(), type: 'bracket', poolId: null,
        bracketRound: 0, bracketPosition: i,
        team1Id: bracketSeeds[i * 2] || null, team2Id: bracketSeeds[i * 2 + 1] || null,
        courtId: null, scheduledTime: null, status: 'scheduled',
        score: null, winnerId: null, formatId: 'fmt-1'
      };
      if (!m.team1Id || !m.team2Id) { m.winnerId = m.team1Id || m.team2Id; m.status = 'finished'; }
      matches.push(m);
      bracketRounds[0].matchIds.push(m.id);
    }
    for (let r = 1; r < bracketRoundCount; r++) {
      const count = bracketSize / Math.pow(2, r + 1);
      for (let i = 0; i < count; i++) {
        const m = {
          id: uid(), type: 'bracket', poolId: null,
          bracketRound: r, bracketPosition: i,
          team1Id: null, team2Id: null,
          courtId: null, scheduledTime: null, status: 'scheduled',
          score: null, winnerId: null, formatId: 'fmt-1'
        };
        matches.push(m);
        bracketRounds[r].matchIds.push(m.id);
      }
    }
    let petiteFinaleMatch = null;
    if (hasPetiteFinale && bracketRounds.length >= 2) {
      petiteFinaleMatch = {
        id: uid(), type: 'bracket', isPetiteFinale: true,
        bracketRound: bracketRounds.length - 1, bracketPosition: 99,
        team1Id: null, team2Id: null,
        courtId: null, scheduledTime: null, status: 'scheduled',
        score: null, winnerId: null, formatId: 'fmt-1'
      };
      matches.push(petiteFinaleMatch);
    }

    const playMatch = (m) => {
      const { winnerGames, loserGames } = randSet();
      const team1Wins = Math.random() < 0.5;
      m.status = 'finished';
      m.score = { sets: [{ team1: team1Wins ? winnerGames : loserGames, team2: team1Wins ? loserGames : winnerGames }] };
      m.winnerId = team1Wins ? m.team1Id : m.team2Id;
      return { winnerId: m.winnerId, loserId: team1Wins ? m.team2Id : m.team1Id };
    };

    // Tournoi EN COURS : on joue les 2 premiers rounds du bracket (R16 + QF),
    // et on laisse les SF / Finale / Petite Finale en scheduled.
    // 2 QF sont marqués 'running' pour l'effet "live".
    const BRACKET_ROUNDS_TO_PLAY = 2; // R16 (0) + QF (1) joués, SF+ non joués
    for (let r = 0; r < Math.min(BRACKET_ROUNDS_TO_PLAY, bracketRounds.length); r++) {
      bracketRounds[r].matchIds.forEach((matchId, pos) => {
        const m = matches.find(x => x.id === matchId);
        if (!m || m.status === 'finished') {
          if (m && m.winnerId && r < bracketRounds.length - 1) {
            const nextPos = Math.floor(pos / 2);
            const nextId = bracketRounds[r + 1].matchIds[nextPos];
            const next = matches.find(x => x.id === nextId);
            if (next) { if (pos % 2 === 0) next.team1Id = m.winnerId; else next.team2Id = m.winnerId; }
          }
          return;
        }
        const { winnerId, loserId } = playMatch(m);
        if (r < bracketRounds.length - 1) {
          const nextPos = Math.floor(pos / 2);
          const nextId = bracketRounds[r + 1].matchIds[nextPos];
          const next = matches.find(x => x.id === nextId);
          if (next) { if (pos % 2 === 0) next.team1Id = winnerId; else next.team2Id = winnerId; }
        }
      });
    }
    // Marquer 2 matchs du round suivant (SF) comme 'running' sur des terrains
    if (bracketRounds.length > BRACKET_ROUNDS_TO_PLAY) {
      const courts = ['court-1', 'court-2'];
      bracketRounds[BRACKET_ROUNDS_TO_PLAY].matchIds.slice(0, 2).forEach((matchId, i) => {
        const m = matches.find(x => x.id === matchId);
        if (m && m.team1Id && m.team2Id) {
          m.status = 'running';
          m.courtId = courts[i] || 'court-1';
          m.scheduledTime = '14:' + String(30 + i * 15).padStart(2, '0');
        }
      });
    }

    // Tableaux de classement (rangs 3 et 4)
    const classements = [];
    for (let rank = qualCount + 1; rank <= 4; rank++) {
      const teamIds = teamsByRank[rank] || [];
      if (teamIds.length < 2) continue;
      const classementId = uid();
      const size = nextPow2(teamIds.length);
      const seeds = [...teamIds];
      while (seeds.length < size) seeds.push(null);
      const roundCount = Math.log2(size);
      const rounds = [];
      for (let r = 0; r < roundCount; r++) rounds.push({ matchIds: [] });

      for (let i = 0; i < size / 2; i++) {
        const m = {
          id: uid(), type: 'classement', classementId,
          classementRound: 0, classementPosition: i, poolId: null,
          team1Id: seeds[i * 2] || null, team2Id: seeds[i * 2 + 1] || null,
          courtId: null, scheduledTime: null, status: 'scheduled',
          score: null, winnerId: null, formatId: 'fmt-1'
        };
        if (!m.team1Id || !m.team2Id) { m.winnerId = m.team1Id || m.team2Id; m.status = 'finished'; }
        matches.push(m);
        rounds[0].matchIds.push(m.id);
      }
      for (let r = 1; r < roundCount; r++) {
        const count = size / Math.pow(2, r + 1);
        for (let i = 0; i < count; i++) {
          const m = {
            id: uid(), type: 'classement', classementId,
            classementRound: r, classementPosition: i, poolId: null,
            team1Id: null, team2Id: null,
            courtId: null, scheduledTime: null, status: 'scheduled',
            score: null, winnerId: null, formatId: 'fmt-1'
          };
          matches.push(m);
          rounds[r].matchIds.push(m.id);
        }
      }
      for (let r = 0; r < rounds.length; r++) {
        rounds[r].matchIds.forEach((matchId, pos) => {
          const m = matches.find(x => x.id === matchId);
          if (!m || m.status === 'finished') {
            if (m && m.winnerId && r < rounds.length - 1) {
              const nextPos = Math.floor(pos / 2);
              const nextId = rounds[r + 1].matchIds[nextPos];
              const next = matches.find(x => x.id === nextId);
              if (next) { if (pos % 2 === 0) next.team1Id = m.winnerId; else next.team2Id = m.winnerId; }
            }
            return;
          }
          const { winnerId } = playMatch(m);
          if (r < rounds.length - 1) {
            const nextPos = Math.floor(pos / 2);
            const nextId = rounds[r + 1].matchIds[nextPos];
            const next = matches.find(x => x.id === nextId);
            if (next) { if (pos % 2 === 0) next.team1Id = winnerId; else next.team2Id = winnerId; }
          }
        });
      }
      const placeFrom = (rank - 1) * pools.length + 1;
      const placeTo = rank * pools.length;
      classements.push({ id: classementId, label: `Classement — Places ${placeFrom} à ${placeTo}`, poolRank: rank, placeFrom, placeTo, size, rounds });
    }

    // Assemblage du tournoi
    const tournamentId = uid();
    const tournament = {
      id: tournamentId,
      settings: {
        tournament: {
          name: '🧪 SIMULATION — 32 équipes',
          date: new Date().toISOString().split('T')[0],
          venue: 'Complexe Padel Test',
          logo: null, startTime: '09:00', endTime: '19:00',
          breakEnabled: false, breakStart: '12:00', breakEnd: '13:00'
        },
        courts: [
          { id: 'court-1', name: 'Terrain 1', available: true },
          { id: 'court-2', name: 'Terrain 2', available: true },
          { id: 'court-3', name: 'Terrain 3', available: true },
          { id: 'court-4', name: 'Terrain 4', available: true },
          { id: 'court-5', name: 'Terrain 5', available: true },
          { id: 'court-6', name: 'Terrain 6', available: true }
        ],
        levels: Utils.clone(DEFAULT_SETTINGS.levels),
        matchFormats: [
          { id: 'fmt-1', name: '6 Jeux', sets: 1, gamesPerSet: 6, tiebreak: true, goldenPoint: false, estimatedDuration: 45 }
        ],
        game: {
          playersPerTeam: 2, maxTeams: 32, activeFormatId: 'fmt-1',
          poolCount: 8, qualificationMethod: 'top', qualificationCount: qualCount,
          rankingCriteria: criteria, pointsWin: 3, pointsLoss: 0, pointsDraw: 1,
          teamCreationMode: 'balanced', hasFinalTable: true, hasPetiteFinale: true,
          bracketSize
        },
        theme: { primaryColor: '#16a34a', secondaryColor: '#0ea5e9', font: 'Inter' }
      },
      playerIds: players.map(p => p.id),
      playerPresence: Object.fromEntries(players.map(p => [p.id, true])),
      teams, pools, matches,
      bracket: { rounds: bracketRounds, hasPetiteFinale, size: bracketSize },
      classements,
      status: 'finished',
      createdAt: now(), updatedAt: now()
    };

    // Fusion (pas de remplacement) : les joueurs/tournois déjà présents
    // (créés à la main, ou issus d'un ancien test) sont conservés tels
    // quels — la simulation vient s'ajouter à côté, comme un deuxième
    // tournoi dans Accueil.
    _playersCache = { ..._playersCache, ...Object.fromEntries(players.map(p => [p.id, p])) };
    _tournamentsCache = { ..._tournamentsCache, [tournamentId]: tournament };
    _activeId = tournamentId;

    _writeJSON(KEYS.players, _playersCache);
    _writeJSON(KEYS.tournaments, _tournamentsCache);
    _writeJSON(KEYS.activeId, _activeId);
    _writeJSON(KEYS.seeded, true);
    console.log('%c✅ Tournoi ajouté : "🧪 SIMULATION — 32 équipes"', 'color:#16a34a;font-weight:bold');
  };

  // ── Initialisation ────────────────────────────────────────────
  // On regénère la simulation dès qu'elle est absente du cache (plutôt
  // que de se fier à un simple indicateur "déjà seedé une fois") : ça
  // couvre aussi bien le tout premier lancement qu'un cas où elle aurait
  // disparu (ex: ancien test avec un jeu de données différent sous les
  // mêmes clés localStorage). Les autres tournois/joueurs existants ne
  // sont jamais touchés.
  let _readyPromise = null;
  const ready = () => {
    if (_readyPromise) return _readyPromise;
    _readyPromise = new Promise((resolve) => {
      _loadAll();
      const hasSimulation = Object.values(_tournamentsCache)
        .some(t => t?.settings?.tournament?.name === '🧪 SIMULATION — 32 équipes');
      if (!hasSimulation) _seedDemoData();
      resolve();
    });
    return _readyPromise;
  };

  // ── Tournaments ────────────────────────────────────────────────
  const getAllTournaments = () => ({ ..._tournamentsCache });
  const getTournament = (id) => _tournamentsCache[id] || null;

  const saveTournament = (tournament) => {
    const toSave = { ...tournament, updatedAt: Utils.now() };
    if (toSave.players) delete toSave.players;
    _tournamentsCache = { ..._tournamentsCache, [tournament.id]: toSave };
    tournament.updatedAt = toSave.updatedAt;
    _writeJSON(KEYS.tournaments, _tournamentsCache);
    return true;
  };

  const deleteTournament = (id) => {
    const next = { ..._tournamentsCache };
    delete next[id];
    _tournamentsCache = next;
    _writeJSON(KEYS.tournaments, _tournamentsCache);
    if (_activeId === id) clearActiveId();
  };

  // ── Active Tournament ──────────────────────────────────────────
  const getActiveId = () => _activeId;
  const setActiveId = (id) => {
    _activeId = id;
    _writeJSON(KEYS.activeId, id);
    return true;
  };
  const clearActiveId = () => { setActiveId(null); };

  const _emptyTournament = () => ({
    id: null,
    settings: Utils.clone(DEFAULT_SETTINGS),
    playerIds: [], playerPresence: {},
    teams: [], pools: [], matches: [], bracket: null,
    status: 'setup', createdAt: Utils.now(), updatedAt: Utils.now()
  });

  const getActive = () => {
    if (_activeId) {
      const t = getTournament(_activeId);
      if (t) return t;
      const existing = Object.values(_tournamentsCache)
        .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
      if (existing.length > 0) return existing[0];
    }
    return createNewTournament();
  };

  const saveActive = (tournament) => {
    tournament.id = tournament.id || Utils.uuid();
    setActiveId(tournament.id);
    return saveTournament(tournament);
  };

  const createNewTournament = () => {
    const id = Utils.uuid();
    const t = {
      id,
      settings: Utils.clone(DEFAULT_SETTINGS),
      playerIds: [], playerPresence: {},
      teams: [], pools: [], matches: [], bracket: null,
      status: 'setup', createdAt: Utils.now(), updatedAt: Utils.now()
    };
    setActiveId(id);
    saveTournament(t);
    return t;
  };

  const duplicateTournament = (id) => {
    const src = getTournament(id);
    if (!src) return null;
    const newId = Utils.uuid();
    const dup = Utils.clone(src);
    dup.id = newId;
    dup.settings.tournament.name = src.settings.tournament.name + ' (copie)';
    dup.createdAt = Utils.now();
    dup.updatedAt = Utils.now();
    dup.status = 'setup';
    dup.playerPresence = {};
    dup.teams = []; dup.pools = []; dup.matches = []; dup.bracket = null;
    saveTournament(dup);
    return dup;
  };

  // ── Base joueurs globale ───────────────────────────────────────
  const getGlobalPlayers = () => ({ ..._playersCache });

  const saveGlobalPlayers = (players) => {
    _playersCache = { ...players };
    _writeJSON(KEYS.players, _playersCache);
    return true;
  };

  const getAllPlayersList = () => Object.values(_playersCache);

  const upsertPlayer = (player) => {
    _playersCache = { ..._playersCache, [player.id]: { ...player } };
    _writeJSON(KEYS.players, _playersCache);
    return player;
  };

  const deleteGlobalPlayer = (id) => {
    const next = { ..._playersCache };
    delete next[id];
    _playersCache = next;
    _writeJSON(KEYS.players, _playersCache);
  };

  const getTournamentPlayers = (t) => {
    const ids = t.playerIds || [];
    const presence = t.playerPresence || {};
    return ids
      .map(id => _playersCache[id])
      .filter(Boolean)
      .map(p => ({ ...p, present: presence[p.id] === true }));
  };

  const migrateToGlobalPlayers = () => {
    let migrated = false;
    Object.values(_tournamentsCache).forEach(t => {
      if (t.players && t.players.length > 0 && !t.playerIds) {
        t.playerIds = t.players.map(p => p.id).filter(Boolean);
        t.playerPresence = {};
        t.players.forEach(p => {
          if (p && p.id) {
            const { present, ...playerData } = p;
            upsertPlayer(playerData);
            t.playerPresence[p.id] = present === true;
          }
        });
        delete t.players;
        saveTournament(t);
        migrated = true;
      } else if (!t.playerIds) {
        t.playerIds = [];
        t.playerPresence = {};
        saveTournament(t);
        migrated = true;
      }
    });
    return migrated;
  };

  // ── Audit ─────────────────────────────────────────────────────
  const getAudit = () => [..._auditCache];

  const addAuditEntry = (entry) => {
    const full = { ...entry, id: Utils.uuid(), timestamp: Utils.now() };
    _auditCache = [full, ..._auditCache].slice(0, 500);
    _writeJSON(KEYS.audit, _auditCache);
  };

  const clearAudit = () => {
    _auditCache = [];
    _writeJSON(KEYS.audit, _auditCache);
  };

  // ── Preferences ───────────────────────────────────────────────
  const getPreferences = () => ({ ..._prefsCache });
  const savePreferences = (prefs) => {
    _prefsCache = { ...prefs };
    _writeJSON(KEYS.prefs, _prefsCache);
    return true;
  };

  // ── Statistiques ─────────────────────────────────────────────
  const storageSize = () =>
    `${Object.keys(_tournamentsCache).length} tournoi(s), ${Object.keys(_playersCache).length} joueur(s) — local`;

  // ── Export / Import ───────────────────────────────────────────
  const exportAll = () => ({
    version: 2,
    exportDate: Utils.now(),
    tournaments: getAllTournaments(),
    globalPlayers: getGlobalPlayers(),
    audit: getAudit()
  });

  const importAll = async (data) => {
    const tournaments = data.tournaments || {};
    const globalPlayers = data.globalPlayers || {};
    const audit = data.audit || [];
    _tournamentsCache = { ..._tournamentsCache, ...tournaments };
    _playersCache = { ..._playersCache, ...globalPlayers };
    _auditCache = [...audit, ..._auditCache].slice(0, 500);
    _writeJSON(KEYS.tournaments, _tournamentsCache);
    _writeJSON(KEYS.players, _playersCache);
    _writeJSON(KEYS.audit, _auditCache);
    if (data.version === 1) migrateToGlobalPlayers();
  };

  return {
    DEFAULT_SETTINGS,
    ready, onRemoteChange, onWriteError, getLastWriteError,
    getAllTournaments, saveTournament, getTournament, deleteTournament,
    getActiveId, setActiveId, clearActiveId,
    getActive, saveActive, createNewTournament, duplicateTournament,
    getGlobalPlayers, saveGlobalPlayers, getAllPlayersList,
    upsertPlayer, deleteGlobalPlayer, getTournamentPlayers,
    migrateToGlobalPlayers,
    getAudit, addAuditEntry, clearAudit,
    getPreferences, savePreferences,
    storageSize, exportAll, importAll
  };
})();

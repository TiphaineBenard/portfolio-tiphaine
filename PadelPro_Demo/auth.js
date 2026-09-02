'use strict';

/* ═══════════════════════════════════════════════════════════════
   AUTH — Connexion locale à identifiants fictifs codés en dur

   Aucun Firebase, aucun réseau : l'identifiant/mot de passe ci-dessous
   ne protègent rien de réel côté serveur (il n'y a pas de serveur),
   ils servent juste à retrouver le même écran de connexion que sur
   les autres appli. Pour un vrai client avec ses propres données,
   voir GUIDE-DEMO-CLIENT.md (fichier séparé, à faire plus tard).
   ═══════════════════════════════════════════════════════════════ */

const AuthModule = (() => {

  // ── Identifiants (à changer ici si besoin, ligne unique) ────────
  const DEMO_LOGIN = 'admin';
  const DEMO_PASSWORD = '0000';

  const LOGGED_KEY = 'ppdemo_logged_in';

  const _isLoggedIn = () => localStorage.getItem(LOGGED_KEY) === '1';

  const getCurrentUser = () => _isLoggedIn() ? { email: DEMO_LOGIN, isAnonymous: false } : null;
  const isRealAccount = () => _isLoggedIn();

  // Vérif locale instantanée : pas d'attente réseau nécessaire.
  const waitForAuthCheck = () => Promise.resolve();

  // ── Écran de connexion bloquant (plein écran) ──────────────────
  const renderLoginGate = () => {
    let el = document.getElementById('auth-gate');
    if (!el) {
      el = document.createElement('div');
      el.id = 'auth-gate';
      document.body.appendChild(el);
    }
    document.body.classList.add('has-auth-gate');
    _paintGate(el);
  };

  const hideLoginGate = () => {
    document.getElementById('auth-gate')?.remove();
    document.body.classList.remove('has-auth-gate');
  };

  const _paintGate = (el) => {
    el.innerHTML = `
      <div class="auth-gate-card">
        <div class="auth-gate-logo">🎾 PadelPro</div>
        <h2 class="auth-gate-title">Connexion</h2>
        <p class="auth-gate-sub">Identifiant : <b>${DEMO_LOGIN}</b> / mot de passe : <b>${DEMO_PASSWORD}</b></p>
        <div id="auth-gate-error" class="alert alert-danger" style="display:none;font-size:12px;margin-bottom:var(--space-3)"></div>
        <form id="auth-gate-form">
          <div class="form-group">
            <label class="form-label">Identifiant</label>
            <input name="login" type="text" class="form-control" required placeholder="${DEMO_LOGIN}" autocomplete="username">
          </div>
          <div class="form-group">
            <label class="form-label">Mot de passe</label>
            <input name="password" type="password" class="form-control" required placeholder="${DEMO_PASSWORD}" autocomplete="current-password">
          </div>
          <button type="submit" class="btn btn-primary" id="auth-gate-submit" style="width:100%;justify-content:center">Se connecter</button>
        </form>
      </div>`;

    el.querySelector('#auth-gate-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const form = e.target;
      const login = form.querySelector('input[name="login"]')?.value?.trim();
      const password = form.querySelector('input[name="password"]')?.value;
      const errBox = el.querySelector('#auth-gate-error');

      if (login === DEMO_LOGIN && password === DEMO_PASSWORD) {
        localStorage.setItem(LOGGED_KEY, '1');
        window.location.reload();
      } else {
        if (errBox) { errBox.textContent = 'Identifiant ou mot de passe incorrect.'; errBox.style.display = ''; }
      }
    });
  };

  // ── Modale "Compte" (Paramètres → Compte) — pas de vrai compte à
  // créer ici, on informe juste l'utilisateur.
  const openAuthModal = () => {
    App.toast('Un seul compte local, déjà connecté.', 'info');
  };

  // ── Déconnexion ──────────────────────────────────────────────────
  const logout = async () => {
    const ok = await App.confirm('Se déconnecter', 'Vous reviendrez à l\'écran de connexion.', { icon: '👋' });
    if (!ok) return;
    localStorage.removeItem(LOGGED_KEY);
    window.location.reload();
  };

  return { waitForAuthCheck, getCurrentUser, isRealAccount, renderLoginGate, hideLoginGate, openAuthModal, logout };
})();

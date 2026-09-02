/* ═══════════════════════════════════════════════════════════════
   intro.js — "Obscurité Cinématique" : loader minimaliste, centré,
   pourcentage seul pendant le chargement → pitch + bouton à 100%
   → clic : fondu du loader + travelling caméra GSAP.
═══════════════════════════════════════════════════════════════ */

window.Intro = (function () {

  const { loadingManager, camera, DEFAULT_CAMERA_POS } = window.Scene;

  const cinematicLoader = document.getElementById('cinematic-loader');
  const percentageEl = document.getElementById('loader-percentage');
  const enterBtn = document.getElementById('enter-btn');
  const revealTargets = Array.from(document.querySelectorAll('.intro-reveal'));

  window.introComplete = false;

  gsap.set(revealTargets, { autoAlpha: 0, y: 34 });

  // Position de départ dramatique : en hauteur et décalée sur le côté,
  // façon plan d'ouverture qui descend et recentre sur le sujet — pas
  // juste un recul sur l'axe Z comme avant. Le rendu final (lookAt vers
  // le carrousel) se met à jour automatiquement à chaque frame dans
  // animate() (scene.js), donc il suffit d'animer camera.position :
  // pas besoin de piloter le lookAt nous-mêmes pendant le travelling.
  camera.position.set(6.5, 4.5, 15);

  // IMPORTANT : verrouillée tout de suite (window.__cameraLocked), sinon
  // le parallax souris de animate() (qui tourne déjà pendant l'écran de
  // chargement) ramènerait x/y vers leur position par défaut TOUT SEUL
  // en 1-2s, avant même le clic sur "Découvrir" — la caméra arriverait
  // déjà recentrée et le travelling ne ferait plus qu'un simple zoom en
  // Z, sans effet de survol/descente. Déverrouillée à la fin du
  // travelling (onComplete de la timeline ci-dessous).
  window.__cameraLocked = true;

  /* ═══════════════════════════════════════════════════════════
     1) LOADINGMANAGER — met à jour UNIQUEMENT le pourcentage.
  ═══════════════════════════════════════════════════════════ */
  loadingManager.onProgress = function (url, itemsLoaded, itemsTotal) {
    const pct = Math.round((itemsLoaded / itemsTotal) * 100);
    percentageEl.textContent = pct + '%';
    document.getElementById('progress-bar').style.width = (itemsLoaded / itemsTotal * 100) + '%';
  };

  loadingManager.onLoad = function () {
    percentageEl.textContent = '100%';
    swapPercentageForButton();
  };

  loadingManager.onError = function (url) {
    console.warn('[Intro] Erreur de chargement asset :', url);
  };

  // ── Chargement virtuel tant qu'aucun vrai asset (.glb/texture
  // externe) n'est enregistré sur ce manager. À supprimer dès que
  // de vrais loaders (GLTFLoader, TextureLoader) utiliseront ce
  // même `loadingManager` — le pipeline onProgress/onLoad
  // fonctionnera alors tel quel avec les vraies valeurs.
  (function simulateAssetLoadingUntilRealAssetsExist() {
    const FAKE_STEPS = 8;
    let step = 0;
    for (let i = 0; i < FAKE_STEPS; i++) loadingManager.itemStart('virtual-asset-' + i);
    const interval = setInterval(() => {
      loadingManager.itemEnd('virtual-asset-' + step);
      step++;
      if (step >= FAKE_STEPS) clearInterval(interval);
    }, 180);
  })();

  /* ═══════════════════════════════════════════════════════════
     2) À 100% — le pourcentage et le bouton sont superposés dans
        la même zone (`.loader-dynamic-zone`, position:absolute en
        CSS) : le bouton REMPLACE le pourcentage sans aucun saut de
        layout. Le pitch, lui, est visible depuis le tout début.
  ═══════════════════════════════════════════════════════════ */
  function swapPercentageForButton() {
    gsap.to('#loader-percentage', { opacity: 0, y: -30, duration: 0.6, ease: 'power2.inOut' });
    gsap.to('.progress-track', { opacity: 0, duration: 0.6, ease: 'power2.inOut' });

    gsap.to('#enter-btn', {
      opacity: 1,
      y: 0,
      duration: 0.6,
      delay: 0.3,
      ease: 'power2.out',
      onComplete: () => { document.getElementById('enter-btn').style.pointerEvents = 'auto'; },
    });
  }

  enterBtn.addEventListener('click', enterExperience);

  /* ═══════════════════════════════════════════════════════════
     3) CLIC → fondu du loader + travelling caméra GSAP
  ═══════════════════════════════════════════════════════════ */
  function enterExperience() {
    const tl = gsap.timeline({
      onComplete: () => {
        window.introComplete = true;
        window.__cameraLocked = false; // rend la main au parallax souris normal
      },
    });

    // Étape 1 : le loader disparaît complètement en fondu
    tl.to(cinematicLoader, {
      opacity: 0,
      duration: 1.2,
      ease: 'power2.inOut',
      onComplete: () => { cinematicLoader.style.pointerEvents = 'none'; },
    }, 0);

    // Étape 2 (simultanée) : vrai travelling choréographié — la caméra
    // descend et recentre depuis un plan d'ouverture en hauteur/décalé
    // (set plus haut) vers le cadrage par défaut, sur les 3 axes à la
    // fois (avant : seul Z bougeait, donc un simple zoom).
    tl.to(camera.position, {
      x: DEFAULT_CAMERA_POS.x,
      y: DEFAULT_CAMERA_POS.y,
      z: DEFAULT_CAMERA_POS.z,
      duration: 2.8,
      ease: 'power3.inOut',
      onUpdate: () => camera.lookAt(0, -1.55, 0), // -1.55 = CAROUSEL_Y (scene.js) ; animate() reprend ce lookAt en continu dès le déverrouillage
    }, 0);

    // Le reste de l'UI (header/hero) apparaît pendant le travelling
    tl.to(revealTargets, {
      autoAlpha: 1,
      y: 0,
      duration: 0.85,
      ease: 'power3.out',
      stagger: 0.12,
    }, 0.3);
  }

  return {};

})();

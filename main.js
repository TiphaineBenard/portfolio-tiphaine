/* ═══════════════════════════════════════════════════════════════
   main.js — Slider 3D (drag + molette + inertie), raycaster,
   ouverture/fermeture du panneau projet.
═══════════════════════════════════════════════════════════════ */

(function () {
  const {
    camera, canvas, phones, hitboxes, track,
    SPACING, SLIDER_BOUNDS, APPS, DEFAULT_CAMERA_POS, animate, bokehPass,
    IS_MOBILE,
  } = window.Scene;

  /* ═══════════════════════════════════════════════════════════
     1) SLIDER — target/current + lerp strict, clamp systématique
        sur la CIBLE (jamais sur la position rendue directement),
        pour éliminer tout saut brutal dans les coins.
  ═══════════════════════════════════════════════════════════ */
  let targetScroll = track.position.x; // cible du scroll (toujours clampée dès qu'on la touche) — part de la position initiale (décalage hero) définie dans scene.js
  let currentScroll = track.position.x; // position réellement rendue, lerp vers targetScroll
  let velocity = 0;        // inertie après relâchement (molette ou drag)
  let isDragging = false;
  let dragStartClientX = 0;
  let dragStartScroll = 0;
  let lastClientX = 0;
  let lastMoveTime = 0;
  let totalDragDistance = 0; // sert à distinguer un clic d'un drag
  let isPointerTouch = false; // vrai doigt sur écran tactile (fiable, contrairement à IS_MOBILE basé sur la taille d'écran/user-agent)

  // ── Indicateur de position (points ● ○ ○ ○) — un point par app,
  // généré dynamiquement (pas de nombre codé en dur), mis à jour selon
  // le téléphone le plus proche du centre de l'écran.
  const dotsContainer = document.getElementById('carousel-dots');
  const dotEls = APPS.map((app, i) => {
    const d = document.createElement('span');
    d.className = 'dot-indicator';
    d.setAttribute('role', 'button');
    d.setAttribute('aria-label', 'Voir ' + app.name);
    // Cliquable — fait glisser directement vers ce téléphone (centré),
    // en plus d'être un simple indicateur passif de position.
    d.addEventListener('click', () => {
      if (focusedGroup) return; // pas de saut de carrousel projet ouvert
      const targetLocalX = -phones[i].userData.localX;
      targetScroll = clampScroll(targetLocalX);
      velocity = 0;
    });
    dotsContainer.appendChild(d);
    return d;
  });
  let activeDotIndex = -1;
  function updateActiveDot() {
    let nearestIndex = 0;
    let nearestDist = Infinity;
    phones.forEach((group) => {
      const worldX = group.userData.localX + track.position.x;
      const d = Math.abs(worldX);
      if (d < nearestDist) { nearestDist = d; nearestIndex = group.userData.appIndex; }
    });
    if (nearestIndex !== activeDotIndex) {
      if (dotEls[activeDotIndex]) dotEls[activeDotIndex].classList.remove('is-active');
      dotEls[nearestIndex].classList.add('is-active');
      activeDotIndex = nearestIndex;
    }
  }
  updateActiveDot(); // état initial correct dès le chargement (1er point actif)

  const DRAG_CLICK_THRESHOLD = 6; // px — en dessous, on considère que c'était un clic
  const DRAG_TO_WORLD = 0.0065;    // conversion px écran → unités monde
  const LERP_FACTOR = 0.08;        // cf. spec : currentScroll = lerp(currentScroll, targetScroll, 0.08)
  const FRICTION = 0.92;

  function clampScroll(x) {
    return THREE.MathUtils.clamp(x, SLIDER_BOUNDS.min, SLIDER_BOUNDS.max);
  }

  // ── Snap au swipe (mobile uniquement) — au lieu de devoir glisser
  // plusieurs fois pour traverser tout l'espacement entre deux
  // téléphones, un seul swipe (au-delà d'un petit seuil) fait sauter
  // directement au téléphone suivant/précédent, centré.
  const SWIPE_THRESHOLD_PX = 40;
  function nearestIndexAtScroll(scrollX) {
    let nearestIndex = 0;
    let nearestDist = Infinity;
    phones.forEach((group) => {
      const worldX = group.userData.localX + scrollX;
      const d = Math.abs(worldX);
      if (d < nearestDist) { nearestDist = d; nearestIndex = group.userData.appIndex; }
    });
    return nearestIndex;
  }
  function scrollForIndex(i) {
    return clampScroll(-phones[i].userData.localX);
  }

  function onDragStart(clientX) {
    isDragging = true;
    velocity = 0;
    totalDragDistance = 0;
    dragStartClientX = clientX;
    lastClientX = clientX;
    dragStartScroll = targetScroll;
    lastMoveTime = performance.now();
  }

  function onDragMove(clientX) {
    if (!isDragging) return;
    const now = performance.now();
    const dt = Math.max(now - lastMoveTime, 1);

    const deltaFromStart = clientX - dragStartClientX;
    totalDragDistance = Math.max(totalDragDistance, Math.abs(deltaFromStart));

    const proposed = dragStartScroll + deltaFromStart * DRAG_TO_WORLD;
    // CRUCIAL : on clampe targetScroll immédiatement, à chaque frame
    // de mousemove — la cible ne peut jamais exploser hors limites,
    // donc rien ne "saute" quand on relâche dans un coin.
    targetScroll = clampScroll(proposed);

    const instDelta = clientX - lastClientX;
    velocity = (instDelta * DRAG_TO_WORLD) / (dt / 16.67); // vitesse normalisée ~60fps

    lastClientX = clientX;
    lastMoveTime = now;
  }

  function onDragEnd(clientX, clientY) {
    if (!isDragging) return;
    isDragging = false;

    // Clic (pas de drag significatif) → tenter l'ouverture d'un projet
    if (totalDragDistance < DRAG_CLICK_THRESHOLD) {
      tryOpenProjectAt(clientX, clientY);
      return;
    }

    // Sur mobile (vrai doigt sur écran tactile) : un swipe suffisant fait
    // sauter directement au téléphone suivant/précédent (au lieu de
    // laisser l'inertie continue décider d'une position arbitraire entre
    // deux téléphones). On se base sur le type de pointeur réel de ce
    // geste (e.pointerType === 'touch'), pas sur IS_MOBILE (détection par
    // taille d'écran/user-agent, pas fiable à 100% sur tous les téléphones).
    if (isPointerTouch) {
      const deltaFromStart = clientX - dragStartClientX;
      const startIndex = nearestIndexAtScroll(dragStartScroll);
      let targetIndex = startIndex;
      if (Math.abs(deltaFromStart) >= SWIPE_THRESHOLD_PX) {
        targetIndex = deltaFromStart < 0 ? startIndex + 1 : startIndex - 1;
        targetIndex = THREE.MathUtils.clamp(targetIndex, 0, phones.length - 1);
      }
      targetScroll = scrollForIndex(targetIndex);
      velocity = 0;
    }
  }

  // ── PointerEvents : gère souris, tactile ET stylet avec la même
  // API, donc pas de duplication mouse/touch séparée pour le drag.
  canvas.addEventListener('pointerdown', (e) => {
    if (!window.introComplete || focusedGroup) return;
    isPointerTouch = e.pointerType === 'touch';
    canvas.setPointerCapture(e.pointerId);
    onDragStart(e.clientX);
  });
  canvas.addEventListener('pointermove', (e) => {
    updateHoverPointer(e.clientX, e.clientY);
    if (isDragging) onDragMove(e.clientX);
  });
  canvas.addEventListener('pointerup', (e) => {
    onDragEnd(e.clientX, e.clientY);
  });
  canvas.addEventListener('pointercancel', () => { isDragging = false; });
  // ── Fix du bug "saut aux extrémités" : si le pointeur quitte la
  // fenêtre (alt-tab, drag qui sort du viewport, etc.) sans jamais
  // déclencher pointerup, on stoppe proprement le drag au lieu de
  // laisser targetScroll continuer à suivre un pointeur fantôme.
  canvas.addEventListener('pointerleave', () => {
    isDragging = false;
    if (hoveredGroup) { lowerPhone(hoveredGroup); hoveredGroup = null; canvas.style.cursor = 'grab'; }
  });
  window.addEventListener('blur', () => { isDragging = false; });

  // ── Molette (desktop) — même logique de cible clampée + inertie
  canvas.addEventListener('wheel', (e) => {
    if (!window.introComplete || focusedGroup) return;
    e.preventDefault();
    const delta = (e.deltaY || e.deltaX) * 0.0015; // multiplicateur très faible — molette maîtrisée
    targetScroll = clampScroll(targetScroll + delta);
    velocity = delta * 2;
  }, { passive: false });

  /* ═══════════════════════════════════════════════════════════
     2) BOUCLE D'INERTIE — lerp strict de currentScroll vers
        targetScroll ; targetScroll est TOUJOURS clampé avant
        d'être touché (drag, molette, ou inertie post-relâchement),
        jamais currentScroll directement.
  ═══════════════════════════════════════════════════════════ */
  function updateSlider() {
    requestAnimationFrame(updateSlider);

    if (!isDragging) {
      // La vélocité résiduelle continue de pousser la cible,
      // amortie par la friction, jusqu'à extinction — puis les
      // limites strictes du slider s'appliquent toujours via
      // clampScroll.
      if (Math.abs(velocity) > 0.0002) {
        targetScroll = clampScroll(targetScroll + velocity);
        velocity *= FRICTION;
      } else {
        velocity = 0;
      }
    }

    currentScroll = THREE.MathUtils.lerp(currentScroll, targetScroll, LERP_FACTOR);
    track.position.x = currentScroll;
    updateActiveDot();
  }
  updateSlider();

  /* ═══════════════════════════════════════════════════════════
     3) RAYCASTER — survol (affordance curseur) + clic réel
  ═══════════════════════════════════════════════════════════ */
  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2();
  let hoveredGroup = null;
  let focusedGroup = null;

  function toNDC(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  }

  function findPhoneGroup(object) {
    let obj = object;
    while (obj) {
      if (phones.includes(obj)) return obj;
      obj = obj.parent;
    }
    return null;
  }

  function raycastPhones() {
    raycaster.setFromCamera(pointerNDC, camera);
    const intersects = raycaster.intersectObjects(hitboxes, false);
    return intersects.length > 0 ? findPhoneGroup(intersects[0].object) : null;
  }

  // ── Lévitation GSAP au survol : soulève le téléphone survolé et le
  // redescend quand la souris le quitte. `isHovered` (scene.js) empêche
  // l'idle-float d'écraser ces tweens à chaque frame.
  function liftPhone(group) {
    group.userData.isHovered = true;
    gsap.to(group.position, { y: 0.6, duration: 0.4, ease: 'power2.out' });
    gsap.to(group.rotation, { x: -0.05, duration: 0.4, ease: 'power2.out' });
  }

  function lowerPhone(group) {
    gsap.to(group.position, {
      y: 0,
      duration: 0.4,
      ease: 'power2.out',
      onComplete: () => { group.userData.isHovered = false; },
    });
    gsap.to(group.rotation, { x: 0, duration: 0.4, ease: 'power2.out' });
  }

  function updateHoverPointer(clientX, clientY) {
    if (!window.introComplete || focusedGroup) return;
    toNDC(clientX, clientY);
    const group = raycastPhones();
    if (group !== hoveredGroup) {
      if (hoveredGroup) lowerPhone(hoveredGroup);
      if (group) liftPhone(group);
      hoveredGroup = group;
      canvas.style.cursor = group ? 'pointer' : (isDragging ? 'grabbing' : 'grab');
    }
  }

  function tryOpenProjectAt(clientX, clientY) {
    if (!window.introComplete || focusedGroup) return;
    toNDC(clientX, clientY);
    const group = raycastPhones();
    if (group) openProject(group);
  }

  /* ═══════════════════════════════════════════════════════════
     4) OUVERTURE / FERMETURE DU PANNEAU PROJET (GSAP)
  ═══════════════════════════════════════════════════════════ */
  const overlayEl = document.getElementById('project-overlay');
  const panelEl = document.querySelector('.project-panel');
  const closeBtn = document.getElementById('project-close');
  const tagEl = document.getElementById('project-tag');
  const titleEl = document.getElementById('project-title');
  const descEl = document.getElementById('project-desc');
  const featuresEl = document.getElementById('project-features');
  const linkEl = document.getElementById('project-link');

  function fillProjectPanel(app) {
    tagEl.textContent = app.tag;
    titleEl.textContent = app.name;
    descEl.textContent = app.desc;
    featuresEl.innerHTML = '';
    app.features.forEach((f) => {
      const li = document.createElement('li');
      li.textContent = f;
      featuresEl.appendChild(li);
    });
    linkEl.href = app.link;
  }

  // Fondu d'opacité d'un téléphone entier (coque + écran) — clone de
  // matériau par téléphone (scene.js), donc ça n'affecte que ce groupe.
  function fadePhoneGroup(group, opacity, duration) {
    group.traverse((obj) => {
      if (obj.isMesh && obj.material && 'opacity' in obj.material) {
        gsap.to(obj.material, { opacity, duration, ease: 'power2.inOut' });
      }
    });
  }

  function openProject(group) {
    if (focusedGroup) return;

    // Fige immédiatement le carrousel — sans ça, si l'utilisateur clique
    // juste après un drag/molette (inertie encore en cours), le slider
    // continuait de glisser via l'inertie APRÈS l'ouverture du projet
    // (updateSlider() tourne à chaque frame, peu importe qu'un projet
    // soit ouvert ou non). La caméra zoome elle sur un instantané figé
    // de la position du téléphone au moment du clic — si le téléphone
    // continue de bouger juste après, il se retrouve décentré par
    // rapport au cadrage de la caméra, qui lui ne bouge plus.
    velocity = 0;
    targetScroll = currentScroll;

    focusedGroup = group;
    group.userData.isFocused = true;
    hoveredGroup = null;
    canvas.style.cursor = 'default';
    window.__cameraLocked = true; // suspend le parallax souris (scene.js) pendant le zoom GSAP

    fillProjectPanel(APPS[group.userData.appIndex]);

    document.body.classList.add('modal-open'); // masque l'UI HTML (header/hero/footer) en opacité, pas le canvas

    const worldPos = new THREE.Vector3();
    group.getWorldPosition(worldPos);

    // Zoom poussé beaucoup plus loin : d=4.8 (était 6.0) — le téléphone
    // occupe ~78% de la hauteur visible au lieu de 62%, nettement plus
    // immersif. Marge de sécurité de 5% en haut du cadre (calcul exact,
    // pas à l'œil) pour ne jamais rogner l'encoche/barre de statut :
    // lookAt_y = worldPos.y + PHONE_HEIGHT/2 - (0.5 - 0.05) * F
    // avec F = 2 * 4.8 * tan(22.5°) ≈ 3.98 → offset ≈ -0.24.
    const lookTarget = new THREE.Vector3(worldPos.x, worldPos.y - 0.24, worldPos.z);
    // Le plan net (depth of field) doit suivre la nouvelle distance
    // caméra→téléphone, sinon le téléphone actif sortirait lui-même
    // du flou une fois zoomé (le focus par défaut, 8, correspond à la
    // distance de la vue carrousel, pas à ce zoom rapproché).
    // Focus repris (pas de coupure du DOF) — la pixelisation en vue
    // rapprochée venait de la résolution basse de la texture de
    // profondeur de BokehPass, corrigée à la source (scene.js). Plus
    // besoin de désactiver tout le DOF ici : le plan net suit la
    // nouvelle distance caméra→téléphone, donc le téléphone ouvert reste
    // net tout en gardant le fond flou.
    if (bokehPass) gsap.to(bokehPass.uniforms.focus, { value: 4.8, duration: 1.1, ease: 'power3.inOut' });
    gsap.to(camera.position, {
      x: worldPos.x * 0.55,
      y: worldPos.y + 0.3,
      z: worldPos.z + 4.8,
      duration: 1.1,
      ease: 'power3.inOut',
      onUpdate: () => camera.lookAt(lookTarget),
    });

    gsap.to(group.rotation, { x: 0, y: 0, duration: 1.1, ease: 'power3.inOut' });

    // Les téléphones voisins s'effacent (opacité), plutôt qu'un calque
    // noir sur tout le canvas — le téléphone actif reste pleinement
    // lumineux, seuls les autres se retirent de l'attention.
    phones.forEach((p) => { if (p !== group) fadePhoneGroup(p, 0.05, 0.6); });

    overlayEl.classList.add('is-open');
    gsap.to(panelEl, { opacity: 1, y: 0, duration: 0.6, delay: 0.35, ease: 'power2.out' });
  }

  function closeProject() {
    if (!focusedGroup) return;
    const group = focusedGroup;

    overlayEl.classList.remove('is-open'); // le panneau disparaît immédiatement, pas de décalage
    document.body.classList.remove('modal-open'); // réaffiche header/hero/footer
    gsap.to(panelEl, {
      opacity: 0, y: 40, duration: 0.4, ease: 'power2.in',
    });

    // Réaffiche les téléphones voisins
    phones.forEach((p) => { if (p !== group) fadePhoneGroup(p, 1, 0.6); });

    if (bokehPass) gsap.to(bokehPass.uniforms.focus, { value: DEFAULT_CAMERA_POS.z, duration: 1, ease: 'power3.inOut' }); // plan net revient à la distance de la vue carrousel (suit z mobile/desktop)
    gsap.to(camera.position, {
      x: DEFAULT_CAMERA_POS.x,
      y: DEFAULT_CAMERA_POS.y,
      z: DEFAULT_CAMERA_POS.z,
      duration: 1,
      ease: 'power3.inOut',
      onUpdate: () => camera.lookAt(0, -1.55, 0), // suit le nouveau centre du carrousel (CAROUSEL_Y dans scene.js)
      onComplete: () => {
        group.userData.isFocused = false;
        focusedGroup = null;
        window.__cameraLocked = false; // rend la main au parallax souris
      },
    });
  }

  closeBtn.addEventListener('click', closeProject);
  overlayEl.addEventListener('click', (e) => { if (e.target === overlayEl) closeProject(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && focusedGroup) closeProject(); });

  /* ═══════════════════════════════════════════════════════════
     5) MENU CONTACT — le CSS gère le survol (desktop), on ajoute
        le clic ici pour le tactile (pas de :hover fiable sur mobile).
  ═══════════════════════════════════════════════════════════ */
  const contactContainer = document.querySelector('.contact-dropdown-container');
  const contactBtn = document.getElementById('contact-btn');
  if (contactContainer && contactBtn) {
    contactBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      contactContainer.classList.toggle('is-open');
    });
    document.addEventListener('click', (e) => {
      if (!contactContainer.contains(e.target)) contactContainer.classList.remove('is-open');
    });
  }

  /* ═══════════════════════════════════════════════════════════
     6) TRAÎNÉE LUMINEUSE — curseur natif conservé. Un canvas plein
        écran dessine le tracé réel des positions récentes de la
        souris (ligne blanche, glow doux), qui s'efface progressivement
        derrière — pas un cercle qui suit, un vrai trait qui part de la
        souris. Neutre (pas de réaction au survol). Désactivé sur
        tactile (pointer:coarse).
  ═══════════════════════════════════════════════════════════ */
  if (window.matchMedia('(pointer: fine)').matches) {
    document.body.classList.add('has-custom-cursor');
    const customCursorEl = document.getElementById('custom-cursor');

    const trailCanvas = document.getElementById('cursor-trail-canvas');
    const trailCtx = trailCanvas.getContext('2d');

    function resizeTrailCanvas() {
      trailCanvas.width = window.innerWidth;
      trailCanvas.height = window.innerHeight;
    }
    resizeTrailCanvas();
    window.addEventListener('resize', resizeTrailCanvas);

    const TRAIL_MAX_AGE = 120; // ms — durée de vie du tracé avant disparition complète (plus court)
    let trailPoints = []; // { x, y, t }

    window.addEventListener('mousemove', (e) => {
      trailPoints.push({ x: e.clientX, y: e.clientY, t: performance.now() });
      // Curseur personnalisé — collé exactement à la souris, aucun lag.
      customCursorEl.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      customCursorEl.classList.add('is-visible');
    });
    document.addEventListener('mouseleave', () => customCursorEl.classList.remove('is-visible'));

    (function drawTrail() {
      requestAnimationFrame(drawTrail);
      const now = performance.now();
      trailPoints = trailPoints.filter((p) => now - p.t < TRAIL_MAX_AGE);

      trailCtx.clearRect(0, 0, trailCanvas.width, trailCanvas.height);
      if (trailPoints.length < 2) return;

      trailCtx.lineCap = 'round';
      trailCtx.lineJoin = 'round';
      trailCtx.shadowColor = 'rgba(255,255,255,0.9)';
      trailCtx.shadowBlur = 28; // bords très flous — effet fumée
      trailCtx.strokeStyle = '#ffffff';

      for (let i = 1; i < trailPoints.length; i++) {
        const p0 = trailPoints[i - 1];
        const p1 = trailPoints[i];
        const age = (now - p1.t) / TRAIL_MAX_AGE; // 0 = tout neuf, 1 = sur le point de disparaître
        trailCtx.globalAlpha = (1 - age) * 0.3;
        trailCtx.lineWidth = 10 * (1 - age) + 1; // plus large
        trailCtx.beginPath();
        trailCtx.moveTo(p0.x, p0.y);
        trailCtx.lineTo(p1.x, p1.y);
        trailCtx.stroke();
      }
      trailCtx.globalAlpha = 1;
    })();
  }

  /* ═══════════════════════════════════════════════════════════
     7) DÉMARRAGE
  ═══════════════════════════════════════════════════════════ */
  animate();
})();

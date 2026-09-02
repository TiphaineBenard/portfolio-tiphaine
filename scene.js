/* ═══════════════════════════════════════════════════════════════
   scene.js — Rendu premium : géométrie arrondie, matériaux PBR
   (verre fumé / métal), écrans CanvasTexture HD, éclairage studio.
═══════════════════════════════════════════════════════════════ */

window.Scene = (function () {

  const loadingManager = new THREE.LoadingManager();

  const scene = new THREE.Scene();
  // Pas de scene.background : le canvas reste transparent (renderer
  // alpha:true) pour laisser voir le dégradé CSS du body à travers.
  // Le fog, lui, ne pose pas ce problème : il ne s'applique qu'aux
  // pixels où un objet est réellement rendu (le sol miroir, les
  // téléphones), jamais au vide — la transparence de fond reste intacte.
  // Utile ici pour fondre le bord du plan du sol miroir dans le noir au
  // lieu qu'il s'arrête net sur une ligne visible. near=9 : la caméra
  // par défaut est à z=8, donc les téléphones (proches de l'origine)
  // ne sont quasiment pas affectés — seul le sol qui s'étend loin
  // derrière eux se fond progressivement.
  // far étendu (24→60) : le mur de fond est à z=-38, donc avec far=24 il
  // était fogué à 100% (noir), quelle que soit sa couleur — c'est ce qui
  // rendait tout réglage de teinte invisible. near=9 inchangé, donc les
  // téléphones/le sol proche ne sont pas affectés par ce changement.
  // far réétendu (60→80) : à z=-38 le mur n'était encore visible qu'à
  // ~27% de sa vraie couleur (le brouillard mange le reste), donc même
  // un spot beaucoup plus clair dans sa texture restait timide à l'écran.
  scene.fog = new THREE.Fog(0x020202, 9, 80);

  // Détection mobile (déplacée ici, avant la caméra, pour pouvoir
  // l'utiliser dans DEFAULT_CAMERA_POS ci-dessous).
  // BUG CORRIGÉ ICI — `maxTouchPoints > 0` / `pointer: coarse` se
  // déclenchent aussi sur un PC/laptop à écran tactile large (ex. ce
  // poste de test), qui n'a RIEN d'un mobile (GPU desktop classique,
  // grand écran). Ce PC a donc tourné en mode "mobile" (MSAA désactivé
  // à l'époque, puis boost de flou ×2.4) pendant une bonne partie de la
  // session, ce qui explique une partie des résultats incohérents
  // observés. Le tactile ne compte désormais comme signal "mobile" QUE
  // combiné à un écran étroit (< 1024px, comme un vrai téléphone/petite
  // tablette) — jamais sur un écran large, tactile ou non.
  const IS_MOBILE =
    /Android|iPhone|iPad|iPod|Mobi/i.test(navigator.userAgent) ||
    window.innerWidth < 820 ||
    (window.innerWidth < 1024 &&
      (navigator.maxTouchPoints > 0 ||
        (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)));

  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  // Centre vertical du carrousel (téléphones + sol) — défini ici en haut
  // du fichier car plusieurs éléments (caméra, glow light, slider plus
  // bas) doivent tous s'aligner dessus.
  const CAROUSEL_Y = -1.55; // ajustement fin entre -1.8 (trop bas) et -1.3 (trop haut, videait le bas)

  // z rapproché sur mobile (8→6.4) — sur un écran étroit, seul un
  // téléphone est visible à la fois (contrairement au desktop où les 4
  // sont côte à côte) : on peut donc zoomer sans rien couper, pour un
  // rendu plus impactant/grand sur mobile.
  const DEFAULT_CAMERA_POS = new THREE.Vector3(0, -0.6, IS_MOBILE ? 7 : 8);
  camera.position.copy(DEFAULT_CAMERA_POS);
  camera.lookAt(0, CAROUSEL_Y, 0);

  const canvas3d = document.getElementById('webgl-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas: canvas3d, alpha: true, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0); // transparent — le fond vient du CSS du body
  renderer.shadowMap.enabled = true;
  // VSMShadowMap → PCFSoftShadowMap. VSM fait un blur en 2 passes sur des
  // render targets séparés (moments de variance) — support/precision
  // moins fiables selon GPU/driver dans les versions three.js de cette
  // époque (r128) que le PCF classique. C'est un système TOTALEMENT
  // indépendant du Reflector (jamais touché avant dans cette session),
  // qui s'applique justement sur la zone qui reçoit l'ombre des
  // téléphones — le sol — sans dépendre de la perspective (un blur en
  // espace texture), ce qui correspond exactement au bruit uniforme et
  // insensible-à-la-profondeur observé, et explique pourquoi rien côté
  // Reflector ne le changeait : ce n'était pas la bonne piste.
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  if (THREE.ACESFilmicToneMapping) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
  }
  if (THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;

  /* ═══════════════════════════════════════════════════════════
     ENVIRONMENT MAP — LA vraie pièce manquante jusqu'ici. Toutes les
     itérations précédentes (RectAreaLight, rim light, plusieurs
     directionnelles...) tentaient de simuler des reflets avec des
     LUMIÈRES. Mais un matériau PBR (clearcoat, metalness) reflète
     surtout son ENVIRONNEMENT, pas juste les lampes directes — sans
     `scene.environment`, il n'a rien de crédible à refléter, d'où le
     rendu plat/plastique malgré tous les réglages de lumière. Ici, un
     petit "studio" généré en canvas (dégradé + bandeau clair simulant
     un softbox) transformé en vraie environment map via PMREMGenerator
     (coeur de three.js, aucun addon nécessaire). C'est la technique qui
     donne les reflets doux et réalistes des rendus produit pro.
  ═══════════════════════════════════════════════════════════ */
  function createStudioEnvironment() {
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();

    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size * 2;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // V2 — corrigé : la première version avait trop de gris moyen sur
    // une grande portion du dégradé, donc les coques reflétaient un
    // "voile gris" partout plutôt que rester sombres. Un vrai studio
    // photo produit est presque NOIR avec seulement des bandes de
    // softbox étroites et vives — c'est le contraste qui crée le reflet
    // net, pas un fond uniformément clair.
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Bandes lumineuses ("softbox") — v3, plus contrastées et plus larges
    // que la v2 : une vraie photo produit a des rectangles de softbox
    // nets qui se lisent comme des reflets rectangulaires sur le
    // clearcoat/métal (pas juste un filet fin). Toujours sur fond quasi
    // noir pour garder le contraste qui "accroche" l'oeil.
    ctx.fillStyle = 'rgba(255,255,255,1)';
    ctx.fillRect(0, size * 0.10, canvas.width, size * 0.06); // grande softbox haute — élargie
    ctx.fillRect(canvas.width * 0.58, size * 0.30, canvas.width * 0.34, size * 0.055); // softbox latérale — élargie
    ctx.fillRect(canvas.width * 0.06, size * 0.58, canvas.width * 0.28, size * 0.05); // 3e softbox — plus de reflets répartis sur le métal poli
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(canvas.width * 0.04, size * 0.46, canvas.width * 0.18, size * 0.03); // petite touche de remplissage
    // Touche de lumière chaude discrète en bas (sol) pour éviter un noir
    // totalement mort sur les surfaces qui font face vers le bas.
    ctx.fillStyle = 'rgba(110,100,90,0.35)';
    ctx.fillRect(0, size * 0.82, canvas.width, size * 0.18);

    const equirectTexture = new THREE.CanvasTexture(canvas);
    equirectTexture.mapping = THREE.EquirectangularReflectionMapping;
    const envRenderTarget = pmrem.fromEquirectangular(equirectTexture);
    equirectTexture.dispose();
    pmrem.dispose();
    return envRenderTarget.texture;
  }
  scene.environment = createStudioEnvironment(); // s'applique automatiquement à tous les MeshPhysicalMaterial de la scène

  /* ═══════════════════════════════════════════════════════════
     ÉCLAIRAGE — v3, plus cinématique. Toujours UNE seule
     DirectionalLight neutre pour les ombres (pas de couleurs qui se
     contrarient, leçon retenue des essais précédents), mais poussée
     plus sur le côté pour un vrai modelé de volume (teaser produit,
     pas un plat catalogue e-commerce) + ambiante encore réduite pour
     que le contraste se voie vraiment + une fill light froide et TRÈS
     discrète en contre-jour (pas de shadow, pas de reflet net — juste
     assez pour que le côté ombre ne soit pas un trou noir total).
  ═══════════════════════════════════════════════════════════ */
  scene.add(new THREE.AmbientLight(0xffffff, 0.22)); // 0.32→0.22 : plus de contraste

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.9); // 1.5→1.9 : modelé plus marqué
  keyLight.position.set(4.5, 6.5, 3.5); // plus latéral qu'avant (2,8,4) : vraies ombres portées lisibles, pas juste zénithal
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 2048;
  keyLight.shadow.mapSize.height = 2048;
  keyLight.shadow.radius = 22; // légèrement resserré (28→22) : ombre encore douce mais moins "brumeuse"
  keyLight.shadow.blurSamples = 20;
  keyLight.shadow.bias = -0.0015;
  keyLight.shadow.camera.left = -8;
  keyLight.shadow.camera.right = 8;
  keyLight.shadow.camera.top = 5;
  keyLight.shadow.camera.bottom = -5;
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 24;
  scene.add(keyLight);

  // Fill froide en contre-jour — neutre/bleuté très léger, sans ombre,
  // uniquement pour que le côté opposé au key light garde un peu de
  // matière au lieu de sombrer dans un noir absolu. Contrairement aux
  // essais rejetés précédemment (RectAreaLight, rim 3 points colorés),
  // celle-ci est diffuse et très faible : elle ne crée aucun liseré,
  // juste un dégradé d'ombre plus riche, comme un vrai fill de studio photo.
  const fillLight = new THREE.DirectionalLight(0x9fb4d8, 0.28);
  fillLight.position.set(-5, 2, -4);
  scene.add(fillLight);

  /* ═══════════════════════════════════════════════════════════
     REFLECTOR ANTI-ALIASÉ — THREE.Reflector (examples/js) fait son
     propre `renderer.render(scene, virtualCamera)` vers SA render
     target à lui, en dehors de notre EffectComposer. Le fix MSAA
     appliqué plus bas (WebGLMultisampleRenderTarget dans le composer)
     ne le couvre donc PAS : ses reflets restent crénelés même quand
     tout le reste de la scène est lissé. Reflector.js fige aussi son
     filtrage en dur (LinearFilter, pas de mipmaps) sans option pour le
     changer à la construction. Solution : reprendre la même logique
     (identique à l'addon officiel) mais avec une render target
     multisample dès la création — la seule vraie façon de corriger
     l'anti-aliasing de ses reflets.
  ═══════════════════════════════════════════════════════════ */
  function createReflectorMSAA(geometry, options = {}) {
    const mesh = new THREE.Mesh(geometry);
    mesh.type = 'Reflector';
    const color = options.color !== undefined ? new THREE.Color(options.color) : new THREE.Color(0x7f7f7f);
    const textureWidth = options.textureWidth || 512;
    const textureHeight = options.textureHeight || 512;
    const clipBias = options.clipBias || 0;
    const shader = THREE.Reflector.ReflectorShader;

    const reflectorPlane = new THREE.Plane();
    const normal = new THREE.Vector3();
    const reflectorWorldPosition = new THREE.Vector3();
    const cameraWorldPosition = new THREE.Vector3();
    const rotationMatrix = new THREE.Matrix4();
    const lookAtPosition = new THREE.Vector3(0, 0, -1);
    const clipPlane = new THREE.Vector4();
    const view = new THREE.Vector3();
    const target = new THREE.Vector3();
    const q = new THREE.Vector4();
    const textureMatrix = new THREE.Matrix4();
    const virtualCamera = new THREE.PerspectiveCamera();

    // Frame-skip sur mobile — le rendu du reflet est un rendu de scène
    // COMPLET en plus, chaque frame ; c'est la vraie source du
    // "saccadé" signalé, indépendamment de la résolution de la
    // texture. Sur mobile, on ne recalcule le reflet qu'une frame sur
    // deux : la texture précédente reste affichée entre deux mises à
    // jour (le reflet bouge très peu d'une frame à l'autre, donc
    // invisible à l'oeil), ce qui divise quasiment par deux le coût
    // GPU de cette fonctionnalité sans rien sacrifier sur la netteté.
    let frameCounter = 0;
    const UPDATE_EVERY = IS_MOBILE ? 2 : 1;

    // IMPORTANT — retour à la config STOCK de l'addon officiel Reflector
    // pour ce render target (LinearFilter simple, pas de mipmaps, pas
    // d'anisotropie, pas de MSAA). Chaque tentative d'améliorer la
    // netteté ici (MSAA, puis mipmaps+anisotropie régénérés chaque
    // frame) a produit un bug de corruption visuelle différent sur des
    // GPU/drivers différents (bruit diagonal arc-en-ciel, puis pattern
    // scanline/entrelacé + blocs verts) — y compris après avoir retiré
    // le MSAA, donc la vraie cause commune est très probablement la
    // régénération de mipmaps CHAQUE FRAME sur une texture NPOT (la
    // taille suit la fenêtre, donc quasi jamais une puissance de 2) :
    // combo connu pour corrompre le rendu sur pas mal de drivers GPU,
    // surtout en re-render-to-texture dynamique. C'est exactement la
    // config que l'addon officiel utilise partout sans ce problème.
    // La netteté vient maintenant uniquement de la sur-résolution
    // (texture rendue plus grande que l'écran, voir plus bas) — un
    // reflet en LinearFilter simple à haute résolution reste net.
    // RGBFormat (3 canaux, sans alpha) → RGBAFormat : en WebGL2 (contexte
    // par défaut sur la quasi-totalité des navigateurs actuels, mobile
    // et desktop), RGBFormat n'est PAS garanti "color-renderable" par la
    // spec — seul RGBA l'est de façon garantie. C'est un bug documenté
    // de l'addon Reflector officiel : sur WebGL2, ça produit un
    // framebuffer mal formé → exactement le bruit d'interférence bleu/
    // vert observé, identique sur tous les appareils, indépendamment du
    // MSAA/mipmaps (qui n'étaient donc pas la vraie cause).
    const RTClass = THREE.WebGLRenderTarget;
    const renderTarget = new RTClass(textureWidth, textureHeight, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    });

    const material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(shader.uniforms),
      fragmentShader: shader.fragmentShader,
      vertexShader: shader.vertexShader,
    });
    material.uniforms.tDiffuse.value = renderTarget.texture;
    material.uniforms.color.value = color;
    material.uniforms.textureMatrix.value = textureMatrix;
    mesh.material = material;

    mesh.onBeforeRender = function (r, sc, cam) {
      // GARDE-FOU — vraie cause du bruit d'interférence avec le DOF actif :
      // BokehPass force `scene.overrideMaterial` (un MeshDepthMaterial)
      // sur TOUTE la scène pour calculer sa texture de profondeur, en
      // rappelant renderer.render(scene, camera). Comme le miroir fait
      // lui-même un second renderer.render(scene, ...) DANS son propre
      // onBeforeRender, ce rendu imbriqué se déclenchait alors qu'on
      // était déjà en plein rendu "profondeur" de BokehPass — deux
      // renderer.render() imbriqués avec un overrideMaterial actif,
      // combinaison non prévue, qui corrompait l'état du renderer.
      // Pendant une passe overrideMaterial, on n'a de toute façon pas
      // besoin du reflet réel : la géométrie du miroir suffit pour que
      // le pass de profondeur fonctionne normalement. On saute donc le
      // rendu imbriqué dans ce cas précis.
      if (sc.overrideMaterial) return;

      frameCounter++;
      if (frameCounter % UPDATE_EVERY !== 0) return; // garde le rendu de la frame précédente tel quel

      reflectorWorldPosition.setFromMatrixPosition(mesh.matrixWorld);
      cameraWorldPosition.setFromMatrixPosition(cam.matrixWorld);
      rotationMatrix.extractRotation(mesh.matrixWorld);
      normal.set(0, 0, 1);
      normal.applyMatrix4(rotationMatrix);
      view.subVectors(reflectorWorldPosition, cameraWorldPosition);
      if (view.dot(normal) > 0) return;
      view.reflect(normal).negate();
      view.add(reflectorWorldPosition);
      rotationMatrix.extractRotation(cam.matrixWorld);
      lookAtPosition.set(0, 0, -1);
      lookAtPosition.applyMatrix4(rotationMatrix);
      lookAtPosition.add(cameraWorldPosition);
      target.subVectors(reflectorWorldPosition, lookAtPosition);
      target.reflect(normal).negate();
      target.add(reflectorWorldPosition);
      virtualCamera.position.copy(view);
      virtualCamera.up.set(0, 1, 0);
      virtualCamera.up.applyMatrix4(rotationMatrix);
      virtualCamera.up.reflect(normal);
      virtualCamera.lookAt(target);
      virtualCamera.far = cam.far;
      virtualCamera.updateMatrixWorld();
      virtualCamera.projectionMatrix.copy(cam.projectionMatrix);

      textureMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
      textureMatrix.multiply(virtualCamera.projectionMatrix);
      textureMatrix.multiply(virtualCamera.matrixWorldInverse);
      textureMatrix.multiply(mesh.matrixWorld);

      reflectorPlane.setFromNormalAndCoplanarPoint(normal, reflectorWorldPosition);
      reflectorPlane.applyMatrix4(virtualCamera.matrixWorldInverse);
      clipPlane.set(reflectorPlane.normal.x, reflectorPlane.normal.y, reflectorPlane.normal.z, reflectorPlane.constant);
      const projectionMatrix = virtualCamera.projectionMatrix;
      q.x = (Math.sign(clipPlane.x) + projectionMatrix.elements[8]) / projectionMatrix.elements[0];
      q.y = (Math.sign(clipPlane.y) + projectionMatrix.elements[9]) / projectionMatrix.elements[5];
      q.z = -1;
      q.w = (1 + projectionMatrix.elements[10]) / projectionMatrix.elements[14];
      clipPlane.multiplyScalar(2 / clipPlane.dot(q));
      projectionMatrix.elements[2] = clipPlane.x;
      projectionMatrix.elements[6] = clipPlane.y;
      projectionMatrix.elements[10] = clipPlane.z + 1 - clipBias;
      projectionMatrix.elements[14] = clipPlane.w;

      renderTarget.texture.encoding = r.outputEncoding;
      mesh.visible = false;
      const currentRenderTarget = r.getRenderTarget();
      const currentXrEnabled = r.xr.enabled;
      const currentShadowAutoUpdate = r.shadowMap.autoUpdate;
      r.xr.enabled = false;
      r.shadowMap.autoUpdate = false;
      r.setRenderTarget(renderTarget);
      r.state.buffers.depth.setMask(true);
      if (r.autoClear === false) r.clear();
      r.render(sc, virtualCamera);
      r.xr.enabled = currentXrEnabled;
      r.shadowMap.autoUpdate = currentShadowAutoUpdate;
      r.setRenderTarget(currentRenderTarget);
      const viewport = cam.viewport;
      if (viewport !== undefined) r.state.viewport(viewport);
      mesh.visible = true;
    };

    return mesh;
  }

  /* ═══════════════════════════════════════════════════════════
     SOL MIROIR — remis (l'utilisateur aimait l'effet), mais corrigé :
     le premier essai utilisait une render target haute résolution, donc
     le reflet était NET — on lisait le texte des écrans à l'envers, ce
     qui se voyait comme un bug plutôt qu'un reflet de studio. Ici, la
     render target est volontairement basse résolution (le upscale flou
     le résultat, aucun post-process de blur nécessaire) + une teinte
     sombre qui réduit le contraste du reflet — le résultat visé est un
     reflet suggéré et doux, comme un plateau laqué, pas un miroir net.
  ═══════════════════════════════════════════════════════════ */
  // Retour près du tout premier réglage (celui que l'utilisateur
  // préférait) : le sol proche des téléphones pour un reflet net et
  // visible juste en-dessous, pas noyé loin derrière.
  const FLOOR_Y = CAROUSEL_Y - 1.9;
  // Remis sur mobile — la vraie source du "saccadé" était le rendu de
  // scène complet fait CHAQUE frame par le reflet (voir le frame-skip
  // dans createReflectorMSAA, plus haut), pas la résolution en tant que
  // telle. Résolution poussée au-dessus de la taille écran pour un rendu
  // net même en zoomant — la texture est mipmappée/anisotropique, donc
  // ce surplus de résolution ne coûte quasiment rien au rendu (juste un
  // peu de VRAM), à l'inverse du framerate qui lui était le vrai
  // problème.
  //
  // Le plafond fixe (4096×2160) utilisé avant ne tenait pas compte de la
  // vraie limite du GPU. Sur un GPU mobile dont gl.MAX_TEXTURE_SIZE est
  // plus bas que ce plafond, demander une texture plus grande que ce que
  // le driver peut réellement allouer produit un buffer corrompu/mal
  // formé — ce qui correspond exactement au nouveau pattern de
  // corruption (bandes scanline + blocs verts) constaté après avoir
  // poussé la résolution. On plafonne donc dynamiquement sur la vraie
  // capacité du device (renderer.capabilities.maxTextureSize), et on
  // utilise un facteur de sur-résolution plus prudent sur mobile (GPU/
  // VRAM plus limités) que sur desktop.
  if (THREE.Reflector) {
    const FLOOR_SIZE_X = 400;
    const FLOOR_SIZE_Z = 300;
    const dpr = Math.min(window.devicePixelRatio, 2);
    const MIRROR_RES_SCALE = IS_MOBILE ? 1.1 : 1.8;
    const MAX_TEX = renderer.capabilities.maxTextureSize || 4096;
    // TROUVÉ — la vraie cause de la corruption (identique sur tous les
    // devices, insensible à tous les changements MSAA/mipmap/format
    // tentés avant) : le fragment shader du Reflector officiel ne fait
    // PAS un simple tint/multiply avec `color`, il fait un blend
    // "overlay" (style Photoshop, voir texture2DProj + blendOverlay dans
    // Reflector.js). Ce blend est neutre autour de gris moyen (0x7f7f7f,
    // la valeur par défaut de l'addon) mais devient une fonction très
    // non-linéaire et RAIDE quand `color` est poussé vers le quasi-noir
    // (0x080808 ≈ 3% de gris, réglé ainsi au fil des itérations
    // "assombris encore"). Cette pente amplifie fortement le moindre
    // bruit/crénelage déjà présent dans la texture réfléchie (bords des
    // téléphones, poussière additive, texte) → exactement le bruit
    // d'interférence bleu/vert observé, constant quel que soit le device
    // puisque c'est un bug mathématique du shader, pas un problème GPU.
    // Fix : remonter `color` près du gris neutre (sûr pour ce blend) et
    // reporter l'essentiel de l'assombrissement sur fadeMesh plus bas
    // (alpha-blend linéaire classique, non-sujet à ce problème).
    const mirrorFloor = createReflectorMSAA(new THREE.PlaneGeometry(FLOOR_SIZE_X, FLOOR_SIZE_Z), {
      color: 0x282828, // rassombri — le vrai bug (BokehPass) est identifié et réglé, donc on peut foncer sans risque
      textureWidth: Math.min(MAX_TEX, Math.round(window.innerWidth * dpr * MIRROR_RES_SCALE)),
      textureHeight: Math.min(MAX_TEX, Math.round(window.innerHeight * dpr * MIRROR_RES_SCALE)),
    });
    mirrorFloor.rotation.x = -Math.PI / 2;
    mirrorFloor.position.y = FLOOR_Y;
    scene.add(mirrorFloor);

    // Mur de fond — referme le vide au-dessus de l'horizon du sol.
    // Reprend l'effet "spot studio" du dégradé CSS (radial, clair au
    // centre → noir sur les bords) mais UNIQUEMENT ici, sur le mur —
    // pas sur le sol ni en repeignant tout le fond CSS. La base (bas du
    // mur, au ras du sol) reste sombre pour garder la jonction invisible.
    const wallCanvas = document.createElement('canvas');
    wallCanvas.width = 1024;
    wallCanvas.height = 512;
    const wallCtx = wallCanvas.getContext('2d');
    // 1. Fond de base sombre (sert aussi de couleur aux bords/coins,
    // hors du spot, et à la jonction avec le sol tout en bas).
    wallCtx.fillStyle = '#080808';
    wallCtx.fillRect(0, 0, 1024, 512);
    // 2. Spot radial clair — vignettage complet (clair au centre, sombre
    // aux extrémités, dans toutes les directions).
    // Le mur (140×70) est centré à CAROUSEL_Y+12 en Y, donc BEAUCOUP plus
    // haut que la caméra/les téléphones (autour de CAROUSEL_Y) : la
    // caméra ne voit en réalité que le BAS du mur, pas son centre
    // géométrique. Le 1er essai centrait le spot vers le haut du canvas
    // (Y=210/512) → il tombait hors du champ visible, d'où "rien n'a
    // changé". Recalculé pour correspondre à la hauteur réellement
    // cadrée par la caméra (CAROUSEL_Y) une fois convertie en
    // coordonnée canvas (texture V, flipY par défaut) : Y≈345.
    // Rayon réduit (480→320) et le milieu du dégradé assombri (0x3c→0x14)
    // pour que la chute vers le noir soit plus rapide/marquée — le
    // centre reste clair mais les bords retombent vite dans le noir.
    const spotGrad = wallCtx.createRadialGradient(512, 345, 0, 512, 345, 320);
    spotGrad.addColorStop(0, '#7a7a7f');
    spotGrad.addColorStop(0.35, '#141416');
    spotGrad.addColorStop(1, '#000000');
    wallCtx.fillStyle = spotGrad;
    wallCtx.fillRect(0, 0, 1024, 512);

    // Fondu du BAS du mur vers la transparence — jusqu'ici le mur était
    // un rectangle opaque qui s'arrêtait net pile là où l'œil rencontre
    // le sol, créant une arête/un coin dur bien visible ("l'angle du mur
    // au sol"). En le rongeant progressivement en alpha sur les derniers
    // ~30% de sa hauteur (destination-out = découpe l'alpha existant,
    // sans toucher aux couleurs déjà peintes), le mur se dissout dans le
    // sol/le fog au lieu de finir sur une ligne géométrique nette — plus
    // besoin que les couleurs matchent parfaitement, il n'y a juste plus
    // de bord dur du tout à cet endroit.
    wallCtx.globalCompositeOperation = 'destination-out';
    const bottomFade = wallCtx.createLinearGradient(0, 512 * 0.68, 0, 512);
    bottomFade.addColorStop(0, 'rgba(0,0,0,0)');
    bottomFade.addColorStop(1, 'rgba(0,0,0,1)');
    wallCtx.fillStyle = bottomFade;
    wallCtx.fillRect(0, 512 * 0.68, 1024, 512 * 0.32);
    wallCtx.globalCompositeOperation = 'source-over';

    const wallTexture = new THREE.CanvasTexture(wallCanvas);

    // fog:false cassait tout : le mur s'affichait à pleine luminosité,
    // sans aucun fondu atmosphérique, et ça écrasait toute la scène (lui
    // + son reflet dans le miroir). Remis fog:true — le vrai fix est
    // d'étendre scene.fog.far plus bas (near=9 reste inchangé, donc les
    // téléphones ne sont pas affectés), pour que le mur à z=-38 ne soit
    // plus fogué à 100% mais garde un fondu progressif ET sa couleur.
    // transparent:true — nécessaire pour que le fondu alpha du bas
    // (ci-dessus) soit réellement pris en compte au rendu.
    const backWall = new THREE.Mesh(
      new THREE.PlaneGeometry(140, 70),
      new THREE.MeshBasicMaterial({ map: wallTexture, fog: true, transparent: true, depthWrite: false })
    );
    backWall.position.set(0, CAROUSEL_Y + 12, -38);
    scene.add(backWall);

    // Fondu des bords du miroir — Reflector utilise un ShaderMaterial
    // "maison" qui n'inclut PAS le chunk fog de three.js, donc
    // `scene.fog` (ajouté plus haut) ne l'affecte pas du tout : sans ce
    // masque, le reflet s'arrêterait net sur une arête carrée visible.
    // Un second plan, juste au-dessus, avec un dégradé radial (centre
    // transparent → bords noir opaque) peint à la main en canvas,
    // fait ce fondu en s'alpha-blendant par-dessus le reflet.
    const fadeCanvas = document.createElement('canvas');
    fadeCanvas.width = 512;
    fadeCanvas.height = 512;
    const fadeCtx = fadeCanvas.getContext('2d');
    // Centre plus assombri (0 → 0.45 opacité, au lieu de transparent) :
    // c'est ce voile en alpha-blend linéaire classique qui assure
    // maintenant l'essentiel de l'assombrissement du reflet (à la place
    // du blend "overlay" du shader Reflector, voir commentaire plus haut
    // sur mirrorFloor) — sûr, sans amplifier le bruit de la texture.
    const fadeGrad = fadeCtx.createRadialGradient(256, 256, 0, 256, 256, 256);
    fadeGrad.addColorStop(0, 'rgba(0,0,0,0.55)');
    fadeGrad.addColorStop(0.45, 'rgba(0,0,0,0.65)');
    fadeGrad.addColorStop(1, 'rgba(0,0,0,1)');
    fadeCtx.fillStyle = fadeGrad;
    fadeCtx.fillRect(0, 0, 512, 512);
    const fadeTexture = new THREE.CanvasTexture(fadeCanvas);
    const fadeMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(FLOOR_SIZE_X, FLOOR_SIZE_Z), // même taille que le miroir : le dégradé rond s'étire en ellipse via l'aspect du plan
      new THREE.MeshBasicMaterial({ map: fadeTexture, transparent: true, depthWrite: false })
    );
    fadeMesh.rotation.x = -Math.PI / 2;
    fadeMesh.position.y = FLOOR_Y + 0.004;
    scene.add(fadeMesh);
    // (Le voile d'atténuation à -10% testé juste avant a été retiré : combiné
    // à la teinte déjà sombre, il rendait le reflet quasi invisible — retour
    // à un reflet clairement visible, comme demandé.)
  }

  // Ombre de contact retirée à la demande (le reflet du sol miroir
  // suffit à ancrer les téléphones visuellement, sans la tache d'ombre
  // en plus).

  /* ═══════════════════════════════════════════════════════════
     ATMOSPHÈRE — poussière lumineuse en suspension. Contrairement aux
     anciennes "formes flottantes" (retirées pour le minimalisme), ce
     ne sont pas des objets décoratifs qui distraient : juste des points
     minuscules, très discrets, qui donnent une profondeur d'air dans
     la scène — la texture qui manque souvent aux rendus 3D "propres
     mais vides". THREE.Points + sprite en dégradé radial (coeur de
     three.js, aucun addon).
  ═══════════════════════════════════════════════════════════ */
  function createDustTexture() {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const cx = c.getContext('2d');
    const g = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    cx.fillStyle = g;
    cx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  const DUST_COUNT = 160;
  const dustGeometry = new THREE.BufferGeometry();
  const dustPositions = new Float32Array(DUST_COUNT * 3);
  const dustSpeeds = new Float32Array(DUST_COUNT);
  for (let i = 0; i < DUST_COUNT; i++) {
    dustPositions[i * 3] = (Math.random() - 0.5) * 22;               // x : large étalement
    dustPositions[i * 3 + 1] = CAROUSEL_Y + (Math.random() - 0.2) * 8; // y : autour du carrousel, un peu plus haut que bas
    dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 14 - 2;         // z : entre et autour des téléphones
    dustSpeeds[i] = 0.04 + Math.random() * 0.07;
  }
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dustMaterial = new THREE.PointsMaterial({
    size: 0.045,
    map: createDustTexture(),
    transparent: true,
    opacity: 0.35, // discret — de l'air, pas de la neige
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const dustField = new THREE.Points(dustGeometry, dustMaterial);
  scene.add(dustField);

  /* ═══════════════════════════════════════════════════════════
     SOURIS — normalisée en [-1, 1], pilote le parallax caméra et
     le glow lumineux (cf. animate()).
  ═══════════════════════════════════════════════════════════ */
  let mouseX = 0;
  let mouseY = 0;
  window.addEventListener('pointermove', (e) => {
    mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
  });

  /* ═══════════════════════════════════════════════════════════
     GLOW INTERACTIF — PointLight vibrante qui suit la souris,
     balaie le fond sombre et les bords métalliques des téléphones.
     (Restauré — ce n'était pas elle le problème de "coins pas
     réalistes", c'est la géométrie du bevel, voir buildRoundedBoxGeometry.)
  ═══════════════════════════════════════════════════════════ */
  const glowLight = new THREE.PointLight(0xff007f, 3, 15);
  glowLight.position.set(0, CAROUSEL_Y, -2);
  scene.add(glowLight);

  /* ═══════════════════════════════════════════════════════════
     CATALOGUE — 4 applications réelles du portfolio.
  ═══════════════════════════════════════════════════════════ */
  const APPS = [
    {
      name: 'EventPro',
      icon: 'EV',
      sector: 'ÉVÉNEMENTIEL',
      accent: '#6b2179',
      tag: 'Boucherie / Traiteur — Événementiel',
      desc: "Gestion complète des commandes événementielles (Noël, réveillon, mariages, banquets) pour plusieurs magasins en simultané, avec production cuisine synchronisée en temps réel.",
      features: ['Commandes multi-magasins temps réel', 'Production cuisine synchronisée', 'Étiquettes & bons de préparation', "Dashboard & journal d'audit"],
      link: '../EventPro_Demo/index.html',
    },
    {
      name: 'Pointage Pro',
      icon: 'PO',
      sector: 'TRANSPORT',
      accent: '#f97316',
      tag: 'Transport & Dépannage',
      desc: "Suivi des heures et planning hebdomadaire pour équipes terrain, avec calcul automatique des heures supplémentaires et export mensuel.",
      features: ['12 employés, planning hebdomadaire', 'Calcul automatique heures sup.', 'Export & rapports mensuels', 'Prise en main immédiate'],
      link: '../PointagePro_Demo/index.html',
    },
    {
      name: 'Commandes',
      icon: 'CO',
      sector: 'PRODUCTION',
      accent: '#dc2626',
      tag: 'Boucherie / Traiteur — 5 magasins',
      desc: "Bons de commande quotidiens pour 5 magasins boucherie, atelier de production en temps réel, feuilles d'impression par rayon.",
      features: ['Atelier temps réel (Firebase)', 'Feuilles d’impression par rayon', 'Admin produits & catégories', '5 magasins synchronisés'],
      link: '../Commandes_Demo/index.html',
    },
    {
      name: 'PadelPro',
      icon: 'PA',
      sector: 'SPORT',
      accent: '#2563eb',
      tag: 'Sport — Clubs de padel',
      desc: "Gestion complète de tournois de padel : joueurs, équipes, poules, tableaux, planning des terrains et classements en direct.",
      features: ['Joueurs, équipes, poules & tableaux', 'Planning terrains & scores en direct', 'Classements barème FFT 2026', 'Historique & statistiques'],
      link: '../PadelPro_Demo/index.html',
    },
  ];

  /* ═══════════════════════════════════════════════════════════
     CANVASTEXTURE HD — écran soigné (1024×2048)
  ═══════════════════════════════════════════════════════════ */
  // Dessine du texte avec un espacement de lettres manuel — plus fiable
  // que `ctx.letterSpacing` (support navigateur inégal selon les versions
  // de Chrome/Edge/Safari) ; fonctionne partout, sans dépendance.
  function fillTextSpaced(ctx, text, x, y, spacing, centered) {
    const chars = [...text];
    let totalWidth = 0;
    chars.forEach((c, i) => {
      totalWidth += ctx.measureText(c).width + (i < chars.length - 1 ? spacing : 0);
    });
    let cursorX = centered ? x - totalWidth / 2 : x;
    const prevAlign = ctx.textAlign;
    ctx.textAlign = 'left'; // on gère nous-mêmes le positionnement caractère par caractère
    chars.forEach((c) => {
      ctx.fillText(c, cursorX, y);
      cursorX += ctx.measureText(c).width + spacing;
    });
    ctx.textAlign = prevAlign;
  }

  // Découpe un texte en lignes qui tiennent dans `maxWidth`, en coupant
  // sur les espaces (word-wrap). Utilisé pour le descriptif métier de
  // la carte du bas, qui ne doit jamais déborder du cadre du téléphone.
  function wrapText(ctx, text, maxWidth, maxLines) {
    const words = text.split(' ');
    const lines = [];
    let current = words[0];
    for (let i = 1; i < words.length; i++) {
      const test = current + ' ' + words[i];
      if (ctx.measureText(test).width <= maxWidth) {
        current = test;
      } else {
        lines.push(current);
        current = words[i];
      }
    }
    lines.push(current);

    if (lines.length > maxLines) {
      const truncated = lines.slice(0, maxLines);
      let lastLine = truncated[maxLines - 1];
      while (ctx.measureText(lastLine + '…').width > maxWidth && lastLine.length > 0) {
        lastLine = lastLine.slice(0, -1);
      }
      truncated[maxLines - 1] = lastLine + '…';
      return truncated;
    }
    return lines;
  }

  // Descriptif métier court, propre à chaque app — affiché dans la
  // carte translucide du bas ("FONCTIONNALITÉ CLÉ").
  const APP_HIGHLIGHTS = {
    'EventPro': "Commandes événementielles multi-magasins synchronisées en temps réel.",
    'Pointage Pro': "Suivi des heures et plannings terrain, heures sup. calculées automatiquement.",
    'Commandes': "Bons de commande quotidiens et atelier de production pour 5 magasins.",
    'PadelPro': "Tournois, poules et classements de padel gérés en direct.",
  };

  // Registre des textures d'écran actives — permet de les redessiner
  // périodiquement (horloge en temps réel) sans tout reconstruire.
  const screenTextureInstances = [];

  function createScreenTexture(appName, bgColor, icon, sector) {
    const canvas = document.createElement('canvas');
    // Texte "un peu flou" signalé sur les écrans (mobile + desktop) —
    // le canvas source ne faisait que 512×1024px. Une fois mappé sur un
    // écran de téléphone qui occupe une bonne partie du cadrage (surtout
    // en vue rapprochée/reflet), cette résolution devient insuffisante
    // et le texte/les formes paraissent doux même avec un bon filtrage.
    // RES_SCALE fait tourner le canvas source à 2x la résolution — tout
    // le code de dessin ci-dessous continue de raisonner en coordonnées
    // LOGIQUES (CW×CH = 512×1024, via ctx.scale), donc aucune valeur de
    // mise en page n'a besoin de changer.
    const RES_SCALE = 2;
    const CW = 512;
    const CH = 1024;
    canvas.width = CW * RES_SCALE;
    canvas.height = CH * RES_SCALE;
    const ctx = canvas.getContext('2d');
    ctx.scale(RES_SCALE, RES_SCALE);
    // 60→72 : la coque (CASE_RADIUS) est passée à 0.22 world (avant 0.15),
    // donc le masque arrondi de l'écran doit grandir en proportion pour
    // rester visuellement niché dedans (sinon écran presque carré à
    // l'intérieur d'une coque désormais bien plus arrondie).
    const R = 72;      // radius du masque arrondi — effet écran de smartphone moderne
    const PAD = 50;    // padding gauche global — grille éditoriale, plus de centrage

    function draw() {
      // 1. Fond transparent — rien en dehors de la zone arrondie ne doit
      // subsister, sinon les coins du plan restent carrés à l'écran.
      ctx.clearRect(0, 0, CW, CH);

      // 2. Chemin aux bords arrondis, rempli d'un dégradé élégant — tout
      // ce qui est peint après reste confiné à cette zone (clip()).
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(0, 0, CW, CH, R);
      ctx.clip();

      const grad = ctx.createLinearGradient(0, 0, 0, CH);
      grad.addColorStop(0, '#1c1a20');
      grad.addColorStop(1, bgColor);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CW, CH);

      // 3. Barre d'état — vend l'illusion du smartphone, heure réelle
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = '600 24px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const now = new Date();
      const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
      ctx.fillText(currentTime, 40, 40);

      // 3 petits ronds à droite (batterie / réseau / wifi, stylisés)
      [0, 1, 2].forEach((i) => {
        ctx.beginPath();
        ctx.arc(CW - 60 - i * 22, 50, 5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fill();
      });

      // Poinçon caméra frontale — centré en haut, collé au bord supérieur
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.roundRect(CW / 2 - 20, 4, 40, 12, 6);
      ctx.fill();

      // Mode centré absolu — icône, titre et sous-titre alignés sur ce
      // même axe X, quelle que soit la longueur du nom de l'app.
      const centerX = CW / 2;

      // Badge d'application — centré, remonté vers le centre-haut.
      // Sigle à 2 lettres (icon, passé par APPS) plutôt que la seule
      // initiale : "Pointage Pro" et "PadelPro" partageaient toutes les
      // deux 'P', désormais 'PO' / 'PA' — plus de doublon.
      const ICON_W = 84;
      const ICON_H = 70;
      const iconY = CH / 2 - 160;
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.beginPath();
      ctx.roundRect(centerX - ICON_W / 2, iconY, ICON_W, ICON_H, 18);
      ctx.fill();

      const badgeText = (icon || appName.charAt(0)).toUpperCase();
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 30px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, centerX, iconY + ICON_H / 2 + 2);

      // 4. Titre de l'app — centré, jamais poussé vers la droite même sur
      // un nom long.
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 55px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 15;
      ctx.shadowOffsetY = 5;
      ctx.fillText(appName.toUpperCase(), centerX, CH / 2 - 40);
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // 5. Sous-titre — secteur client plutôt que "PWA SUR MESURE" répété
      // à l'identique sur les 4 cartes (aucune valeur différenciante).
      const subtitle = (sector || 'PWA SUR MESURE').toUpperCase();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '600 22px Inter, sans-serif';
      ctx.textAlign = 'center';
      if ('letterSpacing' in ctx) {
        ctx.letterSpacing = '6px'; // support natif si dispo
        ctx.fillText(subtitle, centerX, CH / 2 + 15);
        ctx.letterSpacing = '0px'; // reset — sinon tout le reste du canvas hérite de l'espacement
      } else {
        fillTextSpaced(ctx, subtitle, centerX, CH / 2 + 15, 6, true); // fallback manuel centré
      }
      ctx.textAlign = 'left'; // reset temporaire — remis à 'center' juste après pour la carte du bas

      // 6. Carte "Fonctionnalité clé" — fond assombri pour un vrai
      // contraste texte/fond (plus un simple voile blanc à 5%).
      const CARD1_Y = CH - 300;
      const CARD1_H = 210;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.roundRect(PAD, CARD1_Y, CW - PAD * 2, CARD1_H, 30);
      ctx.fill();

      // Carte "DÉVERROUILLER" — bouton d'action, fond plus contrasté +
      // fine bordure semi-transparente pour lire clairement un CTA.
      // Rayon = CARD2_H/2 (pilule complète) au lieu d'un 20px fixe qui,
      // vu de très près (zoom du reflet miroir), se lisait comme un
      // rectangle presque carré plutôt qu'un vrai bouton arrondi.
      const CARD2_Y = CH - 80;
      const CARD2_H = 60;
      const CARD2_R = CARD2_H / 2;
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.roundRect(PAD, CARD2_Y, CW - PAD * 2, CARD2_H, CARD2_R);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(PAD, CARD2_Y, CW - PAD * 2, CARD2_H, CARD2_R);
      ctx.stroke();

      // 7. Contenu de la carte du haut — label + descriptif métier propre
      // à chaque app, centré, avec retour à la ligne automatique.
      const cardMaxWidth = CW - PAD * 2 - 40; // marge interne, ne touche jamais les bords
      ctx.textAlign = 'center';

      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '700 15px Inter, sans-serif';
      if ('letterSpacing' in ctx) {
        ctx.letterSpacing = '2px';
        ctx.fillText('FONCTIONNALITÉ CLÉ', centerX, CARD1_Y + 42);
        ctx.letterSpacing = '0px';
      } else {
        fillTextSpaced(ctx, 'FONCTIONNALITÉ CLÉ', centerX, CARD1_Y + 42, 2, true);
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = '400 26px Inter, sans-serif';
      const highlight = APP_HIGHLIGHTS[appName] || '';
      const lines = wrapText(ctx, highlight, cardMaxWidth, 2);
      const lineHeight = 34;
      const startY = CARD1_Y + 42 + 42;
      lines.forEach((line, i) => {
        ctx.fillText(line, centerX, startY + i * lineHeight);
      });

      // 8. Contenu de la carte "DÉVERROUILLER" — CTA centré
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 18px Inter, sans-serif';
      ctx.fillText('DÉCOUVRIR >>', centerX, CARD2_Y + CARD2_H / 2 + 6);

      // 9. Reflet de verre — bande diagonale, mode 'screen' (n'assombrit
      // jamais, n'éclaircit que). C'est ça qui vend le "verre" en vue de
      // face : le clearcoat seul ne montre presque rien de face (le
      // Fresnel n'apparaît qu'en rasant), donc sans ce habillage l'écran
      // reste un simple rectangle mat même avec un bon matériau PBR.
      ctx.globalCompositeOperation = 'screen';
      const glareGrad = ctx.createLinearGradient(0, 0, CW, CH * 0.55);
      glareGrad.addColorStop(0, 'rgba(255,255,255,0)');
      glareGrad.addColorStop(0.38, 'rgba(255,255,255,0.09)');
      glareGrad.addColorStop(0.5, 'rgba(255,255,255,0.15)');
      glareGrad.addColorStop(0.62, 'rgba(255,255,255,0.09)');
      glareGrad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glareGrad;
      ctx.fillRect(0, 0, CW, CH);
      ctx.globalCompositeOperation = 'source-over';

      ctx.restore(); // fin du clip
    }

    draw();

    const texture = new THREE.CanvasTexture(canvas);
    if (THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
    else if (THREE.sRGBEncoding) texture.encoding = THREE.sRGBEncoding;
    // Vraie cause du halo noir carré (diagnostiqué plus tôt) : générer
    // des mipmaps sur une texture à alpha "sec" (straight alpha, comme
    // un canvas 2D standard) moyenne RGB et alpha INDÉPENDAMMENT à
    // chaque niveau de mip — au bord du masque arrondi, un pixel opaque
    // coloré se mélange avec un pixel transparent dont le RGB est ~noir,
    // et le résultat fonce anormalement (fringing). Le vrai correctif
    // n'est pas de désactiver les mipmaps (ce qui rend le reflet du sol
    // pixelisé/en blocs, notamment sur le texte des boutons), mais de
    // demander au GPU de prémultiplier l'alpha AU MOMENT DE L'UPLOAD
    // (`premultiplyAlpha`) : dans cet espace, le mélange RGB/alpha du
    // mipmapping devient mathématiquement correct, donc plus de halo —
    // et les mipmaps peuvent rester actifs pour lisser le reflet.
    texture.premultiplyAlpha = true;
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    texture.needsUpdate = true;

    screenTextureInstances.push({ texture, draw });

    return texture;
  }

  // Horloge en temps réel : redessine chaque écran (donc l'heure affichée
  // dans la barre d'état) toutes les 15 secondes.
  setInterval(() => {
    screenTextureInstances.forEach((inst) => {
      inst.draw();
      inst.texture.needsUpdate = true;
    });
  }, 15000);

  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function hexToRgba(hex, alpha) {
    const c = hex.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  /* ═══════════════════════════════════════════════════════════
     GÉOMÉTRIE ARRONDIE (sans dépendance externe)
     ─────────────────────────────────────────────────────────
     `three/examples/jsm/geometries/RoundedBoxGeometry.js` exige
     un import ES module (incompatible avec le déploiement
     "zéro build" via <script> classiques + CDN de ce projet).
     On obtient le même résultat visuel avec un THREE.Shape à
     coins arrondis, extrudé avec un léger bevel — c'est la coque.
     L'écran est un second plan plat (ShapeGeometry) aux coins
     arrondis, posé devant : ça permet aussi d'avoir un matériau
     totalement différent sur l'écran vs la coque, sans jouer avec
     un tableau de matériaux par face.
  ═══════════════════════════════════════════════════════════ */
  function roundedRectShape(w, h, r) {
    const shape = new THREE.Shape();
    const x = -w / 2, y = -h / 2;
    shape.moveTo(x, y + r);
    shape.lineTo(x, y + h - r);
    shape.quadraticCurveTo(x, y + h, x + r, y + h);
    shape.lineTo(x + w - r, y + h);
    shape.quadraticCurveTo(x + w, y + h, x + w, y + h - r);
    shape.lineTo(x + w, y + r);
    shape.quadraticCurveTo(x + w, y, x + w - r, y);
    shape.lineTo(x + r, y);
    shape.quadraticCurveTo(x, y, x, y + r);
    return shape;
  }

  // Proportions "Pixel 11 Pro" — fin et élancé, imposées directement
  // en unités monde (plus de facteur d'échelle intermédiaire).
  const PHONE_WIDTH = 1.4;
  const PHONE_HEIGHT = 3.1;
  const PHONE_DEPTH = 0.08;
  // Agrandi (0.15→0.22) : à 0.15 le rayon lisait comme "presque carré"
  // une fois zoomé (cf. retours utilisateur sur le reflet miroir) — un
  // vrai smartphone moderne (Pixel, iPhone récents) a un rayon de coin
  // bien plus généreux que ça.
  const CASE_RADIUS = 0.22;

  // Coque — matériau physique sombre stable, aluminium brossé : avec
  // une vraie DirectionalLight neutre unique (plus de sources multiples
  // ni d'ambiante seule), un metalness modéré redevient sûr — une seule
  // direction de lumière ne peut pas créer de reflets qui se contredisent.
  // v2 — plus poli/métal (metalness 0.6→0.78, roughness 0.35→0.24) pour
  // que le nouvel environment map contrasté + le sol miroir se reflètent
  // vraiment nettement dessus (la photo de référence montre un
  // aluminium anodisé assez brillant, pas un mat plastique).
  // v3 — encore plus poli (metalness 0.78→0.9, roughness 0.24→0.16,
  // clearcoat 0.6→0.85) : avec l'environment map contrastée ci-dessus,
  // ce niveau accroche des reflets nets au lieu de rester "plat".
  const caseMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x0a0a0c,
    metalness: 0.9,
    roughness: 0.16,
    clearcoat: 0.85,
    clearcoatRoughness: 0.08,
  });

  // RoundedBoxGeometry n'est disponible que via
  // `three/examples/jsm/geometries/RoundedBoxGeometry.js` (import ES
  // module), incompatible avec les <script> classiques + CDN de ce
  // projet ("zéro build"). `buildRoundedBoxGeometry` reproduit le
  // même résultat visuel (coins ET arêtes arrondis, pas juste les
  // coins) via une extrusion à section arrondie + bevel — utilisable
  // partout où l'addon officiel le serait.
  function buildRoundedBoxGeometry(width, height, depth, radius) {
    const shape = roundedRectShape(width, height, radius);
    // Bevel Z réactivé, mais STRICTEMENT plafonné : le bug précédent
    // venait d'un bevelThickness qui poussait la face avant de la coque
    // au-delà de depth/2, donc devant l'écran (à 0.045, désormais 0.05).
    // depth/2 = 0.04 ici ; avec bevelThickness=0.006, la face avant
    // atteint au maximum 0.046 — encore 0.004 de marge sous l'écran.
    // Ne JAMAIS monter bevelThickness au-delà de ~0.008 sans revérifier
    // cette marge (screenMesh.position.z dans createPhone).
    // bevelSegments était à 3 — bien trop peu pour une courbe lisse,
    // ça donnait un bord à facettes visibles (chanfreiné, pas arrondi) :
    // c'est très probablement ce qui lisait comme "pas réaliste" sur les
    // coins. Monté à 8. BEVEL_SIZE aussi élargi (0.02→0.028) pour un
    // arrondi plus visible/crédible. BEVEL_THICKNESS INCHANGÉ (0.006) —
    // c'est la seule valeur qui protège contre le bug "écran caché"
    // (voir marge de sécurité expliquée plus haut), n'y touche pas
    // sans revérifier screenMesh.position.z dans createPhone.
    const BEVEL_THICKNESS = 0.006;
    const BEVEL_SIZE = 0.028;
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelThickness: BEVEL_THICKNESS,
      bevelSize: BEVEL_SIZE,
      bevelSegments: 14, // 8→14 : courbe plus lisse, moins facettée
      curveSegments: 40, // 24→40 : idem sur le rayon principal du coin
    });
    geo.translate(0, 0, -depth / 2);
    geo.computeVertexNormals();
    return geo;
  }

  const caseGeometry = buildRoundedBoxGeometry(PHONE_WIDTH, PHONE_HEIGHT, PHONE_DEPTH, CASE_RADIUS);

  /* ═══════════════════════════════════════════════════════════
     CRÉATION D'UN TÉLÉPHONE — architecture en 2 objets distincts
     dans un Group, plutôt qu'un tableau de matériaux sur un seul
     mesh :
       1) La Coque  → RoundedBox (ci-dessus) + MeshPhysicalMaterial
       2) L'Écran   → PlaneGeometry (UV 0..1 garantis, jamais de
                       texte coupé) + MeshStandardMaterial, posé
                       légèrement devant la coque sur l'axe Z.
  ═══════════════════════════════════════════════════════════ */
  function createPhone(app, index, localX) {
    const group = new THREE.Group();
    group.position.set(localX, 0, 0);

    // ── Objet 1 : la coque ──────────────────────────────────────
    // Clone du matériau partagé (pas l'instance commune) : sinon
    // faire baisser l'opacité d'un téléphone (vue projet ouverte)
    // ferait disparaître les 4 en même temps.
    const caseMesh = new THREE.Mesh(caseGeometry, caseMaterial.clone());
    caseMesh.material.transparent = true;
    caseMesh.castShadow = true;
    caseMesh.receiveShadow = true;
    group.add(caseMesh);

    // ── Détail : boutons latéraux (power + rocker volume) ───────
    // Les téléphones pivotent légèrement (±0.2 rad, cf. animate()) donc
    // la tranche droite se voit par intermittence — sur la photo de
    // référence, ce sont ces petits reliefs métalliques sur le bord qui
    // vendent le "vrai produit" plutôt qu'une coque lisse sans détail.
    // Même matériau que la coque (clone du même clone) pour rester
    // cohérent visuellement et suivre le fondu à l'ouverture d'un projet.
    const buttonMat = caseMesh.material;
    const edgeX = PHONE_WIDTH / 2 + 0.006; // légèrement en saillie de la tranche
    const powerBtn = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.32, 0.05), buttonMat);
    powerBtn.position.set(edgeX, 0.55, 0);
    group.add(powerBtn);
    const volUp = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.18, 0.05), buttonMat);
    volUp.position.set(edgeX, 0.15, 0);
    group.add(volUp);
    const volDown = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.18, 0.05), buttonMat);
    volDown.position.set(edgeX, -0.1, 0);
    group.add(volDown);

    // ── Objet 2 : l'écran (verre) ───────────────────────────────
    // Dimensions imposées, très légèrement inférieures à la coque ;
    // un plan simple a un mapping UV 0..1 parfait par construction,
    // donc le texte du CanvasTexture ne peut plus jamais être rogné.
    // MeshBasicMaterial (avant) est totalement insensible à la lumière —
    // c'était une grosse part du rendu "plastique" : aucun reflet, aucune
    // brillance. Passé en MeshPhysicalMaterial : le contenu de l'app reste
    // lisible quelle que soit la lumière de la scène (emissiveMap, pas
    // affecté par l'éclairage), mais une fine couche "verre" par-dessus
    // (clearcoat élevé, roughness très basse) capte maintenant les reflets
    // de la lumière de studio, comme un vrai écran de smartphone.
    const screenTexture = createScreenTexture(app.name, app.accent, app.icon, app.sector); // app.accent est un hex complet, ex '#7a1f3d'
    const screenGeometry = new THREE.PlaneGeometry(1.34, 3.04);
    const screenMaterial = new THREE.MeshPhysicalMaterial({
      map: screenTexture, // pilote aussi la transparence des coins (alpha du canvas)
      emissiveMap: screenTexture,
      emissive: 0xffffff,
      emissiveIntensity: 0.9, // baissée (était 1.1) — un émissif trop fort noyait le reflet du clearcoat sous la brillance uniforme de l'écran
      color: 0x020202, // quasi-noir : la lumière de scène ne délave pas le contenu (porté par emissive)
      roughness: 0.08,  // verre lisse
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      metalness: 0,
      transparent: true, // laisse les coins du plan (hors masque arrondi) invisibles
      side: THREE.FrontSide,
    });
    const screenMesh = new THREE.Mesh(screenGeometry, screenMaterial);
    // z légèrement augmenté (0.045→0.05) : garde une marge de sécurité
    // avec le nouveau bevel de la coque (voir buildRoundedBoxGeometry)
    // pour ne jamais reproduire le bug "écran caché derrière la coque".
    screenMesh.position.z = 0.05;

    // renderOrder explicite — la coque (caseMesh) a `transparent:true`
    // (pour le fondu à l'ouverture d'un projet), donc coque ET écran
    // sont tous les deux dans la file "transparente" de three.js, triée
    // par défaut selon la distance au centre de leur bounding sphere.
    // Cette distance peut s'inverser selon la direction de vue — ce qui
    // change entre la caméra directe et la caméra MIROIR (inversée) du
    // sol réfléchissant. D'où le bug signalé : dans le reflet, la coque
    // pouvait se trier "après" l'écran et le recouvrir par endroits (un
    // carré/rectangle sombre à angles droits, la forme du plan de
    // l'écran). En forçant l'ordre, l'écran passe TOUJOURS après la
    // coque, quelle que soit la caméra.
    caseMesh.renderOrder = 0;
    screenMesh.renderOrder = 1;

    group.add(screenMesh);

    // Hitbox invisible élargie (Loi de Fitts) — raycaster uniquement
    const hitboxMesh = new THREE.Mesh(
      new THREE.BoxGeometry(PHONE_WIDTH * 1.7, PHONE_HEIGHT * 1.25, PHONE_DEPTH * 6),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    group.add(hitboxMesh);

    group.userData = {
      appIndex: index,
      localX,
      floatOffset: Math.random() * Math.PI * 2,
      floatSpeed: 0.55 + Math.random() * 0.2,
      swingOffset: Math.random() * Math.PI * 2,
      isFocused: false,
      isHovered: false,
      hitbox: hitboxMesh,
      currentRotY: 0,
    };

    scene.add(group);
    return group;
  }

  /* ═══════════════════════════════════════════════════════════
     SLIDER 3D
  ═══════════════════════════════════════════════════════════ */
  const SPACING = 3.4; // réajusté à la nouvelle largeur (1.4) des téléphones
  const track = new THREE.Group();
  scene.add(track);

  const n = APPS.length;
  const centerOffset = ((n - 1) * SPACING) / 2;

  // Le texte hero est maintenant centré en haut de l'écran (plus ancré à
  // gauche) : plus besoin de décaler le carrousel horizontalement. On le
  // descend en revanche verticalement pour dégager la zone de titre.
  const HERO_CLEARANCE = 0;
  // Sur mobile, le champ de vision (FOV fixe, mais écran étroit) ne
  // montre plus qu'un seul téléphone à la fois. Avec un centrage
  // symétrique (comme sur desktop, où les 4 téléphones sont tous
  // visibles), la caméra démarre pile entre les 2 téléphones du milieu
  // — "toujours entre deux tel". Sur mobile, on démarre plutôt centré
  // sur le PREMIER téléphone (EventPro), comme un vrai carrousel qui
  // commence à son premier élément.
  track.position.x = IS_MOBILE ? centerOffset + HERO_CLEARANCE : HERO_CLEARANCE;
  track.position.y = CAROUSEL_Y; // constante définie en haut du fichier

  const phones = APPS.map((app, i) => {
    const localX = i * SPACING - centerOffset;
    const group = createPhone(app, i, localX);
    track.add(group);
    return group;
  });

  const hitboxes = phones.map((g) => g.userData.hitbox);
  const SLIDER_BOUNDS = { min: -centerOffset + HERO_CLEARANCE, max: centerOffset + HERO_CLEARANCE };

  /* ═══════════════════════════════════════════════════════════
     PROFONDEUR DE CHAMP (depth of field) — flou léger sur ce qui
     n'est pas au point, comme une vraie photo produit. Post-processing
     via EffectComposer + BokehPass (examples/js classique, chargés en
     <script> dans index.html — voir le commentaire là-bas sur l'ordre
     de chargement). `focus` correspond à la distance caméra→sujet net ;
     le téléphone actif est à ~8 unités de la caméra par défaut (voir
     DEFAULT_CAMERA_POS), donc net ; les 3 autres, plus loin sur les
     côtés, tombent hors du plan de netteté et se floutent doucement.
  ═══════════════════════════════════════════════════════════ */
  // Patch obligatoire : le fragment shader stock de BokehShader fait
  // `gl_FragColor.a = 1.0;` en dur à la fin — ça force tout le canvas à
  // devenir opaque et masque le dégradé CSS du fond derrière (site
  // entier transparent depuis le début, cf. body en CSS + renderer
  // alpha:true). En retirant cette ligne, l'alpha réel (moyenne des
  // échantillons du flou) est conservé, donc la transparence revient.
  if (THREE.BokehShader) {
    THREE.BokehShader.fragmentShader = THREE.BokehShader.fragmentShader.replace(
      'gl_FragColor.a = 1.0;',
      ''
    );
  }

  // EffectComposer rend par défaut sur un WebGLRenderTarget simple —
  // sans multisampling, même si le renderer a été créé avec
  // `antialias:true`. C'est la vraie cause des bords "saccadés"/crénelés
  // sur les coques : le post-processing (nécessaire pour le flou DOF)
  // désactive silencieusement l'anti-aliasing du rendu de base.
  // WebGLMultisampleRenderTarget restaure le MSAA à l'intérieur du
  // composer (coeur de three.js, aucun addon supplémentaire requis).
  //
  // MSAA remis pour TOUS les devices (plus de branche IS_MOBILE ici) —
  // la vraie cause des corruptions visuelles observées plus tôt dans la
  // session n'était PAS le MSAA lui-même : c'était le rendu imbriqué du
  // miroir qui se déclenchait pendant la passe `overrideMaterial` de
  // BokehPass (maintenant corrigé via le garde-fou dans
  // createReflectorMSAA). IS_MOBILE se déclenche aussi sur un PC/laptop
  // à écran tactile (`navigator.maxTouchPoints > 0`), qui n'a aucune
  // raison d'avoir un GPU fragile — d'où des bords non lissés même sur
  // desktop. Le vrai bug étant corrigé à la source, plus besoin de ce
  // contournement.
  const dpr = Math.min(window.devicePixelRatio, 2);
  const MainRTClass = THREE.WebGLMultisampleRenderTarget;
  const renderTarget = new MainRTClass(
    window.innerWidth * dpr,
    window.innerHeight * dpr,
    { format: THREE.RGBAFormat }
  );
  const composer = new THREE.EffectComposer(renderer, renderTarget);
  composer.addPass(new THREE.RenderPass(scene, camera));
  // VRAIE CAUSE des contours "pixelisés" — pas l'intensité du flou
  // (aperture/maxblur, déjà réduits sans effet), mais la RÉSOLUTION de
  // la texture de profondeur interne de BokehPass. `width`/`height` ici
  // sont en pixels LOGIQUES (window.innerWidth), alors que tout le reste
  // du pipeline (composer, renderer) tourne en pixels PHYSIQUES
  // (× devicePixelRatio, jusqu'à 2-3x plus dense sur mobile/écrans
  // retina). En plus, ce render target utilise `NearestFilter` (aucun
  // lissage). Résultat : la carte de profondeur qui pilote le rayon de
  // flou est en très basse résolution ET sans interpolation → le flou
  // change par BLOCS quantifiés au lieu d'une transition douce,
  // visible comme un crénelage/pixelisation aux bords du téléphone —
  // indépendant de l'intensité du flou, d'où pourquoi la baisser n'a
  // rien changé. Fix : aligner cette résolution sur la résolution
  // physique réelle du rendu (× dpr), comme le reste du pipeline.
  // aperture/maxblur sont des décalages en espace UV (0–1) : à valeur
  // égale, le flou en pixels réels est proportionnel à la largeur
  // d'écran — un mobile étroit (ex. 390px) affiche donc mécaniquement
  // moins de flou visible qu'un desktop large (ex. 1920px) pour le
  // même réglage. On garde la valeur desktop (préférée) telle quelle,
  // et on la BOOSTE sur mobile pour compenser l'écran plus étroit, au
  // lieu de la réduire sur desktop comme tenté juste avant (l'inverse
  // de ce qu'il fallait faire).
  const BASE_APERTURE = 0.0018;
  const BASE_MAXBLUR = 0.008;
  const MOBILE_BLUR_BOOST = 2.4;
  const blurMult = IS_MOBILE ? MOBILE_BLUR_BOOST : 1;
  const bokehPass = new THREE.BokehPass(scene, camera, {
    focus: DEFAULT_CAMERA_POS.z, // suit la distance caméra réelle (6.4 mobile / 8 desktop) — sinon le téléphone actif sortirait lui-même du plan net sur mobile
    aperture: BASE_APERTURE * blurMult,
    maxblur: BASE_MAXBLUR * blurMult,
    width: window.innerWidth * dpr,
    height: window.innerHeight * dpr,
  });
  // Réactivé — vraie cause trouvée et corrigée (voir le garde-fou
  // `if (sc.overrideMaterial) return;` dans createReflectorMSAA plus
  // haut) : le rendu imbriqué du miroir se déclenchait pendant la passe
  // de profondeur "overrideMaterial" de BokehPass, corrompant l'état du
  // renderer. Le miroir saute maintenant son rendu de reflet pendant
  // cette passe précise, donc plus de conflit.
  composer.addPass(bokehPass);

  /* ═══════════════════════════════════════════════════════════
     BOUCLE DE RENDU
  ═══════════════════════════════════════════════════════════ */
  const clock = new THREE.Clock();
  const MAX_SWING = 0.2;

  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    let nearestGroup = null;
    let nearestDist = Infinity;
    phones.forEach((group) => {
      const worldX = group.userData.localX + track.position.x;
      const d = Math.abs(worldX);
      if (d < nearestDist) { nearestDist = d; nearestGroup = group; }
    });

    phones.forEach((group) => {
      const ud = group.userData;
      if (ud.isFocused) return;

      // Pendant un survol, GSAP pilote position.y et rotation.x (main.js) —
      // l'idle ne doit pas les écraser à chaque frame.
      if (!ud.isHovered) {
        group.position.y = Math.sin(t * ud.floatSpeed + ud.floatOffset) * 0.18;
        group.rotation.x = Math.sin(t * 0.35 + ud.floatOffset) * 0.035;
      }

      const targetRotY = group === nearestGroup ? 0 : Math.sin(t * 0.5 + ud.swingOffset) * MAX_SWING;
      ud.currentRotY = THREE.MathUtils.lerp(ud.currentRotY, targetRotY, 0.06);
      group.rotation.y = THREE.MathUtils.clamp(ud.currentRotY, -MAX_SWING, MAX_SWING);
    });

    // ── Parallax caméra + glow lumineux, pilotés par la souris ────────
    // Suspendus pendant le zoom GSAP sur un projet ouvert (window.__cameraLocked)
    // pour ne pas entrer en conflit avec l'animation de `openProject`.
    if (!window.__cameraLocked) {
      const targetCamX = DEFAULT_CAMERA_POS.x + mouseX * 0.5;
      const targetCamY = DEFAULT_CAMERA_POS.y + mouseY * 0.5;
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetCamX, 0.05);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetCamY, 0.05);
      camera.lookAt(0, CAROUSEL_Y, 0);
    }

    glowLight.position.x = mouseX * 5;
    glowLight.position.y = CAROUSEL_Y + mouseY * 2;

    // ── Dérive de la poussière en suspension ──────────────────────────
    // Montée lente + léger flottement latéral par particule ; une fois
    // trop haute, elle est renvoyée en bas (boucle infinie discrète,
    // jamais de "reset" visible car ça sort du cadre avant de boucler).
    const dustPos = dustGeometry.attributes.position.array;
    const DUST_TOP = CAROUSEL_Y + 6.5;
    const DUST_BOTTOM = CAROUSEL_Y - 3;
    for (let i = 0; i < DUST_COUNT; i++) {
      dustPos[i * 3 + 1] += dustSpeeds[i] * 0.016;
      dustPos[i * 3] += Math.sin(t * 0.3 + i) * 0.0008;
      if (dustPos[i * 3 + 1] > DUST_TOP) dustPos[i * 3 + 1] = DUST_BOTTOM;
    }
    dustGeometry.attributes.position.needsUpdate = true;

    composer.render();
  }

  function onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const newDpr = Math.min(window.devicePixelRatio, 2);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    renderer.setPixelRatio(newDpr);
    composer.setSize(w, h);
    // BokehPass ne redimensionne pas tout seul sa render target de
    // profondeur interne (elle n'implémente pas Pass.setSize) — sans
    // ça, après un resize/rotation d'écran elle resterait bloquée à sa
    // taille de construction, redevenant mal alignée avec le reste du
    // pipeline (le même problème de résolution corrigé plus haut).
    if (bokehPass && bokehPass.renderTargetDepth) {
      bokehPass.renderTargetDepth.setSize(w * newDpr, h * newDpr);
      bokehPass.uniforms.aspect.value = camera.aspect;
    }
  }
  window.addEventListener('resize', onResize);

  return {
    scene, camera, renderer, canvas: canvas3d,
    phones, hitboxes, track, SPACING, SLIDER_BOUNDS, APPS,
    loadingManager, DEFAULT_CAMERA_POS, animate,
    bokehPass, // exposé pour ajuster `focus` quand main.js zoome sur un projet (sinon le téléphone actif sortirait lui-même du plan net)
  };

})();

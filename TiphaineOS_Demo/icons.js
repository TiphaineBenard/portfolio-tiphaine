/* ═══════════════════════════════════════════════════════════
   ICÔNES — set minimal en traits (style Lucide/Feather), pour
   remplacer les emojis natifs par quelque chose de plus sobre
   et cohérent avec l'identité noir/blanc du portfolio.
   Usage : Icons.home(), Icons.bell(18), etc. → retourne du SVG inline.
═══════════════════════════════════════════════════════════ */

window.Icons = (function () {
  function svg(paths, size = 16) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  }
  return {
    home: (s) => svg('<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/>', s),
    briefcase: (s) => svg('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>', s),
    fileText: (s) => svg('<path d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M9 12h6M9 16h6M9 8h3"/>', s),
    users: (s) => svg('<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.4"/><path d="M15.5 14c2.6.3 4.5 2.5 4.5 6"/>', s),
    grid: (s) => svg('<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>', s),
    ticket: (s) => svg('<path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z"/>', s),
    clock: (s) => svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>', s),
    refresh: (s) => svg('<path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3"/><path d="M18 4v4h-4M6 20v-4h4"/>', s),
    wallet: (s) => svg('<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><circle cx="16" cy="14.5" r="1.2"/>', s),
    globe: (s) => svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 4 6 4 9s-1.5 6.4-4 9c-2.5-2.6-4-6-4-9s1.5-6.4 4-9z"/>', s),
    calendar: (s) => svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>', s),
    folder: (s) => svg('<path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>', s),
    search: (s) => svg('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>', s),
    bell: (s) => svg('<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 20a2 2 0 0 0 4 0"/>', s),
    arrowRight: (s) => svg('<path d="M5 12h14M13 6l6 6-6 6"/>', s),
    plus: (s) => svg('<path d="M12 5v14M5 12h14"/>', s),
    logout: (s) => svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>', s),
    handWave: (s) => svg('<path d="M8 12V6a1.5 1.5 0 0 1 3 0v5M11 11V4a1.5 1.5 0 0 1 3 0v7M14 11V6a1.5 1.5 0 0 1 3 0v7"/><path d="M17 11v3a5 5 0 0 1-10 0v-1l-1.4-1.6a1.3 1.3 0 0 1 1.9-1.8L9 11"/>', s),
    brain: (s) => svg('<path d="M9 4a3 3 0 0 0-3 3v1a3 3 0 0 0-1 5.8V15a3 3 0 0 0 3 3h1"/><path d="M15 4a3 3 0 0 1 3 3v1a3 3 0 0 1 1 5.8V15a3 3 0 0 1-3 3h-1"/><path d="M9 4v14M15 4v14"/>', s),
    tag: (s) => svg('<path d="M12.6 3H5a1 1 0 0 0-1 1v7.6a1 1 0 0 0 .3.7l8.4 8.4a1 1 0 0 0 1.4 0l7.6-7.6a1 1 0 0 0 0-1.4L13.3 3.3a1 1 0 0 0-.7-.3z"/><circle cx="9" cy="9" r="1.6"/>', s),
    // Ajouté le 05/09/2026 pour le module Factures (distinct de "fileText",
    // déjà utilisé par Devis) — ticket de caisse stylisé.
    receipt: (s) => svg('<path d="M6 3h12v18l-2.5-1.5L13 21l-2.5-1.5L8 21l-2-1.5z"/><path d="M9 8h6M9 12h6M9 16h3"/>', s),
    play: (s) => svg('<path d="M7 4.5v15l13-7.5z"/>', s),
    pause: (s) => svg('<rect x="6" y="4.5" width="4.5" height="15" rx="1"/><rect x="13.5" y="4.5" width="4.5" height="15" rx="1"/>', s),
    square: (s) => svg('<rect x="5.5" y="5.5" width="13" height="13" rx="1.5"/>', s),
    settings: (s) => svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 13a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V19a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H4a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H10a1.7 1.7 0 0 0 1-1.5V4a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V10a1.7 1.7 0 0 0 1.5 1H20a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>', s),
    // Silhouette symétrique (haut/bas ET gauche/droite centrés sur le
    // viewBox 24x24) — le premier essai avait un bas coupé en biais qui
    // le faisait paraître "pas centré" dans le bouton (retour de
    // Tiphaine le 03/09/2026).
    filter: (s) => svg('<path d="M4 5h16l-6 7v7h-4v-7z"/>', s),
    // Ajouté le 06/09/2026 pour le bouton "Plus" de la barre de nav mobile.
    menu: (s) => svg('<path d="M4 6h16M4 12h16M4 18h16"/>', s),
    // Ajoutés le 04/09/2026 pour le nouvel onglet Technique.
    server: (s) => svg('<rect x="3" y="4" width="18" height="7" rx="1.5"/><rect x="3" y="13" width="18" height="7" rx="1.5"/><path d="M7 7.5h.01M7 16.5h.01"/>', s),
    wrench: (s) => svg('<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.8 2.8-2-2z"/>', s),
    lock: (s) => svg('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', s),
    // Ajoutés le 04/09/2026 pour le nouveau module Documents.
    upload: (s) => svg('<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>', s),
    download: (s) => svg('<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>', s),
    image: (s) => svg('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.7"/><path d="m21 16-5.5-5.5L4 21"/>', s),
    link: (s) => svg('<path d="M9 12a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 0 0-5.7-5.7L10 5.3"/><path d="M15 12a4 4 0 0 0-5.7 0L6.7 14.6a4 4 0 0 0 5.7 5.7L14 18.7"/>', s),
    eye: (s) => svg('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>', s),
    // Ajouté le 06/09/2026 — remplace "brain" pour "À ne pas oublier"
    // (Dashboard) : à 16px le cerveau ressemblait à deux chevrons
    // (retour de Tiphaine, capture d'écran mobile), une checklist est
    // beaucoup plus lisible à cette taille et colle mieux au sens.
    checklist: (s) => svg('<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3 6 1.4 1.4L6.5 5"/><path d="m3 12 1.4 1.4 2.1-2.4"/><path d="m3 18 1.4 1.4 2.1-2.4"/>', s),
  };
})();

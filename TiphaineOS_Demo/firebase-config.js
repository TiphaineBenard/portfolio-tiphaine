/* ═══════════════════════════════════════════════════════════
   CONFIG FIREBASE — à remplacer par les vraies clés une fois
   le projet créé sur console.firebase.google.com.
   Ces clés ne sont PAS des secrets à cacher (elles identifient
   juste le projet côté client) : la vraie sécurité vient des
   règles Firestore + de l'authentification, pas de ce fichier.
═══════════════════════════════════════════════════════════ */

const firebaseConfig = {
  apiKey: "REMPLACER_MOI",
  authDomain: "REMPLACER_MOI.firebaseapp.com",
  projectId: "REMPLACER_MOI",
  storageBucket: "REMPLACER_MOI.appspot.com",
  messagingSenderId: "REMPLACER_MOI",
  appId: "REMPLACER_MOI",
};

// Ne s'initialise que si la config a été remplie — évite un crash total
// de l'appli tant que Tiphaine n'a pas encore créé son projet Firebase.
window.FIREBASE_READY = firebaseConfig.apiKey !== "REMPLACER_MOI";

if (window.FIREBASE_READY) {
  firebase.initializeApp(firebaseConfig);
  window.auth = firebase.auth();
  window.db = firebase.firestore();
} else {
  console.warn(
    "[Tiphaine OS] Firebase pas encore configuré — mode démo avec données factices. " +
    "Remplis firebase-config.js une fois ton projet Firebase créé."
  );
}

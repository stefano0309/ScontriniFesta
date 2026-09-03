import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getDatabase, ref, onValue, set, update, runTransaction, push, remove, get } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyDp8d5_dJRef3xwA9VYhDusemMjXZ8xYRs",
    authDomain: "cassa-festa-2026.firebaseapp.com",
    databaseURL: "https://cassa-festa-2026-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "cassa-festa-2026",
    storageBucket: "cassa-festa-2026.firebasestorage.app",
    messagingSenderId: "1014481421953",
    appId: "1:1014481421953:web:3b209106ec7fede6782f80",
    measurementId: "G-55S7V2QE37"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

window.FirebaseCassa = { app, db, auth, ref, onValue, set, update, runTransaction, push, remove, get };
window.firebaseReady = false;

// Se il primo tentativo fallisce (dispositivo partito offline, es. wifi
// della festa non ancora disponibile), NON ci arrendiamo: riproviamo
// periodicamente in background. Appena la rete torna disponibile, il
// dispositivo si aggancia da solo a Firebase senza bisogno di ricaricare
// la pagina — ed emette di nuovo "firebase-ready" così il resto dell'app
// (sync + invio delle vendite registrate offline) riparte automaticamente.
async function connectFirebase(retryDelayMs) {
    try {
        await signInAnonymously(auth);
        window.firebaseReady = true;
        console.log("Firebase pronto. UID:", auth.currentUser?.uid);
    } catch (error) {
        window.firebaseReady = false;
        console.error("Firebase: autenticazione anonima fallita, nuovo tentativo tra", Math.round(retryDelayMs / 1000) + "s", error);
    }
    window.dispatchEvent(new CustomEvent("firebase-ready", { detail: { ready: window.firebaseReady } }));
    if (!window.firebaseReady) {
        const nextDelay = Math.min(retryDelayMs * 1.6, 60000); // backoff, max 60s
        // Sostituire retryDelayMs con nextDelay nel secondo argomento
        setTimeout(() => connectFirebase(nextDelay), nextDelay);
    }
}
await connectFirebase(3000);
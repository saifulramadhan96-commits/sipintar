// File: js/config/firebase.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- KONFIGURASI FIREBASE ---
const isCanvasEnv = typeof __firebase_config !== 'undefined';
const firebaseConfig = {
  apiKey: "AIzaSyBy4XjK7_GgwvyZszuooaHWuF_zCKpniXk",
  authDomain: "sipintar-f7b13.firebaseapp.com",
  projectId: "sipintar-f7b13",
  storageBucket: "sipintar-f7b13.firebasestorage.app",
  messagingSenderId: "86493439132",
  appId: "1:86493439132:web:ad4786f5931aa277abf959"
};

const appId = typeof __app_id !== 'undefined' ? __app_id : "sipintar-sman1ambunten";

let app, auth, db;

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    console.log("[DEBUG] Berhasil menghubungkan ke SDK Firebase.");
} catch(err) {
    console.error("[DEBUG] Gagal menginisialisasi SDK Firebase", err);
}

// Fungsi helper untuk mendapatkan koleksi
export const getGradesCollection = () => {
    return isCanvasEnv 
        ? collection(db, 'artifacts', appId, 'public', 'data', 'grades')
        : collection(db, 'grades');
};

export const getUsersCollection = () => {
    return isCanvasEnv 
        ? collection(db, 'artifacts', appId, 'public', 'data', 'users')
        : collection(db, 'users');
};

export const getSettingsCollection = () => {
    return isCanvasEnv 
        ? collection(db, 'artifacts', appId, 'public', 'data', 'settings')
        : collection(db, 'settings');
};

// Ekspor instance inti
export { app, auth, db };

// Tambahkan baris ini di file js/config/firebase.js
export const getLogsCollection = () => collection(db, "logs");

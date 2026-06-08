// File: js/config/firebase.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { initializeFirestore, collection, persistentLocalCache, persistentMultipleTabManager } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- KONFIGURASI FIREBASE ---
const isCanvasEnv = typeof __firebase_config !== 'undefined';
const firebaseConfig = {
  apiKey: "AIzaSyD_rW1SrLEMxMPcdN124OVpouLk0wUJmaQ",
  authDomain: "sipintar-ambunten.firebaseapp.com",
  projectId: "sipintar-ambunten",
  storageBucket: "sipintar-ambunten.firebasestorage.app",
  messagingSenderId: "560048609348",
  appId: "1:560048609348:web:2f71b21b38b7d6a2dcc411",
  measurementId: "G-J1SLD3313Y"
};

const appId = typeof __app_id !== 'undefined' ? __app_id : "sipintar-sman1ambunten";

let app, auth, db;

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    
    // =========================================================================
    // OPTIMASI LEVEL 1: MENGAKTIFKAN OFFLINE PERSISTENCE (LOCAL CACHE)
    // =========================================================================
    // Menggunakan initializeFirestore untuk menggantikan getFirestore bawaan.
    // Ditambahkan persistentMultipleTabManager agar sinkronisasi cache tetap aman
    // meskipun guru membuka aplikasi Si PINTAR di beberapa tab browser sekaligus.
    // =========================================================================
    db = initializeFirestore(app, {
        localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager()
        })
    });
    
    console.log("[DEBUG] Berhasil menghubungkan ke SDK Firebase dengan Local Cache Aktif.");
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

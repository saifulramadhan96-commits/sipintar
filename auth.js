// File: js/services/auth.js

import { signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { auth, getUsersCollection } from '../config/firebase.js';

export let appUser = null;
export let USERS_DB = [];
export let activeTahun = '';
export let activeSemester = '';

// Fungsi untuk memulihkan sesi login dari LocalStorage
export function restoreSession() {
    const storedUser = localStorage.getItem('sipintar_user');
    const storedTahun = localStorage.getItem('sipintar_tahun');
    const storedSemester = localStorage.getItem('sipintar_semester');
    
    if (storedUser && storedTahun && storedSemester) {
        appUser = JSON.parse(storedUser);
        activeTahun = storedTahun;
        activeSemester = storedSemester;
        return appUser;
    }
    return null;
}

export async function setupAuth(onReady) {
    const btnLoginSubmit = document.getElementById('btn-login-submit');

    // 1. Jalankan Otentikasi Anonim Firebase
    try {
        console.log("[DEBUG] Menghubungkan ke Firebase...");
        await signInAnonymously(auth);
    } catch (e) {
        console.error("[DEBUG] Gagal koneksi Firebase:", e);
        if(btnLoginSubmit) btnLoginSubmit.textContent = "KONEKSI GAGAL";
    }

    // 2. Pantau Status Auth
    onAuthStateChanged(auth, async user => {
        if (user) {
            console.log("[DEBUG] Firebase Ready. Mengambil data akun...");
            await loadUsersFromDB();
            if (onReady) onReady(user);
        }
    });
}

export async function loadUsersFromDB() {
    const btnLoginSubmit = document.getElementById('btn-login-submit');
    const usersList = document.getElementById('users-list');

    try {
        const snap = await getDocs(getUsersCollection());
        USERS_DB = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Isi datalist untuk auto-complete username
        if (usersList) {
            usersList.innerHTML = USERS_DB.map(u => `<option value="${u.username}">`).join('');
        }

        // --- BAGIAN KRUSIAL: AKTIFKAN TOMBOL LOGIN ---
        if (btnLoginSubmit) {
            btnLoginSubmit.disabled = false;
            btnLoginSubmit.classList.remove('opacity-50', 'cursor-not-allowed');
            btnLoginSubmit.textContent = "MASUK SISTEM";
            console.log("[DEBUG] Tombol Login Aktif.");
        }
    } catch (err) {
        console.error("[DEBUG] Gagal muat akun:", err);
        if(btnLoginSubmit) btnLoginSubmit.textContent = "DATABASE ERROR";
    }
}

export function initLoginForm(onLoginSuccess) {
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return;

    loginForm.onsubmit = (e) => {
        e.preventDefault();
        const un = document.getElementById('login-username').value;
        const pw = document.getElementById('login-password').value;
        const u = USERS_DB.find(x => x.username === un && x.password === pw);

        if (u) {
            appUser = u;
            activeTahun = document.getElementById('login-tahun').value;
            activeSemester = document.getElementById('login-semester').value;
            
            // Simpan Sesi
            localStorage.setItem('sipintar_user', JSON.stringify(u));
            localStorage.setItem('sipintar_tahun', activeTahun);
            localStorage.setItem('sipintar_semester', activeSemester);

            if (onLoginSuccess) onLoginSuccess(u);
        } else {
            const errEl = document.getElementById('login-error');
            const errTxt = document.getElementById('login-error-text');
            if(errEl) errEl.classList.remove('hidden');
            if(errTxt) errTxt.textContent = "Username atau Password salah!";
        }
    };
}

export function handleLogout(onLogoutComplete) {
    localStorage.clear();
    appUser = null;
    if (onLogoutComplete) onLogoutComplete();
    window.location.reload(); // Refresh total agar aman
}

export const getAppUser = () => appUser;
export const getActiveTahun = () => activeTahun;
export const getActiveSemester = () => activeSemester;

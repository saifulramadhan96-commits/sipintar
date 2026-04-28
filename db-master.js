// File: js/services/db-master.js

import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getSettingsCollection } from '../config/firebase.js';

// Default Tahun Ajaran Bawaan (Dipertahankan agar halaman login tidak blank saat database kosong)
export const DEFAULT_TAHUN = ["2024/2025", "2025/2026", "2026/2027", "2027/2028"];

// State Master Data yang Terhubung Database
export let MASTER_CLASSES = [];
export let MASTER_SUBJECTS = [];
export let MASTER_TAHUN = []; 

export async function loadMasterData() {
    try {
        const ref = doc(getSettingsCollection(), 'master_data');
        const snap = await getDoc(ref);
        if (snap.exists()) {
            const data = snap.data();
            MASTER_CLASSES = data.classes || [];
            MASTER_SUBJECTS = data.subjects || [];
            MASTER_TAHUN = data.tahun || []; 
        }
    } catch(e) {
        console.error("[DEBUG] Gagal load master data", e);
    }
}

export async function saveMasterData() {
    try {
        const ref = doc(getSettingsCollection(), 'master_data');
        await setDoc(ref, { 
            classes: MASTER_CLASSES,
            subjects: MASTER_SUBJECTS,
            tahun: MASTER_TAHUN 
        }, { merge: true });
    } catch(e) {
        console.error("[DEBUG] GAGAL SAVE MASTER", e);
        throw e;
    }
}

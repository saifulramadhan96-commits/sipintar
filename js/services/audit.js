// File: js/services/audit.js
import { addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getLogsCollection } from '../config/firebase.js';
import { getAppUser } from './auth.js';

export async function writeLog(action, details) {
    const user = getAppUser();
    if (!user) return;

    try {
        await addDoc(getLogsCollection(), {
            username: user.username,
            role: user.role,
            action: action, // Contoh: "UPDATE_NILAI", "HAPUS_SISWA"
            details: details, // Informasi tambahan
            timestamp: serverTimestamp(),
            ip: "client-side-action"
        });
        console.log(`[AUDIT] Log dicatat: ${action}`);
    } catch (err) {
        console.error("Gagal mencatat audit log", err);
    }
}

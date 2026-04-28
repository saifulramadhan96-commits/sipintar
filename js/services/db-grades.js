// File: js/services/db-grades.js

import { onSnapshot, doc, updateDoc, addDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getGradesCollection } from '../config/firebase.js';
import { getAppUser, getActiveTahun, getActiveSemester } from './auth.js';
import { setGradesData, renderTableSiswa } from '../ui/tables.js';
import { switchMenu } from '../ui/navigation.js';
import { writeLog } from './audit.js';

// State untuk Nilai
export let gradesData = [];
export let unsubGrades = null;
export let weights = { f: 25, t: 25, a: 50 }; // Default bobot

// Fungsi Kalkulasi Nilai
export function getCalc(s) {
    if(!s) return {final:"0.0"};
    const ext = (arr) => arr.filter(v => v!=="" && v!==null && !isNaN(parseFloat(v))).map(v => parseFloat(v));
    const fVals = ext([s.f1, s.f2, s.f3]), tVals = ext([s.t1, s.t2, s.t3]);
    
    const aF = fVals.length ? fVals.reduce((a,b)=>a+b,0)/fVals.length : 0;
    const aT = tVals.length ? tVals.reduce((a,b)=>a+b,0)/tVals.length : 0;
    const vA = (s.asaj!=="" && s.asaj!==null && !isNaN(parseFloat(s.asaj))) ? parseFloat(s.asaj) : 0;
    
    const fin = (aF * (weights.f/100)) + (aT * (weights.t/100)) + (vA * (weights.a/100));
    return { avgFormative: aF.toFixed(1), avgTask: aT.toFixed(1), final: fin.toFixed(1) };
}

// Fungsi helper untuk sanitasi angka
export function san(v) { return (v===""||v===null||v===undefined) ? null : parseFloat(v); }
export function ds(v) { return (v===null||v===undefined||v==="") ? "" : v; } // display string

// Listener Real-time ke Firestore
export function setupFirestoreListener(onDataChanged) {
    if(unsubGrades) unsubGrades();
    
    const q = getGradesCollection();
    console.log(`[DEBUG] Membaca database Firestore di path: ${q.path}`);
    
    unsubGrades = onSnapshot(q, snap => {
        console.log(`[DEBUG] Sukses membaca ${snap.docs.length} data nilai.`);
        let d = snap.docs.map(doc => ({id: doc.id, ...doc.data()}));
        d.sort((a,b) => (a.createdAt?.seconds||0) - (b.createdAt?.seconds||0));
        
        gradesData = d;
        setGradesData(d); // Kirim data ke UI Tables
        
        // Update statistik di dashboard
        updateStats();
        
        // Beri tahu UI untuk render ulang (jika callback disediakan)
        if(onDataChanged) onDataChanged();
        
    }, err => {
        console.error("[DEBUG] GAGAL BACA DATABASE", err);
        alert("Gagal memuat data nilai!");
    });
}

// Update Angka di Dashboard Utama
export function updateStats() {
    const appUser = getAppUser();
    if(!appUser) return;

    const activeTahun = getActiveTahun();
    const activeSemester = getActiveSemester();

    let baseD = gradesData.filter(g => g.tahun === activeTahun && g.semester === activeSemester);
    let d = appUser.role === 'guru' ? baseD.filter(g => g.teacherName === appUser.username || g.teacherName === 'admin') : baseD;
    
    const statStudents = document.getElementById('stat-students');
    const statAvg = document.getElementById('stat-avg');
    
    if (statStudents) statStudents.textContent = d.length;
    if (statAvg) {
        let tot = d.reduce((a,c)=>a+(c.results?.final||0),0);
        statAvg.textContent = d.length ? (tot/d.length).toFixed(1) : "0.0";
    }
}

// Simpan Nilai Baru ke Firestore & Catat Log
export async function saveNewGrade(payload, editId = null) {
    const cRef = getGradesCollection();
    try {
        if (editId) {
            payload.updatedAt = serverTimestamp();
            await updateDoc(doc(cRef, editId), payload);
            console.log("[DEBUG] Sukses memperbarui data " + editId);
            
            // CATAT LOG UPDATE
            await writeLog("UPDATE_NILAI", `Mengubah nilai siswa: ${payload.studentName} (${payload.subject})`);
        } else {
            payload.createdAt = serverTimestamp();
            await addDoc(cRef, payload);
            console.log("[DEBUG] Sukses menambahkan data baru ke Firestore.");
            
            // CATAT LOG TAMBAH
            await writeLog("TAMBAH_SISWA", `Menambah siswa baru: ${payload.studentName} ke kelas ${payload.className}`);
        }
        return true;
    } catch (err) {
        console.error("[DEBUG] GAGAL MENYIMPAN KE FIRESTORE", err);
        throw err;
    }
}

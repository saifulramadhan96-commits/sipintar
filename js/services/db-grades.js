// File: js/services/db-grades.js

import { query, where, onSnapshot, doc, updateDoc, addDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getGradesCollection } from '../config/firebase.js';
import { getAppUser, getActiveTahun, getActiveSemester } from './auth.js';
import { setGradesData, renderTableSiswa } from '../ui/tables.js';
import { switchMenu } from '../ui/navigation.js';
import { writeLog } from './audit.js';

// State untuk Nilai
export let gradesData = [];
export let unsubGrades = null;
export let weights = { f: 25, t: 25, a: 50 }; // Default bobot

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

export function san(v) { return (v===""||v===null||v===undefined) ? null : parseFloat(v); }
export function ds(v) { return (v===null||v===undefined||v==="") ? "" : v; } 

export function setupFirestoreListener(onDataChanged) {
    if(unsubGrades) unsubGrades();
    
    const thn = getActiveTahun();
    const smt = getActiveSemester();
    
    if (!thn || !smt) return;
    
    const baseColl = getGradesCollection();
    const q = query(baseColl, where("tahun", "==", thn), where("semester", "==", smt));
    
    unsubGrades = onSnapshot(q, snap => {
        let d = snap.docs.map(doc => ({id: doc.id, ...doc.data()}));
        d.sort((a,b) => (a.createdAt?.seconds||0) - (b.createdAt?.seconds||0));
        
        gradesData = d;
        setGradesData(d); // Kirim data ke tabel
        
        // CATATAN PERBAIKAN: Fungsi updateStats() yang lama telah DICABUT dari sini
        // agar tidak terjadi tabrakan update DOM dengan file main.js
        
        if(onDataChanged) onDataChanged();
        
    }, err => {
        alert("Gagal memuat data nilai!");
    });
}

export async function saveNewGrade(payload, editId = null) {
    const cRef = getGradesCollection();
    try {
        if (editId) {
            payload.updatedAt = serverTimestamp();
            await updateDoc(doc(cRef, editId), payload);
            await writeLog("UPDATE_NILAI", `Mengubah nilai siswa: ${payload.studentName}`);
        } else {
            payload.createdAt = serverTimestamp();
            await addDoc(cRef, payload);
            await writeLog("TAMBAH_SISWA", `Menambah siswa baru: ${payload.studentName}`);
        }
        return true;
    } catch (err) {
        throw err;
    }
}

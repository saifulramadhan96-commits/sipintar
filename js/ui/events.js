// File: js/ui/events.js

import { getAppUser, getActiveTahun, getActiveSemester } from '../services/auth.js';
import { getCalc, weights, saveNewGrade, san, ds } from '../services/db-grades.js';
import { 
    setFilters, renderTable, gradesData, setEditGradeId, editGradeId, 
    getDisplayData, selClass, selSubject, setSearchQuery, selClassRekap 
} from './tables.js';
import { doc, updateDoc, deleteDoc, serverTimestamp, getDoc, setDoc, db } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getGradesCollection } from '../config/firebase.js';
import { writeLog } from '../services/audit.js';

export function setupUIEvents() {
    console.log("[DEBUG] Menginisialisasi Event Listeners UI dengan Bobot Kontekstual...");

    // 1. FUNGSI INTI: MUAT BOBOT BERDASARKAN KONTEKS (GURU + KELAS + MAPEL)
    async function loadContextWeights() {
        const appUser = getAppUser();
        const thn = getActiveTahun();
        const smt = getActiveSemester();
        
        // Hanya jalan jika Kelas dan Mapel sudah dipilih
        if (!selClass || !selSubject || !appUser) return;

        // Buat ID unik untuk kombinasi ini
        const contextId = `weights_${appUser.id}_${thn}_${smt}_${selClass}_${selSubject}`.replace(/\s+/g, '_');
        
        try {
            const docRef = doc(db, 'settings_weights', contextId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                weights.f = data.f;
                weights.t = data.t;
                weights.a = data.a;
                console.log(`[DEBUG] Bobot khusus ditemukan untuk ${selClass} - ${selSubject}`);
            } else {
                // Jika tidak ada, kembali ke default
                weights.f = 25; weights.t = 25; weights.a = 50;
                console.log(`[DEBUG] Menggunakan bobot default untuk ${selClass}`);
            }

            // Update tampilan input di layar
            if(document.getElementById('w-f')) document.getElementById('w-f').value = weights.f;
            if(document.getElementById('w-t')) document.getElementById('w-t').value = weights.t;
            if(document.getElementById('w-a')) document.getElementById('w-a').value = weights.a;
            
            renderTable();
        } catch (err) {
            console.error("Gagal memuat bobot konteks:", err);
        }
    }

    // 2. LOGIKA FILTER (Trigger Load Bobot saat filter berubah)
    const fGuru = document.getElementById('filter-guru');
    const fMapel = document.getElementById('filter-mapel');
    const fKelas = document.getElementById('filter-kelas');
    
    const updateFilters = async () => { 
        setFilters(fKelas?.value || '', fMapel?.value || '', fGuru?.value || 'all'); 
        // Muat bobot spesifik untuk kombinasi kelas/mapel yang baru dipilih
        await loadContextWeights(); 
        renderTable(); 
    };

    if(fGuru) fGuru.onchange = updateFilters;
    if(fMapel) fMapel.onchange = updateFilters;
    if(fKelas) fKelas.onchange = updateFilters;

    // 3. TOMBOL SIMPAN BOBOT (Simpan ke Koleksi Kontekstual)
    const btnSaveWeights = document.getElementById('btn-save-weights');
    if (btnSaveWeights) {
        btnSaveWeights.addEventListener('click', async () => {
            const appUser = getAppUser();
            const thn = getActiveTahun();
            const smt = getActiveSemester();

            if (!selClass || !selSubject) {
                alert("Pilih Kelas dan Mapel terlebih dahulu!");
                return;
            }

            const wf = parseFloat(document.getElementById('w-f').value) || 0;
            const wt = parseFloat(document.getElementById('w-t').value) || 0;
            const wa = parseFloat(document.getElementById('w-a').value) || 0;

            if (Math.abs(wf + wt + wa - 100) > 0.1) {
                alert(`Total harus 100%. Saat ini: ${wf + wt + wa}%`);
                return;
            }

            const contextId = `weights_${appUser.id}_${thn}_${smt}_${selClass}_${selSubject}`.replace(/\s+/g, '_');
            
            btnSaveWeights.innerHTML = '<i class="ph ph-spinner animate-spin"></i> Menyimpan...';
            btnSaveWeights.disabled = true;

            try {
                await setDoc(doc(db, 'settings_weights', contextId), {
                    f: wf, t: wt, a: wa,
                    teacherId: appUser.id,
                    className: selClass,
                    subject: selSubject,
                    updatedAt: serverTimestamp()
                });

                weights.f = wf; weights.t = wt; weights.a = wa;
                renderTable();
                alert(`Bobot berhasil disimpan khusus untuk Kelas ${selClass} - ${selSubject}`);
            } catch (err) {
                alert("Gagal menyimpan ke server.");
            } finally {
                btnSaveWeights.innerHTML = '<i class="ph ph-check-circle"></i> Terapkan Bobot';
                btnSaveWeights.disabled = false;
            }
        });
    }

    // --- EVENT LAINNYA (PASSWORD, SEARCH, DLL) ---
    const togglePassword = document.getElementById('toggle-password');
    const loginPassword = document.getElementById('login-password');
    if (togglePassword && loginPassword) {
        togglePassword.onclick = () => {
            const type = loginPassword.getAttribute('type') === 'password' ? 'text' : 'password';
            loginPassword.setAttribute('type', type);
            togglePassword.innerHTML = type === 'password' ? '<i class="ph ph-eye"></i>' : '<i class="ph ph-eye-slash"></i>';
        };
    }

    const searchInput = document.getElementById('search-siswa');
    if (searchInput) searchInput.addEventListener('input', (e) => { setSearchQuery(e.target.value); renderTable(); });

    // 4. PRINT & EXCEL LOGIC
    window.openPreviewModal = (type) => {
        const modal = document.getElementById('preview-modal');
        const container = document.getElementById('preview-table-container');
        const docTitle = document.getElementById('preview-doc-title');
        const docSub = document.getElementById('preview-doc-subtitle');
        const ttdName = document.getElementById('preview-ttd-name');
        const ttdRole = document.getElementById('preview-ttd-role');
        const ttdNip = document.getElementById('preview-ttd-nip');
        const dateEl = document.getElementById('preview-date');
        const appUser = getAppUser();

        const d = new Date();
        const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
        dateEl.textContent = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
        ttdName.textContent = appUser.username;
        ttdRole.textContent = type === 'rekap' ? "Wali Kelas" : "Guru Mata Pelajaran";
        ttdNip.textContent = "NIP. " + (appUser.nip || "-");

        if (type === 'nilai') {
            if (!selClass || !selSubject) { alert("Pilih Kelas dan Mata Pelajaran."); return; }
            docTitle.textContent = "Daftar Capaian Akademik Siswa";
            docSub.innerHTML = `<span>Mapel: <b>${selSubject}</b></span> <span>Kelas: <b>${selClass}</b></span> <span>Sem: <b>${getActiveSemester()}</b></span>`;
            
            const data = getDisplayData();
            let html = `<table class="w-full text-[10pt] border-collapse border border-black text-black">
                <thead class="bg-gray-100 text-center"><tr><th class="border border-black p-2">No</th><th class="border border-black p-2 text-left">Nama Siswa</th><th class="border border-black p-2">NISN</th><th class="border border-black p-2">F1</th><th class="border border-black p-2">F2</th><th class="border border-black p-2">F3</th><th class="border border-black p-2">T1</th><th class="border border-black p-2">T2</th><th class="border border-black p-2">T3</th><th class="border border-black p-2">ASAJ</th><th class="border border-black p-2">NA</th></tr></thead><tbody>`;
            data.forEach((item, i) => {
                const calc = getCalc(item.scores);
                html += `<tr><td class="border border-black p-1 text-center">${i+1}</td><td class="border border-black p-1 uppercase">${item.studentName}</td><td class="border border-black p-1 text-center">${item.nisn || '-'}</td><td class="border border-black p-1 text-center">${ds(item.scores.f1)}</td><td class="border border-black p-1 text-center">${ds(item.scores.f2)}</td><td class="border border-black p-1 text-center">${ds(item.scores.f3)}</td><td class="border border-black p-1 text-center">${ds(item.scores.t1)}</td><td class="border border-black p-1 text-center">${ds(item.scores.t2)}</td><td class="border border-black p-1 text-center">${ds(item.scores.t3)}</td><td class="border border-black p-1 text-center font-bold">${ds(item.scores.asaj)}</td><td class="border border-black p-1 text-center font-bold">${calc.final}</td></tr>`;
            });
            html += `</tbody></table>`; container.innerHTML = html;
        }
        modal.classList.replace('hidden', 'flex');
    };

    const exportNilaiToExcel = (isTemplate) => {
        if (!selClass || !selSubject) return alert("Pilih Kelas dan Mapel.");
        const dataDisplay = getDisplayData();
        const exportData = dataDisplay.map((item, index) => ({
            "No": index + 1, "ID_SISTEM (JANGAN DIUBAH)": item.id, "Nama Siswa": item.studentName, "NISN": item.nisn || "-",
            "F1": isTemplate ? "" : ds(item.scores.f1), "F2": isTemplate ? "" : ds(item.scores.f2), "F3": isTemplate ? "" : ds(item.scores.f3),
            "T1": isTemplate ? "" : ds(item.scores.t1), "T2": isTemplate ? "" : ds(item.scores.t2), "T3": isTemplate ? "" : ds(item.scores.t3),
            "ASAJ": isTemplate ? "" : ds(item.scores.asaj), "NA": isTemplate ? "" : getCalc(item.scores).final
        }));
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Input_Nilai");
        XLSX.writeFile(wb, (isTemplate ? "Format_" : "Data_") + `Nilai_${selClass}_${selSubject}.xlsx`);
    };

    document.getElementById('btn-template-nilai').onclick = () => exportNilaiToExcel(true);
    document.getElementById('btn-export-excel').onclick = () => exportNilaiToExcel(false);

    // 5. FORM SUBMIT NILAI
    const gradeForm = document.getElementById('grade-form');
    if(gradeForm) {
        gradeForm.onsubmit = async (e) => {
            e.preventDefault();
            const appUser = getAppUser();
            const studentName = document.getElementById('in-name').value.trim();
            const s = { f1:san(document.getElementById('in-f1').value), f2:san(document.getElementById('in-f2').value), f3:san(document.getElementById('in-f3').value), t1:san(document.getElementById('in-t1').value), t2:san(document.getElementById('in-t2').value), t3:san(document.getElementById('in-t3').value), asaj:san(document.getElementById('in-asaj').value) };
            const c = getCalc(s);
            const payload = { 
                studentName: studentName, nisn: document.getElementById('in-nisn').value.trim(), 
                teacherName: appUser.username, subject: selSubject, className: selClass, 
                tahun: getActiveTahun(), semester: getActiveSemester(),
                scores: s, results: {avgFormative: parseFloat(c.avgFormative), avgTask:parseFloat(c.avgTask), final:parseFloat(c.final)},
                weightsSnapshot: weights // Menyimpan bobot saat nilai diinput
            };
            try {
                await saveNewGrade(payload, editGradeId);
                gradeForm.reset(); setEditGradeId(null);
                document.getElementById('badge-edit-mode')?.classList.add('hidden');
                renderTable();
            } catch (err) { alert("Gagal simpan!"); }
        };
    }

    // 6. AUTO-SAVE & DELEGASI TABEL
    const gradesTbody = document.getElementById('grades-tbody');
    if(gradesTbody) {
        gradesTbody.addEventListener('focusout', async (e) => {
            if(e.target.tagName === 'INPUT') {
                const tr = e.target.closest('tr'); if (tr.id === 'row-new-grade') return;
                const id = tr.dataset.id; const item = gradesData.find(g=>g.id===id); if(!item) return;
                const field = e.target.dataset.f; const val = e.target.value;
                if(item.scores[field] == val) return;
                const ns = { ...item.scores, [field]: san(val) }; const c = getCalc(ns);
                await updateDoc(doc(getGradesCollection(), id), { scores: ns, results: {avgFormative: parseFloat(c.avgFormative), avgTask:parseFloat(c.avgTask), final:parseFloat(c.final)}, updatedAt: serverTimestamp() });
            }
        });

        gradesTbody.addEventListener('click', (e) => {
            const btnDel = e.target.closest('.btn-del');
            if (btnDel) {
                const tr = btnDel.closest('tr'); const id = tr.dataset.id;
                if (confirm(`Hapus data nilai?`)) {
                    deleteDoc(doc(getGradesCollection(), id)).then(() => renderTable());
                }
            }
        });
    }
}

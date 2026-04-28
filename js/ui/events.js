// File: js/ui/events.js

import { getAppUser, getActiveTahun, getActiveSemester } from '../services/auth.js';
import { getCalc, weights, saveNewGrade, san, ds } from '../services/db-grades.js';
import { 
    setFilters, renderTable, gradesData, setEditGradeId, editGradeId, 
    getDisplayData, selClass, selSubject, setSearchQuery, selClassRekap 
} from './tables.js';
import { doc, updateDoc, deleteDoc, serverTimestamp, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db, getGradesCollection } from '../config/firebase.js';
import { writeLog } from '../services/audit.js';

export function setupUIEvents() {
    console.log("[DEBUG] Menginisialisasi Event Listeners UI dengan Bobot Kontekstual...");

    // 1. FUNGSI INTI: MUAT BOBOT BERDASARKAN KONTEKS
    async function loadContextWeights() {
        const appUser = getAppUser();
        const thn = getActiveTahun();
        const smt = getActiveSemester();
        
        if (!selClass || !selSubject || !appUser) return;

        // [PERBAIKAN]: Hapus garis miring (/) dari tahun (misal: 2028/2029 jadi 2028_2029)
        const contextId = `weights_${appUser.id}_${thn}_${smt}_${selClass}_${selSubject}`.replace(/[\s\/]+/g, '_');
        
        try {
            const docRef = doc(db, 'settings_weights', contextId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                weights.f = data.f; 
                weights.t = data.t; 
                weights.a = data.a;
            } else {
                weights.f = 25; 
                weights.t = 25; 
                weights.a = 50;
            }

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
        await loadContextWeights(); 
        renderTable(); 
    };

    if(fGuru) fGuru.onchange = updateFilters;
    if(fMapel) fMapel.onchange = updateFilters;
    if(fKelas) fKelas.onchange = updateFilters;

    // 3. TOMBOL SIMPAN BOBOT
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
                alert(`Total persentase bobot harus 100%. Saat ini totalnya: ${wf + wt + wa}%`);
                return;
            }

            // [PERBAIKAN]: Hapus garis miring (/) dari tahun agar aman disimpan di Firestore
            const contextId = `weights_${appUser.id}_${thn}_${smt}_${selClass}_${selSubject}`.replace(/[\s\/]+/g, '_');
            
            btnSaveWeights.innerHTML = '<i class="ph ph-spinner animate-spin text-lg"></i> Menyimpan...';
            btnSaveWeights.disabled = true;

            try {
                await setDoc(doc(db, 'settings_weights', contextId), {
                    f: wf, t: wt, a: wa,
                    teacherId: appUser.id,
                    className: selClass,
                    subject: selSubject,
                    updatedAt: serverTimestamp()
                });

                weights.f = wf; 
                weights.t = wt; 
                weights.a = wa;
                renderTable();
                alert(`Bobot berhasil disimpan khusus untuk Kelas ${selClass} Mapel ${selSubject}`);
            } catch (err) {
                console.error("Simpan error:", err);
                alert("Gagal menyimpan ke server Firebase.");
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
        dateEl.contentEditable = "true";
        dateEl.className = "outline-none hover:bg-gray-100 focus:bg-blue-50 cursor-text px-2 py-0.5 rounded border border-dashed border-transparent hover:border-gray-300 print:border-none print:bg-transparent print:p-0 transition-colors";

        ttdRole.contentEditable = "true";
        ttdRole.className = "mb-20 outline-none hover:bg-gray-100 focus:bg-blue-50 cursor-text px-2 py-0.5 rounded border border-dashed border-transparent hover:border-gray-300 print:border-none print:bg-transparent print:p-0 block transition-colors";
        ttdRole.textContent = type === 'rekap' ? "Wali Kelas" : "Guru Mata Pelajaran";

        ttdName.textContent = appUser.username;
        ttdName.contentEditable = "true";
        ttdName.className = "font-bold underline uppercase tracking-wide outline-none hover:bg-gray-100 focus:bg-blue-50 cursor-text px-2 py-0.5 rounded border border-dashed border-transparent hover:border-gray-300 print:border-none print:bg-transparent print:p-0 transition-colors";

        const userNip = appUser.nip && appUser.nip !== '-' ? appUser.nip : "[Klik & Ketik NIP]";
        ttdNip.textContent = "NIP. " + userNip;
        ttdNip.contentEditable = "true";
        ttdNip.className = "text-sm mt-1 outline-none hover:bg-gray-100 focus:bg-blue-50 cursor-text px-2 py-0.5 rounded border border-dashed border-transparent hover:border-gray-300 print:border-none print:bg-transparent print:p-0 transition-colors block";

        if (type === 'nilai') {
            if (!selClass || !selSubject) { alert("Pilih Kelas dan Mata Pelajaran terlebih dahulu sebelum mencetak."); return; }
            docTitle.textContent = "Daftar Capaian Akademik Siswa";
            docSub.innerHTML = `<span>Mata Pelajaran: <b>${selSubject}</b></span> <span>Kelas: <b>${selClass}</b></span> <span>Semester: <b>${getActiveSemester()}</b></span> <span>Tahun: <b>${getActiveTahun()}</b></span>`;

            const data = getDisplayData();
            let html = `
            <table class="w-full text-[10pt] border-collapse border border-black text-black">
              <thead class="bg-gray-100 font-bold text-center">
                <tr>
                  <th class="border border-black p-2 w-10">No</th><th class="border border-black p-2 text-left">Nama Lengkap Siswa</th><th class="border border-black p-2">NISN</th>
                  <th class="border border-black p-2 w-12">F1</th><th class="border border-black p-2 w-12">F2</th><th class="border border-black p-2 w-12">F3</th>
                  <th class="border border-black p-2 w-12">T1</th><th class="border border-black p-2 w-12">T2</th><th class="border border-black p-2 w-12">T3</th>
                  <th class="border border-black p-2 w-12">ASAJ</th><th class="border border-black p-2 w-14">Nilai<br>Akhir</th>
                </tr>
              </thead><tbody>
            `;
            if (data.length === 0) { html += `<tr><td colspan="11" class="border border-black p-4 text-center">Belum ada data nilai.</td></tr>`; } 
            else {
                data.forEach((item, i) => {
                    const calc = getCalc(item.scores);
                    html += `<tr>
                        <td class="border border-black p-1.5 text-center">${i+1}</td><td class="border border-black p-1.5 font-semibold uppercase">${item.studentName}</td>
                        <td class="border border-black p-1.5 text-center font-mono text-xs">${item.nisn || '-'}</td><td class="border border-black p-1.5 text-center">${ds(item.scores.f1)}</td>
                        <td class="border border-black p-1.5 text-center">${ds(item.scores.f2)}</td><td class="border border-black p-1.5 text-center">${ds(item.scores.f3)}</td>
                        <td class="border border-black p-1.5 text-center">${ds(item.scores.t1)}</td><td class="border border-black p-1.5 text-center">${ds(item.scores.t2)}</td>
                        <td class="border border-black p-1.5 text-center">${ds(item.scores.t3)}</td><td class="border border-black p-1.5 text-center font-bold">${ds(item.scores.asaj)}</td>
                        <td class="border border-black p-1.5 text-center font-extrabold">${parseFloat(calc.final).toFixed(1)}</td>
                    </tr>`;
                });
            }
            html += `</tbody></table>`; container.innerHTML = html;
        } else if (type === 'rekap') {
            if (!selClassRekap) { alert("Pilih Kelas terlebih dahulu sebelum mencetak Ledger."); return; }
            docTitle.textContent = "Ledger Rekapitulasi Nilai Akademik";
            docSub.innerHTML = `<span>Kelas: <b>${selClassRekap}</b></span> <span>Semester: <b>${getActiveSemester()}</b></span> <span>Tahun: <b>${getActiveTahun()}</b></span>`;

            const sourceTable = document.querySelector('#table-rekap-container table');
            if (sourceTable) {
                const clone = sourceTable.cloneNode(true); clone.className = "w-full text-[10pt] border-collapse border border-black text-black";
                clone.querySelectorAll('th, td').forEach(el => { el.className = "border border-black p-2 text-black " + (el.tagName === 'TH' ? 'font-bold text-center bg-gray-100' : 'text-center'); });
                const tdNames = clone.querySelectorAll('tbody td:nth-child(2)'); tdNames.forEach(td => td.classList.replace('text-center', 'text-left'));
                const thNames = clone.querySelectorAll('thead th'); if(thNames.length > 1) thNames[1].classList.replace('text-center', 'text-left');
                container.innerHTML = ''; container.appendChild(clone);
            } else { container.innerHTML = "<p class='text-center text-red-500'>Data Ledger Kosong.</p>"; }
        }
        modal.classList.replace('hidden', 'flex');
    };

    const exportNilaiToExcel = (isTemplate) => {
        if (!selClass || !selSubject) return alert("Pilih Kelas dan Mata Pelajaran terlebih dahulu.");
        
        const dataDisplay = getDisplayData();
        if (dataDisplay.length === 0) return alert("Belum ada data siswa di kelas ini. Harap Admin/Wali Kelas mengimpor daftar siswa terlebih dahulu.");

        const exportData = dataDisplay.map((item, index) => {
            return {
                "No": index + 1,
                "ID_SISTEM (JANGAN DIUBAH)": item.id,
                "Nama Siswa": item.studentName,
                "NISN": item.nisn || "-",
                "F1": isTemplate ? "" : ds(item.scores.f1),
                "F2": isTemplate ? "" : ds(item.scores.f2),
                "F3": isTemplate ? "" : ds(item.scores.f3),
                "T1": isTemplate ? "" : ds(item.scores.t1),
                "T2": isTemplate ? "" : ds(item.scores.t2),
                "T3": isTemplate ? "" : ds(item.scores.t3),
                "ASAJ": isTemplate ? "" : ds(item.scores.asaj),
                "NA (Otomatis)": isTemplate ? "" : getCalc(item.scores).final
            };
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Input_Nilai");
        
        const fileName = isTemplate 
            ? `Format_Input_Nilai_${selClass}_${selSubject}.xlsx`
            : `Data_Nilai_${selClass}_${selSubject}.xlsx`;

        XLSX.writeFile(wb, fileName);
    };

    const btnTemplateNilai = document.getElementById('btn-template-nilai');
    if (btnTemplateNilai) btnTemplateNilai.onclick = () => exportNilaiToExcel(true);

    const btnExportExcel = document.getElementById('btn-export-excel');
    if (btnExportExcel) btnExportExcel.onclick = () => exportNilaiToExcel(false);

    // 5. FORM TAMBAH / EDIT MANUAL
    const gradeForm = document.getElementById('grade-form');
    if(gradeForm) {
        gradeForm.onsubmit = async (e) => {
            e.preventDefault();
            const appUser = getAppUser();
            let tot = parseFloat(weights.f) + parseFloat(weights.t) + parseFloat(weights.a);
            if(Math.abs(tot - 100) > 0.1) { alert(`Total bobot harus 100%. Saat ini: ${tot}%`); return; }

            const studentName = document.getElementById('in-name').value.trim();
            const nisn = document.getElementById('in-nisn').value.trim();

            if (!editGradeId) {
                const isDuplicate = gradesData.some(g => 
                    g.tahun === getActiveTahun() && 
                    g.semester === getActiveSemester() && 
                    g.className === selClass && 
                    g.subject === selSubject &&
                    g.studentName.toLowerCase().trim() === studentName.toLowerCase()
                );

                if (isDuplicate) {
                    alert(`Gagal menyimpan! Siswa bernama "${studentName}" sudah ada di daftar nilai mapel ${selSubject} kelas ${selClass}.\n\nSilakan edit baris nilai yang sudah ada di tabel.`);
                    return; 
                }
            }

            const s = { f1:san(document.getElementById('in-f1').value), f2:san(document.getElementById('in-f2').value), f3:san(document.getElementById('in-f3').value), t1:san(document.getElementById('in-t1').value), t2:san(document.getElementById('in-t2').value), t3:san(document.getElementById('in-t3').value), asaj:san(document.getElementById('in-asaj').value) };
            const c = getCalc(s);
            const payload = { 
                studentName: studentName, nisn: nisn, 
                teacherName: appUser.username, subject: selSubject, className: selClass, 
                tahun: getActiveTahun(), semester: getActiveSemester(),
                scores: s, results: {avgFormative: parseFloat(c.avgFormative), avgTask:parseFloat(c.avgTask), final:parseFloat(c.final)}, 
                weightsSnapshot: weights 
            };
            try {
                await saveNewGrade(payload, editGradeId);
                gradeForm.reset(); document.getElementById('in-na').textContent = '0.0'; setEditGradeId(null);
                document.getElementById('badge-edit-mode')?.classList.add('hidden'); document.getElementById('btn-cancel-edit')?.classList.add('hidden');
                renderTable();
            } catch (err) { alert("Gagal menyimpan data!"); }
        };
    }

    // 6. IMPORT EXCEL NILAI
    const importXlsxNilai = document.getElementById('import-xlsx-nilai');
    if (importXlsxNilai) {
        importXlsxNilai.onchange = (e) => {
            const file = e.target.files[0]; if(!file) return;
            const reader = new FileReader();
            reader.onload = async (ev) => {
                try {
                    const data = new Uint8Array(ev.target.result);
                    const workbook = XLSX.read(data, {type: 'array'});
                    const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                    let count = 0;
                    for(let row of json) {
                        const id = row["ID_SISTEM (JANGAN DIUBAH)"]; if(!id) continue;
                        const ns = { f1:san(row["F1"]), f2:san(row["F2"]), f3:san(row["F3"]), t1:san(row["T1"]), t2:san(row["T2"]), t3:san(row["T3"]), asaj:san(row["ASAJ"]) };
                        const c = getCalc(ns);
                        await updateDoc(doc(getGradesCollection(), id), { scores: ns, results: { avgFormative: parseFloat(c.avgFormative), avgTask: parseFloat(c.avgTask), final: parseFloat(c.final) }, updatedAt: serverTimestamp() });
                        count++;
                    }
                    await writeLog("IMPORT_NILAI_EXCEL", `Guru memperbarui ${count} data nilai untuk mapel ${selSubject} kelas ${selClass}.`);
                    alert(`Berhasil memperbarui ${count} data nilai.`); renderTable();
                } catch(err) { alert("Format file Excel tidak sesuai. Harap gunakan Format yang diunduh dari aplikasi."); }
                e.target.value = null;
            };
            reader.readAsArrayBuffer(file);
        };
    }

    // 7. DELEGASI EVENT TABEL (AUTO-SAVE)
    const gradesTbody = document.getElementById('grades-tbody');
    if(gradesTbody) {
        gradesTbody.addEventListener('input', (e) => {
            if(e.target.tagName === 'INPUT') {
                const tr = e.target.closest('tr');
                if (tr.id === 'row-new-grade') {
                    const inps = tr.querySelectorAll('.in-score');
                    const s = { f1:inps[0].value, f2:inps[1].value, f3:inps[2].value, t1:inps[3].value, t2:inps[4].value, t3:inps[5].value, asaj:inps[6].value };
                    document.getElementById('in-na').textContent = getCalc(s).final; return;
                }
                const inps = tr.querySelectorAll('input');
                if (inps.length >= 7) {
                    const s = { f1:inps[0].value, f2:inps[1].value, f3:inps[2].value, t1:inps[3].value, t2:inps[4].value, t3:inps[5].value, asaj:inps[6].value };
                    const cellNa = tr.querySelector('.cell-na');
                    if (cellNa) { const finVal = getCalc(s).final; const isRemed = parseFloat(finVal) < 75; cellNa.innerHTML = (isRemed ? '<i class="ph ph-warning-circle text-red-500 mr-1"></i>' : '') + finVal; }
                }
            }
        });

        gradesTbody.addEventListener('focusout', async (e) => {
            if(e.target.tagName === 'INPUT') {
                const tr = e.target.closest('tr'); if (tr.id === 'row-new-grade') return;
                const id = tr.dataset.id; const item = gradesData.find(g=>g.id===id); if(!item) return;
                const field = e.target.dataset.f; const val = e.target.value;
                if(item.scores[field] == val) return;
                const ns = { ...item.scores, [field]: san(val) }; const c = getCalc(ns);
                try { await updateDoc(doc(getGradesCollection(), id), { scores: ns, results: {avgFormative: parseFloat(c.avgFormative), avgTask:parseFloat(c.avgTask), final:parseFloat(c.final)}, updatedAt: serverTimestamp() }); } 
                catch(err) { console.error("Gagal Auto-Save", err); }
            }
        });

        gradesTbody.addEventListener('click', (e) => {
            const btnEdit = e.target.closest('.btn-edit'); const btnDel = e.target.closest('.btn-del');
            if (btnEdit) {
                const tr = btnEdit.closest('tr'); const id = tr.dataset.id; const item = gradesData.find(g => g.id === id);
                if (item) {
                    setEditGradeId(id);
                    document.getElementById('in-name').value = item.studentName; document.getElementById('in-nisn').value = item.nisn || '';
                    document.getElementById('in-f1').value = ds(item.scores.f1); document.getElementById('in-f2').value = ds(item.scores.f2); document.getElementById('in-f3').value = ds(item.scores.f3);
                    document.getElementById('in-t1').value = ds(item.scores.t1); document.getElementById('in-t2').value = ds(item.scores.t2); document.getElementById('in-t3').value = ds(item.scores.t3);
                    document.getElementById('in-asaj').value = ds(item.scores.asaj); document.getElementById('in-na').textContent = getCalc(item.scores).final;
                    document.getElementById('badge-edit-mode').classList.remove('hidden'); document.getElementById('btn-cancel-edit').classList.remove('hidden');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            }
            if (btnDel) {
                const tr = btnDel.closest('tr'); const id = tr.dataset.id; const item = gradesData.find(g => g.id === id);
                if (item && confirm(`Hapus data nilai siswa "${item.studentName}"?`)) {
                    const backupDataJSON = JSON.stringify(item);
                    deleteDoc(doc(getGradesCollection(), id)).then(async () => { await writeLog("HAPUS_NILAI_GURU", `Menghapus nilai: ${item.studentName}. Backup: ${backupDataJSON}`); renderTable(); });
                }
            }
        });
    }
}

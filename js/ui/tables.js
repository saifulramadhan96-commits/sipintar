// File: js/ui/tables.js

import { getAppUser, getActiveTahun, getActiveSemester, USERS_DB } from '../services/auth.js';
import { getCalc, weights, ds } from '../services/db-grades.js';
import { MASTER_CLASSES, MASTER_SUBJECTS, MASTER_TAHUN, DEFAULT_TAHUN } from '../services/db-master.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from '../config/firebase.js';

export let gradesData = [];
export let selClass = '';
export let selSubject = '';
export let wFilter = 'all';
export let editGradeId = null;
export let searchQuery = ''; 

export let selClassRekap = '';

export function setGradesData(data) { gradesData = data; }
export function setEditGradeId(id) { editGradeId = id; }
export function setSearchQuery(q) { searchQuery = q.toLowerCase(); }
export function setFilters(c, s, w) { selClass = c; selSubject = s; wFilter = w; }

// ==========================================
// 1. RENDER TABEL REKAPITULASI (LEDGER NILAI)
// ==========================================
export function renderTableRekap() {
    const tbody = document.getElementById('rekap-tbody');
    const thead = document.getElementById('rekap-thead');
    const emptyState = document.getElementById('empty-state-rekap');
    const tableCont = document.getElementById('table-rekap-container');
    const appUser = getAppUser();

    if (!tbody || !thead || !appUser) return;

    const isWakasek = appUser.role === 'wakasek' || appUser.tugasTambahan === 'Wakasek Kurikulum';
    const isWali = appUser.role !== 'admin' && !isWakasek && (appUser.tugasTambahan === 'Wali Kelas' || appUser.jabatan === 'Wali Kelas');

    if (isWali && appUser.waliKelas) {
        selClassRekap = appUser.waliKelas;
        const elFilter = document.getElementById('filter-kelas-rekap');
        if (elFilter) {
            elFilter.innerHTML = `<option value="${appUser.waliKelas}">${appUser.waliKelas}</option>`;
            elFilter.value = appUser.waliKelas;
            elFilter.disabled = true; 
            elFilter.classList.add('bg-gray-100', 'cursor-not-allowed'); 
        }
    }

    if (!selClassRekap) {
        emptyState.classList.remove('hidden');
        tableCont.classList.add('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    tableCont.classList.remove('hidden');
    if (document.getElementById('badge-kelas-rekap')) document.getElementById('badge-kelas-rekap').textContent = selClassRekap;

    const thn = getActiveTahun();
    const smt = getActiveSemester();
    
    const d = gradesData.filter(g => g.tahun === thn && g.semester === smt && g.className === selClassRekap);

    const studentMap = new Map();
    d.forEach(g => {
        const key = g.studentName + "_" + (g.nisn || '');
        if(!studentMap.has(key)) studentMap.set(key, { name: g.studentName, nisn: g.nisn, scores: {} });
        studentMap.get(key).scores[g.subject] = getCalc(g.scores).final;
    });

    const students = Array.from(studentMap.values());

    students.forEach(s => {
        let total = 0; let count = 0;
        MASTER_SUBJECTS.forEach(sub => {
            if (s.scores[sub]) { total += parseFloat(s.scores[sub]); count++; }
        });
        s.total = total;
        s.avg = count > 0 ? (total / MASTER_SUBJECTS.length) : 0; 
    });

    // Menentukan Peringkat Kelas berdasarkan total nilai
    const rankedStudents = [...students].sort((a, b) => b.total - a.total);
    rankedStudents.forEach((rs, i) => rs.rank = i + 1);

    // PENGURUTAN ABJAD (A-Z) UNTUK LEDGER
    students.sort((a, b) => a.name.localeCompare(b.name));

    let thHtml = `<tr>
        <th class="px-4 py-3 w-10 border border-blue-200 text-center">No</th>
        <th class="px-4 py-3 min-w-[200px] border border-blue-200">Nama Lengkap Siswa</th>
        <th class="px-3 py-3 border border-blue-200">NISN</th>`;
    MASTER_SUBJECTS.forEach(sub => {
        thHtml += `<th class="px-2 py-3 text-center border border-blue-200 text-xs"><div style="writing-mode: vertical-rl; transform: rotate(180deg); margin: 0 auto;">${sub}</div></th>`;
    });
    thHtml += `<th class="px-3 py-3 text-center border border-blue-200">Total</th>
               <th class="px-3 py-3 text-center border border-blue-200">Rata-rata</th>
               <th class="px-3 py-3 text-center border border-blue-200">Rank</th>
               </tr>`;
    thead.innerHTML = thHtml;

    if (students.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${6 + MASTER_SUBJECTS.length}" class="p-8 text-center text-gray-400 font-medium">Belum ada data nilai yang diinputkan oleh guru di kelas ini.</td></tr>`;
    } else {
        tbody.innerHTML = students.map((s, i) => {
            let tdHtml = `<tr class="hover:bg-blue-50 transition-colors border-b border-gray-100">
                <td class="px-4 py-2 text-center border border-gray-200 text-gray-500">${i+1}</td>
                <td class="px-4 py-2 font-bold text-gray-800 border border-gray-200 whitespace-nowrap">${s.name}</td>
                <td class="px-3 py-2 text-xs font-mono text-gray-500 border border-gray-200">${s.nisn||'-'}</td>`;
            
            MASTER_SUBJECTS.forEach(sub => {
                const val = s.scores[sub] !== undefined ? parseFloat(s.scores[sub]).toFixed(1) : '-';
                const isRemed = val !== '-' && parseFloat(val) < 75;
                const color = isRemed ? 'text-red-600 font-bold' : 'text-gray-700 font-medium';
                tdHtml += `<td class="px-2 py-2 text-center text-xs border border-gray-200 ${color}">${val}</td>`;
            });

            tdHtml += `<td class="px-3 py-2 text-center font-bold text-blue-700 border border-gray-200 bg-blue-50/50">${s.total.toFixed(1)}</td>
                       <td class="px-3 py-2 text-center font-bold text-emerald-700 border border-gray-200 bg-emerald-50/50">${s.avg.toFixed(1)}</td>
                       <td class="px-3 py-2 text-center font-extrabold text-orange-500 border border-gray-200 text-lg">${s.rank}</td>
                       </tr>`;
            return tdHtml;
        }).join('');
    }
}

window.exportRekapExcel = () => {
    if (!selClassRekap) return alert("Pilih kelas terlebih dahulu.");
    const thn = getActiveTahun(); const smt = getActiveSemester();
    const d = gradesData.filter(g => g.tahun === thn && g.semester === smt && g.className === selClassRekap);
    const studentMap = new Map();
    d.forEach(g => {
        const key = g.studentName + "_" + (g.nisn||'');
        if(!studentMap.has(key)) studentMap.set(key, { "Nama Siswa": g.studentName, "NISN": g.nisn||'-' });
        studentMap.get(key)[g.subject] = parseFloat(getCalc(g.scores).final).toFixed(1);
    });
    let students = Array.from(studentMap.values());
    
    students.forEach(s => {
        let total = 0, count = 0;
        MASTER_SUBJECTS.forEach(sub => { if (s[sub]) { total += parseFloat(s[sub]); count++; } });
        s["Jumlah Nilai"] = parseFloat(total.toFixed(1));
        s["Rata-rata"] = count > 0 ? parseFloat((total / MASTER_SUBJECTS.length).toFixed(1)) : 0; 
    });
    
    // Tentukan Peringkat
    students.sort((a, b) => b["Jumlah Nilai"] - a["Jumlah Nilai"]);
    students.forEach((s, i) => s["Peringkat Kelas"] = i + 1);
    
    // PENGURUTAN ABJAD (A-Z) UNTUK EXPORT EXCEL
    students.sort((a, b) => a["Nama Siswa"].localeCompare(b["Nama Siswa"]));

    const ws = XLSX.utils.json_to_sheet(students);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rekap_Nilai");
    XLSX.writeFile(wb, `Ledger_Rekap_Nilai_${selClassRekap}.xlsx`);
};

window.updateFilterRekap = (val) => { selClassRekap = val; renderTableRekap(); };


// ==========================================
// 2. FUNGSI RENDER TABEL (GURU, SISWA, INPUT NILAI)
// ==========================================
export async function renderTableGuru() {
    const tbody = document.getElementById('crud-guru-tbody');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="p-6 text-center text-gray-500"><i class="ph ph-spinner animate-spin text-2xl"></i> Memuat data dari database...</td></tr>';
    try {
        const usersSnap = await getDocs(collection(db, 'users'));
        let usersList = [];
        usersSnap.forEach(doc => { usersList.push({ id: doc.id, ...doc.data() }); });

        // FITUR BARU: Mengurutkan Daftar Guru berdasarkan Abjad (A-Z)
        usersList.sort((a, b) => a.username.localeCompare(b.username));

        USERS_DB.length = 0; 
        usersList.forEach(u => USERS_DB.push(u));

        if (usersList.length === 0) { tbody.innerHTML = '<tr><td colspan="5" class="p-6 text-center text-gray-400">Tidak ada data pengguna.</td></tr>'; return; }

        tbody.innerHTML = usersList.map((u, i) => {
            const isAdmin = u.role === 'admin';
            const isWali = u.tugasTambahan === 'Wali Kelas' || u.jabatan === 'Wali Kelas';
            const isWakasek = u.tugasTambahan === 'Wakasek Kurikulum' || u.role === 'wakasek';
            
            let jabatanHtml = '';
            if (isAdmin) jabatanHtml = `<div class="font-bold text-red-600 uppercase tracking-wider text-xs">Administrator</div>`;
            else {
                jabatanHtml = `<div class="font-bold text-gray-800 text-xs">Guru Mata Pelajaran</div>`;
                if (isWali && u.waliKelas) jabatanHtml += `<div class="text-[10px] text-blue-600 mt-1 font-bold flex items-center gap-1"><i class="ph ph-star-fill"></i> Wali Kelas <span class="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">${u.waliKelas}</span></div>`;
                else if (isWakasek) jabatanHtml += `<div class="text-[10px] text-purple-600 mt-1 font-bold flex items-center gap-1"><i class="ph ph-star-fill"></i> Wakasek Kurikulum</div>`;
            }
            return `
                <tr class="border-b hover:bg-gray-50 transition-colors">
                    <td class="p-3 text-center text-gray-500">${i+1}</td>
                    <td class="p-3 font-medium text-gray-800">${u.username}</td>
                    <td class="p-3">${jabatanHtml}</td>
                    <td class="p-3 font-mono text-gray-400 text-xs">${u.password}</td>
                    <td class="p-3 text-right whitespace-nowrap">
                       <button onclick="window.openResetSandi('${u.id}', '${encodeURIComponent(u.username)}')" class="text-orange-500 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 p-1.5 rounded transition-colors mr-2" title="Reset Sandi"><i class="ph ph-key text-lg"></i></button>
                       <button onclick="window.editGuru('${u.id}')" class="text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 p-1.5 rounded transition-colors mr-2" title="Atur Profil"><i class="ph ph-briefcase text-lg"></i></button>
                       <button onclick="window.deleteGuru('${u.id}', '${encodeURIComponent(u.username)}')" class="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-1.5 rounded transition-colors" title="Hapus Akun"><i class="ph ph-trash text-lg"></i></button>
                    </td>
                </tr>`;
        }).join('');
    } catch (err) { tbody.innerHTML = '<tr><td colspan="5" class="p-6 text-center text-red-500">Gagal mengambil data server.</td></tr>'; }
}

export function renderTableSiswa() {
    const tbody = document.getElementById('crud-siswa-tbody');
    const filter = document.getElementById('crud-siswa-kelas-filter');
    const appUser = getAppUser();
    if(!tbody || !filter || !appUser) return;
    
    let clsData = gradesData.filter(g => g.tahun === getActiveTahun() && g.semester === getActiveSemester());
    const isWakasek = appUser.role === 'wakasek' || appUser.tugasTambahan === 'Wakasek Kurikulum';
    const isWali = appUser.role !== 'admin' && !isWakasek && (appUser.tugasTambahan === 'Wali Kelas' || appUser.jabatan === 'Wali Kelas');

    if (isWali && appUser.waliKelas) {
        clsData = clsData.filter(g => g.className === appUser.waliKelas);
    } else if (filter.value) { 
        clsData = clsData.filter(g => g.className === filter.value);
    }

    const map = new Map();
    clsData.forEach(g => { const key = g.studentName + "_" + (g.nisn||'') + "_" + g.className; if(!map.has(key)) map.set(key, { name: g.studentName, nisn: g.nisn, className: g.className }); });
    const students = Array.from(map.values());

    // PENGURUTAN ABJAD (A-Z) UNTUK KELOLA SISWA
    students.sort((a, b) => a.name.localeCompare(b.name));

    tbody.innerHTML = students.map((s, i) => {
        const encN = encodeURIComponent(s.name); const encI = encodeURIComponent(s.nisn || ''); const encC = encodeURIComponent(s.className);
        return `
            <tr class="border-b hover:bg-gray-50 transition-colors">
                <td class="p-3 text-center text-gray-500">${i+1}</td>
                <td class="p-3 font-medium text-gray-800">${s.name}</td>
                <td class="p-3 font-mono text-gray-500 text-sm">${s.nisn || '-'}</td>
                <td class="p-3 text-center"><span class="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-1 rounded-full uppercase">${s.className}</span></td>
                <td class="p-3 text-right whitespace-nowrap">
                    <button onclick="window.editSiswa('${encN}', '${encI}', '${encC}')" class="text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 p-1.5 rounded transition-colors mr-1"><i class="ph ph-pencil-simple text-lg"></i></button>
                    <button onclick="window.deleteSiswa('${encN}', '${encI}', '${encC}')" class="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-1.5 rounded transition-colors"><i class="ph ph-trash text-lg"></i></button>
                </td>
            </tr>`;
    }).join('') || `<tr><td colspan="5" class="p-8 text-center text-gray-400">Belum ada data siswa ditemukan pada kelas ini.</td></tr>`;
}

export function getDisplayData() {
    const appUser = getAppUser();
    const thn = getActiveTahun();
    const smt = getActiveSemester();

    let d = gradesData.filter(g => g.tahun === thn && g.semester === smt);
    const isWakasek = appUser.role === 'wakasek' || appUser.tugasTambahan === 'Wakasek Kurikulum';
    
    if (appUser.role === 'guru' && !isWakasek) {
        d = d.filter(g => g.teacherName === appUser.username || g.teacherName === 'admin');
    }
    
    if(selSubject) d = d.filter(g => g.subject === selSubject);
    if(selClass) d = d.filter(g => g.className === selClass);
    if(wFilter !== 'all') d = d.filter(g => g.teacherName === wFilter);
    if(searchQuery) d = d.filter(g => g.studentName.toLowerCase().includes(searchQuery));
    
    // PENGURUTAN ABJAD (A-Z) UNTUK TABEL INPUT NILAI
    d.sort((a, b) => a.studentName.localeCompare(b.studentName));
    
    return d;
}

export function renderTable() {
    const appUser = getAppUser();
    const tableCont = document.getElementById('table-container');
    const gradesTbody = document.getElementById('grades-tbody');
    const emptyState = document.getElementById('empty-state-nilai');

    if(!appUser || !tableCont || !gradesTbody) return;

    const filterGuruWrap = document.getElementById('filter-guru-wrapper');
    const filterGrid = document.getElementById('filter-grid');
    const isWakasek = appUser.role === 'wakasek' || appUser.tugasTambahan === 'Wakasek Kurikulum';

    if (filterGuruWrap && filterGrid) {
        if (appUser.role !== 'admin' && !isWakasek) {
            filterGuruWrap.classList.add('hidden');
            filterGrid.classList.remove('md:grid-cols-3');
            filterGrid.classList.add('md:grid-cols-2');
        } else {
            filterGuruWrap.classList.remove('hidden');
            filterGrid.classList.remove('md:grid-cols-2');
            filterGrid.classList.add('md:grid-cols-3');
        }
    }

    if(!selClass || ((appUser.role === 'guru' || appUser.role === 'admin') && !selSubject)) {
        if(emptyState) emptyState.classList.remove('hidden'); tableCont.classList.add('hidden'); return;
    }

    if(emptyState) emptyState.classList.add('hidden'); tableCont.classList.remove('hidden');

    if(document.getElementById('badge-guru')) { 
        document.getElementById('badge-guru').classList.toggle('hidden', !isWakasek && appUser.role !== 'admin'); 
        document.getElementById('badge-guru').textContent = wFilter === 'all' ? 'Semua Guru' : wFilter; 
    }
    if(document.getElementById('badge-kelas')) document.getElementById('badge-kelas').textContent = selClass;
    if(document.getElementById('badge-mapel')) document.getElementById('badge-mapel').textContent = selSubject || 'Semua Mapel';
    
    if(appUser.role !== 'admin') { 
        document.getElementById('weights-container')?.classList.remove('hidden'); 
        document.getElementById('guru-excel-actions')?.classList.remove('hidden'); 
        document.querySelectorAll('.guru-col').forEach(c => c.classList.remove('hidden'));
    } else {
        document.getElementById('weights-container')?.classList.add('hidden'); 
        document.getElementById('guru-excel-actions')?.classList.add('hidden'); 
        document.querySelectorAll('.guru-col').forEach(c => c.classList.add('hidden'));
    }

    const d = getDisplayData();
    let countPass = 0, countRemed = 0; let html = '';

    if (d.length === 0) { 
        html = `<tr><td colspan="11" class="px-4 py-12 text-center text-gray-400 font-medium">Belum ada data nilai/siswa di kelas ini.</td></tr>`; 
    } else {
        d.forEach((item, idx) => {
            const calc = getCalc(item.scores); const finNum = parseFloat(calc.final); const isRemedial = finNum < 75.0; 
            if(isRemedial) countRemed++; else countPass++;
            const naColor = isRemedial ? 'text-red-600 bg-red-50' : 'text-blue-700 bg-blue-50/20';
            const naIcon = isRemedial ? '<i class="ph ph-warning-circle text-red-500 mr-1"></i>' : '';
            const bgA = 'bg-emerald-50/50 text-emerald-700 font-bold';

            if(appUser.role === 'admin' && editGradeId !== item.id) {
                html += `
                <tr class="hover:bg-blue-50/50 border-b border-gray-100 transition-colors print:bg-white">
                    <td class="px-4 py-3 text-center text-gray-500 text-xs">${idx+1}</td>
                    <td class="px-4 py-3">
                        <div class="font-bold text-gray-800 uppercase">${item.studentName}</div>
                        <div class="text-[10px] text-gray-400 font-mono">${item.nisn||'-'}</div>
                        <div class="text-[9px] text-blue-500 font-bold uppercase mt-1">${item.teacherName} | ${item.subject}</div>
                    </td>
                    <td class="px-2 py-3 text-center text-sm">${ds(item.scores.f1)}</td><td class="px-2 py-3 text-center text-sm">${ds(item.scores.f2)}</td><td class="px-2 py-3 text-center text-sm">${ds(item.scores.f3)}</td>
                    <td class="px-2 py-3 text-center text-sm">${ds(item.scores.t1)}</td><td class="px-2 py-3 text-center text-sm">${ds(item.scores.t2)}</td><td class="px-2 py-3 text-center text-sm">${ds(item.scores.t3)}</td>
                    <td class="px-2 py-3 text-center font-bold text-emerald-700">${ds(item.scores.asaj)}</td>
                    <td class="px-4 py-3 text-center font-bold ${naColor} border-l border-gray-100">${naIcon}${finNum.toFixed(1)}</td>
                </tr>`;
            } else {
                html += `
                <tr data-id="${item.id}" class="hover:bg-blue-50/50 border-b border-gray-100 transition-colors print:bg-white">
                    <td class="px-4 py-3 text-center text-gray-500 text-xs">${idx+1}</td>
                    <td class="px-4 py-3">
                        <div class="font-bold text-gray-800 uppercase">${item.studentName}</div>
                        <div class="text-[10px] text-gray-400 font-mono">${item.nisn||'-'}</div>
                        ${isWakasek ? `<div class="text-[9px] text-blue-500 font-bold uppercase mt-1" title="Guru Pembuat Nilai">${item.teacherName}</div>` : ''}
                    </td>
                    <td class="px-1 py-3"><input type="number" min="0" max="100" data-f="f1" value="${ds(item.scores.f1)}" class="w-full border border-gray-300 rounded p-1 text-center text-sm outline-none focus:border-blue-500"></td>
                    <td class="px-1 py-3"><input type="number" min="0" max="100" data-f="f2" value="${ds(item.scores.f2)}" class="w-full border border-gray-300 rounded p-1 text-center text-sm outline-none focus:border-blue-500"></td>
                    <td class="px-1 py-3"><input type="number" min="0" max="100" data-f="f3" value="${ds(item.scores.f3)}" class="w-full border border-gray-300 rounded p-1 text-center text-sm outline-none focus:border-blue-500"></td>
                    <td class="px-1 py-3"><input type="number" min="0" max="100" data-f="t1" value="${ds(item.scores.t1)}" class="w-full border border-gray-300 rounded p-1 text-center text-sm outline-none focus:border-blue-500"></td>
                    <td class="px-1 py-3"><input type="number" min="0" max="100" data-f="t2" value="${ds(item.scores.t2)}" class="w-full border border-gray-300 rounded p-1 text-center text-sm outline-none focus:border-blue-500"></td>
                    <td class="px-1 py-3"><input type="number" min="0" max="100" data-f="t3" value="${ds(item.scores.t3)}" class="w-full border border-gray-300 rounded p-1 text-center text-sm outline-none focus:border-blue-500"></td>
                    <td class="px-1 py-3"><input type="number" min="0" max="100" data-f="asaj" value="${ds(item.scores.asaj)}" class="w-full border border-gray-300 rounded p-1 text-center text-sm outline-none focus:border-blue-500 ${bgA}"></td>
                    <td class="px-4 py-3 text-center font-bold ${naColor} cell-na border-l border-gray-100">${naIcon}${finNum.toFixed(1)}</td>
                    <td class="px-4 py-3 text-right print-hidden">
                        <div class="flex justify-end gap-1">
                            <button type="button" class="btn-edit p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><i class="ph ph-book-open text-lg pointer-events-none"></i></button>
                            <button type="button" class="btn-del p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><i class="ph ph-trash text-lg pointer-events-none"></i></button>
                        </div>
                    </td>
                </tr>`;
            }
        });
    }

    if (document.getElementById('stat-pass-percent')) document.getElementById('stat-pass-percent').textContent = `${d.length > 0 ? Math.round((countPass / d.length) * 100) : 0}%`;
    if (document.getElementById('count-pass')) document.getElementById('count-pass').textContent = `${countPass} Siswa`;
    if (document.getElementById('count-remed')) document.getElementById('count-remed').textContent = `${countRemed} Siswa`;

    const rowNewGrade = document.getElementById('row-new-grade');
    gradesTbody.innerHTML = (appUser.role !== 'admin' ? (rowNewGrade ? rowNewGrade.outerHTML : '') : '') + html;
    if(document.getElementById('row-new-grade') && !editGradeId && appUser.role !== 'admin') document.getElementById('row-new-grade').classList.remove('hidden');
    window.renderTable = renderTable;
}

export function renderMasterDataUI() {
    const thnList = document.getElementById('master-tahun-list'); const clsList = document.getElementById('master-class-list'); const subList = document.getElementById('master-subject-list');
    if (thnList) thnList.innerHTML = MASTER_TAHUN.map((t, i) => `<div class="flex justify-between items-center p-2.5 bg-white border border-gray-200 rounded-lg mb-2 shadow-sm"><span class="font-medium text-blue-700">${t}</span><button onclick="window.deleteMasterTahun(${i})" class="text-red-500 hover:bg-red-50 p-1.5 rounded-md"><i class="ph ph-trash text-lg"></i></button></div>`).join('') || '<div class="text-xs text-gray-400 text-center">Kosong</div>';
    if (clsList) clsList.innerHTML = MASTER_CLASSES.map((c, i) => `<div class="flex justify-between items-center p-2.5 bg-white border border-gray-200 rounded-lg mb-2 shadow-sm"><span class="font-medium text-gray-700">${c}</span><button onclick="window.deleteMasterClass(${i})" class="text-red-500 hover:bg-red-50 p-1.5 rounded-md"><i class="ph ph-trash text-lg"></i></button></div>`).join('') || '<div class="text-xs text-gray-400 text-center">Kosong</div>';
    if (subList) subList.innerHTML = MASTER_SUBJECTS.map((s, i) => `<div class="flex justify-between items-center p-2.5 bg-white border border-gray-200 rounded-lg mb-2 shadow-sm"><span class="font-medium text-gray-700">${s}</span><button onclick="window.deleteMasterSubject(${i})" class="text-red-500 hover:bg-red-50 p-1.5 rounded-md"><i class="ph ph-trash text-lg"></i></button></div>`).join('') || '<div class="text-xs text-gray-400 text-center">Kosong</div>';
}

export function populateDropdowns() {
    const allTahun = [...new Set([...DEFAULT_TAHUN, ...MASTER_TAHUN])].sort();
    const thnOpts = allTahun.map(t => `<option value="${t}">${t}</option>`).join('');
    ['login-tahun', 'dash-filter-tahun', 'copy-tahun-asal'].forEach(id => { const el = document.getElementById(id); if(el) { const oldVal = el.value; el.innerHTML = thnOpts; if (oldVal && allTahun.includes(oldVal)) el.value = oldVal; } });

    const appUser = getAppUser();
    const dbClasses = [...new Set(gradesData.map(g => g.className))].filter(Boolean);
    const allClassesGeneral = [...new Set([...MASTER_CLASSES, ...dbClasses])].sort();
    
    const isWakasek = appUser && (appUser.role === 'wakasek' || appUser.tugasTambahan === 'Wakasek Kurikulum');
    const isWali = appUser && appUser.role !== 'admin' && !isWakasek && (appUser.tugasTambahan === 'Wali Kelas' || appUser.jabatan === 'Wali Kelas');

    const clsOptsSemuaNilai = `<option value="">-- Semua Kelas --</option>` + allClassesGeneral.map(c => `<option value="${c}">${c}</option>`).join('');

    let allClassesManajemen = [...allClassesGeneral];
    if (isWali && appUser.waliKelas) { allClassesManajemen = [appUser.waliKelas]; }
    
    const clsOptsPilihManajemen = `<option value="">-- Pilih Kelas --</option>` + allClassesManajemen.map(c => `<option value="${c}">${c}</option>`).join('');
    const clsOptsSemuaManajemen = `<option value="">-- Semua Kelas --</option>` + allClassesManajemen.map(c => `<option value="${c}">${c}</option>`).join('');

    const dbSubjects = [...new Set(gradesData.map(g => g.subject))].filter(Boolean);
    const allMapel = [...new Set([...MASTER_SUBJECTS, ...dbSubjects])].sort();
    const subOpts = `<option value="">-- Pilih Mapel --</option>` + allMapel.map(s => `<option value="${s}">${s}</option>`).join('');
    
    ['import-class-select', 'delete-class-select', 'copy-class-asal', 'copy-class-tujuan'].forEach(id => { const el = document.getElementById(id); if(el) { const v = el.value; el.innerHTML = clsOptsPilihManajemen; el.value = v; } });
    ['crud-siswa-kelas-filter'].forEach(id => { const el = document.getElementById(id); if(el) { const v = el.value; el.innerHTML = clsOptsSemuaManajemen; el.value = v; } });

    const elFilterKelasNilai = document.getElementById('filter-kelas');
    if(elFilterKelasNilai) { const v = elFilterKelasNilai.value; elFilterKelasNilai.innerHTML = clsOptsSemuaNilai; elFilterKelasNilai.value = v; }

    const elFilterKelasRekap = document.getElementById('filter-kelas-rekap');
    if (elFilterKelasRekap) {
        if (isWali && appUser.waliKelas) {
            elFilterKelasRekap.innerHTML = `<option value="${appUser.waliKelas}">${appUser.waliKelas}</option>`;
            elFilterKelasRekap.value = appUser.waliKelas;
            elFilterKelasRekap.disabled = true;
            elFilterKelasRekap.classList.add('bg-gray-100', 'cursor-not-allowed');
            selClassRekap = appUser.waliKelas;
        } else {
            const v = elFilterKelasRekap.value; 
            elFilterKelasRekap.innerHTML = clsOptsPilihManajemen; 
            elFilterKelasRekap.value = v; 
            elFilterKelasRekap.disabled = false;
            elFilterKelasRekap.classList.remove('bg-gray-100', 'cursor-not-allowed');
        }
    }

    const elMapel = document.getElementById('filter-mapel');
    if(elMapel) { const v = elMapel.value; elMapel.innerHTML = subOpts; elMapel.value = v; }
}

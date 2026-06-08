// File: js/main.js

import './config/firebase.js'; 
import { query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getGradesCollection } from './config/firebase.js';
import { setupAuth, initLoginForm, handleLogout, getActiveTahun, getActiveSemester, restoreSession, getAppUser } from './services/auth.js';
import { loadMasterData } from './services/db-master.js';
import { setupNavigation, buildSidebarNav, switchMenu as coreSwitchMenu } from './ui/navigation.js';
import { setupFirestoreListener } from './services/db-grades.js';
import { renderTableSiswa, renderTableGuru, renderTable, renderTableRekap, populateDropdowns, renderMasterDataUI, gradesData } from './ui/tables.js';
import { setupUIEvents } from './ui/events.js';
import { setupAdminEvents } from './ui/admin.js';
import { updateDashboardChart } from './services/charts.js';

function init() {
    const currentDateEl = document.getElementById('current-date');
    if (currentDateEl) currentDateEl.textContent = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const debugDot = document.getElementById('debug-status-dot');
    const btnToggleDebug = document.getElementById('btn-toggle-debug');
    const debugPanel = document.getElementById('debug-panel');
    if (btnToggleDebug && debugPanel) btnToggleDebug.onclick = () => debugPanel.classList.toggle('hidden');

    setupNavigation(); setupUIEvents(); setupAdminEvents();
    
    initLoginForm((user) => { showApp(user); });

    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) btnLogout.onclick = () => handleLogout();

    const btnApplyDashFilter = document.getElementById('btn-apply-dash-filter');
    if (btnApplyDashFilter) btnApplyDashFilter.onclick = () => { updateDashboardView(); };

    setupAuth(async (firebaseUser) => {
        if (debugDot) { debugDot.classList.replace('bg-red-500', 'bg-green-500'); debugDot.classList.remove('animate-pulse'); }
        await loadMasterData(); populateDropdowns(); 
        
        const savedUser = restoreSession();
        if (savedUser) showApp(savedUser);
    });

    window.switchMenu = (menuId) => {
        coreSwitchMenu(menuId);
        if (menuId === 'admin-master') renderMasterDataUI();
        if (menuId === 'admin-guru') renderTableGuru();
        if (menuId === 'admin-import') renderTableSiswa();
        if (menuId === 'nilai') renderTable();
        if (menuId === 'rekap') renderTableRekap();
    };
}

export async function updateDashboardView() {
    const appUser = getAppUser();
    if (!appUser) return;

    let thn = getActiveTahun(); 
    let smt = getActiveSemester();
    
    const isWakasek = appUser.role === 'wakasek' || appUser.tugasTambahan === 'Wakasek Kurikulum';
    const isAdmin = appUser.role === 'admin';
    
    const filterDash = document.getElementById('dashboard-filter-bar');
    
    // PERBAIKAN: Hanya membaca dropdown filter jika sedang tidak disembunyikan (Bukan Guru biasa)
    if (filterDash && !filterDash.classList.contains('hidden')) {
        const dashTahun = document.getElementById('dash-filter-tahun');
        const dashSmt = document.getElementById('dash-filter-smt');
        // PENTING: Jangan timpa value thn/smt jika value dari dropdown masih kosong ("")
        if (dashTahun && dashTahun.value !== "") thn = dashTahun.value;
        if (dashSmt && dashSmt.value !== "") smt = dashSmt.value;
    }

    let targetGrades = [];

    if (thn === getActiveTahun() && smt === getActiveSemester()) {
        if (!gradesData) return;
        targetGrades = gradesData.filter(g => g.tahun === thn && g.semester === smt);
    } else {
        const btnApply = document.getElementById('btn-apply-dash-filter');
        try {
            if(btnApply) { btnApply.innerHTML = '<i class="ph ph-spinner animate-spin"></i> Memuat...'; btnApply.disabled = true; }
            const q = query(getGradesCollection(), where("tahun", "==", thn), where("semester", "==", smt));
            const snap = await getDocs(q);
            targetGrades = snap.docs.map(doc => doc.data());
        } catch (err) {
            console.error("Gagal menarik data lama:", err);
        } finally {
            if(btnApply) { btnApply.innerHTML = 'Terapkan Filter'; btnApply.disabled = false; }
        }
    }

    // Filter khusus Guru (Hanya bisa menghitung statistik dari kelas/mapel-nya sendiri)
    if (!isAdmin && !isWakasek) {
        targetGrades = targetGrades.filter(g => g.teacherName === appUser.username || g.teacherName === 'admin');
    }

    // Hitung jumlah siswa unik (menggabungkan nama + nisn agar tidak dobel karena 1 siswa ada 15 mapel)
    const totalSiswa = [...new Set(targetGrades.map(g => g.studentName + "_" + (g.nisn || '')))].length;
    const avgNilai = targetGrades.length ? targetGrades.reduce((acc, curr) => acc + (parseFloat(curr.results?.final) || 0), 0) / targetGrades.length : 0;
    
    const statStudents = document.getElementById('stat-students');
    const statAvg = document.getElementById('stat-avg');
    
    if(statStudents) statStudents.textContent = totalSiswa;
    if(statAvg) statAvg.textContent = avgNilai.toFixed(1);
    
    updateDashboardChart(targetGrades);
}

function showApp(user) {
    if (!user) return; 
    document.getElementById('login-view').classList.add('hidden');
    document.getElementById('main-view').classList.remove('hidden');
    
    const rawName = user.username || user.name || 'Pengguna';
    const shortName = String(rawName).split(',')[0];
    
    if (document.getElementById('auth-user-name')) document.getElementById('auth-user-name').textContent = shortName;
    if (document.getElementById('page-subtitle-name')) document.getElementById('page-subtitle-name').textContent = shortName;
    
    let displayRole = user.role === 'admin' ? 'Administrator' : 'Guru Mata Pelajaran';
    if (user.role !== 'admin') {
        if (user.tugasTambahan === 'Wakasek Kurikulum' || user.role === 'wakasek') displayRole = 'Wakasek Kurikulum';
        else if (user.tugasTambahan === 'Wali Kelas' || user.jabatan === 'Wali Kelas') displayRole = `Wali Kelas ${user.waliKelas ? user.waliKelas : ''}`;
    }
    if (document.getElementById('auth-user-role')) document.getElementById('auth-user-role').textContent = displayRole;

    const dashName = document.getElementById('dash-name');
    const dashDesc = document.getElementById('dash-desc');
    const dashBtn = document.getElementById('dash-action-btn');

    if (dashName) dashName.textContent = shortName;

    if (user.role === 'admin') {
        if (dashDesc) dashDesc.textContent = "Pusat kendali database sekolah. Pantau rekapitulasi nilai dan kelola pengguna sistem.";
        if (dashBtn) {
            dashBtn.innerHTML = '<i class="ph ph-table text-xl"></i> Pantau Rekap Nilai';
            dashBtn.onclick = () => window.switchMenu('rekap');
        }
    } else if (user.role === 'wakasek' || user.tugasTambahan === 'Wakasek Kurikulum') {
        if (dashDesc) dashDesc.textContent = "Pantau perkembangan akademik siswa dan kelola administrasi kurikulum sekolah secara menyeluruh.";
        if (dashBtn) {
            dashBtn.innerHTML = '<i class="ph ph-exam text-xl"></i> Pantau Data Nilai';
            dashBtn.onclick = () => window.switchMenu('nilai');
        }
    } else {
        if (dashDesc) dashDesc.textContent = "Kelola nilai siswa dan administrasi rapor dengan lebih efisien dan terstruktur.";
        if (dashBtn) {
            dashBtn.innerHTML = '<i class="ph ph-pencil-simple text-xl"></i> Mulai Input Nilai';
            dashBtn.onclick = () => window.switchMenu('nilai');
        }
    }
    
    const thn = getActiveTahun();
    const smt = getActiveSemester();
    if (document.getElementById('display-periode')) document.getElementById('display-periode').innerHTML = `<i class="ph ph-calendar-check mr-2"></i> TA. ${thn} - ${smt}`;
    
    if (user.role === 'admin' || user.role === 'wakasek' || user.tugasTambahan === 'Wakasek Kurikulum') {
        const filterDash = document.getElementById('dashboard-filter-bar');
        if (filterDash) {
            filterDash.classList.remove('hidden');
            if (document.getElementById('dash-filter-tahun')) document.getElementById('dash-filter-tahun').value = thn;
            if (document.getElementById('dash-filter-smt')) document.getElementById('dash-filter-smt').value = smt;
        }
    }

    if (document.getElementById('label-copy-tahun-aktif')) document.getElementById('label-copy-tahun-aktif').textContent = thn;
    if (document.getElementById('label-copy-smt-aktif')) document.getElementById('label-copy-smt-aktif').textContent = smt;

    buildSidebarNav(); 
    window.switchMenu('dashboard');

    setupFirestoreListener(() => {
        populateDropdowns(); 
        updateDashboardView();
        
        const activeSec = document.querySelector('.section-container:not(.hidden)');
        if (activeSec) {
            if (activeSec.id === 'sec-admin-import') renderTableSiswa(); 
            if (activeSec.id === 'sec-admin-guru') renderTableGuru();
            if (activeSec.id === 'sec-admin-master') renderMasterDataUI(); 
            if (activeSec.id === 'sec-nilai') renderTable();
            if (activeSec.id === 'sec-rekap') renderTableRekap();
        }
    });
}

window.onload = init;

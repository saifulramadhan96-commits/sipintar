// File: js/services/charts.js

let chartInstance = null;

export function updateDashboardChart(gradesData) {
    const ctx = document.getElementById('gradeDistributionChart');
    if (!ctx) return;

    // 1. Kategorisasi Nilai (Numerasi Data)
    const stats = {
        'SANGAT BAIK (90-100)': 0,
        'BAIK (80-89)': 0,
        'CUKUP (75-79)': 0,
        'PERLU BIMBINGAN (<75)': 0
    };

    gradesData.forEach(g => {
        const score = parseFloat(g.results?.final || 0);
        if (score >= 90) stats['SANGAT BAIK (90-100)']++;
        else if (score >= 80) stats['BAIK (80-89)']++;
        else if (score >= 75) stats['CUKUP (75-79)']++;
        else if (score > 0) stats['PERLU BIMBINGAN (<75)']++;
    });

    // 2. Hancurkan chart lama jika ada (agar tidak tumpang tindih saat refresh data)
    if (chartInstance) {
        chartInstance.destroy();
    }

    // 3. Gambar Chart Baru
    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(stats),
            datasets: [{
                label: 'Jumlah Siswa',
                data: Object.values(stats),
                backgroundColor: [
                    'rgba(16, 185, 129, 0.8)', // Emerald
                    'rgba(59, 130, 246, 0.8)', // Blue
                    'rgba(245, 158, 11, 0.8)', // Amber
                    'rgba(239, 68, 68, 0.8)'   // Red
                ],
                borderColor: [
                    '#059669', '#2563eb', '#d97706', '#dc2626'
                ],
                borderWidth: 2,
                borderRadius: 12,
                barThickness: 50,
                hoverBackgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleFont: { size: 12, weight: 'bold' },
                    bodyFont: { size: 14 },
                    padding: 12,
                    cornerRadius: 10,
                    displayColors: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.05)', drawBorder: false },
                    ticks: { stepSize: 1, font: { weight: 'bold', size: 10 } }
                },
                x: {
                    grid: { display: false },
                    ticks: { font: { weight: 'black', size: 9 } }
                }
            }
        }
    });
}

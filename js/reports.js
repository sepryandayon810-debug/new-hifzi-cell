const reportsModule = {
    currentRange: 'today',
    salesChart: null,
    isChartVisible: false,
    
    init() {
        this.renderHTML();
        this.generateReport();
    },
    
    renderHTML() {
        document.getElementById('mainContent').innerHTML = `
            <div class="content-section active" id="reportsSection">
                <div class="profit-card">
                    <div class="profit-label">Laba Bersih Hari Ini</div>
                    <div class="profit-amount" id="todayProfit">Rp 0</div>
                    <div class="profit-details">
                        <div class="profit-item">
                            <span>📊</span>
                            <span>Total Transaksi: <b id="totalTransactionCount">0</b></span>
                        </div>
                        <div class="profit-item">
                            <span>📈</span>
                            <span>Margin: <b id="profitMargin">0%</b></span>
                        </div>
                        <div class="profit-item">
                            <span>🛒</span>
                            <span>Transaksi: <b id="transactionCount">0</b></span>
                        </div>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <span class="card-title">Laporan Keuangan</span>
                    </div>
                    
                    <div class="report-filters">
                        <button class="filter-btn active" onclick="reportsModule.setRange('today')">Hari Ini</button>
                        <button class="filter-btn" onclick="reportsModule.setRange('yesterday')">Kemarin</button>
                        <button class="filter-btn" onclick="reportsModule.setRange('week')">Minggu Ini</button>
                        <button class="filter-btn" onclick="reportsModule.setRange('month')">Bulan Ini</button>
                        <button class="filter-btn" onclick="reportsModule.setRange('year')">Tahun Ini</button>
                        <button class="filter-btn" onclick="reportsModule.setRange('custom')">Kustom</button>
                    </div>

                    <div class="date-range" id="customRange" style="display: none;">
                        <input type="date" class="date-input" id="startDate">
                        <span>s/d</span>
                        <input type="date" class="date-input" id="endDate">
                        <button class="btn-sm btn-primary-sm" onclick="reportsModule.generateReport()">Tampilkan</button>
                    </div>

                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-icon sales">💰</div>
                            <div class="stat-label">Total Penjualan</div>
                            <div class="stat-value" id="reportSales">Rp 0</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon profit">📈</div>
                            <div class="stat-label">Total Laba</div>
                            <div class="stat-value" id="reportProfit">Rp 0</div>
                        </div>
                    </div>
                </div>

                <!-- Grafik Section dengan Toggle Collapsible -->
                <div class="card chart-card">
                    <div class="chart-header" onclick="reportsModule.toggleChart()">
                        <div class="chart-header-left">
                            <span class="chart-icon">📊</span>
                            <span class="chart-title-text">Grafik Tren</span>
                        </div>
                        <div class="chart-toggle-wrapper">
                            <span class="chart-toggle-text" id="chartToggleText">Tampilkan</span>
                            <div class="chart-arrow" id="chartArrow">▼</div>
                        </div>
                    </div>
                    
                    <div class="chart-content" id="chartContent" style="display: none;">
                        <div class="chart-type-toggle">
                            <button class="type-btn active" onclick="event.stopPropagation(); reportsModule.toggleChartType('bar')">📊 Bar</button>
                            <button class="type-btn" onclick="event.stopPropagation(); reportsModule.toggleChartType('line')">📈 Line</button>
                        </div>
                        <div class="chart-container">
                            <canvas id="salesChart"></canvas>
                        </div>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <span class="card-title">Detail Transaksi</span>
                        <button class="btn-sm btn-primary-sm" onclick="reportsModule.exportCSV()">📥 Export CSV</button>
                    </div>
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Waktu</th>
                                    <th>Produk</th>
                                    <th>Qty</th>
                                    <th>Total</th>
                                    <th>Laba</th>
                                </tr>
                            </thead>
                            <tbody id="reportTableBody"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        
        // Load Chart.js jika belum ada
        if (!window.Chart) {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
            script.onload = () => this.generateReport();
            document.head.appendChild(script);
        }
        
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('startDate').value = today;
        document.getElementById('endDate').value = today;
    },
    
    // Toggle chart visibility dengan animasi
    toggleChart() {
        this.isChartVisible = !this.isChartVisible;
        const content = document.getElementById('chartContent');
        const arrow = document.getElementById('chartArrow');
        const text = document.getElementById('chartToggleText');
        
        if (this.isChartVisible) {
            // Buka grafik
            content.style.display = 'block';
            // Trigger reflow untuk animasi
            void content.offsetHeight;
            content.classList.add('show');
            arrow.style.transform = 'rotate(180deg)';
            text.textContent = 'Sembunyikan';
            
            // Render chart jika belum ada
            setTimeout(() => {
                if (!this.salesChart) {
                    this.generateReport();
                }
            }, 100);
        } else {
            // Tutup grafik
            content.classList.remove('show');
            arrow.style.transform = 'rotate(0deg)';
            text.textContent = 'Tampilkan';
            
            setTimeout(() => {
                content.style.display = 'none';
            }, 300);
        }
    },
    
    setRange(range) {
        this.currentRange = range;
        
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        event.target.classList.add('active');
        
        document.getElementById('customRange').style.display = range === 'custom' ? 'flex' : 'none';
        
        if (range !== 'custom') {
            this.generateReport();
        }
    },
    
    toggleChartType(type) {
        document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
        event.target.classList.add('active');
        
        if (this.salesChart) {
            this.salesChart.config.type = type;
            this.salesChart.update();
        }
    },
    
    generateReport() {
        let startDate, endDate;
        const now = new Date();
        
        switch(this.currentRange) {
            case 'today':
                startDate = new Date(now.setHours(0,0,0,0));
                endDate = new Date();
                break;
            case 'yesterday':
                const yesterday = new Date(now);
                yesterday.setDate(yesterday.getDate() - 1);
                startDate = new Date(yesterday.setHours(0,0,0,0));
                endDate = new Date(yesterday.setHours(23,59,59,999));
                break;
            case 'week':
                startDate = new Date();
                startDate.setDate(startDate.getDate() - 7);
                endDate = new Date();
                break;
            case 'month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = new Date();
                break;
            case 'year':
                startDate = new Date(now.getFullYear(), 0, 1);
                endDate = new Date();
                break;
            case 'custom':
                startDate = new Date(document.getElementById('startDate').value);
                endDate = new Date(document.getElementById('endDate').value);
                endDate.setHours(23,59,59,999);
                break;
        }
        
        const transactions = dataManager.data.transactions.filter(t => {
            const tDate = new Date(t.date);
            return tDate >= startDate && tDate <= endDate && t.status !== 'deleted';
        });
        
        const totalSales = transactions.reduce((sum, t) => sum + t.total, 0);
        const totalProfit = transactions.reduce((sum, t) => sum + t.profit, 0);
        const count = transactions.length;
        
        document.getElementById('reportSales').textContent = 'Rp ' + utils.formatNumber(totalSales);
        document.getElementById('reportProfit').textContent = 'Rp ' + utils.formatNumber(totalProfit);
        
        // Update profit card hanya untuk hari ini
        if (this.currentRange === 'today') {
            document.getElementById('todayProfit').textContent = 'Rp ' + utils.formatNumber(totalProfit);
            document.getElementById('transactionCount').textContent = count;
            document.getElementById('totalTransactionCount').textContent = count;
            const margin = totalSales > 0 ? ((totalProfit / totalSales) * 100).toFixed(1) : 0;
            document.getElementById('profitMargin').textContent = margin + '%';
        }
        
        // Render chart hanya jika visible
        if (this.isChartVisible) {
            this.renderChart(transactions, startDate, endDate);
        }
        
        // Render Table
        const tbody = document.getElementById('reportTableBody');
        tbody.innerHTML = '';
        
        transactions.slice().reverse().forEach(t => {
            t.items.forEach(item => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${new Date(t.date).toLocaleTimeString('id-ID')}</td>
                    <td>${item.name}</td>
                    <td>${item.qty}</td>
                    <td>Rp ${utils.formatNumber(item.price * item.qty)}</td>
                    <td>Rp ${utils.formatNumber((item.price - item.cost) * item.qty)}</td>
                `;
                tbody.appendChild(row);
            });
        });
    },
    
    renderChart(transactions, startDate, endDate) {
        if (!window.Chart) return;
        
        const ctx = document.getElementById('salesChart').getContext('2d');
        
        let labels = [];
        let salesData = [];
        let profitData = [];
        
        const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
        
        // Khusus untuk kemarin, tampilkan per jam
        if (this.currentRange === 'yesterday') {
            for (let i = 0; i < 24; i += 2) {
                labels.push(`${i}:00`);
                const hourStart = new Date(startDate);
                hourStart.setHours(i, 0, 0, 0);
                const hourEnd = new Date(startDate);
                hourEnd.setHours(i + 2, 0, 0, 0);
                
                const hourTrans = transactions.filter(t => {
                    const tDate = new Date(t.date);
                    return tDate >= hourStart && tDate < hourEnd;
                });
                
                salesData.push(hourTrans.reduce((sum, t) => sum + t.total, 0));
                profitData.push(hourTrans.reduce((sum, t) => sum + t.profit, 0));
            }
        } else if (this.currentRange === 'today') {
            for (let i = 0; i < 24; i += 2) {
                labels.push(`${i}:00`);
                const hourStart = new Date(startDate);
                hourStart.setHours(i, 0, 0, 0);
                const hourEnd = new Date(startDate);
                hourEnd.setHours(i + 2, 0, 0, 0);
                
                const hourTrans = transactions.filter(t => {
                    const tDate = new Date(t.date);
                    return tDate >= hourStart && tDate < hourEnd;
                });
                
                salesData.push(hourTrans.reduce((sum, t) => sum + t.total, 0));
                profitData.push(hourTrans.reduce((sum, t) => sum + t.profit, 0));
            }
        } else if (daysDiff <= 7) {
            for (let i = 0; i <= daysDiff; i++) {
                const d = new Date(startDate);
                d.setDate(d.getDate() + i);
                labels.push(d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' }));
                
                const dayStart = new Date(d.setHours(0,0,0,0));
                const dayEnd = new Date(d.setHours(23,59,59,999));
                
                const dayTrans = transactions.filter(t => {
                    const tDate = new Date(t.date);
                    return tDate >= dayStart && tDate <= dayEnd;
                });
                
                salesData.push(dayTrans.reduce((sum, t) => sum + t.total, 0));
                profitData.push(dayTrans.reduce((sum, t) => sum + t.profit, 0));
            }
        } else if (this.currentRange === 'year' || daysDiff > 31) {
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
            const startMonth = startDate.getMonth();
            const endMonth = endDate.getMonth();
            const startYear = startDate.getFullYear();
            
            for (let i = startMonth; i <= endMonth; i++) {
                labels.push(months[i]);
                
                const monthStart = new Date(startYear, i, 1);
                const monthEnd = new Date(startYear, i + 1, 0, 23, 59, 59);
                
                const monthTrans = transactions.filter(t => {
                    const tDate = new Date(t.date);
                    return tDate >= monthStart && tDate <= monthEnd;
                });
                
                salesData.push(monthTrans.reduce((sum, t) => sum + t.total, 0));
                profitData.push(monthTrans.reduce((sum, t) => sum + t.profit, 0));
            }
        } else {
            const daysInMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0).getDate();
            for (let i = 1; i <= daysInMonth; i += 2) {
                labels.push(i.toString());
                
                const dayStart = new Date(startDate.getFullYear(), startDate.getMonth(), i, 0, 0, 0);
                const dayEnd = new Date(startDate.getFullYear(), startDate.getMonth(), i + 1, 23, 59, 59);
                
                const dayTrans = transactions.filter(t => {
                    const tDate = new Date(t.date);
                    return tDate >= dayStart && tDate <= dayEnd;
                });
                
                salesData.push(dayTrans.reduce((sum, t) => sum + t.total, 0));
                profitData.push(dayTrans.reduce((sum, t) => sum + t.profit, 0));
            }
        }
        
        if (this.salesChart) {
            this.salesChart.destroy();
        }
        
        this.salesChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Penjualan',
                        data: salesData,
                        backgroundColor: 'rgba(102, 126, 234, 0.8)',
                        borderColor: 'rgba(102, 126, 234, 1)',
                        borderWidth: 2,
                        borderRadius: 6,
                        tension: 0.4
                    },
                    {
                        label: 'Laba',
                        data: profitData,
                        backgroundColor: 'rgba(118, 75, 162, 0.8)',
                        borderColor: 'rgba(118, 75, 162, 1)',
                        borderWidth: 2,
                        borderRadius: 6,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 20,
                            font: { size: 12 }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': Rp ' + utils.formatNumber(context.raw);
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                if (value >= 1000000) return 'Rp ' + (value/1000000).toFixed(1) + 'jt';
                                if (value >= 1000) return 'Rp ' + (value/1000).toFixed(0) + 'k';
                                return 'Rp ' + value;
                            }
                        },
                        grid: {
                            color: 'rgba(0,0,0,0.05)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    },
    
    exportCSV() {
        let csv = 'Waktu,Produk,Qty,Total,Laba\n';
        
        const rows = document.getElementById('reportTableBody').querySelectorAll('tr');
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            const data = Array.from(cells).map(c => c.textContent.replace(/Rp /g, '').replace(/,/g, '')).join(',');
            csv += data + '\n';
        });
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `laporan-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        
        app.showToast('Laporan diexport!');
    }
};

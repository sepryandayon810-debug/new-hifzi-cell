const reportsModule = {
    currentRange: 'today',
    
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
                        <button class="filter-btn" onclick="reportsModule.setRange('week')">Minggu Ini</button>
                        <button class="filter-btn" onclick="reportsModule.setRange('month')">Bulan Ini</button>
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
        
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('startDate').value = today;
        document.getElementById('endDate').value = today;
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
    
    generateReport() {
        let startDate, endDate;
        const now = new Date();
        
        switch(this.currentRange) {
            case 'today':
                startDate = new Date(now.setHours(0,0,0,0));
                endDate = new Date();
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
        
        if (this.currentRange === 'today') {
            document.getElementById('todayProfit').textContent = 'Rp ' + utils.formatNumber(totalProfit);
            document.getElementById('transactionCount').textContent = count;
            const margin = totalSales > 0 ? ((totalProfit / totalSales) * 100).toFixed(1) : 0;
            document.getElementById('profitMargin').textContent = margin + '%';
        }
        
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

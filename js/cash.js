const cashModule = {
    currentDeleteTransaction: null,
    
    // Filter state
    filterState: {
        startDate: null,
        endDate: null,
        preset: 'today' // today, yesterday, week, month, year, custom
    },
    
    init() {
        this.ensureCashInitialized();
        this.checkDayChange();
        this.renderHTML();
        this.updateStats();
        this.renderTransactions();
    },

    checkDayChange() {
        const lastActiveDate = localStorage.getItem('hifzi_last_active_date');
        const today = new Date().toDateString();
        
        if (lastActiveDate && lastActiveDate !== today) {
            console.log('[Cash] Day changed detected. Last:', lastActiveDate, 'Today:', today);
            
            const isKasirOpen = dataManager.data.settings?.kasirOpen || false;
            
            if (!isKasirOpen) {
                const modalAwal = parseInt(dataManager.data.settings?.modalAwal) || 0;
                
                if (confirm(`🌅 Selamat datang di hari baru!\n\nKas kemarin: Rp ${utils.formatNumber(dataManager.data.settings.currentCash)}\n\nKasir dalam keadaan TUTUP.\n\nSetel kas ke Rp ${utils.formatNumber(modalAwal)} (Modal Awal) atau Rp 0?`)) {
                    dataManager.data.settings.currentCash = modalAwal;
                } else {
                    dataManager.data.settings.currentCash = 0;
                }
                
                dataManager.data.settings.modalAwal = 0;
                this.saveDayClosing(lastActiveDate);
                dataManager.save();
                app.showToast('✅ Kas direset untuk hari baru');
            }
        }
        
        localStorage.setItem('hifzi_last_active_date', today);
    },

    saveDayClosing(dateStr) {
        if (!dataManager.data.dailyClosing) {
            dataManager.data.dailyClosing = [];
        }
        
        const closingData = {
            date: dateStr,
            closingCash: dataManager.data.settings.currentCash,
            modalAwal: dataManager.data.settings.modalAwal,
            timestamp: new Date().toISOString()
        };
        
        dataManager.data.dailyClosing.push(closingData);
        
        if (dataManager.data.dailyClosing.length > 30) {
            dataManager.data.dailyClosing = dataManager.data.dailyClosing.slice(-30);
        }
    },

    ensureCashInitialized() {
        if (typeof dataManager !== 'undefined' && dataManager.data && dataManager.data.settings) {
            let currentCash = dataManager.data.settings.currentCash;
            
            if (typeof currentCash !== 'number' || isNaN(currentCash)) {
                console.log('[Cash] Initializing currentCash from invalid value:', currentCash);
                currentCash = this.calculateCashFromTransactions();
                dataManager.data.settings.currentCash = currentCash;
                dataManager.save();
                console.log('[Cash] currentCash initialized to:', currentCash);
            }
            
            if (typeof dataManager.data.settings.modalAwal !== 'number' || isNaN(dataManager.data.settings.modalAwal)) {
                dataManager.data.settings.modalAwal = 0;
            }
        }
    },

    calculateCashFromTransactions() {
        let cash = 0;
        
        if (typeof dataManager !== 'undefined' && dataManager.data) {
            if (dataManager.data.cashTransactions && Array.isArray(dataManager.data.cashTransactions)) {
                dataManager.data.cashTransactions.forEach(t => {
                    const amount = parseInt(t.amount) || 0;
                    if (t.type === 'in' || t.type === 'modal_in' || t.type === 'topup') {
                        cash += amount;
                    } else if (t.type === 'out') {
                        cash -= amount;
                    }
                });
            }
            
            if (dataManager.data.transactions && Array.isArray(dataManager.data.transactions)) {
                dataManager.data.transactions.forEach(t => {
                    if (t.status !== 'deleted' && t.status !== 'voided') {
                        if (t.paymentMethod === 'cash') {
                            cash += parseInt(t.total) || 0;
                        }
                    }
                });
            }
        }
        
        return cash;
    },
    
    renderHTML() {
        const today = new Date().toLocaleDateString('id-ID', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        });
        
        // ⬅️ PERBARUI: Label dinamis berdasarkan filter
        const periodLabel = this.getFilterLabel();
        
        document.getElementById('mainContent').innerHTML = `
            <div class="content-section active" id="cashSection">
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon sales">💵</div>
                        <div class="stat-label" id="incomeLabel">Pemasukan ${periodLabel}</div>
                        <div class="stat-value" id="todayIncome">Rp 0</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon expense">💸</div>
                        <div class="stat-label" id="expenseLabel">Pengeluaran ${periodLabel}</div>
                        <div class="stat-value" id="todayExpense">Rp 0</div>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <span class="card-title">Manajemen Kas</span>
                        <div style="font-size: 12px; color: #999;">${today}</div>
                    </div>
                    
                    <div class="cash-actions">
                        <button class="cash-btn in" onclick="cashModule.openModal('in')">
                            <span style="font-size: 24px;">⬇️</span>
                            <span>Kas Masuk</span>
                        </button>
                        <button class="cash-btn out" onclick="cashModule.openModal('out')">
                            <span style="font-size: 24px;">⬆️</span>
                            <span>Kas Keluar</span>
                        </button>
                        <button class="cash-btn tarik-tunai" onclick="cashModule.openTarikTunai()">
                            <span style="font-size: 24px;">🏧</span>
                            <span>Tarik Tunai</span>
                        </button>
                        <button class="cash-btn topup" onclick="cashModule.openTopUp()">
                            <span style="font-size: 24px;">💜</span>
                            <span>Top Up</span>
                        </button>
                        <button class="cash-btn modal-awal" onclick="cashModule.openModalAwal()">
                            <span style="font-size: 24px;">💰</span>
                            <span>Modal Awal</span>
                        </button>
                        <button class="cash-btn history" onclick="cashModule.openHistory()">
                            <span style="font-size: 24px;">📋</span>
                            <span>Riwayat</span>
                        </button>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header" style="flex-wrap: wrap; gap: 10px;">
                        <span class="card-title">Riwayat Transaksi Kas</span>
                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            <select id="filterPreset" onchange="cashModule.applyFilter()" 
                                    style="padding: 6px 12px; border-radius: 8px; border: 1px solid #ddd; font-size: 13px;">
                                <option value="today">📅 Hari Ini</option>
                                <option value="yesterday">📅 Kemarin</option>
                                <option value="week">📆 Minggu Ini</option>
                                <option value="month">🗓️ Bulan Ini</option>
                                <option value="year">📊 Tahun Ini</option>
                                <option value="custom">🔍 Custom...</option>
                            </select>
                            <div id="customDateRange" style="display: none; gap: 8px; align-items: center;">
                                <input type="date" id="filterStartDate" onchange="cashModule.applyFilter()" 
                                       style="padding: 6px; border-radius: 6px; border: 1px solid #ddd; font-size: 12px;">
                                <span>s/d</span>
                                <input type="date" id="filterEndDate" onchange="cashModule.applyFilter()" 
                                       style="padding: 6px; border-radius: 6px; border: 1px solid #ddd; font-size: 12px;">
                            </div>
                            <button class="btn btn-sm btn-secondary" onclick="cashModule.recalculateCash()" 
                                    style="font-size: 12px; padding: 6px 12px;">
                                🔄 Recalculate
                            </button>
                        </div>
                    </div>
                    <div class="transaction-list" id="cashTransactionList"></div>
                    <div id="filterSummary" style="padding: 15px; background: #f5f5f5; border-radius: 8px; margin-top: 10px; font-size: 13px;">
                        <!-- Summary will be inserted here -->
                    </div>
                </div>
            </div>
        `;
        
        // Set default dates for custom filter
        const todayStr = new Date().toISOString().split('T')[0];
        const startDateInput = document.getElementById('filterStartDate');
        const endDateInput = document.getElementById('filterEndDate');
        if (startDateInput) startDateInput.value = todayStr;
        if (endDateInput) endDateInput.value = todayStr;
        
        // ⬅️ TAMBAH: Set filter dropdown ke nilai yang tersimpan
        const filterSelect = document.getElementById('filterPreset');
        if (filterSelect) filterSelect.value = this.filterState.preset;
    },
    
    applyFilter() {
        const preset = document.getElementById('filterPreset').value;
        const customRange = document.getElementById('customDateRange');
        
        if (preset === 'custom') {
            customRange.style.display = 'flex';
        } else {
            customRange.style.display = 'none';
        }
        
        this.filterState.preset = preset;
        
        // ⬅️ TAMBAH: Update label stat card saat filter berubah
        this.updateStatLabels();
        this.updateStats();
        this.renderTransactions();
    },
    
    // ⬅️ TAMBAH: Method baru untuk update label stat card
    updateStatLabels() {
        const periodLabel = this.getFilterLabel();
        const incomeLabel = document.getElementById('incomeLabel');
        const expenseLabel = document.getElementById('expenseLabel');
        
        if (incomeLabel) incomeLabel.textContent = `Pemasukan ${periodLabel}`;
        if (expenseLabel) expenseLabel.textContent = `Pengeluaran ${periodLabel}`;
    },
    
    getDateRange() {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let startDate, endDate;
        
        switch (this.filterState.preset) {
            case 'today':
                startDate = new Date(today);
                endDate = new Date(today);
                endDate.setHours(23, 59, 59, 999);
                break;
                
            case 'yesterday':
                startDate = new Date(today);
                startDate.setDate(startDate.getDate() - 1);
                endDate = new Date(startDate);
                endDate.setHours(23, 59, 59, 999);
                break;
                
            case 'week':
                const dayOfWeek = today.getDay();
                const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
                startDate = new Date(today.setDate(diff));
                endDate = new Date();
                endDate.setHours(23, 59, 59, 999);
                break;
                
            case 'month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                endDate.setHours(23, 59, 59, 999);
                break;
                
            case 'year':
                startDate = new Date(now.getFullYear(), 0, 1);
                endDate = new Date(now.getFullYear(), 11, 31);
                endDate.setHours(23, 59, 59, 999);
                break;
                
            case 'custom':
                const startInput = document.getElementById('filterStartDate').value;
                const endInput = document.getElementById('filterEndDate').value;
                if (startInput && endInput) {
                    startDate = new Date(startInput);
                    endDate = new Date(endInput);
                    endDate.setHours(23, 59, 59, 999);
                } else {
                    startDate = today;
                    endDate = new Date(today);
                    endDate.setHours(23, 59, 59, 999);
                }
                break;
                
            default:
                startDate = today;
                endDate = new Date(today);
                endDate.setHours(23, 59, 59, 999);
        }
        
        return { startDate, endDate };
    },
    
    updateStats() {
        const { startDate, endDate } = this.getDateRange();
        
        const transactions = dataManager.data.cashTransactions.filter(t => {
            const tDate = new Date(t.date);
            return tDate >= startDate && tDate <= endDate;
        });
        
        const income = transactions
            .filter(t => t.type === 'in' || t.type === 'modal_in' || t.type === 'topup')
            .reduce((sum, t) => sum + (parseInt(t.amount) || 0), 0);
        
        const expense = transactions
            .filter(t => t.type === 'out')
            .reduce((sum, t) => sum + (parseInt(t.amount) || 0), 0);
        
        const incomeEl = document.getElementById('todayIncome');
        const expenseEl = document.getElementById('todayExpense');
        
        if (incomeEl) incomeEl.textContent = 'Rp ' + utils.formatNumber(income);
        if (expenseEl) expenseEl.textContent = 'Rp ' + utils.formatNumber(expense);
    },
    
    renderTransactions() {
        const container = document.getElementById('cashTransactionList');
        if (!container) return;
        
        const { startDate, endDate } = this.getDateRange();
        
        let transactions = dataManager.data.cashTransactions.filter(t => {
            const tDate = new Date(t.date);
            return tDate >= startDate && tDate <= endDate;
        }).sort((a, b) => new Date(b.date) - new Date(a.date));
        
        const totalIncome = transactions
            .filter(t => t.type === 'in' || t.type === 'modal_in' || t.type === 'topup')
            .reduce((sum, t) => sum + (parseInt(t.amount) || 0), 0);
            
        const totalExpense = transactions
            .filter(t => t.type === 'out')
            .reduce((sum, t) => sum + (parseInt(t.amount) || 0), 0);
        
        const net = totalIncome - totalExpense;
        
        const summaryEl = document.getElementById('filterSummary');
        if (summaryEl) {
            const dateRangeText = this.getFilterLabel();
            summaryEl.innerHTML = `
                <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                    <div>
                        <strong>${dateRangeText}</strong><br>
                        <small>${transactions.length} transaksi</small>
                    </div>
                    <div style="text-align: right;">
                        <div style="color: #4caf50;">⬇️ Masuk: Rp ${utils.formatNumber(totalIncome)}</div>
                        <div style="color: #f44336;">⬆️ Keluar: Rp ${utils.formatNumber(totalExpense)}</div>
                        <div style="font-weight: bold; margin-top: 4px; color: ${net >= 0 ? '#4caf50' : '#f44336'};">
                            Net: Rp ${utils.formatNumber(net)}
                        </div>
                    </div>
                </div>
            `;
        }
        
        if (transactions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📋</div>
                    <p>Belum ada transaksi ${this.getFilterLabel().toLowerCase()}</p>
                </div>
            `;
            return;
        }
        
        const grouped = this.groupByDate(transactions);
        
        let html = '';
        Object.keys(grouped).forEach(dateKey => {
            const dayTrans = grouped[dateKey];
            const dayTotal = dayTrans.reduce((sum, t) => {
                const amt = parseInt(t.amount) || 0;
                return t.type === 'in' || t.type === 'modal_in' || t.type === 'topup' ? sum + amt : sum - amt;
            }, 0);
            
            html += `
                <div style="background: #f8f9fa; padding: 8px 12px; margin: 10px 0 5px 0; border-radius: 6px; font-weight: 600; font-size: 13px; color: #666; display: flex; justify-content: space-between;">
                    <span>${dateKey}</span>
                    <span style="color: ${dayTotal >= 0 ? '#4caf50' : '#f44336'};">
                        ${dayTotal >= 0 ? '+' : ''}Rp ${utils.formatNumber(Math.abs(dayTotal))}
                    </span>
                </div>
            `;
            
            dayTrans.forEach(t => {
                const isIncome = t.type === 'in' || t.type === 'modal_in' || t.type === 'topup';
                const prefix = isIncome ? '+' : '-';
                const amountClass = isIncome ? 'income' : 'expense';
                
                let typeLabel = '';
                if (t.type === 'modal_in') typeLabel = ' (Modal)';
                else if (t.type === 'topup') typeLabel = ' (Top Up)';
                else if (t.category === 'tarik_tunai') typeLabel = ' (Tarik Tunai)';
                
                const timeStr = new Date(t.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                
                html += `
                    <div class="transaction-item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid #eee;">
                        <div class="transaction-info" style="flex: 1;">
                            <div class="transaction-title" style="font-weight: 500; margin-bottom: 4px;">${t.note || t.category}${typeLabel}</div>
                            <div class="transaction-meta" style="font-size: 12px; color: #999;">${timeStr}</div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div class="transaction-amount ${amountClass}" style="font-weight: 600; ${isIncome ? 'color: #4caf50;' : 'color: #f44336;'}">
                                ${prefix} Rp ${utils.formatNumber(t.amount)}
                            </div>
                            <button class="btn-delete-cash" data-transaction-id="${t.id}" 
                                    style="width: 32px; height: 32px; border-radius: 50%; background: #ffebee; 
                                           border: 2px solid #f44336; color: #f44336; font-size: 14px; cursor: pointer; 
                                           display: flex; align-items: center; justify-content: center;
                                           transition: all 0.2s;"
                                    title="Hapus transaksi">🗑️</button>
                        </div>
                    </div>
                `;
            });
        });
        
        container.innerHTML = html;
        this.attachDeleteListeners();
    },
    
    groupByDate(transactions) {
        const grouped = {};
        
        transactions.forEach(t => {
            const date = new Date(t.date);
            const dateKey = date.toLocaleDateString('id-ID', { 
                weekday: 'short', 
                day: 'numeric', 
                month: 'short',
                year: 'numeric'
            });
            
            if (!grouped[dateKey]) {
                grouped[dateKey] = [];
            }
            grouped[dateKey].push(t);
        });
        
        return grouped;
    },
    
    getFilterLabel() {
        const labels = {
            'today': 'Hari Ini',
            'yesterday': 'Kemarin',
            'week': 'Minggu Ini',
            'month': 'Bulan Ini',
            'year': 'Tahun Ini',
            'custom': 'Custom'
        };
        return labels[this.filterState.preset] || 'Hari Ini';
    },
    
    attachDeleteListeners() {
        const deleteButtons = document.querySelectorAll('.btn-delete-cash');
        console.log('Found delete buttons:', deleteButtons.length);
        
        deleteButtons.forEach(btn => {
            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const transactionId = parseInt(btn.getAttribute('data-transaction-id'));
                console.log('Deleting transaction ID:', transactionId);
                this.deleteTransaction(transactionId);
            };
        });
    },
    
    deleteTransaction(transactionId) {
        const t = dataManager.data.cashTransactions.find(tr => {
            return tr.id === transactionId || tr.id === transactionId.toString();
        });
        
        if (!t) {
            console.error('Transaction not found. ID:', transactionId);
            app.showToast('Transaksi tidak ditemukan!');
            return;
        }
        
        const confirmMsg = `Hapus transaksi "${t.note || t.category}"?\n\nRp ${utils.formatNumber(t.amount)}\n\nKas akan disesuaikan.`;
        
        if (!confirm(confirmMsg)) {
            return;
        }
        
        let currentCash = parseInt(dataManager.data.settings.currentCash) || 0;
        
        if (t.type === 'in' || t.type === 'modal_in' || t.type === 'topup') {
            currentCash -= parseInt(t.amount) || 0;
        } else {
            currentCash += parseInt(t.amount) || 0;
        }
        
        dataManager.data.settings.currentCash = currentCash;
        
        dataManager.data.cashTransactions = dataManager.data.cashTransactions.filter(
            tr => tr.id !== transactionId && tr.id !== transactionId.toString()
        );
        
        if (t.details && t.details.adminFee > 0) {
            dataManager.data.transactions = dataManager.data.transactions.filter(tr => {
                if (tr.type === 'topup_fee' || tr.type === 'tarik_tunai_fee') {
                    const trTime = new Date(tr.date).getTime();
                    const cashTime = new Date(t.date).getTime();
                    return Math.abs(trTime - cashTime) > 2000;
                }
                return true;
            });
        }
        
        dataManager.save();
        app.updateHeader();
        this.updateStats();
        this.renderTransactions();
        app.showToast('Transaksi dihapus! Kas disesuaikan.');
    },
    
    openModal(type) {
        const isIn = type === 'in';
        
        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal active" id="cashModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <span class="modal-title">${isIn ? 'Kas Masuk' : 'Kas Keluar'}</span>
                        <button class="close-btn" onclick="cashModule.closeModal('cashModal')">×</button>
                    </div>
                    
                    <div class="form-group">
                        <label>Jumlah (Rp)</label>
                        <input type="number" id="cashAmount" placeholder="0">
                    </div>
                    
                    <div class="form-group">
                        <label>Kategori</label>
                        <select id="cashCategory">
                            ${isIn ? `
                                <option value="penjualan">Penjualan</option>
                                <option value="lainnya">Lainnya</option>
                            ` : `
                                <option value="operasional">Biaya Operasional</option>
                                <option value="gaji">Gaji Karyawan</option>
                                <option value="lainnya">Lainnya</option>
                            `}
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label>Keterangan</label>
                        <textarea id="cashNote" rows="3" placeholder="Catatan..."></textarea>
                    </div>
                    
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="cashModule.closeModal('cashModal')">Batal</button>
                        <button class="btn btn-primary" onclick="cashModule.saveTransaction('${type}')">Simpan</button>
                    </div>
                </div>
            </div>
        `);
    },
    
    saveTransaction(type) {
        const amount = parseInt(document.getElementById('cashAmount').value) || 0;
        const category = document.getElementById('cashCategory').value;
        const note = document.getElementById('cashNote').value;
        
        if (amount <= 0) {
            app.showToast('Jumlah tidak valid!');
            return;
        }
        
        let currentCash = parseInt(dataManager.data.settings.currentCash) || 0;
        
        if (type === 'out' && amount > currentCash) {
            app.showToast('Kas tidak mencukupi!');
            return;
        }
        
        dataManager.data.cashTransactions.push({
            id: Date.now(),
            date: new Date().toISOString(),
            type: type,
            amount: amount,
            category: category,
            note: note
        });
        
        if (type === 'in') {
            dataManager.data.settings.currentCash = currentCash + amount;
        } else {
            dataManager.data.settings.currentCash = currentCash - amount;
        }
        
        dataManager.save();
        app.updateHeader();
        this.closeModal('cashModal');
        this.updateStats();
        this.renderTransactions();
        app.showToast('Transaksi kas tersimpan!');
    },
    
    openModalAwal() {
        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal active" id="modalAwalModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <span class="modal-title">💰 Input Modal Awal</span>
                        <button class="close-btn" onclick="cashModule.closeModal('modalAwalModal')">×</button>
                    </div>
                    
                    <div class="info-box warning">
                        <div class="info-title">📌 Modal Awal Shift</div>
                        <div class="info-text">
                            Modal akan ditambahkan ke Kas di Tangan untuk memulai shift baru.
                        </div>
                    </div>

                    <div class="form-group">
                        <label>Jumlah Modal (Rp)</label>
                        <input type="number" id="modalAwalAmount" placeholder="Contoh: 500000">
                    </div>
                    
                    <div class="form-group">
                        <label>Keterangan</label>
                        <textarea id="modalAwalNote" rows="2"></textarea>
                    </div>
                    
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="cashModule.closeModal('modalAwalModal')">Batal</button>
                        <button class="btn btn-warning" onclick="cashModule.saveModalAwal()">Simpan Modal</button>
                    </div>
                </div>
            </div>
        `);
    },
    
    saveModalAwal() {
        const amount = parseInt(document.getElementById('modalAwalAmount').value) || 0;
        const note = document.getElementById('modalAwalNote').value || 'Modal Awal Shift';
        
        if (amount <= 0) {
            app.showToast('Jumlah modal harus lebih dari 0!');
            return;
        }
        
        let currentCash = parseInt(dataManager.data.settings.currentCash) || 0;
        
        dataManager.data.settings.modalAwal = amount;
        dataManager.data.settings.currentCash = currentCash + amount;
        
        dataManager.data.cashTransactions.push({
            id: Date.now(),
            date: new Date().toISOString(),
            type: 'modal_in',
            amount: amount,
            category: 'modal_awal',
            note: note
        });
        
        dataManager.save();
        app.updateHeader();
        this.closeModal('modalAwalModal');
        this.updateStats();
        this.renderTransactions();
        app.showToast(`Modal Rp ${utils.formatNumber(amount)} tersimpan! Kas sekarang: Rp ${utils.formatNumber(dataManager.data.settings.currentCash)}`);
    },
    
    openTopUp() {
        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal active" id="topUpModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <span class="modal-title">💜 Top Up</span>
                        <button class="close-btn" onclick="cashModule.closeModal('topUpModal')">×</button>
                    </div>
                    
                    <div class="info-box" style="background: #f3e5f5;">
                        <div class="info-title">Admin Fee = Laba!</div>
                        <div class="info-text">
                            Total bayar = Nominal + Admin Fee<br>
                            Admin fee masuk ke laba bersih
                        </div>
                    </div>

                    <div class="form-group">
                        <label>Jenis</label>
                        <select id="topUpType">
                            <option value="dana">DANA</option>
                            <option value="gopay">GoPay</option>
                            <option value="ovo">OVO</option>
                            <option value="shopeepay">ShopeePay</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label>Nominal (Rp)</label>
                        <input type="number" id="topUpNominal" placeholder="50000" oninput="cashModule.calcTopUp()">
                    </div>

                    <div class="form-group">
                        <label>Admin Fee (Rp)</label>
                        <input type="number" id="topUpAdmin" placeholder="1500" oninput="cashModule.calcTopUp()">
                    </div>
                    
                    <div class="calculation-box" style="background: #f3e5f5;">
                        <div class="calc-row">
                            <span>Total Bayar:</span>
                            <span id="topUpTotal">Rp 0</span>
                        </div>
                        <div class="calc-row" style="color: var(--success);">
                            <span>Laba (Admin):</span>
                            <span id="topUpProfit">Rp 0</span>
                        </div>
                    </div>
                    
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="cashModule.closeModal('topUpModal')">Batal</button>
                        <button class="btn btn-primary" onclick="cashModule.saveTopUp()" style="background: #9c27b0;">Proses</button>
                    </div>
                </div>
            </div>
        `);
    },
    
    calcTopUp() {
        const nominal = parseInt(document.getElementById('topUpNominal')?.value) || 0;
        const admin = parseInt(document.getElementById('topUpAdmin')?.value) || 0;
        
        const totalEl = document.getElementById('topUpTotal');
        const profitEl = document.getElementById('topUpProfit');
        
        if (totalEl) totalEl.textContent = 'Rp ' + utils.formatNumber(nominal + admin);
        if (profitEl) profitEl.textContent = 'Rp ' + utils.formatNumber(admin);
    },
    
    saveTopUp() {
        const nominal = parseInt(document.getElementById('topUpNominal').value) || 0;
        const admin = parseInt(document.getElementById('topUpAdmin').value) || 0;
        const type = document.getElementById('topUpType').value;
        
        if (nominal <= 0) {
            app.showToast('Nominal wajib diisi!');
            return;
        }
        
        const total = nominal + admin;
        
        let currentCash = parseInt(dataManager.data.settings.currentCash) || 0;
        dataManager.data.settings.currentCash = currentCash + total;
        
        dataManager.data.cashTransactions.push({
            id: Date.now(),
            date: new Date().toISOString(),
            type: 'topup',
            amount: total,
            category: 'topup_' + type,
            note: `Top Up ${type.toUpperCase()}`,
            details: { nominal, adminFee: admin }
        });
        
        if (admin > 0) {
            dataManager.data.transactions.push({
                id: Date.now() + 1,
                date: new Date().toISOString(),
                items: [{
                    name: `Admin Fee Top Up ${type.toUpperCase()}`,
                    price: admin,
                    cost: 0,
                    qty: 1
                }],
                total: admin,
                profit: admin,
                paymentMethod: 'cash',
                status: 'completed',
                type: 'topup_fee'
            });
        }
        
        dataManager.save();
        app.updateHeader();
        this.closeModal('topUpModal');
        this.updateStats();
        this.renderTransactions();
        app.showToast(`Top up berhasil! Laba: Rp ${utils.formatNumber(admin)}`);
    },
    
    openTarikTunai() {
        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal active" id="tarikTunaiModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <span class="modal-title">🏧 Tarik Tunai</span>
                        <button class="close-btn" onclick="cashModule.closeModal('tarikTunaiModal')">×</button>
                    </div>
                    
                    <div class="info-box" style="background: #e1f5fe;">
                        <div class="info-title">Admin Fee = Laba!</div>
                        <div class="info-text">
                            Nominal = Uang diberikan ke customer<br>
                            Admin fee = Keuntungan konter
                        </div>
                    </div>

                    <div class="form-group">
                        <label>Nominal Tarik (Rp)</label>
                        <input type="number" id="tarikNominal" placeholder="100000" oninput="cashModule.calcTarik()">
                    </div>

                    <div class="form-group">
                        <label>Admin Fee (Rp)</label>
                        <input type="number" id="tarikAdmin" placeholder="2500" oninput="cashModule.calcTarik()">
                    </div>
                    
                    <div class="calculation-box" style="background: #e1f5fe;">
                        <div class="calc-row">
                            <span>Total Keluar dari Kas:</span>
                            <span id="tarikTotal" style="color: var(--danger);">Rp 0</span>
                        </div>
                        <div class="calc-row" style="color: var(--success);">
                            <span>Laba (Admin):</span>
                            <span id="tarikProfit">Rp 0</span>
                        </div>
                    </div>
                    
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="cashModule.closeModal('tarikTunaiModal')">Batal</button>
                        <button class="btn btn-info" onclick="cashModule.saveTarikTunai()">Proses</button>
                    </div>
                </div>
            </div>
        `);
    },
    
    calcTarik() {
        const nominal = parseInt(document.getElementById('tarikNominal')?.value) || 0;
        const admin = parseInt(document.getElementById('tarikAdmin')?.value) || 0;
        
        const totalEl = document.getElementById('tarikTotal');
        const profitEl = document.getElementById('tarikProfit');
        
        if (totalEl) totalEl.textContent = 'Rp ' + utils.formatNumber(nominal + admin);
        if (profitEl) profitEl.textContent = 'Rp ' + utils.formatNumber(admin);
    },
    
    saveTarikTunai() {
        const nominal = parseInt(document.getElementById('tarikNominal').value) || 0;
        const admin = parseInt(document.getElementById('tarikAdmin').value) || 0;
        const total = nominal + admin;
        
        if (nominal <= 0) {
            app.showToast('Nominal wajib diisi!');
            return;
        }
        
        let currentCash = parseInt(dataManager.data.settings.currentCash) || 0;
        
        if (total > currentCash) {
            app.showToast('Kas tidak mencukupi!');
            return;
        }
        
        dataManager.data.settings.currentCash = currentCash - total;
        
        dataManager.data.cashTransactions.push({
            id: Date.now(),
            date: new Date().toISOString(),
            type: 'out',
            amount: total,
            category: 'tarik_tunai',
            note: 'Tarik Tunai',
            details: { nominal, adminFee: admin }
        });
        
        if (admin > 0) {
            dataManager.data.transactions.push({
                id: Date.now() + 1,
                date: new Date().toISOString(),
                items: [{
                    name: 'Admin Fee Tarik Tunai',
                    price: admin,
                    cost: 0,
                    qty: 1
                }],
                total: admin,
                profit: admin,
                paymentMethod: 'cash',
                status: 'completed',
                type: 'tarik_tunai_fee'
            });
        }
        
        dataManager.save();
        app.updateHeader();
        this.closeModal('tarikTunaiModal');
        this.updateStats();
        this.renderTransactions();
        app.showToast(`Tarik tunai berhasil! Laba: Rp ${utils.formatNumber(admin)}`);
    },
    
    openHistory() {
        this.filterState.preset = 'today';
        this.renderHTML(); // ⬅️ PERBARUI: Re-render untuk update label
        this.updateStats();
        this.renderTransactions();
        document.getElementById('cashTransactionList')?.scrollIntoView({ behavior: 'smooth' });
    },
    
    closeModal(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.remove();
        }
    },

    recalculateCash() {
        if (!confirm('🔄 Recalculate Kas?\n\nIni akan menghitung ulang kas berdasarkan semua transaksi yang tersimpan.\n\nLanjutkan?')) {
            return;
        }

        const newCash = this.calculateCashFromTransactions();
        dataManager.data.settings.currentCash = newCash;
        dataManager.save();
        
        app.updateHeader();
        this.updateStats();
        
        app.showToast(`✅ Kas direcalculate: Rp ${utils.formatNumber(newCash)}`);
    }
};

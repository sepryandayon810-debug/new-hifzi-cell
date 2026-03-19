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
        const periodLabel = this.getFilterLabel();
        const { startDate, endDate } = this.getDateRange();
        
        // ⬅️ PERBARUI: Hitung statistik untuk periode yang dipilih
        const periodStats = this.calculatePeriodStats(startDate, endDate);
        
        // ⬅️ PERBARUI: Format tanggal untuk display
        const dateRangeText = this.getDateRangeText(startDate, endDate);
        
        document.getElementById('mainContent').innerHTML = `
            <div class="content-section active" id="cashSection">
                
                <!-- CARD UNGU DIHAPUS - Karena data sudah ada di header atas -->

                <!-- Filter Periode -->
                <div style="background: white; border-radius: 12px; padding: 16px 20px; margin-bottom: 20px; 
                     box-shadow: 0 2px 8px rgba(0,0,0,0.08); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 14px; color: #666; font-weight: 600;">📅 Periode:</span>
                        <span id="periodBadge" style="background: #667eea; color: white; padding: 6px 12px; border-radius: 20px; font-size: 13px; font-weight: 600;">${periodLabel}</span>
                        <span id="dateRangeText" style="font-size: 13px; color: #999;">${dateRangeText}</span>
                    </div>
                    
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <select id="filterPreset" onchange="cashModule.applyFilter()" 
                                style="padding: 8px 16px; border-radius: 8px; border: 2px solid #e0e0e0; font-size: 14px; background: white; cursor: pointer;">
                            <option value="today">📅 Hari Ini</option>
                            <option value="yesterday">📅 Kemarin</option>
                            <option value="week">📆 Minggu Ini</option>
                            <option value="month">🗓️ Bulan Ini</option>
                            <option value="year">📊 Tahun Ini</option>
                            <option value="custom">🔍 Custom...</option>
                        </select>
                        
                        <div id="customDateRange" style="display: none; gap: 8px; align-items: center;">
                            <input type="date" id="filterStartDate" onchange="cashModule.applyFilter()" 
                                   style="padding: 8px; border-radius: 6px; border: 2px solid #e0e0e0; font-size: 13px;">
                            <span style="color: #666;">s/d</span>
                            <input type="date" id="filterEndDate" onchange="cashModule.applyFilter()" 
                                   style="padding: 8px; border-radius: 6px; border: 2px solid #e0e0e0; font-size: 13px;">
                        </div>
                    </div>
                </div>

                <!-- LABA CARD -->
                <div style="background: white; border-radius: 12px; padding: 20px; margin-bottom: 20px; 
                     box-shadow: 0 2px 8px rgba(0,0,0,0.08); border-left: 4px solid ${periodStats.net >= 0 ? '#4caf50' : '#f44336'};">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-size: 13px; color: #666; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">
                                Laba ${periodLabel}
                            </div>
                            <div style="font-size: 28px; font-weight: 700; color: ${periodStats.net >= 0 ? '#2e7d32' : '#c62828'};">
                                Rp ${utils.formatNumber(periodStats.net)}
                            </div>
                        </div>
                        <div style="width: 56px; height: 56px; background: ${periodStats.net >= 0 ? '#e8f5e9' : '#ffebee'}; 
                             border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 28px;">
                            ${periodStats.net >= 0 ? '📈' : '📉'}
                        </div>
                    </div>
                </div>

                <!-- Stat Cards Pemasukan & Pengeluaran -->
                <div class="stats-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 20px;">
                    <div style="background: white; border-radius: 10px; padding: 16px; 
                         box-shadow: 0 2px 6px rgba(0,0,0,0.06); display: flex; align-items: center; gap: 12px;">
                        <div style="width: 40px; height: 40px; background: #e8f5e9; 
                             border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 20px;">💵</div>
                        <div>
                            <div style="font-size: 11px; color: #666; margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.5px;">
                                Masuk
                            </div>
                            <div style="font-size: 18px; font-weight: 700; color: #2e7d32;">
                                Rp ${utils.formatNumber(periodStats.income)}
                            </div>
                        </div>
                    </div>
                    
                    <div style="background: white; border-radius: 10px; padding: 16px; 
                         box-shadow: 0 2px 6px rgba(0,0,0,0.06); display: flex; align-items: center; gap: 12px;">
                        <div style="width: 40px; height: 40px; background: #ffebee; 
                             border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 20px;">💸</div>
                        <div>
                            <div style="font-size: 11px; color: #666; margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.5px;">
                                Keluar
                            </div>
                            <div style="font-size: 18px; font-weight: 700; color: #c62828;">
                                Rp ${utils.formatNumber(periodStats.expense)}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Manajemen Kas -->
                <div class="card" style="background: white; border-radius: 12px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
                    <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <span class="card-title" style="font-size: 18px; font-weight: 600; color: #333;">Manajemen Kas</span>
                        <div style="font-size: 12px; color: #999;">${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                    </div>
                    
                    <div class="cash-actions" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px;">
                        <button class="cash-btn in" onclick="cashModule.openModal('in')" 
                                style="background: #e8f5e9; border: 2px solid #4caf50; color: #2e7d32; padding: 16px; border-radius: 12px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 8px; transition: all 0.2s;">
                            <span style="font-size: 28px;">⬇️</span>
                            <span style="font-size: 14px; font-weight: 600;">Kas Masuk</span>
                        </button>
                        
                        <button class="cash-btn out" onclick="cashModule.openModal('out')"
                                style="background: #ffebee; border: 2px solid #f44336; color: #c62828; padding: 16px; border-radius: 12px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 8px; transition: all 0.2s;">
                            <span style="font-size: 28px;">⬆️</span>
                            <span style="font-size: 14px; font-weight: 600;">Kas Keluar</span>
                        </button>
                        
                        <button class="cash-btn tarik-tunai" onclick="cashModule.openTarikTunai()"
                                style="background: #e3f2fd; border: 2px solid #2196f3; color: #1565c0; padding: 16px; border-radius: 12px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 8px; transition: all 0.2s;">
                            <span style="font-size: 28px;">🏧</span>
                            <span style="font-size: 14px; font-weight: 600;">Tarik Tunai</span>
                        </button>
                        
                        <button class="cash-btn topup" onclick="cashModule.openTopUp()"
                                style="background: #f3e5f5; border: 2px solid #9c27b0; color: #6a1b9a; padding: 16px; border-radius: 12px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 8px; transition: all 0.2s;">
                            <span style="font-size: 28px;">💜</span>
                            <span style="font-size: 14px; font-weight: 600;">Top Up</span>
                        </button>
                        
                        <button class="cash-btn modal-awal" onclick="cashModule.openModalAwal()"
                                style="background: #fff8e1; border: 2px solid #ffc107; color: #f57f17; padding: 16px; border-radius: 12px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 8px; transition: all 0.2s;">
                            <span style="font-size: 28px;">💰</span>
                            <span style="font-size: 14px; font-weight: 600;">Modal Awal</span>
                        </button>
                        
                        <button class="cash-btn history" onclick="cashModule.openHistory()"
                                style="background: #eceff1; border: 2px solid #607d8b; color: #37474f; padding: 16px; border-radius: 12px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 8px; transition: all 0.2s;">
                            <span style="font-size: 28px;">📋</span>
                            <span style="font-size: 14px; font-weight: 600;">Riwayat</span>
                        </button>
                    </div>
                </div>

                <!-- Riwayat Transaksi -->
                <div class="card" style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
                    <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 20px;">
                        <span class="card-title" style="font-size: 18px; font-weight: 600; color: #333;">Riwayat Transaksi Kas</span>
                        <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                            <button class="btn btn-sm btn-secondary" onclick="cashModule.recalculateCash()" 
                                    style="font-size: 13px; padding: 8px 16px; background: #f5f5f5; border: 2px solid #ddd; border-radius: 8px; cursor: pointer;">
                                🔄 Recalculate
                            </button>
                        </div>
                    </div>
                    
                    <div class="transaction-list" id="cashTransactionList" style="min-height: 200px;"></div>
                    
                    <div id="filterSummary" style="padding: 16px; background: #f8f9fa; border-radius: 8px; margin-top: 16px; font-size: 14px; border: 1px solid #e0e0e0;">
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
        
        // Set filter dropdown ke nilai yang tersimpan
        const filterSelect = document.getElementById('filterPreset');
        if (filterSelect) filterSelect.value = this.filterState.preset;
        
        // Show/hide custom date range
        const customRange = document.getElementById('customDateRange');
        if (customRange) {
            customRange.style.display = this.filterState.preset === 'custom' ? 'flex' : 'none';
        }
    },
    
    // Method untuk menghitung statistik periode
    calculatePeriodStats(startDate, endDate) {
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
        
        return {
            income,
            expense,
            net: income - expense,
            totalTransactions: transactions.length
        };
    },
    
    // Method untuk format teks tanggal range
    getDateRangeText(startDate, endDate) {
        const options = { day: 'numeric', month: 'short', year: 'numeric' };
        
        if (this.filterState.preset === 'today') {
            return startDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        } else if (this.filterState.preset === 'yesterday') {
            return startDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        } else if (startDate.toDateString() === endDate.toDateString()) {
            return startDate.toLocaleDateString('id-ID', options);
        } else {
            return `${startDate.toLocaleDateString('id-ID', options)} - ${endDate.toLocaleDateString('id-ID', options)}`;
        }
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
        
        // Re-render seluruh HTML untuk update semua komponen
        this.renderHTML();
        this.renderTransactions();
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
        // Method ini sekarang tidak digunakan karena renderHTML sudah menghitung semuanya
        // Tetap dipertahankan untuk kompatibilitas
        const { startDate, endDate } = this.getDateRange();
        const stats = this.calculatePeriodStats(startDate, endDate);
        
        const incomeEl = document.getElementById('todayIncome');
        const expenseEl = document.getElementById('todayExpense');
        
        if (incomeEl) incomeEl.textContent = 'Rp ' + utils.formatNumber(stats.income);
        if (expenseEl) expenseEl.textContent = 'Rp ' + utils.formatNumber(stats.expense);
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
            const periodLabel = this.getFilterLabel();
            summaryEl.innerHTML = `
                <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px; align-items: center;">
                    <div>
                        <div style="font-size: 16px; font-weight: 600; color: #333; margin-bottom: 4px;">
                            Ringkasan ${periodLabel}
                        </div>
                        <div style="font-size: 13px; color: #666;">
                            ${transactions.length} transaksi kas
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="color: #4caf50; font-weight: 600; font-size: 15px;">⬇️ Masuk: Rp ${utils.formatNumber(totalIncome)}</div>
                        <div style="color: #f44336; font-weight: 600; font-size: 15px; margin: 4px 0;">⬆️ Keluar: Rp ${utils.formatNumber(totalExpense)}</div>
                        <div style="font-weight: 700; font-size: 16px; color: ${net >= 0 ? '#2e7d32' : '#c62828'}; padding-top: 4px; border-top: 1px solid #e0e0e0; margin-top: 4px;">
                            Net: Rp ${utils.formatNumber(net)}
                        </div>
                    </div>
                </div>
            `;
        }
        
        if (transactions.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 48px 20px; color: #999;">
                    <div style="font-size: 64px; margin-bottom: 16px;">📋</div>
                    <p style="font-size: 16px; margin: 0;">Belum ada transaksi ${this.getFilterLabel().toLowerCase()}</p>
                    <p style="font-size: 13px; margin-top: 8px; opacity: 0.7;">Transaksi kas masuk dan keluar akan muncul di sini</p>
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
                <div style="background: #f5f5f5; padding: 10px 16px; margin: 16px 0 8px 0; border-radius: 8px; font-weight: 600; font-size: 14px; color: #555; display: flex; justify-content: space-between; align-items: center;">
                    <span>${dateKey}</span>
                    <span style="color: ${dayTotal >= 0 ? '#4caf50' : '#f44336'}; font-weight: 700;">
                        ${dayTotal >= 0 ? '+' : ''}Rp ${utils.formatNumber(Math.abs(dayTotal))}
                    </span>
                </div>
            `;
            
            dayTrans.forEach(t => {
                const isIncome = t.type === 'in' || t.type === 'modal_in' || t.type === 'topup';
                const prefix = isIncome ? '+' : '-';
                const amountColor = isIncome ? '#2e7d32' : '#c62828';
                
                let typeLabel = '';
                if (t.type === 'modal_in') typeLabel = ' (Modal)';
                else if (t.type === 'topup') typeLabel = ' (Top Up)';
                else if (t.category === 'tarik_tunai') typeLabel = ' (Tarik Tunai)';
                
                const timeStr = new Date(t.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                
                html += `
                    <div class="transaction-item" style="display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; border-bottom: 1px solid #f0f0f0; transition: background 0.2s;" onmouseover="this.style.background='#fafafa'" onmouseout="this.style.background='transparent'">
                        <div class="transaction-info" style="flex: 1;">
                            <div class="transaction-title" style="font-weight: 600; margin-bottom: 4px; color: #333; font-size: 14px;">${t.note || t.category}${typeLabel}</div>
                            <div class="transaction-meta" style="font-size: 12px; color: #999;">${timeStr}</div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div class="transaction-amount" style="font-weight: 700; font-size: 16px; color: ${amountColor};">
                                ${prefix} Rp ${utils.formatNumber(t.amount)}
                            </div>
                            <button class="btn-delete-cash" data-transaction-id="${t.id}" 
                                    style="width: 36px; height: 36px; border-radius: 50%; background: #ffebee; 
                                           border: 2px solid #f44336; color: #f44336; font-size: 16px; cursor: pointer; 
                                           display: flex; align-items: center; justify-content: center;
                                           transition: all 0.2s;"
                                    onmouseover="this.style.background='#f44336'; this.style.color='white';"
                                    onmouseout="this.style.background='#ffebee'; this.style.color='#f44336';"
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
        
        deleteButtons.forEach(btn => {
            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const transactionId = parseInt(btn.getAttribute('data-transaction-id'));
                this.deleteTransaction(transactionId);
            };
        });
    },
    
    deleteTransaction(transactionId) {
        const t = dataManager.data.cashTransactions.find(tr => {
            return tr.id === transactionId || tr.id === transactionId.toString();
        });
        
        if (!t) {
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
        this.renderHTML();
        this.renderTransactions();
        app.showToast('Transaksi dihapus! Kas disesuaikan.');
    },
    
    openModal(type) {
        const isIn = type === 'in';
        
        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal active" id="cashModal" style="display: flex; align-items: center; justify-content: center; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1000;">
                <div class="modal-content" style="background: white; border-radius: 16px; width: 90%; max-width: 500px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
                    <div class="modal-header" style="padding: 20px 24px; border-bottom: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: center;">
                        <span class="modal-title" style="font-size: 20px; font-weight: 700; color: #333;">${isIn ? '💵 Kas Masuk' : '💸 Kas Keluar'}</span>
                        <button class="close-btn" onclick="cashModule.closeModal('cashModal')" style="background: none; border: none; font-size: 28px; cursor: pointer; color: #999; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 50%; transition: all 0.2s;">×</button>
                    </div>
                    
                    <div style="padding: 24px;">
                        <div class="form-group" style="margin-bottom: 20px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #555; font-size: 14px;">Jumlah (Rp)</label>
                            <input type="number" id="cashAmount" placeholder="0" style="width: 100%; padding: 12px 16px; border: 2px solid #e0e0e0; border-radius: 10px; font-size: 18px; font-weight: 600; transition: border-color 0.2s;" onfocus="this.style.borderColor='#667eea'" onblur="this.style.borderColor='#e0e0e0'">
                        </div>
                        
                        <div class="form-group" style="margin-bottom: 20px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #555; font-size: 14px;">Kategori</label>
                            <select id="cashCategory" style="width: 100%; padding: 12px 16px; border: 2px solid #e0e0e0; border-radius: 10px; font-size: 15px; background: white; cursor: pointer;">
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
                        
                        <div class="form-group" style="margin-bottom: 24px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #555; font-size: 14px;">Keterangan</label>
                            <textarea id="cashNote" rows="3" placeholder="Catatan transaksi..." style="width: 100%; padding: 12px 16px; border: 2px solid #e0e0e0; border-radius: 10px; font-size: 15px; resize: vertical; font-family: inherit;"></textarea>
                        </div>
                        
                        <div class="modal-footer" style="display: flex; gap: 12px; justify-content: flex-end;">
                            <button class="btn btn-secondary" onclick="cashModule.closeModal('cashModal')" style="padding: 12px 24px; border-radius: 10px; border: 2px solid #e0e0e0; background: white; color: #666; font-weight: 600; cursor: pointer; font-size: 15px;">Batal</button>
                            <button class="btn btn-primary" onclick="cashModule.saveTransaction('${type}')" style="padding: 12px 24px; border-radius: 10px; border: none; background: ${isIn ? '#4caf50' : '#f44336'}; color: white; font-weight: 600; cursor: pointer; font-size: 15px;">Simpan Transaksi</button>
                        </div>
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
        this.renderHTML();
        this.renderTransactions();
        app.showToast('Transaksi kas tersimpan!');
    },
    
    openModalAwal() {
        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal active" id="modalAwalModal" style="display: flex; align-items: center; justify-content: center; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1000;">
                <div class="modal-content" style="background: white; border-radius: 16px; width: 90%; max-width: 500px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
                    <div class="modal-header" style="padding: 20px 24px; border-bottom: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: center;">
                        <span class="modal-title" style="font-size: 20px; font-weight: 700; color: #333;">💰 Input Modal Awal</span>
                        <button class="close-btn" onclick="cashModule.closeModal('modalAwalModal')" style="background: none; border: none; font-size: 28px; cursor: pointer; color: #999; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 50%;">×</button>
                    </div>
                    
                    <div style="padding: 24px;">
                        <div style="background: #fff8e1; border-left: 4px solid #ffc107; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
                            <div style="font-weight: 600; color: #f57f17; margin-bottom: 4px; font-size: 14px;">📌 Modal Awal Shift</div>
                            <div style="color: #666; font-size: 13px; line-height: 1.5;">Modal akan ditambahkan ke Kas di Tangan untuk memulai shift baru.</div>
                        </div>

                        <div class="form-group" style="margin-bottom: 20px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #555; font-size: 14px;">Jumlah Modal (Rp)</label>
                            <input type="number" id="modalAwalAmount" placeholder="Contoh: 500000" style="width: 100%; padding: 12px 16px; border: 2px solid #e0e0e0; border-radius: 10px; font-size: 18px; font-weight: 600;">
                        </div>
                        
                        <div class="form-group" style="margin-bottom: 24px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #555; font-size: 14px;">Keterangan</label>
                            <textarea id="modalAwalNote" rows="2" style="width: 100%; padding: 12px 16px; border: 2px solid #e0e0e0; border-radius: 10px; font-size: 15px; resize: vertical; font-family: inherit;"></textarea>
                        </div>
                        
                        <div class="modal-footer" style="display: flex; gap: 12px; justify-content: flex-end;">
                            <button class="btn btn-secondary" onclick="cashModule.closeModal('modalAwalModal')" style="padding: 12px 24px; border-radius: 10px; border: 2px solid #e0e0e0; background: white; color: #666; font-weight: 600; cursor: pointer; font-size: 15px;">Batal</button>
                            <button class="btn btn-warning" onclick="cashModule.saveModalAwal()" style="padding: 12px 24px; border-radius: 10px; border: none; background: #ffc107; color: #333; font-weight: 600; cursor: pointer; font-size: 15px;">Simpan Modal</button>
                        </div>
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
        this.renderHTML();
        this.renderTransactions();
        app.showToast(`Modal Rp ${utils.formatNumber(amount)} tersimpan! Kas sekarang: Rp ${utils.formatNumber(dataManager.data.settings.currentCash)}`);
    },
    
    openTopUp() {
        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal active" id="topUpModal" style="display: flex; align-items: center; justify-content: center; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1000;">
                <div class="modal-content" style="background: white; border-radius: 16px; width: 90%; max-width: 500px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
                    <div class="modal-header" style="padding: 20px 24px; border-bottom: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: center;">
                        <span class="modal-title" style="font-size: 20px; font-weight: 700; color: #333;">💜 Top Up</span>
                        <button class="close-btn" onclick="cashModule.closeModal('topUpModal')" style="background: none; border: none; font-size: 28px; cursor: pointer; color: #999; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 50%;">×</button>
                    </div>
                    
                    <div style="padding: 24px;">
                        <div style="background: #f3e5f5; border-left: 4px solid #9c27b0; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
                            <div style="font-weight: 600; color: #6a1b9a; margin-bottom: 4px; font-size: 14px;">Admin Fee = Laba!</div>
                            <div style="color: #666; font-size: 13px; line-height: 1.5;">Total bayar = Nominal + Admin Fee<br>Admin fee masuk ke laba bersih</div>
                        </div>

                        <div class="form-group" style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #555; font-size: 14px;">Jenis</label>
                            <select id="topUpType" style="width: 100%; padding: 12px 16px; border: 2px solid #e0e0e0; border-radius: 10px; font-size: 15px; background: white;">
                                <option value="dana">DANA</option>
                                <option value="gopay">GoPay</option>
                                <option value="ovo">OVO</option>
                                <option value="shopeepay">ShopeePay</option>
                            </select>
                        </div>

                        <div class="form-group" style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #555; font-size: 14px;">Nominal (Rp)</label>
                            <input type="number" id="topUpNominal" placeholder="50000" oninput="cashModule.calcTopUp()" style="width: 100%; padding: 12px 16px; border: 2px solid #e0e0e0; border-radius: 10px; font-size: 16px;">
                        </div>

                        <div class="form-group" style="margin-bottom: 20px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #555; font-size: 14px;">Admin Fee (Rp)</label>
                            <input type="number" id="topUpAdmin" placeholder="1500" oninput="cashModule.calcTopUp()" style="width: 100%; padding: 12px 16px; border: 2px solid #e0e0e0; border-radius: 10px; font-size: 16px;">
                        </div>
                        
                        <div style="background: #f3e5f5; padding: 16px; border-radius: 10px; margin-bottom: 24px;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 15px;">
                                <span>Total Bayar:</span>
                                <span id="topUpTotal" style="font-weight: 700;">Rp 0</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; color: #4caf50; font-weight: 600;">
                                <span>Laba (Admin):</span>
                                <span id="topUpProfit">Rp 0</span>
                            </div>
                        </div>
                        
                        <div class="modal-footer" style="display: flex; gap: 12px; justify-content: flex-end;">
                            <button class="btn btn-secondary" onclick="cashModule.closeModal('topUpModal')" style="padding: 12px 24px; border-radius: 10px; border: 2px solid #e0e0e0; background: white; color: #666; font-weight: 600; cursor: pointer; font-size: 15px;">Batal</button>
                            <button class="btn btn-primary" onclick="cashModule.saveTopUp()" style="padding: 12px 24px; border-radius: 10px; border: none; background: #9c27b0; color: white; font-weight: 600; cursor: pointer; font-size: 15px;">Proses</button>
                        </div>
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
        this.renderHTML();
        this.renderTransactions();
        app.showToast(`Top up berhasil! Laba: Rp ${utils.formatNumber(admin)}`);
    },
    
    openTarikTunai() {
        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal active" id="tarikTunaiModal" style="display: flex; align-items: center; justify-content: center; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1000;">
                <div class="modal-content" style="background: white; border-radius: 16px; width: 90%; max-width: 500px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
                    <div class="modal-header" style="padding: 20px 24px; border-bottom: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: center;">
                        <span class="modal-title" style="font-size: 20px; font-weight: 700; color: #333;">🏧 Tarik Tunai</span>
                        <button class="close-btn" onclick="cashModule.closeModal('tarikTunaiModal')" style="background: none; border: none; font-size: 28px; cursor: pointer; color: #999; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 50%;">×</button>
                    </div>
                    
                    <div style="padding: 24px;">
                        <div style="background: #e1f5fe; border-left: 4px solid #2196f3; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
                            <div style="font-weight: 600; color: #1565c0; margin-bottom: 4px; font-size: 14px;">Admin Fee = Laba!</div>
                            <div style="color: #666; font-size: 13px; line-height: 1.5;">Nominal = Uang diberikan ke customer<br>Admin fee = Keuntungan konter</div>
                        </div>

                        <div class="form-group" style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #555; font-size: 14px;">Nominal Tarik (Rp)</label>
                            <input type="number" id="tarikNominal" placeholder="100000" oninput="cashModule.calcTarik()" style="width: 100%; padding: 12px 16px; border: 2px solid #e0e0e0; border-radius: 10px; font-size: 16px;">
                        </div>

                        <div class="form-group" style="margin-bottom: 20px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #555; font-size: 14px;">Admin Fee (Rp)</label>
                            <input type="number" id="tarikAdmin" placeholder="2500" oninput="cashModule.calcTarik()" style="width: 100%; padding: 12px 16px; border: 2px solid #e0e0e0; border-radius: 10px; font-size: 16px;">
                        </div>
                        
                        <div style="background: #e1f5fe; padding: 16px; border-radius: 10px; margin-bottom: 24px;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 15px;">
                                <span>Total Keluar dari Kas:</span>
                                <span id="tarikTotal" style="font-weight: 700; color: #f44336;">Rp 0</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; color: #4caf50; font-weight: 600;">
                                <span>Laba (Admin):</span>
                                <span id="tarikProfit">Rp 0</span>
                            </div>
                        </div>
                        
                        <div class="modal-footer" style="display: flex; gap: 12px; justify-content: flex-end;">
                            <button class="btn btn-secondary" onclick="cashModule.closeModal('tarikTunaiModal')" style="padding: 12px 24px; border-radius: 10px; border: 2px solid #e0e0e0; background: white; color: #666; font-weight: 600; cursor: pointer; font-size: 15px;">Batal</button>
                            <button class="btn btn-info" onclick="cashModule.saveTarikTunai()" style="padding: 12px 24px; border-radius: 10px; border: none; background: #2196f3; color: white; font-weight: 600; cursor: pointer; font-size: 15px;">Proses</button>
                        </div>
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
        this.renderHTML();
        this.renderTransactions();
        app.showToast(`Tarik tunai berhasil! Laba: Rp ${utils.formatNumber(admin)}`);
    },
    
    openHistory() {
        this.filterState.preset = 'today';
        this.renderHTML();
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
        this.renderHTML();
        
        app.showToast(`✅ Kas direcalculate: Rp ${utils.formatNumber(newCash)}`);
    }
};

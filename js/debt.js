/**
 * HIFZI CELL - Debt Module (Hutang/Piutang)
 * Terintegrasi dengan DATABASE HIFZI APPS (dataManager)
 * + Modal Tambah Nama Pelanggan Baru
 * + Autocomplete Nama Pelanggan dari daftar yang tersimpan
 */

const debtModule = {
    debts: [],
    currentFilter: 'all',
    searchQuery: '',
    expandedGroups: new Set(),
    showPaidDebts: false,
    itemCount: 1,
    isInitialized: false,
    customCustomerNames: [],

    init() {
        console.log('Debt module initialized - Connected to DATABASE HIFZI APPS');
        this.loadDebts();
        this.loadCustomNames();
        this.isInitialized = true;
        this.render();
    },

    loadDebts() {
        if (typeof dataManager !== 'undefined' && dataManager.data) {
            if (!dataManager.data.debts) {
                dataManager.data.debts = [];
            }
            this.debts = dataManager.data.debts;

            const oldData = localStorage.getItem('hifzi_debts');
            if (oldData) {
                try {
                    const oldDebts = JSON.parse(oldData);
                    if (Array.isArray(oldDebts) && oldDebts.length > 0) {
                        this.debts = [...this.debts, ...oldDebts];
                        dataManager.data.debts = this.debts;
                        dataManager.save();
                        localStorage.removeItem('hifzi_debts');
                        console.log('✅ Data hutang lama berhasil dimigrasi');
                    }
                } catch(e) {
                    console.log('Tidak ada data lama yang perlu dimigrasi');
                }
            }
        } else {
            console.warn('dataManager belum tersedia, menggunakan array kosong sementara');
            this.debts = [];
        }
    },

    loadCustomNames() {
        const saved = localStorage.getItem('hifzi_custom_customers');
        if (saved) {
            try {
                this.customCustomerNames = JSON.parse(saved);
            } catch(e) {
                this.customCustomerNames = [];
            }
        }
    },

    saveCustomNames() {
        localStorage.setItem('hifzi_custom_customers', JSON.stringify(this.customCustomerNames));
    },

    addCustomCustomerName(name, phone = '') {
        if (!name.trim()) return;
        
        const exists = this.customCustomerNames.find(c => 
            c.name.toLowerCase() === name.trim().toLowerCase()
        );
        
        if (!exists) {
            this.customCustomerNames.push({
                name: name.trim(),
                phone: phone,
                addedAt: new Date().toISOString()
            });
            this.saveCustomNames();
        }
    },

    removeCustomCustomerName(name) {
        this.customCustomerNames = this.customCustomerNames.filter(c => 
            c.name !== name
        );
        this.saveCustomNames();
    },

    saveDebts() {
        if (typeof dataManager !== 'undefined' && dataManager.data) {
            dataManager.data.debts = this.debts;
            if (dataManager.save) {
                dataManager.save();
                console.log('💾 Data hutang tersimpan ke DATABASE HIFZI APPS');
            }
        }
    },

    reload() {
        console.log('[Debt] Reloading module...');
        this.isInitialized = false;
        this.expandedGroups.clear();
        this.init();
        this.render();
    },

    getAllCustomerNames() {
        const debtCustomers = {};
        this.debts.forEach(debt => {
            if (!debtCustomers[debt.customerName]) {
                debtCustomers[debt.customerName] = {
                    name: debt.customerName,
                    phone: debt.customerPhone || '',
                    source: 'debt',
                    lastTransaction: debt.date
                };
            }
        });

        this.customCustomerNames.forEach(cust => {
            if (!debtCustomers[cust.name]) {
                debtCustomers[cust.name] = {
                    name: cust.name,
                    phone: cust.phone || '',
                    source: 'custom',
                    addedAt: cust.addedAt
                };
            }
        });

        return Object.values(debtCustomers).sort((a, b) => a.name.localeCompare(b.name));
    },

    filterCustomers(query) {
        const all = this.getAllCustomerNames();
        if (!query) return [];
        
        const lowerQuery = query.toLowerCase();
        return all.filter(c => c.name.toLowerCase().includes(lowerQuery));
    },

    toggleShowPaid() {
        this.showPaidDebts = !this.showPaidDebts;
        this.render();
    },

    setFilter(filter) {
        this.currentFilter = filter;
        this.render();
    },

    handleSearch(query) {
        this.searchQuery = query.toLowerCase();
        this.render();
    },

    generateId() {
        const maxId = this.debts.reduce((max, d) => {
            const num = parseInt(d.id.replace('H', ''));
            return num > max ? num : max;
        }, 0);
        return `H${String(maxId + 1).padStart(3, '0')}`;
    },

    getCurrentCash() {
        if (typeof dataManager !== 'undefined' && dataManager.data && dataManager.data.settings) {
            return dataManager.data.settings.currentCash || 0;
        }
        return 0;
    },

    updateCashDisplay() {
        if (typeof app !== 'undefined' && app.updateHeader) {
            app.updateHeader();
        }
    },

    getGroupedDebts() {
        let filtered = this.debts.filter(debt => {
            if (this.searchQuery) {
                const searchLower = this.searchQuery.toLowerCase();
                const matchSearch = (
                    debt.customerName.toLowerCase().includes(searchLower) ||
                    (debt.customerPhone && debt.customerPhone.includes(this.searchQuery)) ||
                    debt.id.toLowerCase().includes(searchLower)
                );
                if (!matchSearch) return false;
            }

            if (!this.showPaidDebts && debt.status === 'paid') {
                return false;
            }

            if (this.currentFilter !== 'all' && debt.status !== this.currentFilter) {
                return false;
            }

            return true;
        });

        const grouped = {};
        filtered.forEach(debt => {
            if (!grouped[debt.customerName]) {
                grouped[debt.customerName] = {
                    customerName: debt.customerName,
                    customerPhone: debt.customerPhone,
                    debts: [],
                    totalDebt: 0,
                    totalPaid: 0,
                    totalRemaining: 0,
                    count: 0,
                    hasOverdue: false,
                    allPaid: true,
                    hasPaid: false
                };
            }

            const group = grouped[debt.customerName];
            group.debts.push(debt);
            group.totalDebt += debt.total;
            group.totalPaid += debt.paid;
            group.count++;

            if (debt.status === 'overdue') {
                group.hasOverdue = true;
            }
            if (debt.status === 'paid') {
                group.hasPaid = true;
            }
            if (debt.status !== 'paid') {
                group.allPaid = false;
            }
        });

        Object.values(grouped).forEach(group => {
            group.totalRemaining = group.totalDebt - group.totalPaid;
        });

        return Object.values(grouped).sort((a, b) => {
            if (a.allPaid !== b.allPaid) return a.allPaid ? 1 : -1;
            return b.totalRemaining - a.totalRemaining;
        });
    },

    getSummary() {
        const allDebts = this.debts;
        const totalDebt = allDebts.reduce((sum, d) => sum + d.total, 0);
        const totalPaid = allDebts.reduce((sum, d) => sum + d.paid, 0);
        const totalRemaining = totalDebt - totalPaid;

        const activeDebts = allDebts.filter(d => d.status !== 'paid');
        const activeDebtTotal = activeDebts.reduce((sum, d) => sum + d.total, 0);
        const activePaidTotal = activeDebts.reduce((sum, d) => sum + d.paid, 0);
        const activeRemaining = activeDebtTotal - activePaidTotal;

        const overdueCount = activeDebts.filter(d => d.status === 'overdue').length;
        const paidCount = allDebts.filter(d => d.status === 'paid').length;
        const customerCount = new Set(activeDebts.map(d => d.customerName)).size;
        
        let totalTransactions = 0;
        let totalProfit = 0;
        
        if (typeof dataManager !== 'undefined' && dataManager.data) {
            if (dataManager.data.transactions) {
                totalTransactions = dataManager.data.transactions.length;
                totalProfit = dataManager.data.transactions.reduce((sum, t) => {
                    if (t.items && Array.isArray(t.items)) {
                        const transactionProfit = t.items.reduce((itemSum, item) => {
                            const profit = (item.price - (item.cost || 0)) * item.qty;
                            return itemSum + profit;
                        }, 0);
                        return sum + transactionProfit;
                    }
                    return sum;
                }, 0);
            }
        }

        return { 
            totalDebt, 
            totalPaid, 
            totalRemaining, 
            activeRemaining,
            overdueCount, 
            paidCount,
            customerCount,
            totalTransactions,
            totalProfit
        };
    },

    toggleGroup(customerName) {
        if (this.expandedGroups.has(customerName)) {
            this.expandedGroups.delete(customerName);
        } else {
            this.expandedGroups.add(customerName);
        }
        this.renderGroups();
    },

    render() {
        if (!this.isInitialized) {
            this.init();
        }

        const container = document.getElementById('mainContent');
        if (!container) {
            console.error('mainContent not found');
            return;
        }

        const summary = this.getSummary();
        const groupedDebts = this.getGroupedDebts();

        container.innerHTML = `
            <div class="hifzi-debt-container">
                <div class="hifzi-debt-summary-header">
                    <div class="hifzi-debt-summary-main-card">
                        <div class="hifzi-debt-summary-label">Total Piutang Aktif</div>
                        <div class="hifzi-debt-summary-amount">${this.formatRupiah(summary.activeRemaining)}</div>
                        <div class="hifzi-debt-summary-detail">
                            <span>👥 ${summary.customerCount} pelanggan aktif</span>
                        </div>
                    </div>
                    
                    <div class="hifzi-debt-summary-sub-cards">
                        <div class="hifzi-debt-summary-sub-card hifzi-success">
                            <div class="hifzi-debt-summary-sub-label">Sudah Dibayar</div>
                            <div class="hifzi-debt-summary-sub-amount">${this.formatRupiah(summary.totalPaid)}</div>
                            <div class="hifzi-debt-summary-sub-detail">${summary.paidCount} lunas</div>
                        </div>
                        
                        <div class="hifzi-debt-summary-sub-card hifzi-warning">
                            <div class="hifzi-debt-summary-sub-label">Sisa Piutang</div>
                            <div class="hifzi-debt-summary-sub-amount">${this.formatRupiah(summary.totalRemaining)}</div>
                            <div class="hifzi-debt-summary-sub-detail">${summary.overdueCount} overdue</div>
                        </div>
                    </div>
                </div>

                <div class="hifzi-debt-stats-bar">
                    <div class="hifzi-debt-stat-item">
                        <span class="hifzi-debt-stat-icon">📝</span>
                        <div class="hifzi-debt-stat-info">
                            <span class="hifzi-debt-stat-label">Total Transaksi</span>
                            <span class="hifzi-debt-stat-value">${summary.totalTransactions}</span>
                        </div>
                    </div>
                    <div class="hifzi-debt-stat-divider"></div>
                    <div class="hifzi-debt-stat-item">
                        <span class="hifzi-debt-stat-icon">📈</span>
                        <div class="hifzi-debt-stat-info">
                            <span class="hifzi-debt-stat-label">Total Laba</span>
                            <span class="hifzi-debt-stat-value hifzi-profit">${this.formatRupiah(summary.totalProfit)}</span>
                        </div>
                    </div>
                </div>

                <div class="hifzi-debt-controls-header">
                    <div class="hifzi-debt-controls">
                        <div class="hifzi-debt-search">
                            <span class="hifzi-debt-search-icon">🔍</span>
                            <input type="text" id="debtSearch" placeholder="Cari nama, no HP, atau kode..." 
                                   value="${this.searchQuery}" oninput="debtModule.handleSearch(this.value)">
                        </div>
                        <div class="hifzi-debt-filter">
                            <button class="hifzi-debt-filter-btn ${this.currentFilter === 'all' ? 'hifzi-active' : ''}" 
                                    onclick="debtModule.setFilter('all')">Semua</button>
                            <button class="hifzi-debt-filter-btn ${this.currentFilter === 'pending' ? 'hifzi-active' : ''}" 
                                    onclick="debtModule.setFilter('pending')">Pending</button>
                            <button class="hifzi-debt-filter-btn ${this.currentFilter === 'overdue' ? 'hifzi-active' : ''}" 
                                    onclick="debtModule.setFilter('overdue')">Overdue</button>
                            <button class="hifzi-debt-filter-btn ${this.currentFilter === 'paid' ? 'hifzi-active' : ''}" 
                                    onclick="debtModule.setFilter('paid')">Lunas</button>
                        </div>
                    </div>

                    <button class="hifzi-debt-add-btn" onclick="debtModule.openAddDebtModal()">
                        <span>➕</span>
                        <span>Tambah Hutang</span>
                    </button>
                </div>

                <div class="hifzi-debt-toggle-paid">
                    <label class="hifzi-debt-toggle-switch">
                        <input type="checkbox" ${this.showPaidDebts ? 'checked' : ''} 
                               onchange="debtModule.toggleShowPaid()">
                        <span class="hifzi-debt-toggle-slider"></span>
                        <span class="hifzi-debt-toggle-label">
                            ${this.showPaidDebts ? '🔓 Sembunyikan hutang lunas' : '🔒 Tampilkan hutang lunas'}
                        </span>
                    </label>
                    <span class="hifzi-debt-toggle-hint">
                        ${!this.showPaidDebts ? `( ${summary.paidCount} hutang lunas disembunyikan )` : ''}
                    </span>
                </div>

                <div class="hifzi-debt-groups" id="debtGroups">
                    ${this.renderGroupsHTML(groupedDebts)}
                </div>

                ${groupedDebts.length === 0 ? `
                    <div class="hifzi-debt-empty">
                        <div class="hifzi-debt-empty-icon">📋</div>
                        <div class="hifzi-debt-empty-title">Tidak ada data hutang</div>
                        <div class="hifzi-debt-empty-text">
                            ${!this.showPaidDebts && summary.paidCount > 0 
                                ? 'Semua hutang sudah lunas. Aktifkan toggle di atas untuk melihat riwayat.' 
                                : 'Belum ada catatan hutang yang sesuai dengan filter'}
                        </div>
                        <button class="hifzi-debt-add-btn-empty" onclick="debtModule.openAddDebtModal()">
                            <span>➕</span> Tambah Hutang Baru
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    },

    formatRupiah(amount) {
        return 'Rp ' + amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    },

    formatDate(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    },

    renderGroupsHTML(groupedDebts) {
        if (groupedDebts.length === 0) return '';

        return groupedDebts.map(group => {
            const isExpanded = this.expandedGroups.has(group.customerName);
            const remaining = group.totalRemaining;
            const avatarLetter = group.customerName.charAt(0).toUpperCase();

            let avatarClass = '';
            if (group.allPaid) avatarClass = 'hifzi-paid';
            else if (group.hasOverdue) avatarClass = 'hifzi-overdue';

            let statusBadge = '';
            if (group.allPaid) {
                statusBadge = '<span class="hifzi-debt-badge hifzi-paid">✓ Lunas</span>';
            } else if (group.hasOverdue) {
                statusBadge = '<span class="hifzi-debt-badge hifzi-overdue">⚠ Overdue</span>';
            } else {
                statusBadge = '<span class="hifzi-debt-badge hifzi-pending">⏳ Pending</span>';
            }

            let amountClass = '';
            if (group.allPaid) amountClass = 'hifzi-paid';
            else if (group.hasOverdue) amountClass = 'hifzi-overdue';

            if (group.allPaid && !this.showPaidDebts) return '';

            return `
                <div class="hifzi-debt-group ${isExpanded ? 'hifzi-expanded' : ''} ${group.allPaid ? 'hifzi-all-paid' : ''}" data-customer="${group.customerName}">
                    <div class="hifzi-debt-group-header" onclick="debtModule.toggleGroup('${group.customerName}')">
                        <div class="hifzi-debt-group-info">
                            <div class="hifzi-debt-avatar ${avatarClass}">${avatarLetter}</div>
                            <div class="hifzi-debt-group-title">
                                <div class="hifzi-debt-customer-name">${group.customerName}</div>
                                <div class="hifzi-debt-customer-meta">
                                    ${statusBadge}
                                    <span class="hifzi-debt-meta-item">📱 ${group.customerPhone || '-'}</span>
                                    <span class="hifzi-debt-meta-item">📝 ${group.count} transaksi</span>
                                </div>
                            </div>
                        </div>
                        <div class="hifzi-debt-group-amount">
                            <div class="hifzi-debt-total-label">${group.allPaid ? 'Total' : 'Sisa Hutang'}</div>
                            <div class="hifzi-debt-total-value ${amountClass}">${this.formatRupiah(remaining)}</div>
                        </div>
                        <div class="hifzi-debt-group-actions" onclick="event.stopPropagation()">
                            ${!group.allPaid ? `
                                <button class="hifzi-debt-action-btn hifzi-whatsapp" onclick="debtModule.sendWhatsApp('${group.customerPhone}', '${group.customerName}', ${remaining})" 
                                        title="Kirim WA" ${!group.customerPhone ? 'disabled style="opacity:0.5"' : ''}>💬</button>
                                <button class="hifzi-debt-action-btn hifzi-pay" onclick="debtModule.payAll('${group.customerName}')" 
                                        title="Bayar Semua">💰</button>
                            ` : `
                                <button class="hifzi-debt-action-btn hifzi-view" onclick="debtModule.viewPaidHistory('${group.customerName}')" 
                                        title="Lihat Riwayat">📋</button>
                            `}
                            <button class="hifzi-debt-toggle">${isExpanded ? '▲' : '▼'}</button>
                        </div>
                    </div>

                    <div class="hifzi-debt-items" style="${isExpanded ? 'display: block;' : 'display: none;'}">
                        ${group.debts.map(debt => this.renderDebtItem(debt)).join('')}
                    </div>
                </div>
            `;
        }).join('');
    },

    renderGroups() {
        const container = document.getElementById('debtGroups');
        if (!container) return;

        const groupedDebts = this.getGroupedDebts();
        container.innerHTML = this.renderGroupsHTML(groupedDebts);
    },

    renderDebtItem(debt) {
        const remaining = debt.total - debt.paid;
        const isPaid = debt.status === 'paid';
        const isOverdue = debt.status === 'overdue';

        const productSummary = debt.items.map(i => `${i.name} x${i.qty}`).join(', ');

        if (isPaid && !this.showPaidDebts) return '';

        const cashIndicator = debt.reduceCash 
            ? '<span class="hifzi-debt-cash-indicator hifzi-reduce">📉 Kurangi Kas</span>' 
            : '<span class="hifzi-debt-cash-indicator hifzi-normal">📋 Tidak Kurangi Kas</span>';

        return `
            <div class="hifzi-debt-item ${isPaid ? 'hifzi-paid-item' : ''}" data-debt-id="${debt.id}">
                <div class="hifzi-debt-item-info">
                    <div class="hifzi-debt-item-header">
                        <span class="hifzi-debt-item-id">#${debt.id}</span>
                        ${isPaid ? '<span class="hifzi-debt-item-status-badge hifzi-paid">✓ LUNAS</span>' : ''}
                        ${isOverdue ? '<span class="hifzi-debt-item-status-badge hifzi-overdue">⚠ OVERDUE</span>' : ''}
                    </div>
                    <div class="hifzi-debt-item-cash-status">
                        ${cashIndicator}
                    </div>
                    <div class="hifzi-debt-item-date">
                        <span>📅 ${this.formatDate(debt.date)}</span>
                        ${isPaid 
                            ? `<span>✅ Lunas: ${this.formatDate(debt.paidDate)}</span>`
                            : `<span>⏰ Jatuh tempo: ${this.formatDate(debt.dueDate)}</span>`
                        }
                    </div>
                    <div class="hifzi-debt-item-products">${productSummary}</div>
                </div>
                <div class="hifzi-debt-item-amount">
                    <div class="hifzi-debt-item-total">${this.formatRupiah(debt.total)}</div>
                    ${debt.paid > 0 && !isPaid ? `
                        <div class="hifzi-debt-item-paid">Dibayar: ${this.formatRupiah(debt.paid)}</div>
                    ` : ''}
                    ${!isPaid ? `
                        <div class="hifzi-debt-item-remaining">Sisa: ${this.formatRupiah(remaining)}</div>
                    ` : ''}
                </div>
                <div class="hifzi-debt-item-actions">
                    <button class="hifzi-debt-item-btn hifzi-detail" onclick="debtModule.viewDetail('${debt.id}')">Detail</button>
                    ${!isPaid ? `
                        <button class="hifzi-debt-item-btn hifzi-pay" onclick="debtModule.openPaymentModal('${debt.id}')">Bayar</button>
                    ` : ''}
                    <button class="hifzi-debt-item-btn hifzi-delete" onclick="debtModule.confirmDelete('${debt.id}')" title="Hapus">🗑️</button>
                </div>
            </div>
        `;
    },

    // ==========================================
    // MODAL TAMBAH HUTANG - DENGAN AUTOCOMPLETE
    // ==========================================
    openAddDebtModal() {
        this.itemCount = 1;
        const currentCash = this.getCurrentCash();

        const modal = document.createElement('div');
        modal.className = 'hifzi-debt-modal-overlay';
        modal.id = 'addDebtModal';
        modal.innerHTML = `
            <div class="hifzi-debt-modal">
                <div class="hifzi-debt-modal-header">
                    <div class="hifzi-debt-modal-title">➕ Tambah Hutang Baru</div>
                    <button class="hifzi-debt-modal-close" onclick="debtModule.closeModal()">✕</button>
                </div>
                
                <div class="hifzi-debt-modal-body">
                    <div class="hifzi-debt-section-title">👤 Informasi Pelanggan</div>
                    
                    <div class="hifzi-debt-form-group" style="position: relative;">
                        <label class="hifzi-debt-form-label">Nama Pelanggan *</label>
                        <div class="hifzi-debt-input-with-btn">
                            <input type="text" 
                                   class="hifzi-debt-form-input" 
                                   id="addCustomerName" 
                                   placeholder="Ketik nama atau pilih dari daftar..."
                                   autocomplete="off"
                                   oninput="debtModule.handleNameInput(this.value)"
                                   onfocus="debtModule.handleNameInput(this.value)">
                            <button type="button" class="hifzi-debt-input-btn" onclick="debtModule.openAddCustomerNameModal()" title="Tambah Nama Baru">
                                ➕
                            </button>
                        </div>
                        <!-- Dropdown Autocomplete -->
                        <div class="hifzi-debt-autocomplete" id="nameAutocomplete" style="display: none;">
                            <!-- Diisi oleh renderAutocomplete() -->
                        </div>
                    </div>

                    <div class="hifzi-debt-form-group">
                        <label class="hifzi-debt-form-label">No. Telepon</label>
                        <input type="text" class="hifzi-debt-form-input" id="addCustomerPhone" placeholder="Opsional">
                    </div>

                    <div class="hifzi-debt-section-title">📦 Produk yang Dihutangkan</div>
                    <div id="addDebtItems">
                        <div class="hifzi-debt-item-input">
                            <input type="text" class="hifzi-debt-form-input" placeholder="Nama produk" id="itemName0">
                            <div class="hifzi-debt-item-row">
                                <input type="number" class="hifzi-debt-form-input" placeholder="Qty" id="itemQty0" value="1" min="1" onchange="debtModule.calculateTotal()">
                                <input type="number" class="hifzi-debt-form-input" placeholder="Harga" id="itemPrice0" onchange="debtModule.calculateTotal()">
                            </div>
                        </div>
                    </div>
                    <button class="hifzi-debt-add-item-btn" onclick="debtModule.addItemField()">
                        <span>➕</span> Tambah Produk
                    </button>

                    <div class="hifzi-debt-total-section">
                        <div class="hifzi-debt-total-row">
                            <span>Total Hutang:</span>
                            <span id="addDebtTotal" class="hifzi-debt-total-amount">${this.formatRupiah(0)}</span>
                        </div>
                    </div>

                    <div class="hifzi-debt-form-group">
                        <label class="hifzi-debt-form-label">DP / Pembayaran Awal</label>
                        <input type="number" class="hifzi-debt-form-input" id="addDP" placeholder="0" value="0" onchange="debtModule.calculateTotal()">
                    </div>

                    <!-- PILIHAN KAS -->
                    <div class="hifzi-debt-cash-option">
                        <div class="hifzi-debt-cash-option-title">💰 Pengaruh ke Kas?</div>
                        <div class="hifzi-debt-cash-current">Kas saat ini: <strong>${this.formatRupiah(currentCash)}</strong></div>
                        <div class="hifzi-debt-cash-toggle">
                            <label class="hifzi-debt-cash-radio">
                                <input type="radio" name="reduceCash" value="yes" checked>
                                <span class="hifzi-debt-cash-radio-box"><span class="hifzi-debt-cash-radio-icon">✓</span></span>
                                <span class="hifzi-debt-cash-radio-label">
                                    <strong>Ya, Kurangi Kas</strong>
                                    <small>Barang keluar, uang belum masuk (Kas berkurang)</small>
                                </span>
                            </label>
                            <label class="hifzi-debt-cash-radio">
                                <input type="radio" name="reduceCash" value="no">
                                <span class="hifzi-debt-cash-radio-box"><span class="hifzi-debt-cash-radio-icon">✓</span></span>
                                <span class="hifzi-debt-cash-radio-label">
                                    <strong>Tidak, Jangan Kurangi Kas</strong>
                                    <small>Barang keluar, tapi kas tetap (DP sudah masuk/piutang luar)</small>
                                </span>
                            </label>
                        </div>
                    </div>

                    <div class="hifzi-debt-form-group">
                        <label class="hifzi-debt-form-label">Tanggal Jatuh Tempo *</label>
                        <input type="date" class="hifzi-debt-form-input" id="addDueDate">
                    </div>

                    <div class="hifzi-debt-form-group">
                        <label class="hifzi-debt-form-label">Catatan</label>
                        <textarea class="hifzi-debt-form-input" id="addNotes" rows="2" placeholder="Tambahkan catatan..."></textarea>
                    </div>
                </div>
                
                <div class="hifzi-debt-modal-footer">
                    <button class="hifzi-debt-btn hifzi-debt-btn-secondary" onclick="debtModule.closeModal()">Batal</button>
                    <button class="hifzi-debt-btn hifzi-debt-btn-primary" onclick="debtModule.saveNewDebt()">Simpan Hutang</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        
        // Close autocomplete when clicking outside
        setTimeout(() => {
            modal.classList.add('hifzi-active');
            
            // Set default due date
            const today = new Date();
            today.setDate(today.getDate() + 30);
            const dueDateInput = document.getElementById('addDueDate');
            if (dueDateInput) dueDateInput.value = today.toISOString().split('T')[0];
            
            // Add click outside listener
            document.addEventListener('click', this.handleClickOutsideAutocomplete);
        }, 10);
    },

    handleClickOutsideAutocomplete(e) {
        const autocomplete = document.getElementById('nameAutocomplete');
        const nameInput = document.getElementById('addCustomerName');
        
        if (autocomplete && !autocomplete.contains(e.target) && e.target !== nameInput) {
            autocomplete.style.display = 'none';
        }
    },

    handleNameInput(value) {
        const autocomplete = document.getElementById('nameAutocomplete');
        if (!autocomplete) return;

        const customers = this.filterCustomers(value);
        
        if (customers.length === 0 || value === '') {
            autocomplete.style.display = 'none';
            return;
        }

        autocomplete.innerHTML = customers.map(cust => `
            <div class="hifzi-debt-autocomplete-item" onclick="debtModule.selectCustomer('${cust.name.replace(/'/g, "\\'")}', '${cust.phone || ''}')">
                <div class="hifzi-debt-autocomplete-avatar">${cust.name.charAt(0).toUpperCase()}</div>
                <div class="hifzi-debt-autocomplete-info">
                    <div class="hifzi-debt-autocomplete-name">${cust.name}</div>
                    <div class="hifzi-debt-autocomplete-meta">
                        ${cust.phone ? `<span>📱 ${cust.phone}</span>` : ''}
                        ${cust.source === 'custom' ? '<span class="hifzi-debt-autocomplete-badge">Manual</span>' : '<span class="hifzi-debt-autocomplete-badge hifzi-debt">Pernah Hutang</span>'}
                    </div>
                </div>
            </div>
        `).join('');
        
        autocomplete.style.display = 'block';
    },

    selectCustomer(name, phone) {
        const nameInput = document.getElementById('addCustomerName');
        const phoneInput = document.getElementById('addCustomerPhone');
        const autocomplete = document.getElementById('nameAutocomplete');
        
        if (nameInput) nameInput.value = name;
        if (phoneInput && phone) phoneInput.value = phone;
        if (autocomplete) autocomplete.style.display = 'none';
    },

    openAddCustomerNameModal() {
        // Hide autocomplete first
        const autocomplete = document.getElementById('nameAutocomplete');
        if (autocomplete) autocomplete.style.display = 'none';

        const modal = document.createElement('div');
        modal.className = 'hifzi-debt-modal-overlay';
        modal.id = 'addCustomerNameModal';
        modal.style.zIndex = '2000';
        modal.innerHTML = `
            <div class="hifzi-debt-modal" style="max-width: 400px;">
                <div class="hifzi-debt-modal-header" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
                    <div class="hifzi-debt-modal-title">➕ Tambah Nama Pelanggan</div>
                    <button class="hifzi-debt-modal-close" onclick="debtModule.closeAddCustomerNameModal()">✕</button>
                </div>
                <div class="hifzi-debt-modal-body">
                    <div class="hifzi-debt-form-group">
                        <label class="hifzi-debt-form-label">Nama Pelanggan *</label>
                        <input type="text" 
                               class="hifzi-debt-form-input" 
                               id="newCustomerName" 
                               placeholder="Masukkan nama pelanggan..."
                               onkeypress="if(event.key==='Enter') debtModule.saveNewCustomerName()">
                    </div>
                    <div class="hifzi-debt-form-group">
                        <label class="hifzi-debt-form-label">No. Telepon (Opsional)</label>
                        <input type="text" 
                               class="hifzi-debt-form-input" 
                               id="newCustomerPhone" 
                               placeholder="08xxxxxxxxxx"
                               onkeypress="if(event.key==='Enter') debtModule.saveNewCustomerName()">
                    </div>
                </div>
                <div class="hifzi-debt-modal-footer">
                    <button class="hifzi-debt-btn hifzi-debt-btn-secondary" onclick="debtModule.closeAddCustomerNameModal()">Batal</button>
                    <button class="hifzi-debt-btn" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white;" onclick="debtModule.saveNewCustomerName()">Simpan</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        setTimeout(() => {
            modal.classList.add('hifzi-active');
            document.getElementById('newCustomerName')?.focus();
        }, 10);
    },

    closeAddCustomerNameModal() {
        const modal = document.getElementById('addCustomerNameModal');
        if (modal) {
            modal.classList.remove('hifzi-active');
            setTimeout(() => modal.remove(), 300);
        }
    },

    saveNewCustomerName() {
        const nameInput = document.getElementById('newCustomerName');
        const phoneInput = document.getElementById('newCustomerPhone');
        
        const name = nameInput?.value.trim();
        const phone = phoneInput?.value.trim() || '';
        
        if (!name) {
            this.showToast('Nama pelanggan wajib diisi!', 'error');
            return;
        }

        const allCustomers = this.getAllCustomerNames();
        const exists = allCustomers.find(c => c.name.toLowerCase() === name.toLowerCase());
        
        if (exists) {
            this.showToast('Nama pelanggan sudah ada!', 'error');
            return;
        }

        this.addCustomCustomerName(name, phone);
        this.closeAddCustomerNameModal();
        
        // Auto fill the name in main form
        const mainNameInput = document.getElementById('addCustomerName');
        const mainPhoneInput = document.getElementById('addCustomerPhone');
        if (mainNameInput) mainNameInput.value = name;
        if (mainPhoneInput && phone) mainPhoneInput.value = phone;
        
        this.showToast(`Nama "${name}" ditambahkan ke daftar`, 'success');
    },

    addItemField() {
        const container = document.getElementById('addDebtItems');
        const index = this.itemCount++;
        const div = document.createElement('div');
        div.className = 'hifzi-debt-item-input';
        div.innerHTML = `
            <div class="hifzi-debt-item-header-row">
                <input type="text" class="hifzi-debt-form-input" placeholder="Nama produk" id="itemName${index}">
                <button class="hifzi-debt-remove-item" onclick="this.closest('.hifzi-debt-item-input').remove(); debtModule.calculateTotal();">✕</button>
            </div>
            <div class="hifzi-debt-item-row">
                <input type="number" class="hifzi-debt-form-input" placeholder="Qty" id="itemQty${index}" value="1" min="1" onchange="debtModule.calculateTotal()">
                <input type="number" class="hifzi-debt-form-input" placeholder="Harga" id="itemPrice${index}" onchange="debtModule.calculateTotal()">
            </div>
        `;
        container.appendChild(div);
    },

    calculateTotal() {
        let total = 0;
        for (let i = 0; i < this.itemCount; i++) {
            const qty = parseInt(document.getElementById(`itemQty${i}`)?.value) || 0;
            const price = parseInt(document.getElementById(`itemPrice${i}`)?.value) || 0;
            total += qty * price;
        }
        document.getElementById('addDebtTotal').textContent = this.formatRupiah(total);
        return total;
    },

    saveNewDebt() {
        const customerName = document.getElementById('addCustomerName').value.trim();
        const customerPhone = document.getElementById('addCustomerPhone').value.trim();
        const dueDate = document.getElementById('addDueDate').value;
        const dp = parseInt(document.getElementById('addDP').value) || 0;
        const notes = document.getElementById('addNotes').value.trim();
        const reduceCash = document.querySelector('input[name="reduceCash"]:checked')?.value === 'yes';

        if (!customerName || !dueDate) {
            this.showToast('Nama pelanggan dan tanggal jatuh tempo wajib diisi!', 'error');
            return;
        }

        const allCustomers = this.getAllCustomerNames();
        const exists = allCustomers.find(c => c.name.toLowerCase() === customerName.toLowerCase());
        if (!exists) {
            this.addCustomCustomerName(customerName, customerPhone);
        }

        const items = [];
        let total = 0;
        for (let i = 0; i < this.itemCount; i++) {
            const name = document.getElementById(`itemName${i}`)?.value.trim();
            const qty = parseInt(document.getElementById(`itemQty${i}`)?.value) || 0;
            const price = parseInt(document.getElementById(`itemPrice${i}`)?.value) || 0;

            if (name && qty > 0 && price > 0) {
                items.push({ name, qty, price });
                total += qty * price;
            }
        }

        if (items.length === 0) {
            this.showToast('Minimal satu produk harus diisi!', 'error');
            return;
        }

        if (dp > total) {
            this.showToast('DP tidak boleh lebih besar dari total!', 'error');
            return;
        }

        if (reduceCash) {
            const currentCash = this.getCurrentCash();
            const cashNeeded = total - dp;
            if (currentCash < cashNeeded) {
                if (!confirm(`⚠️ Peringatan!\n\nKas saat ini: ${this.formatRupiah(currentCash)}\nYang dibutuhkan: ${this.formatRupiah(cashNeeded)}\n\nKas akan menjadi MINUS. Lanjutkan?`)) {
                    return;
                }
            }
        }

        const newDebt = {
            id: this.generateId(),
            customerName,
            customerPhone: customerPhone || '',
            date: new Date().toISOString().split('T')[0],
            dueDate,
            items,
            total,
            paid: dp,
            status: dp >= total ? 'paid' : 'pending',
            paidDate: dp >= total ? new Date().toISOString().split('T')[0] : null,
            notes,
            reduceCash,
            payments: dp > 0 ? [{
                date: new Date().toISOString(),
                amount: dp,
                method: 'cash',
                note: 'DP/ Pembayaran awal',
                addToCash: false
            }] : []
        };

        if (reduceCash && typeof dataManager !== 'undefined') {
            if (!dataManager.data.settings) dataManager.data.settings = {};
            
            const cashChange = -(total - dp);
            dataManager.data.settings.currentCash += cashChange;
            dataManager.save();
            this.updateCashDisplay();

            if (!dataManager.data.cashTransactions) dataManager.data.cashTransactions = [];
            dataManager.data.cashTransactions.push({
                id: Date.now(),
                date: new Date().toISOString(),
                type: 'out',
                category: 'debt_create',
                description: `Hutang baru ${customerName} (${newDebt.id})`,
                amount: total - dp,
                balance: dataManager.data.settings.currentCash
            });
            dataManager.save();
        }

        this.debts.push(newDebt);
        this.saveDebts();
        this.closeModal();
        this.render();
        
        const cashMsg = reduceCash ? ' (Kas berkurang)' : ' (Tidak kurangi kas)';
        this.showToast(`Hutang ${customerName} tersimpan${cashMsg}`, 'success');
        this.itemCount = 1;
    },

    confirmDelete(debtId) {
        const debt = this.debts.find(d => d.id === debtId);
        if (!debt) return;

        const remaining = debt.total - debt.paid;
        const showCashOption = remaining > 0 && debt.reduceCash;

        const modal = document.createElement('div');
        modal.className = 'hifzi-debt-modal-overlay';
        modal.id = 'deleteModal';
        modal.innerHTML = `
            <div class="hifzi-debt-modal" style="max-width: 450px;">
                <div class="hifzi-debt-modal-header" style="background: #fee2e2;">
                    <div class="hifzi-debt-modal-title" style="color: #dc2626;">⚠️ Hapus Hutang</div>
                    <button class="hifzi-debt-modal-close" onclick="debtModule.closeModal()">✕</button>
                </div>
                <div class="hifzi-debt-modal-body">
                    <div style="text-align: center; padding: 20px 0;">
                        <div style="font-size: 64px; margin-bottom: 16px;">🗑️</div>
                        <p style="font-size: 16px; color: #1e293b; margin-bottom: 8px;">
                            Yakin ingin menghapus hutang ini?
                        </p>
                        <p style="font-size: 14px; color: #64748b; line-height: 1.6;">
                            <strong>#${debt.id}</strong> - ${debt.customerName}<br>
                            Total: ${this.formatRupiah(debt.total)}<br>
                            Sisa: ${this.formatRupiah(remaining)}
                        </p>
                    </div>

                    ${showCashOption ? `
                        <div class="hifzi-debt-cash-option" style="margin-top: 16px; background: #fef3c7; border-color: #fbbf24;">
                            <div class="hifzi-debt-cash-option-title">💰 Kembalikan ke Kas?</div>
                            <div class="hifzi-debt-cash-current">Sisa hutang: <strong>${this.formatRupiah(remaining)}</strong></div>
                            <div class="hifzi-debt-cash-toggle">
                                <label class="hifzi-debt-cash-radio">
                                    <input type="radio" name="returnCash" value="yes" checked>
                                    <span class="hifzi-debt-cash-radio-box"><span class="hifzi-debt-cash-radio-icon">✓</span></span>
                                    <span class="hifzi-debt-cash-radio-label">
                                        <strong>Ya, Kembalikan ke Kas</strong>
                                        <small>Kas bertambah ${this.formatRupiah(remaining)}</small>
                                    </span>
                                </label>
                                <label class="hifzi-debt-cash-radio">
                                    <input type="radio" name="returnCash" value="no">
                                    <span class="hifzi-debt-cash-radio-box"><span class="hifzi-debt-cash-radio-icon">✓</span></span>
                                    <span class="hifzi-debt-cash-radio-label">
                                        <strong>Tidak, Hanya Hapus Data</strong>
                                        <small>Kas tidak berubah (untuk trial/test)</small>
                                    </span>
                                </label>
                            </div>
                        </div>
                    ` : `
                        <div style="background: #f3f4f6; padding: 12px; border-radius: 8px; margin-top: 16px; text-align: center; color: #6b7280; font-size: 13px;">
                            Hutang ini tidak mengurangi kas saat dibuat
                        </div>
                    `}
                </div>
                <div class="hifzi-debt-modal-footer">
                    <button class="hifzi-debt-btn hifzi-debt-btn-secondary" onclick="debtModule.closeModal()">Batal</button>
                    <button class="hifzi-debt-btn" style="background: #dc2626; color: white;" onclick="debtModule.deleteDebt('${debtId}')">Ya, Hapus</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('hifzi-active'), 10);
    },

    deleteDebt(debtId) {
        const debt = this.debts.find(d => d.id === debtId);
        if (!debt) return;

        const remaining = debt.total - debt.paid;
        const returnCash = document.querySelector('input[name="returnCash"]:checked')?.value === 'yes';

        if (returnCash && remaining > 0 && debt.reduceCash && typeof dataManager !== 'undefined') {
            if (!dataManager.data.settings) dataManager.data.settings = {};
            
            dataManager.data.settings.currentCash += remaining;
            dataManager.save();
            this.updateCashDisplay();

            if (!dataManager.data.cashTransactions) dataManager.data.cashTransactions = [];
            dataManager.data.cashTransactions.push({
                id: Date.now(),
                date: new Date().toISOString(),
                type: 'in',
                category: 'debt_delete',
                description: `Hapus hutang ${debt.customerName} (${debt.id})`,
                amount: remaining,
                balance: dataManager.data.settings.currentCash
            });
            dataManager.save();
        }

        const index = this.debts.findIndex(d => d.id === debtId);
        if (index > -1) {
            this.debts.splice(index, 1);
            this.saveDebts();
        }

        this.closeModal();
        this.render();
        
        const msg = (returnCash && remaining > 0 && debt.reduceCash) 
            ? `Hutang dihapus & kas dikembalikan ${this.formatRupiah(remaining)}` 
            : 'Hutang berhasil dihapus';
        this.showToast(msg, 'success');
    },

    openPaymentModal(debtId) {
        const debt = this.debts.find(d => d.id === debtId);
        if (!debt) return;

        const remaining = debt.total - debt.paid;
        const currentCash = this.getCurrentCash();

        const modal = document.createElement('div');
        modal.className = 'hifzi-debt-modal-overlay';
        modal.id = 'paymentModal';
        modal.innerHTML = `
            <div class="hifzi-debt-modal">
                <div class="hifzi-debt-modal-header">
                    <div class="hifzi-debt-modal-title">💰 Pembayaran Hutang</div>
                    <button class="hifzi-debt-modal-close" onclick="debtModule.closeModal()">✕</button>
                </div>
                <div class="hifzi-debt-modal-body">
                    <div class="hifzi-debt-amount-display">
                        <div class="hifzi-debt-amount-label">Sisa Hutang</div>
                        <div class="hifzi-debt-amount-value">${this.formatRupiah(remaining)}</div>
                    </div>

                    <div class="hifzi-debt-form-group">
                        <label class="hifzi-debt-form-label">Nama Pelanggan</label>
                        <input type="text" class="hifzi-debt-form-input" value="${debt.customerName}" readonly>
                    </div>

                    <div class="hifzi-debt-form-group">
                        <label class="hifzi-debt-form-label">Jumlah Pembayaran</label>
                        <input type="number" class="hifzi-debt-form-input" id="paymentAmount" value="${remaining}" max="${remaining}" min="1">
                    </div>

                    <div class="hifzi-debt-cash-option">
                        <div class="hifzi-debt-cash-option-title">💰 Tambah ke Kas?</div>
                        <div class="hifzi-debt-cash-current">Kas saat ini: <strong>${this.formatRupiah(currentCash)}</strong></div>
                        <div class="hifzi-debt-cash-toggle">
                            <label class="hifzi-debt-cash-radio">
                                <input type="radio" name="addToCash" value="yes" checked>
                                <span class="hifzi-debt-cash-radio-box"><span class="hifzi-debt-cash-radio-icon">✓</span></span>
                                <span class="hifzi-debt-cash-radio-label">
                                    <strong>Ya, Tambah ke Kas</strong>
                                    <small>Uang masuk ke laci/kas toko</small>
                                </span>
                            </label>
                            <label class="hifzi-debt-cash-radio">
                                <input type="radio" name="addToCash" value="no">
                                <span class="hifzi-debt-cash-radio-box"><span class="hifzi-debt-cash-radio-icon">✓</span></span>
                                <span class="hifzi-debt-cash-radio-label">
                                    <strong>Tidak, Hanya Catat</strong>
                                    <small>Uang tidak masuk kas (sudah masuk sebelumnya/dll)</small>
                                </span>
                            </label>
                        </div>
                    </div>

                    <div class="hifzi-debt-form-group">
                        <label class="hifzi-debt-form-label">Catatan (Opsional)</label>
                        <input type="text" class="hifzi-debt-form-input" id="paymentNote" placeholder="Tambahkan catatan...">
                    </div>
                </div>
                <div class="hifzi-debt-modal-footer">
                    <button class="hifzi-debt-btn hifzi-debt-btn-secondary" onclick="debtModule.closeModal()">Batal</button>
                    <button class="hifzi-debt-btn hifzi-debt-btn-primary" onclick="debtModule.processPayment('${debtId}')">Konfirmasi Pembayaran</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('hifzi-active'), 10);
    },

    processPayment(debtId) {
        const amount = parseInt(document.getElementById('paymentAmount').value) || 0;
        const note = document.getElementById('paymentNote').value;
        const addToCash = document.querySelector('input[name="addToCash"]:checked')?.value === 'yes';

        const debt = this.debts.find(d => d.id === debtId);
        if (!debt) return;

        const remaining = debt.total - debt.paid;
        if (amount <= 0 || amount > remaining) {
            this.showToast('Jumlah pembayaran tidak valid!', 'error');
            return;
        }

        debt.paid += amount;
        const isFullyPaid = debt.paid >= debt.total;

        if (isFullyPaid) {
            debt.status = 'paid';
            debt.paidDate = new Date().toISOString().split('T')[0];
        }

        if (!debt.payments) debt.payments = [];
        debt.payments.push({
            date: new Date().toISOString(),
            amount: amount,
            note: note,
            addToCash: addToCash
        });

        if (addToCash && typeof dataManager !== 'undefined') {
            if (!dataManager.data.settings) dataManager.data.settings = {};
            
            dataManager.data.settings.currentCash += amount;
            dataManager.save();
            this.updateCashDisplay();

            if (!dataManager.data.cashTransactions) dataManager.data.cashTransactions = [];
            dataManager.data.cashTransactions.push({
                id: Date.now(),
                date: new Date().toISOString(),
                type: 'in',
                category: 'debt_payment',
                description: `Pembayaran hutang ${debt.customerName} (${debt.id})`,
                amount: amount,
                balance: dataManager.data.settings.currentCash
            });
            dataManager.save();
        }

        this.saveDebts();
        this.closeModal();
        this.render();

        const cashMsg = addToCash ? ' (tambah ke kas)' : ' (tidak tambah kas)';
        const lunasMsg = isFullyPaid ? ' - LUNAS!' : '';
        this.showToast(`Pembayaran ${this.formatRupiah(amount)} berhasil${cashMsg}${lunasMsg}`, 'success');
    },

    payAll(customerName) {
        const customerDebts = this.debts.filter(d => 
            d.customerName === customerName && d.status !== 'paid'
        );

        const totalRemaining = customerDebts.reduce((sum, d) => sum + (d.total - d.paid), 0);
        const currentCash = this.getCurrentCash();

        const modal = document.createElement('div');
        modal.className = 'hifzi-debt-modal-overlay';
        modal.id = 'payAllModal';
        modal.innerHTML = `
            <div class="hifzi-debt-modal">
                <div class="hifzi-debt-modal-header">
                    <div class="hifzi-debt-modal-title">💰 Bayar Semua Hutang</div>
                    <button class="hifzi-debt-modal-close" onclick="debtModule.closeModal()">✕</button>
                </div>
                <div class="hifzi-debt-modal-body">
                    <div class="hifzi-debt-amount-display">
                        <div class="hifzi-debt-amount-label">Total Hutang ${customerName}</div>
                        <div class="hifzi-debt-amount-value">${this.formatRupiah(totalRemaining)}</div>
                    </div>

                    <div class="hifzi-debt-form-group">
                        <label class="hifzi-debt-form-label">Jumlah Transaksi</label>
                        <input type="text" class="hifzi-debt-form-input" value="${customerDebts.length} transaksi" readonly>
                    </div>

                    <div class="hifzi-debt-cash-option">
                        <div class="hifzi-debt-cash-option-title">💰 Tambah ke Kas?</div>
                        <div class="hifzi-debt-cash-current">Kas saat ini: <strong>${this.formatRupiah(currentCash)}</strong></div>
                        <div class="hifzi-debt-cash-toggle">
                            <label class="hifzi-debt-cash-radio">
                                <input type="radio" name="payAllAddToCash" value="yes" checked>
                                <span class="hifzi-debt-cash-radio-box"><span class="hifzi-debt-cash-radio-icon">✓</span></span>
                                <span class="hifzi-debt-cash-radio-label">
                                    <strong>Ya, Tambah ke Kas</strong>
                                    <small>Kas bertambah ${this.formatRupiah(totalRemaining)}</small>
                                </span>
                            </label>
                            <label class="hifzi-debt-cash-radio">
                                <input type="radio" name="payAllAddToCash" value="no">
                                <span class="hifzi-debt-cash-radio-box"><span class="hifzi-debt-cash-radio-icon">✓</span></span>
                                <span class="hifzi-debt-cash-radio-label">
                                    <strong>Tidak, Hanya Catat</strong>
                                    <small>Kas tidak berubah</small>
                                </span>
                            </label>
                        </div>
                    </div>
                </div>
                <div class="hifzi-debt-modal-footer">
                    <button class="hifzi-debt-btn hifzi-debt-btn-secondary" onclick="debtModule.closeModal()">Batal</button>
                    <button class="hifzi-debt-btn hifzi-debt-btn-primary" onclick="debtModule.processPayAll('${customerName}')">Bayar Semua</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('hifzi-active'), 10);
    },

    processPayAll(customerName) {
        const customerDebts = this.debts.filter(d => 
            d.customerName === customerName && d.status !== 'paid'
        );

        const totalRemaining = customerDebts.reduce((sum, d) => sum + (d.total - d.paid), 0);
        const addToCash = document.querySelector('input[name="payAllAddToCash"]:checked')?.value === 'yes';

        customerDebts.forEach(debt => {
            const remaining = debt.total - debt.paid;
            debt.paid = debt.total;
            debt.status = 'paid';
            debt.paidDate = new Date().toISOString().split('T')[0];

            if (!debt.payments) debt.payments = [];
            debt.payments.push({
                date: new Date().toISOString(),
                amount: remaining,
                method: 'cash',
                note: 'Pelunasan semua hutang',
                addToCash: addToCash
            });
        });

        if (addToCash && typeof dataManager !== 'undefined') {
            if (!dataManager.data.settings) dataManager.data.settings = {};
            
            dataManager.data.settings.currentCash += totalRemaining;
            dataManager.save();
            this.updateCashDisplay();

            if (!dataManager.data.cashTransactions) dataManager.data.cashTransactions = [];
            dataManager.data.cashTransactions.push({
                id: Date.now(),
                date: new Date().toISOString(),
                type: 'in',
                category: 'debt_payment',
                description: `Pelunasan semua hutang ${customerName}`,
                amount: totalRemaining,
                balance: dataManager.data.settings.currentCash
            });
            dataManager.save();
        }

        this.saveDebts();
        this.closeModal();
        this.render();

        const cashMsg = addToCash ? ' (tambah ke kas)' : ' (tidak tambah kas)';
        this.showToast(`Semua hutang ${customerName} dilunaskan${cashMsg}!`, 'success');
    },

    viewPaidHistory(customerName) {
        const customerDebts = this.debts.filter(d => 
            d.customerName === customerName && d.status === 'paid'
        );

        const totalPaid = customerDebts.reduce((sum, d) => sum + d.total, 0);

        const modal = document.createElement('div');
        modal.className = 'hifzi-debt-modal-overlay';
        modal.id = 'paidHistoryModal';
        modal.innerHTML = `
            <div class="hifzi-debt-modal" style="max-width: 600px;">
                <div class="hifzi-debt-modal-header">
                    <div class="hifzi-debt-modal-title">📋 Riwayat Lunas - ${customerName}</div>
                    <button class="hifzi-debt-modal-close" onclick="debtModule.closeModal()">✕</button>
                </div>
                <div class="hifzi-debt-modal-body">
                    <div class="hifzi-debt-amount-display hifzi-success">
                        <div class="hifzi-debt-amount-label">Total Sudah Dibayar</div>
                        <div class="hifzi-debt-amount-value">${this.formatRupiah(totalPaid)}</div>
                    </div>
                    <div class="hifzi-debt-history-list">
                        ${customerDebts.map(debt => `
                            <div class="hifzi-debt-history-item">
                                <div class="hifzi-debt-history-header">
                                    <span class="hifzi-debt-history-id">#${debt.id}</span>
                                    <span class="hifzi-debt-history-date">Lunas: ${this.formatDate(debt.paidDate)}</span>
                                </div>
                                <div class="hifzi-debt-history-products">${debt.items.map(i => i.name).join(', ')}</div>
                                <div class="hifzi-debt-history-amount">${this.formatRupiah(debt.total)}</div>
                                ${debt.reduceCash ? '<span class="hifzi-debt-reduce-badge">📉 Kurangi Kas</span>' : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="hifzi-debt-modal-footer">
                    <button class="hifzi-debt-btn hifzi-debt-btn-secondary" onclick="debtModule.closeModal()">Tutup</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('hifzi-active'), 10);
    },

    viewDetail(debtId) {
        const debt = this.debts.find(d => d.id === debtId);
        if (!debt) return;
        
        const modal = document.createElement('div');
        modal.className = 'hifzi-debt-modal-overlay';
        modal.id = 'detailModal';
        modal.innerHTML = `
            <div class="hifzi-debt-modal">
                <div class="hifzi-debt-modal-header">
                    <div class="hifzi-debt-modal-title">Detail Hutang #${debt.id}</div>
                    <button class="hifzi-debt-modal-close" onclick="debtModule.closeModal()">✕</button>
                </div>
                <div class="hifzi-debt-modal-body">
                    <div class="hifzi-debt-cash-info ${debt.reduceCash ? 'hifzi-reduce' : 'hifzi-normal'}">
                        ${debt.reduceCash ? '📉 Hutang ini mengurangi kas' : '📋 Hutang ini tidak mengurangi kas'}
                    </div>
                    <div class="hifzi-debt-form-group">
                        <label>Pelanggan: <strong>${debt.customerName}</strong></label>
                    </div>
                    <div class="hifzi-debt-form-group">
                        <label>Total: <strong>${this.formatRupiah(debt.total)}</strong></label>
                    </div>
                    <div class="hifzi-debt-form-group">
                        <label>Dibayar: <strong style="color: #059669;">${this.formatRupiah(debt.paid)}</strong></label>
                    </div>
                    <div class="hifzi-debt-form-group">
                        <label>Sisa: <strong style="color: ${debt.total - debt.paid > 0 ? '#dc2626' : '#059669'};">${this.formatRupiah(debt.total - debt.paid)}</strong></label>
                    </div>
                    ${debt.notes ? `
                        <div class="hifzi-debt-form-group">
                            <label>Catatan: ${debt.notes}</label>
                        </div>
                    ` : ''}
                </div>
                <div class="hifzi-debt-modal-footer">
                    <button class="hifzi-debt-btn hifzi-debt-btn-secondary" onclick="debtModule.closeModal()">Tutup</button>
                    ${debt.status !== 'paid' ? `
                        <button class="hifzi-debt-btn hifzi-debt-btn-primary" onclick="debtModule.closeModal(); setTimeout(() => debtModule.openPaymentModal('${debt.id}'), 300)">Bayar</button>
                    ` : ''}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('hifzi-active'), 10);
    },

    sendWhatsApp(phone, name, amount) {
        if (!phone) {
            this.showToast('Nomor telepon tidak tersedia!', 'error');
            return;
        }
        const message = `Halo ${name}, ini pengingat pembayaran hutang Anda sebesar ${this.formatRupiah(amount)} di Hifzi Cell. Mohon segera melakukan pembayaran. Terima kasih.`;
        let formattedPhone = phone.replace(/^0/, '62').replace(/[^0-9]/g, '');
        window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`, '_blank');
    },

    closeModal() {
        // Remove click outside listener
        document.removeEventListener('click', this.handleClickOutsideAutocomplete);
        
        const modal = document.querySelector('.hifzi-debt-modal-overlay.hifzi-active');
        if (modal) {
            modal.classList.remove('hifzi-active');
            setTimeout(() => modal.remove(), 300);
        }
    },

    showToast(message, type = 'success') {
        if (typeof app !== 'undefined' && app.showToast) {
            app.showToast(message, type);
        } else {
            alert(message);
        }
    }
};

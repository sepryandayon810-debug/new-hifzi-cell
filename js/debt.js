/**
 * HIFZI CELL - Debt Module (Hutang/Piutang)
 * Terintegrasi dengan DATABASE HIFZI APPS (dataManager)
 */

const debtModule = {
    debts: [],
    currentFilter: 'all',
    searchQuery: '',
    expandedGroups: new Set(),
    showPaidDebts: false,
    itemCount: 1,
    isInitialized: false,

    // Inisialisasi modul - terhubung ke dataManager
    init() {
        console.log('Debt module initialized - Connected to DATABASE HIFZI APPS');
        this.loadDebts();
        this.isInitialized = true;
    },

    // Load data hutang dari DATABASE HIFZI APPS
    loadDebts() {
        if (typeof dataManager !== 'undefined' && dataManager.data) {
            if (!dataManager.data.debts) {
                dataManager.data.debts = [];
            }
            this.debts = dataManager.data.debts;

            // Migrasi data lama
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

    // Simpan data hutang ke DATABASE HIFZI APPS
    saveDebts() {
        if (typeof dataManager !== 'undefined' && dataManager.data) {
            dataManager.data.debts = this.debts;
            if (dataManager.save) {
                dataManager.save();
                console.log('💾 Data hutang tersimpan ke DATABASE HIFZI APPS');
            }
        }
    },

    // ✅ FUNGSI BARU: Force re-initialize dan render
    reload() {
        console.log('[Debt] Reloading module...');
        this.isInitialized = false;
        this.expandedGroups.clear();
        this.init();
        this.render();
    },

    // Toggle tampilkan hutang lunas
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

    getGroupedDebts() {
        let filtered = this.debts.filter(debt => {
            if (this.searchQuery) {
                const searchLower = this.searchQuery.toLowerCase();
                const matchSearch = (
                    debt.customerName.toLowerCase().includes(searchLower) ||
                    debt.customerPhone.includes(searchLower) ||
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

    // ✅ PERBAIKAN: Get summary dengan total transaksi
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
        
        // ✅ TAMBAHAN: Hitung total transaksi dan laba dari dataManager
        let totalTransactions = 0;
        let totalProfit = 0;
        
        if (typeof dataManager !== 'undefined' && dataManager.data) {
            // Hitung dari transactions
            if (dataManager.data.transactions) {
                totalTransactions = dataManager.data.transactions.length;
                
                // Hitung laba dari transaksi
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
            totalTransactions,  // ✅ BARU
            totalProfit         // ✅ BARU
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

    // ✅ PERBAIKAN: Render dengan summary card yang lebih besar
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
            <div class="debt-container">
                <!-- ✅ SUMMARY CARDS BARU - Seperti di gambar -->
                <div class="debt-summary-header">
                    <div class="debt-summary-main-card">
                        <div class="debt-summary-label">Total Piutang Aktif</div>
                        <div class="debt-summary-amount">${this.formatRupiah(summary.activeRemaining)}</div>
                        <div class="debt-summary-detail">
                            <span>👥 ${summary.customerCount} pelanggan aktif</span>
                        </div>
                    </div>
                    
                    <div class="debt-summary-sub-cards">
                        <div class="debt-summary-sub-card success">
                            <div class="debt-summary-sub-label">Sudah Dibayar</div>
                            <div class="debt-summary-sub-amount">${this.formatRupiah(summary.totalPaid)}</div>
                            <div class="debt-summary-sub-detail">${summary.paidCount} lunas</div>
                        </div>
                        
                        <div class="debt-summary-sub-card warning">
                            <div class="debt-summary-sub-label">Sisa Piutang</div>
                            <div class="debt-summary-sub-amount">${this.formatRupiah(summary.totalRemaining)}</div>
                            <div class="debt-summary-sub-detail">${summary.overdueCount} overdue</div>
                        </div>
                    </div>
                </div>

                <!-- ✅ TAMBAHAN: Statistik Transaksi & Laba -->
                <div class="debt-stats-bar">
                    <div class="debt-stat-item">
                        <span class="debt-stat-icon">📝</span>
                        <div class="debt-stat-info">
                            <span class="debt-stat-label">Total Transaksi</span>
                            <span class="debt-stat-value">${summary.totalTransactions}</span>
                        </div>
                    </div>
                    <div class="debt-stat-divider"></div>
                    <div class="debt-stat-item">
                        <span class="debt-stat-icon">📈</span>
                        <div class="debt-stat-info">
                            <span class="debt-stat-label">Total Laba</span>
                            <span class="debt-stat-value profit">${this.formatRupiah(summary.totalProfit)}</span>
                        </div>
                    </div>
                </div>

                <!-- Controls & Add Button -->
                <div class="debt-controls-header">
                    <div class="debt-controls">
                        <div class="debt-search">
                            <span class="debt-search-icon">🔍</span>
                            <input type="text" id="debtSearch" placeholder="Cari nama, no HP, atau kode..." 
                                   value="${this.searchQuery}" oninput="debtModule.handleSearch(this.value)">
                        </div>
                        <div class="debt-filter">
                            <button class="debt-filter-btn ${this.currentFilter === 'all' ? 'active' : ''}" 
                                    onclick="debtModule.setFilter('all')">Semua</button>
                            <button class="debt-filter-btn ${this.currentFilter === 'pending' ? 'active' : ''}" 
                                    onclick="debtModule.setFilter('pending')">Pending</button>
                            <button class="debt-filter-btn ${this.currentFilter === 'overdue' ? 'active' : ''}" 
                                    onclick="debtModule.setFilter('overdue')">Overdue</button>
                            <button class="debt-filter-btn ${this.currentFilter === 'paid' ? 'active' : ''}" 
                                    onclick="debtModule.setFilter('paid')">Lunas</button>
                        </div>
                    </div>

                    <button class="debt-add-btn" onclick="debtModule.openAddDebtModal()">
                        <span>➕</span>
                        <span>Tambah Hutang</span>
                    </button>
                </div>

                <!-- Toggle Show Paid -->
                <div class="debt-toggle-paid">
                    <label class="debt-toggle-switch">
                        <input type="checkbox" ${this.showPaidDebts ? 'checked' : ''} 
                               onchange="debtModule.toggleShowPaid()">
                        <span class="debt-toggle-slider"></span>
                        <span class="debt-toggle-label">
                            ${this.showPaidDebts ? '🔓 Sembunyikan hutang lunas' : '🔒 Tampilkan hutang lunas'}
                        </span>
                    </label>
                    <span class="debt-toggle-hint">
                        ${!this.showPaidDebts ? `( ${summary.paidCount} hutang lunas disembunyikan )` : ''}
                    </span>
                </div>

                <!-- Grouped Debt List -->
                <div class="debt-groups" id="debtGroups">
                    ${this.renderGroupsHTML(groupedDebts)}
                </div>

                ${groupedDebts.length === 0 ? `
                    <div class="debt-empty">
                        <div class="debt-empty-icon">📋</div>
                        <div class="debt-empty-title">Tidak ada data hutang</div>
                        <div class="debt-empty-text">
                            ${!this.showPaidDebts && summary.paidCount > 0 
                                ? 'Semua hutang sudah lunas. Aktifkan toggle di atas untuk melihat riwayat.' 
                                : 'Belum ada catatan hutang yang sesuai dengan filter'}
                        </div>
                        <button class="debt-add-btn-empty" onclick="debtModule.openAddDebtModal()">
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
            if (group.allPaid) avatarClass = 'paid';
            else if (group.hasOverdue) avatarClass = 'overdue';

            let statusBadge = '';
            if (group.allPaid) {
                statusBadge = '<span class="debt-badge paid">✓ Lunas</span>';
            } else if (group.hasOverdue) {
                statusBadge = '<span class="debt-badge overdue">⚠ Overdue</span>';
            } else {
                statusBadge = '<span class="debt-badge pending">⏳ Pending</span>';
            }

            let amountClass = '';
            if (group.allPaid) amountClass = 'paid';
            else if (group.hasOverdue) amountClass = 'overdue';

            if (group.allPaid && !this.showPaidDebts) return '';

            return `
                <div class="debt-group ${isExpanded ? 'expanded' : ''} ${group.allPaid ? 'all-paid' : ''}" data-customer="${group.customerName}">
                    <div class="debt-group-header" onclick="debtModule.toggleGroup('${group.customerName}')">
                        <div class="debt-group-info">
                            <div class="debt-avatar ${avatarClass}">${avatarLetter}</div>
                            <div class="debt-group-title">
                                <div class="debt-customer-name">${group.customerName}</div>
                                <div class="debt-customer-meta">
                                    ${statusBadge}
                                    <span class="debt-meta-item">📱 ${group.customerPhone || '-'}</span>
                                    <span class="debt-meta-item">📝 ${group.count} transaksi</span>
                                </div>
                            </div>
                        </div>
                        <div class="debt-group-amount">
                            <div class="debt-total-label">${group.allPaid ? 'Total' : 'Sisa Hutang'}</div>
                            <div class="debt-total-value ${amountClass}">${this.formatRupiah(remaining)}</div>
                        </div>
                        <div class="debt-group-actions" onclick="event.stopPropagation()">
                            ${!group.allPaid ? `
                                <button class="debt-action-btn whatsapp" onclick="debtModule.sendWhatsApp('${group.customerPhone}', '${group.customerName}', ${remaining})" 
                                        title="Kirim WA" ${!group.customerPhone ? 'disabled style="opacity:0.5"' : ''}>💬</button>
                                <button class="debt-action-btn pay" onclick="debtModule.payAll('${group.customerName}')" 
                                        title="Bayar Semua">💰</button>
                            ` : `
                                <button class="debt-action-btn view" onclick="debtModule.viewPaidHistory('${group.customerName}')" 
                                        title="Lihat Riwayat">📋</button>
                            `}
                            <button class="debt-toggle">${isExpanded ? '▲' : '▼'}</button>
                        </div>
                    </div>

                    <div class="debt-items" style="${isExpanded ? 'display: block;' : 'display: none;'}">
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
            ? '<span class="debt-cash-indicator reduce">📉 Kurangi Kas</span>' 
            : '<span class="debt-cash-indicator normal">📋 Tidak Kurangi Kas</span>';

        return `
            <div class="debt-item ${isPaid ? 'paid-item' : ''}" data-debt-id="${debt.id}">
                <div class="debt-item-info">
                    <div class="debt-item-header">
                        <span class="debt-item-id">#${debt.id}</span>
                        ${isPaid ? '<span class="debt-item-status-badge paid">✓ LUNAS</span>' : ''}
                        ${isOverdue ? '<span class="debt-item-status-badge overdue">⚠ OVERDUE</span>' : ''}
                    </div>
                    <div class="debt-item-cash-status">
                        ${cashIndicator}
                    </div>
                    <div class="debt-item-date">
                        <span>📅 ${this.formatDate(debt.date)}</span>
                        ${isPaid 
                            ? `<span>✅ Lunas: ${this.formatDate(debt.paidDate)}</span>`
                            : `<span>⏰ Jatuh tempo: ${this.formatDate(debt.dueDate)}</span>`
                        }
                    </div>
                    <div class="debt-item-products">${productSummary}</div>
                </div>
                <div class="debt-item-amount">
                    <div class="debt-item-total">${this.formatRupiah(debt.total)}</div>
                    ${debt.paid > 0 && !isPaid ? `
                        <div class="debt-item-paid">Dibayar: ${this.formatRupiah(debt.paid)}</div>
                    ` : ''}
                    ${!isPaid ? `
                        <div class="debt-item-remaining">Sisa: ${this.formatRupiah(remaining)}</div>
                    ` : ''}
                </div>
                <div class="debt-item-actions">
                    <button class="debt-item-btn detail" onclick="debtModule.viewDetail('${debt.id}')">Detail</button>
                    ${!isPaid ? `
                        <button class="debt-item-btn pay" onclick="debtModule.openPaymentModal('${debt.id}')">Bayar</button>
                    ` : ''}
                    <button class="debt-item-btn delete" onclick="debtModule.confirmDelete('${debt.id}')" title="Hapus">🗑️</button>
                </div>
            </div>
        `;
    },

    // ... (sisa fungsi modal dan lainnya tetap sama seperti sebelumnya)
    
    openAddDebtModal() {
        this.itemCount = 1;
        
        const modal = document.createElement('div');
        modal.className = 'debt-modal-overlay';
        modal.id = 'addDebtModal';
        modal.innerHTML = `
            <div class="debt-modal" style="max-width: 600px;">
                <div class="debt-modal-header">
                    <div class="debt-modal-title">➕ Tambah Hutang Baru</div>
                    <button class="debt-modal-close" onclick="debtModule.closeModal()">✕</button>
                </div>
                <div class="debt-modal-body" style="max-height: 75vh;">
                    <div class="debt-section-title">👤 Informasi Pelanggan</div>
                    <div class="debt-form-group">
                        <label class="debt-form-label">Nama Pelanggan *</label>
                        <input type="text" class="debt-form-input" id="addCustomerName" placeholder="Nama pelanggan">
                    </div>
                    <div class="debt-form-group">
                        <label class="debt-form-label">No. Telepon</label>
                        <input type="text" class="debt-form-input" id="addCustomerPhone" placeholder="Opsional">
                    </div>

                    <div class="debt-section-title">📦 Produk yang Dihutangkan</div>
                    <div id="addDebtItems">
                        <div class="debt-item-input">
                            <input type="text" class="debt-form-input" placeholder="Nama produk" id="itemName0">
                            <div class="debt-item-row">
                                <input type="number" class="debt-form-input" placeholder="Qty" id="itemQty0" value="1" min="1" onchange="debtModule.calculateTotal()">
                                <input type="number" class="debt-form-input" placeholder="Harga" id="itemPrice0" onchange="debtModule.calculateTotal()">
                            </div>
                        </div>
                    </div>
                    <button class="debt-add-item-btn" onclick="debtModule.addItemField()">
                        <span>➕</span> Tambah Produk
                    </button>

                    <div class="debt-total-section">
                        <div class="debt-total-row">
                            <span>Total Hutang:</span>
                            <span id="addDebtTotal" class="debt-total-amount">${this.formatRupiah(0)}</span>
                        </div>
                    </div>

                    <div class="debt-form-group">
                        <label class="debt-form-label">DP / Pembayaran Awal</label>
                        <input type="number" class="debt-form-input" id="addDP" placeholder="0" value="0" onchange="debtModule.calculateTotal()">
                    </div>

                    <div class="debt-form-group">
                        <label class="debt-form-label">Tanggal Jatuh Tempo *</label>
                        <input type="date" class="debt-form-input" id="addDueDate">
                    </div>

                    <div class="debt-form-group">
                        <label class="debt-form-label">Catatan</label>
                        <textarea class="debt-form-input" id="addNotes" rows="2" placeholder="Tambahkan catatan..."></textarea>
                    </div>
                </div>
                <div class="debt-modal-footer">
                    <button class="debt-btn debt-btn-secondary" onclick="debtModule.closeModal()">Batal</button>
                    <button class="debt-btn debt-btn-primary" onclick="debtModule.saveNewDebt()">Simpan Hutang</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const today = new Date();
        today.setDate(today.getDate() + 30);
        setTimeout(() => {
            modal.classList.add('active');
            document.getElementById('addDueDate').value = today.toISOString().split('T')[0];
        }, 10);
    },

    addItemField() {
        const container = document.getElementById('addDebtItems');
        const index = this.itemCount++;
        const div = document.createElement('div');
        div.className = 'debt-item-input';
        div.innerHTML = `
            <div class="debt-item-header-row">
                <input type="text" class="debt-form-input" placeholder="Nama produk" id="itemName${index}">
                <button class="debt-remove-item" onclick="this.closest('.debt-item-input').remove(); debtModule.calculateTotal();">✕</button>
            </div>
            <div class="debt-item-row">
                <input type="number" class="debt-form-input" placeholder="Qty" id="itemQty${index}" value="1" min="1" onchange="debtModule.calculateTotal()">
                <input type="number" class="debt-form-input" placeholder="Harga" id="itemPrice${index}" onchange="debtModule.calculateTotal()">
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

        if (!customerName || !dueDate) {
            this.showToast('Nama pelanggan dan tanggal jatuh tempo wajib diisi!', 'error');
            return;
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
            payments: dp > 0 ? [{
                date: new Date().toISOString(),
                amount: dp,
                method: 'cash',
                note: 'DP/ Pembayaran awal'
            }] : []
        };

        this.debts.push(newDebt);
        this.saveDebts();
        this.closeModal();
        this.render();
        this.showToast(`Hutang ${customerName} sebesar ${this.formatRupiah(total)} tersimpan`, 'success');
        this.itemCount = 1;
    },

    confirmDelete(debtId) {
        if (!confirm('Yakin ingin menghapus hutang ini?')) return;
        this.deleteDebt(debtId);
    },

    deleteDebt(debtId) {
        const index = this.debts.findIndex(d => d.id === debtId);
        if (index === -1) return;
        this.debts.splice(index, 1);
        this.saveDebts();
        this.render();
        this.showToast('Hutang berhasil dihapus!', 'success');
    },

    openPaymentModal(debtId) {
        const debt = this.debts.find(d => d.id === debtId);
        if (!debt) return;
        const remaining = debt.total - debt.paid;

        const modal = document.createElement('div');
        modal.className = 'debt-modal-overlay';
        modal.id = 'paymentModal';
        modal.innerHTML = `
            <div class="debt-modal">
                <div class="debt-modal-header">
                    <div class="debt-modal-title">💰 Pembayaran Hutang</div>
                    <button class="debt-modal-close" onclick="debtModule.closeModal()">✕</button>
                </div>
                <div class="debt-modal-body">
                    <div class="debt-amount-display">
                        <div class="debt-amount-label">Sisa Hutang</div>
                        <div class="debt-amount-value">${this.formatRupiah(remaining)}</div>
                    </div>
                    <div class="debt-form-group">
                        <label class="debt-form-label">Jumlah Pembayaran</label>
                        <input type="number" class="debt-form-input" id="paymentAmount" value="${remaining}" max="${remaining}" min="1">
                    </div>
                    <div class="debt-form-group">
                        <label class="debt-form-label">Catatan</label>
                        <input type="text" class="debt-form-input" id="paymentNote" placeholder="Opsional">
                    </div>
                </div>
                <div class="debt-modal-footer">
                    <button class="debt-btn debt-btn-secondary" onclick="debtModule.closeModal()">Batal</button>
                    <button class="debt-btn debt-btn-primary" onclick="debtModule.processPayment('${debtId}')">Konfirmasi</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);
    },

    processPayment(debtId) {
        const amount = parseInt(document.getElementById('paymentAmount').value) || 0;
        const note = document.getElementById('paymentNote').value;
        const debt = this.debts.find(d => d.id === debtId);
        if (!debt) return;

        const remaining = debt.total - debt.paid;
        if (amount <= 0 || amount > remaining) {
            this.showToast('Jumlah pembayaran tidak valid!', 'error');
            return;
        }

        debt.paid += amount;
        if (debt.paid >= debt.total) {
            debt.status = 'paid';
            debt.paidDate = new Date().toISOString().split('T')[0];
        }

        if (!debt.payments) debt.payments = [];
        debt.payments.push({
            date: new Date().toISOString(),
            amount: amount,
            note: note
        });

        this.saveDebts();
        this.closeModal();
        this.render();
        this.showToast(`Pembayaran ${this.formatRupiah(amount)} berhasil!`, 'success');
    },

    payAll(customerName) {
        const customerDebts = this.debts.filter(d => d.customerName === customerName && d.status !== 'paid');
        const totalRemaining = customerDebts.reduce((sum, d) => sum + (d.total - d.paid), 0);
        
        if (!confirm(`Bayar semua hutang ${customerName} sebesar ${this.formatRupiah(totalRemaining)}?`)) return;

        customerDebts.forEach(debt => {
            debt.paid = debt.total;
            debt.status = 'paid';
            debt.paidDate = new Date().toISOString().split('T')[0];
        });

        this.saveDebts();
        this.render();
        this.showToast(`Semua hutang ${customerName} dilunaskan!`, 'success');
    },

    viewPaidHistory(customerName) {
        const customerDebts = this.debts.filter(d => d.customerName === customerName && d.status === 'paid');
        const totalPaid = customerDebts.reduce((sum, d) => sum + d.total, 0);

        const modal = document.createElement('div');
        modal.className = 'debt-modal-overlay';
        modal.id = 'paidHistoryModal';
        modal.innerHTML = `
            <div class="debt-modal" style="max-width: 500px;">
                <div class="debt-modal-header">
                    <div class="debt-modal-title">📋 Riwayat Lunas - ${customerName}</div>
                    <button class="debt-modal-close" onclick="debtModule.closeModal()">✕</button>
                </div>
                <div class="debt-modal-body">
                    <div class="debt-amount-display success">
                        <div class="debt-amount-label">Total Sudah Dibayar</div>
                        <div class="debt-amount-value">${this.formatRupiah(totalPaid)}</div>
                    </div>
                    <div class="debt-history-list">
                        ${customerDebts.map(debt => `
                            <div class="debt-history-item">
                                <div class="debt-history-header">
                                    <span>#${debt.id}</span>
                                    <span>${this.formatDate(debt.paidDate)}</span>
                                </div>
                                <div class="debt-history-amount">${this.formatRupiah(debt.total)}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="debt-modal-footer">
                    <button class="debt-btn debt-btn-secondary" onclick="debtModule.closeModal()">Tutup</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);
    },

    viewDetail(debtId) {
        const debt = this.debts.find(d => d.id === debtId);
        if (!debt) return;
        
        const modal = document.createElement('div');
        modal.className = 'debt-modal-overlay';
        modal.id = 'detailModal';
        modal.innerHTML = `
            <div class="debt-modal">
                <div class="debt-modal-header">
                    <div class="debt-modal-title">Detail Hutang #${debt.id}</div>
                    <button class="debt-modal-close" onclick="debtModule.closeModal()">✕</button>
                </div>
                <div class="debt-modal-body">
                    <div class="debt-form-group">
                        <label>Pelanggan: ${debt.customerName}</label>
                    </div>
                    <div class="debt-form-group">
                        <label>Total: ${this.formatRupiah(debt.total)}</label>
                    </div>
                    <div class="debt-form-group">
                        <label>Dibayar: ${this.formatRupiah(debt.paid)}</label>
                    </div>
                    <div class="debt-form-group">
                        <label>Sisa: ${this.formatRupiah(debt.total - debt.paid)}</label>
                    </div>
                </div>
                <div class="debt-modal-footer">
                    <button class="debt-btn debt-btn-secondary" onclick="debtModule.closeModal()">Tutup</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);
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
        const modal = document.querySelector('.debt-modal-overlay.active');
        if (modal) {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        }
    },

    showToast(message, type = 'success') {
        if (typeof app !== 'undefined' && app.showToast) {
            app.showToast(message);
        } else {
            alert(message);
        }
    }
};

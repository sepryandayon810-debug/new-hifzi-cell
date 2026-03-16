/**
 * HIFZI CELL - Debt Module (Hutang/Piutang)
 * Mengelola daftar hutang dengan kontrol kas masuk/keluar
 * + Fitur Autocomplete Nama Pelanggan
 */

const debtModule = {
    debts: [],
    currentFilter: 'all',
    searchQuery: '',
    expandedGroups: new Set(),
    showPaidDebts: false,
    itemCount: 1,

    // Inisialisasi modul
    init() {
        console.log('Debt module initialized');
        this.loadDebts();
        this.render();
    },

    // Load data hutang dari localStorage
    loadDebts() {
        const stored = localStorage.getItem('hifzi_debts');
        if (stored) {
            this.debts = JSON.parse(stored);
        } else {
            this.debts = this.getDummyData();
            this.saveDebts();
        }
    },

    // Simpan data hutang
    saveDebts() {
        localStorage.setItem('hifzi_debts', JSON.stringify(this.debts));
    },

    // Data dummy untuk demo
    getDummyData() {
        return [
            {
                id: 'H001',
                customerName: 'Budi Santoso',
                customerPhone: '081234567890',
                date: '2024-03-15',
                dueDate: '2024-04-15',
                items: [
                    { name: 'iPhone 14 Pro', qty: 1, price: 15000000 },
                    { name: 'Case iPhone', qty: 1, price: 150000 }
                ],
                total: 15150000,
                paid: 5000000,
                status: 'pending',
                notes: 'DP 5 juta, sisanya bulan depan',
                reduceCash: true
            },
            {
                id: 'H002',
                customerName: 'Ani Wijaya',
                customerPhone: '082345678901',
                date: '2024-03-12',
                dueDate: '2024-04-12',
                items: [
                    { name: 'Xiaomi 14', qty: 1, price: 8000000 }
                ],
                total: 8000000,
                paid: 0,
                status: 'pending',
                notes: 'Hutang tanpa DP',
                reduceCash: false
            }
        ];
    },

    // ============================================
    // FITUR BARU: Get unique customers untuk autocomplete
    // ============================================
    
    getUniqueCustomers() {
        const customers = {};
        this.debts.forEach(debt => {
            if (!customers[debt.customerName]) {
                customers[debt.customerName] = {
                    name: debt.customerName,
                    phone: debt.customerPhone
                };
            }
        });
        return Object.values(customers);
    },

    // Toggle tampilkan hutang lunas
    toggleShowPaid() {
        this.showPaidDebts = !this.showPaidDebts;
        this.render();
    },

    // Set filter
    setFilter(filter) {
        this.currentFilter = filter;
        this.render();
    },

    // Search handler
    handleSearch(query) {
        this.searchQuery = query.toLowerCase();
        this.render();
    },

    // Generate ID baru
    generateId() {
        const maxId = this.debts.reduce((max, d) => {
            const num = parseInt(d.id.replace('H', ''));
            return num > max ? num : max;
        }, 0);
        return `H${String(maxId + 1).padStart(3, '0')}`;
    },

    // Group debts by customer name
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

    // Get summary statistics
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

        return { 
            totalDebt, 
            totalPaid, 
            totalRemaining, 
            activeRemaining,
            overdueCount, 
            paidCount,
            customerCount 
        };
    },

    // Toggle group expansion
    toggleGroup(customerName) {
        if (this.expandedGroups.has(customerName)) {
            this.expandedGroups.delete(customerName);
        } else {
            this.expandedGroups.add(customerName);
        }
        this.renderGroups();
    },

    // Render main view
    render() {
        const container = document.getElementById('mainContent');
        if (!container) {
            console.error('mainContent not found');
            return;
        }

        const summary = this.getSummary();
        const groupedDebts = this.getGroupedDebts();

        container.innerHTML = `
            <div class="debt-container">
                <!-- Summary Cards -->
                <div class="debt-summary">
                    <div class="debt-card">
                        <div class="debt-card-label">Total Piutang Aktif</div>
                        <div class="debt-card-value">${this.formatRupiah(summary.activeRemaining)}</div>
                        <div class="debt-card-sub">${summary.customerCount} pelanggan aktif</div>
                    </div>
                    <div class="debt-card success">
                        <div class="debt-card-label">Sudah Dibayar</div>
                        <div class="debt-card-value">${this.formatRupiah(summary.totalPaid)}</div>
                        <div class="debt-card-sub">${summary.paidCount} lunas</div>
                    </div>
                    <div class="debt-card warning">
                        <div class="debt-card-label">Sisa Piutang</div>
                        <div class="debt-card-value">${this.formatRupiah(summary.totalRemaining)}</div>
                        <div class="debt-card-sub">${summary.overdueCount} overdue</div>
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

    // Format rupiah helper
    formatRupiah(amount) {
        return 'Rp ' + amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    },

    // Format date helper
    formatDate(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    },

    // Render groups HTML
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
                                    <span class="debt-meta-item">📱 ${group.customerPhone}</span>
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
                                        title="Kirim WA">💬</button>
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

    // Re-render only groups
    renderGroups() {
        const container = document.getElementById('debtGroups');
        if (!container) return;
        
        const groupedDebts = this.getGroupedDebts();
        container.innerHTML = this.renderGroupsHTML(groupedDebts);
    },

    // Render individual debt item
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

    // ============================================
    // MODAL TAMBAH HUTANG BARU - DENGAN AUTOCOMPLETE
    // ============================================
    
    openAddDebtModal() {
        this.itemCount = 1;
        const customers = this.getUniqueCustomers();
        
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
                    
                    <!-- AUTOCOMPLETE NAMA PELANGGAN -->
                    <div class="debt-form-group" style="position: relative;">
                        <label class="debt-form-label">Nama Pelanggan *</label>
                        <input type="text" 
                               class="debt-form-input" 
                               id="addCustomerName" 
                               placeholder="Ketik nama atau pilih dari daftar..."
                               autocomplete="off"
                               oninput="debtModule.handleNameInput(this.value)"
                               onfocus="debtModule.showCustomerList()">
                        
                        <!-- Dropdown list pelanggan -->
                        <div id="customerList" class="customer-autocomplete-list" style="display: none;">
                            ${customers.length > 0 ? `
                                <div class="customer-list-header">
                                    📋 Pelanggan yang pernah input:
                                </div>
                                ${customers.map(c => `
                                    <div class="customer-list-item" onclick="debtModule.selectCustomer('${c.name}', '${c.phone}')">
                                        <div class="customer-list-name">${c.name}</div>
                                        <div class="customer-list-phone">📱 ${c.phone}</div>
                                    </div>
                                `).join('')}
                            ` : `
                                <div class="customer-list-empty">
                                    Belum ada data pelanggan
                                </div>
                            `}
                        </div>
                    </div>
                    
                    <div class="debt-form-group">
                        <label class="debt-form-label">No. Telepon *</label>
                        <input type="text" class="debt-form-input" id="addCustomerPhone" placeholder="0812-3456-7890">
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
                        <span>➕</span> Tambah Produk Lain
                    </button>

                    <div class="debt-total-section">
                        <div class="debt-total-row">
                            <span>Total Hutang:</span>
                            <span id="addDebtTotal" class="debt-total-amount">${this.formatRupiah(0)}</span>
                        </div>
                    </div>

                    <div class="debt-section-title">💰 Pembayaran (Opsional)</div>
                    <div class="debt-form-group">
                        <label class="debt-form-label">DP / Pembayaran Awal</label>
                        <input type="number" class="debt-form-input" id="addDP" placeholder="0" value="0" onchange="debtModule.calculateTotal()">
                    </div>

                    <!-- PILIHAN PENGURANGAN KAS -->
                    <div class="debt-cash-option ${this.getCurrentCash() < 0 ? 'warning' : ''}">
                        <div class="debt-cash-option-title">📉 Pengaruh ke Kas/Laci?</div>
                        <div class="debt-cash-current">
                            Kas saat ini: <strong>${this.formatRupiah(this.getCurrentCash())}</strong>
                        </div>
                        <div class="debt-cash-option-desc">
                            Pilih apakah hutang ini akan mengurangi saldo kas toko (barang keluar tanpa uang masuk)
                        </div>
                        <div class="debt-cash-toggle">
                            <label class="debt-cash-radio">
                                <input type="radio" name="reduceCash" value="yes" checked onchange="debtModule.updateCashPreview()">
                                <span class="debt-cash-radio-box">
                                    <span class="debt-cash-radio-icon">✓</span>
                                </span>
                                <span class="debt-cash-radio-label">
                                    <strong>Ya, Kurangi Kas</strong>
                                    <small>Barang keluar, uang belum masuk (Kas berkurang)</small>
                                </span>
                            </label>
                            <label class="debt-cash-radio">
                                <input type="radio" name="reduceCash" value="no" onchange="debtModule.updateCashPreview()">
                                <span class="debt-cash-radio-box">
                                    <span class="debt-cash-radio-icon">✗</span>
                                </span>
                                <span class="debt-cash-radio-label">
                                    <strong>Tidak, Jangan Kurangi Kas</strong>
                                    <small>Barang keluar, tapi kas tetap (DP sudah masuk/piutang luar)</small>
                                </span>
                            </label>
                        </div>
                        <div class="debt-cash-preview" id="cashPreview">
                            <!-- Preview perubahan kas akan muncul di sini -->
                        </div>
                    </div>

                    <div class="debt-section-title">📅 Jatuh Tempo</div>
                    <div class="debt-form-group">
                        <label class="debt-form-label">Tanggal Jatuh Tempo *</label>
                        <input type="date" class="debt-form-input" id="addDueDate">
                    </div>

                    <div class="debt-section-title">📝 Catatan</div>
                    <div class="debt-form-group">
                        <textarea class="debt-form-input" id="addNotes" rows="2" placeholder="Tambahkan catatan..."></textarea>
                    </div>

                </div>
                <div class="debt-modal-footer">
                    <button class="debt-btn debt-btn-secondary" onclick="debtModule.closeModal()">Batal</button>
                    <button class="debt-btn debt-btn-primary" onclick="debtModule.saveNewDebt()">
                        Simpan Hutang
                    </button>
                </div>
            </div>
        `;
        
        // Tambahkan CSS untuk autocomplete
        this.addAutocompleteStyles();
        
        const today = new Date();
        today.setDate(today.getDate() + 30);
        document.body.appendChild(modal);
        
        setTimeout(() => {
            modal.classList.add('active');
            document.getElementById('addDueDate').value = today.toISOString().split('T')[0];
            this.updateCashPreview();
        }, 10);
    },

    // ============================================
    // FUNGSI AUTOCOMPLETE
    // ============================================
    
    addAutocompleteStyles() {
        // Cek jika style sudah ada
        if (document.getElementById('autocomplete-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'autocomplete-styles';
        style.textContent = `
            .customer-autocomplete-list {
                position: absolute;
                top: 100%;
                left: 0;
                right: 0;
                background: white;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                max-height: 200px;
                overflow-y: auto;
                z-index: 1000;
                margin-top: 4px;
            }
            
            .customer-list-header {
                padding: 8px 12px;
                background: #f1f5f9;
                font-size: 12px;
                color: #64748b;
                font-weight: 600;
                border-bottom: 1px solid #e2e8f0;
            }
            
            .customer-list-item {
                padding: 10px 12px;
                cursor: pointer;
                border-bottom: 1px solid #f1f5f9;
                transition: background 0.2s;
            }
            
            .customer-list-item:hover {
                background: #f8fafc;
            }
            
            .customer-list-item:last-child {
                border-bottom: none;
            }
            
            .customer-list-name {
                font-weight: 500;
                color: #1e293b;
                margin-bottom: 2px;
            }
            
            .customer-list-phone {
                font-size: 12px;
                color: #64748b;
            }
            
            .customer-list-empty {
                padding: 16px;
                text-align: center;
                color: #94a3b8;
                font-size: 14px;
            }
            
            .customer-highlight {
                background: #dbeafe;
                color: #1d4ed8;
                font-weight: 600;
            }
        `;
        document.head.appendChild(style);
    },

    showCustomerList() {
        const list = document.getElementById('customerList');
        if (list) list.style.display = 'block';
    },

    hideCustomerList() {
        const list = document.getElementById('customerList');
        if (list) list.style.display = 'none';
    },

    handleNameInput(value) {
        const list = document.getElementById('customerList');
        if (!list) return;
        
        const customers = this.getUniqueCustomers();
        const filtered = customers.filter(c => 
            c.name.toLowerCase().includes(value.toLowerCase())
        );
        
        if (value === '' || filtered.length === 0) {
            // Tampilkan semua jika kosong, atau pesan tidak ditemukan
            list.innerHTML = customers.length > 0 ? `
                <div class="customer-list-header">
                    📋 Pelanggan yang pernah input:
                </div>
                ${customers.map(c => `
                    <div class="customer-list-item" onclick="debtModule.selectCustomer('${c.name}', '${c.phone}')">
                        <div class="customer-list-name">${c.name}</div>
                        <div class="customer-list-phone">📱 ${c.phone}</div>
                    </div>
                `).join('')}
            ` : `
                <div class="customer-list-empty">
                    Belum ada data pelanggan
                </div>
            `;
        } else {
            // Tampilkan hasil filter dengan highlight
            list.innerHTML = `
                <div class="customer-list-header">
                    🔍 Hasil pencarian:
                </div>
                ${filtered.map(c => {
                    const regex = new RegExp(`(${value})`, 'gi');
                    const highlightedName = c.name.replace(regex, '<span class="customer-highlight">$1</span>');
                    return `
                        <div class="customer-list-item" onclick="debtModule.selectCustomer('${c.name}', '${c.phone}')">
                            <div class="customer-list-name">${highlightedName}</div>
                            <div class="customer-list-phone">📱 ${c.phone}</div>
                        </div>
                    `;
                }).join('')}
            `;
        }
        
        list.style.display = 'block';
    },

    selectCustomer(name, phone) {
        document.getElementById('addCustomerName').value = name;
        document.getElementById('addCustomerPhone').value = phone;
        this.hideCustomerList();
    },

    // Get current cash from dataManager
    getCurrentCash() {
        if (typeof dataManager !== 'undefined' && dataManager.data) {
            return dataManager.data.settings.currentCash || 0;
        }
        return 0;
    },

    // Update preview perubahan kas
    updateCashPreview() {
        const total = this.calculateTotalOnly();
        const dp = parseInt(document.getElementById('addDP')?.value) || 0;
        const reduceCash = document.querySelector('input[name="reduceCash"]:checked')?.value === 'yes';
        const currentCash = this.getCurrentCash();
        
        const previewDiv = document.getElementById('cashPreview');
        if (!previewDiv) return;

        if (reduceCash) {
            const newCash = currentCash - (total - dp);
            const isNegative = newCash < 0;
            
            previewDiv.innerHTML = `
                <div class="debt-cash-calculation ${isNegative ? 'negative' : ''}">
                    <div class="calc-row">
                        <span>Kas saat ini:</span>
                        <span>${this.formatRupiah(currentCash)}</span>
                    </div>
                    <div class="calc-row minus">
                        <span>Total Hutang:</span>
                        <span>- ${this.formatRupiah(total)}</span>
                    </div>
                    ${dp > 0 ? `
                        <div class="calc-row plus">
                            <span>DP Masuk:</span>
                            <span>+ ${this.formatRupiah(dp)}</span>
                        </div>
                    ` : ''}
                    <div class="calc-row total">
                        <span>Kas setelahnya:</span>
                        <span class="${isNegative ? 'negative-amount' : ''}">${this.formatRupiah(newCash)}</span>
                    </div>
                    ${isNegative ? `
                        <div class="calc-warning">
                            ⚠️ Kas akan minus! Pastikan ada cukup uang di laci.
                        </div>
                    ` : ''}
                </div>
            `;
        } else {
            const newCash = currentCash + dp;
            previewDiv.innerHTML = `
                <div class="debt-cash-calculation">
                    <div class="calc-row">
                        <span>Kas saat ini:</span>
                        <span>${this.formatRupiah(currentCash)}</span>
                    </div>
                    <div class="calc-row info">
                        <span>Mode:</span>
                        <span>Tidak mengurangi kas</span>
                    </div>
                    ${dp > 0 ? `
                        <div class="calc-row plus">
                            <span>DP Masuk:</span>
                            <span>+ ${this.formatRupiah(dp)}</span>
                        </div>
                    ` : ''}
                    <div class="calc-row total">
                        <span>Kas setelahnya:</span>
                        <span>${this.formatRupiah(newCash)}</span>
                    </div>
                </div>
            `;
        }
    },

    // Hitung total tanpa update UI
    calculateTotalOnly() {
        let total = 0;
        for (let i = 0; i < this.itemCount; i++) {
            const qty = parseInt(document.getElementById(`itemQty${i}`)?.value) || 0;
            const price = parseInt(document.getElementById(`itemPrice${i}`)?.value) || 0;
            total += qty * price;
        }
        return total;
    },

    addItemField() {
        const container = document.getElementById('addDebtItems');
        const index = this.itemCount++;
        
        const div = document.createElement('div');
        div.className = 'debt-item-input';
        div.innerHTML = `
            <div class="debt-item-header-row">
                <input type="text" class="debt-form-input" placeholder="Nama produk" id="itemName${index}">
                <button class="debt-remove-item" onclick="this.closest('.debt-item-input').remove(); debtModule.calculateTotal(); debtModule.updateCashPreview();">✕</button>
            </div>
            <div class="debt-item-row">
                <input type="number" class="debt-form-input" placeholder="Qty" id="itemQty${index}" value="1" min="1" onchange="debtModule.calculateTotal(); debtModule.updateCashPreview();">
                <input type="number" class="debt-form-input" placeholder="Harga" id="itemPrice${index}" onchange="debtModule.calculateTotal(); debtModule.updateCashPreview();">
            </div>
        `;
        container.appendChild(div);
        this.updateCashPreview();
    },

    calculateTotal() {
        const total = this.calculateTotalOnly();
        document.getElementById('addDebtTotal').textContent = this.formatRupiah(total);
        this.updateCashPreview();
        return total;
    },

    saveNewDebt() {
        const customerName = document.getElementById('addCustomerName').value.trim();
        const customerPhone = document.getElementById('addCustomerPhone').value.trim();
        const dueDate = document.getElementById('addDueDate').value;
        const dp = parseInt(document.getElementById('addDP').value) || 0;
        const notes = document.getElementById('addNotes').value.trim();
        const reduceCash = document.querySelector('input[name="reduceCash"]:checked').value === 'yes';

        if (!customerName || !customerPhone || !dueDate) {
            this.showToast('Nama dan tanggal jatuh tempo wajib diisi!', 'error');
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

        // Cek kas cukup jika mengurangi kas
        if (reduceCash) {
            const currentCash = this.getCurrentCash();
            const cashNeeded = total - dp;
            
            if (currentCash < cashNeeded) {
                if (!confirm(`⚠️ Peringatan!\n\nKas saat ini: ${this.formatRupiah(currentCash)}\nYang dibutuhkan: ${this.formatRupiah(cashNeeded)}\n\nKas akan menjadi MINUS (${this.formatRupiah(currentCash - cashNeeded)})\n\nLanjutkan?`)) {
                    return;
                }
            }
        }

        const newDebt = {
            id: this.generateId(),
            customerName,
            customerPhone,
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
                addToCash: true
            }] : []
        };

        // PROSES PENGURANGAN KAS
        if (reduceCash && typeof dataManager !== 'undefined') {
            if (!this.data) this.data = dataManager.data;
            
            this.data.settings.currentCash -= total;
            
            if (dp > 0) {
                this.data.settings.currentCash += dp;
            }
            
            dataManager.save();
            
            if (typeof app !== 'undefined') {
                app.updateHeader();
            }
            
            const cashTransaction = {
                id: Date.now(),
                date: new Date().toISOString(),
                type: 'out',
                category: 'debt_create',
                description: `Hutang baru ${customerName} - ${newDebt.id}`,
                amount: total - dp,
                balance: this.data.settings.currentCash
            };
            
            if (!this.data.cashTransactions) this.data.cashTransactions = [];
            this.data.cashTransactions.push(cashTransaction);
            dataManager.save();
        } else if (dp > 0 && !reduceCash) {
            if (!this.data) this.data = dataManager.data;
            this.data.settings.currentCash += dp;
            dataManager.save();
            
            if (typeof app !== 'undefined') {
                app.updateHeader();
            }
        }

        this.debts.push(newDebt);
        this.saveDebts();
        this.closeModal();
        this.render();
        
        let msg = `Hutang ${customerName} sebesar ${this.formatRupiah(total)} tersimpan`;
        if (reduceCash) {
            msg += ` (Kas berkurang ${this.formatRupiah(total - dp)})`;
        } else {
            msg += ` (Tidak kurangi kas)`;
        }
        if (dp > 0) msg += ` - DP: ${this.formatRupiah(dp)}`;
        
        this.showToast(msg, 'success');
        this.itemCount = 1;
    },

    // ============================================
    // HAPUS HUTANG
    // ============================================
    
    confirmDelete(debtId) {
        const debt = this.debts.find(d => d.id === debtId);
        if (!debt) return;

        const modal = document.createElement('div');
        modal.className = 'debt-modal-overlay';
        modal.id = 'deleteModal';
        modal.innerHTML = `
            <div class="debt-modal" style="max-width: 400px;">
                <div class="debt-modal-header" style="background: #fee2e2;">
                    <div class="debt-modal-title" style="color: #dc2626;">⚠️ Hapus Hutang</div>
                    <button class="debt-modal-close" onclick="debtModule.closeModal()">✕</button>
                </div>
                <div class="debt-modal-body">
                    <div style="text-align: center; padding: 20px 0;">
                        <div style="font-size: 64px; margin-bottom: 16px;">🗑️</div>
                        <p style="font-size: 16px; color: #1e293b; margin-bottom: 8px;">
                            Yakin ingin menghapus hutang ini?
                        </p>
                        <p style="font-size: 14px; color: #64748b;">
                            <strong>#${debt.id}</strong> - ${debt.customerName}<br>
                            Total: ${this.formatRupiah(debt.total)}<br>
                            ${debt.reduceCash ? '<span style="color: #dc2626;">⚠️ Hutang ini mengurangi kas</span>' : ''}
                        </p>
                        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; margin-top: 16px;">
                            <p style="font-size: 13px; color: #dc2626; margin: 0;">
                                ⚠️ Tindakan ini tidak dapat dibatalkan!
                            </p>
                        </div>
                    </div>
                </div>
                <div class="debt-modal-footer">
                    <button class="debt-btn debt-btn-secondary" onclick="debtModule.closeModal()">Batal</button>
                    <button class="debt-btn" style="background: #dc2626; color: white;" onclick="debtModule.deleteDebt('${debtId}')">
                        Ya, Hapus
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);
    },

    deleteDebt(debtId) {
        const debt = this.debts.find(d => d.id === debtId);
        if (!debt) return;

        const isDummyData = ['H001', 'H002'].includes(debtId);
        const remaining = debt.total - debt.paid;
        
        if (debt.reduceCash && remaining > 0 && !isDummyData && typeof dataManager !== 'undefined') {
            if (!this.data) this.data = dataManager.data;
            
            this.data.settings.currentCash += remaining;
            
            dataManager.save();
            
            if (typeof app !== 'undefined') {
                app.updateHeader();
            }
            
            const cashTransaction = {
                id: Date.now(),
                date: new Date().toISOString(),
                type: 'in',
                category: 'debt_cancel',
                description: `Pembatalan hutang ${debt.customerName} - ${debt.id}`,
                amount: remaining,
                balance: this.data.settings.currentCash
            };
            
            if (!this.data.cashTransactions) this.data.cashTransactions = [];
            this.data.cashTransactions.push(cashTransaction);
            dataManager.save();
            
            this.showToast(`Hutang dihapus & kas dikembalikan ${this.formatRupiah(remaining)}`, 'success');
        } else {
            this.showToast('Hutang berhasil dihapus!', 'success');
        }

        const index = this.debts.findIndex(d => d.id === debtId);
        if (index === -1) return;

        this.debts.splice(index, 1);
        this.saveDebts();
        this.closeModal();
        this.render();
    },

    // ============================================
    // PEMBAYARAN HUTANG
    // ============================================
    
    openPaymentModal(debtId) {
        const debt = this.debts.find(d => d.id === debtId);
        if (!debt) return;

        const remaining = debt.total - debt.paid;
        const currentCash = this.getCurrentCash();
        
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
                        <label class="debt-form-label">Nama Pelanggan</label>
                        <input type="text" class="debt-form-input" value="${debt.customerName}" readonly>
                    </div>
                    
                    <div class="debt-form-group">
                        <label class="debt-form-label">No. Telepon</label>
                        <input type="text" class="debt-form-input" value="${debt.customerPhone}" readonly>
                    </div>
                    
                    <div class="debt-form-group">
                        <label class="debt-form-label">Jumlah Pembayaran</label>
                        <input type="number" class="debt-form-input" id="paymentAmount" 
                               value="${remaining}" max="${remaining}" min="1">
                    </div>
                    
                    <div class="debt-form-group">
                        <label class="debt-form-label">Metode Pembayaran</label>
                        <select class="debt-form-select" id="paymentMethod">
                            <option value="cash">💵 Tunai</option>
                            <option value="transfer">🏦 Transfer Bank</option>
                            <option value="qris">📱 QRIS</option>
                            <option value="ewallet">💳 E-Wallet</option>
                        </select>
                    </div>

                    <div class="debt-cash-option">
                        <div class="debt-cash-option-title">📈 Tambah ke Kas/Laci?</div>
                        <div class="debt-cash-current">
                            Kas saat ini: <strong>${this.formatRupiah(currentCash)}</strong>
                        </div>
                        <div class="debt-cash-option-desc">
                            Pilih apakah uang pembayaran ini akan ditambahkan ke saldo kas toko
                        </div>
                        <div class="debt-cash-toggle">
                            <label class="debt-cash-radio">
                                <input type="radio" name="addToCash" value="yes" checked onchange="debtModule.updatePaymentCashPreview(${remaining})">
                                <span class="debt-cash-radio-box">
                                    <span class="debt-cash-radio-icon">✓</span>
                                </span>
                                <span class="debt-cash-radio-label">
                                    <strong>Ya, Tambah ke Kas</strong>
                                    <small>Uang masuk ke laci/kas toko</small>
                                </span>
                            </label>
                            <label class="debt-cash-radio">
                                <input type="radio" name="addToCash" value="no" onchange="debtModule.updatePaymentCashPreview(${remaining})">
                                <span class="debt-cash-radio-box">
                                    <span class="debt-cash-radio-icon">✗</span>
                                </span>
                                <span class="debt-cash-radio-label">
                                    <strong>Tidak, Hanya Catat</strong>
                                    <small>Uang tidak masuk kas (transfer ke rekening pribadi, dll)</small>
                                </span>
                            </label>
                        </div>
                        <div class="debt-cash-preview" id="paymentCashPreview">
                        </div>
                    </div>
                    
                    <div class="debt-form-group">
                        <label class="debt-form-label">Catatan (Opsional)</label>
                        <input type="text" class="debt-form-input" id="paymentNote" placeholder="Tambahkan catatan...">
                    </div>
                </div>
                <div class="debt-modal-footer">
                    <button class="debt-btn debt-btn-secondary" onclick="debtModule.closeModal()">Batal</button>
                    <button class="debt-btn debt-btn-primary" onclick="debtModule.processPayment('${debtId}')">
                        Konfirmasi Pembayaran
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        setTimeout(() => {
            modal.classList.add('active');
            this.updatePaymentCashPreview(remaining);
        }, 10);
    },

    updatePaymentCashPreview(remaining) {
        const addToCash = document.querySelector('input[name="addToCash"]:checked')?.value === 'yes';
        const currentCash = this.getCurrentCash();
        const previewDiv = document.getElementById('paymentCashPreview');
        
        if (!previewDiv) return;

        if (addToCash) {
            const newCash = currentCash + remaining;
            previewDiv.innerHTML = `
                <div class="debt-cash-calculation">
                    <div class="calc-row">
                        <span>Kas saat ini:</span>
                        <span>${this.formatRupiah(currentCash)}</span>
                    </div>
                    <div class="calc-row plus">
                        <span>Pembayaran:</span>
                        <span>+ ${this.formatRupiah(remaining)}</span>
                    </div>
                    <div class="calc-row total">
                        <span>Kas setelahnya:</span>
                        <span class="positive-amount">${this.formatRupiah(newCash)}</span>
                    </div>
                </div>
            `;
        } else {
            previewDiv.innerHTML = `
                <div class="debt-cash-calculation">
                    <div class="calc-row">
                        <span>Kas saat ini:</span>
                        <span>${this.formatRupiah(currentCash)}</span>
                    </div>
                    <div class="calc-row info">
                        <span>Mode:</span>
                        <span>Tidak menambah kas</span>
                    </div>
                    <div class="calc-row total">
                        <span>Kas tetap:</span>
                        <span>${this.formatRupiah(currentCash)}</span>
                    </div>
                </div>
            `;
        }
    },

    processPayment(debtId) {
        const amount = parseInt(document.getElementById('paymentAmount').value) || 0;
        const method = document.getElementById('paymentMethod').value;
        const note = document.getElementById('paymentNote').value;
        const addToCash = document.querySelector('input[name="addToCash"]:checked').value === 'yes';
        
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
            method: method,
            note: note,
            addToCash: addToCash
        });

        if (addToCash && typeof dataManager !== 'undefined') {
            if (!this.data) this.data = dataManager.data;
            this.data.settings.currentCash += amount;
            dataManager.save();
            
            if (typeof app !== 'undefined') {
                app.updateHeader();
            }
            
            const cashTransaction = {
                id: Date.now(),
                date: new Date().toISOString(),
                type: 'in',
                category: 'debt_payment',
                description: `Pembayaran hutang ${debt.customerName} - ${debt.id}`,
                amount: amount,
                balance: this.data.settings.currentCash
            };
            
            if (!this.data.cashTransactions) this.data.cashTransactions = [];
            this.data.cashTransactions.push(cashTransaction);
            dataManager.save();
        }

        this.saveDebts();
        this.closeModal();
        this.render();
        
        const cashMsg = addToCash ? ' (tambah ke kas)' : ' (tidak tambah kas)';
        const lunasMsg = isFullyPaid ? ' - LUNAS!' : '';
        this.showToast(`Pembayaran ${this.formatRupiah(amount)} berhasil${cashMsg}${lunasMsg}!`, 'success');
    },

    // Bayar semua hutang customer
    payAll(customerName) {
        const customerDebts = this.debts.filter(d => 
            d.customerName === customerName && d.status !== 'paid'
        );
        
        const totalRemaining = customerDebts.reduce((sum, d) => sum + (d.total - d.paid), 0);
        const currentCash = this.getCurrentCash();
        
        const modal = document.createElement('div');
        modal.className = 'debt-modal-overlay';
        modal.id = 'payAllModal';
        modal.innerHTML = `
            <div class="debt-modal">
                <div class="debt-modal-header">
                    <div class="debt-modal-title">💰 Bayar Semua Hutang</div>
                    <button class="debt-modal-close" onclick="debtModule.closeModal()">✕</button>
                </div>
                <div class="debt-modal-body">
                    <div class="debt-amount-display">
                        <div class="debt-amount-label">Total Hutang ${customerName}</div>
                        <div class="debt-amount-value">${this.formatRupiah(totalRemaining)}</div>
                    </div>
                    
                    <div class="debt-form-group">
                        <label class="debt-form-label">Jumlah Transaksi</label>
                        <input type="text" class="debt-form-input" value="${customerDebts.length} transaksi" readonly>
                    </div>

                    <div class="debt-cash-option">
                        <div class="debt-cash-option-title">📈 Tambah ke Kas/Laci?</div>
                        <div class="debt-cash-current">
                            Kas saat ini: <strong>${this.formatRupiah(currentCash)}</strong>
                        </div>
                        <div class="debt-cash-toggle">
                            <label class="debt-cash-radio">
                                <input type="radio" name="payAllAddToCash" value="yes" checked onchange="debtModule.updatePayAllCashPreview(${totalRemaining})">
                                <span class="debt-cash-radio-box"><span class="debt-cash-radio-icon">✓</span></span>
                                <span class="debt-cash-radio-label">
                                    <strong>Ya, Tambah ke Kas</strong>
                                    <small>Kas bertambah ${this.formatRupiah(totalRemaining)}</small>
                                </span>
                            </label>
                            <label class="debt-cash-radio">
                                <input type="radio" name="payAllAddToCash" value="no" onchange="debtModule.updatePayAllCashPreview(${totalRemaining})">
                                <span class="debt-cash-radio-box"><span class="debt-cash-radio-icon">✗</span></span>
                                <span class="debt-cash-radio-label">
                                    <strong>Tidak, Hanya Catat</strong>
                                    <small>Kas tidak berubah</small>
                                </span>
                            </label>
                        </div>
                        <div class="debt-cash-preview" id="payAllCashPreview"></div>
                    </div>
                </div>
                <div class="debt-modal-footer">
                    <button class="debt-btn debt-btn-secondary" onclick="debtModule.closeModal()">Batal</button>
                    <button class="debt-btn debt-btn-primary" onclick="debtModule.processPayAll('${customerName}')">
                        Bayar Semua
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        setTimeout(() => {
            modal.classList.add('active');
            this.updatePayAllCashPreview(totalRemaining);
        }, 10);
    },

    updatePayAllCashPreview(totalRemaining) {
        const addToCash = document.querySelector('input[name="payAllAddToCash"]:checked')?.value === 'yes';
        const currentCash = this.getCurrentCash();
        const previewDiv = document.getElementById('payAllCashPreview');
        
        if (!previewDiv) return;

        if (addToCash) {
            const newCash = currentCash + totalRemaining;
            previewDiv.innerHTML = `
                <div class="debt-cash-calculation">
                    <div class="calc-row">
                        <span>Kas saat ini:</span>
                        <span>${this.formatRupiah(currentCash)}</span>
                    </div>
                    <div class="calc-row plus">
                        <span>Total Pelunasan:</span>
                        <span>+ ${this.formatRupiah(totalRemaining)}</span>
                    </div>
                    <div class="calc-row total">
                        <span>Kas setelahnya:</span>
                        <span class="positive-amount">${this.formatRupiah(newCash)}</span>
                    </div>
                </div>
            `;
        } else {
            previewDiv.innerHTML = `
                <div class="debt-cash-calculation">
                    <div class="calc-row">
                        <span>Kas saat ini:</span>
                        <span>${this.formatRupiah(currentCash)}</span>
                    </div>
                    <div class="calc-row info">
                        <span>Mode:</span>
                        <span>Tidak menambah kas</span>
                    </div>
                    <div class="calc-row total">
                        <span>Kas tetap:</span>
                        <span>${this.formatRupiah(currentCash)}</span>
                    </div>
                </div>
            `;
        }
    },

    processPayAll(customerName) {
        const customerDebts = this.debts.filter(d => 
            d.customerName === customerName && d.status !== 'paid'
        );
        
        const totalRemaining = customerDebts.reduce((sum, d) => sum + (d.total - d.paid), 0);
        const addToCash = document.querySelector('input[name="payAllAddToCash"]:checked').value === 'yes';
        
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
            if (!this.data) this.data = dataManager.data;
            this.data.settings.currentCash += totalRemaining;
            dataManager.save();
            
            if (typeof app !== 'undefined') {
                app.updateHeader();
            }
            
            const cashTransaction = {
                id: Date.now(),
                date: new Date().toISOString(),
                type: 'in',
                category: 'debt_payment',
                description: `Pelunasan semua hutang ${customerName}`,
                amount: totalRemaining,
                balance: this.data.settings.currentCash
            };
            
            if (!this.data.cashTransactions) this.data.cashTransactions = [];
            this.data.cashTransactions.push(cashTransaction);
            dataManager.save();
        }

        this.saveDebts();
        this.closeModal();
        this.render();
        
        const cashMsg = addToCash ? ' (tambah ke kas)' : ' (tidak tambah kas)';
        this.showToast(`Semua hutang ${customerName} dilunaskan${cashMsg}!`, 'success');
    },

    // Lihat riwayat lunas
    viewPaidHistory(customerName) {
        const customerDebts = this.debts.filter(d => 
            d.customerName === customerName && d.status === 'paid'
        );
        
        const totalPaid = customerDebts.reduce((sum, d) => sum + d.total, 0);
        
        const modal = document.createElement('div');
        modal.className = 'debt-modal-overlay';
        modal.id = 'paidHistoryModal';
        modal.innerHTML = `
            <div class="debt-modal" style="max-width: 600px;">
                <div class="debt-modal-header">
                    <div class="debt-modal-title">📋 Riwayat Hutang Lunas - ${customerName}</div>
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
                                    <span class="debt-history-id">#${debt.id}</span>
                                    <span class="debt-history-date">Lunas: ${this.formatDate(debt.paidDate)}</span>
                                </div>
                                <div class="debt-history-products">${debt.items.map(i => i.name).join(', ')}</div>
                                <div class="debt-history-amount">${this.formatRupiah(debt.total)}</div>
                                ${debt.reduceCash ? '<span class="debt-reduce-badge">📉 Kurangi Kas</span>' : ''}
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

    // Kirim WA
    sendWhatsApp(phone, name, amount) {
        const message = `Halo ${name},%0A%0AIni adalah pengingat pembayaran hutang Anda sebesar ${this.formatRupiah(amount)} di Hifzi Cell.%0A%0AMohon segera melakukan pembayaran. Terima kasih.%0A%0A_Hifzi Cell_`;
        let formattedPhone = phone.replace(/^0/, '62').replace(/[^0-9]/g, '');
        window.open(`https://wa.me/${formattedPhone}?text=${message}`, '_blank');
    },

    // View detail
    viewDetail(debtId) {
        const debt = this.debts.find(d => d.id === debtId);
        if (!debt) return;

        const remaining = debt.total - debt.paid;
        const isPaid = debt.status === 'paid';
        
        let paymentsHtml = '';
        if (debt.payments && debt.payments.length > 0) {
            paymentsHtml = `
                <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                    <div class="debt-form-label">Riwayat Pembayaran</div>
                    ${debt.payments.map(p => `
                        <div class="debt-payment-history-item">
                            <div class="debt-payment-info">
                                <div class="debt-payment-date">${this.formatDate(p.date)}</div>
                                <div class="debt-payment-method">${p.method} ${p.addToCash ? '✓ Tambah Kas' : '✗ Non-kas'} ${p.note ? '- ' + p.note : ''}</div>
                            </div>
                            <div class="debt-payment-amount">${this.formatRupiah(p.amount)}</div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        const cashInfo = debt.reduceCash 
            ? `<div class="debt-cash-info reduce">📉 Hutang ini mengurangi kas saat dibuat</div>` 
            : `<div class="debt-cash-info normal">📋 Hutang ini tidak mengurangi kas</div>`;

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
                    ${cashInfo}
                    
                    <div class="debt-form-group">
                        <label class="debt-form-label">Pelanggan</label>
                        <input type="text" class="debt-form-input" value="${debt.customerName}" readonly>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div class="debt-form-group">
                            <label class="debt-form-label">Tanggal</label>
                            <input type="text" class="debt-form-input" value="${this.formatDate(debt.date)}" readonly>
                        </div>
                        <div class="debt-form-group">
                            <label class="debt-form-label">${isPaid ? 'Tanggal Lunas' : 'Jatuh Tempo'}</label>
                            <input type="text" class="debt-form-input" value="${isPaid ? this.formatDate(debt.paidDate) : this.formatDate(debt.dueDate)}" readonly 
                                   style="color: ${isPaid ? '#059669' : '#dc2626'};">
                        </div>
                    </div>
                    
                    <div class="debt-form-group">
                        <label class="debt-form-label">Produk</label>
                        <div style="background: #f8fafc; padding: 12px; border-radius: 8px;">
                            ${debt.items.map(item => `
                                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                                    <span>${item.name} x${item.qty}</span>
                                    <span>${this.formatRupiah(item.price * item.qty)}</span>
                                </div>
                            `).join('')}
                            <div style="border-top: 1px solid #e2e8f0; margin-top: 8px; padding-top: 8px; display: flex; justify-content: space-between; font-weight: 700;">
                                <span>Total</span>
                                <span>${this.formatRupiah(debt.total)}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div class="debt-form-group">
                            <label class="debt-form-label">Sudah Dibayar</label>
                            <input type="text" class="debt-form-input" value="${this.formatRupiah(debt.paid)}" readonly style="color: #059669;">
                        </div>
                        <div class="debt-form-group">
                            <label class="debt-form-label">Sisa</label>
                            <input type="text" class="debt-form-input" value="${this.formatRupiah(remaining)}" readonly style="color: ${remaining > 0 ? '#dc2626' : '#059669'};">
                        </div>
                    </div>
                    
                    ${debt.notes ? `
                        <div class="debt-form-group">
                            <label class="debt-form-label">Catatan</label>
                            <input type="text" class="debt-form-input" value="${debt.notes}" readonly>
                        </div>
                    ` : ''}
                    
                    ${paymentsHtml}
                </div>
                <div class="debt-modal-footer">
                    <button class="debt-btn debt-btn-secondary" onclick="debtModule.closeModal()">Tutup</button>
                    ${!isPaid ? `
                        <button class="debt-btn debt-btn-primary" onclick="debtModule.closeModal(); debtModule.openPaymentModal('${debt.id}')">
                            Bayar Sekarang
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);
    },

    // Close modal
    closeModal() {
        const modal = document.querySelector('.debt-modal-overlay.active');
        if (modal) {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        }
    },

    // Toast
    showToast(message, type = 'success') {
        if (typeof app !== 'undefined' && app.showToast) {
            app.showToast(message);
        } else {
            alert(message);
        }
    },

    // Export Excel
    exportToExcel() {
        const data = this.debts.map(d => ({
            'ID': d.id,
            'Nama Pelanggan': d.customerName,
            'No Telepon': d.customerPhone,
            'Tanggal': d.date,
            'Jatuh Tempo': d.dueDate,
            'Total': d.total,
            'Dibayar': d.paid,
            'Sisa': d.total - d.paid,
            'Status': d.status,
            'Kurangi Kas': d.reduceCash ? 'Ya' : 'Tidak',
            'Produk': d.items.map(i => i.name).join(', '),
            'Catatan': d.notes || ''
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Hutang');
        XLSX.writeFile(wb, `Hutang_HifziCell_${new Date().toISOString().split('T')[0]}.xlsx`);
        
        this.showToast('Data hutang berhasil diexport!', 'success');
    }
};
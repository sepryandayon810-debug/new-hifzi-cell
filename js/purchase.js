// ============================================
// PURCHASE MODULE - Pembelian dari Supplier (FIXED COMPLETE + FILTER WAKTU)
// ============================================

const purchaseModule = {
    currentItems: [],
    editingPurchaseId: null,
    filterMode: 'all', // all, today, yesterday, monthly, yearly, custom
    customDateRange: { start: null, end: null },
    expandedNewPurchases: true, // State untuk expand/collapse

    init() {
        this.renderHTML();
        this.renderPurchasesList();
    },

    renderHTML() {
        document.getElementById('mainContent').innerHTML = `
            <div class="content-section active" id="purchaseSection">
                <div class="quick-actions">
                    <button class="quick-btn" onclick="purchaseModule.openAddModal()">
                        <div class="quick-icon" style="background: #e3f2fd;">🛒</div>
                        <div class="quick-text">Beli Barang</div>
                    </button>
                    <button class="quick-btn" onclick="purchaseModule.openSupplierModal()">
                        <div class="quick-icon" style="background: #e8f5e9;">🏢</div>
                        <div class="quick-text">Supplier</div>
                    </button>
                    <button class="quick-btn" onclick="purchaseModule.openHistoryModal()">
                        <div class="quick-icon" style="background: #fff3e0;">📋</div>
                        <div class="quick-text">Riwayat</div>
                    </button>
                </div>

                <!-- Filter Section -->
                <div class="card" style="margin-bottom: 15px;">
                    <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                        <span class="card-title">📊 Filter Pembelian</span>
                        <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                            <button class="filter-btn ${this.filterMode === 'today' ? 'active' : ''}" onclick="purchaseModule.setFilter('today')">📅 Hari Ini</button>
                            <button class="filter-btn ${this.filterMode === 'yesterday' ? 'active' : ''}" onclick="purchaseModule.setFilter('yesterday')">📆 Kemarin</button>
                            <button class="filter-btn ${this.filterMode === 'monthly' ? 'active' : ''}" onclick="purchaseModule.setFilter('monthly')">📈 Bulan Ini</button>
                            <button class="filter-btn ${this.filterMode === 'yearly' ? 'active' : ''}" onclick="purchaseModule.setFilter('yearly')">📊 Tahun Ini</button>
                            <button class="filter-btn ${this.filterMode === 'custom' ? 'active' : ''}" onclick="purchaseModule.toggleCustomDate()">🔧 Custom</button>
                            <button class="filter-btn ${this.filterMode === 'all' ? 'active' : ''}" onclick="purchaseModule.setFilter('all')">📋 Semua</button>
                        </div>
                    </div>
                    
                    <!-- Custom Date Range -->
                    <div id="customDateContainer" style="display: ${this.filterMode === 'custom' ? 'block' : 'none'}; padding: 15px; border-top: 1px solid #e5e7eb; background: #f9fafb;">
                        <div style="display: flex; gap: 15px; align-items: end; flex-wrap: wrap;">
                            <div class="form-group" style="flex: 1; min-width: 150px;">
                                <label style="font-size: 12px; color: #666; margin-bottom: 5px; display: block;">Dari Tanggal</label>
                                <input type="date" id="customStartDate" value="${this.customDateRange.start || ''}" 
                                       style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 8px;">
                            </div>
                            <div class="form-group" style="flex: 1; min-width: 150px;">
                                <label style="font-size: 12px; color: #666; margin-bottom: 5px; display: block;">Sampai Tanggal</label>
                                <input type="date" id="customEndDate" value="${this.customDateRange.end || ''}" 
                                       style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 8px;">
                            </div>
                            <button class="btn btn-primary" onclick="purchaseModule.applyCustomFilter()" style="padding: 8px 20px;">
                                ✓ Terapkan
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Recent Purchases with Expand/Collapse -->
                <div class="card">
                    <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;" 
                         onclick="purchaseModule.toggleNewPurchases()">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span class="card-title">📦 Pembelian Terbaru</span>
                            <span style="font-size: 12px; color: #666;" id="purchaseCount">0 faktur</span>
                            <span style="font-size: 11px; color: #10b981; background: #d1fae5; padding: 2px 8px; border-radius: 12px; font-weight: 600;" id="newPurchaseBadge">0 baru</span>
                        </div>
                        <button class="expand-btn" id="expandBtn" style="background: none; border: none; font-size: 20px; cursor: pointer; transition: transform 0.3s; ${this.expandedNewPurchases ? 'transform: rotate(180deg);' : ''}">
                            ▼
                        </button>
                    </div>
                    <div class="card-content" id="newPurchasesContainer" style="${this.expandedNewPurchases ? '' : 'display: none;'}">
                        <div id="purchasesList"></div>
                    </div>
                </div>
            </div>
        `;
        
        this.addStyles();
        this.addFilterStyles();
    },

    addStyles() {
        if (document.getElementById('purchase-module-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'purchase-module-styles';
        style.textContent = `
            .purchase-modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.6);
                backdrop-filter: blur(4px);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
                padding: 20px;
                animation: fadeIn 0.2s ease;
            }
            
            .purchase-modal-content {
                background: white;
                border-radius: 16px;
                width: 100%;
                max-width: 700px;
                max-height: 90vh;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                animation: slideUp 0.3s ease;
            }
            
            .purchase-modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px 24px;
                border-bottom: 1px solid #e5e7eb;
                background: #f9fafb;
            }
            
            .purchase-modal-title {
                font-size: 18px;
                font-weight: 700;
                color: #111827;
            }
            
            .purchase-modal-close {
                background: none;
                border: none;
                font-size: 24px;
                color: #6b7280;
                cursor: pointer;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 8px;
                transition: all 0.2s;
            }
            
            .purchase-modal-close:hover {
                background: #e5e7eb;
                color: #111827;
            }
            
            .purchase-modal-body {
                padding: 24px;
                overflow-y: auto;
                flex: 1;
            }
            
            .purchase-modal-footer {
                display: flex;
                justify-content: flex-end;
                gap: 12px;
                padding: 16px 24px;
                border-top: 1px solid #e5e7eb;
                background: #f9fafb;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            @keyframes slideUp {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
            
            .purchase-form-row {
                display: grid;
                grid-template-columns: 2fr 1fr 1fr 1fr auto;
                gap: 10px;
                align-items: center;
                padding: 12px;
                background: #f8f9fa;
                border-radius: 8px;
                margin-bottom: 8px;
            }
            
            .purchase-form-row input, 
            .purchase-form-row select {
                padding: 10px;
                border: 1px solid #d1d5db;
                border-radius: 8px;
                font-size: 14px;
                width: 100%;
            }
            
            .purchase-form-row input:focus,
            .purchase-form-row select:focus {
                outline: none;
                border-color: #667eea;
                box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
            }
            
            .purchase-form-row button {
                background: #ef4444;
                color: white;
                border: none;
                width: 36px;
                height: 36px;
                border-radius: 8px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
                transition: all 0.2s;
            }
            
            .purchase-form-row button:hover {
                background: #dc2626;
            }
            
            .purchase-summary {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 20px;
                border-radius: 12px;
                margin-top: 20px;
            }
            
            .purchase-summary-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 10px;
                font-size: 14px;
            }
            
            .purchase-summary-row.total {
                font-size: 18px;
                font-weight: 700;
                border-top: 1px solid rgba(255,255,255,0.3);
                padding-top: 10px;
                margin-top: 10px;
            }
            
            .btn-add-item {
                width: 100%;
                padding: 14px;
                background: #f3f4f6;
                border: 2px dashed #d1d5db;
                border-radius: 10px;
                cursor: pointer;
                color: #374151;
                font-size: 14px;
                font-weight: 500;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                margin-top: 10px;
            }
            
            .btn-add-item:hover {
                background: #e0e7ff;
                border-color: #667eea;
                color: #667eea;
            }
            
            .btn-add-new-product {
                width: 100%;
                padding: 12px;
                background: #ecfdf5;
                border: 2px dashed #10b981;
                border-radius: 10px;
                cursor: pointer;
                color: #059669;
                font-size: 14px;
                font-weight: 500;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                margin-bottom: 15px;
            }
            
            .btn-add-new-product:hover {
                background: #d1fae5;
                border-color: #059669;
            }
            
            .new-product-badge {
                display: inline-block;
                background: #10b981;
                color: white;
                font-size: 10px;
                padding: 2px 8px;
                border-radius: 12px;
                margin-left: 8px;
                font-weight: 600;
            }
            
            .purchase-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 16px;
                background: white;
                margin-bottom: 10px;
                border-radius: 12px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                border: 1px solid #e5e7eb;
                transition: all 0.2s ease;
                cursor: pointer;
            }
            
            .purchase-item:hover {
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                transform: translateY(-2px);
            }
            
            .purchase-info { flex: 1; }
            
            .purchase-supplier {
                font-weight: 600;
                font-size: 15px;
                margin-bottom: 4px;
                color: #111827;
            }
            
            .purchase-meta {
                font-size: 12px;
                color: #6b7280;
                display: flex;
                gap: 10px;
                flex-wrap: wrap;
            }
            
            .purchase-total {
                font-weight: 700;
                font-size: 16px;
                color: #667eea;
            }
            
            .purchase-status {
                display: inline-block;
                padding: 4px 12px;
                border-radius: 20px;
                font-size: 11px;
                font-weight: 600;
                margin-left: 8px;
            }
            
            .purchase-status.cash {
                background: #d1fae5;
                color: #065f46;
            }
            
            .purchase-status.credit {
                background: #fef3c7;
                color: #92400e;
            }
            
            .purchase-items-preview {
                margin-top: 8px;
                padding-top: 8px;
                border-top: 1px dashed #e5e7eb;
                font-size: 12px;
                color: #6b7280;
            }
            
            .supplier-card {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 16px;
                background: white;
                margin-bottom: 10px;
                border-radius: 12px;
                border: 1px solid #e5e7eb;
            }
            
            .supplier-info h4 {
                margin: 0 0 5px 0;
                font-size: 15px;
                color: #111827;
            }
            
            .supplier-info p {
                margin: 0;
                font-size: 12px;
                color: #6b7280;
            }
            
            .form-row {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 16px;
                margin-bottom: 16px;
            }
            
            .form-group {
                display: flex;
                flex-direction: column;
            }
            
            .form-group label {
                font-size: 13px;
                font-weight: 600;
                color: #374151;
                margin-bottom: 6px;
            }
            
            .form-group input,
            .form-group select {
                padding: 10px 12px;
                border: 1px solid #d1d5db;
                border-radius: 8px;
                font-size: 14px;
                background: white;
            }
            
            .form-group input:focus,
            .form-group select:focus {
                outline: none;
                border-color: #667eea;
                box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
            }
            
            .btn {
                padding: 10px 20px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
                border: none;
            }
            
            .btn-primary {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }
            
            .btn-primary:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
            }
            
            .btn-secondary {
                background: #e5e7eb;
                color: #374151;
            }
            
            .btn-secondary:hover { background: #d1d5db; }
            
            .btn-success {
                background: #10b981;
                color: white;
            }
            
            .btn-success:hover {
                background: #059669;
                transform: translateY(-1px);
            }
            
            .btn-sm {
                padding: 6px 12px;
                font-size: 12px;
                border-radius: 6px;
                border: none;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .btn-primary-sm {
                background: #e0e7ff;
                color: #4338ca;
            }
            
            .btn-primary-sm:hover { background: #c7d2fe; }
            
            .btn-danger-sm {
                background: #fee2e2;
                color: #dc2626;
            }
            
            .btn-danger-sm:hover { background: #fecaca; }
            
            .add-category-row {
                display: flex;
                gap: 10px;
                margin-bottom: 20px;
            }
            
            .add-category-input {
                flex: 1;
                padding: 10px 12px;
                border: 1px solid #d1d5db;
                border-radius: 8px;
                font-size: 14px;
            }
            
            .add-category-btn {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                width: 40px;
                height: 40px;
                border-radius: 8px;
                font-size: 20px;
                cursor: pointer;
            }
            
            .search-bar {
                display: flex;
                gap: 10px;
                margin-bottom: 15px;
            }
            
            .search-bar input {
                flex: 1;
                padding: 10px 14px;
                border: 1px solid #d1d5db;
                border-radius: 8px;
                font-size: 14px;
            }
            
            .empty-state {
                text-align: center;
                padding: 40px 20px;
                color: #6b7280;
            }
            
            .empty-icon {
                font-size: 48px;
                margin-bottom: 12px;
                opacity: 0.5;
            }
            
            .inline-new-product {
                background: #f0fdf4;
                border: 2px solid #86efac;
                border-radius: 8px;
                padding: 15px;
                margin-bottom: 10px;
            }
            
            .inline-new-product-header {
                font-weight: 600;
                color: #166534;
                margin-bottom: 10px;
                display: flex;
                align-items: center;
                gap: 8px;
            }
        `;
        document.head.appendChild(style);
    },

    // ============================================
    // FILTER STYLES - TAMBAHAN BARU
    // ============================================
    addFilterStyles() {
        if (document.getElementById('purchase-filter-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'purchase-filter-styles';
        style.textContent = `
            .filter-btn {
                padding: 6px 12px;
                border: 1px solid #e5e7eb;
                background: white;
                border-radius: 20px;
                font-size: 12px;
                cursor: pointer;
                transition: all 0.2s;
                white-space: nowrap;
            }
            
            .filter-btn:hover {
                background: #f3f4f6;
                border-color: #d1d5db;
            }
            
            .filter-btn.active {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border-color: #667eea;
            }
            
            .expand-btn {
                transition: transform 0.3s ease;
            }
            
            .expand-btn.collapsed {
                transform: rotate(0deg) !important;
            }
            
            .expand-btn.expanded {
                transform: rotate(180deg) !important;
            }
            
            #newPurchasesContainer {
                transition: all 0.3s ease;
            }
            
            .date-badge {
                display: inline-block;
                font-size: 10px;
                padding: 2px 8px;
                border-radius: 12px;
                margin-left: 8px;
                font-weight: 600;
            }
            
            .date-badge.today {
                background: #dbeafe;
                color: #1e40af;
            }
            
            .date-badge.yesterday {
                background: #fef3c7;
                color: #92400e;
            }
            
            .date-badge.this-month {
                background: #e0e7ff;
                color: #4338ca;
            }
            
            .date-badge.old {
                background: #f3f4f6;
                color: #6b7280;
            }
            
            .filter-summary {
                background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
                border: 1px solid #bae6fd;
                border-radius: 8px;
                padding: 12px 16px;
                margin-bottom: 15px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 10px;
            }
            
            .filter-summary-text {
                font-size: 14px;
                color: #0369a1;
                font-weight: 500;
            }
            
            .filter-summary-total {
                font-size: 16px;
                font-weight: 700;
                color: #0284c7;
            }
        `;
        document.head.appendChild(style);
    },

    // ============================================
    // FILTER FUNCTIONS - TAMBAHAN BARU
    // ============================================
    setFilter(mode) {
        this.filterMode = mode;
        if (mode !== 'custom') {
            this.customDateRange = { start: null, end: null };
        }
        this.renderHTML();
        this.renderPurchasesList();
    },

    toggleCustomDate() {
        if (this.filterMode === 'custom') {
            this.filterMode = 'all';
            this.customDateRange = { start: null, end: null };
        } else {
            this.filterMode = 'custom';
            // Set default range ke hari ini
            const today = new Date().toISOString().split('T')[0];
            this.customDateRange = { start: today, end: today };
        }
        this.renderHTML();
        this.renderPurchasesList();
    },

    applyCustomFilter() {
        const start = document.getElementById('customStartDate').value;
        const end = document.getElementById('customEndDate').value;
        
        if (!start || !end) {
            app.showToast('Pilih rentang tanggal terlebih dahulu!');
            return;
        }
        
        if (new Date(start) > new Date(end)) {
            app.showToast('Tanggal awal tidak boleh lebih besar dari tanggal akhir!');
            return;
        }
        
        this.customDateRange = { start, end };
        this.renderPurchasesList();
        app.showToast(`Filter: ${new Date(start).toLocaleDateString('id-ID')} - ${new Date(end).toLocaleDateString('id-ID')}`);
    },

    toggleNewPurchases() {
        this.expandedNewPurchases = !this.expandedNewPurchases;
        const container = document.getElementById('newPurchasesContainer');
        const btn = document.getElementById('expandBtn');
        
        if (this.expandedNewPurchases) {
            container.style.display = 'block';
            btn.classList.remove('collapsed');
            btn.classList.add('expanded');
            btn.style.transform = 'rotate(180deg)';
        } else {
            container.style.display = 'none';
            btn.classList.remove('expanded');
            btn.classList.add('collapsed');
            btn.style.transform = 'rotate(0deg)';
        }
    },

    getFilteredPurchases() {
        const allPurchases = dataManager.getPurchases().sort((a, b) => 
            new Date(b.date) - new Date(a.date)
        );
        
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        switch (this.filterMode) {
            case 'today':
                return allPurchases.filter(p => {
                    const pDate = new Date(p.date);
                    return pDate >= today;
                });
                
            case 'yesterday':
                return allPurchases.filter(p => {
                    const pDate = new Date(p.date);
                    return pDate >= yesterday && pDate < today;
                });
                
            case 'monthly':
                const thisMonth = now.getMonth();
                const thisYear = now.getFullYear();
                return allPurchases.filter(p => {
                    const pDate = new Date(p.date);
                    return pDate.getMonth() === thisMonth && pDate.getFullYear() === thisYear;
                });
                
            case 'yearly':
                return allPurchases.filter(p => {
                    const pDate = new Date(p.date);
                    return pDate.getFullYear() === now.getFullYear();
                });
                
            case 'custom':
                if (this.customDateRange.start && this.customDateRange.end) {
                    const start = new Date(this.customDateRange.start);
                    const end = new Date(this.customDateRange.end);
                    end.setHours(23, 59, 59, 999);
                    return allPurchases.filter(p => {
                        const pDate = new Date(p.date);
                        return pDate >= start && pDate <= end;
                    });
                }
                return allPurchases;
                
            default:
                return allPurchases;
        }
    },

    getDateBadge(purchaseDate) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const pDate = new Date(purchaseDate);
        
        if (pDate >= today) {
            return '<span class="date-badge today">HARI INI</span>';
        } else if (pDate >= yesterday && pDate < today) {
            return '<span class="date-badge yesterday">KEMARIN</span>';
        } else if (pDate.getMonth() === now.getMonth() && pDate.getFullYear() === now.getFullYear()) {
            return '<span class="date-badge this-month">BULAN INI</span>';
        } else {
            return '<span class="date-badge old">LAMA</span>';
        }
    },

    // ============================================
    // MODAL: TAMBAH PEMBELIAN BARU (FIXED)
    // ============================================
    openAddModal(purchaseId = null) {
        this.currentItems = [];
        this.editingPurchaseId = purchaseId;
        
        const suppliers = dataManager.getSuppliers();
        const products = dataManager.getProducts();
        
        let editData = null;
        if (purchaseId) {
            editData = dataManager.getPurchases().find(p => p.id === purchaseId);
            if (editData) {
                this.currentItems = editData.items.map(item => ({...item}));
            }
        }

        const modalHTML = `
            <div class="purchase-modal-overlay" id="purchaseModal">
                <div class="purchase-modal-content">
                    <div class="purchase-modal-header">
                        <span class="purchase-modal-title">${purchaseId ? '✏️ Edit' : '🛒 Tambah'} Pembelian</span>
                        <button class="purchase-modal-close" onclick="purchaseModule.closeModal('purchaseModal')">×</button>
                    </div>

                    <div class="purchase-modal-body">
                        <div class="form-row">
                            <div class="form-group">
                                <label>Supplier *</label>
                                <select id="purchaseSupplier">
                                    <option value="">-- Pilih Supplier --</option>
                                    ${suppliers.map(s => `
                                        <option value="${s.id}" ${editData?.supplierId === s.id ? 'selected' : ''}>${s.name}</option>
                                    `).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label>No. Faktur</label>
                                <input type="text" id="purchaseInvoice" placeholder="INV-001" 
                                       value="${editData?.invoiceNumber || ''}">
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label>Tanggal *</label>
                                <input type="date" id="purchaseDate" 
                                       value="${editData ? new Date(editData.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}">
                            </div>
                            <div class="form-group">
                                <label>Pembayaran *</label>
                                <select id="purchasePayment" onchange="purchaseModule.toggleCreditNote()">
                                    <option value="cash" ${editData?.paymentType === 'cash' ? 'selected' : ''}>💵 Cash / Tunai</option>
                                    <option value="credit" ${editData?.paymentType === 'credit' ? 'selected' : ''}>💳 Kredit / Hutang</option>
                                </select>
                            </div>
                        </div>

                        <div class="form-group" id="creditNoteBox" style="display: ${editData?.paymentType === 'credit' ? 'block' : 'none'}; margin-bottom: 16px;">
                            <label>Catatan Hutang (Jatuh Tempo)</label>
                            <input type="text" id="creditNote" placeholder="Contoh: Jatuh tempo 30 hari" 
                                   value="${editData?.creditNote || ''}">
                        </div>

                        <!-- Tombol Tambah Produk Baru -->
                        <button class="btn-add-new-product" onclick="purchaseModule.openAddNewProductInline()">
                            <span>➕</span> Tambah Produk Baru (Belum Ada di Database)
                        </button>

                        <!-- Daftar Produk -->
                        <div style="margin: 20px 0;">
                            <label style="display: block; margin-bottom: 10px; font-weight: 600; color: #374151;">
                                Produk Dibeli <span style="font-weight: normal; color: #6b7280; font-size: 12px;">(${this.currentItems.length} item)</span>
                            </label>
                            
                            <div id="purchaseItemsList">
                                <!-- Items akan dirender di sini -->
                            </div>

                            <button class="btn-add-item" onclick="purchaseModule.addItemRow()">
                                <span>➕</span> Tambah Produk dari Database
                            </button>
                        </div>

                        <!-- Ringkasan -->
                        <div class="purchase-summary">
                            <div class="purchase-summary-row">
                                <span>Subtotal:</span>
                                <span id="subtotalDisplay">Rp 0</span>
                            </div>
                            <div class="purchase-summary-row">
                                <span>Item:</span>
                                <span id="itemCountDisplay">0 produk</span>
                            </div>
                            <div class="purchase-summary-row total">
                                <span>TOTAL:</span>
                                <span id="totalDisplay">Rp 0</span>
                            </div>
                        </div>
                    </div>

                    <div class="purchase-modal-footer">
                        <button class="btn btn-secondary" onclick="purchaseModule.closeModal('purchaseModal')">Batal</button>
                        <button class="btn btn-primary" onclick="purchaseModule.savePurchase()">
                            💾 ${purchaseId ? 'Update' : 'Simpan'} Pembelian
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Render existing items
        if (this.currentItems.length > 0) {
            this.currentItems.forEach((item, index) => this.renderItemRow(index, item));
        }
        
        this.calculateTotal();
    },

    // ============================================
    // TAMBAH PRODUK BARU INLINE (FITUR BARU)
    // ============================================
    openAddNewProductInline() {
        // Cek apakah sudah ada form new product yang terbuka
        if (document.getElementById('newProductInlineForm')) {
            document.getElementById('newProductInlineForm').scrollIntoView({ behavior: 'smooth' });
            return;
        }

        const categories = dataManager.getCategories().filter(c => c.id !== 'all');

        const formHTML = `
            <div class="inline-new-product" id="newProductInlineForm">
                <div class="inline-new-product-header">
                    <span>✨</span> Produk Baru
                </div>
                <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr auto; gap: 10px; align-items: end;">
                    <div>
                        <label style="font-size: 12px; color: #166534; font-weight: 600;">Nama Produk *</label>
                        <input type="text" id="newProdName" placeholder="Nama produk baru" 
                               style="width: 100%; padding: 8px; border: 1px solid #86efac; border-radius: 6px;">
                    </div>
                    <div>
                        <label style="font-size: 12px; color: #166534; font-weight: 600;">Qty *</label>
                        <input type="number" id="newProdQty" value="1" min="1"
                               style="width: 100%; padding: 8px; border: 1px solid #86efac; border-radius: 6px;">
                    </div>
                    <div>
                        <label style="font-size: 12px; color: #166534; font-weight: 600;">Harga Beli *</label>
                        <input type="number" id="newProdBuyPrice" placeholder="0"
                               style="width: 100%; padding: 8px; border: 1px solid #86efac; border-radius: 6px;">
                    </div>
                    <div>
                        <label style="font-size: 12px; color: #166534; font-weight: 600;">Harga Jual *</label>
                        <input type="number" id="newProdSellPrice" placeholder="0"
                               style="width: 100%; padding: 8px; border: 1px solid #86efac; border-radius: 6px;">
                    </div>
                    <div>
                        <button onclick="purchaseModule.saveNewProductInline()" class="btn btn-success" style="padding: 8px 16px; white-space: nowrap;">
                            ✓ Tambah
                        </button>
                    </div>
                </div>
                <div style="margin-top: 10px;">
                    <label style="font-size: 12px; color: #166534; font-weight: 600;">Kategori</label>
                    <select id="newProdCategory" style="width: 100%; padding: 8px; border: 1px solid #86efac; border-radius: 6px;">
                        ${categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                    </select>
                </div>
                <div style="margin-top: 8px; font-size: 11px; color: #15803d;">
                    💡 Produk akan otomatis ditambahkan ke database dan langsung masuk ke daftar pembelian
                </div>
            </div>
        `;

        const container = document.getElementById('purchaseItemsList');
        container.insertAdjacentHTML('beforebegin', formHTML);
        
        // Focus ke nama produk
        setTimeout(() => document.getElementById('newProdName')?.focus(), 100);
    },

    saveNewProductInline() {
        const name = document.getElementById('newProdName').value.trim();
        const qty = parseInt(document.getElementById('newProdQty').value) || 1;
        const buyPrice = parseInt(document.getElementById('newProdBuyPrice').value) || 0;
        const sellPrice = parseInt(document.getElementById('newProdSellPrice').value) || 0;
        const category = document.getElementById('newProdCategory').value;

        if (!name) {
            app.showToast('Nama produk wajib diisi!');
            return;
        }
        if (buyPrice <= 0) {
            app.showToast('Harga beli wajib diisi!');
            return;
        }
        if (sellPrice <= 0) {
            app.showToast('Harga jual wajib diisi!');
            return;
        }

        // Cek apakah produk dengan nama yang sama sudah ada
        const existingProduct = dataManager.getProducts().find(p => 
            p.name.toLowerCase() === name.toLowerCase()
        );

        let productId;
        if (existingProduct) {
            if (!confirm(`Produk "${name}" sudah ada di database. Gunakan produk yang sudah ada?`)) {
                return;
            }
            productId = existingProduct.id;
            // Update harga jika berbeda
            if (existingProduct.price !== sellPrice || existingProduct.cost !== buyPrice) {
                dataManager.updateProduct(productId, {
                    price: sellPrice,
                    cost: buyPrice
                });
            }
        } else {
            // Buat produk baru
            const newProduct = {
                name: name,
                price: sellPrice,
                cost: buyPrice,
                stock: 0, // Stok akan ditambahkan saat simpan pembelian
                category: category
            };
            const savedProduct = dataManager.addProduct(newProduct);
            productId = savedProduct.id;
        }

        // Hapus form inline
        document.getElementById('newProductInlineForm')?.remove();

        // Tambahkan ke currentItems
        const index = this.currentItems.length;
        this.currentItems.push({
            productId: productId,
            qty: qty,
            buyPrice: buyPrice,
            sellPrice: sellPrice,
            isNewProduct: !existingProduct // Tandai sebagai produk baru
        });

        // Render row
        this.renderItemRow(index, this.currentItems[index]);
        this.calculateTotal();
        
        app.showToast(`Produk "${name}" ditambahkan ke daftar!`);
    },

    addItemRow() {
        const index = this.currentItems.length;
        this.currentItems.push({ 
            productId: '', 
            qty: 1, 
            buyPrice: 0, 
            sellPrice: 0 
        });
        this.renderItemRow(index);
        this.calculateTotal();
    },

    renderItemRow(index, itemData = null) {
        const products = dataManager.getProducts();
        const container = document.getElementById('purchaseItemsList');
        
        const div = document.createElement('div');
        div.className = 'purchase-form-row';
        div.id = `itemRow_${index}`;
        div.dataset.index = index; // Simpan index untuk referensi
        
        const isNewProduct = itemData?.isNewProduct;
        const product = itemData?.productId ? products.find(p => p.id === itemData.productId) : null;
        
        div.innerHTML = `
            <select onchange="purchaseModule.updateItemProduct(${index}, this.value)" ${isNewProduct ? 'disabled' : ''}>
                <option value="">-- Pilih Produk --</option>
                ${products.map(p => `
                    <option value="${p.id}" ${itemData?.productId === p.id ? 'selected' : ''}>
                        ${p.name} (Stok: ${p.stock})
                    </option>
                `).join('')}
            </select>
            <input type="number" placeholder="Qty" min="1" value="${itemData?.qty || 1}" 
                   onchange="purchaseModule.updateItemQty(${index}, this.value)">
            <input type="number" placeholder="Harga Beli" value="${itemData?.buyPrice || ''}" 
                   onchange="purchaseModule.updateItemBuyPrice(${index}, this.value)">
            <input type="number" placeholder="Harga Jual" value="${itemData?.sellPrice || ''}" 
                   onchange="purchaseModule.updateItemSellPrice(${index}, this.value)">
            <button onclick="purchaseModule.removeItem(${index})" title="Hapus">×</button>
            ${isNewProduct ? '<span class="new-product-badge">BARU</span>' : ''}
        `;
        
        container.appendChild(div);
        
        // Auto-fill harga jual jika produk dipilih dan belum diisi
        if (itemData?.productId && !itemData?.sellPrice && product) {
            this.currentItems[index].sellPrice = product.price;
            div.querySelector('input[placeholder="Harga Jual"]').value = product.price;
        }
    },

    updateItemProduct(index, productId) {
        if (!productId) return;
        
        const product = dataManager.getProducts().find(p => p.id === productId);
        if (product) {
            this.currentItems[index].productId = productId;
            this.currentItems[index].sellPrice = product.price;
            this.currentItems[index].buyPrice = product.cost || 0;
            
            const row = document.getElementById(`itemRow_${index}`);
            if (row) {
                row.querySelector('input[placeholder="Harga Jual"]').value = product.price;
                row.querySelector('input[placeholder="Harga Beli"]').value = product.cost || '';
            }
        }
        this.calculateTotal();
    },

    updateItemQty(index, qty) {
        this.currentItems[index].qty = parseInt(qty) || 1;
        this.calculateTotal();
    },

    updateItemBuyPrice(index, price) {
        this.currentItems[index].buyPrice = parseInt(price) || 0;
        this.calculateTotal();
    },

    updateItemSellPrice(index, price) {
        this.currentItems[index].sellPrice = parseInt(price) || 0;
    },

    removeItem(index) {
        this.currentItems.splice(index, 1);
        
        // Re-render semua rows
        const container = document.getElementById('purchaseItemsList');
        container.innerHTML = '';
        this.currentItems.forEach((item, idx) => {
            this.renderItemRow(idx, item);
        });
        
        this.calculateTotal();
    },

    toggleCreditNote() {
        const paymentType = document.getElementById('purchasePayment').value;
        const creditBox = document.getElementById('creditNoteBox');
        creditBox.style.display = paymentType === 'credit' ? 'block' : 'none';
    },

    calculateTotal() {
        const subtotal = this.currentItems.reduce((sum, item) => {
            return sum + ((item.buyPrice || 0) * (item.qty || 1));
        }, 0);
        
        const itemCount = this.currentItems.length;
        
        const subtotalEl = document.getElementById('subtotalDisplay');
        const itemCountEl = document.getElementById('itemCountDisplay');
        const totalEl = document.getElementById('totalDisplay');
        
        if (subtotalEl) subtotalEl.textContent = `Rp ${utils.formatNumber(subtotal)}`;
        if (itemCountEl) itemCountEl.textContent = `${itemCount} produk`;
        if (totalEl) totalEl.textContent = `Rp ${utils.formatNumber(subtotal)}`;
    },

    savePurchase() {
        const supplierId = document.getElementById('purchaseSupplier').value;
        const invoiceNumber = document.getElementById('purchaseInvoice').value.trim();
        const date = document.getElementById('purchaseDate').value;
        const paymentType = document.getElementById('purchasePayment').value;
        const creditNote = document.getElementById('creditNote')?.value.trim() || '';

        // Validasi
        if (!supplierId) {
            app.showToast('Pilih supplier terlebih dahulu!');
            return;
        }
        if (!date) {
            app.showToast('Tanggal wajib diisi!');
            return;
        }
        
        // Filter items yang valid
        const validItems = this.currentItems.filter(item => 
            item.productId && item.productId !== '' && item.qty > 0 && item.buyPrice > 0
        );
        
        if (validItems.length === 0) {
            app.showToast('Tambahkan minimal 1 produk dengan data lengkap (produk, qty, harga beli)!');
            return;
        }

        const total = validItems.reduce((sum, item) => sum + (item.buyPrice * item.qty), 0);
        const supplier = dataManager.getSuppliers().find(s => s.id === supplierId);
        
        const purchaseData = {
            supplierId,
            supplierName: supplier?.name || 'Unknown',
            invoiceNumber: invoiceNumber || `INV-${Date.now().toString().slice(-6)}`,
            date: new Date(date).toISOString(),
            paymentType,
            creditNote: paymentType === 'credit' ? creditNote : '',
            items: validItems.map(item => ({
                productId: item.productId,
                qty: item.qty,
                buyPrice: item.buyPrice,
                sellPrice: item.sellPrice
            })),
            total,
            status: paymentType === 'credit' ? 'unpaid' : 'paid'
        };

        // Update stok dan harga modal produk
        validItems.forEach(item => {
            const product = dataManager.getProducts().find(p => p.id === item.productId);
            if (product) {
                const newStock = product.stock + item.qty;
                dataManager.updateProduct(item.productId, {
                    stock: newStock,
                    cost: item.buyPrice,
                    price: item.sellPrice || product.price
                });
            }
        });

        if (this.editingPurchaseId) {
            dataManager.deletePurchase(this.editingPurchaseId);
        }
        
        dataManager.addPurchase(purchaseData);
        
        this.closeModal('purchaseModal');
        this.renderPurchasesList();
        app.showToast(this.editingPurchaseId ? 'Pembelian diupdate!' : 'Pembelian tersimpan! Stok & harga modal diupdate.');
    },

    // ============================================
    // MODAL: SUPPLIER
    // ============================================
    openSupplierModal() {
        const suppliers = dataManager.getSuppliers();

        const modalHTML = `
            <div class="purchase-modal-overlay" id="supplierModal">
                <div class="purchase-modal-content" style="max-width: 500px;">
                    <div class="purchase-modal-header">
                        <span class="purchase-modal-title">🏢 Manajemen Supplier</span>
                        <button class="purchase-modal-close" onclick="purchaseModule.closeModal('supplierModal')">×</button>
                    </div>

                    <div class="purchase-modal-body">
                        <div class="add-category-row">
                            <input type="text" class="add-category-input" id="newSupplierName" placeholder="Nama supplier...">
                            <input type="text" style="flex: 1;" id="newSupplierPhone" placeholder="No. HP/WA...">
                            <button class="add-category-btn" onclick="purchaseModule.addSupplier()">+</button>
                        </div>

                        <div id="supplierList">
                            ${suppliers.length === 0 ? `
                                <div class="empty-state">
                                    <div class="empty-icon">🏢</div>
                                    <p>Belum ada supplier</p>
                                </div>
                            ` : suppliers.map(s => `
                                <div class="supplier-card">
                                    <div class="supplier-info">
                                        <h4>${s.name}</h4>
                                        <p>📞 ${s.phone || '-'} | 📦 ${dataManager.getPurchasesBySupplier(s.id).length} pembelian</p>
                                    </div>
                                    <div style="display: flex; gap: 8px;">
                                        <button class="btn-sm btn-primary-sm" onclick="purchaseModule.editSupplier('${s.id}')">
                                            ✏️
                                        </button>
                                        <button class="btn-sm btn-danger-sm" onclick="purchaseModule.deleteSupplier('${s.id}')">
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    addSupplier() {
        const name = document.getElementById('newSupplierName').value.trim();
        const phone = document.getElementById('newSupplierPhone').value.trim();

        if (!name) {
            app.showToast('Nama supplier wajib diisi!');
            return;
        }

        dataManager.addSupplier({ name, phone, address: '' });

        document.getElementById('newSupplierName').value = '';
        document.getElementById('newSupplierPhone').value = '';
        
        this.refreshSupplierList();
        app.showToast('Supplier ditambahkan!');
    },

    editSupplier(supplierId) {
        const supplier = dataManager.getSuppliers().find(s => s.id === supplierId);
        if (!supplier) return;

        const newName = prompt('Edit nama supplier:', supplier.name);
        if (newName === null) return;
        
        const newPhone = prompt('Edit no. telepon:', supplier.phone || '');
        if (newPhone === null) return;

        if (!newName.trim()) {
            app.showToast('Nama tidak boleh kosong!');
            return;
        }

        dataManager.updateSupplier(supplierId, {
            name: newName.trim(),
            phone: newPhone.trim()
        });

        this.refreshSupplierList();
        app.showToast('Supplier diupdate!');
    },

    deleteSupplier(supplierId) {
        const purchases = dataManager.getPurchasesBySupplier(supplierId);
        if (purchases.length > 0) {
            app.showToast(`Tidak bisa hapus! Ada ${purchases.length} riwayat pembelian.`);
            return;
        }

        if (!confirm('Hapus supplier ini?')) return;

        dataManager.deleteSupplier(supplierId);
        this.refreshSupplierList();
        app.showToast('Supplier dihapus!');
    },

    refreshSupplierList() {
        this.closeModal('supplierModal');
        this.openSupplierModal();
    },

    // ============================================
    // MODAL: RIWAYAT
    // ============================================
    openHistoryModal() {
        const purchases = dataManager.getPurchases().sort((a, b) => 
            new Date(b.date) - new Date(a.date)
        );

        const modalHTML = `
            <div class="purchase-modal-overlay" id="historyModal">
                <div class="purchase-modal-content" style="max-width: 700px;">
                    <div class="purchase-modal-header">
                        <span class="purchase-modal-title">📋 Riwayat Pembelian</span>
                        <button class="purchase-modal-close" onclick="purchaseModule.closeModal('historyModal')">×</button>
                    </div>

                    <div class="purchase-modal-body">
                        <div class="search-bar">
                            <input type="text" placeholder="Cari faktur atau supplier..." 
                                   id="historySearch" onkeyup="purchaseModule.filterHistory()">
                        </div>

                        <div id="historyList">
                            ${purchases.length === 0 ? `
                                <div class="empty-state">
                                    <div class="empty-icon">📋</div>
                                    <p>Belum ada riwayat pembelian</p>
                                </div>
                            ` : purchases.map(p => this.renderHistoryItem(p)).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    renderHistoryItem(p) {
        const itemSummary = p.items.map(i => {
            const product = dataManager.getProducts().find(prod => prod.id === i.productId);
            return `${i.qty}x ${product?.name || 'Produk'}`;
        }).join(', ');

        return `
            <div class="purchase-item" data-search="${p.supplierName.toLowerCase()} ${p.invoiceNumber.toLowerCase()}">
                <div class="purchase-info">
                    <div class="purchase-supplier">
                        ${p.supplierName}
                        <span class="purchase-status ${p.paymentType}">
                            ${p.paymentType === 'cash' ? '💵 Tunai' : '💳 Kredit'}
                        </span>
                    </div>
                    <div class="purchase-meta">
                        <span>📄 ${p.invoiceNumber}</span>
                        <span>📅 ${new Date(p.date).toLocaleDateString('id-ID')}</span>
                    </div>
                    <div class="purchase-items-preview">
                        ${itemSummary.substring(0, 60)}${itemSummary.length > 60 ? '...' : ''}
                    </div>
                </div>
                <div style="text-align: right;">
                    <div class="purchase-total">Rp ${utils.formatNumber(p.total)}</div>
                    <div style="display: flex; gap: 5px; margin-top: 8px; justify-content: flex-end;">
                        <button class="btn-sm btn-primary-sm" onclick="event.stopPropagation(); purchaseModule.viewPurchaseDetail('${p.id}')">
                            👁️ Detail
                        </button>
                        <button class="btn-sm btn-danger-sm" onclick="event.stopPropagation(); purchaseModule.deletePurchase('${p.id}')">
                            🗑️
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    filterHistory() {
        const search = document.getElementById('historySearch').value.toLowerCase();
        const items = document.querySelectorAll('#historyList .purchase-item');
        
        items.forEach(item => {
            const text = item.getAttribute('data-search') || '';
            item.style.display = text.includes(search) ? 'flex' : 'none';
        });
    },

    viewPurchaseDetail(purchaseId) {
        const p = dataManager.getPurchases().find(pur => pur.id === purchaseId);
        if (!p) return;

        const itemsHtml = p.items.map(i => {
            const product = dataManager.getProducts().find(prod => prod.id === i.productId);
            return `
                <tr>
                    <td>${product?.name || 'Produk Tidak Ditemukan'}</td>
                    <td>${i.qty}</td>
                    <td>Rp ${utils.formatNumber(i.buyPrice)}</td>
                    <td>Rp ${utils.formatNumber(i.buyPrice * i.qty)}</td>
                </tr>
            `;
        }).join('');

        const modalHTML = `
            <div class="purchase-modal-overlay" id="detailModal" style="z-index: 10000;">
                <div class="purchase-modal-content" style="max-width: 500px;">
                    <div class="purchase-modal-header">
                        <span class="purchase-modal-title">📄 Detail Pembelian</span>
                        <button class="purchase-modal-close" onclick="purchaseModule.closeModal('detailModal')">×</button>
                    </div>

                    <div class="purchase-modal-body">
                        <div style="margin-bottom: 15px; line-height: 1.8;">
                            <p><strong>Supplier:</strong> ${p.supplierName}</p>
                            <p><strong>No. Faktur:</strong> ${p.invoiceNumber}</p>
                            <p><strong>Tanggal:</strong> ${new Date(p.date).toLocaleDateString('id-ID')}</p>
                            <p><strong>Pembayaran:</strong> ${p.paymentType === 'cash' ? '💵 Tunai' : '💳 Kredit'}</p>
                            ${p.creditNote ? `<p><strong>Catatan:</strong> ${p.creditNote}</p>` : ''}
                        </div>

                        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                            <thead>
                                <tr style="background: #f5f5f5;">
                                    <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e5e7eb;">Produk</th>
                                    <th style="padding: 10px; text-align: center; border-bottom: 2px solid #e5e7eb;">Qty</th>
                                    <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e5e7eb;">Harga</th>
                                    <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e5e7eb;">Subtotal</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${itemsHtml}
                            </tbody>
                            <tfoot>
                                <tr style="font-weight: 700; background: #e0e7ff;">
                                    <td colspan="3" style="padding: 12px; text-align: right; border-top: 2px solid #667eea;">TOTAL:</td>
                                    <td style="padding: 12px; text-align: right; border-top: 2px solid #667eea; color: #667eea;">Rp ${utils.formatNumber(p.total)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    <div class="purchase-modal-footer">
                        <button class="btn btn-secondary" onclick="purchaseModule.closeModal('detailModal')">Tutup</button>
                        <button class="btn btn-primary" onclick="purchaseModule.printPurchase('${p.id}')">
                            🖨️ Cetak
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    deletePurchase(purchaseId) {
        if (!confirm('Hapus data pembelian ini?\n\nStok produk TIDAK akan berkurang otomatis.')) return;

        dataManager.deletePurchase(purchaseId);
        this.closeModal('historyModal');
        this.openHistoryModal();
        this.renderPurchasesList();
        app.showToast('Pembelian dihapus!');
    },

    printPurchase(purchaseId) {
        const p = dataManager.getPurchases().find(pur => pur.id === purchaseId);
        if (!p) return;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
            <head>
                <title>Faktur Pembelian - ${p.invoiceNumber}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; }
                    h2 { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; }
                    .info { margin: 20px 0; }
                    .info p { margin: 5px 0; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
                    th { background: #f5f5f5; }
                    .total { font-weight: bold; font-size: 18px; text-align: right; margin-top: 20px; }
                    @media print { body { padding: 0; } }
                </style>
            </head>
            <body>
                <h2>FAKTUR PEMBELIAN</h2>
                <div class="info">
                    <p><strong>No. Faktur:</strong> ${p.invoiceNumber}</p>
                    <p><strong>Supplier:</strong> ${p.supplierName}</p>
                    <p><strong>Tanggal:</strong> ${new Date(p.date).toLocaleDateString('id-ID')}</p>
                    <p><strong>Pembayaran:</strong> ${p.paymentType === 'cash' ? 'Tunai' : 'Kredit'}</p>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Produk</th>
                            <th>Qty</th>
                            <th>Harga Beli</th>
                            <th>Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${p.items.map(i => {
                            const product = dataManager.getProducts().find(prod => prod.id === i.productId);
                            return `
                                <tr>
                                    <td>${product?.name || 'Produk'}</td>
                                    <td>${i.qty}</td>
                                    <td>Rp ${utils.formatNumber(i.buyPrice)}</td>
                                    <td>Rp ${utils.formatNumber(i.buyPrice * i.qty)}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
                <div class="total">TOTAL: Rp ${utils.formatNumber(p.total)}</div>
                <script>window.print();</script>
            </body>
            </html>
        `);
        printWindow.document.close();
    },

    // ============================================
    // RENDER LIST PEMBELIAN - UPDATED WITH FILTER
    // ============================================
    renderPurchasesList() {
        const container = document.getElementById('purchasesList');
        if (!container) return;

        const filteredPurchases = this.getFilteredPurchases();
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        // Hitung jumlah pembelian baru (hari ini)
        const newPurchases = filteredPurchases.filter(p => new Date(p.date) >= today);
        const newCount = newPurchases.length;
        
        // Update badge
        const badge = document.getElementById('newPurchaseBadge');
        if (badge) {
            badge.textContent = `${newCount} baru`;
            badge.style.display = newCount > 0 ? 'inline-block' : 'none';
        }
        
        // Update count
        const countEl = document.getElementById('purchaseCount');
        if (countEl) {
            const totalFiltered = filteredPurchases.length;
            const totalAll = dataManager.getPurchases().length;
            if (this.filterMode !== 'all') {
                countEl.textContent = `${totalFiltered} dari ${totalAll} faktur`;
            } else {
                countEl.textContent = `${totalAll} faktur`;
            }
        }

        // Render filter summary jika ada filter aktif
        let summaryHTML = '';
        if (this.filterMode !== 'all' && filteredPurchases.length > 0) {
            const totalAmount = filteredPurchases.reduce((sum, p) => sum + p.total, 0);
            const filterLabels = {
                'today': 'Hari Ini',
                'yesterday': 'Kemarin',
                'monthly': 'Bulan Ini',
                'yearly': 'Tahun Ini',
                'custom': 'Custom'
            };
            summaryHTML = `
                <div class="filter-summary">
                    <span class="filter-summary-text">📊 ${filterLabels[this.filterMode]}: ${filteredPurchases.length} faktur</span>
                    <span class="filter-summary-total">Rp ${utils.formatNumber(totalAmount)}</span>
                </div>
            `;
        }

        if (filteredPurchases.length === 0) {
            container.innerHTML = summaryHTML + `
                <div class="empty-state">
                    <div class="empty-icon">🛒</div>
                    <p>Belum ada pembelian${this.filterMode !== 'all' ? ' di periode ini' : ''}</p>
                    <button class="btn btn-primary" onclick="purchaseModule.openAddModal()" style="margin-top: 10px;">
                        Buat Pembelian Pertama
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = summaryHTML + filteredPurchases.map(p => `
            <div class="purchase-item" onclick="purchaseModule.viewPurchaseDetail('${p.id}')">
                <div class="purchase-info">
                    <div class="purchase-supplier">
                        ${p.supplierName}
                        <span class="purchase-status ${p.paymentType}">
                            ${p.paymentType === 'cash' ? '💵' : '💳'}
                        </span>
                        ${this.getDateBadge(p.date)}
                    </div>
                    <div class="purchase-meta">
                        <span>📄 ${p.invoiceNumber}</span>
                        <span>📅 ${new Date(p.date).toLocaleDateString('id-ID')}</span>
                    </div>
                </div>
                <div class="purchase-total">
                    Rp ${utils.formatNumber(p.total)}
                </div>
            </div>
        `).join('');
    },

    closeModal(id) {
        const modal = document.getElementById(id);
        if (modal) modal.remove();
    }
};

window.purchaseModule = purchaseModule;

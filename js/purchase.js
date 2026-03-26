// ============================================
// PURCHASE MODULE - Pembelian dari Supplier (FIXED)
// ============================================

const purchaseModule = {
    currentItems: [],
    editingPurchaseId: null,

    init() {
        this.renderHTML();
        this.renderPurchasesList();
    },

    renderHTML() {
        document.getElementById('mainContent').innerHTML = `
            <div class="content-section active" id="purchaseSection">
                <!-- Quick Actions -->
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

                <!-- Recent Purchases -->
                <div class="card">
                    <div class="card-header">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span class="card-title">📦 Pembelian Terbaru</span>
                            <span style="font-size: 12px; color: #666;" id="purchaseCount">0 faktur</span>
                        </div>
                    </div>
                    <div class="card-content">
                        <div id="purchasesList"></div>
                    </div>
                </div>
            </div>
        `;
        
        this.addStyles();
    },

    addStyles() {
        if (document.getElementById('purchase-module-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'purchase-module-styles';
        style.textContent = `
            /* Modal Styles - FIXED */
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
                from { 
                    opacity: 0;
                    transform: translateY(20px);
                }
                to { 
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            /* Form Styles */
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
            }
            
            .btn-add-item:hover {
                background: #e0e7ff;
                border-color: #667eea;
                color: #667eea;
            }
            
            /* Purchase Item List */
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
            
            .purchase-info {
                flex: 1;
            }
            
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
            
            /* Supplier Card */
            .supplier-card {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 16px;
                background: white;
                margin-bottom: 10px;
                border-radius: 12px;
                border: 1px solid #e5e7eb;
                transition: all 0.2s;
            }
            
            .supplier-card:hover {
                border-color: #667eea;
                box-shadow: 0 2px 8px rgba(102, 126, 234, 0.1);
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
            
            /* Form Groups */
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
            
            /* Buttons */
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
            
            .btn-secondary:hover {
                background: #d1d5db;
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
            
            .btn-primary-sm:hover {
                background: #c7d2fe;
            }
            
            .btn-danger-sm {
                background: #fee2e2;
                color: #dc2626;
            }
            
            .btn-danger-sm:hover {
                background: #fecaca;
            }
            
            /* Add Category Row */
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
                transition: all 0.2s;
            }
            
            .add-category-btn:hover {
                transform: scale(1.05);
            }
            
            /* Search Bar */
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
            
            /* Empty State */
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
            
            /* Toast Notification - PASTIKAN Z-INDEX LEBIH RENDAH */
            .toast {
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: #1f2937;
                color: white;
                padding: 12px 24px;
                border-radius: 8px;
                font-size: 14px;
                z-index: 10000;
                animation: slideDown 0.3s ease;
            }
            
            @keyframes slideDown {
                from {
                    opacity: 0;
                    transform: translateX(-50%) translateY(-20px);
                }
                to {
                    opacity: 1;
                    transform: translateX(-50%) translateY(0);
                }
            }
        `;
        document.head.appendChild(style);
    },

    // ============================================
    // MODAL: TAMBAH PEMBELIAN BARU (FIXED STRUCTURE)
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
                this.currentItems = [...editData.items];
            }
        }

        // Create modal with proper overlay
        const modalHTML = `
            <div class="purchase-modal-overlay" id="purchaseModal">
                <div class="purchase-modal-content">
                    <div class="purchase-modal-header">
                        <span class="purchase-modal-title">${purchaseId ? '✏️ Edit' : '🛒 Tambah'} Pembelian</span>
                        <button class="purchase-modal-close" onclick="purchaseModule.closeModal('purchaseModal')">×</button>
                    </div>

                    <div class="purchase-modal-body">
                        <!-- Info Faktur -->
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

                        <!-- Daftar Produk -->
                        <div style="margin: 20px 0;">
                            <label style="display: block; margin-bottom: 10px; font-weight: 600; color: #374151;">Produk Dibeli</label>
                            
                            <div id="purchaseItemsList">
                                <!-- Items akan dirender di sini -->
                            </div>

                            <button class="btn-add-item" onclick="purchaseModule.addItemRow()">
                                <span>➕</span> Tambah Produk
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

        // Render existing items atau tambah 1 row kosong
        if (this.currentItems.length > 0) {
            this.currentItems.forEach((item, index) => this.renderItemRow(index, item));
        } else {
            this.addItemRow();
        }
        
        this.calculateTotal();
    },

    addItemRow() {
        const index = this.currentItems.length;
        this.currentItems.push({ productId: '', qty: 1, buyPrice: 0, sellPrice: 0 });
        this.renderItemRow(index);
        this.calculateTotal();
    },

    renderItemRow(index, itemData = null) {
        const products = dataManager.getProducts();
        const container = document.getElementById('purchaseItemsList');
        
        const div = document.createElement('div');
        div.className = 'purchase-form-row';
        div.id = `itemRow_${index}`;
        
        div.innerHTML = `
            <select onchange="purchaseModule.updateItemProduct(${index}, this.value)">
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
        `;
        
        container.appendChild(div);
        
        // Auto-fill harga jual jika produk dipilih
        if (itemData?.productId) {
            const product = products.find(p => p.id === itemData.productId);
            if (product && !itemData.sellPrice) {
                this.currentItems[index].sellPrice = product.price;
                div.querySelector('input[placeholder="Harga Jual"]').value = product.price;
            }
        }
    },

    updateItemProduct(index, productId) {
        const product = dataManager.getProducts().find(p => p.id === productId);
        if (product) {
            this.currentItems[index].productId = productId;
            this.currentItems[index].sellPrice = product.price;
            
            const row = document.getElementById(`itemRow_${index}`);
            if (row) {
                row.querySelector('input[placeholder="Harga Jual"]').value = product.price;
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
        const row = document.getElementById(`itemRow_${index}`);
        if (row) row.remove();
        
        // Re-render semua rows dengan index baru
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
        
        const itemCount = this.currentItems.filter(i => i.productId).length;
        
        document.getElementById('subtotalDisplay').textContent = `Rp ${utils.formatNumber(subtotal)}`;
        document.getElementById('itemCountDisplay').textContent = `${itemCount} produk`;
        document.getElementById('totalDisplay').textContent = `Rp ${utils.formatNumber(subtotal)}`;
    },

    savePurchase() {
        const supplierId = document.getElementById('purchaseSupplier').value;
        const invoiceNumber = document.getElementById('purchaseInvoice').value.trim();
        const date = document.getElementById('purchaseDate').value;
        const paymentType = document.getElementById('purchasePayment').value;
        const creditNote = document.getElementById('creditNote')?.value.trim() || '';

        if (!supplierId) {
            app.showToast('Pilih supplier terlebih dahulu!');
            return;
        }
        if (!date) {
            app.showToast('Tanggal wajib diisi!');
            return;
        }
        if (this.currentItems.length === 0 || !this.currentItems.some(i => i.productId)) {
            app.showToast('Tambahkan minimal 1 produk!');
            return;
        }

        // Filter items yang valid
        const validItems = this.currentItems.filter(item => item.productId && item.qty > 0);
        
        const total = validItems.reduce((sum, item) => sum + (item.buyPrice * item.qty), 0);
        
        const supplier = dataManager.getSuppliers().find(s => s.id === supplierId);
        
        const purchaseData = {
            supplierId,
            supplierName: supplier?.name || 'Unknown',
            invoiceNumber: invoiceNumber || `INV-${Date.now().toString().slice(-6)}`,
            date: new Date(date).toISOString(),
            paymentType,
            creditNote: paymentType === 'credit' ? creditNote : '',
            items: validItems,
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
    // MODAL: MANAJEMEN SUPPLIER (FIXED)
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

        dataManager.addSupplier({
            name,
            phone,
            address: ''
        });

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
    // MODAL: RIWAYAT PEMBELIAN (FIXED)
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
    // RENDER LIST PEMBELIAN (HALAMAN UTAMA)
    // ============================================
    renderPurchasesList() {
        const container = document.getElementById('purchasesList');
        if (!container) return;

        const purchases = dataManager.getPurchases()
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 10);

        document.getElementById('purchaseCount').textContent = `${dataManager.getPurchases().length} faktur`;

        if (purchases.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🛒</div>
                    <p>Belum ada pembelian</p>
                    <button class="btn btn-primary" onclick="purchaseModule.openAddModal()" style="margin-top: 10px;">
                        Buat Pembelian Pertama
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = purchases.map(p => `
            <div class="purchase-item" onclick="purchaseModule.viewPurchaseDetail('${p.id}')">
                <div class="purchase-info">
                    <div class="purchase-supplier">
                        ${p.supplierName}
                        <span class="purchase-status ${p.paymentType}">
                            ${p.paymentType === 'cash' ? '💵' : '💳'}
                        </span>
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
        if (modal) {
            modal.remove();
        }
    }
};

// Expose to window
window.purchaseModule = purchaseModule;

// ============================================
// PURCHASE MODULE - Pembelian dari Supplier
// ============================================

const purchaseModule = {
    currentItems: [], // Items dalam faktur saat ini
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
            .purchase-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 15px;
                background: white;
                margin-bottom: 10px;
                border-radius: 12px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                border: 1px solid #f0f0f0;
                transition: all 0.2s ease;
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
                color: #333;
            }
            
            .purchase-meta {
                font-size: 12px;
                color: #666;
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
                padding: 4px 10px;
                border-radius: 20px;
                font-size: 11px;
                font-weight: 600;
            }
            
            .purchase-status.cash {
                background: #e8f5e9;
                color: #2e7d32;
            }
            
            .purchase-status.credit {
                background: #fff3e0;
                color: #ef6c00;
            }
            
            .purchase-items-preview {
                margin-top: 8px;
                padding-top: 8px;
                border-top: 1px dashed #eee;
                font-size: 12px;
                color: #888;
            }
            
            .purchase-form-row {
                display: grid;
                grid-template-columns: 2fr 1fr 1fr 1fr auto;
                gap: 10px;
                align-items: center;
                padding: 10px;
                background: #f8f9fa;
                border-radius: 8px;
                margin-bottom: 8px;
            }
            
            .purchase-form-row input, .purchase-form-row select {
                padding: 8px;
                border: 1px solid #ddd;
                border-radius: 6px;
                font-size: 14px;
            }
            
            .purchase-form-row button {
                background: #ff5252;
                color: white;
                border: none;
                width: 32px;
                height: 32px;
                border-radius: 6px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
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
            
            .supplier-card {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 15px;
                background: white;
                margin-bottom: 10px;
                border-radius: 12px;
                border: 1px solid #f0f0f0;
            }
            
            .supplier-info h4 {
                margin: 0 0 5px 0;
                font-size: 15px;
            }
            
            .supplier-info p {
                margin: 0;
                font-size: 12px;
                color: #666;
            }
            
            .btn-add-item {
                width: 100%;
                padding: 12px;
                background: #f0f0f0;
                border: 2px dashed #ccc;
                border-radius: 8px;
                cursor: pointer;
                color: #666;
                font-size: 14px;
                transition: all 0.2s;
            }
            
            .btn-add-item:hover {
                background: #e3f2fd;
                border-color: #667eea;
                color: #667eea;
            }
        `;
        document.head.appendChild(style);
    },

    // ============================================
    // MODAL: TAMBAH PEMBELIAN BARU
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

        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal active" id="purchaseModal" style="z-index: 1000;">
                <div class="modal-content" style="max-width: 700px; max-height: 90vh; overflow-y: auto;">
                    <div class="modal-header">
                        <span class="modal-title">${purchaseId ? '✏️ Edit' : '🛒 Tambah'} Pembelian</span>
                        <button class="close-btn" onclick="purchaseModule.closeModal('purchaseModal')">×</button>
                    </div>

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

                    <div class="form-group" id="creditNoteBox" style="display: ${editData?.paymentType === 'credit' ? 'block' : 'none'};">
                        <label>Catatan Hutang (Jatuh Tempo)</label>
                        <input type="text" id="creditNote" placeholder="Contoh: Jatuh tempo 30 hari" 
                               value="${editData?.creditNote || ''}">
                    </div>

                    <!-- Daftar Produk -->
                    <div style="margin: 20px 0;">
                        <label style="display: block; margin-bottom: 10px; font-weight: 600;">Produk Dibeli</label>
                        
                        <div id="purchaseItemsList">
                            <!-- Items akan dirender di sini -->
                        </div>

                        <button class="btn-add-item" onclick="purchaseModule.addItemRow()">
                            ➕ Tambah Produk
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

                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="purchaseModule.closeModal('purchaseModal')">Batal</button>
                        <button class="btn btn-primary" onclick="purchaseModule.savePurchase()">
                            💾 ${purchaseId ? 'Update' : 'Simpan'} Pembelian
                        </button>
                    </div>
                </div>
            </div>
        `);

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
            <select onchange="purchaseModule.updateItemProduct(${index}, this.value)" style="width: 100%;">
                <option value="">-- Pilih Produk --</option>
                ${products.map(p => `
                    <option value="${p.id}" ${itemData?.productId === p.id ? 'selected' : ''}>
                        ${p.name} (Stok: ${p.stock})
                    </option>
                `).join('')}
            </select>
            <input type="number" placeholder="Qty" min="1" value="${itemData?.qty || 1}" 
                   onchange="purchaseModule.updateItemQty(${index}, this.value)" style="width: 100%;">
            <input type="number" placeholder="Harga Beli" value="${itemData?.buyPrice || ''}" 
                   onchange="purchaseModule.updateItemBuyPrice(${index}, this.value)" style="width: 100%;">
            <input type="number" placeholder="Harga Jual" value="${itemData?.sellPrice || ''}" 
                   onchange="purchaseModule.updateItemSellPrice(${index}, this.value)" style="width: 100%;">
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
            // Auto-fill harga jual dari data produk
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
                // Update stok
                const newStock = product.stock + item.qty;
                // Update harga modal (harga beli baru)
                dataManager.updateProduct(item.productId, {
                    stock: newStock,
                    cost: item.buyPrice, // Update HPP
                    price: item.sellPrice || product.price // Update harga jual jika diisi
                });
            }
        });

        if (this.editingPurchaseId) {
            // Hapus pembelian lama, tambah yang baru
            dataManager.deletePurchase(this.editingPurchaseId);
        }
        
        dataManager.addPurchase(purchaseData);
        
        this.closeModal('purchaseModal');
        this.renderPurchasesList();
        app.showToast(this.editingPurchaseId ? 'Pembelian diupdate!' : 'Pembelian tersimpan! Stok & harga modal diupdate.');
    },

    // ============================================
    // MODAL: MANAJEMEN SUPPLIER
    // ============================================
    openSupplierModal() {
        const suppliers = dataManager.getSuppliers();

        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal active" id="supplierModal" style="z-index: 1000;">
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <span class="modal-title">🏢 Manajemen Supplier</span>
                        <button class="close-btn" onclick="purchaseModule.closeModal('supplierModal')">×</button>
                    </div>

                    <div class="add-category-row" style="margin-bottom: 20px;">
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
                                    <button class="btn-sm btn-primary-sm" onclick="purchaseModule.editSupplier('${s.id}')" style="padding: 6px 10px;">
                                        ✏️
                                    </button>
                                    <button class="btn-sm btn-danger-sm" onclick="purchaseModule.deleteSupplier('${s.id}')" style="padding: 6px 10px;">
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `);
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
    // MODAL: RIWAYAT PEMBELIAN
    // ============================================
    openHistoryModal() {
        const purchases = dataManager.getPurchases().sort((a, b) => 
            new Date(b.date) - new Date(a.date)
        );

        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal active" id="historyModal" style="z-index: 1000;">
                <div class="modal-content" style="max-width: 700px; max-height: 80vh; overflow-y: auto;">
                    <div class="modal-header">
                        <span class="modal-title">📋 Riwayat Pembelian</span>
                        <button class="close-btn" onclick="purchaseModule.closeModal('historyModal')">×</button>
                    </div>

                    <div class="search-bar" style="margin-bottom: 15px;">
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
        `);
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
                    <div style="display: flex; gap: 5px; margin-top: 8px;">
                        <button class="btn-sm btn-primary-sm" onclick="purchaseModule.viewPurchaseDetail('${p.id}')" style="padding: 6px 10px; font-size: 11px;">
                            👁️ Detail
                        </button>
                        <button class="btn-sm btn-danger-sm" onclick="purchaseModule.deletePurchase('${p.id}')" style="padding: 6px 10px; font-size: 11px;">
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

        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal active" id="detailModal" style="z-index: 1100;">
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <span class="modal-title">📄 Detail Pembelian</span>
                        <button class="close-btn" onclick="purchaseModule.closeModal('detailModal')">×</button>
                    </div>

                    <div style="margin-bottom: 15px;">
                        <p><strong>Supplier:</strong> ${p.supplierName}</p>
                        <p><strong>No. Faktur:</strong> ${p.invoiceNumber}</p>
                        <p><strong>Tanggal:</strong> ${new Date(p.date).toLocaleDateString('id-ID')}</p>
                        <p><strong>Pembayaran:</strong> ${p.paymentType === 'cash' ? '💵 Tunai' : '💳 Kredit'}</p>
                        ${p.creditNote ? `<p><strong>Catatan:</strong> ${p.creditNote}</p>` : ''}
                    </div>

                    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                        <thead>
                            <tr style="background: #f5f5f5;">
                                <th style="padding: 8px; text-align: left;">Produk</th>
                                <th style="padding: 8px; text-align: center;">Qty</th>
                                <th style="padding: 8px; text-align: right;">Harga</th>
                                <th style="padding: 8px; text-align: right;">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHtml}
                        </tbody>
                        <tfoot>
                            <tr style="font-weight: 700; background: #e3f2fd;">
                                <td colspan="3" style="padding: 10px; text-align: right;">TOTAL:</td>
                                <td style="padding: 10px; text-align: right;">Rp ${utils.formatNumber(p.total)}</td>
                            </tr>
                        </tfoot>
                    </table>

                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="purchaseModule.closeModal('detailModal')">Tutup</button>
                        <button class="btn btn-primary" onclick="purchaseModule.printPurchase('${p.id}')">
                            🖨️ Cetak
                        </button>
                    </div>
                </div>
            </div>
        `);
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
            .slice(0, 10); // 10 terbaru saja

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
            <div class="purchase-item" style="cursor: pointer;" onclick="purchaseModule.viewPurchaseDetail('${p.id}')">
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
        document.getElementById(id)?.remove();
    }
};

// Expose to window
window.purchaseModule = purchaseModule;

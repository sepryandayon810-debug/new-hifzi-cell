const productsModule = {
    currentEditId: null,

    init() {
        this.render();
    },

    render() {
        const container = document.getElementById('mainContent');
        const products = dataManager.data.products;

        container.innerHTML = `
            <div class="content-section active" id="productsSection">
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon items">📦</div>
                        <div class="stat-label">Total Produk</div>
                        <div class="stat-value">${products.length}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon sales">💰</div>
                        <div class="stat-label">Nilai Inventori</div>
                        <div class="stat-value">Rp ${utils.formatNumber(this.calculateInventoryValue())}</div>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <span class="card-title">📦 Daftar Produk</span>
                        <button class="btn-sm btn-primary-sm" onclick="productsModule.openAddModal()">+ Tambah</button>
                    </div>
                    
                    <div class="search-bar" style="margin-bottom: 15px;">
                        <input type="text" id="productSearch" placeholder="Cari produk..." 
                               oninput="productsModule.search(this.value)">
                    </div>

                    <div id="productsList">
                        ${this.renderProductsList(products)}
                    </div>
                </div>
            </div>
        `;
    },

    calculateInventoryValue() {
        return dataManager.data.products.reduce((sum, p) => sum + ((p.cost || 0) * (p.stock || 0)), 0);
    },

    renderProductsList(products) {
        if (products.length === 0) {
            return `<div class="empty-state"><div class="empty-icon">📦</div><p>Belum ada produk</p></div>`;
        }

        return products.map(p => `
            <div class="product-item" style="display: flex; justify-content: space-between; align-items: center; padding: 15px; background: white; margin-bottom: 10px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #f0f0f0;">
                <div style="flex: 1;">
                    <div style="font-weight: 600; font-size: 14px;">${p.name}</div>
                    <div style="font-size: 12px; color: #666; margin-top: 4px;">
                        Rp ${utils.formatNumber(p.price)} | Stok: ${p.stock || 0}
                        ${p.barcode ? `| Barcode: ${p.barcode}` : ''}
                    </div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button onclick="productsModule.openEditModal('${p.id}')" 
                            style="padding: 8px 12px; border: none; background: #e3f2fd; color: #1976d2; border-radius: 8px; cursor: pointer; font-size: 12px;">✏️ Edit</button>
                    <button onclick="productsModule.deleteProduct('${p.id}')" 
                            style="padding: 8px 12px; border: none; background: #ffebee; color: #c62828; border-radius: 8px; cursor: pointer; font-size: 12px;">🗑️ Hapus</button>
                </div>
            </div>
        `).join('');
    },

    search(query) {
        const products = dataManager.data.products.filter(p => 
            p.name.toLowerCase().includes(query.toLowerCase()) ||
            (p.barcode && p.barcode.includes(query))
        );
        document.getElementById('productsList').innerHTML = this.renderProductsList(products);
    },

    openAddModal() {
        this.currentEditId = null;
        this.showProductModal();
    },

    openEditModal(id) {
        this.currentEditId = id;
        const product = dataManager.getProductById(id);
        if (product) {
            this.showProductModal(product);
        }
    },

    showProductModal(product = null) {
        const isEdit = !!product;
        
        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal active" id="productModal" style="display: flex; z-index: 2000;">
                <div class="modal-content">
                    <div class="modal-header">
                        <span class="modal-title">${isEdit ? '✏️ Edit Produk' : '📦 Tambah Produk'}</span>
                        <button class="close-btn" onclick="productsModule.closeModal()">×</button>
                    </div>

                    <div class="form-group">
                        <label>Nama Produk *</label>
                        <input type="text" id="prodName" value="${product?.name || ''}" placeholder="Nama produk">
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label>Harga Jual *</label>
                            <input type="number" id="prodPrice" value="${product?.price || ''}" placeholder="0">
                        </div>
                        <div class="form-group">
                            <label>Harga Modal *</label>
                            <input type="number" id="prodCost" value="${product?.cost || ''}" placeholder="0">
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label>Stok</label>
                            <input type="number" id="prodStock" value="${product?.stock || '0'}" placeholder="0">
                        </div>
                        <div class="form-group">
                            <label>Barcode</label>
                            <input type="text" id="prodBarcode" value="${product?.barcode || ''}" placeholder="Optional">
                        </div>
                    </div>

                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="productsModule.closeModal()">Batal</button>
                        <button class="btn btn-primary" onclick="productsModule.saveProduct()">💾 Simpan</button>
                    </div>
                </div>
            </div>
        `);
    },

    closeModal() {
        const modal = document.getElementById('productModal');
        if (modal) modal.remove();
    },

    saveProduct() {
        const name = document.getElementById('prodName').value.trim();
        const price = parseInt(document.getElementById('prodPrice').value) || 0;
        const cost = parseInt(document.getElementById('prodCost').value) || 0;
        const stock = parseInt(document.getElementById('prodStock').value) || 0;
        const barcode = document.getElementById('prodBarcode').value.trim();

        if (!name || price <= 0) {
            app.showToast('❌ Nama dan harga jual wajib diisi!');
            return;
        }

        const productData = { name, price, cost, stock, barcode };

        if (this.currentEditId) {
            dataManager.updateProduct(this.currentEditId, productData);
            app.showToast('✅ Produk diperbarui!');
        } else {
            dataManager.addProduct(productData);
            app.showToast('✅ Produk ditambahkan!');
        }

        this.closeModal();
        this.render();
    },

    deleteProduct(id) {
        const product = dataManager.getProductById(id);
        if (!product) return;

        if (confirm(`Hapus produk "${product.name}"?`)) {
            dataManager.deleteProduct(id);
            app.showToast('🗑️ Produk dihapus!');
            this.render();
        }
    }
};

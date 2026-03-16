const productsModule = {
    currentView: 'list',
    batchStockData: {},
    
    init() {
        this.renderHTML();
        this.renderProducts();
    },
    
    renderHTML() {
        document.getElementById('mainContent').innerHTML = `
            <div class="content-section active" id="productsSection">
                <!-- Quick Actions -->
                <div class="quick-actions">
                    <button class="quick-btn" onclick="productsModule.openAddModal()">
                        <div class="quick-icon" style="background: #e3f2fd;">➕</div>
                        <div class="quick-text">Tambah</div>
                    </button>
                    <button class="quick-btn" onclick="productsModule.openBatchStock()">
                        <div class="quick-icon" style="background: #e8f5e9;">📦</div>
                        <div class="quick-text">Stok Masal</div>
                    </button>
                    <button class="quick-btn" onclick="productsModule.openCategoryModal()">
                        <div class="quick-icon" style="background: #fff3e0;">🏷️</div>
                        <div class="quick-text">Kategori</div>
                    </button>
                    <button class="quick-btn" onclick="productsModule.openImportModal()">
                        <div class="quick-icon" style="background: #e8f5e9;">📤</div>
                        <div class="quick-text">Import</div>
                    </button>
                    <button class="quick-btn" onclick="productsModule.exportProducts()">
                        <div class="quick-icon" style="background: #f3e5f5;">📥</div>
                        <div class="quick-text">Export</div>
                    </button>
                </div>

                <!-- Products List -->
                <div class="card">
                    <div class="card-header">
                        <span class="card-title">📦 Daftar Produk</span>
                        <span style="font-size: 12px; color: #666;" id="productCount">0 produk</span>
                    </div>
                    
                    <div class="search-bar">
                        <input type="text" placeholder="Cari produk..." id="searchProduct" 
                               onkeyup="productsModule.searchProducts()">
                        <button onclick="productsModule.searchProducts()">🔍</button>
                    </div>
                    
                    <div id="productsList"></div>
                </div>
            </div>
        `;
    },
    
    renderProducts() {
        const container = document.getElementById('productsList');
        const search = document.getElementById('searchProduct')?.value.toLowerCase() || '';
        
        let products = dataManager.getProducts();
        
        if (search) {
            products = products.filter(p => p.name.toLowerCase().includes(search));
        }
        
        document.getElementById('productCount').textContent = `${products.length} produk`;
        
        if (products.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📦</div>
                    <p>Belum ada produk</p>
                    <button class="btn btn-primary" onclick="productsModule.openAddModal()" style="margin-top: 10px;">
                        Tambah Produk Pertama
                    </button>
                </div>`;
            return;
        }
        
        container.innerHTML = products.map(p => `
            <div class="product-item" style="display: flex; justify-content: space-between; align-items: center; padding: 15px; background: white; margin-bottom: 10px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #f0f0f0;">
                <div style="flex: 1;">
                    <div style="font-weight: 600; font-size: 15px; margin-bottom: 4px;">${p.name}</div>
                    <div style="font-size: 12px; color: #666; display: flex; gap: 10px; flex-wrap: wrap;">
                        <span>💰 Rp ${utils.formatNumber(p.price)}</span>
                        <span>📦 Stok: ${p.stock}</span>
                        <span>🏷️ ${dataManager.getCategories().find(c => c.id === p.category)?.name || 'Lainnya'}</span>
                    </div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button onclick="productsModule.openEditModal(${p.id})" class="btn-sm btn-primary-sm" style="padding: 8px 12px;">
                        ✏️
                    </button>
                    <button onclick="productsModule.deleteProduct(${p.id})" class="btn-sm btn-danger-sm" style="padding: 8px 12px;">
                        🗑️
                    </button>
                </div>
            </div>
        `).join('');
    },
    
    searchProducts() {
        this.renderProducts();
    },
    
    openAddModal() {
        const categories = dataManager.getCategories().filter(c => c.id !== 'all');
        
        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal active" id="addProductModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <span class="modal-title">➕ Tambah Produk</span>
                        <button class="close-btn" onclick="productsModule.closeModal('addProductModal')">×</button>
                    </div>
                    
                    <div class="form-group">
                        <label>Nama Produk *</label>
                        <input type="text" id="prodName" placeholder="Nama produk">
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label>Harga Jual (Rp) *</label>
                            <input type="number" id="prodPrice" placeholder="0">
                        </div>
                        <div class="form-group">
                            <label>Harga Modal (Rp)</label>
                            <input type="number" id="prodCost" placeholder="0">
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label>Stok Awal</label>
                            <input type="number" id="prodStock" value="0" placeholder="0">
                        </div>
                        <div class="form-group">
                            <label>Kategori</label>
                            <select id="prodCategory">
                                ${categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="productsModule.closeModal('addProductModal')">Batal</button>
                        <button class="btn btn-primary" onclick="productsModule.saveProduct()">Simpan</button>
                    </div>
                </div>
            </div>
        `);
    },
    
    openEditModal(productId) {
        const p = dataManager.getProducts().find(prod => prod.id === productId);
        if (!p) return;
        
        const categories = dataManager.getCategories().filter(c => c.id !== 'all');
        
        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal active" id="editProductModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <span class="modal-title">✏️ Edit Produk</span>
                        <button class="close-btn" onclick="productsModule.closeModal('editProductModal')">×</button>
                    </div>
                    
                    <input type="hidden" id="editProdId" value="${p.id}">
                    
                    <div class="form-group">
                        <label>Nama Produk *</label>
                        <input type="text" id="editProdName" value="${p.name}">
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label>Harga Jual (Rp) *</label>
                            <input type="number" id="editProdPrice" value="${p.price}">
                        </div>
                        <div class="form-group">
                            <label>Harga Modal (Rp)</label>
                            <input type="number" id="editProdCost" value="${p.cost || 0}">
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label>Stok Saat Ini</label>
                            <input type="number" id="editProdStock" value="${p.stock}" readonly style="background: #f5f5f5;">
                        </div>
                        <div class="form-group">
                            <label>Tambah/Kurangi Stok</label>
                            <input type="number" id="editProdStockChange" value="0" placeholder="0 (tambah) atau -5 (kurang)">
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label>Kategori</label>
                        <select id="editProdCategory">
                            ${categories.map(c => `<option value="${c.id}" ${c.id === p.category ? 'selected' : ''}>${c.name}</option>`).join('')}
                        </select>
                    </div>
                    
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="productsModule.closeModal('editProductModal')">Batal</button>
                        <button class="btn btn-primary" onclick="productsModule.updateProduct()">Update</button>
                    </div>
                </div>
            </div>
        `);
    },
    
    saveProduct() {
        const name = document.getElementById('prodName').value.trim();
        const price = parseInt(document.getElementById('prodPrice').value) || 0;
        const cost = parseInt(document.getElementById('prodCost').value) || 0;
        const stock = parseInt(document.getElementById('prodStock').value) || 0;
        const category = document.getElementById('prodCategory').value;
        
        if (!name || price <= 0) {
            app.showToast('Nama dan harga wajib diisi!');
            return;
        }
        
        const product = {
            id: Date.now(),
            name,
            price,
            cost: cost || Math.floor(price * 0.7),
            stock,
            category
        };
        
        dataManager.addProduct(product);
        this.closeModal('addProductModal');
        this.renderProducts();
        app.showToast('Produk ditambahkan!');
    },
    
    updateProduct() {
        const id = parseInt(document.getElementById('editProdId').value);
        const name = document.getElementById('editProdName').value.trim();
        const price = parseInt(document.getElementById('editProdPrice').value) || 0;
        const cost = parseInt(document.getElementById('editProdCost').value) || 0;
        const stockChange = parseInt(document.getElementById('editProdStockChange').value) || 0;
        const category = document.getElementById('editProdCategory').value;
        
        if (!name || price <= 0) {
            app.showToast('Nama dan harga wajib diisi!');
            return;
        }
        
        const currentProduct = dataManager.getProducts().find(p => p.id === id);
        const newStock = Math.max(0, currentProduct.stock + stockChange);
        
        dataManager.updateProduct(id, {
            name,
            price,
            cost,
            stock: newStock,
            category
        });
        
        this.closeModal('editProductModal');
        this.renderProducts();
        app.showToast('Produk diupdate!');
    },
    
    deleteProduct(productId) {
        const p = dataManager.getProducts().find(prod => prod.id === productId);
        if (!p) return;
        
        if (!confirm(`Hapus produk "${p.name}"?\n\nProduk yang sudah ada di transaksi history tetap tersimpan.`)) {
            return;
        }
        
        dataManager.deleteProduct(productId);
        this.renderProducts();
        app.showToast('Produk dihapus!');
    },
    
    // BATCH STOCK WITH DELETE FEATURE
    openBatchStock() {
        this.batchStockData = {};
        const products = dataManager.getProducts();
        
        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal active" id="batchStockModal">
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <span class="modal-title">📦 Update Stok Masal</span>
                        <button class="close-btn" onclick="productsModule.closeModal('batchStockModal')">×</button>
                    </div>
                    
                    <div class="info-box warning" style="margin-bottom: 15px;">
                        <div class="info-title">Cara Penggunaan</div>
                        <div class="info-text">
                            • Isi angka positif untuk menambah stok<br>
                            • Isi angka negatif untuk mengurangi stok<br>
                            • Klik 🗑️ untuk hapus produk permanen
                        </div>
                    </div>
                    
                    <div class="search-bar" style="margin-bottom: 15px;">
                        <input type="text" placeholder="Cari produk..." id="batchSearch" 
                               onkeyup="productsModule.filterBatchStock()">
                    </div>
                    
                    <div id="batchStockList" style="max-height: 50vh; overflow-y: auto;">
                        ${products.map(p => `
                            <div class="batch-stock-item" data-name="${p.name.toLowerCase()}">
                                <div class="batch-stock-info">
                                    <div class="batch-stock-name">${p.name}</div>
                                    <div class="batch-stock-current">Stok: ${p.stock} • Rp ${utils.formatNumber(p.price)}</div>
                                </div>
                                <div class="batch-stock-actions">
                                    <input type="number" class="batch-stock-input" 
                                           id="batch_${p.id}" placeholder="0" 
                                           onchange="productsModule.trackBatchChange(${p.id})">
                                    <button class="batch-delete-btn" onclick="productsModule.confirmDeleteBatch(${p.id})" title="Hapus Produk">
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="calculation-box" style="margin-top: 15px;">
                        <div class="calc-row">
                            <span>Produk akan diupdate:</span>
                            <span id="batchCount" style="font-weight: 700;">0</span>
                        </div>
                    </div>
                    
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="productsModule.closeModal('batchStockModal')">Batal</button>
                        <button class="btn btn-primary" onclick="productsModule.saveBatchStock()">💾 Simpan Perubahan</button>
                    </div>
                </div>
            </div>
        `);
    },
    
    filterBatchStock() {
        const search = document.getElementById('batchSearch').value.toLowerCase();
        const items = document.querySelectorAll('.batch-stock-item');
        
        items.forEach(item => {
            const name = item.getAttribute('data-name');
            item.style.display = name.includes(search) ? 'flex' : 'none';
        });
    },
    
    trackBatchChange(productId) {
        const val = parseInt(document.getElementById(`batch_${productId}`).value) || 0;
        if (val !== 0) {
            this.batchStockData[productId] = val;
        } else {
            delete this.batchStockData[productId];
        }
        document.getElementById('batchCount').textContent = Object.keys(this.batchStockData).length;
    },
    
    confirmDeleteBatch(productId) {
        const p = dataManager.getProducts().find(prod => prod.id === productId);
        if (!p) return;
        
        if (!confirm(`⚠️ PERMANEN HAPUS PRODUK\n\n"${p.name}"\n\nStok: ${p.stock}\nHarga: Rp ${utils.formatNumber(p.price)}\n\nProduk akan dihapus dari database. Lanjutkan?`)) {
            return;
        }
        
        dataManager.deleteProduct(productId);
        
        // Refresh modal
        this.closeModal('batchStockModal');
        this.openBatchStock();
        this.renderProducts();
        
        app.showToast(`Produk "${p.name}" dihapus permanen!`);
    },
    
    saveBatchStock() {
        const updates = Object.entries(this.batchStockData);
        
        if (updates.length === 0) {
            app.showToast('Tidak ada perubahan stok');
            return;
        }
        
        updates.forEach(([id, change]) => {
            const product = dataManager.getProducts().find(p => p.id === parseInt(id));
            if (product) {
                const newStock = Math.max(0, product.stock + change);
                dataManager.updateProduct(parseInt(id), { stock: newStock });
            }
        });
        
        this.closeModal('batchStockModal');
        this.renderProducts();
        app.showToast(`${updates.length} produk diupdate!`);
    },
    
    openCategoryModal() {
        const categories = dataManager.getCategories().filter(c => c.id !== 'all');
        
        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal active" id="categoryModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <span class="modal-title">🏷️ Manajemen Kategori</span>
                        <button class="close-btn" onclick="productsModule.closeModal('categoryModal')">×</button>
                    </div>
                    
                    <div class="add-category-row">
                        <input type="text" class="add-category-input" id="newCategoryName" placeholder="Nama kategori baru...">
                        <button class="add-category-btn" onclick="productsModule.addCategory()">+</button>
                    </div>
                    
                    <div id="categoryList">
                        ${categories.map(c => `
                            <div class="category-item">
                                <div class="category-info">
                                    <div class="category-name">${c.icon || '📦'} ${c.name}</div>
                                    <div class="category-count">${dataManager.getProducts().filter(p => p.category === c.id).length} produk</div>
                                </div>
                                <button class="delete-category-btn" onclick="productsModule.deleteCategory('${c.id}')">🗑️</button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `);
    },
    
    addCategory() {
        const name = document.getElementById('newCategoryName').value.trim();
        if (!name) {
            app.showToast('Nama kategori wajib diisi!');
            return;
        }
        
        const id = 'cat_' + Date.now();
        dataManager.data.categories.push({
            id,
            name,
            icon: '📦'
        });
        
        dataManager.save();
        this.closeModal('categoryModal');
        this.openCategoryModal();
        app.showToast('Kategori ditambahkan!');
    },
    
    deleteCategory(categoryId) {
        const productsInCategory = dataManager.getProducts().filter(p => p.category === categoryId);
        
        if (productsInCategory.length > 0) {
            app.showToast(`Tidak bisa hapus! Ada ${productsInCategory.length} produk di kategori ini.`);
            return;
        }
        
        if (!confirm('Hapus kategori ini?')) return;
        
        dataManager.data.categories = dataManager.data.categories.filter(c => c.id !== categoryId);
        dataManager.save();
        this.closeModal('categoryModal');
        this.openCategoryModal();
        app.showToast('Kategori dihapus!');
    },
    
    exportProducts() {
        const products = dataManager.getProducts();
        let csv = 'ID,Nama,Kategori,Harga Jual,Harga Modal,Stok\n';
        
        products.forEach(p => {
            const cat = dataManager.getCategories().find(c => c.id === p.category)?.name || 'Lainnya';
            csv += `${p.id},"${p.name}",${cat},${p.price},${p.cost || 0},${p.stock}\n`;
        });
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `produk-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        
        app.showToast('Data produk diexport!');
    },
    
    
    // IMPORT EXCEL FEATURE
    openImportModal() {
        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal active" id="importModal">
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <span class="modal-title">📤 Import Produk dari Excel</span>
                        <button class="close-btn" onclick="productsModule.closeModal('importModal')">×</button>
                    </div>

                    <!-- Step 1: Upload File -->
                    <div id="importStep1">
                        <div class="upload-area" id="uploadArea" onclick="document.getElementById('excelFile').click()">
                            <div class="upload-icon">📁</div>
                            <div class="upload-text">Klik atau drag file Excel ke sini</div>
                            <div class="upload-hint">Format: .xlsx, .xls (Max 5MB)</div>
                            <input type="file" id="excelFile" accept=".xlsx,.xls" style="display: none;" 
                                   onchange="productsModule.handleFileUpload(event)">
                        </div>

                        <div class="template-download">
                            <button class="btn btn-secondary" onclick="productsModule.downloadTemplate()">
                                📥 Download Template Excel
                            </button>
                        </div>
                    </div>

                    <!-- Step 2: Preview & Mapping -->
                    <div id="importStep2" style="display: none;">
                        <div class="mapping-section">
                            <div class="info-box info" style="margin-bottom: 15px;">
                                <div class="info-title">Mapping Kolom</div>
                                <div class="info-text">Pastikan kolom Excel sesuai dengan data produk</div>
                            </div>

                            <div class="mapping-row">
                                <label>Kolom Nama Produk *</label>
                                <select id="mapName"></select>
                            </div>
                            <div class="mapping-row">
                                <label>Kolom Harga Jual *</label>
                                <select id="mapPrice"></select>
                            </div>
                            <div class="mapping-row">
                                <label>Kolom Harga Modal</label>
                                <select id="mapCost"></select>
                            </div>
                            <div class="mapping-row">
                                <label>Kolom Stok</label>
                                <select id="mapStock"></select>
                            </div>
                            <div class="mapping-row">
                                <label>Kolom Kategori</label>
                                <select id="mapCategory"></select>
                            </div>
                        </div>

                        <div class="preview-section" style="margin-top: 20px;">
                            <div class="preview-header">
                                <span>Preview Data (<span id="previewCount">0</span> baris)</span>
                                <span id="validationStatus"></span>
                            </div>
                            <div class="preview-table-container">
                                <table class="preview-table" id="previewTable">
                                    <thead></thead>
                                    <tbody></tbody>
                                </table>
                            </div>
                        </div>

                        <div class="modal-footer">
                            <button class="btn btn-secondary" onclick="productsModule.backToUpload()">Kembali</button>
                            <button class="btn btn-primary" onclick="productsModule.processImport()">✅ Import Data</button>
                        </div>
                    </div>

                    <!-- Step 3: Progress -->
                    <div id="importStep3" style="display: none;">
                        <div class="progress-container">
                            <div class="progress-header">
                                <span>Mengimport data...</span>
                                <span id="progressPercent">0%</span>
                            </div>
                            <div class="progress-bar">
                                <div class="progress-fill" id="progressFill"></div>
                            </div>
                            <div class="progress-detail" id="progressDetail">Memproses...</div>

                            <div class="progress-stats" id="progressStats" style="display: none;">
                                <div class="stat-item success">
                                    <span class="stat-icon">✅</span>
                                    <span class="stat-text"><span id="successCount">0</span> berhasil</span>
                                </div>
                                <div class="stat-item error">
                                    <span class="stat-icon">❌</span>
                                    <span class="stat-text"><span id="errorCount">0</span> gagal</span>
                                </div>
                            </div>

                            <div class="error-list" id="errorList" style="display: none;">
                                <div class="error-title">Detail Error:</div>
                                <ul id="errorItems"></ul>
                            </div>
                        </div>

                        <div class="modal-footer" id="progressFooter" style="display: none;">
                            <button class="btn btn-secondary" onclick="productsModule.closeModal('importModal')">Tutup</button>
                            <button class="btn btn-primary" onclick="productsModule.finishImport()">Selesai</button>
                        </div>
                    </div>
                </div>
            </div>
        `);

        // Setup drag and drop
        this.setupDragDrop();
    },

    setupDragDrop() {
        const uploadArea = document.getElementById('uploadArea');
        if (!uploadArea) return;

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => {
                uploadArea.classList.add('dragover');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => {
                uploadArea.classList.remove('dragover');
            }, false);
        });

        uploadArea.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].name.match(/\.(xlsx|xls)$/i)) {
                document.getElementById('excelFile').files = files;
                this.handleFileUpload({ target: { files: files } });
            } else {
                app.showToast('Format file tidak valid! Gunakan .xlsx atau .xls');
            }
        }, false);
    },

    handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.name.match(/\.(xlsx|xls)$/i)) {
            app.showToast('Format file tidak valid! Gunakan .xlsx atau .xls');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            app.showToast('File terlalu besar! Maksimal 5MB');
            return;
        }

        this.importedFile = file;
        this.readExcelFile(file);
    },

    readExcelFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

                if (jsonData.length < 2) {
                    app.showToast('File Excel kosong atau tidak valid!');
                    return;
                }

                this.excelData = {
                    headers: jsonData[0],
                    rows: jsonData.slice(1).filter(row => row.some(cell => cell !== undefined && cell !== ''))
                };

                this.showMappingStep();
            } catch (error) {
                console.error(error);
                app.showToast('Gagal membaca file Excel!');
            }
        };
        reader.readAsArrayBuffer(file);
    },

    showMappingStep() {
        document.getElementById('importStep1').style.display = 'none';
        document.getElementById('importStep2').style.display = 'block';

        const headers = this.excelData.headers;
        const selects = ['mapName', 'mapPrice', 'mapCost', 'mapStock', 'mapCategory'];
        const defaults = ['nama', 'harga', 'modal', 'stok', 'kategori'];

        selects.forEach((id, index) => {
            const select = document.getElementById(id);
            select.innerHTML = '<option value="">-- Pilih Kolom --</option>';

            headers.forEach((header, idx) => {
                const option = document.createElement('option');
                option.value = idx;
                option.textContent = header;

                // Auto-mapping berdasarkan nama kolom
                const headerLower = String(header).toLowerCase();
                if (defaults[index] && headerLower.includes(defaults[index])) {
                    option.selected = true;
                }

                select.appendChild(option);
            });

            // Set default untuk kolom wajib jika belum terpilih
            if (id === 'mapName' && !select.value) {
                const nameIdx = headers.findIndex(h => String(h).toLowerCase().includes('nama'));
                if (nameIdx >= 0) select.value = nameIdx;
            }
            if (id === 'mapPrice' && !select.value) {
                const priceIdx = headers.findIndex(h => 
                    String(h).toLowerCase().includes('harga') || 
                    String(h).toLowerCase().includes('price')
                );
                if (priceIdx >= 0) select.value = priceIdx;
            }
        });

        this.updatePreview();

        // Event listener untuk update preview saat mapping berubah
        selects.forEach(id => {
            document.getElementById(id).addEventListener('change', () => this.updatePreview());
        });
    },

    updatePreview() {
        const nameCol = parseInt(document.getElementById('mapName').value);
        const priceCol = parseInt(document.getElementById('mapPrice').value);
        const costCol = document.getElementById('mapCost').value !== '' ? parseInt(document.getElementById('mapCost').value) : -1;
        const stockCol = document.getElementById('mapStock').value !== '' ? parseInt(document.getElementById('mapStock').value) : -1;
        const categoryCol = document.getElementById('mapCategory').value !== '' ? parseInt(document.getElementById('mapCategory').value) : -1;

        const previewRows = this.excelData.rows.slice(0, 5); // Preview 5 baris pertama
        const tbody = document.querySelector('#previewTable tbody');
        const thead = document.querySelector('#previewTable thead');

        // Header tabel
        thead.innerHTML = `
            <tr>
                <th>Nama Produk</th>
                <th>Harga Jual</th>
                <th>Harga Modal</th>
                <th>Stok</th>
                <th>Kategori</th>
                <th>Status</th>
            </tr>
        `;

        let validCount = 0;
        let invalidCount = 0;

        tbody.innerHTML = previewRows.map((row, idx) => {
            const name = nameCol >= 0 ? String(row[nameCol] || '').trim() : '';
            const price = priceCol >= 0 ? parseFloat(row[priceCol]) || 0 : 0;
            const cost = costCol >= 0 ? parseFloat(row[costCol]) || 0 : 0;
            const stock = stockCol >= 0 ? parseInt(row[stockCol]) || 0 : 0;
            const category = categoryCol >= 0 ? String(row[categoryCol] || '').trim() : '';

            const errors = [];
            if (!name) errors.push('Nama kosong');
            if (price <= 0) errors.push('Harga tidak valid');

            const isValid = errors.length === 0;
            if (isValid) validCount++; else invalidCount++;

            return `
                <tr class="${isValid ? 'valid' : 'invalid'}">
                    <td>${name || '-'}</td>
                    <td>${price > 0 ? 'Rp ' + utils.formatNumber(price) : '-'}</td>
                    <td>${cost > 0 ? 'Rp ' + utils.formatNumber(cost) : '-'}</td>
                    <td>${stock}</td>
                    <td>${category || '-'}</td>
                    <td>${isValid ? '✅' : '<span title="' + errors.join(', ') + '">❌ ' + errors[0] + '</span>'}</td>
                </tr>
            `;
        }).join('');

        document.getElementById('previewCount').textContent = this.excelData.rows.length;

        const statusEl = document.getElementById('validationStatus');
        if (invalidCount > 0) {
            statusEl.innerHTML = `<span class="validation-error">${invalidCount} baris bermasalah</span>`;
        } else {
            statusEl.innerHTML = `<span class="validation-success">Semua valid</span>`;
        }
    },

    validateImportData() {
        const nameCol = parseInt(document.getElementById('mapName').value);
        const priceCol = parseInt(document.getElementById('mapPrice').value);
        const costCol = document.getElementById('mapCost').value !== '' ? parseInt(document.getElementById('mapCost').value) : -1;
        const stockCol = document.getElementById('mapStock').value !== '' ? parseInt(document.getElementById('mapStock').value) : -1;
        const categoryCol = document.getElementById('mapCategory').value !== '' ? parseInt(document.getElementById('mapCategory').value) : -1;

        if (isNaN(nameCol) || isNaN(priceCol)) {
            app.showToast('Kolom Nama dan Harga Jual wajib dipilih!');
            return null;
        }

        const validData = [];
        const errors = [];

        this.excelData.rows.forEach((row, idx) => {
            const name = nameCol >= 0 ? String(row[nameCol] || '').trim() : '';
            const price = priceCol >= 0 ? parseFloat(row[priceCol]) || 0 : 0;
            const cost = costCol >= 0 ? parseFloat(row[costCol]) || 0 : 0;
            const stock = stockCol >= 0 ? parseInt(row[stockCol]) || 0 : 0;
            const category = categoryCol >= 0 ? String(row[categoryCol] || '').trim() : '';

            if (!name) {
                errors.push({ row: idx + 2, message: 'Nama produk kosong' });
                return;
            }
            if (price <= 0) {
                errors.push({ row: idx + 2, message: 'Harga jual tidak valid' });
                return;
            }

            validData.push({
                name,
                price,
                cost: cost || Math.floor(price * 0.7),
                stock,
                category
            });
        });

        return { validData, errors };
    },

    async processImport() {
        const validation = this.validateImportData();
        if (!validation) return;

        const { validData, errors } = validation;

        if (validData.length === 0) {
            app.showToast('Tidak ada data valid untuk diimport!');
            return;
        }

        // Tampilkan step progress
        document.getElementById('importStep2').style.display = 'none';
        document.getElementById('importStep3').style.display = 'block';

        const total = validData.length;
        let processed = 0;
        let success = 0;
        let failed = 0;
        const errorDetails = [...errors];

        // Proses import dengan delay untuk menampilkan progress
        for (let i = 0; i < validData.length; i++) {
            const item = validData[i];

            try {
                // Cek kategori
                let categoryId = 'all';
                if (item.category) {
                    const existingCat = dataManager.getCategories().find(c => 
                        c.name.toLowerCase() === item.category.toLowerCase()
                    );
                    if (existingCat) {
                        categoryId = existingCat.id;
                    } else {
                        // Buat kategori baru
                        categoryId = 'cat_' + Date.now() + '_' + i;
                        dataManager.data.categories.push({
                            id: categoryId,
                            name: item.category,
                            icon: '📦'
                        });
                    }
                }

                const product = {
                    id: Date.now() + i,
                    name: item.name,
                    price: item.price,
                    cost: item.cost,
                    stock: item.stock,
                    category: categoryId
                };

                dataManager.addProduct(product);
                success++;
            } catch (err) {
                failed++;
                errorDetails.push({ row: i + 2, message: 'Gagal menyimpan: ' + err.message });
            }

            processed++;

            // Update progress setiap 10 item atau item terakhir
            if (processed % 10 === 0 || processed === total) {
                const percent = Math.round((processed / total) * 100);
                document.getElementById('progressPercent').textContent = percent + '%';
                document.getElementById('progressFill').style.width = percent + '%';
                document.getElementById('progressDetail').textContent = 
                    `Memproses ${processed} dari ${total} produk...`;

                // Delay untuk animasi
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }

        // Tampilkan hasil
        document.getElementById('progressDetail').textContent = 'Import selesai!';
        document.getElementById('progressStats').style.display = 'flex';
        document.getElementById('successCount').textContent = success;
        document.getElementById('errorCount').textContent = failed + errors.length;
        document.getElementById('progressFooter').style.display = 'flex';

        if (errorDetails.length > 0) {
            document.getElementById('errorList').style.display = 'block';
            document.getElementById('errorItems').innerHTML = errorDetails
                .slice(0, 10)
                .map(e => `<li>Baris ${e.row}: ${e.message}</li>`)
                .join('') + (errorDetails.length > 10 ? `<li>... dan ${errorDetails.length - 10} error lainnya</li>` : '');
        }

        this.renderProducts();
    },

    backToUpload() {
        document.getElementById('importStep2').style.display = 'none';
        document.getElementById('importStep1').style.display = 'block';
        this.importedFile = null;
        this.excelData = null;
    },

    finishImport() {
        this.closeModal('importModal');
        this.renderProducts();
    },

    downloadTemplate() {
        const template = [
            ['Nama Produk', 'Harga Jual', 'Harga Modal', 'Stok', 'Kategori'],
            ['Contoh Produk A', '50000', '35000', '10', 'Elektronik'],
            ['Contoh Produk B', '25000', '15000', '20', 'Aksesoris'],
            ['Contoh Produk C', '100000', '70000', '5', 'Gadget']
        ];

        const ws = XLSX.utils.aoa_to_sheet(template);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Template Produk');

        XLSX.writeFile(wb, 'template-import-produk.xlsx');
        app.showToast('Template di-download!');
    },

    closeModal(id) {
        document.getElementById(id)?.remove();
    }
};
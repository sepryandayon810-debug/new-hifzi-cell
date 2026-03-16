const posModule = {
    cart: [],
    currentCategory: 'all',
    productViewMode: 'grid',

    init() {
        this.renderHTML();
        this.renderCategories();
        this.renderProducts();
    },

    renderHTML() {
        document.getElementById('mainContent').innerHTML = `
            <div class="content-section active" id="posSection">
                <!-- Cart Card -->
                <div class="card" id="cartCard" style="display: none;">
                    <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <span class="card-title">🛒 Keranjang</span>
                        <button class="btn-sm btn-danger-sm" onclick="posModule.clearCart()">🗑️ Kosongkan</button>
                    </div>
                    <div id="cartItemsList"></div>
                    <div style="margin-top: 15px; padding-top: 15px; border-top: 2px solid #f0f0f0;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-weight: 600;">Total:</span>
                            <span style="font-size: 20px; font-weight: 700; color: var(--primary);" id="cartCardTotal">Rp 0</span>
                        </div>
                    </div>
                </div>

                <!-- Products Card -->
                <div class="card">
                    <div class="card-header">
                        <span class="card-title">Menu Kasir</span>
                    </div>

                    <div class="category-pills" id="categoryPills"></div>

                    <!-- Input Manual Button -->
                    <button class="btn btn-primary" onclick="posModule.openManualProductModal()" 
                            style="width: 100%; margin-bottom: 15px; padding: 15px; font-size: 16px;">
                        ➕ Input Produk Manual
                    </button>

                    <!-- View Toggle -->
                    <div class="view-toggle">
                        <button class="view-btn active" onclick="posModule.setView('grid')" id="btnGridView">
                            ⊞ Grid
                        </button>
                        <button class="view-btn" onclick="posModule.setView('list')" id="btnListView">
                            ☰ List
                        </button>
                    </div>

                    <!-- Search -->
                    <div class="search-bar">
                        <input type="text" placeholder="Cari produk..." id="searchProduct" 
                               onkeyup="posModule.searchProducts()">
                        <button onclick="posModule.searchProducts()">🔍</button>
                    </div>

                    <!-- Products Grid -->
                    <div class="products-grid" id="productsGrid"></div>
                </div>
            </div>
        `;
    },

    renderCategories() {
        const container = document.getElementById('categoryPills');
        const categories = dataManager.getCategories();

        container.innerHTML = categories.map(cat => `
            <button class="pill ${this.currentCategory === cat.id ? 'active' : ''}" 
                    onclick="posModule.selectCategory('${cat.id}')">
                ${cat.name}
            </button>
        `).join('');
    },

    renderProducts() {
        const container = document.getElementById('productsGrid');
        const search = document.getElementById('searchProduct')?.value.toLowerCase() || '';

        let products = dataManager.getProducts();

        if (this.currentCategory !== 'all') {
            products = products.filter(p => p.category === this.currentCategory);
        }

        if (search) {
            products = products.filter(p => p.name.toLowerCase().includes(search));
        }

        if (products.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column: 1/-1;">
                    <div class="empty-icon">📦</div>
                    <p>Tidak ada produk</p>
                    <button class="btn btn-primary" onclick="posModule.openManualProductModal()" style="margin-top: 10px;">
                        Input Produk Manual
                    </button>
                </div>`;
            return;
        }

        container.innerHTML = products.map(p => {
            const inCart = this.cart.find(c => c.id === p.id);
            return `
                <div class="product-card ${inCart ? 'selected' : ''}" onclick="posModule.addToCart(${p.id})">
                    <div class="product-img">📱</div>
                    <div class="product-name">${p.name}</div>
                    <div class="product-price">Rp ${utils.formatNumber(p.price)}</div>
                    <div class="product-stock">Stok: ${p.stock}</div>
                    ${inCart ? `<div style="color: var(--primary); font-weight: 600; margin-top: 5px;">
                        ${inCart.qty} di keranjang
                    </div>` : ''}
                </div>
            `;
        }).join('');
    },

    selectCategory(id) {
        this.currentCategory = id;
        this.renderCategories();
        this.renderProducts();
    },

    setView(mode) {
        this.productViewMode = mode;
        document.getElementById('btnGridView').classList.toggle('active', mode === 'grid');
        document.getElementById('btnListView').classList.toggle('active', mode === 'list');

        const grid = document.getElementById('productsGrid');
        if (mode === 'list') {
            grid.classList.add('list-view');
        } else {
            grid.classList.remove('list-view');
        }

        this.renderProducts();
    },

    searchProducts() {
        this.renderProducts();
    },

    // INPUT MANUAL PRODUCT - TIDAK MASUK DATABASE
    openManualProductModal() {
        // Check kasir status
        if (!dataManager.data.kasir || !dataManager.data.kasir.isOpen) {
            app.showToast('⚠️ Kasir belum dibuka! Silakan buka kasir terlebih dahulu di menu Pengaturan (⚙️)');
            return;
        }

        const categories = dataManager.getCategories().filter(c => c.id !== 'all');

        const modalHTML = `
            <div class="modal active" id="manualProductModal" style="display: flex; z-index: 2000;">
                <div class="modal-content" style="max-width: 400px; max-height: 90vh; overflow-y: auto;">
                    <div class="modal-header">
                        <span class="modal-title">➕ Input Produk Manual</span>
                        <button class="close-btn" onclick="posModule.closeManualModal()">×</button>
                    </div>

                    <div class="info-box warning" style="margin-bottom: 15px;">
                        <div class="info-title">📌 Mode Manual</div>
                        <div class="info-text">
                            Produk akan langsung masuk ke keranjang sebagai item transaksi.
                            Tidak akan disimpan ke database produk.
                        </div>
                    </div>

                    <div class="form-group">
                        <label>Nama Produk / Jasa *</label>
                        <input type="text" id="manualProdName" placeholder="Contoh: Pulsa 50rb, Servis LCD">
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label>Harga Jual (Rp) *</label>
                            <input type="number" id="manualProdPrice" placeholder="0" oninput="posModule.calcManualSubtotal()">
                        </div>
                        <div class="form-group">
                            <label>Harga Modal (Rp)</label>
                            <input type="number" id="manualProdCost" placeholder="0 (untuk hitung laba)">
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label>Jumlah (Qty) *</label>
                            <input type="number" id="manualProdQty" value="1" min="1" placeholder="1" oninput="posModule.calcManualSubtotal()">
                        </div>
                        <div class="form-group">
                            <label>Kategori (untuk laporan)</label>
                            <select id="manualProdCategory">
                                ${categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                                <option value="lainnya">Lainnya</option>
                            </select>
                        </div>
                    </div>

                    <div class="calculation-box" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                        <div class="calc-row" style="font-size: 20px; font-weight: 700; border: none;">
                            <span>Subtotal:</span>
                            <span id="manualProdSubtotal">Rp 0</span>
                        </div>
                    </div>

                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="posModule.closeManualModal()">Batal</button>
                        <button class="btn btn-primary" onclick="posModule.saveManualProduct()">
                            ➕ Tambah ke Keranjang
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        setTimeout(() => document.getElementById('manualProdName')?.focus(), 100);
    },

    closeManualModal() {
        const modal = document.getElementById('manualProductModal');
        if (modal) {
            modal.remove();
        }
    },

    calcManualSubtotal() {
        const price = parseInt(document.getElementById('manualProdPrice')?.value) || 0;
        const qty = parseInt(document.getElementById('manualProdQty')?.value) || 0;
        const subtotal = price * qty;

        const el = document.getElementById('manualProdSubtotal');
        if (el) {
            el.textContent = 'Rp ' + utils.formatNumber(subtotal);
        }
    },

    // PERBAIKAN: Manual product hanya masuk keranjang, TIDAK masuk database
    saveManualProduct() {
        const nameInput = document.getElementById('manualProdName');
        const priceInput = document.getElementById('manualProdPrice');
        const costInput = document.getElementById('manualProdCost');
        const qtyInput = document.getElementById('manualProdQty');
        const categoryInput = document.getElementById('manualProdCategory');

        const name = nameInput?.value.trim();
        const price = parseInt(priceInput?.value) || 0;
        const cost = parseInt(costInput?.value) || 0;
        const qty = parseInt(qtyInput?.value) || 1;
        const category = categoryInput?.value || 'lainnya';

        // Validasi
        if (!name) {
            app.showToast('❌ Nama produk wajib diisi!');
            nameInput?.focus();
            return;
        }

        if (price <= 0) {
            app.showToast('❌ Harga jual harus lebih dari 0!');
            priceInput?.focus();
            return;
        }

        if (qty <= 0) {
            app.showToast('❌ Jumlah minimal 1!');
            return;
        }

        // PERBAIKAN: Buat ID unik untuk item manual (negatif agar tidak bentrok dengan produk database)
        const manualId = -Date.now();

        // Tambahkan langsung ke keranjang, TIDAK ke database produk
        this.cart.push({
            id: manualId, // ID negatif menandakan item manual
            name: name,
            price: price,
            originalPrice: price, // Simpan harga asli
            cost: cost || Math.floor(price * 0.7),
            qty: qty,
            isManual: true,
            category: category,
            priceEdited: false
        });

        this.updateCart();
        this.closeManualModal();

        const subtotal = price * qty;
        app.showToast(`✅ ${name} (${qty}x) ditambahkan! Subtotal: Rp ${utils.formatNumber(subtotal)}`);
    },

    addToCart(productId) {
        // Check kasir status
        if (!dataManager.data.kasir || !dataManager.data.kasir.isOpen) {
            app.showToast('⚠️ Kasir belum dibuka! Buka kasir di Pengaturan (⚙️)');
            return;
        }

        const product = dataManager.getProducts().find(p => p.id === productId);
        if (!product) return;

        const existing = this.cart.find(c => c.id === productId);

        if (existing) {
            if (existing.qty >= product.stock && !product.isManual) {
                app.showToast('❌ Stok tidak mencukupi!');
                return;
            }
            existing.qty++;
        } else {
            if (product.stock < 1 && !product.isManual) {
                app.showToast('❌ Stok habis!');
                return;
            }
            this.cart.push({
                id: product.id,
                name: product.name,
                price: product.price,
                originalPrice: product.price, // Simpan harga asli untuk referensi
                cost: product.cost || 0,
                qty: 1,
                priceEdited: false
            });
        }

        this.updateCart();
        this.renderProducts();
        app.showToast('✅ Ditambahkan ke keranjang');
    },

    decreaseQty(productId) {
        const item = this.cart.find(c => c.id === productId);
        if (!item) return;

        if (item.qty > 1) {
            item.qty--;
        } else {
            this.removeFromCart(productId);
            return;
        }

        this.updateCart();
        this.renderProducts();
    },

    removeFromCart(productId) {
        const item = this.cart.find(c => c.id === productId);
        if (!item) return;

        if (confirm(`Hapus ${item.name} dari keranjang?`)) {
            this.cart = this.cart.filter(c => c.id !== productId);
            this.updateCart();
            this.renderProducts();
        }
    },

    // FITUR BARU: Edit harga item di keranjang
    openEditPriceModal(productId) {
        const item = this.cart.find(c => c.id === productId);
        if (!item) return;

        const modalHTML = `
            <div class="modal active" id="editPriceModal" style="display: flex; z-index: 2000;">
                <div class="modal-content" style="max-width: 350px;">
                    <div class="modal-header">
                        <span class="modal-title">✏️ Edit Harga</span>
                        <button class="close-btn" onclick="posModule.closeEditPriceModal()">×</button>
                    </div>

                    <div style="margin-bottom: 20px;">
                        <div style="font-weight: 600; font-size: 16px; margin-bottom: 5px;">${item.name}</div>
                        <div style="color: #666; font-size: 14px;">Jumlah: ${item.qty} pcs</div>
                    </div>

                    <div class="form-group">
                        <label>Harga Asli</label>
                        <input type="text" value="Rp ${utils.formatNumber(item.originalPrice)}" disabled 
                               style="background: #f5f5f5; color: #999;">
                    </div>

                    <div class="form-group">
                        <label>Harga Baru (Rp) *</label>
                        <input type="number" id="newPriceInput" value="${item.price}" 
                               placeholder="0" autofocus
                               onkeyup="if(event.key==='Enter')posModule.saveEditPrice(${productId})">
                    </div>

                    <div class="info-box warning" style="margin: 15px 0; font-size: 12px;">
                        <div class="info-text">
                            💡 Harga yang diubah hanya berlaku untuk transaksi ini saja.
                            Harga di database produk tidak akan berubah.
                        </div>
                    </div>

                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="posModule.closeEditPriceModal()">Batal</button>
                        <button class="btn btn-primary" onclick="posModule.saveEditPrice(${productId})">
                            💾 Simpan Harga
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Focus ke input harga baru
        setTimeout(() => {
            const input = document.getElementById('newPriceInput');
            if (input) {
                input.focus();
                input.select();
            }
        }, 100);
    },

    closeEditPriceModal() {
        const modal = document.getElementById('editPriceModal');
        if (modal) modal.remove();
    },

    saveEditPrice(productId) {
        const item = this.cart.find(c => c.id === productId);
        if (!item) return;

        const newPrice = parseInt(document.getElementById('newPriceInput')?.value) || 0;

        if (newPrice < 0) {
            app.showToast('❌ Harga tidak boleh negatif!');
            return;
        }

        if (newPrice === 0) {
            if (!confirm('Harga 0 akan dianggap sebagai gratis/bonus. Lanjutkan?')) {
                return;
            }
        }

        // Update harga
        item.price = newPrice;
        item.priceEdited = newPrice !== item.originalPrice;

        this.closeEditPriceModal();
        this.updateCart();

        const diff = newPrice - item.originalPrice;
        const diffText = diff > 0 ? `+Rp ${utils.formatNumber(diff)}` : diff < 0 ? `-Rp ${utils.formatNumber(Math.abs(diff))}` : 'tidak berubah';

        app.showToast(`✅ Harga ${item.name} diubah! (${diffText})`);
    },

    clearCart() {
        if (this.cart.length === 0) return;
        if (!confirm('Kosongkan semua keranjang?')) return;

        this.cart = [];
        this.updateCart();
        this.renderProducts();
        app.showToast('Keranjang dikosongkan');
    },

    updateCart() {
        const total = this.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const count = this.cart.reduce((sum, item) => sum + item.qty, 0);

        document.getElementById('cartTotal').textContent = 'Rp ' + utils.formatNumber(total);
        document.getElementById('cartItemCount').textContent = count + ' item';
        document.getElementById('checkoutBtn').disabled = this.cart.length === 0;

        this.renderCartItems();
    },

    renderCartItems() {
        const container = document.getElementById('cartItemsList');
        const card = document.getElementById('cartCard');

        if (this.cart.length === 0) {
            card.style.display = 'none';
            return;
        }

        card.style.display = 'block';

        container.innerHTML = this.cart.map(item => {
            const subtotal = item.price * item.qty;
            const isPriceEdited = item.priceEdited || item.price !== item.originalPrice;
            const priceDiff = item.price - item.originalPrice;

            return `
            <div class="cart-item" style="display: flex; align-items: center; padding: 12px; background: #f8f9fa; border-radius: 12px; margin-bottom: 10px; border: 1px solid #e0e0e0; ${isPriceEdited ? 'border-left: 4px solid var(--warning);' : ''}">
                <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.name}</div>
                    <div style="font-size: 12px; color: #666; display: flex; align-items: center; gap: 5px; flex-wrap: wrap;">
                        <span>Rp ${utils.formatNumber(item.price)}</span>
                        ${isPriceEdited ? `
                            <span style="color: var(--warning); font-size: 10px;">
                                (asli: Rp ${utils.formatNumber(item.originalPrice)})
                            </span>
                            ${priceDiff > 0 ? '<span style="color: var(--danger); font-size: 10px;">▲ Naik</span>' : priceDiff < 0 ? '<span style="color: var(--success); font-size: 10px;">▼ Turun</span>' : ''}
                        ` : ''}
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; margin-right: 10px;">
                    <button class="qty-btn minus" onclick="posModule.decreaseQty(${item.id})" style="width: 32px; height: 32px; border-radius: 50%; border: none; background: #ffebee; color: var(--danger); font-size: 18px; cursor: pointer;">−</button>
                    <span style="font-weight: 700; min-width: 30px; text-align: center;">${item.qty}</span>
                    <button class="qty-btn" onclick="posModule.addToCart(${item.id})" style="width: 32px; height: 32px; border-radius: 50%; border: none; background: var(--primary); color: white; font-size: 18px; cursor: pointer;">+</button>
                </div>
                <div style="font-weight: 700; min-width: 80px; text-align: right; font-size: 14px;">
                    Rp ${utils.formatNumber(subtotal)}
                </div>
                <div style="display: flex; flex-direction: column; gap: 5px; margin-left: 8px;">
                    <button onclick="posModule.openEditPriceModal(${item.id})" 
                            style="width: 32px; height: 32px; border-radius: 50%; border: none; background: #fff3e0; color: var(--warning); cursor: pointer; font-size: 14px;" 
                            title="Edit Harga">
                        ✏️
                    </button>
                    <button onclick="posModule.removeFromCart(${item.id})" 
                            style="width: 32px; height: 32px; border-radius: 50%; border: none; background: #ffebee; color: var(--danger); cursor: pointer; font-size: 14px;" 
                            title="Hapus">
                        🗑️
                    </button>
                </div>
            </div>
        `}).join('');

        const total = this.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        document.getElementById('cartCardTotal').textContent = 'Rp ' + utils.formatNumber(total);
    },

    // PERBAIKAN: Tambah tombol "Uang Pas"
    openCheckout() {
        if (this.cart.length === 0) return;

        const total = this.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

        const modalHTML = `
            <div class="modal active" id="checkoutModal" style="display: flex; z-index: 2000;">
                <div class="modal-content">
                    <div class="modal-header">
                        <span class="modal-title">💳 Pembayaran</span>
                        <button class="close-btn" onclick="posModule.closeCheckout()">×</button>
                    </div>

                    <div style="background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%); color: white; padding: 20px; border-radius: 16px; margin-bottom: 20px; text-align: center;">
                        <div style="font-size: 14px; opacity: 0.9; margin-bottom: 5px;">Total Belanja</div>
                        <div style="font-size: 36px; font-weight: 700;">Rp ${utils.formatNumber(total)}</div>
                    </div>

                    <div class="form-group">
                        <label>Metode Pembayaran</label>
                        <select id="paymentMethod" onchange="posModule.handlePaymentChange()">
                            <option value="cash">💵 Tunai</option>
                            <option value="debit">💳 Kartu Debit</option>
                            <option value="qris">📱 QRIS</option>
                            <option value="transfer">🏦 Transfer Bank</option>
                        </select>
                    </div>

                    <div id="cashSection">
                        <div class="form-group" style="position: relative;">
                            <label>Uang Diterima (Rp)</label>
                            <input type="number" id="cashReceived" placeholder="0" onkeyup="posModule.calculateChange()">

                            <!-- TOMBOL UANG PAS -->
                            <button onclick="posModule.setUangPas()" 
                                    style="position: absolute; right: 5px; top: 32px; 
                                           background: var(--success); color: white; 
                                           border: none; padding: 8px 15px; border-radius: 8px;
                                           font-size: 12px; font-weight: 600; cursor: pointer;">
                                💵 Uang Pas
                            </button>
                        </div>

                        <div class="form-group" id="changeGroup" style="display: none; background: #e8f5e9; padding: 15px; border-radius: 12px;">
                            <label style="color: var(--success); font-weight: 600;">Kembalian</label>
                            <div style="font-size: 28px; font-weight: 700; color: var(--success);" id="changeAmount">Rp 0</div>
                        </div>
                    </div>

                    <div class="checkbox-group" onclick="document.getElementById('autoPrint').click()" style="display: flex; align-items: center; gap: 10px; padding: 12px; background: #f8f9fa; border-radius: 12px; cursor: pointer; margin: 15px 0;">
                        <input type="checkbox" id="autoPrint" style="width: 20px; height: 20px;">
                        <label for="autoPrint" style="font-weight: 600; cursor: pointer;">🖨️ Cetak struk setelah pembayaran</label>
                    </div>

                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="posModule.closeCheckout()">Batal</button>
                        <button class="btn btn-primary" onclick="posModule.processPayment()" style="font-size: 18px;">✅ Proses Bayar</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    closeCheckout() {
        const modal = document.getElementById('checkoutModal');
        if (modal) modal.remove();
    },

    // PERBAIKAN: Tombol Uang Pas
    setUangPas() {
        const total = this.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const input = document.getElementById('cashReceived');
        if (input) {
            input.value = total;
            this.calculateChange();
        }
    },

    handlePaymentChange() {
        const method = document.getElementById('paymentMethod').value;
        const isCash = method === 'cash';
        const cashSection = document.getElementById('cashSection');

        if (cashSection) {
            cashSection.style.display = isCash ? 'block' : 'none';
        }

        // Reset change display
        const changeGroup = document.getElementById('changeGroup');
        if (changeGroup) {
            changeGroup.style.display = 'none';
        }
    },

    calculateChange() {
        const total = this.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const received = parseInt(document.getElementById('cashReceived').value) || 0;
        const change = received - total;

        const changeGroup = document.getElementById('changeGroup');
        const changeAmount = document.getElementById('changeAmount');

        if (received > 0) {
            changeGroup.style.display = 'block';
            changeAmount.textContent = 'Rp ' + utils.formatNumber(change);
            changeAmount.style.color = change >= 0 ? 'var(--success)' : 'var(--danger)';
        } else {
            changeGroup.style.display = 'none';
        }
    },

    processPayment() {
        const total = this.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const received = parseInt(document.getElementById('cashReceived').value) || 0;
        const method = document.getElementById('paymentMethod').value;
        const shouldPrint = document.getElementById('autoPrint').checked;

        if (method === 'cash' && received < total) {
            app.showToast('❌ Uang tidak mencukupi!');
            return;
        }

        // Create transaction
        const transaction = {
            id: Date.now(),
            date: new Date().toISOString(),
            items: [...this.cart],
            total: total,
            profit: this.cart.reduce((sum, item) => sum + ((item.price - (item.cost || 0)) * item.qty), 0),
            paymentMethod: method,
            received: method === 'cash' ? received : total,
            change: method === 'cash' ? received - total : 0,
            status: 'completed',
            transactionNumber: 'TRX-' + Date.now().toString().slice(-8)
        };

        // Save transaction
        dataManager.data.transactions.push(transaction);

        // Update stock hanya untuk produk dari database (ID positif)
        this.cart.forEach(item => {
            if (item.id > 0) { // ID positif = produk database
                const product = dataManager.data.products.find(p => p.id === item.id);
                if (product) product.stock -= item.qty;
            }
        });

        // Update cash
        dataManager.data.settings.currentCash += total;
        dataManager.save();

        // Print if requested
        if (shouldPrint) {
            this.printReceipt(transaction);
        }

        // Reset cart
        this.cart = [];
        this.updateCart();
        this.renderProducts();
        this.closeCheckout();
        app.updateHeader();

        app.showToast('✅ Pembayaran berhasil! 🎉');
    },

    printReceipt(transaction) {
        const header = dataManager.data.settings.receiptHeader || {};

        const receiptLines = [
            '================================',
            '    ' + (header.storeName || 'HIFZI CELL').toUpperCase(),
            '    ' + (header.address || ''),
            header.phone ? '    HP: ' + header.phone : '',
            '================================',
            'No: ' + transaction.transactionNumber,
            'Tgl: ' + new Date(transaction.date).toLocaleString('id-ID'),
            '--------------------------------'
        ];

        transaction.items.forEach(item => {
            receiptLines.push(item.name);
            // Tampilkan indikator jika harga diubah
            const priceIndicator = item.priceEdited || item.price !== item.originalPrice ? '*' : '';
            receiptLines.push(item.qty + ' x Rp ' + utils.formatNumber(item.price) + priceIndicator + ' = Rp ' + utils.formatNumber(item.qty * item.price));
        });

        receiptLines.push('--------------------------------');
        receiptLines.push('Total:      Rp ' + utils.formatNumber(transaction.total));

        if (transaction.paymentMethod === 'cash') {
            receiptLines.push('Bayar:      Rp ' + utils.formatNumber(transaction.received));
            receiptLines.push('Kembali:    Rp ' + utils.formatNumber(transaction.change));
        } else {
            receiptLines.push('Metode:     ' + transaction.paymentMethod.toUpperCase());
        }

        // Tambahkan keterangan jika ada harga yang diubah
        const hasEditedPrice = transaction.items.some(item => item.priceEdited || item.price !== item.originalPrice);
        if (hasEditedPrice) {
            receiptLines.push('--------------------------------');
            receiptLines.push('* Harga telah disesuaikan');
        }

        receiptLines.push('================================');
        receiptLines.push(header.note || 'Terima kasih atas kunjungan Anda');
        receiptLines.push('================================');

        const receipt = receiptLines.join('\n');

        const w = window.open('', '_blank');
        w.document.write(`
            <html>
            <head>
                <title>Struk ${transaction.transactionNumber}</title>
                <style>
                    body { 
                        font-family: 'Courier New', monospace; 
                        padding: 20px; 
                        white-space: pre-wrap;
                        font-size: 12px;
                        line-height: 1.4;
                    }
                    @media print {
                        body { padding: 0; margin: 0; }
                    }
                </style>
            </head>
            <body>${receipt}</body>
            </html>
        `);
        w.document.close();
        w.print();
    }
};
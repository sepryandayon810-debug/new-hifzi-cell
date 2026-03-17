const posModule = {
    cart: [],
    currentProduct: null,
    searchTimeout: null,

    init() {
        this.cart = [];
        this.render();
    },

    render() {
        const container = document.getElementById('mainContent');
        container.innerHTML = `
            <div class="content-section active" id="posSection">
                <div class="search-bar" style="margin-bottom: 15px;">
                    <input type="text" id="productSearch" placeholder="Cari produk (nama/barcode)..." 
                           oninput="posModule.searchProducts(this.value)">
                    <button onclick="posModule.scanBarcode()">📷</button>
                </div>
                
                <div id="searchResults" style="margin-bottom: 15px;"></div>
                
                <div class="card">
                    <div class="card-header">
                        <span class="card-title">🛒 Keranjang</span>
                        <button class="btn-sm btn-danger-sm" onclick="posModule.clearCart()" 
                                ${this.cart.length === 0 ? 'disabled' : ''}>Kosongkan</button>
                    </div>
                    <div id="cartItems">
                        ${this.renderCartItems()}
                    </div>
                </div>

                <div class="card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-size: 14px; opacity: 0.9;">Total Belanja</div>
                            <div style="font-size: 28px; font-weight: 700;" id="posTotal">Rp 0</div>
                        </div>
                        <button class="btn" onclick="posModule.openCheckout()" 
                                style="background: white; color: #667eea; ${this.cart.length === 0 ? 'opacity: 0.5;' : ''}"
                                ${this.cart.length === 0 ? 'disabled' : ''}>
                            Bayar →
                        </button>
                    </div>
                </div>
            </div>
        `;

        this.updateCartTotal();
        document.getElementById('productSearch').focus();
    },

    renderCartItems() {
        if (this.cart.length === 0) {
            return `<div class="empty-state"><div class="empty-icon">🛒</div><p>Keranjang kosong</p></div>`;
        }

        return this.cart.map((item, index) => `
            <div class="cart-item" style="display: flex; align-items: center; padding: 12px; background: #f8f9fa; border-radius: 12px; margin-bottom: 10px; border: 1px solid #e0e0e0;">
                <div style="flex: 1;">
                    <div style="font-weight: 600; font-size: 14px;">${item.name}</div>
                    <div style="font-size: 12px; color: #666;">Rp ${utils.formatNumber(item.price)} × ${item.qty}</div>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <button class="qty-btn" onclick="posModule.updateQty(${index}, -1)" style="width: 32px; height: 32px; border-radius: 50%; border: none; background: #e0e0e0; cursor: pointer;">-</button>
                    <span style="font-weight: 700; min-width: 30px; text-align: center;">${item.qty}</span>
                    <button class="qty-btn" onclick="posModule.updateQty(${index}, 1)" style="width: 32px; height: 32px; border-radius: 50%; border: none; background: #e0e0e0; cursor: pointer;">+</button>
                    <button onclick="posModule.removeFromCart(${index})" style="width: 32px; height: 32px; border-radius: 50%; border: none; background: #ffebee; color: #f44336; cursor: pointer; margin-left: 10px;">🗑️</button>
                </div>
            </div>
        `).join('');
    },

    searchProducts(query) {
        clearTimeout(this.searchTimeout);
        
        if (!query.trim()) {
            document.getElementById('searchResults').innerHTML = '';
            return;
        }

        this.searchTimeout = setTimeout(() => {
            const products = dataManager.data.products.filter(p => 
                p.name.toLowerCase().includes(query.toLowerCase()) ||
                (p.barcode && p.barcode.includes(query))
            );

            const resultsDiv = document.getElementById('searchResults');
            
            if (products.length === 0) {
                resultsDiv.innerHTML = `<div class="info-box warning"><div class="info-title">Produk tidak ditemukan</div></div>`;
                return;
            }

            resultsDiv.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px;">
                    ${products.map(p => `
                        <div onclick="posModule.addToCart('${p.id}')" 
                             style="background: white; padding: 15px; border-radius: 12px; cursor: pointer; border: 2px solid #e0e0e0; transition: all 0.2s;"
                             onmouseover="this.style.borderColor='#667eea'" 
                             onmouseout="this.style.borderColor='#e0e0e0'">
                            <div style="font-weight: 600; font-size: 14px; margin-bottom: 5px;">${p.name}</div>
                            <div style="color: #667eea; font-weight: 700;">Rp ${utils.formatNumber(p.price)}</div>
                            <div style="font-size: 11px; color: #999; margin-top: 5px;">Stok: ${p.stock || 0}</div>
                        </div>
                    `).join('')}
                </div>
            `;
        }, 300);
    },

    scanBarcode() {
        alert('Fitur scan barcode memerlukan kamera. Pastikan Anda memberikan izin kamera.');
    },

    addToCart(productId) {
        const product = dataManager.getProductById(productId);
        if (!product) return;

        if (product.stock <= 0) {
            app.showToast('❌ Stok habis!');
            return;
        }

        const existingItem = this.cart.find(item => item.id === productId);
        
        if (existingItem) {
            if (existingItem.qty >= product.stock) {
                app.showToast('❌ Stok tidak mencukupi!');
                return;
            }
            existingItem.qty++;
        } else {
            this.cart.push({
                id: product.id,
                name: product.name,
                price: product.price,
                cost: product.cost || 0,
                qty: 1,
                stock: product.stock
            });
        }

        this.render();
        this.updateCartBar();
        app.showToast(`✅ ${product.name} ditambahkan`);
    },

    updateQty(index, change) {
        const item = this.cart[index];
        const newQty = item.qty + change;

        if (newQty <= 0) {
            this.removeFromCart(index);
            return;
        }

        if (newQty > item.stock) {
            app.showToast('❌ Stok tidak mencukupi!');
            return;
        }

        item.qty = newQty;
        this.render();
        this.updateCartBar();
    },

    removeFromCart(index) {
        const item = this.cart[index];
        this.cart.splice(index, 1);
        this.render();
        this.updateCartBar();
        app.showToast(`🗑️ ${item.name} dihapus dari keranjang`);
    },

    clearCart() {
        if (!confirm('Kosongkan keranjang?')) return;
        this.cart = [];
        this.render();
        this.updateCartBar();
    },

    updateCartTotal() {
        const total = this.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const el = document.getElementById('posTotal');
        if (el) el.textContent = 'Rp ' + utils.formatNumber(total);
    },

    updateCartBar() {
        const total = this.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const count = this.cart.reduce((sum, item) => sum + item.qty, 0);
        
        document.getElementById('cartTotal').textContent = 'Rp ' + utils.formatNumber(total);
        document.getElementById('cartItemCount').textContent = count + ' item';
        document.getElementById('cartBar').style.display = count > 0 ? 'flex' : 'none';
    },

    openCheckout() {
        const total = this.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        
        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal active" id="checkoutModal" style="display: flex; z-index: 2000;">
                <div class="modal-content">
                    <div class="modal-header">
                        <span class="modal-title">💳 Pembayaran</span>
                        <button class="close-btn" onclick="posModule.closeCheckout()">×</button>
                    </div>

                    <div style="background: #f5f5f5; border-radius: 12px; padding: 20px; margin-bottom: 20px; text-align: center;">
                        <div style="font-size: 14px; color: #666; margin-bottom: 5px;">Total Bayar</div>
                        <div style="font-size: 32px; font-weight: 700; color: #667eea;">Rp ${utils.formatNumber(total)}</div>
                    </div>

                    <div class="form-group">
                        <label>Metode Pembayaran</label>
                        <select id="paymentMethod" onchange="posModule.togglePaymentDetails()">
                            <option value="cash">💵 Tunai</option>
                            <option value="transfer">🏦 Transfer</option>
                            <option value="qris">📱 QRIS</option>
                        </select>
                    </div>

                    <div id="cashPayment" class="form-group">
                        <label>Uang Diterima (Rp)</label>
                        <input type="number" id="cashReceived" placeholder="0" oninput="posModule.calculateChange(${total})">
                        <div id="changeDisplay" style="margin-top: 10px; padding: 10px; background: #e8f5e9; border-radius: 8px; display: none;">
                            <div style="display: flex; justify-content: space-between;">
                                <span>Kembalian:</span>
                                <span style="font-weight: 700; color: #4caf50;" id="changeAmount">Rp 0</span>
                            </div>
                        </div>
                    </div>

                    <div id="transferPayment" class="form-group" style="display: none;">
                        <label>Bank Tujuan</label>
                        <select id="transferBank">
                            <option value="bca">BCA</option>
                            <option value="bni">BNI</option>
                            <option value="bri">BRI</option>
                            <option value="mandiri">Mandiri</option>
                        </select>
                    </div>

                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="posModule.closeCheckout()">Batal</button>
                        <button class="btn btn-primary" onclick="posModule.processPayment(${total})">✅ Proses Bayar</button>
                    </div>
                </div>
            </div>
        `);
    },

    closeCheckout() {
        const modal = document.getElementById('checkoutModal');
        if (modal) modal.remove();
    },

    togglePaymentDetails() {
        const method = document.getElementById('paymentMethod').value;
        document.getElementById('cashPayment').style.display = method === 'cash' ? 'block' : 'none';
        document.getElementById('transferPayment').style.display = method === 'transfer' ? 'block' : 'none';
    },

    calculateChange(total) {
        const received = parseInt(document.getElementById('cashReceived').value) || 0;
        const change = received - total;
        const display = document.getElementById('changeDisplay');
        const amountEl = document.getElementById('changeAmount');

        if (change >= 0) {
            display.style.display = 'block';
            amountEl.textContent = 'Rp ' + utils.formatNumber(change);
            display.style.background = '#e8f5e9';
            amountEl.style.color = '#4caf50';
        } else {
            display.style.display = 'block';
            amountEl.textContent = 'Kurang Rp ' + utils.formatNumber(Math.abs(change));
            display.style.background = '#ffebee';
            amountEl.style.color = '#f44336';
        }
    },

    processPayment(total) {
        const method = document.getElementById('paymentMethod').value;
        const received = method === 'cash' ? (parseInt(document.getElementById('cashReceived').value) || 0) : total;

        if (method === 'cash' && received < total) {
            app.showToast('❌ Uang tidak mencukupi!');
            return;
        }

        // Calculate profit
        const profit = this.cart.reduce((sum, item) => sum + ((item.price - item.cost) * item.qty), 0);

        // Create transaction
        const transaction = {
            items: [...this.cart],
            total: total,
            profit: profit,
            paymentMethod: method,
            received: received,
            change: received - total,
            status: 'completed',
            date: new Date().toISOString()
        };

        // Update stock
        this.cart.forEach(item => {
            const product = dataManager.getProductById(item.id);
            if (product) {
                product.stock -= item.qty;
                dataManager.updateProduct(product.id, { stock: product.stock });
            }
        });

        // Update cash
        if (method === 'cash') {
            dataManager.data.settings.currentCash += total;
        }

        // Save transaction
        dataManager.addTransaction(transaction);
        
        // Update header (total transaksi & laba)
        app.updateHeader();

        // Clear cart
        this.cart = [];
        this.closeCheckout();
        this.render();
        this.updateCartBar();

        app.showToast(`✅ Transaksi berhasil! Laba: Rp ${utils.formatNumber(profit)}`);
        
        // Print receipt option
        setTimeout(() => {
            if (confirm('Cetak struk?')) {
                this.printReceipt(transaction);
            }
        }, 500);
    },

    printReceipt(transaction) {
        const receiptWindow = window.open('', '_blank');
        const settings = dataManager.data.settings;
        
        receiptWindow.document.write(`
            <html>
            <head>
                <title>Struk ${settings.storeName}</title>
                <style>
                    body { font-family: monospace; font-size: 12px; width: 80mm; margin: 0 auto; padding: 10px; }
                    .center { text-align: center; }
                    .line { border-top: 1px dashed #000; margin: 10px 0; }
                    .right { text-align: right; }
                    .bold { font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="center bold">${settings.receiptHeader.storeName}</div>
                <div class="center">${settings.receiptHeader.address}</div>
                <div class="center">${settings.receiptHeader.phone || ''}</div>
                <div class="line"></div>
                <div>Tanggal: ${new Date(transaction.date).toLocaleString('id-ID')}</div>
                <div>Metode: ${transaction.paymentMethod.toUpperCase()}</div>
                <div class="line"></div>
                ${transaction.items.map(item => `
                    <div>${item.name}</div>
                    <div>${item.qty} × Rp ${utils.formatNumber(item.price)} = Rp ${utils.formatNumber(item.price * item.qty)}</div>
                `).join('')}
                <div class="line"></div>
                <div class="right bold">Total: Rp ${utils.formatNumber(transaction.total)}</div>
                ${transaction.paymentMethod === 'cash' ? `
                    <div class="right">Bayar: Rp ${utils.formatNumber(transaction.received)}</div>
                    <div class="right">Kembali: Rp ${utils.formatNumber(transaction.change)}</div>
                ` : ''}
                <div class="line"></div>
                <div class="center">${settings.receiptHeader.note}</div>
            </body>
            </html>
        `);
        
        receiptWindow.document.close();
        receiptWindow.print();
    }
};

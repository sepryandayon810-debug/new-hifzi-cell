const transactionsModule = {
    currentFilter: 'all',
    currentTransaction: null,
    isListVisible: true, // State untuk visibility daftar transaksi
    
    init() {
        // Restore state SEBELUM render
        const savedState = localStorage.getItem('transactionListVisible');
        this.isListVisible = savedState !== null ? savedState === 'true' : true;
        
        this.renderHTML();
        this.renderList();
        
        // Apply collapsed state ke DOM jika perlu
        if (!this.isListVisible) {
            setTimeout(() => {
                const listElement = document.getElementById('transactionList');
                const btnElement = document.getElementById('toggleListBtn');
                const arrowElement = btnElement?.querySelector('.arrow-icon');
                const cardElement = document.getElementById('transactionListCard');
                
                if (listElement && arrowElement && cardElement) {
                    listElement.classList.add('collapsed');
                    arrowElement.classList.add('collapsed');
                    cardElement.classList.add('collapsed');
                    btnElement.title = 'Tampilkan Daftar';
                }
            }, 50);
        }
        
        // Render Bluetooth Control setelah HTML dirender
        setTimeout(() => {
            if (typeof bluetoothModule !== 'undefined') {
                bluetoothModule.renderBluetoothControl('bluetoothControlTransaction', {
                    context: 'transaction',
                    showPrintButton: true
                });
            }
        }, 100);
    },
    
    renderHTML() {
        const html = `
            <div class="content-section active" id="transactionsSection">
                <!-- BLUETOOTH CONTROL PANEL -->
                <div id="bluetoothControlTransaction"></div>
                
                <div class="card">
                    <div class="card-header">
                        <span class="card-title">📝 Manajemen Transaksi</span>
                        <button class="btn-sm btn-primary-sm" onclick="transactionsModule.refresh()">🔄 Refresh</button>
                    </div>
                    
                    <div class="search-bar">
                        <input type="text" placeholder="Cari nomor transaksi atau produk..." 
                               id="searchTransaction" onkeyup="transactionsModule.search()">
                        <button onclick="transactionsModule.search()">🔍</button>
                    </div>

                    <div class="report-filters" style="margin-bottom: 15px; display: flex; flex-wrap: wrap; gap: 8px;">
                        <button class="filter-btn active" data-filter="all" onclick="transactionsModule.setFilter('all', this)">Semua</button>
                        <button class="filter-btn" data-filter="today" onclick="transactionsModule.setFilter('today', this)">Hari Ini</button>
                        <button class="filter-btn" data-filter="yesterday" onclick="transactionsModule.setFilter('yesterday', this)">Kemarin</button>
                        <button class="filter-btn" data-filter="month" onclick="transactionsModule.setFilter('month', this)">Bulan Ini</button>
                        <button class="filter-btn" data-filter="year" onclick="transactionsModule.setFilter('year', this)">Tahun Ini</button>
                        <button class="filter-btn" data-filter="voided" onclick="transactionsModule.setFilter('voided', this)">Dibatalkan</button>
                        <button class="filter-btn" data-filter="deleted" onclick="transactionsModule.setFilter('deleted', this)">Terhapus</button>
                    </div>
                </div>

                <div class="card" id="transactionListCard">
                    <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span class="card-title">Daftar Transaksi</span>
                            <span style="font-size: 12px; color: #666;" id="transCount">0 transaksi</span>
                        </div>
                        <button class="toggle-btn" onclick="transactionsModule.toggleList()" 
                                id="toggleListBtn" title="Sembunyikan/Tampilkan Daftar">
                            <span class="arrow-icon">▼</span>
                        </button>
                    </div>
                    <div class="transaction-list" id="transactionList"></div>
                </div>
            </div>

            <style>
                .filter-btn {
                    padding: 8px 16px;
                    border: 1px solid #e0e0e0;
                    background: white;
                    border-radius: 20px;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 500;
                    color: #555;
                    transition: all 0.2s ease;
                }
                .filter-btn:hover {
                    background: #f5f5f5;
                    border-color: #ccc;
                }
                .filter-btn.active {
                    background: linear-gradient(135deg, var(--primary, #667eea) 0%, var(--primary-dark, #764ba2) 100%);
                    color: white !important;
                    border-color: transparent;
                    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
                }
                .filter-btn.active:hover {
                    opacity: 0.9;
                }
                
                /* Tombol Toggle */
                .toggle-btn {
                    background: linear-gradient(135deg, var(--primary, #667eea) 0%, var(--primary-dark, #764ba2) 100%);
                    color: white;
                    border: none;
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.3s ease;
                    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
                }
                .toggle-btn:hover {
                    transform: scale(1.1);
                    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
                }
                .toggle-btn:active {
                    transform: scale(0.95);
                }
                
                /* Animasi panah */
                .arrow-icon {
                    font-size: 14px;
                    transition: transform 0.3s ease;
                    display: inline-block;
                }
                .arrow-icon.collapsed {
                    transform: rotate(-90deg);
                }
                
                /* Animasi untuk list */
                #transactionList {
                    transition: all 0.3s ease;
                    overflow: hidden;
                    max-height: 2000px;
                    opacity: 1;
                }
                #transactionList.collapsed {
                    max-height: 0;
                    opacity: 0;
                    margin: 0;
                    padding: 0;
                }
                
                /* Style untuk card saat collapsed */
                #transactionListCard.collapsed {
                    padding-bottom: 0;
                }
                #transactionListCard.collapsed .transaction-list {
                    display: none;
                }
            </style>
        `;
        document.getElementById('mainContent').innerHTML = html;
    },
    
    // Method baru untuk toggle visibility
    toggleList() {
        this.isListVisible = !this.isListVisible;
        
        const listElement = document.getElementById('transactionList');
        const btnElement = document.getElementById('toggleListBtn');
        const arrowElement = btnElement.querySelector('.arrow-icon');
        const cardElement = document.getElementById('transactionListCard');
        
        if (this.isListVisible) {
            // Tampilkan list
            listElement.classList.remove('collapsed');
            arrowElement.classList.remove('collapsed');
            cardElement.classList.remove('collapsed');
            btnElement.title = 'Sembunyikan Daftar';
        } else {
            // Sembunyikan list
            listElement.classList.add('collapsed');
            arrowElement.classList.add('collapsed');
            cardElement.classList.add('collapsed');
            btnElement.title = 'Tampilkan Daftar';
        }
        
        // Simpan preference ke localStorage (opsional)
        localStorage.setItem('transactionListVisible', this.isListVisible);
    },
    
    // Method untuk restore state dari localStorage
    restoreToggleState() {
        const savedState = localStorage.getItem('transactionListVisible');
        if (savedState !== null) {
            this.isListVisible = savedState === 'true';
            if (!this.isListVisible) {
                // Apply collapsed state setelah render
                setTimeout(() => {
                    const listElement = document.getElementById('transactionList');
                    const btnElement = document.getElementById('toggleListBtn');
                    const arrowElement = btnElement?.querySelector('.arrow-icon');
                    const cardElement = document.getElementById('transactionListCard');
                    
                    if (listElement && arrowElement && cardElement) {
                        listElement.classList.add('collapsed');
                        arrowElement.classList.add('collapsed');
                        cardElement.classList.add('collapsed');
                        btnElement.title = 'Tampilkan Daftar';
                    }
                }, 100);
            }
        }
    },
    
    setFilter(filter, btnElement) {
        this.currentFilter = filter;
        
        // Hapus class active dari semua tombol
        document.querySelectorAll('#transactionsSection .filter-btn').forEach(b => {
            b.classList.remove('active');
        });
        
        // Tambahkan class active ke tombol yang diklik
        if (btnElement) {
            btnElement.classList.add('active');
        } else {
            // Fallback jika event tidak tersedia
            const targetBtn = document.querySelector(`#transactionsSection .filter-btn[data-filter="${filter}"]`);
            if (targetBtn) targetBtn.classList.add('active');
        }
        
        this.renderList();
    },
    
    search() {
        this.renderList();
    },
    
    refresh() {
        this.renderList();
        app.showToast('Daftar diperbarui!');
    },
    
    renderList() {
        const container = document.getElementById('transactionList');
        const searchInput = document.getElementById('searchTransaction');
        const search = searchInput ? searchInput.value.toLowerCase() : '';
        
        let transactions = [...dataManager.data.transactions];
        const now = new Date();
        
        // Filter berdasarkan waktu
        if (this.currentFilter === 'today') {
            const today = new Date().toDateString();
            transactions = transactions.filter(t => new Date(t.date).toDateString() === today && t.status !== 'deleted');
        } else if (this.currentFilter === 'yesterday') {
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toDateString();
            transactions = transactions.filter(t => new Date(t.date).toDateString() === yesterdayStr && t.status !== 'deleted');
        } else if (this.currentFilter === 'month') {
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();
            transactions = transactions.filter(t => {
                const tDate = new Date(t.date);
                return tDate.getMonth() === currentMonth && 
                       tDate.getFullYear() === currentYear && 
                       t.status !== 'deleted';
            });
        } else if (this.currentFilter === 'year') {
            const currentYear = now.getFullYear();
            transactions = transactions.filter(t => {
                const tDate = new Date(t.date);
                return tDate.getFullYear() === currentYear && t.status !== 'deleted';
            });
        } else if (this.currentFilter === 'voided') {
            transactions = transactions.filter(t => t.status === 'voided');
        } else if (this.currentFilter === 'deleted') {
            transactions = transactions.filter(t => t.status === 'deleted');
        } else {
            // 'all' - semua transaksi aktif (tidak deleted)
            transactions = transactions.filter(t => t.status !== 'deleted');
        }
        
        if (search) {
            transactions = transactions.filter(t => 
                (t.transactionNumber && t.transactionNumber.toLowerCase().includes(search)) ||
                t.items.some(i => i.name.toLowerCase().includes(search))
            );
        }
        
        transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        document.getElementById('transCount').textContent = transactions.length + ' transaksi';
        
        if (transactions.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-icon">📝</div><p>Tidak ada transaksi</p></div>';
            return;
        }
        
        container.innerHTML = transactions.map(t => {
            const isVoided = t.status === 'voided';
            const isDeleted = t.status === 'deleted';
            const itemNames = t.items.map(i => i.name).join(', ');
            const shortNames = itemNames.length > 30 ? itemNames.substring(0, 30) + '...' : itemNames;
            
            let statusBadge = '';
            if (isVoided) {
                statusBadge = '<span style="color: var(--danger); font-size: 10px; margin-left: 5px;">[DIBATALKAN]</span>';
            } else if (isDeleted) {
                statusBadge = '<span style="color: #999; font-size: 10px; margin-left: 5px;">[TERHAPUS]</span>';
            }
            
            return `
                <div class="transaction-item" onclick="transactionsModule.viewDetail(${t.id})" 
                     style="display: flex; justify-content: space-between; align-items: center; padding: 15px; 
                            background: ${isVoided ? '#ffebee' : (isDeleted ? '#f5f5f5' : 'white')}; 
                            margin-bottom: 10px; border-radius: 12px; 
                            box-shadow: 0 1px 3px rgba(0,0,0,0.05); cursor: pointer; border: 1px solid #f0f0f0;">
                    <div class="transaction-info" style="flex: 1;">
                        <div class="transaction-title" style="font-weight: 600; margin-bottom: 4px;">
                            ${t.transactionNumber || 'TRX-' + t.id.toString().slice(-8)}
                            ${statusBadge}
                        </div>
                        <div class="transaction-meta" style="font-size: 12px; color: #666;">
                            ${new Date(t.date).toLocaleString('id-ID')} • ${shortNames}
                        </div>
                    </div>
                    <div class="transaction-amount ${isVoided || isDeleted ? '' : 'income'}" 
                         style="font-weight: 700; color: ${isVoided || isDeleted ? '#999' : 'var(--success)'};">
                        Rp ${utils.formatNumber(t.total)}
                    </div>
                </div>
            `;
        }).join('');
    },
    
    viewDetail(transactionId) {
        const t = dataManager.data.transactions.find(tr => tr.id === transactionId);
        if (!t) return;
        
        this.currentTransaction = t;
        const isVoided = t.status === 'voided';
        const isDeleted = t.status === 'deleted';
        const canModify = !isVoided && !isDeleted;
        
        const modalHtml = `
            <div class="modal active" id="detailModal" style="display: flex; z-index: 2000;">
                <div class="modal-content" style="max-width: 450px; max-height: 90vh; overflow-y: auto;">
                    <div class="modal-header">
                        <span class="modal-title">Detail Transaksi</span>
                        <button class="close-btn" onclick="transactionsModule.closeDetail()">×</button>
                    </div>
                    
                    <div style="background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%); 
                                color: white; padding: 20px; border-radius: 16px; margin-bottom: 20px; text-align: center;">
                        <div style="font-size: 14px; opacity: 0.9;">Total Transaksi</div>
                        <div style="font-size: 32px; font-weight: 700; margin: 10px 0;">Rp ${utils.formatNumber(t.total)}</div>
                        <div style="font-size: 12px; opacity: 0.9;">
                            ${t.transactionNumber || 'TRX-' + t.id.toString().slice(-8)} • 
                            ${new Date(t.date).toLocaleString('id-ID')}
                        </div>
                        ${isVoided ? '<div style="margin-top: 10px; padding: 5px 10px; background: rgba(255,71,87,0.3); border-radius: 8px; font-size: 12px; font-weight: 600;">⚠️ TRANSAKSI DIBATALKAN</div>' : ''}
                        ${isDeleted ? '<div style="margin-top: 10px; padding: 5px 10px; background: rgba(128,128,128,0.3); border-radius: 8px; font-size: 12px; font-weight: 600;">🗑️ TRANSAKSI TERHAPUS</div>' : ''}
                    </div>
                    
                    <div style="background: #e8f5e9; border-radius: 12px; padding: 15px; margin-bottom: 15px; 
                                border: 2px solid var(--success); display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-size: 12px; color: #666; margin-bottom: 2px;">Laba Bersih</div>
                            <div style="font-size: 24px; font-weight: 700; color: var(--success);">
                                Rp ${utils.formatNumber(t.profit || 0)}
                            </div>
                        </div>
                        <div style="font-size: 36px;">📈</div>
                    </div>
                    
                    <div style="background: #f8f9fa; border-radius: 12px; padding: 15px; margin-bottom: 15px;">
                        <div style="font-weight: 700; margin-bottom: 10px; color: #666; font-size: 12px; text-transform: uppercase;">Items</div>
                        ${t.items.map(item => `
                            <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e0e0e0;">
                                <div>
                                    <div style="font-weight: 600;">${item.name}</div>
                                    <div style="font-size: 12px; color: #666;">
                                        ${item.qty} x Rp ${utils.formatNumber(item.price)}
                                        ${item.cost ? '(Modal: Rp ' + utils.formatNumber(item.cost) + ')' : ''}
                                    </div>
                                </div>
                                <div style="font-weight: 700; text-align: right;">
                                    <div>Rp ${utils.formatNumber(item.qty * item.price)}</div>
                                    ${item.cost ? '<div style="font-size: 11px; color: var(--success);">+Rp ' + utils.formatNumber((item.price - item.cost) * item.qty) + '</div>' : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div style="background: white; border-radius: 12px; padding: 15px; border: 2px solid #e0e0e0;">
                        <div style="display: flex; justify-content: space-between; padding: 6px 0;">
                            <span>Subtotal</span>
                            <span>Rp ${utils.formatNumber(t.total)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 6px 0;">
                            <span>Metode Pembayaran</span>
                            <span style="font-weight: 600;">${t.paymentMethod ? t.paymentMethod.toUpperCase() : 'TUNAI'}</span>
                        </div>
                        ${t.paymentMethod === 'cash' ? `
                        <div style="display: flex; justify-content: space-between; padding: 6px 0;">
                            <span>Uang Diterima</span>
                            <span>Rp ${utils.formatNumber(t.received || 0)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 6px 0;">
                            <span>Kembalian</span>
                            <span style="color: var(--success); font-weight: 600;">Rp ${utils.formatNumber(t.change || 0)}</span>
                        </div>
                        ` : ''}
                        <div style="display: flex; justify-content: space-between; padding: 8px 0; 
                                    border-top: 2px solid #e0e0e0; margin-top: 8px;
                                    font-weight: 700; font-size: 16px; color: var(--primary);">
                            <span>TOTAL</span>
                            <span>Rp ${utils.formatNumber(t.total)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 6px 0; 
                                    color: var(--success); font-weight: 600; font-size: 14px;">
                            <span>💰 Laba Bersih</span>
                            <span>+Rp ${utils.formatNumber(t.profit || 0)}</span>
                        </div>
                    </div>
                    
                    ${canModify ? `
                    <div style="margin-top: 20px;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                            <button class="btn btn-primary" onclick="transactionsModule.openEditModal()" style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                                ✏️ Edit
                            </button>
                            <button class="btn btn-success" onclick="transactionsModule.reprint()" style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                                🖨️ Cetak
                            </button>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
                            <button class="btn btn-warning" onclick="transactionsModule.openReturnModal()" style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                                🔄 Return
                            </button>
                            <button class="btn btn-danger" onclick="transactionsModule.voidTransaction()" style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                                ❌ Batal
                            </button>
                            <button class="btn btn-danger" onclick="transactionsModule.deleteTransaction()" style="display: flex; align-items: center; justify-content: center; gap: 8px; background: #333;">
                                🗑️ Hapus
                            </button>
                        </div>
                    </div>
                    ` : isDeleted ? `
                    <div style="margin-top: 20px;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            <button class="btn btn-success" onclick="transactionsModule.restoreTransaction()" style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                                ♻️ Restore
                            </button>
                            <button class="btn btn-secondary" onclick="transactionsModule.closeDetail()" style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                                Tutup
                            </button>
                        </div>
                    </div>
                    ` : `
                    <div style="margin-top: 20px;">
                        <button class="btn btn-secondary" onclick="transactionsModule.closeDetail()" style="width: 100%;">
                            Tutup
                        </button>
                    </div>
                    `}
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },
    
    closeDetail() {
        const modal = document.getElementById('detailModal');
        if (modal) modal.remove();
    },
    
    openEditModal() {
        if (!this.currentTransaction) return;
        
        const t = this.currentTransaction;
        
        const editHtml = `
            <div class="modal active" id="editTransModal" style="display: flex; z-index: 3000;">
                <div class="modal-content">
                    <div class="modal-header">
                        <span class="modal-title">✏️ Edit Transaksi</span>
                        <button class="close-btn" onclick="document.getElementById('editTransModal')?.remove()">×</button>
                    </div>
                    
                    <div class="info-box warning" style="margin-bottom: 15px;">
                        <div class="info-title">Batasan Edit</div>
                        <div class="info-text">
                            Hanya bisa edit metode pembayaran dan catatan. 
                            Untuk ubah item, gunakan Return atau batalkan transaksi.
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label>Nomor Transaksi</label>
                        <input type="text" value="${t.transactionNumber || ''}" disabled style="background: #f5f5f5;">
                    </div>
                    
                    <div class="form-group">
                        <label>Metode Pembayaran</label>
                        <select id="editPaymentMethod">
                            <option value="cash" ${t.paymentMethod === 'cash' ? 'selected' : ''}>💵 Tunai</option>
                            <option value="debit" ${t.paymentMethod === 'debit' ? 'selected' : ''}>💳 Kartu Debit</option>
                            <option value="qris" ${t.paymentMethod === 'qris' ? 'selected' : ''}>📱 QRIS</option>
                            <option value="transfer" ${t.paymentMethod === 'transfer' ? 'selected' : ''}>🏦 Transfer</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label>Catatan Tambahan</label>
                        <textarea id="editTransNote" rows="3" placeholder="Catatan...">${t.note || ''}</textarea>
                    </div>
                    
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="document.getElementById('editTransModal')?.remove()">Batal</button>
                        <button class="btn btn-primary" onclick="transactionsModule.saveEdit()">Simpan Perubahan</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', editHtml);
    },
    
    saveEdit() {
        if (!this.currentTransaction) return;
        
        const method = document.getElementById('editPaymentMethod').value;
        const note = document.getElementById('editTransNote').value;
        
        this.currentTransaction.paymentMethod = method;
        this.currentTransaction.note = note;
        
        dataManager.save();
        
        const modal = document.getElementById('editTransModal');
        if (modal) modal.remove();
        
        this.closeDetail();
        this.renderList();
        app.showToast('✅ Transaksi diupdate!');
    },
    
    reprint() {
        if (!this.currentTransaction) return;
        
        const t = this.currentTransaction;
        
        // Coba print via Bluetooth dulu jika tersedia dan terhubung
        if (typeof bluetoothModule !== 'undefined') {
            if (bluetoothModule.isConnected) {
                bluetoothModule.printCurrentTransaction();
                return;
            }
            
            // Jika ada device tersimpan tapi belum connect, coba reconnect
            if (bluetoothModule.lastDevice) {
                bluetoothModule.reconnect().then(() => {
                    bluetoothModule.printCurrentTransaction();
                }).catch(() => {
                    // Fallback ke window print
                    this.printReceiptWindow(t);
                });
                return;
            }
        }
        
        // Fallback ke window print
        this.printReceiptWindow(t);
    },
    
    // Print via Window (fallback)
    printReceiptWindow(t) {
        const header = dataManager.data.settings.receiptHeader || {};
        
        const receiptLines = [
            '================================',
            '    ' + (header.storeName || 'HIFZI CELL').toUpperCase(),
            '    ' + (header.address || ''),
            header.phone ? '    HP: ' + header.phone : '',
            '================================',
            'No: ' + (t.transactionNumber || 'TRX-' + t.id.toString().slice(-8)),
            'Tgl: ' + new Date(t.date).toLocaleString('id-ID'),
            t.note ? 'Catatan: ' + t.note : '',
            '--------------------------------'
        ];
        
        t.items.forEach(item => {
            receiptLines.push(item.name);
            receiptLines.push(item.qty + ' x Rp ' + utils.formatNumber(item.price) + ' = Rp ' + utils.formatNumber(item.qty * item.price));
        });
        
        receiptLines.push('--------------------------------');
        receiptLines.push('Total:      Rp ' + utils.formatNumber(t.total));
        
        if (t.paymentMethod === 'cash') {
            receiptLines.push('Bayar:      Rp ' + utils.formatNumber(t.received || 0));
            receiptLines.push('Kembali:    Rp ' + utils.formatNumber(t.change || 0));
        } else {
            receiptLines.push('Metode:     ' + (t.paymentMethod || 'tunai').toUpperCase());
        }
        
        receiptLines.push('================================');
        receiptLines.push(header.note || 'Terima kasih atas kunjungan Anda');
        receiptLines.push('================================');
        receiptLines.push('(Cetak Ulang)');
        
        const receipt = receiptLines.join('\n');

        const w = window.open('', '_blank');
        w.document.write(`
            <html>
            <head>
                <title>Struk ${t.transactionNumber}</title>
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
        
        app.showToast('🖨️ Struk dicetak ulang!');
    },
    
    openReturnModal() {
        if (!this.currentTransaction) return;
        
        const t = this.currentTransaction;
        
        let itemsHtml = '';
        t.items.forEach((item, idx) => {
            itemsHtml += `
                <div style="background: #fff3e0; border-radius: 12px; padding: 15px; margin-bottom: 10px; border: 2px solid #ff9800;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="font-weight: 700; font-size: 14px;">${item.name}</span>
                        <span style="font-size: 12px; color: #666;">Rp ${utils.formatNumber(item.price)}</span>
                    </div>
                    <div style="font-size: 12px; color: #666; margin-bottom: 10px;">
                        Jumlah beli: <b>${item.qty}</b> • Modal: Rp ${utils.formatNumber(item.cost || 0)}
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 13px;">Return:</span>
                        <input type="number" id="returnQty_${idx}" value="0" min="0" max="${item.qty}" 
                               style="width: 70px; text-align: center; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; font-weight: 700;"
                               onchange="transactionsModule.calcReturn()">
                        <span style="font-size: 12px; color: #666;">Max: ${item.qty}</span>
                    </div>
                </div>
            `;
        });
        
        const returnHtml = `
            <div class="modal active" id="returnModal" style="display: flex; z-index: 3000;">
                <div class="modal-content" style="max-width: 500px; max-height: 90vh; overflow-y: auto;">
                    <div class="modal-header">
                        <span class="modal-title">🔄 Return / Refund Item</span>
                        <button class="close-btn" onclick="transactionsModule.closeReturnModal()">×</button>
                    </div>
                    
                    <div class="info-box warning" style="margin-bottom: 15px;">
                        <div class="info-title">📌 Info Return</div>
                        <div class="info-text">
                            <b>Stok akan dikembalikan ke inventory.</b><br>
                            Total transaksi <b>TIDAK</b> berubah di laporan.<br>
                            Jika perlu refund uang ke customer, gunakan menu Kas Keluar.
                        </div>
                    </div>

                    <div style="max-height: 300px; overflow-y: auto; margin-bottom: 15px;">
                        ${itemsHtml}
                    </div>

                    <div class="calculation-box" style="background: #fff3e0; border: 2px solid #ff9800;">
                        <div class="calc-row">
                            <span>Total Item Return:</span>
                            <span id="calcReturnItems" style="font-weight: 700;">0</span>
                        </div>
                        <div class="calc-row">
                            <span>Stok Kembali:</span>
                            <span id="calcReturnStock" style="font-weight: 700; color: var(--success);">0 item</span>
                        </div>
                        <div class="calc-row" style="font-size: 12px; color: #666; font-style: italic; border: none;">
                            * Total transaksi tetap: Rp ${utils.formatNumber(t.total)}
                        </div>
                    </div>

                    <div class="form-group" style="margin-top: 15px;">
                        <label>Alasan Return *</label>
                        <select id="returnReason" style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 12px;">
                            <option value="rusak">Barang Rusak/Cacat</option>
                            <option value="salah_beli">Salah Beli Customer</option>
                            <option value="tidak_sesuai">Tidak Sesuai Pesanan</option>
                            <option value="expired">Kadaluarsa</option>
                            <option value="lainnya">Lainnya</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label>Keterangan</label>
                        <textarea id="returnNote" rows="2" placeholder="Catatan return..."></textarea>
                    </div>

                    <div class="form-group">
                        <label>Password Konfirmasi *</label>
                        <input type="password" id="returnPassword" placeholder="admin" value="admin" 
                               style="font-family: monospace; letter-spacing: 2px;">
                        <div style="font-size: 11px; color: #999; margin-top: 5px;">Default password: admin</div>
                    </div>
                    
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="transactionsModule.closeReturnModal()">Batal</button>
                        <button class="btn btn-warning" onclick="transactionsModule.confirmReturn()">🔄 Proses Return</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', returnHtml);
    },
    
    closeReturnModal() {
        const modal = document.getElementById('returnModal');
        if (modal) modal.remove();
    },
    
    calcReturn() {
        let totalItems = 0;
        
        this.currentTransaction.items.forEach((item, idx) => {
            const input = document.getElementById('returnQty_' + idx);
            if (!input) return;
            
            const val = parseInt(input.value) || 0;
            const max = item.qty;
            const valid = Math.min(Math.max(val, 0), max);
            
            if (val !== valid) {
                input.value = valid;
            }
            
            totalItems += valid;
        });
        
        const itemsEl = document.getElementById('calcReturnItems');
        const stockEl = document.getElementById('calcReturnStock');
        
        if (itemsEl) itemsEl.textContent = totalItems;
        if (stockEl) stockEl.textContent = totalItems + ' item';
    },
    
    confirmReturn() {
        const passwordInput = document.getElementById('returnPassword');
        const reasonInput = document.getElementById('returnReason');
        
        const password = passwordInput ? passwordInput.value : '';
        const reason = reasonInput ? reasonInput.value : '';
        
        if (password !== 'admin') {
            app.showToast('❌ Password salah!');
            return;
        }
        
        if (!reason) {
            app.showToast('❌ Alasan return wajib dipilih!');
            return;
        }
        
        let returnCount = 0;
        const returnDetails = [];
        
        this.currentTransaction.items.forEach((item, idx) => {
            const input = document.getElementById('returnQty_' + idx);
            const returnQty = input ? (parseInt(input.value) || 0) : 0;
            
            if (returnQty > 0) {
                const product = dataManager.data.products.find(p => p.id === item.id);
                if (product) {
                    product.stock += returnQty;
                }
                
                returnDetails.push({
                    itemId: item.id,
                    itemName: item.name,
                    returnQty: returnQty,
                    returnAmount: returnQty * item.price
                });
                
                returnCount += returnQty;
            }
        });
        
        if (returnCount === 0) {
            app.showToast('❌ Tidak ada item yang direturn!');
            return;
        }
        
        if (!this.currentTransaction.returns) {
            this.currentTransaction.returns = [];
        }
        
        const noteInput = document.getElementById('returnNote');
        
        this.currentTransaction.returns.push({
            date: new Date().toISOString(),
            reason: reason,
            note: noteInput ? noteInput.value : '',
            items: returnDetails,
            totalItems: returnCount
        });
        
        dataManager.save();
        this.closeReturnModal();
        this.closeDetail();
        this.renderList();
        app.showToast('✅ ' + returnCount + ' item direturn! Stok dikembalikan.');
    },
    
    // ✅ PERBAIKAN: Void Transaction - hanya kurangi kas jika cash
    voidTransaction() {
        if (!this.currentTransaction) return;
        
        if (!confirm('⚠️ BATALKAN TRANSAKSI INI?\\n\\nTindakan ini akan:\\n• Mengembalikan semua stok produk\\n• Mengurangi kas sesuai total transaksi (jika cash)\\n• Menandai transaksi sebagai "Dibatalkan"\\n• Transaksi tetap terlihat di laporan\\n\\nLanjutkan?')) {
            return;
        }
        
        const reason = prompt('Alasan pembatalan:') || 'Tidak disebutkan';
        
        // Kembalikan stok
        this.currentTransaction.items.forEach(item => {
            const product = dataManager.data.products.find(p => p.id === item.id);
            if (product) {
                product.stock += item.qty;
            }
        });
        
        // ✅ PERBAIKAN: Hanya kurangi kas jika pembayaran CASH
        if (this.currentTransaction.paymentMethod === 'cash') {
            dataManager.data.settings.currentCash -= this.currentTransaction.total;
            
            // Catat di cashTransactions sebagai pos_void
            dataManager.data.cashTransactions.push({
                id: Date.now(),
                date: new Date().toISOString(),
                type: 'pos_void',
                amount: this.currentTransaction.total,
                category: 'pembatalan_pos',
                note: `Pembatalan POS - ${this.currentTransaction.transactionNumber}`,
                source: 'pos_void',
                transactionId: this.currentTransaction.id
            });
        }
        
        this.currentTransaction.status = 'voided';
        this.currentTransaction.voidInfo = {
            reason: reason,
            voidDate: new Date().toISOString(),
            voidBy: 'Admin'
        };
        
        dataManager.save();
        app.updateHeader();
        this.closeDetail();
        this.renderList();
        app.showToast('✅ Transaksi dibatalkan! Stok & kas dikembalikan.');
    },
    
    // ✅ PERBAIKAN: Delete Transaction - hanya kurangi kas jika cash
    deleteTransaction() {
        if (!this.currentTransaction) return;
        
        if (!confirm('🗑️ HAPUS TRANSAKSI INI?\\n\\nTindakan ini akan:\\n• Mengembalikan semua stok produk\\n• Mengurangi kas sesuai total transaksi (jika cash)\\n• Menandai transaksi sebagai "Terhapus"\\n• Transaksi masih terlihat di filter "Terhapus"\\n\\nLanjutkan?')) {
            return;
        }
        
        const password = prompt('Masukkan password (admin):');
        if (password !== 'admin') {
            app.showToast('❌ Password salah!');
            return;
        }
        
        // Kembalikan stok
        this.currentTransaction.items.forEach(item => {
            const product = dataManager.data.products.find(p => p.id === item.id);
            if (product) {
                product.stock += item.qty;
            }
        });
        
        // ✅ PERBAIKAN: Hanya kurangi kas jika pembayaran CASH
        if (this.currentTransaction.paymentMethod === 'cash') {
            dataManager.data.settings.currentCash -= this.currentTransaction.total;
            
            // Catat di cashTransactions
            dataManager.data.cashTransactions.push({
                id: Date.now(),
                date: new Date().toISOString(),
                type: 'pos_void',
                amount: this.currentTransaction.total,
                category: 'penghapusan_pos',
                note: `Hapus Transaksi POS - ${this.currentTransaction.transactionNumber}`,
                source: 'pos_void',
                transactionId: this.currentTransaction.id
            });
        }
        
        this.currentTransaction.status = 'deleted';
        this.currentTransaction.deleteInfo = {
            deleteDate: new Date().toISOString(),
            deletedBy: 'Admin'
        };
        
        dataManager.save();
        app.updateHeader();
        this.closeDetail();
        this.renderList();
        app.showToast('🗑️ Transaksi dihapus!');
    },
    
    restoreTransaction() {
        if (!this.currentTransaction) return;
        
        if (this.currentTransaction.status !== 'deleted') {
            app.showToast('❌ Transaksi tidak dalam status terhapus!');
            return;
        }
        
        if (!confirm('♻️ RESTORE TRANSAKSI INI?\\n\\nTransaksi akan dikembalikan ke status aktif.\\nStok dan kas TIDAK akan diubah (sudah dikembalikan saat hapus).\\n\\nLanjutkan?')) {
            return;
        }
        
        this.currentTransaction.status = 'completed';
        this.currentTransaction.restoredInfo = {
            restoreDate: new Date().toISOString(),
            restoredBy: 'Admin'
        };
        
        dataManager.save();
        this.closeDetail();
        this.renderList();
        app.showToast('♻️ Transaksi direstore!');
    },
    
    // ==========================================
    // BLUETOOTH PRINT METHODS
    // ==========================================
    
    // Method untuk dipanggil dari bluetoothModule
    getCurrentTransactionForPrint() {
        return this.currentTransaction;
    }
};

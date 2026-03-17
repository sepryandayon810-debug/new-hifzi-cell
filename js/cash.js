const cashModule = {
    currentDeleteTransaction: null,
    
    init() {
        this.renderHTML();
        this.updateStats();
        this.renderTransactions();
    },
    
    renderHTML() {
        const today = new Date().toLocaleDateString('id-ID', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        });
        
        document.getElementById('mainContent').innerHTML = `
            <div class="content-section active" id="cashSection">
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon sales">💵</div>
                        <div class="stat-label">Pemasukan Hari Ini</div>
                        <div class="stat-value" id="todayIncome">Rp 0</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon expense">💸</div>
                        <div class="stat-label">Pengeluaran Hari Ini</div>
                        <div class="stat-value" id="todayExpense">Rp 0</div>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <span class="card-title">Manajemen Kas</span>
                        <div style="font-size: 12px; color: #999;">${today}</div>
                    </div>
                    
                    <div class="cash-actions">
                        <button class="cash-btn in" onclick="cashModule.openModal('in')">
                            <span style="font-size: 24px;">⬇️</span>
                            <span>Kas Masuk</span>
                        </button>
                        <button class="cash-btn out" onclick="cashModule.openModal('out')">
                            <span style="font-size: 24px;">⬆️</span>
                            <span>Kas Keluar</span>
                        </button>
                        <button class="cash-btn tarik-tunai" onclick="cashModule.openTarikTunai()">
                            <span style="font-size: 24px;">🏧</span>
                            <span>Tarik Tunai</span>
                        </button>
                        <button class="cash-btn topup" onclick="cashModule.openTopUp()">
                            <span style="font-size: 24px;">💜</span>
                            <span>Top Up</span>
                        </button>
                        <button class="cash-btn modal-awal" onclick="cashModule.openModalAwal()">
                            <span style="font-size: 24px;">💰</span>
                            <span>Modal Awal</span>
                        </button>
                        <button class="cash-btn history" onclick="cashModule.openHistory()">
                            <span style="font-size: 24px;">📋</span>
                            <span>Riwayat</span>
                        </button>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <span class="card-title">Riwayat Transaksi Kas Hari Ini</span>
                    </div>
                    <div class="transaction-list" id="cashTransactionList"></div>
                </div>
            </div>
        `;
    },
    
    updateStats() {
        const today = new Date().toDateString();
        const transactions = dataManager.data.cashTransactions.filter(t => 
            new Date(t.date).toDateString() === today
        );
        
        const income = transactions
            .filter(t => t.type === 'in' || t.type === 'modal_in' || t.type === 'topup')
            .reduce((sum, t) => sum + t.amount, 0);
        
        const expense = transactions
            .filter(t => t.type === 'out')
            .reduce((sum, t) => sum + t.amount, 0);
        
        document.getElementById('todayIncome').textContent = 'Rp ' + utils.formatNumber(income);
        document.getElementById('todayExpense').textContent = 'Rp ' + utils.formatNumber(expense);
    },
    
    renderTransactions() {
        const container = document.getElementById('cashTransactionList');
        const today = new Date().toDateString();
        
        const transactions = dataManager.data.cashTransactions
            .filter(t => new Date(t.date).toDateString() === today)
            .reverse();
        
        if (transactions.length === 0) {
            container.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><p>Belum ada transaksi hari ini</p></div>`;
            return;
        }
        
        let html = '';
        transactions.forEach(t => {
            const isIncome = t.type === 'in' || t.type === 'modal_in' || t.type === 'topup';
            const prefix = isIncome ? '+' : '-';
            const amountClass = isIncome ? 'income' : 'expense';
            
            let typeLabel = '';
            if (t.type === 'modal_in') typeLabel = ' (Modal)';
            else if (t.type === 'topup') typeLabel = ' (Top Up)';
            else if (t.category === 'tarik_tunai') typeLabel = ' (Tarik Tunai)';
            
            // Gunakan data-id untuk menyimpan ID transaksi
            html += `
                <div class="transaction-item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid #eee;">
                    <div class="transaction-info" style="flex: 1;">
                        <div class="transaction-title" style="font-weight: 500; margin-bottom: 4px;">${t.note || t.category}${typeLabel}</div>
                        <div class="transaction-meta" style="font-size: 12px; color: #999;">${new Date(t.date).toLocaleTimeString('id-ID')}</div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div class="transaction-amount ${amountClass}" style="font-weight: 600; ${isIncome ? 'color: #4caf50;' : 'color: #f44336;'}">
                            ${prefix} Rp ${utils.formatNumber(t.amount)}
                        </div>
                        <button class="btn-delete-cash" data-transaction-id="${t.id}" 
                                style="width: 32px; height: 32px; border-radius: 50%; background: #ffebee; 
                                       border: 2px solid #f44336; color: #f44336; font-size: 14px; cursor: pointer; 
                                       display: flex; align-items: center; justify-content: center;
                                       transition: all 0.2s;"
                                title="Hapus transaksi">🗑️</button>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
        
        // Attach event listeners setelah HTML di-render
        this.attachDeleteListeners();
    },
    
    // Attach event listeners untuk tombol hapus
    attachDeleteListeners() {
        const deleteButtons = document.querySelectorAll('.btn-delete-cash');
        console.log('Found delete buttons:', deleteButtons.length); // Debug
        
        deleteButtons.forEach(btn => {
            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const transactionId = parseInt(btn.getAttribute('data-transaction-id'));
                console.log('Deleting transaction ID:', transactionId); // Debug
                this.deleteTransaction(transactionId);
            };
        });
    },
    
    // Fungsi delete yang fix
    deleteTransaction(transactionId) {
        // Cari transaksi dengan pengecekan tipe data yang benar
        const t = dataManager.data.cashTransactions.find(tr => {
            return tr.id === transactionId || tr.id === transactionId.toString();
        });
        
        if (!t) {
            console.error('Transaction not found. ID:', transactionId);
            console.log('Available transactions:', dataManager.data.cashTransactions);
            app.showToast('Transaksi tidak ditemukan!');
            return;
        }
        
        const confirmMsg = `Hapus transaksi "${t.note || t.category}"?\n\nRp ${utils.formatNumber(t.amount)}\n\nKas akan disesuaikan.`;
        
        if (!confirm(confirmMsg)) {
            return;
        }
        
        // Sesuaikan kas
        if (t.type === 'in' || t.type === 'modal_in' || t.type === 'topup') {
            dataManager.data.settings.currentCash -= t.amount;
        } else {
            dataManager.data.settings.currentCash += t.amount;
        }
        
        // Hapus transaksi dari array
        dataManager.data.cashTransactions = dataManager.data.cashTransactions.filter(
            tr => tr.id !== transactionId && tr.id !== transactionId.toString()
        );
        
        // Hapus transaksi fee terkait (jika ada)
        if (t.details && t.details.adminFee > 0) {
            dataManager.data.transactions = dataManager.data.transactions.filter(tr => {
                if (tr.type === 'topup_fee' || tr.type === 'tarik_tunai_fee') {
                    const trTime = new Date(tr.date).getTime();
                    const cashTime = new Date(t.date).getTime();
                    return Math.abs(trTime - cashTime) > 2000;
                }
                return true;
            });
        }
        
        dataManager.save();
        app.updateHeader();
        this.updateStats();
        this.renderTransactions();
        app.showToast('Transaksi dihapus! Kas disesuaikan.');
    },
    
    openModal(type) {
        const isIn = type === 'in';
        
        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal active" id="cashModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <span class="modal-title">${isIn ? 'Kas Masuk' : 'Kas Keluar'}</span>
                        <button class="close-btn" onclick="cashModule.closeModal('cashModal')">×</button>
                    </div>
                    
                    <div class="form-group">
                        <label>Jumlah (Rp)</label>
                        <input type="number" id="cashAmount" placeholder="0">
                    </div>
                    
                    <div class="form-group">
                        <label>Kategori</label>
                        <select id="cashCategory">
                            ${isIn ? `
                                <option value="penjualan">Penjualan</option>
                                <option value="lainnya">Lainnya</option>
                            ` : `
                                <option value="operasional">Biaya Operasional</option>
                                <option value="gaji">Gaji Karyawan</option>
                                <option value="lainnya">Lainnya</option>
                            `}
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label>Keterangan</label>
                        <textarea id="cashNote" rows="3" placeholder="Catatan..."></textarea>
                    </div>
                    
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="cashModule.closeModal('cashModal')">Batal</button>
                        <button class="btn btn-primary" onclick="cashModule.saveTransaction('${type}')">Simpan</button>
                    </div>
                </div>
            </div>
        `);
    },
    
    saveTransaction(type) {
        const amount = parseInt(document.getElementById('cashAmount').value) || 0;
        const category = document.getElementById('cashCategory').value;
        const note = document.getElementById('cashNote').value;
        
        if (amount <= 0) {
            app.showToast('Jumlah tidak valid!');
            return;
        }
        
        if (type === 'out' && amount > dataManager.data.settings.currentCash) {
            app.showToast('Kas tidak mencukupi!');
            return;
        }
        
        dataManager.data.cashTransactions.push({
            id: Date.now(),
            date: new Date().toISOString(),
            type: type,
            amount: amount,
            category: category,
            note: note
        });
        
        if (type === 'in') {
            dataManager.data.settings.currentCash += amount;
        } else {
            dataManager.data.settings.currentCash -= amount;
        }
        
        dataManager.save();
        app.updateHeader();
        this.closeModal('cashModal');
        this.updateStats();
        this.renderTransactions();
        app.showToast('Transaksi kas tersimpan!');
    },
    
    openModalAwal() {
        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal active" id="modalAwalModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <span class="modal-title">💰 Input Modal Awal</span>
                        <button class="close-btn" onclick="cashModule.closeModal('modalAwalModal')">×</button>
                    </div>
                    
                    <div class="info-box warning">
                        <div class="info-title">📌 Modal Awal Shift</div>
                        <div class="info-text">
                            Modal akan ditambahkan ke Kas di Tangan untuk memulai shift baru.
                        </div>
                    </div>

                    <div class="form-group">
                        <label>Jumlah Modal (Rp)</label>
                        <input type="number" id="modalAwalAmount" placeholder="Contoh: 500000">
                    </div>
                    
                    <div class="form-group">
                        <label>Keterangan</label>
                        <textarea id="modalAwalNote" rows="2"></textarea>
                    </div>
                    
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="cashModule.closeModal('modalAwalModal')">Batal</button>
                        <button class="btn btn-warning" onclick="cashModule.saveModalAwal()">Simpan Modal</button>
                    </div>
                </div>
            </div>
        `);
    },
    
    saveModalAwal() {
        const amount = parseInt(document.getElementById('modalAwalAmount').value) || 0;
        const note = document.getElementById('modalAwalNote').value || 'Modal Awal Shift';
        
        if (amount <= 0) {
            app.showToast('Jumlah modal harus lebih dari 0!');
            return;
        }
        
        dataManager.data.settings.modalAwal = amount;
        dataManager.data.settings.currentCash += amount;
        
        dataManager.data.cashTransactions.push({
            id: Date.now(),
            date: new Date().toISOString(),
            type: 'modal_in',
            amount: amount,
            category: 'modal_awal',
            note: note
        });
        
        dataManager.save();
        app.updateHeader();
        this.closeModal('modalAwalModal');
        this.updateStats();
        this.renderTransactions();
        app.showToast(`Modal Rp ${utils.formatNumber(amount)} tersimpan!`);
    },
    
    openTopUp() {
        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal active" id="topUpModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <span class="modal-title">💜 Top Up</span>
                        <button class="close-btn" onclick="cashModule.closeModal('topUpModal')">×</button>
                    </div>
                    
                    <div class="info-box" style="background: #f3e5f5;">
                        <div class="info-title">Admin Fee = Laba!</div>
                        <div class="info-text">
                            Total bayar = Nominal + Admin Fee<br>
                            Admin fee masuk ke laba bersih
                        </div>
                    </div>

                    <div class="form-group">
                        <label>Jenis</label>
                        <select id="topUpType">
                            <option value="dana">DANA</option>
                            <option value="gopay">GoPay</option>
                            <option value="ovo">OVO</option>
                            <option value="shopeepay">ShopeePay</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label>Nominal (Rp)</label>
                        <input type="number" id="topUpNominal" placeholder="50000" oninput="cashModule.calcTopUp()">
                    </div>

                    <div class="form-group">
                        <label>Admin Fee (Rp)</label>
                        <input type="number" id="topUpAdmin" placeholder="1500" oninput="cashModule.calcTopUp()">
                    </div>
                    
                    <div class="calculation-box" style="background: #f3e5f5;">
                        <div class="calc-row">
                            <span>Total Bayar:</span>
                            <span id="topUpTotal">Rp 0</span>
                        </div>
                        <div class="calc-row" style="color: var(--success);">
                            <span>Laba (Admin):</span>
                            <span id="topUpProfit">Rp 0</span>
                        </div>
                    </div>
                    
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="cashModule.closeModal('topUpModal')">Batal</button>
                        <button class="btn btn-primary" onclick="cashModule.saveTopUp()" style="background: #9c27b0;">Proses</button>
                    </div>
                </div>
            </div>
        `);
    },
    
    calcTopUp() {
        const nominal = parseInt(document.getElementById('topUpNominal')?.value) || 0;
        const admin = parseInt(document.getElementById('topUpAdmin')?.value) || 0;
        
        const totalEl = document.getElementById('topUpTotal');
        const profitEl = document.getElementById('topUpProfit');
        
        if (totalEl) totalEl.textContent = 'Rp ' + utils.formatNumber(nominal + admin);
        if (profitEl) profitEl.textContent = 'Rp ' + utils.formatNumber(admin);
    },
    
    saveTopUp() {
        const nominal = parseInt(document.getElementById('topUpNominal').value) || 0;
        const admin = parseInt(document.getElementById('topUpAdmin').value) || 0;
        const type = document.getElementById('topUpType').value;
        
        if (nominal <= 0) {
            app.showToast('Nominal wajib diisi!');
            return;
        }
        
        const total = nominal + admin;
        
        dataManager.data.settings.currentCash += total;
        
        dataManager.data.cashTransactions.push({
            id: Date.now(),
            date: new Date().toISOString(),
            type: 'topup',
            amount: total,
            category: 'topup_' + type,
            note: `Top Up ${type.toUpperCase()}`,
            details: { nominal, adminFee: admin }
        });
        
        if (admin > 0) {
            dataManager.data.transactions.push({
                id: Date.now() + 1,
                date: new Date().toISOString(),
                items: [{
                    name: `Admin Fee Top Up ${type.toUpperCase()}`,
                    price: admin,
                    cost: 0,
                    qty: 1
                }],
                total: admin,
                profit: admin,
                paymentMethod: 'cash',
                status: 'completed',
                type: 'topup_fee'
            });
        }
        
        dataManager.save();
        app.updateHeader();
        this.closeModal('topUpModal');
        this.updateStats();
        this.renderTransactions();
        app.showToast(`Top up berhasil! Laba: Rp ${utils.formatNumber(admin)}`);
    },
    
    openTarikTunai() {
        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal active" id="tarikTunaiModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <span class="modal-title">🏧 Tarik Tunai</span>
                        <button class="close-btn" onclick="cashModule.closeModal('tarikTunaiModal')">×</button>
                    </div>
                    
                    <div class="info-box" style="background: #e1f5fe;">
                        <div class="info-title">Admin Fee = Laba!</div>
                        <div class="info-text">
                            Nominal = Uang diberikan ke customer<br>
                            Admin fee = Keuntungan konter
                        </div>
                    </div>

                    <div class="form-group">
                        <label>Nominal Tarik (Rp)</label>
                        <input type="number" id="tarikNominal" placeholder="100000" oninput="cashModule.calcTarik()">
                    </div>

                    <div class="form-group">
                        <label>Admin Fee (Rp)</label>
                        <input type="number" id="tarikAdmin" placeholder="2500" oninput="cashModule.calcTarik()">
                    </div>
                    
                    <div class="calculation-box" style="background: #e1f5fe;">
                        <div class="calc-row">
                            <span>Total Keluar dari Kas:</span>
                            <span id="tarikTotal" style="color: var(--danger);">Rp 0</span>
                        </div>
                        <div class="calc-row" style="color: var(--success);">
                            <span>Laba (Admin):</span>
                            <span id="tarikProfit">Rp 0</span>
                        </div>
                    </div>
                    
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="cashModule.closeModal('tarikTunaiModal')">Batal</button>
                        <button class="btn btn-info" onclick="cashModule.saveTarikTunai()">Proses</button>
                    </div>
                </div>
            </div>
        `);
    },
    
    calcTarik() {
        const nominal = parseInt(document.getElementById('tarikNominal')?.value) || 0;
        const admin = parseInt(document.getElementById('tarikAdmin')?.value) || 0;
        
        const totalEl = document.getElementById('tarikTotal');
        const profitEl = document.getElementById('tarikProfit');
        
        if (totalEl) totalEl.textContent = 'Rp ' + utils.formatNumber(nominal + admin);
        if (profitEl) profitEl.textContent = 'Rp ' + utils.formatNumber(admin);
    },
    
    saveTarikTunai() {
        const nominal = parseInt(document.getElementById('tarikNominal').value) || 0;
        const admin = parseInt(document.getElementById('tarikAdmin').value) || 0;
        const total = nominal + admin;
        
        if (nominal <= 0) {
            app.showToast('Nominal wajib diisi!');
            return;
        }
        
        if (total > dataManager.data.settings.currentCash) {
            app.showToast('Kas tidak mencukupi!');
            return;
        }
        
        dataManager.data.settings.currentCash -= total;
        
        dataManager.data.cashTransactions.push({
            id: Date.now(),
            date: new Date().toISOString(),
            type: 'out',
            amount: total,
            category: 'tarik_tunai',
            note: 'Tarik Tunai',
            details: { nominal, adminFee: admin }
        });
        
        if (admin > 0) {
            dataManager.data.transactions.push({
                id: Date.now() + 1,
                date: new Date().toISOString(),
                items: [{
                    name: 'Admin Fee Tarik Tunai',
                    price: admin,
                    cost: 0,
                    qty: 1
                }],
                total: admin,
                profit: admin,
                paymentMethod: 'cash',
                status: 'completed',
                type: 'tarik_tunai_fee'
            });
        }
        
        dataManager.save();
        app.updateHeader();
        this.closeModal('tarikTunaiModal');
        this.updateStats();
        this.renderTransactions();
        app.showToast(`Tarik tunai berhasil! Laba: Rp ${utils.formatNumber(admin)}`);
    },
    
    openHistory() {
        const today = new Date().toLocaleDateString('id-ID', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        });
        
        const allTrans = [...dataManager.data.cashTransactions].reverse();
        
        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal active" id="historyModal">
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <span class="modal-title">📋 Riwayat Kas</span>
                        <button class="close-btn" onclick="cashModule.closeModal('historyModal')">×</button>
                    </div>
                    
                    <div style="background: #e3f2fd; padding: 10px 15px; border-radius: 8px; margin-bottom: 15px;">
                        <b>${today}</b>
                    </div>
                    
                    <div class="transaction-list" style="max-height: 50vh; overflow-y: auto;">
                        ${allTrans.length === 0 ? '<div class="empty-state">Belum ada transaksi</div>' : 
                          allTrans.map(t => {
                            const isIncome = t.type === 'in' || t.type === 'modal_in' || t.type === 'topup';
                            return `
                                <div class="transaction-item">
                                    <div class="transaction-info">
                                        <div class="transaction-title">${t.note || t.category}</div>
                                        <div class="transaction-meta">${new Date(t.date).toLocaleString('id-ID')}</div>
                                    </div>
                                    <div class="transaction-amount ${isIncome ? 'income' : 'expense'}">
                                        ${isIncome ? '+' : '-'} Rp ${utils.formatNumber(t.amount)}
                                    </div>
                                </div>
                            `;
                          }).join('')}
                    </div>
                </div>
            </div>
        `);
    },
    
    closeModal(id) {
        document.getElementById(id)?.remove();
    }
};

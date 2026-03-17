const cashModule = {
    currentDeleteTransaction: null,
    isProcessing: false, // ⬅️ TAMBAH: Flag untuk mencegah double submit
    
    init() {
        // ⬅️ PERBAIKAN: Inisialisasi dan fix kas jika corrupt
        this.ensureCashInitialized();
        
        this.renderHTML();
        this.updateStats();
        this.renderTransactions();
    },

    // ⬅️ TAMBAH: Fungsi untuk memastikan currentCash selalu number dan valid
    ensureCashInitialized() {
        if (typeof dataManager !== 'undefined' && dataManager.data && dataManager.data.settings) {
            let currentCash = dataManager.data.settings.currentCash;
            let modalAwal = dataManager.data.settings.modalAwal;
            
            // Fix: Pastikan nilai adalah number yang valid
            if (typeof currentCash !== 'number' || isNaN(currentCash) || currentCash === null || currentCash === undefined) {
                console.log('[Cash] Fixing invalid currentCash:', currentCash);
                
                // Hitung ulang dari transaksi
                currentCash = this.calculateCashFromTransactions();
                dataManager.data.settings.currentCash = currentCash;
                
                console.log('[Cash] currentCash recalculated to:', currentCash);
            }
            
            // Fix: Pastikan modalAwal juga valid
            if (typeof modalAwal !== 'number' || isNaN(modalAwal) || modalAwal === null || modalAwal === undefined) {
                modalAwal = this.calculateModalFromTransactions();
                dataManager.data.settings.modalAwal = modalAwal;
                console.log('[Cash] modalAwal recalculated to:', modalAwal);
            }
            
            // Fix: Hapus duplikat transaksi modal hari ini
            this.removeDuplicateModals();
            
            dataManager.save();
        }
    },

    // ⬅️ TAMBAH: Hitung ulang kas dari semua transaksi
    calculateCashFromTransactions() {
        let cash = 0;
        
        if (typeof dataManager !== 'undefined' && dataManager.data && dataManager.data.cashTransactions) {
            dataManager.data.cashTransactions.forEach(t => {
                const amount = parseInt(t.amount) || 0;
                if (t.type === 'in' || t.type === 'modal_in' || t.type === 'topup') {
                    cash += amount;
                } else if (t.type === 'out') {
                    cash -= amount;
                }
            });
        }
        
        return cash;
    },

    // ⬅️ TAMBAH: Hitung modal dari transaksi
    calculateModalFromTransactions() {
        let modal = 0;
        
        if (typeof dataManager !== 'undefined' && dataManager.data && dataManager.data.cashTransactions) {
            dataManager.data.cashTransactions.forEach(t => {
                if (t.type === 'modal_in') {
                    modal += parseInt(t.amount) || 0;
                }
            });
        }
        
        return modal;
    },

    // ⬅️ TAMBAH: Hapus duplikat modal hari ini (simpan yang terakhir)
    removeDuplicateModals() {
        const today = new Date().toDateString();
        const modalsToday = [];
        
        // Cari semua modal hari ini
        dataManager.data.cashTransactions.forEach((t, index) => {
            if (t.type === 'modal_in' && new Date(t.date).toDateString() === today) {
                modalsToday.push({ ...t, index });
            }
        });
        
        // Jika ada lebih dari 1, hapus semua kecuali yang terakhir
        if (modalsToday.length > 1) {
            console.log(`[Cash] Found ${modalsToday.length} duplicate modals, removing duplicates...`);
            
            // Urutkan berdasarkan waktu (terbaru di akhir)
            modalsToday.sort((a, b) => new Date(a.date) - new Date(b.date));
            
            // Simpan yang terakhir, hapus sisanya
            const toDelete = modalsToday.slice(0, -1);
            
            // Hapus dari array (dari belakang agar index tidak bergeser)
            for (let i = toDelete.length - 1; i >= 0; i--) {
                dataManager.data.cashTransactions.splice(toDelete[i].index, 1);
                console.log('[Cash] Removed duplicate modal:', toDelete[i].amount);
            }
            
            // Recalculate kas
            const correctCash = this.calculateCashFromTransactions();
            dataManager.data.settings.currentCash = correctCash;
            
            console.log('[Cash] Kas fixed after removing duplicates:', correctCash);
        }
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
                    <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
                        <span class="card-title">Riwayat Transaksi Kas Hari Ini</span>
                        <button class="btn btn-sm btn-secondary" onclick="cashModule.recalculateCash()" style="font-size: 12px; padding: 6px 12px;">
                            🔄 Recalculate Kas
                        </button>
                    </div>
                    <div class="transaction-list" id="cashTransactionList"></div>
                </div>
            </div>
        `;
    },
    
    updateStats() {
        const today = new Date().toDateString();
        
        // ⬅️ PERBAIKAN: Hindari duplikat dengan menggunakan Map berdasarkan ID
        const uniqueTrans = new Map();
        dataManager.data.cashTransactions.forEach(t => {
            if (new Date(t.date).toDateString() === today) {
                uniqueTrans.set(t.id, t);
            }
        });
        
        const transactions = Array.from(uniqueTrans.values());
        
        const income = transactions
            .filter(t => t.type === 'in' || t.type === 'modal_in' || t.type === 'topup')
            .reduce((sum, t) => sum + (parseInt(t.amount) || 0), 0);
        
        const expense = transactions
            .filter(t => t.type === 'out')
            .reduce((sum, t) => sum + (parseInt(t.amount) || 0), 0);
        
        const incomeEl = document.getElementById('todayIncome');
        const expenseEl = document.getElementById('todayExpense');
        
        if (incomeEl) incomeEl.textContent = 'Rp ' + utils.formatNumber(income);
        if (expenseEl) expenseEl.textContent = 'Rp ' + utils.formatNumber(expense);
    },
    
    renderTransactions() {
        const container = document.getElementById('cashTransactionList');
        if (!container) return;
        
        const today = new Date().toDateString();
        
        // ⬅️ PERBAIKAN: Hindari duplikat saat render
        const seen = new Set();
        const transactions = dataManager.data.cashTransactions
            .filter(t => {
                if (new Date(t.date).toDateString() !== today) return false;
                
                // Cek duplikat berdasarkan ID
                if (seen.has(t.id)) return false;
                seen.add(t.id);
                return true;
            })
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
        this.attachDeleteListeners();
    },
    
    attachDeleteListeners() {
        const deleteButtons = document.querySelectorAll('.btn-delete-cash');
        
        deleteButtons.forEach(btn => {
            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const transactionId = parseInt(btn.getAttribute('data-transaction-id'));
                this.deleteTransaction(transactionId);
            };
        });
    },
    
    deleteTransaction(transactionId) {
        const t = dataManager.data.cashTransactions.find(tr => {
            return tr.id === transactionId || tr.id === transactionId.toString();
        });
        
        if (!t) {
            console.error('Transaction not found. ID:', transactionId);
            app.showToast('Transaksi tidak ditemukan!');
            return;
        }
        
        const confirmMsg = `Hapus transaksi "${t.note || t.category}"?\n\nRp ${utils.formatNumber(t.amount)}\n\nKas akan disesuaikan.`;
        
        if (!confirm(confirmMsg)) {
            return;
        }
        
        // ⬅️ PERBAIKAN: Pastikan currentCash adalah number sebelum operasi
        let currentCash = parseInt(dataManager.data.settings.currentCash) || 0;
        
        // Sesuaikan kas
        if (t.type === 'in' || t.type === 'modal_in' || t.type === 'topup') {
            currentCash -= parseInt(t.amount) || 0;
        } else {
            currentCash += parseInt(t.amount) || 0;
        }
        
        dataManager.data.settings.currentCash = currentCash;
        
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
                        <button class="btn btn-primary" onclick="cashModule.saveTransaction('${type}')" id="btnSaveTransaction">Simpan</button>
                    </div>
                </div>
            </div>
        `);
    },
    
    saveTransaction(type) {
        // ⬅️ PERBAIKAN: Cegah double submit
        if (this.isProcessing) {
            console.log('[Cash] Already processing, ignoring duplicate submit');
            return;
        }
        this.isProcessing = true;
        
        const btn = document.getElementById('btnSaveTransaction');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Menyimpan...';
        }
        
        const amount = parseInt(document.getElementById('cashAmount').value) || 0;
        const category = document.getElementById('cashCategory').value;
        const note = document.getElementById('cashNote').value;
        
        if (amount <= 0) {
            app.showToast('Jumlah tidak valid!');
            this.isProcessing = false;
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Simpan';
            }
            return;
        }
        
        // ⬅️ PERBAIKAN: Pastikan currentCash adalah number
        let currentCash = parseInt(dataManager.data.settings.currentCash) || 0;
        
        if (type === 'out' && amount > currentCash) {
            app.showToast('Kas tidak mencukupi!');
            this.isProcessing = false;
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Simpan';
            }
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
            dataManager.data.settings.currentCash = currentCash + amount;
        } else {
            dataManager.data.settings.currentCash = currentCash - amount;
        }
        
        dataManager.save();
        app.updateHeader();
        this.closeModal('cashModal');
        this.updateStats();
        this.renderTransactions();
        app.showToast('Transaksi kas tersimpan!');
        
        // Reset flag setelah delay
        setTimeout(() => {
            this.isProcessing = false;
        }, 500);
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
                        <button class="btn btn-warning" onclick="cashModule.saveModalAwal()" id="btnSaveModal">Simpan Modal</button>
                    </div>
                </div>
            </div>
        `);
    },
    
    saveModalAwal() {
        // ⬅️ PERBAIKAN: Cegah double submit
        if (this.isProcessing) {
            console.log('[Cash] Already processing modal, ignoring duplicate submit');
            return;
        }
        this.isProcessing = true;
        
        const btn = document.getElementById('btnSaveModal');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Menyimpan...';
        }
        
        const amount = parseInt(document.getElementById('modalAwalAmount').value) || 0;
        const note = document.getElementById('modalAwalNote').value || 'Modal Awal Shift';
        
        if (amount <= 0) {
            app.showToast('Jumlah modal harus lebih dari 0!');
            this.isProcessing = false;
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Simpan Modal';
            }
            return;
        }
        
        // ⬅️ PERBAIKAN: Cek apakah sudah ada modal dengan jumlah sama dalam 5 detik terakhir (anti-double click)
        const fiveSecondsAgo = Date.now() - 5000;
        const recentModal = dataManager.data.cashTransactions.find(t => 
            t.type === 'modal_in' && 
            t.amount === amount &&
            new Date(t.date).getTime() > fiveSecondsAgo
        );
        
        if (recentModal) {
            app.showToast('⚠️ Modal dengan jumlah sama sudah diinput beberapa detik yang lalu!');
            this.closeModal('modalAwalModal');
            this.isProcessing = false;
            return;
        }
        
        // ⬅️ PERBAIKAN: Cek apakah modal sudah ada hari ini
        const today = new Date().toDateString();
        const todayModal = dataManager.data.cashTransactions.find(t => 
            t.type === 'modal_in' && 
            new Date(t.date).toDateString() === today
        );
        
        if (todayModal) {
            if (!confirm('⚠️ Modal hari ini sudah diinput!\n\n' +
                `Modal existing: Rp ${utils.formatNumber(todayModal.amount)}\n` +
                `Modal baru: Rp ${utils.formatNumber(amount)}\n\n` +
                'Apakah Anda ingin MENGGANTI modal yang ada?')) {
                this.isProcessing = false;
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = 'Simpan Modal';
                }
                return;
            }
            
            // Hapus modal lama
            dataManager.data.cashTransactions = dataManager.data.cashTransactions.filter(
                t => !(t.type === 'modal_in' && new Date(t.date).toDateString() === today)
            );
            
            // Kurangi kas dari modal lama
            let currentCash = parseInt(dataManager.data.settings.currentCash) || 0;
            currentCash -= todayModal.amount;
            dataManager.data.settings.currentCash = currentCash;
        }
        
        // Lanjutkan simpan modal baru
        let currentCash = parseInt(dataManager.data.settings.currentCash) || 0;
        
        dataManager.data.settings.modalAwal = amount;
        dataManager.data.settings.currentCash = currentCash + amount;
        
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
        app.showToast(`Modal Rp ${utils.formatNumber(amount)} tersimpan! Kas sekarang: Rp ${utils.formatNumber(dataManager.data.settings.currentCash)}`);
        
        // Reset flag setelah delay
        setTimeout(() => {
            this.isProcessing = false;
        }, 1000);
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
                        <button class="btn btn-primary" onclick="cashModule.saveTopUp()" style="background: #9c27b0;" id="btnSaveTopUp">Proses</button>
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
        // ⬅️ PERBAIKAN: Cegah double submit
        if (this.isProcessing) return;
        this.isProcessing = true;
        
        const btn = document.getElementById('btnSaveTopUp');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Memproses...';
        }
        
        const nominal = parseInt(document.getElementById('topUpNominal').value) || 0;
        const admin = parseInt(document.getElementById('topUpAdmin').value) || 0;
        const type = document.getElementById('topUpType').value;
        
        if (nominal <= 0) {
            app.showToast('Nominal wajib diisi!');
            this.isProcessing = false;
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Proses';
            }
            return;
        }
        
        const total = nominal + admin;
        
        // ⬅️ PERBAIKAN: Pastikan currentCash adalah number
        let currentCash = parseInt(dataManager.data.settings.currentCash) || 0;
        dataManager.data.settings.currentCash = currentCash + total;
        
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
        
        setTimeout(() => {
            this.isProcessing = false;
        }, 1000);
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
                        <button class="btn btn-info" onclick="cashModule.saveTarikTunai()" id="btnSaveTarik">Proses</button>
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
        // ⬅️ PERBAIKAN: Cegah double submit
        if (this.isProcessing) return;
        this.isProcessing = true;
        
        const btn = document.getElementById('btnSaveTarik');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Memproses...';
        }
        
        const nominal = parseInt(document.getElementById('tarikNominal').value) || 0;
        const admin = parseInt(document.getElementById('tarikAdmin').value) || 0;
        const total = nominal + admin;
        
        if (nominal <= 0) {
            app.showToast('Nominal wajib diisi!');
            this.isProcessing = false;
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Proses';
            }
            return;
        }
        
        // ⬅️ PERBAIKAN: Pastikan currentCash adalah number
        let currentCash = parseInt(dataManager.data.settings.currentCash) || 0;
        
        if (total > currentCash) {
            app.showToast('Kas tidak mencukupi!');
            this.isProcessing = false;
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Proses';
            }
            return;
        }
        
        dataManager.data.settings.currentCash = currentCash - total;
        
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
        
        setTimeout(() => {
            this.isProcessing = false;
        }, 1000);
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
        if (id) {
            const modal = document.getElementById(id);
            if (modal) {
                modal.remove();
            }
        } else {
            // Close all modals
            document.querySelectorAll('.modal').forEach(m => m.remove());
        }
        
        // Reset processing flag setelah modal ditutup
        setTimeout(() => {
            this.isProcessing = false;
        }, 300);
    },

    // ⬅️ TAMBAH: Fungsi untuk recalculate kas manual
    recalculateCash() {
        if (!confirm('🔄 Recalculate Kas?\n\nIni akan:\n1. Menghitung ulang kas dari semua transaksi\n2. Menghapus duplikat jika ada\n3. Memperbaiki nilai yang salah\n\nLanjutkan?')) {
            return;
        }

        app.setLoading(true);
        
        setTimeout(() => {
            try {
                // 1. Hapus duplikat
                this.removeDuplicateModals();
                
                // 2. Hitung ulang kas
                const correctCash = this.calculateCashFromTransactions();
                const correctModal = this.calculateModalFromTransactions();
                
                // 3. Update settings
                dataManager.data.settings.currentCash = correctCash;
                dataManager.data.settings.modalAwal = correctModal;
                
                dataManager.save();
                
                // 4. Refresh UI
                app.updateHeader();
                this.updateStats();
                this.renderTransactions();
                
                app.showToast(`✅ Kas direcalculate!\nKas: Rp ${utils.formatNumber(correctCash)}\nModal: Rp ${utils.formatNumber(correctModal)}`);
                
            } catch (error) {
                console.error('[Cash] Recalculate error:', error);
                app.showToast('❌ Error: ' + error.message);
            } finally {
                app.setLoading(false);
            }
        }, 500);
    }
};

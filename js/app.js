// Router System
const router = {
    currentPage: null,
    allowedWhenClosed: ['backup', 'users'],

    navigate(page, element) {
        const isKasirOpen = app.data && app.data.kasir && app.data.kasir.isOpen;
        const currentUser = dataManager.getCurrentUser();

        if (!isKasirOpen && !this.allowedWhenClosed.includes(page)) {
            this.showKasirClosedModal();
            return;
        }

        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        if (element) element.classList.add('active');

        document.getElementById('cartBar').style.display = 'none';
        this.currentPage = page;

        switch(page) {
            case 'pos':
                posModule.init();
                document.getElementById('cartBar').style.display = 'flex';
                break;
            case 'products':
                productsModule.init();
                break;
            case 'cash':
                cashModule.init();
                break;
            case 'reports':
                reportsModule.init();
                break;
            case 'transactions':
                transactionsModule.init();
                break;
            case 'receipt':
                receiptModule.init();
                break;
            case 'backup':
                backupModule.init();
                break;
            case 'debt':
                debtModule.init();
                break;
            case 'users':
                usersModule.init();
                break;
        }
        window.scrollTo(0, 0);
    },

    showKasirClosedModal() {
        const modalHTML = `
            <div class="modal active" id="kasirClosedModal" style="display: flex; z-index: 3000;">
                <div class="modal-content" style="max-width: 400px; text-align: center;">
                    <div style="font-size: 64px; margin-bottom: 20px;">🔒</div>
                    <div class="modal-header" style="justify-content: center; margin-bottom: 15px;">
                        <span class="modal-title" style="font-size: 20px;">Kasir Sedang Tutup</span>
                    </div>
                    <div style="background: #ffebee; border: 2px solid #f44336; border-radius: 12px; padding: 15px; margin-bottom: 20px;">
                        <div style="color: #c62828; font-weight: 600; margin-bottom: 8px;">⚠️ Akses Ditolak</div>
                        <div style="font-size: 14px; color: #666; line-height: 1.5;">
                            Menu ini tidak dapat diakses saat kasir tutup. 
                            Silakan login dan buka kasir terlebih dahulu.
                        </div>
                    </div>
                    <button class="btn btn-primary" onclick="router.closeKasirClosedModal(); app.showLoginModal();" style="background: #4caf50;">
                        🔓 Login & Buka Kasir
                    </button>
                </div>
            </div>
        `;
        const existingModal = document.getElementById('kasirClosedModal');
        if (existingModal) existingModal.remove();
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    closeKasirClosedModal() {
        const modal = document.getElementById('kasirClosedModal');
        if (modal) modal.remove();
    }
};

// Global App
const app = {
    data: null,
    currentUser: null,

    init() {
        dataManager.init();
        this.data = dataManager.data;
        this.currentUser = dataManager.getCurrentUser();

        // Cek apakah sudah login
        if (!this.currentUser) {
            this.showLoginModal();
            return;
        }

        this.updateHeader();
        this.updateKasirStatus();

        // Cek status kasir untuk user ini
        const kasirStatus = dataManager.checkKasirStatusForUser(this.currentUser.userId);
        
        if (kasirStatus.reason === 'already_open_same_user') {
            // Lanjutkan ke POS
            const defaultTab = document.querySelector('.nav-tab');
            if (defaultTab) defaultTab.classList.add('active');
            posModule.init();
            document.getElementById('cartBar').style.display = 'flex';
            this.showToast(`Selamat datang kembali, ${this.currentUser.name}! 👋`);
        } else if (this.data.kasir.isOpen && kasirStatus.reason === 'different_user') {
            // Kasir dipakai user lain
            this.showKasirUsedByOtherModal();
        } else {
            // Kasir tutup atau hari baru
            this.showKasirClosedPage();
            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        }
    },

    // LOGIN MODAL
    showLoginModal() {
        const modalHTML = `
            <div class="modal active" id="loginModal" style="display: flex; z-index: 4000; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                <div class="modal-content" style="max-width: 400px; text-align: center; border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
                    <div style="margin-bottom: 30px;">
                        <div style="font-size: 64px; margin-bottom: 15px;">🏪</div>
                        <h2 style="color: #333; margin-bottom: 5px;">${this.data.settings.storeName}</h2>
                        <p style="color: #666; font-size: 14px;">Sistem Kasir Modern</p>
                    </div>

                    <div id="loginForm">
                        <div class="form-group" style="text-align: left;">
                            <label style="font-weight: 600; color: #555;">👤 Username</label>
                            <input type="text" id="loginUsername" placeholder="Masukkan username" 
                                   style="width: 100%; padding: 15px; border: 2px solid #e0e0e0; border-radius: 12px; font-size: 16px; margin-top: 8px;">
                        </div>

                        <div class="form-group" style="text-align: left; margin-top: 20px;">
                            <label style="font-weight: 600; color: #555;">🔒 Password</label>
                            <input type="password" id="loginPassword" placeholder="Masukkan password" 
                                   style="width: 100%; padding: 15px; border: 2px solid #e0e0e0; border-radius: 12px; font-size: 16px; margin-top: 8px;">
                        </div>

                        <div id="loginError" style="color: #f44336; font-size: 14px; margin-top: 15px; display: none;"></div>

                        <button onclick="app.doLogin()" 
                                style="width: 100%; margin-top: 25px; padding: 16px; font-size: 16px; font-weight: 600;
                                       background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                       color: white; border: none; border-radius: 12px; cursor: pointer;
                                       box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
                            🔓 Login
                        </button>
                    </div>

                    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;">
                        <p style="font-size: 12px; color: #999;">Default: admin/admin123 atau kasir1/kasir123</p>
                    </div>
                </div>
            </div>
        `;
        
        const existingModal = document.getElementById('loginModal');
        if (existingModal) existingModal.remove();
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Enter key support
        setTimeout(() => {
            document.getElementById('loginPassword').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') app.doLogin();
            });
            document.getElementById('loginUsername').focus();
        }, 100);
    },

    doLogin() {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;
        const errorDiv = document.getElementById('loginError');

        if (!username || !password) {
            errorDiv.textContent = 'Username dan password wajib diisi!';
            errorDiv.style.display = 'block';
            return;
        }

        const result = dataManager.login(username, password);
        
        if (result.success) {
            this.currentUser = result.user;
            this.closeLoginModal();
            this.handlePostLogin();
        } else {
            errorDiv.textContent = result.message;
            errorDiv.style.display = 'block';
        }
    },

    closeLoginModal() {
        const modal = document.getElementById('loginModal');
        if (modal) modal.remove();
    },

    handlePostLogin() {
        this.updateHeader();
        this.updateKasirStatus();

        const kasirStatus = dataManager.checkKasirStatusForUser(this.currentUser.userId);

        if (kasirStatus.reason === 'already_open_same_user') {
            // Hari sama, user sama -> langsung ke POS
            this.showToast(`Selamat datang kembali, ${this.currentUser.name}! 👋`);
            const defaultTab = document.querySelector('.nav-tab');
            if (defaultTab) defaultTab.classList.add('active');
            posModule.init();
            document.getElementById('cartBar').style.display = 'flex';
        } else if (kasirStatus.reason === 'new_day_same_user') {
            // Hari baru, user sama -> tanya apakah mau reset
            this.showNewDayConfirmModal();
        } else if (kasirStatus.reason === 'different_user') {
            // User lain sedang pakai
            this.showKasirUsedByOtherModal();
        } else {
            // Kasir tutup -> tampilkan halaman buka kasir
            this.showKasirClosedPage();
        }
    },

    showNewDayConfirmModal() {
        const modalHTML = `
            <div class="modal active" id="newDayModal" style="display: flex; z-index: 3500;">
                <div class="modal-content" style="max-width: 400px; text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 15px;">🌅</div>
                    <div class="modal-header" style="justify-content: center;">
                        <span class="modal-title">Shift Baru Hari Ini</span>
                    </div>
                    <p style="color: #666; margin: 20px 0; line-height: 1.6;">
                        Hai <b>${this.currentUser.name}</b>!<br><br>
                        Kasir terakhir dibuka kemarin.<br>
                        Modal akan direset ke <b>Rp 0</b> untuk shift hari ini.
                    </p>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <button class="btn btn-secondary" onclick="app.logout()">Logout</button>
                        <button class="btn btn-primary" onclick="app.confirmOpenKasir(true)">Buka Kasir</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    showKasirUsedByOtherModal() {
        const currentKasirUser = this.data.kasir.currentUser;
        const users = dataManager.getUsers();
        const userInfo = users.find(u => u.id === currentKasirUser);
        const userName = userInfo ? userInfo.name : 'User lain';

        const modalHTML = `
            <div class="modal active" id="kasirUsedModal" style="display: flex; z-index: 3500;">
                <div class="modal-content" style="max-width: 400px; text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 15px;">⚠️</div>
                    <div class="modal-header" style="justify-content: center;">
                        <span class="modal-title">Kasir Sedang Digunakan</span>
                    </div>
                    <p style="color: #666; margin: 20px 0; line-height: 1.6;">
                        Kasir saat ini sedang digunakan oleh:<br>
                        <b>${userName}</b><br><br>
                        Silakan tunggu atau hubungi admin untuk menutup kasir.
                    </p>
                    <button class="btn btn-secondary" onclick="app.logout()" style="width: 100%;">Logout</button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    confirmOpenKasir(forceReset) {
        const newDayModal = document.getElementById('newDayModal');
        if (newDayModal) newDayModal.remove();

        const result = dataManager.openKasir(this.currentUser.userId, forceReset);
        
        if (result.success) {
            this.updateHeader();
            this.updateKasirStatus();
            this.showToast(result.message);
            
            const defaultTab = document.querySelector('.nav-tab');
            if (defaultTab) defaultTab.classList.add('active');
            posModule.init();
            document.getElementById('cartBar').style.display = 'flex';
        }
    },

    logout() {
        dataManager.logout();
        this.currentUser = null;
        location.reload();
    },

    // HEADER UPDATE dengan Total Transaksi
    updateHeader() {
        // Update info toko
        document.getElementById('headerStoreName').textContent = this.data.settings.storeName;
        document.getElementById('headerStoreAddress').textContent = this.data.settings.address || 'Alamat Belum Diatur';
        
        // Update kas info
        document.getElementById('currentCash').textContent = 'Rp ' + utils.formatNumber(this.data.settings.currentCash);
        document.getElementById('modalAwal').textContent = 'Rp ' + utils.formatNumber(this.data.settings.modalAwal);
        
        // Update profit hari ini
        const todayProfit = this.calculateTodayProfit();
        document.getElementById('headerProfit').textContent = 'Rp ' + utils.formatNumber(todayProfit);
        
        // Update total transaksi hari ini - INI YANG DITAMBAH
        const todayTransCount = this.calculateTodayTransactionCount();
        const transCountEl = document.getElementById('headerTransactionCount');
        if (transCountEl) {
            transCountEl.textContent = todayTransCount;
        }

        // Update user info
        const userInfoEl = document.getElementById('userInfo');
        if (userInfoEl && this.currentUser) {
            userInfoEl.innerHTML = `👤 ${this.currentUser.name} | 🚪 <a href="#" onclick="app.logout()" style="color: white; text-decoration: underline;">Logout</a>`;
        }
    },

    calculateTodayProfit() {
        const today = new Date().toDateString();
        return this.data.transactions
            .filter(t => new Date(t.date).toDateString() === today && t.status !== 'deleted' && t.status !== 'voided')
            .reduce((sum, t) => sum + t.profit, 0);
    },

    // FUNGSI BARU: Hitung total transaksi hari ini
    calculateTodayTransactionCount() {
        const today = new Date().toDateString();
        return this.data.transactions
            .filter(t => new Date(t.date).toDateString() === today && t.status !== 'deleted' && t.status !== 'voided')
            .length;
    },

    updateKasirStatus() {
        const isOpen = this.data.kasir && this.data.kasir.isOpen;
        const dot = document.getElementById('kasirStatusDot');
        const text = document.getElementById('kasirStatusText');
        const shiftStatus = document.getElementById('shiftStatus');
        const indicator = document.getElementById('kasirStatusIndicator');

        if (isOpen) {
            dot.style.background = '#00b894';
            text.textContent = '🔓 Kasir Buka';
            shiftStatus.textContent = this.currentUser ? this.currentUser.name : 'Aktif';
            indicator.className = 'kasir-indicator open';
        } else {
            dot.style.background = '#ff4757';
            text.textContent = '🔒 Kasir Tutup';
            shiftStatus.textContent = 'Tutup';
            indicator.className = 'kasir-indicator closed';
        }
    },

    showKasirClosedPage() {
        const container = document.getElementById('mainContent');
        if (!container) return;

        container.innerHTML = `
            <div class="content-section active" style="text-align: center; padding: 40px 20px;">
                <div style="font-size: 80px; margin-bottom: 20px;">🔒</div>
                <h2 style="color: #c62828; margin-bottom: 15px;">Kasir Sedang Tutup</h2>
                <p style="color: #666; margin-bottom: 30px; line-height: 1.6;">
                    Selamat datang, <b>${this.currentUser ? this.currentUser.name : ''}</b>!<br>
                    Silakan buka kasir untuk memulai shift kerja.
                </p>

                <div style="background: #e8f5e9; border: 2px solid #4caf50; border-radius: 16px; padding: 25px; max-width: 400px; margin: 0 auto 20px;">
                    <div style="font-size: 14px; color: #666; margin-bottom: 15px;">
                        📅 Hari ini: ${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                    <div style="font-size: 13px; color: #888;">
                        ${this.data.kasir.date ? `Shift terakhir: ${new Date(this.data.kasir.date).toLocaleDateString('id-ID')}` : 'Belum ada shift hari ini'}
                    </div>
                </div>

                <button onclick="app.confirmOpenKasir(true)" 
                        style="padding: 15px 40px; font-size: 16px; 
                               background: linear-gradient(135deg, #4caf50 0%, #2e7d32 100%);
                               color: white; border: none; border-radius: 12px;
                               cursor: pointer; font-weight: 600;
                               box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);">
                    🔓 Buka Kasir Sekarang
                </button>

                <div style="margin-top: 20px;">
                    <a href="#" onclick="app.logout()" style="color: #999; font-size: 14px;">🚪 Logout</a>
                </div>
            </div>
        `;
    },

    // SETTINGS MODAL
    openSettings() {
        const isOpen = this.data.kasir && this.data.kasir.isOpen;
        const currentUser = dataManager.getCurrentUser();

        const modalHTML = `
            <div class="modal active" id="settingsModal" style="display: flex; z-index: 2000;">
                <div class="modal-content" style="max-width: 450px; max-height: 90vh; overflow-y: auto;">
                    <div class="modal-header">
                        <span class="modal-title">⚙️ Pengaturan & Manajemen Kasir</span>
                        <button class="close-btn" onclick="app.closeSettings()">×</button>
                    </div>

                    <!-- User Info -->
                    <div class="card" style="margin-bottom: 20px; background: #e3f2fd; border: 2px solid #2196f3;">
                        <div style="padding: 15px; text-align: center;">
                            <div style="font-size: 32px; margin-bottom: 10px;">👤</div>
                            <div style="font-weight: 700; font-size: 16px;">${currentUser ? currentUser.name : 'Guest'}</div>
                            <div style="font-size: 12px; color: #666; text-transform: uppercase;">${currentUser ? currentUser.role : ''}</div>
                        </div>
                    </div>

                    <!-- Kasir Status -->
                    <div class="card" style="margin-bottom: 20px; background: ${isOpen ? '#e8f5e9' : '#ffebee'}; border: 2px solid ${isOpen ? 'var(--success)' : 'var(--danger)'};">
                        <div class="card-header" style="margin-bottom: 15px;">
                            <span class="card-title" style="font-size: 18px;">
                                ${isOpen ? '🔓 KASIR SEDANG BUKA' : '🔒 KASIR SEDANG TUTUP'}
                            </span>
                        </div>

                        <div style="text-align: center; padding: 20px;">
                            <div style="font-size: 48px; margin-bottom: 10px;">
                                ${isOpen ? '🔓' : '🔒'}
                            </div>
                            <div style="font-weight: 700; font-size: 16px; margin-bottom: 5px;">
                                ${isOpen ? 'Siap melayani transaksi' : 'Silakan buka kasir untuk memulai'}
                            </div>
                            ${isOpen ? `
                                <div style="font-size: 13px; color: #666;">
                                    Buka sejak: ${new Date(this.data.kasir.openTime).toLocaleString('id-ID')}<br>
                                    oleh: ${this.data.kasir.currentUser ? (dataManager.getUsers().find(u => u.id === this.data.kasir.currentUser)?.name || 'Unknown') : 'Unknown'}
                                </div>
                            ` : ''}
                        </div>

                        <div class="kasir-actions" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 15px;">
                            <button class="kasir-btn open" onclick="app.openKasir()" ${isOpen ? 'disabled style="opacity: 0.5;"' : ''}>
                                <span style="font-size: 28px;">🔓</span>
                                <span>Buka Kasir</span>
                                <small style="font-size: 10px; opacity: 0.8;">Shift baru</small>
                            </button>
                            <button class="kasir-btn close" onclick="app.closeKasir()" ${!isOpen ? 'disabled style="opacity: 0.5;"' : ''}>
                                <span style="font-size: 28px;">🔒</span>
                                <span>Tutup Kasir</span>
                                <small style="font-size: 10px; opacity: 0.8;">Akhiri shift</small>
                            </button>
                        </div>
                    </div>

                    <!-- Store Settings -->
                    <div style="background: white; border-radius: 16px; padding: 20px; margin-bottom: 15px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                        <div class="card-header" style="margin-bottom: 15px;">
                            <span class="card-title">🏪 Pengaturan Toko</span>
                        </div>
                        <div class="form-group">
                            <label>Nama Toko *</label>
                            <input type="text" id="settingStoreName" value="${this.data.settings.storeName}">
                        </div>
                        <div class="form-group">
                            <label>Alamat Toko *</label>
                            <textarea id="settingStoreAddress" rows="2">${this.data.settings.address || ''}</textarea>
                        </div>
                        <div class="form-group">
                            <label>Nomor HP / WhatsApp</label>
                            <input type="text" id="settingPhone" value="${this.data.settings.receiptHeader?.phone || ''}" placeholder="0812-3456-7890">
                        </div>
                        <div class="form-group">
                            <label>Pajak Default (%)</label>
                            <input type="number" id="settingTax" value="${this.data.settings.taxRate || 0}" placeholder="0">
                        </div>
                    </div>

                    <!-- Receipt Settings -->
                    <div style="background: white; border-radius: 16px; padding: 20px; margin-bottom: 15px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                        <div class="card-header" style="margin-bottom: 15px;">
                            <span class="card-title">🧾 Header Struk</span>
                        </div>
                        <div class="form-group">
                            <label>Catatan Footer Struk</label>
                            <textarea id="settingReceiptNote" rows="2" placeholder="Terima kasih...">${this.data.settings.receiptHeader?.note || 'Terima kasih atas kunjungan Anda'}</textarea>
                        </div>
                    </div>

                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="app.closeSettings()">Tutup</button>
                        <button class="btn btn-primary" onclick="app.saveSettings()">💾 Simpan Pengaturan</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    closeSettings() {
        const modal = document.getElementById('settingsModal');
        if (modal) modal.remove();
    },

    openKasir() {
        if (!this.currentUser) {
            this.showToast('❌ Silakan login terlebih dahulu!');
            return;
        }

        const status = dataManager.checkKasirStatusForUser(this.currentUser.userId);
        
        if (status.reason === 'different_user') {
            this.showToast('❌ Kasir sedang digunakan oleh user lain!');
            return;
        }

        if (!confirm('🔓 BUKA KASIR?\n\nTindakan ini akan membuka shift baru.\nLanjutkan?')) {
            return;
        }

        const result = dataManager.openKasir(this.currentUser.userId, true);
        
        if (result.success) {
            this.updateHeader();
            this.updateKasirStatus();
            this.closeSettings();
            this.showToast(result.message);
            
            const defaultTab = document.querySelector('.nav-tab');
            if (defaultTab) defaultTab.classList.add('active');
            posModule.init();
            document.getElementById('cartBar').style.display = 'flex';
        }
    },

    closeKasir() {
        if (!confirm('🔒 TUTUP KASIR?\n\nTindakan ini akan:\n• Mengakhiri shift saat ini\n• Menyimpan laporan shift\n• Mencegah transaksi baru\n\nPastikan semua transaksi sudah terekam!\n\nLanjutkan?')) {
            return;
        }

        const result = dataManager.closeKasir();
        
        if (result.success) {
            this.updateHeader();
            this.updateKasirStatus();
            this.closeSettings();
            this.showToast(result.message);
            this.showKasirClosedPage();
            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        } else {
            this.showToast('❌ ' + result.message);
        }
    },

    saveSettings() {
        const storeName = document.getElementById('settingStoreName').value.trim();
        const address = document.getElementById('settingStoreAddress').value.trim();
        const phone = document.getElementById('settingPhone').value.trim();
        const tax = parseInt(document.getElementById('settingTax').value) || 0;
        const note = document.getElementById('settingReceiptNote').value.trim();

        if (!storeName || !address) {
            app.showToast('❌ Nama dan alamat toko wajib diisi!');
            return;
        }

        this.data.settings.storeName = storeName;
        this.data.settings.address = address;
        this.data.settings.taxRate = tax;

        if (!this.data.settings.receiptHeader) {
            this.data.settings.receiptHeader = {};
        }
        this.data.settings.receiptHeader.storeName = storeName;
        this.data.settings.receiptHeader.address = address;
        this.data.settings.receiptHeader.phone = phone;
        this.data.settings.receiptHeader.note = note;

        dataManager.save();
        this.updateHeader();
        this.closeSettings();
        app.showToast('✅ Pengaturan disimpan!');
    },

    showToast(message) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    },

    setLoading(show) {
        document.getElementById('loadingOverlay').classList.toggle('active', show);
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});

// Close modal on outside click
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
        setTimeout(() => e.target.remove(), 300);
    }
});

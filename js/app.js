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
            <div class="modal active" id="kasirClosedModal" style="display: flex; z-index: 3000; align-items: flex-start; padding-top: 100px;">
                <div class="modal-content" style="max-width: 400px; text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 15px;">🔒</div>
                    <div class="modal-header" style="justify-content: center; margin-bottom: 10px;">
                        <span class="modal-title" style="font-size: 18px;">Kasir Sedang Tutup</span>
                    </div>
                    <div style="background: #ffebee; border: 2px solid #f44336; border-radius: 12px; padding: 15px; margin-bottom: 20px;">
                        <div style="color: #c62828; font-weight: 600; margin-bottom: 8px; font-size: 14px;">⚠️ Akses Ditolak</div>
                        <div style="font-size: 13px; color: #666; line-height: 1.5;">
                            Menu ini tidak dapat diakses saat kasir tutup.<br>
                            Silakan login dan buka kasir terlebih dahulu.
                        </div>
                    </div>
                    <button class="btn btn-primary" onclick="router.closeKasirClosedModal();" style="background: #4caf50; padding: 10px 30px;">
                        Tutup
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
        console.log('[App] Initializing...');
        
        // Init dataManager
        if (typeof dataManager !== 'undefined') {
            dataManager.init();
            this.data = dataManager.data;
        } else {
            console.error('[App] dataManager not found!');
            return;
        }

        // Update nama toko di login
        const loginStoreName = document.getElementById('loginStoreName');
        if (loginStoreName && this.data.settings) {
            loginStoreName.textContent = this.data.settings.storeName || 'Hifzi Cell';
        }

        // Cek apakah sudah login
        this.currentUser = dataManager.getCurrentUser();
        console.log('[App] Current user:', this.currentUser);

        if (!this.currentUser) {
            console.log('[App] No user logged in, showing login');
            this.showLogin();
            return;
        }

        // Sudah login, cek status kasir
        console.log('[App] User logged in, checking kasir status');
        this.handleLoggedIn();
    },

    showLogin() {
        document.getElementById('loginContainer').style.display = 'flex';
        document.getElementById('appContainer').classList.remove('active');
        
        // Setup login button event listener
        const loginBtn = document.getElementById('loginBtn');
        const usernameInput = document.getElementById('loginUsername');
        const passwordInput = document.getElementById('loginPassword');
        
        if (loginBtn) {
            // Hapus listener lama jika ada
            const newBtn = loginBtn.cloneNode(true);
            loginBtn.parentNode.replaceChild(newBtn, loginBtn);
            
            // Tambah listener baru
            newBtn.addEventListener('click', () => {
                this.doLogin();
            });
        }
        
        // Enter key support
        if (passwordInput) {
            passwordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.doLogin();
                }
            });
        }
        
        if (usernameInput) {
            usernameInput.focus();
        }
    },

    doLogin() {
        console.log('[App] doLogin called');
        
        const usernameInput = document.getElementById('loginUsername');
        const passwordInput = document.getElementById('loginPassword');
        const errorDiv = document.getElementById('loginError');
        const loginBtn = document.getElementById('loginBtn');
        
        if (!usernameInput || !passwordInput) {
            console.error('[App] Login inputs not found!');
            return;
        }
        
        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        
        console.log('[App] Attempting login for:', username);
        
        // Reset error
        if (errorDiv) {
            errorDiv.textContent = '';
            errorDiv.classList.remove('show');
        }
        
        // Validasi
        if (!username || !password) {
            if (errorDiv) {
                errorDiv.textContent = 'Username dan password wajib diisi!';
                errorDiv.classList.add('show');
            }
            return;
        }
        
        // Disable button
        if (loginBtn) {
            loginBtn.disabled = true;
            loginBtn.textContent = '⏳ Memuat...';
        }
        
        // Simulasi delay untuk UX
        setTimeout(() => {
            // Cek login
            const result = dataManager.login(username, password);
            console.log('[App] Login result:', result);
            
            if (result.success) {
                console.log('[App] Login successful');
                this.currentUser = result.user;
                this.handleLoggedIn();
            } else {
                console.log('[App] Login failed:', result.message);
                if (errorDiv) {
                    errorDiv.textContent = result.message;
                    errorDiv.classList.add('show');
                }
                if (loginBtn) {
                    loginBtn.disabled = false;
                    loginBtn.textContent = '🔓 Login';
                }
            }
        }, 500);
    },

    handleLoggedIn() {
        console.log('[App] Handling logged in user');
        
        // Sembunyikan login, tampilkan app
        document.getElementById('loginContainer').style.display = 'none';
        document.getElementById('appContainer').classList.add('active');
        
        // Update header
        this.updateHeader();
        this.updateKasirStatus();
        
        // Cek status kasir untuk user ini
        const kasirStatus = dataManager.checkKasirStatusForUser(this.currentUser.userId);
        console.log('[App] Kasir status:', kasirStatus);
        
        if (kasirStatus.reason === 'already_open_same_user') {
            // Lanjutkan ke POS
            console.log('[App] Kasir already open, going to POS');
            this.showToast(`Selamat datang kembali, ${this.currentUser.name}! 👋`);
            const defaultTab = document.querySelector('.nav-tab');
            if (defaultTab) defaultTab.classList.add('active');
            posModule.init();
            document.getElementById('cartBar').style.display = 'flex';
        } else if (kasirStatus.reason === 'new_day_same_user') {
            // Hari baru, tanya reset
            console.log('[App] New day, showing confirm modal');
            this.showNewDayConfirmModal();
        } else if (kasirStatus.reason === 'different_user') {
            // User lain sedang pakai
            console.log('[App] Different user using kasir');
            this.showKasirUsedByOtherModal();
        } else {
            // Kasir tutup
            console.log('[App] Kasir closed, showing closed page');
            this.showKasirClosedPage();
        }
    },

    showNewDayConfirmModal() {
        const modalHTML = `
            <div class="modal active" id="newDayModal" style="display: flex; z-index: 3500; align-items: flex-start; padding-top: 100px;">
                <div class="modal-content" style="max-width: 400px; text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 15px;">🌅</div>
                    <div class="modal-header" style="justify-content: center;">
                        <span class="modal-title" style="font-size: 16px;">Shift Baru Hari Ini</span>
                    </div>
                    <p style="color: #666; margin: 15px 0; line-height: 1.6; font-size: 14px;">
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
            <div class="modal active" id="kasirUsedModal" style="display: flex; z-index: 3500; align-items: flex-start; padding-top: 100px;">
                <div class="modal-content" style="max-width: 400px; text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 15px;">⚠️</div>
                    <div class="modal-header" style="justify-content: center;">
                        <span class="modal-title" style="font-size: 16px;">Kasir Sedang Digunakan</span>
                    </div>
                    <p style="color: #666; margin: 15px 0; line-height: 1.6; font-size: 14px;">
                        Kasir saat ini sedang digunakan oleh:<br>
                        <b>${userName}</b><br><br>
                        Silakan tunggu atau hubungi admin.
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

    updateHeader() {
        if (!this.data) return;
        
        // Update info toko
        const headerStoreName = document.getElementById('headerStoreName');
        const headerStoreAddress = document.getElementById('headerStoreAddress');
        
        if (headerStoreName) headerStoreName.textContent = this.data.settings.storeName || 'HIFZI CELL';
        if (headerStoreAddress) headerStoreAddress.textContent = this.data.settings.address || 'Alamat Belum Diatur';
        
        // Update kas info
        const currentCashEl = document.getElementById('currentCash');
        const modalAwalEl = document.getElementById('modalAwal');
        
        if (currentCashEl) currentCashEl.textContent = 'Rp ' + this.formatNumber(this.data.settings.currentCash || 0);
        if (modalAwalEl) modalAwalEl.textContent = 'Rp ' + this.formatNumber(this.data.settings.modalAwal || 0);
        
        // Update profit hari ini
        const todayProfit = this.calculateTodayProfit();
        const headerProfitEl = document.getElementById('headerProfit');
        if (headerProfitEl) headerProfitEl.textContent = 'Rp ' + this.formatNumber(todayProfit);
        
        // Update total transaksi hari ini
        const todayTransCount = this.calculateTodayTransactionCount();
        const transCountEl = document.getElementById('headerTransactionCount');
        if (transCountEl) transCountEl.textContent = todayTransCount;

        // Update user info
        const userInfoHeader = document.getElementById('userInfoHeader');
        const headerUserName = document.getElementById('headerUserName');
        const headerUserRole = document.getElementById('headerUserRole');
        
        if (this.currentUser) {
            if (userInfoHeader) userInfoHeader.style.display = 'flex';
            if (headerUserName) headerUserName.textContent = this.currentUser.name;
            if (headerUserRole) headerUserRole.textContent = this.currentUser.role;
        } else {
            if (userInfoHeader) userInfoHeader.style.display = 'none';
        }
    },

    calculateTodayProfit() {
        if (!this.data || !this.data.transactions) return 0;
        const today = new Date().toDateString();
        return this.data.transactions
            .filter(t => new Date(t.date).toDateString() === today && t.status !== 'deleted' && t.status !== 'voided')
            .reduce((sum, t) => sum + (t.profit || 0), 0);
    },

    calculateTodayTransactionCount() {
        if (!this.data || !this.data.transactions) return 0;
        const today = new Date().toDateString();
        return this.data.transactions
            .filter(t => new Date(t.date).toDateString() === today && t.status !== 'deleted' && t.status !== 'voided')
            .length;
    },

    updateKasirStatus() {
        if (!this.data || !this.data.kasir) return;
        
        const isOpen = this.data.kasir.isOpen;
        const dot = document.getElementById('kasirStatusDot');
        const text = document.getElementById('kasirStatusText');
        const shiftStatus = document.getElementById('shiftStatus');
        const indicator = document.getElementById('kasirStatusIndicator');

        if (isOpen) {
            if (dot) dot.style.background = '#00b894';
            if (text) text.textContent = '🔓 Kasir Buka';
            if (shiftStatus) shiftStatus.textContent = this.currentUser ? this.currentUser.name : 'Aktif';
            if (indicator) indicator.className = 'kasir-indicator open';
        } else {
            if (dot) dot.style.background = '#ff4757';
            if (text) text.textContent = '🔒 Kasir Tutup';
            if (shiftStatus) shiftStatus.textContent = 'Tutup';
            if (indicator) indicator.className = 'kasir-indicator closed';
        }
    },

    showKasirClosedPage() {
        const container = document.getElementById('mainContent');
        if (!container) return;

        container.innerHTML = `
            <div class="content-section active" style="text-align: center; padding: 40px 20px;">
                <div style="font-size: 64px; margin-bottom: 15px;">🔒</div>
                <h2 style="color: #c62828; margin-bottom: 15px; font-size: 20px;">Kasir Sedang Tutup</h2>
                <p style="color: #666; margin-bottom: 30px; line-height: 1.6; font-size: 14px;">
                    Selamat datang, <b>${this.currentUser ? this.currentUser.name : ''}</b>!<br>
                    Silakan buka kasir untuk memulai shift kerja.
                </p>

                <div style="background: #e8f5e9; border: 2px solid #4caf50; border-radius: 16px; padding: 20px; max-width: 350px; margin: 0 auto 20px;">
                    <div style="font-size: 13px; color: #666; margin-bottom: 10px;">
                        📅 Hari ini: ${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                    <div style="font-size: 12px; color: #888;">
                        ${this.data.kasir.date ? `Shift terakhir: ${new Date(this.data.kasir.date).toLocaleDateString('id-ID')}` : 'Belum ada shift hari ini'}
                    </div>
                </div>

                <button onclick="app.confirmOpenKasir(true)" 
                        style="padding: 12px 30px; font-size: 14px; 
                               background: linear-gradient(135deg, #4caf50 0%, #2e7d32 100%);
                               color: white; border: none; border-radius: 10px;
                               cursor: pointer; font-weight: 600;
                               box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);">
                    🔓 Buka Kasir Sekarang
                </button>

                <div style="margin-top: 20px;">
                    <a href="#" onclick="app.logout()" style="color: #999; font-size: 13px;">🚪 Logout</a>
                </div>
            </div>
        `;
    },

    // ==================== SETTINGS FUNCTIONAL ====================
    openSettings() {
        const modalHTML = `
            <div class="modal active" id="settingsModal" style="display: flex; z-index: 4000; align-items: flex-start; padding-top: 50px;">
                <div class="modal-content" style="max-width: 450px; max-height: 85vh; overflow-y: auto;">
                    <div class="modal-header">
                        <span class="modal-title">⚙️ Pengaturan Toko</span>
                        <button class="close-btn" onclick="app.closeSettings()">×</button>
                    </div>
                    
                    <div style="padding: 20px;">
                        <!-- Info Toko -->
                        <div style="margin-bottom: 20px;">
                            <label style="display: block; font-weight: 600; margin-bottom: 8px; font-size: 14px;">Nama Toko</label>
                            <input type="text" id="settingStoreName" 
                                   value="${this.data.settings.storeName || 'Hifzi Cell'}" 
                                   style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 10px; font-size: 14px; box-sizing: border-box;">
                        </div>
                        
                        <div style="margin-bottom: 20px;">
                            <label style="display: block; font-weight: 600; margin-bottom: 8px; font-size: 14px;">Alamat Toko</label>
                            <textarea id="settingStoreAddress" 
                                      style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 10px; min-height: 60px; resize: vertical; font-size: 14px; box-sizing: border-box; font-family: inherit;">${this.data.settings.address || ''}</textarea>
                        </div>
                        
                        <div style="margin-bottom: 20px;">
                            <label style="display: block; font-weight: 600; margin-bottom: 8px; font-size: 14px;">Nomor Telepon</label>
                            <input type="text" id="settingStorePhone" 
                                   value="${this.data.settings.phone || ''}" 
                                   style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 10px; font-size: 14px; box-sizing: border-box;">
                        </div>

                        <div style="margin-bottom: 20px;">
                            <label style="display: block; font-weight: 600; margin-bottom: 8px; font-size: 14px;">Pajak Default (%)</label>
                            <input type="number" id="settingTax" 
                                   value="${this.data.settings.tax || 0}" 
                                   style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 10px; font-size: 14px; box-sizing: border-box;">
                        </div>
                        
                        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                        
                        <!-- Data Management -->
                        <div style="margin-bottom: 10px;">
                            <label style="display: block; font-weight: 600; margin-bottom: 10px; color: #d32f2f; font-size: 14px;">⚠️ Zona Berbahaya</label>
                            <div style="display: grid; gap: 8px;">
                                <button onclick="app.confirmResetData()" 
                                        style="padding: 10px; background: #ffebee; color: #c62828; border: 1px solid #ef5350; border-radius: 8px; cursor: pointer; font-size: 13px;">
                                    🗑️ Reset Semua Data
                                </button>
                                <button onclick="app.exportData()" 
                                        style="padding: 10px; background: #e3f2fd; color: #1565c0; border: 1px solid #42a5f5; border-radius: 8px; cursor: pointer; font-size: 13px;">
                                    💾 Export Data (JSON)
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 10px; justify-content: flex-end; padding: 0 20px 20px;">
                        <button onclick="app.closeSettings()" 
                                style="padding: 10px 20px; background: #f5f5f5; border: none; border-radius: 8px; cursor: pointer; font-size: 14px;">Batal</button>
                        <button onclick="app.saveSettings()" 
                                style="padding: 10px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600;">Simpan Perubahan</button>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing modal
        const existingModal = document.getElementById('settingsModal');
        if (existingModal) existingModal.remove();
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    closeSettings() {
        const modal = document.getElementById('settingsModal');
        if (modal) modal.remove();
    },

    saveSettings() {
        const storeName = document.getElementById('settingStoreName').value.trim();
        const address = document.getElementById('settingStoreAddress').value.trim();
        const phone = document.getElementById('settingStorePhone').value.trim();
        const tax = parseFloat(document.getElementById('settingTax').value) || 0;

        // Update data
        this.data.settings.storeName = storeName;
        this.data.settings.address = address;
        this.data.settings.phone = phone;
        this.data.settings.tax = tax;

        // Save to storage
        dataManager.saveData();

        // Update header
        this.updateHeader();

        this.showToast('✅ Pengaturan berhasil disimpan!');
        this.closeSettings();
    },

    confirmResetData() {
        if (confirm('⚠️ PERINGATAN!\n\nSemua data akan dihapus permanen!\nTransaksi, produk, hutang, dan pengaturan akan hilang.\n\nApakah Anda yakin?')) {
            if (prompt('Ketik "HAPUS" untuk konfirmasi:') === 'HAPUS') {
                localStorage.removeItem('hifzi_data');
                this.showToast('🗑️ Semua data telah dihapus. Memuat ulang...');
                setTimeout(() => location.reload(), 1500);
            }
        }
    },

    exportData() {
        const dataStr = JSON.stringify(this.data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `hifzi_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.showToast('💾 Data berhasil diexport!');
    },
    // ==================== END SETTINGS ====================

    showToast(message) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    },

    formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }
};

// Initialize saat DOM ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('[App] DOM Content Loaded');
    app.init();
});

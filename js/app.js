/**
 * Global App - Core Application Logic
 * Hifzi Cell POS System
 */

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

        // Sudah login, render navigation sesuai role
        if (typeof router !== 'undefined') {
            router.renderNavigation();
        } else {
            console.error('[App] Router not found!');
        }

        console.log('[App] User logged in, checking kasir status');
        this.handleLoggedIn();
    },

    showLogin() {
        const loginContainer = document.getElementById('loginContainer');
        const appContainer = document.getElementById('appContainer');
        
        if (loginContainer) loginContainer.style.display = 'flex';
        if (appContainer) appContainer.classList.remove('active');
        
        const loginBtn = document.getElementById('loginBtn');
        const usernameInput = document.getElementById('loginUsername');
        const passwordInput = document.getElementById('loginPassword');
        
        if (loginBtn) {
            const newBtn = loginBtn.cloneNode(true);
            loginBtn.parentNode.replaceChild(newBtn, loginBtn);
            
            newBtn.addEventListener('click', () => {
                this.doLogin();
            });
        }
        
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
        
        if (errorDiv) {
            errorDiv.textContent = '';
            errorDiv.classList.remove('show');
        }
        
        if (!username || !password) {
            if (errorDiv) {
                errorDiv.textContent = 'Username dan password wajib diisi!';
                errorDiv.classList.add('show');
            }
            return;
        }
        
        if (loginBtn) {
            loginBtn.disabled = true;
            loginBtn.textContent = '⏳ Memuat...';
        }
        
        setTimeout(() => {
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
        
        if (typeof dataManager !== 'undefined') {
            dataManager.init();
            this.data = dataManager.data;
        }
        
        const loginContainer = document.getElementById('loginContainer');
        const appContainer = document.getElementById('appContainer');
        
        if (loginContainer) loginContainer.style.display = 'none';
        if (appContainer) appContainer.classList.add('active');
        
        if (typeof router !== 'undefined') {
            router.renderNavigation();
        }
        
        this.updateHeader();
        this.updateKasirStatus();
        
        const kasirStatus = dataManager.checkKasirStatusForUser(this.currentUser.userId);
        console.log('[App] Kasir status:', kasirStatus);
        
        // Owner dan Admin bisa langsung akses menu non-operasional meski kasir dibuka user lain
        if (this.currentUser.role === 'owner' || this.currentUser.role === 'admin') {
            this.showToast(`Selamat datang, ${this.currentUser.name}! 👋`);
            const defaultTab = document.querySelector('.nav-tab');
            if (defaultTab) defaultTab.classList.add('active');
            
            if (kasirStatus.reason === 'different_user') {
                if (typeof router !== 'undefined') {
                    router.navigate('users', defaultTab);
                }
            } else {
                if (typeof router !== 'undefined') {
                    router.navigate('pos', defaultTab);
                }
                const cartBar = document.getElementById('cartBar');
                if (cartBar) cartBar.style.display = 'flex';
            }
        } else if (kasirStatus.reason === 'already_open_same_user') {
            this.showToast(`Selamat datang kembali, ${this.currentUser.name}! 👋`);
            const defaultTab = document.querySelector('.nav-tab');
            if (defaultTab) defaultTab.classList.add('active');
            if (typeof posModule !== 'undefined') {
                posModule.init();
            }
            const cartBar = document.getElementById('cartBar');
            if (cartBar) cartBar.style.display = 'flex';
        } else if (kasirStatus.reason === 'new_day_same_user') {
            this.showNewDayConfirmModal();
        } else if (kasirStatus.reason === 'different_user') {
            this.showKasirUsedByOtherModal();
        } else {
            this.showKasirClosedPage();
        }
    },

    showNewDayConfirmModal() {
        const modalHTML = `
            <div class="modal active" id="newDayModal" style="display: flex; z-index: 3500; align-items: flex-start; padding-top: 100px;">
                <div class="modal-content" style="max-width: 350px; text-align: center;">
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
                <div class="modal-content" style="max-width: 350px; text-align: center;">
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
            if (typeof posModule !== 'undefined') {
                posModule.init();
            }
            const cartBar = document.getElementById('cartBar');
            if (cartBar) cartBar.style.display = 'flex';
        }
    },

    closeKasir() {
        if (!confirm('🚪 Yakin ingin menutup kasir?\n\nSemua transaksi hari ini akan disimpan.\nAnda perlu login ulang untuk membuka kasir lagi.')) {
            return;
        }

        const result = dataManager.closeKasir();
        if (result.success) {
            this.showToast(result.message);
            this.updateHeader();
            this.updateKasirStatus();
            
            setTimeout(() => {
                this.showKasirClosedPage();
            }, 1000);
        }
    },

    logout() {
        if (typeof dataManager !== 'undefined') {
            dataManager.save();
        }
        
        localStorage.removeItem('hifzi_current_user');
        
        this.currentUser = null;
        location.reload();
    },

    updateHeader() {
        if (!this.data) return;
        
        const headerStoreName = document.getElementById('headerStoreName');
        const headerStoreAddress = document.getElementById('headerStoreAddress');
        
        if (headerStoreName) headerStoreName.textContent = this.data.settings.storeName || 'HIFZI CELL';
        if (headerStoreAddress) headerStoreAddress.textContent = this.data.settings.address || 'Alamat Belum Diatur';
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todayTransactions = (this.data.transactions || []).filter(t => {
            if (t.status === 'deleted' || t.status === 'voided') return false;
            const tDate = new Date(t.date);
            tDate.setHours(0, 0, 0, 0);
            return tDate.getTime() === today.getTime();
        });
        
        const todayCashTrans = (this.data.cashTransactions || []).filter(t => {
            const tDate = new Date(t.date);
            tDate.setHours(0, 0, 0, 0);
            return tDate.getTime() === today.getTime();
        });
        
        let todayCashIn = 0;
        
        todayTransactions.forEach(t => {
            if (t.paymentMethod === 'cash') {
                todayCashIn += parseInt(t.total) || 0;
            }
        });
        
        todayCashTrans.forEach(t => {
            if (t.type === 'in' || t.type === 'modal_in' || t.type === 'topup') {
                todayCashIn += parseInt(t.amount) || 0;
            }
        });
        
        let todayCashOut = 0;
        todayCashTrans.forEach(t => {
            if (t.type === 'out') {
                todayCashOut += parseInt(t.amount) || 0;
            }
        });
        
        let todayModalAwal = 0;
        const kasirOpenDate = this.data.kasir?.date ? new Date(this.data.kasir.date) : null;
        
        if (kasirOpenDate) {
            const kasirDate = new Date(kasirOpenDate);
            kasirDate.setHours(0, 0, 0, 0);
            
            if (kasirDate.getTime() === today.getTime()) {
                todayModalAwal = parseInt(this.data.settings.modalAwal) || 0;
            }
        }
        
        if (todayModalAwal === 0) {
            const modalTrans = todayCashTrans.find(t => t.type === 'modal_in');
            if (modalTrans) {
                todayModalAwal = parseInt(modalTrans.amount) || 0;
            }
        }
        
        const todayNetCash = todayModalAwal + todayCashIn - todayCashOut;
        const todayProfit = todayTransactions.reduce((sum, t) => sum + (parseInt(t.profit) || 0), 0);
        
        const currentCashEl = document.getElementById('currentCash');
        const modalAwalEl = document.getElementById('modalAwal');
        const headerProfitEl = document.getElementById('headerProfit');
        const transCountEl = document.getElementById('headerTransactionCount');
        
        const updateWithHighlight = (element, newValue, prefix = '') => {
            if (!element) return;
            const newText = prefix + this.formatNumber(newValue);
            if (element.textContent !== newText) {
                element.classList.add('updated');
                element.textContent = newText;
                setTimeout(() => element.classList.remove('updated'), 500);
            }
        };
        
        updateWithHighlight(currentCashEl, todayNetCash, 'Rp ');
        updateWithHighlight(modalAwalEl, todayModalAwal, 'Rp ');
        updateWithHighlight(headerProfitEl, todayProfit, 'Rp ');
        updateWithHighlight(transCountEl, todayTransactions.length, '');
        
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

        this.updateKasirButton();
    },

    updateKasirButton() {
        const kasirBtn = document.getElementById('kasirToggleBtn');
        if (!kasirBtn) return;

        const isOpen = this.data.kasir && this.data.kasir.isOpen;
        const kasirCurrentUser = this.data.kasir ? this.data.kasir.currentUser : null;
        const canControlKasir = !isOpen || kasirCurrentUser === this.currentUser.userId || 
                               this.currentUser.role === 'owner' || this.currentUser.role === 'admin';

        if (!canControlKasir) {
            kasirBtn.style.display = 'none';
            return;
        }
        
        kasirBtn.style.display = 'block';

        if (isOpen) {
            kasirBtn.innerHTML = '🔒 Tutup Kasir';
            kasirBtn.style.background = '#ff4757';
            kasirBtn.onclick = () => this.closeKasir();
        } else {
            kasirBtn.innerHTML = '🔓 Buka Kasir';
            kasirBtn.style.background = '#2ed573';
            kasirBtn.onclick = () => this.confirmOpenKasir(true);
        }
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

        this.updateKasirButton();
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
                        ${this.data.kasir && this.data.kasir.date ? `Shift terakhir: ${new Date(this.data.kasir.date).toLocaleDateString('id-ID')}` : 'Belum ada shift hari ini'}
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

    openSettings() {
        const existingModal = document.getElementById('settingsModal');
        if (existingModal) existingModal.remove();

        const modalHTML = `
            <div class="modal active" id="settingsModal" style="display: flex; z-index: 4000; align-items: flex-start; padding-top: 80px;">
                <div class="modal-content" style="max-width: 380px; width: 90%; max-height: 80vh; overflow-y: auto; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
                    <div class="modal-header" style="padding: 15px 20px; border-bottom: 1px solid #eee;">
                        <span class="modal-title" style="font-size: 16px; font-weight: 600;">⚙️ Pengaturan Toko</span>
                        <button onclick="app.closeSettings()" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #666; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 50%;">×</button>
                    </div>
                    
                    <div style="padding: 20px;">
                        <div style="margin-bottom: 15px;">
                            <label style="display: block; font-weight: 600; margin-bottom: 6px; font-size: 13px; color: #555;">Nama Toko</label>
                            <input type="text" id="settingStoreName" 
                                   value="${this.data.settings.storeName || 'Hifzi Cell'}" 
                                   style="width: 100%; padding: 10px 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; box-sizing: border-box;">
                        </div>
                        
                        <div style="margin-bottom: 15px;">
                            <label style="display: block; font-weight: 600; margin-bottom: 6px; font-size: 13px; color: #555;">Alamat Toko</label>
                            <textarea id="settingStoreAddress" 
                                      style="width: 100%; padding: 10px 12px; border: 2px solid #e0e0e0; border-radius: 8px; min-height: 50px; resize: vertical; font-size: 14px; box-sizing: border-box; font-family: inherit;">${this.data.settings.address || ''}</textarea>
                        </div>
                        
                        <div style="margin-bottom: 15px;">
                            <label style="display: block; font-weight: 600; margin-bottom: 6px; font-size: 13px; color: #555;">Nomor Telepon</label>
                            <input type="text" id="settingStorePhone" 
                                   value="${this.data.settings.phone || ''}" 
                                   style="width: 100%; padding: 10px 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; box-sizing: border-box;">
                        </div>

                        <div style="margin-bottom: 20px;">
                            <label style="display: block; font-weight: 600; margin-bottom: 6px; font-size: 13px; color: #555;">Pajak Default (%)</label>
                            <input type="number" id="settingTax" 
                                   value="${this.data.settings.tax || 0}" 
                                   style="width: 100%; padding: 10px 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; box-sizing: border-box;">
                        </div>
                        
                        <hr style="border: none; border-top: 1px solid #eee; margin: 15px 0;">
                        
                        <div style="margin-bottom: 10px;">
                            <label style="display: block; font-weight: 600; margin-bottom: 10px; color: #d32f2f; font-size: 13px;">⚠️ Zona Berbahaya</label>
                            <div style="display: grid; gap: 8px;">
                                <button onclick="app.confirmResetData()" 
                                        style="padding: 10px; background: #ffebee; color: #c62828; border: 1px solid #ef5350; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 500;">
                                    🗑️ Reset Semua Data
                                </button>
                                <button onclick="app.exportData()" 
                                        style="padding: 10px; background: #e3f2fd; color: #1565c0; border: 1px solid #42a5f5; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 500;">
                                    💾 Export Data (JSON)
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 10px; justify-content: flex-end; padding: 0 20px 20px;">
                        <button onclick="app.closeSettings()" 
                                style="padding: 10px 20px; background: #f5f5f5; border: none; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 500; color: #666;">Batal</button>
                        <button onclick="app.saveSettings()" 
                                style="padding: 10px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600;">Simpan Perubahan</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    closeSettings() {
        const modal = document.getElementById('settingsModal');
        if (modal) {
            modal.remove();
        }
    },

    saveSettings() {
        try {
            const storeNameInput = document.getElementById('settingStoreName');
            const addressInput = document.getElementById('settingStoreAddress');
            const phoneInput = document.getElementById('settingStorePhone');
            const taxInput = document.getElementById('settingTax');

            if (!storeNameInput || !addressInput || !phoneInput || !taxInput) {
                console.error('[Settings] Input elements not found!');
                this.showToast('❌ Error: Form tidak ditemukan!');
                return;
            }

            const storeName = storeNameInput.value.trim();
            const address = addressInput.value.trim();
            const phone = phoneInput.value.trim();
            const tax = parseFloat(taxInput.value) || 0;

            this.data.settings.storeName = storeName;
            this.data.settings.address = address;
            this.data.settings.phone = phone;
            this.data.settings.tax = tax;

            if (typeof dataManager !== 'undefined' && dataManager.saveData) {
                dataManager.saveData();
            } else if (typeof dataManager !== 'undefined' && dataManager.save) {
                dataManager.save();
            }

            this.updateHeader();

            this.showToast('✅ Pengaturan berhasil disimpan!');
            this.closeSettings();
        } catch (error) {
            console.error('[Settings] Error saving:', error);
            this.showToast('❌ Gagal menyimpan pengaturan!');
        }
    },

    confirmResetData() {
        if (confirm('⚠️ PERINGATAN!\n\nSemua data akan dihapus permanen!\nTransaksi, produk, hutang, dan pengaturan akan hilang.\n\nApakah Anda yakin?')) {
            const confirmation = prompt('Ketik "HAPUS" untuk konfirmasi:');
            if (confirmation === 'HAPUS') {
                localStorage.removeItem('hifzi_data');
                localStorage.removeItem('hifzi_users');
                localStorage.removeItem('hifzi_current_user');
                this.showToast('🗑️ Semua data telah dihapus. Memuat ulang...');
                setTimeout(() => location.reload(), 1500);
            } else {
                this.showToast('❌ Penghapusan dibatalkan');
            }
        }
    },

    exportData() {
        try {
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
        } catch (error) {
            console.error('[Export] Error:', error);
            this.showToast('❌ Gagal export data!');
        }
    },

    showToast(message) {
        const existingToast = document.getElementById('toast');
        if (existingToast) existingToast.remove();
        
        const toast = document.createElement('div');
        toast.id = 'toast';
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%) translateY(-100px);
            background: rgba(0,0,0,0.85);
            color: white;
            padding: 10px 20px;
            border-radius: 20px;
            font-size: 13px;
            z-index: 10000;
            opacity: 0;
            transition: all 0.3s ease;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            max-width: 90%;
            text-align: center;
            white-space: nowrap;
            backdrop-filter: blur(10px);
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        requestAnimationFrame(() => {
            toast.style.transform = 'translateX(-50%) translateY(0)';
            toast.style.opacity = '1';
        });
        
        setTimeout(() => {
            toast.style.transform = 'translateX(-50%) translateY(-100px)';
            toast.style.opacity = '0';
            setTimeout(() => {
                if (toast.parentNode) toast.remove();
            }, 300);
        }, 2500);
    },

    formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }
};

document.addEventListener('DOMContentLoaded', () => {
    console.log('[App] DOM Content Loaded');
    app.init();
});

// ============================================
// APP.JS - HIFZI CELL (v2.5) - Fixed Router & Modal Sync + Kasir Lock All Menus (Fixed)
// ============================================

const app = {
    data: null,
    currentUser: null,
    isCloudConfigLoaded: false,

    init() {
        console.log('[App] Initializing v2.5...');
        
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

        // Sudah login, cek cloud config dulu (jika belum)
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

    async handleLoggedIn() {
        console.log('[App] Handling logged in user');
        
        if (typeof dataManager !== 'undefined') {
            dataManager.init();
            this.data = dataManager.data;
        }
        
        const loginContainer = document.getElementById('loginContainer');
        const appContainer = document.getElementById('appContainer');
        
        if (loginContainer) loginContainer.style.display = 'none';
        if (appContainer) appContainer.classList.add('active');
        
        // PERBAIKAN: Init backup module terlebih dahulu dan disable global listeners
        if (typeof backupModule !== 'undefined') {
            backupModule.init();
            // PERBAIKAN: Disable listeners yang mengganggu router
            if (typeof backupModule.disableGlobalListeners === 'function') {
                backupModule.disableGlobalListeners();
            }
        }
        
        // ==========================================
        // PERBAIKAN BARU: Render navigation terlebih dahulu
        // ==========================================
        if (typeof router !== 'undefined') {
            router.renderNavigation();
        }
        
        this.updateHeader();
        this.updateKasirStatus();
        
        // Cek dan load cloud config jika belum diload
        if (!this.isCloudConfigLoaded && typeof backupModule !== 'undefined') {
            await this.loadCloudConfigIfAvailable();
        }
        
        // ==========================================
        // PERBAIKAN BARU: Check kasir status dengan flow yang benar - BLOCK ALL MENUS IF KASIR CLOSED
        // ==========================================
        const kasirStatus = dataManager.checkKasirStatusForUser(this.currentUser.userId);
        console.log('[App] Kasir status:', kasirStatus);
        
        if (kasirStatus.reason === 'already_open_same_user') {
            this.showToast(`Selamat datang kembali, ${this.currentUser.name}! 👋`);
            // PERBAIKAN: Gunakan router.navigate, bukan posModule.init langsung
            const posTab = document.querySelector('.nav-tab[data-page="pos"]');
            if (typeof router !== 'undefined') {
                router.navigate('pos', posTab);
            } else if (typeof posModule !== 'undefined') {
                posModule.init();
            }
        } else if (kasirStatus.reason === 'new_day_same_user' || kasirStatus.reason === 'new_shift') {
            this.showOpenKasirModal();
        } else {
            // Kasir tutup - tampilkan halaman kasir tutup dan BLOKIR SEMUA MENU
            this.showKasirClosedPage();
        }
    },

    // Load config dari cloud jika tersedia
    async loadCloudConfigIfAvailable() {
        console.log('[App] Checking for cloud config...');
        
        const localProvider = localStorage.getItem('hifzi_provider') || 'local';
        
        if (localProvider !== 'local') {
            console.log('[App] Local cloud config exists, skipping auto-load');
            this.isCloudConfigLoaded = true;
            return;
        }
        
        try {
            const savedFBConfig = localStorage.getItem('hifzi_firebase_config');
            if (savedFBConfig) {
                const fbConfig = JSON.parse(savedFBConfig);
                if (fbConfig.apiKey) {
                    console.log('[App] Found Firebase config, initializing...');
                    backupModule.firebaseConfig = fbConfig;
                    backupModule.initFirebase(true);
                    
                    setTimeout(async () => {
                        if (backupModule.currentUser) {
                            const configUpdated = await backupModule.loadConfigFromCloud();
                            if (configUpdated) {
                                this.showToast('✅ Konfigurasi cloud dimuat!');
                                location.reload();
                            }
                        }
                    }, 3000);
                }
            }
            
            const savedGASUrl = localStorage.getItem('hifzi_gas_url');
            const savedSheetId = localStorage.getItem('hifzi_sheet_id');
            if (savedGASUrl && savedSheetId) {
                console.log('[App] Found GAS config locally');
                this.isCloudConfigLoaded = true;
                return;
            }
            
            console.log('[App] No cloud config found, user needs to setup manually');
            
        } catch (err) {
            console.error('[App] Error loading cloud config:', err);
        }
        
        this.isCloudConfigLoaded = true;
    },

    showOpenKasirModal() {
        // Hapus modal lama jika ada
        const existingModal = document.getElementById('openKasirModal');
        if (existingModal) existingModal.remove();
        
        const modalHTML = `
            <div class="modal active" id="openKasirModal" style="display: flex; z-index: 3500; align-items: flex-start; padding-top: 100px;">
                <div class="modal-content" style="max-width: 350px; text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 15px;">🏪</div>
                    <div class="modal-header" style="justify-content: center;">
                        <span class="modal-title" style="font-size: 16px;">Buka Kasir</span>
                    </div>
                    <p style="color: #666; margin: 15px 0; line-height: 1.6; font-size: 14px;">
                        Hai <b>${this.currentUser.name}</b>!<br><br>
                        Anda belum membuka kasir hari ini.<br>
                        Silakan buka kasir untuk memulai shift.
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

    confirmOpenKasir(forceReset) {
        const modals = ['openKasirModal', 'newDayModal'];
        modals.forEach(id => {
            const modal = document.getElementById(id);
            if (modal) modal.remove();
        });

        const result = dataManager.openKasir(this.currentUser.userId, forceReset);
        
        if (result.success) {
            this.updateHeader();
            this.updateKasirStatus();
            this.showToast(result.message);
            
            // PERBAIKAN: Unblock navigation setelah kasir dibuka
            this.unblockNavigation();
            
            // PERBAIKAN: Gunakan router.navigate untuk konsistensi
            const posTab = document.querySelector('.nav-tab[data-page="pos"]');
            if (typeof router !== 'undefined') {
                router.navigate('pos', posTab);
            } else if (typeof posModule !== 'undefined') {
                posModule.init();
                const cartBar = document.getElementById('cartBar');
                if (cartBar) cartBar.style.display = 'flex';
            }
        }
    },

    closeKasir() {
        if (!confirm('🚪 Yakin ingin menutup kasir?\n\nSemua transaksi Anda hari ini akan disimpan.\nAnda perlu login ulang untuk membuka kasir lagi.')) {
            return;
        }

        const result = dataManager.closeKasir(this.currentUser.userId);
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
            dataManager.logout();
        }
        
        localStorage.removeItem('hifzi_current_user');
        
        this.currentUser = null;
        location.reload();
    },

    // PERBAIKAN: Update header dengan TOTAL GLOBAL
    updateHeader() {
        if (!this.data) return;
        
        const headerStoreName = document.getElementById('headerStoreName');
        const headerStoreAddress = document.getElementById('headerStoreAddress');
        
        if (headerStoreName) headerStoreName.textContent = this.data.settings.storeName || 'HIFZI CELL';
        if (headerStoreAddress) headerStoreAddress.textContent = this.data.settings.address || 'Alamat Belum Diatur';
        
        const globalCash = this.calculateGlobalCash();
        const currentCash = globalCash.cash;
        const modalAwal = globalCash.modal;
        
        const todayStats = this.calculateTodayGlobalStats();
        const todayProfit = todayStats.totalProfit;
        const transactionCount = todayStats.transactionCount;
        
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
        
        updateWithHighlight(currentCashEl, currentCash, 'Rp ');
        updateWithHighlight(modalAwalEl, modalAwal, 'Rp ');
        updateWithHighlight(headerProfitEl, todayProfit, 'Rp ');
        updateWithHighlight(transCountEl, transactionCount, '');
        
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

    calculateGlobalCash() {
        const activeShifts = dataManager.getActiveShifts();
        let totalCash = 0;
        let totalModal = 0;
        
        activeShifts.forEach(shift => {
            const shiftCash = dataManager.calculateShiftCash(shift.userId, shift.modalAwal);
            totalCash += shiftCash;
            totalModal += parseInt(shift.modalAwal) || 0;
        });
        
        const settingsModal = parseInt(this.data.settings?.modalAwal) || 0;
        const settingsCash = parseInt(this.data.settings?.currentCash) || 0;
        
        const currentUser = dataManager.getCurrentUser();
        if (currentUser && (currentUser.role === 'owner' || currentUser.role === 'admin')) {
            const ownerShift = activeShifts.find(s => s.userId === currentUser.userId);
            if (!ownerShift) {
                totalModal += settingsModal;
                totalCash += settingsCash;
            }
        }
        
        return {
            cash: totalCash,
            modal: totalModal
        };
    },

    calculateTodayGlobalStats() {
        const today = new Date().toDateString();
        
        const todayPosTrans = this.data.transactions.filter(t => {
            const tDate = new Date(t.date).toDateString();
            return tDate === today && t.status !== 'voided' && t.status !== 'deleted';
        });
        
        const posSales = todayPosTrans.reduce((sum, t) => sum + (parseInt(t.total) || 0), 0);
        const posProfit = todayPosTrans.reduce((sum, t) => sum + (parseInt(t.profit) || 0), 0);
        const posCount = todayPosTrans.length;
        
        const todayCashTrans = this.data.cashTransactions.filter(t => {
            const tDate = new Date(t.date).toDateString();
            return tDate === today;
        });
        
        const topUpProfit = todayCashTrans
            .filter(t => t.type === 'topup')
            .reduce((sum, t) => sum + (parseInt(t.details?.adminFee) || 0), 0);
        
        const tarikTunaiProfit = todayCashTrans
            .filter(t => t.category === 'tarik_tunai')
            .reduce((sum, t) => sum + (parseInt(t.details?.adminFee) || 0), 0);
        
        const cashProfit = topUpProfit + tarikTunaiProfit;
        
        return {
            totalSales: posSales,
            totalProfit: posProfit + cashProfit,
            transactionCount: posCount,
            posProfit: posProfit,
            cashProfit: cashProfit,
            topUpProfit: topUpProfit,
            tarikTunaiProfit: tarikTunaiProfit
        };
    },

    updateKasirButton() {
        const kasirBtn = document.getElementById('kasirToggleBtn');
        if (!kasirBtn || !this.currentUser) return;

        const userShift = dataManager.getUserShift(this.currentUser.userId);
        const hasActiveShift = !!userShift;

        kasirBtn.style.display = 'block';

        if (hasActiveShift) {
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
        
        const userShift = this.currentUser ? dataManager.getUserShift(this.currentUser.userId) : null;
        const hasActiveShift = !!userShift;
        const activeShifts = dataManager.getActiveShifts();
        
        const dot = document.getElementById('kasirStatusDot');
        const text = document.getElementById('kasirStatusText');
        const shiftStatus = document.getElementById('shiftStatus');
        const indicator = document.getElementById('kasirStatusIndicator');

        if (hasActiveShift) {
            if (dot) dot.style.background = '#00b894';
            if (text) text.textContent = `🔓 Kasir Buka (${activeShifts.length} user)`;
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

    // ==========================================
    // TAMBAHAN BARU: Halaman Kasir Tutup yang memblokir semua akses menu
    // ==========================================
    showKasirClosedPage() {
        const container = document.getElementById('mainContent');
        if (!container) return;

        const activeShifts = dataManager.getActiveShifts();
        const otherUsersActive = activeShifts.filter(s => s.userId !== this.currentUser.userId);

        // Render halaman kasir tutup
        container.innerHTML = `
            <div class="content-section active" style="text-align: center; padding: 40px 20px;">
                <div style="font-size: 64px; margin-bottom: 15px;">🔒</div>
                <h2 style="color: #c62828; margin-bottom: 15px; font-size: 20px;">Kasir Anda Sedang Tutup</h2>
                <p style="color: #666; margin-bottom: 30px; line-height: 1.6; font-size: 14px;">
                    Selamat datang, <b>${this.currentUser ? this.currentUser.name : ''}</b>!<br>
                    Silakan buka kasir untuk mengakses semua menu.
                </p>

                ${otherUsersActive.length > 0 ? `
                <div style="background: #e3f2fd; border: 2px solid #2196f3; border-radius: 16px; padding: 15px; max-width: 350px; margin: 0 auto 20px;">
                    <div style="font-size: 13px; color: #1565c0; font-weight: 600; margin-bottom: 8px;">
                        👥 User Aktif Saat Ini:
                    </div>
                    ${otherUsersActive.map(s => `
                        <div style="font-size: 12px; color: #555; padding: 4px 0;">
                            • ${s.userName} (${s.userRole})
                        </div>
                    `).join('')}
                </div>
                ` : ''}

                <div style="background: #e8f5e9; border: 2px solid #4caf50; border-radius: 16px; padding: 20px; max-width: 350px; margin: 0 auto 20px;">
                    <div style="font-size: 13px; color: #666; margin-bottom: 10px;">
                        📅 Hari ini: ${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                    <div style="font-size: 12px; color: #888;">
                        ${activeShifts.length > 0 ? `${activeShifts.length} user sedang aktif` : 'Belum ada shift hari ini'}
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

        // ==========================================
        // PERBAIKAN BARU: Blokir navigasi SETELAH render selesai dengan delay
        // ==========================================
        setTimeout(() => {
            this.blockAllNavigation();
        }, 100);
    },

    // ==========================================
    // TAMBAHAN BARU: Method untuk memblokir semua navigasi saat kasir tutup
    // ==========================================
    blockAllNavigation() {
        console.log('[App] Blocking all navigation - Kasir is closed');
        
        const navTabs = document.querySelectorAll('.nav-tab');
        
        navTabs.forEach(tab => {
            // Hapus semua event listener lama dengan clone
            const newTab = tab.cloneNode(true);
            tab.parentNode.replaceChild(newTab, tab);
            
            // Tambahkan event listener blocker
            newTab.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[App] Navigation blocked - Kasir closed');
                this.showKasirRequiredModal();
                return false;
            });
            
            // Visual indicator menu disabled
            newTab.style.opacity = '0.5';
            newTab.style.cursor = 'not-allowed';
            newTab.classList.remove('active');
        });
        
        // Blokir juga tombol settings
        const settingsBtn = document.querySelector('.icon-btn[onclick*="openSettings"]');
        if (settingsBtn) {
            const newBtn = settingsBtn.cloneNode(true);
            settingsBtn.parentNode.replaceChild(newBtn, settingsBtn);
            
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.showKasirRequiredModal();
                return false;
            });
            
            newBtn.style.opacity = '0.5';
            newBtn.style.cursor = 'not-allowed';
        }
    },

    // ==========================================
    // TAMBAHAN BARU: Modal yang muncul saat user mencoba akses menu tanpa buka kasir
    // ==========================================
    showKasirRequiredModal() {
        // Hapus modal lama jika ada
        const existingModal = document.getElementById('kasirRequiredModal');
        if (existingModal) existingModal.remove();
        
        const modalHTML = `
            <div class="modal active" id="kasirRequiredModal" style="display: flex; z-index: 3500; align-items: flex-start; padding-top: 100px;">
                <div class="modal-content" style="max-width: 350px; text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 15px;">🔒</div>
                    <div class="modal-header" style="justify-content: center;">
                        <span class="modal-title" style="font-size: 16px;">Akses Ditolak</span>
                    </div>
                    <p style="color: #666; margin: 15px 0; line-height: 1.6; font-size: 14px;">
                        Anda harus membuka kasir terlebih dahulu<br>
                        untuk mengakses menu ini.
                    </p>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <button class="btn btn-secondary" onclick="document.getElementById('kasirRequiredModal').remove()">Batal</button>
                        <button class="btn btn-primary" onclick="document.getElementById('kasirRequiredModal').remove(); app.confirmOpenKasir(true)" style="background: #4caf50;">
                            🔓 Buka Kasir
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    // ==========================================
    // TAMBAHAN BARU: Unblock navigation setelah kasir dibuka
    // ==========================================
    unblockNavigation() {
        console.log('[App] Unblocking navigation - Kasir is now open');
        
        // Re-render navigation dengan router (akan menghapus blocker listeners)
        if (typeof router !== 'undefined') {
            router.renderNavigation();
        }
        
        // Restore settings button
        const settingsBtn = document.querySelector('.icon-btn');
        if (settingsBtn) {
            const newBtn = settingsBtn.cloneNode(true);
            settingsBtn.parentNode.replaceChild(newBtn, settingsBtn);
            
            newBtn.addEventListener('click', () => {
                this.openSettings();
            });
            
            newBtn.style.opacity = '1';
            newBtn.style.cursor = 'pointer';
        }
    },

    // Method untuk saveAllModalKasir dengan sync pendingModals
    saveAllModalKasir(modalAwal, extraModal = 0) {
        if (!this.currentUser) return;
        
        const result = dataManager.saveAllModalKasir(this.currentUser.userId, modalAwal, extraModal);
        
        if (result.success) {
            this.showToast(result.message);
            this.updateHeader();
            
            // PERBAIKAN: Sync ke cloud jika auto sync aktif
            if (typeof backupModule !== 'undefined' && backupModule.isAutoSyncEnabled) {
                setTimeout(() => backupModule.syncToCloud(true), 1000);
            }
        } else {
            this.showToast('❌ ' + result.message);
        }
        
        return result;
    },

    openSettings() {
        // ==========================================
        // TAMBAHAN BARU: Cek kasir status sebelum buka settings
        // ==========================================
        if (this.currentUser) {
            const kasirStatus = dataManager.checkKasirStatusForUser(this.currentUser.userId);
            if (kasirStatus.canOpen && !kasirStatus.isContinue) {
                this.showKasirRequiredModal();
                return;
            }
        }
        // ==========================================

        const existingModal = document.getElementById('settingsModal');
        if (existingModal) existingModal.remove();

        // Check if dark mode module is available
        const hasDarkMode = typeof darkModeModule !== 'undefined';
        const isDark = hasDarkMode ? darkModeModule.isDark : false;

        // Generate Dark Mode section if available
        let darkModeSection = '';
        if (hasDarkMode) {
            const icon = isDark ? '🌙' : '☀️';
            const title = isDark ? 'Mode Gelap' : 'Mode Terang';
            const description = isDark ? 'Lebih nyaman di malam hari' : 'Tampilan default terang';
            const toggleBg = isDark ? '#6366f1' : '#d1d5db';
            const knobLeft = isDark ? '26px' : '2px';
            const cardBg = isDark ? '#374151' : '#f3f4f6';
            const cardBorder = isDark ? '#4b5563' : '#e5e7eb';
            const tipsBg = isDark ? 'rgba(99, 102, 241, 0.1)' : '#eff6ff';

            darkModeSection = `
                <div class="settings-section darkmode-settings" style="margin-bottom: 20px;">
                    <h3 style="font-size: 16px; margin-bottom: 15px; display: flex; align-items: center; gap: 8px; color: var(--dark);">
                        🎨 Tampilan
                    </h3>
                    
                    <div class="theme-toggle-card" onclick="darkModeModule.toggle()" style="
                        background: ${cardBg};
                        border-radius: 16px;
                        padding: 20px;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        cursor: pointer;
                        transition: all 0.3s;
                        border: 2px solid ${cardBorder};
                        user-select: none;
                    ">
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <div style="
                                width: 48px;
                                height: 48px;
                                border-radius: 12px;
                                background: ${isDark ? 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)' : 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)'};
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                font-size: 24px;
                                transition: all 0.3s;
                            ">
                                ${icon}
                            </div>
                            <div>
                                <div style="font-weight: 600; font-size: 16px; color: var(--dark);">
                                    ${title}
                                </div>
                                <div style="font-size: 13px; opacity: 0.7; margin-top: 2px; color: var(--dark);">
                                    ${description}
                                </div>
                            </div>
                        </div>
                        
                        <div class="toggle-switch" style="
                            width: 52px;
                            height: 28px;
                            background: ${toggleBg};
                            border-radius: 14px;
                            position: relative;
                            transition: all 0.3s;
                            flex-shrink: 0;
                        ">
                            <div style="
                                width: 24px;
                                height: 24px;
                                background: white;
                                border-radius: 50%;
                                position: absolute;
                                top: 2px;
                                left: ${knobLeft};
                                transition: all 0.3s;
                                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                            "></div>
                        </div>
                    </div>
                    
                    <div style="
                        margin-top: 12px;
                        padding: 12px;
                        background: ${tipsBg};
                        border-radius: 10px;
                        border-left: 3px solid var(--primary);
                    ">
                        <div style="font-size: 12px; color: var(--primary); font-weight: 600; margin-bottom: 4px;">
                            💡 Tips
                        </div>
                        <div style="font-size: 12px; opacity: 0.8; line-height: 1.5; color: var(--dark);">
                            Mode gelap mengurangi kelelahan mata dan menghemat baterai pada layar OLED.
                        </div>
                    </div>
                    
                    ${localStorage.getItem('hifzi_darkmode') !== null ? `
                    <div style="margin-top: 10px; text-align: center;">
                        <button onclick="event.stopPropagation(); darkModeModule.reset(); app.closeSettings(); setTimeout(() => app.openSettings(), 100);" 
                                style="font-size: 12px; color: var(--primary); background: none; border: none; cursor: pointer; text-decoration: underline;">
                            Reset ke default sistem
                        </button>
                    </div>
                    ` : ''}
                </div>
                
                <hr style="border: none; border-top: 1px solid ${isDark ? '#374151' : '#eee'}; margin: 15px 0;">
            `;
        }

        const borderColor = isDark ? '#374151' : '#eee';
        const inputBorder = isDark ? '#4b5563' : '#e0e0e0';
        const dangerBg = isDark ? 'rgba(248, 113, 113, 0.1)' : '#ffebee';
        const dangerBorder = isDark ? 'rgba(248, 113, 113, 0.3)' : '#ef5350';
        const exportBg = isDark ? 'rgba(96, 165, 250, 0.1)' : '#e3f2fd';
        const exportBorder = isDark ? 'rgba(96, 165, 250, 0.3)' : '#42a5f5';
        const cancelBg = isDark ? '#374151' : '#f5f5f5';

        const modalHTML = `
            <div class="modal active" id="settingsModal" style="display: flex; z-index: 4000; align-items: flex-start; padding-top: 80px;">
                <div class="modal-content" style="max-width: 380px; width: 90%; max-height: 80vh; overflow-y: auto; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
                    <div class="modal-header" style="padding: 15px 20px; border-bottom: 1px solid ${borderColor};">
                        <span class="modal-title" style="font-size: 16px; font-weight: 600; color: var(--dark);">⚙️ Pengaturan Toko</span>
                        <button onclick="app.closeSettings()" style="background: none; border: none; font-size: 20px; cursor: pointer; color: var(--dark); width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 50%;">×</button>
                    </div>
                    
                    <div style="padding: 20px;">
                        ${darkModeSection}
                        
                        <div style="margin-bottom: 15px;">
                            <label style="display: block; font-weight: 600; margin-bottom: 6px; font-size: 13px; color: var(--dark);">Nama Toko</label>
                            <input type="text" id="settingStoreName" 
                                   value="${this.data.settings.storeName || 'Hifzi Cell'}" 
                                   style="width: 100%; padding: 10px 12px; border: 2px solid ${inputBorder}; border-radius: 8px; font-size: 14px; box-sizing: border-box; background: var(--white); color: var(--dark);">
                        </div>
                        
                        <div style="margin-bottom: 15px;">
                            <label style="display: block; font-weight: 600; margin-bottom: 6px; font-size: 13px; color: var(--dark);">Alamat Toko</label>
                            <textarea id="settingStoreAddress" 
                                      style="width: 100%; padding: 10px 12px; border: 2px solid ${inputBorder}; border-radius: 8px; min-height: 50px; resize: vertical; font-size: 14px; box-sizing: border-box; font-family: inherit; background: var(--white); color: var(--dark);">${this.data.settings.address || ''}</textarea>
                        </div>
                        
                        <div style="margin-bottom: 15px;">
                            <label style="display: block; font-weight: 600; margin-bottom: 6px; font-size: 13px; color: var(--dark);">Nomor Telepon</label>
                            <input type="text" id="settingStorePhone" 
                                   value="${this.data.settings.phone || ''}" 
                                   style="width: 100%; padding: 10px 12px; border: 2px solid ${inputBorder}; border-radius: 8px; font-size: 14px; box-sizing: border-box; background: var(--white); color: var(--dark);">
                        </div>

                        <div style="margin-bottom: 20px;">
                            <label style="display: block; font-weight: 600; margin-bottom: 6px; font-size: 13px; color: var(--dark);">Pajak Default (%)</label>
                            <input type="number" id="settingTax" 
                                   value="${this.data.settings.tax || 0}" 
                                   style="width: 100%; padding: 10px 12px; border: 2px solid ${inputBorder}; border-radius: 8px; font-size: 14px; box-sizing: border-box; background: var(--white); color: var(--dark);">
                        </div>
                        
                        <hr style="border: none; border-top: 1px solid ${borderColor}; margin: 15px 0;">
                        
                        <div style="margin-bottom: 10px;">
                            <label style="display: block; font-weight: 600; margin-bottom: 10px; color: var(--danger); font-size: 13px;">⚠️ Zona Berbahaya</label>
                            <div style="display: grid; gap: 8px;">
                                <button onclick="app.confirmResetData()" 
                                        style="padding: 10px; background: ${dangerBg}; color: #f87171; border: 1px solid ${dangerBorder}; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 500;">
                                    🗑️ Reset Semua Data
                                </button>
                                <button onclick="app.exportData()" 
                                        style="padding: 10px; background: ${exportBg}; color: #60a5fa; border: 1px solid ${exportBorder}; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 500;">
                                    💾 Export Data (JSON)
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 10px; justify-content: flex-end; padding: 0 20px 20px;">
                        <button onclick="app.closeSettings()" 
                                style="padding: 10px 20px; background: ${cancelBg}; border: none; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 500; color: var(--dark);">Batal</button>
                        <button onclick="app.saveSettings()" 
                                style="padding: 10px 20px; background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600;">Simpan Perubahan</button>
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

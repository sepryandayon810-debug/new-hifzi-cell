/**
 * Router System - Hifzi Cell POS
 * Menangani navigasi dan kontrol akses antar modul - Multi-User Edition
 */

const router = {
    currentPage: null,

    // ✅ PERUBAHAN: Semua menu bisa diakses tanpa batasan kasir terbuka
    // Hanya butuh konfirmasi buka kasir untuk menu operasional jika belum buka
    requiresKasirOpen: [], // Kosongkan - tidak ada blocking

    // Definisi akses menu berdasarkan role tetap sama
    menuAccess: {
        'owner': ['pos', 'products', 'cash', 'reports', 'transactions', 'receipt', 'debt', 'users', 'telegram', 'cloud', 'pencarian'],
        'admin': ['pos', 'products', 'cash', 'reports', 'transactions', 'receipt', 'debt', 'users', 'telegram', 'cloud', 'pencarian'],
        'kasir': ['pos', 'products', 'transactions', 'pencarian']
    },

    // Definisi label menu untuk pesan error
    menuLabels: {
        'pos': 'Kasir',
        'products': 'Produk',
        'cash': 'Kas',
        'reports': 'Laporan',
        'transactions': 'Transaksi',
        'receipt': 'Struk',
        'debt': 'Hutang',
        'users': 'Users',
        'telegram': 'Telegram',
        'cloud': 'Cloud',
        'backup': 'Backup',
        'pencarian': 'Pencarian'
    },

    // Cek apakah module tersedia
    isModuleAvailable(moduleName) {
        const modules = {
            'pos': typeof posModule !== 'undefined',
            'products': typeof productsModule !== 'undefined',
            'cash': typeof cashModule !== 'undefined',
            'reports': typeof reportsModule !== 'undefined',
            'transactions': typeof transactionsModule !== 'undefined',
            'receipt': typeof receiptModule !== 'undefined',
            'debt': typeof debtModule !== 'undefined',
            'users': typeof usersModule !== 'undefined',
            'telegram': typeof TelegramModule !== 'undefined',
            'cloud': typeof backupModule !== 'undefined',
            'backup': typeof backupModule !== 'undefined',
            'pencarian': typeof n8nModule !== 'undefined'
        };
        return modules[moduleName] || false;
    },

    /**
     * Navigasi ke halaman tertentu
     * @param {string} page - Nama halaman tujuan
     * @param {HTMLElement} element - Element yang diklik (untuk styling)
     */
    navigate(page, element) {
        console.log(`[Router] Navigating to: ${page}`);

        const currentUser = dataManager.getCurrentUser();

        // Cek apakah user sudah login
        if (!currentUser) {
            app.showToast('❌ Silakan login terlebih dahulu!');
            return;
        }

        // Cek akses berdasarkan role user
        const userRole = currentUser.role;
        const allowedMenus = this.menuAccess[userRole] || [];

        if (!allowedMenus.includes(page)) {
            this.showAccessDeniedModal(userRole, page);
            return;
        }

        // ✅ PERUBAHAN: Tidak ada blocking kasir, tapi tanya untuk buka kasir jika belum
        // untuk menu operasional (POS, Cash, Debt)
        const operationalMenus = ['pos', 'cash', 'debt'];
        const userShift = dataManager.getUserShift(currentUser.userId);
        
        if (operationalMenus.includes(page) && !userShift) {
            // Tanya user apakah mau buka kasir dulu
            this.showOpenKasirFirstModal(page, element);
            return;
        }

        // Update UI - Hapus active dari semua tab
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        if (element) element.classList.add('active');

        // Sembunyikan cart bar (akan ditampilkan lagi jika di POS)
        const cartBar = document.getElementById('cartBar');
        if (cartBar) cartBar.style.display = 'none';

        this.currentPage = page;

        // Cek module tersedia sebelum dipanggil
        if (!this.isModuleAvailable(page)) {
            console.warn(`[Router] Module ${page} not available`);
            this.showModuleErrorModal(page);
            return;
        }

        // Panggil module yang sesuai
        try {
            switch(page) {
                case 'pos':
                    posModule.init();
                    if (cartBar) cartBar.style.display = 'flex';
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
                case 'debt':
                    debtModule.init();
                    break;
                case 'users':
                    usersModule.init();
                    break;
                case 'telegram':
                    if (typeof TelegramModule !== 'undefined') {
                        TelegramModule.init();
                        TelegramModule.renderPage();
                    }
                    break;
                case 'pencarian':
                    if (typeof n8nModule !== 'undefined') {
                        n8nModule.init();
                        n8nModule.renderPage();
                    }
                    break;
                case 'cloud':
                case 'backup':
                    if (typeof backupModule !== 'undefined') {
                        backupModule.init();
                        setTimeout(() => {
                            backupModule.render();
                        }, 50);
                    } else {
                        throw new Error('Backup module not found');
                    }
                    break;
                default:
                    console.error(`[Router] Unknown page: ${page}`);
                    app.showToast('❌ Halaman tidak ditemukan!');
            }
        } catch (error) {
            console.error(`[Router] Error initializing ${page}:`, error);
            app.showToast(`❌ Error membuka menu ${this.menuLabels[page] || page}`);
        }

        window.scrollTo(0, 0);
    },

    // ✅ BARU: Modal untuk buka kasir terlebih dahulu
    showOpenKasirFirstModal(page, element) {
        const pageName = this.menuLabels[page] || page;
        
        const modalHTML = `
            <div class="modal active" id="openKasirFirstModal" style="display: flex; z-index: 3500; align-items: flex-start; padding-top: 100px;">
                <div class="modal-content" style="max-width: 380px; text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 15px;">🔒</div>
                    <div class="modal-header" style="justify-content: center;">
                        <span class="modal-title" style="font-size: 16px;">Buka Kasir Terlebih Dahulu</span>
                    </div>
                    <p style="color: #666; margin: 15px 0; line-height: 1.6; font-size: 14px;">
                        Untuk mengakses menu <b>${pageName}</b>,<br>
                        Anda perlu membuka kasir terlebih dahulu.
                    </p>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <button class="btn btn-secondary" onclick="document.getElementById('openKasirFirstModal').remove()">Batal</button>
                        <button class="btn btn-primary" onclick="router.openKasirAndNavigate('${page}')" style="background: #4caf50;">
                            🔓 Buka Kasir
                        </button>
                    </div>
                </div>
            </div>
        `;
        this.removeExistingModal('openKasirFirstModal');
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    // ✅ BARU: Buka kasir lalu navigasi
    openKasirAndNavigate(page) {
        const modal = document.getElementById('openKasirFirstModal');
        if (modal) modal.remove();
        
        const result = dataManager.openKasir(app.currentUser.userId, true);
        if (result.success) {
            app.showToast(result.message);
            app.updateHeader();
            app.updateKasirStatus();
            
            // Navigasi ke halaman yang diminta
            const navTab = document.querySelector(`.nav-tab[data-page="${page}"]`);
            this.navigate(page, navTab);
        }
    },

    /**
     * Cek apakah user memiliki akses ke menu tertentu
     */
    hasAccess(page) {
        const currentUser = dataManager.getCurrentUser();
        if (!currentUser) return false;

        const allowedMenus = this.menuAccess[currentUser.role] || [];
        return allowedMenus.includes(page);
    },

    /**
     * Dapatkan daftar menu yang boleh diakses user saat ini
     */
    getAllowedMenus() {
        const currentUser = dataManager.getCurrentUser();
        if (!currentUser) return [];
        return this.menuAccess[currentUser.role] || [];
    },

    showAccessDeniedModal(userRole, page) {
        const menuName = this.menuLabels[page] || page;
        const allowedMenus = this.menuAccess[userRole] || [];

        const allowedMenuList = allowedMenus
            .map(m => `• ${this.menuLabels[m] || m}`)
            .join('<br>');

        const modalHTML = `
            <div class="modal active" id="accessDeniedModal" style="display: flex; z-index: 3000; align-items: flex-start; padding-top: 100px;">
                <div class="modal-content" style="max-width: 400px; text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 15px;">🚫</div>
                    <div class="modal-header" style="justify-content: center; margin-bottom: 10px;">
                        <span class="modal-title" style="font-size: 18px;">Akses Ditolak</span>
                    </div>
                    <div style="background: #ffebee; border: 2px solid #f44336; border-radius: 12px; padding: 15px; margin-bottom: 20px;">
                        <div style="color: #c62828; font-weight: 600; margin-bottom: 8px; font-size: 14px;">
                            ❌ Anda tidak memiliki akses ke menu ini
                        </div>
                        <div style="font-size: 13px; color: #666; line-height: 1.5;">
                            Menu <strong>${menuName}</strong> hanya dapat diakses oleh role tertentu.
                        </div>
                    </div>

                    <div style="background: #e3f2fd; border: 1px solid #90caf9; border-radius: 10px; padding: 15px; margin-bottom: 20px; text-align: left;">
                        <div style="font-size: 12px; color: #1565c0; font-weight: 600; margin-bottom: 8px;">
                            📋 Menu yang dapat Anda akses:
                        </div>
                        <div style="font-size: 12px; color: #555; line-height: 1.8;">
                            ${allowedMenuList}
                        </div>
                    </div>

                    <button class="btn btn-primary" onclick="router.closeAccessDeniedModal()" style="padding: 10px 30px;">
                        Mengerti
                    </button>
                </div>
            </div>
        `;
        this.removeExistingModal('accessDeniedModal');
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    closeAccessDeniedModal() {
        const modal = document.getElementById('accessDeniedModal');
        if (modal) modal.remove();
    },

    /**
     * Modal error jika module tidak tersedia
     */
    showModuleErrorModal(page) {
        const menuName = this.menuLabels[page] || page;
        const suggestions = {
            'telegram': 'Pastikan file telegram.js ada di folder js/',
            'cloud': 'Pastikan file backup.js ada di folder js/',
            'backup': 'Pastikan file backup.js ada di folder js/',
            'pencarian': 'Pastikan file n8n.js ada di folder js/ dan sudah di-load di index.html'
        };

        const modalHTML = `
            <div class="modal active" id="moduleErrorModal" style="display: flex; z-index: 3500; align-items: flex-start; padding-top: 100px;">
                <div class="modal-content" style="max-width: 380px; text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 15px;">⚙️</div>
                    <div class="modal-header" style="justify-content: center;">
                        <span class="modal-title" style="font-size: 16px;">Module Belum Siap</span>
                    </div>
                    <p style="color: #666; margin: 15px 0; line-height: 1.6; font-size: 14px;">
                        Menu <b>${menuName}</b> sedang dalam pengembangan atau terjadi error loading.
                    </p>
                    ${suggestions[page] ? `
                    <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 12px; margin-bottom: 15px; font-size: 12px; color: #856404;">
                        💡 ${suggestions[page]}
                    </div>
                    ` : ''}
                    <button class="btn btn-secondary" onclick="router.closeModuleErrorModal()" style="width: 100%;">Tutup</button>
                </div>
            </div>
        `;
        this.removeExistingModal('moduleErrorModal');
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    closeModuleErrorModal() {
        const modal = document.getElementById('moduleErrorModal');
        if (modal) modal.remove();
    },

    removeExistingModal(id) {
        const existing = document.getElementById(id);
        if (existing) existing.remove();
    },

    /**
     * Render navigation tabs berdasarkan role user
     */
    renderNavigation() {
        const currentUser = dataManager.getCurrentUser();
        if (!currentUser) {
            console.log('[Router] No user logged in, skipping navigation render');
            return;
        }

        const allowedMenus = this.menuAccess[currentUser.role] || [];
        const navContainer = document.getElementById('navTabs');

        if (!navContainer) {
            console.error('[Router] navTabs container not found!');
            return;
        }

        const menuIcons = {
            'pos': '🛒',
            'products': '📦',
            'cash': '💰',
            'reports': '📊',
            'transactions': '📋',
            'receipt': '🧾',
            'debt': '💳',
            'users': '👥',
            'telegram': '✈️',
            'cloud': '☁️',
            'backup': '💾',
            'pencarian': '🔍'
        };

        let navHTML = '';
        allowedMenus.forEach(menu => {
            const icon = menuIcons[menu] || '📄';
            const label = this.menuLabels[menu] || menu;
            navHTML += `
                <button class="nav-tab" onclick="router.navigate('${menu}', this)" data-page="${menu}">
                    <span class="nav-icon">${icon}</span>
                    <span class="nav-label">${label}</span>
                </button>
            `;
        });

        navContainer.innerHTML = navHTML;
        console.log(`[Router] Navigation rendered for role: ${currentUser.role}`);
    },

    /**
     * Refresh navigation setelah login/logout
     */
    refreshNavigation() {
        this.renderNavigation();
    },

    /**
     * Navigate to page programmatically (tanpa click element)
     */
    goTo(page) {
        const navTab = document.querySelector(`.nav-tab[data-page="${page}"]`);
        this.navigate(page, navTab);
    },

    /**
     * Check if current page is active
     */
    isCurrentPage(page) {
        return this.currentPage === page;
    },

    /**
     * Get current active page
     */
    getCurrentPage() {
        return this.currentPage;
    }
};

// Expose ke window
window.router = router;

console.log('[Router] Router system loaded v2.0 - Multi-User Edition');

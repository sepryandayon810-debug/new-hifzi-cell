/**
 * Router System - Hifzi Cell POS
 * Menangani navigasi dan kontrol akses antar modul
 */

const router = {
    currentPage: null,

    // Menu yang bisa diakses saat kasir TUTUP (tanpa membuka kasir baru)
    allowedWhenClosed: ['backup', 'users', 'reports', 'transactions', 'receipt', 'cloud', 'telegram', 'n8n', 'pencarian'],

    // Menu yang butuh kasir BUKA
    requiresKasirOpen: ['pos', 'products', 'cash', 'debt'],

    // Definisi akses menu berdasarkan role
    menuAccess: {
        'owner': ['pos', 'products', 'cash', 'reports', 'transactions', 'receipt', 'debt', 'users', 'telegram', 'cloud', 'n8n', 'pencarian'],
        'admin': ['pos', 'products', 'cash', 'reports', 'transactions', 'receipt', 'debt', 'users', 'telegram', 'cloud', 'n8n', 'pencarian'],
        'kasir': ['pos', 'products', 'transactions', 'n8n', 'pencarian']
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
        'n8n': 'Pencarian',
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
            'n8n': typeof n8nModule !== 'undefined',
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

        const isKasirOpen = app.data && app.data.kasir && app.data.kasir.isOpen;
        const currentUser = dataManager.getCurrentUser();
        const kasirCurrentUser = app.data && app.data.kasir ? app.data.kasir.currentUser : null;

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

        // Cek apakah kasir sudah dibuka untuk menu yang memerlukannya
        if (!isKasirOpen && this.requiresKasirOpen.includes(page)) {
            this.showKasirClosedModal();
            return;
        }

        // Cek apakah user saat ini adalah yang membuka kasir (untuk menu operasional)
        if (isKasirOpen && this.requiresKasirOpen.includes(page)) {
            // Owner dan Admin bisa override (mengambil alih kasir)
            if (currentUser.role === 'owner' || currentUser.role === 'admin') {
                if (kasirCurrentUser !== currentUser.userId) {
                    // Tanya apakah ingin mengambil alih kasir
                    this.showTakeOverKasirModal(kasirCurrentUser, page, element);
                    return;
                }
            } else {
                // Kasir biasa hanya bisa akses jika dia yang buka
                if (kasirCurrentUser !== currentUser.userId) {
                    this.showKasirUsedByOtherModal(kasirCurrentUser);
                    return;
                }
            }
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
                    // PERBAIKAN: Inisialisasi dan render TelegramModule
                    if (typeof TelegramModule !== 'undefined') {
                        TelegramModule.init();
                        TelegramModule.renderPage();
                    }
                    break;
                case 'n8n':
                case 'pencarian':
                    // PERBAIKAN: Inisialisasi dan render n8nModule
                    if (typeof n8nModule !== 'undefined') {
                        n8nModule.init();
                        n8nModule.renderPage();
                    }
                    break;
                case 'cloud':
                case 'backup':
                    backupModule.init();
                    backupModule.render();  // ✅ TAMBAHAN: Render UI backup module
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

    /**
     * Owner/Admin mengambil alih kasir
     */
    takeOverKasir(page, element) {
        const currentUser = dataManager.getCurrentUser();

        if (!app.data.kasir) {
            app.data.kasir = {};
        }

        app.data.kasir.currentUser = currentUser.userId;
        app.data.kasir.userName = currentUser.name;
        app.data.kasir.userRole = currentUser.role;

        if (typeof dataManager !== 'undefined') {
            dataManager.save();
        }

        app.showToast(`✅ Kasir diambil alih oleh ${currentUser.name}`);
        app.updateHeader();
        app.updateKasirStatus();

        const modal = document.getElementById('takeOverModal');
        if (modal) modal.remove();

        this.navigate(page, element);
    },

    showTakeOverKasirModal(currentKasirUserId, page, element) {
        const users = dataManager.getUsers();
        const currentKasirUser = users.find(u => u.id === currentKasirUserId);
        const userName = currentKasirUser ? currentKasirUser.name : 'User lain';
        const currentUser = dataManager.getCurrentUser();

        const modalHTML = `
            <div class="modal active" id="takeOverModal" style="display: flex; z-index: 3500; align-items: flex-start; padding-top: 100px;">
                <div class="modal-content" style="max-width: 380px; text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 15px;">👑</div>
                    <div class="modal-header" style="justify-content: center;">
                        <span class="modal-title" style="font-size: 16px;">Ambil Alih Kasir</span>
                    </div>
                    <p style="color: #666; margin: 15px 0; line-height: 1.6; font-size: 14px;">
                        Kasir saat ini digunakan oleh:<br>
                        <b>${userName}</b><br><br>
                        Sebagai <b>${currentUser.role.toUpperCase()}</b>, Anda dapat mengambil alih kasir untuk melanjutkan operasional.
                    </p>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <button class="btn btn-secondary" onclick="router.closeTakeOverModal()">Batal</button>
                        <button class="btn btn-primary" onclick="router.takeOverKasir('${page}', this)" style="background: #ff9800;">
                            👑 Ambil Alih
                        </button>
                    </div>
                </div>
            </div>
        `;
        this.removeExistingModal('takeOverModal');
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    closeTakeOverModal() {
        const modal = document.getElementById('takeOverModal');
        if (modal) modal.remove();
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
                            Menu <strong>${menuName}</strong> hanya dapat diakses oleh Owner dan Admin.
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

    showKasirClosedModal() {
        const modalHTML = `
            <div class="modal active" id="kasirClosedModal" style="display: flex; z-index: 3000; align-items: flex-start; padding-top: 100px;">
                <div class="modal-content" style="max-width: 350px; text-align: center;">
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
        this.removeExistingModal('kasirClosedModal');
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    closeKasirClosedModal() {
        const modal = document.getElementById('kasirClosedModal');
        if (modal) modal.remove();
    },

    showKasirUsedByOtherModal(kasirUserId) {
        const users = dataManager.getUsers();
        const userInfo = users.find(u => u.id === kasirUserId);
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
                        Silakan tunggu atau hubungi admin/owner.
                    </p>
                    <button class="btn btn-secondary" onclick="router.closeKasirUsedByOtherModal()" style="width: 100%;">Tutup</button>
                </div>
            </div>
        `;
        this.removeExistingModal('kasirUsedModal');
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    closeKasirUsedByOtherModal() {
        const modal = document.getElementById('kasirUsedModal');
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
            'n8n': 'Pastikan file n8n.js ada di folder js/ dan sudah di-load di index.html',
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
            'n8n': '🔍',
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
    }
};

console.log('[Router] Router system loaded');

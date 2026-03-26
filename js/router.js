/**
 * Router System - Hifzi Cell POS
 * FIXED: Cloud menu rendering, Container detection, Module initialization
 * TAMBAHAN: Purchase Module
 */

const router = {
    currentPage: null,

    requiresKasirOpen: [],

    menuAccess: {
        'owner': ['pos', 'products', 'purchase', 'cash', 'reports', 'transactions', 'receipt', 'debt', 'users', 'telegram', 'cloud', 'pencarian'],
        'admin': ['pos', 'products', 'purchase', 'cash', 'reports', 'transactions', 'receipt', 'debt', 'users', 'telegram', 'cloud', 'pencarian'],
        'kasir': ['pos', 'products', 'cash', 'transactions', 'pencarian']
    },

    menuLabels: {
        'pos': 'Kasir',
        'products': 'Produk',
        'purchase': 'Pembelian',
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

    isModuleAvailable(moduleName) {
        const modules = {
            'pos': typeof posModule !== 'undefined',
            'products': typeof productsModule !== 'undefined',
            'purchase': typeof purchaseModule !== 'undefined',
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

    getContainer() {
        // Cari container dengan berbagai kemungkinan ID
        const container = document.getElementById('mainContent') || 
                         document.getElementById('module-container') || 
                         document.getElementById('content-container') ||
                         document.querySelector('.module-container') ||
                         document.querySelector('.content-area') ||
                         document.querySelector('main');
        
        if (!container) {
            console.error('[Router] No container found!');
            // Buat container baru sebagai fallback
            const newContainer = document.createElement('div');
            newContainer.id = 'mainContent';
            document.body.appendChild(newContainer);
            return newContainer;
        }
        
        return container;
    },

    clearContainer() {
        const container = this.getContainer();
        if (container) {
            container.innerHTML = '';
            // Reset style untuk memastikan tampil
            container.style.display = 'block';
            container.style.visibility = 'visible';
            container.style.opacity = '1';
        }
    },

    navigate(page, element) {
        console.log(`[Router] Navigating to: ${page}`);

        try {
            const currentUser = dataManager.getCurrentUser();

            if (!currentUser) {
                if (typeof app !== 'undefined' && app.showToast) {
                    app.showToast('❌ Silakan login terlebih dahulu!');
                }
                return;
            }

            const userRole = currentUser.role;
            const allowedMenus = this.menuAccess[userRole] || [];

            if (!allowedMenus.includes(page)) {
                this.showAccessDeniedModal(userRole, page);
                return;
            }

            // Check shift dengan logika hari baru
            const operationalMenus = ['pos', 'cash', 'debt'];
            const status = dataManager.checkKasirStatusForUser(currentUser.userId);
            
            if (operationalMenus.includes(page) && status.canOpen && !status.isContinue) {
                this.showOpenKasirFirstModal(page, element);
                return;
            }

            // Update active tab
            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
            if (element) element.classList.add('active');

            const cartBar = document.getElementById('cartBar');
            if (cartBar) cartBar.style.display = 'none';

            this.currentPage = page;

            // Clear container sebelum render module baru
            this.clearContainer();

            // Check if module is available
            if (!this.isModuleAvailable(page)) {
                console.warn(`[Router] Module ${page} not available`);
                this.showModuleErrorModal(page);
                return;
            }

            // Initialize module dengan error handling
            let initSuccess = false;
            
            switch(page) {
                case 'pos':
                    if (typeof posModule !== 'undefined' && posModule.init) {
                        posModule.init();
                        initSuccess = true;
                        if (cartBar) cartBar.style.display = 'flex';
                    }
                    break;
                case 'products':
                    if (typeof productsModule !== 'undefined' && productsModule.init) {
                        productsModule.init();
                        initSuccess = true;
                    }
                    break;
                // ============================================
                // TAMBAHAN BARU: Purchase Module
                // ============================================
                case 'purchase':
                    if (typeof purchaseModule !== 'undefined' && purchaseModule.init) {
                        purchaseModule.init();
                        initSuccess = true;
                    }
                    break;
                case 'cash':
                    if (typeof cashModule !== 'undefined' && cashModule.init) {
                        cashModule.init();
                        initSuccess = true;
                    }
                    break;
                case 'reports':
                    if (typeof reportsModule !== 'undefined' && reportsModule.init) {
                        reportsModule.init();
                        initSuccess = true;
                    }
                    break;
                case 'transactions':
                    if (typeof transactionsModule !== 'undefined' && transactionsModule.init) {
                        transactionsModule.init();
                        initSuccess = true;
                    }
                    break;
                case 'receipt':
                    if (typeof receiptModule !== 'undefined' && receiptModule.init) {
                        receiptModule.init();
                        initSuccess = true;
                    }
                    break;
                case 'debt':
                    if (typeof debtModule !== 'undefined' && debtModule.init) {
                        debtModule.init();
                        initSuccess = true;
                    }
                    break;
                case 'users':
                    if (typeof usersModule !== 'undefined' && usersModule.init) {
                        try {
                            usersModule.init();
                            initSuccess = true;
                        } catch (userError) {
                            console.error('[Router] Error initializing users module:', userError);
                            throw userError;
                        }
                    }
                    break;
                case 'telegram':
                    if (typeof TelegramModule !== 'undefined') {
                        if (TelegramModule.init) TelegramModule.init();
                        if (TelegramModule.renderPage) TelegramModule.renderPage();
                        initSuccess = true;
                    }
                    break;
                case 'pencarian':
                    if (typeof n8nModule !== 'undefined') {
                        if (n8nModule.init) n8nModule.init();
                        if (n8nModule.renderPage) n8nModule.renderPage();
                        initSuccess = true;
                    }
                    break;
                case 'cloud':
                case 'backup':
                    if (typeof backupModule !== 'undefined') {
                        console.log('[Router] Initializing cloud/backup module...');
                        
                        // 1. Pastikan backupModule initialized
                        if (!backupModule.isInitialized && backupModule.init) {
                            backupModule.init();
                        }
                        
                        // 2. Render langsung ke container
                        setTimeout(() => {
                            console.log('[Router] Rendering backup module to container...');
                            if (backupModule.render) backupModule.render();
                            
                            // 3. Setup listeners setelah render
                            setTimeout(() => {
                                if (typeof backupModule.setupMenuListeners === 'function') {
                                    backupModule.setupMenuListeners();
                                }
                            }, 100);
                        }, 50);
                        
                        initSuccess = true;
                    }
                    break;
                default:
                    console.error(`[Router] Unknown page: ${page}`);
                    if (typeof app !== 'undefined' && app.showToast) {
                        app.showToast('❌ Halaman tidak ditemukan!');
                    }
            }

            if (!initSuccess) {
                throw new Error(`Failed to initialize module: ${page}`);
            }

            console.log(`[Router] Successfully navigated to: ${page}`);

        } catch (error) {
            console.error(`[Router] Error navigating to ${page}:`, error);
            if (typeof app !== 'undefined' && app.showToast) {
                app.showToast(`❌ Error membuka menu ${this.menuLabels[page] || page}`);
            }
        }

        window.scrollTo(0, 0);
    },

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

    openKasirAndNavigate(page) {
        const modal = document.getElementById('openKasirFirstModal');
        if (modal) modal.remove();
        
        if (typeof app !== 'undefined' && app.currentUser) {
            const result = dataManager.openKasir(app.currentUser.userId, true);
            if (result.success) {
                if (typeof app.showToast === 'function') app.showToast(result.message);
                if (typeof app.updateHeader === 'function') app.updateHeader();
                if (typeof app.updateKasirStatus === 'function') app.updateKasirStatus();
                
                const navTab = document.querySelector(`.nav-tab[data-page="${page}"]`);
                this.navigate(page, navTab);
            }
        }
    },

    hasAccess(page) {
        const currentUser = dataManager.getCurrentUser();
        if (!currentUser) return false;

        const allowedMenus = this.menuAccess[currentUser.role] || [];
        return allowedMenus.includes(page);
    },

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

    showModuleErrorModal(page) {
        const menuName = this.menuLabels[page] || page;
        const suggestions = {
            'telegram': 'Pastikan file telegram.js ada di folder js/',
            'cloud': 'Pastikan file backup.js sudah di-load di index.html',
            'backup': 'Pastikan file backup.js sudah di-load di index.html',
            'pencarian': 'Pastikan file n8n.js ada di folder js/',
            'users': 'Pastikan file users.js sudah di-load di index.html',
            'purchase': 'Pastikan file purchase.js sudah di-load di index.html'
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
            'purchase': '📥',
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

    refreshNavigation() {
        this.renderNavigation();
    },

    goTo(page) {
        const navTab = document.querySelector(`.nav-tab[data-page="${page}"]`);
        this.navigate(page, navTab);
    },

    isCurrentPage(page) {
        return this.currentPage === page;
    },

    getCurrentPage() {
        return this.currentPage;
    }
};

// Expose to window
if (typeof window !== 'undefined') {
    window.router = router;
}

console.log('[Router] Router system loaded v2.5 - Purchase Module Edition');

/**
 * Router System - Hifzi Cell POS
 * FINAL FIX: Force proper navigation control
 * COMPLETE VERSION - v3.2 (Added: Kasir Lock for All Menus)
 */

const router = {
    currentPage: null,
    isNavigating: false,

    // ==========================================
    // TAMBAHAN BARU: Menu yang memerlukan kasir terbuka (SEMUA MENU)
    // ==========================================
    menusRequireKasirOpen: [
        'pos', 'products', 'purchase', 'cash', 'reports', 
        'transactions', 'receipt', 'debt', 'users', 
        'telegram', 'cloud', 'pencarian'
    ],

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
        'pencarian': 'Pencarian'
    },

    _container: null,
    
    getContainer() {
        if (this._container && document.body.contains(this._container)) {
            return this._container;
        }
        
        this._container = document.getElementById('mainContent');
        
        if (!this._container) {
            console.error('[Router] CRITICAL: mainContent not found!');
            // Create emergency container
            this._container = document.createElement('div');
            this._container.id = 'mainContent';
            document.body.appendChild(this._container);
        }
        
        return this._container;
    },

    // ==========================================
    // PERBAIKAN RADIKAL: Navigate dengan force render
    // ==========================================
    navigate(page, element) {
        console.log(`[Router] ========================================`);
        console.log(`[Router] NAVIGATE START: ${page}`);
        console.log(`[Router] ========================================`);

        if (this.isNavigating) {
            console.log('[Router] BLOCKED: Navigation in progress');
            return;
        }
        
        if (this.currentPage === page) {
            console.log('[Router] BLOCKED: Already on page:', page);
            return;
        }

        this.isNavigating = true;
        const startTime = Date.now();

        try {
            // 1. Get user
            const currentUser = dataManager.getCurrentUser();
            if (!currentUser) {
                app.showToast('❌ Silakan login terlebih dahulu!');
                this.isNavigating = false;
                return;
            }

            // 2. Check access
            const allowedMenus = this.menuAccess[currentUser.role] || [];
            if (!allowedMenus.includes(page)) {
                this.showAccessDeniedModal(currentUser.role, page);
                this.isNavigating = false;
                return;
            }

            // ==========================================
            // TAMBAHAN BARU: Check kasir status untuk SEMUA MENU
            // ==========================================
            const kasirStatus = dataManager.checkKasirStatusForUser(currentUser.userId);
            
            // Jika kasir belum dibuka dan menu memerlukan kasir terbuka
            if (this.menusRequireKasirOpen.includes(page)) {
                if (kasirStatus.canOpen && !kasirStatus.isContinue) {
                    console.log('[Router] BLOCKED: Kasir not opened yet');
                    this.showOpenKasirFirstModal(page, element);
                    this.isNavigating = false;
                    return;
                }
            }
            // ==========================================

            // 4. Update UI state
            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
            if (element) element.classList.add('active');

            const cartBar = document.getElementById('cartBar');
            if (cartBar) cartBar.style.display = 'none';

            // 5. CRITICAL: Clear and get fresh container
            this.currentPage = page;
            const container = this.getContainer();
            
            // Force clear dengan innerHTML = ''
            container.innerHTML = '';
            
            // Force style reset
            container.style.display = 'block';
            container.style.visibility = 'visible';
            container.style.opacity = '1';

            console.log(`[Router] Container cleared, rendering: ${page}`);

            // 6. Render module dengan switch yang benar
            this.renderModule(page);

            console.log(`[Router] Navigation completed in ${Date.now() - startTime}ms`);

        } catch (error) {
            console.error(`[Router] CRITICAL ERROR:`, error);
            this.getContainer().innerHTML = `
                <div style="padding: 40px; text-align: center; color: #c62828;">
                    <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
                    <h3>Error Memuat Halaman</h3>
                    <p>${error.message}</p>
                    <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px;">
                        🔄 Refresh Halaman
                    </button>
                </div>
            `;
        } finally {
            setTimeout(() => {
                this.isNavigating = false;
            }, 150);
        }

        window.scrollTo(0, 0);
    },

    // ==========================================
    // PERBAIKAN: Render module terpisah
    // ==========================================
    renderModule(page) {
        console.log(`[Router] renderModule(${page})`);
        
        const container = this.getContainer();
        let success = false;

        switch(page) {
            case 'pos':
                if (typeof posModule !== 'undefined' && posModule.init) {
                    posModule.init();
                    success = true;
                    const cartBar = document.getElementById('cartBar');
                    if (cartBar) cartBar.style.display = 'flex';
                }
                break;

            case 'products':
                if (typeof productsModule !== 'undefined' && productsModule.init) {
                    productsModule.init();
                    success = true;
                } else {
                    container.innerHTML = '<div style="padding: 40px; text-align: center;">📦 Module Produk tidak tersedia</div>';
                }
                break;

            case 'purchase':
                if (typeof purchaseModule !== 'undefined' && purchaseModule.init) {
                    purchaseModule.init();
                    success = true;
                } else {
                    container.innerHTML = '<div style="padding: 40px; text-align: center;">📥 Module Pembelian tidak tersedia</div>';
                }
                break;

            case 'cash':
                if (typeof cashModule !== 'undefined' && cashModule.init) {
                    cashModule.init();
                    success = true;
                } else {
                    container.innerHTML = '<div style="padding: 40px; text-align: center;">💰 Module Kas tidak tersedia</div>';
                }
                break;

            case 'reports':
                if (typeof reportsModule !== 'undefined' && reportsModule.init) {
                    reportsModule.init();
                    success = true;
                }
                break;

            case 'transactions':
                if (typeof transactionsModule !== 'undefined' && transactionsModule.init) {
                    transactionsModule.init();
                    success = true;
                }
                break;

            case 'receipt':
                if (typeof receiptModule !== 'undefined' && receiptModule.init) {
                    receiptModule.init();
                    success = true;
                }
                break;

            case 'debt':
                if (typeof debtModule !== 'undefined' && debtModule.init) {
                    debtModule.init();
                    success = true;
                }
                break;

            case 'users':
                if (typeof usersModule !== 'undefined' && usersModule.init) {
                    usersModule.init();
                    success = true;
                }
                break;

            case 'telegram':
                if (typeof TelegramModule !== 'undefined') {
                    if (TelegramModule.init) TelegramModule.init();
                    if (TelegramModule.renderPage) TelegramModule.renderPage();
                    success = true;
                }
                break;

            case 'pencarian':
                if (typeof n8nModule !== 'undefined') {
                    if (n8nModule.init) n8nModule.init();
                    if (n8nModule.renderPage) n8nModule.renderPage();
                    success = true;
                }
                break;

            case 'cloud':
                // PERBAIKAN: Render cloud secara manual, jangan panggil init lagi
                if (typeof backupModule !== 'undefined' && backupModule.render) {
                    // Hanya render, jangan init lagi
                    backupModule.render();
                    success = true;
                } else {
                    container.innerHTML = '<div style="padding: 40px; text-align: center;">☁️ Module Cloud tidak tersedia</div>';
                }
                break;

            default:
                container.innerHTML = `<div style="padding: 40px; text-align: center;">❓ Halaman "${page}" tidak dikenal</div>`;
        }

        console.log(`[Router] renderModule(${page}) success: ${success}`);
        return success;
    },

    // ==========================================
    // PERBAIKAN: Render navigation tanpa onclick inline
    // ==========================================
    renderNavigation() {
        const currentUser = dataManager.getCurrentUser();
        if (!currentUser) {
            console.log('[Router] No user logged in');
            return;
        }

        const allowedMenus = this.menuAccess[currentUser.role] || [];
        const navContainer = document.getElementById('navTabs');

        if (!navContainer) {
            console.error('[Router] navTabs not found!');
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
            'pencarian': '🔍'
        };

        // Kosongkan container
        navContainer.innerHTML = '';

        // Buat button dengan event listener (bukan onclick inline)
        allowedMenus.forEach(menu => {
            const btn = document.createElement('button');
            btn.className = 'nav-tab';
            btn.setAttribute('data-page', menu);
            btn.innerHTML = `
                <span class="nav-icon">${menuIcons[menu] || '📄'}</span>
                <span class="nav-label">${this.menuLabels[menu] || menu}</span>
            `;
            
            // Event listener terpisah - PERBAIKAN UTAMA
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log(`[Router] Nav tab clicked: ${menu}`);
                this.navigate(menu, btn);
            });
            
            navContainer.appendChild(btn);
        });

        console.log(`[Router] Navigation rendered for ${currentUser.role}:`, allowedMenus);
    },

    // ==========================================
    // MODAL METHODS
    // ==========================================
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
        this.removeModal('openKasirFirstModal');
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    openKasirAndNavigate(page) {
        this.removeModal('openKasirFirstModal');
        
        if (typeof app !== 'undefined' && app.currentUser) {
            const result = dataManager.openKasir(app.currentUser.userId, true);
            if (result.success) {
                if (typeof app.showToast === 'function') app.showToast(result.message);
                if (typeof app.updateHeader === 'function') app.updateHeader();
                if (typeof app.updateKasirStatus === 'function') app.updateKasirStatus();
                
                // Navigate after opening kasir
                setTimeout(() => {
                    const navTab = document.querySelector(`.nav-tab[data-page="${page}"]`);
                    this.navigate(page, navTab);
                }, 100);
            }
        }
    },

    showAccessDeniedModal(userRole, page) {
        const menuName = this.menuLabels[page] || page;
        const allowedMenus = this.menuAccess[userRole] || [];
        const allowedMenuList = allowedMenus.map(m => `• ${this.menuLabels[m] || m}`).join('<br>');

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
                    <button class="btn btn-primary" onclick="router.removeModal('accessDeniedModal')" style="padding: 10px 30px;">
                        Mengerti
                    </button>
                </div>
            </div>
        `;
        this.removeModal('accessDeniedModal');
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    removeModal(id) {
        const modal = document.getElementById(id);
        if (modal) modal.remove();
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
    },

    // ==========================================
    // PERBAIKAN BARU: Method untuk cek module availability
    // ==========================================
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
            'pencarian': typeof n8nModule !== 'undefined'
        };
        return modules[moduleName] || false;
    },

    // ==========================================
    // PERBAIKAN BARU: Get allowed menus for current user
    // ==========================================
    getAllowedMenus() {
        const currentUser = dataManager.getCurrentUser();
        if (!currentUser) return [];
        return this.menuAccess[currentUser.role] || [];
    },

    // ==========================================
    // PERBAIKAN BARU: Check if user has access to page
    // ==========================================
    hasAccess(page) {
        const currentUser = dataManager.getCurrentUser();
        if (!currentUser) return false;
        const allowedMenus = this.menuAccess[currentUser.role] || [];
        return allowedMenus.includes(page);
    },

    // ==========================================
    // TAMBAHAN BARU: Check if kasir is opened for current user
    // ==========================================
    isKasirOpened() {
        const currentUser = dataManager.getCurrentUser();
        if (!currentUser) return false;
        const kasirStatus = dataManager.checkKasirStatusForUser(currentUser.userId);
        return kasirStatus.isContinue || !kasirStatus.canOpen;
    }
};

// Expose to window
window.router = router;

console.log('[Router] FINAL VERSION loaded - v3.2 - Kasir Lock for All Menus');

// ============================================
// ROUTER SYSTEM - HIFZI CELL (FIXED VERSION)
// ============================================

const router = {
    currentPage: null,
    
    // Menu yang bisa diakses saat kasir TUTUP (tanpa membuka kasir baru)
    allowedWhenClosed: ['backup', 'users', 'reports', 'transactions', 'receipt', 'telegram', 'cloud'],
    
    // Menu yang butuh kasir BUKA
    requiresKasirOpen: ['pos', 'products', 'cash', 'debt'],

    // Definisi akses menu berdasarkan role
    menuAccess: {
        'owner': ['pos', 'products', 'cash', 'reports', 'transactions', 'receipt', 'debt', 'users', 'telegram', 'cloud'],
        'admin': ['pos', 'products', 'cash', 'reports', 'transactions', 'receipt', 'debt', 'telegram', 'cloud'],
        'kasir': ['pos', 'products', 'transactions']
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
        'cloud': 'Cloud'
    },

    navigate(page, element) {
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

        // Update active tab
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        if (element) element.classList.add('active');

        // Hide cart bar by default
        document.getElementById('cartBar').style.display = 'none';
        this.currentPage = page;

        // ============================================
        // ROUTING TABLE - PERBAIKAN UTAMA DI SINI
        // ============================================
        
        switch(page) {
            case 'pos':
                if (typeof posModule !== 'undefined' && posModule.init) {
                    posModule.init();
                    document.getElementById('cartBar').style.display = 'flex';
                }
                break;
                
            case 'products':
                if (typeof productsModule !== 'undefined' && productsModule.init) {
                    productsModule.init();
                }
                break;
                
            case 'cash':
                if (typeof cashModule !== 'undefined' && cashModule.init) {
                    cashModule.init();
                }
                break;
                
            case 'reports':
                if (typeof reportsModule !== 'undefined' && reportsModule.init) {
                    reportsModule.init();
                }
                break;
                
            case 'transactions':
                if (typeof transactionsModule !== 'undefined' && transactionsModule.init) {
                    transactionsModule.init();
                }
                break;
                
            case 'receipt':
                if (typeof receiptModule !== 'undefined' && receiptModule.init) {
                    receiptModule.init();
                }
                break;
                
            case 'debt':
                if (typeof debtModule !== 'undefined' && debtModule.init) {
                    debtModule.init();
                }
                break;
                
            case 'users':
                if (typeof usersModule !== 'undefined' && usersModule.init) {
                    usersModule.init();
                }
                break;
                
            // ============================================
            // PERBAIKAN: TELEGRAM MODULE
            // ============================================
            case 'telegram':
                console.log('[Router] Loading Telegram module...');
                if (typeof TelegramModule !== 'undefined') {
                    // TelegramModule tidak punya init(), langsung renderPage()
                    TelegramModule.renderPage();
                    console.log('[Router] Telegram module rendered successfully');
                } else {
                    console.error('[Router] TelegramModule not found!');
                    this.showModuleError('Telegram');
                }
                break;
                
            // ============================================
            // PERBAIKAN: CLOUD/BACKUP MODULE
            // ============================================
            case 'cloud':
                console.log('[Router] Loading Cloud/Backup module...');
                if (typeof backupModule !== 'undefined') {
                    // Reset flag agar bisa render ulang
                    backupModule.isRendered = false;
                    // Panggil init() jika ada, atau langsung render()
                    if (typeof backupModule.init === 'function') {
                        backupModule.init();
                    }
                    // Selalu panggil render untuk menampilkan UI
                    if (typeof backupModule.render === 'function') {
                        backupModule.render();
                    } else {
                        console.error('[Router] backupModule.render is not a function');
                    }
                    console.log('[Router] Cloud module rendered successfully');
                } else {
                    console.error('[Router] backupModule not found!');
                    this.showModuleError('Cloud');
                }
                break;
                
            default:
                console.error('[Router] Unknown page:', page);
                app.showToast('❌ Halaman tidak ditemukan');
        }
        
        window.scrollTo(0, 0);
    },

    // ============================================
    // ERROR HANDLER UNTUK MODULE TIDAK TERSEDIA
    // ============================================
    
    showModuleError(moduleName) {
        const container = document.getElementById('mainContent');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 60px 20px;">
                    <div style="font-size: 64px; margin-bottom: 20px;">⚠️</div>
                    <h2 style="color: #c62828; margin-bottom: 15px;">Modul ${moduleName} Tidak Tersedia</h2>
                    <p style="color: #666; margin-bottom: 30px; line-height: 1.6;">
                        Modul ${moduleName} belum dimuat dengan benar.<br>
                        Pastikan file js/${moduleName.toLowerCase()}.js sudah di-include di HTML.
                    </p>
                    <button onclick="router.navigate('pos')" 
                            style="padding: 12px 30px; background: #667eea; color: white; 
                                   border: none; border-radius: 8px; cursor: pointer;">
                        Kembali ke Kasir
                    </button>
                </div>
            `;
        }
        app.showToast(`❌ Error: Modul ${moduleName} tidak tersedia`);
    },

    // ============================================
    // FUNGSI LAINNYA (TETAP SAMA)
    // ============================================

    takeOverKasir(page, element) {
        const currentUser = dataManager.getCurrentUser();
        
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
        const existingModal = document.getElementById('takeOverModal');
        if (existingModal) existingModal.remove();
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    closeTakeOverModal() {
        const modal = document.getElementById('takeOverModal');
        if (modal) modal.remove();
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
        const existingModal = document.getElementById('accessDeniedModal');
        if (existingModal) existingModal.remove();
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
        const existingModal = document.getElementById('kasirClosedModal');
        if (existingModal) existingModal.remove();
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
        const existingModal = document.getElementById('kasirUsedModal');
        if (existingModal) existingModal.remove();
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    closeKasirUsedByOtherModal() {
        const modal = document.getElementById('kasirUsedModal');
        if (modal) modal.remove();
    },

    renderNavigation() {
        const currentUser = dataManager.getCurrentUser();
        if (!currentUser) return;

        const allowedMenus = this.menuAccess[currentUser.role] || [];
        const navContainer = document.querySelector('.nav-tabs') || document.getElementById('navTabs');
        
        if (!navContainer) return;

        const menuIcons = {
            'pos': '🛒',
            'products': '📦',
            'cash': '💰',
            'reports': '📊',
            'transactions': '📋',
            'receipt': '🧾',
            'backup': '💾',
            'debt': '💳',
            'users': '👥',
            'telegram': '✈️',
            'cloud': '☁️'
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
    }
};

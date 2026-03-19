const dataManager = {
    // Key untuk localStorage
    STORAGE_KEY: 'hifzi_data',
    USERS_KEY: 'hifzi_users',
    CURRENT_USER_KEY: 'hifzi_current_user',
    
    // Struktur data lengkap
    data: {
        categories: [
            { id: 'all', name: 'Semua', icon: '📦' },
            { id: 'handphone', name: 'Handphone', icon: '📱' },
            { id: 'aksesoris', name: 'Aksesoris', icon: '🎧' },
            { id: 'pulsa', name: 'Pulsa', icon: '💳' },
            { id: 'servis', name: 'Servis', icon: '🔧' }
        ],
        products: [],
        transactions: [],
        cashTransactions: [],
        debts: [],
        shiftHistory: [],
        loginHistory: [],
        
        settings: {
            storeName: 'Hifzi Cell',
            address: '',
            phone: '',
            tax: 0,
            taxRate: 0,
            modalAwal: 0,
            currentCash: 0,
            receiptHeader: {
                storeName: 'HIFZI CELL',
                address: 'Alamat Belum Diatur',
                phone: '',
                note: 'Terima kasih atas kunjungan Anda'
            }
        },
        
        kasir: {
            isOpen: false,
            openTime: null,
            closeTime: null,
            date: null,
            currentUser: null,
            lastCheckDate: null
        }
    },
    
    // PERBAIKAN: Gunakan ID tetap untuk default users agar konsisten
    defaultUsers: [
        {
            id: 'owner_default',
            username: 'owner',
            password: 'owner123',
            name: 'Pemilik Usaha',
            role: 'owner',
            createdAt: new Date().toISOString(),
            lastLogin: null
        },
        {
            id: 'admin_default',
            username: 'admin',
            password: 'admin123',
            name: 'Administrator',
            role: 'admin',
            createdAt: new Date().toISOString(),
            lastLogin: null
        },
        {
            id: 'kasir_default',
            username: 'kasir1',
            password: 'kasir123',
            name: 'Kasir 1',
            role: 'kasir',
            createdAt: new Date().toISOString(),
            lastLogin: null
        }
    ],

    // ========== INIT & SAVE ==========
    
    init() {
        const saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            this.data = this.deepMerge(this.data, parsed);
        }
        
        if (!this.data.kasir) {
            this.data.kasir = { 
                isOpen: false, 
                openTime: null, 
                closeTime: null, 
                date: null, 
                currentUser: null, 
                lastCheckDate: null 
            };
        }

        if (!this.data.loginHistory) this.data.loginHistory = [];
        if (!this.data.settings.phone) this.data.settings.phone = '';
        if (this.data.settings.tax === undefined) this.data.settings.tax = 0;

        this.checkAutoCloseMidnight();
        
        // PERBAIKAN: Inisialisasi users dengan pengecekan lebih baik
        this.initUsers();
        
        this.save();
        return this.data;
    },

    // PERBAIKAN: Fungsi inisialisasi users yang lebih robust
    initUsers() {
        let users = JSON.parse(localStorage.getItem(this.USERS_KEY));
        
        if (!users || !Array.isArray(users) || users.length === 0) {
            // Belum ada users, buat default
            users = [...this.defaultUsers];
            localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
            console.log('[DataManager] Default users created');
        } else {
            // PERBAIKAN: Pastikan owner selalu ada
            const ownerExists = users.some(u => u.role === 'owner');
            if (!ownerExists) {
                console.log('[DataManager] Owner not found, creating default owner');
                users.unshift({
                    id: 'owner_default',
                    username: 'owner',
                    password: 'owner123',
                    name: 'Pemilik Usaha',
                    role: 'owner',
                    createdAt: new Date().toISOString(),
                    lastLogin: null
                });
                localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
            }
            
            // PERBAIKAN: Pastikan tidak ada duplikat username
            const uniqueUsers = [];
            const seenUsernames = new Set();
            for (const user of users) {
                if (!seenUsernames.has(user.username)) {
                    seenUsernames.add(user.username);
                    uniqueUsers.push(user);
                } else {
                    console.log('[DataManager] Duplicate username found:', user.username);
                }
            }
            if (uniqueUsers.length !== users.length) {
                localStorage.setItem(this.USERS_KEY, JSON.stringify(uniqueUsers));
            }
        }
    },

    //========== CREATE DEFAULT DATA ==========
    createDefaultData() {
        const defaultData = {
            users: this.defaultUsers,
            loginHistory: [],
            categories: this.data.categories,
            products: [],
            transactions: [],
            cashTransactions: [],
            debts: [],
            shiftHistory: [],
            settings: this.data.settings,
            kasir: this.data.kasir
        };
        this.saveData(defaultData);
        return defaultData;
    },

    // ========== AUTO-CLOSE JAM 12 MALAM ==========
    checkAutoCloseMidnight() {
        const now = new Date();
        const today = now.toDateString();
        
        if (this.data.kasir.isOpen && this.data.kasir.date) {
            const kasirDate = new Date(this.data.kasir.date).toDateString();
            if (kasirDate !== today) {
                console.log('[AutoClose] Kasir otomatis ditutup karena sudah lewat jam 12 malam');
                this.saveShiftHistory();
                this.data.kasir.isOpen = false;
                this.data.kasir.closeTime = new Date().toISOString();
                this.data.kasir.currentUser = null;
                this.data.kasir.date = null;
                this.data.settings.modalAwal = 0;
                this.data.kasir.lastCheckDate = today;
                this.save();
                return true;
            }
        }
        this.data.kasir.lastCheckDate = today;
        return false;
    },

    // ========== SAVE ==========
    save() {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
        if (typeof backupModule !== 'undefined' && backupModule.shouldSync && backupModule.shouldSync()) {
            console.log('[DataManager] Triggering cloud sync...');
            backupModule.syncToCloud(this.getAllData());
        }
    },

    saveData(data) {
        if (data) this.data = this.deepMerge(this.data, data);
        this.save();
    },

    getData() { return this.data; },

    // ========== GET ALL DATA (untuk backup) ==========
    getAllData() {
        return {
            categories: this.data.categories || [],
            products: this.data.products || [],
            transactions: this.data.transactions || [],
            cashTransactions: this.data.cashTransactions || [],
            debts: this.data.debts || [],
            shiftHistory: this.data.shiftHistory || [],
            loginHistory: this.data.loginHistory || [],
            settings: this.data.settings || {},
            kasir: this.data.kasir || {},
            _meta: { 
                lastModified: new Date().toISOString(), 
                deviceId: typeof backupModule !== 'undefined' ? backupModule.deviceId : 'unknown', 
                version: '1.0' 
            }
        };
    },

    // ========== SAVE ALL DATA (dari restore/download) ==========
    saveAllData(cloudData) {
        const { _meta, ...cleanData } = cloudData;
        if (cleanData.categories) this.data.categories = cleanData.categories;
        if (cleanData.products) this.data.products = cleanData.products;
        if (cleanData.transactions) this.data.transactions = cleanData.transactions;
        if (cleanData.cashTransactions) this.data.cashTransactions = cleanData.cashTransactions;
        if (cleanData.debts) this.data.debts = cleanData.debts;
        if (cleanData.shiftHistory) this.data.shiftHistory = cleanData.shiftHistory;
        if (cleanData.loginHistory) this.data.loginHistory = cleanData.loginHistory;
        if (cleanData.settings) this.data.settings = { ...this.data.settings, ...cleanData.settings };
        if (cleanData.kasir) this.data.kasir = { ...this.data.kasir, ...cleanData.kasir };
        this.save();
        if (typeof app !== 'undefined' && app.data) {
            app.data = this.data;
            if (app.updateHeader) app.updateHeader();
        }
        console.log('[DataManager] Data restored from cloud');
    },

    // Helper untuk merge object deeply
    deepMerge(target, source) {
        const output = Object.assign({}, target);
        if (this.isObject(target) && this.isObject(source)) {
            Object.keys(source).forEach(key => {
                if (this.isObject(source[key])) {
                    if (!(key in target)) Object.assign(output, { [key]: source[key] });
                    else output[key] = this.deepMerge(target[key], source[key]);
                } else {
                    Object.assign(output, { [key]: source[key] });
                }
            });
        }
        return output;
    },
    
    isObject(item) { 
        return (item && typeof item === 'object' && !Array.isArray(item)); 
    },

    // ========== BACKWARD COMPATIBILITY ==========
    load() { return this.init(); },
    getProducts() { return this.data.products; },
    getTransactions() { return this.data.transactions; },
    getCategories() { return this.data.categories; },
    getSettings() { return this.data.settings; },
    
    addProduct(product) {
        product.id = product.id || 'prod_' + Date.now();
        product.createdAt = new Date().toISOString();
        this.data.products.push(product);
        this.save();
        return product;
    },
    
    updateProduct(id, updates) {
        const idx = this.data.products.findIndex(p => p.id === id);
        if (idx !== -1) {
            this.data.products[idx] = { ...this.data.products[idx], ...updates };
            this.save();
            return this.data.products[idx];
        }
        return null;
    },
    
    deleteProduct(id) {
        this.data.products = this.data.products.filter(p => p.id !== id);
        this.save();
    },
    
    addTransaction(transaction) {
        transaction.id = transaction.id || 'trans_' + Date.now();
        transaction.createdAt = new Date().toISOString();
        this.data.transactions.push(transaction);
        this.save();
        return transaction;
    },
    
    updateTransaction(id, updates) {
        const idx = this.data.transactions.findIndex(t => t.id === id);
        if (idx !== -1) {
            this.data.transactions[idx] = { ...this.data.transactions[idx], ...updates };
            this.save();
            return this.data.transactions[idx];
        }
        return null;
    },

    // ========== USER MANAGEMENT ==========
    
    getUsers() { 
        const users = JSON.parse(localStorage.getItem(this.USERS_KEY));
        // PERBAIKAN: Pastikan selalu return array
        if (!users || !Array.isArray(users)) {
            this.initUsers();
            return this.defaultUsers;
        }
        return users;
    },
    
    saveUsers(users) { 
        localStorage.setItem(this.USERS_KEY, JSON.stringify(users)); 
    },

    addUser(user) {
        const users = this.getUsers();
        user.id = 'user_' + Date.now();
        user.createdAt = new Date().toISOString();
        user.lastLogin = null;
        users.push(user);
        this.saveUsers(users);
        return user;
    },

    updateUser(userId, updateData) {
        const users = this.getUsers();
        const userIndex = users.findIndex(u => u.id === userId);
        if (userIndex === -1) return false;
        
        // PERBAIKAN: Cek duplikat username saat update
        if (updateData.username) {
            const existingUser = users.find(u => u.username === updateData.username && u.id !== userId);
            if (existingUser) {
                console.error('[DataManager] Username already exists:', updateData.username);
                return false;
            }
        }
        
        if (updateData.name) users[userIndex].name = updateData.name;
        if (updateData.username) users[userIndex].username = updateData.username;
        if (updateData.role) users[userIndex].role = updateData.role;
        if (updateData.password) users[userIndex].password = updateData.password;
        this.saveUsers(users);
        return true;
    },

    deleteUser(userId) {
        // PERBAIKAN: Cegah hapus user yang sedang login
        const currentUser = this.getCurrentUser();
        if (currentUser && currentUser.userId === userId) {
            console.error('[DataManager] Cannot delete currently logged in user');
            return false;
        }
        
        // PERBAIKAN: Cegah hapus owner terakhir
        const users = this.getUsers();
        const userToDelete = users.find(u => u.id === userId);
        if (userToDelete && userToDelete.role === 'owner') {
            const ownerCount = users.filter(u => u.role === 'owner').length;
            if (ownerCount <= 1) {
                console.error('[DataManager] Cannot delete the last owner');
                return false;
            }
        }
        
        const filteredUsers = users.filter(u => u.id !== userId);
        this.saveUsers(filteredUsers);
        return true;
    },

    // ========== AUTHENTICATION ==========
    
    login(username, password) {
        console.log('[DataManager] Login attempt:', username);
        
        // PERBAIKAN: Validasi input
        if (!username || !password) {
            return { success: false, message: 'Username dan password wajib diisi!' };
        }
        
        const users = this.getUsers();
        
        // PERBAIKAN: Cari user dengan case-insensitive username
        const user = users.find(u => 
            u.username.toLowerCase() === username.toLowerCase() && 
            u.password === password
        );
        
        if (user) {
            console.log('[DataManager] Login successful for:', user.username, 'Role:', user.role);
            
            const session = { 
                userId: user.id, 
                username: user.username, 
                name: user.name, 
                role: user.role, 
                loginTime: new Date().toISOString() 
            };
            
            localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(session));
            this.recordLogin(user.id);
            return { success: true, user: session };
        }
        
        console.log('[DataManager] Login failed: Invalid credentials');
        return { success: false, message: 'Username atau password salah!' };
    },

    logout() {
        this.save();
        localStorage.removeItem(this.CURRENT_USER_KEY);
    },

    getCurrentUser() {
        const session = localStorage.getItem(this.CURRENT_USER_KEY);
        if (!session) return null;
        
        try {
            return JSON.parse(session);
        } catch (e) {
            console.error('[DataManager] Error parsing current user:', e);
            localStorage.removeItem(this.CURRENT_USER_KEY);
            return null;
        }
    },

    isLoggedIn() { 
        return this.getCurrentUser() !== null; 
    },

    // ========== LOGIN HISTORY MANAGEMENT ==========
    
    recordLogin(userId) {
        const data = this.getData();
        if (!data.loginHistory) data.loginHistory = [];
        
        const deviceInfo = navigator.userAgent.substring(0, 100);
        
        const loginRecord = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2),
            userId: userId,
            timestamp: new Date().toISOString(),
            deviceInfo: deviceInfo,
            ipAddress: 'Local Device',
            status: 'success'
        };
        
        data.loginHistory.push(loginRecord);
        
        // Update last login di users
        const users = this.getUsers();
        const userIndex = users.findIndex(u => u.id === userId);
        if (userIndex !== -1) {
            users[userIndex].lastLogin = loginRecord.timestamp;
            this.saveUsers(users);
        }
        
        // Cleanup: Hanya simpan 6 bulan terakhir (180 hari)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 180);
        data.loginHistory = data.loginHistory.filter(log => 
            new Date(log.timestamp) >= sixMonthsAgo
        );
        
        this.saveData(data);
        return loginRecord;
    },

    getLoginHistory(filters = {}) {
        const data = this.getData();
        let history = data.loginHistory || [];
        
        // Sort by timestamp desc (terbaru dulu)
        history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // Apply filters
        if (filters.startDate) {
            history = history.filter(log => new Date(log.timestamp) >= filters.startDate);
        }
        if (filters.endDate) {
            history = history.filter(log => new Date(log.timestamp) < filters.endDate);
        }
        if (filters.userId) {
            history = history.filter(log => log.userId === filters.userId);
        }
        
        return history;
    },

    getUserLastLogin(userId) {
        const users = this.getUsers();
        const user = users.find(u => u.id === userId);
        return user ? user.lastLogin : null;
    },

    deleteUserLoginHistory(userId) {
        const data = this.getData();
        if (data.loginHistory) {
            data.loginHistory = data.loginHistory.filter(log => log.userId !== userId);
            this.saveData(data);
        }
    },

    // Untuk backup module
    getAllLoginHistoryForBackup() {
        const data = this.getData();
        return data.loginHistory || [];
    },

    restoreLoginHistory(loginHistory) {
        const data = this.getData();
        data.loginHistory = loginHistory || [];
        this.saveData(data);
    },

    // ========== KASIR MANAGEMENT ==========
    
    checkKasirStatusForUser(userId) {
        const today = new Date().toDateString();
        const kasir = this.data.kasir;
        this.checkAutoCloseMidnight();
        
        if (!kasir.isOpen) {
            return { 
                canOpen: true, 
                shouldReset: true, 
                reason: 'closed',
                message: 'Kasir tutup. Silakan buka kasir untuk memulai shift.' 
            };
        }
        
        if (kasir.currentUser === userId) {
            if (kasir.date === today) {
                return { 
                    canOpen: false, 
                    shouldReset: false, 
                    reason: 'already_open_same_user', 
                    message: 'Kasir sudah buka dengan akun Anda. Lanjutkan shift.' 
                };
            } else {
                return { 
                    canOpen: true, 
                    shouldReset: true, 
                    reason: 'new_day_same_user', 
                    message: 'Shift baru untuk hari ini. Modal akan direset.' 
                };
            }
        }
        
        return { 
            canOpen: false, 
            shouldReset: false, 
            reason: 'different_user', 
            message: 'Kasir sedang digunakan oleh user lain. Silakan tunggu atau hubungi admin.' 
        };
    },

    openKasir(userId, forceReset = false) {
        const today = new Date().toDateString();
        const status = this.checkKasirStatusForUser(userId);
        
        if (status.reason === 'already_open_same_user') {
            this.data.kasir.currentUser = userId;
            this.data.kasir.lastLoginTime = new Date().toISOString();
            this.save();
            return { 
                success: true, 
                reset: false, 
                message: 'Selamat datang kembali! Shift Anda dilanjutkan.' 
            };
        }
        
        if (status.shouldReset || forceReset) {
            if (this.data.kasir.date && this.data.kasir.date !== today) {
                this.saveShiftHistory();
            }
            this.data.settings.modalAwal = 0;
        }
        
        this.data.kasir = { 
            isOpen: true, 
            openTime: new Date().toISOString(), 
            closeTime: null, 
            date: today, 
            currentUser: userId, 
            lastLoginTime: new Date().toISOString(), 
            lastCheckDate: today 
        };
        this.save();
        
        return { 
            success: true, 
            reset: status.shouldReset, 
            message: status.shouldReset ? 'Kasir dibuka dengan shift baru!' : 'Kasir dibuka!' 
        };
    },

    saveShiftHistory() {
        if (!this.data.shiftHistory) this.data.shiftHistory = [];
        const kasirDate = this.data.kasir.date;
        const dayTrans = this.data.transactions.filter(t => 
            new Date(t.date).toDateString() === kasirDate && 
            t.status !== 'voided'
        );

        const shiftSummary = {
            date: kasirDate,
            userId: this.data.kasir.currentUser,
            openTime: this.data.kasir.openTime,
            closeTime: new Date().toISOString(),
            totalSales: dayTrans.reduce((sum, t) => sum + (t.total || 0), 0),
            totalProfit: dayTrans.reduce((sum, t) => sum + (t.profit || 0), 0),
            transactionCount: dayTrans.length,
            modalAwal: this.data.settings.modalAwal,
            cashEnd: this.data.settings.currentCash
        };

        const existingIndex = this.data.shiftHistory.findIndex(s => s.date === kasirDate);
        if (existingIndex !== -1) {
            this.data.shiftHistory[existingIndex] = shiftSummary;
        } else {
            this.data.shiftHistory.push(shiftSummary);
        }
        this.save();
    },

    closeKasir() {
        if (!this.data.kasir.isOpen) {
            return { success: false, message: 'Kasir sudah tutup!' };
        }
        this.saveShiftHistory();
        this.data.kasir.isOpen = false;
        this.data.kasir.closeTime = new Date().toISOString();
        this.data.kasir.currentUser = null;
        this.save();
        return { success: true, message: 'Kasir ditutup. Shift berakhir. Data tersimpan.' };
    },
    
    // ========== STATS HELPERS ==========
    
    getTodayStats() {
        const today = new Date().toDateString();
        const todayTrans = this.data.transactions.filter(t => 
            new Date(t.date).toDateString() === today && 
            t.status !== 'deleted' && 
            t.status !== 'voided'
        );
        return {
            transactionCount: todayTrans.length,
            totalSales: todayTrans.reduce((sum, t) => sum + (t.total || 0), 0),
            totalProfit: todayTrans.reduce((sum, t) => sum + (t.profit || 0), 0)
        };
    }
};

// PERBAIKAN: Inisialisasi otomatis dengan pengecekan
if (typeof dataManager !== 'undefined') {
    try {
        dataManager.init();
        console.log('[DataManager] Initialized successfully');
    } catch (e) {
        console.error('[DataManager] Initialization error:', e);
    }
}

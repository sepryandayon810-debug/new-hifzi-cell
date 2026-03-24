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
        
        // ✅ BARU: Pending modal untuk kasir (diatur owner)
        pendingModals: {},
        
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
        
        // ✅ PERUBAHAN: Multi-user kasir system
        // Kasir sekarang array of active shifts, bukan single object
        kasir: {
            isOpen: false, // global status
            activeShifts: [], // array of active user shifts
            date: null,
            lastCheckDate: null
        }
    },
    
    // Default users tetap sama
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
        
        // ✅ PERUBAHAN: Inisialisasi struktur kasir baru
        if (!this.data.kasir) {
            this.data.kasir = { 
                isOpen: false, 
                activeShifts: [],
                date: null,
                lastCheckDate: null
            };
        }
        
        // ✅ PERUBAHAN: Konversi dari struktur lama ke struktur baru
        if (this.data.kasir.currentUser !== undefined && !this.data.kasir.activeShifts) {
            // Migrate dari struktur lama
            const oldKasir = { ...this.data.kasir };
            this.data.kasir = {
                isOpen: oldKasir.isOpen,
                activeShifts: oldKasir.isOpen && oldKasir.currentUser ? [{
                    userId: oldKasir.currentUser,
                    userName: oldKasir.userName || 'Unknown',
                    userRole: oldKasir.userRole || 'kasir',
                    openTime: oldKasir.openTime,
                    modalAwal: this.data.settings?.modalAwal || 0,
                    currentCash: this.data.settings?.modalAwal || 0
                }] : [],
                date: oldKasir.date,
                lastCheckDate: oldKasir.lastCheckDate
            };
        }

        // ✅ BARU: Inisialisasi pendingModals
        if (!this.data.pendingModals) {
            this.data.pendingModals = {};
        }

        if (!this.data.loginHistory) this.data.loginHistory = [];
        if (!this.data.settings.phone) this.data.settings.phone = '';
        if (this.data.settings.tax === undefined) this.data.settings.tax = 0;

        this.checkAutoCloseMidnight();
        
        this.initUsers();
        
        this.save();
        return this.data;
    },

    // PERBAIKAN: Fungsi inisialisasi users yang lebih robust
    initUsers() {
        let users = JSON.parse(localStorage.getItem(this.USERS_KEY));
        
        if (!users || !Array.isArray(users) || users.length === 0) {
            users = [...this.defaultUsers];
            localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
            console.log('[DataManager] Default users created');
        } else {
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
            pendingModals: {},
            settings: this.data.settings,
            kasir: {
                isOpen: false,
                activeShifts: [],
                date: null,
                lastCheckDate: null
            }
        };
        this.saveData(defaultData);
        return defaultData;
    },

    // ========== AUTO-CLOSE JAM 12 MALAM ==========
    checkAutoCloseMidnight() {
        const now = new Date();
        const today = now.toDateString();
        
        // ✅ PERUBAHAN: Check semua active shifts
        if (this.data.kasir.activeShifts && this.data.kasir.activeShifts.length > 0) {
            const shiftsToClose = this.data.kasir.activeShifts.filter(shift => {
                const shiftDate = new Date(shift.openTime).toDateString();
                return shiftDate !== today;
            });
            
            if (shiftsToClose.length > 0) {
                console.log('[AutoClose] Menutup', shiftsToClose.length, 'shift karena sudah lewat jam 12 malam');
                // Save shift history untuk setiap shift yang ditutup
                shiftsToClose.forEach(shift => {
                    this.saveShiftHistory(shift);
                });
                
                // Filter out shifts yang sudah ditutup
                this.data.kasir.activeShifts = this.data.kasir.activeShifts.filter(shift => {
                    const shiftDate = new Date(shift.openTime).toDateString();
                    return shiftDate === today;
                });
                
                if (this.data.kasir.activeShifts.length === 0) {
                    this.data.kasir.isOpen = false;
                }
                this.data.kasir.date = today;
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
            pendingModals: this.data.pendingModals || {},
            settings: this.data.settings || {},
            kasir: this.data.kasir || {},
            _meta: { 
                lastModified: new Date().toISOString(), 
                deviceId: typeof backupModule !== 'undefined' ? backupModule.deviceId : 'unknown', 
                version: '2.1' // ✅ Updated version for pendingModals feature
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
        if (cleanData.pendingModals) this.data.pendingModals = cleanData.pendingModals;
        if (cleanData.settings) this.data.settings = { ...this.data.settings, ...cleanData.settings };
        
        // ✅ PERUBAHAN: Handle struktur kasir baru
        if (cleanData.kasir) {
            if (cleanData.kasir.activeShifts) {
                this.data.kasir = cleanData.kasir;
            } else {
                // Migrate dari struktur lama
                this.data.kasir = {
                    isOpen: cleanData.kasir.isOpen || false,
                    activeShifts: cleanData.kasir.isOpen && cleanData.kasir.currentUser ? [{
                        userId: cleanData.kasir.currentUser,
                        userName: cleanData.kasir.userName || 'Unknown',
                        userRole: cleanData.kasir.userRole || 'kasir',
                        openTime: cleanData.kasir.openTime,
                        modalAwal: cleanData.settings?.modalAwal || 0,
                        currentCash: cleanData.settings?.modalAwal || 0
                    }] : [],
                    date: cleanData.kasir.date,
                    lastCheckDate: cleanData.kasir.lastCheckDate
                };
            }
        }
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
        const currentUser = this.getCurrentUser();
        if (currentUser && currentUser.userId === userId) {
            console.error('[DataManager] Cannot delete currently logged in user');
            return false;
        }
        
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
        
        if (!username || !password) {
            return { success: false, message: 'Username dan password wajib diisi!' };
        }
        
        const users = this.getUsers();
        
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
        // ✅ PERUBAHAN: Tutup shift user ini saat logout
        const currentUser = this.getCurrentUser();
        if (currentUser) {
            this.closeKasir(currentUser.userId);
        }
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
        
        const users = this.getUsers();
        const userIndex = users.findIndex(u => u.id === userId);
        if (userIndex !== -1) {
            users[userIndex].lastLogin = loginRecord.timestamp;
            this.saveUsers(users);
        }
        
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
        
        history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
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

    getAllLoginHistoryForBackup() {
        const data = this.getData();
        return data.loginHistory || [];
    },

    restoreLoginHistory(loginHistory) {
        const data = this.getData();
        data.loginHistory = loginHistory || [];
        this.saveData(data);
    },

    // ========== KASIR MANAGEMENT - MULTI USER ==========
    
    // ✅ PERUBAHAN: Check status kasir untuk user tertentu
    checkKasirStatusForUser(userId) {
        const today = new Date().toDateString();
        this.checkAutoCloseMidnight();
        
        // Cek apakah user sudah punya shift aktif
        const userShift = this.data.kasir.activeShifts.find(s => s.userId === userId);
        
        if (userShift) {
            const shiftDate = new Date(userShift.openTime).toDateString();
            if (shiftDate === today) {
                return { 
                    canOpen: false, 
                    shouldReset: false, 
                    reason: 'already_open_same_user', 
                    message: 'Anda sudah memiliki shift aktif hari ini. Lanjutkan shift.' 
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
        
        // User belum punya shift, bisa buka kasir baru
        return { 
            canOpen: true, 
            shouldReset: true, 
            reason: 'new_shift',
            message: 'Buka kasir untuk memulai shift baru.' 
        };
    },

    // ✅ PERUBAHAN: Buka kasir untuk user tertentu dengan pending modal support
    openKasir(userId, forceReset = false) {
        const today = new Date().toDateString();
        const status = this.checkKasirStatusForUser(userId);
        const users = this.getUsers();
        const user = users.find(u => u.id === userId);
        
        if (!user) {
            return { success: false, message: 'User tidak ditemukan!' };
        }
        
        // Cek apakah user sudah punya shift aktif hari ini
        const existingShiftIndex = this.data.kasir.activeShifts.findIndex(s => s.userId === userId);
        
        if (existingShiftIndex !== -1) {
            const existingShift = this.data.kasir.activeShifts[existingShiftIndex];
            const shiftDate = new Date(existingShift.openTime).toDateString();
            
            if (shiftDate === today) {
                // Update last active time
                this.data.kasir.activeShifts[existingShiftIndex].lastActive = new Date().toISOString();
                this.save();
                return { 
                    success: true, 
                    reset: false, 
                    message: 'Selamat datang kembali! Shift Anda dilanjutkan.' 
                };
            }
        }
        
        // ✅ BARU: Cek pending modal dari owner
        let modalAwal = 0;
        if (this.data.pendingModals && this.data.pendingModals[userId]) {
            modalAwal = this.data.pendingModals[userId];
            // Hapus pending modal setelah diterapkan
            delete this.data.pendingModals[userId];
        }
        
        // Buat shift baru
        const newShift = {
            userId: userId,
            userName: user.name,
            userRole: user.role,
            openTime: new Date().toISOString(),
            lastActive: new Date().toISOString(),
            modalAwal: modalAwal,
            currentCash: modalAwal, // ✅ Set currentCash sama dengan modalAwal
            transactionCount: 0,
            totalSales: 0
        };
        
        this.data.kasir.activeShifts.push(newShift);
        this.data.kasir.isOpen = true;
        this.data.kasir.date = today;
        
        this.save();
        
        return { 
            success: true, 
            reset: true, 
            message: modalAwal > 0 
                ? `Kasir dibuka! Modal awal: Rp ${modalAwal.toLocaleString('id-ID')}` 
                : 'Kasir dibuka! Shift baru dimulai.' 
        };
    },

    // ✅ PERUBAHAN: Tutup kasir untuk user tertentu
    closeKasir(userId) {
        const shiftIndex = this.data.kasir.activeShifts.findIndex(s => s.userId === userId);
        
        if (shiftIndex === -1) {
            return { success: false, message: 'Anda tidak memiliki shift aktif!' };
        }
        
        const shift = this.data.kasir.activeShifts[shiftIndex];
        this.saveShiftHistory(shift);
        
        // Hapus shift dari active shifts
        this.data.kasir.activeShifts.splice(shiftIndex, 1);
        
        // Update global status
        if (this.data.kasir.activeShifts.length === 0) {
            this.data.kasir.isOpen = false;
        }
        
        this.save();
        return { success: true, message: 'Kasir ditutup. Shift berakhir. Data tersimpan.' };
    },

    // ✅ PERUBAHAN: Save shift history untuk satu shift
    saveShiftHistory(shift) {
        if (!this.data.shiftHistory) this.data.shiftHistory = [];
        
        const today = new Date().toDateString();
        const dayTrans = this.data.transactions.filter(t => {
            const tDate = new Date(t.date).toDateString();
            return tDate === today && 
                   t.status !== 'voided' && 
                   t.userId === shift.userId; // Hanya transaksi dari user ini
        });

        const shiftSummary = {
            date: today,
            userId: shift.userId,
            userName: shift.userName,
            userRole: shift.userRole,
            openTime: shift.openTime,
            closeTime: new Date().toISOString(),
            totalSales: dayTrans.reduce((sum, t) => sum + (t.total || 0), 0),
            totalProfit: dayTrans.reduce((sum, t) => sum + (t.profit || 0), 0),
            transactionCount: dayTrans.length,
            modalAwal: shift.modalAwal,
            cashEnd: shift.currentCash
        };

        // Cek apakah sudah ada history untuk user ini hari ini
        const existingIndex = this.data.shiftHistory.findIndex(s => 
            s.date === today && s.userId === shift.userId
        );
        
        if (existingIndex !== -1) {
            this.data.shiftHistory[existingIndex] = shiftSummary;
        } else {
            this.data.shiftHistory.push(shiftSummary);
        }
        
        this.save();
    },

    // ✅ BARU: Get shift untuk user tertentu
    getUserShift(userId) {
        return this.data.kasir.activeShifts.find(s => s.userId === userId) || null;
    },

    // ✅ BARU: Update kasir data untuk user tertentu
    updateUserShift(userId, updates) {
        const shiftIndex = this.data.kasir.activeShifts.findIndex(s => s.userId === userId);
        if (shiftIndex !== -1) {
            this.data.kasir.activeShifts[shiftIndex] = {
                ...this.data.kasir.activeShifts[shiftIndex],
                ...updates,
                lastActive: new Date().toISOString()
            };
            this.save();
            return true;
        }
        return false;
    },

    // ✅ BARU: Get semua active shifts
    getActiveShifts() {
        return this.data.kasir.activeShifts || [];
    },

    // ✅ BARU: Get transactions untuk user tertentu (hanya hari ini)
    getUserTransactions(userId, date = new Date()) {
        const targetDate = new Date(date).toDateString();
        return this.data.transactions.filter(t => {
            const tDate = new Date(t.date).toDateString();
            return tDate === targetDate && 
                   t.status !== 'deleted' && 
                   t.status !== 'voided' &&
                   t.userId === userId;
        });
    },

    // ✅ BARU: Get transactions untuk owner/admin (semua user hari ini)
    getAllTodayTransactions(date = new Date()) {
        const targetDate = new Date(date).toDateString();
        return this.data.transactions.filter(t => {
            const tDate = new Date(t.date).toDateString();
            return tDate === targetDate && 
                   t.status !== 'deleted' && 
                   t.status !== 'voided';
        });
    },
    
    // ========== STATS HELPERS ==========
    
    // ✅ PERUBAHAN: Get stats untuk user tertentu
    getTodayStats(userId = null) {
        const today = new Date().toDateString();
        
        let todayTrans;
        if (userId) {
            todayTrans = this.getUserTransactions(userId);
        } else {
            todayTrans = this.getAllTodayTransactions();
        }
        
        return {
            transactionCount: todayTrans.length,
            totalSales: todayTrans.reduce((sum, t) => sum + (t.total || 0), 0),
            totalProfit: todayTrans.reduce((sum, t) => sum + (t.profit || 0), 0)
        };
    },

    // ✅ BARU: Get stats per user untuk owner/admin
    getTodayStatsPerUser() {
        const today = new Date().toDateString();
        const users = this.getUsers();
        const stats = {};
        
        users.forEach(user => {
            const userTrans = this.getUserTransactions(user.id);
            stats[user.id] = {
                userId: user.id,
                userName: user.name,
                userRole: user.role,
                transactionCount: userTrans.length,
                totalSales: userTrans.reduce((sum, t) => sum + (t.total || 0), 0),
                totalProfit: userTrans.reduce((sum, t) => sum + (t.profit || 0), 0)
            };
        });
        
        return stats;
    }
};

// Inisialisasi
if (typeof dataManager !== 'undefined') {
    try {
        dataManager.init();
        console.log('[DataManager] Initialized successfully');
    } catch (e) {
        console.error('[DataManager] Initialization error:', e);
    }
}

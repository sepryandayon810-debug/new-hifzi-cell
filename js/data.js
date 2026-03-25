// ============================================
// DATA MANAGER - Hifzi Cell POS (FIXED VERSION)
// ============================================

const dataManager = {
    STORAGE_KEY: 'hifzi_data',
    USERS_KEY: 'hifzi_users',
    CURRENT_USER_KEY: 'hifzi_current_user',
    
    // Default data structure
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
        pendingModals: {},
        pendingExtraModals: {},
        
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
            activeShifts: [],
            date: null,
            lastCheckDate: null
        }
    },
    
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

    init() {
        console.log('[DataManager] Initializing...');
        
        // Load from localStorage
        const saved = localStorage.getItem(this.STORAGE_KEY);
        
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Deep merge dengan default structure
                this.data = this.deepMerge(this.data, parsed);
                console.log('[DataManager] Data loaded from localStorage');
            } catch (e) {
                console.error('[DataManager] Error parsing saved data:', e);
                this.createDefaultData();
            }
        } else {
            console.log('[DataManager] No saved data, using defaults');
        }
        
        // Ensure all required fields exist
        this.ensureDataStructure();
        
        // Check auto close midnight
        this.checkAutoCloseMidnight();
        
        // Initialize users
        this.initUsers();
        
        // Save to ensure consistency
        this.save();
        
        console.log('[DataManager] Initialized successfully');
        console.log('[DataManager] Current pendingModals:', this.data.pendingModals);
        console.log('[DataManager] Current pendingExtraModals:', this.data.pendingExtraModals);
        
        return this.data;
    },

    ensureDataStructure() {
        // Ensure kasir structure
        if (!this.data.kasir) {
            this.data.kasir = {
                isOpen: false,
                activeShifts: [],
                date: null,
                lastCheckDate: null
            };
        }
        
        // Ensure activeShifts is array
        if (!Array.isArray(this.data.kasir.activeShifts)) {
            this.data.kasir.activeShifts = [];
        }
        
        // Ensure pending modals exist - INISIALISASI PENTING!
        if (!this.data.pendingModals) {
            this.data.pendingModals = {};
        }
        if (!this.data.pendingExtraModals) {
            this.data.pendingExtraModals = {};
        }
        
        // Ensure settings exist
        if (!this.data.settings) {
            this.data.settings = {
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
            };
        }
        
        // Ensure arrays exist
        if (!this.data.cashTransactions) this.data.cashTransactions = [];
        if (!this.data.debts) this.data.debts = [];
        if (!this.data.shiftHistory) this.data.shiftHistory = [];
        if (!this.data.loginHistory) this.data.loginHistory = [];
    },

    initUsers() {
        let users = JSON.parse(localStorage.getItem(this.USERS_KEY));
        
        if (!users || !Array.isArray(users) || users.length === 0) {
            users = [...this.defaultUsers];
            localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
            console.log('[DataManager] Default users created');
        } else {
            // Ensure owner exists
            const ownerExists = users.some(u => u.role === 'owner');
            if (!ownerExists) {
                console.log('[DataManager] Owner not found, creating default owner');
                users.unshift(this.defaultUsers[0]);
                localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
            }
            
            // Remove duplicates
            const uniqueUsers = [];
            const seenUsernames = new Set();
            for (const user of users) {
                if (!seenUsernames.has(user.username)) {
                    seenUsernames.add(user.username);
                    uniqueUsers.push(user);
                }
            }
            if (uniqueUsers.length !== users.length) {
                localStorage.setItem(this.USERS_KEY, JSON.stringify(uniqueUsers));
            }
        }
    },

    createDefaultData() {
        this.data = {
            users: this.defaultUsers,
            loginHistory: [],
            categories: this.data.categories,
            products: [],
            transactions: [],
            cashTransactions: [],
            debts: [],
            shiftHistory: [],
            pendingModals: {},
            pendingExtraModals: {},
            settings: this.data.settings,
            kasir: {
                isOpen: false,
                activeShifts: [],
                date: null,
                lastCheckDate: null
            }
        };
        this.save();
        return this.data;
    },

    checkAutoCloseMidnight() {
        const now = new Date();
        const today = now.toDateString();
        
        if (this.data.kasir.activeShifts && this.data.kasir.activeShifts.length > 0) {
            const shiftsToClose = this.data.kasir.activeShifts.filter(shift => {
                const shiftDate = new Date(shift.openTime).toDateString();
                return shiftDate !== today;
            });
            
            if (shiftsToClose.length > 0) {
                console.log('[AutoClose] Closing', shiftsToClose.length, 'shifts from previous days');
                shiftsToClose.forEach(shift => {
                    this.saveShiftHistory(shift);
                });
                
                this.data.kasir.activeShifts = this.data.kasir.activeShifts.filter(shift => {
                    const shiftDate = new Date(shift.openTime).toDateString();
                    return shiftDate === today;
                });
                
                if (this.data.kasir.activeShifts.length === 0) {
                    this.data.kasir.isOpen = false;
                }
                this.data.kasir.date = today;
            }
        }
        this.data.kasir.lastCheckDate = today;
    },

    save() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
            console.log('[DataManager] Data saved to localStorage');
            
            // Trigger cloud sync if available
            if (typeof backupModule !== 'undefined' && backupModule.shouldSync && backupModule.shouldSync()) {
                console.log('[DataManager] Triggering cloud sync...');
                backupModule.syncToCloud(this.getAllData());
            }
        } catch (e) {
            console.error('[DataManager] Error saving data:', e);
        }
    },

    saveData(data) {
        if (data) {
            this.data = this.deepMerge(this.data, data);
            this.save();
        }
    },

    getData() { return this.data; },

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
            pendingExtraModals: this.data.pendingExtraModals || {},
            settings: this.data.settings || {},
            kasir: this.data.kasir || {},
            _meta: { 
                lastModified: new Date().toISOString(), 
                deviceId: typeof backupModule !== 'undefined' ? backupModule.deviceId : 'unknown', 
                version: '2.3'
            }
        };
    },

    saveAllData(cloudData) {
        const { _meta, ...cleanData } = cloudData;
        
        // Merge cloud data dengan existing
        if (cleanData.categories) this.data.categories = cleanData.categories;
        if (cleanData.products) this.data.products = cleanData.products;
        if (cleanData.transactions) this.data.transactions = cleanData.transactions;
        if (cleanData.cashTransactions) this.data.cashTransactions = cleanData.cashTransactions;
        if (cleanData.debts) this.data.debts = cleanData.debts;
        if (cleanData.shiftHistory) this.data.shiftHistory = cleanData.shiftHistory;
        if (cleanData.loginHistory) this.data.loginHistory = cleanData.loginHistory;
        if (cleanData.pendingModals) this.data.pendingModals = cleanData.pendingModals;
        if (cleanData.pendingExtraModals) this.data.pendingExtraModals = cleanData.pendingExtraModals;
        if (cleanData.settings) this.data.settings = { ...this.data.settings, ...cleanData.settings };
        
        if (cleanData.kasir) {
            this.data.kasir = cleanData.kasir;
        }
        
        this.save();
        console.log('[DataManager] Data restored from cloud');
    },

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

    // ==================== PRODUCTS ====================
    getProducts() { return this.data.products; },
    getCategories() { return this.data.categories; },
    
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

    // ==================== TRANSACTIONS ====================
    getTransactions() { return this.data.transactions; },
    
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

    // ==================== USERS ====================
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

    // ==================== AUTH ====================
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

    recordLogin(userId) {
        if (!this.data.loginHistory) this.data.loginHistory = [];
        
        const deviceInfo = navigator.userAgent.substring(0, 100);
        
        const loginRecord = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2),
            userId: userId,
            timestamp: new Date().toISOString(),
            deviceInfo: deviceInfo,
            ipAddress: 'Local Device',
            status: 'success'
        };
        
        this.data.loginHistory.push(loginRecord);
        
        const users = this.getUsers();
        const userIndex = users.findIndex(u => u.id === userId);
        if (userIndex !== -1) {
            users[userIndex].lastLogin = loginRecord.timestamp;
            this.saveUsers(users);
        }
        
        // Keep only last 6 months
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 180);
        this.data.loginHistory = this.data.loginHistory.filter(log => 
            new Date(log.timestamp) >= sixMonthsAgo
        );
        
        this.save();
        return loginRecord;
    },

    getLoginHistory(filters = {}) {
        let history = this.data.loginHistory || [];
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

    // ==================== KASIR / SHIFT ====================
    checkKasirStatusForUser(userId) {
        const today = new Date().toDateString();
        this.checkAutoCloseMidnight();
        
        const userShift = this.data.kasir.activeShifts.find(s => s.userId === userId);
        
        if (userShift) {
            const shiftDate = new Date(userShift.openTime).toDateString();
            
            if (shiftDate === today) {
                return { 
                    canOpen: false,
                    shouldReset: false, 
                    isContinue: true,
                    reason: 'continue_today', 
                    message: 'Shift hari ini masih aktif. Melanjutkan...' 
                };
            } else {
                return { 
                    canOpen: true, 
                    shouldReset: true, 
                    isContinue: false,
                    reason: 'new_day', 
                    message: 'Hari baru terdeteksi. Silakan buka kasir untuk shift baru.' 
                };
            }
        }
        
        return { 
            canOpen: true, 
            shouldReset: true, 
            isContinue: false,
            reason: 'new_shift',
            message: 'Buka kasir untuk memulai shift baru.' 
        };
    },

    // ==================== PENDING MODALS METHODS ====================
    
    /**
     * Set pending modal untuk user (dipanggil oleh Owner)
     */
    setPendingModal(userId, modalAmount) {
        console.log(`[setPendingModal] Setting modal for ${userId}: Rp ${modalAmount}`);
        
        // Pastikan pendingModals ada
        if (!this.data.pendingModals) {
            this.data.pendingModals = {};
        }
        
        // Jika user sudah punya shift aktif, update langsung
        const existingShift = this.getUserShift(userId);
        if (existingShift) {
            console.log(`[setPendingModal] User ${userId} has active shift, updating directly`);
            return this.updateUserShift(userId, { modalAwal: parseInt(modalAmount) || 0 });
        }
        
        // Jika belum punya shift, simpan ke pendingModals
        this.data.pendingModals[userId] = parseInt(modalAmount) || 0;
        this.save();
        
        console.log(`[setPendingModal] Saved pending modal for ${userId}: Rp ${this.data.pendingModals[userId]}`);
        console.log(`[setPendingModal] Current pendingModals:`, JSON.parse(JSON.stringify(this.data.pendingModals)));
        
        return true;
    },

    /**
     * Set pending extra modal untuk user (dipanggil oleh Admin)
     */
    setPendingExtraModal(userId, extraModalAmount) {
        console.log(`[setPendingExtraModal] Setting extra modal for ${userId}: Rp ${extraModalAmount}`);
        
        // Pastikan pendingExtraModals ada
        if (!this.data.pendingExtraModals) {
            this.data.pendingExtraModals = {};
        }
        
        // Jika user sudah punya shift aktif, update langsung
        const existingShift = this.getUserShift(userId);
        if (existingShift) {
            console.log(`[setPendingExtraModal] User ${userId} has active shift, adding extra modal directly`);
            const newExtraModal = (existingShift.extraModal || 0) + parseInt(extraModalAmount);
            return this.updateUserShift(userId, { extraModal: newExtraModal });
        }
        
        // Jika belum punya shift, tambahkan ke pending
        this.data.pendingExtraModals[userId] = (this.data.pendingExtraModals[userId] || 0) + parseInt(extraModalAmount);
        this.save();
        
        console.log(`[setPendingExtraModal] Saved pending extra modal for ${userId}: Rp ${this.data.pendingExtraModals[userId]}`);
        
        return true;
    },

    /**
     * Get pending modal untuk user
     */
    getPendingModal(userId) {
        if (!this.data.pendingModals) {
            this.data.pendingModals = {};
            return 0;
        }
        return this.data.pendingModals[userId] || 0;
    },

    /**
     * Get pending extra modal untuk user
     */
    getPendingExtraModal(userId) {
        if (!this.data.pendingExtraModals) {
            this.data.pendingExtraModals = {};
            return 0;
        }
        return this.data.pendingExtraModals[userId] || 0;
    },

    /**
     * Clear pending modal setelah diambil
     */
    clearPendingModal(userId) {
        if (this.data.pendingModals && this.data.pendingModals[userId] !== undefined) {
            delete this.data.pendingModals[userId];
            this.save();
            console.log(`[clearPendingModal] Cleared pending modal for ${userId}`);
        }
    },

    /**
     * Clear pending extra modal setelah diambil
     */
    clearPendingExtraModal(userId) {
        if (this.data.pendingExtraModals && this.data.pendingExtraModals[userId] !== undefined) {
            delete this.data.pendingExtraModals[userId];
            this.save();
            console.log(`[clearPendingExtraModal] Cleared pending extra modal for ${userId}`);
        }
    },

    openKasir(userId, forceReset = false) {
        const today = new Date().toDateString();
        const status = this.checkKasirStatusForUser(userId);
        const users = this.getUsers();
        const user = users.find(u => u.id === userId);
        
        if (!user) {
            return { success: false, message: 'User tidak ditemukan!' };
        }
        
        console.log(`[openKasir] Opening kasir for ${user.name} (${user.role})`);
        console.log(`[openKasir] Current pendingModals:`, JSON.parse(JSON.stringify(this.data.pendingModals || {})));
        console.log(`[openKasir] Current pendingExtraModals:`, JSON.parse(JSON.stringify(this.data.pendingExtraModals || {})));
        
        // Jika shift hari ini masih aktif, lanjutkan saja
        if (status.isContinue && !forceReset) {
            const existingShiftIndex = this.data.kasir.activeShifts.findIndex(s => s.userId === userId);
            if (existingShiftIndex !== -1) {
                this.data.kasir.activeShifts[existingShiftIndex].lastActive = new Date().toISOString();
                
                // Hitung ulang cash
                const shift = this.data.kasir.activeShifts[existingShiftIndex];
                const totalModal = (shift.modalAwal || 0) + (shift.extraModal || 0);
                const recalculatedCash = this.calculateShiftCash(userId, totalModal);
                
                if (recalculatedCash !== shift.currentCash) {
                    this.data.kasir.activeShifts[existingShiftIndex].currentCash = recalculatedCash;
                }
                
                this.save();
                
                return { 
                    success: true, 
                    reset: false, 
                    isContinue: true,
                    message: `Shift dilanjutkan. Modal: Rp ${(totalModal).toLocaleString('id-ID')}` 
                };
            }
        }
        
        // Cek apakah user sudah punya shift aktif (hari sebelumnya)
        const existingShiftIndex = this.data.kasir.activeShifts.findIndex(s => s.userId === userId);
        
        if (existingShiftIndex !== -1) {
            const existingShift = this.data.kasir.activeShifts[existingShiftIndex];
            const shiftDate = new Date(existingShift.openTime).toDateString();
            
            // Jika hari sama dan tidak force reset, lanjutkan shift
            if (shiftDate === today && !forceReset) {
                this.data.kasir.activeShifts[existingShiftIndex].lastActive = new Date().toISOString();
                
                const totalModal = (existingShift.modalAwal || 0) + (existingShift.extraModal || 0);
                const recalculatedCash = this.calculateShiftCash(userId, totalModal);
                this.data.kasir.activeShifts[existingShiftIndex].currentCash = recalculatedCash;
                
                this.save();
                return { 
                    success: true, 
                    reset: false, 
                    isContinue: true,
                    message: `Shift dilanjutkan. Modal: Rp ${(totalModal).toLocaleString('id-ID')}` 
                };
            }
            
            // Jika hari berbeda, simpan history
            if (shiftDate !== today) {
                this.saveShiftHistory(existingShift);
            }
            
            this.data.kasir.activeShifts.splice(existingShiftIndex, 1);
        }
        
        // ============================================
        // INISIALISASI MODAL - PERBAIKAN UTAMA DI SINI
        // ============================================
        
        let modalAwal = 0;
        let extraModal = 0;
        
        // 1. Cek pending modal dari Owner (gunakan method getPendingModal)
        const pendingModal = this.getPendingModal(userId);
        if (pendingModal > 0) {
            modalAwal = pendingModal;
            console.log(`[openKasir] Found pending modal for ${user.name}: Rp ${modalAwal}`);
            
            // Hapus dari pending setelah diambil
            this.clearPendingModal(userId);
        }
        
        // 2. Cek pending extra modal dari Admin (gunakan method getPendingExtraModal)
        const pendingExtra = this.getPendingExtraModal(userId);
        if (pendingExtra > 0) {
            extraModal = pendingExtra;
            console.log(`[openKasir] Found pending extra modal for ${user.name}: Rp ${extraModal}`);
            
            // Hapus dari pending setelah diambil
            this.clearPendingExtraModal(userId);
        }
        
        // 3. Jika tidak ada pending modal, gunakan default berdasarkan role
        if (modalAwal === 0 && extraModal === 0) {
            if (user.role === 'owner') {
                modalAwal = parseInt(this.data.settings?.modalAwal) || 0;
                console.log(`[openKasir] Owner using default modal: Rp ${modalAwal}`);
            } else {
                console.log(`[openKasir] No pending modal found for ${user.name}, starting with 0`);
            }
        }
        
        const totalModal = modalAwal + extraModal;
        
        // Hitung currentCash awal
        const initialCash = this.calculateShiftCash(userId, totalModal);
        
        // Buat shift baru
        const newShift = {
            userId: userId,
            userName: user.name,
            userRole: user.role,
            openTime: new Date().toISOString(),
            lastActive: new Date().toISOString(),
            modalAwal: modalAwal,
            extraModal: extraModal,
            currentCash: initialCash,
            transactionCount: 0,
            totalSales: 0
        };
        
        this.data.kasir.activeShifts.push(newShift);
        this.data.kasir.isOpen = true;
        this.data.kasir.date = today;
        
        // Update settings.currentCash untuk owner/admin
        if (user.role === 'owner' || user.role === 'admin') {
            this.data.settings.currentCash = initialCash;
        }
        
        // SAVE PERUBAHAN
        this.save();
        
        console.log(`[openKasir] Shift created for ${user.name} with modal: Rp ${totalModal}, cash: Rp ${initialCash}`);
        
        return { 
            success: true, 
            reset: true, 
            isContinue: false,
            message: totalModal > 0 
                ? `Kasir dibuka! Modal: Rp ${totalModal.toLocaleString('id-ID')}` 
                : 'Kasir dibuka! Modal belum diatur (hubungi Owner).' 
        };
    },

    calculateShiftCash(userId, modalAwal) {
        const today = new Date().toDateString();
        let cash = parseInt(modalAwal) || 0;
        
        // Ambil semua transaksi kas hari ini untuk user ini
        const todayCashTrans = this.data.cashTransactions.filter(t => {
            const tDate = new Date(t.date).toDateString();
            return tDate === today && t.userId === userId;
        });
        
        // Hitung dari transaksi kas
        todayCashTrans.forEach(t => {
            const amount = parseInt(t.amount) || 0;
            if (t.type === 'in' || t.type === 'modal_in' || t.type === 'topup') {
                cash += amount;
            } else if (t.type === 'out') {
                cash -= amount;
            }
        });
        
        // Ambil transaksi POS hari ini untuk user ini
        const todayPosTrans = this.data.transactions.filter(t => {
            const tDate = new Date(t.date).toDateString();
            return tDate === today && 
                   t.userId === userId && 
                   t.status !== 'voided' &&
                   t.paymentMethod === 'cash';
        });
        
        // Tambahkan penjualan tunai
        todayPosTrans.forEach(t => {
            cash += parseInt(t.total) || 0;
        });
        
        return cash;
    },

    closeKasir(userId) {
        const shiftIndex = this.data.kasir.activeShifts.findIndex(s => s.userId === userId);
        
        if (shiftIndex === -1) {
            return { success: false, message: 'Anda tidak memiliki shift aktif!' };
        }
        
        const shift = this.data.kasir.activeShifts[shiftIndex];
        this.saveShiftHistory(shift);
        
        this.data.kasir.activeShifts.splice(shiftIndex, 1);
        
        if (this.data.kasir.activeShifts.length === 0) {
            this.data.kasir.isOpen = false;
        }
        
        this.save();
        return { success: true, message: 'Kasir ditutup. Shift berakhir. Data tersimpan.' };
    },

    saveShiftHistory(shift) {
        if (!this.data.shiftHistory) this.data.shiftHistory = [];
        
        const today = new Date().toDateString();
        const dayTrans = this.data.transactions.filter(t => {
            const tDate = new Date(t.date).toDateString();
            return tDate === today && 
                   t.status !== 'voided' && 
                   t.userId === shift.userId;
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
            extraModal: shift.extraModal || 0,
            cashEnd: shift.currentCash
        };

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

    getUserShift(userId) {
        const shift = this.data.kasir.activeShifts.find(s => s.userId === userId);
        if (!shift) return null;
        
        return {
            userId: shift.userId,
            userName: shift.userName,
            userRole: shift.userRole,
            openTime: shift.openTime,
            lastActive: shift.lastActive || shift.openTime,
            modalAwal: shift.modalAwal || 0,
            extraModal: shift.extraModal || 0,
            currentCash: shift.currentCash || 0,
            transactionCount: shift.transactionCount || 0,
            totalSales: shift.totalSales || 0
        };
    },

    updateUserShift(userId, updates) {
        const shiftIndex = this.data.kasir.activeShifts.findIndex(s => s.userId === userId);
        if (shiftIndex !== -1) {
            this.data.kasir.activeShifts[shiftIndex] = {
                ...this.data.kasir.activeShifts[shiftIndex],
                ...updates,
                lastActive: new Date().toISOString()
            };
            
            // Jika modal berubah, hitung ulang currentCash
            if (updates.modalAwal !== undefined || updates.extraModal !== undefined) {
                const shift = this.data.kasir.activeShifts[shiftIndex];
                const totalModal = (shift.modalAwal || 0) + (shift.extraModal || 0);
                const newCash = this.calculateShiftCash(userId, totalModal);
                this.data.kasir.activeShifts[shiftIndex].currentCash = newCash;
            }
            
            this.save();
            return true;
        }
        return false;
    },

    debugPendingModals() {
        console.log('=== DEBUG PENDING MODALS ===');
        console.log('pendingModals:', JSON.parse(JSON.stringify(this.data.pendingModals || {})));
        console.log('pendingExtraModals:', JSON.parse(JSON.stringify(this.data.pendingExtraModals || {})));
        console.log('activeShifts:', this.data.kasir.activeShifts);
        console.log('===========================');
        return {
            pendingModals: this.data.pendingModals,
            pendingExtraModals: this.data.pendingExtraModals,
            activeShifts: this.data.kasir.activeShifts
        };
    },

    getActiveShifts() {
        return this.data.kasir.activeShifts || [];
    },

    // ==================== STATS ====================
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

    getAllTodayTransactions(date = new Date()) {
        const targetDate = new Date(date).toDateString();
        return this.data.transactions.filter(t => {
            const tDate = new Date(t.date).toDateString();
            return tDate === targetDate && 
                   t.status !== 'deleted' && 
                   t.status !== 'voided';
        });
    },
    
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
    },

    recalculateAllShifts() {
        if (!this.data.kasir.activeShifts) return;
        
        this.data.kasir.activeShifts.forEach((shift, index) => {
            const totalModal = (shift.modalAwal || 0) + (shift.extraModal || 0);
            const newCash = this.calculateShiftCash(shift.userId, totalModal);
            
            if (newCash !== shift.currentCash) {
                this.data.kasir.activeShifts[index].currentCash = newCash;
                console.log(`[DataManager] Recalculated shift for ${shift.userName}: ${shift.currentCash} -> ${newCash}`);
            }
        });
        
        this.save();
    }
};

// Initialize immediately
if (typeof dataManager !== 'undefined') {
    try {
        dataManager.init();
        console.log('[DataManager] Initialized successfully');
    } catch (e) {
        console.error('[DataManager] Initialization error:', e);
    }
}

// Expose to window
window.dataManager = dataManager;

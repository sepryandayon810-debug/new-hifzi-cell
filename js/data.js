// ============================================
// DATA MANAGER - Hifzi Cell POS
// ============================================

const dataManager = {
    STORAGE_KEY: 'hifzi_data',
    USERS_KEY: 'hifzi_users',
    CURRENT_USER_KEY: 'hifzi_current_user',
    
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
        
        // ✅ PENDING MODALS - Modal yang diatur Owner untuk user yang belum buka shift
        pendingModals: {},
        // ✅ PENDING EXTRA MODALS - Modal tambahan dari Admin untuk kasir
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
        const saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            this.data = this.deepMerge(this.data, parsed);
        }
        
        if (!this.data.kasir) {
            this.data.kasir = { 
                isOpen: false, 
                activeShifts: [],
                date: null,
                lastCheckDate: null
            };
        }
        
        // Pastikan struktur activeShifts benar
        if (!Array.isArray(this.data.kasir.activeShifts)) {
            this.data.kasir.activeShifts = [];
        }
        
        // Konversi format lama ke format baru jika perlu
        if (this.data.kasir.currentUser !== undefined && !this.data.kasir.activeShifts) {
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

        if (!this.data.pendingModals) {
            this.data.pendingModals = {};
        }
        
        if (!this.data.pendingExtraModals) {
            this.data.pendingExtraModals = {};
        }

        if (!this.data.loginHistory) this.data.loginHistory = [];
        if (!this.data.settings.phone) this.data.settings.phone = '';
        if (this.data.settings.tax === undefined) this.data.settings.tax = 0;

        // Cek auto close hanya jika hari berbeda
        this.checkAutoCloseMidnight();
        
        this.initUsers();
        
        this.save();
        return this.data;
    },

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
            pendingExtraModals: {},
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

    checkAutoCloseMidnight() {
        const now = new Date();
        const today = now.toDateString();
        
        // Hanya tutup shift jika hari benar-benar berbeda
        if (this.data.kasir.activeShifts && this.data.kasir.activeShifts.length > 0) {
            const shiftsToClose = this.data.kasir.activeShifts.filter(shift => {
                const shiftDate = new Date(shift.openTime).toDateString();
                return shiftDate !== today; // Hanya tutup jika hari berbeda
            });
            
            if (shiftsToClose.length > 0) {
                console.log('[AutoClose] Menutup', shiftsToClose.length, 'shift karena sudah lewat jam 12 malam');
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
                this.save();
                return true;
            }
        }
        this.data.kasir.lastCheckDate = today;
        return false;
    },

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
                version: '2.2'
            }
        };
    },

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
        if (cleanData.pendingExtraModals) this.data.pendingExtraModals = cleanData.pendingExtraModals;
        if (cleanData.settings) this.data.settings = { ...this.data.settings, ...cleanData.settings };
        
        if (cleanData.kasir) {
            if (cleanData.kasir.activeShifts) {
                this.data.kasir = cleanData.kasir;
            } else {
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
        const currentUser = this.getCurrentUser();
        if (currentUser) {
            // ✅ JANGAN tutup kasir saat logout, biarkan shift tetap aktif
            // this.closeKasir(currentUser.userId);
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

    // ✅ PERBAIKAN UTAMA: openKasir - Terapkan pending modal saat buka shift
    openKasir(userId, forceReset = false) {
        const today = new Date().toDateString();
        const status = this.checkKasirStatusForUser(userId);
        const users = this.getUsers();
        const user = users.find(u => u.id === userId);
        
        if (!user) {
            return { success: false, message: 'User tidak ditemukan!' };
        }
        
        // ✅ PERBAIKAN: Jika shift hari ini masih aktif, lanjutkan dengan data yang ada
        if (status.isContinue && !forceReset) {
            const existingShiftIndex = this.data.kasir.activeShifts.findIndex(s => s.userId === userId);
            if (existingShiftIndex !== -1) {
                // Update lastActive saja, jangan ubah modal atau currentCash
                this.data.kasir.activeShifts[existingShiftIndex].lastActive = new Date().toISOString();
                this.save();
                
                const shift = this.data.kasir.activeShifts[existingShiftIndex];
                
                // ✅ Hitung ulang currentCash dari modal + transaksi hari ini
                const totalModal = (shift.modalAwal || 0) + (shift.extraModal || 0);
                const recalculatedCash = this.calculateShiftCash(userId, totalModal);
                
                // Update currentCash jika berbeda (untuk sinkronisasi)
                if (recalculatedCash !== shift.currentCash) {
                    this.data.kasir.activeShifts[existingShiftIndex].currentCash = recalculatedCash;
                    this.save();
                }
                
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
            
            // ✅ Jika hari sama dan tidak force reset, lanjutkan shift
            if (shiftDate === today && !forceReset) {
                this.data.kasir.activeShifts[existingShiftIndex].lastActive = new Date().toISOString();
                
                // ✅ Hitung ulang currentCash dari transaksi
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
        
        // ✅ PERBAIKAN UTAMA: Cek pending modal dari Owner untuk user ini
        // Inisialisasi default modal
        let modalAwal = 0;
        let extraModal = 0;
        
        // ✅ CEK PENDING MODAL UTAMA DARI OWNER - PERBAIKAN UTAMA
        console.log(`[openKasir] Checking pendingModals for user ${userId}:`, this.data.pendingModals);
        
        if (this.data.pendingModals && this.data.pendingModals[userId]) {
            modalAwal = parseInt(this.data.pendingModals[userId]) || 0;
            console.log(`[openKasir] ✅ Found pending modal for ${user.name}: Rp ${modalAwal}`);
            
            // ✅ HAPUS dari pending setelah diambil - PENTING!
            delete this.data.pendingModals[userId];
            console.log(`[openKasir] ✅ Deleted pending modal for ${userId}`);
        } else {
            console.log(`[openKasir] No pending modal found for ${userId}`);
        }
        
        // ✅ CEK PENDING EXTRA MODAL DARI ADMIN
        if (this.data.pendingExtraModals && this.data.pendingExtraModals[userId]) {
            extraModal = parseInt(this.data.pendingExtraModals[userId]) || 0;
            console.log(`[openKasir] ✅ Found pending extra modal for ${user.name}: Rp ${extraModal}`);
            
            // Hapus dari pending setelah diambil
            delete this.data.pendingExtraModals[userId];
        }
        
        // ✅ JIKA TIDAK ADA PENDING MODAL, gunakan default berdasarkan role
        // Tapi untuk admin dan kasir, defaultnya 0 (harus diatur Owner dulu)
        if (modalAwal === 0 && extraModal === 0) {
            if (user.role === 'owner') {
                // Owner bisa gunakan modal dari settings sebagai default
                modalAwal = parseInt(this.data.settings?.modalAwal) || 0;
                console.log(`[openKasir] Owner using default modal: Rp ${modalAwal}`);
            }
            // Admin dan Kasir: tetap 0, harus diatur Owner dulu
        }
        
        const totalModal = modalAwal + extraModal;
        
        // ✅ Hitung currentCash awal = total modal + transaksi hari ini (jika ada)
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
            currentCash: initialCash, // ✅ Gunakan hasil perhitungan
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
        
        // ✅ SAVE PERUBAHAN (termasuk penghapusan pendingModals)
        this.save();
        
        console.log(`[openKasir] ✅ Shift created for ${user.name} with modal: Rp ${totalModal}, cash: Rp ${initialCash}`);
        
        return { 
            success: true, 
            reset: true, 
            isContinue: false,
            message: totalModal > 0 
                ? `Kasir dibuka! Modal: Rp ${totalModal.toLocaleString('id-ID')}` 
                : 'Kasir dibuka! Modal belum diatur (hubungi Owner).' 
        };
    },

    // ✅ FUNGSI BARU: Hitung cash shift dari modal + transaksi hari ini
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

    // ✅ PERBAIKAN UTAMA: getUserShift - Pastikan return data lengkap
    getUserShift(userId) {
        const shift = this.data.kasir.activeShifts.find(s => s.userId === userId);
        if (!shift) return null;
        
        // Pastikan semua field ada
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

    // ✅ PERBAIKAN UTAMA: updateUserShift - Update modal dan hitung ulang kas
    updateUserShift(userId, updates) {
        const shiftIndex = this.data.kasir.activeShifts.findIndex(s => s.userId === userId);
        if (shiftIndex !== -1) {
            // Merge updates
            this.data.kasir.activeShifts[shiftIndex] = {
                ...this.data.kasir.activeShifts[shiftIndex],
                ...updates,
                lastActive: new Date().toISOString()
            };
            
            // ✅ Jika modal berubah, hitung ulang currentCash
            if (updates.modalAwal !== undefined || updates.extraModal !== undefined) {
                const shift = this.data.kasir.activeShifts[shiftIndex];
                const totalModal = (shift.modalAwal || 0) + (shift.extraModal || 0);
                const newCash = this.calculateShiftCash(userId, totalModal);
                this.data.kasir.activeShifts[shiftIndex].currentCash = newCash;
                
                console.log(`[DataManager] Updated shift for ${shift.userName}: Modal=${totalModal}, Cash=${newCash}`);
            }
            
            this.save();
            return true;
        }
        return false;
    },

    // ✅ FUNGSI BARU: Set pending modal untuk user (dipanggil saat Owner mengatur modal)
    setPendingModal(userId, modalAmount) {
        if (!this.data.pendingModals) {
            this.data.pendingModals = {};
        }
        
        // ✅ Jika user sudah punya shift aktif, update langsung
        const existingShift = this.getUserShift(userId);
        if (existingShift) {
            console.log(`[DataManager] User ${userId} has active shift, updating directly`);
            return this.updateUserShift(userId, { modalAwal: modalAmount });
        }
        
        // Jika belum punya shift, simpan ke pending
        this.data.pendingModals[userId] = parseInt(modalAmount) || 0;
        this.save();
        console.log(`[DataManager] Saved pending modal for ${userId}: Rp ${this.data.pendingModals[userId]}`);
        return true;
    },

    // ✅ FUNGSI BARU: Set pending extra modal (dipanggil saat Admin bagi modal)
    setPendingExtraModal(userId, extraModalAmount) {
        if (!this.data.pendingExtraModals) {
            this.data.pendingExtraModals = {};
        }
        
        // ✅ Jika user sudah punya shift aktif, update langsung
        const existingShift = this.getUserShift(userId);
        if (existingShift) {
            console.log(`[DataManager] User ${userId} has active shift, adding extra modal directly`);
            const newExtraModal = (existingShift.extraModal || 0) + parseInt(extraModalAmount);
            return this.updateUserShift(userId, { extraModal: newExtraModal });
        }
        
        // Jika belum punya shift, tambahkan ke pending
        this.data.pendingExtraModals[userId] = (this.data.pendingExtraModals[userId] || 0) + parseInt(extraModalAmount);
        this.save();
        console.log(`[DataManager] Saved pending extra modal for ${userId}: Rp ${this.data.pendingExtraModals[userId]}`);
        return true;
    },

    // ✅ FUNGSI BARU: Hapus pending modal (jika diperlukan)
    clearPendingModal(userId) {
        if (this.data.pendingModals && this.data.pendingModals[userId]) {
            delete this.data.pendingModals[userId];
            this.save();
        }
    },

    // ✅ FUNGSI BARU: Hapus pending extra modal
    clearPendingExtraModal(userId) {
        if (this.data.pendingExtraModals && this.data.pendingExtraModals[userId]) {
            delete this.data.pendingExtraModals[userId];
            this.save();
        }
    },

    // ✅ FUNGSI DEBUG: Cek pending modals
    debugPendingModals() {
        console.log('=== DEBUG PENDING MODALS ===');
        console.log('pendingModals:', this.data.pendingModals);
        console.log('pendingExtraModals:', this.data.pendingExtraModals);
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

    // ✅ FUNGSI BARU: Recalculate semua shift aktif (untuk sinkronisasi)
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

// Initialize
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

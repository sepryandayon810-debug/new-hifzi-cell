// ============================================
// HIFZI CELL - COMPLETE SYSTEM
// Gabungan: dataManager + backupModule + router + app
// ============================================

// ============================================
// 1. DATA MANAGER
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
    
    defaultUsers: [
        { id: 'admin', username: 'admin', password: 'admin123', name: 'Administrator', role: 'admin' },
        { id: 'kasir1', username: 'kasir1', password: 'kasir123', name: 'Kasir 1', role: 'kasir' }
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
                openTime: null,
                closeTime: null,
                date: null,
                currentUser: null,
                lastCheckDate: null
            };
        }

        if (!this.data.settings.phone) this.data.settings.phone = '';
        if (this.data.settings.tax === undefined) this.data.settings.tax = 0;

        this.checkAutoCloseMidnight();
        
        let users = JSON.parse(localStorage.getItem(this.USERS_KEY));
        if (!users) {
            users = this.defaultUsers;
            localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
        }
        
        this.save();
        return this.data;
    },

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

    save() {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
        
        // Trigger auto-sync jika backupModule aktif
        if (typeof backupModule !== 'undefined' && backupModule.isAutoSyncEnabled) {
            if (backupModule.currentProvider === 'firebase' && backupModule.currentUser) {
                backupModule.uploadDataFirebase(true);
            } else if (backupModule.currentProvider === 'googlesheet' && backupModule.gasUrl) {
                backupModule.uploadDataGAS(true);
            }
        }
    },

    saveData() {
        this.save();
    },

    getAllData() {
        return {
            products: this.data.products || [],
            categories: this.data.categories || [],
            transactions: this.data.transactions || [],
            cashFlow: this.data.cashTransactions || [],
            debts: this.data.debts || [],
            settings: this.data.settings || {},
            kasir: this.data.kasir || {},
            receipt: this.data.settings?.receiptHeader || {
                storeName: 'HIFZI CELL',
                address: '',
                phone: '',
                note: 'Terima kasih atas kunjungan Anda'
            }
        };
    },

    saveAllData(data) {
        if (data.products !== undefined) this.data.products = data.products;
        if (data.categories !== undefined) this.data.categories = data.categories;
        if (data.transactions !== undefined) this.data.transactions = data.transactions;
        if (data.cashFlow !== undefined) this.data.cashTransactions = data.cashFlow;
        if (data.debts !== undefined) this.data.debts = data.debts;
        if (data.settings !== undefined) {
            this.data.settings = { ...this.data.settings, ...data.settings };
        }
        if (data.kasir !== undefined) {
            this.data.kasir = { ...this.data.kasir, ...data.kasir };
        }
        
        this.save();
        
        if (typeof app !== 'undefined' && app.data) {
            app.data = this.data;
            if (app.updateHeader) app.updateHeader();
        }
    },

    deepMerge(target, source) {
        const output = Object.assign({}, target);
        if (this.isObject(target) && this.isObject(source)) {
            Object.keys(source).forEach(key => {
                if (this.isObject(source[key])) {
                    if (!(key in target)) {
                        Object.assign(output, { [key]: source[key] });
                    } else {
                        output[key] = this.deepMerge(target[key], source[key]);
                    }
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

    load() {
        return this.init();
    },
    
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
        return JSON.parse(localStorage.getItem(this.USERS_KEY)) || this.defaultUsers;
    },

    saveUsers(users) {
        localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
    },

    addUser(user) {
        const users = this.getUsers();
        user.id = 'user_' + Date.now();
        users.push(user);
        this.saveUsers(users);
        return user;
    },

    updateUser(userId, updateData) {
        const users = this.getUsers();
        const userIndex = users.findIndex(u => u.id === userId);
        
        if (userIndex === -1) return false;
        
        if (updateData.name) users[userIndex].name = updateData.name;
        if (updateData.username) users[userIndex].username = updateData.username;
        if (updateData.role) users[userIndex].role = updateData.role;
        if (updateData.password) users[userIndex].password = updateData.password;
        
        this.saveUsers(users);
        return true;
    },

    deleteUser(userId) {
        let users = this.getUsers();
        users = users.filter(u => u.id !== userId);
        this.saveUsers(users);
    },

    login(username, password) {
        const users = this.getUsers();
        const user = users.find(u => u.username === username && u.password === password);
        
        if (user) {
            const session = {
                userId: user.id,
                username: user.username,
                name: user.name,
                role: user.role,
                loginTime: new Date().toISOString()
            };
            localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(session));
            return { success: true, user: session };
        }
        return { success: false, message: 'Username atau password salah!' };
    },

    logout() {
        this.save();
        localStorage.removeItem(this.CURRENT_USER_KEY);
    },

    getCurrentUser() {
        const session = localStorage.getItem(this.CURRENT_USER_KEY);
        return session ? JSON.parse(session) : null;
    },

    isLoggedIn() {
        return this.getCurrentUser() !== null;
    },

    checkKasirStatusForUser(userId) {
        const today = new Date().toDateString();
        const kasir = this.data.kasir;
        
        this.checkAutoCloseMidnight();
        
        if (!kasir.isOpen) {
            return { canOpen: true, shouldReset: true, reason: 'closed' };
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
            message: `Kasir sedang digunakan oleh user lain.`
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
            new Date(t.date).toDateString() === kasirDate && t.status !== 'voided'
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
        
        return { success: true, message: 'Kasir ditutup. Shift berakhir.' };
    },
    
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

// ============================================
// 2. BACKUP MODULE (Firebase + Google Sheets)
// ============================================
const backupModule = {
    currentProvider: 'local',
    gasUrl: '',
    
    firebaseConfig: {
        apiKey: "",
        authDomain: "",
        databaseURL: "",
        projectId: "",
        storageBucket: "",
        messagingSenderId: "",
        appId: ""
    },
    
    firebaseApp: null,
    database: null,
    auth: null,
    currentUser: null,
    isAutoSyncEnabled: false,
    autoSyncInterval: null,
    lastSyncTime: null,
    isOnline: navigator.onLine,
    pendingSync: false,
    deviceId: null,
    deviceName: null,
    
    STORAGE_KEY: 'hifzi_data',
    GAS_URL_KEY: 'hifzi_gas_url',
    AUTO_SYNC_KEY: 'hifzi_auto_sync',
    LAST_SYNC_KEY: 'hifzi_last_sync',
    DEVICE_ID_KEY: 'hifzi_device_id',
    DEVICE_NAME_KEY: 'hifzi_device_name',
    USER_KEY: 'hifzi_user',
    PROVIDER_KEY: 'hifzi_provider',
    FIREBASE_CONFIG_KEY: 'hifzi_firebase_config',
    
    log: function(level, message, data) {
        const timestamp = new Date().toLocaleTimeString('id-ID');
        const prefix = `[${timestamp}][Backup][${level}]`;
        if (level === 'ERROR') console.error(prefix, message, data || '');
        else if (level === 'WARN') console.warn(prefix, message, data || '');
        else console.log(prefix, message, data || '');
    },

    init: function() {
        this.log('INFO', 'Backup Module Initialized');
        
        this.currentProvider = localStorage.getItem(this.PROVIDER_KEY) || 'local';
        this.gasUrl = localStorage.getItem(this.GAS_URL_KEY) || '';
        this.isAutoSyncEnabled = localStorage.getItem(this.AUTO_SYNC_KEY) === 'true';
        this.lastSyncTime = localStorage.getItem(this.LAST_SYNC_KEY) || null;
        
        const savedFirebaseConfig = localStorage.getItem(this.FIREBASE_CONFIG_KEY);
        if (savedFirebaseConfig) {
            try {
                const parsed = JSON.parse(savedFirebaseConfig);
                this.firebaseConfig = { ...this.firebaseConfig, ...parsed };
            } catch(e) {}
        }
        
        this.deviceId = localStorage.getItem(this.DEVICE_ID_KEY);
        if (!this.deviceId) {
            this.deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem(this.DEVICE_ID_KEY, this.deviceId);
        }
        this.deviceName = localStorage.getItem(this.DEVICE_NAME_KEY) || 
                          navigator.userAgent.split(' ')[0] + ' ' + this.deviceId.substr(-4);
        
        if (this.currentProvider === 'firebase') {
            this.initFirebase();
        } else if (this.currentProvider === 'googlesheet' && this.gasUrl) {
            this.checkNewDeviceGAS();
        }
        
        this.setupConnectivityListeners();
        this.updateSyncStatusUI();
    },

    getAllData: function() {
        if (typeof dataManager !== 'undefined' && dataManager.getAllData) {
            return dataManager.getAllData();
        }
        
        const saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            return {
                products: parsed.products || [],
                categories: parsed.categories || [],
                transactions: parsed.transactions || [],
                cashFlow: parsed.cashTransactions || [],
                debts: parsed.debts || [],
                settings: parsed.settings || {},
                kasir: parsed.kasir || {},
                receipt: parsed.settings?.receiptHeader || {
                    storeName: 'HIFZI CELL',
                    address: '',
                    phone: '',
                    note: 'Terima kasih atas kunjungan Anda'
                }
            };
        }
        
        return this.getDefaultData();
    },

    saveAllData: function(data) {
        if (typeof dataManager !== 'undefined' && dataManager.saveAllData) {
            dataManager.saveAllData(data);
            return;
        }
        
        const current = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '{}');
        
        if (data.products !== undefined) current.products = data.products;
        if (data.categories !== undefined) current.categories = data.categories;
        if (data.transactions !== undefined) current.transactions = data.transactions;
        if (data.cashFlow !== undefined) current.cashTransactions = data.cashFlow;
        if (data.debts !== undefined) current.debts = data.debts;
        if (data.settings !== undefined) current.settings = { ...current.settings, ...data.settings };
        if (data.kasir !== undefined) current.kasir = { ...current.kasir, ...data.kasir };
        
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(current));
        
        if (typeof app !== 'undefined' && app.data) {
            app.data = current;
            if (app.updateHeader) app.updateHeader();
        }
    },

    getDefaultData: function() {
        return {
            products: [],
            categories: [
                { id: 'all', name: 'Semua', icon: '📦' },
                { id: 'handphone', name: 'Handphone', icon: '📱' },
                { id: 'aksesoris', name: 'Aksesoris', icon: '🎧' },
                { id: 'pulsa', name: 'Pulsa', icon: '💳' },
                { id: 'servis', name: 'Servis', icon: '🔧' }
            ],
            transactions: [],
            cashFlow: [],
            debts: [],
            settings: {
                storeName: 'Hifzi Cell',
                address: '',
                phone: '',
                tax: 0,
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
                shiftId: null,
                openingBalance: 0,
                closingBalance: 0
            },
            receipt: {
                header: { storeName: 'HIFZI CELL', address: '', phone: '', note: 'Terima kasih atas kunjungan Anda' },
                footer: { message: '', thanks: '' },
                showLogo: false,
                logoUrl: ''
            }
        };
    },

    hasAnyData: function(data) {
        if (!data) data = this.getAllData();
        return (
            (data.products && data.products.length > 0) ||
            (data.transactions && data.transactions.length > 0) ||
            (data.debts && data.debts.length > 0) ||
            (data.cashFlow && data.cashFlow.length > 0) ||
            (data.categories && data.categories.length > 1)
        );
    },

    setProvider: function(provider) {
        this.log('INFO', 'Provider changed to: ' + provider);
        this.currentProvider = provider;
        localStorage.setItem(this.PROVIDER_KEY, provider);
        this.stopAutoSync();
        
        if (provider === 'firebase') {
            this.initFirebase();
        }
        
        this.render();
    },

    saveFirebaseConfig: function() {
        const apiKey = document.getElementById('fb_apiKey').value.trim();
        const authDomain = document.getElementById('fb_authDomain').value.trim();
        const databaseURL = document.getElementById('fb_databaseURL').value.trim();
        const projectId = document.getElementById('fb_projectId').value.trim();
        const storageBucket = document.getElementById('fb_storageBucket').value.trim();
        const messagingSenderId = document.getElementById('fb_messagingSenderId').value.trim();
        const appId = document.getElementById('fb_appId').value.trim();
        
        if (!apiKey || !databaseURL || !authDomain) {
            this.showToast('❌ API Key, Auth Domain, dan Database URL wajib diisi!');
            return;
        }
        
        this.firebaseConfig = { apiKey, authDomain, databaseURL, projectId, storageBucket, messagingSenderId, appId };
        localStorage.setItem(this.FIREBASE_CONFIG_KEY, JSON.stringify(this.firebaseConfig));
        this.showToast('✅ Konfigurasi Firebase tersimpan!');
        this.initFirebase();
        this.render();
    },

    initFirebase: function() {
        console.log('[Firebase] Initializing...');
        
        if (typeof firebase === 'undefined') {
            console.error('[Firebase] SDK not loaded!');
            return;
        }
        
        if (!this.firebaseConfig.apiKey || !this.firebaseConfig.databaseURL) {
            console.log('[Firebase] Config incomplete');
            return;
        }
        
        try {
            if (firebase.apps && firebase.apps.length) {
                firebase.apps.forEach(app => app.delete());
            }
            
            this.firebaseApp = firebase.initializeApp(this.firebaseConfig);
            this.database = firebase.database();
            this.auth = firebase.auth();
            
            console.log('[Firebase] Initialized successfully!');
            this.log('INFO', 'Firebase initialized: ' + this.firebaseConfig.projectId);
            
            this.auth.onAuthStateChanged((user) => {
                if (user) {
                    console.log('[Firebase] User already logged in:', user.email);
                    this.currentUser = user;
                    this.saveUserToLocal(user);
                    this.updateDeviceStatus(true);
                    this.setupRealtimeListeners();
                    
                    if (this.isAutoSyncEnabled) {
                        this.startAutoSyncFirebase();
                    }
                } else {
                    console.log('[Firebase] No user logged in');
                    this.currentUser = null;
                }
                this.render();
            });
            
        } catch (error) {
            console.error('[Firebase] Init error:', error);
            this.showToast('❌ Gagal init Firebase: ' + error.message);
        }
    },

    setupRealtimeListeners: function() {
        if (!this.database || !this.currentUser) return;
        
        const userId = this.currentUser.uid;
        const dataRef = this.database.ref('users/' + userId + '/data');
        
        dataRef.on('value', (snapshot) => {
            const cloudData = snapshot.val();
            if (cloudData && cloudData.lastModified) {
                const localTime = this.lastSyncTime || '1970-01-01';
                const cloudTime = cloudData.lastModified;
                
                if (cloudTime > localTime && cloudData.lastModifiedBy !== this.deviceId) {
                    this.log('INFO', 'New data from other device detected');
                    this.mergeCloudData(cloudData, true);
                }
            }
        });
    },

    firebaseLogin: function(email, password) {
        if (!this.auth && typeof firebase !== 'undefined' && firebase.auth) {
            this.auth = firebase.auth();
        }
        
        if (!this.auth) {
            this.showToast('❌ Firebase belum siap. Cek konfigurasi!');
            return;
        }
        
        if (!email || !password) {
            this.showToast('❌ Email dan password wajib diisi!');
            return;
        }
        
        this.showToast('⏳ Login...');
        this.auth.signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
                this.currentUser = userCredential.user;
                this.showToast('✅ Login berhasil!');
                this.render();
            })
            .catch((error) => {
                this.showToast('❌ ' + error.message);
                console.error('Login error:', error);
            });
    },

    firebaseRegister: function(email, password) {
        if (!this.auth && typeof firebase !== 'undefined' && firebase.auth) {
            this.auth = firebase.auth();
        }
        
        if (!this.auth) {
            this.showToast('❌ Firebase belum siap. Cek konfigurasi!');
            return;
        }
        
        if (!email || !password) {
            this.showToast('❌ Email dan password wajib diisi!');
            return;
        }
        
        if (password.length < 6) {
            this.showToast('❌ Password minimal 6 karakter!');
            return;
        }
        
        this.showToast('⏳ Mendaftar...');
        this.auth.createUserWithEmailAndPassword(email, password)
            .then((userCredential) => {
                this.currentUser = userCredential.user;
                this.showToast('✅ Daftar berhasil!');
                this.uploadDataFirebase(true);
                this.render();
            })
            .catch((error) => {
                this.showToast('❌ ' + error.message);
                console.error('Register error:', error);
            });
    },

    firebaseLogout: function() {
        if (!this.auth) return;
        this.updateDeviceStatus(false);
        this.auth.signOut().then(() => {
            this.currentUser = null;
            this.stopAutoSync();
            this.showToast('✅ Logout');
            this.render();
        });
    },

    uploadDataFirebase: function(silent = false, callback) {
        if (!this.currentUser && this.auth) {
            this.currentUser = this.auth.currentUser;
        }
        
        if (!this.database || !this.currentUser) {
            if (!silent) this.showToast('❌ Belum login');
            if (callback) callback(false);
            return;
        }
        
        if (!this.isOnline) {
            this.pendingSync = true;
            if (!silent) this.showToast('📴 Offline - pending');
            if (callback) callback(false);
            return;
        }
        
        if (!silent) this.showToast('⬆️ Upload...');
        
        const data = this.getAllData();
        const userId = this.currentUser.uid;
        const payload = {
            ...data,
            lastModified: new Date().toISOString(),
            lastModifiedBy: this.deviceId,
            lastModifiedByName: this.deviceName,
            version: '1.0'
        };
        
        this.database.ref('users/' + userId + '/data').set(payload)
            .then(() => {
                this.lastSyncTime = new Date().toISOString();
                localStorage.setItem(this.LAST_SYNC_KEY, this.lastSyncTime);
                this.pendingSync = false;
                this.updateSyncStatusUI();
                if (!silent) this.showToast('✅ Upload OK!');
                this.render();
                if (callback) callback(true);
            })
            .catch((error) => {
                if (!silent) this.showToast('❌ Upload gagal: ' + error.message);
                if (callback) callback(false);
            });
    },

    downloadDataFirebase: function(silent = false) {
        if (!this.currentUser && this.auth) {
            this.currentUser = this.auth.currentUser;
        }
        
        if (!this.database || !this.currentUser) {
            if (!silent) this.showToast('❌ Belum login');
            return;
        }
        
        if (!silent && !confirm('📥 Download akan mengganti data lokal. Lanjutkan?')) return;
        
        if (!silent) this.showToast('⬇️ Download...');
        
        const userId = this.currentUser.uid;
        this.database.ref('users/' + userId + '/data').once('value')
            .then((snapshot) => {
                const cloudData = snapshot.val();
                if (cloudData) {
                    this.mergeCloudData(cloudData, silent);
                    if (!silent) setTimeout(() => location.reload(), 2000);
                } else {
                    if (!silent) this.showToast('ℹ️ Belum ada data di cloud');
                }
            })
            .catch((error) => {
                if (!silent) this.showToast('❌ Download gagal: ' + error.message);
            });
    },

    // ========== VERIFIKASI DATA FIREBASE ==========
    
    verifyUploadFirebase: function() {
        if (!this.database || !this.currentUser) {
            this.showToast('❌ Belum login ke Firebase');
            return;
        }
        
        this.showToast('🔍 Mengecek data di Firebase...');
        
        const userId = this.currentUser.uid;
        this.database.ref('users/' + userId + '/data').once('value')
            .then((snapshot) => {
                const data = snapshot.val();
                
                if (!data) {
                    this.showToast('ℹ️ Belum ada data di Firebase');
                    return;
                }
                
                const stats = {
                    products: data.products ? data.products.length : 0,
                    transactions: data.transactions ? data.transactions.length : 0,
                    categories: data.categories ? data.categories.length : 0,
                    debts: data.debts ? data.debts.length : 0,
                    lastModified: data.lastModified ? new Date(data.lastModified).toLocaleString('id-ID') : '-',
                    device: data.lastModifiedByName || data.lastModifiedBy || '-'
                };
                
                this.showVerifyModal(stats, data);
            })
            .catch((error) => {
                this.showToast('❌ Gagal membaca: ' + error.message);
            });
    },

    showVerifyModal: function(stats, fullData) {
        const modalHTML = `
            <div class="modal active" id="verifyModal" style="display: flex; z-index: 5000; align-items: flex-start; padding-top: 80px;">
                <div class="modal-content" style="max-width: 500px; width: 90%; max-height: 85vh; overflow-y: auto;">
                    <div class="modal-header" style="padding: 15px 20px; border-bottom: 1px solid #eee;">
                        <span class="modal-title" style="font-size: 16px; font-weight: 600;">✅ Data di Firebase</span>
                        <button onclick="document.getElementById('verifyModal').remove()" style="background: none; border: none; font-size: 20px; cursor: pointer;">×</button>
                    </div>
                    
                    <div style="padding: 20px;">
                        <div style="background: #e8f5e9; border: 2px solid #4caf50; border-radius: 12px; padding: 15px; margin-bottom: 20px;">
                            <div style="font-size: 13px; color: #2e7d32; font-weight: 600; margin-bottom: 10px;">
                                📊 Statistik Data Cloud
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px;">
                                <div>📦 Produk: <b>${stats.products}</b></div>
                                <div>📝 Transaksi: <b>${stats.transactions}</b></div>
                                <div>📁 Kategori: <b>${stats.categories}</b></div>
                                <div>💳 Hutang: <b>${stats.debts}</b></div>
                            </div>
                        </div>
                        
                        <div style="background: #f5f5f5; border-radius: 8px; padding: 12px; margin-bottom: 15px; font-size: 12px; color: #666;">
                            <div style="margin-bottom: 5px;"><b>🕐 Terakhir Update:</b></div>
                            <div>${stats.lastModified}</div>
                            <div style="margin-top: 5px; color: #999;">Device: ${stats.device}</div>
                        </div>
                        
                        <details style="margin-bottom: 15px;">
                            <summary style="cursor: pointer; font-size: 13px; color: #667eea; font-weight: 600;">
                                🔍 Lihat Detail Produk & Transaksi
                            </summary>
                            <div style="margin-top: 10px;">
                                <div style="font-size: 12px; font-weight: 600; margin-bottom: 8px;">📦 Produk (${stats.products}):</div>
                                <div style="max-height: 150px; overflow-y: auto; background: #f9f9f9; padding: 10px; border-radius: 6px; font-size: 11px; margin-bottom: 15px;">
                                    ${fullData.products ? fullData.products.map(p => `• ${p.name} - Rp ${p.price}`).join('<br>') : 'Tidak ada produk'}
                                </div>
                                
                                <div style="font-size: 12px; font-weight: 600; margin-bottom: 8px;">📝 Transaksi Terakhir (${Math.min(stats.transactions, 5)} dari ${stats.transactions}):</div>
                                <div style="max-height: 150px; overflow-y: auto; background: #f9f9f9; padding: 10px; border-radius: 6px; font-size: 11px;">
                                    ${fullData.transactions ? fullData.transactions.slice(-5).map(t => `• ${new Date(t.date).toLocaleDateString('id-ID')} - Rp ${t.total}`).join('<br>') : 'Tidak ada transaksi'}
                                </div>
                            </div>
                        </details>
                        
                        <details style="margin-bottom: 15px;">
                            <summary style="cursor: pointer; font-size: 13px; color: #999;">
                                📝 Lihat JSON Lengkap (Debug)
                            </summary>
                            <pre style="background: #f4f4f4; padding: 10px; border-radius: 8px; font-size: 10px; overflow-x: auto; margin-top: 10px; max-height: 200px; overflow-y: auto;">${JSON.stringify(fullData, null, 2)}</pre>
                        </details>
                        
                        <button onclick="backupModule.downloadDataFirebase()" class="btn-primary" style="width: 100%; margin-bottom: 10px; background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%);">
                            ⬇️ Download ke Device Ini
                        </button>
                        
                        <button onclick="document.getElementById('verifyModal').remove()" class="btn-secondary" style="width: 100%;">
                            Tutup
                        </button>
                    </div>
                </div>
            </div>
            
            <style>
                .btn-secondary { background: #edf2f7; color: #4a5568; border: 1px solid #e2e8f0; padding: 12px 24px; border-radius: 8px; font-weight: 600; cursor: pointer; }
                .btn-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; cursor: pointer; }
            </style>
        `;
        
        const existing = document.getElementById('verifyModal');
        if (existing) existing.remove();
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    checkNewDeviceGAS: function() {
        const localData = this.getAllData();
        const hasLocalData = this.hasAnyData(localData);
        
        if (!hasLocalData && this.gasUrl) {
            this.log('INFO', 'New device detected, auto-downloading...');
            this.showToast('📥 Device baru, mengunduh...');
            setTimeout(() => this.downloadDataGAS(true), 1000);
        }
        
        if (this.isAutoSyncEnabled && this.gasUrl) {
            this.startAutoSyncGAS();
        }
    },

    uploadDataGAS: function(silent = false, callback) {
        if (!this.gasUrl) {
            if (!silent) this.showToast('❌ URL GAS belum diisi!');
            if (callback) callback(false);
            return;
        }
        
        const data = this.getAllData();
        if (!silent) this.showToast('⬆️ Mengupload...');
        
        const payload = {
            action: 'sync',
            data: data,
            timestamp: new Date().toISOString(),
            device: navigator.userAgent
        };
        
        fetch(this.gasUrl, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        })
        .then(response => response.json())
        .then(result => {
            if (result && result.success) {
                this.lastSyncTime = new Date().toISOString();
                localStorage.setItem(this.LAST_SYNC_KEY, this.lastSyncTime);
                this.updateSyncStatusUI();
                if (!silent) this.showToast('✅ Upload berhasil!');
                this.render();
                if (callback) callback(true);
            } else {
                if (!silent) this.showToast('❌ Upload gagal');
                if (callback) callback(false);
            }
        })
        .catch(error => {
            this.uploadViaJSONP_GAS(payload, silent, callback);
        });
    },

    uploadViaJSONP_GAS: function(payload, silent, callback) {
        const jsonStr = JSON.stringify(payload);
        if (jsonStr.length > 8000) {
            this.uploadViaIframe_GAS(payload, silent, callback);
            return;
        }
        
        const encoded = encodeURIComponent(jsonStr);
        const callbackName = 'upload_cb_' + Date.now();
        
        window[callbackName] = (result) => {
            if (result && result.success) {
                this.lastSyncTime = new Date().toISOString();
                localStorage.setItem(this.LAST_SYNC_KEY, this.lastSyncTime);
                this.updateSyncStatusUI();
                if (!silent) this.showToast('✅ Upload berhasil!');
                this.render();
                if (callback) callback(true);
            } else {
                if (!silent) this.showToast('❌ Upload gagal');
                if (callback) callback(false);
            }
            delete window[callbackName];
        };
        
        const script = document.createElement('script');
        script.onerror = () => {
            this.uploadViaIframe_GAS(payload, silent, callback);
            delete window[callbackName];
        };
        script.src = this.gasUrl + '?callback=' + callbackName + '&data=' + encoded;
        document.head.appendChild(script);
        
        setTimeout(() => {
            if (window[callbackName]) {
                delete window[callbackName];
                if (callback) callback(false);
            }
        }, 15000);
    },

    uploadViaIframe_GAS: function(payload, silent, callback) {
        const formId = 'up_form_' + Date.now();
        const iframeId = 'up_ifrm_' + Date.now();
        
        const form = document.createElement('form');
        form.id = formId;
        form.method = 'POST';
        form.action = this.gasUrl;
        form.target = iframeId;
        form.style.display = 'none';
        
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'data';
        input.value = JSON.stringify(payload);
        form.appendChild(input);
        
        const iframe = document.createElement('iframe');
        iframe.id = iframeId;
        iframe.name = iframeId;
        iframe.style.display = 'none';
        
        document.body.appendChild(form);
        document.body.appendChild(iframe);
        
        iframe.onload = () => {
            try {
                const doc = iframe.contentDocument || iframe.contentWindow.document;
                const text = doc.body.innerText || doc.body.textContent;
                const result = JSON.parse(text);
                if (result && result.success) {
                    this.lastSyncTime = new Date().toISOString();
                    localStorage.setItem(this.LAST_SYNC_KEY, this.lastSyncTime);
                    this.updateSyncStatusUI();
                    if (!silent) this.showToast('✅ Upload selesai');
                    this.render();
                    if (callback) callback(true);
                }
            } catch(e) {
                this.lastSyncTime = new Date().toISOString();
                localStorage.setItem(this.LAST_SYNC_KEY, this.lastSyncTime);
                this.updateSyncStatusUI();
                if (!silent) this.showToast('✅ Upload selesai');
                this.render();
                if (callback) callback(true);
            }
            setTimeout(() => {
                document.getElementById(formId)?.remove();
                document.getElementById(iframeId)?.remove();
            }, 2000);
        };
        
        form.submit();
    },

    downloadDataGAS: function(silent = false) {
        if (!silent && !confirm('📥 Download akan mengganti data lokal. Lanjutkan?')) return;
        if (!this.gasUrl) {
            if (!silent) this.showToast('❌ URL GAS belum diisi!');
            return;
        }
        
        if (!silent) this.showToast('⬇️ Mengunduh...');
        
        fetch(this.gasUrl + '?action=restore&_t=' + Date.now())
        .then(response => response.json())
        .then(result => {
            this.handleDownloadResultGAS(result, silent);
        })
        .catch(error => {
            this.downloadViaJSONP_GAS(silent);
        });
    },

    downloadViaJSONP_GAS: function(silent) {
        const cb = 'dl_cb_' + Date.now();
        window[cb] = (result) => {
            this.handleDownloadResultGAS(result, silent);
            delete window[cb];
        };
        
        const script = document.createElement('script');
        script.onerror = () => {
            if (!silent) this.showToast('❌ Gagal terhubung');
            delete window[cb];
        };
        script.src = this.gasUrl + '?action=restore&callback=' + cb + '&_t=' + Date.now();
        document.head.appendChild(script);
        
        setTimeout(() => {
            if (window[cb]) delete window[cb];
        }, 20000);
    },

    handleDownloadResultGAS: function(result, silent) {
        if (result && result.success && result.data) {
            this.saveAllData(result.data);
            this.lastSyncTime = new Date().toISOString();
            localStorage.setItem(this.LAST_SYNC_KEY, this.lastSyncTime);
            this.updateSyncStatusUI();
            
            if (!silent) {
                this.showToast(`✅ Download berhasil!`);
                setTimeout(() => location.reload(), 2000);
            }
        } else {
            if (!silent) this.showToast('❌ Download gagal');
        }
    },

    startAutoSyncGAS: function() {
        this.stopAutoSync();
        this.performTwoWaySyncGAS();
        this.autoSyncInterval = setInterval(() => {
            this.performTwoWaySyncGAS();
        }, 180000);
        this.log('INFO', 'Auto Sync GAS started');
    },

    startAutoSyncFirebase: function() {
        this.stopAutoSync();
        this.performTwoWaySyncFirebase();
        this.autoSyncInterval = setInterval(() => {
            this.performTwoWaySyncFirebase();
        }, 180000);
        this.log('INFO', 'Auto Sync Firebase started');
    },

    stopAutoSync: function() {
        if (this.autoSyncInterval) {
            clearInterval(this.autoSyncInterval);
            this.autoSyncInterval = null;
            this.log('INFO', 'Auto Sync stopped');
        }
    },

    performTwoWaySyncGAS: function() {
        this.uploadDataGAS(true, (success) => {
            if (success) {
                this.getCloudTimestampGAS((cloudTime) => {
                    if (cloudTime && cloudTime > this.lastSyncTime) {
                        this.downloadDataGAS(true);
                    }
                });
            }
        });
    },

    performTwoWaySyncFirebase: function() {
        this.uploadDataFirebase(true, (success) => {
            if (success) {
                setTimeout(() => this.downloadDataFirebase(true), 2000);
            }
        });
    },

    getCloudTimestampGAS: function(callback) {
        const cb = 'ts_' + Date.now();
        window[cb] = (result) => {
            if (result && result.success && result.timestamp) {
                callback(result.timestamp);
            } else {
                callback(null);
            }
            delete window[cb];
        };
        
        const script = document.createElement('script');
        script.onerror = () => {
            callback(null);
            delete window[cb];
        };
        script.src = this.gasUrl + '?action=getTimestamp&callback=' + cb + '&_t=' + Date.now();
        document.head.appendChild(script);
        
        setTimeout(() => {
            if (window[cb]) {
                callback(null);
                delete window[cb];
            }
        }, 10000);
    },

    toggleAutoSync: function() {
        this.isAutoSyncEnabled = !this.isAutoSyncEnabled;
        localStorage.setItem(this.AUTO_SYNC_KEY, this.isAutoSyncEnabled);
        
        if (this.isAutoSyncEnabled) {
            if (this.currentProvider === 'firebase' && this.currentUser) {
                this.startAutoSyncFirebase();
            } else if (this.currentProvider === 'googlesheet' && this.gasUrl) {
                this.startAutoSyncGAS();
            }
            this.showToast('🟢 Auto sync aktif');
        } else {
            this.stopAutoSync();
            this.showToast('⚪ Auto sync mati');
        }
        this.render();
    },

    setupConnectivityListeners: function() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.updateSyncStatusUI();
            this.showToast('🌐 Online');
            if (this.pendingSync) {
                if (this.currentProvider === 'firebase' && this.currentUser) {
                    this.uploadDataFirebase(true);
                } else if (this.currentProvider === 'googlesheet') {
                    this.uploadDataGAS(true);
                }
            }
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.updateSyncStatusUI();
            this.showToast('📴 Offline');
        });
    },

    updateDeviceStatus: function(isOnline) {
        if (!this.database || !this.currentUser) return;
        const userId = this.currentUser.uid;
        this.database.ref('users/' + userId + '/devices/' + this.deviceId).set({
            name: this.deviceName,
            isOnline: isOnline,
            lastSeen: new Date().toISOString()
        });
    },

    getConnectedDevices: function(callback) {
        if (!this.database || !this.currentUser) {
            callback([]);
            return;
        }
        const userId = this.currentUser.uid;
        this.database.ref('users/' + userId + '/devices').once('value', (snapshot) => {
            const devices = [];
            snapshot.forEach((child) => {
                devices.push({ id: child.key, ...child.val() });
            });
            callback(devices);
        });
    },

    mergeCloudData: function(cloudData, silent = false) {
        const { lastModified, lastModifiedBy, lastModifiedByName, version, ...cleanData } = cloudData;
        this.saveAllData(cleanData);
        this.lastSyncTime = new Date().toISOString();
        localStorage.setItem(this.LAST_SYNC_KEY, this.lastSyncTime);
        this.updateSyncStatusUI();
        
        if (!silent) {
            const deviceInfo = lastModifiedByName ? ' (dari ' + lastModifiedByName + ')' : '';
            this.showToast('✅ Data diperbarui' + deviceInfo);
        }
        this.render();
    },

    saveUserToLocal: function(user) {
        localStorage.setItem(this.USER_KEY, JSON.stringify({
            uid: user.uid,
            email: user.email
        }));
    },

    updateSyncStatusUI: function() {
        const syncStatus = document.getElementById('syncStatus');
        const syncText = document.getElementById('syncText');
        
        if (!syncStatus || !syncText) return;
        
        if (!this.isOnline) {
            syncText.textContent = 'Offline';
            syncStatus.style.opacity = '0.5';
        } else if (this.isAutoSyncEnabled) {
            syncText.textContent = 'Auto Sync';
            syncStatus.style.color = '#48bb78';
        } else if (this.lastSyncTime) {
            const time = new Date(this.lastSyncTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            syncText.textContent = 'Sync ' + time;
        } else {
            syncText.textContent = 'Ready';
        }
    },

    manualSync: function() {
        if (this.currentProvider === 'firebase' && this.currentUser) {
            this.uploadDataFirebase();
        } else if (this.currentProvider === 'googlesheet' && this.gasUrl) {
            this.uploadDataGAS();
        } else {
            this.showToast('⚠️ Pilih provider dan pastikan sudah login');
        }
    },

    downloadJSON: function() {
        const data = this.getAllData();
        const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'hifzi_backup_' + new Date().toISOString().split('T')[0] + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.showToast('✅ File JSON didownload!');
    },

    importJSON: function(input) {
        const file = input.files[0];
        if (!file) return;
        if (!confirm('⚠️ Import akan menimpa data lokal?')) { 
            input.value = ''; 
            return; 
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const d = JSON.parse(e.target.result);
                this.saveAllData(d);
                this.showToast('✅ Import berhasil!');
                
                if (this.currentProvider === 'firebase' && (this.currentUser || (this.auth && this.auth.currentUser))) {
                    this.uploadDataFirebase(true);
                } else if (this.currentProvider === 'googlesheet' && this.gasUrl) {
                    this.uploadDataGAS(true);
                }
                
                this.render();
            } catch(err) {
                this.showToast('❌ Error: ' + err.message);
            }
        };
        reader.readAsText(file);
        input.value = '';
    },

    resetLocal: function() {
        if (!confirm('⚠️ HAPUS SEMUA DATA LOKAL?\n\nLanjutkan?')) return;
        if (prompt('Ketik HAPUS:') !== 'HAPUS') {
            this.showToast('Dibatalkan');
            return;
        }
        
        localStorage.removeItem(this.STORAGE_KEY);
        
        const defaults = this.getDefaultData();
        this.saveAllData(defaults);
        this.showToast('✅ Data lokal dihapus!');
        setTimeout(() => location.reload(), 1500);
    },

    resetCloud: function() {
        if (this.currentProvider === 'firebase') {
            if (!this.currentUser && !(this.auth && this.auth.currentUser)) {
                this.showToast('❌ Belum login');
                return;
            }
            if (!confirm('⚠️ Reset Firebase?')) return;
            if (prompt('Ketik RESET:') !== 'RESET') return;
            
            const userId = (this.currentUser || this.auth.currentUser).uid;
            this.database.ref('users/' + userId + '/data').remove()
                .then(() => {
                    this.showToast('✅ Firebase direset!');
                    this.render();
                });
                
        } else if (this.currentProvider === 'googlesheet') {
            if (!this.gasUrl) {
                this.showToast('❌ URL GAS belum diisi');
                return;
            }
            if (!confirm('⚠️ Reset Google Sheets?')) return;
            if (prompt('Ketik RESET:') !== 'RESET') return;
            
            this.showToast('🗑️ Mereset GAS...');
        }
    },

    resetBoth: function() {
        if (!confirm('💀 HAPUS SEMUA DATA?\n\nLokal + Cloud\n\nTIDAK BISA DIBATALKAN!')) return;
        if (prompt('Ketik HAPUS SEMUA:') !== 'HAPUS SEMUA') return;
        
        this.resetCloud();
        setTimeout(() => this.resetLocal(), 2000);
    },

    render: function() {
        const container = document.getElementById('mainContent');
        if (!container) return;

        const data = this.getAllData();
        const stats = {
            products: data.products ? data.products.length : 0,
            categories: data.categories ? data.categories.length : 0,
            transactions: data.transactions ? data.transactions.length : 0,
            cashFlow: data.cashFlow ? data.cashFlow.length : 0,
            debts: data.debts ? data.debts.length : 0,
            currentCash: data.settings?.currentCash || 0,
            storeName: data.settings?.storeName || 'HIFZI CELL'
        };

        let isLoggedIn = !!this.currentUser;
        if (!isLoggedIn && this.auth) {
            isLoggedIn = !!this.auth.currentUser;
            if (isLoggedIn) {
                this.currentUser = this.auth.currentUser;
            }
        }

        const isFirebaseConfigured = this.firebaseConfig.apiKey && this.firebaseConfig.databaseURL;
        const connectionStatus = this.isOnline ? '🟢' : '🔴';

        container.innerHTML = `
            <div class="content-section active" id="backupSection" style="padding: 16px; max-width: 1200px; margin: 0 auto;">
                
                <div class="modern-card status-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-size: 14px; opacity: 0.9;">Provider Aktif</div>
                            <div style="font-size: 20px; font-weight: 600;">
                                ${this.getProviderDisplayName()}
                            </div>
                            <div style="font-size: 12px; opacity: 0.8; margin-top: 4px;">
                                ${connectionStatus} ${this.isOnline ? 'Online' : 'Offline'} 
                                ${this.isAutoSyncEnabled ? '• Auto Sync ON' : ''}
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 12px; opacity: 0.8;">Last Sync</div>
                            <div style="font-size: 14px; font-weight: 500;">
                                ${this.lastSyncTime ? new Date(this.lastSyncTime).toLocaleTimeString('id-ID') : 'Belum'}
                            </div>
                        </div>
                    </div>
                </div>

                <div class="modern-card" style="margin-bottom: 20px;">
                    <div style="font-size: 16px; font-weight: 600; color: #2d3748; margin-bottom: 16px;">
                        ☁️ Pilih Metode Backup
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
                        ${this.renderProviderCard('local', '💾', 'Local File', 'Simpan di device')}
                        ${this.renderProviderCard('googlesheet', '📊', 'Google Sheets', 'Via Google Apps Script')}
                        ${this.renderProviderCard('firebase', '🔥', 'Firebase', 'Real-time sync')}
                    </div>
                </div>

                ${this.currentProvider === 'firebase' ? this.renderFirebaseSection(isLoggedIn, isFirebaseConfigured) : ''}
                ${this.currentProvider === 'googlesheet' ? this.renderGoogleSheetSection() : ''}
                ${this.currentProvider === 'local' ? this.renderLocalInfoSection() : ''}

                <div class="modern-card" style="margin-bottom: 20px;">
                    <div style="font-size: 16px; font-weight: 600; color: #2d3748; margin-bottom: 16px;">
                        📊 Data Lokal: ${stats.storeName}
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px;">
                        ${this.renderStatCard('📦', 'Produk', stats.products, '#e3f2fd', '#2196F3')}
                        ${this.renderStatCard('📁', 'Kategori', stats.categories, '#e8f5e9', '#4CAF50')}
                        ${this.renderStatCard('📝', 'Transaksi', stats.transactions, '#fff3e0', '#FF9800')}
                        ${this.renderStatCard('💰', 'Arus Kas', stats.cashFlow, '#fce4ec', '#E91E63')}
                        ${this.renderStatCard('💳', 'Hutang', stats.debts, '#f3e5f5', '#9C27B0')}
                        ${this.renderStatCard('🏦', 'Kas', this.formatRupiah(stats.currentCash), '#e0f2f1', '#009688')}
                    </div>
                </div>

                <div class="modern-card" style="margin-bottom: 20px;">
                    <div style="font-size: 16px; font-weight: 600; color: #2d3748; margin-bottom: 16px;">
                        💾 Backup Local (JSON)
                    </div>
                    <button onclick="backupModule.downloadJSON()" class="btn-primary" style="width: 100%; margin-bottom: 12px;">
                        ⬇️ Download JSON
                    </button>
                    <label style="display: block; padding: 16px; border: 2px dashed #cbd5e0; border-radius: 8px; text-align: center; cursor: pointer;" 
                           onmouseover="this.style.borderColor='#667eea';this.style.background='#f7fafc'" 
                           onmouseout="this.style.borderColor='#cbd5e0';this.style.background='transparent'">
                        <input type="file" accept=".json" onchange="backupModule.importJSON(this)" style="display: none;">
                        <div style="font-size: 24px; margin-bottom: 8px;">📤</div>
                        <div style="font-size: 14px; color: #4a5568; font-weight: 500;">Import JSON</div>
                    </label>
                </div>

                <div class="modern-card" style="border: 1px solid #feb2b2; background: #fff5f5;">
                    <div style="font-size: 16px; font-weight: 600; color: #c53030; margin-bottom: 16px;">
                        🗑️ Zona Bahaya
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        <button onclick="backupModule.resetLocal()" class="btn-danger" style="background: #e53e3e;">
                            🗑️ Hapus Data Lokal
                        </button>
                        ${this.currentProvider !== 'local' ? `
                            <button onclick="backupModule.resetCloud()" class="btn-danger" style="background: #805ad5;">
                                ☁️ Reset Cloud (${this.currentProvider === 'firebase' ? 'Firebase' : 'GAS'})
                            </button>
                            <button onclick="backupModule.resetBoth()" class="btn-danger" style="background: #1a202c;">
                                💀 Reset Total (Lokal + Cloud)
                            </button>
                        ` : ''}
                    </div>
                </div>

            </div>

            <style>
                .modern-card { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; }
                .provider-card { padding: 16px; border: 2px solid #e2e8f0; border-radius: 10px; text-align: center; cursor: pointer; transition: all 0.2s; background: white; position: relative; }
                .provider-card:hover { border-color: #667eea; transform: translateY(-2px); }
                .provider-card.active { border-color: #48bb78; background: #f0fff4; }
                .stat-card { padding: 16px; border-radius: 10px; text-align: center; }
                .btn-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 14px; transition: opacity 0.2s; }
                .btn-primary:hover { opacity: 0.9; }
                .btn-secondary { background: #edf2f7; color: #4a5568; border: 1px solid #e2e8f0; padding: 12px 24px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
                .btn-secondary:hover { background: #e2e8f0; }
                .btn-danger { color: white; border: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 14px; transition: opacity 0.2s; }
                .btn-danger:hover { opacity: 0.9; }
                .form-input { width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; margin-bottom: 12px; box-sizing: border-box; }
                .form-input:focus { outline: none; border-color: #667eea; }
                .toggle-switch { position: relative; width: 48px; height: 24px; background: #cbd5e0; border-radius: 12px; cursor: pointer; transition: background 0.3s; }
                .toggle-switch.active { background: #48bb78; }
                .toggle-switch::after { content: ''; position: absolute; width: 20px; height: 20px; background: white; border-radius: 50%; top: 2px; left: 2px; transition: transform 0.3s; }
                .toggle-switch.active::after { transform: translateX(24px); }
                .config-section { background: #f7fafc; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
                .config-label { font-size: 12px; color: #718096; font-weight: 600; margin-bottom: 4px; text-transform: uppercase; }
            </style>
        `;
        
        if (this.currentProvider === 'firebase' && isLoggedIn) {
            this.loadAndRenderDevices();
        }
    },

    getProviderDisplayName: function() {
        switch(this.currentProvider) {
            case 'local': return '💾 Local File';
            case 'googlesheet': return '📊 Google Sheets';
            case 'firebase': return '🔥 Firebase Real-time';
            default: return '💾 Local File';
        }
    },

    renderProviderCard: function(provider, icon, title, desc) {
        const isActive = this.currentProvider === provider;
        const activeClass = isActive ? 'active' : '';
        const checkmark = isActive ? '<div style="position: absolute; top: 8px; right: 8px; background: #48bb78; color: white; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px;">✓</div>' : '';
        
        return `
            <div onclick="backupModule.setProvider('${provider}')" class="provider-card ${activeClass}">
                ${checkmark}
                <div style="font-size: 32px; margin-bottom: 8px;">${icon}</div>
                <div style="font-weight: 600; color: #2d3748; margin-bottom: 4px;">${title}</div>
                <div style="font-size: 11px; color: #718096;">${desc}</div>
            </div>
        `;
    },

    renderFirebaseSection: function(isLoggedIn, isConfigured) {
        if (!isConfigured) {
            return `
                <div class="modern-card" style="margin-bottom: 20px; border: 2px solid #ff6b35;">
                    <div style="font-size: 16px; font-weight: 600; color: #2d3748; margin-bottom: 16px;">
                        🔥 Konfigurasi Firebase
                    </div>
                    <div style="font-size: 13px; color: #718096; margin-bottom: 16px;">
                        Masukkan konfigurasi dari Firebase Console (Project Settings)
                    </div>
                    
                    <div class="config-section">
                        <div class="config-label">API Key *</div>
                        <input type="text" id="fb_apiKey" class="form-input" placeholder="AIzaSy..." value="${this.firebaseConfig.apiKey}">
                        
                        <div class="config-label">Auth Domain *</div>
                        <input type="text" id="fb_authDomain" class="form-input" placeholder="project-id.firebaseapp.com" value="${this.firebaseConfig.authDomain}">
                        
                        <div class="config-label">Database URL *</div>
                        <input type="text" id="fb_databaseURL" class="form-input" placeholder="https://project-id-default-rtdb.firebaseio.com" value="${this.firebaseConfig.databaseURL}">
                        
                        <div class="config-label">Project ID</div>
                        <input type="text" id="fb_projectId" class="form-input" placeholder="project-id" value="${this.firebaseConfig.projectId}">
                        
                        <div class="config-label">Storage Bucket</div>
                        <input type="text" id="fb_storageBucket" class="form-input" placeholder="project-id.appspot.com" value="${this.firebaseConfig.storageBucket}">
                        
                        <div class="config-label">Messaging Sender ID</div>
                        <input type="text" id="fb_messagingSenderId" class="form-input" placeholder="123456789" value="${this.firebaseConfig.messagingSenderId}">
                        
                        <div class="config-label">App ID</div>
                        <input type="text" id="fb_appId" class="form-input" placeholder="1:123456789:web:abcdef" value="${this.firebaseConfig.appId}">
                    </div>
                    
                    <button onclick="backupModule.saveFirebaseConfig()" class="btn-primary" style="width: 100%;">
                        💾 Simpan Konfigurasi
                    </button>
                </div>
            `;
        }
        
        if (!isLoggedIn) {
            return `
                <div class="modern-card" style="margin-bottom: 20px; border: 2px solid #ff6b35;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                        <div>
                            <div style="font-size: 16px; font-weight: 600; color: #2d3748;">🔥 Firebase Cloud</div>
                            <div style="font-size: 13px; color: #718096;">${this.firebaseConfig.projectId || 'Project'}</div>
                        </div>
                        <button onclick="backupModule.editFirebaseConfig()" class="btn-secondary" style="padding: 8px 16px; font-size: 12px;">
                            ⚙️ Edit Config
                        </button>
                    </div>
                    
                    <div style="font-size: 14px; font-weight: 600; color: #2d3748; margin-bottom: 12px;">
                        🔐 Login
                    </div>
                    <input type="email" id="authEmail" placeholder="Email" class="form-input">
                    <input type="password" id="authPassword" placeholder="Password" class="form-input">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                        <button onclick="backupModule.firebaseLogin(document.getElementById('authEmail').value, document.getElementById('authPassword').value)" 
                                class="btn-primary">Login</button>
                        <button onclick="backupModule.firebaseRegister(document.getElementById('authEmail').value, document.getElementById('authPassword').value)" 
                                class="btn-secondary">Daftar</button>
                    </div>
                </div>
            `;
        }
        
        return `
            <div class="modern-card" style="margin-bottom: 20px; border: 2px solid #ff6b35;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <div>
                        <div style="font-size: 16px; font-weight: 600; color: #2d3748;">🔥 Firebase Cloud</div>
                        <div style="font-size: 13px; color: #276749;">✅ ${this.currentUser ? this.currentUser.email : (this.auth && this.auth.currentUser ? this.auth.currentUser.email : 'User')}</div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button onclick="backupModule.editFirebaseConfig()" class="btn-secondary" style="padding: 8px 16px; font-size: 12px;">
                            ⚙️ Config
                        </button>
                        <button onclick="backupModule.firebaseLogout()" class="btn-danger" style="background: #e53e3e; padding: 8px 16px; font-size: 12px;">Logout</button>
                    </div>
                </div>
                
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding: 16px; background: #fffaf0; border-radius: 8px; border: 2px solid #ed8936;">
                    <div>
                        <div style="font-size: 16px; font-weight: 600; color: #2d3748;">🔄 Auto Sync</div>
                        <div style="font-size: 12px; color: #718096; margin-top: 4px;">
                            ${this.isAutoSyncEnabled ? 'Sinkronisasi otomatis aktif setiap 3 menit' : 'Sinkronisasi manual'}
                        </div>
                    </div>
                    <div onclick="backupModule.toggleAutoSync()" class="toggle-switch ${this.isAutoSyncEnabled ? 'active' : ''}" style="flex-shrink: 0;"></div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                    <button onclick="backupModule.uploadDataFirebase()" class="btn-primary" style="background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);">⬆️ Upload</button>
                    <button onclick="backupModule.downloadDataFirebase()" class="btn-primary" style="background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%);">⬇️ Download</button>
                </div>
                
                <div style="margin-bottom: 16px;">
                    <button onclick="backupModule.verifyUploadFirebase()" class="btn-primary" style="width: 100%; background: linear-gradient(135deg, #ed8936 0%, #dd6b20 100%);">
                        🔍 Cek Data di Firebase
                    </button>
                </div>
                
                <div id="devicesList" style="font-size: 12px; color: #718096;"></div>
            </div>
        `;
    },

    editFirebaseConfig: function() {
        this.firebaseApp = null;
        this.database = null;
        this.auth = null;
        this.currentUser = null;
        this.stopAutoSync();
        this.render();
    },

    renderGoogleSheetSection: function() {
        const hasUrl = this.gasUrl && this.gasUrl.length > 10;
        
        return `
            <div class="modern-card" style="margin-bottom: 20px; border: 2px solid #34a853;">
                <div style="font-size: 16px; font-weight: 600; color: #2d3748; margin-bottom: 16px;">
                    📊 Google Sheets Configuration
                </div>
                
                <div style="margin-bottom: 16px;">
                    <input type="text" id="gasUrl" value="${this.gasUrl || ''}" 
                           placeholder="https://script.google.com/macros/s/.../exec" 
                           class="form-input">
                </div>
                
                <button onclick="backupModule.saveGasUrl()" class="btn-primary" style="width: 100%; margin-bottom: 16px;">
                    💾 Simpan URL
                </button>
                
                ${hasUrl ? `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding: 16px; background: #fffaf0; border-radius: 8px; border: 2px solid #ed8936;">
                        <div>
                            <div style="font-size: 16px; font-weight: 600; color: #2d3748;">🔄 Auto Sync</div>
                            <div style="font-size: 12px; color: #718096; margin-top: 4px;">
                                ${this.isAutoSyncEnabled ? 'Sinkronisasi otomatis aktif setiap 3 menit' : 'Sinkronisasi manual'}
                            </div>
                        </div>
                        <div onclick="backupModule.toggleAutoSync()" class="toggle-switch ${this.isAutoSyncEnabled ? 'active' : ''}" style="flex-shrink: 0;"></div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <button onclick="backupModule.uploadDataGAS()" class="btn-primary" style="background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);">⬆️ Upload</button>
                        <button onclick="backupModule.downloadDataGAS()" class="btn-primary" style="background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%);">⬇️ Download</button>
                    </div>
                ` : ''}
            </div>
        `;
    },

    renderLocalInfoSection: function() {
        return `
            <div class="modern-card" style="margin-bottom: 20px; background: #f0fff4; border: 2px solid #48bb78;">
                <div style="font-size: 16px; font-weight: 600; color: #2d3748; margin-bottom: 8px;">
                    💾 Mode Local
                </div>
                <div style="font-size: 13px; color: #718096;">
                    Data hanya tersimpan di device ini. Gunakan menu di bawah untuk backup manual ke file JSON.
                </div>
            </div>
        `;
    },

    renderStatCard: function(icon, label, value, bgColor, textColor) {
        return `
            <div class="stat-card" style="background: ${bgColor};">
                <div style="font-size: 24px; margin-bottom: 4px;">${icon}</div>
                <div style="font-size: 11px; color: #718096; text-transform: uppercase; margin-bottom: 4px;">${label}</div>
                <div style="font-size: 20px; font-weight: 700; color: ${textColor};">${value}</div>
            </div>
        `;
    },

    loadAndRenderDevices: function() {
        this.getConnectedDevices((devices) => {
            const container = document.getElementById('devicesList');
            if (!container) return;
            
            if (devices.length === 0) {
                container.innerHTML = '';
                return;
            }
            
            container.innerHTML = '<div style="font-weight: 600; margin-bottom: 8px;">Device Online:</div>' +
                devices.map(device => {
                    const isOnline = device.isOnline;
                    const isThisDevice = device.id === this.deviceId;
                    return `<div style="display: flex; align-items: center; padding: 6px; background: ${isThisDevice ? '#f0fff4' : '#f7fafc'}; border-radius: 6px; margin-bottom: 4px;">
                        <span style="margin-right: 8px;">${isOnline ? '🟢' : '⚪'}</span>
                        <span style="flex: 1; font-size: 12px;">${device.name || 'Unknown'}${isThisDevice ? ' (Anda)' : ''}</span>
                    </div>`;
                }).join('');
        });
    },

    saveGasUrl: function() {
        const input = document.getElementById('gasUrl');
        if (!input) return;
        const url = input.value.trim();
        
        if (!url || url.length < 20 || !url.includes('script.google.com')) {
            this.showToast('❌ URL tidak valid!');
            return;
        }
        
        this.gasUrl = url;
        localStorage.setItem(this.GAS_URL_KEY, url);
        this.showToast('✅ URL tersimpan!');
        this.render();
    },

    formatRupiah: function(amount) {
        if (!amount && amount !== 0) return 'Rp 0';
        return 'Rp ' + amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    },

    showToast: function(msg) {
        const t = document.getElementById('toast');
        if (t) { 
            t.textContent = msg; 
            t.classList.add('show'); 
            setTimeout(() => { t.classList.remove('show'); }, 4000); 
        } else {
            alert(msg);
        }
    }
};

// ============================================
// 3. ROUTER SYSTEM
// ============================================
const router = {
    currentPage: null,
    allowedWhenClosed: ['backup', 'users'],

    navigate(page, element) {
        const isKasirOpen = app.data && app.data.kasir && app.data.kasir.isOpen;
        const currentUser = dataManager.getCurrentUser();

        if (!isKasirOpen && !this.allowedWhenClosed.includes(page)) {
            this.showKasirClosedModal();
            return;
        }

        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        if (element) element.classList.add('active');

        document.getElementById('cartBar').style.display = 'none';
        this.currentPage = page;

        switch(page) {
            case 'pos':
                if (typeof posModule !== 'undefined') posModule.init();
                document.getElementById('cartBar').style.display = 'flex';
                break;
            case 'products':
                if (typeof productsModule !== 'undefined') productsModule.init();
                break;
            case 'cash':
                if (typeof cashModule !== 'undefined') cashModule.init();
                break;
            case 'reports':
                if (typeof reportsModule !== 'undefined') reportsModule.init();
                break;
            case 'transactions':
                if (typeof transactionsModule !== 'undefined') transactionsModule.init();
                break;
            case 'receipt':
                if (typeof receiptModule !== 'undefined') receiptModule.init();
                break;
            case 'backup':
                backupModule.init();
                break;
            case 'debt':
                if (typeof debtModule !== 'undefined') debtModule.init();
                break;
            case 'users':
                if (typeof usersModule !== 'undefined') usersModule.init();
                break;
        }
        window.scrollTo(0, 0);
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
    }
};

// ============================================
// 4. MAIN APP
// ============================================
const app = {
    data: null,
    currentUser: null,

    init() {
        console.log('[App] Initializing...');
        
        if (typeof dataManager !== 'undefined') {
            dataManager.init();
            this.data = dataManager.data;
        } else {
            console.error('[App] dataManager not found!');
            return;
        }

        if (typeof backupModule !== 'undefined') {
            backupModule.init();
        }

        const loginStoreName = document.getElementById('loginStoreName');
        if (loginStoreName && this.data.settings) {
            loginStoreName.textContent = this.data.settings.storeName || 'Hifzi Cell';
        }

        this.currentUser = dataManager.getCurrentUser();
        console.log('[App] Current user:', this.currentUser);

        if (!this.currentUser) {
            console.log('[App] No user logged in, showing login');
            this.showLogin();
            return;
        }

        console.log('[App] User logged in, checking kasir status');
        this.handleLoggedIn();
    },

    showLogin() {
        document.getElementById('loginContainer').style.display = 'flex';
        document.getElementById('appContainer').classList.remove('active');
        
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

    handleLoggedIn() {
        console.log('[App] Handling logged in user');
        
        if (typeof dataManager !== 'undefined') {
            dataManager.init();
            this.data = dataManager.data;
        }
        
        document.getElementById('loginContainer').style.display = 'none';
        document.getElementById('appContainer').classList.add('active');
        
        this.updateHeader();
        this.updateKasirStatus();
        
        const kasirStatus = dataManager.checkKasirStatusForUser(this.currentUser.userId);
        console.log('[App] Kasir status:', kasirStatus);
        
        if (kasirStatus.reason === 'already_open_same_user') {
            console.log('[App] Kasir already open, going to POS');
            this.showToast(`Selamat datang kembali, ${this.currentUser.name}! 👋`);
            const defaultTab = document.querySelector('.nav-tab');
            if (defaultTab) defaultTab.classList.add('active');
            if (typeof posModule !== 'undefined') posModule.init();
            document.getElementById('cartBar').style.display = 'flex';
        } else if (kasirStatus.reason === 'new_day_same_user') {
            console.log('[App] New day, showing confirm modal');
            this.showNewDayConfirmModal();
        } else if (kasirStatus.reason === 'different_user') {
            console.log('[App] Different user using kasir');
            this.showKasirUsedByOtherModal();
        } else {
            console.log('[App] Kasir closed, showing closed page');
            this.showKasirClosedPage();
        }
    },

    showNewDayConfirmModal() {
        const modalHTML = `
            <div class="modal active" id="newDayModal" style="display: flex; z-index: 3500; align-items: flex-start; padding-top: 100px;">
                <div class="modal-content" style="max-width: 350px; text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 15px;">🌅</div>
                    <div class="modal-header" style="justify-content: center;">
                        <span class="modal-title" style="font-size: 16px;">Shift Baru Hari Ini</span>
                    </div>
                    <p style="color: #666; margin: 15px 0; line-height: 1.6; font-size: 14px;">
                        Hai <b>${this.currentUser.name}</b>!<br><br>
                        Kasir terakhir dibuka kemarin.<br>
                        Modal akan direset ke <b>Rp 0</b> untuk shift hari ini.
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

    showKasirUsedByOtherModal() {
        const currentKasirUser = this.data.kasir.currentUser;
        const users = dataManager.getUsers();
        const userInfo = users.find(u => u.id === currentKasirUser);
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
                        Silakan tunggu atau hubungi admin.
                    </p>
                    <button class="btn btn-secondary" onclick="app.logout()" style="width: 100%;">Logout</button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    confirmOpenKasir(forceReset) {
        const newDayModal = document.getElementById('newDayModal');
        if (newDayModal) newDayModal.remove();

        const result = dataManager.openKasir(this.currentUser.userId, forceReset);
        
        if (result.success) {
            this.updateHeader();
            this.updateKasirStatus();
            this.showToast(result.message);
            
            const defaultTab = document.querySelector('.nav-tab');
            if (defaultTab) defaultTab.classList.add('active');
            if (typeof posModule !== 'undefined') posModule.init();
            document.getElementById('cartBar').style.display = 'flex';
        }
    },

    closeKasir() {
        if (!confirm('🚪 Yakin ingin menutup kasir?\n\nSemua transaksi hari ini akan disimpan.\nAnda perlu login ulang untuk membuka kasir lagi.')) {
            return;
        }

        const result = dataManager.closeKasir();
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
            dataManager.save();
        }
        
        localStorage.removeItem('hifzi_current_user');
        
        this.currentUser = null;
        location.reload();
    },

    updateHeader() {
        if (!this.data) return;
        
        const headerStoreName = document.getElementById('headerStoreName');
        const headerStoreAddress = document.getElementById('headerStoreAddress');
        
        if (headerStoreName) headerStoreName.textContent = this.data.settings.storeName || 'HIFZI CELL';
        if (headerStoreAddress) headerStoreAddress.textContent = this.data.settings.address || 'Alamat Belum Diatur';
        
        const currentCashEl = document.getElementById('currentCash');
        const modalAwalEl = document.getElementById('modalAwal');
        
        if (currentCashEl) currentCashEl.textContent = 'Rp ' + this.formatNumber(this.data.settings.currentCash || 0);
        if (modalAwalEl) modalAwalEl.textContent = 'Rp ' + this.formatNumber(this.data.settings.modalAwal || 0);
        
        const todayProfit = this.calculateTodayProfit();
        const headerProfitEl = document.getElementById('headerProfit');
        if (headerProfitEl) headerProfitEl.textContent = 'Rp ' + this.formatNumber(todayProfit);
        
        const todayTransCount = this.calculateTodayTransactionCount();
        const transCountEl = document.getElementById('headerTransactionCount');
        if (transCountEl) transCountEl.textContent = todayTransCount;

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

    updateKasirButton() {
        const kasirBtn = document.getElementById('kasirToggleBtn');
        if (!kasirBtn) return;

        const isOpen = this.data.kasir && this.data.kasir.isOpen;
        if (isOpen) {
            kasirBtn.innerHTML = '🔒 Tutup Kasir';
            kasirBtn.style.background = '#ff4757';
            kasirBtn.onclick = () => this.closeKasir();
        } else {
            kasirBtn.innerHTML = '🔓 Buka Kasir';
            kasirBtn.style.background = '#2ed573';
            kasirBtn.onclick = () => this.confirmOpenKasir(true);
        }
    },

    calculateTodayProfit() {
        if (!this.data || !this.data.transactions) return 0;
        const today = new Date().toDateString();
        return this.data.transactions
            .filter(t => new Date(t.date).toDateString() === today && t.status !== 'deleted' && t.status !== 'voided')
            .reduce((sum, t) => sum + (t.profit || 0), 0);
    },

    calculateTodayTransactionCount() {
        if (!this.data || !this.data.transactions) return 0;
        const today = new Date().toDateString();
        return this.data.transactions
            .filter(t => new Date(t.date).toDateString() === today && t.status !== 'deleted' && t.status !== 'voided')
            .length;
    },

    updateKasirStatus() {
        if (!this.data || !this.data.kasir) return;
        
        const isOpen = this.data.kasir.isOpen;
        const dot = document.getElementById('kasirStatusDot');
        const text = document.getElementById('kasirStatusText');
        const shiftStatus = document.getElementById('shiftStatus');
        const indicator = document.getElementById('kasirStatusIndicator');

        if (isOpen) {
            if (dot) dot.style.background = '#00b894';
            if (text) text.textContent = '🔓 Kasir Buka';
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

    showKasirClosedPage() {
        const container = document.getElementById('mainContent');
        if (!container) return;

        container.innerHTML = `
            <div class="content-section active" style="text-align: center; padding: 40px 20px;">
                <div style="font-size: 64px; margin-bottom: 15px;">🔒</div>
                <h2 style="color: #c62828; margin-bottom: 15px; font-size: 20px;">Kasir Sedang Tutup</h2>
                <p style="color: #666; margin-bottom: 30px; line-height: 1.6; font-size: 14px;">
                    Selamat datang, <b>${this.currentUser ? this.currentUser.name : ''}</b>!<br>
                    Silakan buka kasir untuk memulai shift kerja.
                </p>

                <div style="background: #e8f5e9; border: 2px solid #4caf50; border-radius: 16px; padding: 20px; max-width: 350px; margin: 0 auto 20px;">
                    <div style="font-size: 13px; color: #666; margin-bottom: 10px;">
                        📅 Hari ini: ${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                    <div style="font-size: 12px; color: #888;">
                        ${this.data.kasir.date ? `Shift terakhir: ${new Date(this.data.kasir.date).toLocaleDateString('id-ID')}` : 'Belum ada shift hari ini'}
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
    },

    openSettings() {
        const existingModal = document.getElementById('settingsModal');
        if (existingModal) existingModal.remove();

        const modalHTML = `
            <div class="modal active" id="settingsModal" style="display: flex; z-index: 4000; align-items: flex-start; padding-top: 80px;">
                <div class="modal-content" style="max-width: 380px; width: 90%; max-height: 80vh; overflow-y: auto; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
                    <div class="modal-header" style="padding: 15px 20px; border-bottom: 1px solid #eee;">
                        <span class="modal-title" style="font-size: 16px; font-weight: 600;">⚙️ Pengaturan Toko</span>
                        <button onclick="app.closeSettings()" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #666; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 50%;">×</button>
                    </div>
                    
                    <div style="padding: 20px;">
                        <div style="margin-bottom: 15px;">
                            <label style="display: block; font-weight: 600; margin-bottom: 6px; font-size: 13px; color: #555;">Nama Toko</label>
                            <input type="text" id="settingStoreName" 
                                   value="${this.data.settings.storeName || 'Hifzi Cell'}" 
                                   style="width: 100%; padding: 10px 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; box-sizing: border-box;">
                        </div>
                        
                        <div style="margin-bottom: 15px;">
                            <label style="display: block; font-weight: 600; margin-bottom: 6px; font-size: 13px; color: #555;">Alamat Toko</label>
                            <textarea id="settingStoreAddress" 
                                      style="width: 100%; padding: 10px 12px; border: 2px solid #e0e0e0; border-radius: 8px; min-height: 50px; resize: vertical; font-size: 14px; box-sizing: border-box; font-family: inherit;">${this.data.settings.address || ''}</textarea>
                        </div>
                        
                        <div style="margin-bottom: 15px;">
                            <label style="display: block; font-weight: 600; margin-bottom: 6px; font-size: 13px; color: #555;">Nomor Telepon</label>
                            <input type="text" id="settingStorePhone" 
                                   value="${this.data.settings.phone || ''}" 
                                   style="width: 100%; padding: 10px 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; box-sizing: border-box;">
                        </div>

                        <div style="margin-bottom: 20px;">
                            <label style="display: block; font-weight: 600; margin-bottom: 6px; font-size: 13px; color: #555;">Pajak Default (%)</label>
                            <input type="number" id="settingTax" 
                                   value="${this.data.settings.tax || 0}" 
                                   style="width: 100%; padding: 10px 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; box-sizing: border-box;">
                        </div>
                        
                        <hr style="border: none; border-top: 1px solid #eee; margin: 15px 0;">
                        
                        <div style="margin-bottom: 10px;">
                            <label style="display: block; font-weight: 600; margin-bottom: 10px; color: #d32f2f; font-size: 13px;">⚠️ Zona Berbahaya</label>
                            <div style="display: grid; gap: 8px;">
                                <button onclick="app.confirmResetData()" 
                                        style="padding: 10px; background: #ffebee; color: #c62828; border: 1px solid #ef5350; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 500;">
                                    🗑️ Reset Semua Data
                                </button>
                                <button onclick="app.exportData()" 
                                        style="padding: 10px; background: #e3f2fd; color: #1565c0; border: 1px solid #42a5f5; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 500;">
                                    💾 Export Data (JSON)
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 10px; justify-content: flex-end; padding: 0 20px 20px;">
                        <button onclick="app.closeSettings()" 
                                style="padding: 10px 20px; background: #f5f5f5; border: none; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 500; color: #666;">Batal</button>
                        <button onclick="app.saveSettings()" 
                                style="padding: 10px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600;">Simpan Perubahan</button>
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

// ============================================
// 5. INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('[App] DOM Content Loaded');
    app.init();
});

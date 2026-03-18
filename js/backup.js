// ============================================
// HIFZI CELL - COMPLETE UNIFIED SYSTEM
// Urutan: dataManager → backupModule → router → app
// ============================================

// ============================================
// 1. DATA MANAGER (Database Lokal)
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
        
        // Trigger auto-sync jika backupModule sudah ada dan aktif
        if (typeof backupModule !== 'undefined' && backupModule.isAutoSyncEnabled && backupModule.gasUrl) {
            backupModule.uploadData(true);
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
// 2. BACKUP MODULE (Cloud Sync Only)
// ============================================
const backupModule = {
    currentProvider: 'local',
    gasUrl: '',
    isAutoSyncEnabled: false,
    lastSyncTime: null,
    autoSyncInterval: null,
    
    GAS_URL_KEY: 'hifzi_gas_url',
    AUTO_SYNC_KEY: 'hifzi_auto_sync',
    LAST_SYNC_KEY: 'hifzi_last_sync',

    init() {
        console.log('[Backup] Initializing...');
        
        this.gasUrl = localStorage.getItem(this.GAS_URL_KEY) || '';
        this.isAutoSyncEnabled = localStorage.getItem(this.AUTO_SYNC_KEY) === 'true';
        this.lastSyncTime = localStorage.getItem(this.LAST_SYNC_KEY) || null;
        
        if (this.gasUrl && this.gasUrl.length > 10) {
            this.currentProvider = 'googlesheet';
            
            // Auto-download jika device baru (tidak ada data)
            if (!this.hasLocalData()) {
                console.log('[Backup] New device, auto-downloading...');
                setTimeout(() => this.downloadData(true), 1000);
            }
        }
        
        if (this.isAutoSyncEnabled && this.gasUrl) {
            this.startAutoSync();
        }
    },

    hasLocalData() {
        const data = dataManager.getAllData();
        return (
            (data.products && data.products.length > 0) ||
            (data.transactions && data.transactions.length > 0)
        );
    },

    // Cloud Sync Methods
    uploadData(silent = false, callback) {
        if (!this.gasUrl) {
            if (!silent) this.showToast('❌ URL GAS belum diisi!');
            if (callback) callback(false);
            return;
        }

        const data = dataManager.getAllData();
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
        .then(r => r.json())
        .then(result => {
            if (result?.success) {
                this.lastSyncTime = new Date().toISOString();
                localStorage.setItem(this.LAST_SYNC_KEY, this.lastSyncTime);
                if (!silent) this.showToast('✅ Upload berhasil!');
                this.render();
                if (callback) callback(true);
            } else {
                throw new Error(result?.message || 'Failed');
            }
        })
        .catch(err => {
            console.log('[Backup] Fetch failed, trying JSONP:', err);
            this.uploadJSONP(payload, silent, callback);
        });
    },

    uploadJSONP(payload, silent, callback) {
        const jsonStr = JSON.stringify(payload);
        if (jsonStr.length > 8000) {
            this.uploadIframe(payload, silent, callback);
            return;
        }

        const encoded = encodeURIComponent(jsonStr);
        const cbName = 'up_' + Date.now();

        window[cbName] = (result) => {
            if (result?.success) {
                this.lastSyncTime = new Date().toISOString();
                localStorage.setItem(this.LAST_SYNC_KEY, this.lastSyncTime);
                if (!silent) this.showToast('✅ Upload berhasil!');
                this.render();
                if (callback) callback(true);
            } else {
                if (!silent) this.showToast('❌ Upload gagal');
                if (callback) callback(false);
            }
            delete window[cbName];
        };

        const script = document.createElement('script');
        script.onerror = () => {
            this.uploadIframe(payload, silent, callback);
            delete window[cbName];
        };
        script.src = `${this.gasUrl}?callback=${cbName}&data=${encoded}`;
        document.head.appendChild(script);

        setTimeout(() => {
            if (window[cbName]) {
                delete window[cbName];
                if (callback) callback(false);
            }
        }, 15000);
    },

    uploadIframe(payload, silent, callback) {
        const formId = 'frm_' + Date.now();
        const iframeId = 'ifrm_' + Date.now();

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
                const result = JSON.parse(doc.body.innerText);
                if (result?.success) {
                    this.lastSyncTime = new Date().toISOString();
                    localStorage.setItem(this.LAST_SYNC_KEY, this.lastSyncTime);
                    if (!silent) this.showToast('✅ Upload selesai');
                    if (callback) callback(true);
                }
            } catch (e) {
                this.lastSyncTime = new Date().toISOString();
                localStorage.setItem(this.LAST_SYNC_KEY, this.lastSyncTime);
                if (!silent) this.showToast('✅ Upload selesai');
                if (callback) callback(true);
            }
            setTimeout(() => {
                document.getElementById(formId)?.remove();
                document.getElementById(iframeId)?.remove();
            }, 2000);
        };

        form.submit();
    },

    downloadData(silent = false) {
        if (!this.gasUrl) {
            if (!silent) this.showToast('❌ URL GAS belum diisi!');
            return;
        }

        if (!silent && !confirm('📥 Download akan mengganti data lokal. Lanjutkan?')) return;
        if (!silent) this.showToast('⬇️ Mengunduh...');

        fetch(`${this.gasUrl}?action=restore&_t=${Date.now()}`)
        .then(r => r.json())
        .then(result => this.handleDownload(result, silent))
        .catch(() => this.downloadJSONP(silent));
    },

    downloadJSONP(silent) {
        const cbName = 'dl_' + Date.now();
        
        window[cbName] = (result) => {
            this.handleDownload(result, silent);
            delete window[cbName];
        };

        const script = document.createElement('script');
        script.onerror = () => {
            if (!silent) this.showToast('❌ Gagal terhubung');
            delete window[cbName];
        };
        script.src = `${this.gasUrl}?action=restore&callback=${cbName}&_t=${Date.now()}`;
        document.head.appendChild(script);

        setTimeout(() => {
            if (window[cbName]) delete window[cbName];
        }, 20000);
    },

    handleDownload(result, silent) {
        if (result?.success && result.data) {
            dataManager.saveAllData(result.data);
            this.lastSyncTime = new Date().toISOString();
            localStorage.setItem(this.LAST_SYNC_KEY, this.lastSyncTime);
            
            const stats = dataManager.getAllData();
            if (!silent) {
                this.showToast(`✅ Download OK! P:${stats.products.length} T:${stats.transactions.length}`);
                setTimeout(() => location.reload(), 1500);
            }
            this.render();
        } else {
            if (!silent) this.showToast('❌ Download gagal');
        }
    },

    startAutoSync() {
        this.stopAutoSync();
        this.performTwoWaySync();
        this.autoSyncInterval = setInterval(() => this.performTwoWaySync(), 180000);
        console.log('[Backup] Auto sync started');
    },

    stopAutoSync() {
        if (this.autoSyncInterval) {
            clearInterval(this.autoSyncInterval);
            this.autoSyncInterval = null;
        }
    },

    performTwoWaySync() {
        this.uploadData(true, (success) => {
            if (success) {
                this.getCloudTimestamp((cloudTime) => {
                    if (cloudTime && cloudTime > this.lastSyncTime) {
                        this.downloadData(true);
                    }
                });
            }
        });
    },

    getCloudTimestamp(callback) {
        const cbName = 'ts_' + Date.now();
        
        window[cbName] = (result) => {
            callback(result?.timestamp || null);
            delete window[cbName];
        };

        const script = document.createElement('script');
        script.onerror = () => {
            callback(null);
            delete window[cbName];
        };
        script.src = `${this.gasUrl}?action=getTimestamp&callback=${cbName}&_t=${Date.now()}`;
        document.head.appendChild(script);

        setTimeout(() => {
            if (window[cbName]) {
                callback(null);
                delete window[cbName];
            }
        }, 10000);
    },

    // UI Render
    render() {
        const container = document.getElementById('mainContent');
        if (!container) return;

        const data = dataManager.getAllData();
        const stats = {
            products: data.products?.length || 0,
            transactions: data.transactions?.length || 0,
            debts: data.debts?.length || 0,
            currentCash: data.settings?.currentCash || 0,
            storeName: data.settings?.storeName || 'HIFZI CELL'
        };

        const isCloud = this.currentProvider === 'googlesheet' && this.gasUrl;

        container.innerHTML = `
            <div class="content-section active" style="padding: 16px; max-width: 1200px; margin: 0 auto;">
                
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-size: 14px; opacity: 0.9;">Status Sinkronisasi</div>
                            <div style="font-size: 20px; font-weight: 600;">
                                ${this.isAutoSyncEnabled ? '🟢 Auto Sync Aktif' : '⚪ Manual'}
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 12px; opacity: 0.8;">Last Sync</div>
                            <div style="font-size: 14px;">
                                ${this.lastSyncTime ? new Date(this.lastSyncTime).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'}) : 'Belum'}
                            </div>
                        </div>
                    </div>
                </div>

                <div style="background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <div style="font-size: 16px; font-weight: 600; margin-bottom: 16px;">📊 ${stats.storeName}</div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px;">
                        <div style="background: #e3f2fd; padding: 16px; border-radius: 10px; text-align: center;">
                            <div style="font-size: 20px;">📦</div>
                            <div style="font-size: 11px; color: #718096;">Produk</div>
                            <div style="font-size: 18px; font-weight: 700; color: #2196F3;">${stats.products}</div>
                        </div>
                        <div style="background: #fff3e0; padding: 16px; border-radius: 10px; text-align: center;">
                            <div style="font-size: 20px;">📝</div>
                            <div style="font-size: 11px; color: #718096;">Transaksi</div>
                            <div style="font-size: 18px; font-weight: 700; color: #FF9800;">${stats.transactions}</div>
                        </div>
                        <div style="background: #f3e5f5; padding: 16px; border-radius: 10px; text-align: center;">
                            <div style="font-size: 20px;">💳</div>
                            <div style="font-size: 11px; color: #718096;">Hutang</div>
                            <div style="font-size: 18px; font-weight: 700; color: #9C27B0;">${stats.debts}</div>
                        </div>
                        <div style="background: #e0f2f1; padding: 16px; border-radius: 10px; text-align: center;">
                            <div style="font-size: 20px;">🏦</div>
                            <div style="font-size: 11px; color: #718096;">Kas</div>
                            <div style="font-size: 18px; font-weight: 700; color: #009688;">Rp ${stats.currentCash.toLocaleString('id-ID')}</div>
                        </div>
                    </div>
                </div>

                <div style="background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                    <div style="font-size: 16px; font-weight: 600; margin-bottom: 16px;">☁️ Metode Backup</div>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
                        <div onclick="backupModule.setProvider('local')" 
                             style="padding: 16px; border: 2px solid ${!isCloud ? '#48bb78' : '#e2e8f0'}; border-radius: 10px; text-align: center; cursor: pointer; background: ${!isCloud ? '#f0fff4' : 'white'};">
                            <div style="font-size: 24px;">💾</div>
                            <div style="font-weight: 600;">Local File</div>
                        </div>
                        <div onclick="backupModule.setProvider('googlesheet')" 
                             style="padding: 16px; border: 2px solid ${isCloud ? '#48bb78' : '#e2e8f0'}; border-radius: 10px; text-align: center; cursor: pointer; background: ${isCloud ? '#f0fff4' : 'white'};">
                            <div style="font-size: 24px;">📊</div>
                            <div style="font-weight: 600;">Google Sheets</div>
                        </div>
                    </div>
                </div>

                ${isCloud ? `
                    <div style="background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; border: 2px solid #667eea;">
                        <div style="font-size: 16px; font-weight: 600; margin-bottom: 16px;">📊 Google Sheets Config</div>
                        
                        <input type="text" id="gasUrl" value="${this.gasUrl}" 
                               placeholder="https://script.google.com/macros/s/.../exec" 
                               style="width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 12px; box-sizing: border-box;">
                        
                        <button onclick="backupModule.saveUrl()" style="width: 100%; padding: 12px; background: #48bb78; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; margin-bottom: 16px;">
                            💾 Simpan URL
                        </button>

                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding: 12px; background: #fffaf0; border-radius: 8px;">
                            <span>Auto Sync (3 menit)</span>
                            <div onclick="backupModule.toggleAutoSync()" style="width: 48px; height: 24px; background: ${this.isAutoSyncEnabled ? '#48bb78' : '#cbd5e0'}; border-radius: 12px; cursor: pointer; position: relative;">
                                <div style="width: 20px; height: 20px; background: white; border-radius: 50%; position: absolute; top: 2px; left: ${this.isAutoSyncEnabled ? '26px' : '2px'}; transition: 0.3s;"></div>
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                            <button onclick="backupModule.uploadData()" style="padding: 12px; background: #4299e1; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                                ⬆️ Upload
                            </button>
                            <button onclick="backupModule.downloadData()" style="padding: 12px; background: #ed8936; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                                ⬇️ Download
                            </button>
                        </div>
                    </div>
                ` : ''}

                <div style="background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                    <div style="font-size: 16px; font-weight: 600; margin-bottom: 16px;">💾 Backup File</div>
                    <button onclick="backupModule.downloadJSON()" style="width: 100%; padding: 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; margin-bottom: 12px;">
                        ⬇️ Download JSON
                    </button>
                    <label style="display: block; padding: 16px; border: 2px dashed #cbd5e0; border-radius: 8px; text-align: center; cursor: pointer;">
                        <input type="file" accept=".json" onchange="backupModule.importJSON(this)" style="display: none;">
                        <div style="font-size: 20px;">📤</div>
                        <div>Import JSON</div>
                    </label>
                </div>

                <div style="background: #fff5f5; border: 1px solid #feb2b2; padding: 20px; border-radius: 12px;">
                    <div style="font-size: 16px; font-weight: 600; color: #c53030; margin-bottom: 12px;">🗑️ Zona Bahaya</div>
                    <button onclick="backupModule.resetLocal()" style="width: 100%; padding: 12px; background: #e53e3e; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                        Hapus Data Lokal
                    </button>
                    ${isCloud ? `
                        <button onclick="backupModule.resetCloud()" style="width: 100%; padding: 12px; background: #805ad5; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; margin-top: 8px;">
                            Reset Cloud
                        </button>
                    ` : ''}
                </div>

            </div>
        `;
    },

    setProvider(provider) {
        this.currentProvider = provider;
        this.render();
    },

    saveUrl() {
        const input = document.getElementById('gasUrl');
        const url = input?.value?.trim();
        
        if (!url || !url.includes('script.google.com')) {
            this.showToast('❌ URL tidak valid!');
            return;
        }
        
        this.gasUrl = url;
        localStorage.setItem(this.GAS_URL_KEY, url);
        this.currentProvider = 'googlesheet';
        this.showToast('✅ URL disimpan!');
        this.render();
    },

    toggleAutoSync() {
        this.isAutoSyncEnabled = !this.isAutoSyncEnabled;
        localStorage.setItem(this.AUTO_SYNC_KEY, this.isAutoSyncEnabled);
        
        if (this.isAutoSyncEnabled) {
            this.startAutoSync();
            this.showToast('🟢 Auto sync aktif');
        } else {
            this.stopAutoSync();
            this.showToast('⚪ Auto sync mati');
        }
        this.render();
    },

    resetLocal() {
        if (!confirm('⚠️ Hapus semua data lokal?')) return;
        if (prompt('Ketik HAPUS:') !== 'HAPUS') return;

        const defaultData = {
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
            settings: {
                storeName: 'Hifzi Cell',
                address: '',
                phone: '',
                tax: 0,
                modalAwal: 0,
                currentCash: 0
            },
            kasir: {
                isOpen: false,
                openTime: null,
                closeTime: null,
                date: null,
                currentUser: null
            }
        };
        
        dataManager.saveAllData(defaultData);
        this.showToast('✅ Data dihapus!');
        setTimeout(() => location.reload(), 1500);
    },

    resetCloud() {
        if (!confirm('⚠️ Reset cloud?')) return;
        if (prompt('Ketik RESET:') !== 'RESET') return;

        fetch(this.gasUrl, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: 'reset' })
        })
        .then(() => this.showToast('✅ Cloud direset!'))
        .catch(() => this.showToast('❌ Gagal reset cloud'));
    },

    downloadJSON() {
        const data = dataManager.getAllData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `hifzi_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.showToast('✅ JSON didownload!');
    },

    importJSON(input) {
        const file = input.files[0];
        if (!file) return;
        if (!confirm('⚠️ Import akan menimpa data lokal?')) {
            input.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                dataManager.saveAllData(data);
                this.showToast('✅ Import berhasil!');
                setTimeout(() => location.reload(), 1000);
            } catch (err) {
                this.showToast('❌ Error: ' + err.message);
            }
        };
        reader.readAsText(file);
        input.value = '';
    },

    showToast(msg) {
        if (typeof app !== 'undefined' && app.showToast) {
            app.showToast(msg);
        } else {
            const toast = document.createElement('div');
            toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.8);color:white;padding:12px 24px;border-radius:8px;z-index:9999;';
            toast.textContent = msg;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        }
    }
};

// ============================================
// 3. ROUTER
// ============================================
const router = {
    currentPage: null,
    allowedWhenClosed: ['backup', 'users'],

    navigate(page, element) {
        if (typeof app === 'undefined' || !app.data) {
            console.error('[Router] App not ready');
            return;
        }

        const isKasirOpen = app.data?.kasir?.isOpen;
        
        if (!isKasirOpen && !this.allowedWhenClosed.includes(page)) {
            this.showKasirClosedModal();
            return;
        }

        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        if (element) element.classList.add('active');

        const cartBar = document.getElementById('cartBar');
        if (cartBar) cartBar.style.display = 'none';
        
        this.currentPage = page;

        switch(page) {
            case 'pos':
                if (typeof posModule !== 'undefined') posModule.init();
                if (cartBar) cartBar.style.display = 'flex';
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
                backupModule.render(); // ← Langsung render, tidak perlu init lagi
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
                    <h3>Kasir Sedang Tutup</h3>
                    <p style="color: #666; margin: 15px 0;">Silakan buka kasir terlebih dahulu.</p>
                    <button onclick="document.getElementById('kasirClosedModal').remove()" style="padding: 10px 30px; background: #4caf50; color: white; border: none; border-radius: 8px; cursor: pointer;">
                        Tutup
                    </button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
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
        
        // 1. Init dataManager
        dataManager.init();
        this.data = dataManager.data;
        
        // 2. Init backupModule (setelah dataManager)
        backupModule.init();
        
        // 3. Setup login
        const loginStoreName = document.getElementById('loginStoreName');
        if (loginStoreName) {
            loginStoreName.textContent = this.data.settings.storeName || 'Hifzi Cell';
        }

        this.currentUser = dataManager.getCurrentUser();
        
        if (!this.currentUser) {
            this.showLogin();
            return;
        }

        this.handleLoggedIn();
    },

    showLogin() {
        const loginContainer = document.getElementById('loginContainer');
        const appContainer = document.getElementById('appContainer');
        
        if (loginContainer) loginContainer.style.display = 'flex';
        if (appContainer) appContainer.classList.remove('active');
        
        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn) {
            loginBtn.onclick = () => this.doLogin();
        }
        
        const passwordInput = document.getElementById('loginPassword');
        if (passwordInput) {
            passwordInput.onkeypress = (e) => {
                if (e.key === 'Enter') this.doLogin();
            };
        }
    },

    doLogin() {
        const username = document.getElementById('loginUsername')?.value?.trim();
        const password = document.getElementById('loginPassword')?.value;
        
        if (!username || !password) {
            this.showToast('Username dan password wajib diisi!');
            return;
        }

        const result = dataManager.login(username, password);
        
        if (result.success) {
            this.currentUser = result.user;
            this.handleLoggedIn();
        } else {
            this.showToast(result.message);
        }
    },

    handleLoggedIn() {
        const loginContainer = document.getElementById('loginContainer');
        const appContainer = document.getElementById('appContainer');
        
        if (loginContainer) loginContainer.style.display = 'none';
        if (appContainer) appContainer.classList.add('active');
        
        this.updateHeader();
        
        const kasirStatus = dataManager.checkKasirStatusForUser(this.currentUser.userId);
        
        if (kasirStatus.reason === 'already_open_same_user') {
            this.showToast(`Selamat datang, ${this.currentUser.name}!`);
            const defaultTab = document.querySelector('.nav-tab');
            if (defaultTab) defaultTab.classList.add('active');
            if (typeof posModule !== 'undefined') posModule.init();
            const cartBar = document.getElementById('cartBar');
            if (cartBar) cartBar.style.display = 'flex';
        } else if (kasirStatus.reason === 'new_day_same_user') {
            this.showNewDayModal();
        } else if (kasirStatus.reason === 'different_user') {
            this.showKasirUsedModal();
        } else {
            this.showKasirClosedPage();
        }
    },

    showNewDayModal() {
        const modalHTML = `
            <div class="modal active" style="display: flex; z-index: 3500; padding-top: 100px;">
                <div class="modal-content" style="max-width: 350px; text-align: center;">
                    <div style="font-size: 48px;">🌅</div>
                    <h3>Shift Baru Hari Ini</h3>
                    <p>Modal akan direset ke Rp 0</p>
                    <button onclick="app.confirmOpenKasir(true)" style="padding: 12px 24px; background: #48bb78; color: white; border: none; border-radius: 8px; cursor: pointer;">
                        Buka Kasir
                    </button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    confirmOpenKasir(forceReset) {
        document.querySelector('.modal')?.remove();
        const result = dataManager.openKasir(this.currentUser.userId, forceReset);
        
        if (result.success) {
            this.updateHeader();
            this.showToast(result.message);
            const defaultTab = document.querySelector('.nav-tab');
            if (defaultTab) defaultTab.classList.add('active');
            if (typeof posModule !== 'undefined') posModule.init();
            const cartBar = document.getElementById('cartBar');
            if (cartBar) cartBar.style.display = 'flex';
        }
    },

    closeKasir() {
        if (!confirm('Yakin tutup kasir?')) return;
        
        const result = dataManager.closeKasir();
        if (result.success) {
            this.showToast(result.message);
            this.showKasirClosedPage();
        }
    },

    logout() {
        dataManager.logout();
        location.reload();
    },

    updateHeader() {
        if (!this.data) return;
        
        const els = {
            storeName: document.getElementById('headerStoreName'),
            address: document.getElementById('headerStoreAddress'),
            cash: document.getElementById('currentCash'),
            modal: document.getElementById('modalAwal'),
            userName: document.getElementById('headerUserName'),
            userRole: document.getElementById('headerUserRole')
        };

        if (els.storeName) els.storeName.textContent = this.data.settings.storeName || 'HIFZI CELL';
        if (els.address) els.address.textContent = this.data.settings.address || 'Alamat Belum Diatur';
        if (els.cash) els.cash.textContent = 'Rp ' + (this.data.settings.currentCash || 0).toLocaleString('id-ID');
        if (els.modal) els.modal.textContent = 'Rp ' + (this.data.settings.modalAwal || 0).toLocaleString('id-ID');
        
        if (this.currentUser) {
            if (els.userName) els.userName.textContent = this.currentUser.name;
            if (els.userRole) els.userRole.textContent = this.currentUser.role;
        }

        // Update kasir button
        const kasirBtn = document.getElementById('kasirToggleBtn');
        if (kasirBtn) {
            const isOpen = this.data.kasir?.isOpen;
            kasirBtn.innerHTML = isOpen ? '🔒 Tutup Kasir' : '🔓 Buka Kasir';
            kasirBtn.style.background = isOpen ? '#ff4757' : '#2ed573';
            kasirBtn.onclick = isOpen ? () => this.closeKasir() : () => this.confirmOpenKasir(true);
        }
    },

    showKasirClosedPage() {
        const container = document.getElementById('mainContent');
        if (!container) return;

        container.innerHTML = `
            <div class="content-section active" style="text-align: center; padding: 40px 20px;">
                <div style="font-size: 64px;">🔒</div>
                <h2 style="color: #c62828;">Kasir Sedang Tutup</h2>
                <p>Selamat datang, <b>${this.currentUser?.name || ''}</b>!</p>
                <button onclick="app.confirmOpenKasir(true)" 
                        style="padding: 16px 32px; font-size: 16px; background: linear-gradient(135deg, #4caf50 0%, #2e7d32 100%); color: white; border: none; border-radius: 10px; cursor: pointer; margin-top: 20px;">
                    🔓 Buka Kasir Sekarang
                </button>
                <div style="margin-top: 20px;">
                    <a href="#" onclick="app.logout()" style="color: #999;">🚪 Logout</a>
                </div>
            </div>
        `;
    },

    showToast(message) {
        const existing = document.getElementById('toast');
        if (existing) existing.remove();
        
        const toast = document.createElement('div');
        toast.id = 'toast';
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.85);
            color: white;
            padding: 12px 24px;
            border-radius: 20px;
            font-size: 14px;
            z-index: 10000;
            animation: fadeIn 0.3s;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 2500);
    }
};

// ============================================
// 5. INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('[System] DOM Ready');
    app.init();
});

const dataManager = {
    // Key untuk localStorage
    STORAGE_KEY: 'hifzi_data',
    USERS_KEY: 'hifzi_users',
    CURRENT_USER_KEY: 'hifzi_current_user',
    
    // Struktur data lengkap
    data: {
        // Kategori dengan icon
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
            currentUser: null
        }
    },
    
    // Default users
    defaultUsers: [
        { id: 'admin', username: 'admin', password: 'admin123', name: 'Administrator', role: 'admin' },
        { id: 'kasir1', username: 'kasir1', password: 'kasir123', name: 'Kasir 1', role: 'kasir' }
    ],

    // ========== INIT & SAVE ==========
    
    init() {
        // Load data utama
        const saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            // Merge dengan default untuk memastikan struktur lengkap
            this.data = this.deepMerge(this.data, parsed);
        }
        
        // Pastikan struktur kasir lengkap
        if (!this.data.kasir) {
            this.data.kasir = {
                isOpen: false,
                openTime: null,
                closeTime: null,
                date: null,
                currentUser: null
            };
        }

        // Pastikan settings.phone dan settings.tax ada (untuk kompatibilitas dengan settings baru)
        if (!this.data.settings.phone) this.data.settings.phone = '';
        if (this.data.settings.tax === undefined) this.data.settings.tax = 0;
        
        // Init users jika belum ada
        let users = JSON.parse(localStorage.getItem(this.USERS_KEY));
        if (!users) {
            users = this.defaultUsers;
            localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
        }
        
        this.save();
        return this.data;
    },

    save() {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
    },

    // Alias untuk kompatibilitas dengan app.js
    saveData() {
        this.save();
    },

    // Helper untuk merge object deeply
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

    // ========== BACKWARD COMPATIBILITY (Fungsi lama) ==========
    
    load() {
        return this.init();
    },
    
    getProducts() { 
        return this.data.products; 
    },
    
    getTransactions() { 
        return this.data.transactions; 
    },
    
    getCategories() { 
        return this.data.categories; 
    },
    
    getSettings() { 
        return this.data.settings; 
    },
    
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

    // ========== FUNGSI UPDATE USER (BARU) ==========
    updateUser(userId, updateData) {
        const users = this.getUsers();
        const userIndex = users.findIndex(u => u.id === userId);
        
        if (userIndex === -1) return false;
        
        // Update fields yang diizinkan
        if (updateData.name) users[userIndex].name = updateData.name;
        if (updateData.username) users[userIndex].username = updateData.username;
        if (updateData.role) users[userIndex].role = updateData.role;
        if (updateData.password) users[userIndex].password = updateData.password;
        
        this.saveUsers(users);
        return true;
    },
    // ========== END UPDATE USER ==========

    deleteUser(userId) {
        let users = this.getUsers();
        users = users.filter(u => u.id !== userId);
        this.saveUsers(users);
    },

    // ========== AUTHENTICATION ==========
    
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
        localStorage.removeItem(this.CURRENT_USER_KEY);
        // Tutup kasir jika sedang buka
        if (this.data.kasir && this.data.kasir.isOpen) {
            this.data.kasir.isOpen = false;
            this.data.kasir.closeTime = new Date().toISOString();
            this.save();
        }
    },

    getCurrentUser() {
        const session = localStorage.getItem(this.CURRENT_USER_KEY);
        return session ? JSON.parse(session) : null;
    },

    isLoggedIn() {
        return this.getCurrentUser() !== null;
    },

    // ========== KASIR MANAGEMENT ==========
    
    checkKasirStatusForUser(userId) {
        const today = new Date().toDateString();
        const kasir = this.data.kasir;
        
        // Kasir tutup
        if (!kasir.isOpen) {
            return { canOpen: true, shouldReset: true, reason: 'closed' };
        }
        
        // Kasir sudah buka dengan user yang sama
        if (kasir.currentUser === userId) {
            // Cek apakah hari yang sama
            if (kasir.date === today) {
                // Hari sama, user sama -> LANJUTKAN (tidak reset)
                return { 
                    canOpen: false, 
                    shouldReset: false, 
                    reason: 'already_open_same_user',
                    message: 'Kasir sudah buka dengan akun Anda. Lanjutkan shift.'
                };
            } else {
                // Hari beda, user sama -> RESET (hari baru)
                return { 
                    canOpen: true, 
                    shouldReset: true, 
                    reason: 'new_day_same_user',
                    message: 'Shift baru untuk hari ini. Modal akan direset.'
                };
            }
        }
        
        // Kasir buka dengan user BERBEDA
        return { 
            canOpen: false, 
            shouldReset: false, 
            reason: 'different_user',
            message: `Kasir sedang digunakan oleh user lain. Silakan tunggu atau hubungi admin.`
        };
    },

    openKasir(userId, forceReset = false) {
        const today = new Date().toDateString();
        const status = this.checkKasirStatusForUser(userId);
        
        // Jika kasir sudah buka dengan user yang sama dan hari sama
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
        
        // Jika hari baru atau kasir tutup
        if (status.shouldReset || forceReset) {
            // SIMPAN DATA SHIFT SEBELUMNYA KE HISTORY SEBELUM RESET
            if (this.data.kasir.date && this.data.kasir.date !== today) {
                this.saveShiftHistory();
            }
            
            // Reset modal dan cash untuk hari baru
            this.data.settings.modalAwal = 0;
            this.data.settings.currentCash = 0;
        }
        
        // Buka kasir
        this.data.kasir = {
            isOpen: true,
            openTime: new Date().toISOString(),
            closeTime: null,
            date: today,
            currentUser: userId,
            lastLoginTime: new Date().toISOString()
        };
        
        this.save();
        return { 
            success: true, 
            reset: status.shouldReset,
            message: status.shouldReset ? 'Kasir dibuka dengan shift baru!' : 'Kasir dibuka!'
        };
    },

    // ========== PERBAIKAN: Simpan shift history sebelum tutup/reset ==========
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

        // Cek apakah sudah ada entry untuk tanggal ini
        const existingIndex = this.data.shiftHistory.findIndex(s => s.date === kasirDate);
        if (existingIndex !== -1) {
            // Update existing
            this.data.shiftHistory[existingIndex] = shiftSummary;
        } else {
            // Tambah baru
            this.data.shiftHistory.push(shiftSummary);
        }
    },

    closeKasir() {
        if (!this.data.kasir.isOpen) {
            return { success: false, message: 'Kasir sudah tutup!' };
        }

        const today = new Date().toDateString();
        
        // SIMPAN SHIFT HISTORY TERLEBIH DAHULU (jangan hapus data transaksi!)
        this.saveShiftHistory();

        // Update status kasir saja, TIDAK menghapus data transaksi
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

// Inisialisasi otomatis saat load
if (typeof dataManager !== 'undefined') {
    dataManager.init();
}

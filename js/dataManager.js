const dataManager = {
    // Key untuk localStorage
    STORAGE_KEY: 'hifzi_data',
    USERS_KEY: 'hifzi_users',
    CURRENT_USER_KEY: 'hifzi_current_user',
    
    data: {
        products: [],
        transactions: [],
        categories: ['Umum'],
        settings: {
            storeName: 'Hifzi Cell',
            address: '',
            currentCash: 0,
            modalAwal: 0,
            taxRate: 0,
            receiptHeader: {
                storeName: 'Hifzi Cell',
                address: '',
                phone: '',
                note: 'Terima kasih atas kunjungan Anda'
            }
        },
        kasir: {
            isOpen: false,
            openTime: null,
            closeTime: null,
            date: null,
            currentUser: null  // Tambahan: user yang sedang login
        },
        shiftHistory: [],
        debts: []
    },
    
    // Default users (bisa ditambah via UI)
    defaultUsers: [
        { id: 'admin', username: 'admin', password: 'admin123', name: 'Administrator', role: 'admin' },
        { id: 'kasir1', username: 'kasir1', password: 'kasir123', name: 'Kasir 1', role: 'kasir' }
    ],

    init() {
        // Load atau buat data users
        let users = JSON.parse(localStorage.getItem(this.USERS_KEY));
        if (!users) {
            users = this.defaultUsers;
            localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
        }
        
        // Load data utama
        const saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved) {
            this.data = JSON.parse(saved);
            // Pastikan struktur data lengkap
            if (!this.data.kasir) {
                this.data.kasir = {
                    isOpen: false,
                    openTime: null,
                    closeTime: null,
                    date: null,
                    currentUser: null
                };
            }
            if (!this.data.kasir.currentUser) {
                this.data.kasir.currentUser = null;
            }
        } else {
            this.save();
        }
    },

    save() {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
    },

    // USER MANAGEMENT
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

    deleteUser(userId) {
        let users = this.getUsers();
        users = users.filter(u => u.id !== userId);
        this.saveUsers(users);
    },

    // AUTHENTICATION
    login(username, password) {
        const users = this.getUsers();
        const user = users.find(u => u.username === username && u.password === password);
        
        if (user) {
            // Simpan session
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

    // CHECK KASIR STATUS dengan USER
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

    // OPEN KASIR dengan logic baru
    openKasir(userId, forceReset = false) {
        const today = new Date().toDateString();
        const status = this.checkKasirStatusForUser(userId);
        
        // Jika kasir sudah buka dengan user yang sama dan hari sama
        if (status.reason === 'already_open_same_user') {
            // Update waktu login tapi tidak reset modal
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
            // Reset modal untuk hari baru
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

    closeKasir() {
        if (!this.data.kasir.isOpen) {
            return { success: false, message: 'Kasir sudah tutup!' };
        }

        const today = new Date().toDateString();
        const todayTrans = this.data.transactions.filter(t => 
            new Date(t.date).toDateString() === today && t.status !== 'voided'
        );

        const currentUser = this.getCurrentUser();
        
        const shiftSummary = {
            date: today,
            userId: currentUser ? currentUser.userId : null,
            username: currentUser ? currentUser.username : 'unknown',
            openTime: this.data.kasir.openTime,
            closeTime: new Date().toISOString(),
            totalSales: todayTrans.reduce((sum, t) => sum + t.total, 0),
            totalProfit: todayTrans.reduce((sum, t) => sum + t.profit, 0),
            transactionCount: todayTrans.length,
            modalAwal: this.data.settings.modalAwal,
            cashEnd: this.data.settings.currentCash
        };

        if (!this.data.shiftHistory) this.data.shiftHistory = [];
        this.data.shiftHistory.push(shiftSummary);

        this.data.kasir.isOpen = false;
        this.data.kasir.closeTime = new Date().toISOString();
        this.data.kasir.currentUser = null;
        
        this.save();
        
        return { success: true, message: 'Kasir ditutup. Shift berakhir.' };
    }
};

// Inisialisasi saat load
dataManager.init();

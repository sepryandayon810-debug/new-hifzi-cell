const dataManager = {
    data: null,
    STORAGE_KEY: 'hifzi_data',

    initData() {
        return {
            settings: {
                storeName: 'HIFZI CELL',
                address: '',
                phone: '',
                taxRate: 0,
                currentCash: 0,
                modalAwal: 0,
                receiptHeader: {
                    storeName: 'HIFZI CELL',
                    address: '',
                    phone: '',
                    note: 'Terima kasih atas kunjungan Anda'
                }
            },
            products: [],
            transactions: [],
            cashTransactions: [],
            debts: [],
            kasir: {
                isOpen: false,
                openTime: null,
                closeTime: null
            },
            shiftHistory: []
        };
    },

    load() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                this.data = JSON.parse(stored);
                // Merge dengan default untuk field baru
                const defaults = this.initData();
                this.data = { ...defaults, ...this.data };
            } else {
                this.data = this.initData();
                this.save();
            }
        } catch (e) {
            console.error('Error loading data:', e);
            this.data = this.initData();
        }
    },

    save() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
            return true;
        } catch (e) {
            console.error('Error saving data:', e);
            return false;
        }
    },

    getData() {
        if (!this.data) this.load();
        return this.data;
    },

    // Products
    addProduct(product) {
        product.id = utils.generateId();
        product.createdAt = new Date().toISOString();
        this.data.products.push(product);
        this.save();
        return product;
    },

    updateProduct(id, updates) {
        const index = this.data.products.findIndex(p => p.id === id);
        if (index !== -1) {
            this.data.products[index] = { ...this.data.products[index], ...updates };
            this.save();
            return true;
        }
        return false;
    },

    deleteProduct(id) {
        const index = this.data.products.findIndex(p => p.id === id);
        if (index !== -1) {
            this.data.products.splice(index, 1);
            this.save();
            return true;
        }
        return false;
    },

    getProductById(id) {
        return this.data.products.find(p => p.id === id);
    },

    getProductByBarcode(barcode) {
        return this.data.products.find(p => p.barcode === barcode);
    },

    // Transactions
    addTransaction(transaction) {
        transaction.id = utils.generateId();
        transaction.createdAt = new Date().toISOString();
        this.data.transactions.push(transaction);
        this.save();
        return transaction;
    },

    updateTransaction(id, updates) {
        const index = this.data.transactions.findIndex(t => t.id === id);
        if (index !== -1) {
            this.data.transactions[index] = { ...this.data.transactions[index], ...updates };
            this.save();
            return true;
        }
        return false;
    },

    getTransactionById(id) {
        return this.data.transactions.find(t => t.id === id);
    },

    // Cash Transactions
    addCashTransaction(transaction) {
        transaction.id = Date.now();
        transaction.date = new Date().toISOString();
        this.data.cashTransactions.push(transaction);
        this.save();
        return transaction;
    },

    deleteCashTransaction(id) {
        const index = this.data.cashTransactions.findIndex(t => t.id === id);
        if (index !== -1) {
            const trans = this.data.cashTransactions[index];
            this.data.cashTransactions.splice(index, 1);
            this.save();
            return trans;
        }
        return null;
    },

    // Debts
    addDebt(debt) {
        debt.id = utils.generateId();
        debt.createdAt = new Date().toISOString();
        debt.paid = 0;
        debt.status = 'unpaid';
        this.data.debts.push(debt);
        this.save();
        return debt;
    },

    updateDebt(id, updates) {
        const index = this.data.debts.findIndex(d => d.id === id);
        if (index !== -1) {
            this.data.debts[index] = { ...this.data.debts[index], ...updates };
            // Update status
            const debt = this.data.debts[index];
            if (debt.paid >= debt.amount) {
                debt.status = 'paid';
            } else if (debt.paid > 0) {
                debt.status = 'partial';
            }
            this.save();
            return true;
        }
        return false;
    },

    deleteDebt(id) {
        const index = this.data.debts.findIndex(d => d.id === id);
        if (index !== -1) {
            this.data.debts.splice(index, 1);
            this.save();
            return true;
        }
        return false;
    },

    // Export/Import
    exportData() {
        return {
            ...this.data,
            exportedAt: new Date().toISOString()
        };
    },

    importData(data) {
        if (confirm('Import data akan MENIMPA semua data saat ini. Lanjutkan?')) {
            this.data = { ...this.initData(), ...data };
            this.save();
            return true;
        }
        return false;
    },

    // Clear all data
    clearAll() {
        if (confirm('Yakin ingin menghapus SEMUA data? Tindakan ini tidak bisa dibatalkan!')) {
            localStorage.removeItem(this.STORAGE_KEY);
            this.data = this.initData();
            return true;
        }
        return false;
    }
};

// Auto-load saat script dijalankan
dataManager.load();

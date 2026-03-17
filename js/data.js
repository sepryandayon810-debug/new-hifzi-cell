const dataManager = {
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
        lastSync: null,
        settings: {
            storeName: 'Hifzi Cell',
            address: '',
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
            date: null
        }
    },
    
    load() {
        const saved = localStorage.getItem('hifzi_cell_data');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                
                // Deep merge untuk memastikan struktur lengkap
                this.data = this.deepMerge(this.data, parsed);
                
                // ⬅️ KRITIS: Pastikan settings.currentCash adalah NUMBER
                this.data.settings.currentCash = this.parseNumber(this.data.settings.currentCash);
                this.data.settings.modalAwal = this.parseNumber(this.data.settings.modalAwal);
                
                console.log('[DataManager] Loaded. Cash:', this.data.settings.currentCash, 'Modal:', this.data.settings.modalAwal);
                
            } catch (e) {
                console.error('[DataManager] Load error:', e);
            }
        }
        return this.data;
    },
    
    // ⬅️ TAMBAH: Deep merge untuk nested objects
    deepMerge(target, source) {
        const output = Object.assign({}, target);
        if (source && typeof source === 'object') {
            Object.keys(source).forEach(key => {
                if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                    output[key] = this.deepMerge(target[key] || {}, source[key]);
                } else {
                    output[key] = source[key];
                }
            });
        }
        return output;
    },
    
    // ⬅️ TAMBAH: Parse number dengan aman
    parseNumber(value) {
        if (typeof value === 'number' && !isNaN(value)) return value;
        if (typeof value === 'string') {
            const parsed = parseInt(value.replace(/\./g, '').replace(/,/g, ''));
            return isNaN(parsed) ? 0 : parsed;
        }
        return 0;
    },
    
    save() {
        // ⬅️ KRITIS: Pastikan semua number valid sebelum save
        if (this.data.settings) {
            this.data.settings.currentCash = this.parseNumber(this.data.settings.currentCash);
            this.data.settings.modalAwal = this.parseNumber(this.data.settings.modalAwal);
        }
        
        localStorage.setItem('hifzi_cell_data', JSON.stringify(this.data));
        console.log('[DataManager] Saved. Cash:', this.data.settings.currentCash);
    },
    
    getProducts() { return this.data.products; },
    getTransactions() { return this.data.transactions; },
    getCategories() { return this.data.categories; },
    getSettings() { return this.data.settings; },
    
    addProduct(product) {
        this.data.products.push(product);
        this.save();
    },
    
    updateProduct(id, updates) {
        const idx = this.data.products.findIndex(p => p.id === id);
        if (idx !== -1) {
            this.data.products[idx] = { ...this.data.products[idx], ...updates };
            this.save();
        }
    },
    
    deleteProduct(id) {
        this.data.products = this.data.products.filter(p => p.id !== id);
        this.save();
    }
};

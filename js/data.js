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
            this.data = { ...this.data, ...JSON.parse(saved) };
        }
        return this.data;
    },
    
    save() {
        localStorage.setItem('hifzi_cell_data', JSON.stringify(this.data));
    },
    
    // Specific getters
    getProducts() { return this.data.products; },
    getTransactions() { return this.data.transactions; },
    getCategories() { return this.data.categories; },
    getSettings() { return this.data.settings; },
    
    // Specific setters
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

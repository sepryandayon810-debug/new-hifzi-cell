// ============================================
// cashConfig.js - Konfigurasi & Constants
// ============================================

export const cashConfig = {
    STORAGE_KEY: 'hifzi_cash_data',
    
    defaultData: {
        transactions: [],
        currentShift: null,
        settings: { requireDescriptionForExpense: true, minAmount: 0, maxAmount: 100000000 },
        lastUpdated: null
    },

    getData() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) return { ...this.defaultData, ...JSON.parse(stored) };
        } catch (e) { console.error('[Cash] Error reading data:', e); }
        return { ...this.defaultData };
    },

    saveData(data) {
        try {
            data.lastUpdated = new Date().toISOString();
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('[Cash] Error saving data:', e);
            return false;
        }
    },

    getCurrentUser() {
        if (window.dataManager?.getCurrentUser) return window.dataManager.getCurrentUser();
        const user = localStorage.getItem('current_user');
        return user ? JSON.parse(user).name : 'Unknown';
    },

    getUserRole() {
        if (window.dataManager?.getCurrentUser) {
            const user = window.dataManager.getCurrentUser();
            return user?.role || 'kasir';
        }
        const user = localStorage.getItem('current_user');
        return user ? JSON.parse(user).role : 'kasir';
    },

    isOwner() {
        return this.getUserRole() === 'owner' || this.getUserRole() === 'admin';
    },

    clearAllData() {
        localStorage.removeItem(this.STORAGE_KEY);
    }
};

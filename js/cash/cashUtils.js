// ============================================
// cashUtils.js - Helper Functions
// ============================================

export const cashUtils = {
    formatCurrency(amount) {
        if (typeof amount !== 'number') amount = parseFloat(amount) || 0;
        return new Intl.NumberFormat('id-ID', {
            style: 'currency', currency: 'IDR',
            minimumFractionDigits: 0, maximumFractionDigits: 0
        }).format(amount);
    },

    formatNumber(amount) {
        if (typeof amount !== 'number') amount = parseFloat(amount) || 0;
        return new Intl.NumberFormat('id-ID').format(amount);
    },

    parseCurrency(currencyString) {
        if (typeof currencyString === 'number') return currencyString;
        return parseFloat(currencyString.replace(/[^0-9,-]/g, '').replace(',', '.')) || 0;
    },

    getTodayDate() {
        return new Date().toISOString().split('T')[0];
    },

    formatDate(dateString) {
        if (!dateString) return '-';
        return new Intl.DateTimeFormat('id-ID', {
            year: 'numeric', month: 'long', day: 'numeric'
        }).format(new Date(dateString));
    },

    formatDateTime(timestamp) {
        if (!timestamp) return '-';
        return new Intl.DateTimeFormat('id-ID', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        }).format(new Date(timestamp));
    },

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    },

    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    validateAmount(amount, min = 0, max = 100000000) {
        const num = parseFloat(amount);
        if (isNaN(num)) return { valid: false, error: 'Bukan angka yang valid' };
        if (num < min) return { valid: false, error: `Minimal ${this.formatCurrency(min)}` };
        if (num > max) return { valid: false, error: `Maksimal ${this.formatCurrency(max)}` };
        return { valid: true, value: num };
    },

    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },

    calculatePercentageChange(current, previous) {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
    },

    groupBy(array, key) {
        return array.reduce((result, item) => {
            const group = item[key];
            result[group] = result[group] || [];
            result[group].push(item);
            return result;
        }, {});
    },

    sortByDate(array, dateField = 'timestamp', ascending = false) {
        return array.sort((a, b) => {
            const dateA = new Date(a[dateField]);
            const dateB = new Date(b[dateField]);
            return ascending ? dateA - dateB : dateB - dateA;
        });
    },

    getStartOfWeek(date = new Date()) {
        const d = new Date(date);
        const day = d.getDay();
        return new Date(d.setDate(d.getDate() - day));
    },

    getEndOfWeek(date = new Date()) {
        const d = new Date(date);
        const day = d.getDay();
        return new Date(d.setDate(d.getDate() - day + 6));
    },

    getStartOfMonth(date = new Date()) {
        return new Date(date.getFullYear(), date.getMonth(), 1);
    },

    getEndOfMonth(date = new Date()) {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0);
    }
};

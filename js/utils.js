const utils = {
    formatNumber(num) {
        return num.toLocaleString('id-ID');
    },
    
    formatDate(date) {
        return new Date(date).toLocaleDateString('id-ID');
    },
    
    formatDateTime(date) {
        return new Date(date).toLocaleString('id-ID');
    },
    
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },
    
    generateTrxNumber() {
        return 'TRX-' + Date.now().toString().slice(-8);
    },
    
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },
    
    validatePhone(phone) {
        return /^[0-9]{10,13}$/.test(phone.replace(/[^0-9]/g, ''));
    }
};

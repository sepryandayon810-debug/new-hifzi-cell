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
    },

    // ============================================
    // TAMBAHAN BARU: IDLE TIMER UTILITY
    // ============================================
    
    /**
     * Idle Timer - Auto logout setelah tidak ada aktivitas
     * @param {number} timeoutMinutes - Waktu timeout dalam menit (default: 30)
     * @param {Function} onIdle - Callback saat idle terdeteksi
     * @param {Function} onWarning - Callback saat warning (5 menit sebelum logout)
     */
    idleTimer: {
        timeout: 30 * 60 * 1000, // 30 menit dalam ms
        warningTime: 5 * 60 * 1000, // 5 menit warning sebelum logout
        timer: null,
        warningTimer: null,
        isActive: false,
        onIdleCallback: null,
        onWarningCallback: null,
        lastActivity: Date.now(),
        
        // Events yang dianggap sebagai aktivitas
        activityEvents: ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click', 'keydown'],
        
        init(onIdle, onWarning, timeoutMinutes = 30) {
            this.timeout = timeoutMinutes * 60 * 1000;
            this.warningTime = 5 * 60 * 1000; // Warning 5 menit sebelumnya
            this.onIdleCallback = onIdle;
            this.onWarningCallback = onWarning;
            this.isActive = true;
            this.lastActivity = Date.now();
            
            this.start();
            this.bindEvents();
            
            console.log(`[IdleTimer] Initialized with ${timeoutMinutes} minutes timeout`);
        },
        
        start() {
            this.reset();
        },
        
        reset() {
            if (!this.isActive) return;
            
            clearTimeout(this.timer);
            clearTimeout(this.warningTimer);
            this.lastActivity = Date.now();
            
            // Set warning timer (5 menit sebelum logout)
            if (this.warningTime > 0 && this.onWarningCallback) {
                this.warningTimer = setTimeout(() => {
                    if (this.isActive) {
                        console.log('[IdleTimer] Warning: User will be logged out soon');
                        this.onWarningCallback();
                    }
                }, this.timeout - this.warningTime);
            }
            
            // Set logout timer
            this.timer = setTimeout(() => {
                if (this.isActive) {
                    console.log('[IdleTimer] Idle timeout reached, logging out...');
                    this.onIdleCallback();
                }
            }, this.timeout);
        },
        
        bindEvents() {
            const resetHandler = () => {
                this.reset();
            };
            
            this.activityEvents.forEach(event => {
                document.addEventListener(event, resetHandler, true);
                window.addEventListener(event, resetHandler, true);
            });
            
            // Handle visibility change (tab switch)
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    this.reset();
                }
            });
        },
        
        stop() {
            this.isActive = false;
            clearTimeout(this.timer);
            clearTimeout(this.warningTimer);
            console.log('[IdleTimer] Stopped');
        },
        
        getRemainingTime() {
            if (!this.isActive) return 0;
            const elapsed = Date.now() - this.lastActivity;
            return Math.max(0, this.timeout - elapsed);
        },
        
        formatRemainingTime() {
            const remaining = this.getRemainingTime();
            const minutes = Math.floor(remaining / 60000);
            const seconds = Math.floor((remaining % 60000) / 1000);
            return `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
    }
};

// Expose to window
window.utils = utils;

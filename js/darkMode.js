/**
 * ============================================
 * DARK MODE MODULE - HIFZI CELL POS
 * ============================================
 * File: js/darkmode.js
 * Deskripsi: Sistem Dark Mode dengan CSS variables override
 * Versi: 1.0.0
 */

const darkModeModule = {
    isDark: false,
    storageKey: 'hifzi_darkmode',
    initialized: false,
    
    darkTheme: {
        '--primary': '#818cf8',
        '--primary-dark': '#6366f1',
        '--light': '#1f2937',
        '--white': '#111827',
        '--dark': '#f9fafb',
        '--success': '#34d399',
        '--danger': '#f87171',
        '--warning': '#fbbf24',
        '--info': '#60a5fa',
        '--shadow': '0 4px 20px rgba(0,0,0,0.4)',
    },
    
    lightTheme: {
        '--primary': '#667eea',
        '--primary-dark': '#764ba2',
        '--light': '#f5f6fa',
        '--white': '#ffffff',
        '--dark': '#2d3436',
        '--success': '#00b894',
        '--danger': '#ff4757',
        '--warning': '#fdcb6e',
        '--info': '#3498db',
        '--shadow': '0 4px 20px rgba(0,0,0,0.1)',
    },

    init() {
        if (this.initialized) return;
        
        console.log('[DarkMode] Initializing...');
        
        const saved = localStorage.getItem(this.storageKey);
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        this.isDark = saved !== null ? (saved === 'true') : prefersDark;
        
        this.injectStyles();
        this.apply();
        
        // Render toggle button dengan delay untuk memastikan DOM siap
        setTimeout(() => this.renderToggleButton(), 100);
        setTimeout(() => this.renderToggleButton(), 500);
        setTimeout(() => this.renderToggleButton(), 1000);
        
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (localStorage.getItem(this.storageKey) === null) {
                this.isDark = e.matches;
                this.apply();
            }
        });
        
        this.initialized = true;
        console.log('[DarkMode] Initialized, mode:', this.isDark ? 'dark' : 'light');
    },

    apply() {
        const root = document.documentElement;
        const theme = this.isDark ? this.darkTheme : this.lightTheme;
        
        Object.entries(theme).forEach(([key, value]) => {
            root.style.setProperty(key, value);
        });
        
        document.body.classList.toggle('dark-mode', this.isDark);
        this.updateToggleUI();
        
        window.dispatchEvent(new CustomEvent('themechange', { 
            detail: { isDark: this.isDark } 
        }));
    },

    toggle() {
        this.isDark = !this.isDark;
        localStorage.setItem(this.storageKey, this.isDark);
        this.apply();
        
        const message = this.isDark ? '🌙 Mode Gelap aktif' : '☀️ Mode Terang aktif';
        if (typeof app !== 'undefined' && app.showToast) {
            app.showToast(message);
        } else {
            this.showFallbackToast(message);
        }
    },

    reset() {
        localStorage.removeItem(this.storageKey);
        this.isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        this.apply();
        if (typeof app !== 'undefined' && app.showToast) {
            app.showToast('🔄 Theme direset ke default');
        }
    },

    renderToggleButton() {
        // Cek jika sudah ada
        if (document.getElementById('darkModeBtn')) return;
        
        // Cari container header-actions
        let container = document.querySelector('.header-actions');
        
        // Jika belum ada, coba cari di header
        if (!container) {
            const header = document.querySelector('.header');
            if (header) {
                // Buat container jika belum ada
                container = document.createElement('div');
                container.className = 'header-actions';
                container.style.cssText = 'display: flex; align-items: center;';
                header.querySelector('.header-top')?.appendChild(container);
            }
        }
        
        if (!container) {
            console.log('[DarkMode] Header actions not found, retrying...');
            return;
        }
        
        const btn = document.createElement('button');
        btn.id = 'darkModeBtn';
        btn.className = 'icon-btn darkmode-toggle';
        btn.title = 'Toggle Dark Mode';
        btn.innerHTML = this.isDark ? '☀️' : '🌙';
        btn.style.cssText = `
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            font-size: 20px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
            flex-shrink: 0;
            margin-right: 5px;
        `;
        btn.onclick = () => this.toggle();
        
        btn.onmouseenter = () => {
            btn.style.background = 'rgba(255,255,255,0.3)';
            btn.style.transform = 'scale(1.05)';
        };
        btn.onmouseleave = () => {
            btn.style.background = 'rgba(255,255,255,0.2)';
            btn.style.transform = 'scale(1)';
        };
        
        // Insert sebelum tombol settings
        const settingsBtn = container.querySelector('[onclick*="openSettings"]');
        if (settingsBtn) {
            container.insertBefore(btn, settingsBtn);
        } else {
            container.appendChild(btn);
        }
        
        console.log('[DarkMode] Toggle button rendered');
    },

    updateToggleUI() {
        const btn = document.getElementById('darkModeBtn');
        if (btn) {
            btn.innerHTML = this.isDark ? '☀️' : '🌙';
            btn.title = this.isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode';
        }
    },

    showFallbackToast(message) {
        const existing = document.getElementById('darkmode-toast');
        if (existing) existing.remove();
        
        const toast = document.createElement('div');
        toast.id = 'darkmode-toast';
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%) translateY(-100px);
            background: ${this.isDark ? '#374151' : 'rgba(0,0,0,0.85)'};
            color: white;
            padding: 12px 24px;
            border-radius: 25px;
            font-size: 14px;
            font-weight: 500;
            z-index: 10000;
            opacity: 0;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            white-space: nowrap;
            pointer-events: none;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        requestAnimationFrame(() => {
            toast.style.transform = 'translateX(-50%) translateY(0)';
            toast.style.opacity = '1';
        });
        
        setTimeout(() => {
            toast.style.transform = 'translateX(-50%) translateY(-100px)';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 2500);
    },

    injectStyles() {
        if (document.getElementById('darkmode-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'darkmode-styles';
        styles.textContent = `
            body, .card, .modal-content, input, select, textarea, button, 
            .nav-tabs, .cart-bar, .product-item, .transaction-item,
            .login-box, .backup-section, .stat-card {
                transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
            }
            
            body.dark-mode {
                background: linear-gradient(135deg, #1f2937 0%, #111827 100%) !important;
            }
            
            body.dark-mode .card,
            body.dark-mode .modal-content,
            body.dark-mode .login-box,
            body.dark-mode .backup-section,
            body.dark-mode .backup-provider-btn,
            body.dark-mode .stat-card,
            body.dark-mode .product-item,
            body.dark-mode .transaction-item,
            body.dark-mode .cart-item,
            body.dark-mode .batch-stock-item,
            body.dark-mode .cloud-option,
            body.dark-mode .return-item-box {
                background: #1f2937 !important;
                border-color: #374151 !important;
                color: #f9fafb !important;
            }
            
            body.dark-mode input,
            body.dark-mode select,
            body.dark-mode textarea,
            body.dark-mode .form-group input,
            body.dark-mode .form-group select,
            body.dark-mode .search-bar input,
            body.dark-mode .backup-input,
            body.dark-mode .batch-stock-input,
            body.dark-mode .return-input,
            body.dark-mode .login-input {
                background: #374151 !important;
                border-color: #4b5563 !important;
                color: #f9fafb !important;
            }
            
            body.dark-mode input::placeholder,
            body.dark-mode textarea::placeholder {
                color: #9ca3af !important;
            }
            
            body.dark-mode .btn-secondary,
            body.dark-mode .close-btn {
                background: #374151 !important;
                color: #f9fafb !important;
            }
            
            body.dark-mode .nav-tabs {
                background: #1f2937 !important;
            }
            
            body.dark-mode .nav-tab:not(.active) {
                color: #9ca3af !important;
            }
            
            body.dark-mode .nav-tab.active {
                background: linear-gradient(135deg, #818cf8 0%, #6366f1 100%) !important;
            }
            
            body.dark-mode .transaction-item,
            body.dark-mode .info-row,
            body.dark-mode .calc-row {
                border-color: #374151 !important;
            }
            
            body.dark-mode .info-box {
                background: rgba(96, 165, 250, 0.1) !important;
                border-left-color: #60a5fa !important;
            }
            
            body.dark-mode .info-box.warning {
                background: rgba(251, 191, 36, 0.1) !important;
                border-left-color: #fbbf24 !important;
            }
            
            body.dark-mode .info-box.danger {
                background: rgba(248, 113, 113, 0.1) !important;
                border-left-color: #f87171 !important;
            }
            
            body.dark-mode .info-box.success {
                background: rgba(52, 211, 153, 0.1) !important;
                border-left-color: #34d399 !important;
            }
            
            body.dark-mode .calculation-box {
                background: #374151 !important;
            }
            
            body.dark-mode .checkbox-group {
                background: #374151 !important;
                color: #f9fafb !important;
            }
            
            body.dark-mode .cart-bar {
                background: #1f2937 !important;
                border-top-color: #374151 !important;
            }
            
            body.dark-mode ::-webkit-scrollbar-thumb {
                background: rgba(255,255,255,0.2) !important;
            }
            
            body.dark-mode .loading-overlay {
                background: rgba(17, 24, 39, 0.9) !important;
            }
            
            body.dark-mode .empty-state {
                color: #6b7280 !important;
            }
            
            body.dark-mode .bluetooth-control-panel {
                background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%) !important;
            }
            
            body.dark-mode .backup-status-card {
                background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%) !important;
            }
            
            body.dark-mode .backup-toggle {
                background: #374151 !important;
            }
            
            body.dark-mode .backup-file-drop {
                border-color: #4b5563 !important;
                background: #1f2937 !important;
                color: #f9fafb !important;
            }
            
            body.dark-mode .backup-danger-zone {
                background: rgba(248, 113, 113, 0.1) !important;
                border-color: rgba(248, 113, 113, 0.3) !important;
            }
            
            body.dark-mode .backup-stat-card {
                background: #374151 !important;
            }
            
            body.dark-mode .toast {
                background: #374151 !important;
                color: #f9fafb !important;
            }
            
            body.dark-mode .kasir-status-box.open {
                background: rgba(52, 211, 153, 0.1) !important;
                border-color: #34d399 !important;
            }
            
            body.dark-mode .kasir-status-box.closed {
                background: rgba(248, 113, 113, 0.1) !important;
                border-color: #f87171 !important;
            }
            
            body.dark-mode .login-container {
                background: linear-gradient(135deg, #1f2937 0%, #111827 100%) !important;
            }
            
            body.dark-mode .login-box {
                background: #1f2937 !important;
                box-shadow: 0 20px 60px rgba(0,0,0,0.5) !important;
            }
            
            body.dark-mode .login-title {
                color: #f9fafb !important;
            }
            
            body.dark-mode .login-subtitle {
                color: #9ca3af !important;
            }
            
            body.dark-mode .login-form-group label {
                color: #d1d5db !important;
            }
            
            body.dark-mode .login-input {
                background: #374151 !important;
                border-color: #4b5563 !important;
                color: #f9fafb !important;
            }
            
            body.dark-mode .login-input:focus {
                border-color: #818cf8 !important;
                box-shadow: 0 0 0 3px rgba(129, 140, 248, 0.1) !important;
            }
            
            body.dark-mode .login-error {
                background: rgba(248, 113, 113, 0.1) !important;
                color: #f87171 !important;
                border-left-color: #f87171 !important;
            }
            
            body.dark-mode .header {
                background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%) !important;
            }
            
            body.dark-mode .cash-card {
                background: rgba(255,255,255,0.05) !important;
            }
            
            body.dark-mode .cash-label {
                color: #d1d5db !important;
            }
            
            body.dark-mode .cash-amount {
                color: #f9fafb !important;
            }
            
            body.dark-mode .cash-detail-item {
                color: #d1d5db !important;
            }
            
            body.dark-mode .sync-status {
                background: rgba(255,255,255,0.1) !important;
            }
            
            body.dark-mode .user-info-header {
                background: rgba(255,255,255,0.1) !important;
            }
            
            body.dark-mode .user-name,
            body.dark-mode .user-role {
                color: #f9fafb !important;
            }
            
            body.dark-mode .profit-highlight {
                background: linear-gradient(135deg, #059669 0%, #0d9488 100%) !important;
            }
            
            body.dark-mode .kasir-indicator.open {
                background: rgba(52, 211, 153, 0.15) !important;
            }
            
            body.dark-mode .kasir-indicator.closed {
                background: rgba(248, 113, 113, 0.15) !important;
            }
            
            body.dark-mode .modal {
                background: rgba(0,0,0,0.7) !important;
            }
            
            body.dark-mode .modal-title {
                color: #f9fafb !important;
            }
            
            body.dark-mode #darkModeBtn {
                background: rgba(255,255,255,0.1) !important;
            }
            
            body.dark-mode #darkModeBtn:hover {
                background: rgba(255,255,255,0.2) !important;
            }
        `;
        
        document.head.appendChild(styles);
    }
};

// Init saat DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => darkModeModule.init());
} else {
    darkModeModule.init();
}

// Expose ke window
window.darkModeModule = darkModeModule;

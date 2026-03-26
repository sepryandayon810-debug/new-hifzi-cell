/**
 * ============================================
 * DARK MODE MODULE - HIFZI CELL POS
 * ============================================
 * File: js/darkmode.js
 * Deskripsi: Sistem Dark Mode dengan CSS variables override
 * Cara pakai: Tambahkan <script src="js/darkmode.js"></script> di HTML
 */

const darkModeModule = {
    // State
    isDark: false,
    storageKey: 'hifzi_darkmode',
    
    // CSS Variables untuk Dark Mode
    darkTheme: {
        // Background & Surface
        '--primary': '#818cf8',
        '--primary-dark': '#6366f1',
        '--light': '#1f2937',
        '--white': '#111827',
        
        // Text Colors
        '--dark': '#f9fafb',
        
        // Semantic Colors (diadjust untuk dark)
        '--success': '#34d399',
        '--danger': '#f87171',
        '--warning': '#fbbf24',
        '--info': '#60a5fa',
        
        // Shadows & Effects
        '--shadow': '0 4px 20px rgba(0,0,0,0.4)',
    },
    
    // CSS Variables default (Light Mode) - untuk restore
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

    /**
     * Inisialisasi Dark Mode
     */
    init() {
        // Cek preferensi tersimpan
        const saved = localStorage.getItem(this.storageKey);
        
        // Cek preferensi sistem (jika belum ada setting manual)
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        // Set default: pakai saved > prefersDark > false
        this.isDark = saved !== null ? (saved === 'true') : prefersDark;
        
        // Apply tema
        this.apply();
        
        // Listen perubahan sistem theme
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            // Hanya auto-switch kalau user belum set manual
            if (localStorage.getItem(this.storageKey) === null) {
                this.isDark = e.matches;
                this.apply();
            }
        });
        
        console.log('🌙 Dark Mode Module initialized');
    },

    /**
     * Apply tema ke DOM
     */
    apply() {
        const root = document.documentElement;
        
        const theme = this.isDark ? this.darkTheme : this.lightTheme;
        
        // Set CSS variables
        Object.entries(theme).forEach(([key, value]) => {
            root.style.setProperty(key, value);
        });
        
        // Toggle class untuk styling tambahan
        document.body.classList.toggle('dark-mode', this.isDark);
        
        // Update toggle button UI jika ada
        this.updateToggleUI();
        
        // Trigger custom event
        window.dispatchEvent(new CustomEvent('themechange', { 
            detail: { isDark: this.isDark } 
        }));
    },

    /**
     * Toggle dark/light mode
     */
    toggle() {
        this.isDark = !this.isDark;
        localStorage.setItem(this.storageKey, this.isDark);
        this.apply();
        
        // Show toast notification
        if (typeof app !== 'undefined' && app.showToast) {
            app.showToast(this.isDark ? '🌙 Mode Gelap aktif' : '☀️ Mode Terang aktif');
        }
    },

    /**
     * Set mode secara eksplisit
     */
    set(isDark) {
        this.isDark = isDark;
        localStorage.setItem(this.storageKey, isDark);
        this.apply();
    },

    /**
     * Reset ke default (hapus preferensi tersimpan)
     */
    reset() {
        localStorage.removeItem(this.storageKey);
        this.isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        this.apply();
    },

    /**
     * Render Toggle Button untuk Header/Settings
     */
    renderToggleButton(containerId = 'darkModeToggle') {
        const container = document.getElementById(containerId) || document.querySelector('.header-actions');
        if (!container) return;
        
        // Cek apakah sudah ada
        if (document.getElementById('darkModeBtn')) return;
        
        const btn = document.createElement('button');
        btn.id = 'darkModeBtn';
        btn.className = 'icon-btn darkmode-toggle';
        btn.title = 'Toggle Dark Mode';
        btn.innerHTML = this.isDark ? '☀️' : '🌙';
        btn.onclick = () => this.toggle();
        
        // Insert sebelum tombol settings (jika ada)
        const settingsBtn = container.querySelector('[onclick*="openSettings"]');
        if (settingsBtn) {
            container.insertBefore(btn, settingsBtn);
        } else {
            container.appendChild(btn);
        }
    },

    /**
     * Update UI toggle button
     */
    updateToggleUI() {
        const btn = document.getElementById('darkModeBtn');
        if (btn) {
            btn.innerHTML = this.isDark ? '☀️' : '🌙';
            btn.title = this.isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode';
        }
    },

    /**
     * Render section Dark Mode di Settings Modal
     */
    renderSettingsSection() {
        return `
            <div class="settings-section darkmode-settings" style="margin-bottom: 20px;">
                <h3 style="font-size: 16px; margin-bottom: 15px; display: flex; align-items: center; gap: 8px;">
                    🎨 Tampilan
                </h3>
                
                <div class="theme-toggle-card" style="
                    background: ${this.isDark ? '#374151' : '#f3f4f6'};
                    border-radius: 16px;
                    padding: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    cursor: pointer;
                    transition: all 0.3s;
                    border: 2px solid ${this.isDark ? '#4b5563' : '#e5e7eb'};
                " onclick="darkModeModule.toggle()">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <div style="
                            width: 48px;
                            height: 48px;
                            border-radius: 12px;
                            background: ${this.isDark ? 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)' : 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)'};
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-size: 24px;
                        ">
                            ${this.isDark ? '🌙' : '☀️'}
                        </div>
                        <div>
                            <div style="font-weight: 600; font-size: 16px;">
                                Mode ${this.isDark ? 'Gelap' : 'Terang'}
                            </div>
                            <div style="font-size: 13px; opacity: 0.7; margin-top: 2px;">
                                ${this.isDark ? 'Lebih nyaman di malam hari' : 'Tampilan default terang'}
                            </div>
                        </div>
                    </div>
                    
                    <div class="toggle-switch" style="
                        width: 52px;
                        height: 28px;
                        background: ${this.isDark ? '#6366f1' : '#d1d5db'};
                        border-radius: 14px;
                        position: relative;
                        transition: all 0.3s;
                    ">
                        <div style="
                            width: 24px;
                            height: 24px;
                            background: white;
                            border-radius: 50%;
                            position: absolute;
                            top: 2px;
                            left: ${this.isDark ? '26px' : '2px'};
                            transition: all 0.3s;
                            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                        "></div>
                    </div>
                </div>
                
                <div style="
                    margin-top: 12px;
                    padding: 12px;
                    background: ${this.isDark ? 'rgba(99, 102, 241, 0.1)' : '#eff6ff'};
                    border-radius: 10px;
                    border-left: 3px solid var(--primary);
                ">
                    <div style="font-size: 12px; color: var(--primary); font-weight: 600; margin-bottom: 4px;">
                        💡 Tips
                    </div>
                    <div style="font-size: 12px; opacity: 0.8; line-height: 1.5;">
                        Mode gelap mengurangi kelelahan mata dan menghemat baterai pada layar OLED.
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Inject additional dark mode styles untuk elemen spesifik
     */
    injectStyles() {
        if (document.getElementById('darkmode-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'darkmode-styles';
        styles.textContent = `
            /* ==========================================
               DARK MODE OVERRIDES - Specific Elements
               ========================================== */
            
            body.dark-mode {
                background: linear-gradient(135deg, #1f2937 0%, #111827 100%) !important;
            }
            
            /* Cards & Surfaces */
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
            
            /* Input Fields */
            body.dark-mode input,
            body.dark-mode select,
            body.dark-mode textarea,
            body.dark-mode .form-group input,
            body.dark-mode .form-group select,
            body.dark-mode .search-bar input,
            body.dark-mode .backup-input,
            body.dark-mode .batch-stock-input,
            body.dark-mode .return-input {
                background: #374151 !important;
                border-color: #4b5563 !important;
                color: #f9fafb !important;
            }
            
            body.dark-mode input::placeholder,
            body.dark-mode textarea::placeholder {
                color: #9ca3af !important;
            }
            
            /* Buttons */
            body.dark-mode .btn-secondary,
            body.dark-mode .close-btn {
                background: #374151 !important;
                color: #f9fafb !important;
            }
            
            /* Navigation */
            body.dark-mode .nav-tabs {
                background: #1f2937 !important;
            }
            
            body.dark-mode .nav-tab:not(.active) {
                color: #9ca3af !important;
            }
            
            /* Lists & Dividers */
            body.dark-mode .transaction-item,
            body.dark-mode .info-row,
            body.dark-mode .calc-row {
                border-color: #374151 !important;
            }
            
            /* Info Boxes */
            body.dark-mode .info-box {
                background: rgba(96, 165, 250, 0.1) !important;
            }
            
            body.dark-mode .info-box.warning {
                background: rgba(251, 191, 36, 0.1) !important;
            }
            
            body.dark-mode .info-box.danger {
                background: rgba(248, 113, 113, 0.1) !important;
            }
            
            body.dark-mode .info-box.success {
                background: rgba(52, 211, 153, 0.1) !important;
            }
            
            /* Calculation Box */
            body.dark-mode .calculation-box {
                background: #374151 !important;
            }
            
            body.dark-mode .calc-row {
                border-color: #4b5563 !important;
            }
            
            /* Checkbox Group */
            body.dark-mode .checkbox-group {
                background: #374151 !important;
            }
            
            /* Cart Bar */
            body.dark-mode .cart-bar {
                background: #1f2937 !important;
                border-top-color: #374151 !important;
            }
            
            /* Scrollbar */
            body.dark-mode ::-webkit-scrollbar-thumb {
                background: rgba(255,255,255,0.2) !important;
            }
            
            body.dark-mode ::-webkit-scrollbar-thumb:hover {
                background: rgba(255,255,255,0.3) !important;
            }
            
            /* Loading Overlay */
            body.dark-mode .loading-overlay {
                background: rgba(17, 24, 39, 0.9) !important;
            }
            
            /* Empty State */
            body.dark-mode .empty-state {
                color: #6b7280 !important;
            }
            
            /* Bluetooth Panel */
            body.dark-mode .bluetooth-control-panel {
                background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%) !important;
            }
            
            /* Backup specific */
            body.dark-mode .backup-status-card {
                background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%) !important;
            }
            
            body.dark-mode .backup-toggle {
                background: #374151 !important;
            }
            
            body.dark-mode .backup-file-drop {
                border-color: #4b5563 !important;
                background: #1f2937 !important;
            }
            
            body.dark-mode .backup-file-drop:hover {
                border-color: #6366f1 !important;
                background: #374151 !important;
            }
            
            body.dark-mode .backup-danger-zone {
                background: rgba(248, 113, 113, 0.1) !important;
                border-color: rgba(248, 113, 113, 0.3) !important;
            }
            
            body.dark-mode .backup-stat-card {
                background: #374151 !important;
            }
            
            /* Toast */
            body.dark-mode .toast {
                background: #374151 !important;
                color: #f9fafb !important;
            }
            
            /* Kasir Status */
            body.dark-mode .kasir-status-box.open {
                background: rgba(52, 211, 153, 0.1) !important;
            }
            
            body.dark-mode .kasir-status-box.closed {
                background: rgba(248, 113, 113, 0.1) !important;
            }
            
            /* Login */
            body.dark-mode .login-input {
                background: #374151 !important;
                border-color: #4b5563 !important;
                color: #f9fafb !important;
            }
            
            /* Header specific adjustments */
            body.dark-mode .cash-card {
                background: rgba(255,255,255,0.05) !important;
            }
            
            body.dark-mode .sync-status {
                background: rgba(255,255,255,0.1) !important;
            }
            
            body.dark-mode .user-info-header {
                background: rgba(255,255,255,0.1) !important;
            }
            
            /* Profit Highlight - keep it visible */
            body.dark-mode .profit-highlight {
                background: linear-gradient(135deg, #059669 0%, #0d9488 100%) !important;
            }
            
            /* Animations */
            @keyframes darkModeTransition {
                from { opacity: 0.8; }
                to { opacity: 1; }
            }
            
            body.dark-mode {
                animation: darkModeTransition 0.3s ease;
            }
            
            /* Smooth transition untuk semua element */
            body, .card, .modal-content, input, select, textarea, button, 
            .nav-tabs, .cart-bar, .product-item, .transaction-item {
                transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
            }
        `;
        
        document.head.appendChild(styles);
    }
};

// Auto-init saat DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        darkModeModule.init();
        darkModeModule.injectStyles();
        // Render toggle button setelah app siap
        setTimeout(() => darkModeModule.renderToggleButton(), 100);
    });
} else {
    darkModeModule.init();
    darkModeModule.injectStyles();
    setTimeout(() => darkModeModule.renderToggleButton(), 100);
}

// Expose ke window untuk akses global
window.darkModeModule = darkModeModule;

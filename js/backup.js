// backup.js - Versi Modern UI (Sesuai Tampilan Hifzi Cell)
// Backup untuk: Products, Categories, Transactions, CashFlow, Debts, Settings, Kasir, Receipt

const backupModule = {
    currentProvider: 'local',
    autoSyncInterval: null,
    isAutoSyncEnabled: false,
    lastSyncTime: null,
    gasUrl: '',
    
    STORAGE_KEYS: {
        products: 'hifzi_products',
        categories: 'hifzi_categories',
        transactions: 'hifzi_transactions',
        cashFlow: 'hifzi_cash',
        debts: 'hifzi_debts',
        settings: 'hifzi_settings',
        kasir: 'hifzi_kasir',
        receipt: 'hifzi_receipt'
    },
    
    GAS_URL_KEY: 'hifzi_gas_url',
    AUTO_SYNC_KEY: 'hifzi_auto_sync',
    LAST_SYNC_KEY: 'hifzi_last_sync',
    LOGS_KEY: 'hifzi_backup_logs',
    
    debugMode: true,
    
    log: function(level, message, data) {
        const timestamp = new Date().toLocaleTimeString('id-ID');
        const prefix = `[${timestamp}][Backup][${level}]`;
        if (level === 'ERROR') console.error(prefix, message, data || '');
        else if (level === 'WARN') console.warn(prefix, message, data || '');
        else console.log(prefix, message, data || '');
        
        try {
            let logs = JSON.parse(localStorage.getItem(this.LOGS_KEY) || '[]');
            logs.push({ 
                time: new Date().toISOString(), 
                level: level, 
                message: message, 
                data: data ? JSON.stringify(data).substring(0, 200) : null 
            });
            if (logs.length > 100) logs = logs.slice(-100);
            localStorage.setItem(this.LOGS_KEY, JSON.stringify(logs));
        } catch(e) {}
    },

    init: function() {
        this.log('INFO', 'Backup Module Modern UI Initialized');
        this.gasUrl = localStorage.getItem(this.GAS_URL_KEY) || '';
        this.isAutoSyncEnabled = localStorage.getItem(this.AUTO_SYNC_KEY) === 'true';
        this.lastSyncTime = localStorage.getItem(this.LAST_SYNC_KEY) || null;
        
        if (this.gasUrl && this.gasUrl.length > 10) {
            this.currentProvider = 'googlesheet';
            
            const localData = this.getAllData();
            const hasLocalData = this.hasAnyData(localData);
            
            if (!hasLocalData && this.gasUrl) {
                this.log('INFO', 'Device baru terdeteksi, auto-download...');
                this.showToast('📥 Device baru, mengunduh data...');
                setTimeout(() => {
                    this.downloadData(true);
                }, 1000);
            }
        }
        
        if (this.isAutoSyncEnabled && this.gasUrl) {
            this.startAutoSync();
        }
        
        this.render();
    },

    getAllData: function() {
        const data = {};
        const keys = this.STORAGE_KEYS;
        
        for (let key in keys) {
            try {
                const stored = localStorage.getItem(keys[key]);
                data[key] = stored ? JSON.parse(stored) : this.getDefaultData(key);
            } catch(e) {
                this.log('ERROR', 'Error reading ' + key, e.message);
                data[key] = this.getDefaultData(key);
            }
        }
        
        return data;
    },

    getDefaultData: function(type) {
        switch(type) {
            case 'products': return [];
            case 'categories': return [
                { id: 'all', name: 'Semua', icon: '📦' },
                { id: 'handphone', name: 'Handphone', icon: '📱' },
                { id: 'aksesoris', name: 'Aksesoris', icon: '🎧' },
                { id: 'pulsa', name: 'Pulsa', icon: '💳' },
                { id: 'servis', name: 'Servis', icon: '🔧' }
            ];
            case 'transactions': return [];
            case 'cashFlow': return [];
            case 'debts': return [];
            case 'settings': return {
                storeName: 'Hifzi Cell',
                address: '',
                phone: '',
                taxRate: 0,
                modalAwal: 0,
                currentCash: 0,
                receiptHeader: {
                    storeName: 'HIFZI CELL',
                    address: 'Alamat Belum Diatur',
                    phone: '',
                    note: 'Terima kasih atas kunjungan Anda'
                }
            };
            case 'kasir': return {
                isOpen: false,
                openTime: null,
                closeTime: null,
                date: null,
                shiftId: null,
                openingBalance: 0,
                closingBalance: 0
            };
            case 'receipt': return {
                header: { storeName: 'HIFZI CELL', address: '', phone: '', note: 'Terima kasih atas kunjungan Anda' },
                footer: { message: '', thanks: '' },
                showLogo: false,
                logoUrl: ''
            };
            default: return null;
        }
    },

    hasAnyData: function(data) {
        if (!data) data = this.getAllData();
        return (
            (data.products && data.products.length > 0) ||
            (data.transactions && data.transactions.length > 0) ||
            (data.debts && data.debts.length > 0) ||
            (data.cashFlow && data.cashFlow.length > 0) ||
            (data.categories && data.categories.length > 1)
        );
    },

    formatRupiah: function(amount) {
        if (!amount && amount !== 0) return 'Rp 0';
        return 'Rp ' + amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    },

    // ==================== MODERN UI RENDER ====================
    
    render: function() {
        const container = document.getElementById('mainContent');
        if (!container) return;

        const data = this.getAllData();
        const stats = {
            products: data.products ? data.products.length : 0,
            categories: data.categories ? data.categories.length : 0,
            transactions: data.transactions ? data.transactions.length : 0,
            cashFlow: data.cashFlow ? data.cashFlow.length : 0,
            debts: data.debts ? data.debts.length : 0,
            currentCash: data.settings?.currentCash || 0,
            storeName: data.settings?.storeName || 'HIFZI CELL'
        };

        container.innerHTML = `
            <div class="content-section active" id="backupSection" style="padding: 16px; max-width: 1200px; margin: 0 auto;">
                
                <!-- Status Card -->
                <div class="modern-card status-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-size: 14px; opacity: 0.9; margin-bottom: 4px;">Status Sinkronisasi</div>
                            <div style="font-size: 20px; font-weight: 600;">
                                ${this.isAutoSyncEnabled ? '🟢 Auto Sync Aktif' : '⚪ Auto Sync Nonaktif'}
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 12px; opacity: 0.8;">Terakhir Sync</div>
                            <div style="font-size: 14px; font-weight: 500;">
                                ${this.lastSyncTime ? new Date(this.lastSyncTime).toLocaleString('id-ID', {hour: '2-digit', minute:'2-digit', day:'numeric', month:'short'}) : 'Belum pernah'}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Stats Grid -->
                <div class="modern-card" style="margin-bottom: 20px;">
                    <div style="font-size: 16px; font-weight: 600; color: #2d3748; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
                        📊 Data Lokal: ${stats.storeName}
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px;">
                        ${this.renderStatCard('📦', 'Produk', stats.products, '#e3f2fd', '#2196F3')}
                        ${this.renderStatCard('📁', 'Kategori', stats.categories, '#e8f5e9', '#4CAF50')}
                        ${this.renderStatCard('📝', 'Transaksi', stats.transactions, '#fff3e0', '#FF9800')}
                        ${this.renderStatCard('💰', 'Arus Kas', stats.cashFlow, '#fce4ec', '#E91E63')}
                        ${this.renderStatCard('💳', 'Hutang', stats.debts, '#f3e5f5', '#9C27B0')}
                        ${this.renderStatCard('🏦', 'Kas', this.formatRupiah(stats.currentCash), '#e0f2f1', '#009688')}
                    </div>
                </div>

                <!-- Debug Panel -->
                <div class="modern-card" style="margin-bottom: 20px; border: 1px solid #e2e8f0;">
                    <div onclick="document.getElementById('debugPanel').classList.toggle('hidden')" 
                         style="padding: 16px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; background: #f7fafc; border-radius: 12px 12px 0 0;">
                        <span style="font-weight: 600; color: #4a5568;">🐛 Debug Panel</span>
                        <span style="color: #718096; font-size: 12px;">Klik untuk expand ▼</span>
                    </div>
                    <div id="debugPanel" class="hidden" style="padding: 16px; border-top: 1px solid #e2e8f0;">
                        <div style="background: #1a202c; color: #68d391; padding: 12px; border-radius: 8px; font-family: 'Courier New', monospace; font-size: 11px; max-height: 200px; overflow-y: auto; margin-bottom: 12px;">
                            ${this.getDebugLogs().slice(-5).reverse().map(log => {
                                const color = log.level === 'ERROR' ? '#fc8181' : (log.level === 'WARN' ? '#f6e05e' : '#68d391');
                                const time = log.time.split('T')[1] ? log.time.split('T')[1].substr(0,8) : '--:--:--';
                                return `<div style="color: ${color}; margin-bottom: 4px;">[${time}] ${log.message}</div>`;
                            }).join('') || '<span style="color: #718096;">No logs...</span>'}
                        </div>
                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            <button onclick="backupModule.clearDebugLogs();backupModule.render();" class="btn-secondary" style="flex: 1; font-size: 12px; padding: 8px;">Clear Logs</button>
                            <button onclick="backupModule.inspectData()" class="btn-secondary" style="flex: 1; font-size: 12px; padding: 8px;">Inspect Data</button>
                            <button onclick="backupModule.testConnection()" class="btn-secondary" style="flex: 1; font-size: 12px; padding: 8px;">Test GAS</button>
                            <button onclick="backupModule.checkCloudData()" class="btn-secondary" style="flex: 1; font-size: 12px; padding: 8px;">Cek Cloud</button>
                        </div>
                    </div>
                </div>

                <!-- Provider Selection -->
                <div class="modern-card" style="margin-bottom: 20px;">
                    <div style="font-size: 16px; font-weight: 600; color: #2d3748; margin-bottom: 16px;">☁️ Metode Backup</div>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
                        ${this.renderProviderCard('local', '💾', 'Local File', 'Simpan ke file JSON di device')}
                        ${this.renderProviderCard('googlesheet', '📊', 'Google Sheets', 'Simpan ke Google Sheets cloud')}
                    </div>
                </div>

                <!-- Google Sheets Config -->
                ${this.currentProvider === 'googlesheet' ? this.renderGoogleSheetsSection() : ''}

                <!-- Local Backup -->
                <div class="modern-card" style="margin-bottom: 20px;">
                    <div style="font-size: 16px; font-weight: 600; color: #2d3748; margin-bottom: 16px;">💾 Backup Local</div>
                    <button onclick="backupModule.downloadJSON()" class="btn-primary" style="width: 100%; margin-bottom: 12px;">
                        ⬇️ Download JSON Backup
                    </button>
                    <label style="display: block; padding: 16px; border: 2px dashed #cbd5e0; border-radius: 8px; text-align: center; cursor: pointer; transition: all 0.2s;" 
                           onmouseover="this.style.borderColor='#667eea';this.style.background='#f7fafc'" 
                           onmouseout="this.style.borderColor='#cbd5e0';this.style.background='transparent'">
                        <input type="file" accept=".json" onchange="backupModule.importJSON(this)" style="display: none;">
                        <div style="font-size: 24px; margin-bottom: 8px;">📤</div>
                        <div style="font-size: 14px; color: #4a5568; font-weight: 500;">Klik untuk Import JSON</div>
                        <div style="font-size: 12px; color: #718096; margin-top: 4px;">atau drag & drop file</div>
                    </label>
                </div>

                <!-- Danger Zone -->
                <div class="modern-card" style="border: 1px solid #feb2b2; background: #fff5f5;">
                    <div style="font-size: 16px; font-weight: 600; color: #c53030; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
                        🗑️ Zona Bahaya
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        <button onclick="backupModule.resetLocal()" class="btn-danger" style="background: #e53e3e;">
                            🗑️ Hapus Data Lokal Saja
                        </button>
                        <div style="font-size: 11px; color: #718096; text-align: center;">Data di cloud tetap ada</div>

                        ${this.gasUrl ? `
                            <button onclick="backupModule.resetCloud()" class="btn-danger" style="background: #805ad5;">
                                ☁️ Reset Cloud (Google Sheets)
                            </button>
                            <div style="font-size: 11px; color: #718096; text-align: center;">Semua data di Google Sheets dihapus</div>
                            
                            <button onclick="backupModule.resetBoth()" class="btn-danger" style="background: #1a202c;">
                                💀 Reset Total (Lokal + Cloud)
                            </button>
                            <div style="font-size: 11px; color: #718096; text-align: center;">Hapus semua data dimana-mana</div>
                        ` : ''}
                    </div>
                </div>

            </div>

            <style>
                .modern-card {
                    background: white;
                    border-radius: 12px;
                    padding: 20px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06);
                    border: 1px solid #e2e8f0;
                }
                .stat-card {
                    padding: 16px;
                    border-radius: 10px;
                    text-align: center;
                    transition: transform 0.2s, box-shadow 0.2s;
                }
                .stat-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                }
                .provider-card {
                    padding: 20px;
                    border: 2px solid #e2e8f0;
                    border-radius: 10px;
                    text-align: center;
                    cursor: pointer;
                    transition: all 0.2s;
                    background: white;
                }
                .provider-card:hover {
                    border-color: #667eea;
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
                }
                .provider-card.active {
                    border-color: #48bb78;
                    background: #f0fff4;
                }
                .btn-primary {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-size: 14px;
                }
                .btn-primary:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
                }
                .btn-secondary {
                    background: #edf2f7;
                    color: #4a5568;
                    border: 1px solid #e2e8f0;
                    padding: 10px 16px;
                    border-radius: 6px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .btn-secondary:hover {
                    background: #e2e8f0;
                }
                .btn-danger {
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-size: 14px;
                }
                .btn-danger:hover {
                    opacity: 0.9;
                    transform: translateY(-1px);
                }
                .hidden { display: none !important; }
                .form-input {
                    width: 100%;
                    padding: 12px;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    font-size: 14px;
                    transition: border-color 0.2s;
                }
                .form-input:focus {
                    outline: none;
                    border-color: #667eea;
                    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
                }
                .toggle-switch {
                    position: relative;
                    width: 48px;
                    height: 24px;
                    background: #cbd5e0;
                    border-radius: 12px;
                    cursor: pointer;
                    transition: background 0.3s;
                }
                .toggle-switch.active {
                    background: #48bb78;
                }
                .toggle-switch::after {
                    content: '';
                    position: absolute;
                    width: 20px;
                    height: 20px;
                    background: white;
                    border-radius: 50%;
                    top: 2px;
                    left: 2px;
                    transition: transform 0.3s;
                }
                .toggle-switch.active::after {
                    transform: translateX(24px);
                }
            </style>
        `;
    },

    renderStatCard: function(icon, label, value, bgColor, textColor) {
        return `
            <div class="stat-card" style="background: ${bgColor};">
                <div style="font-size: 24px; margin-bottom: 4px;">${icon}</div>
                <div style="font-size: 11px; color: #718096; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">${label}</div>
                <div style="font-size: 20px; font-weight: 700; color: ${textColor};">${value}</div>
            </div>
        `;
    },

    renderProviderCard: function(provider, icon, title, desc) {
        const isActive = this.currentProvider === provider;
        const activeClass = isActive ? 'active' : '';
        const checkmark = isActive ? '<div style="position: absolute; top: 8px; right: 8px; background: #48bb78; color: white; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px;">✓</div>' : '';
        
        return `
            <div onclick="backupModule.setProvider('${provider}')" class="provider-card ${activeClass}" style="position: relative;">
                ${checkmark}
                <div style="font-size: 32px; margin-bottom: 8px;">${icon}</div>
                <div style="font-weight: 600; color: #2d3748; margin-bottom: 4px;">${title}</div>
                <div style="font-size: 12px; color: #718096;">${desc}</div>
            </div>
        `;
    },

    renderGoogleSheetsSection: function() {
        const lastSync = this.lastSyncTime ? new Date(this.lastSyncTime).toLocaleString('id-ID') : 'Belum pernah';
        
        return `
            <div class="modern-card" style="margin-bottom: 20px; border: 2px solid #667eea;">
                <div style="font-size: 16px; font-weight: 600; color: #2d3748; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
                    📊 Google Sheets Configuration
                </div>
                
                <div style="margin-bottom: 16px;">
                    <label style="display: block; font-size: 13px; font-weight: 600; color: #4a5568; margin-bottom: 6px;">URL Web App GAS</label>
                    <input type="text" id="gasUrl" value="${this.gasUrl || ''}" 
                           placeholder="https://script.google.com/macros/s/.../exec" 
                           class="form-input">
                </div>
                
                <button onclick="backupModule.saveUrl()" class="btn-primary" style="width: 100%; margin-bottom: 16px;">
                    💾 Simpan & Validasi URL
                </button>
                
                ${this.gasUrl ? `
                    <div style="padding: 12px; background: #f0fff4; border-radius: 8px; margin-bottom: 16px; border-left: 4px solid #48bb78;">
                        <div style="font-size: 13px; color: #22543d; font-weight: 500;">✅ URL tersimpan</div>
                        <div style="font-size: 12px; color: #718096; margin-top: 4px;">Last sync: ${lastSync}</div>
                    </div>

                    <!-- Pindah Device -->
                    <div style="background: #ebf8ff; border-radius: 10px; padding: 16px; margin-bottom: 16px; border: 1px solid #90cdf4;">
                        <div style="font-size: 14px; font-weight: 600; color: #2b6cb0; margin-bottom: 12px;">📥 Pindah Device</div>
                        <button onclick="backupModule.downloadData()" class="btn-primary" style="width: 100%; background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%);">
                            📥 Download Data dari Cloud
                        </button>
                    </div>

                    <!-- Auto Sync -->
                    <div style="background: #fffaf0; border-radius: 10px; padding: 16px; margin-bottom: 16px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                            <div>
                                <div style="font-size: 14px; font-weight: 600; color: #2d3748;">Auto Sync</div>
                                <div style="font-size: 12px; color: #718096;">Upload & cek download tiap 3 menit</div>
                            </div>
                            <div onclick="backupModule.toggleAutoSync()" class="toggle-switch ${this.isAutoSyncEnabled ? 'active' : ''}"></div>
                        </div>
                        
                        <button onclick="backupModule.uploadData()" class="btn-primary" style="width: 100%; background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);">
                            ⬆️ Upload ke Cloud Sekarang
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    },

    // ==================== ACTIONS ====================

    setProvider: function(provider) {
        this.log('INFO', 'Provider changed to: ' + provider);
        this.currentProvider = provider;
        this.render();
    },

    saveUrl: function() {
        const input = document.getElementById('gasUrl');
        if (!input) return;
        const url = input.value.trim();
        
        if (!url || url.length < 20 || !url.includes('script.google.com')) {
            this.showToast('❌ URL tidak valid!');
            return;
        }
        
        this.gasUrl = url;
        localStorage.setItem(this.GAS_URL_KEY, url);
        this.log('INFO', 'GAS URL saved');
        
        this.testConnection();
    },

    toggleAutoSync: function() {
        this.isAutoSyncEnabled = !this.isAutoSyncEnabled;
        localStorage.setItem(this.AUTO_SYNC_KEY, this.isAutoSyncEnabled);
        
        if (this.isAutoSyncEnabled) {
            this.startAutoSync();
            this.showToast('🟢 Auto sync diaktifkan');
        } else {
            this.stopAutoSync();
            this.showToast('⚪ Auto sync dimatikan');
        }
        this.render();
    },

    startAutoSync: function() {
        this.stopAutoSync();
        
        this.performTwoWaySync();
        
        this.autoSyncInterval = setInterval(() => {
            this.performTwoWaySync();
        }, 180000);
        
        this.log('INFO', 'Auto Sync started (3 min interval)');
    },

    stopAutoSync: function() {
        if (this.autoSyncInterval) {
            clearInterval(this.autoSyncInterval);
            this.autoSyncInterval = null;
            this.log('INFO', 'Auto Sync stopped');
        }
    },

    performTwoWaySync: function() {
        this.log('INFO', 'Auto Sync: Starting 2-way sync');
        
        this.uploadData(true, (uploadSuccess) => {
            if (uploadSuccess) {
                this.checkAndDownloadIfNeeded();
            }
        });
    },

    checkAndDownloadIfNeeded: function() {
        this.getCloudTimestamp((cloudTime) => {
            if (!cloudTime) {
                this.log('WARN', 'Could not get cloud timestamp');
                return;
            }
            
            if (cloudTime > this.lastSyncTime) {
                this.log('INFO', 'Cloud has newer data, auto-downloading...');
                this.showToast('📥 Data cloud lebih baru, mengunduh...');
                this.downloadData(true);
            }
        });
    },

    getCloudTimestamp: function(callback) {
        const cb = 'ts_check_' + Date.now();
        
        window[cb] = (result) => {
            if (result && result.success && result.timestamp) {
                callback(result.timestamp);
            } else {
                callback(null);
            }
            delete window[cb];
        };
        
        const script = document.createElement('script');
        script.onerror = () => {
            callback(null);
            delete window[cb];
        };
        script.src = this.gasUrl + '?action=getTimestamp&callback=' + cb + '&_t=' + Date.now();
        document.head.appendChild(script);
        
        setTimeout(() => {
            if (window[cb]) {
                callback(null);
                delete window[cb];
            }
        }, 10000);
    },

    // ==================== UPLOAD / DOWNLOAD ====================

    uploadData: function(silent, callback) {
        this.log('INFO', 'Upload started');
        
        if (!this.gasUrl) {
            if (!silent) this.showToast('❌ URL GAS belum diisi!');
            if (callback) callback(false);
            return;
        }
        
        const data = this.getAllData();
        
        if (!silent) this.showToast('⬆️ Mengupload...');
        
        const payload = {
            action: 'sync',
            data: data,
            timestamp: new Date().toISOString(),
            device: navigator.userAgent
        };
        
        fetch(this.gasUrl, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        })
        .then(response => {
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return response.json();
        })
        .then(result => {
            this.handleUploadSuccess(result, silent, callback);
        })
        .catch(error => {
            this.log('WARN', 'Fetch failed, trying JSONP: ' + error.message);
            this.uploadViaJSONP(payload, silent, callback);
        });
    },
    
    uploadViaJSONP: function(payload, silent, callback) {
        const jsonStr = JSON.stringify(payload);
        
        if (jsonStr.length > 8000) {
            this.uploadViaIframe(payload, silent, callback);
            return;
        }
        
        const encoded = encodeURIComponent(jsonStr);
        const callbackName = 'upload_cb_' + Date.now();
        
        window[callbackName] = (result) => {
            this.handleUploadSuccess(result, silent, callback);
            delete window[callbackName];
        };
        
        const script = document.createElement('script');
        script.onerror = () => {
            this.uploadViaIframe(payload, silent, callback);
            delete window[callbackName];
        };
        
        script.src = this.gasUrl + '?callback=' + callbackName + '&data=' + encoded;
        document.head.appendChild(script);
        
        setTimeout(() => {
            if (window[callbackName]) {
                delete window[callbackName];
                if (callback) callback(false);
            }
        }, 15000);
    },

    uploadViaIframe: function(payload, silent, callback) {
        const formId = 'up_form_' + Date.now();
        const iframeId = 'up_ifrm_' + Date.now();
        
        const form = document.createElement('form');
        form.id = formId;
        form.method = 'POST';
        form.action = this.gasUrl;
        form.target = iframeId;
        form.style.display = 'none';
        
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'data';
        input.value = JSON.stringify(payload);
        form.appendChild(input);
        
        const iframe = document.createElement('iframe');
        iframe.id = iframeId;
        iframe.name = iframeId;
        iframe.style.display = 'none';
        
        document.body.appendChild(form);
        document.body.appendChild(iframe);
        
        iframe.onload = () => {
            try {
                const doc = iframe.contentDocument || iframe.contentWindow.document;
                const text = doc.body.innerText || doc.body.textContent;
                const result = JSON.parse(text);
                this.handleUploadSuccess(result, silent, callback);
            } catch(e) {
                this.lastSyncTime = new Date().toISOString();
                localStorage.setItem(this.LAST_SYNC_KEY, this.lastSyncTime);
                if (!silent) this.showToast('✅ Upload selesai');
                this.render();
                if (callback) callback(true);
            }
            setTimeout(() => {
                document.getElementById(formId)?.remove();
                document.getElementById(iframeId)?.remove();
            }, 2000);
        };
        
        form.submit();
    },

    handleUploadSuccess: function(result, silent, callback) {
        if (result && result.success) {
            this.lastSyncTime = new Date().toISOString();
            localStorage.setItem(this.LAST_SYNC_KEY, this.lastSyncTime);
            
            const msg = result.counts ? 
                `✅ Upload OK! P:${result.counts.products} T:${result.counts.transactions}` : 
                '✅ Upload berhasil!';
            
            if (!silent) this.showToast(msg);
            this.log('INFO', 'Upload success', result.counts);
            this.render();
            if (callback) callback(true);
        } else {
            this.log('ERROR', 'Upload failed', result);
            if (!silent) this.showToast('❌ Upload gagal: ' + (result?.message || 'Error'));
            if (callback) callback(false);
        }
    },

    downloadData: function(silent) {
        if (!silent) {
            if (!confirm('📥 Download akan mengganti data lokal dengan data dari cloud.\n\nLanjutkan?')) return;
        }
        
        if (!this.gasUrl) {
            if (!silent) this.showToast('❌ URL GAS belum diisi!');
            return;
        }
        
        if (!silent) this.showToast('⬇️ Mengunduh data...');
        this.log('INFO', 'Download started');
        
        fetch(this.gasUrl + '?action=restore&_t=' + Date.now(), {
            method: 'GET',
            mode: 'cors',
            headers: { 'Accept': 'application/json' }
        })
        .then(response => {
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return response.json();
        })
        .then(result => {
            this.handleDownloadResult(result, silent);
        })
        .catch(error => {
            this.log('WARN', 'Fetch download failed: ' + error.message);
            this.downloadViaJSONP(silent);
        });
    },
    
    downloadViaJSONP: function(silent) {
        const cb = 'dl_cb_' + Date.now();
        
        const cleanup = () => {
            delete window[cb];
        };
        
        window[cb] = (result) => {
            this.handleDownloadResult(result, silent);
            cleanup();
        };
        
        const script = document.createElement('script');
        script.onerror = () => {
            if (!silent) this.showToast('❌ Gagal terhubung ke cloud');
            cleanup();
        };
        
        script.src = this.gasUrl + '?action=restore&callback=' + cb + '&_t=' + Date.now();
        document.head.appendChild(script);
        
        setTimeout(() => {
            if (window[cb]) {
                if (!silent) this.showToast('❌ Timeout');
                cleanup();
            }
        }, 20000);
    },
    
    handleDownloadResult: function(result, silent) {
        if (result && result.success && result.data) {
            this.saveAllData(result.data);
            
            this.lastSyncTime = new Date().toISOString();
            localStorage.setItem(this.LAST_SYNC_KEY, this.lastSyncTime);
            
            this.log('INFO', 'Download success');
            
            if (!silent) {
                this.showToast(`✅ Download berhasil! P:${result.data.products?.length || 0} T:${result.data.transactions?.length || 0}`);
                setTimeout(() => location.reload(), 2000);
            } else {
                this.showToast('✅ Auto-download selesai');
                this.render();
            }
            
            if (typeof app !== 'undefined' && app.updateHeader) {
                app.updateHeader();
            }
        } else {
            this.log('ERROR', 'Download failed', result);
            if (!silent) this.showToast('❌ Download gagal: ' + (result?.message || 'Error'));
        }
    },

    saveAllData: function(data) {
        const keys = this.STORAGE_KEYS;
        
        if (data.products) localStorage.setItem(keys.products, JSON.stringify(data.products));
        if (data.categories) localStorage.setItem(keys.categories, JSON.stringify(data.categories));
        if (data.transactions) localStorage.setItem(keys.transactions, JSON.stringify(data.transactions));
        if (data.cashFlow || data.cashTransactions) {
            localStorage.setItem(keys.cashFlow, JSON.stringify(data.cashFlow || data.cashTransactions || []));
        }
        if (data.debts) localStorage.setItem(keys.debts, JSON.stringify(data.debts));
        if (data.settings) localStorage.setItem(keys.settings, JSON.stringify(data.settings));
        if (data.kasir) localStorage.setItem(keys.kasir, JSON.stringify(data.kasir));
        if (data.receipt) localStorage.setItem(keys.receipt, JSON.stringify(data.receipt));
        
        if (typeof dataManager !== 'undefined' && dataManager) {
            dataManager.data = this.getAllData();
            if (dataManager.save) dataManager.save();
        }
    },

    // ==================== RESET ====================

    resetLocal: function() {
        if (!confirm('⚠️ HAPUS SEMUA DATA LOKAL?\n\nData di cloud TIDAK terhapus.\n\nLanjutkan?')) return;
        if (prompt('Ketik HAPUS untuk konfirmasi:') !== 'HAPUS') {
            this.showToast('Dibatalkan');
            return;
        }
        
        this.log('INFO', 'Resetting local data');
        
        for (let key in this.STORAGE_KEYS) {
            localStorage.removeItem(this.STORAGE_KEYS[key]);
        }
        
        if (typeof dataManager !== 'undefined' && dataManager) {
            dataManager.data = this.getAllData();
            if (dataManager.save) dataManager.save();
        }
        
        this.showToast('✅ Data lokal dihapus!');
        setTimeout(() => location.reload(), 1500);
    },

    resetCloud: function() {
        if (!this.gasUrl) {
            this.showToast('❌ URL GAS belum diisi!');
            return;
        }
        
        if (!confirm('⚠️ YAKIN INGIN RESET CLOUD?\n\nSemua data di Google Sheets akan dihapus!\n\nIni tidak bisa dibatalkan.\n\nLanjutkan?')) return;
        
        if (prompt('Ketik RESET untuk konfirmasi:') !== 'RESET') {
            this.showToast('Dibatalkan');
            return;
        }
        
        this.showToast('🗑️ Mereset cloud...');
        this.log('INFO', 'Reset cloud started');
        
        const payload = {
            action: 'reset',
            timestamp: new Date().toISOString(),
            device: navigator.userAgent
        };
        
        fetch(this.gasUrl, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        })
        .then(response => {
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return response.json();
        })
        .then(result => {
            this.handleResetCloudResult(result);
        })
        .catch(error => {
            this.log('ERROR', 'Reset cloud failed: ' + error.message);
            this.resetCloudViaJSONP();
        });
    },

    resetCloudViaJSONP: function() {
        const payload = { action: 'reset', timestamp: new Date().toISOString() };
        const encoded = encodeURIComponent(JSON.stringify(payload));
        
        const cb = 'reset_cb_' + Date.now();
        
        window[cb] = (result) => {
            this.handleResetCloudResult(result);
            delete window[cb];
        };
        
        const script = document.createElement('script');
        script.onerror = () => {
            this.showToast('❌ Gagal reset cloud');
            delete window[cb];
        };
        
        script.src = this.gasUrl + '?callback=' + cb + '&data=' + encoded;
        document.head.appendChild(script);
        
        setTimeout(() => {
            if (window[cb]) {
                this.showToast('❌ Timeout');
                delete window[cb];
            }
        }, 15000);
    },

    handleResetCloudResult: function(result) {
        if (result && result.success) {
            this.lastSyncTime = new Date().toISOString();
            localStorage.setItem(this.LAST_SYNC_KEY, this.lastSyncTime);
            this.showToast('✅ Cloud berhasil direset!');
            this.log('INFO', 'Cloud reset success');
            this.render();
        } else {
            this.log('ERROR', 'Cloud reset failed', result);
            this.showToast('❌ Gagal reset: ' + (result?.message || 'Error'));
        }
    },

    resetBoth: function() {
        if (!confirm('💀 ANDA YAKIN?\n\nIni akan menghapus:\n1. Semua data di device ini\n2. Semua data di Google Sheets\n\nTIDAK BISA DIBATALKAN!\n\nLanjutkan?')) return;
        
        if (prompt('Ketik HAPUS SEMUA untuk konfirmasi:') !== 'HAPUS SEMUA') {
            this.showToast('Dibatalkan');
            return;
        }
        
        this.resetCloud();
        
        setTimeout(() => {
            this.resetLocal();
        }, 3000);
    },

    // ==================== UTILITIES ====================

    getDebugLogs: function() {
        return JSON.parse(localStorage.getItem(this.LOGS_KEY) || '[]');
    },

    clearDebugLogs: function() {
        localStorage.removeItem(this.LOGS_KEY);
        this.log('INFO', 'Logs cleared');
    },

    inspectData: function() {
        const data = this.getAllData();
        let info = 'DATA LOKAL:\n\n';
        
        info += `• Products: ${data.products?.length || 0}\n`;
        info += `• Categories: ${data.categories?.length || 0}\n`;
        info += `• Transactions: ${data.transactions?.length || 0}\n`;
        info += `• Cash Flow: ${data.cashFlow?.length || 0}\n`;
        info += `• Debts: ${data.debts?.length || 0}\n`;
        info += `• Kasir Open: ${data.kasir?.isOpen ? 'Ya' : 'Tidak'}\n\n`;
        
        let totalSize = 0;
        for (let key in this.STORAGE_KEYS) {
            const stored = localStorage.getItem(this.STORAGE_KEYS[key]);
            if (stored) totalSize += stored.length;
        }
        
        info += `Total Size: ${(totalSize / 1024).toFixed(2)} KB\n`;
        info += `GAS URL: ${this.gasUrl ? '✅ Tersimpan' : '❌ Belum diisi'}\n`;
        info += `Last Sync: ${this.lastSyncTime ? new Date(this.lastSyncTime).toLocaleString('id-ID') : 'Belum pernah'}`;
        
        alert(info);
    },

    testConnection: function() {
        this.checkCloudData();
    },

    checkCloudData: function() {
        this.showToast('🔍 Mengecek data di cloud...');
        
        const cb = 'check_' + Date.now();
        
        window[cb] = (result) => {
            if (result && result.success) {
                let info = '📊 Data di Cloud:\n\n';
                if (result.counts) {
                    info += `• Produk: ${result.counts.products}\n`;
                    info += `• Kategori: ${result.counts.categories}\n`;
                    info += `• Transaksi: ${result.counts.transactions}\n`;
                    info += `• Arus Kas: ${result.counts.cashFlow}\n`;
                    info += `• Hutang: ${result.counts.debts}\n`;
                }
                info += `\n• Timestamp: ${result.timestamp || 'N/A'}`;
                info += `\n• Sheets: ${result.sheets ? result.sheets.join(', ') : 'N/A'}`;
                alert(info);
            } else {
                alert('❌ Gagal: ' + (result?.message || 'Error tidak diketahui'));
            }
            delete window[cb];
        };
        
        const script = document.createElement('script');
        script.onerror = () => {
            this.log('ERROR', 'Check cloud connection failed');
            alert('❌ Gagal terhubung ke GAS. Pastikan:\n1. URL benar\n2. GAS sudah di-deploy\n3. Access: Anyone');
            delete window[cb];
        };
        
        script.src = this.gasUrl + '?action=ping&callback=' + cb + '&_t=' + Date.now();
        document.head.appendChild(script);
        
        setTimeout(() => {
            if (window[cb]) delete window[cb];
        }, 10000);
    },

    downloadJSON: function() {
        const data = this.getAllData();
        const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'hifzi_backup_' + new Date().toISOString().split('T')[0] + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.showToast('✅ File JSON didownload!');
    },

    importJSON: function(input) {
        const file = input.files[0];
        if (!file) return;
        if (!confirm('⚠️ Import akan menimpa data lokal?')) { 
            input.value = ''; 
            return; 
        }
        
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const d = JSON.parse(e.target.result);
                this.saveAllData(d);
                this.showToast('✅ Import berhasil!');
                this.render();
                
                if (typeof app !== 'undefined' && app.updateHeader) {
                    app.updateHeader();
                }
            } catch(err) {
                this.showToast('❌ Error: ' + err.message);
            }
        };
        
        reader.readAsText(file);
        input.value = '';
    },

    showToast: function(msg) {
        const t = document.getElementById('toast');
        if (t) { 
            t.textContent = msg; 
            t.classList.add('show'); 
            setTimeout(() => { t.classList.remove('show'); }, 4000); 
        } else {
            alert(msg);
        }
    }
};

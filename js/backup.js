// backup.js - Versi 15 - Full Structure Support
// Backup untuk: Products, Categories, Transactions, CashFlow, Debts, Settings, Kasir, Receipt

const backupModule = {
    currentProvider: 'local',
    autoSyncInterval: null,
    isAutoSyncEnabled: false,
    lastSyncTime: null,
    gasUrl: '',
    
    // Storage Keys (sesuai struktur Hifzi Cell)
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
        var timestamp = new Date().toLocaleTimeString('id-ID');
        var prefix = '[' + timestamp + '][Backup][' + level + ']';
        if (level === 'ERROR') console.error(prefix, message, data || '');
        else if (level === 'WARN') console.warn(prefix, message, data || '');
        else console.log(prefix, message, data || '');
        
        try {
            var logs = JSON.parse(localStorage.getItem(this.LOGS_KEY) || '[]');
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
    
    getDebugLogs: function() {
        return JSON.parse(localStorage.getItem(this.LOGS_KEY) || '[]');
    },
    
    clearDebugLogs: function() {
        localStorage.removeItem(this.LOGS_KEY);
        this.log('INFO', 'Logs cleared');
    },

    init: function() {
        this.log('INFO', 'Backup Module v15 (Full Structure) Initialized');
        this.gasUrl = localStorage.getItem(this.GAS_URL_KEY) || '';
        this.isAutoSyncEnabled = localStorage.getItem(this.AUTO_SYNC_KEY) === 'true';
        this.lastSyncTime = localStorage.getItem(this.LAST_SYNC_KEY) || null;
        
        if (this.gasUrl && this.gasUrl.length > 10) {
            this.currentProvider = 'googlesheet';
            this.log('INFO', 'Auto-selected Google Sheets provider');
            
            var localData = this.getAllData();
            var hasLocalData = this.hasAnyData(localData);
            
            if (!hasLocalData && this.gasUrl) {
                this.log('INFO', 'Device baru terdeteksi, auto-download...');
                this.showToast('📥 Device baru, mengunduh data...');
                var self = this;
                setTimeout(function() {
                    self.downloadData(true);
                }, 1000);
            }
        }
        
        if (this.isAutoSyncEnabled && this.gasUrl) {
            this.startAutoSync();
        }
        
        this.render();
    },

    // Ambil semua data dari localStorage
    getAllData: function() {
        var data = {};
        var keys = this.STORAGE_KEYS;
        
        for (var key in keys) {
            try {
                var stored = localStorage.getItem(keys[key]);
                data[key] = stored ? JSON.parse(stored) : this.getDefaultData(key);
            } catch(e) {
                this.log('ERROR', 'Error reading ' + key, e.message);
                data[key] = this.getDefaultData(key);
            }
        }
        
        return data;
    },

    // Default data untuk masing-masing tipe
    getDefaultData: function(type) {
        switch(type) {
            case 'products':
                return [];
            case 'categories':
                return [
                    { id: 'all', name: 'Semua', icon: '📦' },
                    { id: 'handphone', name: 'Handphone', icon: '📱' },
                    { id: 'aksesoris', name: 'Aksesoris', icon: '🎧' },
                    { id: 'pulsa', name: 'Pulsa', icon: '💳' },
                    { id: 'servis', name: 'Servis', icon: '🔧' }
                ];
            case 'transactions':
                return [];
            case 'cashFlow':
                return [];
            case 'debts':
                return [];
            case 'settings':
                return {
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
            case 'kasir':
                return {
                    isOpen: false,
                    openTime: null,
                    closeTime: null,
                    date: null,
                    shiftId: null,
                    openingBalance: 0,
                    closingBalance: 0
                };
            case 'receipt':
                return {
                    header: {
                        storeName: 'HIFZI CELL',
                        address: '',
                        phone: '',
                        note: 'Terima kasih atas kunjungan Anda'
                    },
                    footer: {
                        message: '',
                        thanks: ''
                    },
                    showLogo: false,
                    logoUrl: ''
                };
            default:
                return null;
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

    render: function() {
        var container = document.getElementById('mainContent');
        if (!container) return;

        var data = this.getAllData();
        var products = data.products ? data.products.length : 0;
        var categories = data.categories ? data.categories.length : 0;
        var transactions = data.transactions ? data.transactions.length : 0;
        var cashFlow = data.cashFlow ? data.cashFlow.length : 0;
        var debts = data.debts ? data.debts.length : 0;
        
        var settings = data.settings || {};
        var currentCash = settings.currentCash || 0;
        var storeName = settings.storeName || 'HIFZI CELL';
        
        var logs = this.getDebugLogs();
        var recentLogs = logs.slice(-5).reverse().map(function(log) {
            var color = log.level === 'ERROR' ? '#e74c3c' : (log.level === 'WARN' ? '#f39c12' : '#27ae60');
            var time = log.time.split('T')[1] ? log.time.split('T')[1].substr(0,8) : '--:--:--';
            return '<div style="font-size:10px;color:' + color + ';margin-bottom:2px;">[' + time + '] ' + log.message + '</div>';
        }).join('');

        var html = '<div class="content-section active" id="backupSection">';

        // Status Card
        var syncStatusColor = this.isAutoSyncEnabled ? '#4CAF50' : '#999';
        var syncStatusText = this.isAutoSyncEnabled ? '🟢 Auto Sync ON' : '⚪ Auto Sync OFF';
        
        html += '<div class="card" style="border:2px solid ' + syncStatusColor + ';margin-bottom:15px;">';
        html += '<div class="card-header"><span class="card-title">' + syncStatusText + '</span></div>';
        html += '<div style="padding:10px;font-size:12px;color:#666;">';
        if (this.lastSyncTime) {
            html += 'Last sync: ' + new Date(this.lastSyncTime).toLocaleString('id-ID');
        } else {
            html += 'Belum ada aktivitas sync';
        }
        html += '</div></div>';

        // Debug Panel
        html += '<div class="card" style="border:2px solid #9b59b6;margin-bottom:15px;">';
        html += '<div class="card-header" onclick="document.getElementById(\'debugPanel\').style.display=document.getElementById(\'debugPanel\').style.display===\'none\'?\'block\':\'none\'" style="cursor:pointer;">';
        html += '<span class="card-title">🐛 Debug Panel (Klik)</span><span style="float:right;">▼</span></div>';
        html += '<div id="debugPanel" style="display:none;padding:10px;background:#f8f9fa;">';
        html += '<div style="background:#2c3e50;color:#ecf0f1;padding:8px;border-radius:6px;font-family:monospace;font-size:11px;max-height:200px;overflow-y:auto;margin-bottom:8px;">';
        html += recentLogs || '<span style="color:#7f8c8d;">No logs...</span>';
        html += '</div>';
        html += '<div style="display:flex;gap:8px;flex-wrap:wrap;">';
        html += '<button onclick="backupModule.clearDebugLogs();backupModule.render();" style="flex:1;padding:8px;background:#e74c3c;color:white;border:none;border-radius:4px;font-size:11px;">Clear Logs</button>';
        html += '<button onclick="backupModule.inspectData()" style="flex:1;padding:8px;background:#3498db;color:white;border:none;border-radius:4px;font-size:11px;">Inspect Data</button>';
        html += '<button onclick="backupModule.testConnection()" style="flex:1;padding:8px;background:#27ae60;color:white;border:none;border-radius:4px;font-size:11px;">Test GAS</button>';
        html += '<button onclick="backupModule.checkCloudData()" style="flex:1;padding:8px;background:#FF9800;color:white;border:none;border-radius:4px;font-size:11px;">Cek Cloud</button>';
        html += '</div></div></div>';

        // Data Summary
        html += '<div class="card" style="border:2px solid #3498db;margin-bottom:15px;">';
        html += '<div class="card-header"><span class="card-title">📦 Data Lokal: ' + storeName + '</span></div>';
        html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:10px;">';
        html += '<div style="background:#e3f2fd;padding:10px;border-radius:6px;text-align:center;"><div style="font-size:11px;color:#666;">Produk</div><div style="font-size:20px;font-weight:bold;color:#2196F3;">' + products + '</div></div>';
        html += '<div style="background:#e8f5e9;padding:10px;border-radius:6px;text-align:center;"><div style="font-size:11px;color:#666;">Kategori</div><div style="font-size:20px;font-weight:bold;color:#4CAF50;">' + categories + '</div></div>';
        html += '<div style="background:#fff3e0;padding:10px;border-radius:6px;text-align:center;"><div style="font-size:11px;color:#666;">Transaksi</div><div style="font-size:20px;font-weight:bold;color:#FF9800;">' + transactions + '</div></div>';
        html += '<div style="background:#fce4ec;padding:10px;border-radius:6px;text-align:center;"><div style="font-size:11px;color:#666;">Arus Kas</div><div style="font-size:20px;font-weight:bold;color:#E91E63;">' + cashFlow + '</div></div>';
        html += '<div style="background:#f3e5f5;padding:10px;border-radius:6px;text-align:center;"><div style="font-size:11px;color:#666;">Hutang</div><div style="font-size:20px;font-weight:bold;color:#9C27B0;">' + debts + '</div></div>';
        html += '<div style="background:#e0f2f1;padding:10px;border-radius:6px;text-align:center;"><div style="font-size:11px;color:#666;">Kas</div><div style="font-size:14px;font-weight:bold;color:#009688;">' + this.formatRupiah(currentCash) + '</div></div>';
        html += '</div></div>';

        // Provider Selection
        html += '<div class="card" style="margin-bottom:15px;">';
        html += '<div class="card-header"><span class="card-title">☁️ Metode Backup</span></div>';
        html += '<div style="display:flex;gap:10px;padding:10px;">';
        
        var localStyle = this.currentProvider === 'local' ? 'border-color:#4CAF50;background:#e8f5e9;' : 'border-color:#ddd;background:#fff;';
        html += '<div onclick="backupModule.setProvider(\'local\')" style="flex:1;padding:15px;border:2px solid;border-radius:8px;text-align:center;cursor:pointer;' + localStyle + '">';
        html += '<div style="font-size:28px;">💾</div><div style="font-weight:600;font-size:14px;">Local File</div></div>';
        
        var sheetStyle = this.currentProvider === 'googlesheet' ? 'border-color:#4CAF50;background:#e8f5e9;' : 'border-color:#ddd;background:#fff;';
        html += '<div onclick="backupModule.setProvider(\'googlesheet\')" style="flex:1;padding:15px;border:2px solid;border-radius:8px;text-align:center;cursor:pointer;' + sheetStyle + '">';
        html += '<div style="font-size:28px;">📊</div><div style="font-weight:600;font-size:14px;">Google Sheets</div></div>';
        
        html += '</div></div>';

        // Google Sheets Config
        if (this.currentProvider === 'googlesheet') {
            html += '<div class="card" style="border:2px solid #2196F3;margin-bottom:15px;">';
            html += '<div class="card-header"><span class="card-title">📊 Google Sheets Configuration</span></div>';
            html += '<div style="padding:10px;">';
            
            html += '<div style="margin-bottom:12px;">';
            html += '<label style="display:block;margin-bottom:5px;font-size:13px;font-weight:600;">URL Web App GAS:</label>';
            html += '<input type="text" id="gasUrl" value="' + (this.gasUrl || '') + '" placeholder="https://script.google.com/macros/s/.../exec" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:13px;">';
            html += '</div>';
            
            html += '<button onclick="backupModule.saveUrl()" style="width:100%;background:#667eea;color:white;border:none;padding:12px;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer;margin-bottom:10px;">💾 Simpan & Validasi URL</button>';
            
            if (this.gasUrl) {
                var lastSync = this.lastSyncTime ? new Date(this.lastSyncTime).toLocaleString('id-ID') : 'Belum pernah';
                html += '<div style="padding:10px;background:#e8f5e9;border-radius:6px;font-size:12px;margin-bottom:10px;">';
                html += '✅ URL tersimpan<br>';
                html += '<small>Last sync: ' + lastSync + '</small>';
                html += '</div>';
                
                // PINDAH DEVICE
                html += '<div style="background:#e3f2fd;border-radius:8px;padding:12px;margin-bottom:10px;border:2px solid #2196F3;">';
                html += '<div style="font-size:14px;font-weight:600;margin-bottom:8px;color:#1565c0;">📥 PINDAH DEVICE</div>';
                html += '<button onclick="backupModule.downloadData()" style="width:100%;padding:15px;background:#2196F3;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:700;font-size:14px;">';
                html += '📥 DOWNLOAD DATA DARI CLOUD';
                html += '</button>';
                html += '</div>';
                
                // Sync Controls
                html += '<div style="background:#fff3e0;border-radius:8px;padding:12px;margin-bottom:10px;">';
                html += '<div style="font-size:13px;font-weight:600;margin-bottom:8px;">🔄 Auto Sync</div>';
                
                var autoBg = this.isAutoSyncEnabled ? '#4CAF50' : '#ccc';
                var autoPos = this.isAutoSyncEnabled ? '22px' : '2px';
                html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding:10px;background:#f5f5f5;border-radius:6px;">';
                html += '<div><div style="font-size:13px;font-weight:600;">Auto Sync</div><div style="font-size:11px;color:#666;">Upload & Cek Download setiap 3 menit</div></div>';
                html += '<div onclick="backupModule.toggleAutoSync()" style="cursor:pointer;width:44px;height:24px;background:' + autoBg + ';border-radius:12px;position:relative;transition:all 0.3s;">';
                html += '<div style="width:20px;height:20px;background:white;border-radius:50%;position:absolute;top:2px;left:' + autoPos + ';transition:all 0.3s;"></div></div></div>';
                
                html += '<button onclick="backupModule.uploadData()" style="width:100%;padding:12px;background:#4CAF50;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:13px;margin-bottom:8px;">';
                html += '⬆️ UPLOAD KE CLOUD';
                html += '</button>';
                
                html += '</div>';
            }
            html += '</div></div>';
        }

        // Local Backup
        html += '<div class="card" style="margin-bottom:15px;">';
        html += '<div class="card-header"><span class="card-title">💾 Backup Local (JSON)</span></div>';
        html += '<div style="padding:10px;">';
        html += '<button onclick="backupModule.downloadJSON()" style="width:100%;padding:12px;background:#667eea;color:white;border:none;border-radius:6px;cursor:pointer;margin-bottom:10px;font-size:13px;font-weight:600;">⬇️ Download JSON Backup</button>';
        html += '<div style="border:2px dashed #ddd;border-radius:6px;padding:10px;text-align:center;">';
        html += '<label style="font-size:12px;color:#666;cursor:pointer;">';
        html += '<input type="file" accept=".json" onchange="backupModule.importJSON(this)" style="display:none;">';
        html += '📤 Klik untuk Import JSON';
        html += '</label>';
        html += '</div>';
        html += '</div></div>';

        // ZONA BAHAYA - RESET
        html += '<div class="card" style="border:2px solid #e74c3c;">';
        html += '<div class="card-header"><span class="card-title" style="color:#e74c3c;">🗑️ Zona Bahaya</span></div>';
        html += '<div style="padding:10px;">';

        // Reset Lokal
        html += '<button onclick="backupModule.resetLocal()" style="width:100%;background:#e74c3c;color:white;border:none;padding:12px;border-radius:6px;cursor:pointer;font-weight:600;font-size:13px;margin-bottom:8px;">';
        html += '🗑️ HAPUS DATA LOKAL SAJA';
        html += '</button>';
        html += '<div style="font-size:11px;color:#666;margin-bottom:15px;text-align:center;">Data di cloud tetap ada</div>';

        // Reset Cloud (hanya jika ada URL)
        if (this.gasUrl) {
            html += '<button onclick="backupModule.resetCloud()" style="width:100%;background:#9C27B0;color:white;border:none;padding:12px;border-radius:6px;cursor:pointer;font-weight:600;font-size:13px;margin-bottom:8px;">';
            html += '☁️ RESET CLOUD (Google Sheets)';
            html += '</button>';
            html += '<div style="font-size:11px;color:#666;margin-bottom:15px;text-align:center;">Semua data di Google Sheets dihapus</div>';
            
            // Reset BOTH
            html += '<button onclick="backupModule.resetBoth()" style="width:100%;background:#000;color:white;border:none;padding:12px;border-radius:6px;cursor:pointer;font-weight:600;font-size:13px;">';
            html += '💀 RESET TOTAL (Lokal + Cloud)';
            html += '</button>';
            html += '<div style="font-size:11px;color:#666;text-align:center;">Hapus semua data dimana-mana</div>';
        }

        html += '</div></div>';

        html += '</div>';
        container.innerHTML = html;
    },

    setProvider: function(provider) {
        this.log('INFO', 'Provider changed to: ' + provider);
        this.currentProvider = provider;
        this.render();
    },

    saveUrl: function() {
        var input = document.getElementById('gasUrl');
        if (!input) return;
        var url = input.value.trim();
        
        if (!url || url.length < 20 || !url.includes('script.google.com')) {
            alert('❌ URL tidak valid! Harus URL Google Apps Script Web App');
            return;
        }
        
        this.gasUrl = url;
        localStorage.setItem(this.GAS_URL_KEY, url);
        this.log('INFO', 'GAS URL saved: ' + url.substring(0, 50) + '...');
        
        // Test koneksi setelah simpan
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
        var self = this;
        
        this.performTwoWaySync();
        
        this.autoSyncInterval = setInterval(function() {
            self.performTwoWaySync();
        }, 180000); // 3 menit
        
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
        var self = this;
        this.log('INFO', 'Auto Sync: Starting 2-way sync');
        
        this.uploadData(true, function(uploadSuccess) {
            if (uploadSuccess) {
                self.checkAndDownloadIfNeeded();
            }
        });
    },

    checkAndDownloadIfNeeded: function() {
        var self = this;
        
        this.getCloudTimestamp(function(cloudTime) {
            if (!cloudTime) {
                self.log('WARN', 'Could not get cloud timestamp');
                return;
            }
            
            var localTime = self.lastSyncTime;
            
            if (cloudTime > localTime) {
                self.log('INFO', 'Cloud has newer data, auto-downloading...');
                self.showToast('📥 Data cloud lebih baru, mengunduh...');
                self.downloadData(true);
            }
        });
    },

    getCloudTimestamp: function(callback) {
        var self = this;
        var script = document.createElement('script');
        var cb = 'ts_check_' + Date.now();
        
        window[cb] = function(result) {
            if (result && result.success && result.timestamp) {
                callback(result.timestamp);
            } else {
                callback(null);
            }
            delete window[cb];
            if (script.parentNode) script.parentNode.removeChild(script);
        };
        
        script.onerror = function() {
            callback(null);
            delete window[cb];
        };
        
        script.src = this.gasUrl + '?action=getTimestamp&callback=' + cb + '&_t=' + Date.now();
        document.head.appendChild(script);
        
        setTimeout(function() {
            if (window[cb]) {
                callback(null);
                delete window[cb];
                if (script.parentNode) script.parentNode.removeChild(script);
            }
        }, 10000);
    },

    // ============================================
    // UPLOAD
    // ============================================
    
    uploadData: function(silent, callback) {
        var self = this;
        this.log('INFO', 'Upload started');
        
        if (!this.gasUrl) {
            if (!silent) alert('❌ URL GAS belum diisi!');
            if (callback) callback(false);
            return;
        }
        
        var data = this.getAllData();
        
        if (!silent) this.showToast('⬆️ Mengupload...');
        
        var payload = {
            action: 'sync',
            data: data,
            timestamp: new Date().toISOString(),
            device: navigator.userAgent
        };
        
        // Coba fetch dulu (modern browsers)
        fetch(this.gasUrl, {
            method: 'POST',
            mode: 'cors',
            headers: { 
                'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify(payload)
        })
        .then(function(response) {
            self.log('INFO', 'Fetch response: ' + response.status);
            if (!response.ok) {
                throw new Error('HTTP ' + response.status);
            }
            return response.json();
        })
        .then(function(result) {
            self.handleUploadSuccess(result, silent, callback);
        })
        .catch(function(error) {
            self.log('WARN', 'Fetch failed, trying JSONP: ' + error.message);
            // Fallback ke JSONP jika fetch gagal
            self.uploadViaJSONP(payload, silent, callback);
        });
    },
    
    uploadViaJSONP: function(payload, silent, callback) {
        var self = this;
        var jsonStr = JSON.stringify(payload);
        
        // Jika data terlalu besar, pakai iframe
        if (jsonStr.length > 8000) {
            this.log('INFO', 'Data too large for JSONP, using iframe');
            this.uploadViaIframe(payload, silent, callback);
            return;
        }
        
        var encoded = encodeURIComponent(jsonStr);
        var script = document.createElement('script');
        var callbackName = 'upload_cb_' + Date.now();
        
        window[callbackName] = function(result) {
            self.handleUploadSuccess(result, silent, callback);
            delete window[callbackName];
            if (script.parentNode) script.parentNode.removeChild(script);
        };
        
        script.onerror = function() {
            self.log('ERROR', 'JSONP upload error - CORS atau network issue');
            if (!silent) self.showToast('❌ Upload gagal - Cek console (F12)');
            delete window[callbackName];
            // Coba iframe sebagai last resort
            self.uploadViaIframe(payload, silent, callback);
        };
        
        var url = this.gasUrl + '?callback=' + callbackName + '&data=' + encoded;
        script.src = url;
        document.head.appendChild(script);
        
        setTimeout(function() {
            if (window[callbackName]) {
                self.log('ERROR', 'JSONP upload timeout');
                if (!silent) self.showToast('❌ Timeout - Coba lagi');
                delete window[callbackName];
                if (script.parentNode) script.parentNode.removeChild(script);
                if (callback) callback(false);
            }
        }, 15000);
    },

    uploadViaIframe: function(payload, silent, callback) {
        var self = this;
        
        var formId = 'up_form_' + Date.now();
        var iframeId = 'up_ifrm_' + Date.now();
        
        var form = document.createElement('form');
        form.id = formId;
        form.method = 'POST';
        form.action = this.gasUrl;
        form.target = iframeId;
        form.style.display = 'none';
        
        var input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'data';
        input.value = JSON.stringify(payload);
        form.appendChild(input);
        
        var iframe = document.createElement('iframe');
        iframe.id = iframeId;
        iframe.name = iframeId;
        iframe.style.display = 'none';
        
        document.body.appendChild(form);
        document.body.appendChild(iframe);
        
        iframe.onload = function() {
            try {
                var doc = iframe.contentDocument || iframe.contentWindow.document;
                var text = doc.body.innerText || doc.body.textContent;
                var result = JSON.parse(text);
                self.handleUploadSuccess(result, silent, callback);
            } catch(e) {
                self.log('WARN', 'Iframe parse error, assuming success');
                self.lastSyncTime = new Date().toISOString();
                localStorage.setItem(self.LAST_SYNC_KEY, self.lastSyncTime);
                if (!silent) self.showToast('✅ Upload selesai (iframe)');
                self.render();
                if (callback) callback(true);
            }
            setTimeout(function() {
                var f = document.getElementById(formId);
                var i = document.getElementById(iframeId);
                if (f) f.remove();
                if (i) i.remove();
            }, 2000);
        };
        
        form.submit();
    },

    handleUploadSuccess: function(result, silent, callback) {
        if (result && result.success) {
            this.lastSyncTime = new Date().toISOString();
            localStorage.setItem(this.LAST_SYNC_KEY, this.lastSyncTime);
            
            var msg = '✅ Upload OK!';
            if (result.counts) {
                msg += ' P:' + result.counts.products + ' T:' + result.counts.transactions;
            }
            
            if (!silent) this.showToast(msg);
            this.log('INFO', 'Upload success', result.counts);
            this.render();
            if (callback) callback(true);
        } else {
            this.log('ERROR', 'Upload failed', result);
            if (!silent) {
                var errMsg = result && result.message ? result.message : 'Unknown error';
                this.showToast('❌ Upload gagal: ' + errMsg);
            }
            if (callback) callback(false);
        }
    },

    // ============================================
    // DOWNLOAD
    // ============================================
    
    downloadData: function(silent) {
        var self = this;
        
        if (!silent) {
            if (!confirm('📥 Download akan mengganti data lokal dengan data dari cloud.\n\nLanjutkan?')) return;
        }
        
        if (!this.gasUrl) {
            if (!silent) alert('❌ URL GAS belum diisi!');
            return;
        }
        
        if (!silent) this.showToast('⬇️ Mengunduh data...');
        this.log('INFO', 'Download started');
        
        // Coba fetch dulu
        fetch(this.gasUrl + '?action=restore&_t=' + Date.now(), {
            method: 'GET',
            mode: 'cors',
            headers: { 'Accept': 'application/json' }
        })
        .then(function(response) {
            self.log('INFO', 'Download response: ' + response.status);
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return response.json();
        })
        .then(function(result) {
            self.handleDownloadResult(result, silent);
        })
        .catch(function(error) {
            self.log('WARN', 'Fetch download failed: ' + error.message);
            // Fallback ke JSONP
            self.downloadViaJSONP(silent);
        });
    },
    
    downloadViaJSONP: function(silent) {
        var self = this;
        
        var script = document.createElement('script');
        var cb = 'dl_cb_' + Date.now();
        
        var cleanup = function() {
            delete window[cb];
            if (script.parentNode) script.parentNode.removeChild(script);
        };
        
        window[cb] = function(result) {
            self.handleDownloadResult(result, silent);
            cleanup();
        };
        
        script.onerror = function() {
            self.log('ERROR', 'JSONP download failed - CORS error');
            if (!silent) self.showToast('❌ Gagal terhubung - Cek URL GAS');
            cleanup();
        };
        
        var url = this.gasUrl + '?action=restore&callback=' + cb + '&_t=' + Date.now();
        script.src = url;
        document.head.appendChild(script);
        
        setTimeout(function() {
            if (window[cb]) {
                self.log('ERROR', 'Download timeout');
                if (!silent) self.showToast('❌ Timeout');
                cleanup();
            }
        }, 20000);
    },
    
    handleDownloadResult: function(result, silent) {
        this.log('INFO', 'Download result received', result);
        
        if (result && result.success && result.data) {
            var d = result.data;
            
            // Simpan semua data ke localStorage
            this.saveAllData(d);
            
            this.lastSyncTime = new Date().toISOString();
            localStorage.setItem(this.LAST_SYNC_KEY, this.lastSyncTime);
            
            var msg = '✅ Download berhasil!\n' +
                      '📦 Produk: ' + (d.products ? d.products.length : 0) + '\n' +
                      '📝 Transaksi: ' + (d.transactions ? d.transactions.length : 0);
            
            this.log('INFO', 'Download success');
            
            if (!silent) {
                this.showToast(msg);
                setTimeout(function() {
                    location.reload();
                }, 2000);
            } else {
                this.showToast('✅ Auto-download selesai');
                this.render();
            }
            
            if (typeof app !== 'undefined' && app.updateHeader) {
                app.updateHeader();
            }
        } else {
            this.log('ERROR', 'Download failed', result);
            if (!silent) {
                var errMsg = result && result.message ? result.message : 'Tidak ada response';
                this.showToast('❌ Download gagal: ' + errMsg);
            }
        }
    },

    // Simpan semua data ke localStorage
    saveAllData: function(data) {
        var keys = this.STORAGE_KEYS;
        
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
        
        // Update dataManager jika ada
        if (typeof dataManager !== 'undefined' && dataManager) {
            dataManager.data = this.getAllData();
            if (dataManager.save) dataManager.save();
        }
    },

    // ============================================
    // RESET FUNCTIONS
    // ============================================
    
    resetLocal: function() {
        if (!confirm('⚠️ HAPUS SEMUA DATA LOKAL?\n\nData di cloud TIDAK terhapus.\n\nLanjutkan?')) return;
        if (prompt('Ketik HAPUS untuk konfirmasi:') !== 'HAPUS') {
            alert('Dibatalkan');
            return;
        }
        
        this.log('INFO', 'Resetting local data');
        
        // Hapus semua storage keys
        for (var key in this.STORAGE_KEYS) {
            localStorage.removeItem(this.STORAGE_KEYS[key]);
        }
        
        // Reset dataManager
        if (typeof dataManager !== 'undefined' && dataManager) {
            dataManager.data = this.getAllData();
            if (dataManager.save) dataManager.save();
        }
        
        this.showToast('✅ Data lokal dihapus!');
        setTimeout(function() {
            location.reload();
        }, 1500);
    },

    resetCloud: function() {
        var self = this;
        
        if (!this.gasUrl) {
            alert('❌ URL GAS belum diisi!');
            return;
        }
        
        if (!confirm('⚠️ YAKIN INGIN RESET CLOUD?\n\nSemua data di Google Sheets akan dihapus!\n\nIni tidak bisa dibatalkan.\n\nLanjutkan?')) {
            return;
        }
        
        if (prompt('Ketik RESET untuk konfirmasi:') !== 'RESET') {
            alert('Dibatalkan');
            return;
        }
        
        this.showToast('🗑️ Mereset cloud...');
        this.log('INFO', 'Reset cloud started');
        
        var payload = {
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
        .then(function(response) {
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return response.json();
        })
        .then(function(result) {
            self.handleResetCloudResult(result);
        })
        .catch(function(error) {
            self.log('ERROR', 'Reset cloud fetch failed: ' + error.message);
            self.resetCloudViaJSONP();
        });
    },

    resetCloudViaJSONP: function() {
        var self = this;
        var payload = { action: 'reset', timestamp: new Date().toISOString() };
        var encoded = encodeURIComponent(JSON.stringify(payload));
        
        var script = document.createElement('script');
        var cb = 'reset_cb_' + Date.now();
        
        window[cb] = function(result) {
            self.handleResetCloudResult(result);
            delete window[cb];
            if (script.parentNode) script.parentNode.removeChild(script);
        };
        
        script.onerror = function() {
            self.log('ERROR', 'Reset cloud JSONP error');
            self.showToast('❌ Gagal reset cloud');
            delete window[cb];
        };
        
        var url = this.gasUrl + '?callback=' + cb + '&data=' + encoded;
        script.src = url;
        document.head.appendChild(script);
        
        setTimeout(function() {
            if (window[cb]) {
                self.showToast('❌ Timeout reset cloud');
                delete window[cb];
                if (script.parentNode) script.parentNode.removeChild(script);
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
            this.showToast('❌ Gagal reset: ' + (result && result.message ? result.message : 'Error'));
        }
    },

    resetBoth: function() {
        var self = this;
        
        if (!confirm('💀 ANDA YAKIN?\n\nIni akan menghapus:\n1. Semua data di device ini\n2. Semua data di Google Sheets\n\nTIDAK BISA DIBATALKAN!\n\nLanjutkan?')) {
            return;
        }
        
        if (prompt('Ketik HAPUS SEMUA untuk konfirmasi:') !== 'HAPUS SEMUA') {
            alert('Dibatalkan');
            return;
        }
        
        // Step 1: Reset cloud
        this.resetCloud();
        
        // Step 2: Reset lokal setelah 3 detik
        setTimeout(function() {
            self.resetLocal();
        }, 3000);
    },

    // ============================================
    // UTILITIES
    // ============================================
    
    inspectData: function() {
        var data = this.getAllData();
        var info = 'DATA LOKAL:\n\n';
        
        info += '• Products: ' + (data.products ? data.products.length : 0) + '\n';
        info += '• Categories: ' + (data.categories ? data.categories.length : 0) + '\n';
        info += '• Transactions: ' + (data.transactions ? data.transactions.length : 0) + '\n';
        info += '• Cash Flow: ' + (data.cashFlow ? data.cashFlow.length : 0) + '\n';
        info += '• Debts: ' + (data.debts ? data.debts.length : 0) + '\n';
        info += '• Kasir Open: ' + (data.kasir && data.kasir.isOpen ? 'Ya' : 'Tidak') + '\n\n';
        
        // Hitung ukuran
        var totalSize = 0;
        for (var key in this.STORAGE_KEYS) {
            var stored = localStorage.getItem(this.STORAGE_KEYS[key]);
            if (stored) totalSize += stored.length;
        }
        
        info += 'Total Size: ' + (totalSize / 1024).toFixed(2) + ' KB\n';
        info += 'GAS URL: ' + (this.gasUrl ? '✅ Tersimpan' : '❌ Belum diisi') + '\n';
        info += 'Last Sync: ' + (this.lastSyncTime ? new Date(this.lastSyncTime).toLocaleString('id-ID') : 'Belum pernah');
        
        alert(info);
    },

    testConnection: function() {
        this.checkCloudData();
    },

    checkCloudData: function() {
        var self = this;
        this.showToast('🔍 Mengecek data di cloud...');
        
        var script = document.createElement('script');
        var cb = 'check_' + Date.now();
        
        window[cb] = function(result) {
            if (result && result.success) {
                var info = '📊 Data di Cloud:\n\n';
                if (result.counts) {
                    info += '• Produk: ' + result.counts.products + '\n';
                    info += '• Kategori: ' + result.counts.categories + '\n';
                    info += '• Transaksi: ' + result.counts.transactions + '\n';
                    info += '• Arus Kas: ' + result.counts.cashFlow + '\n';
                    info += '• Hutang: ' + result.counts.debts + '\n';
                }
                info += '\n• Timestamp: ' + (result.timestamp || 'N/A');
                info += '\n• Sheets: ' + (result.sheets ? result.sheets.join(', ') : 'N/A');
                alert(info);
            } else {
                alert('❌ Gagal: ' + (result && result.message ? result.message : 'Error tidak diketahui'));
            }
            delete window[cb];
            if (script.parentNode) script.parentNode.removeChild(script);
        };
        
        script.onerror = function() {
            self.log('ERROR', 'Check cloud connection failed');
            alert('❌ Gagal terhubung ke GAS. Pastikan:\n1. URL benar\n2. GAS sudah di-deploy\n3. Access: Anyone');
            delete window[cb];
        };
        
        script.src = this.gasUrl + '?action=ping&callback=' + cb + '&_t=' + Date.now();
        document.head.appendChild(script);
        
        setTimeout(function() {
            if (window[cb]) {
                delete window[cb];
                if (script.parentNode) script.parentNode.removeChild(script);
            }
        }, 10000);
    },

    downloadJSON: function() {
        var data = this.getAllData();
        var blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'hifzi_backup_' + new Date().toISOString().split('T')[0] + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.showToast('✅ File JSON didownload!');
    },

    importJSON: function(input) {
        var file = input.files[0];
        if (!file) return;
        if (!confirm('⚠️ Import akan menimpa data lokal?')) { 
            input.value = ''; 
            return; 
        }
        
        var self = this;
        var reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                var d = JSON.parse(e.target.result);
                self.saveAllData(d);
                
                self.showToast('✅ Import berhasil!');
                self.render();
                
                if (typeof app !== 'undefined' && app.updateHeader) {
                    app.updateHeader();
                }
            } catch(err) {
                alert('❌ Error: ' + err.message);
            }
        };
        
        reader.readAsText(file);
        input.value = '';
    },

    showToast: function(msg) {
        var t = document.getElementById('toast');
        if (t) { 
            t.textContent = msg; 
            t.classList.add('show'); 
            setTimeout(function() { t.classList.remove('show'); }, 4000); 
        } else {
            alert(msg);
        }
    }
};

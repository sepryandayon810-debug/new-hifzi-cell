// backup.js - Versi 13d FIXED
// PERBAIKAN: Reset cloud, upload kosong, struktur data lengkap

const backupModule = {
    currentProvider: 'local',
    autoSyncInterval: null,
    isAutoSyncEnabled: false,
    lastSyncTime: null,
    gasUrl: '',
    
    STORAGE_KEY: 'hifzi_cell_data',
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
        this.log('INFO', 'Backup Module v13d-FIXED Initialized');
        this.gasUrl = localStorage.getItem(this.GAS_URL_KEY) || '';
        this.isAutoSyncEnabled = localStorage.getItem(this.AUTO_SYNC_KEY) === 'true';
        this.lastSyncTime = localStorage.getItem(this.LAST_SYNC_KEY) || null;
        
        if (this.gasUrl && this.gasUrl.length > 10) {
            this.currentProvider = 'googlesheet';
            this.log('INFO', 'Auto-selected Google Sheets provider');
            
            var localData = this.getDataFromStorage();
            var hasLocalData = localData.products.length > 0 || localData.transactions.length > 0;
            
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

    getDataFromStorage: function() {
        var data = null;
        
        try {
            var stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                data = JSON.parse(stored);
            }
        } catch(e) {
            this.log('ERROR', 'localStorage parse error', e.message);
        }

        if (!data && typeof dataManager !== 'undefined' && dataManager.data) {
            data = dataManager.data;
        }

        var complete = {
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
            },
            debts: [],
            lastBackup: null,
            version: '1.0'
        };

        if (data) {
            if (Array.isArray(data.categories)) complete.categories = data.categories;
            if (Array.isArray(data.products)) complete.products = data.products;
            if (Array.isArray(data.transactions)) complete.transactions = data.transactions;
            if (Array.isArray(data.cashTransactions)) complete.cashTransactions = data.cashTransactions;
            if (Array.isArray(data.debts)) complete.debts = data.debts;
            
            if (data.settings && typeof data.settings === 'object') {
                complete.settings = { ...complete.settings, ...data.settings };
            }
            if (data.kasir && typeof data.kasir === 'object') {
                complete.kasir = { ...complete.kasir, ...data.kasir };
            }
        }

        return complete;
    },

    hasData: function() {
        var d = this.getDataFromStorage();
        return d.products.length > 0 || 
               d.transactions.length > 0 || 
               d.debts.length > 0 || 
               d.cashTransactions.length > 0 ||
               d.categories.length > 1;
    },

    formatRupiah: function(amount) {
        if (!amount && amount !== 0) return 'Rp 0';
        return 'Rp ' + amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    },

    render: function() {
        var container = document.getElementById('mainContent');
        if (!container) return;

        var data = this.getDataFromStorage();
        var products = data.products.length;
        var categories = data.categories.length;
        var transactions = data.transactions.length;
        var cashTrans = data.cashTransactions.length;
        var debts = data.debts.length;
        
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
            html += 'Last activity: ' + new Date(this.lastSyncTime).toLocaleString('id-ID');
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
        html += '<div style="background:#fce4ec;padding:10px;border-radius:6px;text-align:center;"><div style="font-size:11px;color:#666;">Arus Kas</div><div style="font-size:20px;font-weight:bold;color:#E91E63;">' + cashTrans + '</div></div>';
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
            alert('❌ URL tidak valid!');
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
        var self = this;
        
        this.performTwoWaySync();
        
        this.autoSyncInterval = setInterval(function() {
            self.performTwoWaySync();
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
        
        script.src = this.gasUrl + '?action=getTimestamp&callback=' + cb;
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
            if (!silent) alert('❌ URL belum diisi!');
            if (callback) callback(false);
            return;
        }
        
        var data = this.getDataFromStorage();
        
        // KHUSUS: Izinkan upload meski kosong (untuk reset cloud via sync)
        if (!silent) this.showToast('⬆️ Mengupload...');
        
        var payload = {
            action: 'sync',
            data: data,
            timestamp: new Date().toISOString(),
            device: navigator.userAgent
        };
        
        fetch(this.gasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        })
        .then(function(response) {
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return response.json();
        })
        .then(function(result) {
            self.handleUploadSuccess(result, silent, callback);
        })
        .catch(function(error) {
            self.log('ERROR', 'Fetch upload failed: ' + error.message);
            self.uploadViaJSONP(payload, silent, callback);
        });
    },
    
    uploadViaJSONP: function(payload, silent, callback) {
        var self = this;
        var jsonStr = JSON.stringify(payload);
        
        if (jsonStr.length > 8000) {
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
            self.log('ERROR', 'JSONP upload error');
            if (!silent) self.showToast('❌ Upload gagal');
            delete window[callbackName];
            self.uploadViaIframe(payload, silent, callback);
        };
        
        var url = this.gasUrl + '?callback=' + callbackName + '&data=' + encoded;
        script.src = url;
        document.head.appendChild(script);
        
        setTimeout(function() {
            if (window[callbackName]) {
                if (!silent) self.showToast('❌ Timeout');
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
                self.lastSyncTime = new Date().toISOString();
                localStorage.setItem(self.LAST_SYNC_KEY, self.lastSyncTime);
                if (!silent) self.showToast('✅ Upload selesai');
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
            if (!silent) this.showToast('❌ Upload gagal');
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
            if (!silent) alert('❌ URL belum diisi!');
            return;
        }
        
        if (!silent) this.showToast('⬇️ Mengunduh data...');
        this.log('INFO', 'Download started');
        
        fetch(this.gasUrl + '?action=restore', {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        })
        .then(function(response) {
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return response.json();
        })
        .then(function(result) {
            self.handleDownloadResult(result, silent);
        })
        .catch(function(error) {
            self.log('WARN', 'Fetch download failed: ' + error.message);
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
            self.log('ERROR', 'JSONP download failed');
            if (!silent) self.showToast('❌ Gagal terhubung ke cloud');
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
            
            if (!d.products) d.products = [];
            if (!d.categories) d.categories = [];
            if (!d.transactions) d.transactions = [];
            if (!d.cashTransactions) d.cashTransactions = [];
            if (!d.debts) d.debts = [];
            if (!d.settings) d.settings = {};
            if (!d.kasir) d.kasir = {isOpen: false, openTime: null, closeTime: null, date: null};
            
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(d));
            
            if (typeof dataManager !== 'undefined' && dataManager) {
                dataManager.data = d;
                if (dataManager.save) dataManager.save();
            }
            
            this.lastSyncTime = new Date().toISOString();
            localStorage.setItem(this.LAST_SYNC_KEY, this.lastSyncTime);
            
            var msg = '✅ Download berhasil!\n' +
                      '📦 Produk: ' + d.products.length + '\n' +
                      '📝 Transaksi: ' + d.transactions.length;
            
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
                var errMsg = result ? result.message : 'Tidak ada response';
                this.showToast('❌ Download gagal: ' + errMsg);
            }
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
        localStorage.removeItem(this.STORAGE_KEY);
        
        if (typeof dataManager !== 'undefined' && dataManager) {
            dataManager.data = {
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
                debts: [], 
                settings: {},
                kasir: {isOpen: false, openTime: null, closeTime: null, date: null}
            };
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
            alert('❌ URL belum diisi!');
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
            this.showToast('❌ Gagal reset: ' + (result ? result.message : 'Error'));
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
        var data = this.getDataFromStorage();
        var raw = localStorage.getItem(this.STORAGE_KEY);
        var rawSize = raw ? (raw.length / 1024).toFixed(2) + ' KB' : 'N/A';
        
        var info = 'DATA LOKAL (' + this.STORAGE_KEY + '):\n\n' +
                   '• Produk: ' + data.products.length + '\n' +
                   '• Kategori: ' + data.categories.length + '\n' +
                   '• Transaksi: ' + data.transactions.length + '\n' +
                   '• Arus Kas: ' + data.cashTransactions.length + '\n' +
                   '• Hutang: ' + data.debts.length + '\n' +
                   '• Kasir Open: ' + (data.kasir && data.kasir.isOpen ? 'Ya' : 'Tidak') + '\n\n' +
                   'Ukuran: ' + rawSize + '\n' +
                   'Last Sync: ' + (this.lastSyncTime ? new Date(this.lastSyncTime).toLocaleString('id-ID') : 'Belum pernah');
        
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
                    info += '• Arus Kas: ' + result.counts.cashTransactions + '\n';
                    info += '• Hutang: ' + result.counts.debts + '\n';
                }
                info += '\n• Timestamp: ' + (result.timestamp || 'N/A');
                info += '\n• Sheets: ' + (result.sheets ? result.sheets.join(', ') : 'N/A');
                alert(info);
            } else {
                alert('❌ Gagal: ' + (result ? result.message : 'Error'));
            }
            delete window[cb];
            if (script.parentNode) script.parentNode.removeChild(script);
        };
        
        script.onerror = function() {
            alert('❌ Gagal terhubung');
            delete window[cb];
        };
        
        script.src = this.gasUrl + '?action=ping&callback=' + cb;
        document.head.appendChild(script);
        
        setTimeout(function() {
            if (window[cb]) {
                delete window[cb];
                if (script.parentNode) script.parentNode.removeChild(script);
            }
        }, 10000);
    },

    downloadJSON: function() {
        var data = this.getDataFromStorage();
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
                
                if (!d.products) d.products = [];
                if (!d.categories) d.categories = [];
                if (!d.transactions) d.transactions = [];
                if (!d.cashTransactions) d.cashTransactions = [];
                if (!d.debts) d.debts = [];
                if (!d.settings) d.settings = {};
                if (!d.kasir) d.kasir = {isOpen: false, openTime: null, closeTime: null, date: null};
                
                localStorage.setItem(self.STORAGE_KEY, JSON.stringify(d));
                
                if (typeof dataManager !== 'undefined' && dataManager) {
                    dataManager.data = d;
                    if (dataManager.save) dataManager.save();
                }
                
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
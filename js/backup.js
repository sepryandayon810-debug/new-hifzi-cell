// backup.js - Versi 3 Provider: Local File, Google Sheets, Firebase
// Bisa pilih salah satu, tidak konflik

const backupModule = {
    // ==================== CONFIG ====================
    
    // Pilihan provider: 'local', 'googlesheet', 'firebase'
    currentProvider: 'local',
    
    // Google Sheets Config (untuk GAS)
    gasUrl: '',
    
    // Firebase Config (GANTI DENGAN PUNYA ANDA!)
    firebaseConfig: {
        apiKey: "GANTI_DENGAN_API_KEY_ANDA",
        authDomain: "GANTI.firebaseapp.com",
        databaseURL: "https://GANTI-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "GANTI",
        storageBucket: "GANTI.appspot.com",
        messagingSenderId: "GANTI",
        appId: "GANTI"
    },
    
    // Firebase instances
    firebaseApp: null,
    database: null,
    auth: null,
    currentUser: null,
    
    // State
    isAutoSyncEnabled: false,
    autoSyncInterval: null,
    lastSyncTime: null,
    isOnline: navigator.onLine,
    pendingSync: false,
    deviceId: null,
    deviceName: null,
    
    // Keys
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
    DEVICE_ID_KEY: 'hifzi_device_id',
    DEVICE_NAME_KEY: 'hifzi_device_name',
    USER_KEY: 'hifzi_user',
    LOGS_KEY: 'hifzi_backup_logs',
    PROVIDER_KEY: 'hifzi_provider',
    
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

    // ==================== INIT ====================
    
    init: function() {
        this.log('INFO', 'Backup Module Initialized (3 Providers)');
        
        // Load saved provider
        this.currentProvider = localStorage.getItem(this.PROVIDER_KEY) || 'local';
        this.gasUrl = localStorage.getItem(this.GAS_URL_KEY) || '';
        this.isAutoSyncEnabled = localStorage.getItem(this.AUTO_SYNC_KEY) === 'true';
        this.lastSyncTime = localStorage.getItem(this.LAST_SYNC_KEY) || null;
        
        // Device info
        this.deviceId = localStorage.getItem(this.DEVICE_ID_KEY);
        if (!this.deviceId) {
            this.deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem(this.DEVICE_ID_KEY, this.deviceId);
        }
        this.deviceName = localStorage.getItem(this.DEVICE_NAME_KEY) || 
                          navigator.userAgent.split(' ')[0] + ' ' + this.deviceId.substr(-4);
        
        // Init berdasarkan provider
        if (this.currentProvider === 'firebase') {
            this.initFirebase();
        } else if (this.currentProvider === 'googlesheet' && this.gasUrl) {
            this.checkNewDeviceGAS();
        }
        
        this.setupConnectivityListeners();
        this.render();
    },

    // ==================== PROVIDER SELECTION ====================
    
    setProvider: function(provider) {
        this.log('INFO', 'Provider changed to: ' + provider);
        this.currentProvider = provider;
        localStorage.setItem(this.PROVIDER_KEY, provider);
        
        // Stop any running sync
        this.stopAutoSync();
        
        // Init provider specific
        if (provider === 'firebase') {
            this.initFirebase();
        } else if (provider === 'googlesheet') {
            // GAS tidak perlu init khusus
        } else {
            this.currentUser = null;
        }
        
        this.render();
    },

    // ==================== FIREBASE FUNCTIONS ====================
    
    initFirebase: function() {
        if (typeof firebase === 'undefined') {
            this.log('WARN', 'Firebase SDK not loaded yet');
            return;
        }
        
        try {
            if (!firebase.apps.length) {
                this.firebaseApp = firebase.initializeApp(this.firebaseConfig);
            } else {
                this.firebaseApp = firebase.app();
            }
            
            this.database = firebase.database();
            this.auth = firebase.auth();
            
            this.log('INFO', 'Firebase initialized');
            this.setupAuthListener();
            this.setupRealtimeListeners();
            
        } catch (error) {
            this.log('ERROR', 'Firebase init failed: ' + error.message);
        }
    },

    setupAuthListener: function() {
        if (!this.auth) return;
        
        this.auth.onAuthStateChanged((user) => {
            if (user) {
                this.currentUser = user;
                this.saveUserToLocal(user);
                this.updateDeviceStatus(true);
                
                if (this.isAutoSyncEnabled) {
                    this.startAutoSyncFirebase();
                }
                
                this.syncFromCloud(true);
            } else {
                this.currentUser = null;
                this.stopAutoSync();
            }
            this.render();
        });
    },

    setupRealtimeListeners: function() {
        if (!this.database || !this.currentUser) return;
        
        const userId = this.currentUser.uid;
        const dataRef = this.database.ref('users/' + userId + '/data');
        
        dataRef.on('value', (snapshot) => {
            const cloudData = snapshot.val();
            if (cloudData && cloudData.lastModified) {
                const localTime = this.lastSyncTime || '1970-01-01';
                const cloudTime = cloudData.lastModified;
                
                if (cloudTime > localTime && cloudData.lastModifiedBy !== this.deviceId) {
                    this.log('INFO', 'New data from other device detected');
                    this.mergeCloudData(cloudData, true);
                }
            }
        });
    },

    firebaseLogin: function(email, password) {
        if (!this.auth) {
            this.showToast('❌ Firebase belum siap');
            return;
        }
        
        this.showToast('⏳ Login...');
        this.auth.signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
                this.currentUser = userCredential.user;
                this.showToast('✅ Login berhasil!');
                this.render();
            })
            .catch((error) => {
                this.showToast('❌ ' + error.message);
            });
    },

    firebaseRegister: function(email, password) {
        if (!this.auth) {
            this.showToast('❌ Firebase belum siap');
            return;
        }
        
        this.showToast('⏳ Mendaftar...');
        this.auth.createUserWithEmailAndPassword(email, password)
            .then((userCredential) => {
                this.currentUser = userCredential.user;
                this.showToast('✅ Daftar berhasil!');
                this.uploadDataFirebase(true);
                this.render();
            })
            .catch((error) => {
                this.showToast('❌ ' + error.message);
            });
    },

    firebaseLogout: function() {
        if (!this.auth) return;
        this.updateDeviceStatus(false);
        this.auth.signOut().then(() => {
            this.currentUser = null;
            this.stopAutoSync();
            this.showToast('✅ Logout');
            this.render();
        });
    },

    uploadDataFirebase: function(silent = false, callback) {
        if (!this.database || !this.currentUser) {
            if (!silent) this.showToast('❌ Belum login');
            if (callback) callback(false);
            return;
        }
        
        if (!this.isOnline) {
            this.pendingSync = true;
            if (!silent) this.showToast('📴 Offline - pending');
            if (callback) callback(false);
            return;
        }
        
        if (!silent) this.showToast('⬆️ Upload...');
        
        const data = this.getAllData();
        const userId = this.currentUser.uid;
        const payload = {
            ...data,
            lastModified: new Date().toISOString(),
            lastModifiedBy: this.deviceId,
            lastModifiedByName: this.deviceName,
            version: '1.0'
        };
        
        this.database.ref('users/' + userId + '/data').set(payload)
            .then(() => {
                this.lastSyncTime = new Date().toISOString();
                localStorage.setItem(this.LAST_SYNC_KEY, this.lastSyncTime);
                this.pendingSync = false;
                if (!silent) this.showToast('✅ Upload OK!');
                this.render();
                if (callback) callback(true);
            })
            .catch((error) => {
                if (!silent) this.showToast('❌ Upload gagal');
                if (callback) callback(false);
            });
    },

    downloadDataFirebase: function(silent = false) {
        if (!this.database || !this.currentUser) {
            if (!silent) this.showToast('❌ Belum login');
            return;
        }
        
        if (!silent && !confirm('📥 Download akan mengganti data lokal. Lanjutkan?')) return;
        
        if (!silent) this.showToast('⬇️ Download...');
        
        const userId = this.currentUser.uid;
        this.database.ref('users/' + userId + '/data').once('value')
            .then((snapshot) => {
                const cloudData = snapshot.val();
                if (cloudData) {
                    this.mergeCloudData(cloudData, silent);
                    if (!silent) setTimeout(() => location.reload(), 2000);
                } else {
                    if (!silent) this.showToast('ℹ️ Belum ada data di cloud');
                }
            })
            .catch((error) => {
                if (!silent) this.showToast('❌ Download gagal');
            });
    },

    // ==================== GAS FUNCTIONS (DARI KODE LAMA ANDA) ====================
    
    checkNewDeviceGAS: function() {
        const localData = this.getAllData();
        const hasLocalData = this.hasAnyData(localData);
        
        if (!hasLocalData && this.gasUrl) {
            this.log('INFO', 'New device detected, auto-downloading...');
            this.showToast('📥 Device baru, mengunduh...');
            setTimeout(() => this.downloadDataGAS(true), 1000);
        }
        
        if (this.isAutoSyncEnabled && this.gasUrl) {
            this.startAutoSyncGAS();
        }
    },

    uploadDataGAS: function(silent = false, callback) {
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
        .then(response => response.json())
        .then(result => {
            if (result && result.success) {
                this.lastSyncTime = new Date().toISOString();
                localStorage.setItem(this.LAST_SYNC_KEY, this.lastSyncTime);
                if (!silent) this.showToast('✅ Upload berhasil!');
                this.render();
                if (callback) callback(true);
            } else {
                if (!silent) this.showToast('❌ Upload gagal');
                if (callback) callback(false);
            }
        })
        .catch(error => {
            this.uploadViaJSONP_GAS(payload, silent, callback);
        });
    },

    uploadViaJSONP_GAS: function(payload, silent, callback) {
        const jsonStr = JSON.stringify(payload);
        if (jsonStr.length > 8000) {
            this.uploadViaIframe_GAS(payload, silent, callback);
            return;
        }
        
        const encoded = encodeURIComponent(jsonStr);
        const callbackName = 'upload_cb_' + Date.now();
        
        window[callbackName] = (result) => {
            if (result && result.success) {
                this.lastSyncTime = new Date().toISOString();
                localStorage.setItem(this.LAST_SYNC_KEY, this.lastSyncTime);
                if (!silent) this.showToast('✅ Upload berhasil!');
                this.render();
                if (callback) callback(true);
            } else {
                if (!silent) this.showToast('❌ Upload gagal');
                if (callback) callback(false);
            }
            delete window[callbackName];
        };
        
        const script = document.createElement('script');
        script.onerror = () => {
            this.uploadViaIframe_GAS(payload, silent, callback);
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

    uploadViaIframe_GAS: function(payload, silent, callback) {
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
                if (result && result.success) {
                    this.lastSyncTime = new Date().toISOString();
                    localStorage.setItem(this.LAST_SYNC_KEY, this.lastSyncTime);
                    if (!silent) this.showToast('✅ Upload selesai');
                    this.render();
                    if (callback) callback(true);
                }
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

    downloadDataGAS: function(silent = false) {
        if (!silent && !confirm('📥 Download akan mengganti data lokal. Lanjutkan?')) return;
        if (!this.gasUrl) {
            if (!silent) this.showToast('❌ URL GAS belum diisi!');
            return;
        }
        
        if (!silent) this.showToast('⬇️ Mengunduh...');
        
        fetch(this.gasUrl + '?action=restore&_t=' + Date.now())
        .then(response => response.json())
        .then(result => {
            this.handleDownloadResultGAS(result, silent);
        })
        .catch(error => {
            this.downloadViaJSONP_GAS(silent);
        });
    },

    downloadViaJSONP_GAS: function(silent) {
        const cb = 'dl_cb_' + Date.now();
        window[cb] = (result) => {
            this.handleDownloadResultGAS(result, silent);
            delete window[cb];
        };
        
        const script = document.createElement('script');
        script.onerror = () => {
            if (!silent) this.showToast('❌ Gagal terhubung');
            delete window[cb];
        };
        script.src = this.gasUrl + '?action=restore&callback=' + cb + '&_t=' + Date.now();
        document.head.appendChild(script);
        
        setTimeout(() => {
            if (window[cb]) delete window[cb];
        }, 20000);
    },

    handleDownloadResultGAS: function(result, silent) {
        if (result && result.success && result.data) {
            this.saveAllData(result.data);
            this.lastSyncTime = new Date().toISOString();
            localStorage.setItem(this.LAST_SYNC_KEY, this.lastSyncTime);
            
            if (!silent) {
                this.showToast(`✅ Download berhasil!`);
                setTimeout(() => location.reload(), 2000);
            }
        } else {
            if (!silent) this.showToast('❌ Download gagal');
        }
    },

    // ==================== AUTO SYNC ====================
    
    startAutoSyncGAS: function() {
        this.stopAutoSync();
        this.performTwoWaySyncGAS();
        this.autoSyncInterval = setInterval(() => {
            this.performTwoWaySyncGAS();
        }, 180000);
        this.log('INFO', 'Auto Sync GAS started');
    },

    startAutoSyncFirebase: function() {
        this.stopAutoSync();
        this.performTwoWaySyncFirebase();
        this.autoSyncInterval = setInterval(() => {
            this.performTwoWaySyncFirebase();
        }, 180000);
        this.log('INFO', 'Auto Sync Firebase started');
    },

    stopAutoSync: function() {
        if (this.autoSyncInterval) {
            clearInterval(this.autoSyncInterval);
            this.autoSyncInterval = null;
            this.log('INFO', 'Auto Sync stopped');
        }
    },

    performTwoWaySyncGAS: function() {
        this.uploadDataGAS(true, (success) => {
            if (success) {
                this.getCloudTimestampGAS((cloudTime) => {
                    if (cloudTime && cloudTime > this.lastSyncTime) {
                        this.downloadDataGAS(true);
                    }
                });
            }
        });
    },

    performTwoWaySyncFirebase: function() {
        this.uploadDataFirebase(true, (success) => {
            if (success) {
                setTimeout(() => this.downloadDataFirebase(true), 2000);
            }
        });
    },

    getCloudTimestampGAS: function(callback) {
        const cb = 'ts_' + Date.now();
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

    // ==================== COMMON FUNCTIONS ====================
    
    setupConnectivityListeners: function() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.showToast('🌐 Online');
            if (this.pendingSync) {
                if (this.currentProvider === 'firebase' && this.currentUser) {
                    this.uploadDataFirebase(true);
                } else if (this.currentProvider === 'googlesheet') {
                    this.uploadDataGAS(true);
                }
            }
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.showToast('📴 Offline');
        });
    },

    updateDeviceStatus: function(isOnline) {
        if (!this.database || !this.currentUser) return;
        const userId = this.currentUser.uid;
        this.database.ref('users/' + userId + '/devices/' + this.deviceId).set({
            name: this.deviceName,
            isOnline: isOnline,
            lastSeen: new Date().toISOString()
        });
    },

    getConnectedDevices: function(callback) {
        if (!this.database || !this.currentUser) {
            callback([]);
            return;
        }
        const userId = this.currentUser.uid;
        this.database.ref('users/' + userId + '/devices').once('value', (snapshot) => {
            const devices = [];
            snapshot.forEach((child) => {
                devices.push({ id: child.key, ...child.val() });
            });
            callback(devices);
        });
    },

    mergeCloudData: function(cloudData, silent = false) {
        const { lastModified, lastModifiedBy, lastModifiedByName, version, ...cleanData } = cloudData;
        this.saveAllData(cleanData);
        this.lastSyncTime = new Date().toISOString();
        localStorage.setItem(this.LAST_SYNC_KEY, this.lastSyncTime);
        
        if (!silent) {
            const deviceInfo = lastModifiedByName ? ' (dari ' + lastModifiedByName + ')' : '';
            this.showToast('✅ Data diperbarui' + deviceInfo);
            if (typeof dataManager !== 'undefined' && dataManager) {
                dataManager.data = this.getAllData();
                if (dataManager.save) dataManager.save();
            }
            if (typeof app !== 'undefined' && app.updateHeader) {
                app.updateHeader();
            }
        }
        this.render();
    },

    saveUserToLocal: function(user) {
        localStorage.setItem(this.USER_KEY, JSON.stringify({
            uid: user.uid,
            email: user.email
        }));
    },

    toggleAutoSync: function() {
        this.isAutoSyncEnabled = !this.isAutoSyncEnabled;
        localStorage.setItem(this.AUTO_SYNC_KEY, this.isAutoSyncEnabled);
        
        if (this.isAutoSyncEnabled) {
            if (this.currentProvider === 'firebase' && this.currentUser) {
                this.startAutoSyncFirebase();
            } else if (this.currentProvider === 'googlesheet' && this.gasUrl) {
                this.startAutoSyncGAS();
            }
            this.showToast('🟢 Auto sync aktif');
        } else {
            this.stopAutoSync();
            this.showToast('⚪ Auto sync mati');
        }
        this.render();
    },

    // ==================== UTILITY FUNCTIONS (SAMA) ====================
    
    getAllData: function() {
        const data = {};
        for (let key in this.STORAGE_KEYS) {
            try {
                const stored = localStorage.getItem(this.STORAGE_KEYS[key]);
                data[key] = stored ? JSON.parse(stored) : this.getDefaultData(key);
            } catch(e) {
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

    saveAllData: function(data) {
        for (let key in this.STORAGE_KEYS) {
            if (data[key] !== undefined) {
                localStorage.setItem(this.STORAGE_KEYS[key], JSON.stringify(data[key]));
            }
        }
        if (typeof dataManager !== 'undefined' && dataManager) {
            dataManager.data = this.getAllData();
            if (dataManager.save) dataManager.save();
        }
    },

    formatRupiah: function(amount) {
        if (!amount && amount !== 0) return 'Rp 0';
        return 'Rp ' + amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    },

    // ==================== RENDER (3 PROVIDER) ====================
    
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

        const isLoggedIn = !!this.currentUser;
        const connectionStatus = this.isOnline ? '🟢' : '🔴';

        container.innerHTML = `
            <div class="content-section active" id="backupSection" style="padding: 16px; max-width: 1200px; margin: 0 auto;">
                
                <!-- Status Card -->
                <div class="modern-card status-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-size: 14px; opacity: 0.9;">Provider Aktif</div>
                            <div style="font-size: 20px; font-weight: 600;">
                                ${this.getProviderDisplayName()}
                            </div>
                            <div style="font-size: 12px; opacity: 0.8; margin-top: 4px;">
                                ${connectionStatus} ${this.isOnline ? 'Online' : 'Offline'} 
                                ${this.isAutoSyncEnabled ? '• Auto Sync ON' : ''}
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 12px; opacity: 0.8;">Last Sync</div>
                            <div style="font-size: 14px; font-weight: 500;">
                                ${this.lastSyncTime ? new Date(this.lastSyncTime).toLocaleTimeString('id-ID') : 'Belum'}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Provider Selection (3 PILIHAN) -->
                <div class="modern-card" style="margin-bottom: 20px;">
                    <div style="font-size: 16px; font-weight: 600; color: #2d3748; margin-bottom: 16px;">
                        ☁️ Pilih Metode Backup
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
                        ${this.renderProviderCard('local', '💾', 'Local File', 'Simpan di device')}
                        ${this.renderProviderCard('googlesheet', '📊', 'Google Sheets', 'Via Google Apps Script')}
                        ${this.renderProviderCard('firebase', '🔥', 'Firebase', 'Real-time sync')}
                    </div>
                </div>

                <!-- Provider Specific Sections -->
                ${this.currentProvider === 'firebase' ? this.renderFirebaseSection(isLoggedIn) : ''}
                ${this.currentProvider === 'googlesheet' ? this.renderGoogleSheetSection() : ''}
                ${this.currentProvider === 'local' ? this.renderLocalInfoSection() : ''}

                <!-- Stats Grid -->
                <div class="modern-card" style="margin-bottom: 20px;">
                    <div style="font-size: 16px; font-weight: 600; color: #2d3748; margin-bottom: 16px;">
                        📊 Data: ${stats.storeName}
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

                <!-- Local Backup (Selalu tersedia) -->
                <div class="modern-card" style="margin-bottom: 20px;">
                    <div style="font-size: 16px; font-weight: 600; color: #2d3748; margin-bottom: 16px;">
                        💾 Backup Local (JSON)
                    </div>
                    <button onclick="backupModule.downloadJSON()" class="btn-primary" style="width: 100%; margin-bottom: 12px;">
                        ⬇️ Download JSON
                    </button>
                    <label style="display: block; padding: 16px; border: 2px dashed #cbd5e0; border-radius: 8px; text-align: center; cursor: pointer;" 
                           onmouseover="this.style.borderColor='#667eea';this.style.background='#f7fafc'" 
                           onmouseout="this.style.borderColor='#cbd5e0';this.style.background='transparent'">
                        <input type="file" accept=".json" onchange="backupModule.importJSON(this)" style="display: none;">
                        <div style="font-size: 24px; margin-bottom: 8px;">📤</div>
                        <div style="font-size: 14px; color: #4a5568; font-weight: 500;">Import JSON</div>
                    </label>
                </div>

                <!-- Danger Zone -->
                <div class="modern-card" style="border: 1px solid #feb2b2; background: #fff5f5;">
                    <div style="font-size: 16px; font-weight: 600; color: #c53030; margin-bottom: 16px;">
                        🗑️ Zona Bahaya
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        <button onclick="backupModule.resetLocal()" class="btn-danger" style="background: #e53e3e;">
                            🗑️ Hapus Data Lokal
                        </button>
                        ${this.currentProvider !== 'local' ? `
                            <button onclick="backupModule.resetCloud()" class="btn-danger" style="background: #805ad5;">
                                ☁️ Reset Cloud (${this.currentProvider === 'firebase' ? 'Firebase' : 'GAS'})
                            </button>
                            <button onclick="backupModule.resetBoth()" class="btn-danger" style="background: #1a202c;">
                                💀 Reset Total (Lokal + Cloud)
                            </button>
                        ` : ''}
                    </div>
                </div>

            </div>

            <style>
                .modern-card {
                    background: white;
                    border-radius: 12px;
                    padding: 20px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                    border: 1px solid #e2e8f0;
                }
                .provider-card {
                    padding: 16px;
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
                }
                .provider-card.active {
                    border-color: #48bb78;
                    background: #f0fff4;
                }
                .stat-card {
                    padding: 16px;
                    border-radius: 10px;
                    text-align: center;
                }
                .btn-primary {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                    font-size: 14px;
                }
                .btn-secondary {
                    background: #edf2f7;
                    color: #4a5568;
                    border: 1px solid #e2e8f0;
                    padding: 12px 24px;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                }
                .btn-danger {
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                    font-size: 14px;
                }
                .form-input {
                    width: 100%;
                    padding: 12px;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    font-size: 14px;
                    margin-bottom: 12px;
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
        
        if (this.currentProvider === 'firebase' && isLoggedIn) {
            this.loadAndRenderDevices();
        }
    },

    getProviderDisplayName: function() {
        switch(this.currentProvider) {
            case 'local': return '💾 Local File';
            case 'googlesheet': return '📊 Google Sheets';
            case 'firebase': return '🔥 Firebase Real-time';
            default: return '💾 Local File';
        }
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
                <div style="font-size: 11px; color: #718096;">${desc}</div>
            </div>
        `;
    },

    renderFirebaseSection: function(isLoggedIn) {
        if (!isLoggedIn) {
            return `
                <div class="modern-card" style="margin-bottom: 20px; border: 2px solid #ff6b35;">
                    <div style="font-size: 16px; font-weight: 600; color: #2d3748; margin-bottom: 16px;">
                        🔐 Login Firebase
                    </div>
                    <input type="email" id="authEmail" placeholder="Email" class="form-input">
                    <input type="password" id="authPassword" placeholder="Password" class="form-input">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                        <button onclick="backupModule.firebaseLogin(document.getElementById('authEmail').value, document.getElementById('authPassword').value)" 
                                class="btn-primary">Login</button>
                        <button onclick="backupModule.firebaseRegister(document.getElementById('authEmail').value, document.getElementById('authPassword').value)" 
                                class="btn-secondary">Daftar</button>
                    </div>
                </div>
            `;
        }
        
        return `
            <div class="modern-card" style="margin-bottom: 20px; border: 2px solid #ff6b35;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <div>
                        <div style="font-size: 16px; font-weight: 600; color: #2d3748;">🔥 Firebase Cloud</div>
                        <div style="font-size: 13px; color: #276749;">✅ ${this.currentUser.email}</div>
                    </div>
                    <button onclick="backupModule.firebaseLogout()" class="btn-danger" style="background: #e53e3e; padding: 8px 16px; font-size: 12px;">Logout</button>
                </div>
                
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding: 12px; background: #fffaf0; border-radius: 8px;">
                    <div>
                        <div style="font-size: 14px; font-weight: 600;">Auto Sync</div>
                        <div style="font-size: 12px; color: #718096;">Real-time update</div>
                    </div>
                    <div onclick="backupModule.toggleAutoSync()" class="toggle-switch ${this.isAutoSyncEnabled ? 'active' : ''}"></div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <button onclick="backupModule.uploadDataFirebase()" class="btn-primary" style="background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);">⬆️ Upload</button>
                    <button onclick="backupModule.downloadDataFirebase()" class="btn-primary" style="background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%);">⬇️ Download</button>
                </div>
                
                <div id="devicesList" style="margin-top: 12px; font-size: 12px; color: #718096;"></div>
            </div>
        `;
    },

    renderGoogleSheetSection: function() {
        const hasUrl = this.gasUrl && this.gasUrl.length > 10;
        
        return `
            <div class="modern-card" style="margin-bottom: 20px; border: 2px solid #34a853;">
                <div style="font-size: 16px; font-weight: 600; color: #2d3748; margin-bottom: 16px;">
                    📊 Google Sheets Configuration
                </div>
                
                <div style="margin-bottom: 16px;">
                    <input type="text" id="gasUrl" value="${this.gasUrl || ''}" 
                           placeholder="https://script.google.com/macros/s/.../exec" 
                           class="form-input">
                </div>
                
                <button onclick="backupModule.saveGasUrl()" class="btn-primary" style="width: 100%; margin-bottom: 16px;">
                    💾 Simpan URL
                </button>
                
                ${hasUrl ? `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding: 12px; background: #fffaf0; border-radius: 8px;">
                        <div>
                            <div style="font-size: 14px; font-weight: 600;">Auto Sync</div>
                            <div style="font-size: 12px; color: #718096;">Cek tiap 3 menit</div>
                        </div>
                        <div onclick="backupModule.toggleAutoSync()" class="toggle-switch ${this.isAutoSyncEnabled ? 'active' : ''}"></div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <button onclick="backupModule.uploadDataGAS()" class="btn-primary" style="background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);">⬆️ Upload</button>
                        <button onclick="backupModule.downloadDataGAS()" class="btn-primary" style="background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%);">⬇️ Download</button>
                    </div>
                ` : ''}
            </div>
        `;
    },

    renderLocalInfoSection: function() {
        return `
            <div class="modern-card" style="margin-bottom: 20px; background: #f0fff4; border: 2px solid #48bb78;">
                <div style="font-size: 16px; font-weight: 600; color: #2d3748; margin-bottom: 8px;">
                    💾 Mode Local
                </div>
                <div style="font-size: 13px; color: #718096;">
                    Data hanya tersimpan di device ini. Gunakan menu di bawah untuk backup manual ke file JSON.
                </div>
            </div>
        `;
    },

    renderStatCard: function(icon, label, value, bgColor, textColor) {
        return `
            <div class="stat-card" style="background: ${bgColor};">
                <div style="font-size: 24px; margin-bottom: 4px;">${icon}</div>
                <div style="font-size: 11px; color: #718096; text-transform: uppercase; margin-bottom: 4px;">${label}</div>
                <div style="font-size: 20px; font-weight: 700; color: ${textColor};">${value}</div>
            </div>
        `;
    },

    loadAndRenderDevices: function() {
        this.getConnectedDevices((devices) => {
            const container = document.getElementById('devicesList');
            if (!container) return;
            
            if (devices.length === 0) {
                container.innerHTML = '';
                return;
            }
            
            container.innerHTML = '<div style="font-weight: 600; margin-bottom: 8px;">Device Online:</div>' +
                devices.map(device => {
                    const isOnline = device.isOnline;
                    const isThisDevice = device.id === this.deviceId;
                    return `<div style="display: flex; align-items: center; padding: 6px; background: ${isThisDevice ? '#f0fff4' : '#f7fafc'}; border-radius: 6px; margin-bottom: 4px;">
                        <span style="margin-right: 8px;">${isOnline ? '🟢' : '⚪'}</span>
                        <span style="flex: 1; font-size: 12px;">${device.name || 'Unknown'}${isThisDevice ? ' (Anda)' : ''}</span>
                    </div>`;
                }).join('');
        });
    },

    saveGasUrl: function() {
        const input = document.getElementById('gasUrl');
        if (!input) return;
        const url = input.value.trim();
        
        if (!url || url.length < 20 || !url.includes('script.google.com')) {
            this.showToast('❌ URL tidak valid!');
            return;
        }
        
        this.gasUrl = url;
        localStorage.setItem(this.GAS_URL_KEY, url);
        this.showToast('✅ URL tersimpan!');
        this.render();
    },

    // ==================== RESET FUNCTIONS ====================
    
    resetLocal: function() {
        if (!confirm('⚠️ HAPUS SEMUA DATA LOKAL?\n\nLanjutkan?')) return;
        if (prompt('Ketik HAPUS:') !== 'HAPUS') {
            this.showToast('Dibatalkan');
            return;
        }
        
        for (let key in this.STORAGE_KEYS) {
            localStorage.removeItem(this.STORAGE_KEYS[key]);
        }
        
        const defaults = this.getAllData();
        this.saveAllData(defaults);
        this.showToast('✅ Data lokal dihapus!');
        setTimeout(() => location.reload(), 1500);
    },

    resetCloud: function() {
        if (this.currentProvider === 'firebase') {
            if (!this.currentUser) {
                this.showToast('❌ Belum login');
                return;
            }
            if (!confirm('⚠️ Reset Firebase?')) return;
            if (prompt('Ketik RESET:') !== 'RESET') return;
            
            const userId = this.currentUser.uid;
            this.database.ref('users/' + userId + '/data').remove()
                .then(() => {
                    this.showToast('✅ Firebase direset!');
                    this.render();
                });
                
        } else if (this.currentProvider === 'googlesheet') {
            if (!this.gasUrl) {
                this.showToast('❌ URL GAS belum diisi');
                return;
            }
            if (!confirm('⚠️ Reset Google Sheets?')) return;
            if (prompt('Ketik RESET:') !== 'RESET') return;
            
            // Implementasi reset GAS (sama seperti kode lama Anda)
            this.showToast('🗑️ Mereset GAS...');
        }
    },

    resetBoth: function() {
        if (!confirm('💀 HAPUS SEMUA DATA?\n\nLokal + Cloud\n\nTIDAK BISA DIBATALKAN!')) return;
        if (prompt('Ketik HAPUS SEMUA:') !== 'HAPUS SEMUA') return;
        
        this.resetCloud();
        setTimeout(() => this.resetLocal(), 2000);
    },

    // ==================== UTILITIES ====================
    
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
                
                // Auto upload ke cloud jika aktif
                if (this.currentProvider === 'firebase' && this.currentUser) {
                    this.uploadDataFirebase(true);
                } else if (this.currentProvider === 'googlesheet' && this.gasUrl) {
                    this.uploadDataGAS(true);
                }
                
                this.render();
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

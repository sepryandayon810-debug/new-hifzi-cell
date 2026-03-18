// ============================================
// BACKUP MODULE ONLY - HIFZI CELL
// Firebase + Google Sheets + Local
// ============================================

const backupModule = {
    // Provider: 'local' | 'firebase' | 'googlesheet'
    currentProvider: localStorage.getItem('hifzi_provider') || 'local',
    isAutoSyncEnabled: localStorage.getItem('hifzi_auto_sync') === 'true',
    autoSyncInterval: null,
    lastSyncTime: localStorage.getItem('hifzi_last_sync') || null,
    isOnline: navigator.onLine,
    
    // Firebase
    firebaseConfig: JSON.parse(localStorage.getItem('hifzi_firebase_config') || '{}'),
    firebaseApp: null,
    database: null,
    auth: null,
    currentUser: null,
    
    // Google Sheets
    gasUrl: localStorage.getItem('hifzi_gas_url') || '',
    
    // Device ID
    deviceId: localStorage.getItem('hifzi_device_id') || 'device_' + Date.now(),
    
    // Keys
    KEYS: {
        PROVIDER: 'hifzi_provider',
        GAS_URL: 'hifzi_gas_url',
        AUTO_SYNC: 'hifzi_auto_sync',
        LAST_SYNC: 'hifzi_last_sync',
        FIREBASE_CONFIG: 'hifzi_firebase_config',
        DEVICE_ID: 'hifzi_device_id',
        FB_USER: 'hifzi_fb_user'
    },

    // ============================================
    // INIT
    // ============================================
    init() {
        console.log('[Backup] Init... Provider:', this.currentProvider);
        
        // Save device ID if new
        if (!localStorage.getItem(this.KEYS.DEVICE_ID)) {
            localStorage.setItem(this.KEYS.DEVICE_ID, this.deviceId);
        }
        
        // Init berdasarkan provider
        if (this.currentProvider === 'firebase') {
            this.initFirebase();
        } else if (this.currentProvider === 'googlesheet' && this.gasUrl) {
            this.checkNewDeviceGAS();
        }
        
        // Listeners
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.showToast('🌐 Online');
            if (this.isAutoSyncEnabled) this.syncNow();
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.showToast('📴 Offline');
        });
    },

    // ============================================
    // SYNC TRIGGER (Dipanggil dataManager.save())
    // ============================================
    shouldSync() {
        return this.currentProvider !== 'local' && this.isAutoSyncEnabled && this.isOnline;
    },

    syncToCloud(data) {
        if (!this.shouldSync()) return;
        
        console.log('[Backup] Auto-sync to', this.currentProvider);
        
        if (this.currentProvider === 'firebase' && this.currentUser) {
            this.uploadToFirebase(data, true);
        } else if (this.currentProvider === 'googlesheet' && this.gasUrl) {
            this.uploadToGAS(data, true);
        }
    },

    syncNow() {
        const data = this.getDataForSync();
        this.syncToCloud(data);
    },

    getDataForSync() {
        // Ambil data dari dataManager yang sudah ada
        return {
            products: dataManager.data.products || [],
            categories: dataManager.data.categories || [],
            transactions: dataManager.data.transactions || [],
            cashTransactions: dataManager.data.cashTransactions || [],
            debts: dataManager.data.debts || [],
            settings: dataManager.data.settings || {},
            kasir: dataManager.data.kasir || {},
            shiftHistory: dataManager.data.shiftHistory || [],
            lastModified: new Date().toISOString(),
            deviceId: this.deviceId
        };
    },

    // ============================================
    // FIREBASE
    // ============================================
    initFirebase() {
        if (typeof firebase === 'undefined') {
            console.error('[Firebase] SDK not loaded');
            return;
        }
        
        if (!this.firebaseConfig.apiKey) {
            console.log('[Firebase] No config');
            return;
        }
        
        try {
            // Cleanup existing
            if (firebase.apps?.length) {
                firebase.apps.forEach(app => app.delete());
            }
            
            this.firebaseApp = firebase.initializeApp(this.firebaseConfig);
            this.database = firebase.database();
            this.auth = firebase.auth();
            
            console.log('[Firebase] Initialized');
            
            // Auth state listener
            this.auth.onAuthStateChanged((user) => {
                if (user) {
                    this.currentUser = user;
                    localStorage.setItem(this.KEYS.FB_USER, JSON.stringify({
                        uid: user.uid,
                        email: user.email
                    }));
                    
                    if (this.isAutoSyncEnabled) {
                        this.startAutoSyncFirebase();
                    }
                    
                    // Download jika device baru (tidak ada data lokal)
                    this.checkNewDeviceFirebase();
                } else {
                    this.currentUser = null;
                }
                
                if (this.isBackupPage()) this.render();
            });
            
        } catch (err) {
            console.error('[Firebase] Init error:', err);
        }
    },

    checkNewDeviceFirebase() {
        const hasLocalData = dataManager.data.products?.length > 0 || 
                            dataManager.data.transactions?.length > 0;
        
        if (!hasLocalData && this.currentUser) {
            console.log('[Firebase] New device, downloading...');
            this.downloadFromFirebase(true);
        }
    },

    firebaseLogin(email, password) {
        if (!this.auth) {
            this.showToast('❌ Firebase belum siap');
            return;
        }
        
        this.auth.signInWithEmailAndPassword(email, password)
            .then((cred) => {
                this.currentUser = cred.user;
                this.showToast('✅ Login Firebase berhasil!');
                if (this.isBackupPage()) this.render();
            })
            .catch((err) => {
                this.showToast('❌ ' + err.message);
            });
    },

    firebaseRegister(email, password) {
        if (!this.auth) {
            this.showToast('❌ Firebase belum siap');
            return;
        }
        
        this.auth.createUserWithEmailAndPassword(email, password)
            .then((cred) => {
                this.currentUser = cred.user;
                this.showToast('✅ Daftar berhasil!');
                this.uploadToFirebase(this.getDataForSync());
                if (this.isBackupPage()) this.render();
            })
            .catch((err) => {
                this.showToast('❌ ' + err.message);
            });
    },

    firebaseLogout() {
        if (!this.auth) return;
        
        this.auth.signOut().then(() => {
            this.currentUser = null;
            localStorage.removeItem(this.KEYS.FB_USER);
            this.stopAutoSync();
            this.showToast('✅ Logout Firebase');
            if (this.isBackupPage()) this.render();
        });
    },

    uploadToFirebase(data, silent = false) {
        if (!this.database || !this.currentUser) {
            if (!silent) this.showToast('❌ Belum login Firebase');
            return Promise.reject('Not authenticated');
        }
        
        const payload = {
            ...data,
            _syncMeta: {
                lastModified: new Date().toISOString(),
                deviceId: this.deviceId,
                version: '1.0'
            }
        };
        
        return this.database.ref('users/' + this.currentUser.uid + '/hifzi_data').set(payload)
            .then(() => {
                this.lastSyncTime = new Date().toISOString();
                localStorage.setItem(this.KEYS.LAST_SYNC, this.lastSyncTime);
                if (!silent) this.showToast('✅ Upload Firebase OK!');
            })
            .catch((err) => {
                if (!silent) this.showToast('❌ Upload gagal: ' + err.message);
                throw err;
            });
    },

    downloadFromFirebase(silent = false) {
        if (!this.database || !this.currentUser) {
            if (!silent) this.showToast('❌ Belum login Firebase');
            return;
        }
        
        if (!silent && !confirm('📥 Download akan mengganti data lokal. Lanjutkan?')) return;
        
        return this.database.ref('users/' + this.currentUser.uid + '/hifzi_data').once('value')
            .then((snapshot) => {
                const cloudData = snapshot.val();
                if (cloudData) {
                    // Hapus metadata sync
                    const { _syncMeta, ...cleanData } = cloudData;
                    
                    // Simpan ke dataManager
                    this.saveToDataManager(cleanData);
                    
                    this.lastSyncTime = new Date().toISOString();
                    localStorage.setItem(this.KEYS.LAST_SYNC, this.lastSyncTime);
                    
                    if (!silent) {
                        this.showToast('✅ Download berhasil! Reload...');
                        setTimeout(() => location.reload(), 1500);
                    }
                }
            })
            .catch((err) => {
                if (!silent) this.showToast('❌ Download gagal: ' + err.message);
            });
    },

    startAutoSyncFirebase() {
        this.stopAutoSync();
        
        // Sync setiap 3 menit
        this.autoSyncInterval = setInterval(() => {
            this.uploadToFirebase(this.getDataForSync(), true);
        }, 180000);
        
        console.log('[Firebase] Auto-sync started');
    },

    // ============================================
    // GOOGLE SHEETS
    // ============================================
    checkNewDeviceGAS() {
        const hasLocalData = dataManager.data.products?.length > 0;
        
        if (!hasLocalData && this.gasUrl) {
            console.log('[GAS] New device, auto-download...');
            setTimeout(() => this.downloadFromGAS(true), 1000);
        }
        
        if (this.isAutoSyncEnabled && this.gasUrl) {
            this.startAutoSyncGAS();
        }
    },

    uploadToGAS(data, silent = false) {
        if (!this.gasUrl) {
            if (!silent) this.showToast('❌ URL GAS belum diisi');
            return;
        }
        
        const payload = {
            action: 'sync',
            data: data,
            deviceId: this.deviceId,
            timestamp: new Date().toISOString()
        };
        
        // Coba fetch dulu
        fetch(this.gasUrl, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        })
        .then(r => r.json())
        .then(result => {
            if (result?.success) {
                this.lastSyncTime = new Date().toISOString();
                localStorage.setItem(this.KEYS.LAST_SYNC, this.lastSyncTime);
                if (!silent) this.showToast('✅ Upload GAS berhasil!');
            } else {
                throw new Error('Failed');
            }
        })
        .catch(() => {
            // Fallback ke JSONP
            this.uploadGAS_JSONP(payload, silent);
        });
    },

    uploadGAS_JSONP(payload, silent) {
        const jsonStr = JSON.stringify(payload);
        const cbName = 'gas_cb_' + Date.now();
        
        window[cbName] = (result) => {
            if (result?.success) {
                this.lastSyncTime = new Date().toISOString();
                localStorage.setItem(this.KEYS.LAST_SYNC, this.lastSyncTime);
                if (!silent) this.showToast('✅ Upload berhasil!');
            }
            delete window[cbName];
        };
        
        const script = document.createElement('script');
        script.src = `${this.gasUrl}?callback=${cbName}&data=${encodeURIComponent(jsonStr)}`;
        document.head.appendChild(script);
        
        setTimeout(() => delete window[cbName], 10000);
    },

    downloadFromGAS(silent = false) {
        if (!this.gasUrl) {
            if (!silent) this.showToast('❌ URL GAS belum diisi');
            return;
        }
        
        if (!silent && !confirm('📥 Download akan mengganti data lokal. Lanjutkan?')) return;
        if (!silent) this.showToast('⬇️ Mengunduh...');
        
        fetch(`${this.gasUrl}?action=restore&_t=${Date.now()}`)
            .then(r => r.json())
            .then(result => this.handleGASDownload(result, silent))
            .catch(() => this.downloadGAS_JSONP(silent));
    },

    downloadGAS_JSONP(silent) {
        const cbName = 'gas_dl_' + Date.now();
        
        window[cbName] = (result) => {
            this.handleGASDownload(result, silent);
            delete window[cbName];
        };
        
        const script = document.createElement('script');
        script.src = `${this.gasUrl}?action=restore&callback=${cbName}&_t=${Date.now()}`;
        document.head.appendChild(script);
        
        setTimeout(() => delete window[cbName], 15000);
    },

    handleGASDownload(result, silent) {
        if (result?.success && result.data) {
            this.saveToDataManager(result.data);
            this.lastSyncTime = new Date().toISOString();
            localStorage.setItem(this.KEYS.LAST_SYNC, this.lastSyncTime);
            
            if (!silent) {
                this.showToast('✅ Download berhasil! Reload...');
                setTimeout(() => location.reload(), 1500);
            }
        } else {
            if (!silent) this.showToast('❌ Download gagal');
        }
    },

    startAutoSyncGAS() {
        this.stopAutoSync();
        
        this.autoSyncInterval = setInterval(() => {
            this.uploadToGAS(this.getDataForSync(), true);
        }, 180000);
        
        console.log('[GAS] Auto-sync started');
    },

    // ============================================
    // LOCAL FILE
    // ============================================
    downloadJSON() {
        const data = this.getDataForSync();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `hifzi_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showToast('✅ JSON didownload!');
    },

    importJSON(input) {
        const file = input.files[0];
        if (!file) return;
        
        if (!confirm('⚠️ Import akan menimpa data lokal. Lanjutkan?')) {
            input.value = '';
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                this.saveToDataManager(data);
                this.showToast('✅ Import berhasil! Reload...');
                setTimeout(() => location.reload(), 1500);
            } catch (err) {
                this.showToast('❌ Error: ' + err.message);
            }
        };
        reader.readAsText(file);
        input.value = '';
    },

    // ============================================
    // HELPERS
    // ============================================
    saveToDataManager(data) {
        // Simpan ke dataManager tanpa menghancurkan struktur
        if (data.products) dataManager.data.products = data.products;
        if (data.categories) dataManager.data.categories = data.categories;
        if (data.transactions) dataManager.data.transactions = data.transactions;
        if (data.cashTransactions) dataManager.data.cashTransactions = data.cashTransactions;
        if (data.debts) dataManager.data.debts = data.debts;
        if (data.settings) dataManager.data.settings = { ...dataManager.data.settings, ...data.settings };
        if (data.kasir) dataManager.data.kasir = { ...dataManager.data.kasir, ...data.kasir };
        if (data.shiftHistory) dataManager.data.shiftHistory = data.shiftHistory;
        
        dataManager.save();
    },

    setProvider(provider) {
        this.currentProvider = provider;
        localStorage.setItem(this.KEYS.PROVIDER, provider);
        this.stopAutoSync();
        
        if (provider === 'firebase') {
            this.initFirebase();
        } else if (provider === 'googlesheet') {
            this.checkNewDeviceGAS();
        }
        
        if (this.isBackupPage()) this.render();
        this.showToast(`✅ Provider: ${provider}`);
    },

    saveFirebaseConfig() {
        const config = {
            apiKey: document.getElementById('fb_apiKey')?.value?.trim(),
            authDomain: document.getElementById('fb_authDomain')?.value?.trim(),
            databaseURL: document.getElementById('fb_databaseURL')?.value?.trim(),
            projectId: document.getElementById('fb_projectId')?.value?.trim(),
            storageBucket: document.getElementById('fb_storageBucket')?.value?.trim(),
            messagingSenderId: document.getElementById('fb_messagingSenderId')?.value?.trim(),
            appId: document.getElementById('fb_appId')?.value?.trim()
        };
        
        if (!config.apiKey || !config.databaseURL) {
            this.showToast('❌ API Key dan Database URL wajib diisi');
            return;
        }
        
        this.firebaseConfig = config;
        localStorage.setItem(this.KEYS.FIREBASE_CONFIG, JSON.stringify(config));
        this.showToast('✅ Config Firebase disimpan!');
        
        this.initFirebase();
        if (this.isBackupPage()) this.render();
    },

    saveGasUrl() {
        const url = document.getElementById('gasUrlInput')?.value?.trim();
        
        if (!url || !url.includes('script.google.com')) {
            this.showToast('❌ URL GAS tidak valid');
            return;
        }
        
        this.gasUrl = url;
        localStorage.setItem(this.KEYS.GAS_URL, url);
        this.showToast('✅ URL GAS disimpan!');
        
        if (this.currentProvider === 'googlesheet') {
            this.checkNewDeviceGAS();
        }
        
        if (this.isBackupPage()) this.render();
    },

    toggleAutoSync() {
        this.isAutoSyncEnabled = !this.isAutoSyncEnabled;
        localStorage.setItem(this.KEYS.AUTO_SYNC, this.isAutoSyncEnabled);
        
        if (this.isAutoSyncEnabled) {
            if (this.currentProvider === 'firebase' && this.currentUser) {
                this.startAutoSyncFirebase();
            } else if (this.currentProvider === 'googlesheet') {
                this.startAutoSyncGAS();
            }
            this.showToast('🟢 Auto-sync aktif');
        } else {
            this.stopAutoSync();
            this.showToast('⚪ Auto-sync mati');
        }
        
        if (this.isBackupPage()) this.render();
    },

    stopAutoSync() {
        if (this.autoSyncInterval) {
            clearInterval(this.autoSyncInterval);
            this.autoSyncInterval = null;
        }
    },

    resetLocal() {
        if (!confirm('⚠️ Hapus SEMUA data lokal?')) return;
        if (prompt('Ketik HAPUS untuk konfirmasi:') !== 'HAPUS') return;
        
        localStorage.removeItem('hifzi_data');
        this.showToast('✅ Data lokal dihapus! Reload...');
        setTimeout(() => location.reload(), 1500);
    },

    resetCloud() {
        if (this.currentProvider === 'firebase') {
            if (!this.currentUser) {
                this.showToast('❌ Belum login Firebase');
                return;
            }
            if (!confirm('⚠️ Reset data di Firebase?')) return;
            
            this.database.ref('users/' + this.currentUser.uid + '/hifzi_data').remove()
                .then(() => this.showToast('✅ Firebase direset!'));
                
        } else if (this.currentProvider === 'googlesheet') {
            if (!this.gasUrl) {
                this.showToast('❌ URL GAS belum diisi');
                return;
            }
            if (!confirm('⚠️ Reset data di Google Sheets?')) return;
            
            fetch(this.gasUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ action: 'reset' })
            }).then(() => this.showToast('✅ GAS direset!'));
        }
    },

    // ============================================
    // UI RENDER (untuk halaman backup)
    // ============================================
    isBackupPage() {
        return document.getElementById('backupContainer') !== null;
    },

    render() {
        const container = document.getElementById('mainContent') || document.getElementById('backupContainer');
        if (!container) return;
        
        const isFirebase = this.currentProvider === 'firebase';
        const isGAS = this.currentProvider === 'googlesheet';
        const isLocal = this.currentProvider === 'local';
        const isFBConfigured = this.firebaseConfig.apiKey;
        const isFBLoggedIn = !!this.currentUser;

        container.innerHTML = `
            <div style="padding: 16px; max-width: 800px; margin: 0 auto;">
                
                <!-- Status Card -->
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-size: 12px; opacity: 0.9;">Provider Aktif</div>
                            <div style="font-size: 24px; font-weight: bold;">
                                ${isLocal ? '💾 Local' : isFirebase ? '🔥 Firebase' : '📊 Google Sheets'}
                            </div>
                            <div style="font-size: 12px; margin-top: 4px;">
                                ${this.isOnline ? '🟢 Online' : '🔴 Offline'} 
                                ${this.isAutoSyncEnabled ? '• Auto-sync ON' : ''}
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 11px; opacity: 0.8;">Last Sync</div>
                            <div style="font-size: 14px;">
                                ${this.lastSyncTime ? new Date(this.lastSyncTime).toLocaleString('id-ID') : 'Belum'}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Provider Selection -->
                <div style="background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <div style="font-weight: 600; margin-bottom: 16px;">☁️ Pilih Metode Backup</div>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
                        <button onclick="backupModule.setProvider('local')" 
                                style="padding: 16px; border: 2px solid ${isLocal ? '#48bb78' : '#e2e8f0'}; border-radius: 10px; background: ${isLocal ? '#f0fff4' : 'white'}; cursor: pointer;">
                            <div style="font-size: 32px; margin-bottom: 8px;">💾</div>
                            <div style="font-weight: 600;">Local File</div>
                            <div style="font-size: 11px; color: #718096;">Simpan di device</div>
                        </button>
                        <button onclick="backupModule.setProvider('firebase')" 
                                style="padding: 16px; border: 2px solid ${isFirebase ? '#48bb78' : '#e2e8f0'}; border-radius: 10px; background: ${isFirebase ? '#f0fff4' : 'white'}; cursor: pointer;">
                            <div style="font-size: 32px; margin-bottom: 8px;">🔥</div>
                            <div style="font-weight: 600;">Firebase</div>
                            <div style="font-size: 11px; color: #718096;">Real-time sync</div>
                        </button>
                        <button onclick="backupModule.setProvider('googlesheet')" 
                                style="padding: 16px; border: 2px solid ${isGAS ? '#48bb78' : '#e2e8f0'}; border-radius: 10px; background: ${isGAS ? '#f0fff4' : 'white'}; cursor: pointer;">
                            <div style="font-size: 32px; margin-bottom: 8px;">📊</div>
                            <div style="font-weight: 600;">Google Sheets</div>
                            <div style="font-size: 11px; color: #718096;">Via GAS</div>
                        </button>
                    </div>
                </div>

                <!-- Firebase Section -->
                ${isFirebase ? this.renderFirebaseSection(isFBConfigured, isFBLoggedIn) : ''}

                <!-- Google Sheets Section -->
                ${isGAS ? this.renderGASSection() : ''}

                <!-- Local Backup -->
                <div style="background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <div style="font-weight: 600; margin-bottom: 16px;">💾 Backup File (JSON)</div>
                    <button onclick="backupModule.downloadJSON()" 
                            style="width: 100%; padding: 12px; background: #667eea; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; margin-bottom: 12px;">
                        ⬇️ Download JSON
                    </button>
                    <label style="display: block; padding: 16px; border: 2px dashed #cbd5e0; border-radius: 8px; text-align: center; cursor: pointer;">
                        <input type="file" accept=".json" onchange="backupModule.importJSON(this)" style="display: none;">
                        <div style="font-size: 24px;">📤</div>
                        <div>Import JSON</div>
                    </label>
                </div>

                <!-- Manual Sync -->
                ${!isLocal ? `
                    <div style="background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                        <div style="font-weight: 600; margin-bottom: 16px;">🔄 Sinkron Manual</div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                            <button onclick="backupModule.syncNow()" 
                                    style="padding: 12px; background: #48bb78; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                                ⬆️ Upload Sekarang
                            </button>
                            <button onclick="backupModule.${isFirebase ? 'downloadFromFirebase' : 'downloadFromGAS'}()" 
                                    style="padding: 12px; background: #4299e1; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                                ⬇️ Download Sekarang
                            </button>
                        </div>
                    </div>
                ` : ''}

                <!-- Danger Zone -->
                <div style="background: #fff5f5; border: 1px solid #feb2b2; padding: 20px; border-radius: 12px;">
                    <div style="font-weight: 600; color: #c53030; margin-bottom: 16px;">🗑️ Zona Bahaya</div>
                    <button onclick="backupModule.resetLocal()" 
                            style="width: 100%; padding: 12px; background: #e53e3e; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                        🗑️ Hapus Data Lokal
                    </button>
                    ${!isLocal ? `
                        <button onclick="backupModule.resetCloud()" 
                                style="width: 100%; padding: 12px; background: #805ad5; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; margin-top: 8px;">
                            ☁️ Reset Cloud
                        </button>
                    ` : ''}
                </div>

            </div>
        `;
    },

    renderFirebaseSection(isConfigured, isLoggedIn) {
        if (!isConfigured) {
            return `
                <div style="background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; border: 2px solid #ff6b35;">
                    <div style="font-weight: 600; margin-bottom: 16px;">🔥 Konfigurasi Firebase</div>
                    <input type="text" id="fb_apiKey" placeholder="API Key *" style="width: 100%; padding: 10px; margin-bottom: 8px; border: 1px solid #e2e8f0; border-radius: 6px;">
                    <input type="text" id="fb_authDomain" placeholder="Auth Domain *" style="width: 100%; padding: 10px; margin-bottom: 8px; border: 1px solid #e2e8f0; border-radius: 6px;">
                    <input type="text" id="fb_databaseURL" placeholder="Database URL *" style="width: 100%; padding: 10px; margin-bottom: 8px; border: 1px solid #e2e8f0; border-radius: 6px;">
                    <input type="text" id="fb_projectId" placeholder="Project ID" style="width: 100%; padding: 10px; margin-bottom: 8px; border: 1px solid #e2e8f0; border-radius: 6px;">
                    <button onclick="backupModule.saveFirebaseConfig()" style="width: 100%; padding: 12px; background: #ff6b35; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                        💾 Simpan & Connect
                    </button>
                </div>
            `;
        }
        
        if (!isLoggedIn) {
            return `
                <div style="background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; border: 2px solid #ff6b35;">
                    <div style="font-weight: 600; margin-bottom: 16px;">🔥 Login Firebase</div>
                    <input type="email" id="fb_email" placeholder="Email" style="width: 100%; padding: 10px; margin-bottom: 8px; border: 1px solid #e2e8f0; border-radius: 6px;">
                    <input type="password" id="fb_password" placeholder="Password" style="width: 100%; padding: 10px; margin-bottom: 12px; border: 1px solid #e2e8f0; border-radius: 6px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                        <button onclick="backupModule.firebaseLogin(document.getElementById('fb_email').value, document.getElementById('fb_password').value)" 
                                style="padding: 12px; background: #4299e1; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">Login</button>
                        <button onclick="backupModule.firebaseRegister(document.getElementById('fb_email').value, document.getElementById('fb_password').value)" 
                                style="padding: 12px; background: #48bb78; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">Daftar</button>
                    </div>
                </div>
            `;
        }
        
        return `
            <div style="background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; border: 2px solid #ff6b35;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <div>
                        <div style="font-weight: 600;">🔥 Firebase Connected</div>
                        <div style="font-size: 13px; color: #276749;">✅ ${this.currentUser?.email}</div>
                    </div>
                    <button onclick="backupModule.firebaseLogout()" style="padding: 8px 16px; background: #e53e3e; color: white; border: none; border-radius: 6px; cursor: pointer;">Logout</button>
                </div>
                
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f0fff4; border-radius: 8px; margin-bottom: 12px;">
                    <div>
                        <div style="font-weight: 600;">Auto Sync</div>
                        <div style="font-size: 12px; color: #718096;">Sinkron otomatis tiap 3 menit</div>
                    </div>
                    <div onclick="backupModule.toggleAutoSync()" 
                         style="width: 50px; height: 26px; background: ${this.isAutoSyncEnabled ? '#48bb78' : '#cbd5e0'}; border-radius: 13px; cursor: pointer; position: relative; transition: 0.3s;">
                        <div style="width: 22px; height: 22px; background: white; border-radius: 50%; position: absolute; top: 2px; left: ${this.isAutoSyncEnabled ? '26px' : '2px'}; transition: 0.3s;"></div>
                    </div>
                </div>
            </div>
        `;
    },

    renderGASSection() {
        const hasUrl = this.gasUrl.length > 10;
        
        return `
            <div style="background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; border: 2px solid #34a853;">
                <div style="font-weight: 600; margin-bottom: 16px;">📊 Google Sheets</div>
                <input type="text" id="gasUrlInput" value="${this.gasUrl}" placeholder="https://script.google.com/macros/s/.../exec" 
                       style="width: 100%; padding: 10px; margin-bottom: 12px; border: 1px solid #e2e8f0; border-radius: 6px;">
                <button onclick="backupModule.saveGasUrl()" 
                        style="width: 100%; padding: 12px; background: #34a853; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; margin-bottom: 16px;">
                    💾 Simpan URL
                </button>
                
                ${hasUrl ? `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f0fff4; border-radius: 8px;">
                        <div>
                            <div style="font-weight: 600;">Auto Sync</div>
                            <div style="font-size: 12px; color: #718096;">Cek tiap 3 menit</div>
                        </div>
                        <div onclick="backupModule.toggleAutoSync()" 
                             style="width: 50px; height: 26px; background: ${this.isAutoSyncEnabled ? '#48bb78' : '#cbd5e0'}; border-radius: 13px; cursor: pointer; position: relative; transition: 0.3s;">
                            <div style="width: 22px; height: 22px; background: white; border-radius: 50%; position: absolute; top: 2px; left: ${this.isAutoSyncEnabled ? '26px' : '2px'}; transition: 0.3s;"></div>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    },

    showToast(msg) {
        // Gunakan app.showToast jika ada, atau buat sendiri
        if (typeof app !== 'undefined' && app.showToast) {
            app.showToast(msg);
        } else {
            const toast = document.createElement('div');
            toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.8);color:white;padding:12px 24px;border-radius:8px;z-index:9999;';
            toast.textContent = msg;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        }
    }
};

// Auto-init saat load
if (typeof dataManager !== 'undefined') {
    backupModule.init();
}

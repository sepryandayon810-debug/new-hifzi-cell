// ============================================
// BACKUP MODULE - HIFZI CELL
// Firebase + Google Sheets + Local
// ============================================

const backupModule = {
    currentProvider: localStorage.getItem('hifzi_provider') || 'local',
    isAutoSyncEnabled: localStorage.getItem('hifzi_auto_sync') === 'true',
    autoSyncInterval: null,
    lastSyncTime: localStorage.getItem('hifzi_last_sync') || null,
    isOnline: navigator.onLine,
    pendingSync: false,
    
    // Firebase
    firebaseConfig: JSON.parse(localStorage.getItem('hifzi_firebase_config') || '{}'),
    firebaseApp: null,
    database: null,
    auth: null,
    currentUser: null,
    
    // Google Sheets
    gasUrl: localStorage.getItem('hifzi_gas_url') || '',
    
    // Device
    deviceId: localStorage.getItem('hifzi_device_id') || 'device_' + Date.now(),
    deviceName: localStorage.getItem('hifzi_device_name') || navigator.userAgent.split(' ')[0],
    
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

    init() {
        console.log('[Backup] Initializing... Provider:', this.currentProvider);
        
        if (!localStorage.getItem(this.KEYS.DEVICE_ID)) {
            localStorage.setItem(this.KEYS.DEVICE_ID, this.deviceId);
        }
        
        if (this.currentProvider === 'firebase') {
            this.initFirebase();
        } else if (this.currentProvider === 'googlesheet' && this.gasUrl) {
            this.checkNewDeviceGAS();
        }
        
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.showToast('🌐 Online');
            if (this.pendingSync) this.manualSync();
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.showToast('📴 Offline');
        });
    },

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

    manualSync() {
        const data = dataManager.getAllData();
        
        if (this.currentProvider === 'firebase') {
            return this.uploadToFirebase(data);
        } else if (this.currentProvider === 'googlesheet') {
            return this.uploadToGAS(data);
        } else {
            this.showToast('💾 Mode Local - Tidak ada sync');
        }
    },

    // ========== FIREBASE ==========
    
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
            if (firebase.apps?.length) {
                firebase.apps.forEach(app => app.delete());
            }
            
            this.firebaseApp = firebase.initializeApp(this.firebaseConfig);
            this.database = firebase.database();
            this.auth = firebase.auth();
            
            console.log('[Firebase] Initialized');
            
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
            return Promise.reject('Not ready');
        }
        
        return this.auth.signInWithEmailAndPassword(email, password)
            .then((cred) => {
                this.currentUser = cred.user;
                this.showToast('✅ Login Firebase berhasil!');
                if (this.isBackupPage()) this.render();
                return cred.user;
            })
            .catch((err) => {
                this.showToast('❌ ' + err.message);
                throw err;
            });
    },

    firebaseRegister(email, password) {
        if (!this.auth) {
            this.showToast('❌ Firebase belum siap');
            return Promise.reject('Not ready');
        }
        
        return this.auth.createUserWithEmailAndPassword(email, password)
            .then((cred) => {
                this.currentUser = cred.user;
                this.showToast('✅ Daftar berhasil!');
                this.uploadToFirebase(dataManager.getAllData());
                if (this.isBackupPage()) this.render();
                return cred.user;
            })
            .catch((err) => {
                this.showToast('❌ ' + err.message);
                throw err;
            });
    },

    firebaseLogout() {
        if (!this.auth) return Promise.resolve();
        
        return this.auth.signOut().then(() => {
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
                this.updateSyncStatus('Synced');
            })
            .catch((err) => {
                if (!silent) this.showToast('❌ Upload gagal: ' + err.message);
                this.updateSyncStatus('Error');
                throw err;
            });
    },

    downloadFromFirebase(silent = false) {
        if (!this.database || !this.currentUser) {
            if (!silent) this.showToast('❌ Belum login Firebase');
            return Promise.reject('Not authenticated');
        }
        
        if (!silent && !confirm('📥 Download akan mengganti data lokal. Lanjutkan?')) {
            return Promise.resolve();
        }
        
        if (!silent) this.showToast('⬇️ Mengunduh...');
        
        return this.database.ref('users/' + this.currentUser.uid + '/hifzi_data').once('value')
            .then((snapshot) => {
                const cloudData = snapshot.val();
                if (cloudData) {
                    dataManager.saveAllData(cloudData);
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
                throw err;
            });
    },

    startAutoSyncFirebase() {
        this.stopAutoSync();
        this.autoSyncInterval = setInterval(() => {
            this.uploadToFirebase(dataManager.getAllData(), true);
        }, 180000); // 3 menit
        
        console.log('[Firebase] Auto-sync started (3 menit)');
    },

    // ========== GOOGLE SHEETS ==========
    
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
            return Promise.reject('No URL');
        }
        
        const payload = {
            action: 'sync',
            data: data,
            deviceId: this.deviceId,
            timestamp: new Date().toISOString()
        };
        
        return fetch(this.gasUrl, {
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
                this.updateSyncStatus('Synced');
                return result;
            } else {
                throw new Error('Upload failed');
            }
        })
        .catch((err) => {
            // Fallback ke JSONP
            return this.uploadGAS_JSONP(payload, silent);
        });
    },

    uploadGAS_JSONP(payload, silent) {
        return new Promise((resolve, reject) => {
            const cbName = 'gas_cb_' + Date.now();
            const jsonStr = JSON.stringify(payload);
            
            if (jsonStr.length > 8000) {
                reject(new Error('Data too large for JSONP'));
                return;
            }
            
            window[cbName] = (result) => {
                if (result?.success) {
                    this.lastSyncTime = new Date().toISOString();
                    localStorage.setItem(this.KEYS.LAST_SYNC, this.lastSyncTime);
                    if (!silent) this.showToast('✅ Upload berhasil!');
                    resolve(result);
                } else {
                    reject(new Error('Upload failed'));
                }
                delete window[cbName];
            };
            
            const script = document.createElement('script');
            script.src = `${this.gasUrl}?callback=${cbName}&data=${encodeURIComponent(jsonStr)}`;
            script.onerror = () => {
                delete window[cbName];
                reject(new Error('JSONP failed'));
            };
            
            document.head.appendChild(script);
            
            setTimeout(() => {
                delete window[cbName];
                reject(new Error('Timeout'));
            }, 15000);
        });
    },

    downloadFromGAS(silent = false) {
        if (!this.gasUrl) {
            if (!silent) this.showToast('❌ URL GAS belum diisi');
            return Promise.reject('No URL');
        }
        
        if (!silent && !confirm('📥 Download akan mengganti data lokal. Lanjutkan?')) {
            return Promise.resolve();
        }
        
        if (!silent) this.showToast('⬇️ Mengunduh...');
        
        return fetch(`${this.gasUrl}?action=restore&_t=${Date.now()}`)
            .then(r => r.json())
            .then(result => this.handleGASDownload(result, silent))
            .catch(() => this.downloadGAS_JSONP(silent));
    },

    downloadGAS_JSONP(silent) {
        return new Promise((resolve, reject) => {
            const cbName = 'gas_dl_' + Date.now();
            
            window[cbName] = (result) => {
                this.handleGASDownload(result, silent);
                delete window[cbName];
                resolve(result);
            };
            
            const script = document.createElement('script');
            script.src = `${this.gasUrl}?action=restore&callback=${cbName}&_t=${Date.now()}`;
            script.onerror = () => {
                delete window[cbName];
                reject(new Error('Download failed'));
            };
            
            document.head.appendChild(script);
            
            setTimeout(() => {
                delete window[cbName];
                reject(new Error('Timeout'));
            }, 20000);
        });
    },

    handleGASDownload(result, silent) {
        if (result?.success && result.data) {
            dataManager.saveAllData(result.data);
            this.lastSyncTime = new Date().toISOString();
            localStorage.setItem(this.KEYS.LAST_SYNC, this.lastSyncTime);
            
            if (!silent) {
                this.showToast('✅ Download berhasil! Reload...');
                setTimeout(() => location.reload(), 1500);
            }
            return result;
        } else {
            if (!silent) this.showToast('❌ Download gagal');
            throw new Error('Invalid data');
        }
    },

    startAutoSyncGAS() {
        this.stopAutoSync();
        this.autoSyncInterval = setInterval(() => {
            this.uploadToGAS(dataManager.getAllData(), true);
        }, 180000);
        
        console.log('[GAS] Auto-sync started (3 menit)');
    },

    // ========== LOCAL FILE ==========
    
    downloadJSON() {
        const data = dataManager.getAllData();
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
                dataManager.saveAllData(data);
                this.showToast('✅ Import berhasil! Reload...');
                setTimeout(() => location.reload(), 1500);
            } catch (err) {
                this.showToast('❌ Error: ' + err.message);
            }
        };
        reader.readAsText(file);
        input.value = '';
    },

    // ========== CONFIG & SETTINGS ==========
    
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
        this.showToast(`✅ Provider: ${provider === 'local' ? '💾 Local' : provider === 'firebase' ? '🔥 Firebase' : '📊 Google Sheets'}`);
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

    // ========== RESET & DANGER ZONE ==========
    
    resetLocal() {
        if (!confirm('⚠️ Hapus SEMUA data lokal?')) return;
        if (prompt('Ketik HAPUS untuk konfirmasi:') !== 'HAPUS') return;
        
        localStorage.removeItem(dataManager.STORAGE_KEY);
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

    // ========== UI HELPERS ==========
    
    isBackupPage() {
        return document.getElementById('mainContent')?.querySelector('.backup-container') !== null;
    },

    updateSyncStatus(status) {
        const syncText = document.getElementById('syncText');
        if (syncText) {
            syncText.textContent = status;
        }
    },

    showToast(msg) {
        if (typeof app !== 'undefined' && app.showToast) {
            app.showToast(msg);
        } else {
            const toast = document.createElement('div');
            toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.8);color:white;padding:12px 24px;border-radius:8px;z-index:9999;';
            toast.textContent = msg;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        }
    },

    // ========== RENDER UI ==========
    
    render() {
        const container = document.getElementById('mainContent');
        if (!container) return;
        
        const isFirebase = this.currentProvider === 'firebase';
        const isGAS = this.currentProvider === 'googlesheet';
        const isLocal = this.currentProvider === 'local';
        const isFBConfigured = !!this.firebaseConfig.apiKey;
        const isFBLoggedIn = !!this.currentUser;

        // Stats
        const stats = {
            products: dataManager.data.products?.length || 0,
            transactions: dataManager.data.transactions?.length || 0,
            debts: dataManager.data.debts?.length || 0,
            cash: dataManager.data.settings?.currentCash || 0
        };

        container.innerHTML = `
            <div class="backup-container">
                
                <!-- Status Card -->
                <div class="backup-status-card">
                    <div class="backup-status-header">
                        <div>
                            <div class="backup-status-info">Provider Aktif</div>
                            <div class="backup-provider">
                                ${isLocal ? '💾 Local' : isFirebase ? '🔥 Firebase' : '📊 Google Sheets'}
                            </div>
                            <div class="backup-status-info" style="margin-top: 4px;">
                                ${this.isOnline ? '🟢 Online' : '🔴 Offline'} 
                                ${this.isAutoSyncEnabled ? '• Auto-sync ON' : ''}
                            </div>
                        </div>
                        <div class="backup-last-sync">
                            <div class="backup-last-sync-label">Last Sync</div>
                            <div style="font-size: 16px; font-weight: 600;">
                                ${this.lastSyncTime ? new Date(this.lastSyncTime).toLocaleString('id-ID', {hour:'2-digit', minute:'2-digit'}) : 'Belum'}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Stats -->
                <div class="backup-stats-grid">
                    <div class="backup-stat-card">
                        <div class="backup-stat-icon">📦</div>
                        <div class="backup-stat-label">Produk</div>
                        <div class="backup-stat-value">${stats.products}</div>
                    </div>
                    <div class="backup-stat-card">
                        <div class="backup-stat-icon">📝</div>
                        <div class="backup-stat-label">Transaksi</div>
                        <div class="backup-stat-value">${stats.transactions}</div>
                    </div>
                    <div class="backup-stat-card">
                        <div class="backup-stat-icon">💳</div>
                        <div class="backup-stat-label">Hutang</div>
                        <div class="backup-stat-value">${stats.debts}</div>
                    </div>
                    <div class="backup-stat-card">
                        <div class="backup-stat-icon">💰</div>
                        <div class="backup-stat-label">Kas</div>
                        <div class="backup-stat-value">Rp ${stats.cash.toLocaleString('id-ID')}</div>
                    </div>
                </div>

                <!-- Provider Selection -->
                <div class="backup-section">
                    <div class="backup-section-title">☁️ Pilih Metode Backup</div>
                    <div class="backup-provider-grid">
                        <button class="backup-provider-btn ${isLocal ? 'active' : ''}" onclick="backupModule.setProvider('local')">
                            <div class="backup-provider-icon">💾</div>
                            <div class="backup-provider-name">Local File</div>
                            <div class="backup-provider-desc">Simpan di device</div>
                        </button>
                        <button class="backup-provider-btn ${isFirebase ? 'active' : ''}" onclick="backupModule.setProvider('firebase')">
                            <div class="backup-provider-icon">🔥</div>
                            <div class="backup-provider-name">Firebase</div>
                            <div class="backup-provider-desc">Real-time sync</div>
                        </button>
                        <button class="backup-provider-btn ${isGAS ? 'active' : ''}" onclick="backupModule.setProvider('googlesheet')">
                            <div class="backup-provider-icon">📊</div>
                            <div class="backup-provider-name">Google Sheets</div>
                            <div class="backup-provider-desc">Via GAS</div>
                        </button>
                    </div>
                </div>

                <!-- Firebase Section -->
                ${isFirebase ? this.renderFirebaseSection(isFBConfigured, isFBLoggedIn) : ''}

                <!-- Google Sheets Section -->
                ${isGAS ? this.renderGASSection() : ''}

                <!-- Local Backup -->
                <div class="backup-section">
                    <div class="backup-section-title">💾 Backup File (JSON)</div>
                    <button class="backup-btn backup-btn-primary backup-btn-block" onclick="backupModule.downloadJSON()" style="margin-bottom: 12px;">
                        ⬇️ Download JSON
                    </button>
                    <label class="backup-file-drop">
                        <input type="file" accept=".json" onchange="backupModule.importJSON(this)" style="display: none;">
                        <div style="font-size: 32px;">📤</div>
                        <div style="font-weight: 600; margin-top: 8px;">Import JSON</div>
                        <div style="font-size: 12px; color: #718096; margin-top: 4px;">Klik atau drag file ke sini</div>
                    </label>
                </div>

                <!-- Manual Sync -->
                ${!isLocal ? `
                    <div class="backup-section">
                        <div class="backup-section-title">🔄 Sinkron Manual</div>
                        <div class="backup-sync-actions">
                            <button class="backup-btn backup-btn-success" onclick="backupModule.manualSync()">
                                ⬆️ Upload Sekarang
                            </button>
                            <button class="backup-btn backup-btn-primary" onclick="backupModule.${isFirebase ? 'downloadFromFirebase' : 'downloadFromGAS'}()">
                                ⬇️ Download Sekarang
                            </button>
                        </div>
                    </div>
                ` : ''}

                <!-- Danger Zone -->
                <div class="backup-danger-zone">
                    <div class="backup-danger-title">🗑️ Zona Bahaya</div>
                    <button class="backup-btn backup-btn-danger backup-btn-block" onclick="backupModule.resetLocal()">
                        🗑️ Hapus Data Lokal
                    </button>
                    ${!isLocal ? `
                        <button class="backup-btn backup-btn-warning backup-btn-block" onclick="backupModule.resetCloud()" style="margin-top: 8px;">
                            ☁️ Reset Cloud (${isFirebase ? 'Firebase' : 'GAS'})
                        </button>
                    ` : ''}
                </div>

            </div>
        `;
    },

    renderFirebaseSection(isConfigured, isLoggedIn) {
        if (!isConfigured) {
            return `
                <div class="backup-section" style="border: 2px solid #ff6b35;">
                    <div class="backup-section-title">🔥 Konfigurasi Firebase</div>
                    <div class="backup-input-group">
                        <input type="text" id="fb_apiKey" class="backup-input" placeholder="API Key *">
                    </div>
                    <div class="backup-input-group">
                        <input type="text" id="fb_authDomain" class="backup-input" placeholder="Auth Domain *">
                    </div>
                    <div class="backup-input-group">
                        <input type="text" id="fb_databaseURL" class="backup-input" placeholder="Database URL *">
                    </div>
                    <div class="backup-input-group">
                        <input type="text" id="fb_projectId" class="backup-input" placeholder="Project ID">
                    </div>
                    <button class="backup-btn backup-btn-primary backup-btn-block" onclick="backupModule.saveFirebaseConfig()">
                        💾 Simpan & Connect
                    </button>
                </div>
            `;
        }
        
        if (!isLoggedIn) {
            return `
                <div class="backup-section" style="border: 2px solid #ff6b35;">
                    <div class="backup-section-title">🔥 Login Firebase</div>
                    <div class="backup-input-group">
                        <input type="email" id="fb_email" class="backup-input" placeholder="Email">
                    </div>
                    <div class="backup-input-group">
                        <input type="password" id="fb_password" class="backup-input" placeholder="Password">
                    </div>
                    <div class="backup-grid-2">
                        <button class="backup-btn backup-btn-primary backup-btn-block" onclick="backupModule.firebaseLogin(document.getElementById('fb_email').value, document.getElementById('fb_password').value)">
                            Login
                        </button>
                        <button class="backup-btn backup-btn-success backup-btn-block" onclick="backupModule.firebaseRegister(document.getElementById('fb_email').value, document.getElementById('fb_password').value)">
                            Daftar
                        </button>
                    </div>
                </div>
            `;
        }
        
        return `
            <div class="backup-section" style="border: 2px solid #ff6b35;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <div>
                        <div style="font-weight: 600;">🔥 Firebase Connected</div>
                        <div style="font-size: 13px; color: #276749;">✅ ${this.currentUser?.email}</div>
                    </div>
                    <button class="backup-btn backup-btn-danger" onclick="backupModule.firebaseLogout()">Logout</button>
                </div>
                
                <div class="backup-toggle">
                    <div>
                        <div style="font-weight: 600;">Auto Sync</div>
                        <div style="font-size: 12px; color: #718096;">Sinkron otomatis tiap 3 menit</div>
                    </div>
                    <div class="backup-toggle-switch ${this.isAutoSyncEnabled ? 'active' : ''}" onclick="backupModule.toggleAutoSync()">
                        <div class="backup-toggle-knob"></div>
                    </div>
                </div>
            </div>
        `;
    },

    renderGASSection() {
        const hasUrl = this.gasUrl.length > 10;
        
        return `
            <div class="backup-section" style="border: 2px solid #34a853;">
                <div class="backup-section-title">📊 Google Sheets</div>
                <div class="backup-input-group">
                    <input type="text" id="gasUrlInput" class="backup-input" value="${this.gasUrl}" placeholder="https://script.google.com/macros/s/.../exec">
                </div>
                <button class="backup-btn backup-btn-success backup-btn-block" onclick="backupModule.saveGasUrl()" style="margin-bottom: 16px;">
                    💾 Simpan URL
                </button>
                
                ${hasUrl ? `
                    <div class="backup-toggle">
                        <div>
                            <div style="font-weight: 600;">Auto Sync</div>
                            <div style="font-size: 12px; color: #718096;">Cek tiap 3 menit</div>
                        </div>
                        <div class="backup-toggle-switch ${this.isAutoSyncEnabled ? 'active' : ''}" onclick="backupModule.toggleAutoSync()">
                            <div class="backup-toggle-knob"></div>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }
};

// Auto-init
if (typeof dataManager !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        backupModule.init();
    });
}

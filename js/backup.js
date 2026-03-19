// ============================================
// BACKUP MODULE - HIFZI CELL (FIXED RENDER)
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

    // ============================================
    // INIT & SETUP
    // ============================================

    init() {
        console.log('[Backup] Initializing... Provider:', this.currentProvider);
        
        if (!localStorage.getItem(this.KEYS.DEVICE_ID)) {
            localStorage.setItem(this.KEYS.DEVICE_ID, this.deviceId);
        }
        
        // Setup online/offline listeners
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.showToast('🌐 Online');
            if (this.pendingSync) this.manualUpload();
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.showToast('📴 Offline');
        });

        // Initialize provider
        if (this.currentProvider === 'firebase') {
            this.initFirebase();
        } else if (this.currentProvider === 'googlesheet' && this.gasUrl) {
            this.checkNewDeviceGAS();
        }

        // Listen untuk render saat navigasi
        this.setupRenderListener();
    },

    setupRenderListener() {
        // Override fungsi navigasi app jika ada
        if (typeof app !== 'undefined' && app.navigateTo) {
            const originalNavigate = app.navigateTo.bind(app);
            app.navigateTo = (page) => {
                originalNavigate(page);
                if (page === 'cloud' || page === 'backup') {
                    setTimeout(() => this.render(), 100);
                }
            };
        }

        // Also check URL hash
        window.addEventListener('hashchange', () => {
            if (location.hash.includes('cloud') || location.hash.includes('backup')) {
                setTimeout(() => this.render(), 100);
            }
        });
    },

    // ============================================
    // DATA COLLECTION (Exclude Telegram)
    // ============================================

    getBackupData() {
        const allData = (typeof dataManager !== 'undefined' && dataManager.getAllData) 
            ? dataManager.getAllData() 
            : (typeof dataManager !== 'undefined' ? dataManager.data : {});
        
        return {
            products: allData.products || [],
            categories: allData.categories || [],
            transactions: allData.transactions || [],
            shifts: allData.shifts || [],
            debts: allData.debts || [],
            settings: allData.settings || {},
            cashHistory: allData.cashHistory || [],
            users: allData.users || [],
            loginHistory: allData.loginHistory || [],
            currentUser: allData.currentUser || null,
            _backupMeta: {
                version: '2.0',
                deviceId: this.deviceId,
                deviceName: this.deviceName,
                backupDate: new Date().toISOString(),
                provider: this.currentProvider
            }
        };
    },

    saveBackupData(backupData) {
        const telegramBackup = (typeof dataManager !== 'undefined' && dataManager.data) 
            ? dataManager.data.telegram 
            : {};
        
        const dataToSave = {
            ...backupData,
            telegram: telegramBackup
        };
        
        if (typeof dataManager !== 'undefined') {
            if (dataManager.saveAllData) {
                dataManager.saveAllData(dataToSave);
            } else {
                Object.keys(backupData).forEach(key => {
                    if (key !== '_backupMeta' && key !== 'telegram') {
                        dataManager.data[key] = backupData[key];
                    }
                });
                if (dataManager.saveData) dataManager.saveData();
            }
        }
    },

    // ============================================
    // AUTO SYNC
    // ============================================

    shouldSync() {
        return this.currentProvider !== 'local' && this.isAutoSyncEnabled && this.isOnline;
    },

    syncToCloud(silent = true) {
        if (!this.shouldSync()) {
            console.log('[Backup] Skip sync - conditions not met');
            return Promise.resolve();
        }
        
        console.log('[Backup] Auto-sync to', this.currentProvider);
        
        const data = this.getBackupData();
        
        if (this.currentProvider === 'firebase' && this.currentUser) {
            return this.uploadToFirebase(data, silent);
        } else if (this.currentProvider === 'googlesheet' && this.gasUrl) {
            return this.uploadToGAS(data, silent);
        }
        
        return Promise.resolve();
    },

    startAutoSync() {
        this.stopAutoSync();
        
        if (!this.isAutoSyncEnabled || this.currentProvider === 'local') {
            return;
        }
        
        this.autoSyncInterval = setInterval(() => {
            console.log('[Backup] Running auto-sync...');
            this.syncToCloud(true);
        }, 180000);
        
        console.log(`[Backup] Auto-sync started for ${this.currentProvider}`);
    },

    stopAutoSync() {
        if (this.autoSyncInterval) {
            clearInterval(this.autoSyncInterval);
            this.autoSyncInterval = null;
            console.log('[Backup] Auto-sync stopped');
        }
    },

    toggleAutoSync() {
        this.isAutoSyncEnabled = !this.isAutoSyncEnabled;
        localStorage.setItem(this.KEYS.AUTO_SYNC, this.isAutoSyncEnabled);
        
        if (this.isAutoSyncEnabled) {
            this.startAutoSync();
            this.showToast('🟢 Auto-sync aktif (3 menit)');
        } else {
            this.stopAutoSync();
            this.showToast('⚪ Auto-sync dimatikan');
        }
        
        this.render();
    },

    // ============================================
    // MANUAL SYNC (UPLOAD/DOWNLOAD)
    // ============================================

    manualUpload() {
        const data = this.getBackupData();
        
        if (this.currentProvider === 'firebase') {
            return this.uploadToFirebase(data, false);
        } else if (this.currentProvider === 'googlesheet') {
            return this.uploadToGAS(data, false);
        } else {
            this.downloadJSON();
            return Promise.resolve();
        }
    },

    manualDownload() {
        if (this.currentProvider === 'firebase') {
            return this.downloadFromFirebase(false);
        } else if (this.currentProvider === 'googlesheet') {
            return this.downloadFromGAS(false);
        } else {
            this.showToast('💾 Mode Local - Gunakan Import JSON');
            return Promise.resolve();
        }
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
            console.log('[Firebase] No config found');
            return;
        }
        
        try {
            if (firebase.apps?.length) {
                firebase.apps.forEach(app => app.delete());
            }
            
            this.firebaseApp = firebase.initializeApp(this.firebaseConfig);
            this.database = firebase.database();
            this.auth = firebase.auth();
            
            console.log('[Firebase] Initialized successfully');
            
            this.auth.onAuthStateChanged((user) => {
                if (user) {
                    this.currentUser = user;
                    localStorage.setItem(this.KEYS.FB_USER, JSON.stringify({
                        uid: user.uid,
                        email: user.email,
                        displayName: user.displayName || ''
                    }));
                    
                    if (this.isAutoSyncEnabled) {
                        this.startAutoSync();
                    }
                    
                    this.checkNewDeviceFirebase();
                    this.addLoginHistory('firebase', user.email);
                } else {
                    this.currentUser = null;
                }
                
                this.render();
            });
            
        } catch (err) {
            console.error('[Firebase] Init error:', err);
            this.showToast('❌ Error Firebase: ' + err.message);
        }
    },

    checkNewDeviceFirebase() {
        const hasLocalData = (typeof dataManager !== 'undefined' && dataManager.data) 
            ? (dataManager.data.products?.length > 0 || dataManager.data.transactions?.length > 0)
            : false;
        
        if (!hasLocalData && this.currentUser) {
            console.log('[Firebase] New device detected, auto-downloading...');
            this.showToast('📱 Device baru, mengunduh data...');
            setTimeout(() => this.downloadFromFirebase(true), 1000);
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
                this.showToast('✅ Login berhasil!');
                this.addLoginHistory('firebase', cred.user.email);
                this.render();
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
                
                const data = this.getBackupData();
                this.uploadToFirebase(data, true);
                this.addLoginHistory('firebase', cred.user.email);
                this.render();
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
            this.showToast('✅ Logout berhasil');
            this.render();
        });
    },

    uploadToFirebase(data, silent = false) {
        if (!this.database || !this.currentUser) {
            if (!silent) this.showToast('❌ Belum login Firebase');
            return Promise.reject('Not authenticated');
        }
        
        if (!silent) this.showToast('⬆️ Mengupload ke Firebase...');
        
        const payload = {
            ...data,
            _syncMeta: {
                lastModified: new Date().toISOString(),
                deviceId: this.deviceId,
                deviceName: this.deviceName,
                version: '2.0'
            }
        };
        
        return this.database.ref('users/' + this.currentUser.uid + '/hifzi_data').set(payload)
            .then(() => {
                this.lastSyncTime = new Date().toISOString();
                localStorage.setItem(this.KEYS.LAST_SYNC, this.lastSyncTime);
                if (!silent) this.showToast('✅ Upload berhasil!');
                this.updateSyncStatus('Synced');
                return true;
            })
            .catch((err) => {
                if (!silent) this.showToast('❌ Upload gagal: ' + err.message);
                this.updateSyncStatus('Error');
                throw err;
            });
    },

    downloadFromFirebase(silent = false, force = false) {
        if (!this.database || !this.currentUser) {
            if (!silent) this.showToast('❌ Belum login Firebase');
            return Promise.reject('Not authenticated');
        }
        
        if (!silent && !force) {
            if (!confirm('📥 Download akan mengganti data lokal. Lanjutkan?')) {
                return Promise.resolve();
            }
        }
        
        if (!silent) this.showToast('⬇️ Mengunduh dari Firebase...');
        
        return this.database.ref('users/' + this.currentUser.uid + '/hifzi_data').once('value')
            .then((snapshot) => {
                const cloudData = snapshot.val();
                if (cloudData) {
                    this.saveBackupData(cloudData);
                    this.lastSyncTime = new Date().toISOString();
                    localStorage.setItem(this.KEYS.LAST_SYNC, this.lastSyncTime);
                    
                    if (!silent) {
                        this.showToast('✅ Download berhasil! Reload...');
                        setTimeout(() => location.reload(), 1500);
                    }
                    return cloudData;
                } else {
                    if (!silent) this.showToast('ℹ️ Tidak ada data di cloud');
                    return null;
                }
            })
            .catch((err) => {
                if (!silent) this.showToast('❌ Download gagal: ' + err.message);
                throw err;
            });
    },

    // ============================================
    // GOOGLE SHEETS
    // ============================================

    checkNewDeviceGAS() {
        const hasLocalData = (typeof dataManager !== 'undefined' && dataManager.data) 
            ? dataManager.data.products?.length > 0 
            : false;
        
        if (!hasLocalData && this.gasUrl) {
            console.log('[GAS] New device detected, auto-downloading...');
            setTimeout(() => this.downloadFromGAS(true), 1000);
        }
        
        if (this.isAutoSyncEnabled && this.gasUrl) {
            this.startAutoSync();
        }
    },

    uploadToGAS(data, silent = false) {
        if (!this.gasUrl) {
            if (!silent) this.showToast('❌ URL GAS belum diisi');
            return Promise.reject('No URL');
        }
        
        if (!silent) this.showToast('⬆️ Mengupload ke Google Sheets...');
        
        const payload = {
            action: 'sync',
            data: data,
            deviceId: this.deviceId,
            deviceName: this.deviceName,
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
                if (!silent) this.showToast('✅ Upload berhasil!');
                this.updateSyncStatus('Synced');
                return result;
            } else {
                throw new Error(result?.message || 'Upload failed');
            }
        })
        .catch((err) => {
            return this.uploadGAS_JSONP(payload, silent);
        });
    },

    uploadGAS_JSONP(payload, silent) {
        return new Promise((resolve, reject) => {
            const cbName = 'gas_cb_' + Date.now();
            const jsonStr = JSON.stringify(payload);
            
            if (jsonStr.length > 8000) {
                reject(new Error('Data terlalu besar'));
                return;
            }
            
            window[cbName] = (result) => {
                if (result?.success) {
                    this.lastSyncTime = new Date().toISOString();
                    localStorage.setItem(this.KEYS.LAST_SYNC, this.lastSyncTime);
                    if (!silent) this.showToast('✅ Upload berhasil!');
                    resolve(result);
                } else {
                    reject(new Error(result?.message || 'Upload failed'));
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

    downloadFromGAS(silent = false, force = false) {
        if (!this.gasUrl) {
            if (!silent) this.showToast('❌ URL GAS belum diisi');
            return Promise.reject('No URL');
        }
        
        if (!silent && !force) {
            if (!confirm('📥 Download akan mengganti data lokal. Lanjutkan?')) {
                return Promise.resolve();
            }
        }
        
        if (!silent) this.showToast('⬇️ Mengunduh dari Google Sheets...');
        
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
            this.saveBackupData(result.data);
            this.lastSyncTime = new Date().toISOString();
            localStorage.setItem(this.KEYS.LAST_SYNC, this.lastSyncTime);
            
            if (!silent) {
                this.showToast('✅ Download berhasil! Reload...');
                setTimeout(() => location.reload(), 1500);
            }
            return result;
        } else {
            if (!silent) this.showToast('❌ Download gagal: ' + (result?.message || 'Invalid data'));
            throw new Error('Invalid data');
        }
    },

    // ============================================
    // LOCAL FILE BACKUP
    // ============================================

    downloadJSON() {
        const data = this.getBackupData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `hifzi_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showToast('✅ File JSON didownload!');
    },

    importJSON(input) {
        const file = input.files[0];
        if (!file) return;
        
        if (!confirm('⚠️ Import akan menimpa data lokal (kecuali Telegram). Lanjutkan?')) {
            input.value = '';
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                this.saveBackupData(data);
                this.showToast('✅ Import berhasil! Reload...');
                setTimeout(() => location.reload(), 1500);
            } catch (err) {
                this.showToast('❌ Error: ' + err.message);
            }
        };
        reader.onerror = () => {
            this.showToast('❌ Error membaca file');
        };
        reader.readAsText(file);
        input.value = '';
    },

    // ============================================
    // LOGIN HISTORY
    // ============================================

    addLoginHistory(provider, email) {
        const history = JSON.parse(localStorage.getItem('hifzi_login_history') || '[]');
        
        history.unshift({
            timestamp: new Date().toISOString(),
            provider: provider,
            email: email,
            deviceId: this.deviceId,
            deviceName: this.deviceName
        });
        
        if (history.length > 50) history.pop();
        
        localStorage.setItem('hifzi_login_history', JSON.stringify(history));
        
        if (typeof dataManager !== 'undefined' && dataManager.data) {
            dataManager.data.loginHistory = history;
            if (dataManager.saveData) dataManager.saveData();
        }
    },

    getLoginHistory() {
        return JSON.parse(localStorage.getItem('hifzi_login_history') || '[]');
    },

    clearLoginHistory() {
        if (confirm('Hapus riwayat login?')) {
            localStorage.removeItem('hifzi_login_history');
            if (typeof dataManager !== 'undefined' && dataManager.data) {
                dataManager.data.loginHistory = [];
                if (dataManager.saveData) dataManager.saveData();
            }
            this.showToast('✅ Riwayat login dihapus');
            this.render();
        }
    },

    // ============================================
    // CONFIG & SETTINGS
    // ============================================

    setProvider(provider) {
        this.currentProvider = provider;
        localStorage.setItem(this.KEYS.PROVIDER, provider);
        this.stopAutoSync();
        
        if (provider === 'firebase') {
            this.initFirebase();
        } else if (provider === 'googlesheet') {
            this.checkNewDeviceGAS();
        }
        
        this.showToast(`✅ Provider: ${provider === 'local' ? '💾 Local' : provider === 'firebase' ? '🔥 Firebase' : '📊 Google Sheets'}`);
        this.render();
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
        this.render();
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
        
        this.render();
    },

    // ============================================
    // RESET & DANGER ZONE
    // ============================================

    resetLocal() {
        if (!confirm('⚠️ Hapus SEMUA data lokal?')) return;
        if (prompt('Ketik HAPUS untuk konfirmasi:') !== 'HAPUS') return;
        
        const telegramBackup = (typeof dataManager !== 'undefined' && dataManager.data) 
            ? dataManager.data.telegram 
            : {};
        
        localStorage.removeItem('hifzi_data');
        
        if (telegramBackup && typeof dataManager !== 'undefined' && dataManager.data) {
            dataManager.data.telegram = telegramBackup;
            if (dataManager.saveData) dataManager.saveData();
        }
        
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
    // UI HELPERS
    // ============================================

    updateSyncStatus(status) {
        const syncText = document.getElementById('syncText');
        if (syncText) syncText.textContent = status;
    },

    showToast(msg) {
        if (typeof app !== 'undefined' && app.showToast) {
            app.showToast(msg);
        } else {
            const existing = document.querySelector('.backup-toast');
            if (existing) existing.remove();
            
            const toast = document.createElement('div');
            toast.className = 'backup-toast';
            toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.85);color:white;padding:12px 24px;border-radius:8px;z-index:9999;font-size:14px;animation:slideDown 0.3s ease;';
            toast.textContent = msg;
            document.body.appendChild(toast);
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(-50%) translateY(-20px)';
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }
    },

    // ============================================
    // RENDER UI (FIXED - LANGSUNG KE mainContent)
    // ============================================

    render() {
        // Coba cari container dengan berbagai cara
        let container = document.getElementById('mainContent');
        
        // Jika tidak ada, coba cari container lain yang umum
        if (!container) {
            container = document.querySelector('.main-content') || 
                       document.querySelector('#content') || 
                       document.querySelector('.content') ||
                       document.querySelector('main');
        }
        
        if (!container) {
            console.error('[Backup] No container found for rendering');
            return;
        }
        
        console.log('[Backup] Rendering to:', container.id || container.className);
        
        const isFirebase = this.currentProvider === 'firebase';
        const isGAS = this.currentProvider === 'googlesheet';
        const isLocal = this.currentProvider === 'local';
        const isFBConfigured = !!this.firebaseConfig.apiKey;
        const isFBLoggedIn = !!this.currentUser;

        const data = (typeof dataManager !== 'undefined') ? dataManager.data : {};
        const stats = {
            products: data.products?.length || 0,
            transactions: data.transactions?.length || 0,
            debts: data.debts?.length || 0,
            cash: data.settings?.currentCash || 0
        };

        const loginHistory = this.getLoginHistory();
        const recentLogins = loginHistory.slice(0, 5);

        const html = `
            <div class="backup-container" style="padding: 20px; max-width: 900px; margin: 0 auto; font-family: system-ui, -apple-system, sans-serif;">
                
                <!-- Header Status -->
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 16px; margin-bottom: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-size: 12px; opacity: 0.9; margin-bottom: 4px;">Provider Aktif</div>
                            <div style="font-size: 24px; font-weight: 700;">
                                ${isLocal ? '💾 Local' : isFirebase ? '🔥 Firebase' : '📊 Google Sheets'}
                            </div>
                            <div style="font-size: 13px; margin-top: 8px; opacity: 0.9;">
                                ${this.isOnline ? '🟢 Online' : '🔴 Offline'} 
                                ${this.isAutoSyncEnabled ? '• Auto-sync ON' : '• Auto-sync OFF'}
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 12px; opacity: 0.9; margin-bottom: 4px;">Last Sync</div>
                            <div style="font-size: 18px; font-weight: 600;">
                                ${this.lastSyncTime ? new Date(this.lastSyncTime).toLocaleString('id-ID', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'}) : 'Belum'}
                            </div>
                            <div style="font-size: 11px; margin-top: 4px; opacity: 0.8;">
                                Device: ${this.deviceName}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Stats Grid -->
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px;">
                    <div style="background: white; padding: 16px; border-radius: 12px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                        <div style="font-size: 28px; margin-bottom: 4px;">📦</div>
                        <div style="font-size: 12px; color: #718096;">Produk</div>
                        <div style="font-size: 20px; font-weight: 700; color: #2d3748;">${stats.products}</div>
                    </div>
                    <div style="background: white; padding: 16px; border-radius: 12px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                        <div style="font-size: 28px; margin-bottom: 4px;">📝</div>
                        <div style="font-size: 12px; color: #718096;">Transaksi</div>
                        <div style="font-size: 20px; font-weight: 700; color: #2d3748;">${stats.transactions}</div>
                    </div>
                    <div style="background: white; padding: 16px; border-radius: 12px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                        <div style="font-size: 28px; margin-bottom: 4px;">💳</div>
                        <div style="font-size: 12px; color: #718096;">Hutang</div>
                        <div style="font-size: 20px; font-weight: 700; color: #2d3748;">${stats.debts}</div>
                    </div>
                    <div style="background: white; padding: 16px; border-radius: 12px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                        <div style="font-size: 28px; margin-bottom: 4px;">💰</div>
                        <div style="font-size: 12px; color: #718096;">Kas</div>
                        <div style="font-size: 16px; font-weight: 700; color: #2d3748;">Rp ${stats.cash.toLocaleString('id-ID')}</div>
                    </div>
                </div>

                <!-- Provider Selection -->
                <div style="background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                    <div style="font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #2d3748;">☁️ Pilih Metode Backup</div>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
                        <button onclick="backupModule.setProvider('local')" 
                            style="padding: 16px; border: 2px solid ${isLocal ? '#667eea' : '#e2e8f0'}; border-radius: 12px; background: ${isLocal ? '#f7fafc' : 'white'}; cursor: pointer; transition: all 0.2s;">
                            <div style="font-size: 32px; margin-bottom: 8px;">💾</div>
                            <div style="font-weight: 600; color: #2d3748;">Local File</div>
                            <div style="font-size: 12px; color: #718096; margin-top: 4px;">Simpan di device</div>
                        </button>
                        <button onclick="backupModule.setProvider('firebase')" 
                            style="padding: 16px; border: 2px solid ${isFirebase ? '#ff6b35' : '#e2e8f0'}; border-radius: 12px; background: ${isFirebase ? '#fff5f0' : 'white'}; cursor: pointer; transition: all 0.2s;">
                            <div style="font-size: 32px; margin-bottom: 8px;">🔥</div>
                            <div style="font-weight: 600; color: #2d3748;">Firebase</div>
                            <div style="font-size: 12px; color: #718096; margin-top: 4px;">Real-time sync</div>
                        </button>
                        <button onclick="backupModule.setProvider('googlesheet')" 
                            style="padding: 16px; border: 2px solid ${isGAS ? '#34a853' : '#e2e8f0'}; border-radius: 12px; background: ${isGAS ? '#f0fff4' : 'white'}; cursor: pointer; transition: all 0.2s;">
                            <div style="font-size: 32px; margin-bottom: 8px;">📊</div>
                            <div style="font-weight: 600; color: #2d3748;">Google Sheets</div>
                            <div style="font-size: 12px; color: #718096; margin-top: 4px;">Via GAS</div>
                        </button>
                    </div>
                </div>

                <!-- Firebase Section -->
                ${isFirebase ? this.renderFirebaseSection(isFBConfigured, isFBLoggedIn) : ''}

                <!-- Google Sheets Section -->
                ${isGAS ? this.renderGASSection() : ''}

                <!-- Manual Sync Section -->
                <div style="background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border: 2px solid #667eea;">
                    <div style="font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #2d3748;">🔄 Sinkronisasi Manual</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                        <button onclick="backupModule.manualUpload()" 
                            style="padding: 16px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px;">
                            <span style="font-size: 20px;">⬆️</span>
                            <div>
                                <div>Upload ke Cloud</div>
                                <div style="font-size: 11px; opacity: 0.9; font-weight: normal;">Kirim data ke ${isLocal ? 'JSON' : isFirebase ? 'Firebase' : 'Sheets'}</div>
                            </div>
                        </button>
                        <button onclick="backupModule.manualDownload()" 
                            style="padding: 16px; background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px;">
                            <span style="font-size: 20px;">⬇️</span>
                            <div>
                                <div>Download dari Cloud</div>
                                <div style="font-size: 11px; opacity: 0.9; font-weight: normal;">Ambil data untuk device ini</div>
                            </div>
                        </button>
                    </div>
                    <div style="background: #ebf8ff; border-left: 4px solid #4299e1; padding: 12px; border-radius: 6px; font-size: 13px; color: #2c5282;">
                        <strong>💡 Tips:</strong> Gunakan Upload sebelum pindah device, lalu Download di device baru. Data Telegram tidak ikut tersimpan di cloud.
                    </div>
                </div>

                <!-- Local Backup -->
                <div style="background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                    <div style="font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #2d3748;">💾 Backup File Lokal (JSON)</div>
                    <button onclick="backupModule.downloadJSON()" 
                        style="width: 100%; padding: 14px; background: #4a5568; color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <span>⬇️</span> Download JSON
                    </button>
                    <label style="display: block; padding: 24px; border: 2px dashed #cbd5e0; border-radius: 10px; text-align: center; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='#667eea'" onmouseout="this.style.borderColor='#cbd5e0'">
                        <input type="file" accept=".json" onchange="backupModule.importJSON(this)" style="display: none;">
                        <div style="font-size: 40px; margin-bottom: 8px;">📤</div>
                        <div style="font-weight: 600; color: #2d3748;">Import JSON</div>
                        <div style="font-size: 12px; color: #718096; margin-top: 4px;">Klik atau drag file ke sini</div>
                    </label>
                </div>

                <!-- Login History -->
                <div style="background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                        <div style="font-size: 16px; font-weight: 600; color: #2d3748;">📋 Riwayat Login</div>
                        ${loginHistory.length > 0 ? `<button onclick="backupModule.clearLoginHistory()" style="padding: 6px 12px; background: #fed7d7; color: #c53030; border: none; border-radius: 6px; cursor: pointer; font-size: 12px;">Hapus</button>` : ''}
                    </div>
                    ${loginHistory.length === 0 ? 
                        `<div style="text-align: center; padding: 20px; color: #a0aec0; font-size: 13px;">Belum ada riwayat login</div>` :
                        `<div style="max-height: 200px; overflow-y: auto;">
                            ${recentLogins.map(login => `
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #f7fafc; border-radius: 8px; margin-bottom: 8px;">
                                    <div>
                                        <div style="font-weight: 600; font-size: 13px; color: #2d3748;">${login.email}</div>
                                        <div style="font-size: 11px; color: #718096;">${login.provider === 'firebase' ? '🔥 Firebase' : '📊 Sheets'} • ${login.deviceName}</div>
                                    </div>
                                    <div style="font-size: 11px; color: #a0aec0; text-align: right;">
                                        ${new Date(login.timestamp).toLocaleDateString('id-ID')}<br>
                                        ${new Date(login.timestamp).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}
                                    </div>
                                </div>
                            `).join('')}
                            ${loginHistory.length > 5 ? `<div style="text-align: center; font-size: 12px; color: #718096; margin-top: 8px;">... dan ${loginHistory.length - 5} login lainnya</div>` : ''}
                        </div>`
                    }
                </div>

                <!-- Danger Zone -->
                <div style="background: #fff5f5; border: 1px solid #feb2b2; padding: 20px; border-radius: 12px;">
                    <div style="font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #c53030;">🗑️ Zona Bahaya</div>
                    <button onclick="backupModule.resetLocal()" 
                        style="width: 100%; padding: 14px; background: #fc8181; color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; margin-bottom: 8px;">
                        🗑️ Hapus Data Lokal
                    </button>
                    ${!isLocal ? `
                        <button onclick="backupModule.resetCloud()" 
                            style="width: 100%; padding: 14px; background: #f6ad55; color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600;">
                            ☁️ Reset Cloud (${isFirebase ? 'Firebase' : 'GAS'})
                        </button>
                    ` : ''}
                </div>

            </div>
        `;

        // Set HTML ke container
        container.innerHTML = html;
        console.log('[Backup] Render completed');
    },

    renderFirebaseSection(isConfigured, isLoggedIn) {
        if (!isConfigured) {
            return `
                <div style="background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border: 2px solid #ff6b35;">
                    <div style="font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #2d3748;">🔥 Konfigurasi Firebase</div>
                    <div style="display: grid; gap: 12px; margin-bottom: 16px;">
                        <input type="text" id="fb_apiKey" placeholder="API Key *" style="padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px;">
                        <input type="text" id="fb_authDomain" placeholder="Auth Domain *" style="padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px;">
                        <input type="text" id="fb_databaseURL" placeholder="Database URL *" style="padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px;">
                        <input type="text" id="fb_projectId" placeholder="Project ID" style="padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px;">
                    </div>
                    <button onclick="backupModule.saveFirebaseConfig()" 
                        style="width: 100%; padding: 14px; background: #ff6b35; color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600;">
                        💾 Simpan & Connect
                    </button>
                </div>
            `;
        }
        
        if (!isLoggedIn) {
            return `
                <div style="background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border: 2px solid #ff6b35;">
                    <div style="font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #2d3748;">🔥 Login Firebase</div>
                    <div style="display: grid; gap: 12px; margin-bottom: 16px;">
                        <input type="email" id="fb_email" placeholder="Email" style="padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px;">
                        <input type="password" id="fb_password" placeholder="Password" style="padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px;">
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <button onclick="backupModule.firebaseLogin(document.getElementById('fb_email').value, document.getElementById('fb_password').value)" 
                            style="padding: 14px; background: #ff6b35; color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600;">
                            Login
                        </button>
                        <button onclick="backupModule.firebaseRegister(document.getElementById('fb_email').value, document.getElementById('fb_password').value)" 
                            style="padding: 14px; background: #48bb78; color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600;">
                            Daftar Baru
                        </button>
                    </div>
                </div>
            `;
        }
        
        return `
            <div style="background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border: 2px solid #ff6b35;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <div>
                        <div style="font-weight: 600; color: #2d3748;">🔥 Firebase Connected</div>
                        <div style="font-size: 13px; color: #38a169; margin-top: 4px;">✅ ${this.currentUser?.email}</div>
                    </div>
                    <button onclick="backupModule.firebaseLogout()" 
                        style="padding: 8px 16px; background: #fc8181; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px;">
                        Logout
                    </button>
                </div>
                
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: #f7fafc; border-radius: 10px;">
                    <div>
                        <div style="font-weight: 600; color: #2d3748;">Auto Sync</div>
                        <div style="font-size: 12px; color: #718096; margin-top: 2px;">Sinkron otomatis tiap 3 menit</div>
                    </div>
                    <div onclick="backupModule.toggleAutoSync()" 
                        style="width: 50px; height: 28px; background: ${this.isAutoSyncEnabled ? '#48bb78' : '#cbd5e0'}; border-radius: 14px; position: relative; cursor: pointer; transition: all 0.3s;">
                        <div style="width: 24px; height: 24px; background: white; border-radius: 50%; position: absolute; top: 2px; ${this.isAutoSyncEnabled ? 'left: 24px' : 'left: 2px'}; transition: all 0.3s; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></div>
                    </div>
                </div>
            </div>
        `;
    },

    renderGASSection() {
        const hasUrl = this.gasUrl.length > 10;
        
        return `
            <div style="background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border: 2px solid #34a853;">
                <div style="font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #2d3748;">📊 Google Sheets</div>
                <div style="margin-bottom: 16px;">
                    <input type="text" id="gasUrlInput" value="${this.gasUrl}" placeholder="https://script.google.com/macros/s/.../exec" 
                        style="width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; margin-bottom: 12px;">
                    <button onclick="backupModule.saveGasUrl()" 
                        style="width: 100%; padding: 14px; background: #34a853; color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600;">
                        💾 Simpan URL
                    </button>
                </div>
                
                ${hasUrl ? `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: #f0fff4; border-radius: 10px;">
                        <div>
                            <div style="font-weight: 600; color: #2d3748;">Auto Sync</div>
                            <div style="font-size: 12px; color: #718096; margin-top: 2px;">Sinkron otomatis tiap 3 menit</div>
                        </div>
                        <div onclick="backupModule.toggleAutoSync()" 
                            style="width: 50px; height: 28px; background: ${this.isAutoSyncEnabled ? '#48bb78' : '#cbd5e0'}; border-radius: 14px; position: relative; cursor: pointer; transition: all 0.3s;">
                            <div style="width: 24px; height: 24px; background: white; border-radius: 50%; position: absolute; top: 2px; ${this.isAutoSyncEnabled ? 'left: 24px' : 'left: 2px'}; transition: all 0.3s; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></div>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }
};

// ============================================
// AUTO INIT & EXPOSE
// ============================================

if (typeof dataManager !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            backupModule.init();
        });
    } else {
        backupModule.init();
    }
}

// Expose globally
window.backupModule = backupModule;

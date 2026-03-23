// ============================================
// BACKUP MODULE - HIFZI CELL (COMPLETE v3.3 FINAL)
// FIXED: Bypass fetch error, Complete data backup
// ============================================

const backupModule = {
    isInitialized: false,
    isRendered: false,
    currentProvider: 'local',
    isAutoSyncEnabled: false,
    isAutoSaveLocalEnabled: true,
    autoSyncInterval: null,
    lastSyncTime: null,
    isOnline: navigator.onLine,
    pendingSync: false,
    
    firebaseConfig: {},
    firebaseApp: null,
    database: null,
    auth: null,
    currentUser: null,
    firebaseBackupData: null,
    
    gasUrl: '',
    sheetId: '',
    
    // ✅ BYPASS: Tidak fetch dari external, pakai embedded code saja
    useEmbeddedGAS: true,
    
    deviceId: 'device_' + Date.now(),
    deviceName: navigator.userAgent.split(' ')[0],
    
    _firebaseAuthStateReady: false,
    _gasConfigValid: false,
    
    KEYS: {
        PROVIDER: 'hifzi_provider',
        GAS_URL: 'hifzi_gas_url',
        SHEET_ID: 'hifzi_sheet_id',
        AUTO_SYNC: 'hifzi_auto_sync',
        AUTO_SAVE_LOCAL: 'hifzi_auto_save_local',
        LAST_SYNC: 'hifzi_last_sync',
        FIREBASE_CONFIG: 'hifzi_firebase_config',
        DEVICE_ID: 'hifzi_device_id',
        FB_USER: 'hifzi_fb_user',
        FB_AUTH_EMAIL: 'hifzi_fb_auth_email',
        FB_AUTH_PASSWORD: 'hifzi_fb_auth_password',
        GAS_CODE_CACHE: 'hifzi_gas_code_cache',
        BACKUP_SETTINGS: 'hifzi_backup_settings'
    },

    init(forceReinit = false) {
        if (this.isInitialized && !forceReinit) {
            console.log('[Backup] Already initialized, skipping...');
            this.reloadAllConfig();
            return this;
        }

        console.log('[Backup] ========================================');
        console.log('[Backup] Initializing v3.3 FINAL...');
        console.log('[Backup] ========================================');
        
        this.loadBackupSettings();
        
        if (!localStorage.getItem(this.KEYS.DEVICE_ID)) {
            localStorage.setItem(this.KEYS.DEVICE_ID, this.deviceId);
            console.log('[Backup] New device ID created:', this.deviceId);
        } else {
            this.deviceId = localStorage.getItem(this.KEYS.DEVICE_ID);
            console.log('[Backup] Existing device ID:', this.deviceId);
        }
        
        const originalSheetId = this.sheetId;
        this.sheetId = this.cleanSheetId(this.sheetId);
        
        if (originalSheetId !== this.sheetId) {
            console.log('[Backup] Sheet ID cleaned');
            if (this.sheetId) {
                localStorage.setItem(this.KEYS.SHEET_ID, this.sheetId);
                this.saveBackupSettings();
            }
        }
        
        this._gasConfigValid = this.gasUrl && this.sheetId && this.sheetId.length === 44;
        
        console.log('[Backup] Provider:', this.currentProvider);
        console.log('[Backup] GAS Valid:', this._gasConfigValid);
        
        this.setupNetworkListeners();
        
        if (this.currentProvider === 'firebase') {
            this.initFirebase(true);
        } else if (this.currentProvider === 'googlesheet') {
            if (this._gasConfigValid) {
                this.checkNewDeviceGAS();
            }
        }

        if (this.isAutoSyncEnabled && this._gasConfigValid) {
            this.startAutoSync();
        }

        this.isInitialized = true;
        console.log('[Backup] Initialization complete');
        return this;
    },
    
    saveBackupSettings() {
        const settings = {
            provider: this.currentProvider,
            gasUrl: this.gasUrl,
            sheetId: this.sheetId,
            autoSync: this.isAutoSyncEnabled,
            firebaseConfig: this.firebaseConfig,
            lastSync: this.lastSyncTime,
            deviceId: this.deviceId,
            savedAt: new Date().toISOString()
        };
        localStorage.setItem(this.KEYS.BACKUP_SETTINGS, JSON.stringify(settings));
    },
    
    loadBackupSettings() {
        try {
            const saved = localStorage.getItem(this.KEYS.BACKUP_SETTINGS);
            if (saved) {
                const settings = JSON.parse(saved);
                this.currentProvider = settings.provider || 'local';
                this.gasUrl = settings.gasUrl || '';
                this.sheetId = settings.sheetId || '';
                this.isAutoSyncEnabled = settings.autoSync || false;
                this.firebaseConfig = settings.firebaseConfig || {};
                this.lastSyncTime = settings.lastSync || null;
                if (settings.deviceId) this.deviceId = settings.deviceId;
            } else {
                this.reloadAllConfig();
            }
        } catch (e) {
            this.reloadAllConfig();
        }
    },
    
    reloadAllConfig() {
        try {
            this.currentProvider = localStorage.getItem(this.KEYS.PROVIDER) || 'local';
            this.isAutoSyncEnabled = localStorage.getItem(this.KEYS.AUTO_SYNC) === 'true';
            this.lastSyncTime = localStorage.getItem(this.KEYS.LAST_SYNC);
            this.gasUrl = localStorage.getItem(this.KEYS.GAS_URL) || '';
            this.sheetId = localStorage.getItem(this.KEYS.SHEET_ID) || '';
            
            const fbConfig = localStorage.getItem(this.KEYS.FIREBASE_CONFIG);
            this.firebaseConfig = fbConfig ? JSON.parse(fbConfig) : {};
            
            const deviceId = localStorage.getItem(this.KEYS.DEVICE_ID);
            if (deviceId) this.deviceId = deviceId;
        } catch (e) {
            this.currentProvider = 'local';
            this.isAutoSyncEnabled = false;
        }
    },

    setupNetworkListeners() {
        window.removeEventListener('online', this.handleOnline);
        window.removeEventListener('offline', this.handleOffline);
        
        this.handleOnline = () => {
            this.isOnline = true;
            this.showToast('🌐 Online');
            if (this.pendingSync) this.manualUpload();
        };
        
        this.handleOffline = () => {
            this.isOnline = false;
            this.showToast('📴 Offline');
        };
        
        window.addEventListener('online', this.handleOnline);
        window.addEventListener('offline', this.handleOffline);
    },

    cleanSheetId(sheetId) {
        if (!sheetId) return '';
        if (typeof sheetId !== 'string') {
            try { sheetId = String(sheetId); } catch (e) { return ''; }
        }
        let cleaned = sheetId.replace(/\s/g, '').replace(/[^\x20-\x7E]/g, '').trim();
        if (cleaned === 'null' || cleaned === 'undefined') return '';
        return cleaned;
    },

    validateSheetId(sheetId) {
        const cleaned = this.cleanSheetId(sheetId);
        if (!cleaned) return { valid: false, message: 'Sheet ID kosong', cleaned: '' };
        if (cleaned.length !== 44) return { valid: false, message: 'Sheet ID harus 44 karakter', cleaned };
        if (!/^[a-zA-Z0-9_-]+$/.test(cleaned)) return { valid: false, message: 'Karakter tidak valid', cleaned };
        return { valid: true, cleaned, message: 'Valid (44 karakter)' };
    },

    // ✅ BYPASS FETCH - Langsung return embedded code
    async fetchGASCodeFromExternal(forceRefresh = false) {
        // Selalu gunakan embedded code, tidak fetch dari external
        console.log('[Backup] Using embedded GAS code (bypass fetch)');
        return { 
            success: true, 
            code: this.getDefaultGASCode(), 
            version: 'embedded-v3.3-final',
            fromCache: false 
        };
    },

    getBackupData() {
        // ✅ PASTIKAN ambil data lengkap dari dataManager
        let allData = {};
        
        if (typeof dataManager !== 'undefined') {
            if (dataManager.getAllData) {
                allData = dataManager.getAllData();
                console.log('[Backup] Data from getAllData:', Object.keys(allData));
            } else if (dataManager.data) {
                allData = dataManager.data;
                console.log('[Backup] Data from dataManager.data:', Object.keys(allData));
            }
        }
        
        // ✅ Log untuk debug
        console.log('[Backup] Products count:', (allData.products || []).length);
        console.log('[Backup] Transactions count:', (allData.transactions || []).length);
        
        return {
            products: allData.products || [],
            categories: allData.categories || [],
            transactions: allData.transactions || [],
            shifts: allData.shifts || [],
            debts: allData.debts || [],
            settings: allData.settings || {},
            cashHistory: allData.cashHistory || [],
            cashTransactions: allData.cashTransactions || [],
            dailyClosing: allData.dailyClosing || [],
            users: allData.users || [],
            loginHistory: allData.loginHistory || [],
            currentUser: allData.currentUser || null,
            _backupMeta: {
                version: '3.3-final',
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

    toggleAutoSync() {
        this.isAutoSyncEnabled = !this.isAutoSyncEnabled;
        localStorage.setItem(this.KEYS.AUTO_SYNC, this.isAutoSyncEnabled);
        this.saveBackupSettings();
        
        if (this.isAutoSyncEnabled) {
            if (this.currentProvider === 'googlesheet' && !this._gasConfigValid) {
                this.showToast('⚠️ Konfigurasi GAS tidak lengkap');
                this.isAutoSyncEnabled = false;
                localStorage.setItem(this.KEYS.AUTO_SYNC, 'false');
                this.render();
                return;
            }
            this.startAutoSync();
            this.syncToCloud(true);
            this.showToast('🟢 Auto-sync aktif');
        } else {
            this.stopAutoSync();
            this.showToast('⚪ Auto-sync dimatikan');
        }
        this.render();
    },

    startAutoSync() {
        this.stopAutoSync();
        if (!this.isAutoSyncEnabled || this.currentProvider === 'local') return;
        if (this.currentProvider === 'googlesheet' && !this._gasConfigValid) return;
        
        this.autoSyncInterval = setInterval(() => {
            console.log('[Backup] Auto-sync running...');
            this.syncToCloud(true);
        }, 180000);
    },

    stopAutoSync() {
        if (this.autoSyncInterval) {
            clearInterval(this.autoSyncInterval);
            this.autoSyncInterval = null;
        }
    },

    syncToCloud(silent = true) {
        if (this.currentProvider === 'googlesheet' && !this._gasConfigValid) return Promise.resolve();
        if (this.currentProvider === 'firebase' && !this.currentUser) return Promise.resolve();
        if (this.currentProvider === 'local') return Promise.resolve();
        
        const data = this.getBackupData();
        
        if (this.currentProvider === 'firebase' && this.currentUser) {
            return this.uploadToFirebase(data, silent);
        } else if (this.currentProvider === 'googlesheet') {
            return this.uploadToGAS(data, silent);
        }
        return Promise.resolve();
    },

    manualUpload() {
        console.log('[Backup] Manual upload...');
        const data = this.getBackupData();
        
        if (this.currentProvider === 'firebase') {
            if (!this.currentUser) {
                this.showToast('❌ Belum login Firebase');
                return Promise.reject('Not authenticated');
            }
            return this.uploadToFirebase(data, false);
        } else if (this.currentProvider === 'googlesheet') {
            if (!this._gasConfigValid) {
                this.showToast('❌ Konfigurasi tidak lengkap');
                return Promise.reject('GAS config invalid');
            }
            return this.uploadToGAS(data, false);
        } else {
            this.downloadJSON();
            return Promise.resolve();
        }
    },

    manualDownload() {
        console.log('[Backup] Manual download...');
        
        if (this.currentProvider === 'firebase') {
            if (!this.currentUser) {
                this.showToast('❌ Belum login Firebase');
                return Promise.reject('Not authenticated');
            }
            return this.downloadFromFirebase(false);
        } else if (this.currentProvider === 'googlesheet') {
            if (!this._gasConfigValid) {
                this.showToast('❌ Konfigurasi tidak lengkap');
                return Promise.reject('GAS config invalid');
            }
            return this.downloadFromGAS(false);
        } else {
            this.showToast('💾 Mode Local');
            return Promise.resolve();
        }
    },

    // ============================================
    // FIREBASE
    // ============================================

    initFirebase(attemptAutoLogin = false) {
        if (typeof firebase === 'undefined') {
            this.showToast('❌ Firebase SDK tidak ditemukan');
            return;
        }
        if (!this.firebaseConfig.apiKey) return;
        
        try {
            if (firebase.apps && firebase.apps.length) {
                firebase.apps.forEach(app => app.delete());
            }
            
            this.firebaseApp = firebase.initializeApp(this.firebaseConfig);
            this.database = firebase.database();
            this.auth = firebase.auth();
            
            this.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
            
            this.auth.onAuthStateChanged((user) => {
                this._firebaseAuthStateReady = true;
                if (user) {
                    this.currentUser = user;
                    localStorage.setItem(this.KEYS.FB_USER, JSON.stringify({
                        uid: user.uid, email: user.email, displayName: user.displayName || ''
                    }));
                    if (this.isAutoSyncEnabled) this.startAutoSync();
                    this.checkNewDeviceFirebase();
                } else {
                    this.currentUser = null;
                    if (attemptAutoLogin) this.attemptAutoLogin();
                }
                if (this.isRendered && this.currentProvider === 'firebase') this.render();
            });
        } catch (err) {
            this.showToast('❌ Error Firebase: ' + err.message);
        }
    },
    
    attemptAutoLogin() {
        const savedEmail = localStorage.getItem(this.KEYS.FB_AUTH_EMAIL);
        const savedPass = localStorage.getItem(this.KEYS.FB_AUTH_PASSWORD);
        if (savedEmail && savedPass && this.auth) {
            this.auth.signInWithEmailAndPassword(savedEmail, savedPass)
                .then(() => this.showToast('✅ Auto-login berhasil!'))
                .catch(() => {
                    localStorage.removeItem(this.KEYS.FB_AUTH_EMAIL);
                    localStorage.removeItem(this.KEYS.FB_AUTH_PASSWORD);
                });
        }
    },

    checkNewDeviceFirebase() {
        const hasLocalData = (typeof dataManager !== 'undefined' && dataManager.data) 
            ? (dataManager.data.products?.length > 0 || dataManager.data.transactions?.length > 0)
            : false;
        if (!hasLocalData && this.currentUser) {
            setTimeout(() => this.downloadFromFirebase(true), 1000);
        }
    },

    firebaseLogin(email, password) {
        if (!this.auth) return Promise.reject('Not ready');
        return this.auth.signInWithEmailAndPassword(email, password)
            .then((cred) => {
                this.currentUser = cred.user;
                localStorage.setItem(this.KEYS.FB_AUTH_EMAIL, email);
                localStorage.setItem(this.KEYS.FB_AUTH_PASSWORD, password);
                this.showToast('✅ Login berhasil!');
                this.render();
                return cred.user;
            })
            .catch((err) => {
                this.showToast('❌ ' + err.message);
                throw err;
            });
    },

    firebaseRegister(email, password) {
        if (!this.auth) return Promise.reject('Not ready');
        return this.auth.createUserWithEmailAndPassword(email, password)
            .then((cred) => {
                this.currentUser = cred.user;
                localStorage.setItem(this.KEYS.FB_AUTH_EMAIL, email);
                localStorage.setItem(this.KEYS.FB_AUTH_PASSWORD, password);
                this.showToast('✅ Daftar berhasil!');
                this.uploadToFirebase(this.getBackupData(), true);
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
            localStorage.removeItem(this.KEYS.FB_AUTH_EMAIL);
            localStorage.removeItem(this.KEYS.FB_AUTH_PASSWORD);
            this.stopAutoSync();
            this.firebaseBackupData = null;
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
        
        return this.database.ref('users/' + this.currentUser.uid + '/hifzi_data').set({
            ...data,
            _syncMeta: { lastModified: new Date().toISOString(), deviceId: this.deviceId, version: '3.3' }
        }).then(() => {
            this.lastSyncTime = new Date().toISOString();
            localStorage.setItem(this.KEYS.LAST_SYNC, this.lastSyncTime);
            this.saveBackupSettings();
            if (!silent) this.showToast('✅ Upload berhasil!');
            return true;
        }).catch((err) => {
            if (!silent) this.showToast('❌ Upload gagal: ' + err.message);
            throw err;
        });
    },

    downloadFromFirebase(silent = false, force = false) {
        if (!this.database || !this.currentUser) {
            if (!silent) this.showToast('❌ Belum login Firebase');
            return Promise.reject('Not authenticated');
        }
        if (!silent && !force) {
            if (!confirm('📥 Download akan mengganti data lokal. Lanjutkan?')) return Promise.resolve();
        }
        if (!silent) this.showToast('⬇️ Mengunduh dari Firebase...');
        
        return this.database.ref('users/' + this.currentUser.uid + '/hifzi_data').once('value')
            .then((snapshot) => {
                const cloudData = snapshot.val();
                if (cloudData) {
                    this.firebaseBackupData = cloudData;
                    this.saveBackupData(cloudData);
                    this.lastSyncTime = new Date().toISOString();
                    localStorage.setItem(this.KEYS.LAST_SYNC, this.lastSyncTime);
                    this.saveBackupSettings();
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

    showFirebaseExcelView() {
        if (!this.firebaseBackupData && this.currentUser) {
            this.showToast('⬇️ Mengambil data...');
            this.database.ref('users/' + this.currentUser.uid + '/hifzi_data').once('value')
                .then((snapshot) => {
                    this.firebaseBackupData = snapshot.val();
                    this.renderFirebaseExcelModal();
                });
        } else {
            this.renderFirebaseExcelModal();
        }
    },

    renderFirebaseExcelModal() {
        const data = this.firebaseBackupData;
        if (!data) {
            this.showToast('ℹ️ Tidak ada data');
            return;
        }

        const modal = document.createElement('div');
        modal.id = 'firebase-excel-modal';
        modal.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:10000;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;`;

        const tabs = [
            { id: 'products', label: '📦 Produk', data: data.products || [] },
            { id: 'transactions', label: '📝 Transaksi', data: data.transactions || [] },
            { id: 'cashTransactions', label: '💰 Cash Flow', data: data.cashTransactions || [] },
            { id: 'dailyClosing', label: '📊 Tutup Kas', data: data.dailyClosing || [] },
            { id: 'debts', label: '💳 Hutang', data: data.debts || [] },
            { id: 'users', label: '👥 Users', data: data.users || [] },
            { id: 'categories', label: '🏷️ Kategori', data: data.categories || [] },
            { id: 'shifts', label: '⏰ Shift', data: data.shifts || [] }
        ];

        const generateTable = (tabData) => {
            if (!tabData || tabData.length === 0) {
                return `<div style="text-align:center;padding:40px;color:#718096;"><div style="font-size:48px;margin-bottom:16px;">📭</div>Tidak ada data</div>`;
            }
            const keys = Object.keys(tabData[0]).filter(k => !k.startsWith('_'));
            const headerStyle = 'background:#ff6b35;color:white;padding:12px;text-align:left;font-weight:600;font-size:12px;position:sticky;top:0;';
            const cellStyle = 'padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
            
            const rows = tabData.map((row, idx) => {
                const cells = keys.map(key => {
                    let value = row[key];
                    if (typeof value === 'object') value = JSON.stringify(value);
                    if (key.toLowerCase().includes('price') || key.toLowerCase().includes('amount')) {
                        value = typeof value === 'number' ? 'Rp ' + value.toLocaleString('id-ID') : value;
                    }
                    return `<td style="${cellStyle} ${idx % 2 === 0 ? 'background:white;' : 'background:#f7fafc;'}">${value || '-'}</td>`;
                }).join('');
                return `<tr>${cells}</tr>`;
            }).join('');

            const headers = keys.map(key => `<th style="${headerStyle}">${key.replace(/_/g, ' ').toUpperCase()}</th>`).join('');

            return `<div style="overflow-x:auto;border-radius:8px;border:1px solid #e2e8f0;"><table style="width:100%;border-collapse:collapse;font-family:'Segoe UI',sans-serif;"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table></div>`;
        };

        const tabButtons = tabs.map(tab => `
            <button onclick="backupModule.switchExcelTab('${tab.id}')" id="tab-btn-${tab.id}" style="padding:10px 16px;border:none;background:#fed7d7;color:#c53030;border-radius:8px;cursor:pointer;font-weight:600;font-size:13px;white-space:nowrap;">${tab.label} (${tab.data.length})</button>
        `).join('');

        const tabContents = tabs.map(tab => `
            <div id="tab-content-${tab.id}" style="display:none;">${generateTable(tab.data)}</div>
        `).join('');

        modal.innerHTML = `
            <div style="background:white;border-radius:16px;width:100%;max-width:1200px;max-height:90vh;overflow:hidden;display:flex;flex-direction:column;margin-top:20px;">
                <div style="padding:20px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;background:linear-gradient(135deg,#ff6b35 0%,#ff8c42 100%);color:white;">
                    <div>
                        <div style="font-size:20px;font-weight:700;">🔥 Data Firebase</div>
                        <div style="font-size:13px;opacity:0.9;margin-top:4px;">${this.currentUser?.email || 'Not logged in'}</div>
                    </div>
                    <div style="display:flex;gap:8px;">
                        <button onclick="backupModule.downloadFirebaseAsExcel()" style="padding:10px 16px;background:white;color:#ff6b35;border:none;border-radius:8px;cursor:pointer;font-weight:600;font-size:13px;">📥 Download Excel</button>
                        <button onclick="document.getElementById('firebase-excel-modal').remove()" style="padding:10px 16px;background:rgba(255,255,255,0.2);color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;font-size:13px;">✕ Tutup</button>
                    </div>
                </div>
                <div style="padding:16px;background:#fff5f5;border-bottom:1px solid #fed7d7;">
                    <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;">${tabButtons}</div>
                </div>
                <div style="padding:20px;overflow-y:auto;flex:1;">${tabContents}</div>
            </div>
        `;

        document.body.appendChild(modal);
        const firstTabWithData = tabs.find(t => t.data.length > 0) || tabs[0];
        this.switchExcelTab(firstTabWithData.id);
    },

    switchExcelTab(tabId) {
        document.querySelectorAll('[id^="tab-content-"]').forEach(el => el.style.display = 'none');
        document.querySelectorAll('[id^="tab-btn-"]').forEach(el => {
            el.style.background = '#fed7d7'; el.style.color = '#c53030';
        });
        const content = document.getElementById(`tab-content-${tabId}`);
        const btn = document.getElementById(`tab-btn-${tabId}`);
        if (content) content.style.display = 'block';
        if (btn) { btn.style.background = '#ff6b35'; btn.style.color = 'white'; }
    },

    downloadFirebaseAsExcel() {
        if (!this.firebaseBackupData) return;
        const data = this.firebaseBackupData;
        const wb = XLSX.utils.book_new();
        
        const sheets = [
            { name: 'Produk', data: data.products || [] },
            { name: 'Transaksi', data: data.transactions || [] },
            { name: 'CashTrans', data: data.cashTransactions || [] },
            { name: 'TutupKas', data: data.dailyClosing || [] },
            { name: 'Hutang', data: data.debts || [] },
            { name: 'Users', data: data.users || [] },
            { name: 'Kategori', data: data.categories || [] },
            { name: 'Shift', data: data.shifts || [] }
        ];
        
        sheets.forEach(sheet => {
            if (sheet.data.length > 0) {
                const ws = XLSX.utils.json_to_sheet(sheet.data);
                XLSX.utils.book_append_sheet(wb, ws, sheet.name);
            }
        });
        
        XLSX.writeFile(wb, `firebase_backup_${new Date().toISOString().split('T')[0]}.xlsx`);
        this.showToast('✅ File Excel didownload!');
    },

    // ============================================
    // GOOGLE SHEETS
    // ============================================

    checkNewDeviceGAS() {
        const hasLocalData = (typeof dataManager !== 'undefined' && dataManager.data) 
            ? dataManager.data.products?.length > 0 
            : false;
        if (!hasLocalData && this.gasUrl && this._gasConfigValid) {
            setTimeout(() => this.downloadFromGAS(true), 1000);
        }
        if (this.isAutoSyncEnabled && this._gasConfigValid) {
            this.startAutoSync();
        }
    },

    testGASConnection() {
        if (!this.gasUrl) {
            this.showToast('❌ URL GAS belum diisi');
            return Promise.reject('No URL');
        }
        const cleanSheetId = this.cleanSheetId(this.sheetId);
        if (!cleanSheetId) {
            this.showToast('⚠️ Sheet ID kosong');
            return Promise.reject('Sheet ID empty');
        }

        this.showToast('🧪 Testing koneksi...');
        
        return fetch(this.gasUrl, {
            method: 'POST',
            mode: 'cors',
            cache: 'no-cache',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'test', deviceId: this.deviceId, sheetId: cleanSheetId })
        })
        .then(async (r) => {
            const text = await r.text();
            try { return JSON.parse(text); } catch (e) { throw new Error('Invalid JSON: ' + text.substring(0, 100)); }
        })
        .then(result => {
            if (result?.success) {
                this.showToast('✅ ' + (result.message || 'Koneksi berhasil!'));
                return result;
            } else {
                throw new Error(result?.message || 'Test failed');
            }
        })
        .catch((err) => {
            this.showToast('❌ Koneksi gagal: ' + err.message);
            throw err;
        });
    },

    uploadToGAS(data, silent = false) {
        if (!this.gasUrl) {
            if (!silent) this.showToast('❌ URL GAS belum diisi');
            return Promise.reject('No URL');
        }
        
        const cleanSheetId = this.cleanSheetId(this.sheetId);
        if (!cleanSheetId) {
            if (!silent) this.showToast('⚠️ Sheet ID kosong');
            return Promise.reject('Sheet ID empty');
        }
        
        // ✅ PENTING: Pastikan data lengkap
        console.log('[Backup] Uploading data:', {
            products: (data.products || []).length,
            transactions: (data.transactions || []).length,
            categories: (data.categories || []).length
        });
        
        if (!silent) this.showToast('⬆️ Uploading...');
        
        const payload = {
            action: 'sync',
            data: data, // ✅ Kirim seluruh data object
            deviceId: this.deviceId,
            deviceName: this.deviceName,
            sheetId: cleanSheetId,
            timestamp: new Date().toISOString()
        };

        return fetch(this.gasUrl, {
            method: 'POST',
            mode: 'cors',
            cache: 'no-cache',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        })
        .then(async (r) => {
            const text = await r.text();
            console.log('[Backup] Upload response:', text.substring(0, 200));
            try { return JSON.parse(text); } catch (e) { throw new Error('Invalid JSON: ' + text.substring(0, 100)); }
        })
        .then(result => {
            if (result?.success) {
                this.lastSyncTime = new Date().toISOString();
                localStorage.setItem(this.KEYS.LAST_SYNC, this.lastSyncTime);
                this.saveBackupSettings();
                if (!silent) this.showToast('✅ Upload berhasil!');
                this.pendingSync = false;
                return result;
            } else {
                throw new Error(result?.message || 'Upload failed');
            }
        })
        .catch((err) => {
            console.error('[GAS Upload Error]', err);
            this.pendingSync = true;
            if (!silent) this.showToast('❌ Upload gagal: ' + err.message);
            throw err;
        });
    },

    downloadFromGAS(silent = false, force = false) {
        if (!this.gasUrl) {
            if (!silent) this.showToast('❌ URL GAS belum diisi');
            return Promise.reject('No URL');
        }
        
        const cleanSheetId = this.cleanSheetId(this.sheetId);
        if (!cleanSheetId) {
            if (!silent) this.showToast('⚠️ Sheet ID kosong');
            return Promise.reject('Sheet ID empty');
        }
        
        if (!silent && !force) {
            if (!confirm('📥 Download akan mengganti data lokal. Lanjutkan?')) return Promise.resolve();
        }
        
        if (!silent) this.showToast('⬇️ Downloading...');

        const payload = {
            action: 'restore',
            sheetId: cleanSheetId,
            deviceId: this.deviceId,
            timestamp: new Date().toISOString()
        };

        console.log('[Backup] Download payload:', JSON.stringify(payload));

        return fetch(this.gasUrl, {
            method: 'POST',
            mode: 'cors',
            cache: 'no-cache',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        })
        .then(async (r) => {
            console.log('[Backup] Download status:', r.status);
            const text = await r.text();
            console.log('[Backup] Download response:', text.substring(0, 500));
            
            if (!r.ok) throw new Error('HTTP ' + r.status);
            
            try {
                return JSON.parse(text);
            } catch (e) {
                throw new Error('Invalid JSON: ' + text.substring(0, 200));
            }
        })
        .then(result => {
            console.log('[Backup] Download result:', result);
            
            if (result?.success && result.data) {
                // ✅ Validasi data
                if (typeof result.data !== 'object') {
                    throw new Error('Data format invalid');
                }
                
                console.log('[Backup] Restored data:', {
                    products: (result.data.products || []).length,
                    transactions: (result.data.transactions || []).length
                });
                
                this.saveBackupData(result.data);
                this.lastSyncTime = new Date().toISOString();
                localStorage.setItem(this.KEYS.LAST_SYNC, this.lastSyncTime);
                this.saveBackupSettings();
                
                if (!silent) {
                    this.showToast('✅ Download berhasil! Reload...');
                    setTimeout(() => location.reload(), 1500);
                }
                return result;
            } else {
                throw new Error(result?.message || 'No data received');
            }
        })
        .catch((err) => {
            console.error('[GAS Download Error]', err);
            if (!silent) this.showToast('❌ Download gagal: ' + err.message);
            throw err;
        });
    },

    // ============================================
    // GAS CODE GENERATOR - BYPASS FETCH
    // ============================================

    async showGASGenerator() {
        // ✅ Langsung gunakan embedded code, tidak fetch
        const gasCode = this.getDefaultGASCode();
        
        const modal = document.createElement('div');
        modal.id = 'gas-generator-modal';
        modal.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;`;
        
        modal.innerHTML = `
            <div style="background:white;border-radius:16px;max-width:900px;width:100%;max-height:90vh;overflow:hidden;display:flex;flex-direction:column;">
                <div style="padding:20px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;background:linear-gradient(135deg,#34a853 0%,#0f9d58 100%);color:white;">
                    <div>
                        <div style="font-size:18px;font-weight:700;">📋 Google Apps Script Code</div>
                        <div style="font-size:13px;opacity:0.9;margin-top:4px;">v3.3 Final - Copy ke script.google.com</div>
                    </div>
                    <button onclick="document.getElementById('gas-generator-modal').remove()" style="background:none;border:none;font-size:24px;cursor:pointer;color:white;">×</button>
                </div>
                
                <div style="padding:20px;overflow-y:auto;flex:1;">
                    <div style="background:#ebf8ff;border:1px solid #90cdf4;border-radius:8px;padding:12px;margin-bottom:16px;">
                        <div style="font-size:12px;color:#2c5282;">
                            <strong>🚀 Cara Setup:</strong>
                            <ol style="margin:8px 0;padding-left:20px;line-height:1.8;">
                                <li>Buka <a href="https://script.google.com" target="_blank" style="color:#2b6cb0;font-weight:600;">script.google.com</a></li>
                                <li>Klik "New Project"</li>
                                <li>Hapus semua code default</li>
                                <li>Copy code di bawah, paste ke editor</li>
                                <li>Klik "Deploy" → "New Deployment"</li>
                                <li>Pilih "Web app", Access: "Anyone"</li>
                                <li>Copy URL deployment ke field di atas</li>
                            </ol>
                        </div>
                    </div>
                    
                    <div style="position:relative;">
                        <textarea id="gas-code-textarea" style="width:100%;height:400px;font-family:'Consolas',monospace;font-size:12px;padding:16px;border:1px solid #e2e8f0;border-radius:8px;resize:none;background:#1a202c;color:#68d391;line-height:1.5;" readonly>${gasCode}</textarea>
                        <button onclick="backupModule.copyGASCode()" style="position:absolute;top:12px;right:12px;padding:8px 16px;background:#34a853;color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;">📋 Copy</button>
                    </div>
                </div>
                
                <div style="padding:20px;border-top:1px solid #e2e8f0;background:#f7fafc;display:flex;gap:12px;">
                    <button onclick="backupModule.downloadGASCode()" style="flex:1;padding:14px;background:#4299e1;color:white;border:none;border-radius:10px;cursor:pointer;font-weight:600;">⬇️ Download .gs</button>
                    <button onclick="document.getElementById('gas-generator-modal').remove()" style="flex:1;padding:14px;background:#4a5568;color:white;border:none;border-radius:10px;cursor:pointer;font-weight:600;">Tutup</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    },

    copyGASCode() {
        const textarea = document.getElementById('gas-code-textarea');
        if (textarea) {
            textarea.select();
            document.execCommand('copy');
            this.showToast('✅ Code dicopy!');
        }
    },

    downloadGASCode() {
        const textarea = document.getElementById('gas-code-textarea');
        if (!textarea) return;
        
        const blob = new Blob([textarea.value], { type: 'text/javascript' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `hifzi_gas_v3.3.gs`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.showToast('✅ File didownload!');
    },

    // ============================================
    // EMBEDDED GAS CODE - LENGKAP
    // ============================================
    getDefaultGASCode() {
        return `// GAS CODE v3.3 FINAL - HIFZI CELL BACKUP
// Paste di script.google.com, Deploy as Web App, Access: Anyone

function doPost(e) {
  try {
    if (!e.postData || !e.postData.contents) {
      return jsonResponse({ success: false, message: 'No post data' });
    }
    
    var data = JSON.parse(e.postData.contents);
    var action = data.action || 'sync';
    var sheetId = data.sheetId || '';
    
    // Validasi Sheet ID
    if (!sheetId || sheetId.length !== 44) {
      return jsonResponse({ success: false, message: 'Sheet ID invalid (must be 44 chars)' });
    }
    
    var ss;
    try {
      ss = SpreadsheetApp.openById(sheetId);
    } catch (err) {
      return jsonResponse({ success: false, message: 'Cannot open spreadsheet: ' + err.toString() });
    }
    
    if (action === 'test') {
      return jsonResponse({ 
        success: true, 
        message: 'Connected to: ' + ss.getName(),
        sheetName: ss.getName()
      });
    }
    
    if (action === 'sync') {
      return handleSync(ss, data);
    }
    
    if (action === 'restore') {
      return handleRestore(ss);
    }
    
    return jsonResponse({ success: false, message: 'Unknown action: ' + action });
    
  } catch (err) {
    return jsonResponse({ success: false, message: 'Error: ' + err.toString() });
  }
}

function handleSync(ss, data) {
  try {
    // Get or create Backup sheet
    var sheet = ss.getSheetByName('Backup');
    if (!sheet) {
      sheet = ss.insertSheet('Backup');
    }
    
    // Clear sheet
    sheet.clear();
    
    // Row 1: Metadata header
    sheet.getRange(1, 1).setValue('HIFZI_BACKUP_DATA');
    sheet.getRange(1, 2).setValue(new Date().toISOString());
    sheet.getRange(1, 3).setValue(data.deviceId || 'unknown');
    sheet.getRange(1, 4).setValue(data.deviceName || 'unknown');
    
    // Row 2: Empty (spacer)
    
    // Row 3: Actual JSON data
    var jsonString = JSON.stringify(data.data);
    sheet.getRange(3, 1).setValue(jsonString);
    
    // Auto resize
    sheet.autoResizeColumn(1);
    
    // Log sync
    logSync(ss, data, 'upload');
    
    return jsonResponse({ 
      success: true, 
      message: 'Data synced successfully',
      sheetName: ss.getName(),
      dataSize: jsonString.length
    });
    
  } catch (err) {
    return jsonResponse({ success: false, message: 'Sync error: ' + err.toString() });
  }
}

function handleRestore(ss) {
  try {
    var sheet = ss.getSheetByName('Backup');
    if (!sheet) {
      return jsonResponse({ success: false, message: 'Backup sheet not found. Please upload first.' });
    }
    
    // Get JSON from row 3, column 1
    var jsonData = sheet.getRange(3, 1).getValue();
    
    if (!jsonData || jsonData === '') {
      return jsonResponse({ success: false, message: 'No data in backup sheet' });
    }
    
    // Parse JSON
    var parsedData;
    try {
      parsedData = JSON.parse(jsonData);
    } catch (e) {
      return jsonResponse({ success: false, message: 'Data corrupted: ' + e.toString() });
    }
    
    // Log restore
    logSync(ss, { deviceId: 'restore', deviceName: 'restore' }, 'download');
    
    return jsonResponse({ 
      success: true, 
      data: parsedData,
      message: 'Data restored successfully',
      restoredAt: new Date().toISOString()
    });
    
  } catch (err) {
    return jsonResponse({ success: false, message: 'Restore error: ' + err.toString() });
  }
}

function logSync(ss, data, type) {
  try {
    var logSheet = ss.getSheetByName('SyncLog');
    if (!logSheet) {
      logSheet = ss.insertSheet('SyncLog');
      logSheet.appendRow(['Timestamp', 'Type', 'Device ID', 'Device Name', 'Status']);
    }
    logSheet.appendRow([
      new Date().toISOString(),
      type,
      data.deviceId || 'unknown',
      data.deviceName || 'unknown',
      'success'
    ]);
  } catch (e) {
    // Silent fail for logging
  }
}

function jsonResponse(data) {
  var output = ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  
  output.setHeaders({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  
  return output;
}

// For backward compatibility
function doGet(e) {
  return jsonResponse({ 
    success: true, 
    message: 'Hifzi Backup API v3.3 - Use POST method' 
  });
}`;
    },

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
                this.saveBackupData(data);
                this.showToast('✅ Import berhasil! Reload...');
                setTimeout(() => location.reload(), 1500);
            } catch (err) {
                this.showToast('❌ Error: ' + err.message);
            }
        };
        reader.readAsText(file);
        input.value = '';
    },

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
            this.showToast('✅ Riwayat dihapus');
            this.render();
        }
    },

    setProvider(provider) {
        this.currentProvider = provider;
        localStorage.setItem(this.KEYS.PROVIDER, provider);
        this.saveBackupSettings();
        this.stopAutoSync();
        this.firebaseBackupData = null;
        
        if (provider === 'firebase') {
            this.initFirebase(true);
        } else if (provider === 'googlesheet') {
            this._gasConfigValid = this.gasUrl && this.sheetId && this.sheetId.length === 44;
            if (this._gasConfigValid) this.checkNewDeviceGAS();
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
        this.saveBackupSettings();
        this.showToast('✅ Config Firebase disimpan!');
        this.initFirebase(true);
        this.render();
    },

    saveGasUrl() {
        const url = document.getElementById('gasUrlInput')?.value?.trim();
        const sheetIdInput = document.getElementById('sheetIdInput')?.value || '';
        
        const validation = this.validateSheetId(sheetIdInput);
        if (!validation.valid) {
            this.showToast('⚠️ ' + validation.message);
        }
        
        if (!url || !url.includes('script.google.com')) {
            this.showToast('❌ URL GAS tidak valid');
            return;
        }
        
        this.gasUrl = url;
        this.sheetId = validation.cleaned;
        localStorage.setItem(this.KEYS.GAS_URL, url);
        localStorage.setItem(this.KEYS.SHEET_ID, validation.cleaned);
        
        this._gasConfigValid = url && validation.cleaned && validation.cleaned.length === 44;
        this.saveBackupSettings();
        
        this.showToast(this.sheetId ? '✅ Konfigurasi disimpan!' : '✅ Disimpan (tapi Sheet ID invalid)');
        
        if (this.currentProvider === 'googlesheet' && this._gasConfigValid) {
            this.checkNewDeviceGAS();
        }
        this.render();
    },

    resetLocal() {
        if (!confirm('⚠️ Hapus SEMUA data lokal?')) return;
        if (prompt('Ketik HAPUS untuk konfirmasi:') !== 'HAPUS') return;
        
        this.saveBackupSettings();
        const telegramBackup = (typeof dataManager !== 'undefined' && dataManager.data) 
            ? dataManager.data.telegram 
            : {};
        
        localStorage.removeItem('hifzi_data');
        
        setTimeout(() => this.loadBackupSettings(), 100);
        
        if (telegramBackup && typeof dataManager !== 'undefined' && dataManager.data) {
            dataManager.data.telegram = telegramBackup;
            if (dataManager.saveData) dataManager.saveData();
        }
        
        this.showToast('✅ Data dihapus! Reload...');
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
                .then(() => {
                    this.firebaseBackupData = null;
                    this.showToast('✅ Firebase direset!');
                });
        } else if (this.currentProvider === 'googlesheet') {
            if (!this.gasUrl) {
                this.showToast('❌ URL GAS belum diisi');
                return;
            }
            if (!confirm('⚠️ Reset data di Google Sheets?')) return;
            
            const cleanSheetId = this.cleanSheetId(this.sheetId);
            if (!cleanSheetId) {
                this.showToast('❌ Sheet ID kosong');
                return;
            }
            
            fetch(this.gasUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ action: 'reset', sheetId: cleanSheetId })
            })
            .then(r => r.json())
            .then(result => {
                this.showToast(result.success ? '✅ GAS direset!' : '❌ Gagal: ' + result.message);
            })
            .catch(err => this.showToast('❌ Error: ' + err.message));
        }
    },

    showToast(msg) {
        if (typeof app !== 'undefined' && app.showToast) {
            app.showToast(msg);
        } else {
            const existing = document.querySelector('.backup-toast');
            if (existing) existing.remove();
            
            const toast = document.createElement('div');
            toast.className = 'backup-toast';
            toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.85);color:white;padding:12px 24px;border-radius:8px;z-index:9999;font-size:14px;';
            toast.textContent = msg;
            document.body.appendChild(toast);
            setTimeout(() => {
                toast.style.opacity = '0';
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }
    },

    render() {
        if (!this.isInitialized) {
            this.init();
        } else {
            this.reloadAllConfig();
            this._gasConfigValid = this.gasUrl && this.sheetId && this.sheetId.length === 44;
        }

        const container = document.getElementById('mainContent');
        if (!container) {
            setTimeout(() => this.render(), 100);
            return;
        }

        this.isRendered = true;
        
        const isFirebase = this.currentProvider === 'firebase';
        const isGAS = this.currentProvider === 'googlesheet';
        const isLocal = this.currentProvider === 'local';
        const isFBConfigured = !!this.firebaseConfig.apiKey;
        const isFBLoggedIn = !!this.currentUser;
        const isGASConfigured = this._gasConfigValid;

        const data = (typeof dataManager !== 'undefined') ? dataManager.data : {};
        const stats = {
            products: data.products?.length || 0,
            transactions: data.transactions?.length || 0,
            cashTransactions: data.cashTransactions?.length || 0,
            debts: data.debts?.length || 0,
            cash: data.settings?.currentCash || 0
        };

        const loginHistory = this.getLoginHistory();

        const html = `
            <div class="backup-container" style="padding:20px;max-width:900px;margin:0 auto;font-family:system-ui,-apple-system,sans-serif;">
                
                <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:20px;border-radius:16px;margin-bottom:20px;box-shadow:0 4px 15px rgba(0,0,0,0.1);">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <div>
                            <div style="font-size:12px;opacity:0.9;margin-bottom:4px;">Provider Aktif</div>
                            <div style="font-size:24px;font-weight:700;">${isLocal ? '💾 Local' : isFirebase ? '🔥 Firebase' : '📊 Google Sheets'}</div>
                            <div style="font-size:13px;margin-top:8px;opacity:0.9;">
                                ${this.isOnline ? '🟢 Online' : '🔴 Offline'} 
                                ${this.isAutoSyncEnabled ? '• Auto-sync ON' : ''}
                                ${isGAS && !isGASConfigured ? '• ⚠️ Config Invalid' : ''}
                            </div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:12px;opacity:0.9;margin-bottom:4px;">Last Sync</div>
                            <div style="font-size:18px;font-weight:600;">
                                ${this.lastSyncTime ? new Date(this.lastSyncTime).toLocaleString('id-ID',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : 'Belum'}
                            </div>
                        </div>
                    </div>
                </div>

                <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:24px;">
                    <div style="background:white;padding:16px;border-radius:12px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
                        <div style="font-size:28px;margin-bottom:4px;">📦</div>
                        <div style="font-size:12px;color:#718096;">Produk</div>
                        <div style="font-size:20px;font-weight:700;color:#2d3748;">${stats.products}</div>
                    </div>
                    <div style="background:white;padding:16px;border-radius:12px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
                        <div style="font-size:28px;margin-bottom:4px;">📝</div>
                        <div style="font-size:12px;color:#718096;">Transaksi</div>
                        <div style="font-size:20px;font-weight:700;color:#2d3748;">${stats.transactions}</div>
                    </div>
                    <div style="background:white;padding:16px;border-radius:12px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
                        <div style="font-size:28px;margin-bottom:4px;">💸</div>
                        <div style="font-size:12px;color:#718096;">Cash Flow</div>
                        <div style="font-size:20px;font-weight:700;color:#2d3748;">${stats.cashTransactions}</div>
                    </div>
                    <div style="background:white;padding:16px;border-radius:12px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
                        <div style="font-size:28px;margin-bottom:4px;">💳</div>
                        <div style="font-size:12px;color:#718096;">Hutang</div>
                        <div style="font-size:20px;font-weight:700;color:#2d3748;">${stats.debts}</div>
                    </div>
                    <div style="background:white;padding:16px;border-radius:12px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
                        <div style="font-size:28px;margin-bottom:4px;">💰</div>
                        <div style="font-size:12px;color:#718096;">Kas</div>
                        <div style="font-size:16px;font-weight:700;color:#2d3748;">Rp ${stats.cash.toLocaleString('id-ID')}</div>
                    </div>
                </div>

                <div style="background:white;padding:20px;border-radius:12px;margin-bottom:20px;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
                    <div style="font-size:16px;font-weight:600;margin-bottom:16px;color:#2d3748;">☁️ Pilih Metode Backup</div>
                    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
                        <button onclick="backupModule.setProvider('local')" style="padding:16px;border:2px solid ${isLocal ? '#667eea' : '#e2e8f0'};border-radius:12px;background:${isLocal ? '#f7fafc' : 'white'};cursor:pointer;">
                            <div style="font-size:32px;margin-bottom:8px;">💾</div>
                            <div style="font-weight:600;color:#2d3748;">Local File</div>
                            <div style="font-size:12px;color:#718096;margin-top:4px;">Simpan di device</div>
                        </button>
                        <button onclick="backupModule.setProvider('firebase')" style="padding:16px;border:2px solid ${isFirebase ? '#ff6b35' : '#e2e8f0'};border-radius:12px;background:${isFirebase ? '#fff5f0' : 'white'};cursor:pointer;">
                            <div style="font-size:32px;margin-bottom:8px;">🔥</div>
                            <div style="font-weight:600;color:#2d3748;">Firebase</div>
                            <div style="font-size:12px;color:#718096;margin-top:4px;">${isFBLoggedIn ? '✅ Connected' : 'Real-time sync'}</div>
                        </button>
                        <button onclick="backupModule.setProvider('googlesheet')" style="padding:16px;border:2px solid ${isGAS ? '#34a853' : '#e2e8f0'};border-radius:12px;background:${isGAS ? '#f0fff4' : 'white'};cursor:pointer;">
                            <div style="font-size:32px;margin-bottom:8px;">📊</div>
                            <div style="font-weight:600;color:#2d3748;">Google Sheets</div>
                            <div style="font-size:12px;color:#718096;margin-top:4px;">${isGASConfigured ? '✅ Configured' : 'Setup Required'}</div>
                        </button>
                    </div>
                </div>

                ${isFirebase ? this.renderFirebaseSection(isFBConfigured, isFBLoggedIn) : ''}
                ${isGAS ? this.renderGASSection(isGASConfigured) : ''}

                <div style="background:white;padding:20px;border-radius:12px;margin-bottom:20px;box-shadow:0 2px 8px rgba(0,0,0,0.05);border:2px solid ${(isFirebase && !isFBLoggedIn) || (isGAS && !isGASConfigured) ? '#fc8181' : '#667eea'};">
                    <div style="font-size:16px;font-weight:600;margin-bottom:16px;color:#2d3748;">🔄 Sinkronisasi Manual</div>
                    
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
                        <button onclick="backupModule.manualUpload()" 
                            style="padding:16px;background:${(isFirebase && !isFBLoggedIn) || (isGAS && !isGASConfigured) ? '#cbd5e0' : 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)'};color:white;border:none;border-radius:10px;cursor:${(isFirebase && !isFBLoggedIn) || (isGAS && !isGASConfigured) ? 'not-allowed' : 'pointer'};font-weight:600;opacity:${(isFirebase && !isFBLoggedIn) || (isGAS && !isGASConfigured) ? '0.6' : '1'};"
                            ${(isFirebase && !isFBLoggedIn) || (isGAS && !isGASConfigured) ? 'disabled' : ''}>
                            <div>⬆️ Upload ke Cloud</div>
                            <div style="font-size:11px;opacity:0.9;font-weight:normal;">Kirim data ke ${isLocal ? 'JSON' : isFirebase ? 'Firebase' : 'Sheets'}</div>
                        </button>
                        <button onclick="backupModule.manualDownload()" 
                            style="padding:16px;background:${(isFirebase && !isFBLoggedIn) || (isGAS && !isGASConfigured) ? '#cbd5e0' : 'linear-gradient(135deg,#48bb78 0%,#38a169 100%)'};color:white;border:none;border-radius:10px;cursor:${(isFirebase && !isFBLoggedIn) || (isGAS && !isGASConfigured) ? 'not-allowed' : 'pointer'};font-weight:600;opacity:${(isFirebase && !isFBLoggedIn) || (isGAS && !isGASConfigured) ? '0.6' : '1'};"
                            ${(isFirebase && !isFBLoggedIn) || (isGAS && !isGASConfigured) ? 'disabled' : ''}>
                            <div>⬇️ Download dari Cloud</div>
                            <div style="font-size:11px;opacity:0.9;font-weight:normal;">Ambil data untuk device ini</div>
                        </button>
                    </div>
                    
                    ${this.pendingSync ? `
                        <div style="background:#fffaf0;border-left:4px solid #ed8936;padding:12px;border-radius:6px;font-size:13px;color:#c05621;margin-bottom:12px;">
                            <strong>⚠️ Sync Pending:</strong> Auto-sync gagal. Klik Upload Manual.
                        </div>
                    ` : ''}
                </div>

                <div style="background:white;padding:20px;border-radius:12px;margin-bottom:20px;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
                    <div style="font-size:16px;font-weight:600;margin-bottom:16px;color:#2d3748;">📁 Backup File Lokal (JSON)</div>
                    <button onclick="backupModule.downloadJSON()" style="width:100%;padding:14px;background:#4a5568;color:white;border:none;border-radius:10px;cursor:pointer;font-weight:600;margin-bottom:12px;">⬇️ Download JSON</button>
                    <label style="display:block;padding:24px;border:2px dashed #cbd5e0;border-radius:10px;text-align:center;cursor:pointer;" onmouseover="this.style.borderColor='#667eea'" onmouseout="this.style.borderColor='#cbd5e0'">
                        <input type="file" accept=".json" onchange="backupModule.importJSON(this)" style="display:none;">
                        <div style="font-size:40px;margin-bottom:8px;">📤</div>
                        <div style="font-weight:600;color:#2d3748;">Import JSON</div>
                    </label>
                </div>

                <div style="background:#fff5f5;border:1px solid #feb2b2;padding:20px;border-radius:12px;">
                    <div style="font-size:16px;font-weight:600;margin-bottom:16px;color:#c53030;">🗑️ Zona Bahaya</div>
                    <button onclick="backupModule.resetLocal()" style="width:100%;padding:14px;background:#fc8181;color:white;border:none;border-radius:10px;cursor:pointer;font-weight:600;margin-bottom:8px;">🗑️ Hapus Data Lokal</button>
                    ${!isLocal ? `<button onclick="backupModule.resetCloud()" style="width:100%;padding:14px;background:#f6ad55;color:white;border:none;border-radius:10px;cursor:pointer;font-weight:600;">☁️ Reset Cloud</button>` : ''}
                </div>

            </div>
        `;

        container.innerHTML = html;
    },

    renderFirebaseSection(isConfigured, isLoggedIn) {
        if (!isConfigured) {
            return `
                <div style="background:white;padding:20px;border-radius:12px;margin-bottom:20px;box-shadow:0 2px 8px rgba(0,0,0,0.05);border:2px solid #ff6b35;">
                    <div style="font-size:16px;font-weight:600;margin-bottom:16px;color:#2d3748;">🔥 Konfigurasi Firebase</div>
                    <div style="display:grid;gap:12px;margin-bottom:16px;">
                        <input type="text" id="fb_apiKey" placeholder="API Key *" style="padding:12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;">
                        <input type="text" id="fb_authDomain" placeholder="Auth Domain *" style="padding:12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;">
                        <input type="text" id="fb_databaseURL" placeholder="Database URL *" style="padding:12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;">
                        <input type="text" id="fb_projectId" placeholder="Project ID" style="padding:12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;">
                    </div>
                    <button onclick="backupModule.saveFirebaseConfig()" style="width:100%;padding:14px;background:#ff6b35;color:white;border:none;border-radius:10px;cursor:pointer;font-weight:600;">💾 Simpan & Connect</button>
                </div>
            `;
        }
        
        if (!isLoggedIn) {
            return `
                <div style="background:white;padding:20px;border-radius:12px;margin-bottom:20px;box-shadow:0 2px 8px rgba(0,0,0,0.05);border:2px solid #ff6b35;">
                    <div style="font-size:16px;font-weight:600;margin-bottom:16px;color:#2d3748;">🔥 Login Firebase</div>
                    <div style="display:grid;gap:12px;margin-bottom:16px;">
                        <input type="email" id="fb_email" placeholder="Email" style="padding:12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;">
                        <input type="password" id="fb_password" placeholder="Password" style="padding:12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;">
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                        <button onclick="backupModule.firebaseLogin(document.getElementById('fb_email').value,document.getElementById('fb_password').value)" style="padding:14px;background:#ff6b35;color:white;border:none;border-radius:10px;cursor:pointer;font-weight:600;">Login</button>
                        <button onclick="backupModule.firebaseRegister(document.getElementById('fb_email').value,document.getElementById('fb_password').value)" style="padding:14px;background:#48bb78;color:white;border:none;border-radius:10px;cursor:pointer;font-weight:600;">Daftar</button>
                    </div>
                </div>
            `;
        }
        
        return `
            <div style="background:white;padding:20px;border-radius:12px;margin-bottom:20px;box-shadow:0 2px 8px rgba(0,0,0,0.05);border:2px solid #ff6b35;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                    <div>
                        <div style="font-weight:600;color:#2d3748;">🔥 Firebase Connected</div>
                        <div style="font-size:13px;color:#38a169;margin-top:4px;">✅ ${this.currentUser?.email}</div>
                    </div>
                    <button onclick="backupModule.firebaseLogout()" style="padding:8px 16px;background:#fc8181;color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px;">Logout</button>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;padding:16px;background:#f7fafc;border-radius:10px;">
                    <div>
                        <div style="font-weight:600;color:#2d3748;">Auto Sync</div>
                        <div style="font-size:12px;color:#718096;">Sinkron otomatis tiap 3 menit</div>
                    </div>
                    <div onclick="backupModule.toggleAutoSync()" style="width:50px;height:28px;background:${this.isAutoSyncEnabled ? '#48bb78' : '#cbd5e0'};border-radius:14px;position:relative;cursor:pointer;">
                        <div style="width:24px;height:24px;background:white;border-radius:50%;position:absolute;top:2px;${this.isAutoSyncEnabled ? 'left:24px' : 'left:2px'};box-shadow:0 2px 4px rgba(0,0,0,0.2);"></div>
                    </div>
                </div>
            </div>
        `;
    },

    renderGASSection(isConfigured) {
        const hasUrl = this.gasUrl.length > 10;
        const validation = this.validateSheetId(this.sheetId);
        const hasSheetId = validation.valid;
        
        return `
            <div style="background:white;padding:20px;border-radius:12px;margin-bottom:20px;box-shadow:0 2px 8px rgba(0,0,0,0.05);border:2px solid #34a853;">
                <div style="font-size:16px;font-weight:600;margin-bottom:16px;color:#2d3748;">📊 Google Sheets (v3.3 Final)</div>
                
                <button onclick="backupModule.showGASGenerator()" style="width:100%;padding:14px;background:linear-gradient(135deg,#34a853 0%,#0f9d58 100%);color:white;border:none;border-radius:10px;cursor:pointer;font-weight:600;margin-bottom:16px;">📋 Generate GAS Code</button>
                
                <div style="margin-bottom:12px;">
                    <label style="display:block;font-size:13px;font-weight:600;color:#2d3748;margin-bottom:6px;">🔗 GAS Web App URL</label>
                    <input type="text" id="gasUrlInput" value="${this.gasUrl}" placeholder="https://script.google.com/macros/s/.../exec" style="width:100%;padding:12px;border:1px solid ${hasUrl ? '#48bb78' : '#e2e8f0'};border-radius:8px;font-size:14px;">
                </div>

                <div style="margin-bottom:16px;">
                    <label style="display:block;font-size:13px;font-weight:600;color:#2d3748;margin-bottom:6px;">📄 Google Sheet ID <span style="color:#e53e3e;">*WAJIB*</span></label>
                    <div style="display:flex;gap:8px;">
                        <input type="text" id="sheetIdInput" value="${this.sheetId || ''}" placeholder="44 karakter dari URL spreadsheet" style="flex:1;padding:12px;border:2px solid ${hasSheetId ? '#48bb78' : '#fc8181'};border-radius:8px;font-size:14px;font-family:monospace;">
                        <button onclick="document.getElementById('sheetIdInput').value=''" style="padding:12px 16px;background:#fed7d7;color:#c53030;border:none;border-radius:8px;cursor:pointer;">✕</button>
                    </div>
                    <div style="font-size:11px;color:#718096;margin-top:4px;">
                        ${hasSheetId ? '<span style="color:#48bb78;">✓ Valid (44 karakter)</span>' : '<span style="color:#e53e3e;">✗ ' + validation.message + '</span>'}
                    </div>
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
                    <button onclick="backupModule.saveGasUrl()" style="padding:14px;background:#34a853;color:white;border:none;border-radius:10px;cursor:pointer;font-weight:600;">💾 Simpan</button>
                    <button onclick="backupModule.testGASConnection()" style="padding:14px;background:#4299e1;color:white;border:none;border-radius:10px;cursor:pointer;font-weight:600;" ${!hasSheetId ? 'disabled style="opacity:0.5;"' : ''}>🧪 Test</button>
                </div>
                
                ${isConfigured ? `
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:16px;background:#f0fff4;border-radius:10px;border:1px solid #9ae6b4;">
                        <div>
                            <div style="font-weight:600;color:#2d3748;">✅ Ready</div>
                            <div style="font-size:12px;color:#718096;">${this.sheetId.substring(0, 15)}...</div>
                        </div>
                        <div onclick="backupModule.toggleAutoSync()" style="width:50px;height:28px;background:${this.isAutoSyncEnabled ? '#48bb78' : '#cbd5e0'};border-radius:14px;position:relative;cursor:pointer;">
                            <div style="width:24px;height:24px;background:white;border-radius:50%;position:absolute;top:2px;${this.isAutoSyncEnabled ? 'left:24px' : 'left:2px'};box-shadow:0 2px 4px rgba(0,0,0,0.2);"></div>
                        </div>
                    </div>
                ` : `
                    <div style="background:#fff5f5;border:1px solid #feb2b2;border-radius:10px;padding:16px;text-align:center;">
                        <div style="font-size:13px;color:#c53030;">⚠️ Konfigurasi belum lengkap</div>
                    </div>
                `}
            </div>
        `;
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => backupModule.init());
} else {
    backupModule.init();
}

window.backupModule = backupModule;

console.log('[Backup] v3.3 FINAL loaded - BYPASS FETCH MODE');

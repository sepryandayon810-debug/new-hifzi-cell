// ============================================
// BACKUP MODULE - HIFZI CELL (COMPLETE v2.5)
// Firebase + Google Sheets + Local
// FIXED: Empty Sheet ID & CORS
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
    
    gasCodeUrl: 'https://raw.githubusercontent.com/hifzi/gas-backup/main/backup-script.js',
    
    deviceId: 'device_' + Date.now(),
    deviceName: navigator.userAgent.split(' ')[0],
    
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
        GAS_CODE_URL: 'hifzi_gas_code_url',
        GAS_CODE_CACHE: 'hifzi_gas_code_cache',
        GAS_CODE_VERSION: 'hifzi_gas_code_version'
    },

    init() {
        if (this.isInitialized) {
            console.log('[Backup] Already initialized, skipping...');
            return this;
        }

        console.log('[Backup] Initializing v2.5...');
        
        this.reloadAllConfig();
        
        if (!localStorage.getItem(this.KEYS.DEVICE_ID)) {
            localStorage.setItem(this.KEYS.DEVICE_ID, this.deviceId);
        }
        
        const originalSheetId = this.sheetId;
        this.sheetId = this.cleanSheetId(this.sheetId);
        
        if (originalSheetId !== this.sheetId) {
            console.log('[Backup] Sheet ID cleaned from "' + originalSheetId + '" to "' + this.sheetId + '"');
        }
        
        console.log('[Backup] Provider:', this.currentProvider);
        console.log('[Backup] Sheet ID:', this.sheetId ? 'Valid (' + this.sheetId.substring(0, 10) + '...)' : 'EMPTY/NULL');
        console.log('[Backup] GAS URL:', this.gasUrl ? 'Set' : 'Empty');
        
        this.setupNetworkListeners();
        
        if (this.currentProvider === 'firebase') {
            this.initFirebase();
        } else if (this.currentProvider === 'googlesheet' && this.gasUrl) {
            this.checkNewDeviceGAS();
        }

        if (this.isAutoSyncEnabled) {
            this.startAutoSync();
        }

        this.isInitialized = true;
        console.log('[Backup] Initialization complete');
        return this;
    },
    
    reloadAllConfig() {
        try {
            this.currentProvider = localStorage.getItem(this.KEYS.PROVIDER) || 'local';
            this.isAutoSyncEnabled = localStorage.getItem(this.KEYS.AUTO_SYNC) === 'true';
            this.isAutoSaveLocalEnabled = localStorage.getItem(this.KEYS.AUTO_SAVE_LOCAL) !== 'false';
            this.lastSyncTime = localStorage.getItem(this.KEYS.LAST_SYNC);
            
            this.gasUrl = localStorage.getItem(this.KEYS.GAS_URL) || '';
            this.sheetId = localStorage.getItem(this.KEYS.SHEET_ID) || '';
            this.gasCodeUrl = localStorage.getItem(this.KEYS.GAS_CODE_URL) || 'https://raw.githubusercontent.com/hifzi/gas-backup/main/backup-script.js';
            
            const fbConfig = localStorage.getItem(this.KEYS.FIREBASE_CONFIG);
            this.firebaseConfig = fbConfig ? JSON.parse(fbConfig) : {};
            
            const deviceId = localStorage.getItem(this.KEYS.DEVICE_ID);
            if (deviceId) this.deviceId = deviceId;
            
        } catch (e) {
            console.error('[Backup] Error reloading config:', e);
            this.currentProvider = 'local';
            this.isAutoSyncEnabled = false;
            this.sheetId = '';
            this.gasUrl = '';
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
        if (sheetId === null || sheetId === undefined) {
            console.log('[Backup] Sheet ID is null/undefined, returning empty');
            return '';
        }
        
        if (typeof sheetId !== 'string') {
            try {
                sheetId = String(sheetId);
            } catch (e) {
                console.error('[Backup] Cannot convert sheetId to string:', e);
                return '';
            }
        }
        
        let cleaned = sheetId
            .replace(/\s/g, '')
            .replace(/[^\x20-\x7E]/g, '')
            .trim();
        
        if (cleaned === 'null' || cleaned === 'undefined' || cleaned === '') {
            return '';
        }
        
        if (cleaned.length > 0 && cleaned.length !== 44) {
            console.warn('[Backup] Sheet ID length is', cleaned.length, '(expected 44)');
        }
        
        return cleaned;
    },

    validateSheetId(sheetId) {
        const cleaned = this.cleanSheetId(sheetId);
        
        if (!cleaned) {
            return { 
                valid: false, 
                message: 'Sheet ID kosong. Masukkan Sheet ID dari URL Google Sheets.',
                cleaned: ''
            };
        }
        
        if (cleaned.length !== 44) {
            return {
                valid: false,
                message: 'Sheet ID harus 44 karakter. Diterima: ' + cleaned.length + ' karakter.',
                cleaned: cleaned
            };
        }
        
        if (!/^[a-zA-Z0-9_-]+$/.test(cleaned)) {
            return { 
                valid: false, 
                message: 'Sheet ID mengandung karakter tidak valid.',
                cleaned: cleaned
            };
        }
        
        return { valid: true, cleaned: cleaned, message: 'Sheet ID valid' };
    },

    isSheetIdReady() {
        const cleanId = this.cleanSheetId(this.sheetId);
        return cleanId.length === 44;
    },

    async fetchGASCodeFromExternal(forceRefresh = false) {
        const cacheKey = this.KEYS.GAS_CODE_CACHE;
        const versionKey = this.KEYS.GAS_CODE_VERSION;
        
        if (!forceRefresh) {
            const cached = localStorage.getItem(cacheKey);
            const cachedVersion = localStorage.getItem(versionKey);
            if (cached && cachedVersion) {
                console.log('[Backup] Using cached GAS code version:', cachedVersion);
                return { success: true, code: cached, version: cachedVersion, fromCache: true };
            }
        }
        
        this.showToast('⬇️ Mengambil GAS code terbaru...');
        
        try {
            const url = this.gasCodeUrl + (this.gasCodeUrl.includes('?') ? '&' : '?') + '_t=' + Date.now();
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'text/plain, application/javascript, */*',
                    'Cache-Control': 'no-cache'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const code = await response.text();
            
            if (!code.includes('function doGet') && !code.includes('function doPost')) {
                throw new Error('Code tidak valid: tidak mengandung doGet/doPost');
            }
            
            const version = 'v' + Date.now();
            
            localStorage.setItem(cacheKey, code);
            localStorage.setItem(versionKey, version);
            
            this.showToast('✅ GAS code berhasil diupdate!');
            return { success: true, code: code, version: version, fromCache: false };
            
        } catch (error) {
            console.error('[Backup] Failed to fetch GAS code:', error);
            
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                this.showToast('⚠️ Menggunakan GAS code dari cache');
                return { 
                    success: true, 
                    code: cached, 
                    version: localStorage.getItem(versionKey) || 'cached',
                    fromCache: true,
                    error: error.message
                };
            }
            
            return { success: false, error: error.message };
        }
    },

    updateGASCodeUrl(newUrl) {
        if (!newUrl || !newUrl.startsWith('http')) {
            this.showToast('❌ URL tidak valid');
            return false;
        }
        
        this.gasCodeUrl = newUrl;
        localStorage.setItem(this.KEYS.GAS_CODE_URL, newUrl);
        
        localStorage.removeItem(this.KEYS.GAS_CODE_CACHE);
        localStorage.removeItem(this.KEYS.GAS_CODE_VERSION);
        
        this.showToast('✅ URL GAS code diupdate, akan fetch ulang...');
        return true;
    },

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
            cashTransactions: allData.cashTransactions || [],
            dailyClosing: allData.dailyClosing || [],
            users: allData.users || [],
            loginHistory: allData.loginHistory || [],
            currentUser: allData.currentUser || null,
            _backupMeta: {
                version: '2.5',
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
        
        if (this.isAutoSyncEnabled) {
            this.startAutoSync();
            this.syncToCloud(true);
            this.showToast('🟢 Auto-sync aktif (3 menit)');
        } else {
            this.stopAutoSync();
            this.showToast('⚪ Auto-sync dimatikan');
        }
        
        this.render();
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
                
                if (this.isRendered && this.currentProvider === 'firebase') {
                    this.render();
                }
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
        
        const payload = {
            ...data,
            _syncMeta: {
                lastModified: new Date().toISOString(),
                deviceId: this.deviceId,
                deviceName: this.deviceName,
                version: '2.5'
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
                this.pendingSync = true;
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
                    this.firebaseBackupData = cloudData;
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

    showFirebaseExcelView() {
        if (!this.firebaseBackupData && this.currentUser) {
            this.showToast('⬇️ Mengambil data dari Firebase...');
            this.database.ref('users/' + this.currentUser.uid + '/hifzi_data').once('value')
                .then((snapshot) => {
                    this.firebaseBackupData = snapshot.val();
                    this.renderFirebaseExcelModal();
                })
                .catch((err) => {
                    this.showToast('❌ Gagal mengambil data: ' + err.message);
                });
        } else {
            this.renderFirebaseExcelModal();
        }
    },

    renderFirebaseExcelModal() {
        const data = this.firebaseBackupData;
        if (!data) {
            this.showToast('ℹ️ Tidak ada data untuk ditampilkan');
            return;
        }

        const modal = document.createElement('div');
        modal.id = 'firebase-excel-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            z-index: 10000;
            display: flex;
            align-items: flex-start;
            justify-content: center;
            padding: 20px;
            overflow-y: auto;
        `;

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

        const generateTable = (tabData, tabId) => {
            if (!tabData || tabData.length === 0) {
                return `<div style="text-align: center; padding: 40px; color: #718096;">
                    <div style="font-size: 48px; margin-bottom: 16px;">📭</div>
                    <div>Tidak ada data</div>
                </div>`;
            }

            const keys = Object.keys(tabData[0]).filter(k => !k.startsWith('_'));
            const headerStyle = 'background: #ff6b35; color: white; padding: 12px; text-align: left; font-weight: 600; font-size: 12px; position: sticky; top: 0;';
            const cellStyle = 'padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
            
            const rows = tabData.map((row, idx) => {
                const cells = keys.map(key => {
                    let value = row[key];
                    if (typeof value === 'object') value = JSON.stringify(value);
                    if (key.toLowerCase().includes('price') || key.toLowerCase().includes('amount') || key.toLowerCase().includes('cash')) {
                        value = typeof value === 'number' ? 'Rp ' + value.toLocaleString('id-ID') : value;
                    }
                    return `<td style="${cellStyle} ${idx % 2 === 0 ? 'background: white;' : 'background: #f7fafc;'}">${value || '-'}</td>`;
                }).join('');
                return `<tr>${cells}</tr>`;
            }).join('');

            const headers = keys.map(key => 
                `<th style="${headerStyle}">${key.replace(/_/g, ' ').toUpperCase()}</th>`
            ).join('');

            return `
                <div style="overflow-x: auto; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <table style="width: 100%; border-collapse: collapse; font-family: 'Segoe UI', sans-serif;">
                        <thead>
                            <tr>${headers}</tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
                <div style="margin-top: 12px; font-size: 12px; color: #718096;">
                    Total: ${tabData.length} baris • Backup dari: ${data._backupMeta?.deviceName || 'Unknown'} • 
                    ${data._backupMeta?.backupDate ? new Date(data._backupMeta.backupDate).toLocaleString('id-ID') : '-'}
                </div>
            `;
        };

        const tabButtons = tabs.map(tab => `
            <button onclick="backupModule.switchExcelTab('${tab.id}')" 
                id="tab-btn-${tab.id}"
                style="padding: 10px 16px; border: none; background: #fed7d7; color: #c53030; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 13px; white-space: nowrap;">
                ${tab.label} (${tab.data.length})
            </button>
        `).join('');

        const tabContents = tabs.map(tab => `
            <div id="tab-content-${tab.id}" style="display: none;">
                ${generateTable(tab.data, tab.id)}
            </div>
        `).join('');

        modal.innerHTML = `
            <div style="background: white; border-radius: 16px; width: 100%; max-width: 1200px; max-height: 90vh; overflow: hidden; display: flex; flex-direction: column; margin-top: 20px;">
                <div style="padding: 20px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, #ff6b35 0%, #ff8c42 100%); color: white;">
                    <div>
                        <div style="font-size: 20px; font-weight: 700;">🔥 Data Firebase (Excel View)</div>
                        <div style="font-size: 13px; opacity: 0.9; margin-top: 4px;">
                            ${this.currentUser?.email || 'Not logged in'} • 
                            ${data._backupMeta?.backupDate ? new Date(data._backupMeta.backupDate).toLocaleString('id-ID') : '-'}
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button onclick="backupModule.downloadFirebaseAsExcel()" 
                            style="padding: 10px 16px; background: white; color: #ff6b35; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 13px;">
                            📥 Download Excel
                        </button>
                        <button onclick="document.getElementById('firebase-excel-modal').remove()" 
                            style="padding: 10px 16px; background: rgba(255,255,255,0.2); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 13px;">
                            ✕ Tutup
                        </button>
                    </div>
                </div>
                
                <div style="padding: 16px; background: #fff5f5; border-bottom: 1px solid #fed7d7;">
                    <div style="display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px;">
                        ${tabButtons}
                    </div>
                </div>
                
                <div style="padding: 20px; overflow-y: auto; flex: 1;">
                    ${tabContents}
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        
        const firstTabWithData = tabs.find(t => t.data.length > 0);
        if (firstTabWithData) {
            this.switchExcelTab(firstTabWithData.id);
        } else {
            this.switchExcelTab('products');
        }
    },

    switchExcelTab(tabId) {
        document.querySelectorAll('[id^="tab-content-"]').forEach(el => el.style.display = 'none');
        document.querySelectorAll('[id^="tab-btn-"]').forEach(el => {
            el.style.background = '#fed7d7';
            el.style.color = '#c53030';
        });
        
        const content = document.getElementById(`tab-content-${tabId}`);
        const btn = document.getElementById(`tab-btn-${tabId}`);
        if (content) content.style.display = 'block';
        if (btn) {
            btn.style.background = '#ff6b35';
            btn.style.color = 'white';
        }
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
            { name: 'Shift', data: data.shifts || [] },
            { name: 'Settings', data: data.settings ? [data.settings] : [] }
        ];
        
        sheets.forEach(sheet => {
            if (sheet.data.length > 0) {
                const ws = XLSX.utils.json_to_sheet(sheet.data);
                XLSX.utils.book_append_sheet(wb, ws, sheet.name);
            }
        });
        
        const metaData = [{
            backupDate: data._backupMeta?.backupDate || new Date().toISOString(),
            deviceId: data._backupMeta?.deviceId || '-',
            deviceName: data._backupMeta?.deviceName || '-',
            version: data._backupMeta?.version || '-',
            provider: data._backupMeta?.provider || '-',
            downloadedBy: this.currentUser?.email || '-',
            downloadDate: new Date().toISOString()
        }];
        const metaWs = XLSX.utils.json_to_sheet(metaData);
        XLSX.utils.book_append_sheet(wb, metaWs, 'Metadata');
        
        XLSX.writeFile(wb, `firebase_backup_${new Date().toISOString().split('T')[0]}.xlsx`);
        this.showToast('✅ File Excel berhasil didownload!');
    },

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

    testGASConnection() {
        if (!this.gasUrl) {
            this.showToast('❌ URL GAS belum diisi');
            return Promise.reject('No URL');
        }

        const cleanSheetId = this.cleanSheetId(this.sheetId);
        if (!cleanSheetId) {
            this.showToast('⚠️ Sheet ID kosong. Isi Sheet ID atau biarkan untuk default.');
            console.warn('[Backup] Sheet ID kosong saat test koneksi');
        }

        this.showToast('🧪 Testing koneksi...');
        
        const testPayload = {
            action: 'test',
            deviceId: this.deviceId,
            sheetId: cleanSheetId || undefined,
            timestamp: new Date().toISOString()
        };

        console.log('[Backup] Test payload:', testPayload);

        return fetch(this.gasUrl, {
            method: 'POST',
            mode: 'cors',
            cache: 'no-cache',
            headers: { 
                'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify(testPayload)
        })
        .then(async (r) => {
            console.log('[Backup] Test response status:', r.status);
            if (!r.ok) {
                const text = await r.text();
                throw new Error(`HTTP ${r.status}: ${text}`);
            }
            return r.json();
        })
        .then(result => {
            console.log('[Backup] Test result:', result);
            if (result?.success) {
                this.showToast('✅ ' + (result.message || 'Koneksi berhasil!'));
                return result;
            } else {
                throw new Error(result?.message || 'Test failed');
            }
        })
        .catch((err) => {
            console.error('[GAS Test Error]', err);
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
        
        if (!silent) {
            const msg = cleanSheetId ? 
                '⬆️ Upload... (ID: ' + cleanSheetId.substring(0, 8) + '...)' :
                '⬆️ Upload... (Default Sheet)';
            this.showToast(msg);
        }
        
        const payload = {
            action: 'sync',
            data: data,
            deviceId: this.deviceId,
            deviceName: this.deviceName,
            sheetId: cleanSheetId || undefined,
            timestamp: new Date().toISOString()
        };

        console.log('[Backup] Upload payload sheetId:', payload.sheetId);

        return fetch(this.gasUrl, {
            method: 'POST',
            mode: 'cors',
            cache: 'no-cache',
            headers: { 
                'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify(payload)
        })
        .then(async (r) => {
            if (!r.ok) {
                const text = await r.text();
                throw new Error(`HTTP ${r.status}: ${text}`);
            }
            return r.json();
        })
        .then(result => {
            if (result?.success) {
                this.lastSyncTime = new Date().toISOString();
                localStorage.setItem(this.KEYS.LAST_SYNC, this.lastSyncTime);
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
            const msg = '⚠️ Sheet ID kosong. Masukkan Sheet ID dari URL Google Sheets.';
            if (!silent) this.showToast(msg);
            return Promise.reject(new Error(msg));
        }
        
        if (!silent && !force) {
            if (!confirm('📥 Download akan mengganti data lokal. Lanjutkan?')) {
                return Promise.resolve();
            }
        }
        
        if (!silent) {
            this.showToast('⬇️ Download... (ID: ' + cleanSheetId.substring(0, 8) + '...)');
        }
        
        const url = this.gasUrl + 
            '?action=restore' +
            '&sheetId=' + encodeURIComponent(cleanSheetId) +
            '&_t=' + Date.now();

        console.log('[Backup] Download URL:', url.substring(0, url.indexOf('&sheetId=') + 20) + '...');

        return fetch(url, {
            method: 'GET',
            mode: 'cors',
            cache: 'no-cache',
            headers: {
                'Accept': 'application/json'
            }
        })
        .then(async (r) => {
            if (!r.ok) {
                const text = await r.text();
                throw new Error(`HTTP ${r.status}: ${text}`);
            }
            return r.json();
        })
        .then(result => {
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
                throw new Error(result?.message || 'Invalid data');
            }
        })
        .catch((err) => {
            console.error('[GAS Download Error]', err);
            if (!silent) this.showToast('❌ Download gagal: ' + err.message);
            throw err;
        });
    },

    async showGASGenerator() {
        const fetchResult = await this.fetchGASCodeFromExternal();
        
        const modal = document.createElement('div');
        modal.id = 'gas-generator-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        `;
        
        const gasCode = fetchResult.success ? fetchResult.code : this.getDefaultGASCode();
        const version = fetchResult.success ? fetchResult.version : 'fallback';
        const sourceInfo = fetchResult.fromCache ? '(dari cache)' : fetchResult.success ? '(terbaru)' : '(fallback)';
        
        modal.innerHTML = `
            <div style="background: white; border-radius: 16px; max-width: 900px; width: 100%; max-height: 90vh; overflow: hidden; display: flex; flex-direction: column;">
                <div style="padding: 20px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, #34a853 0%, #0f9d58 100%); color: white;">
                    <div>
                        <div style="font-size: 18px; font-weight: 700;">📋 Google Apps Script Generator</div>
                        <div style="font-size: 13px; opacity: 0.9; margin-top: 4px;">
                            Version: ${version} ${sourceInfo} • Auto-update enabled
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button onclick="backupModule.refreshGASCode()" 
                            style="padding: 8px 16px; background: rgba(255,255,255,0.2); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600;">
                            🔄 Refresh
                        </button>
                        <button onclick="document.getElementById('gas-generator-modal').remove()" 
                            style="background: none; border: none; font-size: 24px; cursor: pointer; color: white;">×</button>
                    </div>
                </div>
                
                <div style="padding: 20px; overflow-y: auto; flex: 1;">
                    <div style="background: #f0fff4; border: 1px solid #9ae6b4; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                        <div style="font-weight: 600; color: #22543d; margin-bottom: 8px;">🔗 Sumber GAS Code (Auto-Update)</div>
                        <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                            <input type="text" id="gas-code-url-input" value="${this.gasCodeUrl}" 
                                placeholder="https://raw.githubusercontent.com/.../gas-code.js"
                                style="flex: 1; padding: 10px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 13px; font-family: monospace;">
                            <button onclick="backupModule.updateGASUrlFromInput()" 
                                style="padding: 10px 16px; background: #34a853; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600;">
                                Simpan
                            </button>
                        </div>
                        <div style="font-size: 12px; color: #2f855a;">
                            💡 GAS code akan otomatis di-fetch dari URL ini.
                        </div>
                    </div>

                    <div style="background: #ebf8ff; border: 1px solid #90cdf4; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
                        <div style="font-size: 12px; color: #2c5282;">
                            <strong>🚀 Cara Setup:</strong>
                            <ol style="margin: 8px 0; padding-left: 20px; line-height: 1.8;">
                                <li>Buka <a href="https://script.google.com" target="_blank" style="color: #2b6cb0; font-weight: 600;">script.google.com</a></li>
                                <li>Klik "New Project" (Proyek Baru)</li>
                                <li>Hapus code default, paste code di bawah ini</li>
                                <li>Klik "Deploy" → "New Deployment"</li>
                                <li>Pilih "Web app", set "Who has access" ke "Anyone"</li>
                                <li>Copy URL deployment, paste di menu Cloud ini</li>
                            </ol>
                        </div>
                    </div>
                    
                    <div style="background: #fffaf0; border: 1px solid #fbd38d; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
                        <div style="font-size: 12px; color: #c05621;">
                            <strong>⚠️ Fitur Sheet ID:</strong> Jika diisi, data akan disimpan ke spreadsheet tertentu. 
                            Kosongkan untuk menggunakan spreadsheet default dari GAS.
                        </div>
                    </div>
                    
                    <div style="position: relative;">
                        <textarea id="gas-code-textarea" style="width: 100%; height: 400px; font-family: 'Consolas', 'Monaco', monospace; font-size: 12px; padding: 16px; border: 1px solid #e2e8f0; border-radius: 8px; resize: none; background: #1a202c; color: #68d391; line-height: 1.5;" readonly>${gasCode}</textarea>
                        <button onclick="backupModule.copyGASCode()" 
                            style="position: absolute; top: 12px; right: 12px; padding: 8px 16px; background: #34a853; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600;">
                            📋 Copy Code
                        </button>
                    </div>
                </div>
                
                <div style="padding: 20px; border-top: 1px solid #e2e8f0; background: #f7fafc; display: flex; gap: 12px;">
                    <button onclick="backupModule.downloadGASCode()" 
                        style="flex: 1; padding: 14px; background: #4299e1; color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600;">
                        ⬇️ Download .gs File
                    </button>
                    <button onclick="document.getElementById('gas-generator-modal').remove()" 
                        style="flex: 1; padding: 14px; background: #4a5568; color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600;">
                        Tutup
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    },

    async refreshGASCode() {
        const btn = event.target;
        btn.style.opacity = '0.6';
        btn.textContent = '🔄 Loading...';
        
        const result = await this.fetchGASCodeFromExternal(true);
        
        if (result.success) {
            const textarea = document.getElementById('gas-code-textarea');
            if (textarea) {
                textarea.value = result.code;
            }
            this.showToast(`✅ GAS code updated to ${result.version}`);
        } else {
            this.showToast('❌ Gagal refresh: ' + result.error);
        }
        
        btn.style.opacity = '1';
        btn.textContent = '🔄 Refresh';
    },

    updateGASUrlFromInput() {
        const input = document.getElementById('gas-code-url-input');
        if (input && this.updateGASCodeUrl(input.value)) {
            setTimeout(() => this.refreshGASCode(), 500);
        }
    },

    copyGASCode() {
        const textarea = document.getElementById('gas-code-textarea');
        if (textarea) {
            textarea.select();
            document.execCommand('copy');
            this.showToast('✅ Code berhasil dicopy!');
        }
    },

    downloadGASCode() {
        const textarea = document.getElementById('gas-code-textarea');
        if (!textarea) return;
        
        const blob = new Blob([textarea.value], { type: 'text/javascript' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `hifzi_gas_backup_${new Date().toISOString().split('T')[0]}.gs`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.showToast('✅ File GAS didownload!');
    },

    getDefaultGASCode() {
        return `// GAS CODE v2.5 - PASTE IN script.google.com
// DEPLOY AS: Web app, Execute as: Me, Access: Anyone

const SPREADSHEET_ID = '';

function doOptions(e) {
  return ContentService.createTextOutput('')
    .setHeaders({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action || 'sync';
    const sheetId = data.sheetId || SPREADSHEET_ID;
    
    if (!sheetId || sheetId === 'null' || sheetId === 'undefined' || String(sheetId).trim() === '') {
      return jsonResponse({ 
        success: false, 
        message: 'Sheet ID tidak valid atau kosong.'
      });
    }
    
    const cleanSheetId = String(sheetId).replace(/\\\\s/g, '').trim();
    
    if (!/^[a-zA-Z0-9_-]+$/.test(cleanSheetId) || cleanSheetId.length < 20) {
      return jsonResponse({ 
        success: false, 
        message: 'Format Sheet ID tidak valid (harus 20+ karakter alphanumeric).'
      });
    }
    
    let ss;
    try {
      ss = SpreadsheetApp.openById(cleanSheetId);
    } catch (err) {
      return jsonResponse({ 
        success: false, 
        message: 'Gagal membuka spreadsheet: ' + err.toString()
      });
    }
    
    if (action === 'test') {
      return jsonResponse({ success: true, message: 'Connected!', sheet: ss.getName() });
    }
    
    if (action === 'sync') {
      return handleSync(data, ss, cleanSheetId);
    }
    
    if (action === 'restore') {
      return handleRestore(ss, cleanSheetId);
    }
    
    return jsonResponse({ success: false, message: 'Unknown action' });
    
  } catch (err) {
    return jsonResponse({ success: false, message: err.toString() });
  }
}

function doGet(e) {
  const sheetId = e.parameter.sheetId;
  const callback = e.parameter.callback;
  
  if (!sheetId || sheetId === 'null' || sheetId === 'undefined') {
    return jsonResponse({ 
      success: false, 
      message: 'Sheet ID wajib diisi.'
    }, callback);
  }
  
  const cleanSheetId = String(sheetId).replace(/\\\\s/g, '').trim();
  
  let ss;
  try {
    ss = SpreadsheetApp.openById(cleanSheetId);
  } catch (err) {
    return jsonResponse({ 
      success: false, 
      message: 'Gagal membuka spreadsheet: ' + err.toString()
    }, callback);
  }
  
  if (e.parameter.action === 'restore') {
    return jsonResponse(handleRestore(ss, cleanSheetId), callback);
  }
  
  return jsonResponse({ success: true }, callback);
}

function handleSync(data, ss, sheetId) {
  const sheets = [
    { name: 'Produk', data: data.data.products || [] },
    { name: 'Transaksi', data: data.data.transactions || [] },
    { name: 'CashTrans', data: data.data.cashTransactions || [] },
    { name: 'TutupKas', data: data.data.dailyClosing || [] },
    { name: 'Hutang', data: data.data.debts || [] },
    { name: 'Users', data: data.data.users || [] },
    { name: 'Kategori', data: data.data.categories || [] },
    { name: 'Shift', data: data.data.shifts || [] }
  ];
  
  sheets.forEach(s => updateSheet(ss, s.name, s.data));
  
  return { 
    success: true, 
    message: 'Sync successful',
    sheetsUpdated: sheets.length
  };
}

function handleRestore(ss, sheetId) {
  const data = { products: [], transactions: [], cashTransactions: [], dailyClosing: [], debts: [], users: [], categories: [], shifts: [] };
  const mapping = { 'Produk': 'products', 'Transaksi': 'transactions', 'CashTrans': 'cashTransactions', 'TutupKas': 'dailyClosing', 'Hutang': 'debts', 'Users': 'users', 'Kategori': 'categories', 'Shift': 'shifts' };
  
  ss.getSheets().forEach(sheet => {
    const key = mapping[sheet.getName()];
    if (key && sheet.getLastRow() > 1) {
      const values = sheet.getDataRange().getValues();
      const headers = values[0];
      data[key] = values.slice(1).map(row => {
        const obj = {};
        headers.forEach((h, i) => { if (h) obj[h] = row[i]; });
        return obj;
      });
    }
  });
  
  return { success: true, data: data };
}

function updateSheet(ss, name, data) {
  let sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  sheet.clear();
  if (!data || data.length === 0) { sheet.appendRow(['No data']); return; }
  const headers = Object.keys(data[0]).filter(k => !k.startsWith('_'));
  sheet.appendRow(headers);
  data.forEach(item => {
    sheet.appendRow(headers.map(h => {
      const v = item[h];
      return typeof v === 'object' && v !== null ? JSON.stringify(v) : v;
    }));
  });
}

function jsonResponse(data, callback) {
  const json = JSON.stringify(data);
  let output = callback 
    ? ContentService.createTextOutput(callback + '(' + json + ')').setMimeType(ContentService.MimeType.JAVASCRIPT)
    : ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
  
  output.setHeaders({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  
  return output;
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

    setProvider(provider) {
        this.currentProvider = provider;
        localStorage.setItem(this.KEYS.PROVIDER, provider);
        this.stopAutoSync();
        this.firebaseBackupData = null;
        
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
        const sheetIdInput = document.getElementById('sheetIdInput')?.value || '';
        
        const validation = this.validateSheetId(sheetIdInput);
        
        if (!validation.valid && validation.cleaned) {
            this.showToast('⚠️ ' + validation.message);
        }
        
        if (!url || !url.includes('script.google.com')) {
            this.showToast('❌ URL GAS tidak valid');
            return;
        }
        
        const sheetId = validation.cleaned;
        
        this.gasUrl = url;
        this.sheetId = sheetId;
        localStorage.setItem(this.KEYS.GAS_URL, url);
        localStorage.setItem(this.KEYS.SHEET_ID, sheetId);
        
        const msg = sheetId ? 
            '✅ GAS disimpan! (Sheet: ' + sheetId.substring(0, 10) + '...)' : 
            '✅ GAS disimpan! (Sheet ID kosong - akan error jika tidak diisi!)';
        this.showToast(msg);
        
        if (this.currentProvider === 'googlesheet') {
            this.checkNewDeviceGAS();
        }
        
        this.render();
    },

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
            
            fetch(this.gasUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ 
                    action: 'reset', 
                    sheetId: cleanSheetId || null 
                })
            }).then(() => this.showToast('✅ GAS direset!'));
        }
    },

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

        render() {
        if (!this.isInitialized) {
            this.init();
        }

        const container = document.getElementById('mainContent');
        if (!container) {
            console.error('[Backup] mainContent not found - will retry in 100ms');
            setTimeout(() => this.render(), 100);
            return;
        }

        this.isRendered = true;
        
        const isFirebase = this.currentProvider === 'firebase';
        const isGAS = this.currentProvider === 'googlesheet';
        const isLocal = this.currentProvider === 'local';
        const isFBConfigured = !!this.firebaseConfig.apiKey;
        const isFBLoggedIn = !!this.currentUser;

        const data = (typeof dataManager !== 'undefined') ? dataManager.data : {};
        const stats = {
            products: data.products?.length || 0,
            transactions: data.transactions?.length || 0,
            cashTransactions: data.cashTransactions?.length || 0,
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
                <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 24px;">
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
                        <div style="font-size: 28px; margin-bottom: 4px;">💸</div>
                        <div style="font-size: 12px; color: #718096;">Cash Flow</div>
                        <div style="font-size: 20px; font-weight: 700; color: #2d3748;">${stats.cashTransactions}</div>
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
                            <div style="font-size: 12px; color: #718096; margin-top: 4px;">Via GAS (Auto-Update)</div>
                        </button>
                    </div>
                </div>

                ${isFirebase ? this.renderFirebaseSection(isFBConfigured, isFBLoggedIn) : ''}

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
                    ${this.pendingSync ? `
                        <div style="background: #fffaf0; border-left: 4px solid #ed8936; padding: 12px; border-radius: 6px; font-size: 13px; color: #c05621; margin-bottom: 12px;">
                            <strong>⚠️ Sync Pending:</strong> Auto-sync gagal saat offline. Klik Upload Manual untuk mencoba lagi.
                        </div>
                    ` : ''}
                    <div style="background: #ebf8ff; border-left: 4px solid #4299e1; padding: 12px; border-radius: 6px; font-size: 13px; color: #2c5282;">
                        <strong>💡 Tips:</strong> Gunakan Upload sebelum pindah device, lalu Download di device baru. Data Telegram tidak ikut tersimpan di cloud.
                    </div>
                </div>

                <!-- Local Backup -->
                <div style="background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                    <div style="font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #2d3748;">📁 Backup File Lokal (JSON)</div>
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

        container.innerHTML = html;
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
                        <input type="text" id="fb_storageBucket" placeholder="Storage Bucket" style="padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px;">
                        <input type="text" id="fb_messagingSenderId" placeholder="Messaging Sender ID" style="padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px;">
                        <input type="text" id="fb_appId" placeholder="App ID" style="padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px;">
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
                    <div style="display: flex; gap: 8px;">
                        <button onclick="backupModule.showFirebaseExcelView()" 
                            style="padding: 8px 16px; background: #fff5f0; color: #ff6b35; border: 2px solid #ff6b35; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600;">
                            📊 Lihat Data
                        </button>
                        <button onclick="backupModule.firebaseLogout()" 
                            style="padding: 8px 16px; background: #fc8181; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px;">
                            Logout
                        </button>
                    </div>
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
        const validation = this.validateSheetId(this.sheetId);
        const hasSheetId = validation.valid;
        const displaySheetId = this.sheetId || '';
        
        return `
            <div style="background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border: 2px solid #34a853;">
                <div style="font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #2d3748;">📊 Google Sheets (v2.5)</div>
                
                <button onclick="backupModule.showGASGenerator()" 
                    style="width: 100%; padding: 14px; background: linear-gradient(135deg, #34a853 0%, #0f9d58 100%); color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; margin-bottom: 16px; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 2px 8px rgba(52,168,83,0.3);">
                    <span>📋</span> Generate GAS Code (Auto-Fetch)
                </button>
                
                <div style="margin-bottom: 12px;">
                    <label style="display: block; font-size: 13px; font-weight: 600; color: #2d3748; margin-bottom: 6px;">🔗 GAS Web App URL</label>
                    <input type="text" id="gasUrlInput" value="${this.gasUrl}" placeholder="https://script.google.com/macros/s/.../exec" 
                        style="width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px;">
                </div>

                <div style="margin-bottom: 16px;">
                    <label style="display: block; font-size: 13px; font-weight: 600; color: #2d3748; margin-bottom: 6px;">
                        📄 Google Sheet ID <span style="color: #e53e3e;">*WAJIB*</span>
                    </label>
                    <div style="display: flex; gap: 8px;">
                        <input type="text" id="sheetIdInput" value="${displaySheetId}" placeholder="Contoh: 1BzfL0kZUz1TsI5zxJF1WNF01IxvC67FbOJUiiGMZ_mQ" 
                            style="flex: 1; padding: 12px; border: 2px solid ${hasSheetId ? '#48bb78' : '#fc8181'}; border-radius: 8px; font-size: 14px; font-family: monospace;">
                        <button onclick="document.getElementById('sheetIdInput').value=''" 
                            style="padding: 12px 16px; background: #fed7d7; color: #c53030; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                            ✕
                        </button>
                    </div>
                    <div style="font-size: 11px; color: #718096; margin-top: 4px;">
                        Dari URL: https://docs.google.com/spreadsheets/d/<strong>SHEET_ID</strong>/edit
                        ${hasSheetId ? 
                            `<br><span style="color: #48bb78;">✓ Valid (44 karakter)</span>` : 
                            `<br><span style="color: #e53e3e;">✗ ${validation.message}</span>`
                        }
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                    <button onclick="backupModule.saveGasUrl()" 
                        style="padding: 14px; background: #34a853; color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600;">
                        💾 Simpan
                    </button>
                    <button onclick="backupModule.testGASConnection()" 
                        style="padding: 14px; background: #4299e1; color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600;"
                        ${!hasSheetId ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
                        🧪 Test Koneksi
                    </button>
                </div>
                
                ${hasUrl && hasSheetId ? `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: #f0fff4; border-radius: 10px;">
                        <div>
                            <div style="font-weight: 600; color: #2d3748;">Auto Sync</div>
                            <div style="font-size: 12px; color: #718096; margin-top: 2px;">
                                📄 Sheet: ${this.sheetId.substring(0, 20)}...
                            </div>
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

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => backupModule.init());
} else {
    backupModule.init();
}

window.backupModule = backupModule;

console.log('[Backup] Module loaded v2.5 - FIXED Sheet ID & CORS');

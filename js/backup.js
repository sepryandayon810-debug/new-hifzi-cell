// ============================================
// BACKUP MODULE - HIFZI CELL (COMPLETE v3.8.1)
// HOTFIX: Manual Check Update Button, Better Cloud Detection
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
    isSyncing: false,
    syncStatus: 'idle',
    
    // Sync detection
    hasCheckedCloudOnLoad: false,
    cloudDataHash: null,
    localDataHash: null,
    lastCloudCheck: null,
    cloudCheckCount: 0, // Track berapa kali sudah check
    
    // Real-time sync properties
    dataChangeObserver: null,
    syncDebounceTimer: null,
    lastLocalDataHash: null,
    lastCloudDataHash: null,
    
    firebaseConfig: {},
    firebaseApp: null,
    database: null,
    auth: null,
    currentUser: null,
    firebaseBackupData: null,
    gasBackupData: null,
    
    gasUrl: '',
    sheetId: '',
    
    deviceId: 'device_' + Date.now(),
    deviceName: navigator.userAgent.split(' ')[0],
    
    _firebaseAuthStateReady: false,
    _gasConfigValid: false,
    
    SYNC_STATUS: {
        IDLE: 'idle',
        SYNCING: 'syncing',
        SYNCED: 'synced',
        ERROR: 'error',
        CONFLICT: 'conflict',
        OFFLINE: 'offline',
        CHECKING: 'checking',
        CLOUD_NEWER: 'cloud_newer' // Status baru: ada update di cloud
    },
    
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
        BACKUP_SETTINGS: 'hifzi_backup_settings',
        LAST_DATA_HASH: 'hifzi_last_data_hash',
        CLOUD_DATA_HASH: 'hifzi_cloud_data_hash',
        LAST_CLOUD_CHECK: 'hifzi_last_cloud_check',
        CLOUD_CHECK_COUNT: 'hifzi_cloud_check_count'
    },

    init(forceReinit = false) {
        if (this.isInitialized && !forceReinit) {
            console.log('[Backup] Already initialized, skipping...');
            this.reloadAllConfig();
            return this;
        }

        console.log('[Backup] ========================================');
        console.log('[Backup] Initializing v3.8.1 - Manual Check Update...');
        console.log('[Backup] ========================================');
        
        this.loadBackupSettings();
        this.lastLocalDataHash = localStorage.getItem(this.KEYS.LAST_DATA_HASH) || null;
        this.cloudDataHash = localStorage.getItem(this.KEYS.CLOUD_DATA_HASH) || null;
        this.lastCloudCheck = localStorage.getItem(this.KEYS.LAST_CLOUD_CHECK) || null;
        this.cloudCheckCount = parseInt(localStorage.getItem(this.KEYS.CLOUD_CHECK_COUNT) || '0');
        
        if (!localStorage.getItem(this.KEYS.DEVICE_ID)) {
            localStorage.setItem(this.KEYS.DEVICE_ID, this.deviceId);
        } else {
            this.deviceId = localStorage.getItem(this.KEYS.DEVICE_ID);
        }
        
        const originalSheetId = this.sheetId;
        this.sheetId = this.cleanSheetId(this.sheetId);
        
        if (originalSheetId !== this.sheetId) {
            if (this.sheetId) {
                localStorage.setItem(this.KEYS.SHEET_ID, this.sheetId);
                this.saveBackupSettings();
            }
        }
        
        this._gasConfigValid = this.gasUrl && this.sheetId && this.sheetId.length === 44;
        
        console.log('[Backup] Provider:', this.currentProvider);
        console.log('[Backup] GAS Valid:', this._gasConfigValid);
        
        this.setupNetworkListeners();
        this.setupDataChangeObserver();
        
        if (this.currentProvider === 'firebase') {
            this.initFirebase(true);
        } else if (this.currentProvider === 'googlesheet') {
            if (this._gasConfigValid) {
                this.checkNewDeviceGAS();
                // SELALU check cloud saat init, tanpa delay
                setTimeout(() => this.checkCloudDataOnLoad(true), 1000);
            }
        }

        if (this.isAutoSyncEnabled && this._gasConfigValid) {
            this.startAutoSync();
        }

        this.isInitialized = true;
        return this;
    },
    
    // ============================================
    // MANUAL CHECK UPDATE - TOMBOL CEK UPDATE
    // ============================================
    
    async manualCheckUpdate() {
        if (!this.isOnline) {
            this.showToast('📴 Offline - Tidak bisa cek update');
            return;
        }
        
        if (this.currentProvider === 'local') {
            this.showToast('💾 Mode Local - Tidak ada cloud');
            return;
        }
        
        if (this.currentProvider === 'firebase' && !this.currentUser) {
            this.showToast('❌ Belum login Firebase');
            return;
        }
        
        if (this.currentProvider === 'googlesheet' && !this._gasConfigValid) {
            this.showToast('❌ Konfigurasi GAS tidak lengkap');
            return;
        }
        
        // Reset check count untuk force check
        this.cloudCheckCount = 0;
        this.lastCloudCheck = null;
        
        this.showToast('🔍 Mengecek update di cloud...');
        await this.checkCloudDataOnLoad(true); // true = force check
    },
    
    // ============================================
    // AUTO CHECK CLOUD DATA
    // ============================================
    
    async checkCloudDataOnLoad(force = false) {
        if (!force && this.hasCheckedCloudOnLoad) return;
        if (!this.isOnline) {
            this.updateSyncStatus(this.SYNC_STATUS.OFFLINE);
            return;
        }
        
        // Jika bukan force, cek interval (minimal 1 menit untuk manual check, 5 menit untuk auto)
        const now = Date.now();
        const lastCheck = this.lastCloudCheck ? new Date(this.lastCloudCheck).getTime() : 0;
        const minInterval = force ? 10000 : 60000; // 10 detik untuk manual, 1 menit untuk auto
        
        if (!force && (now - lastCheck < minInterval)) {
            console.log('[Backup] Cloud check skipped (checked recently)');
            return;
        }
        
        this.hasCheckedCloudOnLoad = true;
        this.cloudCheckCount++;
        localStorage.setItem(this.KEYS.CLOUD_CHECK_COUNT, this.cloudCheckCount.toString());
        
        this.updateSyncStatus(this.SYNC_STATUS.CHECKING);
        
        console.log('[Backup] Checking cloud data... (check #' + this.cloudCheckCount + ')');
        
        try {
            let cloudData = null;
            let cloudHash = null;
            let cloudTimestamp = null;
            let cloudDeviceId = null;
            
            if (this.currentProvider === 'firebase' && this.currentUser) {
                const snapshot = await this.database.ref('users/' + this.currentUser.uid + '/hifzi_data').once('value');
                cloudData = snapshot.val();
                if (cloudData && cloudData._syncMeta) {
                    cloudHash = cloudData._syncMeta.hash;
                    cloudTimestamp = cloudData._syncMeta.lastModified;
                    cloudDeviceId = cloudData._syncMeta.deviceId;
                }
            } else if (this.currentProvider === 'googlesheet' && this._gasConfigValid) {
                const result = await this.quickCheckGAS();
                if (result.success) {
                    if (result.hasData === false) {
                        // Belum ada data di cloud
                        this.updateSyncStatus(this.SYNC_STATUS.IDLE);
                        this.showToast('ℹ️ Belum ada data di cloud');
                        return;
                    }
                    cloudHash = result.hash;
                    cloudTimestamp = result.timestamp;
                    cloudDeviceId = result.deviceId;
                    
                    // Jika hash berbeda, fetch full data
                    if (cloudHash !== this.lastLocalDataHash) {
                        const fullResult = await this.downloadFromGAS(true, true); // silent, force
                        if (fullResult && fullResult.data) {
                            cloudData = fullResult.data;
                        }
                    }
                }
            }
            
            this.lastCloudCheck = new Date().toISOString();
            localStorage.setItem(this.KEYS.LAST_CLOUD_CHECK, this.lastCloudCheck);
            
            if (!cloudData && !cloudHash) {
                console.log('[Backup] No cloud data');
                this.updateSyncStatus(this.SYNC_STATUS.IDLE);
                return;
            }
            
            // Generate hash dari data lokal saat ini
            const currentLocalData = this.getBackupData();
            const currentLocalHash = this.generateDataHash(currentLocalData);
            
            console.log('[Backup] Cloud hash:', cloudHash);
            console.log('[Backup] Local hash:', currentLocalHash);
            console.log('[Backup] Cloud device:', cloudDeviceId);
            console.log('[Backup] This device:', this.deviceId);
            
            // Simpan hash cloud untuk referensi
            if (cloudHash) {
                this.cloudDataHash = cloudHash;
                localStorage.setItem(this.KEYS.CLOUD_DATA_HASH, cloudHash);
            }
            
            // Jika hash sama, data sudah sync
            if (cloudHash === currentLocalHash) {
                console.log('[Backup] Data is in sync');
                this.updateSyncStatus(this.SYNC_STATUS.SYNCED);
                this.showToast('✅ Data sudah up to date!');
                return;
            }
            
            // Jika hash berbeda, ada perubahan
            console.log('[Backup] Data mismatch detected!');
            
            // Cek apakah perubahan dari device lain atau device ini
            const isFromOtherDevice = cloudDeviceId && cloudDeviceId !== this.deviceId;
            
            const localTime = this.lastSyncTime ? new Date(this.lastSyncTime).getTime() : 0;
            const cloudTime = cloudTimestamp ? new Date(cloudTimestamp).getTime() : 0;
            
            if (isFromOtherDevice || cloudTime > localTime + 60000) {
                console.log('[Backup] Cloud data is newer or from other device');
                this.updateSyncStatus(this.SYNC_STATUS.CLOUD_NEWER);
                this.showSyncConflictModal('cloud_newer', cloudData, cloudTime, localTime, isFromOtherDevice);
            } else {
                // Local lebih baru, upload jika auto-sync
                if (this.isAutoSyncEnabled) {
                    await this.forceSyncNow();
                } else {
                    this.updateSyncStatus(this.SYNC_STATUS.IDLE);
                }
            }
            
        } catch (err) {
            console.error('[Backup] Cloud check error:', err);
            this.updateSyncStatus(this.SYNC_STATUS.ERROR);
            this.showToast('❌ Error cek cloud: ' + err.message);
        }
    },
    
    async quickCheckGAS() {
        try {
            const payload = {
                action: 'check',
                sheetId: this.cleanSheetId(this.sheetId),
                deviceId: this.deviceId,
                timestamp: new Date().toISOString()
            };

            const response = await fetch(this.gasUrl, {
                method: 'POST',
                mode: 'cors',
                cache: 'no-cache',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload)
            });
            
            const text = await response.text();
            return JSON.parse(text);
        } catch (err) {
            return { success: false, error: err.message };
        }
    },
    
    showSyncConflictModal(type, cloudData, cloudTime, localTime, isFromOtherDevice = true) {
        const cloudDate = new Date(cloudTime).toLocaleString('id-ID');
        const localDate = this.lastSyncTime ? new Date(this.lastSyncTime).toLocaleString('id-ID') : 'Belum pernah sync';
        
        const modal = document.createElement('div');
        modal.id = 'sync-conflict-modal';
        modal.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;`;
        
        const deviceBadge = isFromOtherDevice ? 
            `<span style="background:#ed8936;color:white;padding:4px 12px;border-radius:12px;font-size:12px;font-weight:600;">🔄 Device Lain</span>` :
            `<span style="background:#4299e1;color:white;padding:4px 12px;border-radius:12px;font-size:12px;font-weight:600;">💾 Cloud</span>`;
        
        modal.innerHTML = `
            <div style="background:white;border-radius:16px;max-width:500px;width:100%;overflow:hidden;animation:slideUp 0.3s ease;">
                <div style="background:linear-gradient(135deg,#ed8936 0%,#dd6b20 100%);color:white;padding:20px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <div style="font-size:20px;font-weight:700;">🔄 Data Baru Tersedia!</div>
                        ${deviceBadge}
                    </div>
                    <div style="font-size:13px;opacity:0.9;margin-top:4px;">Ada update dari device lain</div>
                </div>
                
                <div style="padding:20px;">
                    <div style="background:#fff5f5;border-left:4px solid #fc8181;padding:12px;border-radius:6px;margin-bottom:16px;font-size:13px;color:#c53030;">
                        <strong>Perhatian:</strong> Data di cloud lebih baru dari data lokal Anda.
                    </div>
                    
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
                        <div style="background:#f7fafc;padding:12px;border-radius:8px;border:2px solid #e2e8f0;">
                            <div style="font-size:11px;color:#718096;margin-bottom:4px;">💾 Data Lokal (Device Ini)</div>
                            <div style="font-weight:600;color:#2d3748;font-size:13px;">${localDate}</div>
                            <div style="font-size:10px;color:#a0aec0;">${this.deviceName}</div>
                        </div>
                        <div style="background:#f0fff4;padding:12px;border-radius:8px;border:2px solid #48bb78;">
                            <div style="font-size:11px;color:#718096;margin-bottom:4px;">☁️ Data Cloud (Device Lain)</div>
                            <div style="font-weight:600;color:#2d3748;font-size:13px;">${cloudDate}</div>
                            <div style="font-size:10px;color:#a0aec0;">Update terbaru</div>
                        </div>
                    </div>
                    
                    <div style="font-size:13px;color:#4a5568;margin-bottom:16px;font-weight:600;">
                        Pilih tindakan:
                    </div>
                    
                    <div style="display:flex;flex-direction:column;gap:10px;">
                        <button onclick="backupModule.resolveConflict('download')" style="padding:14px;background:#48bb78;color:white;border:none;border-radius:10px;cursor:pointer;font-weight:600;display:flex;align-items:center;justify-content:center;gap:8px;font-size:15px;">
                            <span>⬇️</span> Download & Ganti Data Lokal (Rekomendasi)
                        </button>
                        
                        <button onclick="backupModule.resolveConflict('merge')" style="padding:14px;background:#4299e1;color:white;border:none;border-radius:10px;cursor:pointer;font-weight:600;display:flex;align-items:center;justify-content:center;gap:8px;">
                            <span>🔄</span> Gabungkan Data (Smart Merge)
                        </button>
                        
                        <button onclick="backupModule.resolveConflict('upload')" style="padding:12px;background:#ed8936;color:white;border:none;border-radius:10px;cursor:pointer;font-weight:600;display:flex;align-items:center;justify-content:center;gap:8px;">
                            <span>⬆️</span> Upload Lokal & Timpa Cloud
                        </button>
                        
                        <button onclick="backupModule.closeConflictModal()" style="padding:12px;background:#e2e8f0;color:#4a5568;border:none;border-radius:10px;cursor:pointer;font-weight:500;">
                            ❌ Batal (Tetap Pakai Data Lokal)
                        </button>
                    </div>
                </div>
            </div>
            
            <style>
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(50px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            </style>
        `;
        
        document.body.appendChild(modal);
        this.pendingCloudData = cloudData;
        this.updateSyncStatus(this.SYNC_STATUS.CONFLICT);
    },
    
    async resolveConflict(action) {
        this.closeConflictModal();
        
        if (!this.pendingCloudData && action !== 'upload') {
            this.showToast('❌ Data tidak tersedia');
            return;
        }
        
        switch(action) {
            case 'download':
                this.showToast('⬇️ Downloading data terbaru...');
                await this.downloadFromCloudSilent(this.pendingCloudData);
                this.showToast('✅ Data berhasil diupdate! Reload...');
                setTimeout(() => location.reload(), 1500);
                break;
                
            case 'upload':
                this.showToast('⬆️ Uploading data lokal...');
                await this.forceSyncNow();
                this.showToast('✅ Data lokal diupload ke cloud!');
                break;
                
            case 'merge':
                this.showToast('🔄 Menggabungkan data...');
                await this.smartMergeData(this.pendingCloudData);
                this.showToast('✅ Data digabungkan! Reload...');
                setTimeout(() => location.reload(), 1500);
                break;
        }
        
        this.pendingCloudData = null;
    },
    
    async smartMergeData(cloudData) {
        const localData = this.getBackupData();
        
        const merged = {
            products: this.mergeArrays(localData.products || [], cloudData.products || [], 'id', 'updatedAt'),
            transactions: this.mergeArrays(localData.transactions || [], cloudData.transactions || [], 'id', 'date'),
            cashTransactions: this.mergeArrays(localData.cashTransactions || [], cloudData.cashTransactions || [], 'id', 'date'),
            debts: this.mergeArrays(localData.debts || [], cloudData.debts || [], 'id', 'updatedAt'),
            categories: this.mergeArrays(localData.categories || [], cloudData.categories || [], 'id'),
            users: this.mergeArrays(localData.users || [], cloudData.users || [], 'id', 'lastLogin'),
            settings: { ...cloudData.settings, ...localData.settings },
            kasir: localData.kasir || cloudData.kasir,
            shiftHistory: this.mergeArrays(localData.shiftHistory || [], cloudData.shiftHistory || [], 'date'),
            loginHistory: this.mergeArrays(localData.loginHistory || [], cloudData.loginHistory || [], 'id', 'timestamp'),
            _backupMeta: {
                version: '3.8.1',
                deviceId: this.deviceId,
                backupDate: new Date().toISOString(),
                provider: this.currentProvider,
                syncMode: 'merged'
            }
        };
        
        this.saveBackupData(merged);
        await this.forceSyncNow();
    },
    
    mergeArrays(localArr, cloudArr, idField, timeField = null) {
        const map = new Map();
        
        cloudArr.forEach(item => {
            map.set(item[idField], { ...item, source: 'cloud' });
        });
        
        localArr.forEach(item => {
            const existing = map.get(item[idField]);
            if (!existing) {
                map.set(item[idField], { ...item, source: 'local' });
            } else if (timeField) {
                const localTime = new Date(item[timeField] || 0).getTime();
                const cloudTime = new Date(existing[timeField] || 0).getTime();
                if (localTime >= cloudTime) {
                    map.set(item[idField], { ...item, source: 'local' });
                }
            }
        });
        
        return Array.from(map.values());
    },
    
    closeConflictModal() {
        const modal = document.getElementById('sync-conflict-modal');
        if (modal) modal.remove();
        this.updateSyncStatus(this.SYNC_STATUS.IDLE);
    },
    
    async downloadFromCloudSilent(cloudData) {
        try {
            this.updateSyncStatus(this.SYNC_STATUS.SYNCING);
            
            const { _syncMeta, _backupMeta, ...cleanData } = cloudData;
            this.saveBackupData(cleanData);
            
            this.lastLocalDataHash = _syncMeta?.hash || this.generateDataHash(cleanData);
            localStorage.setItem(this.KEYS.LAST_DATA_HASH, this.lastLocalDataHash);
            localStorage.setItem(this.KEYS.CLOUD_DATA_HASH, _syncMeta?.hash || this.lastLocalDataHash);
            
            this.lastSyncTime = new Date().toISOString();
            localStorage.setItem(this.KEYS.LAST_SYNC, this.lastSyncTime);
            this.saveBackupSettings();
            
            this.updateSyncStatus(this.SYNC_STATUS.SYNCED);
            
            if (typeof app !== 'undefined' && app.refreshData) {
                app.refreshData();
            }
            
        } catch (err) {
            console.error('[Backup] Silent download error:', err);
            this.updateSyncStatus(this.SYNC_STATUS.ERROR);
        }
    },
    
    // ============================================
    // SYNC STATUS & INDICATOR
    // ============================================
    
    updateSyncStatus(status) {
        this.syncStatus = status;
        if (this.isRendered) {
            this.updateSyncIndicator();
        }
    },
    
    updateSyncIndicator() {
        const indicator = document.getElementById('sync-status-indicator');
        const lastSyncText = document.getElementById('last-sync-text');
        const checkUpdateBtn = document.getElementById('check-update-btn');
        
        const statusConfig = {
            idle: { icon: '⚪', text: 'Standby', color: '#a0aec0', bg: '#f7fafc', btn: '🔍 Cek Update' },
            pending: { icon: '⏳', text: 'Menunggu...', color: '#ed8936', bg: '#fffaf0', btn: '⏳ Menunggu...' },
            checking: { icon: '🔍', text: 'Mengecek...', color: '#4299e1', bg: '#ebf8ff', btn: '🔍 Mengecek...' },
            syncing: { icon: '🔄', text: 'Syncing...', color: '#4299e1', bg: '#ebf8ff', btn: '🔄 Syncing...' },
            synced: { icon: '✅', text: 'Up to Date', color: '#48bb78', bg: '#f0fff4', btn: '✅ Sudah Update' },
            error: { icon: '❌', text: 'Error', color: '#fc8181', bg: '#fff5f5', btn: '❌ Error' },
            conflict: { icon: '⚠️', text: 'Konflik!', color: '#ed8936', bg: '#fffaf0', btn: '⚠️ Konflik' },
            offline: { icon: '📴', text: 'Offline', color: '#718096', bg: '#edf2f7', btn: '📴 Offline' },
            cloud_newer: { icon: '🔄', text: 'Update Tersedia!', color: '#ed8936', bg: '#fffaf0', btn: '🔄 Download Update' }
        };
        
        const config = statusConfig[this.syncStatus] || statusConfig.idle;
        
        if (indicator) {
            indicator.innerHTML = `
                <span style="font-size:16px;">${config.icon}</span> 
                <span style="color:${config.color};font-weight:600;">${config.text}</span>
            `;
            indicator.style.background = config.bg;
            indicator.style.padding = '6px 16px';
            indicator.style.borderRadius = '20px';
            indicator.style.transition = 'all 0.3s ease';
        }
        
        if (lastSyncText && this.lastSyncTime) {
            const timeAgo = this.getTimeAgo(new Date(this.lastSyncTime));
            lastSyncText.textContent = `Sync: ${timeAgo}`;
        }
        
        // Update tombol check update
        if (checkUpdateBtn) {
            checkUpdateBtn.innerHTML = config.btn;
            checkUpdateBtn.disabled = this.syncStatus === this.SYNC_STATUS.CHECKING || 
                                      this.syncStatus === this.SYNC_STATUS.SYNCING;
            checkUpdateBtn.style.opacity = checkUpdateBtn.disabled ? '0.6' : '1';
            
            // Jika ada update tersedia, highlight tombol
            if (this.syncStatus === this.SYNC_STATUS.CLOUD_NEWER) {
                checkUpdateBtn.style.background = 'linear-gradient(135deg,#ed8936 0%,#dd6b20 100%)';
                checkUpdateBtn.style.animation = 'pulse 2s infinite';
            } else {
                checkUpdateBtn.style.background = 'linear-gradient(135deg,#4299e1 0%,#3182ce 100%)';
                checkUpdateBtn.style.animation = 'none';
            }
        }
    },
    
    getTimeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        if (seconds < 60) return 'baru saja';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes} menit lalu`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours} jam lalu`;
        const days = Math.floor(hours / 24);
        return `${days} hari lalu`;
    },
    
    // ============================================
    // FORCE SYNC
    // ============================================
    
    async forceSyncNow() {
        if (this.isSyncing) {
            this.showToast('⏳ Sync sedang berjalan...');
            return;
        }
        
        this.updateSyncStatus(this.SYNC_STATUS.SYNCING);
        this.showToast('🔄 Uploading data ke cloud...');
        
        try {
            const data = this.getBackupData();
            
            if (this.currentProvider === 'firebase') {
                if (!this.currentUser) throw new Error('Belum login');
                await this.uploadToFirebase(data, false);
            } else if (this.currentProvider === 'googlesheet') {
                if (!this._gasConfigValid) throw new Error('Config tidak lengkap');
                await this.uploadToGAS(data, false);
            } else {
                throw new Error('Provider tidak valid');
            }
            
            this.lastLocalDataHash = this.generateDataHash(data);
            localStorage.setItem(this.KEYS.LAST_DATA_HASH, this.lastLocalDataHash);
            this.updateSyncStatus(this.SYNC_STATUS.SYNCED);
            this.showToast('✅ Upload berhasil! Data tersimpan di cloud.');
            
        } catch (err) {
            this.updateSyncStatus(this.SYNC_STATUS.ERROR);
            this.showToast('❌ Upload gagal: ' + err.message);
        }
    },
    
    // ============================================
    // DATA OBSERVER & UTILITIES
    // ============================================
    
    setupDataChangeObserver() {
        if (typeof dataManager !== 'undefined') {
            const originalSaveData = dataManager.saveData.bind(dataManager);
            const self = this;
            
            dataManager.saveData = function() {
                const result = originalSaveData.apply(this, arguments);
                self.handleDataChange();
                return result;
            };
        }
        
        window.addEventListener('hifzi_data_changed', () => {
            this.handleDataChange();
        });
    },
    
    handleDataChange() {
        if (this.syncDebounceTimer) {
            clearTimeout(this.syncDebounceTimer);
        }
        
        this.syncDebounceTimer = setTimeout(() => {
            if (this.isAutoSyncEnabled) {
                this.checkAndSync();
            }
        }, 3000);
        
        if (this.syncStatus !== this.SYNC_STATUS.CLOUD_NEWER) {
            this.updateSyncStatus(this.SYNC_STATUS.PENDING);
        }
    },
    
    async checkAndSync() {
        if (!this.isOnline || this.currentProvider === 'local') return;
        if (this.currentProvider === 'firebase' && !this.currentUser) return;
        if (this.currentProvider === 'googlesheet' && !this._gasConfigValid) return;
        
        const currentData = this.getBackupData();
        const currentHash = this.generateDataHash(currentData);
        
        if (currentHash === this.lastLocalDataHash) return;
        
        await this.forceSyncNow();
    },
    
    generateDataHash(data) {
        const str = JSON.stringify(data);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString();
    },
    
    // ============================================
    // FIREBASE METHODS (sama seperti sebelumnya)
    // ============================================
    
    initFirebase(attemptAutoLogin = false) {
        if (typeof firebase === 'undefined') return;
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
                    this.setupFirebaseRealtimeListener();
                    setTimeout(() => this.checkCloudDataOnLoad(true), 2000);
                } else if (attemptAutoLogin) {
                    this.attemptAutoLogin();
                }
                if (this.isRendered) this.render();
            });
        } catch (err) {
            this.showToast('❌ Error Firebase: ' + err.message);
        }
    },
    
    setupFirebaseRealtimeListener() {
        if (!this.database || !this.currentUser) return;
        
        const userRef = this.database.ref('users/' + this.currentUser.uid + '/hifzi_data');
        
        userRef.on('value', (snapshot) => {
            const cloudData = snapshot.val();
            if (cloudData && cloudData._syncMeta) {
                const cloudDeviceId = cloudData._syncMeta.deviceId;
                const cloudTime = new Date(cloudData._syncMeta.lastModified);
                const localTime = this.lastSyncTime ? new Date(this.lastSyncTime) : new Date(0);
                
                if (cloudDeviceId !== this.deviceId && cloudTime > localTime + 60000) {
                    this.showToast('🔄 Update dari device lain terdeteksi!');
                    this.updateSyncStatus(this.SYNC_STATUS.CLOUD_NEWER);
                    this.showSyncConflictModal('cloud_newer', cloudData, cloudTime.getTime(), localTime.getTime(), true);
                }
            }
        });
    },
    
    attemptAutoLogin() {
        const savedEmail = localStorage.getItem(this.KEYS.FB_AUTH_EMAIL);
        const savedPass = localStorage.getItem(this.KEYS.FB_AUTH_PASSWORD);
        if (savedEmail && savedPass && this.auth) {
            this.auth.signInWithEmailAndPassword(savedEmail, savedPass)
                .catch(() => {
                    localStorage.removeItem(this.KEYS.FB_AUTH_EMAIL);
                    localStorage.removeItem(this.KEYS.FB_AUTH_PASSWORD);
                });
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
                setTimeout(() => this.checkCloudDataOnLoad(true), 2000);
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
        if (this.database && this.currentUser) {
            this.database.ref('users/' + this.currentUser.uid + '/hifzi_data').off();
        }
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
            if (!silent) this.showToast('❌ Belum login');
            return Promise.reject('Not authenticated');
        }
        
        this.isSyncing = true;
        const dataHash = this.generateDataHash(data);
        
        return this.database.ref('users/' + this.currentUser.uid + '/hifzi_data').set({
            ...data,
            _syncMeta: { 
                lastModified: new Date().toISOString(), 
                deviceId: this.deviceId, 
                version: '3.8.1',
                hash: dataHash
            }
        }).then(() => {
            this.lastSyncTime = new Date().toISOString();
            localStorage.setItem(this.KEYS.LAST_SYNC, this.lastSyncTime);
            localStorage.setItem(this.KEYS.CLOUD_DATA_HASH, dataHash);
            this.saveBackupSettings();
            this.isSyncing = false;
            if (!silent) this.showToast('✅ Upload berhasil!');
            return true;
        }).catch((err) => {
            this.isSyncing = false;
            if (!silent) this.showToast('❌ Upload gagal: ' + err.message);
            throw err;
        });
    },
    
    downloadFromFirebase(silent = false, force = false) {
        if (!this.database || !this.currentUser) {
            if (!silent) this.showToast('❌ Belum login');
            return Promise.reject('Not authenticated');
        }
        if (!silent && !force) {
            if (!confirm('📥 Download akan mengganti data lokal. Lanjutkan?')) return Promise.resolve();
        }
        
        return this.database.ref('users/' + this.currentUser.uid + '/hifzi_data').once('value')
            .then((snapshot) => {
                const cloudData = snapshot.val();
                if (cloudData) {
                    this.saveBackupData(cloudData);
                    this.lastSyncTime = new Date().toISOString();
                    localStorage.setItem(this.KEYS.LAST_SYNC, this.lastSyncTime);
                    this.lastLocalDataHash = cloudData._syncMeta?.hash;
                    localStorage.setItem(this.KEYS.LAST_DATA_HASH, this.lastLocalDataHash);
                    if (!silent) {
                        this.showToast('✅ Download berhasil! Reload...');
                        setTimeout(() => location.reload(), 1500);
                    }
                    return cloudData;
                }
                return null;
            })
            .catch((err) => {
                if (!silent) this.showToast('❌ Download gagal: ' + err.message);
                throw err;
            });
    },
    
    clearFirebaseConfig() {
        if (!confirm('⚠️ Hapus konfigurasi Firebase?')) return;
        this.firebaseConfig = {};
        this.firebaseApp = null;
        this.database = null;
        this.auth = null;
        this.currentUser = null;
        localStorage.removeItem(this.KEYS.FIREBASE_CONFIG);
        localStorage.removeItem(this.KEYS.FB_USER);
        this.stopAutoSync();
        this.saveBackupSettings();
        this.showToast('✅ Config dihapus');
        this.render();
    },
    
    // ============================================
    // GOOGLE SHEETS METHODS
    // ============================================
    
    checkNewDeviceGAS() {
        const hasLocalData = (typeof dataManager !== 'undefined' && dataManager.data) 
            ? dataManager.data.products?.length > 0 
            : false;
        if (!hasLocalData && this.gasUrl && this._gasConfigValid) {
            setTimeout(() => this.downloadFromGAS(true, true), 1000);
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
            try { return JSON.parse(text); } catch (e) { throw new Error('Invalid JSON'); }
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
        
        this.isSyncing = true;
        const dataHash = this.generateDataHash(data);
        
        const payload = {
            action: 'sync',
            data: data,
            deviceId: this.deviceId,
            deviceName: this.deviceName,
            sheetId: cleanSheetId,
            timestamp: new Date().toISOString(),
            hash: dataHash
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
            try { return JSON.parse(text); } catch (e) { throw new Error('Invalid JSON'); }
        })
        .then(result => {
            if (result?.success) {
                this.lastSyncTime = new Date().toISOString();
                localStorage.setItem(this.KEYS.LAST_SYNC, this.lastSyncTime);
                localStorage.setItem(this.KEYS.CLOUD_DATA_HASH, dataHash);
                this.saveBackupSettings();
                this.isSyncing = false;
                this.pendingSync = false;
                if (!silent) this.showToast('✅ Upload berhasil!');
                return result;
            } else {
                throw new Error(result?.message || 'Upload failed');
            }
        })
        .catch((err) => {
            this.isSyncing = false;
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

        return fetch(this.gasUrl, {
            method: 'POST',
            mode: 'cors',
            cache: 'no-cache',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        })
        .then(async (r) => {
            const text = await r.text();
            if (!r.ok) throw new Error('HTTP ' + r.status);
            try { return JSON.parse(text); } catch (e) { throw new Error('Invalid JSON'); }
        })
        .then(result => {
            if (result?.success && result.data) {
                this.gasBackupData = result.data;
                this.saveBackupData(result.data);
                this.lastSyncTime = new Date().toISOString();
                localStorage.setItem(this.KEYS.LAST_SYNC, this.lastSyncTime);
                this.lastLocalDataHash = result.data._backupMeta?.hash || this.generateDataHash(result.data);
                localStorage.setItem(this.KEYS.LAST_DATA_HASH, this.lastLocalDataHash);
                localStorage.setItem(this.KEYS.CLOUD_DATA_HASH, result.hash || this.lastLocalDataHash);
                
                if (!silent) {
                    this.showToast('✅ Download berhasil! Reload...');
                    setTimeout(() => location.reload(), 1500);
                }
                return result;
            } else {
                throw new Error(result?.message || 'No data');
            }
        })
        .catch((err) => {
            if (!silent) this.showToast('❌ Download gagal: ' + err.message);
            throw err;
        });
    },
    
    clearGASConfig() {
        if (!confirm('⚠️ Hapus konfigurasi Google Sheets?')) return;
        this.gasUrl = '';
        this.sheetId = '';
        this._gasConfigValid = false;
        localStorage.removeItem(this.KEYS.GAS_URL);
        localStorage.removeItem(this.KEYS.SHEET_ID);
        this.stopAutoSync();
        this.saveBackupSettings();
        this.showToast('✅ Config dihapus');
        this.render();
    },
    
    // ============================================
    // UTILITY METHODS
    // ============================================
    
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
    
    getBackupData() {
        let allData = {};
        if (typeof dataManager !== 'undefined') {
            if (dataManager.getAllData) {
                allData = dataManager.getAllData();
            } else if (dataManager.data) {
                allData = dataManager.data;
            }
        }
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
                version: '3.8.1',
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
        
        const dataToSave = { ...backupData, telegram: telegramBackup };
        
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
    
    setupNetworkListeners() {
        window.removeEventListener('online', this.handleOnline);
        window.removeEventListener('offline', this.handleOffline);
        
        this.handleOnline = () => {
            this.isOnline = true;
            this.showToast('🌐 Online');
            this.updateSyncStatus(this.SYNC_STATUS.IDLE);
        };
        
        this.handleOffline = () => {
            this.isOnline = false;
            this.showToast('📴 Offline');
            this.updateSyncStatus(this.SYNC_STATUS.OFFLINE);
        };
        
        window.addEventListener('online', this.handleOnline);
        window.addEventListener('offline', this.handleOffline);
    },
    
    toggleAutoSync() {
        this.isAutoSyncEnabled = !this.isAutoSyncEnabled;
        localStorage.setItem(this.KEYS.AUTO_SYNC, this.isAutoSyncEnabled);
        this.saveBackupSettings();
        
        if (this.isAutoSyncEnabled) {
            this.startAutoSync();
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
        this.autoSyncInterval = setInterval(() => {
            this.checkAndSync();
        }, 120000); // 2 menit
    },
    
    stopAutoSync() {
        if (this.autoSyncInterval) {
            clearInterval(this.autoSyncInterval);
            this.autoSyncInterval = null;
        }
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
            }
        } catch (e) {
            this.currentProvider = 'local';
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
        }
    },
    
    setProvider(provider) {
        this.currentProvider = provider;
        localStorage.setItem(this.KEYS.PROVIDER, provider);
        this.saveBackupSettings();
        this.stopAutoSync();
        this.firebaseBackupData = null;
        this.gasBackupData = null;
        
        if (provider === 'firebase') {
            this.initFirebase(true);
        } else if (provider === 'googlesheet') {
            this._gasConfigValid = this.gasUrl && this.sheetId && this.sheetId.length === 44;
            if (this._gasConfigValid) {
                setTimeout(() => this.checkCloudDataOnLoad(true), 2000);
            }
        }
        
        this.showToast(`✅ Provider: ${provider === 'local' ? '💾 Local' : provider === 'firebase' ? '🔥 Firebase' : '📊 Google Sheets'}`);
        this.render();
    },
    
    // ============================================
    // RENDER - DENGAN TOMBOL CHECK UPDATE YANG JELAS
    // ============================================
    
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

        const html = `
            <div class="backup-container" style="padding:20px;max-width:900px;margin:0 auto;font-family:system-ui,-apple-system,sans-serif;">
                
                <!-- HEADER -->
                <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:20px;border-radius:16px;margin-bottom:20px;box-shadow:0 4px 15px rgba(0,0,0,0.1);">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                        <div>
                            <div style="font-size:12px;opacity:0.9;margin-bottom:4px;">☁️ Cloud Sync Status</div>
                            <div style="font-size:24px;font-weight:700;">${isLocal ? '💾 Local Only' : isFirebase ? '🔥 Firebase' : '📊 Google Sheets'}</div>
                        </div>
                        <div style="text-align:right;">
                            <div id="sync-status-indicator" style="display:inline-block;padding:6px 16px;border-radius:20px;background:rgba(255,255,255,0.2);font-size:14px;font-weight:600;">
                                <span style="font-size:16px;">⚪</span> Standby
                            </div>
                        </div>
                    </div>
                    
                    <div style="display:flex;justify-content:space-between;align-items:center;padding-top:12px;border-top:1px solid rgba(255,255,255,0.2);">
                        <div style="font-size:13px;opacity:0.9;">
                            ${this.isOnline ? '🟢 Online' : '🔴 Offline'} 
                            ${this.isAutoSyncEnabled ? '• Auto-sync ON' : '• Manual sync'}
                        </div>
                        <div id="last-sync-text" style="font-size:12px;opacity:0.8;">
                            ${this.lastSyncTime ? 'Sync: ' + this.getTimeAgo(new Date(this.lastSyncTime)) : 'Belum pernah sync'}
                        </div>
                    </div>
                </div>

                <!-- TOMBOL CHECK UPDATE - PALING ATAS & MENONJOL -->
                ${!isLocal ? `
                <div style="background:linear-gradient(135deg,#ed8936 0%,#dd6b20 100%);padding:20px;border-radius:16px;margin-bottom:20px;box-shadow:0 4px 15px rgba(237,137,54,0.3);text-align:center;">
                    <div style="color:white;margin-bottom:12px;">
                        <div style="font-size:16px;font-weight:600;">🔄 Cek Update dari Device Lain</div>
                        <div style="font-size:13px;opacity:0.9;">Klik tombol di bawah untuk mengecek data terbaru di cloud</div>
                    </div>
                    <button id="check-update-btn" onclick="backupModule.manualCheckUpdate()" style="padding:14px 32px;background:white;color:#ed8936;border:none;border-radius:12px;cursor:pointer;font-weight:700;font-size:16px;box-shadow:0 4px 12px rgba(0,0,0,0.2);transition:all 0.3s;">
                        🔍 Cek Update Sekarang
                    </button>
                    <style>
                        @keyframes pulse {
                            0%, 100% { transform: scale(1); }
                            50% { transform: scale(1.05); }
                        }
                    </style>
                </div>
                ` : ''}

                <!-- DEVICE INFO -->
                <div style="background:#f7fafc;padding:16px;border-radius:12px;margin-bottom:20px;border:1px solid #e2e8f0;">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <div>
                            <div style="font-size:12px;color:#718096;margin-bottom:2px;">Device ID</div>
                            <div style="font-family:monospace;font-size:13px;color:#2d3748;font-weight:600;">${this.deviceId.substring(0, 20)}...</div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:12px;color:#718096;margin-bottom:2px;">Device Name</div>
                            <div style="font-size:13px;color:#2d3748;font-weight:600;">${this.deviceName}</div>
                        </div>
                    </div>
                </div>

                <!-- STATS -->
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

                <!-- PROVIDER SELECTION -->
                <div style="background:white;padding:20px;border-radius:12px;margin-bottom:20px;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
                    <div style="font-size:16px;font-weight:600;margin-bottom:16px;color:#2d3748;">☁️ Pilih Metode Backup</div>
                    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
                        <button onclick="backupModule.setProvider('local')" style="padding:16px;border:2px solid ${isLocal ? '#667eea' : '#e2e8f0'};border-radius:12px;background:${isLocal ? '#f7fafc' : 'white'};cursor:pointer;">
                            <div style="font-size:32px;margin-bottom:8px;">💾</div>
                            <div style="font-weight:600;color:#2d3748;">Local File</div>
                            <div style="font-size:12px;color:#718096;margin-top:4px;">Tidak sync antar device</div>
                        </button>
                        <button onclick="backupModule.setProvider('firebase')" style="padding:16px;border:2px solid ${isFirebase ? '#ff6b35' : '#e2e8f0'};border-radius:12px;background:${isFirebase ? '#fff5f0' : 'white'};cursor:pointer;">
                            <div style="font-size:32px;margin-bottom:8px;">🔥</div>
                            <div style="font-weight:600;color:#2d3748;">Firebase</div>
                            <div style="font-size:12px;color:#718096;margin-top:4px;">${isFBLoggedIn ? '✅ Connected' : isFBConfigured ? '⚠️ Configured' : 'Real-time sync'}</div>
                        </button>
                        <button onclick="backupModule.setProvider('googlesheet')" style="padding:16px;border:2px solid ${isGAS ? '#34a853' : '#e2e8f0'};border-radius:12px;background:${isGAS ? '#f0fff4' : 'white'};cursor:pointer;">
                            <div style="font-size:32px;margin-bottom:8px;">📊</div>
                            <div style="font-weight:600;color:#2d3748;">Google Sheets</div>
                            <div style="font-size:12px;color:#718096;margin-top:4px;">${isGASConfigured ? '✅ Ready' : 'Setup Required'}</div>
                        </button>
                    </div>
                </div>

                <!-- CONFIGURATION -->
                ${isFirebase ? this.renderFirebaseSection(isFBConfigured, isFBLoggedIn) : ''}
                ${isGAS ? this.renderGASSection(isGASConfigured) : ''}

                <!-- SYNC ACTIONS -->
                <div style="background:white;padding:20px;border-radius:12px;margin-bottom:20px;box-shadow:0 2px 8px rgba(0,0,0,0.05);border:2px solid ${(isFirebase && !isFBLoggedIn) || (isGAS && !isGASConfigured) ? '#fc8181' : '#667eea'};">
                    <div style="font-size:16px;font-weight:600;margin-bottom:16px;color:#2d3748;">🔄 Sinkronisasi</div>
                    
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
                        <button onclick="backupModule.forceSyncNow()" 
                            style="padding:16px;background:${(isFirebase && !isFBLoggedIn) || (isGAS && !isGASConfigured) ? '#cbd5e0' : 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)'};color:white;border:none;border-radius:10px;cursor:${(isFirebase && !isFBLoggedIn) || (isGAS && !isGASConfigured) ? 'not-allowed' : 'pointer'};font-weight:600;"
                            ${(isFirebase && !isFBLoggedIn) || (isGAS && !isGASConfigured) ? 'disabled' : ''}>
                            <div>⬆️ Upload ke Cloud</div>
                            <div style="font-size:11px;opacity:0.9;">Kirim data device ini</div>
                        </button>
                        <button onclick="backupModule.manualDownload()" 
                            style="padding:16px;background:${(isFirebase && !isFBLoggedIn) || (isGAS && !isGASConfigured) ? '#cbd5e0' : 'linear-gradient(135deg,#48bb78 0%,#38a169 100%)'};color:white;border:none;border-radius:10px;cursor:${(isFirebase && !isFBLoggedIn) || (isGAS && !isGASConfigured) ? 'not-allowed' : 'pointer'};font-weight:600;"
                            ${(isFirebase && !isFBLoggedIn) || (isGAS && !isGASConfigured) ? 'disabled' : ''}>
                            <div>⬇️ Download dari Cloud</div>
                            <div style="font-size:11px;opacity:0.9;">Ambil data device lain</div>
                        </button>
                    </div>
                    
                    <div style="background:#e6fffa;border:1px solid #81e6d9;border-radius:8px;padding:12px;font-size:12px;color:#234e52;">
                        <strong>💡 Cara Sync:</strong><br>
                        1. <strong>Device 1</strong>: Input transaksi → Klik <strong>Upload ke Cloud</strong><br>
                        2. <strong>Device 2</strong>: Klik <strong>🔍 Cek Update</strong> di atas → Download data baru
                    </div>
                </div>

                <!-- LOCAL BACKUP -->
                <div style="background:white;padding:20px;border-radius:12px;margin-bottom:20px;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
                    <div style="font-size:16px;font-weight:600;margin-bottom:16px;color:#2d3748;">📁 Backup File Lokal (JSON)</div>
                    <button onclick="backupModule.downloadJSON()" style="width:100%;padding:14px;background:#4a5568;color:white;border:none;border-radius:10px;cursor:pointer;font-weight:600;margin-bottom:12px;">⬇️ Download JSON</button>
                    <label style="display:block;padding:24px;border:2px dashed #cbd5e0;border-radius:10px;text-align:center;cursor:pointer;" onmouseover="this.style.borderColor='#667eea'" onmouseout="this.style.borderColor='#cbd5e0'">
                        <input type="file" accept=".json" onchange="backupModule.importJSON(this)" style="display:none;">
                        <div style="font-size:40px;margin-bottom:8px;">📤</div>
                        <div style="font-weight:600;color:#2d3748;">Import JSON</div>
                    </label>
                </div>

                <!-- DANGER ZONE -->
                <div style="background:#fff5f5;border:1px solid #feb2b2;padding:20px;border-radius:12px;">
                    <div style="font-size:16px;font-weight:600;margin-bottom:16px;color:#c53030;">🗑️ Zona Bahaya</div>
                    <button onclick="backupModule.resetLocal()" style="width:100%;padding:14px;background:#fc8181;color:white;border:none;border-radius:10px;cursor:pointer;font-weight:600;margin-bottom:8px;">🗑️ Hapus Data Lokal</button>
                    ${!isLocal ? `<button onclick="backupModule.resetCloud()" style="width:100%;padding:14px;background:#f6ad55;color:white;border:none;border-radius:10px;cursor:pointer;font-weight:600;">☁️ Reset Cloud</button>` : ''}
                </div>

            </div>
        `;

        container.innerHTML = html;
        setTimeout(() => this.updateSyncIndicator(), 100);
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
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                        <div style="font-size:16px;font-weight:600;color:#2d3748;">🔥 Login Firebase</div>
                        <button onclick="backupModule.clearFirebaseConfig()" style="padding:8px 16px;background:#fc8181;color:white;border:none;border-radius:6px;cursor:pointer;font-size:12px;">🗑️ Hapus Config</button>
                    </div>
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
                    <div style="display:flex;gap:8px;">
                        <button onclick="backupModule.firebaseLogout()" style="padding:8px 16px;background:#ed8936;color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px;">🚪 Logout</button>
                        <button onclick="backupModule.clearFirebaseConfig()" style="padding:8px 16px;background:#fc8181;color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px;">🗑️ Hapus Config</button>
                    </div>
                </div>
                
                <div style="display:flex;justify-content:space-between;align-items:center;padding:16px;background:#f7fafc;border-radius:10px;">
                    <div>
                        <div style="font-weight:600;color:#2d3748;">Auto-sync</div>
                        <div style="font-size:12px;color:#718096;">Sinkron otomatis</div>
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
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                    <div style="font-size:16px;font-weight:600;color:#2d3748;">📊 Google Sheets Setup</div>
                    ${isConfigured ? `<button onclick="backupModule.clearGASConfig()" style="padding:8px 16px;background:#fc8181;color:white;border:none;border-radius:6px;cursor:pointer;font-size:12px;">🗑️ Hapus Config</button>` : ''}
                </div>
                
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
    },
    
    // ============================================
    // UTILITY METHODS
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

    saveFirebaseConfig() {
        const config = {
            apiKey: document.getElementById('fb_apiKey')?.value?.trim(),
            authDomain: document.getElementById('fb_authDomain')?.value?.trim(),
            databaseURL: document.getElementById('fb_databaseURL')?.value?.trim(),
            projectId: document.getElementById('fb_projectId')?.value?.trim(),
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
            setTimeout(() => this.checkCloudDataOnLoad(true), 2000);
        }
        this.render();
    },

    resetLocal() {
        if (!confirm('⚠️ Hapus SEMUA data lokal?')) return;
        if (prompt('Ketik HAPUS untuk konfirmasi:') !== 'HAPUS') return;
        
        localStorage.removeItem('hifzi_data');
        localStorage.removeItem(this.KEYS.LAST_DATA_HASH);
        localStorage.removeItem(this.KEYS.CLOUD_DATA_HASH);
        this.lastLocalDataHash = null;
        
        this.showToast('✅ Data dihapus! Reload...');
        setTimeout(() => location.reload(), 1500);
    },

    resetCloud() {
        if (this.currentProvider === 'firebase') {
            if (!this.currentUser) {
                this.showToast('❌ Belum login');
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
                body: JSON.stringify({ action: 'reset', sheetId: this.cleanSheetId(this.sheetId) })
            })
            .then(r => r.json())
            .then(result => this.showToast(result.success ? '✅ GAS direset!' : '❌ Gagal'));
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
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => backupModule.init());
} else {
    backupModule.init();
}

window.backupModule = backupModule;

console.log('[Backup] v3.8.1 loaded - Manual Check Update Ready');

// ============================================
// BACKUP MODULE - HIFZI CELL (COMPLETE v4.3.7)
// FIXED: Config broadcast to search module after cloud sync
// FIXED: Prevent navigation override to cloud page
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
    
    hasCheckedCloudOnLoad: false,
    cloudDataHash: null,
    localDataHash: null,
    lastCloudCheck: null,
    cloudCheckCount: 0,
    
    dataChangeObserver: null,
    syncDebounceTimer: null,
    lastLocalDataHash: null,
    lastCloudDataHash: null,
    _backupDebounceTimer: null,
    
    previewData: null,
    
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
    _isManualLogout: false,
    
    // PERBAIKAN: Flag untuk disable problematic listeners
    _menuListenerDisabled: false,
    
    // Config objects - akan disinkron ke dataManager
    config: {
        telegram: {
            botToken: '',
            chatId: '',
            enabled: false,
            gasUrl: '',
            sheetId: ''
        },
        n8n: {
            botToken: '',
            chatId: '',
            sheetId: '',
            sheetName: 'Data Base Hifzi Cell',
            gasUrl: '',
            configSheetId: '',
            configGasUrl: ''
        }
    },
    
    SYNC_STATUS: {
        IDLE: 'idle',
        SYNCING: 'syncing',
        SYNCED: 'synced',
        ERROR: 'error',
        CONFLICT: 'conflict',
        OFFLINE: 'offline',
        CHECKING: 'checking',
        CLOUD_NEWER: 'cloud_newer',
        LOGGED_OUT: 'logged_out'
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
        CLOUD_CHECK_COUNT: 'hifzi_cloud_check_count',
        TELEGRAM_CONFIG: 'hifzi_telegram_config',
        N8N_CONFIG: 'hifzi_n8n_config',
        SHEETS_LOGGED_OUT: 'hifzi_sheets_logged_out',
        LOCAL_SYNC_ENABLED: 'hifzi_local_sync_enabled'
    },

    // ==========================================
    // CONTAINER METHODS
    // ==========================================
    
    getContainer() {
        const container = document.getElementById('mainContent') || 
                         document.getElementById('module-container') || 
                         document.getElementById('content-container') ||
                         document.querySelector('.module-container') ||
                         document.querySelector('.content-area') ||
                         document.querySelector('main') ||
                         document.body;
        
        if (container) {
            container.style.display = 'block';
            container.style.visibility = 'visible';
            container.style.opacity = '1';
        }
        
        return container;
    },

    clearContainer() {
        const container = this.getContainer();
        if (container) {
            container.innerHTML = '';
        }
    },

    // ==========================================
    // PERBAIKAN BARU: Disable global listeners yang mengganggu router
    // ==========================================
    
    disableGlobalListeners() {
        console.log('[Backup] Disabling global listeners to prevent navigation override');
        this._menuListenerDisabled = true;
    },

    // ==========================================
    // CONFIG METHODS
    // ==========================================
    
    loadConfigFromDataManager() {
        // Load Telegram dari dataManager (prioritas) atau localStorage
        if (typeof dataManager !== 'undefined' && dataManager.data && dataManager.data.telegram) {
            this.config.telegram = {
                ...this.config.telegram,
                ...dataManager.data.telegram
            };
            console.log('[Backup] Telegram loaded from dataManager');
        } else {
            const savedTelegram = localStorage.getItem(this.KEYS.TELEGRAM_CONFIG);
            if (savedTelegram) {
                try {
                    this.config.telegram = JSON.parse(savedTelegram);
                } catch (e) {
                    console.error('[Backup] Error parsing Telegram config:', e);
                }
            }
        }
        
        // Load N8N dari dataManager (prioritas) atau localStorage
        if (typeof dataManager !== 'undefined' && dataManager.data && dataManager.data.n8nConfig) {
            this.config.n8n = {
                ...this.config.n8n,
                ...dataManager.data.n8nConfig
            };
            console.log('[Backup] N8N loaded from dataManager');
        } else {
            const savedN8n = localStorage.getItem(this.KEYS.N8N_CONFIG);
            if (savedN8n) {
                try {
                    this.config.n8n = JSON.parse(savedN8n);
                } catch (e) {
                    console.error('[Backup] Error parsing N8N config:', e);
                }
            }
        }
    },

    // ==========================================
    // BROADCAST CONFIG KE MODUL LAIN
    // ==========================================
    
    syncConfigToDataManager() {
        if (typeof dataManager === 'undefined' || !dataManager.data) {
            console.warn('[Backup] dataManager not available');
            return;
        }
        
        // Sync Telegram ke dataManager
        dataManager.data.telegram = { ...this.config.telegram };
        
        // Sync N8N ke dataManager
        dataManager.data.n8nConfig = { ...this.config.n8n };
        
        console.log('[Backup] Config synced to dataManager');
    },

    broadcastConfigToModules() {
        // Simpan ke localStorage (untuk modul yang baca dari localStorage)
        localStorage.setItem(this.KEYS.TELEGRAM_CONFIG, JSON.stringify(this.config.telegram));
        localStorage.setItem(this.KEYS.N8N_CONFIG, JSON.stringify(this.config.n8n));
        
        // Broadcast event agar modul lain tahu config telah update
        window.dispatchEvent(new CustomEvent('hifzi-config-updated', {
            detail: {
                telegram: this.config.telegram,
                n8n: this.config.n8n,
                source: 'backupModule',
                timestamp: Date.now()
            }
        }));
        
        // Juga simpan ke window.globalConfig untuk akses langsung
        window.hifziConfig = {
            telegram: this.config.telegram,
            n8n: this.config.n8n,
            lastUpdated: new Date().toISOString()
        };
        
        console.log('[Backup] Config broadcasted to all modules');
    },

    getN8nConfig() {
        return {
            ...this.config.n8n,
            // Fallback ke dataManager jika config kosong
            ...(typeof dataManager !== 'undefined' && dataManager.data?.n8nConfig) || {}
        };
    },

    getTelegramConfig() {
        return {
            ...this.config.telegram,
            // Fallback ke dataManager jika config kosong
            ...(typeof dataManager !== 'undefined' && dataManager.data?.telegram) || {}
        };
    },

    saveTelegramConfig(botToken, chatId, enabled, gasUrl = '', sheetId = '') {
        this.config.telegram = {
            botToken: botToken || '',
            chatId: chatId || '',
            enabled: enabled || false,
            gasUrl: gasUrl || this.gasUrl,
            sheetId: sheetId || this.sheetId,
            updatedAt: new Date().toISOString()
        };
        
        // Broadcast ke semua modul
        this.broadcastConfigToModules();
        
        // Simpan ke dataManager
        this.syncConfigToDataManager();
        
        // Trigger save
        if (typeof dataManager !== 'undefined' && typeof dataManager.save === 'function') {
            dataManager.save();
        }
        
        console.log('[Backup] Telegram config saved:', this.config.telegram);
        this.showToast('✅ Konfigurasi Telegram disimpan');
        
        // Auto-sync jika aktif
        if (this.isAutoSyncEnabled && this.isOnline) {
            setTimeout(() => this.syncToCloud(true), 1000);
        }
    },

    saveN8nConfig(botToken, chatId, sheetId = '', gasUrl = '') {
        this.config.n8n = {
            botToken: botToken || '',
            chatId: chatId || '',
            sheetId: sheetId || '',
            sheetName: 'Data Base Hifzi Cell',
            gasUrl: gasUrl || '',
            configSheetId: this.sheetId,
            configGasUrl: this.gasUrl,
            updatedAt: new Date().toISOString()
        };
        
        // Broadcast ke semua modul
        this.broadcastConfigToModules();
        
        // Simpan ke dataManager
        this.syncConfigToDataManager();
        
        // Trigger save
        if (typeof dataManager !== 'undefined' && typeof dataManager.save === 'function') {
            dataManager.save();
        }
        
        console.log('[Backup] N8N config saved:', this.config.n8n);
        this.showToast('✅ Konfigurasi Pencarian disimpan');
        
        // Auto-sync jika aktif
        if (this.isAutoSyncEnabled && this.isOnline) {
            setTimeout(() => this.syncToCloud(true), 1000);
        }
    },

    // ==========================================
    // INIT
    // ==========================================
    
    init(forceReinit = false) {
        if (this.isInitialized && !forceReinit) {
            this.loadConfigFromDataManager();
            this.broadcastConfigToModules();
            return this;
        }

        console.log('[Backup] ========================================');
        console.log('[Backup] Initializing v4.3.7 - Router Fix Edition');
        console.log('[Backup] ========================================');
        
        this.loadBackupSettings();
        this.loadConfigFromDataManager();
        
        // Broadcast config setelah load
        this.broadcastConfigToModules();
        
        this.lastLocalDataHash = localStorage.getItem(this.KEYS.LAST_DATA_HASH) || null;
        this.cloudDataHash = localStorage.getItem(this.KEYS.CLOUD_DATA_HASH) || null;
        this.lastCloudCheck = localStorage.getItem(this.KEYS.LAST_CLOUD_CHECK) || null;
        this.cloudCheckCount = parseInt(localStorage.getItem(this.KEYS.CLOUD_CHECK_COUNT) || '0');
        
        this._isManualLogout = false;
        
        if (!localStorage.getItem(this.KEYS.DEVICE_ID)) {
            localStorage.setItem(this.KEYS.DEVICE_ID, this.deviceId);
        } else {
            this.deviceId = localStorage.getItem(this.KEYS.DEVICE_ID);
        }
        
        const originalSheetId = this.sheetId;
        this.sheetId = this.cleanSheetId(this.sheetId);
        
        if (originalSheetId !== this.sheetId && this.sheetId) {
            localStorage.setItem(this.KEYS.SHEET_ID, this.sheetId);
            this.saveBackupSettings();
        }
        
        this._gasConfigValid = this.gasUrl && this.sheetId && this.sheetId.length === 44;
        
        const sheetsLoggedOut = localStorage.getItem(this.KEYS.SHEETS_LOGGED_OUT) === 'true';
        if (sheetsLoggedOut) {
            this._gasConfigValid = false;
            console.log('[Backup] Sheets is logged out');
        }
        
        console.log('[Backup] Provider:', this.currentProvider);
        console.log('[Backup] GAS Valid:', this._gasConfigValid);
        console.log('[Backup] Telegram:', this.config.telegram.botToken ? '✅' : '❌');
        console.log('[Backup] N8N:', this.config.n8n.botToken ? '✅' : '❌');

        this.setupNetworkListeners();
        this.setupDataChangeObserver();
        // PERBAIKAN: Setup menu listeners dengan check flag
        this.setupMenuListeners();
        this.setupConfigBroadcastListener();

        if (this.currentProvider === 'firebase') {
            this.initFirebase(true);
        } else if (this.currentProvider === 'googlesheet' && this._gasConfigValid && !sheetsLoggedOut) {
            this.checkNewDeviceGAS();
            setTimeout(() => this.checkCloudDataOnLoad(true), 1000);
        }

        if (this.isAutoSyncEnabled && this._gasConfigValid && !sheetsLoggedOut) {
            this.startAutoSync();
        }

        this.isInitialized = true;
        return this;
    },

    setupDataChangeObserver() {
        if (typeof dataManager !== 'undefined') {
            const originalSave = dataManager.save;
            const self = this;
            dataManager.save = function(...args) {
                self.syncConfigToDataManager();
                const result = originalSave.apply(dataManager, args);
                setTimeout(() => self.handleDataChange(), 500);
                return result;
            };
            console.log('[Backup] Data change observer installed');
        }
        
        window.addEventListener('storage', (e) => {
            if (e.key === 'hifzi_data' || e.key === 'hifzi_transactions') {
                this.handleDataChange();
            }
            // Listen perubahan config dari tab/browser lain
            if (e.key === this.KEYS.N8N_CONFIG || e.key === this.KEYS.TELEGRAM_CONFIG) {
                console.log('[Backup] Config updated from another tab');
                this.loadConfigFromDataManager();
                this.broadcastConfigToModules();
            }
        });
    },

    setupConfigBroadcastListener() {
        window.addEventListener('hifzi-config-updated', (e) => {
            if (e.detail.source !== 'backupModule') {
                console.log('[Backup] Received config update from:', e.detail.source);
                // Update config jika lebih baru
                if (e.detail.timestamp > (this.config.n8n.updatedAt || 0)) {
                    this.config.n8n = e.detail.n8n;
                }
                if (e.detail.timestamp > (this.config.telegram.updatedAt || 0)) {
                    this.config.telegram = e.detail.telegram;
                }
            }
        });
    },

    handleDataChange() {
        if (!this.isOnline) {
            console.log('[Backup] Offline, skipping auto-backup');
            return;
        }
        
        if (this.currentProvider === 'googlesheet' && localStorage.getItem(this.KEYS.SHEETS_LOGGED_OUT) === 'true') {
            return;
        }
        
        if (this.currentProvider === 'local' && localStorage.getItem(this.KEYS.LOCAL_SYNC_ENABLED) === 'false') {
            return;
        }
        
        clearTimeout(this._backupDebounceTimer);
        this._backupDebounceTimer = setTimeout(() => {
            console.log('[Backup] Data changed, triggering auto-backup...');
            this.syncToCloud(true);
        }, 2000);
    },

    // PERBAIKAN: Setup menu listeners dengan check flag
    setupMenuListeners() {
        console.log('[Backup] Setup menu listeners...');
        document.addEventListener('click', (e) => {
            // PERBAIKAN: Check flag sebelum proses
            if (this._menuListenerDisabled) {
                return;
            }
            
            const menuItem = e.target.closest('[data-page="cloud"], [data-page="backup"], #menu-cloud, #menu-backup');
            if (menuItem) {
                console.log('[Backup] Menu cloud/backup clicked');
                // PERBAIKAN: Hanya render jika memang di halaman cloud
                if (this.isBackupPage()) {
                    setTimeout(() => this.forceRender(), 50);
                }
            }
        });
    },

    forceRender() {
        console.log('[Backup] Force rendering...');
        this.isRendered = false;
        this.clearContainer();
        this.render();
    },

    isBackupPage() {
        // PERBAIKAN: Check dengan router jika tersedia
        if (typeof window !== 'undefined' && window.router) {
            return router.currentPage === 'backup' || router.currentPage === 'cloud';
        }
        
        // Fallback ke method lama
        const hash = window.location.hash.toLowerCase();
        if (hash && (hash.includes('backup') || hash.includes('cloud'))) return true;
        
        const activeMenu = document.querySelector('.nav-tab.active[data-page="cloud"], .nav-tab.active[data-page="backup"]');
        if (activeMenu) return true;
        
        return false;
    },

    // ==========================================
    // RENDER - LENGKAP
    // ==========================================
    
    render() {
        console.log('[Backup] Rendering backup module...');
        
        const container = this.getContainer();
        if (!container) {
            console.error('[Backup] Container not found!');
            return;
        }

        container.innerHTML = '';

        const sheetsLoggedOut = localStorage.getItem(this.KEYS.SHEETS_LOGGED_OUT) === 'true';
        const localSyncEnabled = localStorage.getItem(this.KEYS.LOCAL_SYNC_ENABLED) !== 'false';
        const isFirebaseLoggedOut = !this.currentUser && this.currentProvider === 'firebase';

        container.innerHTML = `
            <div id="backup-module" style="
                max-width: 900px;
                margin: 0 auto;
                padding: 20px;
                font-family: system-ui, -apple-system, sans-serif;
            ">
                <div style="
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 24px;
                    border-radius: 16px;
                    margin-bottom: 20px;
                ">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="font-size: 32px;">☁️</div>
                        <div>
                            <div style="font-size: 24px; font-weight: 700;">Backup & Sync</div>
                            <div style="font-size: 14px; opacity: 0.9;">Versi 4.3.7 - Router Compatible</div>
                        </div>
                    </div>
                </div>

                <div style="
                    background: white;
                    border-radius: 12px;
                    padding: 20px;
                    margin-bottom: 16px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                ">
                    <div style="font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #2d3748;">
                        📊 Status Sinkronisasi
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
                        <div style="background: #f7fafc; padding: 16px; border-radius: 10px; border-left: 4px solid #667eea;">
                            <div style="font-size: 12px; color: #718096; margin-bottom: 4px;">Status</div>
                            <div id="sync-status-indicator">${this.getStatusBadge()}</div>
                        </div>
                        <div style="background: #f7fafc; padding: 16px; border-radius: 10px; border-left: 4px solid #48bb78;">
                            <div style="font-size: 12px; color: #718096; margin-bottom: 4px;">Provider</div>
                            <div id="current-provider" style="font-weight: 600; color: #2d3748; text-transform: capitalize;">${this.currentProvider}</div>
                        </div>
                        <div style="background: #f7fafc; padding: 16px; border-radius: 10px; border-left: 4px solid #ed8936;">
                            <div style="font-size: 12px; color: #718096; margin-bottom: 4px;">Device ID</div>
                            <div style="font-weight: 600; color: #2d3748; font-size: 12px;">${this.deviceId.substring(0, 20)}...</div>
                        </div>
                        <div style="background: #f7fafc; padding: 16px; border-radius: 10px; border-left: 4px solid #38b2ac;">
                            <div style="font-size: 12px; color: #718096; margin-bottom: 4px;">Last Sync</div>
                            <div id="last-sync-time" style="font-weight: 600; color: #2d3748; font-size: 12px;">
                                ${this.lastSyncTime ? new Date(this.lastSyncTime).toLocaleString('id-ID') : 'Belum pernah'}
                            </div>
                        </div>
                    </div>
                    
                    <div style="margin-top: 16px; padding: 12px; background: #f0fff4; border-radius: 8px; border: 1px solid #9ae6b4;">
                        <div style="font-size: 12px; font-weight: 600; color: #22543d; margin-bottom: 8px;">📋 Konfigurasi dalam Data Backup:</div>
                        <div style="display: flex; gap: 16px; flex-wrap: wrap; font-size: 12px;">
                            <span style="color: ${this.config.telegram.botToken ? '#38a169' : '#e53e3e'};">
                                ${this.config.telegram.botToken ? '✅' : '❌'} Telegram Bot
                            </span>
                            <span style="color: ${this.config.n8n.botToken ? '#38a169' : '#e53e3e'};">
                                ${this.config.n8n.botToken ? '✅' : '❌'} N8N/Pencarian
                            </span>
                        </div>
                        ${this.config.n8n.botToken ? `
                            <div style="margin-top: 8px; font-size: 11px; color: #718096;">
                                N8N Config tersedia di: 
                                <code style="background: #edf2f7; padding: 2px 6px; border-radius: 4px;">window.hifziConfig.n8n</code> atau 
                                <code style="background: #edf2f7; padding: 2px 6px; border-radius: 4px;">backupModule.getN8nConfig()</code>
                            </div>
                        ` : ''}
                    </div>
                </div>

                <div style="background: white; border-radius: 12px; padding: 20px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <div style="font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #2d3748;">⚙️ Pengaturan Provider</div>
                    
                    <select id="provider-select" onchange="backupModule.changeProvider(this.value)" style="
                        width: 100%; padding: 12px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 14px; margin-bottom: 16px;
                    ">
                        <option value="local" ${this.currentProvider === 'local' ? 'selected' : ''}>💾 Local Storage (Offline)</option>
                        <option value="googlesheet" ${this.currentProvider === 'googlesheet' ? 'selected' : ''}>📊 Google Sheets</option>
                        <option value="firebase" ${this.currentProvider === 'firebase' ? 'selected' : ''}>🔥 Firebase Realtime DB</option>
                    </select>

                    <div id="local-config-section" style="display: ${this.currentProvider === 'local' ? 'block' : 'none'};">
                        <div style="background: #f0fff4; border: 2px solid #9ae6b4; border-radius: 10px; padding: 16px;">
                            <div style="font-weight: 600; color: #22543d; margin-bottom: 8px;">💾 Mode Local Storage</div>
                            <div style="font-size: 13px; color: #2d3748; line-height: 1.6;">
                                <p>Data disimpan hanya di browser ini.</p>
                                <ul style="margin-top: 8px; padding-left: 20px;">
                                    <li>✅ Cepat & offline</li>
                                    <li>✅ Tidak perlu internet</li>
                                    <li>⚠️ Data tidak terbackup ke cloud</li>
                                </ul>
                            </div>
                            <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #9ae6b4;">
                                ${!localSyncEnabled ? `
                                    <div style="background: #fed7d7; color: #742a2a; padding: 10px; border-radius: 6px; margin-bottom: 10px; font-size: 13px;">
                                        ⚠️ Sync Local sedang dinonaktifkan
                                    </div>
                                    <button onclick="backupModule.enableLocalSync()" style="
                                        background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); color: white; border: none; padding: 10px 20px; border-radius: 6px; font-weight: 600; cursor: pointer; width: 100%;
                                    ">✅ Aktifkan Sync Local</button>
                                ` : `
                                    <button onclick="backupModule.disableLocalSync()" style="
                                        background: #fed7d7; color: #c53030; border: 2px solid #fc8181; padding: 10px 20px; border-radius: 6px; font-weight: 600; cursor: pointer; width: 100%;
                                    ">🚫 Nonaktifkan Sync Local</button>
                                `}
                            </div>
                        </div>
                    </div>

                    <div id="gas-config-section" style="display: ${this.currentProvider === 'googlesheet' ? 'block' : 'none'};">
                        <div style="background: ${sheetsLoggedOut ? '#fed7d7' : '#fffaf0'}; border: 2px solid ${sheetsLoggedOut ? '#fc8181' : '#fbd38d'}; border-radius: 10px; padding: 16px;">
                            <div style="font-weight: 600; color: ${sheetsLoggedOut ? '#742a2a' : '#744210'}; margin-bottom: 12px;">
                                📊 Google Sheets Configuration ${sheetsLoggedOut ? '(LOGGED OUT)' : ''}
                            </div>
                            ${sheetsLoggedOut ? `
                                <div style="background: #fff5f5; border: 1px solid #fc8181; border-radius: 6px; padding: 10px; margin-bottom: 12px; font-size: 13px; color: #742a2a;">
                                    ⚠️ Anda telah logout dari Google Sheets. Sync dinonaktifkan.<br>Masukkan kredensial untuk login kembali.
                                </div>
                            ` : ''}
                            <input type="text" id="gas-url-input" value="${this.gasUrl}" placeholder="https://script.google.com/macros/s/..." style="
                                width: 100%; padding: 12px; border: 2px solid #e2e8f0; border-radius: 8px; margin-bottom: 12px; font-size: 14px;
                            ">
                            <input type="text" id="sheet-id-input" value="${this.sheetId}" placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms" style="
                                width: 100%; padding: 12px; border: 2px solid #e2e8f0; border-radius: 8px; margin-bottom: 12px; font-size: 14px;
                            ">
                            ${!sheetsLoggedOut ? `
                                <div style="background: ${this._gasConfigValid ? '#c6f6d5' : '#fed7d7'}; border-radius: 8px; padding: 12px; margin-bottom: 12px; font-size: 13px;">
                                    <div style="font-weight: 600; color: ${this._gasConfigValid ? '#22543d' : '#742a2a'};">
                                        ${this._gasConfigValid ? '✅ Konfigurasi Valid' : '⚠️ Konfigurasi Belum Lengkap'}
                                    </div>
                                </div>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                                    <button onclick="backupModule.saveGASConfig()" style="
                                        background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); color: white; border: none; padding: 12px; border-radius: 8px; font-weight: 600; cursor: pointer;
                                    ">💾 Simpan</button>
                                    <button onclick="backupModule.logoutSheets()" style="
                                        background: #fed7d7; color: #c53030; border: 2px solid #fc8181; padding: 12px; border-radius: 8px; font-weight: 600; cursor: pointer;
                                    ">🚫 Logout</button>
                                </div>
                            ` : `
                                <button onclick="backupModule.loginSheets()" style="
                                    background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); color: white; border: none; padding: 12px; border-radius: 8px; font-weight: 600; cursor: pointer; width: 100%;
                                ">🔑 Login Google Sheets</button>
                            `}
                        </div>
                    </div>

                    <div id="firebase-config-section" style="display: ${this.currentProvider === 'firebase' ? 'block' : 'none'};">
                        <div style="background: ${isFirebaseLoggedOut ? '#fed7d7' : '#fff5f5'}; border: 2px solid ${isFirebaseLoggedOut ? '#fc8181' : '#fc8181'}; border-radius: 10px; padding: 16px;">
                            <div style="font-weight: 600; color: #742a2a; margin-bottom: 12px;">
                                🔥 Firebase Configuration ${isFirebaseLoggedOut ? '(LOGGED OUT)' : ''}
                            </div>
                            ${!this.currentUser ? `
                                <textarea id="firebase-config-input" rows="4" placeholder='{"apiKey": "...", "authDomain": "...", ...}' style="
                                    width: 100%; padding: 12px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 13px; font-family: monospace; margin-bottom: 12px;
                                ">${this.firebaseConfig.apiKey ? JSON.stringify(this.firebaseConfig, null, 2) : ''}</textarea>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                                    <input type="email" id="firebase-email" placeholder="admin@example.com" style="padding: 12px; border: 2px solid #e2e8f0; border-radius: 8px;">
                                    <input type="password" id="firebase-password" placeholder="••••••••" style="padding: 12px; border: 2px solid #e2e8f0; border-radius: 8px;">
                                </div>
                                <button onclick="backupModule.saveFirebaseConfig()" style="
                                    background: linear-gradient(135deg, #ed8936 0%, #dd6b20 100%); color: white; border: none; padding: 12px; border-radius: 8px; font-weight: 600; cursor: pointer; width: 100%;
                                ">🔥 Connect Firebase</button>
                            ` : `
                                <div style="background: #c6f6d5; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
                                    <div style="font-weight: 600; color: #22543d;">✅ Terhubung: ${this.currentUser.email}</div>
                                    <div style="font-size: 12px; color: #2d3748; margin-top: 4px;">User ID: ${this.currentUser.uid.substring(0, 20)}...</div>
                                </div>
                                <button onclick="backupModule.logoutFirebase()" style="
                                    background: #fed7d7; color: #c53030; border: 2px solid #fc8181; padding: 12px; border-radius: 8px; font-weight: 600; cursor: pointer; width: 100%;
                                ">🚫 Logout Firebase</button>
                            `}
                            <div id="firebase-auth-status" style="margin-top: 12px; padding: 12px; background: #fffaf0; border-radius: 8px; font-size: 13px; display: none;"></div>
                        </div>
                    </div>
                </div>

                <div style="background: white; border-radius: 12px; padding: 20px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <div style="font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #2d3748;">🤖 Konfigurasi Telegram</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                        <input type="text" id="telegram-bot-token" value="${this.config.telegram.botToken}" placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz" style="padding: 12px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 14px;">
                        <input type="text" id="telegram-chat-id" value="${this.config.telegram.chatId}" placeholder="-1001234567890" style="padding: 12px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 14px;">
                    </div>
                    <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px; cursor: pointer;">
                        <input type="checkbox" id="telegram-enabled" ${this.config.telegram.enabled ? 'checked' : ''} style="width: 18px; height: 18px;">
                        <span style="font-size: 14px; color: #4a5568;">Aktifkan notifikasi Telegram</span>
                    </label>
                    <button onclick="backupModule.handleSaveTelegram()" style="
                        background: linear-gradient(135deg, #38b2ac 0%, #319795 100%); color: white; border: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; cursor: pointer; width: 100%;
                    ">📱 Simpan Konfigurasi Telegram</button>
                </div>

                <div style="background: white; border-radius: 12px; padding: 20px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <div style="font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #2d3748;">🔍 Konfigurasi Pencarian (N8N)</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                        <input type="text" id="n8n-bot-token" value="${this.config.n8n.botToken}" placeholder="Bot token untuk pencarian" style="padding: 12px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 14px;">
                        <input type="text" id="n8n-chat-id" value="${this.config.n8n.chatId}" placeholder="Chat ID" style="padding: 12px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 14px;">
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                        <input type="text" id="n8n-sheet-id" value="${this.config.n8n.sheetId}" placeholder="Sheet ID untuk pencarian" style="padding: 12px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 14px;">
                        <input type="text" id="n8n-gas-url" value="${this.config.n8n.gasUrl}" placeholder="GAS URL untuk pencarian" style="padding: 12px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 14px;">
                    </div>
                    <button onclick="backupModule.handleSaveN8n()" style="
                        background: linear-gradient(135deg, #9f7aea 0%, #805ad5 100%); color: white; border: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; cursor: pointer; width: 100%;
                    ">🔍 Simpan Konfigurasi Pencarian</button>
                </div>

                <div style="background: white; border-radius: 12px; padding: 20px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <div style="font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #2d3748;">⚡ Auto Sync & Auto Save</div>
                    <label style="display: flex; align-items: center; gap: 12px; cursor: pointer; padding: 12px; background: #f7fafc; border-radius: 8px; margin-bottom: 12px;">
                        <input type="checkbox" id="auto-sync-checkbox" ${this.isAutoSyncEnabled ? 'checked' : ''} onchange="backupModule.toggleAutoSync(this.checked)" style="width: 20px; height: 20px;">
                        <div>
                            <div style="font-weight: 600; color: #2d3748;">Auto Sync ke Cloud</div>
                            <div style="font-size: 12px; color: #718096;">Otomatis backup saat data berubah (transaksi, produk, dll)</div>
                        </div>
                    </label>
                    <label style="display: flex; align-items: center; gap: 12px; cursor: pointer; padding: 12px; background: #f7fafc; border-radius: 8px;">
                        <input type="checkbox" id="auto-save-local-checkbox" ${this.isAutoSaveLocalEnabled ? 'checked' : ''} onchange="backupModule.toggleAutoSaveLocal(this.checked)" style="width: 20px; height: 20px;">
                        <div>
                            <div style="font-weight: 600; color: #2d3748;">Auto Save Local</div>
                            <div style="font-size: 12px; color: #718096;">Simpan otomatis ke local storage setiap perubahan</div>
                        </div>
                    </label>
                </div>

                <div style="background: white; border-radius: 12px; padding: 20px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <div style="font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #2d3748;">🔄 Aksi Sinkronisasi</div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px;">
                        <button onclick="backupModule.syncToCloud()" ${this.currentProvider === 'local' || sheetsLoggedOut || isFirebaseLoggedOut ? 'disabled' : ''} style="
                            background: ${this.currentProvider === 'local' || sheetsLoggedOut || isFirebaseLoggedOut ? '#e2e8f0' : 'linear-gradient(135deg, #4299e1 0%, #3182ce 100%)'};
                            color: ${this.currentProvider === 'local' || sheetsLoggedOut || isFirebaseLoggedOut ? '#a0aec0' : 'white'};
                            border: none; padding: 14px; border-radius: 10px; font-weight: 600;
                            cursor: ${this.currentProvider === 'local' || sheetsLoggedOut || isFirebaseLoggedOut ? 'not-allowed' : 'pointer'};
                            opacity: ${this.currentProvider === 'local' || sheetsLoggedOut || isFirebaseLoggedOut ? '0.6' : '1'};
                        ">
                            <span style="font-size: 20px;">⬆️</span><span>Upload ke Cloud</span>
                        </button>
                        <button onclick="backupModule.syncFromCloud()" ${this.currentProvider === 'local' || sheetsLoggedOut || isFirebaseLoggedOut ? 'disabled' : ''} style="
                            background: ${this.currentProvider === 'local' || sheetsLoggedOut || isFirebaseLoggedOut ? '#e2e8f0' : 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)'};
                            color: ${this.currentProvider === 'local' || sheetsLoggedOut || isFirebaseLoggedOut ? '#a0aec0' : 'white'};
                            border: none; padding: 14px; border-radius: 10px; font-weight: 600;
                            cursor: ${this.currentProvider === 'local' || sheetsLoggedOut || isFirebaseLoggedOut ? 'not-allowed' : 'pointer'};
                            opacity: ${this.currentProvider === 'local' || sheetsLoggedOut || isFirebaseLoggedOut ? '0.6' : '1'};
                        ">
                            <span style="font-size: 20px;">⬇️</span><span>Download dari Cloud</span>
                        </button>
                        <button onclick="backupModule.previewCloudData()" ${this.currentProvider === 'local' || sheetsLoggedOut || isFirebaseLoggedOut ? 'disabled' : ''} style="
                            background: ${this.currentProvider === 'local' || sheetsLoggedOut || isFirebaseLoggedOut ? '#e2e8f0' : 'linear-gradient(135deg, #9f7aea 0%, #805ad5 100%)'};
                            color: ${this.currentProvider === 'local' || sheetsLoggedOut || isFirebaseLoggedOut ? '#a0aec0' : 'white'};
                            border: none; padding: 14px; border-radius: 10px; font-weight: 600;
                            cursor: ${this.currentProvider === 'local' || sheetsLoggedOut || isFirebaseLoggedOut ? 'not-allowed' : 'pointer'};
                            opacity: ${this.currentProvider === 'local' || sheetsLoggedOut || isFirebaseLoggedOut ? '0.6' : '1'};
                        ">
                            <span style="font-size: 20px;">👁️</span><span>Preview Cloud Data</span>
                        </button>
                        <button onclick="backupModule.checkCloudDataOnLoad(true)" ${this.currentProvider === 'local' || sheetsLoggedOut || isFirebaseLoggedOut ? 'disabled' : ''} style="
                            background: ${this.currentProvider === 'local' || sheetsLoggedOut || isFirebaseLoggedOut ? '#e2e8f0' : 'linear-gradient(135deg, #ed8936 0%, #dd6b20 100%)'};
                            color: ${this.currentProvider === 'local' || sheetsLoggedOut || isFirebaseLoggedOut ? '#a0aec0' : 'white'};
                            border: none; padding: 14px; border-radius: 10px; font-weight: 600;
                            cursor: ${this.currentProvider === 'local' || sheetsLoggedOut || isFirebaseLoggedOut ? 'not-allowed' : 'pointer'};
                            opacity: ${this.currentProvider === 'local' || sheetsLoggedOut || isFirebaseLoggedOut ? '0.6' : '1'};
                        ">
                            <span style="font-size: 20px;">🔄</span><span>Check Update</span>
                        </button>
                    </div>
                </div>

                <div style="background: white; border-radius: 12px; padding: 20px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <div style="font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #2d3748;">💾 Backup Manual</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <button onclick="backupModule.downloadLocalBackup()" style="background: #e2e8f0; color: #4a5568; border: none; padding: 14px; border-radius: 10px; font-weight: 600; cursor: pointer;">
                            ⬇️ Download Backup
                        </button>
                        <label style="background: #e2e8f0; color: #4a5568; border: none; padding: 14px; border-radius: 10px; font-weight: 600; cursor: pointer; text-align: center;">
                            ⬆️ Upload Backup
                            <input type="file" accept=".json" onchange="backupModule.uploadLocalBackup(this)" style="display: none;">
                        </label>
                    </div>
                </div>

                <div style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <div style="font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #2d3748;">🗑️ Zona Berbahaya</div>
                    <button onclick="backupModule.clearAllData()" style="
                        background: #fed7d7; color: #c53030; border: 2px solid #fc8181;
                        padding: 14px; border-radius: 10px; font-weight: 600; cursor: pointer; width: 100%;
                    ">⚠️ Hapus Semua Data</button>
                </div>
            </div>
        `;

        this.isRendered = true;
        this.updateSyncStatus(this.syncStatus);
    },

    getStatusBadge() {
        const sheetsLoggedOut = localStorage.getItem(this.KEYS.SHEETS_LOGGED_OUT) === 'true';
        const isFirebaseLoggedOut = !this.currentUser && this.currentProvider === 'firebase';
        
        let text = '✓ Siap';
        let color = '#48bb78';
        let bg = '#c6f6d5';
        
        if (sheetsLoggedOut || isFirebaseLoggedOut) {
            text = '🚫 Logged Out';
            color = '#c53030';
            bg = '#fed7d7';
        } else if (this.syncStatus === this.SYNC_STATUS.SYNCED) {
            text = '✓ Tersinkron';
            color = '#22543d';
            bg = '#c6f6d5';
        } else if (this.syncStatus === this.SYNC_STATUS.SYNCING) {
            text = '⟳ Sinkron...';
            color = '#2a4365';
            bg = '#bee3f8';
        } else if (this.syncStatus === this.SYNC_STATUS.ERROR) {
            text = '✗ Error';
            color = '#742a2a';
            bg = '#fed7d7';
        } else if (this.syncStatus === this.SYNC_STATUS.OFFLINE) {
            text = '● Offline';
            color = '#4a5568';
            bg = '#e2e8f0';
        }
        
        return `<span style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: ${bg}; color: ${color}; border-radius: 20px; font-size: 12px; font-weight: 600;">${text}</span>`;
    },

    // ==========================================
    // HANDLERS
    // ==========================================
    
    handleSaveTelegram() {
        const botToken = document.getElementById('telegram-bot-token')?.value?.trim() || '';
        const chatId = document.getElementById('telegram-chat-id')?.value?.trim() || '';
        const enabled = document.getElementById('telegram-enabled')?.checked || false;
        
        this.saveTelegramConfig(botToken, chatId, enabled, this.gasUrl, this.sheetId);
    },

    handleSaveN8n() {
        const botToken = document.getElementById('n8n-bot-token')?.value?.trim() || '';
        const chatId = document.getElementById('n8n-chat-id')?.value?.trim() || '';
        const sheetId = document.getElementById('n8n-sheet-id')?.value?.trim() || '';
        const gasUrl = document.getElementById('n8n-gas-url')?.value?.trim() || '';
        
        this.saveN8nConfig(botToken, chatId, sheetId, gasUrl);
    },

    changeProvider(provider) {
        this.currentProvider = provider;
        localStorage.setItem(this.KEYS.PROVIDER, provider);
        this.saveBackupSettings();
        this.showToast('Provider diubah ke: ' + provider);
        this.refreshUI();
    },

    saveGASConfig() {
        const url = document.getElementById('gas-url-input')?.value?.trim() || '';
        const sheetId = document.getElementById('sheet-id-input')?.value?.trim() || '';
        
        if (!url || !sheetId) {
            this.showToast('❌ URL dan Sheet ID wajib diisi');
            return;
        }
        
        this.gasUrl = url;
        this.sheetId = this.cleanSheetId(sheetId);
        
        localStorage.setItem(this.KEYS.GAS_URL, this.gasUrl);
        localStorage.setItem(this.KEYS.SHEET_ID, this.sheetId);
        localStorage.removeItem(this.KEYS.SHEETS_LOGGED_OUT);
        
        this._gasConfigValid = this.gasUrl && this.sheetId && this.sheetId.length === 44;
        this.saveBackupSettings();
        
        this.showToast('✅ Konfigurasi GAS disimpan');
        
        if (this._gasConfigValid) {
            this.checkNewDeviceGAS();
            setTimeout(() => this.checkCloudDataOnLoad(true), 1000);
        }
        
        this.refreshUI();
    },

    saveFirebaseConfig() {
        const configText = document.getElementById('firebase-config-input')?.value?.trim() || '';
        const email = document.getElementById('firebase-email')?.value?.trim() || '';
        const password = document.getElementById('firebase-password')?.value || '';
        
        if (!configText) {
            this.showToast('❌ Config Firebase wajib diisi');
            return;
        }
        
        try {
            const config = JSON.parse(configText);
            this.firebaseConfig = config;
            localStorage.setItem(this.KEYS.FIREBASE_CONFIG, JSON.stringify(config));
            
            if (email && password) {
                localStorage.setItem(this.KEYS.FB_AUTH_EMAIL, email);
                localStorage.setItem(this.KEYS.FB_AUTH_PASSWORD, password);
            }
            
            this._isManualLogout = false;
            this.saveBackupSettings();
            this.showToast('✅ Konfigurasi Firebase disimpan');
            this.initFirebase(true);
        } catch (e) {
            this.showToast('❌ Format JSON tidak valid');
        }
    },

    toggleAutoSync(enabled) {
        this.isAutoSyncEnabled = enabled;
        localStorage.setItem(this.KEYS.AUTO_SYNC, enabled);
        
        if (enabled && this._gasConfigValid) {
            this.startAutoSync();
        } else {
            this.stopAutoSync();
        }
        
        this.showToast(enabled ? 'Auto sync diaktifkan' : 'Auto sync dinonaktifkan');
    },

    toggleAutoSaveLocal(enabled) {
        this.isAutoSaveLocalEnabled = enabled;
        localStorage.setItem(this.KEYS.AUTO_SAVE_LOCAL, enabled);
        this.saveBackupSettings();
        this.showToast(enabled ? 'Auto save local diaktifkan' : 'Auto save local dinonaktifkan');
    },

    startAutoSync() {
        if (this.autoSyncInterval) {
            clearInterval(this.autoSyncInterval);
        }
        
        this.autoSyncInterval = setInterval(() => {
            if (this.isOnline && !this.isSyncing) {
                this.syncToCloud(true);
            }
        }, 300000); // 5 menit
        
        console.log('[Backup] Auto sync started (5 menit)');
    },

    stopAutoSync() {
        if (this.autoSyncInterval) {
            clearInterval(this.autoSyncInterval);
            this.autoSyncInterval = null;
        }
        console.log('[Backup] Auto sync stopped');
    },

    // ==========================================
    // SYNC METHODS
    // ==========================================
    
    prepareDataForSync() {
        if (typeof dataManager === 'undefined' || !dataManager.data) {
            throw new Error('Data manager tidak tersedia');
        }
        
        const rawData = dataManager.data;
        
        // Pastikan config sudah tersinkron
        this.syncConfigToDataManager();
        
        return {
            products: this.cleanUndefined(rawData.products) || [],
            transactions: this.cleanUndefined(rawData.transactions) || [],
            cashTransactions: this.cleanUndefined(rawData.cashTransactions) || [],
            debts: this.cleanUndefined(rawData.debts) || [],
            categories: this.cleanUndefined(rawData.categories) || [],
            users: this.cleanUndefined(rawData.users) || [],
            searchHistory: this.cleanUndefined(rawData.searchHistory) || [],
            pendingModals: this.cleanUndefined(rawData.pendingModals) || {},
            pendingExtraModals: this.cleanUndefined(rawData.pendingExtraModals) || {},
            modalHistory: this.cleanUndefined(rawData.modalHistory) || [],
            
            // Config disimpan dalam data utama
            telegram: { ...this.config.telegram },
            n8nConfig: { ...this.config.n8n },
            
            _backupMeta: {
                backupDate: new Date().toISOString(),
                deviceId: this.deviceId,
                version: '4.3.7',
                recordCounts: {
                    products: (rawData.products || []).length,
                    transactions: (rawData.transactions || []).length,
                    cashTransactions: (rawData.cashTransactions || []).length,
                    debts: (rawData.debts || []).length,
                    categories: (rawData.categories || []).length,
                    users: (rawData.users || []).length
                }
            },
            _configMeta: {
                provider: this.currentProvider,
                gasUrl: this.gasUrl,
                sheetId: this.sheetId,
                firebaseConfig: this.firebaseConfig,
                autoSync: this.isAutoSyncEnabled,
                telegram: { ...this.config.telegram },
                n8n: { ...this.config.n8n },
                version: '4.3.7',
                savedAt: new Date().toISOString(),
                savedBy: this.deviceId
            }
        };
    },

    applyDataFromCloud(cloudData) {
        if (typeof dataManager === 'undefined' || !dataManager.data) {
            throw new Error('Data manager tidak tersedia');
        }
        
        const data = dataManager.data;
        
        // Apply data utama
        if (cloudData.products) data.products = cloudData.products;
        if (cloudData.transactions) data.transactions = cloudData.transactions;
        if (cloudData.cashTransactions) data.cashTransactions = cloudData.cashTransactions;
        if (cloudData.debts) data.debts = cloudData.debts;
        if (cloudData.categories) data.categories = cloudData.categories;
        if (cloudData.users) data.users = cloudData.users;
        if (cloudData.searchHistory) data.searchHistory = cloudData.searchHistory;
        if (cloudData.pendingModals) data.pendingModals = cloudData.pendingModals;
        if (cloudData.pendingExtraModals) data.pendingExtraModals = cloudData.pendingExtraModals;
        if (cloudData.modalHistory) data.modalHistory = cloudData.modalHistory;
        
        // Apply config dari cloud
        if (cloudData.telegram) {
            data.telegram = { ...cloudData.telegram };
            this.config.telegram = { ...cloudData.telegram };
            console.log('[Backup] Telegram config restored from cloud');
        }
        
        if (cloudData.n8nConfig) {
            data.n8nConfig = { ...cloudData.n8nConfig };
            this.config.n8n = { ...cloudData.n8nConfig };
            console.log('[Backup] N8N config restored from cloud');
        }
        
        // Apply dari _configMeta juga
        if (cloudData._configMeta) {
            if (cloudData._configMeta.telegram) {
                data.telegram = { ...cloudData._configMeta.telegram };
                this.config.telegram = { ...cloudData._configMeta.telegram };
            }
            if (cloudData._configMeta.n8n) {
                data.n8nConfig = { ...cloudData._configMeta.n8n };
                this.config.n8n = { ...cloudData._configMeta.n8n };
            }
        }
        
        // Broadcast config ke semua modul setelah restore
        this.broadcastConfigToModules();
        
        // Save
        if (typeof dataManager.save === 'function') {
            dataManager.save();
        }
        
        console.log('[Backup] All data including configs applied from cloud');
    },

    async syncToCloud(silent = false) {
        if (!this.isOnline) {
            if (!silent) this.showToast('📴 Offline - Tidak bisa sync');
            return;
        }
        
        if (this.isSyncing) {
            console.log('[Backup] Sync already in progress');
            return;
        }
        
        if (this.currentProvider === 'googlesheet' && localStorage.getItem(this.KEYS.SHEETS_LOGGED_OUT) === 'true') {
            if (!silent) this.showToast('🚫 Google Sheets logged out');
            return;
        }
        
        if (this.currentProvider === 'firebase' && !this.currentUser) {
            if (!silent) this.showToast('🚫 Firebase logged out');
            return;
        }
        
        this.isSyncing = true;
        this.syncStatus = this.SYNC_STATUS.SYNCING;
        this.render();
        
        try {
            const dataToSync = this.prepareDataForSync();
            
            if (this.currentProvider === 'firebase' && this.currentUser) {
                await this.uploadToFirebase(dataToSync);
            } else if (this.currentProvider === 'googlesheet' && this._gasConfigValid) {
                await this.uploadToGAS(dataToSync);
            } else {
                throw new Error('Provider tidak valid atau belum dikonfigurasi');
            }
            
            this.lastSyncTime = new Date().toISOString();
            localStorage.setItem(this.KEYS.LAST_SYNC, this.lastSyncTime);
            this.syncStatus = this.SYNC_STATUS.SYNCED;
            
            if (!silent) this.showToast('✅ Sync berhasil');
            
        } catch (err) {
            console.error('[Backup] Sync error:', err);
            this.syncStatus = this.SYNC_STATUS.ERROR;
            if (!silent) this.showToast('❌ Sync gagal: ' + err.message);
        } finally {
            this.isSyncing = false;
            this.render();
        }
    },

    async syncFromCloud() {
        if (!this.isOnline) {
            this.showToast('📴 Offline - Tidak bisa sync');
            return;
        }
        
        if (this.isSyncing) return;
        
        if (!confirm('⚠️ Download dari cloud akan menimpa data lokal. Lanjutkan?')) {
            return;
        }
        
        this.isSyncing = true;
        this.syncStatus = this.SYNC_STATUS.SYNCING;
        this.render();
        
        try {
            let cloudData = null;
            
            if (this.currentProvider === 'firebase' && this.currentUser) {
                const snapshot = await this.database.ref('users/' + this.currentUser.uid + '/hifzi_data').once('value');
                cloudData = snapshot.val();
            } else if (this.currentProvider === 'googlesheet' && this._gasConfigValid) {
                cloudData = await this.downloadFromGAS();
            } else {
                throw new Error('Provider tidak valid');
            }
            
            if (!cloudData) {
                throw new Error('Tidak ada data di cloud');
            }
            
            this.applyDataFromCloud(cloudData);
            
            this.lastSyncTime = new Date().toISOString();
            localStorage.setItem(this.KEYS.LAST_SYNC, this.lastSyncTime);
            this.syncStatus = this.SYNC_STATUS.SYNCED;
            this.showToast('✅ Download berhasil! Config Telegram & N8N juga direstore.');
            
        } catch (err) {
            console.error('[Backup] Download error:', err);
            this.syncStatus = this.SYNC_STATUS.ERROR;
            this.showToast('❌ Download gagal: ' + err.message);
        } finally {
            this.isSyncing = false;
            this.render();
        }
    },

    async uploadToFirebase(data) {
        if (!this.database || !this.currentUser) {
            throw new Error('Firebase belum terinisialisasi');
        }
        
        const userRef = this.database.ref('users/' + this.currentUser.uid + '/hifzi_data');
        await userRef.set(data);
    },

    async uploadToGAS(data) {
        if (!this._gasConfigValid) {
            throw new Error('GAS belum dikonfigurasi');
        }
        
        const payload = {
            action: 'upload',
            sheetId: this.sheetId,
            data: data,
            deviceId: this.deviceId
        };
        
        const response = await fetch(this.gasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            throw new Error('GAS upload failed: ' + response.status);
        }
        
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.message || 'Upload gagal');
        }
    },

    async downloadFromGAS() {
        if (!this._gasConfigValid) {
            throw new Error('GAS belum dikonfigurasi');
        }
        
        const payload = {
            action: 'download',
            sheetId: this.sheetId,
            deviceId: this.deviceId
        };
        
        const response = await fetch(this.gasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            throw new Error('GAS download failed: ' + response.status);
        }
        
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.message || 'Download gagal');
        }
        
        return result.data;
    },

    async checkCloudDataOnLoad(force = false) {
        if (!this.isOnline) return;
        if (this.isSyncing) return;
        if (!force && this.hasCheckedCloudOnLoad) return;
        
        if (this.currentProvider === 'local') return;
        if (this.currentProvider === 'googlesheet' && !this._gasConfigValid) return;
        if (this.currentProvider === 'firebase' && !this._firebaseAuthStateReady) return;
        
        this.syncStatus = this.SYNC_STATUS.CHECKING;
        this.render();
        
        try {
            let cloudData = null;
            
            if (this.currentProvider === 'firebase' && this.currentUser) {
                const snapshot = await this.database.ref('users/' + this.currentUser.uid + '/hifzi_data').once('value');
                cloudData = snapshot.val();
            } else if (this.currentProvider === 'googlesheet' && this._gasConfigValid) {
                cloudData = await this.downloadFromGAS();
            }
            
            this.hasCheckedCloudOnLoad = true;
            
            if (!cloudData) {
                this.syncStatus = this.SYNC_STATUS.IDLE;
                this.render();
                return;
            }
            
            const cloudDate = cloudData._backupMeta?.backupDate;
            const localDate = this.lastSyncTime;
            
            if (cloudDate && (!localDate || new Date(cloudDate) > new Date(localDate))) {
                this.syncStatus = this.SYNC_STATUS.CLOUD_NEWER;
                this.showToast('☁️ Ada data baru di cloud!');
            } else {
                this.syncStatus = this.SYNC_STATUS.SYNCED;
            }
            
        } catch (err) {
            console.error('[Backup] Check cloud error:', err);
            this.syncStatus = this.SYNC_STATUS.ERROR;
        } finally {
            this.render();
        }
    },

    checkNewDeviceGAS() {
        console.log('[Backup] Checking new device GAS...');
    },

    // ==========================================
    // PREVIEW
    // ==========================================
    
    async previewCloudData() {
        if (!this.isOnline) {
            this.showToast('📴 Offline - Tidak bisa preview');
            return;
        }
        
        if (this.currentProvider === 'local') {
            this.showToast('💾 Mode Local - Tidak ada cloud data');
            return;
        }
        
        const sheetsLoggedOut = localStorage.getItem(this.KEYS.SHEETS_LOGGED_OUT) === 'true';
        const isFirebaseLoggedOut = !this.currentUser && this.currentProvider === 'firebase';
        
        if (sheetsLoggedOut || isFirebaseLoggedOut) {
            this.showToast('🚫 Anda harus login terlebih dahulu');
            return;
        }
        
        this.showToast('🔍 Mengambil data dari cloud...');
        
        try {
            let cloudData = null;
            let source = '';
            
            if (this.currentProvider === 'firebase' && this.currentUser) {
                const snapshot = await this.database.ref('users/' + this.currentUser.uid + '/hifzi_data').once('value');
                cloudData = snapshot.val();
                source = 'Firebase';
            } else if (this.currentProvider === 'googlesheet' && this._gasConfigValid) {
                const result = await this.downloadFromGAS();
                cloudData = result;
                source = 'Google Sheets';
            }
            
            if (!cloudData) {
                this.showToast('ℹ️ Tidak ada data di cloud');
                return;
            }
            
            this.showPreviewModal(cloudData, source);
            
        } catch (err) {
            console.error('[Backup] Preview error:', err);
            this.showToast('❌ Gagal preview: ' + err.message);
        }
    },

    showPreviewModal(data, source) {
        const productCount = data.products?.length || 0;
        const transactionCount = data.transactions?.length || 0;
        const debtCount = data.debts?.length || 0;
        const cashCount = data.cashTransactions?.length || 0;
        const hasTelegram = data.telegram?.botToken ? true : false;
        const hasN8n = data.n8nConfig?.botToken ? true : false;
        
        const existingModal = document.getElementById('preview-modal');
        if (existingModal) existingModal.remove();
        
        const modal = document.createElement('div');
        modal.id = 'preview-modal';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.85); z-index: 10000; display: flex;
            align-items: center; justify-content: center; padding: 20px;
            overflow-y: auto; font-family: system-ui, sans-serif;
        `;
        
        modal.innerHTML = `
            <div style="
                background: white; border-radius: 16px; max-width: 600px; width: 100%;
                max-height: 90vh; overflow: hidden; display: flex; flex-direction: column;
                animation: slideUp 0.3s ease;
            ">
                <div style="
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white; padding: 20px; flex-shrink: 0;
                ">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-size: 20px; font-weight: 700;">👁️ Preview Data Cloud</div>
                            <div style="font-size: 13px; opacity: 0.9; margin-top: 4px;">Sumber: ${source}</div>
                        </div>
                        <button onclick="document.getElementById('preview-modal').remove()" style="
                            background: rgba(255,255,255,0.2); border: none; color: white;
                            width: 36px; height: 36px; border-radius: 50%; cursor: pointer; font-size: 20px;
                        ">×</button>
                    </div>
                </div>
                
                <div style="padding: 20px; overflow-y: auto; flex: 1; background: #f7fafc;">
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 20px;">
                        <div style="background: white; padding: 16px; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                            <div style="font-size: 24px; font-weight: 700; color: #667eea;">${productCount}</div>
                            <div style="font-size: 12px; color: #718096;">📦 Produk</div>
                        </div>
                        <div style="background: white; padding: 16px; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                            <div style="font-size: 24px; font-weight: 700; color: #48bb78;">${transactionCount}</div>
                            <div style="font-size: 12px; color: #718096;">📝 Transaksi</div>
                        </div>
                        <div style="background: white; padding: 16px; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                            <div style="font-size: 24px; font-weight: 700; color: #ed8936;">${debtCount}</div>
                            <div style="font-size: 12px; color: #718096;">💳 Hutang</div>
                        </div>
                        <div style="background: white; padding: 16px; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                            <div style="font-size: 24px; font-weight: 700; color: #38b2ac;">${cashCount}</div>
                            <div style="font-size: 12px; color: #718096;">💸 Cash Flow</div>
                        </div>
                    </div>
                    
                    <div style="background: white; padding: 16px; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 20px;">
                        <div style="font-size: 14px; font-weight: 600; color: #2d3748; margin-bottom: 12px;">⚙️ Konfigurasi di Cloud:</div>
                        <div style="display: flex; gap: 16px; flex-wrap: wrap;">
                            <span style="color: ${hasTelegram ? '#38a169' : '#e53e3e'}; font-size: 13px;">
                                ${hasTelegram ? '✅' : '❌'} Telegram Bot
                            </span>
                            <span style="color: ${hasN8n ? '#38a169' : '#e53e3e'}; font-size: 13px;">
                                ${hasN8n ? '✅' : '❌'} N8N/Pencarian
                            </span>
                        </div>
                        ${data.telegram?.botToken ? `
                            <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #718096;">
                                <div>Bot Token: ${data.telegram.botToken.substring(0, 15)}...</div>
                                <div>Chat ID: ${data.telegram.chatId || '-'}</div>
                                <div>Enabled: ${data.telegram.enabled ? 'Ya' : 'Tidak'}</div>
                            </div>
                        ` : ''}
                        ${data.n8nConfig?.botToken ? `
                            <div style="margin-top: 8px; font-size: 12px; color: #718096;">
                                <div>N8N Token: ${data.n8nConfig.botToken.substring(0, 15)}...</div>
                                <div>Chat ID: ${data.n8nConfig.chatId || '-'}</div>
                            </div>
                        ` : ''}
                    </div>
                    
                    <div style="background: white; padding: 16px; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                        <div style="font-size: 14px; font-weight: 600; color: #2d3748; margin-bottom: 8px;">📅 Metadata:</div>
                        <div style="font-size: 12px; color: #718096; line-height: 1.6;">
                            <div>Backup Date: ${data._backupMeta?.backupDate ? new Date(data._backupMeta.backupDate).toLocaleString('id-ID') : '-'}</div>
                            <div>Device ID: ${data._backupMeta?.deviceId || '-'}</div>
                            <div>Version: ${data._backupMeta?.version || '-'}</div>
                        </div>
                    </div>
                </div>
                
                <div style="padding: 20px; border-top: 1px solid #e2e8f0; display: flex; gap: 12px; justify-content: flex-end; background: white; flex-shrink: 0;">
                    <button onclick="document.getElementById('preview-modal').remove()" style="
                        padding: 12px 24px; background: #e2e8f0; color: #4a5568;
                        border: none; border-radius: 8px; font-weight: 600; cursor: pointer;
                    ">Tutup</button>
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
    },

    // ==========================================
    // UTILITIES
    // ==========================================
    
    cleanUndefined(obj) {
        if (obj === null || obj === undefined) return null;
        
        if (Array.isArray(obj)) {
            return obj.map(item => this.cleanUndefined(item)).filter(item => item !== undefined);
        }
        
        if (typeof obj === 'object') {
            const cleaned = {};
            for (const [key, value] of Object.entries(obj)) {
                if (value !== undefined) {
                    cleaned[key] = this.cleanUndefined(value);
                }
            }
            return cleaned;
        }
        
        return obj;
    },

    cleanSheetId(sheetId) {
        if (!sheetId) return '';
        let cleaned = sheetId.trim();
        cleaned = cleaned.replace(/[?&].*$/, '');
        cleaned = cleaned.replace(/\/edit.*$/, '');
        cleaned = cleaned.replace(/\/.*$/, '');
        return cleaned;
    },

    loadBackupSettings() {
        const settings = localStorage.getItem(this.KEYS.BACKUP_SETTINGS);
        if (settings) {
            try {
                const parsed = JSON.parse(settings);
                this.currentProvider = parsed.provider || 'local';
                this.gasUrl = parsed.gasUrl || '';
                this.sheetId = parsed.sheetId || '';
                this.isAutoSyncEnabled = parsed.autoSync || false;
                this.isAutoSaveLocalEnabled = parsed.autoSaveLocal !== false;
            } catch (e) {
                console.error('[Backup] Error loading settings:', e);
            }
        }
        
        const savedProvider = localStorage.getItem(this.KEYS.PROVIDER);
        if (savedProvider) this.currentProvider = savedProvider;
        
        const savedGasUrl = localStorage.getItem(this.KEYS.GAS_URL);
        if (savedGasUrl) this.gasUrl = savedGasUrl;
        
        const savedSheetId = localStorage.getItem(this.KEYS.SHEET_ID);
        if (savedSheetId) this.sheetId = savedSheetId;
        
        const savedAutoSync = localStorage.getItem(this.KEYS.AUTO_SYNC);
        if (savedAutoSync !== null) this.isAutoSyncEnabled = savedAutoSync === 'true';
        
        const savedFirebaseConfig = localStorage.getItem(this.KEYS.FIREBASE_CONFIG);
        if (savedFirebaseConfig) {
            try {
                this.firebaseConfig = JSON.parse(savedFirebaseConfig);
            } catch (e) {
                console.error('[Backup] Error parsing Firebase config:', e);
            }
        }
    },

    saveBackupSettings() {
        const settings = {
            provider: this.currentProvider,
            gasUrl: this.gasUrl,
            sheetId: this.sheetId,
            autoSync: this.isAutoSyncEnabled,
            autoSaveLocal: this.isAutoSaveLocalEnabled,
            savedAt: new Date().toISOString()
        };
        localStorage.setItem(this.KEYS.BACKUP_SETTINGS, JSON.stringify(settings));
    },

    downloadLocalBackup() {
        if (typeof dataManager === 'undefined' || !dataManager.data) {
            this.showToast('❌ Data tidak tersedia');
            return;
        }
        
        const data = this.prepareDataForSync();
        const dataStr = JSON.stringify(data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `hifzi_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showToast('✅ Backup diunduh');
    },

    uploadLocalBackup(input) {
        const file = input.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                this.applyDataFromCloud(data);
                this.showToast('✅ Backup berhasil diupload! Config juga direstore.');
                this.render();
            } catch (err) {
                this.showToast('❌ Format file tidak valid');
            }
        };
        reader.readAsText(file);
        input.value = '';
    },

    clearAllData() {
        if (!confirm('⚠️ PERINGATAN: Semua data akan dihapus permanen! Lanjutkan?')) {
            return;
        }
        
        if (!confirm('⚠️ Anda YAKIN? Data yang dihapus tidak bisa dikembalikan!')) {
            return;
        }
        
        if (typeof dataManager !== 'undefined' && dataManager.data) {
            dataManager.data = {
                products: [],
                transactions: [],
                cashTransactions: [],
                debts: [],
                categories: [],
                users: [],
                searchHistory: [],
                pendingModals: {},
                pendingExtraModals: {},
                modalHistory: [],
                telegram: this.config.telegram,
                n8nConfig: this.config.n8n
            };
            
            if (typeof dataManager.save === 'function') {
                dataManager.save();
            }
        }
        
        this.showToast('🗑️ Semua data dihapus');
        
        if (typeof renderModule === 'function') {
            renderModule();
        }
    },

    showToast(message) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed; top: 20px; right: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; padding: 16px 24px; border-radius: 12px;
            z-index: 99999; font-family: system-ui, sans-serif;
            font-weight: 600; box-shadow: 0 8px 24px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease; max-width: 400px;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    },

    setupNetworkListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.syncStatus = this.SYNC_STATUS.IDLE;
            if (this.isAutoSyncEnabled && this._gasConfigValid) {
                this.debouncedSync();
            }
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.syncStatus = this.SYNC_STATUS.OFFLINE;
        });
    },

    debouncedSync() {
        clearTimeout(this.syncDebounceTimer);
        this.syncDebounceTimer = setTimeout(() => {
            if (this.isOnline && !this.isSyncing) {
                this.syncToCloud();
            }
        }, 5000);
    },

    updateSyncStatus(status, message = '') {
        this.syncStatus = status;
        
        const statusIndicator = document.getElementById('sync-status-indicator');
        if (statusIndicator) {
            statusIndicator.innerHTML = this.getStatusBadge();
        }
        
        const lastSyncEl = document.getElementById('last-sync-time');
        if (lastSyncEl && this.lastSyncTime) {
            lastSyncEl.textContent = new Date(this.lastSyncTime).toLocaleString('id-ID');
        }
    },

    initFirebase(forceReinit = false) {
        if (typeof firebase === 'undefined') {
            console.error('[Backup] Firebase SDK not loaded');
            return;
        }
        
        try {
            const existingApp = firebase.app('hifzi_backup');
            if (existingApp && !forceReinit) {
                this.firebaseApp = existingApp;
                this.database = firebase.database(this.firebaseApp);
                this.auth = firebase.auth(this.firebaseApp);
                return;
            }
        } catch (e) {
            // App belum ada
        }
        
        if (!this.firebaseConfig.apiKey) {
            console.log('[Backup] No Firebase config');
            return;
        }
        
        try {
            if (forceReinit) {
                try {
                    const existingApp = firebase.app('hifzi_backup');
                    if (existingApp) existingApp.delete();
                } catch (e) {}
            }
            
            this.firebaseApp = firebase.initializeApp(this.firebaseConfig, 'hifzi_backup');
            this.database = firebase.database(this.firebaseApp);
            this.auth = firebase.auth(this.firebaseApp);
            
            const savedEmail = localStorage.getItem(this.KEYS.FB_AUTH_EMAIL);
            const savedPassword = localStorage.getItem(this.KEYS.FB_AUTH_PASSWORD);
            
            if (this._isManualLogout) {
                this.updateFirebaseAuthStatus('⚠️ Silakan login manual');
                return;
            }
            
            if (savedEmail && savedPassword) {
                this.auth.signInWithEmailAndPassword(savedEmail, savedPassword)
                    .then(userCredential => {
                        this.currentUser = userCredential.user;
                        this._firebaseAuthStateReady = true;
                        this.updateFirebaseAuthStatus('✅ Terhubung: ' + this.currentUser.email);
                        setTimeout(() => this.checkCloudDataOnLoad(true), 1000);
                    })
                    .catch(err => {
                        console.error('[Backup] Firebase auth error:', err);
                        localStorage.removeItem(this.KEYS.FB_AUTH_EMAIL);
                        localStorage.removeItem(this.KEYS.FB_AUTH_PASSWORD);
                    });
            } else {
                this.auth.onAuthStateChanged(user => {
                    if (this._isManualLogout) return;
                    
                    if (user) {
                        this.currentUser = user;
                        this._firebaseAuthStateReady = true;
                        this.updateFirebaseAuthStatus('✅ Terhubung: ' + user.email);
                    } else {
                        this.updateFirebaseAuthStatus('⚠️ Belum login');
                    }
                });
            }
            
        } catch (err) {
            console.error('[Backup] Firebase init error:', err);
            this.showToast('❌ Gagal init Firebase: ' + err.message);
        }
    },

    logoutFirebase() {
        if (!this.auth) {
            this.showToast('❌ Firebase belum terinisialisasi');
            return;
        }
        
        this._isManualLogout = true;
        
        this.auth.signOut()
            .then(() => {
                this.currentUser = null;
                this._firebaseAuthStateReady = false;
                localStorage.removeItem(this.KEYS.FB_AUTH_EMAIL);
                localStorage.removeItem(this.KEYS.FB_AUTH_PASSWORD);
                localStorage.removeItem(this.KEYS.FB_USER);
                this.updateFirebaseAuthStatus('✅ Berhasil logout');
                this.showToast('✅ Logout Firebase berhasil');
                this.syncStatus = this.SYNC_STATUS.LOGGED_OUT;
                this.refreshUI();
            })
            .catch(err => {
                console.error('[Backup] Logout error:', err);
                this.showToast('❌ Gagal logout: ' + err.message);
            });
    },

    logoutSheets() {
        localStorage.setItem(this.KEYS.SHEETS_LOGGED_OUT, 'true');
        this._gasConfigValid = false;
        this.stopAutoSync();
        this.showToast('✅ Logout Google Sheets berhasil. Sync dinonaktifkan.');
        this.syncStatus = this.SYNC_STATUS.LOGGED_OUT;
        this.refreshUI();
    },

    loginSheets() {
        const url = document.getElementById('gas-url-input')?.value?.trim() || this.gasUrl;
        const sheetId = document.getElementById('sheet-id-input')?.value?.trim() || this.sheetId;
        
        if (!url || !sheetId) {
            this.showToast('❌ URL dan Sheet ID wajib diisi');
            return;
        }
        
        this.gasUrl = url;
        this.sheetId = this.cleanSheetId(sheetId);
        
        localStorage.setItem(this.KEYS.GAS_URL, this.gasUrl);
        localStorage.setItem(this.KEYS.SHEET_ID, this.sheetId);
        localStorage.removeItem(this.KEYS.SHEETS_LOGGED_OUT);
        
        this._gasConfigValid = this.gasUrl && this.sheetId && this.sheetId.length === 44;
        this.saveBackupSettings();
        
        if (this._gasConfigValid) {
            this.showToast('✅ Login Google Sheets berhasil');
            this.syncStatus = this.SYNC_STATUS.IDLE;
            this.checkNewDeviceGAS();
            setTimeout(() => this.checkCloudDataOnLoad(true), 1000);
            
            if (this.isAutoSyncEnabled) {
                this.startAutoSync();
            }
        } else {
            this.showToast('❌ Konfigurasi tidak valid');
        }
        
        this.refreshUI();
    },

    disableLocalSync() {
        localStorage.setItem(this.KEYS.LOCAL_SYNC_ENABLED, 'false');
        this.showToast('✅ Sync Local dinonaktifkan');
        this.syncStatus = this.SYNC_STATUS.LOGGED_OUT;
        this.refreshUI();
    },

    enableLocalSync() {
        localStorage.setItem(this.KEYS.LOCAL_SYNC_ENABLED, 'true');
        this.showToast('✅ Sync Local diaktifkan');
        this.syncStatus = this.SYNC_STATUS.IDLE;
        this.refreshUI();
    },

    updateFirebaseAuthStatus(message) {
        const statusEl = document.getElementById('firebase-auth-status');
        if (statusEl) {
            statusEl.style.display = 'block';
            statusEl.textContent = message;
        }
    },

    refreshUI() {
        if (this.isRendered) this.render();
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = backupModule;
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => backupModule.init());
} else {
    backupModule.init();
}

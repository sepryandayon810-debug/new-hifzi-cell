// ============================================
// BACKUP MODULE - HIFZI CELL (COMPLETE v4.3.0)
// FIXED: Firebase init error, Auto-login issue, Auto-backup, Logout all providers
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
    
    telegramConfig: {
        botToken: '',
        chatId: '',
        enabled: false
    },
    
    n8nConfig: {
        botToken: '',
        chatId: '',
        sheetId: '',
        sheetName: 'Data Base Hifzi Cell',
        gasUrl: '',
        configSheetId: '',
        configGasUrl: ''
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

    isBackupPage() {
        const hash = window.location.hash;
        if (hash && hash.includes('backup')) return true;
        
        const path = window.location.pathname;
        if (path && path.includes('backup')) return true;
        
        const params = new URLSearchParams(window.location.search);
        if (params.get('page') === 'backup') return true;
        
        const backupContainer = document.getElementById('backup-page-container');
        if (backupContainer) return true;
        
        const activeMenu = document.querySelector('.menu-item.active, .nav-item.active, [data-page="backup"].active');
        if (activeMenu) return true;
        
        return false;
    },

    init(forceReinit = false) {
        if (this.isInitialized && !forceReinit) {
            console.log('[Backup] Already initialized, skipping...');
            this.reloadAllConfig();
            return this;
        }

        console.log('[Backup] ========================================');
        console.log('[Backup] Initializing v4.3.0 - All Fixes Applied...');
        console.log('[Backup] ========================================');
        
        this.loadBackupSettings();
        this.lastLocalDataHash = localStorage.getItem(this.KEYS.LAST_DATA_HASH) || null;
        this.cloudDataHash = localStorage.getItem(this.KEYS.CLOUD_DATA_HASH) || null;
        this.lastCloudCheck = localStorage.getItem(this.KEYS.LAST_CLOUD_CHECK) || null;
        this.cloudCheckCount = parseInt(localStorage.getItem(this.KEYS.CLOUD_CHECK_COUNT) || '0');
        
        const savedTelegram = localStorage.getItem(this.KEYS.TELEGRAM_CONFIG);
        if (savedTelegram) {
            try {
                this.telegramConfig = JSON.parse(savedTelegram);
            } catch (e) {
                console.error('[Backup] Error parsing Telegram config:', e);
            }
        }
        
        const savedN8n = localStorage.getItem(this.KEYS.N8N_CONFIG);
        if (savedN8n) {
            try {
                this.n8nConfig = JSON.parse(savedN8n);
            } catch (e) {
                console.error('[Backup] Error parsing N8N config:', e);
            }
        }
        
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
        
        const sheetsLoggedOut = localStorage.getItem(this.KEYS.SHEETS_LOGGED_OUT) === 'true';
        if (sheetsLoggedOut) {
            this._gasConfigValid = false;
            console.log('[Backup] Sheets is logged out, sync disabled');
        }
        
        console.log('[Backup] Provider:', this.currentProvider);
        console.log('[Backup] GAS Valid:', this._gasConfigValid);
        console.log('[Backup] Sheets Logged Out:', sheetsLoggedOut);

        this.setupNetworkListeners();
        this.setupDataChangeObserver();

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
        
        if (this.isBackupPage()) {
            console.log('[Backup] Di halaman backup, rendering...');
            this.render();
        } else {
            console.log('[Backup] Bukan halaman backup, skip render UI');
        }
        
        return this;
    },

    setupDataChangeObserver() {
        if (typeof dataManager !== 'undefined') {
            const originalSave = dataManager.save;
            dataManager.save = (...args) => {
                const result = originalSave.apply(dataManager, args);
                
                setTimeout(() => {
                    this.handleDataChange();
                }, 500);
                
                return result;
            };
            
            console.log('[Backup] Data change observer installed');
        }
        
        window.addEventListener('storage', (e) => {
            if (e.key === 'hifzi_data' || e.key === 'hifzi_transactions') {
                this.handleDataChange();
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

    getConfigForBackup() {
        return {
            provider: this.currentProvider,
            gasUrl: this.gasUrl,
            sheetId: this.sheetId,
            firebaseConfig: this.firebaseConfig,
            autoSync: this.isAutoSyncEnabled,
            telegram: this.telegramConfig,
            n8n: this.n8nConfig,
            version: '4.3.0',
            savedAt: new Date().toISOString(),
            savedBy: this.deviceId
        };
    },

    applyConfigFromCloud(cloudConfig) {
        if (!cloudConfig) return false;
        
        console.log('[Backup] Applying config from cloud:', cloudConfig);
        
        let hasChanges = false;
        
        if (cloudConfig.provider && cloudConfig.provider !== this.currentProvider) {
            this.currentProvider = cloudConfig.provider;
            localStorage.setItem(this.KEYS.PROVIDER, this.currentProvider);
            hasChanges = true;
        }
        
        if (cloudConfig.gasUrl && cloudConfig.gasUrl !== this.gasUrl) {
            this.gasUrl = cloudConfig.gasUrl;
            localStorage.setItem(this.KEYS.GAS_URL, this.gasUrl);
            hasChanges = true;
        }
        
        if (cloudConfig.sheetId && cloudConfig.sheetId !== this.sheetId) {
            this.sheetId = this.cleanSheetId(cloudConfig.sheetId);
            localStorage.setItem(this.KEYS.SHEET_ID, this.sheetId);
            hasChanges = true;
        }
        
        if (cloudConfig.firebaseConfig && cloudConfig.firebaseConfig.apiKey) {
            const newConfig = JSON.stringify(cloudConfig.firebaseConfig);
            const oldConfig = JSON.stringify(this.firebaseConfig);
            if (newConfig !== oldConfig) {
                this.firebaseConfig = cloudConfig.firebaseConfig;
                localStorage.setItem(this.KEYS.FIREBASE_CONFIG, JSON.stringify(this.firebaseConfig));
                hasChanges = true;
            }
        }
        
        if (cloudConfig.telegram) {
            this.telegramConfig = {
                ...this.telegramConfig,
                ...cloudConfig.telegram
            };
            localStorage.setItem(this.KEYS.TELEGRAM_CONFIG, JSON.stringify(this.telegramConfig));
            hasChanges = true;
            
            if (typeof dataManager !== 'undefined' && dataManager.data) {
                dataManager.data.telegram = this.telegramConfig;
            }
        }
        
        if (cloudConfig.n8n) {
            this.n8nConfig = {
                ...this.n8nConfig,
                ...cloudConfig.n8n
            };
            localStorage.setItem(this.KEYS.N8N_CONFIG, JSON.stringify(this.n8nConfig));
            hasChanges = true;
        }
        
        if (cloudConfig.autoSync !== undefined && cloudConfig.autoSync !== this.isAutoSyncEnabled) {
            this.isAutoSyncEnabled = cloudConfig.autoSync;
            localStorage.setItem(this.KEYS.AUTO_SYNC, this.isAutoSyncEnabled);
            hasChanges = true;
        }
        
        this._gasConfigValid = this.gasUrl && this.sheetId && this.sheetId.length === 44;
        this.saveBackupSettings();
        
        return hasChanges;
    },

    async previewCloudData() {
        if (!this.isOnline) {
            this.showToast('📴 Offline - Tidak bisa preview');
            return;
        }
        
        if (this.currentProvider === 'local') {
            this.showToast('💾 Mode Local - Tidak ada cloud data');
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
                const result = await this.downloadFromGAS(true, true);
                if (result && result.data) {
                    cloudData = result.data;
                    source = 'Google Sheets';
                }
            }
            
            if (!cloudData) {
                this.showToast('ℹ️ Tidak ada data di cloud');
                return;
            }
            
            this.previewData = cloudData;
            this.showPreviewModal(cloudData, source);
            
        } catch (err) {
            console.error('[Backup] Preview error:', err);
            this.showToast('❌ Gagal preview: ' + err.message);
        }
    },

    showPreviewModal(data, source) {
        const modal = document.createElement('div');
        modal.id = 'preview-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.85);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            overflow-y: auto;
            font-family: system-ui, -apple-system, sans-serif;
        `;
        
        const productsTable = this.generateProductsTable(data.products || []);
        const transactionsTable = this.generateTransactionsTable(data.transactions || []);
        const cashFlowTable = this.generateCashFlowTable(data.cashTransactions || []);
        const debtsTable = this.generateDebtsTable(data.debts || []);
        const categoriesTable = this.generateCategoriesTable(data.categories || []);
        const usersTable = this.generateUsersTable(data.users || []);
        const modalHistoryTable = this.generateModalHistoryTable(data.modalHistory || []);
        const pendingModalsTable = this.generatePendingModalsTable(data.pendingModals || {}, data.pendingExtraModals || {});
        
        const configInfo = data._configMeta ? `
        <div style="background: #e6fffa; border: 2px solid #81e6d9; border-radius: 10px; padding: 16px; margin-bottom: 12px;">
            <div style="font-weight: 600; color: #234e52; margin-bottom: 8px;">⚙️ Config Tersimpan di Cloud</div>
            <div style="font-size: 12px; color: #2d3748; line-height: 1.6;">
                <div>Provider: ${data._configMeta.provider || '-'}</div>
                <div>GAS URL: ${data._configMeta.gasUrl ? '✅ Ada' : '❌ Tidak ada'}</div>
                <div>Firebase: ${data._configMeta.firebaseConfig?.apiKey ? '✅ Ada' : '❌ Tidak ada'}</div>
                <div>Telegram: ${data._configMeta.telegram?.botToken ? '✅ Ada' : '❌ Tidak ada'}</div>
                <div>N8N/Pencarian: ${data._configMeta.n8n?.botToken ? '✅ Ada' : '❌ Tidak ada'}</div>
                <div>Auto Sync: ${data._configMeta.autoSync ? '✅ Aktif' : '❌ Nonaktif'}</div>
                <div style="margin-top: 8px; color: #718096; font-size: 11px;">
                    Config disimpan: ${data._configMeta.savedAt ? new Date(data._configMeta.savedAt).toLocaleString('id-ID') : '-'}
                </div>
            </div>
        </div>
        ` : '';
        
        const telegramConfigInfo = data.telegram ? `
        <div style="background: #e0f2fe; border: 2px solid #38bdf8; border-radius: 10px; padding: 16px; margin-top: 20px;">
            <div style="font-weight: 600; color: #0369a1; margin-bottom: 8px;">📱 Telegram Config</div>
            <div style="font-size: 13px; color: #0c4a6e; line-height: 1.8;">
                <div>Bot Token: ${data.telegram.botToken ? '✅ ' + data.telegram.botToken.substring(0, 20) + '...' : '❌ Tidak ada'}</div>
                <div>Chat ID: ${data.telegram.chatId || '-'}</div>
                <div>Status: ${data.telegram.enabled ? '✅ Aktif' : '❌ Nonaktif'}</div>
                <div>GAS URL: ${data.telegram.gasUrl ? '✅ Ada' : '❌ Tidak ada'}</div>
                <div>Sheet ID: ${data.telegram.sheetId ? '✅ Ada' : '❌ Tidak ada'}</div>
            </div>
        </div>
        ` : '';
        
        const n8nConfigInfo = data.n8nConfig || data._configMeta?.n8n ? `
        <div style="background: #f3e8ff; border: 2px solid #a855f7; border-radius: 10px; padding: 16px; margin-top: 12px;">
            <div style="font-weight: 600; color: #6b21a8; margin-bottom: 8px;">🔍 N8N / Pencarian Config</div>
            <div style="font-size: 13px; color: #581c87; line-height: 1.8;">
                <div>Bot Token: ${(data.n8nConfig?.botToken || data._configMeta?.n8n?.botToken) ? '✅ Ada' : '❌ Tidak ada'}</div>
                <div>Chat ID: ${data.n8nConfig?.chatId || data._configMeta?.n8n?.chatId || '-'}</div>
                <div>Sheet ID: ${data.n8nConfig?.sheetId || data._configMeta?.n8n?.sheetId ? '✅ Ada' : '❌ Tidak ada'}</div>
                <div>GAS URL: ${data.n8nConfig?.gasUrl || data._configMeta?.n8n?.gasUrl ? '✅ Ada' : '❌ Tidak ada'}</div>
            </div>
        </div>
        ` : '';
        
        modal.innerHTML = `
            <div style="
                background: white;
                border-radius: 16px;
                max-width: 1200px;
                width: 100%;
                max-height: 90vh;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                animation: slideUp 0.3s ease;
            ">
                <div style="
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 20px;
                    flex-shrink: 0;
                ">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-size: 20px; font-weight: 700;">👁️ Preview Data Cloud</div>
                            <div style="font-size: 13px; opacity: 0.9; margin-top: 4px;">Sumber: ${source} | Backup Date: ${data._backupMeta?.backupDate ? new Date(data._backupMeta.backupDate).toLocaleString('id-ID') : '-'}</div>
                        </div>
                        <button onclick="backupModule.closePreviewModal()" style="
                            background: rgba(255,255,255,0.2);
                            border: none;
                            color: white;
                            width: 36px;
                            height: 36px;
                            border-radius: 50%;
                            cursor: pointer;
                            font-size: 20px;
                        ">×</button>
                    </div>
                </div>
                
                <div style="
                    background: #f7fafc;
                    padding: 12px 20px;
                    border-bottom: 1px solid #e2e8f0;
                    display: flex;
                    gap: 8px;
                    overflow-x: auto;
                    flex-shrink: 0;
                ">
                    <button onclick="backupModule.switchPreviewTab('products')" id="tab-products" class="preview-tab active" style="
                        padding: 8px 16px;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-weight: 600;
                        font-size: 13px;
                        background: #667eea;
                        color: white;
                    ">📦 Produk (${data.products?.length || 0})</button>
                    <button onclick="backupModule.switchPreviewTab('transactions')" id="tab-transactions" class="preview-tab" style="
                        padding: 8px 16px;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-weight: 600;
                        font-size: 13px;
                        background: #e2e8f0;
                        color: #4a5568;
                    ">📝 Transaksi (${data.transactions?.length || 0})</button>
                    <button onclick="backupModule.switchPreviewTab('cashflow')" id="tab-cashflow" class="preview-tab" style="
                        padding: 8px 16px;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-weight: 600;
                        font-size: 13px;
                        background: #e2e8f0;
                        color: #4a5568;
                    ">💸 Cash Flow (${data.cashTransactions?.length || 0})</button>
                    <button onclick="backupModule.switchPreviewTab('debts')" id="tab-debts" class="preview-tab" style="
                        padding: 8px 16px;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-weight: 600;
                        font-size: 13px;
                        background: #e2e8f0;
                        color: #4a5568;
                    ">💳 Hutang (${data.debts?.length || 0})</button>
                    <button onclick="backupModule.switchPreviewTab('categories')" id="tab-categories" class="preview-tab" style="
                        padding: 8px 16px;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-weight: 600;
                        font-size: 13px;
                        background: #e2e8f0;
                        color: #4a5568;
                    ">📁 Kategori (${data.categories?.length || 0})</button>
                    <button onclick="backupModule.switchPreviewTab('users')" id="tab-users" class="preview-tab" style="
                        padding: 8px 16px;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-weight: 600;
                        font-size: 13px;
                        background: #e2e8f0;
                        color: #4a5568;
                    ">👥 Users (${data.users?.length || 0})</button>
                    <button onclick="backupModule.switchPreviewTab('modalhistory')" id="tab-modalhistory" class="preview-tab" style="
                        padding: 8px 16px;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-weight: 600;
                        font-size: 13px;
                        background: #e2e8f0;
                        color: #4a5568;
                    ">💰 Riwayat Modal (${data.modalHistory?.length || 0})</button>
                    <button onclick="backupModule.switchPreviewTab('pendingmodals')" id="tab-pendingmodals" class="preview-tab" style="
                        padding: 8px 16px;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-weight: 600;
                        font-size: 13px;
                        background: #e2e8f0;
                        color: #4a5568;
                    ">⏳ Modal Pending (${Object.keys(data.pendingModals || {}).length + Object.keys(data.pendingExtraModals || {}).length})</button>
                </div>
                
                <div style="padding: 20px; overflow-y: auto; flex: 1; background: #f7fafc;">
                    ${configInfo}
                    
                    <div id="content-products" class="preview-content" style="display: block;">
                        ${productsTable}
                    </div>
                    <div id="content-transactions" class="preview-content" style="display: none;">
                        ${transactionsTable}
                    </div>
                    <div id="content-cashflow" class="preview-content" style="display: none;">
                        ${cashFlowTable}
                    </div>
                    <div id="content-debts" class="preview-content" style="display: none;">
                        ${debtsTable}
                    </div>
                    <div id="content-categories" class="preview-content" style="display: none;">
                        ${categoriesTable}
                    </div>
                    <div id="content-users" class="preview-content" style="display: none;">
                        ${usersTable}
                    </div>
                    <div id="content-modalhistory" class="preview-content" style="display: none;">
                        ${modalHistoryTable}
                    </div>
                    <div id="content-pendingmodals" class="preview-content" style="display: none;">
                        ${pendingModalsTable}
                    </div>
                    
                    ${telegramConfigInfo}
                    ${n8nConfigInfo}
                    
                    <div style="background: #fffaf0; border: 2px solid #fbd38d; border-radius: 10px; padding: 16px; margin-top: 12px;">
                        <div style="font-weight: 600; color: #744210; margin-bottom: 8px;">🔍 Search History</div>
                        <div style="font-size: 13px; color: #744210;">
                            Total Pencarian: ${data.searchHistory?.length || 0} item
                        </div>
                    </div>
                </div>
                
                <div style="
                    padding: 20px;
                    border-top: 1px solid #e2e8f0;
                    display: flex;
                    gap: 12px;
                    justify-content: flex-end;
                    background: white;
                    flex-shrink: 0;
                ">
                    <button onclick="backupModule.downloadPreviewData()" style="
                        padding: 12px 24px;
                        background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
                        color: white;
                        border: none;
                        border-radius: 10px;
                        cursor: pointer;
                        font-weight: 600;
                    ">⬇️ Download JSON</button>
                    <button onclick="backupModule.closePreviewModal()" style="
                        padding: 12px 24px;
                        background: #e2e8f0;
                        color: #4a5568;
                        border: none;
                        border-radius: 10px;
                        cursor: pointer;
                        font-weight: 600;
                    ">Tutup</button>
                </div>
            </div>
            
            <style>
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(50px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .preview-table {
                    width: 100%;
                    border-collapse: collapse;
                    background: white;
                    border-radius: 8px;
                    overflow: hidden;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                }
                .preview-table th {
                    background: #4a5568;
                    color: white;
                    padding: 12px;
                    text-align: left;
                    font-weight: 600;
                    font-size: 13px;
                    white-space: nowrap;
                }
                .preview-table td {
                    padding: 10px 12px;
                    border-bottom: 1px solid #e2e8f0;
                    font-size: 13px;
                }
                .preview-table tr:hover {
                    background: #f7fafc;
                }
                .preview-table tr:last-child td {
                    border-bottom: none;
                }
                .text-right { text-align: right; }
                .text-center { text-align: center; }
                .badge {
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 11px;
                    font-weight: 600;
                }
                .badge-success { background: #c6f6d5; color: #22543d; }
                .badge-warning { background: #fefcbf; color: #744210; }
                .badge-danger { background: #fed7d7; color: #742a2a; }
                .badge-info { background: #bee3f8; color: #2a4365; }
            </style>
        `;
        
        document.body.appendChild(modal);
    },

    generateProductsTable(products) {
        if (!products || products.length === 0) {
            return '<div style="text-align: center; padding: 40px; color: #718096;">📦 Tidak ada data produk</div>';
        }
        
        const rows = products.map((p, i) => `
            <tr>
                <td class="text-center">${i + 1}</td>
                <td><strong>${p.name || '-'}</strong></td>
                <td>${p.category || '-'}</td>
                <td class="text-right">Rp ${(p.price || 0).toLocaleString('id-ID')}</td>
                <td class="text-right">${p.stock || 0}</td>
                <td class="text-center">
                    <span class="badge ${p.stock > 10 ? 'badge-success' : p.stock > 0 ? 'badge-warning' : 'badge-danger'}">
                        ${p.stock > 10 ? 'Tersedia' : p.stock > 0 ? 'Menipis' : 'Habis'}
                    </span>
                </td>
            </tr>
        `).join('');
        
        return `
            <table class="preview-table">
                <thead>
                    <tr>
                        <th class="text-center">No</th>
                        <th>Nama Produk</th>
                        <th>Kategori</th>
                        <th class="text-right">Harga</th>
                        <th class="text-right">Stok</th>
                        <th class="text-center">Status</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    },

    generateTransactionsTable(transactions) {
        if (!transactions || transactions.length === 0) {
            return '<div style="text-align: center; padding: 40px; color: #718096;">📝 Tidak ada data transaksi</div>';
        }
        
        const rows = transactions.slice(0, 100).map((t, i) => {
            const idStr = t.id ? String(t.id) : '-';
            const displayId = idStr.length > 8 ? idStr.substring(0, 8) : idStr;
            
            return `
            <tr>
                <td class="text-center">${i + 1}</td>
                <td>${displayId}</td>
                <td>${new Date(t.date).toLocaleDateString('id-ID')}</td>
                <td>${t.customerName || 'Umum'}</td>
                <td class="text-right">${(t.items || []).length} item</td>
                <td class="text-right"><strong>Rp ${(t.total || 0).toLocaleString('id-ID')}</strong></td>
                <td class="text-center">
                    <span class="badge ${t.paymentMethod === 'cash' ? 'badge-success' : 'badge-info'}">
                        ${t.paymentMethod === 'cash' ? 'Tunai' : t.paymentMethod || '-'}
                    </span>
                </td>
            </tr>
        `}).join('');
        
        const moreRow = transactions.length > 100 ? 
            `<tr><td colspan="7" class="text-center" style="background: #edf2f7; font-style: italic;">... dan ${transactions.length - 100} transaksi lainnya</td></tr>` : '';
        
        return `
            <table class="preview-table">
                <thead>
                    <tr>
                        <th class="text-center">No</th>
                        <th>ID Transaksi</th>
                        <th>Tanggal</th>
                        <th>Pelanggan</th>
                        <th class="text-right">Items</th>
                        <th class="text-right">Total</th>
                        <th class="text-center">Pembayaran</th>
                    </tr>
                </thead>
                <tbody>${rows}${moreRow}</tbody>
            </table>
        `;
    },

    generateCashFlowTable(transactions) {
        if (!transactions || transactions.length === 0) {
            return '<div style="text-align: center; padding: 40px; color: #718096;">💸 Tidak ada data cash flow</div>';
        }
        
        const rows = transactions.slice(0, 100).map((t, i) => {
            const isIncome = t.type === 'income' || t.type === 'penjualan';
            return `
                <tr>
                    <td class="text-center">${i + 1}</td>
                    <td>${new Date(t.date || t.timestamp).toLocaleDateString('id-ID')}</td>
                    <td>
                        <span class="badge ${isIncome ? 'badge-success' : 'badge-danger'}">
                            ${isIncome ? '⬆️ Masuk' : '⬇️ Keluar'}
                        </span>
                    </td>
                    <td>${t.category || '-'}</td>
                    <td>${t.description || '-'}</td>
                    <td class="text-right" style="color: ${isIncome ? '#38a169' : '#e53e3e'}; font-weight: 600;">
                        ${isIncome ? '+' : '-'} Rp ${(t.amount || 0).toLocaleString('id-ID')}
                    </td>
                    <td>${t.userName || '-'}</td>
                </tr>
            `;
        }).join('');
        
        const moreRow = transactions.length > 100 ? 
            `<tr><td colspan="7" class="text-center" style="background: #edf2f7; font-style: italic;">... dan ${transactions.length - 100} transaksi lainnya</td></tr>` : '';
        
        return `
            <table class="preview-table">
                <thead>
                    <tr>
                        <th class="text-center">No</th>
                        <th>Tanggal</th>
                        <th class="text-center">Tipe</th>
                        <th>Kategori</th>
                        <th>Deskripsi</th>
                        <th class="text-right">Jumlah</th>
                        <th>User</th>
                    </tr>
                </thead>
                <tbody>${rows}${moreRow}</tbody>
            </table>
        `;
    },

    generateDebtsTable(debts) {
        if (!debts || debts.length === 0) {
            return '<div style="text-align: center; padding: 40px; color: #718096;">💳 Tidak ada data hutang</div>';
        }
        
        const rows = debts.map((d, i) => {
            const remaining = (d.totalAmount || 0) - (d.paidAmount || 0);
            const isPaid = remaining <= 0;
            return `
                <tr>
                    <td class="text-center">${i + 1}</td>
                    <td><strong>${d.customerName || '-'}</strong></td>
                    <td>${d.customerPhone || '-'}</td>
                    <td class="text-right">Rp ${(d.totalAmount || 0).toLocaleString('id-ID')}</td>
                    <td class="text-right">Rp ${(d.paidAmount || 0).toLocaleString('id-ID')}</td>
                    <td class="text-right" style="font-weight: 600; color: ${isPaid ? '#38a169' : '#e53e3e'};">
                        Rp ${remaining.toLocaleString('id-ID')}
                    </td>
                    <td class="text-center">
                        <span class="badge ${isPaid ? 'badge-success' : d.status === 'partial' ? 'badge-warning' : 'badge-danger'}">
                            ${isPaid ? 'Lunas' : d.status === 'partial' ? 'Sebagian' : 'Belum Lunas'}
                        </span>
                    </td>
                </tr>
            `;
        }).join('');
        
        return `
            <table class="preview-table">
                <thead>
                    <tr>
                        <th class="text-center">No</th>
                        <th>Nama Pelanggan</th>
                        <th>Telepon</th>
                        <th class="text-right">Total Hutang</th>
                        <th class="text-right">Sudah Bayar</th>
                        <th class="text-right">Sisa</th>
                        <th class="text-center">Status</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    },

    generateCategoriesTable(categories) {
        if (!categories || categories.length === 0) {
            return '<div style="text-align: center; padding: 40px; color: #718096;">📁 Tidak ada data kategori</div>';
        }
        
        const rows = categories.map((c, i) => {
            const idStr = c.id ? String(c.id) : '-';
            return `
            <tr>
                <td class="text-center">${i + 1}</td>
                <td><strong>${c.name || '-'}</strong></td>
                <td>${c.description || '-'}</td>
                <td class="text-center">${c.productCount || 0}</td>
                <td class="text-center">
                    <span class="badge badge-info">${idStr.substring(0, 8)}</span>
                </td>
            </tr>
        `}).join('');
        
        return `
            <table class="preview-table">
                <thead>
                    <tr>
                        <th class="text-center">No</th>
                        <th>Nama Kategori</th>
                        <th>Deskripsi</th>
                        <th class="text-center">Jumlah Produk</th>
                        <th class="text-center">ID</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    },

    generateUsersTable(users) {
        if (!users || users.length === 0) {
            return '<div style="text-align: center; padding: 40px; color: #718096;">👥 Tidak ada data user</div>';
        }
        
        const rows = users.map((u, i) => `
            <tr>
                <td class="text-center">${i + 1}</td>
                <td><strong>${u.name || u.username || '-'}</strong></td>
                <td>${u.role || 'user'}</td>
                <td>${u.email || '-'}</td>
                <td class="text-center">
                    <span class="badge ${u.isActive ? 'badge-success' : 'badge-danger'}">
                        ${u.isActive ? 'Aktif' : 'Nonaktif'}
                    </span>
                </td>
                <td>${u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('id-ID') : '-'}</td>
            </tr>
        `).join('');
        
        return `
            <table class="preview-table">
                <thead>
                    <tr>
                        <th class="text-center">No</th>
                        <th>Nama</th>
                        <th>Role</th>
                        <th>Email</th>
                        <th class="text-center">Status</th>
                        <th>Last Login</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    },

    generateModalHistoryTable(modalHistory) {
        if (!modalHistory || modalHistory.length === 0) {
            return '<div style="text-align: center; padding: 40px; color: #718096;">💰 Tidak ada riwayat pembagian modal</div>';
        }
        
        const rows = modalHistory.map((m, i) => `
            <tr>
                <td class="text-center">${i + 1}</td>
                <td>${new Date(m.date).toLocaleDateString('id-ID')}</td>
                <td><strong>${m.userName || m.userId || '-'}</strong></td>
                <td>${m.role || '-'}</td>
                <td class="text-right" style="font-weight: 600; color: #38a169;">
                    Rp ${(m.amount || 0).toLocaleString('id-ID')}
                </td>
                <td>${m.type === 'extra' ? '💵 Extra' : '📦 Modal Awal'}</td>
                <td>${m.notes || '-'}</td>
                <td>${m.distributedBy || '-'}</td>
            </tr>
        `).join('');
        
        return `
            <table class="preview-table">
                <thead>
                    <tr>
                        <th class="text-center">No</th>
                        <th>Tanggal</th>
                        <th>Kasir/User</th>
                        <th>Role</th>
                        <th class="text-right">Jumlah Modal</th>
                        <th>Tipe</th>
                        <th>Catatan</th>
                        <th>Dibagikan Oleh</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    },

    generatePendingModalsTable(pendingModals, pendingExtraModals) {
        const pendingModalEntries = Object.entries(pendingModals || {});
        const pendingExtraEntries = Object.entries(pendingExtraModals || {});
        
        if (pendingModalEntries.length === 0 && pendingExtraEntries.length === 0) {
            return '<div style="text-align: center; padding: 40px; color: #718096;">⏳ Tidak ada modal pending</div>';
        }
        
        let rows = '';
        
        pendingModalEntries.forEach(([userId, amount], i) => {
            rows += `
                <tr>
                    <td class="text-center">${i + 1}</td>
                    <td><strong>${userId}</strong></td>
                    <td><span class="badge badge-warning">Modal Awal</span></td>
                    <td class="text-right" style="font-weight: 600;">Rp ${(amount || 0).toLocaleString('id-ID')}</td>
                    <td class="text-center"><span class="badge badge-warning">Pending</span></td>
                </tr>
            `;
        });
        
        pendingExtraEntries.forEach(([userId, amount], i) => {
            rows += `
                <tr>
                    <td class="text-center">${pendingModalEntries.length + i + 1}</td>
                    <td><strong>${userId}</strong></td>
                    <td><span class="badge badge-info">Extra Modal</span></td>
                    <td class="text-right" style="font-weight: 600;">Rp ${(amount || 0).toLocaleString('id-ID')}</td>
                    <td class="text-center"><span class="badge badge-warning">Pending</span></td>
                </tr>
            `;
        });
        
        return `
            <table class="preview-table">
                <thead>
                    <tr>
                        <th class="text-center">No</th>
                        <th>User ID</th>
                        <th>Tipe</th>
                        <th class="text-right">Jumlah</th>
                        <th class="text-center">Status</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    },

    switchPreviewTab(tabName) {
        document.querySelectorAll('.preview-tab').forEach(tab => {
            tab.style.background = '#e2e8f0';
            tab.style.color = '#4a5568';
        });
        
        document.querySelectorAll('.preview-content').forEach(content => {
            content.style.display = 'none';
        });
        
        const activeTab = document.getElementById('tab-' + tabName);
        if (activeTab) {
            activeTab.style.background = '#667eea';
            activeTab.style.color = 'white';
        }
        
        const activeContent = document.getElementById('content-' + tabName);
        if (activeContent) {
            activeContent.style.display = 'block';
        }
    },

    closePreviewModal() {
        const modal = document.getElementById('preview-modal');
        if (modal) modal.remove();
        this.previewData = null;
    },

    downloadPreviewData() {
        if (!this.previewData) return;
        
        const dataStr = JSON.stringify(this.previewData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `hifzi_backup_preview_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showToast('✅ Data preview diunduh');
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
                
                if (parsed.telegramConfig) {
                    this.telegramConfig = parsed.telegramConfig;
                }
                if (parsed.n8nConfig) {
                    this.n8nConfig = parsed.n8nConfig;
                }
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
        
        const savedAutoSaveLocal = localStorage.getItem(this.KEYS.AUTO_SAVE_LOCAL);
        if (savedAutoSaveLocal !== null) this.isAutoSaveLocalEnabled = savedAutoSaveLocal === 'true';
        
        const savedFirebaseConfig = localStorage.getItem(this.KEYS.FIREBASE_CONFIG);
        if (savedFirebaseConfig) {
            try {
                this.firebaseConfig = JSON.parse(savedFirebaseConfig);
            } catch (e) {
                console.error('[Backup] Error parsing Firebase config:', e);
            }
        }
        
        const savedTelegram = localStorage.getItem(this.KEYS.TELEGRAM_CONFIG);
        if (savedTelegram) {
            try {
                this.telegramConfig = JSON.parse(savedTelegram);
            } catch (e) {
                console.error('[Backup] Error parsing Telegram config:', e);
            }
        }
        
        const savedN8n = localStorage.getItem(this.KEYS.N8N_CONFIG);
        if (savedN8n) {
            try {
                this.n8nConfig = JSON.parse(savedN8n);
            } catch (e) {
                console.error('[Backup] Error parsing N8N config:', e);
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
            telegramConfig: this.telegramConfig,
            n8nConfig: this.n8nConfig,
            savedAt: new Date().toISOString()
        };
        localStorage.setItem(this.KEYS.BACKUP_SETTINGS, JSON.stringify(settings));
    },

    reloadAllConfig() {
        this.loadBackupSettings();
        this._gasConfigValid = this.gasUrl && this.sheetId && this.sheetId.length === 44;
    },

    setupNetworkListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.updateSyncStatus(this.SYNC_STATUS.IDLE);
            if (this.isAutoSyncEnabled && this._gasConfigValid) {
                this.debouncedSync();
            }
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.updateSyncStatus(this.SYNC_STATUS.OFFLINE);
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

    calculateDataHash() {
        if (typeof dataManager === 'undefined' || !dataManager.data) return '';
        
        const keyData = JSON.stringify({
            products: dataManager.data.products?.length || 0,
            transactions: dataManager.data.transactions?.length || 0,
            cash: dataManager.data.cashTransactions?.length || 0,
            debts: dataManager.data.debts?.length || 0,
            lastTransaction: dataManager.data.transactions?.[dataManager.data.transactions.length - 1]?.id,
            lastUpdate: new Date().toDateString()
        });
        
        let hash = 0;
        for (let i = 0; i < keyData.length; i++) {
            const char = keyData.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString();
    },

    updateSyncStatus(status, message = '') {
        this.syncStatus = status;
        
        const statusIndicator = document.getElementById('sync-status-indicator');
        if (statusIndicator) {
            const statusMap = {
                [this.SYNC_STATUS.IDLE]: { text: '✓ Siap', color: '#48bb78', bg: '#c6f6d5' },
                [this.SYNC_STATUS.SYNCING]: { text: '⟳ Sinkron...', color: '#4299e1', bg: '#bee3f8' },
                [this.SYNC_STATUS.SYNCED]: { text: '✓ Tersinkron', color: '#48bb78', bg: '#c6f6d5' },
                [this.SYNC_STATUS.ERROR]: { text: '✗ Error', color: '#f56565', bg: '#fed7d7' },
                [this.SYNC_STATUS.OFFLINE]: { text: '● Offline', color: '#a0aec0', bg: '#e2e8f0' },
                [this.SYNC_STATUS.CHECKING]: { text: '? Mengecek...', color: '#ed8936', bg: '#feebc8' },
                [this.SYNC_STATUS.CLOUD_NEWER]: { text: '☁️ Cloud Baru', color: '#9f7aea', bg: '#e9d8fd' },
                [this.SYNC_STATUS.LOGGED_OUT]: { text: '🚫 Logged Out', color: '#c53030', bg: '#fed7d7' }
            };
            
            const s = statusMap[status] || statusMap[this.SYNC_STATUS.IDLE];
            statusIndicator.innerHTML = `
                <span style="
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 12px;
                    background: ${s.bg};
                    color: ${s.color};
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 600;
                ">
                    ${s.text}
                </span>
            `;
        }
        
        const lastSyncEl = document.getElementById('last-sync-time');
        if (lastSyncEl && this.lastSyncTime) {
            lastSyncEl.textContent = 'Sync: ' + new Date(this.lastSyncTime).toLocaleTimeString('id-ID');
        }
    },

    initFirebase(forceReinit = false) {
        if (typeof firebase === 'undefined') {
            console.error('[Backup] Firebase SDK not loaded');
            this.showToast('❌ Firebase SDK tidak tersedia');
            return;
        }
        
        try {
            const existingApp = firebase.app('hifzi_backup');
            if (existingApp && !forceReinit) {
                console.log('[Backup] Firebase already initialized');
                this.firebaseApp = existingApp;
                this.database = firebase.database(this.firebaseApp);
                this.auth = firebase.auth(this.firebaseApp);
                return;
            }
        } catch (e) {
            // App belum ada, lanjutkan inisialisasi
        }
        
        if (!this.firebaseConfig.apiKey) {
            console.log('[Backup] No Firebase config');
            return;
        }
        
        try {
            if (forceReinit) {
                try {
                    const existingApp = firebase.app('hifzi_backup');
                    if (existingApp) {
                        existingApp.delete();
                        console.log('[Backup] Deleted existing Firebase app');
                    }
                } catch (e) {
                    // App tidak ada, abaikan error
                }
            }
            
            this.firebaseApp = firebase.initializeApp(this.firebaseConfig, 'hifzi_backup');
            this.database = firebase.database(this.firebaseApp);
            this.auth = firebase.auth(this.firebaseApp);
            
            const savedEmail = localStorage.getItem(this.KEYS.FB_AUTH_EMAIL);
            const savedPassword = localStorage.getItem(this.KEYS.FB_AUTH_PASSWORD);
            
            if (this._isManualLogout) {
                console.log('[Backup] Manual logout detected, skip auto-login');
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
                        this.updateFirebaseAuthStatus('❌ Gagal login: ' + err.message);
                        localStorage.removeItem(this.KEYS.FB_AUTH_EMAIL);
                        localStorage.removeItem(this.KEYS.FB_AUTH_PASSWORD);
                    });
            } else {
                this.auth.onAuthStateChanged(user => {
                    if (this._isManualLogout) {
                        console.log('[Backup] Manual logout detected in auth state change');
                        return;
                    }
                    
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
                console.log('[Backup] Firebase logged out');
                this.currentUser = null;
                this._firebaseAuthStateReady = false;
                
                localStorage.removeItem(this.KEYS.FB_AUTH_EMAIL);
                localStorage.removeItem(this.KEYS.FB_AUTH_PASSWORD);
                localStorage.removeItem(this.KEYS.FB_USER);
                
                this.updateFirebaseAuthStatus('✅ Berhasil logout');
                this.showToast('✅ Logout Firebase berhasil');
                this.updateSyncStatus(this.SYNC_STATUS.LOGGED_OUT);
                
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
        this.updateSyncStatus(this.SYNC_STATUS.LOGGED_OUT);
        
        this.refreshUI();
    },

    loginSheets() {
        const urlInput = document.getElementById('gas-url-input');
        const sheetInput = document.getElementById('sheet-id-input');
        
        const url = urlInput ? urlInput.value.trim() : this.gasUrl;
        const sheetId = sheetInput ? sheetInput.value.trim() : this.sheetId;
        
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
            this.updateSyncStatus(this.SYNC_STATUS.IDLE);
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
        this.updateSyncStatus(this.SYNC_STATUS.LOGGED_OUT);
        this.refreshUI();
    },

    enableLocalSync() {
        localStorage.setItem(this.KEYS.LOCAL_SYNC_ENABLED, 'true');
        this.showToast('✅ Sync Local diaktifkan');
        this.updateSyncStatus(this.SYNC_STATUS.IDLE);
        this.refreshUI();
    },

    updateFirebaseAuthStatus(message) {
        const statusEl = document.getElementById('firebase-auth-status');
        if (statusEl) {
            statusEl.style.display = 'block';
            statusEl.textContent = message;
        }
    },

    render() {
        if (!this.isBackupPage()) {
            console.log('[Backup] Bukan halaman backup, render dibatalkan');
            return;
        }

        let container = document.getElementById('module-container');
        if (!container) container = document.getElementById('content-container');
        if (!container) container = document.getElementById('main-content');
        if (!container) container = document.getElementById('app-content');
        if (!container) container = document.querySelector('.module-container');
        if (!container) container = document.querySelector('.content-area');
        if (!container) container = document.getElementById('backup-page-container');
        
        if (!container) {
            console.warn('[Backup] Container tidak ditemukan, membuat container baru...');
            container = document.createElement('div');
            container.id = 'module-container';
            container.style.cssText = 'padding: 20px; max-width: 1200px; margin: 0 auto;';
            
            const mainContent = document.querySelector('main') || document.querySelector('.main') || document.body;
            mainContent.appendChild(container);
        }

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
                            <div style="font-size: 14px; opacity: 0.9;">Versi 4.3.0 - Auto-Backup Edition</div>
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
                        <div style="
                            background: #f7fafc;
                            padding: 16px;
                            border-radius: 10px;
                            border-left: 4px solid #667eea;
                        ">
                            <div style="font-size: 12px; color: #718096; margin-bottom: 4px;">Status</div>
                            <div id="sync-status-indicator">
                                <span style="
                                    display: inline-flex;
                                    align-items: center;
                                    gap: 6px;
                                    padding: 6px 12px;
                                    background: ${this.getStatusColor().bg};
                                    color: ${this.getStatusColor().text};
                                    border-radius: 20px;
                                    font-size: 12px;
                                    font-weight: 600;
                                ">${this.getStatusText()}</span>
                            </div>
                        </div>
                        <div style="
                            background: #f7fafc;
                            padding: 16px;
                            border-radius: 10px;
                            border-left: 4px solid #48bb78;
                        ">
                            <div style="font-size: 12px; color: #718096; margin-bottom: 4px;">Provider</div>
                            <div id="current-provider" style="font-weight: 600; color: #2d3748; text-transform: capitalize;">
                                ${this.currentProvider}
                            </div>
                        </div>
                        <div style="
                            background: #f7fafc;
                            padding: 16px;
                            border-radius: 10px;
                            border-left: 4px solid #ed8936;
                        ">
                            <div style="font-size: 12px; color: #718096; margin-bottom: 4px;">Device ID</div>
                            <div style="font-weight: 600; color: #2d3748; font-size: 12px;">
                                ${this.deviceId.substring(0, 20)}...
                            </div>
                        </div>
                        <div style="
                            background: #f7fafc;
                            padding: 16px;
                            border-radius: 10px;
                            border-left: 4px solid #38b2ac;
                        ">
                            <div style="font-size: 12px; color: #718096; margin-bottom: 4px;">Last Sync</div>
                            <div id="last-sync-time" style="font-weight: 600; color: #2d3748; font-size: 12px;">
                                ${this.lastSyncTime ? new Date(this.lastSyncTime).toLocaleString('id-ID') : 'Belum pernah'}
                            </div>
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
                        ⚙️ Pengaturan Provider
                    </div>
                    
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; font-size: 13px; font-weight: 600; color: #4a5568; margin-bottom: 8px;">
                            Pilih Provider Backup
                        </label>
                        <select id="provider-select" onchange="backupModule.changeProvider(this.value)" style="
                            width: 100%;
                            padding: 12px;
                            border: 2px solid #e2e8f0;
                            border-radius: 8px;
                            font-size: 14px;
                            background: white;
                        ">
                            <option value="local" ${this.currentProvider === 'local' ? 'selected' : ''}>💾 Local Storage (Offline)</option>
                            <option value="googlesheet" ${this.currentProvider === 'googlesheet' ? 'selected' : ''}>📊 Google Sheets</option>
                            <option value="firebase" ${this.currentProvider === 'firebase' ? 'selected' : ''}>🔥 Firebase Realtime DB</option>
                        </select>
                    </div>

                    <div id="local-config-section" style="display: ${this.currentProvider === 'local' ? 'block' : 'none'};">
                        <div style="
                            background: #f0fff4;
                            border: 2px solid #9ae6b4;
                            border-radius: 10px;
                            padding: 16px;
                            margin-bottom: 12px;
                        ">
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
                                        background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
                                        color: white;
                                        border: none;
                                        padding: 10px 20px;
                                        border-radius: 6px;
                                        font-weight: 600;
                                        cursor: pointer;
                                        width: 100%;
                                    ">✅ Aktifkan Sync Local</button>
                                ` : `
                                    <button onclick="backupModule.disableLocalSync()" style="
                                        background: #fed7d7;
                                        color: #c53030;
                                        border: 2px solid #fc8181;
                                        padding: 10px 20px;
                                        border-radius: 6px;
                                        font-weight: 600;
                                        cursor: pointer;
                                        width: 100%;
                                    ">🚫 Nonaktifkan Sync Local</button>
                                `}
                            </div>
                        </div>
                    </div>

                    <div id="gas-config-section" style="display: ${this.currentProvider === 'googlesheet' ? 'block' : 'none'};">
                        <div style="
                            background: ${sheetsLoggedOut ? '#fed7d7' : '#fffaf0'};
                            border: 2px solid ${sheetsLoggedOut ? '#fc8181' : '#fbd38d'};
                            border-radius: 10px;
                            padding: 16px;
                            margin-bottom: 12px;
                        ">
                            <div style="font-weight: 600; color: ${sheetsLoggedOut ? '#742a2a' : '#744210'}; margin-bottom: 8px;">
                                📊 Google Sheets Configuration
                                ${sheetsLoggedOut ? '<span style="color: #e53e3e; margin-left: 8px;">(LOGGED OUT)</span>' : ''}
                            </div>
                            
                            ${sheetsLoggedOut ? `
                                <div style="background: #fff5f5; border: 1px solid #fc8181; border-radius: 6px; padding: 10px; margin-bottom: 12px; font-size: 13px; color: #742a2a;">
                                    ⚠️ Anda telah logout dari Google Sheets. Sync dinonaktifkan.<br>
                                    Masukkan kredensial untuk login kembali.
                                </div>
                            ` : ''}
                            
                            <div style="margin-bottom: 12px;">
                                <label style="display: block; font-size: 13px; font-weight: 600; color: #4a5568; margin-bottom: 6px;">
                                    Google Apps Script URL <span style="color: #e53e3e;">*</span>
                                </label>
                                <input type="text" id="gas-url-input" value="${this.gasUrl}" placeholder="https://script.google.com/macros/s/..." style="
                                    width: 100%;
                                    padding: 12px;
                                    border: 2px solid #e2e8f0;
                                    border-radius: 8px;
                                    font-size: 14px;
                                ">
                            </div>
                            
                            <div style="margin-bottom: 12px;">
                                <label style="display: block; font-size: 13px; font-weight: 600; color: #4a5568; margin-bottom: 6px;">
                                    Google Sheet ID <span style="color: #e53e3e;">*</span>
                                </label>
                                <input type="text" id="sheet-id-input" value="${this.sheetId}" placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms" style="
                                    width: 100%;
                                    padding: 12px;
                                    border: 2px solid #e2e8f0;
                                    border-radius: 8px;
                                    font-size: 14px;
                                ">
                            </div>
                            
                            ${!sheetsLoggedOut ? `
                                <div style="
                                    background: ${this._gasConfigValid ? '#c6f6d5' : '#fed7d7'};
                                    border-radius: 8px;
                                    padding: 12px;
                                    margin-bottom: 12px;
                                    font-size: 13px;
                                ">
                                    <div style="font-weight: 600; color: ${this._gasConfigValid ? '#22543d' : '#742a2a'};">
                                        ${this._gasConfigValid ? '✅ Konfigurasi Valid' : '⚠️ Konfigurasi Belum Lengkap'}
                                    </div>
                                </div>
                                
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                                    <button onclick="backupModule.saveGASConfig()" style="
                                        background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
                                        color: white;
                                        border: none;
                                        padding: 12px;
                                        border-radius: 8px;
                                        font-weight: 600;
                                        cursor: pointer;
                                    ">💾 Simpan</button>
                                    
                                    <button onclick="backupModule.logoutSheets()" style="
                                        background: #fed7d7;
                                        color: #c53030;
                                        border: 2px solid #fc8181;
                                        padding: 12px;
                                        border-radius: 8px;
                                        font-weight: 600;
                                        cursor: pointer;
                                    ">🚫 Logout</button>
                                </div>
                            ` : `
                                <button onclick="backupModule.loginSheets()" style="
                                    background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
                                    color: white;
                                    border: none;
                                    padding: 12px;
                                    border-radius: 8px;
                                    font-weight: 600;
                                    cursor: pointer;
                                    width: 100%;
                                ">🔑 Login Google Sheets</button>
                            `}
                        </div>
                    </div>

                    <div id="firebase-config-section" style="display: ${this.currentProvider === 'firebase' ? 'block' : 'none'};">
                        <div style="
                            background: ${isFirebaseLoggedOut ? '#fed7d7' : '#fff5f5'};
                            border: 2px solid ${isFirebaseLoggedOut ? '#fc8181' : '#fc8181'};
                            border-radius: 10px;
                            padding: 16px;
                            margin-bottom: 12px;
                        ">
                            <div style="font-weight: 600; color: #742a2a; margin-bottom: 8px;">
                                🔥 Firebase Configuration
                                ${isFirebaseLoggedOut ? '<span style="color: #e53e3e; margin-left: 8px;">(LOGGED OUT)</span>' : ''}
                            </div>
                            
                            ${!this.currentUser ? `
                                <div style="margin-bottom: 12px;">
                                    <label style="display: block; font-size: 13px; font-weight: 600; color: #4a5568; margin-bottom: 6px;">
                                        Firebase Config (JSON) <span style="color: #e53e3e;">*</span>
                                    </label>
                                    <textarea id="firebase-config-input" rows="4" placeholder='{
  "apiKey": "your-api-key",
  "authDomain": "your-project.firebaseapp.com",
  "databaseURL": "https://your-project-default-rtdb.firebaseio.com",
  "projectId": "your-project",
  "storageBucket": "your-project.appspot.com",
  "messagingSenderId": "123456789",
  "appId": "1:123456789:web:abcdef"
}' style="
                                        width: 100%;
                                        padding: 12px;
                                        border: 2px solid #e2e8f0;
                                        border-radius: 8px;
                                        font-size: 13px;
                                        font-family: monospace;
                                    ">${this.firebaseConfig.apiKey ? JSON.stringify(this.firebaseConfig, null, 2) : ''}</textarea>
                                </div>
                                
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                                    <div>
                                        <label style="display: block; font-size: 13px; font-weight: 600; color: #4a5568; margin-bottom: 6px;">
                                            Email
                                        </label>
                                        <input type="email" id="firebase-email" placeholder="admin@example.com" style="
                                            width: 100%;
                                            padding: 12px;
                                            border: 2px solid #e2e8f0;
                                            border-radius: 8px;
                                            font-size: 14px;
                                        ">
                                    </div>
                                    <div>
                                        <label style="display: block; font-size: 13px; font-weight: 600; color: #4a5568; margin-bottom: 6px;">
                                            Password
                                        </label>
                                        <input type="password" id="firebase-password" placeholder="••••••••" style="
                                            width: 100%;
                                            padding: 12px;
                                            border: 2px solid #e2e8f0;
                                            border-radius: 8px;
                                            font-size: 14px;
                                        ">
                                    </div>
                                </div>
                                
                                <button onclick="backupModule.saveFirebaseConfig()" style="
                                    background: linear-gradient(135deg, #ed8936 0%, #dd6b20 100%);
                                    color: white;
                                    border: none;
                                    padding: 12px 24px;
                                    border-radius: 8px;
                                    font-weight: 600;
                                    cursor: pointer;
                                    width: 100%;
                                ">🔥 Connect Firebase</button>
                            ` : `
                                <div style="background: #c6f6d5; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
                                    <div style="font-weight: 600; color: #22543d;">
                                        ✅ Terhubung: ${this.currentUser.email}
                                    </div>
                                    <div style="font-size: 12px; color: #2d3748; margin-top: 4px;">
                                        User ID: ${this.currentUser.uid.substring(0, 20)}...
                                    </div>
                                </div>
                                
                                <button onclick="backupModule.logoutFirebase()" style="
                                    background: #fed7d7;
                                    color: #c53030;
                                    border: 2px solid #fc8181;
                                    padding: 12px 24px;
                                    border-radius: 8px;
                                    font-weight: 600;
                                    cursor: pointer;
                                    width: 100%;
                                ">🚫 Logout Firebase</button>
                            `}
                            
                            <div id="firebase-auth-status" style="margin-top: 12px; padding: 12px; background: #fffaf0; border-radius: 8px; font-size: 13px; display: none;">
                            </div>
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
                        🤖 Konfigurasi Telegram
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                        <div>
                            <label style="display: block; font-size: 13px; font-weight: 600; color: #4a5568; margin-bottom: 6px;">
                                Bot Token
                            </label>
                            <input type="text" id="telegram-bot-token" value="${this.telegramConfig.botToken}" placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz" style="
                                width: 100%;
                                padding: 12px;
                                border: 2px solid #e2e8f0;
                                border-radius: 8px;
                                font-size: 14px;
                            ">
                        </div>
                        <div>
                            <label style="display: block; font-size: 13px; font-weight: 600; color: #4a5568; margin-bottom: 6px;">
                                Chat ID
                            </label>
                            <input type="text" id="telegram-chat-id" value="${this.telegramConfig.chatId}" placeholder="-1001234567890" style="
                                width: 100%;
                                padding: 12px;
                                border: 2px solid #e2e8f0;
                                border-radius: 8px;
                                font-size: 14px;
                            ">
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <input type="checkbox" id="telegram-enabled" ${this.telegramConfig.enabled ? 'checked' : ''} style="width: 18px; height: 18px;">
                            <span style="font-size: 14px; color: #4a5568;">Aktifkan notifikasi Telegram</span>
                        </label>
                    </div>
                    <button onclick="backupModule.saveTelegramConfig()" style="
                        background: linear-gradient(135deg, #38b2ac 0%, #319795 100%);
                        color: white;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 8px;
                        font-weight: 600;
                        cursor: pointer;
                        width: 100%;
                    ">
                        📱 Simpan Konfigurasi Telegram
                    </button>
                </div>

                <div style="
                    background: white;
                    border-radius: 12px;
                    padding: 20px;
                    margin-bottom: 16px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                ">
                    <div style="font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #2d3748;">
                        🔍 Konfigurasi Pencarian (N8N)
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                        <div>
                            <label style="display: block; font-size: 13px; font-weight: 600; color: #4a5568; margin-bottom: 6px;">
                                Bot Token
                            </label>
                            <input type="text" id="n8n-bot-token" value="${this.n8nConfig.botToken}" placeholder="Bot token untuk pencarian" style="
                                width: 100%;
                                padding: 12px;
                                border: 2px solid #e2e8f0;
                                border-radius: 8px;
                                font-size: 14px;
                            ">
                        </div>
                        <div>
                            <label style="display: block; font-size: 13px; font-weight: 600; color: #4a5568; margin-bottom: 6px;">
                                Chat ID
                            </label>
                            <input type="text" id="n8n-chat-id" value="${this.n8nConfig.chatId}" placeholder="Chat ID" style="
                                width: 100%;
                                padding: 12px;
                                border: 2px solid #e2e8f0;
                                border-radius: 8px;
                                font-size: 14px;
                            ">
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                        <div>
                            <label style="display: block; font-size: 13px; font-weight: 600; color: #4a5568; margin-bottom: 6px;">
                                Sheet ID
                            </label>
                            <input type="text" id="n8n-sheet-id" value="${this.n8nConfig.sheetId}" placeholder="Sheet ID untuk pencarian" style="
                                width: 100%;
                                padding: 12px;
                                border: 2px solid #e2e8f0;
                                border-radius: 8px;
                                font-size: 14px;
                            ">
                        </div>
                        <div>
                            <label style="display: block; font-size: 13px; font-weight: 600; color: #4a5568; margin-bottom: 6px;">
                                GAS URL
                            </label>
                            <input type="text" id="n8n-gas-url" value="${this.n8nConfig.gasUrl}" placeholder="GAS URL untuk pencarian" style="
                                width: 100%;
                                padding: 12px;
                                border: 2px solid #e2e8f0;
                                border-radius: 8px;
                                font-size: 14px;
                            ">
                        </div>
                    </div>
                    <button onclick="backupModule.saveN8nConfig()" style="
                        background: linear-gradient(135deg, #9f7aea 0%, #805ad5 100%);
                        color: white;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 8px;
                        font-weight: 600;
                        cursor: pointer;
                        width: 100%;
                    ">
                        🔍 Simpan Konfigurasi Pencarian
                    </button>
                </div>

                <div style="
                    background: white;
                    border-radius: 12px;
                    padding: 20px;
                    margin-bottom: 16px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                ">
                    <div style="font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #2d3748;">
                        ⚡ Auto Sync & Auto Save
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        <label style="display: flex; align-items: center; gap: 12px; cursor: pointer; padding: 12px; background: #f7fafc; border-radius: 8px;">
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
                </div>

                <div style="
                    background: white;
                    border-radius: 12px;
                    padding: 20px;
                    margin-bottom: 16px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                ">
                    <div style="font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #2d3748;">
                        🔄 Aksi Sinkronisasi
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px;">
                        <button onclick="backupModule.syncToCloud()" ${this.currentProvider === 'local' || sheetsLoggedOut || isFirebaseLoggedOut ? 'disabled' : ''} style="
                            background: ${this.currentProvider === 'local' || sheetsLoggedOut || isFirebaseLoggedOut ? '#e2e8f0' : 'linear-gradient(135deg, #4299e1 0%, #3182ce 100%)'};
                            color: ${this.currentProvider === 'local' || sheetsLoggedOut || isFirebaseLoggedOut ? '#a0aec0' : 'white'};
                            border: none;
                            padding: 14px;
                            border-radius: 10px;
                            font-weight: 600;
                            cursor: ${this.currentProvider === 'local' || sheetsLoggedOut || isFirebaseLoggedOut ? 'not-allowed' : 'pointer'};
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            gap: 6px;
                            opacity: ${this.currentProvider === 'local' || sheetsLoggedOut || isFirebaseLoggedOut ? '0.6' : '1'};
                        ">
                            <span style="font-size: 20px;">⬆️</span>
                            <span>Upload ke Cloud</span>
                        </button>
                        <button onclick="backupModule.syncFromCloud()" ${this.currentProvider === 'local' || sheetsLoggedOut || isFirebaseLoggedOut ? 'disabled' : ''} style="
                            background: ${this.currentProvider === 'local' || sheetsLoggedOut || isFirebaseLoggedOut ? '#e2e8f0' : 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)'};
                            color: ${this.currentProvider === 'local' || sheetsLoggedOut || isFirebaseLoggedOut ? '#a0aec0' : 'white'};
                            border: none;
                            padding: 14px;
                            border-radius: 10px;
                            font-weight: 600;
                            cursor: ${this.currentProvider === 'local' || sheetsLoggedOut || isFirebaseLoggedOut ? 'not-allowed' : 'pointer'};
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            gap: 6px;
                            opacity: ${this.currentProvider === 'local' || sheetsLoggedOut || isFirebaseLoggedOut ? '0.6' : '1'};
                        ">
                            <span style="font-size: 20px;">⬇️</span>
                            <span>Download dari Cloud</span>
                        </button>
                        <button onclick="backupModule.previewCloudData()" ${this.currentProvider === 'local' || sheetsLoggedOut || isFirebaseLoggedOut ? 'disabled' : ''} style="
                            background: ${this.currentProvider === 'local' || sheetsLoggedOut || isFirebaseLoggedOut ? '#e2e8f0' : 'linear-gradient(135deg, #9f7aea 0%, #805ad5 100%)'};
                            color: ${this.currentProvider === 'local' || sheetsLoggedOut || isFirebaseLoggedOut ? '#a0aec0' : 'white'};
                            border: none;
                            padding: 14px;
                            border-radius: 10px;
                            font-weight: 600;
                            cursor: ${this.currentProvider === 'local' || sheetsLoggedOut || isFirebaseLoggedOut ? 'not-allowed' : 'pointer'};
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            gap: 6px;
                            opacity: ${this.currentProvider === 'local' || sheetsLoggedOut || isFirebaseLoggedOut ? '0.6' : '1'};
                        ">
                            <span style="font-size: 20px;">👁️</span>
                            <span>Preview Cloud Data</span>
                        </button>
                        <button onclick="backupModule.checkCloudDataOnLoad(true)" ${this.currentProvider === 'local' || sheetsLoggedOut || isFirebaseLoggedOut ? 'disabled' : ''} style="
                            background: ${this.currentProvider === 'local' || sheetsLoggedOut || isFirebaseLoggedOut ? '#e2e8f0' : 'linear-gradient(135deg, #ed8936 0%, #dd6b20 100%)'};
                            color: ${this.currentProvider === 'local' || sheetsLoggedOut || isFirebaseLoggedOut ? '#a0aec0' : 'white'};
                            border: none;
                            padding: 14px;
                            border-radius: 10px;
                            font-weight: 600;
                            cursor: ${this.currentProvider === 'local' || sheetsLoggedOut || isFirebaseLoggedOut ? 'not-allowed' : 'pointer'};
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            gap: 6px;
                            opacity: ${this.currentProvider === 'local' || sheetsLoggedOut || isFirebaseLoggedOut ? '0.6' : '1'};
                        ">
                            <span style="font-size: 20px;">🔄</span>
                            <span>Check Update</span>
                        </button>
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
                        💾 Backup Manual
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <button onclick="backupModule.downloadLocalBackup()" style="
                            background: #e2e8f0;
                            color: #4a5568;
                            border: none;
                            padding: 14px;
                            border-radius: 10px;
                            font-weight: 600;
                            cursor: pointer;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            gap: 8px;
                        ">
                            <span>⬇️</span>
                            <span>Download Backup</span>
                        </button>
                        <label style="
                            background: #e2e8f0;
                            color: #4a5568;
                            border: none;
                            padding: 14px;
                            border-radius: 10px;
                            font-weight: 600;
                            cursor: pointer;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            gap: 8px;
                        ">
                            <span>⬆️</span>
                            <span>Upload Backup</span>
                            <input type="file" accept=".json" onchange="backupModule.uploadLocalBackup(this)" style="display: none;">
                        </label>
                    </div>
                </div>

                <div style="
                    background: white;
                    border-radius: 12px;
                    padding: 20px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                ">
                    <div style="font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #2d3748;">
                        🗑️ Zona Berbahaya
                    </div>
                    <button onclick="backupModule.clearAllData()" style="
                        background: #fed7d7;
                        color: #c53030;
                        border: 2px solid #fc8181;
                        padding: 14px;
                        border-radius: 10px;
                        font-weight: 600;
                        cursor: pointer;
                        width: 100%;
                    ">
                        ⚠️ Hapus Semua Data
                    </button>
                </div>
            </div>
        `;

        this.isRendered = true;
        this.updateSyncStatus(this.syncStatus);
    },

    getStatusColor() {
        const sheetsLoggedOut = localStorage.getItem(this.KEYS.SHEETS_LOGGED_OUT) === 'true';
        const isFirebaseLoggedOut = !this.currentUser && this.currentProvider === 'firebase';
        
        if (this.syncStatus === this.SYNC_STATUS.LOGGED_OUT || sheetsLoggedOut || isFirebaseLoggedOut) {
            return { bg: '#fed7d7', text: '#c53030' };
        }
        if (this.syncStatus === this.SYNC_STATUS.SYNCED) return { bg: '#c6f6d5', text: '#22543d' };
        if (this.syncStatus === this.SYNC_STATUS.SYNCING) return { bg: '#bee3f8', text: '#2a4365' };
        if (this.syncStatus === this.SYNC_STATUS.ERROR) return { bg: '#fed7d7', text: '#742a2a' };
        if (this.syncStatus === this.SYNC_STATUS.OFFLINE) return { bg: '#e2e8f0', text: '#4a5568' };
        return { bg: '#c6f6d5', text: '#22543d' };
    },

    getStatusText() {
        const sheetsLoggedOut = localStorage.getItem(this.KEYS.SHEETS_LOGGED_OUT) === 'true';
        const isFirebaseLoggedOut = !this.currentUser && this.currentProvider === 'firebase';
        
        if (sheetsLoggedOut || isFirebaseLoggedOut) return '🚫 Logged Out';
        if (this.syncStatus === this.SYNC_STATUS.SYNCED) return '✓ Tersinkron';
        if (this.syncStatus === this.SYNC_STATUS.SYNCING) return '⟳ Sinkron...';
        if (this.syncStatus === this.SYNC_STATUS.ERROR) return '✗ Error';
        if (this.syncStatus === this.SYNC_STATUS.OFFLINE) return '● Offline';
        return '✓ Siap';
    },

    refreshUI() {
        if (!this.isRendered) return;
        this.render();
    },

    changeProvider(provider) {
        this.currentProvider = provider;
        localStorage.setItem(this.KEYS.PROVIDER, provider);
        
        const localSection = document.getElementById('local-config-section');
        const gasSection = document.getElementById('gas-config-section');
        const firebaseSection = document.getElementById('firebase-config-section');
        
        if (localSection) localSection.style.display = provider === 'local' ? 'block' : 'none';
        if (gasSection) gasSection.style.display = provider === 'googlesheet' ? 'block' : 'none';
        if (firebaseSection) firebaseSection.style.display = provider === 'firebase' ? 'block' : 'none';
        
        const currentProviderEl = document.getElementById('current-provider');
        if (currentProviderEl) currentProviderEl.textContent = provider;
        
        if (provider === 'firebase') {
            this.initFirebase();
        } else if (provider === 'googlesheet') {
            this._gasConfigValid = this.gasUrl && this.sheetId && this.sheetId.length === 44;
            if (localStorage.getItem(this.KEYS.SHEETS_LOGGED_OUT) === 'true') {
                this._gasConfigValid = false;
            }
        }
        
        this.saveBackupSettings();
        this.showToast('Provider diubah ke: ' + provider);
        this.refreshUI();
    },

    saveGASConfig() {
        const urlInput = document.getElementById('gas-url-input');
        const sheetInput = document.getElementById('sheet-id-input');
        
        if (!urlInput || !sheetInput) {
            this.showToast('❌ Elemen input tidak ditemukan');
            return;
        }
        
        const url = urlInput.value.trim();
        const sheetId = sheetInput.value.trim();
        
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
        const configInput = document.getElementById('firebase-config-input');
        const emailInput = document.getElementById('firebase-email');
        const passwordInput = document.getElementById('firebase-password');
        
        if (!configInput) {
            this.showToast('❌ Elemen config tidak ditemukan');
            return;
        }
        
        const configText = configInput.value.trim();
        const email = emailInput ? emailInput.value.trim() : '';
        const password = passwordInput ? passwordInput.value : '';
        
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

    saveTelegramConfig() {
        const botTokenInput = document.getElementById('telegram-bot-token');
        const chatIdInput = document.getElementById('telegram-chat-id');
        const enabledInput = document.getElementById('telegram-enabled');
        
        if (!botTokenInput || !chatIdInput) {
            this.showToast('❌ Elemen input tidak ditemukan');
            return;
        }
        
        const botToken = botTokenInput.value.trim();
        const chatId = chatIdInput.value.trim();
        const enabled = enabledInput ? enabledInput.checked : false;
        
        this.telegramConfig = {
            botToken,
            chatId,
            enabled,
            gasUrl: this.gasUrl,
            sheetId: this.sheetId
        };
        
        localStorage.setItem(this.KEYS.TELEGRAM_CONFIG, JSON.stringify(this.telegramConfig));
        
        if (typeof dataManager !== 'undefined' && dataManager.data) {
            dataManager.data.telegram = this.telegramConfig;
        }
        
        this.saveBackupSettings();
        this.showToast('✅ Konfigurasi Telegram disimpan');
    },

    saveN8nConfig() {
        const botTokenInput = document.getElementById('n8n-bot-token');
        const chatIdInput = document.getElementById('n8n-chat-id');
        const sheetIdInput = document.getElementById('n8n-sheet-id');
        const gasUrlInput = document.getElementById('n8n-gas-url');
        
        if (!botTokenInput || !chatIdInput) {
            this.showToast('❌ Elemen input tidak ditemukan');
            return;
        }
        
        const botToken = botTokenInput.value.trim();
        const chatId = chatIdInput.value.trim();
        const sheetId = sheetIdInput ? sheetIdInput.value.trim() : '';
        const gasUrl = gasUrlInput ? gasUrlInput.value.trim() : '';
        
        this.n8nConfig = {
            botToken,
            chatId,
            sheetId,
            gasUrl,
            sheetName: 'Data Base Hifzi Cell',
            configSheetId: this.sheetId,
            configGasUrl: this.gasUrl
        };
        
        localStorage.setItem(this.KEYS.N8N_CONFIG, JSON.stringify(this.n8nConfig));
        this.saveBackupSettings();
        this.showToast('✅ Konfigurasi Pencarian disimpan');
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
        if (this.autoSyncInterval) return;
        
        this.autoSyncInterval = setInterval(() => {
            if (this.isOnline && !this.isSyncing) {
                this.syncToCloud();
            }
        }, 60000);
        
        console.log('[Backup] Auto sync started');
    },

    stopAutoSync() {
        if (this.autoSyncInterval) {
            clearInterval(this.autoSyncInterval);
            this.autoSyncInterval = null;
        }
        console.log('[Backup] Auto sync stopped');
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
        this.updateSyncStatus(this.SYNC_STATUS.SYNCING);
        
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
            this.updateSyncStatus(this.SYNC_STATUS.SYNCED);
            
            if (!silent) this.showToast('✅ Sync berhasil');
            console.log('[Backup] Auto-sync completed successfully');
            
        } catch (err) {
            console.error('[Backup] Sync error:', err);
            this.updateSyncStatus(this.SYNC_STATUS.ERROR);
            if (!silent) this.showToast('❌ Sync gagal: ' + err.message);
        } finally {
            this.isSyncing = false;
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
        this.updateSyncStatus(this.SYNC_STATUS.SYNCING);
        
        try {
            let cloudData = null;
            
            if (this.currentProvider === 'firebase' && this.currentUser) {
                const snapshot = await this.database.ref('users/' + this.currentUser.uid + '/hifzi_data').once('value');
                cloudData = snapshot.val();
            } else if (this.currentProvider === 'googlesheet' && this._gasConfigValid) {
                const result = await this.downloadFromGAS();
                cloudData = result.data;
            } else {
                throw new Error('Provider tidak valid');
            }
            
            if (!cloudData) {
                throw new Error('Tidak ada data di cloud');
            }
            
            this.applyDataFromCloud(cloudData);
            
            this.lastSyncTime = new Date().toISOString();
            localStorage.setItem(this.KEYS.LAST_SYNC, this.lastSyncTime);
            this.updateSyncStatus(this.SYNC_STATUS.SYNCED);
            this.showToast('✅ Download berhasil');
            
        } catch (err) {
            console.error('[Backup] Download error:', err);
            this.updateSyncStatus(this.SYNC_STATUS.ERROR);
            this.showToast('❌ Download gagal: ' + err.message);
        } finally {
            this.isSyncing = false;
        }
    },

    prepareDataForSync() {
        if (typeof dataManager === 'undefined' || !dataManager.data) {
            throw new Error('Data manager tidak tersedia');
        }
        
        const rawData = dataManager.data;
        
        const cleanData = {
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
            telegram: this.telegramConfig,
            _backupMeta: {
                backupDate: new Date().toISOString(),
                deviceId: this.deviceId,
                version: '4.3.0',
                recordCounts: {
                    products: (rawData.products || []).length,
                    transactions: (rawData.transactions || []).length,
                    cashTransactions: (rawData.cashTransactions || []).length,
                    debts: (rawData.debts || []).length,
                    categories: (rawData.categories || []).length,
                    users: (rawData.users || []).length,
                    modalHistory: (rawData.modalHistory || []).length
                }
            },
            _configMeta: this.getConfigForBackup()
        };
        
        return cleanData;
    },

    applyDataFromCloud(cloudData) {
        if (typeof dataManager === 'undefined' || !dataManager.data) {
            throw new Error('Data manager tidak tersedia');
        }
        
        const data = dataManager.data;
        
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
        
        if (cloudData.telegram) {
            data.telegram = cloudData.telegram;
            this.telegramConfig = cloudData.telegram;
            localStorage.setItem(this.KEYS.TELEGRAM_CONFIG, JSON.stringify(cloudData.telegram));
        }
        
        if (cloudData._configMeta) {
            this.applyConfigFromCloud(cloudData._configMeta);
        }
        
        if (typeof dataManager.save === 'function') {
            dataManager.save();
        }
        
        if (typeof renderModule === 'function') {
            renderModule();
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

    async downloadFromGAS(silent = false, returnRaw = false) {
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
        
        return returnRaw ? result : result.data;
    },

    async checkCloudDataOnLoad(force = false) {
        if (!this.isOnline) return;
        if (this.isSyncing) return;
        if (!force && this.hasCheckedCloudOnLoad) return;
        
        if (this.currentProvider === 'local') return;
        if (this.currentProvider === 'googlesheet' && !this._gasConfigValid) return;
        if (this.currentProvider === 'firebase' && !this._firebaseAuthStateReady) return;
        
        this.updateSyncStatus(this.SYNC_STATUS.CHECKING);
        
        try {
            let cloudData = null;
            
            if (this.currentProvider === 'firebase' && this.currentUser) {
                const snapshot = await this.database.ref('users/' + this.currentUser.uid + '/hifzi_data').once('value');
                cloudData = snapshot.val();
            } else if (this.currentProvider === 'googlesheet' && this._gasConfigValid) {
                const result = await this.downloadFromGAS(true);
                cloudData = result.data;
            }
            
            this.hasCheckedCloudOnLoad = true;
            
            if (!cloudData) {
                this.updateSyncStatus(this.SYNC_STATUS.IDLE);
                return;
            }
            
            const cloudDate = cloudData._backupMeta?.backupDate;
            const localDate = this.lastSyncTime;
            
            if (cloudDate && (!localDate || new Date(cloudDate) > new Date(localDate))) {
                this.updateSyncStatus(this.SYNC_STATUS.CLOUD_NEWER);
                this.showToast('☁️ Ada data baru di cloud!');
            } else {
                this.updateSyncStatus(this.SYNC_STATUS.SYNCED);
            }
            
        } catch (err) {
            console.error('[Backup] Check cloud error:', err);
            this.updateSyncStatus(this.SYNC_STATUS.ERROR);
        }
    },

    checkNewDeviceGAS() {
        console.log('[Backup] Checking new device GAS...');
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
                this.showToast('✅ Backup berhasil diupload');
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
                telegram: this.telegramConfig
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
        if (typeof Toastify !== 'undefined') {
            Toastify({
                text: message,
                duration: 3000,
                gravity: 'top',
                position: 'right',
                style: {
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    borderRadius: '8px',
                    padding: '12px 20px'
                }
            }).showToast();
        } else {
            console.log('[Toast]', message);
            const toast = document.createElement('div');
            toast.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                z-index: 99999;
                font-family: system-ui, sans-serif;
                font-weight: 600;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                animation: slideIn 0.3s ease;
            `;
            toast.textContent = message;
            document.body.appendChild(toast);
            setTimeout(() => {
                toast.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = backupModule;
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        backupModule.init();
    });
} else {
    backupModule.init();
}

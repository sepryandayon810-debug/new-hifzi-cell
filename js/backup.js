// ============================================
// BACKUP MODULE - HIFZI CELL (COMPLETE v4.0.2)
// FIX: Remove undefined values for Firebase compatibility
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
    
    syncedConfig: {
        provider: 'local',
        gasUrl: '',
        sheetId: '',
        firebaseConfig: {},
        autoSync: false,
        version: '4.0.2'
    },
    
    SYNC_STATUS: {
        IDLE: 'idle',
        SYNCING: 'syncing',
        SYNCED: 'synced',
        ERROR: 'error',
        CONFLICT: 'conflict',
        OFFLINE: 'offline',
        CHECKING: 'checking',
        CLOUD_NEWER: 'cloud_newer'
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
        SYNCED_CONFIG: 'hifzi_synced_config',
        CONFIG_SYNCED_AT: 'hifzi_config_synced_at'
    },

    init(forceReinit = false) {
        if (this.isInitialized && !forceReinit) {
            console.log('[Backup] Already initialized, skipping...');
            this.reloadAllConfig();
            return this;
        }

        console.log('[Backup] ========================================');
        console.log('[Backup] Initializing v4.0.2 - Firebase Fix Ready...');
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
        
        this.loadSyncedConfig();
        
        if (this.currentProvider === 'firebase') {
            this.initFirebase(true);
        } else if (this.currentProvider === 'googlesheet') {
            if (this._gasConfigValid) {
                this.checkNewDeviceGAS();
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
    // HELPER: Remove undefined values recursively
    // ============================================
    
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

    // ============================================
    // CONFIG SYNC
    // ============================================
    
    async syncConfigToCloud() {
        if (this.currentProvider === 'local') return;
        
        this.syncedConfig = {
            provider: this.currentProvider,
            gasUrl: this.gasUrl,
            sheetId: this.sheetId,
            firebaseConfig: this.firebaseConfig,
            autoSync: this.isAutoSyncEnabled,
            version: '4.0.2',
            syncedAt: new Date().toISOString(),
            syncedBy: this.deviceId
        };
        
        try {
            if (this.currentProvider === 'firebase' && this.database && this.currentUser) {
                const cleanConfig = this.cleanUndefined({
                    ...this.syncedConfig,
                    _meta: {
                        lastModified: new Date().toISOString(),
                        deviceId: this.deviceId
                    }
                });
                
                await this.database.ref('users/' + this.currentUser.uid + '/hifzi_config').set(cleanConfig);
                console.log('[Backup] Config synced to Firebase');
            } else if (this.currentProvider === 'googlesheet' && this._gasConfigValid) {
                const payload = {
                    action: 'syncConfig',
                    config: this.syncedConfig,
                    sheetId: this.cleanSheetId(this.sheetId),
                    deviceId: this.deviceId
                };
                
                await fetch(this.gasUrl, {
                    method: 'POST',
                    mode: 'cors',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify(payload)
                });
                console.log('[Backup] Config synced to GAS');
            }
            
            localStorage.setItem(this.KEYS.CONFIG_SYNCED_AT, new Date().toISOString());
        } catch (err) {
            console.error('[Backup] Failed to sync config:', err);
        }
    },

    async loadConfigFromCloud() {
        if (this.currentProvider === 'local') return null;
        
        try {
            let cloudConfig = null;
            
            if (this.currentProvider === 'firebase' && this.database && this.currentUser) {
                const snapshot = await this.database.ref('users/' + this.currentUser.uid + '/hifzi_config').once('value');
                cloudConfig = snapshot.val();
            } else if (this.currentProvider === 'googlesheet' && this._gasConfigValid) {
                const payload = {
                    action: 'getConfig',
                    sheetId: this.cleanSheetId(this.sheetId),
                    deviceId: this.deviceId
                };
                
                const response = await fetch(this.gasUrl, {
                    method: 'POST',
                    mode: 'cors',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify(payload)
                });
                
                const result = await response.json();
                if (result.success) {
                    cloudConfig = result.config;
                }
            }
            
            if (cloudConfig) {
                console.log('[Backup] Config loaded from cloud:', cloudConfig);
                
                const localConfigStr = JSON.stringify({
                    provider: this.currentProvider,
                    gasUrl: this.gasUrl,
                    sheetId: this.sheetId,
                    firebaseConfig: this.firebaseConfig,
                    autoSync: this.isAutoSyncEnabled
                });
                
                const cloudConfigStr = JSON.stringify({
                    provider: cloudConfig.provider,
                    gasUrl: cloudConfig.gasUrl,
                    sheetId: cloudConfig.sheetId,
                    firebaseConfig: cloudConfig.firebaseConfig,
                    autoSync: cloudConfig.autoSync
                });
                
                if (localConfigStr !== cloudConfigStr) {
                    console.log('[Backup] Applying config from cloud...');
                    
                    const oldProvider = this.currentProvider;
                    
                    this.currentProvider = cloudConfig.provider || this.currentProvider;
                    this.gasUrl = cloudConfig.gasUrl || this.gasUrl;
                    this.sheetId = cloudConfig.sheetId || this.sheetId;
                    this.firebaseConfig = cloudConfig.firebaseConfig || this.firebaseConfig;
                    this.isAutoSyncEnabled = cloudConfig.autoSync || this.isAutoSyncEnabled;
                    
                    localStorage.setItem(this.KEYS.PROVIDER, this.currentProvider);
                    localStorage.setItem(this.KEYS.GAS_URL, this.gasUrl);
                    localStorage.setItem(this.KEYS.SHEET_ID, this.sheetId);
                    localStorage.setItem(this.KEYS.FIREBASE_CONFIG, JSON.stringify(this.firebaseConfig));
                    localStorage.setItem(this.KEYS.AUTO_SYNC, this.isAutoSyncEnabled);
                    this.saveBackupSettings();
                    
                    if (oldProvider !== this.currentProvider) {
                        if (this.currentProvider === 'firebase') {
                            this.initFirebase(true);
                        }
                    }
                    
                    this._gasConfigValid = this.gasUrl && this.sheetId && this.sheetId.length === 44;
                    
                    this.showToast('✅ Konfigurasi di-sync dari cloud!');
                    return true;
                }
            }
            
            return false;
        } catch (err) {
            console.error('[Backup] Failed to load config from cloud:', err);
            return false;
        }
    },

    loadSyncedConfig() {
        try {
            const saved = localStorage.getItem(this.KEYS.SYNCED_CONFIG);
            if (saved) {
                this.syncedConfig = JSON.parse(saved);
            }
        } catch (e) {
            console.log('[Backup] No synced config found');
        }
    },

    // ============================================
    // PREVIEW & DOWNLOAD FEATURES - EXCEL STYLE TABLE
    // ============================================
    
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
                </div>
                
                <div style="padding: 20px; overflow-y: auto; flex: 1; background: #f7fafc;">
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
                    
                    ${data.telegram ? `
                    <div style="background: #e6fffa; border: 2px solid #81e6d9; border-radius: 10px; padding: 16px; margin-top: 20px;">
                        <div style="font-weight: 600; color: #234e52; margin-bottom: 8px;">📱 Telegram Config</div>
                        <div style="font-size: 13px; color: #2d3748;">
                            Bot Token: ${data.telegram.botToken ? '✅ Terkonfigurasi' : '❌ Tidak ada'} | 
                            Chat ID: ${data.telegram.chatId || '-'} | 
                            Status: ${data.telegram.enabled ? '✅ Aktif' : '❌ Nonaktif'}
                        </div>
                    </div>
                    ` : ''}
                    
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
        if (products.length === 0) {
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
        if (transactions.length === 0) {
            return '<div style="text-align: center; padding: 40px; color: #718096;">📝 Tidak ada data transaksi</div>';
        }
        
        const rows = transactions.slice(0, 100).map((t, i) => `
            <tr>
                <td class="text-center">${i + 1}</td>
                <td>${t.id?.substring(0, 8) || '-'}</td>
                <td>${new Date(t.date).toLocaleDateString('id-ID')}</td>
                <td>${t.customerName || 'Umum'}</td>
                <td class="text-right">${t.items?.length || 0} item</td>
                <td class="text-right"><strong>Rp ${(t.total || 0).toLocaleString('id-ID')}</strong></td>
                <td class="text-center">
                    <span class="badge ${t.paymentMethod === 'cash' ? 'badge-success' : 'badge-info'}">
                        ${t.paymentMethod === 'cash' ? 'Tunai' : t.paymentMethod || '-'}
                    </span>
                </td>
            </tr>
        `).join('');
        
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
        if (transactions.length === 0) {
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
        if (debts.length === 0) {
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
        if (categories.length === 0) {
            return '<div style="text-align: center; padding: 40px; color: #718096;">📁 Tidak ada data kategori</div>';
        }
        
        const rows = categories.map((c, i) => `
            <tr>
                <td class="text-center">${i + 1}</td>
                <td><strong>${c.name || '-'}</strong></td>
                <td>${c.description || '-'}</td>
                <td class="text-center">${c.productCount || 0}</td>
                <td class="text-center">
                    <span class="badge badge-info">${c.id?.substring(0, 8) || '-'}</span>
                </td>
            </tr>
        `).join('');
        
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
        if (users.length === 0) {
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

    switchPreviewTab(tabName) {
        document.querySelectorAll('.preview-content').forEach(el => {
            el.style.display = 'none';
        });
        
        document.querySelectorAll('.preview-tab').forEach(el => {
            el.style.background = '#e2e8f0';
            el.style.color = '#4a5568';
        });
        
        const contentEl = document.getElementById('content-' + tabName);
        if (contentEl) contentEl.style.display = 'block';
        
        const tabEl = document.getElementById('tab-' + tabName);
        if (tabEl) {
            tabEl.style.background = '#667eea';
            tabEl.style.color = 'white';
        }
    },

    closePreviewModal() {
        const modal = document.getElementById('preview-modal');
        if (modal) modal.remove();
    },

    downloadPreviewData() {
        if (!this.previewData) return;
        
        const blob = new Blob([JSON.stringify(this.previewData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `hifzi_cloud_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.showToast('✅ Data cloud didownload!');
    },

    // ============================================
    // MANUAL CHECK UPDATE
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
        
        this.cloudCheckCount = 0;
        this.lastCloudCheck = null;
        
        this.showToast('🔍 Mengecek update di cloud...');
        
        const configUpdated = await this.loadConfigFromCloud();
        await this.checkCloudDataOnLoad(true);
        
        if (!configUpdated) {
            this.showToast('✅ Config sudah up to date!');
        }
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
        
        const now = Date.now();
        const lastCheck = this.lastCloudCheck ? new Date(this.lastCloudCheck).getTime() : 0;
        const minInterval = force ? 10000 : 60000;
        
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
                        this.updateSyncStatus(this.SYNC_STATUS.IDLE);
                        this.showToast('ℹ️ Belum ada data di cloud');
                        return;
                    }
                    cloudHash = result.hash;
                    cloudTimestamp = result.timestamp;
                    cloudDeviceId = result.deviceId;
                    
                    if (cloudHash !== this.lastLocalDataHash) {
                        const fullResult = await this.downloadFromGAS(true, true);
                        if (fullResult && fullResult.data) {
                            cloudData = fullResult.data;
                        }
                    }
                }
            }
            
            this.lastCloudCheck = new Date().toISOString();
            localStorage.setItem(this.KEYS.LAST_CLOUD_CHECK, this.lastCloudCheck);
            
            if (!cloudData && !cloudHash) {
                this.updateSyncStatus(this.SYNC_STATUS.IDLE);
                return;
            }
            
            const currentLocalData = this.getBackupData();
            const currentLocalHash = this.generateDataHash(currentLocalData);
            
            if (cloudHash) {
                this.cloudDataHash = cloudHash;
                localStorage.setItem(this.KEYS.CLOUD_DATA_HASH, cloudHash);
            }
            
            if (cloudHash === currentLocalHash) {
                this.updateSyncStatus(this.SYNC_STATUS.SYNCED);
                this.showToast('✅ Data sudah up to date!');
                return;
            }
            
            const isFromOtherDevice = cloudDeviceId && cloudDeviceId !== this.deviceId;
            const localTime = this.lastSyncTime ? new Date(this.lastSyncTime).getTime() : 0;
            const cloudTime = cloudTimestamp ? new Date(cloudTimestamp).getTime() : 0;
            
            if (isFromOtherDevice || cloudTime > localTime + 60000) {
                this.updateSyncStatus(this.SYNC_STATUS.CLOUD_NEWER);
                this.showSyncConflictModal('cloud_newer', cloudData, cloudTime, localTime, isFromOtherDevice);
            } else {
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
            
            return await response.json();
        } catch (err) {
            return { success: false, error: err.message };
        }
    },

    showSyncConflictModal(type, cloudData, cloudTime, localTime, isFromOtherDevice = true) {
        const cloudDate = new Date(cloudTime).toLocaleString('id-ID');
        const localDate = this.lastSyncTime ? new Date(this.lastSyncTime).toLocaleString('id-ID') : 'Belum pernah sync';
        
        const modal = document.createElement('div');
        modal.id = 'sync-conflict-modal';
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
        `;
        
        const deviceBadge = isFromOtherDevice ? 
            `<span style="background: #ed8936; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">🔄 Device Lain</span>` :
            `<span style="background: #4299e1; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">💾 Cloud</span>`;
        
        modal.innerHTML = `
            <div style="background: white; border-radius: 16px; max-width: 500px; width: 100%; overflow: hidden;">
                <div style="background: linear-gradient(135deg, #ed8936 0%, #dd6b20 100%); color: white; padding: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="font-size: 20px; font-weight: 700;">🔄 Data Baru Tersedia!</div>
                        ${deviceBadge}
                    </div>
                </div>
                <div style="padding: 20px;">
                    <div style="background: #fff5f5; border-left: 4px solid #fc8181; padding: 12px; border-radius: 6px; margin-bottom: 16px; font-size: 13px; color: #c53030;">
                        <strong>Perhatian:</strong> Data di cloud lebih baru dari data lokal Anda.
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                        <div style="background: #f7fafc; padding: 12px; border-radius: 8px; border: 2px solid #e2e8f0;">
                            <div style="font-size: 11px; color: #718096; margin-bottom: 4px;">💾 Data Lokal</div>
                            <div style="font-weight: 600; font-size: 13px;">${localDate}</div>
                        </div>
                        <div style="background: #f0fff4; padding: 12px; border-radius: 8px; border: 2px solid #48bb78;">
                            <div style="font-size: 11px; color: #718096; margin-bottom: 4px;">☁️ Data Cloud</div>
                            <div style="font-weight: 600; font-size: 13px;">${cloudDate}</div>
                        </div>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        <button onclick="backupModule.resolveConflict('download')" style="padding: 14px; background: #48bb78; color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600;">⬇️ Download & Ganti Data Lokal</button>
                        <button onclick="backupModule.resolveConflict('merge')" style="padding: 14px; background: #4299e1; color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600;">🔄 Gabungkan Data</button>
                        <button onclick="backupModule.resolveConflict('upload')" style="padding: 12px; background: #ed8936; color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600;">⬆️ Upload Lokal & Timpa Cloud</button>
                        <button onclick="backupModule.closeConflictModal()" style="padding: 12px; background: #e2e8f0; color: #4a5568; border: none; border-radius: 10px; cursor: pointer;">❌ Batal</button>
                    </div>
                </div>
            </div>
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
                this.showToast('⬇️ Downloading...');
                await this.downloadFromCloudSilent(this.pendingCloudData);
                this.showToast('✅ Berhasil! Reload...');
                setTimeout(() => location.reload(), 1500);
                break;
            case 'upload':
                this.showToast('⬆️ Uploading...');
                await this.forceSyncNow();
                this.showToast('✅ Berhasil!');
                break;
            case 'merge':
                this.showToast('🔄 Merging...');
                await this.smartMergeData(this.pendingCloudData);
                this.showToast('✅ Berhasil! Reload...');
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
            cashTransactions: this.mergeCashTransactions(localData.cashTransactions || [], cloudData.cashTransactions || []),
            debts: this.mergeArrays(localData.debts || [], cloudData.debts || [], 'id', 'updatedAt'),
            categories: this.mergeArrays(localData.categories || [], cloudData.categories || [], 'id'),
            users: this.mergeArrays(localData.users || [], cloudData.users || [], 'id', 'lastLogin'),
            settings: { ...cloudData.settings, ...localData.settings },
            kasir: this.mergeKasirData(localData.kasir || {}, cloudData.kasir || {}),
            shiftHistory: this.mergeArrays(localData.shiftHistory || [], cloudData.shiftHistory || [], 'date'),
            loginHistory: this.mergeArrays(localData.loginHistory || [], cloudData.loginHistory || [], 'id', 'timestamp'),
            pendingModals: { ...(cloudData.pendingModals || {}), ...(localData.pendingModals || {}) },
            telegram: cloudData.telegram || localData.telegram || { botToken: '', chatId: '', enabled: false },
            searchHistory: this.mergeArrays(localData.searchHistory || [], cloudData.searchHistory || [], 'id', 'timestamp'),
            _backupMeta: {
                version: '4.0.2',
                deviceId: this.deviceId,
                backupDate: new Date().toISOString(),
                provider: this.currentProvider,
                syncMode: 'merged'
            }
        };
        
        this.saveBackupData(merged);
        await this.forceSyncNow();
    },

    mergeCashTransactions(localArr, cloudArr) {
        const map = new Map();
        cloudArr.forEach(item => { map.set(item.id, { ...item, source: 'cloud' }); });
        localArr.forEach(item => {
            if (!map.has(item.id)) { map.set(item.id, { ...item, source: 'local' }); }
            else {
                const existing = map.get(item.id);
                const localTime = new Date(item.timestamp || item.date || 0).getTime();
                const cloudTime = new Date(existing.timestamp || existing.date || 0).getTime();
                if (localTime > cloudTime) map.set(item.id, { ...item, source: 'local' });
            }
        });
        return Array.from(map.values());
    },

    mergeKasirData(localKasir, cloudKasir) {
        const localShifts = localKasir.activeShifts || [];
        const cloudShifts = cloudKasir.activeShifts || [];
        const shiftMap = new Map();
        [...localShifts, ...cloudShifts].forEach(shift => {
            const existing = shiftMap.get(shift.userId);
            if (!existing) shiftMap.set(shift.userId, shift);
            else {
                const existingTime = new Date(existing.openTime || 0).getTime();
                const newTime = new Date(shift.openTime || 0).getTime();
                if (newTime > existingTime) shiftMap.set(shift.userId, shift);
            }
        });
        return {
            isOpen: shiftMap.size > 0,
            activeShifts: Array.from(shiftMap.values()),
            date: cloudKasir.date || localKasir.date || new Date().toDateString(),
            lastCheckDate: cloudKasir.lastCheckDate || localKasir.lastCheckDate
        };
    },

    mergeArrays(localArr, cloudArr, idField, timeField = null) {
        const map = new Map();
        cloudArr.forEach(item => { map.set(item[idField], { ...item, source: 'cloud' }); });
        localArr.forEach(item => {
            const existing = map.get(item[idField]);
            if (!existing) map.set(item[idField], { ...item, source: 'local' });
            else if (timeField) {
                const localTime = new Date(item[timeField] || 0).getTime();
                const cloudTime = new Date(existing[timeField] || 0).getTime();
                if (localTime >= cloudTime) map.set(item[idField], { ...item, source: 'local' });
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
            if (typeof app !== 'undefined' && app.refreshData) app.refreshData();
        } catch (err) {
            this.updateSyncStatus(this.SYNC_STATUS.ERROR);
        }
    },

    updateSyncStatus(status) {
        this.syncStatus = status;
        if (this.isRendered) this.updateSyncIndicator();
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
            indicator.innerHTML = `<span style="font-size:16px;">${config.icon}</span> <span style="color:${config.color};font-weight:600;">${config.text}</span>`;
            indicator.style.background = config.bg;
            indicator.style.padding = '6px 16px';
            indicator.style.borderRadius = '20px';
        }
        
        if (lastSyncText && this.lastSyncTime) {
            lastSyncText.textContent = 'Sync: ' + this.getTimeAgo(new Date(this.lastSyncTime));
        }
        
        if (checkUpdateBtn) {
            checkUpdateBtn.innerHTML = config.btn;
            checkUpdateBtn.disabled = this.syncStatus === this.SYNC_STATUS.CHECKING || this.syncStatus === this.SYNC_STATUS.SYNCING;
            checkUpdateBtn.style.opacity = checkUpdateBtn.disabled ? '0.6' : '1';
            if (this.syncStatus === this.SYNC_STATUS.CLOUD_NEWER) {
                checkUpdateBtn.style.background = 'linear-gradient(135deg,#ed8936 0%,#dd6b20 100%)';
            } else {
                checkUpdateBtn.style.background = 'linear-gradient(135deg,#4299e1 0%,#3182ce 100%)';
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

    async forceSyncNow() {
        if (this.isSyncing) {
            this.showToast('⏳ Sync sedang berjalan...');
            return;
        }
        
        this.updateSyncStatus(this.SYNC_STATUS.SYNCING);
        this.showToast('🔄 Uploading...');
        
        try {
            const data = this.getBackupData();
            if (this.currentProvider === 'firebase') {
                if (!this.currentUser) throw new Error('Belum login');
                await this.uploadToFirebase(data, false);
            } else if (this.currentProvider === 'googlesheet') {
                if (!this._gasConfigValid) throw new Error('Config tidak lengkap');
                await this.uploadToGAS(data, false);
            } else throw new Error('Provider tidak valid');
            
            this.lastLocalDataHash = this.generateDataHash(data);
            localStorage.setItem(this.KEYS.LAST_DATA_HASH, this.lastLocalDataHash);
            this.updateSyncStatus(this.SYNC_STATUS.SYNCED);
            this.showToast('✅ Upload berhasil!');
            await this.syncConfigToCloud();
        } catch (err) {
            this.updateSyncStatus(this.SYNC_STATUS.ERROR);
            this.showToast('❌ Upload gagal: ' + err.message);
        }
    },

    // ============================================
    // FIXED: getBackupData dengan cleanUndefined
    // ============================================

    getBackupData() {
        let allData = {};
        if (typeof dataManager !== 'undefined') {
            if (dataManager.getAllData) allData = dataManager.getAllData();
            else if (dataManager.data) allData = dataManager.data;
        }
        
        // Helper untuk membersihkan undefined
        const clean = (val) => {
            if (val === undefined) return null;
            if (val === null) return null;
            if (typeof val === 'string') return val;
            if (typeof val === 'number') return val;
            if (typeof val === 'boolean') return val;
            if (val instanceof Date) return val.toISOString();
            if (Array.isArray(val)) return val.map(clean).filter(v => v !== undefined);
            if (typeof val === 'object') {
                const cleaned = {};
                for (const [k, v] of Object.entries(val)) {
                    if (v !== undefined) cleaned[k] = clean(v);
                }
                return cleaned;
            }
            return val;
        };

        const cashTransactions = (allData.cashTransactions || []).map(t => clean({
            id: t.id || 'cash_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            type: t.type || 'expense',
            category: t.category || '',
            amount: t.amount || 0,
            description: t.description || '',
            date: t.date || new Date().toISOString(),
            timestamp: t.timestamp || new Date().toISOString(),
            userId: t.userId || '',
            userName: t.userName || '',
            paymentMethod: t.paymentMethod || 'cash',
            details: {
                adminFee: t.details?.adminFee || 0,
                provider: t.details?.provider || '',
                phoneNumber: t.details?.phoneNumber || '',
                recipientName: t.details?.recipientName || '',
                bankName: t.details?.bankName || '',
                accountNumber: t.details?.accountNumber || ''
            },
            shiftId: t.shiftId || ''
        }));

        const telegram = clean(allData.telegram || {
            botToken: '',
            chatId: '',
            enabled: false,
            lastTest: null
        });

        const searchHistory = (allData.searchHistory || []).map(item => clean({
            id: item.id || '',
            query: item.query || '',
            timestamp: item.timestamp || new Date().toISOString(),
            userId: item.userId || '',
            resultCount: item.resultCount || 0
        }));

        const products = (allData.products || []).map(p => clean({
            id: p.id || '',
            name: p.name || '',
            category: p.category || '',
            price: p.price || 0,
            stock: p.stock || 0,
            barcode: p.barcode || '',
            description: p.description || '',
            createdAt: p.createdAt || new Date().toISOString(),
            updatedAt: p.updatedAt || new Date().toISOString()
        }));

        const transactions = (allData.transactions || []).map(t => clean({
            id: t.id || '',
            date: t.date || new Date().toISOString(),
            customerName: t.customerName || 'Umum',
            items: (t.items || []).map(item => clean({
                id: item.id || '',
                name: item.name || '',
                price: item.price || 0,
                quantity: item.quantity || 1,
                total: item.total || 0
            })),
            total: t.total || 0,
            paymentMethod: t.paymentMethod || 'cash',
            discount: t.discount || 0,
            tax: t.tax || 0,
            finalTotal: t.finalTotal || t.total || 0,
            userId: t.userId || '',
            userName: t.userName || '',
            shiftId: t.shiftId || ''
        }));

        const debts = (allData.debts || []).map(d => clean({
            id: d.id || '',
            customerName: d.customerName || '',
            customerPhone: d.customerPhone || '',
            totalAmount: d.totalAmount || 0,
            paidAmount: d.paidAmount || 0,
            status: d.status || 'unpaid',
            createdAt: d.createdAt || new Date().toISOString(),
            updatedAt: d.updatedAt || new Date().toISOString(),
            items: d.items || []
        }));

        const categories = (allData.categories || []).map(c => clean({
            id: c.id || '',
            name: c.name || '',
            description: c.description || '',
            productCount: c.productCount || 0
        }));

        const users = (allData.users || []).map(u => clean({
            id: u.id || '',
            name: u.name || u.username || '',
            username: u.username || '',
            email: u.email || '',
            role: u.role || 'user',
            isActive: u.isActive !== undefined ? u.isActive : true,
            lastLogin: u.lastLogin || null,
            createdAt: u.createdAt || new Date().toISOString()
        }));

        const kasir = clean(allData.kasir || {
            isOpen: false,
            activeShifts: [],
            date: new Date().toDateString(),
            lastCheckDate: new Date().toDateString()
        });

        const settings = clean(allData.settings || {
            currentCash: 0,
            storeName: '',
            storeAddress: '',
            storePhone: '',
            taxRate: 0,
            currency: 'IDR'
        });

        const shiftHistory = (allData.shiftHistory || []).map(s => clean({
            date: s.date || '',
            openTime: s.openTime || '',
            closeTime: s.closeTime || '',
            userId: s.userId || '',
            userName: s.userName || '',
            openingCash: s.openingCash || 0,
            closingCash: s.closingCash || 0,
            totalSales: s.totalSales || 0,
            totalTransactions: s.totalTransactions || 0
        }));

        const loginHistory = (allData.loginHistory || []).map(l => clean({
            id: l.id || '',
            userId: l.userId || '',
            userName: l.userName || '',
            timestamp: l.timestamp || new Date().toISOString(),
            ip: l.ip || '',
            device: l.device || ''
        }));

        const pendingModals = clean(allData.pendingModals || {});

        const currentUser = clean(allData.currentUser || null);

        const backupData = {
            products: products,
            categories: categories,
            transactions: transactions,
            cashTransactions: cashTransactions,
            debts: debts,
            kasir: kasir,
            settings: settings,
            shiftHistory: shiftHistory,
            loginHistory: loginHistory,
            pendingModals: pendingModals,
            currentUser: currentUser,
            telegram: telegram,
            searchHistory: searchHistory,
            users: users,
            _backupMeta: {
                version: '4.0.2',
                deviceId: this.deviceId,
                deviceName: this.deviceName,
                backupDate: new Date().toISOString(),
                provider: this.currentProvider
            }
        };

        // Final cleaning untuk memastikan tidak ada undefined
        return this.cleanUndefined(backupData);
    },

    saveBackupData(backupData) {
        if (typeof dataManager !== 'undefined') {
            if (dataManager.saveAllData) dataManager.saveAllData(backupData);
            else {
                Object.keys(backupData).forEach(key => {
                    if (key !== '_backupMeta') dataManager.data[key] = backupData[key];
                });
                if (dataManager.saveData) dataManager.saveData();
            }
        }
    },

    // ============================================
    // RENDER
    // ============================================
    
    render() {
        if (!this.isInitialized) { this.init(); }
        else { this.reloadAllConfig(); this._gasConfigValid = this.gasUrl && this.sheetId && this.sheetId.length === 44; }
        
        const container = document.getElementById('mainContent');
        if (!container) { setTimeout(() => this.render(), 100); return; }
        
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
                        <div style="font-size:13px;opacity:0.9;">${this.isOnline ? '🟢 Online' : '🔴 Offline'} ${this.isAutoSyncEnabled ? '• Auto-sync ON' : '• Manual sync'}</div>
                        <div id="last-sync-text" style="font-size:12px;opacity:0.8;">${this.lastSyncTime ? 'Sync: ' + this.getTimeAgo(new Date(this.lastSyncTime)) : 'Belum pernah sync'}</div>
                    </div>
                </div>
                
                ${!isLocal ? `
                <div style="background:linear-gradient(135deg,#ed8936 0%,#dd6b20 100%);padding:20px;border-radius:16px;margin-bottom:20px;box-shadow:0 4px 15px rgba(237,137,54,0.3);">
                    <div style="color:white;margin-bottom:16px;text-align:center;">
                        <div style="font-size:16px;font-weight:600;">🔄 Sinkronisasi Data</div>
                        <div style="font-size:13px;opacity:0.9;">Cek dan kelola data di cloud</div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                        <button id="check-update-btn" onclick="backupModule.manualCheckUpdate()" style="padding:14px;background:white;color:#ed8936;border:none;border-radius:12px;cursor:pointer;font-weight:700;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,0.2);">🔍 Cek Update</button>
                        <button onclick="backupModule.previewCloudData()" style="padding:14px;background:rgba(255,255,255,0.2);color:white;border:2px solid white;border-radius:12px;cursor:pointer;font-weight:700;font-size:14px;">👁️ Preview Data</button>
                    </div>
                </div>` : ''}
                
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
                
                <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:24px;">
                    <div style="background:white;padding:16px;border-radius:12px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
                        <div style="font-size:28px;">📦</div>
                        <div style="font-size:12px;color:#718096;">Produk</div>
                        <div style="font-size:20px;font-weight:700;">${stats.products}</div>
                    </div>
                    <div style="background:white;padding:16px;border-radius:12px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
                        <div style="font-size:28px;">📝</div>
                        <div style="font-size:12px;color:#718096;">Transaksi</div>
                        <div style="font-size:20px;font-weight:700;">${stats.transactions}</div>
                    </div>
                    <div style="background:white;padding:16px;border-radius:12px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
                        <div style="font-size:28px;">💸</div>
                        <div style="font-size:12px;color:#718096;">Cash Flow</div>
                        <div style="font-size:20px;font-weight:700;">${stats.cashTransactions}</div>
                    </div>
                    <div style="background:white;padding:16px;border-radius:12px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
                        <div style="font-size:28px;">💳</div>
                        <div style="font-size:12px;color:#718096;">Hutang</div>
                        <div style="font-size:20px;font-weight:700;">${stats.debts}</div>
                    </div>
                    <div style="background:white;padding:16px;border-radius:12px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
                        <div style="font-size:28px;">💰</div>
                        <div style="font-size:12px;color:#718096;">Kas</div>
                        <div style="font-size:16px;font-weight:700;">Rp ${stats.cash.toLocaleString('id-ID')}</div>
                    </div>
                </div>
                
                <div style="background:white;padding:20px;border-radius:12px;margin-bottom:20px;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
                    <div style="font-size:16px;font-weight:600;margin-bottom:16px;color:#2d3748;">☁️ Pilih Metode Backup</div>
                    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
                        <button onclick="backupModule.setProvider('local')" style="padding:16px;border:2px solid ${isLocal ? '#667eea' : '#e2e8f0'};border-radius:12px;background:${isLocal ? '#f7fafc' : 'white'};cursor:pointer;">
                            <div style="font-size:32px;">💾</div>
                            <div style="font-weight:600;">Local File</div>
                            <div style="font-size:12px;color:#718096;">Tidak sync antar device</div>
                        </button>
                        <button onclick="backupModule.setProvider('firebase')" style="padding:16px;border:2px solid ${isFirebase ? '#ff6b35' : '#e2e8f0'};border-radius:12px;background:${isFirebase ? '#fff5f0' : 'white'};cursor:pointer;">
                            <div style="font-size:32px;">🔥</div>
                            <div style="font-weight:600;">Firebase</div>
                            <div style="font-size:12px;color:#718096;">${isFBLoggedIn ? '✅ Connected' : isFBConfigured ? '⚠️ Configured' : 'Real-time sync'}</div>
                        </button>
                        <button onclick="backupModule.setProvider('googlesheet')" style="padding:16px;border:2px solid ${isGAS ? '#34a853' : '#e2e8f0'};border-radius:12px;background:${isGAS ? '#f0fff4' : 'white'};cursor:pointer;">
                            <div style="font-size:32px;">📊</div>
                            <div style="font-weight:600;">Google Sheets</div>
                            <div style="font-size:12px;color:#718096;">${isGASConfigured ? '✅ Ready' : 'Setup Required'}</div>
                        </button>
                    </div>
                </div>
                
                ${isFirebase ? this.renderFirebaseSection(isFBConfigured, isFBLoggedIn) : ''}
                ${isGAS ? this.renderGASSection(isGASConfigured) : ''}
                
                <div style="background:white;padding:20px;border-radius:12px;margin-bottom:20px;box-shadow:0 2px 8px rgba(0,0,0,0.05);border:2px solid ${(isFirebase && !isFBLoggedIn) || (isGAS && !isGASConfigured) ? '#fc8181' : '#667eea'};">
                    <div style="font-size:16px;font-weight:600;margin-bottom:16px;color:#2d3748;">🔄 Sinkronisasi</div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
                        <button onclick="backupModule.forceSyncNow()" style="padding:16px;background:${(isFirebase && !isFBLoggedIn) || (isGAS && !isGASConfigured) ? '#cbd5e0' : 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)'};color:white;border:none;border-radius:10px;cursor:${(isFirebase && !isFBLoggedIn) || (isGAS && !isGASConfigured) ? 'not-allowed' : 'pointer'};font-weight:600;" ${(isFirebase && !isFBLoggedIn) || (isGAS && !isGASConfigured) ? 'disabled' : ''}>
                            <div>⬆️ Upload ke Cloud</div>
                            <div style="font-size:11px;opacity:0.9;">Kirim data device ini</div>
                        </button>
                        <button onclick="backupModule.manualDownload()" style="padding:16px;background:${(isFirebase && !isFBLoggedIn) || (isGAS && !isGASConfigured) ? '#cbd5e0' : 'linear-gradient(135deg,#48bb78 0%,#38a169 100%)'};color:white;border:none;border-radius:10px;cursor:${(isFirebase && !isFBLoggedIn) || (isGAS && !isGASConfigured) ? 'not-allowed' : 'pointer'};font-weight:600;" ${(isFirebase && !isFBLoggedIn) || (isGAS && !isGASConfigured) ? 'disabled' : ''}>
                            <div>⬇️ Download dari Cloud</div>
                            <div style="font-size:11px;opacity:0.9;">Ambil data device lain</div>
                        </button>
                    </div>
                    <div style="background:#e6fffa;border:1px solid #81e6d9;border-radius:8px;padding:12px;font-size:12px;color:#234e52;">
                        <strong>💡 Cara Sync:</strong><br>
                        1. <strong>Device 1</strong>: Input transaksi → Klik <strong>Upload ke Cloud</strong><br>
                        2. <strong>Device 2</strong>: Klik <strong>🔍 Cek Update</strong> → Download data baru
                    </div>
                </div>
                
                <div style="background:white;padding:20px;border-radius:12px;margin-bottom:20px;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
                    <div style="font-size:16px;font-weight:600;margin-bottom:16px;color:#2d3748;">📁 Backup File Lokal (JSON)</div>
                    <button onclick="backupModule.downloadJSON()" style="width:100%;padding:14px;background:#4a5568;color:white;border:none;border-radius:10px;cursor:pointer;font-weight:600;margin-bottom:12px;">⬇️ Download JSON</button>
                    <label style="display:block;padding:24px;border:2px dashed #cbd5e0;border-radius:10px;text-align:center;cursor:pointer;" onmouseover="this.style.borderColor='#667eea'" onmouseout="this.style.borderColor='#cbd5e0'">
                        <input type="file" accept=".json" onchange="backupModule.importJSON(this)" style="display:none;">
                        <div style="font-size:40px;">📤</div>
                        <div style="font-weight:600;">Import JSON</div>
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
        setTimeout(() => this.updateSyncIndicator(), 100);
    },

    renderFirebaseSection(isConfigured, isLoggedIn) {
        if (!isConfigured) {
            return `
                <div style="background:white;padding:20px;border-radius:12px;margin-bottom:20px;box-shadow:0 2px 8px rgba(0,0,0,0.05);border:2px solid #ff6b35;">
                    <div style="font-size:16px;font-weight:600;margin-bottom:16px;">🔥 Konfigurasi Firebase</div>
                    <div style="display:grid;gap:12px;margin-bottom:16px;">
                        <input type="text" id="fb_apiKey" placeholder="API Key *" style="padding:12px;border:1px solid #e2e8f0;border-radius:8px;">
                        <input type="text" id="fb_authDomain" placeholder="Auth Domain *" style="padding:12px;border:1px solid #e2e8f0;border-radius:8px;">
                        <input type="text" id="fb_databaseURL" placeholder="Database URL *" style="padding:12px;border:1px solid #e2e8f0;border-radius:8px;">
                        <input type="text" id="fb_projectId" placeholder="Project ID" style="padding:12px;border:1px solid #e2e8f0;border-radius:8px;">
                    </div>
                    <button onclick="backupModule.saveFirebaseConfig()" style="width:100%;padding:14px;background:#ff6b35;color:white;border:none;border-radius:10px;cursor:pointer;font-weight:600;">💾 Simpan & Connect</button>
                </div>
            `;
        }
        if (!isLoggedIn) {
            return `
                <div style="background:white;padding:20px;border-radius:12px;margin-bottom:20px;box-shadow:0 2px 8px rgba(0,0,0,0.05);border:2px solid #ff6b35;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                        <div style="font-size:16px;font-weight:600;">🔥 Login Firebase</div>
                        <button onclick="backupModule.clearFirebaseConfig()" style="padding:8px 16px;background:#fc8181;color:white;border:none;border-radius:6px;cursor:pointer;font-size:12px;">🗑️ Hapus Config</button>
                    </div>
                    <div style="display:grid;gap:12px;margin-bottom:16px;">
                        <input type="email" id="fb_email" placeholder="Email" style="padding:12px;border:1px solid #e2e8f0;border-radius:8px;">
                        <input type="password" id="fb_password" placeholder="Password" style="padding:12px;border:1px solid #e2e8f0;border-radius:8px;">
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
                        <div style="font-weight:600;">🔥 Firebase Connected</div>
                        <div style="font-size:13px;color:#38a169;">✅ ${this.currentUser?.email}</div>
                    </div>
                    <div style="display:flex;gap:8px;">
                        <button onclick="backupModule.firebaseLogout()" style="padding:8px 16px;background:#ed8936;color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px;">🚪 Logout</button>
                        <button onclick="backupModule.clearFirebaseConfig()" style="padding:8px 16px;background:#fc8181;color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px;">🗑️ Hapus Config</button>
                    </div>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;padding:16px;background:#f7fafc;border-radius:10px;">
                    <div>
                        <div style="font-weight:600;">Auto-sync</div>
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
                    <div style="font-size:16px;font-weight:600;">📊 Google Sheets Setup</div>
                    ${isConfigured ? `<button onclick="backupModule.clearGASConfig()" style="padding:8px 16px;background:#fc8181;color:white;border:none;border-radius:6px;cursor:pointer;font-size:12px;">🗑️ Hapus Config</button>` : ''}
                </div>
                <div style="margin-bottom:12px;">
                    <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px;">🔗 GAS Web App URL</label>
                    <input type="text" id="gasUrlInput" value="${this.gasUrl}" placeholder="https://script.google.com/macros/s/.../exec" style="width:100%;padding:12px;border:1px solid ${hasUrl ? '#48bb78' : '#e2e8f0'};border-radius:8px;">
                </div>
                <div style="margin-bottom:16px;">
                    <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px;">📄 Google Sheet ID <span style="color:#e53e3e;">*WAJIB*</span></label>
                    <div style="display:flex;gap:8px;">
                        <input type="text" id="sheetIdInput" value="${this.sheetId || ''}" placeholder="44 karakter dari URL spreadsheet" style="flex:1;padding:12px;border:2px solid ${hasSheetId ? '#48bb78' : '#fc8181'};border-radius:8px;font-family:monospace;">
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
                        <div style="font-weight:600;">✅ Ready</div>
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
    // FIREBASE METHODS
    // ============================================
    
    initFirebase(attemptAutoLogin = false) {
        if (typeof firebase === 'undefined') return;
        if (!this.firebaseConfig.apiKey) return;
        
        try {
            if (firebase.apps && firebase.apps.length) firebase.apps.forEach(app => app.delete());
            
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
                    setTimeout(() => {
                        this.loadConfigFromCloud().then(() => {
                            this.checkCloudDataOnLoad(true);
                        });
                    }, 2000);
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
            this.auth.signInWithEmailAndPassword(savedEmail, savedPass).catch(() => {
                localStorage.removeItem(this.KEYS.FB_AUTH_EMAIL);
                localStorage.removeItem(this.KEYS.FB_AUTH_PASSWORD);
            });
        }
    },

    firebaseLogin(email, password) {
        if (!this.auth) return Promise.reject('Not ready');
        return this.auth.signInWithEmailAndPassword(email, password).then((cred) => {
            this.currentUser = cred.user;
            localStorage.setItem(this.KEYS.FB_AUTH_EMAIL, email);
            localStorage.setItem(this.KEYS.FB_AUTH_PASSWORD, password);
            this.showToast('✅ Login berhasil!');
            setTimeout(() => this.syncConfigToCloud(), 3000);
            setTimeout(() => {
                this.loadConfigFromCloud().then(() => {
                    this.checkCloudDataOnLoad(true);
                });
            }, 2000);
            this.render();
            return cred.user;
        }).catch((err) => {
            this.showToast('❌ ' + err.message);
            throw err;
        });
    },

    firebaseRegister(email, password) {
        if (!this.auth) return Promise.reject('Not ready');
        return this.auth.createUserWithEmailAndPassword(email, password).then((cred) => {
            this.currentUser = cred.user;
            localStorage.setItem(this.KEYS.FB_AUTH_EMAIL, email);
            localStorage.setItem(this.KEYS.FB_AUTH_PASSWORD, password);
            this.showToast('✅ Daftar berhasil!');
            setTimeout(() => this.syncConfigToCloud(), 3000);
            this.uploadToFirebase(this.getBackupData(), true);
            this.render();
            return cred.user;
        }).catch((err) => {
            this.showToast('❌ ' + err.message);
            throw err;
        });
    },

    firebaseLogout() {
        if (this.auth) {
            this.auth.signOut().then(() => {
                this.currentUser = null;
                this.showToast('✅ Logout berhasil');
                this.render();
            });
        }
    },

    clearFirebaseConfig() {
        this.firebaseConfig = {};
        localStorage.removeItem(this.KEYS.FIREBASE_CONFIG);
        localStorage.removeItem(this.KEYS.FB_USER);
        localStorage.removeItem(this.KEYS.FB_AUTH_EMAIL);
        localStorage.removeItem(this.KEYS.FB_AUTH_PASSWORD);
        this.showToast('✅ Config Firebase dihapus');
        this.render();
    },

    // ============================================
    // FIXED: uploadToFirebase dengan cleanUndefined
    // ============================================

    async uploadToFirebase(data, silent = false) {
        if (!this.database || !this.currentUser) throw new Error('Not authenticated');
        
        // Bersihkan data dari undefined sebelum upload
        const cleanData = this.cleanUndefined({
            ...data,
            _syncMeta: {
                lastModified: new Date().toISOString(),
                deviceId: this.deviceId,
                deviceName: this.deviceName,
                hash: this.generateDataHash(data),
                version: '4.0.2'
            }
        });
        
        await this.database.ref('users/' + this.currentUser.uid + '/hifzi_data').set(cleanData);
        
        if (!silent) {
            this.lastSyncTime = new Date().toISOString();
            localStorage.setItem(this.KEYS.LAST_SYNC, this.lastSyncTime);
            this.saveBackupSettings();
        }
    },

    async downloadFromFirebase(silent = false) {
        if (!this.database || !this.currentUser) throw new Error('Not authenticated');
        
        const snapshot = await this.database.ref('users/' + this.currentUser.uid + '/hifzi_data').once('value');
        const data = snapshot.val();
        
        if (!data) throw new Error('No data in Firebase');
        
        const { _syncMeta, ...cleanData } = data;
        this.saveBackupData(cleanData);
        
        if (!silent) {
            this.lastSyncTime = new Date().toISOString();
            localStorage.setItem(this.KEYS.LAST_SYNC, this.lastSyncTime);
            this.saveBackupSettings();
            this.showToast('✅ Download berhasil!');
            setTimeout(() => location.reload(), 1500);
        }
        
        return cleanData;
    },

    // ============================================
    // GOOGLE SHEETS METHODS
    // ============================================
    
    validateSheetId(sheetId) {
        if (!sheetId) return { valid: false, message: 'Sheet ID kosong', cleaned: '' };
        const cleaned = sheetId.trim();
        if (cleaned.length === 0) return { valid: false, message: 'Sheet ID kosong', cleaned: '' };
        if (cleaned.length !== 44) return { valid: false, message: `Panjang harus 44 karakter (saat ini: ${cleaned.length})`, cleaned };
        if (!/^[a-zA-Z0-9_-]+$/.test(cleaned)) return { valid: false, message: 'Hanya boleh huruf, angka, underscore, dan dash', cleaned };
        return { valid: true, message: 'Valid', cleaned };
    },

    cleanSheetId(sheetId) {
        if (!sheetId) return '';
        return sheetId.trim().replace(/['"]/g, '');
    },

    async testGASConnection() {
        if (!this.gasUrl) {
            this.showToast('❌ URL GAS belum diisi');
            return;
        }
        
        const sheetId = document.getElementById('sheetIdInput')?.value?.trim();
        const validation = this.validateSheetId(sheetId);
        
        if (!validation.valid) {
            this.showToast('❌ ' + validation.message);
            return;
        }
        
        this.showToast('🧪 Testing connection...');
        
        try {
            const payload = {
                action: 'test',
                sheetId: validation.cleaned,
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
            
            const result = await response.json();
            
            if (result.success) {
                this.showToast('✅ ' + result.message);
                this.sheetId = validation.cleaned;
                localStorage.setItem(this.KEYS.SHEET_ID, this.sheetId);
                this._gasConfigValid = true;
                this.saveBackupSettings();
                this.render();
            } else {
                this.showToast('❌ ' + (result.message || 'Test failed'));
            }
        } catch (err) {
            this.showToast('❌ Error: ' + err.message);
        }
    },

    async uploadToGAS(data, silent = false) {
        if (!this.gasUrl || !this._gasConfigValid) throw new Error('GAS not configured');
        
        const payload = {
            action: 'upload',
            sheetId: this.cleanSheetId(this.sheetId),
            deviceId: this.deviceId,
            data: data,
            timestamp: new Date().toISOString()
        };

        const response = await fetch(this.gasUrl, {
            method: 'POST',
            mode: 'cors',
            cache: 'no-cache',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        
        if (!result.success) throw new Error(result.message || 'Upload failed');
        
        if (!silent) {
            this.lastSyncTime = new Date().toISOString();
            localStorage.setItem(this.KEYS.LAST_SYNC, this.lastSyncTime);
            this.saveBackupSettings();
        }
        
        return result;
    },

    async downloadFromGAS(silent = false, previewOnly = false) {
        if (!this.gasUrl || !this._gasConfigValid) throw new Error('GAS not configured');
        
        const payload = {
            action: 'download',
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
        
        const result = await response.json();
        
        if (!result.success) throw new Error(result.message || 'Download failed');
        
        if (!previewOnly && result.data) {
            this.saveBackupData(result.data);
            this.lastSyncTime = new Date().toISOString();
            localStorage.setItem(this.KEYS.LAST_SYNC, this.lastSyncTime);
            this.saveBackupSettings();
            this.showToast('✅ Download berhasil!');
            setTimeout(() => location.reload(), 1500);
        }
        
        return result;
    },

    async manualDownload() {
        if (this.currentProvider === 'firebase') {
            if (!this.currentUser) {
                this.showToast('❌ Belum login Firebase');
                return;
            }
            this.showToast('⬇️ Downloading...');
            try {
                await this.downloadFromFirebase();
            } catch (err) {
                this.showToast('❌ ' + err.message);
            }
        } else if (this.currentProvider === 'googlesheet') {
            if (!this._gasConfigValid) {
                this.showToast('❌ GAS belum dikonfigurasi');
                return;
            }
            this.showToast('⬇️ Downloading...');
            try {
                await this.downloadFromGAS();
            } catch (err) {
                this.showToast('❌ ' + err.message);
            }
        }
    },

    async checkNewDeviceGAS() {
        try {
            const payload = {
                action: 'checkNewDevice',
                sheetId: this.cleanSheetId(this.sheetId),
                deviceId: this.deviceId,
                deviceName: this.deviceName,
                timestamp: new Date().toISOString()
            };

            await fetch(this.gasUrl, {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload)
            });
        } catch (err) {
            console.log('[Backup] checkNewDevice error:', err);
        }
    },

    // ============================================
    // UTILITY METHODS
    // ============================================
    
    setProvider(provider) {
        this.currentProvider = provider;
        localStorage.setItem(this.KEYS.PROVIDER, provider);
        this.saveBackupSettings();
        
        if (provider === 'firebase') {
            this.initFirebase(true);
        } else if (provider === 'googlesheet') {
            if (this._gasConfigValid) {
                this.checkNewDeviceGAS();
                setTimeout(() => this.checkCloudDataOnLoad(true), 1000);
            }
        }
        
        this.render();
    },

    toggleAutoSync() {
        this.isAutoSyncEnabled = !this.isAutoSyncEnabled;
        localStorage.setItem(this.KEYS.AUTO_SYNC, this.isAutoSyncEnabled);
        
        if (this.isAutoSyncEnabled) {
            this.startAutoSync();
            this.showToast('✅ Auto-sync diaktifkan');
        } else {
            this.stopAutoSync();
            this.showToast('⏸️ Auto-sync dimatikan');
        }
        
        this.syncConfigToCloud();
        this.render();
    },

    startAutoSync() {
        if (this.autoSyncInterval) clearInterval(this.autoSyncInterval);
        
        this.autoSyncInterval = setInterval(() => {
            if (this.isOnline && !this.isSyncing) {
                this.checkAndSync();
            }
        }, 30000);
        
        console.log('[Backup] Auto-sync started (30s interval)');
    },

    stopAutoSync() {
        if (this.autoSyncInterval) {
            clearInterval(this.autoSyncInterval);
            this.autoSyncInterval = null;
        }
        console.log('[Backup] Auto-sync stopped');
    },

    setupNetworkListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.updateSyncStatus(this.SYNC_STATUS.IDLE);
            console.log('[Backup] Online');
            if (this.isAutoSyncEnabled) {
                setTimeout(() => this.checkCloudDataOnLoad(true), 2000);
            }
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.updateSyncStatus(this.SYNC_STATUS.OFFLINE);
            console.log('[Backup] Offline');
        });
    },

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

    loadBackupSettings() {
        const saved = localStorage.getItem(this.KEYS.BACKUP_SETTINGS);
        if (saved) {
            try {
                const settings = JSON.parse(saved);
                this.currentProvider = settings.currentProvider || 'local';
                this.gasUrl = settings.gasUrl || '';
                this.sheetId = settings.sheetId || '';
                this.isAutoSyncEnabled = settings.isAutoSyncEnabled || false;
                this.isAutoSaveLocalEnabled = settings.isAutoSaveLocalEnabled !== false;
                this.lastSyncTime = settings.lastSyncTime || null;
                this.firebaseConfig = settings.firebaseConfig || {};
            } catch (e) {
                console.error('Error loading backup settings:', e);
            }
        } else {
            this.currentProvider = localStorage.getItem(this.KEYS.PROVIDER) || 'local';
            this.gasUrl = localStorage.getItem(this.KEYS.GAS_URL) || '';
            this.sheetId = localStorage.getItem(this.KEYS.SHEET_ID) || '';
            this.isAutoSyncEnabled = localStorage.getItem(this.KEYS.AUTO_SYNC) === 'true';
            this.firebaseConfig = JSON.parse(localStorage.getItem(this.KEYS.FIREBASE_CONFIG) || '{}');
        }
    },

    saveBackupSettings() {
        const settings = {
            currentProvider: this.currentProvider,
            gasUrl: this.gasUrl,
            sheetId: this.sheetId,
            isAutoSyncEnabled: this.isAutoSyncEnabled,
            isAutoSaveLocalEnabled: this.isAutoSaveLocalEnabled,
            lastSyncTime: this.lastSyncTime,
            firebaseConfig: this.firebaseConfig
        };
        localStorage.setItem(this.KEYS.BACKUP_SETTINGS, JSON.stringify(settings));
    },

    reloadAllConfig() {
        this.loadBackupSettings();
        this._gasConfigValid = this.gasUrl && this.sheetId && this.sheetId.length === 44;
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
        this.syncConfigToCloud();
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
        this.syncConfigToCloud();
        this.showToast(this.sheetId ? '✅ Konfigurasi disimpan!' : '✅ Disimpan (tapi Sheet ID invalid)');
        
        if (this.currentProvider === 'googlesheet' && this._gasConfigValid) {
            setTimeout(() => this.checkCloudDataOnLoad(true), 2000);
        }
        this.render();
    },

    clearGASConfig() {
        this.gasUrl = '';
        this.sheetId = '';
        localStorage.removeItem(this.KEYS.GAS_URL);
        localStorage.removeItem(this.KEYS.SHEET_ID);
        this._gasConfigValid = false;
        this.saveBackupSettings();
        this.showToast('✅ Config GAS dihapus');
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

console.log('[Backup] v4.0.2 loaded - Firebase Undefined Fix Ready');

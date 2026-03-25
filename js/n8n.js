// ============================================
// N8N DATA MANAGEMENT MODULE - TELEGRAM BRIDGE
// VERSI CROSS-BROWSER - GOOGLE SHEETS CONFIG SYNC
// VERSION: 4.3.6 - FULL INTEGRATION WITH BACKUP MODULE
// TOTAL LINES: 2200+
// ============================================

const n8nModule = (function() {
    'use strict';

    // ============================================
    // KONFIGURASI & STATE
    // ============================================
    
    const CONFIG_KEYS = {
        BOT_TOKEN: 'n8n_bot_token',
        CHAT_ID: 'n8n_chat_id',
        SHEET_ID: 'n8n_sheet_id',
        SHEET_NAME: 'n8n_sheet_name',
        GAS_URL: 'n8n_gas_url',
        CONFIG: 'n8n_config',
        LOCAL_CONFIG: 'n8n_local_cache',
        LAST_SYNC: 'n8n_last_sync',
        USER_ROLE: 'n8n_user_role',
        // Backup module integration keys
        BACKUP_N8N_CONFIG: 'hifzi_n8n_config',
        BACKUP_TELEGRAM_CONFIG: 'hifzi_telegram_config'
    };

    const DEFAULT_CONFIG_SHEET = 'N8N_Config';
    const DEFAULT_DATA_SHEET = 'Data Base Hifzi Cell';
    
    const state = {
        data: [],
        filteredData: [],
        selectedItem: null,
        config: {
            botToken: '',
            chatId: '',
            sheetId: '',
            sheetName: DEFAULT_DATA_SHEET,
            gasUrl: '',
            configSheetId: '',
            configGasUrl: ''
        },
        isLoading: false,
        currentProxyIndex: 0,
        userRole: 'kasir',
        isConfigLoading: false,
        lastError: null,
        connectionStatus: {
            telegram: 'disconnected',
            gas: 'disconnected',
            lastCheck: null
        }
    };

    const PROXY_LIST = [
        'https://api.allorigins.win/raw?url=',
        'https://api.codetabs.com/v1/proxy?quest=',
        'https://corsproxy.io/?',
        'https://api.codetabs.com/v1/proxy?quest=',
        'https://thingproxy.freeboard.io/fetch/'
    ];

    // ============================================
    // BACKUP MODULE INTEGRATION
    // ============================================

    /**
     * Sinkronisasi config dengan backupModule
     * Memastikan config tersedia di dataManager untuk backup ke cloud
     */
    function syncWithBackupModule() {
        console.log('[n8nModule] Syncing with backupModule...');
        
        // Cek apakah backupModule tersedia
        if (typeof backupModule !== 'undefined') {
            // Update backupModule config
            backupModule.config.n8n = {
                botToken: state.config.botToken,
                chatId: state.config.chatId,
                sheetId: state.config.sheetId,
                sheetName: state.config.sheetName,
                gasUrl: state.config.gasUrl,
                configSheetId: state.config.configSheetId,
                configGasUrl: state.config.configGasUrl,
                updatedAt: new Date().toISOString()
            };
            
            // Trigger sync ke dataManager
            if (typeof backupModule.syncConfigToDataManager === 'function') {
                backupModule.syncConfigToDataManager();
            }
            
            // Trigger save jika tersedia
            if (typeof dataManager !== 'undefined' && typeof dataManager.save === 'function') {
                dataManager.save();
            }
            
            console.log('[n8nModule] Config synced to backupModule');
        } else {
            console.log('[n8nModule] backupModule not available, using localStorage fallback');
        }
        
        // Selalu simpan ke localStorage sebagai fallback
        saveLocalCache();
    }

    /**
     * Load config dari backupModule atau localStorage
     * Priority: backupModule > localStorage > default
     */
    function loadFromBackupModule() {
        console.log('[n8nModule] Loading config from backup sources...');
        
        let configLoaded = false;
        
        // 1. Coba load dari backupModule (jika tersedia)
        if (typeof backupModule !== 'undefined' && backupModule.config && backupModule.config.n8n) {
            const n8nConfig = backupModule.config.n8n;
            if (n8nConfig.botToken || n8nConfig.sheetId) {
                Object.assign(state.config, {
                    botToken: n8nConfig.botToken || state.config.botToken,
                    chatId: n8nConfig.chatId || state.config.chatId,
                    sheetId: n8nConfig.sheetId || state.config.sheetId,
                    sheetName: n8nConfig.sheetName || state.config.sheetName,
                    gasUrl: n8nConfig.gasUrl || state.config.gasUrl,
                    configSheetId: n8nConfig.configSheetId || state.config.configSheetId,
                    configGasUrl: n8nConfig.configGasUrl || state.config.configGasUrl
                });
                console.log('[n8nModule] Config loaded from backupModule');
                configLoaded = true;
            }
        }
        
        // 2. Coba load dari dataManager (jika backupModule tidak punya)
        if (!configLoaded && typeof dataManager !== 'undefined' && dataManager.data) {
            if (dataManager.data.n8nConfig) {
                Object.assign(state.config, {
                    botToken: dataManager.data.n8nConfig.botToken || state.config.botToken,
                    chatId: dataManager.data.n8nConfig.chatId || state.config.chatId,
                    sheetId: dataManager.data.n8nConfig.sheetId || state.config.sheetId,
                    sheetName: dataManager.data.n8nConfig.sheetName || state.config.sheetName,
                    gasUrl: dataManager.data.n8nConfig.gasUrl || state.config.gasUrl,
                    configSheetId: dataManager.data.n8nConfig.configSheetId || state.config.configSheetId,
                    configGasUrl: dataManager.data.n8nConfig.configGasUrl || state.config.configGasUrl
                });
                console.log('[n8nModule] Config loaded from dataManager');
                configLoaded = true;
            }
        }
        
        // 3. Fallback ke localStorage keys
        if (!configLoaded) {
            loadLocalCache();
        }
        
        // 4. Listen untuk perubahan config dari backupModule
        setupBackupModuleListener();
        
        return configLoaded;
    }

    /**
     * Setup listener untuk event dari backupModule
     */
    function setupBackupModuleListener() {
        // Listen untuk event hifzi-config-updated dari backupModule
        window.addEventListener('hifzi-config-updated', (e) => {
            console.log('[n8nModule] Received config update event:', e.detail);
            
            if (e.detail && e.detail.n8n) {
                const n8nConfig = e.detail.n8n;
                
                // Update state jika config berbeda
                const hasChanges = (
                    n8nConfig.botToken !== state.config.botToken ||
                    n8nConfig.chatId !== state.config.chatId ||
                    n8nConfig.sheetId !== state.config.sheetId ||
                    n8nConfig.gasUrl !== state.config.gasUrl
                );
                
                if (hasChanges) {
                    Object.assign(state.config, {
                        botToken: n8nConfig.botToken || state.config.botToken,
                        chatId: n8nConfig.chatId || state.config.chatId,
                        sheetId: n8nConfig.sheetId || state.config.sheetId,
                        sheetName: n8nConfig.sheetName || state.config.sheetName,
                        gasUrl: n8nConfig.gasUrl || state.config.gasUrl,
                        configSheetId: n8nConfig.configSheetId || state.config.configSheetId,
                        configGasUrl: n8nConfig.configGasUrl || state.config.configGasUrl
                    });
                    
                    // Update UI jika sedang terbuka
                    setFormValues();
                    
                    showNotification('🔄 Config diperbarui dari cloud!', 'success', 3000);
                    console.log('[n8nModule] Config updated from broadcast event');
                }
            }
        });
        
        // Listen untuk storage events (cross-tab sync)
        window.addEventListener('storage', (e) => {
            if (e.key === CONFIG_KEYS.BACKUP_N8N_CONFIG || e.key === 'hifzi_n8n_config') {
                console.log('[n8nModule] Detected n8n config change in localStorage');
                loadFromBackupModule();
                setFormValues();
            }
        });
    }

    // ============================================
    // ROLE MANAGEMENT
    // ============================================

    function detectUserRole() {
        // Cek localStorage dulu
        const savedRole = localStorage.getItem(CONFIG_KEYS.USER_ROLE);
        if (savedRole) {
            state.userRole = savedRole;
            return savedRole;
        }

        // Cek dari data user global
        const userData = localStorage.getItem('hifzi_user_data');
        if (userData) {
            try {
                const parsed = JSON.parse(userData);
                if (parsed.role) {
                    state.userRole = parsed.role.toLowerCase();
                    localStorage.setItem(CONFIG_KEYS.USER_ROLE, state.userRole);
                    return state.userRole;
                }
            } catch (e) {
                console.error('[n8nModule] Error parsing user data:', e);
            }
        }

        // Cek dari global currentUser
        if (typeof currentUser !== 'undefined' && currentUser && currentUser.role) {
            state.userRole = currentUser.role.toLowerCase();
            localStorage.setItem(CONFIG_KEYS.USER_ROLE, state.userRole);
            return state.userRole;
        }

        // Cek dari dataManager
        if (typeof dataManager !== 'undefined' && dataManager.data && dataManager.data.currentUser) {
            const dmUser = dataManager.data.currentUser;
            if (dmUser.role) {
                state.userRole = dmUser.role.toLowerCase();
                localStorage.setItem(CONFIG_KEYS.USER_ROLE, state.userRole);
                return state.userRole;
            }
        }

        // Default ke kasir
        state.userRole = 'kasir';
        return 'kasir';
    }

    function isOwner() { 
        return state.userRole === 'owner'; 
    }
    
    function isAdmin() { 
        return state.userRole === 'admin' || state.userRole === 'owner'; 
    }
    
    function isKasir() {
        return state.userRole === 'kasir';
    }

    // ============================================
    // CENTRALIZED CONFIG SYSTEM (CROSS-BROWSER)
    // ============================================

    /**
     * Fetch config dari Google Sheets (Central Storage)
     */
    async function fetchConfigFromCloud() {
        const { configGasUrl, configSheetId } = state.config;
        
        if (!configGasUrl || !configSheetId) {
            console.log('[n8nModule] Config GAS/Sheet belum diatur, menggunakan local');
            return null;
        }

        try {
            const url = new URL(configGasUrl);
            url.searchParams.append('action', 'getConfig');
            url.searchParams.append('sheetId', configSheetId);
            url.searchParams.append('t', Date.now()); // Cache buster

            const response = await fetchWithProxy(url.toString());
            const data = await response.json();

            if (data.success && data.config) {
                console.log('[n8nModule] Config fetched from cloud:', data.config);
                return data.config;
            }
            return null;
        } catch (error) {
            console.error('[n8nModule] Fetch config from cloud error:', error);
            state.lastError = error;
            return null;
        }
    }

    /**
     * Save config ke Google Sheets (hanya Owner)
     */
    async function saveConfigToCloud(configData) {
        if (!isOwner()) {
            showNotification('⚠️ Hanya Owner yang bisa mengubah konfigurasi!', 'warning');
            return false;
        }

        const { configGasUrl, configSheetId } = state.config;
        
        if (!configGasUrl || !configSheetId) {
            showNotification('⚠️ Config GAS URL dan Sheet ID harus diatur dulu!', 'warning');
            return false;
        }

        try {
            const url = new URL(configGasUrl);
            url.searchParams.append('action', 'saveConfig');
            url.searchParams.append('sheetId', configSheetId);
            url.searchParams.append('botToken', configData.botToken || '');
            url.searchParams.append('chatId', configData.chatId || '');
            url.searchParams.append('sheetId_data', configData.sheetId || '');
            url.searchParams.append('sheetName', configData.sheetName || DEFAULT_DATA_SHEET);
            url.searchParams.append('gasUrl_data', configData.gasUrl || '');
            url.searchParams.append('configSheetId', configData.configSheetId || '');
            url.searchParams.append('configGasUrl', configData.configGasUrl || '');
            url.searchParams.append('updatedBy', state.userRole);
            url.searchParams.append('updatedAt', new Date().toISOString());

            const response = await fetchWithProxy(url.toString());
            const data = await response.json();

            if (data.success) {
                console.log('[n8nModule] Config saved to cloud');
                // Update local cache
                saveLocalCache();
                // Sync dengan backupModule
                syncWithBackupModule();
                showNotification('✅ Konfigurasi tersimpan ke Cloud! Semua device akan tersinkron.', 'success');
                return true;
            } else {
                throw new Error(data.error || 'Gagal menyimpan');
            }
        } catch (error) {
            console.error('[n8nModule] Save config to cloud error:', error);
            state.lastError = error;
            showNotification('❌ Gagal simpan ke Cloud: ' + error.message, 'error');
            return false;
        }
    }

    /**
     * Load config dengan priority: Cloud > BackupModule > Local Cache
     */
    async function loadConfigWithSync() {
        // 1. Load dari backupModule/local dulu untuk display cepat
        loadFromBackupModule();

        // 2. Jika Config GAS sudah diatur, fetch dari cloud
        if (state.config.configGasUrl && state.config.configSheetId) {
            state.isConfigLoading = true;
            showNotification('🔄 Sinkronisasi konfigurasi dari Cloud...', 'info', 2000);
            
            const cloudConfig = await fetchConfigFromCloud();
            
            if (cloudConfig) {
                // Merge cloud config ke state
                Object.assign(state.config, {
                    botToken: cloudConfig.botToken || state.config.botToken,
                    chatId: cloudConfig.chatId || state.config.chatId,
                    sheetId: cloudConfig.sheetId_data || cloudConfig.sheetId || state.config.sheetId,
                    sheetName: cloudConfig.sheetName || state.config.sheetName,
                    gasUrl: cloudConfig.gasUrl_data || cloudConfig.gasUrl || state.config.gasUrl,
                    configSheetId: cloudConfig.configSheetId || state.config.configSheetId,
                    configGasUrl: cloudConfig.configGasUrl || state.config.configGasUrl
                });
                
                // Update local cache dan backupModule
                saveLocalCache();
                syncWithBackupModule();
                
                const syncTime = new Date().toLocaleTimeString('id-ID');
                showNotification(`✅ Config tersinkron! (Update: ${syncTime})`, 'success', 3000);
            } else {
                showNotification('⚠️ Menggunakan config lokal (tidak terhubung ke Cloud)', 'warning', 3000);
            }
            
            state.isConfigLoading = false;
        }
    }

    /**
     * Auto-sync config dari cloud (untuk kasir/admin)
     */
    async function autoSyncConfig() {
        if (!state.config.configGasUrl || !state.config.configSheetId) {
            return false;
        }

        try {
            const cloudConfig = await fetchConfigFromCloud();
            
            if (cloudConfig) {
                const hasChanges = (
                    cloudConfig.botToken !== state.config.botToken ||
                    cloudConfig.chatId !== state.config.chatId ||
                    cloudConfig.sheetId_data !== state.config.sheetId
                );

                if (hasChanges) {
                    Object.assign(state.config, {
                        botToken: cloudConfig.botToken || state.config.botToken,
                        chatId: cloudConfig.chatId || state.config.chatId,
                        sheetId: cloudConfig.sheetId_data || cloudConfig.sheetId || state.config.sheetId,
                        sheetName: cloudConfig.sheetName || state.config.sheetName,
                        gasUrl: cloudConfig.gasUrl_data || cloudConfig.gasUrl || state.config.gasUrl
                    });
                    
                    saveLocalCache();
                    syncWithBackupModule();
                    setFormValues();
                    
                    showNotification('🔄 Config otomatis diperbarui dari cloud!', 'info', 3000);
                    return true;
                }
            }
        } catch (error) {
            console.error('[n8nModule] Auto-sync error:', error);
        }
        
        return false;
    }

    function saveLocalCache() {
        const cache = {
            ...state.config,
            cachedAt: new Date().toISOString(),
            cachedBy: state.userRole
        };
        
        try {
            localStorage.setItem(CONFIG_KEYS.LOCAL_CONFIG, JSON.stringify(cache));
            localStorage.setItem(CONFIG_KEYS.LAST_SYNC, Date.now().toString());
            
            // Juga simpan ke format backupModule untuk kompatibilitas
            localStorage.setItem(CONFIG_KEYS.BACKUP_N8N_CONFIG, JSON.stringify({
                botToken: state.config.botToken,
                chatId: state.config.chatId,
                sheetId: state.config.sheetId,
                sheetName: state.config.sheetName,
                gasUrl: state.config.gasUrl,
                configSheetId: state.config.configSheetId,
                configGasUrl: state.config.configGasUrl,
                updatedAt: new Date().toISOString()
            }));
            
        } catch (e) {
            console.error('[n8nModule] Error saving local cache:', e);
        }
    }

    function loadLocalCache() {
        // Coba load dari local cache utama
        const cached = localStorage.getItem(CONFIG_KEYS.LOCAL_CONFIG);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                Object.assign(state.config, {
                    botToken: parsed.botToken || '',
                    chatId: parsed.chatId || '',
                    sheetId: parsed.sheetId || '',
                    sheetName: parsed.sheetName || DEFAULT_DATA_SHEET,
                    gasUrl: parsed.gasUrl || '',
                    configSheetId: parsed.configSheetId || '',
                    configGasUrl: parsed.configGasUrl || ''
                });
                console.log('[n8nModule] Local cache loaded');
            } catch (e) {
                console.error('[n8nModule] Error parsing local cache:', e);
            }
        }

        // Fallback ke individual keys
        state.config.botToken = localStorage.getItem(CONFIG_KEYS.BOT_TOKEN) || state.config.botToken || '';
        state.config.chatId = localStorage.getItem(CONFIG_KEYS.CHAT_ID) || state.config.chatId || '';
        state.config.sheetId = localStorage.getItem(CONFIG_KEYS.SHEET_ID) || state.config.sheetId || '';
        state.config.sheetName = localStorage.getItem(CONFIG_KEYS.SHEET_NAME) || state.config.sheetName || DEFAULT_DATA_SHEET;
        state.config.gasUrl = localStorage.getItem(CONFIG_KEYS.GAS_URL) || state.config.gasUrl || '';
        state.config.configSheetId = localStorage.getItem('n8n_config_sheet_id') || state.config.configSheetId || '';
        state.config.configGasUrl = localStorage.getItem('n8n_config_gas_url') || state.config.configGasUrl || '';
    }

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================

    function isFileProtocol() {
        return window.location.protocol === 'file:';
    }

    function getProxyUrl() {
        return PROXY_LIST[state.currentProxyIndex];
    }

    function rotateProxy() {
        state.currentProxyIndex = (state.currentProxyIndex + 1) % PROXY_LIST.length;
        console.log(`[n8nModule] Proxy rotated to index ${state.currentProxyIndex}: ${getProxyUrl()}`);
        showNotification(`🔄 Proxy ${state.currentProxyIndex + 1}/${PROXY_LIST.length}`, 'info');
        return getProxyUrl();
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatNumber(num) {
        if (!num) return '-';
        return String(num).replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
    }

    function validatePhoneNumber(num) {
        if (!num) return false;
        const cleaned = String(num).replace(/\D/g, '');
        return cleaned.length >= 10 && cleaned.length <= 15;
    }

    function showNotification(message, type = 'info', duration = 3000) {
        console.log(`[n8nModule] ${type}: ${message}`);
        
        // Coba gunakan toast library yang tersedia
        if (typeof Toastify !== 'undefined') {
            Toastify({
                text: message,
                duration: duration,
                gravity: 'top',
                position: 'right',
                style: {
                    background: type === 'success' ? '#10b981' : 
                                type === 'error' ? '#ef4444' : 
                                type === 'warning' ? '#f59e0b' : '#667eea',
                    borderRadius: '8px',
                    padding: '12px 20px'
                }
            }).showToast();
            return;
        }
        
        if (typeof app !== 'undefined' && app.showToast) {
            app.showToast(message);
            return;
        }
        
        if (typeof utils !== 'undefined' && utils.showToast) {
            utils.showToast(message, type);
            return;
        }
        
        // Fallback ke custom toast
        let toast = document.getElementById('n8n-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'n8n-toast';
            toast.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 16px 24px;
                border-radius: 12px;
                color: white;
                font-weight: 600;
                z-index: 99999;
                max-width: 400px;
                word-wrap: break-word;
                box-shadow: 0 8px 24px rgba(0,0,0,0.3);
                transition: all 0.3s ease;
                transform: translateX(100%);
                opacity: 0;
            `;
            document.body.appendChild(toast);
        }
        
        const bgColor = type === 'success' ? '#10b981' : 
                       type === 'error' ? '#ef4444' : 
                       type === 'warning' ? '#f59e0b' : '#667eea';
        
        toast.style.background = bgColor;
        toast.textContent = message;
        
        // Animate in
        requestAnimationFrame(() => {
            toast.style.transform = 'translateX(0)';
            toast.style.opacity = '1';
        });
        
        setTimeout(() => {
            toast.style.transform = 'translateX(100%)';
            toast.style.opacity = '0';
        }, duration);
    }

    function copyToClipboard(text) {
        if (!text) {
            showNotification('❌ Tidak ada data untuk dicopy', 'warning');
            return;
        }
        
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(() => {
                showNotification('📋 Nomor dicopy: ' + text, 'success', 2000);
            }).catch(() => {
                fallbackCopy(text);
            });
        } else {
            fallbackCopy(text);
        }
    }

    function fallbackCopy(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        
        try {
            document.execCommand('copy');
            showNotification('📋 Nomor dicopy: ' + text, 'success', 2000);
        } catch (err) {
            showNotification('❌ Gagal copy: ' + err.message, 'error');
        }
        
        document.body.removeChild(textarea);
    }

    function setStatus(badge, text) {
        const badgeEl = document.getElementById('statusBadge');
        const textEl = document.getElementById('statusText');
        const telegramStatus = document.getElementById('telegramStatusText');
        
        if (badgeEl) badgeEl.textContent = badge;
        if (textEl) textEl.textContent = text;
        
        if (telegramStatus) {
            let statusText = text;
            if (badge === '🟢') {
                statusText = '✅ Terhubung';
                state.connectionStatus.telegram = 'connected';
            } else if (badge === '🔴') {
                statusText = '❌ Error';
                state.connectionStatus.telegram = 'error';
            } else if (badge === '🟡') {
                statusText = '⏳ ' + text;
                state.connectionStatus.telegram = 'connecting';
            }
            telegramStatus.textContent = statusText;
        }
        
        state.connectionStatus.lastCheck = new Date().toISOString();
    }

    function updateConnectionStatus(type, status, message) {
        state.connectionStatus[type] = status;
        
        const indicator = document.getElementById(`${type}ConnectionIndicator`);
        if (indicator) {
            const colors = {
                connected: '#10b981',
                error: '#ef4444',
                connecting: '#f59e0b',
                disconnected: '#9ca3af'
            };
            
            indicator.style.background = colors[status] || colors.disconnected;
            indicator.title = message || status;
        }
    }

    // ============================================
    // FETCH WITH CORS PROXY
    // ============================================

    async function fetchWithProxy(url, options = {}, retryCount = 0) {
        const MAX_RETRIES = PROXY_LIST.length;
        const timeout = options.timeout || 30000;

        console.log(`[n8nModule] Fetching: ${url.substring(0, 100)}...`);

        // Coba direct fetch dulu jika bukan file protocol
        if (!isFileProtocol()) {
            try {
                console.log('[n8nModule] Trying direct fetch...');
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);
                
                const response = await fetch(url, { 
                    ...options,
                    signal: controller.signal 
                });
                
                clearTimeout(timeoutId);
                
                console.log('[n8nModule] Direct fetch success:', response.status);
                if (response.ok) return response;
            } catch (e) {
                console.log('[n8nModule] Direct fetch failed:', e.message);
            }
        }

        // Gunakan proxy
        const proxyUrl = getProxyUrl();
        const fullUrl = `${proxyUrl}${encodeURIComponent(url)}`;

        console.log(`[n8nModule] Using proxy index ${state.currentProxyIndex}: ${proxyUrl}`);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            
            const response = await fetch(fullUrl, {
                method: 'GET',
                headers: { 
                    'Accept': 'application/json',
                    'Origin': window.location.origin
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            console.log('[n8nModule] Proxy response status:', response.status);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const proxyData = await response.json();
            console.log('[n8nModule] Proxy raw response:', proxyData);

            // Parse berbagai format response proxy
            let finalData = proxyData;
            
            if (proxyData.contents) {
                try {
                    finalData = JSON.parse(proxyData.contents);
                } catch {
                    finalData = proxyData.contents;
                }
            } else if (proxyData.body) {
                try {
                    finalData = JSON.parse(proxyData.body);
                } catch {
                    finalData = proxyData.body;
                }
            } else if (proxyData.data && typeof proxyData.data === 'string') {
                try {
                    finalData = JSON.parse(proxyData.data);
                } catch {
                    finalData = proxyData.data;
                }
            }

            console.log('[n8nModule] Parsed data:', finalData);

            // Return mock response object
            return {
                ok: true,
                status: 200,
                json: async () => finalData,
                text: async () => typeof finalData === 'string' ? finalData : JSON.stringify(finalData)
            };

        } catch (error) {
            console.error(`[n8nModule] Proxy error (attempt ${retryCount + 1}):`, error);
            
            if (retryCount < MAX_RETRIES - 1) {
                rotateProxy();
                return fetchWithProxy(url, options, retryCount + 1);
            }
            
            throw new Error('Semua proxy gagal. Gunakan Live Server atau upload ke web server.');
        }
    }

    // ============================================
    // TELEGRAM API
    // ============================================

    async function deleteWebhook() {
        const { botToken } = state.config;
        if (!botToken) return false;

        try {
            const url = `https://api.telegram.org/bot${botToken}/deleteWebhook`;
            const response = await fetchWithProxy(url);
            const result = await response.json();
            console.log('[n8nModule] Delete webhook result:', result);
            return result.ok;
        } catch (error) {
            console.error('[n8nModule] Delete webhook error:', error);
            return false;
        }
    }

    async function getTelegramUpdates(limit = 10) {
        const { botToken } = state.config;
        if (!botToken) return null;

        try {
            const url = `https://api.telegram.org/bot${botToken}/getUpdates?limit=${limit}`;
            const response = await fetchWithProxy(url);
            return await response.json();
        } catch (error) {
            console.error('[n8nModule] Get updates error:', error);
            return null;
        }
    }

    async function getBotInfo() {
        const { botToken } = state.config;
        if (!botToken) return null;

        try {
            const url = `https://api.telegram.org/bot${botToken}/getMe`;
            const response = await fetchWithProxy(url);
            return await response.json();
        } catch (error) {
            console.error('[n8nModule] Get bot info error:', error);
            return null;
        }
    }

    async function getChatId() {
        if (!isOwner()) {
            showNotification('ℹ️ Konfigurasi Telegram diatur oleh Owner via Cloud', 'info');
            return;
        }

        const { botToken } = state.config;
        
        if (!botToken) {
            showNotification('⚠️ Isi Bot Token terlebih dahulu!', 'warning');
            return;
        }

        setStatus('🟡', 'Menghapus webhook...');
        await deleteWebhook();
        await new Promise(resolve => setTimeout(resolve, 1000));

        setStatus('🟡', 'Mendeteksi Chat ID...');

        try {
            const result = await getTelegramUpdates();
            
            if (!result) {
                throw new Error('Gagal mengambil updates dari Telegram');
            }

            if (!result.ok) {
                throw new Error(result.description || 'Telegram API error');
            }

            if (result.result.length === 0) {
                showNotification('ℹ️ Kirim pesan ke bot dulu, lalu klik Test lagi', 'info', 5000);
                setStatus('🟡', 'Menunggu pesan dari bot');
                return;
            }

            // Cari chat ID dari berbagai tipe update
            let chatId = null;
            let chatInfo = null;
            
            for (const update of result.result) {
                if (update.message?.chat?.id) {
                    chatId = update.message.chat.id;
                    chatInfo = update.message.chat;
                    break;
                } else if (update.callback_query?.message?.chat?.id) {
                    chatId = update.callback_query.message.chat.id;
                    chatInfo = update.callback_query.message.chat;
                    break;
                } else if (update.edited_message?.chat?.id) {
                    chatId = update.edited_message.chat.id;
                    chatInfo = update.edited_message.chat;
                    break;
                }
            }

            if (chatId) {
                state.config.chatId = String(chatId);
                
                // Update input field
                const chatInput = document.getElementById('chatId');
                if (chatInput) chatInput.value = chatId;
                
                // Auto-save ke cloud jika owner
                await saveConfigToCloud(state.config);
                
                setStatus('🟢', 'Terhubung ke Telegram');
                showNotification(`✅ Chat ID: ${chatId} (${chatInfo?.title || chatInfo?.username || 'Private'})`, 'success');
                
                // Kirim pesan konfirmasi
                await sendTelegramMessage(
                    `✅ *KONEKSI BERHASIL*\n\n` +
                    `Web POS Hifzi Cell terhubung ke Telegram.\n` +
                    `Chat: ${chatInfo?.title || chatInfo?.username || 'Private'}\n` +
                    `Chat ID: ${chatId}\n` +
                    `Role: ${state.userRole.toUpperCase()}\n` +
                    `Waktu: ${new Date().toLocaleString('id-ID')}`
                );
                
                return chatId;
            } else {
                throw new Error('Chat ID tidak ditemukan dalam update');
            }
            
        } catch (error) {
            console.error('[n8nModule] Get Chat ID error:', error);
            showNotification(`❌ ${error.message}`, 'error');
            setStatus('🔴', 'Error: ' + error.message);
        }
    }

    async function sendTelegramMessage(text, options = {}) {
        const { botToken, chatId } = state.config;
        
        if (!botToken || !chatId) {
            console.warn('[n8nModule] Telegram not configured');
            return null;
        }

        try {
            // Escape MarkdownV2 characters
            const escapedText = text
                .replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');

            const params = new URLSearchParams({
                chat_id: chatId,
                text: escapedText,
                parse_mode: 'MarkdownV2',
                ...options
            });

            const url = `https://api.telegram.org/bot${botToken}/sendMessage?${params.toString()}`;
            const response = await fetchWithProxy(url);
            const result = await response.json();

            if (result.ok) {
                console.log('[n8nModule] Telegram message sent');
                return result;
            } else {
                console.error('[n8nModule] Telegram API error:', result.description);
                // Coba kirim tanpa Markdown jika gagal
                if (result.description?.includes('can\'t parse entities')) {
                    return sendPlainMessage(text);
                }
                return null;
            }

        } catch (error) {
            console.error('[n8nModule] Send message error:', error);
            return null;
        }
    }

    async function sendPlainMessage(text) {
        const { botToken, chatId } = state.config;
        if (!botToken || !chatId) return null;

        try {
            const params = new URLSearchParams({
                chat_id: chatId,
                text: text.replace(/[*_]/g, '')
            });

            const url = `https://api.telegram.org/bot${botToken}/sendMessage?${params.toString()}`;
            const response = await fetchWithProxy(url);
            return await response.json();
        } catch (error) {
            console.error('[n8nModule] Send plain message error:', error);
            return null;
        }
    }

    // ============================================
    // GOOGLE APPS SCRIPT API (DATA OPERATIONS)
    // ============================================

    async function makeRequest(action, params = {}) {
        const { gasUrl, sheetId } = state.config;
        
        if (!gasUrl || !sheetId) {
            showNotification('⚠️ Sheet ID dan GAS URL belum dikonfigurasi!', 'warning');
            return null;
        }

        const url = new URL(gasUrl);
        url.searchParams.append('action', action);
        url.searchParams.append('sheetId', sheetId);
        url.searchParams.append('t', Date.now()); // Cache buster
        
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                url.searchParams.append(key, String(value));
            }
        });

        console.log('[n8nModule] API Request:', action, params);

        try {
            setStatus('🟡', 'Loading...');
            state.isLoading = true;
            updateConnectionStatus('gas', 'connecting', 'Menghubungkan ke GAS...');

            const response = await fetchWithProxy(url.toString());
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            console.log('[n8nModule] API Response:', data);

            if (!data.success) {
                throw new Error(data.error || 'Unknown error from server');
            }

            setStatus('🟢', 'Siap');
            updateConnectionStatus('gas', 'connected', 'Terhubung ke GAS');
            return data;
            
        } catch (error) {
            console.error('[n8nModule] API Error:', error);
            setStatus('🔴', 'Error');
            updateConnectionStatus('gas', 'error', error.message);
            state.lastError = error;
            showNotification(`❌ ${error.message}`, 'error', 6000);
            return null;
            
        } finally {
            state.isLoading = false;
        }
    }

    // ============================================
    // CONFIG SAVE/LOAD HANDLERS
    // ============================================

    async function handleSaveConfig() {
        if (!isOwner()) {
            showNotification('⚠️ Hanya Owner yang bisa mengubah konfigurasi!', 'warning');
            return;
        }

        // Read all inputs
        const inputs = {
            botToken: document.getElementById('botToken')?.value.trim() || '',
            chatId: document.getElementById('chatId')?.value.trim() || '',
            sheetId: document.getElementById('sheetId')?.value.trim() || '',
            sheetName: document.getElementById('sheetName')?.value.trim() || DEFAULT_DATA_SHEET,
            gasUrl: document.getElementById('gasUrl')?.value.trim() || '',
            configSheetId: document.getElementById('configSheetId')?.value.trim() || '',
            configGasUrl: document.getElementById('configGasUrl')?.value.trim() || ''
        };

        // Validasi
        if (!inputs.configSheetId || !inputs.configGasUrl) {
            showNotification('⚠️ Config Sheet ID dan Config GAS URL wajib diisi!', 'warning');
            return;
        }

        if (!inputs.sheetId || !inputs.gasUrl) {
            showNotification('⚠️ Data Sheet ID dan Data GAS URL wajib diisi!', 'warning');
            return;
        }

        // Update state
        Object.assign(state.config, inputs);
        
        // Save to local first
        saveLocalCache();
        
        // Sync dengan backupModule
        syncWithBackupModule();

        // Save to cloud
        const saved = await saveConfigToCloud(state.config);
        
        if (saved) {
            setFormValues();
            // Test koneksi otomatis
            setTimeout(() => testConnection(), 1000);
        }
    }

    async function handleSyncConfig() {
        showNotification('🔄 Menyinkronkan konfigurasi dari Cloud...', 'info');
        await loadConfigWithSync();
        setFormValues();
    }

    function setFormValues() {
        const fields = [
            'botToken', 'chatId', 'sheetId', 'sheetName', 
            'gasUrl', 'configSheetId', 'configGasUrl'
        ];
        
        fields.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.value = state.config[id] || '';
                
                // Styling untuk non-owner
                if (!isOwner() && id !== 'configSheetId' && id !== 'configGasUrl') {
                    el.setAttribute('readonly', 'true');
                    el.style.background = '#f3f4f6';
                    el.style.cursor = 'not-allowed';
                    el.title = 'Hanya Owner yang bisa mengubah';
                } else {
                    el.removeAttribute('readonly');
                    el.style.background = 'white';
                    el.style.cursor = 'text';
                    el.title = '';
                }
            }
        });

        updateRoleIndicators();
        updateConfigSummary();
    }

    function updateConfigSummary() {
        const summary = document.getElementById('configSummary');
        if (!summary) return;

        const hasTelegram = state.config.botToken && state.config.chatId;
        const hasDataSheet = state.config.sheetId && state.config.gasUrl;
        const hasConfigSheet = state.config.configSheetId && state.config.configGasUrl;

        summary.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-top: 15px;">
                <div style="background: ${hasTelegram ? '#d1fae5' : '#fee2e2'}; padding: 10px; border-radius: 8px; font-size: 12px;">
                    <div style="font-weight: 600; color: ${hasTelegram ? '#065f46' : '#991b1b'};">
                        ${hasTelegram ? '✅' : '❌'} Telegram Bot
                    </div>
                    <div style="color: ${hasTelegram ? '#065f46' : '#991b1b'}; font-size: 11px;">
                        ${hasTelegram ? 'Terhubung' : 'Belum dikonfigurasi'}
                    </div>
                </div>
                <div style="background: ${hasDataSheet ? '#d1fae5' : '#fee2e2'}; padding: 10px; border-radius: 8px; font-size: 12px;">
                    <div style="font-weight: 600; color: ${hasDataSheet ? '#065f46' : '#991b1b'};">
                        ${hasDataSheet ? '✅' : '❌'} Data Sheet
                    </div>
                    <div style="color: ${hasDataSheet ? '#065f46' : '#991b1b'}; font-size: 11px;">
                        ${hasDataSheet ? state.config.sheetName : 'Belum dikonfigurasi'}
                    </div>
                </div>
                <div style="background: ${hasConfigSheet ? '#d1fae5' : '#fee2e2'}; padding: 10px; border-radius: 8px; font-size: 12px;">
                    <div style="font-weight: 600; color: ${hasConfigSheet ? '#065f46' : '#991b1b'};">
                        ${hasConfigSheet ? '✅' : '❌'} Cloud Config
                    </div>
                    <div style="color: ${hasConfigSheet ? '#065f46' : '#991b1b'}; font-size: 11px;">
                        ${hasConfigSheet ? 'Tersinkron' : 'Belum diatur'}
                    </div>
                </div>
            </div>
        `;
    }

    function updateRoleIndicators() {
        const roleBadge = document.getElementById('roleBadge');
        const configLockIndicator = document.getElementById('configLockIndicator');
        const syncStatus = document.getElementById('syncStatus');
        
        if (roleBadge) {
            const roleText = state.userRole.toUpperCase();
            const roleColor = isOwner() ? '#10b981' : (isAdmin() ? '#f59e0b' : '#6b7280');
            roleBadge.innerHTML = `<span style="background: ${roleColor}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">${roleText}</span>`;
        }

        if (configLockIndicator) {
            if (!isOwner()) {
                configLockIndicator.innerHTML = `
                    <div style="background: #dbeafe; border: 1px solid #3b82f6; border-radius: 8px; padding: 12px; margin-bottom: 15px; color: #1e40af; font-size: 13px;">
                        <div style="display: flex; align-items: center; gap: 8px; font-weight: 600; margin-bottom: 4px;">
                            <span>☁️</span>
                            <span>Mode Sinkronisasi Cloud</span>
                        </div>
                        <div>Konfigurasi diatur oleh Owner. Data otomatis tersinkron dari Google Sheets.</div>
                        <div style="margin-top: 8px; font-size: 11px; opacity: 0.8;">
                            Role Anda: ${state.userRole.toUpperCase()}
                        </div>
                    </div>
                `;
            } else {
                configLockIndicator.innerHTML = `
                    <div style="background: #d1fae5; border: 1px solid #10b981; border-radius: 8px; padding: 12px; margin-bottom: 15px; color: #065f46; font-size: 13px;">
                        <div style="display: flex; align-items: center; gap: 8px; font-weight: 600; margin-bottom: 4px;">
                            <span>🔓</span>
                            <span>Mode Owner - Cloud Sync Aktif</span>
                        </div>
                        <div>Perubahan akan tersimpan ke Google Sheets dan otomatis sync ke semua device.</div>
                    </div>
                `;
            }
        }

        if (syncStatus) {
            const lastSync = localStorage.getItem(CONFIG_KEYS.LAST_SYNC);
            const syncText = lastSync 
                ? `Last sync: ${new Date(parseInt(lastSync)).toLocaleString('id-ID')}`
                : 'Belum pernah sync';
            syncStatus.textContent = syncText;
        }

        // Update button states
        const ownerOnlyButtons = ['btnSaveConfig', 'btnTestTelegram', 'btnTestGAS', 'btnGenerateGAS'];
        ownerOnlyButtons.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) {
                if (!isOwner()) {
                    btn.disabled = true;
                    btn.style.opacity = '0.5';
                    btn.style.cursor = 'not-allowed';
                    btn.title = 'Hanya Owner yang bisa menggunakan fitur ini';
                } else {
                    btn.disabled = false;
                    btn.style.opacity = '1';
                    btn.style.cursor = 'pointer';
                    btn.title = '';
                }
            }
        });
    }

    // ============================================
    // CRUD OPERATIONS
    // ============================================

    async function handleSearch(keyword = null) {
        const keywordInput = document.getElementById('searchInput');
        const searchTerm = keyword || keywordInput?.value.trim() || '';
        
        console.log('[n8nModule] === HANDLE SEARCH ===', { keyword: searchTerm });

        state.selectedItem = null;
        updateButtonStates();

        const tbody = document.getElementById('tableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; padding: 40px;">
                        <div style="font-size: 32px; margin-bottom: 10px;">⏳</div>
                        <div>Mengambil data dari Google Sheets...</div>
                    </td>
                </tr>
            `;
        }

        const result = await makeRequest('getData');
        
        if (!result) {
            console.error('[n8nModule] Get data failed');
            return;
        }

        state.data = result.data || [];
        console.log('[n8nModule] Raw data count:', state.data.length);

        if (searchTerm && searchTerm.length > 0) {
            const keywordLower = searchTerm.toLowerCase();
            state.filteredData = state.data.filter(item => {
                if (!item) return false;
                const nama = String(item.nama || '').toLowerCase();
                const nomor = String(item.nomor || '').toLowerCase();
                return nama.includes(keywordLower) || nomor.includes(keywordLower);
            });
        } else {
            state.filteredData = [...state.data];
        }

        renderTable();
        
        if (state.filteredData.length === 0 && searchTerm) {
            showNotification(`❌ Tidak ada data cocok dengan "${searchTerm}"`, 'warning');
        } else {
            showNotification(`✅ ${state.filteredData.length} data ditemukan${searchTerm ? ` untuk "${searchTerm}"` : ''}`, 'success');
        }
    }

    function handleAdd() {
        const modalTitle = document.getElementById('modalTitle');
        const editId = document.getElementById('editId');
        const inputNama = document.getElementById('inputNama');
        const inputNomor = document.getElementById('inputNomor');

        if (modalTitle) modalTitle.textContent = '➕ Tambah Data Baru';
        if (editId) editId.value = '';
        if (inputNama) {
            inputNama.value = '';
            setTimeout(() => inputNama.focus(), 100);
        }
        if (inputNomor) inputNomor.value = '';

        openModal('dataModal');
    }

    function handleEdit() {
        if (!state.selectedItem) {
            showNotification('⚠️ Pilih data di tabel terlebih dahulu', 'warning');
            return;
        }

        const modalTitle = document.getElementById('modalTitle');
        const editId = document.getElementById('editId');
        const inputNama = document.getElementById('inputNama');
        const inputNomor = document.getElementById('inputNomor');

        if (modalTitle) modalTitle.textContent = '✏️ Edit Data';
        if (editId) editId.value = state.selectedItem.row;
        if (inputNama) {
            inputNama.value = state.selectedItem.nama || '';
            setTimeout(() => inputNama.focus(), 100);
        }
        if (inputNomor) inputNomor.value = state.selectedItem.nomor || '';

        openModal('dataModal');
    }

    function handleDelete() {
        if (!state.selectedItem) {
            showNotification('⚠️ Pilih data di tabel terlebih dahulu', 'warning');
            return;
        }

        const deleteInfo = document.getElementById('deleteInfo');
        if (deleteInfo) {
            deleteInfo.textContent = `${state.selectedItem.nama || 'N/A'} - ${state.selectedItem.nomor || 'N/A'}`;
        }

        openModal('deleteModal');
    }

    async function saveData() {
        const editId = document.getElementById('editId');
        const inputNama = document.getElementById('inputNama');
        const inputNomor = document.getElementById('inputNomor');

        const row = editId?.value;
        const nama = inputNama?.value.trim();
        const nomor = inputNomor?.value.trim();

        if (!nama || !nomor) {
            showNotification('⚠️ Nama dan Nomor wajib diisi!', 'warning');
            if (inputNama && !nama) inputNama.focus();
            return;
        }

        // Validasi nomor telepon
        if (!validatePhoneNumber(nomor)) {
            showNotification('⚠️ Nomor telepon tidak valid (10-15 digit)', 'warning');
            inputNomor?.focus();
            return;
        }

        const action = row ? 'editData' : 'addData';
        const params = { nama, nomor };
        if (row) params.row = row;

        showNotification(`⏳ ${row ? 'Mengupdate' : 'Menyimpan'} data...`, 'info');

        const result = await makeRequest(action, params);
        
        if (result && result.success) {
            closeModal();
            await handleSearch();
            showNotification(result.message || '✅ Data berhasil disimpan', 'success');
            
            // Kirim notifikasi ke Telegram
            if (!row) {
                await sendTelegramMessage(
                    `✅ *DATA BARU*\n\n` +
                    `Nama: ${nama}\n` +
                    `Nomor: ${nomor}\n` +
                    `Ditambahkan oleh: ${state.userRole.toUpperCase()}\n` +
                    `Waktu: ${new Date().toLocaleString('id-ID')}`
                );
            }
        } else if (result) {
            showNotification('❌ ' + (result.error || 'Gagal menyimpan'), 'error');
        }
    }

    async function confirmDelete() {
        if (!state.selectedItem) {
            showNotification('❌ Tidak ada data yang dipilih', 'error');
            return;
        }
        
        const row = state.selectedItem.row;
        const nama = state.selectedItem.nama;
        
        showNotification('⏳ Menghapus data...', 'info');
        
        const result = await makeRequest('deleteData', { row });
        
        if (result && result.success) {
            closeModal();
            state.selectedItem = null;
            updateButtonStates();
            await handleSearch();
            showNotification(result.message || '✅ Data dihapus', 'success');
            
            // Kirim notifikasi ke Telegram
            await sendTelegramMessage(
                `🗑️ *DATA DIHAPUS*\n\n` +
                `Nama: ${nama}\n` +
                `Dihapus oleh: ${state.userRole.toUpperCase()}\n` +
                `Waktu: ${new Date().toLocaleString('id-ID')}`
            );
        } else if (result) {
            showNotification('❌ ' + (result.error || 'Gagal menghapus'), 'error');
        }
    }

    // ============================================
    // UI RENDERING
    // ============================================

    function renderTable() {
        const tbody = document.getElementById('tableBody');
        if (!tbody) return;

        if (state.filteredData.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; padding: 60px 20px; color: #9ca3af;">
                        <div style="font-size: 48px; margin-bottom: 15px;">📭</div>
                        <div>Belum ada data. Klik "Cari Data" untuk memuat.</div>
                    </td>
                </tr>
            `;
            updateButtonStates();
            return;
        }

        let html = '';
        state.filteredData.forEach((item, index) => {
            const isSelected = state.selectedItem && state.selectedItem.row == item.row;
            const nomorDisplay = escapeHtml(item.nomor || '-');
            const namaDisplay = escapeHtml(item.nama || '-');
            
            html += `
                <tr class="n8n-data-row ${isSelected ? 'selected' : ''}" 
                    data-row="${item.row}" 
                    data-index="${index}"
                    style="cursor: pointer; ${isSelected ? 'background: #e0e7ff !important;' : ''} transition: background 0.2s;">
                    <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${index + 1}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: 500;">${namaDisplay}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <span style="font-family: monospace; background: #f3f4f6; padding: 4px 8px; border-radius: 4px; font-size: 13px;">${nomorDisplay}</span>
                            <button onclick="event.stopPropagation(); n8nModule.copyNumber('${escapeHtml(item.nomor || '')}')" 
                                    style="padding: 6px 12px; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 500;">
                                📋 Copy
                            </button>
                        </div>
                    </td>
                    <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
                        <button class="n8n-btn-select" 
                                data-row="${item.row}" 
                                data-index="${index}"
                                style="padding: 8px 16px; border: 2px solid ${isSelected ? '#667eea' : '#d1d5db'}; 
                                       background: ${isSelected ? '#667eea' : 'white'}; 
                                       color: ${isSelected ? 'white' : '#374151'};
                                       border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.2s;">
                            ${isSelected ? '✓ Dipilih' : '☐ Pilih'}
                        </button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;

        // Attach event listeners
        tbody.querySelectorAll('.n8n-data-row').forEach(row => {
            row.addEventListener('click', (e) => {
                if (e.target.closest('.n8n-btn-select') || e.target.closest('button')) return;
                const rowNum = parseInt(row.getAttribute('data-row'));
                const index = parseInt(row.getAttribute('data-index'));
                selectRow(rowNum, index);
            });
        });

        tbody.querySelectorAll('.n8n-btn-select').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const rowNum = parseInt(btn.getAttribute('data-row'));
                const index = parseInt(btn.getAttribute('data-index'));
                selectRow(rowNum, index);
            });
        });

        updateButtonStates();
    }

    function selectRow(rowNum, index) {
        const item = state.filteredData.find(d => d.row == rowNum);
        if (!item) return;

        if (state.selectedItem && state.selectedItem.row == rowNum) {
            state.selectedItem = null;
        } else {
            state.selectedItem = item;
        }

        renderTable();
    }

    function updateButtonStates() {
        const hasSelection = state.selectedItem !== null;
        const btnEdit = document.getElementById('btnEdit');
        const btnDelete = document.getElementById('btnDelete');

        if (btnEdit) {
            btnEdit.disabled = !hasSelection;
            btnEdit.style.opacity = hasSelection ? '1' : '0.5';
            btnEdit.style.cursor = hasSelection ? 'pointer' : 'not-allowed';
            btnEdit.style.background = hasSelection ? '#f59e0b' : '#d1d5db';
        }
        
        if (btnDelete) {
            btnDelete.disabled = !hasSelection;
            btnDelete.style.opacity = hasSelection ? '1' : '0.5';
            btnDelete.style.cursor = hasSelection ? 'pointer' : 'not-allowed';
            btnDelete.style.background = hasSelection ? '#ef4444' : '#d1d5db';
        }
    }

    function openModal(modalId) {
        const overlay = document.getElementById('modalOverlay');
        const modal = document.getElementById(modalId);
        
        if (overlay) {
            overlay.style.display = 'flex';
            overlay.style.opacity = '0';
            setTimeout(() => overlay.style.opacity = '1', 10);
        }
        if (modal) {
            modal.style.display = 'block';
            modal.style.transform = 'scale(0.9)';
            modal.style.opacity = '0';
            setTimeout(() => {
                modal.style.transform = 'scale(1)';
                modal.style.opacity = '1';
            }, 10);
        }
    }

    function closeModal() {
        const overlay = document.getElementById('modalOverlay');
        
        if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.style.display = 'none';
                document.querySelectorAll('#dataModal, #deleteModal').forEach(m => {
                    m.style.display = 'none';
                });
            }, 300);
        }
    }

    // ============================================
    // GAS CODE GENERATOR
    // ============================================

    function generateGAS() {
        if (!isOwner()) {
            showNotification('ℹ️ Hanya Owner yang bisa generate GAS code', 'info');
            return;
        }

        const sheetName = state.config.sheetName || DEFAULT_DATA_SHEET;
        const configSheetName = DEFAULT_CONFIG_SHEET;
        
        const code = `/**
 * GOOGLE APPS SCRIPT - N8N Telegram Bridge + Config Sync
 * Auto-generated: ${new Date().toLocaleString('id-ID')}
 * Data Sheet: ${sheetName}
 * Config Sheet: ${configSheetName}
 * Version: 4.3.6
 */

const SHEET_NAME = '${sheetName}';
const CONFIG_SHEET_NAME = '${configSheetName}';

// ============================================
// HELPER FUNCTIONS
// ============================================

function getOrCreateSheet(ss, sheetName, headers) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (headers && headers.length > 0) {
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length)
        .setFontWeight('bold')
        .setBackground('#4caf50')
        .setFontColor('white');
    }
  }
  return sheet;
}

function createResponse(data) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  
  // CORS headers
  return output;
}

function doOptions(e) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
  
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);
}

// ============================================
// CONFIG MANAGEMENT
// ============================================

function getConfig(ss) {
  const sheet = getOrCreateSheet(ss, CONFIG_SHEET_NAME, ['KEY', 'VALUE', 'UPDATED_AT', 'UPDATED_BY']);
  const data = sheet.getDataRange().getValues();
  const config = {};
  
  for (let i = 1; i < data.length; i++) {
    const key = data[i][0];
    const value = data[i][1];
    if (key) config[key] = value;
  }
  
  return config;
}

function saveConfig(ss, params) {
  const sheet = getOrCreateSheet(ss, CONFIG_SHEET_NAME, ['KEY', 'VALUE', 'UPDATED_AT', 'UPDATED_BY']);
  const data = sheet.getDataRange().getValues();
  
  // Map of key to row index
  const keyMap = {};
  for (let i = 1; i < data.length; i++) {
    keyMap[data[i][0]] = i + 1;
  }
  
  const timestamp = new Date().toISOString();
  const updatedBy = params.updatedBy || 'unknown';
  
  const configs = [
    ['botToken', params.botToken],
    ['chatId', params.chatId],
    ['sheetId_data', params.sheetId_data],
    ['sheetName', params.sheetName],
    ['gasUrl_data', params.gasUrl_data],
    ['configSheetId', params.configSheetId],
    ['configGasUrl', params.configGasUrl],
    ['updatedAt', timestamp],
    ['updatedBy', updatedBy],
    ['version', '4.3.6']
  ];
  
  configs.forEach(([key, value]) => {
    if (keyMap[key]) {
      // Update existing
      const row = keyMap[key];
      sheet.getRange(row, 2).setValue(value || '');
      sheet.getRange(row, 3).setValue(timestamp);
      sheet.getRange(row, 4).setValue(updatedBy);
    } else {
      // Insert new
      sheet.appendRow([key, value || '', timestamp, updatedBy]);
    }
  });
  
  return true;
}

// ============================================
// MAIN DOGET
// ============================================

function doGet(e) {
  const action = e.parameter.action;
  const sheetId = e.parameter.sheetId;
  
  // CORS headers for all responses
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  
  try {
    if (!sheetId) throw new Error('Parameter sheetId diperlukan');
    if (!action) throw new Error('Parameter action diperlukan');

    const ss = SpreadsheetApp.openById(sheetId);
    let result = { success: false };

    switch(action) {
      // ========================================
      // CONFIG ENDPOINTS
      // ========================================
      case 'getConfig':
        const config = getConfig(ss);
        result = { 
          success: true, 
          config: config,
          timestamp: new Date().toISOString()
        };
        break;

      case 'saveConfig':
        const saved = saveConfig(ss, e.parameter);
        result = { 
          success: saved, 
          message: '✅ Konfigurasi berhasil disimpan ke Cloud',
          timestamp: new Date().toISOString()
        };
        break;

      // ========================================
      // DATA ENDPOINTS
      // ========================================
      case 'test':
        const sheets = ss.getSheets().map(s => s.getName());
        result = { 
          success: true, 
          message: '✅ Koneksi berhasil!',
          sheets: sheets,
          targetSheet: SHEET_NAME,
          configSheet: CONFIG_SHEET_NAME,
          timestamp: new Date().toISOString()
        };
        break;

      case 'getData':
        const dataSheet = getOrCreateSheet(ss, SHEET_NAME, ['NAMA', 'NOMOR']);
        const data = dataSheet.getDataRange().getValues();
        const rows = [];
        for (let i = 1; i < data.length; i++) {
          rows.push({
            row: i + 1,
            nama: data[i][0] || '',
            nomor: data[i][1] || ''
          });
        }
        result = { 
          success: true, 
          data: rows,
          count: rows.length,
          timestamp: new Date().toISOString()
        };
        break;

      case 'addData':
        const addSheet = getOrCreateSheet(ss, SHEET_NAME, ['NAMA', 'NOMOR']);
        const namaAdd = e.parameter.nama || '';
        const nomorAdd = e.parameter.nomor || '';
        if (!namaAdd || !nomorAdd) throw new Error('Parameter nama dan nomor diperlukan');
        addSheet.appendRow([namaAdd, nomorAdd]);
        result = { 
          success: true, 
          message: '✅ Data berhasil ditambahkan',
          row: addSheet.getLastRow(),
          timestamp: new Date().toISOString()
        };
        break;

      case 'editData':
        const editSheet = getOrCreateSheet(ss, SHEET_NAME, ['NAMA', 'NOMOR']);
        const rowEdit = parseInt(e.parameter.row);
        const namaEdit = e.parameter.nama || '';
        const nomorEdit = e.parameter.nomor || '';
        if (!rowEdit || isNaN(rowEdit) || rowEdit < 2) throw new Error('Parameter row tidak valid');
        if (!namaEdit || !nomorEdit) throw new Error('Parameter nama dan nomor diperlukan');
        editSheet.getRange(rowEdit, 1).setValue(namaEdit);
        editSheet.getRange(rowEdit, 2).setValue(nomorEdit);
        result = { 
          success: true, 
          message: '✅ Data berhasil diupdate',
          row: rowEdit,
          timestamp: new Date().toISOString()
        };
        break;

      case 'deleteData':
        const delSheet = getOrCreateSheet(ss, SHEET_NAME, ['NAMA', 'NOMOR']);
        const rowDel = parseInt(e.parameter.row);
        if (!rowDel || isNaN(rowDel) || rowDel < 2) throw new Error('Parameter row tidak valid');
        delSheet.deleteRow(rowDel);
        result = { 
          success: true, 
          message: '✅ Data berhasil dihapus',
          row: rowDel,
          timestamp: new Date().toISOString()
        };
        break;

      default:
        result = { 
          success: false, 
          error: 'Action tidak valid: ' + action
        };
    }

    return createResponse(result);

  } catch (error) {
    return createResponse({ 
      success: false, 
      error: error.toString(),
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}`;

        const editor = document.getElementById('gasCodeEditor');
        if (editor) {
            editor.value = code;
            editor.style.fontFamily = 'monospace';
            editor.style.fontSize = '11px';
        }
        
        showNotification('✅ Kode GAS generated! Copy dan deploy ke Google Apps Script.', 'success');
    }

    function copyGASCode() {
        const textarea = document.getElementById('gasCodeEditor');
        if (!textarea?.value.trim()) {
            showNotification('⚠️ Generate kode GAS terlebih dahulu', 'warning');
            return;
        }
        
        copyToClipboard(textarea.value);
        showNotification('✅ Kode GAS dicopy ke clipboard!', 'success');
    }

    // ============================================
    // TEST CONNECTIONS
    // ============================================

    async function testConnection() {
        const result = await makeRequest('test');
        
        if (result?.success) {
            showNotification(`✅ ${result.message}`, 'success');
            
            const statusInfo = document.getElementById('gasStatusInfo');
            if (statusInfo) {
                statusInfo.innerHTML = `
                    <div style="color: #4caf50; font-size: 12px; margin-top: 8px; padding: 10px; background: #f0fdf4; border-radius: 6px;">
                        <div style="font-weight: 600;">✅ Terhubung ke: ${result.targetSheet}</div>
                        <div>📊 Config Sheet: ${result.configSheet || 'N8N_Config'}</div>
                        <div>📚 Available Sheets: ${(result.sheets || []).join(', ')}</div>
                    </div>
                `;
            }
            
            updateConnectionStatus('gas', 'connected', 'GAS terhubung');
        } else {
            updateConnectionStatus('gas', 'error', 'GAS tidak terhubung');
        }
    }

    async function testTelegramConnection() {
        // Test bot info dulu
        const { botToken } = state.config;
        if (!botToken) {
            showNotification('⚠️ Bot Token belum diisi!', 'warning');
            return;
        }

        setStatus('🟡', 'Mengecek koneksi Telegram...');
        
        try {
            const botInfo = await getBotInfo();
            
            if (botInfo && botInfo.ok) {
                showNotification(`✅ Bot aktif: @${botInfo.result.username}`, 'success');
                
                // Lanjutkan ke getChatId
                await getChatId();
            } else {
                throw new Error(botInfo?.description || 'Bot tidak ditemukan');
            }
        } catch (error) {
            setStatus('🔴', 'Telegram Error');
            showNotification(`❌ Telegram: ${error.message}`, 'error');
        }
    }

    // ============================================
    // TOGGLE CONFIG
    // ============================================

    function toggleConfig() {
        const section = document.getElementById('configSection');
        const arrow = document.getElementById('configArrow');
        
        if (!section || !arrow) return;

        if (section.style.display === 'none' || section.style.display === '') {
            section.style.display = 'block';
            arrow.textContent = '▲';
            setTimeout(() => {
                setFormValues();
                updateRoleIndicators();
                updateConfigSummary();
            }, 10);
            
            const editor = document.getElementById('gasCodeEditor');
            if (editor && !editor.value.trim() && isOwner()) {
                generateGAS();
            }
        } else {
            section.style.display = 'none';
            arrow.textContent = '▼';
        }
    }

    // ============================================
    // EVENT LISTENERS
    // ============================================

    function attachEventListeners() {
        // Main action buttons
        document.getElementById('btnSearch')?.addEventListener('click', () => handleSearch());
        document.getElementById('btnExecuteSearch')?.addEventListener('click', () => handleSearch());
        document.getElementById('btnAdd')?.addEventListener('click', handleAdd);
        document.getElementById('btnEdit')?.addEventListener('click', handleEdit);
        document.getElementById('btnDelete')?.addEventListener('click', handleDelete);
        
        // Config buttons
        document.getElementById('btnToggleConfig')?.addEventListener('click', toggleConfig);
        document.getElementById('btnSaveConfig')?.addEventListener('click', handleSaveConfig);
        document.getElementById('btnSyncConfig')?.addEventListener('click', handleSyncConfig);
        document.getElementById('btnTestTelegram')?.addEventListener('click', testTelegramConnection);
        document.getElementById('btnTestGAS')?.addEventListener('click', testConnection);
        document.getElementById('btnGenerateGAS')?.addEventListener('click', generateGAS);
        document.getElementById('btnCopyGAS')?.addEventListener('click', copyGASCode);
        document.getElementById('btnOpenGAS')?.addEventListener('click', () => {
            window.open('https://script.google.com', '_blank');
        });
        
        // Modal buttons
        document.getElementById('btnCloseModal')?.addEventListener('click', closeModal);
        document.getElementById('btnCancel')?.addEventListener('click', closeModal);
        document.getElementById('btnSave')?.addEventListener('click', saveData);
        document.getElementById('btnCancelDelete')?.addEventListener('click', closeModal);
        document.getElementById('btnConfirmDelete')?.addEventListener('click', confirmDelete);
        
        // Search input
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') handleSearch();
            });
            
            // Auto-search dengan debounce
            let debounceTimer;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                if (e.target.value.length >= 3) {
                    debounceTimer = setTimeout(() => handleSearch(e.target.value), 500);
                }
            });
        }

        // Modal overlay click
        const modalOverlay = document.getElementById('modalOverlay');
        if (modalOverlay) {
            modalOverlay.addEventListener('click', (e) => {
                if (e.target.id === 'modalOverlay') closeModal();
            });
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeModal();
            
            // Ctrl/Cmd + Enter untuk save
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                const dataModal = document.getElementById('dataModal');
                if (dataModal?.style.display === 'block') {
                    saveData();
                }
            }
        });
    }

    // ============================================
    // HTML TEMPLATE
    // ============================================

    function getHTML() {
        const isFile = isFileProtocol();
        
        const fileWarning = isFile ? `
            <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 2px solid #f59e0b; border-radius: 12px; padding: 20px; margin-bottom: 20px; color: #92400e;">
                <div style="font-weight: bold; margin-bottom: 10px; font-size: 16px;">⚠️ Mode File Lokal Terdeteksi</div>
                <div style="font-size: 13px; line-height: 1.6;">
                    Beberapa fitur terbatas karena CORS. Solusi:
                    <ol style="margin: 10px 0; padding-left: 20px;">
                        <li>Gunakan <strong>Live Server</strong> di VS Code (recommended)</li>
                        <li>Upload ke <strong>GitHub Pages</strong></li>
                        <li>Gunakan <strong>Python HTTP server</strong>: <code>python -m http.server 8000</code></li>
                    </ol>
                </div>
                <div style="margin-top: 10px;">
                    <button onclick="n8nModule.rotateProxy()" style="background: #f59e0b; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 12px;">
                        🔄 Rotate Proxy (${state.currentProxyIndex + 1}/${PROXY_LIST.length})
                    </button>
                </div>
            </div>
        ` : '';

        return `
            <div class="n8n-container" style="padding: 20px; max-width: 1200px; margin: 0 auto; font-family: system-ui, -apple-system, sans-serif;">
                ${fileWarning}
                
                <!-- HEADER -->
                <div style="margin-bottom: 25px; display: flex; align-items: center; flex-wrap: wrap; gap: 15px; justify-content: space-between;">
                    <div>
                        <h2 style="margin: 0; color: #1f2937; display: inline-flex; align-items: center; gap: 10px; font-size: 24px;">
                            🔍 N8N Data Management
                            <span id="roleBadge"></span>
                        </h2>
                        <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 14px;">
                            Kelola data via Google Sheets dengan Cloud Sync
                        </p>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button onclick="n8nModule.syncConfig()" style="background: #3b82f6; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 500;">
                            🔄 Sync Config
                        </button>
                    </div>
                </div>

                <!-- TELEGRAM STATUS CARD -->
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px; padding: 24px; margin-bottom: 24px; color: white; box-shadow: 0 10px 25px rgba(102, 126, 234, 0.3);">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
                        <div>
                            <div style="font-weight: 700; margin-bottom: 6px; font-size: 16px;">📱 Status Telegram Bot</div>
                            <div id="telegramStatusText" style="font-size: 14px; opacity: 0.95;">
                                ${state.config.botToken ? '⏳ Menunggu koneksi...' : '⚠️ Belum dikonfigurasi'}
                            </div>
                            ${state.config.chatId ? `
                                <div style="font-size: 12px; opacity: 0.8; margin-top: 4px;">
                                    Chat ID: ${state.config.chatId}
                                </div>
                            ` : ''}
                        </div>
                        <div style="display: flex; gap: 10px;">
                            ${isFile ? `
                            <button onclick="n8nModule.rotateProxy()" style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); color: white; padding: 12px 20px; border-radius: 10px; cursor: pointer; font-size: 13px; backdrop-filter: blur(10px);">
                                🔄 Proxy ${state.currentProxyIndex + 1}/${PROXY_LIST.length}
                            </button>
                            ` : ''}
                            <button onclick="n8nModule.testTelegramConnection()" style="background: white; color: #667eea; padding: 12px 24px; border-radius: 10px; border: none; cursor: pointer; font-weight: 600; font-size: 13px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                                📱 Test Koneksi
                            </button>
                        </div>
                    </div>
                </div>

                <!-- QUICK STATS -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 24px;">
                    <div style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); border-left: 4px solid #10b981;">
                        <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Total Data</div>
                        <div style="font-size: 28px; font-weight: 700; color: #10b981; margin-top: 5px;">${state.data.length}</div>
                    </div>
                    <div style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); border-left: 4px solid #3b82f6;">
                        <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Filtered</div>
                        <div style="font-size: 28px; font-weight: 700; color: #3b82f6; margin-top: 5px;">${state.filteredData.length}</div>
                    </div>
                    <div style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); border-left: 4px solid #f59e0b;">
                        <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Role</div>
                        <div style="font-size: 20px; font-weight: 700; color: #f59e0b; margin-top: 8px; text-transform: capitalize;">${state.userRole}</div>
                    </div>
                </div>

                <!-- CRUD BUTTONS -->
                <div style="background: white; border-radius: 16px; padding: 24px; margin-bottom: 24px; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
                    <div style="display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap;">
                        <button id="btnSearch" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 14px 28px; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3); transition: transform 0.2s;">
                            🔍 Cari Data
                        </button>
                        <button id="btnAdd" style="background: #10b981; color: white; border: none; padding: 14px 28px; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3);">
                            ➕ Tambah Data
                        </button>
                        <button id="btnEdit" disabled style="background: #d1d5db; color: white; border: none; padding: 14px 28px; border-radius: 10px; cursor: not-allowed; font-weight: 600; font-size: 14px; opacity: 0.5; transition: all 0.2s;">
                            ✏️ Edit Data
                        </button>
                        <button id="btnDelete" disabled style="background: #d1d5db; color: white; border: none; padding: 14px 28px; border-radius: 10px; cursor: not-allowed; font-weight: 600; font-size: 14px; opacity: 0.5; transition: all 0.2s;">
                            🗑️ Hapus Data
                        </button>
                    </div>

                    <div style="display: flex; gap: 12px;">
                        <input type="text" id="searchInput" placeholder="Ketik minimal 3 huruf untuk mencari (nama/nomor)..." 
                               style="flex: 1; padding: 14px 18px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 15px; transition: border-color 0.2s; outline: none;"
                               onfocus="this.style.borderColor='#667eea'" 
                               onblur="this.style.borderColor='#e5e7eb'">
                        <button id="btnExecuteSearch" style="background: #667eea; color: white; border: none; padding: 14px 24px; border-radius: 10px; cursor: pointer; font-weight: 600;">
                            🔍
                        </button>
                    </div>
                </div>

                <!-- DATA TABLE -->
                <div style="background: white; border-radius: 16px; padding: 24px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); margin-bottom: 24px;">
                    <div style="overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                                    <th style="padding: 16px; text-align: center; width: 60px; font-weight: 600;">No</th>
                                    <th style="padding: 16px; text-align: left; font-weight: 600;">NAMA</th>
                                    <th style="padding: 16px; text-align: left; font-weight: 600;">NOMOR TELEPON</th>
                                    <th style="padding: 16px; text-align: center; width: 120px; font-weight: 600;">AKSI</th>
                                </tr>
                            </thead>
                            <tbody id="tableBody">
                                <tr>
                                    <td colspan="4" style="text-align: center; padding: 80px 20px; color: #9ca3af;">
                                        <div style="font-size: 64px; margin-bottom: 20px;">📭</div>
                                        <div style="font-size: 16px;">Belum ada data yang dimuat</div>
                                        <div style="font-size: 13px; margin-top: 8px;">Klik "Cari Data" untuk memuat dari Google Sheets</div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- CONFIG TOGGLE -->
                <div style="margin-bottom: 20px;">
                    <button id="btnToggleConfig" style="background: #f3f4f6; color: #374151; border: 2px solid #e5e7eb; padding: 16px 24px; border-radius: 12px; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 12px; width: 100%; justify-content: space-between; transition: all 0.2s;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <span style="font-size: 20px;">⚙️</span>
                            <span style="font-size: 16px;">Konfigurasi Telegram & Google Sheets</span>
                            <span style="background: #3b82f6; color: white; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700;">CLOUD SYNC</span>
                        </div>
                        <span id="configArrow" style="font-size: 18px; transition: transform 0.3s;">▼</span>
                    </button>
                </div>

                <!-- CONFIGURATION SECTION -->
                <div id="configSection" style="display: none;">
                    
                    <!-- SYNC STATUS -->
                    <div style="background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); border: 2px solid #3b82f6; border-radius: 12px; padding: 16px; margin-bottom: 20px; color: #1e40af;">
                        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                            <div>
                                <span style="font-weight: 700;">☁️ Cloud Sync Status:</span>
                                <span id="syncStatus" style="margin-left: 8px;">Belum pernah sync</span>
                            </div>
                            <button id="btnSyncConfig" style="background: #3b82f6; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600; box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);">
                                🔄 Sync Sekarang
                            </button>
                        </div>
                    </div>

                    <!-- ROLE LOCK INDICATOR -->
                    <div id="configLockIndicator"></div>

                    <!-- CONFIG SUMMARY -->
                    <div id="configSummary"></div>

                    <!-- STEP 0: CONFIG CLOUD SETUP -->
                    <div style="background: white; border-radius: 16px; padding: 24px; margin-bottom: 20px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); border: 3px solid #f59e0b;">
                        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px;">
                            <span style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px;">0</span>
                            <div>
                                <h3 style="margin: 0; color: #1f2937; font-size: 18px;">☁️ Setup Cloud Config (WAJIB)</h3>
                                <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 13px;">Konfigurasi ini untuk sinkronisasi antar device</p>
                            </div>
                        </div>
                        
                        <div style="margin-bottom: 20px;">
                            <label style="display: block; font-weight: 600; margin-bottom: 8px; font-size: 14px; color: #374151;">
                                Config Sheet ID <span style="color: #ef4444;">*</span>
                                <span style="font-weight: normal; color: #6b7280;"> - Sheet untuk menyimpan konfigurasi</span>
                            </label>
                            <input type="text" id="configSheetId" placeholder="1cPolj_xpBztq6RU3XVi_CZm1j_Kqo-zQC-wsbIYrLXE" 
                                   style="width: 100%; padding: 14px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 14px; transition: border-color 0.2s; outline: none;"
                                   onfocus="this.style.borderColor='#f59e0b'" 
                                   onblur="this.style.borderColor='#e5e7eb'">
                            <div style="font-size: 12px; color: #6b7280; margin-top: 6px;">
                                💡 Bisa pakai Sheet ID yang sama dengan data, atau sheet terpisah khusus config
                            </div>
                        </div>

                        <div style="margin-bottom: 20px;">
                            <label style="display: block; font-weight: 600; margin-bottom: 8px; font-size: 14px; color: #374151;">
                                Config GAS Web App URL <span style="color: #ef4444;">*</span>
                                <span style="font-weight: normal; color: #6b7280;"> - URL GAS yang sudah dideploy</span>
                            </label>
                            <input type="text" id="configGasUrl" placeholder="https://script.google.com/macros/s/XXXX/exec" 
                                   style="width: 100%; padding: 14px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 14px; transition: border-color 0.2s; outline: none;"
                                   onfocus="this.style.borderColor='#f59e0b'" 
                                   onblur="this.style.borderColor='#e5e7eb'">
                        </div>
                    </div>

                    <!-- STEP 1: TELEGRAM -->
                    <div style="background: white; border-radius: 16px; padding: 24px; margin-bottom: 20px; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
                        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px;">
                            <span style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px;">1</span>
                            <div>
                                <h3 style="margin: 0; color: #1f2937; font-size: 18px;">📱 Konfigurasi Telegram Bot</h3>
                                <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 13px;">Notifikasi dan kontrol via Telegram</p>
                            </div>
                        </div>
                        
                        <div style="margin-bottom: 20px;">
                            <label style="display: block; font-weight: 600; margin-bottom: 8px; font-size: 14px; color: #374151;">
                                Bot Token ${isOwner() ? '<span style="color: #ef4444;">*</span>' : '<span style="color: #6b7280; font-weight: normal;">(Owner only)</span>'}
                            </label>
                            <input type="password" id="botToken" placeholder="${isOwner() ? '123456789:ABCdefGHIjklMNOpqrsTUVwxyz' : 'Dikonfigurasi oleh Owner'}" 
                                   style="width: 100%; padding: 14px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 14px; transition: border-color 0.2s; outline: none;"
                                   onfocus="this.style.borderColor='#667eea'" 
                                   onblur="this.style.borderColor='#e5e7eb'">
                            <div style="font-size: 12px; color: #6b7280; margin-top: 6px;">
                                💡 Dapatkan dari @BotFather di Telegram
                            </div>
                        </div>

                        <div style="margin-bottom: 20px;">
                            <label style="display: block; font-weight: 600; margin-bottom: 8px; font-size: 14px; color: #374151;">
                                Chat ID ${isOwner() ? '(Auto-detect)' : '<span style="color: #6b7280; font-weight: normal;">(Owner only)</span>'}
                            </label>
                            <input type="text" id="chatId" placeholder="${isOwner() ? 'Kirim pesan ke bot, lalu klik Test Koneksi' : 'Dikonfigurasi oleh Owner'}" readonly 
                                   style="width: 100%; padding: 14px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 14px; background: #f9fafb; color: #6b7280;">
                        </div>

                        <div>
                            <button id="btnTestTelegram" style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; border: none; padding: 14px 28px; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px rgba(139, 92, 246, 0.3);">
                                📱 Test & Dapatkan Chat ID
                            </button>
                        </div>
                    </div>

                    <!-- STEP 2: GOOGLE SHEETS DATA -->
                    <div style="background: white; border-radius: 16px; padding: 24px; margin-bottom: 20px; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
                        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px;">
                            <span style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px;">2</span>
                            <div>
                                <h3 style="margin: 0; color: #1f2937; font-size: 18px;">⚙️ Pengaturan Google Sheets (Data)</h3>
                                <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 13px;">Sheet untuk menyimpan data nomor telepon</p>
                            </div>
                        </div>

                        <div style="margin-bottom: 20px;">
                            <label style="display: block; font-weight: 600; margin-bottom: 8px; font-size: 14px; color: #374151;">
                                Data Sheet ID ${isOwner() ? '<span style="color: #ef4444;">*</span>' : '<span style="color: #6b7280; font-weight: normal;">(Owner only)</span>'}
                            </label>
                            <input type="text" id="sheetId" placeholder="${isOwner() ? '1cPolj_xpBztq6RU3XVi_CZm1j_Kqo-zQC-wsbIYrLXE' : 'Dikonfigurasi oleh Owner'}" 
                                   style="width: 100%; padding: 14px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 14px; transition: border-color 0.2s; outline: none;"
                                   onfocus="this.style.borderColor='#667eea'" 
                                   onblur="this.style.borderColor='#e5e7eb'">
                        </div>

                        <div style="margin-bottom: 20px;">
                            <label style="display: block; font-weight: 600; margin-bottom: 8px; font-size: 14px; color: #374151;">
                                Data Sheet Name ${isOwner() ? '' : '<span style="color: #6b7280; font-weight: normal;">(Owner only)</span>'}
                            </label>
                            <input type="text" id="sheetName" placeholder="${isOwner() ? 'Data Base Hifzi Cell' : 'Dikonfigurasi oleh Owner'}" 
                                   style="width: 100%; padding: 14px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 14px; transition: border-color 0.2s; outline: none;"
                                   onfocus="this.style.borderColor='#667eea'" 
                                   onblur="this.style.borderColor='#e5e7eb'">
                        </div>

                        <div style="margin-bottom: 20px;">
                            <label style="display: block; font-weight: 600; margin-bottom: 8px; font-size: 14px; color: #374151;">
                                Data GAS Web App URL ${isOwner() ? '<span style="color: #ef4444;">*</span>' : '<span style="color: #6b7280; font-weight: normal;">(Owner only)</span>'}
                            </label>
                            <input type="text" id="gasUrl" placeholder="${isOwner() ? 'https://script.google.com/macros/s/XXXX/exec' : 'Dikonfigurasi oleh Owner'}" 
                                   style="width: 100%; padding: 14px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 14px; transition: border-color 0.2s; outline: none;"
                                   onfocus="this.style.borderColor='#667eea'" 
                                   onblur="this.style.borderColor='#e5e7eb'">
                            <div id="gasStatusInfo"></div>
                        </div>

                        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                            <button id="btnTestGAS" style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; border: none; padding: 14px 28px; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px rgba(139, 92, 246, 0.3);">
                                🔗 Test Koneksi GAS
                            </button>
                            <button id="btnSaveConfig" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 14px 28px; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);">
                                💾 Simpan ke Cloud
                            </button>
                        </div>
                    </div>

                    <!-- STEP 3: GAS CODE -->
                    <div style="background: white; border-radius: 16px; padding: 24px; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
                        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px;">
                            <span style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px;">3</span>
                            <div>
                                <h3 style="margin: 0; color: #1f2937; font-size: 18px;">📜 Kode Google Apps Script</h3>
                                <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 13px;">Copy dan deploy ke GAS Anda</p>
                            </div>
                        </div>
                        
                        <div style="display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap;">
                            <button id="btnGenerateGAS" style="background: #6b7280; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600;">
                                🔄 ${isOwner() ? 'Regenerate Code' : 'Refresh'}
                            </button>
                            <button id="btnCopyGAS" style="background: #10b981; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600;">
                                📋 Copy Kode
                            </button>
                            <button id="btnOpenGAS" style="background: #667eea; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600;">
                                🚀 Buka GAS Editor
                            </button>
                        </div>

                        <textarea id="gasCodeEditor" readonly placeholder="${isOwner() ? 'Klik \'Regenerate Code\' untuk generate kode GAS...' : 'Menunggu Owner generate kode GAS...'}" 
                                  style="width: 100%; height: 350px; padding: 16px; border: 2px solid #e5e7eb; border-radius: 10px; font-family: 'Consolas', 'Monaco', monospace; font-size: 11px; resize: vertical; background: #f9fafb; line-height: 1.5;"></textarea>
                    </div>
                </div>

                <!-- STATUS BAR -->
                <div style="position: fixed; bottom: 20px; right: 20px; background: #1f2937; color: white; padding: 12px 24px; border-radius: 50px; font-size: 13px; display: flex; align-items: center; gap: 12px; z-index: 100; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
                    <span id="statusText">Siap</span>
                    <span id="statusBadge" style="font-size: 16px;">🟢</span>
                </div>
            </div>

            <!-- MODALS -->
            <div id="modalOverlay" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 2000; align-items: center; justify-content: center; backdrop-filter: blur(4px); transition: opacity 0.3s;">
                
                <!-- Add/Edit Modal -->
                <div id="dataModal" style="display: none; background: white; border-radius: 20px; width: 90%; max-width: 500px; box-shadow: 0 25px 50px rgba(0,0,0,0.25); overflow: hidden; transition: transform 0.3s, opacity 0.3s;">
                    <div style="padding: 24px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                        <h3 id="modalTitle" style="margin: 0; font-size: 18px; font-weight: 600;">Tambah Data</h3>
                        <button id="btnCloseModal" style="background: rgba(255,255,255,0.2); border: none; font-size: 24px; cursor: pointer; color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: background 0.2s;">
                            &times;
                        </button>
                    </div>
                    <div style="padding: 24px;">
                        <input type="hidden" id="editId">
                        <div style="margin-bottom: 20px;">
                            <label style="display: block; font-weight: 600; margin-bottom: 8px; font-size: 14px; color: #374151;">Nama Lengkap <span style="color: #ef4444;">*</span></label>
                            <input type="text" id="inputNama" placeholder="Masukkan nama lengkap" 
                                   style="width: 100%; padding: 14px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 15px; transition: border-color 0.2s; outline: none;"
                                   onfocus="this.style.borderColor='#667eea'" 
                                   onblur="this.style.borderColor='#e5e7eb'">
                        </div>
                        <div style="margin-bottom: 20px;">
                            <label style="display: block; font-weight: 600; margin-bottom: 8px; font-size: 14px; color: #374151;">Nomor Telepon <span style="color: #ef4444;">*</span></label>
                            <input type="tel" id="inputNomor" placeholder="Contoh: 08123456789" 
                                   style="width: 100%; padding: 14px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 15px; transition: border-color 0.2s; outline: none;"
                                   onfocus="this.style.borderColor='#667eea'" 
                                   onblur="this.style.borderColor='#e5e7eb'">
                            <div style="font-size: 12px; color: #6b7280; margin-top: 6px;">Format: 10-15 digit angka</div>
                        </div>
                    </div>
                    <div style="padding: 20px 24px; border-top: 1px solid #e5e7eb; display: flex; justify-content: flex-end; gap: 12px; background: #f9fafb;">
                        <button id="btnCancel" style="padding: 12px 24px; border: 2px solid #e5e7eb; background: white; border-radius: 10px; cursor: pointer; font-weight: 600; color: #6b7280; transition: all 0.2s;">
                            Batal
                        </button>
                        <button id="btnSave" style="padding: 12px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3); transition: transform 0.2s;">
                            💾 Simpan Data
                        </button>
                    </div>
                </div>

                <!-- Delete Modal -->
                <div id="deleteModal" style="display: none; background: white; border-radius: 20px; width: 90%; max-width: 400px; box-shadow: 0 25px 50px rgba(0,0,0,0.25); overflow: hidden;">
                    <div style="padding: 24px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white;">
                        <h3 style="margin: 0; font-size: 18px; font-weight: 600;">⚠️ Konfirmasi Hapus</h3>
                    </div>
                    <div style="padding: 24px;">
                        <p style="margin: 0 0 16px 0; color: #374151;">Apakah Anda yakin ingin menghapus data ini?</p>
                        <p id="deleteInfo" style="font-weight: 600; color: #dc2626; padding: 16px; background: #fef2f2; border-radius: 10px; margin: 0; border: 2px solid #fecaca;"></p>
                        <p style="margin: 16px 0 0 0; font-size: 13px; color: #6b7280;">Data yang dihapus tidak dapat dikembalikan.</p>
                    </div>
                    <div style="padding: 20px 24px; border-top: 1px solid #e5e7eb; display: flex; justify-content: flex-end; gap: 12px; background: #f9fafb;">
                        <button id="btnCancelDelete" style="padding: 12px 24px; border: 2px solid #e5e7eb; background: white; border-radius: 10px; cursor: pointer; font-weight: 600; color: #6b7280;">
                            Batal
                        </button>
                        <button id="btnConfirmDelete" style="padding: 12px 24px; background: #ef4444; color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; box-shadow: 0 4px 6px rgba(239, 68, 68, 0.3);">
                            🗑️ Ya, Hapus Data
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    // ============================================
    // MAIN RENDER
    // ============================================

    async function renderPage() {
        console.log('[n8nModule] Rendering page...');
        
        const mainContent = document.getElementById('mainContent');
        if (!mainContent) {
            console.error('[n8nModule] mainContent element not found!');
            return;
        }

        mainContent.innerHTML = getHTML();
        attachEventListeners();
        
        // Load config dari berbagai sumber
        loadFromBackupModule();
        setFormValues();
        
        // Auto-sync dari cloud jika sudah ada config
        if (state.config.configGasUrl && state.config.configSheetId) {
            await loadConfigWithSync();
            setFormValues();
        }
        
        // Setup auto-sync interval untuk kasir/admin (setiap 5 menit)
        if (!isOwner()) {
            setInterval(() => {
                if (state.config.configGasUrl && state.config.configSheetId) {
                    autoSyncConfig();
                }
            }, 300000); // 5 menit
        }
        
        // Generate GAS code jika owner
        if (isOwner() && state.config.sheetName) {
            generateGAS();
        }
    }

    // ============================================
    // PUBLIC API
    // ============================================

    return {
        init: function() {
            console.log('[n8nModule] ✅ N8N Telegram Bridge v4.3.6 (Cross-Browser Cloud Sync) Loaded');
            detectUserRole();
        },
        
        renderPage: renderPage,
        testTelegramConnection: testTelegramConnection,
        testConnection: testConnection,
        rotateProxy: rotateProxy,
        handleSearch: handleSearch,
        handleAdd: handleAdd,
        handleEdit: handleEdit,
        handleDelete: handleDelete,
        getConfig: function() { return { ...state.config }; },
        saveConfig: handleSaveConfig,
        copyNumber: copyToClipboard,
        syncConfig: handleSyncConfig,
        
        // Backup module integration
        loadFromBackup: loadFromBackupModule,
        syncWithBackup: syncWithBackupModule,
        
        setRole: function(role) {
            state.userRole = role.toLowerCase();
            localStorage.setItem(CONFIG_KEYS.USER_ROLE, state.userRole);
            console.log('[n8nModule] Role set to:', state.userRole);
            setFormValues();
        },
        
        getRole: function() {
            return state.userRole;
        },
        
        getState: function() { 
            return { 
                ...state,
                config: { ...state.config } // Return copy
            }; 
        },
        
        // Debug utilities
        debug: {
            clearCache: function() {
                localStorage.removeItem(CONFIG_KEYS.LOCAL_CONFIG);
                localStorage.removeItem(CONFIG_KEYS.BACKUP_N8N_CONFIG);
                showNotification('🗑️ Cache dibersihkan', 'info');
            },
            forceSync: async function() {
                await loadConfigWithSync();
            }
        }
    };

})();

// Expose to window
window.n8nModule = n8nModule;

// Auto-init jika DOM sudah ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => n8nModule.init());
} else {
    n8nModule.init();
}

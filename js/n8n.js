// ============================================
// N8N DATA MANAGEMENT MODULE - TELEGRAM BRIDGE
// VERSI FIXED - SEARCH & COPY FEATURE
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
        CONFIG: 'n8n_config'
    };

    const state = {
        data: [],
        filteredData: [],
        selectedItem: null,
        config: {
            botToken: '',
            chatId: '',
            sheetId: '',
            sheetName: 'Data Base Hifzi Cell',
            gasUrl: ''
        },
        isLoading: false,
        currentProxyIndex: 0
    };

    const PROXY_LIST = [
        'https://api.allorigins.win/raw?url=',
        'https://api.codetabs.com/v1/proxy?quest=',
        'https://corsproxy.io/?'
    ];

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
        console.log(`[n8nModule] Proxy rotated to: ${getProxyUrl()}`);
        showNotification(`🔄 Proxy ${state.currentProxyIndex + 1}/${PROXY_LIST.length}`, 'info');
        return getProxyUrl();
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function showNotification(message, type = 'info', duration = 3000) {
        console.log(`[n8nModule] ${type}: ${message}`);
        
        if (typeof app !== 'undefined' && app.showToast) {
            app.showToast(message);
            return;
        }
        if (typeof utils !== 'undefined' && utils.showToast) {
            utils.showToast(message, type);
            return;
        }
        
        const toast = document.getElementById('toast');
        if (toast) {
            toast.textContent = message;
            toast.className = `toast show ${type}`;
            setTimeout(() => toast.className = 'toast', duration);
        } else {
            alert(message);
        }
    }

    function copyToClipboard(text) {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(() => {
                showNotification('📋 Nomor dicopy!', 'success', 2000);
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
        document.body.appendChild(textarea);
        textarea.select();
        
        try {
            document.execCommand('copy');
            showNotification('📋 Nomor dicopy!', 'success', 2000);
        } catch (err) {
            showNotification('❌ Gagal copy', 'error');
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
            if (badge === '🟢') statusText = '✅ Terhubung';
            else if (badge === '🔴') statusText = '❌ Error';
            else if (badge === '🟡') statusText = '⏳ ' + text;
            telegramStatus.textContent = statusText;
        }
    }

    // ============================================
    // LOAD & SAVE CONFIG
    // ============================================

    function loadConfig() {
        state.config.botToken = localStorage.getItem(CONFIG_KEYS.BOT_TOKEN) || '';
        state.config.chatId = localStorage.getItem(CONFIG_KEYS.CHAT_ID) || '';
        state.config.sheetId = localStorage.getItem(CONFIG_KEYS.SHEET_ID) || '';
        state.config.sheetName = localStorage.getItem(CONFIG_KEYS.SHEET_NAME) || 'Data Base Hifzi Cell';
        state.config.gasUrl = localStorage.getItem(CONFIG_KEYS.GAS_URL) || '';

        const savedConfig = localStorage.getItem(CONFIG_KEYS.CONFIG);
        if (savedConfig) {
            try {
                const parsed = JSON.parse(savedConfig);
                Object.assign(state.config, parsed);
            } catch (e) {
                console.error('[n8nModule] Error parsing config:', e);
            }
        }

        console.log('[n8nModule] Config loaded:', state.config);
    }

    function saveConfig() {
        const inputs = {
            botToken: document.getElementById('botToken')?.value.trim() || '',
            chatId: document.getElementById('chatId')?.value.trim() || '',
            sheetId: document.getElementById('sheetId')?.value.trim() || '',
            sheetName: document.getElementById('sheetName')?.value.trim() || 'Data Base Hifzi Cell',
            gasUrl: document.getElementById('gasUrl')?.value.trim() || ''
        };

        Object.assign(state.config, inputs);
        
        localStorage.setItem(CONFIG_KEYS.BOT_TOKEN, inputs.botToken);
        localStorage.setItem(CONFIG_KEYS.CHAT_ID, inputs.chatId);
        localStorage.setItem(CONFIG_KEYS.SHEET_ID, inputs.sheetId);
        localStorage.setItem(CONFIG_KEYS.SHEET_NAME, inputs.sheetName);
        localStorage.setItem(CONFIG_KEYS.GAS_URL, inputs.gasUrl);
        localStorage.setItem(CONFIG_KEYS.CONFIG, JSON.stringify(inputs));

        showNotification('✅ Konfigurasi berhasil disimpan!', 'success');
    }

    function setFormValues() {
        const fields = ['botToken', 'chatId', 'sheetId', 'sheetName', 'gasUrl'];
        fields.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = state.config[id] || '';
        });
    }

    // ============================================
    // FETCH WITH CORS PROXY
    // ============================================

    async function fetchWithProxy(url, retryCount = 0) {
        const MAX_RETRIES = PROXY_LIST.length;
        const timeout = 30000;

        console.log(`[n8nModule] Fetching: ${url.substring(0, 100)}...`);

        if (!isFileProtocol()) {
            try {
                console.log('[n8nModule] Trying direct fetch...');
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);
                
                const response = await fetch(url, { signal: controller.signal });
                clearTimeout(timeoutId);
                
                console.log('[n8nModule] Direct fetch success:', response.status);
                if (response.ok) return response;
            } catch (e) {
                console.log('[n8nModule] Direct fetch failed:', e.message);
            }
        }

        const proxyUrl = getProxyUrl();
        const fullUrl = `${proxyUrl}${encodeURIComponent(url)}`;

        console.log(`[n8nModule] Using proxy: ${proxyUrl}`);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            
            const response = await fetch(fullUrl, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            console.log('[n8nModule] Proxy response status:', response.status);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const proxyData = await response.json();
            console.log('[n8nModule] Proxy raw response:', proxyData);

            let finalData;
            
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
            } else if (proxyData.data) {
                finalData = typeof proxyData.data === 'string' ? JSON.parse(proxyData.data) : proxyData.data;
            } else {
                finalData = proxyData;
            }

            console.log('[n8nModule] Parsed data:', finalData);

            return {
                ok: true,
                status: 200,
                json: async () => finalData,
                text: async () => JSON.stringify(finalData)
            };

        } catch (error) {
            console.error(`[n8nModule] Proxy error:`, error);
            
            if (retryCount < MAX_RETRIES - 1) {
                rotateProxy();
                return fetchWithProxy(url, retryCount + 1);
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

    async function getTelegramUpdates() {
        const { botToken } = state.config;
        if (!botToken) return null;

        try {
            const url = `https://api.telegram.org/bot${botToken}/getUpdates?limit=10`;
            const response = await fetchWithProxy(url);
            return await response.json();
        } catch (error) {
            console.error('[n8nModule] Get updates error:', error);
            return null;
        }
    }

    async function getChatId() {
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
                showNotification('ℹ️ Kirim pesan ke bot dulu, lalu klik Test lagi', 'info');
                setStatus('🟡', 'Menunggu pesan dari bot');
                return;
            }

            const latest = result.result[result.result.length - 1];
            const chatId = latest.message?.chat?.id || 
                           latest.callback_query?.message?.chat?.id ||
                           latest.edited_message?.chat?.id;

            if (chatId) {
                state.config.chatId = chatId;
                const chatInput = document.getElementById('chatId');
                if (chatInput) chatInput.value = chatId;
                
                localStorage.setItem(CONFIG_KEYS.CHAT_ID, chatId);
                
                setStatus('🟢', 'Terhubung ke Telegram');
                showNotification(`✅ Chat ID: ${chatId}`, 'success');
                
                await sendTelegramMessage(
                    `✅ *KONEKSI BERHASIL*\n\n` +
                    `Web POS Hifzi Cell terhubung ke Telegram.\n` +
                    `Chat ID: ${chatId}\n` +
                    `Waktu: ${new Date().toLocaleString('id-ID')}`
                );
                
                return chatId;
            } else {
                throw new Error('Chat ID tidak ditemukan');
            }
            
        } catch (error) {
            console.error('[n8nModule] Get Chat ID error:', error);
            showNotification(`❌ ${error.message}`, 'error');
            setStatus('🔴', 'Error');
        }
    }

    async function sendTelegramMessage(text, options = {}) {
        const { botToken, chatId } = state.config;
        
        if (!botToken || !chatId) {
            console.warn('[n8nModule] Telegram not configured');
            return null;
        }

        try {
            const escapedText = text
                .replace(/\./g, '\\.')
                .replace(/-/g, '\\-')
                .replace(/!/g, '\\!')
                .replace(/\(/g, '\\(')
                .replace(/\)/g, '\\)');

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
                return null;
            }

        } catch (error) {
            console.error('[n8nModule] Send message error:', error);
            return null;
        }
    }

    // ============================================
    // GOOGLE APPS SCRIPT API
    // ============================================

    async function makeRequest(action, params = {}) {
        const { gasUrl, sheetId } = state.config;
        
        if (!gasUrl || !sheetId) {
            showNotification('⚠️ Sheet ID dan GAS URL harus diisi!', 'warning');
            return null;
        }

        const url = new URL(gasUrl);
        url.searchParams.append('action', action);
        url.searchParams.append('sheetId', sheetId);
        
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                url.searchParams.append(key, value);
            }
        });

        console.log('[n8nModule] API Request:', action, params);

        try {
            setStatus('🟡', 'Loading...');
            state.isLoading = true;

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
            return data;
            
        } catch (error) {
            console.error('[n8nModule] API Error:', error);
            setStatus('🔴', 'Error');
            showNotification(`❌ ${error.message}`, 'error', 6000);
            return null;
            
        } finally {
            state.isLoading = false;
        }
    }

    // ============================================
    // CRUD OPERATIONS - FIXED SEARCH
    // ============================================

    async function handleSearch() {
        const keywordInput = document.getElementById('searchInput');
        const keyword = keywordInput?.value.trim() || '';
        
        console.log('[n8nModule] === HANDLE SEARCH ===');
        console.log('[n8nModule] Keyword input:', keyword);
        console.log('[n8nModule] Keyword lowercase:', keyword.toLowerCase());

        // Reset selection
        state.selectedItem = null;
        updateButtonStates();

        // Show loading
        const tbody = document.getElementById('tableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; padding: 40px;">
                        <div style="font-size: 32px; margin-bottom: 10px;">⏳</div>
                        <div>Mengambil data...</div>
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
        console.log('[n8nModule] First 3 items:', state.data.slice(0, 3));

        // FILTER LOGIC - FIXED
        if (keyword && keyword.length > 0) {
            const keywordLower = keyword.toLowerCase();
            console.log('[n8nModule] Filtering with keyword:', keywordLower);
            
            state.filteredData = state.data.filter(item => {
                // Pastikan item ada dan memiliki property
                if (!item) return false;
                
                const nama = String(item.nama || '').toLowerCase();
                const nomor = String(item.nomor || '').toLowerCase();
                
                const matchNama = nama.includes(keywordLower);
                const matchNomor = nomor.includes(keywordLower);
                
                if (matchNama || matchNomor) {
                    console.log('[n8nModule] Match found:', item);
                }
                
                return matchNama || matchNomor;
            });
        } else {
            state.filteredData = [...state.data];
        }

        console.log('[n8nModule] Filtered data count:', state.filteredData.length);

        renderTable();
        
        if (state.filteredData.length === 0 && keyword) {
            showNotification(`❌ Tidak ada data cocok dengan "${keyword}"`, 'warning');
        } else {
            showNotification(`✅ ${state.filteredData.length} data ditemukan`, 'success');
        }
    }

    function handleAdd() {
        console.log('[n8nModule] === HANDLE ADD ===');
        
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
        console.log('[n8nModule] === HANDLE EDIT ===');
        console.log('[n8nModule] Selected item:', state.selectedItem);

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
        console.log('[n8nModule] === HANDLE DELETE ===');
        console.log('[n8nModule] Selected item:', state.selectedItem);

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
        console.log('[n8nModule] === SAVE DATA ===');
        
        const editId = document.getElementById('editId');
        const inputNama = document.getElementById('inputNama');
        const inputNomor = document.getElementById('inputNomor');

        const row = editId?.value;
        const nama = inputNama?.value.trim();
        const nomor = inputNomor?.value.trim();

        console.log('[n8nModule] Save params:', { row, nama, nomor });

        if (!nama || !nomor) {
            showNotification('⚠️ Nama dan Nomor wajib diisi!', 'warning');
            if (inputNama && !nama) inputNama.focus();
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
        } else if (result) {
            showNotification('❌ ' + (result.error || 'Gagal menyimpan'), 'error');
        }
    }

    async function confirmDelete() {
        console.log('[n8nModule] === CONFIRM DELETE ===');
        
        if (!state.selectedItem) {
            showNotification('❌ Tidak ada data yang dipilih', 'error');
            return;
        }
        
        const row = state.selectedItem.row;
        console.log('[n8nModule] Deleting row:', row);
        
        showNotification('⏳ Menghapus data...', 'info');
        
        const result = await makeRequest('deleteData', { row });
        
        if (result && result.success) {
            closeModal();
            state.selectedItem = null;
            updateButtonStates();
            await handleSearch();
            showNotification(result.message || '✅ Data dihapus', 'success');
        } else if (result) {
            showNotification('❌ ' + (result.error || 'Gagal menghapus'), 'error');
        }
    }

    // ============================================
    // UI RENDERING - WITH COPY BUTTON
    // ============================================

    function renderTable() {
        console.log('[n8nModule] === RENDER TABLE ===');
        
        const tbody = document.getElementById('tableBody');
        if (!tbody) {
            console.error('[n8nModule] tableBody not found!');
            return;
        }

        console.log('[n8nModule] Rendering', state.filteredData.length, 'rows');

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
            
            html += `
                <tr class="n8n-data-row ${isSelected ? 'selected' : ''}" 
                    data-row="${item.row}" 
                    data-index="${index}"
                    style="cursor: pointer; ${isSelected ? 'background: #e0e7ff !important;' : ''}">
                    <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${index + 1}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: 500;">${escapeHtml(item.nama || '')}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span>${nomorDisplay}</span>
                            <button onclick="event.stopPropagation(); n8nModule.copyNumber('${item.nomor || ''}')" 
                                    style="padding: 4px 8px; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;"
                                    title="Copy nomor">
                                📋
                            </button>
                        </div>
                    </td>
                    <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
                        <button class="n8n-btn-select" 
                                data-row="${item.row}" 
                                data-index="${index}"
                                style="padding: 6px 12px; border: 2px solid ${isSelected ? '#667eea' : '#d1d5db'}; 
                                       background: ${isSelected ? '#667eea' : 'white'}; 
                                       color: ${isSelected ? 'white' : '#374151'};
                                       border-radius: 6px; cursor: pointer; font-weight: 600;">
                            ${isSelected ? '✓' : '☐'}
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
        console.log('[n8nModule] === SELECT ROW ===');
        console.log('[n8nModule] Row number:', rowNum, 'Index:', index);

        const item = state.filteredData.find(d => d.row == rowNum);
        
        if (!item) {
            console.error('[n8nModule] Item not found for row:', rowNum);
            return;
        }

        if (state.selectedItem && state.selectedItem.row == rowNum) {
            state.selectedItem = null;
            console.log('[n8nModule] Deselected');
        } else {
            state.selectedItem = item;
            console.log('[n8nModule] Selected:', item);
        }

        renderTable();
    }

    function updateButtonStates() {
        const hasSelection = state.selectedItem !== null;
        const btnEdit = document.getElementById('btnEdit');
        const btnDelete = document.getElementById('btnDelete');
        
        console.log('[n8nModule] Update buttons - hasSelection:', hasSelection);

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
        
        if (overlay) overlay.style.display = 'flex';
        if (modal) {
            modal.style.display = 'block';
        }
    }

    function closeModal() {
        const overlay = document.getElementById('modalOverlay');
        if (overlay) overlay.style.display = 'none';
        
        document.querySelectorAll('#dataModal, #deleteModal').forEach(m => {
            m.style.display = 'none';
        });
    }

    // ============================================
    // GAS CODE GENERATOR
    // ============================================

    function generateGAS() {
        const sheetName = state.config.sheetName || 'Data Base Hifzi Cell';
        
        const code = `/**
 * GOOGLE APPS SCRIPT - N8N Telegram Bridge
 * Auto-generated: ${new Date().toLocaleString('id-ID')}
 * Sheet: ${sheetName}
 */

const SHEET_NAME = '${sheetName}';

function doGet(e) {
  const action = e.parameter.action;
  const sheetId = e.parameter.sheetId;
  
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  
  try {
    if (!sheetId) throw new Error('Parameter sheetId diperlukan');
    if (!action) throw new Error('Parameter action diperlukan');

    const ss = SpreadsheetApp.openById(sheetId);
    let sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow(['NAMA', 'NOMOR']);
      sheet.getRange(1, 1, 1, 2)
        .setFontWeight('bold')
        .setBackground('#4caf50')
        .setFontColor('white');
    }

    let result = { success: false };

    switch(action) {
      case 'test':
        result = { 
          success: true, 
          message: '✅ Koneksi berhasil!',
          sheets: ss.getSheets().map(s => s.getName()),
          targetSheet: SHEET_NAME,
          timestamp: new Date().toISOString()
        };
        break;

      case 'getData':
        const data = sheet.getDataRange().getValues();
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
        const namaAdd = e.parameter.nama || '';
        const nomorAdd = e.parameter.nomor || '';
        if (!namaAdd || !nomorAdd) throw new Error('Parameter nama dan nomor diperlukan');
        sheet.appendRow([namaAdd, nomorAdd]);
        result = { 
          success: true, 
          message: '✅ Data berhasil ditambahkan',
          row: sheet.getLastRow(),
          timestamp: new Date().toISOString()
        };
        break;

      case 'editData':
        const rowEdit = parseInt(e.parameter.row);
        const namaEdit = e.parameter.nama || '';
        const nomorEdit = e.parameter.nomor || '';
        if (!rowEdit || isNaN(rowEdit) || rowEdit < 2) throw new Error('Parameter row tidak valid');
        if (!namaEdit || !nomorEdit) throw new Error('Parameter nama dan nomor diperlukan');
        sheet.getRange(rowEdit, 1).setValue(namaEdit);
        sheet.getRange(rowEdit, 2).setValue(nomorEdit);
        result = { 
          success: true, 
          message: '✅ Data berhasil diupdate',
          row: rowEdit,
          timestamp: new Date().toISOString()
        };
        break;

      case 'deleteData':
        const rowDel = parseInt(e.parameter.row);
        if (!rowDel || isNaN(rowDel) || rowDel < 2) throw new Error('Parameter row tidak valid');
        sheet.deleteRow(rowDel);
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

    output.setContent(JSON.stringify(result));
    return output;

  } catch (error) {
    const errorResult = { 
      success: false, 
      error: error.toString(),
      message: error.message
    };
    output.setContent(JSON.stringify(errorResult));
    return output;
  }
}

function doOptions(e) {
  const output = ContentService.createTextOutput('');
  return output;
}`;

        const editor = document.getElementById('gasCodeEditor');
        if (editor) editor.value = code;
    }

    function copyGASCode() {
        const textarea = document.getElementById('gasCodeEditor');
        if (!textarea?.value.trim()) {
            showNotification('⚠️ Generate kode GAS terlebih dahulu', 'warning');
            return;
        }
        textarea.select();
        document.execCommand('copy');
        showNotification('✅ Kode GAS dicopy!', 'success');
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
                    <div style="color: #4caf50; font-size: 12px; margin-top: 8px;">
                        ✅ Terhubung ke: ${result.targetSheet}<br>
                        📊 Sheets: ${(result.sheets || []).join(', ')}
                    </div>
                `;
            }
        }
    }

    async function testTelegramConnection() {
        await getChatId();
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
            const editor = document.getElementById('gasCodeEditor');
            if (editor && !editor.value.trim()) generateGAS();
        } else {
            section.style.display = 'none';
            arrow.textContent = '▼';
        }
    }

    // ============================================
    // EVENT LISTENERS
    // ============================================

    function attachEventListeners() {
        console.log('[n8nModule] Attaching event listeners...');

        document.getElementById('btnSearch')?.addEventListener('click', handleSearch);
        document.getElementById('btnExecuteSearch')?.addEventListener('click', handleSearch);
        document.getElementById('btnAdd')?.addEventListener('click', handleAdd);
        document.getElementById('btnEdit')?.addEventListener('click', handleEdit);
        document.getElementById('btnDelete')?.addEventListener('click', handleDelete);
        document.getElementById('btnToggleConfig')?.addEventListener('click', toggleConfig);
        document.getElementById('btnSaveConfig')?.addEventListener('click', saveConfig);
        document.getElementById('btnTestTelegram')?.addEventListener('click', getChatId);
        document.getElementById('btnTestGAS')?.addEventListener('click', testConnection);
        document.getElementById('btnGenerateGAS')?.addEventListener('click', generateGAS);
        document.getElementById('btnCopyGAS')?.addEventListener('click', copyGASCode);
        document.getElementById('btnOpenGAS')?.addEventListener('click', () => {
            window.open('https://script.google.com', '_blank');
        });
        document.getElementById('btnCloseModal')?.addEventListener('click', closeModal);
        document.getElementById('btnCancel')?.addEventListener('click', closeModal);
        document.getElementById('btnSave')?.addEventListener('click', saveData);
        document.getElementById('btnCancelDelete')?.addEventListener('click', closeModal);
        document.getElementById('btnConfirmDelete')?.addEventListener('click', confirmDelete);
        
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') handleSearch();
            });
        }

        const modalOverlay = document.getElementById('modalOverlay');
        if (modalOverlay) {
            modalOverlay.addEventListener('click', (e) => {
                if (e.target.id === 'modalOverlay') closeModal();
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeModal();
        });

        console.log('[n8nModule] Event listeners attached');
    }

    // ============================================
    // HTML TEMPLATE
    // ============================================

    function getHTML() {
        const isFile = isFileProtocol();
        
        const fileWarning = isFile ? `
            <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 15px; margin-bottom: 20px; color: #856404;">
                <div style="font-weight: bold; margin-bottom: 8px;">⚠️ Mode File Lokal Terdeteksi</div>
                <div style="font-size: 13px; line-height: 1.5;">
                    Beberapa fitur terbatas karena CORS. Solusi:
                    <ol style="margin: 10px 0; padding-left: 20px;">
                        <li>Gunakan <strong>Live Server</strong> di VS Code</li>
                        <li>Upload ke <strong>GitHub Pages</strong></li>
                    </ol>
                </div>
            </div>
        ` : '';

        return `
            <div class="n8n-container" style="padding: 20px; max-width: 1200px; margin: 0 auto;">
                ${fileWarning}
                
                <div style="margin-bottom: 20px;">
                    <h2 style="margin: 0; color: #333;">🔍 N8N Data Management</h2>
                    <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">Kelola data via Google Sheets</p>
                </div>

                <!-- TELEGRAM STATUS CARD -->
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 20px; margin-bottom: 20px; color: white;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
                        <div>
                            <div style="font-weight: 600; margin-bottom: 4px;">📱 Status Telegram</div>
                            <div id="telegramStatusText" style="font-size: 14px; opacity: 0.9;">
                                ${state.config.botToken ? '⏳ Menunggu koneksi...' : '⚠️ Belum dikonfigurasi'}
                            </div>
                        </div>
                        <div style="display: flex; gap: 10px;">
                            ${isFile ? `
                            <button onclick="n8nModule.rotateProxy()" style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); color: white; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 13px;">
                                🔄 Rotate Proxy
                            </button>
                            ` : ''}
                            <button onclick="n8nModule.testTelegramConnection()" style="background: white; color: #667eea; padding: 10px 20px; border-radius: 8px; border: none; cursor: pointer; font-weight: 600; font-size: 13px;">
                                🔄 Test Koneksi
                            </button>
                        </div>
                    </div>
                </div>

                <!-- CRUD BUTTONS -->
                <div style="background: white; border-radius: 12px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <div style="display: flex; gap: 10px; margin-bottom: 15px; flex-wrap: wrap;">
                        <button id="btnSearch" style="background: #667eea; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600;">
                            🔍 Cari Data
                        </button>
                        <button id="btnAdd" style="background: #10b981; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600;">
                            ➕ Tambah Data
                        </button>
                        <button id="btnEdit" disabled style="background: #d1d5db; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: not-allowed; font-weight: 600; opacity: 0.5;">
                            ✏️ Edit Data
                        </button>
                        <button id="btnDelete" disabled style="background: #d1d5db; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: not-allowed; font-weight: 600; opacity: 0.5;">
                            🗑️ Hapus Data
                        </button>
                    </div>

                    <div style="display: flex; gap: 10px;">
                        <input type="text" id="searchInput" placeholder="Ketik minimal 3 huruf (awal/tengah/akhir nama)..." 
                               style="flex: 1; padding: 12px 16px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px;">
                        <button id="btnExecuteSearch" style="background: #667eea; color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer;">
                            🔍
                        </button>
                    </div>
                </div>

                <!-- DATA TABLE -->
                <div style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <div style="overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="background: #667eea; color: white;">
                                    <th style="padding: 15px; text-align: left; width: 60px;">No</th>
                                    <th style="padding: 15px; text-align: left;">NAMA</th>
                                    <th style="padding: 15px; text-align: left;">NOMOR</th>
                                    <th style="padding: 15px; text-align: center; width: 100px;">Pilih</th>
                                </tr>
                            </thead>
                            <tbody id="tableBody">
                                <tr>
                                    <td colspan="4" style="text-align: center; padding: 60px 20px; color: #9ca3af;">
                                        <div style="font-size: 48px; margin-bottom: 15px;">📭</div>
                                        <div>Belum ada data. Klik "Cari Data" untuk memuat dari Google Sheets.</div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- CONFIG TOGGLE -->
                <div style="margin-top: 20px;">
                    <button id="btnToggleConfig" style="background: #f3f4f6; color: #374151; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 8px; width: 100%; justify-content: space-between;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span>⚙️</span>
                            <span>Konfigurasi Telegram & GAS</span>
                        </div>
                        <span id="configArrow">▼</span>
                    </button>
                </div>

                <!-- CONFIGURATION SECTION -->
                <div id="configSection" style="display: none; margin-top: 20px;">
                    
                    <!-- STEP 1: TELEGRAM -->
                    <div style="background: white; border-radius: 12px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
                            <span style="background: #667eea; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold;">1</span>
                            <h3 style="margin: 0;">📱 Konfigurasi Telegram Bot</h3>
                        </div>
                        
                        <div style="margin-bottom: 15px;">
                            <label style="display: block; font-weight: 600; margin-bottom: 6px; font-size: 14px;">Bot Token <span style="color: #ef4444;">*</span></label>
                            <input type="password" id="botToken" placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz" 
                                   style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px; box-sizing: border-box;">
                        </div>

                        <div style="margin-bottom: 15px;">
                            <label style="display: block; font-weight: 600; margin-bottom: 6px; font-size: 14px;">Chat ID (Auto-detect)</label>
                            <input type="text" id="chatId" placeholder="Kirim pesan ke bot, lalu klik Test" readonly 
                                   style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px; background: #f9fafb; box-sizing: border-box;">
                        </div>

                        <div>
                            <button id="btnTestTelegram" style="background: #8b5cf6; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600;">
                                📱 Test & Dapatkan Chat ID
                            </button>
                        </div>
                    </div>

                    <!-- STEP 2: GOOGLE SHEETS -->
                    <div style="background: white; border-radius: 12px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
                            <span style="background: #667eea; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold;">2</span>
                            <h3 style="margin: 0;">⚙️ Pengaturan Google Sheets</h3>
                        </div>

                        <div style="margin-bottom: 15px;">
                            <label style="display: block; font-weight: 600; margin-bottom: 6px; font-size: 14px;">Google Sheet ID <span style="color: #ef4444;">*</span></label>
                            <input type="text" id="sheetId" placeholder="1cPolj_xpBztq6RU3XVi_CZm1j_Kqo-zQC-wsbIYrLXE" 
                                   style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px; box-sizing: border-box;">
                        </div>

                        <div style="margin-bottom: 15px;">
                            <label style="display: block; font-weight: 600; margin-bottom: 6px; font-size: 14px;">Sheet Name</label>
                            <input type="text" id="sheetName" placeholder="Data Base Hifzi Cell" 
                                   style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px; box-sizing: border-box;">
                        </div>

                        <div style="margin-bottom: 15px;">
                            <label style="display: block; font-weight: 600; margin-bottom: 6px; font-size: 14px;">GAS Web App URL <span style="color: #ef4444;">*</span></label>
                            <input type="text" id="gasUrl" placeholder="https://script.google.com/macros/s/XXXX/exec" 
                                   style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px; box-sizing: border-box;">
                            <div id="gasStatusInfo"></div>
                        </div>

                        <div style="display: flex; gap: 10px;">
                            <button id="btnTestGAS" style="background: #8b5cf6; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600;">
                                🔗 Test Koneksi GAS
                            </button>
                            <button id="btnSaveConfig" style="background: #667eea; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600;">
                                💾 Simpan Konfigurasi
                            </button>
                        </div>
                    </div>

                    <!-- STEP 3: GAS CODE -->
                    <div style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
                            <span style="background: #667eea; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold;">3</span>
                            <h3 style="margin: 0;">📜 Generate Kode GAS</h3>
                        </div>
                        
                        <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                            <button id="btnGenerateGAS" style="background: #6b7280; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 13px;">
                                🔄 Regenerate
                            </button>
                            <button id="btnCopyGAS" style="background: #10b981; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 13px;">
                                📋 Copy Kode
                            </button>
                            <button id="btnOpenGAS" style="background: #667eea; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 13px;">
                                🚀 Buka GAS Editor
                            </button>
                        </div>

                        <textarea id="gasCodeEditor" readonly placeholder="Klik 'Regenerate' untuk generate kode GAS..." 
                                  style="width: 100%; height: 300px; padding: 15px; border: 2px solid #e5e7eb; border-radius: 8px; font-family: monospace; font-size: 12px; resize: vertical; box-sizing: border-box;"></textarea>
                    </div>
                </div>

                <!-- STATUS BAR -->
                <div style="position: fixed; bottom: 20px; right: 20px; background: #1f2937; color: white; padding: 10px 20px; border-radius: 20px; font-size: 13px; display: flex; align-items: center; gap: 10px; z-index: 100;">
                    <span id="statusText">Siap</span>
                    <span id="statusBadge">🟢</span>
                </div>
            </div>

            <!-- MODALS -->
            <div id="modalOverlay" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 2000; align-items: center; justify-content: center;">
                
                <!-- Add/Edit Modal -->
                <div id="dataModal" style="display: none; background: white; border-radius: 16px; width: 90%; max-width: 500px;">
                    <div style="padding: 20px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center;">
                        <h3 id="modalTitle" style="margin: 0;">Tambah Data</h3>
                        <button id="btnCloseModal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #6b7280;">&times;</button>
                    </div>
                    <div style="padding: 20px;">
                        <input type="hidden" id="editId">
                        <div style="margin-bottom: 15px;">
                            <label style="display: block; font-weight: 600; margin-bottom: 6px; font-size: 14px;">Nama <span style="color: #ef4444;">*</span></label>
                            <input type="text" id="inputNama" placeholder="Masukkan nama lengkap" 
                                   style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px; box-sizing: border-box;">
                        </div>
                        <div style="margin-bottom: 15px;">
                            <label style="display: block; font-weight: 600; margin-bottom: 6px; font-size: 14px;">Nomor <span style="color: #ef4444;">*</span></label>
                            <input type="text" id="inputNomor" placeholder="Masukkan nomor telepon/HP" 
                                   style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px; box-sizing: border-box;">
                        </div>
                    </div>
                    <div style="padding: 20px; border-top: 1px solid #e5e7eb; display: flex; justify-content: flex-end; gap: 10px;">
                        <button id="btnCancel" style="padding: 10px 20px; border: 1px solid #e5e7eb; background: white; border-radius: 8px; cursor: pointer; font-weight: 500;">Batal</button>
                        <button id="btnSave" style="padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                            💾 Simpan
                        </button>
                    </div>
                </div>

                <!-- Delete Modal -->
                <div id="deleteModal" style="display: none; background: white; border-radius: 16px; width: 90%; max-width: 400px;">
                    <div style="padding: 20px; background: linear-gradient(135deg, #ff7675 0%, #d63031 100%); color: white; border-radius: 16px 16px 0 0;">
                        <h3 style="margin: 0;">⚠️ Konfirmasi Hapus</h3>
                    </div>
                    <div style="padding: 20px;">
                        <p>Apakah Anda yakin ingin menghapus data ini?</p>
                        <p id="deleteInfo" style="font-weight: 600; color: #d63031; padding: 10px; background: #fff5f5; border-radius: 8px; margin: 10px 0;"></p>
                    </div>
                    <div style="padding: 20px; border-top: 1px solid #e5e7eb; display: flex; justify-content: flex-end; gap: 10px;">
                        <button id="btnCancelDelete" style="padding: 10px 20px; border: 1px solid #e5e7eb; background: white; border-radius: 8px; cursor: pointer; font-weight: 500;">Batal</button>
                        <button id="btnConfirmDelete" style="padding: 10px 20px; background: #ef4444; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">🗑️ Hapus</button>
                    </div>
                </div>
            </div>
        `;
    }

    // ============================================
    // MAIN RENDER
    // ============================================

    function renderPage() {
        console.log('[n8nModule] Rendering page...');
        
        const mainContent = document.getElementById('mainContent');
        if (!mainContent) {
            console.error('[n8nModule] mainContent element not found!');
            return;
        }

        mainContent.innerHTML = getHTML();
        attachEventListeners();
        setFormValues();
        
        if (state.config.sheetName) generateGAS();
        
        if (state.config.botToken && !state.config.chatId) {
            setTimeout(() => getChatId(), 1500);
        }
    }

    // ============================================
    // PUBLIC API
    // ============================================

    return {
        init: function() {
            console.log('[n8nModule] ✅ N8N Telegram Bridge v2.5 Fixed Loaded');
            loadConfig();
        },
        
        renderPage: renderPage,
        testTelegramConnection: testTelegramConnection,
        testConnection: testConnection,
        rotateProxy: rotateProxy,
        handleSearch: handleSearch,
        handleAdd: handleAdd,
        handleEdit: handleEdit,
        handleDelete: handleDelete,
        getConfig: function() { return state.config; },
        saveConfig: saveConfig,
        copyNumber: copyToClipboard,
        
        // Debug
        getState: function() { 
            console.log('[n8nModule] Current state:', state);
            return state; 
        }
    };

})();

window.n8nModule = n8nModule;

// ============================================
// N8N DATA MANAGEMENT MODULE - TELEGRAM BRIDGE
// VERSI LENGKAP FULL FEATURE - FIXED CORS & PROXY
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
        selectedRow: null,
        config: {
            botToken: '',
            chatId: '',
            sheetId: '',
            sheetName: 'Data Base Hifzi Cell',
            gasUrl: ''
        },
        configVisible: false,
        isLoading: false,
        proxyMode: false,
        currentProxyIndex: 0
    };

    // UPDATED: Proxy list yang masih aktif
    const PROXY_LIST = [
        'https://api.allorigins.win/raw?url=',
        'https://api.codetabs.com/v1/proxy?quest=',
        'https://corsproxy.io/?',
        'https://api.codetabs.com/v1/proxy?quest='
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
        return getProxyUrl();
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatRupiah(angka) {
        if (!angka) return 'Rp 0';
        return 'Rp ' + parseInt(angka).toLocaleString('id-ID');
    }

    function showNotification(message, type = 'info', duration = 4000) {
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

    function setStatus(badge, text) {
        const badgeEl = document.getElementById('statusBadge');
        const textEl = document.querySelector('.status-text');
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

        console.log('[n8nModule] Config loaded:', {
            hasBotToken: !!state.config.botToken,
            hasChatId: !!state.config.chatId,
            hasSheetId: !!state.config.sheetId,
            hasGasUrl: !!state.config.gasUrl
        });
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
        console.log('[n8nModule] Config saved');
    }

    function setFormValues() {
        const fields = ['botToken', 'chatId', 'sheetId', 'sheetName', 'gasUrl'];
        fields.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = state.config[id] || '';
        });
    }

    // ============================================
    // FETCH WITH CORS PROXY - FIXED
    // ============================================

    async function fetchWithProxy(url, retryCount = 0) {
        const MAX_RETRIES = PROXY_LIST.length;

        // Jika bukan file protocol, coba direct fetch dulu
        if (!isFileProtocol()) {
            try {
                const response = await fetch(url);
                if (response.ok) return response;
            } catch (e) {
                console.log('[n8nModule] Direct fetch failed, trying proxy...');
            }
        }

        const proxyUrl = getProxyUrl();
        const fullUrl = `${proxyUrl}${encodeURIComponent(url)}`;

        console.log(`[n8nModule] Using proxy [${state.currentProxyIndex + 1}/${PROXY_LIST.length}]: ${proxyUrl}`);

        try {
            const response = await fetch(fullUrl, {
                method: 'GET',
                headers: { 
                    'Accept': 'application/json',
                    'Origin': window.location.origin
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const proxyData = await response.json();
            let finalData;
            
            // Handle berbagai format response proxy
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

            return {
                ok: true,
                status: 200,
                json: async () => finalData,
                text: async () => JSON.stringify(finalData)
            };

        } catch (error) {
            console.error(`[n8nModule] Proxy error:`, error.message);
            
            if (retryCount < MAX_RETRIES - 1) {
                rotateProxy();
                console.log('[n8nModule] Retrying with next proxy...');
                return fetchWithProxy(url, retryCount + 1);
            }
            
            throw new Error('Semua proxy gagal. Gunakan Live Server atau upload ke web server.');
        }
    }

    // ============================================
    // TELEGRAM API - FIX WEBHOOK CONFLICT
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

        setStatus('🟡', 'Menghapus webhook lama...');
        
        // FIX: Delete webhook dulu sebelum getUpdates!
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
                showNotification(`✅ Chat ID terdeteksi: ${chatId}`, 'success');
                
                await sendTelegramMessage(
                    `✅ *KONEKSI BERHASIL*\\n\\n` +
                    `Web POS Hifzi Cell telah terhubung ke Telegram.\\n` +
                    `Chat ID: ${chatId}\\n` +
                    `Waktu: ${new Date().toLocaleString('id-ID')}`
                );
                
                return chatId;
            } else {
                throw new Error('Chat ID tidak ditemukan dalam pesan');
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
            // Escape markdown characters
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
    // GOOGLE APPS SCRIPT API - FIXED
    // ============================================

    async function makeRequest(action, params = {}) {
        const { gasUrl, sheetId } = state.config;
        
        if (!gasUrl || !sheetId) {
            showNotification('⚠️ Sheet ID dan GAS URL harus diisi!', 'warning');
            return null;
        }

        // Build URL with parameters
        const url = new URL(gasUrl);
        url.searchParams.append('action', action);
        url.searchParams.append('sheetId', sheetId);
        
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                url.searchParams.append(key, value);
            }
        });

        console.log('[n8nModule] API Request:', { action, sheetId, url: url.toString() });

        try {
            setStatus('🟡', 'Loading...');
            state.isLoading = true;

            const response = await fetchWithProxy(url.toString());
            
            // Check if response is valid
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

            let errorMsg = error.message;
            let solution = '';

            if (error.message.includes('Failed to fetch') || error.message.includes('CORS') || error.message.includes('NetworkError')) {
                errorMsg = 'CORS Error - GAS tidak bisa diakses';
                solution = isFileProtocol() 
                    ? '\\n\\n💡 Solusi:\\n1. Gunakan Live Server di VS Code\\n2. Atau upload ke GitHub Pages/Netlify\\n3. Coba klik 🔄 Rotate Proxy'
                    : '\\n\\n💡 Solusi:\\n1. Pastikan GAS Deploy dengan "Access: ANYONE"\\n2. Cek URL GAS benar\\n3. Deploy ulang GAS\\n4. Cek Sheet ID benar';
            } else if (error.message.includes('404')) {
                errorMsg = 'GAS URL tidak ditemukan (404)';
                solution = '\\n\\n💡 Deploy ulang GAS dan copy URL baru';
            }

            showNotification(`❌ ${errorMsg}${solution}`, 'error', 8000);
            return null;
            
        } finally {
            state.isLoading = false;
        }
    }

    // ============================================
    // CRUD OPERATIONS
    // ============================================

    async function handleSearch() {
        const keywordInput = document.getElementById('searchInput');
        const keyword = keywordInput?.value.toLowerCase().trim() || '';
        
        // Send initial message
        await sendTelegramMessage(
            `🔍 *PENCARIAN DATA*\\n\\n` +
            `Keyword: ${keyword || 'Semua data'}\\n` +
            `Waktu: ${new Date().toLocaleString('id-ID')}\\n\\n` +
            `⏳ Mengambil data dari Google Sheets...`
        );

        // FIXED: Properly handle the response
        const result = await makeRequest('getData');
        
        if (!result) {
            await sendTelegramMessage('❌ Gagal mengambil data dari Google Sheets\\n\\nCek koneksi dan konfigurasi GAS');
            return;
        }

        state.data = result.data || [];

        if (keyword) {
            state.filteredData = state.data.filter(item => 
                (item.nama && item.nama.toLowerCase().includes(keyword)) || 
                (item.nomor && item.nomor.toLowerCase().includes(keyword))
            );
        } else {
            state.filteredData = state.data;
        }

        renderTable();

        const count = state.filteredData.length;
        let message = `✅ *PENCARIAN SELESAI*\\n\\n`;
        message += `Ditemukan: *${count} data*\\n`;
        message += `Keyword: *${keyword || '-'}*\\n\\n`;
        
        if (count > 0) {
            message += `*Hasil (5 teratas):*\\n`;
            state.filteredData.slice(0, 5).forEach((item, idx) => {
                const nama = (item.nama || 'N/A').substring(0, 20);
                const nomor = (item.nomor || 'N/A').substring(0, 15);
                message += `${idx + 1}\\. ${nama} \\- ${nomor}\\n`;
            });
            
            if (count > 5) {
                message += `\\n...dan ${count - 5} data lainnya`;
            }
        } else {
            message += `❌ Tidak ada data yang cocok`;
        }

        await sendTelegramMessage(message);
        showNotification(`✅ ${count} data ditemukan`, 'success');
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
            inputNama.focus();
        }
        if (inputNomor) inputNomor.value = '';

        openModal('dataModal');
    }

    function handleEdit() {
        if (!state.selectedRow) {
            showNotification('⚠️ Pilih data di tabel terlebih dahulu', 'warning');
            return;
        }

        const item = state.filteredData.find(d => d.row == state.selectedRow);
        if (!item) {
            showNotification('❌ Data tidak ditemukan', 'error');
            return;
        }

        const modalTitle = document.getElementById('modalTitle');
        const editId = document.getElementById('editId');
        const inputNama = document.getElementById('inputNama');
        const inputNomor = document.getElementById('inputNomor');

        if (modalTitle) modalTitle.textContent = '✏️ Edit Data';
        if (editId) editId.value = item.row;
        if (inputNama) {
            inputNama.value = item.nama || '';
            inputNama.focus();
        }
        if (inputNomor) inputNomor.value = item.nomor || '';

        openModal('dataModal');
    }

    async function handleDelete() {
        if (!state.selectedRow) {
            showNotification('⚠️ Pilih data di tabel terlebih dahulu', 'warning');
            return;
        }

        const item = state.filteredData.find(d => d.row == state.selectedRow);
        if (!item) {
            showNotification('❌ Data tidak ditemukan', 'error');
            return;
        }

        const confirmMsg = `🗑️ *KONFIRMASI HAPUS*\\n\\n` +
            `Nama: *${(item.nama || 'N/A').substring(0, 20)}*\\n` +
            `Nomor: *${(item.nomor || 'N/A').substring(0, 15)}*\\n\\n` +
            `Klik tombol HAPUS di web untuk konfirmasi.`;

        await sendTelegramMessage(confirmMsg);

        const deleteInfo = document.getElementById('deleteInfo');
        if (deleteInfo) {
            deleteInfo.textContent = `${item.nama || 'N/A'} - ${item.nomor || 'N/A'}`;
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

        const action = row ? 'editData' : 'addData';
        const params = { nama, nomor };
        if (row) params.row = row;

        await sendTelegramMessage(
            `${row ? '✏️' : '➕'} *${row ? 'EDIT' : 'TAMBAH'} DATA*\\n\\n` +
            `Nama: *${nama}*\\n` +
            `Nomor: *${nomor}*\\n\\n` +
            `⏳ Menyimpan ke Google Sheets...`
        );

        const result = await makeRequest(action, params);
        
        if (result && result.success) {
            closeModal();
            
            await sendTelegramMessage(
                `✅ *BERHASIL*\\n\\n` +
                `Data berhasil ${row ? 'diupdate' : 'ditambahkan'}!\\n\\n` +
                `📋 *Detail:*\\n` +
                `Nama: *${nama}*\\n` +
                `Nomor: *${nomor}*\\n` +
                `${row ? `Row: ${row}` : `Row baru: ${result.row}`}\\n\\n` +
                `🕐 Waktu: ${new Date().toLocaleString('id-ID')}`
            );

            await handleSearch();
            showNotification(result.message || '✅ Data berhasil disimpan', 'success');
            
        } else if (result) {
            await sendTelegramMessage(`❌ Gagal menyimpan: ${result.error || 'Unknown error'}`);
            showNotification('❌ ' + (result.error || 'Gagal menyimpan data'), 'error');
        }
    }

    async function confirmDelete() {
        const row = state.selectedRow;
        
        const result = await makeRequest('deleteData', { row });
        
        if (result && result.success) {
            await sendTelegramMessage(
                `🗑️ *DATA BERHASIL DIHAPUS*\\n\\n` +
                `Row: ${row}\\n` +
                `🕐 Waktu: ${new Date().toLocaleString('id-ID')}`
            );

            closeModal();
            state.selectedRow = null;
            updateButtonStates();
            await handleSearch();
            showNotification(result.message || '✅ Data berhasil dihapus', 'success');
            
        } else if (result) {
            await sendTelegramMessage(`❌ Gagal menghapus: ${result.error || 'Unknown error'}`);
            showNotification('❌ ' + (result.error || 'Gagal menghapus data'), 'error');
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
                <tr class="n8n-empty-row">
                    <td colspan="4" class="n8n-empty-message">
                        <div class="empty-state">
                            <span class="empty-icon">📭</span>
                            <p>Belum ada data. Klik "Cari Data" untuk memuat dari Google Sheets.</p>
                        </div>
                    </td>
                </tr>
            `;
            updateButtonStates();
            return;
        }

        tbody.innerHTML = state.filteredData.map((item, index) => {
            const isSelected = state.selectedRow == item.row;
            return `
                <tr class="n8n-data-row ${isSelected ? 'selected' : ''}" data-row="${item.row}">
                    <td>${index + 1}</td>
                    <td>${escapeHtml(item.nama || '')}</td>
                    <td>${escapeHtml(item.nomor || '')}</td>
                    <td>
                        <button class="n8n-btn n8n-btn-sm n8n-btn-select ${isSelected ? 'selected' : ''}" data-row="${item.row}">
                            ${isSelected ? '✓' : '☐'}
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        tbody.querySelectorAll('.n8n-data-row').forEach(row => {
            row.addEventListener('click', (e) => {
                if (e.target.closest('.n8n-btn-select')) return;
                selectRow(parseInt(row.getAttribute('data-row')));
            });
        });

        tbody.querySelectorAll('.n8n-btn-select').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                selectRow(parseInt(btn.getAttribute('data-row')));
            });
        });

        updateButtonStates();
    }

    function selectRow(row) {
        state.selectedRow = state.selectedRow === row ? null : row;
        renderTable();
    }

    function updateButtonStates() {
        const hasSelection = state.selectedRow !== null;
        const btnEdit = document.getElementById('btnEdit');
        const btnDelete = document.getElementById('btnDelete');
        
        if (btnEdit) {
            btnEdit.disabled = !hasSelection;
            btnEdit.style.opacity = hasSelection ? '1' : '0.5';
        }
        if (btnDelete) {
            btnDelete.disabled = !hasSelection;
            btnDelete.style.opacity = hasSelection ? '1' : '0.5';
        }
    }

    function openModal(modalId) {
        const overlay = document.getElementById('modalOverlay');
        const modal = document.getElementById(modalId);
        
        if (overlay) overlay.style.display = 'flex';
        if (modal) {
            modal.style.display = 'block';
            const firstInput = modal.querySelector('input:not([type="hidden"])');
            if (firstInput) setTimeout(() => firstInput.focus(), 100);
        }
    }

    function closeModal() {
        const overlay = document.getElementById('modalOverlay');
        if (overlay) overlay.style.display = 'none';
        
        document.querySelectorAll('.n8n-modal').forEach(m => {
            m.style.display = 'none';
        });
    }

    // ============================================
    // GAS CODE GENERATOR - FIXED
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
  
  // CORS Headers yang benar untuk ContentService
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  
  try {
    // Validasi parameter
    if (!sheetId) throw new Error('Parameter sheetId diperlukan');
    if (!action) throw new Error('Parameter action diperlukan');

    const ss = SpreadsheetApp.openById(sheetId);
    let sheet = ss.getSheetByName(SHEET_NAME);

    // Auto-create sheet jika belum ada
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
          sheetExists: !!sheet,
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

        if (!namaAdd || !nomorAdd) {
          throw new Error('Parameter nama dan nomor diperlukan');
        }

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

        if (!rowEdit || isNaN(rowEdit) || rowEdit < 2) {
          throw new Error('Parameter row tidak valid');
        }
        if (!namaEdit || !nomorEdit) {
          throw new Error('Parameter nama dan nomor diperlukan');
        }

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

        if (!rowDel || isNaN(rowDel) || rowDel < 2) {
          throw new Error('Parameter row tidak valid');
        }

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
          error: 'Action tidak valid: ' + action,
          validActions: ['test', 'getData', 'addData', 'editData', 'deleteData']
        };
    }

    output.setContent(JSON.stringify(result));
    return output;

  } catch (error) {
    console.error('GAS Error:', error);
    const errorResult = { 
      success: false, 
      error: error.toString(),
      message: error.message
    };
    output.setContent(JSON.stringify(errorResult));
    return output;
  }
}

// Handle OPTIONS untuk CORS preflight
function doOptions(e) {
  const output = ContentService.createTextOutput('');
  return output;
}`;

        const editor = document.getElementById('gasCodeEditor');
        if (editor) {
            editor.value = code;
            console.log('[n8nModule] GAS code generated');
        }
    }

    function copyGASCode() {
        const textarea = document.getElementById('gasCodeEditor');
        if (!textarea?.value.trim()) {
            showNotification('⚠️ Generate kode GAS terlebih dahulu', 'warning');
            return;
        }

        textarea.select();
        textarea.setSelectionRange(0, 99999);
        
        try {
            navigator.clipboard.writeText(textarea.value).then(() => {
                showNotification('✅ Kode GAS berhasil dicopy!', 'success');
            }).catch(() => {
                document.execCommand('copy');
                showNotification('✅ Kode GAS dicopy!', 'success');
            });
        } catch (e) {
            document.execCommand('copy');
            showNotification('✅ Kode GAS dicopy!', 'success');
        }
    }

    // ============================================
    // TEST CONNECTIONS
    // ============================================

    async function testConnection() {
        const result = await makeRequest('test');
        
        if (result?.success) {
            const msg = `✅ ${result.message}\n📊 Sheets: ${(result.sheets || []).join(', ')}`;
            showNotification(msg, 'success');
            
            const statusInfo = document.getElementById('gasStatusInfo');
            if (statusInfo) {
                statusInfo.innerHTML = `
                    <div style="color: #4caf50; font-size: 12px; margin-top: 8px;">
                        ✅ Terhubung ke: ${result.targetSheet}<br>
                        📊 Total sheets: ${result.sheets?.length || 0}
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

        if (section.style.display === 'none') {
            section.style.display = 'block';
            arrow.textContent = '▲';
            const editor = document.getElementById('gasCodeEditor');
            if (editor && !editor.value.trim()) {
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
        // CRUD
        document.getElementById('btnSearch')?.addEventListener('click', handleSearch);
        document.getElementById('btnExecuteSearch')?.addEventListener('click', handleSearch);
        document.getElementById('btnAdd')?.addEventListener('click', handleAdd);
        document.getElementById('btnEdit')?.addEventListener('click', handleEdit);
        document.getElementById('btnDelete')?.addEventListener('click', handleDelete);

        // Config
        document.getElementById('btnToggleConfig')?.addEventListener('click', toggleConfig);
        document.getElementById('btnSaveConfig')?.addEventListener('click', saveConfig);
        document.getElementById('btnTestTelegram')?.addEventListener('click', getChatId);
        document.getElementById('btnTestGAS')?.addEventListener('click', testConnection);

        // GAS
        document.getElementById('btnGenerateGAS')?.addEventListener('click', generateGAS);
        document.getElementById('btnCopyGAS')?.addEventListener('click', copyGASCode);
        document.getElementById('btnOpenGAS')?.addEventListener('click', () => {
            window.open('https://script.google.com', '_blank');
        });

        // Modal
        document.getElementById('btnCloseModal')?.addEventListener('click', closeModal);
        document.getElementById('btnCancel')?.addEventListener('click', closeModal);
        document.getElementById('btnSave')?.addEventListener('click', saveData);
        document.getElementById('btnCancelDelete')?.addEventListener('click', closeModal);
        document.getElementById('btnConfirmDelete')?.addEventListener('click', confirmDelete);

        // Search on Enter
        document.getElementById('searchInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSearch();
        });

        // Close modal on overlay click
        document.getElementById('modalOverlay')?.addEventListener('click', (e) => {
            if (e.target.id === 'modalOverlay') closeModal();
        });

        // Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeModal();
        });
    }

    // ============================================
    // HTML TEMPLATE
    // ============================================

    function getHTML() {
        const isFile = isFileProtocol();
        
        const fileWarning = isFile ? `
            <div class="n8n-warning-banner">
                <div class="n8n-warning-title">⚠️ Mode File Lokal Terdeteksi</div>
                <div class="n8n-warning-text">
                    Anda membuka file langsung dari komputer. Beberapa fitur mungkin terbatas karena keamanan browser (CORS).
                    <br><br>
                    <strong>Solusi:</strong>
                    <ol>
                        <li>Gunakan <strong>Live Server</strong> di VS Code (klik kanan file → "Open with Live Server")</li>
                        <li>Upload ke <strong>GitHub Pages</strong> atau <strong>Netlify</strong></li>
                        <li>Tekan tombol <strong>🔄 Rotate Proxy</strong> jika koneksi gagal</li>
                    </ol>
                </div>
            </div>
        ` : '';

        return `
            <div class="n8n-container">
                ${fileWarning}
                
                <div class="n8n-header">
                    <h2>🔍 N8N Data Management</h2>
                    <p>Kelola data via Telegram Bridge → Google Sheets</p>
                </div>

                <!-- TELEGRAM STATUS CARD -->
                <div class="n8n-telegram-card">
                    <div class="n8n-telegram-header">
                        <div>
                            <div class="n8n-telegram-title">📱 Status Telegram</div>
                            <div class="n8n-telegram-status" id="telegramStatusText">
                                ${state.config.botToken ? '⏳ Menunggu koneksi...' : '⚠️ Belum dikonfigurasi'}
                            </div>
                        </div>
                        <div class="n8n-telegram-actions">
                            ${isFile ? `
                            <button class="n8n-btn n8n-btn-secondary" onclick="n8nModule.rotateProxy()">
                                🔄 Rotate Proxy
                            </button>
                            ` : ''}
                            <button class="n8n-btn n8n-btn-primary" onclick="n8nModule.testTelegramConnection()">
                                🔄 Test Koneksi
                            </button>
                        </div>
                    </div>
                </div>

                <!-- CRUD BUTTONS -->
                <div class="n8n-crud-section">
                    <div class="n8n-action-bar">
                        <button class="n8n-btn n8n-btn-primary" id="btnSearch">
                            <span class="icon">🔍</span>
                            <span>Cari Data</span>
                        </button>
                        <button class="n8n-btn n8n-btn-success" id="btnAdd">
                            <span class="icon">➕</span>
                            <span>Tambah Data</span>
                        </button>
                        <button class="n8n-btn n8n-btn-warning" id="btnEdit" disabled>
                            <span class="icon">✏️</span>
                            <span>Edit Data</span>
                        </button>
                        <button class="n8n-btn n8n-btn-danger" id="btnDelete" disabled>
                            <span class="icon">🗑️</span>
                            <span>Hapus Data</span>
                        </button>
                    </div>

                    <div class="n8n-search-box">
                        <input type="text" id="searchInput" class="n8n-input" placeholder="Ketik nama atau nomor untuk mencari...">
                        <button class="n8n-btn n8n-btn-primary" id="btnExecuteSearch">
                            <span class="icon">🔍</span>
                        </button>
                    </div>
                </div>

                <!-- DATA TABLE -->
                <div class="n8n-data-section">
                    <div class="n8n-table-container">
                        <table class="n8n-table" id="dataTable">
                            <thead>
                                <tr>
                                    <th style="width: 50px;">No</th>
                                    <th>NAMA</th>
                                    <th>NOMOR</th>
                                    <th style="width: 80px;">Pilih</th>
                                </tr>
                            </thead>
                            <tbody id="tableBody">
                                <tr class="n8n-empty-row">
                                    <td colspan="4" class="n8n-empty-message">
                                        <div class="empty-state">
                                            <span class="empty-icon">📭</span>
                                            <p>Belum ada data. Klik "Cari Data" untuk memuat dari Google Sheets.</p>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- CONFIG TOGGLE -->
                <div class="n8n-config-toggle">
                    <button class="n8n-btn n8n-btn-ghost" id="btnToggleConfig">
                        <span class="icon">⚙️</span>
                        <span>Konfigurasi Telegram & GAS</span>
                        <span class="toggle-arrow" id="configArrow">▼</span>
                    </button>
                </div>

                <!-- CONFIGURATION SECTION -->
                <div class="n8n-config-section" id="configSection" style="display: none;">
                    
                    <!-- STEP 1: TELEGRAM -->
                    <div class="n8n-config-card">
                        <div class="n8n-step-header">
                            <span class="n8n-step-number">1</span>
                            <h3>📱 Konfigurasi Telegram Bot</h3>
                        </div>
                        
                        <div class="n8n-form-group">
                            <label>Bot Token <span class="required">*</span></label>
                            <input type="password" id="botToken" class="n8n-input" placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz">
                            <small>Dapatkan dari @BotFather di Telegram</small>
                        </div>

                        <div class="n8n-form-group">
                            <label>Chat ID (Auto-detect)</label>
                            <input type="text" id="chatId" class="n8n-input" placeholder="Kirim pesan ke bot, lalu klik Test" readonly>
                            <small>ID chat akan terdeteksi otomatis saat test koneksi</small>
                        </div>

                        <div class="n8n-config-actions">
                            <button class="n8n-btn n8n-btn-secondary" id="btnTestTelegram">
                                <span class="icon">📱</span>
                                <span>Test & Dapatkan Chat ID</span>
                            </button>
                        </div>
                    </div>

                    <!-- STEP 2: GOOGLE SHEETS -->
                    <div class="n8n-config-card">
                        <div class="n8n-step-header">
                            <span class="n8n-step-number">2</span>
                            <h3>⚙️ Pengaturan Google Sheets</h3>
                        </div>

                        <div class="n8n-form-group">
                            <label>Google Sheet ID <span class="required">*</span></label>
                            <input type="text" id="sheetId" class="n8n-input" placeholder="1cPolj_xpBztq6RU3XVi_CZm1j_Kqo-zQC-wsbIYrLXE">
                            <small>ID dari URL spreadsheet (copy dari browser)</small>
                        </div>

                        <div class="n8n-form-group">
                            <label>Sheet Name</label>
                            <input type="text" id="sheetName" class="n8n-input" placeholder="Data Base Hifzi Cell">
                            <small>Nama tab/sheet di spreadsheet</small>
                        </div>

                        <div class="n8n-form-group">
                            <label>GAS Web App URL <span class="required">*</span></label>
                            <input type="text" id="gasUrl" class="n8n-input" placeholder="https://script.google.com/macros/s/XXXX/exec">
                            <small>URL dari deployment Web App Google Apps Script</small>
                            <div id="gasStatusInfo"></div>
                        </div>

                        <div class="n8n-config-actions">
                            <button class="n8n-btn n8n-btn-secondary" id="btnTestGAS">
                                <span class="icon">🔗</span>
                                <span>Test Koneksi GAS</span>
                            </button>
                            <button class="n8n-btn n8n-btn-primary" id="btnSaveConfig">
                                <span class="icon">💾</span>
                                <span>Simpan Konfigurasi</span>
                            </button>
                        </div>
                    </div>

                    <!-- STEP 3: GAS CODE -->
                    <div class="n8n-config-card">
                        <div class="n8n-step-header">
                            <span class="n8n-step-number">3</span>
                            <h3>📜 Generate Kode GAS (Otomatis)</h3>
                        </div>
                        
                        <div class="n8n-gas-actions">
                            <button class="n8n-btn n8n-btn-secondary" id="btnGenerateGAS">
                                <span class="icon">🔄</span>
                                <span>Regenerate</span>
                            </button>
                            <button class="n8n-btn n8n-btn-success" id="btnCopyGAS">
                                <span class="icon">📋</span>
                                <span>Copy Kode</span>
                            </button>
                            <button class="n8n-btn n8n-btn-primary" id="btnOpenGAS">
                                <span class="icon">🚀</span>
                                <span>Buka GAS Editor</span>
                            </button>
                        </div>

                        <textarea id="gasCodeEditor" class="n8n-textarea" readonly placeholder="Klik 'Regenerate' untuk generate kode GAS..."></textarea>
                        
                        <div class="n8n-gas-tips">
                            <strong>💡 Tips Deploy:</strong>
                            <ol>
                                <li>Copy kode di atas → Paste ke <a href="https://script.google.com" target="_blank">script.google.com</a></li>
                                <li>Save (Ctrl+S) → Deploy → New deployment</li>
                                <li>Type: Web App | Execute as: Me | Access: <strong>ANYONE</strong></li>
                                <li>Copy URL Web App → Paste ke field "GAS Web App URL" di atas</li>
                            </ol>
                        </div>
                    </div>
                </div>

                <!-- STATUS BAR -->
                <div class="n8n-status-bar" id="statusBar">
                    <span class="status-text">Siap</span>
                    <span class="status-badge" id="statusBadge">🟢</span>
                </div>
            </div>

            <!-- MODALS -->
            <div class="n8n-modal-overlay" id="modalOverlay" style="display: none;">
                
                <!-- Add/Edit Modal -->
                <div class="n8n-modal" id="dataModal" style="display: none;">
                    <div class="n8n-modal-header">
                        <h3 id="modalTitle">Tambah Data</h3>
                        <button class="n8n-modal-close" id="btnCloseModal">&times;</button>
                    </div>
                    <div class="n8n-modal-body">
                        <input type="hidden" id="editId">
                        <div class="n8n-form-group">
                            <label>Nama <span class="required">*</span></label>
                            <input type="text" id="inputNama" class="n8n-input" placeholder="Masukkan nama lengkap">
                        </div>
                        <div class="n8n-form-group">
                            <label>Nomor <span class="required">*</span></label>
                            <input type="text" id="inputNomor" class="n8n-input" placeholder="Masukkan nomor telepon/HP">
                        </div>
                    </div>
                    <div class="n8n-modal-footer">
                        <button class="n8n-btn n8n-btn-ghost" id="btnCancel">Batal</button>
                        <button class="n8n-btn n8n-btn-primary" id="btnSave">
                            💾 Simpan & Notifikasi Telegram
                        </button>
                    </div>
                </div>

                <!-- Delete Modal -->
                <div class="n8n-modal n8n-modal-small" id="deleteModal" style="display: none;">
                    <div class="n8n-modal-header" style="background: linear-gradient(135deg, #ff7675 0%, #d63031 100%);">
                        <h3>⚠️ Konfirmasi Hapus</h3>
                    </div>
                    <div class="n8n-modal-body">
                        <p>Apakah Anda yakin ingin menghapus data ini?</p>
                        <p class="delete-info" id="deleteInfo"></p>
                        <p style="font-size: 12px; color: #666; margin-top: 10px;">
                            💡 Notifikasi juga akan dikirim ke Telegram.
                        </p>
                    </div>
                    <div class="n8n-modal-footer">
                        <button class="n8n-btn n8n-btn-ghost" id="btnCancelDelete">Batal</button>
                        <button class="n8n-btn n8n-btn-danger" id="btnConfirmDelete">🗑️ Hapus</button>
                    </div>
                </div>
            </div>

            <!-- NOTIFICATION -->
            <div class="n8n-notification" id="notification"></div>
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

        if (isFileProtocol()) {
            console.warn('[n8nModule] Running from file:// protocol - CORS proxy enabled');
            state.proxyMode = true;
        }

        mainContent.innerHTML = getHTML();
        attachEventListeners();
        setFormValues();
        
        if (state.config.sheetName) {
            generateGAS();
        }
        
        if (state.config.botToken && !state.config.chatId) {
            console.log('[n8nModule] Auto-detecting Chat ID...');
            setTimeout(() => getChatId(), 1500);
        }
    }

    // ============================================
    // PUBLIC API
    // ============================================

    return {
        init: function() {
            console.log('[n8nModule] ✅ N8N Telegram Bridge v2.1 Loaded');
            loadConfig();
        },
        
        renderPage: renderPage,
        
        // Exposed functions
        testTelegramConnection: testTelegramConnection,
        testConnection: testConnection,
        rotateProxy: function() {
            rotateProxy();
            showNotification(`🔄 Proxy rotated [${state.currentProxyIndex + 1}/${PROXY_LIST.length}]`, 'info');
        },
        handleSearch: handleSearch,
        handleAdd: handleAdd,
        handleEdit: handleEdit,
        handleDelete: handleDelete,
        getConfig: function() { return state.config; },
        saveConfig: saveConfig
    };

})();

// Auto-init hanya jika belum di-init
if (typeof n8nModule !== 'undefined' && !window.n8nInitialized) {
    window.n8nInitialized = true;
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => n8nModule.init());
    } else {
        n8nModule.init();
    }
}

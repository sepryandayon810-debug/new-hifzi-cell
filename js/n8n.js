// ============================================
// N8N DATA MANAGEMENT MODULE - TELEGRAM BRIDGE
// ============================================
// FIX CORS: Multi-proxy support untuk file:// protocol

(function() {
    'use strict';

    const n8nModule = {
        state: {
            data: [],
            filteredData: [],
            selectedRow: null,
            config: {
                botToken: localStorage.getItem('n8n_bot_token') || '',
                chatId: localStorage.getItem('n8n_chat_id') || '',
                sheetId: localStorage.getItem('n8n_sheet_id') || '',
                sheetName: localStorage.getItem('n8n_sheet_name') || 'Data Base Hifzi Cell',
                gasUrl: localStorage.getItem('n8n_gas_url') || ''
            },
            configVisible: false,
            isLoading: false,
            proxyMode: false
        },

        // ============================================
        // CORS PROXY CONFIGURATION
        // ============================================
        
        PROXY_LIST: [
            'https://api.allorigins.win/get?url=',
            'https://api.codetabs.com/v1/proxy?quest=',
            'https://thingproxy.freeboard.io/fetch/',
            'https://corsproxy.io/?'
        ],

        currentProxyIndex: 0,

        getProxyUrl() {
            return this.PROXY_LIST[this.currentProxyIndex];
        },

        rotateProxy() {
            this.currentProxyIndex = (this.currentProxyIndex + 1) % this.PROXY_LIST.length;
            console.log(`[n8nModule] Rotating to proxy: ${this.getProxyUrl()}`);
        },

        isFileProtocol() {
            return window.location.protocol === 'file:';
        },

        init() {
            console.log('[n8nModule] ✅ Telegram Bridge Version Loaded');
            console.log('[n8nModule] Protocol:', window.location.protocol);
            
            this.loadConfig();
            this.bindMethods();
            
            if (this.isFileProtocol()) {
                console.warn('[n8nModule] Running from file:// - CORS proxy mode enabled');
                this.state.proxyMode = true;
            }
        },

        bindMethods() {
            const methods = [
                'handleSearch', 'handleAdd', 'handleEdit', 'handleDelete',
                'toggleConfig', 'saveConfig', 'testConnection', 'testTelegramConnection',
                'sendTelegramMessage', 'getTelegramUpdates', 'getChatId',
                'selectRow', 'renderTable', 'makeRequest', 'fetchWithProxy'
            ];
            methods.forEach(m => this[m] = this[m].bind(this));
        },

        loadConfig() {
            const saved = localStorage.getItem('n8n_config');
            if (saved) {
                try {
                    const config = JSON.parse(saved);
                    this.state.config = { ...this.state.config, ...config };
                } catch(e) {
                    console.error('[n8nModule] Error loading config:', e);
                }
            }
        },

        saveConfig() {
            const inputs = {
                botToken: document.getElementById('botToken')?.value.trim() || '',
                chatId: document.getElementById('chatId')?.value.trim() || '',
                sheetId: document.getElementById('sheetId')?.value.trim() || '',
                sheetName: document.getElementById('sheetName')?.value.trim() || 'Data Base Hifzi Cell',
                gasUrl: document.getElementById('gasUrl')?.value.trim() || ''
            };

            this.state.config = inputs;
            localStorage.setItem('n8n_config', JSON.stringify(inputs));
            localStorage.setItem('n8n_bot_token', inputs.botToken);
            localStorage.setItem('n8n_chat_id', inputs.chatId);
            localStorage.setItem('n8n_sheet_id', inputs.sheetId);
            localStorage.setItem('n8n_sheet_name', inputs.sheetName);
            localStorage.setItem('n8n_gas_url', inputs.gasUrl);

            this.showNotification('✅ Konfigurasi tersimpan!', 'success');
            
            if (inputs.botToken) {
                setTimeout(() => this.getChatId(), 500);
            }
        },

        // ============================================
        // FETCH WITH CORS PROXY HANDLER
        // ============================================

        async fetchWithProxy(url, options = {}, retryCount = 0) {
            const MAX_RETRIES = this.PROXY_LIST.length;

            // Jika bukan file protocol, fetch langsung
            if (!this.isFileProtocol()) {
                return fetch(url, options);
            }

            // Untuk file:// protocol, gunakan proxy
            const proxyUrl = this.getProxyUrl();
            const encodedUrl = encodeURIComponent(url);
            const fullUrl = `${proxyUrl}${encodedUrl}`;

            console.log(`[Proxy] Using: ${proxyUrl.split('?')[0]}...`);

            try {
                const proxyOptions = {
                    method: 'GET', // Proxy hanya support GET
                    headers: {
                        'Accept': 'application/json'
                    }
                };

                const response = await fetch(fullUrl, proxyOptions);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                // Parse proxy response format
                const proxyData = await response.json();
                
                // Different proxies have different response formats
                let finalData;
                if (proxyData.contents) {
                    // allorigins format
                    finalData = JSON.parse(proxyData.contents);
                } else if (proxyData.body) {
                    // codetabs format
                    finalData = JSON.parse(proxyData.body);
                } else {
                    // Direct response
                    finalData = proxyData;
                }

                // Create a synthetic Response object
                return {
                    ok: true,
                    status: 200,
                    json: async () => finalData,
                    text: async () => JSON.stringify(finalData)
                };

            } catch (error) {
                console.error(`[Proxy] Error with ${proxyUrl}:`, error);
                
                if (retryCount < MAX_RETRIES - 1) {
                    this.rotateProxy();
                    return this.fetchWithProxy(url, options, retryCount + 1);
                }
                
                throw error;
            }
        },

        // ============================================
        // TELEGRAM INTEGRATION
        // ============================================

        async sendTelegramMessage(text, options = {}) {
            const { botToken, chatId } = this.state.config;
            
            if (!botToken || !chatId) {
                this.showNotification('⚠️ Bot Token dan Chat ID harus diisi!', 'warning');
                return null;
            }

            try {
                const apiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
                
                // Build URL with query params untuk GET request (support proxy)
                const params = new URLSearchParams({
                    chat_id: chatId,
                    text: text,
                    parse_mode: 'Markdown',
                    ...options
                });

                const fullUrl = `${apiUrl}?${params.toString()}`;
                const response = await this.fetchWithProxy(fullUrl);
                return await response.json();

            } catch (error) {
                console.error('[Telegram] Send message error:', error);
                return null;
            }
        },

        async getTelegramUpdates() {
            const { botToken } = this.state.config;
            
            if (!botToken) {
                this.showNotification('⚠️ Bot Token belum diisi!', 'warning');
                return null;
            }

            this.setStatus('🟡', 'Mengambil updates dari Telegram...');

            try {
                const apiUrl = `https://api.telegram.org/bot${botToken}/getUpdates?limit=10`;
                const response = await this.fetchWithProxy(apiUrl);
                return await response.json();

            } catch (error) {
                console.error('[Telegram] Get updates error:', error);
                this.setStatus('🔴', 'Error koneksi Telegram');
                return null;
            }
        },

        async getChatId() {
            const { botToken } = this.state.config;
            
            if (!botToken) {
                this.showNotification('⚠️ Isi Bot Token dulu!', 'warning');
                return;
            }

            this.setStatus('🟡', 'Mendeteksi Chat ID...');

            try {
                const result = await this.getTelegramUpdates();
                
                if (result && result.ok && result.result.length > 0) {
                    const latest = result.result[result.result.length - 1];
                    const chatId = latest.message?.chat?.id || 
                                   latest.callback_query?.message?.chat?.id ||
                                   latest.edited_message?.chat?.id;
                    
                    if (chatId) {
                        this.state.config.chatId = chatId;
                        const chatInput = document.getElementById('chatId');
                        if (chatInput) chatInput.value = chatId;
                        this.saveConfig();
                        this.showNotification(`✅ Chat ID terdeteksi: ${chatId}`, 'success');
                        this.setStatus('🟢', 'Terhubung ke Telegram');
                        return chatId;
                    }
                }
                
                this.showNotification('ℹ️ Kirim pesan ke bot dulu, lalu test lagi', 'info');
                this.setStatus('🟡', 'Menunggu pesan dari bot');
                
            } catch (error) {
                console.error('[Telegram] Get Chat ID error:', error);
                this.showNotification('❌ Gagal mendeteksi Chat ID. Coba proxy lain.', 'error');
                this.setStatus('🔴', 'Error');
            }
        },

        // ============================================
        // GOOGLE APPS SCRIPT API
        // ============================================

        async makeRequest(action, params = {}) {
            const { gasUrl, sheetId } = this.state.config;
            
            if (!gasUrl || !sheetId) {
                this.showNotification('⚠️ Sheet ID dan GAS URL harus diisi!', 'warning');
                return null;
            }

            // Build URL dengan query params
            const url = new URL(gasUrl);
            url.searchParams.append('action', action);
            url.searchParams.append('sheetId', sheetId);

            for (let key in params) {
                if (params[key] !== undefined && params[key] !== null) {
                    url.searchParams.append(key, params[key]);
                }
            }

            console.log('[n8nModule] Request:', url.toString());

            try {
                this.setStatus('🟡', 'Loading...');

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000);

                const response = await this.fetchWithProxy(url.toString());
                
                clearTimeout(timeoutId);

                const data = await response.json();
                console.log('[n8nModule] Response:', data);

                this.setStatus('🟢', 'Siap');
                return data;
                
            } catch (error) {
                console.error('[n8nModule] Error:', error);
                this.setStatus('🔴', 'Error');

                let errorMsg = 'Gagal terhubung ke server';
                let solution = '';

                if (error.name === 'AbortError') {
                    errorMsg = 'Request timeout (30s)';
                    solution = 'Coba lagi atau cek koneksi internet';
                } else if (this.isFileProtocol()) {
                    errorMsg = 'CORS Error (File Protocol)';
                    solution = 'Solusi:\n1. Upload ke web server (GitHub Pages/Netlify)\n2. Gunakan Live Server di VS Code\n3. Atau coba refresh halaman';
                } else if (error.message.includes('404')) {
                    errorMsg = 'GAS URL tidak ditemukan';
                    solution = 'Cek URL GAS atau deploy ulang';
                }

                this.showNotification(`❌ ${errorMsg}\n${solution}`, 'error', 8000);
                return null;
            }
        },

        // ============================================
        // CRUD OPERATIONS
        // ============================================

        async handleSearch() {
            const keyword = document.getElementById('searchInput')?.value.toLowerCase().trim() || '';
            
            // Notifikasi ke Telegram
            await this.sendTelegramMessage(
                `🔍 *PENCARIAN DATA*\n\nKeyword: ${keyword || 'Semua data'}\nWaktu: ${new Date().toLocaleString('id-ID')}`
            );

            const result = await this.makeRequest('getData');
            
            if (!result) {
                await this.sendTelegramMessage('❌ Gagal mengambil data dari Google Sheets');
                return;
            }

            if (!result.success) {
                await this.sendTelegramMessage(`❌ Error: ${result.error || 'Unknown error'}`);
                return;
            }

            this.state.data = result.data || [];

            if (keyword) {
                this.state.filteredData = this.state.data.filter(item => 
                    (item.nama && item.nama.toLowerCase().includes(keyword)) || 
                    (item.nomor && item.nomor.toLowerCase().includes(keyword))
                );
            } else {
                this.state.filteredData = this.state.data;
            }

            this.renderTable();

            const count = this.state.filteredData.length;
            let message = `✅ *PENCARIAN SELESAI*\n\nDitemukan: *${count} data*\nKeyword: *${keyword || '-'}*\n\n`;
            
            if (count > 0) {
                message += `*Hasil (5 teratas):*\n`;
                this.state.filteredData.slice(0, 5).forEach((item, idx) => {
                    message += `${idx + 1}. ${item.nama || 'N/A'} - ${item.nomor || 'N/A'}\n`;
                });
                if (count > 5) message += `\n...dan ${count - 5} data lainnya`;
            } else {
                message += `❌ Tidak ada data yang cocok`;
            }

            await this.sendTelegramMessage(message);
            this.showNotification(`✅ ${count} data ditemukan`, 'success');
        },

        async handleAdd() {
            document.getElementById('modalTitle').textContent = 'Tambah Data (via Telegram)';
            document.getElementById('editId').value = '';
            document.getElementById('inputNama').value = '';
            document.getElementById('inputNomor').value = '';
            this.openModal('dataModal');
        },

        async handleEdit() {
            if (!this.state.selectedRow) {
                this.showNotification('⚠️ Pilih data di tabel terlebih dahulu', 'warning');
                return;
            }

            const item = this.state.filteredData.find(d => d.row == this.state.selectedRow);
            if (!item) {
                this.showNotification('❌ Data tidak ditemukan', 'error');
                return;
            }

            document.getElementById('modalTitle').textContent = 'Edit Data (via Telegram)';
            document.getElementById('editId').value = item.row;
            document.getElementById('inputNama').value = item.nama || '';
            document.getElementById('inputNomor').value = item.nomor || '';
            this.openModal('dataModal');
        },

        async handleDelete() {
            if (!this.state.selectedRow) {
                this.showNotification('⚠️ Pilih data di tabel terlebih dahulu', 'warning');
                return;
            }

            const item = this.state.filteredData.find(d => d.row == this.state.selectedRow);
            if (!item) {
                this.showNotification('❌ Data tidak ditemukan', 'error');
                return;
            }

            const confirmMsg = `🗑️ *KONFIRMASI HAPUS*\n\nNama: *${item.nama || 'N/A'}*\nNomor: *${item.nomor || 'N/A'}*\n\nKlik tombol di web untuk konfirmasi.`;

            await this.sendTelegramMessage(confirmMsg);

            document.getElementById('deleteInfo').textContent = `${item.nama || 'N/A'} - ${item.nomor || 'N/A'}`;
            this.openModal('deleteModal');
        },

        async saveData() {
            const row = document.getElementById('editId').value;
            const nama = document.getElementById('inputNama').value.trim();
            const nomor = document.getElementById('inputNomor').value.trim();

            if (!nama || !nomor) {
                this.showNotification('⚠️ Nama dan Nomor wajib diisi!', 'warning');
                return;
            }

            const action = row ? 'editData' : 'addData';
            const params = { nama, nomor };
            if (row) params.row = row;

            await this.sendTelegramMessage(
                `${row ? '✏️' : '➕'} *${row ? 'EDIT' : 'TAMBAH'} DATA*\n\nNama: *${nama}*\nNomor: *${nomor}*\n\n⏳ Menyimpan...`
            );

            const result = await this.makeRequest(action, params);
            
            if (result && result.success) {
                this.closeModal();
                
                await this.sendTelegramMessage(
                    `✅ *BERHASIL*\n\nData ${row ? 'diupdate' : 'ditambahkan'}!\nNama: *${nama}*\nNomor: *${nomor}*\nWaktu: ${new Date().toLocaleString('id-ID')}`
                );

                this.handleSearch();
                this.showNotification(result.message || '✅ Data tersimpan', 'success');
            } else if (result) {
                await this.sendTelegramMessage(`❌ Gagal: ${result.error || 'Unknown error'}`);
                this.showNotification('❌ ' + (result.error || 'Gagal menyimpan'), 'error');
            }
        },

        async confirmDelete() {
            const row = this.state.selectedRow;
            
            const result = await this.makeRequest('deleteData', { row });
            
            if (result && result.success) {
                await this.sendTelegramMessage(
                    `🗑️ *DATA DIHAPUS*\n\nRow: ${row}\nWaktu: ${new Date().toLocaleString('id-ID')}`
                );

                this.closeModal();
                this.state.selectedRow = null;
                this.updateButtonStates();
                this.handleSearch();
                this.showNotification(result.message || '✅ Data dihapus', 'success');
            } else if (result) {
                await this.sendTelegramMessage(`❌ Gagal menghapus: ${result.error || 'Unknown error'}`);
                this.showNotification('❌ ' + (result.error || 'Gagal menghapus'), 'error');
            }
        },

        // ============================================
        // UI RENDERING
        // ============================================

        renderPage() {
            const mainContent = document.getElementById('mainContent');
            if (!mainContent) {
                console.error('[n8nModule] mainContent not found');
                return;
            }

            mainContent.innerHTML = this.getHTML();
            this.attachEventListeners();
            this.setFormValues();
            
            if (!this.state.config.gasUrl) {
                this.generateGAS();
            }
        },

        setFormValues() {
            const fields = ['sheetId', 'sheetName', 'gasUrl', 'botToken', 'chatId'];
            fields.forEach(field => {
                const el = document.getElementById(field);
                if (el) el.value = this.state.config[field] || '';
            });
        },

        getHTML() {
            const isFile = this.isFileProtocol();
            const warningBanner = isFile ? `
                <div style="background: #fff3e0; border: 2px solid #ff9800; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
                    <div style="color: #e65100; font-weight: 600; margin-bottom: 8px;">
                        ⚠️ Mode File Lokal Terdeteksi
                    </div>
                    <div style="color: #e65100; font-size: 13px; margin-bottom: 12px;">
                        Anda membuka file langsung dari komputer. Beberapa fitur mungkin terbatas karena keamanan browser (CORS).
                        <br><br>
                        <strong>Solusi:</strong>
                        <ol style="margin: 8px 0; padding-left: 20px;">
                            <li>Gunakan <strong>Live Server</strong> di VS Code (klik kanan file → "Open with Live Server")</li>
                            <li>Upload ke <strong>GitHub Pages</strong> atau <strong>Netlify</strong></li>
                            <li>Atau gunakan proxy di bawah (tidak 100% stabil)</li>
                        </ol>
                    </div>
                </div>
            ` : '';

            return `
                <div class="n8n-container">
                    ${warningBanner}
                    
                    <div class="n8n-header">
                        <h2>🔍 N8N Data Management</h2>
                        <p>Kelola data via Telegram Bridge → Google Sheets</p>
                    </div>

                    <!-- TELEGRAM STATUS -->
                    <div class="n8n-telegram-status" style="background: linear-gradient(135deg, #0088cc 0%, #005580 100%); color: white; padding: 16px; border-radius: 12px; margin-bottom: 20px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div style="font-size: 18px; font-weight: 600; margin-bottom: 4px;">
                                    📱 Status Telegram
                                </div>
                                <div style="font-size: 13px; opacity: 0.9;" id="telegramStatusText">
                                    ${this.state.config.botToken ? '⏳ Menunggu koneksi...' : '⚠️ Belum dikonfigurasi'}
                                </div>
                            </div>
                            <div style="display: flex; gap: 8px;">
                                ${isFile ? `
                                <button onclick="n8nModule.rotateProxy(); n8nModule.showNotification('🔄 Proxy rotated', 'success')" 
                                        style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); 
                                               color: white; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 12px;">
                                    🔄 Rotate Proxy
                                </button>
                                ` : ''}
                                <button onclick="n8nModule.testTelegramConnection()" 
                                        style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); 
                                               color: white; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 13px;">
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
                                <span>Cari Data (Telegram)</span>
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
                                                <p>Belum ada data. Klik "Cari Data" untuk memuat.</p>
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
                        
                        <!-- TELEGRAM CONFIG -->
                        <div class="n8n-config-card">
                            <div class="step-header">
                                <span class="step-number">1</span>
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

                        <!-- GOOGLE SHEETS CONFIG -->
                        <div class="n8n-config-card">
                            <div class="step-header">
                                <span class="step-number">2</span>
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
                            </div>

                            <div class="n8n-config-actions">
                                <button class="n8n-btn n8n-btn-secondary" id="btnTestGAS">
                                    <span class="icon">🔗</span>
                                    <span>Test Koneksi GAS</span>
                                </button>
                                <button class="n8n-btn n8n-btn-primary" id="btnSaveConfig">
                                    <span class="icon">💾</span>
                                    <span>Simpan Semua Konfigurasi</span>
                                </button>
                            </div>
                        </div>

                        <!-- GAS CODE GENERATOR -->
                        <div class="n8n-config-card">
                            <div class="step-header">
                                <span class="step-number">3</span>
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

                            <textarea id="gasCodeEditor" class="n8n-textarea" readonly style="min-height: 300px; font-family: monospace; font-size: 12px;"></textarea>
                        </div>
                    </div>

                    <div class="n8n-status-bar" id="statusBar">
                        <span class="status-text">Siap</span>
                        <span class="status-badge" id="statusBadge">🟢</span>
                    </div>
                </div>

                <!-- MODALS -->
                <div class="n8n-modal-overlay" id="modalOverlay" style="display: none;">
                    <div class="n8n-modal" id="dataModal" style="display: none;">
                        <div class="n8n-modal-header">
                            <h3 id="modalTitle">Tambah Data</h3>
                            <button class="n8n-modal-close" id="btnCloseModal">&times;</button>
                        </div>
                        <div class="n8n-modal-body">
                            <input type="hidden" id="editId">
                            <div class="n8n-form-group">
                                <label>Nama <span class="required">*</span></label>
                                <input type="text" id="inputNama" class="n8n-input" placeholder="Masukkan nama">
                            </div>
                            <div class="n8n-form-group">
                                <label>Nomor <span class="required">*</span></label>
                                <input type="text" id="inputNomor" class="n8n-input" placeholder="Masukkan nomor">
                            </div>
                        </div>
                        <div class="n8n-modal-footer">
                            <button class="n8n-btn n8n-btn-ghost" id="btnCancel">Batal</button>
                            <button class="n8n-btn n8n-btn-primary" id="btnSave">Simpan & Notifikasi Telegram</button>
                        </div>
                    </div>

                    <div class="n8n-modal n8n-modal-small" id="deleteModal" style="display: none;">
                        <div class="n8n-modal-header" style="background: linear-gradient(135deg, #ff7675 0%, #d63031 100%);">
                            <h3>⚠️ Konfirmasi Hapus</h3>
                        </div>
                        <div class="n8n-modal-body">
                            <p>Apakah Anda yakin ingin menghapus data ini?</p>
                            <p class="delete-info" id="deleteInfo" style="background: rgba(214, 48, 49, 0.1); padding: 10px; border-radius: 8px; margin-top: 10px; font-weight: 600; color: #d63031;"></p>
                        </div>
                        <div class="n8n-modal-footer">
                            <button class="n8n-btn n8n-btn-ghost" id="btnCancelDelete">Batal</button>
                            <button class="n8n-btn n8n-btn-danger" id="btnConfirmDelete">Hapus</button>
                        </div>
                    </div>
                </div>

                <div class="n8n-notification" id="notification"></div>
            `;
        },

        attachEventListeners() {
            // CRUD
            document.getElementById('btnSearch')?.addEventListener('click', this.handleSearch);
            document.getElementById('btnExecuteSearch')?.addEventListener('click', this.handleSearch);
            document.getElementById('btnAdd')?.addEventListener('click', this.handleAdd);
            document.getElementById('btnEdit')?.addEventListener('click', this.handleEdit);
            document.getElementById('btnDelete')?.addEventListener('click', this.handleDelete);

            // Config
            document.getElementById('btnToggleConfig')?.addEventListener('click', this.toggleConfig);
            document.getElementById('btnSaveConfig')?.addEventListener('click', this.saveConfig);
            document.getElementById('btnTestTelegram')?.addEventListener('click', this.getChatId);
            document.getElementById('btnTestGAS')?.addEventListener('click', this.testConnection);

            // GAS
            document.getElementById('btnGenerateGAS')?.addEventListener('click', () => this.generateGAS());
            document.getElementById('btnCopyGAS')?.addEventListener('click', () => this.copyGASCode());
            document.getElementById('btnOpenGAS')?.addEventListener('click', () => window.open('https://script.google.com', '_blank'));

            // Modal
            document.getElementById('btnCloseModal')?.addEventListener('click', this.closeModal);
            document.getElementById('btnCancel')?.addEventListener('click', this.closeModal);
            document.getElementById('btnSave')?.addEventListener('click', () => this.saveData());
            document.getElementById('btnCancelDelete')?.addEventListener('click', this.closeModal);
            document.getElementById('btnConfirmDelete')?.addEventListener('click', () => this.confirmDelete());

            // Search on Enter
            document.getElementById('searchInput')?.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleSearch();
            });
        },

        toggleConfig() {
            const section = document.getElementById('configSection');
            const arrow = document.getElementById('configArrow');
            if (section.style.display === 'none') {
                section.style.display = 'block';
                arrow.textContent = '▲';
            } else {
                section.style.display = 'none';
                arrow.textContent = '▼';
            }
        },

        generateGAS() {
            const sheetName = this.state.config.sheetName || 'Data Base Hifzi Cell';
            const code = `// GAS Code untuk ${sheetName}
// Auto-generated: ${new Date().toLocaleString()}

const SHEET_NAME = '${sheetName}';

function doGet(e) {
  const action = e.parameter.action;
  const sheetId = e.parameter.sheetId;
  
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  try {
    if (!sheetId) throw new Error('sheetId required');
    if (!action) throw new Error('action required');

    const ss = SpreadsheetApp.openById(sheetId);
    let sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow(['NAMA', 'NOMOR']);
      sheet.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#4caf50').setFontColor('white');
    }

    let result = { success: false };

    switch(action) {
      case 'test':
        result = { 
          success: true, 
          message: 'Koneksi berhasil',
          sheets: ss.getSheets().map(s => s.getName()),
          timestamp: new Date().toISOString()
        };
        break;

      case 'getData':
        const data = sheet.getDataRange().getValues();
        const rows = [];
        for (let i = 1; i < data.length; i++) {
          rows.push({ row: i + 1, nama: data[i][0] || '', nomor: data[i][1] || '' });
        }
        result = { success: true, data: rows, count: rows.length };
        break;

      case 'addData':
        const namaAdd = e.parameter.nama || '';
        const nomorAdd = e.parameter.nomor || '';
        if (!namaAdd || !nomorAdd) throw new Error('nama dan nomor required');
        sheet.appendRow([namaAdd, nomorAdd]);
        result = { success: true, message: 'Data ditambahkan', row: sheet.getLastRow() };
        break;

      case 'editData':
        const rowEdit = parseInt(e.parameter.row);
        const namaEdit = e.parameter.nama || '';
        const nomorEdit = e.parameter.nomor || '';
        if (!rowEdit || rowEdit < 2) throw new Error('row invalid');
        sheet.getRange(rowEdit, 1).setValue(namaEdit);
        sheet.getRange(rowEdit, 2).setValue(nomorEdit);
        result = { success: true, message: 'Data diupdate', row: rowEdit };
        break;

      case 'deleteData':
        const rowDel = parseInt(e.parameter.row);
        if (!rowDel || rowDel < 2) throw new Error('row invalid');
        sheet.deleteRow(rowDel);
        result = { success: true, message: 'Data dihapus', row: rowDel };
        break;

      default:
        result = { success: false, error: 'Invalid action: ' + action };
    }

    return jsonResponse(result, corsHeaders);

  } catch (error) {
    return jsonResponse({ success: false, error: error.toString() }, corsHeaders);
  }
}

function jsonResponse(data, headers) {
  let output = ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
  if (headers) {
    for (let key in headers) {
      output = output.setHeader(key, headers[key]);
    }
  }
  return output;
}`;

            const editor = document.getElementById('gasCodeEditor');
            if (editor) editor.value = code;
        },

        copyGASCode() {
            const textarea = document.getElementById('gasCodeEditor');
            if (!textarea?.value.trim()) {
                this.showNotification('⚠️ Generate kode dulu', 'warning');
                return;
            }
            textarea.select();
            document.execCommand('copy');
            this.showNotification('✅ Kode GAS dicopy!', 'success');
        },

        renderTable() {
            const tbody = document.getElementById('tableBody');
            if (!tbody) return;

            if (this.state.filteredData.length === 0) {
                tbody.innerHTML = \`
                    <tr class="n8n-empty-row">
                        <td colspan="4" class="n8n-empty-message">
                            <div class="empty-state">
                                <span class="empty-icon">📭</span>
                                <p>Belum ada data. Klik "Cari Data" untuk memuat.</p>
                            </div>
                        </td>
                    </tr>
                \`;
                this.updateButtonStates();
                return;
            }

            tbody.innerHTML = this.state.filteredData.map((item, index) => {
                const isSelected = this.state.selectedRow == item.row;
                return \`
                    <tr class="n8n-data-row \${isSelected ? 'selected' : ''}" data-row="\${item.row}">
                        <td>\${index + 1}</td>
                        <td>\${this.escapeHtml(item.nama || '')}</td>
                        <td>\${this.escapeHtml(item.nomor || '')}</td>
                        <td>
                            <button class="n8n-btn n8n-btn-sm n8n-btn-select \${isSelected ? 'selected' : ''}" data-row="\${item.row}">
                                \${isSelected ? '✓' : '☐'}
                            </button>
                        </td>
                    </tr>
                \`;
            }).join('');

            tbody.querySelectorAll('.n8n-data-row').forEach(row => {
                row.addEventListener('click', (e) => {
                    if (e.target.closest('.n8n-btn-select')) return;
                    this.selectRow(parseInt(row.getAttribute('data-row')));
                });
            });

            tbody.querySelectorAll('.n8n-btn-select').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.selectRow(parseInt(btn.getAttribute('data-row')));
                });
            });

            this.updateButtonStates();
        },

        selectRow(row) {
            this.state.selectedRow = this.state.selectedRow === row ? null : row;
            this.renderTable();
        },

        updateButtonStates() {
            const hasSelection = this.state.selectedRow !== null;
            const btnEdit = document.getElementById('btnEdit');
            const btnDelete = document.getElementById('btnDelete');
            if (btnEdit) btnEdit.disabled = !hasSelection;
            if (btnDelete) btnDelete.disabled = !hasSelection;
        },

        async testConnection() {
            const result = await this.makeRequest('test');
            if (result?.success) {
                this.showNotification(\`✅ \${result.message}\`, 'success');
            }
        },

        async testTelegramConnection() {
            await this.getChatId();
        },

        openModal(modalId) {
            document.getElementById('modalOverlay').style.display = 'flex';
            document.getElementById(modalId).style.display = 'block';
        },

        closeModal() {
            document.getElementById('modalOverlay').style.display = 'none';
            document.querySelectorAll('.n8n-modal').forEach(m => m.style.display = 'none');
        },

        escapeHtml(text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },

        setStatus(badge, text) {
            const badgeEl = document.getElementById('statusBadge');
            const textEl = document.querySelector('.status-text');
            const telegramStatus = document.getElementById('telegramStatusText');
            
            if (badgeEl) badgeEl.textContent = badge;
            if (textEl) textEl.textContent = text;
            if (telegramStatus) {
                telegramStatus.textContent = badge === '🟢' ? '✅ Terhubung' : 
                                           badge === '🔴' ? '❌ Error' : '⏳ ' + text;
            }
        },

        showNotification(message, type = 'info', duration = 4000) {
            const notif = document.getElementById('notification');
            if (!notif) {
                alert(message);
                return;
            }
            notif.textContent = message;
            notif.className = \`n8n-notification show \${type}\`;
            setTimeout(() => notif.classList.remove('show'), duration);
        }
    };

    window.n8nModule = n8nModule;
})();

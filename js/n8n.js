// ============================================
// N8N DATA MANAGEMENT MODULE - TELEGRAM BRIDGE
// ============================================
// Integrasi: Telegram Bot → Google Apps Script → Google Sheets
// Fitur: Cari, Tambah, Edit, Hapus data via Telegram

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
            lastMessageId: null
        },

        init() {
            console.log('[n8nModule] ✅ Telegram Bridge Version Loaded');
            this.loadConfig();
            this.bindMethods();
            
            // Check if running from file protocol
            if (window.location.protocol === 'file:') {
                console.warn('[n8nModule] Running from file:// - CORS restrictions apply');
            }
        },

        bindMethods() {
            this.handleSearch = this.handleSearch.bind(this);
            this.handleAdd = this.handleAdd.bind(this);
            this.handleEdit = this.handleEdit.bind(this);
            this.handleDelete = this.handleDelete.bind(this);
            this.toggleConfig = this.toggleConfig.bind(this);
            this.saveConfig = this.saveConfig.bind(this);
            this.testConnection = this.testConnection.bind(this);
            this.sendTelegramMessage = this.sendTelegramMessage.bind(this);
            this.getTelegramUpdates = this.getTelegramUpdates.bind(this);
            this.processTelegramCommand = this.processTelegramCommand.bind(this);
            this.selectRow = this.selectRow.bind(this);
            this.renderTable = this.renderTable.bind(this);
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

            // Save to localStorage
            localStorage.setItem('n8n_config', JSON.stringify(inputs));
            localStorage.setItem('n8n_bot_token', inputs.botToken);
            localStorage.setItem('n8n_chat_id', inputs.chatId);
            localStorage.setItem('n8n_sheet_id', inputs.sheetId);
            localStorage.setItem('n8n_sheet_name', inputs.sheetName);
            localStorage.setItem('n8n_gas_url', inputs.gasUrl);

            this.showNotification('✅ Konfigurasi tersimpan!', 'success');
            
            // Auto test connection
            if (inputs.botToken) {
                this.getChatId();
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
                const proxyUrl = 'https://api.allorigins.win/get?url=';
                const apiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
                const payload = {
                    chat_id: chatId,
                    text: text,
                    parse_mode: 'Markdown',
                    ...options
                };

                // For file:// protocol, use proxy
                let response;
                if (window.location.protocol === 'file:') {
                    const encodedUrl = encodeURIComponent(`${apiUrl}?${new URLSearchParams(payload).toString()}`);
                    response = await fetch(`${proxyUrl}${encodedUrl}`);
                    const data = await response.json();
                    return JSON.parse(data.contents);
                } else {
                    response = await fetch(apiUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    return await response.json();
                }
            } catch (error) {
                console.error('[Telegram] Send message error:', error);
                return null;
            }
        },

        async getTelegramUpdates() {
            const { botToken } = this.state.config;
            
            if (!botToken) {
                this.showNotification('⚠️ Bot Token belum diisi!', 'warning');
                return;
            }

            this.setStatus('🟡', 'Mengambil updates dari Telegram...');

            try {
                const proxyUrl = 'https://api.allorigins.win/get?url=';
                const apiUrl = `https://api.telegram.org/bot${botToken}/getUpdates?limit=10`;
                
                let response;
                if (window.location.protocol === 'file:') {
                    const encodedUrl = encodeURIComponent(apiUrl);
                    response = await fetch(`${proxyUrl}${encodedUrl}`);
                    const data = await response.json();
                    return JSON.parse(data.contents);
                } else {
                    response = await fetch(apiUrl);
                    return await response.json();
                }
            } catch (error) {
                console.error('[Telegram] Get updates error:', error);
                this.setStatus('🔴', 'Error koneksi Telegram');
                return null;
            }
        },

        async getChatId() {
            const { botToken } = this.state.config;
            
            if (!botToken) return;

            this.setStatus('🟡', 'Mendeteksi Chat ID...');

            try {
                const result = await this.getTelegramUpdates();
                
                if (result && result.ok && result.result.length > 0) {
                    // Get latest message
                    const latest = result.result[result.result.length - 1];
                    const chatId = latest.message?.chat?.id || latest.callback_query?.message?.chat?.id;
                    
                    if (chatId) {
                        this.state.config.chatId = chatId;
                        document.getElementById('chatId').value = chatId;
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
                this.showNotification('❌ Gagal mendeteksi Chat ID', 'error');
                this.setStatus('🔴', 'Error');
            }
        },

        processTelegramCommand(message) {
            const text = message.text || '';
            const parts = text.trim().split(/\s+/);
            const cmd = parts[0].toLowerCase();
            const args = parts.slice(1).join(' ');

            return { cmd, args, message };
        },

        // ============================================
        // CRUD OPERATIONS VIA TELEGRAM
        // ============================================

        async handleSearch() {
            const keyword = document.getElementById('searchInput')?.value.toLowerCase().trim() || '';
            
            // Kirim notifikasi ke Telegram
            await this.sendTelegramMessage(
                `🔍 *PENCARIAN DATA*\n\n` +
                `Keyword: ${keyword || 'Semua data'}\n` +
                `Waktu: ${new Date().toLocaleString('id-ID')}\n\n` +
                `⏳ Mengambil data dari Google Sheets...`
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

            // Filter data
            if (keyword) {
                this.state.filteredData = this.state.data.filter(item => 
                    (item.nama && item.nama.toLowerCase().includes(keyword)) || 
                    (item.nomor && item.nomor.toLowerCase().includes(keyword))
                );
            } else {
                this.state.filteredData = this.state.data;
            }

            this.renderTable();

            // Kirim hasil ke Telegram
            const count = this.state.filteredData.length;
            let message = `✅ *PENCARIAN SELESAI*\n\n`;
            message += `Ditemukan: *${count} data*\n`;
            message += `Keyword: *${keyword || '-' }*\n\n`;
            
            if (count > 0) {
                message += `*Hasil (5 teratas):*\n`;
                this.state.filteredData.slice(0, 5).forEach((item, idx) => {
                    message `${idx + 1}. ${item.nama || 'N/A'} - ${item.nomor || 'N/A'}\n`;
                });
                
                if (count > 5) {
                    message += `\n...dan ${count - 5} data lainnya`;
                }
            } else {
                message += `❌ Tidak ada data yang cocok`;
            }

            await this.sendTelegramMessage(message);
            this.showNotification(`✅ ${count} data ditemukan`, 'success');
        },

        async handleAdd() {
            // Buka modal untuk input data
            document.getElementById('modalTitle').textContent = 'Tambah Data (via Telegram)';
            document.getElementById('editId').value = '';
            document.getElementById('inputNama').value = '';
            document.getElementById('inputNomor').value = '';
            
            // Tambahkan info Telegram
            const telegramInfo = document.getElementById('telegramInfo');
            if (telegramInfo) {
                telegramInfo.innerHTML = `
                    <div style="background: #e3f2fd; border-left: 4px solid #2196f3; padding: 12px; margin-bottom: 16px; border-radius: 4px;">
                        <strong>💡 Info:</strong> Data akan disimpan ke Google Sheets dan notifikasi dikirim ke Telegram.
                    </div>
                `;
            }
            
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

            // Konfirmasi via Telegram
            const confirmMsg = `🗑️ *KONFIRMASI HAPUS*\n\n` +
                `Nama: *${item.nama || 'N/A'}*\n` +
                `Nomor: *${item.nomor || 'N/A'}*\n\n` +
                `Apakah Anda yakin ingin menghapus data ini?\n` +
                `Balas dengan YA untuk konfirmasi atau BATAL untuk membatalkan.`;

            await this.sendTelegramMessage(confirmMsg, {
                reply_markup: JSON.stringify({
                    inline_keyboard: [[
                        { text: '✅ YA, Hapus', callback_data: `delete_${item.row}` },
                        { text: '❌ Batal', callback_data: 'cancel_delete' }
                    ]]
                })
            });

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

            // Kirim notifikasi ke Telegram
            await this.sendTelegramMessage(
                `${row ? '✏️' : '➕'} *${row ? 'EDIT' : 'TAMBAH'} DATA*\n\n` +
                `Nama: *${nama}*\n` +
                `Nomor: *${nomor}*\n\n` +
                `⏳ Menyimpan ke Google Sheets...`
            );

            const result = await this.makeRequest(action, params);
            
            if (result && result.success) {
                this.closeModal();
                
                // Notifikasi sukses ke Telegram
                await this.sendTelegramMessage(
                    `✅ *BERHASIL*\n\n` +
                    `Data berhasil ${row ? 'diupdate' : 'ditambahkan'}!\n\n` +
                    `Nama: *${nama}*\n` +
                    `Nomor: *${nomor}*\n` +
                    `${row ? `Row: ${row}` : `Row baru: ${result.row}`}\n\n` +
                    `Waktu: ${new Date().toLocaleString('id-ID')}`
                );

                this.handleSearch();
                this.showNotification(result.message || '✅ Data tersimpan', 'success');
            } else if (result) {
                await this.sendTelegramMessage(`❌ Gagal menyimpan: ${result.error || 'Unknown error'}`);
                this.showNotification('❌ ' + (result.error || 'Gagal menyimpan'), 'error');
            }
        },

        async confirmDelete() {
            const row = this.state.selectedRow;
            
            const result = await this.makeRequest('deleteData', { row });
            
            if (result && result.success) {
                // Notifikasi ke Telegram
                await this.sendTelegramMessage(
                    `🗑️ *DATA DIHAPUS*\n\n` +
                    `Row: ${row}\n` +
                    `Waktu: ${new Date().toLocaleString('id-ID')}\n\n` +
                    `Data berhasil dihapus dari Google Sheets.`
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
        // API CALLS TO GOOGLE APPS SCRIPT
        // ============================================

        async makeRequest(action, params = {}) {
            const { gasUrl, sheetId } = this.state.config;
            
            if (!gasUrl || !sheetId) {
                this.showNotification('⚠️ Sheet ID dan GAS URL harus diisi!', 'warning');
                return null;
            }

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

                let response;
                
                // Handle file:// protocol with proxy
                if (window.location.protocol === 'file:') {
                    const proxyUrl = 'https://api.allorigins.win/get?url=';
                    const encodedUrl = encodeURIComponent(url.toString());
                    response = await fetch(`${proxyUrl}${encodedUrl}`, {
                        signal: controller.signal
                    });
                    
                    clearTimeout(timeoutId);
                    
                    if (!response.ok) {
                        throw new Error('HTTP ' + response.status);
                    }
                    
                    const proxyData = await response.json();
                    return JSON.parse(proxyData.contents);
                } else {
                    response = await fetch(url.toString(), {
                        method: 'GET',
                        headers: { 'Accept': 'application/json' },
                        signal: controller.signal
                    });
                    
                    clearTimeout(timeoutId);

                    if (!response.ok) {
                        throw new Error('HTTP ' + response.status);
                    }

                    return await response.json();
                }
                
            } catch (error) {
                console.error('[n8nModule] Error:', error);
                this.setStatus('🔴', 'Error');

                let errorMsg = error.message;
                let solution = '';

                if (error.name === 'AbortError') {
                    errorMsg = 'Request timeout (30s)';
                    solution = 'Cek koneksi internet atau coba lagi';
                } else if (error.message.includes('Failed to fetch')) {
                    errorMsg = 'CORS Error / GAS tidak accessible';
                    solution = 'Pastikan: 1) GAS sudah deploy sebagai Web App, 2) Access: ANYONE, 3) URL benar';
                } else if (error.message.includes('404')) {
                    errorMsg = 'GAS URL tidak ditemukan (404)';
                    solution = 'Cek URL GAS atau deploy ulang';
                }

                this.showNotification(`❌ ${errorMsg}. ${solution}`, 'error', 6000);
                return null;
            }
        },

        // ============================================
        // UI RENDERING
        // ============================================

        renderPage() {
            console.log('[n8nModule] Rendering page...');
            const mainContent = document.getElementById('mainContent');
            if (!mainContent) {
                console.error('[n8nModule] mainContent not found');
                return;
            }

            mainContent.innerHTML = this.getHTML();
            this.attachEventListeners();
            this.setFormValues();
            
            // Auto generate GAS code if empty
            if (!this.state.config.gasUrl) {
                this.generateGAS();
            }
            
            // Auto get chat ID if token exists but chat ID empty
            if (this.state.config.botToken && !this.state.config.chatId) {
                this.getChatId();
            }
        },

        setFormValues() {
            document.getElementById('sheetId').value = this.state.config.sheetId;
            document.getElementById('sheetName').value = this.state.config.sheetName;
            document.getElementById('gasUrl').value = this.state.config.gasUrl;
            document.getElementById('botToken').value = this.state.config.botToken;
            document.getElementById('chatId').value = this.state.config.chatId;
        },

        getHTML() {
            return `
                <div class="n8n-container">
                    <div class="n8n-header">
                        <h2>🔍 N8N Data Management</h2>
                        <p>Kelola data via Telegram Bridge → Google Sheets</p>
                    </div>

                    <!-- TELEGRAM STATUS CARD -->
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
                            <button onclick="n8nModule.testTelegramConnection()" 
                                    style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); 
                                           color: white; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 13px;">
                                🔄 Test Koneksi
                            </button>
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
                                                <p>Belum ada data. Klik "Cari Data" untuk memuat data dari Google Sheets.</p>
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
                                <input type="text" id="chatId" class="n8n-input" placeholder="Kirim pesan ke bot, lalu klik Test Koneksi" readonly>
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
                                <small>Nama tab/sheet di spreadsheet (auto-create kalau tidak ada)</small>
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
                            <p class="step-desc">Kode di bawah ini sudah sesuai dengan konfigurasi Anda. Copy dan deploy ke Google Apps Script.</p>

                            <div class="n8n-gas-actions">
                                <button class="n8n-btn n8n-btn-secondary" id="btnGenerateGAS">
                                    <span class="icon">🔄</span>
                                    <span>Regenerate</span>
                                </button>
                                <button class="n8n-btn n8n-btn-success" id="btnCopyGAS">
                                    <span class="icon">📋</span>
                                    <span>Copy Kode</span>
                                </button>
                                <button class="n8n-btn n8n-btn-primary" id="btnOpenGAS" title="Buka script.google.com">
                                    <span class="icon">🚀</span>
                                    <span>Buka GAS Editor</span>
                                </button>
                            </div>

                            <textarea id="gasCodeEditor" class="n8n-textarea" readonly placeholder="Klik 'Regenerate' untuk membuat kode GAS..."></textarea>

                            <div class="gas-tips">
                                <strong>💡 Tips:</strong> Kode sudah include CORS handling. Tidak perlu edit apapun, langsung copy → paste → deploy.
                            </div>
                        </div>

                        <!-- DEPLOY GUIDE -->
                        <div class="n8n-config-card">
                            <div class="step-header">
                                <span class="step-number">4</span>
                                <h3>🚀 Cara Deploy GAS (Wajib)</h3>
                            </div>

                            <div class="deploy-steps">
                                <div class="deploy-step">
                                    <span class="step-icon">1</span>
                                    <div class="step-content">
                                        <strong>Buka GAS Editor</strong>
                                        <p>Klik tombol "Buka GAS Editor" di atas atau buka <a href="https://script.google.com" target="_blank">script.google.com</a></p>
                                    </div>
                                </div>

                                <div class="deploy-step">
                                    <span class="step-icon">2</span>
                                    <div class="step-content">
                                        <strong>New Project</strong>
                                        <p>Hapus semua kode default (Ctrl+A → Delete)</p>
                                    </div>
                                </div>

                                <div class="deploy-step">
                                    <span class="step-icon">3</span>
                                    <div class="step-content">
                                        <strong>Paste Kode</strong>
                                        <p>Copy kode dari textarea di atas → Paste → Save (Ctrl+S)</p>
                                    </div>
                                </div>

                                <div class="deploy-step">
                                    <span class="step-icon">4</span>
                                    <div class="step-content">
                                        <strong>Deploy</strong>
                                        <p>Deploy → New deployment → Type: Web App</p>
                                    </div>
                                </div>

                                <div class="deploy-step">
                                    <span class="step-icon">5</span>
                                    <div class="step-content">
                                        <strong>Setting Access</strong>
                                        <p>Execute as: <strong>Me</strong> | Who has access: <strong>ANYONE</strong> ⚠️</p>
                                    </div>
                                </div>

                                <div class="deploy-step">
                                    <span class="step-icon">6</span>
                                    <div class="step-content">
                                        <strong>Copy URL</strong>
                                        <p>Copy URL Web App → Paste ke field "GAS Web App URL" di atas</p>
                                    </div>
                                </div>
                            </div>

                            <div class="deploy-warning">
                                <strong>⚠️ Penting:</strong> "Who has access" harus <strong>ANYONE</strong>, bukan "Only myself". Kalau tidak, akan muncul CORS error.
                            </div>
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
                            <div id="telegramInfo"></div>
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
                            <p style="font-size: 12px; color: #666; margin-top: 10px;">
                                💡 Notifikasi konfirmasi juga telah dikirim ke Telegram.
                            </p>
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
            document.getElementById('btnTestTelegram')?.addEventListener('click', () => this.getChatId());
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
            const configSection = document.getElementById('configSection');
            const arrow = document.getElementById('configArrow');

            if (configSection.style.display === 'none') {
                configSection.style.display = 'block';
                arrow.textContent = '▲';
                this.state.configVisible = true;
            } else {
                configSection.style.display = 'none';
                arrow.textContent = '▼';
                this.state.configVisible = false;
            }
        },

        // ============================================
        // GAS CODE GENERATOR
        // ============================================

        generateGAS() {
            const sheetName = this.state.config.sheetName || 'Data Base Hifzi Cell';

            const gasCode = `// ============================================
// GOOGLE APPS SCRIPT - N8N Telegram Bridge
// Auto-generated: ${new Date().toLocaleString()}
// ============================================

const SHEET_NAME = '${sheetName}';

function doGet(e) {
  const action = e.parameter.action;
  const sheetId = e.parameter.sheetId;

  // CORS Headers untuk semua response
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  try {
    // Validasi parameter
    if (!sheetId) {
      throw new Error('Parameter sheetId diperlukan');
    }

    if (!action) {
      throw new Error('Parameter action diperlukan');
    }

    const ss = SpreadsheetApp.openById(sheetId);
    let sheet = ss.getSheetByName(SHEET_NAME);

    // Auto-create sheet kalau belum ada
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
        const sheets = ss.getSheets().map(s => s.getName());
        result = { 
          success: true, 
          message: 'Koneksi berhasil',
          sheets: sheets,
          targetSheet: SHEET_NAME,
          sheetExists: sheets.includes(SHEET_NAME),
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
          count: rows.length
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
          message: 'Data berhasil ditambahkan',
          row: sheet.getLastRow()
        };
        break;

      case 'editData':
        const rowEdit = e.parameter.row;
        const namaEdit = e.parameter.nama || '';
        const nomorEdit = e.parameter.nomor || '';

        if (!rowEdit) throw new Error('Parameter row diperlukan');
        if (!namaEdit || !nomorEdit) throw new Error('Parameter nama dan nomor diperlukan');

        const rowNum = parseInt(rowEdit);
        if (isNaN(rowNum) || rowNum < 2) throw new Error('Nomor baris tidak valid');

        sheet.getRange(rowNum, 1).setValue(namaEdit);
        sheet.getRange(rowNum, 2).setValue(nomorEdit);
        result = { 
          success: true, 
          message: 'Data berhasil diupdate',
          row: rowNum
        };
        break;

      case 'deleteData':
        const rowDelete = e.parameter.row;

        if (!rowDelete) throw new Error('Parameter row diperlukan');

        const rowNumDel = parseInt(rowDelete);
        if (isNaN(rowNumDel) || rowNumDel < 2) throw new Error('Nomor baris tidak valid');

        sheet.deleteRow(rowNumDel);
        result = { 
          success: true, 
          message: 'Data berhasil dihapus',
          row: rowNumDel
        };
        break;

      default:
        result = { 
          success: false, 
          error: 'Action tidak valid: ' + action,
          validActions: ['test', 'getData', 'addData', 'editData', 'deleteData']
        };
    }

    return jsonResponse(result, corsHeaders);

  } catch (error) {
    console.error('Error in doGet:', error);
    return jsonResponse({ 
      success: false, 
      error: error.toString(),
      message: error.message,
      stack: error.stack
    }, corsHeaders);
  }
}

// Handle OPTIONS request untuk CORS preflight
function doOptions(e) {
  return ContentService.createTextOutput('')
    .setHeaders({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
}

function jsonResponse(data, headers) {
  let output = ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);

  // Add CORS headers
  if (headers) {
    for (let key in headers) {
      output = output.setHeader(key, headers[key]);
    }
  }

  return output;
}`;

            const editor = document.getElementById('gasCodeEditor');
            if (editor) {
                editor.value = gasCode;
            }
            
            this.showNotification('✅ Kode GAS generated!', 'success');
        },

        copyGASCode() {
            const textarea = document.getElementById('gasCodeEditor');
            if (!textarea || !textarea.value.trim()) {
                this.showNotification('⚠️ Tidak ada kode untuk di-copy', 'warning');
                return;
            }

            textarea.select();
            textarea.setSelectionRange(0, 99999);

            try {
                navigator.clipboard.writeText(textarea.value).then(() => {
                    this.showNotification('✅ Kode GAS copied to clipboard!', 'success');
                }).catch(() => {
                    document.execCommand('copy');
                    this.showNotification('✅ Kode GAS copied!', 'success');
                });
            } catch (e) {
                document.execCommand('copy');
                this.showNotification('✅ Kode GAS copied!', 'success');
            }
        },

        // ============================================
        // TABLE RENDERING
        // ============================================

        renderTable() {
            const tbody = document.getElementById('tableBody');

            if (this.state.filteredData.length === 0) {
                tbody.innerHTML = `
                    <tr class="n8n-empty-row">
                        <td colspan="4" class="n8n-empty-message">
                            <div class="empty-state">
                                <span class="empty-icon">📭</span>
                                <p>Belum ada data. Klik "Cari Data" untuk memuat.</p>
                            </div>
                        </td>
                    </tr>
                `;
                this.updateButtonStates();
                return;
            }

            tbody.innerHTML = this.state.filteredData.map((item, index) => {
                const isSelected = this.state.selectedRow == item.row;
                return `
                    <tr class="n8n-data-row ${isSelected ? 'selected' : ''}" data-row="${item.row}">
                        <td>${index + 1}</td>
                        <td>${this.escapeHtml(item.nama || '')}</td>
                        <td>${this.escapeHtml(item.nomor || '')}</td>
                        <td>
                            <button class="n8n-btn n8n-btn-sm n8n-btn-select ${isSelected ? 'selected' : ''}" data-row="${item.row}">
                                ${isSelected ? '✓' : '☐'}
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');

            // Event listeners
            tbody.querySelectorAll('.n8n-data-row').forEach(row => {
                row.addEventListener('click', (e) => {
                    if (e.target.closest('.n8n-btn-select')) return;
                    const rowNum = parseInt(row.getAttribute('data-row'));
                    this.selectRow(rowNum);
                });
            });

            tbody.querySelectorAll('.n8n-btn-select').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const rowNum = parseInt(btn.getAttribute('data-row'));
                    this.selectRow(rowNum);
                });
            });

            this.updateButtonStates();
        },

        selectRow(row) {
            if (this.state.selectedRow === row) {
                this.state.selectedRow = null;
            } else {
                this.state.selectedRow = row;
            }
            this.renderTable();
        },

        updateButtonStates() {
            const hasSelection = this.state.selectedRow !== null;
            const btnEdit = document.getElementById('btnEdit');
            const btnDelete = document.getElementById('btnDelete');
            
            if (btnEdit) btnEdit.disabled = !hasSelection;
            if (btnDelete) btnDelete.disabled = !hasSelection;
        },

        // ============================================
        // TEST CONNECTIONS
        // ============================================

        async testConnection() {
            const { sheetId, sheetName, gasUrl } = this.state.config;
            
            if (!sheetId || !gasUrl) {
                this.showNotification('⚠️ Sheet ID dan GAS URL wajib diisi!', 'warning');
                return;
            }

            this.setStatus('🟡', 'Testing GAS connection...');
            
            const result = await this.makeRequest('test');
            
            if (result && result.success) {
                this.showNotification(`✅ ${result.message} | Sheets: ${(result.sheets || []).join(', ')}`, 'success');
                this.setStatus('🟢', 'Terhubung ke GAS');
            } else {
                this.setStatus('🔴', 'GAS Error');
            }
        },

        async testTelegramConnection() {
            await this.getChatId();
        },

        // ============================================
        // UTILITY FUNCTIONS
        // ============================================

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
            
            // Update telegram status card
            if (telegramStatus) {
                let statusMsg = text;
                if (badge === '🟢') statusMsg = '✅ Terhubung';
                if (badge === '🔴') statusMsg = '❌ Error koneksi';
                if (badge === '🟡') statusMsg = '⏳ ' + text;
                telegramStatus.textContent = statusMsg;
            }
        },

        showNotification(message, type = 'info', duration = 4000) {
            const notif = document.getElementById('notification');
            if (!notif) return;

            notif.textContent = message;
            notif.className = `n8n-notification show ${type}`;

            setTimeout(() => {
                notif.classList.remove('show');
            }, duration);
        }
    };

    // Expose to global scope
    window.n8nModule = n8nModule;
})();

// ============================================
// N8N DATA MANAGEMENT MODULE
// ============================================
// Module untuk pencarian dan manajemen data dari Google Sheets
// Posisi: CRUD di atas, Konfigurasi di bawah (collapsible)

(function() {
    'use strict';

    const n8nModule = {
        // State management
        state: {
            data: [],
            filteredData: [],
            selectedRow: null,
            gasUrl: localStorage.getItem('n8n_gas_url') || '',
            sheetId: localStorage.getItem('n8n_sheet_id') || '',
            sheetName: localStorage.getItem('n8n_sheet_name') || 'Data Base Hifzi Cell',
            botToken: localStorage.getItem('n8n_bot_token') || '',
            chatId: localStorage.getItem('n8n_chat_id') || '',
            configVisible: false,
            gasCode: localStorage.getItem('n8n_gas_code') || ''
        },

        // ============================================
        // INITIALIZATION
        // ============================================
        init() {
            console.log('[n8nModule] ✅ Module loaded dengan nama HURUF KECIL SEMUA');
            console.log('[n8nModule] Module initialized - huruf kecil semua');

            // Load saved config
            this.loadConfig();

            // Bind methods
            this.handleSearch = this.handleSearch.bind(this);
            this.handleAdd = this.handleAdd.bind(this);
            this.handleEdit = this.handleEdit.bind(this);
            this.handleDelete = this.handleDelete.bind(this);
            this.toggleConfig = this.toggleConfig.bind(this);
            this.saveConfig = this.saveConfig.bind(this);
            this.testConnection = this.testConnection.bind(this);
            this.generateGAS = this.generateGAS.bind(this);
            this.saveGASCode = this.saveGASCode.bind(this);
            this.loadGASCode = this.loadGASCode.bind(this);
            this.getChatId = this.getChatId.bind(this);
        },

        loadConfig() {
            const saved = localStorage.getItem('n8n_config');
            if (saved) {
                const config = JSON.parse(saved);
                this.state.gasUrl = config.gasUrl || '';
                this.state.sheetId = config.sheetId || '';
                this.state.sheetName = config.sheetName || 'Data Base Hifzi Cell';
                this.state.botToken = config.botToken || '';
                this.state.chatId = config.chatId || '';
                this.state.gasCode = config.gasCode || '';
            }
        },

        saveConfig() {
            const config = {
                gasUrl: this.state.gasUrl,
                sheetId: this.state.sheetId,
                sheetName: this.state.sheetName,
                botToken: this.state.botToken,
                chatId: this.state.chatId,
                gasCode: this.state.gasCode
            };
            localStorage.setItem('n8n_config', JSON.stringify(config));

            // Also save individual items for backward compatibility
            localStorage.setItem('n8n_gas_url', this.state.gasUrl);
            localStorage.setItem('n8n_sheet_id', this.state.sheetId);
            localStorage.setItem('n8n_sheet_name', this.state.sheetName);
            localStorage.setItem('n8n_bot_token', this.state.botToken);
            localStorage.setItem('n8n_chat_id', this.state.chatId);
            localStorage.setItem('n8n_gas_code', this.state.gasCode);

            this.showNotification('✅ Konfigurasi berhasil disimpan!', 'success');
        },

        // ============================================
        // RENDER PAGE
        // ============================================
        renderPage() {
            console.log('[n8nModule] renderPage() called');
            const mainContent = document.getElementById('mainContent');
            if (!mainContent) {
                console.error('[n8nModule] mainContent not found');
                return;
            }

            mainContent.innerHTML = this.getHTML();
            this.attachEventListeners();

            // Auto-get chat ID if token exists but chat ID empty
            if (this.state.botToken && !this.state.chatId) {
                this.getChatId();
            }

            // Load saved GAS code to textarea if exists
            const gasTextarea = document.getElementById('gasCodeEditor');
            if (gasTextarea && this.state.gasCode) {
                gasTextarea.value = this.state.gasCode;
            }
        },

        getHTML() {
            return `
                <div class="n8n-container">
                    <!-- HEADER -->
                    <div class="n8n-header">
                        <h2>🔍 Pencarian Data N8N</h2>
                        <p>Kelola data nama dan nomor dari Google Sheets</p>
                    </div>

                    <!-- CRUD BUTTONS - POSISI ATAS -->
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

                        <!-- Search Input -->
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
                                        <th>No</th>
                                        <th>NAMA</th>
                                        <th>NOMOR</th>
                                        <th>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody id="tableBody">
                                    <tr class="n8n-empty-row">
                                        <td colspan="4" class="n8n-empty-message">
                                            <div class="empty-state">
                                                <span class="empty-icon">📭</span>
                                                <p>Belum ada data. Klik "Cari Data" atau "Tambah Data" untuk memulai.</p>
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- CONFIG TOGGLE BUTTON -->
                    <div class="n8n-config-toggle">
                        <button class="n8n-btn n8n-btn-ghost" id="btnToggleConfig" title="Konfigurasi">
                            <span class="icon">⚙️</span>
                            <span>Konfigurasi</span>
                            <span class="toggle-arrow" id="configArrow">▼</span>
                        </button>
                    </div>

                    <!-- CONFIGURATION SECTION - POSISI BAWAH (COLLAPSIBLE) -->
                    <div class="n8n-config-section" id="configSection" style="display: none;">
                        <div class="n8n-config-card">
                            <h3>⚙️ Pengaturan Koneksi</h3>

                            <div class="n8n-form-group">
                                <label>Google Sheet ID</label>
                                <input type="text" id="sheetId" class="n8n-input" placeholder="1cPolj_xpBztq6RU3XVi_CZm1j_Kqo-zQC-wsbIYrLXE" value="${this.state.sheetId}">
                                <small>ID dari spreadsheet Google Sheets</small>
                            </div>

                            <div class="n8n-form-group">
                                <label>Sheet Name</label>
                                <input type="text" id="sheetName" class="n8n-input" placeholder="Data Base Hifzi Cell" value="${this.state.sheetName}">
                                <small>Nama sheet/tab di dalam spreadsheet</small>
                            </div>

                            <div class="n8n-form-group">
                                <label>GAS Web App URL</label>
                                <input type="text" id="gasUrl" class="n8n-input" placeholder="https://script.google.com/macros/s/XXXX/exec" value="${this.state.gasUrl}">
                                <small>URL dari Google Apps Script yang sudah di-deploy</small>
                            </div>

                            <div class="n8n-divider"></div>

                            <div class="n8n-form-group">
                                <label>Telegram Bot Token (Opsional)</label>
                                <input type="password" id="botToken" class="n8n-input" placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz" value="${this.state.botToken}">
                                <small>Token dari @BotFather (auto-get Chat ID)</small>
                            </div>

                            <div class="n8n-form-group">
                                <label>Telegram Chat ID (Auto)</label>
                                <input type="text" id="chatId" class="n8n-input" placeholder="Akan terisi otomatis" value="${this.state.chatId}" readonly>
                                <small>Terisi otomatis setelah test koneksi</small>
                            </div>

                            <div class="n8n-config-actions">
                                <button class="n8n-btn n8n-btn-secondary" id="btnTest">
                                    <span class="icon">🔌</span>
                                    <span>Test Koneksi</span>
                                </button>
                                <button class="n8n-btn n8n-btn-primary" id="btnSaveConfig">
                                    <span class="icon">💾</span>
                                    <span>Simpan Konfigurasi</span>
                                </button>
                            </div>

                            <div class="n8n-divider"></div>

                            <!-- GAS CODE GENERATOR & STORAGE -->
                            <div class="n8n-gas-section">
                                <h4>📜 Google Apps Script Code</h4>
                                <p class="gas-desc">Generate atau paste kode GAS di sini. Kode akan tersimpan otomatis.</p>

                                <div class="n8n-gas-actions">
                                    <button class="n8n-btn n8n-btn-secondary" id="btnGenerateGAS">
                                        <span class="icon">📝</span>
                                        <span>Generate GAS Code</span>
                                    </button>
                                    <button class="n8n-btn n8n-btn-success" id="btnSaveGAS">
                                        <span class="icon">💾</span>
                                        <span>Simpan GAS</span>
                                    </button>
                                    <button class="n8n-btn n8n-btn-ghost" id="btnLoadGAS">
                                        <span class="icon">📂</span>
                                        <span>Load Tersimpan</span>
                                    </button>
                                    <button class="n8n-btn n8n-btn-danger" id="btnClearGAS">
                                        <span class="icon">🗑️</span>
                                        <span>Clear</span>
                                    </button>
                                </div>

                                <textarea id="gasCodeEditor" class="n8n-textarea" placeholder="// Kode GAS akan muncul di sini... atau paste kode Anda sendiri"></textarea>

                                <div class="n8n-gas-instructions" id="gasInstructions" style="display: none;">
                                    <h5>📋 Cara Deploy GAS:</h5>
                                    <ol>
                                        <li>Buka <a href="https://script.google.com" target="_blank">script.google.com</a></li>
                                        <li>New Project → Hapus kode default</li>
                                        <li>Copy kode di atas → Paste</li>
                                        <li>Save (Ctrl+S)</li>
                                        <li>Deploy → New deployment → Web App</li>
                                        <li>Execute as: Me | Who has access: ANYONE</li>
                                        <li>Copy URL ke field "GAS Web App URL" di atas</li>
                                    </ol>
                                </div>
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
                                <label>Nama</label>
                                <input type="text" id="inputNama" class="n8n-input" placeholder="Masukkan nama">
                            </div>
                            <div class="n8n-form-group">
                                <label>Nomor</label>
                                <input type="text" id="inputNomor" class="n8n-input" placeholder="Masukkan nomor">
                            </div>
                        </div>
                        <div class="n8n-modal-footer">
                            <button class="n8n-btn n8n-btn-ghost" id="btnCancel">Batal</button>
                            <button class="n8n-btn n8n-btn-primary" id="btnSave">Simpan</button>
                        </div>
                    </div>

                    <!-- Delete Confirmation -->
                    <div class="n8n-modal n8n-modal-small" id="deleteModal" style="display: none;">
                        <div class="n8n-modal-header">
                            <h3>⚠️ Konfirmasi Hapus</h3>
                        </div>
                        <div class="n8n-modal-body">
                            <p>Apakah Anda yakin ingin menghapus data ini?</p>
                            <p class="delete-info" id="deleteInfo"></p>
                        </div>
                        <div class="n8n-modal-footer">
                            <button class="n8n-btn n8n-btn-ghost" id="btnCancelDelete">Batal</button>
                            <button class="n8n-btn n8n-btn-danger" id="btnConfirmDelete">Hapus</button>
                        </div>
                    </div>
                </div>

                <!-- NOTIFICATION -->
                <div class="n8n-notification" id="notification"></div>
            `;
        },

        // ============================================
        // EVENT LISTENERS
        // ============================================
        attachEventListeners() {
            // CRUD Buttons
            document.getElementById('btnSearch')?.addEventListener('click', this.handleSearch);
            document.getElementById('btnExecuteSearch')?.addEventListener('click', this.handleSearch);
            document.getElementById('btnAdd')?.addEventListener('click', this.handleAdd);
            document.getElementById('btnEdit')?.addEventListener('click', this.handleEdit);
            document.getElementById('btnDelete')?.addEventListener('click', this.handleDelete);

            // Config
            document.getElementById('btnToggleConfig')?.addEventListener('click', this.toggleConfig);
            document.getElementById('btnSaveConfig')?.addEventListener('click', this.saveConfig);
            document.getElementById('btnTest')?.addEventListener('click', this.testConnection);

            // GAS
            document.getElementById('btnGenerateGAS')?.addEventListener('click', this.generateGAS);
            document.getElementById('btnSaveGAS')?.addEventListener('click', this.saveGASCode);
            document.getElementById('btnLoadGAS')?.addEventListener('click', this.loadGASCode);
            document.getElementById('btnClearGAS')?.addEventListener('click', () => {
                document.getElementById('gasCodeEditor').value = '';
                this.state.gasCode = '';
                this.saveConfig();
            });

            // Modal
            document.getElementById('btnCloseModal')?.addEventListener('click', this.closeModal);
            document.getElementById('btnCancel')?.addEventListener('click', this.closeModal);
            document.getElementById('btnSave')?.addEventListener('click', this.saveData.bind(this));
            document.getElementById('btnCancelDelete')?.addEventListener('click', this.closeModal);
            document.getElementById('btnConfirmDelete')?.addEventListener('click', this.confirmDelete.bind(this));

            // Enter key on search
            document.getElementById('searchInput')?.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleSearch();
            });

            // Input changes update state
            document.getElementById('sheetId')?.addEventListener('change', (e) => this.state.sheetId = e.target.value);
            document.getElementById('sheetName')?.addEventListener('change', (e) => this.state.sheetName = e.target.value);
            document.getElementById('gasUrl')?.addEventListener('change', (e) => this.state.gasUrl = e.target.value);
            document.getElementById('botToken')?.addEventListener('change', (e) => {
                this.state.botToken = e.target.value;
                if (e.target.value && !this.state.chatId) {
                    this.getChatId();
                }
            });
        },

        // ============================================
        // CONFIGURATION TOGGLE
        // ============================================
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
        // GAS CODE MANAGEMENT
        // ============================================
        generateGAS() {
            const gasCode = `// ============================================
// GOOGLE APPS SCRIPT - N8N Data Module
// ============================================
// 1. Buat Spreadsheet baru
// 2. Extensions > Apps Script
// 3. Hapus kode default, paste ini
// 4. Deploy > New deployment > Web App
// 5. Execute as: Me
// 6. Who has access: ANYONE
// 7. Copy URL ke POS

const SHEET_NAME = 'Data Base Hifzi Cell';

function doGet(e) {
  const action = e.parameter.action;
  const sheetId = e.parameter.sheetId;
  const nama = e.parameter.nama;
  const nomor = e.parameter.nomor;
  const row = e.parameter.row;

  // Set CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  try {
    const ss = SpreadsheetApp.openById(sheetId);
    let sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow(['NAMA', 'NOMOR']);
      sheet.getRange(1,1,1,2).setFontWeight('bold').setBackground('#4caf50').setFontColor('white');
    }

    switch(action) {
      case 'test':
        const sheets = ss.getSheets().map(s => s.getName());
        return jsonResponse({ 
          success: true, 
          message: 'Koneksi berhasil',
          sheets: sheets,
          targetSheet: SHEET_NAME,
          sheetExists: sheets.includes(SHEET_NAME)
        }, headers);

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
        return jsonResponse({ success: true, data: rows }, headers);

      case 'addData':
        sheet.appendRow([nama, nomor]);
        return jsonResponse({ 
          success: true, 
          message: 'Data berhasil ditambahkan',
          row: sheet.getLastRow()
        }, headers);

      case 'editData':
        sheet.getRange(row, 1).setValue(nama);
        sheet.getRange(row, 2).setValue(nomor);
        return jsonResponse({ 
          success: true, 
          message: 'Data berhasil diupdate'
        }, headers);

      case 'deleteData':
        sheet.deleteRow(parseInt(row));
        return jsonResponse({ 
          success: true, 
          message: 'Data berhasil dihapus'
        }, headers);

      default:
        return jsonResponse({ success: false, error: 'Invalid action' }, headers);
    }

  } catch (error) {
    return jsonResponse({ 
      success: false, 
      error: error.toString(),
      message: 'Error: ' + error.message
    }, headers);
  }
}

// Handle OPTIONS for CORS preflight
function doOptions(e) {
  return ContentService.createTextOutput()
    .setResponseCode(200)
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

            document.getElementById('gasCodeEditor').value = gasCode;
            document.getElementById('gasInstructions').style.display = 'block';
            this.showNotification('✅ GAS Code generated! Jangan lupa simpan.', 'success');
        },

        saveGASCode() {
            const code = document.getElementById('gasCodeEditor').value;
            if (!code.trim()) {
                this.showNotification('⚠️ Tidak ada kode untuk disimpan', 'warning');
                return;
            }
            this.state.gasCode = code;
            this.saveConfig();
            this.showNotification('✅ Kode GAS berhasil disimpan ke localStorage!', 'success');
        },

        loadGASCode() {
            if (this.state.gasCode) {
                document.getElementById('gasCodeEditor').value = this.state.gasCode;
                this.showNotification('✅ Kode GAS berhasil dimuat!', 'success');
            } else {
                this.showNotification('⚠️ Tidak ada kode GAS tersimpan', 'warning');
            }
        },

        // ============================================
        // TELEGRAM AUTO GET CHAT ID
        // ============================================
        async getChatId() {
            if (!this.state.botToken) return;

            try {
                const response = await fetch(`https://api.telegram.org/bot${this.state.botToken}/getUpdates`);
                const data = await response.json();

                if (data.ok && data.result.length > 0) {
                    // Get chat ID from latest message
                    const chatId = data.result[data.result.length - 1].message.chat.id;
                    this.state.chatId = chatId;
                    document.getElementById('chatId').value = chatId;
                    this.saveConfig();
                    this.showNotification(`✅ Chat ID berhasil didapatkan: ${chatId}`, 'success');
                } else {
                    this.showNotification('⚠️ Kirim pesan ke bot terlebih dahulu untuk mendapatkan Chat ID', 'warning');
                }
            } catch (error) {
                console.error('Error getting chat ID:', error);
            }
        },

        // ============================================
        // API CALLS
        // ============================================
        async makeRequest(action, params = {}) {
            if (!this.state.gasUrl || !this.state.sheetId) {
                this.showNotification('⚠️ Sheet ID dan GAS URL harus diisi!', 'warning');
                return null;
            }

            const url = new URL(this.state.gasUrl);
            url.searchParams.append('action', action);
            url.searchParams.append('sheetId', this.state.sheetId);

            for (let key in params) {
                url.searchParams.append(key, params[key]);
            }

            try {
                this.setStatus('🟡', 'Loading...');
                const response = await fetch(url.toString(), {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json'
                    }
                });

                if (!response.ok) throw new Error('Network response was not ok');

                const data = await response.json();
                this.setStatus('🟢', 'Siap');
                return data;
            } catch (error) {
                console.error('API Error:', error);
                this.setStatus('🔴', 'Error');
                this.showNotification('❌ Error: ' + error.message, 'error');
                return null;
            }
        },

        // ============================================
        // CRUD OPERATIONS
        // ============================================
        async handleSearch() {
            const keyword = document.getElementById('searchInput').value.toLowerCase();

            const result = await this.makeRequest('getData');
            if (!result || !result.success) return;

            this.state.data = result.data;

            if (keyword) {
                this.state.filteredData = this.state.data.filter(item => 
                    item.nama.toLowerCase().includes(keyword) || 
                    item.nomor.toLowerCase().includes(keyword)
                );
            } else {
                this.state.filteredData = this.state.data;
            }

            this.renderTable();
            this.showNotification(`✅ Ditemukan ${this.state.filteredData.length} data`, 'success');
        },

        handleAdd() {
            document.getElementById('modalTitle').textContent = 'Tambah Data';
            document.getElementById('editId').value = '';
            document.getElementById('inputNama').value = '';
            document.getElementById('inputNomor').value = '';
            this.openModal('dataModal');
        },

        handleEdit() {
            if (!this.state.selectedRow) {
                this.showNotification('⚠️ Pilih data yang akan diedit', 'warning');
                return;
            }

            const item = this.state.filteredData.find(d => d.row == this.state.selectedRow);
            if (!item) return;

            document.getElementById('modalTitle').textContent = 'Edit Data';
            document.getElementById('editId').value = item.row;
            document.getElementById('inputNama').value = item.nama;
            document.getElementById('inputNomor').value = item.nomor;
            this.openModal('dataModal');
        },

        handleDelete() {
            if (!this.state.selectedRow) {
                this.showNotification('⚠️ Pilih data yang akan dihapus', 'warning');
                return;
            }

            const item = this.state.filteredData.find(d => d.row == this.state.selectedRow);
            if (!item) return;

            document.getElementById('deleteInfo').textContent = `${item.nama} - ${item.nomor}`;
            this.openModal('deleteModal');
        },

        async saveData() {
            const row = document.getElementById('editId').value;
            const nama = document.getElementById('inputNama').value.trim();
            const nomor = document.getElementById('inputNomor').value.trim();

            if (!nama || !nomor) {
                this.showNotification('⚠️ Nama dan Nomor harus diisi!', 'warning');
                return;
            }

            const action = row ? 'editData' : 'addData';
            const params = { nama, nomor };
            if (row) params.row = row;

            const result = await this.makeRequest(action, params);
            if (result && result.success) {
                this.closeModal();
                this.handleSearch();
                this.showNotification(result.message, 'success');
            }
        },

        async confirmDelete() {
            const result = await this.makeRequest('deleteData', { row: this.state.selectedRow });
            if (result && result.success) {
                this.closeModal();
                this.state.selectedRow = null;
                this.updateButtonStates();
                this.handleSearch();
                this.showNotification(result.message, 'success');
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
                                <p>Belum ada data. Klik "Cari Data" atau "Tambah Data" untuk memulai.</p>
                            </div>
                        </td>
                    </tr>
                `;
                return;
            }

            tbody.innerHTML = this.state.filteredData.map((item, index) => `
                <tr class="n8n-data-row ${this.state.selectedRow == item.row ? 'selected' : ''}" data-row="${item.row}">
                    <td>${index + 1}</td>
                    <td>${this.escapeHtml(item.nama)}</td>
                    <td>${this.escapeHtml(item.nomor)}</td>
                    <td>
                        <button class="n8n-btn n8n-btn-sm n8n-btn-ghost" onclick="n8nModule.selectRow(${item.row})">
                            ${this.state.selectedRow == item.row ? '✓' : '☐'}
                        </button>
                    </td>
                </tr>
            `).join('');

            // Add click handlers
            tbody.querySelectorAll('.n8n-data-row').forEach(row => {
                row.addEventListener('click', (e) => {
                    if (!e.target.closest('button')) {
                        const rowNum = row.getAttribute('data-row');
                        this.selectRow(rowNum);
                    }
                });
            });
        },

        selectRow(row) {
            if (this.state.selectedRow == row) {
                this.state.selectedRow = null;
            } else {
                this.state.selectedRow = row;
            }
            this.renderTable();
            this.updateButtonStates();
        },

        updateButtonStates() {
            const editBtn = document.getElementById('btnEdit');
            const deleteBtn = document.getElementById('btnDelete');

            if (this.state.selectedRow) {
                editBtn.disabled = false;
                deleteBtn.disabled = false;
            } else {
                editBtn.disabled = true;
                deleteBtn.disabled = true;
            }
        },

        // ============================================
        // TEST CONNECTION
        // ============================================
        async testConnection() {
            const result = await this.makeRequest('test');
            if (result && result.success) {
                this.showNotification(`✅ ${result.message} - Sheets: ${result.sheets.join(', ')}`, 'success');

                // Auto get chat ID if token exists
                if (this.state.botToken && !this.state.chatId) {
                    this.getChatId();
                }
            } else {
                this.showNotification('❌ Koneksi gagal: ' + (result?.error || 'Unknown error'), 'error');
            }
        },

        // ============================================
        // MODAL HANDLERS
        // ============================================
        openModal(modalId) {
            document.getElementById('modalOverlay').style.display = 'flex';
            document.getElementById(modalId).style.display = 'block';
        },

        closeModal() {
            document.getElementById('modalOverlay').style.display = 'none';
            document.querySelectorAll('.n8n-modal').forEach(m => m.style.display = 'none');
        },

        // ============================================
        // UTILITIES
        // ============================================
        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },

        setStatus(badge, text) {
            document.getElementById('statusBadge').textContent = badge;
            document.querySelector('.status-text').textContent = text;
        },

        showNotification(message, type = 'info') {
            const notif = document.getElementById('notification');
            notif.textContent = message;
            notif.className = `n8n-notification show ${type}`;

            setTimeout(() => {
                notif.classList.remove('show');
            }, 3000);
        }
    };

    // Expose to global scope
    window.n8nModule = n8nModule;

})();

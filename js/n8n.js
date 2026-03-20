// ============================================
// N8N DATA MANAGEMENT MODULE - FIXED VERSION
// ============================================
// Perbaikan: CORS handling, Selection fix, Better error logging

(function() {
    'use strict';

    const n8nModule = {
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

        init() {
            console.log('[n8nModule] ✅ Module loaded - FIXED VERSION');
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
            this.selectRow = this.selectRow.bind(this);
            this.renderTable = this.renderTable.bind(this);
        },

        loadConfig() {
            const saved = localStorage.getItem('n8n_config');
            if (saved) {
                try {
                    const config = JSON.parse(saved);
                    Object.assign(this.state, config);
                    console.log('[n8nModule] Config loaded:', config);
                } catch(e) {
                    console.error('[n8nModule] Error loading config:', e);
                }
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

            // Also save individual items
            Object.keys(config).forEach(key => {
                localStorage.setItem(`n8n_${key === 'gasUrl' ? 'gas_url' : key === 'sheetId' ? 'sheet_id' : key === 'sheetName' ? 'sheet_name' : key === 'botToken' ? 'bot_token' : key === 'chatId' ? 'chat_id' : key === 'gasCode' ? 'gas_code' : key}`, config[key]);
            });

            this.showNotification('✅ Konfigurasi berhasil disimpan!', 'success');
        },

        renderPage() {
            console.log('[n8nModule] renderPage() called');
            const mainContent = document.getElementById('mainContent');
            if (!mainContent) {
                console.error('[n8nModule] mainContent not found');
                return;
            }

            mainContent.innerHTML = this.getHTML();
            this.attachEventListeners();

            // Set initial values
            document.getElementById('sheetId').value = this.state.sheetId;
            document.getElementById('sheetName').value = this.state.sheetName;
            document.getElementById('gasUrl').value = this.state.gasUrl;
            document.getElementById('botToken').value = this.state.botToken;
            document.getElementById('chatId').value = this.state.chatId;

            if (this.state.gasCode) {
                document.getElementById('gasCodeEditor').value = this.state.gasCode;
            }

            // Auto get chat ID
            if (this.state.botToken && !this.state.chatId) {
                this.getChatId();
            }

            console.log('[n8nModule] Page rendered, listeners attached');
        },

        getHTML() {
            return `
                <div class="n8n-container">
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
                                                <p>Belum ada data. Klik "Cari Data" untuk memuat data.</p>
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- CONFIG TOGGLE -->
                    <div class="n8n-config-toggle">
                        <button class="n8n-btn n8n-btn-ghost" id="btnToggleConfig" title="Konfigurasi">
                            <span class="icon">⚙️</span>
                            <span>Konfigurasi</span>
                            <span class="toggle-arrow" id="configArrow">▼</span>
                        </button>
                    </div>

                    <!-- CONFIGURATION SECTION -->
                    <div class="n8n-config-section" id="configSection" style="display: none;">
                        <div class="n8n-config-card">
                            <h3>⚙️ Pengaturan Koneksi</h3>

                            <div class="n8n-form-group">
                                <label>Google Sheet ID</label>
                                <input type="text" id="sheetId" class="n8n-input" placeholder="1cPolj_xpBztq6RU3XVi_CZm1j_Kqo-zQC-wsbIYrLXE">
                                <small>ID dari spreadsheet Google Sheets</small>
                            </div>

                            <div class="n8n-form-group">
                                <label>Sheet Name</label>
                                <input type="text" id="sheetName" class="n8n-input" placeholder="Data Base Hifzi Cell">
                                <small>Nama sheet/tab di dalam spreadsheet</small>
                            </div>

                            <div class="n8n-form-group">
                                <label>GAS Web App URL</label>
                                <input type="text" id="gasUrl" class="n8n-input" placeholder="https://script.google.com/macros/s/XXXX/exec">
                                <small>URL dari Google Apps Script yang sudah di-deploy</small>
                            </div>

                            <div class="n8n-divider"></div>

                            <div class="n8n-form-group">
                                <label>Telegram Bot Token (Opsional)</label>
                                <input type="password" id="botToken" class="n8n-input" placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz">
                                <small>Token dari @BotFather (auto-get Chat ID)</small>
                            </div>

                            <div class="n8n-form-group">
                                <label>Telegram Chat ID (Auto)</label>
                                <input type="text" id="chatId" class="n8n-input" placeholder="Akan terisi otomatis" readonly>
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

                <div class="n8n-notification" id="notification"></div>
            `;
        },

        attachEventListeners() {
            console.log('[n8nModule] Attaching event listeners...');

            // CRUD Buttons
            const btnSearch = document.getElementById('btnSearch');
            const btnExecuteSearch = document.getElementById('btnExecuteSearch');
            const btnAdd = document.getElementById('btnAdd');
            const btnEdit = document.getElementById('btnEdit');
            const btnDelete = document.getElementById('btnDelete');

            if (btnSearch) {
                btnSearch.addEventListener('click', () => {
                    console.log('[n8nModule] Search button clicked');
                    this.handleSearch();
                });
            }
            if (btnExecuteSearch) {
                btnExecuteSearch.addEventListener('click', () => {
                    console.log('[n8nModule] Execute search clicked');
                    this.handleSearch();
                });
            }
            if (btnAdd) {
                btnAdd.addEventListener('click', () => {
                    console.log('[n8nModule] Add button clicked');
                    this.handleAdd();
                });
            }
            if (btnEdit) {
                btnEdit.addEventListener('click', () => {
                    console.log('[n8nModule] Edit button clicked, selectedRow:', this.state.selectedRow);
                    this.handleEdit();
                });
            }
            if (btnDelete) {
                btnDelete.addEventListener('click', () => {
                    console.log('[n8nModule] Delete button clicked, selectedRow:', this.state.selectedRow);
                    this.handleDelete();
                });
            }

            // Config
            document.getElementById('btnToggleConfig')?.addEventListener('click', this.toggleConfig);
            document.getElementById('btnSaveConfig')?.addEventListener('click', () => {
                this.state.sheetId = document.getElementById('sheetId').value;
                this.state.sheetName = document.getElementById('sheetName').value;
                this.state.gasUrl = document.getElementById('gasUrl').value;
                this.state.botToken = document.getElementById('botToken').value;
                this.state.chatId = document.getElementById('chatId').value;
                this.saveConfig();
            });
            document.getElementById('btnTest')?.addEventListener('click', this.testConnection);

            // GAS
            document.getElementById('btnGenerateGAS')?.addEventListener('click', this.generateGAS);
            document.getElementById('btnSaveGAS')?.addEventListener('click', this.saveGASCode);
            document.getElementById('btnLoadGAS')?.addEventListener('click', this.loadGASCode);
            document.getElementById('btnClearGAS')?.addEventListener('click', () => {
                document.getElementById('gasCodeEditor').value = '';
                this.state.gasCode = '';
            });

            // Modal
            document.getElementById('btnCloseModal')?.addEventListener('click', this.closeModal);
            document.getElementById('btnCancel')?.addEventListener('click', this.closeModal);
            document.getElementById('btnSave')?.addEventListener('click', () => this.saveData());
            document.getElementById('btnCancelDelete')?.addEventListener('click', this.closeModal);
            document.getElementById('btnConfirmDelete')?.addEventListener('click', () => this.confirmDelete());

            // Enter key on search
            document.getElementById('searchInput')?.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleSearch();
            });

            console.log('[n8nModule] Event listeners attached successfully');
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
        // GAS CODE GENERATOR - WITH PROPER CORS
        // ============================================
        generateGAS() {
            const gasCode = `// ============================================
// GOOGLE APPS SCRIPT - N8N Data Module
// ============================================
// Deploy sebagai Web App dengan:
// - Execute as: Me
// - Who has access: ANYONE

const SHEET_NAME = '${this.state.sheetName || 'Data Base Hifzi Cell'}';

function doGet(e) {
  const action = e.parameter.action;
  const sheetId = e.parameter.sheetId;
  const nama = e.parameter.nama || '';
  const nomor = e.parameter.nomor || '';
  const row = e.parameter.row;

  try {
    const ss = SpreadsheetApp.openById(sheetId);
    let sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow(['NAMA', 'NOMOR']);
      sheet.getRange(1,1,1,2).setFontWeight('bold').setBackground('#4caf50').setFontColor('white');
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
          sheetExists: sheets.includes(SHEET_NAME)
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
        result = { success: true, data: rows };
        break;

      case 'addData':
        sheet.appendRow([nama, nomor]);
        result = { 
          success: true, 
          message: 'Data berhasil ditambahkan',
          row: sheet.getLastRow()
        };
        break;

      case 'editData':
        if (!row) throw new Error('Row number required');
        sheet.getRange(parseInt(row), 1).setValue(nama);
        sheet.getRange(parseInt(row), 2).setValue(nomor);
        result = { 
          success: true, 
          message: 'Data berhasil diupdate'
        };
        break;

      case 'deleteData':
        if (!row) throw new Error('Row number required');
        sheet.deleteRow(parseInt(row));
        result = { 
          success: true, 
          message: 'Data berhasil dihapus'
        };
        break;

      default:
        result = { success: false, error: 'Invalid action: ' + action };
    }

    return jsonResponse(result);

  } catch (error) {
    console.error('Error in doGet:', error);
    return jsonResponse({ 
      success: false, 
      error: error.toString(),
      message: error.message
    });
  }
}

function jsonResponse(data) {
  const output = ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);

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
            this.showNotification('✅ Kode GAS berhasil disimpan!', 'success');
        },

        loadGASCode() {
            if (this.state.gasCode) {
                document.getElementById('gasCodeEditor').value = this.state.gasCode;
                this.showNotification('✅ Kode GAS berhasil dimuat!', 'success');
            } else {
                this.showNotification('⚠️ Tidak ada kode GAS tersimpan', 'warning');
            }
        },

        async getChatId() {
            if (!this.state.botToken) return;

            try {
                const response = await fetch(`https://api.telegram.org/bot${this.state.botToken}/getUpdates`);
                const data = await response.json();

                if (data.ok && data.result.length > 0) {
                    const chatId = data.result[data.result.length - 1].message.chat.id;
                    this.state.chatId = chatId;
                    document.getElementById('chatId').value = chatId;
                    this.saveConfig();
                    this.showNotification(`✅ Chat ID: ${chatId}`, 'success');
                }
            } catch (error) {
                console.error('Error getting chat ID:', error);
            }
        },

        // ============================================
        // API CALLS - WITH BETTER ERROR HANDLING
        // ============================================
        async makeRequest(action, params = {}) {
            if (!this.state.gasUrl || !this.state.sheetId) {
                this.showNotification('⚠️ Sheet ID dan GAS URL harus diisi!', 'warning');
                return null;
            }

            // Build URL with query params
            const url = new URL(this.state.gasUrl);
            url.searchParams.append('action', action);
            url.searchParams.append('sheetId', this.state.sheetId);

            for (let key in params) {
                if (params[key] !== undefined && params[key] !== null) {
                    url.searchParams.append(key, params[key]);
                }
            }

            console.log('[n8nModule] Making request to:', url.toString());

            try {
                this.setStatus('🟡', 'Loading...');

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

                const response = await fetch(url.toString(), {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    signal: controller.signal,
                    mode: 'cors' // Explicitly request CORS mode
                });

                clearTimeout(timeoutId);

                console.log('[n8nModule] Response status:', response.status);

                if (!response.ok) {
                    throw new Error('HTTP ' + response.status + ': ' + response.statusText);
                }

                const data = await response.json();
                console.log('[n8nModule] Response data:', data);

                this.setStatus('🟢', 'Siap');
                return data;
            } catch (error) {
                console.error('[n8nModule] API Error:', error);
                this.setStatus('🔴', 'Error');

                let errorMsg = error.message;
                if (error.name === 'AbortError') {
                    errorMsg = 'Request timeout (30s). Cek koneksi internet.';
                } else if (error.message.includes('Failed to fetch')) {
                    errorMsg = 'CORS Error atau GAS tidak accessible. Pastikan: 1) GAS sudah deploy sebagai Web App, 2) Access: ANYONE, 3) Cek console untuk detail';
                }

                this.showNotification('❌ ' + errorMsg, 'error');
                return null;
            }
        },

        // ============================================
        // CRUD OPERATIONS
        // ============================================
        async handleSearch() {
            const keyword = document.getElementById('searchInput').value.toLowerCase().trim();

            console.log('[n8nModule] Searching with keyword:', keyword);

            const result = await this.makeRequest('getData');
            if (!result) return;

            if (!result.success) {
                this.showNotification('❌ Error: ' + (result.error || 'Unknown error'), 'error');
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

            console.log('[n8nModule] Filtered data:', this.state.filteredData);
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
            console.log('[n8nModule] HandleEdit called, selectedRow:', this.state.selectedRow);

            if (!this.state.selectedRow) {
                this.showNotification('⚠️ Pilih data yang akan diedit (klik baris di tabel)', 'warning');
                return;
            }

            const item = this.state.filteredData.find(d => d.row == this.state.selectedRow);
            if (!item) {
                console.error('[n8nModule] Item not found for row:', this.state.selectedRow);
                this.showNotification('❌ Data tidak ditemukan', 'error');
                return;
            }

            console.log('[n8nModule] Editing item:', item);
            document.getElementById('modalTitle').textContent = 'Edit Data';
            document.getElementById('editId').value = item.row;
            document.getElementById('inputNama').value = item.nama || '';
            document.getElementById('inputNomor').value = item.nomor || '';
            this.openModal('dataModal');
        },

        handleDelete() {
            console.log('[n8nModule] HandleDelete called, selectedRow:', this.state.selectedRow);

            if (!this.state.selectedRow) {
                this.showNotification('⚠️ Pilih data yang akan dihapus (klik baris di tabel)', 'warning');
                return;
            }

            const item = this.state.filteredData.find(d => d.row == this.state.selectedRow);
            if (!item) {
                console.error('[n8nModule] Item not found for row:', this.state.selectedRow);
                this.showNotification('❌ Data tidak ditemukan', 'error');
                return;
            }

            console.log('[n8nModule] Deleting item:', item);
            document.getElementById('deleteInfo').textContent = `${item.nama || 'N/A'} - ${item.nomor || 'N/A'}`;
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

            console.log('[n8nModule] Saving data:', { action, params });

            const result = await this.makeRequest(action, params);
            if (result && result.success) {
                this.closeModal();
                this.handleSearch();
                this.showNotification(result.message || '✅ Data berhasil disimpan', 'success');
            } else if (result) {
                this.showNotification('❌ Error: ' + (result.error || 'Gagal menyimpan data'), 'error');
            }
        },

        async confirmDelete() {
            console.log('[n8nModule] Confirming delete for row:', this.state.selectedRow);

            const result = await this.makeRequest('deleteData', { row: this.state.selectedRow });
            if (result && result.success) {
                this.closeModal();
                this.state.selectedRow = null;
                this.updateButtonStates();
                this.handleSearch();
                this.showNotification(result.message || '✅ Data berhasil dihapus', 'success');
            } else if (result) {
                this.showNotification('❌ Error: ' + (result.error || 'Gagal menghapus data'), 'error');
            }
        },

        // ============================================
        // TABLE RENDERING - FIXED SELECTION
        // ============================================
        renderTable() {
            const tbody = document.getElementById('tableBody');
            console.log('[n8nModule] Rendering table with', this.state.filteredData.length, 'rows');

            if (this.state.filteredData.length === 0) {
                tbody.innerHTML = `
                    <tr class="n8n-empty-row">
                        <td colspan="4" class="n8n-empty-message">
                            <div class="empty-state">
                                <span class="empty-icon">📭</span>
                                <p>Belum ada data. Klik "Cari Data" untuk memuat data.</p>
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

            // Attach click handlers to rows
            const rows = tbody.querySelectorAll('.n8n-data-row');
            rows.forEach(row => {
                row.addEventListener('click', (e) => {
                    // Don't trigger if clicking the select button directly
                    if (e.target.closest('.n8n-btn-select')) {
                        return;
                    }
                    const rowNum = parseInt(row.getAttribute('data-row'));
                    console.log('[n8nModule] Row clicked:', rowNum);
                    this.selectRow(rowNum);
                });
            });

            // Attach click handlers to select buttons
            const selectBtns = tbody.querySelectorAll('.n8n-btn-select');
            selectBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent row click
                    const rowNum = parseInt(btn.getAttribute('data-row'));
                    console.log('[n8nModule] Select button clicked:', rowNum);
                    this.selectRow(rowNum);
                });
            });

            this.updateButtonStates();
        },

        selectRow(row) {
            console.log('[n8nModule] selectRow called:', row, 'current:', this.state.selectedRow);

            if (this.state.selectedRow === row) {
                this.state.selectedRow = null; // Deselect if same row
                console.log('[n8nModule] Deselected row');
            } else {
                this.state.selectedRow = row;
                console.log('[n8nModule] Selected row:', row);
            }

            this.renderTable(); // Re-render to update UI
        },

        updateButtonStates() {
            const editBtn = document.getElementById('btnEdit');
            const deleteBtn = document.getElementById('btnDelete');

            const hasSelection = this.state.selectedRow !== null;

            if (editBtn) {
                editBtn.disabled = !hasSelection;
                console.log('[n8nModule] Edit button disabled:', !hasSelection);
            }
            if (deleteBtn) {
                deleteBtn.disabled = !hasSelection;
                console.log('[n8nModule] Delete button disabled:', !hasSelection);
            }
        },

        async testConnection() {
            this.state.sheetId = document.getElementById('sheetId').value;
            this.state.sheetName = document.getElementById('sheetName').value;
            this.state.gasUrl = document.getElementById('gasUrl').value;
            this.state.botToken = document.getElementById('botToken').value;

            console.log('[n8nModule] Testing connection with:', {
                sheetId: this.state.sheetId,
                sheetName: this.state.sheetName,
                gasUrl: this.state.gasUrl
            });

            const result = await this.makeRequest('test');
            if (result && result.success) {
                this.showNotification(`✅ ${result.message} | Sheets: ${(result.sheets || []).join(', ')}`, 'success');

                if (this.state.botToken && !this.state.chatId) {
                    this.getChatId();
                }
            } else if (result) {
                this.showNotification('❌ Error: ' + (result.error || 'Koneksi gagal'), 'error');
            }
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
            if (badgeEl) badgeEl.textContent = badge;
            if (textEl) textEl.textContent = text;
        },

        showNotification(message, type = 'info') {
            const notif = document.getElementById('notification');
            if (!notif) return;

            notif.textContent = message;
            notif.className = `n8n-notification show ${type}`;

            setTimeout(() => {
                notif.classList.remove('show');
            }, 4000);
        }
    };

    // Expose to global scope
    window.n8nModule = n8nModule;
    console.log('[n8nModule] Module exposed to window.n8nModule');

})();

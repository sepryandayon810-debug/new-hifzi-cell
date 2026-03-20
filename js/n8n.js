// ============================================
// N8N DATA MANAGEMENT MODULE - AUTO GAS GENERATOR
// ============================================
// Fitur: Auto-generate GAS code, One-click deploy guide, Better error handling

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
            gasCode: localStorage.getItem('n8n_gas_code') || '',
            isLoading: false
        },

        init() {
            console.log('[n8nModule] ✅ Auto-GAS Generator Version Loaded');
            this.loadConfig();

            // Bind all methods
            this.handleSearch = this.handleSearch.bind(this);
            this.handleAdd = this.handleAdd.bind(this);
            this.handleEdit = this.handleEdit.bind(this);
            this.handleDelete = this.handleDelete.bind(this);
            this.toggleConfig = this.toggleConfig.bind(this);
            this.saveConfig = this.saveConfig.bind(this);
            this.testConnection = this.testConnection.bind(this);
            this.generateGAS = this.generateGAS.bind(this);
            this.copyGASCode = this.copyGASCode.bind(this);
            this.saveGASCode = this.saveGASCode.bind(this);
            this.loadGASCode = this.loadGASCode.bind(this);
            this.getChatId = this.getChatId.bind(this);
            this.selectRow = this.selectRow.bind(this);
            this.renderTable = this.renderTable.bind(this);
            this.openGASDeployPage = this.openGASDeployPage.bind(this);
        },

        loadConfig() {
            const saved = localStorage.getItem('n8n_config');
            if (saved) {
                try {
                    const config = JSON.parse(saved);
                    Object.assign(this.state, config);
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

            // Backup individual keys
            localStorage.setItem('n8n_gas_url', this.state.gasUrl);
            localStorage.setItem('n8n_sheet_id', this.state.sheetId);
            localStorage.setItem('n8n_sheet_name', this.state.sheetName);
            localStorage.setItem('n8n_bot_token', this.state.botToken);
            localStorage.setItem('n8n_chat_id', this.state.chatId);
            localStorage.setItem('n8n_gas_code', this.state.gasCode);

            this.showNotification('✅ Konfigurasi tersimpan!', 'success');
        },

        renderPage() {
            console.log('[n8nModule] Rendering page...');
            const mainContent = document.getElementById('mainContent');
            if (!mainContent) {
                console.error('[n8nModule] mainContent not found');
                return;
            }

            mainContent.innerHTML = this.getHTML();
            this.attachEventListeners();

            // Set form values
            document.getElementById('sheetId').value = this.state.sheetId;
            document.getElementById('sheetName').value = this.state.sheetName;
            document.getElementById('gasUrl').value = this.state.gasUrl;
            document.getElementById('botToken').value = this.state.botToken;
            document.getElementById('chatId').value = this.state.chatId;

            // Load saved GAS code
            if (this.state.gasCode) {
                document.getElementById('gasCodeEditor').value = this.state.gasCode;
            } else {
                // Auto-generate if empty
                this.generateGAS();
            }

            if (this.state.botToken && !this.state.chatId) {
                this.getChatId();
            }
        },

        getHTML() {
            return `
                <div class="n8n-container">
                    <div class="n8n-header">
                        <h2>🔍 Pencarian Data N8N</h2>
                        <p>Kelola data nama dan nomor dari Google Sheets</p>
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
                        <button class="n8n-btn n8n-btn-ghost" id="btnToggleConfig">
                            <span class="icon">⚙️</span>
                            <span>Konfigurasi & GAS Setup</span>
                            <span class="toggle-arrow" id="configArrow">▼</span>
                        </button>
                    </div>

                    <!-- CONFIGURATION SECTION -->
                    <div class="n8n-config-section" id="configSection" style="display: none;">

                        <!-- STEP 1: GAS CODE -->
                        <div class="n8n-config-card">
                            <div class="step-header">
                                <span class="step-number">1</span>
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

                        <!-- STEP 2: CONNECTION SETTINGS -->
                        <div class="n8n-config-card">
                            <div class="step-header">
                                <span class="step-number">2</span>
                                <h3>⚙️ Pengaturan Koneksi</h3>
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
                                <small>URL dari deployment Web App (lihat langkah 3)</small>
                            </div>

                            <div class="n8n-divider"></div>

                            <div class="n8n-form-group">
                                <label>Telegram Bot Token (Opsional)</label>
                                <input type="password" id="botToken" class="n8n-input" placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz">
                                <small>Dari @BotFather - Chat ID akan auto-detect</small>
                            </div>

                            <div class="n8n-form-group">
                                <label>Telegram Chat ID (Auto-detect)</label>
                                <input type="text" id="chatId" class="n8n-input" placeholder="Klik Test Koneksi untuk mendapatkan Chat ID" readonly>
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
                        </div>

                        <!-- STEP 3: DEPLOY GUIDE -->
                        <div class="n8n-config-card">
                            <div class="step-header">
                                <span class="step-number">3</span>
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
                            <button class="n8n-btn n8n-btn-primary" id="btnSave">Simpan</button>
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
            document.getElementById('btnSaveConfig')?.addEventListener('click', () => {
                this.state.sheetId = document.getElementById('sheetId').value.trim();
                this.state.sheetName = document.getElementById('sheetName').value.trim() || 'Data Base Hifzi Cell';
                this.state.gasUrl = document.getElementById('gasUrl').value.trim();
                this.state.botToken = document.getElementById('botToken').value.trim();
                this.state.chatId = document.getElementById('chatId').value.trim();
                this.saveConfig();
            });
            document.getElementById('btnTest')?.addEventListener('click', this.testConnection);

            // GAS
            document.getElementById('btnGenerateGAS')?.addEventListener('click', this.generateGAS);
            document.getElementById('btnCopyGAS')?.addEventListener('click', this.copyGASCode);
            document.getElementById('btnOpenGAS')?.addEventListener('click', this.openGASDeployPage);

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
        // AUTO GAS GENERATOR
        // ============================================
        generateGAS() {
            const sheetName = document.getElementById('sheetName')?.value?.trim() || this.state.sheetName || 'Data Base Hifzi Cell';

            const gasCode = `// ============================================
// GOOGLE APPS SCRIPT - N8N Data Module
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

            document.getElementById('gasCodeEditor').value = gasCode;
            this.state.gasCode = gasCode;
            this.saveConfig();

            this.showNotification('✅ Kode GAS generated & tersimpan otomatis!', 'success');
        },

        copyGASCode() {
            const textarea = document.getElementById('gasCodeEditor');
            if (!textarea.value.trim()) {
                this.showNotification('⚠️ Tidak ada kode untuk di-copy', 'warning');
                return;
            }

            textarea.select();
            textarea.setSelectionRange(0, 99999); // For mobile

            try {
                navigator.clipboard.writeText(textarea.value).then(() => {
                    this.showNotification('✅ Kode GAS copied to clipboard!', 'success');
                }).catch(() => {
                    // Fallback
                    document.execCommand('copy');
                    this.showNotification('✅ Kode GAS copied!', 'success');
                });
            } catch (e) {
                document.execCommand('copy');
                this.showNotification('✅ Kode GAS copied!', 'success');
            }
        },

        saveGASCode() {
            const code = document.getElementById('gasCodeEditor').value;
            if (!code.trim()) {
                this.showNotification('⚠️ Generate kode dulu', 'warning');
                return;
            }
            this.state.gasCode = code;
            this.saveConfig();
        },

        loadGASCode() {
            if (this.state.gasCode) {
                document.getElementById('gasCodeEditor').value = this.state.gasCode;
                this.showNotification('✅ Kode GAS dimuat!', 'success');
            }
        },

        openGASDeployPage() {
            window.open('https://script.google.com', '_blank');
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
                } else {
                    document.getElementById('chatId').placeholder = 'Kirim pesan ke bot dulu, lalu test lagi';
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

            const url = new URL(this.state.gasUrl);
            url.searchParams.append('action', action);
            url.searchParams.append('sheetId', this.state.sheetId);

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

                const response = await fetch(url.toString(), {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json'
                    },
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                console.log('[n8nModule] Response status:', response.status);

                if (!response.ok) {
                    throw new Error('HTTP ' + response.status);
                }

                const data = await response.json();
                console.log('[n8nModule] Response:', data);

                this.setStatus('🟢', 'Siap');
                return data;
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
        // CRUD OPERATIONS
        // ============================================
        async handleSearch() {
            const keyword = document.getElementById('searchInput').value.toLowerCase().trim();

            const result = await this.makeRequest('getData');
            if (!result) return;

            if (!result.success) {
                this.showNotification('❌ Error: ' + (result.error || 'Unknown'), 'error');
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
            this.showNotification(`✅ ${this.state.filteredData.length} data ditemukan`, 'success');
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
                this.showNotification('⚠️ Pilih data di tabel terlebih dahulu', 'warning');
                return;
            }

            const item = this.state.filteredData.find(d => d.row == this.state.selectedRow);
            if (!item) {
                this.showNotification('❌ Data tidak ditemukan', 'error');
                return;
            }

            document.getElementById('modalTitle').textContent = 'Edit Data';
            document.getElementById('editId').value = item.row;
            document.getElementById('inputNama').value = item.nama || '';
            document.getElementById('inputNomor').value = item.nomor || '';
            this.openModal('dataModal');
        },

        handleDelete() {
            if (!this.state.selectedRow) {
                this.showNotification('⚠️ Pilih data di tabel terlebih dahulu', 'warning');
                return;
            }

            const item = this.state.filteredData.find(d => d.row == this.state.selectedRow);
            if (!item) {
                this.showNotification('❌ Data tidak ditemukan', 'error');
                return;
            }

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

            const result = await this.makeRequest(action, params);
            if (result && result.success) {
                this.closeModal();
                this.handleSearch();
                this.showNotification(result.message || '✅ Data tersimpan', 'success');
            } else if (result) {
                this.showNotification('❌ ' + (result.error || 'Gagal menyimpan'), 'error');
            }
        },

        async confirmDelete() {
            const result = await this.makeRequest('deleteData', { row: this.state.selectedRow });
            if (result && result.success) {
                this.closeModal();
                this.state.selectedRow = null;
                this.updateButtonStates();
                this.handleSearch();
                this.showNotification(result.message || '✅ Data dihapus', 'success');
            } else if (result) {
                this.showNotification('❌ ' + (result.error || 'Gagal menghapus'), 'error');
            }
        },

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
            document.getElementById('btnEdit').disabled = !hasSelection;
            document.getElementById('btnDelete').disabled = !hasSelection;
        },

        async testConnection() {
            this.state.sheetId = document.getElementById('sheetId').value.trim();
            this.state.sheetName = document.getElementById('sheetName').value.trim() || 'Data Base Hifzi Cell';
            this.state.gasUrl = document.getElementById('gasUrl').value.trim();
            this.state.botToken = document.getElementById('botToken').value.trim();

            if (!this.state.sheetId || !this.state.gasUrl) {
                this.showNotification('⚠️ Sheet ID dan GAS URL wajib diisi!', 'warning');
                return;
            }

            const result = await this.makeRequest('test');
            if (result && result.success) {
                this.showNotification(`✅ ${result.message} | Sheets: ${(result.sheets || []).join(', ')}`, 'success');

                if (this.state.botToken && !this.state.chatId) {
                    this.getChatId();
                }
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

    window.n8nModule = n8nModule;
})();

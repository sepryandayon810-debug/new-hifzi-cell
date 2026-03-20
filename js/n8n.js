/**
 * n8n Module - Data Management (Cari, Edit, Tambah, Hapus)
 * Integrasi dengan Google Sheets via Google Apps Script
 * Model sama seperti TelegramModule.SaldoModule
 */

const n8nModule = {
    // Konfigurasi default (sama dengan bot Telegram n8n Anda)
    config: {
        sheetId: '1cPolj_xpBztq6RU3XVi_CZm1j_Kqo-zQC-wsbIYrLXE',
        sheetName: 'Data Base Hifzi Cell',
        scriptUrl: '',
        gasCode: ''
    },

    // State
    data: [],
    isLoading: false,
    currentMode: 'search', // search, add, edit, delete
    transaksiAktif: null,

    // Storage keys
    STORAGE_KEY: 'n8n_module_config',
    STORAGE_KEY_DATA: 'n8n_module_data',

    /**
     * Google Apps Script Code Template
     */
    GAS_CODE: `function doGet(e) {
  const action = e.parameter.action;
  const sheetId = e.parameter.sheetId;
  const sheetName = e.parameter.sheetName || 'Data Base Hifzi Cell';

  if (!sheetId) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Sheet ID diperlukan'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: 'Sheet tidak ditemukan: ' + sheetName
      })).setMimeType(ContentService.MimeType.JSON);
    }

    switch(action) {
      case 'search':
        return searchData(sheet, e.parameter.query);
      case 'add':
        return addData(sheet, e.parameter.nama, e.parameter.nomor);
      case 'edit':
        return editData(sheet, e.parameter.nama, e.parameter.nomor);
      case 'delete':
        return deleteData(sheet, e.parameter.nama);
      case 'test':
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          message: 'Koneksi berhasil!',
          timestamp: new Date().toISOString()
        })).setMimeType(ContentService.MimeType.JSON);
      default:
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          message: 'Action tidak valid: ' + action
        })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function searchData(sheet, query) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const results = [];

  const queryUpper = query.toUpperCase();

  for(let i = 1; i < data.length; i++) {
    const nama = String(data[i][0] || '').toUpperCase();
    if(nama.includes(queryUpper)) {
      const row = {};
      headers.forEach((header, index) => {
        row[header] = data[i][index];
      });
      row._rowNumber = i + 1;
      results.push(row);
    }
  }

  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    data: results,
    count: results.length
  })).setMimeType(ContentService.MimeType.JSON);
}

function addData(sheet, nama, nomor) {
  const data = sheet.getDataRange().getValues();
  const namaUpper = nama.toUpperCase();

  for(let i = 1; i < data.length; i++) {
    if(String(data[i][0] || '').toUpperCase() === namaUpper) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: 'Data dengan nama ' + nama + ' sudah ada!'
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  sheet.appendRow([namaUpper, nomor]);

  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    message: 'Data berhasil ditambahkan',
    data: { nama: namaUpper, nomor: nomor }
  })).setMimeType(ContentService.MimeType.JSON);
}

function editData(sheet, nama, nomor) {
  const data = sheet.getDataRange().getValues();
  const namaUpper = nama.toUpperCase();

  for(let i = 1; i < data.length; i++) {
    if(String(data[i][0] || '').toUpperCase() === namaUpper) {
      sheet.getRange(i + 1, 2).setValue(nomor);
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: 'Data berhasil diupdate',
        data: { nama: namaUpper, nomor: nomor, row: i + 1 }
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService.createTextOutput(JSON.stringify({
    success: false,
    message: 'Data dengan nama ' + nama + ' tidak ditemukan'
  })).setMimeType(ContentService.MimeType.JSON);
}

function deleteData(sheet, nama) {
  const data = sheet.getDataRange().getValues();
  const namaUpper = nama.toUpperCase();

  for(let i = 1; i < data.length; i++) {
    if(String(data[i][0] || '').toUpperCase() === namaUpper) {
      const deletedNama = data[i][0];
      const deletedNomor = data[i][1];
      sheet.deleteRow(i + 1);
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: 'Data berhasil dihapus',
        data: { nama: deletedNama, nomor: deletedNomor }
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService.createTextOutput(JSON.stringify({
    success: false,
    message: 'Data dengan nama ' + nama + ' tidak ditemukan'
  })).setMimeType(ContentService.MimeType.JSON);
}`,

    /**
     * Initialize module
     */
    init() {
        this.loadConfig();
        console.log('[n8n] Module initialized');
    },

    /**
     * Load config from localStorage
     */
    loadConfig() {
        try {
            const saved = localStorage.getItem(this.STORAGE_KEY);
            if (saved) {
                this.config = { ...this.config, ...JSON.parse(saved) };
            }
        } catch (e) {
            console.error('[n8n] Error loading config:', e);
        }
    },

    /**
     * Save config to localStorage
     */
    saveConfig() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.config));
        } catch (e) {
            console.error('[n8n] Error saving config:', e);
        }
    },

    /**
     * Build URL untuk API call (sama seperti SaldoModule)
     */
    buildUrl(action, params = {}) {
        let url = `${this.config.scriptUrl}?action=${action}&sheetId=${this.config.sheetId}&sheetName=${encodeURIComponent(this.config.sheetName)}`;

        Object.keys(params).forEach(key => {
            if (params[key] !== undefined && params[key] !== null) {
                url += `&${key}=${encodeURIComponent(params[key])}`;
            }
        });

        return url;
    },

    /**
     * API Call dengan error handling
     */
    async apiCall(action, params = {}) {
        if (!this.config.scriptUrl) {
            throw new Error('Script URL belum diisi!');
        }

        const url = this.buildUrl(action, params);

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('[n8n] API Error:', error);
            throw error;
        }
    },

    /**
     * Render main page
     */
    renderPage() {
        const container = document.getElementById('mainContent');
        if (!container) {
            console.error('[n8n] mainContent not found');
            return;
        }

        container.innerHTML = this.getHTML();
        this.attachEventListeners();

        // Restore focus jika ada transaksi aktif
        if (this.transaksiAktif) {
            setTimeout(() => {
                const input = document.getElementById('n8nInput');
                if (input) {
                    input.focus();
                    input.select();
                }
            }, 100);
        }
    },

    /**
     * Get HTML template
     */
    getHTML() {
        const isConfigured = this.config.scriptUrl && this.config.scriptUrl.length > 10;
        const validation = this.validateConfig();

        return `
        <div class="n8n-container">
            <!-- Header -->
            <div class="n8n-header">
                <div class="n8n-header-icon">🔍</div>
                <div class="n8n-header-info">
                    <div class="n8n-header-title">Pencarian Data</div>
                    <div class="n8n-header-subtitle">Cari, Tambah, Edit, Hapus Data Customer</div>
                </div>
                <div class="n8n-status ${isConfigured ? 'ready' : 'inactive'}">
                    ${isConfigured ? '✅ Siap' : '⚠️ Setup'}
                </div>
            </div>

            <!-- Mode Tabs -->
            <div class="n8n-tabs">
                <button class="n8n-tab ${this.currentMode === 'search' ? 'active' : ''}" data-mode="search">
                    🔍 Cari
                </button>
                <button class="n8n-tab ${this.currentMode === 'add' ? 'active' : ''}" data-mode="add">
                    ➕ Tambah
                </button>
                <button class="n8n-tab ${this.currentMode === 'edit' ? 'active' : ''}" data-mode="edit">
                    ✏️ Edit
                </button>
                <button class="n8n-tab ${this.currentMode === 'delete' ? 'active' : ''}" data-mode="delete">
                    🗑️ Hapus
                </button>
            </div>

            <!-- Warning Config -->
            ${!validation.valid ? `
            <div class="n8n-warning">
                <div class="n8n-warning-title">⚠️ Konfigurasi Belum Lengkap</div>
                <ul class="n8n-warning-list">
                    ${validation.errors.map(e => `<li>${e}</li>`).join('')}
                </ul>
                <div class="n8n-warning-hint">Scroll ke bawah untuk mengisi konfigurasi</div>
            </div>
            ` : ''}

            <!-- Action Section -->
            <div class="n8n-action-box">
                <div class="n8n-action-title">${this.getActionTitle()}</div>
                <div class="n8n-input-group">
                    <input type="text" id="n8nInput" class="n8n-input n8n-input-large" 
                        placeholder="${this.getInputPlaceholder()}"
                        value="${this.transaksiAktif ? this.transaksiAktif.inputValue || '' : ''}">
                    <button class="n8n-btn n8n-btn-action ${!validation.valid ? 'disabled' : ''}" 
                            onclick="n8nModule.executeAction()"
                            ${!validation.valid ? 'disabled' : ''}>
                        ${this.getActionButtonText()}
                    </button>
                </div>
                <div class="n8n-hint">${this.getHintText()}</div>
            </div>

            <!-- Results Section -->
            <div class="n8n-results" id="n8nResults"></div>

            <!-- Config Section -->
            <div class="n8n-config-section">
                <h3>☁️ Konfigurasi Google Sheets</h3>
                <div class="n8n-info-box">
                    <strong>📋 Cara Setup:</strong>
                    <ol>
                        <li>Buka <a href="https://script.google.com" target="_blank">script.google.com</a></li>
                        <li>New Project → Copy kode di bawah → Save</li>
                        <li>Deploy → New deployment → Web App</li>
                        <li><strong>Execute as:</strong> Me | <strong>Access:</strong> Anyone</li>
                        <li>Copy URL Web App ke kolom "Script URL" di bawah</li>
                    </ol>
                </div>

                <div class="n8n-form-row">
                    <div class="n8n-form-group" style="flex: 2;">
                        <label>Google Sheet ID</label>
                        <input type="text" id="n8nSheetId" class="n8n-input" 
                            value="${this.config.sheetId}" placeholder="1cPolj_xpBztq6RU3XVi_CZm1j_Kqo-zQC-wsbIYrLXE">
                        <div class="n8n-hint">Dari URL: docs.google.com/spreadsheets/d/<strong>SheetID</strong>/edit</div>
                    </div>
                    <div class="n8n-form-group">
                        <label>Nama Sheet</label>
                        <input type="text" id="n8nSheetName" class="n8n-input" 
                            value="${this.config.sheetName}" placeholder="Data Base Hifzi Cell">
                    </div>
                </div>
                <div class="n8n-form-row">
                    <div class="n8n-form-group" style="flex: 1;">
                        <label>Script URL (GAS Web App) <span style="color: red;">*</span></label>
                        <input type="text" id="n8nScriptUrl" class="n8n-input" 
                            value="${this.config.scriptUrl}" placeholder="https://script.google.com/macros/s/.../exec">
                        <div class="n8n-hint"><strong>WAJIB:</strong> Deploy dengan "Access: Anyone"</div>
                    </div>
                </div>
                <div class="n8n-actions">
                    <button class="n8n-btn n8n-btn-primary" onclick="n8nModule.saveConfigFromUI()">💾 Simpan Config</button>
                    <button class="n8n-btn n8n-btn-secondary" onclick="n8nModule.testConnection()">🔗 Test Koneksi</button>
                </div>
                <div id="n8nTestResult" style="margin-top: 12px;"></div>
            </div>

            <!-- GAS Code Section -->
            <div class="n8n-gas-section">
                <h3>📋 Kode Google Apps Script</h3>
                <button class="n8n-btn n8n-btn-gas" id="n8nBtnShowGas">📋 Copy Kode GAS</button>
                <div id="n8nGasContainer" style="display: none; margin-top: 16px;">
                    <div class="n8n-gas-header">
                        <span>Code.gs</span>
                        <button class="n8n-btn-small" onclick="n8nModule.copyGasCode()">📋 Copy</button>
                    </div>
                    <pre class="n8n-gas-code" id="n8nGasCode"></pre>
                </div>
            </div>

            <!-- Loading Overlay -->
            <div class="n8n-loading" id="n8nLoading" style="display: none;">
                <div class="n8n-spinner"></div>
                <div class="n8n-loading-text">Memproses...</div>
            </div>
        </div>
        `;
    },

    /**
     * Validate configuration
     */
    validateConfig() {
        const errors = [];

        if (!this.config.scriptUrl || this.config.scriptUrl.trim() === '') {
            errors.push('Script URL GAS belum diisi');
        }

        if (!this.config.sheetId || this.config.sheetId.trim() === '') {
            errors.push('Sheet ID belum diisi');
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    },

    /**
     * Get action title based on current mode
     */
    getActionTitle() {
        const titles = {
            search: '🔍 Cari Data Customer',
            add: '➕ Tambah Data Baru',
            edit: '✏️ Edit Nomor Customer',
            delete: '🗑️ Hapus Data Customer'
        };
        return titles[this.currentMode] || 'Cari Data';
    },

    /**
     * Get input placeholder
     */
    getInputPlaceholder() {
        const placeholders = {
            search: 'Ketik nama yang dicari...',
            add: 'Format: NAMA:NOMOR (contoh: BUDI:08123456789)',
            edit: 'Format: NAMA:NOMOR_BARU (contoh: BUDI:08987654321)',
            delete: 'Ketik nama exact yang akan dihapus...'
        };
        return placeholders[this.currentMode] || 'Ketik di sini...';
    },

    /**
     * Get action button text
     */
    getActionButtonText() {
        const texts = {
            search: '🔍 Cari',
            add: '➕ Tambah',
            edit: '💾 Simpan',
            delete: '🗑️ Hapus'
        };
        return texts[this.currentMode] || 'Proses';
    },

    /**
     * Get hint text
     */
    getHintText() {
        const hints = {
            search: 'Ketik minimal 2 karakter untuk mencari (contoh: "BUDI")',
            add: 'Format wajib NAMA:NOMOR. Nama akan otomatis UPPERCASE. Contoh: BUDI:08123456789',
            edit: 'Masukkan nama yang sudah ada dan nomor baru. Contoh: BUDI:08987654321',
            delete: 'Masukkan nama exact (sama persis) untuk menghapus. Contoh: BUDI'
        };
        return hints[this.currentMode] || '';
    },

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Tab switching
        document.querySelectorAll('.n8n-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.currentMode = e.target.dataset.mode;
                this.transaksiAktif = null;
                this.renderPage();
            });
        });

        // Enter key on input
        const input = document.getElementById('n8nInput');
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.executeAction();
                }
            });
        }

        // GAS Code toggle
        const btnShow = document.getElementById('n8nBtnShowGas');
        const container = document.getElementById('n8nGasContainer');
        const display = document.getElementById('n8nGasCode');

        if (btnShow && container && display) {
            btnShow.addEventListener('click', () => {
                if (container.style.display === 'none') {
                    display.textContent = this.GAS_CODE;
                    container.style.display = 'block';
                    btnShow.textContent = '🔽 Sembunyikan Kode GAS';
                } else {
                    container.style.display = 'none';
                    btnShow.textContent = '📋 Copy Kode GAS';
                }
            });
        }
    },

    /**
     * Save config from UI inputs
     */
    saveConfigFromUI() {
        const sheetId = document.getElementById('n8nSheetId')?.value?.trim();
        const sheetName = document.getElementById('n8nSheetName')?.value?.trim();
        const scriptUrl = document.getElementById('n8nScriptUrl')?.value?.trim();

        this.config.sheetId = sheetId || this.config.sheetId;
        this.config.sheetName = sheetName || 'Data Base Hifzi Cell';
        this.config.scriptUrl = scriptUrl;

        this.saveConfig();

        this.showResult('success', '✅ Konfigurasi berhasil disimpan!');
        setTimeout(() => this.renderPage(), 1000);
    },

    /**
     * Test connection to GAS
     */
    async testConnection() {
        const resultDiv = document.getElementById('n8nTestResult');

        if (!this.config.scriptUrl) {
            resultDiv.innerHTML = '<div style="color: red;">❌ Script URL belum diisi!</div>';
            return;
        }

        resultDiv.innerHTML = '<div style="color: blue;">⏳ Testing koneksi...</div>';
        this.showLoading(true);

        try {
            const result = await this.apiCall('test');

            if (result.success) {
                resultDiv.innerHTML = `<div style="color: green;">✅ ${result.message}</div>`;
                this.showToast('✅ Koneksi ke Google Sheets berhasil!');
            } else {
                resultDiv.innerHTML = `<div style="color: red;">❌ ${result.message}</div>`;
            }
        } catch (error) {
            resultDiv.innerHTML = `<div style="color: red;">❌ Error: ${error.message}</div>`;
        } finally {
            this.showLoading(false);
        }
    },

    /**
     * Execute action based on current mode
     */
    async executeAction() {
        const input = document.getElementById('n8nInput')?.value?.trim();

        if (!input) {
            this.showResult('error', '❌ Input tidak boleh kosong!');
            return;
        }

        const validation = this.validateConfig();
        if (!validation.valid) {
            this.showResult('error', '❌ Konfigurasi belum lengkap!\n\n' + validation.errors.join('\n'));
            return;
        }

        this.showLoading(true);

        try {
            switch (this.currentMode) {
                case 'search':
                    await this.searchData(input);
                    break;
                case 'add':
                    await this.addData(input);
                    break;
                case 'edit':
                    await this.editData(input);
                    break;
                case 'delete':
                    await this.deleteData(input);
                    break;
            }
        } catch (error) {
            console.error('[n8n] Error:', error);
            this.showResult('error', '❌ Error: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    },

    /**
     * Search data
     */
    async searchData(query) {
        if (query.length < 2) {
            this.showResult('error', '❌ Ketik minimal 2 karakter!');
            return;
        }

        try {
            const result = await this.apiCall('search', { query: query });

            if (result.success) {
                this.displaySearchResults(result.data || [], query);
            } else {
                this.showResult('error', '❌ ' + (result.message || 'Gagal mencari data'));
            }
        } catch (error) {
            this.showResult('error', '❌ Gagal terhubung ke server. Cek koneksi internet dan Script URL.');
        }
    },

    /**
     * Display search results
     */
    displaySearchResults(data, query) {
        const resultsDiv = document.getElementById('n8nResults');

        if (data.length === 0) {
            resultsDiv.innerHTML = `
                <div class="n8n-result-empty">
                    <div class="n8n-result-empty-icon">🔍</div>
                    <div class="n8n-result-empty-text">Tidak ada data ditemukan untuk "${this.escapeHtml(query)}"</div>
                </div>
            `;
            return;
        }

        let html = `
            <div class="n8n-result-header">
                <span>📋 Ditemukan ${data.length} data untuk "${this.escapeHtml(query)}"</span>
            </div>
            <div class="n8n-result-list">
        `;

        data.forEach((item, index) => {
            const nama = item.NAMA || item.nama || 'N/A';
            const nomor = item.NOMOR || item.nomor || 'N/A';

            html += `
                <div class="n8n-result-item">
                    <div class="n8n-result-number">${index + 1}</div>
                    <div class="n8n-result-info">
                        <div class="n8n-result-name">${this.escapeHtml(nama)}</div>
                        <div class="n8n-result-phone">${this.escapeHtml(nomor)}</div>
                    </div>
                    <button class="n8n-result-copy" onclick="n8nModule.copyToClipboard('${this.escapeHtml(nomor)}')">
                        📋 Copy
                    </button>
                </div>
            `;
        });

        html += '</div>';
        resultsDiv.innerHTML = html;
    },

    /**
     * Add new data
     */
    async addData(input) {
        const parts = input.split(':');
        if (parts.length !== 2) {
            this.showResult('error', '❌ Format salah! Gunakan format NAMA:NOMOR\nContoh: BUDI:08123456789');
            return;
        }

        const nama = parts[0].trim();
        const nomor = parts[1].trim();

        if (!nama || !nomor) {
            this.showResult('error', '❌ Nama dan nomor tidak boleh kosong!');
            return;
        }

        try {
            const result = await this.apiCall('add', { nama: nama, nomor: nomor });

            if (result.success) {
                this.showResult('success', 
                    '✅ Data berhasil ditambahkan!\n\n' +
                    'Nama: ' + result.data.nama + '\n' +
                    'Nomor: ' + result.data.nomor
                );
                document.getElementById('n8nInput').value = '';
            } else {
                this.showResult('error', '❌ ' + (result.message || 'Gagal menambah data'));
            }
        } catch (error) {
            this.showResult('error', '❌ Gagal terhubung ke server.');
        }
    },

    /**
     * Edit data
     */
    async editData(input) {
        const parts = input.split(':');
        if (parts.length !== 2) {
            this.showResult('error', '❌ Format salah! Gunakan format NAMA:NOMOR_BARU\nContoh: BUDI:08987654321');
            return;
        }

        const nama = parts[0].trim();
        const nomor = parts[1].trim();

        if (!nama || !nomor) {
            this.showResult('error', '❌ Nama dan nomor baru tidak boleh kosong!');
            return;
        }

        try {
            const result = await this.apiCall('edit', { nama: nama, nomor: nomor });

            if (result.success) {
                this.showResult('success', 
                    '✅ Data berhasil diupdate!\n\n' +
                    'Nama: ' + result.data.nama + '\n' +
                    'Nomor Baru: ' + result.data.nomor
                );
                document.getElementById('n8nInput').value = '';
            } else {
                this.showResult('error', '❌ ' + (result.message || 'Gagal mengupdate data'));
            }
        } catch (error) {
            this.showResult('error', '❌ Gagal terhubung ke server.');
        }
    },

    /**
     * Delete data
     */
    async deleteData(nama) {
        if (!confirm('⚠️ Yakin ingin menghapus data "' + nama.toUpperCase() + '"?\n\nData yang dihapus tidak bisa dikembalikan!')) {
            return;
        }

        try {
            const result = await this.apiCall('delete', { nama: nama });

            if (result.success) {
                this.showResult('success', 
                    '✅ Data berhasil dihapus!\n\n' +
                    'Nama: ' + result.data.nama + '\n' +
                    'Nomor: ' + result.data.nomor
                );
                document.getElementById('n8nInput').value = '';
            } else {
                this.showResult('error', '❌ ' + (result.message || 'Gagal menghapus data'));
            }
        } catch (error) {
            this.showResult('error', '❌ Gagal terhubung ke server.');
        }
    },

    /**
     * Show loading state
     */
    showLoading(show) {
        const loading = document.getElementById('n8nLoading');
        if (loading) {
            loading.style.display = show ? 'flex' : 'none';
        }
    },

    /**
     * Show result message
     */
    showResult(type, message) {
        const resultsDiv = document.getElementById('n8nResults');
        if (resultsDiv) {
            resultsDiv.innerHTML = `
                <div class="n8n-result-message n8n-result-${type}">
                    <div class="n8n-result-message-icon">${type === 'success' ? '✅' : '❌'}</div>
                    <div class="n8n-result-message-text">${message.replace(/\n/g, '<br>')}</div>
                </div>
            `;
        }
    },

    /**
     * Copy to clipboard
     */
    copyToClipboard(text) {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(() => {
                this.showToast('📋 Nomor disalin: ' + text);
            }).catch(() => {
                this.fallbackCopy(text);
            });
        } else {
            this.fallbackCopy(text);
        }
    },

    fallbackCopy(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();

        try {
            document.execCommand('copy');
            this.showToast('📋 Nomor disalin: ' + text);
        } catch (err) {
            this.showToast('❌ Gagal copy');
        }

        document.body.removeChild(textarea);
    },

    copyGasCode() {
        this.copyToClipboard(this.GAS_CODE);
        this.showToast('✅ Kode GAS berhasil dicopy!');
    },

    /**
     * Show toast notification
     */
    showToast(message) {
        if (typeof showToast === 'function') {
            showToast(message);
        } else if (typeof utils !== 'undefined' && utils.showToast) {
            utils.showToast(message);
        } else {
            alert(message);
        }
    },

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => n8nModule.init());
} else {
    n8nModule.init();
}

console.log('[n8n] Data Management Module loaded - v1.0');

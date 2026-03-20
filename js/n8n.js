/**
 * N8N Integration Module - Data Management (Cari, Edit, Tambah, Hapus)
 * VERSI FILE LOKAL - Menggunakan Proxy untuk bypass CORS
 * Integrasi dengan n8n workflow untuk Google Sheets
 */

// Pastikan tidak ada konflik dengan module lain
if (typeof N8NModule === 'undefined') {

const N8NModule = (function() {
    'use strict';

    // Storage keys
    const STORAGE_KEY_CONFIG = 'n8n_data_config';
    const STORAGE_KEY_DATA = 'n8n_cached_data';

    // State
    let config = {
        sheetId: '1cPolj_xpBztq6RU3XVi_CZm1j_Kqo-zQC-wsbIYrLXE',
        sheetName: 'Data Base Hifzi Cell',
        scriptUrl: '',
        n8nWebhookUrl: '',
        useGasProxy: true,
        lastSync: 0
    };

    let cachedData = [];
    let isInitialized = false;
    let currentAction = null;
    let selectedItem = null;
    let searchResults = [];

    // GAS CODE TEMPLATE
    const GAS_CODE = `/**
 * Google Apps Script untuk N8N Data Management
 * Deploy sebagai Web App (Execute as: Me, Access: Anyone)
 */

const SHEET_NAME = 'Data Base Hifzi Cell';

function doGet(e) {
  console.log('doGet called:', JSON.stringify(e.parameter));

  try {
    if (e.parameter._method === 'POST' && e.parameter._body) {
      try {
        const postData = JSON.parse(decodeURIComponent(e.parameter._body));
        return handleAction(postData);
      } catch (err) {
        return jsonResponse({ success: false, error: 'Invalid _body JSON: ' + err.toString() });
      }
    }

    const action = e.parameter.action;

    if (action === 'test') {
      return jsonResponse({ 
        success: true, 
        message: 'Koneksi berhasil!',
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'getAll') {
      return getAllData(e.parameter.sheetId);
    }

    if (action === 'search') {
      return searchData(e.parameter.sheetId, e.parameter.keyword);
    }

    return jsonResponse({ 
      success: false, 
      error: 'Action tidak valid: ' + action,
      received: e.parameter
    });

  } catch (error) {
    console.error('Error in doGet:', error);
    return jsonResponse({ success: false, error: error.toString() });
  }
}

function doPost(e) {
  console.log('doPost called');

  try {
    let data;
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else {
      return jsonResponse({ success: false, error: 'No post data' });
    }

    return handleAction(data);

  } catch (error) {
    console.error('Error in doPost:', error);
    return jsonResponse({ success: false, error: error.toString() });
  }
}

function handleAction(data) {
  const action = data.action;
  console.log('Action:', action);

  switch(action) {
    case 'tambah':
      return tambahData(data);
    case 'edit':
      return editData(data);
    case 'hapus':
      return hapusData(data);
    case 'getAll':
      return getAllData(data.sheetId);
    case 'search':
      return searchData(data.sheetId, data.keyword);
    case 'test':
      return jsonResponse({ success: true, message: 'POST test OK' });
    default:
      return jsonResponse({ success: false, error: 'Unknown action: ' + action });
  }
}

function tambahData(data) {
  try {
    const sheetId = data.sheetId;
    const nama = data.nama;
    const nomor = data.nomor;

    if (!sheetId || !nama || !nomor) {
      return jsonResponse({ success: false, error: 'Sheet ID, Nama, dan Nomor diperlukan' });
    }

    const spreadsheet = SpreadsheetApp.openById(sheetId);
    let sheet = spreadsheet.getSheetByName(SHEET_NAME);

    if (!sheet) {
      sheet = spreadsheet.insertSheet(SHEET_NAME);
      const headers = ['NAMA', 'NOMOR'];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    }

    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      const namaRange = sheet.getRange(2, 1, lastRow - 1, 1);
      const namaValues = namaRange.getValues().flat();
      const existingIndex = namaValues.findIndex(n => n.toString().toUpperCase() === nama.toUpperCase());

      if (existingIndex !== -1) {
        return jsonResponse({ success: false, error: 'Data dengan nama \' + nama + '\' sudah ada' });
      }
    }

    const newRow = [nama.toUpperCase(), nomor.toUpperCase()];
    const rowNum = sheet.getLastRow() + 1;
    sheet.getRange(rowNum, 1, 1, newRow.length).setValues([newRow]);

    return jsonResponse({ 
      success: true, 
      message: 'Data berhasil ditambahkan',
      data: { row: rowNum, nama: nama.toUpperCase(), nomor: nomor.toUpperCase() }
    });

  } catch (error) {
    return jsonResponse({ success: false, error: error.toString() });
  }
}

function editData(data) {
  try {
    const sheetId = data.sheetId;
    const nama = data.nama;
    const nomorBaru = data.nomor;

    if (!sheetId || !nama || !nomorBaru) {
      return jsonResponse({ success: false, error: 'Data tidak lengkap' });
    }

    const spreadsheet = SpreadsheetApp.openById(sheetId);
    const sheet = spreadsheet.getSheetByName(SHEET_NAME);

    if (!sheet) {
      return jsonResponse({ success: false, error: 'Sheet tidak ditemukan' });
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return jsonResponse({ success: false, error: 'Data kosong' });
    }

    const namaRange = sheet.getRange(2, 1, lastRow - 1, 1);
    const namaValues = namaRange.getValues().flat();
    const rowIndex = namaValues.findIndex(n => n.toString().toUpperCase() === nama.toUpperCase());

    if (rowIndex === -1) {
      return jsonResponse({ success: false, error: 'Data dengan nama \' + nama + '\' tidak ditemukan' });
    }

    const actualRow = rowIndex + 2;
    sheet.getRange(actualRow, 2).setValue(nomorBaru.toUpperCase());

    return jsonResponse({ 
      success: true, 
      message: 'Data berhasil diupdate',
      data: { row: actualRow, nama: nama.toUpperCase(), nomor: nomorBaru.toUpperCase() }
    });

  } catch (error) {
    return jsonResponse({ success: false, error: error.toString() });
  }
}

function hapusData(data) {
  try {
    const sheetId = data.sheetId;
    const nama = data.nama;

    if (!sheetId || !nama) {
      return jsonResponse({ success: false, error: 'Sheet ID dan Nama diperlukan' });
    }

    const spreadsheet = SpreadsheetApp.openById(sheetId);
    const sheet = spreadsheet.getSheetByName(SHEET_NAME);

    if (!sheet) {
      return jsonResponse({ success: false, error: 'Sheet tidak ditemukan' });
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return jsonResponse({ success: false, error: 'Data kosong' });
    }

    const namaRange = sheet.getRange(2, 1, lastRow - 1, 1);
    const namaValues = namaRange.getValues().flat();
    const rowIndex = namaValues.findIndex(n => n.toString().toUpperCase() === nama.toUpperCase());

    if (rowIndex === -1) {
      return jsonResponse({ success: false, error: 'Data dengan nama \' + nama + '\' tidak ditemukan' });
    }

    const actualRow = rowIndex + 2;
    sheet.deleteRow(actualRow);

    return jsonResponse({ 
      success: true, 
      message: 'Data berhasil dihapus',
      data: { nama: nama.toUpperCase(), row: actualRow }
    });

  } catch (error) {
    return jsonResponse({ success: false, error: error.toString() });
  }
}

function getAllData(sheetId) {
  try {
    if (!sheetId) {
      return jsonResponse({ success: false, error: 'Sheet ID diperlukan' });
    }

    const spreadsheet = SpreadsheetApp.openById(sheetId);
    const sheet = spreadsheet.getSheetByName(SHEET_NAME);

    if (!sheet) {
      return jsonResponse({ success: true, data: [], message: 'Sheet kosong' });
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return jsonResponse({ success: true, data: [], message: 'Data kosong' });
    }

    const dataRange = sheet.getRange(2, 1, lastRow - 1, 2);
    const values = dataRange.getValues();

    const data = values.map((row, index) => ({
      row_number: index + 2,
      NAMA: row[0] || '',
      NOMOR: row[1] || ''
    }));

    return jsonResponse({ success: true, data: data, count: data.length });

  } catch (error) {
    return jsonResponse({ success: false, error: error.toString() });
  }
}

function searchData(sheetId, keyword) {
  try {
    if (!sheetId || !keyword) {
      return jsonResponse({ success: false, error: 'Sheet ID dan keyword diperlukan' });
    }

    const spreadsheet = SpreadsheetApp.openById(sheetId);
    const sheet = spreadsheet.getSheetByName(SHEET_NAME);

    if (!sheet) {
      return jsonResponse({ success: true, data: [], message: 'Sheet kosong' });
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return jsonResponse({ success: true, data: [], message: 'Data kosong' });
    }

    const dataRange = sheet.getRange(2, 1, lastRow - 1, 2);
    const values = dataRange.getValues();

    const keywords = keyword.toLowerCase().split(/\s+/).filter(k => k);

    const data = values.map((row, index) => ({
      row_number: index + 2,
      NAMA: row[0] || '',
      NOMOR: row[1] || ''
    })).filter(item => {
      const nama = item.NAMA.toLowerCase();
      return keywords.every(k => nama.includes(k));
    });

    return jsonResponse({ success: true, data: data, count: data.length, keyword: keyword });

  } catch (error) {
    return jsonResponse({ success: false, error: error.toString() });
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}`;

    // INIT
    function init() {
        if (isInitialized) return;
        isInitialized = true;

        console.log('[N8N] Initializing Data Management Module...');
        loadData();
    }

    function loadData() {
        try {
            const savedConfig = localStorage.getItem(STORAGE_KEY_CONFIG);
            if (savedConfig) config = { ...config, ...JSON.parse(savedConfig) };
        } catch (e) {
            console.error('[N8N] Error loading config:', e);
        }

        try {
            const savedData = localStorage.getItem(STORAGE_KEY_DATA);
            if (savedData) cachedData = JSON.parse(savedData);
        } catch (e) {
            console.error('[N8N] Error loading cached data:', e);
            cachedData = [];
        }
    }

    function saveData() {
        try {
            localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
            localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(cachedData));
        } catch (e) {
            console.error('[N8N] Error saving:', e);
        }
    }

    // API CALLS
    async function apiCall(payload) {
        const targetUrl = config.scriptUrl;

        if (!targetUrl) {
            throw new Error('Script URL belum diisi. Silahkan konfigurasi di pengaturan.');
        }

        // Method 1: Coba langsung
        if (window.location.protocol !== 'file:') {
            try {
                const response = await fetch(targetUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return await response.json();
            } catch (e) {
                console.log('[N8N] Direct fetch failed, trying proxy...', e.message);
            }
        }

        // Method 2: Gunakan proxy
        const getUrl = buildGetUrl(targetUrl, payload);
        console.log('[N8N Proxy] URL:', getUrl.substring(0, 100) + '...');

        const response = await fetch(getUrl, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.contents) {
            return JSON.parse(result.contents);
        }

        return result;
    }

    function buildGetUrl(baseUrl, data) {
        const params = new URLSearchParams();
        params.append('_method', 'POST');
        params.append('_body', JSON.stringify(data));
        return `${baseUrl}?${params.toString()}`;
    }

    // VALIDATION
    function validateConfig() {
        const errors = [];

        if (!config.scriptUrl || config.scriptUrl.trim() === '') {
            errors.push('Script URL GAS belum diisi');
        }

        if (!config.sheetId || config.sheetId.trim() === '') {
            errors.push('Sheet ID belum diisi');
        }

        return { valid: errors.length === 0, errors: errors };
    }

    // RENDER FUNCTIONS
    function renderPage() {
        const container = document.getElementById('mainContent');
        if (!container) {
            console.error('[N8N] mainContent not found');
            return;
        }

        const validation = validateConfig();
        const isFileProtocol = window.location.protocol === 'file:';

        let fileWarning = '';
        if (isFileProtocol) {
            fileWarning = renderFileWarning();
        }

        let warningHtml = '';
        if (!validation.valid) {
            warningHtml = renderConfigWarning(validation.errors);
        }

        try {
            container.innerHTML = `
                <div class="n8n-container">
                    ${renderHeader()}
                    ${fileWarning}
                    ${warningHtml}
                    ${currentAction === null ? renderModeSelection(validation.valid) : ''}
                    ${currentAction === 'tambah' ? renderTambahForm() : ''}
                    ${currentAction === 'cari' ? renderCariForm() : ''}
                    ${currentAction === 'edit' ? renderEditForm() : ''}
                    ${currentAction === 'hapus' ? renderHapusForm() : ''}
                    ${renderSearchResults()}
                    ${renderConfigSection()}
                    ${renderGasSection()}
                    ${renderDebugInfo()}
                </div>
            `;
        } catch (e) {
            console.error('[N8N] Render error:', e);
            container.innerHTML = `
                <div style="padding: 40px; text-align: center;">
                    <h3>❌ Error Render</h3>
                    <p>${e.message}</p>
                    <button onclick="N8NModule.renderPage()" style="padding: 10px 20px; margin-top: 20px;">
                        Coba Lagi
                    </button>
                </div>
            `;
        }
    }

    function renderFileWarning() {
        return `
            <div class="n8n-warning-box">
                <div class="n8n-warning-title">ℹ️ Mode File Lokal Terdeteksi</div>
                <div class="n8n-warning-text">
                    Menggunakan proxy untuk koneksi ke Google Sheets.
                    <br>Untuk performa lebih baik, gunakan web server (Live Server).
                </div>
                <div class="n8n-warning-actions">
                    <button onclick="N8NModule.testProxy()" class="n8n-btn n8n-btn-small n8n-btn-info">
                        🧪 Test Proxy
                    </button>
                </div>
            </div>
        `;
    }

    function renderConfigWarning(errors) {
        return `
            <div class="n8n-alert n8n-alert-warning">
                <div class="n8n-alert-title">⚠️ Konfigurasi Belum Lengkap</div>
                <ul class="n8n-alert-list">
                    ${errors.map(e => `<li>${e}</li>`).join('')}
                </ul>
                <div class="n8n-alert-hint">
                    Scroll ke bawah untuk mengisi konfigurasi
                </div>
            </div>
        `;
    }

    function renderHeader() {
        const validation = validateConfig();
        return `
            <div class="n8n-header">
                <div class="n8n-header-content">
                    <div class="n8n-icon">🔍</div>
                    <div>
                        <h2 class="n8n-title">Manajemen Data Pelanggan</h2>
                        <p class="n8n-subtitle">Cari, Edit, Tambah, Hapus Data</p>
                    </div>
                </div>
                <div class="n8n-badge ${validation.valid ? 'n8n-badge-success' : 'n8n-badge-warning'}">
                    ${validation.valid ? '✅ Ready' : '⚠️ Setup Required'}
                </div>
            </div>
        `;
    }

    function renderModeSelection(enabled) {
        const disabled = !enabled ? 'disabled' : '';

        return `
            <div class="n8n-mode-selection">
                <div class="n8n-info-box">
                    <strong>📋 Cara Penggunaan:</strong>
                    <ol>
                        <li><b>Tambah</b> - Menambah data pelanggan baru (Nama:Nomor)</li>
                        <li><b>Cari</b> - Mencari data berdasarkan nama</li>
                        <li><b>Edit</b> - Mengubah nomor data yang sudah ada</li>
                        <li><b>Hapus</b> - Menghapus data dari database</li>
                    </ol>
                </div>

                <div class="n8n-mode-grid">
                    <button onclick="N8NModule.setMode('tambah')" class="n8n-mode-btn n8n-mode-tambah" ${disabled}>
                        <span class="n8n-mode-icon">➕</span>
                        <span class="n8n-mode-label">Tambah Data</span>
                        <span class="n8n-mode-desc">Nama:Nomor</span>
                    </button>

                    <button onclick="N8NModule.setMode('cari')" class="n8n-mode-btn n8n-mode-cari" ${disabled}>
                        <span class="n8n-mode-icon">🔍</span>
                        <span class="n8n-mode-label">Cari Data</span>
                        <span class="n8n-mode-desc">Cari berdasarkan nama</span>
                    </button>

                    <button onclick="N8NModule.setMode('edit')" class="n8n-mode-btn n8n-mode-edit" ${disabled}>
                        <span class="n8n-mode-icon">✏️</span>
                        <span class="n8n-mode-label">Edit Data</span>
                        <span class="n8n-mode-desc">Ubah nomor</span>
                    </button>

                    <button onclick="N8NModule.setMode('hapus')" class="n8n-mode-btn n8n-mode-hapus" ${disabled}>
                        <span class="n8n-mode-icon">🗑️</span>
                        <span class="n8n-mode-label">Hapus Data</span>
                        <span class="n8n-mode-desc">Hapus permanen</span>
                    </button>
                </div>
            </div>
        `;
    }

    function renderTambahForm() {
        return `
            <div class="n8n-form-container">
                <div class="n8n-form-header n8n-form-header-tambah">
                    <button onclick="N8NModule.backToMenu()" class="n8n-back-btn">← Kembali</button>
                    <h3>➕ Tambah Data Baru</h3>
                </div>
                <div class="n8n-form-body">
                    <div class="n8n-input-group">
                        <label>Format: NAMA:NOMOR</label>
                        <input type="text" id="n8nTambahInput" 
                               placeholder="Contoh: BUDI:08123456789"
                               class="n8n-input"
                               onkeypress="if(event.key==='Enter')N8NModule.prosesTambah()">
                        <div class="n8n-input-hint">Gunakan tanda titik dua (:) sebagai pemisah</div>
                    </div>
                    <div class="n8n-form-actions">
                        <button onclick="N8NModule.prosesTambah()" class="n8n-btn n8n-btn-success n8n-btn-block">
                            ✅ SIMPAN KE DATABASE
                        </button>
                        <button onclick="N8NModule.backToMenu()" class="n8n-btn n8n-btn-secondary n8n-btn-block">
                            ❌ BATAL
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    function renderCariForm() {
        return `
            <div class="n8n-form-container">
                <div class="n8n-form-header n8n-form-header-cari">
                    <button onclick="N8NModule.backToMenu()" class="n8n-back-btn">← Kembali</button>
                    <h3>🔍 Cari Data</h3>
                </div>
                <div class="n8n-form-body">
                    <div class="n8n-input-group">
                        <label>Kata Kunci Pencarian</label>
                        <input type="text" id="n8nCariInput" 
                               placeholder="Masukkan nama yang dicari..."
                               class="n8n-input"
                               onkeypress="if(event.key==='Enter')N8NModule.prosesCari()">
                        <div class="n8n-input-hint">Bisa pakai sebagian nama (contoh: "budi" untuk "BUDI SANTOSO")</div>
                    </div>
                    <div class="n8n-form-actions">
                        <button onclick="N8NModule.prosesCari()" class="n8n-btn n8n-btn-primary n8n-btn-block">
                            🔍 CARI SEKARANG
                        </button>
                        <button onclick="N8NModule.loadAllData()" class="n8n-btn n8n-btn-info n8n-btn-block">
                            📋 TAMPILKAN SEMUA DATA
                        </button>
                        <button onclick="N8NModule.backToMenu()" class="n8n-btn n8n-btn-secondary n8n-btn-block">
                            ❌ BATAL
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    function renderEditForm() {
        return `
            <div class="n8n-form-container">
                <div class="n8n-form-header n8n-form-header-edit">
                    <button onclick="N8NModule.backToMenu()" class="n8n-back-btn">← Kembali</button>
                    <h3>✏️ Edit Data</h3>
                </div>
                <div class="n8n-form-body">
                    <div class="n8n-input-group">
                        <label>Format: NAMA:NOMOR_BARU</label>
                        <input type="text" id="n8nEditInput" 
                               placeholder="Contoh: BUDI:08198765432"
                               class="n8n-input"
                               onkeypress="if(event.key==='Enter')N8NModule.prosesEdit()">
                        <div class="n8n-input-hint">Nama harus persis sama dengan yang di database</div>
                    </div>
                    <div class="n8n-form-actions">
                        <button onclick="N8NModule.prosesEdit()" class="n8n-btn n8n-btn-warning n8n-btn-block">
                            ✏️ UPDATE DATA
                        </button>
                        <button onclick="N8NModule.backToMenu()" class="n8n-btn n8n-btn-secondary n8n-btn-block">
                            ❌ BATAL
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    function renderHapusForm() {
        return `
            <div class="n8n-form-container">
                <div class="n8n-form-header n8n-form-header-hapus">
                    <button onclick="N8NModule.backToMenu()" class="n8n-back-btn">← Kembali</button>
                    <h3>🗑️ Hapus Data</h3>
                </div>
                <div class="n8n-form-body">
                    <div class="n8n-alert n8n-alert-danger">
                        <strong>⚠️ PERINGATAN:</strong> Data yang dihapus tidak bisa dikembalikan!
                    </div>
                    <div class="n8n-input-group">
                        <label>Nama yang akan dihapus</label>
                        <input type="text" id="n8nHapusInput" 
                               placeholder="Masukkan nama lengkap..."
                               class="n8n-input"
                               onkeypress="if(event.key==='Enter')N8NModule.prosesHapus()">
                        <div class="n8n-input-hint">Nama harus persis sama dengan yang di database</div>
                    </div>
                    <div class="n8n-form-actions">
                        <button onclick="N8NModule.prosesHapus()" class="n8n-btn n8n-btn-danger n8n-btn-block">
                            🗑️ HAPUS PERMANEN
                        </button>
                        <button onclick="N8NModule.backToMenu()" class="n8n-btn n8n-btn-secondary n8n-btn-block">
                            ❌ BATAL
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    function renderSearchResults() {
        if (!searchResults || searchResults.length === 0) {
            return '';
        }

        return `
            <div class="n8n-results-container">
                <div class="n8n-results-header">
                    <h4>📋 Hasil Pencarian (${searchResults.length} data)</h4>
                    <button onclick="N8NModule.clearResults()" class="n8n-btn n8n-btn-small n8n-btn-secondary">
                        Tutup
                    </button>
                </div>
                <div class="n8n-results-list">
                    ${searchResults.map((item, index) => `
                        <div class="n8n-result-item">
                            <div class="n8n-result-number">${index + 1}</div>
                            <div class="n8n-result-content">
                                <div class="n8n-result-nama">${escapeHtml(item.NAMA)}</div>
                                <div class="n8n-result-nomor">${escapeHtml(item.NOMOR)}</div>
                            </div>
                            <div class="n8n-result-actions">
                                <button onclick="N8NModule.pilihUntukEdit('${escapeHtml(item.NAMA)}')" 
                                        class="n8n-btn n8n-btn-small n8n-btn-warning" title="Edit">✏️</button>
                                <button onclick="N8NModule.pilihUntukHapus('${escapeHtml(item.NAMA)}')" 
                                        class="n8n-btn n8n-btn-small n8n-btn-danger" title="Hapus">🗑️</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    function renderConfigSection() {
        return `
            <div class="n8n-config-section">
                <h3>☁️ Konfigurasi Google Sheet</h3>
                <div class="n8n-info-box n8n-info-box-success">
                    <strong>✅ Setup Required:</strong>
                    <ol>
                        <li>Buka <a href="https://script.google.com" target="_blank">script.google.com</a></li>
                        <li>New Project → Paste kode GAS di bawah → Save</li>
                        <li>Deploy → Web app → Execute as: Me, Access: Anyone</li>
                        <li>Copy URL Web App ke kolom "Script URL" di bawah</li>
                    </ol>
                </div>
                <div class="n8n-input-group">
                    <label>Google Sheet ID <span class="n8n-required">*</span></label>
                    <input type="text" id="n8nSheetId" value="${escapeHtml(config.sheetId)}" 
                           class="n8n-input" placeholder="1cPolj_xpBztq6RU3XVi_CZm1j_Kqo-zQC-wsbIYrLXE">
                    <div class="n8n-input-hint">Dari URL: docs.google.com/spreadsheets/d/<strong>SheetID</strong>/edit</div>
                </div>
                <div class="n8n-input-group">
                    <label>Script URL (GAS Web App) <span class="n8n-required">*</span></label>
                    <input type="text" id="n8nScriptUrl" value="${escapeHtml(config.scriptUrl)}" 
                           class="n8n-input" placeholder="https://script.google.com/macros/s/.../exec">
                    <div class="n8n-input-hint"><strong>WAJIB:</strong> Deploy dengan "Access: Anyone"</div>
                </div>
                <div class="n8n-form-actions">
                    <button onclick="N8NModule.saveConfig()" class="n8n-btn n8n-btn-primary">💾 Simpan Config</button>
                    <button onclick="N8NModule.testConnection()" class="n8n-btn n8n-btn-secondary">🔗 Test Koneksi</button>
                </div>
                <div id="n8nTestResult" class="n8n-test-result"></div>
            </div>
        `;
    }

    function renderGasSection() {
        return `
            <div class="n8n-gas-section">
                <h3>📋 Kode Google Apps Script</h3>
                <button onclick="N8NModule.toggleGasCode()" class="n8n-btn n8n-btn-gas" id="n8nBtnShowGas">
                    📋 Tampilkan Kode GAS
                </button>
                <div id="n8nGasCodeContainer" class="n8n-gas-code-container" style="display: none;">
                    <div class="n8n-gas-code-header">
                        <span>Code.gs</span>
                        <button onclick="N8NModule.copyGasCode()" class="n8n-btn n8n-btn-small n8n-btn-secondary">📋 Copy</button>
                    </div>
                    <pre class="n8n-gas-code" id="n8nGasCodeDisplay"></pre>
                </div>
            </div>
        `;
    }

    function renderDebugInfo() {
        const validation = validateConfig();
        return `
            <div class="n8n-debug-section">
                <div class="n8n-debug-title">🔧 Debug Info</div>
                <div class="n8n-debug-content">
                    <div>Protocol: ${window.location.protocol}</div>
                    <div>Host: ${window.location.host || 'localhost'}</div>
                    <div>Script URL: ${config.scriptUrl ? '✅ Set' : '❌ Empty'}</div>
                    <div>Sheet ID: ${config.sheetId ? '✅ Set' : '❌ Empty'}</div>
                    <div>Config Valid: ${validation.valid ? '✅ Yes' : '❌ No'}</div>
                    <div>Cached Data: ${cachedData.length} items</div>
                    <div>Current Mode: ${currentAction || 'Menu'}</div>
                </div>
            </div>
        `;
    }

    // ACTIONS
    function setMode(mode) {
        currentAction = mode;
        searchResults = [];
        renderPage();

        setTimeout(() => {
            const inputId = {
                'tambah': 'n8nTambahInput',
                'cari': 'n8nCariInput',
                'edit': 'n8nEditInput',
                'hapus': 'n8nHapusInput'
            }[mode];

            const input = document.getElementById(inputId);
            if (input) {
                input.focus();
                input.select();
            }
        }, 100);
    }

    function backToMenu() {
        currentAction = null;
        selectedItem = null;
        searchResults = [];
        renderPage();
    }

    function clearResults() {
        searchResults = [];
        renderPage();
    }

    // CRUD OPERATIONS
    async function prosesTambah() {
        const input = document.getElementById('n8nTambahInput');
        if (!input) return;

        const value = input.value.trim();

        if (!value.includes(':')) {
            showToast('❌ Format salah! Gunakan tanda titik dua (:)', 'error');
            input.focus();
            return;
        }

        const [nama, nomor] = value.split(':').map(s => s.trim());

        if (!nama || !nomor) {
            showToast('❌ Nama dan Nomor tidak boleh kosong!', 'error');
            return;
        }

        showToast('⏳ Menyimpan data...');

        try {
            const result = await apiCall({
                action: 'tambah',
                sheetId: config.sheetId,
                nama: nama,
                nomor: nomor
            });

            if (result.success) {
                showToast(`✅ Data ${result.data.nama} berhasil ditambahkan!`);
                input.value = '';

                cachedData.push({
                    row_number: result.data.row,
                    NAMA: result.data.nama,
                    NOMOR: result.data.nomor
                });
                saveData();

                setTimeout(() => {
                    if (confirm('✅ Data berhasil disimpan!\n\nMau tambah data lagi?')) {
                        input.focus();
                    } else {
                        backToMenu();
                    }
                }, 500);
            } else {
                throw new Error(result.error || 'Gagal menyimpan');
            }
        } catch (error) {
            console.error('[N8N] Error tambah:', error);
            showToast('❌ ' + error.message, 'error');
        }
    }

    async function prosesCari() {
        const input = document.getElementById('n8nCariInput');
        if (!input) return;

        const keyword = input.value.trim();

        if (!keyword) {
            showToast('❌ Masukkan kata kunci pencarian!', 'error');
            return;
        }

        showToast('🔍 Mencari data...');

        try {
            const result = await apiCall({
                action: 'search',
                sheetId: config.sheetId,
                keyword: keyword
            });

            if (result.success) {
                searchResults = result.data || [];

                if (searchResults.length === 0) {
                    showToast('❌ Tidak ditemukan data untuk: ' + keyword, 'error');
                } else {
                    showToast(`✅ Ditemukan ${searchResults.length} data`);
                }

                renderPage();
            } else {
                throw new Error(result.error || 'Gagal mencari');
            }
        } catch (error) {
            console.error('[N8N] Error cari:', error);
            showToast('❌ ' + error.message, 'error');
        }
    }

    async function loadAllData() {
        showToast('📋 Memuat semua data...');

        try {
            const result = await apiCall({
                action: 'getAll',
                sheetId: config.sheetId
            });

            if (result.success) {
                searchResults = result.data || [];
                cachedData = searchResults;
                saveData();

                showToast(`✅ ${searchResults.length} data dimuat`);
                renderPage();
            } else {
                throw new Error(result.error || 'Gagal memuat data');
            }
        } catch (error) {
            console.error('[N8N] Error load all:', error);
            showToast('❌ ' + error.message, 'error');
        }
    }

    async function prosesEdit() {
        const input = document.getElementById('n8nEditInput');
        if (!input) return;

        const value = input.value.trim();

        if (!value.includes(':')) {
            showToast('❌ Format salah! Gunakan NAMA:NOMOR_BARU', 'error');
            return;
        }

        const [nama, nomor] = value.split(':').map(s => s.trim());

        if (!nama || !nomor) {
            showToast('❌ Nama dan Nomor baru tidak boleh kosong!', 'error');
            return;
        }

        if (!confirm(`✏️ Update data\n\nNama: ${nama}\nNomor Baru: ${nomor}\n\nLanjutkan?`)) {
            return;
        }

        showToast('⏳ Mengupdate data...');

        try {
            const result = await apiCall({
                action: 'edit',
                sheetId: config.sheetId,
                nama: nama,
                nomor: nomor
            });

            if (result.success) {
                showToast(`✅ Data ${result.data.nama} berhasil diupdate!`);
                input.value = '';

                const index = cachedData.findIndex(d => d.NAMA === result.data.nama);
                if (index !== -1) {
                    cachedData[index].NOMOR = result.data.nomor;
                    saveData();
                }

                setTimeout(() => backToMenu(), 1000);
            } else {
                throw new Error(result.error || 'Gagal mengupdate');
            }
        } catch (error) {
            console.error('[N8N] Error edit:', error);
            showToast('❌ ' + error.message, 'error');
        }
    }

    async function prosesHapus() {
        const input = document.getElementById('n8nHapusInput');
        if (!input) return;

        const nama = input.value.trim();

        if (!nama) {
            showToast('❌ Masukkan nama yang akan dihapus!', 'error');
            return;
        }

        if (!confirm(`🗑️ HAPUS DATA PERMANEN\n\nNama: ${nama}\n\n⚠️ Data yang dihapus TIDAK BISA dikembalikan!\n\nYakin ingin menghapus?`)) {
            return;
        }

        showToast('⏳ Menghapus data...');

        try {
            const result = await apiCall({
                action: 'hapus',
                sheetId: config.sheetId,
                nama: nama
            });

            if (result.success) {
                showToast(`🗑️ Data ${result.data.nama} berhasil dihapus!`);
                input.value = '';

                cachedData = cachedData.filter(d => d.NAMA !== result.data.nama);
                saveData();

                setTimeout(() => backToMenu(), 1000);
            } else {
                throw new Error(result.error || 'Gagal menghapus');
            }
        } catch (error) {
            console.error('[N8N] Error hapus:', error);
            showToast('❌ ' + error.message, 'error');
        }
    }

    function pilihUntukEdit(nama) {
        const input = document.getElementById('n8nEditInput');
        if (input) {
            input.value = nama + ':';
        }
        setMode('edit');

        setTimeout(() => {
            const input = document.getElementById('n8nEditInput');
            if (input) {
                input.focus();
                input.setSelectionRange(input.value.length, input.value.length);
            }
        }, 100);
    }

    function pilihUntukHapus(nama) {
        const input = document.getElementById('n8nHapusInput');
        if (input) {
            input.value = nama;
        }
        setMode('hapus');
    }

    // CONFIG & UTILS
    function saveConfig() {
        const sheetIdInput = document.getElementById('n8nSheetId');
        const scriptUrlInput = document.getElementById('n8nScriptUrl');

        if (sheetIdInput) config.sheetId = sheetIdInput.value.trim();
        if (scriptUrlInput) config.scriptUrl = scriptUrlInput.value.trim();

        saveData();
        showToast('✅ Konfigurasi disimpan!');
        renderPage();
    }

    async function testConnection() {
        const resultDiv = document.getElementById('n8nTestResult');

        if (!config.scriptUrl) {
            if (resultDiv) resultDiv.innerHTML = '<div class="n8n-test-error">❌ Isi Script URL dulu</div>';
            return;
        }

        if (resultDiv) resultDiv.innerHTML = '<div class="n8n-test-loading">⏳ Testing...</div>';

        try {
            const result = await apiCall({ action: 'test' });

            if (result.success) {
                if (resultDiv) resultDiv.innerHTML = `<div class="n8n-test-success">✅ ${result.message}</div>`;
                showToast('✅ Koneksi berhasil!');
            } else {
                if (resultDiv) resultDiv.innerHTML = `<div class="n8n-test-error">❌ ${result.error}</div>`;
            }
        } catch (e) {
            if (resultDiv) resultDiv.innerHTML = `<div class="n8n-test-error">❌ Error: ${e.message}</div>`;
        }
    }

    async function testProxy() {
        showToast('🧪 Testing proxy...');

        try {
            const testUrl = 'https://api.allorigins.win/get?url=' + 
                           encodeURIComponent('https://httpbin.org/get');

            const response = await fetch(testUrl);
            const result = await response.json();

            if (result.contents) {
                alert('✅ Proxy berfungsi!\n\nAllOrigins proxy aktif.');
            } else {
                alert('⚠️ Proxy response tidak sesuai format');
            }
        } catch (error) {
            alert('❌ Proxy error:\n\n' + error.message);
        }
    }

    function toggleGasCode() {
        const container = document.getElementById('n8nGasCodeContainer');
        const display = document.getElementById('n8nGasCodeDisplay');
        const btn = document.getElementById('n8nBtnShowGas');

        if (!container || !display || !btn) return;

        if (container.style.display === 'none') {
            display.textContent = GAS_CODE;
            container.style.display = 'block';
            btn.textContent = '🔽 Sembunyikan Kode GAS';
        } else {
            container.style.display = 'none';
            btn.textContent = '📋 Tampilkan Kode GAS';
        }
    }

    function copyGasCode() {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(GAS_CODE).then(() => {
                showToast('✅ Kode GAS berhasil dicopy!');
            }).catch(() => {
                fallbackCopy(GAS_CODE);
            });
        } else {
            fallbackCopy(GAS_CODE);
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
            showToast('✅ Kode GAS berhasil dicopy!');
        } catch (err) {
            showToast('❌ Gagal copy, silakan copy manual', 'error');
        }

        document.body.removeChild(textarea);
    }

    // HELPERS
    function escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function showToast(msg, type = 'info') {
        if (typeof utils !== 'undefined' && utils.showToast) {
            utils.showToast(msg, type);
        } else if (typeof window.showToast === 'function') {
            window.showToast(msg, type);
        } else {
            const toast = document.getElementById('toast');
            if (toast) {
                toast.textContent = msg;
                toast.className = `toast show ${type}`;
                setTimeout(() => toast.className = 'toast', 3000);
            } else {
                alert(msg);
            }
        }
    }

    // PUBLIC API
    return {
        init: init,
        renderPage: renderPage,
        setMode: setMode,
        backToMenu: backToMenu,
        clearResults: clearResults,
        prosesTambah: prosesTambah,
        prosesCari: prosesCari,
        prosesEdit: prosesEdit,
        prosesHapus: prosesHapus,
        loadAllData: loadAllData,
        pilihUntukEdit: pilihUntukEdit,
        pilihUntukHapus: pilihUntukHapus,
        saveConfig: saveConfig,
        testConnection: testConnection,
        testProxy: testProxy,
        toggleGasCode: toggleGasCode,
        copyGasCode: copyGasCode,
        getConfig: () => config,
        getCachedData: () => cachedData
    };
})();

// Inisialisasi saat DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        N8NModule.init();
        console.log('[N8N] Data Management Module ready');
    });
} else {
    N8NModule.init();
    console.log('[N8N] Data Management Module ready (immediate)');
}

// Expose to window
window.N8NModule = N8NModule;

} // End if typeof N8NModule === 'undefined'

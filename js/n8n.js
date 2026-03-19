/**
 * N8N Integration Module - Hifzi Cell POS
 * Pencarian & Manajemen Data via Google Sheets (DIRECT)
 * 
 * FITUR:
 * - Cari: Langsung query ke Sheets via CSV (read-only, cepat)
 * - Tambah/Edit/Hapus: Via Google Apps Script Web App (write)
 * - Generate GAS Code: Untuk setup backend sendiri
 * - Excel View: Tampilan tabel seperti Excel untuk melihat data
 * 
 * Sheet terpisah dari database penjualan (products, transactions, dll)
 * Sheet ini khusus untuk data pelanggan/member/kontak
 */

const n8nModule = {
    currentView: 'search',
    searchResults: [],
    allData: [],
    isLoading: false,
    initialized: false,
    
    // Konfigurasi default - Sheet terpisah dari database utama
    config: {
        spreadsheetId: localStorage.getItem('hifzi_n8n_sheet_id') || '',
        sheetName: localStorage.getItem('hifzi_n8n_sheet_name') || 'Data Base Hifzi Cell',
        webAppUrl: localStorage.getItem('hifzi_sheets_webapp_url') || '',
        botUsername: '@HifziCellBot',
        lastSync: localStorage.getItem('hifzi_n8n_last_sync') || null
    },

    // Template GAS Code untuk generate
    gasTemplate: `/**
 * GOOGLE APPS SCRIPT BACKEND
 * Untuk Hifzi Cell POS - Data Integration
 * 
 * 1. Buka Google Sheets → Extensions → Apps Script
 * 2. Paste code ini
 * 3. Deploy → New Deployment → Web App
 * 4. Execute as: Me
 * 5. Who has access: Anyone
 * 6. Copy URL Web App ke konfigurasi POS
 */

const CONFIG = {
  SPREADSHEET_ID: '{{SPREADSHEET_ID}}',
  SHEET_NAME: '{{SHEET_NAME}}',
  ALLOWED_ACTIONS: ['add', 'edit', 'delete', 'getAll']
};

function doGet(e) {
  try {
    const action = e.parameter.action;
    
    if (action === 'getAll') {
      const data = getAllData();
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        data: data,
        count: data.length,
        timestamp: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'Invalid action'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    const { action, nama, nomor, namaLama, nomorBaru } = params;
    
    // Validasi action
    if (!CONFIG.ALLOWED_ACTIONS.includes(action)) {
      throw new Error('Action not allowed');
    }
    
    let result;
    
    switch(action) {
      case 'add':
        result = addData(nama, nomor);
        break;
      case 'edit':
        result = editData(namaLama, nomorBaru);
        break;
      case 'delete':
        result = deleteData(nama);
        break;
      default:
        throw new Error('Unknown action');
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      result: result,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function getSheet() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  
  // Buat sheet jika belum ada
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    sheet.appendRow(['NAMA', 'NOMOR', 'TIMESTAMP']);
    sheet.getRange(1, 1, 1, 3).setFontWeight('bold');
  }
  
  return sheet;
}

function getAllData() {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = data[i][j];
    }
    rows.push(row);
  }
  
  return rows;
}

function addData(nama, nomor) {
  if (!nama || !nomor) throw new Error('Nama dan nomor wajib diisi');
  
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  
  // Cek duplikat
  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString().toUpperCase() === nama.toUpperCase()) {
      throw new Error('Nama sudah ada');
    }
  }
  
  // Tambah data baru
  sheet.appendRow([nama.toUpperCase(), nomor, new Date()]);
  
  return { nama: nama.toUpperCase(), nomor: nomor };
}

function editData(namaLama, nomorBaru) {
  if (!namaLama || !nomorBaru) throw new Error('Nama dan nomor baru wajib diisi');
  
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  let found = false;
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString().toUpperCase() === namaLama.toUpperCase()) {
      sheet.getRange(i + 1, 2).setValue(nomorBaru); // Update nomor
      sheet.getRange(i + 1, 3).setValue(new Date()); // Update timestamp
      found = true;
      break;
    }
  }
  
  if (!found) throw new Error('Data tidak ditemukan');
  
  return { namaLama: namaLama, nomorBaru: nomorBaru };
}

function deleteData(nama) {
  if (!nama) throw new Error('Nama wajib diisi');
  
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  let found = false;
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString().toUpperCase() === nama.toUpperCase()) {
      sheet.deleteRow(i + 1);
      found = true;
      break;
    }
  }
  
  if (!found) throw new Error('Data tidak ditemukan');
  
  return { deleted: nama };
}

// Test function
function test() {
  console.log('Spreadsheet ID:', CONFIG.SPREADSHEET_ID);
  console.log('Sheet Name:', CONFIG.SHEET_NAME);
  console.log('Data:', getAllData());
}`,

    /**
     * Inisialisasi module - dipanggil oleh router
     */
    init() {
        // Hindari re-initialization
        if (this.initialized && document.getElementById('n8nContainer')) {
            console.log('[N8N] Already initialized, skipping');
            return;
        }
        
        console.log('[N8N] Module initializing - Direct Sheets Mode');
        this.loadConfig();
        this.initialized = true;
        this.renderPage();
        
        // Auto load data jika config sudah lengkap
        if (this.config.spreadsheetId) {
            this.loadSheetData();
        }
    },

    loadConfig() {
        const savedConfig = localStorage.getItem('hifzi_n8n_config');
        if (savedConfig) {
            const parsed = JSON.parse(savedConfig);
            this.config = { ...this.config, ...parsed };
        }
    },

    saveConfig() {
        localStorage.setItem('hifzi_n8n_config', JSON.stringify(this.config));
        localStorage.setItem('hifzi_n8n_sheet_id', this.config.spreadsheetId);
        localStorage.setItem('hifzi_n8n_sheet_name', this.config.sheetName);
        localStorage.setItem('hifzi_sheets_webapp_url', this.config.webAppUrl);
    },

    /**
     * LOAD DATA - Via CSV Export (Cepat, tidak perlu auth)
     */
    async loadSheetData() {
        if (!this.config.spreadsheetId) {
            app.showToast('⚙️ Konfigurasi Spreadsheet ID belum diatur');
            return;
        }

        try {
            this.isLoading = true;
            this.renderPage(); // Re-render untuk show loading
            
            const csvUrl = `https://docs.google.com/spreadsheets/d/${this.config.spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(this.config.sheetName)}`;
            
            console.log('[N8N] Loading data from Google Sheets...');
            
            const response = await fetch(csvUrl);
            if (!response.ok) throw new Error('Failed to fetch');
            
            const csvText = await response.text();
            this.allData = this.parseCSV(csvText);
            
            this.config.lastSync = new Date().toISOString();
            localStorage.setItem('hifzi_n8n_last_sync', this.config.lastSync);
            
            console.log(`[N8N] Loaded ${this.allData.length} records`);
            app.showToast(`✅ ${this.allData.length} data dimuat`);
            
        } catch (error) {
            console.error('[N8N] Error loading sheet data:', error);
            app.showToast('❌ Gagal memuat data. Cek Spreadsheet ID dan pastikan sheet public');
            this.allData = [];
        } finally {
            this.isLoading = false;
            this.renderPage();
        }
    },

    /**
     * Parse CSV dari Google Sheets
     */
    parseCSV(csvText) {
        const lines = csvText.split('\n');
        if (lines.length < 2) return [];
        
        const headers = this.parseCSVLine(lines[0]);
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const values = this.parseCSVLine(lines[i]);
            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });
            data.push(row);
        }
        return data;
    },

    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        return result;
    },

    /**
     * API CALLS - Untuk Write Operations (Tambah/Edit/Hapus)
     */
    async apiCall(action, data = {}) {
        if (!this.config.webAppUrl) {
            app.showToast('⚙️ Web App URL belum diatur. Buka tab Setup GAS.');
            throw new Error('Web App URL not configured');
        }

        try {
            const response = await fetch(this.config.webAppUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, ...data }),
                mode: 'cors'
            });
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || 'Unknown error');
            }
            
            return result;
            
        } catch (error) {
            console.error('[N8N] API Error:', error);
            app.showToast(`❌ Error: ${error.message}`);
            throw error;
        }
    },

    /**
     * PENCARIAN - Langsung dari data lokal (cepat)
     */
    performSearch() {
        const input = document.getElementById('searchInput');
        const keyword = input?.value.trim().toUpperCase();
        
        if (!keyword) {
            this.searchResults = [];
            this.renderResults();
            return;
        }

        console.log(`[N8N] Searching for: "${keyword}"`);

        // Filter dari data yang sudah diload
        this.searchResults = this.allData.filter(item => {
            const nama = (item.NAMA || item.nama || '').toUpperCase();
            const nomor = (item.NOMOR || item.nomor || item.TELEPON || item.HP || '').toString();
            return nama.includes(keyword) || nomor.includes(keyword);
        });

        console.log(`[N8N] Found ${this.searchResults.length} results`);
        this.renderResults();
    },

    /**
     * TAMBAH DATA - Via Web App
     */
    async submitAdd() {
        const nama = document.getElementById('addNama')?.value.trim().toUpperCase();
        const nomor = document.getElementById('addNomor')?.value.trim();

        if (!nama || !nomor) {
            app.showToast('❌ Nama dan nomor wajib diisi!');
            return;
        }

        // Cek duplikat di data lokal
        const exists = this.allData.find(item => 
            (item.NAMA || item.nama || '').toUpperCase() === nama
        );
        
        if (exists) {
            app.showToast('❌ Nama sudah ada! Gunakan menu Edit.');
            return;
        }

        try {
            app.showToast('⏳ Menyimpan ke Sheets...');
            
            await this.apiCall('add', { nama, nomor });
            
            app.showToast(`✅ Data ${nama} berhasil ditambahkan!`);
            this.clearForm();
            
            // Refresh data
            await this.loadSheetData();
            this.switchTab('search');
            
        } catch (error) {
            // Error sudah ditampilkan di apiCall
        }
    },

    /**
     * EDIT DATA - Via Web App
     */
    async submitEdit() {
        const namaLama = document.getElementById('editNamaLama')?.value.trim().toUpperCase();
        const nomorBaru = document.getElementById('editNomorBaru')?.value.trim();

        if (!namaLama || !nomorBaru) {
            app.showToast('❌ Nama dan nomor baru wajib diisi!');
            return;
        }

        try {
            app.showToast('⏳ Mengupdate data...');
            
            await this.apiCall('edit', { 
                namaLama, 
                nomorBaru,
                namaBaru: null // Nama tidak berubah, hanya nomor
            });
            
            app.showToast(`✅ Data ${namaLama} berhasil diupdate!`);
            
            // Refresh data
            await this.loadSheetData();
            this.switchTab('search');
            
        } catch (error) {
            // Error sudah ditampilkan
        }
    },

    /**
     * HAPUS DATA - Via Web App
     */
    async submitDelete() {
        const nama = document.getElementById('deleteNama')?.value.trim().toUpperCase();

        if (!nama) {
            app.showToast('❌ Nama wajib diisi!');
            return;
        }

        if (!confirm(`⚠️ Yakin hapus "${nama}" dari Google Sheets?`)) {
            return;
        }

        try {
            app.showToast('⏳ Menghapus data...');
            
            await this.apiCall('delete', { nama });
            
            app.showToast(`✅ Data ${nama} berhasil dihapus!`);
            
            // Refresh data
            await this.loadSheetData();
            this.switchTab('search');
            
        } catch (error) {
            // Error sudah ditampilkan
        }
    },

    // ============================================
    // UI RENDERING - Konsisten dengan HTML utama
    // ============================================

    renderPage() {
        const container = document.getElementById('mainContent');
        if (!container) return;

        const currentUser = dataManager?.getCurrentUser?.();
        
        // Cek akses - hanya owner dan admin
        if (!currentUser || (currentUser.role !== 'owner' && currentUser.role !== 'admin')) {
            container.innerHTML = `
                <div class="content-section active" style="text-align: center; padding: 40px;">
                    <div style="font-size: 48px; margin-bottom: 15px;">🚫</div>
                    <h2 style="color: #c62828; margin-bottom: 15px;">Akses Ditolak</h2>
                    <p style="color: #666;">Menu ini hanya untuk Owner dan Admin.</p>
                </div>
            `;
            return;
        }

        const lastSyncText = this.config.lastSync 
            ? new Date(this.config.lastSync).toLocaleString('id-ID')
            : 'Belum pernah';

        container.innerHTML = `
            <div id="n8nContainer" class="content-section active">
                <div class="n8n-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 16px; margin-bottom: 20px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);">
                    <div class="n8n-title" style="display: flex; align-items: center; gap: 15px;">
                        <span style="font-size: 40px;">🔍</span>
                        <div>
                            <h2 style="margin: 0; font-size: 24px;">Pencarian Data Pelanggan</h2>
                            <p style="margin: 5px 0 0 0; opacity: 0.9; font-size: 14px;">
                                Google Sheets: ${this.config.sheetName || 'Belum diatur'}
                            </p>
                            <small style="opacity: 0.8; font-size: 12px;">
                                ${this.allData.length} data tersedia • Sync: ${lastSyncText}
                                ${this.isLoading ? '<span class="n8n-loading" style="display: inline-block; width: 12px; height: 12px; border: 2px solid #fff; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite; margin-left: 8px;"></span>' : ''}
                            </small>
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px; margin-left: auto;">
                        <button onclick="n8nModule.refreshData()" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 10px 15px; border-radius: 10px; cursor: pointer; font-size: 16px; transition: all 0.3s;" title="Refresh Data">
                            🔄
                        </button>
                        <button onclick="n8nModule.openConfigModal()" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 10px 15px; border-radius: 10px; cursor: pointer; font-size: 16px; transition: all 0.3s;" title="Konfigurasi">
                            ⚙️
                        </button>
                    </div>
                </div>

                <div class="n8n-tabs" style="display: flex; gap: 8px; margin-bottom: 20px; background: white; padding: 10px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow-x: auto;">
                    <button class="n8n-tab ${this.currentView === 'search' ? 'active' : ''}" onclick="n8nModule.switchTab('search')" style="flex: 1; padding: 12px 20px; border: none; background: ${this.currentView === 'search' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#f7fafc'}; color: ${this.currentView === 'search' ? 'white' : '#4a5568'}; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.3s; white-space: nowrap;">
                        <span style="margin-right: 5px;">🔍</span> Cari Data
                    </button>
                    <button class="n8n-tab ${this.currentView === 'add' ? 'active' : ''}" onclick="n8nModule.switchTab('add')" style="flex: 1; padding: 12px 20px; border: none; background: ${this.currentView === 'add' ? 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)' : '#f7fafc'}; color: ${this.currentView === 'add' ? 'white' : '#4a5568'}; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.3s; white-space: nowrap;">
                        <span style="margin-right: 5px;">➕</span> Tambah
                    </button>
                    <button class="n8n-tab ${this.currentView === 'edit' ? 'active' : ''}" onclick="n8nModule.switchTab('edit')" style="flex: 1; padding: 12px 20px; border: none; background: ${this.currentView === 'edit' ? 'linear-gradient(135deg, #ed8936 0%, #dd6b20 100%)' : '#f7fafc'}; color: ${this.currentView === 'edit' ? 'white' : '#4a5568'}; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.3s; white-space: nowrap;">
                        <span style="margin-right: 5px;">✏️</span> Edit
                    </button>
                    <button class="n8n-tab ${this.currentView === 'delete' ? 'active' : ''}" onclick="n8nModule.switchTab('delete')" style="flex: 1; padding: 12px 20px; border: none; background: ${this.currentView === 'delete' ? 'linear-gradient(135deg, #f56565 0%, #e53e3e 100%)' : '#f7fafc'}; color: ${this.currentView === 'delete' ? 'white' : '#4a5568'}; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.3s; white-space: nowrap;">
                        <span style="margin-right: 5px;">🗑️</span> Hapus
                    </button>
                    <button class="n8n-tab ${this.currentView === 'excel' ? 'active' : ''}" onclick="n8nModule.switchTab('excel')" style="flex: 1; padding: 12px 20px; border: none; background: ${this.currentView === 'excel' ? 'linear-gradient(135deg, #4299e1 0%, #3182ce 100%)' : '#f7fafc'}; color: ${this.currentView === 'excel' ? 'white' : '#4a5568'}; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.3s; white-space: nowrap;">
                        <span style="margin-right: 5px;">📊</span> Excel View
                    </button>
                    <button class="n8n-tab ${this.currentView === 'gas' ? 'active' : ''}" onclick="n8nModule.switchTab('gas')" style="flex: 1; padding: 12px 20px; border: none; background: ${this.currentView === 'gas' ? 'linear-gradient(135deg, #9f7aea 0%, #805ad5 100%)' : '#f7fafc'}; color: ${this.currentView === 'gas' ? 'white' : '#4a5568'}; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.3s; white-space: nowrap;">
                        <span style="margin-right: 5px;">⚡</span> Setup GAS
                    </button>
                </div>

                <div class="n8n-content" style="background: white; border-radius: 16px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); min-height: 400px;">
                    ${this.renderCurrentView()}
                </div>

                <div class="n8n-info-card" style="background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%); border-left: 4px solid #667eea; padding: 16px 20px; border-radius: 12px; margin-top: 20px; display: flex; align-items: center; gap: 12px;">
                    <div style="font-size: 24px;">💡</div>
                    <div style="font-size: 13px; color: #4a5568; line-height: 1.5;">
                        <strong>Mode Direct Sheets:</strong> Cari = CSV Export (cepat) | Tulis = Web App API<br>
                        <span style="opacity: 0.8;">Data terpisah dari database penjualan • Sheet khusus untuk data pelanggan/member</span>
                    </div>
                </div>
            </div>
            
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                .n8n-tab:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                }
                .n8n-result-item:hover {
                    background: #f7fafc;
                    transform: translateX(5px);
                }
                .n8n-excel-table::-webkit-scrollbar {
                    height: 8px;
                    width: 8px;
                }
                .n8n-excel-table::-webkit-scrollbar-track {
                    background: #f1f1f1;
                }
                .n8n-excel-table::-webkit-scrollbar-thumb {
                    background: #888;
                    border-radius: 4px;
                }
            </style>
        `;

        this.attachEventListeners();
    },

    renderCurrentView() {
        switch(this.currentView) {
            case 'search': return this.renderSearchView();
            case 'add': return this.renderAddView();
            case 'edit': return this.renderEditView();
            case 'delete': return this.renderDeleteView();
            case 'excel': return this.renderExcelView();
            case 'gas': return this.renderGASView();
            default: return this.renderSearchView();
        }
    },

    renderSearchView() {
        const hasConfig = this.config.spreadsheetId;
        
        return `
            <div class="n8n-view">
                ${!hasConfig ? `
                    <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 20px; border-radius: 12px; margin-bottom: 20px; text-align: center;">
                        <div style="font-size: 32px; margin-bottom: 10px;">⚙️</div>
                        <h3 style="color: #856404; margin-bottom: 10px;">Konfigurasi Diperlukan</h3>
                        <p style="color: #856404; font-size: 14px; margin-bottom: 15px;">
                            Spreadsheet ID belum diatur. Silakan buka tab <strong>Setup GAS</strong> atau klik tombol pengaturan di atas.
                        </p>
                        <button onclick="n8nModule.switchTab('gas')" style="background: #ffc107; color: #856404; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600;">
                            Buka Setup GAS →
                        </button>
                    </div>
                ` : ''}
                
                <div class="n8n-search-box" style="margin-bottom: 24px;">
                    <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                        <div style="position: relative; flex: 1;">
                            <span style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); font-size: 18px; color: #a0aec0;">🔍</span>
                            <input type="text" 
                                   id="searchInput" 
                                   placeholder="Ketik nama untuk mencari... (contoh: AFLIS)"
                                   autocomplete="off"
                                   style="width: 100%; padding: 15px 15px 15px 45px; border: 2px solid #e2e8f0; border-radius: 12px; font-size: 16px; transition: all 0.3s; box-sizing: border-box;"
                                   onfocus="this.style.borderColor='#667eea'; this.style.boxShadow='0 0 0 3px rgba(102, 126, 234, 0.1)'"
                                   onblur="this.style.borderColor='#e2e8f0'; this.style.boxShadow='none'">
                        </div>
                        <button onclick="n8nModule.performSearch()" 
                                style="padding: 15px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 12px; font-weight: 600; cursor: pointer; transition: all 0.3s; white-space: nowrap;">
                            ${this.isLoading ? '<span style="display: inline-block; width: 16px; height: 16px; border: 2px solid #fff; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></span>' : 'Cari'}
                        </button>
                    </div>
                    <p style="font-size: 12px; color: #a0aec0; margin: 0;">
                        Tekan Enter untuk mencari • Data realtime dari Google Sheets
                    </p>
                </div>

                <div id="searchResults">
                    ${this.renderResultsList()}
                </div>
            </div>
        `;
    },

    renderResultsList() {
        if (this.searchResults.length === 0) {
            if (!this.config.spreadsheetId) {
                return `
                    <div style="text-align: center; padding: 60px 20px; color: #a0aec0;">
                        <div style="font-size: 48px; margin-bottom: 15px;">📋</div>
                        <p style="font-size: 16px; margin-bottom: 10px;">Belum terhubung ke Google Sheets</p>
                        <p style="font-size: 13px;">Atur konfigurasi terlebih dahulu</p>
                    </div>
                `;
            }
            
            if (this.allData.length === 0) {
                return `
                    <div style="text-align: center; padding: 60px 20px; color: #a0aec0;">
                        <div style="font-size: 48px; margin-bottom: 15px;">⏳</div>
                        <p style="font-size: 16px; margin-bottom: 10px;">${this.isLoading ? 'Memuat data...' : 'Tidak ada data'}</p>
                        ${!this.isLoading ? `
                            <button onclick="n8nModule.refreshData()" style="margin-top: 10px; padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer;">
                                🔄 Refresh Data
                            </button>
                        ` : ''}
                    </div>
                `;
            }
            
            return `
                <div style="text-align: center; padding: 60px 20px; color: #a0aec0;">
                    <div style="font-size: 48px; margin-bottom: 15px;">🔍</div>
                    <p style="font-size: 16px; margin-bottom: 10px;">Masukkan kata kunci untuk mencari</p>
                    <p style="font-size: 13px;">Data tersedia: ${this.allData.length} records</p>
                </div>
            `;
        }

        return `
            <div style="margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 600; color: #4a5568;">${this.searchResults.length} hasil ditemukan</span>
                <button onclick="n8nModule.clearResults()" style="padding: 6px 12px; background: #fed7d7; color: #c53030; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600;">
                    Clear
                </button>
            </div>
            <div style="display: flex; flex-direction: column; gap: 10px;">
                ${this.searchResults.map((item, index) => `
                    <div class="n8n-result-item" style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; display: flex; align-items: center; gap: 15px; transition: all 0.3s; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                        <div style="width: 45px; height: 45px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; color: white; flex-shrink: 0;">
                            👤
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-weight: 700; color: #2d3748; font-size: 16px; margin-bottom: 4px; text-transform: uppercase;">
                                ${this.escapeHtml(item.NAMA || item.nama || '-')}
                            </div>
                            <div style="color: #667eea; font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 5px;">
                                <span>📱</span>
                                ${this.escapeHtml(item.NOMOR || item.nomor || item.TELEPON || item.HP || '-')}
                            </div>
                            ${item.TIMESTAMP ? `
                                <div style="font-size: 11px; color: #a0aec0; margin-top: 4px;">
                                    🕐 ${new Date(item.TIMESTAMP).toLocaleString('id-ID')}
                                </div>
                            ` : ''}
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button onclick="n8nModule.quickEdit('${this.escapeHtml(item.NAMA || item.nama)}', '${this.escapeHtml(item.NOMOR || item.nomor)}')" 
                                    style="width: 36px; height: 36px; border-radius: 8px; border: none; background: #fef3c7; color: #d97706; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: all 0.2s;"
                                    onmouseover="this.style.background='#fde68a'"
                                    onmouseout="this.style.background='#fef3c7'"
                                    title="Edit">✏️</button>
                            <button onclick="n8nModule.quickDelete('${this.escapeHtml(item.NAMA || item.nama)}')" 
                                    style="width: 36px; height: 36px; border-radius: 8px; border: none; background: #fee2e2; color: #dc2626; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: all 0.2s;"
                                    onmouseover="this.style.background='#fecaca'"
                                    onmouseout="this.style.background='#fee2e2'"
                                    title="Hapus">🗑️</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    renderAddView() {
        return `
            <div class="n8n-view">
                <h3 style="margin: 0 0 20px 0; color: #2d3748; display: flex; align-items: center; gap: 10px;">
                    <span style="width: 35px; height: 35px; background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-size: 18px;">➕</span>
                    Tambah Data Baru
                </h3>
                
                <div style="max-width: 500px;">
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; font-weight: 600; color: #4a5568; margin-bottom: 8px; font-size: 14px;">
                            Nama Lengkap <span style="color: #f56565;">*</span>
                        </label>
                        <input type="text" id="addNama" placeholder="Contoh: AFLIS" 
                               oninput="this.value = this.value.toUpperCase()"
                               style="width: 100%; padding: 14px 16px; border: 2px solid #e2e8f0; border-radius: 10px; font-size: 16px; transition: all 0.3s; box-sizing: border-box; text-transform: uppercase;"
                               onfocus="this.style.borderColor='#48bb78'; this.style.boxShadow='0 0 0 3px rgba(72, 187, 120, 0.1)'"
                               onblur="this.style.borderColor='#e2e8f0'; this.style.boxShadow='none'">
                        <p style="font-size: 12px; color: #a0aec0; margin-top: 6px;">Otomatis uppercase</p>
                    </div>
                    
                    <div style="margin-bottom: 25px;">
                        <label style="display: block; font-weight: 600; color: #4a5568; margin-bottom: 8px; font-size: 14px;">
                            Nomor Telepon <span style="color: #f56565;">*</span>
                        </label>
                        <input type="text" id="addNomor" placeholder="Contoh: 08123456789"
                               style="width: 100%; padding: 14px 16px; border: 2px solid #e2e8f0; border-radius: 10px; font-size: 16px; transition: all 0.3s; box-sizing: border-box;"
                               onfocus="this.style.borderColor='#48bb78'; this.style.boxShadow='0 0 0 3px rgba(72, 187, 120, 0.1)'"
                               onblur="this.style.borderColor='#e2e8f0'; this.style.boxShadow='none'">
                    </div>
                    
                    <div style="display: flex; gap: 12px;">
                        <button onclick="n8nModule.clearForm()" 
                                style="flex: 1; padding: 14px 24px; background: #edf2f7; color: #4a5568; border: none; border-radius: 10px; font-weight: 600; cursor: pointer; transition: all 0.3s;">
                            Bersihkan
                        </button>
                        <button onclick="n8nModule.submitAdd()" 
                                style="flex: 2; padding: 14px 24px; background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); color: white; border: none; border-radius: 10px; font-weight: 600; cursor: pointer; transition: all 0.3s; box-shadow: 0 4px 12px rgba(72, 187, 120, 0.3);">
                            💾 Simpan ke Sheets
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    renderEditView() {
        return `
            <div class="n8n-view">
                <h3 style="margin: 0 0 20px 0; color: #2d3748; display: flex; align-items: center; gap: 10px;">
                    <span style="width: 35px; height: 35px; background: linear-gradient(135deg, #ed8936 0%, #dd6b20 100%); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-size: 18px;">✏️</span>
                    Edit Data
                </h3>
                
                <div style="max-width: 500px;">
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; font-weight: 600; color: #4a5568; margin-bottom: 8px; font-size: 14px;">
                            Nama yang akan diubah <span style="color: #f56565;">*</span>
                        </label>
                        <input type="text" id="editNamaLama" placeholder="Cari nama..." 
                               oninput="this.value = this.value.toUpperCase()"
                               style="width: 100%; padding: 14px 16px; border: 2px solid #e2e8f0; border-radius: 10px; font-size: 16px; transition: all 0.3s; box-sizing: border-box; text-transform: uppercase;"
                               onfocus="this.style.borderColor='#ed8936'; this.style.boxShadow='0 0 0 3px rgba(237, 137, 54, 0.1)'"
                               onblur="this.style.borderColor='#e2e8f0'; this.style.boxShadow='none'">
                        <p style="font-size: 12px; color: #a0aec0; margin-top: 6px;">Nama harus persis sama dengan yang di sheet</p>
                    </div>
                    
                    <div style="margin-bottom: 25px;">
                        <label style="display: block; font-weight: 600; color: #4a5568; margin-bottom: 8px; font-size: 14px;">
                            Nomor Baru <span style="color: #f56565;">*</span>
                        </label>
                        <input type="text" id="editNomorBaru" placeholder="Nomor baru..."
                               style="width: 100%; padding: 14px 16px; border: 2px solid #e2e8f0; border-radius: 10px; font-size: 16px; transition: all 0.3s; box-sizing: border-box;"
                               onfocus="this.style.borderColor='#ed8936'; this.style.boxShadow='0 0 0 3px rgba(237, 137, 54, 0.1)'"
                               onblur="this.style.borderColor='#e2e8f0'; this.style.boxShadow='none'">
                    </div>
                    
                    <button onclick="n8nModule.submitEdit()" 
                            style="width: 100%; padding: 14px 24px; background: linear-gradient(135deg, #ed8936 0%, #dd6b20 100%); color: white; border: none; border-radius: 10px; font-weight: 600; cursor: pointer; transition: all 0.3s; box-shadow: 0 4px 12px rgba(237, 137, 54, 0.3);">
                        💾 Update Data
                    </button>
                </div>
            </div>
        `;
    },

    renderDeleteView() {
        return `
            <div class="n8n-view">
                <h3 style="margin: 0 0 20px 0; color: #2d3748; display: flex; align-items: center; gap: 10px;">
                    <span style="width: 35px; height: 35px; background: linear-gradient(135deg, #f56565 0%, #e53e3e 100%); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-size: 18px;">🗑️</span>
                    Hapus Data
                </h3>
                
                <div style="max-width: 500px;">
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; font-weight: 600; color: #4a5568; margin-bottom: 8px; font-size: 14px;">
                            Nama yang akan dihapus <span style="color: #f56565;">*</span>
                        </label>
                        <input type="text" id="deleteNama" placeholder="Nama yang mau dihapus..." 
                               oninput="this.value = this.value.toUpperCase()"
                               style="width: 100%; padding: 14px 16px; border: 2px solid #e2e8f0; border-radius: 10px; font-size: 16px; transition: all 0.3s; box-sizing: border-box; text-transform: uppercase;"
                               onfocus="this.style.borderColor='#f56565'; this.style.boxShadow='0 0 0 3px rgba(245, 101, 101, 0.1)'"
                               onblur="this.style.borderColor='#e2e8f0'; this.style.boxShadow='none'">
                    </div>
                    
                    <div style="background: #fff5f5; border: 1px solid #feb2b2; border-radius: 10px; padding: 16px; margin-bottom: 25px;">
                        <div style="display: flex; align-items: center; gap: 10px; color: #c53030; font-size: 14px;">
                            <span style="font-size: 20px;">⚠️</span>
                            <div>
                                <strong>Perhatian!</strong> Data yang dihapus tidak dapat dikembalikan.
                            </div>
                        </div>
                    </div>
                    
                    <button onclick="n8nModule.submitDelete()" 
                            style="width: 100%; padding: 14px 24px; background: linear-gradient(135deg, #f56565 0%, #e53e3e 100%); color: white; border: none; border-radius: 10px; font-weight: 600; cursor: pointer; transition: all 0.3s; box-shadow: 0 4px 12px rgba(245, 101, 101, 0.3);">
                        🗑️ Hapus Permanen
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * EXCEL VIEW - Tampilan tabel seperti Excel
     */
    renderExcelView() {
        if (this.allData.length === 0) {
            return `
                <div style="text-align: center; padding: 60px 20px; color: #a0aec0;">
                    <div style="font-size: 48px; margin-bottom: 15px;">📊</div>
                    <p style="font-size: 16px; margin-bottom: 10px;">Tidak ada data untuk ditampilkan</p>
                    <button onclick="n8nModule.refreshData()" style="padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer;">
                        🔄 Load Data
                    </button>
                </div>
            `;
        }

        const headers = Object.keys(this.allData[0]);
        
        return `
            <div class="n8n-view">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h3 style="margin: 0; color: #2d3748; display: flex; align-items: center; gap: 10px;">
                        <span style="width: 35px; height: 35px; background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-size: 18px;">📊</span>
                        Excel View
                    </h3>
                    <div style="display: flex; gap: 8px;">
                        <button onclick="n8nModule.exportToExcel()" style="padding: 8px 16px; background: #48bb78; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600;">
                            📥 Export
                        </button>
                        <button onclick="n8nModule.refreshData()" style="padding: 8px 16px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600;">
                            🔄 Refresh
                        </button>
                    </div>
                </div>
                
                <div class="n8n-excel-table" style="overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 12px; background: white;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 13px; min-width: 500px;">
                        <thead>
                            <tr style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                                ${headers.map(h => `
                                    <th style="padding: 14px 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e2e8f0; white-space: nowrap; text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px;">
                                        ${h}
                                    </th>
                                `).join('')}
                                <th style="padding: 14px 12px; text-align: center; font-weight: 600; border-bottom: 2px solid #e2e8f0; width: 100px;">
                                    Aksi
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.allData.map((row, idx) => `
                                <tr style="background: ${idx % 2 === 0 ? 'white' : '#f7fafc'}; transition: all 0.2s;" onmouseover="this.style.background='#edf2f7'" onmouseout="this.style.background='${idx % 2 === 0 ? 'white' : '#f7fafc'}'">
                                    ${headers.map(h => `
                                        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #2d3748; ${h === 'NAMA' ? 'font-weight: 600; text-transform: uppercase;' : ''}">
                                            ${this.escapeHtml(row[h])}
                                        </td>
                                    `).join('')}
                                    <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">
                                        <button onclick="n8nModule.quickEdit('${this.escapeHtml(row.NAMA || row.nama)}', '${this.escapeHtml(row.NOMOR || row.nomor)}')" 
                                                style="padding: 6px 10px; background: #fef3c7; color: #d97706; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; margin-right: 4px;"
                                                title="Edit">✏️</button>
                                        <button onclick="n8nModule.quickDelete('${this.escapeHtml(row.NAMA || row.nama)}')" 
                                                style="padding: 6px 10px; background: #fee2e2; color: #dc2626; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;"
                                                title="Hapus">🗑️</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                
                <div style="margin-top: 15px; display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #718096;">
                    <span>Total: ${this.allData.length} baris</span>
                    <span>Columns: ${headers.length}</span>
                </div>
            </div>
        `;
    },

    /**
     * GAS SETUP VIEW - Generate dan konfigurasi GAS
     */
    renderGASView() {
        const gasCode = this.generateGASCode();
        
        return `
            <div class="n8n-view">
                <h3 style="margin: 0 0 20px 0; color: #2d3748; display: flex; align-items: center; gap: 10px;">
                    <span style="width: 35px; height: 35px; background: linear-gradient(135deg, #9f7aea 0%, #805ad5 100%); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-size: 18px;">⚡</span>
                    Setup Google Apps Script
                </h3>
                
                <div style="display: grid; gap: 20px;">
                    <!-- Step 1: Konfigurasi Sheet -->
                    <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px;">
                        <h4 style="margin: 0 0 15px 0; color: #4a5568; font-size: 16px; display: flex; align-items: center; gap: 8px;">
                            <span style="width: 28px; height: 28px; background: #667eea; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700;">1</span>
                            Konfigurasi Spreadsheet
                        </h4>
                        
                        <div style="display: grid; gap: 15px;">
                            <div>
                                <label style="display: block; font-weight: 600; color: #4a5568; margin-bottom: 6px; font-size: 13px;">
                                    Spreadsheet ID
                                </label>
                                <input type="text" id="gasSpreadsheetId" value="${this.config.spreadsheetId}" placeholder="1cPolj_xpBztq6RU3XVi_CZm1j_Kqo-zQC-wsbIYrLXE"
                                       style="width: 100%; padding: 12px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 14px; font-family: monospace; box-sizing: border-box;">
                                <p style="font-size: 11px; color: #a0aec0; margin: 5px 0 0 0;">
                                    Dari URL: https://docs.google.com/spreadsheets/d/<strong>SPREADSHEET_ID</strong>/edit
                                </p>
                            </div>
                            
                            <div>
                                <label style="display: block; font-weight: 600; color: #4a5568; margin-bottom: 6px; font-size: 13px;">
                                    Sheet Name
                                </label>
                                <input type="text" id="gasSheetName" value="${this.config.sheetName}" placeholder="Data Base Hifzi Cell"
                                       style="width: 100%; padding: 12px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 14px; box-sizing: border-box;">
                            </div>
                            
                            <div>
                                <label style="display: block; font-weight: 600; color: #4a5568; margin-bottom: 6px; font-size: 13px;">
                                    Web App URL (setelah deploy)
                                </label>
                                <input type="text" id="gasWebAppUrl" value="${this.config.webAppUrl}" placeholder="https://script.google.com/macros/s/AKfycbw.../exec"
                                       style="width: 100%; padding: 12px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 14px; font-family: monospace; box-sizing: border-box;">
                            </div>
                            
                            <button onclick="n8nModule.saveGASConfig()" 
                                    style="padding: 12px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.3s;">
                                💾 Simpan Konfigurasi
                            </button>
                        </div>
                    </div>
                    
                    <!-- Step 2: Generate Code -->
                    <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px;">
                        <h4 style="margin: 0 0 15px 0; color: #4a5568; font-size: 16px; display: flex; align-items: center; gap: 8px;">
                            <span style="width: 28px; height: 28px; background: #48bb78; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700;">2</span>
                            Generate GAS Code
                        </h4>
                        
                        <p style="font-size: 13px; color: #718096; margin-bottom: 15px; line-height: 1.5;">
                            Code ini akan otomatis ter-generate berdasarkan Spreadsheet ID dan Sheet Name di atas. 
                            Copy paste ke Google Apps Script.
                        </p>
                        
                        <div style="position: relative;">
                            <textarea id="gasCodeOutput" readonly 
                                      style="width: 100%; height: 300px; padding: 15px; background: #1a202c; color: #68d391; border: none; border-radius: 8px; font-family: 'Consolas', 'Monaco', monospace; font-size: 12px; line-height: 1.5; resize: vertical; box-sizing: border-box;">${gasCode}</textarea>
                            
                            <button onclick="n8nModule.copyGASCode()" 
                                    style="position: absolute; top: 10px; right: 10px; padding: 8px 16px; background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; cursor: pointer; font-size: 12px; backdrop-filter: blur(10px);">
                                📋 Copy Code
                            </button>
                        </div>
                        
                        <div style="margin-top: 15px; padding: 15px; background: #f0fff4; border-left: 4px solid #48bb78; border-radius: 8px; font-size: 13px; color: #22543d; line-height: 1.6;">
                            <strong>📖 Cara Deploy:</strong><br>
                            1. Buka <a href="https://script.google.com" target="_blank" style="color: #2f855a; text-decoration: underline;">script.google.com</a><br>
                            2. Create new project → Paste code di atas<br>
                            3. Klik <strong>Deploy</strong> → <strong>New deployment</strong><br>
                            4. Pilih type: <strong>Web app</strong><br>
                            5. Execute as: <strong>Me</strong><br>
                            6. Who has access: <strong>Anyone</strong><br>
                            7. Copy Web App URL ke kolom di atas
                        </div>
                    </div>
                    
                    <!-- Step 3: Test -->
                    <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px;">
                        <h4 style="margin: 0 0 15px 0; color: #4a5568; font-size: 16px; display: flex; align-items: center; gap: 8px;">
                            <span style="width: 28px; height: 28px; background: #ed8936; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700;">3</span>
                            Test Koneksi
                        </h4>
                        
                        <div style="display: flex; gap: 10px;">
                            <button onclick="n8nModule.testConnection()" 
                                    style="flex: 1; padding: 12px; background: #ed8936; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                                🧪 Test Read (CSV)
                            </button>
                            <button onclick="n8nModule.testWriteConnection()" 
                                    style="flex: 1; padding: 12px; background: #9f7aea; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                                🧪 Test Write (Web App)
                            </button>
                        </div>
                        
                        <div id="testResult" style="margin-top: 15px; padding: 12px; border-radius: 8px; display: none;"></div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Generate GAS Code dengan config saat ini
     */
    generateGASCode() {
        return this.gasTemplate
            .replace('{{SPREADSHEET_ID}}', this.config.spreadsheetId || 'YOUR_SPREADSHEET_ID')
            .replace('{{SHEET_NAME}}', this.config.sheetName || 'Sheet1');
    },

    /**
     * Save GAS Config dari form
     */
    saveGASConfig() {
        const spreadsheetId = document.getElementById('gasSpreadsheetId')?.value.trim();
        const sheetName = document.getElementById('gasSheetName')?.value.trim();
        const webAppUrl = document.getElementById('gasWebAppUrl')?.value.trim();
        
        if (spreadsheetId) this.config.spreadsheetId = spreadsheetId;
        if (sheetName) this.config.sheetName = sheetName;
        if (webAppUrl) this.config.webAppUrl = webAppUrl;
        
        this.saveConfig();
        
        // Update textarea dengan code baru
        const textarea = document.getElementById('gasCodeOutput');
        if (textarea) {
            textarea.value = this.generateGASCode();
        }
        
        app.showToast('✅ Konfigurasi tersimpan!');
        
        // Test otomatis
        if (this.config.spreadsheetId) {
            this.loadSheetData();
        }
    },

    /**
     * Copy GAS Code ke clipboard
     */
    copyGASCode() {
        const textarea = document.getElementById('gasCodeOutput');
        if (textarea) {
            textarea.select();
            document.execCommand('copy');
            app.showToast('📋 Code berhasil dicopy!');
        }
    },

    /**
     * Test koneksi read (CSV)
     */
    async testConnection() {
        const resultDiv = document.getElementById('testResult');
        if (!resultDiv) return;
        
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = '<div style="color: #ed8936;">🧪 Testing...</div>';
        
        try {
            if (!this.config.spreadsheetId) throw new Error('Spreadsheet ID belum diatur');
            
            const csvUrl = `https://docs.google.com/spreadsheets/d/${this.config.spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(this.config.sheetName)}`;
            const response = await fetch(csvUrl);
            
            if (response.ok) {
                const text = await response.text();
                const lines = text.split('\n').length;
                resultDiv.innerHTML = `<div style="color: #48bb78; background: #f0fff4; padding: 10px; border-radius: 6px;">✅ Koneksi berhasil! ${lines} baris terdeteksi.</div>`;
            } else {
                throw new Error('HTTP ' + response.status);
            }
        } catch (error) {
            resultDiv.innerHTML = `<div style="color: #f56565; background: #fff5f5; padding: 10px; border-radius: 6px;">❌ Error: ${error.message}</div>`;
        }
    },

    /**
     * Test koneksi write (Web App)
     */
    async testWriteConnection() {
        const resultDiv = document.getElementById('testResult');
        if (!resultDiv) return;
        
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = '<div style="color: #ed8936;">🧪 Testing Web App...</div>';
        
        try {
            if (!this.config.webAppUrl) throw new Error('Web App URL belum diatur');
            
            // Test dengan action getAll (read via POST)
            const response = await fetch(this.config.webAppUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'getAll' }),
                mode: 'cors'
            });
            
            const result = await response.json();
            
            if (result.success) {
                resultDiv.innerHTML = `<div style="color: #48bb78; background: #f0fff4; padding: 10px; border-radius: 6px;">✅ Web App aktif! ${result.count || 0} records.</div>`;
            } else {
                throw new Error(result.error || 'Unknown error');
            }
        } catch (error) {
            resultDiv.innerHTML = `<div style="color: #f56565; background: #fff5f5; padding: 10px; border-radius: 6px;">❌ Error: ${error.message}<br><small>Pastikan Web App sudah deploy dan permission "Anyone"</small></div>`;
        }
    },

    /**
     * Export data ke Excel file
     */
    exportToExcel() {
        if (this.allData.length === 0) {
            app.showToast('❌ Tidak ada data untuk export');
            return;
        }

        try {
            // Convert to worksheet
            const ws = XLSX.utils.json_to_sheet(this.allData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, this.config.sheetName || 'Data');
            
            // Generate filename dengan timestamp
            const timestamp = new Date().toISOString().slice(0, 10);
            const filename = `HifziCell_Data_${timestamp}.xlsx`;
            
            XLSX.writeFile(wb, filename);
            app.showToast(`✅ Exported: ${filename}`);
        } catch (error) {
            console.error('Export error:', error);
            app.showToast('❌ Gagal export: ' + error.message);
        }
    },

    // ============================================
    // EVENT HANDLERS & UTILITIES
    // ============================================

    switchTab(view) {
        this.currentView = view;
        this.renderPage();
    },

    attachEventListeners() {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            // Enter key
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.performSearch();
            });
            
            // Real-time search dengan debounce
            let timeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    if (e.target.value.length >= 2) {
                        this.performSearch();
                    } else if (e.target.value.length === 0) {
                        this.clearResults();
                    }
                }, 300);
            });
            
            setTimeout(() => searchInput.focus(), 100);
        }
    },

    renderResults() {
        const container = document.getElementById('searchResults');
        if (container) {
            container.innerHTML = this.renderResultsList();
        }
    },

    clearResults() {
        this.searchResults = [];
        this.renderResults();
    },

    async refreshData() {
        app.showToast('🔄 Memuat ulang data...');
        await this.loadSheetData();
    },

    quickEdit(nama, nomor) {
        this.switchTab('edit');
        setTimeout(() => {
            const inputNama = document.getElementById('editNamaLama');
            const inputNomor = document.getElementById('editNomorBaru');
            if (inputNama) inputNama.value = nama || '';
            if (inputNomor) inputNomor.value = nomor || '';
        }, 100);
    },

    quickDelete(nama) {
        this.switchTab('delete');
        setTimeout(() => {
            const input = document.getElementById('deleteNama');
            if (input) input.value = nama || '';
        }, 100);
    },

    clearForm() {
        document.querySelectorAll('.n8n-input').forEach(input => input.value = '');
    },

    openConfigModal() {
        this.switchTab('gas');
    },

    escapeHtml(text) {
        if (!text) return '';
        return text.toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
};

console.log('[N8N] Module loaded - Direct Sheets Integration with GAS Generator');

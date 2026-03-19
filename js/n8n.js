/**
 * N8N Integration Module - Hifzi Cell POS
 * PERBAIKAN: Fitur pencarian yang stabil dan responsif
 */

const n8nModule = {
    currentView: 'search',
    searchResults: [],
    allData: [],
    isLoading: false,
    initialized: false,
    _listenersAttached: false,
    
    // Konfigurasi
    config: {
        spreadsheetId: localStorage.getItem('hifzi_n8n_sheet_id') || '',
        sheetName: localStorage.getItem('hifzi_n8n_sheet_name') || 'Data Base Hifzi Cell',
        webAppUrl: localStorage.getItem('hifzi_sheets_webapp_url') || '',
        lastSync: localStorage.getItem('hifzi_n8n_last_sync') || null
    },

    // GAS Template dengan CORS fix
    gasTemplate: `/**
 * GOOGLE APPS SCRIPT BACKEND - Hifzi Cell POS
 * Deploy: Web App, Execute as: Me, Access: Anyone
 */

const CONFIG = {
  SPREADSHEET_ID: '{{SPREADSHEET_ID}}',
  SHEET_NAME: '{{SHEET_NAME}}'
};

function doOptions(e) {
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.JSON)
    .setHeaders({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
}

function doGet(e) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  
  try {
    const action = e.parameter.action;
    if (action === 'getAll') {
      const data = getAllData();
      return createResponse({ success: true, data: data, count: data.length }, headers);
    }
    return createResponse({ success: false, error: 'Invalid action' }, headers);
  } catch (error) {
    return createResponse({ success: false, error: error.toString() }, headers);
  }
}

function doPost(e) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  
  try {
    const params = JSON.parse(e.postData.contents);
    const { action, nama, nomor, namaLama, nomorBaru } = params;
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
      case 'getAll':
        result = getAllData();
        return createResponse({ success: true, data: result, count: result.length }, headers);
      default:
        throw new Error('Unknown action: ' + action);
    }
    
    return createResponse({ success: true, result: result }, headers);
  } catch (error) {
    return createResponse({ success: false, error: error.toString() }, headers);
  }
}

function createResponse(data, headers) {
  let output = ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  for (let key in headers) {
    output.setHeader(key, headers[key]);
  }
  return output;
}

function getSheet() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    sheet.appendRow(['NAMA', 'NOMOR', 'TIMESTAMP']);
    sheet.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#667eea').setFontColor('white');
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
  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString().toUpperCase() === nama.toUpperCase()) {
      throw new Error('Nama "' + nama + '" sudah ada');
    }
  }
  sheet.appendRow([nama.toUpperCase(), nomor, new Date()]);
  return { nama: nama.toUpperCase(), nomor: nomor, timestamp: new Date() };
}

function editData(namaLama, nomorBaru) {
  if (!namaLama || !nomorBaru) throw new Error('Nama dan nomor baru wajib diisi');
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  let found = false;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString().toUpperCase() === namaLama.toUpperCase()) {
      sheet.getRange(i + 1, 2).setValue(nomorBaru);
      sheet.getRange(i + 1, 3).setValue(new Date());
      found = true;
      break;
    }
  }
  if (!found) throw new Error('Data "' + namaLama + '" tidak ditemukan');
  return { namaLama: namaLama, nomorBaru: nomorBaru, updatedAt: new Date() };
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
  if (!found) throw new Error('Data "' + nama + '" tidak ditemukan');
  return { deleted: nama, deletedAt: new Date() };
}`,

    init() {
        if (this.initialized && document.getElementById('n8nContainer')) {
            console.log('[N8N] Already initialized');
            return;
        }
        
        console.log('[N8N] Initializing...');
        this.loadConfig();
        this.initialized = true;
        this.attachGlobalListeners(); // Attach listeners sekali saja
        this.renderPage();
        
        if (this.config.spreadsheetId) {
            this.loadSheetData();
        }
    },

    loadConfig() {
        const saved = localStorage.getItem('hifzi_n8n_config');
        if (saved) {
            this.config = { ...this.config, ...JSON.parse(saved) };
        }
    },

    saveConfig() {
        localStorage.setItem('hifzi_n8n_config', JSON.stringify(this.config));
        localStorage.setItem('hifzi_n8n_sheet_id', this.config.spreadsheetId);
        localStorage.setItem('hifzi_n8n_sheet_name', this.config.sheetName);
        localStorage.setItem('hifzi_sheets_webapp_url', this.config.webAppUrl);
    },

    /**
     * PERBAIKAN: Event delegation - attach sekali saja
     */
    attachGlobalListeners() {
        if (this._listenersAttached) return;
        
        console.log('[N8N] Attaching global event listeners');
        
        // Click handler untuk tombol Cari
        document.addEventListener('click', (e) => {
            const searchBtn = e.target.closest('#searchBtn');
            if (searchBtn) {
                e.preventDefault();
                e.stopPropagation();
                console.log('[N8N] Search button clicked');
                this.performSearch();
            }
        });
        
        // Enter key di search input
        document.addEventListener('keydown', (e) => {
            if (e.target.id === 'searchInput' && e.key === 'Enter') {
                e.preventDefault();
                console.log('[N8N] Enter pressed in search');
                this.performSearch();
            }
        });
        
        // Real-time search dengan debounce
        let debounceTimer;
        document.addEventListener('input', (e) => {
            if (e.target.id === 'searchInput') {
                clearTimeout(debounceTimer);
                const value = e.target.value;
                
                if (value.length === 0) {
                    this.clearResults();
                    return;
                }
                
                if (value.length >= 2) {
                    debounceTimer = setTimeout(() => {
                        console.log('[N8N] Debounced search:', value);
                        this.performSearch();
                    }, 300);
                }
            }
        });
        
        this._listenersAttached = true;
    },

    /**
     * PERBAIKAN: Load data dengan better error handling
     */
    async loadSheetData() {
        if (!this.config.spreadsheetId) {
            console.log('[N8N] No spreadsheet ID configured');
            return;
        }

        try {
            this.isLoading = true;
            this.renderPage(); // Show loading state
            
            const csvUrl = `https://docs.google.com/spreadsheets/d/${this.config.spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(this.config.sheetName)}`;
            console.log('[N8N] Fetching:', csvUrl);
            
            const response = await fetch(csvUrl);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const csvText = await response.text();
            this.allData = this.parseCSV(csvText);
            
            this.config.lastSync = new Date().toISOString();
            this.saveConfig();
            
            console.log(`[N8N] Loaded ${this.allData.length} records`);
            app.showToast(`✅ ${this.allData.length} data dimuat`);
            
        } catch (error) {
            console.error('[N8N] Load error:', error);
            app.showToast('❌ Gagal memuat data: ' + error.message);
            this.allData = [];
        } finally {
            this.isLoading = false;
            this.renderPage();
        }
    },

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
     * PERBAIKAN UTAMA: Perform search dengan logging dan loading state
     */
    performSearch() {
        console.log('[N8N] performSearch called');
        console.log('[N8N] allData length:', this.allData.length);
        
        const input = document.getElementById('searchInput');
        if (!input) {
            console.error('[N8N] searchInput not found!');
            return;
        }
        
        const keyword = input.value.trim().toUpperCase();
        console.log('[N8N] Keyword:', keyword);
        
        if (!keyword) {
            this.clearResults();
            return;
        }
        
        // Show loading di button
        const searchBtn = document.getElementById('searchBtn');
        if (searchBtn) {
            searchBtn.innerHTML = '<span style="display:inline-block;width:16px;height:16px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite;"></span>';
            searchBtn.disabled = true;
        }
        
        // Perform search (sync tapi dengan setTimeout untuk UI update)
        setTimeout(() => {
            this.searchResults = this.allData.filter(item => {
                const nama = (item.NAMA || item.nama || '').toUpperCase();
                const nomor = (item.NOMOR || item.nomor || item.TELEPON || item.HP || '').toString();
                const match = nama.includes(keyword) || nomor.includes(keyword);
                return match;
            });
            
            console.log('[N8N] Search results:', this.searchResults.length);
            
            // Restore button
            if (searchBtn) {
                searchBtn.innerHTML = 'Cari';
                searchBtn.disabled = false;
            }
            
            // Render hasil
            this.renderSearchResults();
            
            // Update counter
            const counter = document.getElementById('searchCounter');
            if (counter) {
                counter.textContent = `${this.searchResults.length} hasil ditemukan untuk "${input.value}"`;
            }
        }, 50);
    },

    /**
     * PERBAIKAN: Render hasil pencarian ke container yang benar
     */
    renderSearchResults() {
        const container = document.getElementById('searchResultsContainer');
        if (!container) {
            console.error('[N8N] searchResultsContainer not found!');
            return;
        }
        
        if (this.searchResults.length === 0) {
            container.innerHTML = `
                <div style="text-align:center;padding:40px;color:#a0aec0;">
                    <div style="font-size:48px;margin-bottom:15px;">🔍</div>
                    <p>Tidak ada hasil untuk pencarian ini</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:10px;margin-top:20px;">
                ${this.searchResults.map((item, idx) => `
                    <div style="background:white;border:2px solid #667eea;border-radius:12px;padding:16px;display:flex;align-items:center;gap:15px;box-shadow:0 2px 8px rgba(102,126,234,0.1);">
                        <div style="width:45px;height:45px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;color:white;">
                            ${idx + 1}
                        </div>
                        <div style="flex:1;">
                            <div style="font-weight:700;color:#2d3748;font-size:16px;text-transform:uppercase;margin-bottom:4px;">
                                ${this.escapeHtml(item.NAMA || item.nama || '-')}
                            </div>
                            <div style="color:#667eea;font-size:14px;font-weight:600;">
                                📱 ${this.escapeHtml(item.NOMOR || item.nomor || '-')}
                            </div>
                        </div>
                        <div style="display:flex;gap:8px;">
                            <button onclick="n8nModule.quickEdit('${this.escapeHtml(item.NAMA || item.nama)}','${this.escapeHtml(item.NOMOR || item.nomor)}')" 
                                    style="padding:8px 12px;background:#fef3c7;color:#d97706;border:none;border-radius:6px;cursor:pointer;font-size:13px;">✏️ Edit</button>
                            <button onclick="n8nModule.quickDelete('${this.escapeHtml(item.NAMA || item.nama)}')" 
                                    style="padding:8px 12px;background:#fee2e2;color:#dc2626;border:none;border-radius:6px;cursor:pointer;font-size:13px;">🗑️ Hapus</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    clearResults() {
        this.searchResults = [];
        const container = document.getElementById('searchResultsContainer');
        if (container) container.innerHTML = '';
        const counter = document.getElementById('searchCounter');
        if (counter) counter.textContent = '';
    },

    /**
     * API Calls dengan CORS fix
     */
    async apiCall(action, data = {}) {
        if (!this.config.webAppUrl) {
            app.showToast('⚙️ Web App URL belum diatur');
            throw new Error('Web App URL not configured');
        }

        try {
            const response = await fetch(this.config.webAppUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action, ...data })
            });
            
            const result = await response.json();
            if (!result.success) throw new Error(result.error || 'Unknown error');
            return result;
        } catch (error) {
            console.error('[N8N] API Error:', error);
            app.showToast(`❌ Error: ${error.message}`);
            throw error;
        }
    },

    async submitAdd() {
        const nama = document.getElementById('addNama')?.value.trim().toUpperCase();
        const nomor = document.getElementById('addNomor')?.value.trim();

        if (!nama || !nomor) {
            app.showToast('❌ Nama dan nomor wajib diisi!');
            return;
        }

        const exists = this.allData.find(item => 
            (item.NAMA || item.nama || '').toUpperCase() === nama
        );
        
        if (exists) {
            app.showToast('❌ Nama sudah ada!');
            return;
        }

        try {
            app.showToast('⏳ Menyimpan...');
            await this.apiCall('add', { nama, nomor });
            app.showToast(`✅ ${nama} ditambahkan!`);
            this.clearForm();
            await this.loadSheetData();
            this.switchTab('search');
        } catch (error) {
            console.error('Add error:', error);
        }
    },

    async submitEdit() {
        const namaLama = document.getElementById('editNamaLama')?.value.trim().toUpperCase();
        const nomorBaru = document.getElementById('editNomorBaru')?.value.trim();

        if (!namaLama || !nomorBaru) {
            app.showToast('❌ Nama dan nomor baru wajib diisi!');
            return;
        }

        try {
            app.showToast('⏳ Mengupdate...');
            await this.apiCall('edit', { namaLama, nomorBaru });
            app.showToast(`✅ ${namaLama} diupdate!`);
            await this.loadSheetData();
            this.switchTab('search');
        } catch (error) {
            console.error('Edit error:', error);
        }
    },

    async submitDelete() {
        const nama = document.getElementById('deleteNama')?.value.trim().toUpperCase();
        if (!nama) {
            app.showToast('❌ Nama wajib diisi!');
            return;
        }

        if (!confirm(`⚠️ Yakin hapus "${nama}"?`)) return;

        try {
            app.showToast('⏳ Menghapus...');
            await this.apiCall('delete', { nama });
            app.showToast(`✅ ${nama} dihapus!`);
            await this.loadSheetData();
            this.switchTab('search');
        } catch (error) {
            console.error('Delete error:', error);
        }
    },

    // ============================================
    // UI RENDERING
    // ============================================

    renderPage() {
        const container = document.getElementById('mainContent');
        if (!container) return;

        const currentUser = dataManager?.getCurrentUser?.();
        
        if (!currentUser || (currentUser.role !== 'owner' && currentUser.role !== 'admin')) {
            container.innerHTML = `
                <div class="content-section active" style="text-align:center;padding:40px;">
                    <div style="font-size:48px;margin-bottom:15px;">🚫</div>
                    <h2 style="color:#c62828;">Akses Ditolak</h2>
                    <p>Menu ini hanya untuk Owner dan Admin.</p>
                </div>
            `;
            return;
        }

        const lastSyncText = this.config.lastSync 
            ? new Date(this.config.lastSync).toLocaleString('id-ID')
            : 'Belum pernah';

        container.innerHTML = `
            <div id="n8nContainer" class="content-section active">
                <!-- Header -->
                <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:20px;border-radius:16px;margin-bottom:20px;box-shadow:0 4px 15px rgba(102,126,234,0.3);">
                    <div style="display:flex;align-items:center;gap:15px;">
                        <span style="font-size:40px;">🔍</span>
                        <div>
                            <h2 style="margin:0;font-size:24px;">Pencarian Data Pelanggan</h2>
                            <p style="margin:5px 0 0 0;opacity:0.9;font-size:14px;">
                                ${this.config.sheetName || 'Belum diatur'} • ${this.allData.length} data
                            </p>
                            <small style="opacity:0.8;font-size:12px;">
                                Sync: ${lastSyncText}
                                ${this.isLoading ? '<span style="margin-left:8px;">⏳</span>' : ''}
                            </small>
                        </div>
                        <div style="margin-left:auto;display:flex;gap:8px;">
                            <button onclick="n8nModule.refreshData()" style="background:rgba(255,255,255,0.2);border:none;color:white;padding:10px 15px;border-radius:10px;cursor:pointer;">🔄</button>
                            <button onclick="n8nModule.switchTab('gas')" style="background:rgba(255,255,255,0.2);border:none;color:white;padding:10px 15px;border-radius:10px;cursor:pointer;">⚙️</button>
                        </div>
                    </div>
                </div>

                <!-- Tabs -->
                <div style="display:flex;gap:8px;margin-bottom:20px;background:white;padding:10px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.1);overflow-x:auto;">
                    ${this.renderTab('search', '🔍', 'Cari Data', '#667eea')}
                    ${this.renderTab('add', '➕', 'Tambah', '#48bb78')}
                    ${this.renderTab('edit', '✏️', 'Edit', '#ed8936')}
                    ${this.renderTab('delete', '🗑️', 'Hapus', '#f56565')}
                    ${this.renderTab('excel', '📊', 'Excel View', '#4299e1')}
                    ${this.renderTab('gas', '⚡', 'Setup GAS', '#9f7aea')}
                </div>

                <!-- Content -->
                <div style="background:white;border-radius:16px;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,0.1);min-height:400px;">
                    ${this.renderCurrentView()}
                </div>

                <!-- Info -->
                <div style="background:linear-gradient(135deg,#e3f2fd 0%,#f3e5f5 100%);border-left:4px solid #667eea;padding:16px 20px;border-radius:12px;margin-top:20px;display:flex;align-items:center;gap:12px;font-size:13px;color:#4a5568;">
                    <div style="font-size:24px;">💡</div>
                    <div>
                        <strong>Mode Direct Sheets:</strong> Cari = CSV Export | Tulis = Web App API<br>
                        <span style="opacity:0.8;">Data terpisah dari database penjualan</span>
                    </div>
                </div>
            </div>
            
            <style>
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                .n8n-tab:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
            </style>
        `;
    },

    renderTab(view, icon, label, color) {
        const isActive = this.currentView === view;
        return `
            <button class="n8n-tab" onclick="n8nModule.switchTab('${view}')" 
                    style="flex:1;padding:12px 20px;border:none;background:${isActive ? `linear-gradient(135deg,${color} 0%,${this.darken(color)} 100%)` : '#f7fafc'};
                           color:${isActive ? 'white' : '#4a5568'};border-radius:8px;cursor:pointer;font-weight:600;transition:all 0.3s;white-space:nowrap;">
                <span style="margin-right:5px;">${icon}</span> ${label}
            </button>
        `;
    },

    darken(hex) {
        // Simple darken for gradient
        const colors = {
            '#667eea': '#764ba2',
            '#48bb78': '#38a169',
            '#ed8936': '#dd6b20',
            '#f56565': '#e53e3e',
            '#4299e1': '#3182ce',
            '#9f7aea': '#805ad5'
        };
        return colors[hex] || hex;
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

    /**
     * PERBAIKAN: Search view dengan container yang jelas untuk hasil
     */
    renderSearchView() {
        const hasData = this.allData.length > 0;
        
        return `
            <div>
                <!-- Search Box -->
                <div style="margin-bottom:20px;">
                    <div style="display:flex;gap:10px;margin-bottom:10px;">
                        <div style="position:relative;flex:1;">
                            <span style="position:absolute;left:15px;top:50%;transform:translateY(-50%);font-size:18px;color:#a0aec0;">🔍</span>
                            <input type="text" id="searchInput" placeholder="Ketik nama untuk mencari..."
                                   autocomplete="off" value="${this.lastSearch || ''}"
                                   style="width:100%;padding:15px 15px 15px 45px;border:2px solid #e2e8f0;border-radius:12px;font-size:16px;box-sizing:border-box;">
                        </div>
                        <button id="searchBtn" 
                                style="padding:15px 30px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;border:none;border-radius:12px;font-weight:600;cursor:pointer;min-width:100px;">
                            Cari
                        </button>
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <p style="font-size:12px;color:#a0aec0;margin:0;">
                            Tekan Enter atau klik Cari • Data: ${this.allData.length} records
                        </p>
                        <span id="searchCounter" style="font-size:12px;color:#667eea;font-weight:600;"></span>
                    </div>
                </div>

                <!-- Search Results Container - PERBAIKAN UTAMA -->
                <div id="searchResultsContainer">
                    ${!hasData ? `
                        <div style="text-align:center;padding:40px;color:#a0aec0;">
                            <div style="font-size:48px;margin-bottom:15px;">📭</div>
                            <p>Belum ada data. Klik Refresh untuk memuat.</p>
                        </div>
                    ` : this.searchResults.length > 0 ? '' : `
                        <!-- Preview Data -->
                        <div style="margin-top:20px;">
                            <h4 style="margin:0 0 15px 0;color:#4a5568;">📋 Data Tersedia (${this.allData.length})</h4>
                            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px;">
                                ${this.allData.slice(0, 8).map((item, idx) => `
                                    <div style="background:#f7fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;display:flex;align-items:center;gap:10px;">
                                        <div style="width:35px;height:35px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:14px;font-weight:700;">
                                            ${idx + 1}
                                        </div>
                                        <div style="flex:1;min-width:0;">
                                            <div style="font-weight:700;color:#2d3748;font-size:13px;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                                                ${this.escapeHtml(item.NAMA || item.nama || '-')}
                                            </div>
                                            <div style="color:#667eea;font-size:12px;">
                                                📱 ${this.escapeHtml(item.NOMOR || item.nomor || '-')}
                                            </div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                            ${this.allData.length > 8 ? `
                                <div style="text-align:center;margin-top:15px;">
                                    <button onclick="n8nModule.switchTab('excel')" style="padding:8px 16px;background:#667eea;color:white;border:none;border-radius:6px;cursor:pointer;font-size:12px;">
                                        Lihat Semua ${this.allData.length} Data →
                                    </button>
                                </div>
                            ` : ''}
                        </div>
                    `}
                </div>
            </div>
        `;
    },

    renderAddView() {
        return `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
                <div>
                    <h3 style="margin:0 0 20px 0;color:#2d3748;">➕ Tambah Data Baru</h3>
                    <div style="background:#f7fafc;padding:20px;border-radius:12px;border:1px solid #e2e8f0;">
                        <div style="margin-bottom:20px;">
                            <label style="display:block;font-weight:600;color:#4a5568;margin-bottom:8px;font-size:14px;">
                                Nama Lengkap <span style="color:#f56565;">*</span>
                            </label>
                            <input type="text" id="addNama" placeholder="Contoh: AFLIS" 
                                   oninput="this.value=this.value.toUpperCase()"
                                   style="width:100%;padding:14px 16px;border:2px solid #e2e8f0;border-radius:10px;font-size:16px;box-sizing:border-box;text-transform:uppercase;">
                        </div>
                        <div style="margin-bottom:25px;">
                            <label style="display:block;font-weight:600;color:#4a5568;margin-bottom:8px;font-size:14px;">
                                Nomor Telepon <span style="color:#f56565;">*</span>
                            </label>
                            <input type="text" id="addNomor" placeholder="Contoh: 08123456789"
                                   style="width:100%;padding:14px 16px;border:2px solid #e2e8f0;border-radius:10px;font-size:16px;box-sizing:border-box;">
                        </div>
                        <div style="display:flex;gap:12px;">
                            <button onclick="n8nModule.clearForm()" style="flex:1;padding:14px;background:#edf2f7;color:#4a5568;border:none;border-radius:10px;font-weight:600;cursor:pointer;">Bersihkan</button>
                            <button onclick="n8nModule.submitAdd()" style="flex:2;padding:14px;background:linear-gradient(135deg,#48bb78 0%,#38a169 100%);color:white;border:none;border-radius:10px;font-weight:600;cursor:pointer;">💾 Simpan</button>
                        </div>
                    </div>
                </div>
                <div>
                    <h3 style="margin:0 0 20px 0;color:#2d3748;">📋 Data Tersedia (${this.allData.length})</h3>
                    <div style="background:#f7fafc;border-radius:12px;border:1px solid #e2e8f0;max-height:400px;overflow-y:auto;">
                        ${this.allData.length > 0 ? `
                            <table style="width:100%;border-collapse:collapse;font-size:13px;">
                                <thead style="position:sticky;top:0;background:#edf2f7;">
                                    <tr><th style="padding:12px;text-align:left;font-weight:600;color:#4a5568;border-bottom:1px solid #e2e8f0;">NAMA</th><th style="padding:12px;text-align:left;font-weight:600;color:#4a5568;border-bottom:1px solid #e2e8f0;">NOMOR</th></tr>
                                </thead>
                                <tbody>
                                    ${this.allData.map(item => `
                                        <tr style="border-bottom:1px solid #e2e8f0;">
                                            <td style="padding:10px 12px;font-weight:600;color:#2d3748;text-transform:uppercase;">${this.escapeHtml(item.NAMA || item.nama || '-')}</td>
                                            <td style="padding:10px 12px;color:#667eea;font-family:monospace;">${this.escapeHtml(item.NOMOR || item.nomor || '-')}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        ` : '<div style="text-align:center;padding:40px;color:#a0aec0;">Belum ada data</div>'}
                    </div>
                </div>
            </div>
        `;
    },

    renderEditView() {
        return `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
                <div>
                    <h3 style="margin:0 0 20px 0;color:#2d3748;">✏️ Edit Data</h3>
                    <div style="background:#f7fafc;padding:20px;border-radius:12px;border:1px solid #e2e8f0;">
                        <div style="margin-bottom:20px;">
                            <label style="display:block;font-weight:600;color:#4a5568;margin-bottom:8px;font-size:14px;">Nama yang akan diubah <span style="color:#f56565;">*</span></label>
                            <input type="text" id="editNamaLama" placeholder="Cari nama..." oninput="this.value=this.value.toUpperCase()"
                                   style="width:100%;padding:14px 16px;border:2px solid #e2e8f0;border-radius:10px;font-size:16px;box-sizing:border-box;text-transform:uppercase;">
                        </div>
                        <div style="margin-bottom:25px;">
                            <label style="display:block;font-weight:600;color:#4a5568;margin-bottom:8px;font-size:14px;">Nomor Baru <span style="color:#f56565;">*</span></label>
                            <input type="text" id="editNomorBaru" placeholder="Nomor baru..." style="width:100%;padding:14px 16px;border:2px solid #e2e8f0;border-radius:10px;font-size:16px;box-sizing:border-box;">
                        </div>
                        <button onclick="n8nModule.submitEdit()" style="width:100%;padding:14px;background:linear-gradient(135deg,#ed8936 0%,#dd6b20 100%);color:white;border:none;border-radius:10px;font-weight:600;cursor:pointer;">💾 Update</button>
                    </div>
                </div>
                <div>
                    <h3 style="margin:0 0 20px 0;color:#2d3748;">📋 Pilih Data</h3>
                    <div style="background:#f7fafc;border-radius:12px;border:1px solid #e2e8f0;max-height:400px;overflow-y:auto;">
                        ${this.allData.length > 0 ? `
                            <table style="width:100%;border-collapse:collapse;font-size:13px;">
                                <thead style="position:sticky;top:0;background:#edf2f7;">
                                    <tr><th style="padding:12px;text-align:left;font-weight:600;color:#4a5568;border-bottom:1px solid #e2e8f0;">NAMA</th><th style="padding:12px;text-align:center;font-weight:600;color:#4a5568;border-bottom:1px solid #e2e8f0;">Aksi</th></tr>
                                </thead>
                                <tbody>
                                    ${this.allData.map(item => `
                                        <tr style="border-bottom:1px solid #e2e8f0;">
                                            <td style="padding:10px 12px;font-weight:600;color:#2d3748;text-transform:uppercase;">${this.escapeHtml(item.NAMA || item.nama || '-')}</td>
                                            <td style="padding:10px 12px;text-align:center;">
                                                <button onclick="n8nModule.fillEditForm('${this.escapeHtml(item.NAMA || item.nama)}','${this.escapeHtml(item.NOMOR || item.nomor)}')" style="padding:6px 12px;background:#fef3c7;color:#d97706;border:none;border-radius:4px;cursor:pointer;font-size:12px;">Pilih</button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        ` : '<div style="text-align:center;padding:40px;color:#a0aec0;">Belum ada data</div>'}
                    </div>
                </div>
            </div>
        `;
    },

    renderDeleteView() {
        return `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
                <div>
                    <h3 style="margin:0 0 20px 0;color:#2d3748;">🗑️ Hapus Data</h3>
                    <div style="background:#f7fafc;padding:20px;border-radius:12px;border:1px solid #e2e8f0;">
                        <div style="margin-bottom:20px;">
                            <label style="display:block;font-weight:600;color:#4a5568;margin-bottom:8px;font-size:14px;">Nama yang akan dihapus <span style="color:#f56565;">*</span></label>
                            <input type="text" id="deleteNama" placeholder="Nama yang mau dihapus..." oninput="this.value=this.value.toUpperCase()"
                                   style="width:100%;padding:14px 16px;border:2px solid #e2e8f0;border-radius:10px;font-size:16px;box-sizing:border-box;text-transform:uppercase;">
                        </div>
                        <div style="background:#fff5f5;border:1px solid #feb2b2;border-radius:10px;padding:16px;margin-bottom:25px;color:#c53030;font-size:14px;">
                            ⚠️ <strong>Perhatian!</strong> Data yang dihapus tidak dapat dikembalikan.
                        </div>
                        <button onclick="n8nModule.submitDelete()" style="width:100%;padding:14px;background:linear-gradient(135deg,#f56565 0%,#e53e3e 100%);color:white;border:none;border-radius:10px;font-weight:600;cursor:pointer;">🗑️ Hapus Permanen</button>
                    </div>
                </div>
                <div>
                    <h3 style="margin:0 0 20px 0;color:#2d3748;">📋 Pilih Data</h3>
                    <div style="background:#f7fafc;border-radius:12px;border:1px solid #e2e8f0;max-height:400px;overflow-y:auto;">
                        ${this.allData.length > 0 ? `
                            <table style="width:100%;border-collapse:collapse;font-size:13px;">
                                <thead style="position:sticky;top:0;background:#edf2f7;">
                                    <tr><th style="padding:12px;text-align:left;font-weight:600;color:#4a5568;border-bottom:1px solid #e2e8f0;">NAMA</th><th style="padding:12px;text-align:center;font-weight:600;color:#4a5568;border-bottom:1px solid #e2e8f0;">Aksi</th></tr>
                                </thead>
                                <tbody>
                                    ${this.allData.map(item => `
                                        <tr style="border-bottom:1px solid #e2e8f0;">
                                            <td style="padding:10px 12px;font-weight:600;color:#2d3748;text-transform:uppercase;">${this.escapeHtml(item.NAMA || item.nama || '-')}</td>
                                            <td style="padding:10px 12px;text-align:center;">
                                                <button onclick="document.getElementById('deleteNama').value='${this.escapeHtml(item.NAMA || item.nama)}'" style="padding:6px 12px;background:#fee2e2;color:#dc2626;border:none;border-radius:4px;cursor:pointer;font-size:12px;">Pilih</button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        ` : '<div style="text-align:center;padding:40px;color:#a0aec0;">Belum ada data</div>'}
                    </div>
                </div>
            </div>
        `;
    },

    renderExcelView() {
        if (this.allData.length === 0) {
            return `<div style="text-align:center;padding:60px;color:#a0aec0;"><div style="font-size:48px;margin-bottom:15px;">📊</div><p>Belum ada data</p></div>`;
        }
        
        const headers = Object.keys(this.allData[0]);
        
        return `
            <div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                    <h3 style="margin:0;color:#2d3748;">📊 Excel View - ${this.allData.length} Records</h3>
                    <div style="display:flex;gap:8px;">
                        <button onclick="n8nModule.exportToExcel()" style="padding:10px 20px;background:#48bb78;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;">📥 Export</button>
                        <button onclick="n8nModule.refreshData()" style="padding:10px 20px;background:#667eea;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;">🔄 Refresh</button>
                    </div>
                </div>
                <div style="overflow-x:auto;border:1px solid #e2e8f0;border-radius:12px;background:white;">
                    <table style="width:100%;border-collapse:collapse;font-size:13px;">
                        <thead>
                            <tr style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;">
                                ${headers.map(h => `<th style="padding:14px 12px;text-align:left;font-weight:600;text-transform:uppercase;font-size:11px;">${h}</th>`).join('')}
                                <th style="padding:14px 12px;text-align:center;width:100px;">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.allData.map((row, idx) => `
                                <tr style="background:${idx % 2 === 0 ? 'white' : '#f7fafc'};">
                                    ${headers.map(h => `<td style="padding:12px;border-bottom:1px solid #e2e8f0;color:#2d3748;${h==='NAMA'?'font-weight:600;text-transform:uppercase;':''}${h==='NOMOR'?'color:#667eea;font-family:monospace;':''}">${this.escapeHtml(row[h])}</td>`).join('')}
                                    <td style="padding:12px;border-bottom:1px solid #e2e8f0;text-align:center;">
                                        <button onclick="n8nModule.quickEdit('${this.escapeHtml(row.NAMA || row.nama)}','${this.escapeHtml(row.NOMOR || row.nomor)}')" style="padding:6px 10px;background:#fef3c7;color:#d97706;border:none;border-radius:4px;cursor:pointer;font-size:12px;margin-right:4px;">✏️</button>
                                        <button onclick="n8nModule.quickDelete('${this.escapeHtml(row.NAMA || row.nama)}')" style="padding:6px 10px;background:#fee2e2;color:#dc2626;border:none;border-radius:4px;cursor:pointer;font-size:12px;">🗑️</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    renderGASView() {
        const gasCode = this.gasTemplate
            .replace('{{SPREADSHEET_ID}}', this.config.spreadsheetId || 'YOUR_SPREADSHEET_ID')
            .replace('{{SHEET_NAME}}', this.config.sheetName || 'Sheet1');
        
        return `
            <div>
                <h3 style="margin:0 0 20px 0;color:#2d3748;">⚡ Setup Google Apps Script</h3>
                <div style="display:grid;gap:20px;">
                    <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:20px;">
                        <h4 style="margin:0 0 15px 0;color:#4a5568;">1. Konfigurasi</h4>
                        <div style="display:grid;gap:15px;">
                            <div>
                                <label style="display:block;font-weight:600;color:#4a5568;margin-bottom:6px;font-size:13px;">Spreadsheet ID</label>
                                <input type="text" id="gasSpreadsheetId" value="${this.config.spreadsheetId}" placeholder="1cPolj_xpBztq6RU3XVi_CZm1j_Kqo-zQC-wsbIYrLXE" style="width:100%;padding:12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;font-family:monospace;">
                            </div>
                            <div>
                                <label style="display:block;font-weight:600;color:#4a5568;margin-bottom:6px;font-size:13px;">Sheet Name</label>
                                <input type="text" id="gasSheetName" value="${this.config.sheetName}" placeholder="Data Base Hifzi Cell" style="width:100%;padding:12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;">
                            </div>
                            <div>
                                <label style="display:block;font-weight:600;color:#4a5568;margin-bottom:6px;font-size:13px;">Web App URL</label>
                                <input type="text" id="gasWebAppUrl" value="${this.config.webAppUrl}" placeholder="https://script.google.com/macros/s/.../exec" style="width:100%;padding:12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;font-family:monospace;">
                            </div>
                            <button onclick="n8nModule.saveGASConfig()" style="padding:12px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;border:none;border-radius:8px;font-weight:600;cursor:pointer;">💾 Simpan</button>
                        </div>
                    </div>
                    
                    <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:20px;">
                        <h4 style="margin:0 0 15px 0;color:#4a5568;">2. GAS Code (CORS Fixed)</h4>
                        <div style="position:relative;">
                            <textarea id="gasCodeOutput" readonly style="width:100%;height:250px;padding:15px;background:#1a202c;color:#68d391;border:none;border-radius:8px;font-family:monospace;font-size:11px;resize:vertical;">${gasCode}</textarea>
                            <button onclick="n8nModule.copyGASCode()" style="position:absolute;top:10px;right:10px;padding:8px 16px;background:rgba(255,255,255,0.1);color:white;border:1px solid rgba(255,255,255,0.2);border-radius:6px;cursor:pointer;font-size:12px;">📋 Copy</button>
                        </div>
                    </div>
                    
                    <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:20px;">
                        <h4 style="margin:0 0 15px 0;color:#4a5568;">3. Test Koneksi</h4>
                        <div style="display:flex;gap:10px;">
                            <button onclick="n8nModule.testConnection()" style="flex:1;padding:12px;background:#ed8936;color:white;border:none;border-radius:8px;font-weight:600;cursor:pointer;">🧪 Test Read</button>
                            <button onclick="n8nModule.testWriteConnection()" style="flex:1;padding:12px;background:#9f7aea;color:white;border:none;border-radius:8px;font-weight:600;cursor:pointer;">🧪 Test Write</button>
                        </div>
                        <div id="testResult" style="margin-top:15px;padding:12px;border-radius:8px;display:none;"></div>
                    </div>
                </div>
            </div>
        `;
    },

    // Utilities
    switchTab(view) {
        this.currentView = view;
        this.renderPage();
    },

    async refreshData() {
        app.showToast('🔄 Memuat ulang...');
        await this.loadSheetData();
    },

    quickEdit(nama, nomor) {
        this.switchTab('edit');
        setTimeout(() => {
            const namaInput = document.getElementById('editNamaLama');
            const nomorInput = document.getElementById('editNomorBaru');
            if (namaInput) namaInput.value = nama || '';
            if (nomorInput) nomorInput.value = nomor || '';
        }, 100);
    },

    fillEditForm(nama, nomor) {
        const namaInput = document.getElementById('editNamaLama');
        const nomorInput = document.getElementById('editNomorBaru');
        if (namaInput) namaInput.value = nama || '';
        if (nomorInput) nomorInput.value = nomor || '';
        app.showToast(`✅ ${nama} dipilih untuk edit`);
    },

    quickDelete(nama) {
        this.switchTab('delete');
        setTimeout(() => {
            const input = document.getElementById('deleteNama');
            if (input) input.value = nama || '';
        }, 100);
    },

    clearForm() {
        const nama = document.getElementById('addNama');
        const nomor = document.getElementById('addNomor');
        if (nama) nama.value = '';
        if (nomor) nomor.value = '';
    },

    saveGASConfig() {
        const spreadsheetId = document.getElementById('gasSpreadsheetId')?.value.trim();
        const sheetName = document.getElementById('gasSheetName')?.value.trim();
        const webAppUrl = document.getElementById('gasWebAppUrl')?.value.trim();
        
        if (spreadsheetId) this.config.spreadsheetId = spreadsheetId;
        if (sheetName) this.config.sheetName = sheetName;
        if (webAppUrl) this.config.webAppUrl = webAppUrl;
        
        this.saveConfig();
        app.showToast('✅ Konfigurasi tersimpan!');
        
        if (this.config.spreadsheetId) this.loadSheetData();
    },

    copyGASCode() {
        const textarea = document.getElementById('gasCodeOutput');
        if (textarea) {
            textarea.select();
            document.execCommand('copy');
            app.showToast('📋 Code dicopy!');
        }
    },

    async testConnection() {
        const resultDiv = document.getElementById('testResult');
        if (!resultDiv) return;
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = '🧪 Testing...';
        
        try {
            if (!this.config.spreadsheetId) throw new Error('Spreadsheet ID belum diatur');
            const csvUrl = `https://docs.google.com/spreadsheets/d/${this.config.spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(this.config.sheetName)}`;
            const response = await fetch(csvUrl);
            if (response.ok) {
                resultDiv.innerHTML = '<span style="color:#48bb78;">✅ Read OK!</span>';
            } else {
                throw new Error('HTTP ' + response.status);
            }
        } catch (error) {
            resultDiv.innerHTML = `<span style="color:#f56565;">❌ ${error.message}</span>`;
        }
    },

    async testWriteConnection() {
        const resultDiv = document.getElementById('testResult');
        if (!resultDiv) return;
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = '🧪 Testing...';
        
        try {
            if (!this.config.webAppUrl) throw new Error('Web App URL belum diatur');
            const response = await fetch(this.config.webAppUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'getAll' })
            });
            const result = await response.json();
            if (result.success) {
                resultDiv.innerHTML = `<span style="color:#48bb78;">✅ Write OK! ${result.count} records</span>`;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            resultDiv.innerHTML = `<span style="color:#f56565;">❌ ${error.message}</span>`;
        }
    },

    exportToExcel() {
        if (this.allData.length === 0) {
            app.showToast('❌ Tidak ada data');
            return;
        }
        try {
            const ws = XLSX.utils.json_to_sheet(this.allData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Data');
            const filename = `HifziCell_${new Date().toISOString().slice(0,10)}.xlsx`;
            XLSX.writeFile(wb, filename);
            app.showToast(`✅ ${filename}`);
        } catch (error) {
            app.showToast('❌ Export gagal: ' + error.message);
        }
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

console.log('[N8N] Module loaded - Search Fixed Version');

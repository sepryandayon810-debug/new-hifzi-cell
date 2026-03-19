/**
 * N8N Integration Module - Hifzi Cell POS
 * Menu Pencarian & Manajemen Data via Google Sheets (DIRECT)
 * 
 * FITUR:
 * - Cari: Langsung query ke Sheets via CSV (read-only, cepat)
 * - Tambah/Edit/Hapus: Via Google Apps Script Web App (write)
 */

const n8nModule = {
    currentView: 'search',
    searchResults: [],
    allData: [],
    isLoading: false,
    
    // Konfigurasi - GANTI DENGAN URL WEB APP ANDA SETELAH DEPLOY
    config: {
        spreadsheetId: '1cPolj_xpBztq6RU3XVi_CZm1j_Kqo-zQC-wsbIYrLXE',
        sheetName: 'Data Base Hifzi Cell',
        webAppUrl: localStorage.getItem('hifzi_sheets_webapp_url') || 'https://script.google.com/macros/s/AKfycbwXXXXXXXXXXXXXXXX/exec',
        botUsername: '@HifziCellBot'
    },

    init() {
        console.log('[N8N] Module initialized - Direct Sheets Mode');
        this.loadConfig();
        this.loadSheetData();
        this.renderPage();
    },

    loadConfig() {
        const savedConfig = localStorage.getItem('hifzi_n8n_config');
        if (savedConfig) {
            this.config = { ...this.config, ...JSON.parse(savedConfig) };
        }
    },

    saveConfig() {
        localStorage.setItem('hifzi_n8n_config', JSON.stringify(this.config));
    },

    /**
     * LOAD DATA - Via CSV Export (Cepat, tidak perlu auth)
     */
    async loadSheetData() {
        try {
            this.isLoading = true;
            const csvUrl = `https://docs.google.com/spreadsheets/d/${this.config.spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(this.config.sheetName)}`;
            
            console.log('[N8N] Loading data from Google Sheets...');
            
            const response = await fetch(csvUrl);
            const csvText = await response.text();
            
            this.allData = this.parseCSV(csvText);
            console.log(`[N8N] Loaded ${this.allData.length} records`);
            
        } catch (error) {
            console.error('[N8N] Error loading sheet data:', error);
            app.showToast('❌ Gagal memuat data dari Sheets');
            this.allData = [];
        } finally {
            this.isLoading = false;
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
        try {
            const response = await fetch(this.config.webAppUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, ...data })
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
    // UI RENDERING (Tetap sama seperti sebelumnya)
    // ============================================

    renderPage() {
        const container = document.getElementById('mainContent');
        if (!container) return;

        const currentUser = dataManager.getCurrentUser();
        
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

        container.innerHTML = `
            <div class="content-section active">
                <div class="n8n-header">
                    <div class="n8n-title">
                        <span class="n8n-icon">🔍</span>
                        <div>
                            <h2>Pencarian Data</h2>
                            <p>Google Sheets: ${this.config.sheetName}</p>
                            <small style="color: #888;">
                                ${this.allData.length} data tersedia 
                                ${this.isLoading ? '<span class="n8n-loading"></span>' : ''}
                            </small>
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="n8n-config-btn" onclick="n8nModule.refreshData()" title="Refresh Data">
                            🔄
                        </button>
                        <button class="n8n-config-btn" onclick="n8nModule.openConfigModal()" title="Konfigurasi">
                            ⚙️
                        </button>
                    </div>
                </div>

                <div class="n8n-tabs">
                    <button class="n8n-tab ${this.currentView === 'search' ? 'active' : ''}" onclick="n8nModule.switchTab('search')">
                        <span>🔍</span> Cari
                    </button>
                    <button class="n8n-tab ${this.currentView === 'add' ? 'active' : ''}" onclick="n8nModule.switchTab('add')">
                        <span>➕</span> Tambah
                    </button>
                    <button class="n8n-tab ${this.currentView === 'edit' ? 'active' : ''}" onclick="n8nModule.switchTab('edit')">
                        <span>✏️</span> Edit
                    </button>
                    <button class="n8n-tab ${this.currentView === 'delete' ? 'active' : ''}" onclick="n8nModule.switchTab('delete')">
                        <span>🗑️</span> Hapus
                    </button>
                </div>

                <div class="n8n-content">
                    ${this.renderCurrentView()}
                </div>

                <div class="n8n-info-card">
                    <div class="n8n-info-icon">💡</div>
                    <div class="n8n-info-text">
                        <strong>Mode Langsung:</strong> Cari = CSV Export (cepat) | Tulis = Web App API<br>
                        <small>Telegram tetap via n8n • Web POS langsung ke Sheets</small>
                    </div>
                </div>
            </div>
        `;

        this.attachEventListeners();
    },

    renderCurrentView() {
        switch(this.currentView) {
            case 'search': return this.renderSearchView();
            case 'add': return this.renderAddView();
            case 'edit': return this.renderEditView();
            case 'delete': return this.renderDeleteView();
            default: return this.renderSearchView();
        }
    },

    renderSearchView() {
        return `
            <div class="n8n-view">
                <div class="n8n-search-box">
                    <div class="n8n-input-group">
                        <span class="n8n-input-icon">🔍</span>
                        <input type="text" 
                               id="searchInput" 
                               class="n8n-input" 
                               placeholder="Ketik nama untuk mencari... (contoh: AFLIS)"
                               autocomplete="off">
                        <button class="n8n-search-btn" onclick="n8nModule.performSearch()">
                            ${this.isLoading ? '<span class="n8n-loading"></span>' : 'Cari'}
                        </button>
                    </div>
                    <p class="n8n-hint" style="font-size: 11px; color: #999; margin-top: 5px;">
                        Tekan Enter atau klik Cari • Data realtime dari Google Sheets
                    </p>
                </div>

                <div id="searchResults" class="n8n-results">
                    ${this.renderResultsList()}
                </div>
            </div>
        `;
    },

    renderResultsList() {
        if (this.searchResults.length === 0) {
            if (this.allData.length === 0) {
                return `
                    <div class="n8n-empty">
                        <span>⏳</span>
                        <p>Memuat data dari Google Sheets...</p>
                        <button onclick="n8nModule.refreshData()" style="margin-top: 10px; padding: 8px 16px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer;">
                            🔄 Refresh Manual
                        </button>
                    </div>
                `;
            }
            return `
                <div class="n8n-empty">
                    <span>🔍</span>
                    <p>Masukkan kata kunci untuk mencari</p>
                    <small style="color: #999;">Data tersedia: ${this.allData.length} records</small>
                </div>
            `;
        }

        return `
            <div class="n8n-results-header">
                <span>${this.searchResults.length} hasil ditemukan</span>
                <button class="n8n-clear-btn" onclick="n8nModule.clearResults()">Clear</button>
            </div>
            <div class="n8n-results-list">
                ${this.searchResults.map((item) => `
                    <div class="n8n-result-item">
                        <div class="n8n-result-icon">👤</div>
                        <div class="n8n-result-info">
                            <div class="n8n-result-name">${this.escapeHtml(item.NAMA || item.nama || '-')}</div>
                            <div class="n8n-result-number">📱 ${this.escapeHtml(item.NOMOR || item.nomor || item.TELEPON || item.HP || '-')}</div>
                        </div>
                        <div class="n8n-result-actions">
                            <button class="n8n-action-btn edit" onclick="n8nModule.quickEdit('${this.escapeHtml(item.NAMA || item.nama)}', '${this.escapeHtml(item.NOMOR || item.nomor)}')" title="Edit">✏️</button>
                            <button class="n8n-action-btn delete" onclick="n8nModule.quickDelete('${this.escapeHtml(item.NAMA || item.nama)}')" title="Hapus">🗑️</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    renderAddView() {
        return `
            <div class="n8n-view">
                <div class="n8n-form">
                    <div class="n8n-form-group">
                        <label>Nama Lengkap <span class="required">*</span></label>
                        <input type="text" id="addNama" class="n8n-input" placeholder="Contoh: AFLIS" 
                               oninput="this.value = this.value.toUpperCase()">
                    </div>
                    <div class="n8n-form-group">
                        <label>Nomor Telepon <span class="required">*</span></label>
                        <input type="text" id="addNomor" class="n8n-input" placeholder="Contoh: 08123456789">
                    </div>
                    <div class="n8n-form-actions">
                        <button class="n8n-btn n8n-btn-secondary" onclick="n8nModule.clearForm()">Bersihkan</button>
                        <button class="n8n-btn n8n-btn-primary" onclick="n8nModule.submitAdd()">
                            ${this.isLoading ? '<span class="n8n-loading"></span>' : '💾 Simpan ke Sheets'}
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    renderEditView() {
        return `
            <div class="n8n-view">
                <div class="n8n-form">
                    <div class="n8n-form-group">
                        <label>Nama yang akan diubah <span class="required">*</span></label>
                        <input type="text" id="editNamaLama" class="n8n-input" placeholder="Cari nama..." 
                               oninput="this.value = this.value.toUpperCase()">
                    </div>
                    <div class="n8n-form-group">
                        <label>Nomor Baru <span class="required">*</span></label>
                        <input type="text" id="editNomorBaru" class="n8n-input" placeholder="Nomor baru...">
                    </div>
                    <div class="n8n-form-actions">
                        <button class="n8n-btn n8n-btn-primary" onclick="n8nModule.submitEdit()">
                            ${this.isLoading ? '<span class="n8n-loading"></span>' : '💾 Update Data'}
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    renderDeleteView() {
        return `
            <div class="n8n-view">
                <div class="n8n-form">
                    <div class="n8n-form-group">
                        <label>Nama yang akan dihapus <span class="required">*</span></label>
                        <input type="text" id="deleteNama" class="n8n-input" placeholder="Nama yang mau dihapus..." 
                               oninput="this.value = this.value.toUpperCase()">
                    </div>
                    <div class="n8n-alert n8n-alert-danger">
                        <span>⚠️</span>
                        <div><strong>Perhatian!</strong> Data yang dihapus tidak dapat dikembalikan.</div>
                    </div>
                    <div class="n8n-form-actions">
                        <button class="n8n-btn n8n-btn-danger" onclick="n8nModule.submitDelete()">
                            ${this.isLoading ? '<span class="n8n-loading"></span>' : '🗑️ Hapus Permanen'}
                        </button>
                    </div>
                </div>
            </div>
        `;
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
        this.renderPage();
        app.showToast(`✅ ${this.allData.length} data dimuat`);
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
        const modalHTML = `
            <div class="modal active" id="n8nConfigModal" style="display: flex; z-index: 4000; align-items: flex-start; padding-top: 80px;">
                <div class="modal-content" style="max-width: 450px;">
                    <div class="modal-header">
                        <span class="modal-title">⚙️ Konfigurasi Google Sheets</span>
                        <button onclick="document.getElementById('n8nConfigModal').remove()" style="background: none; border: none; font-size: 20px; cursor: pointer;">×</button>
                    </div>
                    <div style="padding: 20px;">
                        <div class="n8n-form-group">
                            <label>Spreadsheet ID</label>
                            <input type="text" id="configSpreadsheetId" class="n8n-input" value="${this.config.spreadsheetId}">
                        </div>
                        <div class="n8n-form-group">
                            <label>Sheet Name</label>
                            <input type="text" id="configSheetName" class="n8n-input" value="${this.config.sheetName}">
                        </div>
                        <div class="n8n-form-group">
                            <label>Web App URL (untuk Tambah/Edit/Hapus)</label>
                            <input type="text" id="configWebAppUrl" class="n8n-input" value="${this.config.webAppUrl}" 
                                   placeholder="https://script.google.com/macros/s/.../exec">
                            <small style="color: #888;">Dari Deploy Google Apps Script</small>
                        </div>
                        <div style="background: #e3f2fd; padding: 12px; border-radius: 8px; margin-top: 15px; font-size: 12px; color: #1565c0; line-height: 1.5;">
                            <strong>💡 Cara Setup Web App:</strong><br>
                            1. Buka Google Sheets → Extensions → Apps Script<br>
                            2. Paste code backend (saya berikan)<br>
                            3. Deploy → New Deployment → Web App<br>
                            4. Copy URL dan paste di atas
                        </div>
                    </div>
                    <div style="display: flex; gap: 10px; justify-content: flex-end; padding: 0 20px 20px;">
                        <button class="btn btn-secondary" onclick="document.getElementById('n8nConfigModal').remove()">Batal</button>
                        <button class="btn btn-primary" onclick="n8nModule.saveConfigFromModal()">Simpan & Refresh</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    async saveConfigFromModal() {
        const spreadsheetId = document.getElementById('configSpreadsheetId')?.value.trim();
        const sheetName = document.getElementById('configSheetName')?.value.trim();
        const webAppUrl = document.getElementById('configWebAppUrl')?.value.trim();
        
        if (spreadsheetId) this.config.spreadsheetId = spreadsheetId;
        if (sheetName) this.config.sheetName = sheetName;
        if (webAppUrl) {
            this.config.webAppUrl = webAppUrl;
            localStorage.setItem('hifzi_sheets_webapp_url', webAppUrl);
        }
        
        this.saveConfig();
        document.getElementById('n8nConfigModal')?.remove();
        
        app.showToast('🔄 Menyimpan & memuat data...');
        await this.refreshData();
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

console.log('[N8N] Module loaded - Direct Sheets Integration');

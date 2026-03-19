/**
 * N8N Integration Module - Hifzi Cell POS
 * Menu Pencarian & Manajemen Data via Google Sheets (sama dengan n8n)
 */

const n8nModule = {
    currentView: 'search',
    searchResults: [],
    isLoading: false,
    
    // Konfigurasi Google Sheets (sama dengan n8n workflow Anda)
    config: {
        spreadsheetId: '1cPolj_xpBztq6RU3XVi_CZm1j_Kqo-zQC-wsbIYrLXE',
        sheetName: 'Data Base Hifzi Cell',
        apiKey: '',
        botUsername: '@HifziCellBot'
    },

    // Cache data dari Google Sheets
    sheetData: [],

    init() {
        console.log('[N8N] Module initialized');
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
     * Load data dari Google Sheets menggunakan Public CSV Export
     */
    async loadSheetData() {
        try {
            const csvUrl = `https://docs.google.com/spreadsheets/d/${this.config.spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(this.config.sheetName)}`;
            
            console.log('[N8N] Loading data from Google Sheets...');
            
            const response = await fetch(csvUrl);
            const csvText = await response.text();
            
            this.sheetData = this.parseCSV(csvText);
            console.log(`[N8N] Loaded ${this.sheetData.length} records`);
            
        } catch (error) {
            console.error('[N8N] Error loading sheet data:', error);
            this.sheetData = [];
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

    /**
     * Parse satu baris CSV (handle quoted values)
     */
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
                            <small style="color: #888;">${this.sheetData.length} data tersedia</small>
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
                        <strong>Perintah Telegram (tanpa slash):</strong><br>
                        <code>cari [nama]</code> • <code>tambah NAMA:NOMOR</code> • <code>edit NAMA:NOMOR_BARU</code> • <code>hapus NAMA</code>
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
                        <button class="n8n-search-btn" onclick="n8nModule.performSearch()">Cari</button>
                    </div>
                    <p class="n8n-hint" style="font-size: 11px; color: #999; margin-top: 5px;">
                        Tekan Enter atau klik Cari • Format: cari [nama]
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
            if (this.sheetData.length === 0) {
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
                    <small style="color: #999;">Data tersedia: ${this.sheetData.length} records</small>
                </div>
            `;
        }

        return `
            <div class="n8n-results-header">
                <span>${this.searchResults.length} hasil ditemukan</span>
                <button class="n8n-clear-btn" onclick="n8nModule.clearResults()">Clear</button>
            </div>
            <div class="n8n-results-list">
                ${this.searchResults.map((item, index) => `
                    <div class="n8n-result-item">
                        <div class="n8n-result-icon">👤</div>
                        <div class="n8n-result-info">
                            <div class="n8n-result-name">${this.escapeHtml(item.NAMA || item.nama || '-')}</div>
                            <div class="n8n-result-number">📱 ${this.escapeHtml(item.NOMOR || item.nomor || item.TELEPON || item.HP || '-')}</div>
                        </div>
                        <div class="n8n-result-actions">
                            <button class="n8n-action-btn edit" onclick="n8nModule.quickEdit('${this.escapeHtml(item.NAMA || item.nama)}')" title="Edit">✏️</button>
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
                               oninput="this.value = this.value.toUpperCase(); n8nModule.updateAddPreview()">
                    </div>
                    <div class="n8n-form-group">
                        <label>Nomor Telepon <span class="required">*</span></label>
                        <input type="text" id="addNomor" class="n8n-input" placeholder="Contoh: 08123456789" 
                               oninput="n8nModule.updateAddPreview()">
                    </div>
                    <div class="n8n-form-actions">
                        <button class="n8n-btn n8n-btn-secondary" onclick="n8nModule.clearForm()">Bersihkan</button>
                        <button class="n8n-btn n8n-btn-primary" onclick="n8nModule.submitAdd()">💾 Simpan</button>
                    </div>
                </div>
                <div class="n8n-preview-card">
                    <div class="n8n-preview-title">📤 Perintah Telegram:</div>
                    <code id="addCommandPreview" class="n8n-command-preview">tambah :</code>
                    <button class="n8n-copy-btn" onclick="n8nModule.copyAddCommand()">📋 Salin & Buka Telegram</button>
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
                               oninput="this.value = this.value.toUpperCase(); n8nModule.updateEditPreview()">
                    </div>
                    <div class="n8n-form-group">
                        <label>Nomor Baru <span class="required">*</span></label>
                        <input type="text" id="editNomorBaru" class="n8n-input" placeholder="Nomor baru..." 
                               oninput="n8nModule.updateEditPreview()">
                    </div>
                    <div class="n8n-form-actions">
                        <button class="n8n-btn n8n-btn-primary" onclick="n8nModule.submitEdit()">💾 Update</button>
                    </div>
                </div>
                <div class="n8n-preview-card">
                    <div class="n8n-preview-title">📤 Perintah Telegram:</div>
                    <code id="editCommandPreview" class="n8n-command-preview">edit :</code>
                    <button class="n8n-copy-btn" onclick="n8nModule.copyEditCommand()">📋 Salin & Buka Telegram</button>
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
                               oninput="this.value = this.value.toUpperCase(); n8nModule.updateDeletePreview()">
                    </div>
                    <div class="n8n-alert n8n-alert-danger">
                        <span>⚠️</span>
                        <div><strong>Perhatian!</strong> Data yang dihapus tidak dapat dikembalikan.</div>
                    </div>
                    <div class="n8n-form-actions">
                        <button class="n8n-btn n8n-btn-danger" onclick="n8nModule.submitDelete()">🗑️ Hapus Permanen</button>
                    </div>
                </div>
                <div class="n8n-preview-card">
                    <div class="n8n-preview-title">📤 Perintah Telegram:</div>
                    <code id="deleteCommandPreview" class="n8n-command-preview">hapus </code>
                    <button class="n8n-copy-btn" onclick="n8nModule.copyDeleteCommand()">📋 Salin & Buka Telegram</button>
                </div>
            </div>
        `;
    },

    switchTab(view) {
        this.currentView = view;
        this.renderPage();
    },

    attachEventListeners() {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.performSearch();
            });
            setTimeout(() => searchInput.focus(), 100);
        }
    },

    /**
     * PENCARIAN - Menggunakan data dari Google Sheets
     */
    performSearch() {
        const input = document.getElementById('searchInput');
        const keyword = input?.value.trim().toUpperCase();
        
        if (!keyword) {
            app.showToast('❌ Masukkan kata kunci pencarian!');
            return;
        }

        console.log(`[N8N] Searching for: "${keyword}" in ${this.sheetData.length} records`);

        // Filter data dari Google Sheets
        this.searchResults = this.sheetData.filter(item => {
            const nama = (item.NAMA || item.nama || '').toUpperCase();
            const nomor = (item.NOMOR || item.nomor || item.TELEPON || item.HP || '').toString();
            
            return nama.includes(keyword) || nomor.includes(keyword);
        });

        console.log(`[N8N] Found ${this.searchResults.length} results`);
        this.renderResults();
    },

    renderResults() {
        const container = document.getElementById('searchResults');
        if (container) {
            container.innerHTML = this.renderResultsList();
        }
    },

    clearResults() {
        this.searchResults = [];
        this.renderPage();
    },

    async refreshData() {
        app.showToast('🔄 Memuat ulang data...');
        await this.loadSheetData();
        this.renderPage();
        app.showToast(`✅ ${this.sheetData.length} data dimuat`);
    },

    // Preview updates - TANPA SLASH
    updateAddPreview() {
        const nama = document.getElementById('addNama')?.value.trim().toUpperCase() || '';
        const nomor = document.getElementById('addNomor')?.value.trim() || '';
        const preview = document.getElementById('addCommandPreview');
        if (preview) preview.textContent = nama || nomor ? `tambah ${nama}:${nomor}` : 'tambah :';
    },

    updateEditPreview() {
        const nama = document.getElementById('editNamaLama')?.value.trim().toUpperCase() || '';
        const nomor = document.getElementById('editNomorBaru')?.value.trim() || '';
        const preview = document.getElementById('editCommandPreview');
        if (preview) preview.textContent = nama || nomor ? `edit ${nama}:${nomor}` : 'edit :';
    },

    updateDeletePreview() {
        const nama = document.getElementById('deleteNama')?.value.trim().toUpperCase() || '';
        const preview = document.getElementById('deleteCommandPreview');
        if (preview) preview.textContent = nama ? `hapus ${nama}` : 'hapus ';
    },

    // Submit actions - TANPA SLASH
    submitAdd() {
        const nama = document.getElementById('addNama')?.value.trim().toUpperCase();
        const nomor = document.getElementById('addNomor')?.value.trim();

        if (!nama || !nomor) {
            app.showToast('❌ Nama dan nomor wajib diisi!');
            return;
        }

        const command = `tambah ${nama}:${nomor}`;
        this.copyAndOpenTelegram(command);
        this.clearForm();
    },

    submitEdit() {
        const nama = document.getElementById('editNamaLama')?.value.trim().toUpperCase();
        const nomor = document.getElementById('editNomorBaru')?.value.trim();

        if (!nama || !nomor) {
            app.showToast('❌ Nama dan nomor baru wajib diisi!');
            return;
        }

        const command = `edit ${nama}:${nomor}`;
        this.copyAndOpenTelegram(command);
    },

    submitDelete() {
        const nama = document.getElementById('deleteNama')?.value.trim().toUpperCase();

        if (!nama) {
            app.showToast('❌ Nama wajib diisi!');
            return;
        }

        if (!confirm(`⚠️ Yakin hapus "${nama}"?`)) return;

        const command = `hapus ${nama}`;
        this.copyAndOpenTelegram(command);
    },

    quickEdit(nama) {
        this.switchTab('edit');
        setTimeout(() => {
            const input = document.getElementById('editNamaLama');
            if (input) {
                input.value = nama;
                input.dispatchEvent(new Event('input'));
                document.getElementById('editNomorBaru')?.focus();
            }
        }, 100);
    },

    quickDelete(nama) {
        this.switchTab('delete');
        setTimeout(() => {
            const input = document.getElementById('deleteNama');
            if (input) {
                input.value = nama;
                input.dispatchEvent(new Event('input'));
            }
        }, 100);
    },

    copyAndOpenTelegram(text) {
        this.copyToClipboard(text);
        
        setTimeout(() => {
            window.open(`https://t.me/${this.config.botUsername.replace('@', '')}`, '_blank');
        }, 500);
        
        app.showToast('📋 Disalin! Membuka Telegram...');
    },

    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            console.log('[N8N] Copied to clipboard:', text);
        }).catch(() => {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        });
    },

    copyAddCommand() { 
        const text = document.getElementById('addCommandPreview')?.textContent;
        if (text && text !== 'tambah :') this.copyAndOpenTelegram(text);
    },
    
    copyEditCommand() { 
        const text = document.getElementById('editCommandPreview')?.textContent;
        if (text && text !== 'edit :') this.copyAndOpenTelegram(text);
    },
    
    copyDeleteCommand() { 
        const text = document.getElementById('deleteCommandPreview')?.textContent;
        if (text && text !== 'hapus ') this.copyAndOpenTelegram(text);
    },

    clearForm() {
        document.querySelectorAll('.n8n-input').forEach(input => input.value = '');
        this.updateAddPreview();
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
                            <small style="color: #888;">Dari URL: docs.google.com/spreadsheets/d/<b>SPREADSHEET_ID</b>/edit</small>
                        </div>
                        <div class="n8n-form-group">
                            <label>Sheet Name</label>
                            <input type="text" id="configSheetName" class="n8n-input" value="${this.config.sheetName}">
                        </div>
                        <div class="n8n-form-group">
                            <label>Bot Telegram Username</label>
                            <input type="text" id="configBotUsername" class="n8n-input" value="${this.config.botUsername}">
                        </div>
                        <div style="background: #e3f2fd; padding: 12px; border-radius: 8px; margin-top: 15px; font-size: 12px; color: #1565c0; line-height: 1.5;">
                            <strong>💡 Format Perintah (tanpa slash):</strong><br>
                            cari [nama] • tambah NAMA:NOMOR • edit NAMA:NOMOR_BARU • hapus NAMA
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
        const botUsername = document.getElementById('configBotUsername')?.value.trim();
        
        if (spreadsheetId) this.config.spreadsheetId = spreadsheetId;
        if (sheetName) this.config.sheetName = sheetName;
        if (botUsername) this.config.botUsername = botUsername;
        
        this.saveConfig();
        document.getElementById('n8nConfigModal')?.remove();
        
        app.showToast('🔄 Menyimpan & memuat data...');
        await this.refreshData();
    },

    escapeHtml(text) {
        if (!text) return '';
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
};

console.log('[N8N] Module loaded');

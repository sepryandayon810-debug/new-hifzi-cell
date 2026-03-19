/**
 * N8N Integration Module - Hifzi Cell POS
 * Menu Pencarian & Manajemen Data via Telegram Bot
 */

const n8nModule = {
    currentView: 'search', // search, add, edit, delete
    searchResults: [],
    selectedItem: null,
    isLoading: false,
    
    // Konfigurasi n8n (sesuaikan dengan webhook Anda)
    config: {
        webhookUrl: 'https://your-n8n-instance.com/webhook/telegram-trigger',
        botUsername: '@HifziCellBot'
    },

    init() {
        console.log('[N8N] Module initialized');
        this.loadConfig();
        this.renderPage();
    },

    loadConfig() {
        // Load dari localStorage jika ada custom config
        const savedConfig = localStorage.getItem('hifzi_n8n_config');
        if (savedConfig) {
            this.config = { ...this.config, ...JSON.parse(savedConfig) };
        }
    },

    saveConfig() {
        localStorage.setItem('hifzi_n8n_config', JSON.stringify(this.config));
    },

    renderPage() {
        const container = document.getElementById('mainContent');
        if (!container) return;

        const isKasirOpen = app.data?.kasir?.isOpen;
        const currentUser = dataManager.getCurrentUser();
        
        // Cek akses - hanya owner dan admin
        if (!currentUser || (currentUser.role !== 'owner' && currentUser.role !== 'admin')) {
            container.innerHTML = this.renderAccessDenied();
            return;
        }

        container.innerHTML = `
            <div class="content-section active">
                <!-- Header -->
                <div class="n8n-header">
                    <div class="n8n-title">
                        <span class="n8n-icon">🔍</span>
                        <div>
                            <h2>Pencarian Data</h2>
                            <p>Integrasi Telegram Bot • ${this.config.botUsername}</p>
                        </div>
                    </div>
                    <button class="n8n-config-btn" onclick="n8nModule.openConfigModal()">
                        ⚙️ Konfigurasi
                    </button>
                </div>

                <!-- Tab Navigation -->
                <div class="n8n-tabs">
                    <button class="n8n-tab ${this.currentView === 'search' ? 'active' : ''}" 
                            onclick="n8nModule.switchTab('search')">
                        <span>🔍</span> Cari
                    </button>
                    <button class="n8n-tab ${this.currentView === 'add' ? 'active' : ''}" 
                            onclick="n8nModule.switchTab('add')">
                        <span>➕</span> Tambah
                    </button>
                    <button class="n8n-tab ${this.currentView === 'edit' ? 'active' : ''}" 
                            onclick="n8nModule.switchTab('edit')">
                        <span>✏️</span> Edit
                    </button>
                    <button class="n8n-tab ${this.currentView === 'delete' ? 'active' : ''}" 
                            onclick="n8nModule.switchTab('delete')">
                        <span>🗑️</span> Hapus
                    </button>
                </div>

                <!-- Content Area -->
                <div class="n8n-content">
                    ${this.renderCurrentView()}
                </div>

                <!-- Info Card -->
                <div class="n8n-info-card">
                    <div class="n8n-info-icon">💡</div>
                    <div class="n8n-info-text">
                        <strong>Perintah Telegram:</strong><br>
                        <code>/cari [nama]</code> • 
                        <code>/tambah NAMA:NOMOR</code> • 
                        <code>/edit NAMA:NOMOR_BARU</code> • 
                        <code>/hapus NAMA</code>
                    </div>
                </div>
            </div>
        `;

        this.attachEventListeners();
    },

    renderAccessDenied() {
        return `
            <div class="content-section active" style="text-align: center; padding: 40px;">
                <div style="font-size: 48px; margin-bottom: 15px;">🚫</div>
                <h2 style="color: #c62828; margin-bottom: 15px;">Akses Ditolak</h2>
                <p style="color: #666; line-height: 1.6;">
                    Menu ini hanya dapat diakses oleh <strong>Owner</strong> dan <strong>Admin</strong>.
                </p>
            </div>
        `;
    },

    renderCurrentView() {
        switch(this.currentView) {
            case 'search':
                return this.renderSearchView();
            case 'add':
                return this.renderAddView();
            case 'edit':
                return this.renderEditView();
            case 'delete':
                return this.renderDeleteView();
            default:
                return this.renderSearchView();
        }
    },

    // ==================== VIEW: CARI ====================
    renderSearchView() {
        return `
            <div class="n8n-view">
                <div class="n8n-search-box">
                    <div class="n8n-input-group">
                        <span class="n8n-input-icon">🔍</span>
                        <input type="text" 
                               id="searchInput" 
                               class="n8n-input" 
                               placeholder="Ketik nama untuk mencari..."
                               autocomplete="off">
                        <button class="n8n-search-btn" onclick="n8nModule.performSearch()">
                            Cari
                        </button>
                    </div>
                    <p class="n8n-hint">Tekan Enter atau klik tombol Cari</p>
                </div>

                <div id="searchResults" class="n8n-results">
                    ${this.searchResults.length > 0 ? this.renderResultsList() : this.renderEmptyState()}
                </div>
            </div>
        `;
    },

    renderResultsList() {
        if (this.searchResults.length === 0) {
            return `
                <div class="n8n-empty">
                    <span>😕</span>
                    <p>Tidak ada hasil ditemukan</p>
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
                    <div class="n8n-result-item" onclick="n8nModule.selectResult(${index})">
                        <div class="n8n-result-icon">👤</div>
                        <div class="n8n-result-info">
                            <div class="n8n-result-name">${this.escapeHtml(item.NAMA || item.nama || '-')}</div>
                            <div class="n8n-result-number">📱 ${this.escapeHtml(item.NOMOR || item.nomor || '-')}</div>
                        </div>
                        <div class="n8n-result-actions">
                            <button class="n8n-action-btn edit" onclick="event.stopPropagation(); n8nModule.quickEdit('${this.escapeHtml(item.NAMA || item.nama)}')" title="Edit">
                                ✏️
                            </button>
                            <button class="n8n-action-btn delete" onclick="event.stopPropagation(); n8nModule.quickDelete('${this.escapeHtml(item.NAMA || item.nama)}')" title="Hapus">
                                🗑️
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    renderEmptyState() {
        return `
            <div class="n8n-empty">
                <span>🔍</span>
                <p>Masukkan kata kunci untuk mencari data</p>
                <div class="n8n-quick-actions">
                    <small> atau gunakan perintah Telegram:</small>
                    <code class="n8n-command" onclick="n8nModule.copyCommand('/cari ')">/cari [nama]</code>
                </div>
            </div>
        `;
    },

    // ==================== VIEW: TAMBAH ====================
    renderAddView() {
        return `
            <div class="n8n-view">
                <div class="n8n-form">
                    <div class="n8n-form-group">
                        <label>Nama Lengkap <span class="required">*</span></label>
                        <input type="text" 
                               id="addNama" 
                               class="n8n-input" 
                               placeholder="Contoh: AHMAD FAUZI"
                               oninput="this.value = this.value.toUpperCase()">
                    </div>
                    
                    <div class="n8n-form-group">
                        <label>Nomor Telepon <span class="required">*</span></label>
                        <input type="text" 
                               id="addNomor" 
                               class="n8n-input" 
                               placeholder="Contoh: 08123456789">
                    </div>

                    <div class="n8n-form-actions">
                        <button class="n8n-btn n8n-btn-secondary" onclick="n8nModule.clearForm()">
                            Bersihkan
                        </button>
                        <button class="n8n-btn n8n-btn-primary" onclick="n8nModule.submitAdd()">
                            <span>💾</span> Simpan Data
                        </button>
                    </div>
                </div>

                <div class="n8n-preview-card">
                    <div class="n8n-preview-title">📤 Perintah Telegram yang akan dikirim:</div>
                    <code id="addCommandPreview" class="n8n-command-preview">/tambah :</code>
                    <button class="n8n-copy-btn" onclick="n8nModule.copyAddCommand()">
                        📋 Salin Perintah
                    </button>
                </div>
            </div>
        `;
    },

    // ==================== VIEW: EDIT ====================
    renderEditView() {
        return `
            <div class="n8n-view">
                <div class="n8n-form">
                    <div class="n8n-form-group">
                        <label>Nama yang akan diubah <span class="required">*</span></label>
                        <div class="n8n-input-with-search">
                            <input type="text" 
                                   id="editNamaLama" 
                                   class="n8n-input" 
                                   placeholder="Cari nama..."
                                   oninput="n8nModule.searchForEdit(this.value)">
                            <button class="n8n-search-inline" onclick="n8nModule.searchForEdit(document.getElementById('editNamaLama').value)">
                                🔍
                            </button>
                        </div>
                        <div id="editSearchResults" class="n8n-dropdown-results"></div>
                    </div>
                    
                    <div class="n8n-form-group">
                        <label>Nomor Baru <span class="required">*</span></label>
                        <input type="text" 
                               id="editNomorBaru" 
                               class="n8n-input" 
                               placeholder="Contoh: 08987654321">
                    </div>

                    <div class="n8n-form-actions">
                        <button class="n8n-btn n8n-btn-primary" onclick="n8nModule.submitEdit()">
                            <span>💾</span> Update Data
                        </button>
                    </div>
                </div>

                <div class="n8n-preview-card">
                    <div class="n8n-preview-title">📤 Perintah Telegram yang akan dikirim:</div>
                    <code id="editCommandPreview" class="n8n-command-preview">/edit :</code>
                    <button class="n8n-copy-btn" onclick="n8nModule.copyEditCommand()">
                        📋 Salin Perintah
                    </button>
                </div>
            </div>
        `;
    },

    // ==================== VIEW: HAPUS ====================
    renderDeleteView() {
        return `
            <div class="n8n-view">
                <div class="n8n-form">
                    <div class="n8n-form-group">
                        <label>Nama yang akan dihapus <span class="required">*</span></label>
                        <div class="n8n-input-with-search">
                            <input type="text" 
                                   id="deleteNama" 
                                   class="n8n-input" 
                                   placeholder="Cari nama untuk dihapus..."
                                   oninput="n8nModule.searchForDelete(this.value)">
                            <button class="n8n-search-inline" onclick="n8nModule.searchForDelete(document.getElementById('deleteNama').value)">
                                🔍
                            </button>
                        </div>
                        <div id="deleteSearchResults" class="n8n-dropdown-results"></div>
                    </div>

                    <div class="n8n-alert n8n-alert-danger">
                        <span>⚠️</span>
                        <div>
                            <strong>Perhatian!</strong><br>
                            Data yang dihapus tidak dapat dikembalikan. Pastikan nama sudah benar.
                        </div>
                    </div>

                    <div class="n8n-form-actions">
                        <button class="n8n-btn n8n-btn-danger" onclick="n8nModule.submitDelete()">
                            <span>🗑️</span> Hapus Permanen
                        </button>
                    </div>
                </div>

                <div class="n8n-preview-card">
                    <div class="n8n-preview-title">📤 Perintah Telegram yang akan dikirim:</div>
                    <code id="deleteCommandPreview" class="n8n-command-preview">/hapus </code>
                    <button class="n8n-copy-btn" onclick="n8nModule.copyDeleteCommand()">
                        📋 Salin Perintah
                    </button>
                </div>
            </div>
        `;
    },

    // ==================== ACTIONS ====================
    
    switchTab(view) {
        this.currentView = view;
        this.renderPage();
    },

    attachEventListeners() {
        // Search input enter key
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.performSearch();
            });
            searchInput.focus();
        }

        // Add form inputs
        const addNama = document.getElementById('addNama');
        const addNomor = document.getElementById('addNomor');
        if (addNama && addNomor) {
            const updatePreview = () => {
                const nama = addNama.value.toUpperCase().trim();
                const nomor = addNomor.value.trim();
                const preview = document.getElementById('addCommandPreview');
                if (preview) {
                    preview.textContent = nama || nomor ? `/tambah ${nama}:${nomor}` : '/tambah :';
                }
            };
            addNama.addEventListener('input', updatePreview);
            addNomor.addEventListener('input', updatePreview);
        }

        // Edit form inputs
        const editNamaLama = document.getElementById('editNamaLama');
        const editNomorBaru = document.getElementById('editNomorBaru');
        if (editNamaLama && editNomorBaru) {
            const updatePreview = () => {
                const nama = editNamaLama.value.toUpperCase().trim();
                const nomor = editNomorBaru.value.trim();
                const preview = document.getElementById('editCommandPreview');
                if (preview) {
                    preview.textContent = nama || nomor ? `/edit ${nama}:${nomor}` : '/edit :';
                }
            };
            editNamaLama.addEventListener('input', updatePreview);
            editNomorBaru.addEventListener('input', updatePreview);
        }

        // Delete form input
        const deleteNama = document.getElementById('deleteNama');
        if (deleteNama) {
            const updatePreview = () => {
                const nama = deleteNama.value.toUpperCase().trim();
                const preview = document.getElementById('deleteCommandPreview');
                if (preview) {
                    preview.textContent = nama ? `/hapus ${nama}` : '/hapus ';
                }
            };
            deleteNama.addEventListener('input', updatePreview);
        }
    },

    // ==================== SEARCH FUNCTIONS ====================
    
    async performSearch() {
        const input = document.getElementById('searchInput');
        const keyword = input?.value.trim();
        
        if (!keyword) {
            app.showToast('❌ Masukkan kata kunci pencarian!');
            return;
        }

        this.isLoading = true;
        this.renderLoading();

        try {
            // Simulasi pencarian - di production, ini akan hit n8n webhook atau Google Sheets API
            // Untuk sekarang, kita simulasi dengan data dummy atau local data
            
            // TODO: Implement actual API call to n8n or Google Sheets
            // const response = await fetch(`${this.config.webhookUrl}/search?keyword=${encodeURIComponent(keyword)}`);
            // const data = await response.json();
            
            // Simulasi hasil pencarian (remove this in production)
            await new Promise(resolve => setTimeout(resolve, 800));
            
            // Simulasi data - di production ambil dari Google Sheets via n8n
            this.searchResults = this.simulateSearchResults(keyword);
            
            this.isLoading = false;
            this.renderResults();
            
        } catch (error) {
            console.error('[N8N] Search error:', error);
            this.isLoading = false;
            app.showToast('❌ Gagal melakukan pencarian!');
        }
    },

    simulateSearchResults(keyword) {
        // Simulasi data untuk demo - ganti dengan actual API call
        const dummyData = [
            { NAMA: 'AHMAD FAUZI', NOMOR: '08123456789' },
            { NAMA: 'BUDI SANTOSO', NOMOR: '08234567890' },
            { NAMA: 'CITRA LESTARI', NOMOR: '08345678901' },
            { NAMA: 'DEDI KURNIAWAN', NOMOR: '08456789012' },
            { NAMA: 'ERIKA PUTRI', NOMOR: '08567890123' },
        ];
        
        const lowerKeyword = keyword.toLowerCase();
        return dummyData.filter(item => 
            item.NAMA.toLowerCase().includes(lowerKeyword) ||
            item.NOMOR.includes(keyword)
        );
    },

    renderLoading() {
        const resultsDiv = document.getElementById('searchResults');
        if (resultsDiv) {
            resultsDiv.innerHTML = `
                <div class="n8n-loading">
                    <div class="n8n-spinner"></div>
                    <p>Mencari data...</p>
                </div>
            `;
        }
    },

    renderResults() {
        const resultsDiv = document.getElementById('searchResults');
        if (resultsDiv) {
            resultsDiv.innerHTML = this.renderResultsList();
        }
    },

    clearResults() {
        this.searchResults = [];
        this.renderPage();
    },

    selectResult(index) {
        const item = this.searchResults[index];
        if (!item) return;
        
        this.selectedItem = item;
        
        // Show detail modal
        const modalHTML = `
            <div class="modal active" id="resultDetailModal" style="display: flex; z-index: 3500; align-items: flex-start; padding-top: 100px;">
                <div class="modal-content" style="max-width: 350px;">
                    <div class="modal-header">
                        <span class="modal-title">👤 Detail Data</span>
                        <button onclick="document.getElementById('resultDetailModal').remove()" style="background: none; border: none; font-size: 20px; cursor: pointer;">×</button>
                    </div>
                    
                    <div style="padding: 20px; text-align: center;">
                        <div style="font-size: 48px; margin-bottom: 10px;">👤</div>
                        <h3 style="margin: 0 0 5px 0; color: #333;">${this.escapeHtml(item.NAMA || item.nama)}</h3>
                        <p style="color: #666; font-size: 14px; margin: 0;">📱 ${this.escapeHtml(item.NOMOR || item.nomor)}</p>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 0 20px 20px;">
                        <button class="btn btn-secondary" onclick="n8nModule.quickEdit('${this.escapeHtml(item.NAMA || item.nama)}')">
                            ✏️ Edit
                        </button>
                        <button class="btn btn-danger" onclick="n8nModule.quickDelete('${this.escapeHtml(item.NAMA || item.nama)}')">
                            🗑️ Hapus
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    // ==================== CRUD OPERATIONS ====================
    
    submitAdd() {
        const nama = document.getElementById('addNama')?.value.trim().toUpperCase();
        const nomor = document.getElementById('addNomor')?.value.trim();

        if (!nama || !nomor) {
            app.showToast('❌ Nama dan nomor wajib diisi!');
            return;
        }

        const command = `/tambah ${nama}:${nomor}`;
        
        // Send to n8n webhook atau copy ke clipboard
        this.sendToTelegram(command);
        
        app.showToast('✅ Perintah tambah dikirim ke Telegram Bot!');
        this.clearForm();
    },

    submitEdit() {
        const nama = document.getElementById('editNamaLama')?.value.trim().toUpperCase();
        const nomor = document.getElementById('editNomorBaru')?.value.trim();

        if (!nama || !nomor) {
            app.showToast('❌ Nama lama dan nomor baru wajib diisi!');
            return;
        }

        const command = `/edit ${nama}:${nomor}`;
        this.sendToTelegram(command);
        
        app.showToast('✅ Perintah edit dikirim ke Telegram Bot!');
    },

    submitDelete() {
        const nama = document.getElementById('deleteNama')?.value.trim().toUpperCase();

        if (!nama) {
            app.showToast('❌ Nama wajib diisi!');
            return;
        }

        if (!confirm(`⚠️ Yakin ingin menghapus data "${nama}"?\n\nData akan dihapus permanen dari database.`)) {
            return;
        }

        const command = `/hapus ${nama}`;
        this.sendToTelegram(command);
        
        app.showToast('✅ Perintah hapus dikirim ke Telegram Bot!');
    },

    // Quick actions dari hasil pencarian
    quickEdit(nama) {
        // Tutup modal detail jika ada
        const detailModal = document.getElementById('resultDetailModal');
        if (detailModal) detailModal.remove();
        
        // Switch ke tab edit dan isi nama
        this.switchTab('edit');
        
        // Isi nama lama setelah render
        setTimeout(() => {
            const input = document.getElementById('editNamaLama');
            if (input) {
                input.value = nama;
                input.dispatchEvent(new Event('input'));
                input.focus();
            }
        }, 100);
    },

    quickDelete(nama) {
        const detailModal = document.getElementById('resultDetailModal');
        if (detailModal) detailModal.remove();
        
        this.switchTab('delete');
        
        setTimeout(() => {
            const input = document.getElementById('deleteNama');
            if (input) {
                input.value = nama;
                input.dispatchEvent(new Event('input'));
            }
        }, 100);
    },

    // ==================== HELPER FUNCTIONS ====================
    
    sendToTelegram(command) {
        // Method 1: Copy ke clipboard untuk user paste ke Telegram
        this.copyToClipboard(command);
        
        // Method 2: Jika ada integration langsung (optional)
        // window.open(`https://t.me/${this.config.botUsername.replace('@', '')}?start=${encodeURIComponent(command)}`);
        
        console.log('[N8N] Command prepared:', command);
    },

    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            app.showToast('📋 Perintah disalin ke clipboard!');
        }).catch(() => {
            // Fallback
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            app.showToast('📋 Perintah disalin!');
        });
    },

    copyCommand(cmd) {
        this.copyToClipboard(cmd);
    },

    copyAddCommand() {
        const preview = document.getElementById('addCommandPreview');
        if (preview) this.copyToClipboard(preview.textContent);
    },

    copyEditCommand() {
        const preview = document.getElementById('editCommandPreview');
        if (preview) this.copyToClipboard(preview.textContent);
    },

    copyDeleteCommand() {
        const preview = document.getElementById('deleteCommandPreview');
        if (preview) this.copyToClipboard(preview.textContent);
    },

    clearForm() {
        const inputs = document.querySelectorAll('.n8n-input');
        inputs.forEach(input => input.value = '');
        
        // Reset previews
        const addPreview = document.getElementById('addCommandPreview');
        if (addPreview) addPreview.textContent = '/tambah :';
    },

    searchForEdit(keyword) {
        // Implementasi live search untuk dropdown edit
        if (keyword.length < 2) {
            document.getElementById('editSearchResults').innerHTML = '';
            return;
        }
        
        // Simulasi - ganti dengan actual API
        const results = this.simulateSearchResults(keyword);
        const dropdown = document.getElementById('editSearchResults');
        
        if (results.length === 0) {
            dropdown.innerHTML = '<div class="n8n-dropdown-empty">Tidak ditemukan</div>';
            return;
        }
        
        dropdown.innerHTML = results.map(r => `
            <div class="n8n-dropdown-item" onclick="n8nModule.selectEditName('${this.escapeHtml(r.NAMA)}')">
                <strong>${this.escapeHtml(r.NAMA)}</strong>
                <small>${this.escapeHtml(r.NOMOR)}</small>
            </div>
        `).join('');
    },

    searchForDelete(keyword) {
        // Sama seperti searchForEdit
        if (keyword.length < 2) {
            document.getElementById('deleteSearchResults').innerHTML = '';
            return;
        }
        
        const results = this.simulateSearchResults(keyword);
        const dropdown = document.getElementById('deleteSearchResults');
        
        if (results.length === 0) {
            dropdown.innerHTML = '<div class="n8n-dropdown-empty">Tidak ditemukan</div>';
            return;
        }
        
        dropdown.innerHTML = results.map(r => `
            <div class="n8n-dropdown-item" onclick="n8nModule.selectDeleteName('${this.escapeHtml(r.NAMA)}')">
                <strong>${this.escapeHtml(r.NAMA)}</strong>
                <small>${this.escapeHtml(r.NOMOR)}</small>
            </div>
        `).join('');
    },

    selectEditName(nama) {
        document.getElementById('editNamaLama').value = nama;
        document.getElementById('editSearchResults').innerHTML = '';
        document.getElementById('editNamaLama').dispatchEvent(new Event('input'));
    },

    selectDeleteName(nama) {
        document.getElementById('deleteNama').value = nama;
        document.getElementById('deleteSearchResults').innerHTML = '';
        document.getElementById('deleteNama').dispatchEvent(new Event('input'));
    },

    openConfigModal() {
        const modalHTML = `
            <div class="modal active" id="n8nConfigModal" style="display: flex; z-index: 4000; align-items: flex-start; padding-top: 80px;">
                <div class="modal-content" style="max-width: 400px;">
                    <div class="modal-header">
                        <span class="modal-title">⚙️ Konfigurasi n8n</span>
                        <button onclick="document.getElementById('n8nConfigModal').remove()" style="background: none; border: none; font-size: 20px; cursor: pointer;">×</button>
                    </div>
                    
                    <div style="padding: 20px;">
                        <div class="n8n-form-group">
                            <label>Webhook URL</label>
                            <input type="text" id="configWebhookUrl" class="n8n-input" 
                                   value="${this.config.webhookUrl}" placeholder="https://...">
                        </div>
                        
                        <div class="n8n-form-group">
                            <label>Bot Username</label>
                            <input type="text" id="configBotUsername" class="n8n-input" 
                                   value="${this.config.botUsername}" placeholder="@YourBot">
                        </div>
                        
                        <div style="background: #e3f2fd; padding: 12px; border-radius: 8px; margin-top: 15px; font-size: 12px; color: #1565c0;">
                            <strong>💡 Tips:</strong><br>
                            Pastikan webhook n8n sudah aktif dan terhubung dengan Google Sheets.
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 10px; justify-content: flex-end; padding: 0 20px 20px;">
                        <button class="btn btn-secondary" onclick="document.getElementById('n8nConfigModal').remove()">Batal</button>
                        <button class="btn btn-primary" onclick="n8nModule.saveConfigFromModal()">Simpan</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    saveConfigFromModal() {
        const webhookUrl = document.getElementById('configWebhookUrl')?.value.trim();
        const botUsername = document.getElementById('configBotUsername')?.value.trim();
        
        if (webhookUrl) this.config.webhookUrl = webhookUrl;
        if (botUsername) this.config.botUsername = botUsername;
        
        this.saveConfig();
        document.getElementById('n8nConfigModal').remove();
        app.showToast('✅ Konfigurasi disimpan!');
        this.renderPage();
    },

    escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
};

console.log('[N8N] Module loaded');

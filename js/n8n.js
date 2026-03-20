/**
 * N8N Data Management Module
 * Integrated with Google Sheets via GAS Web App
 * Compatible with Telegram Bot notifications
 * 
 * NAMA MODULE: n8nModule (huruf kecil semua - sesuai router.js)
 */

(function() {
    'use strict';

    const n8nModule = {
        // Configuration
        config: {
            sheetId: '',
            sheetName: 'Data Base Hifzi Cell',
            gasUrl: '',
            botToken: '',
            chatId: ''
        },

        // Data storage
        data: [],
        filteredData: [],

        // DOM Elements cache
        elements: {},

        /**
         * Initialize module
         */
        init() {
            this.loadConfig();
            console.log('[n8nModule] Module initialized - huruf kecil semua');
        },

        /**
         * Load configuration from localStorage
         */
        loadConfig() {
            const saved = localStorage.getItem('n8n_config');
            if (saved) {
                this.config = { ...this.config, ...JSON.parse(saved) };
            }
        },

        /**
         * Save configuration to localStorage
         */
        saveConfig() {
            localStorage.setItem('n8n_config', JSON.stringify(this.config));
        },

        /**
         * Render main page
         */
        renderPage() {
            const mainContent = document.getElementById('mainContent');
            if (!mainContent) return;

            mainContent.innerHTML = this.getHTML();
            this.cacheElements();
            this.bindEvents();
            this.loadData();
        },

        /**
         * Get HTML template
         */
        getHTML() {
            return `
                <div class="n8n-container">
                    <div class="n8n-header">
                        <h2>🔍 Manajemen Data n8n</h2>
                        <p>Cari, tambah, edit, dan hapus data di Google Sheets</p>
                    </div>

                    <!-- Configuration Section -->
                    <div class="n8n-section n8n-config">
                        <h3>⚙️ Konfigurasi Google Sheets</h3>
                        <div class="n8n-form-row">
                            <div class="n8n-form-group">
                                <label>Sheet ID</label>
                                <input type="text" id="n8nSheetId" placeholder="1cPolj_xpBztq6RU3XVi_CZm1j_Kqo-zQC-wsbIYrLXE" value="${this.config.sheetId}">
                            </div>
                            <div class="n8n-form-group">
                                <label>Sheet Name</label>
                                <input type="text" id="n8nSheetName" placeholder="Data Base Hifzi Cell" value="${this.config.sheetName}">
                            </div>
                        </div>
                        <div class="n8n-form-group">
                            <label>GAS Web App URL</label>
                            <input type="text" id="n8nGasUrl" placeholder="https://script.google.com/macros/s/.../exec" value="${this.config.gasUrl}">
                        </div>
                        <button class="n8n-btn n8n-btn-primary" onclick="n8nModule.saveSheetConfig()">💾 Simpan Config</button>
                    </div>

                    <!-- Telegram Config Section -->
                    <div class="n8n-section n8n-telegram-config">
                        <h3>✈️ Konfigurasi Telegram Bot (Opsional)</h3>
                        <div class="n8n-form-row">
                            <div class="n8n-form-group">
                                <label>Bot Token</label>
                                <input type="password" id="n8nBotToken" placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz" value="${this.config.botToken}">
                            </div>
                            <div class="n8n-form-group">
                                <label>Chat ID</label>
                                <input type="text" id="n8nChatId" placeholder="123456789 atau -1001234567890" value="${this.config.chatId}">
                            </div>
                        </div>
                        <div class="n8n-btn-group">
                            <button class="n8n-btn n8n-btn-secondary" onclick="n8nModule.saveTelegramConfig()">💾 Simpan Telegram</button>
                            <button class="n8n-btn n8n-btn-test" onclick="n8nModule.testBotConnection()">🔌 Test Bot</button>
                        </div>
                    </div>

                    <!-- Action Buttons -->
                    <div class="n8n-section n8n-actions">
                        <h3>🚀 Aksi</h3>
                        <div class="n8n-btn-group">
                            <button class="n8n-btn n8n-btn-success" onclick="n8nModule.showAddModal()">➕ Tambah Data</button>
                            <button class="n8n-btn n8n-btn-warning" onclick="n8nModule.showEditModal()">✏️ Edit Data</button>
                            <button class="n8n-btn n8n-btn-danger" onclick="n8nModule.showDeleteModal()">🗑️ Hapus Data</button>
                            <button class="n8n-btn n8n-btn-info" onclick="n8nModule.refreshData()">🔄 Refresh</button>
                        </div>
                    </div>

                    <!-- Search Section -->
                    <div class="n8n-section n8n-search">
                        <h3>🔍 Pencarian Data</h3>
                        <div class="n8n-search-box">
                            <input type="text" id="n8nSearchInput" placeholder="Ketik nama untuk mencari..." oninput="n8nModule.handleSearch()">
                            <button class="n8n-btn n8n-btn-primary" onclick="n8nModule.handleSearch()">Cari</button>
                        </div>
                        <div id="n8nSearchResults" class="n8n-results"></div>
                    </div>

                    <!-- Data Table -->
                    <div class="n8n-section n8n-data">
                        <h3>📊 Semua Data (${this.data.length} records)</h3>
                        <div id="n8nDataTable" class="n8n-table-container">
                            <p class="n8n-empty">Klik "Refresh" untuk memuat data</p>
                        </div>
                    </div>

                    <!-- Status -->
                    <div id="n8nStatus" class="n8n-status"></div>
                </div>

                <!-- Modal Template -->
                <div id="n8nModal" class="n8n-modal">
                    <div class="n8n-modal-content">
                        <span class="n8n-modal-close" onclick="n8nModule.closeModal()">&times;</span>
                        <h3 id="n8nModalTitle">Modal Title</h3>
                        <div id="n8nModalBody"></div>
                    </div>
                </div>
            `;
        },

        /**
         * Cache DOM elements
         */
        cacheElements() {
            this.elements = {
                sheetId: document.getElementById('n8nSheetId'),
                sheetName: document.getElementById('n8nSheetName'),
                gasUrl: document.getElementById('n8nGasUrl'),
                botToken: document.getElementById('n8nBotToken'),
                chatId: document.getElementById('n8nChatId'),
                searchInput: document.getElementById('n8nSearchInput'),
                searchResults: document.getElementById('n8nSearchResults'),
                dataTable: document.getElementById('n8nDataTable'),
                status: document.getElementById('n8nStatus'),
                modal: document.getElementById('n8nModal'),
                modalTitle: document.getElementById('n8nModalTitle'),
                modalBody: document.getElementById('n8nModalBody')
            };
        },

        /**
         * Bind events
         */
        bindEvents() {
            if (this.elements.searchInput) {
                this.elements.searchInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') this.handleSearch();
                });
            }
        },

        /**
         * Save Sheet configuration
         */
        saveSheetConfig() {
            this.config.sheetId = this.elements.sheetId.value.trim();
            this.config.sheetName = this.elements.sheetName.value.trim();
            this.config.gasUrl = this.elements.gasUrl.value.trim();
            this.saveConfig();
            this.showStatus('✅ Konfigurasi Sheets disimpan!', 'success');
        },

        /**
         * Save Telegram configuration
         */
        saveTelegramConfig() {
            this.config.botToken = this.elements.botToken.value.trim();
            this.config.chatId = this.elements.chatId.value.trim();
            this.saveConfig();
            this.showStatus('✅ Konfigurasi Telegram disimpan!', 'success');
        },

        /**
         * Test bot connection
         */
        async testBotConnection() {
            if (!this.config.botToken || !this.config.chatId) {
                this.showStatus('❌ Isi bot token dan chat ID dulu!', 'error');
                return;
            }

            this.showStatus('🔄 Testing koneksi...', 'info');

            try {
                const response = await fetch(`https://api.telegram.org/bot${this.config.botToken}/getMe`);
                const data = await response.json();

                if (data.ok) {
                    await this.sendTelegramMessage('🔌 *Test Koneksi*\n\nKoneksi Web POS ke Telegram berhasil! ✅\n\n_Bot: ' + data.result.username + '_');
                    this.showStatus('✅ Koneksi berhasil! Cek Telegram Anda.', 'success');
                } else {
                    this.showStatus('❌ Bot token invalid!', 'error');
                }
            } catch (error) {
                this.showStatus('❌ Error: ' + error.message, 'error');
            }
        },

        /**
         * Send message to Telegram
         */
        async sendTelegramMessage(message) {
            if (!this.config.botToken || !this.config.chatId) return false;

            try {
                const response = await fetch(`https://api.telegram.org/bot${this.config.botToken}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: this.config.chatId,
                        text: message,
                        parse_mode: 'Markdown'
                    })
                });
                return response.ok;
            } catch (error) {
                console.error('[n8nModule] Telegram error:', error);
                return false;
            }
        },

        /**
         * Load data from Google Sheets
         */
        async loadData() {
            if (!this.config.gasUrl) {
                this.showStatus('⚠️ Isi GAS URL terlebih dahulu!', 'warning');
                return;
            }

            this.showStatus('🔄 Memuat data...', 'info');

            try {
                const url = `${this.config.gasUrl}?action=getData&sheetId=${encodeURIComponent(this.config.sheetId)}&sheetName=${encodeURIComponent(this.config.sheetName)}`;
                const response = await fetch(url);
                const result = await response.json();

                if (result.success) {
                    this.data = result.data || [];
                    this.renderTable();
                    this.showStatus(`✅ Data dimuat: ${this.data.length} records`, 'success');
                } else {
                    throw new Error(result.message || 'Gagal memuat data');
                }
            } catch (error) {
                this.showStatus('❌ Error: ' + error.message, 'error');
                console.error('[n8nModule] Load error:', error);
            }
        },

        /**
         * Refresh data
         */
        refreshData() {
            this.loadData();
        },

        /**
         * Render data table
         */
        renderTable() {
            if (!this.elements.dataTable) return;

            if (this.data.length === 0) {
                this.elements.dataTable.innerHTML = '<p class="n8n-empty">Tidak ada data</p>';
                return;
            }

            let html = `
                <table class="n8n-table">
                    <thead>
                        <tr>
                            <th>No</th>
                            <th>NAMA</th>
                            <th>NOMOR</th>
                            <th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            this.data.forEach((row, index) => {
                html += `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${row.NAMA || '-'}</td>
                        <td>${row.NOMOR || '-'}</td>
                        <td>
                            <button class="n8n-btn-small n8n-btn-edit" onclick="n8nModule.editRow('${row.NAMA}')">✏️</button>
                            <button class="n8n-btn-small n8n-btn-delete" onclick="n8nModule.deleteRow('${row.NAMA}')">🗑️</button>
                        </td>
                    </tr>
                `;
            });

            html += '</tbody></table>';
            this.elements.dataTable.innerHTML = html;
        },

        /**
         * Handle search
         */
        handleSearch() {
            const query = this.elements.searchInput.value.trim().toUpperCase();
            if (!query) {
                this.elements.searchResults.innerHTML = '';
                return;
            }

            const results = this.data.filter(row => 
                (row.NAMA && row.NAMA.toUpperCase().includes(query)) ||
                (row.NOMOR && row.NOMOR.includes(query))
            );

            if (results.length === 0) {
                this.elements.searchResults.innerHTML = '<p class="n8n-no-result">Tidak ditemukan</p>';
            } else {
                let html = `<p class="n8n-result-count">Ditemukan ${results.length} data:</p>`;
                html += '<div class="n8n-result-list">';
                results.forEach(row => {
                    html += `
                        <div class="n8n-result-item">
                            <strong>${row.NAMA}</strong>
                            <span>${row.NOMOR}</span>
                            <button class="n8n-btn-small" onclick="n8nModule.editRow('${row.NAMA}')">Edit</button>
                        </div>
                    `;
                });
                html += '</div>';
                this.elements.searchResults.innerHTML = html;
            }
        },

        /**
         * Show add modal
         */
        showAddModal() {
            this.elements.modalTitle.textContent = '➕ Tambah Data Baru';
            this.elements.modalBody.innerHTML = `
                <div class="n8n-form-group">
                    <label>Format: NAMA:NOMOR</label>
                    <input type="text" id="n8nAddInput" placeholder="BUDI:08123456789">
                    <small>Atau isi terpisah:</small>
                </div>
                <div class="n8n-form-row">
                    <div class="n8n-form-group">
                        <label>NAMA</label>
                        <input type="text" id="n8nAddNama" placeholder="BUDI">
                    </div>
                    <div class="n8n-form-group">
                        <label>NOMOR</label>
                        <input type="text" id="n8nAddNomor" placeholder="08123456789">
                    </div>
                </div>
                <button class="n8n-btn n8n-btn-success" onclick="n8nModule.addData()">Simpan</button>
            `;
            this.elements.modal.style.display = 'block';
        },

        /**
         * Add data
         */
        async addData() {
            let nama = document.getElementById('n8nAddNama').value.trim().toUpperCase();
            let nomor = document.getElementById('n8nAddNomor').value.trim();
            const formatInput = document.getElementById('n8nAddInput').value.trim();

            if (formatInput && formatInput.includes(':')) {
                const parts = formatInput.split(':');
                nama = parts[0].trim().toUpperCase();
                nomor = parts[1].trim();
            }

            if (!nama || !nomor) {
                alert('Nama dan nomor harus diisi!');
                return;
            }

            const exists = this.data.find(row => row.NAMA === nama);
            if (exists) {
                alert('Nama sudah ada! Gunakan edit untuk mengubah.');
                return;
            }

            this.showStatus('🔄 Menyimpan...', 'info');

            try {
                const url = `${this.config.gasUrl}?action=addData&sheetId=${encodeURIComponent(this.config.sheetId)}&sheetName=${encodeURIComponent(this.config.sheetName)}&nama=${encodeURIComponent(nama)}&nomor=${encodeURIComponent(nomor)}`;
                const response = await fetch(url);
                const result = await response.json();

                if (result.success) {
                    await this.sendTelegramMessage(`✅ *DATA BARU DITAMBAH*\n\nNama: ${nama}\nNomor: ${nomor}\n\n_Oleh: Web POS_`);
                    this.showStatus('✅ Data berhasil ditambah!', 'success');
                    this.closeModal();
                    this.loadData();
                } else {
                    throw new Error(result.message);
                }
            } catch (error) {
                this.showStatus('❌ Error: ' + error.message, 'error');
            }
        },

        /**
         * Show edit modal
         */
        showEditModal() {
            this.elements.modalTitle.textContent = '✏️ Edit Data';
            this.elements.modalBody.innerHTML = `
                <div class="n8n-form-group">
                    <label>NAMA (exact match)</label>
                    <input type="text" id="n8nEditNama" placeholder="BUDI">
                </div>
                <div class="n8n-form-group">
                    <label>NOMOR BARU</label>
                    <input type="text" id="n8nEditNomor" placeholder="08987654321">
                </div>
                <button class="n8n-btn n8n-btn-warning" onclick="n8nModule.editData()">Update</button>
            `;
            this.elements.modal.style.display = 'block';
        },

        /**
         * Edit row directly
         */
        editRow(nama) {
            const row = this.data.find(r => r.NAMA === nama);
            if (!row) return;

            this.elements.modalTitle.textContent = '✏️ Edit Data';
            this.elements.modalBody.innerHTML = `
                <div class="n8n-form-group">
                    <label>NAMA</label>
                    <input type="text" id="n8nEditNama" value="${row.NAMA}" readonly>
                </div>
                <div class="n8n-form-group">
                    <label>NOMOR BARU</label>
                    <input type="text" id="n8nEditNomor" value="${row.NOMOR}">
                </div>
                <button class="n8n-btn n8n-btn-warning" onclick="n8nModule.editData()">Update</button>
            `;
            this.elements.modal.style.display = 'block';
        },

        /**
         * Edit data
         */
        async editData() {
            const nama = document.getElementById('n8nEditNama').value.trim().toUpperCase();
            const nomor = document.getElementById('n8nEditNomor').value.trim();

            if (!nama || !nomor) {
                alert('Nama dan nomor harus diisi!');
                return;
            }

            this.showStatus('🔄 Mengupdate...', 'info');

            try {
                const url = `${this.config.gasUrl}?action=editData&sheetId=${encodeURIComponent(this.config.sheetId)}&sheetName=${encodeURIComponent(this.config.sheetName)}&nama=${encodeURIComponent(nama)}&nomor=${encodeURIComponent(nomor)}`;
                const response = await fetch(url);
                const result = await response.json();

                if (result.success) {
                    await this.sendTelegramMessage(`✏️ *DATA DIUPDATE*\n\nNama: ${nama}\nNomor Baru: ${nomor}\n\n_Oleh: Web POS_`);
                    this.showStatus('✅ Data berhasil diupdate!', 'success');
                    this.closeModal();
                    this.loadData();
                } else {
                    throw new Error(result.message);
                }
            } catch (error) {
                this.showStatus('❌ Error: ' + error.message, 'error');
            }
        },

        /**
         * Show delete modal
         */
        showDeleteModal() {
            this.elements.modalTitle.textContent = '🗑️ Hapus Data';
            this.elements.modalBody.innerHTML = `
                <div class="n8n-form-group">
                    <label>NAMA yang akan dihapus (exact match)</label>
                    <input type="text" id="n8nDeleteNama" placeholder="BUDI">
                </div>
                <p class="n8n-warning">⚠️ Data akan dihapus permanen!</p>
                <button class="n8n-btn n8n-btn-danger" onclick="n8nModule.deleteData()">Hapus Permanen</button>
            `;
            this.elements.modal.style.display = 'block';
        },

        /**
         * Delete row directly
         */
        deleteRow(nama) {
            if (!confirm(`Yakin hapus data ${nama}?`)) return;
            const input = document.getElementById('n8nDeleteNama');
            if (input) input.value = nama;
            this.deleteData();
        },

        /**
         * Delete data
         */
        async deleteData() {
            const namaInput = document.getElementById('n8nDeleteNama');
            const nama = namaInput ? namaInput.value.trim().toUpperCase() : '';

            if (!nama) {
                alert('Nama harus diisi!');
                return;
            }

            if (!confirm(`Yakin hapus data ${nama}?`)) return;

            this.showStatus('🔄 Menghapus...', 'info');

            try {
                const url = `${this.config.gasUrl}?action=deleteData&sheetId=${encodeURIComponent(this.config.sheetId)}&sheetName=${encodeURIComponent(this.config.sheetName)}&nama=${encodeURIComponent(nama)}`;
                const response = await fetch(url);
                const result = await response.json();

                if (result.success) {
                    await this.sendTelegramMessage(`🗑️ *DATA DIHAPUS*\n\nNama: ${nama}\n\n_Oleh: Web POS_`);
                    this.showStatus('✅ Data berhasil dihapus!', 'success');
                    this.closeModal();
                    this.loadData();
                } else {
                    throw new Error(result.message);
                }
            } catch (error) {
                this.showStatus('❌ Error: ' + error.message, 'error');
            }
        },

        /**
         * Close modal
         */
        closeModal() {
            if (this.elements.modal) {
                this.elements.modal.style.display = 'none';
            }
        },

        /**
         * Show status message
         */
        showStatus(message, type = 'info') {
            if (!this.elements.status) return;
            this.elements.status.textContent = message;
            this.elements.status.className = `n8n-status n8n-status-${type}`;
            setTimeout(() => {
                this.elements.status.textContent = '';
            }, 5000);
        }
    };

    // EXPOSE KE GLOBAL SCOPE - HURUF KECIL SEMUA
    window.n8nModule = n8nModule;

    // Auto-initialize jika DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => n8nModule.init());
    } else {
        n8nModule.init();
    }

    console.log('[n8nModule] ✅ Module loaded dengan nama HURUF KECIL SEMUA');
})();

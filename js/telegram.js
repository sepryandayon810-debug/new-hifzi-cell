/**
 * Telegram Module - Hifzi Cell POS (n8n Compatible)
 * Struktur sheet sama persis dengan n8n workflow
 */

console.log('[Telegram] Module loaded - n8n compatible');

const TelegramModule = {
    // State
    topups: [],
    currentFilter: 'all',
    currentTimeFilter: 'month',
    isInitialized: false,
    transaksiAktif: null,
    
    // Config
    config: {
        sheetId: '1fvLqdzZJL0Nuf627MNuNPkLDu_HZ0oALR6-mGED5Ihs',
        scriptUrl: ''
    },

    // Constants
    STORAGE_KEY_TOPUPS: 'tg_standalone_topups',
    STORAGE_KEY_CONFIG: 'tg_config',
    STORAGE_KEY_PENDING: 'saldo_pending',

    /**
     * Initialize module - DIPANGGIL OLEH ROUTER
     */
    init() {
        console.log('[Telegram] init() called');
        
        if (this.isInitialized) {
            this.render();
            return;
        }
        
        // Load saved data
        const savedTopups = localStorage.getItem(this.STORAGE_KEY_TOPUPS);
        if (savedTopups) this.topups = JSON.parse(savedTopups);
        
        const savedConfig = localStorage.getItem(this.STORAGE_KEY_CONFIG);
        if (savedConfig) this.config = JSON.parse(savedConfig);
        
        // Check pending transaction
        this.checkPending();
        
        this.isInitialized = true;
        this.render();
        
        console.log('[Telegram] Module initialized');
    },

    /**
     * Render page - DIPANGGIL OLEH ROUTER (renderPage)
     */
    renderPage() {
        console.log('[Telegram] renderPage() called');
        this.init();
    },

    /**
     * Save data to localStorage
     */
    saveData() {
        localStorage.setItem(this.STORAGE_KEY_TOPUPS, JSON.stringify(this.topups));
        localStorage.setItem(this.STORAGE_KEY_CONFIG, JSON.stringify(this.config));
    },

    /**
     * Check for pending transaction
     */
    checkPending() {
        const saved = localStorage.getItem(this.STORAGE_KEY_PENDING);
        if (saved) this.transaksiAktif = JSON.parse(saved);
    },

    /**
     * Validate configuration
     */
    validateConfig() {
        const errors = [];
        if (!this.config.scriptUrl) errors.push('Script URL GAS belum diisi');
        if (!this.config.sheetId) errors.push('Sheet ID belum diisi');
        return { valid: errors.length === 0, errors };
    },

    /**
     * Main render function - render ke mainContent
     */
    render() {
        const container = document.getElementById('mainContent');
        if (!container) {
            console.error('[Telegram] mainContent not found!');
            return;
        }
        
        container.innerHTML = `
            <div class="telegram-container" style="padding: 20px; max-width: 1000px; margin: 0 auto;">
                ${this.renderHeader()}
                ${this.renderConfig()}
                ${this.renderSaldoSection()}
                ${this.renderExport()}
                ${this.renderList()}
            </div>
        `;
    },

    /**
     * Render header section
     */
    renderHeader() {
        return `
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                <h2 style="margin: 0; font-size: 24px;">📱 Input Saldo Hifzi Cell</h2>
                <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">Compatible dengan n8n workflow</p>
            </div>
        `;
    },

    /**
     * Render configuration section
     */
    renderConfig() {
        return `
            <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); margin-bottom: 20px;">
                <h3 style="margin: 0 0 16px 0; font-size: 16px; color: #333;">⚙️ Konfigurasi GAS</h3>
                <div style="margin-bottom: 12px;">
                    <label style="display: block; font-size: 13px; color: #555; margin-bottom: 6px; font-weight: 600;">Google Sheet ID</label>
                    <input type="text" id="tgSheetId" value="${this.config.sheetId}" 
                           style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; box-sizing: border-box;">
                </div>
                <div style="margin-bottom: 12px;">
                    <label style="display: block; font-size: 13px; color: #555; margin-bottom: 6px; font-weight: 600;">GAS Web App URL</label>
                    <input type="text" id="tgScriptUrl" value="${this.config.scriptUrl}" placeholder="https://script.google.com/macros/s/.../exec"
                           style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; box-sizing: border-box;">
                </div>
                <div style="display: flex; gap: 10px;">
                    <button onclick="TelegramModule.saveConfig()" 
                            style="padding: 10px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                        💾 Simpan
                    </button>
                    <button onclick="TelegramModule.testConnection()" 
                            style="padding: 10px 20px; background: #f5f5f5; color: #555; border: 2px solid #e0e0e0; border-radius: 8px; font-weight: 600; cursor: pointer;">
                        🔗 Test
                    </button>
                </div>
                <div id="tgTestResult" style="margin-top: 12px;"></div>
            </div>
        `;
    },

    /**
     * Render saldo input section
     */
    renderSaldoSection() {
        const isWaiting = this.transaksiAktif !== null;
        const validation = this.validateConfig();
        
        let warningHtml = '';
        if (!validation.valid && !isWaiting) {
            warningHtml = `
                <div style="background: #ffebee; border: 2px solid #f44336; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
                    <div style="color: #c62828; font-weight: 600;">⚠️ Konfigurasi Belum Lengkap</div>
                    <ul style="margin: 8px 0; padding-left: 20px; color: #c62828; font-size: 13px;">
                        ${validation.errors.map(e => `<li>${e}</li>`).join('')}
                    </ul>
                </div>
            `;
        }
        
        return `
            <div style="background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%); border: 2px solid #4caf50; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <h3 style="margin: 0 0 16px 0; color: #2e7d32; font-size: 18px;">💰 Input Saldo (n8n Compatible)</h3>
                ${warningHtml}
                ${isWaiting ? this.renderSaldoInput() : this.renderSaldoPilihan()}
            </div>
        `;
    },

    /**
     * Render saldo type selection
     */
    renderSaldoPilihan() {
        const validation = this.validateConfig();
        const disabled = !validation.valid;
        
        const buttons = ['DANA', 'DIGIPOS', 'MASTERLOAD'].map(jenis => `
            <button onclick="TelegramModule.pilihSaldo('${jenis}')" 
                    ${disabled ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : 'style="cursor: pointer;"'}
                    style="background: white; border: 2px solid #4caf50; color: #4caf50; padding: 20px; border-radius: 12px; font-weight: 600; width: 100%; transition: all 0.3s;">
                <div style="font-size: 32px; margin-bottom: 8px;">${jenis === 'DANA' ? '💙' : jenis === 'DIGIPOS' ? '🟡' : '🟢'}</div>
                <div>${jenis}</div>
            </button>
        `).join('');
        
        return `
            <div style="background: white; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                <strong style="color: #2e7d32;">📋 Cara Penggunaan:</strong>
                <ol style="margin: 10px 0; padding-left: 20px; font-size: 14px; color: #555; line-height: 1.8;">
                    <li>Klik jenis saldo</li>
                    <li>Masukkan nominal</li>
                    <li>Klik SIMPAN</li>
                    <li>Data masuk ke Sheet TOP UP (sama seperti bot Telegram)</li>
                </ol>
            </div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
                ${buttons}
            </div>
        `;
    },

    /**
     * Render saldo input form
     */
    renderSaldoInput() {
        const jenis = this.transaksiAktif?.namaItem;
        return `
            <div style="background: white; padding: 24px; border-radius: 16px; border: 3px solid #4caf50;">
                <div style="text-align: center; margin-bottom: 24px;">
                    <div style="font-size: 48px; margin-bottom: 8px;">${jenis === 'DANA' ? '💙' : jenis === 'DIGIPOS' ? '🟡' : '🟢'}</div>
                    <div style="font-size: 24px; font-weight: 700; color: #2e7d32;">${jenis}</div>
                </div>
                <div style="margin-bottom: 24px;">
                    <label style="display: block; margin-bottom: 12px; font-weight: 600; color: #333;">Nominal (Rp)</label>
                    <input type="number" id="tgNominalInput" placeholder="0" 
                           style="width: 100%; padding: 20px; font-size: 32px; font-weight: 700; border: 2px solid #ddd; border-radius: 12px; text-align: center; box-sizing: border-box;"
                           onkeyup="TelegramModule.formatRupiah(this)"
                           onkeypress="if(event.key==='Enter')TelegramModule.simpanSaldo()">
                    <div id="tgRupiahDisplay" style="text-align: center; margin-top: 12px; font-size: 18px; color: #4caf50; font-weight: 600;"></div>
                </div>
                <div style="display: flex; gap: 12px;">
                    <button onclick="TelegramModule.simpanSaldo()" 
                            style="flex: 2; background: linear-gradient(135deg, #4caf50 0%, #2e7d32 100%); color: white; padding: 18px; border: none; border-radius: 12px; font-weight: 700; font-size: 16px; cursor: pointer;">
                        ✅ SIMPAN KE SHEET
                    </button>
                    <button onclick="TelegramModule.batalSaldo()" 
                            style="flex: 1; background: #f5f5f5; color: #666; padding: 18px; border: 2px solid #ddd; border-radius: 12px; font-weight: 600; cursor: pointer;">
                        ❌ BATAL
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Render export section
     */
    renderExport() {
        return `
            <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); margin-bottom: 20px;">
                <h3 style="margin: 0 0 16px 0; font-size: 16px; color: #333;">📤 Export Data</h3>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <button onclick="TelegramModule.exportExcel()" 
                            style="padding: 12px 20px; background: #4caf50; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                        📊 Export Excel
                    </button>
                    <button onclick="TelegramModule.copyTable()" 
                            style="padding: 12px 20px; background: #ff9800; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                        📋 Copy ke Clipboard
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Render transaction list
     */
    renderList() {
        const sorted = [...this.topups].sort((a, b) => b.timestamp - a.timestamp);
        
        let html = `<h3 style="margin: 0 0 16px 0; font-size: 16px; color: #333;">📋 Riwayat (${sorted.length})</h3>`;
        
        if (sorted.length === 0) {
            html += `<div style="text-align: center; padding: 40px; color: #999; background: white; border-radius: 12px;">Belum ada data</div>`;
        } else {
            sorted.forEach(t => {
                const date = new Date(t.timestamp);
                html += `
                    <div style="background: white; padding: 16px; border-radius: 12px; margin-bottom: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); display: flex; justify-content: space-between; align-items: center; border-left: 4px solid #4caf50;">
                        <div>
                            <div style="font-size: 18px; font-weight: 700; color: #333;">Rp ${t.amount.toLocaleString('id-ID')}</div>
                            <div style="font-size: 12px; color: #666;">${t.method} • ${date.toLocaleDateString('id-ID')}</div>
                        </div>
                        <div style="font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 12px; background: #e8f5e9; color: #2e7d32;">
                            ✅ Tersimpan
                        </div>
                    </div>
                `;
            });
        }
        
        return html;
    },

    // ==================== ACTIONS ====================

    /**
     * Format rupiah display
     */
    formatRupiah(input) {
        const value = input.value.replace(/\D/g, '');
        const formatted = new Intl.NumberFormat('id-ID').format(value);
        const display = document.getElementById('tgRupiahDisplay');
        if (display) {
            display.textContent = value ? `Rp ${formatted}` : '';
        }
    },

    /**
     * Save configuration
     */
    saveConfig() {
        const sheetIdInput = document.getElementById('tgSheetId');
        const scriptUrlInput = document.getElementById('tgScriptUrl');
        
        if (sheetIdInput) this.config.sheetId = sheetIdInput.value.trim();
        if (scriptUrlInput) this.config.scriptUrl = scriptUrlInput.value.trim();
        
        this.saveData();
        
        if (typeof app !== 'undefined' && app.showToast) {
            app.showToast('✅ Konfigurasi disimpan!');
        } else {
            alert('✅ Konfigurasi disimpan!');
        }
        
        this.render();
    },

    /**
     * Test connection to GAS
     */
    async testConnection() {
        const resultDiv = document.getElementById('tgTestResult');
        if (!resultDiv) return;
        
        resultDiv.innerHTML = '<div style="color: #667eea;">⏳ Testing...</div>';
        
        try {
            const url = this.config.scriptUrl + '?action=test&sheetId=' + encodeURIComponent(this.config.sheetId);
            const response = await fetch(url, { mode: 'cors' });
            const result = await response.json();
            
            if (result.success) {
                resultDiv.innerHTML = `<div style="color: #4caf50; font-weight: 600;">✅ Connected! Sheets: ${result.sheets?.join(', ')}</div>`;
            } else {
                resultDiv.innerHTML = `<div style="color: #f44336;">❌ ${result.error}</div>`;
            }
        } catch (e) {
            resultDiv.innerHTML = `<div style="color: #f44336;">❌ Error: ${e.message}</div>`;
        }
    },

    /**
     * Select saldo type
     */
    async pilihSaldo(jenis) {
        if (!this.validateConfig().valid) {
            alert('Konfigurasi belum lengkap!');
            return;
        }
        
        if (typeof app !== 'undefined' && app.showToast) {
            app.showToast(`⏳ Memulai ${jenis}...`);
        }
        
        try {
            const response = await fetch(this.config.scriptUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'initSaldo',
                    sheetId: this.config.sheetId,
                    namaItem: jenis
                }),
                mode: 'cors'
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.transaksiAktif = {
                    transaksiId: result.transaksiId,
                    matchKey: result.matchKey,
                    namaItem: jenis
                };
                localStorage.setItem(this.STORAGE_KEY_PENDING, JSON.stringify(this.transaksiAktif));
                
                this.render();
                
                setTimeout(() => {
                    const input = document.getElementById('tgNominalInput');
                    if (input) input.focus();
                }, 100);
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            alert('Error: ' + error.message + '\n\nPastikan GAS sudah di-deploy dengan access ANYONE');
        }
    },

    /**
     * Save saldo transaction
     */
    async simpanSaldo() {
        const nominalInput = document.getElementById('tgNominalInput');
        if (!nominalInput) return;
        
        const nominal = parseInt(nominalInput.value.replace(/\D/g, ''));
        if (!nominal || nominal <= 0) {
            alert('Nominal tidak valid!');
            return;
        }
        
        if (typeof app !== 'undefined' && app.showToast) {
            app.showToast('⏳ Menyimpan...');
        }
        
        try {
            const response = await fetch(this.config.scriptUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'completeSaldo',
                    sheetId: this.config.sheetId,
                    matchKey: this.transaksiAktif.matchKey,
                    nominal: nominal
                }),
                mode: 'cors'
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.topups.push({
                    id: this.transaksiAktif.transaksiId,
                    amount: nominal,
                    method: this.transaksiAktif.namaItem,
                    timestamp: Date.now(),
                    status: 'confirmed',
                    sheetRow: result.row
                });
                this.saveData();
                
                this.transaksiAktif = null;
                localStorage.removeItem(this.STORAGE_KEY_PENDING);
                
                alert(`✅ BERHASIL!\n\n${result.data.namaItem}: Rp ${nominal.toLocaleString('id-ID')}\nTanggal: ${result.data.tanggal}\nSheet: TOP UP (Row ${result.row})`);
                
                this.render();
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    },

    /**
     * Cancel saldo input
     */
    batalSaldo() {
        this.transaksiAktif = null;
        localStorage.removeItem(this.STORAGE_KEY_PENDING);
        this.render();
    },

    /**
     * Export to Excel
     */
    exportExcel() {
        if (this.topups.length === 0) {
            alert('Tidak ada data!');
            return;
        }
        
        let html = `<table border="1"><tr style="background:#4caf50;color:white;"><th>BULAN</th><th>TANGGAL</th><th>NAMA ITEM</th><th>SALDO TOP UP</th></tr>`;
        
        this.topups.forEach(t => {
            const date = new Date(t.timestamp);
            const bulan = date.toLocaleString('id-ID', { month: 'long' }).toUpperCase();
            const tanggal = date.toLocaleDateString('id-ID');
            
            html += `<tr><td>${bulan}</td><td>${tanggal}</td><td>${t.method}</td><td>${t.amount}</td></tr>`;
        });
        
        html += '</table>';
        
        const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `topup_${new Date().toISOString().split('T')[0]}.xls`;
        link.click();
        
        if (typeof app !== 'undefined' && app.showToast) {
            app.showToast('✅ Excel di-download!');
        }
    },

    /**
     * Copy table to clipboard
     */
    copyTable() {
        if (this.topups.length === 0) {
            alert('Tidak ada data!');
            return;
        }
        
        let text = 'BULAN\tTANGGAL\tNAMA ITEM\tSALDO TOP UP\n';
        
        this.topups.forEach(t => {
            const date = new Date(t.timestamp);
            const bulan = date.toLocaleString('id-ID', { month: 'long' }).toUpperCase();
            text += `${bulan}\t${date.toLocaleDateString('id-ID')}\t${t.method}\t${t.amount}\n`;
        });
        
        navigator.clipboard.writeText(text).then(() => {
            if (typeof app !== 'undefined' && app.showToast) {
                app.showToast('✅ Data tersalin! Paste ke Sheets');
            } else {
                alert('✅ Data tersalin! Paste ke Sheets');
            }
        });
    }
};

// Make globally available
window.TelegramModule = TelegramModule;

console.log('[Telegram] Module ready');

/**
 * Telegram Module - Hifzi Cell POS (n8n Compatible)
 * Dengan mode offline-first dan sync manual
 */

console.log('[Telegram] Module loaded - n8n compatible');

const TelegramModule = {
    // State
    topups: [],
    currentFilter: 'all',
    isInitialized: false,
    transaksiAktif: null,
    
    // Config
    config: {
        sheetId: '',
        scriptUrl: ''
    },

    // Constants
    STORAGE_KEY_TOPUPS: 'tg_standalone_topups',
    STORAGE_KEY_CONFIG: 'tg_config',
    STORAGE_KEY_PENDING: 'saldo_pending',

    init() {
        console.log('[Telegram] init() called');
        
        if (this.isInitialized) {
            this.render();
            return;
        }
        
        const savedTopups = localStorage.getItem(this.STORAGE_KEY_TOPUPS);
        if (savedTopups) this.topups = JSON.parse(savedTopups);
        
        const savedConfig = localStorage.getItem(this.STORAGE_KEY_CONFIG);
        if (savedConfig) this.config = JSON.parse(savedConfig);
        
        this.checkPending();
        this.isInitialized = true;
        this.render();
    },

    renderPage() {
        this.init();
    },

    saveData() {
        localStorage.setItem(this.STORAGE_KEY_TOPUPS, JSON.stringify(this.topups));
        localStorage.setItem(this.STORAGE_KEY_CONFIG, JSON.stringify(this.config));
    },

    checkPending() {
        const saved = localStorage.getItem(this.STORAGE_KEY_PENDING);
        if (saved) this.transaksiAktif = JSON.parse(saved);
    },

    validateConfig() {
        const errors = [];
        if (!this.config.scriptUrl) errors.push('Script URL GAS belum diisi');
        if (!this.config.sheetId) errors.push('Sheet ID belum diisi');
        return { valid: errors.length === 0, errors };
    },

    getFilteredTopups() {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        return this.topups.filter(t => {
            const tDate = new Date(t.timestamp);
            const tDay = new Date(tDate.getFullYear(), tDate.getMonth(), tDate.getDate());
            
            switch(this.currentFilter) {
                case 'today':
                    return tDay.getTime() === today.getTime();
                case 'yesterday':
                    return tDay.getTime() === yesterday.getTime();
                case 'month':
                    return tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear();
                case 'year':
                    return tDate.getFullYear() === now.getFullYear();
                default:
                    return true;
            }
        }).sort((a, b) => b.timestamp - a.timestamp);
    },

    getTotalAmount(filtered = null) {
        const data = filtered || this.getFilteredTopups();
        return data.reduce((sum, t) => sum + (t.amount || 0), 0);
    },

    getFilterLabel() {
        const labels = {
            'all': 'Semua Waktu',
            'today': 'Hari Ini',
            'yesterday': 'Kemarin',
            'month': 'Bulan Ini',
            'year': 'Tahun Ini'
        };
        return labels[this.currentFilter] || 'Semua Waktu';
    },

    render() {
        const container = document.getElementById('mainContent');
        if (!container) return;
        
        const filtered = this.getFilteredTopups();
        const total = this.getTotalAmount(filtered);
        
        container.innerHTML = `
            <div class="telegram-container" style="padding: 20px; max-width: 1000px; margin: 0 auto;">
                ${this.renderHeader()}
                ${this.renderGASGenerator()}
                ${this.renderConfig()}
                ${this.renderSaldoSection()}
                ${this.renderStats(total, filtered.length)}
                ${this.renderFilterButtons()}
                ${this.renderList(filtered, total)}
            </div>
        `;
    },

    renderHeader() {
        return `
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                <h2 style="margin: 0; font-size: 24px;">📱 Input Saldo Hifzi Cell</h2>
                <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">Mode: Simpan Lokal + Sync ke Sheets</p>
            </div>
        `;
    },

    renderGASGenerator() {
        return `
            <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                <h3 style="margin: 0 0 16px 0; font-size: 16px;">⚡ Generate GAS (Google Apps Script)</h3>
                <p style="margin: 0 0 16px 0; font-size: 13px; opacity: 0.95;">
                    Copy kode ini ke Google Apps Script untuk enable sync ke Sheets.
                </p>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <button onclick="TelegramModule.showGASCode()" 
                            style="padding: 12px 20px; background: white; color: #f5576c; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                        📋 Lihat Kode GAS
                    </button>
                    <button onclick="TelegramModule.copyGASCode()" 
                            style="padding: 12px 20px; background: rgba(255,255,255,0.2); color: white; border: 2px solid white; border-radius: 8px; font-weight: 600; cursor: pointer;">
                        📄 Copy Kode
                    </button>
                </div>
                <div id="gasCodeContainer" style="display: none; margin-top: 16px;">
                    <div style="background: #1e1e1e; border-radius: 8px; padding: 16px; overflow-x: auto;">
                        <pre style="margin: 0; color: #d4d4d4; font-size: 12px; line-height: 1.5; white-space: pre-wrap;">${this.escapeHtml(this.getGASCode())}</pre>
                    </div>
                </div>
            </div>
        `;
    },

    getGASCode() {
        return `// ============================================
// GOOGLE APPS SCRIPT - Telegram Module
// ============================================
// 1. Buat Spreadsheet baru
// 2. Extensions > Apps Script
// 3. Hapus kode default, paste ini
// 4. Deploy > New deployment > Web App
// 5. Execute as: Me
// 6. Who has access: ANYONE
// 7. Copy URL ke POS

const SHEET_NAME = 'TOP UP';

function doGet(e) {
  const action = e.parameter.action;
  const sheetId = e.parameter.sheetId;
  
  try {
    if (action === 'test') {
      const ss = SpreadsheetApp.openById(sheetId);
      const sheets = ss.getSheets().map(s => s.getName());
      return jsonResponse({ 
        success: true, 
        sheets: sheets
      });
    }
    return jsonResponse({ success: false, error: 'Invalid action' });
  } catch (error) {
    return jsonResponse({ success: false, error: error.toString() });
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    const sheetId = data.sheetId;
    
    const ss = SpreadsheetApp.openById(sheetId);
    let sheet = ss.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow(['BULAN', 'TANGGAL', 'NAMA ITEM', 'SALDO TOP UP', 'TIMESTAMP', 'ID']);
      sheet.getRange(1,1,1,6).setFontWeight('bold').setBackground('#4caf50').setFontColor('white');
    }
    
    if (action === 'saveDirect') {
      const now = new Date();
      const bulan = Utilities.formatDate(now, 'Asia/Jakarta', 'MMMM').toUpperCase();
      const tanggal = Utilities.formatDate(now, 'Asia/Jakarta', 'dd/MM/yyyy');
      const timestamp = Utilities.formatDate(now, 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
      
      sheet.appendRow([
        bulan,
        tanggal,
        data.namaItem,
        data.nominal,
        timestamp,
        data.id
      ]);
      
      return jsonResponse({
        success: true,
        row: sheet.getLastRow()
      });
    }
    
    return jsonResponse({ success: false, error: 'Invalid action' });
  } catch (error) {
    return jsonResponse({ success: false, error: error.toString() });
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}`;
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    showGASCode() {
        const container = document.getElementById('gasCodeContainer');
        if (container) {
            container.style.display = container.style.display === 'none' ? 'block' : 'none';
        }
    },

    copyGASCode() {
        navigator.clipboard.writeText(this.getGASCode()).then(() => {
            if (typeof app !== 'undefined' && app.showToast) {
                app.showToast('✅ Kode GAS tersalin!');
            } else {
                alert('✅ Kode GAS tersalin!');
            }
        });
    },

    renderConfig() {
        const validation = this.validateConfig();
        const statusColor = validation.valid ? '#4caf50' : '#ff9800';
        const statusText = validation.valid ? '✅ Terkonfigurasi' : '⚠️ Belum Lengkap';
        
        return `
            <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <h3 style="margin: 0; font-size: 16px; color: #333;">⚙️ Konfigurasi Google Sheets (Opsional)</h3>
                    <span style="padding: 4px 12px; background: ${statusColor}20; color: ${statusColor}; border-radius: 12px; font-size: 12px; font-weight: 600;">
                        ${statusText}
                    </span>
                </div>
                <div style="margin-bottom: 12px;">
                    <label style="display: block; font-size: 13px; color: #555; margin-bottom: 6px; font-weight: 600;">Google Sheet ID</label>
                    <input type="text" id="tgSheetId" value="${this.config.sheetId}" placeholder="1fvLqdzZJL0Nuf..."
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

    renderSaldoSection() {
        const isWaiting = this.transaksiAktif !== null;
        
        return `
            <div style="background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%); border: 2px solid #4caf50; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                <h3 style="margin: 0 0 16px 0; color: #2e7d32; font-size: 18px;">💰 Input Saldo</h3>
                ${isWaiting ? this.renderSaldoInput() : this.renderSaldoPilihan()}
            </div>
        `;
    },

    renderSaldoPilihan() {
        const buttons = ['DANA', 'DIGIPOS', 'MASTERLOAD'].map(jenis => `
            <button onclick="TelegramModule.pilihSaldo('${jenis}')" 
                    style="background: white; border: 2px solid #4caf50; color: #4caf50; padding: 20px; border-radius: 12px; font-weight: 600; width: 100%; transition: all 0.3s; cursor: pointer;">
                <div style="font-size: 32px; margin-bottom: 8px;">${jenis === 'DANA' ? '💙' : jenis === 'DIGIPOS' ? '🟡' : '🟢'}</div>
                <div>${jenis}</div>
            </button>
        `).join('');
        
        return `
            <div style="background: white; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                <strong style="color: #2e7d32;">📋 Mode Operasi:</strong>
                <ul style="margin: 10px 0; padding-left: 20px; font-size: 14px; color: #555; line-height: 1.8;">
                    <li><b>Mode Offline:</b> Data tersimpan di browser (lokal)</li>
                    <li><b>Sync Manual:</b> Export ke Excel/Copy paste ke Sheets</li>
                    <li><b>Auto Sync:</b> Jika GAS dikonfigurasi, data otomatis masuk ke Sheets</li>
                </ul>
            </div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
                ${buttons}
            </div>
        `;
    },

    renderSaldoInput() {
        const jenis = this.transaksiAktif?.namaItem;
        const isOnline = this.validateConfig().valid;
        
        return `
            <div style="background: white; padding: 24px; border-radius: 16px; border: 3px solid #4caf50;">
                <div style="text-align: center; margin-bottom: 24px;">
                    <div style="font-size: 48px; margin-bottom: 8px;">${jenis === 'DANA' ? '💙' : jenis === 'DIGIPOS' ? '🟡' : '🟢'}</div>
                    <div style="font-size: 24px; font-weight: 700; color: #2e7d32;">${jenis}</div>
                    ${isOnline ? '<div style="color: #4caf50; font-size: 12px; margin-top: 5px;">🟢 Auto-sync ke Sheets aktif</div>' : '<div style="color: #ff9800; font-size: 12px; margin-top: 5px;">🟡 Mode lokal (tanpa Sheets)</div>'}
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
                        ✅ SIMPAN
                    </button>
                    <button onclick="TelegramModule.batalSaldo()" 
                            style="flex: 1; background: #f5f5f5; color: #666; padding: 18px; border: 2px solid #ddd; border-radius: 12px; font-weight: 600; cursor: pointer;">
                        ❌ BATAL
                    </button>
                </div>
            </div>
        `;
    },

    renderStats(total, count) {
        return `
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 20px;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 12px;">
                    <div style="font-size: 12px; opacity: 0.9; margin-bottom: 4px;">TOTAL ${this.getFilterLabel().toUpperCase()}</div>
                    <div style="font-size: 28px; font-weight: 700;">Rp ${total.toLocaleString('id-ID')}</div>
                </div>
                <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
                    <div style="font-size: 12px; color: #666; margin-bottom: 4px;">JUMLAH INPUT</div>
                    <div style="font-size: 28px; font-weight: 700; color: #333;">${count}</div>
                </div>
            </div>
        `;
    },

    renderFilterButtons() {
        const filters = [
            { key: 'all', label: 'Semua', icon: '📊' },
            { key: 'today', label: 'Hari Ini', icon: '📅' },
            { key: 'yesterday', label: 'Kemarin', icon: '⏰' },
            { key: 'month', label: 'Bulan Ini', icon: '📆' },
            { key: 'year', label: 'Tahun Ini', icon: '🗓️' }
        ];
        
        const buttons = filters.map(f => {
            const isActive = this.currentFilter === f.key;
            return `
                <button onclick="TelegramModule.setFilter('${f.key}')" 
                        style="padding: 10px 16px; border-radius: 20px; border: 2px solid ${isActive ? '#667eea' : '#e0e0e0'}; 
                               background: ${isActive ? '#667eea' : 'white'}; color: ${isActive ? 'white' : '#555'}; 
                               font-weight: 600; cursor: pointer; font-size: 13px; transition: all 0.3s; white-space: nowrap;">
                    ${f.icon} ${f.label}
                </button>
            `;
        }).join('');
        
        return `
            <div style="margin-bottom: 20px;">
                <div style="font-size: 13px; color: #666; margin-bottom: 10px; font-weight: 600;">🔍 Filter Periode:</div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap; overflow-x: auto; padding-bottom: 5px;">
                    ${buttons}
                </div>
            </div>
        `;
    },

    renderList(filtered, total) {
        const sorted = filtered;
        
        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h3 style="margin: 0; font-size: 16px; color: #333;">
                    📋 Riwayat ${this.getFilterLabel()} (${sorted.length})
                </h3>
                <div style="display: flex; gap: 8px;">
                    ${sorted.length > 0 ? `
                        <button onclick="TelegramModule.confirmClearLocal()" 
                                style="padding: 8px 16px; background: #ffebee; color: #c62828; border: 1px solid #ef9a9a; 
                                       border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer;">
                            🗑️ Hapus Lokal
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
        
        if (sorted.length === 0) {
            html += `
                <div style="text-align: center; padding: 60px 40px; color: #999; background: white; border-radius: 12px; border: 2px dashed #ddd;">
                    <div style="font-size: 48px; margin-bottom: 16px;">📭</div>
                    <div style="font-size: 16px; font-weight: 600; color: #666; margin-bottom: 8px;">Tidak ada data</div>
                    <div style="font-size: 13px;">Belum ada input saldo untuk periode ${this.getFilterLabel().toLowerCase()}</div>
                </div>
            `;
        } else {
            html += `<div style="display: flex; flex-direction: column; gap: 12px;">`;
            sorted.forEach((t) => {
                const date = new Date(t.timestamp);
                const timeStr = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                const dateStr = date.toLocaleDateString('id-ID');
                const synced = t.sheetRow ? true : false;
                
                html += `
                    <div style="background: white; padding: 16px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); 
                                display: flex; justify-content: space-between; align-items: center; 
                                border-left: 4px solid ${t.method === 'DANA' ? '#0088cc' : t.method === 'DIGIPOS' ? '#ffc107' : '#4caf50'};">
                        <div style="flex: 1;">
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                                <span style="font-size: 20px;">${t.method === 'DANA' ? '💙' : t.method === 'DIGIPOS' ? '🟡' : '🟢'}</span>
                                <span style="font-size: 16px; font-weight: 700; color: #333;">Rp ${t.amount.toLocaleString('id-ID')}</span>
                                ${synced ? '<span style="color: #4caf50; font-size: 11px;">✓ Synced</span>' : '<span style="color: #ff9800; font-size: 11px;">⏳ Local</span>'}
                            </div>
                            <div style="font-size: 12px; color: #666;">
                                ${t.method} • ${dateStr} ${timeStr}
                            </div>
                        </div>
                        <button onclick="TelegramModule.deleteLocal('${t.id}')" 
                                style="padding: 8px 12px; background: #ffebee; color: #c62828; border: none; 
                                       border-radius: 6px; font-size: 12px; cursor: pointer; margin-left: 10px;">
                            🗑️
                        </button>
                    </div>
                `;
            });
            html += `</div>`;
            
            html += `
                <div style="display: flex; gap: 10px; margin-top: 20px; flex-wrap: wrap;">
                    <button onclick="TelegramModule.exportExcel()" 
                            style="padding: 12px 20px; background: #4caf50; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; flex: 1; min-width: 140px;">
                        📊 Export Excel
                    </button>
                    <button onclick="TelegramModule.copyTable()" 
                            style="padding: 12px 20px; background: #ff9800; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; flex: 1; min-width: 140px;">
                        📋 Copy ke Clipboard
                    </button>
                    ${this.validateConfig().valid ? `
                        <button onclick="TelegramModule.syncToSheets()" 
                                style="padding: 12px 20px; background: #2196f3; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; flex: 1; min-width: 140px;">
                                ☁️ Sync ke Sheets
                        </button>
                    ` : ''}
                </div>
            `;
        }
        
        return html;
    },

    // ==================== ACTIONS ====================

    setFilter(filter) {
        this.currentFilter = filter;
        this.render();
    },

    formatRupiah(input) {
        const value = input.value.replace(/\D/g, '');
        const formatted = new Intl.NumberFormat('id-ID').format(value);
        const display = document.getElementById('tgRupiahDisplay');
        if (display) {
            display.textContent = value ? `Rp ${formatted}` : '';
        }
    },

    saveConfig() {
        const sheetIdInput = document.getElementById('tgSheetId');
        const scriptUrlInput = document.getElementById('tgScriptUrl');
        
        if (sheetIdInput) this.config.sheetId = sheetIdInput.value.trim();
        if (scriptUrlInput) this.config.scriptUrl = scriptUrlInput.value.trim();
        
        this.saveData();
        
        if (typeof app !== 'undefined' && app.showToast) {
            app.showToast('✅ Konfigurasi disimpan!');
        }
        
        this.render();
    },

    async testConnection() {
        const resultDiv = document.getElementById('tgTestResult');
        if (!resultDiv) return;
        
        if (!this.config.scriptUrl) {
            resultDiv.innerHTML = `<div style="color: #ff9800;">⚠️ Isi Script URL terlebih dahulu</div>`;
            return;
        }
        
        resultDiv.innerHTML = '<div style="color: #667eea;">⏳ Testing...</div>';
        
        try {
            const url = this.config.scriptUrl + '?action=test&sheetId=' + encodeURIComponent(this.config.sheetId || 'test');
            const response = await fetch(url, { mode: 'cors' });
            const result = await response.json();
            
            if (result.success) {
                resultDiv.innerHTML = `<div style="color: #4caf50; font-weight: 600;">✅ Terhubung! Sheets: ${result.sheets?.join(', ')}</div>`;
            } else {
                resultDiv.innerHTML = `<div style="color: #f44336;">❌ ${result.error}</div>`;
            }
        } catch (e) {
            resultDiv.innerHTML = `<div style="color: #f44336;">❌ Error: ${e.message}</div>`;
        }
    },

    /**
     * PILIH SALDO - Simplified, no fetch
     */
    pilihSaldo(jenis) {
        this.transaksiAktif = {
            transaksiId: 'local_' + Date.now(),
            matchKey: Math.random().toString(36).substring(2, 10).toUpperCase(),
            namaItem: jenis
        };
        localStorage.setItem(this.STORAGE_KEY_PENDING, JSON.stringify(this.transaksiAktif));
        
        this.render();
        
        setTimeout(() => {
            const input = document.getElementById('tgNominalInput');
            if (input) input.focus();
        }, 100);
    },

    /**
     * SIMPAN SALDO - Save local first, then try sync
     */
    async simpanSaldo() {
        const nominalInput = document.getElementById('tgNominalInput');
        if (!nominalInput) return;
        
        const nominal = parseInt(nominalInput.value.replace(/\D/g, ''));
        if (!nominal || nominal <= 0) {
            alert('Nominal tidak valid!');
            return;
        }
        
        const namaItem = this.transaksiAktif?.namaItem;
        const transaksiId = this.transaksiAktif?.transaksiId;
        
        // Simpan ke lokal dulu
        const newTopup = {
            id: transaksiId,
            amount: nominal,
            method: namaItem,
            timestamp: Date.now(),
            status: 'local',
            sheetRow: null
        };
        
        this.topups.push(newTopup);
        this.saveData();
        
        // Reset form
        this.transaksiAktif = null;
        localStorage.removeItem(this.STORAGE_KEY_PENDING);
        
        // Coba sync ke Sheets jika konfigurasi valid
        if (this.validateConfig().valid) {
            try {
                if (typeof app !== 'undefined' && app.showToast) {
                    app.showToast('⏳ Menyimpan ke Sheets...');
                }
                
                const response = await fetch(this.config.scriptUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'saveDirect',
                        sheetId: this.config.sheetId,
                        namaItem: namaItem,
                        nominal: nominal,
                        id: transaksiId
                    }),
                    mode: 'cors'
                });
                
                const result = await response.json();
                
                if (result.success) {
                    // Update status jadi synced
                    const index = this.topups.findIndex(t => t.id === transaksiId);
                    if (index !== -1) {
                        this.topups[index].status = 'synced';
                        this.topups[index].sheetRow = result.row;
                        this.saveData();
                    }
                    
                    if (typeof app !== 'undefined' && app.showToast) {
                        app.showToast(`✅ Tersimpan di Sheets (Row ${result.row})`);
                    }
                }
            } catch (error) {
                console.log('[Telegram] Sync failed, kept local:', error);
                if (typeof app !== 'undefined' && app.showToast) {
                    app.showToast('✅ Tersimpan lokal (Sync ke Sheets gagal)');
                }
            }
        } else {
            if (typeof app !== 'undefined' && app.showToast) {
                app.showToast('✅ Tersimpan lokal');
            }
        }
        
        this.render();
    },

    batalSaldo() {
        this.transaksiAktif = null;
        localStorage.removeItem(this.STORAGE_KEY_PENDING);
        this.render();
    },

    deleteLocal(id) {
        if (!confirm('Hapus dari riwayat lokal?\n\nData di Google Sheet (jika ada) TIDAK akan dihapus.')) {
            return;
        }
        
        this.topups = this.topups.filter(t => t.id !== id);
        this.saveData();
        
        if (typeof app !== 'undefined' && app.showToast) {
            app.showToast('✅ Dihapus dari riwayat lokal');
        }
        
        this.render();
    },

    confirmClearLocal() {
        const filtered = this.getFilteredTopups();
        const count = filtered.length;
        
        if (count === 0) return;
        
        if (!confirm(`Hapus ${count} riwayat ${this.getFilterLabel().toLowerCase()}?\n\nData di Google Sheet (jika ada) TIDAK akan dihapus.`)) {
            return;
        }
        
        const filteredIds = new Set(filtered.map(t => t.id));
        this.topups = this.topups.filter(t => !filteredIds.has(t.id));
        this.saveData();
        
        if (typeof app !== 'undefined' && app.showToast) {
            app.showToast(`✅ ${count} riwayat dihapus`);
        }
        
        this.render();
    },

    async syncToSheets() {
        const unsynced = this.topups.filter(t => !t.sheetRow);
        
        if (unsynced.length === 0) {
            alert('Semua data sudah tersinkronisasi!');
            return;
        }
        
        if (!this.validateConfig().valid) {
            alert('Konfigurasi GAS belum lengkap!');
            return;
        }
        
        if (typeof app !== 'undefined' && app.showToast) {
            app.showToast(`⏳ Sync ${unsynced.length} data ke Sheets...`);
        }
        
        let success = 0;
        let failed = 0;
        
        for (const item of unsynced) {
            try {
                const response = await fetch(this.config.scriptUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'saveDirect',
                        sheetId: this.config.sheetId,
                        namaItem: item.method,
                        nominal: item.amount,
                        id: item.id
                    }),
                    mode: 'cors'
                });
                
                const result = await response.json();
                
                if (result.success) {
                    item.sheetRow = result.row;
                    item.status = 'synced';
                    success++;
                } else {
                    failed++;
                }
            } catch (error) {
                console.error('[Telegram] Sync error:', error);
                failed++;
            }
        }
        
        this.saveData();
        this.render();
        
        alert(`Sync selesai!\n✅ Berhasil: ${success}\n❌ Gagal: ${failed}`);
    },

    exportExcel() {
        const filtered = this.getFilteredTopups();
        if (filtered.length === 0) {
            alert('Tidak ada data untuk di-export!');
            return;
        }
        
        let html = `<table border="1"><tr style="background:#4caf50;color:white;"><th>BULAN</th><th>TANGGAL</th><th>WAKTU</th><th>NAMA ITEM</th><th>SALDO TOP UP</th><th>STATUS</th></tr>`;
        
        filtered.forEach(t => {
            const date = new Date(t.timestamp);
            const bulan = date.toLocaleString('id-ID', { month: 'long' }).toUpperCase();
            const tanggal = date.toLocaleDateString('id-ID');
            const waktu = date.toLocaleTimeString('id-ID');
            const status = t.sheetRow ? 'Synced' : 'Local';
            
            html += `<tr><td>${bulan}</td><td>${tanggal}</td><td>${waktu}</td><td>${t.method}</td><td>${t.amount}</td><td>${status}</td></tr>`;
        });
        
        html += '</table>';
        
        const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `topup_${this.currentFilter}_${new Date().toISOString().split('T')[0]}.xls`;
        link.click();
        
        if (typeof app !== 'undefined' && app.showToast) {
            app.showToast('✅ Excel di-download!');
        }
    },

    copyTable() {
        const filtered = this.getFilteredTopups();
        if (filtered.length === 0) {
            alert('Tidak ada data!');
            return;
        }
        
        let text = 'BULAN\tTANGGAL\tWAKTU\tNAMA ITEM\tSALDO TOP UP\tSTATUS\n';
        
        filtered.forEach(t => {
            const date = new Date(t.timestamp);
            const bulan = date.toLocaleString('id-ID', { month: 'long' }).toUpperCase();
            const status = t.sheetRow ? 'Synced' : 'Local';
            text += `${bulan}\t${date.toLocaleDateString('id-ID')}\t${date.toLocaleTimeString('id-ID')}\t${t.method}\t${t.amount}\t${status}\n`;
        });
        
        navigator.clipboard.writeText(text).then(() => {
            if (typeof app !== 'undefined' && app.showToast) {
                app.showToast('✅ Data tersalin! Paste ke Sheets');
            }
        });
    }
};

window.TelegramModule = TelegramModule;
console.log('[Telegram] Module ready');

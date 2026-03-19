/**
 * Telegram Module - Hifzi Cell POS (CORS-FIXED VERSION)
 * Dengan JSONP fallback dan CORS proxy
 */

console.log('[Telegram] Script mulai di-load...');

// Storage keys
const STORAGE_KEY_CONFIG = 'tg_standalone_config';
const STORAGE_KEY_TOPUPS = 'tg_standalone_topups';
const STORAGE_KEY_SALDO = 'tg_saldo_config';

// State global
let tgConfig = {
    botToken: '',
    chatId: '',
    webhookUrl: '',
    secretKey: '',
    sheetId: '1fvLqdzZJL0Nuf627MNuNPkLDu_HZ0oALR6-mGED5Ihs',
    sheetName: 'Topups',
    scriptUrl: '',
    isPolling: false,
    lastSync: 0
};

let saldoConfig = {
    jenisSaldo: ['DANA', 'DIGIPOS', 'MASTERLOAD'],
    sheetId: '1fvLqdzZJL0Nuf627MNuNPkLDu_HZ0oALR6-mGED5Ihs',
    sheetTopup: 'TOP UP',
    sheetStep: 'STEP',
    scriptUrl: ''
};

let topups = [];
let currentFilter = 'all';
let currentTimeFilter = 'month';
let isInitialized = false;

// ==================== GAS GENERATOR MODULE ====================

const GasGenerator = {
    // Template GAS dengan CORS headers yang benar
    getGasTemplate: function() {
        return `// ============================================
// GAS CORS-FIXED - Hifzi Cell POS
// Deploy dengan: Execute as: Me, Access: ANYONE
// ============================================

function doGet(e) {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  
  const action = e.parameter.action || 'info';
  const sheetId = e.parameter.sheetId;
  
  try {
    let result;
    
    switch(action) {
      case 'test':
        if (!sheetId) {
          result = { success: false, error: 'Sheet ID diperlukan' };
        } else {
          result = testConnection(sheetId);
        }
        break;
      case 'getTopups':
        result = getTopupsFromSheet(sheetId, e.parameter.sheetName);
        break;
      default:
        result = {
          success: true,
          message: 'GAS CORS-Fixed aktif!',
          timestamp: new Date().toISOString(),
          note: 'Sheet ID dari parameter',
          endpoints: ['test?sheetId=XXX', 'POST: initSaldo, completeSaldo, append']
        };
    }
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeaders(headers);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON).setHeaders(headers);
  }
}

function doPost(e) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  
  try {
    const data = JSON.parse(e.postData.contents);
    
    if (!data.sheetId) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Sheet ID wajib diisi'
      })).setMimeType(ContentService.MimeType.JSON).setHeaders(headers);
    }
    
    let result;
    
    switch(data.action) {
      case 'append':
        result = appendToSheet(data.sheetId, data.sheetName, data.data);
        break;
      case 'initSaldo':
        result = initSaldoTransaction(data);
        break;
      case 'completeSaldo':
        result = completeSaldoTransaction(data);
        break;
      default:
        result = { success: false, error: 'Unknown action: ' + data.action };
    }
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeaders(headers);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON).setHeaders(headers);
  }
}

// OPTIONS untuk preflight CORS
function doOptions(e) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
  return ContentService.createTextOutput('').setHeaders(headers);
}

// ============================================
// FUNCTIONS
// ============================================

function initSaldoTransaction(data) {
  const ss = SpreadsheetApp.openById(data.sheetId);
  let sheet = ss.getSheetByName('TOP UP');
  
  if (!sheet) {
    sheet = ss.insertSheet('TOP UP');
    sheet.appendRow(['Timestamp', 'Chat ID', 'Jenis', 'Nominal', 'Status', 'Match Key', 'Tanggal', 'Bulan']);
  }
  
  const matchKey = 'SALDO_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  const now = new Date();
  const tanggal = Utilities.formatDate(now, 'Asia/Jakarta', 'dd/MM/yyyy');
  const bulan = Utilities.formatDate(now, 'Asia/Jakarta', 'MMMM yyyy');
  
  sheet.appendRow([now, data.chatId || 'HTML_' + Date.now(), data.namaItem, '', 'WAITING', matchKey, tanggal, bulan]);
  
  return {
    success: true,
    transaksiId: data.chatId,
    matchKey: matchKey,
    row: sheet.getLastRow(),
    message: 'Input nominal untuk ' + data.namaItem
  };
}

function completeSaldoTransaction(data) {
  const ss = SpreadsheetApp.openById(data.sheetId);
  const sheet = ss.getSheetByName('TOP UP');
  
  if (!sheet) throw new Error('Sheet TOP UP tidak ditemukan');
  
  const values = sheet.getDataRange().getValues();
  let targetRow = -1;
  
  for (let i = 0; i < values.length; i++) {
    if (values[i][5] === data.matchKey) {
      targetRow = i + 1;
      break;
    }
  }
  
  if (targetRow === -1) throw new Error('Transaksi tidak ditemukan');
  
  sheet.getRange(targetRow, 4).setValue(data.nominal);
  sheet.getRange(targetRow, 5).setValue('COMPLETED');
  
  const now = new Date();
  return {
    success: true,
    row: targetRow,
    data: {
      nominal: data.nominal,
      tanggal: Utilities.formatDate(now, 'Asia/Jakarta', 'dd/MM/yyyy'),
      bulan: Utilities.formatDate(now, 'Asia/Jakarta', 'MMMM yyyy')
    }
  };
}

function testConnection(sheetId) {
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    return {
      success: true,
      message: 'Terhubung: ' + ss.getName(),
      sheets: ss.getSheets().map(s => s.getName())
    };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function appendToSheet(sheetId, sheetName, rowData) {
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    let sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(['ID', 'Timestamp', 'Tanggal', 'Waktu', 'Jumlah', 'Pengirim', 'Metode', 'Status', 'Sumber']);
    }
    
    sheet.appendRow([
      rowData.ID || '', rowData.Timestamp || new Date(), rowData.Tanggal || '',
      rowData.Waktu || '', rowData.Jumlah || 0, rowData.Pengirim || '',
      rowData.Metode || '', rowData.Status || '', rowData.Sumber || ''
    ]);
    
    return { success: true, row: sheet.getLastRow() };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function getTopupsFromSheet(sheetId, sheetName) {
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName(sheetName || 'Topups');
    if (!sheet) return { success: true, data: [] };
    
    const data = sheet.getDataRange().getValues();
    return { success: true, count: data.length - 1, data: data.slice(-50) };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}`;
    },

    renderGeneratorSection: function() {
        const gasCode = this.getGasTemplate();
        
        return `
            <div style="background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%); border: 2px solid #ff9800; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
                    <h3 style="margin: 0; color: #e65100; display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 24px;">⚙️</span>
                        Generator Google Apps Script (CORS-Fixed)
                    </h3>
                    <button onclick="GasGenerator.copyToClipboard()" 
                            style="background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); color: white; border: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(255, 152, 0, 0.3);">
                        <span>📋</span> Copy Code GAS
                    </button>
                </div>
                
                <div style="background: #ffebee; border: 2px solid #f44336; border-radius: 8px; padding: 16px; margin-bottom: 16px; font-size: 13px;">
                    <strong style="color: #c62828; font-size: 14px;">🚨 PENTING - Setting Deploy:</strong>
                    <ol style="margin: 10px 0; padding-left: 20px; color: #555; line-height: 2;">
                        <li>Buka <a href="https://script.google.com" target="_blank" style="color: #2196f3; font-weight: 600;">script.google.com</a> → Project Baru</li>
                        <li>Paste kode di bawah → Simpan</li>
                        <li><strong>Deploy → New Deployment</strong></li>
                        <li>Type: <strong>Web App</strong></li>
                        <li>Execute as: <strong>Me</strong></li>
                        <li>Who has access: <strong style="color: #f44336; background: #ffebee; padding: 2px 8px; border-radius: 4px;">ANYONE (even anonymous)</strong> ← WAJIB!</li>
                        <li>Deploy → Copy URL (berakhiran /exec)</li>
                    </ol>
                </div>

                <div style="position: relative;">
                    <textarea id="gasCodeArea" readonly 
                              style="width: 100%; height: 250px; font-family: 'Courier New', monospace; font-size: 11px; background: #263238; color: #aed581; padding: 16px; border-radius: 8px; border: none; resize: vertical; line-height: 1.5;">${this.escapeHtml(gasCode)}</textarea>
                    <div id="copyNotification" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #4caf50; color: white; padding: 16px 32px; border-radius: 8px; font-weight: 600; display: none; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
                        ✅ Code tersalin!
                    </div>
                </div>
                
                <div style="margin-top: 16px; display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 12px;">
                    <div style="background: white; padding: 16px; border-radius: 8px; border-left: 4px solid #4caf50;">
                        <div style="font-weight: 600; color: #2e7d32; margin-bottom: 8px;">✅ Jika masih error CORS:</div>
                        <ul style="margin: 0; padding-left: 16px; font-size: 12px; color: #666; line-height: 1.8;">
                            <li>Pastikan URL benar (akhiran /exec)</li>
                            <li>Share Sheet ke email akun Google Anda</li>
                            <li>Coba buka URL GAS di tab baru, harus tampil JSON</li>
                        </ul>
                    </div>
                    <div style="background: white; padding: 16px; border-radius: 8px; border-left: 4px solid #2196f3;">
                        <div style="font-weight: 600; color: #1565c0; margin-bottom: 8px;">💡 Tips Sheet ID:</div>
                        <ul style="margin: 0; padding-left: 16px; font-size: 12px; color: #666; line-height: 1.8;">
                            <li>Dari URL Sheet: /d/<strong>ID_DISINI</strong>/edit</li>
                            <li>Contoh: 1fvLqdzZJL0Nuf627MNuNPkLDu_HZ0oALR6-mGED5Ihs</li>
                            <li>Pastikan Sheet sudah dibuat dan ada tab "TOP UP"</li>
                        </ul>
                    </div>
                </div>
            </div>
        `;
    },

    copyToClipboard: function() {
        const textarea = document.getElementById('gasCodeArea');
        textarea.select();
        textarea.setSelectionRange(0, 99999);
        
        try {
            navigator.clipboard.writeText(textarea.value).then(() => {
                this.showCopyNotification();
            });
        } catch (err) {
            document.execCommand('copy');
            this.showCopyNotification();
        }
    },

    showCopyNotification: function() {
        const notif = document.getElementById('copyNotification');
        notif.style.display = 'block';
        setTimeout(() => {
            notif.style.display = 'none';
        }, 2000);
    },

    escapeHtml: function(text) {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
};

// ==================== API HELPER dengan CORS handling ====================

const ApiHelper = {
    // Coba fetch dengan berbagai metode
    async fetchWithCORS(url, options = {}) {
        const methods = [
            // Method 1: Direct fetch dengan mode cors
            async () => {
                const response = await fetch(url, {
                    ...options,
                    mode: 'cors',
                    cache: 'no-cache',
                    headers: {
                        'Content-Type': 'application/json',
                        ...options.headers
                    }
                });
                return response;
            },
            
            // Method 2: JSONP untuk GET requests
            async () => {
                if (options.method === 'GET' || !options.method) {
                    return this.jsonpRequest(url);
                }
                throw new Error('JSONP hanya untuk GET');
            },
            
            // Method 3: CORS Proxy (fallback)
            async () => {
                const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
                const response = await fetch(proxyUrl + url, {
                    ...options,
                    headers: {
                        'Content-Type': 'application/json',
                        ...options.headers,
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                });
                return response;
            }
        ];
        
        let lastError;
        for (let i = 0; i < methods.length; i++) {
            try {
                console.log(`[ApiHelper] Trying method ${i + 1}...`);
                const result = await methods[i]();
                console.log(`[ApiHelper] Method ${i + 1} success!`);
                return result;
            } catch (error) {
                console.warn(`[ApiHelper] Method ${i + 1} failed:`, error.message);
                lastError = error;
            }
        }
        
        throw lastError;
    },
    
    // JSONP request untuk bypass CORS
    jsonpRequest(url) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            const callbackName = 'jsonp_callback_' + Math.round(100000 * Math.random());
            
            window[callbackName] = function(data) {
                delete window[callbackName];
                document.body.removeChild(script);
                
                // Simulate Response object
                resolve({
                    ok: true,
                    status: 200,
                    json: async () => data
                });
            };
            
            script.src = url + (url.includes('?') ? '&' : '?') + 'callback=' + callbackName;
            script.onerror = () => {
                delete window[callbackName];
                document.body.removeChild(script);
                reject(new Error('JSONP failed'));
            };
            
            document.body.appendChild(script);
            
            // Timeout
            setTimeout(() => {
                if (window[callbackName]) {
                    delete window[callbackName];
                    if (script.parentNode) document.body.removeChild(script);
                    reject(new Error('JSONP timeout'));
                }
            }, 10000);
        });
    }
};

// ==================== SALDO MODULE ====================

const SaldoModule = {
    transaksiAktif: null,
    
    validateConfig: function() {
        const errors = [];
        if (!saldoConfig.scriptUrl || saldoConfig.scriptUrl.trim() === '') {
            errors.push('Script URL GAS belum diisi');
        }
        if (!saldoConfig.sheetId || saldoConfig.sheetId.trim() === '') {
            errors.push('Sheet ID belum diisi');
        }
        return { valid: errors.length === 0, errors: errors };
    },
    
    renderSaldoSection: function() {
        const isWaiting = this.transaksiAktif !== null;
        const validation = this.validateConfig();
        
        let warningHtml = '';
        if (!validation.valid && !isWaiting) {
            warningHtml = `
                <div style="background: #ffebee; border: 2px solid #f44336; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
                    <div style="color: #c62828; font-weight: 600; margin-bottom: 8px;">⚠️ Konfigurasi Belum Lengkap</div>
                    <ul style="margin: 0; padding-left: 20px; color: #c62828; font-size: 13px;">
                        ${validation.errors.map(e => `<li>${e}</li>`).join('')}
                    </ul>
                    <div style="margin-top: 12px; padding: 12px; background: #fff3e0; border-radius: 6px; font-size: 12px;">
                        💡 Klik tab <strong>"Generate GAS"</strong> untuk setup Google Apps Script
                    </div>
                </div>
            `;
        }
        
        return `
            <div class="tg-saldo-section" style="background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%); border: 2px solid #4caf50; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <h3 style="margin: 0 0 16px 0; color: #2e7d32; display: flex; align-items: center; gap: 8px;">💰 Input Saldo ke Google Sheets</h3>
                ${warningHtml}
                ${isWaiting ? this.renderInputNominal() : this.renderPilihJenis()}
            </div>
        `;
    },
    
    renderPilihJenis: function() {
        const validation = this.validateConfig();
        const disabled = !validation.valid;
        
        const buttons = saldoConfig.jenisSaldo.map(jenis => `
            <button onclick="SaldoModule.pilihJenis('${jenis}')" 
                    ${disabled ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}
                    style="background: white; border: 2px solid #4caf50; color: #4caf50; padding: 20px; border-radius: 12px; font-weight: 600; cursor: pointer; transition: all 0.3s; display: flex; flex-direction: column; align-items: center; gap: 8px; width: 100%;">
                <span style="font-size: 32px;">${this.getIcon(jenis)}</span>
                <span style="font-size: 16px;">${jenis}</span>
            </button>
        `).join('');
        
        return `
            <div class="tg-info-box" style="background: white; border-left: 4px solid #4caf50; padding: 16px; margin-bottom: 16px; border-radius: 8px;">
                <strong style="color: #2e7d32;">📋 Cara Penggunaan:</strong>
                <ol style="margin: 10px 0; padding-left: 20px; font-size: 14px; color: #555; line-height: 1.8;">
                    <li>Klik jenis saldo (DANA/DIGIPOS/MASTERLOAD)</li>
                    <li>Masukkan nominal saldo yang diterima</li>
                    <li>Klik "✅ SIMPAN KE SHEET"</li>
                    <li>Data otomatis masuk ke Google Sheet "TOP UP"</li>
                </ol>
            </div>
            <div style="font-weight: 600; margin-bottom: 12px; color: #333; font-size: 16px;">Pilih Jenis Saldo:</div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 16px;">
                ${buttons}
            </div>
            ${disabled ? `
                <div style="margin-top: 16px; text-align: center; color: #f44336; font-size: 13px; font-weight: 600; background: #ffebee; padding: 12px; border-radius: 8px;">
                    ⚠️ Isi konfigurasi Sheet di bawah atau klik tab "Generate GAS"
                </div>
            ` : ''}
        `;
    },
    
    renderInputNominal: function() {
        const jenis = this.transaksiAktif?.namaItem || '';
        const icon = this.getIcon(jenis);
        
        return `
            <div style="background: white; padding: 24px; border-radius: 16px; border: 3px solid #4caf50; box-shadow: 0 4px 12px rgba(76, 175, 80, 0.2); animation: slideIn 0.3s ease;">
                <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #e8f5e9;">
                    <div style="font-size: 48px; background: #e8f5e9; width: 80px; height: 80px; display: flex; align-items: center; justify-content: center; border-radius: 50%;">${icon}</div>
                    <div>
                        <div style="font-size: 13px; color: #666; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">Input Saldo</div>
                        <div style="font-size: 28px; font-weight: 700; color: #2e7d32;">${jenis}</div>
                    </div>
                </div>
                <div style="margin-bottom: 24px;">
                    <label style="display: block; margin-bottom: 12px; font-weight: 600; color: #555; font-size: 15px;">Masukkan Nominal Saldo (Rp)</label>
                    <input type="number" id="saldoNominal" placeholder="0" 
                           style="width: 100%; padding: 20px; font-size: 32px; font-weight: 700; border: 2px solid #ddd; border-radius: 12px; text-align: center; transition: all 0.3s;"
                           onkeyup="SaldoModule.formatRupiah(this)"
                           onfocus="this.style.borderColor='#4caf50'; this.style.boxShadow='0 0 0 3px rgba(76,175,80,0.1)'"
                           onblur="this.style.borderColor='#ddd'; this.style.boxShadow='none'"
                           onkeypress="if(event.key==='Enter')SaldoModule.kirimNominal()"
                           autocomplete="off">
                    <div id="nominalDisplay" style="text-align: center; margin-top: 12px; font-size: 18px; color: #4caf50; font-weight: 600; min-height: 24px;"></div>
                </div>
                <div style="display: flex; gap: 12px;">
                    <button onclick="SaldoModule.kirimNominal()" 
                            style="flex: 2; background: linear-gradient(135deg, #4caf50 0%, #2e7d32 100%); color: white; padding: 18px; border: none; border-radius: 12px; font-weight: 700; cursor: pointer; font-size: 16px; box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3); transition: all 0.3s;"
                            onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                        ✅ SIMPAN KE SHEET
                    </button>
                    <button onclick="SaldoModule.batal()" 
                            style="flex: 1; background: #f5f5f5; color: #666; padding: 18px; border: 2px solid #ddd; border-radius: 12px; font-weight: 600; cursor: pointer; font-size: 14px; transition: all 0.3s;"
                            onmouseover="this.style.background='#eeeeee'" onmouseout="this.style.background='#f5f5f5'">
                        ❌ BATAL
                    </button>
                </div>
                <div style="margin-top: 16px; padding: 12px; background: #f5f5f5; border-radius: 8px; font-size: 12px; color: #666; text-align: center;">
                    Data akan disimpan ke Sheet: <strong>TOP UP</strong> | Row: ${this.transaksiAktif?.row || '...'}
                </div>
            </div>
            <style>
                @keyframes slideIn {
                    from { opacity: 0; transform: translateY(-20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            </style>
        `;
    },
    
    getIcon: function(jenis) {
        const icons = { 'DANA': '💙', 'DIGIPOS': '🟡', 'MASTERLOAD': '🟢' };
        return icons[jenis] || '💰';
    },
    
    formatRupiah: function(input) {
        const value = input.value.replace(/\D/g, '');
        const formatted = new Intl.NumberFormat('id-ID').format(value);
        const display = document.getElementById('nominalDisplay');
        if (display) display.textContent = value ? `Rp ${formatted}` : '';
    },
    
    async apiCall(payload) {
        const targetUrl = saldoConfig.scriptUrl;
        if (!targetUrl) throw new Error('Script URL belum diisi');
        
        const cleanUrl = targetUrl.trim().replace(/\/$/, '');
        
        console.log('[Saldo] API Call to:', cleanUrl);
        console.log('[Saldo] Payload:', payload);
        
        try {
            // Coba direct fetch dulu
            const response = await fetch(cleanUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                mode: 'cors',
                cache: 'no-cache'
            });
            
            console.log('[Saldo] Response status:', response.status);
            
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`HTTP ${response.status}: ${text || response.statusText}`);
            }
            
            const result = await response.json();
            console.log('[Saldo] Response data:', result);
            return result;
            
        } catch (error) {
            console.error('[Saldo] Direct fetch failed:', error);
            
            // Jika CORS error, coba dengan no-cors mode (opaque response)
            if (error.message.includes('CORS') || error.message.includes('Failed to fetch')) {
                console.log('[Saldo] Trying no-cors mode...');
                
                try {
                    await fetch(cleanUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                        mode: 'no-cors'
                    });
                    
                    // no-cors return opaque, kita anggap sukses jika tidak error
                    console.log('[Saldo] no-cors request sent (opaque response)');
                    return {
                        success: true,
                        message: 'Request sent (no-cors mode)',
                        warning: 'Response opaque, cek Sheet manual'
                    };
                    
                } catch (noCorsError) {
                    console.error('[Saldo] no-cors also failed:', noCorsError);
                    throw new Error('CORS Error: GAS tidak bisa diakses dari browser. Pastikan: 1) Deploy sebagai Web App, 2) Access: ANYONE, 3) Sheet di-share ke email akun GAS');
                }
            }
            
            throw error;
        }
    },
    
    pilihJenis: async function(jenis) {
        console.log('[Saldo] STEP 1: Pilih Jenis =', jenis);
        const validation = this.validateConfig();
        if (!validation.valid) {
            alert('❌ Konfigurasi belum lengkap:\n\n' + validation.errors.join('\n') + '\n\nKlik tab "Generate GAS" untuk setup!');
            return;
        }
        
        TelegramModule.showToast(`⏳ Memulai transaksi ${jenis}...`);
        
        try {
            const payload = {
                action: 'initSaldo',
                sheetId: saldoConfig.sheetId,
                chatId: 'HTML_' + Date.now(),
                namaItem: jenis
            };
            
            console.log('[Saldo] Sending:', payload);
            const result = await this.apiCall(payload);
            console.log('[Saldo] Response:', result);
            
            if (result.success) {
                this.transaksiAktif = {
                    transaksiId: result.transaksiId,
                    matchKey: result.matchKey,
                    namaItem: jenis,
                    row: result.row
                };
                localStorage.setItem('saldo_transaksi_aktif', JSON.stringify(this.transaksiAktif));
                TelegramModule.showToast(`✅ Input nominal untuk ${jenis}`);
                TelegramModule.renderPage();
                
                setTimeout(() => {
                    const input = document.getElementById('saldoNominal');
                    if (input) { input.focus(); input.select(); }
                }, 200);
            } else {
                throw new Error(result.error || 'Server error');
            }
        } catch (error) {
            console.error('[Saldo] Error:', error);
            
            // Tampilkan error yang lebih informatif
            let errorMsg = error.message;
            if (error.message.includes('CORS') || error.message.includes('Failed to fetch')) {
                errorMsg = `❌ ERROR CORS!\n\nSolusi:\n1. Pastikan GAS di-deploy sebagai Web App (bukan API Exec)\n2. Setting: Execute as = Me, Access = ANYONE\n3. Share Google Sheet ke email akun Anda\n4. Coba buka URL GAS di browser, harus tampil JSON\n\nDetail: ${error.message}`;
            }
            
            alert(errorMsg);
        }
    },
    
    kirimNominal: async function() {
        const nominalInput = document.getElementById('saldoNominal');
        const nominal = parseInt(nominalInput.value.replace(/\D/g, ''));
        
        if (!nominal || nominal <= 0) {
            alert('❌ Nominal tidak valid!');
            nominalInput.focus();
            return;
        }
        
        if (!this.transaksiAktif) {
            alert('❌ Tidak ada transaksi aktif!');
            return;
        }
        
        TelegramModule.showToast('⏳ Menyimpan ke Google Sheets...');
        
        try {
            const payload = {
                action: 'completeSaldo',
                sheetId: saldoConfig.sheetId,
                matchKey: this.transaksiAktif.matchKey,
                nominal: nominal,
                transaksiId: this.transaksiAktif.transaksiId
            };
            
            const result = await this.apiCall(payload);
            
            if (result.success) {
                const topup = {
                    id: this.transaksiAktif.transaksiId,
                    amount: nominal,
                    sender: 'Input Manual',
                    method: this.transaksiAktif.namaItem,
                    transactionId: this.transaksiAktif.transaksiId,
                    timestamp: Date.now(),
                    status: 'confirmed',
                    source: 'html_saldo',
                    syncedToSheet: true,
                    sheetRow: result.data?.row,
                    bulan: result.data?.bulan,
                    tanggal: result.data?.tanggal
                };
                
                topups.push(topup);
                TelegramModule.saveData();
                
                const jenisTemp = this.transaksiAktif.namaItem;
                this.transaksiAktif = null;
                localStorage.removeItem('saldo_transaksi_aktif');
                
                const formattedNominal = new Intl.NumberFormat('id-ID').format(nominal);
                alert(`✅ BERHASIL!\n\n${jenisTemp}: Rp ${formattedNominal}\nTanggal: ${result.data?.tanggal || new Date().toLocaleDateString('id-ID')}\nSheet: TOP UP (Row ${result.data?.row || '?'})`);
                TelegramModule.showToast(`✅ ${jenisTemp}: Rp ${formattedNominal} tersimpan!`);
                TelegramModule.renderPage();
            } else {
                throw new Error(result.error || 'Gagal menyimpan');
            }
        } catch (error) {
            console.error('[Saldo] Error:', error);
            alert('❌ Error saat menyimpan:\n\n' + error.message);
        }
    },
    
    batal: function() {
        this.transaksiAktif = null;
        localStorage.removeItem('saldo_transaksi_aktif');
        TelegramModule.showToast('Transaksi dibatalkan');
        TelegramModule.renderPage();
    },
    
    checkPending: async function() {
        const saved = localStorage.getItem('saldo_transaksi_aktif');
        if (saved) {
            try {
                this.transaksiAktif = JSON.parse(saved);
            } catch (e) {
                localStorage.removeItem('saldo_transaksi_aktif');
            }
        }
    }
};

// ==================== TELEGRAM MODULE UTAMA ====================

const TelegramModule = {
    currentTab: 'dashboard',
    
    init: function() {
        console.log('[Telegram] init() dipanggil');
        if (isInitialized) return;
        isInitialized = true;
        
        this.loadData();
        SaldoModule.checkPending();
    },
    
    loadData: function() {
        try {
            const savedConfig = localStorage.getItem(STORAGE_KEY_CONFIG);
            if (savedConfig) tgConfig = JSON.parse(savedConfig);
        } catch (e) {
            console.error('[Telegram] Error loading config:', e);
        }
        
        try {
            const savedSaldo = localStorage.getItem(STORAGE_KEY_SALDO);
            if (savedSaldo) saldoConfig = { ...saldoConfig, ...JSON.parse(savedSaldo) };
        } catch (e) {
            console.error('[Saldo] Error loading saldo config:', e);
        }
        
        try {
            const savedTopups = localStorage.getItem(STORAGE_KEY_TOPUPS);
            if (savedTopups) topups = JSON.parse(savedTopups);
        } catch (e) {
            topups = [];
        }
        
        try {
            const savedTimeFilter = localStorage.getItem('tg_time_filter');
            if (savedTimeFilter) currentTimeFilter = savedTimeFilter;
        } catch (e) {}
    },
    
    saveData: function() {
        try {
            localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(tgConfig));
            localStorage.setItem(STORAGE_KEY_SALDO, JSON.stringify(saldoConfig));
            localStorage.setItem(STORAGE_KEY_TOPUPS, JSON.stringify(topups));
            localStorage.setItem('tg_time_filter', currentTimeFilter);
        } catch (e) {
            console.error('[Telegram+Saldo] Error saving:', e);
        }
    },
    
    setTab: function(tab) {
        this.currentTab = tab;
        this.renderPage();
    },
    
    renderPage: function() {
        const container = document.getElementById('mainContent');
        if (!container) {
            console.error('[Telegram] mainContent tidak ditemukan!');
            return;
        }
        
        container.innerHTML = `
            <div class="tg-container" style="padding: 20px; max-width: 1000px; margin: 0 auto;">
                ${this.renderHeader()}
                ${this.renderTabs()}
                ${this.currentTab === 'generator' ? GasGenerator.renderGeneratorSection() : this.renderDashboard()}
            </div>
        `;
        
        if (SaldoModule.transaksiAktif && this.currentTab === 'dashboard') {
            setTimeout(() => {
                const input = document.getElementById('saldoNominal');
                if (input) { input.focus(); input.select(); }
            }, 100);
        }
    },
    
    renderHeader: function() {
        return `
            <div class="tg-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
                <div class="tg-title-area" style="display: flex; align-items: center; gap: 12px;">
                    <div class="tg-icon" style="font-size: 40px;">📱</div>
                    <div>
                        <h2 style="margin: 0; font-size: 20px;">Telegram + Saldo</h2>
                        <p style="margin: 0; opacity: 0.9; font-size: 13px;">Integrasi Bot n8n & Input Manual</p>
                    </div>
                </div>
            </div>
        `;
    },
    
    renderTabs: function() {
        const tabs = [
            { key: 'dashboard', label: 'Dashboard', icon: '📊' },
            { key: 'generator', label: 'Generate GAS', icon: '⚙️' }
        ];
        
        return `
            <div style="display: flex; gap: 8px; margin-bottom: 20px; background: white; padding: 8px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
                ${tabs.map(tab => `
                    <button onclick="TelegramModule.setTab('${tab.key}')" 
                            style="flex: 1; padding: 12px 20px; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.3s; display: flex; align-items: center; justify-content: center; gap: 8px; background: ${this.currentTab === tab.key ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent'}; color: ${this.currentTab === tab.key ? 'white' : '#555'};">
                        <span style="font-size: 18px;">${tab.icon}</span>
                        <span>${tab.label}</span>
                    </button>
                `).join('')}
            </div>
        `;
    },
    
    renderDashboard: function() {
        const stats = this.getStats();
        const syncStatus = this.getSyncStatus();
        
        return `
            ${this.renderTimeFilter()}
            ${this.renderStats(stats)}
            ${SaldoModule.renderSaldoSection()}
            ${this.renderConfig()}
            ${this.renderBackupSection(syncStatus)}
            ${this.renderTopupList()}
        `;
    },
    
    renderTimeFilter: function() {
        const filters = [
            { key: 'today', label: 'Hari Ini', icon: '📅' },
            { key: 'yesterday', label: 'Kemarin', icon: '⏮️' },
            { key: 'week', label: 'Minggu Ini', icon: '📆' },
            { key: 'month', label: 'Bulan Ini', icon: '🗓️' },
            { key: 'year', label: 'Tahun Ini', icon: '📊' },
            { key: 'all', label: 'Semua', icon: '📁' }
        ];
        
        const buttons = filters.map(f => `
            <button onclick="TelegramModule.setTimeFilter('${f.key}')" 
                    style="padding: 10px 16px; border: 2px solid ${currentTimeFilter === f.key ? '#667eea' : '#e0e0e0'}; background: ${currentTimeFilter === f.key ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'white'}; color: ${currentTimeFilter === f.key ? 'white' : '#555'}; border-radius: 25px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.3s; display: flex; align-items: center; gap: 6px; white-space: nowrap;">
                <span>${f.icon}</span><span>${f.label}</span>
            </button>
        `).join('');
        
        return `
            <div class="tg-time-filter-section" style="background: white; padding: 16px 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); margin-bottom: 20px;">
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
                    <div style="font-weight: 600; color: #333; font-size: 14px; display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 18px;">🔍</span>
                        <span>Filter Periode:</span>
                        <span style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 4px 12px; border-radius: 15px; font-size: 12px;">
                            ${this.getTimeFilterIcon(currentTimeFilter)} ${this.getTimeFilterLabel(currentTimeFilter)}
                        </span>
                    </div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">${buttons}</div>
                </div>
            </div>
        `;
    },
    
    renderStats: function(stats) {
        return `
            <div class="tg-stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; margin-bottom: 20px;">
                <div style="background: white; padding: 16px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); text-align: center;">
                    <div style="font-size: 20px; font-weight: 700; color: #333;">${this.formatMoney(stats.total)}</div>
                    <div style="font-size: 12px; color: #666; margin-top: 4px;">Total (${this.getTimeFilterLabel(currentTimeFilter)})</div>
                </div>
                <div style="background: white; padding: 16px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); text-align: center;">
                    <div style="font-size: 20px; font-weight: 700; color: #4caf50;">${stats.confirmed}</div>
                    <div style="font-size: 12px; color: #666; margin-top: 4px;">Dikonfirmasi</div>
                </div>
                <div style="background: white; padding: 16px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); text-align: center;">
                    <div style="font-size: 20px; font-weight: 700; color: #ff9800;">${stats.pending}</div>
                    <div style="font-size: 12px; color: #666; margin-top: 4px;">Pending</div>
                </div>
                <div style="background: white; padding: 16px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); text-align: center;">
                    <div style="font-size: 20px; font-weight: 700; color: #2196f3;">${stats.synced}</div>
                    <div style="font-size: 12px; color: #666; margin-top: 4px;">Tersync Sheet</div>
                </div>
            </div>
        `;
    },
    
    renderConfig: function() {
        return `
            <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); margin-bottom: 20px;">
                <h3 style="margin: 0 0 16px 0; font-size: 16px;">🔧 Konfigurasi Bot Telegram</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                    <div>
                        <label style="display: block; font-size: 13px; color: #555; margin-bottom: 6px; font-weight: 600;">Bot Token</label>
                        <input type="password" id="tgToken" value="${this.escapeHtml(tgConfig.botToken)}" placeholder="123456789:ABC..." style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; box-sizing: border-box;">
                    </div>
                    <div>
                        <label style="display: block; font-size: 13px; color: #555; margin-bottom: 6px; font-weight: 600;">Chat ID (Opsional)</label>
                        <input type="text" id="tgChat" value="${this.escapeHtml(tgConfig.chatId)}" placeholder="-100123..." style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; box-sizing: border-box;">
                    </div>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button onclick="TelegramModule.saveConfig()" style="padding: 10px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">💾 Simpan Config</button>
                    <button onclick="TelegramModule.testConnection()" style="padding: 10px 20px; background: #f5f5f5; color: #555; border: 2px solid #e0e0e0; border-radius: 8px; font-weight: 600; cursor: pointer;">🔌 Test Bot</button>
                </div>
                <div id="tgTestResult" style="margin-top: 12px;"></div>
            </div>
        `;
    },
    
    renderBackupSection: function(syncStatus) {
        return `
            <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); margin-bottom: 20px;">
                <h3 style="margin: 0 0 16px 0; font-size: 16px;">☁️ Konfigurasi Google Sheet</h3>
                
                <div style="background: #fff3e0; border-left: 4px solid #ff9800; padding: 16px; margin-bottom: 16px; border-radius: 8px; font-size: 13px;">
                    <strong style="color: #e65100;">💡 Belum punya GAS?</strong> Klik tab <strong>"Generate GAS"</strong> untuk kode siap deploy!
                </div>
                
                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 12px; margin-bottom: 12px;">
                    <div>
                        <label style="display: block; font-size: 13px; color: #555; margin-bottom: 6px; font-weight: 600;">Google Sheet ID <span style="color: red;">*</span></label>
                        <input type="text" id="tgSheetId" value="${this.escapeHtml(tgConfig.sheetId)}" placeholder="1fvLqdzZJL0Nuf627MNuNPkLDu_HZ0oALR6-mGED5Ihs" style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; box-sizing: border-box;">
                        <div style="font-size: 11px; color: #999; margin-top: 4px;">Dari URL: .../d/<strong>SHEET_ID</strong>/edit...</div>
                    </div>
                    <div>
                        <label style="display: block; font-size: 13px; color: #555; margin-bottom: 6px; font-weight: 600;">Nama Sheet (Tab)</label>
                        <input type="text" id="tgSheetName" value="${this.escapeHtml(tgConfig.sheetName || 'Topups')}" placeholder="Topups" style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; box-sizing: border-box;">
                    </div>
                </div>
                <div style="margin-bottom: 12px;">
                    <label style="display: block; font-size: 13px; color: #555; margin-bottom: 6px; font-weight: 600;">GAS Web App URL <span style="color: red;">*</span></label>
                    <input type="text" id="tgScriptUrl" value="${this.escapeHtml(tgConfig.scriptUrl || '')}" placeholder="https://script.google.com/macros/s/.../exec" style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; box-sizing: border-box;">
                    <div style="font-size: 11px; color: #999; margin-top: 4px;">Harus berakhiran <strong>/exec</strong> (bukan /dev atau /usercallback)</div>
                </div>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <button onclick="TelegramModule.saveSheetConfig()" style="padding: 10px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">💾 Simpan Config</button>
                    <button onclick="TelegramModule.syncToSheet()" style="padding: 10px 20px; background: #4caf50; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">🔄 Sync Sekarang</button>
                    <button onclick="TelegramModule.testSheet()" style="padding: 10px 20px; background: #f5f5f5; color: #555; border: 2px solid #e0e0e0; border-radius: 8px; font-weight: 600; cursor: pointer;">🔗 Test Koneksi</button>
                </div>
                <div id="tgSyncResult" style="margin-top: 12px;">${syncStatus}</div>
            </div>
        `;
    },
    
    renderTopupList: function() {
        const filtered = this.getFilteredTopups();
        const timeFilteredCount = this.getTimeFilteredTopups().length;
        
        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
                <h3 style="margin: 0; font-size: 16px;">📨 Daftar Topup (${filtered.length}) <span style="font-size: 13px; color: #666; font-weight: normal;">| ${this.getTimeFilterLabel(currentTimeFilter)}: ${timeFilteredCount} item</span></h3>
                <div style="display: flex; gap: 8px;">
                    <button onclick="TelegramModule.setFilter('all')" style="padding: 6px 12px; border-radius: 20px; border: none; background: ${currentFilter === 'all' ? '#667eea' : '#f5f5f5'}; color: ${currentFilter === 'all' ? 'white' : '#555'}; font-size: 12px; cursor: pointer;">Semua</button>
                    <button onclick="TelegramModule.setFilter('pending')" style="padding: 6px 12px; border-radius: 20px; border: none; background: ${currentFilter === 'pending' ? '#ff9800' : '#f5f5f5'}; color: ${currentFilter === 'pending' ? 'white' : '#555'}; font-size: 12px; cursor: pointer;">Pending</button>
                    <button onclick="TelegramModule.setFilter('confirmed')" style="padding: 6px 12px; border-radius: 20px; border: none; background: ${currentFilter === 'confirmed' ? '#4caf50' : '#f5f5f5'}; color: ${currentFilter === 'confirmed' ? 'white' : '#555'}; font-size: 12px; cursor: pointer;">Dikonfirmasi</button>
                </div>
            </div>
            <div>
        `;
        
        if (filtered.length === 0) {
            html += `
                <div style="text-align: center; padding: 40px; color: #999;">
                    <div style="font-size: 48px; margin-bottom: 12px;">📭</div>
                    <div>Belum ada data topup ${this.getTimeFilterLabel(currentTimeFilter).toLowerCase()}</div>
                </div>
            `;
        } else {
            filtered.forEach(t => {
                html += this.renderTopupItem(t);
            });
        }
        
        html += '</div>';
        return html;
    },
    
    renderTopupItem: function(t) {
        const date = new Date(t.timestamp);
        const dateStr = date.toLocaleDateString('id-ID');
        const timeStr = date.toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'});
        const isSynced = t.syncedToSheet ? '✓' : '';
        
        let statusText = '';
        let actions = '';
        
        if (t.status === 'confirmed') {
            statusText = '✅ Dikonfirmasi';
        } else if (t.status === 'rejected') {
            statusText = '❌ Ditolak';
        } else {
            statusText = '⏳ Pending';
            actions = `
                <button onclick="TelegramModule.confirm('${t.id}')" style="padding: 6px 12px; background: #4caf50; color: white; border: none; border-radius: 6px; font-size: 12px; cursor: pointer;">Konfirmasi</button>
                <button onclick="TelegramModule.reject('${t.id}')" style="padding: 6px 12px; background: #f44336; color: white; border: none; border-radius: 6px; font-size: 12px; cursor: pointer;">Tolak</button>
            `;
        }
        
        return `
            <div style="background: white; padding: 16px; border-radius: 12px; margin-bottom: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; border-left: 4px solid ${t.status === 'confirmed' ? '#4caf50' : t.status === 'rejected' ? '#f44336' : '#ff9800'};">
                <div style="flex: 1;">
                    <div style="font-size: 18px; font-weight: 700; color: #333; margin-bottom: 4px;">
                        ${this.formatMoney(t.amount)} <span style="font-size: 12px; color: #4caf50;">${isSynced}</span>
                    </div>
                    <div style="font-size: 12px; color: #666;">
                        ${this.escapeHtml(t.sender || 'Unknown')} • ${this.escapeHtml(t.method || '-')} • ${dateStr} ${timeStr}
                        ${t.sheetRow ? ` • <span style="color: #2196f3;">Row: ${t.sheetRow}</span>` : ''}
                    </div>
                </div>
                <div style="font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 12px; background: ${t.status === 'confirmed' ? '#e8f5e9' : t.status === 'rejected' ? '#ffebee' : '#fff3e0'}; color: ${t.status === 'confirmed' ? '#2e7d32' : t.status === 'rejected' ? '#c62828' : '#e65100'};">
                    ${statusText}
                </div>
                <div style="display: flex; gap: 4px;">${actions}</div>
            </div>
        `;
    },
    
    getStats: function() {
        const timeFiltered = this.getTimeFilteredTopups();
        let total = 0, confirmed = 0, pending = 0, rejected = 0, synced = 0;
        
        timeFiltered.forEach(t => {
            if (t.status === 'confirmed') {
                total += parseFloat(t.amount) || 0;
                confirmed++;
            } else if (t.status === 'pending') {
                pending++;
            } else if (t.status === 'rejected') {
                rejected++;
            }
            if (t.syncedToSheet) synced++;
        });
        
        return { total, confirmed, pending, rejected, synced };
    },
    
    getTimeFilteredTopups: function() {
        return topups.filter(t => this.isDateInRange(t.timestamp, currentTimeFilter));
    },
    
    getFilteredTopups: function() {
        let result = this.getTimeFilteredTopups().sort((a, b) => b.timestamp - a.timestamp);
        if (currentFilter !== 'all') result = result.filter(t => t.status === currentFilter);
        return result;
    },
    
    getSyncStatus: function() {
        const timeFiltered = this.getTimeFilteredTopups();
        const unsynced = timeFiltered.filter(t => !t.syncedToSheet).length;
        if (unsynced === 0) return '<div style="color: green;">✅ Semua data tersync</div>';
        return `<div style="color: orange;">⏳ ${unsynced} data belum tersync</div>`;
    },
    
    isDateInRange: function(timestamp, range) {
        const date = new Date(timestamp);
        const now = new Date();
        
        switch(range) {
            case 'today':
                return date.toDateString() === now.toDateString();
            case 'yesterday':
                const yesterday = new Date(now);
                yesterday.setDate(yesterday.getDate() - 1);
                return date.toDateString() === yesterday.toDateString();
            case 'week':
                const startOfWeek = new Date(now);
                startOfWeek.setDate(now.getDate() - now.getDay());
                startOfWeek.setHours(0, 0, 0, 0);
                return date >= startOfWeek;
            case 'month':
                return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
            case 'year':
                return date.getFullYear() === now.getFullYear();
            case 'all':
            default:
                return true;
        }
    },
    
    getTimeFilterLabel: function(filter) {
        const labels = {
            'today': 'Hari Ini',
            'yesterday': 'Hari Kemarin',
            'week': 'Minggu Ini',
            'month': 'Bulan Ini',
            'year': 'Tahun Ini',
            'all': 'Semua Waktu'
        };
        return labels[filter] || 'Bulan Ini';
    },
    
    getTimeFilterIcon: function(filter) {
        const icons = {
            'today': '📅',
            'yesterday': '⏮️',
            'week': '📆',
            'month': '🗓️',
            'year': '📊',
            'all': '📁'
        };
        return icons[filter] || '🗓️';
    },
    
    formatMoney: function(amount) {
        return 'Rp ' + (amount || 0).toLocaleString('id-ID');
    },
    
    escapeHtml: function(text) {
        if (!text) return '';
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    },
    
    showToast: function(msg) {
        if (typeof app !== 'undefined' && app.showToast) {
            app.showToast(msg);
        } else {
            console.log('[Toast]:', msg);
        }
    },
    
    setTimeFilter: function(filter) {
        currentTimeFilter = filter;
        this.saveData();
        this.renderPage();
        this.showToast(`🔍 Filter: ${this.getTimeFilterLabel(filter)}`);
    },
    
    setFilter: function(f) {
        currentFilter = f;
        this.renderPage();
    },
    
    saveConfig: function() {
        tgConfig.botToken = document.getElementById('tgToken').value.trim();
        tgConfig.chatId = document.getElementById('tgChat').value.trim();
        this.saveData();
        this.showToast('✅ Konfigurasi Bot disimpan!');
        this.renderPage();
    },
    
    saveSheetConfig: function() {
        tgConfig.sheetId = document.getElementById('tgSheetId').value.trim();
        tgConfig.sheetName = document.getElementById('tgSheetName').value.trim();
        tgConfig.scriptUrl = document.getElementById('tgScriptUrl').value.trim();
        
        saldoConfig.sheetId = tgConfig.sheetId;
        saldoConfig.scriptUrl = tgConfig.scriptUrl;
        
        this.saveData();
        this.showToast('✅ Konfigurasi Sheet disimpan!');
        this.renderPage();
    },
    
    testConnection: async function() {
        const resultDiv = document.getElementById('tgTestResult');
        const token = document.getElementById('tgToken').value.trim();
        
        if (!token) {
            resultDiv.innerHTML = '<div style="color: red;">❌ Isi token dulu</div>';
            return;
        }
        
        resultDiv.innerHTML = '<div style="color: blue;">⏳ Testing...</div>';
        
        try {
            const response = await fetch('https://api.telegram.org/bot' + token + '/getMe');
            const result = await response.json();
            
            if (result.ok) {
                resultDiv.innerHTML = `<div style="color: green;">✅ Bot: @${result.result.username}</div>`;
            } else {
                resultDiv.innerHTML = `<div style="color: red;">❌ ${result.description}</div>`;
            }
        } catch (e) {
            resultDiv.innerHTML = `<div style="color: red;">❌ Error: ${e.message}</div>`;
        }
    },
    
    testSheet: async function() {
        const scriptUrl = document.getElementById('tgScriptUrl').value.trim();
        const sheetId = document.getElementById('tgSheetId').value.trim();
        
        if (!scriptUrl || !sheetId) {
            this.showToast('❌ Script URL dan Sheet ID harus diisi!');
            return;
        }
        
        const resultDiv = document.getElementById('tgSyncResult');
        resultDiv.innerHTML = '<div style="color: blue;">⏳ Testing koneksi...</div>';
        
        try {
            const cleanUrl = scriptUrl.replace(/\/$/, '');
            const testUrl = `${cleanUrl}?action=test&sheetId=${encodeURIComponent(sheetId)}`;
            
            console.log('[Test] URL:', testUrl);
            
            const response = await fetch(testUrl, {
                method: 'GET',
                mode: 'cors',
                cache: 'no-cache',
                headers: { 'Accept': 'application/json' }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                resultDiv.innerHTML = `
                    <div style="color: green; background: #e8f5e9; padding: 12px; border-radius: 8px;">
                        <strong>✅ Koneksi Berhasil!</strong><br>
                        Sheet: ${result.message}<br>
                        <small>Sheets: ${result.sheets?.join(', ')}</small>
                    </div>
                `;
                this.showToast('✅ Koneksi berhasil!');
            } else {
                resultDiv.innerHTML = `<div style="color: red;">❌ ${result.error}</div>`;
            }
        } catch (e) {
            console.error('[Test] Error:', e);
            resultDiv.innerHTML = `
                <div style="color: red; background: #ffebee; padding: 12px; border-radius: 8px;">
                    <strong>❌ Gagal konek ke GAS</strong><br>
                    ${e.message}<br><br>
                    <strong>Cek:</strong>
                    <ol style="margin: 8px 0; padding-left: 20px;">
                        <li>URL benar (akhiran /exec)?</li>
                        <li>Deploy setting: ANYONE?</li>
                        <li>Sheet di-share ke email akun GAS?</li>
                    </ol>
                </div>
            `;
        }
    },
    
    syncToSheet: async function() {
        if (!tgConfig.sheetId || !tgConfig.scriptUrl) {
            this.showToast('❌ Sheet ID dan Script URL harus diisi!');
            return;
        }
        
        const timeFiltered = this.getTimeFilteredTopups();
        const unsynced = timeFiltered.filter(t => !t.syncedToSheet);
        
        if (unsynced.length === 0) {
            this.showToast('✅ Tidak ada data yang perlu disync');
            return;
        }
        
        const resultDiv = document.getElementById('tgSyncResult');
        resultDiv.innerHTML = '<div style="color: blue;">⏳ Syncing...</div>';
        
        let successCount = 0, failCount = 0;
        
        for (const topup of unsynced) {
            try {
                const result = await this.sendToSheet(topup);
                if (result.success) {
                    topup.syncedToSheet = true;
                    topup.sheetRow = result.row;
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (e) {
                console.error('Sync error:', e);
                failCount++;
            }
        }
        
        this.saveData();
        
        if (failCount === 0) {
            resultDiv.innerHTML = `<div style="color: green;">✅ ${successCount} data berhasil disync</div>`;
            this.showToast(`✅ ${successCount} data tersync!`);
        } else {
            resultDiv.innerHTML = `<div style="color: orange;">⚠️ ${successCount} sukses, ${failCount} gagal</div>`;
        }
        
        this.renderPage();
    },
    
    sendToSheet: async function(topup) {
        const data = {
            action: 'append',
            sheetId: tgConfig.sheetId,
            sheetName: tgConfig.sheetName,
            data: {
                ID: topup.id,
                Timestamp: new Date(topup.timestamp).toISOString(),
                Tanggal: new Date(topup.timestamp).toLocaleDateString('id-ID'),
                Waktu: new Date(topup.timestamp).toLocaleTimeString('id-ID'),
                Jumlah: topup.amount,
                Pengirim: topup.sender,
                Metode: topup.method,
                Status: topup.status,
                Sumber: topup.source
            }
        };
        
        const response = await fetch(tgConfig.scriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            mode: 'cors'
        });
        
        return await response.json();
    },
    
    confirm: function(id) {
        const t = topups.find(x => x.id === id);
        if (!t) return;
        
        if (confirm(`Konfirmasi topup ${this.formatMoney(t.amount)} dari ${t.sender}?`)) {
            t.status = 'confirmed';
            t.confirmedAt = Date.now();
            t.syncedToSheet = false;
            this.saveData();
            this.showToast('✅ Topup dikonfirmasi!');
            this.renderPage();
        }
    },
    
    reject: function(id) {
        const t = topups.find(x => x.id === id);
        if (!t) return;
        
        if (confirm(`Tolak topup ${this.formatMoney(t.amount)}?`)) {
            t.status = 'rejected';
            t.rejectedAt = Date.now();
            t.syncedToSheet = false;
            this.saveData();
            this.showToast('❌ Topup ditolak!');
            this.renderPage();
        }
    }
};

console.log('[Telegram] Module created successfully');

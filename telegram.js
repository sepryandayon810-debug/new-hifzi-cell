/**
 * Telegram Bot Integration Module + SALDO INTEGRATION
 * VERSI GITHUB PAGES - Tanpa proxy, CORS normal
 * UPDATE: Tambahan Filter Waktu (Hari Ini, Minggu Ini, Bulan Ini, Tahun Ini)
 */

const TelegramModule = (function() {
    'use strict';
    
    // Storage keys
    const STORAGE_KEY_CONFIG = 'tg_standalone_config';
    const STORAGE_KEY_TOPUPS = 'tg_standalone_topups';
    const STORAGE_KEY_SALDO = 'tg_saldo_config';
    
    // State
    let config = {
        botToken: '',
        chatId: '',
        webhookUrl: '',
        secretKey: '',
        sheetId: '',
        sheetName: 'Topups',
        scriptUrl: '',
        isPolling: false,
        lastSync: 0
    };
    
    // Konfigurasi Saldo
    let saldoConfig = {
        jenisSaldo: ['DANA', 'DIGIPOS', 'MASTERLOAD'],
        sheetId: '1fvLqdzZJL0Nuf627MNuNPkLDu_HZ0oALR6-mGED5Ihs',
        sheetTopup: 'TOP UP',
        sheetStep: 'STEP',
        scriptUrl: ''
    };
    
    let topups = [];
    let currentFilter = 'all';
    let currentTimeFilter = 'month'; // 'today', 'week', 'month', 'year', 'all'
    let isInitialized = false;
    
    // ==========================================
    // GAS CODE TEMPLATE (SAMA)
    // ==========================================
    
    const GAS_CODE = `/**
 * Google Apps Script untuk Telegram + Saldo Integration
 * Deploy sebagai Web App (Execute as: Me, Access: Anyone)
 */

const SHEET_TOPUP = 'TOP UP';
const SHEET_STEP = 'STEP';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    switch(action) {
      case 'initSaldo':
        return initSaldoTransaction(data);
      case 'completeSaldo':
        return completeSaldoTransaction(data);
      default:
        return jsonResponse({ success: false, error: 'Unknown action: ' + action });
    }
  } catch (error) {
    return jsonResponse({ success: false, error: error.toString() });
  }
}

function doGet(e) {
  if (e.parameter.action === 'test') {
    return jsonResponse({ success: true, message: 'Koneksi berhasil!' });
  }
  return jsonResponse({ success: false, error: 'Action tidak valid' });
}

function initSaldoTransaction(data) {
  try {
    const sheetId = data.sheetId;
    const chatId = data.chatId || 'HTML_' + Date.now();
    const namaItem = data.namaItem;
    
    if (!sheetId || !namaItem) {
      return jsonResponse({ success: false, error: 'Sheet ID dan Nama Item diperlukan' });
    }
    
    const spreadsheet = SpreadsheetApp.openById(sheetId);
    let sheetStep = spreadsheet.getSheetByName(SHEET_STEP);
    
    if (!sheetStep) {
      sheetStep = spreadsheet.insertSheet(SHEET_STEP);
      const headers = ['TRANSAKSI ID', 'CHAT ID', 'resumeUrl', 'SALDO TOP UP', 'STATUS', 'MATCH_KEY', 'NAMA ITEM', 'Timestamp'];
      sheetStep.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheetStep.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    }
    
    const now = new Date();
    const transaksiId = chatId + '_' + now.getTime();
    const matchKey = chatId + '-waiting';
    
    const stepRow = [transaksiId, chatId, '', '', 'waiting', matchKey, namaItem, now.toISOString()];
    const newRow = sheetStep.getLastRow() + 1;
    sheetStep.getRange(newRow, 1, 1, stepRow.length).setValues([stepRow]);
    
    return jsonResponse({ 
      success: true, 
      transaksiId: transaksiId,
      matchKey: matchKey,
      row: newRow
    });
    
  } catch (error) {
    return jsonResponse({ success: false, error: error.toString() });
  }
}

function completeSaldoTransaction(data) {
  try {
    const sheetId = data.sheetId;
    const matchKey = data.matchKey;
    const nominal = parseInt(data.nominal);
    
    const spreadsheet = SpreadsheetApp.openById(sheetId);
    const sheetStep = spreadsheet.getSheetByName(SHEET_STEP);
    let sheetTopup = spreadsheet.getSheetByName(SHEET_TOPUP);
    
    if (!sheetTopup) {
      sheetTopup = spreadsheet.insertSheet(SHEET_TOPUP);
      const headers = ['BULAN', 'TANGGAL', 'NAMA ITEM', 'SALDO TOP UP'];
      sheetTopup.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheetTopup.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    }
    
    const lastRow = sheetStep.getLastRow();
    const matchKeys = sheetStep.getRange(2, 6, lastRow - 1, 1).getValues().flat();
    const rowIndex = matchKeys.indexOf(matchKey);
    
    if (rowIndex === -1) {
      return jsonResponse({ success: false, error: 'Transaksi tidak ditemukan' });
    }
    
    const actualRow = rowIndex + 2;
    const namaItem = sheetStep.getRange(actualRow, 7).getValue();
    
    sheetStep.getRange(actualRow, 4).setValue(nominal);
    sheetStep.getRange(actualRow, 5).setValue('DONE');
    
    const now = new Date();
    const bulanIndo = ["JANUARI","FEBRUARI","MARET","APRIL","MEI","JUNI","JULI","AGUSTUS","SEPTEMBER","OKTOBER","NOVEMBER","DESEMBER"];
    
    const topupRow = [
      bulanIndo[now.getMonth()],
      Utilities.formatDate(now, 'Asia/Jakarta', 'dd/MM/yyyy'),
      namaItem,
      nominal
    ];
    
    const newTopupRow = sheetTopup.getLastRow() + 1;
    sheetTopup.getRange(newTopupRow, 1, 1, topupRow.length).setValues([topupRow]);
    sheetTopup.getRange(newTopupRow, 4).setNumberFormat('#,##0');
    
    return jsonResponse({ 
      success: true,
      data: {
        bulan: topupRow[0],
        tanggal: topupRow[1],
        namaItem: namaItem,
        nominal: nominal,
        row: newTopupRow
      }
    });
    
  } catch (error) {
    return jsonResponse({ success: false, error: error.toString() });
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}`;

    // ==========================================
    // INIT
    // ==========================================
    
    function init() {
        if (isInitialized) return;
        isInitialized = true;
        
        console.log('[Telegram+Saldo] Initializing...');
        loadData();
        
        // Cek environment
        console.log('[Telegram+Saldo] Host:', window.location.host);
        console.log('[Telegram+Saldo] Protocol:', window.location.protocol);
    }
    
    function loadData() {
        try {
            const savedConfig = localStorage.getItem(STORAGE_KEY_CONFIG);
            if (savedConfig) config = JSON.parse(savedConfig);
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
            console.error('[Telegram] Error loading topups:', e);
            topups = [];
        }
        
        // Load time filter preference
        try {
            const savedTimeFilter = localStorage.getItem('tg_time_filter');
            if (savedTimeFilter) currentTimeFilter = savedTimeFilter;
        } catch (e) {
            console.error('[Telegram] Error loading time filter:', e);
        }
    }
    
    function saveData() {
        try {
            localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
            localStorage.setItem(STORAGE_KEY_SALDO, JSON.stringify(saldoConfig));
            localStorage.setItem(STORAGE_KEY_TOPUPS, JSON.stringify(topups));
            localStorage.setItem('tg_time_filter', currentTimeFilter);
        } catch (e) {
            console.error('[Telegram+Saldo] Error saving:', e);
        }
    }
    
    // ==========================================
    // TIME FILTER HELPERS
    // ==========================================
    
    function isDateInRange(timestamp, range) {
        const date = new Date(timestamp);
        const now = new Date();
        
        switch(range) {
            case 'today':
                return date.toDateString() === now.toDateString();
                
            case 'week':
                const startOfWeek = new Date(now);
                startOfWeek.setDate(now.getDate() - now.getDay());
                startOfWeek.setHours(0, 0, 0, 0);
                const endOfWeek = new Date(startOfWeek);
                endOfWeek.setDate(startOfWeek.getDate() + 6);
                endOfWeek.setHours(23, 59, 59, 999);
                return date >= startOfWeek && date <= endOfWeek;
                
            case 'month':
                return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
                
            case 'year':
                return date.getFullYear() === now.getFullYear();
                
            case 'all':
            default:
                return true;
        }
    }
    
    function getTimeFilterLabel(filter) {
        const labels = {
            'today': 'Hari Ini',
            'week': 'Minggu Ini',
            'month': 'Bulan Ini',
            'year': 'Tahun Ini',
            'all': 'Semua Waktu'
        };
        return labels[filter] || 'Bulan Ini';
    }
    
    function getTimeFilterIcon(filter) {
        const icons = {
            'today': '📅',
            'week': '📆',
            'month': '🗓️',
            'year': '📊',
            'all': '📁'
        };
        return icons[filter] || '🗓️';
    }
    
    // ==========================================
    // SALDO MODULE - VERSI GITHUB (TANPA PROXY)
    // ==========================================
    
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
            
            return {
                valid: errors.length === 0,
                errors: errors
            };
        },
        
        renderSaldoSection: function() {
            const isWaiting = this.transaksiAktif !== null;
            const validation = this.validateConfig();
            
            let warningHtml = '';
            if (!validation.valid && !isWaiting) {
                warningHtml = `
                    <div style="background: #fff3e0; border: 2px solid #ff9800; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
                        <div style="color: #e65100; font-weight: 600; margin-bottom: 8px;">
                            ⚠️ Konfigurasi Belum Lengkap
                        </div>
                        <ul style="margin: 0; padding-left: 20px; color: #e65100; font-size: 13px;">
                            ${validation.errors.map(e => `<li>${e}</li>`).join('')}
                        </ul>
                    </div>
                `;
            }
            
            return `
                <div class="tg-saldo-section" style="background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%); border: 2px solid #4caf50; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                    <h3 style="margin: 0 0 16px 0; color: #2e7d32; display: flex; align-items: center; gap: 8px;">
                        💰 Input Saldo ke Google Sheets
                    </h3>
                    
                    ${warningHtml}
                    ${isWaiting ? this.renderInputNominal() : this.renderPilihJenis()}
                    
                    ${this.renderDebugInfo()}
                </div>
            `;
        },
        
        renderDebugInfo: function() {
            const validation = this.validateConfig();
            return `
                <div style="margin-top: 16px; padding: 12px; background: #f5f5f5; border-radius: 8px; font-size: 11px; font-family: monospace;">
                    <div style="font-weight: 600; margin-bottom: 8px;">🔧 Debug Info:</div>
                    <div>Host: ${window.location.host}</div>
                    <div>Script URL: ${saldoConfig.scriptUrl ? '✅ Set' : '❌ Empty'}</div>
                    <div>Sheet ID: ${saldoConfig.sheetId ? '✅ Set' : '❌ Empty'}</div>
                    <div>Config Valid: ${validation.valid ? '✅ Yes' : '❌ No'}</div>
                    <div>Transaksi Aktif: ${this.transaksiAktif ? '✅ ' + this.transaksiAktif.namaItem : '❌ No'}</div>
                </div>
            `;
        },
        
        renderPilihJenis: function() {
            const validation = this.validateConfig();
            const disabled = !validation.valid;
            
            const buttons = saldoConfig.jenisSaldo.map(jenis => `
                <button class="tg-btn-saldo" onclick="TelegramModule.SaldoModule.pilihJenis('${jenis}')" 
                        ${disabled ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}
                        style="background: white; border: 2px solid #4caf50; color: #4caf50; padding: 20px; 
                               border-radius: 12px; font-weight: 600; cursor: pointer; transition: all 0.3s;
                               display: flex; flex-direction: column; align-items: center; gap: 8px; width: 100%;">
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
                <div style="margin-top: 16px; text-align: center; color: #999; font-size: 13px;">
                    ⬇️ Isi konfigurasi di bawah untuk mengaktifkan tombol
                </div>
                ` : ''}
            `;
        },
        
        renderInputNominal: function() {
            const jenis = this.transaksiAktif?.namaItem || '';
            const icon = this.getIcon(jenis);
            
            return `
                <div style="background: white; padding: 24px; border-radius: 16px; border: 3px solid #4caf50; 
                            box-shadow: 0 4px 12px rgba(76, 175, 80, 0.2); animation: slideIn 0.3s ease;">
                    
                    <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #e8f5e9;">
                        <div style="font-size: 48px; background: #e8f5e9; width: 80px; height: 80px; 
                                    display: flex; align-items: center; justify-content: center; 
                                    border-radius: 50%;">${icon}</div>
                        <div>
                            <div style="font-size: 13px; color: #666; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">
                                Input Saldo
                            </div>
                            <div style="font-size: 28px; font-weight: 700; color: #2e7d32;">${jenis}</div>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 24px;">
                        <label style="display: block; margin-bottom: 12px; font-weight: 600; color: #555; font-size: 15px;">
                            Masukkan Nominal Saldo (Rp)
                        </label>
                        <input type="number" id="saldoNominal" placeholder="0" 
                               style="width: 100%; padding: 20px; font-size: 32px; font-weight: 700; 
                                      border: 2px solid #ddd; border-radius: 12px; text-align: center;
                                      transition: all 0.3s;"
                               onkeyup="TelegramModule.SaldoModule.formatRupiah(this)"
                               onfocus="this.style.borderColor='#4caf50'; this.style.boxShadow='0 0 0 3px rgba(76,175,80,0.1)'"
                               onblur="this.style.borderColor='#ddd'; this.style.boxShadow='none'"
                               onkeypress="if(event.key==='Enter')TelegramModule.SaldoModule.kirimNominal()"
                               autocomplete="off">
                        <div id="nominalDisplay" style="text-align: center; margin-top: 12px; font-size: 18px; 
                                                        color: #4caf50; font-weight: 600; min-height: 24px;"></div>
                    </div>
                    
                    <div style="display: flex; gap: 12px;">
                        <button onclick="TelegramModule.SaldoModule.kirimNominal()" 
                                style="flex: 2; background: linear-gradient(135deg, #4caf50 0%, #2e7d32 100%); 
                                       color: white; padding: 18px; border: none; border-radius: 12px; 
                                       font-weight: 700; cursor: pointer; font-size: 16px;
                                       box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
                                       transition: all 0.3s;"
                                onmouseover="this.style.transform='translateY(-2px)'"
                                onmouseout="this.style.transform='translateY(0)'">
                            ✅ SIMPAN KE SHEET
                        </button>
                        <button onclick="TelegramModule.SaldoModule.batal()" 
                                style="flex: 1; background: #f5f5f5; color: #666; padding: 18px; 
                                       border: 2px solid #ddd; border-radius: 12px; font-weight: 600; 
                                       cursor: pointer; font-size: 14px; transition: all 0.3s;"
                                onmouseover="this.style.background='#eeeeee'"
                                onmouseout="this.style.background='#f5f5f5'">
                            ❌ BATAL
                        </button>
                    </div>
                    
                    <div style="margin-top: 16px; padding: 12px; background: #f5f5f5; border-radius: 8px; 
                                font-size: 12px; color: #666; text-align: center;">
                        Data akan disimpan ke Sheet: <strong>TOP UP</strong>
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
            const icons = {
                'DANA': '💙',
                'DIGIPOS': '🟡',
                'MASTERLOAD': '🟢'
            };
            return icons[jenis] || '💰';
        },
        
        formatRupiah: function(input) {
            const value = input.value.replace(/\D/g, '');
            const formatted = new Intl.NumberFormat('id-ID').format(value);
            const display = document.getElementById('nominalDisplay');
            if (display) {
                display.textContent = value ? `Rp ${formatted}` : '';
            }
        },
        
        // ==========================================
        // API CALL - VERSI GITHUB (FETCH LANGSUNG)
        // ==========================================
        
        async apiCall(payload) {
            const targetUrl = saldoConfig.scriptUrl;
            
            if (!targetUrl) {
                throw new Error('Script URL belum diisi');
            }
            
            // FETCH LANGSUNG - tanpa proxy (karena GitHub Pages pakai https://)
            const response = await fetch(targetUrl, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        },
        
        // ==========================================
        // STEP 1: Pilih Jenis Saldo
        // ==========================================
        
        pilihJenis: async function(jenis) {
            console.log('[Saldo] STEP 1: Pilih Jenis =', jenis);
            
            const validation = this.validateConfig();
            if (!validation.valid) {
                alert('❌ Konfigurasi belum lengkap:\n\n' + validation.errors.join('\n'));
                return;
            }
            
            showToast(`⏳ Memulai transaksi ${jenis}...`);
            
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
                    
                    showToast(`✅ Input nominal untuk ${jenis}`);
                    TelegramModule.renderPage();
                    
                    setTimeout(() => {
                        const input = document.getElementById('saldoNominal');
                        if (input) {
                            input.focus();
                            input.select();
                        }
                    }, 200);
                    
                } else {
                    throw new Error(result.error || 'Server error');
                }
                
            } catch (error) {
                console.error('[Saldo] Error:', error);
                alert('❌ Error:\n\n' + error.message);
            }
        },
        
        // ==========================================
        // STEP 2: Kirim Nominal
        // ==========================================
        
        kirimNominal: async function() {
            const nominalInput = document.getElementById('saldoNominal');
            const nominal = parseInt(nominalInput.value.replace(/\D/g, ''));
            
            console.log('[Saldo] STEP 2: Kirim Nominal =', nominal);
            
            if (!nominal || nominal <= 0) {
                alert('❌ Nominal tidak valid!');
                nominalInput.focus();
                return;
            }
            
            if (!this.transaksiAktif) {
                alert('❌ Tidak ada transaksi aktif!');
                return;
            }
            
            showToast('⏳ Menyimpan ke Google Sheets...');
            
            try {
                const payload = {
                    action: 'completeSaldo',
                    sheetId: saldoConfig.sheetId,
                    matchKey: this.transaksiAktif.matchKey,
                    nominal: nominal,
                    transaksiId: this.transaksiAktif.transaksiId
                };
                
                const result = await this.apiCall(payload);
                
                console.log('[Saldo] Response:', result);
                
                if (result.success) {
                    // Simpan ke local
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
                    saveData();
                    
                    const jenisTemp = this.transaksiAktif.namaItem;
                    
                    this.transaksiAktif = null;
                    localStorage.removeItem('saldo_transaksi_aktif');
                    
                    const formattedNominal = new Intl.NumberFormat('id-ID').format(nominal);
                    alert(`✅ BERHASIL!\n\n${jenisTemp}: Rp ${formattedNominal}\nTanggal: ${result.data?.tanggal}\nSheet: TOP UP (Row ${result.data?.row})`);
                    
                    showToast(`✅ ${jenisTemp}: Rp ${formattedNominal} tersimpan!`);
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
            showToast('Transaksi dibatalkan');
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
    
    // ==========================================
    // RENDER FUNCTIONS (SAMA)
    // ==========================================
    
    function renderPage() {
        const container = document.getElementById('mainContent');
        if (!container) return;
        
        const stats = getStats();
        const syncStatus = getSyncStatus();
        
        container.innerHTML = `
            <div class="tg-container">
                ${renderHeader()}
                ${renderTimeFilter()}  <!-- TAMBAHAN: Filter Waktu -->
                ${renderStats(stats)}
                ${SaldoModule.renderSaldoSection()}
                ${renderConfig()}
                ${renderGasSection()}
                ${renderBackupSection(syncStatus)}
                ${renderTopupList()}
            </div>
        `;
        
        bindGasButtons();
        
        if (SaldoModule.transaksiAktif) {
            setTimeout(() => {
                const input = document.getElementById('saldoNominal');
                if (input) {
                    input.focus();
                    input.select();
                }
            }, 100);
        }
    }
    
    // ==========================================
    // TAMBAHAN: TIME FILTER RENDERER
    // ==========================================
    
    function renderTimeFilter() {
        const filters = [
            { key: 'today', label: 'Hari Ini', icon: '📅' },
            { key: 'week', label: 'Minggu Ini', icon: '📆' },
            { key: 'month', label: 'Bulan Ini', icon: '🗓️' },
            { key: 'year', label: 'Tahun Ini', icon: '📊' },
            { key: 'all', label: 'Semua', icon: '📁' }
        ];
        
        const buttons = filters.map(f => `
            <button onclick="TelegramModule.setTimeFilter('${f.key}')" 
                    class="tg-time-filter-btn ${currentTimeFilter === f.key ? 'active' : ''}"
                    style="
                        padding: 10px 16px;
                        border: 2px solid ${currentTimeFilter === f.key ? '#667eea' : '#e0e0e0'};
                        background: ${currentTimeFilter === f.key ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'white'};
                        color: ${currentTimeFilter === f.key ? 'white' : '#555'};
                        border-radius: 25px;
                        font-size: 13px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        white-space: nowrap;
                    "
                    onmouseover="if('${currentTimeFilter}' !== '${f.key}') this.style.borderColor='#667eea'"
                    onmouseout="if('${currentTimeFilter}' !== '${f.key}') this.style.borderColor='#e0e0e0'">
                <span>${f.icon}</span>
                <span>${f.label}</span>
            </button>
        `).join('');
        
        return `
            <div class="tg-time-filter-section" style="
                background: white;
                padding: 16px 20px;
                border-radius: 12px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.08);
                margin-bottom: 20px;
            ">
                <div style="
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    flex-wrap: wrap;
                    gap: 12px;
                ">
                    <div style="
                        font-weight: 600;
                        color: #333;
                        font-size: 14px;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    ">
                        <span style="font-size: 18px;">🔍</span>
                        <span>Filter Periode:</span>
                        <span style="
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            color: white;
                            padding: 4px 12px;
                            border-radius: 15px;
                            font-size: 12px;
                        ">
                            ${getTimeFilterIcon(currentTimeFilter)} ${getTimeFilterLabel(currentTimeFilter)}
                        </span>
                    </div>
                    <div style="
                        display: flex;
                        gap: 8px;
                        flex-wrap: wrap;
                    ">
                        ${buttons}
                    </div>
                </div>
            </div>
        `;
    }
    
    function renderHeader() {
        const isConfigured = config.botToken && config.botToken.length > 10;
        const statusClass = isConfigured ? (config.isPolling ? 'active' : 'ready') : 'inactive';
        const statusText = isConfigured ? (config.isPolling ? 'Aktif' : 'Siap') : 'Belum Setup';
        
        return `
            <div class="tg-header">
                <div class="tg-title-area">
                    <div class="tg-icon">📱</div>
                    <div>
                        <h2>Telegram + Saldo</h2>
                        <p>Integrasi Bot n8n & Input Manual</p>
                    </div>
                </div>
                <div class="tg-status ${statusClass}">${statusText}</div>
            </div>
        `;
    }
    
    function renderStats(stats) {
        return `
            <div class="tg-stats">
                <div class="tg-stat-card">
                    <div class="tg-stat-value">${formatMoney(stats.total)}</div>
                    <div class="tg-stat-label">Total (${getTimeFilterLabel(currentTimeFilter)})</div>
                </div>
                <div class="tg-stat-card">
                    <div class="tg-stat-value" style="color: #4caf50;">${stats.confirmed}</div>
                    <div class="tg-stat-label">Dikonfirmasi</div>
                </div>
                <div class="tg-stat-card">
                    <div class="tg-stat-value" style="color: #ff9800;">${stats.pending}</div>
                    <div class="tg-stat-label">Pending</div>
                </div>
                <div class="tg-stat-card">
                    <div class="tg-stat-value" style="color: #2196f3;">${stats.synced}</div>
                    <div class="tg-stat-label">Tersync Sheet</div>
                </div>
            </div>
        `;
    }
    
    function renderConfig() {
        return `
            <div class="tg-config">
                <h3>🔧 Konfigurasi Bot Telegram</h3>
                <div class="tg-form-row">
                    <div class="tg-form-group">
                        <label>Bot Token</label>
                        <input type="password" id="tgToken" value="${escapeHtml(config.botToken)}" placeholder="123456789:ABC...">
                    </div>
                    <div class="tg-form-group">
                        <label>Chat ID (Opsional)</label>
                        <input type="text" id="tgChat" value="${escapeHtml(config.chatId)}" placeholder="-100123...">
                    </div>
                </div>
                <div class="tg-form-row">
                    <div class="tg-form-group" style="flex: 2;">
                        <label>Webhook URL</label>
                        <input type="text" id="tgWebhook" value="${escapeHtml(config.webhookUrl || getDefaultWebhook())}" placeholder="https://...">
                    </div>
                    <div class="tg-form-group">
                        <label>Secret Key</label>
                        <input type="text" id="tgSecret" value="${escapeHtml(config.secretKey)}" placeholder="rahasia...">
                    </div>
                </div>
                <div class="tg-actions">
                    <button class="tg-btn tg-btn-primary" onclick="TelegramModule.saveConfig()">💾 Simpan Config</button>
                    <button class="tg-btn tg-btn-secondary" onclick="TelegramModule.testConnection()">🔌 Test Bot</button>
                </div>
                <div id="tgTestResult" style="margin-top: 12px;"></div>
            </div>
            
            <div class="tg-manual-add">
                <h3>➕ Tambah Topup Manual (Lainnya)</h3>
                <div class="tg-form-row">
                    <div class="tg-form-group">
                        <label>Jumlah (Rp)</label>
                        <input type="number" id="manualAmount" placeholder="100000">
                    </div>
                    <div class="tg-form-group">
                        <label>Pengirim</label>
                        <input type="text" id="manualSender" placeholder="Nama">
                    </div>
                    <div class="tg-form-group">
                        <label>Metode</label>
                        <select id="manualMethod">
                            <option>Transfer BCA</option>
                            <option>Transfer BNI</option>
                            <option>Transfer BRI</option>
                            <option>Transfer Mandiri</option>
                            <option>DANA</option>
                            <option>GoPay</option>
                            <option>OVO</option>
                            <option>ShopeePay</option>
                            <option>Lainnya</option>
                        </select>
                    </div>
                    <div class="tg-form-group" style="display: flex; align-items: flex-end;">
                        <button class="tg-btn tg-btn-success" onclick="TelegramModule.addManual()" style="width: 100%;">Tambah</button>
                    </div>
                </div>
            </div>
        `;
    }
    
    function renderGasSection() {
        return `
            <div class="tg-gas-section">
                <h3>📋 Setup Google Apps Script (GAS)</h3>
                <div class="tg-info-box">
                    <strong>🚀 Cara Setup:</strong>
                    <ol style="margin: 10px 0; padding-left: 20px;">
                        <li>Buka <a href="https://script.google.com" target="_blank">script.google.com</a></li>
                        <li>Klik "New Project" → Hapus code default</li>
                        <li>Copy kode di bawah → Paste → Save (Ctrl+S)</li>
                        <li>Deploy → New deployment → Web app</li>
                        <li><strong>Execute as:</strong> Me | <strong>Access:</strong> Anyone</li>
                        <li>Copy URL Web App ke kolom "Script URL" di bawah</li>
                    </ol>
                </div>
                
                <button class="tg-btn tg-btn-gas" id="btnShowGasCode">
                    📋 Copy Kode GAS
                </button>
                
                <div id="gasCodeContainer" style="display: none; margin-top: 16px;">
                    <div class="tg-gas-code-header">
                        <span>Code.gs</span>
                        <button class="tg-btn-small" id="btnCopyGas">📋 Copy</button>
                    </div>
                    <pre class="tg-gas-code" id="gasCodeDisplay"></pre>
                </div>
            </div>
        `;
    }
    
    function bindGasButtons() {
        const btnShow = document.getElementById('btnShowGasCode');
        const btnCopy = document.getElementById('btnCopyGas');
        const container = document.getElementById('gasCodeContainer');
        const display = document.getElementById('gasCodeDisplay');
        
        if (btnShow && container && display) {
            btnShow.addEventListener('click', function() {
                if (container.style.display === 'none') {
                    display.textContent = GAS_CODE;
                    container.style.display = 'block';
                    btnShow.textContent = '🔽 Sembunyikan Kode GAS';
                } else {
                    container.style.display = 'none';
                    btnShow.textContent = '📋 Copy Kode GAS';
                }
            });
        }
        
        if (btnCopy && display) {
            btnCopy.addEventListener('click', function() {
                copyToClipboard(GAS_CODE, '✅ Kode GAS berhasil dicopy!');
            });
        }
    }
    
    function copyToClipboard(text, successMsg) {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(function() {
                showToast(successMsg, 'success');
            }).catch(function(err) {
                fallbackCopy(text, successMsg);
            });
        } else {
            fallbackCopy(text, successMsg);
        }
    }
    
    function fallbackCopy(text, successMsg) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
            showToast(successMsg, 'success');
        } catch (err) {
            showToast('❌ Gagal copy', 'error');
        }
        
        document.body.removeChild(textArea);
    }
    
    function renderBackupSection(syncStatus) {
        return `
            <div class="tg-backup-section">
                <h3>☁️ Konfigurasi Google Sheet (WAJIB untuk Input Saldo)</h3>
                <div class="tg-info-box" style="background: #e8f5e9; border-left-color: #4caf50;">
                    <strong>✅ Penting:</strong> Input Saldo memerlukan konfigurasi ini untuk menyimpan ke Sheet "TOP UP".
                </div>
                <div class="tg-form-row">
                    <div class="tg-form-group" style="flex: 2;">
                        <label>Google Sheet ID <span style="color: red;">*</span></label>
                        <input type="text" id="tgSheetId" value="${escapeHtml(config.sheetId)}" 
                               placeholder="1fvLqdzZJL0Nuf627MNuNPkLDu_HZ0oALR6-mGED5Ihs">
                        <div class="tg-hint">Dari URL: docs.google.com/spreadsheets/d/<strong>SheetID</strong>/edit</div>
                    </div>
                    <div class="tg-form-group">
                        <label>Nama Sheet (Tab)</label>
                        <input type="text" id="tgSheetName" value="${escapeHtml(config.sheetName || 'Topups')}" placeholder="Topups">
                    </div>
                </div>
                <div class="tg-form-row">
                    <div class="tg-form-group">
                        <label>Script URL (GAS Web App) <span style="color: red;">*</span></label>
                        <input type="text" id="tgScriptUrl" value="${escapeHtml(config.scriptUrl || '')}" 
                               placeholder="https://script.google.com/macros/s/.../exec">
                        <div class="tg-hint"><strong>WAJIB:</strong> Deploy dengan "Access: Anyone"</div>
                    </div>
                </div>
                <div class="tg-actions">
                    <button class="tg-btn tg-btn-primary" onclick="TelegramModule.saveSheetConfig()">💾 Simpan Config</button>
                    <button class="tg-btn tg-btn-success" onclick="TelegramModule.syncToSheet()">🔄 Sync Sekarang</button>
                    <button class="tg-btn tg-btn-secondary" onclick="TelegramModule.testSheet()">🔗 Test Koneksi</button>
                </div>
                <div id="tgSyncResult" style="margin-top: 12px;">${syncStatus}</div>
            </div>
        `;
    }
    
    function renderTopupList() {
        const filtered = getFilteredTopups();
        const timeFilteredCount = getTimeFilteredTopups().length;
        
        let html = `
            <div class="tg-list-header">
                <h3>📨 Daftar Topup (${filtered.length}) <span style="font-size: 13px; color: #666; font-weight: normal;">| ${getTimeFilterLabel(currentTimeFilter)}: ${timeFilteredCount} item</span></h3>
                <div class="tg-filters">
                    <button class="tg-filter ${currentFilter === 'all' ? 'active' : ''}" onclick="TelegramModule.setFilter('all')">Semua</button>
                    <button class="tg-filter ${currentFilter === 'pending' ? 'active' : ''}" onclick="TelegramModule.setFilter('pending')">Pending</button>
                    <button class="tg-filter ${currentFilter === 'confirmed' ? 'active' : ''}" onclick="TelegramModule.setFilter('confirmed')">Dikonfirmasi</button>
                    <button class="tg-filter ${currentFilter === 'rejected' ? 'active' : ''}" onclick="TelegramModule.setFilter('rejected')">Ditolak</button>
                </div>
            </div>
            <div class="tg-list">
        `;
        
        if (filtered.length === 0) {
            html += `
                <div class="tg-empty">
                    <div style="font-size: 48px; margin-bottom: 12px;">📭</div>
                    <div>Belum ada data topup ${getTimeFilterLabel(currentTimeFilter).toLowerCase()}</div>
                    <div style="font-size: 13px; color: #999; margin-top: 8px;">Coba ubah filter periode di atas</div>
                </div>
            `;
        } else {
            filtered.forEach(t => {
                html += renderTopupItem(t);
            });
        }
        
        html += '</div>';
        return html;
    }
    
    function renderTopupItem(t) {
        const date = new Date(t.timestamp);
        const dateStr = date.toLocaleDateString('id-ID');
        const timeStr = date.toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'});
        const isSynced = t.syncedToSheet ? '✓' : '';
        
        let statusClass = '';
        let statusText = '';
        let actions = '';
        
        if (t.status === 'confirmed') {
            statusClass = 'confirmed';
            statusText = '✅ Dikonfirmasi';
        } else if (t.status === 'rejected') {
            statusClass = 'rejected';
            statusText = '❌ Ditolak';
        } else {
            statusClass = 'pending';
            statusText = '⏳ Pending';
            actions = `
                <button class="tg-btn-small tg-btn-confirm" onclick="TelegramModule.confirm('${t.id}')">Konfirmasi</button>
                <button class="tg-btn-small tg-btn-reject" onclick="TelegramModule.reject('${t.id}')">Tolak</button>
            `;
        }
        
        // TAMBAHAN: Tombol Hapus untuk SEMUA item
        const deleteButton = `
            <button class="tg-btn-small tg-btn-delete" onclick="TelegramModule.deleteTopup('${t.id}')" 
                    style="background: #9e9e9e; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; margin-left: 4px;"
                    onmouseover="this.style.background='#757575'"
                    onmouseout="this.style.background='#9e9e9e'"
                    title="Hapus dari daftar ini (tidak menghapus data di Sheet)">
                🗑️ Hapus
            </button>
        `;
        
        return `
            <div class="tg-item ${statusClass}" data-id="${t.id}">
                <div class="tg-item-main">
                    <div class="tg-item-amount">
                        ${formatMoney(t.amount)} 
                        <span style="font-size: 12px; color: #4caf50;">${isSynced}</span>
                    </div>
                    <div class="tg-item-meta">
                        <span>${escapeHtml(t.sender || 'Unknown')}</span>
                        <span>•</span>
                        <span>${escapeHtml(t.method || '-')}</span>
                        <span>•</span>
                        <span>${dateStr} ${timeStr}</span>
                        ${t.sheetRow ? '<span>•</span><span style="color: #2196f3;">Row: ' + t.sheetRow + '</span>' : ''}
                    </div>
                </div>
                <div class="tg-item-status">${statusText}</div>
                <div class="tg-item-actions">${actions}${deleteButton}</div>
            </div>
        `;
    }
    
    // ==========================================
    // UPDATED STATS WITH TIME FILTER
    // ==========================================
    
    function getStats() {
        const timeFiltered = getTimeFilteredTopups();
        
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
    }
    
    function getTimeFilteredTopups() {
        return topups.filter(t => isDateInRange(t.timestamp, currentTimeFilter));
    }
    
    function getSyncStatus() {
        const timeFiltered = getTimeFilteredTopups();
        const unsynced = timeFiltered.filter(t => !t.syncedToSheet).length;
        if (unsynced === 0) {
            return '<div style="color: green;">✅ Semua data tersync</div>';
        }
        return `<div style="color: orange;">⏳ ${unsynced} data belum tersync</div>`;
    }
    
    function getFilteredTopups() {
        let result = getTimeFilteredTopups().sort((a, b) => b.timestamp - a.timestamp);
        if (currentFilter !== 'all') {
            result = result.filter(t => t.status === currentFilter);
        }
        return result;
    }
    
    function getDefaultWebhook() {
        return window.location.origin + '/api/telegram-webhook';
    }
    
    function formatMoney(amount) {
        return 'Rp ' + (amount || 0).toLocaleString('id-ID');
    }
    
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
    
    async function syncToSheet() {
        if (!config.sheetId || !config.scriptUrl) {
            showToast('❌ Sheet ID dan Script URL harus diisi!', 'error');
            return;
        }
        
        const timeFiltered = getTimeFilteredTopups();
        const unsynced = timeFiltered.filter(t => !t.syncedToSheet);
        
        if (unsynced.length === 0) {
            showToast('✅ Tidak ada data yang perlu disync');
            return;
        }
        
        const resultDiv = document.getElementById('tgSyncResult');
        resultDiv.innerHTML = '<div style="color: blue;">⏳ Syncing...</div>';
        
        let successCount = 0;
        let failCount = 0;
        
        for (const topup of unsynced) {
            try {
                const result = await sendToSheet(topup);
                if (result.success) {
                    topup.syncedToSheet = true;
                    topup.sheetRow = result.row;
                    topup.syncedAt = Date.now();
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (e) {
                console.error('Sync error:', e);
                failCount++;
            }
        }
        
        saveData();
        
        if (failCount === 0) {
            resultDiv.innerHTML = `<div style="color: green;">✅ ${successCount} data berhasil disync</div>`;
            showToast(`✅ ${successCount} data tersync ke Sheet!`);
        } else {
            resultDiv.innerHTML = `<div style="color: orange;">⚠️ ${successCount} sukses, ${failCount} gagal</div>`;
            showToast(`⚠️ ${successCount} sukses, ${failCount} gagal`);
        }
        
        renderPage();
    }
    
    async function sendToSheet(topup) {
        const data = {
            action: 'append',
            sheetId: config.sheetId,
            sheetName: config.sheetName,
            data: {
                ID: topup.id,
                Timestamp: new Date(topup.timestamp).toISOString(),
                Tanggal: new Date(topup.timestamp).toLocaleDateString('id-ID'),
                Waktu: new Date(topup.timestamp).toLocaleTimeString('id-ID'),
                Jumlah: topup.amount,
                Pengirim: topup.sender,
                Metode: topup.method,
                ID_Transaksi: topup.transactionId || '',
                Status: topup.status,
                Sumber: topup.source,
                Pesan: topup.message || '',
                Confirmed_At: topup.confirmedAt ? new Date(topup.confirmedAt).toISOString() : ''
            }
        };
        
        const response = await fetch(config.scriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        return await response.json();
    }
    
    async function testSheet() {
        if (!config.scriptUrl) {
            showToast('❌ Script URL belum diisi!', 'error');
            return;
        }
        
        const resultDiv = document.getElementById('tgSyncResult');
        resultDiv.innerHTML = '<div style="color: blue;">⏳ Testing...</div>';
        
        try {
            const response = await fetch(config.scriptUrl + '?action=test');
            const result = await response.json();
            
            if (result.success) {
                resultDiv.innerHTML = `<div style="color: green;">✅ ${result.message}</div>`;
                showToast('✅ Koneksi ke Sheet berhasil!');
            } else {
                resultDiv.innerHTML = `<div style="color: red;">❌ ${result.error}</div>`;
            }
        } catch (e) {
            resultDiv.innerHTML = `<div style="color: red;">❌ Error: ${e.message}</div>`;
        }
    }
    
    return {
        init: init,
        renderPage: renderPage,
        SaldoModule: SaldoModule,
        
        // TAMBAHAN: Time Filter Setter
        setTimeFilter: function(filter) {
            currentTimeFilter = filter;
            saveData();
            renderPage();
            showToast(`🔍 Filter: ${getTimeFilterLabel(filter)}`);
        },
        
        saveConfig: function() {
            const token = document.getElementById('tgToken').value.trim();
            const chat = document.getElementById('tgChat').value.trim();
            const webhook = document.getElementById('tgWebhook').value.trim();
            const secret = document.getElementById('tgSecret').value.trim();
            
            config.botToken = token;
            config.chatId = chat;
            config.webhookUrl = webhook;
            config.secretKey = secret;
            
            saveData();
            showToast('✅ Konfigurasi Bot disimpan!');
            renderPage();
        },
        
        saveSheetConfig: function() {
            const sheetId = document.getElementById('tgSheetId').value.trim();
            const sheetName = document.getElementById('tgSheetName').value.trim();
            const scriptUrl = document.getElementById('tgScriptUrl').value.trim();
            
            config.sheetId = sheetId;
            config.sheetName = sheetName || 'Topups';
            config.scriptUrl = scriptUrl;
            
            saldoConfig.sheetId = sheetId || '1fvLqdzZJL0Nuf627MNuNPkLDu_HZ0oALR6-mGED5Ihs';
            saldoConfig.scriptUrl = scriptUrl;
            
            saveData();
            showToast('✅ Konfigurasi Sheet disimpan!');
            renderPage();
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
        
        testSheet: testSheet,
        syncToSheet: syncToSheet,
        
        addManual: function() {
            const amount = parseFloat(document.getElementById('manualAmount').value);
            const sender = document.getElementById('manualSender').value.trim();
            const method = document.getElementById('manualMethod').value;
            
            if (!amount || amount <= 0) {
                alert('Jumlah tidak valid');
                return;
            }
            
            const topup = {
                id: 'MANUAL_' + Date.now(),
                amount: amount,
                sender: sender || 'Manual',
                method: method,
                transactionId: 'MANUAL_' + Math.floor(Math.random() * 10000),
                timestamp: Date.now(),
                status: 'pending',
                source: 'manual',
                syncedToSheet: false
            };
            
            topups.push(topup);
            saveData();
            
            document.getElementById('manualAmount').value = '';
            document.getElementById('manualSender').value = '';
            
            showToast('✅ Topup ditambahkan!');
            renderPage();
        },
        
        confirm: function(id) {
            const t = topups.find(x => x.id === id);
            if (!t) return;
            
            if (confirm(`Konfirmasi topup ${formatMoney(t.amount)} dari ${t.sender}?`)) {
                t.status = 'confirmed';
                t.confirmedAt = Date.now();
                t.syncedToSheet = false;
                saveData();
                showToast('✅ Topup dikonfirmasi!');
                renderPage();
            }
        },
        
        reject: function(id) {
            const t = topups.find(x => x.id === id);
            if (!t) return;
            
            if (confirm(`Tolak topup ${formatMoney(t.amount)}?`)) {
                t.status = 'rejected';
                t.rejectedAt = Date.now();
                t.syncedToSheet = false;
                saveData();
                showToast('❌ Topup ditolak!');
                renderPage();
            }
        },
        
        // TAMBAHAN: Fungsi hapus item
        deleteTopup: function(id) {
            const t = topups.find(x => x.id === id);
            if (!t) return;
            
            const confirmMsg = `🗑️ HAPUS DATA INI?\n\n` +
                `Jumlah: ${formatMoney(t.amount)}\n` +
                `Pengirim: ${t.sender}\n` +
                `Metode: ${t.method}\n` +
                `Tanggal: ${new Date(t.timestamp).toLocaleDateString('id-ID')}\n\n` +
                `⚠️ Catatan:\n` +
                `• Data ini hanya dihapus dari tampilan HTML\n` +
                `• Data di Google Sheet TIDAK terhapus\n` +
                `• Data bisa muncul lagi jika di-sync ulang`;
            
            if (confirm(confirmMsg)) {
                // Hapus dari array
                const index = topups.findIndex(x => x.id === id);
                if (index > -1) {
                    topups.splice(index, 1);
                    saveData();
                    showToast('🗑️ Data dihapus dari daftar');
                    renderPage();
                }
            }
        },
        
        setFilter: function(f) {
            currentFilter = f;
            renderPage();
        },
        
        exportData: function() {
            const data = {
                exportDate: new Date().toISOString(),
                config: config,
                topups: topups,
                stats: getStats()
            };
            
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `telegram-topups-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showToast('✅ Data berhasil diexport!');
        },
        
        getData: function() { return { config, topups }; },
        clearData: function() { 
            if (confirm('⚠️ Yakin ingin menghapus SEMUA data?')) {
                topups = []; 
                saveData(); 
                renderPage();
            }
        }
    };
})();

document.addEventListener('DOMContentLoaded', function() {
    TelegramModule.init();
    TelegramModule.SaldoModule.checkPending();
    console.log('[Telegram+Saldo] Module ready - GitHub Pages Version with Time Filter');
});

/**
 * Telegram Module - Hifzi Cell POS
 * Integrasi dengan n8n, MasterLoad, DigiPOS, ML, dan Input Saldo
 * VERSI STANDALONE - Tidak menggunakan IIFE agar bisa diakses global
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
                <div style="background: #fff3e0; border: 2px solid #ff9800; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
                    <div style="color: #e65100; font-weight: 600; margin-bottom: 8px;">⚠️ Konfigurasi Belum Lengkap</div>
                    <ul style="margin: 0; padding-left: 20px; color: #e65100; font-size: 13px;">
                        ${validation.errors.map(e => `<li>${e}</li>`).join('')}
                    </ul>
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
            ${disabled ? `<div style="margin-top: 16px; text-align: center; color: #999; font-size: 13px;">⬇️ Isi konfigurasi di bawah untuk mengaktifkan tombol</div>` : ''}
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
        
        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        return await response.json();
    },
    
    pilihJenis: async function(jenis) {
        console.log('[Saldo] STEP 1: Pilih Jenis =', jenis);
        const validation = this.validateConfig();
        if (!validation.valid) {
            alert('❌ Konfigurasi belum lengkap:\n\n' + validation.errors.join('\n'));
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
            alert('❌ Error:\n\n' + error.message);
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
                alert(`✅ BERHASIL!\n\n${jenisTemp}: Rp ${formattedNominal}\nTanggal: ${result.data?.tanggal}\nSheet: TOP UP (Row ${result.data?.row})`);
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
    init: function() {
        console.log('[Telegram] init() dipanggil');
        if (isInitialized) {
            console.log('[Telegram] Sudah di-init sebelumnya');
            return;
        }
        isInitialized = true;
        
        console.log('[Telegram] Initializing...');
        this.loadData();
        SaldoModule.checkPending();
        
        console.log('[Telegram] Host:', window.location.host);
        console.log('[Telegram] Protocol:', window.location.protocol);
    },
    
    loadData: function() {
        try {
            const savedConfig = localStorage.getItem(STORAGE_KEY_CONFIG);
            if (savedConfig) tgConfig = JSON.parse(savedConfig);
            console.log('[Telegram] Config loaded:', tgConfig.botToken ? 'Ada token' : 'No token');
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
            console.log('[Telegram] Topups loaded:', topups.length, 'items');
        } catch (e) {
            console.error('[Telegram] Error loading topups:', e);
            topups = [];
        }
        
        try {
            const savedTimeFilter = localStorage.getItem('tg_time_filter');
            if (savedTimeFilter) currentTimeFilter = savedTimeFilter;
        } catch (e) {
            console.error('[Telegram] Error loading time filter:', e);
        }
    },
    
    saveData: function() {
        try {
            localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(tgConfig));
            localStorage.setItem(STORAGE_KEY_SALDO, JSON.stringify(saldoConfig));
            localStorage.setItem(STORAGE_KEY_TOPUPS, JSON.stringify(topups));
            localStorage.setItem('tg_time_filter', currentTimeFilter);
            console.log('[Telegram] Data saved');
        } catch (e) {
            console.error('[Telegram+Saldo] Error saving:', e);
        }
    },
    
    renderPage: function() {
        console.log('[Telegram] renderPage() dipanggil');
        const container = document.getElementById('mainContent');
        if (!container) {
            console.error('[Telegram] mainContent tidak ditemukan!');
            return;
        }
        
        const stats = this.getStats();
        const syncStatus = this.getSyncStatus();
        
        container.innerHTML = `
            <div class="tg-container" style="padding: 20px; max-width: 1000px; margin: 0 auto;">
                ${this.renderHeader()}
                ${this.renderTimeFilter()}
                ${this.renderStats(stats)}
                ${SaldoModule.renderSaldoSection()}
                ${this.renderConfig()}
                ${this.renderBackupSection(syncStatus)}
                ${this.renderTopupList()}
            </div>
        `;
        
        if (SaldoModule.transaksiAktif) {
            setTimeout(() => {
                const input = document.getElementById('saldoNominal');
                if (input) { input.focus(); input.select(); }
            }, 100);
        }
    },
    
    renderHeader: function() {
        const isConfigured = tgConfig.botToken && tgConfig.botToken.length > 10;
        const statusText = isConfigured ? (tgConfig.isPolling ? 'Aktif' : 'Siap') : 'Belum Setup';
        
        return `
            <div class="tg-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
                <div class="tg-title-area" style="display: flex; align-items: center; gap: 12px;">
                    <div class="tg-icon" style="font-size: 40px;">📱</div>
                    <div>
                        <h2 style="margin: 0; font-size: 20px;">Telegram + Saldo</h2>
                        <p style="margin: 0; opacity: 0.9; font-size: 13px;">Integrasi Bot n8n & Input Manual</p>
                    </div>
                </div>
                <div class="tg-status" style="background: rgba(255,255,255,0.2); padding: 8px 16px; border-radius: 20px; font-size: 13px; font-weight: 600;">${statusText}</div>
            </div>
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
                <h3 style="margin: 0 0 16px 0; font-size: 16px;">☁️ Konfigurasi Google Sheet (WAJIB untuk Input Saldo)</h3>
                <div style="background: #e8f5e9; border-left: 4px solid #4caf50; padding: 16px; margin-bottom: 16px; border-radius: 8px; font-size: 13px;">
                    <strong>✅ Penting:</strong> Input Saldo memerlukan konfigurasi ini untuk menyimpan ke Sheet "TOP UP".
                </div>
                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 12px; margin-bottom: 12px;">
                    <div>
                        <label style="display: block; font-size: 13px; color: #555; margin-bottom: 6px; font-weight: 600;">Google Sheet ID <span style="color: red;">*</span></label>
                        <input type="text" id="tgSheetId" value="${this.escapeHtml(tgConfig.sheetId)}" placeholder="1fvLqdzZJL0Nuf627MNuNPkLDu_HZ0oALR6-mGED5Ihs" style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; box-sizing: border-box;">
                    </div>
                    <div>
                        <label style="display: block; font-size: 13px; color: #555; margin-bottom: 6px; font-weight: 600;">Nama Sheet (Tab)</label>
                        <input type="text" id="tgSheetName" value="${this.escapeHtml(tgConfig.sheetName || 'Topups')}" placeholder="Topups" style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; box-sizing: border-box;">
                    </div>
                </div>
                <div style="margin-bottom: 12px;">
                    <label style="display: block; font-size: 13px; color: #555; margin-bottom: 6px; font-weight: 600;">Script URL (GAS Web App) <span style="color: red;">*</span></label>
                    <input type="text" id="tgScriptUrl" value="${this.escapeHtml(tgConfig.scriptUrl || '')}" placeholder="https://script.google.com/macros/s/.../exec" style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; box-sizing: border-box;">
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
    
    // ==================== UTILITY FUNCTIONS ====================
    
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
            alert(msg);
        }
    },
    
    // ==================== ACTIONS ====================
    
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
        
        saldoConfig.sheetId = tgConfig.sheetId || '1fvLqdzZJL0Nuf627MNuNPkLDu_HZ0oALR6-mGED5Ihs';
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
        if (!tgConfig.scriptUrl) {
            this.showToast('❌ Script URL belum diisi!');
            return;
        }
        
        const resultDiv = document.getElementById('tgSyncResult');
        resultDiv.innerHTML = '<div style="color: blue;">⏳ Testing...</div>';
        
        try {
            const response = await fetch(tgConfig.scriptUrl + '?action=test');
            const result = await response.json();
            
            if (result.success) {
                resultDiv.innerHTML = `<div style="color: green;">✅ ${result.message}</div>`;
                this.showToast('✅ Koneksi ke Sheet berhasil!');
            } else {
                resultDiv.innerHTML = `<div style="color: red;">❌ ${result.error}</div>`;
            }
        } catch (e) {
            resultDiv.innerHTML = `<div style="color: red;">❌ Error: ${e.message}</div>`;
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
            this.showToast(`✅ ${successCount} data tersync ke Sheet!`);
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
            body: JSON.stringify(data)
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

/**
 * Telegram Bot Integration Module + SALDO INTEGRATION
 * VERSI DEBUG - dengan error handling lengkap
 */

console.log('[Telegram] Script mulai di-load...');

// Cek apakah sudah ada TelegramModule
if (typeof window.TelegramModule !== 'undefined') {
    console.warn('[Telegram] TelegramModule sudah ada, melewati...');
}

const TelegramModule = (function() {
    'use strict';
    
    console.log('[Telegram] IIFE dijalankan');
    
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
    
    const GAS_CODE = `// GAS Code template - sama seperti sebelumnya`;

    function init() {
        console.log('[Telegram] init() dipanggil');
        if (isInitialized) {
            console.log('[Telegram] Sudah di-init sebelumnya');
            return;
        }
        isInitialized = true;
        
        console.log('[Telegram] Initializing...');
        loadData();
        
        console.log('[Telegram] Host:', window.location.host);
        console.log('[Telegram] Protocol:', window.location.protocol);
    }
    
    function loadData() {
        try {
            const savedConfig = localStorage.getItem(STORAGE_KEY_CONFIG);
            if (savedConfig) config = JSON.parse(savedConfig);
            console.log('[Telegram] Config loaded:', config.botToken ? 'Ada token' : 'No token');
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
    }
    
    function saveData() {
        try {
            localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
            localStorage.setItem(STORAGE_KEY_SALDO, JSON.stringify(saldoConfig));
            localStorage.setItem(STORAGE_KEY_TOPUPS, JSON.stringify(topups));
            localStorage.setItem('tg_time_filter', currentTimeFilter);
            console.log('[Telegram] Data saved');
        } catch (e) {
            console.error('[Telegram+Saldo] Error saving:', e);
        }
    }
    
    function getYesterdayDate() {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return yesterday;
    }
    
    function isDateInRange(timestamp, range) {
        const date = new Date(timestamp);
        const now = new Date();
        
        switch(range) {
            case 'today':
                return date.toDateString() === now.toDateString();
            case 'yesterday':
                const yesterday = getYesterdayDate();
                return date.toDateString() === yesterday.toDateString();
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
            'yesterday': 'Hari Kemarin',
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
            'yesterday': '⏮️',
            'week': '📆',
            'month': '🗓️',
            'year': '📊',
            'all': '📁'
        };
        return icons[filter] || '🗓️';
    }
    
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
                <button onclick="TelegramModule.SaldoModule.pilihJenis('${jenis}')" 
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
                               onkeyup="TelegramModule.SaldoModule.formatRupiah(this)"
                               onfocus="this.style.borderColor='#4caf50'; this.style.boxShadow='0 0 0 3px rgba(76,175,80,0.1)'"
                               onblur="this.style.borderColor='#ddd'; this.style.boxShadow='none'"
                               onkeypress="if(event.key==='Enter')TelegramModule.SaldoModule.kirimNominal()"
                               autocomplete="off">
                        <div id="nominalDisplay" style="text-align: center; margin-top: 12px; font-size: 18px; color: #4caf50; font-weight: 600; min-height: 24px;"></div>
                    </div>
                    <div style="display: flex; gap: 12px;">
                        <button onclick="TelegramModule.SaldoModule.kirimNominal()" 
                                style="flex: 2; background: linear-gradient(135deg, #4caf50 0%, #2e7d32 100%); color: white; padding: 18px; border: none; border-radius: 12px; font-weight: 700; cursor: pointer; font-size: 16px; box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3); transition: all 0.3s;"
                                onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                            ✅ SIMPAN KE SHEET
                        </button>
                        <button onclick="TelegramModule.SaldoModule.batal()" 
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
    
    function renderPage() {
        console.log('[Telegram] renderPage() dipanggil');
        const container = document.getElementById('mainContent');
        if (!container) {
            console.error('[Telegram] mainContent tidak ditemukan!');
            return;
        }
        
        const stats = getStats();
        const syncStatus = getSyncStatus();
        
        container.innerHTML = `
            <div class="tg-container">
                ${renderHeader()}
                ${renderTimeFilter()}
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
                if (input) { input.focus(); input.select(); }
            }, 100);
        }
    }
    
    function renderTimeFilter() {
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
                    class="tg-time-filter-btn ${currentTimeFilter === f.key ? 'active' : ''}"
                    style="padding: 10px 16px; border: 2px solid ${currentTimeFilter === f.key ? '#667eea' : '#e0e0e0'}; background: ${currentTimeFilter === f.key ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'white'}; color: ${currentTimeFilter === f.key ? 'white' : '#555'}; border-radius: 25px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.3s; display: flex; align-items: center; gap: 6px; white-space: nowrap;"
                    onmouseover="if('${currentTimeFilter}' !== '${f.key}') this.style.borderColor='#667eea'"
                    onmouseout="if('${currentTimeFilter}' !== '${f.key}') this.style.borderColor='#e0e0e0'">
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
                            ${getTimeFilterIcon(currentTimeFilter)} ${getTimeFilterLabel(currentTimeFilter)}
                        </span>
                    </div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">${buttons}</div>
                </div>
            </div>
        `;
    }
    
    function renderHeader() {
        const isConfigured = config.botToken && config.botToken.length > 10;
        const statusClass = isConfigured ? (config.isPolling ? 'active' : 'ready') : 'inactive';
        const statusText = isConfigured ? (config.isPolling ? 'Aktif' : 'Siap') : 'Belum Setup';
        
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
    }
    
    function renderStats(stats) {
        return `
            <div class="tg-stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; margin-bottom: 20px;">
                <div class="tg-stat-card" style="background: white; padding: 16px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); text-align: center;">
                    <div class="tg-stat-value" style="font-size: 20px; font-weight: 700; color: #333;">${formatMoney(stats.total)}</div>
                    <div class="tg-stat-label" style="font-size: 12px; color: #666; margin-top: 4px;">Total (${getTimeFilterLabel(currentTimeFilter)})</div>
                </div>
                <div class="tg-stat-card" style="background: white; padding: 16px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); text-align: center;">
                    <div class="tg-stat-value" style="font-size: 20px; font-weight: 700; color: #4caf50;">${stats.confirmed}</div>
                    <div class="tg-stat-label" style="font-size: 12px; color: #666; margin-top: 4px;">Dikonfirmasi</div>
                </div>
                <div class="tg-stat-card" style="background: white; padding: 16px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); text-align: center;">
                    <div class="tg-stat-value" style="font-size: 20px; font-weight: 700; color: #ff9800;">${stats.pending}</div>
                    <div class="tg-stat-label" style="font-size: 12px; color: #666; margin-top: 4px;">Pending</div>
                </div>
                <div class="tg-stat-card" style="background: white; padding: 16px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); text-align: center;">
                    <div class="tg-stat-value" style="font-size: 20px; font-weight: 700; color: #2196f3;">${stats.synced}</div>
                    <div class="tg-stat-label" style="font-size: 12px; color: #666; margin-top: 4px;">Tersync Sheet</div>
                </div>
            </div>
        `;
    }
    
    function renderConfig() {
        return `
            <div class="tg-config" style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); margin-bottom: 20px;">
                <h3 style="margin: 0 0 16px 0; font-size: 16px;">🔧 Konfigurasi Bot Telegram</h3>
                <div class="tg-form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                    <div class="tg-form-group">
                        <label style="display: block; font-size: 13px; color: #555; margin-bottom: 6px; font-weight: 600;">Bot Token</label>
                        <input type="password" id="tgToken" value="${escapeHtml(config.botToken)}" placeholder="123456789:ABC..." style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; box-sizing: border-box;">
                    </div>
                    <div class="tg-form-group">
                        <label style="display: block; font-size: 13px; color: #555; margin-bottom: 6px; font-weight: 600;">Chat ID (Opsional)</label>
                        <input type="text" id="tgChat" value="${escapeHtml(config.chatId)}" placeholder="-100123..." style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; box-sizing: border-box;">
                    </div>
                </div>
                <div class="tg-form-row" style="display: grid; grid-template-columns: 2fr 1fr; gap: 12px; margin-bottom: 12px;">
                    <div class="tg-form-group">
                        <label style="display: block; font-size: 13px; color: #555; margin-bottom: 6px; font-weight: 600;">Webhook URL</label>
                        <input type="text" id="tgWebhook" value="${escapeHtml(config.webhookUrl || getDefaultWebhook())}" placeholder="https://..." style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; box-sizing: border-box;">
                    </div>
                    <div class="tg-form-group">
                        <label style="display: block; font-size: 13px; color: #555; margin-bottom: 6px; font-weight: 600;">Secret Key</label>
                        <input type="text" id="tgSecret" value="${escapeHtml(config.secretKey)}" placeholder="rahasia..." style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; box-sizing: border-box;">
                    </div>
                </div>
                <div class="tg-actions" style="display: flex; gap: 10px;">
                    <button onclick="TelegramModule.saveConfig()" style="padding: 10px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">💾 Simpan Config</button>
                    <button onclick="TelegramModule.testConnection()" style="padding: 10px 20px; background: #f5f5f5; color: #555; border: 2px solid #e0e0e0; border-radius: 8px; font-weight: 600; cursor: pointer;">🔌 Test Bot</button>
                </div>
                <div id="tgTestResult" style="margin-top: 12px;"></div>
            </div>
            
            <div class="tg-manual-add" style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); margin-bottom: 20px;">
                <h3 style="margin: 0 0 16px 0; font-size: 16px;">➕ Tambah Topup Manual (Lainnya)</h3>
                <div class="tg-form-row" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; align-items: end;">
                    <div class="tg-form-group">
                        <label style="display: block; font-size: 13px; color: #555; margin-bottom: 6px; font-weight: 600;">Jumlah (Rp)</label>
                        <input type="number" id="manualAmount" placeholder="100000" style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; box-sizing: border-box;">
                    </div>
                    <div class="tg-form-group">
                        <label style="display: block; font-size: 13px; color: #555; margin-bottom: 6px; font-weight: 600;">Pengirim</label>
                        <input type="text" id="manualSender" placeholder="Nama" style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; box-sizing: border-box;">
                    </div>
                    <div class="tg-form-group">
                        <label style="display: block; font-size: 13px; color: #555; margin-bottom: 6px; font-weight: 600;">Metode</label>
                        <select id="manualMethod" style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; box-sizing: border-box;">
                            <option>Transfer BCA</option><option>Transfer BNI</option><option>Transfer BRI</option>
                            <option>Transfer Mandiri</option><option>DANA</option><option>GoPay</option>
                            <option>OVO</option><option>ShopeePay</option><option>Lainnya</option>
                        </select>
                    </div>
                    <div class="tg-form-group">
                        <button onclick="TelegramModule.addManual()" style="width: 100%; padding: 10px; background: #4caf50; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">Tambah</button>
                    </div>
                </div>
            </div>
        `;
    }
    
    function renderGasSection() {
        return `
            <div class="tg-gas-section" style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); margin-bottom: 20px;">
                <h3 style="margin: 0 0 16px 0; font-size: 16px;">📋 Setup Google Apps Script (GAS)</h3>
                <div class="tg-info-box" style="background: #e3f2fd; border-left: 4px solid #2196f3; padding: 16px; margin-bottom: 16px; border-radius: 8px; font-size: 13px; line-height: 1.6;">
                    <strong>🚀 Cara Setup:</strong>
                    <ol style="margin: 10px 0; padding-left: 20px;">
                        <li>Buka <a href="https://script.google.com" target="_blank" style="color: #2196f3;">script.google.com</a></li>
                        <li>Klik "New Project" → Hapus code default</li>
                        <li>Copy kode di bawah → Paste → Save (Ctrl+S)</li>
                        <li>Deploy → New deployment → Web app</li>
                        <li><strong>Execute as:</strong> Me | <strong>Access:</strong> Anyone</li>
                        <li>Copy URL Web App ke kolom "Script URL" di bawah</li>
                    </ol>
                </div>
                <button onclick="document.getElementById('gasCodeContainer').style.display = document.getElementById('gasCodeContainer').style.display === 'none' ? 'block' : 'none'; this.textContent = document.getElementById('gasCodeContainer').style.display === 'none' ? '📋 Copy Kode GAS' : '🔽 Sembunyikan Kode GAS';" style="padding: 10px 20px; background: #ff9800; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">📋 Copy Kode GAS</button>
                <div id="gasCodeContainer" style="display: none; margin-top: 16px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; background: #f5f5f5; padding: 10px; border-radius: 8px 8px 0 0; border: 1px solid #e0e0e0; border-bottom: none;">
                        <span style="font-weight: 600; font-size: 13px;">Code.gs</span>
                        <button onclick="navigator.clipboard.writeText(document.getElementById('gasCodeDisplay').textContent); alert('Kode dicopy!');" style="padding: 6px 12px; background: #667eea; color: white; border: none; border-radius: 6px; font-size: 12px; cursor: pointer;">📋 Copy</button>
                    </div>
                    <pre id="gasCodeDisplay" style="margin: 0; padding: 16px; background: #263238; color: #aed581; border-radius: 0 0 8px 8px; overflow-x: auto; font-size: 12px; line-height: 1.5; max-height: 400px; overflow-y: auto;"></pre>
                </div>
            </div>
        `;
    }
    
    function bindGasButtons() {
        // Sudah di-handle inline di renderGasSection
    }
    
    function renderBackupSection(syncStatus) {
        return `
            <div class="tg-backup-section" style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); margin-bottom: 20px;">
                <h3 style="margin: 0 0 16px 0; font-size: 16px;">☁️ Konfigurasi Google Sheet (WAJIB untuk Input Saldo)</h3>
                <div class="tg-info-box" style="background: #e8f5e9; border-left: 4px solid #4caf50; padding: 16px; margin-bottom: 16px; border-radius: 8px; font-size: 13px;">
                    <strong>✅ Penting:</strong> Input Saldo memerlukan konfigurasi ini untuk menyimpan ke Sheet "TOP UP".
                </div>
                <div class="tg-form-row" style="display: grid; grid-template-columns: 2fr 1fr; gap: 12px; margin-bottom: 12px;">
                    <div class="tg-form-group">
                        <label style="display: block; font-size: 13px; color: #555; margin-bottom: 6px; font-weight: 600;">Google Sheet ID <span style="color: red;">*</span></label>
                        <input type="text" id="tgSheetId" value="${escapeHtml(config.sheetId)}" placeholder="1fvLqdzZJL0Nuf627MNuNPkLDu_HZ0oALR6-mGED5Ihs" style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; box-sizing: border-box;">
                        <div style="font-size: 11px; color: #888; margin-top: 4px;">Dari URL: docs.google.com/spreadsheets/d/<strong>SheetID</strong>/edit</div>
                    </div>
                    <div class="tg-form-group">
                        <label style="display: block; font-size: 13px; color: #555; margin-bottom: 6px; font-weight: 600;">Nama Sheet (Tab)</label>
                        <input type="text" id="tgSheetName" value="${escapeHtml(config.sheetName || 'Topups')}" placeholder="Topups" style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; box-sizing: border-box;">
                    </div>
                </div>
                <div class="tg-form-row" style="margin-bottom: 12px;">
                    <div class="tg-form-group">
                        <label style="display: block; font-size: 13px; color: #555; margin-bottom: 6px; font-weight: 600;">Script URL (GAS Web App) <span style="color: red;">*</span></label>
                        <input type="text" id="tgScriptUrl" value="${escapeHtml(config.scriptUrl || '')}" placeholder="https://script.google.com/macros/s/.../exec" style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; box-sizing: border-box;">
                        <div style="font-size: 11px; color: #888; margin-top: 4px;"><strong>WAJIB:</strong> Deploy dengan "Access: Anyone"</div>
                    </div>
                </div>
                <div class="tg-actions" style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <button onclick="TelegramModule.saveSheetConfig()" style="padding: 10px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">💾 Simpan Config</button>
                    <button onclick="TelegramModule.syncToSheet()" style="padding: 10px 20px; background: #4caf50; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">🔄 Sync Sekarang</button>
                    <button onclick="TelegramModule.testSheet()" style="padding: 10px 20px; background: #f5f5f5; color: #555; border: 2px solid #e0e0e0; border-radius: 8px; font-weight: 600; cursor: pointer;">🔗 Test Koneksi</button>
                </div>
                <div id="tgSyncResult" style="margin-top: 12px;">${syncStatus}</div>
            </div>
        `;
    }
    
    function renderTopupList() {
        const filtered = getFilteredTopups();
        const timeFilteredCount = getTimeFilteredTopups().length;
        
        let html = `
            <div class="tg-list-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
                <h3 style="margin: 0; font-size: 16px;">📨 Daftar Topup (${filtered.length}) <span style="font-size: 13px; color: #666; font-weight: normal;">| ${getTimeFilterLabel(currentTimeFilter)}: ${timeFilteredCount} item</span></h3>
                <div class="tg-filters" style="display: flex; gap: 8px;">
                    <button onclick="TelegramModule.setFilter('all')" style="padding: 6px 12px; border-radius: 20px; border: none; background: ${currentFilter === 'all' ? '#667eea' : '#f5f5f5'}; color: ${currentFilter === 'all' ? 'white' : '#555'}; font-size: 12px; cursor: pointer;">Semua</button>
                    <button onclick="TelegramModule.setFilter('pending')" style="padding: 6px 12px; border-radius: 20px; border: none; background: ${currentFilter === 'pending' ? '#ff9800' : '#f5f5f5'}; color: ${currentFilter === 'pending' ? 'white' : '#555'}; font-size: 12px; cursor: pointer;">Pending</button>
                    <button onclick="TelegramModule.setFilter('confirmed')" style="padding: 6px 12px; border-radius: 20px; border: none; background: ${currentFilter === 'confirmed' ? '#4caf50' : '#f5f5f5'}; color: ${currentFilter === 'confirmed' ? 'white' : '#555'}; font-size: 12px; cursor: pointer;">Dikonfirmasi</button>
                    <button onclick="TelegramModule.setFilter('rejected')" style="padding: 6px 12px; border-radius: 20px; border: none; background: ${currentFilter === 'rejected' ? '#f44336' : '#f5f5f5'}; color: ${currentFilter === 'rejected' ? 'white' : '#555'}; font-size: 12px; cursor: pointer;">Ditolak</button>
                </div>
            </div>
            <div class="tg-list">
        `;
        
        if (filtered.length === 0) {
            html += `
                <div style="text-align: center; padding: 40px; color: #999;">
                    <div style="font-size: 48px; margin-bottom: 12px;">📭</div>
                    <div>Belum ada data topup ${getTimeFilterLabel(currentTimeFilter).toLowerCase()}</div>
                    <div style="font-size: 13px; margin-top: 8px;">Coba ubah filter periode di atas</div>
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
                <button onclick="TelegramModule.confirm('${t.id}')" style="padding: 6px 12px; background: #4caf50; color: white; border: none; border-radius: 6px; font-size: 12px; cursor: pointer;">Konfirmasi</button>
                <button onclick="TelegramModule.reject('${t.id}')" style="padding: 6px 12px; background: #f44336; color: white; border: none; border-radius: 6px; font-size: 12px; cursor: pointer;">Tolak</button>
            `;
        }
        
        const deleteButton = `
            <button onclick="TelegramModule.deleteTopup('${t.id}')" style="padding: 6px 12px; background: #9e9e9e; color: white; border: none; border-radius: 6px; font-size: 12px; cursor: pointer; margin-left: 4px;" title="Hapus dari daftar ini (tidak menghapus data di Sheet)">
                🗑️ Hapus
            </button>
        `;
        
        return `
            <div class="tg-item" data-id="${t.id}" style="background: white; padding: 16px; border-radius: 12px; margin-bottom: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; border-left: 4px solid ${t.status === 'confirmed' ? '#4caf50' : t.status === 'rejected' ? '#f44336' : '#ff9800'};">
                <div class="tg-item-main" style="flex: 1;">
                    <div style="font-size: 18px; font-weight: 700; color: #333; margin-bottom: 4px;">
                        ${formatMoney(t.amount)} <span style="font-size: 12px; color: #4caf50;">${isSynced}</span>
                    </div>
                    <div style="font-size: 12px; color: #666;">
                        ${escapeHtml(t.sender || 'Unknown')} • ${escapeHtml(t.method || '-')} • ${dateStr} ${timeStr}
                        ${t.sheetRow ? ` • <span style="color: #2196f3;">Row: ${t.sheetRow}</span>` : ''}
                    </div>
                </div>
                <div style="font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 12px; background: ${t.status === 'confirmed' ? '#e8f5e9' : t.status === 'rejected' ? '#ffebee' : '#fff3e0'}; color: ${t.status === 'confirmed' ? '#2e7d32' : t.status === 'rejected' ? '#c62828' : '#e65100'};">
                    ${statusText}
                </div>
                <div style="display: flex; gap: 4px;">${actions}${deleteButton}</div>
            </div>
        `;
    }
    
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
        if (unsynced === 0) return '<div style="color: green;">✅ Semua data tersync</div>';
        return `<div style="color: orange;">⏳ ${unsynced} data belum tersync</div>`;
    }
    
    function getFilteredTopups() {
        let result = getTimeFilteredTopups().sort((a, b) => b.timestamp - a.timestamp);
        if (currentFilter !== 'all') result = result.filter(t => t.status === currentFilter);
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
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }
    
    function showToast(msg, type = 'info') {
        console.log('[Telegram Toast]:', msg);
        if (typeof utils !== 'undefined' && utils.showToast) {
            utils.showToast(msg, type);
        } else if (typeof app !== 'undefined' && app.showToast) {
            app.showToast(msg);
        } else {
            const toast = document.getElementById('toast');
            if (toast) {
                toast.textContent = msg;
                toast.className = 'toast show';
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
        
        let successCount = 0, failCount = 0;
        
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
    
    // Public API
    const publicAPI = {
        init: init,
        renderPage: renderPage,
        SaldoModule: SaldoModule,
        
        setTimeFilter: function(filter) {
            currentTimeFilter = filter;
            saveData();
            renderPage();
            showToast(`🔍 Filter: ${getTimeFilterLabel(filter)}`);
        },
        
        saveConfig: function() {
            config.botToken = document.getElementById('tgToken').value.trim();
            config.chatId = document.getElementById('tgChat').value.trim();
            config.webhookUrl = document.getElementById('tgWebhook').value.trim();
            config.secretKey = document.getElementById('tgSecret').value.trim();
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
        
        deleteTopup: function(id) {
            const t = topups.find(x => x.id === id);
            if (!t) return;
            
            const confirmMsg = `🗑️ HAPUS DATA INI?\n\nJumlah: ${formatMoney(t.amount)}\nPengirim: ${t.sender}\nMetode: ${t.method}\n\n⚠️ Data ini hanya dihapus dari tampilan HTML\n• Data di Google Sheet TIDAK terhapus`;
            
            if (confirm(confirmMsg)) {
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
            const data = { exportDate: new Date().toISOString(), config: config, topups: topups, stats: getStats() };
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
    
    console.log('[Telegram] Module created, returning public API');
    return publicAPI;
})();

console.log('[Telegram] Script selesai di-load, TelegramModule tersedia:', typeof TelegramModule);

// Auto-init saat DOM ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('[Telegram] DOMContentLoaded fired');
    if (typeof TelegramModule !== 'undefined') {
        TelegramModule.init();
        TelegramModule.SaldoModule.checkPending();
        console.log('[Telegram+Saldo] Module ready');
    } else {
        console.error('[Telegram] TelegramModule tidak tersedia saat DOMContentLoaded!');
    }
});

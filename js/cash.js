// ============================================
// CASH MODULE - Hifzi Cell POS
// ============================================

const cashModule = {
    currentDeleteTransaction: null,
    
    filterState: {
        startDate: null,
        endDate: null,
        preset: 'today',
        showHistory: false
    },
    
    // ========== PROVIDERS CONFIGURATION ==========
    providers: {
        ewallet: [
            { value: 'dana', label: 'DANA', icon: '💜' },
            { value: 'gopay', label: 'GoPay', icon: '💚' },
            { value: 'ovo', label: 'OVO', icon: '💙' },
            { value: 'shopeepay', label: 'ShopeePay', icon: '🧡' },
            { value: 'linkaja', label: 'LinkAja', icon: '❤️' },
            { value: 'jenius', label: 'Jenius', icon: '🦈' },
            { value: 'seabank', label: 'SeaBank', icon: '🐋' },
            { value: 'blu', label: 'Blu by BCA', icon: '🔷' },
            { value: 'jago', label: 'Bank Jago', icon: '🐆' }
        ],
        bank: [
            { value: 'bni', label: 'BNI', icon: '🏦' },
            { value: 'bri', label: 'BRI', icon: '🏛️' },
            { value: 'bca', label: 'BCA', icon: '🏢' },
            { value: 'mandiri', label: 'Mandiri', icon: '🏛️' },
            { value: 'btn', label: 'BTN', icon: '🏠' },
            { value: 'bsi', label: 'BSI', icon: '🕌' },
            { value: 'cimb', label: 'CIMB Niaga', icon: '🏪' },
            { value: 'danamon', label: 'Danamon', icon: '🏛️' },
            { value: 'permata', label: 'PermataBank', icon: '💎' },
            { value: 'panin', label: 'Panin Bank', icon: '🏦' },
            { value: 'maybank', label: 'Maybank', icon: '🌟' },
            { value: 'mega', label: 'Bank Mega', icon: '🔴' }
        ],
        custom: []
    },

    init() {
        this.loadCustomProviders();
        this.ensureCashInitialized();
        this.checkDayChange();
        this.renderHTML();
        this.updateStats();
        this.renderTransactions();
    },

    ensureCashInitialized() {
        if (typeof dataManager !== 'undefined' && dataManager.data && dataManager.data.settings) {
            // Inisialisasi currentCash jika belum ada
            if (typeof dataManager.data.settings.currentCash !== 'number' || isNaN(dataManager.data.settings.currentCash)) {
                dataManager.data.settings.currentCash = 0;
            }
            // Inisialisasi modalAwal jika belum ada
            if (typeof dataManager.data.settings.modalAwal !== 'number' || isNaN(dataManager.data.settings.modalAwal)) {
                dataManager.data.settings.modalAwal = 0;
            }
            dataManager.save();
        }
    },

    checkDayChange() {
        const lastActiveDate = localStorage.getItem('hifzi_last_active_date');
        const today = new Date().toDateString();
        
        if (!lastActiveDate) {
            localStorage.setItem('hifzi_last_active_date', today);
            return;
        }
        
        // Jika hari berganti, tampilkan notifikasi untuk setup shift baru
        if (lastActiveDate !== today) {
            // Tidak auto reset, biarkan user memilih
            console.log('Hari baru terdeteksi, menunggu user setup shift');
        }
    },

    // ========== CUSTOM PROVIDERS ==========
    loadCustomProviders() {
        const saved = localStorage.getItem('hifzi_custom_providers');
        if (saved) {
            this.providers.custom = JSON.parse(saved);
        }
    },

    saveCustomProviders() {
        localStorage.setItem('hifzi_custom_providers', JSON.stringify(this.providers.custom));
    },

    addCustomProvider(modalType) {
        const name = prompt('Nama Provider (contoh: Flip, KoinWorks, dsb):');
        if (!name || name.trim() === '') return;
        
        const icon = prompt('Icon/Emoji (contoh: 🔄, 💰, atau biarkan kosong):') || '💳';
        const value = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        
        if (value === '') {
            app.showToast('Nama tidak valid!');
            return;
        }
        
        const allProviders = [...this.providers.ewallet, ...this.providers.bank, ...this.providers.custom];
        const exists = allProviders.some(p => p.value === value);
        
        if (exists) {
            app.showToast('Provider sudah ada!');
            return;
        }
        
        this.providers.custom.push({ value, label: name, icon });
        this.saveCustomProviders();
        
        if (modalType === 'topup') {
            this.closeModal('topUpModal');
            this.openTopUp();
        } else if (modalType === 'tarik') {
            this.closeModal('tarikTunaiModal');
            this.openTarikTunai();
        }
        
        app.showToast(`✅ ${name} ditambahkan!`);
    },

    deleteCustomProvider(value) {
        const provider = this.providers.custom.find(p => p.value === value);
        if (!provider) return;
        
        if (!confirm(`Hapus ${provider.label} dari daftar?`)) return;
        
        this.providers.custom = this.providers.custom.filter(p => p.value !== value);
        this.saveCustomProviders();
        
        const manageModal = document.getElementById('manageProvidersModal');
        if (manageModal) {
            this.closeModal('manageProvidersModal');
            if (this.providers.custom.length > 0) {
                this.manageCustomProviders();
            }
        }
        
        app.showToast(`${provider.label} dihapus!`);
    },

    manageCustomProviders() {
        this.loadCustomProviders();
        
        if (this.providers.custom.length === 0) {
            app.showToast('Belum ada provider custom!');
            return;
        }
        
        let listHtml = this.providers.custom.map(p => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f5f5f5; border-radius: 8px; margin-bottom: 8px;">
                <span style="font-size: 15px;">${p.icon} ${p.label}</span>
                <button onclick="cashModule.deleteCustomProvider('${p.value}')" style="padding: 6px 12px; background: #ffebee; border: 1px solid #f44336; border-radius: 6px; color: #c62828; font-size: 12px; cursor: pointer;">
                    🗑️ Hapus
                </button>
            </div>
        `).join('');
        
        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal active" id="manageProvidersModal" style="display: flex; align-items: center; justify-content: center; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1100;">
                <div class="modal-content" style="background: white; border-radius: 16px; width: 90%; max-width: 400px; max-height: 80vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
                    <div class="modal-header" style="padding: 20px 24px; border-bottom: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: center;">
                        <span class="modal-title" style="font-size: 18px; font-weight: 700; color: #333;">✏️ Kelola Provider Custom</span>
                        <button class="close-btn" onclick="cashModule.closeModal('manageProvidersModal')" style="background: none; border: none; font-size: 28px; cursor: pointer; color: #999;">×</button>
                    </div>
                    <div style="padding: 20px;">
                        <div style="margin-bottom: 16px; padding: 12px; background: #e3f2fd; border-radius: 8px; font-size: 13px; color: #1565c0;">
                            ℹ️ Provider bawaan (E-Wallet & Bank) tidak dapat dihapus. Hanya provider custom yang bisa dikelola.
                        </div>
                        ${listHtml}
                        <button onclick="cashModule.closeModal('manageProvidersModal')" style="width: 100%; margin-top: 16px; padding: 12px; background: #f5f5f5; border: 2px solid #ddd; border-radius: 8px; cursor: pointer; font-weight: 600;">
                            Tutup
                        </button>
                    </div>
                </div>
            </div>
        `);
    },

    generateProviderOptions() {
        this.loadCustomProviders();
        
        let html = '';
        
        html += '<optgroup label="📱 E-Wallet / Digital">';
        this.providers.ewallet.forEach(p => {
            html += `<option value="${p.value}">${p.icon} ${p.label}</option>`;
        });
        html += '</optgroup>';
        
        html += '<optgroup label="🏦 Transfer Bank">';
        this.providers.bank.forEach(p => {
            html += `<option value="${p.value}">${p.icon} ${p.label}</option>`;
        });
        html += '</optgroup>';
        
        if (this.providers.custom.length > 0) {
            html += '<optgroup label="⭐ Provider Custom">';
            this.providers.custom.forEach(p => {
                html += `<option value="${p.value}">${p.icon} ${p.label}</option>`;
            });
            html += '</optgroup>';
        }
        
        return html;
    },

    // ========== RENDER HTML ==========
    renderHTML() {
        const periodLabel = this.getFilterLabel();
        const { startDate, endDate } = this.getDateRange();
        
        const periodStats = this.calculatePeriodStats(startDate, endDate);
        const dateRangeText = this.getDateRangeText(startDate, endDate);
        
        // ✅ PERBAIKAN: Hitung kas aktual yang benar
        const currentCash = parseInt(dataManager.data.settings?.currentCash) || 0;
        const modalAwal = parseInt(dataManager.data.settings?.modalAwal) || 0;
        const calculatedCash = this.calculateActualCash();
        const todayCashSales = this.getTodayCashSales();
        const todayNonCashSales = this.getTodayNonCashSales();
        
        // Deteksi selisih
        const selisih = currentCash - calculatedCash;
        const needsRepair = Math.abs(selisih) > 100;
        
        const lastActiveDate = localStorage.getItem('hifzi_last_active_date');
        const today = new Date().toDateString();
        const isNewDay = lastActiveDate && lastActiveDate !== today;

        document.getElementById('mainContent').innerHTML = `
            <div class="content-section active" id="cashSection">
                
                ${isNewDay ? `
                <div style="background: #fff3e0; border-radius: 12px; padding: 16px 20px; margin-bottom: 20px; 
                     box-shadow: 0 2px 8px rgba(0,0,0,0.08); border-left: 4px solid #ff9800;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                        <div>
                            <div style="font-size: 14px; font-weight: 600; color: #e65100; margin-bottom: 4px;">
                                🌅 Hari Baru Terdeteksi!
                            </div>
                            <div style="font-size: 12px; color: #666;">
                                Kas masih tersisa dari hari sebelumnya. Reset untuk memulai shift baru.
                            </div>
                        </div>
                        <button onclick="cashModule.showResetOptions()" style="padding: 10px 20px; background: #ff9800; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 13px;">
                            ⚙️ Atur Shift Baru
                        </button>
                    </div>
                </div>
                ` : ''}

                <!-- ✅ PERBAIKAN: Info Kas di Tangan yang Detail -->
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px; padding: 24px; margin-bottom: 20px; 
                     box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4); color: white;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px;">
                        <div>
                            <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">
                                💰 Kas di Tangan (Aktual)
                            </div>
                            <div style="font-size: 36px; font-weight: 700; margin-bottom: 8px;">
                                Rp ${utils.formatNumber(currentCash)}
                            </div>
                            <div style="font-size: 13px; opacity: 0.8; display: flex; gap: 16px; flex-wrap: wrap;">
                                <span>📦 Modal: Rp ${utils.formatNumber(modalAwal)}</span>
                                <span>💵 Penjualan Cash: Rp ${utils.formatNumber(todayCashSales)}</span>
                                <span>📱 Non-Cash: Rp ${utils.formatNumber(todayNonCashSales)}</span>
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="background: rgba(255,255,255,0.2); border-radius: 12px; padding: 12px 20px; backdrop-filter: blur(10px);">
                                <div style="font-size: 12px; opacity: 0.9; margin-bottom: 4px;">Status</div>
                                <div style="font-size: 16px; font-weight: 600; ${currentCash < 0 ? 'color: #ffebee;' : ''}">
                                    ${currentCash < 0 ? '⚠️ MINUS' : '✅ Normal'}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Breakdown Detail -->
                    <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.2); display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px;">
                        <div style="background: rgba(255,255,255,0.1); border-radius: 8px; padding: 12px;">
                            <div style="font-size: 11px; opacity: 0.8;">Kas Masuk (Manual)</div>
                            <div style="font-size: 16px; font-weight: 600;">Rp ${utils.formatNumber(periodStats.manualKasMasuk)}</div>
                        </div>
                        <div style="background: rgba(255,255,255,0.1); border-radius: 8px; padding: 12px;">
                            <div style="font-size: 11px; opacity: 0.8;">Kas Keluar</div>
                            <div style="font-size: 16px; font-weight: 600;">Rp ${utils.formatNumber(periodStats.kasKeluar)}</div>
                        </div>
                        <div style="background: rgba(255,255,255,0.1); border-radius: 8px; padding: 12px;">
                            <div style="font-size: 11px; opacity: 0.8;">Top Up Masuk</div>
                            <div style="font-size: 16px; font-weight: 600;">Rp ${utils.formatNumber(periodStats.topUpMasuk)}</div>
                        </div>
                        <div style="background: rgba(255,255,255,0.1); border-radius: 8px; padding: 12px;">
                            <div style="font-size: 11px; opacity: 0.8;">Laba Admin</div>
                            <div style="font-size: 16px; font-weight: 600; color: #a5d6a7;">Rp ${utils.formatNumber(periodStats.laba)}</div>
                        </div>
                    </div>
                </div>

                ${needsRepair ? `
                <div style="background: #fff3e0; border-radius: 12px; padding: 16px 20px; margin-bottom: 20px; 
                     box-shadow: 0 2px 8px rgba(0,0,0,0.08); border-left: 4px solid #ff9800;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                        <div>
                            <div style="font-size: 14px; font-weight: 600; color: #e65100; margin-bottom: 4px;">
                                ⚠️ Data Kas Tidak Konsisten
                            </div>
                            <div style="font-size: 12px; color: #666;">
                                Kas Tercatat: Rp ${utils.formatNumber(currentCash)} vs Hitungan: Rp ${utils.formatNumber(calculatedCash)} (Selisih: Rp ${utils.formatNumber(selisih)})
                            </div>
                        </div>
                        <button onclick="cashModule.recalculateCash()" style="padding: 8px 16px; background: #ff9800; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 13px;">
                            🔄 Recalculate
                        </button>
                    </div>
                </div>
                ` : ''}

                <div style="background: white; border-radius: 12px; padding: 16px 20px; margin-bottom: 20px; 
                     box-shadow: 0 2px 8px rgba(0,0,0,0.08); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 14px; color: #666; font-weight: 600;">📅 Periode:</span>
                        <span id="periodBadge" style="background: #667eea; color: white; padding: 6px 12px; border-radius: 20px; font-size: 13px; font-weight: 600;">${periodLabel}</span>
                        <span id="dateRangeText" style="font-size: 13px; color: #999;">${dateRangeText}</span>
                    </div>
                    
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <select id="filterPreset" onchange="cashModule.applyFilter()" 
                                style="padding: 8px 16px; border-radius: 8px; border: 2px solid #e0e0e0; font-size: 14px; background: white; cursor: pointer;">
                            <option value="today">📅 Hari Ini</option>
                            <option value="yesterday">📅 Kemarin</option>
                            <option value="week">📆 Minggu Ini</option>
                            <option value="month">🗓️ Bulan Ini</option>
                            <option value="year">📊 Tahun Ini</option>
                            <option value="custom">🔍 Custom...</option>
                        </select>
                        
                        <div id="customDateRange" style="display: none; gap: 8px; align-items: center;">
                            <input type="date" id="filterStartDate" onchange="cashModule.applyFilter()" 
                                   style="padding: 8px; border-radius: 6px; border: 2px solid #e0e0e0; font-size: 13px;">
                            <span style="color: #666;">s/d</span>
                            <input type="date" id="filterEndDate" onchange="cashModule.applyFilter()" 
                                   style="padding: 8px; border-radius: 6px; border: 2px solid #e0e0e0; font-size: 13px;">
                        </div>
                    </div>
                </div>

                <div style="background: #e3f2fd; border-radius: 12px; padding: 16px 20px; margin-bottom: 20px; 
                     box-shadow: 0 2px 8px rgba(0,0,0,0.08); border-left: 4px solid #2196f3;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                        <div>
                            <div style="font-size: 14px; font-weight: 600; color: #1565c0; margin-bottom: 4px;">
                                🔄 Reset Kas & Modal
                            </div>
                            <div style="font-size: 12px; color: #666;">
                                Kas: Rp ${utils.formatNumber(currentCash)} | Modal: Rp ${utils.formatNumber(modalAwal)}
                            </div>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button onclick="cashModule.showResetOptions()" style="padding: 10px 20px; background: #2196f3; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 13px;">
                                ⚙️ Pengaturan Shift
                            </button>
                        </div>
                    </div>
                </div>

                <div style="background: white; border-radius: 12px; padding: 20px; margin-bottom: 20px; 
                     box-shadow: 0 2px 8px rgba(0,0,0,0.08); border-left: 4px solid ${periodStats.laba >= 0 ? '#4caf50' : '#f44336'};">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-size: 13px; color: #666; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">
                                💰 Laba Bersih ${periodLabel}
                            </div>
                            <div style="font-size: 28px; font-weight: 700; color: ${periodStats.laba >= 0 ? '#2e7d32' : '#c62828'};">
                                Rp ${utils.formatNumber(periodStats.laba)}
                            </div>
                            <div style="font-size: 12px; color: #999; margin-top: 4px;">
                                Dari Admin Fee Top Up & Tarik Tunai
                            </div>
                        </div>
                        <div style="width: 56px; height: 56px; background: ${periodStats.laba >= 0 ? '#e8f5e9' : '#ffebee'}; 
                             border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 28px;">
                            ${periodStats.laba >= 0 ? '📈' : '📉'}
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #f0f0f0;">
                        <div style="text-align: center;">
                            <div style="font-size: 11px; color: #9c27b0; font-weight: 600; margin-bottom: 4px;">💜 Top Up</div>
                            <div style="font-size: 16px; font-weight: 700; color: #6a1b9a;">Rp ${utils.formatNumber(periodStats.labaTopUp)}</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="font-size: 11px; color: #2196f3; font-weight: 600; margin-bottom: 4px;">🏧 Tarik Tunai</div>
                            <div style="font-size: 16px; font-weight: 700; color: #1565c0;">Rp ${utils.formatNumber(periodStats.labaTarikTunai)}</div>
                        </div>
                    </div>
                </div>

                <div class="card" style="background: white; border-radius: 12px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
                    <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <span class="card-title" style="font-size: 18px; font-weight: 600; color: #333;">Manajemen Kas</span>
                        <div style="font-size: 12px; color: #999;">${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                    </div>
                    
                    <div class="cash-actions" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px;">
                        <button class="cash-btn in" onclick="cashModule.openModal('in')" 
                                style="background: #e8f5e9; border: 2px solid #4caf50; color: #2e7d32; padding: 16px; border-radius: 12px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 8px; transition: all 0.2s;">
                            <span style="font-size: 28px;">⬇️</span>
                            <span style="font-size: 14px; font-weight: 600;">Kas Masuk</span>
                        </button>
                        
                        <button class="cash-btn out" onclick="cashModule.openModal('out')"
                                style="background: #ffebee; border: 2px solid #f44336; color: #c62828; padding: 16px; border-radius: 12px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 8px; transition: all 0.2s;">
                            <span style="font-size: 28px;">⬆️</span>
                            <span style="font-size: 14px; font-weight: 600;">Kas Keluar</span>
                        </button>
                        
                        <button class="cash-btn tarik-tunai" onclick="cashModule.openTarikTunai()"
                                style="background: #e3f2fd; border: 2px solid #2196f3; color: #1565c0; padding: 16px; border-radius: 12px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 8px; transition: all 0.2s;">
                            <span style="font-size: 28px;">🏧</span>
                            <span style="font-size: 14px; font-weight: 600;">Tarik Tunai</span>
                        </button>
                        
                        <button class="cash-btn topup" onclick="cashModule.openTopUp()"
                                style="background: #f3e5f5; border: 2px solid #9c27b0; color: #6a1b9a; padding: 16px; border-radius: 12px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 8px; transition: all 0.2s;">
                            <span style="font-size: 28px;">💜</span>
                            <span style="font-size: 14px; font-weight: 600;">Top Up</span>
                        </button>
                        
                        <button class="cash-btn modal-awal" onclick="cashModule.openModalAwal()"
                                style="background: #fff8e1; border: 2px solid #ffc107; color: #f57f17; padding: 16px; border-radius: 12px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 8px; transition: all 0.2s;">
                            <span style="font-size: 28px;">💰</span>
                            <span style="font-size: 14px; font-weight: 600;">Modal Awal</span>
                        </button>
                        
                        <button class="cash-btn history" onclick="cashModule.openHistory()"
                                style="background: #eceff1; border: 2px solid #607d8b; color: #37474f; padding: 16px; border-radius: 12px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 8px; transition: all 0.2s;">
                            <span style="font-size: 28px;">📋</span>
                            <span style="font-size: 14px; font-weight: 600;">Riwayat</span>
                        </button>
                    </div>
                </div>

                <div class="card" style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
                    <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; cursor: pointer;" onclick="cashModule.toggleHistory()">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <span class="card-title" style="font-size: 18px; font-weight: 600; color: #333;">Riwayat Transaksi Kas</span>
                            <span id="historyToggleIcon" style="font-size: 24px; transition: transform 0.3s; transform: ${this.filterState.showHistory ? 'rotate(180deg)' : 'rotate(0deg)'};">🔽</span>
                        </div>
                        <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                            <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); cashModule.recalculateCash()" 
                                    style="font-size: 13px; padding: 8px 16px; background: #f5f5f5; border: 2px solid #ddd; border-radius: 8px; cursor: pointer;">
                                🔄 Recalculate
                            </button>
                        </div>
                    </div>
                    
                    <div id="cashTransactionList" style="min-height: ${this.filterState.showHistory ? '200px' : '0px'}; overflow: hidden; transition: all 0.3s ease; ${this.filterState.showHistory ? '' : 'max-height: 0;'}">
                    </div>
                    
                    <div id="filterSummary" style="padding: 16px; background: #f8f9fa; border-radius: 8px; margin-top: 16px; font-size: 14px; border: 1px solid #e0e0e0;">
                    </div>
                </div>
            </div>
        `;
        
        const todayStr = new Date().toISOString().split('T')[0];
        const startDateInput = document.getElementById('filterStartDate');
        const endDateInput = document.getElementById('filterEndDate');
        if (startDateInput) startDateInput.value = todayStr;
        if (endDateInput) endDateInput.value = todayStr;
        
        const filterSelect = document.getElementById('filterPreset');
        if (filterSelect) filterSelect.value = this.filterState.preset;
        
        const customRange = document.getElementById('customDateRange');
        if (customRange) {
            customRange.style.display = this.filterState.preset === 'custom' ? 'flex' : 'none';
        }
    },

    // ========== POS INTEGRATION - TAMBAHAN BARU ==========
    
    /**
     * ✅ FUNGSI BARU: Dipanggil dari posModule saat transaksi berhasil
     * Menambah currentCash otomatis untuk pembayaran cash
     */
    addPosTransaction(transaction) {
        if (!transaction) return;
        
        const paymentMethod = transaction.paymentMethod || 'cash';
        const total = parseInt(transaction.total) || 0;
        
        // Hanya tambah ke kas jika pembayaran cash
        if (paymentMethod === 'cash' && total > 0) {
            let currentCash = parseInt(dataManager.data.settings.currentCash) || 0;
            dataManager.data.settings.currentCash = currentCash + total;
            
            // Simpan juga sebagai transaksi kas dengan tipe khusus
            dataManager.data.cashTransactions.push({
                id: Date.now(),
                date: transaction.date || new Date().toISOString(),
                type: 'pos_sale',
                amount: total,
                category: 'penjualan_pos',
                note: `Penjualan POS - ${transaction.id || 'TRX'}`,
                source: 'pos_sale',
                transactionId: transaction.id,
                paymentMethod: 'cash'
            });
            
            dataManager.save();
            app.updateHeader();
            
            console.log(`✅ Kas bertambah Rp ${utils.formatNumber(total)} dari penjualan POS`);
        }
    },

    /**
     * ✅ FUNGSI BARU: Dipanggil saat transaksi POS dihapus/void
     */
    removePosTransaction(transaction) {
        if (!transaction || transaction.paymentMethod !== 'cash') return;
        
        const total = parseInt(transaction.total) || 0;
        let currentCash = parseInt(dataManager.data.settings.currentCash) || 0;
        
        // Kurangi kas
        dataManager.data.settings.currentCash = currentCash - total;
        
        // Hapus dari cashTransactions
        dataManager.data.cashTransactions = dataManager.data.cashTransactions.filter(t => 
            !(t.source === 'pos_sale' && t.transactionId === transaction.id)
        );
        
        // Tambah transaksi pembatalan
        dataManager.data.cashTransactions.push({
            id: Date.now(),
            date: new Date().toISOString(),
            type: 'pos_void',
            amount: total,
            category: 'pembatalan_pos',
            note: `Pembatalan POS - ${transaction.id || 'TRX'}`,
            source: 'pos_void',
            transactionId: transaction.id
        });
        
        dataManager.save();
        app.updateHeader();
        
        console.log(`✅ Kas berkurang Rp ${utils.formatNumber(total)} karena pembatalan POS`);
    },

    /**
     * ✅ FUNGSI BARU: Update transaksi POS yang diedit
     */
    updatePosTransaction(oldTransaction, newTransaction) {
        // Hapus yang lama
        this.removePosTransaction(oldTransaction);
        // Tambah yang baru
        this.addPosTransaction(newTransaction);
    },

    // ========== RESET OPTIONS ==========
    showResetOptions() {
        const currentCash = parseInt(dataManager.data.settings?.currentCash) || 0;
        const currentModal = parseInt(dataManager.data.settings?.modalAwal) || 0;
        const todayCashSales = this.getTodayCashSales();
        
        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal active" id="resetOptionsModal" style="display: flex; align-items: center; justify-content: center; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 2000;">
                <div class="modal-content" style="background: white; border-radius: 16px; width: 90%; max-width: 400px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
                    <div class="modal-header" style="padding: 20px 24px; border-bottom: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: center;">
                        <span class="modal-title" style="font-size: 18px; font-weight: 700; color: #333;">🔄 Pengaturan Shift Baru</span>
                        <button class="close-btn" onclick="cashModule.closeModal('resetOptionsModal')" style="background: none; border: none; font-size: 28px; cursor: pointer; color: #999;">×</button>
                    </div>
                    
                    <div style="padding: 24px;">
                        <div style="background: #f5f5f5; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
                            <div style="font-size: 13px; color: #666; margin-bottom: 8px;">Kas Saat Ini</div>
                            <div style="font-size: 24px; font-weight: 700; color: #333;">Rp ${utils.formatNumber(currentCash)}</div>
                            <div style="font-size: 12px; color: #999; margin-top: 4px;">
                                Modal: Rp ${utils.formatNumber(currentModal)} | Penjualan Cash Hari Ini: Rp ${utils.formatNumber(todayCashSales)}
                            </div>
                        </div>

                        <div style="display: grid; gap: 12px;">
                            <button onclick="cashModule.resetToZero()" 
                                    style="padding: 16px; background: #ffebee; border: 2px solid #f44336; border-radius: 12px; cursor: pointer; text-align: left;">
                                <div style="font-weight: 700; color: #c62828; margin-bottom: 4px;">🗑️ Reset ke Rp 0</div>
                                <div style="font-size: 12px; color: #666;">Kas dan modal direset ke 0. Gunakan ini untuk hari baru.</div>
                            </button>
                            
                            <button onclick="cashModule.setNewModal()" 
                                    style="padding: 16px; background: #e8f5e9; border: 2px solid #4caf50; border-radius: 12px; cursor: pointer; text-align: left;">
                                <div style="font-weight: 700; color: #2e7d32; margin-bottom: 4px;">💰 Input Modal Baru</div>
                                <div style="font-size: 12px; color: #666;">Reset lalu input modal awal untuk shift hari ini.</div>
                            </button>
                            
                            <button onclick="cashModule.carryOverCash()" 
                                    style="padding: 16px; background: #e3f2fd; border: 2px solid #2196f3; border-radius: 12px; cursor: pointer; text-align: left;">
                                <div style="font-weight: 700; color: #1565c0; margin-bottom: 4px;">➡️ Gunakan Kas Kemarin</div>
                                <div style="font-size: 12px; color: #666;">Kas saat ini dijadikan modal untuk hari ini.</div>
                            </button>
                            
                            <button onclick="cashModule.closeModal('resetOptionsModal')" 
                                    style="padding: 12px; background: #f5f5f5; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; color: #666; margin-top: 8px;">
                                Batal
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `);
    },

    saveDayClosing(dateStr) {
        if (!dataManager.data.dailyClosing) {
            dataManager.data.dailyClosing = [];
        }
        
        const transactions = dataManager.data.cashTransactions || [];
        const yesterday = new Date(dateStr);
        yesterday.setHours(0,0,0,0);
        
        const yesterdayTrans = transactions.filter(t => {
            const tDate = new Date(t.date);
            tDate.setHours(0,0,0,0);
            return tDate.getTime() === yesterday.getTime();
        });
        
        const labaKemarin = yesterdayTrans.reduce((sum, t) => {
            if (t.type === 'topup' || t.category === 'tarik_tunai') {
                return sum + (parseInt(t.details?.adminFee) || 0);
            }
            return sum;
        }, 0);
        
        const closingData = {
            date: dateStr,
            closingCash: parseInt(dataManager.data.settings?.currentCash) || 0,
            modalAwal: parseInt(dataManager.data.settings?.modalAwal) || 0,
            laba: labaKemarin,
            timestamp: new Date().toISOString()
        };
        
        dataManager.data.dailyClosing.push(closingData);
        
        if (dataManager.data.dailyClosing.length > 30) {
            dataManager.data.dailyClosing = dataManager.data.dailyClosing.slice(-30);
        }
        
        dataManager.save();
    },

    resetToZero() {
        if (!confirm('⚠️ Yakin reset Kas dan Modal ke Rp 0?\\n\\nSemua transaksi hari ini akan tetap tersimpan tapi kas diatur ke 0.')) {
            return;
        }

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        this.saveDayClosing(yesterday.toDateString());

        dataManager.data.settings.currentCash = 0;
        dataManager.data.settings.modalAwal = 0;
        
        localStorage.setItem('hifzi_last_active_date', new Date().toDateString());
        
        dataManager.save();
        app.updateHeader();
        this.closeModal('resetOptionsModal');
        this.renderHTML();
        this.renderTransactions();
        
        app.showToast('✅ Kas & Modal direset ke Rp 0');
    },

    setNewModal() {
        const newModal = parseInt(prompt('Masukkan Modal Awal untuk hari ini:', '0')) || 0;
        
        if (newModal < 0) {
            app.showToast('Modal tidak boleh negatif!');
            return;
        }

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        this.saveDayClosing(yesterday.toDateString());

        dataManager.data.settings.modalAwal = newModal;
        dataManager.data.settings.currentCash = newModal;
        
        if (newModal > 0) {
            dataManager.data.cashTransactions.push({
                id: Date.now(),
                date: new Date().toISOString(),
                type: 'modal_in',
                amount: newModal,
                category: 'modal_awal',
                note: 'Modal Awal Shift Baru'
            });
        }
        
        localStorage.setItem('hifzi_last_active_date', new Date().toDateString());
        
        dataManager.save();
        app.updateHeader();
        this.closeModal('resetOptionsModal');
        this.renderHTML();
        this.renderTransactions();
        
        app.showToast(`✅ Modal baru: Rp ${utils.formatNumber(newModal)}`);
    },

    carryOverCash() {
        const currentCash = parseInt(dataManager.data.settings?.currentCash) || 0;
        
        if (currentCash <= 0) {
            app.showToast('Kas saat ini Rp 0, tidak bisa carry over!');
            return;
        }

        if (!confirm(`Gunakan Rp ${utils.formatNumber(currentCash)} sebagai modal hari ini?`)) {
            return;
        }

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        this.saveDayClosing(yesterday.toDateString());

        dataManager.data.settings.modalAwal = currentCash;
        
        localStorage.setItem('hifzi_last_active_date', new Date().toDateString());
        
        dataManager.save();
        app.updateHeader();
        this.closeModal('resetOptionsModal');
        this.renderHTML();
        this.renderTransactions();
        
        app.showToast(`✅ Kas Rp ${utils.formatNumber(currentCash)} jadi modal hari ini`);
    },

    // ========== FILTER & STATS ==========
    toggleHistory() {
        this.filterState.showHistory = !this.filterState.showHistory;
        this.renderHTML();
        this.renderTransactions();
    },

    calculatePeriodStats(startDate, endDate) {
        const transactions = dataManager.data.cashTransactions.filter(t => {
            const tDate = new Date(t.date);
            return tDate >= startDate && tDate <= endDate;
        });
        
        // Kas masuk manual (bukan dari POS, bukan modal)
        const manualKasMasuk = transactions
            .filter(t => t.type === 'in')
            .reduce((sum, t) => sum + (parseInt(t.amount) || 0), 0);
        
        // Top up masuk
        const topUpMasuk = transactions
            .filter(t => t.type === 'topup')
            .reduce((sum, t) => sum + (parseInt(t.amount) || 0), 0);
        
        // Kas keluar
        const kasKeluar = transactions
            .filter(t => t.type === 'out')
            .reduce((sum, t) => sum + (parseInt(t.amount) || 0), 0);
        
        // Total kas masuk (untuk tampilan)
        const kasMasuk = manualKasMasuk + topUpMasuk;
        
        // Laba dari admin fee
        const labaTopUp = transactions
            .filter(t => t.type === 'topup')
            .reduce((sum, t) => sum + (parseInt(t.details?.adminFee) || 0), 0);
        
        const labaTarikTunai = transactions
            .filter(t => t.category === 'tarik_tunai')
            .reduce((sum, t) => sum + (parseInt(t.details?.adminFee) || 0), 0);
        
        const laba = labaTopUp + labaTarikTunai;
        
        // Modal masuk
        const modalMasuk = transactions
            .filter(t => t.type === 'modal_in')
            .reduce((sum, t) => sum + (parseInt(t.amount) || 0), 0);
        
        return {
            kasMasuk,
            manualKasMasuk,
            topUpMasuk,
            kasKeluar,
            laba,
            labaTopUp,
            labaTarikTunai,
            modalMasuk,
            totalTransactions: transactions.length
        };
    },

    getDateRangeText(startDate, endDate) {
        const options = { day: 'numeric', month: 'short', year: 'numeric' };
        
        if (this.filterState.preset === 'today') {
            return startDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        } else if (this.filterState.preset === 'yesterday') {
            return startDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        } else if (startDate.toDateString() === endDate.toDateString()) {
            return startDate.toLocaleDateString('id-ID', options);
        } else {
            return `${startDate.toLocaleDateString('id-ID', options)} - ${endDate.toLocaleDateString('id-ID', options)}`;
        }
    },

    applyFilter() {
        const preset = document.getElementById('filterPreset').value;
        const customRange = document.getElementById('customDateRange');
        
        if (preset === 'custom') {
            customRange.style.display = 'flex';
        } else {
            customRange.style.display = 'none';
        }
        
        this.filterState.preset = preset;
        
        this.renderHTML();
        this.renderTransactions();
    },

    getDateRange() {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let startDate, endDate;
        
        switch (this.filterState.preset) {
            case 'today':
                startDate = new Date(today);
                endDate = new Date(today);
                endDate.setHours(23, 59, 59, 999);
                break;
                
            case 'yesterday':
                startDate = new Date(today);
                startDate.setDate(startDate.getDate() - 1);
                endDate = new Date(startDate);
                endDate.setHours(23, 59, 59, 999);
                break;
                
            case 'week':
                const dayOfWeek = today.getDay();
                const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
                startDate = new Date(today.setDate(diff));
                endDate = new Date();
                endDate.setHours(23, 59, 59, 999);
                break;
                
            case 'month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                endDate.setHours(23, 59, 59, 999);
                break;
                
            case 'year':
                startDate = new Date(now.getFullYear(), 0, 1);
                endDate = new Date(now.getFullYear(), 11, 31);
                endDate.setHours(23, 59, 59, 999);
                break;
                
            case 'custom':
                const startInput = document.getElementById('filterStartDate').value;
                const endInput = document.getElementById('filterEndDate').value;
                if (startInput && endInput) {
                    startDate = new Date(startInput);
                    endDate = new Date(endInput);
                    endDate.setHours(23, 59, 59, 999);
                } else {
                    startDate = today;
                    endDate = new Date(today);
                    endDate.setHours(23, 59, 59, 999);
                }
                break;
                
            default:
                startDate = today;
                endDate = new Date(today);
                endDate.setHours(23, 59, 59, 999);
        }
        
        return { startDate, endDate };
    },

    updateStats() {
        const { startDate, endDate } = this.getDateRange();
        const stats = this.calculatePeriodStats(startDate, endDate);
        
        const incomeEl = document.getElementById('todayIncome');
        const expenseEl = document.getElementById('todayExpense');
        
        if (incomeEl) incomeEl.textContent = 'Rp ' + utils.formatNumber(stats.kasMasuk);
        if (expenseEl) expenseEl.textContent = 'Rp ' + utils.formatNumber(stats.kasKeluar);
    },

    getFilterLabel() {
        const labels = {
            'today': 'Hari Ini',
            'yesterday': 'Kemarin',
            'week': 'Minggu Ini',
            'month': 'Bulan Ini',
            'year': 'Tahun Ini',
            'custom': 'Custom'
        };
        return labels[this.filterState.preset] || 'Hari Ini';
    },

    // ========== TRANSACTIONS ==========
    renderTransactions() {
        const container = document.getElementById('cashTransactionList');
        if (!container) return;
        
        if (!this.filterState.showHistory) {
            container.innerHTML = '';
            container.style.maxHeight = '0px';
            return;
        }
        
        container.style.maxHeight = 'none';
        
        const { startDate, endDate } = this.getDateRange();
        
        let transactions = dataManager.data.cashTransactions.filter(t => {
            const tDate = new Date(t.date);
            return tDate >= startDate && tDate <= endDate;
        }).sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // Hitung summary
        const totalKasMasuk = transactions
            .filter(t => (t.type === 'in' || t.type === 'topup') && t.type !== 'modal_in')
            .reduce((sum, t) => sum + (parseInt(t.amount) || 0), 0);
            
        const totalKasKeluar = transactions
            .filter(t => t.type === 'out')
            .reduce((sum, t) => sum + (parseInt(t.amount) || 0), 0);
        
        const totalLabaTopUp = transactions
            .filter(t => t.type === 'topup')
            .reduce((sum, t) => sum + (parseInt(t.details?.adminFee) || 0), 0);
        
        const totalLabaTarikTunai = transactions
            .filter(t => t.category === 'tarik_tunai')
            .reduce((sum, t) => sum + (parseInt(t.details?.adminFee) || 0), 0);
        
        const totalLaba = totalLabaTopUp + totalLabaTarikTunai;
        
        const totalModal = transactions
            .filter(t => t.type === 'modal_in')
            .reduce((sum, t) => sum + (parseInt(t.amount) || 0), 0);
        
        const totalPosSales = transactions
            .filter(t => t.type === 'pos_sale')
            .reduce((sum, t) => sum + (parseInt(t.amount) || 0), 0);
        
        const summaryEl = document.getElementById('filterSummary');
        if (summaryEl) {
            const periodLabel = this.getFilterLabel();
            summaryEl.innerHTML = `
                <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px; align-items: flex-start;">
                    <div>
                        <div style="font-size: 16px; font-weight: 600; color: #333; margin-bottom: 4px;">
                            Ringkasan ${periodLabel}
                        </div>
                        <div style="font-size: 13px; color: #666;">
                            ${transactions.length} transaksi kas
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="color: #2e7d32; font-weight: 600; font-size: 15px;">⬇️ Kas Masuk: Rp ${utils.formatNumber(totalKasMasuk)}</div>
                        <div style="color: #c62828; font-weight: 600; font-size: 15px; margin: 4px 0;">⬆️ Kas Keluar: Rp ${utils.formatNumber(totalKasKeluar)}</div>
                        ${totalModal > 0 ? `<div style="color: #f57f17; font-weight: 600; font-size: 14px; margin: 4px 0;">💰 Modal: Rp ${utils.formatNumber(totalModal)}</div>` : ''}
                        ${totalPosSales > 0 ? `<div style="color: #2196f3; font-weight: 600; font-size: 14px; margin: 4px 0;">🛒 Penjualan POS: Rp ${utils.formatNumber(totalPosSales)}</div>` : ''}
                        <div style="font-weight: 700; font-size: 16px; color: #6a1b9a; padding-top: 8px; border-top: 2px solid #e0e0e0; margin-top: 8px;">
                            💰 Laba Bersih: Rp ${utils.formatNumber(totalLaba)}
                        </div>
                    </div>
                </div>
            `;
        }
        
        if (transactions.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 48px 20px; color: #999;">
                    <div style="font-size: 64px; margin-bottom: 16px;">📋</div>
                    <p style="font-size: 16px; margin: 0;">Belum ada transaksi ${this.getFilterLabel().toLowerCase()}</p>
                    <p style="font-size: 13px; margin-top: 8px; opacity: 0.7;">Transaksi kas masuk dan keluar akan muncul di sini</p>
                </div>
            `;
            return;
        }
        
        const grouped = this.groupByDate(transactions);
        
        let html = '';
        Object.keys(grouped).forEach(dateKey => {
            const dayTrans = grouped[dateKey];
            
            const dayLaba = dayTrans.reduce((sum, t) => {
                if (t.type === 'topup' || t.category === 'tarik_tunai') {
                    return sum + (parseInt(t.details?.adminFee) || 0);
                }
                return sum;
            }, 0);
            
            const dayKasNet = dayTrans.reduce((sum, t) => {
                const amt = parseInt(t.amount) || 0;
                if (t.type === 'modal_in') return sum;
                if (t.type === 'in' || t.type === 'topup' || t.type === 'pos_sale') {
                    return sum + amt;
                } else if (t.type === 'out' || t.type === 'pos_void') {
                    return sum - amt;
                }
                return sum;
            }, 0);
            
            html += `
                <div style="background: #f5f5f5; padding: 10px 16px; margin: 16px 0 8px 0; border-radius: 8px; font-weight: 600; font-size: 14px; color: #555; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                    <span>${dateKey}</span>
                    <div style="display: flex; gap: 12px; align-items: center;">
                        ${dayLaba > 0 ? `<span style="color: #9c27b0; font-size: 12px; font-weight: 700;">💰 Laba: Rp ${utils.formatNumber(dayLaba)}</span>` : ''}
                        <span style="color: ${dayKasNet >= 0 ? '#4caf50' : '#f44336'}; font-weight: 700;">
                            Kas: ${dayKasNet >= 0 ? '+' : ''}Rp ${utils.formatNumber(Math.abs(dayKasNet))}
                        </span>
                    </div>
                </div>
            `;
            
            dayTrans.forEach(t => {
                const isIncome = t.type === 'in' || t.type === 'modal_in' || t.type === 'topup' || t.type === 'pos_sale';
                const prefix = isIncome ? '+' : '-';
                const amountColor = isIncome ? '#2e7d32' : '#c62828';
                
                let typeLabel = '';
                let labaBadge = '';
                let modalBadge = '';
                let posBadge = '';
                
                if (t.type === 'modal_in') {
                    typeLabel = ' (Modal)';
                    modalBadge = `<span style="background: #fff8e1; color: #f57f17; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; margin-left: 8px;">MODAL</span>`;
                } else if (t.type === 'topup') {
                    typeLabel = ' (Top Up)';
                    const adminFee = parseInt(t.details?.adminFee) || 0;
                    if (adminFee > 0) {
                        labaBadge = `<span style="background: #f3e5f5; color: #6a1b9a; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; margin-left: 8px;">Laba: Rp ${utils.formatNumber(adminFee)}</span>`;
                    }
                } else if (t.category === 'tarik_tunai') {
                    typeLabel = ' (Tarik Tunai)';
                    const adminFee = parseInt(t.details?.adminFee) || 0;
                    if (adminFee > 0) {
                        labaBadge = `<span style="background: #e3f2fd; color: #1565c0; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; margin-left: 8px;">Laba: Rp ${utils.formatNumber(adminFee)}</span>`;
                    }
                } else if (t.type === 'pos_sale') {
                    typeLabel = ' (POS)';
                    posBadge = `<span style="background: #e3f2fd; color: #1565c0; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; margin-left: 8px;">AUTO</span>`;
                } else if (t.type === 'pos_void') {
                    typeLabel = ' (Batal POS)';
                    posBadge = `<span style="background: #ffebee; color: #c62828; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; margin-left: 8px;">VOID</span>`;
                }
                
                const timeStr = new Date(t.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                
                // Untuk POS transaction, jangan tampilkan tombol hapus
                const showDelete = t.type !== 'pos_sale' && t.type !== 'pos_void';
                
                html += `
                    <div class="transaction-item" style="display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; border-bottom: 1px solid #f0f0f0; transition: background 0.2s;" onmouseover="this.style.background='#fafafa'" onmouseout="this.style.background='transparent'">
                        <div class="transaction-info" style="flex: 1;">
                            <div class="transaction-title" style="font-weight: 600; margin-bottom: 4px; color: #333; font-size: 14px; display: flex; align-items: center; flex-wrap: wrap;">
                                ${t.note || t.category}${typeLabel}
                                ${labaBadge}
                                ${modalBadge}
                                ${posBadge}
                            </div>
                            <div class="transaction-meta" style="font-size: 12px; color: #999;">${timeStr}</div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div class="transaction-amount" style="font-weight: 700; font-size: 16px; color: ${amountColor};">
                                ${prefix} Rp ${utils.formatNumber(t.amount)}
                            </div>
                            ${showDelete ? `
                            <button class="btn-delete-cash" data-transaction-id="${t.id}" 
                                    style="width: 36px; height: 36px; border-radius: 50%; background: #ffebee; 
                                           border: 2px solid #f44336; color: #f44336; font-size: 16px; cursor: pointer; 
                                           display: flex; align-items: center; justify-content: center;
                                           transition: all 0.2s;"
                                    onmouseover="this.style.background='#f44336'; this.style.color='white';"
                                    onmouseout="this.style.background='#ffebee'; this.style.color='#f44336';"
                                    title="Hapus transaksi">🗑️</button>
                            ` : '<span style="font-size: 12px; color: #999; font-style: italic;">Auto</span>'}
                        </div>
                    </div>
                `;
            });
        });
        
        container.innerHTML = html;
        this.attachDeleteListeners();
    },

    groupByDate(transactions) {
        const grouped = {};
        
        transactions.forEach(t => {
            const date = new Date(t.date);
            const dateKey = date.toLocaleDateString('id-ID', { 
                weekday: 'short', 
                day: 'numeric', 
                month: 'short',
                year: 'numeric'
            });
            
            if (!grouped[dateKey]) {
                grouped[dateKey] = [];
            }
            grouped[dateKey].push(t);
        });
        
        return grouped;
    },

    attachDeleteListeners() {
        const deleteButtons = document.querySelectorAll('.btn-delete-cash');
        
        deleteButtons.forEach(btn => {
            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const transactionId = parseInt(btn.getAttribute('data-transaction-id'));
                this.deleteTransaction(transactionId);
            };
        });
    },

    deleteTransaction(transactionId) {
        const t = dataManager.data.cashTransactions.find(tr => {
            return tr.id === transactionId || tr.id === transactionId.toString();
        });
        
        if (!t) {
            app.showToast('Transaksi tidak ditemukan!');
            return;
        }
        
        // Jangan hapus transaksi POS dari sini
        if (t.source === 'pos_sale') {
            app.showToast('Transaksi POS hanya bisa dihapus dari menu Transaksi!');
            return;
        }
        
        const confirmMsg = `Hapus transaksi "${t.note || t.category}"?\\n\\nRp ${utils.formatNumber(t.amount)}\\n\\nKas akan disesuaikan.`;
        
        if (!confirm(confirmMsg)) {
            return;
        }
        
        let currentCash = parseInt(dataManager.data.settings.currentCash) || 0;
        
        if (t.type === 'in' || t.type === 'topup') {
            currentCash -= parseInt(t.amount) || 0;
        } else if (t.type === 'out') {
            currentCash += parseInt(t.amount) || 0;
        } else if (t.type === 'modal_in') {
            currentCash -= parseInt(t.amount) || 0;
            dataManager.data.settings.modalAwal = (dataManager.data.settings.modalAwal || 0) - parseInt(t.amount) || 0;
        }
        
        dataManager.data.settings.currentCash = currentCash;
        
        dataManager.data.cashTransactions = dataManager.data.cashTransactions.filter(
            tr => tr.id !== transactionId && tr.id !== transactionId.toString()
        );
        
        if (t.details && t.details.adminFee > 0) {
            dataManager.data.transactions = dataManager.data.transactions.filter(tr => {
                if (tr.type === 'topup_fee' || tr.type === 'tarik_tunai_fee') {
                    const trTime = new Date(tr.date).getTime();
                    const cashTime = new Date(t.date).getTime();
                    return Math.abs(trTime - cashTime) > 2000;
                }
                return true;
            });
        }
        
        dataManager.save();
        app.updateHeader();
        this.renderHTML();
        this.renderTransactions();
        app.showToast('Transaksi dihapus! Kas disesuaikan.');
    },

    openHistory() {
        this.filterState.showHistory = true;
        this.filterState.preset = 'today';
        this.renderHTML();
        this.renderTransactions();
        setTimeout(() => {
            document.getElementById('cashTransactionList')?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    },

    // ========== MODALS ==========
    openModal(type) {
        const isIn = type === 'in';
        
        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal active" id="cashModal" style="display: flex; align-items: center; justify-content: center; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1000;">
                <div class="modal-content" style="background: white; border-radius: 16px; width: 90%; max-width: 500px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
                    <div class="modal-header" style="padding: 20px 24px; border-bottom: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: center;">
                        <span class="modal-title" style="font-size: 20px; font-weight: 700; color: #333;">${isIn ? '💵 Kas Masuk' : '💸 Kas Keluar'}</span>
                        <button class="close-btn" onclick="cashModule.closeModal('cashModal')" style="background: none; border: none; font-size: 28px; cursor: pointer; color: #999; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 50%; transition: all 0.2s;">×</button>
                    </div>
                    
                    <div style="padding: 24px;">
                        <div class="form-group" style="margin-bottom: 20px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #555; font-size: 14px;">Jumlah (Rp)</label>
                            <input type="number" id="cashAmount" placeholder="0" style="width: 100%; padding: 12px 16px; border: 2px solid #e0e0e0; border-radius: 10px; font-size: 18px; font-weight: 600; transition: border-color 0.2s;" onfocus="this.style.borderColor='#667eea'" onblur="this.style.borderColor='#e0e0e0'">
                        </div>
                        
                        <div class="form-group" style="margin-bottom: 20px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #555; font-size: 14px;">Kategori</label>
                            <select id="cashCategory" style="width: 100%; padding: 12px 16px; border: 2px solid #e0e0e0; border-radius: 10px; font-size: 15px; background: white; cursor: pointer;">
                                ${isIn ? `
                                    <option value="penjualan">Penjualan</option>
                                    <option value="lainnya">Lainnya</option>
                                ` : `
                                    <option value="operasional">Biaya Operasional</option>
                                    <option value="gaji">Gaji Karyawan</option>
                                    <option value="lainnya">Lainnya</option>
                                `}
                            </select>
                        </div>
                        
                        <div class="form-group" style="margin-bottom: 24px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #555; font-size: 14px;">Keterangan</label>
                            <textarea id="cashNote" rows="3" placeholder="Catatan transaksi..." style="width: 100%; padding: 12px 16px; border: 2px solid #e0e0e0; border-radius: 10px; font-size: 15px; resize: vertical; font-family: inherit;"></textarea>
                        </div>
                        
                        <div class="modal-footer" style="display: flex; gap: 12px; justify-content: flex-end;">
                            <button class="btn btn-secondary" onclick="cashModule.closeModal('cashModal')" style="padding: 12px 24px; border-radius: 10px; border: 2px solid #e0e0e0; background: white; color: #666; font-weight: 600; cursor: pointer; font-size: 15px;">Batal</button>
                            <button class="btn btn-primary" onclick="cashModule.saveTransaction('${type}')" style="padding: 12px 24px; border-radius: 10px; border: none; background: ${isIn ? '#4caf50' : '#f44336'}; color: white; font-weight: 600; cursor: pointer; font-size: 15px;">Simpan Transaksi</button>
                        </div>
                    </div>
                </div>
            </div>
        `);
    },

    saveTransaction(type) {
        const amount = parseInt(document.getElementById('cashAmount').value) || 0;
        const category = document.getElementById('cashCategory').value;
        const note = document.getElementById('cashNote').value;
        
        if (amount <= 0) {
            app.showToast('Jumlah tidak valid!');
            return;
        }
        
        let currentCash = parseInt(dataManager.data.settings.currentCash) || 0;
        
        // ✅ PERBAIKAN: Kas bisa minus, hapus pengecekan ini
        // if (type === 'out' && amount > currentCash) {
        //     app.showToast('Kas tidak mencukupi!');
        //     return;
        // }
        
        dataManager.data.cashTransactions.push({
            id: Date.now(),
            date: new Date().toISOString(),
            type: type,
            amount: amount,
            category: category,
            note: note
        });
        
        if (type === 'in') {
            dataManager.data.settings.currentCash = currentCash + amount;
        } else {
            dataManager.data.settings.currentCash = currentCash - amount;
        }
        
        dataManager.save();
        app.updateHeader();
        this.closeModal('cashModal');
        this.renderHTML();
        this.renderTransactions();
        app.showToast('Transaksi kas tersimpan!');
    },

    openModalAwal() {
        const today = new Date();
        today.setHours(0,0,0,0);
        
        const existingModal = dataManager.data.cashTransactions.find(t => {
            if (t.type !== 'modal_in') return false;
            const tDate = new Date(t.date);
            tDate.setHours(0,0,0,0);
            return tDate.getTime() === today.getTime();
        });
        
        if (existingModal) {
            if (!confirm(`⚠️ Sudah ada modal hari ini: Rp ${utils.formatNumber(existingModal.amount)}\\n\\nInput modal lagi akan menambah kas. Lanjutkan?`)) {
                return;
            }
        }
        
        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal active" id="modalAwalModal" style="display: flex; align-items: center; justify-content: center; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1000;">
                <div class="modal-content" style="background: white; border-radius: 16px; width: 90%; max-width: 500px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
                    <div class="modal-header" style="padding: 20px 24px; border-bottom: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: center;">
                        <span class="modal-title" style="font-size: 20px; font-weight: 700; color: #333;">💰 Input Modal Awal</span>
                        <button class="close-btn" onclick="cashModule.closeModal('modalAwalModal')" style="background: none; border: none; font-size: 28px; cursor: pointer; color: #999; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 50%;">×</button>
                    </div>
                    
                    <div style="padding: 24px;">
                        <div style="background: #fff8e1; border-left: 4px solid #ffc107; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
                            <div style="font-weight: 600; color: #f57f17; margin-bottom: 4px; font-size: 14px;">📌 Modal Awal Shift</div>
                            <div style="color: #666; font-size: 13px; line-height: 1.5;">
                                ${existingModal ? 
                                    '⚠️ <strong>PERHATIAN:</strong> Sudah ada modal hari ini. Input baru akan menambah kas.' : 
                                    'Modal akan menjadi dasar kas saat ini.<br><strong>Tidak masuk ke perhitungan laba.</strong>'
                                }
                            </div>
                        </div>

                        <div class="form-group" style="margin-bottom: 20px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #555; font-size: 14px;">Jumlah Modal (Rp)</label>
                            <input type="number" id="modalAwalAmount" placeholder="Contoh: 500000" style="width: 100%; padding: 12px 16px; border: 2px solid #e0e0e0; border-radius: 10px; font-size: 18px; font-weight: 600;">
                        </div>
                        
                        <div class="form-group" style="margin-bottom: 24px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #555; font-size: 14px;">Keterangan</label>
                            <textarea id="modalAwalNote" rows="2" style="width: 100%; padding: 12px 16px; border: 2px solid #e0e0e0; border-radius: 10px; font-size: 15px; resize: vertical; font-family: inherit;"></textarea>
                        </div>
                        
                        <div class="modal-footer" style="display: flex; gap: 12px; justify-content: flex-end;">
                            <button class="btn btn-secondary" onclick="cashModule.closeModal('modalAwalModal')" style="padding: 12px 24px; border-radius: 10px; border: 2px solid #e0e0e0; background: white; color: #666; font-weight: 600; cursor: pointer; font-size: 15px;">Batal</button>
                            <button class="btn btn-warning" onclick="cashModule.saveModalAwal()" style="padding: 12px 24px; border-radius: 10px; border: none; background: #ffc107; color: #333; font-weight: 600; cursor: pointer; font-size: 15px;">
                                ${existingModal ? 'Tambah Modal' : 'Simpan Modal'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `);
    },

    saveModalAwal() {
        const amount = parseInt(document.getElementById('modalAwalAmount').value) || 0;
        const note = document.getElementById('modalAwalNote').value || 'Modal Awal Shift';
        
        if (amount <= 0) {
            app.showToast('Jumlah modal harus lebih dari 0!');
            return;
        }
        
        const today = new Date();
        today.setHours(0,0,0,0);
        
        const existingModal = dataManager.data.cashTransactions.find(t => {
            if (t.type !== 'modal_in') return false;
            const tDate = new Date(t.date);
            tDate.setHours(0,0,0,0);
            return tDate.getTime() === today.getTime();
        });
        
        let currentCash = parseInt(dataManager.data.settings.currentCash) || 0;
        
        if (existingModal) {
            dataManager.data.settings.modalAwal = (dataManager.data.settings.modalAwal || 0) + amount;
            dataManager.data.settings.currentCash = currentCash + amount;
            app.showToast(`✅ Tambahan modal Rp ${utils.formatNumber(amount)}. Kas sekarang: Rp ${utils.formatNumber(dataManager.data.settings.currentCash)}`);
        } else {
            dataManager.data.settings.modalAwal = amount;
            dataManager.data.settings.currentCash = currentCash + amount; // Tambah ke kas existing, tidak overwrite
            app.showToast(`✅ Modal awal Rp ${utils.formatNumber(amount)}. Kas sekarang: Rp ${utils.formatNumber(dataManager.data.settings.currentCash)}`);
        }
        
        dataManager.data.cashTransactions.push({
            id: Date.now(),
            date: new Date().toISOString(),
            type: 'modal_in',
            amount: amount,
            category: 'modal_awal',
            note: existingModal ? `${note} (Tambahan)` : note
        });
        
        dataManager.save();
        app.updateHeader();
        this.closeModal('modalAwalModal');
        this.renderHTML();
        this.renderTransactions();
    },

    openTopUp() {
        this.loadCustomProviders();
        
        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal active" id="topUpModal" style="display: flex; align-items: center; justify-content: center; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1000;">
                <div class="modal-content" style="background: white; border-radius: 16px; width: 90%; max-width: 500px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
                    <div class="modal-header" style="padding: 20px 24px; border-bottom: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: center;">
                        <span class="modal-title" style="font-size: 20px; font-weight: 700; color: #333;">💜 Top Up / Transfer</span>
                        <button class="close-btn" onclick="cashModule.closeModal('topUpModal')" style="background: none; border: none; font-size: 28px; cursor: pointer; color: #999; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 50%;">×</button>
                    </div>
                    
                    <div style="padding: 24px;">
                        <div style="background: #f3e5f5; border-left: 4px solid #9c27b0; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
                            <div style="font-weight: 600; color: #6a1b9a; margin-bottom: 4px; font-size: 14px;">💰 Admin Fee = Laba!</div>
                            <div style="color: #666; font-size: 13px; line-height: 1.5;">Total bayar = Nominal + Admin Fee<br>Admin fee masuk ke laba bersih</div>
                        </div>

                        <div class="form-group" style="margin-bottom: 16px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <label style="font-weight: 600; color: #555; font-size: 14px;">Jenis / Provider</label>
                                <div style="display: flex; gap: 8px;">
                                    <button onclick="cashModule.addCustomProvider('topup')" style="padding: 6px 12px; background: #e8f5e9; border: 1px solid #4caf50; border-radius: 6px; color: #2e7d32; font-size: 12px; cursor: pointer; font-weight: 600; transition: all 0.2s;" onmouseover="this.style.background='#4caf50'; this.style.color='white';" onmouseout="this.style.background='#e8f5e9'; this.style.color='#2e7d32';">
                                        ➕ Tambah
                                    </button>
                                    ${this.providers.custom.length > 0 ? `
                                    <button onclick="cashModule.manageCustomProviders()" style="padding: 6px 12px; background: #fff3e0; border: 1px solid #ff9800; border-radius: 6px; color: #e65100; font-size: 12px; cursor: pointer; font-weight: 600; transition: all 0.2s;" onmouseover="this.style.background='#ff9800'; this.style.color='white';" onmouseout="this.style.background='#fff3e0'; this.style.color='#e65100';">
                                        ✏️ Kelola
                                    </button>
                                    ` : ''}
                                </div>
                            </div>
                            <select id="topUpType" style="width: 100%; padding: 12px 16px; border: 2px solid #e0e0e0; border-radius: 10px; font-size: 15px; background: white; cursor: pointer;">
                                ${this.generateProviderOptions()}
                            </select>
                        </div>

                        <div class="form-group" style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #555; font-size: 14px;">Nominal (Rp)</label>
                            <input type="number" id="topUpNominal" placeholder="50000" oninput="cashModule.calcTopUp()" style="width: 100%; padding: 12px 16px; border: 2px solid #e0e0e0; border-radius: 10px; font-size: 16px;">
                        </div>

                        <div class="form-group" style="margin-bottom: 20px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #555; font-size: 14px;">Admin Fee (Rp)</label>
                            <input type="number" id="topUpAdmin" placeholder="1500" oninput="cashModule.calcTopUp()" style="width: 100%; padding: 12px 16px; border: 2px solid #e0e0e0; border-radius: 10px; font-size: 16px;">
                        </div>
                        
                        <div style="background: #f3e5f5; padding: 16px; border-radius: 10px; margin-bottom: 24px;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 15px;">
                                <span>Total Bayar:</span>
                                <span id="topUpTotal" style="font-weight: 700;">Rp 0</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; color: #6a1b9a; font-weight: 700; font-size: 16px;">
                                <span>💰 Laba (Admin):</span>
                                <span id="topUpProfit">Rp 0</span>
                            </div>
                        </div>
                        
                        <div class="modal-footer" style="display: flex; gap: 12px; justify-content: flex-end;">
                            <button class="btn btn-secondary" onclick="cashModule.closeModal('topUpModal')" style="padding: 12px 24px; border-radius: 10px; border: 2px solid #e0e0e0; background: white; color: #666; font-weight: 600; cursor: pointer; font-size: 15px;">Batal</button>
                            <button class="btn btn-primary" onclick="cashModule.saveTopUp()" style="padding: 12px 24px; border-radius: 10px; border: none; background: #9c27b0; color: white; font-weight: 600; cursor: pointer; font-size: 15px;">Proses</button>
                        </div>
                    </div>
                </div>
            </div>
        `);
    },

    calcTopUp() {
        const nominal = parseInt(document.getElementById('topUpNominal')?.value) || 0;
        const admin = parseInt(document.getElementById('topUpAdmin')?.value) || 0;
        
        const totalEl = document.getElementById('topUpTotal');
        const profitEl = document.getElementById('topUpProfit');
        
        if (totalEl) totalEl.textContent = 'Rp ' + utils.formatNumber(nominal + admin);
        if (profitEl) profitEl.textContent = 'Rp ' + utils.formatNumber(admin);
    },

    saveTopUp() {
        const nominal = parseInt(document.getElementById('topUpNominal').value) || 0;
        const admin = parseInt(document.getElementById('topUpAdmin').value) || 0;
        const type = document.getElementById('topUpType').value;
        
        if (nominal <= 0) {
            app.showToast('Nominal wajib diisi!');
            return;
        }
        
        let providerLabel = type.toUpperCase();
        let providerIcon = '💳';
        
        const allProviders = [...this.providers.ewallet, ...this.providers.bank, ...this.providers.custom];
        const provider = allProviders.find(p => p.value === type);
        if (provider) {
            providerLabel = provider.label;
            providerIcon = provider.icon;
        }
        
        const total = nominal + admin;
        
        let currentCash = parseInt(dataManager.data.settings.currentCash) || 0;
        dataManager.data.settings.currentCash = currentCash + total;
        
        dataManager.data.cashTransactions.push({
            id: Date.now(),
            date: new Date().toISOString(),
            type: 'topup',
            amount: total,
            category: 'topup_' + type,
            note: `${providerIcon} Top Up ${providerLabel}`,
            details: { 
                nominal, 
                adminFee: admin,
                provider: type,
                providerLabel: providerLabel
            }
        });
        
        if (admin > 0) {
            dataManager.data.transactions.push({
                id: Date.now() + 1,
                date: new Date().toISOString(),
                items: [{
                    name: `Admin Fee Top Up ${providerLabel}`,
                    price: admin,
                    cost: 0,
                    qty: 1
                }],
                total: admin,
                profit: admin,
                paymentMethod: 'cash',
                status: 'completed',
                type: 'topup_fee'
            });
        }
        
        dataManager.save();
        app.updateHeader();
        this.closeModal('topUpModal');
        this.renderHTML();
        this.renderTransactions();
        app.showToast(`${providerIcon} Top up ${providerLabel} berhasil! Kas +Rp ${utils.formatNumber(total)}, Laba: Rp ${utils.formatNumber(admin)}`);
    },

    openTarikTunai() {
        this.loadCustomProviders();
        
        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal active" id="tarikTunaiModal" style="display: flex; align-items: center; justify-content: center; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1000;">
                <div class="modal-content" style="background: white; border-radius: 16px; width: 90%; max-width: 500px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
                    <div class="modal-header" style="padding: 20px 24px; border-bottom: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: center;">
                        <span class="modal-title" style="font-size: 20px; font-weight: 700; color: #333;">🏧 Tarik Tunai</span>
                        <button class="close-btn" onclick="cashModule.closeModal('tarikTunaiModal')" style="background: none; border: none; font-size: 28px; cursor: pointer; color: #999; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 50%;">×</button>
                    </div>
                    
                    <div style="padding: 24px;">
                        <div style="background: #e3f2fd; border-left: 4px solid #2196f3; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
                            <div style="font-weight: 600; color: #1565c0; margin-bottom: 4px; font-size: 14px;">💰 Admin Fee = Laba!</div>
                            <div style="color: #666; font-size: 13px; line-height: 1.5;">Nominal = Uang diberikan ke customer<br>Admin fee = Keuntungan konter</div>
                        </div>

                        <div class="form-group" style="margin-bottom: 16px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <label style="font-weight: 600; color: #555; font-size: 14px;">Provider / Tujuan</label>
                                <div style="display: flex; gap: 8px;">
                                    <button onclick="cashModule.addCustomProvider('tarik')" style="padding: 6px 12px; background: #e8f5e9; border: 1px solid #4caf50; border-radius: 6px; color: #2e7d32; font-size: 12px; cursor: pointer; font-weight: 600; transition: all 0.2s;" onmouseover="this.style.background='#4caf50'; this.style.color='white';" onmouseout="this.style.background='#e8f5e9'; this.style.color='#2e7d32';">
                                        ➕ Tambah
                                    </button>
                                    ${this.providers.custom.length > 0 ? `
                                    <button onclick="cashModule.manageCustomProviders()" style="padding: 6px 12px; background: #fff3e0; border: 1px solid #ff9800; border-radius: 6px; color: #e65100; font-size: 12px; cursor: pointer; font-weight: 600; transition: all 0.2s;" onmouseover="this.style.background='#ff9800'; this.style.color='white';" onmouseout="this.style.background='#fff3e0'; this.style.color='#e65100';">
                                        ✏️ Kelola
                                    </button>
                                    ` : ''}
                                </div>
                            </div>
                            <select id="tarikType" style="width: 100%; padding: 12px 16px; border: 2px solid #e0e0e0; border-radius: 10px; font-size: 15px; background: white; cursor: pointer;">
                                ${this.generateProviderOptions()}
                            </select>
                        </div>

                        <div class="form-group" style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #555; font-size: 14px;">Nominal Tarik (Rp)</label>
                            <input type="number" id="tarikNominal" placeholder="100000" oninput="cashModule.calcTarik()" style="width: 100%; padding: 12px 16px; border: 2px solid #e0e0e0; border-radius: 10px; font-size: 16px;">
                        </div>

                        <div class="form-group" style="margin-bottom: 20px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #555; font-size: 14px;">Admin Fee (Rp)</label>
                            <input type="number" id="tarikAdmin" placeholder="2500" oninput="cashModule.calcTarik()" style="width: 100%; padding: 12px 16px; border: 2px solid #e0e0e0; border-radius: 10px; font-size: 16px;">
                        </div>
                        
                        <div style="background: #e3f2fd; padding: 16px; border-radius: 10px; margin-bottom: 24px;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 15px;">
                                <span>Total Keluar dari Kas:</span>
                                <span id="tarikTotal" style="font-weight: 700; color: #f44336;">Rp 0</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; color: #1565c0; font-weight: 700; font-size: 16px;">
                                <span>💰 Laba (Admin):</span>
                                <span id="tarikProfit">Rp 0</span>
                            </div>
                        </div>
                        
                        <div class="modal-footer" style="display: flex; gap: 12px; justify-content: flex-end;">
                            <button class="btn btn-secondary" onclick="cashModule.closeModal('tarikTunaiModal')" style="padding: 12px 24px; border-radius: 10px; border: 2px solid #e0e0e0; background: white; color: #666; font-weight: 600; cursor: pointer; font-size: 15px;">Batal</button>
                            <button class="btn btn-info" onclick="cashModule.saveTarikTunai()" style="padding: 12px 24px; border-radius: 10px; border: none; background: #2196f3; color: white; font-weight: 600; cursor: pointer; font-size: 15px;">Proses</button>
                        </div>
                    </div>
                </div>
            </div>
        `);
    },

    calcTarik() {
        const nominal = parseInt(document.getElementById('tarikNominal')?.value) || 0;
        const admin = parseInt(document.getElementById('tarikAdmin')?.value) || 0;
        
        const totalEl = document.getElementById('tarikTotal');
        const profitEl = document.getElementById('tarikProfit');
        
        if (totalEl) totalEl.textContent = 'Rp ' + utils.formatNumber(nominal + admin);
        if (profitEl) profitEl.textContent = 'Rp ' + utils.formatNumber(admin);
    },

    saveTarikTunai() {
        const nominal = parseInt(document.getElementById('tarikNominal').value) || 0;
        const admin = parseInt(document.getElementById('tarikAdmin').value) || 0;
        const type = document.getElementById('tarikType').value;
        const total = nominal + admin;
        
        if (nominal <= 0) {
            app.showToast('Nominal wajib diisi!');
            return;
        }
        
        let currentCash = parseInt(dataManager.data.settings.currentCash) || 0;
        
        // ✅ PERBAIKAN: Kas bisa minus, hanya warning saja
        if (total > currentCash) {
            if (!confirm(`⚠️ Kas akan minus!\\n\\nKas saat ini: Rp ${utils.formatNumber(currentCash)}\\nTotal keluar: Rp ${utils.formatNumber(total)}\\n\\nSisa kas: Rp ${utils.formatNumber(currentCash - total)}\\n\\nLanjutkan?`)) {
                return;
            }
        }
        
        let providerLabel = type.toUpperCase();
        let providerIcon = '💳';
        
        const allProviders = [...this.providers.ewallet, ...this.providers.bank, ...this.providers.custom];
        const provider = allProviders.find(p => p.value === type);
        if (provider) {
            providerLabel = provider.label;
            providerIcon = provider.icon;
        }
        
        dataManager.data.settings.currentCash = currentCash - total;
        
        dataManager.data.cashTransactions.push({
            id: Date.now(),
            date: new Date().toISOString(),
            type: 'out',
            amount: total,
            category: 'tarik_tunai',
            note: `${providerIcon} Tarik Tunai ${providerLabel}`,
            details: { 
                nominal, 
                adminFee: admin,
                provider: type,
                providerLabel: providerLabel
            }
        });
        
        if (admin > 0) {
            dataManager.data.transactions.push({
                id: Date.now() + 1,
                date: new Date().toISOString(),
                items: [{
                    name: `Admin Fee Tarik Tunai ${providerLabel}`,
                    price: admin,
                    cost: 0,
                    qty: 1
                }],
                total: admin,
                profit: admin,
                paymentMethod: 'cash',
                status: 'completed',
                type: 'tarik_tunai_fee'
            });
        }
        
        dataManager.save();
        app.updateHeader();
        this.closeModal('tarikTunaiModal');
        this.renderHTML();
        this.renderTransactions();
        app.showToast(`${providerIcon} Tarik tunai ${providerLabel} berhasil! Kas -Rp ${utils.formatNumber(total)}, Laba: Rp ${utils.formatNumber(admin)}`);
    },

    closeModal(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.remove();
        }
    },

    // ========== UTILITIES ==========
    
    /**
     * ✅ PERBAIKAN: Hitung kas aktual yang benar
     * Termasuk modal, transaksi manual, top up, dan penjualan POS
     */
    calculateActualCash() {
        let cash = 0;
        
        // 1. Modal Awal
        const modalAwal = parseInt(dataManager.data.settings?.modalAwal) || 0;
        cash += modalAwal;
        
        // 2. Transaksi Kas Manual + POS
        if (dataManager.data.cashTransactions && Array.isArray(dataManager.data.cashTransactions)) {
            dataManager.data.cashTransactions.forEach(t => {
                const amount = parseInt(t.amount) || 0;
                
                // Skip modal_in karena sudah dihitung di modalAwal
                if (t.type === 'modal_in') return;
                
                // POS Sale masuk sebagai kas
                if (t.type === 'in' || t.type === 'topup' || t.type === 'pos_sale') {
                    cash += amount;
                } else if (t.type === 'out' || t.type === 'pos_void') {
                    cash -= amount;
                }
            });
        }
        
        return cash;
    },

    /**
     * ✅ PERBAIKAN: Recalculate yang lebih akurat
     */
    recalculateCash() {
        const currentCash = parseInt(dataManager.data.settings?.currentCash) || 0;
        const calculatedCash = this.calculateActualCash();
        const selisih = currentCash - calculatedCash;

        // Hitung penjualan hari ini
        const todayCashSales = this.getTodayCashSales();
        const todayNonCashSales = this.getTodayNonCashSales();

        if (!confirm(`🔄 Recalculate Kas?

Kas Tercatat: Rp ${utils.formatNumber(currentCash)}
Hitungan Ulang: Rp ${utils.formatNumber(calculatedCash)}
Selisih: Rp ${utils.formatNumber(selisih)}

Penjualan Cash hari ini: Rp ${utils.formatNumber(todayCashSales)}
Penjualan Non-Cash hari ini: Rp ${utils.formatNumber(todayNonCashSales)}

Lanjutkan sinkronisasi?`)) {
            return;
        }

        // Sinkronkan currentCash dengan calculatedCash
        dataManager.data.settings.currentCash = calculatedCash;
        dataManager.save();
        
        app.updateHeader();
        this.renderHTML();
        this.renderTransactions();
        
        app.showToast(`✅ Kas tersinkron: Rp ${utils.formatNumber(calculatedCash)}`);
    },

    /**
     * ✅ HELPER: Hitung penjualan cash hari ini
     */
    getTodayCashSales() {
        const today = new Date().toDateString();
        return (dataManager.data.transactions || [])
            .filter(t => {
                if (t.status === 'deleted' || t.status === 'voided') return false;
                if (t.paymentMethod !== 'cash') return false;
                const tDate = new Date(t.date).toDateString();
                return tDate === today;
            })
            .reduce((sum, t) => sum + (parseInt(t.total) || 0), 0);
    },

    /**
     * ✅ HELPER: Hitung penjualan non-cash hari ini
     */
    getTodayNonCashSales() {
        const today = new Date().toDateString();
        return (dataManager.data.transactions || [])
            .filter(t => {
                if (t.status === 'deleted' || t.status === 'voided') return false;
                if (t.paymentMethod === 'cash') return false;
                const tDate = new Date(t.date).toDateString();
                return tDate === today;
            })
            .reduce((sum, t) => sum + (parseInt(t.total) || 0), 0);
    }
};

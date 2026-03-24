// ============================================
// CASH MODULE - Hifzi Cell POS - Multi-User Edition
// ============================================

const cashModule = {
    currentDeleteTransaction: null,
    
    filterState: {
        startDate: null,
        endDate: null,
        preset: 'today',
        showHistory: false
    },
    
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
            if (typeof dataManager.data.settings.currentCash !== 'number' || isNaN(dataManager.data.settings.currentCash)) {
                dataManager.data.settings.currentCash = 0;
            }
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
        
        if (lastActiveDate !== today) {
            console.log('Hari baru terdeteksi, menunggu user setup shift');
        }
    },

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

    // ✅ PERUBAHAN: Render HTML dengan user info
    renderHTML() {
        const periodLabel = this.getFilterLabel();
        const { startDate, endDate } = this.getDateRange();
        
        const periodStats = this.calculatePeriodStats(startDate, endDate);
        const dateRangeText = this.getDateRangeText(startDate, endDate);
        
        // ✅ PERUBAHAN: Ambil current user dan shift
        const currentUser = dataManager.getCurrentUser();
        const userShift = currentUser ? dataManager.getUserShift(currentUser.userId) : null;
        
        // ✅ PERUBAHAN: Tampilkan kas berdasarkan role
        let currentCash = 0;
        let modalAwal = 0;
        
        if (currentUser && (currentUser.role === 'owner' || currentUser.role === 'admin')) {
            // Owner/Admin lihat total kas global
            currentCash = parseInt(dataManager.data.settings?.currentCash) || 0;
            modalAwal = parseInt(dataManager.data.settings?.modalAwal) || 0;
        } else if (userShift) {
            // Kasir lihat kas shift sendiri
            currentCash = userShift.currentCash || 0;
            modalAwal = userShift.modalAwal || 0;
        }
        
        const calculatedCash = this.calculateActualCash();
        const todayCashSales = this.getTodayCashSales();
        const todayNonCashSales = this.getTodayNonCashSales();
        
        const selisih = currentCash - calculatedCash;
        const needsRepair = Math.abs(selisih) > 100;
        
        const lastActiveDate = localStorage.getItem('hifzi_last_active_date');
        const today = new Date().toDateString();
        const isNewDay = lastActiveDate && lastActiveDate !== today;

        // ✅ PERUBAHAN: Info user aktif
        const activeShifts = dataManager.getActiveShifts();
        const userInfoHtml = currentUser ? `
            <div style="background: #e3f2fd; border-radius: 12px; padding: 12px 16px; margin-bottom: 15px; border-left: 4px solid #2196f3;">
                <div style="font-size: 13px; color: #1565c0; font-weight: 600;">
                    👤 ${currentUser.name} (${currentUser.role})
                </div>
                ${userShift ? `
                    <div style="font-size: 12px; color: #666; margin-top: 4px;">
                        Shift aktif sejak: ${new Date(userShift.openTime).toLocaleTimeString('id-ID')}
                    </div>
                ` : `
                    <div style="font-size: 12px; color: #999; margin-top: 4px;">
                        Anda belum membuka kasir
                    </div>
                `}
            </div>
        ` : '';

        document.getElementById('mainContent').innerHTML = `
            <div class="content-section active" id="cashSection">
                ${userInfoHtml}
                
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

                <!-- ✅ PERUBAHAN: Info Kas di Tangan -->
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px; padding: 24px; margin-bottom: 20px; 
                     box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4); color: white;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px;">
                        <div>
                            <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">
                                💰 Kas di Tangan ${currentUser && (currentUser.role === 'owner' || currentUser.role === 'admin') ? '(Global)' : '(Shift Anda)'}
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

                <!-- User Aktif Info (Owner/Admin only) -->
                ${currentUser && (currentUser.role === 'owner' || currentUser.role === 'admin') && activeShifts.length > 0 ? `
                <div style="background: #e8f5e9; border-radius: 12px; padding: 16px 20px; margin-bottom: 20px; 
                     box-shadow: 0 2px 8px rgba(0,0,0,0.08); border-left: 4px solid #4caf50;">
                    <div style="font-size: 14px; font-weight: 600; color: #2e7d32; margin-bottom: 8px;">
                        👥 User dengan Shift Aktif (${activeShifts.length})
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px;">
                        ${activeShifts.map(s => `
                            <div style="background: white; padding: 10px; border-radius: 8px; font-size: 13px;">
                                <div style="font-weight: 600;">${s.userName}</div>
                                <div style="color: #666; font-size: 11px;">${s.userRole} • Kas: Rp ${utils.formatNumber(s.currentCash || 0)}</div>
                            </div>
                        `).join('')}
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

    getDateRange() {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let startDate, endDate;

        switch(this.filterState.preset) {
            case 'today':
                startDate = today;
                endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1);
                break;
            case 'yesterday':
                startDate = new Date(today.getTime() - 24 * 60 * 60 * 1000);
                endDate = new Date(today.getTime() - 1);
                break;
            case 'week':
                const dayOfWeek = today.getDay();
                const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
                startDate = new Date(today.setDate(diff));
                endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
                break;
            case 'month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
                break;
            case 'year':
                startDate = new Date(now.getFullYear(), 0, 1);
                endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
                break;
            case 'custom':
                const startInput = document.getElementById('filterStartDate');
                const endInput = document.getElementById('filterEndDate');
                if (startInput && startInput.value) {
                    startDate = new Date(startInput.value);
                    startDate.setHours(0, 0, 0, 0);
                } else {
                    startDate = today;
                }
                if (endInput && endInput.value) {
                    endDate = new Date(endInput.value);
                    endDate.setHours(23, 59, 59, 999);
                } else {
                    endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1);
                }
                break;
            default:
                startDate = today;
                endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1);
        }

        return { startDate, endDate };
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

    getDateRangeText(startDate, endDate) {
        if (this.filterState.preset === 'today') {
            return startDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        } else if (this.filterState.preset === 'yesterday') {
            return startDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        } else if (this.filterState.preset === 'custom') {
            const startStr = startDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
            const endStr = endDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
            return `${startStr} - ${endStr}`;
        } else {
            return startDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) + ' s/d ' + 
                   endDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        }
    },

    groupByDate(transactions) {
        const grouped = {};
        transactions.forEach(t => {
            const date = new Date(t.date);
            const dateKey = date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
            
            if (!grouped[dateKey]) {
                grouped[dateKey] = [];
            }
            grouped[dateKey].push(t);
        });
        return grouped;
    },

    applyFilter() {
        const preset = document.getElementById('filterPreset').value;
        this.filterState.preset = preset;
        
        const customRange = document.getElementById('customDateRange');
        if (customRange) {
            customRange.style.display = preset === 'custom' ? 'flex' : 'none';
        }
        
        this.renderHTML();
        this.renderTransactions();
    },

    toggleHistory() {
        this.filterState.showHistory = !this.filterState.showHistory;
        const icon = document.getElementById('historyToggleIcon');
        const list = document.getElementById('cashTransactionList');
        
        if (icon) {
            icon.style.transform = this.filterState.showHistory ? 'rotate(180deg)' : 'rotate(0deg)';
        }
        
        if (list) {
            if (this.filterState.showHistory) {
                list.style.maxHeight = 'none';
                list.style.minHeight = '200px';
            } else {
                list.style.maxHeight = '0px';
                list.style.minHeight = '0px';
            }
        }
        
        this.renderTransactions();
    },

    // ✅ PERUBAHAN: Calculate Period Stats dengan filter user
    calculatePeriodStats(startDate, endDate) {
        const currentUser = dataManager.getCurrentUser();
        
        let transactions = dataManager.data.cashTransactions.filter(t => {
            const tDate = new Date(t.date);
            const inRange = tDate >= startDate && tDate <= endDate;
            
            // ✅ PERUBAHAN: Jika bukan owner/admin, hanya lihat transaksi sendiri
            if (currentUser && currentUser.role !== 'owner' && currentUser.role !== 'admin') {
                return inRange && (t.userId === currentUser.userId || !t.userId);
            }
            
            return inRange;
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

    // ✅ PERUBAHAN: Render Transactions dengan filter user
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
        const currentUser = dataManager.getCurrentUser();
        
        // ✅ PERUBAHAN: Filter berdasarkan user role
        let transactions = dataManager.data.cashTransactions.filter(t => {
            const tDate = new Date(t.date);
            const inRange = tDate >= startDate && tDate <= endDate;
            
            // Jika bukan owner/admin, hanya lihat transaksi sendiri
            if (currentUser && currentUser.role !== 'owner' && currentUser.role !== 'admin') {
                return inRange && (t.userId === currentUser.userId || !t.userId);
            }
            
            return inRange;
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
                            ${currentUser && (currentUser.role === 'owner' || currentUser.role === 'admin') ? '' : '<span style="font-size: 12px; color: #999;">(Shift Anda)</span>'}
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
                let userBadge = '';
                
                // ✅ PERUBAHAN: Tampilkan info user untuk owner/admin
                if (currentUser && (currentUser.role === 'owner' || currentUser.role === 'admin') && t.userId) {
                    const user = dataManager.getUsers().find(u => u.id === t.userId);
                    if (user) {
                        userBadge = `<span style="background: #e3f2fd; color: #1565c0; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; margin-left: 8px;">👤 ${user.name}</span>`;
                    }
                }
                
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
                
                const showDelete = t.type !== 'pos_sale' && t.type !== 'pos_void';
                
                html += `
                    <div class="transaction-item" style="display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; border-bottom: 1px solid #f0f0f0; transition: background 0.2s;" onmouseover="this.style.background='#fafafa'" onmouseout="this.style.background='transparent'">
                        <div class="transaction-info" style="flex: 1;">
                            <div class="transaction-title" style="font-weight: 600; margin-bottom: 4px; color: #333; font-size: 14px; display: flex; align-items: center; flex-wrap: wrap;">
                                ${t.note || t.category}${typeLabel}
                                ${labaBadge}
                                ${modalBadge}
                                ${posBadge}
                                ${userBadge}
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

    attachDeleteListeners() {
        document.querySelectorAll('.btn-delete-cash').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.getAttribute('data-transaction-id');
                this.deleteTransaction(id);
            });
        });
    },

    deleteTransaction(id) {
        const transaction = dataManager.data.cashTransactions.find(t => t.id === id);
        if (!transaction) return;

        if (!confirm(`Hapus transaksi "${transaction.note || transaction.category}" sebesar Rp ${utils.formatNumber(transaction.amount)}?`)) {
            return;
        }

        const currentUser = dataManager.getCurrentUser();
        
        // Reverse the transaction effect
        if (transaction.type === 'in' || transaction.type === 'modal_in' || transaction.type === 'topup') {
            dataManager.data.settings.currentCash = (parseInt(dataManager.data.settings.currentCash) || 0) - parseInt(transaction.amount);
            
            // ✅ PERUBAHAN: Update user shift
            if (currentUser) {
                const userShift = dataManager.getUserShift(currentUser.userId);
                if (userShift) {
                    userShift.currentCash = (userShift.currentCash || 0) - parseInt(transaction.amount);
                    dataManager.updateUserShift(currentUser.userId, userShift);
                }
            }
        } else if (transaction.type === 'out') {
            dataManager.data.settings.currentCash = (parseInt(dataManager.data.settings.currentCash) || 0) + parseInt(transaction.amount);
            
            // ✅ PERUBAHAN: Update user shift
            if (currentUser) {
                const userShift = dataManager.getUserShift(currentUser.userId);
                if (userShift) {
                    userShift.currentCash = (userShift.currentCash || 0) + parseInt(transaction.amount);
                    dataManager.updateUserShift(currentUser.userId, userShift);
                }
            }
        }

        dataManager.data.cashTransactions = dataManager.data.cashTransactions.filter(t => t.id !== id);
        dataManager.save();

        app.showToast('✅ Transaksi dihapus');
        this.renderHTML();
        this.renderTransactions();
        app.updateHeader();
    },

    // ✅ PERUBAHAN: Update stats dengan mempertimbangkan user
    updateStats() {
        const currentUser = dataManager.getCurrentUser();
        const userShift = currentUser ? dataManager.getUserShift(currentUser.userId) : null;
        
        let currentCash = 0;
        let modalAwal = 0;
        
        if (currentUser && (currentUser.role === 'owner' || currentUser.role === 'admin')) {
            currentCash = parseInt(dataManager.data.settings?.currentCash) || 0;
            modalAwal = parseInt(dataManager.data.settings?.modalAwal) || 0;
        } else if (userShift) {
            currentCash = userShift.currentCash || 0;
            modalAwal = userShift.modalAwal || 0;
        }
        
        const currentCashEl = document.getElementById('currentCash');
        const modalAwalEl = document.getElementById('modalAwal');
        
        if (currentCashEl) currentCashEl.textContent = 'Rp ' + utils.formatNumber(currentCash);
        if (modalAwalEl) modalAwalEl.textContent = 'Rp ' + utils.formatNumber(modalAwal);
    },

    calculateActualCash() {
        const currentUser = dataManager.getCurrentUser();
        
        let transactions = dataManager.data.cashTransactions;
        
        // ✅ PERUBAHAN: Filter untuk non-owner/admin
        if (currentUser && currentUser.role !== 'owner' && currentUser.role !== 'admin') {
            transactions = transactions.filter(t => t.userId === currentUser.userId || !t.userId);
        }
        
        const income = transactions
            .filter(t => t.type === 'in' || t.type === 'modal_in' || t.type === 'topup' || t.type === 'pos_sale')
            .reduce((sum, t) => sum + (parseInt(t.amount) || 0), 0);
            
        const expense = transactions
            .filter(t => t.type === 'out' || t.type === 'pos_void')
            .reduce((sum, t) => sum + (parseInt(t.amount) || 0), 0);
        
        return income - expense;
    },

    getTodayCashSales() {
        const today = new Date().toDateString();
        const currentUser = dataManager.getCurrentUser();
        
        return dataManager.data.transactions
            .filter(t => {
                const tDate = new Date(t.date).toDateString();
                const isToday = tDate === today;
                const isCash = t.paymentMethod === 'cash';
                
                if (currentUser && currentUser.role !== 'owner' && currentUser.role !== 'admin') {
                    return isToday && isCash && t.userId === currentUser.userId;
                }
                
                return isToday && isCash;
            })
            .reduce((sum, t) => sum + (parseInt(t.total) || 0), 0);
    },

    getTodayNonCashSales() {
        const today = new Date().toDateString();
        const currentUser = dataManager.getCurrentUser();
        
        return dataManager.data.transactions
            .filter(t => {
                const tDate = new Date(t.date).toDateString();
                const isToday = tDate === today;
                const isNonCash = t.paymentMethod !== 'cash';
                
                if (currentUser && currentUser.role !== 'owner' && currentUser.role !== 'admin') {
                    return isToday && isNonCash && t.userId === currentUser.userId;
                }
                
                return isToday && isNonCash;
            })
            .reduce((sum, t) => sum + (parseInt(t.total) || 0), 0);
    },

    recalculateCash() {
        if (!confirm('Recalculate akan menghitung ulang kas berdasarkan semua transaksi. Lanjutkan?')) {
            return;
        }

        const currentUser = dataManager.getCurrentUser();
        const userShift = currentUser ? dataManager.getUserShift(currentUser.userId) : null;
        
        const calculated = this.calculateActualCash();
        dataManager.data.settings.currentCash = calculated;
        
        // ✅ PERUBAHAN: Update user shift juga
        if (userShift) {
            userShift.currentCash = calculated;
            dataManager.updateUserShift(currentUser.userId, userShift);
        }
        
        dataManager.save();
        
        app.showToast(`✅ Kas direcalculate: Rp ${utils.formatNumber(calculated)}`);
        this.renderHTML();
        this.renderTransactions();
        app.updateHeader();
    },

    openModal(type) {
        // ✅ PERUBAHAN: Check apakah user ini punya shift aktif
        const currentUser = dataManager.getCurrentUser();
        const userShift = currentUser ? dataManager.getUserShift(currentUser.userId) : null;
        
        if (!userShift && currentUser && currentUser.role !== 'owner' && currentUser.role !== 'admin') {
            app.showToast('⚠️ Kasir belum dibuka! Silakan buka kasir terlebih dahulu.');
            return;
        }

        const isIncome = type === 'in';
        const title = isIncome ? '⬇️ Kas Masuk' : '⬆️ Kas Keluar';
        const color = isIncome ? '#4caf50' : '#f44336';
        
        const modalHTML = `
            <div class="modal active" id="cashModal" style="display: flex; z-index: 2000;">
                <div class="modal-content" style="max-width: 400px;">
                    <div class="modal-header">
                        <span class="modal-title" style="color: ${color};">${title}</span>
                        <button class="close-btn" onclick="cashModule.closeModal('cashModal')">×</button>
                    </div>

                    <div class="form-group">
                        <label>Jumlah (Rp) *</label>
                        <input type="number" id="cashAmount" placeholder="0" autofocus>
                    </div>

                    <div class="form-group">
                        <label>Kategori *</label>
                        <select id="cashCategory">
                            ${isIncome ? `
                                <option value="penjualan">Penjualan</option>
                                <option value="modal">Modal Masuk</option>
                                <option value="lainnya">Lainnya</option>
                            ` : `
                                <option value="belanja">Belanja/Restock</option>
                                <option value="operasional">Operasional</option>
                                <option value="gaji">Gaji</option>
                                <option value="lainnya">Lainnya</option>
                            `}
                        </select>
                    </div>

                    <div class="form-group">
                        <label>Keterangan</label>
                        <textarea id="cashNote" rows="2" placeholder="Keterangan tambahan..."></textarea>
                    </div>

                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="cashModule.closeModal('cashModal')">Batal</button>
                        <button class="btn btn-primary" onclick="cashModule.saveCash('${type}')" style="background: ${color}; border-color: ${color};">
                            💾 Simpan
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        setTimeout(() => document.getElementById('cashAmount')?.focus(), 100);
    },

    saveCash(type) {
        const amount = parseInt(document.getElementById('cashAmount')?.value) || 0;
        const category = document.getElementById('cashCategory')?.value;
        const note = document.getElementById('cashNote')?.value;

        if (amount <= 0) {
            app.showToast('❌ Jumlah harus lebih dari 0!');
            return;
        }

        this.saveTransaction(type, amount, category, note);
        this.closeModal('cashModal');
        app.showToast(`✅ Kas ${type === 'in' ? 'masuk' : 'keluar'} tersimpan!`);
    },

    openTopUp() {
        // ✅ PERUBAHAN: Check shift
        const currentUser = dataManager.getCurrentUser();
        const userShift = currentUser ? dataManager.getUserShift(currentUser.userId) : null;
        
        if (!userShift && currentUser && currentUser.role !== 'owner' && currentUser.role !== 'admin') {
            app.showToast('⚠️ Kasir belum dibuka!');
            return;
        }

        const providerOptions = this.generateProviderOptions();

        const modalHTML = `
            <div class="modal active" id="topUpModal" style="display: flex; z-index: 2000;">
                <div class="modal-content" style="max-width: 400px;">
                    <div class="modal-header">
                        <span class="modal-title" style="color: #9c27b0;">💜 Top Up E-Wallet</span>
                        <button class="close-btn" onclick="cashModule.closeModal('topUpModal')">×</button>
                    </div>

                    <div class="form-group">
                        <label>Provider *</label>
                        <select id="topUpProvider">
                            ${providerOptions}
                        </select>
                    </div>
                    
                    <div style="text-align: right; margin-bottom: 15px;">
                        <button onclick="cashModule.addCustomProvider('topup')" style="font-size: 12px; color: #667eea; background: none; border: none; cursor: pointer;">
                            ➕ Tambah Provider Baru
                        </button>
                        ${this.providers.custom.length > 0 ? `
                        <button onclick="cashModule.manageCustomProviders()" style="font-size: 12px; color: #f44336; background: none; border: none; cursor: pointer; margin-left: 10px;">
                            ✏️ Kelola Provider
                        </button>
                        ` : ''}
                    </div>

                    <div class="form-group">
                        <label>Nomor HP / ID Pelanggan *</label>
                        <input type="text" id="topUpPhone" placeholder="08xxxxxxxxx">
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label>Nominal Top Up (Rp) *</label>
                            <select id="topUpNominal" onchange="cashModule.handleTopUpNominalChange()">
                                <option value="">Pilih nominal...</option>
                                <option value="5000">Rp 5.000</option>
                                <option value="10000">Rp 10.000</option>
                                <option value="20000">Rp 20.000</option>
                                <option value="25000">Rp 25.000</option>
                                <option value="50000">Rp 50.000</option>
                                <option value="100000">Rp 100.000</option>
                                <option value="150000">Rp 150.000</option>
                                <option value="200000">Rp 200.000</option>
                                <option value="300000">Rp 300.000</option>
                                <option value="500000">Rp 500.000</option>
                                <option value="1000000">Rp 1.000.000</option>
                                <option value="custom">Lainnya...</option>
                            </select>
                        </div>
                        <div class="form-group" id="customNominalGroup" style="display: none;">
                            <label>Nominal Lain (Rp)</label>
                            <input type="number" id="topUpCustomNominal" placeholder="0" oninput="cashModule.calcTopUp()">
                        </div>
                    </div>

                    <div class="form-group">
                        <label>Admin Fee (Rp)</label>
                        <input type="number" id="topUpAdminFee" placeholder="0" value="0" oninput="cashModule.calcTopUp()">
                    </div>

                    <div class="calculation-box" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                        <div class="calc-row">
                            <span>Nominal Top Up:</span>
                            <span id="topUpDisplayNominal">Rp 0</span>
                        </div>
                        <div class="calc-row">
                            <span>Admin Fee:</span>
                            <span id="topUpDisplayAdmin">Rp 0</span>
                        </div>
                        <div class="calc-row" style="font-size: 20px; font-weight: 700; border-top: 2px solid rgba(255,255,255,0.3); padding-top: 10px; margin-top: 10px;">
                            <span>Total Dibayar:</span>
                            <span id="topUpTotal">Rp 0</span>
                        </div>
                        <div class="calc-row" style="font-size: 14px; color: #a5d6a7;">
                            <span>💰 Laba:</span>
                            <span id="topUpLaba">Rp 0</span>
                        </div>
                    </div>

                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="cashModule.closeModal('topUpModal')">Batal</button>
                        <button class="btn btn-primary" onclick="cashModule.saveTopUp()" style="background: #9c27b0; border-color: #9c27b0;">
                            💜 Proses Top Up
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    handleTopUpNominalChange() {
        const select = document.getElementById('topUpNominal');
        const customGroup = document.getElementById('customNominalGroup');
        const customInput = document.getElementById('topUpCustomNominal');
        
        if (select.value === 'custom') {
            customGroup.style.display = 'block';
            customInput.focus();
        } else {
            customGroup.style.display = 'none';
            this.calcTopUp();
        }
    },

    calcTopUp() {
        const nominalSelect = document.getElementById('topUpNominal').value;
        const customNominal = parseInt(document.getElementById('topUpCustomNominal')?.value) || 0;
        const adminFee = parseInt(document.getElementById('topUpAdminFee')?.value) || 0;
        
        const nominal = nominalSelect === 'custom' ? customNominal : (parseInt(nominalSelect) || 0);
        const total = nominal + adminFee;
        const laba = adminFee;

        document.getElementById('topUpDisplayNominal').textContent = 'Rp ' + utils.formatNumber(nominal);
        document.getElementById('topUpDisplayAdmin').textContent = 'Rp ' + utils.formatNumber(adminFee);
        document.getElementById('topUpTotal').textContent = 'Rp ' + utils.formatNumber(total);
        document.getElementById('topUpLaba').textContent = 'Rp ' + utils.formatNumber(laba);
    },

    saveTopUp() {
        const provider = document.getElementById('topUpProvider')?.value;
        const phone = document.getElementById('topUpPhone')?.value?.trim();
        const nominalSelect = document.getElementById('topUpNominal').value;
        const customNominal = parseInt(document.getElementById('topUpCustomNominal')?.value) || 0;
        const adminFee = parseInt(document.getElementById('topUpAdminFee')?.value) || 0;
        
        const nominal = nominalSelect === 'custom' ? customNominal : (parseInt(nominalSelect) || 0);
        const total = nominal + adminFee;

        if (!provider) {
            app.showToast('❌ Pilih provider!');
            return;
        }
        if (!phone) {
            app.showToast('❌ Masukkan nomor HP!');
            return;
        }
        if (nominal <= 0) {
            app.showToast('❌ Nominal tidak valid!');
            return;
        }

        const providerLabel = this.getProviderLabel(provider);

        this.saveTransaction('topup', total, 'topup_' + provider, `Top Up ${providerLabel} - ${phone}`, {
            provider: provider,
            phone: phone,
            nominal: nominal,
            adminFee: adminFee,
            total: total
        });

        this.closeModal('topUpModal');
        app.showToast(`✅ Top Up ${providerLabel} berhasil! Laba: Rp ${utils.formatNumber(adminFee)}`);
    },

    getProviderLabel(value) {
        const allProviders = [...this.providers.ewallet, ...this.providers.bank, ...this.providers.custom];
        const provider = allProviders.find(p => p.value === value);
        return provider ? provider.label : value;
    },

    openTarikTunai() {
        // ✅ PERUBAHAN: Check shift
        const currentUser = dataManager.getCurrentUser();
        const userShift = currentUser ? dataManager.getUserShift(currentUser.userId) : null;
        
        if (!userShift && currentUser && currentUser.role !== 'owner' && currentUser.role !== 'admin') {
            app.showToast('⚠️ Kasir belum dibuka!');
            return;
        }

        const providerOptions = this.generateProviderOptions();

        const modalHTML = `
            <div class="modal active" id="tarikTunaiModal" style="display: flex; z-index: 2000;">
                <div class="modal-content" style="max-width: 400px;">
                    <div class="modal-header">
                        <span class="modal-title" style="color: #2196f3;">🏧 Tarik Tunai</span>
                        <button class="close-btn" onclick="cashModule.closeModal('tarikTunaiModal')">×</button>
                    </div>

                    <div class="form-group">
                        <label>Provider *</label>
                        <select id="tarikProvider">
                            ${providerOptions}
                        </select>
                    </div>
                    
                    <div style="text-align: right; margin-bottom: 15px;">
                        <button onclick="cashModule.addCustomProvider('tarik')" style="font-size: 12px; color: #667eea; background: none; border: none; cursor: pointer;">
                            ➕ Tambah Provider Baru
                        </button>
                        ${this.providers.custom.length > 0 ? `
                        <button onclick="cashModule.manageCustomProviders()" style="font-size: 12px; color: #f44336; background: none; border: none; cursor: pointer; margin-left: 10px;">
                            ✏️ Kelola Provider
                        </button>
                        ` : ''}
                    </div>

                    <div class="form-group">
                        <label>Nomor Rekening / HP *</label>
                        <input type="text" id="tarikRekening" placeholder="Nomor rekening atau HP">
                    </div>

                    <div class="form-group">
                        <label>Nama Pemilik Rekening *</label>
                        <input type="text" id="tarikNama" placeholder="Nama sesuai rekening">
                    </div>

                    <div class="form-group">
                        <label>Nominal Tarik (Rp) *</label>
                        <input type="number" id="tarikNominal" placeholder="0" oninput="cashModule.calcTarik()">
                    </div>

                    <div class="form-group">
                        <label>Admin Fee (Rp)</label>
                        <input type="number" id="tarikAdminFee" placeholder="0" value="0" oninput="cashModule.calcTarik()">
                    </div>

                    <div class="calculation-box" style="background: linear-gradient(135deg, #2196f3 0%, #1565c0 100%); color: white;">
                        <div class="calc-row">
                            <span>Nominal Tarik:</span>
                            <span id="tarikDisplayNominal">Rp 0</span>
                        </div>
                        <div class="calc-row">
                            <span>Admin Fee:</span>
                            <span id="tarikDisplayAdmin">Rp 0</span>
                        </div>
                        <div class="calc-row" style="font-size: 20px; font-weight: 700; border-top: 2px solid rgba(255,255,255,0.3); padding-top: 10px; margin-top: 10px;">
                            <span>Total Diterima:</span>
                            <span id="tarikTotal">Rp 0</span>
                        </div>
                        <div class="calc-row" style="font-size: 14px; color: #a5d6a7;">
                            <span>💰 Laba:</span>
                            <span id="tarikLaba">Rp 0</span>
                        </div>
                    </div>

                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="cashModule.closeModal('tarikTunaiModal')">Batal</button>
                        <button class="btn btn-primary" onclick="cashModule.saveTarikTunai()" style="background: #2196f3; border-color: #2196f3;">
                            🏧 Proses Tarik Tunai
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    calcTarik() {
        const nominal = parseInt(document.getElementById('tarikNominal')?.value) || 0;
        const adminFee = parseInt(document.getElementById('tarikAdminFee')?.value) || 0;
        const total = nominal - adminFee;
        const laba = adminFee;

        document.getElementById('tarikDisplayNominal').textContent = 'Rp ' + utils.formatNumber(nominal);
        document.getElementById('tarikDisplayAdmin').textContent = 'Rp ' + utils.formatNumber(adminFee);
        document.getElementById('tarikTotal').textContent = 'Rp ' + utils.formatNumber(total);
        document.getElementById('tarikLaba').textContent = 'Rp ' + utils.formatNumber(laba);
    },

    saveTarikTunai() {
        const provider = document.getElementById('tarikProvider')?.value;
        const rekening = document.getElementById('tarikRekening')?.value?.trim();
        const nama = document.getElementById('tarikNama')?.value?.trim();
        const nominal = parseInt(document.getElementById('tarikNominal')?.value) || 0;
        const adminFee = parseInt(document.getElementById('tarikAdminFee')?.value) || 0;
        const total = nominal - adminFee;

        if (!provider) {
            app.showToast('❌ Pilih provider!');
            return;
        }
        if (!rekening) {
            app.showToast('❌ Masukkan nomor rekening!');
            return;
        }
        if (!nama) {
            app.showToast('❌ Masukkan nama pemilik rekening!');
            return;
        }
        if (nominal <= 0) {
            app.showToast('❌ Nominal tidak valid!');
            return;
        }

        const providerLabel = this.getProviderLabel(provider);

        // Tarik tunai = kas keluar (uang diberikan ke customer)
        this.saveTransaction('out', nominal, 'tarik_tunai', `Tarik Tunai ${providerLabel} - ${nama} (${rekening})`, {
            provider: provider,
            rekening: rekening,
            nama: nama,
            nominal: nominal,
            adminFee: adminFee,
            totalDiterima: total
        });

        this.closeModal('tarikTunaiModal');
        app.showToast(`✅ Tarik Tunai ${providerLabel} berhasil! Laba: Rp ${utils.formatNumber(adminFee)}`);
    },

    openModalAwal() {
        const currentUser = dataManager.getCurrentUser();
        const userShift = currentUser ? dataManager.getUserShift(currentUser.userId) : null;
        
        let currentModal = 0;
        if (currentUser && (currentUser.role === 'owner' || currentUser.role === 'admin')) {
            currentModal = parseInt(dataManager.data.settings?.modalAwal) || 0;
        } else if (userShift) {
            currentModal = userShift.modalAwal || 0;
        }

        const modalHTML = `
            <div class="modal active" id="modalAwalModal" style="display: flex; z-index: 2000;">
                <div class="modal-content" style="max-width: 400px;">
                    <div class="modal-header">
                        <span class="modal-title" style="color: #ffc107;">💰 Modal Awal</span>
                        <button class="close-btn" onclick="cashModule.closeModal('modalAwalModal')">×</button>
                    </div>

                    <div class="info-box" style="background: #fff8e1; border-left-color: #ffc107; margin-bottom: 20px;">
                        <div class="info-title">ℹ️ Informasi</div>
                        <div class="info-text">
                            Modal awal adalah uang yang disiapkan di kasir sebelum memulai transaksi hari ini.
                            Modal ini akan digunakan untuk menghitung laba bersih.
                        </div>
                    </div>

                    <div class="form-group">
                        <label>Modal Awal Saat Ini</label>
                        <input type="text" value="Rp ${utils.formatNumber(currentModal)}" disabled style="background: #f5f5f5; color: #666;">
                    </div>

                    <div class="form-group">
                        <label>Modal Awal Baru (Rp) *</label>
                        <input type="number" id="newModalAwal" placeholder="0" value="${currentModal}">
                    </div>

                    <div class="form-group">
                        <label>Keterangan (opsional)</label>
                        <input type="text" id="modalNote" placeholder="Contoh: Modal hari Senin">
                    </div>

                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="cashModule.closeModal('modalAwalModal')">Batal</button>
                        <button class="btn btn-primary" onclick="cashModule.saveModalAwal()" style="background: #ffc107; border-color: #ffc107; color: #333;">
                            💾 Simpan Modal
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    saveModalAwal() {
        const newModal = parseInt(document.getElementById('newModalAwal')?.value) || 0;
        const note = document.getElementById('modalNote')?.value;

        if (newModal < 0) {
            app.showToast('❌ Modal tidak boleh negatif!');
            return;
        }

        const currentUser = dataManager.getCurrentUser();
        const userShift = currentUser ? dataManager.getUserShift(currentUser.userId) : null;

        // Simpan modal lama untuk perhitungan
        const oldModal = parseInt(dataManager.data.settings?.modalAwal) || 0;

        // Update modal global
        dataManager.data.settings.modalAwal = newModal;

        // ✅ PERUBAHAN: Update user shift
        if (userShift) {
            userShift.modalAwal = newModal;
            dataManager.updateUserShift(currentUser.userId, userShift);
        }

        // Jika modal bertambah, catat sebagai kas masuk
        if (newModal > oldModal) {
            const diff = newModal - oldModal;
            this.saveTransaction('modal_in', diff, 'modal_tambahan', note || 'Penambahan modal awal');
        }

        dataManager.save();
        this.closeModal('modalAwalModal');
        app.showToast(`✅ Modal awal diupdate: Rp ${utils.formatNumber(newModal)}`);
        this.renderHTML();
        this.renderTransactions();
        app.updateHeader();
    },

    openHistory() {
        this.filterState.showHistory = true;
        this.renderHTML();
        this.renderTransactions();
        
        // Scroll ke bagian riwayat
        setTimeout(() => {
            const historySection = document.getElementById('cashTransactionList');
            if (historySection) {
                historySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 100);
    },

    showResetOptions() {
        const currentUser = dataManager.getCurrentUser();
        const userShift = currentUser ? dataManager.getUserShift(currentUser.userId) : null;
        
        let currentCash = 0;
        let modalAwal = 0;
        
        if (currentUser && (currentUser.role === 'owner' || currentUser.role === 'admin')) {
            currentCash = parseInt(dataManager.data.settings?.currentCash) || 0;
            modalAwal = parseInt(dataManager.data.settings?.modalAwal) || 0;
        } else if (userShift) {
            currentCash = userShift.currentCash || 0;
            modalAwal = userShift.modalAwal || 0;
        }

        const modalHTML = `
            <div class="modal active" id="resetOptionsModal" style="display: flex; z-index: 2000;">
                <div class="modal-content" style="max-width: 450px;">
                    <div class="modal-header">
                        <span class="modal-title">⚙️ Pengaturan Shift & Kas</span>
                        <button class="close-btn" onclick="cashModule.closeModal('resetOptionsModal')">×</button>
                    </div>

                    <div style="background: #e3f2fd; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
                        <div style="font-size: 14px; color: #1565c0; margin-bottom: 8px;">
                            📊 Status Saat Ini ${currentUser && (currentUser.role === 'owner' || currentUser.role === 'admin') ? '(Global)' : '(Shift Anda)'}
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                            <div>
                                <div style="font-size: 12px; color: #666;">Kas di Tangan</div>
                                <div style="font-size: 18px; font-weight: 700; color: #333;">Rp ${utils.formatNumber(currentCash)}</div>
                            </div>
                            <div>
                                <div style="font-size: 12px; color: #666;">Modal Awal</div>
                                <div style="font-size: 18px; font-weight: 700; color: #333;">Rp ${utils.formatNumber(modalAwal)}</div>
                            </div>
                        </div>
                    </div>

                    <div style="display: grid; gap: 12px;">
                        <button onclick="cashModule.saveDayClosing()" style="padding: 16px; background: #4caf50; color: white; border: none; border-radius: 12px; cursor: pointer; text-align: left;">
                            <div style="font-weight: 700; font-size: 16px; margin-bottom: 4px;">📋 Tutup Shift Hari Ini</div>
                            <div style="font-size: 13px; opacity: 0.9;">Simpan laporan penutupan dan tutup kasir untuk shift ini</div>
                        </button>

                        <button onclick="cashModule.setNewModal()" style="padding: 16px; background: #2196f3; color: white; border: none; border-radius: 12px; cursor: pointer; text-align: left;">
                            <div style="font-weight: 700; font-size: 16px; margin-bottom: 4px;">💰 Atur Modal Awal Baru</div>
                            <div style="font-size: 13px; opacity: 0.9;">Set ulang modal awal untuk shift baru</div>
                        </button>

                        ${currentUser && (currentUser.role === 'owner' || currentUser.role === 'admin') ? `
                        <button onclick="cashModule.carryOverCash()" style="padding: 16px; background: #ff9800; color: white; border: none; border-radius: 12px; cursor: pointer; text-align: left;">
                            <div style="font-weight: 700; font-size: 16px; margin-bottom: 4px;">🔄 Carry Over Kas</div>
                            <div style="font-size: 13px; opacity: 0.9;">Lanjutkan kas ke hari berikutnya (tanpa reset)</div>
                        </button>
                        ` : ''}

                        <button onclick="cashModule.resetToZero()" style="padding: 16px; background: #f44336; color: white; border: none; border-radius: 12px; cursor: pointer; text-align: left;">
                            <div style="font-weight: 700; font-size: 16px; margin-bottom: 4px;">🗑️ Reset Kas ke 0</div>
                            <div style="font-size: 13px; opacity: 0.9;">HAPUS SEMUA kas dan mulai dari nol (hati-hati!)</div>
                        </button>
                    </div>

                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="cashModule.closeModal('resetOptionsModal')">Batal</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    saveDayClosing() {
        if (!confirm('Simpan laporan penutupan shift? Kas akan direset untuk shift berikutnya.')) {
            return;
        }

        const currentUser = dataManager.getCurrentUser();
        const userShift = currentUser ? dataManager.getUserShift(currentUser.userId) : null;
        
        let currentCash = 0;
        let modalAwal = 0;
        
        if (currentUser && (currentUser.role === 'owner' || currentUser.role === 'admin')) {
            currentCash = parseInt(dataManager.data.settings?.currentCash) || 0;
            modalAwal = parseInt(dataManager.data.settings?.modalAwal) || 0;
        } else if (userShift) {
            currentCash = userShift.currentCash || 0;
            modalAwal = userShift.modalAwal || 0;
        }

        const today = new Date();
        const todayStr = today.toDateString();

        // Hitung statistik hari ini
        const todayStats = this.calculatePeriodStats(
            new Date(today.getFullYear(), today.getMonth(), today.getDate()),
            new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59)
        );

        // Simpan ke history
        if (!dataManager.data.shiftHistory) {
            dataManager.data.shiftHistory = [];
        }

        const closingRecord = {
            date: today.toISOString(),
            dateStr: todayStr,
            userId: currentUser ? currentUser.userId : null,
            userName: currentUser ? currentUser.name : 'Unknown',
            modalAwal: modalAwal,
            kasAkhir: currentCash,
            laba: todayStats.laba,
            totalTransaksi: todayStats.totalTransactions,
            status: 'closed'
        };

        dataManager.data.shiftHistory.push(closingRecord);

        // Reset kas dan modal
        dataManager.data.settings.currentCash = 0;
        dataManager.data.settings.modalAwal = 0;

        // ✅ PERUBAHAN: Reset user shift
        if (userShift) {
            userShift.currentCash = 0;
            userShift.modalAwal = 0;
            userShift.transactionCount = 0;
            userShift.totalSales = 0;
            dataManager.updateUserShift(currentUser.userId, userShift);
        }

        // Tutup shift di dataManager
        if (currentUser) {
            dataManager.closeKasir(currentUser.userId);
        }

        dataManager.save();

        this.closeModal('resetOptionsModal');
        app.showToast('✅ Shift ditutup dan laporan disimpan!');
        
        // Redirect ke halaman tutup
        if (typeof app !== 'undefined' && app.showKasirClosedPage) {
            app.showKasirClosedPage();
        }
    },

    resetToZero() {
        if (!confirm('⚠️ PERINGATAN!\n\nSemua kas akan dihapus dan diatur ke 0.\nTindakan ini tidak dapat dibatalkan.\n\nLanjutkan?')) {
            return;
        }

        const confirmation = prompt('Ketik "RESET" untuk konfirmasi:');
        if (confirmation !== 'RESET') {
            app.showToast('❌ Reset dibatalkan');
            return;
        }

        const currentUser = dataManager.getCurrentUser();
        const userShift = currentUser ? dataManager.getUserShift(currentUser.userId) : null;

        dataManager.data.settings.currentCash = 0;
        dataManager.data.settings.modalAwal = 0;

        // ✅ PERUBAHAN: Reset user shift
        if (userShift) {
            userShift.currentCash = 0;
            userShift.modalAwal = 0;
            userShift.transactionCount = 0;
            userShift.totalSales = 0;
            dataManager.updateUserShift(currentUser.userId, userShift);
        }

        dataManager.save();

        this.closeModal('resetOptionsModal');
        app.showToast('🗑️ Kas direset ke 0');
        this.renderHTML();
        this.renderTransactions();
        app.updateHeader();
    },

    setNewModal() {
        this.closeModal('resetOptionsModal');
        this.openModalAwal();
    },

    carryOverCash() {
        if (!confirm('Carry over akan mempertahankan kas saat ini untuk shift berikutnya.\n\nLanjutkan?')) {
            return;
        }

        const currentUser = dataManager.getCurrentUser();
        
        // Simpan history carry over
        if (!dataManager.data.shiftHistory) {
            dataManager.data.shiftHistory = [];
        }

        const carryRecord = {
            date: new Date().toISOString(),
            userId: currentUser ? currentUser.userId : null,
            userName: currentUser ? currentUser.name : 'Unknown',
            type: 'carry_over',
            status: 'carried'
        };

        dataManager.data.shiftHistory.push(carryRecord);
        dataManager.save();

        this.closeModal('resetOptionsModal');
        app.showToast('✅ Kas di-carry over ke shift berikutnya');
    },

    // ✅ PERUBAHAN: Save transaction dengan userId
    saveTransaction(type, amount, category, note, details = {}) {
        const currentUser = dataManager.getCurrentUser();
        
        const transaction = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
            type: type,
            amount: parseInt(amount) || 0,
            category: category,
            note: note,
            date: new Date().toISOString(),
            details: details,
            // ✅ PERUBAHAN: Tambahkan userId
            userId: currentUser ? currentUser.userId : null
        };

        dataManager.data.cashTransactions.push(transaction);
        
        // Update kas global
        if (type === 'in' || type === 'modal_in' || type === 'topup') {
            dataManager.data.settings.currentCash = (parseInt(dataManager.data.settings.currentCash) || 0) + parseInt(amount);
        } else if (type === 'out') {
            dataManager.data.settings.currentCash = (parseInt(dataManager.data.settings.currentCash) || 0) - parseInt(amount);
        }
        
        // ✅ PERUBAHAN: Update user shift jika ada
        if (currentUser) {
            const userShift = dataManager.getUserShift(currentUser.userId);
            if (userShift) {
                if (type === 'in' || type === 'modal_in' || type === 'topup') {
                    userShift.currentCash = (userShift.currentCash || 0) + parseInt(amount);
                } else if (type === 'out') {
                    userShift.currentCash = (userShift.currentCash || 0) - parseInt(amount);
                }
                dataManager.updateUserShift(currentUser.userId, userShift);
            }
        }
        
        dataManager.save();
        this.updateStats();
        this.renderTransactions();
    },

    closeModal(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.remove();
        }
    }
};

// ============================================
// CASH MODULE - Hifzi Cell POS (FULL VERSION)
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
        console.log('[CashModule] Initializing...');
        this.loadCustomProviders();
        this.ensureCashInitialized();
        this.checkDayChange();
        this.renderHTML();
        this.updateStats();
        this.renderTransactions();
        console.log('[CashModule] Initialized successfully');
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
            try {
                this.providers.custom = JSON.parse(saved);
            } catch (e) {
                console.error('Error loading custom providers:', e);
                this.providers.custom = [];
            }
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

    calculateGlobalCash() {
        const activeShifts = dataManager.getActiveShifts();
        let totalCash = 0;
        let totalModal = 0;
        
        activeShifts.forEach(shift => {
            const totalModalShift = (parseInt(shift.modalAwal) || 0) + (parseInt(shift.extraModal) || 0);
            const shiftCash = dataManager.calculateShiftCash(shift.userId, totalModalShift);
            totalCash += shiftCash;
            totalModal += totalModalShift;
        });
        
        return {
            cash: totalCash,
            modal: totalModal,
            shifts: activeShifts
        };
    },

    renderHTML() {
        const periodLabel = this.getFilterLabel();
        const { startDate, endDate } = this.getDateRange();
        
        const periodStats = this.calculatePeriodStats(startDate, endDate);
        const dateRangeText = this.getDateRangeText(startDate, endDate);
        
        const currentUser = dataManager.getCurrentUser();
        const userShift = currentUser ? dataManager.getUserShift(currentUser.userId) : null;
        
        const isKasir = currentUser && currentUser.role === 'kasir';
        const isOwner = currentUser && currentUser.role === 'owner';
        const isAdmin = currentUser && currentUser.role === 'admin';
        
        const globalCash = this.calculateGlobalCash();
        
        let currentCash = 0;
        let modalAwal = 0;
        
        if (isOwner) {
            currentCash = globalCash.cash;
            modalAwal = globalCash.modal;
        } else if (isAdmin) {
            if (userShift) {
                const totalModal = (userShift.modalAwal || 0) + (userShift.extraModal || 0);
                currentCash = dataManager.calculateShiftCash(currentUser.userId, totalModal);
                modalAwal = totalModal;
            } else {
                currentCash = 0;
                modalAwal = 0;
            }
        } else if (userShift) {
            const totalModal = (userShift.modalAwal || 0) + (userShift.extraModal || 0);
            currentCash = dataManager.calculateShiftCash(currentUser.userId, totalModal);
            modalAwal = totalModal;
        }
        
        const calculatedCash = this.calculateActualCash();
        const todayCashSales = this.getTodayCashSales();
        const todayNonCashSales = this.getTodayNonCashSales();
        
        const selisih = currentCash - calculatedCash;
        const needsRepair = Math.abs(selisih) > 100;

        const lastActiveDate = localStorage.getItem('hifzi_last_active_date');
        const today = new Date().toDateString();
        const isNewDay = lastActiveDate && lastActiveDate !== today;

        const activeShifts = dataManager.getActiveShifts();
        
        const pendingModalsInfo = (isOwner || isAdmin) ? this.getPendingModalsInfo() : '';
        
        const userInfoHtml = currentUser ? `
            <div class="cash-info-card cash-fade-in">
                <div class="cash-info-card-icon blue">👤</div>
                <div class="cash-info-card-content">
                    <div class="cash-info-card-title">${currentUser.name} <span style="color: var(--cash-text-secondary); font-weight: 500;">(${currentUser.role})</span></div>
                    <div class="cash-info-card-text">
                        ${userShift 
                            ? `Shift aktif sejak ${new Date(userShift.openTime).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}` 
                            : 'Anda belum membuka kasir'}
                    </div>
                </div>
            </div>
        ` : '';

        const newDayHtml = isNewDay ? `
            <div class="cash-info-card" style="border-left: 4px solid var(--cash-warning);">
                <div class="cash-info-card-icon orange">🌅</div>
                <div class="cash-info-card-content">
                    <div class="cash-info-card-title">Hari Baru Terdeteksi!</div>
                    <div class="cash-info-card-text">Kas masih tersisa dari hari sebelumnya. Reset untuk memulai shift baru.</div>
                </div>
                <button class="cash-info-card-action" style="background: var(--cash-warning); color: white;" onclick="cashModule.showResetOptions()">⚙️ Atur Shift</button>
            </div>
        ` : '';

        const modalAwalButtonHtml = (isOwner || isAdmin) ? `
            <button class="cash-btn modal-awal" onclick="cashModule.openModalAwal()">
                <span class="cash-btn-icon">💰</span>
                <span class="cash-btn-text">Modal Awal</span>
            </button>
        ` : '';

        const aturModalButtonHtml = isOwner ? `
            <button class="cash-btn atur-modal-kasir" onclick="cashModule.showAturModalKasir()">
                <span class="cash-btn-icon">👥</span>
                <span class="cash-btn-text">Atur Modal User</span>
            </button>
        ` : '';

        const bagiModalButtonHtml = isAdmin ? `
            <button class="cash-btn atur-modal-kasir" onclick="cashModule.showBagiModalKasir()">
                <span class="cash-btn-icon">🔄</span>
                <span class="cash-btn-text">Bagi Modal Tambahan</span>
            </button>
        ` : '';

        const pengaturanShiftHtml = (isOwner || isAdmin) ? `
            <div class="cash-info-card" style="border-left: 4px solid var(--cash-info);">
                <div class="cash-info-card-icon blue">🔄</div>
                <div class="cash-info-card-content">
                    <div class="cash-info-card-title">Reset Kas & Modal</div>
                    <div class="cash-info-card-text">Kas Global: Rp ${utils.formatNumber(currentCash)} | Modal Global: Rp ${utils.formatNumber(modalAwal)}</div>
                </div>
                <button class="cash-info-card-action" style="background: var(--cash-info); color: white;" onclick="cashModule.showResetOptions()">⚙️ Pengaturan Shift</button>
            </div>
        ` : '';

        const userAktifHtml = (isOwner || isAdmin) && activeShifts.length > 0 ? `
            <div style="background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%); border-radius: var(--cash-radius); padding: 20px; margin-bottom: 20px; box-shadow: var(--cash-shadow);">
                <div style="font-size: 16px; font-weight: 700; color: #2e7d32; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
                    👥 User dengan Shift Aktif <span style="background: #4caf50; color: white; padding: 2px 10px; border-radius: 12px; font-size: 12px;">${activeShifts.length}</span>
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px;">
                    ${activeShifts.map(s => {
                        const mainModal = s.modalAwal || 0;
                        const extraModal = s.extraModal || 0;
                        const totalModal = mainModal + extraModal;
                        const shiftCash = dataManager.calculateShiftCash(s.userId, totalModal);
                        
                        return `
                        <div class="cash-user-shift-card">
                            <div class="cash-user-shift-header">
                                <span class="cash-user-shift-name">${s.userName}</span>
                                <span class="cash-user-shift-role">${s.userRole}</span>
                            </div>
                            <div class="cash-user-shift-stats">
                                <div class="cash-user-shift-stat modal">
                                    <div class="cash-user-shift-stat-label" style="color: #f57f17;">💰 Modal</div>
                                    <div class="cash-user-shift-stat-value">
                                        Rp ${utils.formatNumber(totalModal)}
                                        ${extraModal > 0 ? `<div style="font-size: 11px; color: #666;">(${utils.formatNumber(mainModal)} + ${utils.formatNumber(extraModal)})</div>` : ''}
                                    </div>
                                </div>
                                <div class="cash-user-shift-stat cash">
                                    <div class="cash-user-shift-stat-label" style="color: #1565c0;">💵 Kas</div>
                                    <div class="cash-user-shift-stat-value">Rp ${utils.formatNumber(shiftCash)}</div>
                                </div>
                            </div>
                            <div class="cash-user-shift-time">
                                🕐 Buka: ${new Date(s.openTime).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}
                            </div>
                        </div>
                    `}).join('')}
                </div>
            </div>
        ` : '';

        const repairHtml = (needsRepair && isOwner) ? `
            <div class="cash-info-card" style="border-left: 4px solid var(--cash-warning);">
                <div class="cash-info-card-icon orange">⚠️</div>
                <div class="cash-info-card-content">
                    <div class="cash-info-card-title">Data Kas Tidak Konsisten</div>
                    <div class="cash-info-card-text">Kas Tercatat: Rp ${utils.formatNumber(currentCash)} vs Hitungan: Rp ${utils.formatNumber(calculatedCash)}</div>
                </div>
                <button class="cash-info-card-action" style="background: var(--cash-warning); color: white;" onclick="cashModule.recalculateCash()">🔄 Recalculate</button>
            </div>
        ` : '';

        document.getElementById('mainContent').innerHTML = `
            <div class="content-section active" id="cashSection">
                ${userInfoHtml}
                ${newDayHtml}
                ${pendingModalsInfo}
                
                <div class="cash-hero">
                    <div class="cash-hero-header">
                        <div>
                            <div class="cash-hero-title">💰 Kas di Tangan ${isOwner ? '(Global - Semua Shift)' : isAdmin ? '(Admin)' : '(Shift Anda)'}</div>
                            <div class="cash-hero-amount">Rp ${utils.formatNumber(currentCash)}</div>
                            <div style="margin-top: 12px; opacity: 0.9; font-size: 14px;">
                                📦 Modal: Rp ${utils.formatNumber(modalAwal)} | 
                                💵 Cash: Rp ${utils.formatNumber(todayCashSales)} | 
                                📱 Non-Cash: Rp ${utils.formatNumber(todayNonCashSales)}
                            </div>
                        </div>
                        <div style="background: rgba(255,255,255,0.2); border-radius: 12px; padding: 16px 24px; text-align: center;">
                            <div style="font-size: 12px; opacity: 0.9; margin-bottom: 4px;">Status</div>
                            <div style="font-size: 18px; font-weight: 700; ${currentCash < 0 ? 'color: #ffebee;' : ''}">
                                ${currentCash < 0 ? '⚠️ MINUS' : '✅ Normal'}
                            </div>
                        </div>
                    </div>
                    
                    <div class="cash-hero-stats">
                        <div class="cash-hero-stat">
                            <div style="font-size: 12px; opacity: 0.8; margin-bottom: 4px;">Kas Masuk</div>
                            <div style="font-size: 18px; font-weight: 700;">Rp ${utils.formatNumber(periodStats.manualKasMasuk)}</div>
                        </div>
                        <div class="cash-hero-stat">
                            <div style="font-size: 12px; opacity: 0.8; margin-bottom: 4px;">Kas Keluar</div>
                            <div style="font-size: 18px; font-weight: 700;">Rp ${utils.formatNumber(periodStats.kasKeluar)}</div>
                        </div>
                        <div class="cash-hero-stat">
                            <div style="font-size: 12px; opacity: 0.8; margin-bottom: 4px;">Top Up</div>
                            <div style="font-size: 18px; font-weight: 700;">Rp ${utils.formatNumber(periodStats.topUpMasuk)}</div>
                        </div>
                        <div class="cash-hero-stat">
                            <div style="font-size: 12px; opacity: 0.8; margin-bottom: 4px;">Laba</div>
                            <div style="font-size: 18px; font-weight: 700; color: #a5d6a7;">Rp ${utils.formatNumber(periodStats.laba)}</div>
                        </div>
                    </div>
                </div>

                ${repairHtml}
                ${userAktifHtml}

                <div class="cash-filter-bar">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="font-weight: 600; color: var(--cash-text);">📅 Periode:</span>
                        <span class="cash-filter-badge">${periodLabel}</span>
                        <span style="color: var(--cash-text-secondary); font-size: 13px;">${dateRangeText}</span>
                    </div>
                    
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <select id="filterPreset" onchange="cashModule.applyFilter()" class="cash-filter-select">
                            <option value="today">📅 Hari Ini</option>
                            <option value="yesterday">📅 Kemarin</option>
                            <option value="week">📆 Minggu Ini</option>
                            <option value="month">🗓️ Bulan Ini</option>
                            <option value="year">📊 Tahun Ini</option>
                            <option value="custom">🔍 Custom...</option>
                        </select>
                        
                        <div id="customDateRange" style="display: none; gap: 10px; align-items: center;">
                            <input type="date" id="filterStartDate" onchange="cashModule.applyFilter()" style="padding: 10px; border-radius: 8px; border: 2px solid var(--cash-border);">
                            <span style="color: var(--cash-text-secondary);">s/d</span>
                            <input type="date" id="filterEndDate" onchange="cashModule.applyFilter()" style="padding: 10px; border-radius: 8px; border: 2px solid var(--cash-border);">
                        </div>
                    </div>
                </div>

                ${pengaturanShiftHtml}

                <div class="cash-profit-card">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-size: 12px; color: var(--cash-text-secondary); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">
                                💰 Laba Bersih ${periodLabel}
                            </div>
                            <div class="cash-profit-amount ${periodStats.laba < 0 ? 'negative' : ''}">
                                Rp ${utils.formatNumber(periodStats.laba)}
                            </div>
                            <div style="font-size: 13px; color: var(--cash-text-secondary); margin-top: 8px;">
                                Dari Admin Fee Top Up & Tarik Tunai
                            </div>
                        </div>
                        <div style="width: 64px; height: 64px; background: ${periodStats.laba >= 0 ? '#f0fdf4' : '#fef2f2'}; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 32px;">
                            ${periodStats.laba >= 0 ? '📈' : '📉'}
                        </div>
                    </div>
                    
                    <div class="cash-profit-grid">
                        <div class="cash-profit-item">
                            <div style="font-size: 12px; color: var(--cash-purple); font-weight: 600; margin-bottom: 8px;">💜 Top Up</div>
                            <div style="font-size: 20px; font-weight: 700; color: #7c3aed;">Rp ${utils.formatNumber(periodStats.labaTopUp)}</div>
                        </div>
                        <div class="cash-profit-item">
                            <div style="font-size: 12px; color: var(--cash-info); font-weight: 600; margin-bottom: 8px;">🏧 Tarik Tunai</div>
                            <div style="font-size: 20px; font-weight: 700; color: #2563eb;">Rp ${utils.formatNumber(periodStats.labaTarikTunai)}</div>
                        </div>
                    </div>
                </div>

                <div class="cash-actions-card">
                    <div style="font-size: 16px; font-weight: 700; color: var(--cash-text); margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
                        <span>Manajemen Kas</span>
                        <span style="font-size: 13px; color: var(--cash-text-secondary); font-weight: 500;">${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                    </div>
                    
                    <div class="cash-actions">
                        <button class="cash-btn in" onclick="cashModule.openModal('in')">
                            <span class="cash-btn-icon">⬇️</span>
                            <span class="cash-btn-text">Kas Masuk</span>
                        </button>
                        
                        <button class="cash-btn out" onclick="cashModule.openModal('out')">
                            <span class="cash-btn-icon">⬆️</span>
                            <span class="cash-btn-text">Kas Keluar</span>
                        </button>
                        
                        <button class="cash-btn tarik-tunai" onclick="cashModule.openTarikTunai()">
                            <span class="cash-btn-icon">🏧</span>
                            <span class="cash-btn-text">Tarik Tunai</span>
                        </button>
                        
                        <button class="cash-btn topup" onclick="cashModule.openTopUp()">
                            <span class="cash-btn-icon">💜</span>
                            <span class="cash-btn-text">Top Up</span>
                        </button>
                        
                        ${modalAwalButtonHtml}
                        
                        ${aturModalButtonHtml}
                        
                        ${bagiModalButtonHtml}
                        
                        <button class="cash-btn history" onclick="cashModule.openHistory()">
                            <span class="cash-btn-icon">📋</span>
                            <span class="cash-btn-text">Riwayat</span>
                        </button>
                    </div>
                </div>

                <div class="cash-history-card">
                    <div class="cash-history-header" onclick="cashModule.toggleHistory()">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <span style="font-size: 18px; font-weight: 700; color: var(--cash-text);">Riwayat Transaksi Kas</span>
                            <span id="historyToggleIcon" class="cash-history-toggle ${this.filterState.showHistory ? 'open' : ''}">🔽</span>
                        </div>
                        ${isOwner ? `
                        <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); cashModule.recalculateCash()" 
                                style="padding: 8px 16px; background: #f1f5f9; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; color: var(--cash-text);">
                            🔄 Recalculate
                        </button>
                        ` : ''}
                    </div>
                    
                    <div id="cashTransactionList" style="${this.filterState.showHistory ? '' : 'max-height: 0; overflow: hidden;'}">
                    </div>
                    
                    <div id="filterSummary" class="cash-summary-box">
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

    getPendingModalsInfo() {
        const users = dataManager.getUsers().filter(u => u.role !== 'owner');
        const activeShifts = dataManager.getActiveShifts();
        
        const pendingUsers = users.filter(user => {
            const isActive = activeShifts.some(s => s.userId === user.id);
            const hasPendingMain = dataManager.getPendingModal(user.id) > 0;
            const hasPendingExtra = dataManager.getPendingExtraModal(user.id) > 0;
            return !isActive && (hasPendingMain || hasPendingExtra);
        });
        
        if (pendingUsers.length === 0) return '';
        
        const listHtml = pendingUsers.map(user => {
            const pendingMain = dataManager.getPendingModal(user.id);
            const pendingExtra = dataManager.getPendingExtraModal(user.id);
            const total = pendingMain + pendingExtra;
            
            return `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                    <div>
                        <span style="font-weight: 600; color: #374151;">${user.name}</span>
                        <span style="font-size: 11px; color: #6b7280; margin-left: 8px;">(${user.role})</span>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: 700; color: #f59e0b;">Rp ${utils.formatNumber(total)}</div>
                        ${pendingExtra > 0 ? `<div style="font-size: 10px; color: #6b7280;">Utama: ${utils.formatNumber(pendingMain)} + Tambahan: ${utils.formatNumber(pendingExtra)}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');
        
        return `
            <div class="cash-info-card" style="border-left: 4px solid #f59e0b; background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);">
                <div class="cash-info-card-icon" style="background: #f59e0b; color: white;">⏳</div>
                <div class="cash-info-card-content" style="flex: 1;">
                    <div class="cash-info-card-title" style="color: #92400e;">Modal Menunggu Diambil</div>
                    <div class="cash-info-card-text" style="color: #a16207; font-size: 12px; margin-bottom: 8px;">
                        ${pendingUsers.length} user belum membuka kasir tapi sudah memiliki modal:
                    </div>
                    <div style="background: white; border-radius: 8px; padding: 12px; font-size: 13px;">
                        ${listHtml}
                    </div>
                </div>
            </div>
        `;
    },

    showAturModalKasir() {
        const currentUser = dataManager.getCurrentUser();
        if (!currentUser || currentUser.role !== 'owner') {
            app.showToast('❌ Hanya Owner yang dapat mengatur modal user!');
            return;
        }

        const users = dataManager.getUsers().filter(u => u.role !== 'owner');
        const activeShifts = dataManager.getActiveShifts();

        if (users.length === 0) {
            app.showToast('Belum ada user admin atau kasir!');
            return;
        }

        console.log('[showAturModalKasir] Current pendingModals:', JSON.parse(JSON.stringify(dataManager.data.pendingModals || {})));

        let userListHtml = users.map(user => {
            const shift = activeShifts.find(s => s.userId === user.id);
            const pendingMain = dataManager.getPendingModal(user.id);
            const pendingExtra = dataManager.getPendingExtraModal(user.id);
            
            const mainModal = shift ? (shift.modalAwal || 0) : pendingMain;
            const extraModal = shift ? (shift.extraModal || 0) : pendingExtra;
            const totalModal = mainModal + extraModal;
            
            const currentCash = shift ? dataManager.calculateShiftCash(user.id, totalModal) : 0;
            const isActive = !!shift;
            
            return `
                <div class="modal-kasir-card ${isActive ? 'active' : ''}" data-user-id="${user.id}" style="border: 2px solid ${isActive ? '#86efac' : '#e5e7eb'}; border-radius: 12px; padding: 16px; background: white;">
                    <div class="modal-kasir-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                        <div>
                            <div class="modal-kasir-name" style="font-weight: 700; font-size: 16px; color: #1f2937;">${user.name}</div>
                            <div class="modal-kasir-username" style="font-size: 13px; color: #6b7280;">@${user.username}</div>
                            <span style="background: ${user.role === 'admin' ? '#dbeafe' : '#dcfce7'}; color: ${user.role === 'admin' ? '#1e40af' : '#15803d'}; padding: 2px 8px; border-radius: 4px; font-size: 11px; text-transform: uppercase; font-weight: 700; margin-top: 4px; display: inline-block;">
                                ${user.role}
                            </span>
                        </div>
                        <span style="padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; ${isActive ? 'background: #dcfce7; color: #15803d;' : 'background: #f3f4f6; color: #6b7280;'}">
                            ${isActive ? '🟢 Aktif' : '⚪ Offline'}
                        </span>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                        <div style="background: #fef3c7; padding: 12px; border-radius: 8px; text-align: center;">
                            <div style="font-size: 11px; color: #92400e; margin-bottom: 4px;">💰 Modal Utama</div>
                            <div style="font-size: 16px; font-weight: 700; color: #92400e;" id="displayMainModal_${user.id}">Rp ${utils.formatNumber(mainModal)}</div>
                        </div>
                        <div style="background: #dbeafe; padding: 12px; border-radius: 8px; text-align: center;">
                            <div style="font-size: 11px; color: #1e40af; margin-bottom: 4px;">💵 Kas</div>
                            <div style="font-size: 16px; font-weight: 700; color: #1e40af;">Rp ${utils.formatNumber(currentCash)}</div>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 8px;">
                        <label style="font-size: 12px; color: #64748b; margin-bottom: 4px; display: block; font-weight: 600;">Modal Utama Baru (Rp)</label>
                        <input type="number" 
                               id="modalInput_${user.id}" 
                               style="width: 100%; padding: 10px 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px;" 
                               placeholder="Masukkan modal utama..." 
                               value="${mainModal > 0 ? mainModal : ''}"
                               onchange="cashModule.updatePendingModal('${user.id}')">
                    </div>
                </div>
            `;
        }).join('');

        const modalHTML = `
            <div class="modal active" id="aturModalKasirModal" style="display: flex; z-index: 2000; align-items: flex-start; padding-top: 50px;">
                <div class="modal-content" style="max-width: 800px; max-height: 85vh; overflow-y: auto; border-radius: 20px; padding: 0;">
                    <div class="modal-header" style="padding: 24px; border-bottom: 1px solid #e2e8f0; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);">
                        <span class="modal-title" style="color: #15803d; font-size: 18px; font-weight: 700;">👥 Atur Modal Utama Per User (Owner)</span>
                        <button class="close-btn" onclick="cashModule.closeModal('aturModalKasirModal')" style="color: #15803d; font-size: 28px;">×</button>
                    </div>
                    
                    <div style="padding: 24px;">
                        <div style="background: #dbeafe; border-radius: 12px; padding: 16px; margin-bottom: 20px; font-size: 14px; color: #1e40af;">
                            <strong>ℹ️ Informasi:</strong> Masukkan <strong>modal utama</strong> untuk Admin dan Kasir. Modal ini adalah modal dasar yang nantinya bisa ditambah dengan modal tambahan dari Admin (jika ada).
                        </div>

                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px;">
                            ${userListHtml}
                        </div>

                        <button onclick="cashModule.saveAllModalKasir()" style="width: 100%; margin-top: 24px; padding: 16px; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; border: none; border-radius: 12px; font-size: 16px; font-weight: 700; cursor: pointer;">
                            💾 Simpan Semua Modal
                        </button>
                    </div>

                    <div class="modal-footer" style="padding: 20px 24px; border-top: 1px solid #e2e8f0; background: #f8fafc;">
                        <button class="btn btn-secondary" onclick="cashModule.closeModal('aturModalKasirModal')" style="padding: 12px 24px; border-radius: 10px; font-weight: 600;">Tutup</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    showBagiModalKasir() {
        const currentUser = dataManager.getCurrentUser();
        if (!currentUser || currentUser.role !== 'admin') {
            app.showToast('❌ Hanya Admin yang dapat membagi modal!');
            return;
        }

        const adminShift = dataManager.getUserShift(currentUser.userId);
        const adminModal = adminShift ? (adminShift.modalAwal || 0) : 0;
        const adminExtraModal = adminShift ? (adminShift.extraModal || 0) : 0;
        const adminTotalModal = adminModal + adminExtraModal;
        const adminCash = adminShift ? dataManager.calculateShiftCash(currentUser.userId, adminTotalModal) : 0;

        const users = dataManager.getUsers().filter(u => u.role === 'kasir');
        const activeShifts = dataManager.getActiveShifts();

        if (users.length === 0) {
            app.showToast('Belum ada user kasir!');
            return;
        }

        let kasirListHtml = users.map(user => {
            const shift = activeShifts.find(s => s.userId === user.id);
            const mainModal = shift ? (shift.modalAwal || 0) : dataManager.getPendingModal(user.id);
            const currentExtraModal = shift ? (shift.extraModal || 0) : dataManager.getPendingExtraModal(user.id);
            const totalModal = mainModal + currentExtraModal;
            const isActive = !!shift;
            
            return `
                <div class="modal-kasir-card ${isActive ? 'active' : ''}" style="border: 2px solid ${isActive ? '#86efac' : '#e5e7eb'}; border-radius: 12px; padding: 16px; background: white;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                        <div>
                            <div style="font-weight: 700; font-size: 16px; color: #1f2937;">${user.name}</div>
                            <div style="font-size: 13px; color: #6b7280;">@${user.username}</div>
                        </div>
                        <span style="padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; ${isActive ? 'background: #dcfce7; color: #15803d;' : 'background: #f3f4f6; color: #6b7280;'}">
                            ${isActive ? '🟢 Aktif' : '⚪ Offline'}
                        </span>
                    </div>
                    
                    <div style="background: #f0f9ff; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px;">
                            <span style="color: #64748b;">Modal Utama (Owner):</span>
                            <span style="font-weight: 600; color: #0369a1;">Rp ${utils.formatNumber(mainModal)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px;">
                            <span style="color: #64748b;">Modal Tambahan (Admin):</span>
                            <span style="font-weight: 600; color: #15803d;">Rp ${utils.formatNumber(currentExtraModal)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; border-top: 1px solid #bae6fd; padding-top: 8px; margin-top: 8px;">
                            <span style="color: #64748b; font-weight: 600;">Total Modal:</span>
                            <span style="font-weight: 800; color: #0c4a6e;">Rp ${utils.formatNumber(totalModal)}</span>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 8px;">
                        <label style="font-size: 12px; color: #64748b; margin-bottom: 4px; display: block; font-weight: 600;">
                            💰 Modal Tambahan Baru (Rp)
                        </label>
                        <input type="number" 
                               id="extraModalInput_${user.id}" 
                               style="width: 100%; padding: 10px 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px;" 
                               placeholder="0" 
                               value=""
                               oninput="cashModule.updateExtraModalPreview('${user.id}', ${mainModal}, ${currentExtraModal}); cashModule.hitungTotalExtraModal(${adminTotalModal});">
                        <div id="previewTotal_${user.id}" style="font-size: 12px; color: #15803d; margin-top: 6px; font-weight: 600;">
                            Total akan menjadi: Rp ${utils.formatNumber(totalModal)}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        const modalHTML = `
            <div class="modal active" id="bagiModalKasirModal" style="display: flex; z-index: 2000; align-items: flex-start; padding-top: 50px;">
                <div class="modal-content" style="max-width: 800px; max-height: 85vh; overflow-y: auto; border-radius: 20px; padding: 0;">
                    <div class="modal-header" style="padding: 24px; border-bottom: 1px solid #e2e8f0; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);">
                        <span class="modal-title" style="color: #1e40af; font-size: 18px; font-weight: 700;">🔄 Bagi Modal Tambahan ke Kasir</span>
                        <button class="close-btn" onclick="cashModule.closeModal('bagiModalKasirModal')" style="color: #1e40af; font-size: 28px;">×</button>
                    </div>
                    
                    <div style="padding: 24px;">
                        <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; padding: 16px; margin-bottom: 20px; border-left: 4px solid #f59e0b;">
                            <div style="font-size: 14px; color: #92400e; margin-bottom: 8px; font-weight: 700;">
                                💰 Modal Admin Saat Ini: Rp ${utils.formatNumber(adminTotalModal)}
                            </div>
                            <div style="font-size: 14px; color: #92400e;">
                                💵 Kas Admin Saat Ini: Rp ${utils.formatNumber(adminCash)}
                            </div>
                        </div>

                        <div style="background: #dbeafe; border-radius: 12px; padding: 16px; margin-bottom: 20px; font-size: 14px; color: #1e40af;">
                            <strong>ℹ️ Informasi:</strong> Masukkan <strong>modal tambahan</strong> untuk setiap kasir. Modal ini akan <strong>ditambahkan</strong> ke modal utama yang sudah diatur Owner. Total tidak boleh melebihi modal admin Anda.
                        </div>

                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px;">
                            ${kasirListHtml}
                        </div>

                        <div style="background: #f0fdf4; border-radius: 12px; padding: 16px; margin: 20px 0; border: 2px solid #86efac;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-weight: 600; color: #15803d;">Total Modal Tambahan:</span>
                                <span id="totalExtraModal" style="font-size: 20px; font-weight: 800; color: #15803d;">Rp 0</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                                <span style="font-size: 14px; color: #64748b;">Sisa Modal Admin:</span>
                                <span id="sisaModalAdmin" style="font-size: 16px; font-weight: 700; color: #15803d;">Rp ${utils.formatNumber(adminTotalModal)}</span>
                            </div>
                        </div>

                        <button onclick="cashModule.saveBagiModalKasir(${adminTotalModal})" style="width: 100%; padding: 16px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none; border-radius: 12px; font-size: 16px; font-weight: 700; cursor: pointer;">
                            🔄 Bagi Modal Tambahan ke Kasir
                        </button>
                    </div>

                    <div class="modal-footer" style="padding: 20px 24px; border-top: 1px solid #e2e8f0; background: #f8fafc;">
                        <button class="btn btn-secondary" onclick="cashModule.closeModal('bagiModalKasirModal')" style="padding: 12px 24px; border-radius: 10px; font-weight: 600;">Tutup</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    updateExtraModalPreview(userId, mainModal, currentExtra) {
        const input = document.getElementById(`extraModalInput_${userId}`);
        const newExtra = parseInt(input?.value) || 0;
        const previewEl = document.getElementById(`previewTotal_${userId}`);
        
        if (previewEl) {
            const total = mainModal + currentExtra + newExtra;
            previewEl.textContent = `Total akan menjadi: Rp ${utils.formatNumber(total)}`;
        }
    },

    hitungTotalExtraModal(adminModal) {
        const inputs = document.querySelectorAll('[id^="extraModalInput_"]');
        let total = 0;
        inputs.forEach(input => {
            total += parseInt(input.value) || 0;
        });
        
        const totalEl = document.getElementById('totalExtraModal');
        const sisaEl = document.getElementById('sisaModalAdmin');
        
        if (totalEl) totalEl.textContent = 'Rp ' + utils.formatNumber(total);
        if (sisaEl) {
            const sisa = adminModal - total;
            sisaEl.textContent = 'Rp ' + utils.formatNumber(sisa);
            sisaEl.style.color = sisa >= 0 ? '#15803d' : '#dc2626';
        }
    },

    saveBagiModalKasir(adminModal) {
        const currentUser = dataManager.getCurrentUser();
        if (!currentUser || currentUser.role !== 'admin') return;

        const users = dataManager.getUsers().filter(u => u.role === 'kasir');
        const activeShifts = dataManager.getActiveShifts();
        
        let totalBagi = 0;
        const bagiData = [];

        users.forEach(user => {
            const input = document.getElementById(`extraModalInput_${user.id}`);
            const extraModal = parseInt(input?.value) || 0;
            if (extraModal > 0) {
                totalBagi += extraModal;
                bagiData.push({ userId: user.id, extraModal });
            }
        });

        if (totalBagi > adminModal) {
            app.showToast(`❌ Total modal tambahan (Rp ${utils.formatNumber(totalBagi)}) melebihi modal admin (Rp ${utils.formatNumber(adminModal)})!`);
            return;
        }

        if (bagiData.length === 0) {
            app.showToast('⚠️ Tidak ada modal tambahan yang dibagi.');
            return;
        }

        let updatedCount = 0;
        let pendingCount = 0;
        
        bagiData.forEach(({ userId, extraModal }) => {
            const shift = activeShifts.find(s => s.userId === userId);
            
            if (shift) {
                const oldExtra = shift.extraModal || 0;
                shift.extraModal = oldExtra + extraModal;
                
                const totalModal = (shift.modalAwal || 0) + shift.extraModal;
                const newCash = dataManager.calculateShiftCash(userId, totalModal);
                shift.currentCash = newCash;
                
                dataManager.updateUserShift(userId, shift);
                updatedCount++;
                
                const transaction = {
                    id: 'modal_extra_' + Date.now().toString(36) + '_' + userId,
                    type: 'modal_in',
                    amount: extraModal,
                    category: 'modal_tambahan',
                    note: `Modal tambahan dari Admin (${currentUser.name}) untuk ${shift.userName}`,
                    date: new Date().toISOString(),
                    userId: userId,
                    userName: shift.userName,
                    givenBy: currentUser.name,
                    givenByRole: 'admin',
                    oldExtraModal: oldExtra,
                    newExtraModal: shift.extraModal,
                    status: 'active'
                };
                
                if (!dataManager.data.cashTransactions) {
                    dataManager.data.cashTransactions = [];
                }
                dataManager.data.cashTransactions.push(transaction);
            } else {
                const oldPendingExtra = dataManager.getPendingExtraModal(userId);
                dataManager.setPendingExtraModal(userId, oldPendingExtra + extraModal);
                pendingCount++;
                
                const user = dataManager.getUsers().find(u => u.id === userId);
                const transaction = {
                    id: 'modal_extra_pending_' + Date.now().toString(36) + '_' + userId,
                    type: 'modal_in',
                    amount: extraModal,
                    category: 'modal_tambahan',
                    note: `Modal tambahan dari Admin (${currentUser.name}) untuk ${user ? user.name : 'Unknown'} (menunggu diambil)`,
                    date: new Date().toISOString(),
                    userId: userId,
                    userName: user ? user.name : 'Unknown',
                    givenBy: currentUser.name,
                    givenByRole: 'admin',
                    oldPendingExtra: oldPendingExtra,
                    newPendingExtra: oldPendingExtra + extraModal,
                    status: 'pending'
                };
                
                if (!dataManager.data.cashTransactions) {
                    dataManager.data.cashTransactions = [];
                }
                dataManager.data.cashTransactions.push(transaction);
            }
        });

        const adminShift = dataManager.getUserShift(currentUser.userId);
        if (adminShift) {
            const oldAdminModal = adminShift.modalAwal || 0;
            adminShift.modalAwal = Math.max(0, oldAdminModal - totalBagi);
            
            const newAdminTotalModal = (adminShift.modalAwal || 0) + (adminShift.extraModal || 0);
            const newAdminCash = dataManager.calculateShiftCash(currentUser.userId, newAdminTotalModal);
            adminShift.currentCash = newAdminCash;
            
            dataManager.updateUserShift(currentUser.userId, adminShift);
            
            const adminTransaction = {
                id: 'modal_admin_out_' + Date.now().toString(36),
                type: 'modal_out',
                amount: totalBagi,
                category: 'pengurangan_modal',
                note: `Admin (${currentUser.name}) membagi modal tambahan ke ${bagiData.length} kasir`,
                date: new Date().toISOString(),
                userId: currentUser.userId,
                userName: currentUser.name,
                oldModal: oldAdminModal,
                newModal: adminShift.modalAwal,
                recipients: bagiData.map(b => b.userId)
            };
            
            if (!dataManager.data.cashTransactions) {
                dataManager.data.cashTransactions = [];
            }
            dataManager.data.cashTransactions.push(adminTransaction);
        }

        dataManager.save();
        app.showToast(`✅ Berhasil membagi modal tambahan! ${updatedCount} aktif, ${pendingCount} pending. Total: Rp ${utils.formatNumber(totalBagi)}`);
        this.closeModal('bagiModalKasirModal');
        this.renderHTML();
        this.renderTransactions();
    },

    updatePendingModal(userId) {
        const input = document.getElementById(`modalInput_${userId}`);
        const newModal = parseInt(input?.value) || 0;
        
        const displayEl = document.getElementById(`displayMainModal_${userId}`);
        if (displayEl) {
            displayEl.textContent = `Rp ${utils.formatNumber(newModal)}`;
        }
    },

    saveAllModalKasir() {
        const currentUser = dataManager.getCurrentUser();
        if (!currentUser || currentUser.role !== 'owner') {
            app.showToast('❌ Hanya Owner yang dapat menyimpan modal!');
            return;
        }

        const users = dataManager.getUsers().filter(u => u.role !== 'owner');
        const activeShifts = dataManager.getActiveShifts();
        let savedCount = 0;
        let updatedCount = 0;

        users.forEach(user => {
            const input = document.getElementById(`modalInput_${user.id}`);
            const newModal = parseInt(input?.value) || 0;
            
            if (newModal < 0) return;

            const shift = activeShifts.find(s => s.userId === user.id);
            
            if (shift) {
                const oldModal = shift.modalAwal || 0;
                
                if (oldModal !== newModal) {
                    shift.modalAwal = newModal;
                    
                    const totalModal = newModal + (shift.extraModal || 0);
                    const newCash = dataManager.calculateShiftCash(user.id, totalModal);
                    shift.currentCash = newCash;
                    
                    dataManager.updateUserShift(user.id, shift);
                    updatedCount++;
                    
                    const transaction = {
                        id: 'modal_owner_' + Date.now().toString(36) + '_' + user.id,
                        type: 'modal_in',
                        amount: newModal,
                        category: 'modal_awal',
                        note: `Modal utama diubah Owner (${currentUser.name}) untuk ${user.name}: ${oldModal > newModal ? 'Berkurang' : 'Bertambah'} Rp ${utils.formatNumber(Math.abs(newModal - oldModal))}`,
                        date: new Date().toISOString(),
                        userId: user.id,
                        userName: user.name,
                        givenBy: currentUser.name,
                        givenByRole: 'owner',
                        oldModal: oldModal,
                        newModal: newModal,
                        diff: newModal - oldModal,
                        status: 'active'
                    };
                    
                    if (!dataManager.data.cashTransactions) {
                        dataManager.data.cashTransactions = [];
                    }
                    dataManager.data.cashTransactions.push(transaction);
                }
            } else {
                const oldPending = dataManager.getPendingModal(user.id);
                
                if (oldPending !== newModal) {
                    dataManager.setPendingModal(user.id, newModal);
                    savedCount++;
                    
                    const transaction = {
                        id: 'modal_owner_pending_' + Date.now().toString(36) + '_' + user.id,
                        type: 'modal_in',
                        amount: newModal,
                        category: 'modal_awal',
                        note: `Modal utama diatur Owner (${currentUser.name}) untuk ${user.name} (menunggu diambil)${oldPending > 0 ? ' - Diubah dari Rp ' + utils.formatNumber(oldPending) : ''}`,
                        date: new Date().toISOString(),
                        userId: user.id,
                        userName: user.name,
                        givenBy: currentUser.name,
                        givenByRole: 'owner',
                        oldPending: oldPending,
                        newPending: newModal,
                        diff: newModal - oldPending,
                        status: 'pending'
                    };
                    
                    if (!dataManager.data.cashTransactions) {
                        dataManager.data.cashTransactions = [];
                    }
                    dataManager.data.cashTransactions.push(transaction);
                }
            }
        });

        console.log('[saveAllModalKasir] Saved to pending:', savedCount);
        console.log('[saveAllModalKasir] Updated active shifts:', updatedCount);
        console.log('[saveAllModalKasir] Current pendingModals:', JSON.parse(JSON.stringify(dataManager.data.pendingModals || {})));
        console.log('[saveAllModalKasir] Current pendingExtraModals:', JSON.parse(JSON.stringify(dataManager.data.pendingExtraModals || {})));

        if (savedCount > 0 || updatedCount > 0) {
            app.showToast(`✅ Berhasil! ${updatedCount} user aktif diupdate, ${savedCount} disimpan untuk shift berikutnya.`);
            this.closeModal('aturModalKasirModal');
            this.renderHTML();
            this.renderTransactions();
        } else {
            app.showToast('ℹ️ Tidak ada perubahan yang disimpan (modal sudah sesuai).');
        }
    },

    getFilterLabel() {
        const labels = {
            today: 'Hari Ini',
            yesterday: 'Kemarin',
            week: 'Minggu Ini',
            month: 'Bulan Ini',
            year: 'Tahun Ini',
            custom: 'Custom'
        };
        return labels[this.filterState.preset] || 'Hari Ini';
    },

    getDateRange() {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let startDate, endDate;

        switch (this.filterState.preset) {
            case 'today':
                startDate = today;
                endDate = new Date(today.getTime() + 86400000 - 1);
                break;
            case 'yesterday':
                startDate = new Date(today.getTime() - 86400000);
                endDate = new Date(today.getTime() - 1);
                break;
            case 'week':
                const dayOfWeek = today.getDay();
                const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
                startDate = new Date(today.setDate(diff));
                endDate = new Date(startDate.getTime() + 7 * 86400000 - 1);
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
                startDate = this.filterState.startDate ? new Date(this.filterState.startDate) : today;
                endDate = this.filterState.endDate ? new Date(new Date(this.filterState.endDate).getTime() + 86400000 - 1) : new Date(today.getTime() + 86400000 - 1);
                break;
            default:
                startDate = today;
                endDate = new Date(today.getTime() + 86400000 - 1);
        }

        return { startDate, endDate };
    },

    getDateRangeText(startDate, endDate) {
        const options = { day: 'numeric', month: 'short', year: 'numeric' };
        if (startDate.toDateString() === endDate.toDateString()) {
            return startDate.toLocaleDateString('id-ID', options);
        }
        return `${startDate.toLocaleDateString('id-ID', options)} - ${endDate.toLocaleDateString('id-ID', options)}`;
    },

    applyFilter() {
        const preset = document.getElementById('filterPreset').value;
        this.filterState.preset = preset;
        
        const customRange = document.getElementById('customDateRange');
        if (customRange) {
            customRange.style.display = preset === 'custom' ? 'flex' : 'none';
        }
        
        if (preset === 'custom') {
            this.filterState.startDate = document.getElementById('filterStartDate').value;
            this.filterState.endDate = document.getElementById('filterEndDate').value;
        }
        
        this.updateStats();
        this.renderTransactions();
    },

    toggleHistory() {
        this.filterState.showHistory = !this.filterState.showHistory;
        const toggleIcon = document.getElementById('historyToggleIcon');
        const list = document.getElementById('cashTransactionList');
        
        if (toggleIcon) {
            toggleIcon.classList.toggle('open', this.filterState.showHistory);
        }
        if (list) {
            list.style.maxHeight = this.filterState.showHistory ? 'none' : '0';
            list.style.overflow = this.filterState.showHistory ? 'visible' : 'hidden';
        }
    },

    updateStats() {
        const { startDate, endDate } = this.getDateRange();
        const stats = this.calculatePeriodStats(startDate, endDate);
        
        const summaryEl = document.getElementById('filterSummary');
        if (summaryEl) {
            summaryEl.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px;">
                    <div style="text-align: center; padding: 12px; background: #f0fdf4; border-radius: 8px;">
                        <div style="font-size: 12px; color: #15803d; margin-bottom: 4px;">Total Transaksi</div>
                        <div style="font-size: 18px; font-weight: 700; color: #15803d;">${stats.totalTransactions}</div>
                    </div>
                    <div style="text-align: center; padding: 12px; background: #fef3c7; border-radius: 8px;">
                        <div style="font-size: 12px; color: #92400e; margin-bottom: 4px;">Modal Masuk</div>
                        <div style="font-size: 18px; font-weight: 700; color: #92400e;">Rp ${utils.formatNumber(stats.modalMasuk)}</div>
                    </div>
                    <div style="text-align: center; padding: 12px; background: #fee2e2; border-radius: 8px;">
                        <div style="font-size: 12px; color: #dc2626; margin-bottom: 4px;">Modal Keluar</div>
                        <div style="font-size: 18px; font-weight: 700; color: #dc2626;">Rp ${utils.formatNumber(stats.modalKeluar)}</div>
                    </div>
                    <div style="text-align: center; padding: 12px; background: #dbeafe; border-radius: 8px;">
                        <div style="font-size: 12px; color: #1e40af; margin-bottom: 4px;">Net Modal</div>
                        <div style="font-size: 18px; font-weight: 700; color: #1e40af;">Rp ${utils.formatNumber(stats.modalMasuk - stats.modalKeluar)}</div>
                    </div>
                </div>
            `;
        }
    },

    calculatePeriodStats(startDate, endDate) {
        const transactions = dataManager.getCashTransactions() || [];
        const currentUser = dataManager.getCurrentUser();
        
        let stats = {
            totalTransactions: 0,
            kasMasuk: 0,
            kasKeluar: 0,
            manualKasMasuk: 0,
            manualKasKeluar: 0,
            topUpMasuk: 0,
            topUpKeluar: 0,
            tarikTunaiMasuk: 0,
            tarikTunaiKeluar: 0,
            laba: 0,
            labaTopUp: 0,
            labaTarikTunai: 0,
            modalMasuk: 0,
            modalKeluar: 0
        };

        transactions.forEach(t => {
            const tDate = new Date(t.date);
            if (tDate >= startDate && tDate <= endDate) {
                if (currentUser && currentUser.role !== 'owner' && t.userId !== currentUser.userId) return;
                
                stats.totalTransactions++;
                
                const amount = parseInt(t.amount) || 0;
                
                if (t.type === 'in') {
                    stats.kasMasuk += amount;
                    if (t.category === 'manual') stats.manualKasMasuk += amount;
                    if (t.category === 'topup') stats.topUpMasuk += amount;
                    if (t.category === 'tarik_tunai') stats.tarikTunaiMasuk += amount;
                    if (t.category === 'modal_awal' || t.category === 'modal_tambahan') stats.modalMasuk += amount;
                } else if (t.type === 'out') {
                    stats.kasKeluar += amount;
                    if (t.category === 'manual') stats.manualKasKeluar += amount;
                    if (t.category === 'topup') stats.topUpKeluar += amount;
                    if (t.category === 'tarik_tunai') stats.tarikTunaiKeluar += amount;
                    if (t.category === 'pengurangan_modal') stats.modalKeluar += amount;
                }
                
                if (t.fee) {
                    const fee = parseInt(t.fee) || 0;
                    stats.laba += fee;
                    if (t.category === 'topup') stats.labaTopUp += fee;
                    if (t.category === 'tarik_tunai') stats.labaTarikTunai += fee;
                }
            }
        });

        return stats;
    },

    renderTransactions() {
        const listEl = document.getElementById('cashTransactionList');
        if (!listEl) return;

        const { startDate, endDate } = this.getDateRange();
        const transactions = dataManager.getCashTransactions() || [];
        const currentUser = dataManager.getCurrentUser();

        let filtered = transactions.filter(t => {
            const tDate = new Date(t.date);
            const inRange = tDate >= startDate && tDate <= endDate;
            
            if (!inRange) return false;
            
            if (currentUser && currentUser.role !== 'owner') {
                return t.userId === currentUser.userId;
            }
            return true;
        });

        filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

        if (filtered.length === 0) {
            listEl.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--cash-text-secondary);">
                    <div style="font-size: 48px; margin-bottom: 16px;">📭</div>
                    <div style="font-size: 16px; font-weight: 600;">Tidak ada transaksi</div>
                    <div style="font-size: 14px; margin-top: 8px;">Belum ada transaksi kas pada periode ini</div>
                </div>
            `;
            return;
        }

        const grouped = this.groupTransactionsByDate(filtered);
        
        let html = '';
        for (const [date, items] of Object.entries(grouped)) {
            const dateTotal = items.reduce((sum, t) => {
                const amount = parseInt(t.amount) || 0;
                return sum + (t.type === 'in' ? amount : -amount);
            }, 0);

            html += `
                <div style="margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #f8fafc; border-radius: 8px; margin-bottom: 12px;">
                        <span style="font-weight: 600; color: #475569;">${this.formatDateHeader(date)}</span>
                        <span style="font-weight: 700; color: ${dateTotal >= 0 ? '#15803d' : '#dc2626'};">
                            ${dateTotal >= 0 ? '+' : ''}Rp ${utils.formatNumber(Math.abs(dateTotal))}
                        </span>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        ${items.map(t => this.renderTransactionItem(t)).join('')}
                    </div>
                </div>
            `;
        }

        listEl.innerHTML = html;
    },

    groupTransactionsByDate(transactions) {
        const grouped = {};
        transactions.forEach(t => {
            const date = new Date(t.date).toDateString();
            if (!grouped[date]) grouped[date] = [];
            grouped[date].push(t);
        });
        return grouped;
    },

    formatDateHeader(dateStr) {
        const date = new Date(dateStr);
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        
        if (dateStr === today) return 'Hari Ini';
        if (dateStr === yesterday) return 'Kemarin';
        
        return date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    },

    renderTransactionItem(t) {
        const isIn = t.type === 'in';
        const isModal = t.category === 'modal_awal' || t.category === 'modal_tambahan' || t.category === 'pengurangan_modal';
        const amount = parseInt(t.amount) || 0;
        const fee = parseInt(t.fee) || 0;
        
        let icon, color, bgColor, label;
        
        switch(t.category) {
            case 'manual':
                icon = isIn ? '⬇️' : '⬆️';
                color = isIn ? '#15803d' : '#dc2626';
                bgColor = isIn ? '#f0fdf4' : '#fef2f2';
                label = isIn ? 'Kas Masuk' : 'Kas Keluar';
                break;
            case 'topup':
                icon = '💜';
                color = '#7c3aed';
                bgColor = '#f3e8ff';
                label = 'Top Up';
                break;
            case 'tarik_tunai':
                icon = '🏧';
                color = '#2563eb';
                bgColor = '#dbeafe';
                label = 'Tarik Tunai';
                break;
            case 'modal_awal':
            case 'modal_tambahan':
                icon = '💰';
                color = '#92400e';
                bgColor = '#fef3c7';
                label = t.category === 'modal_awal' ? 'Modal Awal' : 'Modal Tambahan';
                break;
            case 'pengurangan_modal':
                icon = '📤';
                color = '#dc2626';
                bgColor = '#fee2e2';
                label = 'Pengurangan Modal';
                break;
            default:
                icon = isIn ? '⬇️' : '⬆️';
                color = isIn ? '#15803d' : '#dc2626';
                bgColor = isIn ? '#f0fdf4' : '#fef2f2';
                label = isIn ? 'Masuk' : 'Keluar';
        }

        const currentUser = dataManager.getCurrentUser();
        const canDelete = currentUser && (currentUser.role === 'owner' || currentUser.userId === t.userId);

        return `
            <div class="cash-transaction-item" style="display: flex; align-items: center; gap: 12px; padding: 16px; background: white; border-radius: 12px; border: 1px solid #e2e8f0; transition: all 0.2s;">
                <div style="width: 48px; height: 48px; border-radius: 12px; background: ${bgColor}; display: flex; align-items: center; justify-content: center; font-size: 24px;">
                    ${icon}
                </div>
                <div style="flex: 1; min-width: 0;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                        <span style="font-weight: 600; color: #1e293b; font-size: 14px;">${label}</span>
                        ${t.status === 'pending' ? '<span style="background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">PENDING</span>' : ''}
                    </div>
                    <div style="font-size: 13px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${t.note || '-'} ${t.givenBy ? `• Oleh: ${t.givenBy}` : ''}
                    </div>
                    <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">
                        ${new Date(t.date).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})} • ${t.userName || 'Unknown'}
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="font-weight: 700; color: ${color}; font-size: 16px;">
                        ${isIn ? '+' : '-'}Rp ${utils.formatNumber(amount)}
                    </div>
                    ${fee > 0 ? `<div style="font-size: 12px; color: #7c3aed; font-weight: 600;">+Fee: Rp ${utils.formatNumber(fee)}</div>` : ''}
                </div>
                ${canDelete ? `
                <button onclick="cashModule.confirmDelete('${t.id}')" style="padding: 8px; background: #fee2e2; border: none; border-radius: 8px; color: #dc2626; cursor: pointer; font-size: 16px;">
                    🗑️
                </button>
                ` : ''}
            </div>
        `;
    },

    openModal(type) {
        const isIn = type === 'in';
        const modalId = isIn ? 'kasMasukModal' : 'kasKeluarModal';
        const title = isIn ? '⬇️ Kas Masuk' : '⬆️ Kas Keluar';
        const btnClass = isIn ? 'cash-btn in' : 'cash-btn out';
        const btnText = isIn ? 'Simpan Kas Masuk' : 'Simpan Kas Keluar';

        const modalHTML = `
            <div class="modal active" id="${modalId}" style="display: flex; z-index: 2000;">
                <div class="modal-content" style="max-width: 500px; border-radius: 20px;">
                    <div class="modal-header" style="padding: 24px; border-bottom: 2px solid ${isIn ? '#dcfce7' : '#fee2e2'};">
                        <span class="modal-title" style="font-size: 20px; font-weight: 700; color: ${isIn ? '#15803d' : '#dc2626'};">${title}</span>
                        <button class="close-btn" onclick="cashModule.closeModal('${modalId}')" style="font-size: 28px; color: #64748b;">×</button>
                    </div>
                    
                    <div style="padding: 24px;">
                        <div style="margin-bottom: 20px;">
                            <label style="display: block; font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 8px;">Jumlah (Rp) *</label>
                            <input type="number" id="${modalId}_amount" 
                                   style="width: 100%; padding: 16px; border: 2px solid #e5e7eb; border-radius: 12px; font-size: 18px; font-weight: 700;" 
                                   placeholder="0" autofocus>
                        </div>
                        
                        <div style="margin-bottom: 20px;">
                            <label style="display: block; font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 8px;">Keterangan</label>
                            <textarea id="${modalId}_note" 
                                      style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 12px; font-size: 14px; min-height: 80px; resize: vertical;" 
                                      placeholder="Tambahkan keterangan..."></textarea>
                        </div>

                        <button onclick="cashModule.saveTransaction('${type}')" 
                                style="width: 100%; padding: 16px; background: ${isIn ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'}; 
                                color: white; border: none; border-radius: 12px; font-size: 16px; font-weight: 700; cursor: pointer;">
                            ${btnText}
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        setTimeout(() => document.getElementById(`${modalId}_amount`)?.focus(), 100);
    },

    saveTransaction(type) {
        const isIn = type === 'in';
        const modalId = isIn ? 'kasMasukModal' : 'kasKeluarModal';
        
        const amountInput = document.getElementById(`${modalId}_amount`);
        const noteInput = document.getElementById(`${modalId}_note`);
        
        const amount = parseInt(amountInput?.value) || 0;
        const note = noteInput?.value?.trim() || '';
        
        if (amount <= 0) {
            app.showToast('❌ Jumlah harus lebih dari 0!');
            return;
        }

        const currentUser = dataManager.getCurrentUser();
        if (!currentUser) {
            app.showToast('❌ Anda harus login terlebih dahulu!');
            return;
        }

        const transaction = {
            id: 'cash_' + Date.now().toString(36),
            type: type,
            amount: amount,
            category: 'manual',
            note: note,
            date: new Date().toISOString(),
            userId: currentUser.userId,
            userName: currentUser.name
        };

        if (!dataManager.data.cashTransactions) {
            dataManager.data.cashTransactions = [];
        }
        dataManager.data.cashTransactions.push(transaction);

        const userShift = dataManager.getUserShift(currentUser.userId);
        if (userShift) {
            const totalModal = (userShift.modalAwal || 0) + (userShift.extraModal || 0);
            const newCash = dataManager.calculateShiftCash(currentUser.userId, totalModal);
            userShift.currentCash = newCash;
            dataManager.updateUserShift(currentUser.userId, userShift);
        }

        dataManager.save();
        app.showToast(`✅ Kas ${isIn ? 'masuk' : 'keluar'} berhasil dicatat!`);
        this.closeModal(modalId);
        this.renderHTML();
        this.renderTransactions();
    },

    openTopUp() {
        const modalHTML = `
            <div class="modal active" id="topUpModal" style="display: flex; z-index: 2000;">
                <div class="modal-content" style="max-width: 500px; border-radius: 20px;">
                    <div class="modal-header" style="padding: 24px; border-bottom: 2px solid #f3e8ff;">
                        <span class="modal-title" style="font-size: 20px; font-weight: 700; color: #7c3aed;">💜 Top Up E-Wallet</span>
                        <button class="close-btn" onclick="cashModule.closeModal('topUpModal')" style="font-size: 28px; color: #64748b;">×</button>
                    </div>
                    
                    <div style="padding: 24px;">
                        <div style="margin-bottom: 20px;">
                            <label style="display: block; font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 8px;">Provider *</label>
                            <select id="topup_provider" style="width: 100%; padding: 14px; border: 2px solid #e5e7eb; border-radius: 12px; font-size: 15px;">
                                ${this.generateProviderOptions()}
                            </select>
                        </div>

                        <div style="margin-bottom: 20px;">
                            <label style="display: block; font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 8px;">Nomor Tujuan *</label>
                            <input type="text" id="topup_number" 
                                   style="width: 100%; padding: 14px; border: 2px solid #e5e7eb; border-radius: 12px; font-size: 15px;" 
                                   placeholder="08xxxxxxxxxx">
                        </div>
                        
                        <div style="margin-bottom: 20px;">
                            <label style="display: block; font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 8px;">Nominal Top Up (Rp) *</label>
                            <input type="number" id="topup_amount" 
                                   style="width: 100%; padding: 16px; border: 2px solid #e5e7eb; border-radius: 12px; font-size: 18px; font-weight: 700;" 
                                   placeholder="0">
                        </div>

                        <div style="margin-bottom: 20px;">
                            <label style="display: block; font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 8px;">Admin Fee (Rp)</label>
                            <input type="number" id="topup_fee" 
                                   style="width: 100%; padding: 14px; border: 2px solid #e5e7eb; border-radius: 12px; font-size: 15px;" 
                                   placeholder="0" value="0">
                            <div style="font-size: 12px; color: #64748b; margin-top: 6px;">
                                💡 Fee ini menjadi laba. Biarkan 0 jika tidak ada fee.
                            </div>
                        </div>
                        
                        <div style="margin-bottom: 20px;">
                            <label style="display: block; font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 8px;">Keterangan</label>
                            <textarea id="topup_note" 
                                      style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 12px; font-size: 14px; min-height: 60px; resize: vertical;" 
                                      placeholder="Nama pemilik nomor, dsb..."></textarea>
                        </div>

                        <button onclick="cashModule.saveTopUp()" 
                                style="width: 100%; padding: 16px; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); 
                                color: white; border: none; border-radius: 12px; font-size: 16px; font-weight: 700; cursor: pointer;">
                            💜 Proses Top Up
                        </button>

                        <button onclick="cashModule.addCustomProvider('topup')" 
                                style="width: 100%; margin-top: 12px; padding: 12px; background: #f3f4f6; 
                                border: 2px dashed #d1d5db; border-radius: 12px; font-size: 14px; cursor: pointer; color: #6b7280;">
                            ➕ Tambah Provider Baru
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    saveTopUp() {
        const provider = document.getElementById('topup_provider')?.value;
        const number = document.getElementById('topup_number')?.value?.trim();
        const amount = parseInt(document.getElementById('topup_amount')?.value) || 0;
        const fee = parseInt(document.getElementById('topup_fee')?.value) || 0;
        const note = document.getElementById('topup_note')?.value?.trim() || '';

        if (!provider || !number || amount <= 0) {
            app.showToast('❌ Provider, nomor, dan nominal wajib diisi!');
            return;
        }

        const currentUser = dataManager.getCurrentUser();
        if (!currentUser) {
            app.showToast('❌ Anda harus login terlebih dahulu!');
            return;
        }

        const allProviders = [...this.providers.ewallet, ...this.providers.bank, ...this.providers.custom];
        const providerInfo = allProviders.find(p => p.value === provider);

        const transaction = {
            id: 'topup_' + Date.now().toString(36),
            type: 'out',
            amount: amount,
            category: 'topup',
            note: `Top Up ${providerInfo?.label || provider} ke ${number}${note ? ' - ' + note : ''}`,
            date: new Date().toISOString(),
            userId: currentUser.userId,
            userName: currentUser.name,
            provider: provider,
            number: number,
            fee: fee
        };

        if (!dataManager.data.cashTransactions) {
            dataManager.data.cashTransactions = [];
        }
        dataManager.data.cashTransactions.push(transaction);

        const userShift = dataManager.getUserShift(currentUser.userId);
        if (userShift) {
            const totalModal = (userShift.modalAwal || 0) + (userShift.extraModal || 0);
            const newCash = dataManager.calculateShiftCash(currentUser.userId, totalModal);
            userShift.currentCash = newCash;
            dataManager.updateUserShift(currentUser.userId, userShift);
        }

        dataManager.save();
        app.showToast(`✅ Top Up berhasil! ${fee > 0 ? `Laba fee: Rp ${utils.formatNumber(fee)}` : ''}`);
        this.closeModal('topUpModal');
        this.renderHTML();
        this.renderTransactions();
    },

    openTarikTunai() {
        const modalHTML = `
            <div class="modal active" id="tarikTunaiModal" style="display: flex; z-index: 2000;">
                <div class="modal-content" style="max-width: 500px; border-radius: 20px;">
                    <div class="modal-header" style="padding: 24px; border-bottom: 2px solid #dbeafe;">
                        <span class="modal-title" style="font-size: 20px; font-weight: 700; color: #2563eb;">🏧 Tarik Tunai</span>
                        <button class="close-btn" onclick="cashModule.closeModal('tarikTunaiModal')" style="font-size: 28px; color: #64748b;">×</button>
                    </div>
                    
                    <div style="padding: 24px;">
                        <div style="margin-bottom: 20px;">
                            <label style="display: block; font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 8px;">Provider *</label>
                            <select id="tarik_provider" style="width: 100%; padding: 14px; border: 2px solid #e5e7eb; border-radius: 12px; font-size: 15px;">
                                ${this.generateProviderOptions()}
                            </select>
                        </div>

                        <div style="margin-bottom: 20px;">
                            <label style="display: block; font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 8px;">Nomor Rekening/E-Wallet *</label>
                            <input type="text" id="tarik_number" 
                                   style="width: 100%; padding: 14px; border: 2px solid #e5e7eb; border-radius: 12px; font-size: 15px;" 
                                   placeholder="Nomor rekening atau e-wallet">
                        </div>
                        
                        <div style="margin-bottom: 20px;">
                            <label style="display: block; font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 8px;">Nominal Tarik (Rp) *</label>
                            <input type="number" id="tarik_amount" 
                                   style="width: 100%; padding: 16px; border: 2px solid #e5e7eb; border-radius: 12px; font-size: 18px; font-weight: 700;" 
                                   placeholder="0">
                        </div>

                        <div style="margin-bottom: 20px;">
                            <label style="display: block; font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 8px;">Admin Fee (Rp)</label>
                            <input type="number" id="tarik_fee" 
                                   style="width: 100%; padding: 14px; border: 2px solid #e5e7eb; border-radius: 12px; font-size: 15px;" 
                                   placeholder="0" value="0">
                            <div style="font-size: 12px; color: #64748b; margin-top: 6px;">
                                💡 Fee ini menjadi laba. Biarkan 0 jika tidak ada fee.
                            </div>
                        </div>
                        
                        <div style="margin-bottom: 20px;">
                            <label style="display: block; font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 8px;">Keterangan</label>
                            <textarea id="tarik_note" 
                                      style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 12px; font-size: 14px; min-height: 60px; resize: vertical;" 
                                      placeholder="Nama pemilik rekening, dsb..."></textarea>
                        </div>

                        <button onclick="cashModule.saveTarikTunai()" 
                                style="width: 100%; padding: 16px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); 
                                color: white; border: none; border-radius: 12px; font-size: 16px; font-weight: 700; cursor: pointer;">
                            🏧 Proses Tarik Tunai
                        </button>

                        <button onclick="cashModule.addCustomProvider('tarik')" 
                                style="width: 100%; margin-top: 12px; padding: 12px; background: #f3f4f6; 
                                border: 2px dashed #d1d5db; border-radius: 12px; font-size: 14px; cursor: pointer; color: #6b7280;">
                            ➕ Tambah Provider Baru
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    saveTarikTunai() {
        const provider = document.getElementById('tarik_provider')?.value;
        const number = document.getElementById('tarik_number')?.value?.trim();
        const amount = parseInt(document.getElementById('tarik_amount')?.value) || 0;
        const fee = parseInt(document.getElementById('tarik_fee')?.value) || 0;
        const note = document.getElementById('tarik_note')?.value?.trim() || '';

        if (!provider || !number || amount <= 0) {
            app.showToast('❌ Provider, nomor rekening, dan nominal wajib diisi!');
            return;
        }

        const currentUser = dataManager.getCurrentUser();
        if (!currentUser) {
            app.showToast('❌ Anda harus login terlebih dahulu!');
            return;
        }

        const allProviders = [...this.providers.ewallet, ...this.providers.bank, ...this.providers.custom];
        const providerInfo = allProviders.find(p => p.value === provider);

        const transaction = {
            id: 'tarik_' + Date.now().toString(36),
            type: 'out',
            amount: amount,
            category: 'tarik_tunai',
            note: `Tarik Tunai ${providerInfo?.label || provider} ke ${number}${note ? ' - ' + note : ''}`,
            date: new Date().toISOString(),
            userId: currentUser.userId,
            userName: currentUser.name,
            provider: provider,
            number: number,
            fee: fee
        };

        if (!dataManager.data.cashTransactions) {
            dataManager.data.cashTransactions = [];
        }
        dataManager.data.cashTransactions.push(transaction);

        const userShift = dataManager.getUserShift(currentUser.userId);
        if (userShift) {
            const totalModal = (userShift.modalAwal || 0) + (userShift.extraModal || 0);
            const newCash = dataManager.calculateShiftCash(currentUser.userId, totalModal);
            userShift.currentCash = newCash;
            dataManager.updateUserShift(currentUser.userId, userShift);
        }

        dataManager.save();
        app.showToast(`✅ Tarik tunai berhasil! ${fee > 0 ? `Laba fee: Rp ${utils.formatNumber(fee)}` : ''}`);
        this.closeModal('tarikTunaiModal');
        this.renderHTML();
        this.renderTransactions();
    },

    openModalAwal() {
        const currentUser = dataManager.getCurrentUser();
        if (!currentUser) {
            app.showToast('❌ Anda harus login terlebih dahulu!');
            return;
        }

        const isOwner = currentUser.role === 'owner';
        const isAdmin = currentUser.role === 'admin';
        
        if (!isOwner && !isAdmin) {
            app.showToast('❌ Hanya Owner dan Admin yang dapat mengatur modal awal!');
            return;
        }

        let currentModal = 0;
        let currentExtraModal = 0;
        
        if (isOwner) {
            const globalCash = this.calculateGlobalCash();
            currentModal = globalCash.modal;
        } else {
            const userShift = dataManager.getUserShift(currentUser.userId);
            if (userShift) {
                currentModal = userShift.modalAwal || 0;
                currentExtraModal = userShift.extraModal || 0;
            } else {
                currentModal = dataManager.getPendingModal(currentUser.userId);
                currentExtraModal = dataManager.getPendingExtraModal(currentUser.userId);
            }
        }

        const totalCurrent = currentModal + currentExtraModal;

        const modalHTML = `
            <div class="modal active" id="modalAwalModal" style="display: flex; z-index: 2000;">
                <div class="modal-content" style="max-width: 500px; border-radius: 20px;">
                    <div class="modal-header" style="padding: 24px; border-bottom: 2px solid #fef3c7;">
                        <span class="modal-title" style="font-size: 20px; font-weight: 700; color: #92400e;">💰 Modal Awal</span>
                        <button class="close-btn" onclick="cashModule.closeModal('modalAwalModal')" style="font-size: 28px; color: #64748b;">×</button>
                    </div>
                    
                    <div style="padding: 24px;">
                        ${totalCurrent > 0 ? `
                        <div style="background: #fef3c7; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
                            <div style="font-size: 13px; color: #92400e; margin-bottom: 4px;">Modal Saat Ini</div>
                            <div style="font-size: 24px; font-weight: 800; color: #92400e;">Rp ${utils.formatNumber(totalCurrent)}</div>
                            ${currentExtraModal > 0 ? `<div style="font-size: 12px; color: #a16207; margin-top: 4px;">Utama: Rp ${utils.formatNumber(currentModal)} + Tambahan: Rp ${utils.formatNumber(currentExtraModal)}</div>` : ''}
                        </div>
                        ` : ''}
                        
                        <div style="margin-bottom: 20px;">
                            <label style="display: block; font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 8px;">
                                ${isOwner ? 'Modal Global Baru (Rp)' : 'Modal Utama Baru (Rp)'} *
                            </label>
                            <input type="number" id="modal_awal_amount" 
                                   style="width: 100%; padding: 16px; border: 2px solid #e5e7eb; border-radius: 12px; font-size: 18px; font-weight: 700;" 
                                   placeholder="0" value="${currentModal > 0 ? currentModal : ''}">
                            <div style="font-size: 12px; color: #64748b; margin-top: 6px;">
                                ${isOwner ? 'Ini akan mengatur modal global untuk semua shift aktif.' : 'Modal utama dari Owner. Hubungi Owner untuk mengubah.'}
                            </div>
                        </div>

                        ${isAdmin ? `
                        <div style="margin-bottom: 20px;">
                            <label style="display: block; font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 8px;">Modal Tambahan (Rp)</label>
                            <input type="number" id="modal_extra_amount" 
                                   style="width: 100%; padding: 16px; border: 2px solid #e5e7eb; border-radius: 12px; font-size: 18px; font-weight: 700;" 
                                   placeholder="0" value="${currentExtraModal > 0 ? currentExtraModal : ''}">
                            <div style="font-size: 12px; color: #64748b; margin-top: 6px;">
                                Modal tambahan dari Admin untuk operasional harian.
                            </div>
                        </div>
                        ` : ''}
                        
                        <div style="margin-bottom: 20px;">
                            <label style="display: block; font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 8px;">Keterangan</label>
                            <textarea id="modal_awal_note" 
                                      style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 12px; font-size: 14px; min-height: 60px; resize: vertical;" 
                                      placeholder="Keterangan perubahan modal..."></textarea>
                        </div>

                        <button onclick="cashModule.saveModalAwal()" 
                                style="width: 100%; padding: 16px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); 
                                color: white; border: none; border-radius: 12px; font-size: 16px; font-weight: 700; cursor: pointer;">
                            💾 Simpan Modal Awal
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    saveModalAwal() {
        const newModal = parseInt(document.getElementById('modal_awal_amount')?.value) || 0;
        const newExtraModal = parseInt(document.getElementById('modal_extra_amount')?.value) || 0;
        const note = document.getElementById('modal_awal_note')?.value?.trim() || '';

        const currentUser = dataManager.getCurrentUser();
        if (!currentUser) {
            app.showToast('❌ Anda harus login terlebih dahulu!');
            return;
        }

        const isOwner = currentUser.role === 'owner';
        const isAdmin = currentUser.role === 'admin';

        if (isOwner) {
            const activeShifts = dataManager.getActiveShifts();
            activeShifts.forEach(shift => {
                const oldModal = shift.modalAwal || 0;
                if (oldModal !== newModal) {
                    shift.modalAwal = newModal;
                    
                    const totalModal = newModal + (shift.extraModal || 0);
                    const newCash = dataManager.calculateShiftCash(shift.userId, totalModal);
                    shift.currentCash = newCash;
                    
                    dataManager.updateUserShift(shift.userId, shift);
                    
                    const transaction = {
                        id: 'modal_awal_' + Date.now().toString(36) + '_' + shift.userId,
                        type: 'modal_in',
                        amount: newModal,
                        category: 'modal_awal',
                        note: note || `Modal awal diubah Owner untuk ${shift.userName}`,
                        date: new Date().toISOString(),
                        userId: shift.userId,
                        userName: shift.userName,
                        givenBy: currentUser.name,
                        givenByRole: 'owner',
                        oldModal: oldModal,
                        newModal: newModal,
                        diff: newModal - oldModal
                    };
                    
                    if (!dataManager.data.cashTransactions) {
                        dataManager.data.cashTransactions = [];
                    }
                    dataManager.data.cashTransactions.push(transaction);
                }
            });
            
            app.showToast(`✅ Modal global berhasil diatur: Rp ${utils.formatNumber(newModal)}`);
        } else if (isAdmin) {
            const userShift = dataManager.getUserShift(currentUser.userId);
            
            if (userShift) {
                const oldExtra = userShift.extraModal || 0;
                
                if (oldExtra !== newExtraModal) {
                    userShift.extraModal = newExtraModal;
                    
                    const totalModal = (userShift.modalAwal || 0) + newExtraModal;
                    const newCash = dataManager.calculateShiftCash(currentUser.userId, totalModal);
                    userShift.currentCash = newCash;
                    
                    dataManager.updateUserShift(currentUser.userId, userShift);
                    
                    const transaction = {
                        id: 'modal_extra_' + Date.now().toString(36),
                        type: 'modal_in',
                        amount: newExtraModal,
                        category: 'modal_tambahan',
                        note: note || 'Modal tambahan diubah oleh Admin',
                        date: new Date().toISOString(),
                        userId: currentUser.userId,
                        userName: currentUser.name,
                        oldExtraModal: oldExtra,
                        newExtraModal: newExtraModal,
                        diff: newExtraModal - oldExtra
                    };
                    
                    if (!dataManager.data.cashTransactions) {
                        dataManager.data.cashTransactions = [];
                    }
                    dataManager.data.cashTransactions.push(transaction);
                }
            } else {
                dataManager.setPendingExtraModal(currentUser.userId, newExtraModal);
                
                const transaction = {
                    id: 'modal_extra_pending_' + Date.now().toString(36),
                    type: 'modal_in',
                    amount: newExtraModal,
                    category: 'modal_tambahan',
                    note: note || 'Modal tambahan disimpan (menunggu shift aktif)',
                    date: new Date().toISOString(),
                    userId: currentUser.userId,
                    userName: currentUser.name,
                    status: 'pending'
                };
                
                if (!dataManager.data.cashTransactions) {
                    dataManager.data.cashTransactions = [];
                }
                dataManager.data.cashTransactions.push(transaction);
            }
            
            app.showToast(`✅ Modal tambahan berhasil diatur: Rp ${utils.formatNumber(newExtraModal)}`);
        }

        dataManager.save();
        this.closeModal('modalAwalModal');
        this.renderHTML();
        this.renderTransactions();
    },

    showResetOptions() {
        const currentUser = dataManager.getCurrentUser();
        if (!currentUser || (currentUser.role !== 'owner' && currentUser.role !== 'admin')) {
            app.showToast('❌ Hanya Owner dan Admin yang dapat melakukan reset!');
            return;
        }

        const modalHTML = `
            <div class="modal active" id="resetOptionsModal" style="display: flex; z-index: 2000;">
                <div class="modal-content" style="max-width: 500px; border-radius: 20px;">
                    <div class="modal-header" style="padding: 24px; border-bottom: 2px solid #fee2e2;">
                        <span class="modal-title" style="font-size: 20px; font-weight: 700; color: #dc2626;">🔄 Reset Kas & Modal</span>
                        <button class="close-btn" onclick="cashModule.closeModal('resetOptionsModal')" style="font-size: 28px; color: #64748b;">×</button>
                    </div>
                    
                    <div style="padding: 24px;">
                        <div style="background: #fef2f2; border: 2px solid #fee2e2; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
                            <div style="font-size: 14px; color: #991b1b; font-weight: 600; margin-bottom: 8px;">⚠️ Perhatian!</div>
                            <div style="font-size: 13px; color: #b91c1c;">
                                Reset akan menutup semua shift aktif dan mengatur ulang modal. Pastikan semua transaksi sudah tercatat dengan benar.
                            </div>
                        </div>

                        <div style="display: flex; flex-direction: column; gap: 12px;">
                            <button onclick="cashModule.resetDaily()" 
                                    style="padding: 16px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); 
                                    color: white; border: none; border-radius: 12px; font-size: 15px; font-weight: 700; cursor: pointer;">
                                🌅 Reset Harian (Tutup Semua Shift)
                            </button>
                            
                            <button onclick="cashModule.closeAllShiftsOnly()" 
                                    style="padding: 16px; background: #f3f4f6; 
                                    border: 2px solid #e5e7eb; border-radius: 12px; font-size: 15px; font-weight: 600; cursor: pointer; color: #374151;">
                                🔒 Tutup Shift Saja (Tanpa Reset Modal)
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    resetDaily() {
        if (!confirm('Yakin ingin melakukan reset harian? Semua shift akan ditutup dan modal akan direset.')) {
            return;
        }

        const currentUser = dataManager.getCurrentUser();
        if (!currentUser) return;

        const activeShifts = dataManager.getActiveShifts();
        const now = new Date().toISOString();

        activeShifts.forEach(shift => {
            const totalModal = (shift.modalAwal || 0) + (shift.extraModal || 0);
            const finalCash = dataManager.calculateShiftCash(shift.userId, totalModal);
            
            const transaction = {
                id: 'shift_close_' + Date.now().toString(36) + '_' + shift.userId,
                type: 'out',
                category: 'shift_close',
                amount: finalCash,
                note: `Penutupan shift oleh ${currentUser.name}. Modal: Rp ${utils.formatNumber(totalModal)}, Kas Akhir: Rp ${utils.formatNumber(finalCash)}`,
                date: now,
                userId: shift.userId,
                userName: shift.userName,
                closedBy: currentUser.name,
                modalAwal: totalModal,
                finalCash: finalCash
            };
            
            if (!dataManager.data.cashTransactions) {
                dataManager.data.cashTransactions = [];
            }
            dataManager.data.cashTransactions.push(transaction);
        });

        dataManager.data.activeShifts = [];
        dataManager.data.pendingModals = {};
        dataManager.data.pendingExtraModals = {};
        
        localStorage.setItem('hifzi_last_active_date', new Date().toDateString());

        dataManager.save();
        app.showToast('✅ Reset harian berhasil! Semua shift ditutup.');
        this.closeModal('resetOptionsModal');
        this.renderHTML();
        this.renderTransactions();
    },

    closeAllShiftsOnly() {
        if (!confirm('Yakin ingin menutup semua shift tanpa reset modal? Modal akan tetap tersimpan untuk shift berikutnya.')) {
            return;
        }

        const currentUser = dataManager.getCurrentUser();
        if (!currentUser) return;

        const activeShifts = dataManager.getActiveShifts();
        const now = new Date().toISOString();

        activeShifts.forEach(shift => {
            const totalModal = (shift.modalAwal || 0) + (shift.extraModal || 0);
            
            dataManager.setPendingModal(shift.userId, shift.modalAwal || 0);
            dataManager.setPendingExtraModal(shift.userId, shift.extraModal || 0);
            
            const transaction = {
                id: 'shift_close_' + Date.now().toString(36) + '_' + shift.userId,
                type: 'out',
                category: 'shift_close',
                amount: 0,
                note: `Shift ditutup oleh ${currentUser.name}. Modal disimpan untuk shift berikutnya: Rp ${utils.formatNumber(totalModal)}`,
                date: now,
                userId: shift.userId,
                userName: shift.userName,
                closedBy: currentUser.name,
                savedModal: totalModal
            };
            
            if (!dataManager.data.cashTransactions) {
                dataManager.data.cashTransactions = [];
            }
            dataManager.data.cashTransactions.push(transaction);
        });

        dataManager.data.activeShifts = [];

        dataManager.save();
        app.showToast('✅ Semua shift ditutup. Modal tersimpan untuk shift berikutnya.');
        this.closeModal('resetOptionsModal');
        this.renderHTML();
        this.renderTransactions();
    },

    calculateActualCash() {
        const transactions = dataManager.getCashTransactions() || [];
        const currentUser = dataManager.getCurrentUser();
        
        let total = 0;
        
        transactions.forEach(t => {
            if (currentUser && currentUser.role !== 'owner' && t.userId !== currentUser.userId) return;
            
            const amount = parseInt(t.amount) || 0;
            
            if (t.type === 'in' || t.category === 'modal_awal' || t.category === 'modal_tambahan') {
                total += amount;
            } else if (t.type === 'out') {
                total -= amount;
            }
        });
        
        return total;
    },

    getTodayCashSales() {
        const today = new Date().toDateString();
        const transactions = dataManager.getTransactions() || [];
        const currentUser = dataManager.getCurrentUser();
        
        let total = 0;
        
        transactions.forEach(t => {
            if (new Date(t.date).toDateString() !== today) return;
            if (currentUser && currentUser.role !== 'owner' && t.userId !== currentUser.userId) return;
            if (t.paymentMethod === 'cash' && t.type === 'sale') {
                total += parseInt(t.total) || 0;
            }
        });
        
        return total;
    },

    getTodayNonCashSales() {
        const today = new Date().toDateString();
        const transactions = dataManager.getTransactions() || [];
        const currentUser = dataManager.getCurrentUser();
        
        let total = 0;
        
        transactions.forEach(t => {
            if (new Date(t.date).toDateString() !== today) return;
            if (currentUser && currentUser.role !== 'owner' && t.userId !== currentUser.userId) return;
            if (t.paymentMethod !== 'cash' && t.type === 'sale') {
                total += parseInt(t.total) || 0;
            }
        });
        
        return total;
    },

    recalculateCash() {
        const currentUser = dataManager.getCurrentUser();
        if (!currentUser || currentUser.role !== 'owner') {
            app.showToast('❌ Hanya Owner yang dapat recalculate!');
            return;
        }

        const activeShifts = dataManager.getActiveShifts();
        
        activeShifts.forEach(shift => {
            const totalModal = (shift.modalAwal || 0) + (shift.extraModal || 0);
            const newCash = dataManager.calculateShiftCash(shift.userId, totalModal);
            shift.currentCash = newCash;
            dataManager.updateUserShift(shift.userId, shift);
        });

        dataManager.save();
        app.showToast('✅ Kas berhasil direcalculate!');
        this.renderHTML();
    },

    openHistory() {
        this.filterState.showHistory = true;
        this.renderHTML();
        this.renderTransactions();
        
        setTimeout(() => {
            const list = document.getElementById('cashTransactionList');
            if (list) {
                list.scrollIntoView({ behavior: 'smooth' });
            }
        }, 100);
    },

    confirmDelete(transactionId) {
        this.currentDeleteTransaction = transactionId;
        
        const modalHTML = `
            <div class="modal active" id="confirmDeleteModal" style="display: flex; z-index: 3000;">
                <div class="modal-content" style="max-width: 400px; border-radius: 20px; text-align: center;">
                    <div style="padding: 32px 24px;">
                        <div style="width: 80px; height: 80px; background: #fee2f2; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 40px;">
                            🗑️
                        </div>
                        <h3 style="font-size: 20px; font-weight: 700; color: #1f2937; margin-bottom: 12px;">Hapus Transaksi?</h3>
                        <p style="font-size: 14px; color: #6b7280; margin-bottom: 24px;">
                            Transaksi yang dihapus tidak dapat dikembalikan. Lanjutkan?
                        </p>
                        
                        <div style="display: flex; gap: 12px;">
                            <button onclick="cashModule.closeModal('confirmDeleteModal'); cashModule.currentDeleteTransaction = null;" 
                                    style="flex: 1; padding: 14px; background: #f3f4f6; border: none; border-radius: 12px; font-size: 15px; font-weight: 600; cursor: pointer; color: #374151;">
                                Batal
                            </button>
                            <button onclick="cashModule.deleteTransaction()" 
                                    style="flex: 1; padding: 14px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); 
                                    color: white; border: none; border-radius: 12px; font-size: 15px; font-weight: 700; cursor: pointer;">
                                Hapus
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    deleteTransaction() {
        if (!this.currentDeleteTransaction) return;
        
        const transactions = dataManager.data.cashTransactions || [];
        const index = transactions.findIndex(t => t.id === this.currentDeleteTransaction);
        
        if (index === -1) {
            app.showToast('❌ Transaksi tidak ditemukan!');
            this.closeModal('confirmDeleteModal');
            return;
        }

        const deletedTransaction = transactions[index];
        transactions.splice(index, 1);
        
        const currentUser = dataManager.getCurrentUser();
        if (currentUser) {
            const userShift = dataManager.getUserShift(currentUser.userId);
            if (userShift) {
                const totalModal = (userShift.modalAwal || 0) + (userShift.extraModal || 0);
                const newCash = dataManager.calculateShiftCash(currentUser.userId, totalModal);
                userShift.currentCash = newCash;
                dataManager.updateUserShift(currentUser.userId, userShift);
            }
        }

        dataManager.save();
        app.showToast('✅ Transaksi berhasil dihapus!');
        this.closeModal('confirmDeleteModal');
        this.currentDeleteTransaction = null;
        this.renderHTML();
        this.renderTransactions();
    },

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.remove();
        }
    }
};

window.cashModule = cashModule;

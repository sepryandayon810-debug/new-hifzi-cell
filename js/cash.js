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
        
        // User info card
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

        // Warning hari baru
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

        // Tombol Modal Awal - hanya untuk Owner dan Admin
        const modalAwalButtonHtml = (isOwner || isAdmin) ? `
            <button class="cash-btn modal-awal" onclick="cashModule.openModalAwal()">
                <span class="cash-btn-icon">💰</span>
                <span class="cash-btn-text">Modal Awal</span>
            </button>
        ` : '';

        // Tombol Atur Modal untuk Owner
        const aturModalButtonHtml = isOwner ? `
            <button class="cash-btn atur-modal-kasir" onclick="cashModule.showAturModalKasir()">
                <span class="cash-btn-icon">👥</span>
                <span class="cash-btn-text">Atur Modal User</span>
            </button>
        ` : '';

        // Tombol bagi modal untuk Admin
        const bagiModalButtonHtml = isAdmin ? `
            <button class="cash-btn atur-modal-kasir" onclick="cashModule.showBagiModalKasir()">
                <span class="cash-btn-icon">🔄</span>
                <span class="cash-btn-text">Bagi Modal Tambahan</span>
            </button>
        ` : '';

        // Pengaturan Shift - hanya untuk Owner dan Admin
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

        // Tampilkan semua user dengan shift aktif beserta modal mereka
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

        // Warning data tidak konsisten - hanya untuk Owner
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
                
                <!-- Hero Card -->
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

                <!-- Filter Bar -->
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

                <!-- Profit Card -->
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

                <!-- Actions Card -->
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

                <!-- History Card -->
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

    // ==================== MODAL ATUR MODAL ====================
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

        let userListHtml = users.map(user => {
            const shift = activeShifts.find(s => s.userId === user.id);
            const mainModal = shift ? (shift.modalAwal || 0) : (dataManager.data.pendingModals?.[user.id] || 0);
            const extraModal = shift ? (shift.extraModal || 0) : (dataManager.data.pendingExtraModals?.[user.id] || 0);
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
            const mainModal = shift ? (shift.modalAwal || 0) : (dataManager.data.pendingModals?.[user.id] || 0);
            const currentExtraModal = shift ? (shift.extraModal || 0) : (dataManager.data.pendingExtraModals?.[user.id] || 0);
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
        bagiData.forEach(({ userId, extraModal }) => {
            const shift = activeShifts.find(s => s.userId === userId);
            
            if (shift) {
                shift.extraModal = (shift.extraModal || 0) + extraModal;
                
                const totalModal = (shift.modalAwal || 0) + shift.extraModal;
                const newCash = dataManager.calculateShiftCash(userId, totalModal);
                shift.currentCash = newCash;
                
                dataManager.updateUserShift(userId, shift);
                updatedCount++;
            } else {
                if (!dataManager.data.pendingExtraModals) dataManager.data.pendingExtraModals = {};
                dataManager.data.pendingExtraModals[userId] = (dataManager.data.pendingExtraModals[userId] || 0) + extraModal;
            }
        });

        const adminShift = dataManager.getUserShift(currentUser.userId);
        if (adminShift) {
            adminShift.modalAwal = Math.max(0, (adminShift.modalAwal || 0) - totalBagi);
            
            const newAdminTotalModal = (adminShift.modalAwal || 0) + (adminShift.extraModal || 0);
            const newAdminCash = dataManager.calculateShiftCash(currentUser.userId, newAdminTotalModal);
            adminShift.currentCash = newAdminCash;
            
            dataManager.updateUserShift(currentUser.userId, adminShift);
        }

        dataManager.save();
        app.showToast(`✅ Berhasil membagi modal tambahan ke ${bagiData.length} kasir! Total: Rp ${utils.formatNumber(totalBagi)}`);
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
                shift.modalAwal = newModal;
                
                const totalModal = newModal + (shift.extraModal || 0);
                const newCash = dataManager.calculateShiftCash(user.id, totalModal);
                shift.currentCash = newCash;
                
                dataManager.updateUserShift(user.id, shift);
                updatedCount++;
            } else {
                if (!dataManager.data.pendingModals) dataManager.data.pendingModals = {};
                dataManager.data.pendingModals[user.id] = newModal;
                savedCount++;
            }
        });

        dataManager.save();

        if (savedCount > 0 || updatedCount > 0) {
            app.showToast(`✅ Berhasil! ${updatedCount} user aktif diupdate, ${savedCount} disimpan untuk shift berikutnya.`);
            this.closeModal('aturModalKasirModal');
            this.renderHTML();
            this.renderTransactions();
        } else {
            app.showToast('⚠️ Tidak ada perubahan yang disimpan.');
        }
    },

    // ==================== FILTER & STATS ====================
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
            icon.classList.toggle('open', this.filterState.showHistory);
        }
        
        if (list) {
            if (this.filterState.showHistory) {
                list.style.maxHeight = 'none';
                list.style.overflow = 'visible';
            } else {
                list.style.maxHeight = '0';
                list.style.overflow = 'hidden';
            }
        }
        
        this.renderTransactions();
    },

    calculatePeriodStats(startDate, endDate) {
        const currentUser = dataManager.getCurrentUser();
        const isOwner = currentUser && currentUser.role === 'owner';
        const isAdmin = currentUser && currentUser.role === 'admin';
        const isKasir = currentUser && currentUser.role === 'kasir';
        
        let transactions = dataManager.data.cashTransactions.filter(t => {
            const tDate = new Date(t.date);
            const inRange = tDate >= startDate && tDate <= endDate;
            
            if (isKasir) {
                return inRange && (t.userId === currentUser.userId || !t.userId);
            }
            
            return inRange;
        });
        
        const manualKasMasuk = transactions
            .filter(t => t.type === 'in')
            .reduce((sum, t) => sum + (parseInt(t.amount) || 0), 0);
        
        const topUpMasuk = transactions
            .filter(t => t.type === 'topup')
            .reduce((sum, t) => sum + (parseInt(t.amount) || 0), 0);
        
        const kasKeluar = transactions
            .filter(t => t.type === 'out')
            .reduce((sum, t) => sum + (parseInt(t.amount) || 0), 0);
        
        const kasMasuk = manualKasMasuk + topUpMasuk;
        
        const labaTopUp = transactions
            .filter(t => t.type === 'topup')
            .reduce((sum, t) => sum + (parseInt(t.details?.adminFee) || 0), 0);
        
        const labaTarikTunai = transactions
            .filter(t => t.category === 'tarik_tunai')
            .reduce((sum, t) => sum + (parseInt(t.details?.adminFee) || 0), 0);
        
        const laba = labaTopUp + labaTarikTunai;
        
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

    renderTransactions() {
        const container = document.getElementById('cashTransactionList');
        if (!container) return;
        
        if (!this.filterState.showHistory) {
            container.innerHTML = '';
            return;
        }
        
        const { startDate, endDate } = this.getDateRange();
        const currentUser = dataManager.getCurrentUser();
        const isOwner = currentUser && currentUser.role === 'owner';
        const isAdmin = currentUser && currentUser.role === 'admin';
        const isKasir = currentUser && currentUser.role === 'kasir';
        
        let transactions = dataManager.data.cashTransactions.filter(t => {
            const tDate = new Date(t.date);
            const inRange = tDate >= startDate && tDate <= endDate;
            
            if (isKasir) {
                return inRange && (t.userId === currentUser.userId || !t.userId);
            }
            
            return inRange;
        }).sort((a, b) => new Date(b.date) - new Date(a.date));
        
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
                <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 16px; align-items: flex-start;">
                    <div>
                        <div style="font-size: 16px; font-weight: 700; color: var(--cash-text); margin-bottom: 6px;">
                            Ringkasan ${periodLabel}
                            ${isOwner || isAdmin ? '' : '<span style="font-size: 12px; color: var(--cash-text-secondary); font-weight: 500;">(Shift Anda)</span>'}
                        </div>
                        <div style="font-size: 14px; color: var(--cash-text-secondary);">
                            ${transactions.length} transaksi kas
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="color: var(--cash-success); font-weight: 700; font-size: 15px;">⬇️ Kas Masuk: Rp ${utils.formatNumber(totalKasMasuk)}</div>
                        <div style="color: var(--cash-danger); font-weight: 700; font-size: 15px; margin: 6px 0;">⬆️ Kas Keluar: Rp ${utils.formatNumber(totalKasKeluar)}</div>
                        ${totalModal > 0 ? `<div style="color: var(--cash-warning); font-weight: 700; font-size: 14px; margin: 6px 0;">💰 Modal: Rp ${utils.formatNumber(totalModal)}</div>` : ''}
                        ${totalPosSales > 0 ? `<div style="color: var(--cash-info); font-weight: 700; font-size: 14px; margin: 6px 0;">🛒 Penjualan POS: Rp ${utils.formatNumber(totalPosSales)}</div>` : ''}
                        <div style="font-weight: 800; font-size: 18px; color: var(--cash-purple); padding-top: 12px; margin-top: 12px; border-top: 2px solid var(--cash-border);">
                            💰 Laba Bersih: Rp ${utils.formatNumber(totalLaba)}
                        </div>
                    </div>
                </div>
            `;
        }
        
        if (transactions.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: var(--cash-text-secondary);">
                    <div style="font-size: 72px; margin-bottom: 20px;">📋</div>
                    <p style="font-size: 18px; margin: 0; font-weight: 600;">Belum ada transaksi ${this.getFilterLabel().toLowerCase()}</p>
                    <p style="font-size: 14px; margin-top: 12px; opacity: 0.8;">Transaksi kas masuk dan keluar akan muncul di sini</p>
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
                <div class="cash-date-group">
                    <div class="cash-date-header">
                        <span>${dateKey}</span>
                        <div style="display: flex; gap: 16px; align-items: center;">
                            ${dayLaba > 0 ? `<span style="color: #7c3aed; font-size: 13px; font-weight: 700;">💰 Laba: Rp ${utils.formatNumber(dayLaba)}</span>` : ''}
                            <span style="color: ${dayKasNet >= 0 ? 'var(--cash-success)' : 'var(--cash-danger)'}; font-weight: 700;">
                                Kas: ${dayKasNet >= 0 ? '+' : ''}Rp ${utils.formatNumber(Math.abs(dayKasNet))}
                            </span>
                        </div>
                    </div>
            `;
            
            dayTrans.forEach(t => {
                const isIncome = t.type === 'in' || t.type === 'modal_in' || t.type === 'topup' || t.type === 'pos_sale';
                const prefix = isIncome ? '+' : '-';
                const amountColor = isIncome ? 'income' : 'expense';
                
                let typeLabel = '';
                let labaBadge = '';
                let modalBadge = '';
                let posBadge = '';
                let userBadge = '';
                
                if ((isOwner || isAdmin) && t.userId) {
                    const user = dataManager.getUsers().find(u => u.id === t.userId);
                    if (user) {
                        userBadge = `<span class="cash-transaction-badge user">👤 ${user.name}</span>`;
                    }
                }
                
                if (t.type === 'modal_in') {
                    typeLabel = ' (Modal)';
                    modalBadge = `<span class="cash-transaction-badge modal">MODAL</span>`;
                } else if (t.type === 'topup') {
                    typeLabel = ' (Top Up)';
                    const adminFee = parseInt(t.details?.adminFee) || 0;
                    if (adminFee > 0) {
                        labaBadge = `<span class="cash-transaction-badge profit">Laba: Rp ${utils.formatNumber(adminFee)}</span>`;
                    }
                } else if (t.category === 'tarik_tunai') {
                    typeLabel = ' (Tarik Tunai)';
                    const adminFee = parseInt(t.details?.adminFee) || 0;
                    if (adminFee > 0) {
                        labaBadge = `<span class="cash-transaction-badge profit">Laba: Rp ${utils.formatNumber(adminFee)}</span>`;
                    }
                } else if (t.type === 'pos_sale') {
                    typeLabel = ' (POS)';
                    posBadge = `<span class="cash-transaction-badge pos">AUTO</span>`;
                } else if (t.type === 'pos_void') {
                    typeLabel = ' (Batal POS)';
                    posBadge = `<span class="cash-transaction-badge void">VOID</span>`;
                }
                
                const timeStr = new Date(t.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                
                const showDelete = t.type !== 'pos_sale' && t.type !== 'pos_void';
                
                html += `
                    <div class="cash-transaction-item">
                        <div style="flex: 1;">
                            <div class="cash-transaction-title">
                                ${t.note || t.category}${typeLabel}
                                ${labaBadge}
                                ${modalBadge}
                                ${posBadge}
                                ${userBadge}
                            </div>
                            <div style="font-size: 13px; color: var(--cash-text-secondary);">${timeStr}</div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div class="cash-transaction-amount ${amountColor}">
                                ${prefix} Rp ${utils.formatNumber(t.amount)}
                            </div>
                            ${showDelete ? `
                            <button class="cash-transaction-delete" data-transaction-id="${t.id}" title="Hapus transaksi">🗑️</button>
                            ` : '<span style="font-size: 12px; color: var(--cash-text-secondary); font-style: italic;">Auto</span>'}
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';
        });
        
        container.innerHTML = html;
        this.attachDeleteListeners();
    },

    attachDeleteListeners() {
        document.querySelectorAll('.cash-transaction-delete').forEach(btn => {
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
        
        if (transaction.type === 'in' || transaction.type === 'modal_in' || transaction.type === 'topup') {
            dataManager.data.settings.currentCash = (parseInt(dataManager.data.settings.currentCash) || 0) - parseInt(transaction.amount);
            
            if (currentUser) {
                const userShift = dataManager.getUserShift(currentUser.userId);
                if (userShift) {
                    userShift.currentCash = (userShift.currentCash || 0) - parseInt(transaction.amount);
                    dataManager.updateUserShift(currentUser.userId, userShift);
                }
            }
        } else if (transaction.type === 'out') {
            dataManager.data.settings.currentCash = (parseInt(dataManager.data.settings.currentCash) || 0) + parseInt(transaction.amount);
            
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
    },

    updateStats() {
        const currentUser = dataManager.getCurrentUser();
        const userShift = currentUser ? dataManager.getUserShift(currentUser.userId) : null;
        
        let currentCash = 0;
        let modalAwal = 0;
        
        if (currentUser && currentUser.role === 'owner') {
            const globalCash = this.calculateGlobalCash();
            currentCash = globalCash.cash;
            modalAwal = globalCash.modal;
        } else if (userShift) {
            const totalModal = (userShift.modalAwal || 0) + (userShift.extraModal || 0);
            currentCash = dataManager.calculateShiftCash(currentUser.userId, totalModal);
            modalAwal = totalModal;
        }
        
        const currentCashEl = document.getElementById('currentCash');
        const modalAwalEl = document.getElementById('modalAwal');
        
        if (currentCashEl) currentCashEl.textContent = 'Rp ' + utils.formatNumber(currentCash);
        if (modalAwalEl) modalAwalEl.textContent = 'Rp ' + utils.formatNumber(modalAwal);
    },

    calculateActualCash() {
        const currentUser = dataManager.getCurrentUser();
        const isOwner = currentUser && currentUser.role === 'owner';
        const isAdmin = currentUser && currentUser.role === 'admin';
        
        let transactions = dataManager.data.cashTransactions;
        
        if (!isOwner && !isAdmin) {
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
        const isOwner = currentUser && currentUser.role === 'owner';
        const isAdmin = currentUser && currentUser.role === 'admin';
        
        return dataManager.data.transactions
            .filter(t => {
                const tDate = new Date(t.date).toDateString();
                const isToday = tDate === today;
                const isCash = t.paymentMethod === 'cash';
                
                if (!isOwner && !isAdmin) {
                    return isToday && isCash && t.userId === currentUser.userId;
                }
                
                return isToday && isCash;
            })
            .reduce((sum, t) => sum + (parseInt(t.total) || 0), 0);
    },

    getTodayNonCashSales() {
        const today = new Date().toDateString();
        const currentUser = dataManager.getCurrentUser();
        const isOwner = currentUser && currentUser.role === 'owner';
        const isAdmin = currentUser && currentUser.role === 'admin';
        
        return dataManager.data.transactions
            .filter(t => {
                const tDate = new Date(t.date).toDateString();
                const isToday = tDate === today;
                const isNonCash = t.paymentMethod !== 'cash';
                
                if (!isOwner && !isAdmin) {
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
        
        if (currentUser && currentUser.role === 'owner') {
            const activeShifts = dataManager.getActiveShifts();
            activeShifts.forEach(shift => {
                const totalModal = (shift.modalAwal || 0) + (shift.extraModal || 0);
                const newCash = dataManager.calculateShiftCash(shift.userId, totalModal);
                dataManager.updateUserShift(shift.userId, { currentCash: newCash });
            });
            
            const globalCash = this.calculateGlobalCash();
            dataManager.data.settings.currentCash = globalCash.cash;
        } else {
            const userShift = dataManager.getUserShift(currentUser.userId);
            if (userShift) {
                const totalModal = (userShift.modalAwal || 0) + (userShift.extraModal || 0);
                const newCash = dataManager.calculateShiftCash(currentUser.userId, totalModal);
                dataManager.updateUserShift(currentUser.userId, { currentCash: newCash });
            }
        }
        
        dataManager.save();
        
        app.showToast('✅ Kas direcalculate');
        this.renderHTML();
        this.renderTransactions();
        app.updateHeader();
    },

    // ==================== MODALS ====================
    openModal(type) {
        const currentUser = dataManager.getCurrentUser();
        const userShift = currentUser ? dataManager.getUserShift(currentUser.userId) : null;
        
        if (!userShift && currentUser && currentUser.role !== 'owner' && currentUser.role !== 'admin') {
            app.showToast('⚠️ Kasir belum dibuka! Silakan buka kasir terlebih dahulu.');
            return;
        }

        const isIncome = type === 'in';
        const title = isIncome ? '⬇️ Kas Masuk' : '⬆️ Kas Keluar';
        const color = isIncome ? 'var(--cash-success)' : 'var(--cash-danger)';
        
        const modalHTML = `
            <div class="modal active" id="cashModal" style="display: flex; z-index: 2000;">
                <div class="modal-content" style="max-width: 420px; border-radius: 20px;">
                    <div class="modal-header" style="border-bottom: 1px solid #e2e8f0; padding: 20px 24px;">
                        <span class="modal-title" style="color: ${color}; font-size: 18px; font-weight: 700;">${title}</span>
                        <button class="close-btn" onclick="cashModule.closeModal('cashModal')" style="color: #64748b; font-size: 28px;">×</button>
                    </div>

                    <div style="padding: 24px;">
                        <div class="form-group" style="margin-bottom: 20px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--cash-text); font-size: 14px;">Jumlah (Rp) *</label>
                            <input type="number" id="cashAmount" placeholder="0" autofocus 
                                   style="width: 100%; padding: 14px 16px; border: 2px solid #e2e8f0; border-radius: 12px; font-size: 16px; outline: none; transition: all 0.2s;"
                                   onfocus="this.style.borderColor='${color}'" onblur="this.style.borderColor='#e2e8f0'">
                        </div>

                        <div class="form-group" style="margin-bottom: 20px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--cash-text); font-size: 14px;">Kategori *</label>
                            <select id="cashCategory" style="width: 100%; padding: 14px 16px; border: 2px solid #e2e8f0; border-radius: 12px; font-size: 14px; outline: none; background: white;">
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

                        <div class="form-group" style="margin-bottom: 20px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--cash-text); font-size: 14px;">Keterangan</label>
                            <textarea id="cashNote" rows="3" placeholder="Keterangan tambahan..." 
                                      style="width: 100%; padding: 14px 16px; border: 2px solid #e2e8f0; border-radius: 12px; font-size: 14px; outline: none; resize: vertical;"></textarea>
                        </div>
                    </div>

                    <div class="modal-footer" style="padding: 20px 24px; border-top: 1px solid #e2e8f0; background: #f8fafc;">
                        <button class="btn btn-secondary" onclick="cashModule.closeModal('cashModal')" style="padding: 12px 24px; border-radius: 10px; font-weight: 600;">Batal</button>
                        <button class="btn btn-primary" onclick="cashModule.saveCash('${type}')" 
                                style="padding: 12px 24px; border-radius: 10px; font-weight: 700; background: ${color}; border-color: ${color};">
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
        const currentUser = dataManager.getCurrentUser();
        const userShift = currentUser ? dataManager.getUserShift(currentUser.userId) : null;
        
        if (!userShift && currentUser && currentUser.role !== 'owner' && currentUser.role !== 'admin') {
            app.showToast('⚠️ Kasir belum dibuka!');
            return;
        }

        const providerOptions = this.generateProviderOptions();

        const modalHTML = `
            <div class="modal active" id="topUpModal" style="display: flex; z-index: 2000;">
                <div class="modal-content" style="max-width: 440px; border-radius: 20px;">
                    <div class="modal-header" style="border-bottom: 1px solid #e2e8f0; padding: 20px 24px; background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%);">
                        <span class="modal-title" style="color: #7c3aed; font-size: 18px; font-weight: 700;">💜 Top Up E-Wallet</span>
                        <button class="close-btn" onclick="cashModule.closeModal('topUpModal')" style="color: #7c3aed; font-size: 28px;">×</button>
                    </div>

                    <div style="padding: 24px;">
                        <div class="form-group" style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--cash-text); font-size: 14px;">Provider *</label>
                            <select id="topUpProvider" style="width: 100%; padding: 14px 16px; border: 2px solid #e2e8f0; border-radius: 12px; font-size: 14px; outline: none; background: white;">
                                ${providerOptions}
                            </select>
                        </div>
                        
                        <div style="text-align: right; margin-bottom: 16px;">
                            <button onclick="cashModule.addCustomProvider('topup')" style="font-size: 12px; color: var(--cash-primary); background: none; border: none; cursor: pointer; font-weight: 600;">
                                ➕ Tambah Provider Baru
                            </button>
                            ${this.providers.custom.length > 0 ? `
                            <button onclick="cashModule.manageCustomProviders()" style="font-size: 12px; color: var(--cash-danger); background: none; border: none; cursor: pointer; margin-left: 12px; font-weight: 600;">
                                ✏️ Kelola Provider
                            </button>
                            ` : ''}
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                            <div class="form-group">
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--cash-text); font-size: 14px;">Nominal Top Up (Rp) *</label>
                                <select id="topUpNominal" onchange="cashModule.handleTopUpNominalChange()" 
                                        style="width: 100%; padding: 14px 16px; border: 2px solid #e2e8f0; border-radius: 12px; font-size: 14px; outline: none; background: white;">
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
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--cash-text); font-size: 14px;">Nominal Lain (Rp)</label>
                                <input type="number" id="topUpCustomNominal" placeholder="0" oninput="cashModule.calcTopUp()" 
                                       style="width: 100%; padding: 14px 16px; border: 2px solid #e2e8f0; border-radius: 12px; font-size: 14px; outline: none;">
                            </div>
                        </div>

                        <div class="form-group" style="margin-bottom: 20px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--cash-text); font-size: 14px;">Admin Fee (Rp)</label>
                            <input type="number" id="topUpAdminFee" placeholder="0" value="0" oninput="cashModule.calcTopUp()" 
                                   style="width: 100%; padding: 14px 16px; border: 2px solid #e2e8f0; border-radius: 12px; font-size: 14px; outline: none;">
                        </div>

                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px; padding: 20px; color: white; margin-bottom: 20px;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 14px;">
                                <span>Nominal Top Up:</span>
                                <span id="topUpDisplayNominal" style="font-weight: 600;">Rp 0</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 14px;">
                                <span>Admin Fee:</span>
                                <span id="topUpDisplayAdmin" style="font-weight: 600;">Rp 0</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 20px; font-weight: 800; border-top: 2px solid rgba(255,255,255,0.3); padding-top: 12px; margin-top: 12px;">
                                <span>Total Dibayar:</span>
                                <span id="topUpTotal">Rp 0</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 14px; color: #a5d6a7; margin-top: 8px;">
                                <span>💰 Laba:</span>
                                <span id="topUpLaba">Rp 0</span>
                            </div>
                        </div>
                    </div>

                    <div class="modal-footer" style="padding: 20px 24px; border-top: 1px solid #e2e8f0; background: #f8fafc;">
                        <button class="btn btn-secondary" onclick="cashModule.closeModal('topUpModal')" style="padding: 12px 24px; border-radius: 10px; font-weight: 600;">Batal</button>
                        <button class="btn btn-primary" onclick="cashModule.saveTopUp()" 
                                style="padding: 12px 24px; border-radius: 10px; font-weight: 700; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); border: none;">
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
        const nominalSelect = document.getElementById('topUpNominal').value;
        const customNominal = parseInt(document.getElementById('topUpCustomNominal')?.value) || 0;
        const adminFee = parseInt(document.getElementById('topUpAdminFee')?.value) || 0;
        
        const nominal = nominalSelect === 'custom' ? customNominal : (parseInt(nominalSelect) || 0);
        const total = nominal + adminFee;

        if (!provider) {
            app.showToast('❌ Pilih provider!');
            return;
        }
        if (nominal <= 0) {
            app.showToast('❌ Nominal tidak valid!');
            return;
        }

        const providerLabel = this.getProviderLabel(provider);

        this.saveTransaction('topup', total, 'topup_' + provider, `Top Up ${providerLabel}`, {
            provider: provider,
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
        const currentUser = dataManager.getCurrentUser();
        const userShift = currentUser ? dataManager.getUserShift(currentUser.userId) : null;
        
        if (!userShift && currentUser && currentUser.role !== 'owner' && currentUser.role !== 'admin') {
            app.showToast('⚠️ Kasir belum dibuka!');
            return;
        }

        const providerOptions = this.generateProviderOptions();

        const modalHTML = `
            <div class="modal active" id="tarikTunaiModal" style="display: flex; z-index: 2000;">
                <div class="modal-content" style="max-width: 440px; border-radius: 20px;">
                    <div class="modal-header" style="border-bottom: 1px solid #e2e8f0; padding: 20px 24px; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);">
                        <span class="modal-title" style="color: #2563eb; font-size: 18px; font-weight: 700;">🏧 Tarik Tunai</span>
                        <button class="close-btn" onclick="cashModule.closeModal('tarikTunaiModal')" style="color: #2563eb; font-size: 28px;">×</button>
                    </div>

                    <div style="padding: 24px;">
                        <div class="form-group" style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--cash-text); font-size: 14px;">Provider *</label>
                            <select id="tarikProvider" style="width: 100%; padding: 14px 16px; border: 2px solid #e2e8f0; border-radius: 12px; font-size: 14px; outline: none; background: white;">
                                ${providerOptions}
                            </select>
                        </div>
                        
                        <div style="text-align: right; margin-bottom: 16px;">
                            <button onclick="cashModule.addCustomProvider('tarik')" style="font-size: 12px; color: var(--cash-primary); background: none; border: none; cursor: pointer; font-weight: 600;">
                                ➕ Tambah Provider Baru
                            </button>
                            ${this.providers.custom.length > 0 ? `
                            <button onclick="cashModule.manageCustomProviders()" style="font-size: 12px; color: var(--cash-danger); background: none; border: none; cursor: pointer; margin-left: 12px; font-weight: 600;">
                                ✏️ Kelola Provider
                            </button>
                            ` : ''}
                        </div>

                        <div class="form-group" style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--cash-text); font-size: 14px;">Nominal Tarik (Rp) *</label>
                            <input type="number" id="tarikNominal" placeholder="0" oninput="cashModule.calcTarik()" 
                                   style="width: 100%; padding: 14px 16px; border: 2px solid #e2e8f0; border-radius: 12px; font-size: 14px; outline: none;">
                        </div>

                        <div class="form-group" style="margin-bottom: 20px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--cash-text); font-size: 14px;">Admin Fee (Rp)</label>
                            <input type="number" id="tarikAdminFee" placeholder="0" value="0" oninput="cashModule.calcTarik()" 
                                   style="width: 100%; padding: 14px 16px; border: 2px solid #e2e8f0; border-radius: 12px; font-size: 14px; outline: none;">
                        </div>

                        <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); border-radius: 16px; padding: 20px; color: white; margin-bottom: 20px;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 14px;">
                                <span>Nominal Tarik:</span>
                                <span id="tarikDisplayNominal" style="font-weight: 600;">Rp 0</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 14px;">
                                <span>Admin Fee:</span>
                                <span id="tarikDisplayAdmin" style="font-weight: 600;">Rp 0</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 20px; font-weight: 800; border-top: 2px solid rgba(255,255,255,0.3); padding-top: 12px; margin-top: 12px;">
                                <span>Total Diterima:</span>
                                <span id="tarikTotal">Rp 0</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 14px; color: #a5d6a7; margin-top: 8px;">
                                <span>💰 Laba:</span>
                                <span id="tarikLaba">Rp 0</span>
                            </div>
                        </div>
                    </div>

                    <div class="modal-footer" style="padding: 20px 24px; border-top: 1px solid #e2e8f0; background: #f8fafc;">
                        <button class="btn btn-secondary" onclick="cashModule.closeModal('tarikTunaiModal')" style="padding: 12px 24px; border-radius: 10px; font-weight: 600;">Batal</button>
                        <button class="btn btn-primary" onclick="cashModule.saveTarikTunai()" 
                                style="padding: 12px 24px; border-radius: 10px; font-weight: 700; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border: none;">
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
        const nominal = parseInt(document.getElementById('tarikNominal')?.value) || 0;
        const adminFee = parseInt(document.getElementById('tarikAdminFee')?.value) || 0;
        const total = nominal - adminFee;

        if (!provider) {
            app.showToast('❌ Pilih provider!');
            return;
        }
        if (nominal <= 0) {
            app.showToast('❌ Nominal tidak valid!');
            return;
        }

        const providerLabel = this.getProviderLabel(provider);

        this.saveTransaction('out', nominal, 'tarik_tunai', `Tarik Tunai ${providerLabel}`, {
            provider: provider,
            nominal: nominal,
            adminFee: adminFee,
            totalDiterima: total
        });

        this.closeModal('tarikTunaiModal');
        app.showToast(`✅ Tarik Tunai ${providerLabel} berhasil! Laba: Rp ${utils.formatNumber(adminFee)}`);
    },

    openModalAwal() {
        const currentUser = dataManager.getCurrentUser();
        if (!currentUser || (currentUser.role !== 'owner' && currentUser.role !== 'admin')) {
            app.showToast('❌ Hanya Owner dan Admin yang dapat mengatur modal!');
            return;
        }
        
        const userShift = currentUser ? dataManager.getUserShift(currentUser.userId) : null;
        
        let currentModal = 0;
        if (userShift) {
            currentModal = userShift.modalAwal || 0;
        }

        const modalHTML = `
            <div class="modal active" id="modalAwalModal" style="display: flex; z-index: 2000;">
                <div class="modal-content" style="max-width: 420px; border-radius: 20px;">
                    <div class="modal-header" style="border-bottom: 1px solid #e2e8f0; padding: 20px 24px; background: linear-gradient(135deg, #fefce8 0%, #fef9c3 100%);">
                        <span class="modal-title" style="color: #a16207; font-size: 18px; font-weight: 700;">💰 Modal Awal ${currentUser.role === 'owner' ? '(Owner)' : '(Admin)'}</span>
                        <button class="close-btn" onclick="cashModule.closeModal('modalAwalModal')" style="color: #a16207; font-size: 28px;">×</button>
                    </div>

                    <div style="padding: 24px;">
                        <div style="background: #fef3c7; border-radius: 12px; padding: 16px; margin-bottom: 20px; font-size: 14px; color: #92400e; border-left: 4px solid #f59e0b;">
                            <div style="font-weight: 700; margin-bottom: 6px;">ℹ️ Informasi</div>
                            <div>Modal awal adalah uang yang disiapkan di kasir sebelum memulai transaksi hari ini. Modal ini akan digunakan untuk menghitung laba bersih.</div>
                        </div>

                        <div class="form-group" style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--cash-text); font-size: 14px;">Modal Awal Saat Ini</label>
                            <input type="text" value="Rp ${utils.formatNumber(currentModal)}" disabled 
                                   style="width: 100%; padding: 14px 16px; border: 2px solid #e2e8f0; border-radius: 12px; font-size: 16px; background: #f1f5f9; color: #64748b; font-weight: 600;">
                        </div>

                        <div class="form-group" style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--cash-text); font-size: 14px;">Modal Awal Baru (Rp) *</label>
                            <input type="number" id="newModalAwal" placeholder="0" value="${currentModal}" 
                                   style="width: 100%; padding: 14px 16px; border: 2px solid #e2e8f0; border-radius: 12px; font-size: 16px; outline: none; transition: all 0.2s; font-weight: 600;"
                                   onfocus="this.style.borderColor='#f59e0b'" onblur="this.style.borderColor='#e2e8f0'">
                        </div>

                        <div class="form-group" style="margin-bottom: 20px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--cash-text); font-size: 14px;">Keterangan (opsional)</label>
                            <input type="text" id="modalNote" placeholder="Contoh: Modal hari Senin" 
                                   style="width: 100%; padding: 14px 16px; border: 2px solid #e2e8f0; border-radius: 12px; font-size: 14px; outline: none;">
                        </div>
                    </div>

                    <div class="modal-footer" style="padding: 20px 24px; border-top: 1px solid #e2e8f0; background: #f8fafc;">
                        <button class="btn btn-secondary" onclick="cashModule.closeModal('modalAwalModal')" style="padding: 12px 24px; border-radius: 10px; font-weight: 600;">Batal</button>
                        <button class="btn btn-primary" onclick="cashModule.saveModalAwal()" 
                                style="padding: 12px 24px; border-radius: 10px; font-weight: 700; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border: none; color: white;">
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
        if (!currentUser || (currentUser.role !== 'owner' && currentUser.role !== 'admin')) {
            app.showToast('❌ Hanya Owner dan Admin yang dapat mengatur modal!');
            return;
        }

        const userShift = dataManager.getUserShift(currentUser.userId);
        
        const oldModal = userShift ? (userShift.modalAwal || 0) : 0;
        const diff = newModal - oldModal;

        if (userShift) {
            userShift.modalAwal = newModal;
            
            const totalModal = newModal + (userShift.extraModal || 0);
            const newCash = dataManager.calculateShiftCash(currentUser.userId, totalModal);
            userShift.currentCash = newCash;
            dataManager.updateUserShift(currentUser.userId, userShift);
        } else {
            dataManager.openKasir(currentUser.userId, newModal);
        }

        if (diff > 0) {
            this.saveTransaction('modal_in', diff, 'modal_tambahan', note || `Penambahan modal ${currentUser.role}`);
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
        
        if (currentUser && currentUser.role === 'owner') {
            const globalCash = this.calculateGlobalCash();
            currentCash = globalCash.cash;
            modalAwal = globalCash.modal;
        } else if (userShift) {
            const totalModal = (userShift.modalAwal || 0) + (userShift.extraModal || 0);
            currentCash = dataManager.calculateShiftCash(currentUser.userId, totalModal);
            modalAwal = totalModal;
        }

        const modalHTML = `
            <div class="modal active" id="resetOptionsModal" style="display: flex; z-index: 2000;">
                <div class="modal-content" style="max-width: 480px; border-radius: 20px;">
                    <div class="modal-header" style="border-bottom: 1px solid #e2e8f0; padding: 20px 24px;">
                        <span class="modal-title" style="font-size: 18px; font-weight: 700;">⚙️ Pengaturan Shift & Kas</span>
                        <button class="close-btn" onclick="cashModule.closeModal('resetOptionsModal')" style="color: #64748b; font-size: 28px;">×</button>
                    </div>

                    <div style="padding: 24px;">
                        <div style="background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); border-radius: 16px; padding: 20px; margin-bottom: 24px;">
                            <div style="font-size: 14px; color: #1e40af; margin-bottom: 12px; font-weight: 600;">
                                📊 Status Saat Ini ${currentUser && currentUser.role === 'owner' ? '(Global)' : '(Shift Anda)'}
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                                <div style="background: white; padding: 16px; border-radius: 12px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                                    <div style="font-size: 12px; color: #64748b; margin-bottom: 6px; font-weight: 600;">Kas di Tangan</div>
                                    <div style="font-size: 22px; font-weight: 800; color: var(--cash-text);">Rp ${utils.formatNumber(currentCash)}</div>
                                </div>
                                <div style="background: white; padding: 16px; border-radius: 12px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                                    <div style="font-size: 12px; color: #64748b; margin-bottom: 6px; font-weight: 600;">Modal Awal</div>
                                    <div style="font-size: 22px; font-weight: 800; color: var(--cash-text);">Rp ${utils.formatNumber(modalAwal)}</div>
                                </div>
                            </div>
                        </div>

                        <div style="display: grid; gap: 12px;">
                            <button onclick="cashModule.saveDayClosing()" 
                                    style="padding: 20px; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; border: none; border-radius: 16px; cursor: pointer; text-align: left; transition: all 0.2s;"
                                    onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                                <div style="font-weight: 800; font-size: 16px; margin-bottom: 6px; display: flex; align-items: center; gap: 8px;">
                                    <span>📋</span> Tutup Shift Hari Ini
                                </div>
                                <div style="font-size: 13px; opacity: 0.9;">Simpan laporan penutupan dan tutup kasir untuk shift ini</div>
                            </button>

                            <button onclick="cashModule.setNewModal()" 
                                    style="padding: 20px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none; border-radius: 16px; cursor: pointer; text-align: left; transition: all 0.2s;"
                                    onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                                <div style="font-weight: 800; font-size: 16px; margin-bottom: 6px; display: flex; align-items: center; gap: 8px;">
                                    <span>💰</span> Atur Modal Awal Baru
                                </div>
                                <div style="font-size: 13px; opacity: 0.9;">Set ulang modal awal untuk shift baru</div>
                            </button>

                            ${currentUser && currentUser.role === 'owner' ? `
                            <button onclick="cashModule.carryOverCash()" 
                                    style="padding: 20px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; border: none; border-radius: 16px; cursor: pointer; text-align: left; transition: all 0.2s;"
                                    onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                                <div style="font-weight: 800; font-size: 16px; margin-bottom: 6px; display: flex; align-items: center; gap: 8px;">
                                    <span>🔄</span> Carry Over Kas
                                </div>
                                <div style="font-size: 13px; opacity: 0.9;">Lanjutkan kas ke hari berikutnya (tanpa reset)</div>
                            </button>
                            ` : ''}

                            <button onclick="cashModule.resetToZero()" 
                                    style="padding: 20px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; border: none; border-radius: 16px; cursor: pointer; text-align: left; transition: all 0.2s;"
                                    onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                                <div style="font-weight: 800; font-size: 16px; margin-bottom: 6px; display: flex; align-items: center; gap: 8px;">
                                    <span>🗑️</span> Reset Kas ke 0
                                </div>
                                <div style="font-size: 13px; opacity: 0.9;">HAPUS SEMUA kas dan mulai dari nol (hati-hati!)</div>
                            </button>
                        </div>
                    </div>

                    <div class="modal-footer" style="padding: 20px 24px; border-top: 1px solid #e2e8f0; background: #f8fafc;">
                        <button class="btn btn-secondary" onclick="cashModule.closeModal('resetOptionsModal')" style="padding: 12px 24px; border-radius: 10px; font-weight: 600;">Batal</button>
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
        
        if (currentUser && currentUser.role === 'owner') {
            const globalCash = this.calculateGlobalCash();
            currentCash = globalCash.cash;
            modalAwal = globalCash.modal;
        } else if (userShift) {
            const totalModal = (userShift.modalAwal || 0) + (userShift.extraModal || 0);
            currentCash = dataManager.calculateShiftCash(currentUser.userId, totalModal);
            modalAwal = totalModal;
        }

        const today = new Date();
        const todayStr = today.toDateString();

        const todayStats = this.calculatePeriodStats(
            new Date(today.getFullYear(), today.getMonth(), today.getDate()),
            new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59)
        );

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

        dataManager.data.settings.currentCash = 0;
        dataManager.data.settings.modalAwal = 0;

        if (userShift) {
            userShift.currentCash = 0;
            userShift.modalAwal = 0;
            userShift.extraModal = 0;
            userShift.transactionCount = 0;
            userShift.totalSales = 0;
            dataManager.updateUserShift(currentUser.userId, userShift);
        }

        if (currentUser) {
            dataManager.closeKasir(currentUser.userId);
        }

        dataManager.save();

        this.closeModal('resetOptionsModal');
        app.showToast('✅ Shift ditutup dan laporan disimpan!');
        
        if (typeof app !== 'undefined' && app.showKasirClosedPage) {
            app.showKasirClosedPage();
        }
    },

    resetToZero() {
        if (!confirm('⚠️ PERINGATAN!\\n\\nSemua kas akan dihapus dan diatur ke 0.\\nTindakan ini tidak dapat dibatalkan.\\n\\nLanjutkan?')) {
            return;
        }

        const confirmation = prompt('Ketik \"RESET\" untuk konfirmasi:');
        if (confirmation !== 'RESET') {
            app.showToast('❌ Reset dibatalkan');
            return;
        }

        const currentUser = dataManager.getCurrentUser();
        const userShift = currentUser ? dataManager.getUserShift(currentUser.userId) : null;

        dataManager.data.settings.currentCash = 0;
        dataManager.data.settings.modalAwal = 0;

        if (userShift) {
            userShift.currentCash = 0;
            userShift.modalAwal = 0;
            userShift.extraModal = 0;
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
        if (!confirm('Carry over akan mempertahankan kas saat ini untuk shift berikutnya.\\n\\nLanjutkan?')) {
            return;
        }

        const currentUser = dataManager.getCurrentUser();
        
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
            userId: currentUser ? currentUser.userId : null
        };

        dataManager.data.cashTransactions.push(transaction);
        
        if (type === 'in' || type === 'modal_in' || type === 'topup') {
            dataManager.data.settings.currentCash = (parseInt(dataManager.data.settings.currentCash) || 0) + parseInt(amount);
            
            if (currentUser) {
                const userShift = dataManager.getUserShift(currentUser.userId);
                if (userShift) {
                    userShift.currentCash = (userShift.currentCash || 0) + parseInt(amount);
                    dataManager.updateUserShift(currentUser.userId, userShift);
                }
            }
        } else if (type === 'out') {
            dataManager.data.settings.currentCash = (parseInt(dataManager.data.settings.currentCash) || 0) - parseInt(amount);
            
            if (currentUser) {
                const userShift = dataManager.getUserShift(currentUser.userId);
                if (userShift) {
                    userShift.currentCash = (userShift.currentCash || 0) - parseInt(amount);
                    dataManager.updateUserShift(currentUser.userId, userShift);
                }
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

// Expose ke window
window.cashModule = cashModule;

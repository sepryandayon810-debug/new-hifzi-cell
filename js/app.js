// Router System - DENGAN PROTEKSI KASIR TUTUP
const router = {
    currentPage: null,

    // Daftar menu yang BISA diakses saat kasir tutup
    allowedWhenClosed: ['backup'],

    navigate(page, element) {
        // Cek status kasir
        const isKasirOpen = app.data && app.data.kasir && app.data.kasir.isOpen;

        // Jika kasir tutup dan menu tidak diizinkan, blok akses
        if (!isKasirOpen && !this.allowedWhenClosed.includes(page)) {
            // Tampilkan modal peringatan
            this.showKasirClosedModal();
            return;
        }

        // Update nav tabs
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        if (element) element.classList.add('active');

        // Hide cart bar by default
        document.getElementById('cartBar').style.display = 'none';

        // Load specific module
        this.currentPage = page;

        switch(page) {
            case 'pos':
                posModule.init();
                document.getElementById('cartBar').style.display = 'flex';
                break;
            case 'products':
                productsModule.init();
                break;
            case 'cash':
                cashModule.init();
                break;
            case 'reports':
                reportsModule.init();
                break;
            case 'transactions':
                transactionsModule.init();
                break;
            case 'receipt':
                receiptModule.init();
                break;
            case 'backup':
                backupModule.init();
                break;
            case 'debt':
                debtModule.init();
                break;
        }

        window.scrollTo(0, 0);
    },

    // Modal peringatan kasir tutup
    showKasirClosedModal() {
        const modalHTML = `
            <div class="modal active" id="kasirClosedModal" style="display: flex; z-index: 3000;">
                <div class="modal-content" style="max-width: 400px; text-align: center;">
                    <div style="font-size: 64px; margin-bottom: 20px;">🔒</div>
                    <div class="modal-header" style="justify-content: center; margin-bottom: 15px;">
                        <span class="modal-title" style="font-size: 20px;">Kasir Sedang Tutup</span>
                    </div>

                    <div style="background: #ffebee; border: 2px solid #f44336; border-radius: 12px; padding: 15px; margin-bottom: 20px;">
                        <div style="color: #c62828; font-weight: 600; margin-bottom: 8px;">
                            ⚠️ Akses Ditolak
                        </div>
                        <div style="font-size: 14px; color: #666; line-height: 1.5;">
                            Menu ini tidak dapat diakses saat kasir tutup. 
                            Silakan buka kasir terlebih dahulu melalui menu Pengaturan.
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <button class="btn btn-secondary" onclick="router.closeKasirClosedModal()">
                            Tutup
                        </button>
                        <button class="btn btn-primary" onclick="router.closeKasirClosedModal(); app.openSettings();" style="background: #4caf50;">
                            🔓 Buka Kasir
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Hapus modal lama jika ada
        const existingModal = document.getElementById('kasirClosedModal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    closeKasirClosedModal() {
        const modal = document.getElementById('kasirClosedModal');
        if (modal) modal.remove();
    }
};

// Global App
const app = {
    data: null,

    init() {
        dataManager.load();
        this.data = dataManager.data;
        this.updateHeader();
        this.updateKasirStatus();

        // Load default page berdasarkan status kasir
        const isKasirOpen = this.data && this.data.kasir && this.data.kasir.isOpen;

        if (isKasirOpen) {
            // Kasir buka - load POS seperti biasa
            const defaultTab = document.querySelector('.nav-tab');
            if (defaultTab) defaultTab.classList.add('active');
            posModule.init();
            document.getElementById('cartBar').style.display = 'flex';
        } else {
            // Kasir tutup - tampilkan halaman khusus
            this.showKasirClosedPage();
            // Tidak ada tab yang aktif
            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        }
    },

    // Tampilkan halaman kasir tutup
    showKasirClosedPage() {
        const container = document.getElementById('mainContent');
        if (!container) return;

        container.innerHTML = `
            <div class="content-section active" style="text-align: center; padding: 40px 20px;">
                <div style="font-size: 80px; margin-bottom: 20px;">🔒</div>
                <h2 style="color: #c62828; margin-bottom: 15px;">Kasir Sedang Tutup</h2>
                <p style="color: #666; margin-bottom: 30px; line-height: 1.6;">
                    Sistem kasir saat ini dalam status TUTUP.<br>
                    Anda tidak dapat melakukan transaksi atau mengakses menu lain.<br>
                    Silakan buka kasir untuk memulai shift kerja.
                </p>

                <div style="background: #e8f5e9; border: 2px solid #4caf50; border-radius: 16px; padding: 25px; max-width: 400px; margin: 0 auto;">
                    <div style="font-size: 14px; color: #666; margin-bottom: 15px;">
                        💡 Menu yang tersedia saat kasir tutup:
                    </div>
                    <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                        <div style="background: white; padding: 10px 15px; border-radius: 8px; font-size: 13px;">
                            ⚙️ Pengaturan
                        </div>
                        <div style="background: white; padding: 10px 15px; border-radius: 8px; font-size: 13px;">
                            ☁️ Backup
                        </div>
                    </div>
                </div>

                <button onclick="app.openSettings()" 
                        style="margin-top: 30px; padding: 15px 40px; font-size: 16px; 
                               background: linear-gradient(135deg, #4caf50 0%, #2e7d32 100%);
                               color: white; border: none; border-radius: 12px;
                               cursor: pointer; font-weight: 600;
                               box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);">
                    🔓 Buka Kasir Sekarang
                </button>
            </div>
        `;
    },

    updateHeader() {
        document.getElementById('headerStoreName').textContent = this.data.settings.storeName;
        document.getElementById('headerStoreAddress').textContent = this.data.settings.address || 'Alamat Belum Diatur';
        document.getElementById('currentCash').textContent = 'Rp ' + utils.formatNumber(this.data.settings.currentCash);
        document.getElementById('modalAwal').textContent = 'Rp ' + utils.formatNumber(this.data.settings.modalAwal);

        // Update profit
        const todayProfit = this.calculateTodayProfit();
        document.getElementById('headerProfit').textContent = 'Rp ' + utils.formatNumber(todayProfit);
    },

    calculateTodayProfit() {
        const today = new Date().toDateString();
        return this.data.transactions
            .filter(t => new Date(t.date).toDateString() === today && t.status !== 'deleted' && t.status !== 'voided')
            .reduce((sum, t) => sum + t.profit, 0);
    },

    updateKasirStatus() {
        const isOpen = this.data.kasir && this.data.kasir.isOpen;

        // Update dot indicator
        const dot = document.getElementById('kasirStatusDot');
        const text = document.getElementById('kasirStatusText');
        const shiftStatus = document.getElementById('shiftStatus');
        const indicator = document.getElementById('kasirStatusIndicator');

        if (isOpen) {
            dot.style.background = '#00b894';
            text.textContent = '🔓 Kasir Buka';
            shiftStatus.textContent = 'Aktif';
            indicator.className = 'kasir-indicator open';
        } else {
            dot.style.background = '#ff4757';
            text.textContent = '🔒 Kasir Tutup';
            shiftStatus.textContent = 'Tutup';
            indicator.className = 'kasir-indicator closed';
        }
    },

    // SETTINGS & KASIR MANAGEMENT - FIXED
    openSettings() {
        const isOpen = this.data.kasir && this.data.kasir.isOpen;

        const modalHTML = `
            <div class="modal active" id="settingsModal" style="display: flex; z-index: 2000;">
                <div class="modal-content" style="max-width: 450px; max-height: 90vh; overflow-y: auto;">
                    <div class="modal-header">
                        <span class="modal-title">⚙️ Pengaturan & Manajemen Kasir</span>
                        <button class="close-btn" onclick="app.closeSettings()">×</button>
                    </div>

                    <!-- Kasir Status Section -->
                    <div class="card" style="margin-bottom: 20px; background: ${isOpen ? '#e8f5e9' : '#ffebee'}; border: 2px solid ${isOpen ? 'var(--success)' : 'var(--danger)'};">
                        <div class="card-header" style="margin-bottom: 15px;">
                            <span class="card-title" style="font-size: 18px;">
                                ${isOpen ? '🔓 KASIR SEDANG BUKA' : '🔒 KASIR SEDANG TUTUP'}
                            </span>
                        </div>

                        <div style="text-align: center; padding: 20px;">
                            <div style="font-size: 48px; margin-bottom: 10px;">
                                ${isOpen ? '🔓' : '🔒'}
                            </div>
                            <div style="font-weight: 700; font-size: 16px; margin-bottom: 5px;">
                                ${isOpen ? 'Siap melayani transaksi' : 'Silakan buka kasir untuk memulai'}
                            </div>
                            ${isOpen ? `
                                <div style="font-size: 13px; color: #666;">
                                    Buka sejak: ${new Date(this.data.kasir.openTime).toLocaleString('id-ID')}
                                </div>
                            ` : ''}
                        </div>

                        <div class="kasir-actions" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 15px;">
                            <button class="kasir-btn open" onclick="app.openKasir()" ${isOpen ? 'disabled style="opacity: 0.5;"' : ''}>
                                <span style="font-size: 28px;">🔓</span>
                                <span>Buka Kasir</span>
                                <small style="font-size: 10px; opacity: 0.8;">Reset modal & kas</small>
                            </button>
                            <button class="kasir-btn close" onclick="app.closeKasir()" ${!isOpen ? 'disabled style="opacity: 0.5;"' : ''}>
                                <span style="font-size: 28px;">🔒</span>
                                <span>Tutup Kasir</span>
                                <small style="font-size: 10px; opacity: 0.8;">Akhiri shift</small>
                            </button>
                        </div>

                        <div class="info-box warning" style="margin-bottom: 0; margin-top: 15px;">
                            <div class="info-title">💡 Info Penting</div>
                            <div class="info-text">
                                • Buka Kasir = Reset modal & kas ke 0 untuk hari baru<br>
                                • Tutup Kasir = Akhiri shift & simpan laporan<br>
                                • Data transaksi tetap tersimpan permanen
                            </div>
                        </div>
                    </div>

                    <!-- Store Settings -->
                    <div style="background: white; border-radius: 16px; padding: 20px; margin-bottom: 15px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                        <div class="card-header" style="margin-bottom: 15px;">
                            <span class="card-title">🏪 Pengaturan Toko</span>
                        </div>

                        <div class="form-group">
                            <label>Nama Toko *</label>
                            <input type="text" id="settingStoreName" value="${this.data.settings.storeName}">
                        </div>

                        <div class="form-group">
                            <label>Alamat Toko *</label>
                            <textarea id="settingStoreAddress" rows="2">${this.data.settings.address || ''}</textarea>
                        </div>

                        <div class="form-group">
                            <label>Nomor HP / WhatsApp</label>
                            <input type="text" id="settingPhone" value="${this.data.settings.receiptHeader?.phone || ''}" 
                                   placeholder="0812-3456-7890">
                        </div>

                        <div class="form-group">
                            <label>Pajak Default (%)</label>
                            <input type="number" id="settingTax" value="${this.data.settings.taxRate || 0}" placeholder="0">
                        </div>
                    </div>

                    <!-- Receipt Settings -->
                    <div style="background: white; border-radius: 16px; padding: 20px; margin-bottom: 15px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                        <div class="card-header" style="margin-bottom: 15px;">
                            <span class="card-title">🧾 Header Struk</span>
                        </div>

                        <div class="form-group">
                            <label>Catatan Footer Struk</label>
                            <textarea id="settingReceiptNote" rows="2" placeholder="Terima kasih...">${this.data.settings.receiptHeader?.note || 'Terima kasih atas kunjungan Anda'}</textarea>
                        </div>
                    </div>

                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="app.closeSettings()">Tutup</button>
                        <button class="btn btn-primary" onclick="app.saveSettings()">💾 Simpan Semua Pengaturan</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    closeSettings() {
        const modal = document.getElementById('settingsModal');
        if (modal) modal.remove();
    },

    openKasir() {
        if (!confirm('🔓 BUKA KASIR UNTUK HARI INI?\n\nTindakan ini akan:\n• Reset Modal Awal ke 0\n• Reset Kas di Tangan ke 0\n• Mulai shift baru\n\nLanjutkan?')) {
            return;
        }

        const today = new Date().toDateString();

        // Reset for new day
        this.data.settings.currentCash = 0;
        this.data.settings.modalAwal = 0;

        // Set kasir open
        this.data.kasir = {
            isOpen: true,
            openTime: new Date().toISOString(),
            closeTime: null,
            date: today
        };

        dataManager.save();
        this.updateHeader();
        this.updateKasirStatus();
        this.closeSettings();
        app.showToast('✅ Kasir dibuka! Selamat bekerja 💪');

        // Refresh ke halaman POS
        posModule.init();
        document.getElementById('cartBar').style.display = 'flex';

        // Update nav tab aktif ke POS
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        const posTab = document.querySelector('.nav-tab[onclick*=\'pos\']');
        if (posTab) posTab.classList.add('active');
    },

    closeKasir() {
        if (!confirm('🔒 TUTUP KASIR?\n\nTindakan ini akan:\n• Mengakhiri shift saat ini\n• Menyimpan laporan shift\n• Mencegah transaksi baru\n\nPastikan semua transaksi sudah terekam!\n\nLanjutkan?')) {
            return;
        }

        this.data.kasir.isOpen = false;
        this.data.kasir.closeTime = new Date().toISOString();

        // Save shift summary
        const today = new Date().toDateString();
        const todayTrans = this.data.transactions.filter(t => 
            new Date(t.date).toDateString() === today && t.status !== 'voided'
        );

        const shiftSummary = {
            date: today,
            openTime: this.data.kasir.openTime,
            closeTime: this.data.kasir.closeTime,
            totalSales: todayTrans.reduce((sum, t) => sum + t.total, 0),
            totalProfit: todayTrans.reduce((sum, t) => sum + t.profit, 0),
            transactionCount: todayTrans.length,
            modalAwal: this.data.settings.modalAwal,
            cashEnd: this.data.settings.currentCash
        };

        if (!this.data.shiftHistory) this.data.shiftHistory = [];
        this.data.shiftHistory.push(shiftSummary);

        dataManager.save();
        this.updateHeader();
        this.updateKasirStatus();
        this.closeSettings();
        app.showToast('🔒 Kasir ditutup! Shift berakhir. 🏠');

        // Tampilkan halaman kasir tutup
        this.showKasirClosedPage();

        // Update nav tab - tidak ada yang aktif
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    },

    saveSettings() {
        const storeName = document.getElementById('settingStoreName').value.trim();
        const address = document.getElementById('settingStoreAddress').value.trim();
        const phone = document.getElementById('settingPhone').value.trim();
        const tax = parseInt(document.getElementById('settingTax').value) || 0;
        const note = document.getElementById('settingReceiptNote').value.trim();

        if (!storeName || !address) {
            app.showToast('❌ Nama dan alamat toko wajib diisi!');
            return;
        }

        this.data.settings.storeName = storeName;
        this.data.settings.address = address;
        this.data.settings.taxRate = tax;

        if (!this.data.settings.receiptHeader) {
            this.data.settings.receiptHeader = {};
        }
        this.data.settings.receiptHeader.storeName = storeName;
        this.data.settings.receiptHeader.address = address;
        this.data.settings.receiptHeader.phone = phone;
        this.data.settings.receiptHeader.note = note;

        dataManager.save();
        this.updateHeader();
        this.closeSettings();
        app.showToast('✅ Pengaturan disimpan!');
    },

    showToast(message) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    },

    setLoading(show) {
        document.getElementById('loadingOverlay').classList.toggle('active', show);
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});

// Close modal on outside click
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
        setTimeout(() => e.target.remove(), 300);
    }
});

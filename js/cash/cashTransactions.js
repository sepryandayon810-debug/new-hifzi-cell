// ============================================
// cashTransactions.js - Kas Masuk/Keluar Manual
// ============================================

import { cashConfig } from './cashConfig.js';
import { cashUtils } from './cashUtils.js';
import { cashUI } from './cashUI.js';
import { cashModal } from './cashModal.js';

export const cashTransactions = {
    showKasMasukDialog() {
        const modalCheck = cashModal.checkModalAwal();
        if (!modalCheck.exists) { cashUI.showToast('Harap atur modal awal terlebih dahulu', 'error'); return Promise.resolve({ success: false }); }
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `<div class="modal-content"><div class="modal-header"><h3><i class="fas fa-plus-circle"></i> Kas Masuk</h3><button class="btn-close" id="closeKasMasuk"><i class="fas fa-times"></i></button></div><div class="modal-body"><div class="form-group"><label>Jumlah (Rp) *</label><input type="number" id="inputKasMasukAmount" class="form-control input-currency" placeholder="0" min="0" step="1000"><div class="quick-amounts"><button class="quick-btn" data-amount="10000">10rb</button><button class="quick-btn" data-amount="20000">20rb</button><button class="quick-btn" data-amount="50000">50rb</button><button class="quick-btn" data-amount="100000">100rb</button></div></div><div class="form-group"><label>Keterangan</label><input type="text" id="inputKasMasukDesc" class="form-control" placeholder="Contoh: Pendapatan lain, dll"></div></div><div class="modal-footer"><button class="btn-secondary" id="btnCancelKasMasuk">Batal</button><button class="btn-primary" id="btnSaveKasMasuk"><i class="fas fa-save"></i> Simpan</button></div></div>`;
            document.body.appendChild(modal);
            setTimeout(() => document.getElementById('inputKasMasukAmount').focus(), 100);
            modal.querySelectorAll('.quick-btn').forEach(btn => {
                btn.addEventListener('click', () => { document.getElementById('inputKasMasukAmount').value = btn.dataset.amount; });
            });
            const closeModal = () => { modal.remove(); resolve({ success: false }); };
            document.getElementById('closeKasMasuk').addEventListener('click', closeModal);
            document.getElementById('btnCancelKasMasuk').addEventListener('click', closeModal);
            document.getElementById('btnSaveKasMasuk').addEventListener('click', () => {
                const amount = parseFloat(document.getElementById('inputKasMasukAmount').value) || 0;
                const description = document.getElementById('inputKasMasukDesc').value.trim();
                if (amount <= 0) { cashUI.showToast('Jumlah harus lebih dari 0', 'error'); return; }
                const result = this.addKasMasuk(amount, description);
                modal.remove();
                resolve(result);
            });
        });
    },

    showKasKeluarDialog() {
        const modalCheck = cashModal.checkModalAwal();
        if (!modalCheck.exists) { cashUI.showToast('Harap atur modal awal terlebih dahulu', 'error'); return Promise.resolve({ success: false }); }
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `<div class="modal-content"><div class="modal-header"><h3><i class="fas fa-minus-circle"></i> Kas Keluar</h3><button class="btn-close" id="closeKasKeluar"><i class="fas fa-times"></i></button></div><div class="modal-body"><div class="form-group"><label>Jumlah (Rp) *</label><input type="number" id="inputKasKeluarAmount" class="form-control input-currency" placeholder="0" min="0" step="1000"><div class="quick-amounts"><button class="quick-btn" data-amount="10000">10rb</button><button class="quick-btn" data-amount="20000">20rb</button><button class="quick-btn" data-amount="50000">50rb</button><button class="quick-btn" data-amount="100000">100rb</button></div></div><div class="form-group"><label>Keterangan *</label><input type="text" id="inputKasKeluarDesc" class="form-control" placeholder="Contoh: Beli alat tulis, bayar listrik, dll"></div></div><div class="modal-footer"><button class="btn-secondary" id="btnCancelKasKeluar">Batal</button><button class="btn-primary btn-danger" id="btnSaveKasKeluar"><i class="fas fa-save"></i> Simpan</button></div></div>`;
            document.body.appendChild(modal);
            setTimeout(() => document.getElementById('inputKasKeluarAmount').focus(), 100);
            modal.querySelectorAll('.quick-btn').forEach(btn => {
                btn.addEventListener('click', () => { document.getElementById('inputKasKeluarAmount').value = btn.dataset.amount; });
            });
            const closeModal = () => { modal.remove(); resolve({ success: false }); };
            document.getElementById('closeKasKeluar').addEventListener('click', closeModal);
            document.getElementById('btnCancelKasKeluar').addEventListener('click', closeModal);
            document.getElementById('btnSaveKasKeluar').addEventListener('click', () => {
                const amount = parseFloat(document.getElementById('inputKasKeluarAmount').value) || 0;
                const description = document.getElementById('inputKasKeluarDesc').value.trim();
                if (amount <= 0) { cashUI.showToast('Jumlah harus lebih dari 0', 'error'); return; }
                if (!description) { cashUI.showToast('Keterangan wajib diisi untuk kas keluar', 'error'); return; }
                const currentBalance = this.getCurrentBalance();
                if (amount > currentBalance) { cashUI.showToast('Saldo tidak mencukupi', 'error'); return; }
                const result = this.addKasKeluar(amount, description);
                modal.remove();
                resolve(result);
            });
        });
    },

    addKasMasuk(amount, description = '') {
        const data = cashConfig.getData();
        const currentBalance = this.getCurrentBalance();
        const transaction = {
            id: cashUtils.generateId(), type: 'kas-masuk', typeLabel: 'Kas Masuk', amount: amount,
            description: description || 'Kas masuk manual', timestamp: new Date().toISOString(),
            date: cashUtils.getTodayDate(), balance: currentBalance + amount,
            operator: cashConfig.getCurrentUser(), canDelete: true
        };
        data.transactions.push(transaction);
        cashConfig.saveData(data);
        cashUI.showToast(`Kas masuk ${cashUtils.formatCurrency(amount)} berhasil disimpan`, 'success');
        return { success: true, transaction };
    },

    addKasKeluar(amount, description) {
        const data = cashConfig.getData();
        const currentBalance = this.getCurrentBalance();
        const transaction = {
            id: cashUtils.generateId(), type: 'kas-keluar', typeLabel: 'Kas Keluar', amount: -amount,
            description: description, timestamp: new Date().toISOString(),
            date: cashUtils.getTodayDate(), balance: currentBalance - amount,
            operator: cashConfig.getCurrentUser(), canDelete: true
        };
        data.transactions.push(transaction);
        cashConfig.saveData(data);
        cashUI.showToast(`Kas keluar ${cashUtils.formatCurrency(amount)} berhasil disimpan`, 'success');
        return { success: true, transaction };
    },

    getCurrentBalance() {
        const data = cashConfig.getData();
        const today = cashUtils.getTodayDate();
        const todayTransactions = data.transactions.filter(t => t.date === today && !t.isDeleted && !t.isClosed);
        if (todayTransactions.length === 0) return 0;
        todayTransactions.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        return todayTransactions[todayTransactions.length - 1].balance;
    },

    deleteTransaction(transactionId) {
        const data = cashConfig.getData();
        const transaction = data.transactions.find(t => t.id === transactionId);
        if (!transaction) return { success: false, message: 'Transaksi tidak ditemukan' };
        if (!transaction.canDelete) return { success: false, message: 'Transaksi ini tidak dapat dihapus' };
        transaction.isDeleted = true;
        transaction.deletedAt = new Date().toISOString();
        transaction.deletedBy = cashConfig.getCurrentUser();
        cashConfig.saveData(data);
        this.recalculateBalances(transaction.date);
        return { success: true, message: 'Transaksi berhasil dihapus' };
    },

    recalculateBalances(date) {
        const data = cashConfig.getData();
        const transactions = data.transactions.filter(t => t.date === date && !t.isDeleted).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        let balance = 0;
        transactions.forEach((t, index) => {
            if (index === 0 && t.type === 'modal') balance = t.amount;
            else balance += t.amount;
            t.balance = balance;
        });
        cashConfig.saveData(data);
    }
};

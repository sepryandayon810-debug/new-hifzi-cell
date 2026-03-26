// ============================================
// cashTopupTarik.js - Top Up & Tarik Tunai
// ============================================

import { cashConfig } from './cashConfig.js';
import { cashUtils } from './cashUtils.js';
import { cashUI } from './cashUI.js';
import { cashModal } from './cashModal.js';

export const cashTopupTarik = {
    showTopupDialog() {
        const modalCheck = cashModal.checkModalAwal();
        if (!modalCheck.exists) { cashUI.showToast('Harap atur modal awal terlebih dahulu', 'error'); return Promise.resolve({ success: false }); }
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `<div class="modal-content"><div class="modal-header"><h3><i class="fas fa-arrow-up"></i> Top Up Kasir</h3><button class="btn-close" id="closeTopup"><i class="fas fa-times"></i></button></div><div class="modal-body"><div class="info-box"><i class="fas fa-info-circle"></i><span>Top up digunakan untuk menambah uang kasir dari modal/sumber lain.</span></div><div class="form-group"><label>Jumlah Top Up (Rp) *</label><input type="number" id="inputTopupAmount" class="form-control input-currency" placeholder="0" min="0" step="1000"><div class="quick-amounts"><button class="quick-btn" data-amount="50000">50rb</button><button class="quick-btn" data-amount="100000">100rb</button><button class="quick-btn" data-amount="200000">200rb</button><button class="quick-btn" data-amount="500000">500rb</button></div></div><div class="form-group"><label>Sumber Dana</label><select id="selectTopupSource" class="form-control"><option value="modal">Modal Awal</option><option value="bank">Rekening Bank</option><option value="lainnya">Sumber Lain</option></select></div><div class="form-group"><label>Keterangan</label><input type="text" id="inputTopupDesc" class="form-control" placeholder="Contoh: Tambahan modal dari owner"></div></div><div class="modal-footer"><button class="btn-secondary" id="btnCancelTopup">Batal</button><button class="btn-primary" id="btnSaveTopup"><i class="fas fa-save"></i> Simpan Top Up</button></div></div>`;
            document.body.appendChild(modal);
            setTimeout(() => document.getElementById('inputTopupAmount').focus(), 100);
            modal.querySelectorAll('.quick-btn').forEach(btn => {
                btn.addEventListener('click', () => { document.getElementById('inputTopupAmount').value = btn.dataset.amount; });
            });
            const closeModal = () => { modal.remove(); resolve({ success: false }); };
            document.getElementById('closeTopup').addEventListener('click', closeModal);
            document.getElementById('btnCancelTopup').addEventListener('click', closeModal);
            document.getElementById('btnSaveTopup').addEventListener('click', () => {
                const amount = parseFloat(document.getElementById('inputTopupAmount').value) || 0;
                const source = document.getElementById('selectTopupSource').value;
                const description = document.getElementById('inputTopupDesc').value.trim();
                if (amount <= 0) { cashUI.showToast('Jumlah harus lebih dari 0', 'error'); return; }
                const result = this.addTopup(amount, source, description);
                modal.remove();
                resolve(result);
            });
        });
    },

    showTarikDialog() {
        const modalCheck = cashModal.checkModalAwal();
        if (!modalCheck.exists) { cashUI.showToast('Harap atur modal awal terlebih dahulu', 'error'); return Promise.resolve({ success: false }); }
        const currentBalance = this.getCurrentBalance();
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `<div class="modal-content"><div class="modal-header"><h3><i class="fas fa-arrow-down"></i> Tarik Tunai</h3><button class="btn-close" id="closeTarik"><i class="fas fa-times"></i></button></div><div class="modal-body"><div class="info-box warning"><i class="fas fa-exclamation-triangle"></i><span>Tarik tunai akan mengurangi saldo kasir. Saldo saat ini: <strong>${cashUtils.formatCurrency(currentBalance)}</strong></span></div><div class="form-group"><label>Jumlah Tarik (Rp) *</label><input type="number" id="inputTarikAmount" class="form-control input-currency" placeholder="0" min="0" step="1000" max="${currentBalance}"><div class="quick-amounts"><button class="quick-btn" data-amount="50000">50rb</button><button class="quick-btn" data-amount="100000">100rb</button><button class="quick-btn" data-amount="200000">200rb</button><button class="quick-btn" data-all="true">Semua</button></div></div><div class="form-group"><label>Tujuan Penarikan</label><select id="selectTarikDest" class="form-control"><option value="bank">Rekening Bank</option><option value="modal">Kembalikan ke Modal</option><option value="owner">Owner</option><option value="lainnya">Lainnya</option></select></div><div class="form-group"><label>Keterangan *</label><input type="text" id="inputTarikDesc" class="form-control" placeholder="Contoh: Setor ke bank, pengembalian modal, dll"></div></div><div class="modal-footer"><button class="btn-secondary" id="btnCancelTarik">Batal</button><button class="btn-primary btn-danger" id="btnSaveTarik"><i class="fas fa-save"></i> Tarik Tunai</button></div></div>`;
            document.body.appendChild(modal);
            setTimeout(() => document.getElementById('inputTarikAmount').focus(), 100);
            modal.querySelectorAll('.quick-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (btn.dataset.all === 'true') document.getElementById('inputTarikAmount').value = currentBalance;
                    else document.getElementById('inputTarikAmount').value = btn.dataset.amount;
                });
            });
            const closeModal = () => { modal.remove(); resolve({ success: false }); };
            document.getElementById('closeTarik').addEventListener('click', closeModal);
            document.getElementById('btnCancelTarik').addEventListener('click', closeModal);
            document.getElementById('btnSaveTarik').addEventListener('click', () => {
                const amount = parseFloat(document.getElementById('inputTarikAmount').value) || 0;
                const destination = document.getElementById('selectTarikDest').value;
                const description = document.getElementById('inputTarikDesc').value.trim();
                if (amount <= 0) { cashUI.showToast('Jumlah harus lebih dari 0', 'error'); return; }
                if (amount > currentBalance) { cashUI.showToast('Jumlah melebihi saldo tersedia', 'error'); return; }
                if (!description) { cashUI.showToast('Keterangan wajib diisi', 'error'); return; }
                const result = this.addTarik(amount, destination, description);
                modal.remove();
                resolve(result);
            });
        });
    },

    addTopup(amount, source = 'modal', description = '') {
        const data = cashConfig.getData();
        const currentBalance = this.getCurrentBalance();
        const transaction = {
            id: cashUtils.generateId(), type: 'topup', typeLabel: 'Top Up', amount: amount,
            description: description || `Top up dari ${source}`, source: source,
            timestamp: new Date().toISOString(), date: cashUtils.getTodayDate(),
            balance: currentBalance + amount, operator: cashConfig.getCurrentUser(), canDelete: true
        };
        data.transactions.push(transaction);
        cashConfig.saveData(data);
        cashUI.showToast(`Top up ${cashUtils.formatCurrency(amount)} berhasil`, 'success');
        return { success: true, transaction };
    },

    addTarik(amount, destination = 'bank', description) {
        const data = cashConfig.getData();
        const currentBalance = this.getCurrentBalance();
        const transaction = {
            id: cashUtils.generateId(), type: 'tarik', typeLabel: 'Tarik Tunai', amount: -amount,
            description: description, destination: destination,
            timestamp: new Date().toISOString(), date: cashUtils.getTodayDate(),
            balance: currentBalance - amount, operator: cashConfig.getCurrentUser(), canDelete: true
        };
        data.transactions.push(transaction);
        cashConfig.saveData(data);
        cashUI.showToast(`Tarik tunai ${cashUtils.formatCurrency(amount)} berhasil`, 'success');
        return { success: true, transaction };
    },

    getCurrentBalance() {
        const data = cashConfig.getData();
        const today = cashUtils.getTodayDate();
        const todayTransactions = data.transactions.filter(t => t.date === today && !t.isDeleted && !t.isClosed);
        if (todayTransactions.length === 0) return 0;
        todayTransactions.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        return todayTransactions[todayTransactions.length - 1].balance;
    }
};

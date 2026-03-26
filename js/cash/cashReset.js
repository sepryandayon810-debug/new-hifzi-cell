// ============================================
// cashReset.js - Reset & Shift Management
// ============================================

import { cashConfig } from './cashConfig.js';
import { cashUtils } from './cashUtils.js';
import { cashUI } from './cashUI.js';

export const cashReset = {
    showResetDialog() {
        return new Promise((resolve) => {
            if (!cashConfig.isOwner()) {
                cashUI.showToast('Hanya owner yang dapat melakukan reset shift', 'error');
                return resolve({ success: false });
            }
            const data = cashConfig.getData();
            const today = cashUtils.getTodayDate();
            const todayTransactions = data.transactions.filter(t => t.date === today && !t.isDeleted);
            if (todayTransactions.length === 0) {
                cashUI.showToast('Tidak ada transaksi untuk direset', 'info');
                return resolve({ success: false });
            }
            const currentBalance = todayTransactions.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))[todayTransactions.length - 1].balance;
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `<div class="modal-content"><div class="modal-header"><h3><i class="fas fa-redo"></i> Reset Shift</h3><button class="btn-close" id="closeReset"><i class="fas fa-s times"></i></button></div><div class="modal-body"><div class="warning-box"><i class="fas fa-exclamation-triangle"></i><p><strong>Perhatian!</strong> Reset shift akan menutup semua transaksi hari ini dan memulai shift baru. Data yang sudah ditutup tidak dapat diubah.</p></div><div class="summary-box"><h4>Ringkasan Shift Saat Ini:</h4><p>Total Transaksi: <strong>${todayTransactions.length}</strong></p><p>Saldo Akhir: <strong>${cashUtils.formatCurrency(currentBalance)}</strong></p></div><div class="form-group"><label>Modal Awal Shift Baru (Rp)</label><input type="number" id="inputNewModal" class="form-control input-currency" placeholder="0" min="0" step="1000"></div></div><div class="modal-footer"><button class="btn-secondary" id="btnCancelReset">Batal</button><button class="btn-primary btn-danger" id="btnConfirmReset"><i class="fas fa-redo"></i> Reset & Mulai Shift Baru</button></div></div>`;
            document.body.appendChild(modal);
            setTimeout(() => document.getElementById('inputNewModal').focus(), 100);
            const closeModal = () => { modal.remove(); resolve({ success: false }); };
            document.getElementById('closeReset').addEventListener('click', closeModal);
            document.getElementById('btnCancelReset').addEventListener('click', closeModal);
            document.getElementById('btnConfirmReset').addEventListener('click', () => {
                const newModal = parseFloat(document.getElementById('inputNewModal').value) || 0;
                const result = this.resetShift(newModal);
                modal.remove();
                resolve(result);
            });
        });
    },

    resetShift(newModalAmount = 0) {
        const data = cashConfig.getData();
        const today = cashUtils.getTodayDate();
        data.transactions.filter(t => t.date === today && !t.isDeleted).forEach(t => { t.isClosed = true; });
        if (newModalAmount > 0) {
            const newShiftTransaction = {
                id: cashUtils.generateId(), type: 'modal', typeLabel: 'Modal Awal', amount: newModalAmount,
                description: 'Modal awal shift baru (setelah reset)', timestamp: new Date().toISOString(),
                date: today, balance: newModalAmount, operator: cashConfig.getCurrentUser(),
                isClosed: false, canDelete: false
            };
            data.transactions.push(newShiftTransaction);
            data.currentShift = { date: today, modalId: newShiftTransaction.id, startTime: newShiftTransaction.timestamp, modalAmount: newModalAmount };
        } else {
            data.currentShift = null;
        }
        cashConfig.saveData(data);
        cashUI.showToast('Shift berhasil direset' + (newModalAmount > 0 ? ' dan shift baru dimulai' : ''), 'success');
        return { success: true };
    },

    closeShift() {
        const data = cashConfig.getData();
        const today = cashUtils.getTodayDate();
        data.transactions.filter(t => t.date === today && !t.isDeleted).forEach(t => { t.isClosed = true; });
        data.currentShift = null;
        cashConfig.saveData(data);
        cashUI.showToast('Shift berhasil ditutup', 'success');
        return { success: true };
    }
};

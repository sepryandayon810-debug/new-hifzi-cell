// ============================================
// cashModal.js - Modal Awal & Pengaturan Modal
// ============================================

import { cashConfig } from './cashConfig.js';
import { cashUtils } from './cashUtils.js';
import { cashUI } from './cashUI.js';

export const cashModal = {
    checkModalAwal() {
        const today = cashUtils.getTodayDate();
        const data = cashConfig.getData();
        const modalEntry = data.transactions.find(t => t.type === 'modal' && t.date === today && !t.isClosed);
        return { exists: !!modalEntry, amount: modalEntry ? modalEntry.amount : 0, transactionId: modalEntry ? modalEntry.id : null };
    },

    showModalAwalDialog() {
        const modalCheck = this.checkModalAwal();
        if (modalCheck.exists) {
            cashUI.showToast('Modal awal sudah diatur untuk shift ini', 'info');
            return Promise.resolve({ success: true, amount: modalCheck.amount });
        }
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.id = 'modalAwalDialog';
            modal.innerHTML = `<div class="modal-content"><div class="modal-header"><h3><i class="fas fa-play-circle"></i> Modal Awal Shift</h3><button class="btn-close" id="closeModalAwal"><i class="fas fa-times"></i></button></div><div class="modal-body"><p class="modal-desc">Masukkan modal awal untuk memulai shift hari ini.</p><div class="form-group"><label>Modal Awal (Rp)</label><input type="number" id="inputModalAwal" class="form-control input-currency" placeholder="0" min="0" step="1000"><div class="quick-amounts"><button class="quick-btn" data-amount="50000">50rb</button><button class="quick-btn" data-amount="100000">100rb</button><button class="quick-btn" data-amount="200000">200rb</button><button class="quick-btn" data-amount="500000">500rb</button></div></div></div><div class="modal-footer"><button class="btn-secondary" id="btnCancelModal">Batal</button><button class="btn-primary" id="btnSaveModalAwal"><i class="fas fa-save"></i> Simpan & Mulai Shift</button></div></div>`;
            document.body.appendChild(modal);
            setTimeout(() => document.getElementById('inputModalAwal').focus(), 100);
            const input = document.getElementById('inputModalAwal');
            modal.querySelectorAll('.quick-btn').forEach(btn => {
                btn.addEventListener('click', () => { input.value = btn.dataset.amount; input.focus(); });
            });
            const closeModal = () => { modal.remove(); resolve({ success: false, cancelled: true }); };
            document.getElementById('closeModalAwal').addEventListener('click', closeModal);
            document.getElementById('btnCancelModal').addEventListener('click', closeModal);
            document.getElementById('btnSaveModalAwal').addEventListener('click', () => {
                const amount = parseFloat(input.value) || 0;
                if (amount < 0) { cashUI.showToast('Modal tidak boleh negatif', 'error'); return; }
                const result = this.saveModalAwal(amount);
                modal.remove();
                resolve({ success: true, amount: amount, transactionId: result.id });
            });
            input.addEventListener('keypress', (e) => { if (e.key === 'Enter') document.getElementById('btnSaveModalAwal').click(); });
        });
    },

    saveModalAwal(amount) {
        const data = cashConfig.getData();
        const today = cashUtils.getTodayDate();
        const transaction = {
            id: cashUtils.generateId(), type: 'modal', typeLabel: 'Modal Awal', amount: amount,
            description: 'Modal awal shift', timestamp: new Date().toISOString(), date: today,
            balance: amount, operator: cashConfig.getCurrentUser(), isClosed: false, canDelete: false
        };
        data.transactions.push(transaction);
        data.currentShift = { date: today, modalId: transaction.id, startTime: transaction.timestamp, modalAmount: amount };
        cashConfig.saveData(data);
        cashUI.showToast('Modal awal berhasil disimpan', 'success');
        cashUI.updateStatus('modal', 'Active', 'success');
        return transaction;
    },

    showEditModalDialog() {
        const modalCheck = this.checkModalAwal();
        const data = cashConfig.getData();
        const today = cashUtils.getTodayDate();
        const otherTransactions = data.transactions.filter(t => t.date === today && t.type !== 'modal' && !t.isDeleted);
        if (otherTransactions.length > 0) {
            cashUI.showToast('Tidak dapat edit modal - sudah ada transaksi lain', 'error');
            return Promise.resolve({ success: false });
        }
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `<div class="modal-content"><div class="modal-header"><h3><i class="fas fa-edit"></i> Edit Modal Awal</h3><button class="btn-close" id="closeEditModal"><i class="fas fa-times"></i></button></div><div class="modal-body"><div class="form-group"><label>Modal Awal (Rp)</label><input type="number" id="inputEditModal" class="form-control input-currency" value="${modalCheck.amount}" min="0" step="1000"></div></div><div class="modal-footer"><button class="btn-secondary" id="btnCancelEdit">Batal</button><button class="btn-primary" id="btnSaveEditModal"><i class="fas fa-save"></i> Update Modal</button></div></div>`;
            document.body.appendChild(modal);
            const closeModal = () => { modal.remove(); resolve({ success: false }); };
            document.getElementById('closeEditModal').addEventListener('click', closeModal);
            document.getElementById('btnCancelEdit').addEventListener('click', closeModal);
            document.getElementById('btnSaveEditModal').addEventListener('click', () => {
                const newAmount = parseFloat(document.getElementById('inputEditModal').value) || 0;
                const transaction = data.transactions.find(t => t.id === modalCheck.transactionId);
                if (transaction) {
                    transaction.amount = newAmount; transaction.balance = newAmount;
                    cashConfig.saveData(data);
                    cashUI.showToast('Modal berhasil diupdate', 'success');
                    modal.remove();
                    resolve({ success: true, newAmount: newAmount });
                }
            });
        });
    },

    getCurrentModal() {
        const data = cashConfig.getData();
        const today = cashUtils.getTodayDate();
        return data.transactions.find(t => t.type === 'modal' && t.date === today && !t.isClosed) || null;
    },

    getModalAmount() {
        const modal = this.getCurrentModal();
        return modal ? modal.amount : 0;
    }
};

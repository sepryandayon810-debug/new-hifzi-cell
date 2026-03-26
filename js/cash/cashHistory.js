// ============================================
// cashHistory.js - Riwayat Transaksi
// ============================================

import { cashConfig } from './cashConfig.js';
import { cashUtils } from './cashUtils.js';
import { cashUI } from './cashUI.js';
import { cashTransactions } from './cashTransactions.js';

export const cashHistory = {
    currentPage: 1,
    itemsPerPage: 10,
    currentTransactions: [],

    render(transactions) {
        this.currentTransactions = transactions;
        const tbody = document.getElementById('tbodyCashHistory');
        if (!tbody) return;
        if (transactions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">Tidak ada data transaksi</td></tr>';
            cashUI.renderPagination(1, 1, null);
            return;
        }
        const totalPages = Math.ceil(transactions.length / this.itemsPerPage);
        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = start + this.itemsPerPage;
        const pageTransactions = transactions.slice(start, end);
        tbody.innerHTML = pageTransactions.map((t, index) => cashUI.renderTransactionRow(t, start + index)).join('');
        cashUI.renderPagination(this.currentPage, totalPages, (page) => this.goToPage(page));
        this.bindRowEvents();
    },

    goToPage(page) {
        this.currentPage = page;
        this.render(this.currentTransactions);
    },

    bindRowEvents() {
        const tbody = document.getElementById('tbodyCashHistory');
        if (!tbody) return;
        tbody.querySelectorAll('.btn-view').forEach(btn => {
            btn.addEventListener('click', () => this.showTransactionDetail(btn.dataset.id));
        });
        tbody.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', () => this.confirmDelete(btn.dataset.id));
        });
    },

    showTransactionDetail(transactionId) {
        const data = cashConfig.getData();
        const transaction = data.transactions.find(t => t.id === transactionId);
        if (!transaction) return;
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `<div class="modal-content"><div class="modal-header"><h3><i class="fas fa-eye"></i> Detail Transaksi</h3><button class="btn-close" id="closeDetail"><i class="fas fa-times"></i></button></div><div class="modal-body"><div class="detail-row"><label>ID:</label><span>${transaction.id}</span></div><div class="detail-row"><label>Tipe:</label><span>${transaction.typeLabel}</span></div><div class="detail-row"><label>Tanggal:</label><span>${cashUtils.formatDateTime(transaction.timestamp)}</span></div><div class="detail-row"><label>Jumlah:</label><span class="${transaction.amount >= 0 ? 'text-income' : 'text-expense'}">${transaction.amount >= 0 ? '+' : ''}${cashUtils.formatCurrency(transaction.amount)}</span></div><div class="detail-row"><label>Saldo:</label><span>${cashUtils.formatCurrency(transaction.balance)}</span></div><div class="detail-row"><label>Keterangan:</label><span>${transaction.description || '-'}</span></div><div class="detail-row"><label>Operator:</label><span>${transaction.operator || '-'}</span></div>${transaction.source ? `<div class="detail-row"><label>Sumber:</label><span>${transaction.source}</span></div>` : ''}${transaction.destination ? `<div class="detail-row"><label>Tujuan:</label><span>${transaction.destination}</span></div>` : ''}</div><div class="modal-footer"><button class="btn-secondary" id="btnCloseDetail">Tutup</button></div></div>`;
        document.body.appendChild(modal);
        document.getElementById('closeDetail').addEventListener('click', () => modal.remove());
        document.getElementById('btnCloseDetail').addEventListener('click', () => modal.remove());
    },

    confirmDelete(transactionId) {
        const data = cashConfig.getData();
        const transaction = data.transactions.find(t => t.id === transactionId);
        if (!transaction) return;
        cashUI.confirm(`Yakin ingin menghapus transaksi ${transaction.typeLabel} ${cashUtils.formatCurrency(Math.abs(transaction.amount))}?`, () => {
            const result = cashTransactions.deleteTransaction(transactionId);
            if (result.success) {
                cashUI.showToast(result.message, 'success');
                this.render(data.transactions.filter(t => !t.isDeleted).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
            } else {
                cashUI.showToast(result.message, 'error');
            }
        });
    }
};

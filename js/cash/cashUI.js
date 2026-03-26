// ============================================
// cashUI.js - Render HTML & DOM Manipulation
// ============================================

import { cashConfig } from './cashConfig.js';
import { cashUtils } from './cashUtils.js';

export const cashUI = {
    render() {
        return `
        <div class="cash-module">
            <div class="cash-header">
                <h2><i class="fas fa-cash-register"></i> Manajemen Kasir</h2>
                <div class="cash-status">
                    <span id="shiftStatus" class="badge">Shift: -</span>
                    <span id="modalStatus" class="badge">Modal: -</span>
                </div>
            </div>
            <div class="cash-info-grid">
                <div class="info-card" id="cardModal">
                    <div class="info-icon"><i class="fas fa-wallet"></i></div>
                    <div class="info-content">
                        <span class="info-label">Modal Awal</span>
                        <span class="info-value" id="displayModal">Rp 0</span>
                    </div>
                </div>
                <div class="info-card" id="cardCash">
                    <div class="info-icon"><i class="fas fa-money-bill-wave"></i></div>
                    <div class="info-content">
                        <span class="info-label">Kas Fisik</span>
                        <span class="info-value" id="displayCash">Rp 0</span>
                    </div>
                </div>
                <div class="info-card" id="cardSales">
                    <div class="info-icon"><i class="fas fa-chart-line"></i></div>
                    <div class="info-content">
                        <span class="info-label">Total Penjualan</span>
                        <span class="info-value" id="displaySales">Rp 0</span>
                    </div>
                </div>
                <div class="info-card" id="cardDifference">
                    <div class="info-icon"><i class="fas fa-balance-scale"></i></div>
                    <div class="info-content">
                        <span class="info-label">Selisih</span>
                        <span class="info-value" id="displayDifference">Rp 0</span>
                    </div>
                </div>
            </div>
            <div class="cash-filter-section">
                <div class="filter-row">
                    <div class="filter-group">
                        <label>Periode:</label>
                        <select id="filterPeriod">
                            <option value="today">Hari Ini</option>
                            <option value="week">Minggu Ini</option>
                            <option value="month">Bulan Ini</option>
                            <option value="custom">Custom</option>
                        </select>
                    </div>
                    <div class="filter-group custom-date" style="display:none;">
                        <label>Dari:</label>
                        <input type="date" id="filterStart">
                    </div>
                    <div class="filter-group custom-date" style="display:none;">
                        <label>Sampai:</label>
                        <input type="date" id="filterEnd">
                    </div>
                    <button id="btnApplyFilter" class="btn-primary"><i class="fas fa-filter"></i> Terapkan</button>
                    <button id="btnExport" class="btn-secondary"><i class="fas fa-download"></i> Export</button>
                </div>
            </div>
            <div class="cash-actions">
                <button id="btnModalSetting" class="btn-action btn-modal"><i class="fas fa-cog"></i> Pengaturan Modal</button>
                <button id="btnKasMasuk" class="btn-action btn-income"><i class="fas fa-plus-circle"></i> Kas Masuk</button>
                <button id="btnKasKeluar" class="btn-action btn-expense"><i class="fas fa-minus-circle"></i> Kas Keluar</button>
                <button id="btnTopup" class="btn-action btn-topup"><i class="fas fa-arrow-up"></i> Top Up</button>
                <button id="btnTarik" class="btn-action btn-withdraw"><i class="fas fa-arrow-down"></i> Tarik Tunai</button>
                <button id="btnReset" class="btn-action btn-reset"><i class="fas fa-redo"></i> Reset Shift</button>
            </div>
            <div class="cash-history-section">
                <h3><i class="fas fa-history"></i> Riwayat Transaksi</h3>
                <div class="table-responsive">
                    <table id="tableCashHistory" class="data-table">
                        <thead>
                            <tr><th>Waktu</th><th>Tipe</th><th>Keterangan</th><th>Nominal</th><th>Saldo</th><th>Operator</th><th>Aksi</th></tr>
                        </thead>
                        <tbody id="tbodyCashHistory"><tr><td colspan="7" class="text-center">Tidak ada data</td></tr></tbody>
                    </table>
                </div>
                <div id="paginationCash" class="pagination"></div>
            </div>
        </div>`;
    },

    updateDisplay(elementId, value, isCurrency = true) {
        const el = document.getElementById(elementId);
        if (el) el.textContent = isCurrency ? cashUtils.formatCurrency(value) : value;
    },

    updateStatus(type, text, status = 'normal') {
        const el = document.getElementById(type === 'shift' ? 'shiftStatus' : 'modalStatus');
        if (el) {
            el.textContent = text;
            el.className = `badge badge-${status}`;
        }
    },

    toggleCustomDate(show) {
        document.querySelectorAll('.custom-date').forEach(el => {
            el.style.display = show ? 'block' : 'none';
        });
    },

    renderTransactionRow(transaction, index) {
        const typeClass = this.getTypeClass(transaction.type);
        const typeIcon = this.getTypeIcon(transaction.type);
        return `<tr data-id="${transaction.id}" data-index="${index}">
            <td>${cashUtils.formatDateTime(transaction.timestamp)}</td>
            <td><span class="badge ${typeClass}"><i class="fas ${typeIcon}"></i> ${transaction.typeLabel}</span></td>
            <td>${transaction.description || '-'}</td>
            <td class="${transaction.amount >= 0 ? 'text-income' : 'text-expense'}">
                ${transaction.amount >= 0 ? '+' : ''}${cashUtils.formatCurrency(transaction.amount)}
            </td>
            <td>${cashUtils.formatCurrency(transaction.balance)}</td>
            <td>${transaction.operator || '-'}</td>
            <td>
                <button class="btn-icon btn-view" data-id="${transaction.id}" title="Detail"><i class="fas fa-eye"></i></button>
                ${transaction.canDelete ? `<button class="btn-icon btn-delete" data-id="${transaction.id}" title="Hapus"><i class="fas fa-trash"></i></button>` : ''}
            </td>
        </tr>`;
    },

    getTypeClass(type) {
        const classes = {
            'modal': 'badge-modal', 'kas-masuk': 'badge-income', 'kas-keluar': 'badge-expense',
            'topup': 'badge-topup', 'tarik': 'badge-withdraw', 'penjualan': 'badge-sales', 'reset': 'badge-reset'
        };
        return classes[type] || 'badge-default';
    },

    getTypeIcon(type) {
        const icons = {
            'modal': 'fa-play-circle', 'kas-masuk': 'fa-plus-circle', 'kas-keluar': 'fa-minus-circle',
            'topup': 'fa-arrow-up', 'tarik': 'fa-arrow-down', 'penjualan': 'fa-shopping-cart', 'reset': 'fa-redo'
        };
        return icons[type] || 'fa-circle';
    },

    renderPagination(currentPage, totalPages, callback) {
        const container = document.getElementById('paginationCash');
        if (!container || totalPages <= 1) {
            if (container) container.innerHTML = '';
            return;
        }
        let html = `<button class="page-btn ${currentPage === 1 ? 'disabled' : ''}" data-page="${currentPage - 1}"><i class="fas fa-chevron-left"></i></button>`;
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
                html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
            } else if (i === currentPage - 2 || i === currentPage + 2) {
                html += `<span class="page-ellipsis">...</span>`;
            }
        }
        html += `<button class="page-btn ${currentPage === totalPages ? 'disabled' : ''}" data-page="${currentPage + 1}"><i class="fas fa-chevron-right"></i></button>`;
        container.innerHTML = html;
        container.querySelectorAll('.page-btn:not(.disabled)').forEach(btn => {
            btn.addEventListener('click', () => {
                const page = parseInt(btn.dataset.page);
                if (callback) callback(page);
            });
        });
    },

    showToast(message, type = 'success') {
        document.querySelectorAll('.toast').forEach(t => t.remove());
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i><span>${message}</span>`;
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    confirm(message, onConfirm, onCancel) {
        const modal = document.createElement('div');
        modal.className = 'confirm-modal';
        modal.innerHTML = `<div class="confirm-content"><i class="fas fa-question-circle"></i><p>${message}</p><div class="confirm-actions"><button class="btn-cancel">Batal</button><button class="btn-confirm">Ya, Lanjutkan</button></div></div>`;
        document.body.appendChild(modal);
        modal.querySelector('.btn-confirm').addEventListener('click', () => { modal.remove(); if (onConfirm) onConfirm(); });
        modal.querySelector('.btn-cancel').addEventListener('click', () => { modal.remove(); if (onCancel) onCancel(); });
    }
};

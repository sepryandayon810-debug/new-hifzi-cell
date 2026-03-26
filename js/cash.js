// ============================================
// cash.js - Entry Point (Loader)
// Router tetap mengarah ke file ini
// ============================================

import { cashConfig } from './cash/cashConfig.js';
import { cashUtils } from './cash/cashUtils.js';
import { cashUI } from './cash/cashUI.js';
import { cashModal } from './cash/cashModal.js';
import { cashTransactions } from './cash/cashTransactions.js';
import { cashTopupTarik } from './cash/cashTopupTarik.js';
import { cashFilter } from './cash/cashFilter.js';
import { cashHistory } from './cash/cashHistory.js';
import { cashReset } from './cash/cashReset.js';

const cashModule = {
    async init() {
        console.log('[Cash] Initializing...');
        const container = document.getElementById('module-container');
        if (container) container.innerHTML = cashUI.render();
        this.setupEventListeners();
        await this.loadData();
        const modalCheck = cashModal.checkModalAwal();
        if (!modalCheck.exists) await cashModal.showModalAwalDialog();
        console.log('[Cash] Initialized successfully');
    },

    setupEventListeners() {
        document.getElementById('filterPeriod')?.addEventListener('change', (e) => {
            cashUI.toggleCustomDate(e.target.value === 'custom');
        });
        document.getElementById('btnApplyFilter')?.addEventListener('click', () => this.applyFilter());
        document.getElementById('btnExport')?.addEventListener('click', () => {
            const data = cashFilter.getFilteredData();
            cashFilter.exportToCSV(data.transactions);
        });
        document.getElementById('btnModalSetting')?.addEventListener('click', () => {
            cashModal.showEditModalDialog().then(() => this.loadData());
        });
        document.getElementById('btnKasMasuk')?.addEventListener('click', () => {
            cashTransactions.showKasMasukDialog().then(() => this.loadData());
        });
        document.getElementById('btnKasKeluar')?.addEventListener('click', () => {
            cashTransactions.showKasKeluarDialog().then(() => this.loadData());
        });
        document.getElementById('btnTopup')?.addEventListener('click', () => {
            cashTopupTarik.showTopupDialog().then(() => this.loadData());
        });
        document.getElementById('btnTarik')?.addEventListener('click', () => {
            cashTopupTarik.showTarikDialog().then(() => this.loadData());
        });
        document.getElementById('btnReset')?.addEventListener('click', () => {
            cashReset.showResetDialog().then(() => this.loadData());
        });
    },

    applyFilter() {
        const period = document.getElementById('filterPeriod').value;
        let startDate = null, endDate = null;
        if (period === 'custom') {
            startDate = document.getElementById('filterStart').value;
            endDate = document.getElementById('filterEnd').value;
        }
        cashFilter.setFilter(period, startDate, endDate);
        this.loadData();
    },

    async loadData() {
        const data = cashFilter.getFilteredData();
        cashUI.updateDisplay('displayModal', data.statistics.totalModal);
        cashUI.updateDisplay('displayCash', data.statistics.finalBalance);
        cashUI.updateDisplay('displaySales', data.statistics.totalPenjualan);
        cashUI.updateDisplay('displayDifference', data.statistics.finalBalance - data.statistics.totalModal);
        const modalCheck = cashModal.checkModalAwal();
        cashUI.updateStatus('modal', modalCheck.exists ? 'Active' : 'Not Set', modalCheck.exists ? 'success' : 'warning');
        cashHistory.render(data.transactions);
    },

    getCurrentBalance() {
        return cashTransactions.getCurrentBalance();
    },

    addTransaction(type, amount, description, metadata = {}) {
        switch(type) {
            case 'kas-masuk': return cashTransactions.addKasMasuk(amount, description);
            case 'kas-keluar': return cashTransactions.addKasKeluar(amount, description);
            case 'topup': return cashTopupTarik.addTopup(amount, metadata.source, description);
            case 'tarik': return cashTopupTarik.addTarik(amount, metadata.destination, description);
            default: return { success: false, message: 'Unknown transaction type' };
        }
    }
};

window.cashModule = cashModule;
export default cashModule;

// ============================================
// cashFilter.js - Filter & Statistik Periode
// ============================================

import { cashConfig } from './cashConfig.js';
import { cashUtils } from './cashUtils.js';

export const cashFilter = {
    currentFilter: { period: 'today', startDate: null, endDate: null },

    setFilter(period, startDate = null, endDate = null) {
        this.currentFilter = { period, startDate, endDate };
        return this.getFilteredData();
    },

    getFilteredData() {
        const data = cashConfig.getData();
        const { period, startDate, endDate } = this.currentFilter;
        let filteredTransactions = [];
        switch (period) {
            case 'today': filteredTransactions = this.getTodayTransactions(data); break;
            case 'week': filteredTransactions = this.getWeekTransactions(data); break;
            case 'month': filteredTransactions = this.getMonthTransactions(data); break;
            case 'custom': filteredTransactions = this.getCustomRangeTransactions(data, startDate, endDate); break;
            default: filteredTransactions = this.getTodayTransactions(data);
        }
        return { transactions: filteredTransactions, statistics: this.calculateStatistics(filteredTransactions), summary: this.generateSummary(filteredTransactions) };
    },

    getTodayTransactions(data) {
        const today = cashUtils.getTodayDate();
        return data.transactions.filter(t => t.date === today && !t.isDeleted).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    },

    getWeekTransactions(data) {
        const now = new Date();
        const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay()); startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek); endOfWeek.setDate(startOfWeek.getDate() + 6); endOfWeek.setHours(23, 59, 59, 999);
        return data.transactions.filter(t => { const tDate = new Date(t.timestamp); return tDate >= startOfWeek && tDate <= endOfWeek && !t.isDeleted; }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    },

    getMonthTransactions(data) {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        return data.transactions.filter(t => { const tDate = new Date(t.timestamp); return tDate >= startOfMonth && tDate <= endOfMonth && !t.isDeleted; }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    },

    getCustomRangeTransactions(data, startDate, endDate) {
        if (!startDate || !endDate) return [];
        const start = new Date(startDate); start.setHours(0, 0, 0, 0);
        const end = new Date(endDate); end.setHours(23, 59, 59, 999);
        return data.transactions.filter(t => { const tDate = new Date(t.timestamp); return tDate >= start && tDate <= end && !t.isDeleted; }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    },

    calculateStatistics(transactions) {
        const stats = { totalModal: 0, totalKasMasuk: 0, totalKasKeluar: 0, totalTopup: 0, totalTarik: 0, totalPenjualan: 0, totalTransactions: transactions.length, finalBalance: 0 };
        transactions.forEach(t => {
            switch (t.type) {
                case 'modal': stats.totalModal += t.amount; break;
                case 'kas-masuk': stats.totalKasMasuk += t.amount; break;
                case 'kas-keluar': stats.totalKasKeluar += Math.abs(t.amount); break;
                case 'topup': stats.totalTopup += t.amount; break;
                case 'tarik': stats.totalTarik += Math.abs(t.amount); break;
                case 'penjualan': stats.totalPenjualan += t.amount; break;
            }
        });
        if (transactions.length > 0) stats.finalBalance = transactions[0].balance;
        return stats;
    },

    generateSummary(transactions) {
        const stats = this.calculateStatistics(transactions);
        return { periodLabel: this.getPeriodLabel(), totalIn: stats.totalModal + stats.totalKasMasuk + stats.totalTopup + stats.totalPenjualan, totalOut: stats.totalKasKeluar + stats.totalTarik, netFlow: (stats.totalModal + stats.totalKasMasuk + stats.totalTopup + stats.totalPenjualan) - (stats.totalKasKeluar + stats.totalTarik) };
    },

    getPeriodLabel() {
        const { period, startDate, endDate } = this.currentFilter;
        switch (period) {
            case 'today': return 'Hari Ini';
            case 'week': return 'Minggu Ini';
            case 'month': return 'Bulan Ini';
            case 'custom': return `${cashUtils.formatDate(startDate)} - ${cashUtils.formatDate(endDate)}`;
            default: return 'Periode';
        }
    },

    exportToCSV(transactions, filename = 'cash-report') {
        if (transactions.length === 0) return { success: false, message: 'Tidak ada data untuk diexport' };
        const headers = ['Tanggal', 'Waktu', 'Tipe', 'Keterangan', 'Jumlah', 'Saldo', 'Operator'];
        const rows = transactions.map(t => [t.date, cashUtils.formatDateTime(t.timestamp), t.typeLabel, t.description || '-', t.amount, t.balance, t.operator || '-']);
        const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${filename}-${cashUtils.getTodayDate()}.csv`;
        link.click();
        return { success: true, message: 'Data berhasil diexport' };
    }
};

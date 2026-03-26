/**
 * ============================================
 * HIFZI CELL - USER MODULE (Orchestrator)
 * ============================================
 * Menggabungkan UserService, LoginHistoryService, dan UserUI
 * Expose ke window untuk akses dari HTML
 */

import { getUserService } from '../services/UserService.js';
import { getLoginHistoryService } from '../services/LoginHistoryService.js';
import { getUserUI } from '../ui/UserUI.js';
import { getToastManager } from '../ui/index.js';

class UserModule {
    constructor() {
        this.userService = getUserService();
        this.loginHistoryService = getLoginHistoryService();
        this.ui = getUserUI();
        this.toastManager = getToastManager();
        
        // Expose ke window untuk akses dari HTML onclick
        window.userModule = this;
    }

    /**
     * Initialize module
     */
    init() {
        try {
            console.log('[UserModule] Initializing...');
            this.render();
            console.log('[UserModule] Initialized successfully');
        } catch (error) {
            console.error('[UserModule] Error initializing:', error);
            this.toastManager.error('Error memuat modul pengguna');
        }
    }

    /**
     * Render main page
     */
    render() {
        const currentUser = this.userService.getCurrentUser();
        const permissions = this.userService.getPermissions(currentUser);
        
        const mainContent = document.getElementById('mainContent') || document.getElementById('moduleContent');
        if (!mainContent) {
            throw new Error('mainContent/moduleContent element not found');
        }

        mainContent.innerHTML = this.ui.renderUsersPage(currentUser, permissions);
    }

    /**
     * Refresh users table
     */
    refreshUsersTable() {
        const currentUser = this.userService.getCurrentUser();
        const permissions = this.userService.getPermissions(currentUser);
        const users = this.userService.getAllUsers();
        
        const tbody = document.getElementById('usersTableBody');
        if (tbody) {
            tbody.innerHTML = this.ui.renderUsersTable(users, currentUser, permissions);
        }
    }

    // ==================== USER CRUD ====================

    /**
     * Show add user modal
     */
    showAddUserModal() {
        const currentUser = this.userService.getCurrentUser();
        const canCreateOwner = currentUser?.role === 'owner';
        
        const modalHTML = this.ui.renderAddUserModal(canCreateOwner);
        this.removeExistingModal('addUserModal');
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    /**
     * Show edit user modal
     */
    showEditUserModal(userId) {
        const user = this.userService.getUserById(userId);
        if (!user) {
            this.toastManager.error('User tidak ditemukan!');
            return;
        }

        const currentUser = this.userService.getCurrentUser();
        const canEditRole = currentUser?.role === 'owner';
        const isEditingSelf = currentUser?.userId === userId;

        const modalHTML = this.ui.renderEditUserModal(user, canEditRole, isEditingSelf);
        this.removeExistingModal('editUserModal');
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    /**
     * Save new user
     */
    saveNewUser() {
        const name = document.getElementById('newUserName')?.value?.trim();
        const username = document.getElementById('newUserUsername')?.value?.trim();
        const password = document.getElementById('newUserPassword')?.value;
        const role = document.getElementById('newUserRole')?.value;

        const currentUser = this.userService.getCurrentUser();
        
        // Check permission create owner
        if (role === 'owner' && currentUser?.role !== 'owner') {
            this.toastManager.error('Hanya Owner yang dapat membuat user Owner!');
            return;
        }

        const result = this.userService.createUser({ name, username, password, role });

        if (result.success) {
            this.toastManager.success('User berhasil ditambahkan!');
            this.closeModal();
            this.refreshUsersTable();
            
            // Refresh filter options if login history is open
            this.refreshLoginHistoryFilters();
        } else {
            this.toastManager.error(result.error || 'Gagal menambahkan user');
        }
    }

    /**
     * Save edited user
     */
    saveEditUser() {
        const userId = document.getElementById('editUserId')?.value;
        const name = document.getElementById('editUserName')?.value?.trim();
        const username = document.getElementById('editUserUsername')?.value?.trim();
        const password = document.getElementById('editUserPassword')?.value;
        const role = document.getElementById('editUserRole')?.value;

        const currentUser = this.userService.getCurrentUser();
        const targetUser = this.userService.getUserById(userId);

        // Check permission edit owner
        if (targetUser?.role === 'owner' && currentUser?.role !== 'owner') {
            this.toastManager.error('Hanya Owner yang dapat mengedit user Owner!');
            return;
        }

        const result = this.userService.updateUser(userId, { name, username, password, role });

        if (result.success) {
            this.toastManager.success('User berhasil diupdate!');
            this.closeModal();
            this.refreshUsersTable();
            
            // Update header if editing self
            if (userId === currentUser?.userId && window.app?.authService) {
                window.app.authService.updateUserUI();
            }
            
            // Refresh filter options
            this.refreshLoginHistoryFilters();
        } else {
            this.toastManager.error(result.error || 'Gagal mengupdate user');
        }
    }

    /**
     * Delete user
     */
    deleteUser(userId) {
        const targetUser = this.userService.getUserById(userId);
        if (!targetUser) {
            this.toastManager.error('User tidak ditemukan!');
            return;
        }

        if (!confirm(`🗑️ Hapus user "${targetUser.name}"?\n\nTindakan ini tidak dapat dibatalkan.`)) {
            return;
        }

        const result = this.userService.deleteUser(userId);

        if (result.success) {
            this.toastManager.success('User dihapus!');
            this.refreshUsersTable();
            this.refreshLoginHistoryFilters();
        } else {
            this.toastManager.error(result.error || 'Gagal menghapus user');
        }
    }

    // ==================== LOGIN HISTORY ====================

    /**
     * Toggle login history accordion
     */
    toggleLoginHistory() {
        const isExpanded = this.ui.toggleLoginHistoryAccordion();
        
        // Load data first time expand
        if (isExpanded) {
            const tbody = document.getElementById('loginHistoryTableBody');
            if (tbody && tbody.innerHTML.includes('Klik untuk memuat')) {
                this.filterLoginHistory();
            }
        }
    }

    /**
     * Handle period change
     */
    handlePeriodChange() {
        const periodSelect = document.getElementById('loginFilterPeriod');
        const isCustom = periodSelect?.value === 'custom';
        
        this.ui.toggleCustomDateInputs(isCustom);
        
        if (!isCustom) {
            this.filterLoginHistory();
        }
    }

    /**
     * Filter login history
     */
    filterLoginHistory() {
        const period = document.getElementById('loginFilterPeriod')?.value || 'today';
        const userId = document.getElementById('loginFilterUser')?.value || 'all';
        const startDate = document.getElementById('filterStartDate')?.value;
        const endDate = document.getElementById('filterEndDate')?.value;

        const loginHistory = this.loginHistoryService.getLoginHistory({
            period,
            startDate,
            endDate,
            userId: userId === 'all' ? null : userId
        });

        this.ui.updateLoginHistoryUI(loginHistory);
    }

    /**
     * Reset login filter
     */
    resetLoginFilter() {
        const periodSelect = document.getElementById('loginFilterPeriod');
        const userSelect = document.getElementById('loginFilterUser');
        const startDate = document.getElementById('filterStartDate');
        const endDate = document.getElementById('filterEndDate');

        if (periodSelect) periodSelect.value = 'today';
        if (userSelect) userSelect.value = 'all';
        if (startDate) startDate.value = '';
        if (endDate) endDate.value = '';

        this.ui.toggleCustomDateInputs(false);
        this.filterLoginHistory();
    }

    /**
     * Export login history to CSV
     */
    exportLoginHistory() {
        const period = document.getElementById('loginFilterPeriod')?.value || 'today';
        const userId = document.getElementById('loginFilterUser')?.value || 'all';
        const startDate = document.getElementById('filterStartDate')?.value;
        const endDate = document.getElementById('filterEndDate')?.value;

        const loginHistory = this.loginHistoryService.getLoginHistory({
            period,
            startDate,
            endDate,
            userId: userId === 'all' ? null : userId
        });

        const result = this.loginHistoryService.exportToCSV(loginHistory);
        
        if (result.success) {
            result.download();
            this.toastManager.success(`Berhasil download ${loginHistory.length} record!`);
        } else {
            this.toastManager.error(result.error || 'Tidak ada data untuk diexport');
        }
    }

    /**
     * Refresh login history filter options
     */
    refreshLoginHistoryFilters() {
        const currentUser = this.userService.getCurrentUser();
        if (currentUser?.role !== 'owner') return;

        const content = document.getElementById('loginHistoryContent');
        if (!content || content.style.display !== 'block') return;

        // Re-render filter options
        const userSelect = document.getElementById('loginFilterUser');
        if (userSelect) {
            const options = this.loginHistoryService.getUserFilterOptions();
            userSelect.innerHTML = `
                <option value="all">Semua User</option>
                ${options.map(opt => `
                    <option value="${opt.value}">${opt.label}</option>
                `).join('')}
            `;
        }
    }

    // ==================== UTILITIES ====================

    /**
     * Close any open modal
     */
    closeModal() {
        this.removeExistingModal('addUserModal');
        this.removeExistingModal('editUserModal');
    }

    /**
     * Remove existing modal by ID
     */
    removeExistingModal(modalId) {
        const existing = document.getElementById(modalId);
        if (existing) existing.remove();
    }
}

// Create singleton and expose
const userModule = new UserModule();

export default userModule;

/**
 * ============================================
 * HIFZI CELL - USER UI
 * ============================================
 * Rendering HTML dan DOM manipulation untuk user module
 */

import { getUserService } from '../services/UserService.js';
import { getLoginHistoryService } from '../services/LoginHistoryService.js';

export class UserUI {
    constructor() {
        this.userService = getUserService();
        this.loginHistoryService = getLoginHistoryService();
    }

    /**
     * Render main users page
     */
    renderUsersPage(currentUser, permissions) {
        const users = this.userService.getAllUsers();
        
        return `
            <div class="content-section active" id="usersSection">
                <div class="card">
                    <div class="card-header">
                        <span class="card-title">👥 Manajemen Pengguna</span>
                        ${permissions.canCreate ? `
                        <button class="btn btn-primary" onclick="window.userModule.showAddUserModal()">
                            + Tambah User
                        </button>
                        ` : ''}
                    </div>
                    
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Nama</th>
                                    <th>Username</th>
                                    <th>Role</th>
                                    <th>Terakhir Login</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody id="usersTableBody">
                                ${this.renderUsersTable(users, currentUser, permissions)}
                            </tbody>
                        </table>
                    </div>
                    
                    <div class="info-box" style="margin-top: 20px;">
                        <div class="info-title">💡 Informasi Role</div>
                        <div class="info-text">
                            • <strong>Owner:</strong> Pemilik usaha, akses penuh termasuk riwayat login & backup<br>
                            • <strong>Admin:</strong> Dapat mengakses semua menu dan mengelola user (kecuali riwayat login)<br>
                            • <strong>Kasir:</strong> Hanya dapat mengakses POS, Produk, dan Transaksi<br>
                            • <strong>Default login:</strong> owner/owner123, admin/admin123, kasir1/kasir123
                        </div>
                    </div>
                </div>

                ${permissions.canViewLoginHistory ? this.renderLoginHistorySection() : ''}
            </div>
        `;
    }

    /**
     * Render users table rows
     */
    renderUsersTable(users, currentUser, permissions) {
        if (!users || users.length === 0) {
            return `
                <tr>
                    <td colspan="5" style="text-align: center; color: #999; padding: 30px;">
                        Tidak ada data pengguna
                    </td>
                </tr>
            `;
        }

        return users.map(user => {
            const isSelf = user.id === currentUser?.userId;
            const canEditUser = permissions.canEdit && this.userService.canManageRole(currentUser.role, user.role, 'edit');
            const canDeleteUser = permissions.canDelete && 
                !isSelf && 
                !user.isDefault && 
                this.userService.canManageRole(currentUser.role, user.role, 'delete');

            const lastLoginText = this.userService.getLastLoginText(user.id);

            return `
                <tr>
                    <td>
                        ${user.name}
                        ${isSelf ? '<span style="color: #E85D4E; font-size: 12px;">(Anda)</span>' : ''}
                    </td>
                    <td>${user.username}</td>
                    <td>
                        <span class="badge ${this.userService.getRoleBadgeClass(user.role)}">
                            ${user.role}
                        </span>
                    </td>
                    <td style="font-size: 13px; color: #666;">${lastLoginText}</td>
                    <td>
                        <div style="display: flex; gap: 5px;">
                            ${canEditUser ? `
                                <button class="btn btn-primary btn-sm" onclick="window.userModule.showEditUserModal('${user.id}')">
                                    ✏️ Edit
                                </button>
                            ` : '<span style="color: #999; font-size: 12px;">🔒</span>'}
                            
                            ${canDeleteUser ? `
                                <button class="btn btn-danger btn-sm" onclick="window.userModule.deleteUser('${user.id}')">
                                    🗑️ Hapus
                                </button>
                            ` : (isSelf ? '<span style="color: #999; font-size: 12px;">(Anda)</span>' : '')}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    /**
     * Render login history section (accordion)
     */
    renderLoginHistorySection() {
        return `
            <div class="card" style="margin-top: 20px;">
                <div class="card-header" style="cursor: pointer; user-select: none;" 
                     onclick="window.userModule.toggleLoginHistory()">
                    <span class="card-title">📋 Riwayat Login (6 Bulan Terakhir)</span>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span id="loginHistoryBadge" style="
                            background: #6c5ce7; 
                            color: white; 
                            padding: 4px 12px; 
                            border-radius: 12px; 
                            font-size: 12px; 
                            font-weight: 600;
                        ">0 login</span>
                        <span id="loginHistoryArrow" style="
                            font-size: 20px; 
                            transition: transform 0.3s ease; 
                            transform: rotate(-90deg);
                        ">▼</span>
                    </div>
                </div>
                
                <div id="loginHistoryContent" style="display: none; overflow: hidden; transition: all 0.3s ease;">
                    ${this.renderLoginHistoryFilters()}
                    ${this.renderLoginHistoryTable()}
                </div>
            </div>
        `;
    }

    /**
     * Render login history filters
     */
    renderLoginHistoryFilters() {
        const userOptions = this.loginHistoryService.getUserFilterOptions();
        
        return `
            <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; margin: 20px 0;">
                <div style="display: flex; gap: 15px; flex-wrap: wrap; align-items: end;">
                    <div class="form-group" style="margin: 0; flex: 1; min-width: 150px;">
                        <label style="font-size: 12px; color: #666;">Filter Periode</label>
                        <select id="loginFilterPeriod" onchange="window.userModule.handlePeriodChange()" 
                                style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px;">
                            <option value="today">Hari Ini</option>
                            <option value="yesterday">Kemarin</option>
                            <option value="7days">7 Hari Terakhir</option>
                            <option value="30days">30 Hari Terakhir</option>
                            <option value="thisMonth">Bulan Ini</option>
                            <option value="lastMonth">Bulan Lalu</option>
                            <option value="custom">Pilih Tanggal</option>
                        </select>
                    </div>
                    
                    <div class="form-group" id="customDateStart" style="margin: 0; display: none; min-width: 150px;">
                        <label style="font-size: 12px; color: #666;">Dari Tanggal</label>
                        <input type="date" id="filterStartDate" onchange="window.userModule.filterLoginHistory()"
                               style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px;">
                    </div>
                    
                    <div class="form-group" id="customDateEnd" style="margin: 0; display: none; min-width: 150px;">
                        <label style="font-size: 12px; color: #666;">Sampai Tanggal</label>
                        <input type="date" id="filterEndDate" onchange="window.userModule.filterLoginHistory()"
                               style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px;">
                    </div>
                    
                    <div class="form-group" style="margin: 0; min-width: 150px;">
                        <label style="font-size: 12px; color: #666;">User</label>
                        <select id="loginFilterUser" onchange="window.userModule.filterLoginHistory()"
                                style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px;">
                            <option value="all">Semua User</option>
                            ${userOptions.map(opt => `
                                <option value="${opt.value}">${opt.label}</option>
                            `).join('')}
                        </select>
                    </div>
                    
                    <button class="btn btn-secondary btn-sm" onclick="window.userModule.resetLoginFilter()" 
                            style="margin-bottom: 2px;">Reset</button>
                    
                    <button class="btn btn-secondary btn-sm" onclick="window.userModule.exportLoginHistory()">
                        📥 Download CSV
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Render login history table structure
     */
    renderLoginHistoryTable() {
        return `
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Waktu Login</th>
                            <th>Nama</th>
                            <th>Username</th>
                            <th>Role</th>
                            <th>IP/Device</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody id="loginHistoryTableBody">
                        <tr>
                            <td colspan="6" style="text-align: center; color: #999; padding: 30px;">
                                Klik untuk memuat riwayat login...
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee;">
                <span id="loginHistoryCount" style="font-size: 13px; color: #666;">Total: 0 login</span>
                <div style="font-size: 12px; color: #999;">
                    💡 Data otomatis terhapus setelah 6 bulan untuk menghemat storage
                </div>
            </div>
        `;
    }

    /**
     * Render login history table rows
     */
    renderLoginHistoryRows(loginHistory) {
        if (!loginHistory || loginHistory.length === 0) {
            return `
                <tr>
                    <td colspan="6" style="text-align: center; color: #999; padding: 30px;">
                        Tidak ada data riwayat login untuk periode ini
                    </td>
                </tr>
            `;
        }

        const users = this.userService.getAllUsers();

        return loginHistory.map(log => {
            const user = users.find(u => u.id === log.userId) || { 
                name: 'Unknown', 
                username: 'unknown', 
                role: 'unknown' 
            };
            const loginTime = new Date(log.timestamp);

            return `
                <tr>
                    <td style="font-size: 13px;">
                        <div style="font-weight: 600;">
                            ${loginTime.toLocaleDateString('id-ID', { 
                                day: '2-digit', 
                                month: 'long', 
                                year: 'numeric' 
                            })}
                        </div>
                        <div style="color: #666; font-size: 12px;">
                            ${loginTime.toLocaleTimeString('id-ID', { 
                                hour: '2-digit', 
                                minute: '2-digit', 
                                second: '2-digit' 
                            })}
                        </div>
                    </td>
                    <td>${user.name}</td>
                    <td style="font-family: monospace; font-size: 13px;">${user.username}</td>
                    <td>
                        <span class="badge ${this.userService.getRoleBadgeClass(user.role)}">
                            ${user.role}
                        </span>
                    </td>
                    <td style="font-size: 12px; color: #666;">
                        <div>🖥️ ${log.deviceInfo || 'Unknown Device'}</div>
                        <div style="color: #999; font-size: 11px;">IP: ${log.ipAddress || 'N/A'}</div>
                    </td>
                    <td>
                        <span class="badge badge-success">✓ Sukses</span>
                    </td>
                </tr>
            `;
        }).join('');
    }

    /**
     * Render add user modal
     */
    renderAddUserModal(canCreateOwner) {
        return `
            <div class="modal active" id="addUserModal" style="display: flex; z-index: 2000; align-items: flex-start; padding-top: 50px;">
                <div class="modal-backdrop" onclick="window.userModule.closeModal()"></div>
                <div class="modal-content" style="max-width: 400px; max-height: 80vh; overflow-y: auto;">
                    <div class="modal-header">
                        <span class="modal-title">➕ Tambah Pengguna Baru</span>
                        <button class="close-btn" onclick="window.userModule.closeModal()">×</button>
                    </div>
                    
                    <div class="modal-body">
                        <div class="form-group">
                            <label>Nama Lengkap *</label>
                            <input type="text" id="newUserName" class="form-input" placeholder="Contoh: Budi Santoso">
                        </div>
                        
                        <div class="form-group">
                            <label>Username *</label>
                            <input type="text" id="newUserUsername" class="form-input" placeholder="Contoh: budi123">
                        </div>
                        
                        <div class="form-group">
                            <label>Password *</label>
                            <input type="password" id="newUserPassword" class="form-input" placeholder="Minimal 6 karakter">
                        </div>
                        
                        <div class="form-group">
                            <label>Role *</label>
                            <select id="newUserRole" class="form-select" style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 10px;">
                                <option value="kasir">Kasir</option>
                                <option value="admin">Admin</option>
                                ${canCreateOwner ? `<option value="owner">Owner (Pemilik Usaha)</option>` : ''}
                            </select>
                        </div>
                    </div>
                    
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="window.userModule.closeModal()">Batal</button>
                        <button class="btn btn-primary" onclick="window.userModule.saveNewUser()">Simpan</button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render edit user modal
     */
    renderEditUserModal(user, canEditRole, isEditingSelf) {
        return `
            <div class="modal active" id="editUserModal" style="display: flex; z-index: 2000; align-items: flex-start; padding-top: 50px;">
                <div class="modal-backdrop" onclick="window.userModule.closeModal()"></div>
                <div class="modal-content" style="max-width: 400px; max-height: 80vh; overflow-y: auto;">
                    <div class="modal-header">
                        <span class="modal-title">✏️ Edit Pengguna</span>
                        <button class="close-btn" onclick="window.userModule.closeModal()">×</button>
                    </div>
                    
                    <div class="modal-body">
                        <input type="hidden" id="editUserId" value="${user.id}">
                        
                        <div class="form-group">
                            <label>Nama Lengkap *</label>
                            <input type="text" id="editUserName" class="form-input" value="${user.name}" placeholder="Contoh: Budi Santoso">
                        </div>
                        
                        <div class="form-group">
                            <label>Username *</label>
                            <input type="text" id="editUserUsername" class="form-input" value="${user.username}" placeholder="Contoh: budi123">
                        </div>
                        
                        <div class="form-group">
                            <label>Password Baru (Kosongkan jika tidak diubah)</label>
                            <input type="password" id="editUserPassword" class="form-input" placeholder="Minimal 6 karakter">
                        </div>
                        
                        <div class="form-group">
                            <label>Role *</label>
                            <select id="editUserRole" class="form-select" 
                                    style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 10px;"
                                    ${!canEditRole ? 'disabled' : ''}>
                                <option value="kasir" ${user.role === 'kasir' ? 'selected' : ''}>Kasir</option>
                                <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                                ${canEditRole ? `<option value="owner" ${user.role === 'owner' ? 'selected' : ''}>Owner (Pemilik Usaha)</option>` : ''}
                            </select>
                            ${!canEditRole ? '<small style="color: #999;">Hanya Owner yang dapat mengubah role</small>' : ''}
                        </div>
                    </div>
                    
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="window.userModule.closeModal()">Batal</button>
                        <button class="btn btn-primary" onclick="window.userModule.saveEditUser()">Simpan Perubahan</button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Update login history UI after filter
     */
    updateLoginHistoryUI(loginHistory) {
        const tbody = document.getElementById('loginHistoryTableBody');
        const countEl = document.getElementById('loginHistoryCount');
        const badgeEl = document.getElementById('loginHistoryBadge');

        if (tbody) {
            tbody.innerHTML = this.renderLoginHistoryRows(loginHistory);
        }

        const count = loginHistory ? loginHistory.length : 0;
        if (countEl) countEl.textContent = `Total: ${count} login`;
        if (badgeEl) badgeEl.textContent = `${count} login`;
    }

    /**
     * Toggle custom date inputs visibility
     */
    toggleCustomDateInputs(show) {
        const customStart = document.getElementById('customDateStart');
        const customEnd = document.getElementById('customDateEnd');
        
        if (customStart) customStart.style.display = show ? 'block' : 'none';
        if (customEnd) customEnd.style.display = show ? 'block' : 'none';
    }

    /**
     * Toggle login history accordion
     */
    toggleLoginHistoryAccordion() {
        const content = document.getElementById('loginHistoryContent');
        const arrow = document.getElementById('loginHistoryArrow');
        
        if (!content || !arrow) return false;
        
        const isExpanded = content.style.display === 'block';
        
        if (isExpanded) {
            content.style.display = 'none';
            arrow.style.transform = 'rotate(-90deg)';
            return false;
        } else {
            content.style.display = 'block';
            arrow.style.transform = 'rotate(0deg)';
            return true;
        }
    }
}

let instance = null;

export function getUserUI() {
    if (!instance) instance = new UserUI();
    return instance;
}

export default UserUI;

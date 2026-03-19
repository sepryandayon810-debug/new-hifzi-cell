const usersModule = {
    init() {
        this.renderHTML();
        this.loadUsers();
    },

    renderHTML() {
        const currentUser = dataManager.getCurrentUser();
        const isOwner = currentUser && currentUser.role === 'owner';
        
        document.getElementById('mainContent').innerHTML = `
            <div class="content-section active" id="usersSection">
                <div class="card">
                    <div class="card-header">
                        <span class="card-title">👥 Manajemen Pengguna</span>
                        <button class="btn btn-primary" onclick="usersModule.showAddUserModal()">+ Tambah User</button>
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
                            <tbody id="usersTableBody"></tbody>
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

                ${isOwner ? `
                <!-- Riwayat Login Section - Hanya untuk Owner -->
                <div class="card" style="margin-top: 20px;">
                    <div class="card-header">
                        <span class="card-title">📋 Riwayat Login (6 Bulan Terakhir)</span>
                        <div style="display: flex; gap: 10px;">
                            <button class="btn btn-secondary btn-sm" onclick="usersModule.exportLoginHistory()">📥 Download CSV</button>
                        </div>
                    </div>
                    
                    <!-- Filter Section -->
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; margin-bottom: 20px;">
                        <div style="display: flex; gap: 15px; flex-wrap: wrap; align-items: end;">
                            <div class="form-group" style="margin: 0; flex: 1; min-width: 150px;">
                                <label style="font-size: 12px; color: #666;">Filter Periode</label>
                                <select id="loginFilterPeriod" onchange="usersModule.filterLoginHistory()" style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px;">
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
                                <input type="date" id="filterStartDate" onchange="usersModule.filterLoginHistory()" style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px;">
                            </div>
                            
                            <div class="form-group" id="customDateEnd" style="margin: 0; display: none; min-width: 150px;">
                                <label style="font-size: 12px; color: #666;">Sampai Tanggal</label>
                                <input type="date" id="filterEndDate" onchange="usersModule.filterLoginHistory()" style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px;">
                            </div>
                            
                            <div class="form-group" style="margin: 0; min-width: 150px;">
                                <label style="font-size: 12px; color: #666;">User</label>
                                <select id="loginFilterUser" onchange="usersModule.filterLoginHistory()" style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px;">
                                    <option value="all">Semua User</option>
                                </select>
                            </div>
                            
                            <button class="btn btn-secondary btn-sm" onclick="usersModule.resetLoginFilter()" style="margin-bottom: 2px;">Reset</button>
                        </div>
                    </div>
                    
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
                                        Memuat riwayat login...
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
                </div>
                ` : ''}
            </div>
        `;
        
        // Load filter options jika owner
        if (isOwner) {
            this.loadUserFilterOptions();
            this.filterLoginHistory();
        }
    },

    loadUserFilterOptions() {
        const users = dataManager.getUsers();
        const select = document.getElementById('loginFilterUser');
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = `${user.name} (${user.role})`;
            select.appendChild(option);
        });
    },

    loadUsers() {
        const users = dataManager.getUsers();
        const tbody = document.getElementById('usersTableBody');
        const currentUser = dataManager.getCurrentUser();
        
        tbody.innerHTML = users.map(user => {
            const lastLogin = dataManager.getUserLastLogin(user.id);
            const lastLoginText = lastLogin ? 
                new Date(lastLogin).toLocaleString('id-ID', {
                    day: '2-digit', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                }) : '-';
            
            // Owner hanya bisa diedit oleh owner lain, admin tidak bisa edit owner
            const canEdit = currentUser && (
                currentUser.role === 'owner' || 
                (currentUser.role === 'admin' && user.role !== 'owner')
            );
            const canDelete = currentUser && currentUser.userId !== user.id && 
                (currentUser.role === 'owner' || (currentUser.role === 'admin' && user.role !== 'owner'));
            
            return `
            <tr>
                <td>${user.name}</td>
                <td>${user.username}</td>
                <td><span class="badge ${this.getRoleBadgeClass(user.role)}">${user.role}</span></td>
                <td style="font-size: 13px; color: #666;">${lastLoginText}</td>
                <td>
                    <div style="display: flex; gap: 5px;">
                        ${canEdit ? 
                            `<button class="btn btn-primary btn-sm" onclick="usersModule.showEditUserModal('${user.id}')">✏️ Edit</button>` : 
                            '<span style="color: #999; font-size: 12px;">🔒</span>'
                        }
                        ${canDelete ? 
                            `<button class="btn btn-danger btn-sm" onclick="usersModule.deleteUser('${user.id}')">🗑️ Hapus</button>` : 
                            (currentUser && currentUser.userId === user.id ? '<span style="color: #999; font-size: 12px;">(Anda)</span>' : '')
                        }
                    </div>
                </td>
            </tr>
        `}).join('');
    },

    getRoleBadgeClass(role) {
        switch(role) {
            case 'owner': return 'badge-danger'; // Merah untuk owner
            case 'admin': return 'badge-primary';
            case 'kasir': return 'badge-secondary';
            default: return 'badge-secondary';
        }
    },

    showAddUserModal() {
        const currentUser = dataManager.getCurrentUser();
        const canCreateOwner = currentUser && currentUser.role === 'owner';
        
        const modalHTML = `
            <div class="modal active" id="addUserModal" style="display: flex; z-index: 2000; align-items: flex-start; padding-top: 50px;">
                <div class="modal-content" style="max-width: 400px; max-height: 80vh; overflow-y: auto;">
                    <div class="modal-header">
                        <span class="modal-title">➕ Tambah Pengguna Baru</span>
                        <button class="close-btn" onclick="document.getElementById('addUserModal').remove()">×</button>
                    </div>
                    
                    <div class="form-group">
                        <label>Nama Lengkap *</label>
                        <input type="text" id="newUserName" placeholder="Contoh: Budi Santoso">
                    </div>
                    
                    <div class="form-group">
                        <label>Username *</label>
                        <input type="text" id="newUserUsername" placeholder="Contoh: budi123">
                    </div>
                    
                    <div class="form-group">
                        <label>Password *</label>
                        <input type="password" id="newUserPassword" placeholder="Minimal 6 karakter">
                    </div>
                    
                    <div class="form-group">
                        <label>Role *</label>
                        <select id="newUserRole" style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 10px;">
                            <option value="kasir">Kasir</option>
                            <option value="admin">Admin</option>
                            ${canCreateOwner ? `<option value="owner">Owner (Pemilik Usaha)</option>` : ''}
                        </select>
                    </div>
                    
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="document.getElementById('addUserModal').remove()">Batal</button>
                        <button class="btn btn-primary" onclick="usersModule.saveNewUser()">Simpan</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    showEditUserModal(userId) {
        const users = dataManager.getUsers();
        const user = users.find(u => u.id === userId);
        if (!user) return;

        const currentUser = dataManager.getCurrentUser();
        const canEditRole = currentUser && currentUser.role === 'owner';
        const isEditingSelf = currentUser && currentUser.userId === userId;

        const modalHTML = `
            <div class="modal active" id="editUserModal" style="display: flex; z-index: 2000; align-items: flex-start; padding-top: 50px;">
                <div class="modal-content" style="max-width: 400px; max-height: 80vh; overflow-y: auto;">
                    <div class="modal-header">
                        <span class="modal-title">✏️ Edit Pengguna</span>
                        <button class="close-btn" onclick="document.getElementById('editUserModal').remove()">×</button>
                    </div>
                    
                    <input type="hidden" id="editUserId" value="${user.id}">
                    
                    <div class="form-group">
                        <label>Nama Lengkap *</label>
                        <input type="text" id="editUserName" value="${user.name}" placeholder="Contoh: Budi Santoso">
                    </div>
                    
                    <div class="form-group">
                        <label>Username *</label>
                        <input type="text" id="editUserUsername" value="${user.username}" placeholder="Contoh: budi123">
                    </div>
                    
                    <div class="form-group">
                        <label>Password Baru (Kosongkan jika tidak diubah)</label>
                        <input type="password" id="editUserPassword" placeholder="Minimal 6 karakter">
                    </div>
                    
                    <div class="form-group">
                        <label>Role *</label>
                        <select id="editUserRole" style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 10px;" 
                            ${!canEditRole ? 'disabled' : ''}>
                            <option value="kasir" ${user.role === 'kasir' ? 'selected' : ''}>Kasir</option>
                            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                            ${canEditRole ? `<option value="owner" ${user.role === 'owner' ? 'selected' : ''}>Owner (Pemilik Usaha)</option>` : ''}
                        </select>
                        ${!canEditRole ? '<small style="color: #999;">Hanya Owner yang dapat mengubah role</small>' : ''}
                    </div>
                    
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="document.getElementById('editUserModal').remove()">Batal</button>
                        <button class="btn btn-primary" onclick="usersModule.saveEditUser()">Simpan Perubahan</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    saveNewUser() {
        const name = document.getElementById('newUserName').value.trim();
        const username = document.getElementById('newUserUsername').value.trim();
        const password = document.getElementById('newUserPassword').value;
        const role = document.getElementById('newUserRole').value;

        if (!name || !username || !password) {
            app.showToast('❌ Semua field wajib diisi!');
            return;
        }

        if (password.length < 6) {
            app.showToast('❌ Password minimal 6 karakter!');
            return;
        }

        // Cek username sudah ada
        const users = dataManager.getUsers();
        if (users.find(u => u.username === username)) {
            app.showToast('❌ Username sudah digunakan!');
            return;
        }

        // Cek permission create owner
        const currentUser = dataManager.getCurrentUser();
        if (role === 'owner' && (!currentUser || currentUser.role !== 'owner')) {
            app.showToast('❌ Hanya Owner yang dapat membuat user Owner!');
            return;
        }

        dataManager.addUser({
            username,
            password,
            name,
            role
        });

        document.getElementById('addUserModal').remove();
        this.loadUsers();
        app.showToast('✅ User berhasil ditambahkan!');
    },

    saveEditUser() {
        const userId = document.getElementById('editUserId').value;
        const name = document.getElementById('editUserName').value.trim();
        const username = document.getElementById('editUserUsername').value.trim();
        const password = document.getElementById('editUserPassword').value;
        const role = document.getElementById('editUserRole').value;

        if (!name || !username) {
            app.showToast('❌ Nama dan username wajib diisi!');
            return;
        }

        if (password && password.length < 6) {
            app.showToast('❌ Password minimal 6 karakter!');
            return;
        }

        // Cek permission edit owner
        const currentUser = dataManager.getCurrentUser();
        const users = dataManager.getUsers();
        const targetUser = users.find(u => u.id === userId);
        
        if (targetUser.role === 'owner' && (!currentUser || currentUser.role !== 'owner')) {
            app.showToast('❌ Hanya Owner yang dapat mengedit user Owner!');
            return;
        }

        // Cek username sudah ada (kecuali milik user ini sendiri)
        const existingUser = users.find(u => u.username === username && u.id !== userId);
        if (existingUser) {
            app.showToast('❌ Username sudah digunakan oleh user lain!');
            return;
        }

        const updateData = {
            name,
            username,
            role
        };

        if (password) {
            updateData.password = password;
        }

        dataManager.updateUser(userId, updateData);
        document.getElementById('editUserModal').remove();
        this.loadUsers();
        
        // Refresh filter user jika owner
        if (currentUser && currentUser.role === 'owner') {
            this.loadUserFilterOptions();
            this.filterLoginHistory();
        }
        
        app.showToast('✅ User berhasil diupdate!');
    },

    deleteUser(userId) {
        const currentUser = dataManager.getCurrentUser();
        const users = dataManager.getUsers();
        const targetUser = users.find(u => u.id === userId);
        
        // Cek permission delete
        if (targetUser.role === 'owner' && (!currentUser || currentUser.role !== 'owner')) {
            app.showToast('❌ Hanya Owner yang dapat menghapus user Owner!');
            return;
        }
        
        if (!confirm('🗑️ Hapus user ini? Data login history user ini juga akan dihapus.')) return;
        
        dataManager.deleteUser(userId);
        
        // Hapus juga login history user tersebut
        dataManager.deleteUserLoginHistory(userId);
        
        this.loadUsers();
        
        // Refresh filter user jika owner
        if (currentUser && currentUser.role === 'owner') {
            this.loadUserFilterOptions();
            this.filterLoginHistory();
        }
        
        app.showToast('✅ User dihapus!');
    },

    // ==================== LOGIN HISTORY FEATURES ====================
    
    filterLoginHistory() {
        const period = document.getElementById('loginFilterPeriod').value;
        const userId = document.getElementById('loginFilterUser').value;
        
        // Handle custom date visibility
        const customStart = document.getElementById('customDateStart');
        const customEnd = document.getElementById('customDateEnd');
        
        if (period === 'custom') {
            customStart.style.display = 'block';
            customEnd.style.display = 'block';
        } else {
            customStart.style.display = 'none';
            customEnd.style.display = 'none';
        }
        
        // Calculate date range
        let startDate = null;
        let endDate = null;
        const now = new Date();
        
        switch(period) {
            case 'today':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
                break;
            case 'yesterday':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
                endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                break;
            case '7days':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                endDate = new Date();
                break;
            case '30days':
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                endDate = new Date();
                break;
            case 'thisMonth':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                break;
            case 'lastMonth':
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                endDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'custom':
                const startInput = document.getElementById('filterStartDate').value;
                const endInput = document.getElementById('filterEndDate').value;
                if (startInput) startDate = new Date(startInput);
                if (endInput) {
                    endDate = new Date(endInput);
                    endDate.setDate(endDate.getDate() + 1); // Include full end date
                }
                break;
        }
        
        // Get filtered login history
        const loginHistory = dataManager.getLoginHistory({
            startDate,
            endDate,
            userId: userId === 'all' ? null : userId
        });
        
        this.renderLoginHistoryTable(loginHistory);
    },

    renderLoginHistoryTable(loginHistory) {
        const tbody = document.getElementById('loginHistoryTableBody');
        const countEl = document.getElementById('loginHistoryCount');
        
        countEl.textContent = `Total: ${loginHistory.length} login`;
        
        if (loginHistory.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; color: #999; padding: 30px;">
                        Tidak ada data riwayat login untuk periode ini
                    </td>
                </tr>
            `;
            return;
        }
        
        const users = dataManager.getUsers();
        
        tbody.innerHTML = loginHistory.map(log => {
            const user = users.find(u => u.id === log.userId) || { name: 'Unknown', username: 'unknown', role: 'unknown' };
            const loginTime = new Date(log.timestamp);
            
            return `
                <tr>
                    <td style="font-size: 13px;">
                        <div style="font-weight: 600;">${loginTime.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
                        <div style="color: #666; font-size: 12px;">${loginTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                    </td>
                    <td>${user.name}</td>
                    <td style="font-family: monospace; font-size: 13px;">${user.username}</td>
                    <td><span class="badge ${this.getRoleBadgeClass(user.role)}">${user.role}</span></td>
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
    },

    resetLoginFilter() {
        document.getElementById('loginFilterPeriod').value = 'today';
        document.getElementById('loginFilterUser').value = 'all';
        document.getElementById('filterStartDate').value = '';
        document.getElementById('filterEndDate').value = '';
        this.filterLoginHistory();
    },

    exportLoginHistory() {
        const period = document.getElementById('loginFilterPeriod').value;
        const userId = document.getElementById('loginFilterUser').value;
        
        // Get current filtered data
        let startDate = null;
        let endDate = null;
        const now = new Date();
        
        switch(period) {
            case 'today':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
                break;
            case 'yesterday':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
                endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                break;
            case '7days':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                endDate = new Date();
                break;
            case '30days':
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                endDate = new Date();
                break;
            case 'thisMonth':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                break;
            case 'lastMonth':
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                endDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'custom':
                const startInput = document.getElementById('filterStartDate').value;
                const endInput = document.getElementById('filterEndDate').value;
                if (startInput) startDate = new Date(startInput);
                if (endInput) {
                    endDate = new Date(endInput);
                    endDate.setDate(endDate.getDate() + 1);
                }
                break;
        }
        
        const loginHistory = dataManager.getLoginHistory({
            startDate,
            endDate,
            userId: userId === 'all' ? null : userId
        });
        
        if (loginHistory.length === 0) {
            app.showToast('❌ Tidak ada data untuk diexport!');
            return;
        }
        
        const users = dataManager.getUsers();
        
        // Create CSV content
        const headers = ['Tanggal', 'Waktu', 'Nama', 'Username', 'Role', 'Device', 'IP Address', 'Status'];
        const rows = loginHistory.map(log => {
            const user = users.find(u => u.id === log.userId) || { name: 'Unknown', username: 'unknown', role: 'unknown' };
            const date = new Date(log.timestamp);
            return [
                date.toLocaleDateString('id-ID'),
                date.toLocaleTimeString('id-ID'),
                user.name,
                user.username,
                user.role,
                log.deviceInfo || 'Unknown',
                log.ipAddress || 'N/A',
                'Sukses'
            ].map(field => `"${field}"`).join(',');
        });
        
        const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
        
        // Download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().slice(0, 10);
        link.href = URL.createObjectURL(blob);
        link.download = `riwayat_login_${timestamp}.csv`;
        link.click();
        
        app.showToast(`✅ Berhasil download ${loginHistory.length} record!`);
    }
};

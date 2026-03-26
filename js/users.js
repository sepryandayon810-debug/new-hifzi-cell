const usersModule = {
    init() {
        try {
            console.log('[UsersModule] Initializing...');
            this.renderHTML();
            this.loadUsers();
            console.log('[UsersModule] Initialized successfully');
        } catch (error) {
            console.error('[UsersModule] Error initializing:', error);
            throw error;
        }
    },

    renderHTML() {
        try {
            const currentUser = dataManager.getCurrentUser();
            const isOwner = currentUser && currentUser.role === 'owner';
            
            const mainContent = document.getElementById('mainContent');
            if (!mainContent) {
                throw new Error('mainContent element not found');
            }

            mainContent.innerHTML = `
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
                    <!-- Riwayat Login Section - Hanya untuk Owner - Accordion Style -->
                    <div class="card" style="margin-top: 20px;">
                        <div class="card-header" style="cursor: pointer; user-select: none;" onclick="usersModule.toggleLoginHistory()">
                            <span class="card-title">📋 Riwayat Login (6 Bulan Terakhir)</span>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span id="loginHistoryBadge" style="background: #6c5ce7; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">0 login</span>
                                <span id="loginHistoryArrow" style="font-size: 20px; transition: transform 0.3s ease; transform: rotate(-90deg);">▼</span>
                            </div>
                        </div>
                        
                        <div id="loginHistoryContent" style="display: none; overflow: hidden; transition: all 0.3s ease;">
                            <!-- Filter Section -->
                            <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; margin: 20px 0;">
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
                                    
                                    <button class="btn btn-secondary btn-sm" onclick="usersModule.exportLoginHistory()">📥 Download CSV</button>
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
                        </div>
                    </div>
                    ` : ''}
                </div>
            `;
            
            // Load filter options jika owner
            if (isOwner) {
                this.loadUserFilterOptions();
            }
        } catch (error) {
            console.error('[UsersModule] Error rendering HTML:', error);
            throw error;
        }
    },

    // Toggle accordion riwayat login
    toggleLoginHistory() {
        try {
            const content = document.getElementById('loginHistoryContent');
            const arrow = document.getElementById('loginHistoryArrow');
            
            if (!content || !arrow) return;
            
            const isExpanded = content.style.display === 'block';
            
            if (isExpanded) {
                content.style.display = 'none';
                arrow.style.transform = 'rotate(-90deg)';
            } else {
                content.style.display = 'block';
                arrow.style.transform = 'rotate(0deg)';
                // Load data pertama kali expand
                const tbody = document.getElementById('loginHistoryTableBody');
                if (tbody && tbody.innerHTML.includes('Klik untuk memuat')) {
                    this.filterLoginHistory();
                }
            }
        } catch (error) {
            console.error('[UsersModule] Error toggling login history:', error);
        }
    },

    loadUserFilterOptions() {
        try {
            const users = dataManager.getUsers();
            const select = document.getElementById('loginFilterUser');
            
            if (!select) return;
            
            // Clear existing options except "Semua User"
            select.innerHTML = '<option value="all">Semua User</option>';
            
            if (users && Array.isArray(users)) {
                users.forEach(user => {
                    if (user && user.id) {
                        const option = document.createElement('option');
                        option.value = user.id;
                        option.textContent = `${user.name || 'Unknown'} (${user.role || 'unknown'})`;
                        select.appendChild(option);
                    }
                });
            }
        } catch (error) {
            console.error('[UsersModule] Error loading user filter options:', error);
        }
    },

    loadUsers() {
        try {
            const users = dataManager.getUsers();
            const tbody = document.getElementById('usersTableBody');
            const currentUser = dataManager.getCurrentUser();
            
            if (!tbody) {
                console.error('[UsersModule] usersTableBody not found');
                return;
            }
            
            if (!users || !Array.isArray(users) || users.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align: center; color: #999; padding: 30px;">
                            Tidak ada data pengguna
                        </td>
                    </tr>
                `;
                return;
            }
            
            tbody.innerHTML = users.map(user => {
                if (!user) return '';
                
                let lastLoginText = '-';
                try {
                    const lastLogin = dataManager.getUserLastLogin ? dataManager.getUserLastLogin(user.id) : null;
                    if (lastLogin) {
                        lastLoginText = new Date(lastLogin).toLocaleString('id-ID', {
                            day: '2-digit', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                        });
                    }
                } catch (e) {
                    console.warn('[UsersModule] Error getting last login for user:', user.id, e);
                }
                
                // Owner hanya bisa diedit oleh owner lain, admin tidak bisa edit owner
                const canEdit = currentUser && (
                    currentUser.role === 'owner' || 
                    (currentUser.role === 'admin' && user.role !== 'owner')
                );
                const canDelete = currentUser && currentUser.userId !== user.id && 
                    (currentUser.role === 'owner' || (currentUser.role === 'admin' && user.role !== 'owner'));
                
                return `
                <tr>
                    <td>${user.name || '-'}</td>
                    <td>${user.username || '-'}</td>
                    <td><span class="badge ${this.getRoleBadgeClass(user.role)}">${user.role || 'unknown'}</span></td>
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
        } catch (error) {
            console.error('[UsersModule] Error loading users:', error);
            const tbody = document.getElementById('usersTableBody');
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align: center; color: #f44336; padding: 30px;">
                            Error memuat data pengguna
                        </td>
                    </tr>
                `;
            }
        }
    },

    getRoleBadgeClass(role) {
        switch(role) {
            case 'owner': return 'badge-danger';
            case 'admin': return 'badge-primary';
            case 'kasir': return 'badge-secondary';
            default: return 'badge-secondary';
        }
    },

    showAddUserModal() {
        try {
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
            
            // Remove existing modal if any
            const existingModal = document.getElementById('addUserModal');
            if (existingModal) existingModal.remove();
            
            document.body.insertAdjacentHTML('beforeend', modalHTML);
        } catch (error) {
            console.error('[UsersModule] Error showing add user modal:', error);
            if (typeof app !== 'undefined' && app.showToast) {
                app.showToast('❌ Error membuka form tambah user');
            }
        }
    },

    showEditUserModal(userId) {
        try {
            const users = dataManager.getUsers();
            const user = users.find(u => u && u.id === userId);
            
            if (!user) {
                if (typeof app !== 'undefined' && app.showToast) {
                    app.showToast('❌ User tidak ditemukan!');
                }
                return;
            }

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
                            <input type="text" id="editUserName" value="${user.name || ''}" placeholder="Contoh: Budi Santoso">
                        </div>
                        
                        <div class="form-group">
                            <label>Username *</label>
                            <input type="text" id="editUserUsername" value="${user.username || ''}" placeholder="Contoh: budi123">
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
            
            // Remove existing modal if any
            const existingModal = document.getElementById('editUserModal');
            if (existingModal) existingModal.remove();
            
            document.body.insertAdjacentHTML('beforeend', modalHTML);
        } catch (error) {
            console.error('[UsersModule] Error showing edit user modal:', error);
            if (typeof app !== 'undefined' && app.showToast) {
                app.showToast('❌ Error membuka form edit user');
            }
        }
    },

    saveNewUser() {
        try {
            const nameInput = document.getElementById('newUserName');
            const usernameInput = document.getElementById('newUserUsername');
            const passwordInput = document.getElementById('newUserPassword');
            const roleInput = document.getElementById('newUserRole');
            
            if (!nameInput || !usernameInput || !passwordInput || !roleInput) {
                if (typeof app !== 'undefined' && app.showToast) {
                    app.showToast('❌ Form tidak lengkap!');
                }
                return;
            }
            
            const name = nameInput.value.trim();
            const username = usernameInput.value.trim();
            const password = passwordInput.value;
            const role = roleInput.value;

            if (!name || !username || !password) {
                if (typeof app !== 'undefined' && app.showToast) {
                    app.showToast('❌ Semua field wajib diisi!');
                }
                return;
            }

            if (password.length < 6) {
                if (typeof app !== 'undefined' && app.showToast) {
                    app.showToast('❌ Password minimal 6 karakter!');
                }
                return;
            }

            // Cek username sudah ada
            const users = dataManager.getUsers();
            if (users.find(u => u && u.username === username)) {
                if (typeof app !== 'undefined' && app.showToast) {
                    app.showToast('❌ Username sudah digunakan!');
                }
                return;
            }

            // Cek permission create owner
            const currentUser = dataManager.getCurrentUser();
            if (role === 'owner' && (!currentUser || currentUser.role !== 'owner')) {
                if (typeof app !== 'undefined' && app.showToast) {
                    app.showToast('❌ Hanya Owner yang dapat membuat user Owner!');
                }
                return;
            }

            dataManager.addUser({
                username,
                password,
                name,
                role
            });

            const modal = document.getElementById('addUserModal');
            if (modal) modal.remove();
            
            this.loadUsers();
            
            if (typeof app !== 'undefined' && app.showToast) {
                app.showToast('✅ User berhasil ditambahkan!');
            }
        } catch (error) {
            console.error('[UsersModule] Error saving new user:', error);
            if (typeof app !== 'undefined' && app.showToast) {
                app.showToast('❌ Error menyimpan user baru');
            }
        }
    },

    saveEditUser() {
        try {
            const userIdInput = document.getElementById('editUserId');
            const nameInput = document.getElementById('editUserName');
            const usernameInput = document.getElementById('editUserUsername');
            const passwordInput = document.getElementById('editUserPassword');
            const roleInput = document.getElementById('editUserRole');
            
            if (!userIdInput || !nameInput || !usernameInput || !roleInput) {
                if (typeof app !== 'undefined' && app.showToast) {
                    app.showToast('❌ Form tidak lengkap!');
                }
                return;
            }
            
            const userId = userIdInput.value;
            const name = nameInput.value.trim();
            const username = usernameInput.value.trim();
            const password = passwordInput ? passwordInput.value : '';
            const role = roleInput.value;

            if (!name || !username) {
                if (typeof app !== 'undefined' && app.showToast) {
                    app.showToast('❌ Nama dan username wajib diisi!');
                }
                return;
            }

            if (password && password.length < 6) {
                if (typeof app !== 'undefined' && app.showToast) {
                    app.showToast('❌ Password minimal 6 karakter!');
                }
                return;
            }

            // Cek permission edit owner
            const currentUser = dataManager.getCurrentUser();
            const users = dataManager.getUsers();
            const targetUser = users.find(u => u && u.id === userId);
            
            if (!targetUser) {
                if (typeof app !== 'undefined' && app.showToast) {
                    app.showToast('❌ User tidak ditemukan!');
                }
                return;
            }
            
            if (targetUser.role === 'owner' && (!currentUser || currentUser.role !== 'owner')) {
                if (typeof app !== 'undefined' && app.showToast) {
                    app.showToast('❌ Hanya Owner yang dapat mengedit user Owner!');
                }
                return;
            }

            // Cek username sudah ada (kecuali milik user ini sendiri)
            const existingUser = users.find(u => u && u.username === username && u.id !== userId);
            if (existingUser) {
                if (typeof app !== 'undefined' && app.showToast) {
                    app.showToast('❌ Username sudah digunakan oleh user lain!');
                }
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
            
            const modal = document.getElementById('editUserModal');
            if (modal) modal.remove();
            
            this.loadUsers();
            
            // Refresh filter user jika owner dan accordion terbuka
            if (currentUser && currentUser.role === 'owner') {
                const content = document.getElementById('loginHistoryContent');
                if (content && content.style.display === 'block') {
                    this.loadUserFilterOptions();
                    this.filterLoginHistory();
                }
            }
            
            if (typeof app !== 'undefined' && app.showToast) {
                app.showToast('✅ User berhasil diupdate!');
            }
        } catch (error) {
            console.error('[UsersModule] Error saving edit user:', error);
            if (typeof app !== 'undefined' && app.showToast) {
                app.showToast('❌ Error menyimpan perubahan user');
            }
        }
    },

    deleteUser(userId) {
        try {
            const currentUser = dataManager.getCurrentUser();
            const users = dataManager.getUsers();
            const targetUser = users.find(u => u && u.id === userId);
            
            if (!targetUser) {
                if (typeof app !== 'undefined' && app.showToast) {
                    app.showToast('❌ User tidak ditemukan!');
                }
                return;
            }
            
            // Cek permission delete
            if (targetUser.role === 'owner' && (!currentUser || currentUser.role !== 'owner')) {
                if (typeof app !== 'undefined' && app.showToast) {
                    app.showToast('❌ Hanya Owner yang dapat menghapus user Owner!');
                }
                return;
            }
            
            if (!confirm('🗑️ Hapus user ini? Data login history user ini juga akan dihapus.')) return;
            
            dataManager.deleteUser(userId);
            
            // Hapus juga login history user tersebut
            if (dataManager.deleteUserLoginHistory) {
                dataManager.deleteUserLoginHistory(userId);
            }
            
            this.loadUsers();
            
            // Refresh filter user jika owner dan accordion terbuka
            if (currentUser && currentUser.role === 'owner') {
                const content = document.getElementById('loginHistoryContent');
                if (content && content.style.display === 'block') {
                    this.loadUserFilterOptions();
                    this.filterLoginHistory();
                }
            }
            
            if (typeof app !== 'undefined' && app.showToast) {
                app.showToast('✅ User dihapus!');
            }
        } catch (error) {
            console.error('[UsersModule] Error deleting user:', error);
            if (typeof app !== 'undefined' && app.showToast) {
                app.showToast('❌ Error menghapus user');
            }
        }
    },

    // ==================== LOGIN HISTORY FEATURES ====================
    
    filterLoginHistory() {
        try {
            const periodSelect = document.getElementById('loginFilterPeriod');
            const userSelect = document.getElementById('loginFilterUser');
            
            if (!periodSelect) return;
            
            const period = periodSelect.value;
            const userId = userSelect ? userSelect.value : 'all';
            
            // Handle custom date visibility
            const customStart = document.getElementById('customDateStart');
            const customEnd = document.getElementById('customDateEnd');
            
            if (customStart && customEnd) {
                if (period === 'custom') {
                    customStart.style.display = 'block';
                    customEnd.style.display = 'block';
                } else {
                    customStart.style.display = 'none';
                    customEnd.style.display = 'none';
                }
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
                    const startInput = document.getElementById('filterStartDate');
                    const endInput = document.getElementById('filterEndDate');
                    if (startInput && startInput.value) startDate = new Date(startInput.value);
                    if (endInput && endInput.value) {
                        endDate = new Date(endInput.value);
                        endDate.setDate(endDate.getDate() + 1);
                    }
                    break;
            }
            
            // Get filtered login history
            const loginHistory = dataManager.getLoginHistory ? dataManager.getLoginHistory({
                startDate,
                endDate,
                userId: userId === 'all' ? null : userId
            }) : [];
            
            this.renderLoginHistoryTable(loginHistory);
        } catch (error) {
            console.error('[UsersModule] Error filtering login history:', error);
        }
    },

    renderLoginHistoryTable(loginHistory) {
        try {
            const tbody = document.getElementById('loginHistoryTableBody');
            const countEl = document.getElementById('loginHistoryCount');
            const badgeEl = document.getElementById('loginHistoryBadge');
            
            if (!tbody) return;
            
            const count = loginHistory ? loginHistory.length : 0;
            
            if (countEl) countEl.textContent = `Total: ${count} login`;
            if (badgeEl) badgeEl.textContent = `${count} login`;
            
            if (count === 0) {
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
                if (!log) return '';
                
                const user = users.find(u => u && u.id === log.userId) || { name: 'Unknown', username: 'unknown', role: 'unknown' };
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
        } catch (error) {
            console.error('[UsersModule] Error rendering login history table:', error);
        }
    },

    resetLoginFilter() {
        try {
            const periodSelect = document.getElementById('loginFilterPeriod');
            const userSelect = document.getElementById('loginFilterUser');
            const startDate = document.getElementById('filterStartDate');
            const endDate = document.getElementById('filterEndDate');
            
            if (periodSelect) periodSelect.value = 'today';
            if (userSelect) userSelect.value = 'all';
            if (startDate) startDate.value = '';
            if (endDate) endDate.value = '';
            
            this.filterLoginHistory();
        } catch (error) {
            console.error('[UsersModule] Error resetting login filter:', error);
        }
    },

    exportLoginHistory() {
        try {
            const periodSelect = document.getElementById('loginFilterPeriod');
            const userSelect = document.getElementById('loginFilterUser');
            
            if (!periodSelect) return;
            
            const period = periodSelect.value;
            const userId = userSelect ? userSelect.value : 'all';
            
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
                    const startInput = document.getElementById('filterStartDate');
                    const endInput = document.getElementById('filterEndDate');
                    if (startInput && startInput.value) startDate = new Date(startInput.value);
                    if (endInput && endInput.value) {
                        endDate = new Date(endInput.value);
                        endDate.setDate(endDate.getDate() + 1);
                    }
                    break;
            }
            
            const loginHistory = dataManager.getLoginHistory ? dataManager.getLoginHistory({
                startDate,
                endDate,
                userId: userId === 'all' ? null : userId
            }) : [];
            
            if (!loginHistory || loginHistory.length === 0) {
                if (typeof app !== 'undefined' && app.showToast) {
                    app.showToast('❌ Tidak ada data untuk diexport!');
                }
                return;
            }
            
            const users = dataManager.getUsers();
            
            // Create CSV content
            const headers = ['Tanggal', 'Waktu', 'Nama', 'Username', 'Role', 'Device', 'IP Address', 'Status'];
            const rows = loginHistory.map(log => {
                if (!log) return '';
                const user = users.find(u => u && u.id === log.userId) || { name: 'Unknown', username: 'unknown', role: 'unknown' };
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
            }).filter(row => row);
            
            const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
            
            // Download
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const timestamp = new Date().toISOString().slice(0, 10);
            link.href = URL.createObjectURL(blob);
            link.download = `riwayat_login_${timestamp}.csv`;
            link.click();
            
            if (typeof app !== 'undefined' && app.showToast) {
                app.showToast(`✅ Berhasil download ${loginHistory.length} record!`);
            }
        } catch (error) {
            console.error('[UsersModule] Error exporting login history:', error);
            if (typeof app !== 'undefined' && app.showToast) {
                app.showToast('❌ Error mengekspor data');
            }
        }
    }
};

// Expose to window
if (typeof window !== 'undefined') {
    window.usersModule = usersModule;
}

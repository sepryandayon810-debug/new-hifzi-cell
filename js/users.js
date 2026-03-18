const usersModule = {
    init() {
        this.renderHTML();
        this.loadUsers();
    },

    renderHTML() {
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
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody id="usersTableBody"></tbody>
                        </table>
                    </div>
                    
                    <div class="info-box" style="margin-top: 20px;">
                        <div class="info-title">💡 Informasi</div>
                        <div class="info-text">
                            • Admin: Dapat mengakses semua menu dan mengelola user<br>
                            • Kasir: Hanya dapat mengakses POS, Produk, dan Transaksi<br>
                            • Default login: admin/admin123 atau kasir1/kasir123
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    loadUsers() {
        const users = dataManager.getUsers();
        const tbody = document.getElementById('usersTableBody');
        const currentUser = dataManager.getCurrentUser();
        
        tbody.innerHTML = users.map(user => `
            <tr>
                <td>${user.name}</td>
                <td>${user.username}</td>
                <td><span class="badge ${user.role === 'admin' ? 'badge-primary' : 'badge-secondary'}">${user.role}</span></td>
                <td>
                    <div style="display: flex; gap: 5px;">
                        <button class="btn btn-primary btn-sm" onclick="usersModule.showEditUserModal('${user.id}')">✏️ Edit</button>
                        ${currentUser && currentUser.userId !== user.id ? 
                            `<button class="btn btn-danger btn-sm" onclick="usersModule.deleteUser('${user.id}')">🗑️ Hapus</button>` : 
                            '<span style="color: #999; font-size: 12px;">(Anda)</span>'
                        }
                    </div>
                </td>
            </tr>
        `).join('');
    },

    showAddUserModal() {
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
                        <select id="editUserRole" style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 10px;">
                            <option value="kasir" ${user.role === 'kasir' ? 'selected' : ''}>Kasir</option>
                            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                        </select>
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

        // Cek username sudah ada (kecuali milik user ini sendiri)
        const users = dataManager.getUsers();
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
        app.showToast('✅ User berhasil diupdate!');
    },

    deleteUser(userId) {
        if (!confirm('🗑️ Hapus user ini?')) return;
        
        dataManager.deleteUser(userId);
        this.loadUsers();
        app.showToast('✅ User dihapus!');
    }
};

/**
 * ============================================
 * HIFZI CELL - USER SERVICE
 * ============================================
 * Logic data user: CRUD, permission, validation
 */

import { getDataManager } from '../data/index.js';

export class UserService {
    constructor() {
        this.dataManager = getDataManager();
    }

    /**
     * Get current logged in user
     */
    getCurrentUser() {
        return this.dataManager.users.getCurrentSession();
    }

    /**
     * Get all users
     */
    getAllUsers() {
        return this.dataManager.users.getAllUsers();
    }

    /**
     * Get user by ID
     */
    getUserById(userId) {
        return this.dataManager.users.getUserById(userId);
    }

    /**
     * Check if current user can create/edit/delete target role
     */
    canManageRole(currentRole, targetRole, action = 'edit') {
        if (currentRole === 'owner') return true;
        if (currentRole === 'admin') {
            return targetRole !== 'owner';
        }
        return false;
    }

    /**
     * Check permissions for current user
     */
    getPermissions(currentUser) {
        if (!currentUser) return { canCreate: false, canEdit: false, canDelete: false, canViewLoginHistory: false };
        
        const isOwner = currentUser.role === 'owner';
        const isAdmin = currentUser.role === 'admin';
        
        return {
            canCreate: isOwner || isAdmin,
            canEdit: isOwner || isAdmin,
            canDelete: (isOwner || isAdmin) && currentUser.userId !== undefined,
            canViewLoginHistory: isOwner,
            canCreateOwner: isOwner,
            canEditRole: isOwner
        };
    }

    /**
     * Validate user input
     */
    validateInput({ name, username, password, requirePassword = true }) {
        const errors = [];
        
        if (!name || name.trim().length < 2) {
            errors.push('Nama minimal 2 karakter');
        }
        
        if (!username || username.trim().length < 3) {
            errors.push('Username minimal 3 karakter');
        }
        
        if (requirePassword && (!password || password.length < 6)) {
            errors.push('Password minimal 6 karakter');
        }
        
        if (password && password.length > 0 && password.length < 6) {
            errors.push('Password minimal 6 karakter');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Check if username exists (exclude specific userId for edit)
     */
    isUsernameExists(username, excludeUserId = null) {
        const users = this.getAllUsers();
        return users.some(u => u.username === username && u.id !== excludeUserId);
    }

    /**
     * Create new user
     */
    createUser({ name, username, password, role }) {
        const validation = this.validateInput({ name, username, password, requirePassword: true });
        
        if (!validation.isValid) {
            return { success: false, error: validation.errors.join(', ') };
        }

        if (this.isUsernameExists(username)) {
            return { success: false, error: 'Username sudah digunakan' };
        }

        const result = this.dataManager.users.createUser({
            name: name.trim(),
            username: username.trim(),
            password,
            role
        });

        return result;
    }

    /**
     * Update existing user
     */
    updateUser(userId, { name, username, password, role }) {
        const validation = this.validateInput({ 
            name, 
            username, 
            password, 
            requirePassword: false 
        });
        
        if (!validation.isValid) {
            return { success: false, error: validation.errors.join(', ') };
        }

        if (this.isUsernameExists(username, userId)) {
            return { success: false, error: 'Username sudah digunakan oleh user lain' };
        }

        const updates = {
            name: name.trim(),
            username: username.trim(),
            role
        };

        if (password && password.length >= 6) {
            updates.password = password;
        }

        return this.dataManager.users.updateUser(userId, updates);
    }

    /**
     * Delete user
     */
    deleteUser(userId) {
        const currentUser = this.getCurrentUser();
        if (currentUser && currentUser.userId === userId) {
            return { success: false, error: 'Tidak dapat menghapus diri sendiri' };
        }

        const result = this.dataManager.users.deleteUser(userId);
        
        // Also delete login history if method exists
        if (result.success && this.dataManager.deleteUserLoginHistory) {
            this.dataManager.deleteUserLoginHistory(userId);
        }

        return result;
    }

    /**
     * Get role badge class for styling
     */
    getRoleBadgeClass(role) {
        switch(role) {
            case 'owner': return 'badge-danger';
            case 'admin': return 'badge-primary';
            case 'kasir': return 'badge-secondary';
            default: return 'badge-secondary';
        }
    }

    /**
     * Get role display label
     */
    getRoleLabel(role) {
        const labels = {
            owner: 'Owner (Pemilik Usaha)',
            admin: 'Administrator',
            kasir: 'Kasir'
        };
        return labels[role] || role;
    }

    /**
     * Get initials from name
     */
    getInitials(name) {
        if (!name) return '?';
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    }

    /**
     * Get last login text for user
     */
    getLastLoginText(userId) {
        try {
            const lastLogin = this.dataManager.getUserLastLogin ? 
                this.dataManager.getUserLastLogin(userId) : null;
            
            if (lastLogin) {
                return new Date(lastLogin).toLocaleString('id-ID', {
                    day: '2-digit', 
                    month: 'short', 
                    year: 'numeric',
                    hour: '2-digit', 
                    minute: '2-digit'
                });
            }
        } catch (e) {
            console.warn('[UserService] Error getting last login:', e);
        }
        return '-';
    }
}

let instance = null;

export function getUserService() {
    if (!instance) instance = new UserService();
    return instance;
}

export default UserService;

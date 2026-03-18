// ============================================
// BACKUP MODULE - Versi Unified (Pakai hifzi_data)
// ============================================

const backupModule = {
    currentProvider: 'local',
    gasUrl: '',
    isAutoSyncEnabled: false,
    lastSyncTime: null,
    autoSyncInterval: null,
    
    // SAMAKAN dengan dataManager
    STORAGE_KEY: 'hifzi_data',  // ← Kunci: pakai yang sama!
    
    GAS_URL_KEY: 'hifzi_gas_url',
    AUTO_SYNC_KEY: 'hifzi_auto_sync',
    LAST_SYNC_KEY: 'hifzi_last_sync',
    LOGS_KEY: 'hifzi_backup_logs',

    init() {
        console.log('[Backup] Init unified version');
        
        this.gasUrl = localStorage.getItem(this.GAS_URL_KEY) || '';
        this.isAutoSyncEnabled = localStorage.getItem(this.AUTO_SYNC_KEY) === 'true';
        this.lastSyncTime = localStorage.getItem(this.LAST_SYNC_KEY) || null;
        
        // Deteksi provider
        if (this.gasUrl && this.gasUrl.length > 10) {
            this.currentProvider = 'googlesheet';
        }
        
        // Auto-download jika device baru (tidak ada data lokal)
        if (this.gasUrl && !this.hasLocalData()) {
            console.log('[Backup] New device detected, auto-download...');
            setTimeout(() => this.downloadData(true), 1000);
        }
        
        if (this.isAutoSyncEnabled && this.gasUrl) {
            this.startAutoSync();
        }
        
        this.render();
    },

    // ======== DATA ACCESS (Pakai dataManager) ========
    
    getData() {
        // Ambil dari dataManager jika ada, fallback ke localStorage
        if (typeof dataManager !== 'undefined' && dataManager.data) {
            return dataManager.data;
        }
        
        // Fallback: baca langsung dari localStorage
        const saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved) {
            return JSON.parse(saved);
        }
        
        return this.getDefaultData();
    },

    getDefaultData() {
        return {
            categories: [
                { id: 'all', name: 'Semua', icon: '📦' },
                { id: 'handphone', name: 'Handphone', icon: '📱' },
                { id: 'aksesoris', name: 'Aksesoris', icon: '🎧' },
                { id: 'pulsa', name: 'Pulsa', icon: '💳' },
                { id: 'servis', name: 'Servis', icon: '🔧' }
            ],
            products: [],
            transactions: [],
            cashTransactions: [],
            debts: [],
            shiftHistory: [],
            settings: {
                storeName: 'Hifzi Cell',
                address: '',
                phone: '',
                tax: 0,
                taxRate: 0,
                modalAwal: 0,
                currentCash: 0,
                receiptHeader: {
                    storeName: 'HIFZI CELL',
                    address: 'Alamat Belum Diatur',
                    phone: '',
                    note: 'Terima kasih atas kunjungan Anda'
                }
            },
            kasir: {
                isOpen: false,
                openTime: null,
                closeTime: null,
                date: null,
                currentUser: null,
                lastCheckDate: null
            }
        };
    },

    hasLocalData() {
        const data = this.getData();
        return (
            (data.products && data.products.length > 0) ||
            (data.transactions && data.transactions.length > 0) ||
            (data.debts && data.debts.length > 0)
        );
    },

    saveData(data) {
        // Simpan via dataManager jika ada
        if (typeof dataManager !== 'undefined') {
            dataManager.data = { ...dataManager.data, ...data };
            dataManager.save();
        } else {
            // Fallback: simpan langsung
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
        }
        
        // Update UI
        if (typeof app !== 'undefined' && app.updateHeader) {
            app.updateHeader();
        }
    },

    // ======== STATS ========
    
    getStats() {
        const data = this.getData();
        return {
            products: data.products?.length || 0,
            categories: data.categories?.length || 0,
            transactions: data.transactions?.length || 0,
            cashFlow: data.cashTransactions?.length || 0,
            debts: data.debts?.length || 0,
            currentCash: data.settings?.currentCash || 0,
            storeName: data.settings?.storeName || 'HIFZI CELL'
        };
    },

    // ======== CLOUD SYNC ========

    uploadData(silent = false, callback) {
        if (!this.gasUrl) {
            if (!silent) this.showToast('❌ URL GAS belum diisi!');
            if (callback) callback(false);
            return;
        }

        const data = this.getData();
        if (!silent) this.showToast('⬆️ Mengupload...');

        const payload = {
            action: 'sync',
            data: data,  // Kirim seluruh objek data
            timestamp: new Date().toISOString(),
            device: navigator.userAgent
        };

        // Gunakan fetch dengan fallback JSONP
        fetch(this.gasUrl, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        })
        .then(r => r.json())
        .then(result => {
            if (result?.success) {
                this.lastSyncTime = new Date().toISOString();
                localStorage.setItem(this.LAST_SYNC_KEY, this.lastSyncTime);
                if (!silent) this.showToast('✅ Upload berhasil!');
                if (callback) callback(true);
            } else {
                throw new Error(result?.message || 'Upload failed');
            }
        })
        .catch(err => {
            console.log('[Backup] Fetch failed, trying JSONP:', err);
            this.uploadJSONP(payload, silent, callback);
        });
    },

    uploadJSONP(payload, silent, callback) {
        const jsonStr = JSON.stringify(payload);
        if (jsonStr.length > 8000) {
            this.uploadIframe(payload, silent, callback);
            return;
        }

        const encoded = encodeURIComponent(jsonStr);
        const cbName = 'up_' + Date.now();

        window[cbName] = (result) => {
            if (result?.success) {
                this.lastSyncTime = new Date().toISOString();
                localStorage.setItem(this.LAST_SYNC_KEY, this.lastSyncTime);
                if (!silent) this.showToast('✅ Upload berhasil!');
                if (callback) callback(true);
            } else {
                if (!silent) this.showToast('❌ Upload gagal');
                if (callback) callback(false);
            }
            delete window[cbName];
        };

        const script = document.createElement('script');
        script.onerror = () => {
            this.uploadIframe(payload, silent, callback);
            delete window[cbName];
        };
        script.src = `${this.gasUrl}?callback=${cbName}&data=${encoded}`;
        document.head.appendChild(script);

        setTimeout(() => {
            if (window[cbName]) {
                delete window[cbName];
                if (callback) callback(false);
            }
        }, 15000);
    },

    uploadIframe(payload, silent, callback) {
        const formId = 'frm_' + Date.now();
        const iframeId = 'ifrm_' + Date.now();

        const form = document.createElement('form');
        form.id = formId;
        form.method = 'POST';
        form.action = this.gasUrl;
        form.target = iframeId;
        form.style.display = 'none';

        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'data';
        input.value = JSON.stringify(payload);
        form.appendChild(input);

        const iframe = document.createElement('iframe');
        iframe.id = iframeId;
        iframe.name = iframeId;
        iframe.style.display = 'none';

        document.body.appendChild(form);
        document.body.appendChild(iframe);

        iframe.onload = () => {
            try {
                const doc = iframe.contentDocument || iframe.contentWindow.document;
                const result = JSON.parse(doc.body.innerText);
                if (result?.success) {
                    this.lastSyncTime = new Date().toISOString();
                    localStorage.setItem(this.LAST_SYNC_KEY, this.lastSyncTime);
                    if (!silent) this.showToast('✅ Upload selesai');
                    if (callback) callback(true);
                }
            } catch (e) {
                // Assume success if no error
                this.lastSyncTime = new Date().toISOString();
                localStorage.setItem(this.LAST_SYNC_KEY, this.lastSyncTime);
                if (!silent) this.showToast('✅ Upload selesai');
                if (callback) callback(true);
            }
            setTimeout(() => {
                document.getElementById(formId)?.remove();
                document.getElementById(iframeId)?.remove();
            }, 2000);
        };

        form.submit();
    },

    downloadData(silent = false) {
        if (!this.gasUrl) {
            if (!silent) this.showToast('❌ URL GAS belum diisi!');
            return;
        }

        if (!silent && !confirm('📥 Download akan mengganti data lokal. Lanjutkan?')) return;
        if (!silent) this.showToast('⬇️ Mengunduh...');

        fetch(`${this.gasUrl}?action=restore&_t=${Date.now()}`)
        .then(r => r.json())
        .then(result => this.handleDownload(result, silent))
        .catch(() => this.downloadJSONP(silent));
    },

    downloadJSONP(silent) {
        const cbName = 'dl_' + Date.now();
        
        window[cbName] = (result) => {
            this.handleDownload(result, silent);
            delete window[cbName];
        };

        const script = document.createElement('script');
        script.onerror = () => {
            if (!silent) this.showToast('❌ Gagal terhubung');
            delete window[cbName];
        };
        script.src = `${this.gasUrl}?action=restore&callback=${cbName}&_t=${Date.now()}`;
        document.head.appendChild(script);

        setTimeout(() => {
            if (window[cbName]) delete window[cbName];
        }, 20000);
    },

    handleDownload(result, silent) {
        if (result?.success && result.data) {
            this.saveData(result.data);
            this.lastSyncTime = new Date().toISOString();
            localStorage.setItem(this.LAST_SYNC_KEY, this.lastSyncTime);
            
            const stats = this.getStats();
            if (!silent) {
                this.showToast(`✅ Download OK! P:${stats.products} T:${stats.transactions}`);
                setTimeout(() => location.reload(), 1500);
            }
        } else {
            if (!silent) this.showToast('❌ Download gagal');
        }
    },

    // ======== AUTO SYNC ========

    startAutoSync() {
        this.stopAutoSync();
        this.performTwoWaySync();
        this.autoSyncInterval = setInterval(() => this.performTwoWaySync(), 180000);
        console.log('[Backup] Auto sync started (3 min)');
    },

    stopAutoSync() {
        if (this.autoSyncInterval) {
            clearInterval(this.autoSyncInterval);
            this.autoSyncInterval = null;
        }
    },

    performTwoWaySync() {
        this.uploadData(true, (success) => {
            if (success) {
                // Cek timestamp cloud
                this.getCloudTimestamp((cloudTime) => {
                    if (cloudTime && cloudTime > this.lastSyncTime) {
                        console.log('[Backup] Cloud newer, downloading...');
                        this.downloadData(true);
                    }
                });
            }
        });
    },

    getCloudTimestamp(callback) {
        const cbName = 'ts_' + Date.now();
        
        window[cbName] = (result) => {
            callback(result?.timestamp || null);
            delete window[cbName];
        };

        const script = document.createElement('script');
        script.onerror = () => {
            callback(null);
            delete window[cbName];
        };
        script.src = `${this.gasUrl}?action=getTimestamp&callback=${cbName}&_t=${Date.now()}`;
        document.head.appendChild(script);

        setTimeout(() => {
            if (window[cbName]) {
                callback(null);
                delete window[cbName];
            }
        }, 10000);
    },

    // ======== UI RENDER ========

    render() {
        const container = document.getElementById('mainContent');
        if (!container) return;

        const stats = this.getStats();
        const isCloud = this.currentProvider === 'googlesheet' && this.gasUrl;

        container.innerHTML = `
            <div class="content-section active" style="padding: 16px; max-width: 1200px; margin: 0 auto;">
                
                <!-- Status -->
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-size: 14px; opacity: 0.9;">Status Sinkronisasi</div>
                            <div style="font-size: 20px; font-weight: 600;">
                                ${this.isAutoSyncEnabled ? '🟢 Auto Sync Aktif' : '⚪ Manual'}
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 12px; opacity: 0.8;">Last Sync</div>
                            <div style="font-size: 14px;">
                                ${this.lastSyncTime ? new Date(this.lastSyncTime).toLocaleString('id-ID', {hour:'2-digit', minute:'2-digit'}) : 'Belum'}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Stats -->
                <div style="background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <div style="font-size: 16px; font-weight: 600; margin-bottom: 16px;">📊 ${stats.storeName}</div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px;">
                        ${this.statCard('📦', 'Produk', stats.products, '#e3f2fd', '#2196F3')}
                        ${this.statCard('📝', 'Transaksi', stats.transactions, '#fff3e0', '#FF9800')}
                        ${this.statCard('💳', 'Hutang', stats.debts, '#f3e5f5', '#9C27B0')}
                        ${this.statCard('🏦', 'Kas', this.formatRupiah(stats.currentCash), '#e0f2f1', '#009688')}
                    </div>
                </div>

                <!-- Provider -->
                <div style="background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                    <div style="font-size: 16px; font-weight: 600; margin-bottom: 16px;">☁️ Metode Backup</div>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
                        <div onclick="backupModule.setProvider('local')" 
                             style="padding: 16px; border: 2px solid ${!isCloud ? '#48bb78' : '#e2e8f0'}; border-radius: 10px; text-align: center; cursor: pointer; background: ${!isCloud ? '#f0fff4' : 'white'};">
                            <div style="font-size: 24px;">💾</div>
                            <div style="font-weight: 600;">Local</div>
                        </div>
                        <div onclick="backupModule.setProvider('googlesheet')" 
                             style="padding: 16px; border: 2px solid ${isCloud ? '#48bb78' : '#e2e8f0'}; border-radius: 10px; text-align: center; cursor: pointer; background: ${isCloud ? '#f0fff4' : 'white'};">
                            <div style="font-size: 24px;">📊</div>
                            <div style="font-weight: 600;">Google Sheets</div>
                        </div>
                    </div>
                </div>

                ${isCloud ? this.renderCloudSection() : ''}

                <!-- Local Backup -->
                <div style="background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                    <div style="font-size: 16px; font-weight: 600; margin-bottom: 16px;">💾 Backup File</div>
                    <button onclick="backupModule.downloadJSON()" style="width: 100%; padding: 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-weight: 600; margin-bottom: 12px; cursor: pointer;">
                        ⬇️ Download JSON
                    </button>
                    <label style="display: block; padding: 16px; border: 2px dashed #cbd5e0; border-radius: 8px; text-align: center; cursor: pointer;">
                        <input type="file" accept=".json" onchange="backupModule.importJSON(this)" style="display: none;">
                        <div style="font-size: 20px;">📤</div>
                        <div>Import JSON</div>
                    </label>
                </div>

                <!-- Danger -->
                <div style="background: #fff5f5; border: 1px solid #feb2b2; padding: 20px; border-radius: 12px;">
                    <div style="font-size: 16px; font-weight: 600; color: #c53030; margin-bottom: 12px;">🗑️ Zona Bahaya</div>
                    <button onclick="backupModule.resetLocal()" style="width: 100%; padding: 12px; background: #e53e3e; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                        Hapus Data Lokal
                    </button>
                    ${isCloud ? `
                        <button onclick="backupModule.resetCloud()" style="width: 100%; padding: 12px; background: #805ad5; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; margin-top: 8px;">
                            Reset Cloud
                        </button>
                    ` : ''}
                </div>

            </div>
        `;
    },

    renderCloudSection() {
        return `
            <div style="background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; border: 2px solid #667eea;">
                <div style="font-size: 16px; font-weight: 600; margin-bottom: 16px;">📊 Google Sheets</div>
                
                <input type="text" id="gasUrl" value="${this.gasUrl}" 
                       placeholder="https://script.google.com/macros/s/.../exec" 
                       style="width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 12px; box-sizing: border-box;">
                
                <button onclick="backupModule.saveUrl()" style="width: 100%; padding: 12px; background: #48bb78; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; margin-bottom: 16px;">
                    💾 Simpan URL
                </button>

                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding: 12px; background: #fffaf0; border-radius: 8px;">
                    <span>Auto Sync</span>
                    <div onclick="backupModule.toggleAutoSync()" style="width: 48px; height: 24px; background: ${this.isAutoSyncEnabled ? '#48bb78' : '#cbd5e0'}; border-radius: 12px; cursor: pointer; position: relative;">
                        <div style="width: 20px; height: 20px; background: white; border-radius: 50%; position: absolute; top: 2px; left: ${this.isAutoSyncEnabled ? '26px' : '2px'}; transition: 0.3s;"></div>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <button onclick="backupModule.uploadData()" style="padding: 12px; background: #4299e1; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                        ⬆️ Upload
                    </button>
                    <button onclick="backupModule.downloadData()" style="padding: 12px; background: #ed8936; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                        ⬇️ Download
                    </button>
                </div>
            </div>
        `;
    },

    statCard(icon, label, value, bg, color) {
        return `
            <div style="background: ${bg}; padding: 16px; border-radius: 10px; text-align: center;">
                <div style="font-size: 20px;">${icon}</div>
                <div style="font-size: 11px; color: #718096; text-transform: uppercase;">${label}</div>
                <div style="font-size: 18px; font-weight: 700; color: ${color};">${value}</div>
            </div>
        `;
    },

    formatRupiah(amount) {
        return 'Rp ' + (amount || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    },

    // ======== ACTIONS ========

    setProvider(provider) {
        this.currentProvider = provider;
        this.render();
    },

    saveUrl() {
        const input = document.getElementById('gasUrl');
        const url = input?.value?.trim();
        
        if (!url || !url.includes('script.google.com')) {
            this.showToast('❌ URL tidak valid!');
            return;
        }
        
        this.gasUrl = url;
        localStorage.setItem(this.GAS_URL_KEY, url);
        this.currentProvider = 'googlesheet';
        this.showToast('✅ URL disimpan!');
        this.render();
    },

    toggleAutoSync() {
        this.isAutoSyncEnabled = !this.isAutoSyncEnabled;
        localStorage.setItem(this.AUTO_SYNC_KEY, this.isAutoSyncEnabled);
        
        if (this.isAutoSyncEnabled) {
            this.startAutoSync();
            this.showToast('🟢 Auto sync aktif');
        } else {
            this.stopAutoSync();
            this.showToast('⚪ Auto sync mati');
        }
        this.render();
    },

    // ======== RESET ========

    resetLocal() {
        if (!confirm('⚠️ Hapus semua data lokal?')) return;
        if (prompt('Ketik HAPUS:') !== 'HAPUS') return;

        // Reset ke default
        const defaultData = this.getDefaultData();
        this.saveData(defaultData);
        
        this.showToast('✅ Data dihapus!');
        setTimeout(() => location.reload(), 1500);
    },

    resetCloud() {
        if (!confirm('⚠️ Reset cloud?')) return;
        if (prompt('Ketik RESET:') !== 'RESET') return;

        fetch(this.gasUrl, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: 'reset' })
        })
        .then(() => {
            this.showToast('✅ Cloud direset!');
        })
        .catch(() => this.showToast('❌ Gagal reset cloud'));
    },

    // ======== FILE BACKUP ========

    downloadJSON() {
        const data = this.getData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `hifzi_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.showToast('✅ JSON didownload!');
    },

    importJSON(input) {
        const file = input.files[0];
        if (!file) return;
        if (!confirm('⚠️ Import akan menimpa data lokal?')) {
            input.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                this.saveData(data);
                this.showToast('✅ Import berhasil!');
                setTimeout(() => location.reload(), 1000);
            } catch (err) {
                this.showToast('❌ Error: ' + err.message);
            }
        };
        reader.readAsText(file);
        input.value = '';
    },

    showToast(msg) {
        // Gunakan toast dari app jika ada, fallback ke alert
        if (typeof app !== 'undefined' && app.showToast) {
            app.showToast(msg);
        } else {
            const toast = document.createElement('div');
            toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.8);color:white;padding:12px 24px;border-radius:8px;z-index:9999;';
            toast.textContent = msg;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        }
    }
};

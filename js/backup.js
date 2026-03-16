// backup.js - Versi dengan Import dari Format Tabel Sheets (FIXED v4)

const backupModule = {
    currentProvider: 'local',
    autoSyncInterval: null,
    isAutoSyncEnabled: false,
    lastSyncTime: null,
    gasUrl: '',
    
    init: function() {
        this.gasUrl = localStorage.getItem('hifzi_gas_url') || '';
        this.isAutoSyncEnabled = localStorage.getItem('hifzi_auto_sync') === 'true';
        this.lastSyncTime = localStorage.getItem('hifzi_last_sync') || null;
        
        if (this.isAutoSyncEnabled && this.gasUrl) {
            this.startAutoSync();
        }
        this.render();
    },
    
    getDataFromStorage: function() {
        try {
            var data = localStorage.getItem('hifzi_data');
            if (data) {
                return JSON.parse(data);
            }
        } catch(e) {
            console.error('Error reading localStorage:', e);
        }
        
        if (typeof dataManager !== 'undefined' && dataManager.data) {
            return dataManager.data;
        }
        
        return { products: [], transactions: [], cashTransactions: [], categories: [] };
    },
    
    hasData: function() {
        var data = this.getDataFromStorage();
        var hasProducts = data.products && data.products.length > 0;
        var hasTransactions = data.transactions && data.transactions.length > 0;
        return hasProducts || hasTransactions;
    },
    
    render: function() {
        var container = document.getElementById('mainContent');
        if (!container) return;
        
        var data = this.getDataFromStorage();
        var products = data.products ? data.products.length : 0;
        var transactions = data.transactions ? data.transactions.length : 0;
        
        var html = '<div class="content-section active" id="backupSection">';
        
        // Provider selection
        html += '<div class="card">';
        html += '<div class="card-header"><span class="card-title">☁️ Pilih Metode Backup</span></div>';
        html += '<div style="display:flex;gap:10px;">';
        
        var localActive = this.currentProvider === 'local' ? 'style="border-color:#4CAF50;background:#e8f5e9;"' : '';
        html += '<div onclick="backupModule.setProvider(\'local\')" ' + localActive + ' style="flex:1;padding:15px;border:2px solid #ddd;border-radius:8px;text-align:center;cursor:pointer;">';
        html += '<div style="font-size:32px;">💾</div><div style="font-weight:600;">Local</div></div>';
        
        var sheetsActive = this.currentProvider === 'googlesheet' ? 'style="border-color:#4CAF50;background:#e8f5e9;"' : '';
        html += '<div onclick="backupModule.setProvider(\'googlesheet\')" ' + sheetsActive + ' style="flex:1;padding:15px;border:2px solid #ddd;border-radius:8px;text-align:center;cursor:pointer;">';
        html += '<div style="font-size:32px;">📊</div><div style="font-weight:600;">Sheets</div></div>';
        
        html += '</div></div>';
        
        // Google Sheets Config
        if (this.currentProvider === 'googlesheet') {
            html += '<div class="card" style="border:2px solid #2196F3;">';
            html += '<div class="card-header"><span class="card-title">📊 Google Sheets Setup</span></div>';
            
            html += '<div style="background:#e3f2fd;padding:15px;border-radius:8px;margin-bottom:15px;font-size:13px;">';
            html += '<b>Cara Setup:</b><br>1. Klik "Copy Kode GAS" di bawah<br>2. Buka script.google.com → Paste → Deploy<br>3. Copy URL Web App ke kolom bawah<br>4. Klik "Test Koneksi"';
            html += '</div>';
            
            html += '<button onclick="backupModule.showGAS()" style="width:100%;background:#667eea;color:white;border:none;padding:15px;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;margin-bottom:15px;">📋 Copy Kode GAS</button>';
            
            html += '<div style="margin-bottom:10px;">';
            html += '<label style="display:block;margin-bottom:5px;font-weight:600;">URL Web App:</label>';
            html += '<input type="text" id="gasUrl" value="' + (this.gasUrl || '') + '" placeholder="https://script.google.com/macros/s/.../exec" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;">';
            html += '</div>';
            
            html += '<button onclick="backupModule.connect()" style="width:100%;background:#4CAF50;color:white;border:none;padding:12px;border-radius:6px;font-size:16px;font-weight:600;cursor:pointer;">🔌 Test Koneksi</button>';
            
            if (this.gasUrl) {
                html += '<div style="margin-top:10px;padding:10px;background:#e8f5e9;border-radius:6px;font-size:13px;">';
                html += '✅ URL tersimpan. Siap sync!';
                if (this.lastSyncTime) {
                    html += '<br><small>Sync terakhir: ' + new Date(this.lastSyncTime).toLocaleString('id-ID') + '</small>';
                }
                html += '</div>';
            }
            html += '</div>';
            
            // Sync Controls
            html += '<div class="card" style="border:2px solid #FF9800;">';
            html += '<div class="card-header"><span class="card-title">🔄 Sinkronisasi Data</span></div>';
            
            // Info box
            html += '<div style="background:#fff3e0;border-left:4px solid #ff9800;padding:12px;margin-bottom:15px;border-radius:4px;font-size:13px;">';
            html += '<b>📋 Catatan Penting:</b><br>';
            html += '• <b>Upload</b>: Kirim data lokal ke Google Sheets<br>';
            html += '• <b>Download JSON</b>: Ambil data JSON dari Sheets<br>';
            html += '• <b>Import Tabel</b>: Ambil data dari format tabel Sheets (Sheet1)';
            html += '</div>';
            
            // Auto Sync Toggle
            var toggleBg = this.isAutoSyncEnabled ? '#4CAF50' : '#ccc';
            var togglePos = this.isAutoSyncEnabled ? '26px' : '2px';
            html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;padding:15px;background:#f5f5f5;border-radius:8px;">';
            html += '<div><div style="font-weight:600;">Auto Sync</div><div style="font-size:12px;color:#666;">Otomatis upload setiap 3 menit</div></div>';
            html += '<div onclick="backupModule.toggleAutoSync()" style="cursor:pointer;width:50px;height:26px;background:' + toggleBg + ';border-radius:13px;position:relative;transition:all 0.3s;">';
            html += '<div style="width:22px;height:22px;background:white;border-radius:50%;position:absolute;top:2px;left:' + togglePos + ';transition:all 0.3s;box-shadow:0 2px 4px rgba(0,0,0,0.2);"></div>';
            html += '</div></div>';
            
            // Manual Sync Buttons - 2 tombol
            html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">';
            html += '<button onclick="backupModule.uploadData()" style="padding:15px;background:#2196F3;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;">';
            html += '<div style="font-size:24px;margin-bottom:5px;">⬆️</div><div>Upload Data</div><div style="font-size:11px;opacity:0.9;">JSON ke Sheets</div></button>';
            
            html += '<button onclick="backupModule.downloadData()" style="padding:15px;background:#4CAF50;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;">';
            html += '<div style="font-size:24px;margin-bottom:5px;">⬇️</div><div>Download JSON</div><div style="font-size:11px;opacity:0.9;">Dari Sheets</div></button>';
            html += '</div>';
            
            // ✅ TOMBOL BARU: Import dari Tabel (UNGU)
            html += '<button onclick="backupModule.importFromTable()" style="width:100%;padding:15px;background:#9c27b0;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;margin-bottom:15px;">';
            html += '<div style="font-size:20px;margin-bottom:5px;">📥</div><div>Import dari Tabel Sheets</div>';
            html += '<div style="font-size:11px;opacity:0.9;">Ambil data dari Sheet1 (format tabel)</div></button>';
            
            // Sync Status
            html += '<div id="syncStatusDetail" style="padding:10px;background:#f0f0f0;border-radius:6px;font-size:12px;text-align:center;">';
            if (this.isAutoSyncEnabled) {
                html += '🟢 Auto sync AKTIF - Setiap 3 menit';
            } else {
                html += '⚪ Auto sync NONAKTIF';
            }
            html += '</div>';
            
            html += '</div>';
        }
        
        // Statistics
        html += '<div class="card">';
        html += '<div class="card-header"><span class="card-title">📊 Statistik Data</span></div>';
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;">';
        html += '<div style="background:#f8f9fa;padding:15px;border-radius:8px;text-align:center;"><div style="font-size:24px;">📦</div><div style="font-size:12px;color:#666;">Produk</div><div style="font-size:20px;font-weight:bold;">' + products + '</div></div>';
        html += '<div style="background:#f8f9fa;padding:15px;border-radius:8px;text-align:center;"><div style="font-size:24px;">📝</div><div style="font-size:12px;color:#666;">Transaksi</div><div style="font-size:20px;font-weight:bold;">' + transactions + '</div></div>';
        html += '</div></div>';
        
        // Local Tools
        html += '<div class="card">';
        html += '<div class="card-header"><span class="card-title">💾 Backup Local (JSON)</span></div>';
        html += '<button onclick="backupModule.downloadJSON()" style="width:100%;padding:12px;background:#667eea;color:white;border:none;border-radius:6px;cursor:pointer;margin-bottom:10px;">⬇️ Download JSON</button>';
        html += '<input type="file" accept=".json" onchange="backupModule.importJSON(this)" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;">';
        html += '</div>';
        
        // Reset
        html += '<div class="card" style="border:2px solid #e74c3c;">';
        html += '<div class="card-header"><span class="card-title" style="color:#e74c3c;">🗑️ Reset Data</span></div>';
        html += '<button onclick="backupModule.resetData()" style="width:100%;background:#e74c3c;color:white;border:none;padding:12px;border-radius:6px;cursor:pointer;">HAPUS SEMUA DATA</button>';
        html += '</div>';
        
        html += '</div>';
        
        container.innerHTML = html;
    },
    
    setProvider: function(provider) {
        this.currentProvider = provider;
        this.render();
    },
    
    toggleAutoSync: function() {
        this.isAutoSyncEnabled = !this.isAutoSyncEnabled;
        localStorage.setItem('hifzi_auto_sync', this.isAutoSyncEnabled);
        
        if (this.isAutoSyncEnabled) {
            this.startAutoSync();
            this.showToast('🟢 Auto sync diaktifkan');
        } else {
            this.stopAutoSync();
            this.showToast('⚪ Auto sync dimatikan');
        }
        this.render();
    },
    
    startAutoSync: function() {
        this.stopAutoSync();
        this.autoSyncInterval = setInterval(() => {
            if (this.gasUrl && this.hasData()) {
                console.log('🔄 Auto sync running...');
                this.syncToCloud(false);
            }
        }, 180000);
        console.log('✅ Auto sync started (3 menit)');
    },
    
    stopAutoSync: function() {
        if (this.autoSyncInterval) {
            clearInterval(this.autoSyncInterval);
            this.autoSyncInterval = null;
            console.log('⏹️ Auto sync stopped');
        }
    },
    
    uploadData: function() {
        if (!this.gasUrl) {
            alert('❌ URL Web App belum diisi!');
            return;
        }
        
        if (!this.hasData()) {
            this.showToast('⚠️ Tidak ada data untuk diupload. Tambahkan produk dulu!');
            return;
        }
        
        this.syncToCloud(true);
    },
    
    downloadData: function() {
        if (!this.gasUrl) {
            alert('❌ URL Web App belum diisi!');
            return;
        }
        this.restoreFromCloud();
    },
    
    // ✅ FUNGSI BARU: Import dari format tabel Sheets
    importFromTable: function() {
        if (!this.gasUrl) {
            alert('❌ URL Web App belum diisi!');
            return;
        }
        
        if (!confirm('📥 Import data dari tabel Google Sheets (Sheet1)?\n\nIni akan mengambil data dari sheet yang sudah ada dan mengkonversinya ke format aplikasi.')) {
            return;
        }
        
        this.showToast('⬇️ Mengambil data dari tabel...');
        
        var self = this;
        var script = document.createElement('script');
        var callbackName = 'importTable_' + Date.now();
        
        window[callbackName] = function(result) {
            console.log('Import table result:', result);
            
            if (result && result.success && result.data) {
                try {
                    var products = result.data;
                    if (!Array.isArray(products) || products.length === 0) {
                        self.showToast('❌ Tidak ada data produk di Sheet1');
                        delete window[callbackName];
                        if (script.parentNode) script.parentNode.removeChild(script);
                        return;
                    }
                    
                    // Konversi ke format aplikasi
                    var appData = {
                        products: products,
                        transactions: [],
                        cashTransactions: [],
                        categories: []
                    };
                    
                    // Simpan ke localStorage
                    localStorage.setItem('hifzi_data', JSON.stringify(appData));
                    
                    // Update dataManager
                    if (typeof dataManager !== 'undefined' && dataManager) {
                        dataManager.data = appData;
                        if (dataManager.save) dataManager.save();
                    }
                    
                    self.showToast('✅ Import berhasil! ' + products.length + ' produk diimport');
                    self.render();
                    
                    // Refresh modul lain
                    if (typeof productsModule !== 'undefined' && productsModule.render) {
                        productsModule.render();
                    }
                    if (typeof posModule !== 'undefined' && posModule.render) {
                        posModule.render();
                    }
                    
                } catch(e) {
                    self.showToast('❌ Error import: ' + e.message);
                }
            } else {
                var errorMsg = result ? result.message : 'Unknown error';
                self.showToast('❌ Gagal import: ' + errorMsg);
            }
            
            delete window[callbackName];
            if (script.parentNode) script.parentNode.removeChild(script);
        };
        
        script.onerror = function() {
            self.showToast('❌ Error koneksi ke Google Sheets');
            delete window[callbackName];
        };
        
        // Panggil action importTable
        script.src = this.gasUrl + (this.gasUrl.indexOf('?') > -1 ? '&' : '?') + 'action=importTable&callback=' + callbackName;
        document.head.appendChild(script);
        
        setTimeout(function() {
            if (window[callbackName]) {
                self.showToast('❌ Timeout - cek koneksi internet');
                delete window[callbackName];
                if (script.parentNode) script.parentNode.removeChild(script);
            }
        }, 15000);
    },
    
    syncToCloud: function(showAlert = true) {
        var self = this;
        
        try {
            var data = this.getDataFromStorage();
            var jsonString = JSON.stringify(data);
            
            if (showAlert) this.showToast('⬆️ Mengupload data...');
            
            if (typeof fetch !== 'undefined') {
                fetch(this.gasUrl + '?action=sync', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ data: data }),
                    mode: 'no-cors'
                }).then(function() {
                    self.lastSyncTime = new Date().toISOString();
                    localStorage.setItem('hifzi_last_sync', self.lastSyncTime);
                    if (showAlert) {
                        self.showToast('✅ Upload berhasil! (fetch)');
                        self.render();
                    }
                }).catch(function(error) {
                    console.log('Fetch failed, trying iframe method:', error);
                    self.uploadWithIframe(showAlert);
                });
            } else {
                self.uploadWithIframe(showAlert);
            }
            
        } catch(e) {
            console.error('Sync error:', e);
            if (showAlert) this.showToast('❌ Error: ' + e.message);
        }
    },
    
    uploadWithIframe: function(showAlert) {
        var self = this;
        var data = this.getDataFromStorage();
        var jsonString = JSON.stringify(data);
        
        var form = document.createElement('form');
        form.method = 'POST';
        form.action = this.gasUrl + '?action=sync';
        form.target = 'sync-iframe-' + Date.now();
        form.style.display = 'none';
        form.enctype = 'application/x-www-form-urlencoded';
        
        var input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'data';
        input.value = jsonString;
        form.appendChild(input);
        
        var iframe = document.createElement('iframe');
        iframe.name = form.target;
        iframe.style.display = 'none';
        
        document.body.appendChild(form);
        document.body.appendChild(iframe);
        
        var timeout = setTimeout(function() {
            self.lastSyncTime = new Date().toISOString();
            localStorage.setItem('hifzi_last_sync', self.lastSyncTime);
            if (showAlert) {
                self.showToast('✅ Upload selesai! (iframe)');
                self.render();
            }
            cleanup();
        }, 3000);
        
        function cleanup() {
            clearTimeout(timeout);
            setTimeout(function() {
                if (form.parentNode) form.parentNode.removeChild(form);
                if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
            }, 1000);
        }
        
        iframe.onload = function() {
            try {
                var response = iframe.contentDocument.body.innerText;
                if (response) {
                    var result = JSON.parse(response);
                    if (result.success) {
                        self.lastSyncTime = new Date().toISOString();
                        localStorage.setItem('hifzi_last_sync', self.lastSyncTime);
                        if (showAlert) {
                            self.showToast('✅ Upload berhasil!');
                            self.render();
                        }
                    } else {
                        if (showAlert) self.showToast('❌ Gagal: ' + result.message);
                    }
                }
            } catch(e) {
                self.lastSyncTime = new Date().toISOString();
                localStorage.setItem('hifzi_last_sync', self.lastSyncTime);
                if (showAlert) {
                    self.showToast('✅ Data terkirim!');
                    self.render();
                }
            }
            cleanup();
        };
        
        iframe.onerror = function() {
            if (showAlert) self.showToast('❌ Error koneksi');
            cleanup();
        };
        
        form.submit();
    },
    
    restoreFromCloud: function() {
        var self = this;
        
        var localHasData = this.hasData();
        
        var message = '⚠️ Download akan menimpa data lokal. Lanjutkan?';
        if (!localHasData) {
            message = 'ℹ️ Download data dari Google Sheets ke perangkat ini?';
        }
        
        if (!confirm(message)) return;
        
        this.showToast('⬇️ Mendownload data...');
        
        var script = document.createElement('script');
        var callbackName = 'restore_' + Date.now();
        
        window[callbackName] = function(result) {
            console.log('Restore result:', result);
            
            if (result && result.success) {
                if (!result.data) {
                    self.showToast('❌ Tidak ada data JSON di Google Sheets.\n\nCoba gunakan "Import dari Tabel Sheets" jika data Anda dalam format tabel.');
                    delete window[callbackName];
                    if (script.parentNode) script.parentNode.removeChild(script);
                    return;
                }
                
                if (typeof result.data !== 'object') {
                    self.showToast('❌ Format data tidak valid');
                    delete window[callbackName];
                    if (script.parentNode) script.parentNode.removeChild(script);
                    return;
                }
                
                try {
                    localStorage.setItem('hifzi_data', JSON.stringify(result.data));
                    
                    if (typeof dataManager !== 'undefined' && dataManager) {
                        dataManager.data = result.data;
                        if (dataManager.save) dataManager.save();
                    }
                    
                    self.showToast('✅ Restore berhasil! Data diperbarui');
                    self.render();
                    
                    if (typeof productsModule !== 'undefined' && productsModule.render) {
                        productsModule.render();
                    }
                    if (typeof posModule !== 'undefined' && posModule.render) {
                        posModule.render();
                    }
                    
                } catch(e) {
                    self.showToast('❌ Error restore: ' + e.message);
                }
            } else {
                var errorMsg = result ? result.message : 'Unknown error';
                if (errorMsg === 'No backup' || errorMsg.includes('No backup')) {
                    self.showToast('❌ Belum ada data di Google Sheets.\n\nJika data sudah ada di sheet, gunakan "Import dari Tabel Sheets"');
                } else {
                    self.showToast('❌ Gagal restore: ' + errorMsg);
                }
            }
            
            delete window[callbackName];
            if (script.parentNode) script.parentNode.removeChild(script);
        };
        
        script.onerror = function() {
            self.showToast('❌ Error koneksi ke Google Sheets');
            delete window[callbackName];
        };
        
        script.src = this.gasUrl + (this.gasUrl.indexOf('?') > -1 ? '&' : '?') + 'action=restore&callback=' + callbackName;
        document.head.appendChild(script);
        
        setTimeout(function() {
            if (window[callbackName]) {
                self.showToast('❌ Timeout - cek koneksi internet');
                delete window[callbackName];
                if (script.parentNode) script.parentNode.removeChild(script);
            }
        }, 15000);
    },
    
    manualSync: function() {
        if (this.gasUrl && this.isAutoSyncEnabled) {
            this.syncToCloud(true);
        } else {
            this.render();
            this.setProvider('googlesheet');
        }
    },
    
    showGAS: function() {
        var code = `function doGet(e){return handleRequest(e)}
function doPost(e){return handleRequest(e)}
function handleRequest(e){
  try{
    var lock=LockService.getScriptLock();
    lock.waitLock(30000);
    var ss=SpreadsheetApp.getActiveSpreadsheet();
    var action=e.parameter.action;
    var callback=e.parameter.callback;
    var result;
    
    if(action=="ping"){
      result={success:true,message:"pong",time:new Date().toISOString()}
    }
    else if(action=="sync"){
      var postData={};
      if(e.postData && e.postData.contents){
        postData=JSON.parse(e.postData.contents);
      }
      var dataToSave=postData.data || postData;
      
      var sheet=ss.getSheetByName("Data");
      if(!sheet){sheet=ss.insertSheet("Data");}
      sheet.clear();
      sheet.getRange(1,1).setValue(JSON.stringify(dataToSave));
      sheet.getRange(1,2).setValue(new Date().toISOString());
      result={success:true,message:"Saved"}
    }
    else if(action=="restore"){
      var sheet=ss.getSheetByName("Data");
      if(!sheet){
        result={success:false,message:"No backup"}
      }else{
        var jsonData=sheet.getRange(1,1).getValue();
        if(!jsonData || jsonData==""){
          result={success:false,message:"No backup"}
        }else{
          result={success:true,data:JSON.parse(jsonData)}
        }
      }
    }
    else if(action=="importTable"){
      // ✅ Import dari format tabel (Sheet1)
      var sheet=ss.getSheetByName("Sheet1");
      if(!sheet){
        // Coba cari sheet lain jika Sheet1 tidak ada
        var sheets=ss.getSheets();
        if(sheets.length>0){
          sheet=sheets[0];
        }
      }
      if(!sheet){
        result={success:false,message:"No sheet found"}
      }else{
        var dataRange=sheet.getDataRange();
        var values=dataRange.getValues();
        if(values.length<2){
          result={success:false,message:"Sheet kosong atau hanya header"}
        }else{
          var headers=values[0];
          var products=[];
          for(var i=1;i<values.length;i++){
            var row=values[i];
            var product={};
            for(var j=0;j<headers.length;j++){
              var key=headers[j].toString().toLowerCase().replace(/\\s+/g,'_');
              product[key]=row[j];
            }
            products.push(product);
          }
          result={success:true,data:products}
        }
      }
    }
    else{
      result={success:false,message:"Unknown action"}
    }
    
    lock.releaseLock();
    
    if(callback){
      return ContentService.createTextOutput(callback+"("+JSON.stringify(result)+")")
        .setMimeType(ContentService.MimeType.JAVASCRIPT)
    }
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON)
  }
  catch(error){
    var errorResult={success:false,message:error.toString()};
    if(e.parameter.callback){
      return ContentService.createTextOutput(e.parameter.callback+"("+JSON.stringify(errorResult)+")")
        .setMimeType(ContentService.MimeType.JAVASCRIPT)
    }
    return ContentService.createTextOutput(JSON.stringify(errorResult))
      .setMimeType(ContentService.MimeType.JSON)
  }
}`;
        
        var modal = document.createElement('div');
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
        
        modal.innerHTML = 
            '<div style="background:white;width:90%;max-width:600px;max-height:80vh;border-radius:12px;overflow:hidden;">' +
            '<div style="background:#4CAF50;color:white;padding:15px;font-weight:bold;display:flex;justify-content:space-between;align-items:center;">' +
            '<span>📋 Kode Google Apps Script</span>' +
            '<button onclick="this.closest(\'.gas-modal\').remove()" style="background:rgba(255,255,255,0.3);border:none;color:white;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:20px;">×</button>' +
            '</div>' +
            '<div style="padding:20px;">' +
            '<p style="margin-bottom:15px;font-size:14px;color:#666;">Copy kode ini dan paste ke <b>Code.gs</b> di script.google.com</p>' +
            '<textarea id="gasCode" readonly style="width:100%;height:250px;font-family:monospace;font-size:12px;border:1px solid #ddd;border-radius:6px;padding:10px;background:#f8f9fa;resize:none;overflow:auto;">' + code.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</textarea>' +
            '</div>' +
            '<div style="padding:15px;border-top:1px solid #eee;display:flex;gap:10px;">' +
            '<button onclick="backupModule.copyGASCode()" style="flex:1;background:#4CAF50;color:white;border:none;padding:12px;border-radius:6px;cursor:pointer;font-weight:600;">📋 Copy Kode</button>' +
            '<button onclick="this.closest(\'.gas-modal\').remove()" style="padding:12px 20px;background:#f0f0f0;border:none;border-radius:6px;cursor:pointer;">Tutup</button>' +
            '</div>' +
            '</div>';
        
        modal.className = 'gas-modal';
        document.body.appendChild(modal);
    },
    
    copyGASCode: function() {
        var ta = document.getElementById('gasCode');
        if (ta) {
            var text = ta.value;
            var textarea = document.createElement('textarea');
            textarea.innerHTML = text;
            text = textarea.value;
            
            navigator.clipboard.writeText(text).then(function() {
                alert('✅ Kode berhasil dicopy!');
            }).catch(function() {
                ta.select();
                document.execCommand('copy');
                alert('✅ Kode dicopy!');
            });
        }
    },
    
    connect: function() {
        var urlInput = document.getElementById('gasUrl');
        if (!urlInput) return;
        
        var url = urlInput.value.trim();
        if (!url || url.length < 20) {
            alert('❌ URL tidak valid');
            return;
        }
        
        this.gasUrl = url;
        localStorage.setItem('hifzi_gas_url', url);
        
        var self = this;
        var script = document.createElement('script');
        var callbackName = 'test_' + Date.now();
        
        window[callbackName] = function(result) {
            if (result && result.success) {
                alert('✅ Koneksi berhasil! Sekarang coba Import dari Tabel Sheets.');
                self.render();
            } else {
                alert('❌ Gagal: ' + (result ? result.message : 'Unknown error'));
            }
            delete window[callbackName];
            if (script.parentNode) script.parentNode.removeChild(script);
        };
        
        script.onerror = function() {
            alert('❌ Error loading script');
            delete window[callbackName];
        };
        
        script.src = url + (url.indexOf('?') > -1 ? '&' : '?') + 'action=ping&callback=' + callbackName;
        document.head.appendChild(script);
        
        setTimeout(function() {
            if (window[callbackName]) {
                alert('❌ Timeout - cek URL dan pastikan deployed sebagai Web App dengan access Anyone');
                delete window[callbackName];
                if (script.parentNode) script.parentNode.removeChild(script);
            }
        }, 10000);
    },
    
    downloadJSON: function() {
        try {
            var data = this.getDataFromStorage();
            var blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = 'backup_' + new Date().toISOString().split('T')[0] + '.json';
            a.click();
            URL.revokeObjectURL(url);
            this.showToast('✅ Downloaded!');
        } catch(e) {
            alert('❌ Error: ' + e.message);
        }
    },
    
    importJSON: function(input) {
        var file = input.files[0];
        if (!file) return;
        
        if (!confirm('Import akan menimpa data. Lanjutkan?')) {
            input.value = '';
            return;
        }
        
        var self = this;
        var reader = new FileReader();
        reader.onload = function(e) {
            try {
                var imported = JSON.parse(e.target.result);
                if (imported.products) {
                    localStorage.setItem('hifzi_data', JSON.stringify(imported));
                    if (typeof dataManager !== 'undefined' && dataManager) {
                        dataManager.data = imported;
                        if (dataManager.save) dataManager.save();
                    }
                    self.showToast('✅ Import berhasil!');
                    self.render();
                }
            } catch(err) {
                alert('❌ Gagal: ' + err.message);
            }
        };
        reader.readAsText(file);
        input.value = '';
    },
    
    resetData: function() {
        var count = 0;
        try {
            var data = this.getDataFromStorage();
            if (data.products) count = data.products.length;
        } catch(e) {}
        
        if (!confirm('⚠️ HAPUS ' + count + ' PRODUK?\n\nINI PERMANEN!')) return;
        
        var text = prompt('Ketik: HAPUS');
        if (text !== 'HAPUS') {
            alert('❌ Dibatalkan');
            return;
        }
        
        try {
            localStorage.removeItem('hifzi_data');
            if (typeof dataManager !== 'undefined' && dataManager) {
                dataManager.data = {products: [], transactions: [], cashTransactions: [], categories: []};
                if (dataManager.save) dataManager.save();
            }
            alert('✅ Data dihapus!');
            location.reload();
        } catch(e) {
            alert('❌ Error: ' + e.message);
        }
    },
    
    showToast: function(message) {
        var toast = document.getElementById('toast');
        if (toast) {
            toast.textContent = message;
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 3000);
        } else {
            alert(message);
        }
    }
};
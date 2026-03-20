const receiptModule = {
    receiptType: 'transfer',
    scannedData: null,
    ocrWorker: null,
    isProcessing: false,
    workerReady: false,
    currentReceiptData: null, // Untuk tracking data struk yang sedang dibuat

    init() {
        this.renderHTML();
        setTimeout(() => this.checkAndInitWorker(), 500);
        
        // Render Bluetooth Control setelah HTML dirender
        setTimeout(() => {
            if (typeof bluetoothModule !== 'undefined') {
                bluetoothModule.renderBluetoothControl('bluetoothControlReceipt', {
                    context: 'receipt',
                    showPrintButton: true
                });
            }
        }, 100);
    },

    async checkAndInitWorker() {
        console.log('Checking Tesseract...');

        if (typeof Tesseract === 'undefined') {
            console.error('Tesseract not found!');
            this.updateStatus('❌ Library OCR tidak ditemukan. Pastikan ada koneksi internet.', 'error');
            return;
        }

        console.log('Tesseract found:', Tesseract);
        await this.initializeWorker();
    },

    async initializeWorker() {
        try {
            this.updateStatus('⏳ Loading model OCR...', 'loading');

            this.ocrWorker = await Tesseract.createWorker();

            await this.ocrWorker.loadLanguage('ind');
            await this.ocrWorker.initialize('ind');

            this.workerReady = true;
            this.updateStatus('✅ OCR siap! Upload gambar bukti transfer.', 'ready');
            console.log('✅ Worker ready');

        } catch (error) {
            console.error('Worker init error:', error);
            this.updateStatus('❌ Gagal load OCR: ' + error.message, 'error');

            try {
                console.log('Trying English...');
                this.updateStatus('⏳ Mencoba bahasa Inggris...', 'loading');
                this.ocrWorker = await Tesseract.createWorker('eng');
                this.workerReady = true;
                this.updateStatus('✅ OCR siap (English)!', 'ready');
            } catch (e2) {
                this.updateStatus('❌ OCR gagal: ' + e2.message, 'error');
            }
        }
    },

    updateStatus(message, type) {
        const statusText = document.getElementById('ocrStatusText');
        const infoBox = document.getElementById('ocrInfoBox');

        if (statusText) statusText.textContent = message;
        if (infoBox) {
            infoBox.className = 'info-box ' + (type === 'error' ? 'warning' : 'info');
        }
    },

    renderHTML() {
        const header = dataManager.data.settings.receiptHeader || {};

        document.getElementById('mainContent').innerHTML = `
            <div class="content-section active" id="receiptSection">
                <!-- BLUETOOTH CONTROL PANEL -->
                <div id="bluetoothControlReceipt"></div>

                <div class="card">
                    <div class="card-header">
                        <span class="card-title">🧾 Pengaturan Header Struk</span>
                    </div>

                    <div class="info-box warning">
                        <div class="info-title">Header Struk</div>
                        <div class="info-text">Atur header yang muncul di setiap struk cetak.</div>
                    </div>

                    <div class="form-group">
                        <label>Nama Konter *</label>
                        <input type="text" id="receiptStoreName" value="${header.storeName || ''}" placeholder="Contoh: Hifzi Cell">
                    </div>

                    <div class="form-group">
                        <label>Alamat *</label>
                        <textarea id="receiptAddress" rows="2" placeholder="Alamat lengkap...">${header.address || ''}</textarea>
                    </div>

                    <div class="form-group">
                        <label>Nomor HP</label>
                        <input type="text" id="receiptPhone" value="${header.phone || ''}" placeholder="0812-3456-7890">
                    </div>

                    <div class="form-group">
                        <label>Catatan Footer</label>
                        <textarea id="receiptNote" rows="2" placeholder="Terima kasih...">${header.note || ''}</textarea>
                    </div>

                    <div style="margin-bottom: 15px;">
                        <label style="font-weight: 600; font-size: 14px; margin-bottom: 8px; display: block;">Preview:</label>
                        <div class="receipt-preview" id="receiptPreview" style="background: #f8f9fa; border: 2px dashed #ddd; padding: 15px; font-family: monospace; white-space: pre-wrap; font-size: 12px;"></div>
                    </div>

                    <button class="btn btn-primary" onclick="receiptModule.saveHeader()" style="width: 100%;">💾 Simpan</button>
                </div>

                <div class="card">
                    <div class="card-header">
                        <span class="card-title">📸 Baca Bukti Transfer (OCR)</span>
                    </div>

                    <div class="info-box info" id="ocrInfoBox">
                        <div class="info-title">📖 Status OCR</div>
                        <div class="info-text" id="ocrStatusText">⏳ Memeriksa library...</div>
                    </div>

                    <div class="ocr-upload-area" id="ocrUploadArea" style="border: 3px dashed #ccc; border-radius: 16px; padding: 40px 20px; text-align: center; background: #fafafa; cursor: pointer; transition: all 0.3s; margin-bottom: 20px;">
                        <div style="font-size: 48px; margin-bottom: 10px;">📷</div>
                        <div style="font-weight: 600; color: #666; margin-bottom: 5px;">Klik atau Drop Gambar</div>
                        <div style="font-size: 12px; color: #999;">JPG, PNG (Max 5MB)</div>
                        <input type="file" id="ocrFileInput" accept="image/*" style="display: none;">
                    </div>

                    <div id="ocrLoading" style="display: none; text-align: center; padding: 40px;">
                        <div style="width: 50px; height: 50px; border: 4px solid #f3f3f3; border-top: 4px solid var(--primary); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 15px;"></div>
                        <div style="color: #666;">Membaca...</div>
                        <div style="font-size: 12px; color: #999; margin-top: 10px;" id="ocrProgress">0%</div>
                    </div>

                    <div id="ocrResultSection" style="display: none;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                            <div>
                                <label style="font-weight: 600; font-size: 12px; color: #666; margin-bottom: 8px; display: block;">Gambar:</label>
                                <img id="ocrPreviewImage" style="width: 100%; border-radius: 12px; border: 2px solid #eee; max-height: 300px; object-fit: contain;">
                            </div>
                            <div>
                                <label style="font-weight: 600; font-size: 12px; color: #666; margin-bottom: 8px; display: block;">Hasil:</label>
                                <div id="ocrParsedData" style="background: #f0f8ff; border: 1px solid #4a90e2; border-radius: 12px; padding: 15px; font-size: 13px; line-height: 1.6; max-height: 300px; overflow-y: auto;">
                                    Membaca...
                                </div>
                            </div>
                        </div>

                        <div style="display: flex; gap: 10px;">
                            <button class="btn btn-primary" onclick="receiptModule.applyOcrToForm()" style="flex: 1;">✅ Gunakan</button>
                            <button class="btn btn-secondary" onclick="receiptModule.resetOcr()" style="flex: 1;">🔄 Ulang</button>
                        </div>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <span class="card-title">📝 Input Manual</span>
                    </div>

                    <div class="receipt-type-tabs" style="display: flex; gap: 10px; margin-bottom: 20px; background: #f5f5f5; padding: 5px; border-radius: 12px;">
                        <button class="receipt-type-tab active" onclick="receiptModule.setType('transfer')" data-type="transfer" style="flex: 1; padding: 12px; border: none; background: white; border-radius: 8px; font-weight: 600; cursor: pointer;">🏦 Transfer</button>
                        <button class="receipt-type-tab" onclick="receiptModule.setType('tarik_tunai')" data-type="tarik_tunai" style="flex: 1; padding: 12px; border: none; background: transparent; border-radius: 8px; font-weight: 600; cursor: pointer; color: #666;">🏧 Tarik Tunai</button>
                        <button class="receipt-type-tab" onclick="receiptModule.setType('top_up')" data-type="top_up" style="flex: 1; padding: 12px; border: none; background: transparent; border-radius: 8px; font-weight: 600; cursor: pointer; color: #666;">💜 Top Up</button>
                    </div>

                    <div id="receiptFormContainer">${this.renderTransferForm()}</div>
                </div>
            </div>
        `;

        this.setupEventListeners();
        this.updatePreview();
    },

    setupEventListeners() {
        ['receiptStoreName', 'receiptAddress', 'receiptPhone', 'receiptNote'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', () => this.updatePreview());
        });

        const fileInput = document.getElementById('ocrFileInput');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) this.processImage(e.target.files[0]);
            });
        }

        const uploadArea = document.getElementById('ocrUploadArea');
        if (uploadArea) {
            uploadArea.addEventListener('click', () => {
                document.getElementById('ocrFileInput').click();
            });
        }

        if (uploadArea) {
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                uploadArea.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                });
            });

            ['dragenter', 'dragover'].forEach(eventName => {
                uploadArea.addEventListener(eventName, () => {
                    uploadArea.style.borderColor = 'var(--primary)';
                    uploadArea.style.background = '#f0f8ff';
                });
            });

            ['dragleave', 'drop'].forEach(eventName => {
                uploadArea.addEventListener(eventName, () => {
                    uploadArea.style.borderColor = '#ccc';
                    uploadArea.style.background = '#fafafa';
                });
            });

            uploadArea.addEventListener('drop', (e) => {
                const files = e.dataTransfer.files;
                if (files.length > 0) this.processImage(files[0]);
            });
        }
    },

    async processImage(file) {
        if (this.isProcessing) {
            app.showToast('⏳ Masih memproses...');
            return;
        }

        if (!this.workerReady) {
            app.showToast('❌ OCR belum siap. Tunggu sebentar...');
            return;
        }

        if (!file.type.startsWith('image/')) {
            app.showToast('❌ File harus gambar!');
            return;
        }

        this.isProcessing = true;

        document.getElementById('ocrUploadArea').style.display = 'none';
        document.getElementById('ocrLoading').style.display = 'block';
        document.getElementById('ocrProgress').textContent = 'Membaca gambar...';

        try {
            const imageData = await this.readFileAsDataURL(file);
            document.getElementById('ocrPreviewImage').src = imageData;

            await this.performOCR(imageData);

        } catch (error) {
            console.error('Process error:', error);
            this.showError(error.message || 'Unknown error');
        }

        this.isProcessing = false;
    },

    readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Gagal baca file'));
            reader.readAsDataURL(file);
        });
    },

    async performOCR(imageData) {
        try {
            console.log('Starting OCR...');
            document.getElementById('ocrProgress').textContent = 'Mengenali teks...';

            const result = await this.ocrWorker.recognize(imageData);
            const text = result.data.text;

            console.log('OCR Result:', text.substring(0, 200));

            if (!text || text.trim().length < 5) {
                throw new Error('Teks tidak terbaca dari gambar');
            }

            document.getElementById('ocrProgress').textContent = 'Memparsing...';

            const parsed = this.parseReceiptText(text);
            this.scannedData = parsed;

            this.displayOcrResult(parsed);

            document.getElementById('ocrLoading').style.display = 'none';
            document.getElementById('ocrResultSection').style.display = 'block';

        } catch (error) {
            console.error('OCR error:', error);
            throw error;
        }
    },

    parseReceiptText(text) {
        console.log('Parsing text...');

        const normalized = text.toLowerCase();
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

        // DETEKSI PROVIDER DENGAN KONTEKS
        let senderProvider = '';
        let receiverProvider = '';
        let type = 'transfer';

        // Definisi semua provider dengan flag 'g' untuk matchAll
        const allProviders = [
            { pattern: /\b(bri|bank\s*bri|bri\s*virtual|bri\s*mobile)\b/gi, name: 'BRI', category: 'bank' },
            { pattern: /\b(bca|bank\s*central\s*asia|bca\s*mobile|mybca)\b/gi, name: 'BCA', category: 'bank' },
            { pattern: /\b(bni|bank\s*negara\s*indonesia|bni\s*mobile)\b/gi, name: 'BNI', category: 'bank' },
            { pattern: /\b(mandiri|bank\s*mandiri|livin\s*mandiri)\b/gi, name: 'MANDIRI', category: 'bank' },
            { pattern: /\b(bsi|bank\s*syariah\s*indonesia)\b/gi, name: 'BSI', category: 'bank' },
            { pattern: /\b(cimb|cimb\s*niaga|cimb\s*clicks)\b/gi, name: 'CIMB', category: 'bank' },
            { pattern: /\b(permata|bank\s*permata)\b/gi, name: 'PERMATA', category: 'bank' },
            { pattern: /\b(danamon|bank\s*danamon)\b/gi, name: 'DANAMON', category: 'bank' },
            { pattern: /\b(linkaja|link\s*aja)\b/gi, name: 'LINKAJA', category: 'wallet' },
            { pattern: /\b(gopay|go\s*pay)\b/gi, name: 'GOPAY', category: 'wallet' },
            { pattern: /\b(ovo)\b/gi, name: 'OVO', category: 'wallet' },
            { pattern: /\b(shopeepay|shopee\s*pay)\b/gi, name: 'SHOPEEPAY', category: 'wallet' },
            { pattern: /\b(dana)\b/gi, name: 'DANA', category: 'wallet' }
        ];

        // Cari semua provider yang muncul dalam teks beserta posisinya
        const foundProviders = [];
        for (const prov of allProviders) {
            const matches = [...text.matchAll(prov.pattern)];
            for (const match of matches) {
                foundProviders.push({
                    name: prov.name,
                    category: prov.category,
                    index: match.index,
                    text: match[0]
                });
            }
        }

        // Urutkan berdasarkan posisi dalam teks
        foundProviders.sort((a, b) => a.index - b.index);

        console.log('Found providers:', foundProviders);

        // Analisis konteks untuk menentukan pengirim vs penerima
        const senderKeywords = ['pengirim', 'dari', 'from', 'sumber', 'debet dari', 'transfer dari'];
        const receiverKeywords = ['penerima', 'ke', 'to', 'tujuan', 'beneficiary', 'kredit ke'];

        let senderSectionEnd = -1;
        let receiverSectionStart = -1;

        // Cari posisi section
        for (let i = 0; i < lines.length; i++) {
            const lowerLine = lines[i].toLowerCase();

            if (senderKeywords.some(k => lowerLine.includes(k))) {
                senderSectionEnd = i + 3;
            }

            if (receiverKeywords.some(k => lowerLine.includes(k))) {
                receiverSectionStart = i;
            }
        }

        // Tentukan provider berdasarkan posisi
        if (foundProviders.length >= 2) {
            const firstProv = foundProviders[0];
            const secondProv = foundProviders[1];

            // Jika ada section info, gunakan itu
            if (senderSectionEnd > 0 && receiverSectionStart > 0) {
                for (const prov of foundProviders) {
                    const lineIndex = this.findLineIndex(lines, prov.text);
                    if (lineIndex <= senderSectionEnd) {
                        senderProvider = prov.name;
                    } else if (lineIndex >= receiverSectionStart) {
                        receiverProvider = prov.name;
                    }
                }
            }

            // Jika masih belum ketemu, pakai urutan dan logika
            if (!senderProvider && !receiverProvider) {
                if (firstProv.category === 'wallet' && secondProv.category === 'bank') {
                    senderProvider = firstProv.name;
                    receiverProvider = secondProv.name;
                    type = 'transfer';
                } else if (firstProv.category === 'bank' && secondProv.category === 'bank') {
                    senderProvider = firstProv.name;
                    receiverProvider = secondProv.name;
                    type = 'transfer';
                } else if (firstProv.category === 'bank' && secondProv.category === 'wallet') {
                    senderProvider = firstProv.name;
                    receiverProvider = secondProv.name;
                    type = 'top_up';
                } else {
                    senderProvider = firstProv.name;
                    receiverProvider = secondProv.name;
                }
            }
        } else if (foundProviders.length === 1) {
            const prov = foundProviders[0];

            if (prov.category === 'wallet' && /\b(top.?up|isi.?saldo)\b/i.test(text)) {
                receiverProvider = prov.name;
                type = 'top_up';
            } else {
                receiverProvider = prov.name;
                type = 'transfer';
            }
        }

        // Fallback
        if (!senderProvider && !receiverProvider) {
            if (/\b(dana)\b/i.test(text)) {
                receiverProvider = 'DANA';
                type = 'top_up';
            }
        }

        console.log('Detected:', { senderProvider, receiverProvider, type });

        // Date & Time
        let date = new Date().toISOString().split('T')[0];
        let time = new Date().toTimeString().slice(0, 5);

        const dateMatch = text.match(/(\d{1,2})[\/\-\s](\d{1,2})[\/\-\s](\d{4})/);
        if (dateMatch) {
            date = `${dateMatch[3]}-${dateMatch[2].padStart(2,'0')}-${dateMatch[1].padStart(2,'0')}`;
        }

        const timeMatch = text.match(/(\d{1,2})[:.](\d{2})/);
        if (timeMatch) {
            time = `${timeMatch[1].padStart(2,'0')}:${timeMatch[2]}`;
        }

        // AMOUNTS
        let nominal = 0;
        let admin = 0;
        let total = 0;

        const cleanText = text.replace(/(\d)\.(\d{3})/g, '$1$2');

        const rpMatches = [...cleanText.matchAll(/rp\.?\s*([\d\s,]+)/gi)];
        const amounts = [];

        for (const m of rpMatches) {
            if (m[1]) {
                const numStr = m[1].replace(/[\s,]/g, '');
                const num = parseInt(numStr);
                if (num > 1000 && num < 1000000000 && !amounts.includes(num)) {
                    amounts.push(num);
                }
            }
        }

        const bigNums = [...cleanText.matchAll(/\b(\d{6,9})\b/g)];
        for (const m of bigNums) {
            const num = parseInt(m[1]);
            if (!amounts.includes(num)) amounts.push(num);
        }

        amounts.sort((a,b) => b-a);
        console.log('Amounts found:', amounts);

        if (amounts.length > 0) {
            total = amounts[0];
            nominal = total;

            for (const n of amounts.slice(1)) {
                if (n <= 50000) {
                    admin = n;
                    nominal = total - admin;
                    break;
                }
            }
        }

        // Names dengan konteks
        let senderName = '';
        let receiverName = '';
        let senderAccount = '';
        let receiverAccount = '';

        for (let i = 0; i < lines.length; i++) {
            const lower = lines[i].toLowerCase();
            const nextLine = lines[i+1] || '';
            const cleanNext = nextLine.replace(/[^\w\s]/g, '').trim();

            if ((lower.includes('pengirim') || lower.includes('dari') || lower.includes('sumber')) && !senderName) {
                if (cleanNext.length > 3 && !this.isAccountNumber(cleanNext)) {
                    senderName = cleanNext;
                }
                const acc = this.findAccountNearby(lines, i);
                if (acc) senderAccount = acc;
            }

            if ((lower.includes('penerima') || lower.includes('tujuan') || lower.includes('ke')) && !receiverName) {
                if (cleanNext.length > 3 && !this.isAccountNumber(cleanNext)) {
                    receiverName = cleanNext;
                }
                const acc = this.findAccountNearby(lines, i);
                if (acc) receiverAccount = acc;
            }
        }

        if (!senderName && senderProvider) {
            senderName = senderProvider;
        }
        if (!receiverName && receiverProvider) {
            receiverName = receiverProvider;
        }

        // Phone untuk e-wallet
        if (type === 'top_up' || senderProvider === 'LINKAJA' || senderProvider === 'GOPAY' || senderProvider === 'OVO') {
            const phones = [...text.matchAll(/\b(08\d{8,12})\b/g)];
            const uniquePhones = [...new Set(phones.map(m => m[1]))];
            if (uniquePhones.length > 0) {
                if (!senderAccount && (senderProvider === 'LINKAJA' || senderProvider === 'GOPAY' || senderProvider === 'OVO' || senderProvider === 'DANA')) {
                    senderAccount = uniquePhones[0];
                }
                if (!receiverAccount) {
                    receiverAccount = uniquePhones[uniquePhones.length - 1];
                }
            }
        }

        // Reference
        let reference = '';
        const refMatch = text.match(/(?:ref|no|reference)[\.:\s]+([A-Z0-9]{5,})/i);
        if (refMatch) reference = refMatch[1];

        // Confidence
        let confidence = 0;
        if (nominal > 0) confidence += 30;
        if (senderName || receiverName) confidence += 20;
        if (senderAccount || receiverAccount) confidence += 20;
        if (senderProvider || receiverProvider) confidence += 20;
        if (reference) confidence += 10;

        return {
            type,
            detected: confidence > 30 && nominal > 0,
            provider: receiverProvider || senderProvider,
            senderProvider,
            receiverProvider,
            parsed: {
                date, time,
                senderName: senderName.substring(0, 30),
                senderAccount,
                senderBank: senderProvider,
                receiverName: receiverName.substring(0, 30),
                receiverAccount,
                receiverBank: receiverProvider,
                nominal,
                admin,
                total: total || nominal,
                reference
            },
            confidence: Math.min(confidence, 100),
            rawText: text
        };
    },

    findLineIndex(lines, text) {
        const lowerText = text.toLowerCase();
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes(lowerText)) {
                return i;
            }
        }
        return -1;
    },

    isAccountNumber(text) {
        return /^\d{10,16}$/.test(text.replace(/\D/g, ''));
    },

    findAccountNearby(lines, startIndex) {
        for (let i = startIndex; i < Math.min(startIndex + 4, lines.length); i++) {
            const accMatch = lines[i].match(/\b(\d{10,16})\b/);
            if (accMatch) return accMatch[1];
        }
        return '';
    },

    displayOcrResult(data) {
        const container = document.getElementById('ocrParsedData');

        if (!data.detected) {
            container.innerHTML = `
                <div style="text-align: center; color: #666; padding: 20px;">
                    <div style="font-size: 32px; margin-bottom: 10px;">🤔</div>
                    <div style="font-weight: 600; margin-bottom: 10px;">Tidak terbaca otomatis</div>
                    <div style="font-size: 12px;">Nominal tidak ditemukan atau teks kurang jelas.</div>
                    <details style="margin-top: 15px; text-align: left;">
                        <summary style="cursor: pointer; font-size: 11px;">Lihat teks mentah</summary>
                        <pre style="font-size: 10px; background: #f5f5f5; padding: 10px; border-radius: 4px; margin-top: 5px; max-height: 100px; overflow: auto;">${(data.rawText || '').substring(0, 300)}</pre>
                    </details>
                </div>
            `;
            return;
        }

        const p = data.parsed;

        container.innerHTML = `
            <div style="margin-bottom: 8px;">
                <span style="font-size: 11px; color: #666;">Jenis:</span>
                <span style="font-weight: 600; margin-left: 5px;">${data.receiverProvider || data.senderProvider || 'Transfer'}</span>
                ${data.senderProvider && data.receiverProvider ? 
                    `<span style="font-size: 11px; color: #999;"> (${data.senderProvider} → ${data.receiverProvider})</span>` : ''}
            </div>

            <div style="margin-bottom: 8px;">
                <span style="font-size: 11px; color: #666;">Tanggal:</span>
                <span style="font-weight: 600; margin-left: 5px;">${p.date} ${p.time}</span>
            </div>

            ${p.reference ? `<div style="margin-bottom: 8px;"><span style="font-size: 11px; color: #666;">Ref:</span> <span style="font-family: monospace;">${p.reference}</span></div>` : ''}

            ${p.senderName || p.senderAccount ? `
            <div style="background: white; padding: 8px; border-radius: 6px; margin-bottom: 8px;">
                <div style="font-size: 11px; color: #666;">👤 Pengirim ${p.senderBank ? `(${p.senderBank})` : ''}</div>
                <div style="font-weight: 600; font-size: 13px;">${p.senderName || '-'}</div>
                ${p.senderAccount ? `<div style="font-family: monospace; font-size: 11px; color: #666;">${p.senderAccount}</div>` : ''}
            </div>
            ` : ''}

            ${p.receiverName || p.receiverAccount ? `
            <div style="background: white; padding: 8px; border-radius: 6px; margin-bottom: 8px;">
                <div style="font-size: 11px; color: #666;">🎯 Penerima ${p.receiverBank ? `(${p.receiverBank})` : ''}</div>
                <div style="font-weight: 600; font-size: 13px;">${p.receiverName || '-'}</div>
                ${p.receiverAccount ? `<div style="font-family: monospace; font-size: 11px; color: #666;">${p.receiverAccount}</div>` : ''}
            </div>
            ` : ''}

            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px; border-radius: 8px; text-align: center;">
                <div style="font-size: 11px; opacity: 0.9;">Total</div>
                <div style="font-size: 20px; font-weight: 700;">Rp ${this.formatNumber(p.total)}</div>
            </div>

            <div style="margin-top: 10px;">
                <div style="display: flex; justify-content: space-between; font-size: 11px; color: #666;">
                    <span>Akurasi: ${data.confidence}%</span>
                </div>
                <div style="height: 4px; background: #e0e0e0; border-radius: 2px; margin-top: 4px; overflow: hidden;">
                    <div style="height: 100%; width: ${data.confidence}%; background: linear-gradient(90deg, #f44336, #4caf50);"></div>
                </div>
            </div>
        `;
    },

    showError(message) {
        document.getElementById('ocrLoading').style.display = 'none';
        document.getElementById('ocrResultSection').style.display = 'block';
        document.getElementById('ocrParsedData').innerHTML = `
            <div style="text-align: center; color: #d32f2f; padding: 20px;">
                <div style="font-size: 32px; margin-bottom: 10px;">❌</div>
                <div style="font-weight: 600;">Error</div>
                <div style="font-size: 12px; margin-top: 5px;">${message}</div>
            </div>
        `;
    },

    applyOcrToForm() {
        if (!this.scannedData) {
            app.showToast('❌ Tidak ada data!');
            return;
        }

        const data = this.scannedData;

        if (data.type !== this.receiptType) {
            document.querySelectorAll('.receipt-type-tab').forEach(tab => {
                if (tab.dataset.type === data.type) tab.click();
            });
        }

        setTimeout(() => {
            this.fillForm(data);
            document.getElementById('receiptFormContainer').scrollIntoView({ behavior: 'smooth' });
            app.showToast('✅ Data diisi!');
        }, 100);
    },

    fillForm(data) {
        const p = data.parsed;
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el && val) {
                el.value = val;
                el.style.background = '#e8f5e9';
                setTimeout(() => el.style.background = '', 1500);
            }
        };

        setVal('manualDate', p.date);
        setVal('manualTime', p.time);
        setVal('manualNominal', p.nominal);
        setVal('manualAdmin', p.admin);

        switch(data.type) {
            case 'transfer':
                setVal('manualSender', p.senderName);
                setVal('manualSenderAccount', p.senderAccount);
                setVal('manualBankFrom', p.senderBank);
                setVal('manualReceiver', p.receiverName);
                setVal('manualReceiverAccount', p.receiverAccount);
                setVal('manualBankTo', p.receiverBank);
                break;
            case 'tarik_tunai':
                setVal('manualCustomer', p.receiverName || p.senderName);
                setVal('manualBank', p.receiverBank);
                setVal('manualAccount', p.receiverAccount);
                break;
            case 'top_up':
                setVal('manualTopUpType', data.provider);
                setVal('manualTarget', p.receiverAccount);
                setVal('manualCustomer', p.receiverName);
                break;
        }

        this.calcManualTotal();
    },

    resetOcr() {
        this.scannedData = null;
        document.getElementById('ocrResultSection').style.display = 'none';
        document.getElementById('ocrUploadArea').style.display = 'block';
        document.getElementById('ocrFileInput').value = '';
    },

    setType(type) {
        this.receiptType = type;
        document.querySelectorAll('.receipt-type-tab').forEach(t => {
            t.classList.remove('active');
            t.style.background = 'transparent';
            t.style.color = '#666';
        });
        event.target.classList.add('active');
        event.target.style.background = 'white';
        event.target.style.color = 'var(--primary)';

        const container = document.getElementById('receiptFormContainer');
        switch(type) {
            case 'transfer': container.innerHTML = this.renderTransferForm(); break;
            case 'tarik_tunai': container.innerHTML = this.renderTarikTunaiForm(); break;
            case 'top_up': container.innerHTML = this.renderTopUpForm(); break;
        }
    },

    renderTransferForm() {
        const today = new Date().toISOString().split('T')[0];
        const now = new Date().toTimeString().slice(0, 5);

        return `
            <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
                <div class="form-group">
                    <label>Tanggal</label>
                    <input type="date" id="manualDate" value="${today}">
                </div>
                <div class="form-group">
                    <label>Waktu</label>
                    <input type="time" id="manualTime" value="${now}">
                </div>
            </div>

            <div style="background: #fafafa; border-radius: 12px; padding: 15px; margin-bottom: 15px; border-left: 4px solid var(--primary);">
                <div style="font-weight: 700; color: var(--primary); margin-bottom: 10px;">👤 Pengirim</div>
                <div class="form-group">
                    <label>Nama</label>
                    <input type="text" id="manualSender" placeholder="Nama pengirim">
                </div>
                <div class="form-group">
                    <label>No Rekening *</label>
                    <input type="text" id="manualSenderAccount" placeholder="1234-5678-9012" style="font-family: monospace;">
                </div>
                <div class="form-group">
                    <label>Bank *</label>
                    <select id="manualBankFrom">${this.getBankOptions()}</select>
                </div>
            </div>

            <div style="background: #fafafa; border-radius: 12px; padding: 15px; margin-bottom: 15px; border-left: 4px solid var(--success);">
                <div style="font-weight: 700; color: var(--success); margin-bottom: 10px;">🎯 Penerima</div>
                <div class="form-group">
                    <label>Nama</label>
                    <input type="text" id="manualReceiver" placeholder="Nama penerima">
                </div>
                <div class="form-group">
                    <label>No Rekening *</label>
                    <input type="text" id="manualReceiverAccount" placeholder="9876-5432-1098" style="font-family: monospace;">
                </div>
                <div class="form-group">
                    <label>Bank *</label>
                    <select id="manualBankTo">${this.getBankOptions()}</select>
                </div>
            </div>

            <div style="background: #fafafa; border-radius: 12px; padding: 15px; margin-bottom: 15px;">
                <div style="font-weight: 700; color: var(--primary); margin-bottom: 10px;">💰 Nominal</div>
                <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div class="form-group">
                        <label>Nominal (Rp) *</label>
                        <input type="number" id="manualNominal" placeholder="0" oninput="receiptModule.calcManualTotal()">
                    </div>
                    <div class="form-group">
                        <label>Admin (Rp)</label>
                        <input type="number" id="manualAdmin" placeholder="0" oninput="receiptModule.calcManualTotal()">
                    </div>
                </div>
            </div>

            <div style="background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%); color: white; border-radius: 16px; padding: 20px; margin: 20px 0;">
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.2);">
                    <span>Nominal:</span>
                    <span id="manualTotalNominal">Rp 0</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.2);">
                    <span>Admin:</span>
                    <span id="manualTotalAdmin">Rp 0</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 10px 0 0 0; font-size: 20px; font-weight: 700; margin-top: 5px; border-top: 2px solid rgba(255,255,255,0.3);">
                    <span>TOTAL:</span>
                    <span id="manualTotal">Rp 0</span>
                </div>
            </div>

            <div style="display: flex; gap: 10px;">
                <button class="btn btn-primary" onclick="receiptModule.printManual()" style="flex: 1;">🖨️ Cetak Struk</button>
                <button class="btn btn-success" onclick="receiptModule.printBluetooth()" style="flex: 1;" id="btPrintBtnReceipt">
                    📡 Print BT
                </button>
            </div>
        `;
    },

    renderTarikTunaiForm() {
        const today = new Date().toISOString().split('T')[0];
        const now = new Date().toTimeString().slice(0, 5);

        return `
            <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
                <div class="form-group">
                    <label>Tanggal</label>
                    <input type="date" id="manualDate" value="${today}">
                </div>
                <div class="form-group">
                    <label>Waktu</label>
                    <input type="time" id="manualTime" value="${now}">
                </div>
            </div>

            <div class="form-group">
                <label>Nama Customer</label>
                <input type="text" id="manualCustomer" placeholder="Nama customer">
            </div>

            <div class="form-group">
                <label>Bank *</label>
                <select id="manualBank">${this.getBankOptions()}</select>
            </div>

            <div class="form-group">
                <label>No Rekening *</label>
                <input type="text" id="manualAccount" placeholder="1234-5678-9012" style="font-family: monospace;">
            </div>

            <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div class="form-group">
                    <label>Nominal (Rp) *</label>
                    <input type="number" id="manualNominal" placeholder="0" oninput="receiptModule.calcManualTotal()">
                </div>
                <div class="form-group">
                    <label>Admin (Rp)</label>
                    <input type="number" id="manualAdmin" placeholder="0" oninput="receiptModule.calcManualTotal()">
                </div>
            </div>

            <div style="background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%); color: white; border-radius: 16px; padding: 20px; margin: 20px 0;">
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.2);">
                    <span>Nominal:</span>
                    <span id="manualTotalNominal">Rp 0</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.2);">
                    <span>Admin:</span>
                    <span id="manualTotalAdmin">Rp 0</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 10px 0 0 0; font-size: 20px; font-weight: 700; margin-top: 5px; border-top: 2px solid rgba(255,255,255,0.3);">
                    <span>TOTAL:</span>
                    <span id="manualTotal">Rp 0</span>
                </div>
            </div>

            <div style="display: flex; gap: 10px;">
                <button class="btn btn-primary" onclick="receiptModule.printTarikTunai()" style="flex: 1;">🖨️ Cetak Struk</button>
                <button class="btn btn-success" onclick="receiptModule.printBluetooth()" style="flex: 1;" id="btPrintBtnReceipt">
                    📡 Print BT
                </button>
            </div>
        `;
    },

    renderTopUpForm() {
        const today = new Date().toISOString().split('T')[0];
        const now = new Date().toTimeString().slice(0, 5);

        return `
            <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
                <div class="form-group">
                    <label>Tanggal</label>
                    <input type="date" id="manualDate" value="${today}">
                </div>
                <div class="form-group">
                    <label>Waktu</label>
                    <input type="time" id="manualTime" value="${now}">
                </div>
            </div>

            <div class="form-group">
                <label>Jenis Top Up *</label>
                <select id="manualTopUpType">
                    <option value="DANA">DANA</option>
                    <option value="GoPay">GoPay</option>
                    <option value="OVO">OVO</option>
                    <option value="ShopeePay">ShopeePay</option>
                    <option value="LinkAja">LinkAja</option>
                </select>
            </div>

            <div class="form-group">
                <label>No Tujuan *</label>
                <input type="text" id="manualTarget" placeholder="08xxxxxxxxxx" style="font-family: monospace;">
            </div>

            <div class="form-group">
                <label>Nama Customer</label>
                <input type="text" id="manualCustomer" placeholder="Nama customer">
            </div>

            <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div class="form-group">
                    <label>Nominal (Rp) *</label>
                    <input type="number" id="manualNominal" placeholder="0" oninput="receiptModule.calcManualTotal()">
                </div>
                <div class="form-group">
                    <label>Admin (Rp)</label>
                    <input type="number" id="manualAdmin" placeholder="0" oninput="receiptModule.calcManualTotal()">
                </div>
            </div>

            <div style="background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%); color: white; border-radius: 16px; padding: 20px; margin: 20px 0;">
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.2);">
                    <span>Nominal:</span>
                    <span id="manualTotalNominal">Rp 0</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.2);">
                    <span>Admin:</span>
                    <span id="manualTotalAdmin">Rp 0</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 10px 0 0 0; font-size: 20px; font-weight: 700; margin-top: 5px; border-top: 2px solid rgba(255,255,255,0.3);">
                    <span>TOTAL:</span>
                    <span id="manualTotal">Rp 0</span>
                </div>
            </div>

            <div style="display: flex; gap: 10px;">
                <button class="btn btn-primary" onclick="receiptModule.printTopUp()" style="flex: 1;">🖨️ Cetak Struk</button>
                <button class="btn btn-success" onclick="receiptModule.printBluetooth()" style="flex: 1;" id="btPrintBtnReceipt">
                    📡 Print BT
                </button>
            </div>
        `;
    },

    getBankOptions() {
        const banks = ['BRI', 'BCA', 'BNI', 'MANDIRI', 'BSI', 'CIMB', 'DANAMON', 'PERMATA', 
                       'DANA', 'GOPAY', 'OVO', 'SHOPEEPAY', 'LINKAJA'];
        return banks.map(b => `<option value="${b}">${b}</option>`).join('');
    },

    formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    },

    updatePreview() {
        const preview = document.getElementById('receiptPreview');
        if (!preview) return;

        const name = document.getElementById('receiptStoreName')?.value || 'NAMA KONTER';
        const address = document.getElementById('receiptAddress')?.value || 'Alamat';
        const phone = document.getElementById('receiptPhone')?.value || '-';

        preview.textContent = `================================
    ${name.toUpperCase()}
    ${address}
    HP: ${phone}
================================`;
    },

    saveHeader() {
        const storeName = document.getElementById('receiptStoreName')?.value?.trim();
        const address = document.getElementById('receiptAddress')?.value?.trim();

        if (!storeName || !address) {
            app.showToast('❌ Nama dan alamat wajib diisi!');
            return;
        }

        dataManager.data.settings.receiptHeader = {
            storeName,
            address,
            phone: document.getElementById('receiptPhone')?.value?.trim() || '',
            note: document.getElementById('receiptNote')?.value?.trim() || ''
        };

        dataManager.data.settings.storeName = storeName;
        dataManager.data.settings.address = address;

        dataManager.save();
        if (app.updateHeader) app.updateHeader();
        app.showToast('✅ Header disimpan!');
    },

    calcManualTotal() {
        const nominal = parseInt(document.getElementById('manualNominal')?.value) || 0;
        const admin = parseInt(document.getElementById('manualAdmin')?.value) || 0;
        const total = nominal + admin;

        const elNom = document.getElementById('manualTotalNominal');
        const elAdm = document.getElementById('manualTotalAdmin');
        const elTot = document.getElementById('manualTotal');

        if (elNom) elNom.textContent = 'Rp ' + this.formatNumber(nominal);
        if (elAdm) elAdm.textContent = 'Rp ' + this.formatNumber(admin);
        if (elTot) elTot.textContent = 'Rp ' + this.formatNumber(total);
    },

    // ==========================================
    // BLUETOOTH PRINT METHODS (IMPROVED)
    // ==========================================

    // Print via Bluetooth (dipanggil dari tombol Print BT atau bluetoothModule)
    async printBluetooth() {
        // Cek apakah bluetoothModule tersedia dan terhubung
        if (typeof bluetoothModule !== 'undefined') {
            if (bluetoothModule.isConnected) {
                await bluetoothModule.printCurrentReceipt();
                return;
            }
            
            // Jika ada device tersimpan tapi belum connect, coba reconnect
            if (bluetoothModule.lastDevice) {
                try {
                    await bluetoothModule.reconnect();
                    await bluetoothModule.printCurrentReceipt();
                    return;
                } catch(e) {
                    console.log('Auto-reconnect failed');
                }
            }
        }

        // Fallback ke window print
        app.showToast('⚠️ Printer Bluetooth tidak terhubung, menggunakan print window...');
        switch(this.receiptType) {
            case 'transfer':
                this.printManual();
                break;
            case 'tarik_tunai':
                this.printTarikTunai();
                break;
            case 'top_up':
                this.printTopUp();
                break;
        }
    },

    // Method untuk dipanggil dari bluetoothModule
    getCurrentReceiptForPrint() {
        const header = dataManager.data.settings.receiptHeader || {};
        
        const date = document.getElementById('manualDate')?.value || new Date().toISOString().split('T')[0];
        const time = document.getElementById('manualTime')?.value || new Date().toTimeString().slice(0, 5);
        const nominal = parseInt(document.getElementById('manualNominal')?.value) || 0;
        const admin = parseInt(document.getElementById('manualAdmin')?.value) || 0;
        const total = nominal + admin;

        let receiptData = {
            type: this.receiptType,
            header: header,
            date: date,
            time: time,
            nominal: nominal,
            admin: admin,
            total: total,
            transactionNumber: ''
        };

        switch(this.receiptType) {
            case 'transfer':
                receiptData.transactionNumber = 'TF-' + Date.now().toString().slice(-8);
                receiptData.sender = {
                    name: document.getElementById('manualSender')?.value || '-',
                    account: document.getElementById('manualSenderAccount')?.value || '-',
                    bank: document.getElementById('manualBankFrom')?.value || ''
                };
                receiptData.receiver = {
                    name: document.getElementById('manualReceiver')?.value || '-',
                    account: document.getElementById('manualReceiverAccount')?.value || '-',
                    bank: document.getElementById('manualBankTo')?.value || ''
                };
                break;
            case 'tarik_tunai':
                receiptData.transactionNumber = 'TT-' + Date.now().toString().slice(-8);
                receiptData.customer = document.getElementById('manualCustomer')?.value || '-';
                receiptData.bank = document.getElementById('manualBank')?.value || '';
                receiptData.account = document.getElementById('manualAccount')?.value || '-';
                break;
            case 'top_up':
                receiptData.transactionNumber = 'TP-' + Date.now().toString().slice(-8);
                receiptData.topUpType = document.getElementById('manualTopUpType')?.value || 'DANA';
                receiptData.target = document.getElementById('manualTarget')?.value || '-';
                receiptData.customer = document.getElementById('manualCustomer')?.value || '-';
                break;
        }

        this.currentReceiptData = receiptData;
        return receiptData;
    },

    printManual() {
        const header = dataManager.data.settings.receiptHeader || {};
        const date = document.getElementById('manualDate')?.value || '';
        const time = document.getElementById('manualTime')?.value || '';
        const sender = document.getElementById('manualSender')?.value || '-';
        const senderAcc = document.getElementById('manualSenderAccount')?.value || '-';
        const bankFrom = document.getElementById('manualBankFrom')?.value || '';
        const receiver = document.getElementById('manualReceiver')?.value || '-';
        const receiverAcc = document.getElementById('manualReceiverAccount')?.value || '-';
        const bankTo = document.getElementById('manualBankTo')?.value || '';
        const nominal = parseInt(document.getElementById('manualNominal')?.value) || 0;
        const admin = parseInt(document.getElementById('manualAdmin')?.value) || 0;

        if (!senderAcc || senderAcc === '-') { app.showToast('❌ No Rekening Pengirim wajib!'); return; }
        if (!receiverAcc || receiverAcc === '-') { app.showToast('❌ No Rekening Penerima wajib!'); return; }
        if (nominal <= 0) { app.showToast('❌ Nominal wajib!'); return; }

        const receipt = `================================
    ${(header.storeName || 'KONTER').toUpperCase()}
    ${header.address || ''}
    ${header.phone ? 'HP: ' + header.phone : ''}
================================
BUKTI TRANSFER
No: TF-${Date.now().toString().slice(-8)}
Tgl: ${date} ${time}
--------------------------------
PENGIRIM:
Nama: ${sender}
No Rek: ${senderAcc}
Bank: ${bankFrom}
--------------------------------
PENERIMA:
Nama: ${receiver}
No Rek: ${receiverAcc}
Bank: ${bankTo}
--------------------------------
Nominal: Rp ${this.formatNumber(nominal)}
Admin: Rp ${this.formatNumber(admin)}
--------------------------------
TOTAL: Rp ${this.formatNumber(nominal + admin)}
================================
${header.note || 'Terima kasih'}
================================`;

        this.printWindow(receipt, 'Transfer');
    },

    printTarikTunai() {
        const header = dataManager.data.settings.receiptHeader || {};
        const date = document.getElementById('manualDate')?.value || '';
        const time = document.getElementById('manualTime')?.value || '';
        const customer = document.getElementById('manualCustomer')?.value || '-';
        const bank = document.getElementById('manualBank')?.value || '';
        const account = document.getElementById('manualAccount')?.value || '-';
        const nominal = parseInt(document.getElementById('manualNominal')?.value) || 0;
        const admin = parseInt(document.getElementById('manualAdmin')?.value) || 0;

        if (!account || account === '-') { app.showToast('❌ No Rekening wajib!'); return; }
        if (nominal <= 0) { app.showToast('❌ Nominal wajib!'); return; }

        const receipt = `================================
    ${(header.storeName || 'KONTER').toUpperCase()}
    ${header.address || ''}
    ${header.phone ? 'HP: ' + header.phone : ''}
================================
BUKTI TARIK TUNAI
No: TT-${Date.now().toString().slice(-8)}
Tgl: ${date} ${time}
--------------------------------
Customer: ${customer}
Bank: ${bank}
No Rek: ${account}
--------------------------------
Nominal: Rp ${this.formatNumber(nominal)}
Admin: Rp ${this.formatNumber(admin)}
--------------------------------
TOTAL: Rp ${this.formatNumber(nominal + admin)}
================================
${header.note || 'Terima kasih'}
================================`;

        this.printWindow(receipt, 'Tarik Tunai');
    },

    printTopUp() {
        const header = dataManager.data.settings.receiptHeader || {};
        const date = document.getElementById('manualDate')?.value || '';
        const time = document.getElementById('manualTime')?.value || '';
        const type = document.getElementById('manualTopUpType')?.value || '';
        const target = document.getElementById('manualTarget')?.value || '-';
        const customer = document.getElementById('manualCustomer')?.value || '-';
        const nominal = parseInt(document.getElementById('manualNominal')?.value) || 0;
        const admin = parseInt(document.getElementById('manualAdmin')?.value) || 0;

        if (!target || target === '-') { app.showToast('❌ No Tujuan wajib!'); return; }
        if (nominal <= 0) { app.showToast('❌ Nominal wajib!'); return; }

        const receipt = `================================
    ${(header.storeName || 'KONTER').toUpperCase()}
    ${header.address || ''}
    ${header.phone ? 'HP: ' + header.phone : ''}
================================
BUKTI TOP UP ${type.toUpperCase()}
No: TP-${Date.now().toString().slice(-8)}
Tgl: ${date} ${time}
--------------------------------
Customer: ${customer}
No Tujuan: ${target}
--------------------------------
Nominal: Rp ${this.formatNumber(nominal)}
Admin: Rp ${this.formatNumber(admin)}
--------------------------------
TOTAL: Rp ${this.formatNumber(nominal + admin)}
================================
${header.note || 'Terima kasih'}
================================`;

        this.printWindow(receipt, 'Top Up');
    },

    printWindow(content, title) {
        const w = window.open('', '_blank');
        w.document.write(`<html><head><title>Struk ${title}</title><style>body{font-family:'Courier New',monospace;padding:20px;white-space:pre-wrap;font-size:12px;line-height:1.4;}</style></head><body>${content}</body></html>`);
        w.document.close();
        w.print();
        app.showToast('✅ Struk dicetak!');
    }
};

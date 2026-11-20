// Telegram Session Manager - Fixed Frontend with Error Handling

class SessionManager {
    constructor() {
        this.ws = null;
        this.clientId = null;
        this.pendingPhone = '';
        this.awaiting2fa = false;
        this.mode = null;
        this.init();
    }

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else { this.setup(); }
    }

    setup() {
        try {
            this.bindElements();
            this.bindEvents();
            this.connectWS();
            this.loadSessions();
        } catch (e) {
            console.error('Setup error:', e);
            document.body.innerHTML = '<div style="padding:20px;color:red;font-family:monospace">Frontend Error: ' + e.message + '<pre>' + e.stack + '</pre></div>';
        }
    }

    bindElements() {
        // Views
        this.viewUpload = document.getElementById('view-upload');
        this.viewCreate = document.getElementById('view-create');
        this.viewSessions = document.getElementById('view-sessions');
        this.views = { 
            upload: this.viewUpload, 
            create: this.viewCreate, 
            sessions: this.viewSessions 
        };

        // Navigation
        this.navUpload = document.getElementById('nav-upload');
        this.navCreate = document.getElementById('nav-create');
        this.navSessions = document.getElementById('nav-sessions');
        this.navButtons = { 
            upload: this.navUpload, 
            create: this.navCreate, 
            sessions: this.navSessions 
        };

        // Status
        this.statusDot = document.getElementById('statusDot');
        this.statusText = document.getElementById('statusText');

        // Upload View
        this.dropZone = document.getElementById('dropZone');
        this.uploadFile = document.getElementById('uploadFile');
        this.fileInfo = document.getElementById('fileInfo');
        this.fileName = document.getElementById('fileName');
        this.uploadPhone = document.getElementById('uploadPhone');
        this.uploadApiId = document.getElementById('uploadApiId');
        this.uploadApiHash = document.getElementById('uploadApiHash');
        this.uploadBtn = document.getElementById('uploadBtn');
        this.removeFileBtn = document.getElementById('removeFileBtn');

        // Create View
        this.createApiId = document.getElementById('createApiId');
        this.createApiHash = document.getElementById('createApiHash');
        this.createPhone = document.getElementById('createPhone');
        this.createBtn = document.getElementById('createBtn');

        // Sessions View
        this.sessionsList = document.getElementById('sessionsList');

        // Verify Modal
        this.modal = document.getElementById('verifyModal');
        this.modalTitle = document.getElementById('modalTitle');
        this.modalDesc = document.getElementById('modalDesc');
        this.codeInputs = document.querySelectorAll('#codeInputs input');
        this.passwordField = document.getElementById('passwordField');
        this.passwordInput = document.getElementById('passwordInput');
        this.verifyBtn = document.getElementById('verifyBtn');
        this.resendBtn = document.getElementById('resendBtn');
        this.closeModal = document.getElementById('closeModal');

        // Success Modal
        this.successModal = document.getElementById('successModal');
        this.successOutput = document.getElementById('successOutput');
        this.copyBtn = document.getElementById('copyBtn');
        this.doneBtn = document.getElementById('doneBtn');

        // Log which elements are missing
        const elements = {
            'view-upload': this.viewUpload,
            'view-create': this.viewCreate,
            'view-sessions': this.viewSessions,
            'nav-upload': this.navUpload,
            'nav-create': this.navCreate,
            'nav-sessions': this.navSessions,
            'dropZone': this.dropZone,
            'uploadFile': this.uploadFile,
            'uploadBtn': this.uploadBtn,
            'createBtn': this.createBtn,
            'modal': this.modal,
            'verifyBtn': this.verifyBtn,
            'successModal': this.successModal,
        };
        Object.entries(elements).forEach(([name, el]) => {
            if (!el) console.warn('Missing element:', name);
        });
    }

    bindEvents() {
        // Navigation
        this.navUpload?.addEventListener('click', () => this.showView('upload'));
        this.navCreate?.addEventListener('click', () => this.showView('create'));
        this.navSessions?.addEventListener('click', () => { this.showView('sessions'); this.loadSessions(); });

        // Upload - File
        this.dropZone?.addEventListener('click', () => this.uploadFile?.click());
        this.dropZone?.addEventListener('dragover', (e) => { e.preventDefault(); this.dropZone?.classList.add('dragover'); });
        this.dropZone?.addEventListener('dragleave', () => this.dropZone?.classList.remove('dragover'));
        this.dropZone?.addEventListener('drop', (e) => { e.preventDefault(); this.dropZone?.classList.remove('dragover'); const f = e.dataTransfer.files[0]; if (f) this.handleFile(f); });
        this.uploadFile?.addEventListener('change', (e) => { const f = e.target.files[0]; if (f) this.handleFile(f); });
        this.removeFileBtn?.addEventListener('click', (e) => { e.stopPropagation(); this.clearFile(); });

        // Input validation
        this.uploadPhone?.addEventListener('input', () => this.validateUpload());
        this.uploadApiId?.addEventListener('input', () => this.validateUpload());
        this.uploadApiHash?.addEventListener('input', () => this.validateUpload());
        this.createApiId?.addEventListener('input', () => this.validateCreate());
        this.createApiHash?.addEventListener('input', () => this.validateCreate());
        this.createPhone?.addEventListener('input', () => this.validateCreate());

        // Action buttons
        this.uploadBtn?.addEventListener('click', () => this.startUpload());
        this.createBtn?.addEventListener('click', () => this.startCreate());

        // Modal - Code inputs
        this.codeInputs?.forEach((input, i) => {
            input?.addEventListener('input', (e) => {
                if (e.target.value && i < 4 && this.codeInputs[i+1]) this.codeInputs[i+1].focus();
                this.checkCode();
            });
            input?.addEventListener('keydown', (e) => { if (e.key === 'Backspace' && !e.target.value && i > 0 && this.codeInputs[i-1]) this.codeInputs[i-1].focus(); });
            input?.addEventListener('paste', (e) => { e.preventDefault(); const p = e.clipboardData.getData('text').slice(0,5); p.split('').forEach((ch, idx) => { if (this.codeInputs[idx]) this.codeInputs[idx].value = ch; }); this.checkCode(); if (this.codeInputs[Math.min(p.length,4)]) this.codeInputs[Math.min(p.length,4)].focus(); });
        });

        this.verifyBtn?.addEventListener('click', () => this.verify());
        this.resendBtn?.addEventListener('click', () => this.resend());
        this.closeModal?.addEventListener('click', () => this.closeModalFn());
        this.modal?.addEventListener('click', (e) => { if (e.target === this.modal) this.closeModalFn(); });

        // Success Modal
        this.copyBtn?.addEventListener('click', () => this.copySession());
        this.doneBtn?.addEventListener('click', () => this.closeSuccess());
    }

    // WebSocket
    connectWS() {
        try {
            this.ws = new WebSocket('ws://localhost:8080');
            this.ws.onopen = () => this.setStatus('connected', 'Connected');
            this.ws.onmessage = (e) => { try { this.onMessage(JSON.parse(e.data)); } catch (err) { console.error('WS message error:', err); } };
            this.ws.onclose = () => { this.setStatus('disconnected', 'Disconnected'); setTimeout(() => this.connectWS(), 3000); };
            this.ws.onerror = (e) => { console.error('WS error:', e); this.setStatus('error', 'Error'); };
        } catch (e) { console.error('WS connect failed:', e); }
    }

    send(msg) { if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg)); }

    onMessage(data) {
        console.log('WS recv:', data.type, data);
        switch (data.type) {
            case 'connected':
                this.clientId = data.clientId;
                if (data.authorized) this.showSuccess(data.sessionString);
                else { this.pendingPhone = data.phone || ''; this.openModal('code', data.message || `Code sent to ${data.phone || 'Telegram'}`); if (this.mode === 'create') this.sendCode(); }
                break;
            case 'codeSent':
                this.pendingPhone = data.phone;
                this.openModal('code', data.message || `Code sent to ${data.phone}. Check Telegram app (NOT SMS!) — look for message from "Telegram" service account.`);
                break;
            case 'created':
                this.clientId = data.clientId;
                this.pendingPhone = data.phone;
                this.openModal('code', data.message || 'Code sent. Check Telegram app (NOT SMS!) — look for "Telegram" service message.');
                break;
            case 'verified':
                this.closeModalFn();
                this.showSuccess(data.sessionString);
                break;
            case 'need2fa':
                this.openModal('2fa', 'Two-Factor Authentication enabled. Enter your 2FA password.');
                break;
            case 'error':
                this.setLoading(this.uploadBtn, false); this.setLoading(this.createBtn, false); this.setLoading(this.verifyBtn, false);
                alert('Error: ' + (data.message || 'Unknown error'));
                break;
            case 'sessionsUpdated': this.loadSessions(); break;
        }
    }

    // File handling
    handleFile(file) {
        if (!file.name.endsWith('.session')) { alert('Select .session file'); return; }
        if (this.fileName) this.fileName.textContent = file.name;
        if (this.fileInfo) this.fileInfo.hidden = false;
        if (this.dropZone) this.dropZone.style.display = 'none';
        this.validateUpload();
    }
    clearFile() { 
        if (this.uploadFile) this.uploadFile.value = ''; 
        if (this.fileInfo) this.fileInfo.hidden = true; 
        if (this.dropZone) this.dropZone.style.display = 'block'; 
        if (this.uploadPhone) this.uploadPhone.value = ''; 
        this.validateUpload(); 
    }

    validateUpload() {
        const ok = this.uploadFile?.files?.length > 0 && this.uploadPhone?.value?.trim() && this.uploadApiId?.value?.trim() && this.uploadApiHash?.value?.trim();
        if (this.uploadBtn) this.uploadBtn.disabled = !ok;
    }
    validateCreate() {
        const ok = this.createApiId?.value?.trim() && this.createApiHash?.value?.trim() && this.createPhone?.value?.trim();
        if (this.createBtn) this.createBtn.disabled = !ok;
    }

    // Upload existing session
    async startUpload() {
        const phone = this.uploadPhone?.value?.trim();
        const apiId = this.uploadApiId?.value?.trim();
        const apiHash = this.uploadApiHash?.value?.trim();
        this.setLoading(this.uploadBtn, true);
        this.mode = 'upload';
        try {
            const formData = new FormData();
            formData.append('sessionFile', this.uploadFile?.files[0]);
            const res = await fetch('/api/upload-session', { method: 'POST', body: formData });
            const data = await res.json();
            if (!data.success) throw new Error(data.message || 'Upload failed');
            this.send({ type: 'connect', apiId, apiHash, sessionString: data.sessionData || '', phone });
        } catch (e) { this.setLoading(this.uploadBtn, false); alert(e.message); }
    }

    // Create new session
    async startCreate() {
        const apiId = this.createApiId?.value?.trim();
        const apiHash = this.createApiHash?.value?.trim();
        const phone = this.createPhone?.value?.trim();
        this.setLoading(this.createBtn, true);
        this.mode = 'create';
        this.send({ type: 'createSession', apiId, apiHash, phone });
    }

    sendCode() { if (this.clientId && this.pendingPhone) this.send({ type: 'sendCode', clientId: this.clientId, phone: this.pendingPhone }); }
    resend() { this.setLoading(this.resendBtn, true); this.sendCode(); }

    // Modal
    openModal(type, desc) {
        if (!this.modal) return;
        this.modal.hidden = false;
        if (this.modalDesc) this.modalDesc.textContent = desc;
        this.codeInputs?.forEach(i => { i.value = ''; i.hidden = false; i.classList.remove('filled'); });
        if (this.passwordField) this.passwordField.hidden = true;
        if (this.passwordInput) this.passwordInput.value = '';
        if (this.resendBtn) this.resendBtn.hidden = true;
        this.awaiting2fa = (type === '2fa');
        if (type === '2fa') { 
            if (this.modalTitle) this.modalTitle.textContent = '2FA Password'; 
            this.codeInputs?.forEach(i => i.hidden = true); 
            if (this.passwordField) this.passwordField.hidden = false; 
            if (this.passwordInput) this.passwordInput.focus(); 
        } else { 
            if (this.modalTitle) this.modalTitle.textContent = 'Enter 5-Digit Code'; 
            if (this.codeInputs[0]) this.codeInputs[0].focus(); 
        }
        this.checkCode();
    }
    closeModalFn() { if (this.modal) this.modal.hidden = true; this.awaiting2fa = false; }
    checkCode() {
        if (!this.codeInputs || !this.verifyBtn) return;
        const code = Array.from(this.codeInputs).map(i => i.value).join('');
        const ok = code.length === 5;
        this.verifyBtn.disabled = this.awaiting2fa ? !(this.passwordInput?.value?.trim()) : !ok;
        this.codeInputs.forEach(i => i.classList.toggle('filled', !!i.value));
    }

    verify() {
        if (!this.clientId || !this.pendingPhone) return;
        if (this.awaiting2fa) {
            const pw = this.passwordInput?.value?.trim(); if (!pw) return;
            this.setLoading(this.verifyBtn, true);
            this.send({ type: 'verifyCode', clientId: this.clientId, phone: this.pendingPhone, code: '', password: pw });
        } else {
            const code = Array.from(this.codeInputs || []).map(i => i.value).join('');
            if (code.length !== 5) return;
            this.setLoading(this.verifyBtn, true);
            this.send({ type: 'verifyCode', clientId: this.clientId, phone: this.pendingPhone, code });
        }
    }

    // Success
    showSuccess(sessionString) {
        if (this.successModal) this.successModal.hidden = false;
        if (this.successOutput) this.successOutput.value = sessionString;
        this.loadSessions();
    }
    closeSuccess() { 
        if (this.successModal) this.successModal.hidden = true; 
        this.showView('upload'); 
        this.clearFile(); 
        if (this.createApiId) this.createApiId.value=''; 
        if (this.createApiHash) this.createApiHash.value=''; 
        if (this.createPhone) this.createPhone.value=''; 
        this.validateCreate(); 
    }
    copySession() { 
        if (!this.successOutput) return;
        this.successOutput.select(); 
        document.execCommand('copy'); 
        if (this.copyBtn) { this.copyBtn.textContent='Copied!'; setTimeout(()=>this.copyBtn.textContent='Copy',2000); } 
    }

    // Sessions list
    async loadSessions() {
        try {
            const sessions = await (await fetch('/api/sessions')).json();
            if (!this.sessionsList) return;
            if (!sessions.length) { this.sessionsList.innerHTML = '<div class="empty">No sessions saved</div>'; return; }
            this.sessionsList.innerHTML = sessions.map(s => `
                <div class="session-row">
                    <div><strong>${this.esc(s.phone)}</strong><br><small>API: ${this.esc(s.api_id)} • ${new Date(s.updated_at).toLocaleString()}</small></div>
                    <div>
                        <button class="btn-small" onclick="app.copyStr('${this.esc(s.session_string)}')">Copy</button>
                        <button class="btn-small danger" onclick="app.del('${this.esc(s.phone)}')">Delete</button>
                    </div>
                </div>
            `).join('');
        } catch (e) { console.error('loadSessions error:', e); }
    }
    copyStr(s) { navigator.clipboard.writeText(s).then(()=>alert('Copied!')); }
    async del(phone) { if (confirm('Delete '+phone+'?')) { await fetch('/api/sessions/'+encodeURIComponent(phone),{method:'DELETE'}); this.loadSessions(); } }

    // UI Helpers
    showView(view) {
        Object.values(this.views).forEach(v => v?.classList.remove('active'));
        Object.values(this.navButtons).forEach(b => b?.classList.remove('active'));
        this.views[view]?.classList.add('active');
        this.navButtons[view]?.classList.add('active');
    }
    setStatus(s, t) { if (this.statusDot) this.statusDot.className = 'dot ' + s; if (this.statusText) this.statusText.textContent = t; }
    setLoading(btn, on) { if (!btn) return; btn.disabled = on; btn.classList.toggle('loading', on); }
    esc(s) { const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
}

// Global - with error handling
document.addEventListener('DOMContentLoaded', () => {
    try {
        window.app = new SessionManager();
    } catch (e) {
        console.error('Failed to initialize app:', e);
        document.body.innerHTML = '<div style="padding:20px;color:red;font-family:monospace">Init Error: ' + e.message + '<pre>' + e.stack + '</pre></div>';
    }
});
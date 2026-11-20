const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { WebSocketServer } = require('ws');
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const dotenv = require('dotenv');

dotenv.config();

function log(...args) { console.log(`[${new Date().toISOString()}]`, ...args); }

function formatPhone(phone) {
    let p = phone.trim().replace(/[^\d+]/g, '');
    if (!p.startsWith('+')) p = '+' + p;
    return p;
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const clients = new Map();

wss.on('connection', (ws) => {
    log('WS connected');
    ws.on('message', async (msg) => {
        try { await handleWS(ws, JSON.parse(msg)); } catch (e) { log('WS error:', e); ws.send(JSON.stringify({ type: 'error', message: e.message })); }
    });
});

async function handleWS(ws, data) {
    log('WS:', data.type);
    switch (data.type) {
        case 'create': await doCreate(ws, data); break;
        case 'verify': await doVerify(ws, data); break;
    }
}

async function doCreate(ws, data) {
    const { apiId, apiHash, phone } = data;
    log('CREATE:', { apiId, phone });
    if (!apiId || !apiHash || !phone) return ws.send(JSON.stringify({ type: 'error', message: 'API ID, Hash, Phone required' }));

    const targetPhone = formatPhone(phone);
    
    try {
        const session = new StringSession('');
        
        // Use production servers (gramJS uses these by default)
        // dcId: 2 = Amsterdam (good for Europe/India), 5 = Singapore (Asia)
        const client = new TelegramClient(session, parseInt(apiId), apiHash, { 
            connectionRetries: 5, 
            timeout: 60000,
            // dcId: 2  // Uncomment to force specific DC (2=Amsterdam, 5=Singapore)
        });
        
        log('Connecting to Telegram production servers...');
        await client.connect();
        log('Connected to Telegram production');

        const authorized = await client.isUserAuthorized();
        if (authorized) {
            ws.send(JSON.stringify({ type: 'done', sessionString: client.session.save(), phone: targetPhone }));
            return;
        }

        await client.sendCode({ 
            phoneNumber: targetPhone, 
            apiId: parseInt(apiId), 
            apiHash 
        });
        log('Code sent to:', targetPhone);
        
        ws.send(JSON.stringify({ 
            type: 'code_sent', 
            phone: targetPhone,
            message: `Code sent to ${targetPhone}. Check Telegram app (NOT SMS!) for 5-digit code.`
        }));

        const clientId = `${apiId}_${Date.now()}`;
        clients.set(clientId, { client, ws, targetPhone });
        ws.send(JSON.stringify({ type: 'ready', clientId }));
        
    } catch (e) {
        log('Create error:', e.message);
        ws.send(JSON.stringify({ type: 'error', message: e.message }));
    }
}

async function doVerify(ws, data) {
    const { clientId, code, password } = data;
    const c = clients.get(clientId);
    if (!c) return ws.send(JSON.stringify({ type: 'error', message: 'Session expired' }));

    try {
        if (password) {
            await c.client.invoke({
                _: 'auth.checkPassword',
                password: { _: 'inputCheckPasswordSRP', srpId: 0, A: Buffer.from(password) }
            });
        } else {
            await c.client.invoke({
                _: 'auth.signIn',
                phoneNumber: c.targetPhone,
                phoneCodeHash: '',
                phoneCode: code
            });
        }

        const sessionString = c.client.session.save();
        log('Verified!');
        ws.send(JSON.stringify({ type: 'done', sessionString, phone: c.targetPhone }));
        clients.delete(clientId);
    } catch (e) {
        log('Verify error:', e.message);
        if (e.message?.includes('PASSWORD') || e.message?.includes('2FA') || e.message?.includes('password')) {
            ws.send(JSON.stringify({ type: 'need_2fa', message: '2FA password required' }));
        } else {
            ws.send(JSON.stringify({ type: 'error', message: e.message }));
        }
    }
}

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

server.listen(PORT, () => log(`Server running on port ${PORT} - Production mode`));
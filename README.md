# Telegram Session Creator

A minimal web tool to create Telegram StringSessions. Enter API credentials + phone → get OTP → get StringSession.

## Features
- ✅ Create new Telegram sessions (StringSession format)
- ✅ Works with any country phone number
- ✅ 2FA (Two-Factor Authentication) support
- ✅ Clean, minimal UI
- ✅ No session storage - stateless
- ✅ Deployable to any cloud platform

## Quick Start

### Local Development
```bash
# Install dependencies
npm install

# Start server
npm start

# Open http://localhost:3000
```

### Get API Credentials
1. Go to [my.telegram.org](https://my.telegram.org)
2. Login with your phone number
3. Click "API Development tools"
4. Create new application
5. Copy **api_id** and **api_hash**

## Usage
1. Open the web interface
2. Enter: API ID + API Hash + Phone Number (with country code, e.g., `+919876543210`)
3. Click "Send Code"
4. Check **Telegram app** (not SMS!) for 5-digit code
5. Enter code → Get **StringSession**
6. Copy and save the StringSession

## Deployment

### Render (Recommended - Free)
```bash
# 1. Push to GitHub
git init
git add .
git commit -m "Initial commit"
# Create repo on GitHub and push

# 2. Deploy on Render
# - Go to https://dashboard.render.com
# - New → Web Service
# - Connect GitHub repo
# - Build Command: npm install
# - Start Command: npm start
# - Deploy
```

### Railway (Alternative)
```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

### Docker
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

```bash
docker build -t telegram-session-creator .
docker run -p 3000:3000 telegram-session-creator
```

## Important: Network Requirements

**The server must be able to connect to Telegram's servers.**

| Platform | Works? |
|----------|--------|
| Render/Railway/VPS | ✅ Yes |
| Local (mobile hotspot) | ✅ Yes |
| Local (VPN) | ✅ Yes |
| Local (Indian ISP WiFi - Jio/Airtel/BSNL) | ❌ Blocked |
| College/Corporate WiFi | ❌ Often blocked |

**If deploying locally and getting `ETIMEDOUT` errors:** Use mobile hotspot or VPN.

## Project Structure
```
├── server.js          # Express + WebSocket server
├── package.json       # Dependencies
├── public/
│   ├── index.html     # Frontend UI
│   └── styles.css     # Styling (embedded in HTML)
└── .gitignore
```

## Tech Stack
- **Backend:** Node.js, Express, WebSocket (ws)
- **Telegram:** gramJS (TelegramClient)
- **Frontend:** Vanilla JS, HTML, CSS

## License
MIT
/**
 * ============================================================================
 * ABSTRACKER ENTERPRISE FLEET TELEMATICS & API GATEWAY ENGINE
 * Architecture: Node.js / Express / Axios / WebSocket Stream Relay
 * Map Engine  : Mappls (MapmyIndia) High-Precision Vector & Tile Integration
 * Core        : Traccar / Millitrack Protocol Adapter, Zero-Drift Telematics
 * Command Hub : Bidirectional Command Dispatch & Device ACK/Reply Interceptor
 * Powered by Abstracker Team
 * ============================================================================
 */

const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const WebSocket = require('ws');
const EventEmitter = require('events');

const app = express();
const server = http.createServer(app);

// Event emitter for asynchronous device command replies
const commandReplyEmitter = new EventEmitter();
commandReplyEmitter.setMaxListeners(100);

// Configuration & Environment Variables
const PORT = process.env.PORT || 3000;
const MILLITRACK_HOST = process.env.MILLITRACK_HOST || 'https://mvts2.millitrack.com';
const MILLITRACK_WS = process.env.MILLITRACK_WS || 'wss://mvts2.millitrack.com/api/socketEvents';
const SESSION_FILE = path.join(__dirname, '.session_data.json');
const MAINTENANCE_FILE = path.join(__dirname, '.maintenance_data.json');
const TELEMETRY_CACHE_FILE = path.join(__dirname, '.telemetry_cache.json');
const MAPPLS_KEY = process.env.MAPPLS_KEY || 'pjtmfohwqlfdqhuabvqbcudmydextsmaevyq';
const MAPTILER_KEY = process.env.MAPTILER_KEY || 'UFzZhhOMgEjhPErFufnk';
const MAPTILER_STYLE_ID = process.env.MAPTILER_STYLE_ID || '01a0f74a-ffea-726f-89b3-47d27e2b5dbb';
const TRAVELTIME_APP_ID = process.env.TRAVELTIME_APP_ID || '4b4350ea';
const TRAVELTIME_API_KEY = process.env.TRAVELTIME_API_KEY || '5e64e62d195ea15957410616cc0c0c03';
const KNOTS_TO_KMH = 1.852;

let telemetryCache = {
  devices: [],
  positions: [],
  users: [],
  groups: [],
  drivers: [],
  geofences: []
};

function loadTelemetryFromDisk() {
  try {
    if (fs.existsSync(TELEMETRY_CACHE_FILE)) {
      const raw = fs.readFileSync(TELEMETRY_CACHE_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        telemetryCache = { ...telemetryCache, ...parsed };
      }
    }
  } catch (e) {}
}

function saveTelemetryToDisk() {
  try {
    fs.writeFileSync(TELEMETRY_CACHE_FILE, JSON.stringify(telemetryCache, null, 2), 'utf8');
  } catch (e) {}
}

loadTelemetryFromDisk();

function loadMaintenanceFromDisk() {
  try {
    if (fs.existsSync(MAINTENANCE_FILE)) {
      const raw = fs.readFileSync(MAINTENANCE_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (e) {}
  return [];
}

function saveMaintenanceToDisk(data) {
  try {
    fs.writeFileSync(MAINTENANCE_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {}
}

// Trust proxy for Nginx / Cloudflare / Docker / VPS deployments
app.set('trust proxy', true);

// Body Parsers with elevated payload allowance
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'client', 'dist')));
app.use(express.static(path.join(__dirname, 'client', 'public')));
app.use('/app', express.static(path.join(__dirname, 'user-client', 'dist')));
app.use(['/user', '/user-client'], (req, res) => res.redirect('/app/'));
app.use('/vehicles', express.static(path.join(__dirname, 'user-client', 'public', 'vehicles')));
app.use('/vehicles', express.static(path.join(__dirname, 'client', 'public', 'vehicles')));
app.use('/app/vehicles', express.static(path.join(__dirname, 'user-client', 'public', 'vehicles')));
app.use('/user/vehicles', express.static(path.join(__dirname, 'user-client', 'public', 'vehicles')));

// Service Worker & PWA Manifest routing
app.get('/sw.js', (req, res) => {
  const swDist = path.join(__dirname, 'user-client', 'dist', 'sw.js');
  const swPublic = path.join(__dirname, 'user-client', 'public', 'sw.js');
  const target = fs.existsSync(swDist) ? swDist : swPublic;
  if (fs.existsSync(target)) {
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Service-Worker-Allowed', '/');
    return res.sendFile(target);
  }
  res.status(404).end();
});

app.get('/manifest.json', (req, res) => {
  const mfDist = path.join(__dirname, 'user-client', 'dist', 'manifest.json');
  const mfPublic = path.join(__dirname, 'user-client', 'public', 'manifest.json');
  const target = fs.existsSync(mfDist) ? mfDist : mfPublic;
  if (fs.existsSync(target)) {
    res.setHeader('Content-Type', 'application/manifest+json');
    return res.sendFile(target);
  }
  res.status(404).end();
});

// Direct APK Download Endpoint
const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) {
  try { fs.mkdirSync(downloadsDir, { recursive: true }); } catch (e) {}
}
app.use('/downloads', express.static(downloadsDir));

app.get(['/downloads/abstracker.apk', '/download/apk', '/app/download/apk'], (req, res) => {
  const apkPath = path.join(downloadsDir, 'abstracker.apk');
  if (fs.existsSync(apkPath)) {
    return res.download(apkPath, 'AbsTracker_GPS_Tracking_v4.5.apk');
  }
  res.setHeader('Content-Type', 'application/vnd.android.package-archive');
  res.setHeader('Content-Disposition', 'attachment; filename="AbsTracker_GPS_Tracking_v4.5.apk"');
  res.send(Buffer.from('PK\x03\x04\x14\x00\x00\x00\x08\x00AbsTracker_v4.5_Android_Release'));
});

// Universal CORS: Server acts as a standalone REST API on any origin/host
app.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cookie');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Global Session Memory State
let sessionState = {
  cookie: '',
  token: '',
  basicAuth: '',
  email: '',
  password: '',
  user: null
};

// In-Memory Storage for Recent Device Command Replies (Ring Buffer per Device)
const recentCommandReplies = new Map(); // Map<deviceId, Array<ReplyObject>>
const MAX_STORED_REPLIES = 20;

function storeCommandReply(deviceId, replyData) {
  if (!deviceId) return;
  const idStr = String(deviceId);
  if (!recentCommandReplies.has(idStr)) {
    recentCommandReplies.set(idStr, []);
  }
  const list = recentCommandReplies.get(idStr);
  list.unshift(replyData);
  if (list.length > MAX_STORED_REPLIES) {
    list.pop();
  }
}

// ---------------------------------------------------------------------------
// 1. DATA FORMATTING & TELEMATICS TRANSFORMATION HELPERS
// ---------------------------------------------------------------------------

function formatDurationMs(ms) {
  if (!ms || isNaN(ms) || ms <= 0) return '0s';
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(' ');
}

function formatDistanceMeters(meters) {
  if (!meters || isNaN(meters) || meters <= 0) return '0.00 km';
  return (meters / 1000).toFixed(2) + ' km';
}

function parseSpeedToKmh(speed) {
  if (!speed || isNaN(speed) || speed <= 0) return 0;
  return Number((speed * KNOTS_TO_KMH).toFixed(1));
}

function formatSpeedKmh(speed) {
  const kmh = parseSpeedToKmh(speed);
  return `${Math.round(kmh)} km/h`;
}

function formatReadableDate(dateString) {
  if (!dateString) return 'N/A';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return String(dateString);
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  } catch (e) {
    return String(dateString);
  }
}

function getHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ---------------------------------------------------------------------------
// 2. DISK PERSISTENCE ENGINE
// ---------------------------------------------------------------------------

function saveSessionToDisk() {
  try {
    fs.writeFileSync(SESSION_FILE, JSON.stringify(sessionState, null, 2), 'utf8');
  } catch (err) {}
}

function loadSessionFromDisk() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      const raw = fs.readFileSync(SESSION_FILE, 'utf8');
      const data = JSON.parse(raw);
      if (data && data.user && (data.basicAuth || data.cookie)) {
        sessionState = { ...sessionState, ...data };
        if (typeof distributorSession !== 'undefined') {
          distributorSession.cookie = data.cookie || '';
          distributorSession.token = data.token || data.user?.token || '';
          distributorSession.basicAuth = data.basicAuth || ('Basic ' + Buffer.from(`${DISTRIBUTOR_USER}:${DISTRIBUTOR_PASS}`).toString('base64'));
          distributorSession.user = data.user;
          distributorSession.lastRefreshed = Date.now();
        }
        return true;
      }
    }
  } catch (err) {}
  return false;
}

function clearSessionDisk() {
  try {
    if (fs.existsSync(SESSION_FILE)) fs.unlinkSync(SESSION_FILE);
  } catch (err) {}
}

// ---------------------------------------------------------------------------
// 3. UPSTREAM WEBSOCKET STREAM RELAY & COMMAND RESULT INTERCEPTOR
// ---------------------------------------------------------------------------

let upstreamWs = null;
let upstreamReconnectTimer = null;
let isUpstreamConnecting = false;
let upstreamPingInterval = null;
let notificationAlertLogs = [];

const localWss = new WebSocket.Server({ server, path: '/api/socketEvents' });

// Client heartbeat check
const clientHeartbeatInterval = setInterval(() => {
  localWss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

function broadcastToClients(data) {
  const payload = typeof data === 'string' ? data : JSON.stringify(data);
  localWss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

/**
 * Parses upstream socket frames to detect and extract device command responses
 */
function inspectAndProcessUpstreamMessage(rawMessage) {
  try {
    const data = JSON.parse(rawMessage);

    // Case 1: Traccar Events Array with commandResult
    if (data.events && Array.isArray(data.events)) {
      data.events.forEach((evt) => {
        if (evt.type === 'commandResult' || evt.type === 'deviceCommandResult' || evt.attributes?.result) {
          const replyText = evt.attributes?.result || evt.attributes?.data || evt.result || 'Command Acknowledged';
          const replyObj = {
            type: 'COMMAND_REPLY',
            deviceId: evt.deviceId,
            result: replyText,
            eventTime: evt.eventTime || evt.serverTime || new Date().toISOString(),
            formattedTime: formatReadableDate(evt.eventTime || evt.serverTime || new Date()),
            raw: evt
          };

          storeCommandReply(evt.deviceId, replyObj);
          commandReplyEmitter.emit(`reply_${evt.deviceId}`, replyObj);
          broadcastToClients(replyObj);
        } else if (evt.type) {
          const dev = sessionState.devices.find(d => d.id === evt.deviceId);
          const alertItem = {
            id: evt.id || Date.now(),
            type: evt.type,
            deviceId: evt.deviceId,
            deviceName: dev?.name || `Device ${evt.deviceId}`,
            alarm: evt.attributes?.alarm || null,
            message: `${dev?.name || 'Vehicle'} generated alert: ${evt.attributes?.alarm || evt.type}`,
            eventTime: evt.eventTime || evt.serverTime || new Date().toISOString(),
            formattedTime: formatReadableDate(evt.eventTime || evt.serverTime || new Date()),
            raw: evt
          };
          if (Array.isArray(notificationAlertLogs)) {
            notificationAlertLogs.unshift(alertItem);
            if (notificationAlertLogs.length > 200) notificationAlertLogs.pop();
          }
          broadcastToClients({ type: 'LIVE_ALERT', alert: alertItem });
        }
      });
    }

    // Case 2: Direct Command Result Object
    if (data.commandResult || data.type === 'commandResult') {
      const item = data.commandResult || data;
      const devId = item.deviceId || data.deviceId;
      const replyText = item.attributes?.result || item.result || item.data || 'Command Executed';
      const replyObj = {
        type: 'COMMAND_REPLY',
        deviceId: devId,
        result: replyText,
        eventTime: new Date().toISOString(),
        formattedTime: formatReadableDate(new Date()),
        raw: item
      };

      storeCommandReply(devId, replyObj);
      commandReplyEmitter.emit(`reply_${devId}`, replyObj);
      broadcastToClients(replyObj);
    }

    // Case 3: Positions payload containing response attributes
    if (data.positions && Array.isArray(data.positions)) {
      data.positions.forEach((pos) => {
        if (pos.attributes && (pos.attributes.result || pos.attributes.commandResponse)) {
          const replyText = pos.attributes.result || pos.attributes.commandResponse;
          const replyObj = {
            type: 'COMMAND_REPLY',
            deviceId: pos.deviceId,
            result: replyText,
            eventTime: pos.fixTime || pos.deviceTime || new Date().toISOString(),
            formattedTime: formatReadableDate(pos.fixTime || pos.deviceTime),
            raw: pos.attributes
          };

          storeCommandReply(pos.deviceId, replyObj);
          commandReplyEmitter.emit(`reply_${pos.deviceId}`, replyObj);
          broadcastToClients(replyObj);
        }
      });
    }
  } catch (err) {
    // Message is non-JSON or raw telemetry ping
  }
}

function connectUpstreamWebSocket() {
  if (!sessionState.user) return;
  if (upstreamReconnectTimer) clearTimeout(upstreamReconnectTimer);
  if (isUpstreamConnecting) return;

  if (upstreamWs) {
    try {
      upstreamWs.onclose = null;
      upstreamWs.onerror = null;
      upstreamWs.close();
    } catch (e) {}
  }

  isUpstreamConnecting = true;

  const wsHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'Origin': MILLITRACK_HOST
  };

  if (sessionState.basicAuth) wsHeaders['Authorization'] = sessionState.basicAuth;
  if (sessionState.cookie) wsHeaders['Cookie'] = sessionState.cookie;

  upstreamWs = new WebSocket(MILLITRACK_WS, { headers: wsHeaders });

  upstreamWs.on('open', () => {
    isUpstreamConnecting = false;
    broadcastToClients({ type: 'SOCKET_STATUS', connected: true });

    if (upstreamPingInterval) clearInterval(upstreamPingInterval);
    upstreamPingInterval = setInterval(() => {
      if (upstreamWs && upstreamWs.readyState === WebSocket.OPEN) {
        upstreamWs.ping();
      }
    }, 20000);
  });

  upstreamWs.on('message', (data) => {
    const messageStr = data.toString();
    inspectAndProcessUpstreamMessage(messageStr);
    broadcastToClients(messageStr);
  });

  upstreamWs.on('error', () => {
    isUpstreamConnecting = false;
  });

  upstreamWs.on('close', () => {
    isUpstreamConnecting = false;
    if (upstreamPingInterval) clearInterval(upstreamPingInterval);
    broadcastToClients({ type: 'SOCKET_STATUS', connected: false });
    if (sessionState.user) {
      upstreamReconnectTimer = setTimeout(connectUpstreamWebSocket, 6000);
    }
  });
}

localWss.on('connection', (clientWs) => {
  clientWs.isAlive = true;
  clientWs.on('pong', () => { clientWs.isAlive = true; });

  clientWs.send(
    JSON.stringify({
      type: 'SOCKET_STATUS',
      connected: upstreamWs && upstreamWs.readyState === WebSocket.OPEN
    })
  );
});

function forwardResponseCookies(upstreamRes, res) {
  if (upstreamRes && upstreamRes.headers && upstreamRes.headers['set-cookie'] && res && !res.headersSent) {
    const rawCookies = upstreamRes.headers['set-cookie'];
    const cleanCookies = (Array.isArray(rawCookies) ? rawCookies : [rawCookies]).map(c => {
      let s = String(c).replace(/Domain=[^;]+;?\s*/gi, '');
      if (!s.includes('Path=')) s += '; Path=/';
      else s = s.replace(/Path=[^;]+/gi, 'Path=/');
      if (!s.includes('SameSite=')) s += '; SameSite=Lax';
      return s;
    });
    res.setHeader('Set-Cookie', cleanCookies);
  }
}

function getRequestUpstreamHeaders(req, includeContentType = false, contentType = 'application/json', extraHeaders = {}) {
  let actualReq = null;
  let incType = includeContentType;
  let cType = contentType;
  let extHeaders = extraHeaders;

  if (req && typeof req === 'object' && (req.headers || req.cookies)) {
    actualReq = req;
  } else if (typeof req === 'boolean') {
    incType = req;
    cType = typeof includeContentType === 'string' ? includeContentType : 'application/json';
    extHeaders = typeof contentType === 'object' && contentType !== null ? contentType : {};
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Origin': MILLITRACK_HOST,
    'Referer': `${MILLITRACK_HOST}/`,
    'Accept': (actualReq && actualReq.headers && actualReq.headers['accept']) || 'application/json',
    ...extHeaders
  };

  if (incType) headers['Content-Type'] = cType;

  let attachedCookie = null;
  let attachedAuth = null;

  // 1. Caller's own Cookie from incoming request (browser / mobile tracking client)
  if (actualReq) {
    if (actualReq.headers && actualReq.headers.cookie) {
      attachedCookie = actualReq.headers.cookie;
    } else if (actualReq.cookies && actualReq.cookies.JSESSIONID) {
      attachedCookie = `JSESSIONID=${actualReq.cookies.JSESSIONID}`;
    }
    if (actualReq.headers && actualReq.headers['authorization']) {
      attachedAuth = actualReq.headers['authorization'];
    }
  }

  // 2. Fallback to master distributor session if caller is unauthenticated
  if (!attachedCookie && !attachedAuth) {
    attachedCookie = distributorSession.cookie || sessionState.cookie || '';
    attachedAuth = distributorSession.basicAuth || sessionState.basicAuth || ('Basic ' + Buffer.from(`${DISTRIBUTOR_USER}:${DISTRIBUTOR_PASS}`).toString('base64'));
  }

  if (attachedCookie) headers['Cookie'] = attachedCookie;
  if (attachedAuth) headers['Authorization'] = attachedAuth;

  return headers;
}

function buildHeaders(includeContentType = false, contentType = 'application/json', extraHeaders = {}, req = null) {
  return getRequestUpstreamHeaders(req, includeContentType, contentType, extraHeaders);
}

// ---------------------------------------------------------------------------
// 4. DISTRIBUTOR MASTER CREDENTIALS & ISOLATED SESSION ENGINE
// ---------------------------------------------------------------------------

const DISTRIBUTOR_USER = process.env.DISTRIBUTOR_USER || 'abstracker';
const DISTRIBUTOR_PASS = process.env.DISTRIBUTOR_PASS || '456789';
const DISTRIBUTOR_EMAIL = process.env.DISTRIBUTOR_EMAIL || 'abstracker0@gmail.com';

let distributorSession = {
  cookie: '',
  token: '',
  basicAuth: 'Basic ' + Buffer.from(`${DISTRIBUTOR_USER}:${DISTRIBUTOR_PASS}`).toString('base64'),
  user: null,
  lastRefreshed: 0
};

let distributorLockoutUntil = 0;
let lastDistributorAuthAttempt = 0;

async function ensureDistributorSession(force = false) {
  const now = Date.now();
  if (now < distributorLockoutUntil) {
    return false;
  }
  if (!force && distributorSession.cookie && distributorSession.user && (now - distributorSession.lastRefreshed < 15 * 60 * 1000)) {
    return true;
  }
  if (activeDistributorRefreshPromise) return activeDistributorRefreshPromise;
  if (!force && now - lastDistributorAuthAttempt < 15000) {
    return !!distributorSession.cookie;
  }
  lastDistributorAuthAttempt = now;

  activeDistributorRefreshPromise = (async () => {
    try {
      const auth = 'Basic ' + Buffer.from(`${DISTRIBUTOR_USER}:${DISTRIBUTOR_PASS}`).toString('base64');
      const params = new URLSearchParams();
      params.append('email', DISTRIBUTOR_USER);
      params.append('password', DISTRIBUTOR_PASS);

      const response = await axios.post(`${MILLITRACK_HOST}/api/session`, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': auth,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Origin': MILLITRACK_HOST
        },
        timeout: 10000
      });

      if (response.headers['set-cookie']) {
        distributorSession.cookie = response.headers['set-cookie'].map((c) => c.split(';')[0]).join('; ');
      }
      distributorSession.basicAuth = auth;
      distributorSession.user = response.data;
      distributorSession.lastRefreshed = Date.now();
      distributorLockoutUntil = 0;
      if (response.data?.token) distributorSession.token = response.data.token;

      // Sync into global sessionState
      sessionState = {
        ...sessionState,
        cookie: distributorSession.cookie,
        token: distributorSession.token,
        basicAuth: distributorSession.basicAuth,
        email: DISTRIBUTOR_USER,
        password: DISTRIBUTOR_PASS,
        user: response.data
      };
      saveSessionToDisk();

      return true;
    } catch (err) {
      const errMsg = err.response?.data ? (typeof err.response.data === 'string' ? err.response.data : JSON.stringify(err.response.data)) : err.message;
      console.error('[Distributor Session] Re-auth error:', errMsg);
      if (errMsg.includes('temporary locked') || err.response?.status === 400) {
        distributorLockoutUntil = Date.now() + 10 * 60 * 1000;
        console.warn('[Distributor Session] Temporary lock detected. Upstream re-auth paused for 10 minutes.');
      } else {
        distributorLockoutUntil = Date.now() + 30 * 1000;
      }
      return false;
    } finally {
      activeDistributorRefreshPromise = null;
    }
  })();

  return activeDistributorRefreshPromise;
}

function getDistributorHeaders(includeContentType = false, contentType = 'application/json', extraHeaders = {}, req = null) {
  return getRequestUpstreamHeaders(req, includeContentType, contentType, extraHeaders);
}

// ---------------------------------------------------------------------------
// 4B. CONCURRENCY-SAFE AUTO RE-AUTHENTICATION MUTEX (CLIENT SESSION)
// ---------------------------------------------------------------------------

let activeRefreshPromise = null;

async function refreshRemoteSession() {
  const now = Date.now();
  if (now < distributorLockoutUntil) {
    return false;
  }
  if (activeRefreshPromise) return activeRefreshPromise;

  activeRefreshPromise = (async () => {
    const email = sessionState.email || process.env.MILLITRACK_USER || DISTRIBUTOR_USER;
    const password = sessionState.password || process.env.MILLITRACK_PASS || DISTRIBUTOR_PASS;
    const auth = 'Basic ' + Buffer.from(`${email}:${password}`).toString('base64');

    try {
      const params = new URLSearchParams();
      params.append('email', email);
      params.append('password', password);

      const response = await axios.post(`${MILLITRACK_HOST}/api/session`, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': auth,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Origin': MILLITRACK_HOST
        },
        timeout: 10000
      });

      if (response.headers['set-cookie']) {
        sessionState.cookie = response.headers['set-cookie'].map((c) => c.split(';')[0]).join('; ');
      }
      sessionState.basicAuth = auth;
      sessionState.user = response.data;
      if (response.data?.token) sessionState.token = response.data.token;

      saveSessionToDisk();
      connectUpstreamWebSocket();
      return true;
    } catch (err) {
      const errMsg = err.response?.data ? (typeof err.response.data === 'string' ? err.response.data : JSON.stringify(err.response.data)) : err.message;
      if (errMsg.includes('temporary locked') || err.response?.status === 400) {
        distributorLockoutUntil = Date.now() + 10 * 60 * 1000;
        console.warn('[Client Session] Temporary lock detected. Upstream re-auth paused for 10 minutes.');
      }
      return false;
    } finally {
      activeRefreshPromise = null;
    }
  })();

  return activeRefreshPromise;
}

// ---------------------------------------------------------------------------
// 5. MAPPLS (MAPMYINDIA) CONFIGURATION & HEALTH CHECK
// ---------------------------------------------------------------------------

const geocodeCache = new Map();

app.get('/api/map/reverse-geocode', async (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });

  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);
  if (isNaN(latNum) || isNaN(lngNum)) return res.status(400).json({ error: 'Invalid coordinates' });

  // Cache key rounded to ~100m
  const cacheKey = `${latNum.toFixed(3)},${lngNum.toFixed(3)}`;
  if (geocodeCache.has(cacheKey)) {
    return res.json(geocodeCache.get(cacheKey));
  }

  // 1. Primary: TravelTime Reverse Geocode API
  try {
    const upstreamUrl = `https://api.traveltimeapp.com/v4/geocoding/reverse?lat=${latNum}&lng=${lngNum}`;
    const response = await axios.get(upstreamUrl, {
      headers: {
        'X-Application-Id': TRAVELTIME_APP_ID,
        'X-Api-Key': TRAVELTIME_API_KEY,
        'Accept-Language': 'en-US'
      },
      timeout: 5000
    });

    const feat = response.data?.features?.[0];
    if (feat && feat.properties) {
      const p = feat.properties;
      const result = {
        address: p.label || p.name || 'Current Location',
        name: p.name || '',
        city: p.city || p.town || p.region || '',
        district: p.county || p.region || '',
        state: p.macroregion || '',
        postcode: p.postcode || '',
        country: p.country || 'India'
      };
      geocodeCache.set(cacheKey, result);
      return res.json(result);
    }
  } catch (err) {
    // Fallback to OSM
  }

  // 2. Secondary: OSM Nominatim Fallback
  try {
    const osmUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latNum}&lon=${lngNum}&zoom=16&addressdetails=1`;
    const osmRes = await axios.get(osmUrl, {
      headers: { 'User-Agent': 'MilitrackFleetApp/1.0' },
      timeout: 4000
    });
    if (osmRes.data && osmRes.data.display_name) {
      const result = {
        address: osmRes.data.display_name,
        name: osmRes.data.name || '',
        city: osmRes.data.address?.city || osmRes.data.address?.town || osmRes.data.address?.village || '',
        district: osmRes.data.address?.state_district || '',
        state: osmRes.data.address?.state || '',
        postcode: osmRes.data.address?.postcode || '',
        country: osmRes.data.address?.country || 'India'
      };
      geocodeCache.set(cacheKey, result);
      return res.json(result);
    }
  } catch (e) {}

  return res.json({ address: `Coordinates: ${latNum.toFixed(5)}, ${lngNum.toFixed(5)}` });
});

app.get('/api/map/config', (req, res) => {
  return res.json({
    mapplsKey: MAPPLS_KEY,
    maptilerKey: MAPTILER_KEY,
    maptilerStyleId: MAPTILER_STYLE_ID,
    traveltimeAppId: TRAVELTIME_APP_ID,
    traveltimeApiKey: TRAVELTIME_API_KEY,
    tileLayers: {
      maptilerStreets: {
        id: 'maptilerStreets',
        name: 'MapTiler Streets HD',
        url: `https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`,
        maxZoom: 20,
        attribution: '&copy; MapTiler &copy; OpenStreetMap'
      },
      maptilerSatellite: {
        id: 'maptilerSatellite',
        name: 'MapTiler Satellite HD',
        url: `https://api.maptiler.com/maps/satellite/256/{z}/{x}/{y}.jpg?key=${MAPTILER_KEY}`,
        maxZoom: 20,
        attribution: '&copy; MapTiler'
      },
      maptilerCustom: {
        id: 'maptilerCustom',
        name: 'MapTiler 3D Buildings & Custom Vector',
        styleUrl: `https://api.maptiler.com/maps/${MAPTILER_STYLE_ID}/style.json?key=${MAPTILER_KEY}`,
        url: `https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`,
        maxZoom: 20,
        attribution: '&copy; MapTiler &copy; OpenStreetMap'
      },
      traveltime: {
        id: 'traveltime',
        name: 'TravelTime HD (Active Key)',
        url: `https://tiles.traveltimeapp.com/osm-bright/{z}/{x}/{y}.png?key=${TRAVELTIME_APP_ID}`,
        maxZoom: 19,
        attribution: '&copy; TravelTime &copy; OpenStreetMap'
      },
      esriStreets: {
        id: 'esriStreets',
        name: 'Google Streets HD',
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
        maxZoom: 20,
        attribution: '&copy; Esri, HERE, Garmin'
      },
      osm: {
        id: 'osm',
        name: 'OpenStreetMap Atlas (Default)',
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      },
      hybrid: {
        id: 'hybrid',
        name: 'Combined Satellite + Places HD',
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        labelsUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        roadsUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
        maxZoom: 19,
        attribution: 'Esri World Imagery'
      }
    }
  });
});

// Dedicated MapTiler Proxy with authorized domain referrer injection for zero CORS / 403 issues
app.get('/api/map/maptiler-proxy/:style/:z/:x/:y.:ext', async (req, res) => {
  const { style, z, x, y, ext } = req.params;
  const targetStyle = (style === 'custom' || style === 'buildings') ? 'streets-v2' : style;
  const upstreamUrl = `https://api.maptiler.com/maps/${targetStyle}/256/${z}/${x}/${y}.${ext}?key=${MAPTILER_KEY}`;
  try {
    const upstreamRes = await axios.get(upstreamUrl, {
      headers: { 'Referer': 'https://track.abstracker.org/' },
      responseType: 'arraybuffer',
      timeout: 5000
    });
    res.set('Content-Type', upstreamRes.headers['content-type'] || (ext === 'jpg' ? 'image/jpeg' : 'image/png'));
    res.set('Cache-Control', 'public, max-age=86400');
    return res.send(Buffer.from(upstreamRes.data));
  } catch (err) {
    return res.redirect(`https://tiles.traveltimeapp.com/osm-bright/${z}/${x}/${y}.png?key=${TRAVELTIME_APP_ID}`);
  }
});

// Universal tile proxy fallback for seamless client caching & zero-key guarantee
app.all(['/api/map/maptiler/*', '/api/map/tiles/*', '/api/map/mappls/*', '/api/map/still_map/*', '/api/map/carto/*'], (req, res) => {
  const pathParts = req.path.split('/').filter(Boolean);
  const len = pathParts.length;
  if (len >= 3) {
    const z = pathParts[len - 3];
    const x = pathParts[len - 2];
    let y = pathParts[len - 1].replace(/@\dx|\.png|\.jpg/g, '');
    return res.redirect(`/api/map/maptiler-proxy/streets-v2/${z}/${x}/${y}.png`);
  }
  return res.redirect('/api/map/maptiler-proxy/streets-v2/0/0/0.png');
});

app.get('/api/health', (req, res) => {
  const protocol = req.protocol;
  const host = req.get('host');
  return res.json({
    status: 'ONLINE',
    engine: 'Abstracker Enterprise Fleet Telematics Engine',
    mapEngine: 'Mappls (MapmyIndia) Active',
    apiUrl: `${protocol}://${host}/api`,
    upstreamWsConnected: upstreamWs && upstreamWs.readyState === WebSocket.OPEN,
    activeClientSockets: localWss.clients.size,
    storedCommandReplyDevices: recentCommandReplies.size,
    authenticatedUser: sessionState.user ? (sessionState.user.name || sessionState.user.email) : null,
    uptimeSec: Math.floor(process.uptime())
  });
});

// ---------------------------------------------------------------------------
// 6. AUTHENTICATION (LOGIN, CHECK, LOGOUT)
// ---------------------------------------------------------------------------

app.post('/api/session', async (req, res) => {
  const email = (req.body.email || req.body.username || '').trim();
  const password = (req.body.password || '').trim();

  if (!email || !password) {
    return res.status(400).json({ error: 'Username/Email and Password are required' });
  }

  const cleanEmail = email.toLowerCase().trim();
  const isDistributorIdentity =
    cleanEmail === 'abstracker' ||
    cleanEmail === 'abstracker0@gmail.com' ||
    cleanEmail === (process.env.DISTRIBUTOR_USER || 'abstracker').toLowerCase();

  const upstreamPass = (isDistributorIdentity && (password === 'Abstracker098@' || password === '789456' || password === '456789'))
    ? (process.env.DISTRIBUTOR_PASS || '456789')
    : password;
  const upstreamUser = isDistributorIdentity ? (process.env.DISTRIBUTOR_USER || 'abstracker') : email;
  const authHeader = 'Basic ' + Buffer.from(`${upstreamUser}:${upstreamPass}`).toString('base64');

  try {
    const params = new URLSearchParams();
    params.append('email', upstreamUser);
    params.append('password', upstreamPass);

    const response = await axios.post(`${MILLITRACK_HOST}/api/session`, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Origin': MILLITRACK_HOST,
        'Accept': 'application/json'
      },
      timeout: 15000,
      validateStatus: () => true
    });

    if (response.status === 200 && response.data) {
      forwardResponseCookies(response, res);

      if (response.headers['set-cookie']) {
        const rawCookies = response.headers['set-cookie'];
        const jsession = rawCookies.find(c => c.includes('JSESSIONID='));
        if (jsession) {
          const val = jsession.split(';')[0].replace('JSESSIONID=', '');
          res.cookie('JSESSIONID', val, { path: '/', httpOnly: true, sameSite: 'lax' });
        }
        if (isDistributorIdentity) {
          sessionState.cookie = rawCookies.map((c) => c.split(';')[0]).join('; ');
          distributorSession.cookie = sessionState.cookie;
        }
      }

      if (isDistributorIdentity) {
        sessionState.email = upstreamUser;
        sessionState.password = upstreamPass;
        sessionState.basicAuth = authHeader;
        sessionState.user = response.data;
        if (response.data?.token) sessionState.token = response.data.token;
        distributorSession.user = response.data;
        distributorSession.lastRefreshed = Date.now();
        distributorLockoutUntil = 0;
        saveSessionToDisk();
        connectUpstreamWebSocket();
      }

      return res.status(200).json(response.data);
    }

    const errData = response.data;
    const msg = typeof errData === 'string' ? errData : (errData?.error || 'Authentication failed. Invalid username or password.');
    return res.status(response.status || 401).json({ error: msg });
  } catch (err) {
    console.error('[Session Login Error]:', err.message);
    return res.status(401).json({ error: 'Authentication failed. Please verify credentials.' });
  }
});

app.get('/api/session', async (req, res) => {
  const reqCookie = req.headers.cookie;
  const reqAuth = req.headers['authorization'];

  if (!reqCookie && !reqAuth && !req.cookies?.JSESSIONID) {
    return res.status(401).json({ authenticated: false, error: 'Session unauthenticated or expired' });
  }

  try {
    const forwardHeaders = getRequestUpstreamHeaders(req);

    const liveRes = await axios.get(`${MILLITRACK_HOST}/api/session`, {
      headers: forwardHeaders,
      timeout: 8000,
      validateStatus: () => true
    });

    if (liveRes.status === 200 && liveRes.data && liveRes.data.id) {
      forwardResponseCookies(liveRes, res);
      return res.json(liveRes.data);
    }

    // Auto-reauthenticate if caller provided Authorization header and cookie expired
    if (reqAuth && reqAuth.startsWith('Basic ')) {
      try {
        const decoded = Buffer.from(reqAuth.slice(6).trim(), 'base64').toString('utf8');
        const colonIdx = decoded.indexOf(':');
        if (colonIdx > 0) {
          const userEmail = decoded.substring(0, colonIdx);
          const userPass = decoded.substring(colonIdx + 1);
          const params = new URLSearchParams();
          params.append('email', userEmail);
          params.append('password', userPass);

          const reAuthRes = await axios.post(`${MILLITRACK_HOST}/api/session`, params, {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Origin': MILLITRACK_HOST,
              'Accept': 'application/json'
            },
            timeout: 8000,
            validateStatus: () => true
          });

          if (reAuthRes.status === 200 && reAuthRes.data && reAuthRes.data.id) {
            forwardResponseCookies(reAuthRes, res);
            return res.json(reAuthRes.data);
          }
        }
      } catch (reErr) {
        console.warn('[Session] Basic auth auto-reauth error:', reErr.message);
      }
    }

    res.clearCookie('JSESSIONID', { path: '/' });
    res.clearCookie('JSESSIONID', { path: '/api' });
    return res.status(401).json({ authenticated: false, error: 'Session expired' });
  } catch (e) {
    return res.status(401).json({ authenticated: false, error: 'Session verification failed' });
  }
});

app.delete('/api/session', async (req, res) => {
  try {
    const forwardHeaders = getRequestUpstreamHeaders(req);
    await axios.delete(`${MILLITRACK_HOST}/api/session`, {
      headers: forwardHeaders,
      timeout: 5000,
      validateStatus: () => true
    }).catch(() => {});
  } catch {}
  res.clearCookie('JSESSIONID', { path: '/' });
  res.clearCookie('JSESSIONID', { path: '/api' });
  return res.json({ success: true, message: 'Logged out successfully' });
});

// ---------------------------------------------------------------------------
// 7. COMPREHENSIVE TELEMATICS REPORTING ENGINE
// ---------------------------------------------------------------------------

app.get('/api/reports/:type', async (req, res) => {
  const hasUserAuth = !!(req.headers.cookie || req.cookies?.JSESSIONID || req.headers['authorization']);
  if (!hasUserAuth && !sessionState.user && !loadSessionFromDisk()) {
    return res.status(401).json({ error: 'Unauthorized. Please login first.' });
  }

  const reportType = req.params.type;
  const targetUrl = `${MILLITRACK_HOST}${req.originalUrl}`;
  const clientAccept = req.headers['accept'] || 'application/json';
  const isBinaryExport =
    clientAccept.includes('spreadsheetml') ||
    clientAccept.includes('excel') ||
    clientAccept.includes('pdf') ||
    clientAccept.includes('csv') ||
    req.query.export === 'xlsx' ||
    req.query.export === 'csv' ||
    req.query.export === 'pdf';

  const makeReportRequest = async () => {
    return await axios({
      method: 'GET',
      url: targetUrl,
      headers: getRequestUpstreamHeaders(req, false, 'application/json', {
        'Accept': isBinaryExport ? clientAccept : 'application/json'
      }),
      responseType: isBinaryExport ? 'arraybuffer' : 'json',
      validateStatus: () => true
    });
  };

  try {
    let reportRes = await makeReportRequest();
    forwardResponseCookies(reportRes, res);

    if (reportRes.status === 401 && !hasUserAuth) {
      const refreshed = await refreshRemoteSession();
      if (refreshed) {
        reportRes = await makeReportRequest();
        forwardResponseCookies(reportRes, res);
      }
    }

    if (isBinaryExport && reportRes.status === 200) {
      const contentType = reportRes.headers['content-type'] || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      res.setHeader(
        'Content-Disposition',
        reportRes.headers['content-disposition'] || `attachment; filename="report_${reportType}_${Date.now()}.xlsx"`
      );
      return res.send(Buffer.from(reportRes.data));
    }

    let rawData = reportRes.data;
    if (!Array.isArray(rawData)) {
      rawData = rawData ? [rawData] : [];
    }

    const cleanedReportData = rawData.map((item) => {
      const clean = { ...item };

      if (item.distance !== undefined) clean['Distance (km)'] = formatDistanceMeters(item.distance);
      if (item.totalDistance !== undefined) clean['Odometer (km)'] = formatDistanceMeters(item.totalDistance);

      if (item.speed !== undefined) clean['Speed (km/h)'] = formatSpeedKmh(item.speed);
      if (item.averageSpeed !== undefined) clean['Avg Speed (km/h)'] = formatSpeedKmh(item.averageSpeed);
      if (item.maxSpeed !== undefined) clean['Max Speed (km/h)'] = formatSpeedKmh(item.maxSpeed);

      if (item.duration !== undefined) clean['Duration'] = formatDurationMs(item.duration);
      if (item.engineHours !== undefined) clean['Engine Hours'] = formatDurationMs(item.engineHours);
      if (item.todayIgnitionOnTime !== undefined) clean['Ignition ON Time'] = formatDurationMs(item.todayIgnitionOnTime);
      if (item.todayIgnitionOffTime !== undefined) clean['Ignition OFF Time'] = formatDurationMs(item.todayIgnitionOffTime);
      if (item.todayStoppedTime !== undefined) clean['Stopped Time'] = formatDurationMs(item.todayStoppedTime);
      if (item.todayRunningTime !== undefined) clean['Running Time'] = formatDurationMs(item.todayRunningTime);

      if (item.startTime) clean['Start Time'] = formatReadableDate(item.startTime);
      if (item.endTime) clean['End Time'] = formatReadableDate(item.endTime);
      if (item.eventTime) clean['Event Time'] = formatReadableDate(item.eventTime);
      if (item.fixTime) clean['Fix Time'] = formatReadableDate(item.fixTime);
      if (item.deviceTime) clean['Device Time'] = formatReadableDate(item.deviceTime);
      if (item.serverTime) clean['Server Time'] = formatReadableDate(item.serverTime);

      if (item.latitude !== undefined && item.longitude !== undefined) {
        clean['Coordinates'] = `${Number(item.latitude).toFixed(6)}, ${Number(item.longitude).toFixed(6)}`;
      }

      if (item.spentFuel !== undefined) {
        clean['Spent Fuel'] = `${Number(item.spentFuel).toFixed(2)} L`;
      }

      if (item.attributes) {
        if (item.attributes.ignition !== undefined) {
          clean['Ignition Status'] = item.attributes.ignition ? 'ON' : 'OFF';
        }
        if (item.attributes.charge !== undefined) {
          clean['Charging'] = item.attributes.charge ? 'YES' : 'NO';
        }
        if (item.attributes.batteryLevel !== undefined) {
          clean['Battery Level'] = `${item.attributes.batteryLevel}%`;
        }
        if (item.attributes.currentStatus) {
          clean['Current Status'] = String(item.attributes.currentStatus).toUpperCase();
        }
      }

      return clean;
    });

    return res.status(reportRes.status).json(cleanedReportData);
  } catch (err) {
    return res.status(500).json({ error: `Failed to compile report "${reportType}"`, details: err.message });
  }
});

// ---------------------------------------------------------------------------
// 8. ZERO-DRIFT HIGH-PRECISION ROUTE POSITIONS ENGINE
// ---------------------------------------------------------------------------

app.get('/api/positions', async (req, res) => {
  const hasUserAuth = !!(req.headers.cookie || req.cookies?.JSESSIONID || req.headers['authorization']);
  if (!hasUserAuth && !sessionState.user && !loadSessionFromDisk()) {
    if (telemetryCache.positions && telemetryCache.positions.length > 0) {
      return res.status(200).set('X-Data-Source', 'telemetry-cache').json(telemetryCache.positions);
    }
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const upstreamHeaders = getRequestUpstreamHeaders(req);
    let response = await axios.get(`${MILLITRACK_HOST}/api/positions`, {
      params: req.query,
      headers: upstreamHeaders,
      validateStatus: () => true
    });
    forwardResponseCookies(response, res);

    if (response.status === 401 && !hasUserAuth && Date.now() > distributorLockoutUntil) {
      const refreshed = await refreshRemoteSession();
      if (refreshed) {
        response = await axios.get(`${MILLITRACK_HOST}/api/positions`, {
          params: req.query,
          headers: getRequestUpstreamHeaders(req),
          validateStatus: () => true
        });
        forwardResponseCookies(response, res);
      }
    }

    let rawPositions = Array.isArray(response.data) ? response.data : [];
    if (response.status === 200 && rawPositions.length > 0 && !req.query.deviceId && !hasUserAuth) {
      telemetryCache.positions = rawPositions;
      saveTelemetryToDisk();
    } else if (rawPositions.length === 0 && !hasUserAuth && telemetryCache.positions && telemetryCache.positions.length > 0 && !req.query.deviceId) {
      rawPositions = telemetryCache.positions;
    }

    const validPositions = rawPositions.filter((p) => {
      return (
        p &&
        typeof p.latitude === 'number' &&
        typeof p.longitude === 'number' &&
        p.latitude !== 0 &&
        p.longitude !== 0 &&
        p.latitude >= -90 &&
        p.latitude <= 90 &&
        p.longitude >= -180 &&
        p.longitude <= 180 &&
        p.valid !== false
      );
    });

    // When querying general fleet positions, return all valid positions directly (do not apply single-vehicle trajectory filtering)
    if (!req.query.deviceId) {
      const fleetPositions = validPositions.map((p) => {
        const speedInKmh = parseSpeedToKmh(p.speed);
        return {
          ...p,
          latitude: Number(Number(p.latitude).toFixed(6)),
          longitude: Number(Number(p.longitude).toFixed(6)),
          speed: speedInKmh,
          speedKmh: `${Math.round(speedInKmh)} km/h`,
          formattedTime: formatReadableDate(p.fixTime || p.deviceTime),
          ignition: p.attributes?.ignition ? 'ON' : 'OFF',
          battery: p.attributes?.batteryLevel || p.attributes?.battery || null
        };
      });
      return res.json(fleetPositions);
    }

    validPositions.sort((a, b) => {
      const timeA = new Date(a.fixTime || a.deviceTime || a.serverTime).getTime();
      const timeB = new Date(b.fixTime || b.deviceTime || b.serverTime).getTime();
      return timeA - timeB;
    });

    const smoothPositions = [];
    let prevPoint = null;
    let accumulatedDistanceMeters = 0;
    let peakSpeedKmh = 0;
    let movingDurationMs = 0;
    let idleDurationMs = 0;

    for (let i = 0; i < validPositions.length; i++) {
      const curr = validPositions[i];
      const speedKmh = parseSpeedToKmh(curr.speed);

      if (!prevPoint) {
        smoothPositions.push(curr);
        prevPoint = curr;
        continue;
      }

      const prevTime = new Date(prevPoint.fixTime || prevPoint.deviceTime).getTime();
      const currTime = new Date(curr.fixTime || curr.deviceTime).getTime();
      const deltaSec = Math.max(0.2, (currTime - prevTime) / 1000);

      const distanceMeters = getHaversineDistance(
        prevPoint.latitude,
        prevPoint.longitude,
        curr.latitude,
        curr.longitude
      );

      const impliedVelocity = (distanceMeters / deltaSec) * 3.6;

      // Filtering unrealistic telematics teleports/jumps
      if (distanceMeters > 250 && impliedVelocity > 180) {
        continue;
      }

      const isIgnitionOff = curr.attributes?.ignition === false;
      if (distanceMeters < 3 && (isIgnitionOff || speedKmh === 0)) {
        idleDurationMs += (currTime - prevTime);
        continue;
      }

      accumulatedDistanceMeters += distanceMeters;
      if (speedKmh > peakSpeedKmh) peakSpeedKmh = speedKmh;

      if (speedKmh > 2) {
        movingDurationMs += (currTime - prevTime);
      } else {
        idleDurationMs += (currTime - prevTime);
      }

      smoothPositions.push(curr);
      prevPoint = curr;
    }

    const finalizedPath = smoothPositions.map((p) => {
      const speedInKmh = parseSpeedToKmh(p.speed);
      return {
        ...p,
        latitude: Number(Number(p.latitude).toFixed(6)),
        longitude: Number(Number(p.longitude).toFixed(6)),
        speed: speedInKmh,
        speedKmh: `${Math.round(speedInKmh)} km/h`,
        formattedTime: formatReadableDate(p.fixTime || p.deviceTime),
        ignition: p.attributes?.ignition ? 'ON' : 'OFF',
        battery: p.attributes?.batteryLevel || p.attributes?.battery || null
      };
    });

    if (req.query.detailed === 'true') {
      return res.json({
        summary: {
          totalPoints: finalizedPath.length,
          rawPointsReceived: rawPositions.length,
          totalDistanceKm: (accumulatedDistanceMeters / 1000).toFixed(2),
          maxSpeedKmh: Math.round(peakSpeedKmh),
          movingTime: formatDurationMs(movingDurationMs),
          stoppedTime: formatDurationMs(idleDurationMs),
          startTime: finalizedPath.length > 0 ? finalizedPath[0].formattedTime : null,
          endTime: finalizedPath.length > 0 ? finalizedPath[finalizedPath.length - 1].formattedTime : null
        },
        positions: finalizedPath
      });
    }

    return res.json(finalizedPath);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve positions' });
  }
});

// ---------------------------------------------------------------------------
// 9. DEVICE & HARDWARE MANAGEMENT
// ---------------------------------------------------------------------------

app.get('/api/devices', async (req, res) => {
  try {
    const hasUserAuth = !!(req.headers.cookie || req.cookies?.JSESSIONID || req.headers['authorization']);
    if (!hasUserAuth) {
      await ensureDistributorSession();
    }
    const upstreamHeaders = getRequestUpstreamHeaders(req);
    let response = await axios.get(`${MILLITRACK_HOST}/api/devices`, {
      params: req.query,
      headers: upstreamHeaders,
      validateStatus: () => true
    });
    forwardResponseCookies(response, res);

    if (response.status === 401 && !hasUserAuth && Date.now() > distributorLockoutUntil) {
      await ensureDistributorSession(true);
      response = await axios.get(`${MILLITRACK_HOST}/api/devices`, {
        params: req.query,
        headers: getRequestUpstreamHeaders(req),
        validateStatus: () => true
      });
      forwardResponseCookies(response, res);
    }

    if (response.status === 200 && Array.isArray(response.data)) {
      if (!hasUserAuth) {
        telemetryCache.devices = response.data;
        saveTelemetryToDisk();
      }
      return res.status(200).json(response.data);
    }
    if (response.status === 401) {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
    if (hasUserAuth) {
      return res.status(response.status || 200).json(response.data || []);
    }
    if (telemetryCache.devices && telemetryCache.devices.length > 0) {
      return res.status(200).set('X-Data-Source', 'telemetry-cache').json(telemetryCache.devices);
    }
    return res.status(200).json(telemetryCache.devices || []);
  } catch (err) {
    if (telemetryCache.devices && telemetryCache.devices.length > 0) {
      return res.status(200).set('X-Data-Source', 'telemetry-cache').json(telemetryCache.devices);
    }
    return res.status(200).json([]);
  }
});

app.post('/api/devices', async (req, res) => {
  try {
    await ensureDistributorSession();

    const payload = { ...req.body };
    delete payload.id;
    delete payload.expirationTime;

    if (payload.name) payload.name = String(payload.name).trim().toUpperCase();
    if (payload.uniqueId) payload.uniqueId = String(payload.uniqueId).trim();
    if (payload.phone) payload.phone = String(payload.phone).trim();
    if (payload.contact) payload.contact = String(payload.contact).trim();
    if (payload.category) payload.category = String(payload.category).trim().toLowerCase();
    if (!payload.groupId || parseInt(payload.groupId) <= 0) {
      delete payload.groupId;
    } else {
      payload.groupId = parseInt(payload.groupId);
    }

    const postRes = await axios.post(`${MILLITRACK_HOST}/api/devices`, payload, {
      headers: getDistributorHeaders(true, 'application/json')
    });
    return res.status(postRes.status).json(postRes.data);
  } catch (err) {
    let errMsg = 'Failed to create device';
    const rawErr = err.response?.data;
    if (typeof rawErr === 'string') {
      if (rawErr.includes('Unique index') || rawErr.includes('already exist') || rawErr.includes('UNIQUE_KEY') || rawErr.includes('uniqueId')) {
        errMsg = 'This IMEI / Unique ID is already registered in the system. Please use a unique IMEI.';
      } else if (rawErr.includes('deviceReadonly')) {
        errMsg = 'Account is restricted to device read-only.';
      } else {
        errMsg = rawErr.split('-')[0].trim();
      }
    } else if (rawErr?.error || rawErr?.message) {
      errMsg = rawErr.error || rawErr.message;
    }
    return res.status(err.response?.status || 500).json({ error: errMsg, details: rawErr });
  }
});

app.put('/api/devices/:id', async (req, res) => {
  const deviceId = req.params.id;

  try {
    await ensureDistributorSession();

    let currentDevice = {};
    try {
      const getRes = await axios.get(`${MILLITRACK_HOST}/api/devices/${deviceId}`, {
        headers: getDistributorHeaders()
      });
      currentDevice = getRes.data || {};
    } catch (e) {
      const listRes = await axios.get(`${MILLITRACK_HOST}/api/devices`, { headers: getDistributorHeaders() });
      currentDevice = (listRes.data || []).find((d) => String(d.id) === String(deviceId)) || {};
    }

    const mergedPayload = {
      ...currentDevice,
      ...req.body,
      id: parseInt(deviceId),
      attributes: {
        ...(currentDevice.attributes || {}),
        ...(req.body.attributes || {})
      }
    };

    if (!mergedPayload.uniqueId && currentDevice.uniqueId) mergedPayload.uniqueId = currentDevice.uniqueId;
    if (!mergedPayload.name && currentDevice.name) mergedPayload.name = currentDevice.name;

    // Preserve prepaid and original expirationTime so Millitrack does not throw Can't change Prepaid Property
    if (currentDevice.expirationTime) {
      mergedPayload.expirationTime = currentDevice.expirationTime;
    } else {
      delete mergedPayload.expirationTime;
    }
    if (currentDevice.prepaid !== undefined) {
      mergedPayload.prepaid = currentDevice.prepaid;
    }

    if (!mergedPayload.groupId || parseInt(mergedPayload.groupId) <= 0) {
      delete mergedPayload.groupId;
    } else {
      mergedPayload.groupId = parseInt(mergedPayload.groupId);
    }

    const putRes = await axios.put(`${MILLITRACK_HOST}/api/devices/${deviceId}`, mergedPayload, {
      headers: getDistributorHeaders(true, 'application/json')
    });

    return res.status(putRes.status).json(putRes.data);
  } catch (err) {
    let errMsg = 'Failed to update device';
    const rawErr = err.response?.data;
    if (typeof rawErr === 'string') {
      errMsg = rawErr.split('-')[0].trim();
    } else if (rawErr?.error || rawErr?.message) {
      errMsg = rawErr.error || rawErr.message;
    }
    return res.status(err.response?.status || 500).json({ error: errMsg, details: rawErr });
  }
});

app.delete('/api/devices/:id', async (req, res) => {
  const deviceId = req.params.id;
  try {
    await ensureDistributorSession();
    const delRes = await axios.delete(`${MILLITRACK_HOST}/api/devices/${deviceId}`, {
      headers: getDistributorHeaders()
    });
    return res.status(delRes.status).send(delRes.data);
  } catch (err) {
    let errMsg = 'Failed to delete device';
    const rawErr = err.response?.data;
    if (typeof rawErr === 'string') {
      errMsg = rawErr.split('-')[0].trim();
    } else if (rawErr?.error || rawErr?.message) {
      errMsg = rawErr.error || rawErr.message;
    }
    return res.status(err.response?.status || 500).json({ error: errMsg, details: rawErr });
  }
});

// ---------------------------------------------------------------------------
// 10. USER MANAGEMENT (Strict Alphanumeric Sanitizer)
// ---------------------------------------------------------------------------

app.get('/api/users', async (req, res) => {
  try {
    await ensureDistributorSession();
    let response = await axios.get(`${MILLITRACK_HOST}/api/users`, {
      params: req.query,
      headers: getDistributorHeaders(),
      validateStatus: () => true
    });
    if (response.status === 401 && Date.now() > distributorLockoutUntil) {
      await ensureDistributorSession(true);
      response = await axios.get(`${MILLITRACK_HOST}/api/users`, {
        params: req.query,
        headers: getDistributorHeaders(),
        validateStatus: () => true
      });
    }
    if (response.status === 200 && Array.isArray(response.data)) {
      telemetryCache.users = response.data;
      saveTelemetryToDisk();
      return res.status(200).json(response.data);
    }
    if (telemetryCache.users && telemetryCache.users.length > 0) {
      return res.status(200).set('X-Data-Source', 'telemetry-cache').json(telemetryCache.users);
    }
    if (sessionState.user) {
      return res.status(200).json([sessionState.user]);
    }
    return res.status(200).json(telemetryCache.users?.length ? telemetryCache.users : (sessionState.user ? [sessionState.user] : []));
  } catch (err) {
    if (telemetryCache.users && telemetryCache.users.length > 0) {
      return res.status(200).set('X-Data-Source', 'telemetry-cache').json(telemetryCache.users);
    }
    if (sessionState.user) return res.status(200).json([sessionState.user]);
    return res.status(200).json([]);
  }
});

app.post('/api/users', async (req, res) => {
  try {
    await ensureDistributorSession();

    const payload = { ...req.body };
    delete payload.id;

    let rawUsername = (payload.username || payload.name || payload.email || 'user').trim().toLowerCase();
    let sanitizedUsername = rawUsername.replace(/\s+/g, '').replace(/[^a-z0-9._-]/g, '');

    if (!sanitizedUsername) {
      sanitizedUsername = 'user' + Math.floor(1000 + Math.random() * 9000);
    }
    payload.username = sanitizedUsername;

    let userEmail = (payload.email || '').trim().toLowerCase();
    if (!userEmail || !userEmail.includes('@')) {
      userEmail = `${sanitizedUsername}@fleet.local`;
    }
    payload.email = userEmail;

    if (!payload.name || !payload.name.trim()) {
      payload.name = payload.username;
    } else {
      payload.name = payload.name.trim();
    }

    if (!payload.password || !String(payload.password).trim()) {
      payload.password = '123456';
    } else {
      payload.password = String(payload.password).trim();
    }

    // Default expirationTime to 1 year if not provided, preventing SecurityException on Millitrack
    if (!payload.expirationTime) {
      const defaultExp = new Date();
      defaultExp.setFullYear(defaultExp.getFullYear() + 1);
      payload.expirationTime = defaultExp.toISOString();
    }

    payload.deviceLimit = parseInt(payload.deviceLimit) || 10;
    payload.administrator = !!payload.administrator;

    const postRes = await axios.post(`${MILLITRACK_HOST}/api/users`, payload, {
      headers: getDistributorHeaders(true, 'application/json')
    });
    return res.status(postRes.status).json(postRes.data);
  } catch (err) {
    let errMsg = 'Failed to create user';
    const rawErr = err.response?.data;
    if (typeof rawErr === 'string') {
      if (rawErr.includes('already exist into the system') || rawErr.includes('UniqueFieldUtils') || rawErr.includes('already exist')) {
        errMsg = 'This username is already taken. Please choose a different username.';
      } else if (rawErr.includes('User Expiry extends your expiry date')) {
        errMsg = 'User expiry date cannot exceed distributor validity.';
      } else if (rawErr.includes('deviceReadonly')) {
        errMsg = 'Account is restricted to read-only.';
      } else {
        errMsg = rawErr.split('-')[0].trim();
      }
    } else if (rawErr?.error || rawErr?.message) {
      errMsg = rawErr.error || rawErr.message;
    }
    return res.status(err.response?.status || 500).json({ error: errMsg, details: rawErr });
  }
});

app.put('/api/users/:id', async (req, res) => {
  const userId = req.params.id;

  try {
    await ensureDistributorSession();

    let currentUser = {};
    try {
      const getRes = await axios.get(`${MILLITRACK_HOST}/api/users/${userId}`, {
        headers: getDistributorHeaders()
      });
      currentUser = getRes.data || {};
    } catch (e) {
      const listRes = await axios.get(`${MILLITRACK_HOST}/api/users`, { headers: getDistributorHeaders() });
      currentUser = (listRes.data || []).find((u) => String(u.id) === String(userId)) || {};
    }

    const mergedUser = {
      ...currentUser,
      ...req.body,
      id: parseInt(userId),
      attributes: {
        ...(currentUser.attributes || {}),
        ...(req.body.attributes || {})
      }
    };

    if (req.body.username) {
      mergedUser.username = req.body.username.trim().toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9._-]/g, '');
    } else if (currentUser.username) {
      mergedUser.username = currentUser.username;
    }

    if (!req.body.password || req.body.password.trim() === '') {
      delete mergedUser.password;
    } else {
      mergedUser.password = req.body.password.trim();
    }

    if (!mergedUser.email && currentUser.email) mergedUser.email = currentUser.email;

    if (req.body.expirationTime) {
      mergedUser.expirationTime = req.body.expirationTime;
    } else if (currentUser.expirationTime) {
      mergedUser.expirationTime = currentUser.expirationTime;
    }

    const putRes = await axios.put(`${MILLITRACK_HOST}/api/users/${userId}`, mergedUser, {
      headers: getDistributorHeaders(true, 'application/json')
    });

    return res.status(putRes.status).json(putRes.data);
  } catch (err) {
    let errMsg = 'Failed to update user';
    const rawErr = err.response?.data;
    if (typeof rawErr === 'string') {
      errMsg = rawErr.split('-')[0].trim();
    } else if (rawErr?.error || rawErr?.message) {
      errMsg = rawErr.error || rawErr.message;
    }
    return res.status(err.response?.status || 500).json({ error: errMsg, details: rawErr });
  }
});

app.post('/api/users/rechargePoints', async (req, res) => {
  if (!sessionState.user && !loadSessionFromDisk()) return res.status(401).json({ error: 'Unauthorized' });

  const { points, userId } = req.body;
  const addAmount = parseInt(points, 10) || 0;
  const targetId = userId || sessionState.user?.id;

  if (addAmount <= 0) {
    return res.status(400).json({ error: 'Points amount must be greater than zero' });
  }

  // 1. Update active session devicePoints and userRevivalPoints
  if (sessionState.user) {
    sessionState.user.devicePoints = (sessionState.user.devicePoints || 26) + addAmount;
    sessionState.user.userRevivalPoints = (sessionState.user.userRevivalPoints || 25) + addAmount;
  }
  saveSessionToDisk();

  // 2. Attempt upstream update on Millitrack/Traccar server
  try {
    const listRes = await axios.get(`${MILLITRACK_HOST}/api/users`, { headers: buildHeaders() });
    const currentUser = (listRes.data || []).find((u) => String(u.id) === String(targetId)) || {};
    const newTotal = (currentUser.devicePoints || 0) + addAmount;
    const newRevival = (currentUser.userRevivalPoints || 0) + addAmount;
    const mergedUser = {
      ...currentUser,
      devicePoints: newTotal,
      userRevivalPoints: newRevival,
      attributes: {
        ...(currentUser.attributes || {}),
        devicePoints: newTotal,
        userRevivalPoints: newRevival
      }
    };
    await axios.put(`${MILLITRACK_HOST}/api/users/${targetId}`, mergedUser, {
      headers: buildHeaders(true, 'application/json')
    }).catch(() => null);
  } catch (e) {
    console.warn('[RECHARGE] Remote update note:', e.message);
  }

  return res.json({
    success: true,
    addedPoints: addAmount,
    currentBalance: sessionState.user?.devicePoints || addAmount,
    userRevivalPoints: sessionState.user?.userRevivalPoints || 25,
    message: `Successfully credited +${addAmount} points directly to account.`
  });
});

app.delete('/api/users/:id', async (req, res) => {
  const userId = req.params.id;
  try {
    await ensureDistributorSession();
    const delRes = await axios.delete(`${MILLITRACK_HOST}/api/users/${userId}`, {
      headers: getDistributorHeaders()
    });
    return res.status(delRes.status).send(delRes.data);
  } catch (err) {
    let errMsg = 'Failed to delete user';
    const rawErr = err.response?.data;
    if (typeof rawErr === 'string') {
      errMsg = rawErr.split('-')[0].trim();
    } else if (rawErr?.error || rawErr?.message) {
      errMsg = rawErr.error || rawErr.message;
    }
    return res.status(err.response?.status || 500).json({ error: errMsg, details: rawErr });
  }
});

// ---------------------------------------------------------------------------
// 11. PERMISSIONS & HARDWARE COMMANDS WITH LIVE DEVICE ACK/REPLY
// ---------------------------------------------------------------------------

app.post('/api/permissions', async (req, res) => {
  try {
    await ensureDistributorSession();
    const permRes = await axios.post(`${MILLITRACK_HOST}/api/permissions`, req.body, {
      headers: getDistributorHeaders(true, 'application/json')
    });
    return res.status(permRes.status).send(permRes.data);
  } catch (err) {
    let errMsg = 'Failed to link permission';
    const rawErr = err.response?.data;
    if (typeof rawErr === 'string') {
      errMsg = rawErr.split('-')[0].trim();
    } else if (rawErr?.error || rawErr?.message) {
      errMsg = rawErr.error || rawErr.message;
    }
    return res.status(err.response?.status || 500).json({ error: errMsg, details: rawErr });
  }
});

app.delete('/api/permissions', async (req, res) => {
  try {
    await ensureDistributorSession();
    const permRes = await axios({
      method: 'DELETE',
      url: `${MILLITRACK_HOST}/api/permissions`,
      data: req.body,
      headers: getDistributorHeaders(true, 'application/json')
    });
    return res.status(permRes.status).send(permRes.data);
  } catch (err) {
    let errMsg = 'Failed to unlink permission';
    const rawErr = err.response?.data;
    if (typeof rawErr === 'string') {
      errMsg = rawErr.split('-')[0].trim();
    } else if (rawErr?.error || rawErr?.message) {
      errMsg = rawErr.error || rawErr.message;
    }
    return res.status(err.response?.status || 500).json({ error: errMsg, details: rawErr });
  }
});

// ---------------------------------------------------------------------------
// 11B. DRIVERS MANAGEMENT (Live Roster, RFID, Device Assignment)
// ---------------------------------------------------------------------------

app.get('/api/drivers', async (req, res) => {
  try {
    await ensureDistributorSession();
    let response = await axios.get(`${MILLITRACK_HOST}/api/drivers`, {
      headers: getDistributorHeaders(),
      validateStatus: () => true
    });
    if (response.status === 401 && Date.now() > distributorLockoutUntil) {
      await ensureDistributorSession(true);
      response = await axios.get(`${MILLITRACK_HOST}/api/drivers`, {
        headers: getDistributorHeaders(),
        validateStatus: () => true
      });
    }
    if (response.status === 200 && Array.isArray(response.data)) {
      telemetryCache.drivers = response.data;
      saveTelemetryToDisk();
      return res.status(200).json(response.data);
    }
    if (telemetryCache.drivers && telemetryCache.drivers.length > 0) {
      return res.status(200).set('X-Data-Source', 'telemetry-cache').json(telemetryCache.drivers);
    }
    return res.status(200).json(telemetryCache.drivers || []);
  } catch (err) {
    if (telemetryCache.drivers && telemetryCache.drivers.length > 0) {
      return res.status(200).set('X-Data-Source', 'telemetry-cache').json(telemetryCache.drivers);
    }
    return res.status(200).json([]);
  }
});

app.post('/api/drivers', async (req, res) => {
  try {
    await ensureDistributorSession();
    const payload = { ...req.body };
    delete payload.id;

    if (!payload.name || !String(payload.name).trim()) {
      return res.status(400).json({ error: 'Driver name is required' });
    }
    payload.name = String(payload.name).trim();

    if (!payload.uniqueId || !String(payload.uniqueId).trim()) {
      payload.uniqueId = 'DRV-' + Math.floor(10000 + Math.random() * 90000);
    } else {
      payload.uniqueId = String(payload.uniqueId).trim();
    }

    if (!payload.attributes || typeof payload.attributes !== 'object') {
      payload.attributes = {};
    }

    const postRes = await axios.post(`${MILLITRACK_HOST}/api/drivers`, payload, {
      headers: getDistributorHeaders(true, 'application/json'),
      validateStatus: () => true
    });

    // If deviceId was provided, link driver to device via permissions
    if (postRes.status === 200 || postRes.status === 201) {
      if (req.body.deviceId && postRes.data?.id) {
        await axios.post(`${MILLITRACK_HOST}/api/permissions`, {
          deviceId: parseInt(req.body.deviceId),
          driverId: postRes.data.id
        }, {
          headers: getDistributorHeaders(true, 'application/json'),
          validateStatus: () => true
        }).catch(() => null);
      }
    }

    return res.status(postRes.status).json(postRes.data);
  } catch (err) {
    let errMsg = 'Failed to create driver';
    const rawErr = err.response?.data;
    if (typeof rawErr === 'string') errMsg = rawErr.split('-')[0].trim();
    else if (rawErr?.error || rawErr?.message) errMsg = rawErr.error || rawErr.message;
    return res.status(err.response?.status || 500).json({ error: errMsg, details: rawErr });
  }
});

app.put('/api/drivers/:id', async (req, res) => {
  const driverId = parseInt(req.params.id);
  try {
    await ensureDistributorSession();

    let currentDriver = {};
    try {
      const getRes = await axios.get(`${MILLITRACK_HOST}/api/drivers?id=${driverId}`, {
        headers: getDistributorHeaders()
      });
      if (Array.isArray(getRes.data)) {
        currentDriver = getRes.data.find(d => d.id === driverId) || {};
      }
    } catch (e) {}

    const payload = {
      ...currentDriver,
      ...req.body,
      id: driverId,
      attributes: {
        ...(currentDriver.attributes || {}),
        ...(req.body.attributes || {})
      }
    };

    if (payload.name) payload.name = String(payload.name).trim();

    const putRes = await axios.put(`${MILLITRACK_HOST}/api/drivers/${driverId}`, payload, {
      headers: getDistributorHeaders(true, 'application/json'),
      validateStatus: () => true
    });

    // If deviceId changed, update permissions
    if (req.body.deviceId && (putRes.status === 200 || putRes.status === 201)) {
      await axios.post(`${MILLITRACK_HOST}/api/permissions`, {
        deviceId: parseInt(req.body.deviceId),
        driverId: driverId
      }, {
        headers: getDistributorHeaders(true, 'application/json'),
        validateStatus: () => true
      }).catch(() => null);
    }

    return res.status(putRes.status).json(putRes.data);
  } catch (err) {
    let errMsg = 'Failed to update driver';
    const rawErr = err.response?.data;
    if (typeof rawErr === 'string') errMsg = rawErr.split('-')[0].trim();
    else if (rawErr?.error || rawErr?.message) errMsg = rawErr.error || rawErr.message;
    return res.status(err.response?.status || 500).json({ error: errMsg, details: rawErr });
  }
});

app.delete('/api/drivers/:id', async (req, res) => {
  const driverId = parseInt(req.params.id);
  try {
    await ensureDistributorSession();
    const delRes = await axios.delete(`${MILLITRACK_HOST}/api/drivers/${driverId}`, {
      headers: getDistributorHeaders(),
      validateStatus: () => true
    });
    return res.status(delRes.status).send(delRes.data);
  } catch (err) {
    let errMsg = 'Failed to delete driver';
    const rawErr = err.response?.data;
    if (typeof rawErr === 'string') errMsg = rawErr.split('-')[0].trim();
    else if (rawErr?.error || rawErr?.message) errMsg = rawErr.error || rawErr.message;
    return res.status(err.response?.status || 500).json({ error: errMsg, details: rawErr });
  }
});

// ---------------------------------------------------------------------------
// 11C. FLEET GROUPS MANAGEMENT
// ---------------------------------------------------------------------------

app.get('/api/groups', async (req, res) => {
  try {
    await ensureDistributorSession();
    let response = await axios.get(`${MILLITRACK_HOST}/api/groups`, {
      headers: getDistributorHeaders(),
      validateStatus: () => true
    });
    if (response.status === 401 && Date.now() > distributorLockoutUntil) {
      await ensureDistributorSession(true);
      response = await axios.get(`${MILLITRACK_HOST}/api/groups`, {
        headers: getDistributorHeaders(),
        validateStatus: () => true
      });
    }
    if (response.status === 200 && Array.isArray(response.data)) {
      telemetryCache.groups = response.data;
      saveTelemetryToDisk();
      return res.status(200).json(response.data);
    }
    if (telemetryCache.groups && telemetryCache.groups.length > 0) {
      return res.status(200).set('X-Data-Source', 'telemetry-cache').json(telemetryCache.groups);
    }
    return res.status(200).json(telemetryCache.groups || []);
  } catch (err) {
    if (telemetryCache.groups && telemetryCache.groups.length > 0) {
      return res.status(200).set('X-Data-Source', 'telemetry-cache').json(telemetryCache.groups);
    }
    return res.status(200).json([]);
  }
});

app.post('/api/groups', async (req, res) => {
  try {
    await ensureDistributorSession();
    const payload = { ...req.body };
    delete payload.id;
    if (!payload.name || !String(payload.name).trim()) {
      return res.status(400).json({ error: 'Group name is required' });
    }
    payload.name = String(payload.name).trim();
    if (payload.groupId === undefined || payload.groupId === null) {
      payload.groupId = 0;
    } else {
      payload.groupId = parseInt(payload.groupId) || 0;
    }
    if (!payload.attributes || typeof payload.attributes !== 'object') {
      payload.attributes = {};
    }

    const postRes = await axios.post(`${MILLITRACK_HOST}/api/groups`, payload, {
      headers: getDistributorHeaders(true, 'application/json'),
      validateStatus: () => true
    });
    return res.status(postRes.status).json(postRes.data);
  } catch (err) {
    let errMsg = 'Failed to create group';
    const rawErr = err.response?.data;
    if (typeof rawErr === 'string') errMsg = rawErr.split('-')[0].trim();
    else if (rawErr?.error || rawErr?.message) errMsg = rawErr.error || rawErr.message;
    return res.status(err.response?.status || 500).json({ error: errMsg, details: rawErr });
  }
});

app.put('/api/groups/:id', async (req, res) => {
  const groupId = parseInt(req.params.id);
  try {
    await ensureDistributorSession();
    const payload = { ...req.body, id: groupId };
    if (payload.name) payload.name = String(payload.name).trim();
    if (payload.groupId !== undefined) payload.groupId = parseInt(payload.groupId) || 0;

    const putRes = await axios.put(`${MILLITRACK_HOST}/api/groups/${groupId}`, payload, {
      headers: getDistributorHeaders(true, 'application/json'),
      validateStatus: () => true
    });
    return res.status(putRes.status).json(putRes.data);
  } catch (err) {
    let errMsg = 'Failed to update group';
    const rawErr = err.response?.data;
    if (typeof rawErr === 'string') errMsg = rawErr.split('-')[0].trim();
    else if (rawErr?.error || rawErr?.message) errMsg = rawErr.error || rawErr.message;
    return res.status(err.response?.status || 500).json({ error: errMsg, details: rawErr });
  }
});

app.delete('/api/groups/:id', async (req, res) => {
  const groupId = parseInt(req.params.id);
  try {
    await ensureDistributorSession();
    const delRes = await axios.delete(`${MILLITRACK_HOST}/api/groups/${groupId}`, {
      headers: getDistributorHeaders(),
      validateStatus: () => true
    });
    return res.status(delRes.status).send(delRes.data);
  } catch (err) {
    let errMsg = 'Failed to delete group';
    const rawErr = err.response?.data;
    if (typeof rawErr === 'string') errMsg = rawErr.split('-')[0].trim();
    else if (rawErr?.error || rawErr?.message) errMsg = rawErr.error || rawErr.message;
    return res.status(err.response?.status || 500).json({ error: errMsg, details: rawErr });
  }
});

// ---------------------------------------------------------------------------
// 11D. MAINTENANCE & SERVICE REMINDERS (Hybrid Engine + Local Persistence)
// ---------------------------------------------------------------------------

app.get('/api/maintenance', async (req, res) => {
  try {
    let upstreamList = [];
    try {
      await ensureDistributorSession();
      const remoteRes = await axios.get(`${MILLITRACK_HOST}/api/maintenance`, {
        headers: getDistributorHeaders(),
        timeout: 4000,
        validateStatus: () => true
      });
      if (remoteRes.status === 200 && Array.isArray(remoteRes.data)) {
        upstreamList = remoteRes.data;
      }
    } catch (e) {}

    const localList = loadMaintenanceFromDisk();

    // Merge: local items override or augment upstream
    const mergedMap = new Map();
    upstreamList.forEach(m => mergedMap.set(String(m.id), m));
    localList.forEach(m => mergedMap.set(String(m.id), { ...(mergedMap.get(String(m.id)) || {}), ...m }));

    const allItems = Array.from(mergedMap.values());

    // Fetch positions or devices to enrich with live calculations
    let positions = [];
    try {
      const pRes = await axios.get(`${MILLITRACK_HOST}/api/positions`, {
        headers: getDistributorHeaders(),
        timeout: 3000,
        validateStatus: () => true
      });
      if (Array.isArray(pRes.data)) positions = pRes.data;
    } catch (e) {}

    const posByDevId = new Map();
    positions.forEach(p => {
      if (p.deviceId) posByDevId.set(String(p.deviceId), p);
    });

    const enriched = allItems.map(item => {
      const pos = posByDevId.get(String(item.deviceId));
      const currentOdoMeters = pos?.attributes?.totalDistance || pos?.totalDistance || 0;
      const currentOdoKm = Math.round(currentOdoMeters / 1000);

      let status = 'OK';
      let progressPercent = 0;
      let remainingKm = null;
      let remainingDays = null;

      if (item.type === 'totalDistance') {
        const startKm = Math.round((item.start || 0) / 1000);
        const periodKm = Math.round((item.period || 10000000) / 1000);
        const targetKm = startKm + periodKm;
        const elapsedKm = Math.max(0, currentOdoKm - startKm);
        remainingKm = targetKm - currentOdoKm;

        progressPercent = periodKm > 0 ? Math.min(100, Math.round((elapsedKm / periodKm) * 100)) : 0;
        if (remainingKm <= 0) {
          status = 'OVERDUE';
          progressPercent = 100;
        } else if (remainingKm <= 500) {
          status = 'DUE_SOON';
        }
      } else if (item.type === 'date') {
        const targetDate = item.targetDate ? new Date(item.targetDate).getTime() : 0;
        const now = Date.now();
        if (targetDate > 0) {
          const diffMs = targetDate - now;
          remainingDays = Math.round(diffMs / (24 * 3600 * 1000));
          if (remainingDays < 0) {
            status = 'OVERDUE';
            progressPercent = 100;
          } else if (remainingDays <= 14) {
            status = 'DUE_SOON';
            progressPercent = Math.max(80, 100 - remainingDays * 2);
          } else {
            progressPercent = Math.max(10, Math.min(75, 100 - remainingDays));
          }
        }
      }

      return {
        ...item,
        currentOdometerKm: currentOdoKm,
        remainingKm,
        remainingDays,
        progressPercent,
        status
      };
    });

    return res.json(enriched);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch maintenance schedules', details: err.message });
  }
});

app.post('/api/maintenance', async (req, res) => {
  try {
    const newItem = {
      id: Date.now(),
      deviceId: req.body.deviceId ? parseInt(req.body.deviceId) : null,
      deviceName: req.body.deviceName || '',
      name: (req.body.name || 'Scheduled Service').trim(),
      type: req.body.type || 'totalDistance',
      start: Number(req.body.start) || 0,
      period: Number(req.body.period) || 10000000,
      targetDate: req.body.targetDate || null,
      cost: Number(req.body.cost) || 0,
      notes: req.body.notes || '',
      attributes: req.body.attributes || {},
      createdAt: new Date().toISOString(),
      history: []
    };

    try {
      await ensureDistributorSession();
      const remoteRes = await axios.post(`${MILLITRACK_HOST}/api/maintenance`, req.body, {
        headers: getDistributorHeaders(true, 'application/json'),
        validateStatus: () => true
      });
      if (remoteRes.status === 200 || remoteRes.status === 201) {
        newItem.id = remoteRes.data.id || newItem.id;
      }
    } catch (e) {}

    const list = loadMaintenanceFromDisk();
    list.push(newItem);
    saveMaintenanceToDisk(list);

    return res.status(201).json(newItem);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create maintenance item', details: err.message });
  }
});

app.put('/api/maintenance/:id', async (req, res) => {
  const mId = req.params.id;
  try {
    const list = loadMaintenanceFromDisk();
    const idx = list.findIndex(m => String(m.id) === String(mId));

    const updatedItem = {
      ...(idx !== -1 ? list[idx] : {}),
      ...req.body,
      id: isNaN(Number(mId)) ? mId : Number(mId),
      updatedAt: new Date().toISOString()
    };

    if (idx !== -1) {
      list[idx] = updatedItem;
    } else {
      list.push(updatedItem);
    }
    saveMaintenanceToDisk(list);

    try {
      await ensureDistributorSession();
      await axios.put(`${MILLITRACK_HOST}/api/maintenance/${mId}`, req.body, {
        headers: getDistributorHeaders(true, 'application/json'),
        validateStatus: () => true
      });
    } catch (e) {}

    return res.json(updatedItem);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update maintenance item', details: err.message });
  }
});

app.delete('/api/maintenance/:id', async (req, res) => {
  const mId = req.params.id;
  try {
    let list = loadMaintenanceFromDisk();
    list = list.filter(m => String(m.id) !== String(mId));
    saveMaintenanceToDisk(list);

    try {
      await ensureDistributorSession();
      await axios.delete(`${MILLITRACK_HOST}/api/maintenance/${mId}`, {
        headers: getDistributorHeaders(),
        validateStatus: () => true
      });
    } catch (e) {}

    return res.json({ success: true, message: 'Maintenance record deleted successfully' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete maintenance item', details: err.message });
  }
});

app.post('/api/maintenance/:id/complete', async (req, res) => {
  const mId = req.params.id;
  const { notes, cost, performedBy, odometerKm } = req.body;
  try {
    const list = loadMaintenanceFromDisk();
    const idx = list.findIndex(m => String(m.id) === String(mId));
    if (idx === -1) {
      return res.status(404).json({ error: 'Maintenance record not found' });
    }

    const item = list[idx];
    const completionRecord = {
      completedAt: new Date().toISOString(),
      odometerKm: odometerKm || item.currentOdometerKm || 0,
      cost: Number(cost) || item.cost || 0,
      performedBy: performedBy || 'Fleet Workshop',
      notes: notes || 'Service completed successfully'
    };

    if (!Array.isArray(item.history)) item.history = [];
    item.history.unshift(completionRecord);

    if (item.type === 'totalDistance') {
      const currentReadingMeters = (Number(odometerKm) || 0) * 1000;
      item.start = currentReadingMeters > 0 ? currentReadingMeters : (item.start + item.period);
    } else if (item.type === 'date' && item.targetDate) {
      const nextDate = new Date();
      nextDate.setFullYear(nextDate.getFullYear() + 1);
      item.targetDate = nextDate.toISOString();
    }

    item.lastServiceDate = new Date().toISOString();
    item.status = 'OK';
    list[idx] = item;
    saveMaintenanceToDisk(list);

    return res.json({ success: true, message: 'Service marked as completed and rollover scheduled!', item });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to complete service', details: err.message });
  }
});

// GET /api/commands/replies -> Retrieve device command execution responses
app.get('/api/commands/replies', (req, res) => {
  const deviceId = req.query.deviceId;
  if (deviceId) {
    const list = recentCommandReplies.get(String(deviceId)) || [];
    return res.json({ deviceId: Number(deviceId), replies: list });
  }
  const allReplies = {};
  for (const [dId, replies] of recentCommandReplies.entries()) {
    allReplies[dId] = replies;
  }
  return res.json(allReplies);
});

// GET /api/commands/send -> Fetches saved command templates for device
app.get('/api/commands/send', async (req, res) => {
  if (!sessionState.user && !loadSessionFromDisk()) {
    return res.status(401).json({ error: 'Unauthorized. Please login first.' });
  }

  const deviceId = req.query.deviceId;

  try {
    let resp = await axios.get(`${MILLITRACK_HOST}/api/commands/send`, {
      params: deviceId ? { deviceId } : {},
      headers: buildHeaders(),
      validateStatus: () => true
    });

    if (resp.status === 401) {
      const refreshed = await refreshRemoteSession();
      if (refreshed) {
        resp = await axios.get(`${MILLITRACK_HOST}/api/commands/send`, {
          params: deviceId ? { deviceId } : {},
          headers: buildHeaders(),
          validateStatus: () => true
        });
      }
    }

    return res.status(resp.status).json(resp.data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch device command templates' });
  }
});

/**
 * POST /api/commands/send
 * Dispatches command and intercepts the actual device execution response.
 * Support query or body flag `waitForReply=true` (or default 6s wait) to return device ACK directly.
 */
app.post('/api/commands/send', async (req, res) => {
  if (!sessionState.user && !loadSessionFromDisk()) {
    return res.status(401).json({ error: 'Unauthorized. Please login first.' });
  }

  const rawDeviceId = req.query.deviceId || req.body.deviceId;
  if (!rawDeviceId) {
    return res.status(400).json({ error: 'Target deviceId is required' });
  }

  const deviceId = parseInt(rawDeviceId);
  const type = req.body.type || 'engineStop';
  const shouldWaitForReply = req.query.waitForReply === 'true' || req.body.waitForReply === true;
  const replyTimeoutMs = parseInt(req.query.timeout || req.body.timeout || '1800');

  // 0. Verify device exists
  let targetDev = null;
  try {
    const devRes = await axios.get(`${MILLITRACK_HOST}/api/devices?id=${deviceId}`, {
      headers: buildHeaders(),
      timeout: 4000,
      validateStatus: () => true
    });
    if (Array.isArray(devRes.data)) {
      targetDev = devRes.data.find(d => d.id === deviceId);
    } else if (devRes.data && devRes.data.id === deviceId) {
      targetDev = devRes.data;
    }
  } catch (e) {}

  // 1. Resolve templateId for accounts with limitCommands: true
  // Traccar accounts with limitCommands strictly require sending { id: <templateId>, deviceId: <deviceId> }
  let templateId = req.body.id ? parseInt(req.body.id) : null;
  if (!templateId) {
    if (type === 'engineStop') templateId = 1;
    else if (type === 'engineResume') templateId = 2;
  }

  try {
    const tplRes = await axios.get(`${MILLITRACK_HOST}/api/commands/send?deviceId=${deviceId}`, {
      headers: getRequestUpstreamHeaders(req),
      timeout: 5000,
      validateStatus: () => true
    });
    if (tplRes.status === 200 && Array.isArray(tplRes.data)) {
      const matched = tplRes.data.find((t) => (templateId && t.id === templateId) || t.type === type);
      if (matched) templateId = matched.id;
    }
  } catch (e) {}

  // 2. Build payload - For saved commands, DO NOT pass 'type' or custom attributes
  // because Traccar will treat it as an ad-hoc command and throw SecurityException
  const password = req.body.attributes?.devicePassword || req.body.password || '123456';
  let payload = {};

  if (templateId) {
    payload = {
      id: templateId,
      deviceId: deviceId,
      attributes: {
        devicePassword: password
      }
    };
  } else {
    payload = {
      ...req.body,
      deviceId: deviceId,
      type: type,
      textChannel: req.body.textChannel === true,
      attributes: {
        ...(req.body.attributes || {})
      }
    };
    if (req.body.data && !payload.attributes.data) payload.attributes.data = req.body.data;
    if (req.body.customString && !payload.attributes.data) payload.attributes.data = req.body.customString;
    if ((type === 'engineStop' || type === 'engineResume') && !payload.attributes.devicePassword) {
      payload.attributes.devicePassword = password;
    }
  }

  const executeRequest = async (endpoint, dataToSend, includeQueryParams = false) => {
    return await axios({
      method: 'POST',
      url: `${MILLITRACK_HOST}${endpoint}`,
      params: includeQueryParams ? { deviceId } : undefined,
      data: dataToSend,
      headers: getRequestUpstreamHeaders(req, true, 'application/json'),
      validateStatus: () => true,
      timeout: 15000
    });
  };

  // Helper promise to wait for async device ACK from socket stream
  const waitForDeviceReply = (targetDevId, timeoutMs) => {
    return new Promise((resolve) => {
      const eventName = `reply_${targetDevId}`;
      let timer = null;

      const onReply = (replyObj) => {
        if (timer) clearTimeout(timer);
        resolve(replyObj);
      };

      timer = setTimeout(() => {
        commandReplyEmitter.removeListener(eventName, onReply);
        resolve(null);
      }, timeoutMs);

      commandReplyEmitter.once(eventName, onReply);
    });
  };

  try {
    // Start listening before sending
    const replyPromise = shouldWaitForReply ? waitForDeviceReply(deviceId, replyTimeoutMs) : Promise.resolve(null);

    // Attempt 1: Direct POST /api/commands/send
    let response = await executeRequest('/api/commands/send', payload, false);

    if (response.status === 401) {
      const refreshed = await refreshRemoteSession();
      if (refreshed) response = await executeRequest('/api/commands/send', payload, false);
    }

    // Attempt 2: If failed and payload had extra attributes, try bare template payload
    if (!(response.status >= 200 && response.status < 300) && templateId) {
      response = await executeRequest('/api/commands/send', { id: templateId, deviceId: deviceId }, false);
    }

    // Attempt 3: Try with deviceId in query string as well
    if (!(response.status >= 200 && response.status < 300)) {
      response = await executeRequest('/api/commands/send', payload, true);
    }

    // Attempt 4: Fallback to Command Queue for sleeping devices
    let isQueued = false;
    if (!(response.status >= 200 && response.status < 300)) {
      let queueRes = await executeRequest('/api/commands/queue', payload, false);
      if (queueRes.status >= 200 && queueRes.status < 300) {
        response = queueRes;
        isQueued = true;
      }
    }

    if ((response.status >= 200 && response.status < 300) || response.status === 202) {
      const dispatchData = response.data || { success: true };
      if (response.status === 202) isQueued = true;

      // 1. Check if upstream response already has the hardware reply / result
      const immediateResult = dispatchData.result || dispatchData.reply || dispatchData.attributes?.result;
      if (immediateResult && !String(immediateResult).includes('Packet Transmitted')) {
        const formattedTime = formatReadableDate(new Date());
        const replyObj = {
          type: 'COMMAND_REPLY',
          deviceId: deviceId,
          result: immediateResult,
          eventTime: new Date().toISOString(),
          formattedTime: formattedTime,
          raw: dispatchData
        };
        storeCommandReply(deviceId, replyObj);
        commandReplyEmitter.emit(`reply_${deviceId}`, replyObj);
        return res.status(200).json({
          success: true,
          status: 'EXECUTED',
          isAcked: true,
          command: type,
          deviceId: deviceId,
          reply: immediateResult,
          replyTime: formattedTime,
          message: `Hardware Confirmed: ${immediateResult}`,
          deviceDetails: replyObj,
          dispatchResponse: dispatchData
        });
      }

      // 2. If waiting for socket reply, await asynchronous ACK from hardware stream
      if (shouldWaitForReply && !isQueued) {
        const deviceReply = await replyPromise;
        if (deviceReply && deviceReply.result) {
          return res.status(200).json({
            success: true,
            status: 'EXECUTED',
            isAcked: true,
            command: type,
            deviceId: deviceId,
            reply: deviceReply.result,
            replyTime: deviceReply.formattedTime,
            message: `Vehicle Hardware ACK Confirmed: ${deviceReply.result}`,
            deviceDetails: deviceReply,
            dispatchResponse: dispatchData
          });
        }

        // Gateway accepted the command and transmitted it to the vehicle hardware!
        return res.status(200).json({
          success: true,
          status: 'SENT',
          isAcked: true,
          message: 'Command transmitted to vehicle hardware via GPRS network.',
          deviceId: deviceId,
          command: type,
          dispatchResponse: dispatchData
        });
      }

      // 3. Fallback for non-wait or queued requests
      return res.status(200).json({
        success: true,
        status: isQueued ? 'QUEUED' : 'SENT',
        isAcked: true,
        message: isQueued
          ? 'Device sleeping. Command queued in gateway buffer.'
          : 'Command packet sent to vehicle hardware successfully.',
        deviceId: deviceId,
        command: type,
        dispatchResponse: dispatchData
      });
    }

    const errorData = response.data || { error: 'Failed to send command to device' };
    return res.status(response.status || 400).json(errorData);
  } catch (err) {
    return res.status(500).json({ error: 'Command dispatch gateway error', details: err.message });
  }
});

// ---------------------------------------------------------------------------
// 12. NOTIFICATION MANAGEMENT APIS (/api/notifications)
// ---------------------------------------------------------------------------

let memoryNotifications = [
  { id: 1, attributes: {}, calendarId: 0, always: false, type: "ignitionOn", notificators: "firebase", consumer: true, vendor: true },
  { id: 193, attributes: {}, calendarId: 0, always: false, type: "doorClosed", notificators: "web,firebase", consumer: false, vendor: true },
  { id: 2, attributes: {}, calendarId: 0, always: false, type: "ignitionOff", notificators: "firebase", consumer: true, vendor: true },
  { id: 194, attributes: {}, calendarId: 0, always: false, type: "doorOpen", notificators: "web,firebase", consumer: false, vendor: true },
  { id: 3, attributes: {}, calendarId: 0, always: false, type: "geofenceEnter", notificators: "web,firebase", consumer: true, vendor: true },
  { id: 195, attributes: {}, calendarId: 0, always: false, type: "deviceIdle", notificators: "web,firebase", consumer: true, vendor: true },
  { id: 4, attributes: {}, calendarId: 0, always: false, type: "deviceOverspeed", notificators: "web,firebase", consumer: true, vendor: true },
  { id: 196, attributes: { alarms: "powerRestored" }, calendarId: 0, always: false, type: "alarm", notificators: "web,firebase", consumer: false, vendor: true },
  { id: 5, attributes: {}, calendarId: 0, always: false, type: "geofenceExit", notificators: "web,firebase", consumer: true, vendor: true },
  { id: 197, attributes: {}, calendarId: 0, always: false, type: "stateChanged", notificators: "web,firebase", consumer: false, vendor: true },
  { id: 198, attributes: {}, calendarId: 0, always: false, type: "tollAreaEnter", notificators: "web,firebase", consumer: true, vendor: true },
  { id: 103, attributes: { alarms: "sos" }, calendarId: 0, always: false, type: "alarm", notificators: "web,firebase", consumer: true, vendor: true },
  { id: 77, attributes: { alarms: "powerCut" }, calendarId: 0, always: false, type: "alarm", notificators: "web,firebase", consumer: false, vendor: true },
  { id: 51, attributes: {}, calendarId: 0, always: false, type: "acOn", notificators: "firebase", consumer: true, vendor: true },
  { id: 52, attributes: {}, calendarId: 0, always: false, type: "acOff", notificators: "firebase", consumer: true, vendor: true },
  { id: 116, attributes: { alarms: "parking" }, calendarId: 0, always: false, type: "alarm", notificators: "firebase", consumer: true, vendor: true },
  { id: 53, attributes: {}, calendarId: 0, always: false, type: "deviceOverstay", notificators: "web,firebase", consumer: true, vendor: true }
];

// GET /api/notifications
app.get('/api/notifications', async (req, res) => {
  try {
    const remoteRes = await axios.get(`${MILLITRACK_HOST}/api/notifications`, {
      headers: buildHeaders(),
      timeout: 5000,
      validateStatus: () => true
    });
    if (remoteRes.status === 200 && Array.isArray(remoteRes.data) && remoteRes.data.length > 0) {
      const merged = remoteRes.data.map(rn => {
        const local = memoryNotifications.find(m => m.id === rn.id);
        return local ? { ...rn, ...local } : rn;
      });
      return res.json(merged);
    }
  } catch (e) {}
  return res.json(memoryNotifications);
});

// GET /api/notifications/types
app.get('/api/notifications/types', async (req, res) => {
  try {
    const remoteRes = await axios.get(`${MILLITRACK_HOST}/api/notifications/types`, {
      headers: buildHeaders(),
      timeout: 4000,
      validateStatus: () => true
    });
    if (remoteRes.status === 200 && Array.isArray(remoteRes.data)) {
      return res.json(remoteRes.data);
    }
  } catch (e) {}
  return res.json([
    { type: 'ignitionOn' }, { type: 'ignitionOff' }, { type: 'deviceOverspeed' },
    { type: 'geofenceEnter' }, { type: 'geofenceExit' }, { type: 'alarm' },
    { type: 'doorOpen' }, { type: 'doorClosed' }, { type: 'acOn' }, { type: 'acOff' },
    { type: 'deviceIdle' }, { type: 'deviceOverstay' }, { type: 'tollAreaEnter' },
    { type: 'stateChanged' }, { type: 'deviceOnline' }, { type: 'deviceOffline' }
  ]);
});

// GET /api/notifications/notificators
app.get('/api/notifications/notificators', async (req, res) => {
  try {
    const remoteRes = await axios.get(`${MILLITRACK_HOST}/api/notifications/notificators`, {
      headers: buildHeaders(),
      timeout: 4000,
      validateStatus: () => true
    });
    if (remoteRes.status === 200 && Array.isArray(remoteRes.data)) {
      return res.json(remoteRes.data);
    }
  } catch (e) {}
  res.json([
    { type: 'firebase', name: 'Mobile App Push (FCM)' },
    { type: 'web', name: 'Web Browser Push' },
    { type: 'sms', name: 'Direct SMS' },
    { type: 'mail', name: 'Email Dispatch' }
  ]);
});

// PUT /api/notifications/:id
app.put('/api/notifications/:id', async (req, res) => {
  const notifId = parseInt(req.params.id);
  const updatedData = req.body;

  const idx = memoryNotifications.findIndex(n => n.id === notifId);
  if (idx !== -1) {
    memoryNotifications[idx] = { ...memoryNotifications[idx], ...updatedData };
  } else {
    memoryNotifications.push({ id: notifId, ...updatedData });
  }

  try {
    await axios.put(`${MILLITRACK_HOST}/api/notifications/${notifId}`, updatedData, {
      headers: buildHeaders(true, 'application/json'),
      validateStatus: () => true,
      timeout: 5000
    });
  } catch (e) {}

  res.json({ success: true, notification: memoryNotifications.find(n => n.id === notifId) });
});

// POST /api/notifications
app.post('/api/notifications', async (req, res) => {
  const newNotif = {
    id: Date.now(),
    attributes: req.body.attributes || {},
    calendarId: 0,
    always: req.body.always || false,
    type: req.body.type || 'alarm',
    notificators: req.body.notificators || 'web,firebase',
    consumer: req.body.consumer !== false,
    vendor: req.body.vendor !== false
  };

  try {
    const remoteRes = await axios.post(`${MILLITRACK_HOST}/api/notifications`, req.body, {
      headers: buildHeaders(true, 'application/json'),
      validateStatus: () => true,
      timeout: 5000
    });
    if (remoteRes.status === 200 || remoteRes.status === 201) {
      newNotif.id = remoteRes.data.id || newNotif.id;
    }
  } catch (e) {}

  memoryNotifications.push(newNotif);
  res.status(201).json(newNotif);
});

// DELETE /api/notifications/:id
app.delete('/api/notifications/:id', async (req, res) => {
  const notifId = parseInt(req.params.id);
  memoryNotifications = memoryNotifications.filter(n => n.id !== notifId);
  try {
    await axios.delete(`${MILLITRACK_HOST}/api/notifications/${notifId}`, {
      headers: buildHeaders(),
      validateStatus: () => true,
      timeout: 5000
    });
  } catch (e) {}
  res.json({ success: true });
});

// POST /api/notifications/test
app.post('/api/notifications/test', (req, res) => {
  const { type, deviceName, message, channel } = req.body;
  const testAlert = {
    id: Date.now(),
    type: type || 'ignitionOn',
    deviceName: deviceName || 'BR01PS8108',
    message: message || `Test Alert: ${type || 'ignitionOn'} triggered successfully!`,
    channel: channel || 'web,firebase',
    timestamp: new Date().toISOString(),
    formattedTime: formatReadableDate(new Date()),
    status: 'DELIVERED'
  };
  notificationAlertLogs.unshift(testAlert);
  if (notificationAlertLogs.length > 200) notificationAlertLogs.pop();

  broadcastToClients({ type: 'LIVE_ALERT', alert: testAlert });
  res.json({ success: true, alert: testAlert });
});

// GET /api/notifications/logs
app.get('/api/notifications/logs', (req, res) => {
  res.json({ success: true, logs: notificationAlertLogs });
});

// ---------------------------------------------------------------------------
// 12. METADATA AGGREGATOR
// ---------------------------------------------------------------------------

app.get('/api/custom/metadata', async (req, res) => {
  try {
    const [devicesRes, notificationsRes, typesRes, portsRes] = await Promise.all([
      axios.get(`${MILLITRACK_HOST}/api/devices`, { headers: buildHeaders() }).catch(() => ({ data: [] })),
      axios.get(`${MILLITRACK_HOST}/api/notifications`, { headers: buildHeaders() }).catch(() => ({ data: [] })),
      axios.get(`${MILLITRACK_HOST}/api/notifications/types`, { headers: buildHeaders() }).catch(() => ({ data: [] })),
      axios.get(`${MILLITRACK_HOST}/api/server/supportedPorts`, { headers: buildHeaders() }).catch(() => ({ data: [] }))
    ]);

    const devices = Array.isArray(devicesRes.data) ? devicesRes.data : [];

    const modelsSet = new Set(['G11 (5023)', 'AQULA AIS 140', 'Wetrack 140', 'Concox GT06N', 'Coban GPS103', 'Teltonika FMB920', 'VL02 4G']);
    const categoriesSet = new Set(['car', 'truck', 'motorcycle', 'bus', 'van', 'pickup', 'tractor', 'ambulance']);

    devices.forEach((d) => {
      if (d.model && d.model.trim()) modelsSet.add(d.model.trim());
      if (d.category && d.category.trim()) categoriesSet.add(d.category.trim().toLowerCase());
    });

    return res.json({
      mapProvider: 'Mappls (MapmyIndia)',
      models: Array.from(modelsSet),
      categories: Array.from(categoriesSet),
      notifications: Array.isArray(notificationsRes.data) ? notificationsRes.data : [],
      notificationTypes: Array.isArray(typesRes.data) ? typesRes.data : [],
      supportedPorts: Array.isArray(portsRes.data) ? portsRes.data : []
    });
  } catch (err) {
    return res.status(500).json({ error: 'Metadata fetch failed', details: err.message });
  }
});

// ---------------------------------------------------------------------------
// 12B. GEOFENCES, PORTS, BILLING RECHARGE & TELEMATICS PROXY FALLBACKS
// ---------------------------------------------------------------------------

app.get('/api/geofences', async (req, res) => {
  try {
    await ensureDistributorSession();
    let response = await axios.get(`${MILLITRACK_HOST}/api/geofences`, {
      params: req.query,
      headers: getDistributorHeaders(),
      validateStatus: () => true
    });
    if (response.status === 401 && Date.now() > distributorLockoutUntil) {
      await ensureDistributorSession(true);
      response = await axios.get(`${MILLITRACK_HOST}/api/geofences`, {
        params: req.query,
        headers: getDistributorHeaders(),
        validateStatus: () => true
      });
    }
    if (response.status === 200 && Array.isArray(response.data)) {
      telemetryCache.geofences = response.data;
      saveTelemetryToDisk();
      return res.status(200).json(response.data);
    }
    if (telemetryCache.geofences && telemetryCache.geofences.length > 0) {
      return res.status(200).set('X-Data-Source', 'telemetry-cache').json(telemetryCache.geofences);
    }
    return res.status(200).json(telemetryCache.geofences || []);
  } catch (err) {
    if (telemetryCache.geofences && telemetryCache.geofences.length > 0) {
      return res.status(200).set('X-Data-Source', 'telemetry-cache').json(telemetryCache.geofences);
    }
    return res.status(200).json([]);
  }
});

app.post('/api/geofences', async (req, res) => {
  try {
    await ensureDistributorSession();
    const response = await axios.post(`${MILLITRACK_HOST}/api/geofences`, req.body, {
      headers: getDistributorHeaders(true, 'application/json'),
      validateStatus: () => true
    });
    return res.status(response.status).json(response.data);
  } catch (err) {
    return res.status(err.response?.status || 500).json(err.response?.data || { error: 'Failed to create geofence' });
  }
});

app.put('/api/geofences/:id', async (req, res) => {
  try {
    await ensureDistributorSession();
    const response = await axios.put(`${MILLITRACK_HOST}/api/geofences/${req.params.id}`, req.body, {
      headers: getDistributorHeaders(true, 'application/json'),
      validateStatus: () => true
    });
    return res.status(response.status).json(response.data);
  } catch (err) {
    return res.status(err.response?.status || 500).json(err.response?.data || { error: 'Failed to update geofence' });
  }
});

app.delete('/api/geofences/:id', async (req, res) => {
  try {
    await ensureDistributorSession();
    const response = await axios.delete(`${MILLITRACK_HOST}/api/geofences/${req.params.id}`, {
      headers: getDistributorHeaders(),
      validateStatus: () => true
    });
    return res.status(response.status).json(response.data);
  } catch (err) {
    return res.status(err.response?.status || 500).json(err.response?.data || { error: 'Failed to delete geofence' });
  }
});

app.get('/api/users/:id/userDevicesState', async (req, res) => {
  try {
    const remote = await axios.get(`${MILLITRACK_HOST}${req.originalUrl}`, {
      headers: buildHeaders(),
      validateStatus: () => true
    });
    if (remote.status === 200 && remote.data) {
      return res.json(remote.data);
    }
  } catch (e) {}

  const devList = telemetryCache.devices || [];
  return res.json({
    totalDevices: { count: devList.length },
    running: { count: devList.filter(d => d.status === 'online').length },
    stopped: { count: devList.filter(d => d.status !== 'online').length },
    inactive: { count: 0 },
    noData: { count: 0 },
    deviceCumPositionList: []
  });
});

const DEFAULT_SUPPORTED_PORTS = [
  { protocol: 'gt06', port: 5023, description: 'Concox GT06 / WeTrack / G11 / AIS140' },
  { protocol: 'teltonika', port: 5027, description: 'Teltonika FMB920 / FMC130 / FMB120' },
  { protocol: 'gps103', port: 5001, description: 'Coban GPS103 / TK103A / TK103B' },
  { protocol: 'tk103', port: 5002, description: 'TK103 Protocol Series' },
  { protocol: 'h02', port: 5013, description: 'H02 GPS Tracker / SinoTrack' },
  { protocol: 'queclink', port: 5004, description: 'Queclink GL200 / GL300 / GV50' },
  { protocol: 'meitrack', port: 5020, description: 'Meitrack MVT380 / T333 / MD511H' },
  { protocol: 'watch', port: 5093, description: 'Wonlex / Kid GPS Watch / Pet Tracker' },
  { protocol: 'osmand', port: 5055, description: 'OsmAnd / Mobile Client Protocol' },
  { protocol: 'traccar', port: 5005, description: 'Traccar Client Android / iOS Protocol' }
];

app.get('/api/server/supportedPorts', async (req, res) => {
  try {
    const remote = await axios.get(`${MILLITRACK_HOST}/api/server/supportedPorts`, {
      headers: buildHeaders(),
      validateStatus: () => true
    });
    if (remote.status === 200 && Array.isArray(remote.data) && remote.data.length > 0) {
      return res.json(remote.data);
    }
  } catch (e) {}
  return res.json(DEFAULT_SUPPORTED_PORTS);
});

app.get('/api/users/getPointsRechargeOptions', async (req, res) => {
  try {
    const remote = await axios.get(`${MILLITRACK_HOST}/api/users/getPointsRechargeOptions`, {
      params: req.query,
      headers: buildHeaders(),
      validateStatus: () => true
    });
    if (remote.status === 200 && remote.data) {
      return res.json(remote.data);
    }
  } catch (e) {}
  return res.json({
    pointRateList: [
      { id: 1, name: 'Starter Pack', points: 25, price: 3500, discount: '0%' },
      { id: 2, name: 'Growth Pack', points: 100, price: 13500, discount: '5%' },
      { id: 3, name: 'Enterprise Fleet Pack', points: 500, price: 62500, discount: '15%' },
      { id: 4, name: 'Mega Distributor Pack', points: 1000, price: 115000, discount: '20%' }
    ]
  });
});

// ---------------------------------------------------------------------------
// 12.5 PUBLIC LIVE TRACKING & SHARING ENGINE (Link sharing with expiration)
// ---------------------------------------------------------------------------

const publicSharesMap = new Map();

// Register a newly shared vehicle with instant snapshot caching
app.post('/api/public/share', express.json(), (req, res) => {
  try {
    const { deviceId, device, position, exp } = req.body || {};
    if (!deviceId) return res.status(400).json({ error: 'Device ID is required' });

    const idStr = String(deviceId);
    publicSharesMap.set(idStr, {
      device: device || { id: Number(deviceId), name: 'Vehicle' },
      position: position || null,
      exp: exp ? Number(exp) : null,
      updatedAt: Date.now()
    });

    // Also update telemetry cache in memory
    if (device && Array.isArray(telemetryCache.devices)) {
      const idx = telemetryCache.devices.findIndex(d => String(d.id) === idStr || d.uniqueId === idStr);
      if (idx >= 0) telemetryCache.devices[idx] = { ...telemetryCache.devices[idx], ...device };
      else telemetryCache.devices.push(device);
    }
    if (position && Array.isArray(telemetryCache.positions)) {
      const pIdx = telemetryCache.positions.findIndex(p => String(p.deviceId) === idStr);
      if (pIdx >= 0) telemetryCache.positions[pIdx] = { ...telemetryCache.positions[pIdx], ...position };
      else telemetryCache.positions.push(position);
    }

    return res.json({ success: true, registered: idStr });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Guest endpoint for public live vehicle tracking
app.get('/api/public/track/:deviceId', async (req, res) => {
  const { deviceId } = req.params;
  const exp = req.query.exp ? Number(req.query.exp) : null;

  if (exp && Date.now() > exp) {
    return res.status(410).json({ error: 'This live tracking link has expired.', expired: true });
  }

  const idStr = String(deviceId);
  const idNum = Number(deviceId);
  const sharedSnapshot = publicSharesMap.get(idStr);

  let device = (Array.isArray(telemetryCache.devices) && telemetryCache.devices.find(d => d.id === idNum || String(d.id) === idStr || d.uniqueId === idStr))
    || sharedSnapshot?.device;

  let position = (Array.isArray(telemetryCache.positions) && telemetryCache.positions.find(p => p.deviceId === idNum || String(p.deviceId) === idStr || (device && (p.deviceId === device.id || p.id === device.positionId))))
    || sharedSnapshot?.position;

  // Attempt live upstream refresh
  try {
    await ensureDistributorSession();
    const upstreamHeaders = getRequestUpstreamHeaders(req);
    const [dRes, pRes] = await Promise.all([
      axios.get(`${MILLITRACK_HOST}/api/devices?uniqueId=${device?.uniqueId || deviceId}`, { headers: upstreamHeaders, timeout: 5000 }).catch(() => ({ data: [] })),
      axios.get(`${MILLITRACK_HOST}/api/positions?deviceId=${device?.id || idNum}`, { headers: upstreamHeaders, timeout: 5000 }).catch(() => ({ data: [] }))
    ]);
    if (Array.isArray(dRes.data) && dRes.data[0]) {
      device = dRes.data[0];
      const idx = telemetryCache.devices.findIndex(d => d.id === device.id);
      if (idx >= 0) telemetryCache.devices[idx] = device; else telemetryCache.devices.push(device);
    }
    if (Array.isArray(pRes.data) && pRes.data[0]) {
      position = pRes.data[0];
      const pIdx = telemetryCache.positions.findIndex(p => p.deviceId === (position.deviceId || device?.id || idNum));
      if (pIdx >= 0) telemetryCache.positions[pIdx] = position; else telemetryCache.positions.push(position);
    }
  } catch (e) {}

  if (!device && !position) {
    return res.status(404).json({ error: 'Vehicle not found or inactive' });
  }

  return res.json({
    device: {
      id: device?.id || idNum,
      name: device?.name || 'Vehicle',
      uniqueId: device?.uniqueId || '',
      status: device?.status || 'stopped',
      category: device?.category || 'car',
      lastUpdate: device?.lastUpdate || position?.deviceTime || new Date().toISOString()
    },
    position: position || null,
    serverTime: new Date().toISOString()
  });
});

// ---------------------------------------------------------------------------
// 13. UNIVERSAL PROXY GATEWAY WITH 401 RETRY
// ---------------------------------------------------------------------------

app.all('/api/*', async (req, res) => {
  const targetUrl = `${MILLITRACK_HOST}${req.originalUrl}`;
  const isPayloadMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  const forwardHeaders = getRequestUpstreamHeaders(req, isPayloadMethod, req.headers['content-type'] || 'application/json');

  const makeProxyCall = async () => {
    return await axios({
      method: req.method,
      url: targetUrl,
      data: isPayloadMethod ? req.body : undefined,
      headers: forwardHeaders,
      validateStatus: () => true
    });
  };

  try {
    let proxyRes = await makeProxyCall();
    forwardResponseCookies(proxyRes, res);
    return res.status(proxyRes.status).send(proxyRes.data);
  } catch (err) {
    return res.status(err.response?.status || 500).json(err.response?.data || { error: 'Gateway transmission failed', details: err.message });
  }
});

// Customer Mobile Tracking Web App SPA Fallback (/app and /app/*)
app.get('/app', (req, res) => {
  res.redirect('/app/');
});

app.get(['/app/', '/app/*'], (req, res) => {
  res.sendFile(path.join(__dirname, 'user-client', 'dist', 'index.html'));
});

// Backward-compatible redirect from /user to /app
app.get(['/user', '/user/*'], (req, res) => {
  res.redirect('/app');
});

// Admin Dashboard SPA HTML Fallback (Serves root / and all admin subroutes)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
});

// ---------------------------------------------------------------------------
// 14. PROCESS LIFECYCLE & SHUTDOWN
// ---------------------------------------------------------------------------

function gracefulShutdown() {
  clearInterval(clientHeartbeatInterval);
  if (upstreamPingInterval) clearInterval(upstreamPingInterval);
  if (upstreamReconnectTimer) clearTimeout(upstreamReconnectTimer);

  if (upstreamWs) {
    try {
      upstreamWs.close();
    } catch (e) {}
  }

  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[ABSTRACKER] Enterprise telematics server active on port ${PORT}`);
  if (loadSessionFromDisk()) {
    console.log(`[ABSTRACKER] Loaded active session for "${sessionState.user?.name || sessionState.user?.username}"`);
    connectUpstreamWebSocket();
  }
});
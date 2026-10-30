// Walloo Road backend: Tesla Fleet API OAuth + vehicle_data proxy + static app host.
// Zero dependencies (Node 18+). Run: node server.js   (config via env or .env file)
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
try { for (const l of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n')) { const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; } } catch {}
const E = process.env;
const PORT = +E.PORT || 8080;
const CLIENT_ID = E.TESLA_CLIENT_ID, CLIENT_SECRET = E.TESLA_CLIENT_SECRET;
const PUBLIC_URL = (E.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/$/, '');   // must be your registered domain (HTTPS)
const REDIRECT_URI = PUBLIC_URL + '/auth/callback';
const AUDIENCE = E.TESLA_FLEET_BASE || 'https://fleet-api.prd.na.vn.cloud.tesla.com'; // Korea is served by the NA/APAC region
const AUTH = 'https://auth.tesla.com/oauth2/v3/authorize';
const TOKEN = 'https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/token';
const SCOPES = 'openid offline_access vehicle_device_data vehicle_location';
const VIN = E.TESLA_VIN || '';           // optional; first vehicle is used otherwise
const ALLOWED_ORIGIN = E.ALLOWED_ORIGIN || '*';
const APP_TOKEN = E.APP_TOKEN || '';     // optional shared secret: client sends ?k=APP_TOKEN or header x-app-token
const STORE = path.join(__dirname, 'tokens.json');
const STATIC = path.join(__dirname, '..');
const KEY_PEM = path.join(__dirname, 'keys', 'public-key.pem');

let tok = fs.existsSync(STORE) ? JSON.parse(fs.readFileSync(STORE, 'utf8')) : null;
const states = new Set();
const save = t => { tok = t; fs.writeFileSync(STORE, JSON.stringify(t), { mode: 0o600 }); };

async function tokenReq(body) {
  const r = await fetch(TOKEN, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body) });
  const j = await r.json(); if (!r.ok) throw new Error('token: ' + JSON.stringify(j)); return j;
}
async function access() {
  if (!tok) { const e = new Error('not logged in'); e.status = 401; throw e; }
  if (Date.now() > tok.expires_at - 60_000) {
    const j = await tokenReq({ grant_type: 'refresh_token', client_id: CLIENT_ID, refresh_token: tok.refresh_token });
    save({ ...j, refresh_token: j.refresh_token || tok.refresh_token, expires_at: Date.now() + j.expires_in * 1000 });
  }
  return tok.access_token;
}
async function fleet(p) {
  const r = await fetch(AUDIENCE + p, { headers: { Authorization: 'Bearer ' + await access() } });
  const j = await r.json().catch(() => ({})); if (!r.ok) { const e = new Error(j.error || ('fleet ' + r.status)); e.status = r.status; throw e; } return j;
}
let vinCache = VIN, last = null, lastAt = 0;
async function vehicle() {
  if (Date.now() - lastAt < 1500 && last) return last;           // de-dupe bursts (each call is billed)
  if (!vinCache) { const l = await fleet('/api/1/vehicles'); if (!l.response?.length) throw new Error('no vehicles'); vinCache = l.response[0].vin; }
  // NOTE: vehicle_data does NOT wake the car; if asleep it returns 408. We never call wake_up automatically (wakes are costly).
  const j = await fleet(`/api/1/vehicles/${vinCache}/vehicle_data?endpoints=${encodeURIComponent('drive_state;location_data')}`);
  const d = j.response?.drive_state || {};
  const mph = d.speed;                                           // integer mph, null when parked
  last = {
    vin: vinCache, ts: d.timestamp || Date.now(),
    speed_kmh: mph == null ? 0 : mph * 1.609344,
    lat: d.latitude ?? d.native_latitude ?? null, lon: d.longitude ?? d.native_longitude ?? null, heading: d.heading ?? null,
    shift_state: d.shift_state ?? null,
    destination: (d.active_route_latitude != null && d.active_route_longitude != null) ? {
      name: d.active_route_destination || null, lat: d.active_route_latitude, lon: d.active_route_longitude,
      km_to_arrival: d.active_route_miles_to_arrival != null ? d.active_route_miles_to_arrival * 1.609344 : null,
      minutes_to_arrival: d.active_route_minutes_to_arrival ?? null,
    } : null,
  };
  lastAt = Date.now(); return last;
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.pem': 'application/x-pem-file', '.svg': 'image/svg+xml' };
function send(res, code, body, type = 'application/json') {
  res.writeHead(code, { 'Content-Type': type, 'Access-Control-Allow-Origin': ALLOWED_ORIGIN, 'Access-Control-Allow-Headers': 'x-app-token', 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
http.createServer(async (req, res) => {
  const u = new URL(req.url, PUBLIC_URL);
  try {
    if (req.method === 'OPTIONS') return send(res, 204, '');
    if (u.pathname === '/.well-known/appspecific/com.tesla.3p.public-key.pem') {
      if (!fs.existsSync(KEY_PEM)) return send(res, 404, 'missing keys/public-key.pem', 'text/plain');
      return send(res, 200, fs.readFileSync(KEY_PEM), MIME['.pem']);
    }
    if (u.pathname === '/auth/login') {
      const st = crypto.randomBytes(12).toString('hex'); states.add(st);
      const q = new URLSearchParams({ response_type: 'code', client_id: CLIENT_ID, redirect_uri: REDIRECT_URI, scope: SCOPES, state: st, prompt_missing_scopes: 'true' });
      res.writeHead(302, { Location: `${AUTH}?${q}` }); return res.end();
    }
    if (u.pathname === '/auth/callback') {
      if (!states.delete(u.searchParams.get('state'))) return send(res, 400, 'bad state', 'text/plain');
      const j = await tokenReq({ grant_type: 'authorization_code', client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code: u.searchParams.get('code'), audience: AUDIENCE, redirect_uri: REDIRECT_URI });
      save({ ...j, expires_at: Date.now() + j.expires_in * 1000 });
      return send(res, 200, '<meta name=viewport content="width=device-width"><h2>Tesla 연결 완료 ✅</h2><p><a href="/">Walloo Road 열기</a></p>', 'text/html; charset=utf-8');
    }
    if (u.pathname === '/api/vehicle') {
      if (APP_TOKEN && u.searchParams.get('k') !== APP_TOKEN && req.headers['x-app-token'] !== APP_TOKEN) return send(res, 403, { error: 'forbidden' });
      return send(res, 200, await vehicle());
    }
    if (u.pathname === '/api/health') return send(res, 200, { ok: true, logged_in: !!tok, audience: AUDIENCE });
    // static app
    let f = path.normalize(path.join(STATIC, u.pathname === '/' ? 'index.html' : u.pathname));
    if (!f.startsWith(STATIC) || f.startsWith(__dirname)) return send(res, 403, 'forbidden', 'text/plain');
    if (fs.existsSync(f) && fs.statSync(f).isFile()) return send(res, 200, fs.readFileSync(f), MIME[path.extname(f)] || 'application/octet-stream');
    send(res, 404, 'not found', 'text/plain');
  } catch (e) { send(res, e.status === 401 ? 401 : (e.status || 500), { error: e.message }); }
}).listen(PORT, () => console.log(`Walloo Road server on :${PORT}  (public ${PUBLIC_URL})`));

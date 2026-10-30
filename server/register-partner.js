// One-time: register your domain with Fleet API (after keys/public-key.pem is reachable on PUBLIC_URL).
// Usage: TESLA_CLIENT_ID=.. TESLA_CLIENT_SECRET=.. PUBLIC_URL=https://your.domain node register-partner.js
const E = process.env, AUD = E.TESLA_FLEET_BASE || 'https://fleet-api.prd.na.vn.cloud.tesla.com';
(async () => {
  const t = await (await fetch('https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: E.TESLA_CLIENT_ID, client_secret: E.TESLA_CLIENT_SECRET, scope: 'openid vehicle_device_data vehicle_location', audience: AUD }) })).json();
  if (!t.access_token) throw new Error(JSON.stringify(t));
  const domain = new URL(E.PUBLIC_URL).hostname;
  const r = await fetch(AUD + '/api/1/partner_accounts', { method: 'POST', headers: { Authorization: 'Bearer ' + t.access_token, 'Content-Type': 'application/json' }, body: JSON.stringify({ domain }) });
  console.log(r.status, await r.text());
})().catch(e => { console.error(e); process.exit(1); });

// Data sources. Each emits updates: { speed (km/h), pos [lon,lat], heading?, dest? {name, lat, lon, coords?} }
class DemoSource {
  constructor(ctx) { this.ctx = ctx; this.name = '데모'; }
  async start(emit) {
    const j = await (await fetch('data/demo_route.json')).json();
    this.route = Geo.makeRoute(j.coords);
    this.s = 0; this.v = 0; this.emit = emit; this.running = true; this.camIdx = 0;
    emit({ speed: 0, pos: j.coords[0], dest: { name: `${j.to} (데모: ${j.from} 출발)`, lon: j.coords.at(-1)[0], lat: j.coords.at(-1)[1], coords: j.coords } });
    this.last = performance.now();
    this.timer = setInterval(() => this.step(), 200);
  }
  targetSpeed() {
    // cruise ~ 62 km/h; for every 2nd camera, deliberately speed over the limit to show the chime
    const cams = this.ctx.routeCams() || [];
    const next = cams.find(c => c.s > this.s - 60);
    let target = 62;
    if (next) {
      const d = next.s - this.s, k = cams.indexOf(next);
      if (d < 1100) target = (k % 2 === 0) ? next.limit + 14 : Math.max(20, next.limit - 6);
    }
    if (this.route.length - this.s < 400) target = Math.max(0, (this.route.length - this.s) / 400 * 40);
    return target;
  }
  step() {
    if (!this.running) return;
    const now = performance.now(), dt = (now - this.last) / 1000 * this.ctx.demoRate(); this.last = now;
    const tgt = this.targetSpeed(), acc = tgt > this.v ? 9 : 14; // km/h per s
    this.v += Math.max(-acc * dt, Math.min(acc * dt, tgt - this.v));
    this.s += this.v / 3.6 * dt;
    if (this.s >= this.route.length - 2) { this.s = this.route.length; this.v = 0; }
    const pt = Geo.pointAt(this.route, this.s);
    this.emit({ speed: this.v, pos: pt.p, heading: pt.heading });
    if (this.s >= this.route.length) { this.running = false; clearInterval(this.timer); this.ctx.onFinish?.(); }
  }
  stop() { this.running = false; clearInterval(this.timer); }
}

class GpsSource {
  constructor() { this.name = 'GPS'; }
  async start(emit, onError) {
    if (!('geolocation' in navigator)) throw new Error('이 브라우저는 위치 정보를 지원하지 않습니다');
    let prev = null;
    this.id = navigator.geolocation.watchPosition(p => {
      const pos = [p.coords.longitude, p.coords.latitude];
      let speed = p.coords.speed; // m/s, may be null (iOS gives it while moving)
      if ((speed == null || isNaN(speed)) && prev) {
        const dt = (p.timestamp - prev.t) / 1000;
        speed = dt > 0 ? Geo.dist(prev.pos, pos) / dt : 0;
      }
      prev = { pos, t: p.timestamp };
      emit({ speed: Math.max(0, (speed || 0) * 3.6), pos, heading: p.coords.heading, accuracy: p.coords.accuracy });
    }, e => onError?.(new Error('위치 오류: ' + e.message)), { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
  }
  stop() { if (this.id != null) navigator.geolocation.clearWatch(this.id); }
}

// Tesla Fleet API via the Walloo Road backend (server/). The backend holds OAuth tokens and calls
// GET /api/1/vehicles/{vin}/vehicle_data?endpoints=drive_state;location_data
class TeslaSource {
  constructor(ctx) { this.ctx = ctx; this.name = 'Tesla'; }
  async start(emit, onError) {
    const raw = (this.ctx.backendUrl() || '').trim(); const qi = raw.indexOf('?');
    const base = (qi >= 0 ? raw.slice(0, qi) : raw).replace(/\/$/, ''), qs = qi >= 0 ? raw.slice(qi) : ''; // e.g. https://host?k=APP_TOKEN
    if (!base) throw new Error('설정에서 Tesla 백엔드 URL을 입력하세요 (server/README.md 참고)');
    this.running = true;
    const poll = async () => {
      if (!this.running) return;
      try {
        const r = await fetch(base + '/api/vehicle' + qs, { cache: 'no-store' });
        if (r.status === 401) throw new Error('Tesla 로그인 필요: ' + base + '/auth/login');
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
        const u = { speed: j.speed_kmh || 0, pos: (j.lon != null) ? [j.lon, j.lat] : null, heading: j.heading };
        if (j.destination && j.destination.lat != null) u.dest = { name: j.destination.name || '차량 내비 목적지', lat: j.destination.lat, lon: j.destination.lon, fromCar: true };
        else u.dest = null;
        emit(u);
      } catch (e) { onError?.(e); }
      this.timer = setTimeout(poll, Math.max(2, this.ctx.pollSec()) * 1000);
    };
    poll();
  }
  stop() { this.running = false; clearTimeout(this.timer); }
}

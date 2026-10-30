(() => {
  const $ = id => document.getElementById(id);
  const LS = { get: (k, d) => { try { const v = localStorage.getItem('wr.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
               set: (k, v) => localStorage.setItem('wr.' + k, JSON.stringify(v)) };
  const THRESH = [1000, 500, 200];

  const S = { source: null, running: false, speed: 0, pos: null, route: null, routeCams: [], dest: null,
              hint: null, s: 0, announced: new Map(), over: false, chimeTimer: null, audio: null, wake: null,
              cameras: [], lastReroute: 0, routing: false };

  // ---------- car + colors ----------
  const car = new CarView($('carWrap'));
  function setPaint(id) {
    const p = PAINTS.find(x => x.id === id) || PAINTS[0];
    car.setPaint(p.hex); LS.set('paint', p.id);
    $('colorName').textContent = `${p.name} · ${p.ko}`;
    document.querySelectorAll('.swatch').forEach(b => b.classList.toggle('sel', b.dataset.id === p.id));
  }
  for (const p of PAINTS) {
    const b = document.createElement('button');
    b.className = 'swatch'; b.dataset.id = p.id; b.title = p.name; b.style.background = p.hex;
    b.onclick = () => setPaint(p.id); $('colors').appendChild(b);
  }
  setPaint(LS.get('paint', 'stealth'));

  // ---------- settings ----------
  const cfg = { src: LS.get('src', 'demo'), backend: LS.get('backend', ''), poll: LS.get('poll', 5), rate: LS.get('rate', 4), tts: LS.get('tts', true), chime: LS.get('chime', true) };
  $('srcSelect').value = cfg.src; $('backendUrl').value = cfg.backend; $('pollSec').value = cfg.poll; $('demoRate').value = cfg.rate;
  $('ttsOn').checked = cfg.tts; $('chimeOn').checked = cfg.chime;
  const pillName = { demo: '데모', gps: 'GPS', tesla: 'Tesla' };
  const updPill = () => { $('srcPill').textContent = pillName[cfg.src] + (S.running ? ' · 주행 중' : ''); $('srcPill').classList.toggle('live', S.running); };
  updPill();
  $('settingsBtn').onclick = () => $('settings').showModal();
  $('settings').addEventListener('close', () => {
    const nsrc = $('srcSelect').value;
    Object.assign(cfg, { backend: $('backendUrl').value.trim(), poll: +$('pollSec').value || 5, rate: +$('demoRate').value, tts: $('ttsOn').checked, chime: $('chimeOn').checked });
    LS.set('backend', cfg.backend); LS.set('poll', cfg.poll); LS.set('rate', cfg.rate); LS.set('tts', cfg.tts); LS.set('chime', cfg.chime);
    if (nsrc !== cfg.src) { cfg.src = nsrc; LS.set('src', nsrc); if (S.running) stopDrive(); }
    updPill();
  });

  // ---------- camera data ----------
  fetch('data/cameras.json').then(r => r.json()).then(j => {
    S.cameras = j.cameras;
    $('dataNote').textContent = `단속 카메라 데이터: ${j.cameras.length.toLocaleString()}개 — ${j.source}`;
    if (S.route) setRouteCoords(S.route.coords, S.dest);
  });

  // ---------- audio / speech ----------
  function unlockAudio() {
    if (!S.audio) S.audio = new (window.AudioContext || window.webkitAudioContext)();
    S.audio.resume();
    // play a silent buffer + empty utterance inside the user gesture (iOS requirement)
    const b = S.audio.createBuffer(1, 1, 22050), src = S.audio.createBufferSource(); src.buffer = b; src.connect(S.audio.destination); src.start(0);
    if ('speechSynthesis' in window) { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); }
  }
  let koVoice = null;
  const pickVoice = () => { koVoice = (speechSynthesis.getVoices() || []).find(v => /ko[-_]KR/i.test(v.lang)) || null; };
  if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  function say(text) {
    if (!cfg.tts || !('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(text); u.lang = 'ko-KR'; if (koVoice) u.voice = koVoice; u.rate = 1.05;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  }
  function chime() {
    if (!cfg.chime || !S.audio) return;
    const ctx = S.audio, t = ctx.currentTime;
    [[1318.5, 0], [1046.5, 0.18]].forEach(([f, dt]) => {
      const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f; o2.type = 'sine'; o2.frequency.value = f * 2.01;
      g.gain.setValueAtTime(0.0001, t + dt); g.gain.exponentialRampToValueAtTime(0.5, t + dt + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.6);
      o.connect(g); o2.connect(g); g.connect(ctx.destination);
      o.start(t + dt); o2.start(t + dt); o.stop(t + dt + 0.65); o2.stop(t + dt + 0.65);
    });
  }
  function setOver(on) {
    if (on === S.over) return; S.over = on;
    $('speedNum').classList.toggle('over', on); $('alertBanner').classList.toggle('over', on);
    if (on) { chime(); S.chimeTimer = setInterval(chime, 1100); } else { clearInterval(S.chimeTimer); S.chimeTimer = null; }
  }

  // ---------- wake lock ----------
  async function wakeOn() { try { if ('wakeLock' in navigator) S.wake = await navigator.wakeLock.request('screen'); } catch (e) { console.warn(e); } }
  document.addEventListener('visibilitychange', () => { if (S.running && document.visibilityState === 'visible') wakeOn(); });

  // ---------- route ----------
  const fmtD = m => m >= 1000 ? (m / 1000).toFixed(1) + ' km' : Math.max(0, Math.round(m / 10) * 10) + ' m';
  function setRouteCoords(coords, dest) {
    S.route = Geo.makeRoute(coords); S.dest = dest; S.hint = null; S.announced = new Map();
    S.routeCams = Geo.camerasOnRoute(S.route, S.cameras, 30);
    $('routeInfo').textContent = `→ ${dest?.name || '목적지'} · ${fmtD(S.route.length)} · 경로상 단속 카메라 ${S.routeCams.length}개`;
    renderCamList(); drawMap();
  }
  async function planRoute(dest, from) {
    if (S.routing) return; S.routing = true;
    try {
      from = from || S.pos || await currentPos();
      $('routeInfo').textContent = '경로 탐색 중…';
      const r = await Geo.route(from, [dest.lon, dest.lat]);
      setRouteCoords(r.coords, dest);
    } catch (e) { $('routeInfo').textContent = '⚠️ ' + e.message; }
    finally { S.routing = false; S.lastReroute = Date.now(); }
  }
  const currentPos = () => new Promise((res, rej) => navigator.geolocation
    ? navigator.geolocation.getCurrentPosition(p => res([p.coords.longitude, p.coords.latitude]), e => rej(new Error('현재 위치를 알 수 없습니다: ' + e.message)), { enableHighAccuracy: true, timeout: 10000 })
    : rej(new Error('위치 정보 미지원')));

  // destination search (Nominatim)
  async function search() {
    const q = $('destInput').value.trim(); if (!q) return;
    $('destResults').innerHTML = '<li>검색 중…</li>';
    try {
      const rs = await Geo.geocode(q);
      $('destResults').innerHTML = rs.length ? '' : '<li>결과 없음</li>';
      rs.forEach(r => {
        const li = document.createElement('li'); li.innerHTML = `${r.name}<small>${r.label}</small>`;
        li.onclick = () => { $('destResults').innerHTML = ''; $('destInput').value = r.name; planRoute(r); };
        $('destResults').appendChild(li);
      });
    } catch (e) { $('destResults').innerHTML = `<li>⚠️ ${e.message}</li>`; }
  }
  $('destBtn').onclick = search; $('destInput').addEventListener('keydown', e => { if (e.key === 'Enter') search(); });

  // ---------- main update loop ----------
  function onUpdate(u) {
    S.speed = u.speed || 0;
    if (u.pos) S.pos = u.pos;
    car.setSpeed(S.speed);
    $('speedNum').textContent = Math.round(S.speed);
    if (u.dest !== undefined) {
      if (u.dest && u.dest.coords) { if (!S.dest || S.dest.name !== u.dest.name) setRouteCoords(u.dest.coords, u.dest); }
      else if (u.dest && u.dest.fromCar) {
        const changed = !S.dest || Geo.dist([S.dest.lon, S.dest.lat], [u.dest.lon, u.dest.lat]) > 50;
        if (changed && S.pos) planRoute(u.dest, S.pos);
      }
    }
    evaluate();
  }
  function evaluate() {
    if (!S.route || !S.pos) { hideBanner(); setOver(false); return; }
    const loc = Geo.locate(S.route, S.pos, S.hint); S.hint = loc.i; S.s = loc.s;
    if (loc.d > 150 && S.dest && Date.now() - S.lastReroute > 20000 && cfg.src !== 'demo') planRoute(S.dest, S.pos); // off-route → reroute
    let showCam = null, showD = 0;
    S.routeCams.forEach((c, k) => {
      const d = c.s - S.s; let done = S.announced.get(k) || new Set();
      for (const th of THRESH) {
        if (d <= th && d > 0 && !done.has(th)) {
          // announce only the closest crossed threshold (avoid stacking when a route starts near a camera)
          THRESH.filter(t => t >= th).forEach(t => done.add(t));
          if (d > th - 120) announce(c, th);
        }
      }
      S.announced.set(k, done);
      if (!showCam && d > -15 && d <= 1000) { showCam = c; showD = d; }
    });
    if (showCam) {
      $('bLimit').textContent = showCam.limit; $('bDist').textContent = showD <= 0 ? '통과 중' : fmtD(showD);
      $('bPlace').textContent = `과속 단속 · ${showCam.road || ''} ${showCam.place || ''}`.trim();
      $('alertBanner').classList.remove('hidden');
      setOver(S.running && S.speed > showCam.limit);
    } else { hideBanner(); setOver(false); }
    renderCamList(); drawMap();
  }
  function hideBanner() { $('alertBanner').classList.add('hidden'); }
  function announce(c, th) {
    const dist = th === 1000 ? '1킬로미터' : th + '미터';
    const msg = th === 200 ? `${dist} 앞 단속 카메라. 제한속도 ${c.limit}.` : `${dist} 앞, 제한속도 ${c.limit}킬로미터 과속 단속 카메라가 있습니다.`;
    say(msg); console.log('[announce]', th, c.limit, c.place);
  }

  // ---------- list + mini map ----------
  let lastListKey = '';
  function renderCamList() {
    const key = S.routeCams.length + ':' + Math.round(S.s / 20);
    if (key === lastListKey) return; lastListKey = key;
    $('camList').innerHTML = S.routeCams.map(c => {
      const d = c.s - S.s;
      return `<li class="${d < -15 ? 'passed' : ''}"><span class="lim">${c.limit}</span><span>${c.road || ''} · ${c.place || ''}</span><span class="d">${d < -15 ? '통과' : fmtD(d)}</span></li>`;
    }).join('') || (S.route ? '<li>경로상 등록된 과속 단속 카메라 없음</li>' : '');
  }
  function drawMap() {
    const cv = $('miniMap'), g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height);
    if (!S.route) { g.fillStyle = '#555'; g.font = '22px sans-serif'; g.fillText('목적지를 설정하면 경로가 표시됩니다', 24, 136); return; }
    const c = S.route.coords; let x0 = 180, x1 = -180, y0 = 90, y1 = -90;
    c.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); });
    const k = Math.cos(y0 * Math.PI / 180), W = cv.width - 40, H = cv.height - 40;
    const sc = Math.min(W / ((x1 - x0) * k || 1e-6), H / ((y1 - y0) || 1e-6));
    const ox = 20 + (W - (x1 - x0) * k * sc) / 2, oy = 20 + (H - (y1 - y0) * sc) / 2;
    const P = (x, y) => [ox + (x - x0) * k * sc, oy + (y1 - y) * sc];
    g.lineWidth = 6; g.strokeStyle = '#2d3e66'; g.lineJoin = 'round'; g.beginPath(); c.forEach(([x, y], i) => { const [a, b] = P(x, y); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.stroke();
    if (S.s > 0) { g.strokeStyle = '#3e6ae1'; g.beginPath(); let started = false; for (let i = 0; i < c.length && S.route.cum[i] <= S.s; i++) { const [a, b] = P(...c[i]); started ? g.lineTo(a, b) : (g.moveTo(a, b), started = true); } g.stroke(); }
    for (const cam of S.routeCams) { const [a, b] = P(cam.lon, cam.lat); g.fillStyle = cam.s < S.s ? '#5a2a2c' : '#e82127'; g.beginPath(); g.arc(a, b, 7, 0, 7); g.fill(); }
    const [ex, ey] = P(...c[c.length - 1]); g.fillStyle = '#fff'; g.fillRect(ex - 6, ey - 6, 12, 12);
    if (S.pos) { const [a, b] = P(...S.pos); g.fillStyle = '#fff'; g.beginPath(); g.arc(a, b, 10, 0, 7); g.fill(); g.fillStyle = '#3e6ae1'; g.beginPath(); g.arc(a, b, 7, 0, 7); g.fill(); }
  }
  drawMap();

  // ---------- start / stop ----------
  const ctx = { routeCams: () => S.routeCams, demoRate: () => cfg.rate, backendUrl: () => cfg.backend, pollSec: () => cfg.poll,
                onFinish: () => { say('목적지에 도착했습니다.'); setTimeout(stopDrive, 1500); } };
  async function startDrive() {
    unlockAudio(); wakeOn();
    const src = cfg.src === 'gps' ? new GpsSource() : cfg.src === 'tesla' ? new TeslaSource(ctx) : new DemoSource(ctx);
    if (cfg.src === 'demo') { S.dest = null; S.route = null; }
    S.source = src; S.running = true; $('startBtn').textContent = '주행 종료'; $('startBtn').classList.add('stop'); updPill();
    try { await src.start(onUpdate, e => { $('routeInfo').textContent = '⚠️ ' + e.message; }); say('주행을 시작합니다.'); }
    catch (e) { $('routeInfo').textContent = '⚠️ ' + e.message; stopDrive(); }
  }
  function stopDrive() {
    S.source?.stop(); S.source = null; S.running = false; S.speed = 0; car.setSpeed(0); $('speedNum').textContent = '0';
    setOver(false); S.wake?.release?.(); S.wake = null;
    $('startBtn').textContent = '주행 시작'; $('startBtn').classList.remove('stop'); updPill();
  }
  $('startBtn').onclick = () => S.running ? stopDrive() : startDrive();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(console.warn);
  window.WR = { S, cfg, setPaint, startDrive, stopDrive };
})();

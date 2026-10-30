// Geometry, routing (OSRM) and geocoding (Nominatim) helpers. Coordinates are [lon, lat].
const Geo = (() => {
  const R = 6371008.8, rad = d => d * Math.PI / 180;
  function dist(a, b) {
    const dLat = rad(b[1] - a[1]), dLon = rad(b[0] - a[0]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function bearing(a, b) {
    const y = Math.sin(rad(b[0] - a[0])) * Math.cos(rad(b[1]));
    const x = Math.cos(rad(a[1])) * Math.sin(rad(b[1])) - Math.sin(rad(a[1])) * Math.cos(rad(b[1])) * Math.cos(rad(b[0] - a[0]));
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }
  // local equirectangular projection of p onto segment a-b -> {d (m), t (0..1)}
  function projSeg(p, a, b) {
    const k = Math.cos(rad(p[1])) * R * Math.PI / 180, m = R * Math.PI / 180;
    const ax = (a[0] - p[0]) * k, ay = (a[1] - p[1]) * m, bx = (b[0] - p[0]) * k, by = (b[1] - p[1]) * m;
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
    let t = L2 ? -(ax * dx + ay * dy) / L2 : 0; t = Math.max(0, Math.min(1, t));
    const x = ax + t * dx, y = ay + t * dy;
    return { d: Math.hypot(x, y), t };
  }
  function makeRoute(coords) {
    const cum = [0];
    for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + dist(coords[i - 1], coords[i]));
    return { coords, cum, length: cum[cum.length - 1], lastIdx: 0 };
  }
  // nearest point on route -> {s (m along), d (offset m), i}
  function locate(route, p, hint = null) {
    const c = route.coords; let best = { d: Infinity, s: 0, i: 0 };
    let from = 0, to = c.length - 1;
    if (hint != null) { from = Math.max(0, hint - 40); to = Math.min(c.length - 1, hint + 200); }
    for (let i = from; i < to; i++) {
      const r = projSeg(p, c[i], c[i + 1]);
      if (r.d < best.d) best = { d: r.d, s: route.cum[i] + r.t * (route.cum[i + 1] - route.cum[i]), i };
    }
    if (hint != null && best.d > 80) return locate(route, p, null);
    return best;
  }
  function pointAt(route, s) {
    const c = route.coords, cum = route.cum;
    s = Math.max(0, Math.min(route.length, s));
    let lo = 0, hi = cum.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= s) lo = mid; else hi = mid; }
    const seg = cum[hi] - cum[lo] || 1, t = (s - cum[lo]) / seg;
    return { p: [c[lo][0] + (c[hi][0] - c[lo][0]) * t, c[lo][1] + (c[hi][1] - c[lo][1]) * t], heading: bearing(c[lo], c[hi]), i: lo };
  }
  // cameras = [[lat,lon,limit,road,place,dir,type],...]; returns those within maxOff of the route, sorted by s
  function camerasOnRoute(route, cameras, maxOff = 30) {
    let minX = 180, minY = 90, maxX = -180, maxY = -90;
    for (const [x, y] of route.coords) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    const pad = 0.001, out = [];
    for (const c of cameras) {
      const p = [c[1], c[0]];
      if (p[0] < minX - pad || p[0] > maxX + pad || p[1] < minY - pad || p[1] > maxY + pad) continue;
      const r = locate(route, p, null);
      if (r.d <= maxOff) {
        // direction hint: place text often says "(○○방향)" — we keep it for display. Same-spot duplicates (both carriageways) are merged.
        out.push({ lat: c[0], lon: c[1], limit: c[2], road: c[3], place: c[4], dir: c[5], s: r.s, off: r.d });
      }
    }
    out.sort((a, b) => a.s - b.s);
    const merged = [];
    for (const c of out) { const prev = merged[merged.length - 1]; if (prev && c.s - prev.s < 40 && prev.limit === c.limit) continue; merged.push(c); }
    return merged;
  }
  async function geocode(q) {
    const u = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&countrycodes=kr&accept-language=ko&q=${encodeURIComponent(q)}`;
    const r = await fetch(u, { headers: { 'Accept': 'application/json' } });
    if (!r.ok) throw new Error('지오코딩 실패 ' + r.status);
    return (await r.json()).map(x => ({ name: x.name || x.display_name.split(',')[0], label: x.display_name, lon: +x.lon, lat: +x.lat }));
  }
  async function route(from, to) {
    const u = `https://router.project-osrm.org/route/v1/driving/${from[0]},${from[1]};${to[0]},${to[1]}?overview=full&geometries=geojson`;
    const r = await fetch(u);
    if (!r.ok) throw new Error('경로 탐색 실패 ' + r.status);
    const j = await r.json();
    if (j.code !== 'Ok' || !j.routes.length) throw new Error('경로 없음');
    return { coords: j.routes[0].geometry.coordinates, duration: j.routes[0].duration };
  }
  return { dist, bearing, makeRoute, locate, pointAt, camerasOnRoute, geocode, route };
})();

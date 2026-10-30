// Photo car view. Images: Tesla official configurator renders of the Model Y L (6-seat, China/Korea),
// static-assets.tesla.cn compositor, context=design_studio_2, model=my, view=STUD_SIDE,
// options $MTY87 (Model Y L) + $STY6S (6 seats) + $WY19L (19" Y L wheels) + paint, cropped 1200x416.
// Renders natively face LEFT (front on the left). Wheels are cut from the same photo and rotated.
const PAINTS = [
  { id: 'stealth', code: 'PN01', name: 'Stealth Grey', ko: '스텔스 그레이', hex: '#5b5e63' },
  { id: 'pearl', code: 'PPSW', name: 'Pearl White Multi-Coat', ko: '펄 화이트 멀티 코트', hex: '#e9e9e6' },
  { id: 'black', code: 'PX02', name: 'Diamond Black', ko: '다이아몬드 블랙', hex: '#141518' },
  { id: 'glacier', code: 'PB01', name: 'Glacier Blue', ko: '글레이셔 블루', hex: '#8fa6bb' },
  { id: 'ultrared', code: 'PR01', name: 'Ultra Red', ko: '울트라 레드', hex: '#a3141c' },
  { id: 'gold', code: 'PN03', name: 'Starlight Gold', ko: '스타라이트 골드', hex: '#b9ab94' },
];
// Geometry of the 1200x416 photos (all paints share it): wheel centres + overlay radius in px.
const CAR_W = 1200, CAR_H = 416, WHEELS = [{ x: 214.0, y: 308.5 }, { x: 964.9, y: 307.9 }], RIM_R = 90;

class CarView {
  constructor(el) {
    const pct = v => (v * 100).toFixed(4) + '%';
    const d = RIM_R * 2;
    el.innerHTML = `<div class="car-photo" style="aspect-ratio:${CAR_W}/${CAR_H}">
      <img class="car-body" alt="Tesla Model Y L" src="img/car/${PAINTS[0].id}.webp">
      ${WHEELS.map(w => `<div class="car-wheel" style="left:${pct((w.x - RIM_R) / CAR_W)};top:${pct((w.y - RIM_R) / CAR_H)};width:${pct(d / CAR_W)}">
        <img alt="" src="img/car/${PAINTS[0].id}.webp" style="width:${pct(CAR_W / d)};left:${pct(-(w.x - RIM_R) / d)};top:${pct(-(w.y - RIM_R) / d)}"></div>`).join('')}
    </div>`;
    window.__car = this;
    this.imgs = [...el.querySelectorAll('img')];
    this.wheels = [...el.querySelectorAll('.car-wheel')];
    for (const p of PAINTS) { const i = new Image(); i.src = `img/car/${p.id}.webp`; } // preload
    this.angle = 0; this.shown = 0; this.target = 0; this.last = performance.now();
    this.road = document.getElementById('roadLines'); this.roadX = 0;
    requestAnimationFrame(t => this.tick(t));
  }
  setSpeed(kmh) { this.target = Math.max(0, kmh || 0); }
  setPaint(hexOrId) {
    const p = PAINTS.find(x => x.hex === hexOrId || x.id === hexOrId) || PAINTS[0];
    document.documentElement.style.setProperty('--paint', p.hex);
    for (const i of this.imgs) i.src = `img/car/${p.id}.webp`;
  }
  tick(t) {
    const dt = Math.min(0.1, (t - this.last) / 1000); this.last = t;
    this.shown += (this.target - this.shown) * Math.min(1, dt * 2.5);
    if (this.shown < 0.05 && this.target === 0) this.shown = 0;
    // visual spin: 100 km/h -> 4 rev/s. Car drives LEFT, so wheels turn counter-clockwise.
    const revPerSec = this.shown / 25;
    this.angle = (this.angle - revPerSec * 360 * dt) % 360;
    const blur = Math.min(1.6, Math.max(0, (this.shown - 40) / 50)).toFixed(2);
    for (const w of this.wheels) {
      w.style.transform = `rotate(${this.angle.toFixed(2)}deg)`;
      w.style.filter = blur > 0 ? `blur(${blur}px)` : '';
    }
    // ground scrolls to the right when driving left
    this.roadX = (this.roadX + this.shown * 4 * dt) % 80;
    if (this.road) this.road.style.transform = `translateX(${(this.roadX - 80).toFixed(2)}px)`;
    requestAnimationFrame(n => this.tick(n));
  }
}

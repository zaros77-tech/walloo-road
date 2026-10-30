// Original side-view illustration of a long-wheelbase crossover (Model Y L proportions:
// L 4976mm, WB 3040mm, H 1668mm). No logos / official artwork.
const PAINTS = [
  { id: 'stealth', name: 'Stealth Grey', ko: '스텔스 그레이', hex: '#5b5e63' },
  { id: 'pearl', name: 'Pearl White Multi-Coat', ko: '펄 화이트 멀티 코트', hex: '#e9e9e6' },
  { id: 'black', name: 'Diamond Black', ko: '다이아몬드 블랙', hex: '#141518' },
  { id: 'glacier', name: 'Glacier Blue', ko: '글레이셔 블루', hex: '#8fa6bb' },
  { id: 'marine', name: 'Marine Blue', ko: '마린 블루', hex: '#1d3557' },
  { id: 'ultrared', name: 'Ultra Red', ko: '울트라 레드', hex: '#a3141c' },
  { id: 'quicksilver', name: 'Quicksilver', ko: '퀵실버', hex: '#a9adb1' },
  { id: 'cosmic', name: 'Cosmic Silver', ko: '코스믹 실버', hex: '#c4c2bb' },
];

function wheelSVG(id, cx, cy) {
  let spokes = '';
  for (let i = 0; i < 10; i++) {
    const a = i * 36;
    spokes += `<path d="M-4 -13 L-9 -42 Q0 -46 9 -42 L4 -13 Z" fill="url(#rimG)" transform="rotate(${a})"/>`;
  }
  return `<g transform="translate(${cx} ${cy})">
    <circle r="66" fill="#0c0c0d"/>
    <circle r="64" fill="none" stroke="#1d1e21" stroke-width="3"/>
    <circle r="58" fill="none" stroke="#202124" stroke-width="1" stroke-dasharray="3 6"/>
    <g id="${id}">
      <circle r="47" fill="#26282c"/>
      <circle r="47" fill="none" stroke="#8a8f96" stroke-width="2.5"/>
      ${spokes}
      <circle r="44" fill="none" stroke="#3a3d42" stroke-width="1"/>
      <circle r="14" fill="#2f3236" stroke="#9aa0a7" stroke-width="2"/>
      <circle r="5" fill="#1a1b1e"/>
      <rect x="-2" y="-46" width="4" height="9" rx="1" fill="#c9ced4"/>
    </g>
    <circle r="66" fill="url(#tireShade)"/>
  </g>`;
}

function carSVG() {
  // facing right; ground y=344; wheel centres y=278; rear axle x=240, front axle x=787
  const body = `M66 292 C56 276 54 258 56 238 L60 196 C62 172 70 156 86 146
    C120 116 190 84 280 72 C380 60 480 62 560 76 C600 84 640 104 690 136
    C770 150 850 164 900 182 C930 194 944 210 948 230 L950 264 C950 280 944 290 930 294
    L866 294 A80 80 0 0 0 708 294 L320 294 A80 80 0 0 0 160 294 Z`;
  const glass = `M120 150 C160 120 210 96 284 86 C380 74 480 76 552 90 C590 98 624 116 668 140
    C600 146 520 150 440 154 L150 166 C134 164 124 158 120 150 Z`;
  return `<svg viewBox="0 0 1000 380" xmlns="http://www.w3.org/2000/svg" aria-label="Model Y L">
  <defs>
    <linearGradient id="shine" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".55"/>
      <stop offset=".28" stop-color="#fff" stop-opacity=".12"/>
      <stop offset=".55" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity=".55"/>
    </linearGradient>
    <linearGradient id="glassG" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2b3340"/><stop offset="1" stop-color="#07090c"/>
    </linearGradient>
    <linearGradient id="rimG" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#d3d7dc"/><stop offset=".5" stop-color="#7d828a"/><stop offset="1" stop-color="#3b3e44"/>
    </linearGradient>
    <radialGradient id="tireShade"><stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></radialGradient>
    <radialGradient id="shadowG" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000" stop-opacity=".85"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    <clipPath id="bodyClip"><path d="${body}"/></clipPath>
  </defs>
  <ellipse cx="505" cy="346" rx="480" ry="18" fill="url(#shadowG)"/>
  <g transform="translate(0 -29.4) scale(1 1.1)">
    <path d="${body}" fill="var(--paint)" style="transition:fill .5s"/>
    <g clip-path="url(#bodyClip)">
      <rect x="0" y="60" width="1000" height="240" fill="url(#shine)"/>
      <path d="M60 216 C300 206 700 206 948 214" stroke="#fff" stroke-opacity=".22" stroke-width="2" fill="none"/>
      <path d="M60 252 C300 246 700 246 948 254" stroke="#000" stroke-opacity=".25" stroke-width="1.5" fill="none"/>
      <rect x="0" y="276" width="1000" height="30" fill="#0d0e10" opacity=".85"/>
    </g>
    <path d="${glass}" fill="url(#glassG)"/>
    <path d="M150 166 L440 154 C520 150 600 146 668 140" stroke="#000" stroke-width="4" fill="none" opacity=".9"/>
    <path d="M330 80 L322 160" stroke="#0a0a0b" stroke-width="10"/>
    <path d="M548 88 L536 150" stroke="#0a0a0b" stroke-width="8"/>
    <path d="M188 110 L196 163" stroke="#0a0a0b" stroke-width="7"/>
    <path d="M326 166 C324 210 324 250 328 290 M538 154 C536 210 534 250 530 290 M700 146 C706 176 706 200 702 228" stroke="#000" stroke-opacity=".45" stroke-width="2" fill="none"/>
    <rect x="420" y="180" width="44" height="6" rx="3" fill="#000" opacity=".35"/>
    <rect x="620" y="174" width="44" height="6" rx="3" fill="#000" opacity=".35"/>
    <path d="M676 142 L700 136 L704 152 L682 156 Z" fill="#0c0d0f"/>
    <path d="M896 184 C916 190 934 198 942 210 L902 202 Z" fill="#f4f6f8" opacity=".95"/>
    <path d="M896 184 C916 190 934 198 942 210" stroke="#bfe3ff" stroke-width="2" fill="none" opacity=".8"/>
    <path d="M56 196 C58 180 64 170 76 162 L96 160 L94 176 L58 190 Z" fill="#b3121a"/>
    <path d="M58 194 L94 176" stroke="#ff4a4a" stroke-width="2" opacity=".8"/>
    <path d="M84 146 C100 138 112 136 130 134" stroke="#000" stroke-width="4" opacity=".5" fill="none"/>
  </g>
  ${wheelSVG('wheelR', 240, 278)}
  ${wheelSVG('wheelF', 787, 278)}
  </svg>`;
}

class CarView {
  constructor(el) {
    el.innerHTML = carSVG();
    this.wheels = [el.querySelector('#wheelR'), el.querySelector('#wheelF')];
    this.angle = 0; this.shown = 0; this.target = 0; this.last = performance.now();
    this.road = document.getElementById('roadLines'); this.roadX = 0;
    requestAnimationFrame(t => this.tick(t));
  }
  setSpeed(kmh) { this.target = Math.max(0, kmh || 0); }
  setPaint(hex) { document.documentElement.style.setProperty('--paint', hex); }
  tick(t) {
    const dt = Math.min(0.1, (t - this.last) / 1000); this.last = t;
    // smooth toward target speed (approx 0.5 s time constant)
    this.shown += (this.target - this.shown) * Math.min(1, dt * 2.5);
    if (this.shown < 0.05 && this.target === 0) this.shown = 0;
    // visual spin: 100 km/h -> 4 rev/s (true rate would strobe on screen)
    const revPerSec = this.shown / 25;
    this.angle = (this.angle + revPerSec * 360 * dt) % 360;
    for (const w of this.wheels) w.setAttribute('transform', `rotate(${this.angle.toFixed(2)})`);
    this.roadX = (this.roadX - this.shown * 4 * dt) % 80;
    if (this.road) this.road.style.transform = `translateX(${this.roadX}px)`;
    requestAnimationFrame(n => this.tick(n));
  }
}

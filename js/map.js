// Maps. Each map has solid obstacles (rects + circles) and ground zones (sand, snow, water, ice).
// Obstacles marked `tall` also block line of sight, so you can hide behind them.
// `style` picks how an obstacle is drawn; 'none' means the map's own paint() draws it.

export const MAPS = {};
const def = m => { MAPS[m.id] = m; return m; };

// Live bindings: importers always see the current map after setMap()
export let MAP = null;
export let WORLD = { w: 2400, h: 1600 };
export let RECTS = [];
export let CIRCLES = [];
export let ZONES = [];

export function setMap(id) {
  MAP = MAPS[id] || MAPS.schoolyard;
  WORLD = { w: MAP.w, h: MAP.h };
  RECTS = MAP.rects;
  CIRCLES = MAP.circles;
  ZONES = MAP.zones || [];
  return MAP;
}

// ---------- ground effects ----------
const GROUND = {
  normal: { speed: 1 },
  sand: { speed: 0.55 },
  snow: { speed: 0.7 },
  water: { speed: 0.5 },
  ice: { speed: 1.08, slide: true },
};
export function groundAt(x, y) {
  for (const z of ZONES) {
    const inside = z.r != null
      ? (x - z.x) ** 2 + (y - z.y) ** 2 < z.r * z.r
      : x > z.x && x < z.x + z.w && y > z.y && y < z.y + z.h;
    if (inside) return GROUND[z.kind] || GROUND.normal;
  }
  return GROUND.normal;
}

// ---------- seeded random (map layouts must match on every client) ----------
function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const courtPosts = c => [
  { x: c.x - 16, y: c.y + c.h / 2, r: 10, style: 'none' },
  { x: c.x + c.w + 16, y: c.y + c.h / 2, r: 10, style: 'none' },
];

// ============================================================
// 1. SCHOOLYARD (the original): 2 courts, playground, big wall
// ============================================================
{
  const COURTS = [
    { x: 140, y: 140, w: 560, h: 300, color: '#d9733f', key: '#b85a2c', label: 'COURT 1' },
    { x: 140, y: 1160, w: 560, h: 300, color: '#3f6fd9', key: '#2c55b8', label: 'COURT 2' },
  ];
  const PG = { x: 1450, y: 130, w: 820, h: 640 };
  const SANDBOX = { x: 2050, y: 440, w: 180, h: 180 };
  const SWING_POSTS = [{ x: 1850, y: 240 }, { x: 2025, y: 240 }, { x: 2200, y: 240 }];
  const DOME = { x: 1640, y: 580, r: 72 };
  const MERRY = { x: 1905, y: 590, r: 58 };
  const SLIDE_TOWER = { x: 1520, y: 200, w: 90, h: 90 };
  const SLIDE_CHUTE = { x: 1610, y: 225, w: 150, h: 40 };
  const SEESAW = { x: 1730, y: 395, w: 170, h: 18 };
  const FOUNTAIN = { x: 820, y: 800, r: 55 };
  const TREES = [
    { x: 1500, y: 1060 }, { x: 1720, y: 1260 }, { x: 1960, y: 1080 }, { x: 2210, y: 1310 },
    { x: 1560, y: 1420 }, { x: 2060, y: 1450 }, { x: 1280, y: 260 }, { x: 930, y: 1460 },
    { x: 2300, y: 900 }, { x: 1300, y: 1350 }, { x: 860, y: 120 }, { x: 60, y: 800 },
  ];

  def({
    id: 'schoolyard', name: 'Schoolyard', icon: '🏫',
    desc: 'Two basketball courts, a playground and the big wall.',
    w: 2400, h: 1600, bg: '#5aa84a',
    zones: [{ ...SANDBOX, kind: 'sand' }],
    rects: [
      { x: 1090, y: 430, w: 50, h: 740, tall: true, style: 'brick', text: 'TAG UNITED' },
      { ...SLIDE_TOWER, tall: true, style: 'none' },
      { ...SLIDE_CHUTE, style: 'none' },
      { ...SEESAW, style: 'none' },
      { x: 1790, y: 1140, w: 120, h: 60, style: 'table' },
      { x: 2040, y: 1240, w: 120, h: 60, style: 'table' },
      { x: 360, y: 488, w: 120, h: 22, style: 'bench' },
      { x: 360, y: 1090, w: 120, h: 22, style: 'bench' },
      { x: 1280, y: 820, w: 22, h: 110, style: 'bench' },
    ],
    circles: [
      ...TREES.map(t => ({ ...t, r: 36, tall: true, style: 'tree' })),
      { ...DOME, style: 'none' },
      { ...MERRY, style: 'none' },
      { ...FOUNTAIN, style: 'fountain' },
      ...SWING_POSTS.map(p => ({ ...p, r: 11, style: 'none' })),
      ...COURTS.flatMap(courtPosts),
    ],
    paint(g) {
      grass(g, this, '#5aa84a');
      g.fillStyle = '#cfc6b3';
      g.fillRect(0, 770, this.w, 70);
      g.fillRect(1150, 0, 70, this.h);
      g.fillStyle = 'rgba(0,0,0,0.06)';
      for (let x = 0; x < this.w; x += 70) g.fillRect(x, 770, 2, 70);
      for (let y = 0; y < this.h; y += 70) g.fillRect(1150, y, 70, 2);
      g.fillStyle = '#d8d0bd';
      g.beginPath(); g.arc(FOUNTAIN.x, FOUNTAIN.y, 110, 0, Math.PI * 2); g.fill();
      for (const c of COURTS) drawCourt(g, c);

      // playground
      g.fillStyle = '#b8553d';
      roundRect(g, PG.x, PG.y, PG.w, PG.h, 30); g.fill();
      g.strokeStyle = '#8f3e2b'; g.lineWidth = 8; g.stroke();
      specks(g, PG.x + 10, PG.y + 10, PG.w - 20, PG.h - 20, 1800, 'rgba(0,0,0,0.08)', 'rgba(255,255,255,0.07)');
      label(g, 'PLAYGROUND', PG.x + PG.w / 2, PG.y + PG.h - 20);

      const s = SANDBOX;
      g.fillStyle = '#8b5a2b'; g.fillRect(s.x - 10, s.y - 10, s.w + 20, s.h + 20);
      g.fillStyle = '#ead9a2'; g.fillRect(s.x, s.y, s.w, s.h);
      specks(g, s.x, s.y, s.w, s.h, 300, 'rgba(160,120,60,0.25)', 'rgba(160,120,60,0.25)');
      g.fillStyle = '#e84a5f';
      g.beginPath(); g.moveTo(s.x + 40, s.y + 60); g.lineTo(s.x + 70, s.y + 60); g.lineTo(s.x + 55, s.y + 90); g.fill();

      shadowRect(g, SLIDE_TOWER);
      g.fillStyle = '#2e86de'; g.fillRect(SLIDE_TOWER.x, SLIDE_TOWER.y, SLIDE_TOWER.w, SLIDE_TOWER.h);
      g.fillStyle = '#54a0ff'; g.fillRect(SLIDE_TOWER.x + 8, SLIDE_TOWER.y + 8, SLIDE_TOWER.w - 16, SLIDE_TOWER.h - 16);
      g.fillStyle = '#feca57';
      g.beginPath();
      g.moveTo(SLIDE_TOWER.x - 6, SLIDE_TOWER.y + 4); g.lineTo(SLIDE_TOWER.x + SLIDE_TOWER.w / 2, SLIDE_TOWER.y - 22);
      g.lineTo(SLIDE_TOWER.x + SLIDE_TOWER.w + 6, SLIDE_TOWER.y + 4); g.fill();
      const ch = SLIDE_CHUTE;
      g.fillStyle = '#ff9f43'; g.fillRect(ch.x, ch.y, ch.w, ch.h);
      g.fillStyle = '#ffbe76'; g.fillRect(ch.x, ch.y + 8, ch.w, ch.h - 16);

      g.strokeStyle = '#444'; g.lineWidth = 8;
      g.beginPath(); g.moveTo(SWING_POSTS[0].x, SWING_POSTS[0].y); g.lineTo(SWING_POSTS[2].x, SWING_POSTS[2].y); g.stroke();
      for (const sp of SWING_POSTS) { g.fillStyle = '#333'; g.beginPath(); g.arc(sp.x, sp.y, 11, 0, Math.PI * 2); g.fill(); }
      g.strokeStyle = '#999'; g.lineWidth = 2;
      for (const sx of [1895, 1980, 2070, 2155]) {
        g.beginPath(); g.moveTo(sx - 12, 240); g.lineTo(sx - 12, 300); g.moveTo(sx + 12, 240); g.lineTo(sx + 12, 300); g.stroke();
        g.fillStyle = '#222'; g.fillRect(sx - 16, 298, 32, 10);
      }

      g.fillStyle = '#10ac84'; g.fillRect(SEESAW.x, SEESAW.y, SEESAW.w, SEESAW.h);
      g.fillStyle = '#555'; g.fillRect(SEESAW.x + SEESAW.w / 2 - 10, SEESAW.y - 6, 20, SEESAW.h + 12);

      g.fillStyle = 'rgba(0,0,0,0.2)';
      g.beginPath(); g.arc(DOME.x + 8, DOME.y + 8, DOME.r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#ee5253'; g.lineWidth = 6;
      for (let r = DOME.r; r > 10; r -= 18) { g.beginPath(); g.arc(DOME.x, DOME.y, r, 0, Math.PI * 2); g.stroke(); }
      for (let a = 0; a < 8; a++) {
        g.beginPath(); g.moveTo(DOME.x, DOME.y);
        g.lineTo(DOME.x + Math.cos(a * Math.PI / 4) * DOME.r, DOME.y + Math.sin(a * Math.PI / 4) * DOME.r); g.stroke();
      }
      const cols = ['#ff6b6b', '#feca57', '#48dbfb', '#1dd1a1'];
      for (let i = 0; i < 4; i++) {
        g.fillStyle = cols[i];
        g.beginPath(); g.moveTo(MERRY.x, MERRY.y);
        g.arc(MERRY.x, MERRY.y, MERRY.r, i * Math.PI / 2, (i + 1) * Math.PI / 2); g.fill();
      }
      g.fillStyle = '#555'; g.beginPath(); g.arc(MERRY.x, MERRY.y, 12, 0, Math.PI * 2); g.fill();
    },
  });
}

// ============================================================
// 2. DOWNTOWN: city blocks, alleys, parked cars, a street court
// ============================================================
{
  const BLOCKS = [
    { x: 80, y: 80, w: 520, h: 620 }, { x: 800, y: 80, w: 800, h: 620 }, { x: 1800, y: 80, w: 520, h: 620 },
    { x: 80, y: 900, w: 520, h: 620 }, { x: 800, y: 900, w: 800, h: 620, plaza: true }, { x: 1800, y: 900, w: 520, h: 620 },
  ];
  const COURT = { x: 920, y: 1010, w: 560, h: 300, color: '#7a4fd0', key: '#5e38b0', label: 'STREET COURT' };
  const b = (x, y, w, h, c) => ({ x, y, w, h, c, tall: true, style: 'building' });
  const car = (x, y, w, h, c) => ({ x, y, w, h, c, style: 'car' });

  def({
    id: 'downtown', name: 'Downtown', icon: '🏙️',
    desc: 'City blocks, tight alleys and a street court.',
    w: 2400, h: 1600, bg: '#3a3d44',
    zones: [],
    rects: [
      b(110, 110, 190, 240, '#8d6e63'), b(380, 110, 190, 240, '#607d8b'), b(110, 430, 460, 240, '#9e9d89'),
      b(830, 110, 320, 240, '#5c6b7a'), b(1240, 110, 330, 240, '#a1887f'), b(830, 430, 250, 240, '#78909c'),
      b(1830, 110, 460, 240, '#6d7f8c'), b(1830, 430, 190, 240, '#8a7560'), b(2100, 430, 190, 240, '#5f7f73'),
      b(110, 930, 460, 200, '#7b6f8c'), b(110, 1210, 190, 280, '#8d6e63'), b(380, 1210, 190, 280, '#6b7f8f'),
      b(1830, 930, 190, 560, '#7a8b6e'), b(2100, 930, 190, 260, '#8f7a6a'), b(2100, 1270, 190, 220, '#5c6b7a'),
      // parking lot
      car(1140, 460, 50, 95, '#e74c3c'), car(1230, 460, 50, 95, '#f1c40f'), car(1410, 460, 50, 95, '#3498db'),
      car(1140, 570, 50, 95, '#ecf0f1'), car(1320, 570, 50, 95, '#2ecc71'), car(1500, 570, 50, 95, '#9b59b6'),
      // parked on the streets
      car(630, 200, 50, 95, '#e67e22'), car(720, 1100, 50, 95, '#1abc9c'), car(1640, 300, 50, 95, '#c0392b'),
      car(1000, 730, 95, 50, '#34495e'), car(2000, 820, 95, 50, '#f39c12'), car(300, 760, 95, 50, '#16a085'),
      { x: 890, y: 1390, w: 170, h: 75, c: '#ff7043', tall: true, style: 'truck', text: 'TACOS' },
      { x: 1330, y: 1400, w: 120, h: 22, style: 'bench' },
      { x: 1110, y: 940, w: 120, h: 22, style: 'bench' },
    ],
    circles: [
      ...[[850, 960], [1550, 960], [850, 1330], [1550, 1470], [1200, 1450]].map(([x, y]) => ({ x, y, r: 32, tall: true, style: 'tree' })),
      ...courtPosts(COURT),
      ...[[620, 600], [1780, 1000], [780, 400], [1620, 1300]].map(([x, y]) => ({ x, y, r: 10, style: 'hydrant' })),
    ],
    paint(g) {
      g.fillStyle = this.bg; g.fillRect(0, 0, this.w, this.h);
      specks(g, 0, 0, this.w, this.h, 2500, 'rgba(0,0,0,0.15)', 'rgba(255,255,255,0.05)');
      // lane markings
      g.fillStyle = '#e8c547';
      for (let y = 0; y < this.h; y += 60) { g.fillRect(697, y, 6, 34); g.fillRect(1697, y, 6, 34); }
      for (let x = 0; x < this.w; x += 60) g.fillRect(x, 797, 34, 6);
      // crosswalks
      g.fillStyle = 'rgba(255,255,255,0.75)';
      for (const cx of [700, 1700]) {
        for (let i = -3; i <= 3; i++) { g.fillRect(cx + i * 26 - 8, 712, 16, 60); g.fillRect(cx + i * 26 - 8, 828, 16, 60); }
        for (let i = -3; i <= 3; i++) { g.fillRect(cx - 95, 800 + i * 26 - 8, 60, 16); g.fillRect(cx + 35, 800 + i * 26 - 8, 60, 16); }
      }
      // sidewalks / plaza
      for (const bl of BLOCKS) {
        g.fillStyle = bl.plaza ? '#b9b1a3' : '#9da0a6';
        roundRect(g, bl.x, bl.y, bl.w, bl.h, 14); g.fill();
        g.strokeStyle = '#7c7f86'; g.lineWidth = 6; g.stroke();
        g.strokeStyle = 'rgba(0,0,0,0.08)'; g.lineWidth = 2;
        for (let x = bl.x + 40; x < bl.x + bl.w; x += 40) { g.beginPath(); g.moveTo(x, bl.y); g.lineTo(x, bl.y + bl.h); g.stroke(); }
        for (let y = bl.y + 40; y < bl.y + bl.h; y += 40) { g.beginPath(); g.moveTo(bl.x, y); g.lineTo(bl.x + bl.w, y); g.stroke(); }
      }
      // parking lot
      g.fillStyle = '#4a4d55'; g.fillRect(1110, 440, 470, 240);
      g.strokeStyle = '#eee'; g.lineWidth = 3;
      for (let x = 1120; x <= 1570; x += 90) {
        g.beginPath(); g.moveTo(x, 450); g.lineTo(x, 560); g.moveTo(x, 565); g.lineTo(x, 675); g.stroke();
      }
      label(g, 'P', 1545, 470, 26);
      drawCourt(g, COURT);
    },
  });
}

// ============================================================
// 3. SUNNY BEACH: boardwalk, pier, soft sand and shallow water
// ============================================================
{
  def({
    id: 'beach', name: 'Sunny Beach', icon: '🏖️',
    desc: 'Boardwalk shops, palm trees, a pier and shallow water that slows you down.',
    w: 2400, h: 1600, bg: '#f1dca0',
    zones: [
      { x: 1100, y: 1150, w: 150, h: 450, kind: 'normal' }, // pier
      { x: 0, y: 1180, w: 2400, h: 220, kind: 'water' },
      { x: 1500, y: 560, w: 320, h: 220, kind: 'sand' },
      { x: 280, y: 860, w: 280, h: 180, kind: 'sand' },
    ],
    rects: [
      { x: 150, y: 40, w: 260, h: 150, c: '#ff6b6b', tall: true, style: 'hut', text: 'ICE CREAM' },
      { x: 520, y: 40, w: 200, h: 150, c: '#48dbfb', tall: true, style: 'hut', text: 'SURF' },
      { x: 1650, y: 40, w: 260, h: 150, c: '#feca57', tall: true, style: 'hut', text: 'SNACKS' },
      { x: 2000, y: 40, w: 250, h: 150, c: '#1dd1a1', tall: true, style: 'hut', text: 'RENTALS' },
      { x: 1150, y: 680, w: 90, h: 90, tall: true, style: 'tower' },
      { x: 545, y: 530, w: 10, h: 200, style: 'net' },
      { x: 0, y: 1400, w: 1100, h: 200, style: 'none' },   // deep water
      { x: 1250, y: 1400, w: 1150, h: 200, style: 'none' },
    ],
    circles: [
      ...[[900, 350], [1450, 420], [2200, 600], [700, 900], [1850, 950], [200, 1000], [1320, 1040], [2280, 300], [80, 450]]
        .map(([x, y]) => ({ x, y, r: 30, tall: true, style: 'palm' })),
      { x: 520, y: 1210, r: 55, tall: true, style: 'rock' },
      { x: 2000, y: 1180, r: 60, tall: true, style: 'rock' },
      { x: 1620, y: 1240, r: 40, tall: true, style: 'rock' },
      { x: 1000, y: 920, r: 34, style: 'sandcastle' },
    ],
    paint(g) {
      g.fillStyle = this.bg; g.fillRect(0, 0, this.w, this.h);
      specks(g, 0, 0, this.w, this.h, 4000, 'rgba(170,130,60,0.18)', 'rgba(255,255,255,0.25)');
      // boardwalk
      g.fillStyle = '#b0804f'; g.fillRect(0, 0, this.w, 240);
      g.fillStyle = 'rgba(0,0,0,0.12)';
      for (let y = 0; y < 240; y += 24) g.fillRect(0, y, this.w, 2);
      g.fillStyle = '#8a5f35'; g.fillRect(0, 236, this.w, 8);
      // soft sand dunes
      for (const z of this.zones.filter(z => z.kind === 'sand')) {
        g.fillStyle = '#f7e7b8';
        g.beginPath(); g.ellipse(z.x + z.w / 2, z.y + z.h / 2, z.w / 2, z.h / 2, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(170,130,60,0.3)'; g.lineWidth = 3;
        for (let i = 1; i < 4; i++) { g.beginPath(); g.ellipse(z.x + z.w / 2, z.y + z.h / 2, z.w / 2 * i / 4, z.h / 2 * i / 4, 0, 0, Math.PI * 2); g.stroke(); }
      }
      // volleyball court
      g.strokeStyle = '#ffffff'; g.lineWidth = 4; g.strokeRect(300, 500, 500, 260);
      // towels & umbrellas
      const rnd = mulberry32(7);
      for (let i = 0; i < 9; i++) {
        const x = 300 + rnd() * 1800, y = 320 + rnd() * 700;
        if (x > 1050 && x < 1300) continue;
        g.fillStyle = ['#ff6b6b', '#54a0ff', '#feca57', '#1dd1a1'][i % 4];
        g.fillRect(x, y, 50, 90);
        g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x, y + 20, 50, 8); g.fillRect(x, y + 60, 50, 8);
        if (i % 2) {
          for (let k = 0; k < 8; k++) {
            g.fillStyle = k % 2 ? '#fff' : ['#e74c3c', '#3498db', '#f39c12'][i % 3];
            g.beginPath(); g.moveTo(x + 80, y + 20); g.arc(x + 80, y + 20, 40, k * Math.PI / 4, (k + 1) * Math.PI / 4); g.fill();
          }
        }
      }
      // shoreline, shallow and deep water
      g.fillStyle = '#d9c088'; g.fillRect(0, 1130, this.w, 60);
      g.fillStyle = '#6fd0ec'; g.fillRect(0, 1180, this.w, 220);
      g.fillStyle = '#2a8fc4'; g.fillRect(0, 1400, this.w, 200);
      g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 3;
      for (let y = 1195; y < 1600; y += 45) {
        g.beginPath();
        for (let x = 0; x <= this.w; x += 20) g.lineTo(x, y + Math.sin(x / 60 + y) * 6);
        g.stroke();
      }
      // pier
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(1112, 1160, 150, 440);
      g.fillStyle = '#a87a4c'; g.fillRect(1100, 1150, 150, 450);
      g.fillStyle = 'rgba(0,0,0,0.15)';
      for (let y = 1150; y < 1600; y += 22) g.fillRect(1100, y, 150, 2);
      g.fillStyle = '#6b4a2b';
      for (let y = 1170; y < 1600; y += 90) { g.fillRect(1094, y, 10, 10); g.fillRect(1246, y, 10, 10); }
      label(g, 'SUNNY BEACH', 1200, 300, 30);
    },
  });
}

// ============================================================
// 4. HEDGE MAZE: seeded maze with a fountain plaza in the middle
// ============================================================
{
  const COLS = 12, ROWS = 8, CS = 200, T = 30;
  const rnd = mulberry32(20261023);
  const h = Array.from({ length: ROWS + 1 }, () => Array(COLS).fill(true));   // h[r][c]: wall on top of cell (r,c)
  const v = Array.from({ length: ROWS }, () => Array(COLS + 1).fill(true));   // v[r][c]: wall left of cell (r,c)
  const seen = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  const stack = [[0, 0]]; seen[0][0] = true;
  while (stack.length) {
    const [r, c] = stack[stack.length - 1];
    const nb = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < ROWS && b < COLS && !seen[a][b]);
    if (!nb.length) { stack.pop(); continue; }
    const [nr, nc] = nb[Math.floor(rnd() * nb.length)];
    if (nr !== r) h[Math.max(r, nr)][c] = false; else v[r][Math.max(c, nc)] = false;
    seen[nr][nc] = true; stack.push([nr, nc]);
  }
  // knock out extra walls so there are loops (dead ends make tag no fun)
  for (let r = 1; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (rnd() < 0.3) h[r][c] = false;
  for (let r = 0; r < ROWS; r++) for (let c = 1; c < COLS; c++) if (rnd() < 0.3) v[r][c] = false;
  // central plaza (cells r3-4, c5-6) with four entrances
  h[4][5] = h[4][6] = v[3][6] = v[4][6] = false;
  h[3][5] = h[5][6] = v[4][5] = v[3][7] = false;

  const rects = [];
  for (let r = 1; r < ROWS; r++) {
    let start = null;
    for (let c = 0; c <= COLS; c++) {
      if (c < COLS && h[r][c]) { if (start === null) start = c; }
      else if (start !== null) { rects.push({ x: start * CS - T / 2, y: r * CS - T / 2, w: (c - start) * CS + T, h: T, tall: true, style: 'hedge' }); start = null; }
    }
  }
  for (let c = 1; c < COLS; c++) {
    let start = null;
    for (let r = 0; r <= ROWS; r++) {
      if (r < ROWS && v[r][c]) { if (start === null) start = r; }
      else if (start !== null) { rects.push({ x: c * CS - T / 2, y: start * CS - T / 2, w: T, h: (r - start) * CS + T, tall: true, style: 'hedge' }); start = null; }
    }
  }
  rects.push(
    { x: 0, y: 0, w: COLS * CS, h: 22, tall: true, style: 'hedge' }, { x: 0, y: ROWS * CS - 22, w: COLS * CS, h: 22, tall: true, style: 'hedge' },
    { x: 0, y: 0, w: 22, h: ROWS * CS, tall: true, style: 'hedge' }, { x: COLS * CS - 22, y: 0, w: 22, h: ROWS * CS, tall: true, style: 'hedge' },
  );
  const statues = [];
  while (statues.length < 7) {
    const r = Math.floor(rnd() * ROWS), c = Math.floor(rnd() * COLS);
    if ((r === 3 || r === 4) && (c === 5 || c === 6)) continue;
    if (statues.some(s => s.r === r && s.c === c)) continue;
    statues.push({ r, c });
  }

  def({
    id: 'maze', name: 'Hedge Maze', icon: '🌿',
    desc: 'A garden maze full of corners to hide around. Fountain plaza in the middle.',
    w: COLS * CS, h: ROWS * CS, bg: '#4f9a45',
    zones: [],
    rects,
    circles: [
      { x: 1200, y: 800, r: 60, style: 'fountain' },
      ...statues.map(s => ({ x: s.c * CS + CS / 2, y: s.r * CS + CS / 2, r: 22, tall: true, style: 'statue' })),
    ],
    paint(g) {
      g.fillStyle = '#cbbd9c'; g.fillRect(0, 0, this.w, this.h);   // gravel paths
      specks(g, 0, 0, this.w, this.h, 5000, 'rgba(90,70,40,0.25)', 'rgba(255,255,255,0.3)');
      // grass inside each cell
      g.fillStyle = '#5ea653';
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        if ((r === 3 || r === 4) && (c === 5 || c === 6)) continue;
        roundRect(g, c * CS + 45, r * CS + 45, CS - 90, CS - 90, 20); g.fill();
      }
      // flowers
      const fr = mulberry32(99);
      for (let i = 0; i < 260; i++) {
        const r = Math.floor(fr() * ROWS), c = Math.floor(fr() * COLS);
        if ((r === 3 || r === 4) && (c === 5 || c === 6)) continue;
        g.fillStyle = ['#ff6b9d', '#ffd23f', '#ffffff', '#c56cf0'][i % 4];
        g.beginPath(); g.arc(c * CS + 55 + fr() * (CS - 110), r * CS + 55 + fr() * (CS - 110), 4, 0, Math.PI * 2); g.fill();
      }
      // plaza
      g.fillStyle = '#ddd3bd';
      g.beginPath(); g.arc(1200, 800, 170, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#bfb39a'; g.lineWidth = 4;
      for (const rr of [110, 140]) { g.beginPath(); g.arc(1200, 800, rr, 0, Math.PI * 2); g.stroke(); }
    },
  });
}

// ============================================================
// 5. FROSTY PARK: slippery ice rink and pond, deep snow, igloos
// ============================================================
{
  const RINK = { x: 300, y: 250, w: 700, h: 400 };
  const POND = { x: 1700, y: 1060, r: 250 };
  def({
    id: 'winter', name: 'Frosty Park', icon: '❄️',
    desc: 'Slide around on the ice rink and pond. Deep snow slows you down.',
    w: 2400, h: 1600, bg: '#eef3f8',
    zones: [
      { ...RINK, kind: 'ice' },
      { ...POND, kind: 'ice' },
      { x: 1980, y: 140, w: 330, h: 260, kind: 'snow' },
      { x: 90, y: 1100, w: 360, h: 260, kind: 'snow' },
      { x: 1050, y: 1180, w: 260, h: 200, kind: 'snow' },
    ],
    rects: [
      // rink boards with gaps to get in and out
      { x: 280, y: 230, w: 740, h: 20, style: 'board' },
      { x: 280, y: 650, w: 300, h: 20, style: 'board' }, { x: 720, y: 650, w: 300, h: 20, style: 'board' },
      { x: 280, y: 230, w: 20, h: 440, style: 'board' },
      { x: 1000, y: 230, w: 20, h: 170, style: 'board' }, { x: 1000, y: 500, w: 20, h: 170, style: 'board' },
      { x: 1450, y: 160, w: 300, h: 200, tall: true, style: 'cabin' },
      { x: 1080, y: 760, w: 40, h: 260, tall: true, style: 'snowwall' },
      { x: 1380, y: 640, w: 240, h: 40, tall: true, style: 'snowwall' },
      { x: 560, y: 960, w: 40, h: 200, tall: true, style: 'snowwall' },
      { x: 1200, y: 420, w: 120, h: 22, style: 'bench' },
    ],
    circles: [
      { x: 2150, y: 600, r: 70, tall: true, style: 'igloo' },
      { x: 700, y: 1300, r: 70, tall: true, style: 'igloo' },
      ...[[150, 850], [400, 900], [1150, 300], [1300, 750], [2250, 860], [2000, 1470], [1100, 1460], [900, 1060],
        [1400, 450], [2300, 1200], [150, 1480], [1360, 1500], [880, 140], [1900, 380]]
        .map(([x, y]) => ({ x, y, r: 34, tall: true, style: 'pine' })),
      ...[[1250, 1000], [820, 800], [1900, 720], [2250, 1440]].map(([x, y]) => ({ x, y, r: 22, style: 'snowman' })),
    ],
    paint(g) {
      g.fillStyle = this.bg; g.fillRect(0, 0, this.w, this.h);
      specks(g, 0, 0, this.w, this.h, 3000, 'rgba(120,150,190,0.15)', 'rgba(255,255,255,0.9)');
      // shoveled paths
      g.fillStyle = '#cdd7e1';
      g.fillRect(0, 760, this.w, 70);
      g.fillRect(1180, 0, 70, this.h);
      // deep snow drifts
      for (const z of this.zones.filter(z => z.kind === 'snow')) {
        g.fillStyle = 'rgba(160,185,215,0.35)';
        g.beginPath(); g.ellipse(z.x + z.w / 2 + 8, z.y + z.h / 2 + 10, z.w / 2, z.h / 2, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#ffffff';
        g.beginPath(); g.ellipse(z.x + z.w / 2, z.y + z.h / 2, z.w / 2, z.h / 2, 0, 0, Math.PI * 2); g.fill();
      }
      // ice rink
      g.fillStyle = '#c8ecfa'; g.fillRect(RINK.x, RINK.y, RINK.w, RINK.h);
      iceScratches(g, RINK.x, RINK.y, RINK.w, RINK.h);
      g.fillStyle = '#e74c3c'; g.fillRect(RINK.x + RINK.w / 2 - 3, RINK.y, 6, RINK.h);
      g.fillStyle = '#3498db'; g.fillRect(RINK.x + 220, RINK.y, 6, RINK.h); g.fillRect(RINK.x + RINK.w - 226, RINK.y, 6, RINK.h);
      g.strokeStyle = '#e74c3c'; g.lineWidth = 4;
      g.beginPath(); g.arc(RINK.x + RINK.w / 2, RINK.y + RINK.h / 2, 60, 0, Math.PI * 2); g.stroke();
      label(g, 'ICE RINK', RINK.x + RINK.w / 2, RINK.y + RINK.h + 60, 26, 'rgba(60,90,130,0.45)');
      // frozen pond
      g.fillStyle = '#b4e2f5';
      g.beginPath(); g.arc(POND.x, POND.y, POND.r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#e8f8ff'; g.lineWidth = 10; g.stroke();
      g.save(); g.beginPath(); g.arc(POND.x, POND.y, POND.r, 0, Math.PI * 2); g.clip();
      iceScratches(g, POND.x - POND.r, POND.y - POND.r, POND.r * 2, POND.r * 2);
      g.restore();
      label(g, 'FROZEN POND', POND.x, POND.y + 8, 26, 'rgba(60,90,130,0.35)');
    },
  });
}

export const MAP_IDS = Object.keys(MAPS);
setMap('schoolyard');

// ---------- collision & line of sight (use the current map) ----------
export function resolveCollisions(p, r) {
  for (let iter = 0; iter < 3; iter++) {
    for (const b of RECTS) {
      const cx = Math.max(b.x, Math.min(p.x, b.x + b.w));
      const cy = Math.max(b.y, Math.min(p.y, b.y + b.h));
      const dx = p.x - cx, dy = p.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        if (d2 === 0) {
          const left = p.x - b.x, right = b.x + b.w - p.x, top = p.y - b.y, bottom = b.y + b.h - p.y;
          const m = Math.min(left, right, top, bottom);
          if (m === left) p.x = b.x - r; else if (m === right) p.x = b.x + b.w + r;
          else if (m === top) p.y = b.y - r; else p.y = b.y + b.h + r;
        } else {
          const d = Math.sqrt(d2);
          p.x = cx + (dx / d) * r;
          p.y = cy + (dy / d) * r;
        }
      }
    }
    for (const c of CIRCLES) {
      const dx = p.x - c.x, dy = p.y - c.y;
      const min = r + c.r;
      const d2 = dx * dx + dy * dy;
      if (d2 < min * min) {
        const d = Math.sqrt(d2) || 0.001;
        p.x = c.x + (dx / d) * min;
        p.y = c.y + (dy / d) * min;
      }
    }
  }
  p.x = Math.max(r + 10, Math.min(WORLD.w - r - 10, p.x));
  p.y = Math.max(r + 10, Math.min(WORLD.h - r - 10, p.y));
}

export function pointBlocked(x, y, r) {
  if (x < r + 10 || y < r + 10 || x > WORLD.w - r - 10 || y > WORLD.h - r - 10) return true;
  for (const b of RECTS) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) return true;
  }
  for (const c of CIRCLES) {
    if ((x - c.x) ** 2 + (y - c.y) ** 2 < (r + c.r) ** 2) return true;
  }
  return false;
}

export function randomFreePoint(r = 24) {
  for (let i = 0; i < 300; i++) {
    const x = 60 + Math.random() * (WORLD.w - 120);
    const y = 60 + Math.random() * (WORLD.h - 120);
    if (!pointBlocked(x, y, r + 8)) return { x, y };
  }
  return { x: WORLD.w / 2, y: WORLD.h / 2 };
}

function segRect(x1, y1, x2, y2, b) {
  let t0 = 0, t1 = 1;
  const dx = x2 - x1, dy = y2 - y1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - b.x, b.x + b.w - x1, y1 - b.y, b.y + b.h - y1];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return false; }
    else {
      const t = q[i] / p[i];
      if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
      else { if (t < t0) return false; if (t < t1) t1 = t; }
    }
  }
  return true;
}

function segCircle(x1, y1, x2, y2, c) {
  const dx = x2 - x1, dy = y2 - y1;
  const l2 = dx * dx + dy * dy || 1;
  let t = ((c.x - x1) * dx + (c.y - y1) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  const px = x1 + t * dx - c.x, py = y1 + t * dy - c.y;
  return px * px + py * py < (c.r * 0.8) ** 2;
}

export function hasLineOfSight(x1, y1, x2, y2) {
  for (const b of RECTS) if (b.tall && segRect(x1, y1, x2, y2, b)) return false;
  for (const c of CIRCLES) if (c.tall && segCircle(x1, y1, x2, y2, c)) return false;
  return true;
}

// ---------- rendering ----------
const cache = {};
export function renderMap(id) {
  if (cache[id]) return cache[id];
  const m = MAPS[id];
  const cv = document.createElement('canvas');
  cv.width = m.w; cv.height = m.h;
  const g = cv.getContext('2d');
  m.paint(g);
  const canopy = new Set(['tree', 'pine', 'palm']);
  for (const c of m.circles) if (!canopy.has(c.style)) drawCircleObstacle(g, c);
  for (const r of m.rects) drawRectObstacle(g, r);
  for (const c of m.circles) if (canopy.has(c.style)) drawCircleObstacle(g, c);
  // fence
  g.strokeStyle = '#7d7d7d'; g.lineWidth = 6;
  g.strokeRect(5, 5, m.w - 10, m.h - 10);
  g.fillStyle = '#5c5c5c';
  for (let x = 5; x <= m.w; x += 80) { g.fillRect(x - 4, 1, 8, 8); g.fillRect(x - 4, m.h - 9, 8, 8); }
  for (let y = 5; y <= m.h; y += 80) { g.fillRect(1, y - 4, 8, 8); g.fillRect(m.w - 9, y - 4, 8, 8); }
  cache[id] = cv;
  return cv;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
function shadowRect(g, r, off = 6) {
  g.fillStyle = 'rgba(0,0,0,0.22)';
  g.fillRect(r.x + off, r.y + off + 1, r.w, r.h);
}
function specks(g, x, y, w, h, n, c1, c2) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = Math.random() < 0.5 ? c1 : c2;
    g.fillRect(x + Math.random() * w, y + Math.random() * h, 3, 3);
  }
}
function label(g, text, x, y, size = 28, color = 'rgba(255,255,255,0.4)') {
  g.fillStyle = color;
  g.font = `bold ${size}px system-ui, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.fillText(text, x, y);
}
function grass(g, m, color) {
  g.fillStyle = color; g.fillRect(0, 0, m.w, m.h);
  for (let x = 0; x < m.w; x += 160) { g.fillStyle = 'rgba(255,255,255,0.045)'; g.fillRect(x, 0, 80, m.h); }
  specks(g, 0, 0, m.w, m.h, 2500, 'rgba(30,80,20,0.18)', 'rgba(200,255,150,0.12)');
}
function iceScratches(g, x, y, w, h) {
  g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1.5;
  for (let i = 0; i < 70; i++) {
    const sx = x + Math.random() * w, sy = y + Math.random() * h, a = Math.random() * Math.PI, l = 20 + Math.random() * 60;
    g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(sx + Math.cos(a) * l / 2 + 8, sy + Math.sin(a) * l / 2, sx + Math.cos(a) * l, sy + Math.sin(a) * l); g.stroke();
  }
}

function drawCourt(g, c) {
  g.fillStyle = '#4a4a4f';
  roundRect(g, c.x - 40, c.y - 30, c.w + 80, c.h + 60, 10); g.fill();
  g.fillStyle = c.color;
  g.fillRect(c.x, c.y, c.w, c.h);
  const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
  g.fillStyle = c.key;
  g.fillRect(c.x, cy - 50, 110, 100);
  g.fillRect(c.x + c.w - 110, cy - 50, 110, 100);
  g.strokeStyle = '#ffffff'; g.lineWidth = 4;
  g.strokeRect(c.x, c.y, c.w, c.h);
  g.beginPath(); g.moveTo(cx, c.y); g.lineTo(cx, c.y + c.h); g.stroke();
  g.beginPath(); g.arc(cx, cy, 48, 0, Math.PI * 2); g.stroke();
  g.strokeRect(c.x, cy - 50, 110, 100);
  g.strokeRect(c.x + c.w - 110, cy - 50, 110, 100);
  g.beginPath(); g.arc(c.x + 110, cy, 50, -Math.PI / 2, Math.PI / 2); g.stroke();
  g.beginPath(); g.arc(c.x + c.w - 110, cy, 50, Math.PI / 2, Math.PI * 1.5); g.stroke();
  g.beginPath(); g.moveTo(c.x, c.y + 20); g.lineTo(c.x + 50, c.y + 20);
  g.arc(c.x + 30, cy, 130, -Math.PI / 2 + 0.16, Math.PI / 2 - 0.16); g.lineTo(c.x, c.y + c.h - 20); g.stroke();
  g.beginPath(); g.moveTo(c.x + c.w, c.y + 20); g.lineTo(c.x + c.w - 50, c.y + 20);
  g.arc(c.x + c.w - 30, cy, 130, -Math.PI / 2 - 0.16, Math.PI / 2 + 0.16, true); g.lineTo(c.x + c.w, c.y + c.h - 20); g.stroke();
  for (const side of [0, 1]) {
    const bx = side ? c.x + c.w - 14 : c.x + 8;
    g.fillStyle = '#ffffff'; g.fillRect(bx, cy - 30, 6, 60);
    g.strokeStyle = '#ff6a00'; g.lineWidth = 4;
    g.beginPath(); g.arc(side ? bx - 12 : bx + 18, cy, 11, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#333';
    g.beginPath(); g.arc(side ? c.x + c.w + 16 : c.x - 16, cy, 10, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#666'; g.fillRect(side ? c.x + c.w : c.x - 16, cy - 3, 16, 6);
  }
  label(g, c.label, cx, c.y + c.h + 24, 26, 'rgba(255,255,255,0.35)');
}

function drawRectObstacle(g, o) {
  const { x, y, w, h } = o;
  switch (o.style) {
    case 'brick': {
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x + 14, y + 16, w, h);
      g.fillStyle = '#8e3b2a'; g.fillRect(x, y, w, h);
      const bh = 24, bw = 25;
      for (let yy = y, row = 0; yy < y + h; yy += bh, row++) {
        for (let xx = x - (row % 2 ? bw / 2 : 0); xx < x + w; xx += bw) {
          const x0 = Math.max(xx, x), x1 = Math.min(xx + bw, x + w);
          g.fillStyle = (row * 7 + Math.floor(xx)) % 3 === 0 ? '#b24f39' : '#a8473a';
          g.fillRect(x0 + 1.5, yy + 1.5, x1 - x0 - 3, Math.min(bh, y + h - yy) - 3);
        }
      }
      g.fillStyle = '#6e2a1d'; g.fillRect(x, y, w, 6);
      if (o.text) {
        g.save();
        g.translate(x + w / 2, y + h / 2);
        if (h > w) g.rotate(-Math.PI / 2);
        g.font = 'bold italic 34px system-ui, sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.lineWidth = 5; g.strokeStyle = '#111'; g.strokeText(o.text, 0, 0);
        g.fillStyle = '#ffd23f'; g.fillText(o.text, 0, 0);
        g.restore();
      }
      break;
    }
    case 'building': {
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x + 14, y + 16, w, h);
      g.fillStyle = shade(o.c, -30); g.fillRect(x, y, w, h);
      g.fillStyle = o.c; g.fillRect(x + 8, y + 8, w - 16, h - 16);
      const rnd = mulberry32(Math.floor(x * 7 + y * 13));
      for (let i = 0; i < 3; i++) {
        const ax = x + 20 + rnd() * (w - 70), ay = y + 20 + rnd() * (h - 70);
        g.fillStyle = '#b0b6bd'; g.fillRect(ax, ay, 36, 28);
        g.fillStyle = '#7d848c'; g.beginPath(); g.arc(ax + 18, ay + 14, 9, 0, Math.PI * 2); g.fill();
      }
      if (w > 200) {
        g.fillStyle = '#8a5a3a';
        g.beginPath(); g.arc(x + w - 45, y + h - 45, 22, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#5e3c25'; g.lineWidth = 3; g.stroke();
      }
      break;
    }
    case 'hedge': {
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x + 8, y + 10, w, h);
      g.fillStyle = '#2a6627'; g.fillRect(x, y, w, h);
      g.fillStyle = '#347a30';
      const rnd = mulberry32(Math.floor(x * 3 + y * 5));
      for (let i = 0; i < (w * h) / 220; i++) {
        g.beginPath(); g.arc(x + rnd() * w, y + rnd() * h, 5 + rnd() * 5, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = 'rgba(180,255,140,0.18)'; g.fillRect(x, y, w, 5);
      break;
    }
    case 'car':
    case 'truck': {
      shadowRect(g, o, 5);
      g.fillStyle = o.c; roundRect(g, x, y, w, h, 10); g.fill();
      g.fillStyle = 'rgba(30,40,60,0.75)';
      if (h > w) { g.fillRect(x + 6, y + 18, w - 12, 16); g.fillRect(x + 6, y + h - 28, w - 12, 12); }
      else if (o.style === 'truck') { g.fillRect(x + w - 34, y + 8, 22, h - 16); }
      else { g.fillRect(x + 18, y + 6, 16, h - 12); g.fillRect(x + w - 28, y + 6, 12, h - 12); }
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x + 4, y + 4, w - 8, 4);
      if (o.text) label(g, o.text, x + (w - 34) / 2, y + h / 2 + 8, 22, '#fff');
      break;
    }
    case 'bench':
      shadowRect(g, o);
      g.fillStyle = '#7a4e26'; g.fillRect(x, y, w, h);
      g.fillStyle = '#9b6533';
      if (w > h) { g.fillRect(x + 3, y + 3, w - 6, 6); g.fillRect(x + 3, y + 13, w - 6, 6); }
      else { g.fillRect(x + 3, y + 3, 6, h - 6); g.fillRect(x + 13, y + 3, 6, h - 6); }
      break;
    case 'table':
      shadowRect(g, o);
      g.fillStyle = '#8b5a2b'; g.fillRect(x, y, w, h);
      g.fillStyle = '#a06a35';
      for (let xx = x + 4; xx < x + w; xx += 20) g.fillRect(xx, y + 3, 14, h - 6);
      break;
    case 'hut': {
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x + 10, y + 12, w, h);
      for (let i = 0; i < 8; i++) {
        g.fillStyle = i % 2 ? '#ffffff' : o.c;
        g.fillRect(x + (w / 8) * i, y, w / 8 + 1, h);
      }
      g.strokeStyle = shade(o.c, -40); g.lineWidth = 4; g.strokeRect(x, y, w, h);
      if (o.text) {
        g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x + 10, y + h / 2 - 18, w - 20, 34);
        label(g, o.text, x + w / 2, y + h / 2 + 8, 22, '#fff');
      }
      break;
    }
    case 'tower':
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + 12, y + 14, w, h);
      g.fillStyle = '#e74c3c'; g.fillRect(x, y, w, h);
      g.fillStyle = '#ffffff'; g.fillRect(x + 10, y + 10, w - 20, h - 20);
      g.fillStyle = '#e74c3c'; g.font = 'bold 40px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('+', x + w / 2, y + h / 2 + 2);
      break;
    case 'net':
      g.fillStyle = '#555'; g.beginPath(); g.arc(x + w / 2, y, 7, 0, Math.PI * 2); g.arc(x + w / 2, y + h, 7, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 2;
      for (let yy = y; yy < y + h; yy += 10) { g.beginPath(); g.moveTo(x, yy); g.lineTo(x + w, yy + 10); g.stroke(); }
      g.strokeRect(x, y, w, h);
      break;
    case 'board':
      g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(x + 4, y + 5, w, h);
      g.fillStyle = '#ffffff'; g.fillRect(x, y, w, h);
      g.fillStyle = '#e74c3c';
      if (w > h) g.fillRect(x, y, w, 4); else g.fillRect(x, y, 4, h);
      break;
    case 'snowwall': {
      g.fillStyle = 'rgba(80,110,150,0.25)'; g.fillRect(x + 8, y + 10, w, h);
      g.fillStyle = '#ffffff'; g.fillRect(x, y, w, h);
      g.strokeStyle = '#c3d3e4'; g.lineWidth = 2;
      const horiz = w > h, n = Math.floor((horiz ? w : h) / 40);
      for (let i = 1; i < n; i++) {
        g.beginPath();
        if (horiz) { g.moveTo(x + i * 40, y); g.lineTo(x + i * 40, y + h); } else { g.moveTo(x, y + i * 40); g.lineTo(x + w, y + i * 40); }
        g.stroke();
      }
      g.strokeStyle = '#a9bfd6'; g.strokeRect(x, y, w, h);
      break;
    }
    case 'cabin':
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + 14, y + 16, w, h);
      g.fillStyle = '#7a4a2a'; g.fillRect(x, y, w, h);
      g.fillStyle = '#ffffff'; g.fillRect(x + 6, y + 6, w - 12, h / 2 - 6); g.fillRect(x + 6, y + h / 2 + 2, w - 12, h / 2 - 8);
      g.fillStyle = '#5b3520'; g.fillRect(x, y + h / 2 - 3, w, 6);
      g.fillStyle = '#8a8a8a'; g.fillRect(x + w - 70, y + 20, 34, 34);
      g.fillStyle = '#555'; g.fillRect(x + w - 64, y + 26, 22, 22);
      break;
    default: break; // 'none'
  }
}

function drawCircleObstacle(g, c) {
  const { x, y, r } = c;
  switch (c.style) {
    case 'tree':
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.arc(x + 10, y + 12, r + 4, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#2f7a2a'; g.beginPath(); g.arc(x, y, r + 4, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#3d9636'; g.beginPath(); g.arc(x - 10, y - 10, r * 0.72, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#56b34c'; g.beginPath(); g.arc(x - 16, y - 16, r * 0.3, 0, Math.PI * 2); g.fill();
      break;
    case 'pine':
      g.fillStyle = 'rgba(60,90,130,0.25)'; g.beginPath(); g.arc(x + 10, y + 12, r + 4, 0, Math.PI * 2); g.fill();
      for (const [rr, col] of [[r + 6, '#1f5a3a'], [r * 0.78, '#2a7048'], [r * 0.5, '#358656']]) {
        g.fillStyle = col; g.beginPath();
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2, rad = i % 2 ? rr : rr * 0.72;
          g.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
        }
        g.fill();
      }
      g.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 5; i++) { const a = i * 1.3; g.beginPath(); g.arc(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, 5, 0, Math.PI * 2); g.fill(); }
      break;
    case 'palm':
      g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.arc(x + 10, y + 12, r + 6, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#2e8b3a'; g.lineCap = 'round';
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + 0.3;
        g.lineWidth = 13;
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + 0.3) * r, y + Math.sin(a + 0.3) * r, x + Math.cos(a) * (r + 18), y + Math.sin(a) * (r + 18)); g.stroke();
      }
      g.lineCap = 'butt';
      g.fillStyle = '#7a5230'; g.beginPath(); g.arc(x, y, 9, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#5a3a1e';
      for (const [dx, dy] of [[-6, 4], [5, 5], [0, -6]]) { g.beginPath(); g.arc(x + dx, y + dy, 4, 0, Math.PI * 2); g.fill(); }
      break;
    case 'rock':
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.arc(x + 8, y + 10, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#7f8a8f'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#9aa5aa'; g.beginPath(); g.arc(x - r * 0.25, y - r * 0.25, r * 0.6, 0, Math.PI * 2); g.fill();
      break;
    case 'fountain':
      g.fillStyle = '#9a9a9a'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#4fb3e8'; g.beginPath(); g.arc(x, y, r - 9, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.arc(x, y, 12, 0, Math.PI * 2); g.fill();
      break;
    case 'statue':
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.arc(x + 6, y + 8, r + 6, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#b8b8b8'; g.fillRect(x - r - 6, y - r - 6, (r + 6) * 2, (r + 6) * 2);
      g.fillStyle = '#d8d8d8'; g.beginPath(); g.arc(x, y, r - 4, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#c4c4c4'; g.beginPath(); g.arc(x - 4, y - 4, r * 0.4, 0, Math.PI * 2); g.fill();
      break;
    case 'snowman':
      g.fillStyle = 'rgba(80,110,150,0.25)'; g.beginPath(); g.arc(x + 5, y + 6, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#c9d6e3'; g.lineWidth = 2; g.stroke();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x, y - 4, r * 0.6, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = '#ff8c1a'; g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x + 14, y - 2); g.lineTo(x, y); g.fill();
      g.fillStyle = '#222'; g.beginPath(); g.arc(x - 4, y - 10, 2, 0, Math.PI * 2); g.arc(x + 4, y - 10, 2, 0, Math.PI * 2); g.fill();
      break;
    case 'igloo':
      g.fillStyle = 'rgba(80,110,150,0.3)'; g.beginPath(); g.arc(x + 10, y + 12, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#f4f9ff'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#bcd0e4'; g.lineWidth = 2;
      for (let rr = r - 18; rr > 10; rr -= 18) { g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.stroke(); }
      for (let a = 0; a < 10; a++) { g.beginPath(); g.moveTo(x + Math.cos(a * 0.63) * 18, y + Math.sin(a * 0.63) * 18); g.lineTo(x + Math.cos(a * 0.63) * r, y + Math.sin(a * 0.63) * r); g.stroke(); }
      g.fillStyle = '#5a6f86'; g.fillRect(x - 14, y + r - 16, 28, 20);
      break;
    case 'sandcastle':
      g.fillStyle = 'rgba(0,0,0,0.15)'; g.beginPath(); g.arc(x + 5, y + 6, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#d9b46c'; g.fillRect(x - r, y - r, r * 2, r * 2);
      g.fillStyle = '#c49a52';
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.fillRect(x + dx * r - 9, y + dy * r - 9, 18, 18);
      g.fillStyle = '#e74c3c'; g.fillRect(x - 1, y - r - 14, 3, 18); g.fillRect(x + 2, y - r - 14, 12, 8);
      break;
    case 'hydrant':
      g.fillStyle = '#c0392b'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#e74c3c'; g.beginPath(); g.arc(x - 2, y - 2, r * 0.55, 0, Math.PI * 2); g.fill();
      break;
    case 'post':
      g.fillStyle = '#333'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      break;
    default: break;
  }
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const c = v => Math.max(0, Math.min(255, v + amt));
  return '#' + ((c(n >> 16) << 16) | (c((n >> 8) & 255) << 8) | c(n & 255)).toString(16).padStart(6, '0');
}

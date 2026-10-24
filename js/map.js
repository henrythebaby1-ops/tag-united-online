// World layout: two basketball courts, a playground, a big wall, trees and benches.
// Obstacles are solid; `tall` ones also block line of sight (you can hide behind them).

export const WORLD = { w: 2400, h: 1600 };

export const COURTS = [
  { x: 140, y: 140, w: 560, h: 300, color: '#d9733f', key: '#b85a2c', label: 'COURT 1' },
  { x: 140, y: 1160, w: 560, h: 300, color: '#3f6fd9', key: '#2c55b8', label: 'COURT 2' },
];

export const PLAYGROUND = { x: 1450, y: 130, w: 820, h: 640 };
export const SANDBOX = { x: 2050, y: 440, w: 180, h: 180 };
export const WALL = { x: 1090, y: 430, w: 50, h: 740 };

export const SWING_POSTS = [{ x: 1850, y: 240 }, { x: 2025, y: 240 }, { x: 2200, y: 240 }];
export const DOME = { x: 1640, y: 580, r: 72 };
export const MERRY = { x: 1905, y: 590, r: 58 };
export const SLIDE_TOWER = { x: 1520, y: 200, w: 90, h: 90 };
export const SLIDE_CHUTE = { x: 1610, y: 225, w: 150, h: 40 };
export const SEESAW = { x: 1730, y: 395, w: 170, h: 18 };
export const FOUNTAIN = { x: 820, y: 800, r: 55 };

export const TREES = [
  { x: 1500, y: 1060 }, { x: 1720, y: 1260 }, { x: 1960, y: 1080 }, { x: 2210, y: 1310 },
  { x: 1560, y: 1420 }, { x: 2060, y: 1450 }, { x: 1280, y: 260 }, { x: 930, y: 1460 },
  { x: 2300, y: 900 }, { x: 1300, y: 1350 }, { x: 860, y: 120 }, { x: 60, y: 800 },
];

export const TABLES = [
  { x: 1790, y: 1140, w: 120, h: 60 },
  { x: 2040, y: 1240, w: 120, h: 60 },
];
export const BENCHES = [
  { x: 360, y: 488, w: 120, h: 22 },
  { x: 360, y: 1090, w: 120, h: 22 },
  { x: 1280, y: 820, w: 22, h: 110 },
];

// Collision primitives
export const RECTS = [
  { ...WALL, tall: true },
  { ...SLIDE_TOWER, tall: true },
  { ...SLIDE_CHUTE, tall: false },
  { ...SEESAW, tall: false },
  ...TABLES.map(t => ({ ...t, tall: false })),
  ...BENCHES.map(b => ({ ...b, tall: false })),
];

export const CIRCLES = [
  ...TREES.map(t => ({ x: t.x, y: t.y, r: 36, tall: true })),
  { ...DOME, tall: false },
  { ...MERRY, tall: false },
  { ...FOUNTAIN, tall: false },
  ...SWING_POSTS.map(p => ({ x: p.x, y: p.y, r: 11, tall: false })),
  // hoop posts behind each baseline
  ...COURTS.flatMap(c => [
    { x: c.x - 16, y: c.y + c.h / 2, r: 10, tall: false },
    { x: c.x + c.w + 16, y: c.y + c.h / 2, r: 10, tall: false },
  ]),
];

export const SLOW_ZONES = [SANDBOX];

export function inSlowZone(x, y) {
  return SLOW_ZONES.some(z => x > z.x && x < z.x + z.w && y > z.y && y < z.y + z.h);
}

// Push a circle out of all obstacles; mutates p {x,y}
export function resolveCollisions(p, r) {
  for (let iter = 0; iter < 3; iter++) {
    for (const b of RECTS) {
      const cx = Math.max(b.x, Math.min(p.x, b.x + b.w));
      const cy = Math.max(b.y, Math.min(p.y, b.y + b.h));
      let dx = p.x - cx, dy = p.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        if (d2 === 0) {
          // centre inside rect: push out along the shortest axis
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
  for (let i = 0; i < 200; i++) {
    const x = 60 + Math.random() * (WORLD.w - 120);
    const y = 60 + Math.random() * (WORLD.h - 120);
    if (!pointBlocked(x, y, r + 8)) return { x, y };
  }
  return { x: WORLD.w / 2, y: WORLD.h / 2 + 300 };
}

function segRect(x1, y1, x2, y2, b) {
  // Liang–Barsky clip
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

// Pre-render the static map to an offscreen canvas
export function renderMap() {
  const cv = document.createElement('canvas');
  cv.width = WORLD.w; cv.height = WORLD.h;
  const g = cv.getContext('2d');

  // grass with mowing stripes
  g.fillStyle = '#5aa84a';
  g.fillRect(0, 0, WORLD.w, WORLD.h);
  for (let x = 0; x < WORLD.w; x += 160) {
    g.fillStyle = 'rgba(255,255,255,0.045)';
    g.fillRect(x, 0, 80, WORLD.h);
  }
  // grass specks
  for (let i = 0; i < 2500; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(30,80,20,0.18)' : 'rgba(200,255,150,0.12)';
    g.fillRect(Math.random() * WORLD.w, Math.random() * WORLD.h, 3, 3);
  }

  // paths
  g.fillStyle = '#cfc6b3';
  roundRect(g, 0, 770, WORLD.w, 70, 0); g.fill();
  roundRect(g, 1150, 0, 70, WORLD.h, 0); g.fill();
  g.fillStyle = 'rgba(0,0,0,0.06)';
  for (let x = 0; x < WORLD.w; x += 70) g.fillRect(x, 770, 2, 70);
  for (let y = 0; y < WORLD.h; y += 70) g.fillRect(1150, y, 70, 2);

  // fountain plaza
  g.fillStyle = '#d8d0bd';
  g.beginPath(); g.arc(FOUNTAIN.x, FOUNTAIN.y, 110, 0, Math.PI * 2); g.fill();

  for (const c of COURTS) drawCourt(g, c);
  drawPlayground(g);

  // fountain
  g.fillStyle = '#9a9a9a';
  g.beginPath(); g.arc(FOUNTAIN.x, FOUNTAIN.y, FOUNTAIN.r, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#4fb3e8';
  g.beginPath(); g.arc(FOUNTAIN.x, FOUNTAIN.y, FOUNTAIN.r - 9, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.6)';
  g.beginPath(); g.arc(FOUNTAIN.x, FOUNTAIN.y, 12, 0, Math.PI * 2); g.fill();

  // tables and benches
  for (const t of TABLES) {
    shadowRect(g, t);
    g.fillStyle = '#8b5a2b'; g.fillRect(t.x, t.y, t.w, t.h);
    g.fillStyle = '#a06a35';
    for (let x = t.x + 4; x < t.x + t.w; x += 20) g.fillRect(x, t.y + 3, 14, t.h - 6);
  }
  for (const b of BENCHES) {
    shadowRect(g, b);
    g.fillStyle = '#7a4e26'; g.fillRect(b.x, b.y, b.w, b.h);
    g.fillStyle = '#9b6533';
    if (b.w > b.h) { g.fillRect(b.x + 3, b.y + 3, b.w - 6, 6); g.fillRect(b.x + 3, b.y + 13, b.w - 6, 6); }
    else { g.fillRect(b.x + 3, b.y + 3, 6, b.h - 6); g.fillRect(b.x + 13, b.y + 3, 6, b.h - 6); }
  }

  drawWall(g);

  // trees last so canopies overlap
  for (const t of TREES) {
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.beginPath(); g.arc(t.x + 10, t.y + 12, 40, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2f7a2a';
    g.beginPath(); g.arc(t.x, t.y, 40, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#3d9636';
    g.beginPath(); g.arc(t.x - 10, t.y - 10, 26, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#56b34c';
    g.beginPath(); g.arc(t.x - 16, t.y - 16, 11, 0, Math.PI * 2); g.fill();
  }

  // fence
  g.strokeStyle = '#7d7d7d'; g.lineWidth = 6;
  g.strokeRect(5, 5, WORLD.w - 10, WORLD.h - 10);
  g.fillStyle = '#5c5c5c';
  for (let x = 5; x <= WORLD.w; x += 80) { g.fillRect(x - 4, 1, 8, 8); g.fillRect(x - 4, WORLD.h - 9, 8, 8); }
  for (let y = 5; y <= WORLD.h; y += 80) { g.fillRect(1, y - 4, 8, 8); g.fillRect(WORLD.w - 9, y - 4, 8, 8); }

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

function shadowRect(g, r) {
  g.fillStyle = 'rgba(0,0,0,0.22)';
  g.fillRect(r.x + 6, r.y + 7, r.w, r.h);
}

function drawCourt(g, c) {
  // apron
  g.fillStyle = '#4a4a4f';
  roundRect(g, c.x - 40, c.y - 30, c.w + 80, c.h + 60, 10); g.fill();
  // surface
  g.fillStyle = c.color;
  g.fillRect(c.x, c.y, c.w, c.h);
  const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
  // keys
  g.fillStyle = c.key;
  g.fillRect(c.x, cy - 50, 110, 100);
  g.fillRect(c.x + c.w - 110, cy - 50, 110, 100);
  // lines
  g.strokeStyle = '#ffffff'; g.lineWidth = 4;
  g.strokeRect(c.x, c.y, c.w, c.h);
  g.beginPath(); g.moveTo(cx, c.y); g.lineTo(cx, c.y + c.h); g.stroke();
  g.beginPath(); g.arc(cx, cy, 48, 0, Math.PI * 2); g.stroke();
  g.strokeRect(c.x, cy - 50, 110, 100);
  g.strokeRect(c.x + c.w - 110, cy - 50, 110, 100);
  g.beginPath(); g.arc(c.x + 110, cy, 50, -Math.PI / 2, Math.PI / 2); g.stroke();
  g.beginPath(); g.arc(c.x + c.w - 110, cy, 50, Math.PI / 2, Math.PI * 1.5); g.stroke();
  // three-point arcs
  g.beginPath(); g.moveTo(c.x, c.y + 20); g.lineTo(c.x + 50, c.y + 20);
  g.arc(c.x + 30, cy, 130, -Math.PI / 2 + 0.16, Math.PI / 2 - 0.16); g.lineTo(c.x, c.y + c.h - 20); g.stroke();
  g.beginPath(); g.moveTo(c.x + c.w, c.y + 20); g.lineTo(c.x + c.w - 50, c.y + 20);
  g.arc(c.x + c.w - 30, cy, 130, -Math.PI / 2 - 0.16, Math.PI / 2 + 0.16, true); g.lineTo(c.x + c.w, c.y + c.h - 20); g.stroke();
  // hoops
  for (const side of [0, 1]) {
    const bx = side ? c.x + c.w - 14 : c.x + 8;
    g.fillStyle = '#ffffff'; g.fillRect(bx, cy - 30, 6, 60);
    g.strokeStyle = '#ff6a00'; g.lineWidth = 4;
    g.beginPath(); g.arc(side ? bx - 12 : bx + 18, cy, 11, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#333';
    g.beginPath(); g.arc(side ? c.x + c.w + 16 : c.x - 16, cy, 10, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#666'; g.fillRect(side ? c.x + c.w : c.x - 16, cy - 3, 16, 6);
  }
  // label
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.font = 'bold 26px system-ui, sans-serif';
  g.textAlign = 'center';
  g.fillText(c.label, cx, c.y + c.h + 24);
}

function drawPlayground(g) {
  const p = PLAYGROUND;
  // rubber safety surface
  g.fillStyle = '#b8553d';
  roundRect(g, p.x, p.y, p.w, p.h, 30); g.fill();
  g.strokeStyle = '#8f3e2b'; g.lineWidth = 8; g.stroke();
  for (let i = 0; i < 1800; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.07)';
    g.fillRect(p.x + 10 + Math.random() * (p.w - 20), p.y + 10 + Math.random() * (p.h - 20), 3, 3);
  }
  g.fillStyle = 'rgba(255,255,255,0.4)';
  g.font = 'bold 28px system-ui, sans-serif'; g.textAlign = 'center';
  g.fillText('PLAYGROUND', p.x + p.w / 2, p.y + p.h - 20);

  // sandbox
  const s = SANDBOX;
  g.fillStyle = '#8b5a2b'; g.fillRect(s.x - 10, s.y - 10, s.w + 20, s.h + 20);
  g.fillStyle = '#ead9a2'; g.fillRect(s.x, s.y, s.w, s.h);
  for (let i = 0; i < 300; i++) {
    g.fillStyle = 'rgba(160,120,60,0.25)';
    g.fillRect(s.x + Math.random() * s.w, s.y + Math.random() * s.h, 2, 2);
  }
  g.fillStyle = '#e84a5f';
  g.beginPath(); g.moveTo(s.x + 40, s.y + 60); g.lineTo(s.x + 70, s.y + 60); g.lineTo(s.x + 55, s.y + 90); g.fill();

  // slide
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

  // swings
  g.strokeStyle = '#444'; g.lineWidth = 8;
  g.beginPath(); g.moveTo(SWING_POSTS[0].x, SWING_POSTS[0].y); g.lineTo(SWING_POSTS[2].x, SWING_POSTS[2].y); g.stroke();
  for (const sp of SWING_POSTS) { g.fillStyle = '#333'; g.beginPath(); g.arc(sp.x, sp.y, 11, 0, Math.PI * 2); g.fill(); }
  g.strokeStyle = '#999'; g.lineWidth = 2;
  for (const sx of [1895, 1980, 2070, 2155]) {
    g.beginPath(); g.moveTo(sx - 12, 240); g.lineTo(sx - 12, 300); g.moveTo(sx + 12, 240); g.lineTo(sx + 12, 300); g.stroke();
    g.fillStyle = '#222'; g.fillRect(sx - 16, 298, 32, 10);
  }

  // seesaw
  g.fillStyle = '#10ac84'; g.fillRect(SEESAW.x, SEESAW.y, SEESAW.w, SEESAW.h);
  g.fillStyle = '#555'; g.fillRect(SEESAW.x + SEESAW.w / 2 - 10, SEESAW.y - 6, 20, SEESAW.h + 12);

  // climbing dome
  g.fillStyle = 'rgba(0,0,0,0.2)';
  g.beginPath(); g.arc(DOME.x + 8, DOME.y + 8, DOME.r, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#ee5253'; g.lineWidth = 6;
  for (let r = DOME.r; r > 10; r -= 18) { g.beginPath(); g.arc(DOME.x, DOME.y, r, 0, Math.PI * 2); g.stroke(); }
  for (let a = 0; a < 8; a++) {
    g.beginPath(); g.moveTo(DOME.x, DOME.y);
    g.lineTo(DOME.x + Math.cos(a * Math.PI / 4) * DOME.r, DOME.y + Math.sin(a * Math.PI / 4) * DOME.r); g.stroke();
  }

  // merry-go-round
  const cols = ['#ff6b6b', '#feca57', '#48dbfb', '#1dd1a1'];
  for (let i = 0; i < 4; i++) {
    g.fillStyle = cols[i];
    g.beginPath(); g.moveTo(MERRY.x, MERRY.y);
    g.arc(MERRY.x, MERRY.y, MERRY.r, i * Math.PI / 2, (i + 1) * Math.PI / 2); g.fill();
  }
  g.fillStyle = '#555'; g.beginPath(); g.arc(MERRY.x, MERRY.y, 12, 0, Math.PI * 2); g.fill();
}

function drawWall(g) {
  const w = WALL;
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillRect(w.x + 14, w.y + 16, w.w, w.h);
  g.fillStyle = '#8e3b2a';
  g.fillRect(w.x, w.y, w.w, w.h);
  // bricks
  const bh = 24, bw = 25;
  for (let y = w.y, row = 0; y < w.y + w.h; y += bh, row++) {
    for (let x = w.x - (row % 2 ? bw / 2 : 0); x < w.x + w.w; x += bw) {
      const x0 = Math.max(x, w.x), x1 = Math.min(x + bw, w.x + w.w);
      g.fillStyle = (row * 7 + Math.floor(x)) % 3 === 0 ? '#b24f39' : '#a8473a';
      g.fillRect(x0 + 1.5, y + 1.5, x1 - x0 - 3, Math.min(bh, w.y + w.h - y) - 3);
    }
  }
  g.fillStyle = '#6e2a1d'; g.fillRect(w.x, w.y, w.w, 6);
  // graffiti
  g.save();
  g.translate(w.x + w.w / 2, w.y + w.h / 2);
  g.rotate(-Math.PI / 2);
  g.font = 'bold italic 34px system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 5; g.strokeStyle = '#111'; g.strokeText('TAG UNITED', 0, 0);
  g.fillStyle = '#ffd23f'; g.fillText('TAG UNITED', 0, 0);
  g.restore();
}

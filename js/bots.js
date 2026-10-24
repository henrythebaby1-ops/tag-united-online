// Bot AI. Bots are simulated by the room host only; everyone else sees them through state updates.
import { SPEED, SPRINT_MULT, PLAYER_R, COLORS, GHOST_R, modeSpeed, outsideZone } from './config.js';
import { WORLD, resolveCollisions, pointBlocked, hasLineOfSight, randomFreePoint, groundAt } from './map.js';

export const VIS = 330; // vision radius in Blackout mode
const BOT_NAMES = ['Blaze', 'Dash', 'Ziggy', 'Turbo', 'Pixel', 'Rocket', 'Nova', 'Bolt', 'Sprout', 'Jinx', 'Comet', 'Mochi'];
const DIRS = Array.from({ length: 16 }, (_, i) => {
  const a = (i / 16) * Math.PI * 2;
  return { x: Math.cos(a), y: Math.sin(a) };
});
const AVOID = [0, 0.45, -0.45, 0.9, -0.9, 1.4, -1.4, 2.0, -2.0, 2.7, -2.7];

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function canSee(a, b, mode, phase) {
  if (mode === 'blackout' && phase === 'play' && dist(a, b) > VIS) return false;
  return hasLineOfSight(a.x, a.y, b.x, b.y);
}

export function newBotInfo(existing) {
  const usedNames = new Set(existing.map(b => b.n));
  const name = BOT_NAMES.find(n => !usedNames.has('🤖 ' + n)) || 'Bot' + Math.floor(Math.random() * 99);
  return {
    id: 'bot-' + Math.random().toString(36).slice(2, 8),
    n: '🤖 ' + name,
    c: COLORS[Math.floor(Math.random() * COLORS.length)],
  };
}

export function newBotSim(id, x, y) {
  const p = x == null ? randomFreePoint() : { x, y };
  return { id, x: p.x, y: p.y, vx: 0, vy: 0, d: 0, stam: 100, think: 0, goal: null, flee: null, urgent: false,
    lastSeen: null, wanderT: 0, stuckT: 0, lx: p.x, ly: p.y };
}

// What bot b can see: line of sight, Blackout's small radius, and Ghost Tag's invisible IT
function sees(b, o, ctx, r) {
  if (ctx.mode === 'ghost' && ctx.roles[o.id]?.it && !r.it && dist(b, o) > GHOST_R) return false;
  return canSee(b, o, ctx.mode, ctx.phase);
}

// ctx: { phase, mode, roles, round, zone, others: [{id,x,y,vx,vy}] }
export function updateBot(b, ctx, dt) {
  const r = ctx.roles[b.id] || {};
  if (b.lastSeen) b.lastSeen.t -= dt;
  b.wanderT -= dt;

  const locked = ctx.phase === 'countdown' || r.frozen || r.stun > 0;
  if (locked) { b.vx = b.vy = 0; return; }

  b.think -= dt;
  if (b.think <= 0) {
    b.think = 0.12 + Math.random() * 0.1;
    decide(b, ctx, r);
  }

  let mx = 0, my = 0;
  if (b.flee) { mx = b.flee.x; my = b.flee.y; }
  else if (b.goal) {
    const dx = b.goal.x - b.x, dy = b.goal.y - b.y, d = Math.hypot(dx, dy);
    if (d > 10) { mx = dx / d; my = dy / d; }
  }
  if (mx || my) {
    const base = Math.atan2(my, mx);
    for (const off of AVOID) {
      const a = base + off;
      if (!pointBlocked(b.x + Math.cos(a) * 30, b.y + Math.sin(a) * 30, PLAYER_R)) { mx = Math.cos(a); my = Math.sin(a); break; }
    }
  }

  const moving = !!(mx || my);
  const sprint = b.urgent && moving && b.stam > 8;
  if (sprint && ctx.mode !== 'turbo') b.stam = Math.max(0, b.stam - 32 * dt);
  else b.stam = Math.min(100, b.stam + 16 * dt);

  const ground = groundAt(b.x, b.y);
  let sp = SPEED * 0.88 * (r.it ? 1.06 : 1) * (sprint ? SPRINT_MULT : 1) * ground.speed;
  if (ctx.phase !== 'play') sp *= 0.45;
  else sp *= modeSpeed(ctx.mode, r) * (outsideZone(ctx.zone, b) ? 0.6 : 1);
  if (ground.slide) {
    const k = Math.min(1, dt * 1.8);
    b.vx += (mx * sp - b.vx) * k; b.vy += (my * sp - b.vy) * k;
  } else { b.vx = mx * sp; b.vy = my * sp; }
  b.x += b.vx * dt; b.y += b.vy * dt;
  resolveCollisions(b, PLAYER_R);
  if (moving) b.d = Math.atan2(my, mx);

  // unstick: if barely moving while trying to, pick a new random goal
  b.stuckT += dt;
  if (b.stuckT > 0.8) {
    if (moving && Math.hypot(b.x - b.lx, b.y - b.ly) < 15) { b.goal = randomFreePoint(); b.flee = null; b.wanderT = 2; }
    b.lx = b.x; b.ly = b.y; b.stuckT = 0;
  }
}

function decide(b, ctx, r) {
  const { phase, mode, roles, others, zone } = ctx;
  b.urgent = false;
  if (phase !== 'play' || r.out) { wander(b, zone); return; }

  // Shrinking Zone: get back inside before anything else
  if (zone && Math.hypot(b.x - zone.x, b.y - zone.y) > zone.r - 40) {
    b.goal = { x: zone.x, y: zone.y }; b.flee = null; b.urgent = true;
    return;
  }

  // In Crown Chase everyone chases the crown holder, and the holder runs
  const crown = mode === 'crown';
  const chasing = crown ? !r.it : r.it;
  const isTarget = ro => crown ? ro.it : !ro.it && !ro.out && !ro.frozen && !(ro.imm > 0);
  const isThreat = ro => crown ? !ro.it && !ro.out : ro.it && !ro.out;

  if (chasing) {
    let best = null, bd = Infinity;
    for (const o of others) {
      const ro = roles[o.id];
      if (!ro || o.id === b.id || !isTarget(ro)) continue;
      const d = dist(b, o);
      if (d < bd && sees(b, o, ctx, r)) { bd = d; best = o; }
    }
    if (best) {
      b.goal = { x: best.x + (best.vx || 0) * 0.35, y: best.y + (best.vy || 0) * 0.35 };
      b.lastSeen = { x: best.x, y: best.y, t: 3 };
      b.flee = null;
      b.urgent = bd < 280;
      return;
    }
    if (b.lastSeen && b.lastSeen.t > 0) {
      b.goal = { x: b.lastSeen.x, y: b.lastSeen.y }; b.flee = null;
      if (dist(b, b.goal) < 30) b.lastSeen = null;
      return;
    }
    wander(b, zone);
    return;
  }

  // runner
  let threat = null, td = Infinity;
  for (const o of others) {
    const ro = roles[o.id];
    if (!ro || o.id === b.id || !isThreat(ro)) continue;
    const d = dist(b, o);
    if (d < td && d < 520 && sees(b, o, ctx, r)) { td = d; threat = o; }
  }
  if (threat) {
    b.flee = chooseFlee(b, threat, zone);
    b.goal = null;
    b.urgent = td < 320;
    b.hideRound = null; // spotted: find a new hiding place afterwards
    return;
  }
  b.flee = null;
  if (mode === 'hide') {
    if (b.hideRound !== ctx.round) {
      b.hideRound = ctx.round;
      b.hideSpot = pickHideSpot(b, others.filter(o => roles[o.id]?.it));
    }
    b.goal = dist(b, b.hideSpot) > 15 ? b.hideSpot : null; // get there, then keep still
    b.urgent = !!b.goal;
    return;
  }
  if (mode === 'freeze') {
    let best = null, bd = Infinity;
    for (const o of others) {
      const ro = roles[o.id];
      if (!ro || !ro.frozen) continue;
      const d = dist(b, o);
      if (d < bd) { bd = d; best = o; }
    }
    if (best) { b.goal = { x: best.x, y: best.y }; b.urgent = bd < 400; return; }
  }
  wander(b, zone);
}

// Hide & Seek: somewhere out of the seekers' sight, not too far to reach
function pickHideSpot(b, seekers) {
  let best = null, bs = -Infinity;
  for (let i = 0; i < 30; i++) {
    const p = randomFreePoint();
    let s = -dist(b, p) * 0.4 + Math.random() * 80;
    for (const k of seekers) {
      s += Math.min(dist(p, k), 900) * 0.5;
      if (!hasLineOfSight(p.x, p.y, k.x, k.y)) s += 500;
    }
    if (s > bs) { bs = s; best = p; }
  }
  return best;
}

function chooseFlee(b, t, zone) {
  let best = null, bs = -Infinity;
  const d0 = dist(b, t);
  for (const dir of DIRS) {
    const px = b.x + dir.x * 90, py = b.y + dir.y * 90;
    if (pointBlocked(b.x + dir.x * 32, b.y + dir.y * 32, PLAYER_R) || pointBlocked(px, py, PLAYER_R)) continue;
    let s = Math.hypot(px - t.x, py - t.y) - d0;
    if (!hasLineOfSight(px, py, t.x, t.y)) s += 70; // prefer breaking line of sight (hide!)
    const edge = Math.min(px, py, WORLD.w - px, WORLD.h - py);
    if (edge < 180) s -= (180 - edge) * 0.6; // don't get cornered
    if (zone && Math.hypot(px - zone.x, py - zone.y) > zone.r - 40) s -= 300; // stay in the zone
    if (b.flee) s += (dir.x * b.flee.x + dir.y * b.flee.y) * 15; // momentum
    s += Math.random() * 6;
    if (s > bs) { bs = s; best = dir; }
  }
  return best || DIRS[Math.floor(Math.random() * DIRS.length)];
}

function wander(b, zone) {
  b.flee = null;
  if (!b.goal || b.wanderT <= 0 || dist(b, b.goal) < 40) {
    b.goal = randomFreePoint();
    for (let i = 0; i < 20 && zone && outsideZone({ ...zone, r: zone.r - 60 }, b.goal); i++) b.goal = randomFreePoint();
    b.wanderT = 5 + Math.random() * 4;
  }
}

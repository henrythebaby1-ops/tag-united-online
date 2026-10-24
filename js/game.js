import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm';
import { SUPABASE_URL, SUPABASE_KEY, CHANNEL_PREFIX, LOBBY_CHANNEL, PLAYER_R, SPEED, SPRINT_MULT, TAG_DIST, MODES, COLORS } from './config.js';
import { WORLD, renderMap, resolveCollisions, randomFreePoint, inSlowZone } from './map.js';
import { VIS, canSee, newBotInfo, newBotSim, updateBot } from './bots.js';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { realtime: { params: { eventsPerSecond: 40 } } });
const $ = id => document.getElementById(id);

// ---------- helpers ----------
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const shuffle = arr => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const isBot = id => id.startsWith('bot-');
const cleanCode = s => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
const randomCode = () => Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
const now = () => performance.now();

// ---------- local identity ----------
const myId = Math.random().toString(36).slice(2, 10);
const profile = {
  name: store.get('tuo-name') || 'Player' + Math.floor(rand(100, 999)),
  color: store.get('tuo-color') || pick(COLORS),
};

// ---------- runtime state ----------
let room = null, channel = null, subscribed = false, lobbyCh = null;
let presence = {};           // id -> {name,color,joined}
let joinTime = 0;
let state = null;            // authoritative game state (written by host)
let phaseEnd = 0;            // local clock time when the current phase ends
let isHost = false;
const ents = new Map();      // remote humans + (for non-hosts) bots
const botSim = new Map();    // host only: id -> bot simulation
const hostMem = { botVoteAt: {}, elim: 0 };
const me = { id: myId, x: 600, y: 800, vx: 0, vy: 0, d: 0, stam: 100, exhausted: false };
let prevPhase = null, myVote = null;
let lastStateSent = 0, lastPosSent = 0, lastPX = 0, lastPY = 0;
let lobbyTrackKey = '';

// ---------- canvas ----------
const cv = $('game'), ctx = cv.getContext('2d');
const mapImg = renderMap();
const dark = document.createElement('canvas'), dctx = dark.getContext('2d');
const mini = $('minimap'), mctx = mini.getContext('2d');
const miniBase = document.createElement('canvas');
miniBase.width = mini.width; miniBase.height = mini.height;
miniBase.getContext('2d').drawImage(mapImg, 0, 0, mini.width, mini.height);
let vw = 0, vh = 0, dpr = 1, scale = 1, camX = 0, camY = 0;
function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  vw = innerWidth; vh = innerHeight;
  cv.width = dark.width = vw * dpr; cv.height = dark.height = vh * dpr;
  scale = Math.max(0.5, Math.min(1.3, Math.min(vw, vh) / 720));
}
addEventListener('resize', resize); resize();

// ---------- sound ----------
let actx = null;
function beep(f = 440, d = 0.1, type = 'square', vol = 0.05) {
  try {
    actx ||= new AudioContext();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(vol, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + d);
    o.connect(g).connect(actx.destination);
    o.start(); o.stop(actx.currentTime + d);
  } catch { /* audio unavailable */ }
}

// ---------- roster ----------
function humanIds() { return Object.keys(presence); }
function botIds() { return state?.settings.bots ? (state.bots || []).map(b => b.id) : []; }
function participants() { return [...humanIds(), ...botIds()]; }
function infoOf(id) {
  if (id === myId) return { name: profile.name, color: profile.color };
  if (isBot(id)) { const b = state?.bots?.find(b => b.id === id); return { name: b?.n || 'Bot', color: b?.c || '#999' }; }
  const p = presence[id];
  return { name: p?.name || '???', color: p?.color || '#999' };
}
const nameOf = id => infoOf(id).name;
function posOf(id) {
  if (id === myId) return me;
  if (isBot(id) && isHost) return botSim.get(id);
  const e = ents.get(id);
  return e && e.seen ? e : null;
}

// ---------- networking ----------
function send(event, payload) {
  if (channel && subscribed) channel.send({ type: 'broadcast', event, payload });
}

function joinRoom(rawCode) {
  const code = cleanCode(rawCode);
  if (code.length < 3) { toast('Room code must be 3–6 letters/numbers'); return; }
  saveProfile();
  if (channel) leaveRoom(true);
  room = code;
  history.replaceState(null, '', '#' + code);
  state = null; isHost = false; presence = {}; ents.clear(); botSim.clear(); prevPhase = null; myVote = null;
  joinTime = now(); subscribed = false;
  Object.assign(me, randomFreePoint(), { stam: 100, exhausted: false });

  channel = sb.channel(CHANNEL_PREFIX + code, { config: { broadcast: { self: false }, presence: { key: myId } } });
  channel
    .on('presence', { event: 'sync' }, onPresenceSync)
    .on('presence', { event: 'join' }, ({ key, newPresences }) => { if (key !== myId && newPresences[0]) toast(`${newPresences[0].name} joined`); })
    .on('presence', { event: 'leave' }, ({ key, leftPresences }) => { if (key !== myId && leftPresences[0]) toast(`${leftPresences[0].name} left`); })
    .on('broadcast', { event: 'pos' }, ({ payload }) => onPos(payload))
    .on('broadcast', { event: 'state' }, ({ payload }) => onState(payload))
    .on('broadcast', { event: 'vote' }, ({ payload }) => onVote(payload))
    .on('broadcast', { event: 'evt' }, ({ payload }) => handleEvt(payload))
    .subscribe(async status => {
      if (status === 'SUBSCRIBED') {
        subscribed = true;
        setStatus('');
        await channel.track({ name: profile.name, color: profile.color, joined: Date.now() });
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        subscribed = false;
        setStatus('Connection problem — retrying…');
      } else if (status === 'CLOSED') {
        subscribed = false;
      }
    });

  $('menu').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('roomTag').textContent = 'Room ' + code;
  $('lobbyCode').textContent = code;
  if (isTouch) $('touch').classList.remove('hidden');
  setStatus('Connecting…');
}

function leaveRoom(silent) {
  if (channel) { channel.untrack().catch(() => {}); sb.removeChannel(channel); }
  channel = null; room = null; state = null; isHost = false; subscribed = false;
  ents.clear(); botSim.clear(); presence = {};
  updateLobbyTrack();
  if (silent) return;
  history.replaceState(null, '', location.pathname);
  for (const id of ['hud', 'lobby', 'vote', 'results', 'countdown', 'touch', 'status']) $(id).classList.add('hidden');
  $('menu').classList.remove('hidden');
  renderRoomList();
}

function onPresenceSync() {
  const ps = channel.presenceState();
  presence = {};
  for (const [key, metas] of Object.entries(ps)) {
    const m = metas[0];
    if (m) presence[key] = { name: String(m.name || '???').slice(0, 14), color: m.color, joined: m.joined || 0 };
  }
  for (const id of [...ents.keys()]) if (!isBot(id) && !presence[id]) ents.delete(id);
}

function computeHost() {
  const ids = humanIds();
  if (!ids.includes(myId)) return null;
  if (state?.host && ids.includes(state.host)) return state.host;
  // just joined a room with people in it: wait for the existing host's state
  if (!state && ids.length > 1 && now() - joinTime < 2500) return null;
  return ids.sort((a, b) => (presence[a].joined - presence[b].joined) || (a < b ? -1 : 1))[0];
}

function updateHostStatus() {
  const h = computeHost();
  if (h === myId && !isHost) {
    isHost = true;
    if (!state) hostInit();
    else {
      state.host = myId;
      botSim.clear();
      for (const b of state.bots) {
        const e = ents.get(b.id);
        botSim.set(b.id, newBotSim(b.id, e ? e.x : b.x, e ? e.y : b.y));
      }
      if (prevPhase && state.phase !== 'waiting') toast('You are now the host');
    }
    sendState();
  } else if (h && h !== myId) {
    isHost = false;
  }
}

function onPos(p) {
  if (!p || p.id === myId || typeof p.x !== 'number') return;
  let e = ents.get(p.id);
  if (!e) { e = { id: p.id, x: p.x, y: p.y }; ents.set(p.id, e); }
  if (!e.seen || Math.hypot(p.x - e.x, p.y - e.y) > 300) { e.x = p.x; e.y = p.y; }
  e.seen = true; e.tx = p.x; e.ty = p.y; e.d = p.d; e.vx = p.vx || 0; e.vy = p.vy || 0;
}

function onState(p) {
  if (!p || !p.phase) return;
  if (isHost && p.host !== myId) {
    if (p.host < myId) isHost = false; // two hosts: lower id wins
    else return;
  }
  state = p;
  phaseEnd = now() + (p.t || 0);
  const ids = new Set();
  for (const b of p.bots || []) {
    ids.add(b.id);
    onPos({ id: b.id, x: b.x, y: b.y, d: b.d, vx: b.vx, vy: b.vy });
  }
  for (const id of [...ents.keys()]) if (isBot(id) && !ids.has(id)) ents.delete(id);
}

function onVote(p) {
  if (!isHost || !state || state.phase !== 'vote' || !p) return;
  if (state.choices.includes(p.mode) && (presence[p.id])) { state.votes[p.id] = p.mode; sendState(); }
}

function emit(e) { send('evt', e); handleEvt(e); }
function handleEvt(e) {
  if (!e || !e.text) return;
  toast(e.text);
  const involved = e.a === myId || e.b === myId;
  if (e.k === 'boom') { beep(90, 0.5, 'sawtooth', 0.12); beep(60, 0.6, 'square', 0.08); }
  else if (e.k === 'rescue') beep(880, 0.15, 'sine', 0.06);
  else if (involved) { beep(520, 0.08); setTimeout(() => beep(780, 0.12), 80); }
  else beep(330, 0.05, 'triangle', 0.03);
}

// ---------- host: game flow ----------
function hostInit() {
  state = {
    host: myId, seq: 0, phase: 'waiting', mode: null, choices: [], votes: {}, roles: {}, bots: [],
    fuse: 0, results: null, round: 0, lastSurvivor: null,
    settings: { bots: true, botCount: 3, roundTime: 120 },
  };
  phaseEnd = 0;
}

function setPhase(p, ms) { state.phase = p; phaseEnd = now() + ms; }

function sendState() {
  if (!state || !isHost) return;
  state.seq++;
  state.host = myId;
  state.bots = state.bots.map(b => {
    const s = botSim.get(b.id);
    return s ? { ...b, x: Math.round(s.x), y: Math.round(s.y), d: Math.round(s.d * 100) / 100, vx: Math.round(s.vx), vy: Math.round(s.vy) } : b;
  });
  send('state', { ...state, t: Math.max(0, Math.round(phaseEnd - now())) });
  lastStateSent = now();
}

function syncBots() {
  const want = state.settings.bots ? state.settings.botCount : 0;
  while (state.bots.length < want) {
    const info = newBotInfo(state.bots);
    const sim = newBotSim(info.id);
    botSim.set(info.id, sim);
    state.bots.push({ ...info, x: sim.x, y: sim.y, d: 0 });
  }
  while (state.bots.length > want) {
    const b = state.bots.pop();
    botSim.delete(b.id); delete state.roles[b.id]; delete state.votes[b.id];
  }
  for (const b of state.bots) if (!botSim.has(b.id)) botSim.set(b.id, newBotSim(b.id, b.x, b.y));
}

function defaultRole(out = false) { return { it: false, frozen: false, out, stun: 0, imm: 0, score: 0, tags: 0 }; }

function ensureRoles(ids) {
  const inRound = state.phase === 'play' || state.phase === 'countdown';
  for (const id of ids) if (!state.roles[id]) state.roles[id] = defaultRole(inRound && state.mode === 'potato');
  for (const id of Object.keys(state.roles)) if (!ids.includes(id)) delete state.roles[id];
}

function startVote() {
  // Classic Tag is always on the ballot, plus two other random modes
  state.choices = ['classic', ...shuffle(Object.keys(MODES).filter(m => m !== 'classic')).slice(0, 2)];
  state.votes = {};
  state.results = null;
  hostMem.botVoteAt = {};
  setPhase('vote', 15000);
  sendState();
}

function finishVote() {
  const counts = {};
  for (const m of Object.values(state.votes)) counts[m] = (counts[m] || 0) + 1;
  const max = Math.max(0, ...Object.values(counts));
  const top = max ? state.choices.filter(m => counts[m] === max) : state.choices;
  state.mode = pick(top);
  state.round++;
  assignRoles();
  for (const s of botSim.values()) Object.assign(s, randomFreePoint(), { goal: null, flee: null });
  setPhase('countdown', 3500);
  emit({ k: 'mode', text: `${MODES[state.mode].icon} ${MODES[state.mode].name} wins the vote!` });
  sendState();
}

function assignRoles() {
  const ids = participants();
  state.roles = {};
  for (const id of ids) state.roles[id] = defaultRole();
  const n = ids.length;
  const m = state.mode;
  const taggerCount = m === 'freeze' ? Math.max(1, Math.ceil(n / 4)) : m === 'potato' ? 1 : (n >= 8 ? 2 : 1);
  for (const id of shuffle(ids).slice(0, taggerCount)) state.roles[id].it = true;
  state.fuse = m === 'potato' ? rand(14000, 20000) : 0;
  state.lastSurvivor = null;
  hostMem.elim = 0;
}

function startPlay() {
  const ms = state.mode === 'potato' ? 300000 : state.settings.roundTime * 1000;
  setPhase('play', ms);
  // head start for runners
  for (const r of Object.values(state.roles)) if (r.it && state.mode !== 'potato') r.stun = 1500;
  sendState();
}

function toWaiting(reason) {
  state.phase = 'waiting'; state.roles = {}; state.results = null; state.mode = null; phaseEnd = 0;
  if (reason) emit({ k: 'info', text: reason });
  sendState();
}

function endRound(title, text, rows) {
  state.results = { title, text, rows: rows.slice(0, 12) };
  setPhase('results', 10000);
  beep(523, 0.15, 'triangle', 0.08); setTimeout(() => beep(659, 0.15, 'triangle', 0.08), 150); setTimeout(() => beep(784, 0.3, 'triangle', 0.08), 300);
  sendState();
}

function hostTick(dt) {
  syncBots();
  const ids = participants();
  ensureRoles(ids);
  const t = now();
  const ph = state.phase;

  if (ph === 'vote') {
    if (ids.length < 2) return toWaiting('Not enough players');
    for (const b of state.bots) {
      if (!hostMem.botVoteAt[b.id]) hostMem.botVoteAt[b.id] = t + rand(1500, 9000);
      if (!state.votes[b.id] && t > hostMem.botVoteAt[b.id]) { state.votes[b.id] = pick(state.choices); sendState(); }
    }
    const allHumansVoted = humanIds().every(id => state.votes[id]);
    if (t >= phaseEnd) finishVote();
    else if (allHumansVoted && phaseEnd - t > 3000) {
      phaseEnd = t + 3000; sendState(); // everyone voted: wrap up quickly
    }
  } else if (ph === 'countdown') {
    if (ids.length < 2) return toWaiting('Not enough players');
    if (t >= phaseEnd) startPlay();
  } else if (ph === 'play') {
    if (ids.length < 2) return toWaiting('Not enough players to keep playing');
    hostPlayTick(dt, ids);
  } else if (ph === 'results') {
    if (t >= phaseEnd) { if (ids.length >= 2) startVote(); else toWaiting(); }
  }

  // bots
  const others = ids.map(id => {
    const p = posOf(id);
    return p ? { id, x: p.x, y: p.y, vx: p.vx || 0, vy: p.vy || 0 } : null;
  }).filter(Boolean);
  const bctx = { phase: state.phase, mode: state.mode, roles: state.roles, others };
  for (const b of botSim.values()) updateBot(b, bctx, dt);

  if (t - lastStateSent > 200) sendState();
}

function hostPlayTick(dt, ids) {
  const R = state.roles, m = state.mode, ms = dt * 1000;
  for (const id of ids) {
    const r = R[id];
    if (r.stun > 0) r.stun = Math.max(0, r.stun - ms);
    if (r.imm > 0) r.imm = Math.max(0, r.imm - ms);
  }
  const alive = ids.filter(id => !R[id].out);
  const touching = (a, b) => { const pa = posOf(a), pb = posOf(b); return pa && pb && dist(pa, pb) < TAG_DIST; };

  // someone holding a tagger role left: hand it to someone else
  if (!alive.some(id => R[id].it)) {
    const pool = alive.filter(id => !R[id].frozen);
    if (pool.length) {
      const p = pick(pool);
      R[p].it = true; R[p].stun = 1000;
      if (m === 'potato') state.fuse = rand(10000, 16000);
      emit({ k: 'tag', b: p, text: `${nameOf(p)} is now ${m === 'potato' ? 'holding the potato 🥔' : m === 'infection' ? 'infected 🧟' : 'IT!'}` });
    }
  }

  if (m === 'classic' || m === 'blackout') {
    for (const id of alive) if (R[id].it) R[id].score += dt;
    outer: for (const a of alive) {
      if (!R[a].it || R[a].stun > 0) continue;
      for (const b of alive) {
        if (R[b].it || R[b].imm > 0 || !touching(a, b)) continue;
        R[a].it = false; R[a].imm = 1500; R[a].tags++;
        R[b].it = true; R[b].stun = 1200;
        emit({ k: 'tag', a, b, text: `${nameOf(a)} tagged ${nameOf(b)}!` });
        break outer;
      }
    }
  } else if (m === 'freeze') {
    for (const a of alive) {
      if (!R[a].it || R[a].stun > 0) continue;
      for (const b of alive) {
        if (R[b].it || R[b].frozen || R[b].imm > 0 || !touching(a, b)) continue;
        R[b].frozen = true; R[a].tags++;
        emit({ k: 'tag', a, b, text: `🧊 ${nameOf(a)} froze ${nameOf(b)}` });
      }
    }
    for (const a of alive) {
      if (R[a].it || R[a].frozen) continue;
      for (const b of alive) {
        if (!R[b].frozen || !touching(a, b)) continue;
        R[b].frozen = false; R[b].imm = 1500; R[a].score++;
        emit({ k: 'rescue', a, b, text: `🔥 ${nameOf(a)} unfroze ${nameOf(b)}` });
      }
    }
    const runners = alive.filter(id => !R[id].it);
    if (runners.length && runners.every(id => R[id].frozen)) {
      const taggers = alive.filter(id => R[id].it);
      return endRound('Taggers win! 🧊', 'Every runner got frozen.',
        rows(taggers, id => `${R[id].tags} freezes`, id => R[id].tags).concat(rows(runners, id => `${R[id].score} rescues`, id => R[id].score)));
    }
  } else if (m === 'infection') {
    for (const id of alive) if (!R[id].it) R[id].score += dt;
    for (const a of alive) {
      if (!R[a].it || R[a].stun > 0) continue;
      for (const b of alive) {
        if (R[b].it || R[b].imm > 0 || !touching(a, b)) continue;
        R[b].it = true; R[b].stun = 800; R[a].tags++;
        emit({ k: 'tag', a, b, text: `🧟 ${nameOf(a)} infected ${nameOf(b)}` });
      }
    }
    const runners = alive.filter(id => !R[id].it);
    if (runners.length === 1) state.lastSurvivor = runners[0];
    if (!runners.length) {
      const w = state.lastSurvivor;
      return endRound(w ? `${nameOf(w)} wins! 🏆` : 'Infected win! 🧟', w ? 'Last survivor standing.' : 'Everyone got infected.',
        rows(alive, id => `${R[id].score.toFixed(1)}s survived`, id => R[id].score + (id === w ? 1000 : 0)));
    }
  } else if (m === 'potato') {
    const h = alive.find(id => R[id].it);
    if (h && R[h].stun <= 0) {
      for (const b of alive) {
        if (b === h || R[b].imm > 0 || !touching(h, b)) continue;
        R[h].it = false; R[h].imm = 900;
        R[b].it = true; R[b].stun = 250;
        emit({ k: 'tag', a: h, b, text: `🥔 ${nameOf(h)} → ${nameOf(b)}` });
        break;
      }
    }
    state.fuse -= ms;
    if (state.fuse <= 0) {
      const holder = alive.find(id => R[id].it);
      if (holder) {
        R[holder].it = false; R[holder].out = true; R[holder].score = ++hostMem.elim;
        emit({ k: 'boom', a: holder, text: `💥 BOOM! ${nameOf(holder)} is out!` });
      }
      const left = alive.filter(id => !R[id].out);
      if (left.length <= 1) {
        const w = left[0];
        if (w) R[w].score = 999;
        return endRound(w ? `${nameOf(w)} wins! 🥔` : 'Nobody survived!', 'Last one holding nothing.',
          rows(ids, id => R[id].out ? `out #${R[id].score}` : 'survived', id => R[id].score));
      }
      const next = pick(left);
      R[next].it = true; R[next].stun = 800;
      state.fuse = rand(12000, 20000);
      emit({ k: 'tag', b: next, text: `🥔 New potato: ${nameOf(next)}` });
    }
  }

  if (now() >= phaseEnd) {
    if (m === 'classic' || m === 'blackout') {
      const r = rows(alive, id => `${R[id].score.toFixed(1)}s as IT`, id => -R[id].score);
      return endRound(`${r[0] ? r[0].name : 'Nobody'} wins! 🏆`, 'Least time spent as IT.', r);
    }
    if (m === 'freeze') {
      const runners = alive.filter(id => !R[id].it);
      return endRound('Runners survive! 🏃', 'Time ran out before everyone froze.',
        rows(runners, id => `${R[id].score} rescues${R[id].frozen ? ' (frozen)' : ''}`, id => R[id].score - (R[id].frozen ? 100 : 0))
          .concat(rows(alive.filter(id => R[id].it), id => `${R[id].tags} freezes`, id => R[id].tags)));
    }
    if (m === 'infection') {
      const surv = alive.filter(id => !R[id].it);
      return endRound('Survivors win! 🛡️', `${surv.length} survivor${surv.length === 1 ? '' : 's'} made it.`,
        rows(alive, id => R[id].it ? `${R[id].tags} infections` : 'survived!', id => (R[id].it ? 0 : 1000) + R[id].tags));
    }
    if (m === 'potato') {
      return endRound('Time\'s up! 🥔', 'Everyone still standing wins.', rows(ids, id => R[id].out ? 'out' : 'survived', id => R[id].out ? R[id].score : 999));
    }
  }
}

function rows(ids, label, sortVal) {
  return ids.map(id => ({ id, name: nameOf(id), color: infoOf(id).color, val: label(id), s: sortVal(id) }))
    .sort((a, b) => b.s - a.s)
    .map(({ s, ...r }) => r);
}

// ---------- input ----------
const keys = new Set();
const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  keys.add(e.key.toLowerCase());
  if (room && ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) e.preventDefault();
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());

const stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
let touchSprint = false;
cv.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse' || stick.id !== null) return;
  stick.id = e.pointerId; stick.ox = e.clientX; stick.oy = e.clientY; stick.x = stick.y = 0;
  const s = $('stick'); s.style.display = 'block'; s.style.left = e.clientX - 60 + 'px'; s.style.top = e.clientY - 60 + 'px';
});
addEventListener('pointermove', e => {
  if (e.pointerId !== stick.id) return;
  let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy;
  const d = Math.hypot(dx, dy), max = 50;
  if (d > max) { dx = dx / d * max; dy = dy / d * max; }
  stick.x = dx / max; stick.y = dy / max;
  $('knob').style.transform = `translate(${dx}px, ${dy}px)`;
});
const endStick = e => {
  if (e.pointerId !== stick.id) return;
  stick.id = null; stick.x = stick.y = 0;
  $('stick').style.display = 'none'; $('knob').style.transform = '';
};
addEventListener('pointerup', endStick); addEventListener('pointercancel', endStick);
const sprintBtn = $('sprintBtn');
sprintBtn.addEventListener('pointerdown', e => { e.preventDefault(); touchSprint = true; sprintBtn.classList.add('on'); });
for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) sprintBtn.addEventListener(ev, () => { touchSprint = false; sprintBtn.classList.remove('on'); });

function myRole() { return state?.roles?.[myId]; }

function updateMe(dt) {
  let mx = 0, my = 0;
  if (keys.has('w') || keys.has('arrowup')) my -= 1;
  if (keys.has('s') || keys.has('arrowdown')) my += 1;
  if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
  if (keys.has('d') || keys.has('arrowright')) mx += 1;
  if (stick.id !== null) { mx = stick.x; my = stick.y; }
  const len = Math.hypot(mx, my);
  if (len > 1) { mx /= len; my /= len; }

  const r = myRole();
  const locked = state?.phase === 'countdown' || r?.frozen || r?.stun > 0;
  if (locked) { mx = my = 0; }

  const moving = Math.hypot(mx, my) > 0.1;
  const wantSprint = keys.has('shift') || touchSprint;
  if (me.stam <= 0) me.exhausted = true;
  if (me.exhausted && me.stam > 25) me.exhausted = false;
  const sprint = wantSprint && moving && !me.exhausted;
  if (sprint) me.stam = Math.max(0, me.stam - 30 * dt);
  else me.stam = Math.min(100, me.stam + 18 * dt);

  const sp = SPEED * (r?.it ? 1.06 : 1) * (sprint ? SPRINT_MULT : 1) * (inSlowZone(me.x, me.y) ? 0.55 : 1);
  me.vx = mx * sp; me.vy = my * sp;
  me.x += me.vx * dt; me.y += me.vy * dt;
  resolveCollisions(me, PLAYER_R);
  if (moving) me.d = Math.atan2(my, mx);
}

function smoothEnts(dt) {
  const k = Math.min(1, dt * 12);
  for (const e of ents.values()) {
    if (isHost && isBot(e.id)) continue;
    if (e.tx == null) continue;
    e.x += (e.tx - e.x) * k; e.y += (e.ty - e.y) * k;
  }
}

function netSend(t) {
  if (!subscribed) return;
  const moved = Math.hypot(me.x - lastPX, me.y - lastPY) > 0.5;
  if (t - lastPosSent > 100 && (moved || t - lastPosSent > 1000)) {
    send('pos', { id: myId, x: Math.round(me.x), y: Math.round(me.y), d: Math.round(me.d * 100) / 100, vx: Math.round(me.vx), vy: Math.round(me.vy) });
    lastPosSent = t; lastPX = me.x; lastPY = me.y;
  }
}

function detectPhaseChange() {
  const ph = state?.phase || null;
  if (ph === prevPhase) return;
  if (ph === 'countdown') { Object.assign(me, randomFreePoint()); me.stam = 100; }
  if (ph === 'vote') { myVote = null; beep(440, 0.1, 'triangle'); }
  if (ph === 'play') beep(880, 0.3, 'square', 0.07);
  prevPhase = ph;
}

// ---------- rendering ----------
function renderables() {
  const list = [me];
  for (const id of humanIds()) { if (id !== myId) { const e = ents.get(id); if (e?.seen) list.push(e); } }
  if (state?.settings.bots) {
    for (const b of state.bots) {
      const e = isHost ? botSim.get(b.id) : ents.get(b.id);
      if (e) list.push(e);
    }
  }
  return list;
}

function visibleToMe(e) {
  if (e.id === myId) return true;
  const ph = state?.phase;
  if (ph !== 'play' && ph !== 'countdown') return true;
  if (myRole()?.out) return true;
  return canSee(me, e, state.mode, ph);
}

function render(t) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#2d5a24';
  ctx.fillRect(0, 0, vw, vh);
  const viewW = vw / scale, viewH = vh / scale;
  let fx = me.x, fy = me.y;
  if (!room) { fx = WORLD.w / 2 + Math.sin(t / 9000) * 700; fy = WORLD.h / 2 + Math.cos(t / 12000) * 400; }
  camX = viewW >= WORLD.w ? (WORLD.w - viewW) / 2 : Math.max(0, Math.min(WORLD.w - viewW, fx - viewW / 2));
  camY = viewH >= WORLD.h ? (WORLD.h - viewH) / 2 : Math.max(0, Math.min(WORLD.h - viewH, fy - viewH / 2));

  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(-camX, -camY);
  ctx.drawImage(mapImg, 0, 0);
  if (room) {
    const list = renderables().filter(visibleToMe).sort((a, b) => a.y - b.y);
    for (const e of list) drawPlayer(e, state?.roles?.[e.id], t);
  }
  ctx.restore();

  if (room && state?.mode === 'blackout' && state.phase === 'play' && !myRole()?.out) {
    dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dctx.globalCompositeOperation = 'source-over';
    dctx.clearRect(0, 0, vw, vh);
    dctx.fillStyle = 'rgba(4, 6, 16, 0.95)';
    dctx.fillRect(0, 0, vw, vh);
    dctx.globalCompositeOperation = 'destination-out';
    const sx = (me.x - camX) * scale, sy = (me.y - camY) * scale, rr = VIS * scale;
    const g = dctx.createRadialGradient(sx, sy, rr * 0.55, sx, sy, rr);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    dctx.fillStyle = g;
    dctx.beginPath(); dctx.arc(sx, sy, rr, 0, Math.PI * 2); dctx.fill();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(dark, 0, 0);
  }
}

function drawPlayer(e, r, t) {
  const R = PLAYER_R, m = state?.mode, info = infoOf(e.id);
  const inRound = state?.phase === 'play' || state?.phase === 'countdown';
  if (!inRound) r = null;
  ctx.save();
  ctx.translate(e.x, e.y);
  if (r?.out) ctx.globalAlpha = 0.35;
  if (r?.imm > 0 && Math.floor(t / 110) % 2) ctx.globalAlpha *= 0.55;

  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath(); ctx.ellipse(3, R * 0.75, R * 1.05, R * 0.45, 0, 0, Math.PI * 2); ctx.fill();

  if (r?.it && m !== 'infection' && m !== 'potato') {
    const pulse = 4 + Math.sin(t / 120) * 3;
    ctx.strokeStyle = 'rgba(255,60,60,0.85)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, R + pulse, 0, Math.PI * 2); ctx.stroke();
  }

  ctx.fillStyle = info.color;
  ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
  if (r?.it && m === 'infection') {
    ctx.fillStyle = 'rgba(90,200,60,0.65)';
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath(); ctx.arc(-6, -7, 6, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();

  // eyes look where you're going
  const d = e.d || 0, cx = Math.cos(d), cy = Math.sin(d);
  for (const s of [-1, 1]) {
    const ex = cx * 8 - cy * 6 * s, ey = cy * 8 + cx * 6 * s;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = r?.it && m === 'infection' ? '#d00' : '#111';
    ctx.beginPath(); ctx.arc(ex + cx * 2, ey + cy * 2, 2.6, 0, Math.PI * 2); ctx.fill();
  }

  if (r?.frozen) {
    ctx.fillStyle = 'rgba(160,225,255,0.55)'; ctx.strokeStyle = '#e8f8ff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(-R - 6, -R - 6, R * 2 + 12, R * 2 + 12, 6); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.moveTo(-R, -R + 6); ctx.lineTo(-R + 10, -R - 2); ctx.stroke();
  }

  let top = -R - 8;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  if (r?.it && m === 'potato') {
    ctx.font = '26px system-ui, sans-serif';
    ctx.fillText('🥔', Math.sin(t / 60) * 2, top - 2);
    if (Math.floor(t / 90) % 2) { ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(10, top - 26, 3, 0, Math.PI * 2); ctx.fill(); }
    top -= 28;
  } else if (r?.it && (m === 'classic' || m === 'blackout')) {
    ctx.fillStyle = '#ff3b3b';
    ctx.beginPath(); ctx.roundRect(-14, top - 16, 28, 16, 4); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px Nunito, sans-serif'; ctx.fillText('IT', 0, top - 4);
    top -= 18;
  } else if (r?.it && m === 'freeze') {
    ctx.font = '18px system-ui, sans-serif'; ctx.fillText('❄️', 0, top - 2); top -= 20;
  }
  if (r?.stun > 0) { ctx.font = '16px system-ui, sans-serif'; ctx.fillText('💫', 0, top - 2); top -= 18; }

  ctx.font = 'bold 13px Nunito, sans-serif';
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.75)';
  ctx.strokeText(info.name, 0, top);
  ctx.fillStyle = e.id === myId ? '#ffd23f' : '#fff';
  ctx.fillText(info.name, 0, top);
  ctx.restore();
}

function renderMinimap() {
  mctx.clearRect(0, 0, mini.width, mini.height);
  mctx.drawImage(miniBase, 0, 0);
  const sx = mini.width / WORLD.w, sy = mini.height / WORLD.h;
  const blackout = state?.mode === 'blackout' && state.phase === 'play' && !myRole()?.out;
  if (blackout) { mctx.fillStyle = 'rgba(0,0,0,0.6)'; mctx.fillRect(0, 0, mini.width, mini.height); }
  for (const e of renderables()) {
    if (!visibleToMe(e)) continue;
    const r = state?.roles?.[e.id];
    mctx.fillStyle = infoOf(e.id).color;
    mctx.beginPath(); mctx.arc(e.x * sx, e.y * sy, e.id === myId ? 4 : 3, 0, Math.PI * 2); mctx.fill();
    if (e.id === myId || (r?.it && state?.phase === 'play')) {
      mctx.strokeStyle = e.id === myId ? '#fff' : '#ff3b3b'; mctx.lineWidth = 1.5; mctx.stroke();
    }
  }
  mctx.strokeStyle = 'rgba(255,255,255,0.6)'; mctx.lineWidth = 1;
  mctx.strokeRect(camX * sx, camY * sy, vw / scale * sx, vh / scale * sy);
}

// ---------- HUD & overlays ----------
function toast(text) {
  const box = $('toasts');
  const d = document.createElement('div');
  d.className = 'toast'; d.textContent = text;
  box.appendChild(d);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => d.remove(), 3000);
}
function setStatus(s) { const el = $('status'); el.textContent = s; el.classList.toggle('hidden', !s); }
const show = (id, on) => $(id).classList.toggle('hidden', !on);
const fmt = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

let voteSig = '', lobbySig = '', lastCount = null;
function updateHud() {
  if (!room) return;
  $('staminaFill').style.width = me.stam + '%';
  $('staminaFill').style.opacity = me.exhausted ? 0.4 : 1;
  if (!state) { $('modeLabel').textContent = 'Connecting…'; $('timer').textContent = ''; return; }
  const ph = state.phase, m = state.mode, r = myRole(), left = phaseEnd - now();

  show('lobby', ph === 'waiting');
  show('vote', ph === 'vote');
  show('results', ph === 'results');
  show('countdown', ph === 'countdown');

  $('modeLabel').textContent = ph === 'waiting' ? 'Waiting room' : ph === 'vote' ? 'Voting…' : m ? `${MODES[m].icon} ${MODES[m].name}` : '';
  $('timer').textContent = ph === 'play' ? (m === 'potato' ? `🔥 ${(Math.max(0, state.fuse) / 1000).toFixed(1)}s` : fmt(left))
    : ph === 'results' || ph === 'vote' ? fmt(left) : '';

  // role banner
  const rb = $('roleBanner');
  let txt = '', cls = '';
  if ((ph === 'play' || ph === 'countdown') && r) {
    if (r.out) { txt = '💥 You\'re out — spectating'; cls = 'out'; }
    else if (m === 'freeze') {
      if (r.it) { txt = '❄️ TAGGER — freeze them all!'; cls = 'it'; }
      else if (r.frozen) { txt = '🧊 FROZEN! Wait for a rescue'; cls = 'frozen'; }
      else { txt = 'Runner — free your frozen friends'; cls = 'safe'; }
    } else if (m === 'infection') {
      if (r.it) { txt = '🧟 INFECTED — spread it!'; cls = 'infected'; } else { txt = '🛡️ Survivor — stay away!'; cls = 'safe'; }
    } else if (m === 'potato') {
      if (r.it) { txt = '🥔 HOT POTATO! Pass it on!'; cls = 'potato'; } else { txt = 'Stay away from the potato'; cls = 'safe'; }
    } else {
      if (r.it) { txt = '🔴 YOU\'RE IT! Tag someone!'; cls = 'it'; } else { txt = m === 'blackout' ? '🔦 Hide in the dark…' : '🏃 Run! Don\'t get tagged'; cls = 'safe'; }
    }
    if (r.stun > 0 && !r.frozen) txt += ' 💫';
  }
  rb.textContent = txt; rb.className = cls;

  // countdown
  if (ph === 'countdown') {
    const n = Math.ceil(left / 1000);
    $('countdown').textContent = n > 0 ? n : 'GO!';
    if (n !== lastCount && n > 0) beep(440, 0.12, 'square', 0.05);
    lastCount = n;
  } else lastCount = null;

  renderScoreboard();
  if (ph === 'waiting') renderLobby();
  if (ph === 'vote') renderVote(left);
  if (ph === 'results') renderResults(left);
  renderMinimap();
  updateLobbyTrack();
}

function scoreText(id, r) {
  const m = state.mode;
  if (!r || !m) return '';
  if (m === 'classic' || m === 'blackout') return r.score.toFixed(0) + 's';
  if (m === 'freeze') return r.it ? `❄${r.tags}` : `♥${r.score}`;
  if (m === 'infection') return r.it ? `🧟${r.tags}` : r.score.toFixed(0) + 's';
  return '';
}

function renderScoreboard() {
  const sbEl = $('scoreboard');
  const inRound = state.phase === 'play' || state.phase === 'countdown';
  const ids = participants();
  sbEl.replaceChildren();
  const head = document.createElement('div');
  head.className = 'muted small';
  head.textContent = `${ids.length} player${ids.length === 1 ? '' : 's'}${isHost ? ' · you host' : ''}`;
  sbEl.appendChild(head);
  for (const id of ids.slice(0, 12)) {
    const r = inRound ? state.roles[id] : null, info = infoOf(id);
    const row = document.createElement('div');
    row.className = 'row' + (id === myId ? ' me' : '');
    const dot = document.createElement('span'); dot.className = 'dot'; dot.style.background = info.color;
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = info.name;
    const tag = document.createElement('span');
    tag.textContent = !r ? '' : r.out ? '💀' : r.frozen ? '🧊' : r.it ? ({ classic: '🔴', blackout: '🔴', freeze: '❄️', infection: '🧟', potato: '🥔' }[state.mode]) : '';
    const sc = document.createElement('span'); sc.className = 'muted'; sc.textContent = inRound ? scoreText(id, r) : '';
    row.append(dot, nm, tag, sc);
    sbEl.appendChild(row);
  }
}

function renderLobby() {
  const s = state.settings, ids = participants();
  const sig = JSON.stringify([ids, s, isHost, ids.map(nameOf)]);
  if (sig === lobbySig) return;
  lobbySig = sig;
  const ul = $('lobbyPlayers');
  ul.replaceChildren();
  for (const id of ids) {
    const li = document.createElement('li');
    const dot = document.createElement('span'); dot.className = 'dot'; dot.style.background = infoOf(id).color;
    li.append(dot, document.createTextNode(nameOf(id) + (id === state.host ? ' 👑' : '') + (id === myId ? ' (you)' : '')));
    ul.appendChild(li);
  }
  for (const id of ['botsToggle', 'botCount', 'roundTime']) $(id).disabled = !isHost;
  $('botsToggle').checked = s.bots;
  $('botCount').value = s.botCount; $('botCountLabel').textContent = s.botCount;
  $('botCount').parentElement.style.opacity = s.bots ? 1 : 0.4;
  $('roundTime').value = String(s.roundTime);
  $('hostOnly').textContent = isHost ? '(you are the host)' : '(host controls these)';
  $('startBtn').classList.toggle('hidden', !isHost);
  $('startBtn').disabled = ids.length < 2;
  $('startHint').textContent = !isHost ? `Waiting for ${nameOf(state.host)} to start…`
    : ids.length < 2 ? 'Need at least 2 players — allow bots or invite friends.' : 'Every round starts with a game-mode vote.';
}

function renderVote(left) {
  $('voteTimer').textContent = `Voting ends in ${Math.max(0, Math.ceil(left / 1000))}s`;
  const box = $('voteCards');
  // build the cards once per ballot, then update them in place so clicks are never lost
  const sig = state.round + ':' + state.choices.join();
  if (sig !== voteSig) {
    voteSig = sig;
    box.replaceChildren();
    for (const mode of state.choices) {
      const M = MODES[mode];
      const b = document.createElement('button');
      b.className = 'card'; b.dataset.mode = mode;
      const ic = document.createElement('div'); ic.className = 'ic'; ic.textContent = M.icon;
      const h = document.createElement('h4'); h.textContent = M.name;
      const p = document.createElement('p'); p.textContent = M.desc;
      const v = document.createElement('div'); v.className = 'votes';
      const vs = document.createElement('div'); vs.className = 'voters';
      b.append(ic, h, p, v, vs);
      b.onclick = () => castVote(mode);
      box.appendChild(b);
    }
  }
  for (const b of box.children) {
    const mode = b.dataset.mode;
    const voters = Object.entries(state.votes).filter(([, v]) => v === mode).map(([id]) => id);
    b.classList.toggle('sel', (state.votes[myId] || myVote) === mode);
    b.querySelector('.votes').textContent = voters.length ? `${voters.length} vote${voters.length > 1 ? 's' : ''}` : '';
    const vs = b.querySelector('.voters');
    if (vs.dataset.sig !== voters.join()) {
      vs.dataset.sig = voters.join();
      vs.replaceChildren(...voters.map(id => { const s = document.createElement('span'); s.style.background = infoOf(id).color; s.title = nameOf(id); return s; }));
    }
  }
}

function castVote(mode) {
  myVote = mode;
  beep(660, 0.06, 'triangle');
  if (isHost) { state.votes[myId] = mode; sendState(); }
  else send('vote', { id: myId, mode });
}

function renderResults(left) {
  const res = state.results;
  if (!res) return;
  $('resultsTitle').textContent = res.title;
  $('resultsText').textContent = res.text;
  const ol = $('resultsList');
  const sig = JSON.stringify(res.rows);
  if (ol.dataset.sig !== sig) {
    ol.dataset.sig = sig;
    ol.replaceChildren();
    for (const row of res.rows) {
      const li = document.createElement('li');
      const nm = document.createElement('b'); nm.textContent = row.name; nm.style.color = row.color;
      li.append(nm, document.createTextNode(' — ' + row.val));
      ol.appendChild(li);
    }
  }
  $('resultsNext').textContent = `Next vote in ${Math.max(0, Math.ceil(left / 1000))}s`;
  $('toLobbyBtn').classList.toggle('hidden', !isHost);
}

// lobby settings (host only)
$('botsToggle').onchange = e => { if (!isHost) return; state.settings.bots = e.target.checked; lobbySig = ''; sendState(); };
$('botCount').oninput = e => { if (!isHost) return; state.settings.botCount = +e.target.value; $('botCountLabel').textContent = e.target.value; sendState(); };
$('roundTime').onchange = e => { if (!isHost) return; state.settings.roundTime = +e.target.value; sendState(); };
$('startBtn').onclick = () => { if (isHost && participants().length >= 2) startVote(); };
$('toLobbyBtn').onclick = () => { if (isHost) toWaiting(); };
$('leaveBtn').onclick = () => leaveRoom();
$('copyLinkBtn').onclick = async () => {
  const link = location.origin + location.pathname + '#' + room;
  try { await navigator.clipboard.writeText(link); toast('Invite link copied!'); } catch { toast(link); }
};

// ---------- room browser (lobby presence) ----------
function connectLobby() {
  lobbyCh = sb.channel(LOBBY_CHANNEL, { config: { presence: { key: myId } } });
  lobbyCh.on('presence', { event: 'sync' }, renderRoomList).subscribe();
}

function openRooms() {
  if (!lobbyCh) return [];
  const byRoom = new Map();
  for (const metas of Object.values(lobbyCh.presenceState())) {
    for (const m of metas) {
      if (!m.room) continue;
      const code = cleanCode(m.room);
      const prev = byRoom.get(code);
      if (!prev || (m.players || 0) > (prev.players || 0)) byRoom.set(code, { ...m, room: code });
    }
  }
  return [...byRoom.values()].sort((a, b) => (b.players || 0) - (a.players || 0));
}

function renderRoomList() {
  if (room) return;
  const ul = $('roomList');
  const list = openRooms();
  ul.replaceChildren();
  if (!list.length) {
    const li = document.createElement('li'); li.className = 'muted';
    li.textContent = 'No open rooms yet — create one!';
    ul.appendChild(li); return;
  }
  for (const r of list.slice(0, 20)) {
    const li = document.createElement('li');
    const info = document.createElement('span');
    const status = r.phase === 'waiting' ? 'in lobby' : r.mode && MODES[r.mode] ? `playing ${MODES[r.mode].name}` : 'voting';
    info.textContent = `${r.room} · ${String(r.host || '').slice(0, 14)} · ${r.players} 👤 · ${status}`;
    const b = document.createElement('button'); b.className = 'btn small'; b.textContent = 'Join';
    b.onclick = () => joinRoom(r.room);
    li.append(info, b);
    ul.appendChild(li);
  }
}

function updateLobbyTrack() {
  if (!lobbyCh) return;
  if (room && isHost && state) {
    const meta = { room, host: profile.name, players: humanIds().length, phase: state.phase, mode: state.mode };
    const key = JSON.stringify(meta);
    if (key !== lobbyTrackKey) { lobbyTrackKey = key; lobbyCh.track(meta).catch(() => {}); }
  } else if (lobbyTrackKey) {
    lobbyTrackKey = '';
    lobbyCh.untrack().catch(() => {});
  }
}

// ---------- menu ----------
function saveProfile() {
  const n = $('nameInput').value.trim().replace(/\s+/g, ' ').slice(0, 14);
  profile.name = n || profile.name;
  store.set('tuo-name', profile.name);
  store.set('tuo-color', profile.color);
}
function buildMenu() {
  $('nameInput').value = profile.name;
  const cp = $('colorPicker');
  for (const c of COLORS) {
    const b = document.createElement('button');
    b.style.background = c; b.title = c;
    if (c === profile.color) b.classList.add('sel');
    b.onclick = () => { profile.color = c; for (const x of cp.children) x.classList.toggle('sel', x === b); };
    cp.appendChild(b);
  }
  $('quickBtn').onclick = () => {
    const open = openRooms().filter(r => (r.players || 0) < 12);
    joinRoom(open.length ? open[0].room : randomCode());
  };
  $('createBtn').onclick = () => joinRoom(randomCode());
  $('joinBtn').onclick = () => joinRoom($('codeInput').value);
  $('codeInput').onkeydown = e => { if (e.key === 'Enter') joinRoom($('codeInput').value); };
  $('nameInput').onkeydown = e => { if (e.key === 'Enter') $('quickBtn').click(); };
}

// ---------- main loop ----------
let last = now(), lastHud = 0;
function step(t) {
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;
  if (!room) return;
  updateHostStatus();
  updateMe(dt);
  smoothEnts(dt);
  if (isHost && state) hostTick(dt);
  netSend(t);
  detectPhaseChange();
}
let lastFrame = 0;
function frame(t) {
  lastFrame = now();
  step(t);
  render(t);
  if (t - lastHud > 100) { lastHud = t; updateHud(); }
  requestAnimationFrame(frame);
}
// Browsers pause requestAnimationFrame in background tabs; keep the game (and hosting) running anyway
setInterval(() => {
  const t = now();
  if (t - lastFrame < 150) return;
  step(t);
  if (t - lastHud > 100) { lastHud = t; updateHud(); }
}, 50);

buildMenu();
connectLobby();
const hashCode = cleanCode(location.hash.slice(1));
if (hashCode.length >= 3) {
  $('codeInput').value = hashCode;
  if (store.get('tuo-name')) joinRoom(hashCode);
}
requestAnimationFrame(frame);

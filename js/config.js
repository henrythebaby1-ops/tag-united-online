// Supabase project used for realtime multiplayer (Broadcast + Presence).
// The publishable key is meant to be public; it ships in client code.
export const SUPABASE_URL = 'https://ckxwnswjjnefubnsvkhl.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_uHFQykH5MxywiQza5YqLIw_TSHTTIuD';

export const CHANNEL_PREFIX = 'tuo-room-';
export const LOBBY_CHANNEL = 'tuo-lobby';

export const PLAYER_R = 18;
export const SPEED = 230;
export const SPRINT_MULT = 1.5;
export const TAG_DIST = PLAYER_R * 2 + 6;

export const MODES = {
  classic:   { name: 'Classic Tag',    icon: '🏃', desc: 'One player is IT. Tag someone to pass it on. Least time as IT wins.' },
  freeze:    { name: 'Freeze Tag',     icon: '🧊', desc: 'Taggers freeze runners. Touch frozen friends to free them.' },
  infection: { name: 'Infection',      icon: '🧟', desc: 'Tagged players join the infected. Last survivor wins.' },
  potato:    { name: 'Hot Potato',     icon: '🥔', desc: 'Pass the potato before the fuse runs out, or you\'re out.' },
  blackout:  { name: 'Blackout',       icon: '🔦', desc: 'Classic Tag in the dark. You only see what\'s close.' },
  crown:     { name: 'Crown Chase',    icon: '👑', desc: 'Reverse tag: touch the crown holder to steal it. Most crown time wins.' },
  hide:      { name: 'Hide & Seek',    icon: '🙈', desc: 'The seeker counts for 20s while everyone hides. Found players are out.' },
  turbo:     { name: 'Turbo Tag',      icon: '⚡', desc: 'Classic Tag at top speed with unlimited sprint.' },
  zone:      { name: 'Shrinking Zone', icon: '🔴', desc: 'Classic Tag inside a closing circle. Time outside counts against you.' },
  ghost:     { name: 'Ghost Tag',      icon: '👻', desc: 'IT is invisible until they get close. Stay alert!' },
};

// Modes that use the Classic Tag rules (pass IT on, least time as IT wins)
export const CLASSIC_RULES = new Set(['classic', 'blackout', 'turbo', 'zone', 'ghost']);
export const HIDE_MS = 20000;   // Hide & Seek: how long the seeker counts
export const GHOST_R = 210;     // Ghost Tag: how close IT must be to be seen

export function modeSpeed(mode, role) {
  if (mode === 'turbo') return 1.35;
  if (mode === 'crown' && role?.it) return 0.94;
  return 1;
}

// Shrinking Zone: the safe circle shrinks from the whole map to a small ring over the round
export function zoneFor(mode, phase, w, h, msLeft, msTotal) {
  if (mode !== 'zone' || (phase !== 'play' && phase !== 'countdown')) return null;
  const progress = phase === 'play' ? Math.min(1, Math.max(0, 1 - msLeft / msTotal)) : 0;
  const rMax = Math.hypot(w, h) / 2 + 20, rMin = 300;
  return { x: w / 2, y: h / 2, r: rMax - (rMax - rMin) * Math.min(1, progress * 1.25) };
}
export const outsideZone = (z, p) => !!z && Math.hypot(p.x - z.x, p.y - z.y) > z.r;


export const COLORS = ['#ff4d4d', '#ff9f1c', '#ffd23f', '#3ddc84', '#2ec4b6', '#3a86ff', '#8338ec', '#ff5fa2', '#f5f5f5', '#8d6e63'];

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
  classic:   { name: 'Classic Tag', icon: '🏃', desc: 'One player is IT. Tag someone to pass it on. Spend the least time as IT to win.' },
  freeze:    { name: 'Freeze Tag',  icon: '🧊', desc: 'Taggers freeze runners. Touch frozen teammates to free them. Taggers win if everyone freezes.' },
  infection: { name: 'Infection',   icon: '🧟', desc: 'Tagged players join the infected. Be the last survivor standing.' },
  potato:    { name: 'Hot Potato',  icon: '🥔', desc: 'Pass the potato before the fuse runs out. If it blows up on you, you\'re out.' },
  blackout:  { name: 'Blackout',    icon: '🔦', desc: 'Classic Tag in the dark. You can only see what\'s close to you. Hide behind the wall!' },
};

export const COLORS = ['#ff4d4d', '#ff9f1c', '#ffd23f', '#3ddc84', '#2ec4b6', '#3a86ff', '#8338ec', '#ff5fa2', '#f5f5f5', '#8d6e63'];

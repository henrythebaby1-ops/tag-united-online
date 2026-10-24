# Tag United Online

A browser multiplayer tag game. The map has two basketball courts, a playground and a big brick wall to hide behind. Every round starts with a vote on the game mode.

**Play:** https://henrythebaby1-ops.github.io/tag-united-online/

## Game modes
Classic Tag is on every ballot. The two other choices are picked at random from the rest.

| Mode | Rules |
|---|---|
| 🏃 Classic Tag | One player is IT. Tag someone to pass it on. Least time as IT wins. |
| 🧊 Freeze Tag | Taggers freeze runners. Runners unfreeze teammates by touching them. |
| 🧟 Infection | Tagged players join the infected. Last survivor wins. |
| 🥔 Hot Potato | Pass the potato before the fuse runs out, or you're out. |
| 🔦 Blackout | Classic Tag in the dark, with a small vision radius. |

Walls, trees and the slide tower block line of sight, so other players can't see you behind them.

## Controls
- **WASD / arrow keys:** move
- **Shift:** sprint (uses stamina)
- **Touch:** drag on the left side to move, hold ⚡ to sprint

## Rooms & bots
- **Quick Play** joins the busiest open room or creates a new one. You can also create a room and share its code or invite link.
- The room host chooses whether bots are allowed (1–7 bots) and sets the round length.

## How it works
- A static site (HTML, CSS and ES modules) hosted on GitHub Pages. There's no build step.
- Multiplayer runs on **Supabase Realtime**: Presence tracks the room roster and Broadcast carries positions, votes and game state. No database tables are used.
- The longest-connected player acts as host. The host runs the rules, the timers and the bots. If the host leaves, the next player takes over.

Run locally with any static server, e.g. `python3 -m http.server`, then open http://localhost:8000.

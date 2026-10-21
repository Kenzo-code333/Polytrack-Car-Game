# PolyRush Racing

A low-poly 3D arcade racer for the browser, inspired by PolyTrack. Built with [three.js](https://threejs.org/).
There is no build step and there are no image or sound files: textures and sounds are generated in code.

## Play

**Easiest (works on Chromebooks, no terminal):** download `polyrush.html` from this repo and open it in Chrome.
It is the whole game in one file. Rebuild it after code changes with `npm install && npm run build:single`.

**For development**, serve the folder over HTTP, since ES modules can't load from a plain file:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Features

- **5 tracks** you pick yourself: Green Valley, Twisty Forest, Figure-8 Bridge (you drive over yourself), Mountain Pass and Coastal Speedway.
- **4 seasons** for any track. Each one changes the scenery, the weather and the grip:
  - 🌸 Spring: blossom trees, flowers, falling petals
  - ☀️ Summer: sunflowers, the best grip
  - 🍂 Autumn: orange trees, pumpkins, falling leaves, a little slippery
  - ❄️ Winter: snow, snowmen, an icy road, very slippery (snow chains help!)
- **5 AI opponents** on three difficulty levels. You can race 1, 3 or 5 laps.
- **Online races with friends**: create a race, share the 4-letter code, and everyone who opens the game's
  claude.ai link can join. Cars, finishing order, mud hits and oil slicks are synced live.
- **Jumps, bumps and hills**: yellow ramps launch you into the air, bumpy strips make you hop, and every track rolls up and down.
- **Power-ups** from ❓ boxes:
  - 🚀 Speed Boost
  - 🟤 Mud Splash: thrown at the racer ahead. When you get hit, mud covers your screen.
  - 🛡️ Shield
  - 🧲 Coin Magnet
  - 🛢️ Oil Slick
- **Boost pads** on the road.
- **Coins** on the track, plus a coin bonus for your finishing place.
- **Treasure chests** for every win. A chest holds Common or Rare coin rewards, Epic shop parts or Legendary chest-only parts.
- **Garage** with 11 categories and over 60 parts: paint, body, wheels, tires, engine, nitro, spoiler, exhaust flames, underglow, decals and toppers. Performance parts change your top speed, acceleration, handling, grip and nitro.
- Progress (coins, parts, records) is saved in your browser.
- Touch controls on phones and tablets.

## Controls

| Key | Action |
| --- | --- |
| W / ↑ | Accelerate |
| S / ↓ | Brake / reverse |
| A D / ← → | Steer |
| Enter / E | Use power-up |
| ↑ + ← / → + Space | Drift |
| R | Reset car onto the track |
| C | Change camera |
| Esc / P | Pause |
| M | Mute |

## Code layout

| File | What it does |
| --- | --- |
| `js/main.js` | Renderer, screens, game flow, treasure chests |
| `js/race.js` | One race: racers, laps, pickups, power-ups, camera |
| `js/car.js` | Car model built from parts + arcade physics |
| `js/ai.js` | AI drivers |
| `js/track.js` | Track spline, projection queries, road/curb/wall meshes |
| `js/scenery.js` | Sky, terrain, trees, seasonal props, weather |
| `js/data.js` | Maps, seasons, power-ups, parts and stats |
| `js/garage.js`, `js/showroom.js` | Garage UI and 3D showroom |
| `js/hud.js` | In-race HUD, minimap, mud overlay |
| `js/save.js` | Saved profile (localStorage) |
| `js/online.js` | Online lobby and room connection |
| `js/audio.js` | Synthesised sound effects and engine |

## Online play

Online races use the claude.ai viewer's live "room" connection (`js/online.js`), so there's no server to run.
Every player shares their car state as presence, and each race code is its own room. Online play works only
inside the published claude.ai link. Friends need a claude.ai account and access to the link (use its Share menu).
The standalone `polyrush.html` and local copies are single player.

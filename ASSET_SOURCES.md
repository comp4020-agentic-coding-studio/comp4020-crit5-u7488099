# Asset sources

Every external image and sound file used by this prototype, where it came
from, and its license. All files were downloaded and are served locally from
`assets/` — nothing is hotlinked. Fetched 2026-08-25/26.

## Sprites

### Knight, Princess and Dragon 2 — by akylrum (OpenGameArt)

- Source: https://opengameart.org/content/knight-princess-and-dragon-2
- Download: https://opengameart.org/sites/default/files/knightprincessanddragon2.zip
- License: **CC0** (public domain)
- Used from the pack's `MaximumBounds/` frame set (fixed canvas size per
  animation, needed for simple `drawImage` frame-stepping — the pack's other
  folder, `BoundsOfAnimation/`, crops each frame tightly and varies canvas
  size per frame, which isn't usable for a naive sprite loop).
- Files:
  - `assets/sprites/knight/walk_00.png` … `walk_18.png` — 10 frames sampled
    from `Knight-Walk` (20 total in the pack), the knight's travel cycle.
  - `assets/sprites/knight/die_00.png` … `die_12.png` — 5 frames sampled
    from `Knight-Die` (14 total), the death sequence.
  - `assets/sprites/princess/idle_00.png` … `idle_35.png` — 8 frames sampled
    from `Princess-Idle` (40 total); recolored/tinted in code for the
    elderly ending variant, not a separate downloaded asset.
  - `assets/sprites/dragon/idle_00.png` … `idle_35.png` — 8 frames sampled
    from `Dragon-Idle` (40 total), the sleeping cave dragon.
  - `assets/sprites/dragon/attack_00.png` … `attack_12.png` — 5 frames
    sampled from `Dragon-Attack` (14 total), the wake/roar moment.

### Platformer Pack: Medieval Expansion — by Kenney (kenney.nl)

- Source: https://kenney.nl/assets/platformer-pack-medieval-expansion
- License: **CC0 1.0** (license text included in the downloaded zip)
- Individual tiles selected after visually inspecting the full 270-tile
  sheet; this pack is architecture-only (no nature/water/rock elements),
  which is why the environment gap below is hand-drawn instead of pulled
  from a third pack.
- Files (renamed from the pack's numbered `medievalTile_NNN.png`):
  - `assets/sprites/env/window_arch.png` (tile 058) — arched window, Road/Ascent dressing.
  - `assets/sprites/env/archway_dark.png` (tile 083) — dark stone archway, Cave entrance.
  - `assets/sprites/env/door_wood.png` (tile 130) — wood plank door, Ascent tower door.
  - `assets/sprites/env/torch.png` (tile 187) — wall torch, Cave/Ascent lighting.
  - `assets/sprites/env/wall_arch.png` (tile 200) — stone arch corner, castle dressing.
  - `assets/sprites/env/stone_wall.png` (tile 065) — stone wall texture.
  - `assets/sprites/env/stone_floor.png` (tile 260) — stone/plank floor texture.
  - `assets/sprites/env/post_wood.png` (tile 234) — wood fence post, Road/Bridge dressing.
  - `assets/sprites/env/banner_flag.png` (tile 148) — cloth banner on a pole, castle/tower dressing.

### Excluded packs (considered, not used)

- **OpenGameArt "RPG Tileset" (russpuppy)** — downloaded and visually
  inspected: 16×16 blocky pixel art. Rendering style clashes with both the
  KPD2 painted-cartoon look and Kenney's flat-vector look. Not used.
- **Kenney "Graveyard Kit"** — 3D model pack (FBX/OBJ/GLTF), wrong medium
  for a 2D canvas renderer. Not used.
- **Kenney "Background Elements Redux"** — the asset page renders its
  download link client-side and the zip URL could not be resolved in this
  environment; rather than guess at a URL, the parallax sky/hill/mountain
  layers below are hand-drawn instead.

### Hand-drawn / original (not downloaded)

Everything not listed above — sky gradients, hills, mountains, the ravine
and lava glow on Bridge, forest trees/stream/fireflies, cave rock walls and
gold-pile dressing, all crack/glitch/collapse overlays, the tombstone and
skeleton-princess silhouette for the slow ending, and the knight's broken
helmet/shield overlay pieces — are original flat-vector shapes drawn directly
in `render.ts` with `<canvas>` fill/stroke calls, styled to match the two
downloaded packs' saturated color and thick-outline look. These are code,
not image assets, and are called out here so nothing is misrepresented as
downloaded.

## Audio

### RPG Audio — by Kenney (kenney.nl)

- Source: https://kenney.nl/assets/rpg-audio
- License: **CC0 1.0**
- `assets/audio/door-creak.ogg` ← `creak1.ogg` — Ascent's tower door.

### Impact Sounds — by Kenney (kenney.nl)

- Source: https://kenney.nl/assets/impact-sounds
- License: **CC0 1.0**
- `assets/audio/thud.ogg` ← `impactWood_light_000.ogg` — wrong-key hit.
- `assets/audio/clink.ogg` ← `impactMetal_medium_000.ogg` — helmet/shield break.
- `assets/audio/crack-wood.ogg` ← `impactWood_heavy_001.ogg` — Backspace damage stage 2 (crack overlay appears).
- `assets/audio/crack-stone.ogg` ← `impactGlass_heavy_003.ogg` — Backspace damage stage 3 (world breaks apart).

### UI Audio — by Kenney (kenney.nl)

- Source: https://kenney.nl/assets/ui-audio
- License: **CC0 1.0**
- `assets/audio/click-1.ogg` … `click-4.ogg` ← `click1.ogg` … `click4.ogg` — correct-key tick variants (randomized, kept quiet).
- `assets/audio/ending-sting.ogg` ← `switch32.ogg` — repurposed as the short sting played on reaching an ending.

### CC0 Deep Monster Roar — by trazzz123 (OpenGameArt)

- Source: https://opengameart.org/content/cc0-deep-monster-roar
- Download: https://opengameart.org/sites/default/files/monster_roar.wav
- License: **CC0** (public domain)
- `assets/audio/dragon-growl.wav` — the dragon waking/attacking in the Cave.
  Kept as the original `.wav` (1.3 MB): no audio conversion tool (`ffmpeg`
  or similar) was available in this environment to re-encode it to a
  smaller `.ogg`.

### Catching fire — by themightyglider (OpenGameArt)

- Source: https://opengameart.org/content/catching-fire
- Download: https://opengameart.org/sites/default/files/flame_0.ogg
- License: **CC0** (public domain)
- `assets/audio/fire-whoosh.ogg` — Bridge's lava glow and the Cave dragon-fire death.

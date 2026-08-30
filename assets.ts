// Local sprite/audio asset URLs and small loading helpers. Every file here
// is served from assets/ (see ASSET_SOURCES.md for where each came from and
// its license) — nothing is hotlinked. render.ts and audio.ts read from this
// module instead of importing raw paths themselves.

function frames(glob: Record<string, unknown>): string[] {
  return Object.keys(glob)
    .sort()
    .map((key) => (glob[key] as { default: string }).default);
}

function one(glob: Record<string, unknown>): string {
  const keys = Object.keys(glob);
  return (glob[keys[0]] as { default: string }).default;
}

export const KNIGHT_WALK = frames(import.meta.glob("./assets/sprites/knight/walk_*.png", { eager: true }));
export const KNIGHT_DIE = frames(import.meta.glob("./assets/sprites/knight/die_*.png", { eager: true }));
export const PRINCESS_IDLE = frames(import.meta.glob("./assets/sprites/princess/idle_*.png", { eager: true }));
export const DRAGON_IDLE = frames(import.meta.glob("./assets/sprites/dragon/idle_*.png", { eager: true }));
export const DRAGON_ATTACK = frames(import.meta.glob("./assets/sprites/dragon/attack_*.png", { eager: true }));

export const ENV = {
  windowArch: one(import.meta.glob("./assets/sprites/env/window_arch.png", { eager: true })),
  archwayDark: one(import.meta.glob("./assets/sprites/env/archway_dark.png", { eager: true })),
  doorWood: one(import.meta.glob("./assets/sprites/env/door_wood.png", { eager: true })),
  torch: one(import.meta.glob("./assets/sprites/env/torch.png", { eager: true })),
  wallArch: one(import.meta.glob("./assets/sprites/env/wall_arch.png", { eager: true })),
  stoneWall: one(import.meta.glob("./assets/sprites/env/stone_wall.png", { eager: true })),
  stoneFloor: one(import.meta.glob("./assets/sprites/env/stone_floor.png", { eager: true })),
  postWood: one(import.meta.glob("./assets/sprites/env/post_wood.png", { eager: true })),
  bannerFlag: one(import.meta.glob("./assets/sprites/env/banner_flag.png", { eager: true })),
};

export const AUDIO = {
  click: frames(import.meta.glob("./assets/audio/click-*.ogg", { eager: true })),
  thud: one(import.meta.glob("./assets/audio/thud.ogg", { eager: true })),
  clink: one(import.meta.glob("./assets/audio/clink.ogg", { eager: true })),
  crackWood: one(import.meta.glob("./assets/audio/crack-wood.ogg", { eager: true })),
  crackStone: one(import.meta.glob("./assets/audio/crack-stone.ogg", { eager: true })),
  fireWhoosh: one(import.meta.glob("./assets/audio/fire-whoosh.ogg", { eager: true })),
  dragonGrowl: one(import.meta.glob("./assets/audio/dragon-growl.wav", { eager: true })),
  doorCreak: one(import.meta.glob("./assets/audio/door-creak.ogg", { eager: true })),
  endingSting: one(import.meta.glob("./assets/audio/ending-sting.ogg", { eager: true })),
};

const imageCache = new Map<string, HTMLImageElement>();

/** Kicks off the image load immediately (images aren't gated by autoplay policy) and caches the element. */
export function loadImage(url: string): HTMLImageElement {
  let img = imageCache.get(url);
  if (!img) {
    img = new Image();
    img.src = url;
    imageCache.set(url, img);
  }
  return img;
}

export function loadImages(urls: string[]): HTMLImageElement[] {
  return urls.map(loadImage);
}

/** Whether an image has actually finished decoding — draw calls should skip it otherwise. */
export function isReady(img: HTMLImageElement): boolean {
  return img.complete && img.naturalWidth > 0;
}

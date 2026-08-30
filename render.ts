// The game-world illustration: a layered 2D side-view scene (parallax sky
// and hills, a chapter-specific set piece, sprite-animated actors, and an
// effects layer) that plays out as the player types. Reads GameState + a
// `now` timestamp only — it owns no game logic, just how the current state
// looks. The small amount of local module state it keeps (first-seen-at
// clocks for fades) is purely presentation bookkeeping, not anything
// gameState.ts needs to know about. See ASSET_SOURCES.md for sprite/image
// provenance.

import type { GameState, Phase } from "./gameState.ts";
import { sentencesFor } from "./gameState.ts";
import { FALLING_LETTER_LIFETIME_MS } from "./config.ts";
import { KNIGHT_WALK, KNIGHT_DIE, PRINCESS_IDLE, DRAGON_IDLE, DRAGON_ATTACK, ENV, loadImage, loadImages, isReady } from "./assets.ts";

// --- Palette -----------------------------------------------------------
// Deliberately not Crit 4's sepia/parchment: saturated in-world colour,
// cool ink for text/UI chrome (see styles.css for the manuscript strip).
const INK = "#1b1e24";
const FIRE = "#e8622f";
const EMBER = "#f2a34d";
const GOLD = "#d9b34a";
const HELMET_COLOR = "#8a97a8";
const SHIELD_COLOR = "#6f5a3a";
const BONE = "#e9e6d8";

const CAMERA_PUNCH_MS = 110;
const BREAK_FRAGMENT_MS = 350;
const WALK_FRAME_MS = 90;
const DIE_FRAME_MS = 130;
const IDLE_FRAME_MS = 160;

// --- Presentation-only bookkeeping (not game state) ---------------------
const BEAT_FADE_MS = 500;
const flagFirstSeenAt = new Map<string, number>();
const phaseEnteredAt = new Map<Phase, number>();
let lastFinalLine: string | null = null;
let finalLineSetAt = 0;

/**
 * Where the knight was last actually drawn on screen. Set on every
 * drawKnightActor call during a living phase; never touched by the death
 * draws, so it's automatically frozen at wherever he stood the instant he
 * dies — the falling letter and the death sprite both read this instead of
 * guessing/recentring, so death happens in place in every chapter.
 */
let lastKnightPose: { x: number; groundY: number; scale: number; flip: boolean } | null = null;

function flagOpacity(state: GameState, now: number, flag: string): number {
  if (!state.worldFlags[flag]) return 0;
  let seenAt = flagFirstSeenAt.get(flag);
  if (seenAt === undefined) {
    seenAt = now;
    flagFirstSeenAt.set(flag, now);
  }
  return Math.min(1, (now - seenAt) / BEAT_FADE_MS);
}

function phaseElapsed(state: GameState, now: number): number {
  let enteredAt = phaseEnteredAt.get(state.phase);
  if (enteredAt === undefined) {
    enteredAt = now;
    phaseEnteredAt.set(state.phase, enteredAt);
  }
  return now - enteredAt;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function withAlpha(ctx: CanvasRenderingContext2D, alpha: number, draw: () => void): void {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  draw();
  ctx.restore();
}

/** How far through the current phase's sentences the player has typed, 0..1. Drives the knight's left-to-right travel and background drift. */
function chapterProgress(state: GameState): number {
  const sentences = sentencesFor(state.phase);
  if (!sentences) return 1;
  let typed = 0;
  let total = 0;
  for (let i = 0; i < sentences.length; i++) {
    const len = sentences[i].text.length;
    total += len;
    if (i < state.sentenceIndex) typed += len;
    else if (i === state.sentenceIndex) typed += Math.min(state.charIndex, len);
  }
  return total === 0 ? 1 : clamp01(typed / total);
}

function travelX(width: number, progress: number, from = 0.12, to = 0.62): number {
  return width * (from + (to - from) * progress);
}

// --- Sprite frame stepping ----------------------------------------------

function frameAt(urls: string[], now: number, msPerFrame: number): HTMLImageElement | null {
  if (urls.length === 0) return null;
  const idx = Math.floor(now / msPerFrame) % urls.length;
  const img = loadImage(urls[idx]);
  return isReady(img) ? img : null;
}

function frameAtAge(urls: string[], age: number, msPerFrame: number, hold = true): HTMLImageElement | null {
  if (urls.length === 0) return null;
  const raw = Math.floor(Math.max(0, age) / msPerFrame);
  const idx = hold ? Math.min(urls.length - 1, raw) : raw % urls.length;
  const img = loadImage(urls[idx]);
  return isReady(img) ? img : null;
}

loadImages(KNIGHT_WALK);
loadImages(KNIGHT_DIE);
loadImages(PRINCESS_IDLE);
loadImages(DRAGON_IDLE);
loadImages(DRAGON_ATTACK);
for (const url of Object.values(ENV)) loadImage(url);

/** Draws an image anchored at its bottom-centre, scaled to a target on-screen height. */
function drawSprite(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  x: number,
  groundY: number,
  targetHeight: number,
  opts: { flip?: boolean; filter?: string } = {},
): void {
  if (!img) return;
  const scale = targetHeight / img.naturalHeight;
  const w = img.naturalWidth * scale;
  ctx.save();
  ctx.translate(x, groundY);
  if (opts.flip) ctx.scale(-1, 1);
  if (opts.filter) ctx.filter = opts.filter;
  ctx.drawImage(img, -w / 2, -targetHeight, w, targetHeight);
  ctx.restore();
}

function drawIcon(ctx: CanvasRenderingContext2D, img: string, x: number, y: number, size: number): void {
  const el = loadImage(img);
  if (!isReady(el)) return;
  const scale = size / Math.max(el.naturalWidth, el.naturalHeight);
  const w = el.naturalWidth * scale;
  const h = el.naturalHeight * scale;
  ctx.drawImage(el, x - w / 2, y - h / 2, w, h);
}

// --- Sky / ground --------------------------------------------------------

function drawSky(ctx: CanvasRenderingContext2D, width: number, height: number, top: string, bottom: string): void {
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
}

function drawHillLayer(
  ctx: CanvasRenderingContext2D,
  width: number,
  horizon: number,
  drift: number,
  color: string,
  amplitude: number,
  bumps: number,
): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  const step = width / bumps;
  for (let i = 0; i <= bumps + 1; i++) {
    const x = i * step - (drift % step);
    const y = horizon - amplitude * (0.4 + 0.6 * Math.abs(Math.sin(i * 1.9 + drift * 0.0015)));
    ctx.lineTo(x, y);
  }
  ctx.lineTo(width + step, horizon + amplitude);
  ctx.lineTo(-step, horizon + amplitude);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawGround(ctx: CanvasRenderingContext2D, width: number, height: number, horizon: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(0, horizon, width, height - horizon);
}

// --- Actors ---------------------------------------------------------------

type EquipStage = "intact" | "cracked" | "broken";

/** Five damage stages map onto two equipment items: helmet cracks (1), then
 * breaks off (2); shield cracks (3), then breaks off (4); stage 5 is death,
 * handled by the death phases rather than this function. */
function helmetStage(damage: number): EquipStage {
  return damage >= 2 ? "broken" : damage >= 1 ? "cracked" : "intact";
}

function shieldStage(damage: number): EquipStage {
  return damage >= 4 ? "broken" : damage >= 3 ? "cracked" : "intact";
}

/** Maps a normalized point on the knight sprite's own 660x545 box (nx,ny in
 * 0..1, matching drawSprite's bottom-center anchor/scale convention) to a
 * screen position. */
function spriteLocalToScreen(
  x: number,
  groundY: number,
  scale: number,
  flip: boolean,
  nx: number,
  ny: number,
): { x: number; y: number } {
  const localDx = scale * (660 / 545) * (nx - 0.5);
  return { x: x + (flip ? -localDx : localDx), y: groundY + scale * (ny - 1) };
}

/** Helmet/shield anchor points derived from the knight's actual rendered
 * position/scale, so every chapter and viewport agrees — and so the falling
 * killing letter (drawFallingLetter) can target the same point on his head. */
function equipmentAnchorsForKnight(
  x: number,
  groundY: number,
  scale: number,
  flip: boolean,
): { helmet: { x: number; y: number }; shield: { x: number; y: number } } {
  return {
    helmet: spriteLocalToScreen(x, groundY, scale, flip, 0.424, 0.358),
    shield: spriteLocalToScreen(x, groundY, scale, flip, 0.27, 0.66),
  };
}

function drawHelmet(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, cracked: boolean): void {
  const r = scale * 0.1;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = HELMET_COLOR;
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, scale * 0.012);
  ctx.beginPath();
  ctx.arc(0, 0, r, Math.PI, 0);
  ctx.lineTo(r * 1.15, r * 0.18);
  ctx.lineTo(-r * 1.15, r * 0.18);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.1);
  ctx.lineTo(-r * 0.12, r * 0.35);
  ctx.lineTo(r * 0.12, r * 0.35);
  ctx.closePath();
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = Math.max(1, scale * 0.01);
  ctx.beginPath();
  ctx.moveTo(-r * 0.45, -r * 0.55);
  ctx.lineTo(-r * 0.15, -r * 0.05);
  ctx.stroke();
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.arc(0, r * 0.05, r, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.fill();
  if (cracked) {
    // Dark, not the shield-crack's white: the helmet's own fill is already
    // light gray, so a white crack line washes out against it and reads as
    // just another highlight streak instead of damage.
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1, scale * 0.016);
    ctx.beginPath();
    ctx.moveTo(-r * 0.5, -r * 0.7);
    ctx.lineTo(-r * 0.1, -r * 0.1);
    ctx.lineTo(-r * 0.35, r * 0.2);
    ctx.moveTo(r * 0.1, -r * 0.6);
    ctx.lineTo(r * 0.3, -r * 0.1);
    ctx.stroke();
  }
  ctx.restore();
}

function drawShield(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, cracked: boolean): void {
  const w = scale * 0.16;
  const h = scale * 0.24;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = SHIELD_COLOR;
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, scale * 0.012);
  ctx.beginPath();
  ctx.moveTo(-w / 2, -h * 0.3);
  ctx.quadraticCurveTo(-w / 2, -h * 0.55, 0, -h * 0.55);
  ctx.quadraticCurveTo(w / 2, -h * 0.55, w / 2, -h * 0.3);
  ctx.lineTo(w / 2, h * 0.15);
  ctx.quadraticCurveTo(w / 2, h * 0.4, 0, h * 0.55);
  ctx.quadraticCurveTo(-w / 2, h * 0.4, -w / 2, h * 0.15);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = Math.max(1, scale * 0.008);
  ctx.stroke();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = Math.max(1, scale * 0.014);
  ctx.beginPath();
  ctx.moveTo(0, -h * 0.15);
  ctx.lineTo(0, h * 0.15);
  ctx.moveTo(-w * 0.12, 0);
  ctx.lineTo(w * 0.12, 0);
  ctx.stroke();
  if (cracked) {
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = Math.max(1, scale * 0.012);
    ctx.beginPath();
    ctx.moveTo(-w * 0.3, -h * 0.4);
    ctx.lineTo(w * 0.05, 0);
    ctx.lineTo(-w * 0.15, h * 0.35);
    ctx.stroke();
  }
  ctx.restore();
}

/** 2-3 irregular fragments that fly outward/down when a piece first breaks,
 * then settle at rest near the anchor — the broken state stays visible
 * (no helmet/no shield) rather than the animation vanishing once it ends. */
function drawEquipmentDebris(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  color: string,
  sinceHit: number,
): void {
  const settled = sinceHit >= BREAK_FRAGMENT_MS;
  const t = clamp01(sinceHit / BREAK_FRAGMENT_MS);
  const pieces = 3;
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, scale * 0.008);
  for (let i = 0; i < pieces; i++) {
    const angle = (i / pieces) * Math.PI * 2 + i * 1.3;
    const flyRadius = scale * (0.1 + i * 0.03);
    const restRadius = scale * (0.06 + i * 0.02);
    const dist = settled ? restRadius : t * flyRadius;
    const dx = Math.cos(angle) * dist;
    const dy = settled ? scale * 0.1 + i * scale * 0.015 : Math.sin(angle) * dist * 0.4 + t * t * scale * 0.12;
    const rot = angle + (settled ? 0.4 : t * 2.2);
    const size = scale * (0.04 + i * 0.012);
    ctx.save();
    ctx.translate(x + dx, y + dy);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.moveTo(-size, -size * 0.6);
    ctx.lineTo(size * 0.8, -size * 0.3);
    ctx.lineTo(size * 0.5, size * 0.7);
    ctx.lineTo(-size * 0.6, size * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

/** The knight sprite plus helmet/shield overlays that crack then break off
 * in stages as knightDamage rises 0..5 (stage 5 is death, handled by the
 * death phases instead). Also records lastKnightPose so the falling letter
 * and the death draw can target exactly where he's actually standing. */
function drawKnightActor(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  scale: number,
  state: GameState,
  now: number,
  opts: { flip?: boolean } = {},
): void {
  const flip = !!opts.flip;
  lastKnightPose = { x, groundY, scale, flip };

  const img = frameAt(KNIGHT_WALK, now, WALK_FRAME_MS);
  drawSprite(ctx, img, x, groundY, scale, opts);

  const anchors = equipmentAnchorsForKnight(x, groundY, scale, flip);
  const sinceHit = state.lastDamageAt !== null ? now - state.lastDamageAt : Infinity;

  const helmet = helmetStage(state.knightDamage);
  if (helmet === "broken") {
    drawEquipmentDebris(ctx, anchors.helmet.x, anchors.helmet.y, scale, HELMET_COLOR, sinceHit);
  } else {
    drawHelmet(ctx, anchors.helmet.x, anchors.helmet.y, scale, helmet === "cracked");
  }

  const shield = shieldStage(state.knightDamage);
  if (shield === "broken") {
    drawEquipmentDebris(ctx, anchors.shield.x, anchors.shield.y, scale, SHIELD_COLOR, sinceHit);
  } else {
    drawShield(ctx, anchors.shield.x, anchors.shield.y, scale, shield === "cracked");
  }
}

function drawPrincessActor(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  scale: number,
  now: number,
  variant: "young" | "elderly",
): void {
  const img = frameAt(PRINCESS_IDLE, now, IDLE_FRAME_MS);
  const filter = variant === "elderly" ? "grayscale(0.55) brightness(0.82) sepia(0.15)" : undefined;
  drawSprite(ctx, img, x, groundY, scale, { filter });
}

/** The slow ending never has the knight arrive in time: a bone-white silhouette and a tombstone stand where the princess would have. */
function drawSkeletonPrincess(ctx: CanvasRenderingContext2D, x: number, groundY: number, scale: number): void {
  ctx.save();
  ctx.translate(x, groundY);
  ctx.fillStyle = "#2a2a30";
  ctx.beginPath();
  ctx.roundRect(-scale * 0.22, -scale * 0.75, scale * 0.44, scale * 0.75, scale * 0.08);
  ctx.fill();
  ctx.fillStyle = BONE;
  ctx.font = `${Math.round(scale * 0.14)}px Georgia, serif`;
  ctx.textAlign = "center";
  ctx.fillText("R.I.P.", 0, -scale * 0.4);

  ctx.strokeStyle = BONE;
  ctx.fillStyle = BONE;
  ctx.lineWidth = Math.max(1.5, scale * 0.03);
  ctx.beginPath();
  ctx.arc(scale * 0.35, -scale * 0.95, scale * 0.08, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(scale * 0.35, -scale * 0.85);
  ctx.lineTo(scale * 0.35, -scale * 0.55);
  ctx.moveTo(scale * 0.35, -scale * 0.55);
  ctx.lineTo(scale * 0.25, -scale * 0.4);
  ctx.moveTo(scale * 0.35, -scale * 0.55);
  ctx.lineTo(scale * 0.45, -scale * 0.4);
  ctx.stroke();
  ctx.restore();
}

function drawDragonActor(ctx: CanvasRenderingContext2D, x: number, groundY: number, scale: number, now: number, awake: boolean): void {
  const img = awake ? frameAt(DRAGON_ATTACK, now, WALK_FRAME_MS) : frameAt(DRAGON_IDLE, now, IDLE_FRAME_MS);
  drawSprite(ctx, img, x, groundY, scale, { flip: true });
  if (awake) {
    ctx.save();
    ctx.strokeStyle = FIRE;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x - scale * 0.42, groundY - scale * 0.55);
    ctx.quadraticCurveTo(x - scale * 0.75, groundY - scale * 0.5, x - scale * 0.95, groundY - scale * 0.4);
    ctx.stroke();
    ctx.restore();
  }
}

// --- Effects layer --------------------------------------------------------

function cameraPunch(state: GameState, now: number): { dy: number; scale: number } {
  if (state.lastDamageAt === null) return { dy: 0, scale: 1 };
  const elapsed = now - state.lastDamageAt;
  if (elapsed >= CAMERA_PUNCH_MS || elapsed < 0) return { dy: 0, scale: 1 };
  const kick = Math.sin((elapsed / CAMERA_PUNCH_MS) * Math.PI);
  return { dy: kick * 7, scale: 1 + kick * 0.025 };
}

/**
 * Falls onto wherever the knight is actually standing (his own head
 * anchor via lastKnightPose), not a chapter-agnostic guess — this is what
 * makes the wrong/killing letter visibly land on him in every chapter,
 * with no recenter/teleport for the fatal hit.
 */
function drawFallingLetter(ctx: CanvasRenderingContext2D, width: number, height: number, state: GameState, now: number): void {
  const letter = state.fallingLetter;
  if (!letter) return;
  const age = now - letter.at;
  if (age > FALLING_LETTER_LIFETIME_MS) return;
  const t = age / FALLING_LETTER_LIFETIME_MS;
  const eased = 1 - (1 - t) * (1 - t);

  const target = lastKnightPose
    ? equipmentAnchorsForKnight(lastKnightPose.x, lastKnightPose.groundY, lastKnightPose.scale, lastKnightPose.flip).helmet
    : { x: travelX(width, chapterProgress(state)), y: height * 0.82 };
  const x = target.x;
  const groundY = target.y;
  const startY = Math.min(height * 0.08, groundY - height * 0.35);
  const y = startY + eased * (groundY - startY);

  ctx.save();
  ctx.globalAlpha *= Math.min(1, (1 - t) * 1.6);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(x, groundY + Math.round(height * 0.03), Math.round(height * 0.035), Math.round(height * 0.01), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = FIRE;
  ctx.font = `bold ${Math.round(height * 0.07)}px Georgia, serif`;
  ctx.textAlign = "center";
  ctx.fillText(letter.char.toUpperCase(), x, y);
  ctx.restore();

  if (t > 0.75) {
    const puff = (t - 0.75) / 0.25;
    ctx.save();
    ctx.globalAlpha *= (1 - puff) * 0.5;
    ctx.strokeStyle = EMBER;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, groundY, height * 0.015 + puff * height * 0.03, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawEndingVignette(ctx: CanvasRenderingContext2D, width: number, height: number, state: GameState, now: number): void {
  const isDeath = state.phase === "deathKnight" || state.phase === "deathCave";
  if (!isDeath) return;
  const progress = clamp01(phaseElapsed(state, now) / 900);
  ctx.save();
  ctx.fillStyle = `rgba(8,6,5,${0.6 * progress})`;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

// --- Chapter set pieces -----------------------------------------------------

function drawTower(ctx: CanvasRenderingContext2D, x: number, baseY: number, scale: number, opts: { open?: number } = {}): void {
  ctx.save();
  ctx.translate(x, baseY);
  ctx.fillStyle = "#3a3f4a";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.fillRect(-scale * 0.28, -scale, scale * 0.56, scale);
  ctx.strokeRect(-scale * 0.28, -scale, scale * 0.56, scale);
  ctx.beginPath();
  ctx.moveTo(-scale * 0.34, -scale);
  ctx.lineTo(0, -scale * 1.32);
  ctx.lineTo(scale * 0.34, -scale);
  ctx.closePath();
  ctx.fillStyle = "#5a2f33";
  ctx.fill();
  ctx.stroke();

  for (let i = 0; i < 3; i++) {
    drawIcon(ctx, ENV.windowArch, 0, -scale * (0.28 + i * 0.28), scale * 0.16);
  }
  ctx.restore();

  if (opts.open !== undefined) {
    ctx.save();
    ctx.translate(x, baseY - scale * 0.06);
    ctx.rotate(-opts.open * 0.9);
    drawIcon(ctx, ENV.doorWood, scale * 0.12, -scale * 0.08, scale * 0.26);
    ctx.restore();
  } else {
    drawIcon(ctx, ENV.doorWood, x, baseY - scale * 0.08, scale * 0.24);
  }
}

function drawCastle(ctx: CanvasRenderingContext2D, x: number, baseY: number, scale: number): void {
  ctx.save();
  ctx.translate(x, baseY);
  ctx.fillStyle = "#494f5c";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.fillRect(-scale * 0.5, -scale * 0.85, scale, scale * 0.85);
  ctx.strokeRect(-scale * 0.5, -scale * 0.85, scale, scale * 0.85);
  const crenellations = 5;
  for (let i = 0; i < crenellations; i++) {
    const cx = -scale * 0.5 + (i / crenellations) * scale;
    ctx.fillRect(cx, -scale * 1.0, scale / crenellations / 1.8, scale * 0.15);
  }
  drawIcon(ctx, ENV.wallArch, -scale * 0.15, -scale * 0.4, scale * 0.3);
  drawIcon(ctx, ENV.windowArch, scale * 0.18, -scale * 0.45, scale * 0.2);
  drawIcon(ctx, ENV.bannerFlag, scale * 0.42, -scale * 1.05, scale * 0.3);
  ctx.restore();
}

function drawMountains(ctx: CanvasRenderingContext2D, width: number, horizon: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(width * 0.52, horizon);
  ctx.lineTo(width * 0.66, horizon - 70);
  ctx.lineTo(width * 0.78, horizon);
  ctx.lineTo(width * 0.7, horizon);
  ctx.lineTo(width * 0.85, horizon - 55);
  ctx.lineTo(width * 0.98, horizon);
  ctx.closePath();
  ctx.fill();
}

function drawRoad(ctx: CanvasRenderingContext2D, width: number, height: number, state: GameState, now: number): void {
  const horizon = height * 0.66;
  drawSky(ctx, width, height, "#a9d6e8", "#eef1d8");
  drawHillLayer(ctx, width, horizon, now * 0.01, "#cfe0b8", height * 0.05, 5);
  drawGround(ctx, width, height, horizon, "#8fae6a");
  ctx.fillStyle = "#c9b385";
  ctx.beginPath();
  ctx.moveTo(width * 0.47, horizon);
  ctx.lineTo(width * 0.3, height * 0.98);
  ctx.lineTo(width * 0.72, height * 0.98);
  ctx.lineTo(width * 0.53, horizon);
  ctx.closePath();
  ctx.fill();

  withAlpha(ctx, flagOpacity(state, now, "road:kingdom"), () => drawCastle(ctx, width * 0.14, horizon, height * 0.2));
  withAlpha(ctx, flagOpacity(state, now, "road:tower"), () => drawTower(ctx, width * 0.88, horizon, height * 0.24));
  withAlpha(ctx, flagOpacity(state, now, "road:mountains"), () => drawMountains(ctx, width, horizon, "#a7c4d8"));

  for (let i = 0; i < 3; i++) {
    drawIcon(ctx, ENV.postWood, width * (0.25 + i * 0.1), horizon + 10, height * 0.08);
  }

  drawKnightActor(ctx, travelX(width, chapterProgress(state)), height * 0.86, height * 0.22, state, now);
  withAlpha(ctx, flagOpacity(state, now, "road:princess"), () =>
    drawPrincessActor(ctx, width * 0.88, horizon - height * 0.03, height * 0.14, now, "young"),
  );
}

function drawBridge(ctx: CanvasRenderingContext2D, width: number, height: number, state: GameState, now: number): void {
  const horizon = height * 0.6;
  drawSky(ctx, width, height, "#3a2440", "#d9642f");
  drawHillLayer(ctx, width, horizon, now * 0.008, "#2e1c33", height * 0.06, 4);

  ctx.fillStyle = "#241a20";
  ctx.beginPath();
  ctx.moveTo(0, horizon + 30);
  ctx.lineTo(width * 0.4, horizon);
  ctx.lineTo(width * 0.4, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(width, horizon + 30);
  ctx.lineTo(width * 0.6, horizon);
  ctx.lineTo(width * 0.6, height);
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fill();

  withAlpha(ctx, flagOpacity(state, now, "bridge:fire"), () => {
    const gradient = ctx.createLinearGradient(0, horizon, 0, height);
    gradient.addColorStop(0, "rgba(232,98,47,0.15)");
    gradient.addColorStop(1, "rgba(232,98,47,0.75)");
    ctx.fillStyle = gradient;
    ctx.fillRect(width * 0.4, horizon, width * 0.2, height - horizon);
    ctx.strokeStyle = FIRE;
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const fx = width * (0.44 + i * 0.03);
      const flicker = Math.sin(now / 120 + i * 2) * 6;
      ctx.beginPath();
      ctx.moveTo(fx, height * 0.98);
      ctx.quadraticCurveTo(fx + flicker, height * 0.85, fx, height * 0.72);
      ctx.stroke();
    }
  });

  withAlpha(ctx, flagOpacity(state, now, "bridge:bridge"), () => {
    ctx.strokeStyle = "#3a2e22";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(width * 0.4, horizon);
    ctx.lineTo(width * 0.6, horizon);
    ctx.stroke();
    for (let i = 0; i <= 8; i++) {
      const px = width * 0.4 + (i / 8) * width * 0.2;
      drawIcon(ctx, ENV.postWood, px, horizon + 8, height * 0.05);
    }
    ctx.beginPath();
    ctx.strokeStyle = "#5a4530";
    ctx.moveTo(width * 0.4, horizon - 26);
    ctx.quadraticCurveTo(width * 0.5, horizon - 38, width * 0.6, horizon - 26);
    ctx.stroke();
  });

  withAlpha(ctx, flagOpacity(state, now, "bridge:stepped"), () =>
    drawKnightActor(ctx, width * 0.4 + chapterProgress(state) * width * 0.2, horizon - 4, height * 0.2, state, now),
  );
  if (flagOpacity(state, now, "bridge:stepped") === 0) {
    drawKnightActor(ctx, width * 0.34, horizon + height * 0.02, height * 0.2, state, now);
  }
}

function drawFork(ctx: CanvasRenderingContext2D, width: number, height: number, state: GameState, now: number): void {
  const horizon = height * 0.66;
  drawSky(ctx, width, height, "#2c2140", "#5a3d55");
  drawHillLayer(ctx, width, horizon, now * 0.006, "#3d2d47", height * 0.05, 5);
  drawGround(ctx, width, height, horizon, "#4a5c3f");

  ctx.fillStyle = "#c9b385";
  ctx.beginPath();
  ctx.moveTo(width * 0.5, height * 0.98);
  ctx.lineTo(width * 0.46, horizon + 6);
  ctx.lineTo(width * 0.26, horizon - 26);
  ctx.lineTo(width * 0.3, horizon - 14);
  ctx.lineTo(width * 0.5, horizon + 6);
  ctx.lineTo(width * 0.7, horizon - 14);
  ctx.lineTo(width * 0.74, horizon - 26);
  ctx.lineTo(width * 0.54, horizon + 6);
  ctx.closePath();
  ctx.fill();

  withAlpha(ctx, flagOpacity(state, now, "fork:divided"), () => {
    ctx.strokeStyle = "#4a3a2a";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(width * 0.5, height * 0.56);
    ctx.lineTo(width * 0.5, height * 0.82);
    ctx.stroke();
    drawSignArrow(ctx, width * 0.5, height * 0.6, -1, "FOREST", state.forkChoicePending);
    drawSignArrow(ctx, width * 0.5, height * 0.68, 1, "CAVE", state.forkChoicePending);
  });

  drawKnightActor(ctx, width * 0.5, height * 0.88, height * 0.2, state, now);

  if (state.forkChoicePending) {
    ctx.save();
    ctx.fillStyle = BONE;
    ctx.font = `${Math.round(height * 0.032)}px Georgia, serif`;
    ctx.textAlign = "center";
    ctx.fillText("Press F for the forest, or C for the cave.", width * 0.5, height * 0.18);
    ctx.restore();
  }

  if (state.forkResolvingWord !== null) {
    ctx.save();
    ctx.fillStyle = BONE;
    ctx.font = `bold ${Math.round(height * 0.055)}px Georgia, serif`;
    ctx.textAlign = "center";
    ctx.fillText(state.forkResolvingWord, width * 0.5, height * 0.28);
    ctx.restore();
  }
}

function drawSignArrow(ctx: CanvasRenderingContext2D, x: number, y: number, dir: -1 | 1, label: string, dimmed: boolean): void {
  ctx.save();
  ctx.globalAlpha *= dimmed ? 0.45 : 1;
  drawIcon(ctx, ENV.bannerFlag, x + dir * 34, y, 46);
  ctx.fillStyle = BONE;
  ctx.font = "13px Georgia, serif";
  ctx.textAlign = dir === -1 ? "right" : "left";
  ctx.fillText(label, x + dir * 58, y + 4);
  ctx.restore();
}

function drawTree(ctx: CanvasRenderingContext2D, x: number, baseY: number, scale: number): void {
  ctx.save();
  ctx.fillStyle = "#2e4a2c";
  ctx.fillRect(x - scale * 0.03, baseY - scale * 0.35, scale * 0.06, scale * 0.35);
  ctx.beginPath();
  ctx.moveTo(x - scale * 0.32, baseY - scale * 0.3);
  ctx.lineTo(x, baseY - scale * 1.05);
  ctx.lineTo(x + scale * 0.32, baseY - scale * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#3a5f37";
  ctx.beginPath();
  ctx.moveTo(x - scale * 0.24, baseY - scale * 0.55);
  ctx.lineTo(x, baseY - scale * 1.15);
  ctx.lineTo(x + scale * 0.24, baseY - scale * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawForest(ctx: CanvasRenderingContext2D, width: number, height: number, state: GameState, now: number): void {
  const horizon = height * 0.68;
  drawSky(ctx, width, height, "#0d1f1a", "#1f3d2c");
  drawGround(ctx, width, height, horizon, "#213a24");

  withAlpha(ctx, Math.max(flagOpacity(state, now, "forest:forest"), flagOpacity(state, now, "forest:trees")), () => {
    for (let i = 0; i < 8; i++) {
      const tx = width * (0.05 + i * 0.12) - ((now * 0.02) % (width * 0.12));
      const ty = horizon - Math.abs(Math.sin(i * 1.3)) * height * 0.05;
      drawTree(ctx, tx, ty, height * 0.2);
    }
  });

  withAlpha(ctx, flagOpacity(state, now, "forest:stream"), () => {
    ctx.strokeStyle = "#5c8fa0";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(width * 0.02, height * 0.92);
    ctx.quadraticCurveTo(width * 0.35, height * 0.82, width * 0.6, height * 0.94);
    ctx.quadraticCurveTo(width * 0.8, height * 1.02, width * 0.98, height * 0.9);
    ctx.stroke();
  });

  withAlpha(ctx, flagOpacity(state, now, "forest:lights"), () => {
    for (let i = 0; i < 6; i++) {
      const lx = width * (0.15 + i * 0.14) + Math.sin(now / 500 + i) * 8;
      const ly = horizon - height * (0.08 + 0.04 * Math.sin(now / 350 + i * 2));
      const glow = 0.5 + 0.5 * Math.sin(now / 300 + i * 3);
      ctx.save();
      ctx.globalAlpha *= glow;
      ctx.fillStyle = "#e8d27a";
      ctx.beginPath();
      ctx.arc(lx, ly, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  });

  withAlpha(ctx, flagOpacity(state, now, "forest:tower"), () => drawTower(ctx, width * 0.88, horizon, height * 0.26));

  drawKnightActor(ctx, travelX(width, chapterProgress(state), 0.1, 0.7), height * 0.88, height * 0.2, state, now);
}

function drawCave(ctx: CanvasRenderingContext2D, width: number, height: number, state: GameState, now: number, dying: boolean): void {
  ctx.fillStyle = "#0a0806";
  ctx.fillRect(0, 0, width, height);

  const dragonAlpha = Math.max(flagOpacity(state, now, "cave:dragon"), dying ? 1 : 0);
  const litRadius = 0.35 + dragonAlpha * 0.15;
  ctx.save();
  const glow = ctx.createRadialGradient(width * 0.6, height * 0.6, height * 0.05, width * 0.6, height * 0.6, height * litRadius);
  glow.addColorStop(0, dying ? "rgba(232,98,47,0.35)" : "rgba(120,90,60,0.28)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  withAlpha(ctx, flagOpacity(state, now, "cave:cavern"), () => {
    ctx.fillStyle = "#39312a";
    for (let i = 0; i < 7; i++) {
      const sx = width * (0.08 + i * 0.14);
      ctx.beginPath();
      ctx.moveTo(sx - 12, 0);
      ctx.lineTo(sx, height * 0.16);
      ctx.lineTo(sx + 12, 0);
      ctx.closePath();
      ctx.fill();
    }
    drawIcon(ctx, ENV.torch, width * 0.15, height * 0.42, height * 0.14);
    drawIcon(ctx, ENV.torch, width * 0.82, height * 0.4, height * 0.14);
    drawIcon(ctx, ENV.stoneWall, width * 0.5, height * 0.15, height * 0.16);
  });

  withAlpha(ctx, flagOpacity(state, now, "cave:dragon") + (dying ? 1 : 0), () => {
    ctx.fillStyle = GOLD;
    for (let i = 0; i < 10; i++) {
      const gx = width * 0.5 + ((i * 53) % 120) - 60;
      const gy = height * 0.82 - ((i * 29) % 18);
      ctx.beginPath();
      ctx.arc(gx, gy, 4 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
  });

  withAlpha(ctx, dragonAlpha, () => drawDragonActor(ctx, width * 0.62, height * 0.72, height * 0.34, now, dragonAlpha > 0.99));

  if (!dying) {
    withAlpha(ctx, Math.max(flagOpacity(state, now, "cave:tail"), flagOpacity(state, now, "cave:passage")), () => {
      drawIcon(ctx, ENV.archwayDark, width * 0.92, height * 0.55, height * 0.4);
    });
    drawKnightActor(ctx, travelX(width, chapterProgress(state), 0.12, 0.42), height * 0.88, height * 0.18, state, now);
  }
}

function drawAscent(ctx: CanvasRenderingContext2D, width: number, height: number, state: GameState, now: number): void {
  drawSky(ctx, width, height, "#2a1d3d", "#d98a3d");

  withAlpha(ctx, flagOpacity(state, now, "ascent:tower"), () => drawTower(ctx, width * 0.5, height * 0.98, height * 0.95));

  withAlpha(ctx, Math.max(flagOpacity(state, now, "ascent:gate"), flagOpacity(state, now, "ascent:stairs")), () => {
    ctx.strokeStyle = "#7a6a55";
    ctx.lineWidth = 3;
    for (let i = 0; i < 10; i++) {
      const sy = height * (0.88 - i * 0.06);
      const sx = width * 0.5 + Math.sin(i * 0.9) * width * 0.08;
      ctx.beginPath();
      ctx.moveTo(sx - 16, sy);
      ctx.lineTo(sx + 16, sy);
      ctx.stroke();
    }
  });

  const higherStage =
    (flagOpacity(state, now, "ascent:higher3") > 0 && 3) ||
    (flagOpacity(state, now, "ascent:higher2") > 0 && 2) ||
    (flagOpacity(state, now, "ascent:higher1") > 0 && 1) ||
    0;
  const climbY = height * (0.84 - higherStage * 0.16);
  drawKnightActor(ctx, width * 0.5, climbY, height * 0.19, state, now);

  withAlpha(ctx, flagOpacity(state, now, "ascent:door"), () => {
    const doorOpen = flagOpacity(state, now, "ascent:open");
    drawTower(ctx, width * 0.5, height * 0.32, height * 0.3, { open: doorOpen });
  });
}

function drawEnding(ctx: CanvasRenderingContext2D, width: number, height: number, state: GameState, now: number): void {
  const horizon = height * 0.68;
  const variant = state.phase === "endMedium" ? "elderly" : "young";
  drawSky(ctx, width, height, "#f5d98a", "#e8b563");
  drawGround(ctx, width, height, horizon, "#b9a468");

  if (state.phase === "endMedium") {
    ctx.save();
    ctx.fillStyle = "rgba(60,70,50,0.22)";
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  if (state.phase === "endSlow") {
    withAlpha(ctx, flagOpacity(state, now, "endingSlow:princess"), () =>
      drawSkeletonPrincess(ctx, width * 0.58, horizon, height * 0.22),
    );
    drawKnightActor(ctx, width * 0.4, height * 0.88, height * 0.2, state, now);
    return;
  }

  const flagPrefix = state.phase === "endFast" ? "endingFast" : "endingMedium";
  withAlpha(ctx, flagOpacity(state, now, `${flagPrefix}:window`), () => {
    drawIcon(ctx, ENV.windowArch, width * 0.58, horizon - height * 0.14, height * 0.26);
    drawPrincessActor(ctx, width * 0.58, horizon - height * 0.02, height * 0.16, now, variant);
  });

  drawKnightActor(ctx, width * 0.35, height * 0.88, height * 0.2, state, now);

  withAlpha(ctx, flagOpacity(state, now, `${flagPrefix}:home`), () => {
    ctx.strokeStyle = "#6a5a3a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(width * 0.35, height * 0.94);
    ctx.lineTo(width * 0.12, height * 0.98);
    ctx.stroke();
  });
}

/** Dies exactly where he was last standing (lastKnightPose) — never
 * recentred/teleported to a fixed screen position for the death draw. */
function drawKnightDeath(ctx: CanvasRenderingContext2D, width: number, height: number, state: GameState, now: number): void {
  drawSky(ctx, width, height, "#20242c", "#3a3230");
  drawGround(ctx, width, height, height * 0.7, "#4a4136");
  const age = phaseElapsed(state, now);
  const img = frameAtAge(KNIGHT_DIE, age, DIE_FRAME_MS);
  const pose = lastKnightPose ?? { x: width * 0.5, groundY: height * 0.86, scale: height * 0.22, flip: false };
  drawSprite(ctx, img, pose.x, pose.groundY, pose.scale, { flip: pose.flip });
}

function drawCaveDeath(ctx: CanvasRenderingContext2D, width: number, height: number, state: GameState, now: number): void {
  drawCave(ctx, width, height, state, now, true);
  const age = phaseElapsed(state, now);
  if (age < 500) {
    ctx.save();
    ctx.globalAlpha = clamp01(age / 200) * (1 - clamp01((age - 300) / 200));
    ctx.fillStyle = FIRE;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
  if (age > 250) {
    const img = frameAtAge(KNIGHT_DIE, age - 250, DIE_FRAME_MS);
    const pose = lastKnightPose ?? { x: width * 0.35, groundY: height * 0.86, scale: height * 0.2, flip: false };
    drawSprite(ctx, img, pose.x, pose.groundY, pose.scale, { flip: pose.flip });
  }
}

// --- Top level --------------------------------------------------------------

export function drawScene(ctx: CanvasRenderingContext2D, width: number, height: number, state: GameState, now: number): void {
  if (state.phase === "road" && state.sentenceIndex === 0 && state.charIndex === 0) {
    flagFirstSeenAt.clear();
    phaseEnteredAt.clear();
    lastKnightPose = null;
  }
  if (state.finalLine !== lastFinalLine) {
    lastFinalLine = state.finalLine;
    finalLineSetAt = state.finalLine !== null ? now : 0;
  }

  ctx.save();
  ctx.clearRect(0, 0, width, height);

  const punch = cameraPunch(state, now);
  ctx.save();
  ctx.translate(width / 2, height / 2 + punch.dy);
  ctx.scale(punch.scale, punch.scale);
  ctx.translate(-width / 2, -height / 2);

  switch (state.phase) {
    case "road":
      drawRoad(ctx, width, height, state, now);
      break;
    case "bridge":
      drawBridge(ctx, width, height, state, now);
      break;
    case "fork":
      drawFork(ctx, width, height, state, now);
      break;
    case "forest":
      drawForest(ctx, width, height, state, now);
      break;
    case "cave":
      drawCave(ctx, width, height, state, now, false);
      break;
    case "ascent":
      drawAscent(ctx, width, height, state, now);
      break;
    case "endFast":
    case "endMedium":
    case "endSlow":
      drawEnding(ctx, width, height, state, now);
      break;
    case "deathKnight":
      drawKnightDeath(ctx, width, height, state, now);
      break;
    case "deathCave":
      drawCaveDeath(ctx, width, height, state, now);
      break;
  }
  drawFallingLetter(ctx, width, height, state, now);

  drawEndingVignette(ctx, width, height, state, now);
  ctx.restore();
  ctx.restore();
}

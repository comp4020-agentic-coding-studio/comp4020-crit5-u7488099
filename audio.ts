// Real sound-file playback via Web Audio. The AudioContext is created lazily
// on the first call — main.ts only calls these from inside real keydown
// handlers, so nothing here plays before a user gesture (autoplay policy).
// Every file is decoded once and cached; see ASSET_SOURCES.md for where
// each sound came from and its license.

import { AUDIO } from "./assets.ts";

let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;
const bufferCache = new Map<string, Promise<AudioBuffer>>();

function getContext(): { ctx: AudioContext; master: GainNode } {
  if (!audioContext || !masterGain) {
    audioContext = new AudioContext();
    masterGain = audioContext.createGain();
    masterGain.gain.value = 0.6;
    masterGain.connect(audioContext.destination);
  }
  if (audioContext.state === "suspended") {
    void audioContext.resume();
  }
  return { ctx: audioContext, master: masterGain };
}

function loadBuffer(ctx: AudioContext, url: string): Promise<AudioBuffer> {
  let pending = bufferCache.get(url);
  if (!pending) {
    pending = fetch(url)
      .then((res) => res.arrayBuffer())
      .then((data) => ctx.decodeAudioData(data));
    bufferCache.set(url, pending);
  }
  return pending;
}

interface PlayOptions {
  gain?: number;
  rate?: number;
  rateJitter?: number;
  gainJitter?: number;
}

function play(url: string, opts: PlayOptions = {}): void {
  const { ctx, master } = getContext();
  void loadBuffer(ctx, url).then((buffer) => {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const rateJitter = opts.rateJitter ?? 0;
    source.playbackRate.value = (opts.rate ?? 1) + (Math.random() * 2 - 1) * rateJitter;

    const gain = ctx.createGain();
    const gainJitter = opts.gainJitter ?? 0;
    gain.gain.value = (opts.gain ?? 1) + (Math.random() * 2 - 1) * gainJitter;

    source.connect(gain);
    gain.connect(master);
    source.start();
    source.addEventListener("ended", () => {
      source.disconnect();
      gain.disconnect();
    });
  });
}

let clickIndex = 0;

/** A correctly typed character. Deliberately quiet and varied — this plays roughly once per keystroke across a ~200-character story, so it must not fatigue. */
export function playTick(): void {
  clickIndex = (clickIndex + 1) % AUDIO.click.length;
  play(AUDIO.click[clickIndex], { gain: 0.16, gainJitter: 0.04, rate: 1, rateJitter: 0.08 });
}

/** A wrong character (a knight-damage incident). */
export function playWrongBuzz(): void {
  play(AUDIO.thud, { gain: 0.55, rateJitter: 0.1 });
}

/** The helmet or shield breaking (knight damage reaching stage 1 or 2). */
export function playBreakCrash(): void {
  play(AUDIO.clink, { gain: 0.6, rateJitter: 0.08 });
}

/** A backspace erasure incident, story-damage stages 1 and 2 (glitch, then the crack overlay appearing). */
export function playCrackCreak(): void {
  play(AUDIO.crackWood, { gain: 0.5, rateJitter: 0.06 });
}

/** The manuscript collapsing — story damage reaching stage 3, the world breaking apart. */
export function playCollapseRumble(): void {
  play(AUDIO.crackStone, { gain: 0.7, rate: 0.8, rateJitter: 0.04 });
}

/** The dragon waking, or the knight dying to it. */
export function playDragonRoar(): void {
  play(AUDIO.dragonGrowl, { gain: 0.5 });
}

/** The dragon's fire, at the moment of the cave death. */
export function playFireWhoosh(): void {
  play(AUDIO.fireWhoosh, { gain: 0.55 });
}

/** The tower door creaking open at the top of the ascent. */
export function playDoorCreak(): void {
  play(AUDIO.doorCreak, { gain: 0.45 });
}

/** A short sting the moment an ending's final line is revealed. */
export function playEndingSting(): void {
  play(AUDIO.endingSting, { gain: 0.4 });
}

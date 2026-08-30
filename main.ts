// Entry point: wires the DOM to the pure gameState reducer. This is the only
// place that reads a real clock, touches the DOM, or calls into audio.ts —
// gameState.ts and typing.ts stay fully deterministic and testable.

import { createInitialState, reduce, sentencesFor, type GameState } from "./gameState.ts";
import { drawScene } from "./render.ts";
import { THE_END } from "./story.ts";
import {
  playTick,
  playWrongBuzz,
  playBreakCrash,
  playDragonRoar,
  playFireWhoosh,
  playDoorCreak,
  playEndingSting,
} from "./audio.ts";

const canvas = document.querySelector<HTMLCanvasElement>("#scene")!;
const ctx = canvas.getContext("2d")!;
const manuscript = document.querySelector<HTMLElement>("#manuscript")!;
const storyEnd = document.querySelector<HTMLElement>("#story-end")!;
const finalLineEl = document.querySelector<HTMLElement>("#final-line")!;
const theEndEl = document.querySelector<HTMLElement>("#the-end")!;
const restartButton = document.querySelector<HTMLButtonElement>("#restart-button")!;

let logicalWidth = 0;
let logicalHeight = 0;

function resizeCanvas(): void {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  logicalWidth = rect.width;
  logicalHeight = rect.height;
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

new ResizeObserver(resizeCanvas).observe(canvas);
resizeCanvas();

let state: GameState = applyDebugOverride(createInitialState());
renderManuscript(state);

function renderManuscript(current: GameState): void {
  manuscript.textContent = "";

  if (current.phase === "fork" && current.forkResolvingWord !== null) {
    manuscript.textContent = current.forkResolvingWord;
    return;
  }

  const sentences = sentencesFor(current.phase);
  if (!sentences) return;
  const sentence = sentences[current.sentenceIndex];
  if (!sentence) return;

  for (let i = 0; i < sentence.text.length; i++) {
    const span = document.createElement("span");
    span.textContent = sentence.text[i];
    if (i < current.charIndex) {
      span.className = "ink";
    } else if (i === current.charIndex) {
      span.className = "caret";
    } else {
      span.className = "future";
    }
    manuscript.appendChild(span);
  }
}

function playSideEffects(prev: GameState, next: GameState): void {
  if (next.charIndex > prev.charIndex && next.phase === prev.phase) {
    playTick();
  }

  if (next.lastDamageAt !== null && next.lastDamageAt !== prev.lastDamageAt) {
    playWrongBuzz();
    if (next.knightDamage >= 5) {
      if (next.phase === "deathCave") {
        playFireWhoosh();
      } else {
        playBreakCrash();
      }
    } else if (next.knightDamage > prev.knightDamage) {
      playBreakCrash();
    }
  }

  if (!prev.worldFlags["cave:dragon"] && next.worldFlags["cave:dragon"]) {
    playDragonRoar();
  }
  if (!prev.worldFlags["ascent:open"] && next.worldFlags["ascent:open"]) {
    playDoorCreak();
  }
  if (prev.finalLine === null && next.finalLine !== null) {
    playEndingSting();
  }
}

function dispatch(action: Parameters<typeof reduce>[1]): void {
  const prev = state;
  const next = reduce(prev, action);
  if (next === prev) return;
  state = next;
  playSideEffects(prev, next);
  renderManuscript(state);
  updateStoryEndPanel();
}

function updateStoryEndPanel(): void {
  const revealed = state.finalLine !== null && state.revealAt !== null && performance.now() >= state.revealAt;
  if (revealed) {
    finalLineEl.textContent = state.finalLine;
    theEndEl.textContent = THE_END;
    storyEnd.classList.add("visible");
  } else {
    storyEnd.classList.remove("visible");
  }
}

document.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;

  if (state.phase === "fork" && state.forkChoicePending) {
    if (event.key.toLowerCase() === "f") {
      dispatch({ type: "SELECT_BRANCH", branch: "forest", now: performance.now() });
    } else if (event.key.toLowerCase() === "c") {
      dispatch({ type: "SELECT_BRANCH", branch: "cave", now: performance.now() });
    }
    return;
  }

  if (event.key === "Backspace") {
    // Wrong characters never enter the manuscript, so there's nothing for
    // Backspace to usefully undo here — it's a plain no-op rather than a
    // second failure mechanic.
    event.preventDefault();
    return;
  }

  if (event.key.length === 1) {
    dispatch({ type: "KEY_CHAR", char: event.key, now: performance.now() });
  }
});

restartButton.addEventListener("click", () => {
  dispatch({ type: "RESTART" });
});

function frame(now: number): void {
  updateStoryEndPanel();
  manuscript.classList.toggle("locked", now < state.inputLockedUntil);
  drawScene(ctx, logicalWidth, logicalHeight, state, now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/** `?ending=fast|medium|slow|knight|cave` jumps straight to a terminal state, for reviewing endings without retyping the whole story. */
function applyDebugOverride(initial: GameState): GameState {
  const ending = new URLSearchParams(location.search).get("ending");
  if (!ending) return initial;

  const now = performance.now();
  const base: GameState = { ...initial, revealAt: now };

  switch (ending) {
    case "fast":
      return { ...base, phase: "endFast", finalLine: "And so the story was written." };
    case "medium":
      return { ...base, phase: "endMedium", finalLine: "Some stories simply take longer to write." };
    case "slow":
      return { ...base, phase: "endSlow", finalLine: "He had not reached her in time." };
    case "knight":
      return { ...base, phase: "deathKnight", knightDamage: 5, finalLine: "One letter was all it took to change his fate." };
    case "cave":
      return { ...base, phase: "deathCave", knightDamage: 5, finalLine: "Some stories should not wake sleeping dragons." };
    default:
      return initial;
  }
}

// The whole game as one pure reducer: (state, action) -> state. No DOM, no
// setTimeout, no Date.now() inside — every action carries the `now` it
// happened at, so this file is fully deterministic and testable, and
// main.ts is the only place that reads a real clock or touches the page.

import {
  ROAD,
  BRIDGE,
  FORK,
  FOREST,
  CAVE,
  ASCENT,
  ENDING_FAST,
  ENDING_MEDIUM,
  ENDING_SLOW,
  FINAL_LINE_FAST,
  FINAL_LINE_MEDIUM,
  FINAL_LINE_SLOW,
  KNIGHT_DEATH_LINE,
  CAVE_DEATH_LINE,
  FORK_FOREST_WORD,
  FORK_CAVE_WORD,
  type Sentence,
} from "./story.ts";
import { INPUT_LOCKOUT_MS, ENDING_REVEAL_DELAY_MS, SLOW_ENDING_REVEAL_DELAY_MS } from "./config.ts";
import { isCorrectChar, computeWpm, classifySpeed, type SpeedOutcome } from "./typing.ts";

export type Phase =
  | "road"
  | "bridge"
  | "fork"
  | "forest"
  | "cave"
  | "ascent"
  | "endFast"
  | "endMedium"
  | "endSlow"
  | "deathKnight"
  | "deathCave";

export type Branch = "forest" | "cave" | null;

export interface FallingLetter {
  char: string;
  at: number;
}

export interface GameState {
  phase: Phase;
  branch: Branch;
  sentenceIndex: number;
  charIndex: number;
  worldFlags: Record<string, boolean>;

  knightDamage: 0 | 1 | 2 | 3 | 4 | 5;
  lastDamageAt: number | null;
  fallingLetter: FallingLetter | null;
  inputLockedUntil: number;

  forkChoicePending: boolean;
  forkResolvingWord: string | null;
  forkResolvedAt: number | null;

  runStartedAt: number | null;
  forkPauseStartedAt: number | null;
  forcedPauseMs: number;
  targetCharCount: number | null;
  speedOutcome: SpeedOutcome | null;

  revealAt: number | null;
  finalLine: string | null;
}

export type Action =
  | { type: "KEY_CHAR"; char: string; now: number }
  | { type: "SELECT_BRANCH"; branch: "forest" | "cave"; now: number }
  | { type: "RESTART" };

export function createInitialState(): GameState {
  return {
    phase: "road",
    branch: null,
    sentenceIndex: 0,
    charIndex: 0,
    worldFlags: {},

    knightDamage: 0,
    lastDamageAt: null,
    fallingLetter: null,
    inputLockedUntil: 0,

    forkChoicePending: false,
    forkResolvingWord: null,
    forkResolvedAt: null,

    runStartedAt: null,
    forkPauseStartedAt: null,
    forcedPauseMs: 0,
    targetCharCount: null,
    speedOutcome: null,

    revealAt: null,
    finalLine: null,
  };
}

export function reduce(state: GameState, action: Action): GameState {
  // A mistake locks out ALL input (correct or wrong, typing or branch choice) for
  // INPUT_LOCKOUT_MS, ignored entirely rather than queued — see handleKeyChar.
  if (action.type !== "RESTART" && action.now < state.inputLockedUntil) {
    return state;
  }
  switch (action.type) {
    case "KEY_CHAR":
      return handleKeyChar(state, action.char, action.now);
    case "SELECT_BRANCH":
      return handleSelectBranch(state, action.branch, action.now);
    case "RESTART":
      return createInitialState();
    default:
      return state;
  }
}

export function sentencesFor(phase: Phase): Sentence[] | null {
  switch (phase) {
    case "road":
      return ROAD;
    case "bridge":
      return BRIDGE;
    case "fork":
      return FORK;
    case "forest":
      return FOREST;
    case "cave":
      return CAVE;
    case "ascent":
      return ASCENT;
    case "endFast":
      return ENDING_FAST;
    case "endMedium":
      return ENDING_MEDIUM;
    case "endSlow":
      return ENDING_SLOW;
    default:
      return null;
  }
}

function isDeathPhase(phase: Phase): boolean {
  return phase === "deathKnight" || phase === "deathCave";
}

/** True once nothing more can be typed in the current phase: mid-death, awaiting a final-line reveal, or waiting on a fork choice. */
function isTypingLocked(state: GameState): boolean {
  return isDeathPhase(state.phase) || state.finalLine !== null || (state.phase === "fork" && state.forkChoicePending);
}

function totalChars(sentences: Sentence[]): number {
  return sentences.reduce((sum, s) => sum + s.text.length, 0);
}

function applyBeats(state: GameState, sentence: Sentence, nextCharIndex: number): GameState {
  const justTypedIndex = nextCharIndex - 1;
  const hits = sentence.beats.filter((b) => b.atCharIndex === justTypedIndex);
  if (hits.length === 0) return state;
  const worldFlags = { ...state.worldFlags };
  for (const beat of hits) worldFlags[beat.flag] = true;
  return { ...state, worldFlags };
}

function handleKeyChar(state: GameState, char: string, now: number): GameState {
  if (isTypingLocked(state)) return state;

  const sentences = sentencesFor(state.phase);
  if (!sentences) return state;
  const sentence = sentences[state.sentenceIndex];
  const expected = sentence.text[state.charIndex];
  if (expected === undefined) return state;

  const runStartedAt = state.runStartedAt ?? now;

  if (isCorrectChar(char, expected)) {
    const nextCharIndex = state.charIndex + 1;
    let next: GameState = { ...state, runStartedAt, charIndex: nextCharIndex };
    next = applyBeats(next, sentence, nextCharIndex);
    if (nextCharIndex >= sentence.text.length) {
      next = advanceAfterSentence(next, now);
    }
    return next;
  }

  // Wrong character: never advances the manuscript. Exactly one damage stage
  // registers, then all input (right or wrong) is locked out for INPUT_LOCKOUT_MS
  // so a single slip can't cascade into several before the player can react.
  const nextDamage = Math.min(5, state.knightDamage + 1) as 0 | 1 | 2 | 3 | 4 | 5;
  const cave = state.phase === "cave";
  const next: GameState = {
    ...state,
    runStartedAt,
    knightDamage: nextDamage,
    lastDamageAt: now,
    inputLockedUntil: now + INPUT_LOCKOUT_MS,
    fallingLetter: { char, at: now },
  };

  if (nextDamage >= 5) {
    next.phase = cave ? "deathCave" : "deathKnight";
    next.finalLine = cave ? CAVE_DEATH_LINE : KNIGHT_DEATH_LINE;
    next.revealAt = now + ENDING_REVEAL_DELAY_MS;
  }

  return next;
}

function handleSelectBranch(state: GameState, branch: "forest" | "cave", now: number): GameState {
  if (state.phase !== "fork" || !state.forkChoicePending) return state;

  const forcedPauseMs = state.forcedPauseMs + (state.forkPauseStartedAt !== null ? now - state.forkPauseStartedAt : 0);
  const branchSentences = branch === "forest" ? FOREST : CAVE;
  const targetCharCount =
    totalChars(ROAD) + totalChars(BRIDGE) + totalChars(FORK) + totalChars(branchSentences) + totalChars(ASCENT);

  return {
    ...state,
    branch,
    phase: branch,
    sentenceIndex: 0,
    charIndex: 0,
    forkChoicePending: false,
    forkResolvingWord: branch === "forest" ? FORK_FOREST_WORD : FORK_CAVE_WORD,
    forkResolvedAt: now,
    forkPauseStartedAt: null,
    forcedPauseMs,
    targetCharCount,
  };
}

function advanceAfterSentence(state: GameState, now: number): GameState {
  const sentences = sentencesFor(state.phase)!;
  const nextIndex = state.sentenceIndex + 1;
  if (nextIndex < sentences.length) {
    return { ...state, sentenceIndex: nextIndex, charIndex: 0 };
  }

  switch (state.phase) {
    case "road":
      return { ...state, phase: "bridge", sentenceIndex: 0, charIndex: 0 };
    case "bridge":
      return { ...state, phase: "fork", sentenceIndex: 0, charIndex: 0 };
    case "fork":
      return { ...state, forkChoicePending: true, forkPauseStartedAt: now };
    case "forest":
    case "cave":
      return { ...state, phase: "ascent", sentenceIndex: 0, charIndex: 0 };
    case "ascent": {
      const activeMs = state.runStartedAt !== null ? now - state.runStartedAt - state.forcedPauseMs : 0;
      const wpm = computeWpm(state.targetCharCount ?? 0, activeMs);
      const speedOutcome = classifySpeed(wpm);
      const phase: Phase = speedOutcome === "fast" ? "endFast" : speedOutcome === "medium" ? "endMedium" : "endSlow";
      return { ...state, phase, sentenceIndex: 0, charIndex: 0, speedOutcome };
    }
    case "endFast":
    case "endMedium":
    case "endSlow": {
      const finalLine =
        state.phase === "endFast" ? FINAL_LINE_FAST : state.phase === "endMedium" ? FINAL_LINE_MEDIUM : FINAL_LINE_SLOW;
      const delay = state.phase === "endSlow" ? SLOW_ENDING_REVEAL_DELAY_MS : ENDING_REVEAL_DELAY_MS;
      return { ...state, finalLine, revealAt: now + delay };
    }
    default:
      return state;
  }
}

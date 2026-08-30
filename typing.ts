// Pure typing/measurement helpers. No DOM, no clock reads — every function
// takes whatever time value it needs as an argument, so it's directly
// testable and gameState.ts stays the only place that touches real time.

import { SPEED_FAST_WPM, SPEED_MEDIUM_WPM } from "./config.ts";

export type SpeedOutcome = "fast" | "medium" | "slow";

/** Letters are case-insensitive; every other character (spaces, punctuation) must match exactly. */
export function isCorrectChar(typed: string, expected: string): boolean {
  return typed.toLowerCase() === expected.toLowerCase();
}

/** Standard WPM: one "word" is 5 characters. */
export function computeWpm(charCount: number, activeMs: number): number {
  if (activeMs <= 0) return 0;
  const minutes = activeMs / 60000;
  return charCount / 5 / minutes;
}

export function classifySpeed(wpm: number): SpeedOutcome {
  if (wpm >= SPEED_FAST_WPM) return "fast";
  if (wpm >= SPEED_MEDIUM_WPM) return "medium";
  return "slow";
}

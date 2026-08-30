// Centralized tunables. Nothing here is game logic — gameState.ts and
// render.ts read these instead of hardcoding numbers, so tuning after a
// playtest is a one-line change.

/** After any wrong-character mistake, all input is ignored for this long (deterministic hit-stun/recovery window). */
export const INPUT_LOCKOUT_MS = 1000;

/** At/above this WPM the player gets the fast (young princess) ending. */
export const SPEED_FAST_WPM = 55;

/** At/above this WPM (but below fast) the player gets the medium (elderly princess) ending. Below it: slow (skeleton). */
export const SPEED_MEDIUM_WPM = 30;

/** How long a falling wrong-letter stays visible before fading out. */
export const FALLING_LETTER_LIFETIME_MS = 700;

/** How long the fork's auto-resolving remaining letters take to fill in once F/C is pressed. */
export const FORK_AUTO_RESOLVE_MS = 500;

/** Pause before a phase's final line / THE_END is revealed, so it reads as a beat rather than a snap-cut. */
export const ENDING_REVEAL_DELAY_MS = 900;

/** Ending C's extra dramatic pause between the typed line and the game's own reveal line. */
export const SLOW_ENDING_REVEAL_DELAY_MS = 1600;

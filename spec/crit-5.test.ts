import { describe, expect, it } from "vitest";
import { createInitialState, reduce } from "../gameState.ts";
import { INPUT_LOCKOUT_MS } from "../config.ts";

function wrongKey(now: number) {
  return { type: "KEY_CHAR" as const, char: "z", now };
}

describe("crit 5: five strikes end the story", () => {
  it("takes knight damage on a wrong character, each strike spaced past the lockout", () => {
    let state = createInitialState();
    state = reduce(state, wrongKey(0));
    expect(state.knightDamage).toBe(1);
    expect(state.phase).toBe("road");
    state = reduce(state, wrongKey(INPUT_LOCKOUT_MS + 1));
    expect(state.knightDamage).toBe(2);
    expect(state.phase).toBe("road");
  });

  it("ends the run in a death phase with a final line queued on the fifth strike", () => {
    let state = createInitialState();
    for (let i = 0; i < 5; i++) {
      state = reduce(state, wrongKey(i * (INPUT_LOCKOUT_MS + 1)));
    }
    expect(state.knightDamage).toBe(5);
    expect(state.phase).toBe("deathKnight");
    expect(state.finalLine).toBeTruthy();
    expect(state.revealAt).not.toBeNull();
  });

  it("ignores further input once the run has ended", () => {
    let state = createInitialState();
    for (let i = 0; i < 5; i++) {
      state = reduce(state, wrongKey(i * (INPUT_LOCKOUT_MS + 1)));
    }
    const dead = state;
    state = reduce(state, wrongKey(5 * (INPUT_LOCKOUT_MS + 1)));
    expect(state).toBe(dead);
  });
});

describe("crit 5: one mistake locks out input for exactly INPUT_LOCKOUT_MS", () => {
  it("a wrong key at t=0 damages once; rapid follow-ups within the lockout window cause no more damage", () => {
    let state = createInitialState();
    state = reduce(state, wrongKey(0));
    expect(state.knightDamage).toBe(1);

    state = reduce(state, wrongKey(100));
    expect(state.knightDamage).toBe(1);

    state = reduce(state, wrongKey(900));
    expect(state.knightDamage).toBe(1);

    state = reduce(state, wrongKey(1100));
    expect(state.knightDamage).toBe(2);
  });
});

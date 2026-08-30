# Process overview

## What I built

*Write His Fate* is a typing-driven narrative game: the manuscript on screen
is the story, and the player writes the knight's adventure into existence one
correct keystroke at a time. Typing the next character of the shown sentence
advances both the prose and a small canvas illustration of the knight's
journey (Road, Bridge, a Forest/Cave fork, and one of three ending scenes);
typing a wrong character damages the knight instead of erasing anything.
There is no tutorial screen or instruction text anywhere in the game — the
blinking caret in the manuscript and the immediate, visible response to every
keystroke (the beat animates, the knight staggers) are meant to teach the
whole interaction through play in the first few seconds.

## The moments that mattered

**1. The Forest/Cave fork.** After the bridge, the story splits: Forest is
the longer, easier branch (longer sentences overall but individually gentler
words), Cave is short and deliberately harder to type, ending with the
dragon's contextual fire-death instead of the standard knight-damage death.
Branching, the two paths' relative difficulty, and the three speed endings
(fast → young princess, medium → elderly princess, slow → a skeleton at the
window, from `classifySpeed`'s WPM thresholds in
[`09a1acd`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-u7488099/commit/09a1acd)'s
`config.ts`) were kept completely intact through the whole correction pass
below — the brief for this pass was explicitly to fix the failure system,
not touch the story built on the starter in
[`aee6e7e`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-u7488099/commit/aee6e7e).

**2. Playtesting exposed a cascade-death bug, not a taste problem.** I
manually played the build repeatedly after the first working version was
done. The failure system re-checked a cooldown *inside* the damage handler
only, so a burst of wrong keystrokes typed faster than a person could
consciously stop (autorepeat, or just fast fumbling) could register several
damage stages from what was really one mistake — the knight could die from a
single typo's aftershock before the player even saw the first hit land. I
corrected this by moving the guard to the top of the reducer: every input
action now carries a timestamp, and any action arriving before
`state.inputLockedUntil` (one second past the last mistake) is dropped
entirely — no advance, no damage, no branch selection — rather than papering
over it with a smaller cooldown inside one handler. That's a harness-level
fix (a rule the reducer enforces for every action type) rather than a retry,
and it's covered by a dedicated test in
[`09a1acd`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-u7488099/commit/09a1acd)
(`spec/crit-5.test.ts`, "one mistake locks out input for exactly
INPUT_LOCKOUT_MS") asserting the exact 0/100/900/1100 ms sequence from the
brief.

**3. Five failure stages replace the original three, with no numbers on
screen.** The old build had three damage steps and reused a single crack
overlay for all of them, which read as "something broke" rather than telling
the player what. The corrected system is: helmet cracks → helmet breaks off
→ shield cracks → shield breaks → the knight dies, driven by one
`knightDamage: 0–5` counter and two pure stage-lookup functions in
`render.ts`. There's still no lives counter or heart icons — the only
"health bar" is the knight's own sprite losing pieces of armor, and that
state persists all the way into the ending screen (arriving without a
helmet if the player took two hits, for example).

**4. I found and judged a visual-clarity bug myself; Claude verified the
mechanics.** Claude Code could confirm the *logic* was correct (tests
passing, the reducer producing the right damage count at the right time),
but it took me actually looking at the rendered frames to catch that the
helmet's "cracked" stage was invisible — a white crack line against the
helmet's own light grey fill blended into an existing highlight streak, so
stage 1 looked identical to stage 0. No test would have caught that; it's a
contrast/legibility judgement a person has to make by eye. Once flagged, the fix (switching that stroke to a dark ink colour, part of
[`09a1acd`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-u7488099/commit/09a1acd)'s
`drawHelmet`) was small and mechanical, but deciding it needed fixing — and
deciding, separately, that a very minor debris-fragment legibility nuance in
the shield-broken stage was *not* worth chasing further — was mine to make,
not something the agent could verify on its own.

## Before you ship

`pnpm check` runs typecheck, build, and the full test suite (21 tests across
3 files, including the five-stage and input-lockout tests above).
`pnpm check:evidence` confirms this file and the reflection resolve to real
commits before a marker opens either.

# Crit 5 reflection

**What was the breakthrough that moved the work forward?**

Realizing that "the failure system feels too punishing" wasn't a balance
number to tweak — it was a real bug in where the cooldown check lived. The
original build re-checked damage cooldown only inside the wrong-key handler,
so a burst of fast keystrokes could rack up several damage stages from one
slip before I'd even registered the first hit. Playing it myself, repeatedly,
rather than trusting that passing tests meant the game felt right, is what
surfaced this — the tests were checking that damage applied correctly, not
that damage applied *the right number of times per mistake*. The fix was to
move the guard to the very top of the reducer, so it blocks every kind of
input (typing, branch choice) for a full second after any mistake, not just
re-guard the one code path I'd originally protected. That's the same shape
as a harness fix: instead of patching the one place I noticed the bug, I
moved the rule somewhere it applies to everything that comes after it.

**What did this work change about who I want to be as a software developer?**

It sharpened the line, for me, between "the agent verified this" and "I
verified this." Claude could tell me every test passed and the build was
green, and it was right — the logic was correct. But it took me actually
looking at rendered frames, several times, at high zoom, to notice the
helmet's crack was invisible against its own fill color, and it took me
actually playing the game to notice the cascade-damage feel that no unit
test was written to catch (because I hadn't known to write it yet). I want
to keep treating "all checks green" as necessary, not sufficient — the
checks tell you the code does what you told it to; only playing the thing
tells you whether what you told it to do was right.

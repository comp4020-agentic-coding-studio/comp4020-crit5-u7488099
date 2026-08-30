// Structured story data: every exact manuscript sentence, grouped by chapter,
// plus the word -> animation-flag beats that drive the illustration as the
// player types. Nothing here reads the DOM or the clock; gameState.ts is the
// only thing that turns this into play.

export const TITLE = "Write His Fate";

export interface Beat {
  /** Index of the last character of the trigger word within the sentence text. */
  atCharIndex: number;
  /** A world-state flag render.ts reads to decide what to draw. */
  flag: string;
}

export interface Sentence {
  text: string;
  beats: Beat[];
}

type BeatSpec = string | [word: string, flag: string];

function findWordEnd(text: string, word: string): number {
  const match = new RegExp(`\\b${word}\\b`, "i").exec(text);
  if (!match) {
    throw new Error(`beat word "${word}" not found in "${text}"`);
  }
  return match.index + match[0].length - 1;
}

function sentence(text: string, beats: BeatSpec[] = []): Sentence {
  return {
    text,
    beats: beats.map((spec) => {
      const [word, flag] = Array.isArray(spec) ? spec : [spec, spec];
      return { atCharIndex: findWordEnd(text, word), flag: flag.toLowerCase() };
    }),
  };
}

/** Prefixes every beat flag with its chapter id, so the same word (e.g. "tower") lighting up in two different chapters doesn't collide in worldFlags. */
function chapter(id: string, sentences: Sentence[]): Sentence[] {
  return sentences.map((s) => ({
    text: s.text,
    beats: s.beats.map((b) => ({ ...b, flag: `${id}:${b.flag}` })),
  }));
}

export const ROAD: Sentence[] = chapter("road", [
  sentence(
    "Long ago, a young knight left his quiet kingdom and followed the road toward a distant tower.",
    ["knight", "kingdom", "road", "tower"],
  ),
  sentence(
    "A princess waited there, beyond the forest and the mountains, for someone brave enough to find her.",
    ["princess", "mountains"],
  ),
]);

export const BRIDGE: Sentence[] = chapter("bridge", [
  sentence(
    "At the edge of the forest, the knight found an ancient bridge hanging above a river of fire.",
    ["bridge", "fire"],
  ),
  sentence(
    "He stepped onto the broken stones and crossed carefully, while the old ropes trembled beneath his feet.",
    ["stepped", "feet"],
  ),
]);

export const FORK: Sentence[] = chapter("fork", [
  sentence("Beyond the bridge, the road divided beneath the shadow of the mountain.", ["divided"]),
]);

/** The two in-world words shown after FORK's sentence completes. Not typed letter-by-letter: F/C commits one and the rest resolves automatically. */
export const FORK_FOREST_WORD = "FOREST";
export const FORK_CAVE_WORD = "CAVE";

export const FOREST: Sentence[] = chapter("forest", [
  sentence(
    "The knight walked into the deep forest, where tall trees covered the sky and soft moonlight fell across the road.",
    ["forest", "trees"],
  ),
  sentence(
    "He followed a quiet stream through the trees and watched small lights move gently through the grass beside him.",
    ["stream", "lights"],
  ),
  sentence(
    "The road turned left, then right, then left again, as he crossed old roots and passed beneath the dark green leaves.",
    ["left", "right", "roots", "leaves"],
  ),
  sentence(
    "He walked on until the trees grew thin, and at last he saw the distant tower standing beyond the forest.",
    ["thin", "tower"],
  ),
]);

export const CAVE: Sentence[] = chapter("cave", [
  sentence(
    "Inside the cavern, the knight discovered an enormous dragon sleeping beneath glittering stalactites.",
    ["cavern", "dragon"],
  ),
  sentence(
    "He crept cautiously between its claws; one careless sound would awaken the ancient creature.",
    ["claws", "sound"],
  ),
  sentence(
    "Beyond its smoke-blackened tail, a narrow passage twisted sharply toward the tower.",
    ["tail", "passage", "tower"],
  ),
]);

export const ASCENT: Sentence[] = chapter("ascent", [
  sentence("At last, the tower stood before him.", ["tower"]),
  sentence("He pushed through the gate and ran toward the winding stairs.", ["gate", "stairs"]),
  sentence("He climbed higher.", [["higher", "higher1"]]),
  sentence("Higher.", [["higher", "higher2"]]),
  sentence("Higher still.", [["higher", "higher3"]]),
  sentence(
    "At the top of the tower, an ancient wooden door stood between the knight and the end of his journey.",
    ["door"],
  ),
  sentence("He reached for the handle and pushed the door open.", ["open"]),
]);

export const ENDING_FAST: Sentence[] = chapter("endingFast", [
  sentence("The princess was waiting beside the window, just as he had imagined.", ["window"]),
  sentence("The knight took her hand, and together they began the journey home.", ["home"]),
]);
export const FINAL_LINE_FAST = "And so the story was written.";

export const ENDING_MEDIUM: Sentence[] = chapter("endingMedium", [
  sentence("The princess was still waiting beside the window, though many years had passed.", ["window"]),
  sentence("She took the knight's hand, and together they began the long journey home.", ["home"]),
]);
export const FINAL_LINE_MEDIUM = "Some stories simply take longer to write.";

export const ENDING_SLOW: Sentence[] = chapter("endingSlow", [
  sentence("At last, the knight had reached the princess.", ["princess"]),
]);
export const FINAL_LINE_SLOW = "He had not reached her in time.";

export const KNIGHT_DEATH_LINE = "One letter was all it took to change his fate.";
export const CAVE_DEATH_LINE = "Some stories should not wake sleeping dragons.";
export const STORY_COLLAPSE_LINE = "The story could not survive being unwritten.";
export const THE_END = "THE END";

import { describe, expect, it } from "vitest";
import {
   COVERAGE_PHASE_ITEMS,
   DECODABLE_PER_SESSION,
   IRREGULAR_PER_SESSION,
   MAX_ITEMS_PER_MISCONCEPTION,
   SESSION_LENGTH,
   selectNext,
   selectSession,
   trackForPosition,
} from "./select";
import type { Responder } from "./select";
import type { Answer } from "./diagnose";
import type { DecodableItem, IrregularItem, Item, Misconception, Option } from "../types";
import realBank from "../data/items.json";
import misconceptionData from "../data/misconceptions.json";

const MISCONCEPTIONS = misconceptionData as Misconception[];

/**
 * Fixtures are hand-written, like the diagnosis tests: a selection test must not
 * change meaning because the bank grew or an item was retagged. The one test
 * that reads `items.json` says so in its name, and is there to record what the
 * shipped bank can actually produce today.
 */

const DECODABLE_MISCONCEPTIONS = [
   "closed-syllable",
   "vowel-team-assumed",
   "ea-three-sounds",
   "ie-two-sounds",
] as const;

function decodable(id: string, misconceptionIds: [string, string]): DecodableItem {
   return {
      id,
      target: `target-${id}`,
      targetVowelSpelling: "oa",
      targetVowelSound: "long-o",
      audio: null,
      track: "decodable",
      source: "seed",
      options: [
         ...misconceptionIds.map((misconceptionId) => ({
            word: `${misconceptionId}-${id}`,
            vowelSpelling: "o",
            vowelSound: "short-o" as const,
            correct: false,
            misconceptionId,
            parentAdvice: `advice for ${misconceptionId}`,
         })),
         {
            word: `right-${id}`,
            vowelSpelling: "oe",
            vowelSound: "long-o",
            correct: true,
            misconceptionId: null,
            parentAdvice: null,
         },
      ],
   };
}

/** Both distractors carry `irregular-word` — the irregular track's real shape. */
function irregular(id: string): IrregularItem {
   return {
      id,
      target: `target-${id}`,
      audio: `q-${id}.mp3`,
      track: "irregular",
      source: "seed",
      options: [
         {
            word: `irregular-word-${id}`,
            correct: false,
            misconceptionId: "irregular-word",
            parentAdvice: "advice for irregular-word",
         },
         {
            word: `other-${id}`,
            correct: false,
            misconceptionId: "irregular-word",
            parentAdvice: "advice for irregular-word",
         },
         { word: `right-${id}`, correct: true, misconceptionId: null, parentAdvice: null },
      ],
   };
}

/**
 * A bank deeper than one session on both tracks, so selection has a real choice
 * at every position and nothing is forced by scarcity.
 */
function deepBank(): Item[] {
   const decodables = Array.from({ length: 12 }, (_, i) =>
      decodable(`d${i + 1}`, [
         DECODABLE_MISCONCEPTIONS[i % 2 === 0 ? 0 : 2]!,
         DECODABLE_MISCONCEPTIONS[i % 4 < 2 ? 1 : 3]!,
      ])
   );
   const irregulars = Array.from({ length: 6 }, (_, i) => irregular(`i${i + 1}`));
   return [...decodables, ...irregulars];
}

/** Deterministic generator, so a "random" session is reproducible in a test. */
function lcg(seed: number): () => number {
   let state = seed >>> 0;
   return () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
   };
}

/** `random() === 0` always draws the heaviest candidate — see `weightedPick`. */
const heaviest = () => 0;

function optionsOf(item: Item): Option[] {
   return item.options;
}

function misconceptionsOf(item: Item): string[] {
   return [
      ...new Set(
         optionsOf(item).flatMap((o) => (!o.correct && o.misconceptionId ? [o.misconceptionId] : []))
      ),
   ];
}

const answerCorrectly: Responder = (item) => optionsOf(item).find((o) => o.correct)!.word;

/** Picks the named misconception's distractor when the item offers one. */
function answerWith(misconceptionId: string): Responder {
   return (item) => {
      const distractor = optionsOf(item).find(
         (o) => !o.correct && o.misconceptionId === misconceptionId
      );
      return (distractor ?? optionsOf(item).find((o) => o.correct)!).word;
   };
}

/** Answers built by hand for a mid-session `selectNext`, bypassing the loop. */
function answersPicking(items: Item[], misconceptionId: string): Answer[] {
   return items.map((item) => ({ item, pickedWord: answerWith(misconceptionId)(item, 0) }));
}

describe("selectSession — session shape", () => {
   it("is exactly 12 items when the bank can fill it", () => {
      const session = selectSession(deepBank(), answerCorrectly, MISCONCEPTIONS, lcg(1));
      expect(session).toHaveLength(SESSION_LENGTH);
   });

   it("never repeats an item", () => {
      const session = selectSession(deepBank(), answerCorrectly, MISCONCEPTIONS, lcg(2));
      const ids = session.map((a) => a.item.id);
      expect(new Set(ids).size).toBe(ids.length);
   });

   it("never repeats a target word, even across different items", () => {
      // Two distinct items asking about the same word. Only one may be used.
      const twin = { ...decodable("twin", ["closed-syllable", "ea-three-sounds"]), target: "boat" };
      const original = { ...decodable("original", ["closed-syllable", "ie-two-sounds"]), target: "boat" };
      const bank = [...deepBank(), twin, original];

      for (let seed = 1; seed <= 25; seed += 1) {
         const session = selectSession(bank, answerCorrectly, MISCONCEPTIONS, lcg(seed));
         const targets = session.map((a) => a.item.target.toLowerCase());
         expect(new Set(targets).size).toBe(targets.length);
      }
   });

   it("holds the 8/4 mix with irregular items at positions 3, 6, 9 and 12", () => {
      for (let seed = 1; seed <= 25; seed += 1) {
         const session = selectSession(deepBank(), answerCorrectly, MISCONCEPTIONS, lcg(seed));
         const tracks = session.map((a) => a.item.track);

         expect(tracks.filter((t) => t === "decodable")).toHaveLength(DECODABLE_PER_SESSION);
         expect(tracks.filter((t) => t === "irregular")).toHaveLength(IRREGULAR_PER_SESSION);
         expect(
            tracks.flatMap((track, i) => (track === "irregular" ? [i + 1] : []))
         ).toEqual([3, 6, 9, 12]);
      }
   });

   it("interleaves rather than blocking, so tiring cannot sink one whole track", () => {
      const session = selectSession(deepBank(), answerCorrectly, MISCONCEPTIONS, lcg(7));
      const lastQuarter = session.slice(-3).map((a) => a.item.track);
      expect(lastQuarter.filter((t) => t === "irregular").length).toBeLessThan(
         IRREGULAR_PER_SESSION
      );
   });

   it("is reproducible: the same generator and answers select the same session", () => {
      const a = selectSession(deepBank(), answerCorrectly, MISCONCEPTIONS, lcg(42)).map((x) => x.item.id);
      const b = selectSession(deepBank(), answerCorrectly, MISCONCEPTIONS, lcg(42)).map((x) => x.item.id);
      expect(a).toEqual(b);
   });

   it("varies across children: different draws give different sessions", () => {
      const a = selectSession(deepBank(), answerCorrectly, MISCONCEPTIONS, lcg(1)).map((x) => x.item.id);
      const b = selectSession(deepBank(), answerCorrectly, MISCONCEPTIONS, lcg(99)).map((x) => x.item.id);
      expect(a).not.toEqual(b);
   });
});

describe("trackForPosition — the interleave", () => {
   it("puts irregular items at every third position", () => {
      const tracks = Array.from({ length: SESSION_LENGTH }, (_, i) => trackForPosition(i + 1));
      expect(tracks).toEqual([
         "decodable",
         "decodable",
         "irregular",
         "decodable",
         "decodable",
         "irregular",
         "decodable",
         "decodable",
         "irregular",
         "decodable",
         "decodable",
         "irregular",
      ]);
   });
});

describe("selectNext — the first four items spread for coverage", () => {
   it("takes the broadest item available at every step", () => {
      const bank = deepBank();
      const answers: Answer[] = [];
      const covered = new Set<string>();
      const freshCount = (item: Item) =>
         misconceptionsOf(item).filter((m) => !covered.has(m)).length;

      for (let position = 1; position <= COVERAGE_PHASE_ITEMS; position += 1) {
         const used = new Set(answers.map((a) => a.item.id));
         const available = bank.filter(
            (i) => !used.has(i.id) && i.track === trackForPosition(position)
         );
         const best = Math.max(...available.map(freshCount));

         // `heaviest` draws the top-weighted candidate, so the greedy choice is
         // observable: no eligible item on this track covers more new ground.
         const item = selectNext(bank, answers, MISCONCEPTIONS, heaviest)!;
         expect(freshCount(item)).toBe(best);

         for (const m of misconceptionsOf(item)) covered.add(m);
         answers.push({ item, pickedWord: answerCorrectly(item, position) });
      }

      // The fixture bank holds five misconceptions; four items reach all of them.
      expect(covered.size).toBe(5);
   });

   it("covers more misconceptions in four items than a single item could", () => {
      for (let seed = 1; seed <= 25; seed += 1) {
         const session = selectSession(deepBank(), answerCorrectly, MISCONCEPTIONS, lcg(seed));
         const covered = new Set(
            session.slice(0, COVERAGE_PHASE_ITEMS).flatMap((a) => misconceptionsOf(a.item))
         );
         expect(covered.size).toBeGreaterThanOrEqual(4);
      }
   });
});

describe("selectNext — after the coverage phase, weight toward suspected", () => {
   /** Two picks of one decodable misconception is `suspected` — never shown, used here. */
   function suspectedAnswers(): Answer[] {
      const bank = deepBank();
      const carriers = bank
         .filter((i) => i.track === "decodable" && misconceptionsOf(i).includes("closed-syllable"))
         .slice(0, 2);
      const others = bank.filter(
         (i) => i.track === "decodable" && !misconceptionsOf(i).includes("closed-syllable")
      );
      const irregulars = bank.filter((i) => i.track === "irregular");

      // Positions 1-4: two closed-syllable picks, one other item, one irregular
      // at position 3, so the next position is 5 — past the coverage phase.
      return [
         ...answersPicking(carriers, "closed-syllable"),
         { item: irregulars[0]!, pickedWord: answerCorrectly(irregulars[0]!, 3) },
         { item: others[0]!, pickedWord: answerCorrectly(others[0]!, 4) },
      ];
   }

   it("picks an item carrying the suspected misconception", () => {
      const bank = deepBank();
      const answers = suspectedAnswers();
      expect(answers).toHaveLength(COVERAGE_PHASE_ITEMS);

      const next = selectNext(bank, answers, MISCONCEPTIONS, heaviest)!;
      expect(misconceptionsOf(next)).toContain("closed-syllable");
   });

   it("prefers confirming a suspicion over discovering a new misconception", () => {
      const bank = deepBank();
      const answers = suspectedAnswers();

      let carrying = 0;
      const draws = 200;
      for (let seed = 1; seed <= draws; seed += 1) {
         const next = selectNext(bank, answers, MISCONCEPTIONS, lcg(seed))!;
         if (misconceptionsOf(next).includes("closed-syllable")) carrying += 1;
      }
      expect(carrying / draws).toBeGreaterThan(0.6);
   });

   it("still gives every eligible item a chance, so a session is not a rut", () => {
      const bank = deepBank();
      const answers = suspectedAnswers();
      const seen = new Set<string>();
      for (let seed = 1; seed <= 200; seed += 1) {
         seen.add(selectNext(bank, answers, MISCONCEPTIONS, lcg(seed))!.id);
      }
      expect(seen.size).toBeGreaterThan(1);
   });
});

describe("selectSession — no misconception over half the session", () => {
   /** Every decodable item carries the same misconception — the cap must bind. */
   function monotonousBank(irregularCount: number): Item[] {
      return [
         ...Array.from({ length: 12 }, (_, i) =>
            decodable(`d${i + 1}`, ["closed-syllable", "vowel-team-assumed"])
         ),
         ...Array.from({ length: irregularCount }, (_, i) => irregular(`i${i + 1}`)),
      ];
   }

   it("caps one misconception at half the session", () => {
      for (let seed = 1; seed <= 15; seed += 1) {
         const session = selectSession(monotonousBank(8), answerCorrectly, MISCONCEPTIONS, lcg(seed));
         const counts = new Map<string, number>();
         for (const { item } of session) {
            for (const m of misconceptionsOf(item)) counts.set(m, (counts.get(m) ?? 0) + 1);
         }
         for (const count of counts.values()) {
            expect(count).toBeLessThanOrEqual(MAX_ITEMS_PER_MISCONCEPTION);
         }
      }
   });

   it("fills the rest of the session from the other track rather than breaking the cap", () => {
      const session = selectSession(monotonousBank(8), answerCorrectly, MISCONCEPTIONS, lcg(3));
      expect(session).toHaveLength(SESSION_LENGTH);
      expect(session.filter((a) => a.item.track === "decodable")).toHaveLength(
         MAX_ITEMS_PER_MISCONCEPTION
      );
   });

   it("comes up short rather than breaking the cap when nothing else is left", () => {
      const session = selectSession(monotonousBank(IRREGULAR_PER_SESSION), answerCorrectly, MISCONCEPTIONS, lcg(3));
      expect(session.length).toBeLessThan(SESSION_LENGTH);
      const closed = session.filter((a) => misconceptionsOf(a.item).includes("closed-syllable"));
      expect(closed).toHaveLength(MAX_ITEMS_PER_MISCONCEPTION);
   });
});

describe("selectNext — a bank that cannot fill the session", () => {
   it("fills an irregular slot from the decodable track when that track is empty", () => {
      const bank = Array.from({ length: 12 }, (_, i) =>
         decodable(`d${i + 1}`, [
            DECODABLE_MISCONCEPTIONS[i % 2]!,
            DECODABLE_MISCONCEPTIONS[2 + (i % 2)]!,
         ])
      );
      const session = selectSession(bank, answerCorrectly, MISCONCEPTIONS, lcg(4));
      expect(session).toHaveLength(SESSION_LENGTH);
      expect(session.every((a) => a.item.track === "decodable")).toBe(true);
   });

   it("returns null instead of repeating an item once the bank is exhausted", () => {
      const bank = [decodable("only", ["closed-syllable", "ea-three-sounds"])];
      const session = selectSession(bank, answerCorrectly, MISCONCEPTIONS, lcg(5));
      expect(session).toHaveLength(1);
      expect(selectNext(bank, session, MISCONCEPTIONS, lcg(5))).toBeNull();
   });

   it("returns null past the end of the session even with items left", () => {
      const bank = deepBank();
      const session = selectSession(bank, answerCorrectly, MISCONCEPTIONS, lcg(6));
      expect(session).toHaveLength(SESSION_LENGTH);
      expect(selectNext(bank, session, MISCONCEPTIONS, lcg(6))).toBeNull();
   });

   it("returns null for an empty bank rather than throwing", () => {
      expect(selectNext([], [], MISCONCEPTIONS, lcg(1))).toBeNull();
      expect(selectSession([], answerCorrectly, MISCONCEPTIONS, lcg(1))).toEqual([]);
   });
});

describe("the shipped bank, as it stands today", () => {
   const bank = realBank as unknown as Item[];

   /**
    * Sept 16: 19 reviewed items joined the 8 seeds, and a real session now runs
    * the full twelve. It did not before — the bank held 8 items against a
    * 12-item session and stopped early.
    */
   it("fills a whole session, using each item at most once", () => {
      const session = selectSession(bank, answerCorrectly, MISCONCEPTIONS, lcg(11));
      expect(session).toHaveLength(SESSION_LENGTH);

      const ids = session.map((a) => a.item.id);
      expect(new Set(ids).size).toBe(ids.length);
      const targets = session.map((a) => a.item.target.toLowerCase());
      expect(new Set(targets).size).toBe(targets.length);
   });

   /**
    * Asserted as a property rather than an exact list, because how MANY irregular
    * items a session gets varies: `irregular-word` is offered by 15 bank items
    * (11 decodable plus all 4 irregular) and the session-wide cap of 6 can claim
    * the budget before the fourth irregular slot is reached. What must always
    * hold is that an irregular item only ever lands ON the interleave.
    */
   it("places its irregular items only on interleave positions", () => {
      expect(bank.filter((i) => i.track === "irregular")).toHaveLength(4);

      for (let seed = 1; seed <= 25; seed += 1) {
         const session = selectSession(bank, answerCorrectly, MISCONCEPTIONS, lcg(seed));
         expect(session).toHaveLength(SESSION_LENGTH);

         const positions = session.flatMap((a, i) =>
            a.item.track === "irregular" ? [i + 1] : []
         );
         for (const p of positions) expect([3, 6, 9, 12]).toContain(p);
         expect(positions.length).toBeLessThanOrEqual(IRREGULAR_PER_SESSION);
      }
   });

   /**
    * Counted on the DECODABLE track only. `irregular-word` is native to the
    * irregular track, where the cap no longer governs it — see
    * `MAX_ITEMS_PER_MISCONCEPTION`. On the decodable track it is a guest and
    * still capped.
    */
   it("holds the half-session cap where the cap still governs", () => {
      for (let seed = 1; seed <= 25; seed += 1) {
         const session = selectSession(bank, answerWith("irregular-word"), MISCONCEPTIONS, lcg(seed));
         const guests = session.filter(
            (a) => a.item.track === "decodable" && misconceptionsOf(a.item).includes("irregular-word")
         );
         expect(guests.length).toBeLessThanOrEqual(MAX_ITEMS_PER_MISCONCEPTION);
      }
   });

   /** The other half of the same rule: on its own track it is not capped. */
   it("lets the irregular track fill all four of its slots", () => {
      let full = 0;
      const runs = 25;
      for (let seed = 1; seed <= runs; seed += 1) {
         const session = selectSession(bank, answerWith("irregular-word"), MISCONCEPTIONS, lcg(seed));
         if (session.filter((a) => a.item.track === "irregular").length === IRREGULAR_PER_SESSION) {
            full += 1;
         }
      }
      expect(full).toBe(runs);
   });
});

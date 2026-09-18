import { describe, expect, it } from "vitest";
import { validateBank, validateItem } from "./validate";
import type {
   DecodableItem,
   DecodableOption,
   IrregularItem,
   IrregularOption,
   Item,
   Misconception,
   Option,
} from "../types";
import itemsJson from "../data/items.json";
import misconceptionsJson from "../data/misconceptions.json";

/**
 * `resolveJsonModule` widens every string in the imported JSON to `string`, so
 * `vowelSound` and `track` lose their unions and the data will not assign to
 * `Item[]` on its own. Cast once, here at the boundary. The literals below are
 * written in TypeScript and so are checked properly.
 */
const bankItems = itemsJson as Item[];

/** Her eight, still the authority: if a rule fails one of these, the rule is wrong. */
const seedItems = bankItems.filter((i) => i.source === "seed");
const misconceptions = misconceptionsJson as Misconception[];

/**
 * A structurally valid item, hand-written. Every broken fixture derives from
 * this by changing exactly one field, so a failure can only be caused by that
 * change — the "base fixture is valid" test below is what makes that claim
 * hold.
 */
function validFixture(): DecodableItem {
   return {
      id: "fixture-boat",
      target: "boat",
      targetVowelSpelling: "oa",
      targetVowelSound: "long-o",
      audio: null,
      track: "decodable",
      source: "seed",
      options: [
         {
            word: "bot",
            vowelSpelling: "o",
            vowelSound: "short-o",
            correct: false,
            misconceptionId: "closed-syllable",
            parentAdvice: "Fixture advice for closed-syllable.",
         },
         {
            word: "boy",
            vowelSpelling: "oy",
            vowelSound: "oy",
            correct: false,
            misconceptionId: "vowel-team-assumed",
            parentAdvice: "Fixture advice for vowel-team-assumed.",
         },
         {
            word: "toe",
            vowelSpelling: "oe",
            vowelSound: "long-o",
            correct: true,
            misconceptionId: null,
            parentAdvice: null,
         },
      ],
   };
}

/** Change one option of an item, addressed by word. */
function breakOption(
   item: DecodableItem,
   word: string,
   patch: Partial<DecodableOption>
): DecodableItem {
   return {
      ...item,
      options: item.options.map((o) => (o.word === word ? { ...o, ...patch } : o)),
   };
}

describe("validateItem — the teacher's seed items", () => {
   it("has all nine of her seeds, four of them on the irregular track", () => {
      expect(seedItems.map((i) => [i.id, i.track])).toEqual([
         ["seed-boat", "decodable"],
         ["seed-bread", "decodable"],
         ["seed-rain", "decodable"],
         ["seed-pie", "decodable"],
         ["seed-snow", "decodable"],
         ["seed-what", "irregular"],
         ["seed-who", "irregular"],
         ["seed-the", "irregular"],
         ["seed-because", "irregular"],
      ]);
   });

   /**
    * Sept 17: the fourth irregular seed is what makes that track reachable at
    * all — three items cap at 1.5 weighted selections against a threshold of 2.
    */
   it("has a fourth irregular seed, spoken only and with audio named", () => {
      const because = seedItems.find((i) => i.id === "seed-because")!;
      expect(because.track).toBe("irregular");
      expect(because.target).toBe("because");
      // The extension is data — the recorded clip is .m4a (Sept 17).
      expect(because.audio).toBe("q-because.m4a");

      const options = because.options as Option[];
      expect(options.map((o) => o.word)).toEqual(["becuz", "bcuz", "because"]);
      expect(options.filter((o) => o.correct).map((o) => o.word)).toEqual(["because"]);
      for (const option of options) {
         // No vowel tags on this track: a sight word is on the list because its
         // letters do not predict its sound.
         expect(option).not.toHaveProperty("vowelSpelling");
         expect(option).not.toHaveProperty("vowelSound");
         // Rule 9/11: the correct option is evidence of nothing and carries no
         // advice; every distractor carries hers.
         if (option.correct) {
            expect(option.parentAdvice).toBeNull();
            expect(option.misconceptionId).toBeNull();
         } else {
            expect(option.misconceptionId).toBe("irregular-word");
            expect((option.parentAdvice ?? "").length).toBeGreaterThan(0);
         }
      }
      // Her mnemonic, on both distractors and identical.
      const advice = options.filter((o) => !o.correct).map((o) => o.parentAdvice);
      expect(new Set(advice).size).toBe(1);
      expect(advice[0]).toContain("Big elephants can't always use small exits.");
   });

   /** Sept 16-17: all 27 reviewed items joined the 8 seeds. */
   it("carries the reviewed generated items alongside them", () => {
      const generated = bankItems.filter((i) => i.source === "generated");
      expect(generated.length).toBe(27);
      expect(bankItems).toHaveLength(36);
      // Nothing entered the bank still carrying a seed's advice.
      for (const item of bankItems) {
         for (const option of item.options as Option[]) {
            expect(option.parentAdviceInherited).toBeUndefined();
         }
      }
   });

   /**
    * If one of these fails, the rule is wrong, not the item. Stop and flag it.
    * Do not edit `items.json` to make this pass. CLAUDE.md section 5.
    *
    * Every hard rule, no exceptions.
    *
    * Asserts on failures only. Rule 8 warnings are for a human to judge, so
    * they must never break the build.
    */
   it.each(bankItems.map((item) => [item.id, item] as const))(
      "%s breaks no hard rule",
      (_id, item) => {
         expect(validateItem(item, misconceptions).failures).toEqual([]);
      }
   );
});

describe("validateItem — deliberately broken fixtures", () => {
   it("the base fixture is valid, so each break below is caused by its one change", () => {
      const { failures, warnings } = validateItem(validFixture(), misconceptions);
      expect(failures).toEqual([]);
      expect(warnings).toEqual([]);
   });

   it("rule 5: correct option shares the target's vowelSpelling", () => {
      // `toe` retagged `oa`, so the child can letter-match to the right answer.
      const item = breakOption(validFixture(), "toe", { vowelSpelling: "oa" });
      const { failures } = validateItem(item, misconceptions);
      expect(failures).toEqual([expect.stringMatching(/^rule 5: correct option "toe"/)]);
   });

   it("rule 6: distractor has a null misconceptionId", () => {
      // `bot` is wrong but no longer says anything about why.
      const item = breakOption(validFixture(), "bot", { misconceptionId: null });
      const { failures } = validateItem(item, misconceptions);
      // Matches the null branch specifically. A looser pattern also matches
      // rule 6's other branch — `has(null)` is false, so a null id reports as
      // an unknown misconception — and the test then cannot tell them apart.
      expect(failures).toEqual([`rule 6: distractor "bot" has a null misconceptionId`]);
   });

   it("rule 9: correct option carries a misconceptionId", () => {
      // Picking the right answer would log a `closed-syllable` selection.
      const item = breakOption(validFixture(), "toe", { misconceptionId: "closed-syllable" });
      const { failures } = validateItem(item, misconceptions);
      expect(failures).toEqual([expect.stringMatching(/^rule 9: correct option "toe"/)]);
   });
});

/** A structurally valid irregular item, hand-written. Same one-change discipline. */
function validIrregularFixture(): IrregularItem {
   const option = (word: string, correct: boolean): IrregularOption => ({
      word,
      correct,
      misconceptionId: correct ? null : "irregular-word",
      parentAdvice: correct ? null : "Fixture advice for irregular-word.",
   });
   return {
      id: "fixture-was",
      target: "was",
      audio: "q-was.mp3",
      track: "irregular",
      source: "seed",
      options: [option("was", true), option("wuz", false), option("woz", false)],
   };
}

function breakIrregularOption(
   item: IrregularItem,
   word: string,
   patch: Partial<IrregularOption>
): IrregularItem {
   return {
      ...item,
      options: item.options.map((o) => (o.word === word ? { ...o, ...patch } : o)),
   };
}

describe("validateItem — irregular track", () => {
   it("the base fixture passes every hard rule, correct option spelling the target", () => {
      expect(validateItem(validIrregularFixture(), misconceptions).failures).toEqual([]);
   });

   it("does not apply rule 7 — the correct option is the target by design", () => {
      const { failures } = validateItem(validIrregularFixture(), misconceptions);
      expect(failures).not.toEqual(expect.arrayContaining([expect.stringMatching(/^rule 7:/)]));
   });

   it("rule 10: distractor is the target's real spelling", () => {
      const item = breakIrregularOption(validIrregularFixture(), "wuz", { word: "was" });
      expect(validateItem(item, misconceptions).failures).toEqual([
         `rule 10: distractor "was" is the real spelling of target "was", not a phonetic misspelling — two correct answers`,
      ]);
   });

   it("rule 11: distractor has empty parentAdvice", () => {
      const item = breakIrregularOption(validIrregularFixture(), "wuz", { parentAdvice: "  " });
      expect(validateItem(item, misconceptions).failures).toEqual([
         `rule 11: distractor "wuz" has an empty parentAdvice`,
      ]);
   });

   it("rule 12: correct option does not spell the target", () => {
      const item = breakIrregularOption(validIrregularFixture(), "was", { word: "wass" });
      expect(validateItem(item, misconceptions).failures).toEqual([
         `rule 12: correct option "wass" does not spell target "was" — the item has no right answer`,
      ]);
   });

   it("rule 13: audio missing despite the type, as JSON can deliver", () => {
      const item = { ...validIrregularFixture(), audio: null } as unknown as IrregularItem;
      expect(validateItem(item, misconceptions).failures).toEqual([
         `rule 13: irregular item "fixture-was" has no audio — the target is never shown, so it cannot be asked`,
      ]);
   });

   it("rule 13: audio is an empty string", () => {
      const item = { ...validIrregularFixture(), audio: "" };
      expect(validateItem(item, misconceptions).failures).toEqual([
         `rule 13: irregular item "fixture-was" has no audio — the target is never shown, so it cannot be asked`,
      ]);
   });
});

describe("validateBank — the current seed bank", () => {
   const report = validateBank(bankItems, misconceptions);

   it("references no misconception that does not exist", () => {
      expect(report.failures).toEqual([]);
   });

   it("reports per-track counts for every defined misconception, in file order", () => {
      expect(
         report.counts.map((c) => [
            c.misconceptionId,
            c.byTrack.decodable.items,
            c.byTrack.irregular.items,
         ])
      ).toEqual([
         ["closed-syllable", 25, 0],
         ["vowel-team-assumed", 13, 0],
         ["ea-three-sounds", 10, 0],
         ["irregular-word", 11, 4],
         ["ie-two-sounds", 5, 0],
      ]);
   });

   /**
    * Since the reviewed items landed, every misconception clears the per-track
    * minimum on the track it is used on — the warnings this once printed are
    * gone, and a new one appearing means the bank went backwards.
    */
   it("no longer warns about under-representation, and never fails", () => {
      expect(report.failures).toEqual([]);
      expect(report.warnings).toEqual([]);
   });

   it("does not flag closed-syllable, now at twenty-five decodable items", () => {
      const closed = report.counts.find((c) => c.misconceptionId === "closed-syllable");
      expect(closed).toMatchObject({
         underRepresented: false,
         byTrack: { decodable: { items: 25, underRepresented: false } },
      });
   });

   /** Four irregular seeds, each offering irregular-word on two distractors. */
   it("counts each irregular item once, not once per carrier", () => {
      const irregularWord = report.counts.find((c) => c.misconceptionId === "irregular-word");
      expect(irregularWord?.byTrack.irregular).toEqual({ items: 4, underRepresented: false });
   });

   it("irregular-word now clears the minimum on both tracks", () => {
      const irregularWord = report.counts.find((c) => c.misconceptionId === "irregular-word");
      expect(irregularWord).toMatchObject({
         underRepresented: false,
         byTrack: {
            decodable: { items: 11, underRepresented: false },
            irregular: { items: 4, underRepresented: false },
         },
      });
   });

   /**
    * Section 6 wants these counts reported. Written to stderr, not
    * `console.log`: vitest's default reporter swallows console output from
    * passing tests, so the report would only ever appear under
    * `--reporter=verbose`. stderr passes through, so a plain `npm run test`
    * shows it.
    */
   it("prints the count report", () => {
      const cell = (t: { items: number; underRepresented: boolean }) =>
         `${String(t.items).padStart(2)} ${t.underRepresented ? "under" : "     "}`;
      const lines = report.counts.map(
         (c) =>
            `  ${c.misconceptionId.padEnd(20)} ${cell(c.byTrack.decodable)}   ${cell(c.byTrack.irregular)}`
      );
      process.stderr.write(
         ["", "  per-track item counts  decodable  irregular", ...lines, ""].join("\n") + "\n"
      );
      expect(lines).toHaveLength(misconceptions.length);
   });
});

describe("validateBank — counting rules", () => {
   /** Two distractors sharing a misconception in one item is still one item. */
   it("counts distinct items, not distractor occurrences", () => {
      const item = breakOption(validFixture(), "boy", {
         misconceptionId: "closed-syllable",
      });
      const report = validateBank([item], misconceptions);
      const closed = report.counts.find((c) => c.misconceptionId === "closed-syllable");
      expect(closed?.items).toBe(1);
   });

   it("stops warning once a misconception reaches three items", () => {
      const bank = ["a", "b", "c"].map((suffix) => ({
         ...validFixture(),
         id: `fixture-${suffix}`,
      }));
      const report = validateBank(bank, misconceptions);
      const closed = report.counts.find((c) => c.misconceptionId === "closed-syllable");
      expect(closed).toMatchObject({ items: 3, used: true, underRepresented: false });
      // `toContain` compares by equality, so an asymmetric matcher inside it
      // never matches and `.not.toContain` would pass vacuously.
      expect(report.warnings).not.toEqual(
         expect.arrayContaining([expect.stringContaining('"closed-syllable"')])
      );
   });

   it("fails on a distractor referencing a misconception that does not exist", () => {
      const item = breakOption(validFixture(), "bot", { misconceptionId: "not-a-real-id" });
      const report = validateBank([item], misconceptions);
      expect(report.failures).toEqual([
         expect.stringMatching(/^bank: item "fixture-boat" distractor "bot" references unknown/),
      ]);
   });

   /**
    * A defined-but-unused misconception is reported with a zero count but not
    * warned about: section 6 scopes the 3-item rule to misconceptions "used in
    * the bank". See the decisions log.
    */
   /**
    * The minimum is per track (section 6): two decodable items and one irregular
    * item total three, but are not three items of evidence on either track.
    */
   it("applies the three-item minimum per track, not across the bank", () => {
      const decodable = ["a", "b"].map((suffix) => ({
         ...breakOption(validFixture(), "boy", { misconceptionId: "irregular-word" }),
         id: `fixture-${suffix}`,
      }));
      const report = validateBank([...decodable, validIrregularFixture()], misconceptions);
      const irregularWord = report.counts.find((c) => c.misconceptionId === "irregular-word");
      expect(irregularWord).toMatchObject({
         items: 3,
         underRepresented: true,
         byTrack: {
            decodable: { items: 2, underRepresented: true },
            irregular: { items: 1, underRepresented: true },
         },
      });
      expect(report.warnings).toEqual(
         expect.arrayContaining([
            `bank: misconception "irregular-word" appears as a distractor in 2 decodable item(s), needs at least 3 per track`,
            `bank: misconception "irregular-word" appears as a distractor in 1 irregular item(s), needs at least 3 per track`,
         ])
      );
   });

   it("a misconception used on one track is not under-represented on the other", () => {
      const bank = ["a", "b", "c"].map((suffix) => ({ ...validFixture(), id: `fixture-${suffix}` }));
      const closed = validateBank(bank, misconceptions).counts.find(
         (c) => c.misconceptionId === "closed-syllable"
      );
      expect(closed?.byTrack.irregular).toEqual({ items: 0, underRepresented: false });
      expect(closed?.underRepresented).toBe(false);
   });

   it("fails an item whose option still carries inherited advice", () => {
      const item = breakOption(validFixture(), "bot", { parentAdviceInherited: true });
      expect(validateBank([item], misconceptions).failures).toEqual([
         `bank: item "fixture-boat" option "bot" still carries inherited parentAdvice — the reviewer must replace it before the item enters the bank`,
      ]);
   });

   it("accepts the item once the reviewer has cleared the flag", () => {
      const replaced = breakOption(validFixture(), "bot", {
         parentAdvice: "Reviewer-replaced advice.",
         parentAdviceInherited: false,
      });
      expect(validateBank([replaced], misconceptions).failures).toEqual([]);
   });

   /** Candidates carry the flag until review; failing them per item would count
    *  every generated candidate as a machine rejection. */
   it("is a bank-entry rule, not an item rule", () => {
      const item = breakOption(validFixture(), "bot", { parentAdviceInherited: true });
      expect(validateItem(item, misconceptions).failures).toEqual([]);
   });

   it("reports an unused misconception with a zero count and no warning", () => {
      const report = validateBank([], misconceptions);
      expect(report.counts.every((c) => c.items === 0 && !c.used)).toBe(true);
      expect(report.warnings).toEqual([]);
      expect(report.failures).toEqual([]);
   });
});

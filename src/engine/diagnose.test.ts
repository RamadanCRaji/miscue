import { describe, expect, it } from "vitest";
import {
   DECODABLE_CONFIRMED_SELECTIONS,
   DECODABLE_SUSPECTED_SELECTIONS,
   IRREGULAR_CONFIRMED_SELECTIONS,
   IRREGULAR_PARENT_SENTENCE,
   IRREGULAR_SUSPECTED_SELECTIONS,
   RULED_OUT_EXPOSURES,
   diagnose,
   forParent,
} from "./diagnose";
import type { Answer, Confidence, Diagnosis, MisconceptionEvidence } from "./diagnose";
import type { DecodableItem, IrregularItem, Misconception, Track } from "../types";
import misconceptionData from "../data/misconceptions.json";

/**
 * The real records, not a fixture. The wording *is* what these tests check, so a
 * deficit phrase written into a `strengthLabel` must fail here rather than pass
 * against a hand-written stand-in and reach a parent.
 */
const MISCONCEPTIONS = misconceptionData as Misconception[];

/** Every test's parent view, with her actual labels attached. */
const parent = (diagnosis: Diagnosis) => forParent(diagnosis, MISCONCEPTIONS);

/**
 * Fixtures are hand-written rather than taken from the bank: a diagnosis test
 * must not change meaning because an item was retagged.
 */
function decodableItem(id: string, misconceptionId = "closed-syllable"): DecodableItem {
   return {
      id,
      target: "boat",
      targetVowelSpelling: "oa",
      targetVowelSound: "long-o",
      audio: null,
      track: "decodable",
      source: "seed",
      options: [
         {
            word: `wrong-${id}`,
            vowelSpelling: "o",
            vowelSound: "short-o",
            correct: false,
            misconceptionId,
            parentAdvice: `advice for ${misconceptionId}`,
         },
         {
            word: `other-${id}`,
            vowelSpelling: "oy",
            vowelSound: "oy",
            correct: false,
            misconceptionId: "vowel-team-assumed",
            parentAdvice: "advice for vowel-team-assumed",
         },
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

/** Both distractors carry one misconception — the irregular track's shape. */
function twoCarrierItem(id: string, advice = ["advice A", "advice B"]): IrregularItem {
   return {
      id,
      target: "what",
      audio: "q-what.mp3",
      track: "irregular",
      source: "seed",
      options: [
         { word: `wut-${id}`, correct: false, misconceptionId: "irregular-word", parentAdvice: advice[0] ?? null },
         { word: `whut-${id}`, correct: false, misconceptionId: "irregular-word", parentAdvice: advice[1] ?? null },
         { word: "what", correct: true, misconceptionId: null, parentAdvice: null },
      ],
   };
}

const pickWrong = (item: DecodableItem): Answer => ({ item, pickedWord: `wrong-${item.id}` });
const pickRight = (item: DecodableItem): Answer => ({ item, pickedWord: `right-${item.id}` });

const closed = (d: ReturnType<typeof diagnose>) =>
   d.decodable.evidence.find((e) => e.misconceptionId === "closed-syllable");

describe("diagnose — the four confidence states (decodable track)", () => {
   it("confirms at three selections across different items", () => {
      const answers = ["a", "b", "c"].map((id) => pickWrong(decodableItem(id)));
      const evidence = closed(diagnose(answers));
      expect(evidence).toMatchObject({
         confidence: "confirmed",
         selections: DECODABLE_CONFIRMED_SELECTIONS,
         exposures: 3,
         itemsSelectedIn: 3,
      });
   });

   it("suspects at two, and keeps it off the parent screen", () => {
      const answers = ["a", "b"].map((id) => pickWrong(decodableItem(id)));
      const diagnosis = diagnose(answers);
      expect(closed(diagnosis)).toMatchObject({
         confidence: "suspected",
         selections: DECODABLE_SUSPECTED_SELECTIONS,
      });
      expect(parent(diagnosis).decodable.confirmed).toEqual([]);
      expect(parent(diagnosis).decodable.ruledOut).toEqual([]);
   });

   it("rules out after three exposures with no selections, as a strength", () => {
      const answers = ["a", "b", "c"].map((id) => pickRight(decodableItem(id)));
      const diagnosis = diagnose(answers);
      expect(closed(diagnosis)).toMatchObject({
         confidence: "ruled-out",
         selections: 0,
         exposures: RULED_OUT_EXPOSURES,
      });
      expect(parent(diagnosis).decodable.ruledOut.map((e) => e.misconceptionId)).toEqual([
         "closed-syllable",
         "vowel-team-assumed",
      ]);
   });

   it("reports nothing on one selection, or on too few exposures", () => {
      const onePick = closed(diagnose([pickWrong(decodableItem("a"))]));
      expect(onePick).toMatchObject({ confidence: "insufficient", selections: 1, exposures: 1 });

      const twoClean = closed(diagnose(["a", "b"].map((id) => pickRight(decodableItem(id)))));
      expect(twoClean).toMatchObject({ confidence: "insufficient", selections: 0, exposures: 2 });
   });

   it("a correct answer is evidence against, not just an absence of evidence", () => {
      // Picked twice, then avoided four times: still only two selections.
      const answers = [
         ...["a", "b"].map((id) => pickWrong(decodableItem(id))),
         ...["c", "d", "e", "f"].map((id) => pickRight(decodableItem(id))),
      ];
      const evidence = closed(diagnose(answers));
      expect(evidence).toMatchObject({ confidence: "suspected", selections: 2, exposures: 6 });
   });
});

/** n picks across n distinct irregular items, each offering two carriers. */
function irregularPicks(n: number) {
   const answers: Answer[] = Array.from({ length: n }, (_, i) => ({
      item: twoCarrierItem(`i${i}`),
      pickedWord: `wut-i${i}`,
   }));
   const evidence = diagnose(answers).irregular.evidence[0];
   if (!evidence) throw new Error("no irregular evidence");
   return evidence;
}

describe("diagnose — weighting and the irregular thresholds", () => {
   it("counts a pick as 1 / carriers, so a guesser does not confirm faster", () => {
      const evidence = irregularPicks(3);
      expect(evidence).toMatchObject({
         misconceptionId: "irregular-word",
         selections: 1.5,
         rawSelections: 3,
      });
   });

   /**
    * The session holds 4 irregular items and each pick weighs 0.5, so weighted
    * selections cap at 2.0. Confirming requires every irregular item wrong.
    */
   it("confirms on four picks across four irregular items, but not on three", () => {
      expect(irregularPicks(4)).toMatchObject({
         selections: IRREGULAR_CONFIRMED_SELECTIONS,
         rawSelections: 4,
         confidence: "confirmed",
      });
      expect(irregularPicks(3)).toMatchObject({
         selections: IRREGULAR_SUSPECTED_SELECTIONS,
         confidence: "suspected",
      });
   });

   it("would be unreachable at the decodable threshold", () => {
      // 4 items is the whole irregular half of a session; 2.0 is the ceiling.
      expect(irregularPicks(4).selections).toBeLessThan(DECODABLE_CONFIRMED_SELECTIONS);
   });

   it("counts exposure once per item, not once per carrier", () => {
      const answers: Answer[] = ["a", "b", "c"].map((id) => ({
         item: twoCarrierItem(id),
         pickedWord: "what",
      }));
      const evidence = diagnose(answers).irregular.evidence[0];
      expect(evidence).toMatchObject({ exposures: 3, selections: 0, confidence: "ruled-out" });
   });
});

describe("diagnose — one activity for the parent", () => {
   const confirmIrregular = (picks: string[]): Answer[] =>
      picks.map((word, i) => ({ item: twoCarrierItem(String(i)), pickedWord: `${word}-${i}` }));

   it("returns the most-picked distractor's advice", () => {
      // six picks: four of wut, two of whut — well past the irregular threshold
      const answers = confirmIrregular(["wut", "wut", "whut", "wut", "whut", "wut"]);
      const evidence = diagnose(answers).irregular.evidence[0];
      expect(evidence?.confidence).toBe("confirmed");
      expect(evidence?.advice).toBe("advice A");
   });

   it("breaks a tie on the most recent pick", () => {
      // three each; whut picked last
      const answers = confirmIrregular(["wut", "whut", "wut", "whut", "wut", "whut"]);
      const evidence = diagnose(answers).irregular.evidence[0];
      expect(evidence?.confidence).toBe("confirmed");
      expect(evidence?.advice).toBe("advice B");
   });

   it("gives the parent exactly one activity, never several", () => {
      const answers = confirmIrregular(["wut", "whut", "wut", "whut", "wut", "whut"]);
      const report = parent(diagnose(answers));
      expect(report.irregular.confirmed).toHaveLength(1);
      expect(typeof report.irregular.confirmed[0]?.advice).toBe("string");
   });

   it("withholds advice until confirmed", () => {
      const answers = ["a", "b"].map((id) => pickWrong(decodableItem(id)));
      expect(closed(diagnose(answers))?.advice).toBeNull();
   });

   it("lists the words where the pattern appeared", () => {
      const answers = ["a", "b", "c"].map((id) => pickWrong(decodableItem(id)));
      expect(closed(diagnose(answers))?.picks).toEqual([
         { itemId: "a", target: "boat", word: "wrong-a" },
         { itemId: "b", target: "boat", word: "wrong-b" },
         { itemId: "c", target: "boat", word: "wrong-c" },
      ]);
   });
});

describe("diagnose — tracks are independent", () => {
   it("never pools evidence across tracks", () => {
      // Two decodable picks and two irregular picks of the same misconception:
      // four in total, but neither track reaches three.
      const answers: Answer[] = [
         ...["a", "b"].map((id) => pickWrong(decodableItem(id, "irregular-word"))),
         ...["c", "d"].map((id) => ({
            item: twoCarrierItem(id),
            pickedWord: `wut-${id}`,
         })),
      ];
      const d = diagnose(answers);
      expect(d.decodable.evidence.find((e) => e.misconceptionId === "irregular-word")).toMatchObject(
         { selections: 2, confidence: "suspected" }
      );
      // 1.0 weighted, below the irregular suspected threshold of 1.5
      expect(d.irregular.evidence[0]).toMatchObject({ selections: 1, confidence: "insufficient" });
      expect(parent(d).decodable.confirmed).toEqual([]);
      expect(parent(d).irregular.confirmed).toEqual([]);
   });

   it("counts only answers from its own track", () => {
      const d = diagnose([pickWrong(decodableItem("a"))]);
      expect(d.decodable.itemsAnswered).toBe(1);
      expect(d.irregular.itemsAnswered).toBe(0);
      expect(d.irregular.evidence).toEqual([]);
   });
});

describe("diagnose — bad input", () => {
   it("throws when the picked word is not an option on the item", () => {
      expect(() => diagnose([{ item: decodableItem("a"), pickedWord: "nope" }])).toThrow(
         /not an option on item "a"/
      );
   });
});

/** n picks across n distinct irregular items — 4 confirms on that track. */
function irregularAnswers(n: number): Answer[] {
   return Array.from({ length: n }, (_, i) => ({
      item: twoCarrierItem(`h${i}`),
      pickedWord: `wut-h${i}`,
   }));
}

describe("forParent — the two tracks are worded differently", () => {
   it("gives the irregular track the teacher's sentence, verbatim, once confirmed", () => {
      const report = parent(diagnose(irregularAnswers(4)));
      expect(report.irregular.confirmed).toHaveLength(1);
      expect(report.irregular.headline).toBe("Your child needs to practice learning irregular words.");
      expect(report.irregular.headline).toBe(IRREGULAR_PARENT_SENTENCE);
   });

   /**
    * The sentence is a finding, not a banner. Showing it with nothing confirmed
    * would tell a parent something the diagnosis did not find.
    */
   it("withholds the irregular sentence when nothing is confirmed on that track", () => {
      expect(parent(diagnose([])).irregular.headline).toBeNull();

      // Suspected is not confirmed: three picks reach 1.5, and stay silent.
      const suspected = parent(diagnose(irregularAnswers(3)));
      expect(suspected.irregular.confirmed).toEqual([]);
      expect(suspected.irregular.headline).toBeNull();

      // Ruled out is a strength, not a reason to say practice is needed.
      const ruledOut = parent(
         diagnose(["a", "b", "c"].map((id) => ({ item: twoCarrierItem(id), pickedWord: "what" })))
      );
      expect(ruledOut.irregular.ruledOut).toHaveLength(1);
      expect(ruledOut.irregular.headline).toBeNull();
   });

   /**
    * Decodable has no track headline: each confirmed misconception is named by
    * its own label, which names the rule being misapplied.
    */
   it("leaves the decodable track to its misconception labels, confirmed or not", () => {
      expect(parent(diagnose([])).decodable.headline).toBeNull();
      const confirmed = parent(diagnose(["a", "b", "c"].map((id) => pickWrong(decodableItem(id)))));
      expect(confirmed.decodable.confirmed).toHaveLength(1);
      expect(confirmed.decodable.headline).toBeNull();
   });

   it("does not phrase the irregular sentence as a broken rule", () => {
      const sentence = parent(diagnose(irregularAnswers(4))).irregular.headline ?? "";
      expect(sentence).not.toBe("");
      for (const word of ["doesn't", "does not", "hasn't", "has not", "guesses", "misconception"]) {
         expect(sentence.toLowerCase()).not.toContain(word);
      }
   });
});

/* -- labels ---------------------------------------------------------------- */

function evidenceOf(misconceptionId: string, confidence: Confidence): MisconceptionEvidence {
   return {
      misconceptionId,
      confidence,
      selections: confidence === "ruled-out" ? 0 : DECODABLE_CONFIRMED_SELECTIONS,
      rawSelections: confidence === "ruled-out" ? 0 : DECODABLE_CONFIRMED_SELECTIONS,
      exposures: RULED_OUT_EXPOSURES,
      itemsSelectedIn: confidence === "ruled-out" ? 0 : DECODABLE_CONFIRMED_SELECTIONS,
      picks: [],
      advice: null,
   };
}

/** A diagnosis asserted directly, so every misconception can be covered. */
function diagnosisOf(track: Track, evidence: MisconceptionEvidence[]): Diagnosis {
   const empty = (t: Track) => ({ track: t, itemsAnswered: 0, evidence: [] });
   const filled = { track, itemsAnswered: evidence.length, evidence };
   return track === "decodable"
      ? { decodable: filled, irregular: empty("irregular") }
      : { decodable: empty("decodable"), irregular: filled };
}

const findingsFor = (m: Misconception, confidence: Confidence) => {
   const report = parent(diagnosisOf(m.track, [evidenceOf(m.id, confidence)]))[m.track];
   return confidence === "ruled-out" ? report.ruledOut : report.confirmed;
};

describe("forParent — a strength is never worded as a deficit", () => {
   /** The bug this exists to prevent: "strength: Does not have an understanding…". */
   it("renders every ruled-out misconception with its strength label", () => {
      for (const m of MISCONCEPTIONS) {
         const [finding] = findingsFor(m, "ruled-out");
         expect(finding?.label).toBe(m.strengthLabel);
         expect(finding?.label).not.toBe(m.label);
      }
   });

   it("never lets a deficit label reach a ruled-out result", () => {
      const deficitLabels = new Set(MISCONCEPTIONS.map((m) => m.label));
      for (const m of MISCONCEPTIONS) {
         const [finding] = findingsFor(m, "ruled-out");
         expect(deficitLabels.has(finding?.label ?? "")).toBe(false);
      }
   });

   /**
    * Wording, not just field plumbing: swapping the two strings in the data
    * would satisfy the checks above. A strength must not be phrased as a lack.
    *
    * Only the clause describing **the child** is checked — the text up to the
    * first "that". A negation after it can be perfectly correct and is not about
    * the child: "Recognizes that some words *cannot* be fully decoded" is a
    * capability, and the word it negates is "words", not the reader's child.
    */
   it("states each strength as a capability, not as an absence", () => {
      for (const m of MISCONCEPTIONS) {
         const [finding] = findingsFor(m, "ruled-out");
         const label = (finding?.label ?? "").toLowerCase();
         expect(label).not.toBe("");

         const aboutTheChild = label.split(/\bthat\b/)[0] ?? label;
         for (const phrase of [
            "does not",
            "doesn't",
            "has not",
            "hasn't",
            "cannot",
            "can't",
            "guesses",
            "assumes",
            "unable",
            "struggles",
            "no understanding",
         ]) {
            expect(aboutTheChild).not.toContain(phrase);
         }
      }
   });

   it("keeps the deficit label for a confirmed misconception", () => {
      for (const m of MISCONCEPTIONS) {
         const [finding] = findingsFor(m, "confirmed");
         expect(finding?.label).toBe(m.label);
         expect(finding?.label).not.toBe(m.strengthLabel);
      }
   });

   it("labels the same misconception differently depending on the finding", () => {
      const [m] = MISCONCEPTIONS;
      expect(findingsFor(m!, "confirmed")[0]?.label).not.toBe(
         findingsFor(m!, "ruled-out")[0]?.label
      );
   });

   it("throws rather than showing a parent a bare id it cannot describe", () => {
      const orphan = diagnosisOf("decodable", [evidenceOf("not-a-misconception", "ruled-out")]);
      expect(() => parent(orphan)).toThrow(/no misconception describes/);
   });

   it("throws rather than showing a parent an empty label", () => {
      const blank: Misconception[] = [
         { id: "closed-syllable", label: "x", strengthLabel: "  ", teacherNote: "", track: "decodable" },
      ];
      const ruledOut = diagnosisOf("decodable", [evidenceOf("closed-syllable", "ruled-out")]);
      expect(() => forParent(ruledOut, blank)).toThrow(/has no strengthLabel/);
   });

   it("covers every misconception in the data", () => {
      expect(MISCONCEPTIONS.length).toBeGreaterThan(0);
      for (const m of MISCONCEPTIONS) {
         expect(m.strengthLabel.trim()).not.toBe("");
      }
   });

   /**
    * Sept 16 decision: both label sets are punctuated alike, because a confirmed
    * finding and a strength can sit one under the other on the parent screen and
    * a stray missing period reads as a typo. Asserted so a later edit cannot
    * quietly undo it.
    */
   it("punctuates every parent-facing label the same way", () => {
      for (const m of MISCONCEPTIONS) {
         expect(m.label.trimEnd().endsWith(".")).toBe(true);
         expect(m.strengthLabel.trimEnd().endsWith(".")).toBe(true);
      }
   });
});

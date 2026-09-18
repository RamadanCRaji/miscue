import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { ACTIVITY_TIME, ParentScreen, durationPhrase, evidenceSentence } from "./ParentScreen.tsx";
import {
   IRREGULAR_PARENT_SENTENCE,
   diagnose,
   forParent,
} from "../engine/diagnose.ts";
import type { Answer, ParentReport } from "../engine/diagnose.ts";
import { selectSession } from "../engine/select.ts";
import type { Item, Misconception, Option } from "../types.ts";
import itemBank from "../data/items.json";
import misconceptionData from "../data/misconceptions.json";

/**
 * The parent screen renders what `forParent()` returns and nothing else, so
 * these tests drive it from real sessions through the real engine rather than
 * from hand-built reports: what a parent sees has to be what the evidence said.
 */

const BANK = itemBank as unknown as Item[];
const MISCONCEPTIONS = misconceptionData as Misconception[];

function lcg(seed: number): () => number {
   let state = seed >>> 0;
   return () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
   };
}

const optionsOf = (item: Item): Option[] => item.options;

/** A child who takes one misconception's bait whenever it is offered. */
function sessionHolding(misconceptionId: string, seed = 3): Answer[] {
   return selectSession(
      BANK,
      (item) =>
         (
            optionsOf(item).find((o) => !o.correct && o.misconceptionId === misconceptionId) ??
            optionsOf(item).find((o) => o.correct)!
         ).word,
      MISCONCEPTIONS,
      lcg(seed)
   );
}

function sessionAnsweringCorrectly(seed = 3): Answer[] {
   return selectSession(
      BANK,
      (item) => optionsOf(item).find((o) => o.correct)!.word,
      MISCONCEPTIONS,
      lcg(seed)
   );
}

const reportFor = (answers: Answer[]): ParentReport =>
   forParent(diagnose(answers), MISCONCEPTIONS);

/* -- the irregular fixture ------------------------------------------------ */

/**
 * Built by hand, not played from the bank, and that is the point: every
 * irregular item carries two `irregular-word` distractors so a pick weighs
 * 0.5, and `items.json` holds only THREE irregular items — 1.5 weighted,
 * short of the 2.0 that confirms. **The shipped bank cannot confirm this
 * track at all** until a fourth irregular item is reviewed in (see the Sept 16
 * coverage finding in TASKS.md).
 *
 * So the fourth item here is a test fixture, not bank content and never
 * appended to it: its target is from the teacher's sight-word list in
 * CLAUDE.md section 8 and its advice is copied verbatim from a real seed
 * distractor, so nothing about the teacher's words is invented.
 */
function irregularSession(): Answer[] {
   const real = BANK.filter((i) => i.track === "irregular");
   const advice =
      optionsOf(real[0]!).find((o) => !o.correct)!.parentAdvice ?? "";

   const fixture: Item = {
      id: "fixture-was",
      track: "irregular",
      source: "seed",
      target: "was",
      audio: "q-was.mp3",
      options: [
         { word: "wuz", correct: false, misconceptionId: "irregular-word", parentAdvice: advice },
         { word: "woz", correct: false, misconceptionId: "irregular-word", parentAdvice: advice },
         { word: "was", correct: true, misconceptionId: null, parentAdvice: null },
      ],
   };

   return [...real, fixture].map((item) => ({
      item,
      pickedWord: optionsOf(item).find((o) => !o.correct)!.word,
   }));
}


let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
   globalThis.IS_REACT_ACT_ENVIRONMENT = true;
   container = document.createElement("div");
   document.body.appendChild(container);
   root = createRoot(container);
});

afterEach(() => {
   act(() => root.unmount());
   container.remove();
});

const $ = <T extends Element>(s: string) => container.querySelector<T>(s);
const $$ = <T extends Element>(s: string) => [...container.querySelectorAll<T>(s)];
const text = () => container.textContent ?? "";

function render(answers: Answer[], elapsedMs = 4 * 60_000) {
   act(() => {
      root.render(
         <ParentScreen report={reportFor(answers)} elapsedMs={elapsedMs} />
      );
   });
}

describe("ParentScreen — what it must never show", () => {
   it("shows no score, percentage or count of correct answers", () => {
      render(sessionHolding("closed-syllable"));
      expect(text()).not.toMatch(/score|percent|%|correct|out of \d+ right|streak/i);
   });

   it("shows no zoo furniture — this is not the child's screen", () => {
      render(sessionHolding("closed-syllable"));
      expect($(".scene")).toBeNull();
      expect($('svg[aria-label="Your zookeeper"]')).toBeNull();
      expect(text()).not.toMatch(/zoo|star|zookeeper/i);
   });

   /**
    * Built to land exactly on `suspected` rather than played from the bank: the
    * bank is deep enough now that a consistent child confirms most patterns, and
    * the rule under test is about the half-formed ones.
    */
   it("never shows a suspected pattern, only what forParent lets through", () => {
      const target = "vowel-team-assumed";
      const carriers = BANK.filter((item) =>
         optionsOf(item).some((o) => !o.correct && o.misconceptionId === target)
      ).slice(0, 2);
      expect(carriers).toHaveLength(2);

      // Two weighted selections: suspected, and one short of confirmed.
      const answers: Answer[] = carriers.map((item) => ({
         item,
         pickedWord: optionsOf(item).find((o) => !o.correct && o.misconceptionId === target)!.word,
      }));

      const internal = diagnose(answers).decodable.evidence.find(
         (e) => e.misconceptionId === target
      );
      expect(internal?.confidence).toBe("suspected");

      render(answers);
      expect(text()).not.toContain(MISCONCEPTIONS.find((m) => m.id === target)!.label);
   });
});

describe("ParentScreen — a confirmed finding", () => {
   const answers = () => sessionHolding("closed-syllable");

   it("headlines it with the teacher's deficit label", () => {
      render(answers());
      const misconception = MISCONCEPTIONS.find((m) => m.id === "closed-syllable")!;
      expect($(".headline")!.textContent).toBe(misconception.label);
   });

   it("gives the words where the pattern appeared, and out of how many chances", () => {
      const session = answers();
      render(session);
      const finding = reportFor(session).decodable.confirmed[0]!;
      const line = $(".evidence")!.textContent ?? "";

      for (const pick of finding.picks) {
         expect(line).toContain(`${pick.word} for ${pick.target}`);
      }
      expect(line).toContain(`the ${finding.exposures} words where it could come up`);
   });

   it("gives exactly one activity, in the teacher's words, in full", () => {
      const session = answers();
      render(session);
      const finding = reportFor(session).decodable.confirmed[0]!;

      const activities = $$(".activity__text");
      expect(activities).toHaveLength(1);
      expect(activities[0]!.textContent).toBe(finding.advice);
      // Verbatim and whole — not a first line with the rest hidden away.
      expect(activities[0]!.textContent!.length).toBeGreaterThan(300);
      expect($$("details")).toHaveLength(0);
   });

   it("shows exactly one activity however many findings there are", () => {
      for (const id of ["closed-syllable", "irregular-word"]) {
         for (let seed = 1; seed <= 6; seed += 1) {
            render(sessionHolding(id, seed));
            expect($$(".activity").length).toBeLessThanOrEqual(1);
            expect($$(".activity__text").length).toBeLessThanOrEqual(1);
         }
      }
   });
});

describe("ParentScreen — the irregular track keeps its own wording", () => {
   it("uses the teacher's sentence as the headline", () => {
      const session = irregularSession();
      const report = reportFor(session);
      expect(report.irregular.confirmed.length).toBeGreaterThan(0);

      render(session);
      expect(text()).toContain(IRREGULAR_PARENT_SENTENCE);
   });

   /**
    * Sept 17: this used to record the opposite — that the shipped bank could
    * NOT confirm this track. The fourth irregular seed plus lifting the
    * half-session cap on it closed that gap, so the real bank now reaches the
    * parent screen, and the headline appears there for the first time.
    */
   it("is confirmed from the shipped bank, and reaches the parent screen", () => {
      const fromBank = reportFor(sessionHolding("irregular-word"));
      expect(fromBank.irregular.confirmed).toHaveLength(1);
      expect(fromBank.irregular.headline).toBe(IRREGULAR_PARENT_SENTENCE);
   });

   it("does not put the deficit label back underneath it", () => {
      const session = irregularSession();
      render(session);
      const deficit = MISCONCEPTIONS.find((m) => m.id === "irregular-word")!.label;
      // The headline exists to avoid that framing; repeating it undoes the point.
      expect(text()).not.toContain(deficit);
   });

   it("is not phrased as a problem", () => {
      render(irregularSession());
      const headline = $$(".headline").map((h) => h.textContent ?? "");
      const sentence = headline.find((h) => h === IRREGULAR_PARENT_SENTENCE) ?? "";
      expect(sentence).not.toBe("");
      for (const word of ["doesn't", "does not", "hasn't", "has not", "fail", "problem"]) {
         expect(sentence.toLowerCase()).not.toContain(word);
      }
   });
});

describe("ParentScreen — strengths", () => {
   it("reports a ruled-out misconception with its strength label", () => {
      const session = sessionAnsweringCorrectly();
      const report = reportFor(session);
      const ruledOut = [...report.decodable.ruledOut, ...report.irregular.ruledOut];
      expect(ruledOut.length).toBeGreaterThan(0);

      render(session);
      const shown = $$(".strength").map((li) => li.textContent?.trim());
      for (const strength of ruledOut) {
         expect(shown).toContain(strength.label);
         expect(text()).not.toContain(
            MISCONCEPTIONS.find((m) => m.id === strength.misconceptionId)!.label
         );
      }
   });

   it("keeps strengths quieter than findings, but present", () => {
      // This session rules out two, so one leads and one sits below the activity.
      render(sessionAnsweringCorrectly());
      expect($$(".strength").length).toBeGreaterThan(0);

      const quiet = $(".block--quiet")!;
      expect(quiet).not.toBeNull();
      // Quieter means no headline treatment and no activity of their own.
      expect(quiet.querySelector(".headline")).toBeNull();
      expect(quiet.querySelector(".activity")).toBeNull();
   });
});

describe("ParentScreen — nothing confirmed is a real outcome", () => {
   it("says so plainly rather than looking broken", () => {
      const session = sessionAnsweringCorrectly();
      const report = reportFor(session);
      expect(report.decodable.confirmed).toEqual([]);
      expect(report.irregular.confirmed).toEqual([]);

      render(session);
      expect(text()).toContain("Nothing to flag today");
      expect($$(".activity")).toHaveLength(0);
      expect(text()).not.toMatch(/error|no data|unavailable|failed/i);
   });

   it("does not promote an absence of findings into a clean bill of health", () => {
      render(sessionAnsweringCorrectly());
      expect(text()).not.toMatch(/no problems|all good|perfect|nothing wrong|doing fine/i);
   });

   it("still shows the strengths that were ruled out", () => {
      render(sessionAnsweringCorrectly());
      expect($$(".strength").length).toBeGreaterThan(0);
   });
});

describe("ParentScreen — the opening line", () => {
   it("names what this is and how long, with no numeral at all", () => {
      render(sessionHolding("closed-syllable"), 3 * 60_000 + 20_000);
      const framing = $(".parent__framing")!.textContent ?? "";
      expect(framing).toContain("about three minutes");
      // 10.2: non-numeric. A numeral here reads as a measurement.
      expect(framing).not.toMatch(/\d/);
   });

   it("spells the duration out", () => {
      expect(durationPhrase(20_000)).toBe("about a minute");
      expect(durationPhrase(60_000)).toBe("about one minute");
      expect(durationPhrase(5 * 60_000)).toBe("about five minutes");
   });
});

describe("evidenceSentence", () => {
   it("reads as a sentence, with the ratio that makes it meaningful", () => {
      const session = sessionHolding("closed-syllable");
      const finding = reportFor(session).decodable.confirmed[0]!;
      const line = evidenceSentence(finding);
      expect(line.startsWith("Chose ")).toBe(true);
      expect(line.endsWith(".")).toBe(true);
      expect(line).toContain(" and ");
   });
});

describe("ParentScreen — the order is the design (10.2)", () => {
   const MARKERS = [
      "parent__framing",
      "strength--lead",
      "headline",
      "evidence",
      "activity",
      "block--quiet",
   ];

   const positions = () => {
      const nodes = [
         ...container.querySelectorAll<HTMLElement>(`.${MARKERS.join(", .")}`),
      ];
      // The most specific marker on each node, so "strength strength--lead"
      // reports as the lead rather than as a plain strength.
      return nodes.map((n) => MARKERS.find((m) => n.classList.contains(m)));
   };

   it("runs framing, one strength, the finding, its evidence, then the activity", () => {
      render(sessionHolding("closed-syllable"));
      const order = positions();

      expect(order[0]).toBe("parent__framing");
      expect(order[1]).toBe("strength--lead");
      expect(order.indexOf("headline")).toBeGreaterThan(order.indexOf("strength--lead"));
      expect(order.indexOf("evidence")).toBeGreaterThan(order.indexOf("headline"));
      expect(order.indexOf("activity")).toBeGreaterThan(order.indexOf("evidence"));
   });

   it("puts a strength above the finding, so a concern never opens the screen", () => {
      render(sessionHolding("closed-syllable"));
      const lead = $(".strength--lead")!;
      const headline = $(".headline")!;
      expect(
         lead.compareDocumentPosition(headline) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
   });

   it("leaves the parent holding the activity, with remaining strengths under it", () => {
      render(sessionHolding("closed-syllable"));
      const activity = $(".activity")!;
      const evidence = $$(".evidence").at(-1)!;
      expect(
         evidence.compareDocumentPosition(activity) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();

      const rest = $(".block--quiet");
      if (rest) {
         expect(
            activity.compareDocumentPosition(rest) & Node.DOCUMENT_POSITION_FOLLOWING
         ).toBeTruthy();
      }
   });

   it("does not repeat the lead strength further down", () => {
      render(sessionHolding("closed-syllable"));
      const lead = $(".strength--lead")!.textContent?.trim();
      const rest = $$(".block--quiet .strength").map((n) => n.textContent?.trim());
      expect(rest).not.toContain(lead);
   });
});

describe("ParentScreen — the activity names its time (10.5)", () => {
   it("carries a time estimate beside the label", () => {
      render(sessionHolding("closed-syllable"));
      expect($(".activity__time")!.textContent).toBe(ACTIVITY_TIME);
      expect($(".activity__label")!.textContent).toContain("Try this at home");
   });

   it("keeps the activity readable without expanding", () => {
      render(sessionHolding("closed-syllable"));
      expect($$("details")).toHaveLength(0);
      expect($(".activity__text")!.textContent!.length).toBeGreaterThan(300);
   });
});

describe("ParentScreen — telling a strength from a finding without colour (10.9)", () => {
   it("gives each an icon and a worded label, not a coloured dot", () => {
      render(sessionAnsweringCorrectly());

      // Every block that reports something carries a mark and a worded label.
      for (const eyebrow of $$(".eyebrow")) {
         expect(eyebrow.querySelector("svg")).not.toBeNull();
         expect((eyebrow.textContent ?? "").trim().length).toBeGreaterThan(3);
      }
      // And each strength in the quiet list carries its own, having no heading.
      for (const strength of $$(".block--quiet .strength")) {
         expect(strength.querySelector("svg")).not.toBeNull();
      }
      expect(container.textContent).toContain("Going well");
   });

   it("uses two different shapes, so the marks survive greyscale", () => {
      render(sessionHolding("closed-syllable"));
      const marks = $$(".eyebrow .icon").map((n) => n.innerHTML);
      // A strength eyebrow and a finding eyebrow are both on screen here.
      expect(new Set(marks).size).toBeGreaterThan(1);
   });

   it("carries no colour-only indicator anywhere", () => {
      render(sessionHolding("closed-syllable"));
      // The old build marked strengths with a bare coloured dot; 10.9 forbids it.
      for (const strength of $$(".strength")) {
         expect(strength.className).not.toMatch(/dot/);
      }
   });
});

describe("ParentScreen — the irregular track stands apart (10.7)", () => {
   it("is not put under the misconceptions' heading", () => {
      const session = irregularSession();
      render(session);

      const aside = $(".block--aside")!;
      expect(aside).not.toBeNull();
      expect(aside.querySelector(".eyebrow")).toBeNull();
      expect(aside.textContent).toContain(IRREGULAR_PARENT_SENTENCE);
   });

   it("carries no severity mark of its own", () => {
      render(irregularSession());
      const aside = $(".block--aside")!;
      expect(aside.querySelector("svg")).toBeNull();
   });
});

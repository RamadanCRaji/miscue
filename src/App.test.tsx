import { describe, expect, it } from "vitest";
import { DEMO_ITEM_IDS, DEMO_SEED, demoBank } from "./App.tsx";
import { SESSION_LENGTH, selectSession } from "./engine/select.ts";
import { diagnose, forParent } from "./engine/diagnose.ts";
import type { Item, Misconception, Option } from "./types.ts";
import itemBank from "./data/items.json";
import misconceptionData from "./data/misconceptions.json";

/**
 * The demo session is pinned so the recorded clips match what is dealt. If any
 * of this drifts, the clips are wrong on camera, so it is held by tests.
 */
const BANK = itemBank as unknown as Item[];
const MISCONCEPTIONS = misconceptionData as Misconception[];
const opts = (i: Item) => i.options as Option[];
const seeded = (s0: number) => {
   let s = s0 >>> 0;
   return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
};

const responders: Record<string, (i: Item) => string> = {
   allCorrect: (i) => opts(i).find((o) => o.correct)!.word,
   holdsClosed: (i) =>
      (opts(i).find((o) => !o.correct && o.misconceptionId === "closed-syllable") ??
         opts(i).find((o) => o.correct)!).word,
   holdsIrregular: (i) =>
      (opts(i).find((o) => !o.correct && o.misconceptionId === "irregular-word") ??
         opts(i).find((o) => o.correct)!).word,
   first: (i) => opts(i)[0]!.word,
   last: (i) => opts(i)[2]!.word,
};

describe("the pinned demo session", () => {
   it("names twelve items that all exist in the bank", () => {
      expect(DEMO_ITEM_IDS).toHaveLength(SESSION_LENGTH);
      expect(new Set(DEMO_ITEM_IDS).size).toBe(SESSION_LENGTH);
      expect(() => demoBank()).not.toThrow();
      expect(demoBank().map((i) => i.id)).toEqual(DEMO_ITEM_IDS);
   });

   it("has the 8/4 track split the interleave needs", () => {
      const bank = demoBank();
      expect(bank.filter((i) => i.track === "decodable")).toHaveLength(8);
      expect(bank.filter((i) => i.track === "irregular")).toHaveLength(4);
   });

   it("has unique targets, so the clip list has no duplicates", () => {
      const targets = demoBank().map((i) => i.target.toLowerCase());
      expect(new Set(targets).size).toBe(targets.length);
   });

   /**
    * The whole point: the SET must be fixed however the child answers, because
    * selection is adaptive and only the coverage phase is answer-independent.
    */
   it("deals all twelve whatever the child does", () => {
      const bank = demoBank();
      for (const respond of Object.values(responders)) {
         const session = selectSession(bank, respond, MISCONCEPTIONS, seeded(DEMO_SEED));
         expect(session).toHaveLength(SESSION_LENGTH);
         expect(new Set(session.map((a) => a.item.id))).toEqual(new Set(DEMO_ITEM_IDS));
      }
   });

   it("deals them in the same order every run, for a given answer pattern", () => {
      const bank = demoBank();
      const once = selectSession(bank, responders.allCorrect!, MISCONCEPTIONS, seeded(DEMO_SEED));
      const twice = selectSession(bank, responders.allCorrect!, MISCONCEPTIONS, seeded(DEMO_SEED));
      expect(twice.map((a) => a.item.id)).toEqual(once.map((a) => a.item.id));
   });

   it("keeps both demo findings reachable", () => {
      const bank = demoBank();

      const closed = diagnose(
         selectSession(bank, responders.holdsClosed!, MISCONCEPTIONS, seeded(DEMO_SEED))
      );
      expect(
         closed.decodable.evidence.find((e) => e.misconceptionId === "closed-syllable")?.confidence
      ).toBe("confirmed");

      const irregular = diagnose(
         selectSession(bank, responders.holdsIrregular!, MISCONCEPTIONS, seeded(DEMO_SEED))
      );
      expect(
         irregular.irregular.evidence.find((e) => e.misconceptionId === "irregular-word")?.confidence
      ).toBe("confirmed");
      // And her sentence reaches the parent screen, which is what the demo shows.
      expect(forParent(irregular, MISCONCEPTIONS).irregular.headline).toBeTruthy();
   });

   it("still rules out rather than confirming for a child who reads correctly", () => {
      const session = selectSession(demoBank(), responders.allCorrect!, MISCONCEPTIONS, seeded(DEMO_SEED));
      const d = diagnose(session);
      const all = [...d.decodable.evidence, ...d.irregular.evidence];
      expect(all.filter((e) => e.confidence === "confirmed")).toEqual([]);
      expect(all.filter((e) => e.confidence === "ruled-out").length).toBeGreaterThan(0);
   });

   /** Sept 17: all twelve are recorded, so every demo item names a clip. */
   it("has a clip named for all twelve, none left unset", () => {
      for (const item of demoBank()) {
         expect(item.audio, `${item.id} names no clip`).not.toBeNull();
         // Named after the target; the extension comes from the recording.
         expect(item.audio!.startsWith(`q-${item.target}.`)).toBe(true);
      }
      expect(demoBank().filter((i) => i.audio === null)).toHaveLength(0);
      expect(BANK.length).toBeGreaterThan(SESSION_LENGTH);
   });
});

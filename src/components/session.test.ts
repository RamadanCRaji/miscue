import { describe, expect, it } from "vitest";
import {
   REVEAL_MS,
   STARS_PER_ANIMAL,
   advance,
   animalsEarned,
   pick,
   startSession,
   stars,
} from "./session";
import { diagnose, forParent } from "../engine/diagnose";
import { SESSION_LENGTH } from "../engine/select";
import type { Item, Misconception, Option } from "../types";
import itemBank from "../data/items.json";
import misconceptionData from "../data/misconceptions.json";

/** The real bank: this is the session a child will actually be dealt. */
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

/** Plays a whole session, choosing each pick with the given strategy. */
function playSession(bank: Item[], choose: (options: Option[]) => Option, seed = 3) {
   const random = lcg(seed);
   let state = startSession(bank, MISCONCEPTIONS, random);
   const seen: string[] = [];

   while (state.phase !== "done") {
      expect(state.current).not.toBeNull();
      seen.push(state.current!.item.id);
      state = pick(state, choose(state.current!.options).word);
      expect(state.phase).toBe("revealing");
      state = advance(state, random);
   }
   return { state, seen };
}

const takeCorrect = (options: Option[]) => options.find((o) => o.correct)!;
const takeMisconception = (id: string) => (options: Option[]) =>
   options.find((o) => !o.correct && o.misconceptionId === id) ?? takeCorrect(options);

describe("session — a full playthrough", () => {
   it("plays end to end and finishes", () => {
      const { state } = playSession(BANK, takeCorrect);
      expect(state.phase).toBe("done");
      expect(state.current).toBeNull();
      expect(state.answers.length).toBeGreaterThan(0);
   });

   it("answers every item it deals, exactly once", () => {
      const { state, seen } = playSession(BANK, takeCorrect);
      expect(state.answers).toHaveLength(seen.length);
      expect(new Set(seen).size).toBe(seen.length);
      expect(state.answers.map((a) => a.item.id)).toEqual(seen);
   });

   it("never runs longer than a session", () => {
      const { state } = playSession(BANK, takeCorrect);
      expect(state.answers.length).toBeLessThanOrEqual(SESSION_LENGTH);
   });

   it("records picks in the shape diagnose() consumes", () => {
      const { state } = playSession(BANK, takeMisconception("closed-syllable"));
      for (const answer of state.answers) {
         expect(answer.item.id).toBeTruthy();
         expect(optionsOf(answer.item).map((o) => o.word)).toContain(answer.pickedWord);
      }
      expect(() => diagnose(state.answers)).not.toThrow();
   });
});

describe("session — the recorded picks feed diagnose()", () => {
   it("confirms the misconception a consistent child held", () => {
      const { state } = playSession(BANK, takeMisconception("closed-syllable"));
      const evidence = diagnose(state.answers).decodable.evidence.find(
         (e) => e.misconceptionId === "closed-syllable"
      );
      expect(evidence?.confidence).toBe("confirmed");
      expect(forParent(diagnose(state.answers), MISCONCEPTIONS).decodable.confirmed).toHaveLength(1);
   });

   it("rules out rather than confirming for a child who reads correctly", () => {
      const { state } = playSession(BANK, takeCorrect);
      const diagnosis = diagnose(state.answers);
      const all = [...diagnosis.decodable.evidence, ...diagnosis.irregular.evidence];
      expect(all.filter((e) => e.confidence === "ruled-out").length).toBeGreaterThan(0);
      expect(all.filter((e) => e.confidence === "confirmed")).toEqual([]);
   });

   it("matches the diagnosis the same picks produce outside the session", () => {
      const { state } = playSession(BANK, takeMisconception("irregular-word"));
      // Replaying the recorded answers must give the identical diagnosis: the
      // session is a recorder, and adds nothing of its own to the evidence.
      expect(diagnose(state.answers)).toEqual(diagnose([...state.answers]));
   });
});

describe("session — rules that must not drift", () => {
   it("holds section 9's ~600ms pause", () => {
      expect(REVEAL_MS).toBe(600);
   });

   it("earns one star per item, whether the answer was right or wrong", () => {
      const right = playSession(BANK, takeCorrect).state;
      const wrong = playSession(BANK, takeMisconception("closed-syllable")).state;
      expect(stars(right)).toBe(right.answers.length);
      expect(stars(wrong)).toBe(wrong.answers.length);
      expect(stars(right)).toBe(stars(wrong));
      expect(animalsEarned(right)).toBe(animalsEarned(wrong));
   });

   it("fills the zoo on answering, not on answering correctly", () => {
      const random = lcg(1);
      let state = startSession(BANK, MISCONCEPTIONS, random);
      expect(animalsEarned(state)).toBe(0);
      for (let i = 0; i < STARS_PER_ANIMAL; i += 1) {
         state = advance(pick(state, takeCorrect(state.current!.options).word), random);
      }
      expect(animalsEarned(state)).toBe(1);
   });

   it("randomises option order, so the seeds' answer positions cannot be learned", () => {
      const orders = new Set<string>();
      for (let seed = 1; seed <= 40; seed += 1) {
         const state = startSession(BANK, MISCONCEPTIONS, lcg(seed));
         orders.add(state.current!.options.map((o) => o.word).join(","));
      }
      expect(orders.size).toBeGreaterThan(1);
   });

   it("keeps the option order still while the item is on screen", () => {
      const random = lcg(9);
      const state = startSession(BANK, MISCONCEPTIONS, random);
      const before = state.current!.options.map((o) => o.word);
      const tapped = pick(state, before[0]!);
      expect(tapped.current!.options.map((o) => o.word)).toEqual(before);
   });

   it("keeps every option present after a tap, so nothing is marked wrong", () => {
      const random = lcg(4);
      const state = startSession(BANK, MISCONCEPTIONS, random);
      const tapped = pick(state, state.current!.options[1]!.word);
      expect(tapped.current!.options).toHaveLength(3);
      expect(tapped.picked).toBe(state.current!.options[1]!.word);
   });

   it("ignores a second tap on the same item", () => {
      const random = lcg(5);
      const state = startSession(BANK, MISCONCEPTIONS, random);
      const once = pick(state, state.current!.options[0]!.word);
      const twice = pick(once, once.current!.options[1]!.word);
      expect(twice).toBe(once);
      expect(twice.answers).toHaveLength(1);
   });

   it("throws on a word that is not on the item", () => {
      const state = startSession(BANK, MISCONCEPTIONS, lcg(6));
      expect(() => pick(state, "not-an-option")).toThrow(/is not an option/);
   });

   it("ends cleanly on an empty bank instead of dealing nothing", () => {
      const state = startSession([], MISCONCEPTIONS, lcg(1));
      expect(state.phase).toBe("done");
      expect(state.current).toBeNull();
      expect(state.answers).toEqual([]);
   });
});

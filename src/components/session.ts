import type { Answer } from "../engine/diagnose.ts";
import { SESSION_LENGTH, selectNext } from "../engine/select.ts";
import type { Item, Misconception, Option } from "../types.ts";

/**
 * The game session as a state machine. CLAUDE.md sections 7 and 9.
 *
 * Kept out of the component and free of React so a whole session can be played
 * end to end in a test without a DOM, and so the thing that records evidence is
 * not tangled up with the thing that draws it.
 *
 * Every transition is pure: state in, state out. The only outside input is
 * `random`, injected the same way `select.ts` does it.
 */

/** How many stars buy the next animal. Four animals over a full 12-item session. */
export const STARS_PER_ANIMAL = 3;

/**
 * The tapped option's neutral highlight, then advance. Section 9 fixes this at
 * ~600ms and fixes it here so it is not re-invented per session.
 */
export const REVEAL_MS = 600;

export type Phase =
   /** An item is on screen, waiting for a tap. */
   | "asking"
   /** Tapped. Neutral highlight showing, advancing when the pause is up. */
   | "revealing"
   /** The session is over. */
   | "done";

/**
 * The item on screen, with its options in the order they will be drawn.
 *
 * Order is randomised once, when the item is dealt, and then held: section 7
 * requires randomising at render time because the seed items place the correct
 * answer at positions 3, 2, 2, but re-shuffling on every React render would move
 * the options under the child's finger.
 */
export type Question = {
   item: Item;
   options: Option[];
};

export type SessionState = {
   bank: Item[];
   /**
    * Carried alongside the bank because selection needs it: the half-session cap
    * exempts a misconception on the track its own record names.
    */
   misconceptions: Misconception[];
   /** Completed picks, in the exact shape `diagnose()` consumes. */
   answers: Answer[];
   current: Question | null;
   /** The word just tapped, during the highlight. Never says right or wrong. */
   picked: string | null;
   phase: Phase;
   /**
    * How many stars the bar draws. The session length is not known up front —
    * selection is adaptive and stops when the bank runs dry — so this is the
    * most it can be. With a full bank it is `SESSION_LENGTH`; with today's
    * 8-item bank it is 8, which keeps the bar from looking stuck at two thirds.
    */
   plannedLength: number;
};

/** One star per item, earned by answering, never by answering correctly. */
export function stars(state: SessionState): number {
   return state.answers.length;
}

/** Animals earned so far. The zoo fills as the session goes, win or lose. */
export function animalsEarned(state: SessionState): number {
   return Math.floor(stars(state) / STARS_PER_ANIMAL);
}

/** Fisher-Yates, driven by the injected generator so a test can pin the order. */
function shuffled(options: Option[], random: () => number): Option[] {
   const out = [...options];
   for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      const a = out[i]!;
      const b = out[j]!;
      out[i] = b;
      out[j] = a;
   }
   return out;
}

function deal(
   bank: Item[],
   answers: Answer[],
   misconceptions: Misconception[],
   random: () => number
): Question | null {
   const item = selectNext(bank, answers, misconceptions, random);
   return item ? { item, options: shuffled(item.options, random) } : null;
}

export function startSession(
   bank: Item[],
   misconceptions: Misconception[],
   random: () => number = Math.random
): SessionState {
   const current = deal(bank, [], misconceptions, random);
   return {
      bank,
      misconceptions,
      answers: [],
      current,
      picked: null,
      phase: current ? "asking" : "done",
      plannedLength: Math.min(SESSION_LENGTH, bank.length),
   };
}

/**
 * Record a tap. The answer is written immediately, in `diagnose()`'s shape, so
 * evidence cannot be lost to a mistimed advance — and so the next selection sees
 * it, which is what makes selection adaptive.
 *
 * Throws on a word that is not on the current item, matching `diagnose()`: a
 * mismatch is a bug in the caller and a silent one would corrupt the evidence.
 */
export function pick(state: SessionState, word: string): SessionState {
   if (state.phase !== "asking" || !state.current) return state;
   if (!state.current.options.some((o) => o.word === word)) {
      throw new Error(`session: "${word}" is not an option on item "${state.current.item.id}"`);
   }
   return {
      ...state,
      answers: [...state.answers, { item: state.current.item, pickedWord: word }],
      picked: word,
      phase: "revealing",
   };
}

/** After the pause: deal the next item, or end the session. */
export function advance(state: SessionState, random: () => number = Math.random): SessionState {
   if (state.phase !== "revealing") return state;
   const next = deal(state.bank, state.answers, state.misconceptions, random);
   return {
      ...state,
      current: next,
      picked: null,
      phase: next ? "asking" : "done",
   };
}

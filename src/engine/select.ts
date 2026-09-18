import type { Item, Misconception, Option, Track } from "../types";
// Explicit `.ts`, unlike the type-only imports around it: this one survives to
// runtime, and `scripts/simulate.ts` loads this module through Node's own ESM
// loader, which does not guess extensions the way Vite does.
import { diagnose } from "./diagnose.ts";
import type { Answer, Confidence } from "./diagnose";

/**
 * Item selection. Implements CLAUDE.md section 7, "Item selection".
 *
 * Selection is adaptive, so this file answers one question at a time: given the
 * bank and what the child has answered so far, which item comes next. Section 7
 * asks it to weight toward misconceptions "currently suspected", and suspected
 * state does not exist until answers do — a session planned up front could not
 * do it.
 *
 * Pure apart from the injected `random`. The same bank, the same answers and the
 * same generator always select the same item, which is what lets a demo be
 * replayed and a test assert on an exact choice.
 *
 * Suspected state is read here through `diagnose()`, which returns all four
 * confidences. That is deliberate and is not a leak: section 7 makes suspected
 * internal state *for weighting item selection*, and `forParent()` remains the
 * only path to the parent screen.
 */

/* -- session shape. Section 7's numbers live here and nowhere else. --------- */

/** Section 7: 12 items, roughly five minutes. No early exit on confidence. */
export const SESSION_LENGTH = 12;

/** Section 7's default mix, interleaved rather than blocked. */
export const IRREGULAR_PER_SESSION = 4;
export const DECODABLE_PER_SESSION = SESSION_LENGTH - IRREGULAR_PER_SESSION;

/**
 * Every Nth item is irregular, putting them at positions 3, 6, 9 and 12 —
 * section 7's "roughly". Derived, so the two counts above cannot drift out of
 * step with the interleave.
 */
const IRREGULAR_EVERY = SESSION_LENGTH / IRREGULAR_PER_SESSION;

/** Section 7: the first four items spread across misconceptions for coverage. */
export const COVERAGE_PHASE_ITEMS = 4;

/**
 * Section 7: "never let one misconception consume more than half the session".
 * Counted across the whole session rather than per track, because the sentence
 * is about the session, and because `irregular-word` is tagged on decodable
 * items too — a per-track cap would not see it accumulating on both.
 */
export const MAX_ITEMS_PER_MISCONCEPTION = Math.floor(SESSION_LENGTH / 2);

/* -- weights ---------------------------------------------------------------- */
/*
 * Selection is a weighted draw, not an argmax: "weight toward" is a bias, and a
 * child who sits down twice should not get the same twelve items in the same
 * order. Every eligible item keeps a non-zero chance; the weights only change
 * the odds.
 *
 * These are tuning knobs, not findings. Change them here.
 */

/** Coverage phase: every eligible item starts equal... */
const COVERAGE_BASE_WEIGHT = 1;

/** ...then gains this much per misconception the session has not touched yet. */
const COVERAGE_NEW_MISCONCEPTION_WEIGHT = 4;

/** Confirm or rule out a half-formed pattern before going looking for new ones. */
const SUSPECTED_WEIGHT = 8;

/** Selected at least once, not yet suspected. The next pick could tip it. */
const PARTIAL_WEIGHT = 3;

/** No evidence either way. Worth discovering, but section 7 ranks it below. */
const UNSEEN_WEIGHT = 2;

/** Already answered — more evidence changes nothing on the parent screen. */
const SETTLED_WEIGHT = 1;

/* -- helpers ---------------------------------------------------------------- */

/**
 * Which track position `position` belongs to. 1-indexed, matching how section 7
 * counts ("positions 3, 6, 9, 12").
 */
export function trackForPosition(position: number): Track {
   return position % IRREGULAR_EVERY === 0 ? "irregular" : "decodable";
}

/** Distinct misconceptions an item offers, picked or not — its exposures. */
function misconceptionsOffered(item: Item): string[] {
   const options: Option[] = item.options;
   return [
      ...new Set(
         options.flatMap((o) => (!o.correct && o.misconceptionId ? [o.misconceptionId] : []))
      ),
   ];
}

/** Targets are compared case-insensitively: `The` and `the` are one word. */
function targetKey(item: Item): string {
   return item.target.toLowerCase();
}

/**
 * Deterministic weighted draw. Candidates are sorted by weight, then by id, so
 * the mapping from `random()` to an item is stable: `() => 0` always yields the
 * heaviest candidate, which is what the tests assert on.
 */
function weightedPick(
   candidates: { item: Item; weight: number }[],
   random: () => number
): Item | null {
   if (candidates.length === 0) return null;

   const ordered = [...candidates].sort(
      (a, b) => b.weight - a.weight || a.item.id.localeCompare(b.item.id)
   );
   const total = ordered.reduce((sum, c) => sum + c.weight, 0);
   if (!(total > 0)) return ordered[0]!.item;

   const roll = random();
   const target = (Number.isFinite(roll) ? Math.min(Math.max(roll, 0), 1) : 0) * total;

   let running = 0;
   for (const candidate of ordered) {
      running += candidate.weight;
      if (target < running) return candidate.item;
   }
   // Only reachable when `random()` returns exactly 1, or on float drift.
   return ordered[ordered.length - 1]!.item;
}

/* -- selection -------------------------------------------------------------- */

/** What the session has already used. Derived from the answers, never tracked twice. */
type SessionState = {
   usedItemIds: Set<string>;
   usedTargets: Set<string>;
   /**
    * Items so far offering each misconception **on a track it is not native
    * to** — the only ones the cap governs. See `MAX_ITEMS_PER_MISCONCEPTION`.
    */
   itemsPerMisconception: Map<string, number>;
   /** Confidence per misconception across both tracks, from `diagnose()`. */
   confidences: Map<string, Confidence>;
   /** Per track, its only native misconception — where the cap is lifted. */
   soleSubject: Map<Track, string>;
};

/**
 * The misconceptions each track measures — those whose own record names it.
 * A track with exactly one has no variety for the cap to protect.
 */
function soleSubjects(misconceptions: Misconception[]): Map<Track, string> {
   const byTrack = new Map<Track, string[]>();
   for (const m of misconceptions) {
      byTrack.set(m.track, [...(byTrack.get(m.track) ?? []), m.id]);
   }
   const sole = new Map<Track, string>();
   for (const [track, ids] of byTrack) {
      if (ids.length === 1) sole.set(track, ids[0]!);
   }
   return sole;
}

/** True when the cap governs this misconception on this item's track. */
function capped(item: Item, misconceptionId: string, sole: Map<Track, string>): boolean {
   return sole.get(item.track) !== misconceptionId;
}

function stateFrom(answers: Answer[], misconceptions: Misconception[]): SessionState {
   const usedItemIds = new Set<string>();
   const usedTargets = new Set<string>();
   const itemsPerMisconception = new Map<string, number>();
   const soleSubject = soleSubjects(misconceptions);

   for (const { item } of answers) {
      usedItemIds.add(item.id);
      usedTargets.add(targetKey(item));
      for (const id of misconceptionsOffered(item)) {
         if (!capped(item, id, soleSubject)) continue;
         itemsPerMisconception.set(id, (itemsPerMisconception.get(id) ?? 0) + 1);
      }
   }

   const confidences = new Map<string, Confidence>();
   const diagnosis = diagnose(answers);
   for (const track of [diagnosis.decodable, diagnosis.irregular]) {
      for (const evidence of track.evidence) {
         confidences.set(evidence.misconceptionId, evidence.confidence);
      }
   }

   return { usedItemIds, usedTargets, itemsPerMisconception, confidences, soleSubject };
}

/**
 * Hard rules. An item failing any of these is not a weaker choice, it is not a
 * choice: section 7's "at most once per session" and the half-session cap.
 */
function isEligible(item: Item, state: SessionState): boolean {
   if (state.usedItemIds.has(item.id)) return false;
   if (state.usedTargets.has(targetKey(item))) return false;
   return misconceptionsOffered(item).every((id) => {
      if (!capped(item, id, state.soleSubject)) return true;
      return (state.itemsPerMisconception.get(id) ?? 0) < MAX_ITEMS_PER_MISCONCEPTION;
   });
}

/** Broadest coverage: an item is worth more for each misconception still untouched. */
function coverageWeight(item: Item, state: SessionState): number {
   const fresh = misconceptionsOffered(item).filter(
      (id) => (state.itemsPerMisconception.get(id) ?? 0) === 0
   ).length;
   return COVERAGE_BASE_WEIGHT + fresh * COVERAGE_NEW_MISCONCEPTION_WEIGHT;
}

/** After the coverage phase: weight toward what is currently suspected. */
function confirmationWeight(item: Item, state: SessionState): number {
   return misconceptionsOffered(item).reduce((sum, id) => {
      const confidence = state.confidences.get(id);
      if (confidence === "suspected") return sum + SUSPECTED_WEIGHT;
      if (confidence === "confirmed" || confidence === "ruled-out") return sum + SETTLED_WEIGHT;
      if (confidence === undefined) return sum + UNSEEN_WEIGHT;
      // "insufficient": exposed, and possibly selected once — a pick short of suspected.
      const selected = (state.itemsPerMisconception.get(id) ?? 0) > 0;
      return sum + (selected ? PARTIAL_WEIGHT : UNSEEN_WEIGHT);
   }, 0);
}

/**
 * The next item, or null when the bank cannot offer one.
 *
 * `answers` are the items already answered, in order; the next position is
 * `answers.length + 1`. Returns null once the session is full, and also when
 * every remaining item in the bank is ineligible — a short session is the honest
 * outcome of a thin bank, and is preferable to repeating a target or letting one
 * misconception take the session over.
 *
 * When the position's track is exhausted, the other track fills the slot rather
 * than the session ending early: section 7 fixes the session at 12 items and
 * calls the 8/4 mix a default.
 */
export function selectNext(
   bank: Item[],
   answers: Answer[],
   misconceptions: Misconception[],
   random: () => number = Math.random
): Item | null {
   const position = answers.length + 1;
   if (position > SESSION_LENGTH) return null;

   const state = stateFrom(answers, misconceptions);
   const eligible = bank.filter((item) => isEligible(item, state));
   if (eligible.length === 0) return null;

   const wanted = trackForPosition(position);
   const onTrack = eligible.filter((item) => item.track === wanted);
   const pool = onTrack.length > 0 ? onTrack : eligible;

   const weigh = position <= COVERAGE_PHASE_ITEMS ? coverageWeight : confirmationWeight;
   return weightedPick(
      pool.map((item) => ({ item, weight: weigh(item, state) })),
      random
   );
}

/**
 * How a child answers one item. Returns the word they picked — never a position,
 * because option order is randomised at render time (section 7).
 */
export type Responder = (item: Item, position: number) => string;

/**
 * Drive a whole session: select, answer, select again, until the session is full
 * or the bank runs dry. The adaptive loop lives here so the game screen and the
 * headless simulation cannot drift apart.
 *
 * Returns the answers in order. `answers.length` is the session length, which
 * is `SESSION_LENGTH` for any bank deep enough to fill it.
 */
export function selectSession(
   bank: Item[],
   respond: Responder,
   misconceptions: Misconception[],
   random: () => number = Math.random
): Answer[] {
   const answers: Answer[] = [];
   for (let position = 1; position <= SESSION_LENGTH; position += 1) {
      const item = selectNext(bank, answers, misconceptions, random);
      if (!item) break;
      answers.push({ item, pickedWord: respond(item, position) });
   }
   return answers;
}

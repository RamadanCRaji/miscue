import type { Item, Misconception, Option, Track } from "../types";

/**
 * Diagnosis. Implements CLAUDE.md section 7.
 *
 * Pure: answers in, evidence out. No randomness, no clock, no I/O — the same
 * session always produces the same diagnosis, which is what lets a parent be
 * told why.
 *
 * Two counts per misconception, because a selection count alone is meaningless:
 *
 *   selections — the child picked a distractor carrying it
 *   exposures  — the child was offered one and could have
 *
 * Correct answers are evidence too. Being exposed to a misconception and not
 * picking it counts against that misconception, and enough of that rules it out
 * and is reported to the parent as a strength.
 */

/* -- thresholds. Section 7's numbers live here and nowhere else. ------------ */
/*
 * Thresholds are per track, because the tracks cannot reach the same numbers.
 *
 * Every irregular item carries two `irregular-word` distractors, so each pick
 * weighs 0.5, and a 12-item session holds only 4 irregular items. Weighted
 * selections there cap at 4 x 0.5 = 2.0: the decodable threshold of 3 is not
 * merely hard on that track, it is unreachable by construction. Irregular
 * therefore confirms at 2.0 — every irregular item picked wrong — and suspects
 * at 1.5.
 */

/** Weighted selections for `suspected`. Internal only — never shown to a parent. */
export const DECODABLE_SUSPECTED_SELECTIONS = 2;

/** Weighted selections for `confirmed`. Only this reaches the parent screen. */
export const DECODABLE_CONFIRMED_SELECTIONS = 3;

/** 3 of the 4 irregular items in a session. */
export const IRREGULAR_SUSPECTED_SELECTIONS = 1.5;

/** All 4 irregular items in a session — the ceiling on that track. */
export const IRREGULAR_CONFIRMED_SELECTIONS = 2;

/** Exposures with zero selections before a misconception is ruled out. Same on both tracks. */
export const RULED_OUT_EXPOSURES = 3;

export const THRESHOLDS: Record<Track, { suspected: number; confirmed: number }> = {
   decodable: {
      suspected: DECODABLE_SUSPECTED_SELECTIONS,
      confirmed: DECODABLE_CONFIRMED_SELECTIONS,
   },
   irregular: {
      suspected: IRREGULAR_SUSPECTED_SELECTIONS,
      confirmed: IRREGULAR_CONFIRMED_SELECTIONS,
   },
};

/**
 * The parent-facing sentence for the irregular track, the teacher's wording,
 * verbatim. Deliberately not phrased as a problem or a broken rule: a sight word
 * is a memorization gap, not a misapplied rule, and the decodable track's
 * misconception labels would frame it wrongly.
 */
export const IRREGULAR_PARENT_SENTENCE = "Your child needs to practice learning irregular words.";

/** Float slack: weights are fractions, so 0.5 + 0.5 + ... + 1 must count as 3. */
const EPSILON = 1e-9;

/* -- input ----------------------------------------------------------------- */

/**
 * One answered item. `pickedWord` is the option's `word`, not its rendered
 * position: option order is randomised at render time (section 7) and carries no
 * meaning here.
 */
export type Answer = {
   item: Item;
   pickedWord: string;
};

/* -- output ---------------------------------------------------------------- */

export type Confidence = "confirmed" | "suspected" | "ruled-out" | "insufficient";

/** Where a misconception was selected — the parent screen's evidence line. */
export type EvidencePick = {
   itemId: string;
   /** The target the child was asked about. */
   target: string;
   /** The wrong word they chose. */
   word: string;
};

export type MisconceptionEvidence = {
   misconceptionId: string;
   confidence: Confidence;
   /**
    * Selections, weighted. A pick counts 1 divided by the number of options in
    * that item carrying the misconception, so an item offering two ways to pick
    * it is not two ways to confirm it.
    */
   selections: number;
   /** Unweighted pick count. Reporting only — thresholds use `selections`. */
   rawSelections: number;
   /** Distinct items that offered this misconception, picked or not. */
   exposures: number;
   /** Distinct items where it was picked. */
   itemsSelectedIn: number;
   picks: EvidencePick[];
   /**
    * The one home activity for the parent, or null unless confirmed. Taken from
    * the most-picked distractor, ties broken by the most recent pick, so a
    * misconception with several distractors and different advice still yields
    * exactly one activity.
    */
   advice: string | null;
};

/** One track. Tracks are independent and never averaged (section 7). */
export type TrackDiagnosis = {
   track: Track;
   itemsAnswered: number;
   /** Every misconception with any evidence, most selected first. Internal. */
   evidence: MisconceptionEvidence[];
};

export type Diagnosis = Record<Track, TrackDiagnosis>;

/* -- diagnosis ------------------------------------------------------------- */

function distractorsFor(item: Item, misconceptionId: string): Option[] {
   const options: Option[] = item.options;
   return options.filter((o) => !o.correct && o.misconceptionId === misconceptionId);
}

function pickedOption(answer: Answer): Option {
   const options: Option[] = answer.item.options;
   const option = options.find((o) => o.word === answer.pickedWord);
   if (!option) {
      throw new Error(
         `diagnose: "${answer.pickedWord}" is not an option on item "${answer.item.id}"`
      );
   }
   return option;
}

type DistractorTally = {
   word: string;
   advice: string | null;
   picks: number;
   /** Index of the most recent pick, for breaking ties on advice. */
   lastPickedAt: number;
};

function diagnoseTrack(answers: Answer[], track: Track): TrackDiagnosis {
   const onTrack = answers.filter((a) => a.item.track === track);

   const exposures = new Map<string, Set<string>>();
   const selectedIn = new Map<string, Set<string>>();
   const weighted = new Map<string, number>();
   const raw = new Map<string, number>();
   const picks = new Map<string, EvidencePick[]>();
   const byDistractor = new Map<string, Map<string, DistractorTally>>();

   onTrack.forEach((answer, index) => {
      const { item } = answer;
      const options: Option[] = item.options;

      // Exposure is per item, not per distractor. An item offering a
      // misconception twice gave the child one chance to reveal it, so counting
      // two would rule it out twice as fast — the mirror of the weighting below.
      for (const misconceptionId of new Set(
         options.flatMap((o) => (!o.correct && o.misconceptionId ? [o.misconceptionId] : []))
      )) {
         const seen = exposures.get(misconceptionId) ?? new Set<string>();
         seen.add(item.id);
         exposures.set(misconceptionId, seen);
      }

      const picked = pickedOption(answer);
      if (picked.correct || picked.misconceptionId === null) return;
      const misconceptionId = picked.misconceptionId;

      // A pick counts 1 / (options carrying this misconception in this item).
      // On the irregular track an item may offer two spellings of the same
      // error; a guesser then has two chances in three to hit it, and unweighted
      // counting would confirm a misconception the child may not hold.
      const carriers = distractorsFor(item, misconceptionId).length;
      const weight = carriers === 0 ? 1 : 1 / carriers;
      weighted.set(misconceptionId, (weighted.get(misconceptionId) ?? 0) + weight);
      raw.set(misconceptionId, (raw.get(misconceptionId) ?? 0) + 1);

      const items = selectedIn.get(misconceptionId) ?? new Set<string>();
      items.add(item.id);
      selectedIn.set(misconceptionId, items);

      const evidence = picks.get(misconceptionId) ?? [];
      evidence.push({ itemId: item.id, target: item.target, word: picked.word });
      picks.set(misconceptionId, evidence);

      const tallies = byDistractor.get(misconceptionId) ?? new Map<string, DistractorTally>();
      const key = `${item.id}|${picked.word}`;
      const tally = tallies.get(key) ?? {
         word: picked.word,
         advice: picked.parentAdvice,
         picks: 0,
         lastPickedAt: index,
      };
      tally.picks += 1;
      tally.lastPickedAt = index;
      tallies.set(key, tally);
      byDistractor.set(misconceptionId, tallies);
   });

   const ids = new Set([...exposures.keys(), ...weighted.keys()]);
   const evidence: MisconceptionEvidence[] = [...ids].map((misconceptionId) => {
      const selections = weighted.get(misconceptionId) ?? 0;
      const exposureCount = exposures.get(misconceptionId)?.size ?? 0;
      const confidence = confidenceFor(selections, exposureCount, track);
      return {
         misconceptionId,
         confidence,
         selections,
         rawSelections: raw.get(misconceptionId) ?? 0,
         exposures: exposureCount,
         itemsSelectedIn: selectedIn.get(misconceptionId)?.size ?? 0,
         picks: picks.get(misconceptionId) ?? [],
         advice:
            confidence === "confirmed"
               ? adviceFrom(byDistractor.get(misconceptionId))
               : null,
      };
   });

   evidence.sort(
      (a, b) => b.selections - a.selections || a.misconceptionId.localeCompare(b.misconceptionId)
   );
   return { track, itemsAnswered: onTrack.length, evidence };
}

function confidenceFor(selections: number, exposures: number, track: Track): Confidence {
   const threshold = THRESHOLDS[track];
   if (selections >= threshold.confirmed - EPSILON) return "confirmed";
   if (selections >= threshold.suspected - EPSILON) return "suspected";
   if (selections === 0 && exposures >= RULED_OUT_EXPOSURES) return "ruled-out";
   return "insufficient";
}

/**
 * One activity, always: the most-picked distractor's advice, ties broken by the
 * most recent pick. Two distractors sharing a misconception can carry different
 * advice by design (CLAUDE.md section 4), and a parent must not be handed two.
 */
function adviceFrom(tallies: Map<string, DistractorTally> | undefined): string | null {
   if (!tallies || tallies.size === 0) return null;
   const best = [...tallies.values()].reduce((a, b) =>
      b.picks > a.picks || (b.picks === a.picks && b.lastPickedAt > a.lastPickedAt) ? b : a
   );
   return best.advice;
}

/** Diagnose a session. Each track is diagnosed on its own and never averaged. */
export function diagnose(answers: Answer[]): Diagnosis {
   return {
      decodable: diagnoseTrack(answers, "decodable"),
      irregular: diagnoseTrack(answers, "irregular"),
   };
}

/* -- what the parent sees -------------------------------------------------- */

/**
 * One thing said to the parent, with the wording already chosen.
 *
 * `label` is resolved here rather than in the component: a confirmed
 * misconception takes the deficit `label`, a ruled-out one takes
 * `strengthLabel`. A component that reached for `misconception.label` itself
 * would render "Does not have an understanding of closed syllables" under a
 * heading that says strength — telling a parent their child has the exact gap
 * the evidence just ruled out.
 */
export type ParentFinding = MisconceptionEvidence & {
   /** Already correct for this finding's confidence. Render it as given. */
   label: string;
};

export type ParentTrackReport = {
   track: Track;
   /**
    * How this track names what it found. Null unless there is something to name.
    *
    * Decodable is always null: each confirmed misconception is headlined by its
    * own `label`, which names the rule the child is misapplying. Irregular is
    * one fixed sentence for the whole track, because there is no rule to name —
    * see `IRREGULAR_PARENT_SENTENCE` — and it appears **only when something is
    * confirmed on that track**. Telling a parent their child needs to practice
    * irregular words when the evidence says nothing of the kind would be a
    * finding the diagnosis did not make.
    */
   headline: string | null;
   /** Named to the parent, with evidence and one activity each. Deficit wording. */
   confirmed: ParentFinding[];
   /** Reported as strengths: offered repeatedly and not picked. Strength wording. */
   ruledOut: ParentFinding[];
};

export type ParentReport = Record<Track, ParentTrackReport>;

/**
 * The parent-facing slice. `suspected` is deliberately absent: section 7 makes
 * it internal state for weighting item selection, never shown. Going through
 * this function is what keeps a half-formed pattern off the parent screen.
 *
 * It also resolves the wording. `misconceptions` is required because the two
 * labels are data and the choice between them is not a component's to make:
 * confirmed reads as a deficit, ruled out reads as a capability.
 *
 * Throws on a misconception the list does not describe, rather than falling back
 * to an id or an empty string. The same reasoning as `pickedOption` above — a
 * silent miss here would put a raw id, or nothing, on the one screen a parent
 * reads.
 */
export function forParent(diagnosis: Diagnosis, misconceptions: Misconception[]): ParentReport {
   const byId = new Map(misconceptions.map((m) => [m.id, m]));

   const label = (e: MisconceptionEvidence): ParentFinding => {
      const misconception = byId.get(e.misconceptionId);
      if (!misconception) {
         throw new Error(`forParent: no misconception describes "${e.misconceptionId}"`);
      }
      const wording =
         e.confidence === "ruled-out" ? misconception.strengthLabel : misconception.label;
      if (!wording.trim()) {
         throw new Error(
            `forParent: misconception "${e.misconceptionId}" has no ${
               e.confidence === "ruled-out" ? "strengthLabel" : "label"
            }`
         );
      }
      return { ...e, label: wording };
   };

   const slice = (t: TrackDiagnosis): ParentTrackReport => {
      const confirmed = t.evidence.filter((e) => e.confidence === "confirmed").map(label);
      return {
         track: t.track,
         headline:
            t.track === "irregular" && confirmed.length > 0 ? IRREGULAR_PARENT_SENTENCE : null,
         confirmed,
         ruledOut: t.evidence.filter((e) => e.confidence === "ruled-out").map(label),
      };
   };
   return { decodable: slice(diagnosis.decodable), irregular: slice(diagnosis.irregular) };
}

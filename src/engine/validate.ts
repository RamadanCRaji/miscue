import type {
   DecodableItem,
   DecodableOption,
   IrregularItem,
   Item,
   Misconception,
   Option,
   Track,
} from "../types";

/**
 * Item validation. Implements CLAUDE.md section 5.
 *
 * Pure function, item in, list of failures out. One entry point for both
 * tracks; it branches on `item.track` internally.
 *
 *   both tracks      hard 1, 2, 6, 9, 11   soft 8
 *   decodable only   hard 3, 4, 5, 7
 *   irregular only   hard 10, 12, 13
 *
 * Rule 8 is soft and warns only. On irregular items only its first-two-letters
 * half applies — irregular options carry no vowel spelling to compare.
 *
 * Rule numbers are stable and quoted verbatim in failure strings, so later
 * rules are appended (9 onward) rather than renumbered.
 *
 * If this ever fails a teacher-written seed item, the rule is wrong, not the
 * item. Stop and flag it rather than editing her item to satisfy the code.
 */

/** Rule 1. */
const OPTIONS_PER_ITEM = 3;

/** Rule 2. */
const CORRECT_OPTIONS_PER_ITEM = 1;

/** Rule 8: how many leading letters count as "looks like the target". */
const SIMILAR_PREFIX_LENGTH = 2;

export type ValidationResult = {
   /** Hard rule breaks. Non-empty means the item must not ship. */
   failures: string[];
   /** Soft rule breaks. A human judges these. */
   warnings: string[];
};

function sharesOpening(word: string, target: string): boolean {
   return word.slice(0, SIMILAR_PREFIX_LENGTH) === target.slice(0, SIMILAR_PREFIX_LENGTH);
}

export function validateItem(item: Item, misconceptions: Misconception[]): ValidationResult {
   const failures: string[] = [];
   const warnings: string[] = [];

   const knownMisconceptionIds = new Set(misconceptions.map((m) => m.id));
   const options: Option[] = item.options;
   const correct = options.filter((o) => o.correct);
   const distractors = options.filter((o) => !o.correct);

   // Rule 1 — exactly 3 options.
   if (options.length !== OPTIONS_PER_ITEM) {
      failures.push(`rule 1: expected exactly ${OPTIONS_PER_ITEM} options, found ${options.length}`);
   }

   // Rule 2 — exactly 1 option marked correct.
   if (correct.length !== CORRECT_OPTIONS_PER_ITEM) {
      failures.push(
         `rule 2: expected exactly ${CORRECT_OPTIONS_PER_ITEM} correct option, found ${correct.length}`
      );
   }

   if (item.track === "decodable") {
      decodableRules(item, failures, warnings);
   } else {
      irregularRules(item, failures, warnings);
   }

   // Rules 9 and onward concern the correct option or every distractor, on
   // both tracks. Looped rather than indexed so a rule 2 break reports alongside
   // them instead of crashing or going silent.
   for (const option of correct) {
      // Rule 9 — the correct option carries no misconception. One pinned here
      // would make a correct response count as evidence of an error, and
      // section 7 reads correct answers as evidence in the other direction too.
      if (option.misconceptionId !== null) {
         failures.push(
            `rule 9: correct option "${option.word}" carries misconceptionId ` +
               `"${option.misconceptionId}" — must be null, or a right answer becomes ` +
               `evidence of an error`
         );
      }
   }

   for (const option of distractors) {
      // Rule 6 — every distractor carries a misconception that exists.
      if (option.misconceptionId === null) {
         failures.push(`rule 6: distractor "${option.word}" has a null misconceptionId`);
      } else if (!knownMisconceptionIds.has(option.misconceptionId)) {
         failures.push(
            `rule 6: distractor "${option.word}" references unknown misconception ` +
               `"${option.misconceptionId}"`
         );
      }

      // Rule 11 — every distractor has a home activity. The parent sees the
      // advice attached to the distractor the child picked, so a distractor
      // without one would confirm a misconception with nothing to do about it.
      // Missing advice is left empty rather than written (CLAUDE.md section 11),
      // which is exactly why it has to fail here instead of shipping blank.
      //
      // Checked with `typeof`, not `=== null`: the bank is JSON cast at the
      // boundary, and data written before this field existed has no key at all.
      // A validator that throws on the malformed data it exists to catch is
      // worse than one that reports it.
      if (typeof option.parentAdvice !== "string") {
         failures.push(`rule 11: distractor "${option.word}" has no parentAdvice`);
      } else if (option.parentAdvice.trim() === "") {
         failures.push(`rule 11: distractor "${option.word}" has an empty parentAdvice`);
      }
   }

   return { failures, warnings };
}

/** Rules 3, 4, 5, 7 and the full rule 8. */
function decodableRules(item: DecodableItem, failures: string[], warnings: string[]): void {
   const correct = item.options.filter((o) => o.correct);
   const distractors = item.options.filter((o) => !o.correct);

   for (const option of correct) {
      // Rule 3 — the correct option's sound equals the target's. Without this
      // the item has no right answer.
      if (option.vowelSound !== item.targetVowelSound) {
         failures.push(
            `rule 3: correct option "${option.word}" has vowelSound "${option.vowelSound}", ` +
               `but target "${item.target}" has "${item.targetVowelSound}" — the item has no right answer`
         );
      }

      // Rule 5 — the correct option's spelling differs from the target's. The
      // core design rule: a child must not letter-match their way to the answer.
      if (option.vowelSpelling === item.targetVowelSpelling) {
         failures.push(
            `rule 5: correct option "${option.word}" shares vowelSpelling ` +
               `"${option.vowelSpelling}" with target "${item.target}" — answerable by letter-matching`
         );
      }
   }

   for (const option of distractors) {
      // Rule 4 — every distractor's sound differs from the target's, or there
      // are two correct answers.
      if (option.vowelSound === item.targetVowelSound) {
         failures.push(
            `rule 4: distractor "${option.word}" has vowelSound "${option.vowelSound}", ` +
               `the same as target "${item.target}" — two correct answers`
         );
      }
   }

   // Rule 7 — no option repeats the target word. Decodable only: on an irregular
   // item the correct option is the target's spelling by design.
   for (const option of item.options) {
      if (option.word === item.target) {
         failures.push(`rule 7: option "${option.word}" is the target word`);
      }
   }

   // Rule 8 (soft) — at least one distractor should look like the target, by
   // vowel spelling or by opening letters. The trap that catches letter-matching.
   const looksLikeTarget = (o: DecodableOption) =>
      o.vowelSpelling === item.targetVowelSpelling || sharesOpening(o.word, item.target);
   if (!distractors.some(looksLikeTarget)) {
      warnings.push(
         `rule 8: no distractor resembles target "${item.target}" — none shares its ` +
            `vowelSpelling "${item.targetVowelSpelling}" or its first ${SIMILAR_PREFIX_LENGTH} letters`
      );
   }
}

/** Rules 10, 12, 13 and the opening-letters half of rule 8. */
function irregularRules(item: IrregularItem, failures: string[], warnings: string[]): void {
   const correct = item.options.filter((o) => o.correct);
   const distractors = item.options.filter((o) => !o.correct);

   // Rule 13 — audio is a non-empty string. The type already says so, but the
   // bank is JSON cast at the boundary, which bypasses it. The target is spoken
   // and never shown, so an irregular item without audio cannot be asked.
   if (typeof item.audio !== "string" || item.audio.trim() === "") {
      failures.push(
         `rule 13: irregular item "${item.id}" has no audio — the target is never shown, ` +
            `so it cannot be asked`
      );
   }

   // Rule 12 — the correct option spells the target. The irregular counterpart
   // of rule 3: without it the item has no right answer. Exact match, not
   // case-folded, because this string is what the child sees on screen.
   for (const option of correct) {
      if (option.word !== item.target) {
         failures.push(
            `rule 12: correct option "${option.word}" does not spell target ` +
               `"${item.target}" — the item has no right answer`
         );
      }
   }

   // Rule 10 — every distractor is a plausible phonetic spelling of the target,
   // so non-words are valid. Whether a spelling is *plausible* is a judgement
   // about English phonics, which this code must not encode (CLAUDE.md section
   // 11); the human reviewer owns it. What is checked here are the conditions
   // any phonetic spelling of the target has to meet: it is spelled with
   // something, and it is not the target's real spelling — which would be a
   // second correct answer.
   for (const option of distractors) {
      // Same `typeof` guard as rule 11: JSON may be missing the field.
      const spelling = typeof option.word === "string" ? option.word.trim().toLowerCase() : "";
      if (spelling === "") {
         failures.push(`rule 10: a distractor on "${item.target}" has an empty word`);
      } else if (spelling === item.target.trim().toLowerCase()) {
         failures.push(
            `rule 10: distractor "${option.word}" is the real spelling of target ` +
               `"${item.target}", not a phonetic misspelling — two correct answers`
         );
      }
   }

   // Rule 8 (soft) — opening-letters half only; there is no vowel spelling here.
   if (!distractors.some((o) => sharesOpening(o.word, item.target))) {
      warnings.push(
         `rule 8: no distractor resembles target "${item.target}" — none shares its ` +
            `first ${SIMILAR_PREFIX_LENGTH} letters`
      );
   }
}

/* ------------------------------------------------------------------------- *
 * Bank-level validation. Implements CLAUDE.md section 6.
 *
 * Checked over the whole bank, not per item — `validateItem` above is unaware
 * of any item but its own. Messages are prefixed `bank:` rather than `rule N:`
 * because section 6's rules are unnumbered.
 * ------------------------------------------------------------------------- */

/** Section 6: per track, fewer than this and the engine cannot build confidence. */
const MIN_ITEMS_PER_MISCONCEPTION = 3;

const TRACKS: readonly Track[] = ["decodable", "irregular"];

export type TrackCount = {
   /** Distinct items on this track in which the misconception is a distractor. */
   items: number;
   /** Used on this track, but in too few items to reach confidence here. */
   underRepresented: boolean;
};

export type MisconceptionCount = {
   misconceptionId: string;
   /**
    * Distinct items in which this appears as a distractor, both tracks together.
    * Counted per item, not per option: a misconception used by two distractors
    * in the same item still offers the child one chance to select it.
    */
   items: number;
   /** Appears as a distractor somewhere in the bank. */
   used: boolean;
   /** Under-represented on at least one track it is used on. */
   underRepresented: boolean;
   /**
    * The minimum is per track, because section 7 never averages the tracks: two
    * decodable items and one irregular item are not three items of evidence on
    * either.
    */
   byTrack: Record<Track, TrackCount>;
};

export type BankReport = {
   /**
    * Must not ship: a referenced misconception that does not exist, or an option
    * still carrying inherited advice.
    */
   failures: string[];
   /** Under-representation, one per misconception per track. Expected while the bank is small. */
   warnings: string[];
   /** One row per defined misconception, in `misconceptions.json` order. */
   counts: MisconceptionCount[];
};

export function validateBank(items: Item[], misconceptions: Misconception[]): BankReport {
   const failures: string[] = [];
   const warnings: string[] = [];

   // Doubles as the existence check: a key is present iff the misconception is
   // defined, so an absent key is an unknown reference. Values are item ids per
   // track.
   const itemsByMisconception = new Map<string, Record<Track, Set<string>>>();
   for (const m of misconceptions) {
      itemsByMisconception.set(m.id, { decodable: new Set(), irregular: new Set() });
   }

   for (const item of items) {
      const options: Option[] = item.options;

      // No option may still carry inherited advice. Generated distractors copy a
      // seed's advice, which names the seed's word rather than theirs; approval
      // requires the reviewer to have replaced it and cleared the flag. Checked
      // here, at bank entry, not in `validateItem`: candidates legitimately
      // carry the flag until review, and failing them there would count every
      // generated candidate as a machine rejection.
      for (const option of options) {
         if (option.parentAdviceInherited === true) {
            failures.push(
               `bank: item "${item.id}" option "${option.word}" still carries inherited ` +
                  `parentAdvice — the reviewer must replace it before the item enters the bank`
            );
         }
      }

      for (const option of options) {
         if (option.correct || option.misconceptionId === null) continue;

         // Every misconception referenced by any distractor must exist.
         const seen = itemsByMisconception.get(option.misconceptionId);
         if (seen === undefined) {
            failures.push(
               `bank: item "${item.id}" distractor "${option.word}" references unknown ` +
                  `misconception "${option.misconceptionId}"`
            );
            continue;
         }
         seen[item.track].add(item.id);
      }
   }

   const counts: MisconceptionCount[] = misconceptions.map((m) => {
      const seen = itemsByMisconception.get(m.id);
      const byTrack = {} as Record<Track, TrackCount>;
      for (const track of TRACKS) {
         const n = seen?.[track].size ?? 0;
         byTrack[track] = { items: n, underRepresented: n > 0 && n < MIN_ITEMS_PER_MISCONCEPTION };
      }
      const total = TRACKS.reduce((sum, track) => sum + byTrack[track].items, 0);
      return {
         misconceptionId: m.id,
         items: total,
         used: total > 0,
         underRepresented: TRACKS.some((track) => byTrack[track].underRepresented),
         byTrack,
      };
   });

   for (const count of counts) {
      for (const track of TRACKS) {
         const t = count.byTrack[track];
         if (t.underRepresented) {
            warnings.push(
               `bank: misconception "${count.misconceptionId}" appears as a distractor in ` +
                  `${t.items} ${track} item(s), needs at least ${MIN_ITEMS_PER_MISCONCEPTION} per track`
            );
         }
      }
   }

   return { failures, warnings, counts };
}

/**
 * Data model for the item bank. Mirrors CLAUDE.md section 4.
 *
 * These types describe shape only. Rules that a shape cannot express — exactly
 * three options, exactly one correct, a distractor always carrying a
 * misconception id — are enforced at runtime by the validator in
 * `src/engine/validate.ts`, because the item bank is JSON authored by a human
 * and must be checked after parsing rather than trusted at compile time.
 */

/**
 * Fixed vocabulary for vowel sounds, per CLAUDE.md section 4.
 *
 * Declared as a runtime array because the offline generation script has to
 * check model output against it, and a bare type is erased at compile time.
 * `VowelSound` is derived from this array, so the two cannot drift — there is
 * one list, not a type and a parallel constant to keep in sync.
 *
 * Add a member only alongside a note in TASKS.md.
 */
export const VOWEL_SOUNDS = [
   "short-a",
   "long-a",
   "short-e",
   "long-e",
   "short-i",
   "long-i",
   "short-o",
   "long-o",
   "short-u",
   "long-u",
   "oy",
   "ow",
   "aw",
   "oo-long",
   "oo-short",
   "schwa",
   "r-controlled",
] as const;

/**
 * A union rather than `string`, so a typo is a compile error instead of an item
 * that silently never matches its target.
 */
export type VowelSound = (typeof VOWEL_SOUNDS)[number];

/**
 * The two independent tracks. Never averaged together — see CLAUDE.md section 7.
 *
 * `Item` is a discriminated union on this field: the two tracks test different
 * things and carry different data, so the type forks here rather than leaving
 * optional fields that a decodable item could silently omit.
 */
export type Track = "decodable" | "irregular";

/**
 * One error pattern. Referenced by many distractors, on either track.
 *
 * The home activity is not here: it lives on each distractor (`parentAdvice`),
 * because one misconception can need a different activity depending on which
 * wrong answer the child picked.
 *
 * A misconception's track and the track of an item that references it need not
 * match: `have` is tagged `irregular-word` inside a decodable item.
 */
export type Misconception = {
   /** e.g. 'closed-syllable' */
   id: string;
   /**
    * Parent-facing, plain language — the parent screen headline when this
    * misconception is **confirmed**. Describes a child who has the problem, so
    * it must never be used to report a strength.
    */
   label: string;
   /**
    * The same pattern stated as a capability, for when this misconception is
    * **ruled out**. Describes a child who does *not* have the problem.
    *
    * Ruling out is half a diagnosis (CLAUDE.md section 7) and is reported to the
    * parent as a strength; rendering `label` there would tell a parent their
    * child has the very gap the evidence just ruled out. `forParent()` picks
    * between the two, so a component cannot get it wrong.
    *
    * The teacher's words, transcribed verbatim like `label` and `parentAdvice`.
    */
   strengthLabel: string;
   /** technical description, her words */
   teacherNote: string;
   track: Track;
};

/* -- options --------------------------------------------------------------- */

type OptionBase = {
   word: string;
   correct: boolean;
   /** required when `correct` is false; null on the correct option (rule 9) */
   misconceptionId: string | null;
   /**
    * The home activity shown to the parent when this distractor is the evidence,
    * transcribed verbatim from the teacher. Required and non-empty when `correct`
    * is false (rule 11); null on the correct option, which is not evidence of
    * anything.
    */
   parentAdvice: string | null;
   /**
    * True when `parentAdvice` was copied from a seed distractor with the same
    * misconception rather than written for this distractor — generated items
    * only. Marks it for the reviewer to confirm or replace. Absent means false.
    */
   parentAdviceInherited?: boolean;
};

/**
 * An answer choice on a decodable item.
 *
 * `vowelSound` is assigned by a human and never inferred in code: English
 * phonics has too many exceptions for a rule engine, and a wrong inference
 * silently corrupts the bank.
 */
export type DecodableOption = OptionBase & {
   /** the letters carrying the vowel, lowercase — see the tagging convention */
   vowelSpelling: string;
   vowelSound: VowelSound;
};

/**
 * An answer choice on an irregular item. No vowel tags: a sight word is on the
 * irregular list because its letters do not predict its sound, so a vowel
 * comparison would check something the item is not testing. Distractors are
 * plausible phonetic spellings of the target and may be non-words (rule 10).
 */
export type IrregularOption = OptionBase;

export type Option = DecodableOption | IrregularOption;

/* -- items ----------------------------------------------------------------- */

type ItemBase = {
   id: string;
   source: "seed" | "generated";
};

/** "Which word has the same vowel sound as <target>?" */
export type DecodableItem = ItemBase & {
   track: "decodable";
   /** e.g. 'boat' — shown on screen and spoken */
   target: string;
   /** e.g. 'oa' — the letters */
   targetVowelSpelling: string;
   /** e.g. 'long-o' — the sound */
   targetVowelSound: VowelSound;
   /** e.g. 'q-boat.mp3', null if not yet recorded */
   audio: string | null;
   /** exactly 3, enforced by validator rule 1 */
   options: DecodableOption[];
};

/**
 * A sight word. The target is spoken and never shown, so the child has to
 * recognise its spelling among plausible phonetic misspellings.
 */
export type IrregularItem = ItemBase & {
   track: "irregular";
   /** e.g. 'was' — spoken, never displayed */
   target: string;
   /**
    * Required, not nullable: the audio is the only way the target reaches the
    * child. An irregular item without it cannot be asked at all.
    */
   audio: string;
   /** exactly 3, enforced by validator rule 1 */
   options: IrregularOption[];
};

/** One question. Narrow on `track`. */
export type Item = DecodableItem | IrregularItem;

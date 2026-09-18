# CLAUDE.md

Durable project rules. Read this fully at the start of every session.
For current work in progress, read TASKS.md.

---

## 1. What this is

A reading diagnostic for early readers (roughly grades 1-3).

A child answers short vowel-sound questions. Every wrong option is tagged to a
specific phonics misconception. When the same misconception is selected across
several different items, the app reports it to the parent by name, shows the
evidence, and gives one home activity written by a reading teacher.

The differentiator is not the game. It is that a wrong answer identifies **which
broken rule the child is running**, not just that they were wrong.

Two audiences, two screens:

-  **Child**: plays the game. Cannot read instructions, so audio carries the prompt.
-  **Parent**: gets the named misconception plus a five-minute activity.

Domain content comes from a practicing reading teacher. Her wording is
authoritative. Her content lives in `/src/data`, mirrored in section 8.

---

## 2. Stack, locked

-  Vite + React + TypeScript
-  Static site, deployed to Vercel
-  **No backend. No database. No Next.js. No API routes.**
-  All data ships as committed JSON in `/src/data`
-  Audio ships as static files in `/public/audio`, named `q-<target>.<ext>`. The
   **extension is data, not a convention to assume**: each item's `audio` field
   carries the real filename and the player uses it verbatim. The Sept 17 clips
   are `.m4a` (AAC), which Safari and Chrome both play.

Why no backend: nothing in the running app needs a server. The item bank is a
file, the diagnostic engine is arithmetic in the browser, and a server is one
more thing that can fail during a recorded demo.

If a task seems to need persistence, use `localStorage`. Do not add a server.

---

## 3. The AI boundary, non-negotiable

**No model call happens at runtime.** The shipped app makes zero network
requests to any LLM.

AI is used in exactly one place: an offline script in `/scripts` that generates
candidate items from teacher-written seeds. Those candidates pass through the
validator, then a human reviews survivors, then approved items are committed to
`items.json`.

Reasons this is deliberate, and should be stated in the writeup:

-  A six-year-old needs an instant response
-  The diagnosis must be deterministic and explainable to a parent
-  Generation errors get caught by a validator before a child sees them; a live
   tutoring model's errors do not

The rejection log from the generation run is a deliverable, not a byproduct.

---

## 4. Data model

Defined in `/src/types.ts`. `Item` and `Option` are discriminated unions on
`track`; the two tracks test different things and carry different data.

### Misconception

One record per error pattern. Referenced by many distractors, on either track.

```ts
type Misconception = {
   id: string; // 'closed-syllable'
   label: string; // parent-facing — shown when CONFIRMED. Describes a child who has the problem
   strengthLabel: string; // parent-facing — shown when RULED OUT. Describes a child who does not
   teacherNote: string; // technical description, her words
   track: "decodable" | "irregular";
};
```

**Two labels, and the choice between them is not the component's.** Ruling out is
half a diagnosis (section 7) and is reported as a strength; rendering `label`
there tells a parent their child has the exact gap the evidence just ruled out.
`forParent()` attaches the right one to every finding as `label`, so a component
renders what it is handed and cannot pick wrong. Both are the teacher's words,
transcribed verbatim — the same rule as `parentAdvice` (section 11).

**Parent advice does not live here.** It lives on each distractor, because one
misconception can need a different home activity depending on which wrong answer
the child picked. (Changed Sept 14; see the decisions log. Before that, advice
sat here once and was shared by every item.) A misconception's `track` and the
track of an item that references it need not match — `have` is tagged
`irregular-word` inside a decodable item.

### Item

```ts
type DecodableItem = {
   id: string;
   track: "decodable";
   source: "seed" | "generated";
   target: string; // 'boat' — shown on screen and spoken
   targetVowelSpelling: string; // 'oa'  — the letters
   targetVowelSound: VowelSound; // 'long-o' — the sound
   audio: string | null; // 'q-boat.mp3', null if not yet recorded
   options: DecodableOption[]; // exactly 3
};

type IrregularItem = {
   id: string;
   track: "irregular";
   source: "seed" | "generated";
   target: string; // 'was' — spoken, never shown
   audio: string; // required: the audio is the only way the target reaches the child
   options: IrregularOption[]; // exactly 3
};

type Item = DecodableItem | IrregularItem;
```

A decodable item asks which option shares the target's vowel sound. An irregular
item speaks a sight word without showing it, and the child picks its spelling
from plausible phonetic misspellings. On an irregular item the correct option's
word **is** the target's spelling, by design.

### Option

```ts
type OptionBase = {
   word: string;
   correct: boolean;
   misconceptionId: string | null; // required on a distractor, null on the correct option
   parentAdvice: string | null; // required and non-empty on a distractor, null on the correct option
   parentAdviceInherited?: boolean; // generated items only: advice copied from a seed distractor
};

type DecodableOption = OptionBase & {
   vowelSpelling: string;
   vowelSound: VowelSound;
};

type IrregularOption = OptionBase; // no vowel tags
```

`parentAdvice` is the home activity shown when this distractor is the evidence,
transcribed verbatim from the teacher. Section 11 still governs it: never
written, never reworded. A distractor whose advice has not arrived is left empty
and fails validator rule 11 until it does. On generated items the advice is
inherited from a seed distractor and flagged `parentAdviceInherited` — see 5b.

**On decodable options, `vowelSound` is mandatory and must be assigned by a human
or confirmed by one.** Never infer it in code. English phonics has too many
exceptions for a rule engine and a wrong inference silently corrupts the bank.

**Irregular options carry no vowel tags.** A sight word is on the irregular list
because its letters do not predict its sound, so tagging one would make the
validator compare something the item is not testing.

Use a fixed vocabulary for `vowelSound`: `short-a`, `long-a`, `short-e`, `long-e`,
`short-i`, `long-i`, `short-o`, `long-o`, `short-u`, `long-u`, `oy`, `ow`, `aw`,
`oo-long`, `oo-short`, `schwa`, `r-controlled`. It is declared once, as the
runtime array `VOWEL_SOUNDS`, and the `VowelSound` type is derived from it. Add to
this list only with a note in TASKS.md.

### vowelSpelling tagging convention

Decodable options only.

`vowelSpelling` is the **letters that carry the vowel**, written lowercase, using
these rules. Validator rule 5 compares these strings directly, so inconsistent
tagging causes silent false passes.

-  Single vowel: the letter alone. `ten` → `e`, `bot` → `o`, `ran` → `a`
-  Vowel team: both letters. `boat` → `oa`, `bread` → `ea`, `free` → `ee`,
   `day` → `ay`, `boy` → `oy`
-  Split vowel (silent e): vowel, underscore, e. `have` → `a_e`, `cape` → `a_e`,
   `note` → `o_e`
-  R-controlled: vowel plus r. `bird` → `ir`, `horse` → `or`
-  `toe` → `oe` (vowel team, not split vowel — the o and e are adjacent)
-  Y as a vowel: `y` alone, where it is the only vowel in the word. `by` → `y`.
   Teacher-confirmed Sept 14: students are taught that y can act as a vowel.

When a word is genuinely ambiguous, ask. Do not pick one and move on.

---

## 5. Validator rules

In `/src/engine/validate.ts`. Pure function, item in, list of failures out. One
entry point, `validateItem`, for both tracks; it branches on `item.track`.

| Rule | Applies to | Kind |
| ---- | ---------- | ---- |
| 1, 2, 6, 9, 11 | both tracks | hard |
| 3, 4, 5, 7 | decodable only | hard |
| 10, 12, 13 | irregular only | hard |
| 8 | both tracks (irregular: opening-letters half only) | soft |

**Hard rules. An item failing any of these must not ship.**

1. Exactly 3 options.
2. Exactly 1 option marked correct.
3. _Decodable._ The correct option's `vowelSound` **equals** the target's
   `vowelSound`. (Without this the item has no right answer.)
4. _Decodable._ Every distractor's `vowelSound` **differs** from the target's
   `vowelSound`. (Otherwise there are two correct answers.)
5. _Decodable._ The correct option's `vowelSpelling` **differs** from the target's
   `vowelSpelling`. This is the core design rule: a child must not be able to
   letter-match their way to the answer.
6. Every distractor has a non-null `misconceptionId` that exists in
   `misconceptions.json`.
7. _Decodable._ No option word equals the target word. (Not on irregular items,
   where the correct option's word is the target's spelling by design.)

**Soft rule. Warn, do not fail.**

8. At least one distractor should be visually similar to the target — sharing
   either the same `vowelSpelling` or the same first two letters. This is the
   trap that catches letter-matching. Warn when absent so a human can judge. On
   irregular items only the first-two-letters half applies; there is no vowel
   spelling to compare.

**Hard rules added after the seed items were written. Must not ship.**

9. The correct option's `misconceptionId` must be `null`. A misconception pinned
   to the right answer would make a correct response count as evidence of an
   error, corrupting the diagnosis — and section 7 counts correct answers as
   evidence in the other direction, so the damage runs both ways. _(Sept 13.)_
10. _Irregular._ Every distractor must be a plausible phonetic spelling of the
    target. Non-words are valid. _(Sept 14.)_
    **Whether a spelling is plausible is a phonics judgement and is not encoded
    in code** (section 11) — the human reviewer owns it. The validator checks
    only what any phonetic spelling must satisfy: the word is non-empty, and it
    is not the target's real spelling, which would be a second correct answer.
11. Every distractor's `parentAdvice` must be a non-empty string. The parent sees
    the advice attached to the distractor the child picked; without it a
    confirmed misconception comes with nothing to do. Section 11 still applies —
    missing advice is left empty, never written — so an item waiting on the
    teacher fails here rather than shipping blank. _(Sept 14.)_
12. _Irregular._ The correct option's `word` must equal the item's `target`,
    exactly. The irregular counterpart of rule 3: without it the item has no
    right answer. Not case-folded — this string is what the child sees.
    _(Sept 14.)_
13. _Irregular._ `audio` must be a non-empty string. The type already requires
    it, but the bank is JSON cast at the import boundary, which bypasses the
    type. The target is spoken and never shown, so an irregular item without
    audio cannot be asked. _(Sept 14.)_

Numbering is deliberate. The existing numbers are load-bearing — validator
failure strings quote them — so later rules are appended rather than renumbered,
even where that puts hard rules after the soft one.

Write the validator with the seed items in section 8 as passing fixtures
and at least two deliberately broken items as failing fixtures.

**If the validator fails a teacher-written seed item, the rule is wrong, not the
item.** Stop and flag it. Do not edit her item to satisfy the code.

---

## 5b. The generation script

`/scripts/generate.ts`. Runs offline on a developer machine. Never in the browser,
never in CI, never at runtime.

**Input:** the teacher-written seed items from section 8, the misconception table,
and a target count.

**Prompt shape:** few-shot from the seeds. State the hard validator rules
explicitly in the prompt — the model performs far better when it knows the
constraint than when the constraint is only enforced afterwards. Ask for one
misconception at a time rather than a mixed batch.

**Output:** strict JSON matching the `Item` type, `source` set to `generated`.
Request no prose, no markdown fences.

**Pipeline:** generate → validate → write survivors to a review file → human
reviews → approved items appended to `items.json`.

**Parent advice is never generated.** It is the teacher's, verbatim (section 11).
Each generated distractor inherits `parentAdvice` from a seed distractor **on the
same track**, preferring one with the **same misconception and the same vowel
sound**, and falling back to the same misconception alone — first in `items.json`
order within each tier. It is marked `parentAdviceInherited: true`, and the
candidate record lists it as **provisional** with the seed distractor it came from
and which tier matched. All inherited advice is provisional, because it names the
seed's word rather than the generated one; the reviewer replaces it. **An item
cannot enter the bank while any option still carries the flag** (section 6).
Rule 11 applies at bank entry as for any item; a generated distractor whose
misconception has no seed advice to inherit gets none and fails rule 11.

**In `closed-syllable` advice, practice words must share the vowel sound of the
word being taught.** Confirmed by the teacher Sept 14, and scoped to
`closed-syllable` advice only — `got` (short o) practises `lot, pop, mop`, never
`pin` or `wet`. **It does not apply to other misconceptions.** Vowel-team
activities deliberately contrast sounds — `soup`'s cards pair *Youth* with
*Pound* to show what `ou` can say — and the rule must not fight that. It is **not
checked in code**: telling whether two arbitrary words share a vowel sound means
inferring vowel sounds, which section 4 forbids. The reviewer checks it. For
generated `closed-syllable` distractors the same-vowel-sound inheritance tier
usually gets the practice vowel right, but the routine still names the seed's
word, so it is replaced at review either way.

The model **must not** invent misconception ids. Give it the fixed list and
require every distractor to use one. A candidate that does not fit an existing
misconception is rejected, not accommodated with a new category.

### Rejection log

`/scripts/rejection-log.json`, committed to the repo. It is a deliverable, not
debug output — the generation numbers in the writeup come from this file.

Each entry records: the candidate item, which validator rules it failed, and
whether it was rejected mechanically or by the human reviewer. Track the two
separately. "The validator caught 140, the teacher caught a further 12 that were
structurally valid but pedagogically wrong" is the interesting finding, and it
is only available if human rejections are logged distinctly from machine ones.

Summary counts to report: candidates generated, failed per rule, passed to human,
rejected by human, approved.

---

## 6. Bank-level rules

Checked by a separate function over the whole bank, not per item. Both tracks
are in scope, and counts are kept per track.

-  Every misconception referenced by any distractor must exist.
-  Each misconception needs **at least 3 items per track** where it appears as a
   distractor option, on every track it is used on. Fewer than 3 and the engine
   cannot build confidence. **Per track, not bank-wide:** section 7 never averages
   the tracks, so two decodable items and one irregular item total three but are
   not three items of evidence on either. A misconception used on only one track
   is not under-represented on the other. _(Decided Sept 14.)_
-  Report per-misconception item counts on every generation run.
-  **No item may enter the bank with any option carrying
   `parentAdviceInherited: true`.** Approval requires the reviewer to have
   replaced the inherited advice and cleared the flag. Enforced by
   `validateBank`, not per item: candidates carry the flag until review, and
   failing them in `validateItem` would count every generated candidate as a
   machine rejection. _(Decided Sept 14.)_
-  **Advice is not required to agree across a misconception.** Since Sept 14,
   `parentAdvice` lives on each distractor, so two distractors sharing a
   misconception may carry different activities on purpose (section 4). A bank
   check that flagged differing advice for one misconception would be wrong. The
   engine picks one to show — see the decisions log entry for T10.

---

## 7. Engine behaviour

In `/src/engine/`. Every threshold and count below is a named constant in one
file, not a magic number scattered through the code.

### Session shape

-  **12 items per session.** Roughly five minutes at a first-grader's pace.
-  Session ends at 12 items. There is no early exit on confidence, because a
   short session that stops at item 5 looks broken to a parent watching.
-  **A target word appears at most once per session.** With a bank this size, a
   child seeing `boat` twice reads as a bug.

### Track interleaving

-  Default mix: **8 decodable, 4 irregular**, interleaved rather than blocked.
   Irregular items appear at roughly positions 3, 6, 9, 12.
-  Blocking all the irregular items at the end means a child who tires answers
   that whole track badly, and the diagnosis is then about stamina, not reading.

### Evidence, both directions

Track two counts per misconception:

-  **selections** — the child picked that misconception's distractor
-  **exposures** — the child was offered that distractor and had the chance

A raw selection count without exposures is meaningless. Two selections out of two
exposures is a confirmed pattern. Two out of nine is noise.

**Correct answers are evidence too.** When a child is exposed to a misconception's
distractor and does _not_ pick it, that counts against the misconception. Ruling
out is half a diagnosis and a parent screen that says "his vowel teams are solid"
is worth as much as one that names a problem.

### Thresholds

-  2 selections across different items → **suspected**
-  3 selections across different items → **confirmed**
-  3+ exposures with 0 selections → **ruled out**, report as a strength
-  Anything else → insufficient evidence, report nothing

### Other rules

-  `decodable` and `irregular` are independent tracks. Never average them.
-  **Randomize option order at render time.** The seed items place the correct
   answer in positions 3, 2, 2. A child finds that pattern faster than you will.
-  Only surface a misconception to the parent once it is **confirmed**. Suspected
   is internal state used to weight item selection, never shown.

### Item selection

-  First 4 items: spread across misconceptions, broadest coverage.
-  After that: weight toward misconceptions currently **suspected**, to confirm or
   rule out rather than discovering new ones.
-  Never let one misconception consume more than half the session — **except on a
   track that measures nothing else.** Revised Sept 17. The cap stops one
   misconception dominating a track that tests several, which is the decodable
   track's four. The irregular track has exactly one native misconception
   (`irregular-word`, carried by every irregular item), so a cap there cannot add
   variety — it can only leave irregular slots empty, and it did: the track was
   confirmable in about a quarter of sessions. The test is "is this the only
   thing this track measures", **not** "is this native here" — every decodable
   misconception is native to the decodable track, so exempting on nativeness
   alone would remove the cap precisely where it works. `irregular-word` stays
   capped on the decodable track, where it is a guest.

---

## 8. Seed items and misconceptions — mirror of the data

> **This section is a mirror of `src/data/items.json` and
> `src/data/misconceptions.json`, generated from those files on Sept 15. It is
> not the teacher's original message.** The data files are the source of truth:
> if this section and the data disagree, the data wins and this section is
> stale. Update it by regenerating from the data, never by hand-editing values
> here. Her original Sept 13 notes on seeds 1-3 are archived verbatim in the
> TASKS.md decisions log.
>
> **Sept 17: the bank holds 36 items — her 9 seeds plus all 27 reviewed
> generated items.** The per-item tables below cover the **8 seeds only**; the
> reviewed items live in `items.json` and are not transcribed here, because
> restating 27 machine-generated items would add nothing the data file does not
> already hold and would be one more thing to drift. Counts: **32 decodable, 4
> irregular**; per misconception (decodable/irregular) closed-syllable 25/0,
> vowel-team-assumed 13/0, ea-three-sounds 10/0, irregular-word 11/4,
> ie-two-sounds 5/0. `validateBank` reports no failures and no
> under-representation warnings. Nothing is left pending advice.
>
> The ninth seed is **`seed-because`** (Sept 17), the fourth irregular item, and
> it is what makes that track confirmable at all.
>
> Two items share the target **cake** (`gen-cake-1`, `gen-cake-2`) with
> different correct answers and different distractors. That is allowed: section
> 7's rule is one target per **session**, which `select.ts` enforces.

The teacher's authority over this content is unchanged: do not paraphrase,
"improve", or invent seeds, tags, misconceptions or advice — in the data or here.

Questions are per track, not stored per item:

-  Decodable: "Which word has the same vowel sound as **<target>**?"
-  Irregular: "How do you spell the word ______?" — the target is spoken, never
   shown.

Parent advice lives on each distractor in `items.json` (section 4) and is **not
duplicated here**, so it cannot drift. It is the teacher's, spelling corrected
only, and longer than typical UI copy on purpose: show the first line and let
the parent expand.

### Seed 1 — `seed-boat` (decodable)

Target **boat**: `oa`, `long-o`.

| option | vowelSpelling | vowelSound | correct | misconception |
| ------ | ------------- | ---------- | ------- | ------------- |
| bot | `o` | `short-o` |  | `closed-syllable` |
| gone | `o_e` | `short-o` |  | `irregular-word` |
| toe | `oe` | `long-o` | **yes** | — |

### Seed 2 — `seed-bread` (decodable)

Target **bread**: `ea`, `short-e`.

| option | vowelSpelling | vowelSound | correct | misconception |
| ------ | ------------- | ---------- | ------- | ------------- |
| free | `ee` | `long-e` |  | `vowel-team-assumed` |
| ten | `e` | `short-e` | **yes** | — |
| steak | `ea` | `long-a` |  | `ea-three-sounds` |

### Seed 3 — `seed-rain` (decodable)

Target **rain**: `ai`, `long-a`.

| option | vowelSpelling | vowelSound | correct | misconception |
| ------ | ------------- | ---------- | ------- | ------------- |
| have | `a_e` | `short-a` |  | `irregular-word` |
| day | `ay` | `long-a` | **yes** | — |
| ran | `a` | `short-a` |  | `closed-syllable` |

### Seed 4 — `seed-pie` (decodable)

Target **pie**: `ie`, `long-i`.

| option | vowelSpelling | vowelSound | correct | misconception |
| ------ | ------------- | ---------- | ------- | ------------- |
| him | `i` | `short-i` |  | `closed-syllable` |
| piece | `ie` | `long-e` |  | `ie-two-sounds` |
| by | `y` | `long-i` | **yes** | — |

### Seed 5 — `seed-snow` (decodable)

Target **snow**: `ow`, `long-o`.

| option | vowelSpelling | vowelSound | correct | misconception |
| ------ | ------------- | ---------- | ------- | ------------- |
| soup | `ou` | `oo-long` |  | `vowel-team-assumed` |
| got | `o` | `short-o` |  | `closed-syllable` |
| toad | `oa` | `long-o` | **yes** | — |

### Seed 6 — `seed-what` (irregular)

Target **what**, spoken only. Audio: `q-what.mp3`.

| option | correct | misconception |
| ------ | ------- | ------------- |
| wut |  | `irregular-word` |
| whut |  | `irregular-word` |
| what | **yes** | — |

### Seed 7 — `seed-who` (irregular)

Target **who**, spoken only. Audio: `q-who.mp3`.

| option | correct | misconception |
| ------ | ------- | ------------- |
| hoo |  | `irregular-word` |
| hou |  | `irregular-word` |
| who | **yes** | — |

### Seed 8 — `seed-the` (irregular)

Target **the**, spoken only. Audio: `q-the.mp3`.

| option | correct | misconception |
| ------ | ------- | ------------- |
| thu |  | `irregular-word` |
| tha |  | `irregular-word` |
| the | **yes** | — |
### Misconceptions

`label` is shown when the misconception is **confirmed**, `strengthLabel` when it
is **ruled out**. Both are hers, verbatim.

| id | label — confirmed | strengthLabel — ruled out | teacherNote | track |
| -- | ----------------- | ------------------------- | ----------- | ----- |
| `closed-syllable` | Does not have an understanding of closed syllables. | Understands and recognizes what a closed syllable is. | defaults to short vowel; has not mastered the condition | decodable |
| `vowel-team-assumed` | Guesses a vowel team's sound from its letters. | Uses knowledge of vowel teams to identify their sounds. | assumes a vowel team's sound from its letters | decodable |
| `ea-three-sounds` | Doesn't know that ea makes three different sounds. | Recognizes that ea can represent three different sounds. | does not know `ea` makes three different sounds | decodable |
| `irregular-word` | Hasn't memorized words that can't be sounded out. | Recognizes that some words cannot be fully decoded and must be memorized. | has not memorized a word that cannot be decoded | irregular |
| `ie-two-sounds` | Doesn't know that ie makes two different sounds. | Recognizes that ie can make two sounds. | _(none yet)_ | decodable |

> Sept 16: every label in both columns ends in a period. Added to the
> `closed-syllable` and `ie-two-sounds` strength labels first, then to all five
> deficit labels, so a confirmed finding and a strength are punctuated alike when
> they sit one under the other on the parent screen. **Punctuation only; no word
> was changed.** The project owner's decision, recorded in TASKS.md. This is the
> one sanctioned departure from section 11's verbatim rule, and it does not
> generalise: wording is still never edited to suit the code.

### Sight words (irregular track)

**Not from the data files** — the teacher's list, kept here because no data file
holds it yet. Source words for future irregular items.

what, the, is, was, to, do, put, one, two, have, there, who, where, were, because

---

## 9. UI constraints

Tablet-first, works in mobile Safari and Chrome, full-bleed.

Child screen:

-  Target word large, on screen **and** spoken aloud. Replay button, unlimited.
-  Three options on screen, **never spoken**. Reading them aloud destroys the
   decoding task, which is the whole measurement.
-  Big tap targets.
-  **No score. No timer. No red X. No streak.** Wrong answers cost nothing visible.
   The app deliberately serves items the child will miss; a six-year-old who feels
   they are failing quits.

### What happens on tap

This is the most-executed interaction in the app. Specified so it does not get
invented per session.

1. The tapped option gets a brief neutral highlight. Same treatment whether right
   or wrong.
2. A short pause, ~600ms.
3. Advance to the next item.

**The child is never told whether they were right.** Three reasons: it keeps the
emotional cost of a wrong answer at zero, it prevents a child from learning the
answer mid-session and contaminating later evidence, and this is a diagnostic
instrument, not a teaching tool. The teaching happens at home with the parent
activity.

Progress is shown as position only, e.g. a row of 12 dots filling in. Dots are
neutral — they do not encode right or wrong.

### Typography and accessibility

-  Body and option text must use a font with **single-storey `a` and `g`**, the
   letterforms early readers are taught. Most default sans-serifs use double-storey
   forms that beginning readers do not recognize. Andika, Lexend, or a comparable
   primary-education face.
-  Never use colour alone to carry meaning on the parent screen. The palette must
   be legible under red-green colour blindness.
-  Minimum tap target 60px.

Parent screen:

-  Named misconception as the headline, in plain language.
-  Evidence line: the specific words where the pattern appeared.
-  One home activity. Expandable to her full script.
-  Both tracks shown separately.

Visual direction, **per screen** (revised Sept 16 — the two audiences want
opposite things, and one direction for both was serving neither):

-  **Child screen: saturated, rounded, illustration-led.** The visual language of
   Khan Academy Kids and Duolingo ABC. A zookeeper character, real colour, cards
   with presence, a zoo with ground and sky. A six-year-old does not read a muted
   palette as calm, they read it as dull, and the child has to *want* to answer
   twelve questions they will partly get wrong.
-  **Parent screen: warm and calm, not a bright kid app.** Generous whitespace,
   muted palette, one thing on screen at a time. This half is a diagnostic
   instrument shown to an adult, and it must not look like a game that has just
   judged their child.

The two screens are shaped differently, because their readers are (revised
Sept 16, second pass, when DESIGN.md landed):

-  **Child screen: full viewport, landscape, no scrolling.** The zoo fills the
   screen and the question floats on it. Not a centred column — DESIGN.md
   sections 2 and 11.
-  **Parent screen: a measure-width column** an adult reads once, probably on a
   phone. It scrolls, and it carries none of the child screen's furniture.

Unchanged by any of this: nothing on the child screen encodes right or wrong.
The three option cards are identical and the tapped highlight is a neutral.

---

## 10. Out of scope

Do not build these. They are listed in the writeup as next steps.

-  Authentication, accounts, user profiles
-  Database or any server
-  Teacher dashboard or class roster
-  Speech input or speech recognition
-  Cross-session progress or intervention tracking
-  Analytics or telemetry
-  Internationalization

`localStorage` for surviving a page refresh is allowed and is not a database.

---

## 11. Anti-hallucination rules

This project's content is domain-specific and written by a subject expert. Getting
it subtly wrong is worse than leaving it blank.

-  **Never invent items.** Every item is either a teacher seed or a generated
   candidate that passed the validator and human review.
-  **Never invent or reword parent advice.** It is transcribed verbatim. If a piece
   is missing, leave the field empty and note it in TASKS.md.
-  **Never infer a vowel sound in code.** It is data, assigned by a human.
-  **Never invent a misconception id.** Use only the ids in `misconceptions.json`, mirrored in section 8. If a
   generated distractor does not fit an existing misconception, reject it rather
   than creating a new category.
-  **Never assume phonics rules.** English is irregular. If a rule seems to follow
   from the seeds, say so as a question rather than encoding it.
-  If a task requires domain content that is not in this file or the data files,
   **stop and ask** rather than filling the gap plausibly.

---

## 12. File layout

```
/src
  types.ts
  /engine
    validate.ts        item + bank validation
    diagnose.ts        selection tracking, confidence
    select.ts          which item comes next
  /data
    items.json
    misconceptions.json
  /components
    GameScreen.tsx
    ParentScreen.tsx
/public/audio          q-<target>.<ext>   (the Sept 17 clips are .m4a)
/scripts
  generate.ts          offline, calls the model
  review.ts            rejection log + records human approve/reject decisions
  rejection-log.json   committed, it is a deliverable
CLAUDE.md
TASKS.md
```

---

## 13. Timeline

Deadline: **Sept 18, 11:59 PM CDT.** Submit the morning of the 18th.

Anything that does not appear in the two-and-a-half-minute demo video competes
for hours with something that does. When a choice is unclear, pick the option
that makes the parent screen better.

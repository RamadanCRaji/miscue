# TASKS.md

Working file. Read CLAUDE.md first — it holds the rules that do not change.

**Deadline: Sept 18, 11:59 PM CDT. Submit the morning of the 18th.**

---

## How to work this file

**Do exactly one task per prompt. Then stop.**

When told to work on a task:

1. Read CLAUDE.md in full. Read this file.
2. Do only the numbered task named. Touch only the files that task lists.
3. Verify the done condition yourself. Run the tests if there are tests.
4. Tick the checkbox and append a one-line result under the task.
5. **Stop and report.** Do not start the next task. Do not "while I'm here" fix
   anything adjacent. Do not refactor files the task did not name.

If a task cannot be completed as written — missing content, an ambiguous rule, a
contradiction with CLAUDE.md — **stop and ask**. Do not fill the gap with a
plausible guess. Section 11 of CLAUDE.md governs.

Tasks marked **[HUMAN]** are not yours. Skip them.

---

## Blocking gaps

Do not build against these. They need the teacher.

-  ~~The irregular-word track has no question format.~~ **Resolved Sept 14.** The
   teacher delivered the first irregular-track seed. Format: the target sight
   word is spoken and never shown; the child picks its spelling from three
   options whose distractors are plausible phonetic misspellings (non-words
   allowed). Types, validator rules (10, 12, 13) and CLAUDE.md sections 4-6 are
   updated for it. **Still open:** the three new seeds, the irregular one
   included, are now in `items.json` (Sept 14) as `seed-pie`, `seed-snow` and
   `seed-what`, after the per-distractor `parentAdvice` migration.
-  Confirmation that the misconception list is complete for grades 1-3.
-  Audio files do not exist yet. Set `audio: null` and move on.

---

## Sept 13

### T1 — Scaffold

Repo exists and is cloned. Set up Vite + React + TypeScript in it.

Files: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`,
`src/main.tsx`, `src/App.tsx`

Also install and configure Vitest for unit tests.

**Done when:** `npm run dev` serves a page and `npm run test` runs with zero
tests found and no error.

-  [x] T1

   Vite 8 + React 19 + TS 7 + Vitest 5 scaffolded. `npm run dev` serves 200 at
   localhost:5173, `npm run test` exits 0 with "No test files found". Node pinned
   to 24 via `.nvmrc` — see decisions log.

---

### T2 — Types

Write `src/types.ts` with `Misconception`, `Item`, and `Option` exactly as
specified in CLAUDE.md section 4. Include the `vowelSound` vocabulary as a union
type, not a bare string.

Files: `src/types.ts`

**Done when:** the file compiles under `tsc --noEmit` and every field in section 4
is present with the stated type.

-  [x] T2

   `src/types.ts` written. `Misconception`, `Item`, `Option` per section 4, with
   `VowelSound` (17 members) and `Track` as unions. Passes `tsc --noEmit`;
   verified negatively that a bad vowel sound, a bad track/source, and any
   missing field all fail to compile.

---

### T3 — Propose vowel tags for review

Do **not** write any data files yet.

The three seed items in CLAUDE.md section 8 contain 12 words: boat, bot, boy, toe,
bread, free, ten, steak, rain, have, day, ran.

Output a markdown table to the chat with one row per word: word,
`vowelSpelling`, `vowelSound`, and a short note on anything ambiguous. Follow the
tagging convention in CLAUDE.md section 4.

This is a proposal for a human to check against the teacher's own reasoning. It
is not data yet.

**Done when:** the table is printed to chat. No files written.

-  [x] T3

   Table for all 12 words proposed in chat. No files written beyond this tick.
   10 of 12 `vowelSpelling` tags are given verbatim in the CLAUDE.md section 4
   convention; only `rain → ai` and `steak → ea` are new. All 12 sounds fall
   inside the existing vocabulary — no additions needed. Two flagged for the
   teacher: `steak` (long-a) and `have` (a_e / short-a, possible schwa).
   Awaiting the [HUMAN] check before T4.

---

### T4 — Encode the data files

**Blocked until T3 is approved by the human.** Use the approved tags exactly.

Write `src/data/misconceptions.json` with the four misconceptions from CLAUDE.md
section 8. Transcribe `parentAdvice` verbatim from the teacher's writing — do not
edit, shorten, or improve it. Where advice is missing for a misconception, set
the field to an empty string and note it here.

Write `src/data/items.json` with the three seed items. `source: "seed"`,
`audio: null`, `track: "decodable"` for all three.

Files: `src/data/misconceptions.json`, `src/data/items.json`

**Done when:** both files parse as valid JSON and typecheck against `src/types.ts`.

-  [x] T4

   Both files written with the T3-approved tags. Parse as valid JSON and
   typecheck against `src/types.ts` (verified by inlining the data as typed
   literals, and confirmed non-vacuous by corrupting a `vowelSound` and a
   `track` and watching it fail). Her option order preserved, so the correct
   answers sit at positions 3, 2, 2 as CLAUDE.md section 7 records.

   **No empty fields remain.** All four `label` and all four `parentAdvice`
   values are the teacher's own wording. `misconceptions.json` is complete and
   nothing in it is blocked on her.

   The `label` values arrived last and were her revision, not a transcription of
   anything already in CLAUDE.md — section 8's table stays developer-facing and
   lives in `teacherNote`. The parent screen headline (section 9) is unblocked.

   **Sept 13, later** — all four `parentAdvice` fields transcribed verbatim
   from her writing, and she confirmed `on` was a typo for `oa` in
   `vowel-team-assumed` ("Write oa, oe, and oy on several index cards" — she
   wants all three practiced). Four other typos in her text are deliberate
   holds, left exactly as written: a stray comma and `it's` for `its` in
   `closed-syllable`, a missing stop in `ea-three-sounds`, and "Create 3 by 3
   chart" in `irregular-word`. Do not silently fix these.

---

### T5 — Item validator

Write `src/engine/validate.ts` exporting `validateItem(item, misconceptions)`
returning `{ failures: string[], warnings: string[] }`.

Implement hard rules 1 through 7 and soft rule 8 from CLAUDE.md section 5. Each
failure string names the rule it broke.

Files: `src/engine/validate.ts`

**Done when:** the function exists and typechecks. Tests come next.

-  [x] T5

   `src/engine/validate.ts` written, exporting `validateItem(item,
   misconceptions)` -> `{ failures, warnings }` plus the `ValidationResult`
   type. Hard rules 1-7 push to `failures`, soft rule 8 to `warnings`. Every
   message opens with `rule N:` and names the offending word. Passes
   `tsc --noEmit`. Smoke-checked out of tree: all three seeds return zero
   failures and zero warnings, and each of the 8 rules was made to fire once.
   Tests are T6.

---

### T6 — Validator tests

Write `src/engine/validate.test.ts`.

-  The three seed items each return zero failures.
-  Two hand-written broken fixtures each return the specific expected failure:
   one where the correct option's `vowelSpelling` matches the target's (rule 5),
   one where a distractor has a null `misconceptionId` (rule 6).

**If a seed item fails, stop. Do not edit the item.** The rule is wrong, not the
teacher's item. Report which rule fired and wait.

Files: `src/engine/validate.test.ts`

**Done when:** `npm run test` passes.

-  [x] T6

   `src/engine/validate.test.ts` written. `npm run test` — 8 passed. All three
   seeds break no hard rule, so no rule needed questioning. Broken fixtures for
   rule 5 and rule 6 as specified, plus rule 9 since it landed this session.
   Each derives from one hand-written valid base item by a single field change,
   and a test asserts that base is clean, so a failure can only come from that
   change. Mutation-checked: disabling rule 5, 6 or 9 in `validate.ts` turns the
   matching test red.

---

### T7 — Bank validator

Write `validateBank(items, misconceptions)` in the same file. Implements
CLAUDE.md section 6: every referenced misconception exists, and each misconception
used has at least 3 items. Returns per-misconception counts.

Running it on the current 3-item bank should report all four misconceptions as
under-represented. That is expected, not a failure.

Files: `src/engine/validate.ts`, `src/engine/validate.test.ts`

**Done when:** tests pass and the count report prints.

-  [x] T7

   `validateBank(items, misconceptions)` added to `src/engine/validate.ts`,
   returning `{ failures, warnings, counts }`. Unknown misconception references
   are failures; under-representation is a warning. `npm run test` — 16 passed,
   and the count report prints on the plain run:

   ```
   closed-syllable       2 item(s)  under-represented
   vowel-team-assumed    2 item(s)  under-represented
   ea-three-sounds       1 item(s)  under-represented
   irregular-word        1 item(s)  under-represented
   ```

   All four under-represented on the 3-item bank, as T7 predicted.

---

### [HUMAN] Sept 13

-  [ ] Check T3's tag table against the teacher's reasoning, then unblock T4
-  [ ] Write the demo script, beat by beat, before any UI exists
-  [ ] Message her: the irregular-track example item, 3-4 more seeds, audio timing

---

## Sept 14

### T8 — Generation script

Per CLAUDE.md section 5b. Few-shot from the seeds, one misconception at a time,
validator rules stated in the prompt, strict JSON out.

Files: `scripts/generate.ts`

**Done when:** running it produces candidates and writes
`scripts/candidates.json`. Do not append anything to `items.json`.

-  [x] T8

   First real run Sept 14: `npm run generate`, 6 per misconception across all 5,
   `claude-opus-5`. 30 candidates, 30 passed `validateItem`, 0 rejected, 0
   malformed, 0 API errors, 0 rule 8 warnings. `scripts/candidates.json`
   written; `items.json` untouched. 60 distractors inherited advice (28 same
   misconception + vowel sound, 32 misconception only), all provisional. The
   clean machine pass rate is not a quality signal — see the review notes in
   the run report; human review (T9 and the Sept 14 [HUMAN] task) is next.

---

### T9 — Rejection log

Pipe candidates through `validateItem`. Write `scripts/rejection-log.json` with
per-candidate failures, and separate machine rejections from human rejections as
CLAUDE.md 5b requires. Print the summary counts.

Files: `scripts/review.ts`, `scripts/rejection-log.json`

**Done when:** the log is written and summary counts print.

-  [x] T9

   `scripts/review.ts` and `scripts/rejection-log.json` written; `npm run review`
   wired up. Log covers all 30 candidates from the Sept 14 run. **Machine: 0
   rejected, 100% pass rate, 0 failed per rule. Passed to human: 30. Human: 0
   rejected, 0 approved, 30 pending.** No human decisions were recorded — review
   has not happened yet. The log carries explicit notes that the zero machine
   rejections come from the constrained schema, not item quality, and that the
   human-rejection count is the meaningful number but is incomplete until
   review is done.

---

### [HUMAN] Sept 14

-  [ ] Self-review survivors, kill obvious junk
-  [ ] Send the teacher a review batch. Target 36 approved items.

---

### T10 — Diagnosis engine

Write `src/engine/diagnose.ts` per CLAUDE.md section 7. Selections, exposures,
the four confidence states including ruled-out, thresholds as named constants in
one place.

Files: `src/engine/diagnose.ts`, `src/engine/diagnose.test.ts`

**Done when:** tests cover confirmed, suspected, ruled-out, and insufficient
evidence.

-  [x] T10

   `src/engine/diagnose.ts` + `diagnose.test.ts`. 49 tests pass. Covers
   confirmed, suspected, ruled-out and insufficient, plus weighting, exposure
   counting, one-activity selection, track independence and bad input.
   Mutation-checked: removing the weighting, reversing the advice tie-break,
   leaking `suspected` to the parent, or pooling the tracks each turns tests red.

---

### T11 — Item selection

Write `src/engine/select.ts` per CLAUDE.md section 7. 12-item session, 8/4 track
mix interleaved, no repeated target, first four spread for coverage, then weight
toward suspected, no misconception over half the session.

Files: `src/engine/select.ts`, `src/engine/select.test.ts`

**Done when:** tests confirm session length, no repeats, and the interleave
positions.

-  [x] T11

   `src/engine/select.ts` + `select.test.ts`. 23 tests pass (80 across the
   suite). Covers session length, no repeated item or target, the 3/6/9/12
   interleave and the 8/4 mix, the four-item coverage phase, weighting toward
   suspected, the half-session cap, and thin-bank degradation. Mutation-checked:
   dropping the target guard, the cap, the suspected weight, the coverage phase
   or the interleave each turns tests red. **Two things to know.** (1) `npm test`
   appeared broken during this task and is **not** a code or config problem —
   see the Sept 15 decision below. The shell was on Node 22.3.0 while the project
   pins 24. `nvm use && npm test` passes all 80 under jsdom. (2) The bank holds 8 approved
   items against a 12-item session, so a real session today runs 8 and stops
   clean. A test records that and is expected to change when reviewed items land.

---

### T12 — Headless loop

Prove the engine end to end with no UI. A script that simulates a child who
consistently holds one misconception and prints the resulting diagnosis.

Files: `scripts/simulate.ts`

**Done when:** simulating a consistent closed-syllable child produces a confirmed
`closed-syllable` diagnosis, and a child who always answers correctly produces
ruled-out states.

-  [x] T12

   `scripts/simulate.ts`, wired as `npm run simulate`. Runs both required
   children through `selectSession` + `diagnose` — no parallel engine, so what
   passes is the engine. Prints the transcript, the internal diagnosis (all four
   states, both tracks) and the parent view via `forParent`, then asserts T12's
   done condition and exits non-zero on failure. **All four checks pass:**
   closed-syllable child → `confirmed` (4 selections / 4 exposures) and it
   reaches the parent screen; correct child → `ruled-out` on closed-syllable (4
   exp) and irregular-word (3 exp), with **no false positives**. `--child <id>`
   runs any single profile, `--seed`, `--quiet`. Sessions run 8 items, not 12 —
   the bank shortfall, reported in the output. One fix outside the named file:
   `select.ts` imported `./diagnose` extensionless, which Vite resolves and
   Node's ESM loader does not, so the script could not load the engine at all.
   Now `./diagnose.ts`. See the coverage finding below — it affects the demo.

---

## Sept 15 — Game screen

### T13 — Game screen

Per CLAUDE.md sections 9 and 7. Consumes `selectSession()`, records every pick
with its misconception tag in the shape `diagnose()` expects. No score, no timer,
no red X, no streak. On tap: neutral highlight, 600ms, advance. Full stem spoken
on both tracks, options never spoken, speech-synthesis fallback where a clip is
missing. Zoo theme, one star per item, 60px tap targets, Andika.

Files: `src/components/GameScreen.tsx`, `src/components/session.ts`,
`src/components/animals.tsx`, `src/question.ts`, `src/styles.css`, `src/App.tsx`,
`index.html`

**Done when:** a full session plays end to end and the recorded picks feed
`diagnose()` correctly.

-  [x] T13

   134 tests pass (54 new), `npm run build` clean, dev server serves. Session
   logic is a **pure state machine in `session.ts`**, separate from the view, so
   a whole playthrough is tested without a DOM; `GameScreen.tsx` is a thin view
   over it and is tested through real taps in jsdom with `react-dom` directly —
   **no new dependencies this close to the deadline.** A played session hands
   back `Answer[]` that `diagnose()` consumes unchanged: a consistent
   closed-syllable child confirms, a correct child rules out with no false
   positives. Tests assert the absences too, since they are the requirement: no
   score/timer/streak/right-wrong text at any point in a session, the tapped
   highlight byte-identical for a right and a wrong pick, no `correct` marker
   anywhere in the DOM, and 60px enforced from one exported constant. Audio:
   full stem spoken both tracks, **options never spoken** — asserted against
   every distractor in the bank — clip first, browser voice when it is missing,
   which today is always. Zoo sits below the options, store is inert.

Scope kept for later: `ParentScreen.tsx`.

   **Redesigned Sept 16** on the owner's direction — the first build read as a
   desktop form rather than a children's app. Now: phone-width column in a
   visible frame, zookeeper character, stars beside the store icon, speaker
   leading the question line with the target inline and smaller, saturated option
   cards, and a zoo with sky, ground and 88px animals. 139 tests pass; every
   behaviour rule and its test survived the redesign intact.

## Sept 16 — Parent screen

### T14 — Parent screen

Per DESIGN.md section 10 and CLAUDE.md section 9. Consumes `forParent()` and
renders what it returns; the engine is untouched. Both tracks separate, evidence
line, one activity, strengths present but quieter, colourblind-safe.

Files: `src/components/ParentScreen.tsx`, `src/components/ParentScreen.test.tsx`,
`src/styles.css`, `src/App.tsx`

**Done when:** it follows session completion and renders a confirmed finding, a
strength and the nothing-confirmed outcome from real sessions.

-  [x] T14

   163 tests pass (19 new), build clean, `npm run simulate` still exits 0 — the
   engine was not touched. The screen renders `forParent()` and computes nothing
   of its own: no ranking, no totals, and **the only number on the page is how
   long the child played.** Tests drive it from real sessions through the real
   engine rather than hand-built reports, and assert the absences as hard as the
   content: no score or percentage, no zoo furniture, and **no suspected pattern**
   — a `vowel-team-assumed` session reaches `suspected` internally and its label
   must not appear. Mutation-checked: putting the deficit label back under the
   irregular headline, dropping the strength labels, dropping strengths entirely,
   or turning the empty outcome into an error state each turns tests red.

Scope kept for later: nothing — the full visual design pass landed with it.

   **Revised Sept 16** against a rewritten, much more specific DESIGN.md
   section 10. Three things the first build got wrong are now right: the order
   (strength → finding → evidence → activity last → remaining strengths), one
   activity on the **screen** rather than one per finding, and strengths marked
   by a tick rather than a coloured dot. 174 tests pass.

## Sept 17 — Record

Real child if possible. Demo video. Deploy to Vercel. Write the submission text.

### T15 — Pin the demo session

-  [x] T15

   `App.tsx` pins **both** the twelve-item bank (`DEMO_ITEM_IDS`) and the draw
   (`DEMO_SEED = 7`), so the same twelve items are dealt every run and the clips
   can be recorded against a known list. `?demo=off` restores the full 36-item
   bank and a random draw. 213 tests pass; 8 new ones hold the pinned session.

**Clips to record — 12, in `/public/audio/`:**

| # | track | target | file | `audio` in items.json |
| - | ----- | ------ | ---- | --------------------- |
| 1 | decodable | moon | `q-moon.mp3` | null — set it |
| 2 | decodable | rain | `q-rain.mp3` | null — set it |
| 3 | irregular | what | `q-what.mp3` | already set |
| 4 | decodable | boat | `q-boat.mp3` | null — set it |
| 5 | decodable | sweat | `q-sweat.mp3` | null — set it |
| 6 | irregular | who | `q-who.mp3` | already set |
| 7 | decodable | chief | `q-chief.mp3` | null — set it |
| 8 | decodable | bread | `q-bread.mp3` | null — set it |
| 9 | irregular | because | `q-because.mp3` | already set |
| 10 | decodable | snow | `q-snow.mp3` | null — set it |
| 11 | decodable | pie | `q-pie.mp3` | null — set it |
| 12 | irregular | the | `q-the.mp3` | already set |

Each clip is the **whole question and nothing else** — decodable: "Which word
has the same vowel sound as \<target\>?"; irregular: "How do you spell the word
\<target\>?". **Never record the three options:** reading them aloud destroys the
decoding task, which is the measurement (CLAUDE.md section 9).

## Sept 18 — Submit in the morning

---

## Cut list, in order

1. Stretch item count above 36
2. `localStorage`
3. Audio for non-demo-path items
4. Generation polish — take whatever survives the validator

**Never cut:** the parent screen, the misconception diagnosis, the demo video.

---

## Decisions log

Append. Never rewrite. A later session reads this to avoid re-litigating.

-  **Sept 13** — Validator rule "at least one distractor shares the target's vowel
   spelling" was proposed as a hard rule and is **wrong**. Holds for `bread`
   (steak shares `ea`), fails for `boat` (bot, boy) and `rain` (have, ran). The
   trap in those items is a shared word opening, not a shared vowel spelling.
   Demoted to soft rule 8. Do not reinstate as hard.
-  **Sept 13** — `vowelSound` added as required. Without it the validator cannot
   verify an item has a correct answer at all. Human-assigned only.
-  **Sept 13** — `have` is tagged `irregular-word` inside a `decodable` item.
   Items carry a track, misconceptions carry their own, they need not match. Not
   a bug.
-  **Sept 13** — Defaults set where the spec was silent: 12-item session, 8/4
   interleave, no right/wrong feedback on tap, no repeated target word. All
   changeable, but change them here, not per-session.
-  **Sept 13** — Correct answers now count as evidence; 3+ exposures with 0
   selections rules a misconception out and reports it as a strength.
-  **Sept 13** — `vowelSpelling` tagging convention added. Rule 5 does direct
   string comparison, so inconsistent tags would cause silent false passes.
-  **Sept 13** — Font must have single-storey `a` and `g`. A correctness issue in
   a reading app, not a style preference.
-  **Sept 13** — Node pinned to 24 LTS via `.nvmrc` and `engines.node: "24.x"` in
   `package.json`. The machine's 22.3.0 is below Vite 8's floor, so npm silently
   skipped the `@rolldown/binding-darwin-arm64` optional dep and vitest died at
   startup with "Cannot find native binding". Installed 24.21.0 through nvm;
   22.3.0 is untouched. `nvm use` in the project dir picks up the `.nvmrc`.
   `engines.node` overrides Vercel's Project Settings, so the deploy matches
   local with no dashboard change. Vercel accepts major versions only — keep it
   as `24.x`, not a `>=` range.
-  **Sept 13** — `options` is typed `Option[]`, not a 3-tuple. "Exactly 3" is
   validator rule 1, checked after parsing, because the bank is hand-authored
   JSON — a tuple type would only constrain code that builds items in TS and
   would fight `resolveJsonModule` on import. Same reasoning for "exactly one
   correct" and "distractors carry a misconception id": shape in `types.ts`,
   rules in `validate.ts`.
-  **Sept 13** — `Track` extracted as a named union since `Misconception` and
   `Item` both carry one and the engine keeps the two tracks separate. `source`
   left inline — it appears once.
-  **Sept 13** — `teacherNote` holds the section 8 table's short description,
   one sentence per misconception, rather than the richer per-item annotations
   from the seed write-ups. Both are her words, but the table is written at
   misconception level, which matches the field's cardinality; splicing two
   item-level sentences into one field would have been an editorial act. Her
   item-level notes have no home in the data model — revisit if the parent
   screen wants them.
-  **Sept 13** — Item ids are `seed-<target>`. Nothing in CLAUDE.md specifies a
   scheme; generated items will need one that cannot collide (`gen-<target>-<n>`
   or similar) when T8 lands.
-  **Sept 13** — Misconception tracks: `irregular-word` is `irregular`, the
   other three are `decodable`. Only the `irregular-word` case is stated (see
   the `have` entry above); the rest follow from all three being decoding rules.
-  **Sept 13** — Importing the data with `resolveJsonModule` widens every string
   to `string`, so `items.json` will **not** assign to `Item[]` directly —
   `vowelSound` loses its union. Whatever reads the bank needs either a cast at
   one boundary or a parse step. Not decided here; T5 hits it first.
-  **Sept 13** — `validateItem` does **not** check that the correct option's
   `misconceptionId` is null. Section 4 says the field is "required when correct
   is false", which implies it, but hard rules 1-7 do not list it and inventing
   an eighth hard rule is section 11 territory. Left unenforced on purpose —
   ask her before adding it.
-  **Sept 13** — Rules 3 and 5 loop over every option marked correct rather than
   indexing `correct[0]`. A rule 2 break then reports next to them instead of
   crashing on an empty array or silently skipping. Consequence to expect: an
   item with nothing marked correct reports rules 2, 4 and 6 together, because
   the intended answer is then read as a distractor. That is accurate, not noise.
-  **Sept 13** — **Hard rule 9 added: the correct option's `misconceptionId`
   must be `null`.** This is a **human call by the project owner**, not an
   inference drawn from the seeds, and it supersedes the entry above that left
   it unenforced. Reason given: a misconception pinned to the right answer would
   make a correct response count as evidence of an error, corrupting the
   diagnosis. It bites twice, because section 7 also reads correct answers as
   evidence in the other direction — such an item would both invent a
   selection and suppress a rule-out. Written into CLAUDE.md section 5.
   Numbered 9, after the soft rule, because rules 1-8 are quoted verbatim in
   validator failure strings and renumbering would break them.
-  **Sept 13** — Rule 6 has two branches, null id and unknown id, and they are
   **not independent**: `knownMisconceptionIds.has(null)` is false, so a null id
   falls through to the unknown-id message if the null check is ever removed.
   Found by mutation testing — disabling the null branch left all tests green
   under a `/^rule 6: distractor "bot"/` pattern. The rule 6 test now asserts
   the exact null-branch string. Assert full messages, not prefixes, wherever a
   rule has more than one branch.
-  **Sept 13** — Seed tests assert on `failures` only, never `warnings`. Rule 8
   is explicitly "warn, do not fail"; making a warning break the build would
   contradict CLAUDE.md section 5 and would fail a legitimate future seed.
-  **Sept 13** — Bank under-representation is a **warning**, not a failure, on
   T7's instruction that the 3-item bank reporting all four is "expected, not a
   failure". An unknown misconception reference stays a failure. Revisit once
   the bank is populated: at 36 items, under-representation probably should
   block a release.
-  **Sept 13** — `validateBank` counts **distinct items**, not distractor
   occurrences. Two distractors sharing a misconception in one item still give
   the child one chance to select it, so it counts once. Section 6 says "at
   least 3 items", which supports this reading.
-  **Sept 13** — A misconception defined but used **nowhere** is reported with a
   zero count and **no warning**, because section 6 scopes the 3-item rule to
   misconceptions "used in the bank". Arguably wrong — a misconception in zero
   items can never be diagnosed — but that is a spec question, not a code
   choice. **Ask her.** The current bank never hits this case; all four are used.
-  **Sept 13** — The count report is written to **stderr**, not `console.log`.
   Vitest's default reporter swallows console output from passing tests, so the
   report would only appear under `--reporter=verbose` and T7's done condition
   would not hold for a plain `npm run test`.
-  **Sept 13** — `VOWEL_SOUNDS` is now a runtime `as const` array in
   `src/types.ts` and `VowelSound` is derived from it via
   `(typeof VOWEL_SOUNDS)[number]`. The generation script has to check model
   output against the vocabulary, and a bare type is erased at compile time.
   Derived rather than parallel, so the list and the type cannot drift.
-  **Sept 13** — `@anthropic-ai/sdk` and `zod` are **devDependencies**, not
   dependencies. Generation is offline tooling; CLAUDE.md section 3 forbids a
   model call at runtime, and keeping them out of `dependencies` means they can
   never reach the browser bundle.
-  **Sept 13** — Model output is constrained by **structured outputs**
   (`messages.parse` + `zodOutputFormat`) rather than parsing prose. Section 5b
   asks for strict JSON with no fences; a schema enforces that at the API
   boundary instead of hoping the model complies. The "no prose, no fences"
   instruction is still in the prompt as 5b requires.
-  **Sept 13** — `misconceptionId` is a `z.enum` built from
   `misconceptions.json` at runtime, so the model **cannot** emit an invented
   id. Note the tension with section 5b: forcing a choice from the fixed list
   means a distractor that fits none gets mislabelled rather than rejected.
   That is what 5b asks for ("give it the fixed list and require every
   distractor to use one"); catching a mislabel is the human reviewer's job and
   becomes T9's human-rejection count.
-  **Sept 13** — The script sets `id`, `audio`, `track` and `source` itself
   rather than trusting the model, even though they are in the schema. The id
   is the collision guarantee and the rest are ours to state.
-  **Sept 13** — Generated items are **decodable only**. The irregular track
   still has no agreed question format, so generating for it is blocked.
   `irregular-word` distractors inside decodable items are fine — her own seeds
   do exactly that with `have` and `gone`.
-  **Sept 13** — Ids are `gen-<target>-<n>`, allocated against every id already
   on disk: the committed bank plus every candidate in an existing
   `candidates.json`, rejections included. So a rerun never reuses a rejected
   candidate's id. Verified without generating anything.
-  **Sept 14** — **`Item` forked into a discriminated union on `track`:**
   `DecodableItem | IrregularItem`, with `DecodableOption | IrregularOption`.
   Human call by the project owner, prompted by the teacher's first
   irregular-track seed. Irregular items and options carry no vowel tags,
   because a sight word's letters do not predict its sound. Supersedes CLAUDE.md
   section 4's "vowelSound is mandatory" for irregular options; it stays
   mandatory on decodable ones. A union rather than optional fields, so a
   decodable item still cannot omit a vowel tag and typecheck.
-  **Sept 14** — `validateItem` keeps its signature and branches on
   `item.track`. Rules **3, 4, 5, 7 are decodable only**. Rule 7 in particular
   must not run on irregular items: there the correct option's word is the
   target's spelling by design. Rule numbers unchanged.
-  **Sept 14** — **Irregular `audio` is `string`, not `string | null`.** The
   target is spoken and never shown, so an irregular item without audio cannot
   be asked. Decodable audio stays nullable. This is type-level only — no
   numbered rule checks it at runtime, so an irregular item in JSON with
   `audio: null` currently passes `validateItem`. Candidate for a rule 12;
   not added without a decision.
-  **Sept 14** — **Rule 10 added, irregular only: every distractor is a
   plausible phonetic spelling of the target; non-words are valid.** Human call
   by the project owner. "Plausible" is a phonics judgement and section 11
   forbids encoding one, so the code enforces only its necessary conditions —
   non-empty, and not the target's real spelling (that would be a second
   correct answer). Plausibility itself is the human reviewer's to reject.
-  **Sept 14** — Rule 8 on irregular items uses only its first-two-letters half;
   irregular options have no vowel spelling. Expect it to warn often, since a
   phonetic misspelling can diverge early (`was` / `wuz` share only `w`). Soft,
   so warnings only.
-  **Sept 14** — **`parentAdvice` moved from `Misconception` to each
   distractor.** Human call by the project owner. Reason: one misconception can
   need different home activities depending on which distractor the child
   picked, and the parent should see one activity, not several. `Misconception`
   is now `{ id, label }`. That also removes `teacherNote` and `track` from the
   type, taking "keeps id and label" literally — **confirm that was intended**.
   Supersedes the Sept 13 entries that put advice on the misconception, used
   `teacherNote` for the section 8 table, and assigned misconception tracks.
   The data files still carry the old fields; the cast at the import boundary
   tolerates the extras.
-  **Sept 14** — **Rule 11 added: every distractor's `parentAdvice` is a
   non-empty string.** Human call by the project owner. Consistent with section
   11 rather than in tension with it: missing advice is still left empty, never
   written, and rule 11 is what stops such an item shipping. Checked with
   `typeof`, not `=== null` — JSON written before the field existed has no key,
   and the first version threw `Cannot read properties of undefined` on the
   un-migrated seeds. Caught in verification before it landed.
-  **Sept 14** — **Expected, not a "rule is wrong" case: the three seeds
   currently fail rule 11**, two failures each, because `items.json` has not
   been migrated to per-distractor advice yet. The section 5 instruction to stop
   when a seed fails is aimed at a rule contradicting her judgement; this is a
   schema migration waiting on data. Migrating `items.json` and
   `misconceptions.json` is its own task.
-  **Sept 14, for T10** — **When a confirmed misconception has evidence from
   several distractors carrying different advice, the parent screen shows the
   advice from the most-picked distractor, ties broken by the most recent
   pick.** One activity, always. Decided by the project owner. T10's evidence
   tracking therefore has to keep selections per distractor and the order of
   picks, not only a per-misconception total.
-  **Sept 14, open** — **Generation now conflicts with rule 11.** Every
   generated distractor needs `parentAdvice`, but advice is teacher-verbatim and
   section 11 forbids the model writing it. As things stand, every generated
   candidate either fails rule 11 or carries model-written advice, which is
   forbidden. Needs a decision before `generate.ts` is updated — for example,
   the reviewer attaches her advice at approval, or a generated distractor
   reuses advice from a seed distractor with the same misconception, which
   would itself need her sign-off.
-  **Sept 14, open** — Nothing requires an irregular item's correct option to
   spell the target. Rule 3 guaranteed a right answer on decodable items;
   irregular items have no equivalent, so one whose correct word is misspelled
   passes. Candidate rule; not added without a decision.
-  **Sept 14** — Known breakage left in place by scope: `scripts/generate.ts`
   (3 type errors — `teacherNote` gone, `Item` shape changed) and
   `src/engine/validate.test.ts` (4 type errors — fixtures lack
   `parentAdvice`). `npm run typecheck` fails on those two files and
   `npm run test` fails until they and the data are migrated. `types.ts` and
   `validate.ts` typecheck clean.
-  **Sept 14** — **`teacherNote` and `track` restored to `Misconception`.** Only
   `parentAdvice` was meant to move; the earlier entry read "keeps id and label"
   too literally. Supersedes it. `Misconception` is `{ id, label, teacherNote,
   track }`.
-  **Sept 14** — **Generated distractors inherit `parentAdvice`.** Decided by the
   project owner; resolves the open entry on generation vs rule 11. Each
   generated distractor takes the advice of the first seed distractor, in
   `items.json` order, carrying the same misconception, on either track, and is
   flagged `parentAdviceInherited: true`. The reviewer replaces it where it
   doesn't fit. Rule 11 applies at bank entry as it does now — no extra rule for
   inherited advice. Seed distractors with blank advice are skipped rather than
   inherited. The model never sees seed advice in its prompt and never produces
   any. `parentAdviceInherited` is optional on the type, so seeds need no change.
   **Note:** nothing is inheritable today, since `items.json` is not migrated —
   every generated distractor would currently get no advice and fail rule 11.
-  **Sept 14** — "First in file order" means that among seed distractors
   carrying one misconception with *different* advice, generation always copies
   the earliest. That choice is arbitrary but deterministic; the reviewer is the
   correction. Seeds on the other track are eligible too, so an irregular seed's
   `irregular-word` advice can land on a decodable generated item. Neither is
   filtered without a decision.
-  **Sept 14** — **Rule 12 added, irregular only: the correct option's word
   equals the target, exactly.** Decided by the project owner; resolves the
   open entry about irregular items having no guaranteed right answer. Exact,
   not case-folded, because it is the string on screen. Rule 10's check that a
   distractor is not the target *is* case-folded, since `Was` would still read
   as a second correct answer.
-  **Sept 14** — **Rule 13 added, irregular only: `audio` is a non-empty
   string.** Decided by the project owner; resolves the open entry about
   `audio: null` passing. Needed although the type already requires it, because
   the JSON cast bypasses the type. `typeof`-guarded like rule 11.
-  **Sept 14** — **The three-item minimum is per track.** Decided by the project
   owner; resolves the open question in section 6. `validateBank` keeps counts
   per track in `byTrack`, warns once per misconception per under-represented
   track, and a misconception used on one track is not under-represented on the
   other. The top-level `items` stays as the total and `underRepresented` means
   "on at least one track", so existing readers keep working.
-  **Sept 14** — The seed tests excuse **exactly one** failure message:
   `rule 11: distractor "…" has no parentAdvice`, matched by full regex, while
   `items.json` awaits migration. Any other failure — rule 11's empty-advice
   branch included — still fails them. A tripwire test asserts every seed
   distractor still fails that way, and **is meant to go red** when the data is
   migrated: at that point delete the tripwire and the exclusion, so the seeds
   are held to every rule again.
-  **Sept 14** — **Advice inheritance restricted to seeds on the same track.**
   Decided by the project owner; supersedes the entry that made seeds on
   either track eligible. An irregular seed's advice must not land on a
   decodable item. `inheritableAdvice(seeds, track)` now takes the track, and
   generation passes `decodable`. A misconception whose only advice sits on an
   irregular seed therefore has nothing to inherit for a decodable candidate,
   which then fails rule 11 — intended.
-  **Sept 14** — **Data migrated to per-distractor advice.** Each misconception's
   `parentAdvice` was copied verbatim onto every seed distractor carrying it and
   removed from `misconceptions.json`, which is now `{ id, label, teacherNote,
   track }`. Verified by hash against the pre-migration text; the hashes also
   match the original Sept 13 transcription. Correct options carry
   `parentAdvice: null`. Moved seeds are not flagged `parentAdviceInherited` —
   that flag is for generated items.
-  **Sept 14** — **A verbatim move means two distractors got advice written for
   a different word.** Worth sending to the teacher, since per-distractor advice
   exists precisely so these can differ:
   -  `gone` (seed-boat) now carries the `irregular-word` activity, which is a
      tic-tac-toe game built around the word **have** ("write the word have in
      several boxes… leave the word 'have' for your child to mark").
   -  `ran` (seed-rain) now carries the `closed-syllable` activity, which opens
      "Write the word 'bot' on a piece of paper" and walks the parent through
      **bot** specifically.
   Both were shared text before the move, so nothing got worse — but the new
   schema can now represent the fix, and only she can write it.
-  **Sept 14** — **`ie-two-sounds` added**, label "Doesn't know that ie makes two
   different sounds", as given. Per section 11, **`teacherNote` is `""`** —
   there is no wording from her for it yet. **`track` is set to `decodable`** as
   an assumption, by analogy with `ea-three-sounds`; confirm it against the seed
   that uses it. It currently appears in no item, so `validateBank` reports it
   as unused (count 0, no warning).
-  **Sept 14** — **The rule-11 seed exception and its tripwire are deleted.** The
   three seeds pass every hard rule again with no exclusions. The bank-count test
   gained an `ie-two-sounds` row at 0, and the "all under-represented" test now
   checks only misconceptions that are used, since an unused one is by design
   not flagged.
-  **Sept 14** — **`ie-two-sounds` track confirmed `decodable`** by the project
   owner, resolving the assumption above. `teacherNote` stays `""` until the
   teacher writes one (section 11).
-  **Sept 14** — **Three teacher seeds added:** `seed-pie` and `seed-snow`
   (decodable), `seed-what` (irregular, the first on that track). Advice is the
   teacher's with spelling corrected only, copied verbatim from the owner's
   message and verified string-for-string. All three pass every hard rule;
   validated before being written to `items.json`. The original three items are
   byte-identical, and the known-wrong advice on `gone` and `ran` is untouched,
   replacements pending.
-  **Sept 14** — **`by` → `vowelSpelling: "y"`, teacher-confirmed.** Y acts as the
   only vowel in the word. Added to the tagging convention in CLAUDE.md
   section 4, since rule 5 compares these strings directly.
-  **Sept 14** — **`soup` is tagged `oo-long`, not `long-oo`, and no vocabulary
   entry was added.** The instruction was to add `long-oo` if missing; the
   sound was not missing, it is `oo-long` — the one entry that breaks the
   `long-x`/`short-x` pattern, which is how the mix-up happens. Adding
   `long-oo` alongside it would give one sound two names, and because rules 3
   and 4 compare `vowelSound` strings exactly, a `long-oo` option against an
   `oo-long` target would read as a different sound and pass silently.
   **If `long-oo` is the preferred spelling, rename the entry rather than add
   one** — a separate change, since it touches `VOWEL_SOUNDS` and any tag using
   it.
-  **Sept 14** — **`seed-what` audio is `q-what.mp3`**, following the
   `q-<target>.mp3` convention in CLAUDE.md section 12. Rule 13 requires a
   non-empty string and is satisfied, but **the file does not exist yet** — no
   audio is recorded. On the irregular track that makes the item unaskable until
   it is, since the target is never shown.
-  **Sept 14** — **`seed-snow` raises a rule 8 warning** (soft): neither `soup`
   nor `got` shares `ow` or the opening `sn`. Kept as written — her item, and
   rule 8 exists so a human can judge. Worth mentioning to her.
-  **Sept 14, for the game screen tasks** — Question prompts are per track, not
   per item, so they are not in `items.json`. From the teacher: decodable is
   "Which word has the same vowel sound as <target>?"; irregular is "How do you
   spell the word ______?", with the target spoken, never shown.
-  **Sept 14** — **CLAUDE.md section 8 still lists only the original three seeds,
   and seed 1 there still shows `boy`,** stale since the `gone` swap. Section 8
   is marked authoritative teacher content, so it was not edited without being
   asked. `items.json` is the working source of truth for seeds.
-  **Sept 14** — **Practice-word rule: practice words must share the vowel sound
   of the word being taught.** A general rule, confirmed by the teacher. Written
   into CLAUDE.md section 5b so generation and review follow it. **Not enforced
   in code** — checking that two arbitrary words share a vowel sound means
   inferring vowel sounds, which section 4 forbids — so the reviewer owns it.
   Consequence for generation: inherited advice names its seed word and
   practises that word's vowel, so it breaks this rule on almost every
   generated distractor. Expect most inherited advice to be replaced at review.
   `generate.ts` was not changed. A possible refinement, not made: prefer
   inheriting from a seed distractor with the same `vowelSound` as well as the
   same misconception, which would at least get the practice vowel right.
-  **Sept 14** — **Six advice corrections applied, texts from the owner's
   message.** Practice lists swapped exactly, rest of each string untouched:
   `bot` -> hop, pot, mop; `got` -> lot, pop, mop; `him` -> bin, sit, pig. Full
   replacements: `ran` (own short-a routine, practising man, sat, tap, replacing
   the inherited `bot` routine), `gone` (own silent-e routine, replacing the
   inherited `have` activity), `have` (updated). Resolves the entry flagging
   `gone` and `ran`. Every other option's advice verified byte-identical.
-  **Sept 14** — **Checked every seed's advice against the new rule; one
   possible conflict for the teacher.** `soup`'s activity uses cards for
   *Youth* and *Pound*. *Youth* shares `soup`'s long-oo sound; *Pound* does
   not — its `ou` says /ow/. It may be deliberate, since the activity is about
   what `ou` can say, but it reads against the rule as stated. Not changed.
   `free`'s activity also uses `oa`/`oe`/`oy` letter cards alongside `see`;
   those are letter teams rather than practice words, so likely out of the
   rule's scope. The rest either share the vowel or have no practice words.
-  **Sept 14** — The typo holds recorded under T4 now live only on `bot`, which
   kept the original closed-syllable routine ("Ask your child, to point…",
   "it's short sound"). `ran`'s new text replaced its copy. `have`'s updated text
   keeps "Create 3 by 3 chart"; `gone`'s reads "Create a 3 by 3 chart". Both as
   given.
-  **Sept 14** — **CLAUDE.md section 8 is now a mirror of the data**, generated
   from `items.json` and `misconceptions.json` and marked as such at the top:
   not the teacher's original message, and the data wins on any disagreement.
   Advice is not duplicated there, to avoid drift. The sight-word list stays,
   marked as not from the data, since no data file holds it. Two cross-references
   to section 8 (sections 1 and 11) now point at the data files. Resolves the
   entry about section 8 being stale.
-  **Sept 14** — **Practice-word rule narrowed to `closed-syllable` advice
   only.** Decided by the project owner; supersedes the general version above.
   Vowel-team activities deliberately contrast sounds — `soup`'s *Youth* and
   *Pound* cards are the example — so the rule must not apply there. This
   resolves the `soup` flag: not a conflict. CLAUDE.md section 5b updated.
-  **Sept 14** — **Advice inheritance is now tiered.** Decided by the project
   owner. `generate.ts` prefers a same-track seed distractor with the same
   misconception **and** the same vowel sound, then falls back to the same
   misconception alone; first in `items.json` order within each tier. Vowel
   sounds come from the seed's human-assigned tags, never inferred. Checked
   against the real seeds without running generation: a generated
   `closed-syllable` short-a distractor inherits `ran`'s routine, short-i gets
   `him`'s, short-o gets `bot`'s (first of `bot`/`got`); short-u has no seed and
   falls back to `bot`'s. `ie-two-sounds` long-i falls back to `piece`.
-  **Sept 14** — **All inherited advice is marked provisional** in
   `candidates.json`. Each candidate record gains `provisionalAdvice`: one entry
   per inherited distractor with `provisional: true`, the seed distractor it was
   copied from, the tier that matched, and a reason naming the word mismatch.
   Provisional regardless of tier, because the advice names the seed's word
   rather than the generated one. The item's option keeps
   `parentAdviceInherited: true`; `types.ts` is unchanged. The run summary now
   splits inherited advice by tier.
-  **Sept 14, open** — Provisional advice still passes rule 11, since it is a
   non-empty string, so nothing mechanical stops an approved item entering
   `items.json` with inherited advice still in place. Today the reviewer is the
   only gate. If that should be enforced, a rule rejecting
   `parentAdviceInherited: true` at bank entry would do it. Not added without a
   decision.
-  **Sept 14** — **Bank-entry rule: no item with any option carrying
   `parentAdviceInherited: true` may enter the bank.** Decided by the project
   owner; resolves the open entry above. Approval requires the reviewer to have
   replaced the inherited advice. Enforced in **`validateBank`**, as a bank
   failure (`bank: item "…" option "…" still carries inherited parentAdvice`),
   deliberately **not** as a numbered `validateItem` rule. `generate.ts`
   validates every candidate per item, and candidates carry the flag until
   review by design; an item rule would fail nearly every generated candidate
   mechanically, and T9's split between machine and human rejections would
   become meaningless. Tests cover the failure, the cleared flag passing, and
   the rule not firing per item. Mutation-checked.
-  **Sept 14** — `generate.ts`'s end-of-run projection runs `validateBank` over
   the bank plus survivors, so the new rule fails every inherited distractor in
   that projection. That is expected before review, so the report now
   summarises those as one line ("N distractor(s) on survivors still carry
   inherited advice") and lists any other bank failure in full.
-  **Sept 14, open** — **The rule checks the flag, not the text.** A reviewer who
   clears `parentAdviceInherited` without replacing the advice passes it. A
   stricter check is possible without inferring anything: fail a *generated*
   item's distractor whose advice is byte-identical to any seed distractor's
   advice. It would also block a reviewer who judged a seed's text right as-is,
   though advice that names the seed's word rarely is. Not added without a
   decision.
-  **Sept 14** — **Rejection log: machine and human stages are mutually
   exclusive, machine first.** Each entry is `machine-rejected`,
   `human-rejected`, `approved` or `pending-human-review`. A human decision
   cannot override a machine rejection. Summary counts follow 5b exactly:
   candidates generated, failed per rule (counted once per rule per candidate),
   passed to human, rejected by human, approved.
-  **Sept 14** — **The log states why the machine pass rate is 100%.** Written as
   a note inside `rejection-log.json`, so it travels with the numbers into the
   writeup: structured outputs make rules 1 and 6 unbreakable, restrict vowel
   sounds to the vocabulary, and fix track/source/audio; the other hard rules
   are in the prompt; rule 11 holds because the script attaches inherited
   advice. Nothing mechanical checks tag truth or pedagogy. The note is emitted
   only when machine rejections are zero, so it cannot outlive a run that has
   some. **The human-rejection count is the meaningful number**, and while
   anything is pending the log says it is incomplete and not yet a finding.
-  **Sept 14** — **Human decisions are recorded only through `review.ts`**
   (`--approve <id>`, `--reject <id> --reason "…"`; a rejection needs a
   reason, since it is the evidence). They persist in `rejection-log.json`
   across rebuilds, and entries survive a later generation run overwriting
   `candidates.json`, marked `inCurrentCandidatesFile: false`, so review history
   cannot be lost. `--approve` is refused while any option still carries
   inherited advice, enforcing the bank-entry rule at approval time. Approval
   never writes `items.json`.
-  **Sept 14** — **The review flags from the run report are not in the log.**
   Repeated targets, likely mislabelled `ea`/`ie` distractors, `fries`/`tied`/
   `dried` against her `ie` rule, `igh`/`ear` tagging, `been`, `find`, `put`.
   They were Claude's reading of the output, not reviewer decisions, and
   recording them as human rejections would fake the one number that matters.
   They are suggestions for the reviewer to accept or dismiss via `review.ts`.
-  **Sept 15** — **Teacher's review recorded: 10 rejections with reasons, 20
   approvals.** All 30 candidates had reached a human. Final:
   machine 0 rejected (100% pass rate), human 10 rejected, 20 kept (67% human
   pass rate), 0 pending. The headline finding for the writeup: **the validator
   caught nothing; the teacher caught 10 of 30 items that were structurally
   valid and pedagogically wrong.**
-  **Sept 15** — **`pending-approved` added to the review states.** All 20
   approvals hit the inherited-advice block, so rather than refusing and losing
   her decision, `--approve` now records `pending-approved` (stage
   `approved-pending-advice`): her yes on the item is settled and must not be
   re-asked, but the item still cannot enter the bank until the advice naming
   the seed's word is replaced. Counted as kept in the human pass rate.
-  **Sept 15** — `buildLog` now **re-checks approvals against the current advice
   on every rebuild** instead of trusting the previous log: an approval whose
   advice is inherited again drops to `pending-approved`, and a
   `pending-approved` whose advice has been replaced becomes a full approval.
   This also closes finding 2 of the Sept 15 code review.
-  **Sept 15** — **What her rejections were about**, useful for the writeup:
   7 of 10 name a specific word swap (`eight`, `plow`, `hen`, `gate`, `friend`,
   `could`, `health`), 1 is overuse with no replacement (`head overused`), 1 is
   a cut (`gen-grin-1`, no workable third distractor), and 1 is a real phonics
   error (`gen-earth-1` — "earth cannot be an ea question, ea is not making any
   of the three sounds students learn"). So **6 of 10 rejections are about the
   generator reusing the same words** — `head` three times, `cow`, `ten`, `cake`
   — which is a fixable prompt problem, not a reasoning failure.
-  **Sept 15** — Claude's pre-review flags were only partly right, worth being
   honest about in the writeup: she rejected the `ear`/`earth` item and both
   `ie` inflected forms (`fries`, `tied`) that were flagged, and the repeated
   targets. She **kept** items Claude flagged over `been`, `find`, `put` and
   `igh`. Her call stands; the flags were guesses about her judgement.
-  **Sept 15** — **Her 7 word swaps applied by hand to `candidates.json`**:
   `gen-feet-1` head→eight, `gen-cow-2` target cow→plow, `gen-team-1` ten→hen,
   `gen-play-1` cake→gate, `gen-field-1` fries→friend, `gen-toast-1`
   tied→could, `gen-head-3` target head→health. Retagged as instructed: `eight`
   `eigh`/long-a/vowel-team-assumed, `friend` `ie`/short-e/irregular-word,
   `could` `ou`/oo-short/irregular-word, plus `hen` e/short-e, `gate`
   a_e/long-a, `plow` ow/ow, `health` ea/short-e. All 7 re-validated: zero hard
   rule failures, zero rule 8 warnings. Advice re-inherited by the same rule as
   generation, so all 7 are pending-approved like the other 20.
-  **Sept 15** — **Reversing a rejection preserves it.** `review.ts` entries now
   carry `history`; a decision that replaces a real earlier one is pushed there
   with its reason rather than overwritten, and the summary reports
   `rejectedAtLeastOnce` (10) and `revisedAfterRejection` (7) alongside the
   current `rejected` (3). Without this the swaps would have rewritten the
   headline finding from "the teacher caught 10" to "the teacher caught 3".
   **For the writeup, the number the validator missed is 10.**
-  **Sept 15, for the teacher** — three things the swaps changed that she has
   not seen: (1) **`eight` is tagged `eigh`**, a four-letter vowel team the
   section 4 convention does not cover — confirm the tag; (2) `gen-field-1` and
   `gen-toast-1` were generated for `ie-two-sounds`, and swapping `fries`/`tied`
   out leaves **neither item testing it** — both now carry `irregular-word`
   instead, which is what she asked for, but it drops `ie-two-sounds` coverage
   from 6 items to 4; (3) in `gen-cow-2`, `cot` was chosen to resemble `cow`
   and no longer resembles `plow` — the item still passes rule 8 through
   `blow`.
-  **Sept 15** — **`gen-feet-1`: `eight` replaced with `vein`** (`ei`, long-a,
   `vowel-team-assumed`), her decision. This **closes the `eigh` tagging
   question**: the four-letter team is gone, the section 4 convention stays at
   two-letter vowel teams, and no exception needs adding. Re-validated: no
   failures, no warnings. `eigh` no longer appears anywhere in
   `candidates.json`. Advice re-inherited; misconception and vowel sound are
   unchanged from `eight`, so the same fallback match applies.
-  **Sept 15** — **`cot` in `gen-cow-2`: reviewed and kept as is** — "the item
   tests the vowel rather than the look-alike". Closes the third flag raised
   after the swaps. Recorded as a **reviewer note**, not a decision: `review.ts`
   gained `--note <id> --text "…"`, which appends to an entry's `reviewerNotes`
   and never touches its stage or decision. A doubt she considered and dismissed
   is worth having on the record — it is the difference between a question
   answered and one nobody noticed.
-  **Sept 15** — **T10 weighting implemented as the owner specified:** a pick
   counts `1 / (options in that item carrying the misconception)`. A side effect
   worth knowing: since one item can contribute at most 1, a weighted total of 3
   cannot come from fewer than 3 items, so section 7's "across different items"
   is enforced by the arithmetic rather than by a second check.
-  **Sept 15** — **Exposure is counted per item, not per distractor.** An item
   offering a misconception twice gave the child one chance to reveal it;
   counting two would rule it out twice as fast, the mirror of the selection
   weighting. Structurally guaranteed — exposures are a set of item ids.
-  **Sept 15** — **Advice is chosen by raw pick count, not weighted.** Weighting
   answers "is this pattern real"; choosing the activity answers "which wrong
   answer did the child actually pick most", where the raw count is the honest
   number. Ties go to the most recent pick, per the Sept 14 decision.
-  **Sept 15** — **`forParent()` is the only way to the parent screen.**
   `diagnose()` returns all four states including `suspected`, which section 7
   makes internal state for weighting item selection and never shows;
   `forParent()` exposes confirmed and ruled-out only. Keeping the filter in one
   named function means T11 can read suspected state without risking it leaking
   to the UI.
-  **Sept 15** — `Answer` identifies the pick by `word`, not by rendered
   position: option order is randomised at render time, so position carries no
   meaning. An unknown word throws rather than being silently ignored — a
   mismatch there is a bug in the caller, and a silent one would corrupt a
   diagnosis.
-  **Sept 15** — Thresholds live in `diagnose.ts` as exported constants
   (`SUSPECTED_SELECTIONS`, `CONFIRMED_SELECTIONS`, `RULED_OUT_EXPOSURES`), per
   section 7's "one file" rule. T11 imports them rather than restating them; if
   a third file needs them, extract `constants.ts` then.
-  **Sept 15** — **Two more irregular seeds: `seed-who` and `seed-the`**, same
   format as `seed-what`. Advice is hers, spelling corrected only, identical on
   both distractors of each item apart from the mnemonic sentence ("We had
   olives" for who, "Two hungry emus" for the — both spell the target's
   letters). Audio `q-who.mp3` / `q-the.mp3` per the section 12 convention;
   **neither file is recorded**, so like `seed-what` these items cannot be asked
   yet. Both pass every hard rule. Section 8's mirror regenerated.
-  **Sept 15** — **The irregular track now meets the per-track minimum:
   `irregular-word` has 3 irregular items.** First misconception to clear the
   bar on that track. `irregular-word` is still under-represented on the
   decodable track (2), which is why its top-level `underRepresented` stays
   true — the per-track split is doing exactly what it was added for.
-  **Sept 15** — `seed-who` raises a rule 8 warning: `hoo` and `hou` share
   neither the target's opening two letters (`wh`) nor — irregular items having
   no vowel tags — anything else the rule can see. Expected for this track and
   soft by design: a phonetic misspelling of `who` cannot start with `wh`
   without giving the spelling away. `seed-the` does not warn, since `thu` and
   `tha` both open `th`. Worth watching if the irregular track grows: the
   opening-letters half of rule 8 may be the wrong test there.
-  **Sept 15** — **Thresholds are per track.** Decided by the project owner.
   Decodable keeps 3 confirmed / 2 suspected; **irregular becomes 2 confirmed /
   1.5 suspected**. Reason, and it is arithmetic rather than taste: every
   irregular item carries two `irregular-word` distractors, so a pick weighs
   0.5, and a 12-item session holds 4 irregular items — weighted selections cap
   at **2.0**. The decodable threshold of 3 was not merely hard on that track,
   it was **unreachable by construction**, so `irregular-word` could never have
   been confirmed to a parent however the child answered. Irregular now confirms
   when all 4 irregular items are answered wrong and suspects at 3. Exported as
   `DECODABLE_*` / `IRREGULAR_*` constants plus a `THRESHOLDS` record keyed by
   track; `RULED_OUT_EXPOSURES` stays 3 on both. Tested: 4 picks confirm, 3 do
   not, and 4 picks still fall short of the decodable threshold.
-  **Sept 15** — **The parent screen words the two tracks differently.**
   `forParent()` returns a `headline` per track: `null` for decodable, where
   each confirmed misconception is named by its own `label` because there is a
   rule being misapplied; and for irregular the teacher's sentence verbatim,
   **"Your child needs to practice learning irregular words."** Deliberately not
   phrased as a problem or a broken rule: a sight word is a memorization gap,
   not a misapplied rule, and a label like "Hasn't memorized words that can't be
   sounded out" frames a normal stage of learning as a deficit. A test asserts
   the sentence contains no deficit phrasing, so a later edit cannot quietly
   turn it back into one.
-  **Sept 15** — **The irregular headline is gated on a confirmed result.**
   `forParent()` returns it only when that track has something confirmed; null
   otherwise, including when `irregular-word` is *ruled out*, which is a
   strength and the opposite of needing practice. Enforced in `forParent` rather
   than left to the component, so every consumer gets it right. The sentence is
   a finding, not a banner.
-  **Sept 15** — **Selection is adaptive, one item at a time.** `selectNext(bank,
   answers)` rather than a session planned up front. Section 7 asks for weighting
   toward misconceptions "currently suspected", and suspected state does not
   exist until answers do — a pre-planned session cannot do it at all.
   `selectSession()` wraps the loop so the game screen and T12's simulation
   cannot drift apart.
-  **Sept 15** — **`select.ts` reads `suspected` through `diagnose()`, not through
   its own threshold arithmetic.** It never restates a threshold, per the Sept 15
   decision, and `forParent()` is still the only path to the parent screen. This
   is the intended use of suspected state, not a leak.
-  **Sept 15** — **The next item is a weighted draw, not the highest score.**
   "Weight toward" is a bias, and a child who sits down twice should not get the
   same twelve items in the same order. Every eligible item keeps a non-zero
   chance. The generator is injected, so a session is reproducible in a test and
   in a demo; `random: () => 0` always draws the heaviest candidate, which is
   what lets a test assert an exact choice instead of a distribution.
-  **Sept 15** — **The half-session cap is counted across the session, not per
   track.** Section 7 says "half the session", and `irregular-word` is tagged on
   decodable items as well as irregular ones — a per-track cap would not see it
   accumulating on both. `MAX_ITEMS_PER_MISCONCEPTION` is derived from
   `SESSION_LENGTH`, not typed in twice.
-  **Sept 15** — **Where the 12-item session and the cap collide, the cap wins.**
   Section 7 states both, and "never let one misconception consume more than
   half" is the absolute one. A thin bank therefore yields a short session rather
   than one where seven of twelve items test the same thing and the diagnosis is
   settled before the child sits down. **Flagged as an assumption** — if a full
   twelve matters more to a watching parent than the cap, say so and it flips.
-  **Sept 15** — **A missing track borrows from the other one.** When a position
   wants an irregular item and none is eligible, a decodable item fills the slot
   instead of the session ending: section 7 fixes the session at 12 and calls 8/4
   a *default*. With today's 8-item bank this is visible — the third irregular
   item lands at position 8, not 9, because the 5 decodable items are spent by
   then.
-  **Sept 15** — **The bank cannot fill a session yet.** 5 decodable + 3 irregular
   approved against 8 + 4 needed. `select.ts` degrades rather than throwing, and
   a test records the current shortfall on purpose so it fails loudly when the
   reviewed candidates are appended. **This is a content gap, not a code gap:**
   the 30 candidates are still pending the human review in the Sept 14 [HUMAN]
   task.
-  **Sept 15** — **The `npm test` failure was a Node version mismatch, not a
   vitest config bug. `vite.config.ts` is correct as written — do not "fix" it.**
   Symptom: every test file dies in the worker with `ERR_REQUIRE_ESM`, jsdom 30 →
   `html-encoding-sniffer@6` doing `require()` on `@exodus/bytes`, which is pure
   ESM. Cause: the shell was on **Node v22.3.0**; unflagged `require(esm)` landed
   in Node **22.12**. The project already pins Node 24 in `.nvmrc` and
   `engines.node`, and v24.21.0 was already installed — it just was not selected.
   **Fix: `nvm use`.** All 80 tests then pass under jsdom with no config change.
   Rejected: `environment: "node"`, and swapping jsdom for happy-dom. Both make
   the symptom disappear while leaving the mismatch in place, and the component
   tests for `GameScreen.tsx` and `ParentScreen.tsx` need a real DOM. The same
   wrong Node would then have surfaced next in `vite build` or `generate.ts`
   instead, further from the cause. **If the suite explodes in node_modules
   again, check `node -v` before touching config.**
-  **Sept 15** — **`closed-syllable` is the only misconception the current bank
   can confirm. This constrains the demo video.** Found by running
   `npm run simulate --child <id>` for all five: a child erring *every single
   time* still tops out below threshold on four of them, because confirmation
   needs more items than the bank offers. Weighted selection ceilings against the
   3.0 decodable / 2.0 irregular thresholds: `closed-syllable` 4.0 over 4 items
   (**confirms**); `vowel-team-assumed` 2.0 over 2; `ea-three-sounds` 1.0 over 1;
   `ie-two-sounds` 1.0 over 1; `irregular-word` **1.5** over 3 irregular items,
   since each pick weighs 0.5. Two consequences. (1) The Sept 17 recording can
   only show a `closed-syllable` finding unless the bank grows first. (2) **The
   irregular track cannot confirm anything today**, so
   `IRREGULAR_PARENT_SENTENCE` — the teacher's verbatim wording, written for this
   screen — would never appear in the demo. **A 4th irregular item fixes exactly
   that**, and is the single highest-value item in the review queue. This is a
   content gap, not a code gap; the thresholds are correct and were set
   deliberately on Sept 15.
-  **Sept 15** — **Runtime imports inside `src/` need an explicit `.ts`
   extension.** `scripts/simulate.ts` loads the engine through Node's own ESM
   loader, which does not guess extensions the way Vite does, so
   `select.ts`'s `import { diagnose } from "./diagnose"` failed with
   `ERR_MODULE_NOT_FOUND` under `node` while passing under vitest. Type-only
   imports are erased and stay extensionless, which is why `validate.ts` never
   hit this. Rule: **a runtime import in `src/` that a script may reach carries
   `.ts`.**
-  **Sept 15** — **A ruled-out misconception is still rendered with its deficit
   label, which reads backwards.** `simulate` prints "strength: Does not have an
   understanding of closed syllables — ruled out over 4 chances". The data is
   right and `forParent` is right; there is simply no strength-phrased wording in
   the model, because the Sept 15 decision on track wording solved this for the
   irregular headline only. **The decodable track has the same problem and it is
   unsolved.** Not fixed here — it is parent-screen copy, it needs her words, and
   it belongs to the Sept 16 task. Flagged so it is not discovered on camera.
-  **Sept 16** — **Misconceptions carry two parent-facing labels.** `label` is
   shown when the misconception is **confirmed** and describes a child who has
   the problem; **`strengthLabel`** is shown when it is **ruled out** and
   describes a child who does not. Both are the teacher's, transcribed verbatim
   per section 11. This closes the Sept 15 flag that a ruled-out result rendered
   as "strength: Does not have an understanding of closed syllables" — the exact
   gap the evidence had just ruled out, printed under the word strength.
-  **Sept 16** — **`forParent()` resolves the wording; a component never picks a
   label.** It now takes `misconceptions` as a second argument and returns
   `ParentFinding` (the evidence plus a resolved `label`), already correct for
   that finding's confidence. Same reasoning as the Sept 15 decision that made
   `forParent()` the only path to the parent screen: a rule enforced in one named
   function cannot be got wrong by the next caller. Making the parameter
   **required** rather than optional was deliberate — the compiler listed all 15
   call sites, where a default would have let the old wording survive silently.
   `simulate.ts` now renders `finding.label` instead of looking up its own, so it
   still tests what the parent screen will actually show.
-  **Sept 16** — **`forParent()` throws on a misconception it cannot describe, or
   one whose label is blank.** Rather than falling back to the raw id or an empty
   string. Consistent with `diagnose()` throwing on an unknown picked word: a
   silent miss would put an id, or nothing, on the one screen a parent reads.
-  **Sept 16** — **The strength-wording test reads the clause about the child,
   not the whole string.** A blunt "contains no negation" check failed on her
   `irregular-word` strength — "Recognizes that some words **cannot** be fully
   decoded and must be memorized." The negation there is about *words*, not the
   child, and the label is a capability. The test now checks only the text before
   the first "that". **Her wording was right and the test was wrong**; noted
   because the reverse assumption would have edited a teacher's sentence to
   satisfy code, which section 5's rule about seed items forbids in the
   validator and which applies just as much here.
-  **Sept 16** — Trailing punctuation is inconsistent across the five strength
   labels: `vowel-team-assumed`, `ea-three-sounds` and `irregular-word` end in a
   period, `closed-syllable` and `ie-two-sounds` do not. Transcribed as written
   rather than normalised. **Open question for her** before the parent screen is
   designed — it will be visible on screen. **Closed the same day — see below.**
-  **Sept 16** — **Periods added to the `closed-syllable` and `ie-two-sounds`
   strength labels, so all five are punctuated alike.** The project owner's
   decision, taken on the flag above. Several strengths can appear one under
   another on the parent screen, where a single missing period reads as a typo
   rather than as fidelity. **Punctuation only — no word was changed**, verified
   by comparing both strings with trailing periods stripped before writing.
   Final: "Understands and recognizes what a closed syllable is." and
   "Recognizes that ie can make two sounds."
   **This is a sanctioned, narrow departure from section 11's verbatim rule and
   does not generalise.** Wording is still never edited to suit the code — the
   Sept 16 entry above, where her `irregular-word` sentence was right and my test
   was wrong, is the standing example. A test now asserts every strength label
   ends in a period, so a later edit cannot quietly undo the consistency.
-  **Sept 16** — Still open, and deliberately not changed: the five **deficit**
   labels carry no trailing period, so a confirmed finding and a strength can sit
   on the same screen punctuated differently. Not covered by the decision above,
   which named only the strength labels. Worth deciding with her when the parent
   screen is designed. **Closed the same day — see below.**
-  **Sept 16** — **Periods added to all five deficit labels too. Both label sets
   are now punctuated alike and the question is settled.** The project owner's
   decision, taken on the flag above and matching the one before it.
   **Punctuation only — no word was changed**, verified the same way: both
   strings compared with trailing periods stripped before writing. The guard test
   was widened from strength labels to **every parent-facing label**, so neither
   set can drift back on its own. Nothing in `src/` or `scripts/` asserts these
   strings literally, so nothing else moved.
   `scripts/review-sheet.md` still quotes the old unpunctuated labels as
   headings. **Left alone on purpose:** it is a snapshot written for her review of
   the 30 generated items, not the parent screen, and no script regenerates it.
   Two entries above still stands: this is punctuation, and it does not licence
   editing her wording.
-  **Sept 16** — **Session state is a pure machine in `session.ts`, not React
   state inside the component.** `startSession` / `pick` / `advance`, state in
   and state out. A full session can then be played in a test with no DOM, and
   the thing that records evidence is not tangled up with the thing that draws
   it. The component holds one `useState` over it.
-  **Sept 16** — **Option order is shuffled once, when the item is dealt, and
   then held in state.** Section 7 says randomise at render time, because the
   seeds place the correct answer at positions 3, 2, 2 and a child finds that
   pattern fast. Shuffling in the render body would satisfy the letter of that
   and be a bug — the options would move under the child's finger on every React
   re-render.
-  **Sept 16** — **The DOM never says which option is correct.** One class for
   every option, tapped or not, and no `data-correct`. A second class keyed on
   correctness would be the red X in disguise and would leak the answer to
   anyone reading the DOM. A test asserts the tapped highlight is identical for
   a right and a wrong pick.
-  **Sept 16** — **The 60px tap-target floor is an exported constant applied
   inline, not a stylesheet rule.** jsdom computes no layout, so a CSS
   `min-height` is invisible to a test and could rot silently. One number, one
   place, asserted. The comfortable size stays in the stylesheet; the inline
   value is the guarantee.
-  **Sept 16** — **The session waits behind one Start tap.** Mobile Safari and
   Chrome block audio before a gesture, and on the irregular track the spoken
   stem *is* the question — a child who hears nothing has nothing to answer
   from. The gate doubles as a calm way in.
-  **Sept 16** — **Speech synthesis is written as a fallback, not as the
   design.** Clip first, browser voice when it fails; guarded so a clip that both
   errors and rejects cannot speak twice over itself. Today the fallback is the
   only path that ever runs — no clip exists, `seed-what` / `seed-who` /
   `seed-the` name files that were never recorded. A recorded human voice is
   better for a six-year-old than a synthesised one, so the shape assumes the
   clips arrive. **Rate 0.85**, slower than default.
-  **Sept 16** — **The star bar is sized `min(SESSION_LENGTH, bank.length)`, not
   12.** Session length is not known up front, since selection is adaptive and
   stops when the bank runs dry. Against today's 8-item bank a fixed 12-star bar
   would end the session stuck at two thirds, which is exactly the "looks broken"
   failure section 7 rejects early exit for. Approximate by construction: it is
   an upper bound, and the half-session cap could still come in under it.
-  **Sept 16** — Zoo economy: **one star per item answered**, right or wrong, and
   **3 stars per animal** (`STARS_PER_ANIMAL`) — four animals over a full
   12-item session. The store shows what is coming and is inert: no handlers, not
   focusable, `pointer-events: none`. A child who can tap it has a second task
   competing with the one being measured.
-  **Sept 16** — Andika is loaded from Google Fonts with a fallback stack of
   other primary-education faces (Lexend, Comic Neue) before the system sans, so
   a failed webfont never leaves a beginning reader looking at a double-storey
   `a` — the letterform section 9 exists to avoid.
-  **Sept 16** — **The child screen's visual direction is now saturated and
   illustration-led, and section 9 has been revised to say so per screen.** The
   owner's call: the first build read as a desktop form, not a children's app.
   Reference language is Khan Academy Kids and Duolingo ABC — zookeeper
   character, real colour, cards with presence, a zoo with ground and sky.
   **This supersedes section 9's "warm and calm, not bright primary-colour kid
   app" for the CHILD screen only**; the parent screen keeps that direction,
   because the two audiences want opposite things and one direction for both was
   serving neither. Section 9 now states both. A six-year-old does not read a
   muted palette as calm, they read it as dull, and this child has to want to
   answer twelve questions they will partly get wrong.
-  **Sept 16** — **The app is a phone-width column in a visible frame.** It is a
   phone app and it is mostly going to be seen on a laptop, including in the
   demo video. Without the frame a centred column reads as a desktop page that
   failed to fill the window. Below 460px the frame drops away and it goes
   full-bleed.
-  **Sept 16** — **Stars moved next to the store icon, and they are still the
   progress indicator.** Section 9 asks for progress as position only — "a row of
   12 dots filling in" — and that is what the star row is; putting it beside the
   store just makes what the stars are *for* legible to a child who cannot read
   the label. Earned stars are solid amber and unearned ones are a soft filled
   shape rather than a hollow outline, which at 16px read as missing rather than
   as not-yet.
-  **Sept 16** — **The speaker button leads the question line.** Previously it
   sat under the stem, where it looked like a footnote. A child who cannot read
   needs the control that produces the question to be the first thing on the
   line. The target word came down from `clamp(2.4rem, 7vw, 4rem)` to `1.32em`
   of the sentence, bold and inline: at the old size it towered over the stem and
   read as the answer rather than as part of a question.
-  **Sept 16** — **The option cards are saturated but the word is still dark on
   light.** Cards get a saturated fill, a 3px border and a solid bottom edge, so
   they have real presence. What they do *not* get is white text on a saturated
   ground: this is a decoding test, letterform contrast is the measurement, and
   a colour that costs a child legibility costs the diagnosis its evidence. All
   three cards are identical, as ever.
-  **Sept 16** — Redesign kept every behaviour rule and the tests that hold them.
   Two test selectors moved with the DOM — the store is now in the top bar, and
   the star amber is **exported as `STAR_AMBER`** rather than written as a
   literal in the test, so a palette change cannot quietly turn that assertion
   into a test of nothing. Five tests were added for the new layout: the
   top-to-bottom order, the speaker leading the line, the target staying inline,
   the zoo having ground and sky, and the animals being drawn at 80px+.
-  **Sept 16** — **DESIGN.md added, and the game screen rebuilt against it.**
   A companion to CLAUDE.md: CLAUDE.md governs behaviour and data, DESIGN.md
   governs what the screens look like and how they feel, **and CLAUDE.md wins
   where they touch.** The governing idea is that the screen is a *place*, not a
   document: the zoo fills the viewport full-bleed and the question panel floats
   on top of it. An empty pen is not empty space — it is the reason to answer the
   next question.
-  **Sept 16** — **DESIGN.md's practice round is NOT built, and this is the one
   place the precedence rule bit.** Section 8 asks for two or three warm-up items
   where feedback IS given, so the child learns what the game wants, citing DIBELS
   and Acadience. CLAUDE.md section 9 says flatly that **the child is never told
   whether they were right**, for three stated reasons. The two documents touch
   directly, CLAUDE.md wins, so no practice round ships. **Worth a decision rather
   than leaving it settled by precedence:** the objection it answers is real — a
   six-year-old who never learns what the game wants may answer badly for reasons
   that are not reading — and practice items are separate from the session and
   unscored, which is why the assessments it cites allow them. If the owner wants
   DESIGN.md to win here, it is a scoped addition: practice items outside the
   bank, feedback during them only, and nothing after they end.
-  **Sept 16** — **The phone frame is gone, one day after it was added.**
   DESIGN.md opens "Desktop web, full viewport. Not a centered column" and closes
   by forbidding "a centered narrow column on a plain background". It is the
   newer document and this is a look-and-feel matter, not behaviour, so it wins.
   The screen is now full-viewport with no scrolling.
-  **Sept 16** — **The zoo moved from a footer strip to the background, and the
   star bar became a count.** Both follow from the same idea. Stars sit beside the
   store as `★ 7`, with a "2 more stars" line and the next animal filling in as a
   silhouette. **This still satisfies section 9's "progress is shown as position
   only":** one star is earned per item answered, so the number *is* the child's
   position in the session. It is not a score — it never falls, and it never
   depends on being right.
-  **Sept 16** — **All delight moved to the reward layer.** A star flies from the
   tapped card to the counter on every tap, and an animal walks into its pen when
   bought. Both are safe places for joy precisely because neither is tied to being
   right; the answer itself still gets nothing but the neutral gold. The flight is
   unconditional — where the layout cannot be measured the delta is zero and the
   star fades in place rather than being skipped.
-  **Sept 16** — **The word cards stay near-white with a saturated border, not a
   saturated fill.** DESIGN.md asks for the most saturated colour on the
   interactive elements so the eye lands on the cards; it also asks for 7:1
   contrast on the card text, "since decoding them is the actual task". Both are
   satisfied by putting the saturation on a 4px Okabe-Ito blue border and keeping
   the word itself dark on near-white. Palette is Okabe-Ito throughout, so nothing
   encodes meaning in colour alone.
-  **Sept 16** — Rebuild kept every behaviour test. Five had to be rewritten
   because the DOM genuinely moved (the zoo is no longer a footer, the star bar is
   no longer a row of stars) — **rewritten to assert the new spec's equivalent
   property, never weakened**: the star count now has to increment by exactly one
   per item and a wrong-answered session has to earn the same stars as a
   right-answered one. Two real bugs surfaced doing it: the star flight was
   silently skipped whenever the layout could not be measured, and a test was
   reading `onComplete`'s answers mid-session, when they do not exist yet.
-  **Sept 16** — A design canvas of the rebuilt screen (game screen, tap state,
   irregular item, start screen) is published as an Artifact, with the working
   `.dc.html` sources kept in `design/` so it can be re-seeded. It is a static
   visual spec, not a prototype — the running app is the working thing.
-  **Sept 16** — **The irregular track shows its headline INSTEAD of the deficit
   label, not above it.** `forParent()` returns both for an irregular finding:
   the track headline (the teacher's "Your child needs to practice learning
   irregular words.") and the finding's own `label` ("Hasn't memorized words that
   can't be sounded out."). The screen renders the headline and drops the label.
   Rendering both would put back exactly the framing the Sept 15 wording decision
   exists to remove — a sight word is a memorisation gap, not a misapplied rule —
   so the second heading would undo the first. A test asserts the deficit label
   is absent from that track's output.
-  **Sept 16** — **The activity is shown in full, not behind a disclosure.**
   CLAUDE.md section 8 suggests showing the first line and letting the parent
   expand; the advice runs 334-595 characters, which is three to six sentences.
   At one activity per finding and at most a handful of findings, the whole thing
   fits a phone screen, and the activity is the one thing the parent is meant to
   act on — a tap between them and it is a tap too many. Section 8's "expandable"
   is permitted, not required. Revisit if a session ever confirms three or more.
-  **Sept 16** — **Nothing-confirmed is designed as a real outcome and says only
   what the evidence supports.** "No one pattern came up often enough to name",
   plus the strengths that *were* ruled out. It deliberately does **not** say the
   child is doing fine, has no problems, or is reading well: a short session with
   a thin bank cannot show that, and a parent who is told it once will not come
   back. A test asserts that reassurance phrasing never appears.
-  **Sept 16** — **The evidence line carries its denominator.** "Chose him for
   pie, got for snow, bot for boat and ran for rain — every one of the 4 words
   where it could come up." Two selections out of two is a pattern and two out of
   nine is noise (section 7); a parent shown only the numerator cannot tell which
   they are being told about. Phrased "every one of the N" rather than "N of the
   N", which reads as a typo.
-  **Sept 16** — **Findings and strengths are told apart by icon, worded label
   and typography — never by colour.** Section 9 requires it and the two can sit
   on the page together. The accents are Okabe-Ito blue and bluish green, which
   survive red-green colour blindness, but nothing on the page depends on seeing
   them: remove all colour and the page still reads correctly.
-  **Sept 16** — **Session duration is measured from the Start tap, not from
   mount.** `GameScreen` reports elapsed milliseconds alongside the answers. A
   tablet left sitting on the table before a child taps Start would otherwise
   turn into a forty-minute session on the parent screen. The engine stays
   clock-free: `diagnose()` is still pure, and the timing never reaches it.
-  **Sept 16** — **The parent-screen tests need a fourth irregular item that the
   bank does not have**, so one is built in the test file — explicitly a fixture,
   never appended to `items.json`, with a target from the teacher's sight-word
   list and advice copied verbatim from a real seed distractor. Without it the
   irregular headline cannot be exercised at all, because three irregular items
   cap at 1.5 weighted selections against a threshold of 2.0. **A companion test
   asserts the shipped bank still cannot confirm that track**, so it fails loudly
   the day a fourth irregular item is reviewed in and the gap closes.
-  **Sept 16** — CLAUDE.md section 9's layout line was reconciled a second time.
   It had said both screens live in a phone-width column with a visible frame,
   which stopped being true the moment DESIGN.md sent the child screen
   full-viewport. It now states the two shapes separately: child full viewport,
   parent a measure-width column.
-  **Sept 16** — **DESIGN.md section 10 was rewritten far more prescriptively,
   and the parent screen was revised to match.** The order is now the design and
   it is argued rather than asserted: **strength, then concern, then action.**
   Opening on a concern makes a parent defensive, burying it in praise means they
   miss it, and ending on it leaves them holding worry instead of something to
   do. So one strength sits above the finding, the activity is last, and the
   remaining strengths sit below it.
-  **Sept 16** — **Exactly one activity on the screen, not one per finding.**
   This is a real behaviour change from the first build, which rendered an
   activity per confirmed misconception. Section 10.5: never a list, never a
   menu, *no matter how many findings there are*, because more options reduce
   the chance a parent does anything at all. The one shown comes from the
   **most-evidenced** finding. Only visible once the bank can confirm two things
   at once, which today it cannot.
-  **Sept 16** — **The coloured dot on strengths is gone.** Section 10.9 names
   exactly that failure — "icon plus text label, never a green dot against a blue
   dot" — and the first build had shipped the dot. Findings and strengths now
   differ by **shape first** (a ring around a dot against a tick), each with a
   worded label; strip every colour from the page and it still reads correctly.
-  **Sept 16** — **The framing line lost its numerals.** It had read "Your child
   played 8 words over about 4 minutes." Section 10.2 asks for a non-numeric
   sentence, and a word count is exactly the kind of number 10.1 exists to keep
   off this screen — it invites comparison and gives the parent nothing to do.
   Now: "Your child played a reading game for about four minutes." Duration is
   spelled out.
-  **Sept 16** — **The activity names its time, from a single constant.**
   Section 10.5 says name it and gives "About 5 minutes." There is no per-activity
   duration in the data, and inventing one per activity would be a fabricated
   claim about the teacher's content, so the document's own value is applied to
   every activity as `ACTIVITY_TIME`. **If she wants real per-activity times that
   is a field on the distractor, not a guess made in the component.**
-  **Sept 16** — **Section 10 contradicts itself on numbers, and the specific
   rule was followed over the general one.** 10.9 says "No numbers anywhere on
   the screen", but 10.4 requires evidence counts and gives "3 of the 4 words" as
   its own example, and 10.5 requires "About 5 minutes." Read literally, 10.9
   would delete the two things 10.4 and 10.5 demand. Taken as: no **scores** —
   no percentage, no number correct, no grade level, no percentile — which is
   what 10.1 argues at length. Numerals are gone from the framing line, where
   they carried nothing. **Worth a one-line fix in DESIGN.md.**
-  **Sept 16** — Section 10.6 asks that a strength be framed as what the child is
   "not getting caught by". No extra copy was added for it: a strength only ever
   appears when a misconception was **ruled out**, which is precisely a trap
   offered repeatedly and not taken, and the teacher's `strengthLabel` already
   states the skill positively. Adding a sentence to say so again would be filler.
-  **Sept 16** — **The teacher delivered home activities for the generated
   words, and 19 items entered the bank. `items.json` goes 8 -> 27.**
   Per-track: **24 decodable, 3 irregular.** Per misconception
   (decodable/irregular): closed-syllable 19/0, vowel-team-assumed 12/0,
   ea-three-sounds 9/0, irregular-word 3/3, ie-two-sounds 5/0. `validateBank`:
   **no failures and, for the first time, no under-representation warnings.**
-  **Sept 16** — **Advice was built from her templates by substitution, never
   written.** 45 distractors got text; every generated string was printed in full
   for review before anything was written. Closed-syllable used the `ran`
   template (the "read the word, then practice" variant, 3 of the 4 existing
   examples) rather than the `bot` one, which ends "tell you the short sound" —
   her description said read the word. Vowel-team used the `soup` template
   (front/back cards, self-correct, try-again pile), which is the activity she
   described; the `free` template is a different activity and was not used. The
   ea activity is her `steak` text unchanged on every ea word, per her note that
   nothing changes per word. The `ie` template names no card words, so her list
   was appended using **her own idiom from the closed-syllable template**,
   "Practice with: …", rather than a sentence of ours.
-  **Sept 16** — **Six corrections to her cell text, all spelling or
   punctuation, all reported.** `mooon` -> `moon` (soup row); `night  lie` ->
   `night, lie` (missing comma, niece row); `thief , heat` and `book , moon,
   blue` (space before comma); a double space in the chief row; trailing spaces
   on the lick and tie rows. Precedent is the Sept 15 rule that her advice is
   transcribed "spelling corrected only". **Her capitalisation was left exactly
   as written** — her new practice words are sentence-cased ("Band, fan, swam")
   where the existing templates are lowercase ("man, sat, tap"). Not normalised,
   because that is her voice and not an error. Worth one question.
-  **Sept 16** — **`have` was not in her list of seven and did not need to be.**
   Its inherited advice is her own tic-tac-toe text written for the word `have`
   itself, naming that exact word, so the text was already correct and only the
   flag was wrong. Flag cleared, advice untouched — which is what unblocked
   `gen-cake-2`.
-  **Sept 16** — **Eight items stay out of the bank, not seven.** Her seven
   tic-tac-toe words block eight items, because `could` appears on two of them
   (`gen-touch-1` and `gen-toast-1`). Blocked: cake (said), cube (put), seed
   (been), rope (come), find (give), touch (could), toast (could), field
   (friend). They need the decodable words for each grid.
-  **Sept 16** — **`heat` is tagged `ea-three-sounds` on one item and
   `vowel-team-assumed` on another; her tables list it only under vowel teams.**
   Nothing was invented to cover the gap: the ea activity is identical for every
   ea word by her own instruction, so the unchanged text applies. Flagged rather
   than silently filled.
-  **Sept 16** — **Open question on her `thief` card words: "Head, thief, heat".**
   Head and heat contain no `ie`, and the activity asks the child which of the
   two `ie` sounds is in the word. Transcribed exactly as written and **not
   corrected**, because this is a pedagogical choice we cannot make — it may be
   deliberate contrast with `ea`. Section 11 says ask rather than encode.
-  **Sept 16** — **A real session now runs the full twelve items**, where it ran
   8 and stopped before. **Three misconceptions can now be confirmed** —
   closed-syllable, vowel-team-assumed and ea-three-sounds — where only
   closed-syllable could on Sept 15. `ie-two-sounds` reached suspected in the
   sampled session and can in principle confirm with 5 items available.
-  **Sept 16** — **The irregular track is unchanged and is now the only real
   coverage gap: still 3 items, still 1.5 weighted selections against a threshold
   of 2.0, so it can never be confirmed to a parent.** None of the 30 candidates
   is an irregular-track item — the generator produced decodable items only — so
   the 7 tic-tac-toe activities will NOT fix this when they arrive: they unblock
   decodable items carrying `irregular-word` distractors. **What is needed is a
   fourth irregular ITEM: a spoken sight word with plausible misspellings.** It
   is the single highest-value piece of content left, because without it the
   parent screen's irregular headline — her wording, written for that screen —
   can never appear in the demo.
-  **Sept 16** — Eleven tests changed when the bank grew, every one of them a
   tripwire written on purpose to fail here. The substantive ones: the
   shipped-bank session is now a full twelve rather than a short eight, the
   under-representation warnings are asserted **empty**, and the hard-rule sweep
   now runs over all 27 items rather than the 8 seeds. Two test flaws surfaced
   that a thin bank had hidden: "never reads an option aloud" was checking the
   spoken stem against **every distractor in the bank**, which breaks now that an
   item targets `book` while another offers `book` as a distractor (the rule is
   about the item being asked, and it now checks that); and the suspected-pattern
   test relied on a bank session landing on `suspected`, which a deeper bank
   turns into `confirmed`, so it now builds the two-pick case directly.
-  **Sept 16 — teacher decision.** **The advice says "your child" throughout,
   never "student" or "students".** It is read by a parent, and the classroom
   register was leaking through from where she first wrote it. **92 distractors
   across 33 distinct strings** in `items.json` and `candidates.json`. Done as
   eleven crafted phrase edits, **not a blind find-and-replace**, because the
   agreement differs in each: "Student needs" -> "Your child needs", "Students
   will need" -> "Your child will need", "Have students identify" -> "Have your
   child identify", "Once student confirms" -> "Once your child confirms",
   "Give students 3 index cards" -> "Give your child 3 index cards", "once a
   student finds" -> "once your child finds" (the article goes too). Every
   before/after was printed for review before writing. "your child" is her own
   register in these same templates — "Ask your child to point to the vowel" was
   already there.
-  **Sept 16 — teacher decision.** **"Then have them read the word to you." added
   after "Have them tell you the short sound."** in the closed-syllable advice.
   **It lands on exactly one distractor: `bot` on `seed-boat`**, because only the
   `bot` variant of that activity ends by asking for the sound. The other
   variant — the `ran` template, which all 19 generated closed-syllable strings
   were built from — already ended "Have the child read the word." **So the edit
   closes the gap between the two variants rather than adding something new to
   the majority of them**, and both now end with the child reading the word
   aloud. Worth knowing if she expected it to touch more than one.
-  **Sept 16** — Left alone deliberately: the 22 vowel-team strings say "the
   child" rather than "your child" ("Have the child look at the front, try to
   read it"). They never said "student", so they already satisfy the instruction,
   and changing them would be a rewrite she did not ask for. Flagged in case she
   wants the whole bank on one form of address.
-  **Sept 17** — **The tic-tac-toe grid words arrived and the last 8 items
   entered the bank. `items.json` 27 -> 35, and nothing is left pending advice:
   27 approved, 0 pending, 3 rejected.** Per-track **32 decodable, 3
   irregular**; per misconception (decodable/irregular) closed-syllable 25/0,
   vowel-team-assumed 13/0, ea-three-sounds 10/0, irregular-word 11/3,
   ie-two-sounds 5/0. `validateBank`: no failures, no warnings.
-  **Sept 17** — **One sentence of her `have` template was OMITTED rather than
   substituted, and this is the one thing to check.** The template runs: (1)
   "Your child will need to memorize this word as they cannot decode it." (2)
   *"Your child will expect the a to say its long sound because of the e at the
   end, but 'have' says the short a sound."* (3) the tic-tac-toe instructions.
   Sentence (2) is a **phonics claim about the specific word** — true of `have`
   and `gone`, which are silent-e words, and **false of said, put, been, could
   and friend**, which are irregular for entirely different reasons. She said so
   herself: "each word is irregular for its own reason." She supplied grid words,
   not reasons, so that sentence was left out rather than written: composing it
   per word would mean inventing pedagogy, which section 11 forbids twice over.
   **`come` and `give` are the two that could carry a silent-e version** if she
   wants to write them; the other five need a different reason each. Every
   generated string was printed in full before writing.
-  **Sept 17** — The article in "Create **a** 3 by 3 chart" is taken from her own
   `gone` wording of that same sentence; the `have` copy reads "Create 3 by 3
   chart". Her text either way, not a correction of ours.
-  **Sept 17** — **A repeated target is allowed in the bank; my move script was
   wrong to refuse one.** `gen-cake-1` was held back for sharing the target
   `cake` with `gen-cake-2`, which had entered the bank the round before. Section
   7's rule is "a target word appears at most once per **session**", which
   `select.ts` enforces and is tested for with twin items — so two different
   items on the same word can both live in the bank and at most one is ever dealt
   in a session. They are genuinely different items: same target and vowel,
   different correct answers (`play` vs `train`) and different distractors.
   Added.
-  **Sept 17** — **`irregular-word` can now be confirmed on the DECODABLE
   track.** Eleven decodable items carry it (said, have, come, give, could,
   friend, put, been, gone…), so a child who consistently misreads irregular
   words inside decodable items reaches 4 weighted selections against a
   threshold of 3. The parent screen can therefore show "Hasn't memorized words
   that can't be sounded out." as a decodable finding — which it could not
   before.
-  **Sept 17** — **New and worth a decision: the half-session cap now binds on
   `irregular-word` in most sessions, and sometimes starves the irregular
   track.** Measured over 200 sessions: **127 hit the cap** and **20 were dealt
   fewer than all three irregular items.** Cause: `irregular-word` is tagged on
   **14 bank items** — 11 decodable plus all 3 irregular — and the Sept 15
   decision counts the cap **across the session, not per track**, so decodable
   items carrying an `irregular-word` distractor eat the budget the irregular
   track needs. That decision is still right for diagnosis integrity, and it was
   taken deliberately *because* the misconception spans both tracks. **The engine
   was not changed here** — it is a logged decision and the owner's call.
   **It becomes blocking the moment a fourth irregular item lands:** that track
   needs all four items dealt to reach 2.0 and confirm, and a cap that sometimes
   withholds the third will sometimes withhold the fourth. Options then: leave
   it, make the cap per-track, or exempt a track's native misconception from the
   cap on its own track.
-  **Sept 17** — The shipped-bank interleave test was rewritten to assert a
   **property instead of an exact list**: irregular items may only ever land on
   positions 3, 6, 9 or 12. It previously pinned one seed's output, which the cap
   interaction above now makes vary between two and three irregular items per
   session. The rule that must always hold is the placement, not the count.
-  **Sept 17** — **Fourth irregular seed: `seed-because`.** Target `because`,
   spoken and never shown, `q-because.mp3` named and **not recorded**. Options
   `becuz` and `bcuz` (both `irregular-word`, her mnemonic advice identical on
   both) and `because` correct with null misconception and null advice. Passes
   every hard rule with **no rule 8 warning** — unlike `seed-who`, `becuz`
   shares the target's opening `be`, so the soft look-alike rule is satisfied.
   Bank 35 -> 36; irregular track 3 -> 4 items.
-  **Sept 17** — **The fourth item alone was not enough: it lifted the irregular
   track from confirmable-never to confirmable-in-27%-of-sessions.** Measured
   over 500 sessions with a child who takes the bait every time: all four
   irregular items were dealt in 135, three in 330, two in 35. The cap was the
   limit, exactly as flagged the day before it landed — `irregular-word` is
   offered by 15 bank items, 11 of them decodable, and the session-wide budget of
   6 was spent before the fourth irregular slot came up in 480 of 500 sessions.
-  **Sept 17 — owner decision.** **The half-session cap no longer governs a
   misconception on a track that measures nothing else.** `select.ts` now reads
   `misconceptions.json` for this, so the rule comes from data rather than from a
   hardcoded track name. An exempt item neither checks the cap nor counts toward
   it, so a track's budget is spent only by the items the cap governs.
-  **Sept 17** — **The first implementation of that exemption was wrong and would
   have quietly gutted the cap.** Written as "exempt a misconception on the track
   it is native to", which reads correctly and is what the instruction said — but
   **all four decodable misconceptions are native to the decodable track**, so it
   exempted closed-syllable, vowel-team-assumed, ea-three-sounds and ie-two-sounds
   on decodable items and removed the cap precisely where it does its work. Six
   fixture tests caught it immediately. The rule that survives is **"is this the
   only misconception this track measures"**: the irregular track has exactly one
   native misconception and the decodable track has four, so only the irregular
   track is exempt, which is what the owner's own reasoning said — "on the
   irregular track it is the only thing being measured".
-  **Sept 17** — **Verified over 1000 sessions.** All four irregular items dealt:
   **1000/1000 (was 135/500).** Irregular track confirmed: **1000/1000 (was
   27%, and 0% before the fourth item).** The headline reaches the parent screen
   in **100%** of those sessions — her wording, written for that screen,
   appears there for the first time. Guards all hold: the cap is breached **0**
   times where it still governs, `closed-syllable` never exceeds it in 1000
   sessions, `irregular-word` still confirms on the decodable track in 73% of
   them, and a child who answers correctly still gets the irregular track
   **ruled out** over 4 exposures rather than confirmed.
-  **Sept 17** — `selectNext` and `selectSession` now take `misconceptions` as a
   **required** parameter, and `SessionState` carries it beside the bank. Required
   rather than optional on the same reasoning as `forParent`: the compiler listed
   every call site — `session.ts`, `GameScreen`, `App`, `simulate.ts` and four
   test files — where a default would have let the old capping survive silently
   wherever it was omitted.
-  **Sept 17** — **A fixed RNG seed alone does NOT fix the twelve items, so the
   demo pins the bank as well as the seed.** Selection is adaptive: only the four
   coverage-phase items are answer-independent, and from item 5 the weighting
   reads `diagnose(answers)`. Measured on one seed across four answer patterns:
   the sequences agree for exactly 4 items and then diverge, and **18 different
   items** turn up across the four. Pinning the seed alone would have had the
   recording team record twelve clips and then watch the app ask for items they
   had not recorded.
   The fix pins both: `DEMO_ITEM_IDS` makes the **set** fixed whatever the child
   does (twelve items fill twelve slots), and `DEMO_SEED` makes the **order**
   fixed for a given answer pattern. Verified across five answer patterns and 40
   seeds: all twelve always dealt.
-  **Sept 17** — The twelve are her **five decodable seeds and all four irregular
   seeds**, plus `gen-sweat-1`, `gen-chief-1` and `gen-moon-1` for the
   misconceptions her seeds under-cover (ea, ie, oo). Her own items lead the
   demo. Load among the 8 decodable: closed-syllable 6, vowel-team-assumed 5,
   ea-three-sounds 2, irregular-word 2, ie-two-sounds 1 — closed-syllable sits
   **exactly at** the half-session cap of 6, which passes (the cap blocks the
   seventh, not the sixth), and is worth knowing before anyone swaps an item in.
   Both demo findings stay reachable: closed-syllable confirms, and so does the
   irregular track with her headline reaching the parent screen.
-  **Sept 17** — **`?demo=off` restores the real behaviour, and that should become
   the default again after submission.** A fixed order is right for a recording
   and wrong for a child: the Sept 16 decision that a child who sits down twice
   should not get the same twelve items still stands, and the pinned bank
   suspends it. Flagged in `App.tsx` at the constant.
-  **Sept 17** — A fresh generator is built per round, keyed on the round counter.
   Reusing one `seeded()` closure would let "Play again" continue the random
   stream and deal a different order on the second run — the opposite of what a
   pinned demo needs.
-  **Sept 17** — **Eight of the twelve clips need `audio` set in `items.json`
   once recorded.** The four irregular ones already name their file; every
   decodable item still has `audio: null` and reaches the child through speech
   synthesis. Nothing is recorded yet, so the demo currently runs entirely on the
   synthesised voice — the clips are the last content gap before the video.
-  **Sept 17** — **Null-state bug report investigated: no bug in the engine. All
   three suspects cleared, and the run was not what it looked like.**
   (1) **The threshold is inclusive, not exclusive** — `selections >=
   threshold.confirmed - EPSILON`, and 2.0 empirically returns `confirmed`.
   (2) **All four irregular items were dealt** — 0 of 200 sessions dealt fewer,
   on the pinned demo bank and the full 36-item bank alike; the Sept 17 cap
   exemption holds. (3) **The picks were recorded** — all four present with
   `itemId`, `target` and `word`, `rawSelections: 4`, `itemsSelectedIn: 4`.
   Verified at three levels: `selectSession`, the `session.ts` machine, and the
   real `GameScreen` component driven by taps in jsdom under `StrictMode` with
   real timers. **All three confirm the irregular track.** A session answered
   wrong on every item produced the null state in **0 of 200** runs.
-  **Sept 17** — **What actually happened: the run was not wrong on all four
   irregular items.** Option order is randomised at render time (section 7), so
   tapping the same card position — or tapping fast — lands on the correct
   spelling about a third of the time. Measured over 200 sessions per behaviour:
   "always wrong" gives the null state **0%** of the time, while "always tap the
   same position" gives it **~43%** and leaves the irregular track unconfirmed
   **~83%**. Getting even one of the four right is enough.
-  **Sept 17** — **The real finding: the irregular track is all-or-nothing, with
   zero margin.** Each pick weighs 0.5 and the threshold is exactly 2.0, so
   **4 of 4 wrong confirms and 3 of 4 shows the parent nothing** — 1.5 is
   `suspected`, which `forParent` withholds by design.

   | irregular answered wrong | weighted | confidence | parent sees |
   | --- | --- | --- | --- |
   | 4 of 4 | 2.0 | confirmed | the finding |
   | 3 of 4 | 1.5 | suspected | **nothing** |
   | 2 of 4 | 1.0 | insufficient | nothing |

-  **Sept 17** — **Do not lower the irregular confirm threshold without seeing
   this number.** Two of the three options on an irregular item are wrong, so a
   child who cannot read them at all still picks a distractor two times in three.
   Simulated over 4000 sessions with a pure guesser: **at the current 2.0
   threshold a guesser confirms 23% of the time; at 1.5 (3 of 4) it would be
   59%.** The all-or-nothing behaviour is the price of keeping a random tapper
   off the parent screen, and it is a price worth paying — the alternative tells
   three parents in five that their child has a sight-word gap on no evidence.
   **Left unchanged.** If the margin is still wanted, the honest fixes are more
   irregular items per session (the interleave gives 4 of 12) or a single-
   distractor irregular format, not a lower bar.
-  **Sept 17** — **The twelve clips landed as `.m4a`, not `.mp3`, and four items
   were pointing at the wrong extension.** `seed-what`, `seed-who`, `seed-the`
   and `seed-because` still named `q-<target>.mp3` from the section 12
   convention; those files do not exist. All twelve demo items now carry the
   filename actually on disk, matched by stem so the extension is read from the
   recording rather than assumed. Eight were `null` and are now set. Result: **12
   items name a clip, 0 dangling references, 0 unused files**, and all twelve
   fetch 200 `audio/mp4` from the dev server and are copied into `dist/audio/`
   by the build.
-  **Sept 17** — **The extension is now data, not a convention.** CLAUDE.md
   sections 2 and 12 said `q-<target>.mp3`; they now say `q-<target>.<ext>` and
   state that the item's `audio` field carries the real filename. Assuming the
   extension is what produced the four broken references in the first place.
-  **Sept 17** — **A missing clip used to fail silently, and now reports itself.**
   `NarratorDeps` gained `onFallback`, and `browserNarrator` logs a console
   warning naming the item, the file and the reason. The distinction that matters:
   an item that **names** a clip which will not play is a fault and is reported;
   an item with `audio: null` is the designed state for the 24 unrecorded items
   and stays quiet.
   Why it needs saying at all: a wrong filename does not break anything. The
   question is still read aloud, just in the synthesised voice — on a recording
   day the only symptom is the wrong voice, and nobody hears it until playback.
-  **Sept 17** — **A status code cannot check a clip name, so the guard reads the
   disk.** Vite's dev server answers an unknown path with `index.html` at **200
   `text/html`**, not 404 — a mistyped filename looks like a successful fetch.
   The audio element still errors, because it cannot decode HTML, so the fallback
   does fire; but the check that matters is `src/audio.test.ts`, which reads
   `/public/audio` and fails if any item names a file that is not there, if a
   clip is not named after its target, if an irregular item has no clip, or if a
   recorded file is unreferenced. Mutation-checked by restoring the old
   `q-what.mp3`: four tests go red naming the item and the file.
-  **Sept 17** — **The zoo redrawn: real animals, four habitats, idle life.**
   Premise check first: the animals were never emoji — they were inline SVG from
   the start — but they were stacked circles and rectangles, and "reads as
   placeholder" was a fair verdict. All six are redrawn as whole, characterful
   figures (mane layers, trunk curl and toenails, neck ridge and patches,
   flippers and cheek patches, shell scutes, curled tail and ear insides), still
   flat, still in the same 64-box with a shared ground line. Owned animals are
   **220px** and silhouettes **170px**, up from 120/96; pens grew to fit and the
   question panel lifted so the two never overlap on a short viewport.
-  **Sept 17** — **Four pens, four habitats — grass, water, trees, rock — assigned
   by animal** (lion, elephant, giraffe, penguin) through a `HABITATS` map, so a
   roster change re-homes an animal without touching the scene. Each pen draws
   its own ground behind the animal and its own boundary in front: post-and-rail,
   a stone pool edge, a hedge with rails, a dry-stone wall. The DOM keeps
   `.pen__ground` / `.pen__fence` per pen and adds `data-habitat`, held by a test
   that all four differ.
-  **Sept 17** — **Idle motion is on owned animals only, and only two kinds: a
   slow sway from the feet and an occasional blink.** Sway runs on an inner
   `.figure__body` wrapper so it never fights the walk-in transform on the outer
   span; blink is a `scaleY` on `.eye` circles via `transform-box: fill-box`.
   Per-pen delays keep the four out of step, or they nod in unison like a
   metronome. Ghosts are deliberately still — part of what makes them read as
   not-yet rather than asleep — and everything stops under
   `prefers-reduced-motion`. DESIGN.md section 4's rule holds: all of this is
   the reward layer, none of it responds to an answer, and the tapped card still
   gets nothing but the neutral gold.
-  **Sept 17** — Not verified visually. Structure, sizes, class hooks and the
   reduced-motion switch are tested; how the drawings actually look is not
   something jsdom can tell us. `npm run dev` before recording.
-  **Sept 17** — **The SVG sky, hills and trees are gone; the scene is now a
   painted backdrop, `/public/zoo-entrance-vector.avif` (2000×1575).** Pens and
   animals stay SVG on top. `SceneBackdrop` was deleted rather than left as dead
   code.
-  **Sept 17** — **The backdrop is a VectorStock watermarked PREVIEW, not a
   licensed export.** Its bottom 150px is a black band reading "VectorStock" /
   "VectorStock.com/1097861". Built against it as asked, with the band held
   off-screen at every aspect ratio — but **the submission needs the licensed,
   unwatermarked file**, both for the licence and because the band is one
   stray-viewport away from being on camera. Flagged, not fixed: it is not ours
   to crop or re-export.
-  **Sept 17** — **The backdrop is sized from the artwork's own pixels, not
   `background-size: cover`.** `cover` cannot both hide the band and keep the
   ground line in view — on a viewport narrower than the image's 1.27:1 it shows
   the band, and on a 16:9 screen it pushes the foreground grass below the
   fold. Instead `.scene` computes one artwork pixel on screen as
   `--art-unit: max(100vw / 2000, 100vh / 1425)` — the scale at which the
   artwork *proper* (1425 tall, band excluded) covers the viewport — and
   `.scene__art` is drawn at 2000 × 1575 units with its bottom at −150 units.
   So the band is always exactly below the edge, and the foreground grass
   (artwork y≈1150–1400) always lands 25–275 units above the bottom. The pens
   row sits at 20 units, which puts the animals' feet on that grass at 1440×900
   and 1920×1080 alike. The numbers live once, in `BACKDROP` in
   `GameScreen.tsx`, and reach CSS as custom properties.
-  **Sept 17** — A canvas of the zoo as shipped — the game screen on the
   backdrop, the six animals owned and as silhouettes, the four habitat pens —
   is saved as an Artifact ("Miscue Zoo"), every drawing lifted from
   `animals.tsx` by converting the JSX to SVG so it cannot drift from the app.
   Owned animals sway and blink on the canvas exactly as in the app. Working
   files in `design/zoo/`. The earlier "Miscue Game Screen" canvas predates the
   habitats and the backdrop and is now behind the app.
-  **Sept 17** — **A completion screen now sits between the game and the parent
   screen, and the parent screen never appears on its own.** The child is still
   holding the device and the parent screen names a reading difficulty, so a
   finished session lands in the child's own zoo — the zookeeper, the animals
   they earned, "Thanks for helping at the zoo today!" and "Come back soon and
   we'll fill it up some more." — and the parent screen is reached only by
   tapping **Show a grown-up**. `App` holds the gate; a test drives the real App
   through a whole session and asserts the parent screen is absent until that
   tap, and that "Play again" returns to a fresh game rather than to it.
-  **Sept 17** — **Nothing evaluative on the completion screen, and the test for
   it caught a real leak.** The empty pens carry "★ 3" price tags during play —
   the price beside the store is what makes stars legible — but on this screen
   there is nothing to buy, and the tag was the only number left. `Scene` took a
   `prices` flag; the completion screen turns it off, so an unbought pen shows
   just its silhouette. The screen reads identically to a child who got
   everything right and one who got everything wrong: no score, no count, no
   "great job", no wallet, no store. (The old "Great job!" done panel was
   evaluative and is gone.)
-  **Sept 17** — The completion screen joined the "Miscue Zoo" canvas as its own
   artboard, with the note explaining the gate.
-  **Sept 14 — archive.** The original section 8 as it stood before becoming a
   mirror, kept verbatim because the per-distractor reasoning notes on seeds 1-3
   exist nowhere else. Historical: seed 1's `boy` has since been replaced by
   `gone`, and parent advice has moved onto distractors.

      ## 8. Teacher-authored source content

      Authoritative. Do not paraphrase, do not "improve", do not invent more.

      ### Seed item 1

      Question: Which word has the same vowel sound as **boat**?
      Options: bot, boy, toe. Correct: **toe** (vowel team `oe` says long o).

      -  `bot` → closed-syllable. Has not mastered that a vowel followed by at least one
         consonant says its short sound.
      -  `boy` → vowel-team-assumed. Learned "two vowels, first does the talking" and
         applies it everywhere. Needs to memorize that `oy` says /oy/.

      ### Seed item 2

      Question: Which word has the same vowel sound as **bread**?
      Options: free, ten, steak. Correct: **ten**.

      -  `free` → vowel-team-assumed. Thinks `ee` says short e because the letter e is
         in it, rather than long e.
      -  `steak` → ea-three-sounds. Same vowel letters as the target, so the child
         letter-matches instead of decoding. `ea` makes three sounds and they must learn
         all three.

      ### Seed item 3

      Question: Which word has the same vowel sound as **rain**?
      Options: have, day, ran. Correct: **day**.

      -  `have` → irregular-word. Cannot be decoded. A child applying the silent-e rule
         picks this.
      -  `ran` → closed-syllable. Has not mastered short versus long vowel conditions.

      ### Misconceptions identified so far

      | id                   | short description                                       |
      | -------------------- | ------------------------------------------------------- |
      | `closed-syllable`    | defaults to short vowel; has not mastered the condition |
      | `vowel-team-assumed` | assumes a vowel team's sound from its letters           |
      | `ea-three-sounds`    | does not know `ea` makes three different sounds         |
      | `irregular-word`     | has not memorized a word that cannot be decoded         |

      Parent advice is transcribed verbatim from her writing and, since Sept 14, lives
      on each distractor in `items.json` rather than once per misconception (section
      4). Until the data is migrated, her transcribed advice still sits in
      `misconceptions.json`. It is longer than typical UI copy on purpose. Show the
      first line and let the parent expand.

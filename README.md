# Miscue

A reading diagnostic for early readers, grades 1 through 3.

Miscue started from watching a close friend work. She teaches early reading,
and what stood out was not that she could tell which children were behind.
It was that she could tell exactly which rule each child was misapplying, and
she could only do it by sitting down next to one child at a time and
listening. This is an attempt to carry that specificity to families who will
never get that hour.

Not a general-purpose learning tool. Miscue does one thing: it plays a short
phonics game with a child, watches which specific reading rules they get
wrong, and tells a parent which one in plain language, with a home activity
to match.

## The gap

A wrong answer is not just wrong. It is evidence.

A child who reads "boat" and picks "bot" is not guessing at random. They are
applying a real phonics rule, closed syllables, to a word that breaks it.
That is a specific, nameable, fixable pattern.

Finding that pattern normally takes a reading teacher sitting beside one
child at a time, listening. It does not scale, so most parents hear nothing
more specific than "needs to work on reading." Most reading apps do not
close that gap either. They report a score, and a score tells a parent how
their child is doing without telling them what to do about it.

Miscue reports the pattern instead of the score.

The content behind that pattern is not generated. A practicing reading
teacher wrote the questions, the wrong answers, and the reasoning behind each
one. An AI model was used to expand those seed questions into more candidates
in the same shape, and every candidate was checked by a mechanical validator
before any person saw it. The validator caught zero problems in thirty
generated questions. The teacher, reviewing the same thirty, rejected ten.
Seven of those she revised on her own instructions and kept; three she
discarded outright, leaving twenty-seven in the bank. Every one of the ten was
structurally perfect and pedagogically wrong in a way no rule could have
caught. That gap is the
argument for this product: the model can propose an item, it cannot propose
pedagogy.

## Who this is for

**The child** plays a short game, about five minutes, and is never told
whether they got an answer right. That is deliberate: the moment a child
knows they are being scored, they start guessing safe, and the app stops
learning anything true about how they actually read.

**The parent** gets a different screen entirely. Not a score. A sentence
naming the specific pattern their child is running, in plain language, with
one five-minute activity to try at home. If nothing confirms, the app says so
plainly and treats that as a real result, not a failure.

**The teacher** is the actual source of the product. Every question, every
wrong answer, and every home activity in this bank was written by a
practicing reading teacher, based on misconceptions diagnosed in a real
classroom. The app's job is to carry that expertise to more families than one
teacher could ever sit down with individually, not to replace the teacher's
judgment.

## How the content was built

The teacher wrote a small set of seed questions by hand, each with a
specific misconception assigned to every wrong answer and a home activity to
match. An AI model used those seeds to generate additional candidates in the
same shape, gated by the validator described above.

What the teacher's ten rejections actually caught: questions retesting the
same word twice, and one question built around a vowel combination that does
not occur that way in English. None of those are things a mechanical rule can check for.

Every activity a parent sees in this app is the teacher's own words,
verbatim. Never generated.

## What it deliberately does not do

-  No score
-  No timer
-  No streak
-  No red X, no verdict of any kind

The child is never told whether an answer was correct, at any point, on any
screen. This is not a missing feature. It is the condition the diagnosis
depends on: the moment a child knows they are being scored, they start
guessing safe, and the app stops learning anything true about how they
actually read.

## Stack

React, TypeScript, Vite. No backend, no database. Everything runs static and
client-side; the diagnostic engine is plain TypeScript with no framework
dependency, tested independently of the UI. Content generation is a
standalone Node script that calls the Anthropic API offline, never at
runtime.

## Getting started

Requires Node 24.x, pinned in `.nvmrc` and enforced by `.npmrc`
(`engine-strict=true`). If you hit `ERR_REQUIRE_ESM` in the test runner,
you're almost certainly on the wrong Node version, not a broken config.

```bash
nvm use
npm install
npm run dev
```

Runs at `http://localhost:5173`.

## Scripts

| Command             | What it does                                                                                                                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`       | Local dev server                                                                                                                                                                 |
| `npm run build`     | Production build                                                                                                                                                                 |
| `npm run preview`   | Serves the production build locally                                                                                                                                                                 |
| `npm test`          | Full test suite (Vitest)                                                                                                                                                         |
| `npm run typecheck` | `tsc --noEmit`                                                                                                                                                                   |
| `npm run simulate`  | Headless engine simulation, drives fake sessions through the diagnostic logic with no UI, prints confirmation rates per misconception                                            |
| `npm run generate`  | Calls the Anthropic API to expand seed items into new candidates. Requires `ANTHROPIC_API_KEY` in `.env`. Never run at build time or runtime, only when growing the content bank |
| `npm run review`    | Rebuilds the human-review log from recorded approve/reject decisions                                                                                                             |

## Environment

Create a `.env` at the repo root and set `ANTHROPIC_API_KEY` if you intend to
run `npm run generate`. Not required to run, build, or test the app itself.
`.env` is gitignored; never commit a key.

## Project structure

```
src/
  data/
    items.json            the live question bank
    misconceptions.json   the five misconceptions: labels, strengths, teacher notes
  engine/
    validate.ts           the rules an item must pass before entering the bank
    diagnose.ts           turns a session's answers into a confirmed / suspected / ruled-out finding
    select.ts             adaptive item selection for a session
  components/
    GameScreen.tsx         the child-facing game
    CompletionScreen.tsx   the handoff between child and parent
    ParentScreen.tsx        the parent-facing finding
scripts/
  generate.ts              offline content generation, gated by validate.ts
  review.ts                records the teacher's approve/reject decisions
  candidates.json          generated items pending human review
  rejection-log.json       machine and human rejection history
public/
  audio/                   recorded question audio, named by target word (q-boat.m4a)
Claude.md                  the locked product and data spec
Design.md                  the visual and interaction spec
Tasks.md                   build log and decisions log
```

`Claude.md` and `Design.md` are the actual source of truth for behavior and
layout decisions; this README is an orientation, not the spec.

## Testing

```bash
npm test
```

237 tests as of this build, covering the validator, the diagnosis engine,
adaptive selection, and component behavior. The engine is mutation-tested:
several tasks in the build log record the exact mutation applied and confirm
it turned a test red, not just that a test existed.

`npm run simulate` is a separate, faster sanity check: it runs the real
engine against many synthetic answer patterns with no UI and no test
framework, and is what caught the arithmetic problems in the confirmation
thresholds during development.

## Forking and extending

The content bank is the part most worth extending. To add a new
misconception:

1. Add it to `misconceptions.json` with a deficit label, a strength label,
   and, for the sight-word track, any non-deficit variant needed.
2. Write at least one seed item by hand in `items.json` using it, following
   the validator rules in `Claude.md` section 5.
3. Optionally run `npm run generate` to expand it, then `npm run review` to
   record a human review pass before anything generated enters the bank.
4. Run `npm run simulate` to confirm the new misconception can actually be
   confirmed under the current session length and thresholds before shipping
   it. An item that exists but can never mathematically reach the
   confirmation threshold is a real failure mode this project hit twice.

The generation script is intentionally decoupled from the app. It writes to
`scripts/candidates.json`, never directly to `items.json`. Nothing generated
reaches a child without passing through `validate.ts` and a recorded human
decision.

## What's next

**Close the gap the teacher's rejections exposed.** Five of the ten rejections
were the same class of problem: a word reused as a target or a distractor
somewhere else in the bank. `validateBank` already does bank-level checks —
misconception existence, per-track item counts, unreplaced inherited advice —
but it has no word-uniqueness rule. Adding one would have caught all five
automatically and is the single highest-value fix here.

**Fix the misconception-forcing bias in generation.** Each generation batch
names the misconception it is generating for, which means the model will
sometimes attach that label to a distractor that genuinely demonstrates a
different one. Generating without naming a target misconception, then
classifying afterward, would let the model say "none of these" instead of
forcing a fit.

**Give the sight-word track more margin.** It currently confirms only when a
child misses every sight-word item in the session, because each item carries
two wrong spellings and each pick is therefore worth half. That threshold is
deliberately strict to keep a random tapper off the parent screen, but it
means near-misses report nothing. More sight-word items per session, or a
single-distractor format, would buy headroom without lowering the bar.

**Add a practice round.** Two or three items with real feedback before the
scored session begins, so a child learns what the game is asking without
contaminating the measurement. This is how DIBELS and Acadience handle the
same problem, and it addresses the one fair objection to a no-feedback
design.

**Make evidence compound across sessions.** Right now every session starts
from zero. Persisting results would let a pattern that is only suspected
after one session confirm across three, which is closer to how a teacher
actually forms a judgment, and would make short sessions far more useful.

**Give the teacher a way to author without touching JSON.** Every item in
this bank reached the file through a developer. A simple authoring interface
would remove that bottleneck entirely and is what would turn this from a
project with one teacher's content into something other teachers can fill.

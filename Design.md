# DESIGN.md — Miscue visual and interaction spec

Companion to CLAUDE.md. CLAUDE.md governs behaviour and data; this governs
what the screens look like and how they feel. Where the two disagree,
CLAUDE.md wins.

Desktop web, full viewport. Not a centered column.

---

## 1. The governing idea

The screen is a **place**, not a document. The child is standing in their zoo,
answering questions, and the zoo fills up as they play.

This is how ABCmouse, Prodigy, Starfall and Khan Academy Kids structure a
full-screen children's game: an illustrated environment fills the viewport and
the interface floats on top of it. The current build is a centered form on a
cream background, which is the problem this document exists to fix.

The consequence worth understanding: an empty zoo is not empty space. It reads
as "there is something for me to do here." The same pixels that currently look
bland become the motivation once they belong to the scene.

---

## 2. Layout

Full viewport, landscape, no scrolling.

```
┌──────────────────────────────────────────────────────────┐
│  zookeeper                              ★ 7   [ store ]  │  ← thin chrome
│                                                           │
│                    ( zoo scene fills                      │
│                      the whole viewport )                 │
│                                                           │
│        ┌───────────────────────────────────────┐          │
│        │  🔊  Which word has the same vowel     │          │
│        │      sound as **boat**?                │          │
│        │                                        │          │
│        │   ┌────────┐ ┌────────┐ ┌────────┐     │          │  ← floating panel
│        │   │  toe   │ │  gone  │ │  bot   │     │          │
│        │   └────────┘ └────────┘ └────────┘     │          │
│        └───────────────────────────────────────┘          │
│                                                           │
│   [ empty enclosure ]  [ lion ]  [ empty enclosure ]      │  ← earned animals
└──────────────────────────────────────────────────────────┘
```

-  **Zoo scene**: full-bleed SVG background. Sky, ground, enclosures. Animals the
   child has bought stand in their enclosures. Unbought animals are empty pens,
   or faint silhouettes.
-  **Question panel**: floats lower-center, roughly 60 to 70% of viewport width.
   Translucent or solid with a soft shadow. The scene dims slightly behind it so
   focus is unambiguous.
-  **Chrome**: zookeeper top-left, star count and store top-right. The star count
   sits next to the store deliberately, so the child understands what stars are
   for without being told.

---

## 3. The question panel

-  **Speaker button first**, at the start of the question line, so the child
   learns to tap it to hear the question. Minimum 60px. Pulses gently on load.
-  **Question text** at roughly 26px, with the target word bold but sized in
   line with the sentence, not towering over it.
-  **Three word cards** in a row, each minimum 60px tall (76px is better for this
   age), spaced at least 16px apart, word text roughly 32px.
-  Auto-play the question stem on load. Replay on every tap of the speaker, with
   a clean restart rather than overlapping audio. Never rate-limit replays.
-  **Options are never read aloud.** Reading them removes the decoding task.

---

## 4. Motion and feedback

The hard constraint: the child is never told whether they were right. There is
no correct state and no incorrect state to design.

-  On tap: a **neutral highlight**, identical for every option, held ~600ms, then
   auto-advance. No next button.
-  The highlight color must not read as a verdict. Not green, not red. A soft
   gold or sky blue.
-  **All delight lives in the reward layer, not the answer.** A star flies from
   the tapped card to the star counter on every tap. Animals walk into their
   enclosures when bought. Those can be as joyful as you like, because none of it
   is tied to being right.
-  Transition sounds are fine. Verdict sounds are not. No ding, no buzz.

---

## 5. The star and zoo economy

-  One star per question, regardless of correctness. Effort, not performance.
-  Star count is always visible, next to the store.
-  A progress line reads "3 more stars → zebra," with the zebra shown as a
   silhouette that fills in as stars accumulate.
-  Buying an animal is the celebration moment. Animate it into the scene.
-  The zoo is never a separate screen. It is the background.

---

## 6. Typography

-  **Andika**, from Google Fonts. Single-storey `a` and `g`, which is the
   letterform children are taught. This is a correctness requirement in a reading
   app, not a style choice.
-  Word cards ~32px. Question ~26px. Generous letter spacing. No all caps.
-  Never put an instruction in text the child may not be able to read. Audio and
   the zookeeper carry instructions.

---

## 7. Color

-  Warm, saturated scene. Reserve the most saturated color for interactive
   elements so the eye lands on the word cards.
-  Avoid neon and maximum saturation across large areas.
-  Accent palette from Okabe-Ito, which is colorblind-safe: orange `#E69F00`,
   sky blue `#56B4E9`, bluish green `#009E73`, blue `#0072B2`, vermillion
   `#D55E00`, reddish purple `#CC79A7`, yellow `#F0E442`.
-  Minimum 4.5:1 contrast for text, and aim for 7:1 on the word cards, since
   decoding them is the actual task.
-  Never encode meaning in color alone.

---

## 8. Practice round

Before the scored session, run **two or three practice items where feedback IS
given**. The child sees whether they were right, so they learn what the game is.

Then the real session starts, silently, and nothing after that point ever
signals correctness.

This is how DIBELS and Acadience handle the same problem. Practice items are not
scored, so teaching there costs nothing, and it solves the objection that a
child can't tell what the game wants.

Practice items must be visibly separate from the session. The zookeeper can
introduce them.

---

## 9. Interaction rules

-  Click and tap only. No dragging, no scrolling, no complex gestures.
-  One idea per screen. The child sees the question, three choices, the speaker,
   the star, the zoo. Nothing else.
-  Exactly three choices, always.
-  Every interactive element at least 60px, spaced at least 16px.

---

## 10. The parent screen

Different reader, different job. An adult, probably on a phone, reading once,
quickly, and then deciding whether to do something tonight.

Calm, not playful. Same palette, no zoo, no zookeeper, no motion.

### 10.1 What it is not

No score. No percentage. No number correct. No grade level, no percentile, no
progress chart, no streak. This is deliberate and it is the main design
decision on this screen.

The reason is not modesty. Parents systematically misread the numbers that
education products give them. Grade-equivalent scores are misinterpreted by
most parents who see them, percentiles get read as percentage correct, and
surveys repeatedly find that the large majority of parents believe their child
is on grade level when far fewer actually are. A number invites a wrong
conclusion and gives the parent nothing to do. A named pattern plus one action
does the opposite.

### 10.2 Order on the screen

1. **Framing line.** One warm, plain, non-numeric sentence. What this is and
   how long the child played.
2. **One strength.** Before the finding, not after. A parent needs a moment of
   safety before a concern, or they read the rest defensively.
3. **The finding.** The misconception's deficit label as the headline, in the
   teacher's words. Not buried, not softened into vagueness.
4. **The evidence.** One or two lines quoting the child's actual choices and
   how often. This is what makes the finding credible.
5. **The activity.** The last thing on the screen, because it is what the
   parent should be left holding.
6. **Any remaining strengths**, below the activity, quieter.

The sequencing matters and it is not arbitrary. Opening with a concern makes
parents defensive; burying it in the middle of praise means they miss it; and
ending on the concern leaves them with worry rather than an action. Strength,
then concern, then action.

### 10.3 Wording a finding

The headline is the teacher's deficit label, verbatim. Do not rewrite it to be
gentler, and do not rewrite it to be blunter.

What the label describes is a specific, improvable skill, not a category of
child. That distinction is doing real work: research on diagnostic labels
consistently finds that categorical labels lower adult expectations of the
child, while specific skill descriptions increase the adult's intention to
help. The labels were written that way on purpose.

### 10.4 Evidence

Quote what the child actually did. "Chose him for pie, got for snow and bot for
boat, 3 of the 4 words where it could come up."

Real words, real counts. This is what separates a diagnosis from a guess, and
it is what stops the parent asking how the app could possibly know.

### 10.5 The activity

Exactly one. Never a list, never a menu, no matter how many findings there are.

More options do not help a parent act, and usually reduce the chance they do
anything at all. Every literacy intervention that has moved parent behavior at
scale did it by asking for one small thing at a time.

-  The teacher's text, verbatim.
-  Name the time: "About 5 minutes."
-  Readable without expanding. If layout forces a choice, the activity stays
   visible and something else collapses.

### 10.6 Strengths

Positively worded, using `strengthLabel`, which is the teacher's text.

A strength here means the child repeatedly avoided a trap, not that they scored
well. Frame it as what they are not getting caught by.

### 10.7 The irregular track

Its own headline, from `forParent()`, in the teacher's words: "Your child needs
to practice learning irregular words."

It is deliberately not phrased as a problem, because sight words are a
memorization gap rather than a misapplied rule. Do not restyle it into a
deficit finding, do not put it under the same heading as the misconceptions,
and do not add a severity indicator to it.

### 10.8 The null state

When nothing is confirmed, say so plainly and warmly. This is a real outcome,
not an error, and it must look intentional.

Two failure modes to avoid. It should not read as a clean bill of health, since
a short session cannot rule much out. And it should not read as the product
failing to work.

Something like: no one pattern came up often enough to name, which is common in
a short session, and playing again on another day gives a clearer picture.

### 10.9 Visual

-  Strength and finding must be distinguishable without color. Icon plus text
   label, never a green dot against a blue dot.
-  Colorblind-safe throughout, since strengths and findings appear together.
-  Short sentences. Plain words. Written to be skimmed once.
-  No charts. No numbers anywhere on the screen.

## 11. What not to do

-  No score, no timer, no percentage, no streak counter.
-  No red X, no green check, no verdict of any kind after practice ends.
-  No leaderboard, no comparison to other children.
-  No text instruction the child has to decode.
-  No centered narrow column on a plain background.

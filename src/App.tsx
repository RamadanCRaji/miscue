import { useMemo, useState } from "react";
import { GameScreen } from "./components/GameScreen.tsx";
import { CompletionScreen } from "./components/CompletionScreen.tsx";
import { ParentScreen } from "./components/ParentScreen.tsx";
import { diagnose, forParent } from "./engine/diagnose.ts";
import type { Answer } from "./engine/diagnose.ts";
import type { Item, Misconception } from "./types.ts";
import itemBank from "./data/items.json";
import misconceptionData from "./data/misconceptions.json";

/**
 * The child plays, then the parent reads.
 *
 * The diagnosis is computed here and nowhere else, and it goes through
 * `forParent()` — the only path to the parent screen, which is what keeps a
 * merely *suspected* pattern off it.
 */
const BANK = itemBank as unknown as Item[];
const MISCONCEPTIONS = misconceptionData as Misconception[];

/* -- demo mode ------------------------------------------------------------- */
/*
 * The Sept 17 recording needs the same twelve items every run, so the clips can
 * be recorded against a known list.
 *
 * A fixed RNG seed is NOT enough on its own: selection is adaptive, so only the
 * four coverage-phase items are answer-independent and everything after item 4
 * moves with how the child answers. Across four answer patterns on one seed, 18
 * different items turned up. So the demo pins BOTH:
 *
 *   DEMO_ITEM_IDS   the twelve-item bank — the set is then fixed whatever the
 *                   child does, because twelve items fill twelve slots
 *   DEMO_SEED       the draw, so the ORDER is fixed too for a given answer
 *                   pattern
 *
 * The twelve are her five decodable seeds, all four irregular seeds, and three
 * reviewed items covering what her seeds under-cover. Verified: every answer
 * pattern deals all twelve, no misconception exceeds the half-session cap, and
 * both demo findings stay reachable — closed-syllable confirms, and so does the
 * irregular track.
 *
 * `?demo=off` restores the full 36-item bank and a random draw. **After the
 * submission, make that the default again**: a fixed order is right for a
 * recording and wrong for a child, who should not get the same twelve twice.
 */
export const DEMO_SEED = 7;

export const DEMO_ITEM_IDS = [
   "seed-boat",
   "seed-bread",
   "seed-rain",
   "seed-pie",
   "seed-snow",
   "gen-sweat-1",
   "gen-chief-1",
   "gen-moon-1",
   "seed-what",
   "seed-who",
   "seed-the",
   "seed-because",
];

export function demoBank(): Item[] {
   return DEMO_ITEM_IDS.map((id) => {
      const item = BANK.find((i) => i.id === id);
      if (!item) throw new Error(`demo bank: no item "${id}" in items.json`);
      return item;
   });
}

/** Same generator the engine's tests use, so a pinned run is reproducible. */
function seeded(seed: number): () => number {
   let state = seed >>> 0;
   return () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
   };
}

function demoOff(): boolean {
   if (typeof window === "undefined") return false;
   return new URLSearchParams(window.location.search).get("demo") === "off";
}

type Finished = { answers: Answer[]; elapsedMs: number };

export function App() {
   const [finished, setFinished] = useState<Finished | null>(null);
   /**
    * The parent screen never appears on its own. A finished session lands on
    * the completion screen, and only "Show a grown-up" flips this — the child
    * is still holding the device, and the parent screen names a difficulty.
    */
   const [showParent, setShowParent] = useState(false);
   const [round, setRound] = useState(0);

   const pinned = !demoOff();
   const bank = useMemo(() => (pinned ? demoBank() : BANK), [pinned]);
   /* A fresh generator per round: reusing one would let round 2 continue the
      stream and deal a different order. */
   const random = useMemo(
      () => (pinned ? seeded(DEMO_SEED) : undefined),
      [pinned, round]
   );

   if (finished && !showParent) {
      return (
         <CompletionScreen
            itemsAnswered={finished.answers.length}
            onShowGrownUp={() => setShowParent(true)}
         />
      );
   }

   if (finished) {
      return (
         <ParentScreen
            report={forParent(diagnose(finished.answers), MISCONCEPTIONS)}
            elapsedMs={finished.elapsedMs}
            onPlayAgain={() => {
               setFinished(null);
               setShowParent(false);
               setRound((n) => n + 1);
            }}
         />
      );
   }

   return (
      <GameScreen
         key={round}
         bank={bank}
         misconceptions={MISCONCEPTIONS}
         random={random}
         onComplete={(answers, elapsedMs) => setFinished({ answers, elapsedMs })}
      />
   );
}

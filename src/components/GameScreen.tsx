import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Answer } from "../engine/diagnose.ts";
import { createNarrator, displayedStem } from "../question.ts";
import type { NarratorDeps } from "../question.ts";
import type { Item, Misconception } from "../types.ts";
import { ANIMALS, AnimalFigure, HABITATS, PenFence, PenGround, Star, StoreIcon, Zookeeper } from "./animals.tsx";
import {
   REVEAL_MS,
   STARS_PER_ANIMAL,
   advance,
   animalsEarned,
   pick,
   startSession,
   stars,
} from "./session.ts";

/**
 * The child's screen. CLAUDE.md sections 7 and 9 for behaviour, DESIGN.md for
 * how it looks and feels. **Where the two touch, CLAUDE.md wins** — which is
 * why DESIGN.md section 8's practice round, where feedback IS given, is not
 * built here: section 9 says the child is never told whether they were right.
 *
 * The governing idea (DESIGN.md section 1): the screen is a PLACE, not a
 * document. The zoo fills the viewport and the question floats on top of it. An
 * empty pen is not empty space — it is the reason to answer the next question.
 *
 * What is deliberately absent, and must stay absent: score, timer, red X,
 * streak, and any signal at all of whether an answer was right. A tap gets the
 * same neutral gold either way, a ~600ms pause, and the next item. All the
 * delight lives in the reward layer — the star flying to the counter, the animal
 * walking into its pen — because none of that is tied to being right.
 */

/** Section 9's floor, and DESIGN.md's: every interactive element clears it. */
export const MIN_TAP_TARGET_PX = 60;

/** DESIGN.md section 3: 60 is the floor, 76 is better for this age. */
export const CARD_MIN_HEIGHT_PX = 76;

/** How many pens the zoo shows. Four is a full session at 3 stars each. */
const PENS = 4;

/**
 * The painted backdrop, and the geometry the pens need to stand on its ground.
 *
 * `height` is the artwork proper. The file is `fileHeight` tall: its bottom
 * 150px is a watermark band from the stock preview, and the scene is laid out so
 * that band always sits below the viewport, whatever the aspect ratio. Sized in
 * CSS from these numbers — see `.scene__art` — so the crop is exact rather than
 * `cover`'s guess, and the foreground grass lands where the animals' feet are.
 */
export const BACKDROP = {
   src: "/zoo-entrance-vector.avif",
   width: 2000,
   height: 1425,
   fileHeight: 1575,
};

export type GameScreenProps = {
   bank: Item[];
   /** Selection needs these: the half-session cap reads each one's own track. */
   misconceptions: Misconception[];
   /**
    * Handed the recorded picks, in `diagnose()`'s shape, and how long the child
    * was actually answering — timed from the Start tap, not from mount, so a
    * tablet left sitting on the table does not turn into a long session.
    */
   onComplete: (answers: Answer[], elapsedMs: number) => void;
   /** Injected in tests. Defaults to the real clip-then-speech narrator. */
   narratorDeps?: NarratorDeps;
   random?: () => number;
};

type Flight = { key: number; dx: number; dy: number };

export function GameScreen({ bank, misconceptions, onComplete, narratorDeps, random }: GameScreenProps) {
   const rng = useMemo(() => random ?? Math.random, [random]);
   const narrator = useMemo(() => createNarrator(narratorDeps), [narratorDeps]);

   const [state, setState] = useState(() => startSession(bank, misconceptions, rng));
   /**
    * Audio cannot start before a gesture in mobile Safari or Chrome, and on the
    * irregular track the spoken stem *is* the question. So the session waits
    * behind one big tap, which doubles as a calm way in.
    */
   const [started, setStarted] = useState(false);
   const [flight, setFlight] = useState<Flight | null>(null);

   const completed = useRef(false);
   const startedAt = useRef<number | null>(null);
   const counterRef = useRef<HTMLSpanElement>(null);
   const currentItem = state.current?.item ?? null;

   // Ask on arrival, and only when the item changes — not on every render, or a
   // child would hear the question restart under their finger.
   useEffect(() => {
      if (!started || !currentItem) return;
      narrator.ask(currentItem);
      return () => narrator.stop();
   }, [started, currentItem, narrator]);

   useEffect(() => {
      if (state.phase !== "revealing") return;
      const timer = setTimeout(() => setState((s) => advance(s, rng)), REVEAL_MS);
      return () => clearTimeout(timer);
   }, [state.phase, state.answers.length, rng]);

   useEffect(() => {
      if (state.phase !== "done" || completed.current) return;
      completed.current = true;
      narrator.stop();
      onComplete(state.answers, startedAt.current ? Date.now() - startedAt.current : 0);
   }, [state.phase, state.answers, onComplete, narrator]);

   /**
    * A star leaves the card the child tapped and flies to the counter — on
    * EVERY tap, which is the point: the reward is for answering.
    */
   const onPick = useCallback((word: string, card: HTMLElement) => {
      // Unconditional: the star flies on EVERY tap, because the reward is for
      // answering. Where the layout cannot be measured the delta is zero and it
      // simply fades in place — degraded, never skipped.
      const from = card.getBoundingClientRect();
      const to = counterRef.current?.getBoundingClientRect();
      setFlight({
         key: Date.now(),
         dx: to ? to.left + to.width / 2 - (from.left + from.width / 2) : 0,
         dy: to ? to.top + to.height / 2 - (from.top + from.height / 2) : 0,
      });
      setState((s) => pick(s, word));
   }, []);

   const earned = animalsEarned(state);
   const starCount = stars(state);
   const starsToNext = STARS_PER_ANIMAL - (starCount % STARS_PER_ANIMAL);
   const nextAnimal = ANIMALS[Math.min(earned, ANIMALS.length - 1)]!;

   if (!started) {
      return (
         <main className="screen screen--start">
            <Scene earned={0} />
            <section className="panel panel--start">
               <Zookeeper size={168} />
               <p className="start-line">
                  Your zoo is empty.
                  <br />
                  Answer questions to fill it up.
               </p>
               <button
                  type="button"
                  className="start-button"
                  style={{ minHeight: 92 }}
                  onClick={() => {
                     startedAt.current = Date.now();
                     setStarted(true);
                  }}
               >
                  Start
               </button>
            </section>
         </main>
      );
   }

   return (
      <main className="screen">
         <Scene earned={earned} />

         <header className="chrome">
            <div className="keeper">
               <Zookeeper size={76} />
            </div>
            <Wallet
               count={starCount}
               starsToNext={starsToNext}
               next={nextAnimal}
               progress={(STARS_PER_ANIMAL - starsToNext) / STARS_PER_ANIMAL}
               counterRef={counterRef}
            />
         </header>

         {state.current ? (
            <section className="panel" aria-live="polite">
               <div className="ask">
                  <button
                     type="button"
                     className="replay"
                     style={{ minHeight: MIN_TAP_TARGET_PX, minWidth: MIN_TAP_TARGET_PX }}
                     onClick={() => narrator.ask(state.current!.item)}
                     aria-label="Say it again"
                  >
                     <SpeakerIcon />
                  </button>
                  <Stem item={state.current.item} />
               </div>

               <ul className="options">
                  {state.current.options.map((option) => (
                     <li key={option.word}>
                        <button
                           type="button"
                           /* One class for every option, tapped or not. A second
                              class keyed on `correct` would be the red X in
                              disguise, and would leak the answer to anyone
                              reading the DOM. */
                           className={`option${state.picked === option.word ? " option--tapped" : ""}`}
                           style={{ minHeight: CARD_MIN_HEIGHT_PX }}
                           disabled={state.phase !== "asking"}
                           onClick={(event) => onPick(option.word, event.currentTarget)}
                        >
                           {option.word}
                        </button>
                     </li>
                  ))}
               </ul>
            </section>
         ) : (
            <section className="panel panel--done">
               <p className="start-line">All done!</p>
            </section>
         )}

         {flight && (
            <span
               key={flight.key}
               className="star-flight"
               aria-hidden="true"
               style={{ "--dx": `${flight.dx}px`, "--dy": `${flight.dy}px` } as React.CSSProperties}
               onAnimationEnd={() => setFlight(null)}
            >
               <Star filled size={46} />
            </span>
         )}
      </main>
   );
}

/**
 * The zoo, full-bleed. Bought animals stand in their pens; the rest are faint
 * silhouettes of the animal that goes there.
 *
 * The scrim is what makes the floating panel unambiguous (DESIGN.md section 2).
 */
/**
 * `prices`: whether an empty pen shows what it costs. On during play — the price
 * beside the store is what makes stars legible — and off on the completion
 * screen, where there is nothing to buy and a number would be the only thing
 * on the screen that could be read as a count.
 */
export function Scene({ earned, prices = true }: { earned: number; prices?: boolean }) {
   return (
      <div
         className="scene"
         aria-label={`Your zoo: ${earned} animals`}
         style={
            {
               "--art-w": BACKDROP.width,
               "--art-h": BACKDROP.height,
               "--art-file-h": BACKDROP.fileHeight,
            } as React.CSSProperties
         }
      >
         <div
            className="scene__art"
            style={{ backgroundImage: `url(${BACKDROP.src})` }}
            aria-hidden="true"
         />
         <div className="scene__pens">
            {ANIMALS.slice(0, PENS).map((animal, i) => {
               const bought = i < earned;
               const habitat = HABITATS[animal.id];
               return (
                  <div
                     className={`pen${bought ? " pen--filled" : ""}`}
                     data-habitat={habitat}
                     key={animal.id}
                  >
                     <PenGround kind={habitat} />
                     <div className="pen__yard">
                        <AnimalFigure kind={animal.id} size={bought ? 220 : 170} ghost={!bought} />
                     </div>
                     <PenFence kind={habitat} />
                     {(bought || prices) && (
                        <span className="pen__sign">
                           {bought ? animal.name : <>★ {STARS_PER_ANIMAL}</>}
                        </span>
                     )}
                  </div>
               );
            })}
         </div>
         <div className="scene__scrim" aria-hidden="true" />
      </div>
   );
}

/**
 * Stars and the store, side by side, so a child who cannot read the label still
 * learns what stars are for (DESIGN.md sections 2 and 5).
 *
 * The count IS section 9's progress indicator: one star per item answered, so
 * the number is the child's position in the session. It is not a score — it
 * never goes down and never depends on being right.
 */
function Wallet({
   count,
   starsToNext,
   next,
   progress,
   counterRef,
}: {
   count: number;
   starsToNext: number;
   next: (typeof ANIMALS)[number];
   progress: number;
   counterRef: React.RefObject<HTMLSpanElement | null>;
}) {
   const clipId = "wallet-fill";
   return (
      <div className="wallet">
         <span className="wallet__stars" ref={counterRef}>
            <Star filled size={38} />
            <span className="wallet__count">{count}</span>
         </span>

         <span className="wallet__rule" aria-hidden="true" />

         {/* Visible, never interactive: no handlers, not focusable. */}
         <div className="store" aria-hidden="true">
            <StoreIcon size={40} />
            <span className="store__next">
               <span className="store__need">
                  {starsToNext} more {starsToNext === 1 ? "star" : "stars"}
               </span>
               <span className="store__target">
                  <svg width="42" height="42" viewBox="0 0 64 64" aria-hidden="true">
                     <defs>
                        <clipPath id={clipId}>
                           <rect x="0" y={64 - 64 * progress} width="64" height={64 * progress} />
                        </clipPath>
                     </defs>
                     <g opacity="0.2">
                        <next.Draw size={64} title={next.name} />
                     </g>
                     <g clipPath={`url(#${clipId})`}>
                        <next.Draw size={64} title={next.name} />
                     </g>
                  </svg>
                  <span className="store__name">{next.name}</span>
               </span>
            </span>
         </div>
      </div>
   );
}

/**
 * The stem. On the irregular track the target is a blank: it is spoken and never
 * shown, because showing it would hand over the spelling being tested.
 */
function Stem({ item }: { item: Item }) {
   const { before, target, after } = displayedStem(item);
   return (
      <h1 className="stem">
         <span className="stem__lead">{before}</span>{" "}
         {target === null ? (
            <span className="stem__blank" aria-label="the spoken word" />
         ) : (
            <span className="stem__target">{target}</span>
         )}
         <span className="stem__tail">{after}</span>
      </h1>
   );
}

function SpeakerIcon() {
   return (
      <svg width="40" height="40" viewBox="0 0 24 24" aria-hidden="true">
         <path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z" fill="#FFFDF6" />
         <path
            d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"
            stroke="#FFFDF6"
            strokeWidth="1.9"
            fill="none"
            strokeLinecap="round"
         />
      </svg>
   );
}

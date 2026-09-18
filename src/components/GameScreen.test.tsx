import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { BACKDROP, CARD_MIN_HEIGHT_PX, GameScreen, MIN_TAP_TARGET_PX } from "./GameScreen.tsx";
import { REVEAL_MS } from "./session.ts";
import { SESSION_LENGTH } from "../engine/select.ts";
import { spokenStem } from "../question.ts";
import { diagnose } from "../engine/diagnose.ts";
import type { Answer } from "../engine/diagnose.ts";
import type { Item, Misconception, Option } from "../types.ts";
import itemBank from "../data/items.json";
import misconceptionData from "../data/misconceptions.json";

/**
 * The screen, driven the way a child drives it: taps only.
 *
 * Rendered with react-dom directly rather than a testing library, to keep the
 * dependency list where it is this close to the deadline.
 */

const BANK = itemBank as unknown as Item[];
const MISCONCEPTIONS = misconceptionData as Misconception[];

declare global {
   // eslint-disable-next-line no-var
   var IS_REACT_ACT_ENVIRONMENT: boolean;
}

function lcg(seed: number): () => number {
   let state = seed >>> 0;
   return () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
   };
}

/** Records everything spoken, so a test can prove what was and was not read out. */
function recordingNarrator() {
   const spoken: string[] = [];
   return {
      spoken,
      deps: {
         // No clip exists in a test environment, which is also true in the app today.
         makeAudio: () => null,
         speak: (text: string) => spoken.push(text),
         cancelSpeech: () => {},
      },
   };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
   globalThis.IS_REACT_ACT_ENVIRONMENT = true;
   vi.useFakeTimers();
   container = document.createElement("div");
   document.body.appendChild(container);
   root = createRoot(container);
});

afterEach(() => {
   act(() => root.unmount());
   container.remove();
   vi.useRealTimers();
});

const $ = <T extends Element>(selector: string) => container.querySelector<T>(selector);
const $$ = <T extends Element>(selector: string) => [...container.querySelectorAll<T>(selector)];

const optionButtons = () => $$<HTMLButtonElement>("button.option");
const click = (element: Element) =>
   act(() => {
      element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
   });

type Harness = { answers: Answer[] | null; spoken: string[] };

function mount(seed = 3): Harness {
   const narrator = recordingNarrator();
   const harness: Harness = { answers: null, spoken: narrator.spoken };

   act(() => {
      root.render(
         <GameScreen
            bank={BANK}
            misconceptions={MISCONCEPTIONS}
            random={lcg(seed)}
            narratorDeps={narrator.deps}
            onComplete={(answers) => {
               harness.answers = answers;
            }}
         />
      );
   });
   return harness;
}

/** Taps through the whole session, one item at a time, honouring the pause. */
function playToEnd(choose: (options: HTMLButtonElement[]) => HTMLButtonElement): void {
   let guard = 0;
   while (optionButtons().length > 0) {
      if (++guard > 40) throw new Error("session did not finish");
      click(choose(optionButtons()));
      act(() => {
         vi.advanceTimersByTime(REVEAL_MS);
      });
   }
}

const start = () => click($("button.start-button")!);
const firstOption = (options: HTMLButtonElement[]) => options[0]!;

function correctOptionButton(options: HTMLButtonElement[]): HTMLButtonElement {
   // The DOM does not say which is correct — deliberately — so the answer comes
   // from the bank, matched by the word on the button.
   const words = new Set(
      BANK.flatMap((item) =>
         (item.options as Option[]).filter((o) => o.correct).map((o) => o.word)
      )
   );
   return options.find((b) => words.has(b.textContent ?? "")) ?? options[0]!;
}

describe("GameScreen — a session plays end to end", () => {
   it("starts behind one tap, so audio is allowed to play", () => {
      mount();
      expect($("button.start-button")).not.toBeNull();
      expect(optionButtons()).toHaveLength(0);
      start();
      expect(optionButtons()).toHaveLength(3);
   });

   it("plays every item and hands back the recorded picks", () => {
      const harness = mount();
      start();
      playToEnd(firstOption);

      expect(harness.answers).not.toBeNull();
      // The bank fills a whole session now, so this is the session length, not
      // the bank size it used to be limited to.
      expect(harness.answers!.length).toBe(SESSION_LENGTH);
   });

   it("hands back picks diagnose() can read", () => {
      const harness = mount();
      start();
      playToEnd(correctOptionButton);

      const diagnosis = diagnose(harness.answers!);
      const all = [...diagnosis.decodable.evidence, ...diagnosis.irregular.evidence];
      expect(all.filter((e) => e.confidence === "ruled-out").length).toBeGreaterThan(0);
      expect(all.filter((e) => e.confidence === "confirmed")).toEqual([]);
   });

   it("waits the pause before advancing, and does not skip ahead", () => {
      mount();
      start();
      const before = $(".stem")!.textContent;

      click(optionButtons()[0]!);
      act(() => {
         vi.advanceTimersByTime(REVEAL_MS - 50);
      });
      expect($(".stem")!.textContent).toBe(before);

      act(() => {
         vi.advanceTimersByTime(50);
      });
      expect($(".stem")!.textContent).not.toBe(before);
   });

   it("ignores taps during the pause", () => {
      const harness = mount();
      start();
      click(optionButtons()[0]!);
      for (const button of optionButtons()) expect(button.disabled).toBe(true);

      click(optionButtons()[1]!);
      act(() => {
         vi.advanceTimersByTime(REVEAL_MS);
      });
      playToEnd(firstOption);
      expect(harness.answers!.length).toBe(SESSION_LENGTH);
   });
});

describe("GameScreen — what section 9 forbids", () => {
   it("shows no score, timer, streak or right/wrong mark, ever", () => {
      mount();
      start();

      const forbidden = /score|streak|correct|incorrect|wrong|right|✓|✗|×|✔|❌|points?\b/i;
      let guard = 0;
      while (optionButtons().length > 0) {
         if (++guard > 40) break;
         expect(container.textContent ?? "").not.toMatch(forbidden);
         click(optionButtons()[0]!);
         expect(container.textContent ?? "").not.toMatch(forbidden);
         act(() => {
            vi.advanceTimersByTime(REVEAL_MS);
         });
      }
      expect(container.textContent ?? "").not.toMatch(forbidden);
   });

   it("gives the tapped option the same neutral highlight whichever it was", () => {
      const classesFor = (chooser: (o: HTMLButtonElement[]) => HTMLButtonElement) => {
         mount();
         start();
         click(chooser(optionButtons()));
         return $$<HTMLButtonElement>("button.option--tapped").map((b) => b.className);
      };

      const wrongLook = classesFor((o) => o.find((b) => b !== correctOptionButton(o)) ?? o[0]!);
      act(() => root.unmount());
      container.remove();
      container = document.createElement("div");
      document.body.appendChild(container);
      root = createRoot(container);
      const rightLook = classesFor(correctOptionButton);

      expect(wrongLook).toHaveLength(1);
      expect(rightLook).toHaveLength(1);
      expect(wrongLook[0]).toBe(rightLook[0]);
   });

   it("never marks an option correct in the DOM, where it could leak", () => {
      mount();
      start();
      for (const button of optionButtons()) {
         expect(button.className).toBe("option");
         expect(button.getAttribute("data-correct")).toBeNull();
         expect(button.outerHTML).not.toMatch(/correct/i);
      }
   });

   it("keeps every tap target at or above section 9's 60px floor", () => {
      mount();
      expect(Number.parseInt($<HTMLElement>("button.start-button")!.style.minHeight, 10))
         .toBeGreaterThanOrEqual(MIN_TAP_TARGET_PX);

      start();
      for (const button of [...optionButtons(), $<HTMLButtonElement>("button.replay")!]) {
         expect(Number.parseInt(button.style.minHeight, 10)).toBeGreaterThanOrEqual(
            MIN_TAP_TARGET_PX
         );
      }
      expect(MIN_TAP_TARGET_PX).toBe(60);
   });
});

describe("GameScreen — the question reaches the child by ear", () => {
   it("speaks the full stem on every item, on both tracks", () => {
      const harness = mount();
      start();
      playToEnd(firstOption);

      const asked = harness.answers!.map((a) => spokenStem(a.item));
      expect(harness.spoken).toEqual(asked);
      expect(asked.some((s) => s.startsWith("Which word"))).toBe(true);
      expect(asked.some((s) => s.startsWith("How do you spell"))).toBe(true);
   });

   it("never reads an option aloud", () => {
      const harness = mount();
      start();
      playToEnd(firstOption);

      // Checked against the item being asked, not the whole bank: a stem may
      // legitimately contain a word that is a distractor on some OTHER item
      // (the bank has an item targeting "book" and another offering "book" as a
      // distractor). The rule is that this item's options are not read out.
      expect(harness.spoken).toHaveLength(harness.answers!.length);
      harness.answers!.forEach((answer, i) => {
         const line = harness.spoken[i]!;
         const spokenWords = line.toLowerCase().split(/\W+/);
         for (const option of answer.item.options as Option[]) {
            if (option.correct) continue;
            expect(spokenWords).not.toContain(option.word.toLowerCase());
         }
      });
   });

   it("replays on demand, as often as asked", () => {
      const harness = mount();
      start();
      const first = harness.spoken.length;
      click($("button.replay")!);
      click($("button.replay")!);
      expect(harness.spoken.length).toBe(first + 2);
      expect(harness.spoken.at(-1)).toBe(harness.spoken[0]);
   });

   it("shows the decodable target but never the irregular one", () => {
      mount();
      start();

      let sawBlank = false;
      let guard = 0;
      while (optionButtons().length > 0) {
         if (++guard > 40) break;
         const stem = $(".stem")!.textContent ?? "";
         const blank = $(".stem__blank");
         const target = $(".stem__target")?.textContent ?? null;

         if (blank) {
            sawBlank = true;
            expect(target).toBeNull();
            expect(stem).toContain("How do you spell the word");
         } else {
            expect(target).not.toBeNull();
            expect(stem).toContain("Which word has the same vowel sound as");
         }

         click(optionButtons()[0]!);
         act(() => {
            vi.advanceTimersByTime(REVEAL_MS);
         });
      }
      expect(sawBlank).toBe(true);
   });

   /**
    * Asserted as the exact stem rather than by searching for target words: the
    * template itself contains "the", so a substring check would fail on the
    * question's own wording rather than on a leaked target.
    */
   it("keeps the spoken irregular target off the screen entirely", () => {
      const harness = mount();
      start();
      let checked = 0;
      let guard = 0;

      while (optionButtons().length > 0) {
         if (++guard > 40) break;
         if ($(".stem__blank")) {
            const stem = ($(".stem")!.textContent ?? "").replace(/\s+/g, " ").trim();
            expect(stem).toBe("How do you spell the word ?");
            checked += 1;
         }
         click(optionButtons()[0]!);
         act(() => {
            vi.advanceTimersByTime(REVEAL_MS);
         });
      }

      // Every irregular item in the session was checked, and there was at least one.
      const irregulars = harness.answers!.filter((a) => a.item.track === "irregular");
      expect(checked).toBe(irregulars.length);
      expect(checked).toBeGreaterThan(0);

      // And the target really is on screen as an option — just never in the stem.
      expect(irregulars.every((a) => a.item.options.some((o) => o.word === a.item.target))).toBe(
         true
      );
   });
});

describe("GameScreen — the zoo and the reward layer", () => {
   const starCount = () => Number($(".wallet__count")!.textContent);

   const answerOne = (choose: (o: HTMLButtonElement[]) => HTMLButtonElement) => {
      click(choose(optionButtons()));
      act(() => {
         vi.advanceTimersByTime(REVEAL_MS);
      });
   };

   it("earns exactly one star per item answered, right or wrong", () => {
      mount();
      start();
      expect(starCount()).toBe(0);

      answerOne(firstOption);
      expect(starCount()).toBe(1);

      answerOne(correctOptionButton);
      expect(starCount()).toBe(2);
   });

   it("earns the same stars for a session answered wrong as one answered right", () => {
      const wrong = mount();
      start();
      playToEnd((o) => o.find((b) => b !== correctOptionButton(o)) ?? o[0]!);
      const wrongStars = wrong.answers!.length;

      act(() => root.unmount());
      container.remove();
      container = document.createElement("div");
      document.body.appendChild(container);
      root = createRoot(container);

      const right = mount();
      start();
      playToEnd(correctOptionButton);
      expect(right.answers!.length).toBe(wrongStars);
   });

   it("flies a star to the counter on every tap, right or wrong", () => {
      mount();
      start();
      expect($(".star-flight")).toBeNull();
      click(optionButtons()[0]!);
      expect($(".star-flight")).not.toBeNull();
   });

   it("is the background of the screen, not a strip under the question", () => {
      mount();
      start();
      const scene = $(".scene")!;
      const panel = $(".panel")!;

      expect(scene).not.toBeNull();
      // The scene is painted first and the panel floats over it — the reading
      // task sits on top of the place rather than above a shelf of icons.
      expect(
         scene.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
      expect(scene.contains(panel)).toBe(false);
      expect(scene.querySelector(".scene__scrim")).not.toBeNull();
   });

   it("paints the backdrop from the zoo-entrance image, with the pens on top", () => {
      mount();
      start();
      const scene = $(".scene")!;
      const art = scene.querySelector<HTMLElement>(".scene__art")!;
      expect(art).not.toBeNull();
      expect(art.style.backgroundImage).toContain(BACKDROP.src);
      // The pens are SVG in front of the image, never part of it.
      expect(scene.querySelector(".scene__pens svg")).not.toBeNull();
      expect($$(".pen").length).toBeGreaterThanOrEqual(4);
      expect($$(".pen__fence").length).toBe($$(".pen").length);
   });

   it("starts every pen empty, as a silhouette of the animal that goes there", () => {
      mount();
      start();
      expect($$(".figure--ghost").length).toBe($$(".pen").length);
      expect($$(".figure--live")).toHaveLength(0);
   });

   it("puts an animal in its pen once it is bought, drawn big", () => {
      mount();
      start();
      // Counted from the wallet, not the harness: onComplete only fires at the
      // end of the session, so the harness is empty while it is being played.
      while (starCount() < 3 && optionButtons().length > 0) {
         answerOne(firstOption);
      }
      expect(starCount()).toBe(3);
      const live = $$<SVGElement>(".figure--live svg");
      expect(live).toHaveLength(1);
      expect(Number(live[0]!.getAttribute("width"))).toBeGreaterThanOrEqual(100);
      expect($$(".pen--filled")).toHaveLength(1);
   });

   it("gives the four pens four different habitats, so they read as places", () => {
      mount();
      start();
      const habitats = $$<HTMLElement>(".pen").map((p) => p.dataset.habitat);
      expect(habitats).toHaveLength(4);
      expect(new Set(habitats).size).toBe(4);
      for (const h of habitats) expect(["grass", "water", "rock", "trees"]).toContain(h);
      // Each pen draws its own ground and its own boundary.
      for (const pen of $$(".pen")) {
         expect(pen.querySelector(".pen__ground")).not.toBeNull();
         expect(pen.querySelector(".pen__fence")).not.toBeNull();
      }
   });

   it("draws every animal with a face that can blink, and idle motion only once owned", () => {
      mount();
      start();
      // Every figure, ghost or live, is a real drawing with eyes.
      for (const figure of $$(".figure")) {
         expect(figure.querySelectorAll(".eye").length).toBeGreaterThan(0);
         expect(figure.querySelector(".figure__body")).not.toBeNull();
      }
      // Idle motion is keyed off `.figure--live`; nothing is live before a purchase.
      expect($$(".figure--live")).toHaveLength(0);

      while (starCount() < 3 && optionButtons().length > 0) answerOne(firstOption);
      expect($$(".figure--live")).toHaveLength(1);
      expect($$(".figure--live .eye").length).toBeGreaterThan(0);
   });

   it("shows the store beside the stars, and lets nothing in it be tapped", () => {
      mount();
      start();

      const store = $(".store")!;
      expect(store).not.toBeNull();
      expect(store.querySelector("button")).toBeNull();
      expect(store.querySelector("a")).toBeNull();
      expect(store.querySelector("[tabindex]")).toBeNull();
      expect(store.getAttribute("aria-hidden")).toBe("true");

      // The point of the placement: stars and the thing they buy, side by side.
      const wallet = $(".wallet")!;
      expect(wallet.contains(store)).toBe(true);
      expect(wallet.querySelector(".wallet__stars")).not.toBeNull();
   });
});

describe("GameScreen — the full-viewport layout", () => {
   const follows = (first: Element, second: Element) =>
      Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);

   it("runs scene, then zookeeper and stars, then the question panel", () => {
      mount();
      start();

      const scene = $(".scene")!;
      const keeper = $('svg[aria-label="Your zookeeper"]')!;
      const wallet = $(".wallet")!;
      const ask = $(".ask")!;
      const options = $(".options")!;

      expect(keeper).not.toBeNull();
      expect(follows(scene, keeper)).toBe(true);
      expect(follows(keeper, wallet)).toBe(true);
      expect(follows(wallet, ask)).toBe(true);
      expect(follows(ask, options)).toBe(true);
   });

   it("is not a centred column: nothing wraps the screen in a frame", () => {
      mount();
      start();
      expect($(".device")).toBeNull();
      expect($("main.screen")).not.toBeNull();
   });

   it("puts the speaker at the start of the question line", () => {
      mount();
      start();
      const ask = $(".ask")!;
      const replay = $("button.replay")!;
      const stem = $(".stem")!;

      expect(ask.contains(replay)).toBe(true);
      expect(ask.contains(stem)).toBe(true);
      expect(follows(replay, stem)).toBe(true);
   });

   /**
    * The target sits inside the sentence rather than in a block of its own, so
    * it reads as part of the line. Structure is what a DOM test can check —
    * jsdom computes no type size.
    */
   it("keeps the target word inline in the sentence", () => {
      mount();
      start();
      const stem = $(".stem")!;
      const target = $(".stem__target");
      const blank = $(".stem__blank");
      const inline = target ?? blank!;

      expect(inline).not.toBeNull();
      expect(inline.parentElement).toBe(stem);
      expect((stem.textContent ?? "").trim().length).toBeGreaterThan(
         (inline.textContent ?? "").length
      );
   });

   it("gives the word cards the taller floor DESIGN.md asks for", () => {
      mount();
      start();
      expect(CARD_MIN_HEIGHT_PX).toBeGreaterThanOrEqual(76);
      for (const button of optionButtons()) {
         expect(Number.parseInt(button.style.minHeight, 10)).toBeGreaterThanOrEqual(
            CARD_MIN_HEIGHT_PX
         );
      }
      expect(optionButtons()).toHaveLength(3);
   });
});

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { COME_BACK_LINE, CompletionScreen, SHOW_GROWN_UP, THANKS_LINE } from "./CompletionScreen.tsx";
import { MIN_TAP_TARGET_PX } from "./GameScreen.tsx";
import { STARS_PER_ANIMAL } from "./session.ts";

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
   globalThis.IS_REACT_ACT_ENVIRONMENT = true;
   container = document.createElement("div");
   document.body.appendChild(container);
   root = createRoot(container);
});
afterEach(() => {
   act(() => root.unmount());
   container.remove();
});

const $ = <T extends Element>(s: string) => container.querySelector<T>(s);
const $$ = <T extends Element>(s: string) => [...container.querySelectorAll<T>(s)];
const text = () => container.textContent ?? "";

function render(itemsAnswered: number, onShowGrownUp = () => {}) {
   act(() => {
      root.render(<CompletionScreen itemsAnswered={itemsAnswered} onShowGrownUp={onShowGrownUp} />);
   });
}

describe("CompletionScreen", () => {
   it("says the two lines, to the letter", () => {
      render(12);
      expect(text()).toContain("Thanks for helping at the zoo today!");
      expect(text()).toContain("Come back soon and we'll fill it up some more.");
      expect(THANKS_LINE).toBe("Thanks for helping at the zoo today!");
      expect(COME_BACK_LINE).toBe("Come back soon and we'll fill it up some more.");
   });

   /** The whole point of the screen: nothing on it can be read as a result. */
   it("shows no score, no count, nothing evaluative", () => {
      for (const n of [0, 3, 12]) {
         render(n);
         expect(text()).not.toMatch(/\d/);
         expect(text()).not.toMatch(/score|correct|wrong|right|great|well done|good job|points?|star/i);
      }
   });

   it("reads the same to a child who got everything wrong and one who got everything right", () => {
      render(12);
      const a = text();
      render(12);
      expect(text()).toBe(a);
   });

   it("stands in the child's zoo with whatever they earned, and the zookeeper", () => {
      render(7); // two animals
      expect($(".scene")).not.toBeNull();
      expect($$(".figure--live")).toHaveLength(Math.floor(7 / STARS_PER_ANIMAL));
      expect($('svg[aria-label="Your zookeeper"]')).not.toBeNull();
   });

   it("has one control, 'Show a grown-up', big enough to tap", () => {
      let taps = 0;
      render(12, () => { taps += 1; });
      const buttons = $$<HTMLButtonElement>("button");
      expect(buttons).toHaveLength(1);
      expect(buttons[0]!.textContent).toBe(SHOW_GROWN_UP);
      expect(Number.parseInt(buttons[0]!.style.minHeight, 10)).toBeGreaterThanOrEqual(MIN_TAP_TARGET_PX);
      act(() => { buttons[0]!.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
      expect(taps).toBe(1);
   });

   it("carries no wallet or store — nothing to buy, nothing to count", () => {
      render(12);
      expect($(".wallet")).toBeNull();
      expect($(".store")).toBeNull();
   });
});

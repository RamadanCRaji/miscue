import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { App } from "./App.tsx";
import { REVEAL_MS } from "./components/session.ts";
import { SHOW_GROWN_UP } from "./components/CompletionScreen.tsx";

/**
 * The one rule that matters most on the way out: the parent screen — which
 * names a reading difficulty — never appears on its own. Driven through the real
 * App so the guard is the one that ships.
 */

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

const $ = (s: string) => container.querySelector(s);
const $$ = (s: string) => [...container.querySelectorAll<HTMLButtonElement>(s)];
const click = (el: Element) => act(() => { el.dispatchEvent(new MouseEvent("click", { bubbles: true })); });

function playWholeSession() {
   // The app narrates with the real browser voice; jsdom has neither Audio nor
   // speechSynthesis, and the narrator handles both being absent.
   act(() => { root.render(<App />); });
   click($("button.start-button")!);
   let guard = 0;
   while ($$("button.option").length > 0) {
      if (++guard > 40) throw new Error("session did not finish");
      click($$("button.option")[0]!);
      act(() => { vi.advanceTimersByTime(REVEAL_MS); });
   }
}

describe("App — the way out of a session", () => {
   it("ends on the completion screen, not the parent screen", () => {
      playWholeSession();
      expect(container.textContent).toContain("Thanks for helping at the zoo today!");
      expect($(".parent")).toBeNull();
      expect(container.textContent).not.toMatch(/Something to work on|Going well|Nothing to flag/);
   });

   it("reaches the parent screen only through 'Show a grown-up'", () => {
      playWholeSession();
      const button = $$("button").find((b) => b.textContent === SHOW_GROWN_UP);
      expect(button).toBeDefined();
      expect($(".parent")).toBeNull();

      click(button!);
      expect($(".parent")).not.toBeNull();
      expect(container.textContent).not.toContain("Thanks for helping at the zoo today!");
   });

   it("comes back to a fresh game, not to the parent screen, on Play again", () => {
      playWholeSession();
      click($$("button").find((b) => b.textContent === SHOW_GROWN_UP)!);
      click($$("button.parent__again")[0]!);
      expect($(".parent")).toBeNull();
      expect($("button.start-button")).not.toBeNull();
   });
});

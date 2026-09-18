import { describe, expect, it, vi } from "vitest";
import { AUDIO_DIR, createNarrator, displayedStem, spokenStem } from "./question";
import type { NarratorDeps } from "./question";
import type { DecodableItem, IrregularItem, Item, Option } from "./types";
import itemBank from "./data/items.json";

const BANK = itemBank as unknown as Item[];

const decodable = (target = "boat", audio: string | null = null): DecodableItem => ({
   id: `d-${target}`,
   track: "decodable",
   source: "seed",
   target,
   targetVowelSpelling: "oa",
   targetVowelSound: "long-o",
   audio,
   options: [],
});

const irregular = (target = "what", audio = "q-what.mp3"): IrregularItem => ({
   id: `i-${target}`,
   track: "irregular",
   source: "seed",
   target,
   audio,
   options: [],
});

/** A clip that plays. */
function playableClip() {
   const element = { play: vi.fn(() => Promise.resolve()), pause: vi.fn(), addEventListener: vi.fn() };
   return element as unknown as HTMLAudioElement & typeof element;
}

/** A clip that is not there — every clip, today. */
function missingClip() {
   const listeners: Record<string, () => void> = {};
   const element = {
      play: vi.fn(() => Promise.reject(new Error("no such file"))),
      pause: vi.fn(),
      addEventListener: (event: string, handler: () => void) => {
         listeners[event] = handler;
      },
      fireError: () => listeners.error?.(),
   };
   return element as unknown as HTMLAudioElement & typeof element;
}

function deps(makeAudio: NarratorDeps["makeAudio"]) {
   const spoken: string[] = [];
   return {
      spoken,
      cancels: { count: 0 },
      deps: {
         makeAudio,
         speak: (text: string) => spoken.push(text),
         cancelSpeech() {},
      } satisfies NarratorDeps,
   };
}

describe("the question stems", () => {
   it("uses the teacher's wording, per track", () => {
      expect(spokenStem(decodable("boat"))).toBe("Which word has the same vowel sound as boat?");
      expect(spokenStem(irregular("what"))).toBe("How do you spell the word what?");
   });

   it("shows the decodable target and hides the irregular one", () => {
      expect(displayedStem(decodable("boat")).target).toBe("boat");
      expect(displayedStem(irregular("what")).target).toBeNull();
   });

   it("still speaks the irregular target — audio is the whole question there", () => {
      expect(spokenStem(irregular("who"))).toContain("who");
   });

   it("names no option, on any item in the bank", () => {
      for (const item of BANK) {
         const stem = spokenStem(item);
         const distractors = (item.options as Option[]).filter((o) => !o.correct);
         for (const option of distractors) {
            expect(stem.split(/\W+/)).not.toContain(option.word);
         }
      }
   });
});

describe("the narrator", () => {
   it("plays the recorded clip when there is one", async () => {
      const clip = playableClip();
      const harness = deps(() => clip);
      createNarrator(harness.deps).ask(irregular("what", "q-what.mp3"));

      expect(clip.play).toHaveBeenCalled();
      await Promise.resolve();
      expect(harness.spoken).toEqual([]);
   });

   it("looks for the clip where section 12 puts it", () => {
      const seen: string[] = [];
      const harness = deps((src) => {
         seen.push(src);
         return playableClip();
      });
      createNarrator(harness.deps).ask(irregular("who", "q-who.mp3"));
      expect(seen).toEqual([`${AUDIO_DIR}/q-who.mp3`]);
   });

   /** The state of the project today: named clips, none of them recorded. */
   it("falls back to the browser voice when the clip will not play", async () => {
      const clip = missingClip();
      const harness = deps(() => clip);
      createNarrator(harness.deps).ask(irregular("what", "q-what.mp3"));

      await Promise.resolve();
      await Promise.resolve();
      expect(harness.spoken).toEqual(["How do you spell the word what?"]);
   });

   it("speaks immediately when the item names no clip at all", () => {
      const harness = deps(() => playableClip());
      createNarrator(harness.deps).ask(decodable("boat", null));
      expect(harness.spoken).toEqual(["Which word has the same vowel sound as boat?"]);
   });

   it("speaks once when a clip both errors and rejects", async () => {
      const clip = missingClip();
      const harness = deps(() => clip);
      createNarrator(harness.deps).ask(irregular("the", "q-the.mp3"));

      clip.fireError();
      await Promise.resolve();
      await Promise.resolve();
      expect(harness.spoken).toHaveLength(1);
   });

   it("speaks when the environment has no audio at all", () => {
      const harness = deps(() => null);
      createNarrator(harness.deps).ask(irregular("what"));
      expect(harness.spoken).toEqual(["How do you spell the word what?"]);
   });

   it("replays as often as asked", () => {
      const harness = deps(() => null);
      const narrator = createNarrator(harness.deps);
      const item = decodable("rain");
      narrator.ask(item);
      narrator.ask(item);
      narrator.ask(item);
      expect(harness.spoken).toHaveLength(3);
   });

   it("stops the previous clip before starting the next question", () => {
      const clip = playableClip();
      const harness = deps(() => clip);
      const narrator = createNarrator(harness.deps);
      narrator.ask(irregular("what", "q-what.mp3"));
      narrator.ask(irregular("who", "q-who.mp3"));
      expect(clip.pause).toHaveBeenCalled();
   });
});

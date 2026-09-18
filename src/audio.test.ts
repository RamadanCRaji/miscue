import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { AUDIO_DIR, createNarrator, spokenStem } from "./question.ts";
import type { NarratorDeps } from "./question.ts";
import type { Item } from "./types.ts";
import itemBank from "./data/items.json";
import { BACKDROP } from "./components/GameScreen.tsx";

/**
 * The clips and the data that names them.
 *
 * A wrong filename does not break the app — the synthesised voice still reads
 * the question — which is exactly why it needs a test: on a recording day the
 * only symptom is the wrong voice, and nobody hears it until playback.
 */

const BANK = itemBank as unknown as Item[];
const DISK_DIR = "public/audio";

const onDisk = fs.existsSync(DISK_DIR)
   ? fs.readdirSync(DISK_DIR).filter((f) => !f.startsWith("."))
   : [];

const DEMO_ITEM_IDS = ["seed-boat", "seed-bread", "seed-rain", "seed-pie", "seed-snow",
   "gen-sweat-1", "gen-chief-1", "gen-moon-1", "seed-what", "seed-who", "seed-the", "seed-because"];

describe("the recorded clips", () => {
   it("has a file for every demo item", () => {
      expect(onDisk.length).toBeGreaterThan(0);
      for (const id of DEMO_ITEM_IDS) {
         const item = BANK.find((i) => i.id === id)!;
         expect(item.audio, `${id} (${item.target}) names no clip`).not.toBeNull();
         expect(onDisk, `${id} names "${item.audio}", which is not in /${DISK_DIR}`).toContain(
            item.audio
         );
      }
   });

   /** A dangling name anywhere in the bank, not just the demo twelve. */
   it("has no item naming a clip that is not on disk", () => {
      const dangling = BANK.filter((i) => i.audio !== null && !onDisk.includes(i.audio)).map(
         (i) => `${i.id} -> ${i.audio}`
      );
      expect(dangling).toEqual([]);
   });

   it("names each clip after its target, whatever the extension", () => {
      for (const item of BANK) {
         if (item.audio === null) continue;
         expect(path.parse(item.audio).name).toBe(`q-${item.target}`);
      }
   });

   it("leaves every irregular item with a clip — audio is the whole question there", () => {
      for (const item of BANK) {
         if (item.track !== "irregular") continue;
         expect(item.audio).not.toBeNull();
         expect(onDisk).toContain(item.audio);
      }
   });

   it("records no clip it does not use", () => {
      const named = new Set(BANK.flatMap((i) => (i.audio ? [i.audio] : [])));
      expect(onDisk.filter((f) => !named.has(f))).toEqual([]);
   });
});

describe("a missing clip falls back visibly, not silently", () => {
   function harness(makeAudio: NarratorDeps["makeAudio"]) {
      const spoken: string[] = [];
      const fallbacks: { itemId: string; src: string | null; reason: string }[] = [];
      return {
         spoken,
         fallbacks,
         deps: {
            makeAudio,
            speak: (t: string) => spoken.push(t),
            cancelSpeech: () => {},
            onFallback: (r) => fallbacks.push(r),
         } satisfies NarratorDeps,
      };
   }

   const withClip = BANK.find((i) => i.audio !== null)!;
   const withoutClip = BANK.find((i) => i.audio === null)!;

   /** A clip that 404s: the browser fires `error` on the element. */
   function brokenClip() {
      const listeners: Record<string, () => void> = {};
      return {
         play: () => Promise.reject(new Error("404")),
         pause: () => {},
         addEventListener: (e: string, h: () => void) => {
            listeners[e] = h;
         },
         fire: () => listeners.error?.(),
      } as unknown as HTMLAudioElement & { fire: () => void };
   }

   it("reports which item and which file, and still reads the question", async () => {
      const h = harness(() => brokenClip());
      createNarrator(h.deps).ask(withClip);
      await Promise.resolve();
      await Promise.resolve();

      expect(h.fallbacks).toHaveLength(1);
      expect(h.fallbacks[0]!.itemId).toBe(withClip.id);
      expect(h.fallbacks[0]!.src).toBe(withClip.audio);
      expect(h.fallbacks[0]!.reason.length).toBeGreaterThan(0);
      // The child still hears the question — the fallback is loud to us, not them.
      expect(h.spoken).toEqual([spokenStem(withClip)]);
   });

   it("reports once, not twice, when a clip both errors and rejects", async () => {
      const clip = brokenClip();
      const h = harness(() => clip);
      createNarrator(h.deps).ask(withClip);
      clip.fire();
      await Promise.resolve();
      await Promise.resolve();
      expect(h.fallbacks).toHaveLength(1);
      expect(h.spoken).toHaveLength(1);
   });

   it("reports when the environment cannot play audio at all", () => {
      const h = harness(() => null);
      createNarrator(h.deps).ask(withClip);
      expect(h.fallbacks).toHaveLength(1);
      expect(h.fallbacks[0]!.src).toBe(withClip.audio);
   });

   /** An item with no recording is the designed state, not a fault. */
   it("stays quiet for an item that names no clip", () => {
      const h = harness(() => brokenClip());
      createNarrator(h.deps).ask(withoutClip);
      expect(h.fallbacks).toEqual([]);
      expect(h.spoken).toEqual([spokenStem(withoutClip)]);
   });

   it("says nothing when the clip plays", async () => {
      const h = harness(
         () => ({ play: () => Promise.resolve(), pause: () => {}, addEventListener: () => {} }) as unknown as HTMLAudioElement
      );
      createNarrator(h.deps).ask(withClip);
      await Promise.resolve();
      expect(h.fallbacks).toEqual([]);
      expect(h.spoken).toEqual([]);
   });

   it("asks for the clip at the section 12 path", () => {
      const seen: string[] = [];
      const h = harness((src) => {
         seen.push(src);
         return null;
      });
      createNarrator(h.deps).ask(withClip);
      expect(seen).toEqual([`${AUDIO_DIR}/${withClip.audio}`]);
   });
});

describe("the painted backdrop", () => {
   it("is on disk where the scene points", () => {
      expect(fs.existsSync(path.join("public", BACKDROP.src))).toBe(true);
   });

   it("keeps the artwork shorter than the file, so the watermark band can be cropped off", () => {
      expect(BACKDROP.height).toBeLessThan(BACKDROP.fileHeight);
      expect(BACKDROP.width).toBeGreaterThan(0);
   });
});

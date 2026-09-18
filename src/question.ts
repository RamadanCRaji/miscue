import type { Item } from "./types.ts";

/**
 * The question, and how it reaches the child. CLAUDE.md sections 8 and 9.
 *
 * A first-grader cannot read instructions, so audio carries the prompt
 * (section 1). Two rules shape everything here:
 *
 *   The full stem is spoken on every item, on both tracks.
 *   The options are NEVER spoken. Reading them aloud destroys the decoding
 *   task, which is the whole measurement (section 9).
 *
 * The second is enforced by shape rather than by discipline: nothing in this
 * module is given an option, so nothing here can read one out.
 */

/**
 * Recorded clips live in `/public/audio`, named `q-<target>.<ext>` (section 12).
 * The extension is whatever was actually recorded and is read from the item's
 * `audio` field — never assumed here. The Sept 17 clips are `.m4a`.
 */
export const AUDIO_DIR = "/audio";

/** Slower than default. Six-year-olds are still assembling the sounds. */
export const SPEECH_RATE = 0.85;

/**
 * What the child hears. Section 8: questions are per track, not stored per item.
 *
 * The irregular stem is the whole question — its target is spoken and never
 * shown, so a child who does not hear this has nothing to answer from.
 */
export function spokenStem(item: Item): string {
   return item.track === "decodable"
      ? `Which word has the same vowel sound as ${item.target}?`
      : `How do you spell the word ${item.target}?`;
}

/**
 * What the child sees, split so the target can be styled large.
 *
 * `target: null` on the irregular track is the point of that track: the word is
 * spoken only, and showing it would hand over the spelling the item is testing.
 */
export type StemParts = {
   before: string;
   /** Null when the target must not appear on screen. */
   target: string | null;
   after: string;
};

export function displayedStem(item: Item): StemParts {
   return item.track === "decodable"
      ? { before: "Which word has the same vowel sound as", target: item.target, after: "?" }
      : { before: "How do you spell the word", target: null, after: "?" };
}

/* -- playback -------------------------------------------------------------- */

/**
 * The browser bits, injected so tests can watch what was said without a real
 * speech engine, and so a missing clip is a branch rather than a 404 in a test.
 */
export type NarratorDeps = {
   /** Null when audio playback is unavailable in this environment. */
   makeAudio: (src: string) => HTMLAudioElement | null;
   speak: (text: string) => void;
   cancelSpeech: () => void;
   /**
    * Called when an item NAMED a clip and that clip could not be played, so the
    * synthesised voice took over. Not called when an item names no clip at all —
    * that is the designed state for the items with no recording.
    *
    * This exists because the failure is otherwise invisible: a mistyped filename
    * or a wrong extension still produces a spoken question, just in the wrong
    * voice, and on a recording day nobody would notice until playback.
    */
   onFallback?: (report: { itemId: string; src: string | null; reason: string }) => void;
};

export type Narrator = {
   /** Speak this item's question. Safe to call again for replay. */
   ask: (item: Item) => void;
   /** Silence whatever is playing, before advancing. */
   stop: () => void;
};

export const browserNarrator: NarratorDeps = {
   makeAudio: (src) => (typeof Audio === "undefined" ? null : new Audio(src)),
   onFallback: ({ itemId, src, reason }) => {
      console.warn(
         `[miscue] audio fallback: item "${itemId}" names ${src ?? "no clip"} but it ` +
            `could not be played (${reason}). The synthesised voice is reading this ` +
            `question instead — check the file exists in /public/audio and that the ` +
            `extension in items.json matches.`
      );
   },
   speak: (text) => {
      if (typeof speechSynthesis === "undefined") return;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = SPEECH_RATE;
      utterance.lang = "en-US";
      speechSynthesis.speak(utterance);
   },
   cancelSpeech: () => {
      if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
   },
};

/**
 * Plays the recorded clip when there is one, and falls back to the browser's
 * own voice when there is not.
 *
 * None of the clips are recorded yet — the three irregular items name a file
 * that does not exist, and every decodable item has `audio: null` — so today the
 * fallback is the only path that runs. It is written as a fallback rather than
 * as the design because a recorded human voice is better for a child than a
 * synthesised one, and the clips are expected before the demo.
 */
export function createNarrator(deps: NarratorDeps = browserNarrator): Narrator {
   let current: HTMLAudioElement | null = null;

   const stop = () => {
      if (current) {
         current.pause();
         current = null;
      }
      deps.cancelSpeech();
   };

   const ask = (item: Item) => {
      stop();
      const stem = spokenStem(item);

      // One fallback per ask: a clip can both fire `error` and reject its play()
      // promise, and the child must not hear the question twice over itself.
      let spoken = false;
      const speakOnce = (reason: string | null) => {
         if (spoken) return;
         spoken = true;
         // Only a NAMED clip failing is worth reporting. An item with no
         // recording is the designed state, not a fault.
         if (reason !== null) {
            deps.onFallback?.({ itemId: item.id, src: item.audio ?? null, reason });
         }
         deps.speak(stem);
      };

      if (!item.audio) return speakOnce(null);

      const src = `${AUDIO_DIR}/${item.audio}`;
      const element = deps.makeAudio(src);
      if (!element) return speakOnce("no audio support in this environment");

      current = element;
      element.addEventListener("error", () => speakOnce("the file did not load"), { once: true });
      try {
         const started = element.play() as Promise<void> | undefined;
         if (started && typeof started.catch === "function") {
            started.catch((e: unknown) => speakOnce(`play() rejected: ${String(e)}`));
         }
      } catch (e) {
         speakOnce(`play() threw: ${String(e)}`);
      }
   };

   return { ask, stop };
}

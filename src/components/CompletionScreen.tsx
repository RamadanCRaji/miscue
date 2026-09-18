import { STARS_PER_ANIMAL } from "./session.ts";
import { MIN_TAP_TARGET_PX, Scene } from "./GameScreen.tsx";
import { Zookeeper } from "./animals.tsx";

/**
 * Between the game and the parent screen.
 *
 * The child is still holding the device, and the parent screen names a reading
 * difficulty. So the session does not end on the parent screen — it ends here,
 * in the child's own zoo, and the parent screen is reached only by a deliberate
 * tap on "Show a grown-up". `App` enforces that: there is no path from a
 * finished session to the parent screen that does not pass through this button.
 *
 * Nothing evaluative. No score, no count, no "great job" — a thank-you and an
 * invitation back, which are the same whether the child got everything right or
 * everything wrong. The zoo shows what they earned, and earning is for
 * answering, never for answering correctly.
 */

/** The two lines, verbatim. Exported so a test can hold them to the letter. */
export const THANKS_LINE = "Thanks for helping at the zoo today!";
export const COME_BACK_LINE = "Come back soon and we'll fill it up some more.";
export const SHOW_GROWN_UP = "Show a grown-up";

export type CompletionScreenProps = {
   /** How many items the child answered — one star each, three stars an animal. */
   itemsAnswered: number;
   onShowGrownUp: () => void;
};

export function CompletionScreen({ itemsAnswered, onShowGrownUp }: CompletionScreenProps) {
   const earned = Math.floor(itemsAnswered / STARS_PER_ANIMAL);

   return (
      <main className="screen screen--complete">
         <Scene earned={earned} prices={false} />
         <section className="panel panel--done">
            <Zookeeper size={150} />
            <p className="start-line">{THANKS_LINE}</p>
            <p className="start-line">{COME_BACK_LINE}</p>
            <button
               type="button"
               className="start-button grown-up"
               style={{ minHeight: MIN_TAP_TARGET_PX + 20 }}
               onClick={onShowGrownUp}
            >
               {SHOW_GROWN_UP}
            </button>
         </section>
      </main>
   );
}

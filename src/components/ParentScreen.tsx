import type { ParentFinding, ParentReport } from "../engine/diagnose.ts";

/**
 * The parent's screen. DESIGN.md section 10, CLAUDE.md section 9.
 *
 * An adult, probably on a phone, reading once and then deciding whether to do
 * something tonight. Calm, no zoo, no motion.
 *
 * The order is the design (10.2), and it is not arbitrary: **strength, then
 * concern, then action.** Opening with a concern makes a parent defensive,
 * burying it in praise means they miss it, and ending on it leaves them holding
 * worry instead of something to do.
 *
 * It renders what `forParent()` returns and adds no judgement of its own — no
 * ranking, no totals, and no score of any kind (10.1).
 */

/**
 * DESIGN.md 10.5: "Name the time." This is the document's own value, applied to
 * every activity, because no per-activity duration exists in the data — and a
 * time invented per activity would be a fabricated claim about the teacher's
 * content. If she wants real per-activity times, that is a field on the
 * distractor, not a guess made here.
 */
export const ACTIVITY_TIME = "About 5 minutes.";

export type ParentScreenProps = {
   /** Straight from `forParent(diagnose(answers), misconceptions)`. */
   report: ParentReport;
   elapsedMs: number;
   onPlayAgain?: () => void;
};

export function ParentScreen({ report, elapsedMs, onPlayAgain }: ParentScreenProps) {
   const decodable = report.decodable.confirmed;
   const irregular = report.irregular;
   const findings = [...decodable, ...irregular.confirmed];

   /**
    * Most-evidenced first: the strength a parent is shown first should be the
    * one the session is surest about, and the single activity comes from the
    * finding with the most behind it.
    */
   const strengths = [...report.decodable.ruledOut, ...report.irregular.ruledOut].sort(
      (a, b) => b.exposures - a.exposures
   );
   const [leadStrength, ...restStrengths] = strengths;

   /**
    * 10.5: exactly one activity, never a list, **no matter how many findings
    * there are.** More options do not help a parent act; they reduce the chance
    * they do anything at all.
    */
   const primary = [...findings].sort((a, b) => b.selections - a.selections)[0];
   const activity = primary?.advice ?? null;

   const hasFinding = findings.length > 0;

   return (
      <main className="parent">
         <div className="parent__column">
            {/* 1. Framing line — warm, plain, and without a numeral (10.2). */}
            <p className="parent__framing">
               Your child played a reading game for {durationPhrase(elapsedMs)}. Here is what it
               picked up.
            </p>

            {/* 2. One strength, before the finding: a moment of safety first. */}
            {hasFinding && leadStrength && <Strength finding={leadStrength} lead />}

            {hasFinding ? (
               <>
                  {/* 3 + 4. The findings and their evidence. */}
                  {decodable.length > 0 && (
                     <section className="block">
                        <p className="eyebrow">
                           <FindingIcon />
                           Something to work on
                        </p>
                        {decodable.map((finding) => (
                           <Finding key={finding.misconceptionId} finding={finding} />
                        ))}
                     </section>
                  )}

                  {/*
                   * 10.7: the irregular track keeps its own headline and is NOT
                   * put under the misconceptions' heading, given a deficit
                   * framing, or given a severity indicator. A sight word is a
                   * memorisation gap, not a misapplied rule.
                   */}
                  {irregular.confirmed.length > 0 && irregular.headline && (
                     <section className="block block--aside">
                        <h2 className="headline">{irregular.headline}</h2>
                        {irregular.confirmed.map((finding) => (
                           <p className="evidence" key={finding.misconceptionId}>
                              {evidenceSentence(finding)}
                           </p>
                        ))}
                     </section>
                  )}

                  {/* 5. The activity: the last thing, what they are left holding. */}
                  {activity && (
                     <section className="activity">
                        <p className="activity__label">
                           Try this at home
                           <span className="activity__time">{ACTIVITY_TIME}</span>
                        </p>
                        {/* The teacher's text, verbatim and in full. If layout
                            ever forces a choice, this is what stays visible. */}
                        <p className="activity__text">{activity}</p>
                     </section>
                  )}
               </>
            ) : (
               <NothingToFlag />
            )}

            {/* 6. Any remaining strengths, below the activity, quieter. */}
            {(hasFinding ? restStrengths : strengths).length > 0 && (
               <section className="block block--quiet">
                  <p className="eyebrow eyebrow--quiet">
                     <StrengthIcon />
                     {hasFinding ? "Also going well" : "Going well"}
                  </p>
                  <ul className="strengths">
                     {(hasFinding ? restStrengths : strengths).map((strength) => (
                        <li className="strength" key={strength.misconceptionId}>
                           <StrengthIcon />
                           <span>{strength.label}</span>
                        </li>
                     ))}
                  </ul>
               </section>
            )}

            {onPlayAgain && (
               <button type="button" className="parent__again" onClick={onPlayAgain}>
                  Play again
               </button>
            )}
         </div>
      </main>
   );
}

/**
 * 10.3: the headline is the teacher's deficit label, verbatim — not rewritten
 * gentler, not rewritten blunter. It names a specific, improvable skill rather
 * than a category of child, and that distinction is doing real work.
 */
function Finding({ finding }: { finding: ParentFinding }) {
   return (
      <article className="finding">
         <h2 className="headline">{finding.label}</h2>
         <p className="evidence">{evidenceSentence(finding)}</p>
      </article>
   );
}

/**
 * 10.6: a strength means the child repeatedly *avoided* a trap — it is a
 * ruled-out misconception, never a good score. The wording is the teacher's
 * `strengthLabel`.
 *
 * Icon plus a worded label, never a coloured dot against another coloured dot
 * (10.9): remove every colour from this page and it still reads correctly.
 */
function Strength({ finding, lead }: { finding: ParentFinding; lead?: boolean }) {
   return (
      <section className={`block${lead ? " block--lead" : ""}`}>
         <p className="eyebrow">
            <StrengthIcon />
            Going well
         </p>
         <p className="strength strength--lead">
            <span>{finding.label}</span>
         </p>
      </section>
   );
}

/**
 * 10.8: a real outcome, not an error, and it must look intentional. It avoids
 * both failure modes — it does not read as a clean bill of health, which a short
 * session cannot support, and it does not read as the product failing.
 */
function NothingToFlag() {
   return (
      <section className="block">
         <p className="eyebrow">
            <FindingIcon />
            Nothing to flag today
         </p>
         <h2 className="headline">No one pattern came up often enough to name.</h2>
         <p className="evidence">
            That is common in a short session. Playing again on another day gives a clearer picture.
         </p>
      </section>
   );
}

/**
 * 10.4: quote what the child actually did, with how often. Real words and real
 * counts are what separate a diagnosis from a guess, and what stop a parent
 * asking how the app could possibly know.
 */
export function evidenceSentence(finding: ParentFinding): string {
   const picks = finding.picks.map((p) => `${p.word} for ${p.target}`);
   const where = finding.exposures;
   const words = where === 1 ? "word" : "words";
   // "every one of the 4" rather than "4 of the 4", which reads as a typo.
   const ratio =
      finding.itemsSelectedIn >= where
         ? `every one of the ${where} ${words} where it could come up`
         : `${finding.itemsSelectedIn} of the ${where} ${words} where it could come up`;
   return picks.length > 0 ? `Chose ${joinWords(picks)}, ${ratio}.` : `Came up in ${ratio}.`;
}

function joinWords(parts: string[]): string {
   if (parts.length <= 1) return parts[0] ?? "";
   if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
   return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

const NUMBER_WORDS = [
   "zero",
   "one",
   "two",
   "three",
   "four",
   "five",
   "six",
   "seven",
   "eight",
   "nine",
   "ten",
   "eleven",
   "twelve",
];

/**
 * Spelled out, because 10.2 asks the framing line to be non-numeric: a numeral
 * on this screen reads as a measurement, which is the one thing this screen is
 * built to avoid.
 */
export function durationPhrase(elapsedMs: number): string {
   const minutes = Math.round(elapsedMs / 60000);
   if (minutes < 1) return "about a minute";
   const word = NUMBER_WORDS[minutes] ?? String(minutes);
   return `about ${word} ${minutes === 1 ? "minute" : "minutes"}`;
}

/*
 * The two marks differ in SHAPE first — a ring around a dot against a tick —
 * and each is followed by a worded label. Okabe-Ito blue and bluish green sit
 * on top of that, and nothing depends on a reader seeing either.
 */

function FindingIcon() {
   return (
      <svg className="icon" width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
         <circle cx="10" cy="10" r="7.5" fill="none" stroke="#0072B2" strokeWidth="2" />
         <circle cx="10" cy="10" r="2.6" fill="#0072B2" />
      </svg>
   );
}

function StrengthIcon() {
   return (
      <svg className="icon" width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
         <path
            d="M3.5 10.4 l4.2 4.2 L16.5 5.4"
            fill="none"
            stroke="#009E73"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
         />
      </svg>
   );
}

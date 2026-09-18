/**
 * Offline item generation. CLAUDE.md section 5b.
 *
 * Runs on a developer machine only — never in the browser, never in CI, never
 * at runtime. The shipped app makes zero model calls; this script is the single
 * place AI touches the project, and its output is reviewed by a human before
 * anything reaches `items.json`.
 *
 * Pipeline: generate -> validate -> write every candidate, survivor or not, to
 * `scripts/candidates.json`. Rejections are kept because T9's rejection log is
 * a deliverable, and "the validator caught N" is only reportable if the
 * rejected candidates still exist.
 *
 * Parent advice is never written by the model — it is the teacher's, verbatim
 * (CLAUDE.md section 11). Each generated distractor inherits `parentAdvice` from
 * a seed distractor on the same track: preferably one with the same misconception
 * AND the same vowel sound, otherwise the same misconception alone; first in
 * `items.json` order within each tier. It is flagged `parentAdviceInherited:
 * true` on the option and listed as provisional in the candidate record, because
 * it names the seed's word rather than the generated one. The reviewer replaces
 * it. If no seed distractor has advice for that misconception, it gets none and
 * fails rule 11 like any other candidate.
 *
 * This script never writes `items.json`. Approved items are appended by a human.
 *
 *   node scripts/generate.ts [--count N] [--only <misconception-id>]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { validateBank, validateItem } from "../src/engine/validate.ts";
import { VOWEL_SOUNDS } from "../src/types.ts";
import type {
   DecodableItem,
   Item,
   Misconception,
   Option,
   Track,
   VowelSound,
} from "../src/types.ts";

const MODEL = "claude-opus-5";
const MAX_TOKENS = 16000;
const DEFAULT_CANDIDATES_PER_MISCONCEPTION = 6;

/** Generated items are decodable only — the irregular track has no agreed
 *  question format yet, so it stays blocked. See TASKS.md blocking gaps. */
const GENERATED_TRACK = "decodable";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(here);
const ITEMS_PATH = path.join(root, "src", "data", "items.json");
const MISCONCEPTIONS_PATH = path.join(root, "src", "data", "misconceptions.json");
const CANDIDATES_PATH = path.join(here, "candidates.json");

/* -- candidate record, the shape T9 reads --------------------------------- */

type CandidateStatus = "passed" | "failed-validation" | "malformed";

type CandidateRecord = {
   requestedMisconception: string;
   status: CandidateStatus;
   /** Null only when the model returned something unusable. */
   item: Item | null;
   failures: string[];
   warnings: string[];
   /**
    * One entry per distractor whose advice was inherited. Always provisional:
    * the advice was written for the seed's word, not this distractor's, so the
    * reviewer replaces it before the item can enter the bank.
    */
   provisionalAdvice: ProvisionalAdvice[];
   /** Present on malformed candidates so a human can see what came back. */
   raw?: unknown;
};

type ProvisionalAdvice = {
   /** The generated distractor carrying the inherited advice. */
   word: string;
   provisional: true;
   /** The seed distractor the advice was copied from, and the word it names. */
   inheritedFrom: { itemId: string; word: string };
   /** How close the match was: the preferred tier, or the fallback. */
   matchedOn: MatchTier;
   reason: string;
};

type CandidatesFile = {
   generatedAt: string;
   model: string;
   candidatesRequestedPerMisconception: number;
   candidates: CandidateRecord[];
   /** A misconception whose whole request failed, e.g. an API error. */
   errors: { misconceptionId: string; message: string }[];
};

/* -- argument parsing ------------------------------------------------------ */

function parseArgs(argv: string[]): { count: number; only: string | null } {
   let count = DEFAULT_CANDIDATES_PER_MISCONCEPTION;
   let only: string | null = null;
   for (let i = 0; i < argv.length; i++) {
      const arg = argv[i];
      if (arg === "--count") {
         const raw = argv[++i];
         const parsed = Number(raw);
         if (!Number.isInteger(parsed) || parsed < 1) {
            fail(`--count needs a positive integer, got ${raw ?? "nothing"}`);
         }
         count = parsed;
      } else if (arg === "--only") {
         const raw = argv[++i];
         if (raw === undefined) fail("--only needs a misconception id");
         only = raw;
      } else {
         fail(`unknown argument "${arg}". Usage: node scripts/generate.ts [--count N] [--only <id>]`);
      }
   }
   return { count, only };
}

function fail(message: string): never {
   console.error(`generate: ${message}`);
   process.exit(1);
}

function readJson<T>(file: string): T {
   try {
      return JSON.parse(fs.readFileSync(file, "utf8")) as T;
   } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return fail(`could not read ${path.relative(root, file)} — ${detail}`);
   }
}

/* -- ids ------------------------------------------------------------------- */

/**
 * `gen-<target>-<n>`. Seeded with every id already on disk — the committed bank
 * and any previous candidates file, rejections included — so ids never collide
 * with a seed item, with each other, or with an earlier run's.
 */
export function makeIdAllocator(taken: Set<string>): (target: string) => string {
   return (target) => {
      const slug = target.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      let n = 1;
      while (taken.has(`gen-${slug}-${n}`)) n++;
      const id = `gen-${slug}-${n}`;
      taken.add(id);
      return id;
   };
}

function idsAlreadyUsed(items: Item[]): Set<string> {
   const taken = new Set(items.map((i) => i.id));
   if (fs.existsSync(CANDIDATES_PATH)) {
      const previous = readJson<CandidatesFile>(CANDIDATES_PATH);
      for (const record of previous.candidates ?? []) {
         if (record.item) taken.add(record.item.id);
      }
   }
   return taken;
}

/* -- inherited advice ------------------------------------------------------ */

type MatchTier = "misconception-and-vowel-sound" | "misconception";

export type InheritedAdvice = {
   advice: string;
   from: { itemId: string; word: string };
   matchedOn: MatchTier;
};

/**
 * Finds advice to inherit for a generated distractor, from seed distractors on
 * `track` only — advice written for one track must not land on the other.
 *
 * Preference order, first in `items.json` order within each tier:
 *   1. same misconception and same vowel sound — the advice at least practises
 *      the right vowel;
 *   2. same misconception alone.
 *
 * Seed distractors with blank advice are skipped rather than inherited. Vowel
 * sounds are read from the seed's human-assigned tags, never inferred.
 */
export function makeAdviceFinder(
   seeds: Item[],
   track: Track
): (misconceptionId: string, vowelSound: VowelSound | null) => InheritedAdvice | undefined {
   const bySoundAndMisconception = new Map<string, InheritedAdvice>();
   const byMisconception = new Map<string, InheritedAdvice>();

   for (const seed of seeds) {
      if (seed.track !== track) continue;
      const options: Option[] = seed.options;
      for (const option of options) {
         if (option.correct || option.misconceptionId === null) continue;
         if (typeof option.parentAdvice !== "string" || option.parentAdvice.trim() === "") continue;
         const from = { itemId: seed.id, word: option.word };
         const id = option.misconceptionId;

         if (!byMisconception.has(id)) {
            byMisconception.set(id, { advice: option.parentAdvice, from, matchedOn: "misconception" });
         }
         if ("vowelSound" in option) {
            const key = `${id}|${option.vowelSound}`;
            if (!bySoundAndMisconception.has(key)) {
               bySoundAndMisconception.set(key, {
                  advice: option.parentAdvice,
                  from,
                  matchedOn: "misconception-and-vowel-sound",
               });
            }
         }
      }
   }

   return (misconceptionId, vowelSound) =>
      (vowelSound === null ? undefined : bySoundAndMisconception.get(`${misconceptionId}|${vowelSound}`)) ??
      byMisconception.get(misconceptionId);
}

/* -- prompt ---------------------------------------------------------------- */

function systemPrompt(
   misconceptions: Misconception[],
   seeds: DecodableItem[],
   bankTargets: string[]
): string {
   // The model sees the seeds' structure and judgement, not their advice: it is
   // never asked to produce advice, so showing it would only invite imitation.
   const examples = seeds.map((seed) => ({
      ...seed,
      options: seed.options.map(({ parentAdvice, parentAdviceInherited, ...option }) => option),
   }));

   const misconceptionList = misconceptions
      .map((m) => `- ${m.id}: ${m.teacherNote}`)
      .join("\n");

   return `You write multiple-choice vowel-sound questions for a reading diagnostic used by children in roughly grades 1-3.

Each question shows one target word. The child picks which of three options has the SAME vowel sound as the target. Every wrong option is deliberate: it is tagged to a specific phonics misconception, so that choosing it tells us which broken rule the child is running.

HARD RULES. Every item you produce must satisfy all of these. An item breaking any of them is discarded.

1. Exactly 3 options.
2. Exactly 1 option marked correct.
3. The correct option's vowelSound EQUALS the target's vowelSound. Without this the item has no right answer.
4. Every distractor's vowelSound DIFFERS from the target's vowelSound. Otherwise there are two correct answers.
5. The correct option's vowelSpelling DIFFERS from the target's vowelSpelling. This is the core design rule: the child must not be able to letter-match their way to the answer.
6. Every distractor has a misconceptionId from the fixed list below.
7. No option word equals the target word.
9. The correct option's misconceptionId is null. A misconception on the right answer would make a correct answer count as evidence of an error.

STRONGLY PREFERRED: at least one distractor should look like the target — sharing either the same vowelSpelling or the same first two letters. That resemblance is the trap that catches a child who letter-matches instead of decoding.

FIXED MISCONCEPTION LIST. Use only these ids. Do not invent a new one, and do not stretch one to fit. If a word you want does not fit any of these, choose a different word.

${misconceptionList}

VOWEL SOUND VOCABULARY. Use only these values:
${VOWEL_SOUNDS.join(", ")}

VOWEL SPELLING CONVENTION. vowelSpelling is the letters carrying the vowel, lowercase:
- Single vowel: the letter alone. ten -> e, bot -> o, ran -> a
- Vowel team: both letters. boat -> oa, bread -> ea, free -> ee, day -> ay, boy -> oy
- Split vowel (silent e): vowel, underscore, e. have -> a_e, cape -> a_e, note -> o_e
- R-controlled: vowel plus r. bird -> ir, horse -> or
- toe -> oe, a vowel team rather than a split vowel, because the o and e are adjacent

WORKED EXAMPLES, written by a practicing reading teacher. Match their judgement, not just their shape:

${JSON.stringify(examples, null, 2)}

WORD CHOICE. Use words a child in grades 1-3 would plausibly meet in print. Do not reuse any of these target words, which are already in the bank: ${bankTargets.join(", ")}.

Return data only — no prose, no commentary, no markdown fences.`;
}

function userPrompt(misconception: Misconception, count: number): string {
   return `Write ${count} items whose distractors test this misconception:

id: ${misconception.id}
what it is: ${misconception.teacherNote}

At least one distractor in every item must carry misconceptionId "${misconception.id}". Other distractors may use any id from the fixed list where it genuinely fits the word.

Vary the target words and the vowel sounds across the ${count} items.`;
}

/* -- main ------------------------------------------------------------------ */

async function main(): Promise<void> {
   const { count, only } = parseArgs(process.argv.slice(2));

   // Read the key from the environment. Never hardcoded, never prompted for.
   const apiKey = process.env.ANTHROPIC_API_KEY;
   if (!apiKey) {
      fail(
         "ANTHROPIC_API_KEY is not set.\n" +
            "  This script calls the Anthropic API and needs a key in the environment:\n" +
            "    export ANTHROPIC_API_KEY=sk-ant-...\n" +
            "  Nothing was written. No other file was touched."
      );
   }

   const allItems = readJson<Item[]>(ITEMS_PATH);
   const misconceptions = readJson<Misconception[]>(MISCONCEPTIONS_PATH);
   const seeds = allItems.filter((i) => i.source === "seed");
   // Generation is decodable only, so only decodable seeds are few-shot
   // examples, and advice is inherited from seeds on the same track only.
   const decodableSeeds = seeds.filter((i): i is DecodableItem => i.track === "decodable");
   if (decodableSeeds.length === 0) {
      fail("no decodable seed items in items.json — nothing to few-shot from");
   }
   const findAdvice = makeAdviceFinder(seeds, GENERATED_TRACK);

   const wanted = only ? misconceptions.filter((m) => m.id === only) : misconceptions;
   if (wanted.length === 0) {
      fail(`no misconception with id "${only}". Known ids: ${misconceptions.map((m) => m.id).join(", ")}`);
   }

   // Constrain misconception ids in the schema itself, so the model cannot
   // invent a category — CLAUDE.md section 5b.
   const knownIds = misconceptions.map((m) => m.id) as [string, ...string[]];
   const ItemSchema = z.object({
      id: z.string(),
      target: z.string(),
      targetVowelSpelling: z.string(),
      targetVowelSound: z.enum(VOWEL_SOUNDS),
      audio: z.null(),
      track: z.literal(GENERATED_TRACK),
      source: z.literal("generated"),
      options: z
         .array(
            z.object({
               word: z.string(),
               vowelSpelling: z.string(),
               vowelSound: z.enum(VOWEL_SOUNDS),
               correct: z.boolean(),
               misconceptionId: z.enum(knownIds).nullable(),
            })
         )
         .length(3),
   });
   const BatchSchema = z.object({ items: z.array(ItemSchema) });

   const nextId = makeIdAllocator(idsAlreadyUsed(allItems));
   const client = new Anthropic({ apiKey });
   const system = systemPrompt(misconceptions, decodableSeeds, allItems.map((i) => i.target));

   const candidates: CandidateRecord[] = [];
   const errors: CandidatesFile["errors"] = [];

   for (const misconception of wanted) {
      process.stderr.write(`generating ${count} for ${misconception.id}... `);
      try {
         const response = await client.messages.parse({
            model: MODEL,
            max_tokens: MAX_TOKENS,
            thinking: { type: "adaptive" },
            system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
            messages: [{ role: "user", content: userPrompt(misconception, count) }],
            output_config: { effort: "high", format: zodOutputFormat(BatchSchema) },
         });

         const parsed = response.parsed_output;
         if (!parsed) {
            candidates.push({
               requestedMisconception: misconception.id,
               status: "malformed",
               item: null,
               failures: ["model output did not parse against the item schema"],
               warnings: [],
               provisionalAdvice: [],
               raw: response.content,
            });
            process.stderr.write("unparseable\n");
            continue;
         }

         for (const raw of parsed.items) {
            // Mechanical fields are set here, not trusted from the model: the id
            // must not collide, and source/audio/track are ours to state. Advice
            // is inherited, never generated, and always provisional.
            const provisionalAdvice: ProvisionalAdvice[] = [];
            const item: DecodableItem = {
               ...raw,
               id: nextId(raw.target),
               audio: null,
               track: GENERATED_TRACK,
               source: "generated",
               options: raw.options.map((option) => {
                  if (option.correct || option.misconceptionId === null) {
                     return { ...option, parentAdvice: null };
                  }
                  const inherited = findAdvice(option.misconceptionId, option.vowelSound);
                  if (inherited === undefined) return { ...option, parentAdvice: null };
                  provisionalAdvice.push({
                     word: option.word,
                     provisional: true,
                     inheritedFrom: inherited.from,
                     matchedOn: inherited.matchedOn,
                     reason:
                        `copied from seed distractor "${inherited.from.word}" ` +
                        `(${inherited.from.itemId}); names that word, not "${option.word}"`,
                  });
                  return { ...option, parentAdvice: inherited.advice, parentAdviceInherited: true };
               }),
            };
            const { failures, warnings } = validateItem(item, misconceptions);
            candidates.push({
               requestedMisconception: misconception.id,
               status: failures.length === 0 ? "passed" : "failed-validation",
               item,
               failures,
               warnings,
               provisionalAdvice,
            });
         }
         process.stderr.write(`${parsed.items.length} returned\n`);
      } catch (error) {
         const message = describeApiError(error);
         errors.push({ misconceptionId: misconception.id, message });
         process.stderr.write(`failed — ${message}\n`);
      }
   }

   const output: CandidatesFile = {
      generatedAt: new Date().toISOString(),
      model: MODEL,
      candidatesRequestedPerMisconception: count,
      candidates,
      errors,
   };
   fs.writeFileSync(CANDIDATES_PATH, JSON.stringify(output, null, 3) + "\n");

   report(output, allItems, misconceptions);
   // items.json is never written here. Approved items are appended by a human.
   if (errors.length > 0) process.exit(1);
}

function describeApiError(error: unknown): string {
   if (error instanceof Anthropic.AuthenticationError) {
      return "authentication failed — check ANTHROPIC_API_KEY";
   }
   if (error instanceof Anthropic.RateLimitError) return "rate limited";
   if (error instanceof Anthropic.APIError) return `API error ${error.status}: ${error.message}`;
   return error instanceof Error ? error.message : String(error);
}

/* -- reporting ------------------------------------------------------------- */

function report(output: CandidatesFile, bank: Item[], misconceptions: Misconception[]): void {
   const passed = output.candidates.filter((c) => c.status === "passed");
   const failed = output.candidates.filter((c) => c.status === "failed-validation");
   const malformed = output.candidates.filter((c) => c.status === "malformed");

   const perRule = new Map<string, number>();
   for (const candidate of output.candidates) {
      // One count per rule per candidate, not per message.
      const rules = new Set(candidate.failures.map((f) => f.split(":")[0] ?? "unknown"));
      for (const rule of rules) perRule.set(rule, (perRule.get(rule) ?? 0) + 1);
   }

   let sameSound = 0;
   let misconceptionOnly = 0;
   let noAdvice = 0;
   for (const candidate of output.candidates) {
      for (const p of candidate.provisionalAdvice) {
         if (p.matchedOn === "misconception-and-vowel-sound") sameSound++;
         else misconceptionOnly++;
      }
      for (const option of candidate.item?.options ?? []) {
         if (!option.correct && !option.parentAdviceInherited && option.parentAdvice === null) noAdvice++;
      }
   }

   const lines: string[] = [
      "",
      `candidates generated       ${output.candidates.length}`,
      `passed the validator       ${passed.length}`,
      `rejected by the validator  ${failed.length}`,
      `unusable model output      ${malformed.length}`,
      "",
      "distractor advice, all inherited advice is provisional:",
      `  inherited, same misconception + vowel sound  ${sameSound}`,
      `  inherited, same misconception only           ${misconceptionOnly}`,
      `  nothing to inherit                           ${noAdvice}  (fail rule 11)`,
   ];
   if (perRule.size > 0) {
      lines.push("", "rejected by rule (a candidate can break several):");
      for (const [rule, n] of [...perRule].sort()) lines.push(`  ${rule.padEnd(24)} ${n}`);
   }

   // Section 6: report per-misconception item counts on every generation run.
   const survivors = passed.flatMap((c) => (c.item ? [c.item] : []));
   const projected = validateBank([...bank, ...survivors], misconceptions);
   lines.push("", "per-misconception item counts, bank plus survivors:");
   for (const count of projected.counts) {
      const { decodable, irregular } = count.byTrack;
      lines.push(
         `  ${count.misconceptionId.padEnd(20)} decodable ${String(decodable.items).padStart(3)}` +
            `${decodable.underRepresented ? "*" : " "}  irregular ${String(irregular.items).padStart(3)}` +
            `${irregular.underRepresented ? "*" : " "}${count.used ? "" : "  UNUSED"}`
      );
   }
   lines.push("  * under-represented on that track (minimum is per track)");
   // Survivors carry inherited advice until review, so the bank's
   // inherited-advice rule fails every one of them in this projection. That is
   // expected before review, not a problem with the run: summarise it, and list
   // any other bank failure in full.
   const awaitingReview = projected.failures.filter((f) => f.includes("still carries inherited"));
   const otherFailures = projected.failures.filter((f) => !f.includes("still carries inherited"));
   if (awaitingReview.length > 0) {
      lines.push(
         `  ${awaitingReview.length} distractor(s) on survivors still carry inherited advice —`,
         "  none can enter the bank until the reviewer replaces it"
      );
   }
   for (const failure of otherFailures) lines.push(`  ${failure}`);

   lines.push(
      "",
      `wrote ${path.relative(root, CANDIDATES_PATH)} — every candidate, rejections included.`,
      "Nothing was appended to items.json. A human reviews next.",
      ""
   );
   process.stderr.write(lines.join("\n") + "\n");
}

// Only run when invoked directly, so the helpers above can be imported and
// exercised without firing a generation run.
const invokedDirectly =
   process.argv[1] !== undefined &&
   path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) await main();

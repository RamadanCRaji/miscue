/**
 * Headless loop. TASKS.md T12.
 *
 * Proves the engine end to end with no UI: select an item, answer it as a
 * simulated child would, select the next one knowing that answer, and print the
 * diagnosis that falls out. The whole loop is `selectSession` + `diagnose` —
 * this script adds a child and a printer, nothing else, so what it proves is the
 * engine and not a parallel implementation of it.
 *
 *   node scripts/simulate.ts                       both required children, with checks
 *   node scripts/simulate.ts --child <id>          one child who always picks <id>
 *   node scripts/simulate.ts --child correct       one child who never gets one wrong
 *   node scripts/simulate.ts --seed <n>            a different session draw
 *   node scripts/simulate.ts --quiet               summary only, no transcript
 *
 * The default run asserts T12's done condition and exits non-zero if it fails,
 * so it is a check and not just a printout.
 *
 * Makes no model calls and needs no API key.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { diagnose, forParent } from "../src/engine/diagnose.ts";
import type { Answer, Diagnosis, MisconceptionEvidence } from "../src/engine/diagnose.ts";
import { SESSION_LENGTH, selectSession } from "../src/engine/select.ts";
import type { Responder } from "../src/engine/select.ts";
import type { Item, Misconception, Option } from "../src/types.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(here);
const ITEMS_PATH = path.join(root, "src", "data", "items.json");
const MISCONCEPTIONS_PATH = path.join(root, "src", "data", "misconceptions.json");

/** Any fixed number does; it only has to be the same one every run. */
const DEFAULT_SEED = 7;

/* -- the simulated children ------------------------------------------------ */

function optionsOf(item: Item): Option[] {
   return item.options;
}

function correctOption(item: Item): Option {
   const correct = optionsOf(item).find((o) => o.correct);
   if (!correct) throw new Error(`simulate: item "${item.id}" has no correct option`);
   return correct;
}

/**
 * A child who consistently holds one misconception: whenever an item offers that
 * error, they take it. Everything else they get right, which is the point — the
 * engine has to find one pattern inside otherwise correct reading rather than
 * being handed a child who is simply wrong about everything.
 */
function childHolding(misconceptionId: string): Responder {
   return (item) => {
      const trap = optionsOf(item).find((o) => !o.correct && o.misconceptionId === misconceptionId);
      return (trap ?? correctOption(item)).word;
   };
}

/** A child with no gap on either track. Should produce strengths, never a finding. */
const childAnsweringCorrectly: Responder = (item) => correctOption(item).word;

/** Deterministic generator, so a run is reproducible and a demo repeatable. */
function lcg(seed: number): () => number {
   let state = seed >>> 0;
   return () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
   };
}

/* -- reporting ------------------------------------------------------------- */

/** Weighted selections are fractional on the irregular track; 2 vs 2.5 matters. */
function num(value: number): string {
   return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function transcript(answers: Answer[]): string[] {
   return answers.map((answer, i) => {
      const picked = optionsOf(answer.item).find((o) => o.word === answer.pickedWord)!;
      const position = String(i + 1).padStart(2);
      const track = answer.item.track.padEnd(9);
      const target = answer.item.target.padEnd(8);
      const verdict = picked.correct ? "correct" : `wrong  → ${picked.misconceptionId}`;
      return `  ${position}. ${track} ${target} picked ${picked.word.padEnd(10)} ${verdict}`;
   });
}

function evidenceLine(e: MisconceptionEvidence): string {
   const counts = `${num(e.selections)} sel (raw ${e.rawSelections}) / ${e.exposures} exp`;
   return `    ${e.misconceptionId.padEnd(20)} ${e.confidence.padEnd(13)} ${counts}`;
}

function internalReport(diagnosis: Diagnosis): string[] {
   const lines = ["  internal diagnosis (all four states, tracks never averaged)"];
   for (const track of [diagnosis.decodable, diagnosis.irregular]) {
      lines.push(`    [${track.track}] ${track.itemsAnswered} items answered`);
      if (track.evidence.length === 0) lines.push("      no evidence");
      lines.push(...track.evidence.map(evidenceLine));
   }
   return lines;
}

/**
 * What the parent would actually see. Goes through `forParent`, never around it
 * — including for the wording: each finding arrives with its `label` already
 * chosen, deficit for confirmed and strength for ruled out. This script must not
 * reach into `misconceptions.json` and pick one itself, or it would stop being a
 * test of what the parent screen will render.
 */
function parentReport(diagnosis: Diagnosis, misconceptions: Misconception[]): string[] {
   const report = forParent(diagnosis, misconceptions);
   const lines = ["  parent screen (via forParent — suspected is absent by design)"];

   for (const track of [report.decodable, report.irregular]) {
      lines.push(`    [${track.track}]`);
      if (track.headline) lines.push(`      headline: ${track.headline}`);
      for (const e of track.confirmed) {
         lines.push(`      found:    ${e.label}`);
         lines.push(
            `                evidence: ${e.picks.map((p) => `${p.target}→${p.word}`).join(", ")}`
         );
         if (e.advice) lines.push(`                activity: ${truncate(e.advice, 68)}`);
      }
      for (const e of track.ruledOut) {
         lines.push(
            `      strength: ${e.label} — ruled out over ${e.exposures} chances`
         );
      }
      if (track.confirmed.length === 0 && track.ruledOut.length === 0) {
         lines.push("      nothing to report");
      }
   }
   return lines;
}

function truncate(text: string, width: number): string {
   const flat = text.replace(/\s+/g, " ").trim();
   return flat.length <= width ? flat : `${flat.slice(0, width - 1)}…`;
}

/* -- one run --------------------------------------------------------------- */

type Run = {
   name: string;
   answers: Answer[];
   diagnosis: Diagnosis;
};

function run(
   bank: Item[],
   misconceptions: Misconception[],
   name: string,
   respond: Responder,
   seed: number
): Run {
   const answers = selectSession(bank, respond, misconceptions, lcg(seed));
   return { name, answers, diagnosis: diagnose(answers) };
}

function printRun(run: Run, misconceptions: Misconception[], quiet: boolean): void {
   const lines = ["", `── ${run.name} ${"─".repeat(Math.max(0, 58 - run.name.length))}`, ""];
   if (!quiet) lines.push(...transcript(run.answers), "");
   lines.push(...internalReport(run.diagnosis), "", ...parentReport(run.diagnosis, misconceptions));
   process.stdout.write(lines.join("\n") + "\n");
}

/* -- T12's done condition, asserted ---------------------------------------- */

function evidenceFor(diagnosis: Diagnosis, id: string): MisconceptionEvidence | undefined {
   return [...diagnosis.decodable.evidence, ...diagnosis.irregular.evidence].find(
      (e) => e.misconceptionId === id
   );
}

type Check = { ok: boolean; description: string; detail: string };

function checks(held: Run, clean: Run, misconceptions: Misconception[]): Check[] {
   const target = "closed-syllable";
   const holder = evidenceFor(held.diagnosis, target);
   const parentSees = forParent(held.diagnosis, misconceptions).decodable.confirmed.map(
      (e) => e.misconceptionId
   );

   const cleanEvidence = [
      ...clean.diagnosis.decodable.evidence,
      ...clean.diagnosis.irregular.evidence,
   ];
   const ruledOut = cleanEvidence.filter((e) => e.confidence === "ruled-out");
   const confirmed = cleanEvidence.filter((e) => e.confidence === "confirmed");

   return [
      {
         ok: holder?.confidence === "confirmed",
         description: `consistent ${target} child → confirmed ${target}`,
         detail: holder
            ? `${holder.confidence}, ${num(holder.selections)} selections over ${holder.exposures} exposures`
            : "no evidence recorded at all",
      },
      {
         ok: parentSees.includes(target),
         description: "…and it reaches the parent screen through forParent",
         detail: parentSees.length ? `parent sees: ${parentSees.join(", ")}` : "parent sees nothing",
      },
      {
         ok: ruledOut.length > 0,
         description: "always-correct child → ruled-out states",
         detail: ruledOut.length
            ? ruledOut.map((e) => `${e.misconceptionId} (${e.exposures} exp)`).join(", ")
            : "nothing was ruled out",
      },
      {
         ok: confirmed.length === 0,
         description: "…and nothing is confirmed against a child who read correctly",
         detail: confirmed.length
            ? `false positives: ${confirmed.map((e) => e.misconceptionId).join(", ")}`
            : "no false positives",
      },
   ];
}

function printChecks(results: Check[], sessionLength: number): boolean {
   const passed = results.every((c) => c.ok);
   const lines = ["", `── T12 done condition ${"─".repeat(39)}`, ""];
   for (const c of results) {
      lines.push(`  ${c.ok ? "PASS" : "FAIL"}  ${c.description}`);
      lines.push(`        ${c.detail}`);
   }
   if (sessionLength < SESSION_LENGTH) {
      lines.push(
         "",
         `  note: sessions ran ${sessionLength} items, not ${SESSION_LENGTH} — the bank holds only`,
         "        8 approved items. Selection degrades rather than repeating a target.",
         "        Expected to change when reviewed candidates are appended."
      );
   }
   lines.push("", passed ? "  engine proven end to end." : "  CHECKS FAILED.", "");
   process.stdout.write(lines.join("\n") + "\n");
   return passed;
}

/* -- cli ------------------------------------------------------------------- */

function fail(message: string): never {
   console.error(`simulate: ${message}`);
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

type Options = { child: string | null; seed: number; quiet: boolean };

function parseArgs(argv: string[]): Options {
   const options: Options = { child: null, seed: DEFAULT_SEED, quiet: false };
   for (let i = 0; i < argv.length; i += 1) {
      const flag = argv[i];
      if (flag === "--quiet") continue;
      const value = argv[i + 1];
      if (flag === "--child" && value) options.child = value;
      else if (flag === "--seed" && value) options.seed = Number(value);
      else if (flag !== "--quiet") fail(`unrecognised argument "${flag}"`);
      i += 1;
   }
   options.quiet = argv.includes("--quiet");
   if (!Number.isFinite(options.seed)) fail("--seed must be a number");
   return options;
}

function main(): void {
   const options = parseArgs(process.argv.slice(2));
   const bank = readJson<Item[]>(ITEMS_PATH);
   const misconceptions = readJson<Misconception[]>(MISCONCEPTIONS_PATH);
   if (bank.length === 0) fail("items.json is empty");

   const known = new Set(misconceptions.map((m) => m.id));

   if (options.child) {
      // One named child, no checks: an exploratory run for a demo or a sanity look.
      if (options.child !== "correct" && !known.has(options.child)) {
         fail(
            `unknown misconception "${options.child}" — use one of: ${[...known].join(", ")}, or "correct"`
         );
      }
      const respond =
         options.child === "correct" ? childAnsweringCorrectly : childHolding(options.child);
      const name =
         options.child === "correct"
            ? "a child who answers correctly"
            : `a child who consistently holds ${options.child}`;
      printRun(run(bank, misconceptions, name, respond, options.seed), misconceptions, options.quiet);
      return;
   }

   const held = run(
      bank,
      misconceptions,
      "a child who consistently holds closed-syllable",
      childHolding("closed-syllable"),
      options.seed
   );
   const clean = run(
      bank,
      misconceptions,
      "a child who answers correctly",
      childAnsweringCorrectly,
      options.seed
   );

   printRun(held, misconceptions, options.quiet);
   printRun(clean, misconceptions, options.quiet);

   if (!printChecks(checks(held, clean, misconceptions), held.answers.length)) process.exit(1);
}

const invokedDirectly =
   process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) main();

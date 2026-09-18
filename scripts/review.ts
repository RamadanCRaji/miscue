/**
 * Review and the rejection log. CLAUDE.md section 5b; TASKS.md T9.
 *
 * Reads `scripts/candidates.json`, re-runs every candidate through
 * `validateItem`, and writes `scripts/rejection-log.json` — a deliverable, not
 * debug output. Machine rejections and human rejections are tracked separately,
 * because "the validator caught N, the reviewer caught a further M that were
 * structurally valid but pedagogically wrong" is only reportable if they are.
 *
 * Human decisions are recorded here and nowhere else, and are preserved across
 * rebuilds:
 *
 *   node scripts/review.ts                                  rebuild and print
 *   node scripts/review.ts --reject <id> --reason "<why>"   record a rejection
 *   node scripts/review.ts --approve <id>                   record an approval
   node scripts/review.ts --note <id> --text "<what>"      record a note, no decision change
 *
 * Approval is refused while any option on the candidate still carries
 * `parentAdviceInherited: true` — the reviewer replaces the advice in
 * `candidates.json` first (CLAUDE.md section 6). Approval does not write
 * `items.json`; appending approved items to the bank stays a human step.
 *
 * Makes no model calls and needs no API key.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateItem } from "../src/engine/validate.ts";
import type { Item, Misconception, Option } from "../src/types.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(here);
const CANDIDATES_PATH = path.join(here, "candidates.json");
const LOG_PATH = path.join(here, "rejection-log.json");
const MISCONCEPTIONS_PATH = path.join(root, "src", "data", "misconceptions.json");

/* -- shapes ---------------------------------------------------------------- */

/** The subset of `candidates.json` this script reads. */
type CandidatesFile = {
   generatedAt: string;
   model: string;
   candidates: {
      requestedMisconception: string;
      status: string;
      item: Item | null;
      raw?: unknown;
   }[];
   errors: { misconceptionId: string; message: string }[];
};

type HumanDecision = {
   /**
    * `pending-approved` is the reviewer's yes on an item that still carries
    * inherited advice. It is a real decision — it must not be re-reviewed — but
    * it is not an approval: the item cannot enter the bank until the advice is
    * replaced (CLAUDE.md section 6).
    */
   decision: "pending" | "approved" | "pending-approved" | "rejected";
   reason: string | null;
   decidedAt: string | null;
};

/**
 * Where a candidate ended up. Mutually exclusive, and machine review comes
 * first: a candidate the validator rejects never reaches a human.
 */
type Stage =
   | "machine-rejected"
   | "human-rejected"
   | "approved"
   | "approved-pending-advice"
   | "pending-human-review";

export type LogEntry = {
   candidateId: string;
   requestedMisconception: string;
   stage: Stage;
   machine: {
      passed: boolean;
      /** Validator failure strings, each opening `rule N:`. */
      failures: string[];
      /** Rule numbers broken, one per rule. */
      rulesFailed: string[];
      warnings: string[];
   };
   human: HumanDecision;
   /**
    * Superseded decisions, oldest first. A rejection the reviewer later reversed
    * — usually because the item was revised to her instruction — stays here with
    * her original reason. The rejection still happened, and the writeup's
    * "the teacher caught N" number is counted from this, not from the current
    * decision alone.
    */
   history: HumanDecision[];
   /**
    * Things the reviewer checked and wanted on the record without changing the
    * decision — a doubt she considered and dismissed. Evidence that a question
    * was asked, not left unnoticed.
    */
   reviewerNotes: { note: string; at: string }[];
   /** Distractors whose advice is still inherited and so provisional. */
   provisionalAdviceOn: string[];
   /** Null only for model output that never became an item. */
   item: Item | null;
   /** False once a later generation run replaces candidates.json. */
   inCurrentCandidatesFile: boolean;
};

export type Summary = {
   candidatesGenerated: number;
   generationBatchErrors: number;
   machine: {
      rejected: number;
      passRate: string;
      malformed: number;
      failedPerRule: Record<string, number>;
   };
   passedToHuman: number;
   human: {
      rejected: number;
      approved: number;
      /** Reviewer said yes, but inherited advice still blocks bank entry. */
      pendingApproved: number;
      pending: number;
      /** Rejected at some point, whatever the current decision. The "caught by a human" number. */
      rejectedAtLeastOnce: number;
      /** Rejected, then revised to her instruction and kept. */
      revisedAfterRejection: number;
      /** Kept (approved + pending-approved) as a share of what reached a human. */
      passRate: string;
   };
};

export type RejectionLog = {
   updatedAt: string;
   source: { candidatesFile: string; generatedAt: string; model: string };
   notes: string[];
   summary: Summary;
   entries: LogEntry[];
};

/* -- building the log ------------------------------------------------------ */

const PENDING: HumanDecision = { decision: "pending", reason: null, decidedAt: null };

function ruleOf(failure: string): string {
   return failure.split(":")[0] ?? "unknown";
}

function inheritedOn(item: Item | null): string[] {
   if (!item) return [];
   const options: Option[] = item.options;
   return options.filter((o) => o.parentAdviceInherited === true).map((o) => o.word);
}

/**
 * Pure: candidates + previous log -> new log. Human decisions carry over by
 * candidate id. Entries for candidates no longer in `candidates.json` are kept,
 * marked, so a later generation run cannot erase earlier review history.
 */
export function buildLog(
   candidates: CandidatesFile,
   previous: RejectionLog | null,
   misconceptions: Misconception[],
   now: string
): RejectionLog {
   const previousById = new Map((previous?.entries ?? []).map((e) => [e.candidateId, e]));
   const entries: LogEntry[] = [];
   const seen = new Set<string>();

   candidates.candidates.forEach((candidate, index) => {
      const item = candidate.item;
      const candidateId = item?.id ?? `malformed-${candidates.generatedAt}-${index}`;
      seen.add(candidateId);

      const { failures, warnings } = item
         ? validateItem(item, misconceptions)
         : { failures: ["model output did not parse against the item schema"], warnings: [] };
      const passed = failures.length === 0;

      // A human decision only stands on a candidate the machine passed.
      const previousHuman = previousById.get(candidateId)?.human ?? PENDING;
      const provisionalAdviceOn = inheritedOn(item);

      // An approval is re-checked against the advice on every rebuild, not
      // trusted from the previous log: advice can be edited in candidates.json
      // between runs, in either direction. An approval whose advice is inherited
      // again drops back to pending-approved; a pending-approved whose advice has
      // been replaced becomes a full approval.
      const history = previousById.get(candidateId)?.history ?? [];
      const reviewerNotes = previousById.get(candidateId)?.reviewerNotes ?? [];
      const human: HumanDecision =
         previousHuman.decision === "approved" && provisionalAdviceOn.length > 0
            ? { ...previousHuman, decision: "pending-approved" }
            : previousHuman.decision === "pending-approved" && provisionalAdviceOn.length === 0
              ? { ...previousHuman, decision: "approved" }
              : previousHuman;

      const stage: Stage = !passed
         ? "machine-rejected"
         : human.decision === "rejected"
           ? "human-rejected"
           : human.decision === "approved"
             ? "approved"
             : human.decision === "pending-approved"
               ? "approved-pending-advice"
               : "pending-human-review";

      entries.push({
         candidateId,
         requestedMisconception: candidate.requestedMisconception,
         stage,
         machine: {
            passed,
            failures,
            rulesFailed: [...new Set(failures.map(ruleOf))],
            warnings,
         },
         human,
         history,
         reviewerNotes,
         provisionalAdviceOn,
         item,
         inCurrentCandidatesFile: true,
      });
   });

   for (const old of previous?.entries ?? []) {
      if (!seen.has(old.candidateId)) entries.push({ ...old, inCurrentCandidatesFile: false });
   }

   const summary = summarise(entries, candidates.errors.length);
   return {
      updatedAt: now,
      source: {
         candidatesFile: "scripts/candidates.json",
         generatedAt: candidates.generatedAt,
         model: candidates.model,
      },
      notes: notesFor(summary),
      summary,
      entries,
   };
}

function summarise(entries: LogEntry[], batchErrors: number): Summary {
   const count = (stage: Stage) => entries.filter((e) => e.stage === stage).length;
   const failedPerRule: Record<string, number> = {};
   for (const entry of entries) {
      for (const rule of entry.machine.rulesFailed) failedPerRule[rule] = (failedPerRule[rule] ?? 0) + 1;
   }
   const machineRejected = count("machine-rejected");
   const total = entries.length;
   const passedToHuman = total - machineRejected;
   const kept = count("approved") + count("approved-pending-advice");
   const everRejected = entries.filter(
      (e) => e.human.decision === "rejected" || e.history.some((h) => h.decision === "rejected")
   );
   return {
      candidatesGenerated: total,
      generationBatchErrors: batchErrors,
      machine: {
         rejected: machineRejected,
         passRate: total === 0 ? "n/a" : `${Math.round(((total - machineRejected) / total) * 100)}%`,
         malformed: entries.filter((e) => e.item === null).length,
         failedPerRule,
      },
      passedToHuman,
      human: {
         rejected: count("human-rejected"),
         approved: count("approved"),
         pendingApproved: count("approved-pending-advice"),
         pending: count("pending-human-review"),
         rejectedAtLeastOnce: everRejected.length,
         revisedAfterRejection: everRejected.filter((e) => e.human.decision !== "rejected").length,
         passRate: passedToHuman === 0 ? "n/a" : `${Math.round((kept / passedToHuman) * 100)}%`,
      },
   };
}

/**
 * The context the numbers need in order not to mislead. Written into the log so
 * it travels with the counts into the writeup.
 */
function notesFor(summary: Summary): string[] {
   const notes = [
      "Machine and human rejections are counted separately. The human-rejection count is the meaningful " +
         "number: it measures what is structurally valid but pedagogically wrong, which no validator can catch.",
   ];
   if (summary.candidatesGenerated > 0 && summary.machine.rejected === 0) {
      notes.push(
         `Zero machine rejections: ${summary.candidatesGenerated} of ${summary.candidatesGenerated} candidates ` +
            `passed validateItem, a ${summary.machine.passRate} pass rate. That reflects the constrained schema, ` +
            "not item quality. Generation uses structured outputs: misconceptionId is an enum of the real ids, so " +
            "rule 6 cannot break; vowelSound is restricted to the vocabulary; options are exactly three, so " +
            "rule 1 cannot break; and track, source and audio are fixed by the script. The remaining hard rules " +
            "are stated in the prompt, and rule 11 is met because the script attaches inherited advice rather " +
            "than the model writing any. None of this checks whether a vowel tag is true or an item teaches " +
            "well, so a clean machine pass says nothing about pedagogy."
      );
   }
   if (summary.human.revisedAfterRejection > 0) {
      notes.push(
         `The teacher rejected ${summary.human.rejectedAtLeastOnce} candidate(s). ` +
            `${summary.human.revisedAfterRejection} of those were then revised by hand to her instructions and kept, ` +
            `leaving ${summary.human.rejected} still rejected. "Caught by a human" is ` +
            `${summary.human.rejectedAtLeastOnce}, not ${summary.human.rejected}: the rejection is what the ` +
            "validator missed, and the revision is what her reason made possible. Original reasons are in each " +
            "entry's history."
      );
   }
   if (summary.human.pendingApproved > 0) {
      notes.push(
         `${summary.human.pendingApproved} candidate(s) are pending-approved: the reviewer accepted the item, but ` +
            "it still carries advice inherited from a seed distractor, which names the seed's word rather than " +
            "this item's. None of them can enter the bank until that advice is replaced (CLAUDE.md section 6). " +
            "They count as kept in the human pass rate — the reviewer's judgement on the item is settled."
      );
   }
   if (summary.human.pending > 0) {
      notes.push(
         `${summary.human.pending} candidate(s) await human review. Until review is complete, the human-rejection ` +
            "count is incomplete and should not be reported as a finding."
      );
   }
   return notes;
}

/* -- human decisions ------------------------------------------------------- */

export type DecisionRequest =
   | { kind: "approve"; candidateId: string }
   | { kind: "reject"; candidateId: string; reason: string }
   | { kind: "note"; candidateId: string; text: string };

/**
 * Pure: applies one human decision to a log, or explains why it cannot.
 * Returns the updated log, or an error message and the log unchanged.
 */
export function applyDecision(
   log: RejectionLog,
   request: DecisionRequest,
   now: string
): { log: RejectionLog; error: string | null } {
   const entry = log.entries.find((e) => e.candidateId === request.candidateId);
   if (!entry) return { log, error: `no candidate "${request.candidateId}" in the log` };
   if (request.kind === "note") {
      // A note records what the reviewer considered. It never moves the item.
      const entries = log.entries.map((e) =>
         e.candidateId === request.candidateId
            ? { ...e, reviewerNotes: [...e.reviewerNotes, { note: request.text, at: now }] }
            : e
      );
      return { log: { ...log, updatedAt: now, entries }, error: null };
   }
   if (!entry.machine.passed) {
      return {
         log,
         error: `"${request.candidateId}" was rejected by the validator; a human decision cannot override that`,
      };
   }
   // An approval on an item whose advice is still inherited is recorded as
   // pending-approved rather than refused: the reviewer's yes is real and should
   // not be lost or re-asked, but the item still cannot enter the bank until the
   // advice naming the seed's word is replaced.
   const blocked = request.kind === "approve" && entry.provisionalAdviceOn.length > 0;

   const human: HumanDecision =
      request.kind === "approve"
         ? { decision: blocked ? "pending-approved" : "approved", reason: null, decidedAt: now }
         : { decision: "rejected", reason: request.reason, decidedAt: now };
   // A decision that replaces a real earlier one is kept, not overwritten.
   const history =
      entry.human.decision === "pending" ? entry.history : [...entry.history, entry.human];
   const stage: Stage =
      request.kind === "reject" ? "human-rejected" : blocked ? "approved-pending-advice" : "approved";
   const entries = log.entries.map((e) =>
      e.candidateId === request.candidateId ? { ...e, human, history, stage } : e
   );
   const summary = summarise(entries, log.summary.generationBatchErrors);
   return { log: { ...log, updatedAt: now, entries, summary, notes: notesFor(summary) }, error: null };
}

/* -- cli ------------------------------------------------------------------- */

function fail(message: string): never {
   console.error(`review: ${message}`);
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

function parseArgs(argv: string[]): DecisionRequest | null {
   if (argv.length === 0) return null;
   const [flag, id, ...rest] = argv;
   if (flag === "--approve" && id && rest.length === 0) return { kind: "approve", candidateId: id };
   if (flag === "--note" && id && rest[0] === "--text" && rest[1] && rest[1].trim() !== "") {
      return { kind: "note", candidateId: id, text: rest[1] };
   }
   if (flag === "--reject" && id && rest[0] === "--reason" && rest[1] && rest[1].trim() !== "") {
      return { kind: "reject", candidateId: id, reason: rest[1] };
   }
   return fail(
      "usage: node scripts/review.ts\n" +
         "  --approve <id>\n" +
         '  --reject <id> --reason "<why>"   a rejection needs a reason; it is the evidence\n' +
         '  --note <id> --text "<what she checked>"   records a note, no decision change'
   );
}

function printSummary(log: RejectionLog): void {
   const s = log.summary;
   const rules = Object.entries(s.machine.failedPerRule).sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true }));
   const lines = [
      "",
      `candidates generated        ${s.candidatesGenerated}`,
      "",
      "MACHINE (validateItem)",
      `  rejected                  ${s.machine.rejected}   (pass rate ${s.machine.passRate})`,
      `  of which malformed        ${s.machine.malformed}`,
      "  failed per rule           " + (rules.length ? rules.map(([r, n]) => `${r}: ${n}`).join(", ") : "none"),
      "",
      `passed to human             ${s.passedToHuman}`,
      "",
      "HUMAN (reviewer)",
      `  rejected                  ${s.human.rejected}   (pass rate ${s.human.passRate})`,
      `  rejected at some point     ${s.human.rejectedAtLeastOnce}   (revised and kept: ${s.human.revisedAfterRejection})`,
      `  approved                  ${s.human.approved}`,
      `  approved, advice pending  ${s.human.pendingApproved}`,
      `  pending review            ${s.human.pending}`,
   ];
   if (s.generationBatchErrors > 0) {
      lines.push("", `generation batches that errored: ${s.generationBatchErrors}`);
   }
   lines.push("", ...log.notes.map((n) => `note: ${n}`), "", `wrote ${path.relative(root, LOG_PATH)}`, "");
   process.stdout.write(lines.join("\n") + "\n");
}

async function main(): Promise<void> {
   const request = parseArgs(process.argv.slice(2));
   if (!fs.existsSync(CANDIDATES_PATH)) fail("no scripts/candidates.json — run npm run generate first");

   const candidates = readJson<CandidatesFile>(CANDIDATES_PATH);
   const misconceptions = readJson<Misconception[]>(MISCONCEPTIONS_PATH);
   const previous = fs.existsSync(LOG_PATH) ? readJson<RejectionLog>(LOG_PATH) : null;
   const now = new Date().toISOString();

   let log = buildLog(candidates, previous, misconceptions, now);
   if (request) {
      const result = applyDecision(log, request, now);
      if (result.error) fail(result.error);
      log = result.log;
   }

   fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 3) + "\n");
   printSummary(log);
}

const invokedDirectly =
   process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) await main();

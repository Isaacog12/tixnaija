// Throwaway harness: transpiles the pure rule functions out of the support-bot
// source and exercises them. Deleted after the run.
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const file = path.join(__dirname, "supabase", "functions", "support-bot", "index.ts");
const src = fs.readFileSync(file, "utf8");

const start = src.indexOf("function normalise(");
const end = src.indexOf('const LAGOS = "Africa/Lagos";');
if (start < 0 || end < 0 || end <= start) {
  console.error("could not slice rule functions", { start, end });
  process.exit(1);
}

const slice = src.slice(start, end);
const js = ts.transpileModule(slice, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;

const mod = { exports: {} };
const load = new Function(
  "module",
  "exports",
  js +
    "\nmodule.exports = { containsSensitiveData, looksSubstantive, detectIntent, extractSearchTerm, isAdjacentSwap };",
);
load(mod, mod.exports);
const { containsSensitiveData, looksSubstantive, detectIntent, extractSearchTerm } = mod.exports;

let failures = 0;
function check(group, input, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${group}  "${input}" -> ${JSON.stringify(actual)}${ok ? "" : ` (expected ${JSON.stringify(expected)})`}`);
}

console.log("--- sensitive data: must be refused ---");
const refused = [
  "my card is 4012888888881881",
  "4012 8888 8888 1881",
  "cvv 123",
  "my cvv is 456",
  "otp 123456",
  "password is hunter2",
  "account number 0123456789",
  "expiry 12/30",
  "bvn 12345678901",
];
for (const t of refused) check("refuse", t, containsSensitiveData(t), true);

console.log("\n--- sensitive data: must NOT be refused ---");
const allowed = [
  "i forgot my password",
  "how do i reset my password",
  "my password isn't working",
  "the otp is not arriving",
  "cvv field is missing",
  "when is the lagos party",
  "i bought 2 tickets",
  "my number is +2348012345678",
  "my card was declined",
  "what is a cvv",
];
for (const t of allowed) check("allow", t, containsSensitiveData(t), false);

console.log("\n--- triage gate ---");
for (const [t, want] of [
  ["asdf", false],
  ["???", false],
  ["hmm", false],
  ["ok", false],
  ["...", false],
  ["my money is stuck", true],
  ["when is afro nation?", true],
  ["refund", true],
]) check("triage", t, looksSubstantive(t), want);

console.log("\n--- intent detection ---");
for (const [t, want] of [
  ["i forgot my password", "account"],
  ["reset my password please", "account"],
  ["refund me abeg", "refund"],
  ["tickts not sent", "order"],
  ["my ticket no dey", "order"],
  ["how much be the gate fee", "price"],
  ["where e dey hold", "venue"],
  ["abeg refund my money", "refund"],
  ["i want to talk to a person", "human"],
  ["when is detty december", "schedule"],
  ["is it sold out", "availability"],
]) check("intent", t, detectIntent(t).intent, want);

console.log("\n--- search term ---");
const cases = [
  ["when is detty december", "detty december"],
  ["how much is the lagos party", "lagos"],
];
for (const [t, want] of cases) {
  const d = detectIntent(t);
  const got = extractSearchTerm(t, d.matched);
  check("search", t, got, want);
}

console.log(`\n${failures === 0 ? "ALL PASS" : failures + " FAILURE(S)"}`);
process.exit(failures === 0 ? 0 : 1);

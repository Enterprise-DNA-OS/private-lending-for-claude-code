#!/usr/bin/env node
// The one CLI for the private lending desk. Human tables by default, --json for machines.
// Money is entered in dollars (1250000 or 1250000.50) and stored in cents.
// Rates and LVR limits are entered as percentages (9.95) and stored in basis points.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { getDb, REPO_ROOT } from "./lib/db.mjs";
import { table, heading } from "./lib/format.mjs";
import { parseCsv, pick } from "./lib/csv.mjs";

export const SPECS = {
  help: "",
  borrowers: "",
  investors: "",
  loans: "",
  show: "",
  statement: "",
  book: "",
  arrears: "",
  maturities: "",
  lvr: "",
  valuations: "",
  conditions: "",
  funding: "",
  attention: "",
  compliance: "",
  insights: "",
  history: "",
  "add-borrower": "code name type contact email actor",
  "add-investor": "code name type email actor",
  "add-loan": "code borrower purpose type limit rate default-rate repayment max-lvr currency manager actor",
  "add-security": "code address type actor",
  value: "market complete on valuer independent actor",
  insure: "expires note actor",
  "verify-kyc": "on method actor",
  "certify-investor": "on actor",
  "declare-purpose": "on actor",
  approve: "note actor",
  settle: "on maturity amount evidence actor",
  drawdown: "amount on evidence event actor",
  accrue: "to actor",
  "charge-fee": "amount on note event actor",
  receive: "amount on event note actor",
  extend: "maturity note actor",
  default: "on note actor",
  discharge: "on note actor",
  withdraw: "note actor",
  allocate: "investor amount rate on actor",
  "add-condition": "code title owner due actor",
  "meet-condition": "on evidence actor",
  review: "note actor",
  log: "note actor",
  import: "source date-format dry-run actor",
  export: "out",
  "weekly-review": "",
  "draft-arrears-letter": "",
  "draft-maturity-letter": "",
  "draft-investor-statement": "from to",
};
export const COMMANDS = Object.keys(SPECS);

const WRITES = new Set([
  "add-borrower", "add-investor", "add-loan", "add-security", "value", "insure", "verify-kyc",
  "certify-investor", "declare-purpose", "approve", "settle", "drawdown", "accrue", "charge-fee",
  "receive", "extend", "default", "discharge", "withdraw", "allocate", "add-condition",
  "meet-condition", "review", "log", "import",
]);
// Which record the first positional argument names.
const TARGET = {
  show: "loans", statement: "loans", history: "loans", "add-security": "loans", "declare-purpose": "loans",
  approve: "loans", settle: "loans", drawdown: "loans", "charge-fee": "loans", receive: "loans",
  extend: "loans", default: "loans", discharge: "loans", withdraw: "loans", allocate: "loans",
  "add-condition": "loans", review: "loans", log: "loans", "draft-arrears-letter": "loans",
  "draft-maturity-letter": "loans", value: "securities", insure: "securities", "verify-kyc": "borrowers",
  "certify-investor": "investors", "draft-investor-statement": "investors", "meet-condition": "conditions",
};
const TABLES = ["borrowers", "investors", "loans", "securities", "ledger", "allocations", "conditions", "audit_events"];
const NAME_COL = {
  borrowers: "t.name",
  investors: "t.name",
  loans: "(select b.name from borrowers b where b.id=t.borrower_id)",
  securities: "t.address",
  conditions: "t.title",
};

// ---------- small validators ----------
export const today = () => new Date().toISOString().slice(0, 10);
export function addDays(d, n) {
  const x = new Date(d + "T00:00:00Z");
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}
const daysBetween = (a, b) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
function date(s, key, optional = false) {
  if ((s === undefined || s === "" || s === true) && optional) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) || new Date(s + "T00:00:00Z").toISOString().slice(0, 10) !== s)
    throw Error(`Invalid --${key}: use YYYY-MM-DD`);
  return s;
}
function notFuture(d, key) {
  if (d > today()) throw Error(`--${key} cannot be in the future`);
  return d;
}
function required(o, k) {
  if (typeof o[k] !== "string" || !o[k].trim()) throw Error(`Required --${k}=value`);
  return o[k].trim();
}
function code(s) {
  if (!/^[a-z0-9][a-z0-9_.:-]{0,59}$/i.test(s || "")) throw Error("Codes use letters, numbers, dot, colon, underscore or hyphen");
  return s;
}
export function cents(s, key) {
  const v = String(s ?? "").replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(v)) throw Error(`Invalid --${key}: a dollar amount like 250000 or 1250.50`);
  const [whole, frac = ""] = v.split(".");
  const n = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  if (!Number.isSafeInteger(n) || n <= 0) throw Error(`Invalid --${key}`);
  return n;
}
export function bps(s, key, max = 100) {
  const v = String(s ?? "").replace(/%$/, "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(v) || Number(v) > max) throw Error(`Invalid --${key}: a percentage like 9.95`);
  return Math.round(Number(v) * 100);
}
const choice = (s, key, list, dflt) => {
  const v = (s === undefined ? dflt : String(s)).toLowerCase();
  if (!list.includes(v)) throw Error(`--${key} must be one of ${list.join(", ")}`);
  return v;
};
const yes = (s) => ["yes", "true", "y", "1"].includes(String(s ?? "").toLowerCase());

function parse(args) {
  const pos = [], o = {};
  for (const a of args) {
    if (a.startsWith("--")) {
      const n = a.indexOf("=");
      const k = n < 0 ? a.slice(2) : a.slice(2, n);
      if (k in o) throw Error(`Duplicate --${k}`);
      o[k] = n < 0 ? true : a.slice(n + 1);
    } else pos.push(a);
  }
  const cmd = pos.shift() || "help";
  if (!(cmd in SPECS)) throw Error(`Unknown command ${cmd}. Run help for the list.`);
  const allowed = new Set([...SPECS[cmd].split(" ").filter(Boolean), "json"]);
  for (const k of Object.keys(o)) if (!allowed.has(k)) throw Error(`Unknown --${k} for ${cmd}`);
  return { cmd, pos, o };
}

// Code, uuid, exact name, then a unique partial match. Ambiguous lists the candidates.
export async function resolve(db, tableName, needle) {
  if (!NAME_COL[tableName]) throw Error("Invalid lookup");
  if (!needle) throw Error(`A ${tableName.replace(/s$/, "")} reference is required`);
  const nameCol = NAME_COL[tableName];
  const base = `select t.*, ${nameCol} as _name from ${tableName} t`;
  let rows = await db.query(`${base} where lower(t.code)=lower($1) or t.id::text=$1`, [needle]);
  if (rows.length === 1) return rows[0];
  rows = await db.query(`${base} where lower(${nameCol})=lower($1) order by t.code`, [needle]);
  if (rows.length === 1) return rows[0];
  if (rows.length > 1) throw Error(`Ambiguous ${needle}: ${rows.map((r) => `${r.code} (${r._name})`).join(", ")}. Use a code.`);
  rows = await db.query(
    `${base} where starts_with(t.id::text, lower($1)) or position(lower($1) in lower(t.code))>0 or position(lower($1) in lower(${nameCol}))>0 order by t.code`,
    [needle],
  );
  if (rows.length === 1) return rows[0];
  throw Error(rows.length
    ? `Ambiguous ${needle}: ${rows.map((r) => `${r.code} (${r._name})`).join(", ")}. Use a code.`
    : `No ${tableName} match: ${needle}`);
}

const audit = (db, id, action, actor, detail) =>
  db.query("insert into audit_events(entity_id,action,actor,detail) values($1,$2,$3,$4)", [id, action, actor, JSON.stringify(detail)]);
const loanView = async (db, id) => (await db.query("select * from v_loans where id=$1", [id]))[0];
async function post(db, loanId, kind, amount, on, extra = {}) {
  const [row] = await db.query(
    "insert into ledger(loan_id,posted_on,kind,amount_cents,period_from,period_to,evidence,note,event_key) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *",
    [loanId, on, kind, amount, extra.from || null, extra.to || null, extra.evidence || "", extra.note || "", extra.event],
  );
  return row;
}
function notBeforeAccrual(l, on) {
  if (l.interest_to && on < l.interest_to)
    throw Error(`${l.code} has interest charged to ${l.interest_to}. Entries dated earlier would change interest already charged: post an adjustment instead.`);
}

// Interest for one loan from the day after interest_to up to and including `to`, actual/365.
// Each day uses the balance at the end of the previous day. The default rate applies after
// maturity and from the recorded default date.
export async function interestFor(db, l, to) {
  const from = l.interest_to || l.settled_on;
  if (!from || to <= from) return { cents: 0, from, days: 0 };
  const entries = await db.query("select posted_on,kind,amount_cents from ledger where loan_id=$1 and posted_on<$2 order by posted_on", [l.id, to]);
  let total = 0, days = 0;
  for (let d = addDays(from, 1); d <= to; d = addDays(d, 1)) {
    let drawn = 0, charged = 0, adj = 0, paid = 0;
    for (const e of entries) {
      if (e.posted_on >= d) break;
      const a = Number(e.amount_cents);
      if (e.kind === "drawdown") drawn += a;
      else if (e.kind === "interest" || e.kind === "fee") charged += a;
      else if (e.kind === "adjustment") adj += a;
      else paid += a;
    }
    const base = l.repayment === "capitalised" ? drawn + charged + adj - paid : drawn + adj - Math.max(0, paid - charged);
    const late = (l.maturity_on && d > l.maturity_on) || (l.default_on && d >= l.default_on);
    const rate = late && l.default_rate_bps > 0 ? l.default_rate_bps : l.rate_bps;
    total += (Math.max(0, base) * rate) / 10000 / 365;
    days++;
  }
  return { cents: Math.round(total), from: addDays(from, 1), days };
}

// ---------- reads ----------
const READS = {
  borrowers: "select code,name,entity_type,contact,kyc_verified_on,(select count(*)::int from loans l where l.borrower_id=b.id and l.status in ('approved','settled','default')) live_loans from borrowers b order by code",
  investors: "select code,name,investor_type,certificate_on,kyc_verified_on,(select coalesce(sum(amount_cents),0)::bigint from allocations a join loans l on l.id=a.loan_id where a.investor_id=i.id and l.status in ('settled','default','approved')) allocated_cents from investors i order by code",
  loans: "select code,borrower,loan_type,status,limit_cents,balance_cents,rate_bps,current_lvr_bps,maturity_on,manager from v_loans order by code",
  book: "select status,count(*)::int loans,sum(limit_cents)::bigint limit_cents,sum(balance_cents)::bigint balance_cents,round(sum(rate_bps::numeric*balance_cents)/nullif(sum(balance_cents),0))::int weighted_rate_bps,round(sum(coalesce(current_lvr_bps,0)::numeric*balance_cents)/nullif(sum(balance_cents),0))::int weighted_lvr_bps from v_loans group by status order by status",
  arrears: "select * from v_arrears order by days_in_arrears desc, code",
  maturities: "select * from v_maturities order by maturity_on, code",
  lvr: "select code,borrower,loan_type,limit_cents,balance_cents,committed_lvr_bps,current_lvr_bps,max_lvr_bps,benchmark_lvr_bps,over_policy,over_benchmark from v_lvr order by greatest(coalesce(committed_lvr_bps,0),coalesce(current_lvr_bps,0)) desc",
  valuations: "select code,loan,address,market_value_cents,complete_value_cents,valued_on,age_days,valuer,valuer_independent,insurance_expires_on from v_valuations order by valued_on nulls first, code",
  conditions: "select * from v_conditions order by due_on, code",
  funding: "select * from v_investor_funding order by unfunded_cents desc, code",
  attention: "select * from v_attention order by due_on, code, issue",
  compliance: "select * from v_compliance order by rule, code",
};

export const QUESTIONS = [
  ["Which loans are in arrears, and for how many days?",
    "select code,borrower,arrears_cents,days_in_arrears,last_payment_on from v_arrears order by days_in_arrears desc"],
  ["Which loans have passed maturity without being repaid?",
    "select code,borrower,maturity_on,-days_to_maturity days_past,balance_cents from v_loans where status in ('settled','default') and maturity_on<current_date order by maturity_on"],
  ["Which loans sit above their LVR limit today?",
    "select code,borrower,committed_lvr_bps,current_lvr_bps,max_lvr_bps from v_lvr where over_policy"],
  ["Which construction draws were paid without a progress report?",
    "select l.code,g.posted_on,g.amount_cents,g.note from ledger g join loans l on l.id=g.loan_id where l.loan_type='construction' and g.kind='drawdown' and g.evidence='' order by g.posted_on"],
  ["Which securities were last valued more than twelve months ago?",
    "select code,loan,address,valued_on,age_days from v_valuations where valued_on<current_date-365 order by valued_on"],
  ["Which mortgaged properties have insurance lapsed or expiring within 30 days?",
    "select code,loan,address,insurance_expires_on from v_valuations where insurance_expires_on is null or insurance_expires_on<=current_date+30 order by insurance_expires_on nulls first"],
  ["Which loans are drawn beyond what investors have funded?",
    "select code,borrower,drawn_cents,allocated_cents,unfunded_cents from v_investor_funding where unfunded_cents>0 order by unfunded_cents desc"],
  ["Which investors hold a certificate older than two years?",
    "select code,name,investor_type,certificate_on from investors where investor_type in ('wholesale','sophisticated') and (certificate_on is null or certificate_on<current_date-730) order by code"],
  ["How much interest will each live loan earn over the next 30 days at today's balance?",
    "select code,borrower,balance_cents,rate_bps,round(balance_cents*rate_bps/10000.0*30/365)::bigint next_30_days_cents from v_loans where status in ('settled','default') and repayment='interest_only' order by 4 desc"],
  ["What is our exposure to each borrower, and what share of the book is it?",
    "select borrower,count(*)::int loans,sum(balance_cents)::bigint balance_cents,round(100.0*sum(balance_cents)/nullif((select sum(balance_cents) from v_loans where status in ('settled','default')),0),1) share_pct from v_loans where status in ('settled','default') group by borrower order by 3 desc"],
];

function writeFile(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, contents, { mode: 0o600, flag: "wx" });
  return file;
}
const draftsDir = () => path.join(process.env.OUTPUT_DIR || REPO_ROOT, "drafts");
const draft = (name, text) => writeFile(path.join(draftsDir(), `${name}-${today()}-${process.pid}-${Date.now()}.md`), text);
const dollars = (c, cur = "") => `${cur ? cur + " " : ""}${(Number(c || 0) / 100).toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (b) => (b === null || b === undefined ? "" : `${(Number(b) / 100).toFixed(2)}%`);

// ---------- import ----------
async function readImport(file) {
  if (!file || !fs.existsSync(file)) throw Error("Import file not found");
  const ext = path.extname(file).toLowerCase();
  if (ext === ".csv") return parseCsv(fs.readFileSync(file, "utf8"));
  if (ext !== ".xlsx") throw Error("Use a .csv or .xlsx loan tape");
  const { default: ExcelJS } = await import("exceljs");
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile(file);
  if (book.worksheets.length !== 1) throw Error("Expected one worksheet: export the loan tape on its own");
  const sheet = book.worksheets[0];
  const lines = [];
  sheet.eachRow((row) => {
    const vals = [];
    for (let c = 1; c <= sheet.columnCount; c++) {
      const v = row.getCell(c).value;
      if (v && typeof v === "object" && !(v instanceof Date)) throw Error("Formula or rich text cells need converting to plain values first");
      vals.push(v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? ""));
    }
    lines.push(vals.map((v) => '"' + v.replaceAll('"', '""') + '"').join(","));
  });
  return parseCsv(lines.join("\n"));
}
export function tapeDate(raw, fmt, label) {
  const s = String(raw || "").trim();
  if (!s) return null;
  let y, m, d;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) [y, m, d] = s.slice(0, 10).split("-");
  else {
    const parts = s.split(/[/.-]/);
    if (parts.length !== 3 || fmt === "ymd") throw Error(`${label}: "${s}" needs --date-format=dmy or mdy`);
    [d, m, y] = fmt === "dmy" ? parts : [parts[1], parts[0], parts[2]];
    if (y.length === 2) y = "20" + y;
  }
  const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return date(iso, label);
}
const H = {
  id: ["Loan Number", "Loan #", "Loan ID", "Loan Id", "Loan No"],
  borrower: ["Borrower", "Borrower Name", "Primary Borrower", "Borrowers"],
  amount: ["Loan Amount", "Original Principal", "Principal", "Commitment", "Total Loan Amount"],
  balance: ["Principal Balance", "Outstanding Principal", "Current Balance", "Outstanding Balance"],
  rate: ["Interest Rate", "Note Rate", "Rate"],
  funded: ["Funding Date", "Funded Date", "Closing Date", "Settlement Date"],
  maturity: ["Maturity Date", "Maturity"],
  paidTo: ["Interest Paid To", "Paid To Date", "Paid Through"],
  address: ["Property Address", "Collateral Address", "Security Address", "Property"],
  value: ["Appraised Value", "Property Value", "Valuation", "Market Value"],
  valuedOn: ["Appraisal Date", "Valuation Date"],
  type: ["Loan Type", "Product", "Loan Product"],
  status: ["Loan Status", "Status"],
  position: ["Lien Position", "Position", "Priority"],
};
async function importTape(db, file, o) {
  const source = code(required(o, "source")), actor = required(o, "actor");
  const fmt = choice(o["date-format"], "date-format", ["ymd", "dmy", "mdy"], "ymd");
  const rows = await readImport(file);
  if (!rows.length) throw Error("No rows in the loan tape");
  if (Object.keys(rows[0]).some((k) => /ssn|social security|tax file|tfn|ird|bank account|account number|password|date of birth|dob/i.test(k)))
    throw Error("Remove identity numbers, bank accounts and dates of birth from the tape before importing");
  const out = { added: 0, unchanged: 0, borrowers_added: 0, loans: [] };
  for (const [i, row] of rows.entries()) {
    const label = `Row ${i + 2}`;
    const sourceId = pick(row, ...H.id);
    if (!sourceId) throw Error(`${label}: needs a loan number column (${H.id.join(", ")})`);
    const prior = await db.query("select id,code,source_payload from loans where source=$1 and source_id=$2", [source, sourceId]);
    if (prior.length) {
      const norm = (x) => JSON.stringify(Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))));
      if (norm(prior[0].source_payload) !== norm(row)) throw Error(`${label}: loan ${sourceId} changed since the last import. Reconcile it by hand.`);
      out.unchanged++;
      continue;
    }
    const borrowerName = pick(row, ...H.borrower);
    if (!borrowerName) throw Error(`${label}: needs a borrower`);
    const limit = cents(pick(row, ...H.amount), `${label} loan amount`);
    const balRaw = pick(row, ...H.balance);
    const balance = balRaw ? (Number(String(balRaw).replace(/[$,\s]/g, "")) === 0 ? 0 : cents(balRaw, `${label} balance`)) : limit;
    const rate = bps(pick(row, ...H.rate), `${label} interest rate`);
    const funded = tapeDate(pick(row, ...H.funded), fmt, `${label} funding date`);
    if (!funded) throw Error(`${label}: needs a funding date`);
    const maturity = tapeDate(pick(row, ...H.maturity), fmt, `${label} maturity date`);
    const paidTo = tapeDate(pick(row, ...H.paidTo), fmt, `${label} interest paid to`) || today();
    const rawType = pick(row, ...H.type).toLowerCase();
    const type = /construct|develop/.test(rawType) ? "construction" : /bridg/.test(rawType) ? "bridging" : /land/.test(rawType) ? "land" : /line|revolv/.test(rawType) ? "line" : "term";
    const rawStatus = pick(row, ...H.status).toLowerCase();
    const status = /paid off|payoff|discharg|closed|repaid/.test(rawStatus) ? "discharged" : /default|foreclos|enforce/.test(rawStatus) ? "default" : "settled";
    let [b] = await db.query("select id from borrowers where lower(name)=lower($1)", [borrowerName]);
    if (!b) {
      const n = (await db.query("select count(*)::int n from borrowers"))[0].n + 1;
      [b] = await db.query("insert into borrowers(code,name) values($1,$2) returning id", [`BR-${source.toUpperCase()}-${String(n).padStart(3, "0")}`.slice(0, 60), borrowerName]);
      out.borrowers_added++;
    }
    const loanCode = code(`${source.toUpperCase()}-${sourceId}`.replace(/[^a-z0-9_.:-]/gi, "-").slice(0, 60));
    const [l] = await db.query(
      `insert into loans(code,borrower_id,purpose,loan_type,status,limit_cents,rate_bps,repayment,settled_on,maturity_on,interest_to,source,source_id,source_payload)
       values($1,$2,$3,$4,$5,$6,$7,'interest_only',$8,$9,$10,$11,$12,$13) returning id,code`,
      [loanCode, b.id, "Imported from the loan tape", type, status, limit, rate, funded, maturity, paidTo, source, sourceId, JSON.stringify(row)],
    );
    if (balance > 0) await post(db, l.id, "drawdown", balance, funded, { evidence: "Imported opening balance", note: `Loan tape ${source}`, event: `IMPORT-${source}-${sourceId}` });
    const address = pick(row, ...H.address);
    if (address) {
      const value = pick(row, ...H.value);
      const pos = pick(row, ...H.position).toLowerCase();
      await db.query(
        "insert into securities(code,loan_id,address,security_type,market_value_cents,valued_on) values($1,$2,$3,$4,$5,$6)",
        [`SEC-${loanCode}`.slice(0, 60), l.id, address, /2|second/.test(pos) ? "second_mortgage" : "first_mortgage",
          value ? cents(value, `${label} valuation`) : null, tapeDate(pick(row, ...H.valuedOn), fmt, `${label} valuation date`)],
      );
    }
    await audit(db, l.id, "import", actor, { source, source_id: sourceId });
    out.added++;
    out.loans.push(loanCode);
  }
  out.dry_run = Boolean(o["dry-run"]);
  return out;
}

// ---------- the commands ----------
async function run(db, { cmd, pos, o }) {
  if (cmd === "help")
    return COMMANDS.map((c) => ({ command: c, flags: SPECS[c] ? SPECS[c].split(" ").map((f) => `--${f}`).join(" ") : "", record: TARGET[c] || (c === "accrue" ? "loans (optional)" : c === "import" ? "mortgage-automator <file>" : "") }));
  if (READS[cmd]) return db.query(READS[cmd]);
  if (cmd === "insights") {
    const out = [];
    for (const [question, sql] of QUESTIONS) out.push({ question, rows: await db.query(sql) });
    return out;
  }
  if (cmd === "export") {
    const data = { exported_at: new Date().toISOString() };
    for (const t of TABLES) data[t] = await db.query(`select * from ${t} order by created_at, id`);
    const file = path.resolve(o.out || path.join(process.env.OUTPUT_DIR || REPO_ROOT, "exports", `lending-${today()}-${Date.now()}.json`));
    writeFile(file, JSON.stringify(data, null, 2));
    return { file, counts: Object.fromEntries(TABLES.map((t) => [t, data[t].length])) };
  }
  if (cmd === "import") return importTape(db, pos[1], o);
  if (cmd === "weekly-review") {
    const [arrears, maturities, lvr, attention, compliance, book] = await Promise.all(
      ["arrears", "maturities", "lvr", "attention", "compliance", "book"].map((k) => db.query(READS[k])));
    const over = lvr.filter((r) => r.over_policy);
    const lines = [
      `# Lending desk review, week of ${today()}`, "",
      "Draft for the credit meeting. Nothing has been sent.", "",
      `## The book`, ...book.map((r) => `- ${r.status}: ${r.loans} loan(s), balance ${dollars(r.balance_cents)}, weighted rate ${pct(r.weighted_rate_bps)}`), "",
      `## Arrears (${arrears.length})`, ...(arrears.length ? arrears.map((r) => `- ${r.code} ${r.borrower}: ${dollars(r.arrears_cents)} unpaid for ${r.days_in_arrears} days`) : ["- None."]), "",
      `## Maturing within 90 days (${maturities.length})`, ...(maturities.length ? maturities.map((r) => `- ${r.code} ${r.borrower}: ${r.maturity_on} (${r.days_to_maturity < 0 ? -r.days_to_maturity + " days past" : r.days_to_maturity + " days"}), balance ${dollars(r.balance_cents)}`) : ["- None."]), "",
      `## Over LVR limit (${over.length})`, ...(over.length ? over.map((r) => `- ${r.code} ${r.borrower}: committed ${pct(r.committed_lvr_bps)}, current ${pct(r.current_lvr_bps)}, limit ${pct(r.max_lvr_bps)}`) : ["- None."]), "",
      `## Everything needing a decision (${attention.length})`, ...attention.map((r) => `- ${r.code}: ${r.issue}. ${r.detail}`), "",
      `## Evidence gaps (${compliance.length})`, ...compliance.map((r) => `- ${r.code} ${r.rule}: ${r.issue} (${r.subject})`), "",
    ];
    return { draft: draft("weekly-review", lines.join("\n")), arrears: arrears.length, maturing: maturities.length, over_lvr: over.length, attention: attention.length, evidence_gaps: compliance.length };
  }

  // Commands that create a top-level record.
  const actor = WRITES.has(cmd) ? required(o, "actor") : null;
  if (cmd === "add-borrower") {
    const [r] = await db.query("insert into borrowers(code,name,entity_type,contact,email) values($1,$2,$3,$4,$5) returning *",
      [code(required(o, "code")), required(o, "name"), choice(o.type, "type", ["company", "trust", "partnership", "individual"], "company"), o.contact || "", o.email || ""]);
    await audit(db, r.id, cmd, actor, { code: r.code });
    return r;
  }
  if (cmd === "add-investor") {
    const [r] = await db.query("insert into investors(code,name,investor_type,email) values($1,$2,$3,$4) returning *",
      [code(required(o, "code")), required(o, "name"), choice(o.type, "type", ["wholesale", "sophisticated", "retail"]), o.email || ""]);
    await audit(db, r.id, cmd, actor, { code: r.code });
    return r;
  }
  if (cmd === "add-loan") {
    const b = await resolve(db, "borrowers", required(o, "borrower"));
    const rate = bps(required(o, "rate"), "rate");
    const [r] = await db.query(
      `insert into loans(code,borrower_id,purpose,loan_type,limit_cents,rate_bps,default_rate_bps,repayment,max_lvr_bps,currency,manager)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning *`,
      [code(required(o, "code")), b.id, required(o, "purpose"), choice(o.type, "type", ["term", "bridging", "construction", "land", "line"]),
        cents(required(o, "limit"), "limit"), rate, o["default-rate"] ? bps(o["default-rate"], "default-rate") : rate,
        choice(o.repayment, "repayment", ["interest_only", "capitalised"], "interest_only"),
        o["max-lvr"] ? bps(o["max-lvr"], "max-lvr") : choice(o.type, "type", ["term", "bridging", "construction", "land", "line"]) === "construction" ? 7000 : 8000,
        choice(o.currency, "currency", ["nzd", "aud"], "nzd").toUpperCase(), o.manager || ""]);
    await audit(db, r.id, cmd, actor, { code: r.code, borrower: b.code });
    return r;
  }
  if (cmd === "accrue") {
    const to = notFuture(date(o.to || today(), "to"), "to");
    if (pos.length > 1) throw Error("accrue takes at most one loan");
    const list = pos[0] ? [await resolve(db, "loans", pos[0])] : await db.query("select * from loans where status in ('settled','default') order by code");
    const posted = [];
    for (const l0 of list) {
      await db.query("select id from loans where id=$1 for update", [l0.id]);
      const [l] = await db.query("select * from loans where id=$1", [l0.id]);
      if (!["settled", "default"].includes(l.status)) throw Error(`${l.code} is ${l.status}`);
      const r = await interestFor(db, l, to);
      if (!r.days) continue;
      if (r.cents > 0) await post(db, l.id, "interest", r.cents, to, { from: r.from, to, note: l.repayment === "capitalised" ? "Capitalised" : "", event: `INT-${l.code}-${to}` });
      await db.query("update loans set interest_to=$2 where id=$1", [l.id, to]);
      await audit(db, l.id, cmd, actor, { from: r.from, to, days: r.days, amount_cents: r.cents });
      posted.push({ code: l.code, from: r.from, to, days: r.days, interest_cents: r.cents });
    }
    return posted;
  }

  const ref = pos[0];
  const kind = TARGET[cmd];
  const rec = await resolve(db, kind, ref);

  if (cmd === "show") {
    const l = await loanView(db, rec.id);
    return {
      loan: l,
      securities: await db.query("select code,address,security_type,market_value_cents,complete_value_cents,valued_on,valuer,valuer_independent,insurance_expires_on from securities where loan_id=$1 order by code", [rec.id]),
      allocations: await db.query("select a.code,i.name investor,a.amount_cents,a.investor_rate_bps from allocations a join investors i on i.id=a.investor_id where a.loan_id=$1 order by a.code", [rec.id]),
      conditions: await db.query("select code,title,owner,due_on,met_on from conditions where loan_id=$1 order by due_on", [rec.id]),
      recent: await db.query("select posted_on,kind,amount_cents,note from ledger where loan_id=$1 order by posted_on desc, created_at desc limit 8", [rec.id]),
    };
  }
  if (cmd === "statement")
    return db.query(
      `select posted_on,kind,case when kind='payment' then -amount_cents else amount_cents end amount_cents,
        sum(case when kind='payment' then -amount_cents else amount_cents end) over (order by posted_on, created_at, id) balance_cents,
        coalesce(period_from::text || ' to ' || period_to::text, '') period, nullif(evidence,'') evidence, note
       from ledger where loan_id=$1 order by posted_on, created_at, id`, [rec.id]);
  if (cmd === "history")
    return db.query("select created_at,action,actor,detail from audit_events where entity_id=$1 or entity_id in (select id from securities where loan_id=$1) or entity_id in (select id from conditions where loan_id=$1) order by id", [rec.id]);
  if (cmd === "draft-arrears-letter") {
    const l = await loanView(db, rec.id);
    if (!(l.arrears_cents > 0)) throw Error(`${l.code} is not in arrears`);
    const [b] = await db.query("select * from borrowers where id=$1", [l.borrower_id]);
    const text = [`# Draft: overdue payment, loan ${l.code}`, "", `To: ${b.contact || b.name} (${b.email || "no email recorded"})`, "",
      `Dear ${b.contact || b.name},`, "",
      `Our records show ${dollars(l.arrears_cents, l.currency)} unpaid on loan ${l.code}, the oldest amount due on ${l.oldest_unpaid_on}. That is ${l.days_in_arrears} days.`, "",
      `Please pay the amount, or call ${l.manager || "us"} this week to agree a date.`, "",
      `Regards,`, l.manager || "", "",
      "---", "Internal draft. Not a formal demand or default notice: check your loan agreement and get legal advice before any enforcement step. Nothing has been sent."].join("\n");
    return { draft: draft(`arrears-${l.code}`, text), loan: l.code, arrears_cents: l.arrears_cents, days: l.days_in_arrears };
  }
  if (cmd === "draft-maturity-letter") {
    const l = await loanView(db, rec.id);
    if (!l.maturity_on) throw Error(`${l.code} has no maturity date`);
    const [b] = await db.query("select * from borrowers where id=$1", [l.borrower_id]);
    const past = l.days_to_maturity < 0;
    const text = [`# Draft: maturity of loan ${l.code}`, "", `To: ${b.contact || b.name} (${b.email || "no email recorded"})`, "",
      `Dear ${b.contact || b.name},`, "",
      past ? `Loan ${l.code} reached its maturity date on ${l.maturity_on}. The balance of ${dollars(l.balance_cents, l.currency)} is now due.`
        : `Loan ${l.code} matures on ${l.maturity_on}, in ${l.days_to_maturity} days. The balance today is ${dollars(l.balance_cents, l.currency)}.`, "",
      "Please confirm how you plan to repay: sale, refinance or a request to extend. Any extension needs a current valuation of the security.", "",
      "Regards,", l.manager || "", "", "---", "Internal draft. Nothing has been sent."].join("\n");
    return { draft: draft(`maturity-${l.code}`, text), loan: l.code, maturity_on: l.maturity_on, balance_cents: l.balance_cents };
  }
  if (cmd === "draft-investor-statement") {
    const to = date(o.to || today(), "to");
    const from = date(o.from || addDays(to, -30), "from");
    if (from >= to) throw Error("--from must be before --to");
    const rows = await db.query(
      `select a.code,l.code loan,br.name borrower,l.status,a.amount_cents,a.investor_rate_bps,greatest(a.allocated_on,$2::date) start_on
       from allocations a join loans l on l.id=a.loan_id join borrowers br on br.id=l.borrower_id where a.investor_id=$1 order by a.code`, [rec.id, from]);
    const lines = rows.map((r) => {
      const days = Math.max(0, daysBetween(r.start_on, to));
      return { ...r, days, interest_cents: Math.round((Number(r.amount_cents) * r.investor_rate_bps * days) / 10000 / 365) };
    });
    const total = lines.reduce((s, r) => s + r.interest_cents, 0);
    const text = [`# Investor statement: ${rec.name}`, "", `Period ${from} to ${to}. Interest at each allocation's investor rate, actual/365.`, "",
      "| Allocation | Loan | Borrower | Status | Amount | Rate | Days | Interest |", "|---|---|---|---|---|---|---|---|",
      ...lines.map((r) => `| ${r.code} | ${r.loan} | ${r.borrower} | ${r.status} | ${dollars(r.amount_cents)} | ${pct(r.investor_rate_bps)} | ${r.days} | ${dollars(r.interest_cents)} |`),
      "", `Total interest for the period: ${dollars(total)}`, "",
      "---", "Draft for review. Interest shown accrues at the agreed investor rate and assumes the borrower pays; loans in arrears or default need a decision before distribution. Nothing has been sent."].join("\n");
    return { draft: draft(`investor-${rec.code}`, text), investor: rec.code, from, to, total_cents: total, allocations: lines.length };
  }

  // Everything below changes a record.
  let result;
  const id = rec.id;
  if (kind === "loans") {
    await db.query("select id from loans where id=$1 for update", [id]);
    const [l] = await db.query("select * from loans where id=$1", [id]);
    const lv = await loanView(db, id);
    if (cmd === "add-security") {
      [result] = await db.query("insert into securities(code,loan_id,address,security_type) values($1,$2,$3,$4) returning *",
        [code(required(o, "code")), id, required(o, "address"), choice(o.type, "type", ["first_mortgage", "second_mortgage", "gsa", "guarantee"], "first_mortgage")]);
    } else if (cmd === "declare-purpose") {
      const on = notFuture(date(o.on || today(), "on"), "on");
      [result] = await db.query("update loans set business_purpose_on=$2 where id=$1 returning code,business_purpose_on", [id, on]);
    } else if (cmd === "approve") {
      required(o, "note");
      if (l.status !== "application") throw Error(`${l.code} is ${l.status}`);
      [result] = await db.query("update loans set status='approved' where id=$1 returning code,status", [id]);
    } else if (cmd === "withdraw") {
      required(o, "note");
      if (!["application", "approved"].includes(l.status)) throw Error(`Only an application or approved loan can be withdrawn; ${l.code} is ${l.status}`);
      [result] = await db.query("update loans set status='withdrawn' where id=$1 returning code,status", [id]);
    } else if (cmd === "settle") {
      const on = notFuture(date(o.on || today(), "on"), "on");
      const maturity = date(required(o, "maturity"), "maturity");
      if (l.status !== "approved") throw Error(`${l.code} must be approved before settlement; it is ${l.status}`);
      if (maturity <= on) throw Error("Maturity must be after settlement");
      const [b] = await db.query("select * from borrowers where id=$1", [l.borrower_id]);
      if (!b.kyc_verified_on || b.kyc_verified_on > on) throw Error(`Verify ${b.name}'s identity before settlement (verify-kyc)`);
      if (!l.business_purpose_on || l.business_purpose_on > on) throw Error("Record the business purpose declaration before settlement (declare-purpose)");
      const secs = await db.query("select * from securities where loan_id=$1 and security_type in ('first_mortgage','second_mortgage')", [id]);
      if (!secs.length || secs.some((s) => !s.valued_on || s.valued_on > on || s.market_value_cents === null))
        throw Error("Every mortgage security needs a valuation dated on or before settlement (value)");
      if (l.loan_type === "construction" && secs.some((s) => s.complete_value_cents === null)) throw Error("A construction loan needs an as if complete value");
      if (Math.max(lv.committed_lvr_bps || 0, 0) > l.max_lvr_bps) throw Error(`Committed LVR ${pct(lv.committed_lvr_bps)} is above the ${pct(l.max_lvr_bps)} limit`);
      const amount = o.amount ? cents(o.amount, "amount") : l.loan_type === "construction" ? null : l.limit_cents;
      if (!amount) throw Error("A construction loan needs --amount for the first draw");
      if (amount > l.limit_cents) throw Error("First draw is above the loan limit");
      if (l.loan_type === "construction" && !o.evidence) throw Error("A construction draw needs --evidence (the progress report or settlement statement)");
      await post(db, id, "drawdown", amount, on, { evidence: o.evidence || "Settlement statement", note: "Settlement", event: `SETTLE-${l.code}` });
      [result] = await db.query("update loans set status='settled',settled_on=$2,maturity_on=$3,interest_to=$2 where id=$1 returning code,status,settled_on,maturity_on", [id, on, maturity]);
    } else if (cmd === "drawdown") {
      const on = notFuture(date(o.on || today(), "on"), "on");
      const amount = cents(required(o, "amount"), "amount");
      const event = required(o, "event");
      const prev = await db.query("select * from ledger where event_key=$1", [event]);
      if (prev.length) {
        if (prev[0].loan_id !== id || prev[0].kind !== "drawdown" || Number(prev[0].amount_cents) !== amount) throw Error("That event reference is already used for a different entry");
        return { duplicate: true, event };
      }
      if (l.status !== "settled") throw Error(`${l.code} is ${l.status}; draws need a settled loan`);
      notBeforeAccrual(l, on);
      if (l.loan_type === "construction" && !o.evidence) throw Error("A construction draw needs --evidence: the quantity surveyor's progress report");
      if (Number(lv.drawn_cents) + amount > Number(l.limit_cents)) throw Error(`Draw takes ${l.code} past its limit (undrawn ${dollars(lv.undrawn_cents)})`);
      if ((lv.committed_lvr_bps || 0) > l.max_lvr_bps) throw Error(`Committed LVR ${pct(lv.committed_lvr_bps)} is above the ${pct(l.max_lvr_bps)} limit. Revalue the security or reduce the limit before the next draw.`);
      const basis = l.loan_type === "construction" ? lv.complete_value_cents : lv.market_value_cents;
      const after = basis ? Math.round(((Number(lv.balance_cents) + amount) * 10000) / Number(basis)) : null;
      if (after !== null && after > l.max_lvr_bps) throw Error(`Draw lifts LVR to ${pct(after)}, above the ${pct(l.max_lvr_bps)} limit`);
      result = await post(db, id, "drawdown", amount, on, { evidence: o.evidence || "", event });
    } else if (cmd === "charge-fee") {
      const on = notFuture(date(o.on || today(), "on"), "on");
      notBeforeAccrual(l, on);
      if (!["settled", "default"].includes(l.status)) throw Error(`${l.code} is ${l.status}`);
      result = await post(db, id, "fee", cents(required(o, "amount"), "amount"), on, { note: required(o, "note"), event: o.event || `FEE-${l.code}-${on}-${Date.now()}` });
    } else if (cmd === "receive") {
      const on = notFuture(date(o.on || today(), "on"), "on");
      const amount = cents(required(o, "amount"), "amount");
      const event = required(o, "event");
      const prev = await db.query("select * from ledger where event_key=$1", [event]);
      if (prev.length) {
        if (prev[0].loan_id !== id || prev[0].kind !== "payment" || Number(prev[0].amount_cents) !== amount) throw Error("That bank reference is already used for a different entry");
        return { duplicate: true, event };
      }
      if (!["settled", "default"].includes(l.status)) throw Error(`${l.code} is ${l.status}`);
      notBeforeAccrual(l, on);
      if (amount > Number(lv.balance_cents)) throw Error(`Payment is more than the balance of ${dollars(lv.balance_cents)}. Accrue interest to the payment date first if this is a payout.`);
      result = await post(db, id, "payment", amount, on, { note: o.note || "", event });
    } else if (cmd === "extend") {
      const maturity = date(required(o, "maturity"), "maturity");
      required(o, "note");
      if (!["settled", "default"].includes(l.status)) throw Error(`${l.code} is ${l.status}`);
      if (l.maturity_on && maturity <= l.maturity_on) throw Error("The new maturity must be later than the current one");
      const stale = await db.query("select code from securities where loan_id=$1 and security_type in ('first_mortgage','second_mortgage') and (valued_on is null or valued_on < current_date - 90)", [id]);
      if (stale.length) throw Error(`An extension needs a valuation from the last 90 days: ${stale.map((s) => s.code).join(", ")} (value)`);
      [result] = await db.query("update loans set maturity_on=$2 where id=$1 returning code,maturity_on", [id, maturity]);
    } else if (cmd === "default") {
      const on = notFuture(date(o.on || today(), "on"), "on");
      required(o, "note");
      if (l.status !== "settled") throw Error(`${l.code} is ${l.status}`);
      notBeforeAccrual(l, on);
      [result] = await db.query("update loans set status='default',default_on=$2 where id=$1 returning code,status,default_on", [id, on]);
    } else if (cmd === "discharge") {
      const on = notFuture(date(o.on || today(), "on"), "on");
      required(o, "note");
      if (!["settled", "default"].includes(l.status)) throw Error(`${l.code} is ${l.status}`);
      if (Number(lv.balance_cents) !== 0) throw Error(`${l.code} still owes ${dollars(lv.balance_cents)}`);
      if (!l.interest_to || l.interest_to < on) throw Error(`Accrue interest to ${on} before discharge`);
      [result] = await db.query("update loans set status='discharged' where id=$1 returning code,status", [id]);
    } else if (cmd === "allocate") {
      const inv = await resolve(db, "investors", required(o, "investor"));
      const amount = cents(required(o, "amount"), "amount");
      if (!["approved", "settled"].includes(l.status)) throw Error(`${l.code} is ${l.status}`);
      if (inv.investor_type === "retail") throw Error("Retail investors need a registered scheme and disclosure document. Record those outside this desk first.");
      if (!inv.kyc_verified_on) throw Error(`Verify ${inv.name}'s identity first`);
      if (!inv.certificate_on || inv.certificate_on < addDays(today(), -730)) throw Error(`${inv.name}'s investor certificate is missing or older than two years (certify-investor)`);
      if (Number(lv.allocated_cents) + amount > Number(l.limit_cents)) throw Error(`Allocations would exceed the ${dollars(l.limit_cents)} limit`);
      [result] = await db.query(
        "insert into allocations(code,loan_id,investor_id,amount_cents,investor_rate_bps,allocated_on) values($1,$2,$3,$4,$5,$6) returning *",
        [`AL-${l.code}-${inv.code}`.slice(0, 60), id, inv.id, amount, bps(required(o, "rate"), "rate"), notFuture(date(o.on || today(), "on"), "on")]);
    } else if (cmd === "add-condition") {
      [result] = await db.query("insert into conditions(code,loan_id,title,owner,due_on) values($1,$2,$3,$4,$5) returning *",
        [code(required(o, "code")), id, required(o, "title"), o.owner || "", date(required(o, "due"), "due")]);
    } else if (cmd === "review") {
      required(o, "note");
      [result] = await db.query("update loans set reviewed_on=current_date where id=$1 returning code,reviewed_on", [id]);
    } else if (cmd === "log") {
      result = { code: l.code, note: required(o, "note") };
    }
  } else if (kind === "securities") {
    if (cmd === "value") {
      const on = notFuture(date(o.on || today(), "on"), "on");
      [result] = await db.query(
        "update securities set market_value_cents=$2,complete_value_cents=$3,valued_on=$4,valuer=$5,valuer_independent=$6 where id=$1 returning *",
        [id, cents(required(o, "market"), "market"), o.complete ? cents(o.complete, "complete") : null, on, required(o, "valuer"), yes(o.independent)]);
    } else if (cmd === "insure") {
      required(o, "note");
      [result] = await db.query("update securities set insurance_expires_on=$2 where id=$1 returning code,insurance_expires_on", [id, date(required(o, "expires"), "expires")]);
    }
  } else if (cmd === "verify-kyc") {
    [result] = await db.query("update borrowers set kyc_verified_on=$2,kyc_method=$3 where id=$1 returning code,name,kyc_verified_on,kyc_method",
      [id, notFuture(date(o.on || today(), "on"), "on"), required(o, "method")]);
  } else if (cmd === "certify-investor") {
    if (rec.investor_type === "retail") throw Error("Retail investors do not hold a wholesale certificate");
    [result] = await db.query("update investors set certificate_on=$2,kyc_verified_on=coalesce(kyc_verified_on,$2) where id=$1 returning code,name,certificate_on",
      [id, notFuture(date(required(o, "on"), "on"), "on")]);
  } else if (cmd === "meet-condition") {
    if (rec.met_on) throw Error(`${rec.code} was met on ${rec.met_on}`);
    [result] = await db.query("update conditions set met_on=$2,evidence=$3 where id=$1 returning code,title,met_on,evidence",
      [id, notFuture(date(o.on || today(), "on"), "on"), required(o, "evidence")]);
  }
  if (!result) throw Error(`Unimplemented command ${cmd}`);
  await audit(db, kind === "loans" ? id : id, cmd, actor, { ...o, json: undefined, actor: undefined, record: result?.code ?? result?.event_key });
  return result;
}

export async function execute(db, args) {
  const parsed = parse(args);
  const { cmd, pos } = parsed;
  const expected = cmd === "import" ? 2 : cmd === "accrue" ? pos.length : TARGET[cmd] ? 1 : 0;
  if (pos.length !== expected) throw Error(`${cmd} expects ${expected} positional argument(s)`);
  if (cmd === "import" && pos[0] !== "mortgage-automator") throw Error("Import source must be mortgage-automator");
  await db.exec(WRITES.has(cmd) ? "BEGIN" : "BEGIN READ ONLY");
  try {
    const result = await run(db, parsed);
    await db.exec(parsed.o["dry-run"] ? "ROLLBACK" : "COMMIT");
    return result;
  } catch (e) {
    await db.exec("ROLLBACK");
    throw e;
  }
}

// Human output: money in dollars, basis points as percentages, nested results as sections.
function cell(k, v) {
  if (v === null || v === undefined) return "";
  if (k.endsWith("_cents")) return (Number(v) / 100).toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (k.endsWith("_bps")) return pct(v);
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (v instanceof Date) return v.toISOString().slice(0, 16).replace("T", " ");
  if (typeof v === "object") return JSON.stringify(v);
  return v;
}
const label = (k) => k.replace(/_cents$/, "").replace(/_bps$/, "");
function rowsTable(rows) {
  if (!rows.length) return "  (none)";
  return table(rows, Object.keys(rows[0]).map((k) => ({ key: k, label: label(k), width: 48, align: /_(cents|bps)$/.test(k) ? "right" : "left", format: (v) => cell(k, v) })));
}
export function human(value) {
  if (Array.isArray(value)) {
    if (value.length && value.every((x) => x && typeof x === "object" && "question" in x && Array.isArray(x.rows)))
      return value.map((x, i) => `${heading(`${i + 1}. ${x.question}`)}\n${rowsTable(x.rows)}`).join("\n");
    return rowsTable(value);
  }
  if (value && typeof value === "object") {
    const parts = [];
    for (const [k, v] of Object.entries(value)) {
      if (Array.isArray(v)) parts.push(`${heading(k)}\n${rowsTable(v)}`);
      else if (v && typeof v === "object" && !(v instanceof Date)) parts.push(`${heading(k)}\n${Object.entries(v).filter(([kk]) => !/^(id|borrower_id)$/.test(kk)).map(([kk, vv]) => `  ${label(kk).padEnd(24)} ${cell(kk, vv)}`).join("\n")}`);
      else parts.push(`  ${label(k).padEnd(24)} ${cell(k, v)}`);
    }
    return parts.join("\n");
  }
  return String(value);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  let db;
  try {
    db = await getDb();
    const result = await execute(db, process.argv.slice(2));
    console.log(process.argv.includes("--json") ? JSON.stringify(result, null, 2) : human(result));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    if (db) await db.close();
  }
}

// npm test: a disposable database, migrate twice, seed twice, then every command with assertions.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { getDb, REPO_ROOT } from "./lib/db.mjs";
import { migrate } from "./migrate.mjs";
import { execute, COMMANDS, human, addDays, today, tapeDate } from "./lending.mjs";

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "lending-test-"));
process.env.DATA_DIR = path.join(temp, "db");
process.env.OUTPUT_DIR = temp;
// Never touch a business database from a test. TEST_DATABASE_URL must name a disposable one.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || "";

const db = await getDb();
const seen = new Set();
const call = (cmd, ...args) => { seen.add(cmd); return execute(db, [cmd, ...args]); };
const actor = "--actor=Test operator";
const now = today();
const runFile = (file, args = []) => {
  const p = spawnSync(process.execPath, [file, ...args], { cwd: REPO_ROOT, env: process.env, encoding: "utf8" });
  assert.equal(p.status, 0, p.stderr || p.stdout);
  return p.stdout;
};
const one = async (sql, params = []) => (await db.query(sql, params))[0];

try {
  assert.ok((await migrate(db)).ran.length, "first migrate applies");
  assert.equal((await migrate(db)).ran.length, 0, "second migrate is a no-op");
  const seed = fs.readFileSync(path.join(REPO_ROOT, "supabase/seed.sql"), "utf8");
  await db.exec(seed);
  await db.exec(seed);
  assert.equal((await one("select count(*)::int n from loans")).n, 6, "seed is idempotent");

  // Reads
  for (const cmd of ["help", "borrowers", "investors", "loans", "book", "arrears", "maturities", "lvr", "valuations", "conditions", "funding", "attention", "compliance"])
    assert.ok((await call(cmd)).length > 0, cmd);
  const insights = await call("insights");
  assert.equal(insights.length, 10);
  assert.ok(insights.every((q) => q.rows.length > 0), "every insight question finds something in the demo book");
  assert.ok(human(insights).includes("1. Which loans are in arrears"));

  const arrears = await call("arrears");
  assert.equal(arrears.length, 1);
  assert.equal(arrears[0].code, "PL-103");
  assert.equal(Number(arrears[0].arrears_cents), 667808 + 25000);
  assert.equal(arrears[0].days_in_arrears, 35);
  assert.ok(!(await call("arrears")).some((r) => r.code === "PL-102"), "capitalised loans are never in arrears on interest");

  const lvr = await call("lvr");
  const kauri = lvr.find((r) => r.code === "PL-102");
  assert.equal(kauri.committed_lvr_bps, 7609);
  assert.equal(kauri.over_policy, true);
  assert.equal(kauri.over_benchmark, true);

  const rules = (await call("compliance")).map((r) => `${r.code} ${r.rule}`);
  for (const want of ["PL-105 AML-CDD", "INV-03 AML-CDD", "PL-104 AML-REVIEW", "PL-103 BUSINESS-PURPOSE", "INV-02 WHOLESALE-CERT", "INV-04 RETAIL-INVESTOR",
    "PL-104 RG45-B5-INDEPENDENT", "PL-102 RG45-B6-LVR", "PL-102 RG45-B6-STAGED"]) assert.ok(rules.includes(want), want);
  const issues = (await call("attention")).map((r) => `${r.code} ${r.issue}`);
  for (const want of ["PL-103 arrears", "PL-103 matured, not repaid", "PL-102 over LVR limit", "PL-104 valuation over 12 months old",
    "PL-103 insurance expiring", "PL-102 condition overdue", "PL-102 drawn beyond investor funding"]) assert.ok(issues.includes(want), want);

  // Lookups: code, uuid, exact name, partial name, ambiguous
  assert.equal((await call("show", "pl-101")).loan.code, "PL-101");
  assert.equal((await call("show", "30000000-0000-4000-8000-000000000002")).loan.code, "PL-102");
  assert.equal((await call("show", "Moana Family Trust")).loan.code, "PL-103");
  assert.equal((await call("show", "harbour")).loan.code, "PL-101");
  await assert.rejects(() => call("show", "Ltd"), /Ambiguous/);
  await assert.rejects(() => call("show", "nobody-here"), /No loans match/);
  const statement = await call("statement", "PL-101");
  assert.equal(Number(statement.at(-1).balance_cents), 120000000);

  // Interest: actual/365 on the principal, default rate after maturity
  const acc1 = await call("accrue", "PL-101", `--to=${now}`, actor);
  assert.equal(acc1[0].days, 20);
  assert.equal(acc1[0].interest_cents, Math.round((120000000 * 995 * 20) / 10000 / 365));
  assert.equal((await call("accrue", "PL-101", `--to=${now}`, actor)).length, 0, "accruing twice to the same day posts nothing");
  const acc3 = await call("accrue", "PL-103", `--to=${now}`, actor);
  const base = 65000000;
  const expect3 = Math.round((base * 1250 * 25) / 10000 / 365 + (base * 1850 * 10) / 10000 / 365);
  assert.equal(acc3[0].interest_cents, expect3, "ten days after maturity at the default rate");
  const acc2 = await call("accrue", "PL-102", `--to=${now}`, actor);
  assert.ok(acc2[0].interest_cents > Math.round((210000000 * 1150 * 30) / 10000 / 365), "capitalised interest compounds on the balance");
  const all = await call("accrue", `--to=${now}`, actor);
  assert.ok(all.every((r) => r.to === now));
  await assert.rejects(() => call("accrue", "--to=2999-01-01", actor), /future/);
  await assert.rejects(() => call("accrue", "PL-105", actor), /approved/);

  const letter = await call("draft-arrears-letter", "PL-103");
  assert.ok(fs.readFileSync(letter.draft, "utf8").includes("Not a formal demand"));
  assert.equal(letter.days, 35);

  // Payments: idempotent bank reference, cannot be backdated into charged interest
  const owed = Number((await one("select balance_cents from v_loans where code='PL-103'")).balance_cents);
  await call("receive", "PL-103", "--amount=6928.08", "--event=BANK-7781", actor);
  assert.deepEqual(await call("receive", "PL-103", "--amount=6928.08", "--event=BANK-7781", actor), { duplicate: true, event: "BANK-7781" });
  await assert.rejects(() => call("receive", "PL-103", "--amount=10", "--event=BANK-7781", actor), /already used/);
  await assert.rejects(() => call("receive", "PL-103", `--amount=1`, `--on=${addDays(now, -40)}`, "--event=BANK-OLD", actor), /interest charged/);
  await assert.rejects(() => call("receive", "PL-103", "--amount=99999999", "--event=BANK-BIG", actor), /more than the balance/);
  assert.equal(Number((await one("select balance_cents from v_loans where code='PL-103'")).balance_cents), owed - 692808);
  await call("charge-fee", "PL-103", "--amount=350", "--note=Default administration fee", actor);
  await call("default", "PL-103", "--note=Matured and unpaid", actor);
  assert.equal((await one("select status from loans where code='PL-103'")).status, "default");
  await assert.rejects(() => call("extend", "PL-103", `--maturity=${addDays(now, 90)}`, "--note=Extension", actor), /90 days/);
  await assert.rejects(() => call("discharge", "PL-103", "--note=Done", actor), /still owes/);
  const left = Number((await one("select balance_cents from v_loans where code='PL-103'")).balance_cents);
  await call("receive", "PL-103", `--amount=${(left / 100).toFixed(2)}`, "--event=BANK-PAYOUT", "--note=Sale proceeds", actor);
  await call("discharge", "PL-103", "--note=Repaid from sale", actor);
  assert.equal((await one("select status from loans where code='PL-103'")).status, "discharged");

  // Construction draws: evidence, limit and LVR
  await assert.rejects(() => call("drawdown", "PL-102", "--amount=100000", "--event=DRAW-4", actor), /quantity surveyor/);
  await assert.rejects(() => call("drawdown", "PL-102", "--amount=100000", "--evidence=QS report 4", "--event=DRAW-4", actor), /LVR/);
  await call("value", "SEC-102", "--market=2100000", "--complete=5200000", "--valuer=North Shore Valuation Co", "--independent=yes", actor);
  await assert.rejects(() => call("drawdown", "PL-102", "--amount=1500000", "--evidence=QS report 4", "--event=DRAW-4", actor), /past its limit/);
  await call("drawdown", "PL-102", "--amount=400000", "--evidence=QS report 4: frames up", "--event=DRAW-4", actor);
  assert.deepEqual(await call("drawdown", "PL-102", "--amount=400000", "--evidence=QS report 4: frames up", "--event=DRAW-4", actor), { duplicate: true, event: "DRAW-4" });
  assert.equal(Number((await one("select drawn_cents from v_loans where code='PL-102'")).drawn_cents), 250000000);

  // Ledger and audit cannot be rewritten
  await assert.rejects(() => db.query("update ledger set amount_cents=1"), /cannot be changed/);
  await assert.rejects(() => db.query("delete from audit_events"), /cannot be changed/);

  // A new loan from application to settlement, with every gate
  await call("add-borrower", "--code=BR-NEW", "--name=Matai Street Holdings Ltd", "--type=company", "--contact=Ana", "--email=demo-new@example.com", actor);
  await call("add-loan", "--code=PL-200", "--borrower=Matai", "--purpose=Purchase of a retail building", "--type=term", "--limit=800000", "--rate=10.25", "--default-rate=15.25", "--max-lvr=70", "--manager=Mia", actor);
  await call("add-security", "PL-200", "--code=SEC-200", "--address=3 Matai Street, Wellington", actor);
  await call("add-condition", "PL-200", "--code=CON-200", "--title=Signed loan agreement", "--owner=Mia", `--due=${addDays(now, 5)}`, actor);
  await assert.rejects(() => call("settle", "PL-200", `--maturity=${addDays(now, 365)}`, actor), /approved/);
  await call("approve", "PL-200", "--note=Credit committee", actor);
  await assert.rejects(() => call("settle", "PL-200", `--maturity=${addDays(now, 365)}`, actor), /identity/);
  await call("verify-kyc", "Matai Street Holdings Ltd", "--method=Electronic verification", actor);
  await assert.rejects(() => call("settle", "PL-200", `--maturity=${addDays(now, 365)}`, actor), /business purpose/);
  await call("declare-purpose", "PL-200", actor);
  await assert.rejects(() => call("settle", "PL-200", `--maturity=${addDays(now, 365)}`, actor), /valuation/);
  await call("value", "SEC-200", "--market=1000000", "--valuer=Capital Valuers", "--independent=yes", actor);
  await assert.rejects(() => call("settle", "PL-200", `--maturity=${addDays(now, 365)}`, actor), /LVR/);
  await call("value", "SEC-200", "--market=1200000", "--valuer=Capital Valuers", "--independent=yes", actor);
  await call("insure", "SEC-200", `--expires=${addDays(now, 365)}`, "--note=Certificate on file", actor);
  await call("meet-condition", "CON-200", "--evidence=Agreement signed", actor);
  await assert.rejects(() => call("meet-condition", "CON-200", "--evidence=Again", actor), /was met/);
  await call("settle", "PL-200", `--maturity=${addDays(now, 365)}`, actor);
  assert.equal((await one("select status,interest_to from loans where code='PL-200'")).status, "settled");
  await call("extend", "PL-200", `--maturity=${addDays(now, 540)}`, "--note=Borrower asked for six months more", actor);
  await call("log", "PL-200", "--note=Borrower called about early repayment", actor);
  await call("review", "PL-200", "--note=File checked", actor);

  // Investors
  await call("add-investor", "--code=INV-09", "--name=Totara Trust", "--type=wholesale", actor);
  await assert.rejects(() => call("allocate", "PL-200", "--investor=INV-09", "--amount=400000", "--rate=8", actor), /identity|certificate/);
  await call("certify-investor", "Totara", `--on=${now}`, actor);
  await call("allocate", "PL-200", "--investor=INV-09", "--amount=400000", "--rate=8", actor);
  await assert.rejects(() => call("allocate", "PL-200", "--investor=INV-01", "--amount=500000", "--rate=8", actor), /exceed/);
  await assert.rejects(() => call("allocate", "PL-200", "--investor=INV-04", "--amount=1000", "--rate=8", actor), /Retail/);
  await assert.rejects(() => call("certify-investor", "INV-04", `--on=${now}`, actor), /Retail/);

  // Withdraw an application
  await call("add-loan", "--code=PL-201", "--borrower=BR-NEW", "--purpose=Second site", "--type=land", "--limit=200000", "--rate=11", actor);
  await call("withdraw", "PL-201", "--note=Borrower went elsewhere", actor);
  await assert.rejects(() => call("withdraw", "PL-200", "--note=x", actor), /Only an application/);

  // Validation
  await assert.rejects(() => call("add-loan", "--code=PL-300", "--borrower=BR-NEW", "--purpose=x", "--type=term", "--limit=-5", "--rate=9", actor), /Invalid --limit/);
  await assert.rejects(() => call("add-loan", "--code=PL-300", "--borrower=BR-NEW", "--purpose=x", "--type=yacht", "--limit=5", "--rate=9", actor), /--type/);
  await assert.rejects(() => call("loans", "--bogus=1"), /Unknown --bogus/);
  await assert.rejects(() => call("add-borrower", "--code=BR-X", "--name=X"), /--actor/);
  await assert.rejects(() => execute(db, ["nothing"]), /Unknown command/);

  // Import: dry run rolls back, real run adds, rerun is unchanged, changed row is refused
  const tape = path.join(REPO_ROOT, "examples/mortgage-automator-loan-tape.csv");
  const loansBefore = (await one("select count(*)::int n from loans")).n;
  await assert.rejects(() => call("import", "mortgage-automator", tape, "--source=ma", actor), /date-format/);
  const preview = await call("import", "mortgage-automator", tape, "--source=ma", "--date-format=dmy", "--dry-run", actor);
  assert.equal(preview.added, 3);
  assert.equal((await one("select count(*)::int n from loans")).n, loansBefore, "dry run leaves no rows");
  const imported = await call("import", "mortgage-automator", tape, "--source=ma", "--date-format=dmy", actor);
  assert.equal(imported.added, 3);
  assert.equal(imported.borrowers_added, 2, "an existing borrower is matched by name");
  assert.equal((await call("import", "mortgage-automator", tape, "--source=ma", "--date-format=dmy", actor)).unchanged, 3);
  const westgate = await one("select * from v_loans where source_id='MA-2042'");
  assert.equal(westgate.loan_type, "construction");
  assert.equal(Number(westgate.balance_cents), 115000000);
  assert.equal((await one("select status from loans where source_id='MA-2043'")).status, "discharged");
  assert.ok((await call("attention")).some((r) => r.issue === "imported, not reviewed"));
  const changed = path.join(temp, "changed.csv");
  fs.writeFileSync(changed, fs.readFileSync(tape, "utf8").replace("11.75%", "12.75%"));
  await assert.rejects(() => call("import", "mortgage-automator", changed, "--source=ma", "--date-format=dmy", actor), /changed since/);
  const bad = path.join(temp, "bad.csv");
  fs.writeFileSync(bad, "Loan Number,Borrower,Loan Amount,Interest Rate,Funding Date,IRD Number\nX1,A,100,9,2026-01-01,123\n");
  await assert.rejects(() => call("import", "mortgage-automator", bad, "--source=bad", actor), /identity numbers/);
  assert.equal(tapeDate("03/02/2026", "mdy", "t"), "2026-03-02");
  assert.equal(tapeDate("03/02/2026", "dmy", "t"), "2026-02-03");

  // Drafts and export
  const weekly = await call("weekly-review");
  assert.ok(fs.readFileSync(weekly.draft, "utf8").includes("Nothing has been sent"));
  await assert.rejects(() => call("draft-arrears-letter", "PL-101"), /not in arrears/);
  const maturity = await call("draft-maturity-letter", "PL-101");
  assert.ok(fs.readFileSync(maturity.draft, "utf8").includes("PL-101"));
  const inv = await call("draft-investor-statement", "INV-01", `--from=${addDays(now, -30)}`, `--to=${now}`);
  assert.equal(inv.total_cents, Math.round((70000000 * 800 * 30) / 10000 / 365) + Math.round((100000000 * 900 * 30) / 10000 / 365));
  const history = await call("history", "PL-200");
  assert.ok(history.some((h) => h.action === "settle") && history.some((h) => h.action === "value"));
  const exp = await call("export", `--out=${path.join(temp, "export.json")}`);
  assert.ok(exp.counts.loans >= 10 && exp.counts.audit_events > 20);
  await assert.rejects(() => call("export", `--out=${path.join(temp, "export.json")}`), /EEXIST/);

  const missed = COMMANDS.filter((c) => !seen.has(c));
  assert.deepEqual(missed, [], `commands not exercised: ${missed.join(", ")}`);

  // The CLI as a process, the views and the documents
  await db.close();
  assert.ok(runFile("scripts/lending.mjs", ["attention"]).includes("PL-102"));
  assert.ok(JSON.parse(runFile("scripts/lending.mjs", ["book", "--json"])).length > 0);
  const failing = spawnSync(process.execPath, ["scripts/lending.mjs", "show", "Ltd"], { cwd: REPO_ROOT, env: process.env, encoding: "utf8" });
  assert.equal(failing.status, 1);
  assert.match(failing.stderr, /Ambiguous/);
  assert.ok(runFile("scripts/view.mjs").includes("view:"));
  assert.ok(/\d+ document\(s\) rendered/.test(runFile("scripts/docs.mjs")));
  for (const dir of ["views", "docs-out"]) assert.ok(fs.readdirSync(path.join(temp, dir), { recursive: true }).some((f) => String(f).endsWith(".html")), dir);
  console.log(`PASS: ${COMMANDS.length} commands, ${seen.size} exercised, migrations, seed, import, interest, gates, drafts, views and documents.`);
} catch (e) {
  console.error("FAIL:", e.stack || e.message);
  process.exitCode = 1;
  try { await db.close(); } catch {}
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

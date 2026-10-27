<h1 align="center">Private Lending for Claude Code</h1>

<p align="center">
  <strong>The open-source private lending desk that is just a database and Claude Code.</strong>
</p>

<p align="center">
  Created by <a href="https://www.enterprisedna.co"><strong>Enterprise DNA</strong></a>. Free and open source. Works with Claude Code, Codex, OpenCode or Cursor.
</p>

<!-- three-doors -->
<table align="center">
  <tr>
    <td align="center"><strong>Do it yourself</strong><br/>Clone it, run it, own it. Free, MIT.<br/><a href="#quick-start">Quick start</a></td>
    <td align="center"><strong>We customise it</strong><br/>Your fields, your rules, your Mortgage Automator data brought across.<br/><a href="https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=mortgage-automator">Book a call</a></td>
    <td align="center"><strong>We run it for you</strong><br/>Installed, connected and operated inside Omni. Setup fee, then a retainer.<br/><a href="https://enterprisedna.co/omni/instead-of/mortgage-automator?utm_source=github&utm_medium=readme&utm_campaign=mortgage-automator">How it works</a></td>
  </tr>
</table>

<p align="center">
  <a href="#what-is-this">What is this</a> &bull;
  <a href="#why-no-front-end">Why no front end</a> &bull;
  <a href="#quick-start">Quick start</a> &bull;
  <a href="#the-commands">Commands</a> &bull;
  <a href="#instead-of-mortgage-automator">Instead of Mortgage Automator</a> &bull;
  <a href="#want-it-installed-and-run-for-you">Installed for you</a> &bull;
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node-20+-339933?style=flat-square" alt="Node 20+" />
  <img src="https://img.shields.io/badge/PostgreSQL-any-336791?style=flat-square" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/PGlite-embedded-3ecf8e?style=flat-square" alt="PGlite" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT License" />
</p>

---

## What is this

Private Lending for Claude Code does the job you pay Mortgage Automator for, as a Postgres database and a set of agent commands. There is no web front end. You open the folder in [Claude Code](https://claude.com/claude-code) (or Codex, OpenCode, Cursor: see `AGENTS.md`) and ask for what you want in plain language. It runs the right query, and it can answer questions the Mortgage Automator dashboard cannot.

Mortgage Automator does not publish prices. [Its pricing page](https://mortgageautomator.com/pricing/), checked 27 October 2026, sets plans by active loans and annual funded volume and asks lenders to talk to sales. Spendbase, a software buying service, estimates a fund manager tier at about US$1,600 to US$3,000 a month. That is a third-party estimate, not a vendor price.

Want the same thing with a web front end, or built on a different stack? That is a customisation, and it is exactly what Enterprise DNA does: [book a call](https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=mortgage-automator).

It is the loan register and weekly desk for a private lender or contributory mortgage fund lending to businesses in New Zealand or Australia: borrowers, loans, securities and valuations, staged construction draws, interest at actual/365 with a default rate, payments, arrears, maturities, investor allocations and loan conditions. It checks the book against the RG 45 LVR and valuation benchmarks, identity checks, business purpose declarations and investor certificates, and it drafts the letters and statements. It does not move money, store identity documents or run borrower and investor portals.

## Why no front end

- The front end was only ever there because the database was hard to talk to. That is no longer true.
- Your data sits in plain Postgres tables you own. Any tool can read them. No export, no lock-in.
- No seats, no tiers, no add-ons. Read [docs/why-no-front-end.md](docs/why-no-front-end.md) for the honest trade-offs too.

## Quick start

Sixty seconds, no database install (an embedded Postgres runs inside Node):

```bash
git clone https://github.com/Enterprise-DNA-OS/private-lending-for-claude-code.git
cd private-lending-for-claude-code
npm install
npm run demo
```

Then open the folder in Claude Code and type `/attention`. Or ask: "Who is behind on interest, and what matures in the next 90 days?"

The demo book is fictional and its dates are relative to the day you seed. Never seed a real database: start a fresh `DATA_DIR`, run `npm run migrate`, then add or import your own loans.

### Use it with your own Postgres or Supabase

Copy `.env.example` to `.env`, set `DATABASE_URL`, then `npm run migrate`. Same commands, shared data, no per-seat fee.

## Five weekly rituals

1. `/arrears`: who owes interest or fees past their due day, how much, and for how long.
2. `/maturities`: what matures in the next 90 days or has already passed maturity, and the exit for each.
3. `/lvr`: committed and current LVR against each loan's own limit and the RG 45 benchmark (70% as if complete for development, 80% otherwise).
4. `/accrue`: charge the month's interest across the book at actual/365, with the default rate after maturity or default.
5. `/funding`: what investors have funded against what each loan has drawn.

`/attention` brings everything that needs a decision together. `/weekly-review` writes the Monday credit meeting brief to `drafts/` from six reports. `/compliance` checks the evidence. Nothing sends.

## The commands

Every command takes `--json`. Records resolve by code, id, exact name or a unique part of a name; an ambiguous match lists the candidates and exits 1. Every change runs in one transaction and writes an audit record with the `--actor` you give it. Money is entered in dollars, rates and LVR limits as percentages.

| Command | What it does |
|---|---|
| `/loans`, `/show`, `/statement`, `/book` | The book, one loan in full, its ledger with a running balance, totals by status with weighted rate and LVR |
| `/borrowers`, `/investors` | Who you lend to and who funds you, with identity and certificate dates |
| `/arrears`, `/maturities`, `/lvr`, `/valuations`, `/conditions`, `/funding` | The weekly reviews |
| `/attention`, `/compliance`, `/insights`, `/history` | Everything needing a decision, evidence gaps with sources, the ten questions, the audit trail |
| `/add-borrower`, `/add-investor`, `/add-loan`, `/add-security`, `/add-condition` | New records |
| `/verify-kyc`, `/declare-purpose`, `/value`, `/insure`, `/certify-investor` | The evidence a loan needs before it settles |
| `/approve`, `/settle`, `/drawdown`, `/accrue`, `/charge-fee`, `/receive` | The life of a loan. Settlement and draws refuse when identity, purpose, valuation, LVR or progress evidence is missing |
| `/extend`, `/default`, `/discharge`, `/withdraw` | Changes of state. An extension needs a valuation from the last 90 days |
| `/allocate`, `/meet-condition`, `/review`, `/log` | Investor allocations, conditions met, imported loans checked, notes |
| `/import`, `/export` | Bring a Mortgage Automator loan tape across; export every record to JSON |
| `/weekly-review`, `/draft-arrears-letter`, `/draft-maturity-letter`, `/draft-investor-statement` | Drafts to `drafts/`, never sent |
| `/customise`, `/new-view` | Change a field or rule with a tested migration; add a read-only report |

```bash
node scripts/lending.mjs help
node scripts/lending.mjs arrears
node scripts/lending.mjs accrue --to=2026-10-31 --actor=Mia
node scripts/lending.mjs receive PL-103 --amount=6928.08 --event=BANK-7781 --actor=Mia
node scripts/lending.mjs drawdown PL-102 --amount=400000 --evidence="QS report 4" --event=DRAW-4 --actor=Jon
node scripts/lending.mjs show "Kauri Ridge" --json
```

## Ten questions to ask

`node scripts/lending.mjs insights` answers all ten against today's records.

1. Which loans are in arrears, and for how many days?
2. Which loans have passed maturity without being repaid?
3. Which loans sit above their LVR limit today?
4. Which construction draws were paid without a progress report?
5. Which securities were last valued more than twelve months ago?
6. Which mortgaged properties have insurance lapsed or expiring within 30 days?
7. Which loans are drawn beyond what investors have funded?
8. Which investors hold a certificate older than two years?
9. How much interest will each live loan earn over the next 30 days at today's balance?
10. What is our exposure to each borrower, and what share of the book is it?

## Documents and views

`npm run docs` renders loan statements, overdue payment letters, investor statements for last calendar month and credit summaries for applications. `npm run view` renders the week, the loan book and the evidence review. Both are read-only HTML in your brand: change `brand.json` for your name, colours and logo.

## Your first hour: ten things to ask for

1. Put our name and colours on the loan statement.
2. Preview our Mortgage Automator loan tape without saving anything.
3. Import it, then list the loans that still need a review.
4. Add our investors and their certificate dates.
5. Show every loan over 70% LVR on an as if complete basis.
6. Which securities have no independent valuation?
7. Charge interest across the book to the end of last month.
8. Draft the overdue letter for the loan furthest behind.
9. Draft each investor's statement for last month.
10. Add our own field, such as the broker who introduced each loan, through `/customise`.

## Rules and limits

`/compliance` checks the records against cited rules: AML/CTF identity checks, business purpose declarations, wholesale investor certificates and the RG 45 valuation and LVR benchmarks. Sources and limits are in [docs/compliance.md](docs/compliance.md). It is a record check, not legal advice.

One lender per database, trusted operators. There is no sign-in layer: the `--actor` label is attribution, not authentication. Public table access is revoked and row level security is on with no public policies. A shared deployment needs scoped database roles, backups and a tested restore. Ledger entries and audit records cannot be edited or deleted; post a correcting entry instead. Exports and drafts never overwrite a file.

## Instead of Mortgage Automator

Export a loan tape from Mortgage Automator's reports as CSV or Excel, preview it, then import it:

```bash
node scripts/lending.mjs import mortgage-automator imports/loan-tape.csv --source=ma --date-format=mdy --dry-run --actor=Mia
node scripts/lending.mjs import mortgage-automator imports/loan-tape.csv --source=ma --date-format=mdy --actor=Mia
```

Each loan arrives with its borrower, terms, opening balance, maturity, interest paid-to date and one security, and waits on `/attention` until someone runs `/review`. Payment history, investor ledgers, documents and portals do not come across. [The switching guide](docs/replace-mortgage-automator.md) lists the columns it reads, the date formats and what needs mapping by hand. Mortgage Automator is a trademark of its owner; no affiliation is implied.

## Architecture

```
private-lending-for-claude-code/
  CLAUDE.md                 how the operator wants this run (routing table + house rules)
  AGENTS.md                 the same, for Codex / OpenCode / Cursor / Gemini CLI
  .claude/commands/         the slash commands
  scripts/                  the CLI the commands drive
  scripts/lib/db.mjs        one adapter: DATABASE_URL (pg) or embedded PGlite
  supabase/migrations/      plain SQL schema
  supabase/seed.sql         demo data
  docs/                     compliance sources, the switching guide, why no front end
  views.json, documents.json  the read-only reports and the paperwork
```

## Built for coding agents

The database, CLI and command recipes work with Claude Code, Codex, OpenCode or Cursor. Ask your coding agent for a new command and have it implement and test the change against the same records.

## Contributing

Issues and pull requests are welcome. Keep the shape: plain SQL, a small CLI, a slash command per recurring job, no front end.

## Want it installed and run for you?

Enterprise DNA installs Private Lending for Claude Code for your business, migrates your Mortgage Automator data, connects it to the rest of your tools, and runs it for you as part of **Omni**, our managed Command Center. One setup fee, then a monthly retainer.

- Book a call: [enterprisedna.co/omni/book](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=mortgage-automator)
- Read more: [enterprisedna.co/omni/instead-of/mortgage-automator](https://enterprisedna.co/omni/instead-of/mortgage-automator?utm_source=github&utm_medium=readme&utm_campaign=mortgage-automator)

## License

MIT. Copyright (c) 2026 Enterprise DNA.

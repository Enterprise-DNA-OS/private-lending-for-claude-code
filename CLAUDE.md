# Private Lending for Claude Code: operating instructions

This file is the brain. Claude Code reads it at the start of every session. It says who this is for, how work gets done, and the one right way to do each recurring job.

## Who this is for

- **Business:** [YOUR BUSINESS], a private lender or mortgage fund lending to businesses
- **Operator:** [YOUR NAME], [your role]
- **What matters most:** no loan drifts into arrears unnoticed, nothing settles without its evidence, investors get accurate statements

Fill this in once. A worker with context knows. A worker without it guesses.

## How to work

1. **Take a brief, not a script.** The operator describes the outcome. You run the right command and present the answer.
2. **Read before you write.** Before drafting anything about a record, read its full history first.
3. **Plain language.** Short sentences. No filler. Numbers in tables.
4. **Silent success, loud problems.** No play-by-play. Say what broke and what you did about it.
5. **Stop at the line.** Anything that sends, deletes, or faces a customer waits for a yes in this session.

## Routing table: one right way for each recurring job

| When the operator asks for... | Use this |
|---|---|
| Who is behind / arrears | `/arrears` |
| What matures soon | `/maturities` |
| LVR, over limit, benchmark | `/lvr` |
| Valuations, insurance | `/valuations` |
| Loan conditions outstanding | `/conditions` |
| Investor funding, unfunded draws | `/funding` |
| What needs attention | `/attention` |
| Evidence gaps, compliance | `/compliance` |
| The ten questions | `/insights` |
| The book, totals, weighted rate | `/book` |
| List loans, borrowers, investors | `/loans`, `/borrowers`, `/investors` |
| One loan, its ledger, its history | `/show`, `/statement`, `/history` |
| New borrower, investor, loan, security, condition | `/add-borrower`, `/add-investor`, `/add-loan`, `/add-security`, `/add-condition` |
| Identity checked, business purpose signed, valuation in, insurance renewed, certificate received | `/verify-kyc`, `/declare-purpose`, `/value`, `/insure`, `/certify-investor` |
| Approve, settle, draw | `/approve`, `/settle`, `/drawdown` |
| Month-end interest | `/accrue` |
| Fee charged, payment received | `/charge-fee`, `/receive` |
| Extend, default, discharge, withdraw | `/extend`, `/default`, `/discharge`, `/withdraw` |
| Allocate to an investor | `/allocate` |
| Condition met, imported loan checked, a note | `/meet-condition`, `/review`, `/log` |
| Bring Mortgage Automator data across | `/import` |
| Back up everything | `/export` |
| Monday review | `/weekly-review` |
| Overdue letter, maturity letter, investor statement | `/draft-arrears-letter`, `/draft-maturity-letter`, `/draft-investor-statement` |
| Change a field or rule | `/customise` |
| A new read-only report | `/new-view` |

If an ask fits nothing here, run the CLI directly (`node scripts/lending.mjs help`) and then propose a new command for it.

## Hard rules

- Never send email or messages from here. Draft to `drafts/`, a person sends.
- Never delete records without an explicit yes in this session. Prefer marking closed or archived.
- Never invent a record. If a name is ambiguous, list the candidates and ask.
- The database is the source of truth. If the answer is not in it, say so.

## Lending rules

- Every answer about a loan starts with the CLI. Never state a balance, rate or date from memory.
- Money is entered in dollars and stored in cents. Rates and LVR limits are percentages.
- Never invent a valuation, a certificate date or an identity check. Ask the operator.
- Use the bank reference as `--event` on draws and payments, so a retry never posts twice.
- Entries dated before a loan's interest-to date are refused: post an adjustment instead.
- Letters and statements are drafts. They are not formal demand or default notices. Enforcement needs the operator's lawyer.
- Read `docs/compliance.md` before answering a rules question, and `docs/replace-mortgage-automator.md` before any import.
- Take a backup (`/export`) before a migration on a real database. Tests use their own temporary database and never `DATABASE_URL`.

## Where things live

- `scripts/` the CLI. `scripts/lib/db.mjs` picks `DATABASE_URL` (Postgres, Supabase) or the embedded database in `.data/`.
- `supabase/migrations/` the schema, plain SQL. `npm run migrate` applies it.
- `.claude/commands/` the slash commands. Add one every time the same ask comes twice.
- `docs/` compliance sources, the switching guide and what a screen would add.
- `views.json` and `documents.json` the read-only reports (`npm run view`) and the paperwork (`npm run docs`).

Built by Enterprise DNA. Installed and run for you as part of Omni: https://enterprisedna.co/omni/instead-of/mortgage-automator

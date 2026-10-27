# Moving from Mortgage Automator

Checked 27 October 2026. Mortgage Automator's site says its reports are exportable and that custom reports can produce loan tapes. Its help centre shows report exports from a button at the top right of a report. It does not publish a fixed column list for a loan tape, so build the report with the columns below, or ask Claude Code to map the headings your report already has.

## 1. Export a loan tape

In Mortgage Automator, open your reports and build or run a loan list (a loan tape) with one row per loan. Export it as CSV or Excel. Keep it out of this folder's history: save it under `imports/`, which git ignores.

Leave out identity numbers, bank account numbers and dates of birth. The importer refuses a file that carries them.

## 2. The columns it reads

Headings are matched without regard to case. The first matching heading wins.

| Field | Headings recognised | Needed |
|---|---|---|
| Loan number | Loan Number, Loan #, Loan ID, Loan No | Yes |
| Borrower | Borrower, Borrower Name, Primary Borrower, Borrowers | Yes |
| Loan amount (the limit) | Loan Amount, Original Principal, Principal, Commitment, Total Loan Amount | Yes |
| Interest rate (percent) | Interest Rate, Note Rate, Rate | Yes |
| Funding date | Funding Date, Funded Date, Closing Date, Settlement Date | Yes |
| Balance today | Principal Balance, Outstanding Principal, Current Balance, Outstanding Balance | No: the loan amount is used |
| Maturity | Maturity Date, Maturity | No |
| Interest paid to | Interest Paid To, Paid To Date, Paid Through | No: today is used |
| Security address | Property Address, Collateral Address, Security Address, Property | No |
| Valuation and date | Appraised Value, Property Value, Valuation, Market Value; Appraisal Date, Valuation Date | No |
| Loan type | Loan Type, Product, Loan Product (construction, bridge, land, line, otherwise term) | No |
| Status | Loan Status, Status (paid off or closed becomes discharged; default or foreclosure becomes default; otherwise settled) | No |
| Lien position | Lien Position, Position, Priority (2 or second becomes a second mortgage) | No |

Dates in `YYYY-MM-DD` need nothing more. Dates like `03/02/2026` need `--date-format=dmy` (New Zealand and Australian order) or `--date-format=mdy` (North American order). The importer refuses to guess.

## 3. Preview, then import

```bash
node scripts/lending.mjs import mortgage-automator imports/loan-tape.csv --source=ma --date-format=mdy --dry-run --actor=Mia
node scripts/lending.mjs import mortgage-automator imports/loan-tape.csv --source=ma --date-format=mdy --actor=Mia
```

The preview runs the whole import inside a transaction and rolls it back. Check the count of loans and new borrowers before the real run. A borrower whose name matches an existing borrower is reused.

Running the same file again changes nothing. If a row has changed since the last import, the importer stops and names the loan: reconcile it by hand rather than overwrite it.

## 4. What arrives

Each loan becomes one record coded `<SOURCE>-<loan number>`, with its borrower, limit, rate, type, status, funding date, maturity and interest paid-to date. The balance today arrives as one opening draw dated the funding date, marked "Imported opening balance". The security arrives with its address, position and valuation.

Every imported loan waits on `/attention` until someone checks it against the source and runs `/review`.

## 5. What does not come across

- **Payment and draw history.** The balance arrives as one opening entry. Keep the old system's statements for the history.
- **Default rates, repayment type and LVR limits.** Imported loans default to interest only, the default rate equal to the normal rate, and an 80% LVR limit. Set them per loan through `/customise` or by asking Claude Code.
- **Identity checks and business purpose declarations.** These show on `/compliance` until recorded with `/verify-kyc` and `/declare-purpose`.
- **Investors and allocations.** Add investors with `/add-investor` and `/certify-investor`, then `/allocate`. A fund or shareholder report from Mortgage Automator can be mapped the same way: ask Claude Code to write the mapping.
- **Documents, portals, payment collection, trust accounting and tax reporting.** These stay where they are, or Enterprise DNA builds them into your version.

## 6. Run both side by side

Keep Mortgage Automator running for a full interest cycle. Run `/accrue` to the same date in both and compare each loan's interest and balance. Switch when they agree.

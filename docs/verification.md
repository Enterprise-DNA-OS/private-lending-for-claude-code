# Verification

27 October 2026, Linux, Node 22.23.4:

- `npm install`: PASS.
- `npm test`: PASS, all 47 CLI commands exercised on disposable embedded storage. The suite covers repeated migrations and seed, code, id, exact-name and partial-name lookups, ambiguous lookups exiting 1, actual/365 interest on interest-only and capitalised loans, the default rate after maturity, idempotent bank references on draws and payments, refusal of entries dated inside charged interest, the settlement gates (approval, identity, business purpose, valuation, LVR), construction draw gates (progress evidence, limit, committed and current LVR), extension needing a fresh valuation, discharge needing a zero balance, investor certificate and retail refusals, immutable ledger and audit records, CSV loan tape import with preview rollback, borrower matching, unchanged reruns, changed-row refusal and identity-column refusal, drafts, JSON export without overwrite, the CLI as a process, views and documents.
- `npm run demo`, `npm run view` and `npm run docs`: PASS. Three read-only views and eleven documents across four document types, inspected as rendered pages.

Not run here: the same suite on a separate PostgreSQL server (no container access on this machine), and Windows. The committed workflow runs Windows and Linux on Node 20 and 22, plus Postgres 17, when started by hand. The loan tape fixture is synthetic: Mortgage Automator does not publish its export columns, so the importer reads common loan tape headings and the switching guide says so. No customer data or vendor export was used.

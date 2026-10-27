---
description: "Charge interest up to a date, actual/365, at the default rate after maturity or default."
---

# accrue

Read CLAUDE.md. Run `node scripts/lending.mjs accrue` with the record reference the README shows. Flags: --to --actor, plus --json.

Run it for the whole book at month end, or for one loan before a payout.

This changes records. Confirm the facts with the operator, pass their name in --actor, and use a code when a name matches more than one record. Nothing sends. Drafts stay in drafts/.

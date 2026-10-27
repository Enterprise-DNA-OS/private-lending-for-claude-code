---
description: "Discharge a repaid loan. The balance must be zero and interest accrued to the day."
---

# discharge

Read CLAUDE.md. Run `node scripts/lending.mjs discharge` with the record reference the README shows. Flags: --on --note --actor, plus --json.

Run /accrue for the loan first if needed.

This changes records. Confirm the facts with the operator, pass their name in --actor, and use a code when a name matches more than one record. Nothing sends. Drafts stay in drafts/.

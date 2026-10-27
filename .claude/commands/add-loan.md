---
description: "Add a loan application with limit, rate, default rate, repayment type and LVR limit."
---

# add-loan

Read CLAUDE.md. Run `node scripts/lending.mjs add-loan` with the record reference the README shows. Flags: --code --borrower --purpose --type --limit --rate --default-rate --repayment --max-lvr --currency --manager --actor, plus --json.

Enter money in dollars and rates as percentages. Construction loans default to a 70% LVR limit.

This changes records. Confirm the facts with the operator, pass their name in --actor, and use a code when a name matches more than one record. Nothing sends. Drafts stay in drafts/.

---
description: "Settle an approved loan: checks identity, business purpose, valuation and LVR, then posts the first draw."
---

# settle

Read CLAUDE.md. Run `node scripts/lending.mjs settle` with the record reference the README shows. Flags: --on --maturity --amount --evidence --actor, plus --json.

Construction loans need --amount and --evidence for the first draw.

This changes records. Confirm the facts with the operator, pass their name in --actor, and use a code when a name matches more than one record. Nothing sends. Drafts stay in drafts/.

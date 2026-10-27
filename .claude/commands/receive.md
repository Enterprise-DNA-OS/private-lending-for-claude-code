---
description: "Record a payment received. Clears interest and fees first, then principal."
---

# receive

Read CLAUDE.md. Run `node scripts/lending.mjs receive` with the record reference the README shows. Flags: --amount --on --event --note --actor, plus --json.

Use the bank reference as --event. A repeat with the same reference is ignored.

This changes records. Confirm the facts with the operator, pass their name in --actor, and use a code when a name matches more than one record. Nothing sends. Drafts stay in drafts/.

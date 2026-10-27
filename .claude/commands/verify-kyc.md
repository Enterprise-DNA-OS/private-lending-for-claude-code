---
description: "Record that a borrower's identity was verified, and how."
---

# verify-kyc

Read CLAUDE.md. Run `node scripts/lending.mjs verify-kyc` with the record reference the README shows. Flags: --on --method --actor, plus --json.

Record the method, not identity numbers.

This changes records. Confirm the facts with the operator, pass their name in --actor, and use a code when a name matches more than one record. Nothing sends. Drafts stay in drafts/.

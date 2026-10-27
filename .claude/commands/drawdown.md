---
description: "Post a draw on a settled loan. Checks limit, LVR and, for construction, the progress report."
---

# drawdown

Read CLAUDE.md. Run `node scripts/lending.mjs drawdown` with the record reference the README shows. Flags: --amount --on --evidence --event --actor, plus --json.

Use the bank reference as --event so a retry never posts twice.

This changes records. Confirm the facts with the operator, pass their name in --actor, and use a code when a name matches more than one record. Nothing sends. Drafts stay in drafts/.

---
description: "Extend a loan's maturity. Needs a valuation from the last 90 days."
---

# extend

Read CLAUDE.md. Run `node scripts/lending.mjs extend` with the record reference the README shows. Flags: --maturity --note --actor, plus --json.

Ask for the new valuation first if it is older.

This changes records. Confirm the facts with the operator, pass their name in --actor, and use a code when a name matches more than one record. Nothing sends. Drafts stay in drafts/.

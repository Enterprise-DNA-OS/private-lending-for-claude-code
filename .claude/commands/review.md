---
description: "Mark a loan's file as reviewed, for example after an import."
---

# review

Read CLAUDE.md. Run `node scripts/lending.mjs review` with the record reference the README shows. Flags: --note --actor, plus --json.

Check terms, security and borrower against the source file first.

This changes records. Confirm the facts with the operator, pass their name in --actor, and use a code when a name matches more than one record. Nothing sends. Drafts stay in drafts/.

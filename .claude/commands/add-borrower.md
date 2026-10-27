---
description: "Add a borrower (company, trust, partnership or individual)."
---

# add-borrower

Read CLAUDE.md. Run `node scripts/lending.mjs add-borrower` with the record reference the README shows. Flags: --code --name --type --contact --email --actor, plus --json.

Confirm the legal name and entity type before writing.

This changes records. Confirm the facts with the operator, pass their name in --actor, and use a code when a name matches more than one record. Nothing sends. Drafts stay in drafts/.

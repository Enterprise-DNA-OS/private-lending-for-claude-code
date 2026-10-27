---
description: "Move an application to approved after credit sign-off."
---

# approve

Read CLAUDE.md. Run `node scripts/lending.mjs approve` with the record reference the README shows. Flags: --note --actor, plus --json.

Record who approved and why in --note.

This changes records. Confirm the facts with the operator, pass their name in --actor, and use a code when a name matches more than one record. Nothing sends. Drafts stay in drafts/.

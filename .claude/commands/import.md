---
description: "Bring a Mortgage Automator loan tape across. Always preview with --dry-run first."
---

# import

Read CLAUDE.md. Run `node scripts/lending.mjs import` mortgage-automator <file> with the record reference the README shows. Flags: --source --date-format --dry-run --actor, plus --json.

Read docs/replace-mortgage-automator.md. Choose --date-format from the dates in the file. Imported loans need /review.

This changes records. Confirm the facts with the operator, pass their name in --actor, and use a code when a name matches more than one record. Nothing sends. Drafts stay in drafts/.

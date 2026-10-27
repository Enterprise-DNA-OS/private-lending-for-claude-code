---
description: "List borrowers with identity check dates and live loans."
---

# borrowers

Read CLAUDE.md. Run `node scripts/lending.mjs borrowers` with the record reference the README shows. Flags: --select --code,name,entity_type,contact,kyc_verified_on,(select --count(*)::int --from --loans --l --where --l.borrower_id=b.id --and --l.status --in --('approved','settled','default')) --live_loans --from --borrowers --b --order --by --code, plus --json.

Point out any borrower with a live loan and no identity check.

Nothing sends. Drafts stay in drafts/.

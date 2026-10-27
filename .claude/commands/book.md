---
description: "The loan book by status with weighted rate and weighted LVR."
---

# book

Read CLAUDE.md. Run `node scripts/lending.mjs book` with the record reference the README shows. Flags: --select --status,count(*)::int --loans,sum(limit_cents)::bigint --limit_cents,sum(balance_cents)::bigint --balance_cents,round(sum(rate_bps::numeric*balance_cents)/nullif(sum(balance_cents),0))::int --weighted_rate_bps,round(sum(coalesce(current_lvr_bps,0)::numeric*balance_cents)/nullif(sum(balance_cents),0))::int --weighted_lvr_bps --from --v_loans --group --by --status --order --by --status, plus --json.

Lead with the settled book total and its weighted rate.

Nothing sends. Drafts stay in drafts/.

---
description: "Committed and current LVR for each live loan against its own limit and the RG 45 benchmark."
---

# lvr

Read CLAUDE.md. Run `node scripts/lending.mjs lvr` with the record reference the README shows. Flags: --select --code,borrower,loan_type,limit_cents,balance_cents,committed_lvr_bps,current_lvr_bps,max_lvr_bps,benchmark_lvr_bps,over_policy,over_benchmark --from --v_lvr --order --by --greatest(coalesce(committed_lvr_bps,0),coalesce(current_lvr_bps,0)) --desc, plus --json.

Lead with loans over their limit. Construction loans use the as if complete value.

Nothing sends. Drafts stay in drafts/.

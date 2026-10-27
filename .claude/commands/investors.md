---
description: "List investors, their type, certificate date and what they have allocated."
---

# investors

Read CLAUDE.md. Run `node scripts/lending.mjs investors` with the record reference the README shows. Flags: --select --code,name,investor_type,certificate_on,kyc_verified_on,(select --coalesce(sum(amount_cents),0)::bigint --from --allocations --a --join --loans --l --on --l.id=a.loan_id --where --a.investor_id=i.id --and --l.status --in --('settled','default','approved')) --allocated_cents --from --investors --i --order --by --code, plus --json.

Flag certificates older than two years and any retail investor holding an allocation.

Nothing sends. Drafts stay in drafts/.

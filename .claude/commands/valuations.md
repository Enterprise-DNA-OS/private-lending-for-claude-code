---
description: "Every security on a live loan with value, valuation date, age, valuer and insurance expiry."
---

# valuations

Read CLAUDE.md. Run `node scripts/lending.mjs valuations` with the record reference the README shows. Flags: --select --code,loan,address,market_value_cents,complete_value_cents,valued_on,age_days,valuer,valuer_independent,insurance_expires_on --from --v_valuations --order --by --valued_on --nulls --first, --code, plus --json.

Flag valuations over twelve months old, valuers not marked independent and insurance expiring in 30 days.

Nothing sends. Drafts stay in drafts/.

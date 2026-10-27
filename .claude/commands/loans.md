---
description: "List every loan with limit, balance, rate, LVR and maturity."
---

# loans

Read CLAUDE.md. Run `node scripts/lending.mjs loans` with the record reference the README shows. Flags: --select --code,borrower,loan_type,status,limit_cents,balance_cents,rate_bps,current_lvr_bps,maturity_on,manager --from --v_loans --order --by --code, plus --json.

Group by status if the operator asks for the live book.

Nothing sends. Drafts stay in drafts/.

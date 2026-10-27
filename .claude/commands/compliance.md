---
description: "Check the loan book against the rules in docs/compliance.md and report each evidence gap with its source."
---

# compliance

1. Read `docs/compliance.md`. Each rule has a code, its source and what the check looks for.
2. Run `node scripts/lending.mjs compliance` (add `--json` if you need to work with the rows).
3. Report as a table: rule, record, the gap, the source. Order: identity and business purpose first, then valuation and LVR, then investor certificates.
4. For each gap, say the command that records the missing evidence (`verify-kyc`, `declare-purpose`, `value`, `certify-investor`) and ask the operator for the facts. Never invent a date or a value.
5. If a rule in `docs/compliance.md` looks out of date, say so and stop. The operator confirms the rule, then you update the doc and the check together.

This is a check of the records against rules the operator has chosen. It is not legal advice and not a compliance certificate.

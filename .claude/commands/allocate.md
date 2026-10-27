---
description: "Allocate part of a loan to an investor at the investor rate."
---

# allocate

Read CLAUDE.md. Run `node scripts/lending.mjs allocate` with the record reference the README shows. Flags: --investor --amount --rate --on --actor, plus --json.

Checks identity, certificate and that allocations stay within the limit.

This changes records. Confirm the facts with the operator, pass their name in --actor, and use a code when a name matches more than one record. Nothing sends. Drafts stay in drafts/.

# Why there is no front end

A lending desk runs on a handful of records: borrowers, loans, securities, a ledger of draws, interest and payments, investors and their allocations, and the conditions on each loan. The weekly work is a set of questions about those records. Who is behind? What matures next month? Which loan is over its LVR? Which draw went out without a surveyor's report?

Here you ask those questions in plain words and Claude Code runs the command, reads the answer and drafts the letter. `npm run view` prints the week, the book and the evidence review as read-only pages in your brand. `npm run docs` prints loan statements, overdue letters, investor statements and credit summaries.

## What a screen gives you that this does not

- **Borrower and investor portals.** Borrowers cannot log in to see their balance, and investors cannot download their own statements. Statements are generated for you to send.
- **Payments.** Nothing here collects direct debits or pays investors. Payments are recorded after your bank moves the money.
- **A phone app and drag and drop.** It runs where Claude Code runs, on a laptop or a server.
- **Document storage and e-signing.** Store loan documents where you keep them today. Record the reference.
- **Trust accounting and tax.** Keep your accountant's ledger and your trustee's records. This desk is the loan register beside them.

Enterprise DNA builds whichever of these a lender needs into their own version: a borrower or investor portal, bank feed matching, document links, or a web front end over the same database.

## Who this fits

A private lender or mortgage fund with a small team that wants its loan book, its rules and its history in one database it owns, and would rather ask than click.

Installed and run for you: https://enterprisedna.co/omni/instead-of/mortgage-automator

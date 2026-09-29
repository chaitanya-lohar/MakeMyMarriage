# 0004 — V1 product and contract clarifications

**Status:** Accepted

These clarifications were confirmed during scaffold review. They are implemented by the
module that owns them, not by the scaffold.

1. **Guest invitations.** One secure invitation token per guest covers all of that
   guest's applicable events. RSVP remains per `GuestEvent`.
2. **Expense sharing.** Expenses are automatically shared with the connected partner.
   There is no expense visibility/private toggle in V1.
3. **API routes.** The latest API Design document is authoritative for routes. Route
   examples in other documents do not override it.
4. **Schema changes.** Approved schema changes are implemented exactly, when the
   corresponding module is built, after re-checking the latest PRD, API Design and
   Database Design. No fields or relationships are added beyond what is approved.

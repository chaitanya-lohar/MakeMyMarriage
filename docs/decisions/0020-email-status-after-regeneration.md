# 0020 — Email status after regenerating an invitation link

**Status:** Accepted (approved by the product owner on 2026-10-10). Amends
[0018](0018-invitation-token-storage-and-guest-access.md) #8, which says the current delivery
status follows the latest send attempt.

## Context

The specifications did not say which email status an invitation shows after its link is
regenerated. Showing the previous "Sent" would suggest the new link had been sent.

## Decision

The invitation's current email status and its link state are separate, and email history is
never rewritten:

| Action          | Current email status | Link state      | Email history            |
| --------------- | -------------------- | --------------- | ------------------------ |
| Regenerate link | **Draft**            | New active link | Preserved                |
| Send succeeds   | Sent                 | Unchanged       | Preserved; attempt added |
| Send fails      | Failed               | Unchanged       | Preserved; attempt added |
| Revoke link     | Unchanged            | Revoked         | Preserved                |

- Regenerating — from an active or a revoked link — sets the current email status to
  **Draft**, because the new link has not been sent. Earlier send attempts stay in the
  history with their times and Sent/Failed results.
- The current email status otherwise follows the latest send attempt (0018 #8).
- Revoking changes only the link state; it never changes the current email status or the
  history.
- Organizer screens show the current email status and the link state separately; Delivered
  is never shown in Phase 4 (0019 #8).

## Superseded statements

| Source                                                                 | Statement                                                             | Resolution                                                             |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 0018 #8                                                                | "The invitation's current delivery status follows its latest attempt" | Except after regeneration, which sets it to Draft until the next send. |
| Phase 4 PRD v1.2 §7.3, Database Design v1.1 §10.3, API Design v1.1 §10 | No rule for the status after regeneration                             | Updated in the same change (0003).                                     |

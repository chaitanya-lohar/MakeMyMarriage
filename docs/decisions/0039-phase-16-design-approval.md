# 0039 — Phase 16 design approval

**Status:** Accepted (approved by the product owner on 2026-11-03). Supplements
[0038](0038-phase-16-partner-connection.md) and the [Phase 16 PRD v1.0](../specs/PHASE_16_PRD_v1.0.md)
§9.

## Context

The first Phase 16 boards in Stitch (project `11709379677369700007`) were reviewed on 2026-11-03
and all needed revision: the Phase 10 Members page was not kept, mobile frames were missing,
two boards were specification tables, and they contained invented content and wording that
contradicted 0038. The product owner regenerated the boards in Stitch from the review's
prompts; two further review rounds followed.

## Decision

1. **Approved screens** — each board shows every state at desktop 1440px and mobile 390px:

   | Board                                                   | Stitch screen ID                   | Covers                                                                                                                   |
   | ------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
   | P16 · M16-01 & M16-02 Partner Card & Invite Dialog      | `6e514597bb02489b9f71dcd9e1a8c666` | Partner card on the Members page (no partner, pending, email not sent, connected, organizer view); invite dialog, errors |
   | P16 · M16-03 & M16-04 Partner Invitation Page & Success | `11ee4b38a1e145afbd5689589bc65852` | Public invitation page and its states; success screen                                                                    |
   | P16 · M16-05 to M16-09 Leaving, Reconnecting & Errors   | `d8a8eab37182442a9c8e9445068a8b3f` | Leave confirmation, after leaving, remaining owner, reconnection, error and limit states                                 |

2. **Not approved:** the first-round boards `e0f4b6adb67841e3b81f9e6f5173150b`,
   `42e4e5288c0f47ea99ac3424df1ff66a`, `68e167883af14a9ebba40ea1e651e8f6`, and the intermediate
   board `434709034d3f4c54be4e809c67842f2a`. They are not used and may be deleted.

3. **Corrections applied in code** (binding; the boards are not edited again):
   1. Every Members-page state uses the full approved Phase 10 Members page (sidebar, Ownership
      card, Partner card, Members and Invitations tabs, member table), including the desktop
      pending and connected frames of M16-01, which omit parts of it.
   2. The Partner card is always headed "Partner" (not "Partner Invitation").
   3. The cancel action on a pending invitation is "Cancel invitation" at every width.
   4. M16-03E (an organizer of the wedding accepting): the invitation is for that person's
      email; the board pairs a signed-in organizer with another person's masked email, which is
      the different-account case (M16-03C).
   5. Names, emails and dates come from the data; the boards' sample emails differ between
      boards and are not copied.
   6. Grey frame labels, board headers and footers (for example "Network Timeout", "Capacity
      Full", "Defensive error suite", "Modal Intercept State") are not product text. A link-state
      card shows only its message and "Go to home".
   7. Small additions on the boards that the PRD does not define are not built: the "Equal owner
      access" chip, the "1 seat available" and "Invitation pending" chips on the Ownership card,
      and the "Partner connected" chip.
   8. Mobile dialogs are bottom sheets and the mobile shell uses the approved top bar and menu
      drawer, as in earlier phases.

4. **Wording** on the approved boards is draft, as in earlier phases, until a wording approval.

5. Implementation still needs the merge of the Phase 16 documentation (0037, 0038, this record)
   and explicit approval to start.

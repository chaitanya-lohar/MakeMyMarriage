# 0007 — Web app structure

**Status:** Accepted

## Routes

```text
apps/web/src/app/
├── (marketing)/              public marketing pages (home page today)
├── (auth)/                   authentication pages
├── (workspace)/              authenticated wedding workspace
├── w/[publicIdentifier]/     public wedding website (path-based — System Design §2)
├── invite/[token]/           guest invitation and RSVP (account-free)
└── memories/[token]/         guest QR photo uploads (account-free)
```

`(marketing)/` holds the home page and the legal placeholders. `(auth)/` holds sign-up,
sign-in, forgot password and reset password; `(workspace)/dashboard` is the minimal signed-in
page until the Weddings phase (0015). Each other route is created with its feature.

## Code organisation

Routes, reusable components, feature-specific UI, API-client/lib utilities and shared
design-system components are kept separate:

| Folder                    | Holds                                               |
| ------------------------- | --------------------------------------------------- |
| `src/app/`                | Routes and layouts only                             |
| `src/components/ui/`      | Design-system components (button, chip, icon, logo) |
| `src/components/layout/`  | Site-wide layout (header, mobile menu, footer)      |
| `src/features/<feature>/` | UI and content that belong to one feature           |
| `src/lib/`                | API-client and utility code, when first needed      |

Folders are added when they get their first real file, not in advance.

API calls use `@makemymarriage/api-client` through the same-origin proxy (0001).

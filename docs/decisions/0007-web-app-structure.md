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

Only `(marketing)/` exists in the scaffold. Each other route is created with its feature.

## Code organisation

When UI features are implemented, routes, reusable components, feature-specific UI,
API-client/lib utilities and shared design-system components are kept separate. Folders
are added when they get their first real file, not in advance.

API calls use `@makemymarriage/api-client` through the same-origin proxy (0001).

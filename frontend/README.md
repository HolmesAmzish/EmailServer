# ARORMS Mail Web

React 19 + TypeScript + Vite + Tailwind CSS v4 mail workspace for `email-server`.

## Features

- Keycloak OIDC authorization-code login with automatic Bearer token injection.
- Inbox, Sent, Drafts, Trash, Deleted, Starred, Archive, and custom folder navigation.
- Paged message lists, local search, unread filtering, sorting, and unread counts.
- HTML/text message reading, read-state updates, replies, soft delete, restore,
  permanent delete, and attachment metadata.
- New messages, draft creation/editing, and SMTP send through the existing API.
- Light, dark, and system themes with responsive desktop/mobile layouts.

## Development

```bash
pnpm install
pnpm dev
```

The dev server runs at `http://localhost:5173` and proxies `/api` to
`http://localhost:8084`.

## Environment

```dotenv
VITE_OAUTH_AUTH_SERVER=https://auth.arorms.cn/realms/arorms
VITE_OAUTH_CLIENT_ID=email-react
VITE_OAUTH_REDIRECT_URI=http://localhost:5173/callback
```

Production redirect URIs can be relative, for example `/callback`.

## API Notes

The frontend uses the current mail and mailbox endpoints.

- Unread folder counts are derived from mailbox pages until a count endpoint exists.
- Attachment downloads expect `GET /api/mail/attachments/{id}/download`; metadata is
  still displayed when the storage endpoint is unavailable.
- `Trash` is a regular mailbox used for server-classified messages.
- `Deleted` is the recycle bin for mails with `isDeleted=true`. Restore clears the flag;
  permanent delete removes the mail record and its Maildir file.

## Build

```bash
pnpm build
```

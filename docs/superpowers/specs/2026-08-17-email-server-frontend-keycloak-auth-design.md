# Email Server Frontend — Keycloak Auth Design

## Goal

Create a minimal React + TypeScript + Tailwind CSS frontend for the `email-server` project. The primary purpose is to obtain a Keycloak access token via standard OIDC and display/log it. Axios should be set up as a placeholder for future API calls.

## Context

- Project location: `email-server/frontend` (currently empty).
- Reference project: `blog/frontend/apps/admin`, which uses `oidc-client-ts` for OIDC login.
- Stack: React, TypeScript, Vite, Tailwind CSS v4, Axios, `oidc-client-ts`.

## Keycloak / OIDC Configuration

| Config | Value |
|---|---|
| Authority | `https://auth.arorms.cn/realms/arorms` |
| Client ID | `email-react` |
| Redirect URI | `http://localhost:5173/callback` |
| Response type | `code` |
| Scope | `openid profile email` |

These values live in `.env.development` and `.env.production`.

## Architecture

A single-page Vite application with three routes:

1. **`/`** — Home page. Shows a login button if the user is not authenticated; shows the user profile and access token if authenticated.
2. **`/login`** — Redirects to Keycloak OIDC login if not already authenticated.
3. **`/callback`** — Handles the OIDC authorization-code callback, exchanges the code for tokens, then redirects to `/`.

Authentication is handled by `oidc-client-ts` `UserManager`, which stores tokens in `sessionStorage` and supports silent token refresh.

## File Structure

```
frontend/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── .env.development
├── .env.production
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── index.css
    ├── api/
    │   ├── auth.ts          # UserManager setup + login/logout/callback helpers
    │   └── client.ts        # Axios instance with OIDC token interceptor (placeholder)
    └── pages/
        ├── HomePage.tsx     # Login button or token display
        ├── LoginPage.tsx    # Redirects to Keycloak
        └── CallbackPage.tsx # Exchanges code for tokens
```

## Data Flow

1. User visits `/` and clicks **Login**.
2. `LoginPage` calls `login()` → `UserManager.signinRedirect()` → browser navigates to Keycloak.
3. User authenticates with Keycloak and is redirected back to `/callback?code=...&state=...`.
4. `CallbackPage` calls `handleCallback()` → `UserManager.signinRedirectCallback()`.
5. On success, `CallbackPage` redirects to `/`.
6. `HomePage` loads the authenticated user via `getAccessToken()` / `getUserInfo()`, prints the token to the console, and displays it on the page with a copy button.

## Error Handling

- `CallbackPage` uses a ref guard to prevent exchanging the authorization code twice under React StrictMode.
- If callback handling fails, display an error message and a **Retry login** button that calls `login()` again.
- Axios interceptor injects the access token automatically but does not redirect on 401 for this minimal phase.

## Styling

- Tailwind CSS v4 with `@import "tailwindcss"`.
- Simple, centered layouts.
- No dark-mode support required for the initial page.

## Dependencies

```json
{
  "dependencies": {
    "@tailwindcss/vite": "^4.2.1",
    "axios": "^1.13.6",
    "oidc-client-ts": "^3.1.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "react-router-dom": "^7.13.1",
    "tailwindcss": "^4.2.1"
  },
  "devDependencies": {
    "@types/react": "^19.2.7",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^5.1.1",
    "typescript": "~5.9.3",
    "vite": "^7.3.1"
  }
}
```

## Notes

- Keep changes minimal. No protected routes, no dashboard, no backend integration beyond the axios placeholder.
- Match the coding style of `blog/frontend/apps/admin` where applicable.

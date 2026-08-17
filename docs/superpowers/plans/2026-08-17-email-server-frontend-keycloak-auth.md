# Email Server Frontend Keycloak Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold a minimal Vite + React + TypeScript + Tailwind CSS frontend in `email-server/frontend` that logs in via Keycloak OIDC and displays the access token.

**Architecture:** Use `oidc-client-ts` `UserManager` for the OIDC authorization-code + PKCE flow. Three routes (`/`, `/login`, `/callback`) handle the happy path. Axios is configured as a placeholder with an interceptor that reads the OIDC access token but does not auto-redirect on 401 yet.

**Tech Stack:** React 19, TypeScript 5.9, Vite 7, Tailwind CSS 4 (`@tailwindcss/vite`), `oidc-client-ts` 3.1, axios 1.13, `react-router-dom` 7.13.

## Global Constraints

- Project root: `/home/cacc/Repositories/email-server/frontend`.
- Dev server port: `5173`.
- Keycloak authority: `https://auth.arorms.cn/realms/arorms`.
- Keycloak client ID: `email-react`.
- Redirect URI: `http://localhost:5173/callback`.
- Response type: `code`.
- Scope: `openid profile email`.
- All env vars exposed to Vite must be prefixed with `VITE_`.
- Follow the style of `blog/frontend/apps/admin` where applicable.
- Use `pnpm` as the package manager (not `npm`).
- Do not commit anything unless explicitly requested by the user.

---

## File Structure

```
frontend/
├── .env.development
├── .env.production
├── index.html
├── package.json
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
└── src/
    ├── index.css
    ├── main.tsx
    ├── App.tsx
    ├── api/
    │   ├── auth.ts
    │   └── client.ts
    └── pages/
        ├── CallbackPage.tsx
        ├── HomePage.tsx
        └── LoginPage.tsx
```

---

### Task 1: Scaffold the Vite project

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tsconfig.app.json`
- Create: `frontend/tsconfig.node.json`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/index.css`

**Interfaces:**
- Produces: `frontend/package.json` with scripts `dev`, `build`, `preview` and all required dependencies/devDependencies.
- Produces: `frontend/vite.config.ts` with `@vitejs/plugin-react`, `@tailwindcss/vite`, `@/` alias to `./src`, and dev server on port `5173`.
- Produces: `frontend/src/main.tsx` that mounts `<App />` inside `<StrictMode>`.
- Produces: `frontend/src/App.tsx` with a temporary placeholder route so the project compiles before Task 8.
- Produces: `frontend/src/index.css` importing Tailwind CSS.

- [ ] **Step 1: Create `frontend/package.json`**

```json
{
  "name": "@email/server-web",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
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

- [ ] **Step 2: Create `frontend/vite.config.ts`**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '::',
    port: 5173,
    strictPort: true,
  },
})
```

- [ ] **Step 3: Create `frontend/tsconfig.json`**

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

- [ ] **Step 4: Create `frontend/tsconfig.app.json`**

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

- [ ] **Step 5: Create `frontend/tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 6: Create `frontend/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Email Server</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Create `frontend/src/main.tsx`**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 8: Create `frontend/src/App.tsx` (placeholder)**

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<div className="p-8">Email Server</div>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
```

- [ ] **Step 9: Create `frontend/src/index.css`**

```css
@import "tailwindcss";

:root {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  line-height: 1.6;
  font-weight: 400;
  color-scheme: light;
  color: #000;
  background-color: #fff;
}

* { box-sizing: border-box; }
body { margin: 0; min-width: 320px; min-height: 100vh; }
```

- [ ] **Step 10: Install dependencies and verify TypeScript compiles**

Run:
```bash
cd frontend && pnpm install
```

Expected: `node_modules` created, no install errors.

Run:
```bash
cd frontend && pnpm run build
```

Expected: `dist/` created, build succeeds.

---

### Task 2: Add environment configuration

**Files:**
- Create: `frontend/.env.development`
- Create: `frontend/.env.production`

**Interfaces:**
- Produces: `VITE_OAUTH_AUTH_SERVER`, `VITE_OAUTH_CLIENT_ID`, `VITE_OAUTH_REDIRECT_URI` env vars consumed by `src/api/auth.ts`.

- [ ] **Step 1: Create `frontend/.env.development`**

```
VITE_OAUTH_AUTH_SERVER=https://auth.arorms.cn/realms/arorms
VITE_OAUTH_CLIENT_ID=email-react
VITE_OAUTH_REDIRECT_URI=http://localhost:5173/callback
```

- [ ] **Step 2: Create `frontend/.env.production`**

```
VITE_OAUTH_AUTH_SERVER=https://auth.arorms.cn/realms/arorms
VITE_OAUTH_CLIENT_ID=email-react
VITE_OAUTH_REDIRECT_URI=/callback
```

- [ ] **Step 3: Verify build still passes**

Run:
```bash
cd frontend && pnpm run build
```

Expected: Build succeeds.

---

### Task 3: Implement the OIDC auth module

**Files:**
- Create: `frontend/src/api/auth.ts`

**Interfaces:**
- Produces: `getUserManager(): UserManager`
- Produces: `login(): void`
- Produces: `logout(): Promise<void>`
- Produces: `handleCallback(): Promise<User | null>`
- Produces: `getAccessToken(): Promise<string | null>`
- Produces: `isAuthenticated(): Promise<boolean>`
- Produces: `getUserInfo(): Promise<{ username: string; email: string } | null>`

- [ ] **Step 1: Create `frontend/src/api/auth.ts`**

```ts
import { UserManager, type User } from 'oidc-client-ts'

const OIDC_CONFIG = {
  authority: import.meta.env.VITE_OAUTH_AUTH_SERVER ?? 'http://localhost:9000/realms/arorms',
  client_id: import.meta.env.VITE_OAUTH_CLIENT_ID ?? 'email-react',
  redirect_uri: import.meta.env.VITE_OAUTH_REDIRECT_URI ?? window.location.origin + '/callback',
  post_logout_redirect_uri: window.location.origin + '/',
  response_type: 'code',
  scope: 'openid profile email',
}

let userManager: UserManager | null = null

export const getUserManager = (): UserManager => {
  if (!userManager) {
    userManager = new UserManager(OIDC_CONFIG)
  }
  return userManager
}

export const login = (): void => {
  getUserManager().signinRedirect()
}

export const logout = async (): Promise<void> => {
  await getUserManager().signoutRedirect()
}

export const handleCallback = async (): Promise<User | null> => {
  try {
    const user = await getUserManager().signinRedirectCallback()
    return user
  } catch {
    return null
  }
}

export const getAccessToken = async (): Promise<string | null> => {
  try {
    const user = await getUserManager().getUser()
    return user?.access_token ?? null
  } catch {
    return null
  }
}

export const isAuthenticated = async (): Promise<boolean> => {
  try {
    const user = await getUserManager().getUser()
    return !!user && !user.expired
  } catch {
    return false
  }
}

export const getUserInfo = async (): Promise<{ username: string; email: string } | null> => {
  try {
    const user = await getUserManager().getUser()
    if (!user) return null
    return {
      username: user.profile.preferred_username ?? user.profile.sub,
      email: user.profile.email ?? '',
    }
  } catch {
    return null
  }
}
```

- [ ] **Step 2: Verify build still passes**

Run:
```bash
cd frontend && pnpm run build
```

Expected: Build succeeds with no TypeScript errors.

---

### Task 4: Add the axios client placeholder

**Files:**
- Create: `frontend/src/api/client.ts`

**Interfaces:**
- Produces: `apiClient: AxiosInstance`
- Produces: `get<T>(url, config?)`, `post<T, D>(url, data?, config?)`, `put<T, D>(url, data?, config?)`, `del<T>(url, config?)`
- Consumes: `getUserManager` from `auth.ts` to read the access token.

- [ ] **Step 1: Create `frontend/src/api/client.ts`**

```ts
import axios, { type AxiosRequestConfig } from 'axios'
import { getUserManager } from './auth'

export const apiClient = axios.create({
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.request.use(async (config) => {
  try {
    const mgr = getUserManager()
    const user = await mgr.getUser()
    if (user?.access_token) {
      config.headers.Authorization = `Bearer ${user.access_token}`
    }
  } catch {}
  return config
})

export const get = async <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
  const response = await apiClient.get<T>(url, config)
  return response.data
}

export const post = async <T, D = unknown>(url: string, data?: D, config?: AxiosRequestConfig): Promise<T> => {
  const response = await apiClient.post<T>(url, data, config)
  return response.data
}

export const put = async <T, D = unknown>(url: string, data?: D, config?: AxiosRequestConfig): Promise<T> => {
  const response = await apiClient.put<T>(url, data, config)
  return response.data
}

export const del = async <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
  const response = await apiClient.delete<T>(url, config)
  return response.data
}
```

- [ ] **Step 2: Verify build still passes**

Run:
```bash
cd frontend && pnpm run build
```

Expected: Build succeeds.

---

### Task 5: Implement the login page

**Files:**
- Create: `frontend/src/pages/LoginPage.tsx`

**Interfaces:**
- Consumes: `login`, `isAuthenticated` from `@/api/auth`
- Produces: `LoginPage` component that redirects unauthenticated users to Keycloak.

- [ ] **Step 1: Create `frontend/src/pages/LoginPage.tsx`**

```tsx
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, isAuthenticated } from '@/api/auth'

export function LoginPage() {
  const navigate = useNavigate()

  useEffect(() => {
    isAuthenticated().then((authed) => {
      if (authed) navigate('/', { replace: true })
      else login()
    })
  }, [navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <p className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-4">
          Redirecting to login...
        </p>
        <div className="w-8 h-8 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build still passes**

Run:
```bash
cd frontend && pnpm run build
```

Expected: Build succeeds.

---

### Task 6: Implement the callback page

**Files:**
- Create: `frontend/src/pages/CallbackPage.tsx`

**Interfaces:**
- Consumes: `handleCallback`, `isAuthenticated` from `@/api/auth`
- Produces: `CallbackPage` component that exchanges the authorization code for tokens and redirects home.

- [ ] **Step 1: Create `frontend/src/pages/CallbackPage.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { handleCallback, isAuthenticated, login } from '@/api/auth'

export function CallbackPage() {
  const navigate = useNavigate()
  const exchanged = useRef(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (exchanged.current) return
    exchanged.current = true

    handleCallback().then(async (user) => {
      const ok = !!user || (await isAuthenticated())
      if (ok) navigate('/', { replace: true })
      else setError(true)
    })
  }, [navigate])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-sm text-red-600 mb-4">Login failed. Please try again.</p>
          <button
            onClick={() => login()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <p className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-4">
          Completing login...
        </p>
        <div className="w-8 h-8 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build still passes**

Run:
```bash
cd frontend && pnpm run build
```

Expected: Build succeeds.

---

### Task 7: Implement the home page

**Files:**
- Create: `frontend/src/pages/HomePage.tsx`

**Interfaces:**
- Consumes: `isAuthenticated`, `getAccessToken`, `getUserInfo`, `login`, `logout` from `@/api/auth`
- Produces: `HomePage` component that shows login button or user info + access token, and logs the token to the console.

- [ ] **Step 1: Create `frontend/src/pages/HomePage.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { getAccessToken, getUserInfo, isAuthenticated, login, logout } from '@/api/auth'

export function HomePage() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<{ username: string; email: string } | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    isAuthenticated().then((ok) => {
      setAuthed(ok)
      if (ok) {
        getAccessToken().then((t) => {
          setToken(t)
          // eslint-disable-next-line no-console
          if (t) console.log('Keycloak access token:', t)
        })
        getUserInfo().then(setUser)
      }
    })
  }, [])

  const handleCopy = async () => {
    if (!token) return
    await navigator.clipboard.writeText(token)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (authed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-6">Email Server</h1>
          <button
            onClick={() => login()}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Login with Keycloak
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-8 bg-white">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-semibold">Email Server</h1>
          <button
            onClick={() => logout()}
            className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
          >
            Logout
          </button>
        </div>

        {user && (
          <div className="mb-6">
            <p className="text-sm text-gray-500">Logged in as</p>
            <p className="font-medium">{user.username}</p>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">Access Token</p>
            <button
              onClick={handleCopy}
              className="text-sm px-3 py-1 bg-gray-100 rounded hover:bg-gray-200"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="p-4 bg-gray-50 rounded border border-gray-200 break-all font-mono text-xs">
            {token ?? 'No token available'}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build still passes**

Run:
```bash
cd frontend && pnpm run build
```

Expected: Build succeeds.

---

### Task 8: Wire up routing in App.tsx

**Files:**
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `HomePage`, `LoginPage`, `CallbackPage` from `@/pages/*`
- Produces: Routed application with `/`, `/login`, `/callback`.

- [ ] **Step 1: Replace `frontend/src/App.tsx` contents**

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { HomePage } from '@/pages/HomePage'
import { LoginPage } from '@/pages/LoginPage'
import { CallbackPage } from '@/pages/CallbackPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/callback" element={<CallbackPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
```

- [ ] **Step 2: Verify build still passes**

Run:
```bash
cd frontend && pnpm run build
```

Expected: Build succeeds.

---

### Task 9: Final verification

**Files:**
- None (verification only).

- [ ] **Step 1: Run production build**

Run:
```bash
cd frontend && pnpm run build
```

Expected: No TypeScript errors, `dist/` generated.

- [ ] **Step 2: (Optional) Start dev server briefly to confirm it boots**

Run:
```bash
cd frontend && timeout 10 pnpm run dev
```

Expected: Vite starts on `http://localhost:5173`, no startup errors.

---

## Self-Review Checklist

- [x] **Spec coverage:** Every requirement from the design spec (scaffold, env, auth module, axios placeholder, login/callback/home pages, routing, build verification) is covered by a task.
- [x] **Placeholder scan:** No TBD, TODO, or vague instructions remain.
- [x] **Type consistency:** Function and component names match across tasks and the spec.

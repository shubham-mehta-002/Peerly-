# Design Document: Frontend Refactor

## Overview

This document describes the technical design for the Peerly frontend refactor. The refactor
addresses four areas of accumulated debt — auth token management, UI component standardisation,
TypeScript coverage, and code organisation — while keeping every existing user-facing feature
intact and not changing the visual design.

**Stack:** Next.js 16, React 19, Tailwind CSS v4, TanStack Query v5, Axios 1.x, shadcn/ui
(Radix-backed), TypeScript 5 (strict mode already enabled).

### Key goals

- Replace the single `peerly_token` with a dual `accessToken` / `refreshToken` pair that supports
  silent renewal via a refresh queue in the Axios interceptor.
- Standardise UI primitives on shadcn/ui; wrap them to preserve every existing prop contract.
- Remove the dark-mode toggle — the app is always dark.
- Split the monolithic `lib/context.tsx` into focused provider files and introduce a `features/`
  directory for feature-scoped sub-components.
- Reach zero `implicit any` / `as any` occurrences under `app/`, `components/`, and `lib/hooks/`.

---

## Architecture

The refactor is purely within `peerly/client/`. No new packages beyond the shadcn/ui CLI
installs are required; all needed Radix UI primitives are already present in `package.json`.

```
peerly/client/
├── app/                      # Next.js App Router pages (thin orchestrators after refactor)
├── components/
│   └── ui/                   # shadcn-generated primitives + custom wrappers
├── features/                 # NEW — feature-scoped sub-components
│   ├── auth/
│   ├── feed/
│   ├── communities/
│   ├── profile/
│   └── admin/
├── lib/
│   ├── api.ts                # Axios instance with interceptor chain (updated)
│   ├── auth-utils.ts         # Dual-token store (rewritten)
│   ├── hooks/                # TanStack Query hooks (unchanged structure, updated contracts)
│   ├── providers/            # NEW — split from context.tsx
│   │   ├── query-provider.tsx
│   │   ├── skeleton-provider.tsx
│   │   └── tweaks-provider.tsx
│   └── types.ts              # Shared TypeScript interfaces (updated)
└── ...
```

### Dependency graph (simplified)

```
app/layout.tsx
  └─ QueryProvider → SkeletonProvider → TweaksProvider

lib/api.ts
  └─ lib/auth-utils.ts  (getAccessToken, getRefreshToken, setTokens, clearTokens)

lib/hooks/*
  └─ lib/api.ts

features/*
  └─ lib/hooks/* + components/ui/*
```

---

## Components and Interfaces

### 1. `lib/auth-utils.ts` — Dual-Token Store

Complete rewrite of the current single-token module.

```ts
// lib/auth-utils.ts
const ACCESS_KEY  = 'peerly_access_token';
const REFRESH_KEY = 'peerly_refresh_token';
const COOKIE_OPTS = 'path=/; max-age=86400; SameSite=Lax';

export function setTokens(accessToken: string, refreshToken: string): void {
  if (!accessToken || !refreshToken) {
    throw new TypeError('setTokens: both accessToken and refreshToken must be non-empty');
  }
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
  document.cookie = `${ACCESS_KEY}=${accessToken}; ${COOKIE_OPTS}`;
  document.cookie = `${REFRESH_KEY}=${refreshToken}; ${COOKIE_OPTS}`;
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_KEY) || null;
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_KEY) || null;
}

export function clearTokens(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  document.cookie = `${ACCESS_KEY}=; path=/; max-age=0`;
  document.cookie = `${REFRESH_KEY}=; path=/; max-age=0`;
}

export function isAuthenticated(): boolean {
  return !!(getAccessToken() && getRefreshToken());
}
```

**Migration note:** The old `setToken` / `getToken` / `clearToken` functions (keyed on
`peerly_token`) are removed entirely. All callers must be updated before deployment.

---

### 2. `lib/api.ts` — Axios Interceptor Chain

#### Request interceptor (attach token)

```
Request → check window → getAccessToken() → set Authorization header if non-empty → pass through
```

#### Response interceptor (refresh queue)

```
Response error
  ├── not 401                  → reject (pass through)
  ├── URL starts /api/auth/    → reject (pass through, req 3.7)
  ├── 401 + no refresh token   → clearTokens() + redirect /auth/login
  ├── 401 + refresh in flight  → enqueue callback, await shared promise
  └── 401 + refresh available  → set isRefreshing=true
                                  POST /api/auth/refresh
                                  ├── success → setTokens(new) → flush queue → retry original
                                  └── failure → clearTokens() → reject queue → redirect
```

The refresh queue stores `{ resolve, reject }` pairs as closures over the original request
config. On flush, each callback re-invokes the Axios instance with the new token already in
`Authorization`.

```ts
// Shared state (module-level, not React state)
let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];
let rejectQueue:  Array<(err: unknown) => void>  = [];
```

The guard `!err.config?.__retried` prevents an infinite retry loop — the replayed request has
this flag set before being sent.

---

### 3. Auth Hooks — Updated Contracts (`lib/hooks/useAuth.ts`)

All four mutation hooks that previously called `setToken(data.token)` are updated to call
`setTokens(data.accessToken, data.refreshToken)`.

| Hook | Old response field | New response fields | New nav target |
|---|---|---|---|
| `useLogin` | `token` | `accessToken`, `refreshToken` | `/feed` or `/onboarding` |
| `useVerifyEmail` | `token` | `accessToken`, `refreshToken` | `/onboarding` |
| `useCompleteOnboarding` | `token` | `accessToken`, `refreshToken` | `/feed` |
| `useLogout` | — | fires `POST /api/auth/logout` with `{ refreshToken }` first | `/auth/login` |

`useLogout` changes from a plain function to a `useMutation` wrapper so the logout POST
(fire-and-forget with `finally`) can be tracked; the cleanup sequence is:

```
disconnectSocket()
→ POST /api/auth/logout (best-effort, finally block)
→ clearTokens()
→ qc.clear()
→ router.push('/auth/login')
```

The above `finally` ensures cleanup runs even on network failure (req 4.5).

---

### 4. shadcn/ui Component Adoption

#### Installation

```bash
npx shadcn@latest add button input label dialog dropdown-menu select radio-group popover avatar
```

shadcn writes files to `components/ui/` using the existing `components.json` config.

#### `Button` — wrapper-free drop-in

Current `Btn` variant-to-shadcn mapping:

| `Btn` variant | shadcn `Button` variant |
|---|---|
| `primary` | `default` |
| `secondary` | `secondary` |
| `ghost` | `ghost` |
| `danger` | `destructive` |

Size mapping: `sm` → `sm`, `md` → `default`, `lg` → `lg`.

All call sites change from `<Btn variant="primary">` to `<Button variant="default">`. The
`onClick`, `disabled`, and `type` props pass through unchanged on the shadcn `Button` element.

After migration, `components/ui/btn.tsx` is deleted.

#### `FormInput` — wrapper preserving custom props

shadcn generates `components/ui/input.tsx` as a bare `<input>` primitive. The current custom
`Input` component (label, hint, error, multiline, showToggle) moves to
`components/ui/form-input.tsx` and composes the new shadcn primitives internally:

```
FormInput
  ├── Label         (shadcn)  — when label prop provided
  ├── Input         (shadcn)  — for non-multiline, non-password-toggle
  │   OR <textarea>           — when multiline
  │   OR Input + Eye button   — when showToggle
  ├── <p class="text-sm text-muted-foreground"> — hint
  └── <p class="text-sm text-destructive">      — error
```

All existing call sites continue importing from `@/components/ui/form-input` (a one-time
rename of the import path).

#### `Avatar` — wrapper composing shadcn primitives

Current custom `Avatar` (in `components/ui/avatar.tsx`) is replaced by a wrapper that uses
the shadcn `Avatar`, `AvatarImage`, `AvatarFallback` primitives:

```
PeerlyAvatar (components/ui/peer-avatar.tsx)
  ├── anon=true  → AvatarFallback with ghost/badge char from anonStyle
  ├── src set    → AvatarImage + AvatarFallback (fallback shown while loading)
  └── no src     → AvatarFallback with initials (first letters of name words)
```

After migration, the old `components/ui/avatar.tsx` is deleted and all import sites updated
to `@/components/ui/peer-avatar`.

---

### 5. TypeScript Strengthening

`tsconfig.json` already has `"strict": true` — no change needed.

New and updated interfaces in `lib/types.ts`:

```ts
// Shared error shape
export interface ApiError {
  message: string;
  response?: { data?: { error?: string } };
}

// Auth response contracts
export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  onboarding_completed: boolean;
}

export interface VerifyEmailResponse {
  accessToken: string;
  refreshToken: string;
  onboarding_completed: boolean;
}

export interface OnboardingCompleteResponse {
  accessToken: string;
  refreshToken: string;
  profile: OnboardingProfile;
}

export interface OnboardingProfile {
  name: string;
  username: string;
  bio: string | null;
  campus_id: string;
  onboarding_completed: boolean;
  avatar_url: string | null;
  updated_at: string;
}

// Hook-owned API response types (currently missing or typed as unknown)
export interface AdminCollegeResponse {
  id: string;
  name: string;
  domain: string;
  status: 'active' | 'inactive';
  campus_count: number;
}

export interface CommunityResponse {
  id: string;
  name: string;
  description: string;
  member_count: number;
  category: string;
  is_member: boolean;
}

export interface CommunityMessageResponse {
  id: string;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  content: string;
  created_at: string;
  is_anon: boolean;
}

export interface CommentResponse {
  id: string;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  content: string;
  upvotes: number;
  depth: number;
  created_at: string;
  is_anon: boolean;
}

export interface ReportResponse {
  id: string;
  reason: string;
  status: 'pending' | 'resolved' | 'dismissed';
  created_at: string;
}

// TweaksState — darkMode removed
export interface TweaksState {
  cardLayout: CardLayout;
  anonStyle: AnonStyle;
  accentColor: AccentColor;
  setCardLayout: (v: CardLayout) => void;
  setAnonStyle: (v: AnonStyle) => void;
  setAccentColor: (v: AccentColor) => void;
}
```

Every Radix callback parameter (`onValueChange`, `onCheckedChange`, `onOpenChange`) gets its
exact exported type annotation (e.g., `(value: string) => void` from `@radix-ui/react-select`).

---

### 6. Provider Split (`lib/providers/`)

`lib/context.tsx` is deleted and replaced by three files:

**`lib/providers/query-provider.tsx`**
```tsx
'use client';
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

**`lib/providers/skeleton-provider.tsx`**
```tsx
'use client';
import { SkeletonTheme } from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

export function SkeletonProvider({ children }: { children: React.ReactNode }) {
  return (
    <SkeletonTheme baseColor="#2a2f3a" highlightColor="#363c4a">
      {children}
    </SkeletonTheme>
  );
}
```

**`lib/providers/tweaks-provider.tsx`**
```tsx
'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import type { TweaksState, CardLayout, AnonStyle, AccentColor } from '@/lib/types';

// darkMode state removed entirely
const TweaksContext = createContext<TweaksState>({ ... });

export function TweaksProvider({ children }: { children: React.ReactNode }) {
  const [cardLayout, setCardLayout] = useState<CardLayout>('open');
  const [anonStyle, setAnonStyle] = useState<AnonStyle>('badge');
  const [accentColor, setAccentColor] = useState<AccentColor>('sage');
  // ... localStorage persistence for cardLayout, anonStyle, accentColor (unchanged)
  return <TweaksContext.Provider value={...}>{children}</TweaksContext.Provider>;
}

export const useTweaks = () => useContext(TweaksContext);
```

`app/layout.tsx` composes the three providers and adds `className="dark"` statically:

```tsx
<html lang="en" className={`${inter.variable} dark`}>
  <body>
    <QueryProvider>
      <SkeletonProvider>
        <TweaksProvider>
          {children}
        </TweaksProvider>
      </SkeletonProvider>
    </QueryProvider>
  </body>
</html>
```

---

### 7. Code Modularisation — `features/` Directory

Feature sub-components extracted from oversized page files:

| Page file (current) | Lines | Extracted to |
|---|---|---|
| `app/auth/login/page.tsx` | ~290 | `features/auth/LoginForm.tsx`, `features/auth/OtpVerifyForm.tsx`, `features/auth/DomainChecker.tsx`, `features/auth/PasswordStrength.tsx` |
| `app/onboarding/page.tsx` | ~200+ | `features/auth/OnboardingForm.tsx` |
| `app/admin/page.tsx` | ~200+ | `features/admin/CollegeTable.tsx`, `features/admin/CollegeSearch.tsx` |
| `app/communities/[id]/page.tsx` | ~200+ | `features/communities/ChatWindow.tsx`, `features/communities/MessageInput.tsx` |
| `app/profile/edit/page.tsx` | ~200+ | `features/profile/EditProfileForm.tsx`, `features/profile/AvatarUpload.tsx` |

Pages under ~150 lines (feed, global-feed, individual post, profile view) can stay as-is.

#### `ErrorMessage` component

```tsx
// components/ui/error-message.tsx
interface ErrorMessageProps { message: string | null }

export function ErrorMessage({ message }: ErrorMessageProps) {
  if (!message) return null;
  return (
    <div className="px-3.5 py-2.5 rounded-lg text-[13px] leading-relaxed
                    bg-red-500/8 border border-red-600 text-red-600">
      {message}
    </div>
  );
}
```

This replaces the five duplicated inline error banner blocks across auth and admin pages.

---

### 8. Always-Dark Mode

Changes required:

1. **`app/layout.tsx`** — add static `"dark"` to `className`:
   ```tsx
   <html lang="en" className={`${inter.variable} dark`}>
   ```
2. **`lib/providers/tweaks-provider.tsx`** — no `darkMode` state, no localStorage read, no
   `classList` manipulation.
3. **`lib/types.ts`** — remove `darkMode: boolean` and `setDarkMode` from `TweaksState`.
4. **`components/app-nav.tsx`** — remove the `darkMode` / `setDarkMode` destructure and the
   toggle button element entirely.
5. **`lib/providers/skeleton-provider.tsx`** — passes literal `"#2a2f3a"` / `"#363c4a"` with
   no darkMode variable.
6. Any component that currently reads `useTweaks().darkMode` has that access removed; any
   conditional that branched on it always takes the dark branch.

---

## Data Models

### Token storage

| Key | Storage | Lifetime | Purpose |
|---|---|---|---|
| `peerly_access_token` | `localStorage` + cookie | `max-age=86400` (1 day) | Sent as `Bearer` on every API request |
| `peerly_refresh_token` | `localStorage` + cookie | `max-age=86400` (1 day) | Used exclusively by `POST /api/auth/refresh` |

The cookies exist solely so Next.js middleware can read the tokens server-side for route
protection; the Axios interceptors always read from `localStorage`.

### Refresh queue entry

```ts
interface RefreshQueueEntry {
  resolve: (token: string) => void;
  reject:  (err: unknown) => void;
}
```

### `ApiError` (shared)

```ts
interface ApiError {
  message: string;
  response?: { data?: { error?: string } };
}
```

### Updated `TweaksState`

```ts
interface TweaksState {
  cardLayout: CardLayout;
  anonStyle:  AnonStyle;
  accentColor: AccentColor;
  setCardLayout:  (v: CardLayout) => void;
  setAnonStyle:   (v: AnonStyle) => void;
  setAccentColor: (v: AccentColor) => void;
}
```

Fields removed vs. current: `darkMode: boolean`, `setDarkMode: (v: boolean) => void`.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions
of a system — essentially, a formal statement about what the system should do. Properties
serve as the bridge between human-readable specifications and machine-verifiable correctness
guarantees.*

### Property 1: `setTokens` writes both tokens to localStorage

*For any* pair of non-empty strings `accessToken` and `refreshToken`, calling
`setTokens(accessToken, refreshToken)` SHALL result in
`localStorage.getItem('peerly_access_token') === accessToken` AND
`localStorage.getItem('peerly_refresh_token') === refreshToken`.

**Validates: Requirements 1.1, 1.3**

---

### Property 2: `setTokens` with any empty argument throws and makes no writes

*For any* token pair where at least one value is an empty string (or the empty string `""`),
calling `setTokens` SHALL throw a `TypeError` and the values of both `localStorage` keys SHALL
be unchanged from before the call.

**Validates: Requirements 1.4**

---

### Property 3: `clearTokens` removes both tokens — round trip invariant

*For any* pair of non-empty tokens, calling `setTokens` followed immediately by `clearTokens`
SHALL leave `localStorage.getItem('peerly_access_token')` and
`localStorage.getItem('peerly_refresh_token')` both `null`.

**Validates: Requirements 1.5**

---

### Property 4: Legacy key `peerly_token` is never written

*For any* call to `setTokens` or `clearTokens` with any token values,
`localStorage.getItem('peerly_token')` SHALL remain `null` (never written).

**Validates: Requirements 1.7**

---

### Property 5: Request interceptor attaches token for any outgoing request

*For any* outgoing Axios request config that has no pre-set `Authorization` header, when
`getAccessToken()` returns a non-empty string, the intercepted config SHALL have
`Authorization: Bearer <token>` set before the request is sent.

**Validates: Requirements 2.1**

---

### Property 6: Request interceptor omits token when none is present

*For any* outgoing Axios request config, when `getAccessToken()` returns `null` or an empty
string AND no `Authorization` header was manually set, the intercepted config SHALL have no
`Authorization` header.

**Validates: Requirements 2.2**

---

### Property 7: Refresh token retry carries new access token

*For any* original failed request and any new `accessToken`/`refreshToken` pair returned by
`POST /api/auth/refresh`, the retried request SHALL carry `Authorization: Bearer <newAccessToken>`
and SHALL NOT carry the old expired access token.

**Validates: Requirements 3.4**

---

### Property 8: Exactly one refresh call for any number of concurrent 401 failures

*For any* count N ≥ 2 of concurrent requests that each receive a 401, the Axios interceptor
SHALL issue exactly one `POST /api/auth/refresh` call and SHALL eventually resolve all N
original requests (or reject them all if the refresh fails).

**Validates: Requirements 3.5**

---

### Property 9: Auth route 401s are never intercepted for refresh

*For any* request URL that starts with `/api/auth/` that receives a 401 response, the
interceptor SHALL pass the error through without calling `getRefreshToken()`, without issuing a
`POST /api/auth/refresh`, and without redirecting the browser.

**Validates: Requirements 3.7**

---

### Property 10: `useLogout` always cleans up regardless of logout API failure

*For any* failure mode of `POST /api/auth/logout` (4xx, 5xx, or network error), `clearTokens()`
and `qc.clear()` SHALL still be called and the router SHALL still navigate to `/auth/login`.

**Validates: Requirements 4.5**

---

### Property 11: `Button` fires `onClick` identically to `Btn` for any prop combination

*For any* combination of `variant`, `size`, `disabled`, `type`, and `onClick` props, the
shadcn `Button` element SHALL fire the `onClick` handler with the same `React.MouseEvent` and
SHALL apply the `disabled` attribute identically to the legacy `Btn`.

**Validates: Requirements 5.2, 9.3**

---

### Property 12: `FormInput` controlled binding is transparent for any input value

*For any* string `value` passed to `FormInput` and any `onChange` handler, the `onChange`
callback SHALL receive a `React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>` with
`event.target.value` reflecting the new value, and the displayed `value` SHALL equal the
controlled `value` prop — regardless of the `label`, `hint`, `error`, `multiline`, or
`showToggle` prop values.

**Validates: Requirements 5.3, 9.3**

---

### Property 13: `PeerlyAvatar` renders correct visual state for any prop combination

*For any* combination of `name`, `src`, `size`, and `anon` props, `PeerlyAvatar` SHALL render:
- when `anon=true`: a fallback placeholder using the current `anonStyle` (never the real name or image);
- when `anon=false` and `src` is set: an `<img>` (via `AvatarImage`) with the correct `src`;
- when `anon=false` and `src` is unset: a fallback showing the initials derived from `name`.

**Validates: Requirements 5.4**

---

### Property 14: `ErrorMessage` renders the error banner for any non-null message

*For any* non-null, non-empty `message` string, `ErrorMessage` SHALL render a container element
that includes the message text and has the red error styling (background, border, text colour).
When `message` is `null`, `ErrorMessage` SHALL render nothing.

**Validates: Requirements 7.5**

---

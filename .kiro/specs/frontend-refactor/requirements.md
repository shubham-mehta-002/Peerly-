# Requirements Document

## Introduction

Peerly is a campus-scoped social platform built with Next.js 16, React 19, Tailwind CSS v4, TanStack Query, and Axios. The frontend codebase is functional but has accumulated technical debt: it uses a single JWT stored in `localStorage` with no refresh logic, relies on hand-rolled UI components styled with inline CSS instead of proper shadcn/ui, has weak TypeScript coverage with implicit `any` types, and contains oversized page-level components that mix data fetching, business logic, and rendering. This spec covers the cross-cutting refactor to address all of these issues without changing the visual design or breaking any existing features.

---

## Glossary

- **App**: The Peerly Next.js frontend application located in `peerly/client/`.
- **Auth_Client**: The module responsible for all authentication state and token management (currently `lib/auth-utils.ts` + `lib/api.ts`).
- **Token_Store**: The browser-side persistent store for tokens (currently `localStorage`).
- **Access_Token**: A short-lived JWT returned by `POST /auth/login` and `POST /auth/refresh`, used to authenticate API requests.
- **Refresh_Token**: A longer-lived opaque token returned alongside the Access_Token, used exclusively to obtain a new Access_Token via `POST /auth/refresh`.
- **Axios_Instance**: The shared Axios client created in `lib/api.ts` that all hooks use for API calls.
- **shadcn_Component**: A UI component sourced from the official shadcn/ui registry (e.g., `Button`, `Input`, `Label`, `Dialog`, `DropdownMenu`, `Select`, `RadioGroup`, `Popover`, `Avatar`).
- **Custom_Component**: A hand-rolled UI component currently living in `components/ui/` (e.g., `Btn`, `Input`, `Avatar`).
- **Type_Definition**: A TypeScript `interface` or `type` alias defined in `lib/types.ts` or co-located with the module that owns the data.
- **Dark_Mode**: The visual theme applied when `html.dark` class is present, defined in `app/globals.css`.
- **TweaksProvider**: The React context provider in `lib/context.tsx` that wraps the app with QueryClient, SkeletonTheme, and UI preference state.
- **Feature_Module**: A self-contained directory grouping a page's hook, API calls, sub-components, and types (e.g., `features/feed/`, `features/auth/`).

---

## Requirements

### Requirement 1: Access Token and Refresh Token Storage

**User Story:** As a developer, I want the Auth_Client to store both an Access_Token and a Refresh_Token separately, so that the application can silently renew sessions without forcing users to log in again.

#### Acceptance Criteria

1. THE Auth_Client SHALL store the Access_Token in `localStorage` key `peerly_access_token` and the Refresh_Token in `localStorage` key `peerly_refresh_token` as separate entries.
2. THE Auth_Client SHALL expose typed functions: `getAccessToken(): string | null`, `getRefreshToken(): string | null`, `setTokens(accessToken: string, refreshToken: string): void`, `clearTokens(): void`, and `isAuthenticated(): boolean` (returns `true` iff both `getAccessToken()` and `getRefreshToken()` return non-empty strings).
3. WHEN `setTokens` is called with non-empty `accessToken` and `refreshToken` strings, THE Auth_Client SHALL write both values to their respective `localStorage` keys AND set two cookies (`peerly_access_token` and `peerly_refresh_token`) with attributes `max-age=86400; path=/; SameSite=Lax` for Next.js middleware access.
4. WHEN `setTokens` is called with an empty string for either argument, THE Auth_Client SHALL throw a `TypeError` and make no writes to `localStorage` or cookies.
5. WHEN `clearTokens` is called, THE Auth_Client SHALL remove both `peerly_access_token` and `peerly_refresh_token` from `localStorage` AND expire both cookies by setting `max-age=0`.
6. IF `typeof window === 'undefined'` (SSR context), THEN `getAccessToken()`, `getRefreshToken()`, and `isAuthenticated()` SHALL return `null`, `null`, and `false` respectively without throwing.
7. THE Auth_Client SHALL NOT write to or read from the legacy `peerly_token` key in `localStorage` or cookies; after migration, `localStorage.getItem('peerly_token')` and `document.cookie` SHALL contain no entry named `peerly_token`.

---

### Requirement 2: Axios Interceptor — Attach Access Token

**User Story:** As a developer, I want the Axios_Instance to attach the current Access_Token to every outgoing request, so that all authenticated API calls work without manual header management.

#### Acceptance Criteria

1. WHEN the Axios_Instance sends a request AND the request config does not already contain an `Authorization` header, THE Axios_Instance SHALL call `getAccessToken()` and, IF a non-empty token is returned, set `Authorization: Bearer <token>` on the request config before it is sent.
2. WHEN `getAccessToken()` returns `null` or an empty string AND no `Authorization` header was manually set, THE Axios_Instance SHALL send the request without an `Authorization` header.
3. IF `typeof window === 'undefined'` at the time the request interceptor runs, THE Axios_Instance SHALL skip the token attachment and pass the request config through unchanged.

---

### Requirement 3: Axios Interceptor — Automatic Token Refresh

**User Story:** As a developer, I want the Axios_Instance to automatically refresh the Access_Token on 401 responses, so that users with valid sessions are never interrupted by expired tokens.

#### Acceptance Criteria

1. WHEN the Axios_Instance receives a 401 response on a request whose URL does NOT start with `/api/auth/`, THE Axios_Instance SHALL check whether a Refresh_Token exists via `getRefreshToken()`.
2. IF no Refresh_Token exists at the time of the 401, THE Axios_Instance SHALL immediately call `clearTokens()` and redirect the browser to `/auth/login` without attempting a refresh call.
3. IF a Refresh_Token exists and no refresh is currently in progress, THE Axios_Instance SHALL call `POST /api/auth/refresh` with `{ refreshToken: getRefreshToken() }` in the request body.
4. WHEN the refresh call returns successfully, THE Auth_Client SHALL call `setTokens(data.accessToken, data.refreshToken)` with the new tokens, and THE Axios_Instance SHALL retry the original failed request with the new `Authorization: Bearer <newAccessToken>` header.
5. WHEN a refresh is already in progress and another request receives a 401, THE Axios_Instance SHALL enqueue a callback for that request and replay it with the new Access_Token after the in-flight refresh resolves — rather than issuing a second `POST /api/auth/refresh`.
6. WHEN the refresh call fails with any HTTP 4xx/5xx response or a network error, THE Auth_Client SHALL call `clearTokens()`, all queued request callbacks SHALL be rejected with a session-expired error, and THE Axios_Instance SHALL redirect the browser to `/auth/login`.
7. THE Axios_Instance SHALL NOT intercept 401 responses on requests whose URL starts with `/api/auth/` (login, register, verify-email, refresh, logout, forgot-password, reset-password).

---

### Requirement 4: Auth Hooks Update Login / Logout / Onboarding Flows

**User Story:** As a developer, I want all auth mutations to use the new dual-token API contract, so that the login, registration, verify-email, and onboarding flows store tokens correctly.

#### Acceptance Criteria

1. WHEN `useLogin` receives a successful response, THE hook SHALL call `setTokens(data.accessToken, data.refreshToken)`, invalidate the `['me']` query cache, and navigate to `/feed` or `/onboarding` based on `data.onboarding_completed`.
2. WHEN `useVerifyEmail` receives a successful response, THE hook SHALL call `setTokens(data.accessToken, data.refreshToken)`, invalidate the `['me']` query cache, and navigate to `/onboarding`.
3. WHEN `useCompleteOnboarding` receives a successful response, THE hook SHALL call `setTokens(data.accessToken, data.refreshToken)`, invalidate the `['me']` query cache, and navigate to `/feed`.
4. WHEN `useLogout` is invoked, THE hook SHALL call `disconnectSocket()`, then call `POST /api/auth/logout` with `{ refreshToken: getRefreshToken() }` upon receiving a response or encountering a network/timeout error, THEN call `clearTokens()`, call `qc.clear()` to clear the query cache, and navigate to `/auth/login`.
5. IF `POST /api/auth/logout` fails with an HTTP 4xx/5xx response OR a network/timeout error, THE hook SHALL still call `clearTokens()`, call `qc.clear()`, and navigate to `/auth/login`.
6. THE four mutation hooks `useLogin`, `useVerifyEmail`, `useCompleteOnboarding`, and `useLogout` SHALL NOT reference `data.token` or call the legacy `setToken(string)` function anywhere in their `onSuccess` or error handlers.

---

### Requirement 5: shadcn/ui Component Adoption

**User Story:** As a developer, I want the App to use official shadcn/ui components instead of hand-rolled equivalents, so that we get accessible, well-tested primitives with consistent Radix UI underpinnings.

#### Acceptance Criteria

1. THE App SHALL install shadcn/ui components (`Button`, `Input`, `Label`, `Dialog`, `DropdownMenu`, `Select`, `RadioGroup`, `Popover`, `Avatar`) via the shadcn CLI using the existing `components.json` configuration, resulting in component files under `components/ui/` generated by the CLI.
2. WHEN any page or component currently imports `Btn` from `@/components/ui/btn`, THE App SHALL replace it with the shadcn `Button`, mapping variants: `primary`→`default`, `secondary`→`secondary`, `ghost`→`ghost`, `danger`→`destructive`; all existing `onClick`, `disabled`, and `type` props SHALL be preserved identically.
3. WHEN any page or component currently imports `Input` from `@/components/ui/input`, THE App SHALL replace it with a wrapper that composes shadcn `Input` + `Label`, preserving the `label`, `hint`, `error`, `multiline` (renders `<textarea>`), and `showToggle` (password visibility toggle) prop behaviours; controlled `value`/`onChange` bindings SHALL remain unchanged.
4. WHEN any page or component currently imports `Avatar` from `@/components/ui/avatar`, THE App SHALL replace it with shadcn `Avatar` + `AvatarImage` + `AvatarFallback`, preserving the fallback-initials logic and the anon-mode rendering (renders a generic icon when `anon` prop is true).
5. THE App SHALL retain `anon-label.tsx`, `image-carousel.tsx`, `report-modal.tsx`, `tag.tsx`, `divider.tsx`, and `skeletons.tsx` without functional changes; their inline `style={{}}` attributes SHALL be converted to Tailwind utility classes only where a direct equivalent exists and the visual output is provably unchanged.
6. THE files `components/ui/btn.tsx` and `components/ui/avatar.tsx` SHALL be deleted after all import sites are migrated; `components/ui/input.tsx` SHALL be replaced by the shadcn-generated file, with the custom wrapper (preserving `label`, `hint`, `error`, `multiline`, `showToggle`) living in a separate file (e.g., `components/ui/form-input.tsx`).

---

### Requirement 6: TypeScript Strengthening

**User Story:** As a developer, I want all frontend TypeScript files to be free of implicit `any` types and to use well-defined interfaces, so that the compiler catches type errors before runtime.

#### Acceptance Criteria

1. THE `tsconfig.json` SHALL have `"strict": true` set in `compilerOptions`; if it is already present, it SHALL remain unchanged; if absent, it SHALL be added.
2. THE App SHALL define and export an `ApiError` interface in `lib/types.ts` with the shape `{ message: string; response?: { data?: { error?: string } } }`; the inline `type ApiError` definitions currently duplicated in `app/auth/login/page.tsx`, `app/onboarding/page.tsx`, and `components/ui/report-modal.tsx` SHALL be removed and replaced with an import of the shared `ApiError` from `lib/types.ts`.
3. THE App SHALL define and export typed response interfaces for all hook-owned API calls that currently lack them: at minimum `AdminCollegeResponse`, `CommunityResponse`, `CommunityMessageResponse`, `CommentResponse`, `ReportResponse`, and `OnboardingCompleteResponse` (replacing the current `profile: unknown` field in `useCompleteOnboarding`).
4. THE App SHALL have zero occurrences of `: any` or `as any` in files under `app/`, `components/`, and `lib/hooks/` after the refactor; a `tsc --noEmit` run SHALL complete with no `implicit any` or `unsafe assignment` errors.
5. WHEN a Radix UI or shadcn callback parameter currently lacks a type annotation (e.g., `onValueChange`, `onCheckedChange`, `onOpenChange` handlers), THE App SHALL annotate each parameter with the exact type exported by the corresponding Radix UI package (e.g., `onValueChange: (value: string) => void`).
6. THE `lib/data.ts` sample data arrays (`SAMPLE_POSTS`, `SAMPLE_COMMUNITIES`, `SAMPLE_MESSAGES`, `SAMPLE_COMMENTS`) SHALL be annotated with their corresponding types from `lib/types.ts`; any fields that diverge from the real API response shapes SHALL be updated to match, and the `lib/types.ts` interfaces SHALL be updated accordingly.

---

### Requirement 7: Code Modularization

**User Story:** As a developer, I want large page files to be broken into focused sub-components and hooks, so that each file has a single responsibility and can be understood and tested in isolation.

#### Acceptance Criteria

1. THE App SHALL organise feature-specific UI sub-components into a `features/` directory with subdirectories: `features/auth/`, `features/feed/`, `features/communities/`, `features/profile/`, `features/admin/`; each subdirectory SHALL contain only the sub-components and helper files for that feature domain.
2. WHEN a page file under `app/` exceeds approximately 200 lines AND contains both data-fetching calls and JSX rendering, THE App SHALL extract each distinct logical section (e.g., a form, a list, a header panel) into a named sub-component file in the corresponding `features/` subdirectory, leaving the page file as a thin orchestrator.
3. THE `lib/hooks/` directory SHALL remain the sole location for TanStack Query `useQuery` and `useMutation` wrappers; no hook file in `lib/hooks/` SHALL contain JSX (`<` element syntax or `return (<...>)`).
4. THE `lib/context.tsx` file SHALL be deleted and its responsibilities split into three files: `lib/providers/query-provider.tsx` (exports `QueryProvider` with the `QueryClient` setup), `lib/providers/skeleton-provider.tsx` (exports `SkeletonProvider` wrapping `react-loading-skeleton`'s `SkeletonTheme`), and `lib/providers/tweaks-provider.tsx` (exports `TweaksProvider` and `useTweaks` for `cardLayout`, `anonStyle`, and `accentColor` preferences).
5. THE App SHALL introduce a `components/ui/error-message.tsx` file exporting an `ErrorMessage` component that accepts a `message: string | null` prop and renders the styled error banner (red background, border, text) currently duplicated across `app/auth/login/page.tsx`, `app/auth/forgot-password/page.tsx`, `app/auth/reset-password/page.tsx`, `app/admin/page.tsx`, and post-related pages; all duplicate inline error banner JSX SHALL be replaced with `<ErrorMessage message={...} />`.
6. WHEN a file under `app/` or `components/` imports six or more named exports from a single source module, THE App SHALL evaluate splitting that source module into domain-specific files and SHALL do so if the exports fall into two or more distinct functional categories.

---

### Requirement 8: Always-Dark Mode Enforcement

**User Story:** As a developer, I want the App to always render in dark mode without a light/dark toggle, so that the UI is consistent for all users and the toggle code is removed.

#### Acceptance Criteria

1. THE `app/layout.tsx` root layout SHALL include `className="dark"` on the `<html>` element as a static string attribute (not computed at runtime), ensuring dark-mode CSS variables are applied from the initial server-rendered HTML and there is no flash of unstyled content.
2. THE `TweaksProvider` (after split into `lib/providers/tweaks-provider.tsx`) SHALL NOT contain `useState` for `darkMode`, SHALL NOT read `localStorage.getItem('peerly_dark')` on mount, and SHALL NOT call `document.documentElement.classList.add/remove('dark')` anywhere in its body.
3. THE `TweaksState` TypeScript interface in `lib/types.ts` SHALL NOT contain `darkMode: boolean` or `setDarkMode: (v: boolean) => void` fields; the `createContext` default object SHALL likewise omit those two fields.
4. THE `AppNav` component SHALL NOT contain a dark mode toggle button element or its associated `onClick` handler; the rendered HTML for `AppNav` SHALL contain no element whose accessible label or `aria-label` references "dark mode", "light mode", or "theme".
5. THE `SkeletonProvider` (after split) SHALL pass fixed literal values `base="#2a2f3a"` and `highlight="#363c4a"` to `SkeletonTheme` without reading or computing them from any `darkMode` variable.
6. WHEN any component outside `TweaksProvider` currently accesses `useTweaks().darkMode`, THE App SHALL remove that destructured property access; IF the component used `darkMode` in conditional rendering logic, that condition SHALL be replaced with the constant dark-mode equivalent (i.e., the dark branch is always taken).

---

### Requirement 9: Non-Breaking Existing Feature Preservation

**User Story:** As a developer, I want the refactor to leave all existing user-facing features functionally intact, so that users experience no regressions in feed, posts, communities, profiles, admin, or auth flows.

#### Acceptance Criteria

1. THE App SHALL preserve all existing Next.js route segments: `/feed`, `/global-feed`, `/posts/[id]`, `/posts/new`, `/communities`, `/communities/[id]`, `/profile`, `/profile/[username]`, `/profile/edit`, `/admin`, `/admin/colleges/[id]`, `/auth/login`, `/auth/forgot-password`, `/auth/reset-password`, `/onboarding`; no route SHALL return a 404 after the refactor.
2. THE App SHALL preserve all existing TanStack Query cache keys exactly: `['me']`, `['feed', ...]`, `['post', id]`, `['profile', ...]`, `['communities']`, `['comments', postId]`; no key string SHALL be renamed or restructured during the refactor, so that existing `invalidateQueries` and `setQueryData` calls continue to target the correct caches.
3. WHEN shadcn `Button` replaces `Btn`, the resulting element SHALL fire the same `onClick` handler with the same event object; WHEN shadcn `Input` (via wrapper) replaces the custom `Input`, the `onChange` callback SHALL receive an identical `React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>` and the `value` prop SHALL continue to control the field; form submissions that previously worked SHALL continue to submit without modification.
4. THE `TweaksProvider` (after modularisation) SHALL continue to expose and persist `cardLayout`, `anonStyle`, and `accentColor` state via `localStorage` keys `peerly_card_layout`, `peerly_anon_style`, and `peerly_accent_color`; components that call `useTweaks()` to read or set these values SHALL continue to work without change.
5. THE `lib/socket.ts` file SHALL NOT be modified; the `disconnectSocket()` import and call in `useLogout` SHALL be preserved; Socket.IO community chat functionality SHALL remain fully operational.
6. THE `lib/cloudinary.ts` file SHALL NOT be modified; all Cloudinary upload call-sites in post creation and profile edit flows SHALL continue to invoke it with the same arguments and handle the returned URL identically.

# Implementation Plan: Frontend Refactor

## Overview

Incremental migration of the Peerly frontend across seven phases:
1. Token storage + Axios interceptor chain (foundation — must land before anything auth-related)
2. Auth hooks updated to dual-token contracts
3. Provider split + always-dark mode (parallel with auth hooks)
4. shadcn/ui installation + wrapper components
5. TypeScript strengthening across hooks and shared types
6. Code modularisation — features/ directory, extract sub-components, ErrorMessage
7. Final cleanup — delete legacy files and remove legacy key references

Each task is atomic and executable in isolation. All tasks reference the requirements and design sections they satisfy.

---

## Tasks

- [x] 1. Rewrite token storage module (`lib/auth-utils.ts`)
  - [x] 1.1 Implement the dual-token store with `setTokens`, `getAccessToken`, `getRefreshToken`, `clearTokens`, and `isAuthenticated`
    - Replace the entire `lib/auth-utils.ts` file with the implementation from Design §1
    - `setTokens(accessToken, refreshToken)` writes to `localStorage` keys `peerly_access_token` / `peerly_refresh_token` and mirrors both as cookies with `max-age=86400; path=/; SameSite=Lax`
    - `setTokens` throws a `TypeError` when either argument is an empty string and makes no writes
    - `getAccessToken()` and `getRefreshToken()` return `string | null`; all three read-functions guard `typeof window === 'undefined'` and return `null` / `false` in SSR
    - `clearTokens()` removes both `localStorage` entries and expires both cookies with `max-age=0`
    - `isAuthenticated()` returns `true` only when both tokens are non-empty
    - Do NOT write to or read from the legacy `peerly_token` key anywhere in this file
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [ ]* 1.2 Write property tests for `lib/auth-utils.ts`
    - **Property 1: `setTokens` writes both tokens to localStorage**
    - **Validates: Requirements 1.1, 1.3**
    - **Property 2: `setTokens` with any empty argument throws and makes no writes**
    - **Validates: Requirements 1.4**
    - **Property 3: `clearTokens` removes both tokens — round-trip invariant**
    - **Validates: Requirements 1.5**
    - **Property 4: Legacy key `peerly_token` is never written**
    - **Validates: Requirements 1.7**
    - Use `vitest` + `@testing-library/react` with a `localStorage` mock

- [x] 2. Rewrite Axios interceptor chain (`lib/api.ts`)
  - [x] 2.1 Implement the request interceptor that attaches `getAccessToken()` as `Authorization: Bearer`
    - Replace the existing request interceptor in `lib/api.ts`
    - Guard `typeof window === 'undefined'`; skip attachment and pass through on SSR
    - Only set the header when `getAccessToken()` returns a non-empty string and the config has no existing `Authorization` header
    - Import `getAccessToken` from the new `lib/auth-utils.ts` (not the legacy `getToken`)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 2.2 Implement the response interceptor with refresh queue
    - Add module-level state: `let isRefreshing = false`, `refreshQueue`, `rejectQueue` as described in Design §2
    - On 401 where `err.config?.url` starts with `/api/auth/` — pass the error through unchanged (no refresh, no redirect)
    - On 401 without a refresh token — call `clearTokens()` and redirect to `/auth/login`
    - On 401 with a refresh token and no refresh in flight — call `POST /api/auth/refresh` with `{ refreshToken: getRefreshToken() }`; on success call `setTokens(data.accessToken, data.refreshToken)`, flush the queue, and retry the original request with `__retried = true` flag; on failure call `clearTokens()`, reject the queue, and redirect
    - On 401 when a refresh is already in flight — push `{ resolve, reject }` onto the queue and return a new Promise; do NOT issue a second refresh call
    - Use the `__retried` guard to prevent infinite retry loops
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [ ]* 2.3 Write property tests for the Axios interceptor
    - **Property 5: Request interceptor attaches token for any outgoing request**
    - **Validates: Requirements 2.1**
    - **Property 6: Request interceptor omits token when none is present**
    - **Validates: Requirements 2.2**
    - **Property 7: Refresh token retry carries new access token**
    - **Validates: Requirements 3.4**
    - **Property 8: Exactly one refresh call for any N ≥ 2 concurrent 401 failures**
    - **Validates: Requirements 3.5**
    - **Property 9: Auth route 401s are never intercepted for refresh**
    - **Validates: Requirements 3.7**
    - Use `vitest` + `axios-mock-adapter`; mock `localStorage` and `window.location`

- [x] 3. Checkpoint — foundation
  - Ensure `lib/auth-utils.ts` and `lib/api.ts` compile with `tsc --noEmit` and all existing tests pass. Ask the user if anything looks wrong before continuing.

- [x] 4. Update auth hooks to dual-token contracts (`lib/hooks/useAuth.ts`)
  - [x] 4.1 Update `useLogin`, `useVerifyEmail`, and `useCompleteOnboarding` to call `setTokens`
    - Replace every `setToken(data.token)` call with `setTokens(data.accessToken, data.refreshToken)`
    - Update the `mutationFn` generic types to `LoginResponse`, `VerifyEmailResponse`, `OnboardingCompleteResponse` (to be added in Task 5.1 — for now use inline types)
    - Ensure `useCompleteOnboarding` no longer types `profile` as `unknown`
    - Preserve all existing `router.push`, `qc.invalidateQueries`, and `staleTime` settings
    - _Requirements: 4.1, 4.2, 4.3, 4.6_

  - [x] 4.2 Rewrite `useLogout` as a `useMutation` with fire-and-forget POST
    - Change `useLogout` from a plain function factory to a `useMutation`
    - Mutation sequence: `disconnectSocket()` → `POST /api/auth/logout` with `{ refreshToken: getRefreshToken() }` → in `finally`: `clearTokens()` + `qc.clear()` + `router.push('/auth/login')`
    - The `finally` block MUST run even when the POST fails with 4xx / 5xx / network error
    - Import `getRefreshToken` from `lib/auth-utils.ts` (not the old `clearToken`)
    - _Requirements: 4.4, 4.5, 4.6_

  - [ ]* 4.3 Write property test for `useLogout` cleanup guarantee
    - **Property 10: `useLogout` always cleans up regardless of logout API failure**
    - **Validates: Requirements 4.5**
    - Mock the POST endpoint to fail; assert `clearTokens`, `qc.clear`, and `router.push` are still called

- [x] 5. Provider split + always-dark mode
  - [x] 5.1 Create `lib/providers/query-provider.tsx`
    - New file exporting `QueryProvider` that wraps children in `QueryClientProvider` with a stable `QueryClient` instance (created via `useState(() => new QueryClient())`)
    - Matches the Design §6 snippet exactly
    - _Requirements: 7.4_

  - [x] 5.2 Create `lib/providers/skeleton-provider.tsx`
    - New file exporting `SkeletonProvider` wrapping `SkeletonTheme` with hardcoded `baseColor="#2a2f3a"` and `highlightColor="#363c4a"`
    - No `darkMode` variable — literal values only
    - _Requirements: 7.4, 8.5_

  - [x] 5.3 Create `lib/providers/tweaks-provider.tsx`
    - New file exporting `TweaksProvider` and `useTweaks`
    - State: `cardLayout`, `anonStyle`, `accentColor` only — no `darkMode` state, no `localStorage.getItem('peerly_dark')`, no `classList` manipulation
    - Preserve `localStorage` persistence for `peerly_card_layout`, `peerly_anon_style`, `peerly_accent_color` and the `data-accent` attribute logic for `accentColor`
    - Context default and `TweaksState` type: no `darkMode` / `setDarkMode` fields
    - _Requirements: 7.4, 8.2, 8.3, 9.4_

  - [x] 5.4 Update `app/layout.tsx` to use new providers and static dark class
    - Replace `import { TweaksProvider } from '@/lib/context'` with imports of all three new providers
    - Compose `<QueryProvider><SkeletonProvider><TweaksProvider>` in that order
    - Add static `dark` to `<html>` className: `className={\`${inter.variable} dark\`}`
    - _Requirements: 8.1, 7.4_

  - [x] 5.5 Remove dark-mode toggle from `components/app-nav.tsx`
    - Remove `darkMode` and `setDarkMode` from the `useTweaks()` destructure
    - Delete the toggle `<button>` element (the `☀` / `◑` button) and its `onClick` handler
    - Update import to `useTweaks` from `@/lib/providers/tweaks-provider` instead of `@/lib/context`
    - _Requirements: 8.4_

- [x] 6. Checkpoint — auth + providers
  - Ensure `tsc --noEmit` passes, `app/layout.tsx` renders without errors, and login/logout flows work end-to-end. Ask the user before continuing.

- [ ] 7. Install shadcn/ui components and create wrappers
  - [x] 7.1 Install shadcn/ui primitives via CLI
    - Run `npx shadcn@latest add button input label dialog dropdown-menu select radio-group popover avatar` in `client/`
    - Confirm generated files land in `components/ui/` per the existing `components.json` config
    - Do not modify any generated files — wrappers go in separate files
    - _Requirements: 5.1_

  - [x] 7.2 Create `components/ui/form-input.tsx` wrapper
    - New file exporting `FormInput` that preserves the full `InputProps` interface from the current `components/ui/input.tsx`: `label`, `placeholder`, `type`, `value`, `onChange`, `hint`, `error`, `multiline`, `rows`, `showToggle`
    - Internally compose shadcn `Label` + shadcn `Input` (or `<textarea>` for `multiline`) + Eye toggle button (for `showToggle`) + hint `<p>` + error `<p>` using Tailwind classes matching the current inline styles
    - Controlled `value` / `onChange` binding must pass through to the underlying element unchanged
    - Move `EyeIcon` and `EyeOffIcon` SVG helpers from the old file into this file
    - _Requirements: 5.3, 9.3_

  - [ ]* 7.3 Write property test for `FormInput` controlled binding
    - **Property 12: `FormInput` controlled binding is transparent for any input value**
    - **Validates: Requirements 5.3, 9.3**

  - [x] 7.4 Create `components/ui/peer-avatar.tsx` wrapper
    - New file exporting `PeerlyAvatar` with props `name?`, `src?`, `size?`, `anon?`
    - When `anon=true`: render `AvatarFallback` with the `anonStyle`-based character (ghost → `?`, otherwise `—`) from `useTweaks()`; never show the real name or src
    - When `anon=false` and `src` is set: render `AvatarImage` + `AvatarFallback` with initials
    - When `anon=false` and no `src`: render `AvatarFallback` with initials derived from `name`
    - Import `useTweaks` from `@/lib/providers/tweaks-provider`
    - _Requirements: 5.4_

  - [ ]* 7.5 Write property test for `PeerlyAvatar` rendering
    - **Property 13: `PeerlyAvatar` renders correct visual state for any prop combination**
    - **Validates: Requirements 5.4**

  - [ ] 7.6 Migrate all `<Btn>` call sites to shadcn `<Button>`
    - Find every import of `Btn` from `@/components/ui/btn` across `app/` and `components/`
    - Replace with `import { Button } from '@/components/ui/button'`
    - Apply variant mapping: `primary` → `default`, `secondary` → `secondary`, `ghost` → `ghost`, `danger` → `destructive`
    - Apply size mapping: `sm` → `sm`, `md` → `default`, `lg` → `lg`
    - Preserve all `onClick`, `disabled`, `type`, and `style` props on every call site
    - _Requirements: 5.2, 9.3_

  - [ ]* 7.7 Write property test for `Button` onClick parity
    - **Property 11: `Button` fires `onClick` identically to `Btn` for any prop combination**
    - **Validates: Requirements 5.2, 9.3**

  - [ ] 7.8 Migrate all `<Avatar>` call sites to `<PeerlyAvatar>`
    - Find every import of `Avatar` from `@/components/ui/avatar` across `app/` and `components/`
    - Replace with `import { PeerlyAvatar } from '@/components/ui/peer-avatar'` and rename the element
    - Preserve all `name`, `src`, `size`, and `anon` props on every call site
    - _Requirements: 5.4, 9.3_

  - [ ] 7.9 Migrate all `<Input>` call sites to `<FormInput>`
    - Find every import of `Input` from `@/components/ui/input` across `app/` and `components/`
    - Replace with `import { FormInput } from '@/components/ui/form-input'` and rename the element
    - Preserve all `label`, `hint`, `error`, `multiline`, `showToggle`, `value`, and `onChange` props on every call site
    - _Requirements: 5.3, 9.3_

- [ ] 8. Checkpoint — shadcn migration
  - Ensure `tsc --noEmit` passes and every page that uses `Button`, `FormInput`, or `PeerlyAvatar` renders correctly. Ask the user before continuing.

- [ ] 9. TypeScript strengthening
  - [ ] 9.1 Add shared response interfaces to `lib/types.ts`
    - Add `ApiError`, `LoginResponse`, `VerifyEmailResponse`, `OnboardingCompleteResponse`, `OnboardingProfile` interfaces as defined in Design §5
    - Update `TweaksState` to remove `darkMode: boolean` and `setDarkMode` fields (align with what `tweaks-provider.tsx` already exports)
    - Add `AdminCollegeResponse`, `CommunityResponse`, `CommunityMessageResponse`, `CommentResponse`, `ReportResponse` interfaces
    - _Requirements: 6.2, 6.3, 8.3_

  - [ ] 9.2 Replace inline `ApiError` definitions with the shared import
    - Remove the local `type ApiError = Error & { response?: ... }` declarations from `app/auth/login/page.tsx`, `app/onboarding/page.tsx`, and `components/ui/report-modal.tsx`
    - Add `import type { ApiError } from '@/lib/types'` to each file
    - Update `useLogin`, `useVerifyEmail`, `useCompleteOnboarding` generics to use `LoginResponse`, `VerifyEmailResponse`, `OnboardingCompleteResponse` from the shared types
    - _Requirements: 6.2_

  - [ ] 9.3 Annotate hook return types and remove all `any` / `unknown`
    - Update `lib/hooks/useAdmin.ts` to use `AdminCollegeResponse` instead of any implicit type
    - Update `lib/hooks/useCommunities.ts` to use `CommunityResponse` and `CommunityMessageResponse`
    - Update `lib/hooks/useComments.ts` to use `CommentResponse`
    - Update `lib/hooks/useReports.ts` to use `ReportResponse`
    - Update `useCompleteOnboarding` in `lib/hooks/useAuth.ts` to use `OnboardingCompleteResponse` (replacing `profile: unknown`)
    - Fix any Radix UI / shadcn callback parameters that lack explicit type annotations (e.g., `onValueChange: (value: string) => void` from `@radix-ui/react-select`)
    - _Requirements: 6.3, 6.4, 6.5_

  - [ ] 9.4 Annotate `lib/data.ts` sample arrays and verify strict mode
    - Annotate `SAMPLE_POSTS`, `SAMPLE_COMMUNITIES`, `SAMPLE_MESSAGES`, `SAMPLE_COMMENTS` with their `lib/types.ts` types
    - Update any field in the sample data that diverges from the real API response shapes
    - Run `tsc --noEmit` and fix every remaining `implicit any` or `unsafe assignment` error in `app/`, `components/`, and `lib/hooks/`
    - Confirm `tsconfig.json` already has `"strict": true` (do not modify if present)
    - _Requirements: 6.1, 6.4, 6.6_

- [ ] 10. Checkpoint — TypeScript
  - `tsc --noEmit` must complete with zero errors. Ask the user before continuing.

- [ ] 11. Code modularisation
  - [ ] 11.1 Create `components/ui/error-message.tsx`
    - New file exporting `ErrorMessage({ message: string | null })`
    - Renders `null` when `message` is null or empty
    - Renders a div with Tailwind classes matching the red error banner style: `px-3.5 py-2.5 rounded-lg text-[13px] leading-relaxed bg-red-500/8 border border-red-600 text-red-600`
    - _Requirements: 7.5_

  - [ ]* 11.2 Write property test for `ErrorMessage`
    - **Property 14: `ErrorMessage` renders the error banner for any non-null message**
    - **Validates: Requirements 7.5**

  - [ ] 11.3 Replace inline error banners with `<ErrorMessage>` across all pages
    - Find and replace the duplicated red error banner JSX in `app/auth/login/page.tsx`, `app/auth/forgot-password/page.tsx`, `app/auth/reset-password/page.tsx`, `app/admin/page.tsx`, and any post-related pages
    - Replace each with `<ErrorMessage message={...} />`
    - Preserve all conditional expressions that gate the banner (e.g., `{loginError && ...}` becomes `<ErrorMessage message={loginError} />`)
    - _Requirements: 7.5_

  - [ ] 11.4 Create `features/auth/` sub-components
    - `features/auth/LoginForm.tsx` — the login tab form (email, password, forgot-password link, submit button, Google button section)
    - `features/auth/OtpVerifyForm.tsx` — the OTP verification step (code input, verify button, resend link, back button)
    - `features/auth/DomainChecker.tsx` — the domain status widget (move the `DomainChecker` inner component from `app/auth/login/page.tsx`)
    - `features/auth/PasswordStrength.tsx` — the password strength indicator (move `PasswordStrength` inner component)
    - Update `app/auth/login/page.tsx` to import and compose these sub-components; the page file should become a thin orchestrator under ~80 lines
    - _Requirements: 7.1, 7.2_

  - [ ] 11.5 Create `features/auth/OnboardingForm.tsx`
    - Extract the form body from `app/onboarding/page.tsx` into `features/auth/OnboardingForm.tsx`
    - Page file remains as thin orchestrator
    - _Requirements: 7.1, 7.2_

  - [ ] 11.6 Create `features/admin/` sub-components
    - `features/admin/CollegeTable.tsx` — the colleges list with `CollegeRow` and add-college form
    - `features/admin/CollegeSearch.tsx` — the reports tab with filter select, report list, and pagination
    - Move `CollegeRow` from `app/admin/page.tsx` into `features/admin/CollegeTable.tsx`
    - Update `app/admin/page.tsx` to import and compose these; page should be under ~60 lines
    - _Requirements: 7.1, 7.2_

  - [ ] 11.7 Create `features/communities/` sub-components
    - `features/communities/ChatWindow.tsx` — the scrollable message list for the community chat
    - `features/communities/MessageInput.tsx` — the message composer (input + send button)
    - Extract from `app/communities/[id]/page.tsx`; page should remain as thin orchestrator
    - _Requirements: 7.1, 7.2_

  - [ ] 11.8 Create `features/profile/` sub-components
    - `features/profile/EditProfileForm.tsx` — the name, bio fields, and save/cancel actions
    - `features/profile/AvatarUpload.tsx` — the avatar circle with hover-to-change overlay and file input
    - Extract from `app/profile/edit/page.tsx`; update all imports to `PeerlyAvatar` and `Button` in the new files
    - _Requirements: 7.1, 7.2_

- [ ] 12. Final cleanup — delete legacy files and references
  - [ ] 12.1 Delete `components/ui/btn.tsx`
    - Confirm zero remaining imports of `@/components/ui/btn` across the codebase (grep before deleting)
    - Delete the file
    - _Requirements: 5.6_

  - [ ] 12.2 Delete the old `components/ui/avatar.tsx`
    - Confirm zero remaining imports of `@/components/ui/avatar` that reference the old `Avatar` export (shadcn generates its own `avatar.tsx` — ensure only the shadcn primitives remain)
    - If shadcn's generated file is also named `avatar.tsx`, the old file is already replaced; confirm `PeerlyAvatar` is the only export consumers use
    - _Requirements: 5.6_

  - [ ] 12.3 Delete `lib/context.tsx`
    - Confirm zero remaining imports of `@/lib/context` across the codebase
    - Delete the file
    - _Requirements: 7.4_

  - [ ] 12.4 Confirm no `peerly_token` references remain
    - Search all files under `client/` for the string `peerly_token` (excluding the new `auth-utils.ts` which uses `peerly_access_token` / `peerly_refresh_token`)
    - Search for `setToken(` and `getToken(` and `clearToken(` (singular, old API) — all should be gone
    - Fix any remaining references
    - _Requirements: 1.7, 4.6_

- [ ] 13. Final checkpoint
  - Run `tsc --noEmit` — zero errors required. Verify all routes load without runtime errors. Ask the user if anything looks wrong.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- The sequencing is intentional: Tasks 1–3 (foundation) must be completed before Tasks 4–5 (auth hooks + providers), which must be completed before Tasks 7–8 (shadcn migration), which must be completed before Task 11 (modularisation)
- Tasks 4 (auth hooks) and 5 (providers/dark mode) can be worked on in parallel after Task 3
- `lib/socket.ts` and `lib/cloudinary.ts` are explicitly out of scope — do not modify them (_Requirements: 9.5, 9.6_)
- All existing TanStack Query cache keys must remain unchanged throughout the migration (_Requirements: 9.2_)
- Property tests use `vitest`; run with `vitest --run` for single-pass execution

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["2.2"] },
    { "id": 3, "tasks": ["2.3", "4.1", "5.1", "5.2", "5.3"] },
    { "id": 4, "tasks": ["4.2", "5.4", "5.5"] },
    { "id": 5, "tasks": ["4.3", "7.1"] },
    { "id": 6, "tasks": ["7.2", "7.4"] },
    { "id": 7, "tasks": ["7.3", "7.5", "7.6", "7.8", "7.9"] },
    { "id": 8, "tasks": ["7.7", "9.1"] },
    { "id": 9, "tasks": ["9.2", "9.3"] },
    { "id": 10, "tasks": ["9.4"] },
    { "id": 11, "tasks": ["11.1"] },
    { "id": 12, "tasks": ["11.2", "11.3", "11.4", "11.5", "11.6", "11.7", "11.8"] },
    { "id": 13, "tasks": ["12.1", "12.2", "12.3", "12.4"] }
  ]
}
```

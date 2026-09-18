# Examina — Hardening Changelog

## 1. Authorization hardening

### `src/lib/auth.ts`
- **Removed silent weak-default secrets.** In production the module now throws
  on import if `ADMIN_PASSWORD` (or if < 8 chars) or `ADMIN_SECRET` (or if
  < 32 chars) is missing. No more "happily boots with `examina-admin`".
  In development a clearly-marked dev fallback is still used so `next dev`
  works out of the box.
- Added `adminCookieOptions()` helper. The admin cookie is now set with
  `secure: true` in production (HTTPS only), plus `httpOnly`, `sameSite: 'lax'`,
  `path: '/'`, 7-day `maxAge`.
- All existing signing/verification primitives (`createHmac`, `timingSafeEqual`,
  constant-time compare with length pre-check) are unchanged.

### `src/lib/rate-limit.ts` (new)
- In-memory token-bucket rate limiter. Self-evicting Map; `unref()`'d interval
  for long-running Node processes. Includes `clientIp()` helper and standard
  `X-RateLimit-*` / `Retry-After` headers.
- Note for production multi-instance: replace with `@upstash/ratelimit` if
  running on Vercel Pro/Enterprise with concurrent invocations.

### `src/app/api/admin/login/route.ts`
- 5 attempts / minute / IP rate limit. 429 response with `Retry-After` header
  when exceeded.

### `src/app/api/admin/logout/route.ts`
- Cookie cleared with the same `secure`/`httpOnly`/`sameSite` options used to
  set it (otherwise some browsers reject the unset).

### `src/app/api/exams/[id]/submit/route.ts`
- 20 submissions / 5 min / IP rate limit to prevent result-table pollution.
- `studentName` now truncated to 80 chars server-side.

### `src/proxy.ts` (new — Next 16 renamed `middleware.ts` to `proxy.ts`)
- Adds baseline security headers to every response:
  - `Strict-Transport-Security` (production only)
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Content-Security-Policy` (same-origin scripts/styles, no frames)

### `.env.example`
- Updated with stronger language: "REQUIRED IN PRODUCTION. The app refuses to
  boot if missing or shorter than 8 chars."

## 2. Refactor to real Next.js App Router routes

The old single-page `useState<View>` router in `src/app/page.tsx` is gone.
Each view is now its own URL — back/forward, refresh, and deep-linking all
work.

### New route files
| Route | File | Component |
|---|---|---|
| `/` | `src/app/page.tsx` | `<Landing />` (server component) |
| `/exams` | `src/app/exams/page.tsx` | `<StudentExamList />` |
| `/exams/[id]/take` | `src/app/exams/[id]/take/page.tsx` | `<ExamTaker examId={id} />` |
| `/attempts/[id]` | `src/app/attempts/[id]/page.tsx` | `<ReportCard attemptId={id} />` (wrapped in Suspense for `useSearchParams`) |
| `/admin` | `src/app/admin/page.tsx` | `<AdminGate><AdminExamList /></AdminGate>` |
| `/admin/exams/[id]` | `src/app/admin/exams/[id]/page.tsx` | `<AdminGate><AdminExamBuilder examId={id} /></AdminGate>` |
| `/admin/results` | `src/app/admin/results/page.tsx` | `<AdminGate><AdminResults /></AdminGate>` |

### Shared chrome
- `src/components/exam/site-shell.tsx` (new) — header with Student/Admin
  portal links (highlighted via `usePathname`), conditional admin tab bar
  (Exams / Results), footer. Used by `src/app/layout.tsx` so every route
  gets consistent chrome.
- Auto-scrolls to top on route change.

### Component changes
- `landing.tsx` — now a server component using `<Link>`. No more callbacks.
- `student-list.tsx` — uses `router.push('/exams/${id}/take')`.
- `exam-taker.tsx` — uses `router.push('/attempts/${attemptId}')` on submit.
- `report-card.tsx` — uses `useSearchParams` to read `?from=admin`; back
  button routes to `/admin/results` (admin) or `/exams` (student). Retake
  button only shows in student context.
- `admin-list.tsx` — uses `router.push('/admin/exams/${id}')`.
- `admin-builder.tsx` — uses `router.push('/admin')` for back button.
- `admin-results.tsx` — uses `router.push('/attempts/${id}?from=admin')`.
- Removed all `onStart` / `onOpen` / `onSubmitted` / `onEnter` / `onBack` /
  `onOpenReport` / `onRetake` callback props.

### Admin protection
- Each admin API route still calls `guardAdmin(req)` for per-route auth.
- The `AdminGate` client component still gates the admin UI with the login
  form when the session cookie is missing/invalid.
- The new `proxy.ts` adds HTTP security headers (does not duplicate auth
  checks — those stay in route handlers).

## 3. Removed answer key upload

### Deleted
- `src/lib/answer-key.ts` (entire file)
- `src/app/api/exams/[id]/answer-key/route.ts` (entire route)
- `scripts/test-answer-key.txt`
- `scripts/restore-key.txt`

### Moved
- `normalizeOptions`, `OPTION_LETTERS`, `RawOption` → `src/lib/options.ts`
  (still used by `POST /api/exams/[id]/questions` and `PATCH /api/questions/[id]`).

### UI changes
- `admin-builder.tsx` — the entire right-column "Answer key" panel is gone
  (file upload, paste textarea, apply button, download template link,
  result/issues panel). The layout is now single-column.
- All user-facing copy that mentioned "answer keys" has been updated:
  landing page, admin exam list (header, create dialog, delete confirm),
  layout metadata.

### Types
- `AnswerKeyResult` interface removed from `src/components/exam/types.ts`.

## 4. Config tightening

### `next.config.ts`
- `typescript.ignoreBuildErrors: false` (was `true`) — type errors now fail
  the build. Fixed one pre-existing error in `src/components/exam/pdf.ts`
  (jspdf-autotable `data.row.raw` typing).
- `reactStrictMode: true` (was `false`).

### `tsconfig.json`
- `noImplicitAny: true` (was `false`).

### `eslint.config.mjs`
- Re-enabled key rules as `warn` (not `error`, so the build still passes
  while surfacing real issues):
  - `@typescript-eslint/no-explicit-any`
  - `@typescript-eslint/no-unused-vars` (with `_`-prefix ignore)
  - `react-hooks/exhaustive-deps`
  - `prefer-const`, `no-debugger`, `no-empty`, `no-irregular-whitespace`,
    `no-fallthrough`, `no-mixed-spaces-and-tabs`, `no-redeclare`,
    `no-unreachable`, `no-useless-escape`
  - `no-console` (allowing `warn` / `error`)
- Downgraded from `error` to `warn` so editor feedback is preserved without
  blocking deploys.

### `tailwind.config.ts`
- Was a v3-style config (`theme.extend`, `darkMode`, plugin) running under
  Tailwind v4 (which reads from `@theme inline` in `globals.css`).
  Replaced with a minimal v4-style stub.

### Cleanup
- `src/lib/db.ts` — fixed stale comment.
- `scripts/seed.ts` — fixed absolute-path leak in comment.
- `src/components/exam/exam-taker.tsx` — removed trailing whitespace in
  `useEffect`.

## Verification

```bash
# Type-check passes
npx tsc --noEmit

# Production build succeeds
DATABASE_URL="postgresql://..." \
ADMIN_PASSWORD="<8+ chars>" \
ADMIN_SECRET="$(openssl rand -hex 32)" \
npx next build
```

Build output shows all 7 page routes plus 11 API routes, with `proxy.ts`
registered as a Middleware-style interceptor.

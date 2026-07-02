# MOVEIT E2E Implementation Report - 2026-06-16

## Summary

Dance academy SaaS critical flows were reviewed, patched, and verified with non-mutating E2E tests. The highest-risk issues were around QR attendance authorization, client-trusted paid bookings, client-side hard deletion of enrollments, and ticket-count loss after payment/transfer success followed by booking write failure.

## Implemented Fixes

### P0 Attendance QR Authorization

- `app/api/attendance/qr-checkin/route.ts`
  - QR check-in now verifies the authenticated scanner is an admin of the academy before mutating attendance.
  - Uses the service client only for cross-user booking lookup/update after explicit academy-admin authorization.
- `app/api/attendance/qr-generate/route.ts`
  - QR generation is explicitly restricted to the booking owner.
  - Removed fallback token generation with `booking.user_id || user.id`.

### P0 Paid Booking Trust Boundary

- `app/api/bookings/route.ts`
  - `/api/bookings` no longer trusts client-submitted `paymentMethod` or `paymentStatus` to create paid bookings without a real user ticket.
  - Legacy direct payment attempts now fail with `400`; paid reservations must come through payment confirmation APIs.
  - Booking rows always keep `user_ticket_id: selectedUserTicketId`.

### P0 Enrollment Deletion Safety

- `app/academy-admin/components/views/enrollments-view.tsx`
- `app/academy-admin/components/views/enrollments/enrollment-action-menu.tsx`
  - Removed client-side booking hard delete action.
  - Enrollment status changes now use authenticated API fetch.
  - Prevents bypassing refund, ticket restore, and audit-log paths.

### P0 Ticket Count Rollback

- `app/api/tickets/payment-confirm/route.ts`
- `app/api/academy-admin/[academyId]/bank-transfer-confirm/route.ts`
  - If count-based ticket consumption succeeds but booking insert/update fails, the count is restored with `restore_ticket_count`.
  - Added `COUNT_RESTORE` activity logs for booking insert/update failure rollback.

### Build Stability

- Request/auth-dependent API routes now declare `export const dynamic = 'force-dynamic';`.
- This removed the previous build-time `DYNAMIC_SERVER_USAGE` noise for authenticated APIs.

### E2E Harness

- `playwright.config.ts`
  - Added optional environment-based browser override:
    - `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`
    - `PLAYWRIGHT_BROWSER_CHANNEL`
  - This allows local E2E to run against installed Chrome when Playwright-managed Chromium is not installed.
- `tests/critical-safety-regression.spec.ts`
  - Added source-level regression tests for the P0 money/attendance safety issues.
- `tests/auth-flow-test.spec.ts`
- `tests/admin-page-test.spec.ts`
- `tests/intro-subscribe-flow.spec.ts`
  - Reworked default tests into non-mutating E2E smoke coverage.
  - Mutating signup/academy-creation funnel is gated behind `RUN_MUTATING_E2E=1`.

## Scenario Coverage

### Guest / Non-Member

- My page opens login modal.
- Guest can switch to signup form without submitting data.
- Guest cannot generate attendance QR.
- Guest cannot create paid booking via `/api/bookings`.
- Guest admin page does not expose dashboard data.
- Intro subscription funnel reaches auth gate before onboarding.

### Member / Paid Booking / Attendance

- Owner-only QR generation is enforced by source regression.
- QR check-in requires academy-admin authorization before attendance mutation.
- Client-declared paid booking bypass is blocked.
- Ticket count rollback is enforced for post-payment booking insert/update failures.

### Academy Admin

- Enrollment hard delete is removed from the UI.
- Enrollment status updates use authenticated API calls.
- Admin-only/request-dependent API routes are forced dynamic.

## Verification Results

- `git diff --check`: pass; only Windows LF-to-CRLF warnings.
- `npx.cmd tsc --noEmit --pretty false`: pass.
- `npm.cmd run lint`: pass with existing warnings.
- `npx.cmd playwright test tests/critical-safety-regression.spec.ts --reporter=list --workers=1`: 6 passed.
- Full non-mutating E2E with local dev server and system Chrome:
  - 12 passed.
  - 1 skipped by design: mutating signup/academy-creation flow requires `RUN_MUTATING_E2E=1` and an isolated test Supabase project.
- `npm.cmd run build`: pass.
  - Previous `DYNAMIC_SERVER_USAGE` logs are gone.
  - Remaining output: existing React hook/image lint warnings and stale Browserslist notice.

## Not Run By Default

The mutating onboarding flow is intentionally not run by default because the local app uses `.env.local`, and this workspace does not prove that the Supabase project is disposable. Run it only against an isolated test project:

```powershell
$env:RUN_MUTATING_E2E='1'
$env:PLAYWRIGHT_BASE_URL='http://localhost:3000'
$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='C:\Program Files\Google\Chrome\Application\chrome.exe'
npx.cmd playwright test tests/intro-subscribe-flow.spec.ts --reporter=list --workers=1
```

## Remaining Risks

- Payment confirmation and bank-transfer confirmation still span several DB operations from application code. Count rollback now prevents the worst loss case, but a single database transaction/RPC would be stronger.
- Existing lint warnings remain across many UI files, mostly `react-hooks/exhaustive-deps` and `<img>` usage.
- Full authenticated member/admin journeys need seeded test accounts and isolated test data to run safely end to end.
- In-app Browser plugin connection failed in this Windows sandbox with `CreateProcessAsUserW failed: 5`; actual UI E2E was verified through Playwright using installed Chrome.

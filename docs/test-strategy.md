# EventHub — Booking Management Test Strategy

Generated: 2026-10-04
Input: `docs/test-scenarios.md` (60 scenarios: TC-001–TC-007, TC-100–TC-109, TC-200–TC-208, TC-300–TC-310, TC-400–TC-409, TC-500–TC-512)

---

## 1. Layer Distribution Summary

Each scenario is counted once at its primary layer. A small number of critical rules have supplemental coverage at another layer; those are noted separately and are not double-counted.

| Primary Layer | Scenario Count | Focus | Approx. Run Time |
|---|---:|---|---|
| **Unit** | 4 | Booking reference generation and price arithmetic | < 1s |
| **API / Integration** | 27 | Endpoint contracts, validation, isolation, booking state and business rules | 10–30s |
| **Component** | 19 | Isolated booking UI states, dialogs, and refund eligibility | 5–15s |
| **E2E** | 10 | Critical booking and cancellation journeys across pages | 2–5 min |
| **Total** | **60** | | |

**Pyramid shape:** Unit (4) → API (27) → Component (19) → E2E (10).
**Supplemental coverage:** TC-102 also receives API and E2E assertions; TC-106 can be asserted in a successful API booking response in addition to its unit test.

---

## 2. Layer Assignments

### Unit Tests

_Use isolated service/helper tests with repository and Prisma dependencies stubbed. Source: `backend/src/services/bookingService.js`._

| TC | Scenario | Target |
|---|---|---|
| TC-102 | Booking reference prefix matches event title | `randomRef(eventTitle)` |
| TC-106 | Total price equals price multiplied by quantity | `createBooking` total-price calculation |
| TC-405 | Booking reference collision retry and fallback | `generateUniqueRef(eventTitle)` with mocked `bookingRepository.findByRef` |
| TC-408 | Numeric event-title prefix | `randomRef('100 Days Festival')` |

**Rationale:** These cases exercise deterministic or near-deterministic rules without needing browser navigation. Stub data access for TC-405 and booking creation dependencies for TC-106; do not make external calls.

### API / Integration Tests

_Exercise the authenticated HTTP routes and service behavior, using a controlled database state. Primary sources: `backend/src/routes/bookingRoutes.js`, `backend/src/controllers/bookingController.js`, `backend/src/services/bookingService.js`, `backend/src/repositories/bookingRepository.js`, and `backend/src/validators/bookingValidator.js`._

| TC | Scenario | Endpoint / behavior under test |
|---|---|---|
| TC-007 | Lookup own booking by reference | `GET /api/bookings/ref/:ref` → `getBookingByRef` |
| TC-100, TC-400 | At booking limit, prune the oldest booking from another event | `POST /api/bookings` → FIFO branch in `createBooking` |
| TC-101, TC-401 | Same-event FIFO fallback and seat decrement | `POST /api/bookings` → `sameEventFallback` and `eventRepository.decrementSeats` |
| TC-107 | Bookings list pagination response | `GET /api/bookings?page=1&limit=10` → `getBookings` |
| TC-108 | Cancellation releases dynamic-event availability | `DELETE /api/bookings/:id`, then fetch event availability |
| TC-201 | Cross-user detail lookup is forbidden | `GET /api/bookings/:id` → ownership check in `getBookingById` |
| TC-202 | Cross-user cancellation is forbidden and preserves booking | `DELETE /api/bookings/:id` → ownership check in `cancelBooking` |
| TC-203–TC-205 | Unauthenticated list, detail, and clear-all requests are rejected | Protected booking routes → auth middleware |
| TC-206 | Cross-user reference lookup is forbidden | `GET /api/bookings/ref/:ref` → ownership check in `getBookingByRef` |
| TC-207 | List is scoped to the authenticated user | `GET /api/bookings` → `findAll` filtered by `userId` |
| TC-208 | Clear-all only deletes the authenticated user's bookings | `DELETE /api/bookings` → `deleteAllForUser(userId)` |
| TC-301 | Non-existent booking ID returns 404 | `GET /api/bookings/:id` → `getBookingById` |
| TC-302 | Insufficient seats returns 400 | `POST /api/bookings` → seat check in `createBooking` |
| TC-303 | Non-existent event returns 404 | `POST /api/bookings` → event lookup in `createBooking` |
| TC-304–TC-306 | Required fields and quantity boundaries are validated | `POST /api/bookings` → `validateCreateBooking` |
| TC-307 | Repeated cancellation returns 404 | `DELETE /api/bookings/:id` after the booking has been deleted |
| TC-309 | Clearing an empty list succeeds with deleted count zero | `DELETE /api/bookings` → `clearAllBookings` |
| TC-310 | Failed create at the booking limit preserves existing bookings | `POST /api/bookings`; verify persisted state is unchanged on error |
| TC-406 | Clearing one booking returns the correct deletion count | `DELETE /api/bookings` → `clearAllBookings` |
| TC-407 | Page 2 returns partial pagination results | `GET /api/bookings?page=2&limit=5` |
| TC-409 | Cancelling one booking preserves the user's other bookings | `DELETE /api/bookings/:id`, then `GET /api/bookings` |

**Test data guidance:** Use dedicated test accounts and deterministic fixtures. TC-400/401 and TC-100/101 need controlled booking timestamps and counts. TC-407 needs more than five records; seed fixtures directly if necessary, since the service normally caps users at nine bookings.

### Component Tests

_Mock query/mutation state and test one rendered component at a time. Main sources: `frontend/app/bookings/page.tsx`, `frontend/app/bookings/[id]/page.tsx`, `frontend/components/bookings/BookingCard.jsx`, and `frontend/components/ui/ConfirmDialog.jsx`._

| TC | Scenario | Component/state assertion |
|---|---|---|
| TC-103–TC-105 | Refund eligibility and 4-second checking state | `RefundEligibility`; test quantity 1, quantity >1, and checking/result transition with fake timers |
| TC-109 | Clear-all action is displayed when bookings exist | `BookingsContent` with a non-empty bookings response |
| TC-300 | Missing booking renders the not-found state | `BookingDetailPage` with a 404 query error |
| TC-308 | Bookings page renders its retryable server-error state | `BookingsContent` with `isError` |
| TC-404 | Refund eligibility threshold at quantity 2 | `RefundEligibility` with fake timers |
| TC-500 | Booking list renders loading skeletons | `BookingsContent` with `isLoading` |
| TC-501 | Booking list renders the empty state | `BookingsContent` with an empty successful response |
| TC-502 | Booking detail renders the loading spinner | `BookingDetailPage` with `isLoading` |
| TC-503–TC-504 | Cancel confirmation opens; dismissing it does not cancel | `BookingCard` / detail page with mocked mutation |
| TC-505 | Booking reference appears in the breadcrumb | `BookingDetailPage` with a booking fixture |
| TC-507 | Clear-all button shows its pending state | `BookingsContent` while the clear mutation is unresolved |
| TC-508 | Refund button, spinner, and result state transitions | `RefundEligibility` state machine |
| TC-509 | 403 renders Access Denied rather than Not Found | `BookingDetailPage` with an error carrying status 403 |
| TC-510 | Pagination appears and changes page from supplied pagination data | `BookingsContent` with `totalPages > 1` |
| TC-511 | Dismissing native clear-all confirmation leaves bookings unchanged | `BookingsContent` with mocked `window.confirm` and clear API |
| TC-512 | Cancel button visibility follows booking status | `BookingCard` or detail page with confirmed/non-confirmed fixtures |

Use fake timers for refund timing rather than waiting four real seconds. For TC-511, stub `window.confirm` to return false and assert the clear API was not called.

### E2E Tests

_Reserve full-stack browser tests for journeys where real routing, authentication, navigation, or user-visible outcomes add confidence. Use the configured Chromium project in `playwright.config.ts`._

| TC | Scenario | Journey / purpose |
|---|---|---|
| TC-001 | View booking list | Sign in, create or fixture a booking, verify its card |
| TC-002 | View booking details | List → details; verify booking, event, customer, and payment sections |
| TC-003 | Cancel an individual booking | Detail → confirm cancel → toast, redirect, and removal |
| TC-004 | Clear all bookings | List → accept confirmation → empty state |
| TC-005 | Navigate back from details | Detail → back-to-list link → `/bookings` |
| TC-006 | Navigate to bookings after creating a booking | Book event → “View My Bookings” → verify new booking |
| TC-200 | Cross-user booking access displays Access Denied | Authenticate as two users and verify the second user's browser view |
| TC-402 | Complete a minimum-quantity booking | Event detail → quantity 1 → submit → verify confirmation |
| TC-403 | Complete a maximum-quantity booking | Event detail → quantity 10 → submit → verify confirmation and quantity control boundary |
| TC-506 | Cancellation toast and redirect | Covered together with TC-003; retain the ID in reporting |

`tests/booking-flow.spec.js` implements TC-001, TC-002, and TC-003/506. The existing `tests/booking-management.spec.js` retains TC-004, TC-006, and TC-102. TC-005, TC-200, TC-402, and TC-403 still need implementation if they remain in scope.

---

## 3. Decision Rationale for Contested Assignments

### TC-102 — reference prefix: Unit primary, API and E2E supplemental

The prefix logic is in `randomRef` in `backend/src/services/bookingService.js`; a unit assertion is the fastest direct test. Keep API confirmation in a create-booking test and the existing E2E assertion as defense-in-depth that the user-facing confirmation displays the generated reference correctly.

### TC-103–TC-105, TC-404, TC-508 — refund behavior: Component, not E2E

`RefundEligibility` in `frontend/app/bookings/[id]/page.tsx` is client-only: eligibility is based on `quantity`, and the four-second delay is implemented with `setTimeout`. It makes no backend request. Component tests with fake timers cover its branches and timing without repeatedly signing in or sleeping in browser tests.

### TC-304–TC-306 — validation: API, not E2E

Required fields and quantity constraints are enforced by `validateCreateBooking` in `backend/src/validators/bookingValidator.js`. Send invalid request bodies to `POST /api/bookings` and assert HTTP 400 and field details. Browser tests add no useful validation confidence here.

### TC-100/TC-101 and TC-400/TC-401 — FIFO behavior: API, not E2E

These pairs exercise the same service branches: `createBooking` counts bookings, selects/deletes the oldest, and may decrement seats on same-event fallback. API tests can control state and verify database effects precisely; browser flows would be slow and fragile.

### TC-200 and TC-509 — cross-user access: API and UI coverage

TC-201/TC-206 prove the backend ownership checks return 403. TC-200 verifies the real two-user browser journey, while TC-509 isolates the frontend's 403-specific rendering at component level. This avoids duplicating login/navigation merely to test a rendering branch.

### TC-300 and TC-308 — error states: Component, with API coverage where applicable

TC-301 checks the 404 endpoint contract; TC-300 checks the page's user-facing not-found state. TC-308 is driven by React Query's error state, so a mocked component/API failure is sufficient; no need to stop the real backend in an E2E test.

### TC-310 — failed create at capacity: API integration plus implementation discrepancy

This case must assert database state after an error. In the current `createBooking` implementation, FIFO deletion happens **before** event lookup and seat validation. Thus, a non-existent event or insufficient seats can fail after the oldest booking has already been deleted. TC-310's expected behavior currently appears inconsistent with implementation and is expected to fail until the ordering is corrected or the expected business rule is revised. Preserve this as an explicit regression check; do not hide it with a mocked unit test.

### TC-511 — native confirmation: Component with browser API stub

The clear-all handler calls `window.confirm` before setting pending state or invoking the API. Stubbing the confirmation result and asserting the API was not called tests the behavior directly, without an E2E dialog interaction.

---

## 4. Existing Coverage and Anti-Patterns

The current Playwright suite in `tests/booking-management.spec.js` contains E2E coverage for TC-001, TC-002, TC-003/506, TC-004, TC-006, and TC-102. It does not currently include API or component suites, so most of the 60 documented scenarios remain planned coverage rather than implemented tests.

| Risk / anti-pattern | Affected scenarios | Recommended approach |
|---|---|---|
| Exercising validator errors through browser journeys | TC-304–TC-306 | Send direct API requests and assert status plus validation details |
| Testing the client-only four-second refund timer through full E2E | TC-103–TC-105, TC-404, TC-508 | Component tests with fake timers |
| Testing FIFO pruning with long UI setup | TC-100/101, TC-400/401 | API tests with controlled fixtures |
| Testing 401 responses by navigating logged-out pages | TC-203–TC-205 | Direct API calls without a token |
| Reusing a shared account and clearing its remote bookings | Existing E2E setup | Prefer isolated test accounts or deterministic per-test data; parallel test runs must not share mutable account state |
| Treating TC-310 as passing against current code | TC-310 | Keep it as a failing regression test until implementation/business expectation is resolved |
| Claiming real pagination under normal booking limits | TC-510 | Component-mock pagination data; for API pagination use controlled fixtures because users are normally capped at nine bookings |

---

## 5. Defense-in-Depth Coverage

| Rule | Unit | API / Integration | Component | E2E |
|---|---|---|---|---|
| Booking reference prefix and format | TC-102, TC-408 | TC-102 supplemental | — | TC-102 existing |
| Total price calculation | TC-106 | TC-106 supplemental | — | Booking confirmation journey |
| FIFO pruning and same-event fallback | — | TC-100/101, TC-400/401 | — | — |
| Refund eligibility by quantity | — | — | TC-103–TC-105, TC-404, TC-508 | — |
| Ownership and user isolation | — | TC-201–TC-208 | TC-509 | TC-200 |
| Cancellation and clear-all behavior | — | TC-108, TC-202, TC-208, TC-307, TC-309, TC-406, TC-409 | TC-503/504, TC-511/512 | TC-003/004/506 |

---

## 6. Source References

- Scenario catalogue: `docs/test-scenarios.md`
- Booking service and business rules: `backend/src/services/bookingService.js`
- Booking routes/controller/validation: `backend/src/routes/bookingRoutes.js`, `backend/src/controllers/bookingController.js`, `backend/src/validators/bookingValidator.js`
- Booking persistence and isolation: `backend/src/repositories/bookingRepository.js`
- Booking list/detail/card UI: `frontend/app/bookings/page.tsx`, `frontend/app/bookings/[id]/page.tsx`, `frontend/components/bookings/BookingCard.jsx`
- Existing browser tests and runner config: `tests/booking-management.spec.js`, `playwright.config.ts`

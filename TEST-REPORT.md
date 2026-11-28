# OG Energy: UPI payments test report

Run on 28 Nov 2026 against a production-like copy (same code, PostgreSQL 16, `PAYMENT_MODE=upi`). The live site was not touched.

**Final result: 171/171 functional tests passed, plus 3 load simulations (500 simulated customers in total) with zero failed journeys.**

## Load simulations

Each customer opens the site, loads products, checks a pincode, places an order, pays and submits the UPI reference (UTR), then tracks the order. Meanwhile an admin confirms payments live. Of every 10 customers, 1 abandons at the QR; of every 20, 1 first types a wrong UTR and 1 pastes someone else's UTR.

### burst — 100 customers — 11.7 s
Completed 90, abandoned 10, failed **0**, typo-then-fixed 5, duplicate-UTR attempts 5 (all rejected), admin confirmations 90. Server memory 80.3–87.6 MB, max DB connections 11.

| Step | Requests | Median ms | 95% ms | Max ms | Responses |
|---|---|---|---|---|---|
| ADMIN list verifying | 16 | 3 | 113.4 | 113.4 | 200×16 |
| ADMIN stats | 16 | 3.4 | 181.5 | 181.5 | 200×16 |
| GET upi.js | 100 | 366.3 | 408.2 | 408.8 | 200×100 |
| GET / | 100 | 414 | 459.1 | 459.2 | 200×100 |
| GET app.js | 100 | 460.6 | 532.8 | 533.5 | 200×100 |
| GET styles.css | 100 | 539.3 | 565.3 | 565.6 | 200×100 |
| GET /api/config | 100 | 59.1 | 119.6 | 165.5 | 200×100 |
| GET /api/products | 100 | 59.2 | 119.6 | 165 | 200×100 |
| POST /api/track | 200 | 35.5 | 118.6 | 164.9 | 200×200 |
| GET /api/pincode | 100 | 0.7 | 2.3 | 41.3 | 200×100 |
| POST /api/orders | 100 | 3.5 | 7.1 | 43 | 201×100 |
| GET upi-qr.png | 100 | 0.8 | 1.3 | 2.6 | 200×100 |
| POST upi-submit | 90 | 3.7 | 6.2 | 38.4 | 200×90 |
| ADMIN confirm-payment | 90 | 2.4 | 4.3 | 7.4 | 200×90 |
| POST /api/orders/lookup | 90 | 1.9 | 2.8 | 5 | 200×90 |
| POST upi-submit (dup UTR) | 5 | 2.8 | 3.2 | 3.2 | 409×5 |
| POST upi-submit (bad UTR) | 5 | 2.4 | 3.3 | 3.3 | 400×5 |

### steady — 100 customers — 66.2 s
Completed 90, abandoned 10, failed **0**, typo-then-fixed 5, duplicate-UTR attempts 5 (all rejected), admin confirmations 90. Server memory 69.3–89.4 MB, max DB connections 11.

| Step | Requests | Median ms | 95% ms | Max ms | Responses |
|---|---|---|---|---|---|
| ADMIN list verifying | 93 | 3.4 | 5.9 | 37.6 | 200×93 |
| ADMIN stats | 93 | 4.2 | 6.7 | 38.1 | 200×93 |
| GET upi.js | 100 | 3.5 | 8.3 | 40.7 | 200×100 |
| GET / | 100 | 4.1 | 9.3 | 42.1 | 200×100 |
| GET app.js | 100 | 4.1 | 9.3 | 42.9 | 200×100 |
| GET styles.css | 100 | 4.4 | 9.9 | 43.1 | 200×100 |
| GET /api/config | 100 | 2.1 | 3.5 | 35.1 | 200×100 |
| GET /api/products | 100 | 2.1 | 4.4 | 35.2 | 200×100 |
| POST /api/track | 200 | 2.8 | 5.4 | 49.2 | 200×200 |
| GET /api/pincode | 100 | 0.9 | 1.5 | 1.8 | 200×100 |
| POST /api/orders | 100 | 5.5 | 9.1 | 34.1 | 201×100 |
| GET upi-qr.png | 100 | 1.3 | 2.4 | 52.2 | 200×100 |
| POST upi-submit | 90 | 5.1 | 7.1 | 39.9 | 200×90 |
| ADMIN confirm-payment | 90 | 4 | 6.7 | 12.1 | 200×90 |
| POST /api/orders/lookup | 90 | 2.8 | 4.5 | 8.5 | 200×90 |
| POST upi-submit (bad UTR) | 5 | 2.7 | 3.9 | 3.9 | 400×5 |
| POST upi-submit (dup UTR) | 5 | 3.9 | 5.5 | 5.5 | 409×5 |

### spike — 300 customers — 11.8 s
Completed 270, abandoned 30, failed **0**, typo-then-fixed 15, duplicate-UTR attempts 15 (all rejected), admin confirmations 270. Server memory 86.2–90.5 MB, max DB connections 11.

| Step | Requests | Median ms | 95% ms | Max ms | Responses |
|---|---|---|---|---|---|
| ADMIN list verifying | 15 | 3.2 | 255 | 255 | 200×15 |
| ADMIN stats | 15 | 4.7 | 255.4 | 255.4 | 200×15 |
| GET upi.js | 300 | 705.9 | 716.9 | 717.8 | 200×300 |
| GET / | 300 | 789.4 | 802.1 | 802.7 | 200×300 |
| GET app.js | 300 | 879.2 | 895.5 | 896.1 | 200×300 |
| GET styles.css | 300 | 971.4 | 984.3 | 986.3 | 200×300 |
| GET /api/config | 300 | 210.5 | 297.7 | 303.9 | 200×300 |
| GET /api/products | 300 | 210.6 | 297.8 | 303.9 | 200×300 |
| POST /api/track | 600 | 187.9 | 297.4 | 303.9 | 200×600 |
| GET /api/pincode | 300 | 0.4 | 2.7 | 41.7 | 200×300 |
| POST /api/orders | 300 | 2.6 | 12.1 | 16.5 | 201×300 |
| GET upi-qr.png | 300 | 0.6 | 3.2 | 4.6 | 200×300 |
| POST upi-submit | 270 | 2.5 | 4.5 | 40.7 | 200×270 |
| ADMIN confirm-payment | 270 | 2.2 | 3.8 | 40.5 | 200×270 |
| POST upi-submit (bad UTR) | 15 | 1.2 | 1.9 | 1.9 | 400×15 |
| POST /api/orders/lookup | 270 | 1.2 | 2.3 | 4.3 | 200×270 |
| POST upi-submit (dup UTR) | 15 | 2.3 | 3.3 | 3.3 | 409×15 |

**Data checks after all runs:** 450 paid + 50 abandoned orders, zero duplicate UTRs, zero totals mismatched, stock exactly equal to 1000 minus the units sold for every product, every paid order has a payment time, a UTR and a full history, and no errors in the server log.

**Raw server capacity** (separate benchmark, 100 simultaneous connections): page files went from 822 to 5,964 requests/s after the caching fix (slowest request 1,040 ms → 73 ms); product API 8,298 requests/s. Under the 100- and 300-customer bursts, page files took 0.4–0.8 s end to end. The benchmark shows most of that was the load generator itself opening hundreds of connections on the same 4-core machine.

## API and workflow tests (132/132 passed)

**Public**
- ✅ *Positive*: GET /health returns 200 ok (DB reachable)
- ✅ *Positive*: GET /api/config reports UPI mode, 36 states, priority states and ETAs
- ✅ *Positive*: GET /api/products lists active products without leaking stock/active internals
- ✅ *Positive*: Pincode 600001 → Tamil Nadu 2–3 days
- ✅ *Positive*: Pincode 560001 → Karnataka 2–3 days
- ✅ *Positive*: Pincode 682001 → Kerala 2–3 days
- ✅ *Positive*: Pincode 110001 → standard 7 days
- ✅ *Positive*: Pincode 400001 → standard 7 days
- ✅ *Negative*: Pincode "012345" is rejected as invalid
- ✅ *Negative*: Pincode "12345" is rejected as invalid
- ✅ *Negative*: Pincode "abcdef" is rejected as invalid
- ✅ *Negative*: Pincode "6000011" is rejected as invalid
- ✅ *Positive*: Analytics /api/track accepts valid events and ignores junk silently
**Order**
- ✅ *Positive*: Valid single-item order → 201, pending_payment, UPI payment block with static QR + payee
- ✅ *Positive*: Order total is computed server-side (client price ignored)
- ✅ *Positive*: Duplicate cart lines (same product+flavour) are merged
- ✅ *Positive*: Mixed cart across all products/flavours prices correctly
- ✅ *Positive*: Phone given as '+91 98765 43210' / '098765 43210' is normalised
- ✅ *Positive*: Puducherry pincode 605001 accepted (shares TN prefix) with 7-day ETA
- ✅ *Positive*: Kerala order gets 2–3 day ETA, Delhi gets 7 days
- ✅ *Positive*: Quantity 10 (max) accepted; 1.9 floors to 1
- ✅ *Positive*: Unicode/Tamil name and address stored intact
- ✅ *Negative*: Empty cart → 400
- ✅ *Negative*: Missing items → 400
- ✅ *Negative*: Unknown product → 400
- ✅ *Negative*: Invalid flavour → 400
- ✅ *Negative*: Quantity 0 → 400
- ✅ *Negative*: Quantity -1 → 400
- ✅ *Negative*: Quantity 11 → 400
- ✅ *Negative*: Quantity "abc" → 400
- ✅ *Negative*: Quantity null → 400
- ✅ *Negative*: Merged quantity over 10 still allowed per line but 21 lines → 400
- ✅ *Negative*: Name too short → 400 with field error
- ✅ *Negative*: Phone 12345 → 400
- ✅ *Negative*: Phone 5876543210 → 400
- ✅ *Negative*: Phone 98765432101 → 400
- ✅ *Negative*: Phone abcdefghij → 400
- ✅ *Negative*: Email "x" → 400
- ✅ *Negative*: Email "a@b" → 400
- ✅ *Negative*: Email "a b@c.com" → 400
- ✅ *Negative*: Email "" → 400
- ✅ *Negative*: Address too short → 400
- ✅ *Negative*: City missing → 400
- ✅ *Negative*: Unknown state → 400
- ✅ *Negative*: Pincode 000000 → 400
- ✅ *Negative*: Tamil Nadu with Delhi pincode → 400
- ✅ *Negative*: Delhi with Chennai pincode → 400
- ✅ *Negative*: Customer object missing → 400
- ✅ *Negative*: Malformed JSON body → 400 (no crash)
- ✅ *Negative*: Body over 64 KB → 413 (no crash)
- ✅ *Negative*: Over-long fields are truncated, not rejected (name 500 chars → stored 80)
- ✅ *Negative*: Control characters stripped from fields
**Admin auth**
- ✅ *Negative*: Admin API without session → 401
- ✅ *Negative*: Admin POST without X-OG-Admin header (CSRF guard) → 403
- ✅ *Negative*: Wrong password → 401
- ✅ *Positive*: Correct password → 200 + HttpOnly SameSite=Strict cookie
- ✅ *Negative*: Tampered session cookie → 401
- ✅ *Negative*: Forged unsigned token → 401
- ✅ *Positive*: /api/admin/me reports UPI mode and payee
**UPI submit**
- ✅ *Positive*: Valid 12-digit UTR → order 'verifying', masked ref returned
- ✅ *Positive*: UTR with spaces / dashes ('4321 0987-6543') accepted
- ✅ *Positive*: UTR sent as JSON number accepted
- ✅ *Positive*: Re-submitting the same UTR on the same order is idempotent (no extra history)
- ✅ *Positive*: Correcting a typo: new UTR while verifying replaces the old one
- ✅ *Negative*: UTR "12345678901" rejected → 400 with field error
- ✅ *Negative*: UTR "1234567890123" rejected → 400 with field error
- ✅ *Negative*: UTR "12345678901a" rejected → 400 with field error
- ✅ *Negative*: UTR "ABCDEFGHIJKL" rejected → 400 with field error
- ✅ *Negative*: UTR "" rejected → 400 with field error
- ✅ *Negative*: UTR null rejected → 400 with field error
- ✅ *Negative*: UTR "１２３４５６７８９０１２" rejected → 400 with field error
- ✅ *Negative*: UTR "1234567890.12" rejected → 400 with field error
- ✅ *Negative*: Same UTR on a different order → 409 'already linked'
- ✅ *Negative*: Unknown order ID → 404
- ✅ *Negative*: Malformed order ID (path tricks) → 404
- ✅ *Negative*: Malformed JSON → 400
- ✅ *Negative*: Race: same UTR submitted to 2 orders at the same instant → exactly one succeeds
**Track**
- ✅ *Positive*: Re-open UPI payment for unpaid order with correct phone → 200 + payment block
- ✅ *Negative*: Re-open payment with wrong phone → 404 (no info leak)
- ✅ *Negative*: Re-open payment for an order already verifying → 409
- ✅ *Positive*: Lookup with ID + phone → shows verifying + masked ref
- ✅ *Positive*: Lookup with lowercase order ID works
- ✅ *Negative*: Lookup with wrong phone → 404
- ✅ *Negative*: Lookup of non-existent order → 404
**Admin UPI**
- ✅ *Positive*: Orders list filter 'verifying' contains the submitted order
- ✅ *Positive*: 'Open' filter includes verifying orders
- ✅ *Positive*: Search by full UTR finds the order
- ✅ *Negative*: PATCH status 'paid' on a verifying UPI order is blocked (must use Confirm)
- ✅ *Negative*: Admin cannot set status 'verifying' manually
- ✅ *Negative*: Invalid status value → 400
- ✅ *Positive*: 'Not received' → back to unpaid, UTR released, history keeps the rejected UTR
- ✅ *Positive*: Confirm payment → paid, paidAt set, tracked stock decremented by qty
- ✅ *Positive*: Race: admin double-clicks Confirm (2 parallel) → paid once, stock decremented once
- ✅ *Positive*: Confirm an unpaid order by entering the UTR manually (customer never submitted)
- ✅ *Negative*: Manual confirm without UTR on an unpaid order → 400
- ✅ *Negative*: Manual confirm with invalid UTR → 400
- ✅ *Negative*: Manual confirm with a UTR already used elsewhere → 409
- ✅ *Negative*: Confirm on a non-UPI (gateway) order → 400
- ✅ *Negative*: Confirm without admin session → 401
- ✅ *Negative*: Cancel a verifying order → customer can no longer submit (409)
- ✅ *Negative*: Customer submit on an already paid order → 409
- ✅ *Positive*: UTR from a cancelled order can be reused on a new order
**Admin flow**
- ✅ *Positive*: Full lifecycle paid → packed → shipped (tracking) → delivered; customer sees tracking
- ✅ *Negative*: Paid order cannot be moved back to unpaid
**Settings**
- ✅ *Negative*: Invalid UPI IDs rejected (no @, spaces, bad handle)
- ✅ *Positive*: Valid UPI ID saved → new orders get per-order QR (SVG) + upi:// link with exact amount & order note
- ✅ *Positive*: Payee name change reflects in new orders; control chars stripped
- ✅ *Negative*: Partly invalid save (valid UPI ID + empty payee) changes nothing
- ✅ *Negative*: Empty payee name → 400
- ✅ *Positive*: Clearing UPI ID falls back to static QR image
- ✅ *Positive*: Shipping fee applies to new orders, shown in config
- ✅ *Negative*: Negative / huge shipping fee → 400
**Stock**
- ✅ *Negative*: Out-of-stock product → 409 at checkout
- ✅ *Negative*: Ordering more than tracked stock → 409 'Only N left'
- ✅ *Negative*: Hidden (inactive) product cannot be ordered
**Reports**
- ✅ *Positive*: Stats: revenue counts only paid orders; verifying counted separately
- ✅ *Positive*: CSV export includes UTR and neutralises formula injection (=HYPERLINK…)
**Security**
- ✅ *Negative*: SQL injection in admin search is harmless
- ✅ *Negative*: SQL injection in status filter is parameterised
- ✅ *Negative*: Path traversal on static files blocked
- ✅ *Positive*: Security headers present (nosniff, referrer, permissions; admin DENY frame + noindex)
**Pages**
- ✅ *Positive*: Home, /track, /policies, /admin/ all serve 200 HTML with versioned assets
- ✅ *Positive*: QR image served as PNG with 1-day cache; upi.js served as JS
- ✅ *Positive*: Gzip compression + ETag 304 revalidation work
- ✅ *Negative*: Unknown asset → 404; unknown page → SPA fallback 200; POST to page → 405
- ✅ *Negative*: Unknown API route → 404 JSON
- ✅ *Positive*: Home page HTML carries UPI-mode copy (data-upi) for 4 payment notices
**Rate limit**
- ✅ *Negative*: Orders: 31st order from one IP in 10 min → 429
- ✅ *Negative*: UTR submits: 16th from one IP in 10 min → 429
- ✅ *Negative*: Order lookups: 21st from one IP in 10 min → 429
- ✅ *Negative*: Admin login: 9th wrong attempt from one IP in 15 min → 429 (brute force guard)
**Stability**
- ✅ *Positive*: Server still healthy after the full suite; no unhandled errors in log

## Browser tests (real Chromium, desktop and phones) (31/31 passed)

**Storefront**
- ✅ *Positive*: Homepage payment copy switches to UPI wording (4 places), no 'cards/netbanking'
**Checkout**
- ✅ *Positive*: Pay button reads 'Continue to pay ₹3,799 via UPI'; opens Scan & Pay with amount, QR, payee, order ID
- ✅ *Positive*: Copy buttons copy amount and order ID to clipboard and show 'Copied'
- ✅ *Negative*: Empty / short / letters-only UTR shows inline error; letters are stripped while typing
- ✅ *Negative*: Pasting another order's UTR shows 'Already used for another order'
- ✅ *Positive*: 'I'll pay later' closes panel, keeps the order; button becomes 'Complete UPI payment' and reopens SAME order
- ✅ *Positive*: Clicking backdrop or pressing Escape closes the panel without losing the order
- ✅ *Positive*: Changing the cart after 'pay later' starts a fresh order (no stale amount)
- ✅ *Positive*: Valid UTR → 'Payment submitted' screen (masked ref, Verifying), cart emptied, DB status verifying
- ✅ *Negative*: Checkout with invalid details shows field errors and creates no order
**Mobile**
- ✅ *Positive*: iPhone: 'Save QR to gallery' (download) + tip shown; no app button without UPI ID; no horizontal scroll
- ✅ *Positive*: 320px-wide phone: panel fits, submit button reachable by scrolling
**Smart QR**
- ✅ *Positive*: Desktop with UPI ID: per-order SVG QR, UPI ID row with copy, 'pre-filled' steps
- ✅ *Positive*: Phone with UPI ID: 'Pay ₹X with UPI app' deep link with exact amount + order note
- ✅ *Positive*: Per-order QR decodes to the exact upi:// link for 20 different orders, desktop and 320px phone
**Static QR**
- ✅ *Positive*: Static QR image on the site decodes to a valid UPI payment code
**Track page**
- ✅ *Positive*: Unpaid order: 'Awaiting payment' + Complete payment → inline UPI panel → submit → timeline shows verifying
- ✅ *Positive*: Paid / shipped order shows timeline with tracking number
- ✅ *Negative*: Wrong phone number shows 'No order found' error
- ✅ *Negative*: Cancelled order shows cancelled notice and no pay button
**Admin UI**
- ✅ *Negative*: Wrong password shows 'Incorrect password'
- ✅ *Positive*: Login → UPI banner + 'Verify' tile with count of payments to confirm
- ✅ *Negative*: XSS: customer name '<img onerror=alert>' renders as text in list and drawer
- ✅ *Positive*: Verify drawer: 'Not received' sends order back to Unpaid
- ✅ *Negative*: Manual confirm with an invalid UTR shows a toast and does nothing
- ✅ *Positive*: Manual confirm with a valid UTR → order moves to 'To pack'
- ✅ *Positive*: Verify tile → filtered list → drawer → 'Confirm payment received' → To pack
- ✅ *Negative*: Settings: invalid UPI ID shows error toast and is not saved
- ✅ *Positive*: Settings: valid UPI ID saved → 'Smart QR' tag; clearing it → 'QR image' tag
- ✅ *Positive*: Sign out returns to login and admin data is no longer reachable
**Quality**
- ✅ *Positive*: No JavaScript errors on any page during the whole UI run (and no XSS alert)

## Failure and recovery tests (8/8 passed)

**DB outage**
- ✅ *Negative*: Database goes down: /health → 503, APIs → 500 'Something went wrong' within ~10 s, server does NOT crash
- ✅ *Positive*: Static pages (home, QR image, track) still load while the DB is down
- ✅ *Positive*: Database comes back: site recovers automatically (no restart), orders + UTR submit work
**Restart**
- ✅ *Positive*: Server restarts (redeploy) between order and payment: customer's UTR submit still works afterwards
- ✅ *Positive*: Graceful shutdown (SIGTERM) finishes in-flight requests before exiting
**Hammer**
- ✅ *Negative*: 50 parallel UTR submissions with different UTRs on ONE order → consistent final state (one UTR stored, valid history)
- ✅ *Negative*: 20 parallel admin confirms with 20 DIFFERENT UTRs on one order → paid exactly once, stock -1 once
- ✅ *Negative*: Garbage flood: 500 malformed/oversized/odd requests → no crash, health still ok

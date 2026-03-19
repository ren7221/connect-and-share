

# Enhancement Plan: Session Notes, Join Fix, Reports, Payment Classification, UI Polish

## 1. Database Migration

Add `session_notes` column to `daily_sessions` and `method_type` column to `payment_methods`:

```sql
-- Session notes for end-of-session review
ALTER TABLE daily_sessions ADD COLUMN session_notes text;

-- Payment method classification: revenue vs expenditure
ALTER TABLE payment_methods ADD COLUMN method_type text NOT NULL DEFAULT 'revenue'
  CHECK (method_type IN ('revenue', 'expenditure'));
```

No new RLS policies needed — existing policies cover these columns.

---

## 2. Session Notes (Optional Field on Close/Exit)

**Files:** `EmployeeSessions.tsx`, `Sessions.tsx`

- Add a `Textarea` field labeled "Session Notes (optional)" in both the close-session form (admin) and exit-session flow (employee individual exit)
- On close: include `session_notes` in the `daily_sessions` update
- On individual exit: store note in a new state but don't block submission — the note gets saved when session is fully closed
- Display notes in session history table as an expandable row or tooltip icon when present

---

## 3. Fix Duplicate Join Bug

**Files:** `EmployeeSessions.tsx`

The bug: when the current user is the session creator (`employee_id === user.id`) AND is already in `session_participants`, the UI still shows "Join Session" if `myParticipation` check fails (e.g., the creator auto-joined but the check doesn't account for being the creator).

**Fix:** In `renderActiveSessionCard()`, change the join condition from `!isParticipating` to `!isParticipating && !isSessionCreator`. Also add a backend guard: before inserting into `session_participants`, check if a row already exists for this `(session_id, user_id)`. Show "Active – You Are a Participant" badge instead of Join button.

Add a unique constraint via migration:
```sql
CREATE UNIQUE INDEX idx_unique_active_participant 
  ON session_participants(session_id, user_id) WHERE exit_time IS NULL;
```

---

## 4. Payment Method Classification (Revenue/Expenditure)

**Files:** `PaymentMethods.tsx`, `EmployeeSessions.tsx`, `Sessions.tsx`, `Reports.tsx`, `Analytics.tsx`

- **PaymentMethods.tsx:** Add a `Select` dropdown in the add/edit dialog: "Revenue Source" or "Expenditure Source". Display a badge per method in the table showing its type.
- **Session pages:** When calculating totals, revenue methods add to income, expenditure methods subtract. Replace the hardcoded `Cash Outs` check with `method_type === 'expenditure'`.
- **Reports:** Separate revenue and expenditure streams in generated reports with subtotals for each.
- **Analytics:** Add revenue vs expenditure breakdown in charts.

---

## 5. Enhanced Reports & PDF Generation

**Files:** `Reports.tsx`

Upgrade the "Sessions" report type to include:
- Session start/end times, duration
- All participants with join/exit timestamps
- Per-method financial breakdown with revenue/expenditure classification
- Net balance reconciliation (total revenue - total expenditure)
- Session notes when present
- Discrepancy highlighting

**PDF branding upgrade:**
- Add MUST Business logo (`/icon-192x192.png`) as base64 in header
- Add tuckshop name prominently
- Add generation timestamp and date range
- Structured financial tables with revenue/expenditure separation
- Professional footer with page info

Fetch `session_participants` + `profiles` + `session_payments` + `payment_methods` when generating session reports.

---

## 6. UI/UX Animation Polish

**Files:** `Index.tsx`, sidebar components, dashboard pages

- Add `will-change-transform` to animated elements for GPU acceleration
- Use `transform3d` in framer-motion for hardware acceleration
- Ensure mobile drawer uses `will-change: transform` 
- Add `transition-gpu` utility class usage across components
- This is incremental CSS — no major refactoring needed

---

## Files Modified Summary

| File | Changes |
|------|---------|
| Migration SQL | `session_notes` column, `method_type` column, unique participant index |
| `EmployeeSessions.tsx` | Session notes textarea, fix join bug (creator check), expenditure-aware revenue calc |
| `Sessions.tsx` | Session notes textarea on close, expenditure-aware calc, notes in history |
| `PaymentMethods.tsx` | Add method_type selector (revenue/expenditure), display badge |
| `Reports.tsx` | Enhanced session report with participants/notes/classification, branded PDF |
| `Analytics.tsx` | Revenue vs expenditure breakdown |
| `Index.tsx` | GPU-accelerated animations |


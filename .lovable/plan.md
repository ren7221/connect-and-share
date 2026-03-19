

## Plan: Session Management Improvements

### Summary
Fix build errors, add session edit capability for shop owner, improve collaborator selection, add owner star indicator, and fix revenue total display in session history.

### Issues to Address

1. **Build error** in `EmployeeSessions.tsx`: `Participant` interface requires `full_name` but the data from Supabase doesn't have it directly. Fix by removing `full_name` from the `Participant` interface (it's accessed via `profile.full_name` already).

2. **Admin (shop creator/owner) can edit submitted session figures**: Add an "Edit" button next to sessions in the admin Sessions page. Opens a dialog pre-filled with existing payment amounts, allowing the owner to update `session_payments` and `daily_sessions` columns. Log edits to `audit_logs`.

3. **Owner can add all participants (including other admins) when starting a session**: Currently `fetchEmployees` in `Sessions.tsx` filters out admin users. Change to include admins (other tuckshop_admins) in the collaborator list, but still exclude the current user (self). Non-owner admins should NOT be able to add the shop owner/creator.

4. **Session history not showing total revenue for older sessions**: The `getRevenue`/`getSessionRevenue` functions fall back to legacy columns when no `session_payments` exist. The issue is that `session_payments` might not be fetched for all sessions (e.g., due to RLS or the 1000-row limit). Ensure all session IDs are included in the payments query by batching if needed, and always show revenue.

5. **Star indicator on session creator**: In session history participant badges, show a star icon next to the participant whose `user_id === session.employee_id` to indicate they started/own that session.

6. **Employee average calculation for multi-participant sessions**: In analytics, when calculating per-employee averages, count each session where the employee participated (via `session_participants`), not just sessions where `employee_id` matches.

### Technical Details

**File: `src/pages/employee/EmployeeSessions.tsx`**
- Remove `full_name` from the `Participant` interface (lines 35-43). The `full_name` property is never used directly; `profile.full_name` is used everywhere.
- Fix the type assertions at lines 147 and 165 by adding `full_name: profileMap[p.user_id] || "Unknown"` to the mapped objects OR simply remove `full_name` from the interface.

**File: `src/pages/dashboard/Sessions.tsx`**
- **Edit session dialog**: Add state for `editingSession`, `editForm`, `editNotes`. Add a `handleEditSession` function that updates `session_payments` (delete old, insert new) and `daily_sessions` columns + logs to `audit_logs`. Add an edit (Pencil) icon button next to delete for owner. Show a Dialog with payment method inputs pre-filled.
- **Collaborator list**: In `fetchEmployees`, remove the filter that excludes admin users. Keep filtering out `user.id` (self). Add logic: if current user is NOT the owner, also filter out the owner's user ID from the list.
- **Star on creator**: In participant badges (both mobile and desktop views in both files), check if `p.user_id === s.employee_id` and render a star icon.

**File: `src/pages/dashboard/SessionAnalytics.tsx` (if applicable)**
- Update employee average calculations to use `session_participants` data instead of just `employee_id`.

**Database**: No schema changes needed. The `session_payments` table already supports delete+insert for edits. Owner already has full access via RLS policies.

### Steps

1. Fix `Participant` interface in both files (remove `full_name` requirement or make optional)
2. Add edit session functionality to admin `Sessions.tsx` (edit dialog, update handler)
3. Update collaborator fetching to include other admins for owner, exclude owner for non-owner admins
4. Add star indicator on session creator in participant badges (both files, mobile + desktop)
5. Fix revenue display — ensure session_payments are fetched for ALL sessions regardless of date filter, and add a totals row at the bottom of the session history table
6. Update analytics employee averages to count participation-based sessions


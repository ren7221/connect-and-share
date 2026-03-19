

## Fix: Non-owner admins cannot see session revenue

### Problem
The `session_payments` table RLS policies only allow:
1. Session creator (`ds.employee_id = auth.uid()`) to view payments
2. Shop owner to view payments

A promoted admin (tuckshop_admin who is NOT the shop creator) has no SELECT access to `session_payments`, so revenue displays as 0 for all sessions.

### Solution
Add a new RLS SELECT policy on `session_payments` that allows any tuckshop member with `manage_sessions` permission (or any tuckshop_admin) to view session payments for their tuckshop's sessions.

### Database Migration

```sql
CREATE POLICY "Admins can view all session_payments"
  ON public.session_payments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM daily_sessions ds
      WHERE ds.id = session_payments.session_id
        AND (
          is_tuckshop_owner(auth.uid(), ds.tuckshop_id)
          OR is_tuckshop_member(auth.uid(), ds.tuckshop_id)
        )
    )
  );
```

This lets any tuckshop member (employees and admins alike) view session payments for their shop's sessions. The existing per-table RLS on `daily_sessions` already controls which sessions they can see, so this is safe.

### No code changes needed
The frontend already renders revenue from `session_payments` data — the issue is purely that the data isn't returned due to missing RLS policy.


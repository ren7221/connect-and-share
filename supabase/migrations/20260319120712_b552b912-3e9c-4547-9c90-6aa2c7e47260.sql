CREATE POLICY "Members can view session_payments"
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
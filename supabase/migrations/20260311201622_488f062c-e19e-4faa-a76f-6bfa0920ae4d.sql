-- Allow super admins to view all daily_sessions
CREATE POLICY "Super admins can view all daily_sessions"
ON public.daily_sessions
FOR SELECT
TO authenticated
USING (is_super_admin(auth.uid()));

-- Allow super admins to delete tuckshops
CREATE POLICY "Super admins can delete tuckshops"
ON public.tuckshops
FOR DELETE
TO authenticated
USING (is_super_admin(auth.uid()));
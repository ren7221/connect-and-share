-- Migration: Admin Enhancements and Session Restrictions
-- Requirement: Each shop can have a maximum of 2 admins.
-- Requirement: Only the shop creator is allowed to edit submitted session data.

-- 1. Helper function to count admins in a tuckshop
CREATE OR REPLACE FUNCTION public.get_tuckshop_admin_count(_tuckshop_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.user_roles ur
  JOIN public.employees e ON ur.user_id = e.user_id
  WHERE e.tuckshop_id = _tuckshop_id
    AND ur.role = 'tuckshop_admin';
$$;

-- 2. Trigger to enforce max 2 admins
CREATE OR REPLACE FUNCTION public.enforce_max_admins()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tuckshop_id UUID;
  _admin_count INTEGER;
BEGIN
  -- Get the tuckshop_id for this user
  SELECT tuckshop_id INTO _tuckshop_id
  FROM public.employees
  WHERE user_id = NEW.user_id
  LIMIT 1;

  IF _tuckshop_id IS NOT NULL THEN
    _admin_count := public.get_tuckshop_admin_count(_tuckshop_id);
    IF _admin_count >= 2 AND NEW.role = 'tuckshop_admin' THEN
      RAISE EXCEPTION 'A shop can have a maximum of 2 admins.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_enforce_max_admins ON public.user_roles;
CREATE TRIGGER trigger_enforce_max_admins
  BEFORE INSERT ON public.user_roles
  FOR EACH ROW
  WHEN (NEW.role = 'tuckshop_admin')
  EXECUTE FUNCTION public.enforce_max_admins();

-- 3. Update RLS for daily_sessions to restrict UPDATE to owner only for submitted sessions
-- First, drop existing update policy if it's too permissive
DROP POLICY IF EXISTS "Employees with manage_sessions can update sessions" ON public.daily_sessions;

-- Re-create it with restriction: only if logout_time is null (active session)
CREATE POLICY "Employees can update active sessions"
  ON public.daily_sessions FOR UPDATE
  TO authenticated
  USING (
    public.has_employee_permission(auth.uid(), tuckshop_id, 'manage_sessions')
    AND logout_time IS NULL
  );

-- Owner can always update (existing "Owner full access" policy already covers this)

-- 4. Allow admins to view all employees in their shop (Requirement #4 visibility)
-- This is needed because the previous SELECT policy was too restrictive
CREATE POLICY "Admins can view shop employees"
  ON public.employees FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'tuckshop_admin'
    )
    AND tuckshop_id = (SELECT public.get_user_tuckshop_id(auth.uid()))
  );

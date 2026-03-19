
-- Use plpgsql to avoid compile-time enum validation
CREATE OR REPLACE FUNCTION public.is_tuckshop_owner(_user_id uuid, _tuckshop_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.tuckshops
    WHERE id = _tuckshop_id AND owner_id = _user_id AND status::text != 'suspended'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_tuckshop_member(_user_id uuid, _tuckshop_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.employees e
    JOIN public.tuckshops t ON t.id = e.tuckshop_id
    WHERE e.tuckshop_id = _tuckshop_id AND e.user_id = _user_id AND t.status::text != 'suspended'
  );
END;
$$;

-- Phase 3: Create session_participants table
CREATE TABLE IF NOT EXISTS session_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES daily_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  tuckshop_id uuid NOT NULL REFERENCES tuckshops(id) ON DELETE CASCADE,
  join_time timestamptz NOT NULL DEFAULT now(),
  exit_time timestamptz
);

ALTER TABLE session_participants ENABLE ROW LEVEL SECURITY;

-- One active session per tuckshop
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_session_per_tuckshop
  ON daily_sessions(tuckshop_id) WHERE logout_time IS NULL;

-- RLS for session_participants
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owner full access to session_participants') THEN
    CREATE POLICY "Owner full access to session_participants" ON session_participants FOR ALL TO authenticated USING (is_tuckshop_owner(auth.uid(), tuckshop_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Members can view session_participants') THEN
    CREATE POLICY "Members can view session_participants" ON session_participants FOR SELECT TO authenticated USING (is_tuckshop_member(auth.uid(), tuckshop_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Members can insert own session_participants') THEN
    CREATE POLICY "Members can insert own session_participants" ON session_participants FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND is_tuckshop_member(auth.uid(), tuckshop_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Members can update own session_participants') THEN
    CREATE POLICY "Members can update own session_participants" ON session_participants FOR UPDATE TO authenticated USING (user_id = auth.uid());
  END IF;
END $$;

-- Helper function
CREATE OR REPLACE FUNCTION public.get_active_tuckshop_session(_tuckshop_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT id FROM daily_sessions
  WHERE tuckshop_id = _tuckshop_id AND logout_time IS NULL
  LIMIT 1;
$$;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_daily_sessions_tuckshop_login ON daily_sessions(tuckshop_id, login_time DESC);
CREATE INDEX IF NOT EXISTS idx_supplier_sales_tuckshop_date ON supplier_sales(tuckshop_id, sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_employees_tuckshop ON employees(tuckshop_id);
CREATE INDEX IF NOT EXISTS idx_session_payments_session ON session_payments(session_id);
CREATE INDEX IF NOT EXISTS idx_session_participants_session ON session_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_session_participants_user ON session_participants(user_id);

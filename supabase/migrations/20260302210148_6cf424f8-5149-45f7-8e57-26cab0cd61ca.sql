
-- ============================================================
-- MIGRATION 1: Core Schema, Enums, Helper Functions, Triggers
-- ============================================================

-- 1. Enum types
CREATE TYPE public.app_role AS ENUM ('super_admin', 'tuckshop_admin', 'employee');
CREATE TYPE public.tuckshop_status AS ENUM ('pending', 'approved', 'rejected');

-- 2. Profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Tuckshops table
CREATE TABLE public.tuckshops (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.tuckshop_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. User roles table
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- 5. Employees table
CREATE TABLE public.employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tuckshop_id UUID NOT NULL REFERENCES public.tuckshops(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invite_token UUID UNIQUE DEFAULT gen_random_uuid(),
  permissions JSONB NOT NULL DEFAULT '{"view_only": true, "edit_suppliers": false, "manage_sessions": false, "manage_price_list": false, "manage_payments": false}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. Supplier sales table
CREATE TABLE public.supplier_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tuckshop_id UUID NOT NULL REFERENCES public.tuckshops(id) ON DELETE CASCADE,
  supplier_name TEXT NOT NULL,
  commodity_name TEXT NOT NULL,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  quantity_supplied NUMERIC NOT NULL DEFAULT 0,
  quantity_sold NUMERIC NOT NULL DEFAULT 0,
  is_paid BOOLEAN NOT NULL DEFAULT false,
  outstanding_balance NUMERIC NOT NULL DEFAULT 0,
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 7. Daily sessions table
CREATE TABLE public.daily_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tuckshop_id UUID NOT NULL REFERENCES public.tuckshops(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  login_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  logout_time TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER,
  airtel_money NUMERIC NOT NULL DEFAULT 0,
  tnm_mpamba NUMERIC NOT NULL DEFAULT 0,
  national_bank NUMERIC NOT NULL DEFAULT 0,
  cash_at_hand NUMERIC NOT NULL DEFAULT 0,
  cash_outs NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 8. Price list table
CREATE TABLE public.price_list (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tuckshop_id UUID NOT NULL REFERENCES public.tuckshops(id) ON DELETE CASCADE,
  commodity_name TEXT NOT NULL,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 9. Audit logs table
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tuckshop_id UUID NOT NULL REFERENCES public.tuckshops(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  table_name TEXT,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================================
-- SECURITY DEFINER HELPER FUNCTIONS
-- ============================================================

-- is_super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'
  );
$$;

-- is_tuckshop_owner
CREATE OR REPLACE FUNCTION public.is_tuckshop_owner(_user_id UUID, _tuckshop_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tuckshops
    WHERE id = _tuckshop_id AND owner_id = _user_id
  );
$$;

-- is_tuckshop_member
CREATE OR REPLACE FUNCTION public.is_tuckshop_member(_user_id UUID, _tuckshop_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employees
    WHERE tuckshop_id = _tuckshop_id AND user_id = _user_id
  );
$$;

-- has_employee_permission
CREATE OR REPLACE FUNCTION public.has_employee_permission(_user_id UUID, _tuckshop_id UUID, _perm_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employees
    WHERE tuckshop_id = _tuckshop_id
      AND user_id = _user_id
      AND (permissions ->> _perm_key)::boolean = true
  );
$$;

-- get_user_tuckshop_id
CREATE OR REPLACE FUNCTION public.get_user_tuckshop_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT id FROM public.tuckshops WHERE owner_id = _user_id LIMIT 1),
    (SELECT tuckshop_id FROM public.employees WHERE user_id = _user_id LIMIT 1)
  );
$$;

-- ============================================================
-- PROFILE AUTO-CREATION TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    NEW.email
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- UPDATED_AT TRIGGER FOR PRICE_LIST
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_price_list_updated_at
  BEFORE UPDATE ON public.price_list
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tuckshops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- PROFILES
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Super admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- TUCKSHOPS
CREATE POLICY "Authenticated users can register tuckshop"
  ON public.tuckshops FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Super admins can view all tuckshops"
  ON public.tuckshops FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update tuckshop status"
  ON public.tuckshops FOR UPDATE
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Owners can view own tuckshop"
  ON public.tuckshops FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Owners can update own tuckshop"
  ON public.tuckshops FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Employees can view their tuckshop"
  ON public.tuckshops FOR SELECT
  TO authenticated
  USING (
    status = 'approved'
    AND public.is_tuckshop_member(auth.uid(), id)
  );

-- USER_ROLES
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Super admins can manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Users can insert own tuckshop_admin role"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND role = 'tuckshop_admin');

-- EMPLOYEES
CREATE POLICY "Tuckshop owner can manage employees"
  ON public.employees FOR ALL
  TO authenticated
  USING (public.is_tuckshop_owner(auth.uid(), tuckshop_id));

CREATE POLICY "Employees can view own record"
  ON public.employees FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Allow reading employee by invite_token for signup (anon or authenticated)
CREATE POLICY "Anyone can read employee by invite token"
  ON public.employees FOR SELECT
  USING (invite_token IS NOT NULL);

-- SUPPLIER_SALES
CREATE POLICY "Owner full access to supplier_sales"
  ON public.supplier_sales FOR ALL
  TO authenticated
  USING (public.is_tuckshop_owner(auth.uid(), tuckshop_id));

CREATE POLICY "Employees with edit_suppliers can read supplier_sales"
  ON public.supplier_sales FOR SELECT
  TO authenticated
  USING (public.has_employee_permission(auth.uid(), tuckshop_id, 'edit_suppliers'));

CREATE POLICY "Employees with edit_suppliers can insert supplier_sales"
  ON public.supplier_sales FOR INSERT
  TO authenticated
  WITH CHECK (public.has_employee_permission(auth.uid(), tuckshop_id, 'edit_suppliers'));

CREATE POLICY "Employees with edit_suppliers can update supplier_sales"
  ON public.supplier_sales FOR UPDATE
  TO authenticated
  USING (public.has_employee_permission(auth.uid(), tuckshop_id, 'edit_suppliers'));

-- DAILY_SESSIONS
CREATE POLICY "Owner full access to daily_sessions"
  ON public.daily_sessions FOR ALL
  TO authenticated
  USING (public.is_tuckshop_owner(auth.uid(), tuckshop_id));

CREATE POLICY "Employees can view own sessions"
  ON public.daily_sessions FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid());

CREATE POLICY "Employees can insert own sessions"
  ON public.daily_sessions FOR INSERT
  TO authenticated
  WITH CHECK (employee_id = auth.uid());

CREATE POLICY "Employees with manage_sessions can view all sessions"
  ON public.daily_sessions FOR SELECT
  TO authenticated
  USING (public.has_employee_permission(auth.uid(), tuckshop_id, 'manage_sessions'));

CREATE POLICY "Employees with manage_sessions can insert sessions"
  ON public.daily_sessions FOR INSERT
  TO authenticated
  WITH CHECK (public.has_employee_permission(auth.uid(), tuckshop_id, 'manage_sessions'));

CREATE POLICY "Employees with manage_sessions can update sessions"
  ON public.daily_sessions FOR UPDATE
  TO authenticated
  USING (public.has_employee_permission(auth.uid(), tuckshop_id, 'manage_sessions'));

-- PRICE_LIST
CREATE POLICY "Owner full access to price_list"
  ON public.price_list FOR ALL
  TO authenticated
  USING (public.is_tuckshop_owner(auth.uid(), tuckshop_id));

CREATE POLICY "Tuckshop members can view price_list"
  ON public.price_list FOR SELECT
  TO authenticated
  USING (
    public.is_tuckshop_member(auth.uid(), tuckshop_id)
  );

CREATE POLICY "Employees with manage_price_list can modify price_list"
  ON public.price_list FOR INSERT
  TO authenticated
  WITH CHECK (public.has_employee_permission(auth.uid(), tuckshop_id, 'manage_price_list'));

CREATE POLICY "Employees with manage_price_list can update price_list"
  ON public.price_list FOR UPDATE
  TO authenticated
  USING (public.has_employee_permission(auth.uid(), tuckshop_id, 'manage_price_list'));

CREATE POLICY "Employees with manage_price_list can delete price_list"
  ON public.price_list FOR DELETE
  TO authenticated
  USING (public.has_employee_permission(auth.uid(), tuckshop_id, 'manage_price_list'));

-- AUDIT_LOGS
CREATE POLICY "Owner and members can view audit_logs"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (
    public.is_tuckshop_owner(auth.uid(), tuckshop_id)
    OR public.is_tuckshop_member(auth.uid(), tuckshop_id)
  );

CREATE POLICY "Owner can insert audit_logs"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_tuckshop_owner(auth.uid(), tuckshop_id));

CREATE POLICY "Members can insert audit_logs"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_tuckshop_member(auth.uid(), tuckshop_id));

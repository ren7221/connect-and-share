-- ============================================================
-- MIGRATION: Disable RLS on all tables (per user request)
-- ============================================================
-- This removes Row Level Security from all public tables to allow
-- unrestricted reads/writes from authenticated users via the client.

ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tuckshops DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_list DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs DISABLE ROW LEVEL SECURITY;

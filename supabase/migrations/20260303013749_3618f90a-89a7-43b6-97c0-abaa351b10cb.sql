
-- Migration: extend tables + suppliers + supplier_sales refactor + storage + RLS

-- 1. Extend profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- 2. Extend tuckshops
ALTER TABLE public.tuckshops
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS brand_color text DEFAULT '#16a34a';

-- 3. Create suppliers table
CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tuckshop_id uuid NOT NULL REFERENCES public.tuckshops(id) ON DELETE CASCADE,
  supplier_name text NOT NULL,
  commodity_name text NOT NULL,
  unit_price numeric NOT NULL DEFAULT 0,
  total_quantity_supplied integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner full access to suppliers"
  ON public.suppliers FOR ALL
  USING (is_tuckshop_owner(auth.uid(), tuckshop_id));

CREATE POLICY "Employees with edit_suppliers can read suppliers"
  ON public.suppliers FOR SELECT
  USING (has_employee_permission(auth.uid(), tuckshop_id, 'edit_suppliers'));

CREATE POLICY "Members can view suppliers"
  ON public.suppliers FOR SELECT
  USING (is_tuckshop_member(auth.uid(), tuckshop_id));

CREATE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Add supplier_id to supplier_sales
ALTER TABLE public.supplier_sales
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL;

-- 5. Create avatars storage bucket
INSERT INTO storage.buckets (id, name, public)
  VALUES ('avatars', 'avatars', true)
  ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
CREATE POLICY "Anyone can view avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated users can upload avatars"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update own avatars"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete own avatars"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');

-- 6. Tuckshop owners can view employee profiles
CREATE POLICY "Tuckshop owners can view employee profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      JOIN public.tuckshops t ON t.id = e.tuckshop_id
      WHERE e.user_id = profiles.id
        AND t.owner_id = auth.uid()
    )
  );

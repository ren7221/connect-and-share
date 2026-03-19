-- Migration: Enhance Suppliers and Sessions
-- 1. Create supplier_goods table for multiple commodities per supplier
CREATE TABLE IF NOT EXISTS public.supplier_goods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tuckshop_id UUID NOT NULL REFERENCES public.tuckshops(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    commodity_name TEXT NOT NULL,
    unit_price NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Disable RLS on the new table to match current project setup
ALTER TABLE public.supplier_goods DISABLE ROW LEVEL SECURITY;

-- 2. Migrate existing supplier data to supplier_goods
INSERT INTO public.supplier_goods (tuckshop_id, supplier_id, commodity_name, unit_price, created_at, updated_at)
SELECT tuckshop_id, id, commodity_name, unit_price, created_at, updated_at
FROM public.suppliers
WHERE commodity_name IS NOT NULL AND commodity_name != '';

-- 3. Modify suppliers table (drop commodity-specific columns)
ALTER TABLE public.suppliers DROP COLUMN IF EXISTS commodity_name CASCADE;
ALTER TABLE public.suppliers DROP COLUMN IF EXISTS unit_price CASCADE;
ALTER TABLE public.suppliers DROP COLUMN IF EXISTS total_quantity_supplied CASCADE;

-- 4. Enhance supplier_sales for tracking supply time, payment lock, and signature
ALTER TABLE public.supplier_sales ADD COLUMN IF NOT EXISTS supply_time TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.supplier_sales ADD COLUMN IF NOT EXISTS payment_locked BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.supplier_sales ADD COLUMN IF NOT EXISTS signature_data TEXT;
ALTER TABLE public.supplier_sales ADD COLUMN IF NOT EXISTS payment_confirmed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.supplier_sales ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMPTZ;

-- 5. Create updated_at trigger for supplier_goods
CREATE TRIGGER update_supplier_goods_updated_at
    BEFORE UPDATE ON public.supplier_goods
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

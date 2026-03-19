
-- Allow all tuckshop members to VIEW supplier_sales (read-only by default)
CREATE POLICY "Members can view supplier_sales"
  ON public.supplier_sales FOR SELECT
  USING (is_tuckshop_member(auth.uid(), tuckshop_id));

-- Allow all tuckshop members to VIEW supplier_goods (read-only by default)
CREATE POLICY "Members can view supplier_goods"
  ON public.supplier_goods FOR SELECT
  USING (is_tuckshop_member(auth.uid(), tuckshop_id));

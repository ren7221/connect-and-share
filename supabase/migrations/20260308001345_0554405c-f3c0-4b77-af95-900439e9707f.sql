
-- Allow employees with update_supply_sales to SELECT/INSERT/UPDATE/DELETE on supplier_sales
CREATE POLICY "Employees with update_supply_sales can read supplier_sales"
ON public.supplier_sales FOR SELECT TO authenticated
USING (has_employee_permission(auth.uid(), tuckshop_id, 'update_supply_sales'));

CREATE POLICY "Employees with update_supply_sales can insert supplier_sales"
ON public.supplier_sales FOR INSERT TO authenticated
WITH CHECK (has_employee_permission(auth.uid(), tuckshop_id, 'update_supply_sales'));

CREATE POLICY "Employees with update_supply_sales can update supplier_sales"
ON public.supplier_sales FOR UPDATE TO authenticated
USING (has_employee_permission(auth.uid(), tuckshop_id, 'update_supply_sales'));

CREATE POLICY "Employees with update_supply_sales can delete supplier_sales"
ON public.supplier_sales FOR DELETE TO authenticated
USING (has_employee_permission(auth.uid(), tuckshop_id, 'update_supply_sales'));

-- Allow employees with update_supply_sales to read suppliers and supplier_goods (needed by the page)
CREATE POLICY "Employees with update_supply_sales can read suppliers"
ON public.suppliers FOR SELECT TO authenticated
USING (has_employee_permission(auth.uid(), tuckshop_id, 'update_supply_sales'));

CREATE POLICY "Employees with update_supply_sales can read supplier_goods"
ON public.supplier_goods FOR SELECT TO authenticated
USING (has_employee_permission(auth.uid(), tuckshop_id, 'update_supply_sales'));

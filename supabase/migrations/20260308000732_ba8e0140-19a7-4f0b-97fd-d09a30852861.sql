
CREATE POLICY "Employees with manage_payments can insert payment_methods"
ON public.payment_methods
FOR INSERT
TO authenticated
WITH CHECK (has_employee_permission(auth.uid(), tuckshop_id, 'manage_payments'));

CREATE POLICY "Employees with manage_payments can update payment_methods"
ON public.payment_methods
FOR UPDATE
TO authenticated
USING (has_employee_permission(auth.uid(), tuckshop_id, 'manage_payments'));

CREATE POLICY "Employees with manage_payments can delete payment_methods"
ON public.payment_methods
FOR DELETE
TO authenticated
USING (has_employee_permission(auth.uid(), tuckshop_id, 'manage_payments'));

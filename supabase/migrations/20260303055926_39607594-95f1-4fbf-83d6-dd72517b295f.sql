
-- Create payment_methods table for configurable payment channels
CREATE TABLE public.payment_methods (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tuckshop_id uuid NOT NULL REFERENCES public.tuckshops(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create session_payments table for dynamic session payment entries
CREATE TABLE public.session_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.daily_sessions(id) ON DELETE CASCADE,
  payment_method_id uuid NOT NULL REFERENCES public.payment_methods(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_payments ENABLE ROW LEVEL SECURITY;

-- payment_methods policies
CREATE POLICY "Owner full access to payment_methods"
  ON public.payment_methods FOR ALL
  USING (is_tuckshop_owner(auth.uid(), tuckshop_id));

CREATE POLICY "Members can view payment_methods"
  ON public.payment_methods FOR SELECT
  USING (is_tuckshop_member(auth.uid(), tuckshop_id));

-- session_payments policies
CREATE POLICY "Owner full access to session_payments"
  ON public.session_payments FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.daily_sessions ds
    WHERE ds.id = session_payments.session_id
      AND is_tuckshop_owner(auth.uid(), ds.tuckshop_id)
  ));

CREATE POLICY "Employees can view own session_payments"
  ON public.session_payments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.daily_sessions ds
    WHERE ds.id = session_payments.session_id
      AND ds.employee_id = auth.uid()
  ));

CREATE POLICY "Employees can insert own session_payments"
  ON public.session_payments FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.daily_sessions ds
    WHERE ds.id = session_payments.session_id
      AND ds.employee_id = auth.uid()
  ));

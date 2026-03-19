-- Seed default payment methods for all existing tuckshops that don't have any yet
INSERT INTO public.payment_methods (tuckshop_id, name)
SELECT t.id, m.name
FROM public.tuckshops t
CROSS JOIN (VALUES 
  ('Airtel Money'),
  ('TNM Mpamba'),
  ('National Bank'),
  ('Cash at Hand'),
  ('Cash Outs')
) AS m(name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.payment_methods pm WHERE pm.tuckshop_id = t.id
);
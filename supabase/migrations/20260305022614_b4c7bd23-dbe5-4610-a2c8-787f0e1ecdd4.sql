
CREATE TABLE public.approval_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tuckshop_id uuid NOT NULL REFERENCES public.tuckshops(id) ON DELETE CASCADE,
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  action text NOT NULL CHECK (action IN ('approve', 'reject')),
  expires_at timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.approval_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON public.approval_tokens FOR ALL USING (false);

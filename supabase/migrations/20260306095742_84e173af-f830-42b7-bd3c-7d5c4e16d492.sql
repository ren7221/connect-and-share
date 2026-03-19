
-- Create tuckshop_notes table for admin reviews/notes
CREATE TABLE public.tuckshop_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tuckshop_id UUID NOT NULL REFERENCES public.tuckshops(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tuckshop_notes ENABLE ROW LEVEL SECURITY;

-- Super admins can do everything
CREATE POLICY "Super admins full access to tuckshop_notes"
  ON public.tuckshop_notes
  FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- Tuckshop owners can insert notes for their own tuckshop
CREATE POLICY "Owners can insert notes for own tuckshop"
  ON public.tuckshop_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tuckshops
      WHERE id = tuckshop_notes.tuckshop_id AND owner_id = auth.uid()
    )
  );

-- Tuckshop owners can view notes for their own tuckshop
CREATE POLICY "Owners can view notes for own tuckshop"
  ON public.tuckshop_notes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tuckshops
      WHERE id = tuckshop_notes.tuckshop_id AND owner_id = auth.uid()
    )
  );

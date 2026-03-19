
-- Session notes for end-of-session review
ALTER TABLE daily_sessions ADD COLUMN IF NOT EXISTS session_notes text;

-- Payment method classification: revenue vs expenditure
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS method_type text NOT NULL DEFAULT 'revenue';

-- Validation trigger for method_type
CREATE OR REPLACE FUNCTION validate_payment_method_type()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.method_type NOT IN ('revenue', 'expenditure') THEN
    RAISE EXCEPTION 'method_type must be revenue or expenditure';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_payment_method_type ON payment_methods;
CREATE TRIGGER trg_validate_payment_method_type
  BEFORE INSERT OR UPDATE ON payment_methods
  FOR EACH ROW EXECUTE FUNCTION validate_payment_method_type();

-- Unique constraint to prevent duplicate active participants
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_participant
  ON session_participants(session_id, user_id) WHERE exit_time IS NULL;

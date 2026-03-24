-- Add FSTLP Officers election type.
-- This enables election_type='fstlp_officers' while preserving existing values.

ALTER TABLE elections
  DROP CONSTRAINT IF EXISTS elections_type_check;

ALTER TABLE elections
  ADD CONSTRAINT elections_type_check
  CHECK (type IN ('student_government', 'fstlp_officers', 'class_representative', 'club_officers', 'other'));

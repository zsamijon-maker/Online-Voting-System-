-- Allow shared contestant numbers across genders for ranking_by_gender mode.
-- Example: #1 Male and #1 Female in the same pageant.
--
-- NOTE:
-- This index enforces uniqueness by (pageant, number, gender-or-null).
-- Backend validation keeps non-ranking modes strict by pageant+number.

ALTER TABLE IF EXISTS contestants
  DROP CONSTRAINT IF EXISTS contestants_pageant_id_contestant_number_key;

DROP INDEX IF EXISTS contestants_pageant_id_contestant_number_key;

CREATE UNIQUE INDEX IF NOT EXISTS contestants_pageant_number_gender_scope_key
ON contestants (pageant_id, contestant_number, COALESCE(gender, '__NO_GENDER__'));

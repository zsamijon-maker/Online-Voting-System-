-- Add contestant gender field for gender-based ranking mode
ALTER TABLE contestants
ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('Male', 'Female'));

-- Extend pageant scoring methods to include ranking_by_gender
ALTER TABLE pageants
DROP CONSTRAINT IF EXISTS pageants_scoring_method_check;

ALTER TABLE pageants
ADD CONSTRAINT pageants_scoring_method_check
CHECK (scoring_method IN ('average', 'weighted', 'ranking', 'ranking_by_gender'));

-- Add photo_path columns while preserving existing legacy photo_url data.
ALTER TABLE IF EXISTS candidates
  ADD COLUMN IF NOT EXISTS photo_path TEXT;

ALTER TABLE IF EXISTS contestants
  ADD COLUMN IF NOT EXISTS photo_path TEXT;

-- Single public bucket for candidate and contestant images.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'candidate-images',
  'candidate-images',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

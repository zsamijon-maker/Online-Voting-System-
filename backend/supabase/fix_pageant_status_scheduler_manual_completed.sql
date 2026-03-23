-- Preserve manually completed pageant statuses in auto-sync logic.
-- This updates the existing function used by pg_cron.

CREATE OR REPLACE FUNCTION public.sync_pageant_statuses()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed_count INTEGER;
BEGIN
  WITH updated AS (
    UPDATE public.pageants p
    SET
      status = CASE
        WHEN NOW()::date < p.event_date::date THEN 'upcoming'
        WHEN NOW()::date = p.event_date::date THEN 'active'
        ELSE 'completed'
      END,
      updated_at = NOW()
    WHERE p.status IN ('upcoming', 'active')
      AND p.status IS DISTINCT FROM CASE
        WHEN NOW()::date < p.event_date::date THEN 'upcoming'
        WHEN NOW()::date = p.event_date::date THEN 'active'
        ELSE 'completed'
      END
    RETURNING 1
  )
  SELECT COUNT(*) INTO changed_count FROM updated;

  RETURN COALESCE(changed_count, 0);
END;
$$;

-- Optional manual run:
-- SELECT public.sync_pageant_statuses();

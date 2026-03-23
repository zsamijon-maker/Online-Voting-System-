-- ============================================
-- AUTO ELECTION STATUS TRANSITIONS (SUPABASE)
-- ============================================
-- This migration adds:
-- 1) A SQL function to sync election status from start/end time windows.
-- 2) A pg_cron job that runs every minute.
--
-- Run this in Supabase SQL Editor with a role that can manage pg_cron.

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.sync_election_statuses()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed_count INTEGER;
BEGIN
  WITH updated AS (
    UPDATE public.elections e
    SET
      status = CASE
        WHEN NOW() < e.start_date THEN 'upcoming'
        WHEN NOW() >= e.start_date AND NOW() <= e.end_date THEN 'active'
        ELSE 'closed'
      END,
      updated_at = NOW()
    WHERE e.status NOT IN ('draft', 'archived')
      AND e.status IS DISTINCT FROM CASE
        WHEN NOW() < e.start_date THEN 'upcoming'
        WHEN NOW() >= e.start_date AND NOW() <= e.end_date THEN 'active'
        ELSE 'closed'
      END
    RETURNING 1
  )
  SELECT COUNT(*) INTO changed_count FROM updated;

  RETURN COALESCE(changed_count, 0);
END;
$$;

-- Replace existing job with same name to keep this migration idempotent.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-election-statuses-every-minute') THEN
    PERFORM cron.unschedule('sync-election-statuses-every-minute');
  END IF;
END;
$$;

SELECT cron.schedule(
  'sync-election-statuses-every-minute',
  '* * * * *',
  $$SELECT public.sync_election_statuses();$$
);

-- Optional manual run:
-- SELECT public.sync_election_statuses();

-- ============================================
-- AUTO PAGEANT STATUS TRANSITIONS (SUPABASE)
-- ============================================

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

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-pageant-statuses-every-minute') THEN
    PERFORM cron.unschedule('sync-pageant-statuses-every-minute');
  END IF;
END;
$$;

SELECT cron.schedule(
  'sync-pageant-statuses-every-minute',
  '* * * * *',
  $$SELECT public.sync_pageant_statuses();$$
);

-- Optional manual run:
-- SELECT public.sync_pageant_statuses();

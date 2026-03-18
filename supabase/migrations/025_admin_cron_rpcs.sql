-- =============================================================================
-- 025_admin_cron_rpcs.sql — RPC functions for admin panel cron job management
-- Run in Supabase SQL Editor (manual execution)
-- =============================================================================

-- Get all cron jobs with their last run status
CREATE OR REPLACE FUNCTION public.get_cron_jobs()
RETURNS TABLE (
  jobname TEXT,
  schedule TEXT,
  active BOOLEAN,
  last_run TIMESTAMPTZ,
  last_status TEXT
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    j.jobname,
    j.schedule,
    j.active,
    d.end_time AS last_run,
    d.status AS last_status
  FROM cron.job j
  LEFT JOIN LATERAL (
    SELECT end_time, status
    FROM cron.job_run_details rd
    WHERE rd.jobid = j.jobid
    ORDER BY rd.end_time DESC
    LIMIT 1
  ) d ON true
  ORDER BY j.jobname;
$$;

-- Toggle a cron job active/inactive
CREATE OR REPLACE FUNCTION public.toggle_cron_job(job_name TEXT, is_active BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE cron.job SET active = is_active WHERE jobname = job_name;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cron job "%" not found', job_name;
  END IF;
END;
$$;

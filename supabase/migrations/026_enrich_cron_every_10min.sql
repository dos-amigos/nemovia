-- Migration 026: Increase enrich-sagre cron frequency from 4x/day to every 10 minutes
-- Why: Self-chaining was unreliable (broke on timeout/error, never restarted).
--       pg_cron every 10 min is robust: each run processes ~15 geocode + ~40 LLM,
--       automatically picks up remaining work next run. No chain to break.
-- Math: 6 runs/hour × 15 geocode = 90/hr, 6 × 40 LLM = 240/hr
--       Current backlog (3363 geo + 1840 LLM) cleared in ~2 days.
--       At regime (~100 new/day), cleared in <2 hours.

-- Remove old 4x/day jobs (ignore errors if already removed)
SELECT cron.unschedule('enrich-sagre-morning');
SELECT cron.unschedule('enrich-sagre-midday');
SELECT cron.unschedule('enrich-sagre-evening');
SELECT cron.unschedule('enrich-sagre-midnight');

-- Remove broken job (used current_setting which doesn't exist)
SELECT cron.unschedule('enrich-sagre');

-- Single job every 10 minutes — uses vault secrets (same as all other cron jobs)
SELECT cron.schedule(
  'enrich-sagre',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
            || '/functions/v1/enrich-sagre',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key')
    ),
    body := '{"trigger":"cron"}'::jsonb,
    timeout_milliseconds := 5000
  );
  $$
);

-- Verify: should show 1 row — enrich-sagre every 10 min
SELECT jobname, schedule FROM cron.job WHERE jobname LIKE 'enrich%';

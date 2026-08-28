-- Enable necessary extensions
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Schedule the event reminders to run every hour at the top of the hour
select cron.schedule(
  'send_event_reminders_hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url:='https://bjijftxksykbjknbleul.supabase.co/functions/v1/send-event-reminders',
    headers:='{"Authorization": "Bearer sb_publishable_RfXOHwPhaVxfcVhVX-UzvA_2GoeqbfZ"}'::jsonb
  );
  $$
);

-- Schedule abandoned cart reminders to run every hour at the top of the hour
select cron.schedule(
  'send_abandoned_reminders_hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url:='https://bjijftxksykbjknbleul.supabase.co/functions/v1/send-abandoned-reminders',
    headers:='{"Authorization": "Bearer sb_publishable_RfXOHwPhaVxfcVhVX-UzvA_2GoeqbfZ"}'::jsonb
  );
  $$
);

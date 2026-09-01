-- Remove the abandoned cart reminders cron job.
-- The send-abandoned-reminders edge function queries orders WHERE status = 'pending',
-- but the checkout flow never creates pending orders (they go straight to 'paid' via
-- process_checkout RPC). The cron runs hourly against empty data.
--
-- TODO: Re-enable this after implementing a pending-order flow where
-- initialize-payment pre-creates an order row with status='pending'.

SELECT cron.unschedule('send_abandoned_reminders_hourly');

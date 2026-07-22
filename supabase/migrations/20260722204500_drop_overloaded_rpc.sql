-- Drop the old overloaded version of the function that accepts the enum directly
drop function if exists public.admin_update_job_application(uuid, public.job_application_status, text);

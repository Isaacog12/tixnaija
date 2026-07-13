create table if not exists public.rate_limit_log (
  id uuid primary key default gen_random_uuid(),
  ip_address text not null,
  endpoint text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_rate_limit_log_lookup on public.rate_limit_log (ip_address, endpoint, created_at);

-- Enable RLS (though accessed by RPCs mainly)
alter table public.rate_limit_log enable row level security;

-- Only service role can access directly
create policy "Service role access only for rate_limit_log" 
on public.rate_limit_log 
for all 
using ( auth.jwt()->>'role' = 'service_role' );

-- Replace validate_promo_code with rate limiting
drop function if exists public.validate_promo_code(uuid, text);
create or replace function public.validate_promo_code(
  p_event_id uuid,
  p_code text
)
returns json
language plpgsql
security definer
as $$
declare
  v_promo_code record;
  v_ip_address text;
  v_attempt_count integer;
  v_headers json;
begin
  -- 1. Extract IP Address from Kong headers
  BEGIN
    v_headers := current_setting('request.headers', true)::json;
    v_ip_address := v_headers->>'x-forwarded-for';
  EXCEPTION WHEN OTHERS THEN
    v_ip_address := 'unknown';
  END;

  IF v_ip_address IS NULL THEN
    v_ip_address := 'unknown';
  END IF;

  -- Grab just the first IP if there is a comma separated list
  v_ip_address := split_part(v_ip_address, ',', 1);

  -- 2. Log attempt
  insert into public.rate_limit_log (ip_address, endpoint) 
  values (v_ip_address, 'validate_promo_code');

  -- 3. Check rate limit (max 5 attempts per minute per IP)
  select count(*) into v_attempt_count
  from public.rate_limit_log
  where ip_address = v_ip_address
    and endpoint = 'validate_promo_code'
    and created_at > now() - interval '1 minute';

  if v_attempt_count > 5 then
    raise exception 'Too many attempts, please wait a moment and try again';
  end if;

  -- 4. Find the promo code
  select *
  into v_promo_code
  from public.promo_codes
  where event_id = p_event_id 
    and code = upper(p_code)
    and is_active = true;
    
  if not found then
    raise exception 'Invalid promo code';
  end if;
  
  -- 5. Check timings (valid_from / valid_until)
  if v_promo_code.valid_from is not null and now() < v_promo_code.valid_from then
    raise exception 'Promo code is not yet active';
  end if;
  if v_promo_code.valid_until is not null and now() > v_promo_code.valid_until then
    raise exception 'Promo code has expired';
  end if;

  -- 6. Check usage limits
  if v_promo_code.max_uses is not null and v_promo_code.times_used >= v_promo_code.max_uses then
    raise exception 'Promo code usage limit reached';
  end if;
  
  -- 7. Return safe data
  return json_build_object(
    'id', v_promo_code.id,
    'discount_type', v_promo_code.discount_type,
    'discount_value', v_promo_code.discount_value
  );
end;
$$;

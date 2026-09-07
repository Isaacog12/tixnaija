drop function if exists public.get_guest_orders(text, text);
drop function if exists public.get_guest_orders(text);

create or replace function public.get_guest_orders(
  p_email text
) returns table (
  id uuid,
  event_id uuid,
  buyer_name text,
  buyer_email text,
  total_kobo bigint,
  status text,
  created_at timestamptz,
  event_title text,
  event_slug text,
  event_city text,
  event_cover text,
  event_start timestamptz
)
language plpgsql security definer
as $$
begin
  return query
    select
      o.id,
      o.event_id,
      o.buyer_name,
      o.buyer_email,
      o.total_kobo,
      o.status::text,
      o.created_at,
      e.title as event_title,
      e.slug as event_slug,
      e.city as event_city,
      e.cover_image_url as event_cover,
      e.start_datetime as event_start
    from public.orders o
    join public.events e on o.event_id = e.id
    where lower(o.buyer_email) = lower(p_email)
      and o.status IN ('paid', 'comp')
    order by o.created_at desc
    limit 50;
end;
$$;

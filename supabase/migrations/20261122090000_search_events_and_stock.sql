-- Typo-tolerant event search.
--
-- Additive only:
--   * pg_trgm / unaccent extensions (pg_trgm is already enabled)
--   * search_aliases lookup table (public read, admin write)
--   * one immutable haystack function + GIN trigram index
--   * search_events(q, p_limit) RPC
--
-- No existing table, column, policy or row is modified. Reversible with the
-- DROP statements at the bottom.

create extension if not exists pg_trgm;
create extension if not exists unaccent;

-- ---------------------------------------------------------------------------
-- unaccent is not immutable, so it cannot be indexed directly.
-- ---------------------------------------------------------------------------
create or replace function public.immutable_unaccent(txt text)
returns text
language sql
immutable
parallel safe
set search_path = public, extensions
as $$
  select unaccent('unaccent', coalesce(txt, ''))
$$;

-- Everything a search query is matched against, folded to lowercase ASCII.
create or replace function public.event_search_haystack(
  p_title text,
  p_venue text,
  p_city text,
  p_tags text[]
)
returns text
language sql
immutable
parallel safe
set search_path = public, extensions
as $$
  select lower(public.immutable_unaccent(
    coalesce(p_title, '') || ' ' ||
    coalesce(p_venue, '') || ' ' ||
    coalesce(p_city, '') || ' ' ||
    coalesce(array_to_string(p_tags, ' '), '')
  ))
$$;

create index if not exists events_search_trgm_idx
  on public.events
  using gin (
    (public.event_search_haystack(title, venue_name, city, tags)) gin_trgm_ops
  );

-- ---------------------------------------------------------------------------
-- Alias table: Nigerian spellings and slang -> canonical term.
-- Read-only for the public; writable by admins only.
-- ---------------------------------------------------------------------------
create table if not exists public.search_aliases (
  id bigserial primary key,
  term text not null check (length(btrim(term)) > 0),
  alias text not null check (length(btrim(alias)) > 0),
  created_at timestamptz not null default now(),
  unique (term, alias)
);

alter table public.search_aliases enable row level security;

drop policy if exists "search_aliases_public_read" on public.search_aliases;
create policy "search_aliases_public_read" on public.search_aliases
  for select to anon, authenticated
  using (true);

drop policy if exists "search_aliases_admin_write" on public.search_aliases;
create policy "search_aliases_admin_write" on public.search_aliases
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

grant select on public.search_aliases to anon, authenticated;
grant insert, update, delete on public.search_aliases to authenticated;
grant all on public.search_aliases to service_role;
grant usage, select on sequence public.search_aliases_id_seq to authenticated, service_role;

-- Seed pairs. `on conflict do nothing` keeps re-runs harmless.
insert into public.search_aliases (term, alias) values
  ('night', 'nite'),
  ('night', 'naite'),
  ('night', 'nigt'),
  ('owambe', 'owanbe'),
  ('owambe', 'aso ebi'),
  ('owambe', 'asoebi'),
  ('freshers', 'fresher'),
  ('freshers', 'freshas'),
  ('concert', 'konsert'),
  ('concert', 'konsat'),
  ('concert', 'show'),
  ('comedy', 'jokes'),
  ('comedy', 'commedy'),
  ('party', 'turn up'),
  ('party', 'turnup'),
  ('party', 'rave'),
  ('detty december', 'detty'),
  ('lagos', 'lasgidi'),
  ('abuja', 'fct'),
  ('port harcourt', 'ph'),
  ('conference', 'summit'),
  ('party', 'owambe')
on conflict (term, alias) do nothing;

-- ---------------------------------------------------------------------------
-- Search RPC: returns matching event ids with a relevance score.
-- The caller keeps applying its own filters (category, date, price, city) and
-- its own stock ordering, so this only narrows and ranks.
-- ---------------------------------------------------------------------------
create or replace function public.search_events(q text, p_limit integer default 100)
returns table (event_id uuid, score real)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with params as (
    select lower(btrim(public.immutable_unaccent(coalesce(q, '')))) as raw
  ),
  needles as (
    select p.raw as term
    from params p
    where length(p.raw) >= 2
    union
    select lower(sa.term)
    from params p
    join public.search_aliases sa on p.raw like '%' || lower(sa.alias) || '%'
    where length(p.raw) >= 2
    union
    select lower(sa.alias)
    from params p
    join public.search_aliases sa on p.raw like '%' || lower(sa.term) || '%'
    where length(p.raw) >= 2
  ),
  scored as (
    select
      e.id,
      max(
        case
          when h.hay like n.term || '%' then 1.0
          when h.hay like '%' || n.term || '%' then 0.85
          else similarity(h.hay, n.term)
        end
      )::real as score
    from public.events e
    cross join needles n
    cross join lateral (
      select public.event_search_haystack(e.title, e.venue_name, e.city, e.tags) as hay
    ) h
    where e.status = 'published'
      and (h.hay like '%' || n.term || '%' or h.hay % n.term)
    group by e.id
  )
  select s.id, s.score
  from scored s
  join public.events e on e.id = s.id
  order by s.score desc, e.start_datetime asc
  limit greatest(1, least(coalesce(p_limit, 100), 200));
$$;

grant execute on function public.search_events(text, integer) to anon, authenticated;
grant execute on function public.event_search_haystack(text, text, text, text[]) to anon, authenticated;
grant execute on function public.immutable_unaccent(text) to anon, authenticated;

-- Reversal (run by hand if needed):
--   drop function if exists public.search_events(text, integer);
--   drop index if exists public.events_search_trgm_idx;
--   drop table if exists public.search_aliases;
--   drop function if exists public.event_search_haystack(text, text, text, text[]);
--   drop function if exists public.immutable_unaccent(text);

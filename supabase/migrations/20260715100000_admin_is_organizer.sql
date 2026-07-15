-- Trigger to grant organizer role to admins automatically

create or replace function public.handle_admin_organizer_grant()
returns trigger
language plpgsql
security definer
as $$
begin
  if NEW.role = 'admin' then
    insert into public.user_roles (user_id, role)
    values (NEW.user_id, 'organizer')
    on conflict do nothing;

    update public.profiles
    set is_organizer = true
    where id = NEW.user_id;
  end if;
  return NEW;
end;
$$;

drop trigger if exists admin_organizer_trigger on public.user_roles;

create trigger admin_organizer_trigger
  after insert on public.user_roles
  for each row execute function public.handle_admin_organizer_grant();

-- Retroactively fix existing admins
insert into public.user_roles (user_id, role)
select user_id, 'organizer' from public.user_roles where role = 'admin'
on conflict do nothing;

update public.profiles
set is_organizer = true
where id in (select user_id from public.user_roles where role = 'admin');


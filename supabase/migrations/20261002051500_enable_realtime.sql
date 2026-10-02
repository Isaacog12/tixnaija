begin;
  -- Enable Supabase Realtime for core tables to sync web and mobile apps
  alter publication supabase_realtime add table events, orders, tickets, ticket_types, profiles;
commit;

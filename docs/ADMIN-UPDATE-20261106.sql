-- Applied to the active project on 2026-11-06 (Asia/Jakarta).
-- Add manual customer contact data to existing admin-only profiles.
begin;
alter table public.gn_customer_profiles
  add column customer_name text not null default '' check (length(customer_name)<=100),
  add column customer_phone text not null default '' check (length(customer_phone)<=25),
  add column customer_address text not null default '' check (length(customer_address)<=450);
create table public.gn_notification_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_key text not null check(length(notification_key) between 1 and 400),
  read_at timestamptz not null default now(),
  primary key(user_id,notification_key)
);
alter table public.gn_notification_reads enable row level security;
grant select,insert,update on public.gn_notification_reads to authenticated;
create policy gn_notification_reads_select on public.gn_notification_reads
  for select to authenticated
  using (user_id=(select auth.uid()) and (select gn_private.is_admin()));
create policy gn_notification_reads_insert on public.gn_notification_reads
  for insert to authenticated
  with check (user_id=(select auth.uid()) and (select gn_private.is_admin()));
create policy gn_notification_reads_update on public.gn_notification_reads
  for update to authenticated
  using (user_id=(select auth.uid()) and (select gn_private.is_admin()))
  with check (user_id=(select auth.uid()) and (select gn_private.is_admin()));
commit;

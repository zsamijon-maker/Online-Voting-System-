-- Notifications table for realtime student dashboard alerts

create extension if not exists "uuid-ossp";

create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null check (type in ('election', 'reminder', 'confirmation', 'result', 'announcement')),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_notifications_is_read on public.notifications(is_read);
create index if not exists idx_notifications_created_at on public.notifications(created_at desc);
create index if not exists idx_notifications_user_created_at on public.notifications(user_id, created_at desc);

alter table public.notifications enable row level security;

-- Read own notifications only.
drop policy if exists "users_can_select_own_notifications" on public.notifications;
create policy "users_can_select_own_notifications"
  on public.notifications
  for select
  using (auth.uid() = user_id);

-- Mark own notifications as read.
drop policy if exists "users_can_update_own_notifications" on public.notifications;
create policy "users_can_update_own_notifications"
  on public.notifications
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

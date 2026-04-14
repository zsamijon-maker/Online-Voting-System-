-- Extend notifications for role-scoped delivery and judge-specific filtering.

alter table public.notifications
  add column if not exists role text not null default 'student';

-- Expand supported notification types for judge workflow.
alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'election',
    'reminder',
    'confirmation',
    'result',
    'announcement',
    'assignment',
    'submission'
  ));

alter table public.notifications
  drop constraint if exists notifications_role_check;

alter table public.notifications
  add constraint notifications_role_check
  check (role in ('student', 'judge', 'admin'));

create index if not exists idx_notifications_user_role on public.notifications(user_id, role);
create index if not exists idx_notifications_created_at on public.notifications(created_at desc);

alter table public.notifications enable row level security;

-- Separate role-scoped read policies.
drop policy if exists "users_can_select_own_notifications" on public.notifications;
drop policy if exists "users_can_select_own_student_notifications" on public.notifications;
drop policy if exists "users_can_select_own_judge_notifications" on public.notifications;
drop policy if exists "users_can_select_own_admin_notifications" on public.notifications;

create policy "users_can_select_own_student_notifications"
  on public.notifications
  for select
  using (auth.uid() = user_id and role = 'student');

create policy "users_can_select_own_judge_notifications"
  on public.notifications
  for select
  using (auth.uid() = user_id and role = 'judge');

create policy "users_can_select_own_admin_notifications"
  on public.notifications
  for select
  using (auth.uid() = user_id and role = 'admin');

-- Keep update policy scoped to own rows only.
drop policy if exists "users_can_update_own_notifications" on public.notifications;
create policy "users_can_update_own_notifications"
  on public.notifications
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

import { supabase } from '@/lib/supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type DashboardNotificationType =
  | 'assignment'
  | 'election'
  | 'reminder'
  | 'submission'
  | 'confirmation'
  | 'result'
  | 'announcement';

export type NotificationRole = 'student' | 'judge' | 'admin';

export type Notification = {
  id: string;
  user_id: string;
  role?: NotificationRole;
  title: string;
  message: string;
  type: DashboardNotificationType;
  is_read: boolean;
  created_at: string;
};

export interface DashboardNotification {
  id: string;
  userId: string;
  role: NotificationRole;
  title: string;
  message: string;
  type: DashboardNotificationType;
  isRead: boolean;
  createdAt: string;
}

const PAGE_LIMIT_MIN = 10;
const PAGE_LIMIT_MAX = 20;
const DEFAULT_PAGE_LIMIT = 20;

export interface NotificationPage {
  items: DashboardNotification[];
  hasMore: boolean;
}

export interface NotificationQueryOptions {
  role?: NotificationRole;
  types?: DashboardNotificationType[];
}

function clampLimit(limit?: number): number {
  if (!limit) return DEFAULT_PAGE_LIMIT;
  return Math.min(PAGE_LIMIT_MAX, Math.max(PAGE_LIMIT_MIN, limit));
}

function clampOffset(offset?: number): number {
  if (!offset || offset < 0) return 0;
  return offset;
}

function mapNotificationRow(row: Notification): DashboardNotification {
  return {
    id: row.id,
    userId: row.user_id,
    role: row.role ?? 'student',
    title: row.title,
    message: row.message,
    type: row.type,
    isRead: row.is_read,
    createdAt: row.created_at,
  };
}

async function requireSessionUser(expectedUserId: string): Promise<void> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error('No active session found.');
  }

  if (data.user.id !== expectedUserId) {
    throw new Error('Session user mismatch.');
  }
}

export async function fetchNotifications(
  userId: string,
  limit?: number,
  offset?: number,
  options?: NotificationQueryOptions
): Promise<NotificationPage> {
  await requireSessionUser(userId);

  const pageLimit = clampLimit(limit);
  const pageOffset = clampOffset(offset);
  const rangeEnd = pageOffset + pageLimit;

  let query = supabase
    .from('notifications')
    .select('id, user_id, role, title, message, type, is_read, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(pageOffset, rangeEnd);

  if (options?.role) {
    query = query.eq('role', options.role);
  }

  if (options?.types && options.types.length > 0) {
    query = query.in('type', options.types);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message || 'Unable to fetch notifications.');
  }

  const rows = (data ?? []).map((row) => mapNotificationRow(row as Notification));
  return {
    items: rows.slice(0, pageLimit),
    hasMore: rows.length > pageLimit,
  };
}

export async function markAsRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('is_read', false);

  if (error) {
    throw new Error(error.message || 'Unable to mark notification as read.');
  }
}

export async function markAsReadBatch(notificationIds: string[]): Promise<void> {
  if (notificationIds.length === 0) return;

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .in('id', notificationIds)
    .eq('is_read', false);

  if (error) {
    throw new Error(error.message || 'Unable to mark notifications as read.');
  }
}

export async function markAllAsRead(userId: string): Promise<void> {
  await requireSessionUser(userId);

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) {
    throw new Error(error.message || 'Unable to mark all notifications as read.');
  }
}

export async function markAllAsReadByRole(userId: string, role: NotificationRole): Promise<void> {
  await requireSessionUser(userId);

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('role', role)
    .eq('is_read', false);

  if (error) {
    throw new Error(error.message || 'Unable to mark all notifications as read.');
  }
}

export function subscribeToNotifications(
  userId: string,
  callback: (notification: DashboardNotification) => void,
  onStatus?: (status: string) => void,
  options?: NotificationQueryOptions
): () => void {
  const channelName = `notifications:${userId}`;

  const channel: RealtimeChannel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const row = payload.new as Notification;
        const mapped = mapNotificationRow(row);

        if (options?.role && mapped.role !== options.role) return;
        if (options?.types && options.types.length > 0 && !options.types.includes(mapped.type)) return;

        callback(mapped);
      }
    )
    .subscribe((status) => {
      onStatus?.(String(status));
    });

  return () => {
    void supabase.removeChannel(channel);
  };
}

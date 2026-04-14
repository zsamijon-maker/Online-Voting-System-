import { memo } from 'react';
import { Bell, CheckCheck, CheckCircle, Megaphone, Vote, Clock3, Trophy, ClipboardCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { DashboardNotification, DashboardNotificationType } from '@/services/notificationService';
import { cn } from '@/lib/utils';

interface NotificationDropdownProps {
  notifications: DashboardNotification[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  onMarkAsRead: (notificationId: string) => void;
  onMarkAllAsRead: () => void;
  onLoadMore: () => void;
}

const typeIconMap: Record<DashboardNotificationType, typeof Vote> = {
  assignment: ClipboardCheck,
  election: Vote,
  reminder: Clock3,
  submission: CheckCircle,
  confirmation: CheckCircle,
  result: Trophy,
  announcement: Megaphone,
};

function getNotificationGroupLabel(createdAt: string): string {
  const createdDate = new Date(createdAt);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  if (createdDate >= startOfToday) return 'Today';
  if (createdDate >= startOfYesterday) return 'Yesterday';
  return 'Earlier';
}

function NotificationSkeleton() {
  return (
    <ul className="space-y-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <li key={index} className="rounded-xl border border-gray-100 p-3">
          <div className="h-3 w-1/2 rounded bg-gray-100 animate-pulse" />
          <div className="mt-2 h-3 w-full rounded bg-gray-100 animate-pulse" />
          <div className="mt-1 h-3 w-2/3 rounded bg-gray-100 animate-pulse" />
        </li>
      ))}
    </ul>
  );
}

const NotificationItem = memo(function NotificationItem({
  notification,
  onMarkAsRead,
}: {
  notification: DashboardNotification;
  onMarkAsRead: (notificationId: string) => void;
}) {
  const Icon = typeIconMap[notification.type] ?? Bell;

  return (
    <li>
      <button
        type="button"
        onClick={() => {
          if (!notification.isRead) onMarkAsRead(notification.id);
        }}
        className={cn(
          'w-full rounded-xl border px-3 py-3 text-left transition-colors',
          notification.isRead
            ? 'border-gray-100 bg-white text-gray-500 hover:bg-gray-50'
            : 'border-blue-100 bg-[#F6F9FF] text-gray-900 hover:bg-[#EEF5FF]'
        )}
      >
        <div className="flex items-start gap-2.5">
          <div
            className={cn(
              'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
              notification.isRead ? 'bg-gray-100 text-gray-500' : 'bg-[#EFF3FF] text-[#1E3A8A]'
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className={cn('text-sm', notification.isRead ? 'font-medium' : 'font-bold')}>
                {notification.title}
              </p>
              {!notification.isRead && (
                <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-600">
                  New
                </span>
              )}
            </div>
            <p className="mt-1 text-xs leading-relaxed">{notification.message}</p>
            <p className="mt-2 text-[11px] text-gray-400">
              {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
            </p>
          </div>
        </div>
      </button>
    </li>
  );
});

export function NotificationDropdown({
  notifications,
  loading,
  loadingMore,
  hasMore,
  onMarkAsRead,
  onMarkAllAsRead,
  onLoadMore,
}: NotificationDropdownProps) {
  const grouped = notifications.reduce<Record<string, DashboardNotification[]>>((acc, current) => {
    const label = getNotificationGroupLabel(current.createdAt);
    acc[label] = acc[label] ? [...acc[label], current] : [current];
    return acc;
  }, {});

  const unreadCount = notifications.reduce((count, notification) => {
    return count + (notification.isRead ? 0 : 1);
  }, 0);

  return (
    <div
      role="menu"
      aria-label="Notifications"
      className="
        absolute right-0 top-12 z-50 w-[22rem] max-w-[calc(100vw-2rem)]
        rounded-xl border border-gray-100 bg-white shadow-xl
        animate-in fade-in slide-in-from-top-1 duration-200
      "
    >
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div>
          <p className="text-sm font-bold text-gray-900">Notifications</p>
          <p className="text-xs text-gray-500">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        <button
          type="button"
          onClick={onMarkAllAsRead}
          disabled={unreadCount === 0 || loading}
          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#1E3A8A] hover:bg-[#EFF3FF] disabled:text-gray-300 disabled:hover:bg-transparent"
        >
          <CheckCheck className="h-3.5 w-3.5" />
          Mark all read
        </button>
      </div>

      <div className="max-h-[24rem] overflow-y-auto p-3">
        {loading ? (
          <NotificationSkeleton />
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-sm text-gray-400">
            <Bell className="h-6 w-6 text-gray-300" />
            <p>No notifications</p>
          </div>
        ) : (
          Object.entries(grouped).map(([groupLabel, items]) => (
            <div key={groupLabel} className="mb-3 last:mb-0">
              <p className="px-1 pb-2 text-[11px] font-bold uppercase tracking-wide text-gray-400">
                {groupLabel}
              </p>
              <ul className="space-y-2">
                {items.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkAsRead={onMarkAsRead}
                  />
                ))}
              </ul>
            </div>
          ))
        )}

        {!loading && notifications.length > 0 && hasMore && (
          <div className="pt-2">
            <button
              type="button"
              onClick={onLoadMore}
              disabled={loadingMore}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-300"
            >
              {loadingMore ? 'Loading...' : 'Load more'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

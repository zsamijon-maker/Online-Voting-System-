import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown';
import { useNotifications } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';
import type { DashboardNotificationType, NotificationRole } from '@/services/notificationService';

interface NotificationBellProps {
  userId: string;
  pageLimit?: number;
  soundEnabled?: boolean;
  enabled?: boolean;
  role?: NotificationRole;
  types?: DashboardNotificationType[];
}

export function NotificationBell({
  userId,
  pageLimit = 20,
  soundEnabled = false,
  enabled = true,
  role,
  types,
}: NotificationBellProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const previousUnreadRef = useRef(0);

  const {
    notifications,
    unreadCount,
    isLoading,
    isLoadingMore,
    hasMore,
    markOneAsRead,
    markAllRead,
    loadMore,
    refresh,
  } = useNotifications({
    userId,
    enabled,
    pageSize: pageLimit,
    debounceMs: 400,
    fallbackPollingMs: 60000,
    role,
    types,
  });

  const playSound = useCallback(() => {
    if (!soundEnabled) return;

    try {
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.value = 880;
      gain.gain.value = 0.04;

      oscillator.connect(gain);
      gain.connect(context.destination);

      oscillator.start();
      oscillator.stop(context.currentTime + 0.12);
      oscillator.onended = () => {
        void context.close();
      };
    } catch {
      // Ignore sound errors to avoid impacting notification UX.
    }
  }, [soundEnabled]);

  useEffect(() => {
    if (unreadCount > previousUnreadRef.current) {
      playSound();
    }
    previousUnreadRef.current = unreadCount;
  }, [unreadCount, playSound]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handleOpen = useCallback(() => {
    setIsOpen((prev) => !prev);
    if (!isOpen) {
      void refresh();
    }
  }, [isOpen, refresh]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Open notifications"
        aria-expanded={isOpen}
        onClick={handleOpen}
        className={cn(
          'relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white transition-colors',
          'hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70'
        )}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span
            className="absolute -right-1 -top-1 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white"
            aria-label={`${unreadCount} unread notifications`}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <NotificationDropdown
          notifications={notifications}
          loading={isLoading}
          loadingMore={isLoadingMore}
          hasMore={hasMore}
          onMarkAsRead={markOneAsRead}
          onMarkAllAsRead={() => { void markAllRead(); }}
          onLoadMore={() => { void loadMore(); }}
        />
      )}
    </div>
  );
}

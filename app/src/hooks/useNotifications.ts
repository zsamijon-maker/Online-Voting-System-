import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchNotifications,
  markAllAsRead,
  markAllAsReadByRole,
  markAsReadBatch,
  subscribeToNotifications,
  type DashboardNotification,
  type DashboardNotificationType,
  type NotificationRole,
} from '@/services/notificationService';

interface UseNotificationsOptions {
  userId?: string;
  enabled?: boolean;
  pageSize?: number;
  debounceMs?: number;
  fallbackPollingMs?: number;
  role?: NotificationRole;
  types?: DashboardNotificationType[];
}

interface UseNotificationsResult {
  notifications: DashboardNotification[];
  unreadCount: number;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  markOneAsRead: (notificationId: string) => void;
  markAllRead: () => Promise<void>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useNotifications({
  userId,
  enabled = true,
  pageSize = 20,
  debounceMs = 400,
  fallbackPollingMs = 60000,
  role,
  types,
}: UseNotificationsOptions): UseNotificationsResult {
  const [notifications, setNotifications] = useState<DashboardNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const pollTimerRef = useRef<number | null>(null);
  const fallbackInitTimerRef = useRef<number | null>(null);
  const readQueueRef = useRef<Set<string>>(new Set());
  const readTimerRef = useRef<number | null>(null);

  const clearPolling = useCallback(() => {
    if (pollTimerRef.current !== null) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    if (fallbackInitTimerRef.current !== null) {
      window.clearTimeout(fallbackInitTimerRef.current);
      fallbackInitTimerRef.current = null;
    }
  }, []);

  const startPolling = useCallback((fetcher: () => Promise<void>) => {
    if (pollTimerRef.current !== null) return;
    pollTimerRef.current = window.setInterval(() => {
      void fetcher();
    }, fallbackPollingMs);
  }, [fallbackPollingMs]);

  const refresh = useCallback(async () => {
    if (!enabled || !userId) return;

    setIsLoading(true);
    try {
      const filteredPage = await fetchNotifications(userId, pageSize, 0, { role, types });
      setNotifications(filteredPage.items);
      setHasMore(filteredPage.hasMore);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, userId, pageSize, role, types]);

  const loadMore = useCallback(async () => {
    if (!enabled || !userId || isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    try {
      const page = await fetchNotifications(userId, pageSize, notifications.length, { role, types });
      setNotifications((prev) => {
        const existing = new Set(prev.map((item) => item.id));
        const deduped = page.items.filter((item) => !existing.has(item.id));
        return [...prev, ...deduped];
      });
      setHasMore(page.hasMore);
    } finally {
      setIsLoadingMore(false);
    }
  }, [enabled, userId, isLoadingMore, hasMore, pageSize, notifications.length, role, types]);

  const flushReadQueue = useCallback(async () => {
    const ids = Array.from(readQueueRef.current);
    if (ids.length === 0) return;

    readQueueRef.current.clear();
    readTimerRef.current = null;

    try {
      await markAsReadBatch(ids);
    } catch {
      // Ignore hard failure; notifications remain read in UI until next refresh.
    }
  }, []);

  const queueRead = useCallback((notificationId: string) => {
    readQueueRef.current.add(notificationId);

    if (readTimerRef.current !== null) {
      window.clearTimeout(readTimerRef.current);
    }

    readTimerRef.current = window.setTimeout(() => {
      void flushReadQueue();
    }, debounceMs);
  }, [flushReadQueue, debounceMs]);

  const markOneAsRead = useCallback((notificationId: string) => {
    setNotifications((prev) => prev.map((item) => {
      if (item.id !== notificationId || item.isRead) return item;
      return { ...item, isRead: true };
    }));

    queueRead(notificationId);
  }, [queueRead]);

  const markAllRead = useCallback(async () => {
    if (!userId) return;

    const hadUnread = notifications.some((item) => !item.isRead);
    if (!hadUnread) return;

    const snapshot = notifications;
    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));

    if (readTimerRef.current !== null) {
      window.clearTimeout(readTimerRef.current);
      readTimerRef.current = null;
    }
    readQueueRef.current.clear();

    try {
      if (role) {
        await markAllAsReadByRole(userId, role);
      } else {
        await markAllAsRead(userId);
      }
    } catch {
      setNotifications(snapshot);
    }
  }, [userId, notifications, role]);

  useEffect(() => {
    if (!enabled || !userId) {
      setNotifications([]);
      setHasMore(false);
      setIsLoading(false);
      clearPolling();
      return;
    }

    let mounted = true;

    const fetchFirstPage = async () => {
      setIsLoading(true);
      try {
        const page = await fetchNotifications(userId, pageSize, 0, { role, types });
        if (!mounted) return;
        setNotifications(page.items);
        setHasMore(page.hasMore);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    void fetchFirstPage();

    const fallbackFetch = async () => {
      if (!mounted) return;
      const page = await fetchNotifications(userId, pageSize, 0, { role, types });
      if (!mounted) return;
      setNotifications(page.items);
      setHasMore(page.hasMore);
    };

    const unsubscribe = subscribeToNotifications(
      userId,
      (incoming) => {
        setNotifications((prev) => {
          if (prev.some((item) => item.id === incoming.id)) return prev;
          const next = [incoming, ...prev];
          return next.slice(0, Math.max(prev.length, pageSize));
        });
      },
      (status) => {
        if (status === 'SUBSCRIBED') {
          clearPolling();
          return;
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          startPolling(fallbackFetch);
        }
      },
      { role, types }
    );

    fallbackInitTimerRef.current = window.setTimeout(() => {
      startPolling(fallbackFetch);
    }, 12000);

    return () => {
      mounted = false;
      unsubscribe();
      clearPolling();
      if (readTimerRef.current !== null) {
        window.clearTimeout(readTimerRef.current);
        readTimerRef.current = null;
      }
      void flushReadQueue();
    };
  }, [enabled, userId, pageSize, clearPolling, flushReadQueue, startPolling, role, types]);

  const unreadCount = useMemo(() => {
    return notifications.reduce((count, current) => count + (current.isRead ? 0 : 1), 0);
  }, [notifications]);

  return {
    notifications,
    unreadCount,
    isLoading,
    isLoadingMore,
    hasMore,
    markOneAsRead,
    markAllRead,
    loadMore,
    refresh,
  };
}

import { useNotifications } from '@/hooks/useNotifications';

const JUDGE_NOTIFICATION_TYPES = ['assignment', 'reminder', 'submission', 'result'] as const;

interface UseJudgeNotificationsOptions {
  userId?: string;
  enabled?: boolean;
  pageSize?: number;
}

export function useJudgeNotifications({
  userId,
  enabled = true,
  pageSize = 20,
}: UseJudgeNotificationsOptions) {
  return useNotifications({
    userId,
    enabled,
    pageSize,
    role: 'judge',
    types: [...JUDGE_NOTIFICATION_TYPES],
    debounceMs: 400,
    fallbackPollingMs: 60000,
  });
}

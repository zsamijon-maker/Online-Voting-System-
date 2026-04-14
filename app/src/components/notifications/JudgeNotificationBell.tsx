import { NotificationBell } from '@/components/notifications/NotificationBell';

interface JudgeNotificationBellProps {
  userId: string;
  enabled?: boolean;
  soundEnabled?: boolean;
}

const JUDGE_NOTIFICATION_TYPES = ['assignment', 'reminder', 'submission', 'result'] as const;

export function JudgeNotificationBell({
  userId,
  enabled = true,
  soundEnabled = false,
}: JudgeNotificationBellProps) {
  return (
    <NotificationBell
      userId={userId}
      enabled={enabled}
      soundEnabled={soundEnabled}
      pageLimit={20}
      role="judge"
      types={[...JUDGE_NOTIFICATION_TYPES]}
    />
  );
}

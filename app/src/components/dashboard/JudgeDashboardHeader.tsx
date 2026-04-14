import { Star } from 'lucide-react';
import { JudgeNotificationBell } from '@/components/notifications/JudgeNotificationBell';
import type { User } from '@/types';

interface JudgeDashboardHeaderProps {
  activeTabLabel: string;
  user: User;
}

export function JudgeDashboardHeader({ activeTabLabel, user }: JudgeDashboardHeaderProps) {
  return (
    <header className="bg-gradient-to-r from-[#0c1f4a] to-[#1E3A8A] px-5 py-5 sm:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-white tracking-tight sm:text-2xl">
            {activeTabLabel}
          </h1>
          <p className="text-sm text-blue-200/80 mt-0.5">
            Welcome, Judge {user.firstName} {user.lastName}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <JudgeNotificationBell userId={user.id} enabled={true} />
          <span className="inline-flex items-center gap-1.5 bg-white/15 border border-white/20 rounded-full px-3 py-1 text-xs font-semibold text-white w-fit">
            <Star className="w-3 h-3" /> Judge
          </span>
        </div>
      </div>
    </header>
  );
}

import { useState } from 'react';
import { User as UserIcon, Volume2, VolumeX } from 'lucide-react';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import type { User } from '@/types';

interface DashboardHeaderProps {
  activeTabLabel: string;
  user: User;
}

const SOUND_PREF_KEY = 'ssvs_notifications_sound';

export function DashboardHeader({ activeTabLabel, user }: DashboardHeaderProps) {
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    const stored = localStorage.getItem(SOUND_PREF_KEY);
    return stored !== 'off';
  });

  return (
    <header className="bg-gradient-to-r from-[#0c1f4a] to-[#1E3A8A] px-5 py-5 sm:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-white tracking-tight sm:text-2xl">
            {activeTabLabel}
          </h1>
          <p className="text-sm text-blue-200/80 mt-0.5">
            Welcome, {user.firstName} {user.lastName}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              localStorage.setItem(SOUND_PREF_KEY, next ? 'on' : 'off');
            }}
            aria-label={soundEnabled ? 'Disable notification sound' : 'Enable notification sound'}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            {soundEnabled ? <Volume2 className="h-4.5 w-4.5" /> : <VolumeX className="h-4.5 w-4.5" />}
          </button>

          <NotificationBell userId={user.id} soundEnabled={soundEnabled} />

          <span className="inline-flex items-center gap-1.5 bg-white/15 border border-white/20 rounded-full px-3 py-1 text-xs font-semibold text-white w-fit">
            <UserIcon className="w-3 h-3" /> Student Voter
          </span>
        </div>
      </div>
    </header>
  );
}

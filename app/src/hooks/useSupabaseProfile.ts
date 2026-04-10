import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export interface SupabaseProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
}

const DEFAULT_AVATAR_SVG = encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" fill="#1E3A8A"/><circle cx="80" cy="60" r="28" fill="#ffffff" fill-opacity="0.9"/><rect x="38" y="100" width="84" height="42" rx="21" fill="#ffffff" fill-opacity="0.9"/></svg>'
);

export const DEFAULT_PROFILE_AVATAR = `data:image/svg+xml;charset=UTF-8,${DEFAULT_AVATAR_SVG}`;

function toSafeProfile(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }): SupabaseProfile {
  const metadata = user.user_metadata ?? {};
  const fullName = typeof metadata.full_name === 'string' ? metadata.full_name.trim() : '';
  const nameFallback = typeof metadata.name === 'string' ? metadata.name.trim() : '';
  const firstName = typeof metadata.first_name === 'string' ? metadata.first_name.trim() : '';
  const lastName = typeof metadata.last_name === 'string' ? metadata.last_name.trim() : '';
  const composedName = `${firstName} ${lastName}`.trim();
  const avatarUrl = typeof metadata.avatar_url === 'string'
    ? metadata.avatar_url.trim()
    : (typeof metadata.picture === 'string' ? metadata.picture.trim() : '');

  return {
    id: user.id,
    name: fullName || nameFallback || composedName || 'User',
    email: user.email?.trim() || 'No email available',
    avatarUrl,
  };
}

export function useSupabaseProfile() {
  const [profile, setProfile] = useState<SupabaseProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: userError } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!data?.user) {
        setProfile(null);
        return;
      }

      setProfile(toSafeProfile(data.user));
    } catch (err) {
      setProfile(null);
      setError((err as Error).message || 'Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      void loadProfile();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  return {
    profile,
    isLoading,
    error,
    reload: loadProfile,
  };
}

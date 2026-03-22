import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for localStorage with state synchronization
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  // Get stored value or use initial value
  const readValue = useCallback((): T => {
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  }, [initialValue, key]);

  const [storedValue, setStoredValue] = useState<T>(readValue);

  // Return a wrapped version of useState's setter function that persists to localStorage
  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      // Allow value to be a function so we have same API as useState
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      
      // Save to state
      setStoredValue(valueToStore);
      
      // Save to localStorage
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
        // Dispatch custom event for cross-tab synchronization
        window.dispatchEvent(new StorageEvent('local-storage', { key }));
      }
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, storedValue]);

  // Listen for changes in other tabs/windows
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === key && event.newValue) {
        setStoredValue(JSON.parse(event.newValue));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key]);

  return [storedValue, setValue];
}

/**
 * Hook for reading from the voting system data store
 */
export function useVotingData() {
  const getData = useCallback(() => {
    if (typeof window === 'undefined') {
      return null;
    }
    const data = window.localStorage.getItem('voting_system_data');
    return data ? JSON.parse(data) : null;
  }, []);

  const setData = useCallback((data: unknown) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('voting_system_data', JSON.stringify(data));
  }, []);

  return { getData, setData };
}

/**
 * Hook for managing the current user session
 */
export function useCurrentUser() {
  const getUser = useCallback(() => {
    if (typeof window === 'undefined') {
      return null;
    }
    const user = window.localStorage.getItem('voting_system_current_user');
    return user ? JSON.parse(user) : null;
  }, []);

  const setUser = useCallback((user: unknown) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('voting_system_current_user', JSON.stringify(user));
  }, []);

  const clearUser = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem('voting_system_current_user');
  }, []);

  return { getUser, setUser, clearUser };
}

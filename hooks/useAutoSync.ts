import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { SyncEvents } from './SyncEvents';
import {
  SyncStatus,
  getGitHubToken,
  pushBackupToGitHub,
} from './useGitHubBackup';

const LAST_SYNC_KEY = 'githubLastSyncAt';
const RESTORE_MODE_KEY = 'githubRestoreMode';
const DEBOUNCE_MS = 4000; // czeka 4s po ostatniej zmianie zanim wyśle

/**
 * Hook zarządzający automatyczną synchronizacją z GitHub.
 * Zwraca status synchronizacji i funkcję do ręcznego wymuszenia synca.
 */
export function useAutoSync() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('no_token');
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  // restoreMode = true → auto-push zablokowany (apka nie nadpisuje GitHub)
  const [restoreMode, setRestoreMode] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSyncingRef = useRef(false);
  const restoreModeRef = useRef(false);

  // Załaduj ostatni czas synca, token i tryb przywracania
  useEffect(() => {
    const init = async () => {
      const token = await getGitHubToken();
      const lastSync = await AsyncStorage.getItem(LAST_SYNC_KEY);
      const mode = await AsyncStorage.getItem(RESTORE_MODE_KEY);
      setLastSyncAt(lastSync);
      const isRestoreMode = mode === 'true';
      setRestoreMode(isRestoreMode);
      restoreModeRef.current = isRestoreMode;
      if (!token) {
        setSyncStatus('no_token');
      } else if (isRestoreMode) {
        setSyncStatus('restore_mode' as SyncStatus);
      } else {
        setSyncStatus(lastSync ? 'synced' : 'pending');
      }
    };
    init();
  }, []);

  /** Włącz/wyłącz tryb przywracania (blokuje auto-push) */
  const toggleRestoreMode = useCallback(async () => {
    const next = !restoreModeRef.current;
    restoreModeRef.current = next;
    setRestoreMode(next);
    await AsyncStorage.setItem(RESTORE_MODE_KEY, next ? 'true' : 'false');

    if (!next) {
      // Wychodzimy z trybu przywracania → od razu wyślij
      setSyncStatus('pending');
      triggerSync(true);
    } else {
      setSyncStatus('restore_mode' as SyncStatus);
    }
  }, []);

  /**
   * Wykonuje synchronizację z GitHub (push).
   * Jeśli restoreMode=true, push jest ignorowany.
   * @param force - jeśli true, ignoruje debounce i syncuje natychmiast
   */
  const triggerSync = useCallback(async (force = false) => {
    // Zablokuj push w trybie przywracania
    if (restoreModeRef.current) return;

    const token = await getGitHubToken();
    if (!token) {
      setSyncStatus('no_token');
      return;
    }

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }

    const doSync = async () => {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;
      setSyncStatus('syncing');
      try {
        await pushBackupToGitHub();
        const now = new Date().toLocaleString('pl-PL');
        await AsyncStorage.setItem(LAST_SYNC_KEY, now);
        setLastSyncAt(now);
        setSyncStatus('synced');
      } catch (err) {
        console.warn('[AutoSync] Błąd synchronizacji:', err);
        setSyncStatus('error');
      } finally {
        isSyncingRef.current = false;
      }
    };

    if (force) {
      await doSync();
    } else {
      setSyncStatus('pending');
      debounceTimer.current = setTimeout(doSync, DEBOUNCE_MS);
    }
  }, []);

  // Nasłuchuj na zdarzenia zmiany danych z innych ekranów
  useEffect(() => {
    const unsubscribe = SyncEvents.onDataChanged(() => {
      triggerSync(false);
    });
    return unsubscribe;
  }, [triggerSync]);

  // Sync przy powrocie aplikacji z tła — tylko jeśli NIE jesteśmy w trybie przywracania
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !restoreModeRef.current) {
        triggerSync();
      }
    });
    return () => subscription.remove();
  }, [triggerSync]);

  return { syncStatus, lastSyncAt, triggerSync, restoreMode, toggleRestoreMode };
}

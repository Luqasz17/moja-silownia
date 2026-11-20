import AsyncStorage from '@react-native-async-storage/async-storage';

const GITHUB_TOKEN_KEY = 'githubBackupToken';
const GITHUB_OWNER = 'Luqasz17';
const GITHUB_REPO = 'moja-silownia';
const BACKUP_FILE_PATH = 'data/backup.json';
const GITHUB_API_BASE = 'https://api.github.com';

// Klucze danych do synchronizacji
const DATA_KEYS = [
  'workoutPlans',
  'workoutHistory',
  'measurements',
  'barbells',
  'plates',
  'reminderNote',
  'restSets',
  'restExercises',
];

export type SyncStatus = 'synced' | 'pending' | 'syncing' | 'error' | 'no_token' | 'restore_mode';

/**
 * Pobiera token GitHub z AsyncStorage.
 */
export async function getGitHubToken(): Promise<string | null> {
  return AsyncStorage.getItem(GITHUB_TOKEN_KEY);
}

/**
 * Zapisuje token GitHub do AsyncStorage.
 */
export async function saveGitHubToken(token: string): Promise<void> {
  await AsyncStorage.setItem(GITHUB_TOKEN_KEY, token.trim());
}

/**
 * Usuwa token GitHub z AsyncStorage.
 */
export async function removeGitHubToken(): Promise<void> {
  await AsyncStorage.removeItem(GITHUB_TOKEN_KEY);
}

/**
 * Zbiera wszystkie dane aplikacji z AsyncStorage i zwraca jako obiekt.
 */
export async function collectAllData(): Promise<Record<string, unknown>> {
  const stores = await AsyncStorage.multiGet(DATA_KEYS);
  const result: Record<string, unknown> = {};
  stores.forEach(([key, value]) => {
    if (value !== null) {
      try {
        result[key] = JSON.parse(value);
      } catch {
        result[key] = value;
      }
    }
  });
  return result;
}

/**
 * Pobiera aktualny SHA pliku backup.json z GitHub (potrzebne do aktualizacji).
 * Zwraca null jeśli plik nie istnieje.
 */
async function getFileSha(token: string): Promise<string | null> {
  const url = `${GITHUB_API_BASE}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${BACKUP_FILE_PATH}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GitHub API error: ${response.status}`);
  const json = await response.json();
  return json.sha as string;
}

/**
 * Koduje string UTF-8 do base64 z zachowaniem polskich znaków.
 * Standardowe btoa() obsługuje tylko Latin-1 — ta funkcja poprawnie
 * koduje wszystkie znaki Unicode (ą, ę, ó, ź, ż itd.).
 */
function encodeBase64UTF8(str: string): string {
  // encodeURIComponent → ucieczka wielobajtowych znaków jako %XX
  // unescape           → zamiana %XX na bajty Latin-1 (czytelne przez btoa)
  return btoa(unescape(encodeURIComponent(str)));
}

/**
 * Dekoduje base64 do stringa UTF-8 z zachowaniem polskich znaków.
 * Odwrotność encodeBase64UTF8.
 */
function decodeBase64UTF8(b64: string): string {
  return decodeURIComponent(escape(atob(b64)));
}

/**
 * Wysyła backup do GitHub. Tworzy lub aktualizuje plik data/backup.json.
 */
export async function pushBackupToGitHub(): Promise<void> {
  const token = await getGitHubToken();
  if (!token) throw new Error('NO_TOKEN');

  const data = await collectAllData();
  const backupPayload = {
    version: 2,
    exportedAt: new Date().toISOString(),
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    data,
  };

  const content = encodeBase64UTF8(JSON.stringify(backupPayload, null, 2));
  const sha = await getFileSha(token);

  const url = `${GITHUB_API_BASE}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${BACKUP_FILE_PATH}`;
  const body: Record<string, unknown> = {
    message: `🔄 Auto-backup ${new Date().toLocaleString('pl-PL')}`,
    content,
  };
  if (sha) body.sha = sha;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    throw new Error(errJson.message || `GitHub API error: ${response.status}`);
  }
}

/**
 * Pobiera backup z GitHub i przywraca dane do AsyncStorage.
 * Zwraca datę eksportu przy sukcesie.
 */
export async function pullBackupFromGitHub(): Promise<string> {
  const token = await getGitHubToken();
  if (!token) throw new Error('NO_TOKEN');

  const url = `${GITHUB_API_BASE}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${BACKUP_FILE_PATH}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });

  if (response.status === 404) throw new Error('BACKUP_NOT_FOUND');
  if (!response.ok) throw new Error(`GitHub API error: ${response.status}`);

  const json = await response.json();
  // Plik jest base64-encoded; używamy dekodowania UTF-8 aby zachować polskie znaki
  const decoded = decodeBase64UTF8(json.content.replace(/\n/g, ''));
  const backupPayload = JSON.parse(decoded);

  if (!backupPayload.data) throw new Error('INVALID_BACKUP_FORMAT');

  const keysToSet: [string, string][] = [];
  for (const key of DATA_KEYS) {
    const value = backupPayload.data[key];
    if (value !== undefined) {
      keysToSet.push([key, typeof value === 'string' ? value : JSON.stringify(value)]);
    }
  }

  await AsyncStorage.multiSet(keysToSet);
  return backupPayload.exportedAt ?? 'nieznana data';
}

/**
 * Sprawdza czy token jest poprawny (wywołanie API /user).
 */
export async function verifyGitHubToken(token: string): Promise<boolean> {
  const response = await fetch(`${GITHUB_API_BASE}/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });
  return response.ok;
}

/**
 * push-backup.js
 * Wrzuca plik backup.json na GitHub jako data/backup.json
 * Użycie: node push-backup.js <GITHUB_TOKEN>
 */

const fs = require('fs');
const path = require('path');

const OWNER = 'Luqasz17';
const REPO = 'moja-silownia';
const FILE_PATH = 'data/backup.json';
const API_BASE = 'https://api.github.com';

const token = process.argv[2];
if (!token) {
  console.error('Użycie: node push-backup.js <GITHUB_TOKEN>');
  process.exit(1);
}

const backupFilePath = path.join(__dirname, 'backup.json');
if (!fs.existsSync(backupFilePath)) {
  console.error('Nie znaleziono pliku backup.json obok skryptu!');
  process.exit(1);
}

const rawContent = fs.readFileSync(backupFilePath, 'utf8');

// Walidacja JSON
let parsed;
try {
  parsed = JSON.parse(rawContent);
} catch (e) {
  console.error('Błąd: plik backup.json nie jest poprawnym JSON!', e.message);
  process.exit(1);
}

// Zaktualizuj exportedAt na teraz
parsed.exportedAt = new Date().toISOString();
const finalContent = JSON.stringify(parsed, null, 2);

// Kodowanie UTF-8 → base64 (obsługa polskich znaków)
const base64Content = Buffer.from(finalContent, 'utf8').toString('base64');

async function getCurrentSha() {
  const url = `${API_BASE}/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Błąd API (${res.status}): ${err.message}`);
  }
  const json = await res.json();
  return json.sha;
}

async function pushFile(sha) {
  const url = `${API_BASE}/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`;
  const body = {
    message: `🔄 Ręczne przywrócenie backupu ${new Date().toLocaleString('pl-PL')}`,
    content: base64Content,
  };
  if (sha) body.sha = sha;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Błąd API (${res.status}): ${err.message}`);
  }
  return await res.json();
}

(async () => {
  try {
    console.log('📡 Łączę z GitHub...');
    const sha = await getCurrentSha();
    console.log(sha ? `🔍 Znaleziono istniejący plik (SHA: ${sha.slice(0,8)}...)` : '🆕 Plik nie istnieje — zostanie utworzony');

    console.log('⬆️  Wysyłam backup.json na GitHub...');
    const result = await pushFile(sha);

    console.log('✅ Sukces!');
    console.log(`   Commit: ${result.commit.sha.slice(0,8)}`);
    console.log(`   URL: ${result.content.html_url}`);
    console.log('');
    console.log('Teraz w aplikacji: Ustawienia → ↓ Przywróć z GitHub');
  } catch (err) {
    console.error('❌ Błąd:', err.message);
    process.exit(1);
  }
})();

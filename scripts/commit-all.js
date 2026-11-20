/**
 * commit-all.js
 * Commituje wszystkie zmienione pliki kodu na GitHub przez Contents API.
 * Użycie: node scripts/commit-all.js <GITHUB_TOKEN>
 */

const fs = require('fs');
const path = require('path');

const OWNER = 'Luqasz17';
const REPO = 'moja-silownia';
const API_BASE = 'https://api.github.com';
const ROOT = path.join(__dirname, '..');

const token = process.argv[2];
const customMessage = process.argv[3];
if (!token) {
  console.error('Użycie: node scripts/commit-all.js <GITHUB_TOKEN> [COMMIT_MESSAGE]');
  process.exit(1);
}

// Pliki do zaktualizowania (ścieżki względem katalogu projektu → ścieżki w repo)
const FILES = [
  'app/(tabs)/index.tsx',
  'app/(tabs)/workout.tsx',
  'app/(tabs)/history.tsx',
  'app/(tabs)/explore.tsx',
  'app/(tabs)/_layout.tsx',
  'hooks/useGitHubBackup.ts',
  'hooks/useAutoSync.ts',
  'hooks/SyncEvents.ts',
  'components/SyncStatusBadge.tsx',
  'scripts/push-backup.js',
  'scripts/commit-all.js',
];

function encodeBase64(content) {
  return Buffer.from(content, 'utf8').toString('base64');
}

async function getFileInfo(repoPath) {
  const url = `${API_BASE}/repos/${OWNER}/${REPO}/contents/${repoPath}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`GET ${repoPath} -> ${res.status}: ${err.message}`);
  }
  const json = await res.json();
  return { sha: json.sha, content: json.content ? json.content.replace(/\s/g, '') : null };
}

async function pushFile(repoPath, content, sha) {
  const url = `${API_BASE}/repos/${OWNER}/${REPO}/contents/${repoPath}`;
  const message = customMessage
    ? `${customMessage} (${repoPath})`
    : `🔄 Update ${repoPath} [${new Date().toLocaleString('pl-PL')}]`;

  const body = {
    message,
    content: encodeBase64(content),
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
    throw new Error(`PUT ${repoPath} -> ${res.status}: ${err.message}`);
  }
  return await res.json();
}

(async () => {
  console.log(`\n📡 Łączę z GitHub (${OWNER}/${REPO})...\n`);
  let ok = 0, skipped = 0, fail = 0;

  for (const relPath of FILES) {
    const localPath = path.join(ROOT, relPath.replace(/\//g, path.sep));

    if (!fs.existsSync(localPath)) {
      console.log(`⚠️  Pominięto (brak lokalnie): ${relPath}`);
      continue;
    }

    const content = fs.readFileSync(localPath, 'utf8');
    const localBase64 = encodeBase64(content);

    try {
      process.stdout.write(`  → ${relPath} ... `);
      const remote = await getFileInfo(relPath);

      if (remote && remote.content === localBase64) {
        console.log(`⏸️  bez zmian`);
        skipped++;
      } else {
        const result = await pushFile(relPath, content, remote ? remote.sha : null);
        console.log(`✅  commit ${result.commit.sha.slice(0, 8)}`);
        ok++;
      }
    } catch (err) {
      console.log(`❌  ${err.message}`);
      fail++;
    }

    // Krótka przerwa żeby nie przekroczyć rate-limit
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`✅ Zaktualizowano: ${ok} plików`);
  console.log(`⏸️  Bez zmian:     ${skipped} plików`);
  if (fail > 0) console.log(`❌ Błędy:        ${fail} plików`);
  console.log('');
})();

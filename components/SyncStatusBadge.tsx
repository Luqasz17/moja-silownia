import { useContext, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { ThemeContext } from '../context/ThemeContext';
import { SyncStatus } from '../hooks/useGitHubBackup';

interface SyncStatusBadgeProps {
  status: SyncStatus;
  lastSyncAt: string | null;
}

export function SyncStatusBadge({ status, lastSyncAt }: SyncStatusBadgeProps) {
  const { colors } = useContext(ThemeContext);
  const styles = useMemo(() => getStyles(colors), [colors]);

  const config = {
    synced:       { emoji: '🟢', label: 'Zsynchronizowano', color: colors.success },
    pending:      { emoji: '🟡', label: 'Oczekuje...', color: colors.warning },
    syncing:      { emoji: null,  label: 'Synchronizacja...', color: colors.primary },
    error:        { emoji: '🔴', label: 'Błąd synca', color: colors.danger },
    no_token:     { emoji: '⚪', label: 'Brak tokenu', color: colors.textMuted },
    restore_mode: { emoji: '🔒', label: 'Tryb przywracania (auto-push wyłączony)', color: colors.warning },
  }[status];

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {status === 'syncing' ? (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 6 }} />
        ) : (
          <Text style={styles.emoji}>{config.emoji}</Text>
        )}
        <View>
          <Text style={[styles.label, { color: config.color }]}>{config.label}</Text>
          {lastSyncAt && status !== 'no_token' && (
            <Text style={styles.sublabel}>Ostatni sync: {lastSyncAt}</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  emoji: { fontSize: 16, marginRight: 8 },
  label: { fontSize: 13, fontWeight: 'bold' },
  sublabel: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  syncBtn: { fontSize: 22, fontWeight: 'bold' },
});

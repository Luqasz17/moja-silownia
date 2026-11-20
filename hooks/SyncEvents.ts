/**
 * Prosty event emitter do komunikacji między ekranami.
 * Używany do triggerowania synca z GitHubem po każdej zmianie danych.
 */
type Listener = () => void;

const listeners: Set<Listener> = new Set();

export const SyncEvents = {
  /**
   * Zarejestruj słuchacza zdarzenia "dane zmienione".
   * Zwraca funkcję do wyrejestrowania.
   */
  onDataChanged(cb: Listener): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },

  /**
   * Emituj zdarzenie "dane zmienione" — triggeruje auto-sync.
   */
  emitDataChanged() {
    listeners.forEach(cb => cb());
  },
};

import type { SQLiteOpenOptions } from 'expo-sqlite';

/**
 * Android 17's hardened allocator exposes a double-finalize in expo-sqlite's
 * automatic statement sweep while a database is closing. Natura UY uses the
 * async helpers, which finalize their own statements, so skipping that extra
 * native sweep is both safe and avoids the process-level SIGABRT.
 */
export const LONG_LIVED_DATABASE_OPTIONS = {
  finalizeUnusedStatementsBeforeClosing: false,
} satisfies SQLiteOpenOptions;

/** A private connection for short-lived validation and owned providers. */
export const OWNED_DATABASE_OPTIONS = {
  useNewConnection: true,
  finalizeUnusedStatementsBeforeClosing: false,
} satisfies SQLiteOpenOptions;

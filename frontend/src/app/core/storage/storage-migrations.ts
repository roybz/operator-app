export const STORAGE_MIGRATION_STATE_KEY = 'op_storage_migrations_v1';

interface StorageMigration {
  id: string;
  run: (cache: Map<string, string>) => boolean;
}

const CORE_JSON_KEYS = [
  'op_session',
  'op_users',
  'op_prefs',
  'op_preview_prefs',
  'op_org_settings',
  'op_invitees',
  'op_universes',
  'op_active_universe',
  'op_login_security',
] as const;

const safeJsonParse = (raw: string) => {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
};

const migrations: readonly StorageMigration[] = [
  {
    id: '2026-03-04-prune-invalid-core-json',
    run(cache) {
      let changed = false;
      for (const key of CORE_JSON_KEYS) {
        const raw = cache.get(key);
        if (!raw) continue;
        if (safeJsonParse(raw) !== undefined) continue;
        cache.delete(key);
        changed = true;
      }
      return changed;
    },
  },
  {
    id: '2026-03-04-normalize-login-phone-mode',
    run(cache) {
      const key = 'op_login_phone_mode';
      const raw = cache.get(key);
      if (!raw) return false;

      const parsed = safeJsonParse(raw);
      if (typeof parsed === 'boolean') return false;

      const normalized = raw.trim();
      if (normalized === '1') {
        cache.set(key, 'true');
        return true;
      }
      if (normalized === '0') {
        cache.set(key, 'false');
        return true;
      }

      cache.delete(key);
      return true;
    },
  },
];

export function parseAppliedStorageMigrations(raw: string | null) {
  if (!raw) return new Set<string>();
  const parsed = safeJsonParse(raw);
  if (!Array.isArray(parsed)) return new Set<string>();
  return new Set(parsed.filter((value): value is string => typeof value === 'string'));
}

export function applyBuiltInStorageMigrations(
  cache: Map<string, string>,
  alreadyApplied: Set<string>,
) {
  const newlyApplied: string[] = [];
  const touchedKeys = new Set<string>();
  const before = new Map(cache);

  for (const migration of migrations) {
    if (alreadyApplied.has(migration.id)) continue;
    migration.run(cache);
    newlyApplied.push(migration.id);
  }

  for (const key of new Set([...before.keys(), ...cache.keys()])) {
    if (before.get(key) !== cache.get(key)) touchedKeys.add(key);
  }

  return {
    touchedKeys: Array.from(touchedKeys).sort(),
    newlyApplied,
  };
}

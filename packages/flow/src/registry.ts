// The registry of repositories the projection covers. One version-controlled file, `registry.json`.

export const REGISTRY_SCHEMA_VERSION = 1;

export type Thresholds = {
  waitTimeP50Seconds?: number;
  cycleTimeP50Seconds?: number;
  queueAgeSeconds?: number;
  batchSizeLines?: number;
  reworkWindowDays?: number;
};

export type RegistryEntry = {
  name: string;
  url: string;
  defaultBranch: string;
  releaseTagPattern: string;
  thresholds: Thresholds;
};

export type Registry = {
  schemaVersion: number;
  repositories: RegistryEntry[];
};

export function parseRegistry(text: string): {
  registry: Registry;
  errors: string[];
} {
  const errors: string[] = [];
  const empty: Registry = {
    schemaVersion: REGISTRY_SCHEMA_VERSION,
    repositories: [],
  };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return {
      registry: empty,
      errors: [`registry is not valid JSON: ${(error as Error).message}`],
    };
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { registry: empty, errors: ['registry must be a JSON object'] };
  }
  const input = raw as Record<string, unknown>;
  if (input.schemaVersion !== REGISTRY_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${REGISTRY_SCHEMA_VERSION}`);
  }
  const repositories: RegistryEntry[] = [];
  const names = new Set<string>();
  const entries = Array.isArray(input.repositories) ? input.repositories : [];
  if (!Array.isArray(input.repositories)) {
    errors.push('repositories must be an array');
  }
  entries.forEach((entry, index) => {
    const record = (
      typeof entry === 'object' && entry !== null ? entry : {}
    ) as Record<string, unknown>;
    const label = `repositories[${index}]`;
    const name = typeof record.name === 'string' ? record.name : '';
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)) {
      errors.push(
        `${label}.name must be a short identifier (letters, digits, dots, hyphens)`,
      );
    } else if (names.has(name)) {
      errors.push(`${label}.name "${name}" is declared twice`);
    }
    names.add(name);
    const url = typeof record.url === 'string' ? record.url : '';
    if (url.length === 0) {
      errors.push(`${label}.url is required (an SSH URL or a local path)`);
    }
    const defaultBranch =
      typeof record.defaultBranch === 'string' && record.defaultBranch
        ? record.defaultBranch
        : 'main';
    const releaseTagPattern =
      typeof record.releaseTagPattern === 'string' && record.releaseTagPattern
        ? record.releaseTagPattern
        : 'v*';
    const thresholds: Thresholds = {};
    const rawThresholds = (
      typeof record.thresholds === 'object' && record.thresholds !== null
        ? record.thresholds
        : {}
    ) as Record<string, unknown>;
    for (const key of [
      'waitTimeP50Seconds',
      'cycleTimeP50Seconds',
      'queueAgeSeconds',
      'batchSizeLines',
      'reworkWindowDays',
    ] as const) {
      const value = rawThresholds[key];
      if (value === undefined) {
        continue;
      }
      if (typeof value === 'number' && value >= 0) {
        thresholds[key] = value;
      } else {
        errors.push(`${label}.thresholds.${key} must be a non-negative number`);
      }
    }
    repositories.push({
      name,
      url,
      defaultBranch,
      releaseTagPattern,
      thresholds,
    });
  });
  return {
    registry: { schemaVersion: REGISTRY_SCHEMA_VERSION, repositories },
    errors,
  };
}

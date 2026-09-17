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
  /** An explicit browsable URL, for a remote whose host is an SSH alias the derivation cannot read. */
  webUrl: string | null;
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
    let explicitWebUrl: string | null = null;
    if (record.webUrl !== undefined) {
      if (
        typeof record.webUrl === 'string' &&
        /^https:\/\/[^/\s]+\/[^\s]+$/.test(record.webUrl)
      ) {
        explicitWebUrl = record.webUrl.replace(/\/+$/, '');
      } else {
        errors.push(
          `${label}.webUrl must be an https URL naming the repository`,
        );
      }
    }
    repositories.push({
      name,
      url,
      defaultBranch,
      releaseTagPattern,
      thresholds,
      webUrl: explicitWebUrl,
    });
  });
  return {
    registry: { schemaVersion: REGISTRY_SCHEMA_VERSION, repositories },
    errors,
  };
}

/**
 * The browsable web URL for a registry URL, when that URL is a GitHub remote: `git@host:owner/repo.git`,
 * `ssh://git@host/owner/repo.git`, or `https://host/owner/repo`. A local path, a non-GitHub host, or any
 * other form yields null, and The Board then renders hashes with no link. Never returns a local path, so a
 * projection built from a local mirror stays machine-independent. A registry entry whose remote host is an
 * SSH alias (`git@github.com-work:owner/repo.git`) names its browsable URL explicitly in `webUrl` instead.
 */
export function webUrl(url: string): string | null {
  const trimmed = url.trim();
  const scheme = /^(?<scheme>[A-Za-z][A-Za-z0-9+.-]*):\/\//.exec(trimmed);
  let match: RegExpExecArray | null;
  if (scheme) {
    if (!['ssh', 'git', 'http', 'https'].includes(scheme.groups!.scheme)) {
      return null;
    }
    match = /^(?:[^@/]+@)?(?<host>[^/:]+)(?::\d+)?\/(?<path>.+)$/.exec(
      trimmed.slice(scheme[0].length),
    );
  } else {
    match = /^(?:[^@/]+@)?(?<host>[^/:]+):(?<path>.+)$/.exec(trimmed);
  }
  const host = match?.groups?.host;
  const path = match?.groups?.path;
  if (!host || !path) {
    return null;
  }
  // A GitHub host: github.com or a GitHub Enterprise host under it, ending in a plain top-level label. An
  // SSH alias such as github.com-work is a key selector in the operator's SSH configuration, not a host
  // anyone can browse, so it derives nothing and the registry entry names its web URL instead.
  if (!/^github\.(?:[a-z0-9-]+\.)*[a-z]+$/i.test(host)) {
    return null;
  }
  const repository = path.replace(/\.git$/, '').replace(/^\/+|\/+$/g, '');
  if (!/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(repository)) {
    return null;
  }
  return `https://${host}/${repository}`;
}

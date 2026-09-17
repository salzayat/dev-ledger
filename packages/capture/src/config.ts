// The version-controlled telemetry configuration (`telemetry.config.json`). The projection reads it as it
// stood at each change's parent commit, so a later edit never restates earlier changes.

export const CONFIG_SCHEMA_VERSION = 1;

export type ReportedUnitConfig = {
  enabled: boolean;
  scale?: number[];
};

export type TelemetryConfig = {
  schemaVersion: number;
  specPattern: string;
  effort: {
    storyPoints: ReportedUnitConfig;
    workHours: { enabled: boolean };
    derivedComplexity: { enabled: boolean; algorithm: string };
  };
  costAllocation: {
    enabled: boolean;
    idleCapSeconds: number;
    operators: string[];
    costClasses: string[];
  };
};

export const DEFAULT_CONFIG: TelemetryConfig = {
  schemaVersion: CONFIG_SCHEMA_VERSION,
  specPattern: '^[a-z0-9][a-z0-9-]*$',
  effort: {
    storyPoints: { enabled: true },
    workHours: { enabled: false },
    derivedComplexity: { enabled: false, algorithm: 'diff-lines-v1' },
  },
  costAllocation: {
    enabled: false,
    idleCapSeconds: 900,
    operators: [],
    costClasses: ['rd', 'production'],
  },
};

const FORBIDDEN_CONFIG_KEYS =
  /^(name|email|hourlyRate|rate|salary|compensation)$/i;

/**
 * Parses configuration text. Missing sections fall back to defaults; a present section is validated.
 * Returns the configuration and a list of validation errors (empty when valid).
 */
export function parseConfig(text: string): {
  config: TelemetryConfig;
  errors: string[];
} {
  const errors: string[] = [];
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return {
      config: DEFAULT_CONFIG,
      errors: [`configuration is not valid JSON: ${(error as Error).message}`],
    };
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return {
      config: DEFAULT_CONFIG,
      errors: ['configuration must be a JSON object'],
    };
  }
  const input = raw as Record<string, unknown>;
  const config: TelemetryConfig = structuredClone(DEFAULT_CONFIG);

  if (
    input.schemaVersion !== undefined &&
    input.schemaVersion !== CONFIG_SCHEMA_VERSION
  ) {
    errors.push(`schemaVersion must be ${CONFIG_SCHEMA_VERSION}`);
  }
  if (typeof input.specPattern === 'string') {
    try {
      new RegExp(input.specPattern);
      config.specPattern = input.specPattern;
    } catch {
      errors.push('specPattern is not a valid regular expression');
    }
  }

  const effort = asObject(input.effort);
  if (effort) {
    const storyPoints = asObject(effort.storyPoints);
    if (storyPoints) {
      config.effort.storyPoints.enabled = storyPoints.enabled === true;
      if (Array.isArray(storyPoints.scale)) {
        if (
          storyPoints.scale.every(
            (value) => Number.isInteger(value) && (value as number) >= 0,
          )
        ) {
          config.effort.storyPoints.scale = storyPoints.scale as number[];
        } else {
          errors.push(
            'effort.storyPoints.scale must contain non-negative integers',
          );
        }
      }
    }
    const workHours = asObject(effort.workHours);
    if (workHours) {
      config.effort.workHours.enabled = workHours.enabled === true;
    }
    const derived = asObject(effort.derivedComplexity);
    if (derived) {
      config.effort.derivedComplexity.enabled = derived.enabled === true;
      if (
        typeof derived.algorithm === 'string' &&
        derived.algorithm.length > 0
      ) {
        config.effort.derivedComplexity.algorithm = derived.algorithm;
      } else if (config.effort.derivedComplexity.enabled) {
        errors.push(
          'effort.derivedComplexity.algorithm is required when enabled',
        );
      }
    }
  }

  const allocation = asObject(input.costAllocation);
  if (allocation) {
    config.costAllocation.enabled = allocation.enabled === true;
    if (allocation.idleCapSeconds !== undefined) {
      if (
        typeof allocation.idleCapSeconds === 'number' &&
        allocation.idleCapSeconds > 0
      ) {
        config.costAllocation.idleCapSeconds = allocation.idleCapSeconds;
      } else {
        errors.push('costAllocation.idleCapSeconds must be a positive number');
      }
    }
    if (allocation.operators !== undefined) {
      if (
        Array.isArray(allocation.operators) &&
        allocation.operators.every(isPseudonymousId)
      ) {
        config.costAllocation.operators = allocation.operators as string[];
      } else {
        errors.push(
          'costAllocation.operators must be pseudonymous identifiers (letters, digits, hyphens), not names or email addresses',
        );
      }
    }
    if (allocation.costClasses !== undefined) {
      if (
        Array.isArray(allocation.costClasses) &&
        allocation.costClasses.every(
          (value) => typeof value === 'string' && value !== 'unclassified',
        )
      ) {
        config.costAllocation.costClasses = allocation.costClasses as string[];
      } else {
        errors.push(
          'costAllocation.costClasses must be strings and must not include the reserved value unclassified',
        );
      }
    }
    for (const key of Object.keys(allocation)) {
      if (FORBIDDEN_CONFIG_KEYS.test(key)) {
        errors.push(
          `costAllocation.${key} is not allowed: the configuration carries no names, addresses, or rates`,
        );
      }
    }
    const operatorEntries = Array.isArray(allocation.operators)
      ? allocation.operators
      : [];
    for (const entry of operatorEntries) {
      const record = asObject(entry);
      if (record) {
        for (const key of Object.keys(record)) {
          if (FORBIDDEN_CONFIG_KEYS.test(key)) {
            errors.push(`costAllocation.operators[].${key} is not allowed`);
          }
        }
      }
    }
  }

  return { config, errors };
}

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isPseudonymousId(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    /^[a-z0-9][a-z0-9-]*$/i.test(value) &&
    !value.includes('@')
  );
}

// The versioned contract this package reads from `capture`, re-exported so consumers pin one place.
export {
  DEFAULT_CONFIG,
  SESSION_SCHEMA_VERSION,
  parseConfig,
} from '@dev-ledger/capture';
export type { TelemetryConfig } from '@dev-ledger/capture';
export { REGISTRY_SCHEMA_VERSION } from './registry.ts';

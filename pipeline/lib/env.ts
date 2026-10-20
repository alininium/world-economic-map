import path from 'node:path';

/** Loads .env from the repo root if present (Node's built-in parser); never required. */
export function loadEnv(): void {
  try {
    process.loadEnvFile(path.resolve(import.meta.dirname, '../../.env'));
  } catch {
    // no .env file; keys may come from the environment instead
  }
}

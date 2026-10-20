/**
 * Single entry point for refreshing data: `npm run data:refresh [--cached] [step...]`.
 * With no steps every step runs in order. `--cached` reuses downloads in pipeline/.cache.
 * A failing step is reported and the others still run; the exit code is non-zero if any failed.
 */
import { runGeo } from './geo/build';
import { loadEnv } from './lib/env';
import { setUseCache } from './lib/fetch';
import { runCurrencies } from './macro/currencies';
import { runImf } from './macro/imf';
import { runWorldBank } from './macro/worldbank';
import { runComtrade } from './trade/comtrade';

const STEPS: Record<string, () => Promise<void>> = {
  geo: runGeo,
  worldbank: runWorldBank,
  imf: runImf,
  currencies: runCurrencies,
  trade: runComtrade,
};

/** Shorthands for several steps. */
const GROUPS: Record<string, string[]> = {
  macro: ['worldbank', 'imf', 'currencies'],
};

loadEnv();
const args = process.argv.slice(2);
setUseCache(args.includes('--cached'));
const requested = args.filter((a) => !a.startsWith('--')).flatMap((a) => GROUPS[a] ?? [a]);
const unknown = requested.filter((s) => !(s in STEPS));
if (unknown.length) {
  console.error(
    `Unknown step(s): ${unknown.join(', ')}. Available: ${Object.keys(STEPS).join(', ')}`,
  );
  process.exit(1);
}
const failed: string[] = [];
for (const name of requested.length ? requested : Object.keys(STEPS)) {
  try {
    await STEPS[name]!();
  } catch (err) {
    console.error(`✗ ${name}: ${(err as Error).message}`);
    failed.push(name);
  }
}
if (failed.length) {
  console.error(
    `\n${failed.length} step(s) failed: ${failed.join(', ')}. Existing data files were left unchanged.`,
  );
  process.exitCode = 1;
}

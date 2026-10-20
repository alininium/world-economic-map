/**
 * Single entry point for refreshing data: `npm run data:refresh [step...]`.
 * With no arguments every step runs in order.
 */
import { runGeo } from './geo/build';

const STEPS: Record<string, () => Promise<void>> = {
  geo: runGeo,
};

const requested = process.argv.slice(2);
const unknown = requested.filter((s) => !(s in STEPS));
if (unknown.length) {
  console.error(
    `Unknown step(s): ${unknown.join(', ')}. Available: ${Object.keys(STEPS).join(', ')}`,
  );
  process.exit(1);
}
for (const name of requested.length ? requested : Object.keys(STEPS)) {
  await STEPS[name]!();
}

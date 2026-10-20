import type { CountryStatus } from './types';

export const STATUS_LABELS: Record<CountryStatus, string> = {
  un_member: 'UN member state',
  un_observer: 'UN observer state',
  partially_recognized: 'Partially recognized state',
  disputed: 'Disputed territory',
  dependency: 'Dependent territory',
  other: 'No sovereign government',
};

/** Statuses that count as sovereign states in rankings and comparisons. */
export const SOVEREIGN_STATUSES: ReadonlySet<CountryStatus> = new Set([
  'un_member',
  'un_observer',
  'partially_recognized',
]);

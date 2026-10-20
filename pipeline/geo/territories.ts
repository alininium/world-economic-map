import type { CountryStatus } from '../../shared/types';

/**
 * The 193 UN member states (ISO 3166-1 alpha-3).
 * Source: United Nations, "Member States", https://www.un.org/en/about-us/member-states
 */
export const UN_MEMBERS: ReadonlySet<string> = new Set(
  `AFG ALB DZA AND AGO ATG ARG ARM AUS AUT AZE BHS BHR BGD BRB BLR BEL BLZ BEN BTN BOL BIH BWA BRA
  BRN BGR BFA BDI CPV KHM CMR CAN CAF TCD CHL CHN COL COM COG CRI CIV HRV CUB CYP CZE PRK COD DNK
  DJI DMA DOM ECU EGY SLV GNQ ERI EST SWZ ETH FJI FIN FRA GAB GMB GEO DEU GHA GRC GRD GTM GIN GNB
  GUY HTI HND HUN ISL IND IDN IRN IRQ IRL ISR ITA JAM JPN JOR KAZ KEN KIR KWT KGZ LAO LVA LBN LSO
  LBR LBY LIE LTU LUX MDG MWI MYS MDV MLI MLT MHL MRT MUS MEX FSM MCO MNG MNE MAR MOZ MMR NAM NRU
  NPL NLD NZL NIC NER NGA MKD NOR OMN PAK PLW PAN PNG PRY PER PHL POL PRT QAT KOR MDA ROU RUS RWA
  KNA LCA VCT WSM SMR STP SAU SEN SRB SYC SLE SGP SVK SVN SLB SOM ZAF SSD ESP LKA SDN SUR SWE CHE
  SYR TJK TZA THA TLS TGO TON TTO TUN TUR TKM TUV UGA UKR ARE GBR USA URY UZB VUT VEN VNM YEM ZMB ZWE`
    .split(/\s+/)
    .filter(Boolean),
);

/** Non-member observer states of the UN General Assembly. */
export const UN_OBSERVERS: ReadonlySet<string> = new Set(['PSE', 'VAT']);

/** Shown as separate entities with a "partially recognized" badge. XKX is the code the World Bank and IMF use for Kosovo. */
export const PARTIALLY_RECOGNIZED: ReadonlySet<string> = new Set(['TWN', 'XKX']);

/**
 * Natural Earth features that are not drawn as entities of their own (keyed by NE ADM0_A3).
 * - mergeInto: the shape becomes part of the internationally recognized state, whose
 *   statistics already cover it.
 * - id/status: the shape keeps its own outline under the given id and status.
 */
export const NE_OVERRIDES: Readonly<
  Record<string, { mergeInto: string } | { id: string; status: CountryStatus }>
> = {
  SOL: { mergeInto: 'SOM' }, // Somaliland
  CYN: { mergeInto: 'CYP' }, // Northern Cyprus
  ALD: { mergeInto: 'FIN' }, // Åland, an autonomous region of Finland
  KOS: { id: 'XKX', status: 'partially_recognized' },
  SAH: { id: 'ESH', status: 'disputed' }, // Western Sahara
  KAS: { id: 'KAS', status: 'disputed' }, // Siachen Glacier (India/Pakistan)
  ATA: { id: 'ATA', status: 'other' }, // Antarctica
};

/** Short English names used in the UI where Natural Earth's NAME_LONG is formal or dated. NE names stay searchable. */
export const DISPLAY_NAMES: Readonly<Record<string, string>> = {
  BRN: 'Brunei',
  CPV: 'Cabo Verde',
  CZE: 'Czechia',
  FLK: 'Falkland Islands',
  FRO: 'Faroe Islands',
  FSM: 'Micronesia',
  HMD: 'Heard Island and McDonald Islands',
  KOR: 'South Korea',
  LAO: 'Laos',
  PRK: 'North Korea',
  RUS: 'Russia',
  SWZ: 'Eswatini',
  TUR: 'Türkiye',
  VAT: 'Holy See (Vatican City)',
};

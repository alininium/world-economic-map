import type { Citation } from './chains';

/** A short, hand-written summary of what is most notable about one economy. */
export interface Brief {
  id: string;
  text: string;
  /** Datasets and works the text relies on; every figure in it comes from one of these. */
  sources: Citation[];
}

export const BRIEFS_PATH = 'briefs/briefs.json';

/** Briefs longer than this are rejected: the panel shows them in full above the figures. */
export const MAX_BRIEF_WORDS = 120;

/**
 * The project's own datasets, which a brief cites by key (`data:worldbank`, …) instead of
 * defining them in its source list.
 */
export const DATASET_CITATIONS: Record<string, Citation> = {
  'data:worldbank': {
    title: 'World Development Indicators',
    authors: 'World Bank',
    year: 2026,
    venue: 'World Bank Open Data',
    url: 'https://data.worldbank.org/',
  },
  'data:imf': {
    title: 'World Economic Outlook',
    authors: 'International Monetary Fund',
    year: 2026,
    venue: 'IMF DataMapper',
    url: 'https://www.imf.org/external/datamapper/',
  },
  'data:comtrade': {
    title: 'UN Comtrade database',
    authors: 'United Nations',
    year: 2026,
    venue: 'UN Comtrade',
    url: 'https://comtradeplus.un.org/',
  },
  'data:usgs': {
    title: 'Mineral Commodity Summaries 2025 data release',
    authors: 'U.S. Geological Survey',
    year: 2025,
    venue: 'USGS ScienceBase',
    url: 'https://doi.org/10.5066/P13XCP3R',
  },
  'data:fao': {
    title: 'FAOSTAT Crops and livestock products',
    authors: 'FAO',
    year: 2026,
    venue: 'FAOSTAT',
    url: 'https://www.fao.org/faostat/en/#data/QCL',
  },
  'data:energy': {
    title: 'Statistical Review of World Energy 2025',
    authors: 'Energy Institute, via Our World in Data',
    year: 2025,
    venue: 'Our World in Data',
    url: 'https://github.com/owid/energy-data',
  },
};

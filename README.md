# World Economic Map

An interactive world map for exploring the current economic profile of every country:
macro indicators, trade, strategic resources, foreign investment and production chains.
It is a static site: a data pipeline downloads and normalizes public datasets into versioned
JSON files under `data/`, and the browser app reads only those files.

> **Status:** milestone 1 of the MVP: a clickable world map with search and a country panel.
> Economic data arrives in milestones 2–3 (see [Roadmap](#roadmap)).

## Running it

Requires Node.js 22+.

```sh
npm install
npm run dev        # http://localhost:5173
```

Other scripts:

| Command                | What it does                                      |
| ---------------------- | ------------------------------------------------- |
| `npm run build`        | Type-check and build the static site into `dist/` |
| `npm run preview`      | Serve the built site                              |
| `npm test`             | Unit tests for the data transforms and search     |
| `npm run lint`         | ESLint                                            |
| `npm run format`       | Prettier (`format:check` verifies only)           |
| `npm run data:refresh` | Re-download and rebuild every dataset in `data/`  |

## Refreshing data

```sh
cp .env.example .env     # only needed for sources that require a key (later milestones)
npm run data:refresh     # all steps
npm run data:refresh geo # one step
npm run data:refresh -- --cached  # reuse earlier downloads from pipeline/.cache/
```

Each step downloads its sources, keeps the raw responses in `pipeline/.cache/` (git-ignored),
cleans and normalizes them, and writes files to `data/`. Requests to the same host are spaced
at least one second apart. Rate limiting (429), server errors and network failures are retried
with exponential backoff; other HTTP errors fail at once.

If a step fails, for example because a source is unreachable, its existing files in `data/`
are left untouched, the remaining steps still run, and the command exits non-zero.
`retrievedAt` is always the date the response was actually downloaded, including with
`--cached`.

Every dataset is written as `{ "meta": {...}, "data": ... }`, and `data/manifest.json` lists
every file with its provenance:

- `source` and `sourceUrl`
- `license`
- `retrievedAt`: the date the pipeline downloaded it
- `dataYear`: the year or edition the figures describe

The generated files are committed, so the app runs without a refresh; `git diff data/`
shows exactly what a refresh changed.

**No data is invented.** A figure a source does not provide is stored as missing and shown as
missing in the UI.

## Project layout

```
pipeline/          data pipeline (Node + TypeScript, run with tsx)
  refresh.ts       single entry point; runs the steps
  lib/             cached, rate-limited fetching; dataset writing
  geo/             boundaries and the territory policy
shared/            types and helpers used by both the pipeline and the app
src/
  data/            loading datasets
  map/             MapLibre map, style, palette
  search/          country search (combobox + ranking)
  panel/           country detail panel
data/              generated, versioned datasets the app reads
```

## Countries and territories

`pipeline/geo/territories.ts` holds the policy:

- **Sovereign states:** the 193 UN members and the two UN observer states (Palestine, Holy See).
- **Partially recognized:** Taiwan and Kosovo are separate entities with a badge, since they
  publish their own statistics.
- **Disputed:** Western Sahara and the Siachen Glacier are drawn hatched and are never ranked.
- **Dependent territories:** Greenland, Puerto Rico, Hong Kong and others are drawn and get
  their own data where it exists, but are excluded from sovereign-state rankings.
- **Merged into the recognized state:** Somaliland goes into Somalia, Northern Cyprus into
  Cyprus, Åland into Finland, and Australia's Indian Ocean and Ashmore/Cartier territories
  into Australia. The recognized state's statistics already cover these areas.
- **Display names:** the UI uses short common English names (e.g. "Russia", "Türkiye").
  Natural Earth's names, and names in French, Polish, Russian, German and Spanish, are all
  searchable.

Boundaries follow Natural Earth's de facto conventions. They are not a statement on any
dispute.

## Data sources

| Data               | Source                                                                               | License        |
| ------------------ | ------------------------------------------------------------------------------------ | -------------- |
| Country boundaries | [Natural Earth](https://www.naturalearthdata.com/) 1:50m Admin 0 – Countries, v5.1.2 | Public domain  |
| UN membership list | [United Nations, Member States](https://www.un.org/en/about-us/member-states)        | Reference list |

Sources planned for the next milestones: World Bank WDI and IMF WEO (macro), CEPII BACI and
UN Comtrade (trade), UNCTAD (FDI), USGS, the Energy Institute, EIA and FAOSTAT (resources).
They will be added here with their licenses as they are integrated.

## Roadmap

MVP:

1. ✅ Scaffold, tooling, clickable world map, search, country panel, mobile layout
2. Macro indicators pipeline → choropleth with legend, macro snapshot in the panel
3. Trade: top products and partners, charts, trade-flow lines

Later: strategic resources and commodity view, FDI, production chains (hybrid of trade-derived
roles and curated, cited notes), comparison mode.

## Known gaps and limitations

- At 1:50m scale, very small states are hard to click as shapes. Below zoom 5, the map adds a
  marker for each one.
- The map uses the Web Mercator projection, so high-latitude countries look larger than they
  are.
- There are no country labels on the map yet. Names show in the tooltip and in search.
- MapLibre makes up most of the JavaScript bundle (~360 kB gzipped). Code-splitting is planned
  for the polish milestone.

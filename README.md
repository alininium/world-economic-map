# World Economic Map

An interactive world map for exploring the current economic profile of every country:
macro indicators, trade, strategic resources, foreign investment and production chains.
It is a static site: a data pipeline downloads and normalizes public datasets into versioned
JSON files under `data/`, and the browser app reads only those files.

> **Status:** milestones 1–4: a clickable world map with search, a choropleth with legend, a
> commodity view, and a country panel with a macro snapshot, strategic resources, trade charts
> and trade-flow lines. See the [Roadmap](#roadmap) and
> [Data status](#data-status).

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
cp .env.example .env     # then add your free UN Comtrade key (needed for the trade step)
npm run data:refresh     # all steps
npm run data:refresh geo # one step
npm run data:refresh macro        # World Bank, IMF and currencies
npm run data:refresh trade        # UN Comtrade (needs COMTRADE_API_KEY)
npm run data:refresh resources    # energy, USGS minerals, FAOSTAT crops
npm run data:refresh -- --cached  # reuse earlier downloads from pipeline/.cache/
```

Each step downloads its sources, keeps the raw responses in `pipeline/.cache/` (git-ignored),
cleans and normalizes them, and writes files to `data/`. Requests to the same host are spaced
at least one second apart. Rate limiting (429), server errors and network failures are retried
with exponential backoff; other HTTP errors fail at once.

A full refresh (no step named) skips steps whose API key isn't set and says so. Naming such a
step explicitly without its key is an error.

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

## Macro indicators

Indicators and their sources are listed in `shared/indicators.ts`. Each has a primary series
and, where the IMF publishes a comparable one, a fallback used only for countries the primary
source lacks (the World Bank has nothing for Taiwan, for example), or whose primary figure is
at least three years older than the fallback's. The panel shows the year
and source next to every figure and links to the original series. The tooltip and legend name
the source too.

| Indicator                                | Primary (code)                 | Fallback (IMF WEO code) |
| ---------------------------------------- | ------------------------------ | ----------------------- |
| GDP, nominal (US$)                       | World Bank `NY.GDP.MKTP.CD`    | `NGDPD`                 |
| GDP, PPP (int. $)                        | World Bank `NY.GDP.MKTP.PP.CD` | `PPPGDP`                |
| GDP growth (%)                           | World Bank `NY.GDP.MKTP.KD.ZG` | `NGDP_RPCH`             |
| GDP per capita (US$)                     | World Bank `NY.GDP.PCAP.CD`    | `NGDPDPC`               |
| GDP per capita, PPP (int. $)             | World Bank `NY.GDP.PCAP.PP.CD` | `PPPPC`                 |
| Inflation, consumer prices (%)           | World Bank `FP.CPI.TOTL.ZG`    | `PCPIPCH`               |
| Unemployment (%)                         | World Bank `SL.UEM.TOTL.ZS`    | `LUR`                   |
| General government gross debt (% of GDP) | IMF WEO `GGXWDG_NGDP`          | —                       |
| Population                               | World Bank `SP.POP.TOTL`       | `LP`                    |
| Trade balance, goods & services (US$)    | World Bank `NE.RSB.GNFS.CD`    | —                       |
| FDI net inflows (US$)                    | World Bank `BX.KLT.DINV.CD.WD` | —                       |
| Currency                                 | ISO 4217                       | —                       |

- **Latest value:** each country shows its most recent non-missing year, looking back up to 10
  years (World Bank), or its latest completed year (IMF). IMF projections are never used.
  Figures more than four years old are highlighted.
- **Choropleth:** quantile classes, computed over sovereign states only, so dependencies don't
  shift the breaks. Magnitudes use one blue ramp in 5 classes. Signed metrics (growth,
  inflation, trade balance, FDI) use red for negative and blue for positive, 3 classes each,
  with zero as a class boundary. Grey means no data. The ramps were checked with a palette
  validator (lightness steps, contrast against the ocean) in both light and dark themes.

## Trade

The `trade` step queries the [UN Comtrade](https://comtradeplus.un.org/) v1 API for annual HS
goods trade as reported by each country. It looks back three years and uses each reporter's
latest year with reported exports, the same year for both flows.

- **Partners:** total trade by partner country (`cmdCode=TOTAL`).
- **Products:** HS 4-digit headings traded with the world (`cmdCode=AG4`).
- **One row per partner:** rows are filtered to `customsCode=C00`, `motCode=0` and
  `partner2Code=0`, so breakdowns by customs procedure or transport mode aren't double counted.
- **Numeric codes:** Comtrade codes aren't always ISO numeric (the USA is 842, for example), so
  reporter, partner and HS codes are resolved through Comtrade's own reference files.
- **Requests:** reporters are batched, about 70 requests in all, well inside the free tier of
  500 a day. Requests are spaced one second apart.

Outputs:

- `data/trade/summary.json`: exports and imports totals, plus **export concentration**. This is
  the Herfindahl–Hirschman index of HS4 export shares (0 = diversified, 1 = one product). It
  isn't normalized, so it differs from UNCTAD's index. It's available as a choropleth metric.
- `data/trade/by-country/<ID>.json`: the top 10 products and partners for each flow, with value
  and share. The app loads a file only when that country is opened.

In the panel, export and import products and partners appear as bar charts, with a table view
for screen readers and copying. "Show trade flows" draws great-circle lines to the top 5
export destinations (blue) and import origins (orange) that are countries on the map.
Comtrade's non-country partners ("Areas, nes", and "Other Asia, nes", the label Comtrade uses
for Taiwan) appear in the lists, but have no line.

## Strategic resources

`shared/commodities.ts` lists 21 commodities chosen for economic and strategic weight. Each one
records where every measure comes from:

| Measure                        | Source                                                                                   | Commodities                                                                                                              |
| ------------------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Production (energy)            | Energy Institute _Statistical Review of World Energy_ (2025), via Our World in Data, TWh | crude oil, natural gas, coal                                                                                             |
| Production, refining, reserves | USGS _Mineral Commodity Summaries_ data release, in USGS units                           | lithium, cobalt, nickel, copper, graphite, manganese, rare earths, gallium, germanium, tungsten, PGMs, bauxite, iron ore |
| Production (crops)             | FAOSTAT Crops and livestock products, tonnes                                             | wheat, maize, rice, soybeans                                                                                             |
| Exports, imports               | UN Comtrade, the commodity's HS codes summed                                             | all except gallium and germanium                                                                                         |

- **Commodity view:** pick a commodity from the map selector, then a measure. The map colors
  producers in quantile classes, and a card ranks the top 10 with their share of the source's
  world total. A share is shown only when the country's figure and the world total are for the
  same year.
- **Strategic resources section:** lists everything a country produces, refines, holds or
  trades, with its rank among sovereign states.
- **Gaps are stated, not filled:**
  - Uranium production (no open machine-readable source).
  - Energy reserves (the Energy Institute stopped publishing them after 2020).
  - Gallium and germanium trade (their HS code is shared with other metals).
  - Smaller oil, gas and coal producers, which the Statistical Review only publishes inside
    regional totals.
- **USGS:** the step reads the MCS world-data CSV (default: MCS 2025 release, data year 2024;
  `USGS_MCS_URL` overrides it). Columns are detected by pattern. If the layout differs, the step
  stops and prints the header. Country names are mapped through `pipeline/resources/names.ts`,
  and names that match nothing are listed in the output rather than dropped silently.
- **FAOSTAT:** the step streams the bulk QCL archive (`FAOSTAT_QCL_URL` overrides the URL) and
  joins areas by M49 code. "China, mainland" maps to China; Taiwan is separate.

## Data status

Included now: boundaries, currencies, and fossil-fuel production (`data/resources/energy.json`,
Statistical Review 2025, data year 2024).

The cloud environment this was built in could not reach the World Bank, IMF, UN Comtrade,
USGS ScienceBase or FAOSTAT, so the macro, trade, mineral and crop datasets have not been
generated yet. The app says so wherever they would appear, and no placeholder figures were
added. Run `npm run data:refresh macro trade usgs fao` with network access (and a Comtrade key)
to fill them in.

## Data sources

| Data                   | Source                                                                                                                  | License                                                |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Country boundaries     | [Natural Earth](https://www.naturalearthdata.com/) 1:50m Admin 0 – Countries, v5.1.2                                    | Public domain                                          |
| UN membership list     | [United Nations, Member States](https://www.un.org/en/about-us/member-states)                                           | Reference list                                         |
| Macro indicators       | [World Bank, World Development Indicators](https://data.worldbank.org/) (API v2)                                        | CC BY 4.0                                              |
| Macro indicators       | [IMF, World Economic Outlook](https://www.imf.org/external/datamapper/) (DataMapper API)                                | IMF terms: free reuse with attribution                 |
| Currencies             | ISO 4217 (SIX Group) via [datasets/country-codes](https://github.com/datasets/country-codes)                            | ODC-PDDL-1.0 (compilation)                             |
| Fossil fuel production | Energy Institute, Statistical Review of World Energy 2025, via [Our World in Data](https://github.com/owid/energy-data) | CC BY 4.0 (OWID); EI data with attribution             |
| Minerals               | [USGS Mineral Commodity Summaries](https://doi.org/10.5066/P13XCP3R) data release                                       | Public domain                                          |
| Crops                  | [FAOSTAT](https://www.fao.org/faostat/en/#data/QCL) Crops and livestock products                                        | CC BY 4.0                                              |
| Goods trade            | [UN Comtrade](https://comtradeplus.un.org/) API v1                                                                      | UN Comtrade terms: non-commercial use with attribution |

Sources planned for the next milestones: UNCTAD and IMF (FDI).
They will be added here with their licenses as they are integrated.

## Roadmap

MVP:

1. ✅ Scaffold, tooling, clickable world map, search, country panel, mobile layout
2. ✅ Macro indicators pipeline → choropleth with legend, macro snapshot in the panel
3. ✅ Trade: top products and partners, charts, trade-flow lines
4. ✅ Strategic resources and the commodity view
5. FDI
6. Production chains (hybrid of trade-derived roles and curated, cited notes)
7. Comparison mode, polish, accessibility, performance

## Known gaps and limitations

- At 1:50m scale, very small states are hard to click as shapes. Below zoom 5, the map adds a
  marker for each one.
- The map uses the Web Mercator projection, so high-latitude countries look larger than they
  are.
- Trade covers goods only (no services) and depends on countries reporting to Comtrade. Some
  countries report late or not at all, and those show "No recent report". Mirror data (partner
  reports) is not used.
- Flow lines are great circles drawn on a Mercator map, so long routes curve (for example,
  Brazil to Australia passes near Antarctica).
- Unemployment mixes two definitions when the IMF fallback is used: the World Bank series is a
  modelled ILO estimate, the IMF's follows national definitions.
- There are no country labels on the map yet. Names show in the tooltip and in search.
- MapLibre makes up most of the JavaScript bundle (~360 kB gzipped). Code-splitting is planned
  for the polish milestone.

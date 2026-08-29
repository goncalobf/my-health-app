# Food data architecture

Last verified: 2026-08-30.

Fitlog combines national reference foods with international and packaged-food
fallbacks. A provider is never allowed to leak its upstream response shape into
the UI: every adapter produces the model in `src/lib/foods/types.ts`, and the
orchestrator ranks and deduplicates only normalized records.

## Providers and legal basis

| Provider | Fitlog use | Integration | Current constraints |
| --- | --- | --- | --- |
| PortFIR / INSA | Portuguese generic, prepared and traditional foods | Versioned official XLSX import | The workbook requires a visible source notice. It has Portuguese names only and no documented public API or barcode catalog. Version synchronized at implementation: v7.1 (2026), 1,376 records. |
| Swiss Food Composition Database / FSVO | Foods available in Switzerland | Four official localized XLSX imports; public REST API remains a documented future adapter option | The FSVO permits commercial and scientific reuse with source acknowledgment. German, French, Italian and English are imported. Version synchronized at implementation: v7.1 (2026), 1,246 records. |
| USDA FoodData Central | International cooked/generic fallback | Server-side REST API | CC0/public domain; source acknowledgment requested. Production uses `FDC_API_KEY`; `DEMO_KEY` is development-only fallback with much lower limits. |
| Open Food Facts | Packaged products, images and barcodes | Search-a-licious full-text search and API v3.6 product lookup | Community data can be incomplete. Database data is ODbL, individual contents use the Database Contents License, and images are CC BY-SA. Search is limited to 10 requests/minute/IP and product reads to 15 requests/minute/IP. |

Official references:

- PortFIR: <https://portfir.insa.min-saude.pt/>
- Swiss downloads and API documentation: <https://naehrwertdaten.ch/en/downloads/>
- USDA API guide: <https://fdc.nal.usda.gov/api-guide/>
- Open Food Facts API guide: <https://openfoodfacts.github.io/openfoodfacts-server/api/>

The exact PortFIR use notice is also embedded in the official workbook's
`Informação adicional` sheet. Do not remove provider attribution from the food
detail UI.

## Request flow

1. `/api/foods/search` authenticates the Fitlog user and loads their
   `food_region` and `food_language` settings.
2. The orchestrator calls all providers concurrently with `Promise.allSettled`.
   One upstream failure never removes successful results from another source.
3. PortFIR and Swiss records are queried locally from the shared catalog. USDA
   and Open Food Facts calls have finite eight-second timeouts and six-hour
   shared Next.js cache entries.
4. Ranking considers direct name/synonym matches, preparation terms, language,
   user region, official-source quality and optional nutrient completeness.
5. Deduplication is conservative: equal barcodes collapse; exact generic names
   collapse only when core macros are very close; distinct brands remain.
6. The API returns at most 36 normalized foods. Only records with all four core
   values (energy, protein, available carbohydrate and fat) can be logged.

Food lookup uses an explicit Search submit rather than search-as-you-type. This
is deliberate: Open Food Facts explicitly limits full-text search to 10
requests/minute/IP and warns clients not to call it on every keystroke.

Barcode lookup intentionally queries Open Food Facts only. Neither PortFIR nor
the generic Swiss catalog documents barcodes, so Fitlog does not manufacture or
infer them.

## Normalization rules

- Nutrients are per 100 g edible portion and are rounded to one decimal place.
- Missing data stays `null`; it is never silently converted into zero.
- Records missing any core macro are excluded from loggable search results.
- PortFIR alcoholic beverages are declared per 100 ml by the source. They are
  imported with `basis_unit = ml` but excluded from the current gram-based UI.
- Swiss names and synonyms are linked across languages by stable provider ID.
- Search text is lower-case and diacritic-free. Category text helps discovery
  but has very little ranking weight compared with a food-name match.
- Open Food Facts v3.6 barcode responses use `nutrition.aggregated_set`; the
  Search-a-licious adapter also accepts its current `nutriments` representation.

## Database and privacy

`food_catalog_items` and `food_catalog_names` are shared reference tables and
contain no personal data. `settings.food_region` and `settings.food_language`
are per-user. Search and barcode routes require an invited Fitlog account.

The trigram index on `food_catalog_names.search_text` requires PostgreSQL's
`pg_trgm` extension and is created by migration `0013_late_azazel.sql`.

External cache entries contain public food responses and are not associated
with a user ID. Never log search terms, provider payloads, API keys or nutrition
logs in production diagnostics.

## Synchronizing official catalogs

The synchronizer discovers the current official XLSX download links, validates
minimum record counts, parses all required languages, and replaces one provider
atomically. A failed download, schema change or incomplete translation rolls
back without damaging the previous catalog.

```bash
# Validate downloads, parsing and SQL without keeping changes
node --env-file=.env.local scripts/sync-food-catalogs.mjs --dry-run

# Synchronize the configured database
npm run sync:foods
```

The script reports counts and versions but never prints connection strings or
food payloads. Run it after an official database release, not during a request
or deployment build. Review unexpected count decreases or missing columns
before modifying a parser: they can signal an upstream format change.

For a new environment, apply migration `0013_late_azazel.sql` before the first
sync. Production migrations remain append-only, transactionally dry-run first,
and must never use `db:push`.

## Main implementation files

- `src/lib/foods/types.ts`: normalized contract and provider interface.
- `src/lib/foods/normalization.ts`: shared validation and text normalization.
- `src/lib/foods/preferences.ts`: validated per-user region and language lookup.
- `src/lib/foods/catalog-provider.ts`: local PortFIR/Swiss adapter.
- `src/lib/foods/fooddata-central-normalizer.ts`: pure USDA response adapter.
- `src/lib/foods/openfoodfacts-normalizer.ts`: pure OFF v2/v3 response adapter.
- `src/lib/fooddata-central.ts`: USDA remote adapter and cache.
- `src/lib/openfoodfacts.ts`: packaged-food search and barcode adapter/cache.
- `src/lib/foods/ranking.ts`: multilingual ranking and conservative dedupe.
- `src/lib/foods/search.ts`: provider orchestration and graceful fallback.
- `scripts/sync-food-catalogs.mjs`: official XLSX ingestion.
- `src/app/api/foods/`: authenticated search and barcode routes.

---
paths:
  - "src/lib/food*.ts"
  - "src/lib/foods/**/*.ts"
  - "src/app/api/foods/**/*.ts"
  - "scripts/sync-food-catalogs.mjs"
  - "src/db/schema.ts"
  - "drizzle/**/*.sql"
---

# External food data rules

- Read `docs/food-data.md` before changing providers, ranking, ingestion or food schema.
- Do not invent endpoints or scrape request-time nutrition values. Use a documented API or official download.
- Keep every upstream shape inside its adapter and normalize before ranking or persistence.
- Missing nutrients remain null. Never turn an absent upstream field into a nutritional zero.
- Only foods with energy, protein, carbohydrate and fat per 100 g are loggable.
- Do not infer a barcode for generic national-database foods. Barcode lookup belongs to a provider that publishes barcodes.
- Preserve visible provider attribution and source/version metadata. Recheck official terms before adding a new source or redistributing images.
- External calls stay server-side, use finite timeouts, respect documented rate limits and share cache entries only for public provider data.
- Keep food lookup submit-based; do not restore remote search on every keystroke.
- Search and barcode routes still require `requireAppUser()` even though catalog rows are shared.
- National catalog updates must be atomic and idempotent. Validate counts and translations before deleting stale rows.
- PortFIR 100 ml alcoholic-beverage records must not enter the gram-based logging flow until Fitlog models volume explicitly.
- Do not log search terms, external health payloads, API keys or connection strings.

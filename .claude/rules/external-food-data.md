---
paths:
  - "src/lib/food*.ts"
  - "src/lib/foods/**/*.ts"
  - "src/app/api/foods/**/*.ts"
  - "scripts/sync-food-catalogs.mjs"
---

# Food providers and normalization

- Read `docs/food-data.md` before changing providers, ranking, ingestion, attribution, or the normalized contract.
- Keep upstream payloads inside adapters; ranking, UI, and persistence consume only normalized records.
- Missing nutrients remain `null`. A food is loggable only when energy, protein, carbohydrate, and fat per 100 g are all present.
- Do not infer barcodes or units. PortFIR 100 ml records remain outside the gram flow until volume is modeled explicitly.
- Keep visible provider/version attribution and recheck current source terms before adding data or images.
- External calls are server-side, timeout-bounded, rate-limit aware, and cached only when the payload is public. Food lookup remains submit-based.
- Search and barcode routes still require an active Fitlog user even though catalog records are shared.
- Catalog refreshes are atomic and idempotent. Validate versions, counts, columns, and translations before replacing prior data.
- Never log search terms, provider payloads, nutrition logs, API keys, or database connection strings.

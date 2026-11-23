---
paths:
  - "src/app/**/*.tsx"
  - "src/components/**/*.tsx"
  - "src/app/globals.css"
  - "tailwind.config.ts"
  - "public/**/*"
  - "assets/brand/**/*"
  - "scripts/generate-icons.mjs"
---

# Mobile UI and PWA

- Design from 320 px iPhone width upward. Check 320, 375, and 390 px, safe areas, fixed navigation, keyboard overlap, long content, and horizontal overflow.
- Preserve the responsive shell, compact session layouts, safe-area helpers, and readable scrolling regions. Prefer flow, wrapping, responsive grids, and `min-w-0` over fixed widths.
- Controls must be comfortably tappable and keyboard accessible; do not depend on hover or unlabeled icon-only actions.
- Decimal gram/kilogram fields use `inputMode="decimal"` and `src/lib/decimal-input.ts` so both comma and period remain editable on iOS.
- The active workout stays a sparse one-set-at-a-time flow with explicit start, next/rest behavior, visible current state, and protection against accidental completion.
- Reuse shared classes and `ExerciseImage`; cover loading, empty, error, disabled, long-label, and image-failure states.
- Keep the Fitlog design welcoming and readable. Use charcoal surfaces, red primary actions, and the shared typography. Write neutrally about food, body data, ability, and training effort.
- `assets/brand/fitlog-mark-source.png` is the text-free icon source. Run `npm run icons`; do not hand-edit generated icons.
- Motivation images require a verified free licence and credit. Premium/watermarked imagery is not acceptable.
- Manifest, service worker, icon, camera/barcode, or fixed-navigation changes need installed-PWA/HTTPS checks.
- Run `npm run dev:local` and inspect the changed screen. A screenshot alone does not prove touch scrolling, keyboard behavior, or timers.

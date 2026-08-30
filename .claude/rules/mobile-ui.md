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
- Preserve the scrollable `max-w-xl` dark shell, invisible scrollbars, and safe-area helpers. Prefer flow, wrapping, responsive grids, and `min-w-0` over fixed widths.
- Controls must be comfortably tappable and keyboard accessible; do not depend on hover or unlabeled icon-only actions.
- Decimal gram/kilogram fields use `inputMode="decimal"` and `src/lib/decimal-input.ts` so both comma and period remain editable on iOS.
- The active workout stays a sparse one-set-at-a-time flow with explicit start, next/rest behavior, visible current state, and protection against accidental completion.
- Reuse shared classes and `ExerciseImage`; cover loading, empty, error, disabled, long-label, and image-failure states.
- Keep the editorial Fitlog language: near-black, warm off-white, condensed display type, asymmetric restraint, and lime only for intent or positive progress. Avoid generic dashboard styling and ornamental gradients.
- `assets/brand/fitlog-mark-source.png` is the text-free icon source. Run `npm run icons`; do not hand-edit generated icons.
- Motivation images require a verified free licence and credit. Premium/watermarked imagery is not acceptable.
- Manifest, service worker, icon, camera/barcode, or fixed-navigation changes need installed-PWA/HTTPS checks.
- Run `npm run dev:local` and inspect the changed screen. A screenshot alone does not prove touch scrolling, keyboard behavior, or timers.

---
paths:
  - "src/app/**/*.tsx"
  - "src/components/**/*.tsx"
  - "src/app/globals.css"
  - "tailwind.config.ts"
  - "public/**/*"
---

# Mobile UI and PWA rules

- Optimize first for iPhone screens from 320 px upward. Verify no horizontal overflow at 320, 375, and 390 px and no overlap with the bottom navigation or home indicator.
- Preserve `safe-top`, `safe-bottom`, `min-h-dvh`, the narrow `max-w-lg` shell, and invisible scrollbars while keeping all content scrollable.
- Prefer normal flow, wrapping, responsive grids, and `min-w-0` over fixed widths. Long exercise/food names, email addresses, numbers, and button groups must wrap or truncate intentionally.
- Make primary controls comfortably tappable and keyboard accessible. Do not depend on hover or tiny icon-only targets without an accessible label.
- Keep active-workout controls obvious: explicit start/play, next-set flow, manual rest completion, visible current exercise/set state, and protection against accidental completion.
- Use `inputMode="decimal"` and the helpers in `src/lib/decimal-input.ts` for gram and kilogram input so both comma and period work on iOS. Do not force controlled numeric state through `Number()` on each keystroke.
- Use `ExerciseImage` for exercise visuals and provide resilient placeholders when remote images fail.
- Preserve dark-theme contrast and shared component classes. Test loading, empty, error, disabled, and long-content states—not only populated happy paths.
- Changes to the service worker, manifest, icons, camera/barcode flow, or fixed navigation require an installed-PWA/HTTPS compatibility check.

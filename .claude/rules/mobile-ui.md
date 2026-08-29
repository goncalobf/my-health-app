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
- Preserve `safe-top`, `safe-bottom`, `min-h-dvh`, the `max-w-xl` shell, and invisible scrollbars while keeping all content scrollable.
- Prefer normal flow, wrapping, responsive grids, and `min-w-0` over fixed widths. Long exercise/food names, email addresses, numbers, and button groups must wrap or truncate intentionally.
- Make primary controls comfortably tappable and keyboard accessible. Do not depend on hover or tiny icon-only targets without an accessible label.
- Keep active-workout controls obvious: explicit start/play, next-set flow, manual rest completion, visible current exercise/set state, and protection against accidental completion.
- The active workout shows one set at a time with stepper controls and advances itself after logging. Keep that screen sparse; new information belongs in the overview sheet or the rest bar, not beside the steppers.
- `h-full` does not resolve against a `min-h-*`-only parent. Make the frame a flex container and let the content stretch, or the text will sit at the top of a poster instead of the bottom.
- Use `inputMode="decimal"` and the helpers in `src/lib/decimal-input.ts` for gram and kilogram input so both comma and period work on iOS. Do not force controlled numeric state through `Number()` on each keystroke.
- Use `ExerciseImage` for exercise visuals and provide resilient placeholders when remote images fail.
- Preserve dark-theme contrast and shared component classes. Test loading, empty, error, disabled, and long-content states—not only populated happy paths.
- Changes to the service worker, manifest, icons, camera/barcode flow, or fixed navigation require an installed-PWA/HTTPS compatibility check.
- Fitlog uses a monochrome illustrated brand mark with no text. Treat `assets/brand/fitlog-mark-source.png`
  as canonical; regenerate all files in `public/icons/` through `npm run icons` rather than modifying a
  single output icon. Keep the figure readable inside the Android maskable safe area and the iOS rounded crop.
- The visual system is deliberately editorial and high-contrast: near-black backgrounds, warm off-white copy,
  lime only for intent/progress, and condensed display type for hierarchy. Do not reintroduce generic teal
  dashboard styling, excessive rounded cards, or ornamental gradients.
- Look at visual changes before reporting them done: `npm run dev:local`, then screenshot. Headless Chrome lays out at a 500 px minimum, so constrain content to a fixed 320/390 px frame when checking narrow widths.
- Motivation imagery must be free-licence. Premium Unsplash photos render with a visible watermark that no test will catch.
- Older WebKit does not grant momentum touch-scrolling to an overflow region for free; without `-webkit-overflow-scrolling: touch` a swipe inside a sheet can silently fail to scroll, which looks identical to "the button is missing" and cannot be seen in a desktop browser or a screenshot.

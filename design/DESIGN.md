# Design language: "Sketchbook Terminal"

A hand-drawn paper notebook (Ledger OS v2) with a retro pixel terminal inside it (Ledger OS v1).
Paper is the page. The terminal is used for moments of focus: live input, readouts, feedback.
Pixel sprites connect the two. Apply this to every project unless told otherwise.

## Principles
1. Paper first. Most surfaces are cream paper with ink outlines. Dark terminal panels are an accent, used at most 1–2 per screen.
2. Ink, not blur. Hard offset shadows and solid outlines. No soft drop shadows, glassmorphism or gradients (the only exceptions are scanlines and flat two-tone skies behind sprites).
3. Handwriting for people, mono for numbers. Headings, labels and notes use the hand font; every number, date, code or key uses mono.
4. Pixel sprites are icons. Use the user's sprite sheets (assets/), rendered with `image-rendering: pixelated` at whole-number multiples of 16px (16/20/24/32/48/64/96). Don't draw substitute icons with SVG or emoji.
5. Something always happens. Every commit action (submit, save, pay) gets visible feedback: a sprite reaction, a highlighted row, an undo link.
6. Fluid. Layouts reflow with grid/flex + gap; type scales with `clamp()`. Never let input text or placeholders get cut off: shrink it first.

## Color
Paper and ink
- Page bg `#ece6d6` with dot grid `radial-gradient(rgba(42,42,40,.09) 1px, transparent 1px)` at 18px
- Card paper `#fbf8ee` · input white `#ffffff`
- Ink `#2a2a28` (text, outlines, shadows) · muted ink `rgba(0,0,0,.55)`
- Dashed divider `rgba(0,0,0,.2–.25)`

Terminal (accent panels)
- Panel `#1e2a30` · raised `#243540` · edge `#5d7f86`
- Phosphor text `#bfeccd` · cyan label `#8fd0d6` · bright text `#f6f0de`
- Caret/prompt `#e8955a`

Pastel tints (category / status fills, always with an ink outline)
- Green `#cfe0c3` (income, success, active) · Blue `#cfdde8` (family, info)
- Butter `#f1e2b3` (daily, highlight, today) · Lilac `#e3d5ec` (subscriptions)
- Peach `#f3d9c6` (expense, warning) · Rose `#f3c9c0` (error, due soon)

Signal colors
- Primary action `#93c47d` (hover `#a3d08c`, pressed lip `#5f8a4c`)
- Forest `#4a6741` / `#4f7d45` (links, brand band) · Positive text `#3f6b35` · Negative text `#a8473a`
- Note/annotation orange `#c46a2c`
- Brand stripe: `#8cb87a` | `#8fb3cc` | `#e8955a` (three equal bands, 6px, under headers)

Text contrast: ink on paper or on tints only; never pastel text on paper.

## Type
- Hand: **Patrick Hand** for headings, labels, buttons and chips. Sizes 16–30px.
- Mono: **JetBrains Mono** 400/600/700 for numbers, dates, table data and small-caps labels (10–13px, letter-spacing .08–.1em, uppercase).
- Terminal: **VT323** only inside dark terminal panels (18–44px).
- Numbers: mono 600, big KPIs 24–30px (use `clamp(18px,2vw,30px)`).
- Notes/annotations: Patrick Hand 15–16px in `#c46a2c`.
- Google Fonts: `Patrick+Hand`, `JetBrains+Mono:wght@400;600;700`, `VT323`.

## Shape and depth
- Hand-drawn radius: `border-radius: 8px 4px 9px 5px` (cards), `6px 3px 7px 4px` (small boxes).
- Outline: `2px solid #2a2a28` on cards, chips and buttons; `1.5px dashed` for inputs, dividers and "add new" slots.
- Shadow: hard offset `4px 4px 0 #2a2a28` (cards), `6px 6px 0` (modals), `2px 2px 0` (active chip). No blur.
- Terminal panels: same radius and shadow, plus scanlines `repeating-linear-gradient(0deg, rgba(191,236,205,.06) 0 1px, transparent 1px 4px)`.
- Pixel-stepped edges (`box-shadow: 0 -3px 0 C, 0 3px 0 C, -3px 0 0 C, 3px 0 0 C`) are only for elements inside terminal panels.

## Components
- **Header card:** paper card with sprite logo + hand title, pill tabs, utility input on the right, brand stripe underneath.
- **Tabs/chips:** pill `border-radius:14px`, 2px ink outline; white when off, tint + `2px 2px 0` shadow when on. Chips can carry a 20–22px sprite.
- **KPI card:** tinted header strip (sprite + mono caps label, ink bottom border) on top, big mono value and a muted mono sub-line (e.g. a converted currency) below.
- **Primary button (SUBMIT/SAVE):** `#93c47d`, `1.5px dashed` ink border, radius 16px, uppercase hand text with letter-spacing .14em, bottom lip `0 4px 0 #5f8a4c`, press moves it down 3px.
- **Secondary button:** white pill with ink outline. Destructive: white with `#a8473a` outline + text.
- **Inputs:** borderless with a `2px dashed` ink underline; label above in mono caps 10px. Prompt `>` in orange for command-style inputs. Put all the parts of an entry on one full-width row.
- **Tables:** CSS grid, mono 13px, 2px ink header rule, dashed row rules, right-aligned money, category shown as a tinted pill with a sprite; empty/gap rows at 45% opacity.
- **Bars/charts:** current = solid tint with ink outline; previous = hatched `repeating-linear-gradient(135deg, …)` outline.
- **Modals:** paper card, `6px 6px 0` shadow, backdrop `rgba(42,42,40,.45)`.
- **Status tags:** mono 11px caps in a tinted box with an ink outline (e.g. `DUE IN 3d` rose, `UPCOMING` butter).
- **Empty "add" slots:** dashed ink outline, transparent, hand text "+ New …".

## Motion
- Stepped, game-like: `steps()` timing for sprite work. Sprite sheets animate via `background-position-x`.
- Commit feedback: sprite squash → hop → land (~0.8s), 2 pixel rings expanding, optional burst of 9 small sprites. Offer a setting with "burst / single / off".
- Row flash: new or edited row gets butter `#f1e2b3` for ~5s along with an undo link.
- No other decorative motion.

## Layout
- Summary on top, detail below: KPI strip → primary input → trend readouts → full-width tables.
- Max width ~1240px, page padding 24–28px, gaps 16–22px.
- Grids: `repeat(auto-fit, minmax(200px,1fr))` for cards; wide tables go inside `overflow-x:auto` with a min-width.

## Copy
- Plain and short. Keep the user's own labels verbatim (e.g. sheet titles like "Cash Flow Input", "Monthly Outside Obligations").
- Mono caps for machine-ish labels (`PARSED →`, `DUE IN 14 DAYS`); hand font for human text.

## Don't
- Inter/Roboto/Arial, emoji, soft shadows, gradients as decoration, left-border accent cards, SVG-drawn illustrations.
- Dark mode by default. Terminal panels are an accent, not the page.
- Text that is cut off or overflows. Use `clamp()`, shorter placeholders, and wrap before truncating.

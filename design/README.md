# Antar — public site design

Drop this folder in at the repo root as `design/`. Nothing here touches the
site source; `tokens.css` is the only file meant to be pasted into it.

## Files

| File | What it is |
|---|---|
| `tokens.css` | Paste-ready. Replaces the `:root` block in `src/styles/site.css`. |
| `Antar Identity.dc.html` | Sheet 1 — wordmark, lockups, favicon, palette, type scale, spacing. |
| `Antar Chart.dc.html` | Sheet 2 — the 8.78-against-100 problem, at full width and at 320px. |
| `Antar Components.dc.html` | Sheet 3 — figure rows, the two meters, chips, promise window, attributed context, sources. |
| `Antar Screens EN.dc.html` | Sheet 4 — home, indicator, category, method, about, corrections, 404, plus 320px. |
| `Antar Screens HI.dc.html` | Sheet 5 — the same seven in Hindi, with Devanagari metrics. |
| `Antar Social Card.dc.html` | Sheet 6 — 1080 × 1350, both languages, and the rules for what a card may carry. |

Open any `.dc.html` in a browser. Fonts load from Google Fonts.

## The three decisions that drive everything else

**Colour is used for exactly one thing: the gap.** Nothing else on the site is
coloured. Status, category, verification state and roadmap stage are carried by
weight, outline, hatch and rule. A palette with one accent has no slot for a
good/bad pair, so the page cannot colour-code a verdict even by accident, and
the saffron-and-green problem never arises because there is no second hue to
reach for. Plum (`#8E2F6B`) sits outside Indian party colour: not saffron, not
green, not the blues of AAP and BSP, not the reds of the left.

**Devanagari is the primary script, not a substitution.** One family across both
scripts — Tiro Devanagari Hindi, whose Latin companion was drawn to the
Devanagari — for display. Anek Devanagari / Anek Latin, one variable design from
Indian Type Foundry, for text. The Hindi page has its own leading (1.78 against
1.6), its own measure (52ch against 64ch), and labels set at 13px instead of
11px uppercase, because Devanagari has no case and tracking breaks the
shirorekha.

**The two meters are different objects.** Achieved is a filled bar. Window
elapsed is a dated ruler with a tick per year. They share no geometry, no fill
and no axis, so there is no visual arithmetic that relates them — which is what
keeps them from reading as one score.

## Fonts

```html
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Tiro+Devanagari+Hindi:ital@0;1&family=Anek+Devanagari:wght@100..800&family=Anek+Latin:wght@100..800&family=Martian+Mono:wght@300..700&display=swap">
```

Keep the existing per-locale split: an English page loads Tiro Devanagari Hindi
(which carries the Latin), Anek Latin and Martian Mono; a Hindi page swaps Anek
Latin for Anek Devanagari. Tiro ships Regular and Italic only, so the hierarchy
uses size and space where it would otherwise use weight.

Martian Mono sets digits, units and Latin micro-labels. In Hindi, micro-labels
fall back to Anek Devanagari at 13px rather than being letterspaced.

## The chart

The problem: a truthful axis flattens 6.78 → 8.78 GW to a 3px rise; a zoomed
axis makes 91 GW of distance look like a rounding error.

The treatment is one figure with two panels. The left (or, on a phone, top)
panel is drawn to the target, 0–100 GW, and is always first: it carries the
dashed 4.34 GW/year arithmetic line, the hatched area that line encloses, and
the 91.22 GW distance drawn as a dimension line at the deadline. Inside it, the
0–10 GW band is outlined. The right (or lower) panel is that band at ×10, where
the three commissioning steps are legible and labelled with their dates.

Five rules, spelled out on sheet 2: the full-scale panel is primary; the
magnification is stated as a number; the gap is a measured distance rather than
an emptiness; the arithmetic line is captioned as division, not a forecast;
nothing in the figure is a verdict. The two panels are one component and must
not be separable in markup — a zoomed axis without its parent frame is the exact
misreading the figure exists to prevent.

## Things worth deciding before implementation

- The favicon needs exporting as SVG + a 180px apple-touch PNG + 32/16 ICO. The
  glyph is अं reversed out of plum, full-bleed, optically centred 1px above
  geometric centre.
- The social card should be generated from the same view model the page uses, so
  the figure on the card cannot drift from the figure on the site.
- `--gap` is legible as text at 6.6:1 on paper, which is why the *remaining*
  figure is set in it. If you darken the paper, re-check that ratio first.

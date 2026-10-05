# Nightfall token values

Source: the design canvas (https://claude.ai/artifact/8VZbxuqAVU1RntyMQ8u6vu, `NightfallSpec` and `NightfallDark`), mapped onto the existing role names in `src/styles/global.css`. Recorded here before the CSS so the next session doesn't invent them again (`/10x-ui` deposit rule). The values below are the final ones: every starting value from the plan passed `src/styles/contrast.test.ts` unchanged, and the "about" / "slightly lifted" entries were fixed as listed.

## Base colour tokens

| Role                           | Dark      | Light     | Red       |
| ------------------------------ | --------- | --------- | --------- |
| `background` (ground)          | `#070a12` | `#fbfcfd` | `#080000` |
| `surface` (inset field)        | `#0d1220` | `#f2f5f8` | `#170000` |
| `border` (rule)                | `#232b3f` | `#d6dce6` | `#3a0000` |
| `foreground`                   | `#dfe3ec` | `#1c2538` | `#f20000` |
| `heading`                      | `#f2f4f8` | `#0b1428` | `#ff0000` |
| `muted-foreground`             | `#a9b1c5` | `#3c465c` | `#c40000` |
| `primary` (filled action, ink) | `#f2f4f8` | `#0b1428` | `#ff0000` |
| `primary-foreground` (ground)  | `#070a12` | `#fbfcfd` | `#000000` |
| `primary-strong` (links, ring) | `#c3d0ff` | `#23439f` | `#ff0000` |
| `go`                           | `#7ee2b0` | `#17784c` | `#ff0000` |
| `marginal`                     | `#f1cf6b` | `#8f6100` | `#d60000` |
| `no-go`                        | `#ff9b8c` | `#b0322b` | `#bb0000` |
| `zenith` (sky header top)      | `#050916` | `#a9c3e6` | `#000000` |
| `horizon` (sky header bottom)  | `#1b2a55` | `#e9f0f8` | `#240000` |

## The Moon disc

The Moon maps to the dark theme's ink and ground, and looks the same in light and dark (earlier user choice).

| Token       | Dark and light     | Red                |
| ----------- | ------------------ | ------------------ |
| `moon-lit`  | `#f2f4f8` (ink)    | `#ff0000` (ink)    |
| `moon-dark` | `#070a12` (ground) | `#080000` (ground) |
| `moon-mare` | `#a9b1c5` (muted)  | `#c40000` (muted)  |
| `moon-limb` | `#232b3f` (rule)   | `#3a0000` (rule)   |

## Derived and unchanged

- `--selected` / `--selected-foreground` follow `--primary` / `--primary-foreground` in every theme; the light theme's ink override is gone because ink is now the primary.
- `--ring` is `--primary-strong`.
- Verdict alphas, the derived `color-mix` tokens and the star tokens are unchanged.

## Type roles and radius (`@theme inline`)

| Token            | Size              | Line height     | Letter spacing | Use                                               |
| ---------------- | ----------------- | --------------- | -------------- | ------------------------------------------------- |
| `--text-display` | 2.5rem (40 px)    | 2.75rem (44 px) | -0.015em       | page title in the sky header, with `font-display` |
| `--text-title`   | 1.375rem (22 px)  | 1.75rem (28 px) | -0.005em       | band heading, with `font-display`                 |
| `--text-label`   | 0.9375rem (15 px) | 1.25rem (20 px) | none           | band label and field label                        |
| `--text-body`    | 1rem (16 px)      | 1.5rem (24 px)  | none           | body text                                         |

`--radius: 0.375rem` (6 px), with every step derived from it: `sm` 2 px, `md` 4 px, `lg` 6 px, `xl` 8 px, `2xl` 10 px.

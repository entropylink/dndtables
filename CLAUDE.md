# Brand guidelines

Use the entropy.com.mx color scheme and font for all UI in this repo.

## Font

**Ubuntu** (Google Fonts), weights 300/400/700. Fallback: `"Segoe UI", Arial, sans-serif`.

## Palette

| Color | Name | Hex | Usage |
|---|---|---|---|
| ⬛ | Gris Muy Oscuro | `#242525` | Page background, input backgrounds |
| 🟢 | Amarillo Verdoso | `#A8D300` | Titles, primary buttons, hover on links |
| ⬜ | Blanco | `#FFFFFF` | Primary text |
| ◽ | Gris Claro | `#B0B0B0` | Borders, secondary/muted text |
| 🟦 | Cyan Brillante | `#00FFFF` | Links, hover state on primary buttons |

Applied in `index.html` via CSS custom properties in `:root` (`--bg`, `--gold`, `--ink`, `--muted`, `--cyan`, etc.).

# Architecture

- **One file**: `index.html` (no build, no dependencies besides Google Fonts). Blocks in order: `<style>` (tokens in `:root`) → shell → `<template id="tpl-…">` per tab → `<script>` core (`DT`) → one `<script>` per tab (IIFE calling `DT.registerTab` / `DT.simpleTableTab`) → `<script>DT.start();</script>` → particle background.
- New tabs: follow `docs/ADDING_TABS.md` (contract, core API, house rules). Store rolls/ids, never display text; escape everything from saved data with `DT.esc`; EN and ES string tables must have the same keys.
- Saved results: `DT.records` (`dndtables.v3.records`, read-modify-write). v2 cities (`dnd_vendor_cities_v2`) migrate on first run; old keys are never deleted.
- Veil plugin: `veil/` (`plugin.json`, `index.js`, `install.mjs`). The app detects `?velo=<world>` itself; protocol and sync rules in `docs/VEIL.md`. If you touch the bridge, keep `CONTRACT` in `veil/install.mjs` in sync.

# Checks before pushing

- `npm test` (script syntax, Veil contract, headless Playwright suite).
- `VEIL_DIR=../dnd-veil npm run test:veil` when the bridge or `veil/` changes (needs a clone of entropylink/dnd-veil).

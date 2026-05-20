# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

**LexTrack MX** is a single-page React + Vite app for Mexican law firms to track legal cases (_expedientes_). It uses Supabase for both authentication and the database. All UI copy is in Spanish.

## Commands

```bash
npm run dev       # Start dev server (localhost:5173)
npm run build     # Production build → dist/
npm run preview   # Serve the dist/ build locally
npm run lint      # ESLint (JS/JSX only, no TypeScript)
```

There are no tests configured in this project.

## Environment

Requires `.env.local` at the repo root with:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

These are read in [src/supabaseClient.js](src/supabaseClient.js) via `import.meta.env`.

## Architecture

The app has three source files of substance:

- [src/supabaseClient.js](src/supabaseClient.js) — creates and exports the singleton `supabase` client.
- [src/Auth.jsx](src/Auth.jsx) — standalone auth screen (login / register / forgot password). Shown when `session` is null.
- [src/App.jsx](src/App.jsx) — the entire application. Auth state drives rendering; when a session exists, the main UI is shown.

### App.jsx internals

Everything lives in one file. Key patterns to know:

- **All styles are inline JS objects** defined as `const s = {...}` and `const bd = {...}` at the bottom of the file. There is no CSS framework or external stylesheet (only `App.css` / `index.css` for resets).
- **Three tabs**: `expedientes` (case list), `pendientes` (deadline view for next 7 days + overdue), `tesis` (opens SCJN SJF search in a new tab via a constructed URL).
- **`diasHasta(fecha)`** is the core utility — computes days from today to a date string (`YYYY-MM-DD`), returns `null` if no date. Urgency logic everywhere derives from this.
- **Supabase table**: `expedientes`, owned per user (`user_id = session.user.id`). Columns: `num`, `materia`, `tipo`, `juzgado`, `actor`, `demandado`, `etapa`, `estado`, `actuacion`, `termino` (date), `prioridad`, `notas`, `creado_en`, `actualizado_en`.
- **No routing library** — tab state is local React state (`useState`).
- **Export feature**: `exportarTxt()` generates a `.txt` file client-side using a Blob URL download.

### Enumerations (hardcoded constants)

```js
ETAPAS   // 8 procedural stages
TIPOS    // 13 lawsuit types  
MATERIAS // 5 legal subject areas
```

These must stay consistent with what is stored in the database.

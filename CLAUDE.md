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

The application has been restructured into a modular multi-page application with routing, state management, and reusable components:

- **Routing & Entry Point**: Managed by [src/App.jsx](file:///c:/Users/licdi/lextrack-mx/src/App.jsx) using React Router (`react-router-dom`). Defines roles, layout wrapping, and security middleware redirection for clients.
- **Pages ([src/pages/](file:///c:/Users/licdi/lextrack-mx/src/pages/))**:
  - `Dashboard.jsx` (Inicio): Panel showing key metrics, KPIs, charts, and new judicial notices.
  - `Expedientes.jsx`: Core file tracking, detailed Drawer view with tabs for Info, Historial, Archivos, Boletín CJJ, Amparo Federal (CJF), and Cobranza (Hour & Gasto tracking + printable PDF).
  - `Tareas.jsx`: KanBan and list view for project task tracking with assignees and statuses.
  - `Documentos.jsx`: Document templates management (generating files from templates with placeholder injection) and file repository.
  - `Configuracion.jsx`: Despacho details, RFC, and custom letterhead (membrete) configuration.
  - `Usuarios.jsx`: Active lawyers, clients registry, and Resend invitation link builder.
  - `Billing.jsx`: Subscription details and Stripe integrations.
- **State & Contexts ([src/context/](file:///c:/Users/licdi/lextrack-mx/src/context/))**:
  - `OrgContext.jsx`: Multi-tenant organization profile resolver and member access rules.
  - `ThemeContext.jsx`: Handles system light / dark mode themes.
  - `ToastContext.jsx`: Centralized user toast messaging state.
- **Layouts & UI components**:
  - `src/components/layout/` contains `Layout.jsx`, `Navbar.jsx` (includes global instant search), and `Sidebar.jsx`.
  - `src/components/ui/` contains reusable controls: `Modal.jsx`, `PageHeader.jsx`, `StatusBadge.jsx`, `StatCard.jsx`, and `EmptyState.jsx`.
- **Helpers**: [src/utils/helpers.js](file:///c:/Users/licdi/lextrack-mx/src/utils/helpers.js) contains date math, legal holiday definitions (LFT), text formatting, and CSV generators.

### Database Tables (Supabase Schema)
- `despachos`: Organizations.
- `despacho_miembros`: Links users (`auth.users`) to `despachos` with roles (`admin`, `abogado`, `asistente`, `cliente`).
- `despacho_config`: Store logo, contact details, and custom membrete text per organization.
- `expedientes`: Main cases. Contains fields for actor, demandado, juzgado, etc.
- `tareas`: Tasks linked to cases, assignable to members.
- `registro_horas` & `registro_gastos`: Billing data tracked per case.
- `plantillas_documentos`: Legal templates with double brackets placeholder support.

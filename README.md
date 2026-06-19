# Garage Force Fairfax — Installer Portal: Project Context

## What this is

An internal web portal for the Garage Force Fairfax franchise. Installers log in to access training materials, documents, links, inventory tracking, and job management. Admins get additional controls.

**Live URL:** deployed on Render (auto-deploys on push to GitHub)  
**Repo:** https://github.com/robellis-zz/fairfax  
**Owner:** Rob Ellis (robrsfm@gmail.com), admin user `rob`

---

## Stack

| Layer | Technology |
|---|---|
| Backend | Python / FastAPI (`api_server.py`) |
| Frontend | Vanilla JS, no framework (`app.js`, `style.css`, `base.css`) |
| Database | PostgreSQL via Supabase (free tier) |
| Hosting | Render.com (free tier web service) |
| Auth | Token-based, in-memory session store (`sessions` dict in `api_server.py`) |

**File layout** (everything lives in `fairfax/fairfax/`):
```
api_server.py   — FastAPI backend, serves API + static files
app.js          — All frontend logic (IIFE, vanilla JS)
index.html      — Single-page app shell
style.css       — App styles + CSS variables
base.css        — Global CSS reset (DO NOT EDIT — contains svg { height: auto } which affects icon rendering)
render.yaml     — Render deployment config
requirements.txt
logo.jpg        — GF Fairfax logo (used as favicon too)
```

---

## Database

**Supabase PostgreSQL** — connection string stored as `DATABASE_URL` environment variable on Render. Never hardcoded in the repo.

**Connection note:** Render free tier is IPv4 only. Supabase connection pooler on port 6543 is required (not the direct connection on 5432).

**Tables:**
- `users` — portal accounts (username, password_hash, name, role)
- `products` — inventory items (name, category, source, unit, quantity, low_stock_qty)
- `categories` — managed dropdown values (admin-editable)
- `units` — managed dropdown values (admin-editable)
- `sources` — managed dropdown values (admin-editable) — replaces the old hardcoded Corporate/Home Depot/Other list
- `jobs` — installation jobs (customer, address, date, type, status, assigned_to, notes)

---

## Default accounts (seeded on first deploy)

| Username | Role |
|---|---|
| rob | admin |
| howard | installer |
| rich | installer |
| marvin | installer |

Passwords may have been changed since initial seed. Admin can reset any password from the Manage Team tab.

---

## Features built

### Auth
- Login / logout with token auth
- Password visibility toggle on login screen
- Self-service password change (any user, via lock icon in topbar) — verifies current password before updating
- Admin password reset for any user

### Navigation
- **Home** tab (landing page after login) — logo, personalised greeting, section cards with descriptions, live stats (low stock count, upcoming jobs count)
- Tabs: Home, Training, Documents, Links, Inventory, Jobs, Manage Team (admin only)

### Inventory
- All users can adjust quantities with +/− buttons
- Admins can add, edit (inline click-to-edit via pencil icon), and delete products
- Source, Category, Unit dropdowns all populated from DB (not hardcoded)
- Filter by source (dynamic buttons, updates when sources change)
- Sort by Product, Source, Category, or Quantity (click column header to toggle asc/desc)
- Low stock badge (amber "Low" / green "OK") based on `quantity <= low_stock_qty` threshold
- Snapshot Report button — opens a printable HTML page

### Jobs
- Add jobs with customer name, address, date, type, assigned installer, notes
- Status dropdown per job (Upcoming / In Progress / Completed / Cancelled) — changes colour live
- Filter by status
- Print/Export button — exports current filter as a formatted printable page

### Admin (Manage Team tab)
- Add/remove users, reset passwords
- Manage Categories, Units, Sources — add, rename (inline edit), delete
- Categories/Units/Sources feed the inventory form dropdowns and filter buttons

---

## Key technical decisions & gotchas

**SVG icon rendering:** `base.css` has `svg { height: auto }` which collapses SVG icons inside flex containers. Fix: always add `style="width:Xpx;height:Xpx;display:block;flex-shrink:0"` inline on any SVG that needs a fixed size.

**Event listeners use `data-id` (DB id), not array index.** Earlier versions used `data-idx` which broke after filtering/sorting. All buttons now use `data-id` and look up from `allProducts.find()`.

**`source` field was missing from API update.** The `PUT /api/products/:id` endpoint originally had separate UPDATE statements per field and silently skipped `source`. Now it builds a single UPDATE dynamically from whichever fields are present in the request body.

**Low stock threshold edge case:** `product.low_stock_qty || 5` coerces 0 to 5. Fixed with explicit `!= null` checks in form populate and `isNaN()` check on form submit.

**`users.db` (SQLite):** Old database file, still present in the repo folder but no longer used. Should be removed with `git rm fairfax/users.db`. A `.gitignore` has been added to prevent it coming back.

**Supabase sessions:** The in-memory `sessions` dict in `api_server.py` is cleared on every Render deploy/restart, logging everyone out. This is acceptable for now given the small team.

---

## Things not done / possible next steps

- The Schedule tab was removed (was just a Google Calendar embed placeholder). Can be re-added if needed.
- The `source` column on existing products in the DB may say "Other" as default — users can edit products to update their source.
- No email notifications, no audit log.
- `jobs` table has no link to `users` table — assigned_to is a free-text field.
- Mobile nav is a hamburger toggle — works but not optimised for very small screens.
- Render free tier spins down after inactivity (cold start ~30s on first request after idle).

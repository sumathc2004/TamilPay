# TamilPay

A customer management app for TamilPay: a React + Vite frontend backed by an ASP.NET Core API that proxies a remote customer/wallet service — there's no local database.

## Stack

- **Frontend**: React 19, Vite, Tailwind (utility classes only, no component library), `lucide-react` icons.
- **Backend**: ASP.NET Core Web API (.NET 10). No EF Core, no SQL Server — every request forwards to a remote REST API at `http://172.198.160.73/clients/api/` and reshapes the response.

## Running locally

**Backend** (from `backend/TamilPay.Api/`):

```
dotnet run --launch-profile http
```

Runs on `http://localhost:5109`.

**Frontend** (from the repo root):

```
npm install
npm run dev
```

Runs on `http://localhost:5173`; Vite proxies `/api` to `http://localhost:5109` (see `vite.config.js`).

## Architecture

```
Frontend (src/)                     Backend (backend/TamilPay.Api/)
├─ pages/                           ├─ Controllers/    one per resource, thin
├─ components/           /api/*     │                  proxy over RemoteApiClient
├─ styles/, utils/       ────────►  ├─ Models/          validated request DTOs +
                                     │                  remote wire-format models
                                     └─ Services/
                                        RemoteApiClient  generic POST wrapper —
                                                         every remote action, even
                                                         reads, is a POST
```

The backend exists to:
- validate input before it reaches the remote API (data annotations on each `*Request` model),
- normalize the remote API's inconsistent field names/casing into a clean shape for the frontend,
- and paper over remote quirks (see below) so the frontend doesn't have to.

## Remote API quirks

The remote service is shared and outside our control. Known behavior worth knowing before changing anything in `Services/` or `Controllers/`:

- Every endpoint is `POST`, including reads.
- `customer/SelectById` and `wallet/Login` return `data` as a single-element array, not a bare object.
- `customer/Delete`'s own `status` field is unreliable (reports failure even on a successful delete) — always confirm by re-fetching.
- `customer/AssignRole` is undocumented but real, and has the same unreliable-status behavior as `Delete`. It's the only way to actually change a customer's role — `customer/Insert`/`Update` silently ignore `RoleId`.
- The `GST` column is `NOT NULL`; send `""` rather than `null` when blank.
- `Client` records support `Select`/`SelectById`/`Insert` only — no `Update` or `Delete`.

## Master client

Every customer created through this app is attached to one fixed client (id `6`) — there's no per-customer client picker in the UI. See `MASTER_CLIENT_ID` in `src/utils/customer.js`.

## Deployment

Frontend and backend are deployed together as **one IIS site** — the backend serves the frontend's static files itself (`UseDefaultFiles`/`UseStaticFiles` in `Program.cs`), so there's no separate static host and no CORS concerns in production (same origin).

```
npm run build                                      # → dist/
dotnet publish -c Release -o ./publish_output       # from backend/TamilPay.Api/
# copy dist/* into publish_output/wwwroot/, then ship publish_output/ to the server
```

If frontend and backend are ever split onto different origins again, rebuild the frontend with `VITE_API_BASE_URL=<backend origin>` (see `src/utils/api.js`) so its API calls resolve correctly, and lock `Program.cs`'s CORS policy back down from `AllowAnyOrigin()` to the specific frontend origin.

IIS-specific gotchas (see full history for how these were diagnosed):
- The app pool's **Managed Runtime Version must be `""`** (No Managed Code) — leaving it at `v4.0` makes IIS silently 404 every request before it reaches the app.
- The **.NET Hosting Bundle** must be installed *after* the IIS role exists, or its IIS integration doesn't register and needs reinstalling.
- Only one site can bind a given port — if frontend and backend are ever split into separate IIS sites, give them different ports.

# TamilPay — PG API

Payment Gateway (PG) documentation for TamilPay: what the user sees and clicks, which
call each click makes, and the exact request and response of every API underneath.

- Everything here was read from the code in this repository (`src/` and `backend/TamilPay.Api/`).
- Response examples marked **live** were captured from the running app on 7 Oct 2026
  (names and the UTR are real rows from client 5; card digits are the last four only).
- Examples marked **shape** show the exact fields from the model but were not captured live,
  because calling them would create a real payment link or change settings.
- No keys, passwords or tokens are stored in this file. None exist in the PG code path.

---

## 1. The big picture

```
Browser (React)  ──►  TamilPay.Api (ASP.NET Core, this repo)  ──►  Upstream "clients" API
  /api/pg/...            /api/pg, /api/pgsettings, /api/admin         http://172.198.160.73/clients/api/
                         adds Client_ID = 5 to every call             (every action is a POST, same envelope)
                                                                             │
                                                                             ▼
                                                              Payment gateway page on nammapayments.in
                                                              (the "pgLink" the payer opens and pays on)
```

- The backend is a thin proxy. It does not store payments. Every payment record, charge,
  reference number and status lives upstream.
- **Client id is always 5.** `MasterClient.Id = 5` (`backend/TamilPay.Api/MasterClient.cs`).
  Every upstream call uses it. The `clientId` the browser sends in query strings or bodies is
  accepted but **ignored**.
- **Upstream envelope.** Every upstream response looks like:
  ```json
  { "status": "success", "statusCode": 200, "message": "…", "data": <payload> }
  ```
  `status == "success"` is success; anything else is a failure and its `message` is shown to the user.
- **Error shape from our backend.**
  - Upstream failure → HTTP **502** with a ProblemDetails body: `{ "title": …, "status": 502, "detail": "<upstream message>" }`.
  - Our own validation → HTTP 400 / 404 with `{ "message": "…" }`.
  - The frontend shows `detail` first, then `message`, then `Request failed (<code>)`.
- **Authentication.** There is no server-side authentication on these endpoints (no `[Authorize]`,
  no auth middleware). "Logged in" is a browser-side state (see §2.1). Treat the backend as
  reachable by anyone who can reach the site. `GET /api/pg/status` is public on purpose (§4.4).
  Do not put anything secret in these responses; the code already omits charges, GST and vendor keys
  from the public status response.

### Configuration that affects PG

| Setting | Where | Meaning |
|---|---|---|
| `RemoteApi:BaseUrl` | `appsettings.json` | `http://172.198.160.73/clients/api/` — base for every upstream call |
| `Pg:RedirectUrl` | `appsettings.json` | Host the payer is sent back to after paying, e.g. `https://tamilpay.in`. **Empty** = use the request's own origin, so the same build works on any host |

---

## 2. User experience — the full flow, click by click

There are three audiences:

1. **Retailer** — signs in, generates a payment link for a card holder, shares it.
2. **Payer** (the card holder) — opens the link, pays on the gateway, is sent back.
3. **Admin** — sets up groups, categories, gateways and charges, and reviews every retailer's links.

### 2.1 Retailer: sign in and open PG

| Step | What the user does | What happens inside |
|---|---|---|
| 1 | Opens the site and signs in | `POST /api/auth/login` → upstream `wallet/Login`. The returned user is kept in the browser (session/local storage). Its `walletId` is **often 0** because the customer record doesn't carry it |
| 2 | On **Home**, clicks the **PG** tile | Page changes to `/pg` (`PgPaymentPage`). Browser URL changes with the History API, no reload |
| 3 | Page loads (spinner "Loading…") | If `user.walletId` is 0 the page first calls `GET /api/customers/{userId}/wallet` and takes the wallet's `Id`. If none is linked it shows *"No wallet is linked to this account yet."* |
| 4 | — | With a wallet id, calls `GET /api/pg/by-wallet?clientId=5&walletId={walletId}` (§4.1) |

If the wallet has no gateways mapped, the list is empty and the page says
*"No payment gateways are set up for your wallet yet."* (The backend deliberately turns the
upstream message "No PGs mapped…" into an empty list, not an error.)

### 2.2 Retailer: pick a gateway (left half of the page)

The PG page has a dark **sidebar** on the left and a **50/50 split** in the content area: gateway list
on the left half, payment form on the right half.

| Step | Click | Result |
|---|---|---|
| 1 | Nothing yet | The first **Group** in the sidebar is selected automatically, and the first **Settlement** tab inside it |
| 2 | A **Group** in the sidebar (for example `PG002`) | That group's settlements appear as tabs. First settlement is auto-selected. Any previously selected PG and typed values are cleared |
| 3 | A **Settlement** tab (for example `Instant`, `T+1`) | The list below ("Category") shows every PG under that settlement name. Selection is cleared |
| 4 | **Select** on a PG row | The right half shows the payment form for that PG. Amount, name and card fields are emptied and any earlier error or result is cleared |
| — | **Back to Home** (bottom of sidebar) | Returns to `/` |

How the screen is built from the data: `Pg/SelectByWallet` returns **one flat row per
Group × Settlement × PG**. The page groups it client-side: unique `groupId` → sidebar; rows of the chosen
group, unique by `settlementName` → tabs (grouped by **name**, not id, because the same settlement type
has a different `settlementId` per PG); rows of the chosen settlement name → the PG list.

Each PG row shows: **PG name** and category (subtitle), **Max** (`maxLimit`, or "No limit" when null),
and **%** (the charge: `12.5%` for `PERCENT`, `₹10.00` otherwise).

### 2.3 Retailer: fill the form and generate the link (right half)

Fields, in order:

| Field | Rules enforced as the user types / on click |
|---|---|
| **Amount** | Only digits and `.` are accepted. A keystroke that would make the value exceed `maxLimit` is **rejected** (not clamped). `maxLimit = null` means no cap |
| **Customer Name** | Free text. Must not be blank |
| **Card Number (Last Four Digit)** | Digits only, exactly 4 |

Click **Generate Link**. Checks run in this order and the first failure shows a red message
under the fields (no network call is made):

1. Amount empty, not a number, or ≤ 0 → *"Enter an amount."* (or *"Enter an amount up to ₹{max}."* when a cap exists)
2. Name blank → *"Enter the customer name."*
3. Card not 4 digits → *"Enter the last 4 digits of the card."*

If valid, the button shows **Generating…** and is disabled, and the page calls
`POST /api/pg/generate-link` (§4.2). Then:

- **Failure:** the red message shows the upstream/validation text (for example the 502 `detail`).
- **Success:**
  1. A **"Link generated"** popup opens.
  2. The browser **remembers the reference number** in `localStorage` key `tamilpay_last_pg_ref`.
  3. The signed-in user is **stashed** in `localStorage` key `tamilpay_pay_return` for 30 minutes
     (why: the gateway opens in a new tab, which would not inherit a sign-in held in `sessionStorage`).

### 2.4 Retailer: the "Link generated" popup

Shows a card with: **Ref No.**, **Amount**, **Charges**, **Credit to Bank** (`amount − charges`),
**Status** (normally `PENDING`), and the long gateway link.

| Button | What it does |
|---|---|
| **Copy** | Copies `pgLink` to the clipboard; the button reads "Copied" for 1.5 s |
| **Share** | Opens the device share sheet with title *TamilPay Payment Link*. If the browser can't share, it copies instead |
| **Browse** | Opens `pgLink` in a new tab (`noopener,noreferrer`) |
| **Check payment status** (text link) | Opens `/pg-status?reference_id={refNo}` in a new tab (§2.6) |
| ✕ | Closes the popup |

The retailer normally sends the link to the card holder, or opens it themselves.

### 2.5 Payer: pays on the gateway and comes back

1. The payer opens `pgLink` (`https://nammapayments.in/v5bc_web/redirectToPg.aspx?referenceNumber=<ref>`).
   They enter their card details **on the gateway**. TamilPay never sees or stores card numbers
   (only the last four that the retailer typed).
2. When done, the gateway sends the payer to the `redirectURL` TamilPay gave it when the link was
   created: `{host}/wallet-settlement?t={token}`. The token is a random value (see §4.2), **not** the
   reference number, because the reference doesn't exist until the link does.
3. What the payer sees depends on the device:

| Situation | What loads |
|---|---|
| **Same browser, still signed in** (retailer paid themselves) | **Wallet ledger** (`/wallet-settlement`) with a **result banner** on top (§2.7). The `?t=` is removed from the address bar so a refresh doesn't repeat it |
| **New tab, retailer's sign-in was in `sessionStorage`** | The app takes the stashed user from `tamilpay_pay_return` (only if the URL has `?t=`, only once, only within 30 min), signs them back in, then shows the ledger and banner |
| **Nobody signed in** (payer's own phone) | **Public status page** `/pg-status` (§2.6). The ledger is not theirs to see, but their payment result is |

### 2.6 Public payment status page (`/pg-status`)

Reachable with no sign-in. It shows the outcome, the amount, the UTR and the card
(•••• last 4) and the reference number. It never shows charges, GST, partner charges or any wallet balance.

How it finds the payment, in priority order:

1. `?t=<token>` in the URL (from the gateway redirect). A token replaces any reference.
2. A reference in the URL under any of these names: `reference_id`, `referenceId`, `referenceNumber`, `ref`, `refNo`, `reference`, `ref_id`.
3. The last reference generated **in this browser** (`tamilpay_last_pg_ref`).
4. Otherwise it asks the payer to type the reference.

What the screen does:

| State | Screen |
|---|---|
| Checking | Clock icon, "Checking payment…", "One moment." |
| **success** | Green check, "Payment successful", rows: Amount debited, UTR, Card, Reference |
| **failed** | Red cross, "Payment failed", message *"Payment failed. No amount was debited."* |
| **pending** | Clock, "Payment pending", a **Check again** button (spinner while loading) |
| Error / not found | Message from the server, plus a **reference-number box and "Check status"** button. Submitting stores the typed reference, drops any token, and checks again |

**Automatic polling.** While the outcome is `pending`, the page re-checks every **6 seconds**,
up to **20 checks** (about 2 minutes), because the gateway often sends the payer back a moment
before the vendor has settled. It stops on success/failed or after 20 tries; **Check again** forces
one more check. A **Go to wallet ledger** link is at the bottom.

### 2.7 Signed-in result banner on the ledger

On `/wallet-settlement?t=…` for a signed-in user, `PgResultBanner` shows the same status, plus
**Balance after credit** (the wallet balance right after this payment was credited — shown only to the
signed-in owner, never on the public page). It can be dismissed with ✕. On the first **success** it
triggers a reload of the balance and the ledger so the credit appears immediately. It polls the same way as §2.6.

### 2.8 Retailer: PG Reports

**Reports → PG Reports** (retailer) lists the retailer's own links for a date range:
`GET /api/pg/transfer-report` (§4.5). Admin logins also see **Partner Charges** and **Profit** columns;
retailers don't. A date-range picker and quick ranges (Today, Yesterday, Last 7/30 days, This month…)
are at the top, plus **Export Excel** (a real `.xlsx` in which references, UTRs and card numbers are
kept as exact text).

**Refresh on pending rows.** Only rows whose status is `PENDING` **and** that have a reference number
get a refresh button. Clicking it calls `GET /api/pg/status?referenceId={pipeRefNumber}` (§4.4) which
asks the bank. If the bank says success/failed the row's status is updated on screen, with the
UTR/closing balance where the bank returned them. Rows that aren't pending have no button.

### 2.9 Admin: PG Reports and PG Settings

**Admin → PG Report** (`/reports/admin-pg`) lists every retailer's links:
`GET /api/admin/pg-report` (§4.6). It has the same refresh button on pending rows and the same Excel export,
plus the retailer's name and mobile.

**Admin → PG Settings** (`/settings`) has a sidebar with three sections. Each is a list with **Add**, **Edit**
and **Delete** (a confirm box appears before deleting):

| Section | Fields | Calls |
|---|---|---|
| **PG Groups** | Group name (≤150), Logo URL (optional), Display order, Active | §5.1 |
| **PG Categories** | Category name (≤150), Display order, Active | §5.2 |
| **Payment Gateway** | Group, Category, PG name (≤150), Description, Display order, Active; and per-PG **Settlements** (add/edit/delete inside the PG) | §5.3, §5.4 |

On the **Payment Gateway** list there are two buttons that publish the setup to retailers:

- **Apply to All** → confirm box → `POST /api/pgsettings/sync-to-retailers` (§5.5) → alert *"Applied to every retailer."*
- **Apply to Individual** → opens a retailer picker (list from `GET /api/customers/retailers`), choose one → `POST /api/pgsettings/apply-to-wallet?walletId=…` (§5.6) → alert *"Applied to that retailer."*

Why those exist: editing a PG, a charge or a settlement does **not** change what retailers see by itself.
A retailer only sees the gateways *mapped to their wallet*. "Apply" is what pushes the current setup into
their wallet mapping, which is what `Pg/SelectByWallet` reads.

### 2.10 The flow in one picture

```
Retailer                       TamilPay.Api                          Upstream / Gateway
────────                       ────────────                          ──────────────────
Home ▸ PG tile
  │  (walletId 0?) GET /api/customers/{id}/wallet ─────────────────► wallet/SelectByCustomerId
  │  GET /api/pg/by-wallet ───────────────────────────────────────► Pg/SelectByWallet
  │  pick Group ▸ Settlement ▸ PG ▸ Select
  │  type Amount, Name, Card last 4
  │  POST /api/pg/generate-link ──── token=GUID; redirect=…?t=token ► pg/GenerateLink
  │            ◄── {pgLink, refNo, amount, charges, …}; remember token→refNo for 24 h
  │  Copy / Share / Browse
Payer
  │  opens pgLink ──────────────────────────────────────────────────► gateway page (pays here)
  │  gateway redirects → {host}/wallet-settlement?t=token
  │  GET /api/pg/status?token=… ──── token→refNo, check report, ───► pg/TransferReport
  │                                  then ask vendor ──────────────► Pg/CheckStatus
  ◄  success / failed / pending (polls every 6 s, max 20×)
```

---

## 3. Upstream API map (what the backend calls)

All upstream calls are `POST {RemoteApi:BaseUrl}{path}` with a JSON body, and return the envelope in §1.

| Upstream path | Used by (our endpoint) | Body sent by the backend |
|---|---|---|
| `Pg/SelectByWallet` | `GET /api/pg/by-wallet` | `{ Client_ID: 5, walletId }` |
| `pg/GenerateLink` | `POST /api/pg/generate-link` | `{ Client_ID: 5, walletId, pgCode, custName, card_last_4_digit, amount, redirectURL }` |
| `pg/TransferReport` | `GET /api/pg/transfer-report`, and inside `GET /api/pg/status` | `{ Client_ID: 5, walletId, fromDate, toDate }` |
| `Pg/CheckStatus` | `GET /api/pg/status` | `{ reference_id }` (**no Client_ID** — see the note in §4.4) |
| `Admin/PgTransferReport` | `GET /api/admin/pg-report` | `{ Client_ID: 5, fromDate, toDate }` |
| `PgSettings/Group/SelectAll`, `/Insert`, `/Update`, `/Delete` | `/api/pgsettings/groups` | see §5.1 |
| `PgSettings/Category/SelectAll`, `/Insert`, `/Update`, `/Delete` | `/api/pgsettings/categories` | see §5.2 |
| `PgSettings/Pg/SelectAll`, `/Insert`, `/Update`, `/Delete` | `/api/pgsettings/pgs` | see §5.3 |
| `PgSettings/Settlement/Insert`, `/Update`, `/Delete` | `/api/pgsettings/settlements` | see §5.4 |
| `PgSettings/WalletMapping/SyncToRetailers` | `POST /api/pgsettings/sync-to-retailers` | `{ Client_ID: 5 }` |
| `PgSettings/WalletMapping/ApplyToWallet` | `POST /api/pgsettings/apply-to-wallet` | `{ Client_ID: 5, walletId }` |
| `wallet/SelectByCustomerId` | `GET /api/customers/{id}/wallet` | `{ Client_ID: 5, CustomerId }` |

Field names in `Client_ID` are exactly as the upstream expects (capital C, underscore).

---

## 4. Payment APIs (our backend) — request and response

Base: the site's own host, for example `https://tamilpay.in` or `http://localhost:5174` in development
(the Vite dev server proxies `/api` to the backend on `5109`).

### 4.1 List the gateways mapped to a wallet

`GET /api/pg/by-wallet?clientId=5&walletId={walletId}`

| Param | Type | Notes |
|---|---|---|
| `clientId` | int | Ignored. Always 5 upstream |
| `walletId` | int | The retailer's wallet. Each retailer only sees PGs mapped to their own wallet |

Upstream: `Pg/SelectByWallet` with `{ "Client_ID": 5, "walletId": 56 }`.

**200 — live example** (trimmed to 2 of the rows):
```json
[
  {
    "groupId": 15, "groupName": "PG002",
    "settlementId": 21, "settlementName": "Instant", "settlementDays": 0,
    "pgKey": "pg0032",
    "partnerChargeType": "PERCENT", "partnerChargeValue": 1.2500, "partnerMinCharge": 0.00,
    "chargeType": "PERCENT", "chargeValue": 1.5000, "minCharge": 10.00,
    "maxLimit": 49999.00,
    "categoryId": 10, "categoryName": "LAW EDUCATION",
    "pgId": 11, "pgName": "Freecharge", "description": "educational payments"
  },
  {
    "groupId": 15, "groupName": "PG002",
    "settlementId": 23, "settlementName": "T+1", "settlementDays": 0,
    "pgKey": "pg0022",
    "partnerChargeType": "PERCENT", "partnerChargeValue": 1.1000, "partnerMinCharge": 0.00,
    "chargeType": "PERCENT", "chargeValue": 1.2500, "minCharge": 10.00,
    "maxLimit": 49999.00,
    "categoryId": 10, "categoryName": "LAW EDUCATION",
    "pgId": 11, "pgName": "Freecharge", "description": "educational payments"
  }
]
```

| Field | Meaning |
|---|---|
| `groupId`, `groupName` | The PG group (sidebar entry) |
| `settlementId`, `settlementName`, `settlementDays` | The settlement option (tab). `Instant`, `T+1`… `settlementDays` is how long until money settles |
| `pgKey` | **The code you must send as `pgCode` when generating a link.** It's different per settlement of the same PG (above: `pg0032` for Instant, `pg0022` for T+1) |
| `partnerChargeType/Value/MinCharge` | What TamilPay pays the gateway partner (internal; the PG page does not display it) |
| `chargeType`, `chargeValue`, `minCharge` | What the retailer is charged. `PERCENT` → value is a percent; otherwise a flat rupee amount. `minCharge` is the floor |
| `maxLimit` | Largest allowed amount per link. **`null` = no cap** (not zero) |
| `categoryId`, `categoryName` | The PG's category |
| `pgId`, `pgName`, `description` | The gateway |

Every charge field can be `null` upstream. "No PGs mapped" upstream comes back as `200 []`.
Other failures → `502`.

### 4.2 Generate a payment link

`POST /api/pg/generate-link` — `Content-Type: application/json`

**Request body**
```json
{
  "clientId": 5,
  "walletId": 56,
  "pgCode": "pg0032",
  "customerName": "Rohan Kumar",
  "cardLast4": "1111",
  "amount": 5000
}
```

| Field | Type | Required | Rules |
|---|---|---|---|
| `clientId` | int | yes (binder requires it) | Value ignored — always 5 upstream |
| `walletId` | int | yes | The retailer's wallet |
| `pgCode` | string | yes | The `pgKey` of the chosen row from §4.1 |
| `customerName` | string | yes | The card holder's name; shown in reports as the payer |
| `cardLast4` | string | yes | Max length 4. The page sends exactly 4 digits |
| `amount` | decimal | yes | Must be within the PG's `maxLimit` (the page enforces it; the backend does not) |

**What the backend does**
1. Creates a random token: `Guid.NewGuid().ToString("N")` (32 hex characters).
2. Calls upstream `pg/GenerateLink` with:
   ```json
   {
     "Client_ID": 5,
     "walletId": 56,
     "pgCode": "pg0032",
     "custName": "Rohan Kumar",
     "card_last_4_digit": "1111",
     "amount": 5000,
     "redirectURL": "https://tamilpay.in/wallet-settlement?t=<token>"
   }
   ```
   The host in `redirectURL` is `Pg:RedirectUrl` when set, else the request's own scheme + host.
3. Finds the reference: `data.refNo`, or if empty the `referenceNumber` query value inside `data.pgLink`.
4. Stores **token → reference** in memory for **24 hours**, and returns upstream `data`.

**200 — shape** (every field is returned as the upstream gave it):
```json
{
  "id": 1742,
  "pgLink": "https://nammapayments.in/v5bc_web/redirectToPg.aspx?referenceNumber=NPPG000650",
  "refNo": "NPPG000650",
  "amount": 5000.00,
  "charges": 75.00,
  "partnerCharges": 62.50,
  "profit": 12.50,
  "amountCreditToBank": "4925.00",
  "weAreChargingyou": "75.00",
  "status": "PENDING"
}
```
Example values are illustrative. Field names and types are exactly those in `PgGenerateLinkResult`.
The popup shows only `refNo`, `amount`, `charges`, `amount − charges`, `status` and `pgLink`.

**Errors:** upstream refusal (for example a bad `pgCode`, amount over the limit, wallet without that PG)
→ `502` with `detail` = upstream message.

> The in-memory token cache is cleared whenever the backend restarts or the app pool recycles. A
> payer returning after that sees *"This link has expired. Enter your reference number to check the payment."*
> and can type the reference. The payment itself is not affected.

### 4.3 Reference number formats

Both exist in the data today:
- Older links: a **21-digit number**, usually starting with `0` (for example `061026162056148730347`).
- Links created from about 16:25 on 6 Oct 2026: `NPPG` followed by digits (for example `NPPG000648`).
- Failed links can have **no reference**.

The reference shown in reports (`pipeRefNumber`) is identical to the `referenceNumber` inside that row's
`pgLink`.

### 4.4 Payment status (public)

`GET /api/pg/status?token={token}` **or** `GET /api/pg/status?referenceId={reference}`

| Param | Rules |
|---|---|
| `token` | The value from the gateway redirect. Used only when `referenceId` is empty. If it isn't in the cache → `404` |
| `referenceId` | Must match `^[A-Za-z0-9_-]{6,64}$`, otherwise `400` |

**Steps inside**
1. Token → reference lookup (from the cache filled in §4.2).
2. Validate the reference.
3. Call upstream `pg/TransferReport` for **client 5, all wallets (`walletId: 0`), last 365 days to tomorrow**,
   and find the row whose `pipeRefNumber` equals the reference (case-insensitive). If none → `404`.
   **This is the safety check.** `Pg/CheckStatus` itself is not scoped to a client, so without this step anyone
   could confirm another client's payment by guessing a reference.
4. Call upstream `Pg/CheckStatus` with `{ "reference_id": "<reference>" }`.
5. Build the answer.

**Outcome rules**

| Condition | `outcome` | `message` |
|---|---|---|
| `credited == true`, or vendor status in `SUCCESS, SUCCESSFUL, SUCCEEDED, COMPLETED, PAID, CAPTURED` | `success` | `Payment successful.` |
| vendor status in `FAILED, FAILURE, DECLINED, CANCELLED, CANCELED, REJECTED, EXPIRED` | `failed` | `Payment failed. No amount was debited.` |
| any other status | `pending` | `Payment is still being processed.` |
| `Pg/CheckStatus` itself fails (for example "Transaction not found in vendor": link made, payer never paid) | `pending` | `This payment has not been completed yet.` |

**200 — live examples**

Paid:
```json
{ "referenceId": "NPPG000648", "outcome": "success", "message": "Payment successful.",
  "amount": 8500, "utr": "T08198279434416", "cardNumber": "7794", "closingBalance": 47152.50 }
```
Failed:
```json
{ "referenceId": "NPPG000649", "outcome": "failed", "message": "Payment failed. No amount was debited.",
  "amount": 47000, "utr": null, "cardNumber": "3000", "closingBalance": null }
```

| Field | Meaning |
|---|---|
| `referenceId` | The reference that was checked |
| `outcome` | `success`, `failed` or `pending` |
| `message` | Text to show the payer |
| `amount` | The vendor's amount, else the report's amount |
| `utr` | Bank reference of the payment, when there is one |
| `cardNumber` | Last four digits only, from the report row |
| `closingBalance` | Wallet balance right after this payment was credited; `null` until credited |

**Never returned:** charges, GST, partner charges, profit, vendor key. The `closingBalance` is in the
JSON; the public status page chooses not to display it, the signed-in banner does.

**Errors — live examples**
```
400  { "message": "Enter a valid reference number." }
404  { "message": "This link has expired. Enter your reference number to check the payment." }
404  { "message": "We couldn't find a payment with that reference number." }
502  ProblemDetails (the report lookup failed upstream)
```

**Upstream `Pg/CheckStatus` data** (internal to the backend; fields it reads):
```json
{ "reference_id": "NPPG000648", "vendorStatus": "SUCCESS", "utr": "T08198279434416",
  "amount": 8500.00, "credited": true, "walletClosingBalance": 47152.50 }
```
It works for **PG references only**. An IMPS transfer reference returns "Transaction not found in vendor".

### 4.5 Retailer PG report

`GET /api/pg/transfer-report?clientId=5&walletId={walletId}&fromDate=2026-10-01&toDate=2026-10-07`

Dates are `yyyy-MM-dd`. Upstream `pg/TransferReport` with `{ "Client_ID": 5, walletId, fromDate, toDate }`.
Returns `200` with an array (empty array when there is nothing), or `502`.

Row fields (`PgTransferReportRow`):

| Field | Type | Meaning |
|---|---|---|
| `id` | int | Payment link id |
| `createdTime` | datetime | When the link was created |
| `Client_ID` | int | Always 5 |
| `walletId` | int | The retailer's wallet |
| `username` | string? | Retailer login (mobile number) |
| `customerName` | string | The wallet owner (the retailer) — same on every row of a wallet |
| `payerName` | string | Who this link was made for — this is the "Customer" in the table |
| `cardNumber` | string | Last four digits |
| `pgCode`, `pgId`, `pgName` | | The gateway used |
| `settlementId`, `settlementName` | | The settlement chosen |
| `amount` | decimal | Amount of the link |
| `charges` | decimal | Charged to the retailer |
| `partnerCharges`, `profit` | decimal | Internal margin. The page hides these two for retailers |
| `status` | string | `PENDING`, `SUCCESS`, `FAILED` |
| `pipeRefNumber` | string? | The reference number (§4.3) |
| `pgLink` | string? | The payer's gateway link |
| `walletCreditedTime` | datetime? | When the wallet was credited |
| `walletClosingBalance` | decimal? | Wallet balance right after the credit |

### 4.6 Admin PG report

`GET /api/admin/pg-report?clientId=5&fromDate=2026-10-06&toDate=2026-10-07`

Upstream `Admin/PgTransferReport` with `{ "Client_ID": 5, fromDate, toDate }`. All retailers of client 5.

**200 — live example** (one row):
```json
{
  "id": 1740, "createdTime": "2026-10-07T21:36:48.67",
  "walletId": 56, "username": "7975646117",
  "retailerName": "Vinay B D", "MOBILE_NUMBER": "7975646117",
  "payerName": "BASAVARAJA M", "cardNumber": "7794",
  "pgCode": "pg0032", "pgName": "Freecharge", "settlementName": "Instant",
  "amount": 8500.00, "charges": 127.50, "partnerCharges": 106.25, "profit": 21.25,
  "status": "SUCCESS",
  "pipeRefNumber": "NPPG000648",
  "pgLink": "https://nammapayments.in/v5bc_web/redirectToPg.aspx?referenceNumber=NPPG000648",
  "walletCreditedTime": "2026-10-07T21:38:23.273", "walletClosingBalance": 47152.50
}
```
Note the capitalised `MOBILE_NUMBER` key; the other fields are camelCase. The admin report does not
have `customerName`, `pgId` or `settlementId`, and it has no shop name. The admin PG report screen shows
ID, Time, PG, Retailer (name and mobile), Customer, Card, Amount, Charges, Partner Charges, Profit, Status,
Credited and Closing Balance.

Numbers worth knowing: here `charges 127.50 = partnerCharges 106.25 + profit 21.25`, and
`amount − charges = 8372.50` is what is credited.

---

## 5. PG Settings APIs (admin) — request and response

Base `/api/pgsettings`. Every call sends `Client_ID: 5` upstream regardless of the `clientId` in the request.
The page still sends `clientId` because the controllers' models require the field.

For Insert and Update, the upstream returns only a number in `data` (not the saved row). The backend
therefore **fetches the list again and returns the saved item**; if it can't find it, it returns `204 No Content`.

### 5.1 Groups

| Action | Request | Upstream call |
|---|---|---|
| List | `GET /api/pgsettings/groups?clientId=5` | `PgSettings/Group/SelectAll` `{ Client_ID: 5 }` |
| Create | `POST /api/pgsettings/groups` | `PgSettings/Group/Insert` |
| Update | `PUT /api/pgsettings/groups/{id}` | `PgSettings/Group/Update` |
| Delete | `DELETE /api/pgsettings/groups/{id}?clientId=5` → `204` | `PgSettings/Group/Delete` `{ Id, Client_ID: 5 }` |

Create / update body:
```json
{ "clientId": 5, "groupName": "PG002", "logoUrl": "", "displayOrder": 1, "isActive": true }
```
`groupName` ≤150 chars, required; `displayOrder` required; `logoUrl` optional (sent upstream as `""` when missing);
`isActive` defaults to `true` (used by update).

**List — live example**
```json
[ { "id": 15, "Client_ID": 5, "groupName": "PG002", "logoUrl": "", "displayOrder": 1,
    "isActive": true, "createdTime": "2026-09-29T15:22:58.62" } ]
```

### 5.2 Categories

| Action | Request | Upstream |
|---|---|---|
| List | `GET /api/pgsettings/categories?clientId=5` | `PgSettings/Category/SelectAll` |
| Create | `POST /api/pgsettings/categories` | `PgSettings/Category/Insert` |
| Update | `PUT /api/pgsettings/categories/{id}` | `PgSettings/Category/Update` |
| Delete | `DELETE /api/pgsettings/categories/{id}?clientId=5` → `204` | `PgSettings/Category/Delete` |

Body: `{ "clientId": 5, "categoryName": "Tax", "displayOrder": 2, "isActive": true }`

**List — live example**
```json
[ { "id": 10, "Client_ID": 5, "categoryName": "LAW EDUCATION", "displayOrder": 1,
    "isActive": true, "createdTime": "0001-01-01T00:00:00" } ]
```
(A `createdTime` of `0001-01-01…` means upstream does not store one for that row.)

### 5.3 Payment gateways

| Action | Request | Upstream |
|---|---|---|
| List (with nested settlements) | `GET /api/pgsettings/pgs?clientId=5` | `PgSettings/Pg/SelectAll` |
| Create | `POST /api/pgsettings/pgs` | `PgSettings/Pg/Insert` |
| Update | `PUT /api/pgsettings/pgs/{id}` | `PgSettings/Pg/Update` |
| Delete | `DELETE /api/pgsettings/pgs/{id}?clientId=5` → `204` | `PgSettings/Pg/Delete` |

Body:
```json
{ "clientId": 5, "groupId": 15, "categoryId": 10, "pgName": "Freecharge",
  "description": "educational payments", "displayOrder": 1, "isActive": true }
```
`groupId`, `categoryId`, `pgName` (≤150), `displayOrder` required. Upstream calls this row's id `PgId`; our API
returns it as `id` (that is why the backend maps it).

**List — live example** (one PG with two settlements)
```json
[ {
  "id": 11, "Client_ID": 5, "groupId": 15, "categoryId": 10,
  "pgName": "Freecharge", "description": "educational payments",
  "displayOrder": 1, "isActive": true, "createdTime": "0001-01-01T00:00:00",
  "settlements": [
    { "settlementId": 21, "settlementName": "Instant", "settlementDays": 0, "pgKey": "pg0032",
      "partnerChargeType": "PERCENT", "partnerChargeValue": 1.2500, "partnerMinCharge": 0.00,
      "isActive": true, "chargeId": 0,
      "chargeType": "PERCENT", "chargeValue": 1.5000, "minCharge": 10.00, "chargeIsActive": false },
    { "settlementId": 23, "settlementName": "T+1", "settlementDays": 0, "pgKey": "pg0022",
      "partnerChargeType": "PERCENT", "partnerChargeValue": 1.1000, "partnerMinCharge": 0.00,
      "isActive": true, "chargeId": 0,
      "chargeType": "PERCENT", "chargeValue": 1.2500, "minCharge": 10.00, "chargeIsActive": false }
  ]
} ]
```

### 5.4 Settlements (the charges of a PG)

There is no separate list. Settlements come nested in §5.3, and after any change the page reloads the PG list.

| Action | Request | Upstream |
|---|---|---|
| Create | `POST /api/pgsettings/settlements` → `204` | `PgSettings/Settlement/Insert` |
| Update | `PUT /api/pgsettings/settlements/{id}` → `204` | `PgSettings/Settlement/Update` |
| Delete | `DELETE /api/pgsettings/settlements/{id}?clientId=5` → `204` | `PgSettings/Settlement/Delete` |

Body:
```json
{
  "clientId": 5, "pgId": 11,
  "settlementName": "Instant", "settlementDays": 0, "pgKey": "pg0032",
  "partnerChargeType": "PERCENT", "partnerChargeValue": 1.25, "partnerMinCharge": 0,
  "chargeType": "PERCENT", "chargeValue": 1.5, "minCharge": 10,
  "isActive": true
}
```
Required: `settlementName` (≤150), `settlementDays`, `partnerChargeType`, `partnerChargeValue`,
`partnerMinCharge`, `chargeType`, `chargeValue`, `minCharge` (types default to `PERCENT`).
`pgKey` is the **gateway code retailers' links are generated with** (the `pgCode` in §4.2); it is sent upstream as `""` when missing.
`pgId` is used on create; on update/delete the settlement `{id}` in the path identifies the row.
`isActive` is used by update.

How the charge is read: `chargeType: PERCENT` + `chargeValue: 1.5` + `minCharge: 10` means 1.5% of the amount,
but never below ₹10. Example: ₹8,500 × 1.5% = ₹127.50 (matches the live report row in §4.6).

### 5.5 Apply the setup to every retailer

`POST /api/pgsettings/sync-to-retailers?clientId=5` — no body.
Upstream `PgSettings/WalletMapping/SyncToRetailers` `{ "Client_ID": 5 }`.
**200** `{ "message": "<upstream message>" }`.

### 5.6 Apply the setup to one retailer

`POST /api/pgsettings/apply-to-wallet?clientId=5&walletId={walletId}` — no body.
Upstream `PgSettings/WalletMapping/ApplyToWallet` `{ "Client_ID": 5, "walletId": … }`.
**200** `{ "message": "<upstream message>" }`.

> Run an Apply after you add or change a PG or a charge. Until then retailers keep seeing the old mapping.

---

## 6. Supporting APIs the PG screens use

| Endpoint | Used for | Notes |
|---|---|---|
| `POST /api/auth/login` | Sign in | Upstream `wallet/Login` |
| `GET /api/customers/{id}/wallet` | Resolve the real wallet id when `user.walletId` is 0 | Upstream `wallet/SelectByCustomerId` with `{ Client_ID: 5, CustomerId }`. `404` when no wallet |
| `GET /api/customers/retailers` | "Apply to Individual" picker | |
| `GET /api/transactions/ledger?walletId=&fromDate=&toDate=` | Wallet ledger under the result banner | |

---

## 7. Where each thing lives in the code

| Thing | File |
|---|---|
| Customer PG endpoints (by-wallet, generate-link, status, transfer-report) | `backend/TamilPay.Api/Controllers/PgController.cs` |
| Admin PG settings endpoints | `backend/TamilPay.Api/Controllers/PgSettingsController.cs` |
| Admin PG report | `backend/TamilPay.Api/Controllers/AdminController.cs` (`pg-report`) |
| Models | `backend/TamilPay.Api/Models/Pg*.cs`, `AdminPgReportRow.cs` |
| Upstream caller and envelope | `backend/TamilPay.Api/Services/RemoteApiClient.cs`, `Models/RemoteApiEnvelope.cs` |
| Client id constant | `backend/TamilPay.Api/MasterClient.cs` |
| PG screen (groups, settlements, form, popup) | `src/pages/PgPaymentPage.jsx` |
| Public status page | `src/pages/PgStatusPage.jsx` |
| Signed-in result banner | `src/components/PgResultBanner.jsx` |
| Polling hook | `src/hooks/usePgStatus.js` (every 6 s, max 20) |
| Status text, stashed sign-in, last reference | `src/utils/pgStatus.js` |
| Admin PG Settings screens | `src/pages/PgSettingsPage.jsx` |
| Reports (PG, Admin PG, refresh on pending) | `src/pages/ReportsPage.jsx` |
| URL ↔ page map (`/pg`, `/pg-status`, `/settings`…) | `src/utils/router.js` |
| Return-from-gateway sign-in handling | `src/App.jsx` |

Browser storage keys used by the PG flow: `tamilpay_last_pg_ref` (last reference, kept until replaced) and
`tamilpay_pay_return` (stashed sign-in, 30 minutes, used once).

---

## 8. Known limits and behaviours (so nothing surprises you)

1. **Token cache is in memory.** Restarting or recycling the backend forgets all tokens; payers then type the reference. Payments are unaffected.
2. **Status lookups scan the last 365 days** of the whole client's PG report on every call, so the status call can take a moment on a large client.
3. **`Pg/CheckStatus` is for PG references only.** IMPS references answer "Transaction not found in vendor".
4. **`maxLimit` is enforced in the browser** (the keystroke is rejected). The backend forwards the amount; the upstream decides whether to refuse it.
5. **Charges are not shown to the payer anywhere**, and charges / GST / vendor key are never in the public status JSON.
6. **No server-side authentication** on the endpoints (§1). The browser decides what to show by role.
7. **A pending report row may already be decided at the bank.** Use the refresh button (§2.8) to ask the bank; a link whose payer never paid stays `PENDING`.
8. **Failed links can have no reference number**, so they have no refresh button.

# TamilPay — Static QR API

How a retailer takes a payment on a **Static QR**: what they see and click, the exact request and
response of every API, and what happens to the money.

- Everything here was read from the code in this repository (`src/` and `backend/TamilPay.Api/`).
- Examples marked **live** were captured from the running app on 9 Oct 2026 (client 5). The QR's
  address (VPA) and bank UTRs are shortened with `…`.
- Examples marked **shape** show the exact fields the code reads but were **not** captured live.
  I did not call **Get QR** (it takes a QR out of the client's pool), nor **Create request, Add QR,
  Approve or Reject** (they change data or money).
- No keys, passwords or tokens are in this file. None exist in this code path.

---

## 1. What a Static QR is

- The client owns a small pool of **QR codes**. Each one is a UPI address (VPA) that points to a real
  bank account. Today there is one: **"Basavashree Enterprises"**, charge **1%** (minimum ₹10), daily limit
  **₹15,00,000**.
- The QR holds **no amount**. A customer scans it with any UPI app (GPay, PhonePe, Paytm…), types the amount
  and pays. The money goes **straight to that bank account**, not to TamilPay's wallet.
- The retailer then tells TamilPay about the payment by creating a **collect request** with the amount and the
  bank's **UTR**. An **admin approves** it. Only then is the retailer's wallet credited, with the amount **minus
  the QR's charge**.

```
Customer's UPI app ──pays──► QR's bank account            (cash arrives at the bank, not in TamilPay)
Retailer ── Collect Request (amount + UTR) ──► Admin approves ──► Wallet credited (amount − charge)
```

---

## 2. The big picture

```
Browser (React)             TamilPay.Api (this repo)                  Upstream clients API
───────────────             ────────────────────────                  ────────────────────
Home ▸ Static QR      ──►   POST /api/qr            ───────────────►  Qr/GetNext
Create Collect Request──►   POST /api/qr/request    ───────────────►  Qr/Request/Insert
Admin ▸ QR            ──►   GET  /api/qr/all        ───────────────►  Qr/SelectAll
                      ──►   POST /api/qr/insert     ───────────────►  Qr/Insert
Admin ▸ QR Requests   ──►   GET  /api/qr/pending    ───────────────►  Qr/Request/Pending
                      ──►   POST /api/qr/approve    ───────────────►  Qr/Request/Approve
                      ──►   POST /api/qr/reject     ───────────────►  Qr/Request/Reject
                      ──►   GET  /api/qr/admin-report ─────────────►  Qr/Request/Report (whole client)
Reports ▸ QR Reports  ──►   GET  /api/qr/report     ───────────────►  Qr/Request/Report (one wallet, or 0 = all)
```

- The backend is a thin proxy. It stores nothing. The QR pool, the requests, the charges, the daily usage and the
  wallet credit all live upstream (`http://172.198.160.73/clients/api/`, from `RemoteApi:BaseUrl`).
- Every upstream call is a `POST` and returns `{ "status": "success", "statusCode": 200, "message": "…", "data": … }`.
- **Client id is always 5** (`MasterClient.Id`). The `clientId` the browser sends is ignored.
- There is **no server-side authentication** on these endpoints. "Admin only" is enforced only by which screens
  the app shows (§8).
- There is no QR-specific setting in `appsettings.json`.

### Error shapes

| Case | HTTP | Body |
|---|---|---|
| Missing/invalid input (checked by our backend) | `400` | ProblemDetails with `errors` per field (live examples in §4) |
| Get QR found nothing | `404` | `{ "message": "<upstream message>" }` (for example "No QR available or daily limit exhausted") |
| Any other upstream refusal | `502` | ProblemDetails `{ "title", "status": 502, "detail": "<upstream message>" }` |

The pages show `detail`, then `message`, then a generic line with the status code.

---

## 3. User experience — click by click

### 3.1 Retailer: take a payment and report it

| Step | What the user does | What happens inside |
|---|---|---|
| 1 | On **Home**, taps the **Static QR** tile (Pay In row; the icon flips to a RuPay-style card) | A popup "Static QR" opens and shows "Loading QR…". It calls `POST /api/qr` (§4.1) |
| 2 | Sees the QR | The page builds the scannable image **in the browser** from the VPA: `upi://pay?pa=<VPA>&pn=<QR name>&cu=INR` (no amount). The popup shows the image, the QR name, the VPA and four boxes: **Charge** (`1%` or `₹x`), **Min Charge**, **Daily Limit**, **Remaining Today** |
| 3 | Shows the QR to the customer, who scans and pays in their own UPI app | TamilPay is not involved. The bank receives the money |
| 4 | Below the QR, **Create Collect Request** | The form appears once a QR has loaded |
| 5 | Chooses **VPA** (a dropdown) | It lists only the QRs pulled **since this popup was opened** (each open pulls one QR; with one QR on file it is always the same). It is pre-selected |
| 6 | Types **Amount** | Digits and `.` only |
| 7 | Types **UTR** | The bank's payment reference, from the customer's UPI app or the bank SMS |
| 8 | Optionally types **Remarks** | Up to 200 characters |
| 9 | Taps **Submit Request** | Checks run first (below), then the page finds the wallet and calls `POST /api/qr/request` (§4.2) |

Checks in the browser, in order (the first failure shows a red message and nothing is sent):

| Check | Message |
|---|---|
| No VPA selected | *Select a VPA.* |
| Amount empty, not a number, or ≤ 0 | *Enter a valid amount.* |
| UTR blank | *Enter the UTR.* |

Then:
- The wallet id: the signed-in user's `walletId`; if that is 0 (it is for most accounts) the page calls
  `GET /api/customers/{userId}/wallet` and uses the wallet's `Id`. If there is none, *"No wallet is linked to this account yet."*
- On success an alert shows the server's message (or *"Request created."*) and the popup closes.
- On failure the red message under the form shows the reason (for example the upstream's text).
- The request is now **PENDING** until an admin acts on it. **Nothing is credited yet.**

If Get QR finds nothing (the pool is empty or the daily limit is used up), the popup shows the server's message in
red, and there is no form.

### 3.2 Admin: manage the QR codes (Admin ▸ QR)

`/qr-codes`. A table: **ID, Name, VPA, Charge, Min Charge, Daily Limit, Order, Status**, with **Refresh** and **Add New**.

**Add New** opens a form:

| Field | Rules |
|---|---|
| Name | Required, up to 100 characters |
| VPA | Required, for example `shop@ybl` |
| Charge Type | **Percentage** (`PERCENT`) or **Value** (`VALUE`) |
| Charge Value | Required (for example `1.5`) |
| Min Charge | Required (for example `5`) |
| Daily Max Limit | Required (for example `50000`) |
| Display Order | Required whole number |

If anything is empty: *"Fill in all fields."* Otherwise the page calls `POST /api/qr/insert` (§4.4), closes the popup
and reloads the table.

### 3.3 Admin: approve or reject requests (Admin ▸ QR Requests)

`/qr-requests`. Two sections and a **Refresh**:

- **Pending Approval** — requests waiting for a decision. Each row has **Approve** (✓) and **Reject** (✕).
  - **Approve** asks *"Approve this QR request?"*. On OK it calls `POST /api/qr/approve` (§4.7) and reloads. This is the
    moment the retailer's wallet is credited.
  - **Reject** opens a box that **requires a reason** (*"Enter a reason for rejecting this request."*), then calls
    `POST /api/qr/reject` (§4.8).
- **All Requests** — every request of the client from `GET /api/qr/admin-report` (§4.5): time, retailer (name, mobile), shop,
  QR, amount, charges, credit amount, UTR, status, approved time and remarks.

### 3.4 Reports

- **Reports ▸ QR Reports** (retailers see their own wallet; admins see everyone): ID, Time, Retailer, Store, Remarks,
  Amount, UTR, Status, with search, date range and Excel export. Calls `GET /api/qr/report?walletId=…` (§4.9).
  The "Store" column here is the **QR's name**, not the retailer's shop.
- **Reports ▸ Admin QR Report** (admin only): the client-wide list, with charges, credit amount, approved time and closing
  balance. The date range is applied in the browser, because the upstream report ignores dates.

---

## 4. Our endpoints — request and response

Base: the site's own host (for example `https://tamilpay.in`, or `http://localhost:5174` in development, which forwards `/api` to
the backend on `5109`).

### 4.1 Get a QR from the pool

`POST /api/qr?clientId=5` — no body. `clientId` is ignored.

- Upstream: `Qr/GetNext` with `{ "Client_ID": 5 }`.
- The upstream returns the QR as a one-element array; the backend returns **the first element**.
- This **takes the next available QR from the client's pool** and shows today's usage. The pool is finite and each QR has a
  daily limit. I did not call it to capture a live example.

**200 — shape** (field names confirmed by the code comments from a real response; values illustrative):
```json
{
  "QrId": 3, "QrName": "Basavashree Enterprises", "Vpa": "341851…@cnrb",
  "ChargeType": "PERCENT", "ChargeValue": 1.0, "MinCharge": 10.0,
  "DailyMaxLimit": 1500000.0, "DisplayOrder": 1,
  "UsedToday": 0.0, "RemainingToday": 1500000.0
}
```
There is **no image field**: the QR picture is made in the browser from `Vpa` and `QrName`.

**404** — nothing available: `{ "message": "<upstream message>" }`, for example "No QR available or daily limit exhausted". This is
a normal state, not a fault.

### 4.2 Create a collect request

`POST /api/qr/request` — `Content-Type: application/json`

```json
{
  "walletId": 56,
  "qrId": 3,
  "vpa": "341851…@cnrb",
  "amount": 20000,
  "utr": "130936458498",
  "remarks": "optional note"
}
```

| Field | Rules |
|---|---|
| `walletId` | Required. The retailer's wallet to be credited on approval |
| `qrId` | Required. The `QrId` of the QR the customer paid to |
| `vpa` | Required. That QR's VPA |
| `amount` | Required. The amount the customer paid |
| `utr` | **Required**. The bank's payment reference |
| `remarks` | Optional, up to 200 characters. Sent as `null` when blank |

Upstream `Qr/Request/Insert`:
```json
{ "Client_ID": 5, "walletId": 56, "QrId": 3, "Vpa": "341851…@cnrb", "Amount": 20000, "UTR": "130936458498", "Remarks": null }
```

**200** `{ "message": "<upstream message>", "data": <upstream data or null> }`. **502** if the upstream refuses.
The new request starts as **PENDING**.

**Live validation example** (empty body):
```
400  { "title": "One or more validation errors occurred.", "status": 400,
       "errors": { "Utr": ["The Utr field is required."], "Vpa": ["The Vpa field is required."] } }
```

Our backend does **not** check that the `utr` is real, that it was not used before, that the amount fits the QR's daily limit, or that
`walletId` belongs to the caller. Whatever the upstream does about those is not visible here (§8).

### 4.3 List all QR codes (the Admin ▸ QR table)

`GET /api/qr/all?clientId=5` → upstream `Qr/SelectAll` `{ "Client_ID": 5 }`. Returns the rows as raw JSON.

**200 — live**
```json
[ { "Id": 3, "Client_ID": 5, "QrName": "Basavashree Enterprises", "Vpa": "341851…@cnrb",
    "ChargeType": "PERCENT", "ChargeValue": 1.0000, "MinCharge": 10.00, "DailyMaxLimit": 1500000.00,
    "DisplayOrder": 1, "isActive": true, "createdTime": "2026-10-03T12:45:07.247",
    "UsedToday": 0.00, "RemainingToday": 1500000.00 } ]
```
Note the capital-letter keys (`Id`, `QrName`, `Vpa`…) and the lowercase `isActive` and `createdTime`.

### 4.4 Add a QR code

`POST /api/qr/insert` — admin screen.

```json
{ "qrName": "QR 1", "vpa": "shop@ybl", "chargeType": "PERCENT", "chargeValue": 1.5,
  "minCharge": 5, "dailyMaxLimit": 50000, "displayOrder": 1 }
```

| Field | Rules |
|---|---|
| `qrName` | Required, up to 100 characters |
| `vpa` | Required |
| `chargeType` | Required. The screen offers `PERCENT` or `VALUE` |
| `chargeValue`, `minCharge`, `dailyMaxLimit` | Required numbers |
| `displayOrder` | Required whole number |

Upstream `Qr/Insert` with the same fields plus `Client_ID: 5`. **200** `{ "message", "data" }`; **502** on refusal. Missing
fields give a `400` (live: *"The Vpa field is required."* and so on).

### 4.5 All requests, client-wide (with the shop)

`GET /api/qr/admin-report` → upstream `Qr/Request/Report` with just `{ "Client_ID": 5 }`. Dates are ignored by the upstream.
The backend adds **`storeName`** (the retailer's shop) to each row from the wallet-owner directory (cached 10 minutes).

**200 — live** (one approved request; UTR shortened):
```json
{
  "Id": 29, "createdTime": "2026-10-08T17:21:21.307",
  "walletId": 47, "username": "9010007142", "retailerName": "Pravinkumar",
  "QrId": 3, "QrName": "Basavashree Enterprises", "Vpa": "341851…@cnrb",
  "Amount": 20000, "charges": 200, "creditAmount": 19800,
  "UTR": "13093645…", "status": "APPROVED",
  "approvedTime": "2026-10-08T17:30:01.04", "walletClosingBalance": 48901.12,
  "remarks": null, "storeName": "Pravin Traders"
}
```

| Field | Meaning |
|---|---|
| `Id` | Request id (capital `I`) |
| `createdTime` | When the retailer submitted it |
| `walletId`, `username`, `retailerName`, `storeName` | Who asked (username is the retailer's mobile) and their shop |
| `QrId`, `QrName`, `Vpa` | The QR the customer paid to |
| `Amount` | The amount the retailer reported |
| `charges` | The QR's charge: `PERCENT` of the amount, but never below `MinCharge` |
| `creditAmount` | What the wallet gets: `Amount − charges` |
| `UTR` | The bank reference the retailer typed |
| `status` | `PENDING`, `APPROVED` or `REJECTED` |
| `approvedTime` | When an admin approved **or rejected** it |
| `walletClosingBalance` | The wallet balance right after the credit. `null` if rejected |
| `remarks` | On the rows seen, set only on a **rejected** request (the rejection reason) |

On 9 Oct the client had **23 requests: 21 APPROVED (₹6,99,097.85 in total, credited ₹6,92,088.87, charges ₹7,008.98) and 2 REJECTED**.

### 4.6 Pending requests

`GET /api/qr/pending` → upstream `Qr/Request/Pending` `{ "Client_ID": 5 }`, with `storeName` added. Same row shape as §4.5
(status `PENDING`). **Live:** `[]` (nothing waiting).

### 4.7 Approve a request

`POST /api/qr/approve` `{ "id": 29 }` → upstream `Qr/Request/Approve` with `{ "Id": 29, "Client_ID": 5 }`.
**200** `{ "message": "<upstream message>" }`. **This credits the retailer's wallet with `creditAmount`.** **502** on refusal.

### 4.8 Reject a request

`POST /api/qr/reject` `{ "id": 29, "remarks": "UTR not found" }` → upstream `Qr/Request/Reject` with
`{ "Id": 29, "Client_ID": 5, "remarks": "UTR not found" }`. **200** `{ "message" }`. `remarks` is **required**.

**Live validation example** (`{ "id": 1 }` with no remarks):
```
400  { "errors": { "Remarks": ["The Remarks field is required."] } }
```
A live rejected row: request #12, ₹500, charges ₹10, credit ₹490, status `REJECTED`, remarks `"test"`.

### 4.9 Report for one wallet (or everyone)

`GET /api/qr/report?walletId=56` → upstream `Qr/Request/Report` with `{ "Client_ID": 5, "walletId": 56 }`.
`walletId = 0` means every wallet on the client (what admins use). Returns raw rows in the same shape as §4.5, but **without**
`storeName`. **Live:** `[]` for wallet 56 (that retailer has no QR requests).

---

## 5. How the money works

Example from the live data (request #29): the customer pays **₹20,000** to the QR.

| Step | What happens | Amount |
|---|---|---|
| 1 | Customer pays by UPI. The QR's bank account receives it | ₹20,000 (the bank may show slightly less after its own UPI fee) |
| 2 | Retailer submits the request: amount ₹20,000 + UTR | Nothing credited yet |
| 3 | Admin approves | The wallet is credited **₹19,800** (charge ₹200 = 1% of ₹20,000) |

- **Charge rule:** `PERCENT` → `amount × value / 100`; `VALUE` → a flat rupee amount; and never below **Min Charge**. Examples
  from the live data: ₹500 → charge ₹10 (1% is ₹5, so the minimum applies); ₹14,650 → ₹146.50 → credit ₹14,503.50.
- **The cash does not pass through the wallet.** It lands in the QR's bank account at step 1. The wallet credit at step 3 is a
  number on the screen that the retailer can then spend (for example by IMPS). So the wallet credit is only safe if the bank
  account really received the money.
- **Matching to the bank.** Each approved request carries the bank's UTR. In the platform ledger I checked, 19 of 20 deposit
  lines carried the same UTR as an approved request, so the **UTR is the key for matching a wallet credit to a bank deposit**.
  Those deposits are the same money as the QR credits. They are not extra money available for anything else.
- **Daily limit:** each QR has `DailyMaxLimit`; `UsedToday` and `RemainingToday` come back from Get QR. How the limit is applied
  to a request is decided upstream.

---

## 6. Where each thing lives in the code

| Thing | File |
|---|---|
| All QR endpoints | `backend/TamilPay.Api/Controllers/QrController.cs` |
| Request models | `backend/TamilPay.Api/Models/QrInsertRequest.cs`, `QrRequestInsertRequest.cs`, `QrRequestActionRequest.cs`, `QrRequestRejectRequest.cs` |
| Shop names on the lists | `backend/TamilPay.Api/Services/WalletOwnerDirectory.cs` |
| Upstream caller | `backend/TamilPay.Api/Services/RemoteApiClient.cs` |
| Static QR popup, QR image, collect request form | `src/pages/HomePage.jsx` |
| Admin QR list and Add New | `src/pages/QrCodesPage.jsx` |
| Admin pending list, Approve, Reject, all requests | `src/pages/QrRequestsPage.jsx` |
| QR Reports and Admin QR Report | `src/pages/ReportsPage.jsx` (`qrReports`, `adminQrReport`) |
| Routes `/qr-codes`, `/qr-requests` | `src/utils/router.js` |

---

## 7. Behaviours to know

1. **Opening the popup takes a QR from the pool every time** (`Qr/GetNext`), even if the retailer only wanted to look. The VPA dropdown
   only holds the QRs pulled in that one popup session.
2. **The QR image is made in the browser** from the VPA. TamilPay never stores or serves an image.
3. **Submitting a request does not credit anything.** Only an admin's **Approve** does.
4. **Retailer remarks:** on the live data, remarks appear only on rejected rows (the reason). The remark a retailer types on submit
   was `null` on every approved row, so it does not appear to be saved upstream.
5. **The Reports "Store" column for QR is the QR's name**, while the admin lists show the retailer's real shop in a separate column.
6. **A rejected request keeps `approvedTime`** (the time of the decision) and has no closing balance.
7. **The report upstream ignores dates**, so the Admin QR Report filters by date in the browser.

---

## 8. Limits and risks (so nothing surprises you)

1. **No server-side authentication.** Anyone who can reach the API can call approve, reject or add-QR. Only the screens are hidden
   from non-admins.
2. **Approve credits real wallet balance.** Combined with point 1, an unauthorised approve means free credit. This is the highest risk here.
3. **The UTR is typed by the retailer.** Our backend does not verify it against the bank or check it was not already used. Check duplicates
   and amounts at approval time against the bank statement. If the upstream does not check, the same payment can be reported twice.
4. **`walletId` comes from the browser.** The backend credits whichever wallet the request names.
5. **`amount` is not checked against the QR's daily limit** by our backend.
6. **The pool and the daily limit are enforced upstream.** The only messages our backend passes on are the upstream's own.

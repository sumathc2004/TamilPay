# TamilPay — Credit Card Payment API

How a retailer pays a customer's **credit card bill** from their TamilPay wallet: what they see and
click, the exact request and response of every API, and what happens to the money.

- Everything here was read from the code in this repository (`src/` and `backend/TamilPay.Api/`).
- Examples marked **live** were captured from the running app on 7 Oct 2026 (client 5). Where a
  retailer's name or card digits appear they are real report rows, with at most the last four digits.
- Examples marked **shape** show the exact fields the code reads but were **not** captured live. Fetching
  a real bill needs a real customer's card, and **Pay moves real money**, so I did not call them.
- No keys, passwords or tokens are in this file. None exist in this code path.

> This is the *Credit Card Bill Payment* feature (the **Card Payments** tile). It is a different thing
> from the **PG** feature, where a card holder pays *into* the wallet through a gateway. See `PG API.md`.

---

## 1. The big picture

```
Browser (React)                  TamilPay.Api (this repo)                 Two separate upstream services
───────────────                  ────────────────────────                 ──────────────────────────────
/card-payments page              /api/bbps/billers      ───────────────►  BBPS service (nammapayments.in)
                                 /api/bbps/fetch-bill   ───────────────►    Bbps:BillersUrl, Bbps:FetchBillUrl
                                                                             its own { status:bool, … } envelope
                                 /api/bbps/pay          ───────────────►  Clients API (172.198.160.73)
                                 /api/bbps/report       ───────────────►    Bbps/CreditCard/Pay, /Report
                                                                             envelope { status:"success", … }
```

- **Two upstream services, two formats.** Looking up banks and fetching a bill go to the **BBPS
  service** at `nammapayments.in`. Paying and the report go to the **clients API** (`RemoteApi:BaseUrl`),
  which takes the money out of the wallet and talks to the BBPS network.
- **The backend stores nothing durable.** The fetched bill and the "already paid" marker are kept in
  memory (§6). The payment record itself lives upstream and comes back through the report.
- **Client id is always 5.** `MasterClient.Id = 5`. The clients-API calls (pay, report) always send
  `Client_ID: 5`; anything the browser sends for it is ignored.
- **Authentication.** There is no server-side authentication on these endpoints (no `[Authorize]`).
  "Signed in" is browser state. The pay endpoint takes the wallet id from the request body (§4.3 notes why that matters).

### Configuration

| Setting | Where | Value / meaning |
|---|---|---|
| `Bbps:BillersUrl` | `appsettings.json` | `https://nammapayments.in/v5bc/api/aeps/bpay_SelectBillCategory` |
| `Bbps:FetchBillUrl` | `appsettings.json` | `https://nammapayments.in/v5bc/api/aeps/bpay_FetchBillSingle` |
| `RemoteApi:BaseUrl` | `appsettings.json` | `http://172.198.160.73/clients/api/` |
| HTTP client `Bbps` | `Program.cs` | 30-second timeout for the BBPS service |

If `Bbps:BillersUrl` is empty the biller list answers `503` *"Card payments are not connected yet…"*;
if `Bbps:FetchBillUrl` is empty, fetch-bill answers `503` *"Bill fetch is not connected yet…"*.

### Error shapes from our backend

| Case | HTTP | Body |
|---|---|---|
| Our own validation / unknown input | `400` | `{ "message": "…" }` |
| Bill already paid, or being paid right now | `409` | `{ "message": "…" }` |
| The biller said no (wrong card/mobile) or the payment was refused upstream | `422` | `{ "message": "…" }` (the bank's own words) |
| A service we call is unreachable / returned an error | `502` | ProblemDetails `{ "title", "status": 502, "detail": "…" }` |
| Not connected (URL not set) | `503` | `{ "message": "…" }` |

The page shows `message`, then `detail`, then a generic line with the status code.

---

## 2. User experience — click by click

**Who:** a signed-in retailer. They pay a customer's credit card bill and the amount is taken from
their TamilPay wallet. **Where:** Home → **Card Payments** tile (`/card-payments`).

The screen is one panel titled **Credit Card Payment** with a back arrow. It has three phases:
**choose the bank → enter the card details → see the bill and pay**.

### 2.1 Phase 1 — choose the bank

| Step | What the user sees / does | What happens inside |
|---|---|---|
| 1 | Taps **Card Payments** on Home | Page changes to `/card-payments` (no reload) |
| 2 | Nine grey skeleton rows while loading | `GET /api/bbps/billers?category=credit-card` (§4.1) |
| 3 | A search box "Search by bank name", a **Popular banks** row of logos, and **All banks** (alphabetical) | The list has **38** credit-card billers today, sorted by name. Popular row = HDFC, SBI Card, ICICI, Axis, Kotak, IndusInd, IDFC FIRST, RBL, shown only if the API returned them |
| 4 | Types in the search box | Filters by bank name as you type (case-insensitive "contains"); the heading changes to "N banks found"; the Popular row is hidden while searching. A ✕ clears it. "No bank matches “…”." if none |
| 5 | Taps a bank (a logo, or a row) | Moves to phase 2 for that bank. Anything typed or fetched before is cleared and the page scrolls to the top |
| — | Back arrow (top left) | In phase 1 → Home. In phase 2/3 → back to the bank list |

If the list can't load, a red notice shows the reason (for example *"Could not load banks (502)."*).

**Bank logos.** Each bank shows its symbol in a circle (`src/utils/bankLogos.js`, keyed by the exact
`billerId`). Logos come from a public open-source set on jsDelivr (by the bank's 4-letter IFSC code) or
Google's favicon service. Banks with no public logo (Saraswat, Suryoday) and any logo that fails to load
show an **initials badge** instead.

### 2.2 Phase 2 — enter the card details

The top of the panel shows the chosen bank, a line "Enter the card details to fetch the bill", and a
**Change** button (back to the list).

Every bank names its inputs differently (*"Registered Mobile No"*, *"Last 4 digits of Primary Credit Card
Number"*…), so the page recognises them **by meaning** and shows the same clean form for every bank:

| Recognised as | Test on the field name | Shown as | Input behaviour |
|---|---|---|---|
| **mobile** | name contains `mobile` | "Registered mobile number", with a `+91` prefix | Digits only; a pasted `+91 98765 43210` or `098765 43210` keeps just the 10 digits; max 10 |
| **card** | name matches `last 4` or `4 digit` | "Last 4 digits of card", with a `••••` prefix | Digits only (letters+digits if the biller says `ALPHANUMERIC`); upper-cased; max 4 |
| **other** | anything else | The bank's own field name | Free text, or digits only if the biller says `NUMERIC` |

Fields are ordered **card first, then mobile, then anything else**.

Click **Verify card**. Checks run first, in the browser, with no network call:

| Check | Message |
|---|---|
| Required field empty (an optional field may be empty) | *Required.* |
| Mobile isn't 10 digits starting 6–9 | *Enter a valid 10-digit mobile number.* |
| Card isn't exactly 4 characters | *Enter the last 4 digits of the card.* |

If they pass, the button reads **Fetching your bill…** and the page calls `POST /api/bbps/fetch-bill`
(§4.2). **Fetching the bill is the verification**: a wrong mobile / last-4 pair is refused by the bank, and
that message is shown in a red notice exactly as the bank wrote it (for example *"Invalid combination of
customer parameters"*).

Three outcomes:

| Result | Screen |
|---|---|
| Bill found | Phase 3 (§2.3) |
| **No bill due** — the card matched and this cycle is fully paid | A green "**No bill due**" panel: *"Card •••• 1234 is verified, and there is nothing to pay for the current billing period."* plus the bank's own words. Buttons: **Pay another card**, **Check this card again** |
| Refused / error | Red notice; the user stays on the form and can correct and retry |

### 2.3 Phase 3 — the bill and paying it

The panel is two columns (stacked on a phone).

**Left: the bill.**
- A **card face** that confirms it is the right card: the bank name and logo, `•••• •••• •••• 1234`, the
  **card holder** name, and the **due date**.
- Facts: **Total amount due**, **Minimum amount due**, **Due date** with a chip (*"5 days left"*, *"Due today"*,
  red *"Overdue by N days"* when past, amber when ≤ 3 days), and **Statement date**. A fact the bank didn't
  send isn't shown. Amounts use Indian grouping, for example `₹2,19,318.80`.

**Right: how much to pay.** Three radio rows:

| Option | Shown when | Amount |
|---|---|---|
| **Total amount due** — "Clears the full statement" | the bank sent a total | the total |
| **Minimum amount due** — "Avoids a late fee; interest applies on the rest" | the bank sent a minimum | the minimum |
| **Other amount** | always | an input box (₹), digits and one decimal point, max 2 decimals. A hint shows the allowed range when the bank sent a maximum |

The default is **Total** if there is one, otherwise **Other**.

Under the options, a summary: **Statement amount**, **Paying now**, and **Still due after this payment**
(becomes *"₹0.00 · cleared"* when equal, or **Extra paid (as card credit)** if more than the total). A
reminder "Pay before {date} to avoid late payment charges". And **You pay: ₹…**.

**Amount rules** (shown under the box for *Other amount*; the same limits are enforced again by the server):

| Rule | Message |
|---|---|
| Not a positive number | *Enter a valid amount.* |
| Below the bank's minimum payable (default ₹1 if none) | *The least you can pay is ₹…* |
| Above the bank's maximum payable | *The most you can pay is ₹…* |

**Paying takes two presses** because it moves real money:
1. The button reads **Pay ₹X**. Press it → a line appears: *"₹X will be paid from your TamilPay wallet to
   {bank} •••• 1234."* and the button becomes **Confirm and pay ₹X**; the other button becomes **Cancel**.
2. Press **Confirm and pay** → the button reads **Paying…** and the page calls `POST /api/bbps/pay` (§4.3).

Choosing a different amount option resets the confirmation. **Edit card details** goes back to phase 2.

**If paying fails**, a red notice shows the reason (for example the bank/upstream's text, *"This bill has
expired. Fetch the bill again to pay."*, or *"This bill has already been paid."*) and the confirmation resets,
so the user can try again or edit.

**If paying works**, a **receipt** replaces the bill:
- ✔ **Payment successful**, the amount, "paid to {bank} •••• 1234"
- **Card holder**, **Paid on** (date and time), **Reference**, and **Status** (the upstream's message)
- The note *"The bank may take a short while to show this payment on the card."*
- Buttons: **Pay another card** and **View wallet ledger**.
- The wallet balance in the top bar is refreshed (the page tells the app the wallet changed).

A line at the bottom of the form reads: *"Your card details are only used to fetch this bill."* Only the
**last four digits** of the card are ever entered; full card numbers are never typed, sent or stored.

### 2.4 After paying — Reports

**Reports → Credit Card Reports** shows every payment (§4.4), with search, a status filter
(**SUCCESS / FAILED / PENDING**), a date range, **Export Excel**, and a printable **receipt** per row
(*"Credit Card Payment Receipt"*, or *"Credit Card Payment Refund"* for a refund row). Admins see all
retailers (with **Retailer** and **Shop** columns); retailers see only their own wallet.

### 2.5 The flow in one picture

```
Retailer                     TamilPay.Api                              Upstream
────────                     ────────────                              ────────
Home ▸ Card Payments
  │ GET /api/bbps/billers ─────────► (cached 1 h) ───────────────────► BBPS: bpay_SelectBillCategory
  │ choose bank, type card last 4 + mobile
  │ POST /api/bbps/fetch-bill ─────► look up the biller's own field names;
  │                                  reference = TPAY + time + random ─► BBPS: bpay_FetchBillSingle
  │          ◄── bill summary + reference; bill kept on the server 30 min
  │ choose Total / Minimum / Other, press Pay, then Confirm and pay
  │ POST /api/bbps/pay ────────────► check reference, amount limits, once-only
  │                                  take card/mobile/name from the saved bill ─► Clients API: Bbps/CreditCard/Pay
  │          ◄── receipt (message, amount, reference)       wallet debited upstream
  │ Reports ▸ Credit Card Reports
  │ GET /api/bbps/report ──────────► add shop names ───────────────────► Clients API: Bbps/CreditCard/Report
```

---

## 3. Upstream API map

| Our endpoint | Calls | Method and URL | Body sent |
|---|---|---|---|
| `GET /api/bbps/billers` | BBPS service | `POST {Bbps:BillersUrl}` | `{ "biller": "CREDIT CARD" }` |
| `POST /api/bbps/fetch-bill` | BBPS service | `POST {Bbps:FetchBillUrl}` | `{ "reference", "billerId", "custParam": [ { "name", "value" } ] }` |
| `POST /api/bbps/pay` | Clients API | `POST {RemoteApi:BaseUrl}Bbps/CreditCard/Pay` | see §4.3 |
| `GET /api/bbps/report` | Clients API | `POST {RemoteApi:BaseUrl}Bbps/CreditCard/Report` | `{ Client_ID: 5, walletId, fromDate, toDate, status }` |
| (shop names on the report) | Clients API | `customer/SelectByClientId`, then one wallet lookup per customer | cached 10 minutes |

**BBPS service response format** (different from the clients API):
```json
{ "status": true, "statusCode": 200, "message": "…", "data": … }
```
`status` is a boolean here. **Clients API format:** `{ "status": "success", "statusCode": 200, "message": "…", "data": … }`.

---

## 4. Our endpoints — request and response

Base: the site's own host, for example `https://tamilpay.in`, or `http://localhost:5174` in development
(the dev server forwards `/api` to the backend on `5109`).

### 4.1 List the banks

`GET /api/bbps/billers?category=credit-card`

| Param | Rules |
|---|---|
| `category` | Default `credit-card`. **Only `credit-card` is accepted** (case-insensitive); anything else → `400 { "message": "Unknown bill category." }` — the endpoint can't be used to query the BBPS service for other things |

The result is cached in memory for **1 hour** (and used by fetch-bill to look field names up).

**200 — live** (first two of 38):
```json
[
  { "category": "Credit Card", "billerId": "AUBA00000NAT3Q", "billerName": "AU Bank Credit Card",
    "customerparams": [
      { "paramName": "Registered Mobile No",               "dataType": "NUMERIC", "optional": false, "values": null },
      { "paramName": "Last 4 Digits of Credit Card",       "dataType": "NUMERIC", "optional": false, "values": null } ] },
  { "category": "Credit Card", "billerId": "AXIS00000NATKF", "billerName": "Axis Bank Credit Card",
    "customerparams": [
      { "paramName": "Registered Mobile Number",           "dataType": "NUMERIC", "optional": false, "values": null },
      { "paramName": "Last 4 digits of Credit Card Number","dataType": "NUMERIC", "optional": false, "values": null } ] }
]
```

| Field | Meaning |
|---|---|
| `billerId` | The bank's biller code, for example `HDFC00000NATW1`. Used everywhere else |
| `billerName` | Display name, sorted A→Z |
| `customerparams[]` | The inputs this bank needs. Names differ per bank — **the exact `paramName` is what must be sent back** |
| `…dataType` | `NUMERIC` or `ALPHANUMERIC` |
| `…optional` | `true` → may be left blank |
| `…values` | A fixed list of allowed values, or `null` |

Errors: `400` unknown category; `502` BBPS service unreachable or `status:false` (its message in `detail`); `503` URL not set.

### 4.2 Fetch the bill (also verifies the card)

`POST /api/bbps/fetch-bill` — `Content-Type: application/json`

**Request**
```json
{
  "billerId": "HDFC00000NATW1",
  "values": {
    "Registered Mobile Number": "9876543210",
    "Last 4 Digits of Credit Card": "1234"
  }
}
```
`values` is keyed by the biller's **exact `paramName`** (from §4.1).

**What the backend does, in order**
1. Loads the biller list (§4.1, cached) and finds `billerId`. Not found → `400 { "message": "Unknown biller." }`.
2. Builds `custParam` **only from that biller's own parameters** — never from arbitrary keys the browser sends.
   For each parameter: empty + optional → skipped; empty + required → `400 { "message": "<paramName> is required." }`;
   longer than 64 characters → `400 { "message": "<paramName> is too long." }`; otherwise `{ name, value }` (trimmed).
3. Makes a unique reference: `TPAY` + UTC time `yyyyMMddHHmmssfff` + 12 random hex characters
   (for example `TPAY20261007173012345A1B2C3D4E5F6`).
4. Calls the BBPS service:
   ```json
   { "reference": "TPAY20261007…", "billerId": "HDFC00000NATW1",
     "custParam": [ { "name": "Last 4 Digits of Credit Card", "value": "1234" },
                    { "name": "Registered Mobile Number",     "value": "9876543210" } ] }
   ```
5. Interprets the answer:

| BBPS answer | Our answer |
|---|---|
| `status:false` and the message says nothing is due (matches *no bill due*, *payment received*, *no dues*, *bill already paid*, *no outstanding/pending amount*) | **200** with `noBillDue: true` (below) — the card matched and it's fully paid |
| `status:false` for any other reason, or an empty answer | **422** `{ "message": "<the bank's message>" }`, e.g. *"Invalid combination of customer parameters"* |
| `status:true` | **200** with the bill summary, and the bill is saved on the server for **30 minutes** (§6) |
| Service unreachable / timed out / bad JSON | **502** ProblemDetails *"Could not reach the biller service: …"* |

**200 — bill found (shape)**
```json
{
  "reference": "TPAY20261007173012345A1B2C3D4E5F6",
  "fetchId": "…",
  "billerId": "HDFC00000NATW1",
  "billerName": "HDFC Bank Credit Card",
  "customerName": "RAHUL KUMAR",
  "totalDue": 219318.80,
  "minimumDue": 10966.00,
  "maxPayable": 500000.00,
  "minPayable": 1.00,
  "dueDate": "2026-10-10",
  "billDate": "2026-09-20",
  "noBillDue": false,
  "message": null
}
```
Example values are illustrative; field names and types are exactly those in `BillSummary`.

| Field | Where it comes from in the BBPS answer |
|---|---|
| `reference` | `data.reference`, else the one we generated |
| `fetchId` | `data.fetchId` — must be passed back when paying |
| `customerName` | `data.billDetails.customerName` (double spaces collapsed) |
| `totalDue` | `data.billDetails.amount`, else `data.amount` |
| `minimumDue` | additional-data tag named **"Minimum Amount Due"** (`data.additionalData.tag[]`) |
| `maxPayable` | tag **"Maximum Permissible Amount"** |
| `minPayable` | `data.minAmount` |
| `dueDate`, `billDate` | `data.billDetails.dueDate`, `.billDate` (ISO date text) |

The BBPS service sends amounts as a mix of strings and numbers; the backend reads both and returns numbers.
Any field it didn't send is `null` (and the page simply doesn't show it).

**200 — no bill due (shape)**
```json
{ "reference": "TPAY…", "billerId": "HDFC00000NATW1", "billerName": "HDFC Bank Credit Card",
  "noBillDue": true, "message": "Payment received for the billing period - no bill due",
  "totalDue": null, "minimumDue": null, "dueDate": null }
```
Nothing is saved server-side in this case (there is nothing to pay).

**Errors — live**
```
400  { "message": "Unknown biller." }                         (billerId not in the list)
400  { "message": "Registered Mobile Number is required." }   (a required field left empty)
```

### 4.3 Pay the bill

`POST /api/bbps/pay` — `Content-Type: application/json`. **This moves real money from the wallet.**

**Request**
```json
{ "reference": "TPAY20261007173012345A1B2C3D4E5F6", "walletId": 56, "amount": 5000.00 }
```

| Field | Rules |
|---|---|
| `reference` | The reference returned by fetch-bill. Must still be saved on the server (30 minutes) |
| `walletId` | The retailer's wallet to debit. Must be > 0 |
| `amount` | Rounded to 2 decimals; must equal the rounded value (no 3rd decimal), be > 0, and sit inside the bill's limits |

**The card is not in the request.** The biller, mobile, last-4, holder name, the bank's field names and the
`fetchId` all come from the bill saved at fetch time. The payment **cannot be pointed at a different card**
than the one that was verified.

**Checks, in order** (first failure wins):

| # | Check | Response |
|---|---|---|
| 1 | `reference` empty, or not in the saved bills (expired after 30 minutes, backend restarted, or never fetched) | `400 { "message": "This bill has expired. Fetch the bill again to pay." }` |
| 2 | Already paid (paid marker present) | `409 { "message": "This bill has already been paid." }` |
| 3 | `walletId ≤ 0` | `400 { "message": "No wallet is linked to this account." }` |
| 4 | `amount ≤ 0` or has more than 2 decimals | `400 { "message": "Enter a valid amount." }` |
| 5 | `amount < minPayable` of the saved bill | `400 { "message": "The least you can pay is ₹x." }` |
| 6 | `amount > maxPayable` of the saved bill | `400 { "message": "The most you can pay is ₹x." }` |
| 7 | The same reference is being paid right now (double-click) | `409 { "message": "This payment is already being processed." }` |

**Then the backend calls the clients API** `POST Bbps/CreditCard/Pay`:
```json
{
  "Client_ID": 5,
  "walletId": 56,
  "amount": 5000.00,
  "billerId": "HDFC00000NATW1",
  "mobile": "9876543210",
  "cardNumber": "1234",
  "customerName": "RAHUL KUMAR",
  "reference_id": "TPAY20261007173012345A1B2C3D4E5F6",
  "custParam": [ { "name": "Last 4 Digits of Credit Card", "value": "1234" },
                 { "name": "Registered Mobile Number",     "value": "9876543210" } ],
  "fetchId": "…"
}
```
`custParam` and `fetchId` are the **same identifiers the bill was fetched with**, under the bank's own field
names. The BBPS network rejects a payment ("Invalid input") when they don't match, so they are re-sent exactly.

**Answers**

| Upstream | Our answer |
|---|---|
| `status: "success"` | The reference is marked **paid for 24 hours** (so it can't be paid twice), and **200** `{ "message": "<upstream message>", "amount": 5000.00, "reference": "TPAY…", "data": <upstream data or null> }` |
| Anything else | **422** `{ "message": "<upstream message>" }` — or *"The payment did not go through."* if there was none. The reference is **not** marked paid, so the user can retry |

The in-flight lock on the reference is always released, success or not. The `data` field is passed through
untouched from the clients API (it isn't interpreted here); the page shows `message`, `amount` and `reference`.

**Receipt shown by the page** uses: `amount` (from the response), `message` (as *Status*), `reference`, the card
holder from the fetched bill, the card's last 4, the bank name, and the time the page received the answer.
The **NPCI reference** (the bank-side id, like `NS016280022339666280`) is not in this response; it appears in
the report (§4.4).

> **Note on the wallet id.** The backend debits the `walletId` it is given, from the request body. It does not
> check it against a sign-in, because the app has none on the server. The page sends the signed-in user's own
> wallet. Anyone able to call the API directly could name another wallet, so the real protection must be added at
> the server level if that matters (see §8).

### 4.4 Credit card report

`GET /api/bbps/report?walletId={id}&fromDate=2026-10-01&toDate=2026-10-07&status=SUCCESS`

| Param | Rules |
|---|---|
| `walletId` | The retailer's wallet. **`0` = every wallet on the client** (what admins use). Retailers send their own |
| `fromDate`, `toDate` | Must parse as dates (`yyyy-MM-dd`), else `400 { "message": "Choose a valid date range." }` |
| `status` | Optional: `SUCCESS`, `FAILED` or `PENDING` (any case). Anything else → `400 { "message": "Unknown status." }` |

Upstream `Bbps/CreditCard/Report` with `{ Client_ID: 5, walletId, fromDate, toDate, status }` (`status` is
sent as `null` when not given, upper-cased otherwise). Then **`storeName`** (the retailer's shop) is added to
each row from the wallet-owner directory (cached 10 minutes); a wallet that can't be matched has none.

**200 — live** (one payment row)
```json
{
  "Id": 5627, "createdTime": "2026-10-07T22:01:18.893",
  "walletId": 56, "username": "7975646117",
  "retailerName": "Vinay B D", "MOBILE_NUMBER": "7975646117",
  "CardNumber": "3000", "ConsumerName": "VINAY BD",
  "Amount": 14650.00, "charges": 10.00, "closingbalance": 31482.50,
  "txntype": "DEBIT", "channel": "BBPS", "status": "SUCCESS",
  "npciRef": "NS016280022339666280",
  "remarks": "Credit card bill pay NPCI NS016280022339666280",
  "storeName": "Vinay Store"
}
```

| Field | Meaning |
|---|---|
| `Id` | Wallet entry id (capital `I` in this report) |
| `createdTime` | When the entry was made |
| `walletId`, `username`, `retailerName`, `MOBILE_NUMBER`, `storeName` | Who paid (retailer) and their shop. Note the capitalised `MOBILE_NUMBER` |
| `CardNumber`, `ConsumerName` | Last 4 digits and the card holder. **Can be `null`** (refund rows, and failed rows) |
| `Amount` | Capital `A`. The bill amount paid |
| `charges` | The fee charged. **₹10.00 on a payment, ₹0 on a refund** in the data today |
| `closingbalance` | Wallet balance right after this entry |
| `txntype` | `DEBIT` (the payment) or `CREDIT` (a refund of a failed payment) |
| `channel` | `BBPS` |
| `status` | `SUCCESS`, `FAILED` or `PENDING` |
| `npciRef` | The bank-side payment id, or `null` when it failed |
| `remarks` | Text such as `Credit card bill pay NPCI …`, `Credit card bill pay 0398`, `Credit card bill pay refund` |

**How a failed payment shows up (live).** The report is **one row per wallet entry**, so a failed payment is
two rows — the debit that failed, then the credit that refunds it, which includes the fee:
```json
{ "Id": 5555, "createdTime": "2026-10-07T20:32:05.45",  "CardNumber": "0398", "ConsumerName": null,
  "Amount": 49999, "charges": 10, "closingbalance": 85446.28, "txntype": "DEBIT",  "status": "FAILED",  "npciRef": null,
  "remarks": "Credit card bill pay 0398" }
{ "Id": 5556, "createdTime": "2026-10-07T20:32:05.587", "CardNumber": null,   "ConsumerName": null,
  "Amount": 50009, "charges": 0,  "closingbalance": 135455.28, "txntype": "CREDIT", "status": "SUCCESS", "npciRef": null,
  "remarks": "Credit card bill pay refund" }
```
Here `49,999 + 10 = 50,009` is returned, so the retailer is made whole. On the live data 1–7 Oct the report
had **295 rows: 139 successful payments, 78 failed payments and 78 matching refunds** (a failed payment is always followed by its refund).

Errors: `400` (date or status), `502` upstream failure.

---

## 5. How the screen is built from the data

| On screen | From |
|---|---|
| Bank rows, search, popular row | `GET /api/bbps/billers` (38 billers), `POPULAR_BANKS` list matched by exact `billerId` |
| Form fields and their labels | The biller's `customerparams`, classified by meaning (`mobile` / `card` / `other`) |
| Card face, due-date chip, facts | The bill summary (§4.2) |
| Amount options | `totalDue`, `minimumDue`, and an "other" box limited by `minPayable` (default ₹1) and `maxPayable` |
| "Pay before {date}" | `dueDate` |
| Receipt | The pay response (§4.3) plus the fetched bill |

---

## 6. What the server keeps in memory (and for how long)

| What | Key | Lifetime | Purpose |
|---|---|---|---|
| Bank list | `bbps-billers:credit-card` | 1 hour | Avoid asking BBPS for 38 billers on every call; used to look up field names |
| A fetched bill (biller, mobile, last 4, holder name, limits, `fetchId`, `custParam`) | `bbps-fetch:{reference}` | **30 minutes** | So Pay uses the **verified** card, not browser data |
| "Paid" marker | `bbps-paid:{reference}` | 24 hours | A reference can be paid **once** |
| "In flight" set | (process memory) | While a payment runs | Blocks a double-click paying twice at the same moment |
| Wallet-owner directory (shop names) | `wallet-owners:v2` | 10 minutes | Adds the shop to report rows |

All of it is lost when the backend restarts or the app pool recycles. After a restart the user just sees
*"This bill has expired. Fetch the bill again to pay."* and verifies the card again. The saved bill and the
"paid" marker are lost together, so an old reference can't be paid again after a restart — paying needs a fresh
fetch, which creates a **new** reference. (Paying the same card twice on purpose is therefore always possible;
the once-only rule protects against double clicks and repeated requests for one fetched bill.)

---

## 7. Where each thing lives in the code

| Thing | File |
|---|---|
| All four endpoints, validation, caches, bill parsing | `backend/TamilPay.Api/Controllers/BbpsController.cs` |
| `Biller`, `BillerParam`, BBPS envelope | `backend/TamilPay.Api/Models/Biller.cs` |
| Shop names on the report | `backend/TamilPay.Api/Services/WalletOwnerDirectory.cs` |
| Clients-API caller and envelope | `backend/TamilPay.Api/Services/RemoteApiClient.cs` |
| Client id constant | `backend/TamilPay.Api/MasterClient.cs` |
| BBPS URLs | `backend/TamilPay.Api/appsettings.json` (`Bbps:*`) |
| The whole Card Payments screen | `src/pages/CardPaymentsPage.jsx` |
| Bank logos | `src/utils/bankLogos.js` |
| Credit Card Reports + receipt | `src/pages/ReportsPage.jsx` (`cardReports`) |
| Home tile | `src/pages/HomePage.jsx` (`Card Payments`) |
| URL ↔ page (`/card-payments`) | `src/utils/router.js`, `src/App.jsx` |

---

## 8. Known limits and behaviours (so nothing surprises you)

1. **Only credit cards** are offered (`Categories` has a single entry). Other BBPS bill types are not exposed.
2. **No server-side authentication**, and Pay trusts the `walletId` in the body (§4.3). The browser is what keeps a retailer on their own wallet.
3. **The bill is held for 30 minutes.** After that, or after a backend restart, fetch again.
4. **A reference can be paid once**, for 24 hours, and not at the same moment twice. A *failed* payment doesn't mark it paid, so it can be retried.
5. **The fee** is added upstream (₹10 on a payment in the current data); this app does not calculate or show it. It appears in the report's `charges` column and is refunded with a failed payment.
6. **The `data` from `Bbps/CreditCard/Pay` is passed through unread.** Its fields were not captured (calling Pay spends real money), so this document doesn't list them. Use the report's `npciRef` for the bank-side reference.
7. **Report rows can have `null` card and holder names** (refund rows and some failed rows).
8. **Extra payment** over the total is allowed up to the bank's maximum; the page labels it "Extra paid (as card credit)".
9. **The popup/countdown from the PG flow does not apply here**; this flow ends on its own receipt screen.
10. **Logos depend on public services** (jsDelivr, Google favicons). If one is down, the initials badge shows instead; nothing breaks.

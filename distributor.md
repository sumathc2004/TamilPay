# TamilPay — Distributor API

How **distributors** work in TamilPay: who they are, how an admin maps retailers to them, what a distributor sees,
how their **PG commission** is earned and credited, and the exact request and response of every API.

- Everything here was read from the code in this repository (`src/` and `backend/TamilPay.Api/`).
- Examples marked **live** were captured from the running app on **21 Oct 2026** (client 5). Mobile numbers are shortened with `…`.
- Examples marked **shape** show the exact fields the code reads but were **not** captured live. I did not save a new mapping
  or create a distributor to capture them (they change data).
- No keys, passwords or tokens are in this file. None exist in this code path.

---

## 1. What a distributor is

- A distributor is an ordinary customer whose **role is "Distributors"** (role id 2). The three roles are:

  | Id | Role |
  |---|---|
  | 1 | Retailer |
  | 2 | Distributors |
  | 3 | Admin |

- An admin **maps retailers to a distributor**, and for each retailer sets a **PG commission %**.
- Whenever a mapped retailer's **card payment (PG) succeeds**, the distributor's wallet is credited with that percent of the **payment amount**.
  It is credited straight away, into the distributor's own wallet, as a ledger entry named *"PG distributor commission NPPG…"*.
- A distributor logs in like anyone else. Their Home page gets a **Retailers** box that lists their mapped retailers (read-only).

**Live today:** 3 distributors.

| Distributor | Shop | Wallet | Mapped retailers | PG commission |
|---|---|---|---|---|
| Prakash V | Sai Eswari Money Mart | 79 | 5 (KARTHIKEYAN, Padmanathan, Balaji, GUNASEKARAN, Sathish A) | 0.05% each |
| Deepak | Namma payments | 69 | 1 (Jeyabalan R) | 0.05% |
| Jeyabalan R | JJ - 5 Enterprises | 57 | 2 (both named Jeyabalan R) | 0.15% each |

---

## 2. The big picture

```
Browser (React)                     TamilPay.Api (this repo)                  Upstream clients API
───────────────                     ────────────────────────                  ────────────────────
Admin ▸ Distributors box      ──►   GET  /api/customers            ─────────►  customer/SelectByClientId
Customers ▸ Distributors tab  ──►   GET  /api/customers            ─────────►  customer/SelectByClientId
Customers ▸ View mapping      ──►   GET  /api/customers/{id}/distributor/retailers ──► Distributor/Mapping/SelectRetailers
Map a retailer                ──►   POST /api/customers/{id}/distributor/retailers ──► Distributor/Mapping/Save
Add Customer (pick the role)  ──►   GET  /api/roles                ─────────►  Role/Select
Distributor ▸ Home ▸ Retailers──►   GET  /api/customers/{own id}/distributor/retailers ──► Distributor/Mapping/SelectRetailers
```

- The backend is a thin proxy plus checks. It stores nothing. Mappings, commissions and the commission credits all live upstream
  (`http://172.198.160.73/clients/api/`, from `RemoteApi:BaseUrl`).
- Every upstream call is a `POST` returning `{ "status": "success", "statusCode": 200, "message": "…", "data": … }`.
- **Client id is always 5** (`MasterClient.Id`). Whatever a browser sends for it is ignored.
- There is **no server-side authentication** on these endpoints (§9).

### Error shapes

| Case | HTTP | Body |
|---|---|---|
| Our own checks fail | `400` | `{ "message": "…" }` |
| This retailer is already mapped | `409` | `{ "message": "This retailer is already mapped to this distributor." }` |
| The customer has no wallet | `404` | `{ "message": "No wallet is linked to this account." }` |
| The server refused the save | `422` | `{ "message": "<server's message>" }` |
| A service we call failed | `502` | ProblemDetails `{ "detail": "<message>" }` |

---

## 3. User experience — click by click

### 3.1 Admin: create a distributor

**Customers ▸ Add Customer.** The **Role** dropdown lists Retailer, Distributors and Admin. Pick **Distributors**, fill in the customer's details and save.
Then give them a wallet with the **Add** button in the Wallet column of the Customers table — without a wallet they have nothing to credit
commission to and no "View mapping" button.

### 3.2 Admin: see the distributors

- **Admin page ▸ Distributors box** opens a list of everyone whose role is Distributors (name, mobile, shop, with a count). It is a quick list only.
- **Customers page ▸ Distributors tab** shows the same people in the full table (wallet balance, transfer, payout charges, reports, …). The tabs are
  **All, Retailers, Distributors, Admins**, each with a count. The Add Customer role dropdown and the "All" tab include distributors.

### 3.3 Admin: view and edit a distributor's mapping

On a distributor's row in Customers, under the **Reports** button, there is a blue **View mapping** button. It opens the **Mapped retailers**
page (`/customers/{id}/mapping`):

- **Summary card:** the distributor (avatar, name, mobile, shop, "Distributor" tag) and three figures: **Mapped retailers**, **Combined balance**,
  **Average commission**.
- **Map a retailer** (a card beside the table on a wide screen, above it on a phone):
  1. **Retailer:** type a name or store. The list shows only retailers **not already mapped** to this distributor.
  2. **PG commission (%):** for example `0.05`. Up to 4 decimals, between 0 and 100.
  3. **Map retailer.** The table reloads and shows the new row.
- **Table:** retailer (name and shop), mobile, balance and PG commission %. On a phone each retailer is a card.
- The page is for admins only (a non-admin sees "This page is for admins.").

There is no screen to **change a commission** or **remove** a mapping yet. Only mapping a new retailer is built.

### 3.4 Distributor: see my retailers

A signed-in distributor sees a **Retailers** box next to **Reports** in the "More" panel on Home. It opens **/my-retailers**:

- A summary card (their name, **Mapped retailers**, **Combined balance**, **Average commission**).
- A search box (name, store or mobile) and the table: retailer, mobile, balance and the **PG commission %** they earn on that retailer.
- It is **read-only**. They cannot add or remove retailers.
- Their earned commission shows in their **Wallet Ledger** (§5).

---

## 4. Our endpoints — request and response

Base: the site's own host (for example `https://tamilpay.in`, or `http://localhost:5174` in development, which forwards `/api` to the backend on `5109`).

### 4.1 Roles

`GET /api/roles` → **200 — live**
```json
[ { "id": 1, "roleName": "Retailer" }, { "id": 2, "roleName": "Distributors" }, { "id": 3, "roleName": "Admin" } ]
```
A customer's role comes back on every customer record as `roleId` and `roleName`.

### 4.2 Customers (to find distributors)

`GET /api/customers?clientId=5` → every customer of the client, including `roleId` and `roleName`. Distributors are the rows where
`roleName` is `Distributors`.

**200 — live** (one distributor row, trimmed)
```json
{ "id": 94, "Client_ID": 5, "FULL_NAME": "Deepak", "MOBILE_NUMBER": "9902…", "STORE_NAME": "Namma payments",
  "username": "9902…", "roleId": 2, "roleName": "Distributors" }
```
`username` is the wallet login; it is present only when the customer has a wallet.

### 4.3 The retailer picker (what leaves distributors out)

`GET /api/customers/retailers?clientId=5` → `[ { "customerId", "fullName", "storeName", "walletId", "roleName" } ]` for everyone with a
wallet, **except distributors**. Admin ledger, "Apply to Individual" in PG Settings, pull back and the "Map a retailer" form all use it. A distributor
therefore never shows up in those lists.

### 4.4 A distributor's mapped retailers

`GET /api/customers/{id}/distributor/retailers` — `{id}` is the **distributor's customer id**.

- The backend finds that customer's wallet, then calls upstream `Distributor/Mapping/SelectRetailers` with
  `{ "Client_ID": 5, "distributorWalletId": <that wallet> }`.
- A distributor's own page uses their own customer id here.
- `404 { "message": "No wallet is linked to this account." }` if the customer has no wallet.

**200 — live** (Deepak, customer 94)
```json
[ { "id": 2, "retailerWalletId": 57, "distributorWalletId": 69, "pgCommissionPercent": 0.05,
    "FULL_NAME": "Jeyabalan R", "MOBILE_NUMBER": "7200…", "STORE_NAME": "JJ - 5 Enterprises",
    "username": "7200…", "currentBalance": 0.00 } ]
```

| Field | Meaning |
|---|---|
| `id` | The mapping's id (lower-case `id` from our API; the upstream spells it `Id`) |
| `retailerWalletId`, `distributorWalletId` | The two wallets |
| `pgCommissionPercent` | The percent of each of that retailer's **card payment amounts** the distributor earns (`0.05` means 0.05%) |
| `FULL_NAME`, `MOBILE_NUMBER`, `STORE_NAME`, `username` | The retailer |
| `currentBalance` | The retailer's wallet balance now |

An empty list `[]` means nothing is mapped.

### 4.5 Map a retailer to a distributor

`POST /api/customers/{id}/distributor/retailers` — `{id}` is the distributor's customer id. `Content-Type: application/json`

```json
{ "retailerWalletId": 52, "pgCommissionPercent": 0.05 }
```

| Field | Rules |
|---|---|
| `retailerWalletId` | Required. Must be the wallet of a customer whose role is **Retailer** |
| `pgCommissionPercent` | Required. 0 to 100, **at most 4 decimals** |

**Checks, in order** (the first failure answers):

| # | Check | Response |
|---|---|---|
| 1 | Commission outside 0–100 or more than 4 decimals | `400` *"Enter a commission between 0 and 100 (up to 4 decimals)."* |
| 2 | The distributor has no wallet | `404` *"No wallet is linked to this account."* |
| 3 | The customer in the route is not a distributor | `400` *"Retailers can only be mapped to a distributor."* |
| 4 | The chosen wallet is not a retailer's (an admin, a distributor, an unknown wallet) | `400` *"Only a retailer can be mapped."* |
| 5 | Already mapped to this distributor | `409` *"This retailer is already mapped to this distributor."* |

For 3 and 4, if the wallet or role isn't found in the list the app keeps for 10 minutes, it **re-reads the list once** before refusing, so a retailer
or distributor created a moment ago still works.

**Then it calls upstream `Distributor/Mapping/Save`:**
```json
{ "Client_ID": 5, "retailerWalletId": 52, "distributorWalletId": 35, "pgCommissionPercent": 0.05, "isActive": true }
```
Upstream answers `{ "status": "success", "statuscode": 200, "message": "Distributor mapping saved", "data": { "id": 1 } }`.

**200** `{ "message": "Distributor mapping saved" }`. **422** `{ "message": "<server's message>" }` if the server refuses.

**Live validation examples** (nothing saved)
```
400  { "message": "Only a retailer can be mapped." }                                    (an admin's wallet)
409  { "message": "This retailer is already mapped to this distributor." }              (an existing mapping)
```

---

## 5. How the commission works

When a mapped retailer's card payment **succeeds**, the server credits the distributor's wallet:

> **commission = payment amount × pgCommissionPercent ÷ 100**

It checks out on the live data. For 0.05%:

| Payment | Retailer | Commission credited | = |
|---|---|---|---|
| ₹25,000.00 (NPPG002804) | Padmanathan | ₹12.50 | 25,000 × 0.05% |
| ₹10,000.00 (NPPG002794) | Balaji | ₹5.00 | 10,000 × 0.05% |
| ₹49,995.00 (NPPG002792) | Padmanathan | ₹25.00 | 49,995 × 0.05% |
| ₹49,997.00 (NPPG002788) | Padmanathan | ₹25.00 | 49,997 × 0.05% |

- **Where it appears:** the distributor's **Wallet Ledger** (Reports ▸ Wallet Ledger), as a CREDIT with channel `DISTRIBUTOR` and the text
  **"PG distributor commission NPPG00xxxx"**, where the `NPPG…` number is the card payment's reference.
- **When:** at the time the payment succeeds. On 20 Oct, 42 such credits had been made by the time I looked: **₹2,010.22** in total, to Jeyabalan R (JJ - 5)
  ₹1,803.97 and Prakash V ₹206.25.
- **The retailer is not affected.** Their charge and credit are as before. The commission comes out of the company's share.
- **Where it comes from:** on the payments I checked, the retailer is charged **1.5%**, the gateway costs **1.35%**, so the company's margin is **0.15%** of the
  payment. A 0.05% commission uses one third of that margin; a **0.15%** commission (as on Jeyabalan R's two mapped retailers) uses **all of it**.
  The app does not stop an admin entering a commission larger than the margin (§9).

---

## 6. Behaviour and rules to know

1. **Distributors are kept out of retailer pickers** (§4.3), but they are in the Customers list and its Distributors tab.
2. **A distributor's wallet balance is theirs to use** like any wallet: transfer, reports, and so on. Only the Retailers box and the commission differ.
3. **Mapping is per distributor.** The app only prevents mapping the same retailer twice to the **same** distributor. It does not check whether the retailer is already
   mapped to a **different** distributor (§9).
4. **A distributor can be a retailer's retailer.** Jeyabalan R (JJ - 5) is a distributor and is also mapped as a retailer under Deepak, with a mapping of its own (§1). The app allows this.
5. **Commission is credited by the server, not by this app.** Nothing in our code computes or credits it.
6. **Changing or removing a mapping** is not available from the app yet.

---

## 7. Where each thing lives in the code

| Thing | File |
|---|---|
| Mapped retailers (read) and Map a retailer (write) | `backend/TamilPay.Api/Controllers/CustomersController.cs` (`GetMappedRetailers`, `AddMappedRetailer`) |
| Retailer picker that leaves distributors out | `backend/TamilPay.Api/Controllers/CustomersController.cs` (`GetRetailers`) |
| Request and row models | `backend/TamilPay.Api/Models/AddMappingRequest.cs`, `MappedRetailer.cs` |
| Wallet owner list with roles (and its fresh re-read) | `backend/TamilPay.Api/Services/WalletOwnerDirectory.cs` |
| Admin Distributors box (list) | `src/components/DistributorsModal.jsx`, `src/pages/AdminPage.jsx` |
| Distributors tab, View mapping button | `src/pages/CustomersPage.jsx` |
| Mapped retailers page for the admin | `src/pages/DistributorMappingPage.jsx` (route `/customers/{id}/mapping`) |
| A distributor's own Retailers box and page | `src/pages/HomePage.jsx`, `src/pages/MyRetailersPage.jsx` (route `/my-retailers`) |
| Roles in the Add Customer form | `src/pages/CustomerDetailPage.jsx` |

---

## 8. Using it, step by step

1. **Add the distributor:** Customers ▸ Add Customer ▸ Role **Distributors** ▸ save, then add a wallet for them.
2. **Map retailers:** Customers ▸ Distributors tab ▸ the distributor's **View mapping** ▸ **Map a retailer** ▸ choose the retailer and the PG commission ▸ **Map retailer**.
3. **From then on,** each card payment by a mapped retailer credits the distributor automatically (§5).
4. **The distributor** signs in, opens **Retailers** on Home to see who is mapped, and checks their Wallet Ledger for the commission credits.

---

## 9. Limits and risks (so nothing surprises you)

1. **No server-side authentication.** Anyone who can reach the API can map a retailer or read a distributor's retailers. The admin-only pages are protected only by which screens are shown.
2. **No limit on the commission.** The form accepts 0 to 100%. A commission above the company's margin (0.15% on the payments I checked) makes the company lose money on each payment, and
   nothing stops it.
3. **A retailer can be mapped to more than one distributor.** If the server pays commission to each of them, the retailer's payments are paid out more than once. I do not know whether the
   server allows that.
4. **No way to edit or remove a mapping from the app.** To change a commission today, the server's own `Distributor/Mapping/Save` would have to be called again, and it is unknown whether that
   updates or adds a row.
5. **A test mapping I made by accident.** While looking for this API I called `Distributor/Mapping/Save` with made-up wallet numbers (999999 and 999998, 0.1%) and it answered "saved" with id 1.
   It does not show on any list, but it may still be in the server's table. Please have it checked and removed.
6. **Commission amounts and timing are the server's.** This app shows them in the ledger but cannot correct them.

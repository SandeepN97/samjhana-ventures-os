# Who can do what (roles)

Three roles: **Staff**, **Manager**, **Admin**. The backend enforces every rule below; the screens only hide what a
person cannot use. The rules are checked by `RoleMatrixIntegrationTest`, which calls every API endpoint as staff, a
manager, an admin and a visitor who is not logged in, and fails if one answers differently from this page or if an
endpoint is added without being listed. **To add or change an endpoint, update that test's table and this page together.**

Legend: ✅ allowed · ✖ refused.

## Daily work and records
| Feature | Staff | Manager | Admin |
|---|---|---|---|
| Enter sales and entries (any business except bank loans); staff cannot add to a closed day | ✅ | ✅ | ✅ |
| See transactions (cost and profit hidden from staff; bank loans hidden from staff) | ✅ | ✅ | ✅ |
| Edit a transaction | ✖ | ✅ | ✅ |
| Approve or reject a transaction | ✖ | ✅ | ✅ |
| Daily close for today; today's summary; recent closes | ✅ | ✅ | ✅ |
| Close a past day; verify a daily report | ✖ | ✅ | ✅ |
| History of all daily reports, and one day's report | ✖ | ✅ | ✅ |
| Analytics (sales for everyone; profit and loans for manager and admin only) | ✅ | ✅ | ✅ |
| Settings values such as the NEA electricity rate (read and change) | ✖ | ✅ | ✅ |

## Bank loans
| Feature | Staff | Manager | Admin |
|---|---|---|---|
| See loans | ✖ | ✅ | ✅ |
| Record a payment made to the bank (needs the bank's reference and a photo of its receipt) | ✖ | ✅ — waits for an admin | ✅ — approved at once |
| Open a receipt photo (private; never on the public site) | ✖ | ✅ | ✅ |
| Approve or reject a waiting payment (rejecting needs a reason) | ✖ | ✖ | ✅ |
| See how many payments are waiting | ✖ | ✅ | ✅ |
| Add a new loan | ✖ | ✖ | ✅ |
| Edit, approve or reject any loan entry | ✖ | ✖ | ✅ |

**How a payment to the bank works:** a manager enters the amount, the bank's own reference number and a photo of the
receipt. The payment is saved as *waiting* and is **not counted** in loan balances, analytics or the daily report. An admin
opens the receipt and approves it (it then counts) or rejects it with a reason (the manager sees the reason, and the entry
is kept, never deleted). A payment entered by an admin is approved at once. Every time a receipt is opened it is written
to the audit log. Photos are re-saved as plain JPEG on upload, so phone location and camera details are dropped.

## Petrol and EV
| Feature | Staff | Manager | Admin |
|---|---|---|---|
| Fuel entries; see fuel prices | ✅ | ✅ | ✅ |
| Set fuel prices, fetch the NOC price | ✖ | ✅ | ✅ |
| EV sessions: start, stop, unlock, take payment (a discount below the price needs a manager) | ✅ | ✅ | ✅ |
| Charger lock mode | ✖ | ✅ | ✅ |
| Rotate a charger's secret | ✖ | ✖ | ✅ |
| EV vehicle catalog (rates): add, edit, remove | ✖ | ✖ | ✅ |
| Electricity bills | ✖ | ✅ | ✅ |

## Rental
| Feature | Staff | Manager | Admin |
|---|---|---|---|
| Rent entries; list active properties; property ledger (needed to enter rent) | ✅ | ✅ | ✅ |
| Add, edit, remove properties | ✖ | ✖ | ✅ |

## Furniture and beekeeping
| Feature | Staff | Manager | Admin |
|---|---|---|---|
| See products (cost prices hidden from staff) | ✅ | ✅ | ✅ |
| Change stock | ✖ | ✅ | ✅ |
| Create, edit, delete products and their pictures; Live/Hidden on the website | ✖ | ✖ | ✅ |
| Customers: list, add, edit | ✅ | ✅ | ✅ |
| Delete a customer | ✖ | ✅ | ✅ |
| Sales history and delivery status | ✅ | ✅ | ✅ |

## Online shop and website
| Feature | Staff | Manager | Admin |
|---|---|---|---|
| See online orders; confirm, ready, complete; notes | ✅ | ✅ | ✅ |
| Cancel an online order | ✖ | ✅ | ✅ |
| Website text and pictures | ✖ | ✅ | ✅ |
| Restaurant dishes: see | ✅ | ✅ | ✅ |
| Restaurant dishes: availability | ✖ | ✅ | ✅ |
| Restaurant dishes: add, edit, delete | ✖ | ✖ | ✅ |
| Upload a picture | ✖ | ✅ | ✅ |
| Delete a picture | ✖ | ✖ | ✅ |

## Administration
| Feature | Staff | Manager | Admin |
|---|---|---|---|
| Change your own password and profile | ✅ | ✅ | ✅ |
| Create, deactivate users | ✖ | ✖ | ✅ |
| **Reset a user's password** (temporary password, shown once; the person must choose their own at next login) | ✖ | ✖ | ✅ |
| **Change a user's role** (not your own) | ✖ | ✖ | ✅ |
| Staff (HR) records | ✖ | ✖ | ✅ |
| "Check my address" for the login limit | ✖ | ✖ | ✅ |

## Public (no login)
The public site, shop, order tracking, `/api/public/**`, the login endpoint and `/api/fuel-prices/current` need no
login. They never return cost prices, profit, stock counts, staff data or internal IDs.

## Notes
- **A forgotten admin password:** another admin resets it from Settings → Users. If there is no other admin, use the
  emergency SQL in `docs/RECOVERY.md`. Keep at least two admins.
- **Roles live in the database as a `role` column.** Row-level security keeps everyone but the backend out of the
  tables, so the backend code in this table is the only enforcement.
- **A body is checked before the role** on endpoints that validate a request body, so an empty request to such an
  endpoint may be answered 400 even for someone not allowed. No data is returned either way.

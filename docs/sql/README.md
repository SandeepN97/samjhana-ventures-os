# SQL to run on Supabase

Staging uses `ddl-auto: validate`, so the app refuses to start if a table or column it expects is missing: run the script for a change on the **staging** database before that change is deployed, and on **prod** at release. Production's default is `ddl-auto: update` (the `DDL_AUTO` setting on Render), which adds some things itself, so some older script headers that say production validates are out of date; running the script first is still the safe order. Every script is safe to run twice. Each file's header says more. Which scripts are already applied on each environment is not recorded here: ask the owner or check the database.

| Script | What it adds |
|---|---|
| `2026-09-26-add-evse-id-to-charge-sessions.sql` | the `evse_id` column and an index on charge sessions (existing sessions get EVSE 1) |
| `2026-10-admin-reset-password.sql` | the "must change password" flag (`must_change_password`) on users |
| `2026-10-beekeeping-products.sql` | the `beekeeping_products` table (run it before the online-shop script) |
| `2026-10-online-shop.sql` | `media_assets`, `site_content`, `restaurant_dishes`, `shop_orders` and `shop_order_lines`, plus new columns on furniture items and beekeeping products |
| `2026-10-loan-receipts.sql` | the `loan_receipts` table for bank-loan payment photos |
| `2026-10-ocpp-diagnostics.sql` | the OCPP diagnostic tables `ocpp_message_log`, `ocpp_connection_log`, `ocpp_command_log` and `ocpp_session_evidence` |

New SQL goes here, named `YYYY-MM-description.sql` (the existing `2026-09-26-...` file keeps its full date), with a header that says when to run it. Builds in `docs/security-handoff/DECISIONS-MADE.md` that need new columns or tables need a script here first.

# Features

## Business Modules

### Petrol Pump (Shringeshwor)

Daily fuel sales tracking with Weighted Average Cost (WAC) profit calculation.

- **Daily Sales Entry** — Record liters sold, fuel type (Petrol/Diesel), rate per liter, and transaction amount
- **WAC Profit Calculation** — Automatically computes profit using `(Sell Rate - WAC) x Liters`
- **Fuel Orders** — Track incoming fuel purchases (tanker deliveries) with liters, rate, and supplier details
- **Fuel Price Management** — View and update current petrol/diesel selling prices
- **NOC Auto-Price Scraper** — Automatically fetches latest prices from [noc.org.np](https://noc.org.np) at 12:15 AM and 6:00 AM NPT daily. Prices can also be fetched manually via `POST /api/fuel-prices/fetch-noc` (admin only). System-scraped prices show "NOC Auto-Update" as the source

### EV Charging Station

Meter-based and percentage-based billing for electric vehicle charging.

- **Meter Mode** — Enter opening/closing meter readings; units and amount calculated automatically (`Units = Closing - Opening; Amount = Units x Rate`)
- **Percentage Mode** — Charge based on battery percentage for vehicles without meter readings
- **Vehicle Management** — Register vehicle types (e-rickshaw, electric car, etc.) with dynamic per-unit rates
- **NEA Reconciliation** — Track units consumed against Nepal Electricity Authority billing

### Furniture Shop

Inventory management with customer tracking and order history.

- **Inventory Management** — Add/edit furniture items with stock quantities (`Stock = Initial + In - Out`)
- **Customer Management** — Maintain customer records for repeat business
- **Order Entry** — Create orders linked to customers and inventory items
- **Order History** — View past orders with filtering and search
- **Furniture Dashboard** — Overview of stock levels, recent orders, and sales summary

### House Rental

Tenant payment tracking and property management.

- **Rental Entry** — Record monthly rent payments per tenant
- **Due Calculation** — Automatically computes overdue amounts (`Months Overdue x Monthly Rent`)
- **Maintenance Tracking** — Log maintenance expenses against properties
- **Deposit Management** — Track security deposits per tenant

### Bank Loans

Loan tracking with principal/interest split on payments.

- **Add Loans** — Register loans with principal amount, interest rate, and start date
- **Payment Recording** — Record payments with automatic split between principal and interest
- **Interest Accrual** — Calculates interest using `(Principal x Rate x Days) / 36500`
- **Balance Tracking** — View remaining principal and total interest paid

---

## Staff Management

- **Staff CRUD** — Add, edit, and delete employee records
- **Business Unit Assignment** — Assign staff to specific business units
- **Staff Directory** — Searchable list of all employees across business units

---

## Reports and Daily Close

- **Daily Close** — End-of-day snapshot capturing totals for each business unit
- **Reports Page** — Aggregated views of transactions by date range, business unit, and type
- **Records Page** — Searchable transaction history across all business units
- **Pending Reviews** — Queue of transactions awaiting admin approval

---

## Bilingual UI

- **Language Toggle** — Switch between English and Nepali at any time via the `LanguageToggle` component
- **Devanagari Numerals** — Numbers displayed in Devanagari script when Nepali is selected (e.g., `१,२३,४५६`)
- **Lakhs/Crores Formatting** — Currency formatted in South Asian style (e.g., `12,34,567` instead of `1,234,567`)
- **Full Translation Coverage** — All labels, buttons, headings, and messages translated via i18next

---

## Custom Components

| Component | Description |
|-----------|-------------|
| `DatePicker` | Custom date picker with Nepali-friendly formatting |
| `SearchableSelect` | Dropdown with type-ahead filtering for large lists |
| `DynamicFormBuilder` | Generates forms from `FieldTemplate` metadata per business unit |
| `QuickActionButtons` | Large touch-friendly 2x3 grid for Dad's home screen |
| `LanguageToggle` | EN/NE language switcher |

---

## Authentication and Security

- **JWT Authentication** — Stateless token-based auth with 7-day expiration
- **Role-Based Access** — Admin and standard user roles
- **Public Endpoints** — `/api/auth/**` and `/api/fuel-prices/current` are accessible without login
- **Protected Endpoints** — All other API routes require a valid JWT token

---

## API Endpoints Overview

| Controller | Base Path | Description |
|------------|-----------|-------------|
| `AuthController` | `/api/auth` | Login, token refresh |
| `AdminController` | `/api/admin` | User management (create, list, change password) |
| `TransactionController` | `/api/transactions` | CRUD for all business unit transactions |
| `DailyReportController` | `/api/daily-reports` | Daily close reports |
| `FuelPriceController` | `/api/fuel-prices` | Fuel price management + NOC scraper trigger |
| `FurnitureController` | `/api/furniture` | Inventory, customers, orders |
| `EvVehicleController` | `/api/ev-vehicles` | EV vehicle type and rate management |
| `StaffController` | `/api/staff` | Staff CRUD |

Full API documentation is available at `/swagger-ui` when the backend is running.

# Architecture

## System Overview

Samjhana Ventures OS uses a **registry-based architecture** where each business unit (petrol pump, EV charging, furniture, rental, loans) is registered with its own metadata, field templates, and calculation strategy. A central `CalculationEngine` dispatches to the correct strategy implementation based on the business unit code.

The backend is a Spring Boot 3.2.1 REST API with JWT authentication. The frontend is a React 18 SPA built with Vite, styled with Tailwind CSS, and uses Zustand for state management. Both layers communicate over REST, with the frontend proxying API calls in development.

---

## Architecture Diagrams

### 1. Registry Pattern

```mermaid
flowchart TB
    subgraph BusinessRegistry["Business Registry (Core)"]
        BR[("Business Registry<br/>Central Metadata Store")]
    end

    subgraph BusinessUnits["Registered Business Units"]
        PETROL["Petrol Pump<br/><i>Shringeshwor</i>"]
        EV["EV Charging<br/><i>Station</i>"]
        FURNITURE["Furniture<br/><i>Shop</i>"]
        RENTAL["House Rental<br/><i>Properties</i>"]
        LOAN["Bank Loan<br/><i>Management</i>"]
    end

    subgraph PetrolMeta["Petrol Metadata"]
        PM1["Field: Liters (number)"]
        PM2["Field: Density (decimal)"]
        PM3["Field: Fuel Type (enum)"]
        PM4["Field: Rate/Liter (currency)"]
        PM5["Calc: WAC Profit Strategy"]
    end

    subgraph EVMeta["EV Metadata"]
        EM1["Field: Opening Meter (number)"]
        EM2["Field: Closing Meter (number)"]
        EM3["Field: Unit Rate (currency)"]
        EM4["Field: NEA Bill Ref (text)"]
        EM5["Calc: Unit Reconciliation"]
    end

    BR --> PETROL
    BR --> EV
    BR --> FURNITURE
    BR --> RENTAL
    BR --> LOAN

    PETROL --> PetrolMeta
    EV --> EVMeta
```

### 2. Entity Relationship Diagram

```mermaid
erDiagram
    BUSINESS_UNIT ||--o{ TRANSACTION : has
    BUSINESS_UNIT ||--o{ RESOURCE : has
    BUSINESS_UNIT ||--o{ FIELD_TEMPLATE : defines
    TRANSACTION ||--o{ AUDIT_LOG : generates
    USER ||--o{ TRANSACTION : enters

    BUSINESS_UNIT {
        uuid id PK
        string code UK
        string name
        string calculation_strategy
        boolean is_active
    }

    FIELD_TEMPLATE {
        uuid id PK
        uuid business_id FK
        string field_key
        string field_type
        string label_en
        string label_ne
        jsonb validation_rules
    }

    TRANSACTION {
        uuid id PK
        uuid business_id FK
        uuid entered_by FK
        string transaction_type
        date transaction_date
        decimal amount
        jsonb custom_fields
        string status
    }

    USER {
        uuid id PK
        string username UK
        string role
        string locale
    }
```

### 3. Desktop vs Mobile Viewport

```mermaid
flowchart TB
    subgraph Desktop["DESKTOP VIEW (USA Son)"]
        D_CHART1["Revenue Trend Chart"]
        D_CHART2["Business Comparison"]
        D_TABLE["Recent Transactions"]
        D_PENDING["Pending Reviews"]
    end

    subgraph Mobile["MOBILE VIEW (Nepal Dad)"]
        M_BTN1["PETROL"]
        M_BTN2["EV"]
        M_BTN3["FURNITURE"]
        M_BTN4["RENTAL"]
        M_BTN5["LOAN"]
        M_BTN6["ADD NEW"]
    end
```

### 4. Layered Architecture with Strategy Pattern

```mermaid
flowchart TB
    subgraph CLIENT["CLIENT LAYER"]
        REACT["React 18 + Tailwind"]
        PWA["PWA Mobile"]
    end

    subgraph API["API LAYER"]
        REST["REST Controllers"]
        AUTH["JWT Auth"]
    end

    subgraph SERVICE["SERVICE LAYER"]
        CALC_ENGINE["CalculationEngine"]
        PETROL_STRAT["PetrolStrategy"]
        EV_STRAT["EVStrategy"]
        LOAN_STRAT["LoanStrategy"]
        RENTAL_STRAT["RentalStrategy"]
        FURNITURE_STRAT["FurnitureStrategy"]
    end

    subgraph DATA["DATA LAYER"]
        H2["H2 Database"]
        IMG["Image Storage"]
    end

    CLIENT --> API
    API --> SERVICE
    CALC_ENGINE --> PETROL_STRAT
    CALC_ENGINE --> EV_STRAT
    CALC_ENGINE --> LOAN_STRAT
    SERVICE --> DATA
```

---

## Strategy Pattern

The `CalculationEngine` service dispatches calculations to the correct strategy based on the business unit's `calculationStrategy` field. Each strategy implements `BusinessCalculationStrategy`:

```
BusinessCalculationStrategy (interface)
├── PetrolStrategy       — WAC profit calculation
├── EVStrategy           — Meter reconciliation
├── LoanStrategy         — Interest accrual
├── RentalStrategy       — Due calculation
└── FurnitureStrategy    — Stock tracking
```

**Source**: `src/main/java/com/samjhana/strategy/`

---

## Business Logic Calculations

| Business | Formula |
|----------|---------|
| **Petrol** | Amount = Liters x Rate; Profit = (Sell Rate - WAC) x Liters |
| **EV** | Units = Closing Meter - Opening Meter; Amount = Units x Rate |
| **Loan** | Interest = (Principal x Rate x Days) / 36500 |
| **Rental** | Due = Months Overdue x Monthly Rent |
| **Furniture** | Stock = Initial + In - Out |

---

## Project Structure

```
samjhana-ventures-os/
├── pom.xml                                 # Maven build (dev + prod profiles)
├── .env.example                            # Environment variable template
├── docs/
│   ├── ARCHITECTURE.md                     # This document
│   ├── FEATURES.md                         # Feature documentation
│   └── DAD-PROOF-SETUP-GUIDE.md            # End-user setup guide
├── src/main/java/com/samjhana/
│   ├── SamjhanaVenturesOsApplication.java  # Entry point
│   ├── config/
│   │   ├── DataSeeder.java                 # Default data seeding
│   │   ├── SecurityConfig.java             # Spring Security + JWT config
│   │   └── WebConfig.java                  # CORS and web settings
│   ├── controller/
│   │   ├── AuthController.java             # Login / token endpoints
│   │   ├── AdminController.java            # User management
│   │   ├── TransactionController.java      # CRUD for all business transactions
│   │   ├── DailyReportController.java      # Daily close reports
│   │   ├── FuelPriceController.java        # Fuel price management + NOC scraper
│   │   ├── FurnitureController.java        # Furniture inventory + orders
│   │   ├── EvVehicleController.java        # EV vehicle rates
│   │   └── StaffController.java            # Staff CRUD
│   ├── dto/                                # Request/response DTOs (13 files)
│   ├── entity/                             # JPA entities (13 files)
│   │   ├── BusinessUnit.java               # Business unit registry
│   │   ├── Transaction.java                # Universal transaction
│   │   ├── FieldTemplate.java              # Dynamic form fields
│   │   ├── User.java                       # Authentication
│   │   ├── Staff.java                      # Employee records
│   │   ├── FuelPrice.java                  # Fuel price history
│   │   ├── EvVehicle.java                  # EV vehicle types + rates
│   │   ├── FurnitureItem.java              # Furniture inventory
│   │   ├── FurnitureCustomer.java          # Furniture customers
│   │   ├── DailyReport.java               # Daily close snapshots
│   │   ├── AuditLog.java                   # Change tracking
│   │   ├── Resource.java                   # Generic resources
│   │   └── ImageAttachment.java            # Bill/invoice photos
│   ├── repository/                         # Spring Data JPA repos (9 files)
│   ├── security/
│   │   ├── JwtAuthFilter.java              # JWT authentication filter
│   │   └── JwtUtil.java                    # Token generation/validation
│   ├── service/
│   │   ├── CalculationEngine.java          # Strategy dispatcher
│   │   ├── CustomUserDetailsService.java   # Spring Security user loader
│   │   └── NocPriceScraperService.java     # NOC fuel price scraper
│   └── strategy/
│       ├── BusinessCalculationStrategy.java # Strategy interface
│       └── impl/
│           ├── PetrolStrategy.java
│           ├── EVStrategy.java
│           ├── LoanStrategy.java
│           ├── RentalStrategy.java
│           └── FurnitureStrategy.java
├── src/main/resources/
│   └── application.yml                     # Config (profiles: dev, prod)
├── frontend/
│   ├── package.json
│   ├── vite.config.js                      # Dev server + API proxy
│   ├── tailwind.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx                        # React entry point
│       ├── App.jsx                         # Router + layout
│       ├── components/
│       │   ├── DatePicker.jsx              # Custom Nepali-friendly date picker
│       │   ├── DynamicFormBuilder.jsx       # Template-driven forms
│       │   ├── LanguageToggle.jsx           # EN/NE switcher
│       │   ├── QuickActionButtons.jsx       # Dad's home screen grid
│       │   └── SearchableSelect.jsx         # Filterable dropdown
│       ├── pages/                           # 24 page components
│       │   ├── LoginPage.jsx
│       │   ├── DashboardPage.jsx
│       │   ├── PetrolEntryPage.jsx
│       │   ├── EVEntryPage.jsx
│       │   ├── FuelOrderPage.jsx
│       │   ├── FuelPricePage.jsx
│       │   ├── EvVehiclePage.jsx
│       │   ├── FurnitureEntryPage.jsx
│       │   ├── FurnitureInventoryPage.jsx
│       │   ├── FurnitureCustomerPage.jsx
│       │   ├── FurnitureOrderPage.jsx
│       │   ├── FurnitureOrderHistoryPage.jsx
│       │   ├── FurnitureDashboardPage.jsx
│       │   ├── RentalEntryPage.jsx
│       │   ├── LoanEntryPage.jsx
│       │   ├── StaffManagementPage.jsx
│       │   ├── DailyClosePage.jsx
│       │   ├── ReportsPage.jsx
│       │   ├── RecordsPage.jsx
│       │   ├── PendingReviewPage.jsx
│       │   └── SettingsPage.jsx
│       ├── i18n/
│       │   └── index.js                    # English + Nepali translations
│       ├── utils/
│       │   ├── api.js                      # Axios instance + interceptors
│       │   └── formatters.js               # Lakhs/Crores + Devanagari numerals
│       └── test/
│           ├── setup.js                    # Vitest setup
│           └── test-utils.jsx              # Testing Library helpers
├── data/                                   # H2 database files (gitignored)
└── logs/                                   # Application logs (gitignored)
```
